# WindowsローカルAIサーバー設定

Vercelは使用しません。Windows PCが、画面とAI APIの両方を同じURLで配信します。APIキーはPCの `local-ai-server/.env.local` にだけ保存され、GitHub Pagesやブラウザには入りません。

1. Node.js 22をインストールし、初回だけリポジトリのフォルダーで `npm install` を実行します。
2. `local-ai-server/.env.example` をコピーし、名前を `.env.local` にします。
3. `.env.local` の `OPENAI_API_KEY=` の右側へAPIキーを貼り付けます。必要なら `OPENAI_MODEL=` に画像入力対応モデル名を設定します（空欄時は `gpt-4.1-mini`）。
4. `local-ai-server/start-ai-server.bat` をダブルクリックします。
5. PCでは <http://localhost:8787>、同じWi-FiのiPhone/iPadでは、画面に表示された `http://PCのIPアドレス:8787` を開き、「AI接続を確認」を押します。

初回にWindows Firewallが確認を出した場合は、**プライベートネットワークのみ許可してください**。パブリックネットワークを許可したり、ルーターでポート8787をインターネットへ公開したりしないでください。

HTTPのLAN URLではブラウザの制約によりライブカメラが使えない場合があります。その場合も「映像を選択」から端末内の録画済み動画を選び、AI解析できます。

## 開発者向け

- `npm run local-ai`: ビルド済みの画面とAI APIを起動
- `npm run local-app`: 画面をビルドしてからAIサーバーを起動
- `GET /api/health`: キー設定済みなら `{"ok":true,"ai":"ready"}`、未設定なら `{"ok":false,"ai":"api-key-missing"}`
- `POST /api/analyze`: 最大14枚の時刻付きJPEGフレーム、チーム、解析視点、対象時間だけを受信

動画ファイル全体は送信しません。OpenAIへの通信はこのローカルサーバーだけが行い、APIキーをレスポンスやログへ出しません。
