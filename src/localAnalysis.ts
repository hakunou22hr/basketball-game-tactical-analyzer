import type { Moment, Perspective } from './types'
import type { AiAnalysis, AnalysisItem, AnalysisRequest, CompetitionLevel, Confidence, ExtractedFrame } from './ai/types'

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

function matchingNotes(moments: Moment[], words: string[]) {
  return moments.filter(moment => words.some(word => moment.note.includes(word)))
}

function levelPriority(level: CompetitionLevel, perspective: Perspective): string {
  if (level === '小学生') {
    switch (perspective) {
      case 'オフェンス': return '次の3回は、ボールの近くに集まりすぎず、左右に広がってゴールを見てからプレーしよう。'
      case 'ディフェンス': return '次の3回は、自分の相手とボールの両方が見える場所に立ち、抜かれた仲間を1歩助けよう。'
      case 'ブレイク': return '次の3回は、ボールを持ったら前を見る。両サイドの人はコートを広く走ろう。'
      case 'リバウンド': return 'シュートが上がったら、先に相手の前に入り、ボールを両手で取りにいこう。'
      default: return '次の3回は「広がる・戻る・声を出す」のうち1つを全員でそろえよう。'
    }
  }
  if (level === '中学生') {
    switch (perspective) {
      case 'オフェンス': return '次の3ポゼッションは、5人の間隔を取り、ドライブに対してコーナー・45度・合わせの役割をはっきりさせる。'
      case 'ディフェンス': return '次の3ポゼッションは、1線で進路を限定し、2線はヘルプ、3線はリングと裏を守る。'
      case 'ブレイク': return '次の3ポゼッションは、両サイドを走り、中央でボールを前進させ、止まったらすぐ5対5へ移る。'
      case 'プレスダウン': return '次の3ポゼッションは、中央と逆サイドの受け手を作り、ドリブルだけでなくパスでプレスを越える。'
      default: return '次の3ポゼッションは、役割を1つに絞り、全員が同じ約束で動く。'
    }
  }
  if (level === '高校生') {
    switch (perspective) {
      case 'オフェンス': return '次の3ポゼッションは、ペイントタッチを作り、ヘルプを動かしてからキックアウト・エクストラパスまでつなげる。'
      case 'ディフェンス': return '次の3ポゼッションは、ボールマンの進路を限定し、ヘルプ→ローテーション→クローズアウトまでをセットで実行する。'
      case 'ブレイク': return '次の3ポゼッションは、ファーストブレイクが止まったらセカンドブレイクへ移り、守備が整う前に優位を作る。'
      case 'リバウンド': return 'シュート時にヒット→ボール確保→アウトレットまでを一連で速くする。'
      default: return '次の3ポゼッションは、最優先の修正を1つに絞り、同じ基準で再現する。'
    }
  }
  if (level === '大学') {
    switch (perspective) {
      case 'オフェンス': return '次の3ポゼッションは、ペイントタッチと0.5秒判断を基準に、ヘルプの位置を見てキックアウト・リロケート・エクストラへつなぐ。'
      case 'ディフェンス': return '次の3ポゼッションは、スカウティング通りの方向付けとカバレッジを徹底し、ローテーション後の最終クローズアウトまで完結させる。'
      case 'ブレイク': return '次の3ポゼッションは、数的優位がなければアーリーへ移行し、ミスマッチとドラッグスクリーンを早く使う。'
      default: return '次の3ポゼッションは、狙うアドバンテージと守る優先順位を明確にして実行する。'
    }
  }
  switch (perspective) {
    case 'オフェンス': return '次の3ポゼッションは、得点期待の高い形を優先し、ペイントタッチ後のアウトサイド展開とセカンドチャンスを狙う。'
    case 'ディフェンス': return '次の3ポゼッションは、相手の得意エリアと得意方向を消し、ヘルプとローテーションの約束を徹底する。'
    case 'ブレイク': return '次の3ポゼッションは、走れる局面は速く、数的優位がなければ無理をせず早い段階でセットへ入る。'
    default: return '次の3ポゼッションは、現在のメンバーで最も再現性の高い形を優先する。'
  }
}

