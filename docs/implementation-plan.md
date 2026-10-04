# Backend 実装計画

`docs/spec.md` を実装するための backend（`apps/backend` + `apps/backend-worker`）の計画。仕様そのものは spec.md を正とし、ここには「どう作るか」と「どの順で作るか」だけを書く。実装が終わったフェーズはチェックを付け、全フェーズ完了後にこのファイルは削除する。

## 1. 方針

- レイヤー構成は `apps/backend/AGENTS.md` のとおり: route（`src/app.ts`）→ service → repository → DAO。D1・R2 を使う DAO は `apps/backend-worker/src/dao/` に置き、`apps/backend` には DAO のインターフェースだけを置く。
- `apps/backend` は実行環境に依存しない（Web 標準 API のみ）。Google の ID トークン検証・Web Push の暗号化・セッション署名も WebCrypto で行い、`apps/backend` に置く。
- 時刻と ID は依存として注入する（`now: () => number`、`newId: () => string`）。service のテストで固定値を使うため。
- 上限値は `LIMITS`（`packages/utils`）、文字数は `charLength` で判定する。日付の判定は `packages/utils` の日付ヘルパー（Asia/Tokyo）で行い、`Date` のローカル時刻のメソッドは使わない。
- 書き込みは「1つの操作 = 1つの D1 `batch`」とする。リビジョン（`users.rev` / `groups.rev`）の +1 と、対象レコードの `rev` 設定を必ず同じ `batch` に入れる（spec「データ取得・同期 > 同期の単位とリビジョン」）。このため DAO のメソッドは「行の CRUD」ではなく「操作」の単位で切る（例: `deleteScheduleCascade`）。

## 2. 決定が必要な事項（推奨案）

着手前に決める。推奨案のまま進める場合は変更不要。

| #   | 事項                     | 推奨案                                                                                                                                                         | 理由                                                                                                                                        |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 入力の検証ライブラリ     | `zod` + `@hono/zod-validator`                                                                                                                                  | Hono RPC で検証後の型がフロントまで伝わる。文字数は `refine` で `charLength` を使う                                                         |
| D2  | D1 用 DAO のテスト方法   | `wrangler` の `getPlatformProxy()` でローカルの D1・R2 を使い、Node 上の vitest で実際の SQL を流す                                                            | 追加の依存が要らない。SQL（`batch`・部分インデックス・サブクエリ）を本物の SQLite で確認できる                                              |
| D3  | インメモリ DAO           | D1 のテーブル用には作らない（sample と同じ形は作らない）。service は repository の手書きフェイクでテストする                                                   | `batch` の意味を持つインメモリ実装を全テーブル分書くのはコードが多く、本物との差異も生む。`apps/backend/AGENTS.md` の記述をあわせて更新する |
| D4  | Google ID トークンの検証 | Hono 組み込みの JWK 検証（`hono/jwt` の `verifyWithJwks`）。不足があれば `jose`                                                                                | 依存を増やさない。JWKS は応答の `Cache-Control` に従ってメモリにキャッシュする                                                              |
| D5  | Web Push の送信          | WebCrypto で RFC 8291（aes128gcm）と VAPID（ES256）を自前実装し、`apps/backend/src/push/` に置く。Workers 対応の既存ライブラリが見つかればそちらを優先         | Node 用の `web-push` は Workers で動かない                                                                                                  |
| D6  | セッション               | `hono/jwt`（HS256）で署名した JWT を `hono/cookie` で HttpOnly・Secure・SameSite=Lax の Cookie に入れる。中身は `{ sub: userId, tv: 同意済みバージョン, exp }` | DB を読まずに認証と同意確認ができる                                                                                                         |
| D7  | CSRF 対策                | Hono 組み込みの `csrf` ミドルウェア（Origin 確認）を `/api/*` 全体に適用                                                                                       | SameSite=Lax と併用する                                                                                                                     |
| D8  | 規約バージョンの定数     | `packages/utils/src/terms/terms.ts` に `TERMS_VERSION` を置く                                                                                                  | フロント（同意画面）とバックエンド（判定）で共有するため                                                                                    |
| D9  | 遅れた通知               | 通知日時から10分以上過ぎた通知は送らずに消す                                                                                                                   | Cron 停止後の再開で古い通知がまとめて届くのを防ぐ（spec に追記する）                                                                        |

## 3. 構成

### 3.1 ファイル配置

