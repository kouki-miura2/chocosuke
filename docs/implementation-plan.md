# 実装計画

`docs/spec.md` を実装するための計画。仕様そのものは spec.md を正とし、ここには「どう作るか」と「どの順で作るか」だけを書く。完了した項目はこのファイルから削除し、すべて終わったらファイルごと削除する。

各項目・各フェーズの終わりに `vp check` と `vp test` を通す。

## Backend（残り）

- [ ] 読み取り行数の確認: 主要な API（同期の「変更なし」「差分」「全件」、イベント登録）で D1 の `meta.rows_read` をログに出し、想定どおりか確認する。
- [ ] Cron の通知送信の手動確認: `wrangler dev --test-scheduled` で起動し、`/__scheduled?cron=*+*+*+*+*` を呼ぶ。
- [ ] `sample.*` と `/sample/:id` の削除（Frontend のフェーズ0で一緒に行う）
- [ ] API 一覧を spec.md に載せるかの判断
- [ ] web-security-auditor による監査（Frontend のフェーズ10で一緒に行う）

## Frontend

`apps/frontend` の計画。画面の見た目は `docs/design/index.html`（画面イメージサンプル: ログイン・月表示・週表示・イベント詳細・イベント編集・年月選択・予定・グループ）に合わせる。サンプルにない画面（同意・グループ参加・設定・利用規約）は同じ部品・トーンで作る。

### 1. 方針

- 状態の分け方は `apps/frontend/AGENTS.md` のとおり。サーバーのデータは TanStack Query、アプリ全体の UI の状態は Pinia、画面内の状態はコンポーネント・composable に置く。
- サーバーのデータは「同期 → ローカルDB → メモリ」の一方向で流す（spec「データ取得・同期」）。画面はメモリ上の同期結果（`useSyncQuery` の `data`）から `computed` で絞り込み・集計し、登録・変更・削除は `useMutation` → 成功後に `invalidateQueries(['sync'])` とする。API の応答で画面を直接書き換えない。
- 日付・時刻は `packages/utils` の日付ヘルパー（Asia/Tokyo）で扱い、`Date` のローカル時刻のメソッドは使わない。上限値は `LIMITS`、文字数は `charLength` で判定する（画面とAPIで同じ判定）。
- テストは `apps/frontend/AGENTS.md` のとおり Node 上で DOM なしで行う。このため、ロジック（カレンダーの並び順・バーの割り付け、CSV 生成、同期の反映、入力の検証、画像の縮小サイズの計算等）はコンポーネントから切り出して純粋な関数・composable にし、そちらをテストする。

### 2. 決定が必要な事項（推奨案）

着手前に決める。推奨案のまま進める場合は変更不要。

| #   | 事項                                          | 推奨案                                                                                                                                                                                                                                                                                  | 理由                                                                                                         |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| F1  | Google クライアントID・VAPID 公開鍵の受け渡し | 確定: ルートの `AGENTS.md`「Public config values for the frontend」のとおり。`VITE_GOOGLE_WEB_CLIENT_ID`・`VITE_VAPID_PUBLIC_KEY` を `apps/frontend/.env.local` に書き、backend 側の値は secret にする                                                                                  | 設定値を返す API を作らない（API・起動時のリクエスト・読み込み待ちが1つずつ減る）                            |
| F2  | PWA・Service Worker                           | `vite-plugin-pwa` の `injectManifest`（自前の `src/sw.ts` に `push`・`notificationclick` を書く）。プリキャッシュはアプリ本体のみで、`/api` はキャッシュしない                                                                                                                          | プッシュ通知の処理を書くには自前の Service Worker が必要。manifest・プリキャッシュの生成はプラグインに任せる |
| F3  | Google ログインのボタン                       | 確定: ルートの `AGENTS.md`「Sign in with Google and terms consent」のとおり（ログイン → 未登録なら同意画面 → 登録 API）。GIS のスクリプトは動的に読み込み、`renderButton` で描画する                                                                                                    | GIS のボタンは無効化できないため。`public/_headers` の CSP に `accounts.google.com` を追加する               |
| F4  | 画面の表示状態の保存                          | Pinia の `useViewStateStore`（表示形式・予定フィルター・バー/ドット・週の始まり）。起動時にローカルDBの `kv` から読み込み、変更時に書き込む                                                                                                                                             | spec で localStorage を使わないため。画面全体で共有する UI の状態なので Pinia が合う                         |
| F5  | ダイアログ・ボトムシートと URL                | イベント詳細は `?event=<id>`、イベント登録・編集は `/events/new`・`/events/:id/edit` のルートにする。他のダイアログ（確認・年月選択等）はルートにしない                                                                                                                                 | 通知のタップで詳細を直接開ける。スマートフォンの「戻る」で詳細・編集を閉じられる                             |
| F6  | ローカルDB のテスト                           | devDependencies に `fake-indexeddb` を追加し、同期の反映（上書き・削除・全件入れ替え・グループの切り替え）を Node 上でテストする                                                                                                                                                        | 同期の反映はデータの整合に直結するため、実際の IndexedDB の動き（トランザクション）で確認したい              |
| F7  | API エラーの扱い                              | `src/api/call.ts` に、`!res.ok` なら `{ error: code }` を読んで `ApiError` を投げる関数を置く。code → メッセージの対応表を1か所に置き、`QueryClient` の共通 `onError` でスナックバーを出す                                                                                              | 画面ごとにエラー処理を書かない。`UNAUTHORIZED` はログイン画面、`CONSENT_REQUIRED` は同意画面へ移動する       |
| F8  | 画像アップロードのタイムアウト                | 通常の API は今の3秒のまま、画像のアップロードだけ30秒にする                                                                                                                                                                                                                            | 1MB の画像はモバイル回線で3秒を超えうる                                                                      |
| F9  | 利用規約・プライバシーポリシー                | `/terms`・`/privacy` のルート（認証不要）に Vue の画面として置く。本文は `src/legal/documents.ts` に下書きを書き、運営者名・問い合わせ先はルートの `AGENTS.md`「Operator name and contact in the terms and privacy policy」のとおり環境変数で埋め込む（確定）。法的な確認は運営者が行う | 同じ見た目で表示できる。`TERMS_VERSION` との対応をコードで追える                                             |
| F10 | 追加するライブラリ                            | `idb`、`@holiday-jp/holiday_jp`、`qrcode`、`vue-draggable-plus`、`vite-plugin-pwa`（spec「アーキテクチャ」の例のとおり）。日付入力・カレンダー・ボトムシートは Vuetify 4 の部品を使い、追加しない                                                                                       | spec に記載済み。Vuetify にある部品はライブラリを足さない                                                    |