function workingFromMetrics(metrics: LocalFrameMetrics, moments: Moment[], level: CompetitionLevel) {
  const working: AnalysisItem[] = []
  const good = moments.filter(moment => moment.rating === 'GOOD PLAY' || moment.rating === 'AI GOOD').length
  if (good) working.push(item(`GOOD記録が${good}件。成功した場面の「位置・タイミング・次の動き」を同じ形で再現する。`, 'medium'))
  if (metrics.measured && metrics.lateralBalance >= 0.63) {
    working.push(item(level === '小学生' ? '左右に広く動けている。ボールの近くに集まりすぎず、この広がりを続けよう。' : '左右への動きが比較的分散している。コート幅を使えている可能性があるので継続する。', 'low'))
  }
  if (metrics.measured && metrics.motion >= 0.42) {
    working.push(item(level === '小学生' ? '全体の動きは活発。走る・戻るの勢いを続けよう。' : '映像全体の動き量は大きめ。テンポを維持しつつ、急ぎすぎて判断が雑にならないか確認する。', 'low'))
  }
  if (!working.length) working.push(item('GOOD PLAYを1〜2場面記録すると、「何を続けるべきか」を具体化できる。', 'unknown'))
  return working.slice(0, 3)
}

function weakFromMetrics(metrics: LocalFrameMetrics, moments: Moment[], level: CompetitionLevel) {
  const weak: AnalysisItem[] = []
  const fix = moments.filter(moment => moment.rating === 'FIX' || moment.rating === 'AI FIX').length
  const check = moments.filter(moment => moment.rating === 'CHECK' || moment.rating === 'AI CHECK').length
  if (fix + check) weak.push(item(`CHECK/FIXが${fix + check}件。記録した場面の中に、繰り返し起きている課題がないか確認する。`, 'medium'))
  if (metrics.measured && metrics.lateralBalance < 0.45) weak.push(item(level === '小学生' ? '動きが片側に集まりやすい。反対側に1人広がれるか確認しよう。' : '動きが一方向に偏る傾向。逆サイドの幅、ボール移動、カットの有無を確認する。', 'low'))
  if (metrics.measured && metrics.centerShare > 0.48) weak.push(item(level === '小学生' ? '真ん中に人が集まりやすい。ゴールのまわりを空けて、外にも広がろう。' : '中央付近に動きが集まる傾向。ペイント付近の密集と外周の間隔を確認する。', 'low'))
  if (!weak.length) weak.push(item('映像だけでは明確な失敗を断定しない。CHECK/FIXで気になる場面を記録すると具体化できる。', 'unknown'))
  return weak.slice(0, 3)
}

function technicalAdvice(level: CompetitionLevel, perspective: Perspective, metrics: LocalFrameMetrics, moments: Moment[]) {
  const result: AnalysisItem[] = []
  if (level === '小学生') {
    result.push(item('パスを受ける前にゴールを見る。キャッチしたら「シュート・ドライブ・パス」をすぐ選ぶ。', 'low'))
    result.push(item('ディフェンスは腰を落とし、足を交差しすぎず、相手とゴールの間に入る。', 'low'))
  } else if (level === '中学生') {
    result.push(item('オフェンスは5人の間隔を保ち、ドライブ時はコーナー・45度・ダイブの合わせを整理する。', 'low'))
    result.push(item('守備は1線・2線・3線の位置を確認し、シュート時は全員がボックスアウトする。', 'low'))
  } else if (level === '高校生') {
    result.push(item('ペイントタッチ後の0.5秒判断を速くし、キックアウト後は止まらずリロケートまたはエクストラパスへつなぐ。', 'low'))
    result.push(item('守備はヘルプ位置だけでなく、ローテーション後のクローズアウト角度まで揃える。', 'low'))
  } else if (level === '大学') {
    result.push(item('PnR・ドライブに対する守備のカバレッジを統一し、相手のショットプロファイルに合わせて守る場所を絞る。', 'low'))
    result.push(item('攻撃はミスマッチ、ドラッグ、リピック、エクストラまで含めてアドバンテージを継続する。', 'low'))
  } else {
    result.push(item('現在のメンバー構成に合わせ、無理な1対1より再現性の高いセットと得意スポットを優先する。', 'low'))
    result.push(item('守備は相手の得意方向・得意エリアを限定し、リバウンド確保までを1回の守備として完結する。', 'low'))
  }
  if (perspective === 'リバウンド' || countNotes(moments, ['リバウンド', 'ボックスアウト'])) {
    result.unshift(item(level === '小学生' ? 'シュートが上がったら「相手を見つける→前に入る→両手で取る」の順で動く。' : 'シュート時は「ヒット→ターン→確保」を先に行い、ボールだけを追わない。', 'medium'))
  }
  if (metrics.measured && metrics.motion <= 0.18) {
    result.push(item('全体の動きが小さい時間帯。ボールを持っていない選手のカット・スクリーン・リロケートが止まっていないか確認する。', 'low'))
  }
  return result.slice(0, 3)
}