```
apps/backend/src/
  app.ts                      ルート定義（全エンドポイント）、エラー変換、認証・同意・CSRF ミドルウェア
  jobs.ts                     Cron から呼ぶ処理（通知送信・物理削除）。worker.ts の scheduled から呼ぶ
  errors.ts                   AppError（code を持つ）と code → HTTP ステータスの対応
  validation.ts               zod スキーマ（LIMITS・charLength を使う）
  auth/                       Google ID トークン検証、セッション JWT
  push/                       Web Push（VAPID 署名・ペイロード暗号化）
  dao/records.ts              テーブルの行の型（snake_case）
  dao/*.interface.ts          read（単一行・小さな一覧の読み取り）/ write（操作単位の書き込み = 1 batch）/ sync / job / push-subscription / image-store
  repository/                 行 → camelCase のドメイン型（case.ts）、書き込み内容の組み立て（store.repository.ts）、AuthGuard（auth-guard.session.ts）
  service/*.service.ts        業務ロジック・権限・上限チェック・リビジョン単位の決定（共通処理は context.ts・membership.ts）

apps/backend-worker/
  src/worker.ts               fetch（Hono）と scheduled（jobs）のエントリ。env からの依存組み立て
  src/dao/*.d1.ts             D1 実装（batch による操作単位の書き込み）
  src/dao/image-store.r2.ts   R2 実装
  src/dao/test-env.ts         テスト用: getPlatformProxy のローカル D1・R2 にマイグレーションを適用
  src/worker.test.ts          API 全体を本物の D1・R2 で通す結合テスト
  migrations/0001_init.sql    D1 スキーマ（wrangler d1 migrations）
  wrangler.jsonc              D1・R2 バインディング、Cron、vars
```

### 3.2 Worker の依存組み立て

- 現在の `export default createApp({...})` を、`fetch(req, env, ctx)` と `scheduled(event, env, ctx)` を持つオブジェクトに変える。
- `env` は isolate 内で不変なので、初回呼び出し時に依存（DAO → repository → service → app）を組み立ててキャッシュする。
- バインディング・設定

| 名前                                   | 種類   | 用途                          |
| -------------------------------------- | ------ | ----------------------------- |
| `DB`                                   | D1     | 全テーブル                    |
| `IMAGES`                               | R2     | イベントの画像                |
| `GOOGLE_CLIENT_ID`                     | vars   | ID トークンの `aud` 検証      |
| `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT`   | vars   | Web Push                      |
| `SESSION_SECRET` / `VAPID_PRIVATE_KEY` | secret | セッション署名、Web Push 署名 |

- Cron: `* * * * *`（通知送信）、`0 18 * * *`（物理削除。03:00 JST）。

### 3.3 エラー

- service は `AppError(code)` を投げる。`app.onError` で code を HTTP ステータスに変換し、`{ error: code }` を返す。画面は code でメッセージを出し分ける。

| code               | ステータス | 例                                                |
| ------------------ | ---------- | ------------------------------------------------- |
| `UNAUTHORIZED`     | 401        | 未ログイン、セッション期限切れ、退会済み          |
| `CONSENT_REQUIRED` | 403        | 同意済みバージョンが古い                          |
| `FORBIDDEN`        | 403        | 他人の個人データ、グループ外、作成者専用の操作    |
| `NOT_FOUND`        | 404        | 存在しない・論理削除済み                          |
| `VALIDATION`       | 400        | 文字数、日付範囲、開始・終了の前後                |
| `LIMIT_EXCEEDED`   | 409        | 件数・容量の上限（どの上限かを `limit` に入れる） |
| `DUPLICATE_NAME`   | 409        | 予定名・トピック名・メンバー名の重複              |
| `INVITE_INVALID`   | 410        | 招待リンクが無効・期限切れ                        |
| `ALREADY_IN_GROUP` | 409        | 既に別グループに参加中                            |

## 4. D1 スキーマ

spec「データ仕様」のとおり。実装上の補足だけ書く。

- 部分 UNIQUE インデックス（論理削除済みを除外）
  - `users(google_sub) WHERE deleted_at IS NULL`
  - `users(group_id, member_name) WHERE group_id IS NOT NULL AND deleted_at IS NULL`
  - `schedules(owner_id, name) WHERE deleted_at IS NULL`（同じ公開範囲内で重複不可）
  - `topics(schedule_id, name) WHERE deleted_at IS NULL`
  - `groups(invite_token)`