### 3. 構成

#### 3.1 ファイル配置

```
apps/frontend/src/
  main.ts                     起動。ローカルDB・表示状態の読み込み → アプリのマウント
  sw.ts                       Service Worker（push・notificationclick）
  api/client.ts               Hono RPC クライアント（既存）
  api/call.ts                 応答の確認と ApiError、code → メッセージ
  db/local-db.ts              idb のスキーマ（schedules・topics・events・images・kv）と読み書き
  db/apply-sync.ts            同期の応答を1トランザクションで反映する
  composables/
    useMeQuery.ts             GET /me（ログイン状態・同意・groupId）
    useSyncQuery.ts           同期（initialData = ローカルDB、refetchOnWindowFocus・refetchInterval）
    useSchedules.ts 等         同期結果からの導出（並び順・フィルター・月の件数・1日のイベント）
    use*Mutation.ts           登録・変更・削除（成功後に sync を invalidate）
  stores/
    notification.ts           スナックバー（既存）
    view-state.ts             表示状態（F4）
  lib/                        DOM に依存しない純粋な関数（テスト対象）
    calendar.ts               1日のイベントの並び順、月表示のバーの割り付け・「+N」、週表示の7日、「n/m日目」
    event-form.ts             入力の検証（日付範囲・日数・1日あたりの件数・時刻の前後）、通知の選択肢
    csv.ts                    CSV 生成（BOM・CRLF・クォート・CSV インジェクション対策）
    image.ts                  縮小後のサイズ計算。canvas での変換は components 側
    colors.ts                 予定の12色（キー → 色）
    format.ts                 日付・日時の表示形式（spec「共通ルール > 日付・日時の表示」）
  legal/documents.ts          利用規約・プライバシーポリシーの本文（F9）
  router/routes.ts            ルート表（既存）、router/index.ts にナビゲーションガード
  views/                      画面（下記 3.2）
  components/                 画面の部品（カレンダー、イベント詳細・フォーム、確認ダイアログ等）
```

#### 3.2 ルート

| パス                              | 画面                                 | 認証      | ボトムナビ |
| --------------------------------- | ------------------------------------ | --------- | ---------- |
| `/login`                          | ログイン                             | 不要      | なし       |
| `/consent`                        | 同意（未登録のユーザー・規約改定時） | 不要（※） | なし       |
| `/terms`・`/privacy`              | 利用規約・プライバシーポリシー       | 不要      | なし       |
| `/`                               | カレンダー（`?event=<id>` で詳細）   | 要        | あり       |
| `/events/new`・`/events/:id/edit` | イベント登録・編集                   | 要        | なし       |
| `/schedules`                      | 予定の管理                           | 要        | あり       |
| `/group`                          | グループ                             | 要        | あり       |
| `/invite/:token`                  | グループ参加                         | 要        | なし       |
| `/settings`                       | 設定                                 | 要        | あり       |

