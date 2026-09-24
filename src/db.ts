import type { Game } from './types'
const DB = 'tactical-analyzer'; const STORE = 'games'
const open = () => new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
export async function saveGame(game: Game) { const db = await open(); await new Promise<void>((resolve, reject) => { const r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(game); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error) }); db.close() }
export async function loadGames() { const db = await open(); const games = await new Promise<Game[]>((resolve, reject) => { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) }); db.close(); return games.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)) }
