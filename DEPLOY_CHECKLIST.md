# Deploy Checklist

## A. Google Cloud

- [ ] Google Cloud projectを作成または選択
- [ ] Google Auth PlatformのBrandingを設定
- [ ] OAuth Client typeをWeb applicationで作成
- [ ] Authorized JavaScript originsに `https://publisher.ein-8.com` を追加
- [ ] Testingの場合、Test usersへ `koube201@gmail.com` を追加
- [ ] Client IDを控える

## B. GitHub

- [ ] 新しい公開リポジトリを作成
- [ ] ZIPそのものではなく、展開したフォルダの中身をアップロード
- [ ] `.dev.vars`や秘密情報が入っていないことを確認
- [ ] リポジトリURLを控える

## C. Deploy to Cloudflare

- [ ] リポジトリURLをDeploy URLへ指定
- [ ] `ADMIN_EMAIL = koube201@gmail.com`
- [ ] `ADMIN_HOST = publisher.ein-8.com`
- [ ] `PUBLIC_HOST = docs.ein-8.com`
- [ ] `GOOGLE_CLIENT_ID`を入力
- [ ] `SESSION_SECRET`を入力
- [ ] Workerと2つのSQLite Durable Object namespaceが作成されたことを確認
- [ ] `/health`が `configured: true` を返すことを確認

## D. Custom Domain

- [ ] 対象Workerへ `publisher.ein-8.com` をCustom Domainとして追加
- [ ] 同じWorkerへ `docs.ein-8.com` をCustom Domainとして追加
- [ ] 両方のHTTPS証明書がActive

## E. 本番スモークテスト

- [ ] `koube201@gmail.com`でログインできる
- [ ] 別のGoogleアカウントが拒否される
- [ ] 100KB程度の静的HTMLを公開できる
- [ ] 固定URLをLINEで開ける
- [ ] 同じslugで更新してURLが変わらない
- [ ] 履歴から元の版へ戻せる
- [ ] 削除後に404となる
- [ ] 復元後に再び表示される
- [ ] iPadまたはスマートフォンからアップロードできる
