function cors(req, res) {
  const origin = req.headers.origin || ''
  const configured = (process.env.ALLOWED_ORIGIN || '').replace(/\/$/, '')
  const sameOrigin = req.headers.host ? `https://${req.headers.host}` : ''
  const allowed = new Set([
    configured,
    sameOrigin,
    'https://hakunou22hr.github.io',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean))
  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  return res.status(process.env.OPENAI_API_KEY ? 200 : 503).json({
    ok: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-5.6',
  })
}
