import { describe, expect, it } from 'vitest'
import { buildLocalAnalysis } from './localAnalysis'
import type { AnalysisRequest } from './ai/types'
import type { Moment } from './types'

const request: AnalysisRequest = {
  team: '濃色',
  perspective: 'オフェンス',
  range: { start: 10, end: 30 },
  frames: [
    { timestamp: 10, image: 'data:image/jpeg;base64,AA==', team: '濃色', perspective: 'オフェンス' },
    { timestamp: 30, image: 'data:image/jpeg;base64,AA==', team: '濃色', perspective: 'オフェンス' },
  ],
}

const moments: Moment[] = [
  { id:'1', time:12, perspective:'オフェンス', rating:'GOOD PLAY', note:'ドライブからペイントタッチ', createdAt:'2026-09-29T00:00:00Z' },
  { id:'2', time:18, perspective:'オフェンス', rating:'CHECK', note:'逆サイドのスペーシングを確認', createdAt:'2026-09-29T00:00:01Z' },
  { id:'3', time:24, perspective:'リバウンド', rating:'FIX', note:'ボックスアウト後のセカンドショット', createdAt:'2026-09-29T00:00:02Z' },
  { id:'4', time:28, perspective:'ディフェンス', rating:'GOOD PLAY', note:'ヘルプとローテーションが連動', createdAt:'2026-09-29T00:00:03Z' },
]

describe('API-key-free local tactical analysis', () => {
  it('builds a game plan without an external AI response', () => {
    const result = buildLocalAnalysis(request, moments, { measured:true, motion:.52, lateralBalance:.7, centerShare:.32, complexity:.3 })
    expect(result.summary).toContain('濃色チーム・オフェンス')
    expect(result.confidence).toBe('medium')
    expect(result.working.length).toBeGreaterThan(0)
    expect(result.priorityFix.length).toBeGreaterThan(0)
    expect(result.nextThreePossessions).toHaveLength(3)
    expect(result.timeoutMessage.length).toBeGreaterThan(10)
    expect(result.evidence).toHaveLength(4)
  })

  it('does not invent a key opponent when no model identifies one', () => {
    const result = buildLocalAnalysis(request, [], { measured:false, motion:0, lateralBalance:.5, centerShare:.34, complexity:0 })
    expect(result.defense.keyOpponent).toBeNull()
    expect(result.opponentCounter[0].confidence).toBe('unknown')
    expect(result.summary).toContain('手動記録中心')
  })

  it('uses manual notes to identify only user-recorded scoring patterns', () => {
    const result = buildLocalAnalysis(request, moments, { measured:true, motion:.2, lateralBalance:.4, centerShare:.5, complexity:.2 })
    expect(result.offense.scoringSources.some(x=>x.text.includes('ペイント'))).toBe(true)
    expect(result.offense.scoringSources.some(x=>x.text.includes('セカンド'))).toBe(true)
  })
})
