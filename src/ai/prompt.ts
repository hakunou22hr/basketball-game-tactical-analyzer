import type { AnalysisRequest } from './types'
export function buildAnalysisInstructions(request: AnalysisRequest) { return `バスケットボール試合の抽出フレームのみを根拠に解析する。選択チーム: ${request.team}、解析視点: ${request.perspective}。映像で確認できない事実や背番号を推測しない。判断の信頼度は high/medium/low/unknown で返す。
攻撃は5対5、ファースト/セカンドブレイク、アーリーオフェンス、スペーシング、コーナー、ペイント、ドライブ、キックアウト、エクストラパス、カット、PnR、ロール/ポップ、良いシュートの生成過程と得点源、反復パターンを見る。
守備は1〜3線、距離、ドライブ方向、ヘルプ、ローテーション、クローズアウト、ボックスアウトとリバウンドを連続プレーとして見る。相手キープレイヤーには個人とチーム両方の対策を示す。指示は各項目最大3件。根拠時刻をevidenceに含め、指定JSON形式で返す。` }
