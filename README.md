# Basketball Game Tactical Analyzer

試合映像を見ながら重要な瞬間を記録し、ルールベースのコーチング提案と試合後レビューを行う、オフライン対応の戦術解析PWAです。

## 開発

```bash
npm ci
npm run dev
```

テストは `npm run test`、本番ビルドは `npm run build` で実行します。

## 主な機能

- ローカルの試合動画と連動したタイムライン
- 7つの解析視点と3段階のプレー評価
- ルールベースの「今すぐ選手に伝える」提案
- IndexedDBへの端末内保存、デモモード、試合後レビュー
- HTML / PDF（印刷ダイアログ）/ JSON / CSVエクスポート
- Service Workerによるオフライン利用

GitHub Pages: <https://hakunou22hr.github.io/basketball-game-tactical-analyzer/>

## AI VIDEO ANALYSIS（Windowsローカル版）

Vercelは使用しません。`npm run local-app`（またはWindowsの `local-ai-server/start-ai-server.bat`）で、PCをAI解析サーバーにします。PCは <http://localhost:8787>、同じWi-FiのiPhone/iPadは起動画面に出るLAN用URLを開いてください。

APIキーは `local-ai-server/.env.local` にだけ保存します。GitHub Pages版は引き続き閲覧、動画読み込み、手動記録、簡易ルール分析に利用でき、AIサーバー未接続と表示します。ローカル版は同一オリジンの `/api/analyze` を自動使用し、動画全体ではなくブラウザが抽出したJPEGフレームだけを送ります。

初回設定は [LOCAL_AI_SETUP.md](LOCAL_AI_SETUP.md)、詳細は [AI_BACKEND_SETUP.md](AI_BACKEND_SETUP.md) を参照してください。Windows Firewallでは**プライベートネットワークのみ許可してください**。HTTPのLAN接続ではライブカメラが制限される場合がありますが、端末内の録画済み動画を選択するAI解析は利用できます。ポート8787をインターネットへ公開しないでください。
