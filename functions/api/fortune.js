const DEFAULT_API_BASE = 'https://space.ai-builders.com/backend'
const DEFAULT_MODEL = 'gemini-3-flash-preview'

export async function onRequestPost(context) {
  try {
    const body = await context.request.json()
    const numbers = sanitizeNumbers(body?.numbers)

    if (numbers.length < 2 || numbers.length > 12) {
      return json({ error: 'Please provide between 2 and 12 numbers.' }, 400)
    }

    const token = context.env.AI_BUILDER_TOKEN
    if (!token) {
      return json({ error: 'AI token is not configured.' }, 500)
    }

    const apiBase = (context.env.AI_BUILDER_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '')
    const model = context.env.AI_BUILDER_MODEL || DEFAULT_MODEL
    const completion = await requestFortune({ apiBase, token, model, numbers })

    return json(completion)
  } catch (error) {
    return json({ error: error.message || 'Unexpected error.' }, 500)
  }
}

function sanitizeNumbers(input) {
  if (!Array.isArray(input)) return []
  return input
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Number(value.toFixed(6)))
}

async function requestFortune({ apiBase, token, model, numbers }) {
  const prompt = [
    '你是一位玄幻世界的命理师，擅长把数字映射为命运图景。',
    '请根据用户数字生成中文结果，语气神秘但积极，不要恐吓。',
    '必须返回 JSON，字段如下：',
    '{',
    '  "title": "12字以内标题",',
    '  "overview": "2-3句总体判断",',
    '  "destiny": "主命格解读，2-3句",',
    '  "weekly": "未来七日运势，2-3句",',
    '  "blessings": ["机缘建议1", "机缘建议2", "机缘建议3"],',
    '  "cautions": ["避坑提醒1", "避坑提醒2", "避坑提醒3"],',
    '  "ritual": "可执行的开运小仪式，1-2句"',
    '}',
    '不要输出 markdown，不要有额外字段。',
  ].join('\n')

  const payload = {
    model,
    temperature: 0.9,
    max_tokens: 900,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `用户数字: ${numbers.join(', ')}` },
    ],
  }

  const response = await fetch(`${apiBase}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`AI API error (${response.status}): ${text.slice(0, 200)}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('AI API returned empty content.')
  }

  const parsed = safeParseJson(content)
  if (!parsed) {
    return {
      title: '命运之卷',
      overview: content.slice(0, 180),
      destiny: content,
      weekly: '星象晦明未定，建议明日再启命盘。',
      blessings: ['晨起静心三分钟', '与重要之人坦诚沟通', '晚间记录灵感'],
      cautions: ['避免冲动承诺', '暂缓高风险决定', '减少熬夜耗神'],
      ritual: '将今天最在意的目标写在纸上，置于书桌左侧三日。',
    }
  }

  return {
    title: ensureString(parsed.title, '命运之卷', 20),
    overview: ensureString(parsed.overview, '星图流转，天机已显。', 220),
    destiny: ensureString(parsed.destiny, '你的命格正在转旺。', 260),
    weekly: ensureString(parsed.weekly, '未来七日宜稳中求进。', 260),
    blessings: ensureArray(parsed.blessings, ['顺势而行', '主动结缘', '保持节律']),
    cautions: ensureArray(parsed.cautions, ['避免急躁', '远离口舌', '戒除拖延']),
    ritual: ensureString(parsed.ritual, '今日子时前写下心愿，明早再读一遍。', 180),
  }
}

function safeParseJson(content) {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function ensureString(value, fallback, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback
  }
  return value.trim().slice(0, maxLength)
}

function ensureArray(value, fallback) {
  if (!Array.isArray(value)) return fallback
  const cleaned = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 3)
  if (cleaned.length === 0) return fallback
  return cleaned
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
