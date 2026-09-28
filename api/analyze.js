const OPENAI_URL = 'https://api.openai.com/v1/responses'

const confidence = { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] }
const item = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    confidence,
  },
  required: ['text', 'confidence'],
  additionalProperties: false,
}
const items = { type: 'array', items: item, maxItems: 3 }
const evidenceItem = {
  type: 'object',
  properties: {
    timestamp: { type: 'number' },
    tag: { type: 'string', enum: ['AI GOOD', 'AI CHECK', 'AI FIX', 'AI KEY PLAY'] },
    description: { type: 'string' },
    confidence,
  },
  required: ['timestamp', 'tag', 'description', 'confidence'],
  additionalProperties: false,
}

const analysisSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    confidence,
    working: items,
    priorityFix: items,
    opponentCounter: items,
    continueOffense: items,
    offense: {
      type: 'object',
      properties: {
        working: items,
        problems: items,
        scoringSources: items,
        repeatPatterns: items,
      },
      required: ['working', 'problems', 'scoringSources', 'repeatPatterns'],
      additionalProperties: false,
    },
    defense: {
      type: 'object',
      properties: {
        working: items,
        problems: items,
        keyOpponent: { anyOf: [item, { type: 'null' }] },
        recommendations: items,
      },
      required: ['working', 'problems', 'keyOpponent', 'recommendations'],
      additionalProperties: false,
    },
    nextThreePossessions: items,
    timeoutMessage: { type: 'string' },
    evidence: { type: 'array', items: evidenceItem, maxItems: 12 },
  },
  required: [
    'summary',
    'confidence',
    'working',
    'priorityFix',
    'opponentCounter',
    'continueOffense',
    'offense',
    'defense',
    'nextThreePossessions',
    'timeoutMessage',
    'evidence',
  ],
  additionalProperties: false,
}

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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function outputText(response) {
  if (typeof response.output_text === 'string') return response.output_text
  for (const entry of response.output || []) {
    for (const content of entry.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

function validRequest(body) {
  if (!body || typeof body !== 'object') return false
  if (!['濃色', '淡色'].includes(body.team)) return false
  if (typeof body.perspective !== 'string') return false
  if (!body.range || typeof body.range.start !== 'number' || typeof body.range.end !== 'number') return false
  if (!Array.isArray(body.frames) || body.frames.length < 1 || body.frames.length > 14) return false
  return body.frames.every(frame =>
    frame &&
    typeof frame.timestamp === 'number' &&
    typeof frame.image === 'string' &&
    /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(frame.image) &&
    frame.image.length < 1_500_000
  )
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'AI backend is not configured: OPENAI_API_KEY is missing.' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  if (!validRequest(body)) return res.status(400).json({ error: 'Invalid analysis request.' })

  const content = [
    {
      type: 'input_text',
      text:
        (typeof body.instructions === 'string' ? body.instructions : '') +
        '\n\n重要: 以下の画像は時系列順です。各画像の直前の timestamp を根拠時刻として扱い、見えない得点・背番号・意図は推測しないでください。',
    },
  ]
  for (const frame of body.frames) {
    content.push({ type: 'input_text', text: `timestamp: ${Number(frame.timestamp).toFixed(2)} sec` })
    content.push({ type: 'input_image', image_url: frame.image, detail: 'auto' })
  }

  const openaiResponse = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.6',
      reasoning: { effort: 'low' },
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'basketball_game_plan',
          strict: true,
          schema: analysisSchema,
        },
      },
    }),
  })

  const payload = await openaiResponse.json()
  if (!openaiResponse.ok) {
    const message = payload?.error?.message || 'OpenAI API request failed.'
    return res.status(openaiResponse.status).json({ error: message })
  }

  const text = outputText(payload)
  if (!text) return res.status(502).json({ error: 'AI response did not contain output text.' })

  try {
    const analysis = JSON.parse(text)
    return res.status(200).json({ analysis })
  } catch {
    return res.status(502).json({ error: 'AI response was not valid JSON.' })
  }
}
