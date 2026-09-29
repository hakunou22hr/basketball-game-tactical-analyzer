import type { Moment, Perspective } from './types'
import type { AiAnalysis, AnalysisItem, AnalysisRequest, Confidence, ExtractedFrame } from './ai/types'

export interface LocalFrameMetrics {
  measured: boolean
  motion: number
  lateralBalance: number
  centerShare: number
  complexity: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const item = (text: string, confidence: Confidence = 'low'): AnalysisItem => ({ text, confidence })

async function imagePixels(frame: ExtractedFrame): Promise<Uint8ClampedArray | null> {
  if (typeof document === 'undefined') return null
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = frame.image
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 48
    canvas.height = 27
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return context.getImageData(0, 0, canvas.width, canvas.height).data
  } catch {
    return null
  }
}

const grayscale = (rgba: Uint8ClampedArray) => {
  const values = new Float32Array(rgba.length / 4)
  for (let i = 0, p = 0; i < rgba.length; i += 4, p += 1) {
    values[p] = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114
  }
  return values
}

export async function measureLocalFrames(frames: ExtractedFrame[]): Promise<LocalFrameMetrics> {
  if (!frames.length) return { measured: false, motion: 0, lateralBalance: 0.5, centerShare: 0.34, complexity: 0 }
  const decoded: Float32Array[] = []
  for (const frame of frames.slice(0, 8)) {
    const pixels = await imagePixels(frame)
    if (pixels) decoded.push(grayscale(pixels))
  }
  if (!decoded.length) return { measured: false, motion: 0, lateralBalance: 0.5, centerShare: 0.34, complexity: 0 }

  const width = 48
  const height = 27
  let complexity = 0
  let complexityCount = 0
  for (const values of decoded) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 1; x < width; x += 1) {
        const idx = y * width + x
        complexity += Math.abs(values[idx] - values[idx - 1]) / 255
        complexityCount += 1
      }
    }
  }

  if (decoded.length === 1) {
    return {
      measured: true,
      motion: 0,
      lateralBalance: 0.5,
      centerShare: 0.34,
      complexity: clamp01(complexity / Math.max(1, complexityCount)),
    }
  }

  let totalDiff = 0
  let diffCount = 0
  const thirds = [0, 0, 0]
  for (let f = 1; f < decoded.length; f += 1) {
    const prev = decoded[f - 1]
    const next = decoded[f]
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x
        const diff = Math.abs(next[idx] - prev[idx]) / 255
        totalDiff += diff
        diffCount += 1
        thirds[Math.min(2, Math.floor((x / width) * 3))] += diff
      }
    }
  }
  const sectionTotal = thirds.reduce((sum, value) => sum + value, 0) || 1
  const shares = thirds.map(value => value / sectionTotal)
  const imbalance = Math.max(...shares) - Math.min(...shares)

  return {
    measured: true,
    motion: clamp01((totalDiff / Math.max(1, diffCount)) * 3.2),
    lateralBalance: clamp01(1 - imbalance * 1.8),
    centerShare: clamp01(shares[1]),
    complexity: clamp01(complexity / Math.max(1, complexityCount)),
  }
}

function selectMoments(moments: Moment[], request: AnalysisRequest) {
  const start = request.range.start - 0.5
  const end = request.range.end + 0.5
  const ranged = moments.filter(moment => moment.time >= start && moment.time <= end)
  return ranged.length ? ranged : moments.slice(-8)
}

function countNotes(moments: Moment[], words: string[]) {
  return moments.filter(moment => words.some(word => moment.note.includes(word))).length
}

function perspectivePriority(perspective: Perspective): string {
  switch (perspective) {
    case 'オフェンス': return '次の3ポゼッションは、コーナーと逆サイドの幅を保ち、ペイントタッチ後のキックアウトまでを1セットで意識する。'
    case 'ディフェンス': return '次の3ポゼッションは、1線で進路を限定し、2線・3線はヘルプ位置とローテーションを先に決める。'
    case 'ブレイク': return '次の3ポゼッションは、最初の3歩・両サイドレーン・中央のボール前進をそろえる。'
    case 'プレスダウン': return '次の3ポゼッションは、中央と逆サイドの受け手を確保し、ドリブルだけでなくパスでプレスを越える。'
    case 'リバウンド': return '次の3ポゼッションは、シュートと同時に相手へ先に身体を当て、確保後は最初のパスを速くする。'
    case 'トランジション': return '次の3ポゼッションは、攻守切替の最初の3歩をそろえ、最優先でボールとリングを守る。'
    default: return '次の3ポゼッションは、役割を1つに絞り、同じ基準で実行できたかを確認する。'
  }
}

