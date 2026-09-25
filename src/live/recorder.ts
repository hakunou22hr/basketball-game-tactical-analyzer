export const RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export function getSupportedRecordingMimeType(MediaRecorderClass: typeof MediaRecorder = MediaRecorder) {
  return RECORDING_MIME_TYPES.find(type => MediaRecorderClass.isTypeSupported(type)) || ''
}

export function createRecorder(
  stream: MediaStream,
  onComplete: (blob: Blob) => void,
  MediaRecorderClass: typeof MediaRecorder = MediaRecorder,
) {
  const mimeType = getSupportedRecordingMimeType(MediaRecorderClass)
  const chunks: BlobPart[] = []
  const recorder = new MediaRecorderClass(stream, mimeType ? { mimeType } : undefined)
  recorder.addEventListener('dataavailable', event => {
    if (event.data.size) chunks.push(event.data)
  })
  recorder.addEventListener('stop', () => {
    onComplete(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }))
  }, { once: true })
  const getRecordedBlob = () => new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' })
  const requestRecordedBlob = () => new Promise<Blob>((resolve, reject) => {
    if (recorder.state !== 'recording') { resolve(getRecordedBlob()); return }
    const onData = () => resolve(getRecordedBlob())
    recorder.addEventListener('dataavailable', onData, { once: true })
    try { recorder.requestData() }
    catch (error) { recorder.removeEventListener('dataavailable', onData); reject(error) }
  })
  return { recorder, getRecordedBlob, requestRecordedBlob }
}

export type RecordingSession = ReturnType<typeof createRecorder>

export function replayStartTime(duration: number, lastThirtySeconds: boolean) {
  return lastThirtySeconds ? Math.max(0, duration - 30) : 0
}

type SaveFilePicker = (options: {
  suggestedName: string
  types: { description: string; accept: Record<string, string[]> }[]
}) => Promise<{ createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void> }> }>

export async function saveRecording(blob: Blob, filename = `basketball-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`) {
  const picker = (window as typeof window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker({ suggestedName: filename, types: [{ description: 'WebM video', accept: { 'video/webm': ['.webm'] } }] })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'picker' as const
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled' as const
      // A browser can expose the API but still reject it outside a secure context.
    }
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'download' as const
}
