import { describe, expect, it, vi } from 'vitest'
import { createLatestOnlyQueue } from './liveFrameCapture'
import { cameraConstraints, extensionForMime, recordingFilename, requestCamera, saveRecording, selectRecorderMimeType, stopCamera } from './recorder'

describe('live recording helpers', () => {
  it('requests an environment-facing camera and displays the returned stream', async () => { const stream={} as MediaStream; const getUserMedia=vi.fn().mockResolvedValue(stream); await expect(requestCamera({getUserMedia})).resolves.toBe(stream); expect(getUserMedia).toHaveBeenCalledWith(cameraConstraints); expect(cameraConstraints.video).toEqual({facingMode:{ideal:'environment'}}) })
  it('chooses the first supported MediaRecorder format without hard-coding one format', () => { const fake={isTypeSupported:vi.fn(type=>type==='video/mp4')} as unknown as typeof MediaRecorder; expect(selectRecorderMimeType(fake)).toBe('video/mp4') })
  it('creates a timestamped filename with the actual extension', () => { expect(recordingFilename(new Date(2026,8,25,8,3),'video/mp4')).toBe('basketball-game-2026-09-25-0803.mp4'); expect(extensionForMime('video/webm')).toBe('webm') })
  it('keeps only the latest pending analysis while one is running', async () => { const releases:Array<()=>void>=[]; const seen:number[]=[]; const queue=createLatestOnlyQueue<number>(n=>new Promise(resolve=>{seen.push(n);releases.push(resolve)})); queue.push(1); queue.push(2); queue.push(3); expect(seen).toEqual([1]); releases.shift()?.(); await Promise.resolve(); await Promise.resolve(); expect(seen).toEqual([1,3]); releases.shift()?.() })
  it('stops every camera track', () => { const tracks=[{stop:vi.fn()},{stop:vi.fn()}]; stopCamera({getTracks:()=>tracks} as unknown as MediaStream); tracks.forEach(track=>expect(track.stop).toHaveBeenCalled()) })
  it('uses the save picker when available', async () => { const writable={write:vi.fn(),close:vi.fn()}; const picker=vi.fn().mockResolvedValue({createWritable:()=>writable}); await expect(saveRecording(new Blob(['x'],{type:'video/mp4'}),'game.mp4',{showSaveFilePicker:picker} as never)).resolves.toBe('picker'); expect(writable.write).toHaveBeenCalled() })
  it('falls back to a normal download', async () => { const click=vi.fn(); vi.stubGlobal('URL',{createObjectURL:()=> 'blob:test',revokeObjectURL:vi.fn()}); vi.stubGlobal('document',{createElement:()=>({click})}); await expect(saveRecording(new Blob(['x']),'game.webm',{} as Window)).resolves.toBe('download'); expect(click).toHaveBeenCalled(); vi.unstubAllGlobals() })
})
