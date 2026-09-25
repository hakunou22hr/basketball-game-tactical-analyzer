import { describe, expect, it, vi } from 'vitest'
import { captureLiveFrame } from './liveFrameCapture'
import { createRecorder, getSupportedRecordingMimeType, replayStartTime, saveRecording } from './recorder'

class Recorder extends EventTarget {
  static isTypeSupported = () => true
  mimeType = 'video/webm'; state: RecordingState = 'inactive'
  requestData = vi.fn()
  stop = vi.fn(() => { this.state = 'inactive'; this.dispatchEvent(new Event('stop')) })
  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) { super() }
  chunk(value: string) {
    const event = new Event('dataavailable')
    Object.defineProperty(event, 'data', { value: new Blob([value]) })
    this.dispatchEvent(event)
  }
}

describe('live camera recording', () => {
  it('selects the first recording format supported by the browser', () => {
    const Recorder = { isTypeSupported: (type: string) => type.includes('vp8') } as typeof MediaRecorder
    expect(getSupportedRecordingMimeType(Recorder)).toContain('vp8')
  })

  it('combines MediaRecorder chunks when recording stops', () => {
    const complete = vi.fn()
    const session = createRecorder({} as MediaStream, complete, Recorder as unknown as typeof MediaRecorder)
    const recorder = session.recorder as unknown as Recorder
    recorder.chunk('video')
    recorder.stop()
    expect(complete).toHaveBeenCalledOnce()
    expect(complete.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(complete.mock.calls[0][0].size).toBe(5)
  })

  it('creates preview blobs without stopping an active recording', async () => {
    const session = createRecorder({} as MediaStream, vi.fn(), Recorder as unknown as typeof MediaRecorder)
    const recorder = session.recorder as unknown as Recorder
    recorder.state = 'recording'; recorder.chunk('first')
    expect(session.getRecordedBlob().size).toBe(5)
    recorder.requestData.mockImplementationOnce(() => recorder.chunk('second'))
    const preview = await session.requestRecordedBlob()
    expect(preview.size).toBe(11)
    expect(recorder.requestData).toHaveBeenCalledOnce()
    expect(recorder.stop).not.toHaveBeenCalled()
    expect(recorder.state).toBe('recording')
  })

  it('keeps all chunks after repeated previews for the final recording', async () => {
    const complete = vi.fn()
    const session = createRecorder({} as MediaStream, complete, Recorder as unknown as typeof MediaRecorder)
    const recorder = session.recorder as unknown as Recorder
    recorder.state = 'recording'; recorder.chunk('before')
    recorder.requestData.mockImplementation(() => recorder.chunk('preview'))
    await session.requestRecordedBlob(); await session.requestRecordedBlob()
    recorder.chunk('after'); recorder.stop()
    expect(recorder.stop).toHaveBeenCalledOnce()
    expect(complete.mock.calls[0][0].size).toBe(6 + 7 + 7 + 5)
  })

  it('starts the last-30-second replay at a bounded offset', () => {
    expect(replayStartTime(95, true)).toBe(65)
    expect(replayStartTime(12, true)).toBe(0)
    expect(replayStartTime(95, false)).toBe(0)
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
