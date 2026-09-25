import type { ExtractedFrame, TeamColor } from '../ai/types'
import type { Perspective } from '../types'

export function captureLiveFrame(video: HTMLVideoElement, timestamp: number, team: TeamColor, perspective: Perspective): ExtractedFrame {
  if (!video.videoWidth || !video.videoHeight) throw new Error('ライブ映像の準備中です')
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 960 / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvasを利用できません')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return { timestamp, image: canvas.toDataURL('image/jpeg', .72), team, perspective }
}

export function createLatestOnlyQueue<T>(worker: (value: T) => Promise<void>) {
  let running = false; let queued: T | undefined
  const drain = async (value: T) => {
    running = true
    try { await worker(value) } finally {
      const next = queued; queued = undefined
      if (next !== undefined) await drain(next); else running = false
    }
  }
  return { push(value: T) { if (running) queued = value; else void drain(value) }, isRunning: () => running }
}
