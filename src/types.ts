export type Perspective = '全体' | 'オフェンス' | 'ディフェンス' | 'ブレイク' | 'プレスダウン' | 'リバウンド' | 'トランジション'
export type Rating = 'GOOD PLAY' | 'CHECK' | 'FIX'
export interface Moment { id: string; time: number; perspective: Perspective; rating: Rating; note: string; createdAt: string }
export interface Game { id: string; title: string; team: '濃色' | '淡色'; createdAt: string; updatedAt: string; moments: Moment[] }
