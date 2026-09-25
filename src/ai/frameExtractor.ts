import type { AnalysisRange, ExtractedFrame, TeamColor } from './types'
import type { Perspective } from '../types'
export function resolveRange(kind: AnalysisRange, current: number, duration: number, selection?: { start: number; end: number }) {
  void selection
  if (kind === 'current') return { start: Math.min(current, duration), end: Math.min(current, duration) }
  const seconds = kind === 'last15' ? 15 : 30
  return { start: Math.max(0, current - seconds), end: Math.min(current, duration) }
}
export function frameTimes(start: number, end: number, maximum = 14) {
  if (end <= start) return [start]
  const count = Math.min(maximum, Math.max(2, Math.ceil((end - start) / 5) + 1))
  return Array.from({ length: count }, (_, i) => start + ((end - start) * i) / (count - 1))
}
const seek = (video: HTMLVideoElement, time: number) => new Promise<void>((resolve, reject) => {
  const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail) }
  const done = () => { cleanup(); resolve() }; const fail = () => { cleanup(); reject(new Error('フレームの読み込みに失敗しました')) }
  video.addEventListener('seeked', done, { once: true }); video.addEventListener('error', fail, { once: true }); video.currentTime = time
})
export async function extractFrames(video: HTMLVideoElement, range: { start: number; end: number }, team: TeamColor, perspective: Perspective): Promise<ExtractedFrame[]> {
  const canvas = document.createElement('canvas'); const scale = Math.min(1, 960 / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvasを利用できません')
  const originalTime = video.currentTime; const wasPaused = video.paused; video.pause(); const frames: ExtractedFrame[] = []
  try { for (const timestamp of frameTimes(range.start, range.end)) { await seek(video, timestamp); context.drawImage(video, 0, 0, canvas.width, canvas.height); frames.push({ timestamp, image: canvas.toDataURL('image/jpeg', .72), team, perspective }) } }
  finally { video.currentTime = originalTime; if (!wasPaused) void video.play() }
  return frames
}