- 検索用インデックス
  - 差分取得: `schedules / topics / events / event_images (owner_id, rev)`
  - `users(group_id)`（メンバー一覧・人数）
  - `events(schedule_id, start_date)`（1日あたりの件数チェック）
  - `events(notify_at) WHERE notify_at IS NOT NULL AND deleted_at IS NULL`（通知送信）
  - `event_images(event_id)`
  - `push_subscriptions(user_id)`
  - 物理削除: 各テーブル `(deleted_at) WHERE deleted_at IS NOT NULL`（これがないと毎日全行を読む）
- 外部キーは定義するが、物理削除は子 → 親の順に行う（`ON DELETE CASCADE` は使わない。削除する行数を把握するため）。

### 4.1 リビジョン付き書き込みの形

```sql
-- 1つの db.batch() にまとめる（例: 個人の予定のイベント登録）
UPDATE users SET rev = rev + 1 WHERE id = ?1;
INSERT INTO events (..., rev) VALUES (..., (SELECT rev FROM users WHERE id = ?1));
```

- グループの場合は `groups` を同様に更新する。
- 配下の論理削除（予定削除など）も同じ `batch` に入れ、全行に同じ `rev` を設定する。
- 公開範囲をまたぐ移動は、両方の単位の `rev` を上げる。
- メンバー数上限は競合しても超えないよう、条件付き UPDATE で判定する: `UPDATE users SET group_id = ? ... WHERE id = ? AND (SELECT COUNT(*) FROM users WHERE group_id = ? AND deleted_at IS NULL) < ?`。変更行数が0なら `LIMIT_EXCEEDED`。

## 5. API

すべて `/api` 配下（表のパスは `/api` を省略）。認証不要は `auth/google` のみ。同意未完了でも呼べるのは `me`・`auth/consent`・`auth/logout`。

| メソッド・パス                                                       | 内容                                                                              | 主な検証                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| `POST /auth/google`                                                  | ID トークンを検証し、ユーザーを作成または取得してセッション Cookie を発行         | `aud`・`iss`・`exp`                          |
| `POST /auth/consent`                                                 | 現在の規約バージョンに同意。Cookie を再発行                                       | －                                           |
| `POST /auth/logout`                                                  | Cookie を削除                                                                     | －                                           |
| `GET /me`                                                            | ユーザーID、同意が必要か、`group_id`                                              | －                                           |
| `DELETE /me`                                                         | 退会（個人データの論理削除、脱退、Cookie 削除）                                   | 作成者の場合は作成者の交代またはグループ削除 |
| `PUT /me/schedule-order`                                             | 予定の並び順を保存                                                                | 見える予定のIDだけを受け付ける               |
| `GET /sync`                                                          | 同期（spec「データ取得・同期 > 同期API」）                                        | －                                           |
| `POST /schedules` / `PATCH /schedules/:id` / `DELETE /schedules/:id` | 予定の登録・変更・削除（配下も論理削除）                                          | 件数・名前の文字数・重複・権限               |
| `PATCH /topics/:id` / `DELETE /topics/:id`                           | トピック名の変更・削除（設定されたイベントの `topic_id` を NULL にする）          | 文字数・重複・権限                           |
| `POST /events` / `PATCH /events/:id` / `DELETE /events/:id`          | イベントの登録・変更・削除。`topicName` を受け、なければトピックを作る            | 下記 5.1                                     |
| `POST /events/:id/images`                                            | 画像の追加（本文は `image/jpeg`、幅・高さはクエリ）                               | 枚数・サイズ・容量・JPEG の先頭バイト        |
| `DELETE /images/:id`                                                 | 画像の削除                                                                        | 権限                                         |
| `GET /images/:id`                                                    | 画像の配信（`Cache-Control: private, max-age=31536000, immutable`）               | 権限                                         |
| `POST /groups`                                                       | グループ作成（グループ名・自分のメンバー名）、招待リンクの発行                    | 未参加、文字数                               |
| `PATCH /groups/current`                                              | グループ名の変更                                                                  | 作成者のみ                                   |
| `POST /groups/current/invite`                                        | 招待リンクの再発行                                                                | メンバー                                     |
| `GET /invites/:token`                                                | 参加画面用のグループ名                                                            | 有効期限                                     |
| `POST /invites/:token/join`                                          | 参加（メンバー名）                                                                | 有効期限、未参加、人数、名前の重複           |
| `PATCH /groups/current/members/me`                                   | 自分のメンバー名の変更                                                            | 文字数・重複                                 |
| `DELETE /groups/current/members/me`                                  | 脱退（作成者なら交代または削除）                                                  | －                                           |
| `DELETE /groups/current/members/:userId`                             | 除外                                                                              | 作成者のみ、自分以外                         |
| `DELETE /groups/current`                                             | グループ削除（配下を論理削除、全メンバーの `group_id` を NULL）                   | 作成者のみ                                   |
| `POST /push-subscriptions` / `DELETE /push-subscriptions`            | 購読の登録・解除（`endpoint` で特定）                                             | －                                           |
| `POST /device/clear`                                                 | 「この端末のデータを消去」: 購読の削除、Cookie の削除、`Clear-Site-Data: "cache"` | －                                           |

