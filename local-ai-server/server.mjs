import { createServer as createHttpServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'

const here=fileURLToPath(new URL('.',import.meta.url)); const root=join(here,'..'); const dist=join(root,'dist')
export const DEFAULT_PORT=8787
const ALLOWED_ORIGINS = new Set([
  'https://hakunou22hr.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
])

export async function loadLocalEnv(path=join(here,'.env.local')) {
  try { for(const line of (await readFile(path,'utf8')).split(/\r?\n/)){ const match=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/); if(match && process.env[match[1]]===undefined) process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2') } } catch(error){ if(error.code!=='ENOENT') throw error }
}
export function lanAddresses(){ return Object.values(networkInterfaces()).flat().filter(value=>value && value.family==='IPv4' && !value.internal).map(value=>value.address) }
export function serverBanner(port=DEFAULT_PORT,addresses=lanAddresses()){ return `\n--------------------------------\nBasketball Tactical Analyzer\nAIサーバーを起動しました\n\nPC:\nhttp://localhost:${port}\n\niPhone/iPad:\n${addresses.map(ip=>`http://${ip}:${port}`).join('\n')||'LAN IPv4アドレスを確認できませんでした'}\n\nGitHub PagesをPCで使う場合も、この画面を開いたままにしてください。\n終了する場合はこの画面を閉じてください\n--------------------------------\n` }

const confidence={type:'string',enum:['high','medium','low','unknown']}
const item={type:'object',properties:{text:{type:'string'},confidence},required:['text','confidence'],additionalProperties:false}
const items={type:'array',items:item,maxItems:3}
const analysisSchema={type:'object',properties:{summary:{type:'string'},confidence,working:items,priorityFix:items,opponentCounter:items,continueOffense:items,offense:{type:'object',properties:{working:items,problems:items,scoringSources:items,repeatPatterns:items},required:['working','problems','scoringSources','repeatPatterns'],additionalProperties:false},defense:{type:'object',properties:{working:items,problems:items,keyOpponent:{anyOf:[item,{type:'null'}]},recommendations:items},required:['working','problems','keyOpponent','recommendations'],additionalProperties:false},nextThreePossessions:items,timeoutMessage:{type:'string'},evidence:{type:'array',maxItems:12,items:{type:'object',properties:{timestamp:{type:'number'},tag:{type:'string',enum:['AI GOOD','AI CHECK','AI FIX','AI KEY PLAY']},description:{type:'string'},confidence},required:['timestamp','tag','description','confidence'],additionalProperties:false}}},required:['summary','confidence','working','priorityFix','opponentCounter','continueOffense','offense','defense','nextThreePossessions','timeoutMessage','evidence'],additionalProperties:false}

function applyApiCors(req,res){
  const origin=String(req.headers.origin||'')
  const isLanOrigin=/^http:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?$/.test(origin)
  if(ALLOWED_ORIGINS.has(origin)||isLanOrigin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  res.setHeader('Access-Control-Allow-Private-Network','true')
}
function json(res,status,body){ res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body)) }
function validRequest(body){ return body && ['濃色','淡色'].includes(body.team) && typeof body.perspective==='string' && Number.isFinite(body.range?.start) && Number.isFinite(body.range?.end) && Array.isArray(body.frames) && body.frames.length>0 && body.frames.length<=14 && body.frames.every(frame=>Number.isFinite(frame?.timestamp) && typeof frame.image==='string' && /^data:image\/(jpeg|jpg);base64,/i.test(frame.image) && frame.image.length<1_500_000) }
function outputText(response){ if(typeof response.output_text==='string')return response.output_text; for(const output of response.output||[]) for(const content of output.content||[]) if(content.type==='output_text'&&typeof content.text==='string')return content.text; return '' }
function looksLikeAnalysis(value){ return value && typeof value.summary==='string' && Array.isArray(value.working) && value.offense && value.defense && Array.isArray(value.nextThreePossessions) && typeof value.timeoutMessage==='string' && Array.isArray(value.evidence) }
async function readBody(req){ const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20_000_000)throw new Error('too-large');chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
async function analyze(body,fetchImpl){
  const content=[{type:'input_text',text:`${body.instructions||''}\n\n画像は時系列順です。timestampを根拠時刻とし、読めない背番号や見えない結果は絶対に推測しないでください。`}]
  for(const frame of body.frames){content.push({type:'input_text',text:`timestamp: ${frame.timestamp.toFixed(2)} sec`},{type:'input_image',image_url:frame.image,detail:'auto'})}
  let response
  try { response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',input:[{role:'user',content}],text:{format:{type:'json_schema',name:'basketball_game_plan',strict:true,schema:analysisSchema}}})}) } catch { throw Object.assign(new Error('OpenAIへの接続ができません'),{status:502}) }
  const payload=await response.json().catch(()=>({})); if(!response.ok)throw Object.assign(new Error(payload?.error?.message||'OpenAIへの接続ができません'),{status:502})
  const text=outputText(payload);let result;try{result=JSON.parse(text)}catch{throw Object.assign(new Error('AIから不正な応答を受信しました'),{status:502})}if(!looksLikeAnalysis(result))throw Object.assign(new Error('AIから不正な応答を受信しました'),{status:502});return result
}
async function staticFile(req,res){
  let pathname=decodeURIComponent(new URL(req.url,'http://local').pathname); const prefix='/basketball-game-tactical-analyzer'; if(pathname.startsWith(prefix))pathname=pathname.slice(prefix.length)||'/'
  const relative=normalize(pathname).replace(/^(\.\.[/\\])+|^[/\\]+/g,''); let file=join(dist,relative||'index.html')
  try{if((await stat(file)).isDirectory())file=join(file,'index.html');const data=await readFile(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(data)}catch{try{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(join(dist,'index.html')))}catch{json(res,503,{error:'フロントエンドが未ビルドです。先に npm run build を実行してください。'})}}
}
export function createAppServer({fetchImpl=fetch}={}){ return createHttpServer(async(req,res)=>{try{
  if(req.url?.startsWith('/api/')){
    applyApiCors(req,res)
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  }
  if(req.url==='/api/health'&&req.method==='GET')return json(res,process.env.OPENAI_API_KEY?200:503,{ok:Boolean(process.env.OPENAI_API_KEY),ai:process.env.OPENAI_API_KEY?'ready':'api-key-missing'})
  if(req.url==='/api/analyze'&&req.method==='POST'){if(!process.env.OPENAI_API_KEY)return json(res,503,{error:'OpenAI APIキーが設定されていません'});const body=await readBody(req);if(!validRequest(body))return json(res,400,{error:'解析データが正しくありません'});return json(res,200,{analysis:await analyze(body,fetchImpl)})}
  if(req.url?.startsWith('/api/'))return json(res,404,{error:'APIが見つかりません'});if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'使用できない操作です'});return staticFile(req,res)
}catch(error){json(res,error.status||400,{error:error.message==='too-large'?'送信データが大きすぎます':error.message||'サーバーエラー'})}}) }

if(process.argv[1]===fileURLToPath(import.meta.url)){await loadLocalEnv();const port=Number(process.env.PORT)||DEFAULT_PORT;createAppServer().listen(port,'0.0.0.0',()=>console.log(serverBanner(port)))}
