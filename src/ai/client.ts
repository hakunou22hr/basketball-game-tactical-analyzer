import { buildAnalysisInstructions } from './prompt'
import type { AiAnalysis, AnalysisItem, AnalysisRequest, Confidence, Evidence } from './types'
const confidences: Confidence[] = ['high', 'medium', 'low', 'unknown']
const isItem = (v: unknown): v is AnalysisItem => !!v && typeof v === 'object' && typeof (v as AnalysisItem).text === 'string' && confidences.includes((v as AnalysisItem).confidence)
const isItems = (v: unknown): v is AnalysisItem[] => Array.isArray(v) && v.length <= 3 && v.every(isItem)
const isEvidence = (v: unknown): v is Evidence => !!v && typeof v === 'object' && typeof (v as Evidence).timestamp === 'number' && ['AI GOOD','AI CHECK','AI FIX','AI KEY PLAY'].includes((v as Evidence).tag) && typeof (v as Evidence).description === 'string' && confidences.includes((v as Evidence).confidence)
export function validateAnalysis(value: unknown): AiAnalysis {
  const v = value as AiAnalysis
  if (!v || typeof v.summary !== 'string' || !confidences.includes(v.confidence) || typeof v.timeoutMessage !== 'string' || !v.offense || !v.defense || !isItems(v.offense.working) || !isItems(v.offense.problems) || !isItems(v.offense.scoringSources) || !isItems(v.offense.repeatPatterns) || !isItems(v.defense.working) || !isItems(v.defense.problems) || !(v.defense.keyOpponent === null || isItem(v.defense.keyOpponent)) || !isItems(v.defense.recommendations) || !isItems(v.nextThreePossessions) || !Array.isArray(v.evidence) || !v.evidence.every(isEvidence)) throw new Error('AIレスポンスの形式が不正です')
  return v
}
export function getAnalysisEndpoint() { return import.meta.env.VITE_AI_ANALYSIS_ENDPOINT?.trim() || '' }
export async function requestAnalysis(request: AnalysisRequest, endpoint = getAnalysisEndpoint()) {
  if (!endpoint) throw new Error('AI解析サーバーがまだ設定されていません')
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, instructions: buildAnalysisInstructions(request) }) })
  if (!response.ok) throw new Error(`AI解析サーバーでエラーが発生しました (${response.status})`)
  return validateAnalysis(await response.json())
}