### 5.1 イベント登録・変更の検証

- タイトル・メモの文字数、日付の形式（`YYYY-MM-DD`・`HH:mm`、5分単位）。
- 終日なら時刻なし。そうでなければ開始・終了の時刻が必須で、開始日時 < 終了日時。
- 日数（両端を含む）が `LIMITS.eventMaxDays` 以下。
- 登録・参照できる期間内（`calendarMinYear` から、現在年（JST）+ `calendarYearsAhead` の年末まで）。
- 予定が見える範囲のものか（個人: 本人の予定、グループ: 自分のグループの予定）。
- 1日あたりの件数: `events(schedule_id, start_date)` で `start_date` が「対象期間の初日 − eventMaxDays + 1」以降のイベントを読み、日ごとに数える。変更時は自分自身を除く。
- `topicName` があり同名がなければ、トピックを作る（`topicsPerSchedule` を確認する）。
- `notify_at` を計算する（`packages/utils` に「JST の日付・時刻 → エポックミリ秒」のヘルパーを追加する）。
- 変更で公開範囲が変わる場合は、元のイベントを論理削除して新しい ID で登録する。画像は R2 で get → put してコピーし、新しい `event_images` を作る。

### 5.2 権限の判定

- 書き込み・同期のたびに `users` の行（1行）を読み、`deleted_at`・`group_id`・`member_name` を得る（退会済みなら `UNAUTHORIZED`）。
- 対象レコードの `owner_id` が「自分の users.id」または「自分の group_id」であることを service で確認する。

## 6. 同期 API の実装

- 1つの `batch` で次を読む: `users`（自分）、`groups`（`group_id` がある場合）、変わった単位の各テーブルの差分。リビジョンを比べてから差分を読むと2往復になるため、まず `users`・`groups` を読み、変わった単位だけ2回目の `batch` で差分を読む。2回目の `batch` 内でもう一度 `rev` を読み、その値を応答のリビジョンにする（1回目と2回目の間の書き込みも含めて整合させるため）。
- 全件取得の判定: 端末のリビジョンなし、または端末のリビジョン < `purged_rev`、またはグループの ID が端末と異なる。
- 応答の型は Hono RPC でフロントに渡る。`notify_at` は返さない。

## 7. Cron（`jobs.ts`）

### 7.1 通知送信（1分ごと）

1. `notify_at <= now` のイベントを、予定名・公開範囲・`owner_id` と一緒に読む（上限件数を付ける）。
2. `notify_at` が10分以上前のものは送らない（D9）。
3. 送信先: 個人なら `push_subscriptions.user_id = owner_id`、グループなら `users.group_id = owner_id` のメンバーの購読。
4. 並列数を絞って送る。404・410 が返った購読は削除する。
5. 処理したイベントの `notify_at` を NULL にする（`rev` は上げない）。

### 7.2 物理削除（1日1回）

1. テーブルごとに `deleted_at < now − deletedRetentionDays` の行を、`owner_id` ごとの最大 `rev` と一緒に読む。
2. `users.purged_rev` / `groups.purged_rev` を `MAX(現在値, 最大 rev)` に更新する。
3. `event_images` の対象は R2 のオブジェクトを先に削除し、その後に行を削除する。
4. 子 → 親の順に削除する（event_images → events → topics → schedules → groups → users）。退会したユーザーの `push_subscriptions` も削除する。

## 8. テスト

- 各レイヤーに同じ場所のテストを置く（`foo.ts` + `foo.test.ts`）。
- service: repository の手書きフェイクで、権限・上限・検証・リビジョン単位の決定・作成者の交代を網羅する。
- route（`app.test.ts`）: service のフェイクで、ステータスコード・エラー変換・認証・同意・CSRF を確認する。
- D1 DAO: `getPlatformProxy()` のローカル D1 にマイグレーションを適用して、実際の SQL を確認する（D2）。重点は次のとおり。
  - `batch` 内でリビジョンと行の `rev` が一致すること
  - 予定削除で配下が同じ `rev` で論理削除されること
  - 差分取得が `rev > ?` で論理削除済みも返すこと
  - メンバー数の条件付き UPDATE が上限で失敗すること
  - 物理削除後に `purged_rev` が更新されること
