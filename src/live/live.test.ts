import { describe, expect, it, vi } from 'vitest'
import { captureLiveFrame } from './liveFrameCapture'
import { createRecorder, getSupportedRecordingMimeType, saveRecording } from './recorder'

describe('live camera recording', () => {
  it('selects the first recording format supported by the browser', () => {
    const Recorder = { isTypeSupported: (type: string) => type.includes('vp8') } as typeof MediaRecorder
    expect(getSupportedRecordingMimeType(Recorder)).toContain('vp8')
  })

  it('combines MediaRecorder chunks when recording stops', () => {
    class Recorder extends EventTarget {
      static isTypeSupported = () => true
      mimeType = 'video/webm'; state: RecordingState = 'inactive'
      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) { super() }
      emit(event: Event) { this.dispatchEvent(event) }
    }
    const complete = vi.fn()
    const recorder = createRecorder({} as MediaStream, complete, Recorder as unknown as typeof MediaRecorder) as unknown as Recorder
    const dataEvent = new Event('dataavailable')
    Object.defineProperty(dataEvent, 'data', { value: new Blob(['video']) })
    recorder.emit(dataEvent)
    recorder.emit(new Event('stop'))
    expect(complete).toHaveBeenCalledOnce()
    expect(complete.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(complete.mock.calls[0][0].size).toBe(5)
  })

  it('captures and scales a camera frame without seeking', () => {
    const drawImage = vi.fn()
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL: () => 'data:image/jpeg;base64,frame' }
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
    const frame = captureLiveFrame({ videoWidth: 1920, videoHeight: 1080, currentTime: 12 } as HTMLVideoElement, '濃色', '全体')
    expect([canvas.width, canvas.height]).toEqual([960, 540])
    expect(drawImage).toHaveBeenCalledOnce()
    expect(frame.timestamp).toBe(12)
    vi.unstubAllGlobals()
  })

  it('uses the download fallback when the file picker is unavailable', async () => {
    const click = vi.fn()
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click })) })
    vi.stubGlobal('window', {})
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:recording', revokeObjectURL: vi.fn() })
    await expect(saveRecording(new Blob(['video']), 'game.webm')).resolves.toBe('download')
    expect(click).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
