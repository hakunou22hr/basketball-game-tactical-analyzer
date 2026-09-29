# インストールできないWindows PCで使う方法

この方法では Node.js をインストールしません。

GitHub Actions が、Node.js の実行ファイルとアプリをまとめた
`Basketball-Tactical-Analyzer-Portable.zip`
を作成します。

## 使い方

1. GitHub の Actions から `Build Windows Portable Analyzer` の最新成功 run を開く
2. Artifacts の `Basketball-Tactical-Analyzer-Portable` をダウンロード
3. ZIP を右クリックして「すべて展開」
4. 展開したフォルダの `START-AI-SERVER.bat` をダブルクリック
5. 初回だけメモ帳が開くので、
   `OPENAI_API_KEY=`
   の右側に自分の OpenAI API キーを入力して保存
6. もう一度 `START-AI-SERVER.bat` をダブルクリック
7. 黒い画面を閉じずに、ブラウザで `http://localhost:8787` を開く
8. 保存済み動画を読み込み、「AI戦況解析」を実行

## 重要

- Node.js のインストールは不要です。
- APIキーはPC内の `local-ai-server/.env.local` にだけ保存します。
- `.env.local` はGitHubへアップロードしないでください。
- 職場PCのセキュリティポリシーで `node.exe` やバッチファイルの実行自体が禁止されている場合、この方法も利用できません。
- その場合はクラウド上の安全なバックエンドが必要です。