function workingFromMetrics(metrics: LocalFrameMetrics, moments: Moment[]) {
  const working: AnalysisItem[] = []
  const good = moments.filter(moment => moment.rating === 'GOOD PLAY' || moment.rating === 'AI GOOD').length
  if (good) working.push(item(`GOOD記録が${good}件ある。成功した配置や判断を同じ形で再現する。`, 'medium'))
  if (metrics.measured && metrics.lateralBalance >= 0.63) working.push(item('映像変化が左右に比較的分散している。横幅を使う動きを継続する価値がある。', 'low'))
  if (metrics.measured && metrics.motion >= 0.42) working.push(item('映像内の動き量は大きめ。テンポを落とさず、次の判断を早くする。', 'low'))
  if (!working.length) working.push(item('良いプレーを手動で1〜2場面記録すると、端末内解析でも継続点を絞り込みやすくなる。', 'unknown'))
  return working.slice(0, 3)
}

function fixesFromMetrics(metrics: LocalFrameMetrics, moments: Moment[], perspective: Perspective) {
  const fixes: AnalysisItem[] = []
  const fix = moments.filter(moment => moment.rating === 'FIX' || moment.rating === 'AI FIX').length
  const check = moments.filter(moment => moment.rating === 'CHECK' || moment.rating === 'AI CHECK').length
  if (fix + check) fixes.push(item(`CHECK/FIX記録が${fix + check}件ある。次のポゼッションは修正点を1つだけ選んで実行する。`, 'medium'))
  if (metrics.measured && metrics.lateralBalance < 0.45) fixes.push(item('映像変化が一方向に偏っている。逆サイドの幅・ボール移動・カットの有無を確認する。', 'low'))
  if (metrics.measured && metrics.centerShare > 0.48) fixes.push(item('中央付近に動きが集まる傾向がある。密集していないか、コーナーとウイングの間隔を確認する。', 'low'))
  if (!fixes.length) fixes.push(item(perspectivePriority(perspective), 'low'))
  return fixes.slice(0, 3)
}

function scoringSources(moments: Moment[]): AnalysisItem[] {
  const sources: AnalysisItem[] = []
  const drive = countNotes(moments, ['ドライブ', 'ペイント', 'レイアップ'])
  const outside = countNotes(moments, ['3P', 'スリー', 'アウトサイド', 'オープン'])
  const second = countNotes(moments, ['リバウンド', 'セカンド', '2nd'])
  if (drive) sources.push(item(`手動記録ではペイント／ドライブ系の記述が${drive}件ある。`, 'medium'))
  if (outside) sources.push(item(`手動記録ではアウトサイド系の記述が${outside}件ある。`, 'medium'))
  if (second) sources.push(item(`手動記録ではセカンドショット／リバウンド系の記述が${second}件ある。`, 'medium'))
  return sources.length ? sources.slice(0, 3) : [item('得点源の特定には、得点場面をGOOD PLAYとして記録すると精度が上がる。', 'unknown')]
}

