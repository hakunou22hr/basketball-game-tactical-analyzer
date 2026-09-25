import { useEffect, useMemo, useRef, useState } from 'react'
import { coachingAdvice, formatTime, summarize } from './analysis'
import { loadGames, saveGame } from './db'
import { download, toCsv, toHtml } from './export'
import type { Game, Moment, Perspective, Rating } from './types'
import { extractFrames, resolveRange } from './ai/frameExtractor'
import { getAnalysisEndpoint, requestAnalysis } from './ai/client'
import type { AiAnalysis, AnalysisItem, AnalysisRange, Confidence } from './ai/types'
import { captureLiveFrame } from './live/liveFrameCapture'
import { createRecorder, replayStartTime, saveRecording } from './live/recorder'
import type { RecordingSession } from './live/recorder'

const perspectives: { name: Perspective; icon: string }[] = [
  {name:'全体',icon:'⌗'}, {name:'オフェンス',icon:'↗'}, {name:'ディフェンス',icon:'◇'}, {name:'ブレイク',icon:'»'},
  {name:'プレスダウン',icon:'↓'}, {name:'リバウンド',icon:'↥'}, {name:'トランジション',icon:'⇄'}
]
const ratings: { name: Rating; symbol: string; label: string }[] = [
  {name:'GOOD PLAY',symbol:'✓',label:'良いプレー'}, {name:'CHECK',symbol:'?',label:'要チェック'}, {name:'FIX',symbol:'!',label:'改善ポイント'}
]
const demoMoments: Moment[] = [
  {id:'d1',time:18,perspective:'オフェンス',rating:'GOOD PLAY',note:'ドライブに合わせてコーナーが空間を確保',createdAt:new Date().toISOString()},
  {id:'d2',time:43,perspective:'ディフェンス',rating:'CHECK',note:'ピック＆ロールのカバレッジを確認',createdAt:new Date().toISOString()},
  {id:'d3',time:67,perspective:'トランジション',rating:'FIX',note:'ターンオーバー後の戻りが遅い',createdAt:new Date().toISOString()}
]

