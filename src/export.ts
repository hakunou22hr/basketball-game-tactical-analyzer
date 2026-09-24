import type { Game } from './types'
import { formatTime } from './analysis'
const esc = (s: string) => `"${s.replaceAll('"', '""')}"`
export const toCsv = (g: Game) => ['time,perspective,rating,note', ...g.moments.map(m => [formatTime(m.time), m.perspective, m.rating, m.note].map(esc).join(','))].join('\n')
export const toHtml = (g: Game) => `<!doctype html><meta charset="utf-8"><title>${g.title}</title><style>body{font:16px system-ui;max-width:900px;margin:40px auto;color:#18212f}h1{border-bottom:3px solid #ff5b28}li{margin:12px}</style><h1>${g.title}</h1><p>対象: ${g.team}チーム / ${new Date(g.createdAt).toLocaleString('ja-JP')}</p><h2>レビュー</h2><ol>${g.moments.map(m => `<li><b>${formatTime(m.time)} · ${m.rating}</b> [${m.perspective}] ${m.note}</li>`).join('')}</ol>`
export function download(data: string, type: string, filename: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = filename; a.click(); URL.revokeObjectURL(a.href) }
