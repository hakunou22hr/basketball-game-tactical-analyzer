import { describe, expect, it } from 'vitest'
import { coachingAdvice, formatTime, summarize } from './analysis'
describe('analysis helpers', () => {
  it('formats video timestamps', () => expect(formatTime(125.9)).toBe('02:05'))
  it('returns tactical coaching advice', () => expect(coachingAdvice('リバウンド', 'FIX')).toContain('コンタクト'))
  it('summarizes ratings', () => expect(summarize([{id:'1',time:0,perspective:'全体',rating:'CHECK',note:'',createdAt:''}])).toEqual({good:0,check:1,fix:0}))
})