export default function App() {
  const video = useRef<HTMLVideoElement>(null)
  const liveVideo = useRef<HTMLVideoElement>(null)
  const cameraStream = useRef<MediaStream | null>(null)
  const recordingSession = useRef<RecordingSession | null>(null)
  const previewUrlRef = useRef('')
  const liveAnalysisBusy = useRef(false)
  const [source, setSource] = useState('')
  const [team, setTeam] = useState<'濃色'|'淡色'>('濃色')
  const [perspective, setPerspective] = useState<Perspective>('全体')
  const [rating, setRating] = useState<Rating>('GOOD PLAY')
  const [note, setNote] = useState('')
  const [moments, setMoments] = useState<Moment[]>([])
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(100)
  const [demo, setDemo] = useState(false)
  const [view, setView] = useState<'analyze'|'review'>('analyze')
  const [saved, setSaved] = useState<Game[]>([])
  const [analysisRange, setAnalysisRange] = useState<AnalysisRange>('last60')
  const [selection, setSelection] = useState({ start: 0, end: 60 })
  const [aiResult, setAiResult] = useState<AiAnalysis | null>(null)
  const [aiError, setAiError] = useState('')
  const [progress, setProgress] = useState('')
  const [showTimeout, setShowTimeout] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [liveAiEnabled, setLiveAiEnabled] = useState(true)
  const [liveStatus, setLiveStatus] = useState('')
  const [liveViewMode, setLiveViewMode] = useState<'live'|'replay'>('live')
  const [previewUrl, setPreviewUrl] = useState('')
  const [replayLastThirty, setReplayLastThirty] = useState(false)
  const stats = useMemo(() => summarize(moments), [moments])
  const game = (): Game => ({ id: 'current-game', title: 'ゲーム分析', team, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), moments })
  useEffect(() => { loadGames().then(setSaved).catch(() => {}) }, [])
  useEffect(() => () => { if (source) URL.revokeObjectURL(source) }, [source])
  useEffect(() => {
    if (!recording) return
    const startedAt = Date.now() - recordingSeconds * 1000
    const timer = window.setInterval(() => setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250)
    return () => window.clearInterval(timer)
  }, [recording])
  useEffect(() => () => cameraStream.current?.getTracks().forEach(track => track.stop()), [])
  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }, [])

  useEffect(() => {
    if (!recording || !liveAiEnabled) return
    const analyzeFrame = async () => {
      if (!liveVideo.current || liveAnalysisBusy.current) return
      if (!getAnalysisEndpoint()) { setAiError('AI解析サーバーがまだ設定されていません'); return }
      liveAnalysisBusy.current = true
      setLiveStatus('ライブ映像をAI解析中')
      try {
        const frame = captureLiveFrame(liveVideo.current, team, perspective)
        const result = await requestAnalysis({ team, perspective, range: { start: frame.timestamp, end: frame.timestamp }, frames: [frame] })
        setAiResult(result); setAiError(''); setLiveStatus('最新のAI解析を更新しました')
      } catch (error) { setAiError(error instanceof Error ? error.message : 'ライブAI解析に失敗しました'); setLiveStatus('') }
      finally { liveAnalysisBusy.current = false }
    }
    void analyzeFrame()
    const timer = window.setInterval(analyzeFrame, 15_000)
    return () => window.clearInterval(timer)
  }, [recording, liveAiEnabled, team, perspective])

  function addMoment() {
    const item: Moment = { id: crypto.randomUUID(), time, perspective, rating, note: note.trim() || coachingAdvice(perspective, rating), createdAt: new Date().toISOString() }
    setMoments(v => [...v, item].sort((a,b) => a.time-b.time)); setNote('')
  }
  function enableDemo() { setDemo(true); setMoments(demoMoments); setTime(43); setDuration(92) }
  function jump(second: number) { setTime(second); if (video.current) video.current.currentTime = second }
  async function persist() { const g = game(); await saveGame(g); setSaved(await loadGames()) }
  function exportAs(kind: 'json'|'csv'|'html'|'pdf') { const g=game(); if(kind==='pdf'){ const w=window.open(); if(w){w.document.write(toHtml(g));w.document.close();w.print()} return } const data=kind==='json'?JSON.stringify(g,null,2):kind==='csv'?toCsv(g):toHtml(g); download(data, kind==='json'?'application/json':kind==='csv'?'text/csv':'text/html',`game-review.${kind}`) }
  async function analyzeVideo() {
    setAiError(''); setAiResult(null); setShowTimeout(false)
    if (!getAnalysisEndpoint()) { setAiError('AI解析サーバーがまだ設定されていません'); return }
    if (!video.current || !source) { setAiError('解析する試合映像を読み込んでください'); return }
    try {
      const range = resolveRange(analysisRange, time, duration, selection)
      setProgress('フレーム抽出中'); const frames = await extractFrames(video.current, range, team, perspective)
      setProgress('攻撃解析中'); await new Promise(resolve => setTimeout(resolve, 200))
      setProgress('守備解析中'); const resultPromise = requestAnalysis({ team, perspective, range, frames })
      await new Promise(resolve => setTimeout(resolve, 200)); setProgress('ゲームプラン生成中')
      setAiResult(await resultPromise)
    } catch (error) { setAiError(error instanceof Error ? error.message : 'AI解析に失敗しました') }
    finally { setProgress('') }
  }
  function addAiEvidence() {
    if (!aiResult) return
    const additions: Moment[] = aiResult.evidence.map(e => ({ id: crypto.randomUUID(), time: Math.min(duration, Math.max(0, e.timestamp)), perspective, rating: e.tag, note: e.description, createdAt: new Date().toISOString() }))
    setMoments(current => [...current, ...additions].sort((a,b) => a.time-b.time))
  }
  async function startCamera() {
    setAiError(''); setLiveStatus('カメラを起動中')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: true })
      cameraStream.current?.getTracks().forEach(track => track.stop())
      releasePreviewUrl(); cameraStream.current = stream; setSource(''); setRecordedBlob(null); setCameraActive(true); setLiveViewMode('live'); setLiveStatus('カメラ準備完了')
      requestAnimationFrame(() => { if (liveVideo.current) { liveVideo.current.srcObject = stream; void liveVideo.current.play() } })
    } catch (error) { setLiveStatus(''); setAiError(error instanceof Error ? `カメラを開始できません: ${error.message}` : 'カメラを開始できません') }
  }
  function startRecording() {
    if (!cameraStream.current) return
    setRecordingSeconds(0); setAiError(''); setLiveStatus('録画中')
    try {
      recordingSession.current = createRecorder(cameraStream.current, blob => {
        const url = URL.createObjectURL(blob)
        releasePreviewUrl(); setRecordedBlob(blob); setSource(url); setCameraActive(false); setRecording(false); setLiveViewMode('live'); setLiveStatus('録画完了・再生とAI解析ができます')
        cameraStream.current?.getTracks().forEach(track => track.stop()); cameraStream.current = null
        requestAnimationFrame(() => { if (liveVideo.current) liveVideo.current.srcObject = null })
      })
      recordingSession.current.recorder.start(1000); setRecording(true)
    } catch (error) { setLiveStatus(''); setAiError(error instanceof Error ? `録画を開始できません: ${error.message}` : 'このブラウザでは録画できません') }
  }
  function stopRecording() { if (recordingSession.current?.recorder.state === 'recording') recordingSession.current.recorder.stop() }
  function releasePreviewUrl() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = ''; setPreviewUrl('')
  }
  async function showRecordingPreview(lastThirtySeconds = false) {
    const session = recordingSession.current
    if (!session || session.recorder.state !== 'recording') return
    setLiveStatus('撮影内容を準備中')
    try {
      const blob = await session.requestRecordedBlob()
      if (!blob.size || session.recorder.state !== 'recording') return
      releasePreviewUrl()
      const url = URL.createObjectURL(blob); previewUrlRef.current = url; setPreviewUrl(url)
      setReplayLastThirty(lastThirtySeconds); setLiveViewMode('replay'); setLiveStatus('録画はバックグラウンドで継続中')
    } catch (error) { setAiError(error instanceof Error ? `撮影内容を再生できません: ${error.message}` : '撮影内容を再生できません') }
  }
  function returnToLive() {
    if (video.current) { video.current.pause(); video.current.removeAttribute('src'); video.current.load() }
    releasePreviewUrl(); setLiveViewMode('live'); setLiveStatus('録画中')
    requestAnimationFrame(() => { if (liveVideo.current && cameraStream.current) { liveVideo.current.srcObject = cameraStream.current; void liveVideo.current.play() } })
  }
  async function saveRecordedVideo() {
    if (!recordedBlob) return
    const method = await saveRecording(recordedBlob)
    if (method !== 'cancelled') setLiveStatus(method === 'picker' ? '録画動画を保存しました' : '録画動画をダウンロードしました')
  }

  return <div className="app">
    <header><div className="brand"><div className="ball">◉</div><div><strong>TACTICAL <i>ANALYZER</i></strong><small>BASKETBALL GAME INTELLIGENCE</small></div></div>
      <nav><button className={view==='analyze'?'active':''} onClick={()=>setView('analyze')}>LIVE ANALYSIS</button><button className={view==='review'?'active':''} onClick={()=>setView('review')}>GAME REVIEW <span>{moments.length}</span></button></nav>
      <div className="header-actions"><button className={`demo ${demo?'on':''}`} onClick={enableDemo}><b>●</b> DEMO MODE</button><button className="save" onClick={persist}>⌑ 保存</button></div>
    </header>

    {view==='analyze' ? <main>
      <section className="video-panel panel">
        <div className="video-top"><span className="live-dot">●</span><b>{cameraActive ? liveViewMode==='replay' ? ' REPLAY' : ' LIVE CAMERA' : ' GAME FOOTAGE'}</b><span className="timecode">{recording ? `● REC ${formatTime(recordingSeconds)}` : `${formatTime(time)} / ${formatTime(duration)}`}</span></div>
        <div className="video-stage">
          {cameraActive ? <><video ref={liveVideo} className={liveViewMode==='replay'?'live-capture-video':''} autoPlay muted playsInline />{liveViewMode==='replay'&&previewUrl&&<video ref={video} src={previewUrl} controls autoPlay playsInline onLoadedMetadata={e=>{e.currentTarget.currentTime=replayStartTime(e.currentTarget.duration,replayLastThirty)}}/>}</> : source ? <video ref={video} src={source} controls onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} /> : <div className="empty-video"><div className="court"><span>＋</span></div><h2>試合映像を読み込む</h2><p>MP4・MOV・WebM / ファイルは端末内だけで処理されます</p><div className="source-actions"><label>映像を選択<input type="file" accept="video/*" onChange={e=>{const f=e.target.files?.[0];if(f)setSource(URL.createObjectURL(f))}} /></label><button className="camera-button" onClick={startCamera}>LIVE CAMERA</button></div><button onClick={enableDemo}>サンプルで試す →</button></div>}
          {demo && !source && !cameraActive && <div className="demo-watermark">DEMO FOOTAGE</div>}
        </div>
        {cameraActive ? liveViewMode==='replay' ? <div className="live-controls replay-controls"><button className="return-live" onClick={returnToLive}>← LIVEに戻る</button><button className="stop-recording" onClick={stopRecording}>■ 録画を停止</button><small>{liveStatus}</small></div> : <div className="live-controls"><button className={recording?'stop-recording':'start-recording'} onClick={recording?stopRecording:startRecording}>{recording?'■ 録画を停止':'● 録画を開始'}</button>{recording&&<><button className="preview-recording" onClick={()=>showRecordingPreview(false)}>▶ 撮影内容を再生</button><button className="preview-recording" onClick={()=>showRecordingPreview(true)}>↺ 直前30秒</button></>}<label className="ai-toggle"><input type="checkbox" checked={liveAiEnabled} onChange={e=>setLiveAiEnabled(e.target.checked)}/><span/> AI解析 {liveAiEnabled?'ON':'OFF'}</label><small>{liveStatus}</small></div> : <div className="scrubber"><span>{formatTime(time)}</span><input aria-label="動画時刻" type="range" min="0" max={duration} value={time} onChange={e=>jump(+e.target.value)} /><span>{formatTime(duration)}</span></div>}
        {recordedBlob&&<div className="recording-actions"><span>録画動画</span><button onClick={saveRecordedVideo}>↓ 動画を保存</button><button onClick={startCamera}>↻ もう一度撮影</button></div>}
        <div className="team-select"><span>分析するチーム</span><button className={team==='濃色'?'selected dark':''} onClick={()=>setTeam('濃色')}><i/>濃色チーム</button><button className={team==='淡色'?'selected light':''} onClick={()=>setTeam('淡色')}><i/>淡色チーム</button></div>
      </section>

      <section className="control-panel panel">
        <div className="section-title"><span>01</span><div><b>解析視点</b><small>いま何を見ていますか？</small></div></div>
        <div className="perspectives">{perspectives.map(p=><button key={p.name} className={perspective===p.name?'selected':''} onClick={()=>setPerspective(p.name)}><i>{p.icon}</i>{p.name}</button>)}</div>
        <div className="section-title second"><span>02</span><div><b>プレー評価</b><small>ワンタップで瞬間を記録</small></div></div>
        <div className="ratings">{ratings.map(r=><button key={r.name} className={`${r.name.replace(' ','-').toLowerCase()} ${rating===r.name?'selected':''}`} onClick={()=>setRating(r.name)}><i>{r.symbol}</i><span><b>{r.name}</b><small>{r.label}</small></span></button>)}</div>
        <label className="note-label">メモ <span>任意</span><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="状況、選手、気づきを入力…" /></label>
        <button className="record" onClick={addMoment}><span>＋</span> この瞬間を記録 <small>{formatTime(time)}</small></button>
      </section>

      <section className="timeline panel"><div className="timeline-head"><div><b>GAME TIMELINE</b><span>{moments.length} MOMENTS</span></div><div className="legend"><i className="g"/>GOOD <i className="c"/>CHECK <i className="f"/>FIX</div></div>
        {moments.length ? <div className="moment-list">{moments.map(m=><button key={m.id} onClick={()=>jump(m.time)} className={m.rating==='GOOD PLAY'?'good':m.rating.toLowerCase()}><time>{formatTime(m.time)}</time><i/><div><b>{m.rating}</b><span>{m.perspective} · {m.note}</span></div><em>▶</em></button>)}</div> : <div className="empty-list"><b>記録した瞬間がここに並びます</b><span>評価ボタンを選び「この瞬間を記録」を押してください</span></div>}
      </section>

      <section className="ai-panel panel">
        <div className="ai-heading"><div><small>AI VIDEO ANALYSIS</small><h2>AI戦況解析</h2></div><span>動画全体ではなく抽出フレームのみ送信</span></div>
        <div className="range-options">{([['last30','直近30秒'],['last60','直近60秒'],['selection','選択区間'],['all','動画全体']] as const).map(([value,label])=><button key={value} className={analysisRange===value?'selected':''} onClick={()=>setAnalysisRange(value)}>{label}</button>)}</div>
        {analysisRange==='selection'&&<div className="selection-fields"><label>開始（秒）<input type="number" min="0" max={duration} value={selection.start} onChange={e=>setSelection(v=>({...v,start:+e.target.value}))}/></label><label>終了（秒）<input type="number" min="0" max={duration} value={selection.end} onChange={e=>setSelection(v=>({...v,end:+e.target.value}))}/></label></div>}
        <button className="analyze-button" disabled={!!progress} onClick={analyzeVideo}>{progress || 'AI戦況解析を開始'}</button>
        {progress&&<div className="progress" aria-live="polite">{['フレーム抽出中','攻撃解析中','守備解析中','ゲームプラン生成中'].map(step=><span key={step} className={progress===step?'active':''}>{step}</span>)}</div>}
        {aiError&&<div className="ai-error" role="alert">{aiError}<small>手動タグと簡易ルールアドバイスは引き続き利用できます。</small></div>}
      </section>

      {aiResult&&<GamePlan result={aiResult} showTimeout={showTimeout} onTimeout={()=>setShowTimeout(v=>!v)} onAddTimeline={addAiEvidence}/>}

      <aside className={`coach ${rating==='GOOD PLAY'?'good':rating.toLowerCase()}`}><div className="coach-label">⚡ 簡易ルールアドバイス</div><div className="coach-body"><span className="quote">“</span><p>{coachingAdvice(perspective,rating)}</p><div><b>{perspective}</b><span>{rating}</span></div></div></aside>
    </main> : <Review moments={moments} stats={stats} saved={saved} onJump={s=>{setView('analyze');setTimeout(()=>jump(s))}} onExport={exportAs} />}
    <footer><span>TACTICAL ANALYZER · OFFLINE READY</span><span>AI解析時は必要な抽出フレームのみを送信します</span></footer>
  </div>
}

