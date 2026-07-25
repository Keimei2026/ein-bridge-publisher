# Security Notes

## 信頼境界

- 管理ホスト：`publisher.ein-8.com`
- 公開ホスト：`docs.ein-8.com`
- 管理Cookieは`__Host-`接頭辞、`Secure`、`HttpOnly`（セッション）、`SameSite=Strict`
- 公開HTMLには管理Cookieが送信されません
- WorkerはHost名で管理ルートと公開ルートを分離します

## 認証

Google Identity ServicesのIDトークンをWorker側で検証します。

- RS256署名
- Google issuer
- OAuth Client IDとのaudience一致
- authorized partyの確認
- 有効期限と発行時刻
- `email_verified=true`
- 許可メールアドレスとの一致
- 内部識別子にはGoogleの`sub`を使用

ログイン後はHMAC-SHA-256署名の8時間セッションを発行します。変更系APIは同一Originと二重送信CSRFトークンを検証します。

## 公開モード

### 静的資料モード

- iframe sandbox
- HTTP CSP sandbox
- JavaScript禁止
- fetch/XHR/WebSocket禁止
- フォーム送信禁止
- 外部画像、外部CSS、外部フォント禁止
- iframe/object/worker禁止

### インタラクティブモード

- iframe `sandbox="allow-scripts"`
- HTTP CSP `sandbox allow-scripts`
- インラインJavaScriptのみ許可
- `allow-same-origin`は付与しない
- fetch/XHR/WebSocket、フォーム、外部リソース、workerを禁止

ただし、ブラウザのsandboxは一般的なマルウェア解析環境ではありません。管理者自身が内容を確認したHTMLだけを公開してください。

## データ整合性

- 128KBチャンクごとにSHA-256を照合
- 全チャンクの存在・順序・合計容量を確認後、トランザクション内で公開版を切替
- 途中失敗時は現在の公開版を変更しない
- 1資料につき1つのDurable Objectを使用
- 更新版はHTML、表示名、公開モードを一緒に保存

## 残存リスク

- CloudflareおよびGoogleへのサービス依存
- 本番環境での大規模負荷試験は未実施
- 外部サービス側の仕様変更
- 管理者端末またはGoogleアカウント自体の侵害
- 管理者が意図的に危険なHTMLをインタラクティブモードで公開するケース

## 秘密情報

- `SESSION_SECRET`をGitHubへコミットしない
- `.dev.vars`をアップロードしない
- OAuth Client IDは秘密鍵ではありませんが、Authorized JavaScript originsを正しく限定する
- リポジトリ内にHTML資料そのものや個人情報を保存しない
