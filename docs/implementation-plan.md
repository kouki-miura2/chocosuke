# 実装計画（残り）

`docs/spec.md` を実装するための計画のうち、未完了の項目だけを残している。仕様そのものは spec.md を正とする。完了した項目はこのファイルから削除し、すべて終わったらファイルごと削除する。

各項目の終わりに `vp check`・`vp test`（`.vue` の型は `vue-tsc --noEmit`）を通す。

## 動作確認が残っている項目

開発用ログイン（下記「開発環境のメモ」）で、ログイン・同意・予定・イベント（画像の添付を含む）・月表示と週表示・グループの作成と招待リンクからの参加・設定・CSV ダウンロード・タブレット横向きの表示、本番での Google ログイン（実際のクライアントID・公式ボタン・CSP）は確認済み。次は、実際の鍵・端末・手での操作が要るため未確認。

- [ ] 脱退・除外・グループの削除・退会・「この端末のデータを消去」を画面から実行し、ローカルDB の消去まで確認する。
- [ ] 読み取り行数: 主要な API（同期の「変更なし」「差分」「全件」、イベント登録）で D1 の `meta.rows_read` をログに出し、想定どおりか確認する。

## 開発環境のメモ

- 起動: `vp run backend-worker#dev`（API、`localhost:8787`）と `vp run frontend#dev`（画面、`localhost:5173`）。初回やマイグレーションの変更後は `apps/backend-worker` で `wrangler d1 migrations apply DB --local`。
- 開発用ログイン: `apps/backend-worker/.dev.vars` に `SESSION_SECRET` と `DEV_LOGIN=true` を書き、`GOOGLE_CLIENT_ID` を設定しない。ログイン画面でアカウント名を入れると `dev:<名前>` のアカウントでログインできる（`vp dev` のときだけ表示）。
- Google ログイン: OAuth クライアントの「承認済みの JavaScript 生成元」に `http://localhost:5173` を登録し、`apps/frontend/.env.local` に `VITE_GOOGLE_WEB_CLIENT_ID`、`.dev.vars` に `GOOGLE_CLIENT_ID` を書く。
- PWA（Service Worker・manifest）は `vp dev` では動かない。`vp run frontend#build` のあとに `vp run backend-worker#dev` を起動し、`localhost:8787` で確認する（起動後にビルドした場合は Worker を再起動する）。
- プッシュ通知の確認は HTTPS か `localhost` が必要。スマートフォン実機での確認は、本番（デプロイ先）で行う。
