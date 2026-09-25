export type RecordingState = 'idle' | 'recording' | 'stopped'
export const cameraConstraints: MediaStreamConstraints = { video: { facingMode: { ideal: 'environment' } }, audio: true }
export function requestCamera(mediaDevices: Pick<MediaDevices, 'getUserMedia'> = navigator.mediaDevices) { return mediaDevices.getUserMedia(cameraConstraints) }

export const recorderMimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
export function selectRecorderMimeType(MediaRecorderClass: typeof MediaRecorder = MediaRecorder) {
  return recorderMimeTypes.find(type => MediaRecorderClass.isTypeSupported(type)) || ''
}
export function extensionForMime(mime: string) { return mime.includes('mp4') ? 'mp4' : 'webm' }
export function recordingFilename(date = new Date(), mime = 'video/webm') {
  const value = [date.getFullYear(), date.getMonth()+1, date.getDate(), date.getHours(), date.getMinutes()].map((n, i) => String(n).padStart(i ? 2 : 4, '0'))
  return `basketball-game-${value[0]}-${value[1]}-${value[2]}-${value[3]}${value[4]}.${extensionForMime(mime)}`
}
export function createRecording(stream: MediaStream, onStopped: (blob: Blob) => void, MediaRecorderClass: typeof MediaRecorder = MediaRecorder) {
  const mimeType = selectRecorderMimeType(MediaRecorderClass)
  const recorder = new MediaRecorderClass(stream, mimeType ? { mimeType } : undefined); const chunks: BlobPart[] = []
  recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data) })
  recorder.addEventListener('stop', () => onStopped(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' })), { once: true })
  return recorder
}
export function stopCamera(stream: MediaStream | null) { stream?.getTracks().forEach(track => track.stop()) }

interface SavePickerWindow extends Window { showSaveFilePicker?: (options: unknown) => Promise<{ createWritable(): Promise<{ write(blob: Blob): Promise<void>; close(): Promise<void> }> }> }
export async function saveRecording(blob: Blob, name = recordingFilename(new Date(), blob.type), browserWindow: SavePickerWindow = window) {
  if (browserWindow.showSaveFilePicker) {
    const handle = await browserWindow.showSaveFilePicker({ suggestedName: name, types: [{ description: '試合録画', accept: { [blob.type || 'video/webm']: [`.${extensionForMime(blob.type)}`] } }] })
    const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return 'picker' as const
  }
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); return 'download' as const
}