const confidenceLabel: Record<Confidence,string> = { high:'高', medium:'中', low:'低', unknown:'判断困難' }
function Items({items}:{items:AnalysisItem[]}) { return items.length?<ul>{items.slice(0,3).map((item,i)=><li key={i}><span>{item.text}</span><em className={`confidence ${item.confidence}`}>{confidenceLabel[item.confidence]}</em></li>)}</ul>:<p className="unknown">判断困難</p> }
function GamePlan({result,showTimeout,onTimeout,onAddTimeline}:{result:AiAnalysis;showTimeout:boolean;onTimeout:()=>void;onAddTimeline:()=>void}) {
  return <section className="game-plan panel"><div className="plan-head"><div><small>AI VIDEO ANALYSIS</small><h2>AI GAME PLAN</h2></div><em className={`confidence ${result.confidence}`}>総合信頼度 {confidenceLabel[result.confidence]}</em></div>
    <div className="plan-grid"><article><b>① 現在の戦況</b><p>{result.summary}</p></article><article><b>② 今うまくいっていること</b><Items items={[...result.offense.working,...result.defense.working].slice(0,3)}/></article><article><b>③ 最優先で直すこと</b><Items items={[...result.offense.problems,...result.defense.problems].slice(0,3)}/></article><article><b>④ 次の3ポゼッション</b><Items items={result.nextThreePossessions}/></article><article><b>⑤ 相手への対策</b><Items items={result.defense.keyOpponent?[result.defense.keyOpponent,...result.defense.recommendations].slice(0,3):result.defense.recommendations}/></article><article><b>⑥ 継続する攻撃</b><Items items={result.offense.repeatPatterns}/></article></div>
    <div className="plan-actions"><button className="timeout-button" onClick={onTimeout}>30秒で選手に伝える</button><button onClick={onAddTimeline}>AI重要場面をタイムラインへ追加</button></div>{showTimeout&&<div className="timeout-message"><b>TIMEOUT MESSAGE</b><p>{result.timeoutMessage}</p></div>}
  </section>
}