function mentalAdvice(level: CompetitionLevel, good: number, check: number, fix: number) {
  const totalProblems = check + fix
  if (level === '小学生') {
    return [
      item(good ? '良かったプレーをまず1つ伝え、そのあとに「次はこれを1つやろう」と短く伝える。' : '結果ではなく「走った・戻った・声を出した」など行動をほめる。', 'medium'),
      item('ミスの直後は責めず、「次の1本」に集中させる。', 'low'),
    ]
  }
  if (level === '中学生') {
    return [
      item(totalProblems > good ? '修正点を2つ以上同時に言わず、次の3ポゼッションで意識する1点だけに絞る。' : '良い流れを言語化し、同じ約束を続ける。', 'medium'),
      item('ターンオーバーや失点の直後ほど、声とトランジションを最優先にする。', 'low'),
    ]
  }
  if (level === '高校生') {
    return [
      item('感情ではなく「次の3ポゼッションで何を実行するか」に集中させる。', 'low'),
      item(totalProblems > good ? '連続ミス時はプレーコールを簡単にし、成功しやすい形を1本作ってリズムを戻す。' : '成功している形の再現を優先し、無理に新しいことを増やさない。', 'medium'),
    ]
  }
  return [
    item('タイムアウトでは原因説明を長くせず、次の2〜3ポゼッションの具体的な行動だけを共有する。', 'low'),
    item('流れが悪いときは、守備・リバウンド・ペイントタッチなど結果以外の達成基準を1つ設定する。', 'low'),
  ]
}

