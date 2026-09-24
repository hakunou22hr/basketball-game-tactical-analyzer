import { useEffect, useMemo, useRef, useState } from 'react'
import { coachingAdvice, formatTime, summarize } from './analysis'
import { loadGames, saveGame } from './db'
import { download, toCsv, toHtml } from './export'
import type { Game, Moment, Perspective, Rating } from './types'

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
  const stats = useMemo(() => summarize(moments), [moments])
  const game = (): Game => ({ id: 'current-game', title: 'ゲーム分析', team, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), moments })
  useEffect(() => { loadGames().then(setSaved).catch(() => {}) }, [])
  useEffect(() => () => { if (source) URL.revokeObjectURL(source) }, [source])

  function addMoment() {
    const item: Moment = { id: crypto.randomUUID(), time, perspective, rating, note: note.trim() || coachingAdvice(perspective, rating), createdAt: new Date().toISOString() }
    setMoments(v => [...v, item].sort((a,b) => a.time-b.time)); setNote('')
  }
  function enableDemo() { setDemo(true); setMoments(demoMoments); setTime(43); setDuration(92) }
  function jump(second: number) { setTime(second); if (video.current) video.current.currentTime = second }
  async function persist() { const g = game(); await saveGame(g); setSaved(await loadGames()) }
  function exportAs(kind: 'json'|'csv'|'html'|'pdf') { const g=game(); if(kind==='pdf'){ const w=window.open(); if(w){w.document.write(toHtml(g));w.document.close();w.print()} return } const data=kind==='json'?JSON.stringify(g,null,2):kind==='csv'?toCsv(g):toHtml(g); download(data, kind==='json'?'application/json':kind==='csv'?'text/csv':'text/html',`game-review.${kind}`) }

  return <div className="app">
    <header><div className="brand"><div className="ball">◉</div><div><strong>TACTICAL <i>ANALYZER</i></strong><small>BASKETBALL GAME INTELLIGENCE</small></div></div>
      <nav><button className={view==='analyze'?'active':''} onClick={()=>setView('analyze')}>LIVE ANALYSIS</button><button className={view==='review'?'active':''} onClick={()=>setView('review')}>GAME REVIEW <span>{moments.length}</span></button></nav>
      <div className="header-actions"><button className={`demo ${demo?'on':''}`} onClick={enableDemo}><b>●</b> DEMO MODE</button><button className="save" onClick={persist}>⌑ 保存</button></div>
    </header>

    {view==='analyze' ? <main>
      <section className="video-panel panel">
        <div className="video-top"><span className="live-dot">●</span><b> GAME FOOTAGE</b><span className="timecode">{formatTime(time)} / {formatTime(duration)}</span></div>
        <div className="video-stage">
          {source ? <video ref={video} src={source} controls onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} /> : <div className="empty-video"><div className="court"><span>＋</span></div><h2>試合映像を読み込む</h2><p>MP4・MOV・WebM / ファイルは端末内だけで処理されます</p><label>映像を選択<input type="file" accept="video/*" onChange={e=>{const f=e.target.files?.[0];if(f)setSource(URL.createObjectURL(f))}} /></label><button onClick={enableDemo}>サンプルで試す →</button></div>}
          {demo && !source && <div className="demo-watermark">DEMO FOOTAGE</div>}
        </div>
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

      <aside className={`coach ${rating==='GOOD PLAY'?'good':rating.toLowerCase()}`}><div className="coach-label">⚡ 今すぐ選手に伝える</div><div className="coach-body"><span className="quote">“</span><p>{coachingAdvice(perspective,rating)}</p><div><b>{perspective}</b><span>{rating}</span></div></div></aside>
    </main> : <Review moments={moments} stats={stats} saved={saved} onJump={s=>{setView('analyze');setTimeout(()=>jump(s))}} onExport={exportAs} />}
    <footer><span>TACTICAL ANALYZER · OFFLINE READY</span><span>映像データは外部へ送信されません</span></footer>
  </div>
}

function Review({moments,stats,saved,onJump,onExport}:{moments:Moment[];stats:ReturnType<typeof summarize>;saved:Game[];onJump:(n:number)=>void;onExport:(k:'json'|'csv'|'html'|'pdf')=>void}) {
  return <main className="review-page"><div className="review-title"><div><small>POST GAME</small><h1>試合後レビュー</h1><p>記録した瞬間から、次のゲームプランを組み立てる。</p></div><div className="exports">{(['pdf','html','json','csv'] as const).map(k=><button key={k} onClick={()=>onExport(k)}>↓ {k.toUpperCase()}</button>)}</div></div>
    <div className="stat-grid"><article><span>記録した瞬間</span><b>{moments.length}</b><small>MOMENTS</small></article><article className="green"><span>良いプレー</span><b>{stats.good}</b><small>GOOD PLAY</small></article><article className="yellow"><span>要チェック</span><b>{stats.check}</b><small>CHECK</small></article><article className="red"><span>改善ポイント</span><b>{stats.fix}</b><small>FIX</small></article></div>
    <section className="review-list panel"><h2>すべてのプレー</h2>{moments.length?moments.map(m=><button key={m.id} onClick={()=>onJump(m.time)}><time>{formatTime(m.time)}</time><b className={m.rating==='GOOD PLAY'?'good':m.rating.toLowerCase()}>{m.rating}</b><span>{m.perspective}</span><p>{m.note}</p><em>映像へ →</em></button>):<div className="empty-list"><b>レビューする記録がありません</b><span>LIVE ANALYSISでプレーを記録してください</span></div>}</section>
    {saved.length>0&&<p className="saved-info">端末に保存済みの試合: {saved.length}件</p>}
  </main>
}
