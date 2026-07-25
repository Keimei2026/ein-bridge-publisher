# 最初に開くファイル

**`START_HERE.html` をダブルクリックしてください。**

Repository名、公開設定、入力値をすべて指定し、各項目が「必須」「推奨」「変更可」のどれかも記載しています。

---

# Ein Bridge Publisher — Deploy Candidate v1

ChatGPTなどで作成した**単一HTMLファイル**を、スマートフォン・iPad・PCから公開し、固定URLで共有するためのCloudflare Workerです。

> 状態：ローカルのCloudflare Workersランタイムで主要機能を検証した「導入候補版」です。実際のCloudflareアカウント、Googleログイン、独自ドメイン、iPad実機での本番確認は未完了です。

## 主な機能

- Googleログイン：`koube201@gmail.com` のみ許可
- 管理画面と公開資料を別ホストへ分離
  - 管理：`publisher.ein-8.com`
  - 公開：`docs.ein-8.com`
- 単一HTML、UTF-8、最大5MB
- 128KB単位の分割アップロードとハッシュ検証
- 固定URLで上書き更新
- 直近10版の履歴とロールバック
- 削除後30日間の復元
- 静的資料モード：JavaScript禁止
- インタラクティブモード：JavaScript可、sandboxとCSPで制限
- R2不使用
- SQLite Durable Objectsを使用

## 導入方法の全体像

Cloudflareの「Deploy to Cloudflare」は、公開GitHubまたはGitLabリポジトリを配布元として使用します。そのため、最初にこのフォルダの中身を公開GitHubリポジトリへアップロードします。

1. Google CloudでWeb用OAuth Client IDを作る
2. GitHubで公開リポジトリを作り、このフォルダの**中身**をアップロードする
3. リポジトリURLをDeploy to Cloudflareへ渡す
4. 設定値とSecretを入力してデプロイする
5. 同じWorkerへ2つのCustom Domainを追加する
6. Google OAuthのAuthorized JavaScript originへ管理ドメインを登録する
7. 管理画面でログインして試験公開する

詳しい操作は、まず [`START_HERE.html`](START_HERE.html) をブラウザで開いてください。

## Deploy時に設定する値

| 名前 | 値 |
|---|---|
| `ADMIN_EMAIL` | `koube201@gmail.com` |
| `ADMIN_HOST` | `publisher.ein-8.com` |
| `PUBLIC_HOST` | `docs.ein-8.com` |
| `GOOGLE_CLIENT_ID` | Google Cloudで発行されたWeb Client ID |
| `SESSION_SECRET` | 64文字以上のランダム文字列 |

`SESSION_SECRET`はリポジトリへ保存しません。`START_HERE.html`の生成ボタンで端末内だけで作れます。

## Google OAuthの最小設定

- Application type：**Web application**
- Authorized JavaScript origins：`https://publisher.ein-8.com`
- Sign in with GoogleのJavaScript callback方式なので、Authorized redirect URIは不要
- OAuthアプリがTestingの場合：Test usersへ `koube201@gmail.com` を追加
- 機密性の高いGoogle API権限は要求しません

## Custom Domain

デプロイ後、Cloudflare Dashboardで対象Workerを開き、次の2つをCustom Domainとして追加します。

- `publisher.ein-8.com`
- `docs.ein-8.com`

CloudflareがDNSレコードと証明書を作成します。既存の同名CNAMEがある場合は、先に競合を解消する必要があります。

## HTMLの作り方

ChatGPTには次のように指定します。

> CSSと必要な画像をすべて埋め込み、UTF-8の単一HTMLファイルとして作成してください。外部CDNは使わないでください。

日英切替などJavaScriptを使う資料は「インタラクティブモード」、通常の提案書は「静的資料モード」を選びます。

## 開発者向け確認

```bash
npm install
npm run check
npm run deploy
```

依存バージョンは`package.json`で固定しています。秘密情報を含む`.dev.vars`はGitへ追加しないでください。

## 既知の制約

- フォルダ一式やZIPではなく、単一HTMLのみ
- 初期保証上限は5MB
- インタラクティブモードは「任意の不特定HTMLを安全に実行するサービス」ではありません。管理者自身が作成・確認したHTMLだけを公開してください
- 外部リソースはCSPで遮断されるため、外部画像・外部フォント・CDNスクリプトは表示されません
- 現段階では全資料一括ZIPバックアップとQR画像生成は未実装
- 実際の無料枠・本番性能は利用量とCloudflareの制限に依存します

検証範囲は [`TEST_REPORT.md`](TEST_REPORT.md)、セキュリティ上の前提は [`SECURITY.md`](SECURITY.md) を参照してください。
