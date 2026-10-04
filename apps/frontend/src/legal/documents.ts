import { LIMITS, TERMS_VERSION } from 'utils'

// The terms of service and privacy policy (docs/spec.md "データ保持・プライバシー"). DRAFT: the
// operator checks it for legal issues. Whenever the text changes, set `TERMS_VERSION` to the
// revision date (root AGENTS.md "Operator name and contact in the terms and privacy policy").

const OPERATOR: string = import.meta.env.VITE_OPERATOR_NAME ?? '（運営者名）'
const CONTACT: string = import.meta.env.VITE_CONTACT_EMAIL ?? '（お問い合わせ先）'

export interface LegalDocument {
  title: string
  /** `YYYY-MM-DD`: the terms version. */
  revisedAt: string
  intro: string
  sections: { heading: string; paragraphs: string[] }[]
}

export const documents: Record<'terms' | 'privacy', LegalDocument> = {
  terms: {
    title: '利用規約',
    revisedAt: TERMS_VERSION,
    intro: `この利用規約（以下「本規約」）は、${OPERATOR}（以下「運営者」）が提供するカレンダーアプリ「チョコスケ」（以下「本サービス」）の利用条件を定めるものです。本サービスを利用するには、本規約に同意していただく必要があります。`,
    sections: [
      {
        heading: '第1条（利用登録）',
        paragraphs: [
          '本サービスは、Googleアカウントでログインし、本規約とプライバシーポリシーに同意した時点で利用登録が完了します。',
          '本サービスは日本国内での個人・家族での利用を想定しています。',
        ],
      },
      {
        heading: '第2条（アカウントの管理）',
        paragraphs: [
          'ユーザーは、自己の責任でGoogleアカウントおよび利用する端末を管理するものとします。',
          '共用の端末で利用した場合は、設定画面の「この端末のデータを消去」を実行してください。',
        ],
      },
      {
        heading: '第3条（グループ）',
        paragraphs: [
          'ユーザーはグループを作成し、招待リンクで他のユーザーを招待できます。グループの予定・イベント・画像はグループの全メンバーが参照・変更できます。',
          '招待リンクを第三者に共有しないよう注意してください。招待リンクを知っている人は、有効期限内であればグループに参加できます。',
        ],
      },
      {
        heading: '第4条（禁止事項）',
        paragraphs: [
          'ユーザーは、法令または公序良俗に違反する行為、他のユーザーや第三者の権利を侵害する行為、本サービスの運営を妨げる行為、不正アクセスやこれを試みる行為をしてはなりません。',
        ],
      },
      {
        heading: '第5条（サービスの変更・停止）',
        paragraphs: [
          '運営者は、事前の通知なく本サービスの内容を変更し、または提供を停止・終了することがあります。',
          'プッシュ通知は、端末や通信の状況により遅れたり届かなかったりすることがあります。',
        ],
      },
      {
        heading: '第6条（免責）',
        paragraphs: [
          '運営者は、本サービスに保存されたデータの消失、通知の遅延・不達、その他本サービスの利用により生じた損害について、運営者の故意または重過失による場合を除き、責任を負いません。',
        ],
      },
      {
        heading: '第7条（退会）',
        paragraphs: [
          `ユーザーは設定画面からいつでも退会できます。退会すると個人のデータは削除され、${LIMITS.deletedRetentionDays}日後に完全に消去されます。`,
        ],
      },
      {
        heading: '第8条（規約の変更）',
        paragraphs: [
          '運営者は本規約を変更することがあります。変更後は、次にアプリを開いたときに改めて同意をお願いします。',
        ],
      },
      {
        heading: '第9条（準拠法・お問い合わせ）',
        paragraphs: ['本規約は日本法に準拠します。', `お問い合わせ: ${CONTACT}`],
      },
    ],
  },
  privacy: {
    title: 'プライバシーポリシー',
    revisedAt: TERMS_VERSION,
    intro: `${OPERATOR}（以下「運営者」）は、カレンダーアプリ「チョコスケ」（以下「本サービス」）における利用者の情報を、次のとおり取り扱います。`,
    sections: [
      {
        heading: '1. 取得する情報',
        paragraphs: [
          'Googleアカウントの識別子（氏名・メールアドレス・プロフィール画像は取得・保存しません）。',
          '利用者が登録した予定・トピック・イベント・画像、グループ名・メンバー名。',
          'プッシュ通知を許可した端末の通知の送信先情報。',
        ],
      },
      {
        heading: '2. 利用目的',
        paragraphs: [
          '本サービスの提供（予定の保存・表示、グループでの共有、イベントの通知）のためにのみ利用します。広告や第三者への販売には利用しません。',
        ],
      },
      {
        heading: '3. 公開範囲',
        paragraphs: [
          '個人の予定は本人だけが参照できます。グループの予定は、そのグループのメンバーだけが参照できます。',
        ],
      },
      {
        heading: '4. 保存場所・委託',
        paragraphs: [
          '情報はCloudflare, Inc.のサービス（Cloudflare Workers・D1・R2）に保存されます。プッシュ通知は各ブラウザの通知サービス（Google・Apple・Mozilla・Microsoft）を通じて送信されます。',
          'イベントに場所を登録した場合、イベントの詳細を開くと地図を表示するため、その場所の文字列がGoogle LLCのサービス（Googleマップ）に送信されます。',
        ],
      },
      {
        heading: '5. 端末への保存',
        paragraphs: [
          'ログイン状態を保つためにCookieを使用します。表示を速くするため、取得したデータと表示の設定を端末のブラウザ（IndexedDB）に保存します。',
          'ログアウトしても端末のデータは残ります。消去するには設定画面の「この端末のデータを消去」を実行してください。',
        ],
      },
      {
        heading: '6. 保存期間',
        paragraphs: [
          `削除したデータ・退会した利用者のデータは、${LIMITS.deletedRetentionDays}日後に完全に消去します。`,
        ],
      },
      {
        heading: '7. 開示・訂正・削除',
        paragraphs: [
          'データの確認・訂正・削除は本サービスの画面から行えます。その他のご依頼は下記までご連絡ください。',
        ],
      },
      {
        heading: '8. 改定・お問い合わせ',
        paragraphs: [
          '本ポリシーを改定した場合は、次にアプリを開いたときに改めて同意をお願いします。',
          `お問い合わせ: ${CONTACT}`,
        ],
      },
    ],
  },
}
