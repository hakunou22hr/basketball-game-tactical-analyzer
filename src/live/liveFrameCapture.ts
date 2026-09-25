import type { ExtractedFrame, TeamColor } from '../ai/types'
import type { Perspective } from '../types'

export function captureLiveFrame(video: HTMLVideoElement, team: TeamColor, perspective: Perspective): ExtractedFrame {
  if (!video.videoWidth || !video.videoHeight) throw new Error('カメラ映像の準備ができていません')
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 960 / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvasを利用できません')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return { timestamp: video.currentTime || 0, image: canvas.toDataURL('image/jpeg', .72), team, perspective }
}
