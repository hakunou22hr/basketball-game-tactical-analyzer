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
  onChunk?: (chunk: Blob) => void,
) {
  const mimeType = getSupportedRecordingMimeType(MediaRecorderClass)
  const chunks: BlobPart[] = []
  const recorder = new MediaRecorderClass(stream, mimeType ? { mimeType } : undefined)
  recorder.addEventListener('dataavailable', event => {
    if (event.data.size) {
      chunks.push(event.data)
      onChunk?.(event.data)
    }
  })
  recorder.addEventListener('stop', () => {
    onComplete(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }))
  }, { once: true })
  return recorder
}

export function createRecordingBlob(chunks: BlobPart[], mimeType = 'video/webm') {
  return new Blob(chunks, { type: mimeType || 'video/webm' })
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
