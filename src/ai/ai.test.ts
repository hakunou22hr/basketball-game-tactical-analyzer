import { describe, expect, it, vi } from 'vitest'
import { frameTimes, resolveRange } from './frameExtractor'
import { requestAnalysis, validateAnalysis } from './client'

const valid = { summary:'戦況', confidence:'low', offense:{working:[],problems:[],scoringSources:[],repeatPatterns:[]}, defense:{working:[],problems:[],keyOpponent:null,recommendations:[]}, nextThreePossessions:[], timeoutMessage:'短い指示', evidence:[{timestamp:10,tag:'AI FIX',description:'戻り',confidence:'low'}] }
describe('AI video analysis', () => {
  it('resolves recent and selected ranges', () => { expect(resolveRange('last60', 80, 100)).toEqual({start:20,end:80}); expect(resolveRange('selection',0,100,{start:70,end:20})).toEqual({start:20,end:70}) })
  it('samples no more than 14 frames at roughly five-second intervals', () => { const times=frameTimes(0,60); expect(times).toHaveLength(13); expect(times[1]).toBe(5) })
  it('validates response including low confidence and timeline evidence', () => expect(validateAnalysis(valid).evidence[0].tag).toBe('AI FIX'))
  it('rejects malformed JSON', () => expect(()=>validateAnalysis({...valid,confidence:'certain'})).toThrow('形式が不正'))
  it('does not pretend to analyze without an endpoint', async () => { await expect(requestAnalysis({team:'濃色',perspective:'全体',range:{start:0,end:1},frames:[]},'')).rejects.toThrow('まだ設定') })
  it('reports API errors', async () => { vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:500})); await expect(requestAnalysis({team:'淡色',perspective:'全体',range:{start:0,end:1},frames:[]},'/api')).rejects.toThrow('(500)'); vi.unstubAllGlobals() })
})