export function buildLocalAnalysis(request: AnalysisRequest, moments: Moment[], metrics: LocalFrameMetrics): AiAnalysis {
  const relevant = selectMoments(moments, request)
  const good = relevant.filter(moment => moment.rating === 'GOOD PLAY' || moment.rating === 'AI GOOD').length
  const check = relevant.filter(moment => moment.rating === 'CHECK' || moment.rating === 'AI CHECK' || moment.rating === 'AI KEY PLAY').length
  const fix = relevant.filter(moment => moment.rating === 'FIX' || moment.rating === 'AI FIX').length
  const confidence: Confidence = relevant.length >= 4 && metrics.measured ? 'medium' : relevant.length || metrics.measured ? 'low' : 'unknown'

  const motionText = !metrics.measured
    ? '映像の画素解析は利用できなかったため、手動記録中心で判定している。'
    : metrics.motion >= 0.45
      ? '映像変化は大きめで、テンポの高い局面とみられる。'
      : metrics.motion <= 0.18
        ? '映像変化は小さめで、ハーフコートの停滞や静的な局面の可能性がある。'
        : '映像変化は中程度で、極端なテンポ変化は検出していない。'

  const working = workingFromMetrics(metrics, relevant)
  const priorityFix = fixesFromMetrics(metrics, relevant, request.perspective)
  const scores = scoringSources(relevant)

  const evidence = relevant.slice(-6).map(moment => ({
    timestamp: moment.time,
    tag: moment.rating === 'GOOD PLAY' || moment.rating === 'AI GOOD'
      ? 'AI GOOD' as const
      : moment.rating === 'FIX' || moment.rating === 'AI FIX'
        ? 'AI FIX' as const
        : 'AI CHECK' as const,
    description: `手動記録: ${moment.perspective}・${moment.note}`,
    confidence: 'medium' as Confidence,
  }))

  const offenseProblems: AnalysisItem[] = []
  if (metrics.measured && metrics.lateralBalance < 0.45) offenseProblems.push(item('左右の動きが偏る傾向。逆サイドの幅とボール移動を確認する。', 'low'))
  if (check + fix > good) offenseProblems.push(item('CHECK/FIXがGOODを上回っている。1回の攻撃で直すポイントを1つに絞る。', 'medium'))
  if (!offenseProblems.length) offenseProblems.push(item('具体的なシュート選択や選手識別は、APIキー不要モードでは断定しない。', 'unknown'))

  const defenseProblems: AnalysisItem[] = []
  if (countNotes(relevant, ['抜かれ', 'ヘルプ', 'ローテーション'])) defenseProblems.push(item('手動記録にヘルプ／ローテーション関連の課題がある。1線が抜かれた後の2線・3線の役割を固定する。', 'medium'))
  if (countNotes(relevant, ['ボックスアウト', 'リバウンド'])) defenseProblems.push(item('リバウンド関連の記録がある。ボールを見る前のヒットを優先する。', 'medium'))
  if (!defenseProblems.length) defenseProblems.push(item('相手の危険選手は端末内簡易解析では特定しない。背番号・得点源は手動記録で補足する。', 'unknown'))

  const continueOffense = [
    ...scores.filter(entry => entry.confidence !== 'unknown'),
    item('成功場面は「どこから崩したか → 誰が合わせたか → どこが空いたか」の順で再現する。', 'low'),
  ].slice(0, 3)

  const nextThreePossessions = [
    item(perspectivePriority(request.perspective), 'medium'),
    item('攻撃後または守備後の最初の3歩を全員でそろえる。', 'low'),
    item('1ポゼッションごとにGOOD / CHECK / FIXを1つ記録し、次の指示に反映する。', 'medium'),
  ]

  return {
    summary: `${request.team}チーム・${request.perspective}を端末内で簡易解析。GOOD ${good}件、CHECK ${check}件、FIX ${fix}件。 ${motionText}`,
    confidence,
    working,
    priorityFix,
    opponentCounter: [
      item('相手キープレイヤーの自動特定は行わない。背番号が読めた場面だけ手動で記録し、得意方向・3P・ドライブを整理する。', 'unknown'),
      item('守備は「ボールをどこへ行かせないか」を先に決め、ヘルプとローテーションをチームで共有する。', 'low'),
    ],
    continueOffense,
    offense: {
      working,
      problems: offenseProblems,
      scoringSources: scores,
      repeatPatterns: continueOffense,
    },
    defense: {
      working: relevant.filter(moment => moment.perspective === 'ディフェンス' && (moment.rating === 'GOOD PLAY' || moment.rating === 'AI GOOD')).length
        ? [item('ディフェンスのGOOD記録がある。成功した距離・角度・ヘルプ位置を再現する。', 'medium')]
        : [item('守備のGOOD場面を記録すると、端末内解析でも再現ポイントを絞れる。', 'unknown')],
      problems: defenseProblems,
      keyOpponent: null,
      recommendations: [
        item('1線は進路を限定、2線はヘルプ、3線はリングと裏を守る役割を確認する。', 'low'),
        item('シュートが上がった瞬間に相手へ先に身体を当て、ボックスアウトを完了させる。', 'low'),
      ],
    },
    nextThreePossessions,
    timeoutMessage: `次の3本は、${request.perspective}の役割を1つに絞ろう。成功した形はもう一度使う。CHECK/FIXは一度に全部直さず最優先の1点だけ。攻守の切り替えは最初の3歩、リバウンドは先に身体を当てる。次の3本で同じ基準をやり切ろう。`,
    evidence,
  }
}

export async function analyzeWithoutApi(request: AnalysisRequest, moments: Moment[]): Promise<AiAnalysis> {
  const metrics = await measureLocalFrames(request.frames)
  return buildLocalAnalysis(request, moments, metrics)
}
