import type { Moment, Perspective, Rating } from './types'

const advice: Record<Perspective, Record<Rating, string>> = {
  '全体': { 'GOOD PLAY': '良い判断を続けよう。全員で同じ景色を見られている。', CHECK: 'スペーシングと声かけをもう一度確認しよう。', FIX: '次のポゼッションは役割を一つに絞って実行しよう。' },
  'オフェンス': { 'GOOD PLAY': 'ペイントアタックから生まれたズレを継続しよう。', CHECK: 'ボールサイドに寄りすぎていないか確認しよう。', FIX: 'コーナーを埋め、0.5秒で判断しよう。' },
  'ディフェンス': { 'GOOD PLAY': 'ヘルプとローテーションの連動ができている。', CHECK: 'ボールマンへの角度と距離を確認しよう。', FIX: 'まずペイントを守り、次にキックアウトへ出よう。' },
  'ブレイク': { 'GOOD PLAY': '両サイドを走り、中央のレーンを空けられている。', CHECK: '最初の3歩とアウトレットの位置を確認しよう。', FIX: 'リム・両ウイング・トレーラーの4レーンを作ろう。' },
  'プレスダウン': { 'GOOD PLAY': '逆サイドを見て数的優位を作れている。', CHECK: 'インバウンド後の戻しの選択肢を確認しよう。', FIX: '中央を空けず、パスでプレスを越えよう。' },
  'リバウンド': { 'GOOD PLAY': 'ヒット・ターン・ゲットの順序が良い。', CHECK: 'シュート時に相手を見失っていないか確認しよう。', FIX: 'ボールを見る前に、まず相手へコンタクトしよう。' },
  'トランジション': { 'GOOD PLAY': '攻守の切り替えが速く、先に配置できている。', CHECK: 'ショット後のセーフティを確認しよう。', FIX: '最初の3歩を全力で戻り、ボールを止めよう。' }
}

export const coachingAdvice = (perspective: Perspective, rating: Rating) => advice[perspective][rating]
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
export const summarize = (moments: Moment[]) => ({
  good: moments.filter(m => m.rating === 'GOOD PLAY' || m.rating === 'AI GOOD').length,
  check: moments.filter(m => m.rating === 'CHECK' || m.rating === 'AI CHECK' || m.rating === 'AI KEY PLAY').length,
  fix: moments.filter(m => m.rating === 'FIX' || m.rating === 'AI FIX').length
})