function extractPlayerNumbers(notes: Moment[], opponentOnly = false) {
  const numbers = new Set<string>()
  for (const moment of notes) {
    const text = moment.note
    if (opponentOnly && !/(相手|マーク|止め|抑え|要注意|得点源)/.test(text)) continue
    const matches = text.matchAll(/(?:#|背番号)?\s*(\d{1,2})\s*番/g)
    for (const match of matches) numbers.add(match[1])
  }
  return [...numbers].slice(0, 3)
}

function substitutionAdvice(level: CompetitionLevel, metrics: LocalFrameMetrics, moments: Moment[]) {
  const fatigueNotes = matchingNotes(moments, ['疲れ', '疲労', '足が止', '戻りが遅', '動けていない', '反応が遅', '集中が切', '息が上'])
  const playerNumbers = extractPlayerNumbers(fatigueNotes)
  const result: AnalysisItem[] = []
  if (playerNumbers.length) {
    result.push(item(`${playerNumbers.map(n => `${n}番`).join('・')}について疲労や動き低下の記録あり。1〜2ポゼッション休ませる、または役割を簡単にして回復を確認する候補。`, 'medium'))
  } else if (fatigueNotes.length) {
    result.push(item('疲労・戻りの遅れ・反応低下に関する記録あり。該当選手を短時間交代し、守備の戻りと声が戻るか確認する。', 'medium'))
  }
  if (metrics.measured && metrics.motion <= 0.16) {
    result.push(item('映像全体の動きが小さい。個人の疲労とは断定せず、「戻り・オフボールの動き・ボックスアウト」が落ちた選手がいないかベンチから確認する。', 'low'))
  }
  if (!result.length) {
    result.push(item(level === '小学生'
      ? '交代は「疲れた選手」だけでなく、守備で戻れない・声が出ない・役割が分からなくなった選手を一度休ませる目安にする。'
      : '交代候補は、①トランジションの戻り低下 ②連続した判断ミス ③ボックスアウト・声の低下 ④現在の組み合わせで役割が合っていない、の順で確認する。', 'unknown'))
  }
  result.push(item('APIキー不要モードでは個人の疲労や体力を自動判定しない。交代判断は映像とコーチの観察を合わせて行う。', 'unknown'))
  return result.slice(0, 3)
}

function opponentAdvice(level: CompetitionLevel, moments: Moment[]) {
  const numbers = extractPlayerNumbers(moments, true)
  const result: AnalysisItem[] = []
  for (const number of numbers) {
    const related = moments.filter(moment => moment.note.includes(`${number}番`))
    const noteText = related.map(moment => moment.note).join(' ')
    const traits: string[] = []
    if (/(3P|スリー|外|シューター)/.test(noteText)) traits.push('3Pを簡単に打たせない')
    if (/(ドライブ|抜く|1対1)/.test(noteText)) traits.push('得意方向のドライブを切る')
    if (/(リバウンド|セカンド)/.test(noteText)) traits.push('シュート時に必ず先に身体を当てる')
    result.push(item(`相手${number}番を要注意候補として記録済み。${traits.length ? traits.join('・') : '得点した場所と得意なプレーを次の2〜3回で確認する'}。`, 'medium'))
  }
  if (!result.length) {
    result.push(item(level === '小学生'
      ? '止めたい相手がいるときは背番号をメモし、「ドライブが得意」「外のシュートが得意」のどちらかをまず確認する。'
      : '抑えるべき相手は自動で断定しない。背番号と「3P・ドライブ・ポスト・リバウンド」のどれで得点しているかをCHECKで記録する。', 'unknown'))
  }
  result.push(item(level === '大学' || level === '一般'
    ? '要注意選手には、得意方向・得意エリア・PnR時の選択を絞り、誰がヘルプに出るかまで決める。'
    : '要注意選手だけを見すぎず、ヘルプに出た後のローテーションとリバウンドまでチームで守る。', 'low'))
  return result.slice(0, 3)
}

function scoringSources(moments: Moment[]): AnalysisItem[] {
  const sources: AnalysisItem[] = []
  const drive = countNotes(moments, ['ドライブ', 'ペイント', 'レイアップ'])
  const outside = countNotes(moments, ['3P', 'スリー', 'アウトサイド', 'オープン'])
  const second = countNotes(moments, ['リバウンド', 'セカンド', '2nd'])
  if (drive) sources.push(item(`記録ではペイント／ドライブ系の場面が${drive}件。`, 'medium'))
  if (outside) sources.push(item(`記録ではアウトサイド系の場面が${outside}件。`, 'medium'))
  if (second) sources.push(item(`記録ではセカンドショット／リバウンド系の場面が${second}件。`, 'medium'))
  return sources.length ? sources.slice(0, 3) : [item('得点源を具体化するには、得点場面をGOOD PLAYとして記録する。', 'unknown')]
}

function timeoutMessage(level: CompetitionLevel, perspective: Perspective, good: number, check: number, fix: number) {
  if (level === '小学生') {
    return `次の3回だけそろえよう。まず広がる。相手に取られたらすぐ戻る。シュートが上がったら相手の前に入ってリバウンド。良かったプレーはもう一度やろう。ミスしても次の1本に集中しよう。`
  }
  if (level === '中学生') {
    return `次の3ポゼッションは${perspective}の約束を1つに絞る。オフェンスは間隔、ディフェンスはヘルプ位置、シュートが上がったら全員ボックスアウト。GOODはもう一度再現、CHECK/FIXは最優先の1点だけ直そう。`
  }
  if (level === '高校生') {
    return `次の3ポゼッション、最優先は${perspective}。成功した形は再現する。攻撃はペイントタッチから次のパスまで、守備はヘルプからクローズアウト、最後はリバウンド。GOOD ${good}件、CHECK/FIX ${check + fix}件。修正は1つに絞ってやり切ろう。`
  }
  return `次の3ポゼッションは、狙うアドバンテージと守る優先順位を1つずつ明確にする。成功形は再現、修正は最優先の1点だけ。守備はリバウンドまで完結し、攻撃は良いショットで終える。`
}

export function buildLocalAnalysis(
  request: AnalysisRequest,
  moments: Moment[],
  metrics: LocalFrameMetrics,
  level: CompetitionLevel = '高校生',
): AiAnalysis {
  const relevant = selectMoments(moments, request)
  const good = relevant.filter(moment => moment.rating === 'GOOD PLAY' || moment.rating === 'AI GOOD').length
  const check = relevant.filter(moment => moment.rating === 'CHECK' || moment.rating === 'AI CHECK' || moment.rating === 'AI KEY PLAY').length
  const fix = relevant.filter(moment => moment.rating === 'FIX' || moment.rating === 'AI FIX').length
  const confidence: Confidence = relevant.length >= 4 && metrics.measured ? 'medium' : relevant.length || metrics.measured ? 'low' : 'unknown'

  const motionText = !metrics.measured
    ? '映像特徴を十分に測定できなかったため、手動記録を中心に判定。'
    : metrics.motion >= 0.45
      ? '映像全体の動きは大きめ。'
      : metrics.motion <= 0.18
        ? '映像全体の動きは小さめ。'
        : '映像全体の動きは中程度。'

  const working = workingFromMetrics(metrics, relevant, level)
  const weakPlay = weakFromMetrics(metrics, relevant, level)
  const priorityFix = [item(levelPriority(level, request.perspective), 'medium'), ...weakPlay.filter(x => x.confidence !== 'unknown')].slice(0, 3)
  const scores = scoringSources(relevant)
  const technical = technicalAdvice(level, request.perspective, metrics, relevant)
  const mental = mentalAdvice(level, good, check, fix)
  const substitution = substitutionAdvice(level, metrics, relevant)
  const opponentPlayer = opponentAdvice(level, relevant)

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

  const offenseProblems = weakPlay
  const defenseProblems = relevant.some(moment => moment.perspective === 'ディフェンス')
    ? weakPlay
    : [item('守備のCHECK/FIXを記録すると、ヘルプ・ローテーション・リバウンドの課題を具体化できる。', 'unknown')]

  const continueOffense = [
    ...scores.filter(entry => entry.confidence !== 'unknown'),
    item(level === '小学生'
      ? 'うまくいったときの「どこに広がっていたか」「誰が走ったか」をもう一度まねする。'
      : '成功場面は「どこで優位を作ったか → 誰が合わせたか → 最後にどこが空いたか」の順で再現する。', 'low'),
  ].slice(0, 3)

  const nextThreePossessions = [
    item(levelPriority(level, request.perspective), 'medium'),
    item(level === '小学生' ? '失敗してもすぐ戻る。シュートが上がったら全員リバウンドへ。' : '攻守切替の最初の3歩をそろえ、守備はリバウンドまで終える。', 'low'),
    item('1ポゼッションごとにGOOD / CHECK / FIXを1つ記録し、次の指示に反映する。', 'medium'),
  ]

  return {
    summary: `${level}・${request.team}チーム・${request.perspective}を端末内解析。GOOD ${good}件、CHECK ${check}件、FIX ${fix}件。 ${motionText}`,
    confidence,
    working,
    priorityFix,
    opponentCounter: opponentPlayer,
    continueOffense,
    offense: {
      working,
      problems: offenseProblems,
      scoringSources: scores,
      repeatPatterns: continueOffense,
    },
    defense: {
      working: relevant.filter(moment => moment.perspective === 'ディフェンス' && (moment.rating === 'GOOD PLAY' || moment.rating === 'AI GOOD')).length
        ? [item('ディフェンスのGOOD記録あり。成功した距離・角度・ヘルプ位置を再現する。', 'medium')]
        : [item('守備のGOOD場面を記録すると、再現ポイントを絞れる。', 'unknown')],
      problems: defenseProblems,
      keyOpponent: opponentPlayer.find(x => x.confidence === 'medium') ?? null,
      recommendations: technical,
    },
    nextThreePossessions,
    timeoutMessage: timeoutMessage(level, request.perspective, good, check, fix),
    evidence,
    coaching: {
      level,
      goodPlay: working,
      weakPlay,
      correction: priorityFix,
      technical,
      mental,
      substitution,
      opponentPlayer,
    },
  }
}

export async function analyzeWithoutApi(
  request: AnalysisRequest,
  moments: Moment[],
  level: CompetitionLevel = '高校生',
): Promise<AiAnalysis> {
  const metrics = await measureLocalFrames(request.frames)
  return buildLocalAnalysis(request, moments, metrics, level)
}