- ※ 同意画面は、未登録のユーザー（セッションはまだなく、ログインで得た ID トークンをメモリに持つ）と、規約改定後のユーザー（セッションあり）の両方が開く。どちらでもなければ `/login` へ移動する。
- ナビゲーションガード: 認証が要るルートは `useMeQuery` の結果を `queryClient.fetchQuery` で待ち、未ログインなら `/login?redirect=<元のパス>`、同意が必要なら `/consent?redirect=...` へ移動する。招待リンクから来た場合も、この `redirect` でログイン・同意の後にグループ参加画面へ戻る。
- 横向きのスマートフォン（幅600px未満）は全画面に「縦向きでご利用ください」を重ねる（CSS のメディアクエリ）。

### 4. ローカルDB と同期

- スキーマは spec「データ仕様 > ローカルDB」のとおり。`kv` のキーは `userId`・`personalRev`・`groupId`・`groupRev`・`group`（グループ情報・メンバー）・`scheduleOrder`・`viewState`。
- `useSyncQuery` の `queryFn`: `kv` のリビジョンで `GET /api/sync` を呼ぶ → `apply-sync.ts` で反映 → ローカルDB の全データをメモリ上の形で返す。
- `apply-sync.ts` の反映（1つの IndexedDB トランザクション）
  1. 応答の `groupId` が `kv.groupId` と異なれば、旧グループの `owner_id` のレコードと `group`・`groupRev` を消す。
  2. 単位ごとに、`full` ならその `owner_id` のレコードを消してから入れる。差分なら ID で上書きし、`deletedAt` があるものは消す。
  3. `rev`・`groupId`・`group`・`scheduleOrder` を `kv` に書く。
- 起動時: ローカルDB を読み、`initialData` にして即時に表示してから同期する。
- ログイン時: `/me` の `id` が `kv.userId` と異なれば、ローカルDB を全て消してから同期する（spec「ログイン・同意 > 操作」）。
- ログアウト時: ローカルDB は消さず、`queryClient.clear()` でメモリ上のデータだけを捨てる。
- IndexedDB のバージョンを上げたとき（構造の変更）は、`upgrade` で全ストアを消し、全件取得し直す。

### 5. 実装の順序

> フェーズ0〜9 は1フェーズずつ、動作確認とコミットをしてから次へ進む。

#### フェーズ0: 基盤

- [ ] F2〜F10 の決定
- [ ] `sample.*` の削除（frontend の `HomeView`・`SampleView`・`useSampleQuery`、backend の `/sample/:id`・`{service,repository,dao}/sample.*`）。`apps/frontend/AGENTS.md` の参照先も差し替える
- [ ] ライブラリの追加（F10・F6）
- [ ] 公開設定値（F1）: `wrangler.jsonc` の `vars`（`GOOGLE_CLIENT_ID`・`VAPID_PUBLIC_KEY`・`VAPID_SUBJECT`）を secret に移し（`.dev.vars`、`cf-typegen`、`worker.test.ts`、`apps/backend-worker/AGENTS.md`）、`apps/frontend/.env` に変数名と説明のコメントを書く。値が未設定でも動くようにする
- [ ] `api/call.ts`（ApiError、code → メッセージ、`QueryClient` の共通 `onError`、401・同意の遷移）
- [ ] Vuetify の設定（ライトテーマ、日本語ロケール、予定の12色）、`lib/format.ts`
- [ ] レイアウト（ボトムナビゲーション、スナックバー、横向きの表示）とルート表の骨組み

#### フェーズ1: ログイン・同意

- [ ] backend の登録の流れの変更（F3）: `POST /auth/google` は未登録ならユーザーを作らずに「未登録」を返す。`POST /auth/register`（ID トークンと同意した規約のバージョン。現在の `TERMS_VERSION` 以外は拒否）を追加し、ここでユーザーを作ってセッションを発行する。規約改定後の再同意は今の `POST /auth/consent` のまま。service・route・`worker.test.ts` のテスト、spec.md の API 関連の記述を更新する
- [ ] ログイン画面（GIS のボタン、クライアントID 未設定時の無効なボタン）
- [ ] 同意画面（規約へのリンクは新しいタブ、チェックで「同意してはじめる」を有効化。未登録なら `POST /auth/register`、規約改定なら `POST /auth/consent`）
- [ ] ナビゲーションガード（`redirect` で元の画面へ戻る）
- [ ] 利用規約・プライバシーポリシーの画面（F9。`src/legal/documents.ts` に本文の下書き、`VITE_OPERATOR_NAME`・`VITE_CONTACT_EMAIL` の埋め込みと `apps/frontend/.env` の説明）

#### フェーズ2: ローカルDB・同期

