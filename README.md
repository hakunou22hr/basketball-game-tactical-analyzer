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

## LIVE CAMERA / 録画

`LIVE CAMERA・リアル撮影` は `getUserMedia()` で背面カメラを優先し、`MediaRecorder` でローカル録画します。AI解析ON時は5秒ごとに現在フレームを抽出し、4フレームずつ中継APIへ送信します。AI解析と録画は独立しており、AIの遅延やエラーで録画が停止することはありません。

録画停止後はブラウザ内のBlobを再生・詳細AI解析できます。保存時は対応ブラウザで `showSaveFilePicker()` を使用し、非対応環境では通常のブラウザダウンロードに切り替えます。
