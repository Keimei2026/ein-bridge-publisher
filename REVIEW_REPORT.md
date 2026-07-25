# Ein Bridge Publisher — Release Candidate v3 Review

## 判定

**人間による本番Cloudflareデプロイ確認へ進める候補版。**

これは「本番完成」を意味しません。コードだけで検証可能な範囲を完了し、次の未検証項目がCloudflare本番アカウントでしか確認できないため、ここで人間の操作が必要になります。

## 今回の追加改善

1. 共有URL `/p/<slug>` は、現在の版固有URL `/p/<slug>/r/<revision>` へ302転送。
2. 版固有ページとHTML本体に `immutable` キャッシュを設定。
3. 過去版URLは、その版が履歴に残っている限り内容が変わらない。
4. 削除中の資料は、既知の版URLを含めて公開不可。
5. セッション秘密鍵の最小長判定を設定要件と同じ64文字へ統一。
6. 旧版の「設計と実装が一致しない」箇所を修正。

## 静的監査で確認した項目

- 管理・公開ホストの分離
- 管理者メールの固定
- Google ID tokenの署名、issuer、audience、authorized party、有効期限、メール確認
- HttpOnly / Secure / SameSite=Strict セッションCookie
- Origin + CSRF二重検証
- 5MB上限、128KB分割アップロード
- チャンク番号・容量・SHA-256検証
- 完了処理の冪等性
- 版ごとのtitle・mode・hash保存
- 直近10版、ロールバック、30日論理削除
- 静的モードのJavaScript禁止
- インタラクティブモードの外部通信禁止
- 公開HTMLと管理画面の別オリジン
- TypeScript全ファイルの構文解析

## 人間による次の確認が必要な項目

1. Cloudflare Git連携ビルドが成功すること
2. SQLite Durable Objectsのmigrationが本番で成功すること
3. Workerの `workers.dev` URLで `/health` が応答すること
4. Google OAuth Client IDを設定後、koube201@gmail.comのみログインできること
5. publisher.ein-8.com / docs.ein-8.com の証明書とルーティング
6. 1MB、3MB、5MBの実アップロード
7. iPadまたはスマホでのファイル選択と公開

## 現時点の評価

- 設計整合性: 19.4 / 20
- セキュリティ: 19.1 / 20
- データ整合性: 19.3 / 20
- 操作性: 14.1 / 15
- 復元性: 9.4 / 10
- 運用・保守性: 9.0 / 10
- 本番検証度: 4.0 / 5

**合計: 94.3 / 100（コード候補として）**

本番環境で上記7項目を通過した場合の到達見込みは **97点以上**。実環境未検証の段階で97点とは評価しません。
