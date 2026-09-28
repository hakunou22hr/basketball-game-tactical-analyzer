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

## AI VIDEO ANALYSIS

AI戦況解析はブラウザ内で動画から必要なJPEGフレームだけを抽出し、中継APIに送信します。動画ファイル全体は送信しません。

```bash
VITE_AI_ANALYSIS_ENDPOINT=https://your-secure-relay.example/analyze npm run dev
```

APIキーはフロントエンドに設定せず、中継API側で安全に管理してください。エンドポイント未設定時はAI解析を行わず、手動タグと簡易ルールアドバイスのみ動作します。

中継APIには、選択チーム・解析視点・解析範囲・時刻付きJPEGフレームと、出力JSONの指示を `POST application/json` で送ります。APIは指示どおりの解析JSONを直接返すほか、`analysis`、`output_text`、または OpenAI互換の `choices[0].message.content` にJSON文字列を格納して返すこともできます。映像から確認できない内容は推測せず、信頼度を `unknown` として返してください。
