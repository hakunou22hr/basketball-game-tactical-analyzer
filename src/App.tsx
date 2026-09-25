import { useEffect, useMemo, useRef, useState } from 'react'
import { coachingAdvice, formatTime, summarize } from './analysis'
import { loadGames, saveGame } from './db'
import { download, toCsv, toHtml } from './export'
import type { Game, Moment, Perspective, Rating } from './types'
import { extractFrames, resolveRange } from './ai/frameExtractor'
import { getAnalysisEndpoint, requestAnalysis } from './ai/client'
import type { AiAnalysis, AnalysisItem, AnalysisRange, Confidence } from './ai/types'
import { captureLiveFrame, createLatestOnlyQueue, shouldCaptureFrame } from './live/liveFrameCapture'
import { createRecording, recordingFilename, requestCamera, saveRecording, stopCamera, type RecordingState } from './live/recorder'

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
  const recorder = useRef<MediaRecorder | null>(null)
  const liveTimer = useRef<number | null>(null)
  const liveFrames = useRef<ReturnType<typeof captureLiveFrame>[]>([])
  const lastLiveCapture = useRef(-1)
  const recordingStartedAt = useRef(0)
  const liveEnabledRef = useRef(true)
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
  const [footageMode, setFootageMode] = useState<'file'|'live'>('file')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [liveAnalysisEnabled, setLiveAnalysisEnabled] = useState(true)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [latestAnalysisTime, setLatestAnalysisTime] = useState<number | null>(null)
  const [recordingMessage, setRecordingMessage] = useState('')
  const liveQueue = useRef(createLatestOnlyQueue(async (frames: ReturnType<typeof captureLiveFrame>[]) => {
    try {
      const result = await requestAnalysis({ team: frames[0].team, perspective: frames[0].perspective, range: { start: frames[0].timestamp, end: frames.at(-1)!.timestamp }, frames })
      setAiResult(result); setLatestAnalysisTime(frames.at(-1)!.timestamp); setAiError('')
    } catch (error) { setAiError(error instanceof Error ? error.message : 'ライブAI解析に失敗しました（録画は継続します）') }
  }))
  const stats = useMemo(() => summarize(moments), [moments])
  const game = (): Game => ({ id: 'current-game', title: 'ゲーム分析', team, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), moments })
  useEffect(() => { loadGames().then(setSaved).catch(() => {}) }, [])
  useEffect(() => () => { if (source) URL.revokeObjectURL(source) }, [source])
  useEffect(() => { liveEnabledRef.current = liveAnalysisEnabled; if (!liveAnalysisEnabled) liveFrames.current=[] }, [liveAnalysisEnabled])
  useEffect(() => { if (cameraStream && video.current) { video.current.srcObject=cameraStream; void video.current.play() } }, [cameraStream])
  useEffect(() => () => { stopCamera(cameraStream); if (liveTimer.current) window.clearInterval(liveTimer.current) }, [cameraStream])

  async function startCamera() {
    setAiError(''); setRecordedBlob(null); setRecordingState('idle'); if (source) { URL.revokeObjectURL(source); setSource('') }
    try {
      const stream = await requestCamera()
      setCameraStream(stream); if (video.current) { video.current.srcObject = stream; await video.current.play() }
    } catch (error) { setAiError(error instanceof Error ? `カメラを開始できません: ${error.message}` : 'カメラを開始できません') }
  }
  function startRecording() {
    if (!cameraStream) return
    try {
      const mediaRecorder = createRecording(cameraStream, blob => { setRecordedBlob(blob); setRecordingState('stopped'); setRecordingMessage(blob.size ? '録画を保存できます' : '録画データが空です'); const url=URL.createObjectURL(blob); setSource(url); setTimeout(()=>{ if(video.current){video.current.srcObject=null;video.current.src=url;video.current.load()} }) })
      mediaRecorder.addEventListener('error', event => setRecordingMessage(`録画エラー: ${(event as ErrorEvent).message || '録画を継続できません'}`))
      recorder.current=mediaRecorder; recordingStartedAt.current=Date.now(); setRecordingSeconds(0); setRecordingState('recording'); setRecordingMessage(''); liveFrames.current=[]; lastLiveCapture.current=0; mediaRecorder.start(1000)
    } catch (error) { setRecordingMessage(error instanceof Error ? `録画を開始できません: ${error.message}` : '録画を開始できません'); return }
    if (liveEnabledRef.current && video.current) { try { liveFrames.current.push(captureLiveFrame(video.current,0,team,perspective)) } catch { /* recording does not depend on analysis */ } }
    liveTimer.current=window.setInterval(()=>{
      const elapsed=Math.floor((Date.now()-recordingStartedAt.current)/1000); setRecordingSeconds(elapsed)
      if (liveEnabledRef.current && video.current && shouldCaptureFrame(elapsed,lastLiveCapture.current)) {
        lastLiveCapture.current=elapsed
        try { liveFrames.current.push(captureLiveFrame(video.current,elapsed,team,perspective)); if(liveFrames.current.length>=4){liveQueue.current.push(liveFrames.current.splice(0))} } catch { /* camera may still be warming up; recording remains independent */ }
      }
    },1000)
  }
  function stopRecording() { if (liveTimer.current) window.clearInterval(liveTimer.current); liveTimer.current=null; recorder.current?.stop(); recorder.current=null; stopCamera(cameraStream); setCameraStream(null) }
  function switchFootageMode(mode:'file'|'live') { if(recordingState==='recording') return; stopCamera(cameraStream); setCameraStream(null); setFootageMode(mode) }
  async function saveRecordedVideo() { if(recordedBlob) { try { const method=await saveRecording(recordedBlob,recordingFilename(new Date(),recordedBlob.type)); setRecordingMessage(method==='picker'?'指定した場所に保存しました':'ダウンロードを開始しました') } catch(error) { if(!(error instanceof DOMException&&error.name==='AbortError'))setRecordingMessage('動画を保存できません') } } }
  function newRecording() { if(source) URL.revokeObjectURL(source); setSource(''); setRecordedBlob(null); setRecordingState('idle'); setRecordingSeconds(0); setLatestAnalysisTime(null); void startCamera() }

  function addMoment() {
    const item: Moment = { id: crypto.randomUUID(), time, perspective, rating, note: note.trim() || coachingAdvice(perspective, rating), createdAt: new Date().toISOString() }
    setMoments(v => [...v, item].sort((a,b) => a.time-b.time)); setNote('')
  }
  function enableDemo() { setDemo(true); setMoments(demoMoments); setTime(43); setDuration(92) }
  function jump(second: number) { setTime(second); if (video.current) video.current.currentTime = second }
  async function persist() { const g = game(); await saveGame(g); setSaved(await loadGames()) }
  function exportAs(kind: 'json'|'csv'|'html'|'pdf') { const g=game(); if(kind==='pdf'){ const w=window.open(); if(w){w.document.write(toHtml(g));w.document.close();w.print()} return } const data=kind==='json'?JSON.stringify(g,null,2):kind==='csv'?toCsv(g):toHtml(g); download(data, kind==='json'?'application/json':kind==='csv'?'text/csv':'text/html',`game-review.${kind}`) }
  async function analyzeVideo() {
    setAiError(''); setAiResult(null); setLatestAnalysisTime(null); setShowTimeout(false)
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

  return <div className="app">
    <header><div className="brand"><div className="ball">◉</div><div><strong>TACTICAL <i>ANALYZER</i></strong><small>BASKETBALL GAME INTELLIGENCE</small></div></div>
      <nav><button className={view==='analyze'?'active':''} onClick={()=>setView('analyze')}>LIVE ANALYSIS</button><button className={view==='review'?'active':''} onClick={()=>{if(recordingState==='recording')stopRecording();else{stopCamera(cameraStream);setCameraStream(null)};setView('review')}}>GAME REVIEW <span>{moments.length}</span></button></nav>
      <div className="header-actions"><button className={`demo ${demo?'on':''}`} onClick={enableDemo}><b>●</b> DEMO MODE</button><button className="save" onClick={persist}>⌑ 保存</button></div>
    </header>

    {view==='analyze' ? <main>
      <section className="video-panel panel">
        <div className="video-top"><span className="live-dot">●</span><b> GAME FOOTAGE</b><span className="timecode">{formatTime(time)} / {formatTime(duration)}</span></div>
        <div className="footage-tabs"><button className={footageMode==='file'?'active':''} onClick={()=>switchFootageMode('file')}>保存動画を解析</button><button className={footageMode==='live'?'active':''} onClick={()=>switchFootageMode('live')}>LIVE CAMERA ・ リアル撮影</button></div>
        <div className="video-stage">
          {footageMode==='live' ? <>{(cameraStream||source)?<video ref={video} src={source||undefined} muted={!!cameraStream} playsInline autoPlay={!!cameraStream} controls={!cameraStream} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>{if(!cameraStream)setDuration(e.currentTarget.duration)}}/>:<div className="empty-video"><div className="court"><span>●</span></div><h2>LIVE CAMERA</h2><p>背面カメラを優先して試合を撮影</p><button className="camera-start" onClick={startCamera}>カメラ開始</button></div>}</> : source ? <video ref={video} src={source} controls onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} /> : <div className="empty-video"><div className="court"><span>＋</span></div><h2>試合映像を読み込む</h2><p>MP4・MOV・WebM / ファイルは端末内だけで処理されます</p><label>映像を選択<input type="file" accept="video/*" onChange={e=>{const f=e.target.files?.[0];if(f)setSource(URL.createObjectURL(f))}} /></label><button onClick={enableDemo}>サンプルで試す →</button></div>}
          {recordingState==='recording'&&<div className="rec-indicator"><b>● REC</b> {formatTime(recordingSeconds)} <span>AI ANALYSIS {liveAnalysisEnabled?'ON':'OFF'}</span></div>}
          {demo && !source && <div className="demo-watermark">DEMO FOOTAGE</div>}
        </div>
        {footageMode==='live'&&<div className="live-controls"><button className="ai-toggle" onClick={()=>setLiveAnalysisEnabled(v=>!v)}>AI解析：{liveAnalysisEnabled?'ON':'OFF'}</button>{cameraStream&&recordingState!=='recording'&&<button className="record-start" onClick={startRecording}>● 録画開始</button>}{recordingState==='recording'&&<button className="record-stop" onClick={stopRecording}>■ 録画停止</button>}{latestAnalysisTime!==null&&<span>最新解析：{formatTime(latestAnalysisTime)}</span>}</div>}
        {footageMode==='live'&&recordedBlob&&<div className="recorded-actions"><button onClick={()=>void video.current?.play()}>▶ 録画を確認</button><button onClick={analyzeVideo}>AI解析する</button><button onClick={saveRecordedVideo}>動画を保存</button><button onClick={newRecording}>新しく撮影</button></div>}
        {footageMode==='live'&&recordingMessage&&<div className="recording-message" role="status">{recordingMessage}</div>}
        <div className="scrubber"><span>{formatTime(time)}</span><input aria-label="動画時刻" type="range" min="0" max={duration} value={time} onChange={e=>jump(+e.target.value)} /><span>{formatTime(duration)}</span></div>
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

      {aiResult&&<GamePlan result={aiResult} analysisTime={latestAnalysisTime} showTimeout={showTimeout} onTimeout={()=>setShowTimeout(v=>!v)} onAddTimeline={addAiEvidence}/>}

      <aside className={`coach ${rating==='GOOD PLAY'?'good':rating.toLowerCase()}`}><div className="coach-label">⚡ 簡易ルールアドバイス</div><div className="coach-body"><span className="quote">“</span><p>{coachingAdvice(perspective,rating)}</p><div><b>{perspective}</b><span>{rating}</span></div></div></aside>
    </main> : <Review moments={moments} stats={stats} saved={saved} onJump={s=>{setView('analyze');setTimeout(()=>jump(s))}} onExport={exportAs} />}
    <footer><span>TACTICAL ANALYZER · OFFLINE READY</span><span>AI解析時は必要な抽出フレームのみを送信します</span></footer>
  </div>
}

const confidenceLabel: Record<Confidence,string> = { high:'高', medium:'中', low:'低', unknown:'判断困難' }
function Items({items}:{items:AnalysisItem[]}) { return items.length?<ul>{items.slice(0,3).map((item,i)=><li key={i}><span>{item.text}</span><em className={`confidence ${item.confidence}`}>{confidenceLabel[item.confidence]}</em></li>)}</ul>:<p className="unknown">判断困難</p> }
function GamePlan({result,analysisTime,showTimeout,onTimeout,onAddTimeline}:{result:AiAnalysis;analysisTime:number|null;showTimeout:boolean;onTimeout:()=>void;onAddTimeline:()=>void}) {
  return <section className="game-plan panel"><div className="plan-head"><div><small>AI VIDEO ANALYSIS{analysisTime!==null&&` · 解析時刻 ${formatTime(analysisTime)}`}</small><h2>AI GAME PLAN</h2></div><em className={`confidence ${result.confidence}`}>総合信頼度 {confidenceLabel[result.confidence]}</em></div>
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
