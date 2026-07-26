# Security Notes — RC4

## 認証

- Google ID tokenの署名、issuer、audience、authorized party、期限、email_verifiedを検証
- `koube201@gmail.com`のみ許可
- セッションはHMAC-SHA-256署名、HttpOnly / Secure / SameSite=Strict Cookie
- 署名鍵はDurable Object内でランダム生成し、公開リポジトリへ保存しない

## CSRF

- 変更系APIはsame-origin Origin検証
- CSRF CookieとHeaderを照合
- ログイン後はセッション内CSRF値とも照合

## 公開HTML

- 静的モードはJavaScript禁止
- インタラクティブモードも外部通信禁止
- iframe sandboxで`allow-same-origin`を付与しない
- workers.dev同一ホスト運用でも、公開HTMLは不透明Originとなり管理Cookieへアクセスできない

## 運用

- 管理者自身が内容を確認したHTMLのみ公開する
- 外部CDN、外部画像、外部フォントはCSPにより遮断される
- CloudflareアカウントとGoogleアカウントには多要素認証を推奨
