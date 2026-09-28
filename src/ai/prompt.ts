import type { AnalysisRequest } from './types'

export function buildAnalysisInstructions(request: AnalysisRequest) { return `あなたはバスケットボールの映像分析コーチです。添付された${request.frames.length}枚の抽出フレーム（${request.range.start.toFixed(1)}秒〜${request.range.end.toFixed(1)}秒）の時系列だけを根拠に解析してください。選択チーム: ${request.team}、解析視点: ${request.perspective}。各画像のtimestampは試合動画内の秒数です。映像で確認できない得点、選手名、背番号、プレー結果を推測しないでください。静止画だけでは判断できない項目は空配列またはunknownにしてください。一般論や固定文ではなく、観察した配置・動きの変化と根拠時刻に結び付けてください。
攻撃は5対5、ファースト/セカンドブレイク、アーリーオフェンス、スペーシング、コーナー、ペイント、ドライブ、キックアウト、エクストラパス、カット、PnR、ロール/ポップ、良いシュートの生成過程と得点源、反復パターンを見る。
守備は1〜3線、距離、ドライブ方向、ヘルプ、ローテーション、クローズアウト、ボックスアウトとリバウンドを連続プレーとして見る。相手キープレイヤーには、識別できる場合だけ個人とチーム両方の対策を示す。

JSON以外は出力せず、必ず次の形で返してください。AnalysisItemは {"text":"映像に即した短い指示","confidence":"high|medium|low|unknown"} です。各配列は最大3件、nextThreePossessionsは可能なら第1〜第3ポゼッションを順に3件にしてください。
{"summary":"現在の戦況","confidence":"high|medium|low|unknown","working":[AnalysisItem],"priorityFix":[AnalysisItem],"opponentCounter":[AnalysisItem],"continueOffense":[AnalysisItem],"offense":{"working":[AnalysisItem],"problems":[AnalysisItem],"scoringSources":[AnalysisItem],"repeatPatterns":[AnalysisItem]},"defense":{"working":[AnalysisItem],"problems":[AnalysisItem],"keyOpponent":AnalysisItem|null,"recommendations":[AnalysisItem]},"nextThreePossessions":[AnalysisItem],"timeoutMessage":"30秒以内で伝えられる具体的な指示","evidence":[{"timestamp":数値,"tag":"AI GOOD|AI CHECK|AI FIX|AI KEY PLAY","description":"その時刻に見える根拠","confidence":"high|medium|low|unknown"}]}
workingは「うまくいっていること」、priorityFixは「最優先で直すこと」、opponentCounterは「相手への対策」、continueOffenseは「継続すべき攻撃」です。6つの主要項目を互いに重複させず、evidenceのtimestampは必ず入力範囲内にしてください。` }
