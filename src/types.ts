export type Perspective = '全体' | 'オフェンス' | 'ディフェンス' | 'ブレイク' | 'プレスダウン' | 'リバウンド' | 'トランジション'
export type Rating = 'GOOD PLAY' | 'CHECK' | 'FIX'
export type AiTag = 'AI GOOD' | 'AI CHECK' | 'AI FIX' | 'AI KEY PLAY'
export interface Moment { id: string; time: number; perspective: Perspective; rating: Rating | AiTag; note: string; createdAt: string }
export interface Game { id: string; title: string; team: '濃色' | '淡色'; createdAt: string; updatedAt: string; moments: Moment[] }
