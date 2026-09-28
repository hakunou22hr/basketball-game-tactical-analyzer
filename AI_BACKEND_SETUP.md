# AIバックエンド設定

現在のGitHub Pages版は静的サイトです。AI戦況解析を実行するには、OpenAI APIキーを安全に保持するサーバー側の中継APIが必要です。

このリポジトリには Vercel Functions 用の中継APIを含めています。

- `/api/analyze` : 抽出フレームを OpenAI Responses API に送り、AI GAME PLAN JSON を返す
- `/api/health` : APIキー設定の有無を確認する
- `vercel.json` : Vercelデプロイ設定

## 1. VercelにこのGitHubリポジトリをImport

Vercelで `hakunou22hr/basketball-game-tactical-analyzer` をImportしてデプロイします。

## 2. VercelのEnvironment Variables

必須:

- `OPENAI_API_KEY` : OpenAI APIキー

推奨:

- `OPENAI_MODEL=gpt-5.6`
- `ALLOWED_ORIGIN=https://hakunou22hr.github.io`

APIキーを `VITE_*` 変数やフロントエンドコードに入れないでください。

## 3. Vercel版で使う場合

Vercel上ではフロントエンドが同一オリジンの `/api/analyze` を自動利用します。
追加の `VITE_AI_ANALYSIS_ENDPOINT` は不要です。

## 4. GitHub Pages版から使う場合

GitHubリポジトリの Actions variable に次を設定します。

`VITE_AI_ANALYSIS_ENDPOINT=https://<あなたのVercelドメイン>/api/analyze`

設定後、GitHub Pagesを再ビルドしてください。

## 5. 接続確認

ブラウザで次を開きます。

`https://<あなたのVercelドメイン>/api/health`

`{"ok":true,...}` が返ればAIバックエンドは利用可能です。

その後アプリのAI戦況解析パネルで「AI接続」が未設定ではなくなり、
動画から抽出されたJPEGフレームを使って実際のAI解析が実行されます。

## プライバシー

動画ファイル全体はOpenAIへ送信しません。ブラウザが抽出したJPEGフレームだけを中継API経由で送信します。