- [ ] `db/local-db.ts`・`db/apply-sync.ts`（`fake-indexeddb` でテスト）
- [ ] `useSyncQuery`（initialData、`refetchOnWindowFocus`、`refetchInterval` = `LIMITS.syncCheckIntervalMinutes`）
- [ ] ユーザーが変わったときの消去、ログアウト時のメモリの破棄
- [ ] 表示状態の Pinia ストア（F4）

#### フェーズ3: 予定

- [ ] 予定の管理画面（公開範囲の説明、並び順、「今月 n件」、グループ未参加時の導線）
- [ ] 予定の登録・変更・削除（件数・文字数・重複の判定、削除の確認にイベント件数）
- [ ] ドラッグでの並び替え（`vue-draggable-plus`、`PUT /me/schedule-order`）、並び順に含まれない予定は末尾に登録日時の昇順
- [ ] トピック管理（名前の変更・削除）

#### フェーズ4: イベント

- [ ] `lib/event-form.ts`（検証、通知の選択肢、1日あたりの件数をローカルのデータで判定）
- [ ] イベント登録・編集画面（`v-date-input` で期間外を選択不可、トピックの `v-combobox`、公開範囲の表示）
- [ ] イベント詳細（`?event=<id>`、最終更新者・「元メンバー」の表示）
- [ ] 削除（確認ダイアログ）

#### フェーズ5: カレンダー

- [ ] `lib/calendar.ts`（並び順、バーの割り付け、日跨り、「+N」、週表示の7日、「n/m日目」）
- [ ] 月表示（`v-calendar`、バー/ドット、祝日・休日、土日の色、1画面に収める）
- [ ] 1週間表示（`v-list`、当日中心、「予定なし」、クリップアイコン）
- [ ] ヘッダー（年月選択のダイアログ、前へ・次へ、今日、月/週の切り替え、予定フィルターのチップ）
- [ ] 日付枠タップのボトムシート、FAB（選択中の日を開始日にする）
- [ ] タブレットの横表示（月表示の右に選択日のイベント一覧）
- [ ] 試しのデプロイ（Workers 特有の問題を早めに見つけるため。web-security-auditor → cloudflare-deployer）

#### フェーズ6: 画像

- [ ] 縮小・JPEG 変換（長辺 `LIMITS.imageMaxPx`、品質0.85、`LIMITS.imageMaxBytes` の判定）
- [ ] 貼り付け・ファイル選択、編集画面のサムネイルと削除
- [ ] 保存の順序（イベントの保存 → 追加した画像のアップロード → 削除した画像の削除）、タイムアウト（F8）
- [ ] 詳細のサムネイル、全画面表示（ピンチで拡大）

#### フェーズ7: グループ

- [ ] 未参加の画面（作成）、参加中の画面（グループ名の編集、メンバー一覧とメニュー）
- [ ] 招待カード（`qrcode`、有効期限・期限切れ、リンクのコピー、再発行）
- [ ] グループ参加画面（`/invite/:token`、参加できない理由の表示）
- [ ] 脱退・除外・削除（確認ダイアログ。ローカルDB からの消去は同期の `groupId` の変化で行う）

#### フェーズ8: 設定

- [ ] 表示の設定（バー/ドット、週の始まり。`v-calendar`・`v-date-input` に反映）
- [ ] CSV ダウンロード（予定の選択ダイアログ、ダウンロード前の同期、`lib/csv.ts`）
- [ ] ログアウト、この端末のデータを消去（`POST /device/clear`、ローカルDB の消去、購読の解除）、退会（`DELETE /me`、ローカルDB の消去）

#### フェーズ9: PWA・通知

- [ ] manifest・アイコン、`vite-plugin-pwa`（F2）
- [ ] `sw.ts`（`push` で通知を表示、`notificationclick` で `/?event=<id>` を開く）
- [ ] 設定画面の通知（許可状態、この端末で受け取るかのオン/オフ、`POST /push-subscriptions`・`DELETE /push-subscriptions`、iOS はホーム画面に追加した場合のみの案内）

#### フェーズ10: 仕上げ

- [ ] `apps/frontend/AGENTS.md` の更新（ローカルDB と同期、lib/ の切り出し、ルート）
- [ ] spec.md への反映（F1 で Google クライアントID・VAPID 公開鍵の置き場所が変わる「DBの外で管理するデータ」等）、「画面イメージサンプル」の記載と `docs/design/` の削除
- [ ] web-security-auditor による監査（Backend の残りの項目と合わせて行う）

### 6. 開発環境のメモ

- Google ログイン: OAuth クライアントの「承認済みの JavaScript 生成元」に `http://localhost:<frontend の dev ポート>` を登録する。
- プッシュ通知の確認は HTTPS か `localhost` が必要。スマートフォン実機での確認は、試しのデプロイ先で行う。