function Review({moments,stats,saved,onJump,onExport}:{moments:Moment[];stats:ReturnType<typeof summarize>;saved:Game[];onJump:(n:number)=>void;onExport:(k:'json'|'csv'|'html'|'pdf')=>void}) {
  return <main className="review-page"><div className="review-title"><div><small>POST GAME</small><h1>試合後レビュー</h1><p>記録した瞬間から、次のゲームプランを組み立てる。</p></div><div className="exports">{(['pdf','html','json','csv'] as const).map(k=><button key={k} onClick={()=>onExport(k)}>↓ {k.toUpperCase()}</button>)}</div></div>
    <div className="stat-grid"><article><span>記録した瞬間</span><b>{moments.length}</b><small>MOMENTS</small></article><article className="green"><span>良いプレー</span><b>{stats.good}</b><small>GOOD PLAY</small></article><article className="yellow"><span>要チェック</span><b>{stats.check}</b><small>CHECK</small></article><article className="red"><span>改善ポイント</span><b>{stats.fix}</b><small>FIX</small></article></div>
    <section className="review-list panel"><h2>すべてのプレー</h2>{moments.length?moments.map(m=><button key={m.id} onClick={()=>onJump(m.time)}><time>{formatTime(m.time)}</time><b className={m.rating==='GOOD PLAY'?'good':m.rating.toLowerCase()}>{m.rating}</b><span>{m.perspective}</span><p>{m.note}</p><em>映像へ →</em></button>):<div className="empty-list"><b>レビューする記録がありません</b><span>LIVE ANALYSISでプレーを記録してください</span></div>}</section>
    {saved.length>0&&<p className="saved-info">端末に保存済みの試合: {saved.length}件</p>}
  </main>
}
