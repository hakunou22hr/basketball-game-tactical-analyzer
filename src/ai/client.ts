import { buildAnalysisInstructions } from './prompt'
import type { AiAnalysis, AnalysisItem, AnalysisRequest, Confidence, Evidence } from './types'

const confidences: Confidence[] = ['high', 'medium', 'low', 'unknown']
const STORAGE_KEY = 'basketball-tactical-ai-server-base'
const LOCAL_DEFAULT_BASE = 'http://127.0.0.1:8787'

const isItem = (v: unknown): v is AnalysisItem => !!v && typeof v === 'object' && typeof (v as AnalysisItem).text === 'string' && confidences.includes((v as AnalysisItem).confidence)
const isItems = (v: unknown): v is AnalysisItem[] => Array.isArray(v) && v.length <= 3 && v.every(isItem)
const isEvidence = (v: unknown): v is Evidence => !!v && typeof v === 'object' && typeof (v as Evidence).timestamp === 'number' && ['AI GOOD','AI CHECK','AI FIX','AI KEY PLAY'].includes((v as Evidence).tag) && typeof (v as Evidence).description === 'string' && confidences.includes((v as Evidence).confidence)

export function validateAnalysis(value: unknown): AiAnalysis {
  const v = value as AiAnalysis
  if (!v || typeof v.summary !== 'string' || !confidences.includes(v.confidence) || typeof v.timeoutMessage !== 'string' || !isItems(v.working) || !isItems(v.priorityFix) || !isItems(v.opponentCounter) || !isItems(v.continueOffense) || !v.offense || !v.defense || !isItems(v.offense.working) || !isItems(v.offense.problems) || !isItems(v.offense.scoringSources) || !isItems(v.offense.repeatPatterns) || !isItems(v.defense.working) || !isItems(v.defense.problems) || !(v.defense.keyOpponent === null || isItem(v.defense.keyOpponent)) || !isItems(v.defense.recommendations) || !isItems(v.nextThreePossessions) || !Array.isArray(v.evidence) || v.evidence.length > 12 || !v.evidence.every(isEvidence)) throw new Error('AIレスポンスの形式が不正です')
  return v
}

function unwrapAnalysis(value: unknown): unknown {
  if (typeof value === 'string') {
    const json = value.trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '')
    return JSON.parse(json)
  }
  if (!value || typeof value !== 'object') return value
  const wrapped = value as { analysis?: unknown; output_text?: unknown; choices?: Array<{ message?: { content?: unknown } }> }
  if (wrapped.analysis !== undefined) return unwrapAnalysis(wrapped.analysis)
  if (wrapped.output_text !== undefined) return unwrapAnalysis(wrapped.output_text)
  const content = wrapped.choices?.[0]?.message?.content
  return content === undefined ? value : unwrapAnalysis(content)
}

function normalizeBase(value: string) {
  return value.trim().replace(/\/$/, '').replace(/\/api\/(?:analyze|health)\/?$/, '')
}

export function getLocalAiServerBase() {
  if (typeof window === 'undefined') return LOCAL_DEFAULT_BASE
  const saved = window.localStorage?.getItem(STORAGE_KEY)?.trim()
  if (saved) return normalizeBase(saved)
  if (window.location.hostname.endsWith('github.io')) return LOCAL_DEFAULT_BASE
  if (window.location.port === '8787') return window.location.origin
  return window.location.origin
}

export function saveLocalAiServerBase(value: string) {
  const base = normalizeBase(value || LOCAL_DEFAULT_BASE)
  if (typeof window !== 'undefined') window.localStorage?.setItem(STORAGE_KEY, base)
  return base
}

function configuredEndpoint() {
  return import.meta.env.VITE_AI_ANALYSIS_ENDPOINT?.trim() || ''
}

export function getAnalysisEndpoint(base = getLocalAiServerBase()) {
  const configured = configuredEndpoint()
  if (configured) return configured
  return `${normalizeBase(base)}/api/analyze`
}

export function getHealthEndpoint(base = getLocalAiServerBase()) {
  const configured = configuredEndpoint()
  if (configured) return configured.replace(/\/api\/analyze\/?$/, '/api/health')
  return `${normalizeBase(base)}/api/health`
}

export async function checkAiHealth(endpoint = getHealthEndpoint(), timeoutMs = 5_000) {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, { signal: controller.signal })
    const body = await response.json().catch(() => ({}))
    return { ok: response.ok && body.ok === true, ai: String(body.ai || 'unavailable') }
  } catch {
    throw new Error('AIサーバーに接続できません。PCで start-ai-server.bat を起動し、AI接続を確認してください。')
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export async function requestAnalysis(request: AnalysisRequest, endpoint = getAnalysisEndpoint(), timeoutMs = 30_000) {
  if (!endpoint) throw new Error('AIサーバーに接続できません。PCで start-ai-server.bat を起動してください。')
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, instructions: buildAnalysisInstructions(request) }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = typeof response.json === 'function' ? await response.json().catch(() => ({})) : {}
      throw new Error(body.error || `AI解析サーバーでエラーが発生しました (${response.status})`)
    }
    return validateAnalysis(unwrapAnalysis(await response.json()))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('AI解析が30秒以内に完了しませんでした')
    if (error instanceof TypeError) throw new Error('AIサーバーに接続できません。PCで start-ai-server.bat を起動してください。')
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
  }
}
