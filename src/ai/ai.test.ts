import { describe, expect, it, vi } from 'vitest'
import { frameTimes, resolveRange } from './frameExtractor'
import { requestAnalysis, validateAnalysis } from './client'

const valid = { summary:'戦況', confidence:'low', offense:{working:[],problems:[],scoringSources:[],repeatPatterns:[]}, defense:{working:[],problems:[],keyOpponent:null,recommendations:[]}, nextThreePossessions:[], timeoutMessage:'短い指示', evidence:[{timestamp:10,tag:'AI FIX',description:'戻り',confidence:'low'}] }
describe('AI video analysis', () => {
  it('resolves current, 15-second, and 30-second ranges', () => { expect(resolveRange('current', 80, 100)).toEqual({start:80,end:80}); expect(resolveRange('last15', 80, 100)).toEqual({start:65,end:80}); expect(resolveRange('last30',20,100)).toEqual({start:0,end:20}) })
  it('samples no more than 14 frames at roughly five-second intervals', () => { const times=frameTimes(0,60); expect(times).toHaveLength(13); expect(times[1]).toBe(5) })
  it('validates response including low confidence and timeline evidence', () => expect(validateAnalysis(valid).evidence[0].tag).toBe('AI FIX'))
  it('rejects malformed JSON', () => expect(()=>validateAnalysis({...valid,confidence:'certain'})).toThrow('形式が不正'))
  it('does not pretend to analyze without an endpoint', async () => { await expect(requestAnalysis({team:'濃色',perspective:'全体',range:{start:0,end:1},frames:[]},'')).rejects.toThrow('まだ設定') })
  it('reports API errors', async () => { vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:500})); await expect(requestAnalysis({team:'淡色',perspective:'全体',range:{start:0,end:1},frames:[]},'/api')).rejects.toThrow('(500)'); vi.unstubAllGlobals() })
  it('stops an AI request after its timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))))
    const pending = requestAnalysis({team:'濃色',perspective:'全体',range:{start:0,end:1},frames:[]},'/api',30_000)
    const assertion = expect(pending).rejects.toThrow('30秒以内')
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    vi.useRealTimers(); vi.unstubAllGlobals()
  })
})