- 認証・Web Push: テスト用の鍵ペアで、署名・検証・暗号化の往復を確認する。
- 読み取り行数: 主要な API（同期の「変更なし」「差分」「全件」、イベント登録）で D1 の `meta.rows_read` をログに出し、想定どおりか確認する。

## 9. 実装の順序

> 2026-10-04: D1〜D9 は推奨案で確定し、フェーズ0〜7 を実装した。残りは未チェックの項目。

各フェーズの終わりに `vp check` と `vp test` を通す。

### フェーズ0: 基盤

- [x] D1〜D9 の決定
- [x] `wrangler.jsonc` に D1・R2・Cron・vars を追加し、`cf-typegen` を実行
- [x] `migrations/0001_init.sql`（全テーブル・インデックス）
- [x] `worker.ts` を fetch + scheduled の形にし、env から依存を組み立てる
- [x] `errors.ts`・`app.onError`・検証ライブラリの導入
- [x] `packages/utils`: `TERMS_VERSION`、JST の日付・時刻 → エポックミリ秒、日付範囲の判定ヘルパー
- [x] `getPlatformProxy()` を使う DAO テストの土台

### フェーズ1: 認証・同意

- [x] Google ID トークン検証、`POST /auth/google`（ユーザーの作成・取得）
- [x] セッション JWT・AuthGuard（`auth-guard.session.ts`）。認証を有効にし、除外パスを設定
- [x] 同意チェックのミドルウェア、`POST /auth/consent`、`POST /auth/logout`、`GET /me`
- [x] CSRF ミドルウェア

### フェーズ2: 個人の予定・トピック・イベント

- [x] リビジョン付き書き込みの DAO（個人の単位）
- [x] 予定の登録・変更・削除（配下の論理削除）、並び順の保存
- [x] トピックの変更・削除
- [x] イベントの登録・変更・削除（5.1 の検証、トピックの自動作成、`notify_at`）

### フェーズ3: 同期

- [x] `GET /sync`（変更なし・差分・全件、`purged_rev` の判定）
- [ ] 読み取り行数の確認

### フェーズ4: グループ

- [x] 作成・グループ名変更・招待リンクの発行と再発行・参加・メンバー名変更・脱退・除外・削除
- [x] 作成者の交代（参加日時が最も古いメンバー）
- [x] フェーズ2の操作をグループの単位にも対応させる（公開範囲をまたぐ移動を含む）
- [x] 同期のグループ単位（グループ情報・メンバー、`group_id` の変化）

### フェーズ5: 画像

- [x] R2 の DAO、`POST /events/:id/images`・`DELETE /images/:id`・`GET /images/:id`
- [x] 枚数・サイズ・容量（`SUM(bytes)`）の上限、公開範囲をまたぐ移動時のコピー
- [x] R2 への保存後に D1 の書き込みが失敗した場合は、R2 のオブジェクトを削除する

### フェーズ6: 通知

- [x] Web Push（VAPID・暗号化）、購読の登録・解除
- [x] Cron の通知送信（7.1）
- [ ] `wrangler dev --test-scheduled` で手動確認

### フェーズ7: 削除・退会・端末

- [x] Cron の物理削除（7.2）
- [x] 退会（`DELETE /me`）
- [x] `POST /device/clear`

### フェーズ8: 仕上げ

- [ ] `sample.*` と `/sample/:id` の削除（テンプレートのフロントエンドがまだ使っているため、フロントエンド実装時に一緒に削除する）
- [x] `apps/backend/AGENTS.md`・`apps/backend-worker/AGENTS.md` の更新（D3、Cron、バインディング）
- [x] spec.md への反映（D9、`event_images.schedule_id`）
- [ ] API 一覧を spec.md に載せるかの判断
- [ ] web-security-auditor による監査

## 10. 開発環境のメモ

- ローカルの D1: `wrangler d1 migrations apply DB --local`。
- Google ログイン: OAuth クライアントの「承認済みの JavaScript 生成元」に `http://localhost:<frontend の dev ポート>` を登録する。
- Cron の手動実行: `wrangler dev --test-scheduled` で起動し、`/__scheduled?cron=*+*+*+*+*` を呼ぶ。
- シークレット: `wrangler secret put SESSION_SECRET` など。ローカルは `.dev.vars`（コミットしない）。
