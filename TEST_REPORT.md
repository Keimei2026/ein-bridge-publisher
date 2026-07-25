# Test Report — Deploy Candidate v1

実施日：2026-07-20

## 合格した検査

### 静的検査

- TypeScript strict type check
- Wrangler 4.112.0 dry-run bundle
- Durable Object bindingsとSQLite migrationの構成確認
- ZIP対象から秘密ファイルを除外する検査

### Cloudflare Workersローカルランタイム統合試験

- 管理画面と管理用CSP
- HMAC署名セッションの受理
- CSRF不一致の拒否
- 静的HTML公開
- 静的モードのJavaScript禁止CSP
- HTTP CSP sandbox
- 128KBを超える複数チャンク公開
- インタラクティブモードのsandboxと通信禁止CSP
- 固定共有URL
- 更新後、旧公開コンテンツURLを404へ変更
- 更新履歴
- ロールバック時の表示名・公開モード・HTML復元
- 同一内容の重複版抑止
- 不正チャンクハッシュ拒否
- 未完了アップロード拒否
- 完了API再送時の冪等応答
- 論理削除と復元
- 5MB境界値の保存・取得
- 11版公開後に直近10版だけを保持
- 削除された最古版のダウンロード拒否

### Google IDトークン検証試験

テスト用RSA鍵とJWKを生成し、Workersランタイム内で以下を確認しました。

- 正しい署名・audience・メールのトークンを受理
- 不正audienceを拒否
- 許可外メールを拒否
- 期限切れを拒否
- 改ざん署名を拒否

## 未実施・本番で確認が必要な項目

- Deploy to Cloudflareの画面を使った実アカウントへの導入
- Cloudflareが行うGitHubリポジトリ複製・Workers Builds
- 実際のGoogle OAuth Client IDによるログイン
- `publisher.ein-8.com`と`docs.ein-8.com`のCustom Domain接続
- Windows/iPad/iPhone/Androidの実機試験
- LINE/WhatsAppアプリへの実共有
- 24時間アップロード清掃アラームの実時間経過試験
- 30日後完全削除の実時間経過試験
- Cloudflare Freeプラン上での負荷・CPU・日次上限試験
- 障害時のCloudflare側Point-in-Time Recovery運用

## 判定

ローカルWorkersランタイム上の主要機能は合格していますが、現時点の名称は**導入候補版**です。本番環境の未実施項目を確認後に正式版へ昇格します。
