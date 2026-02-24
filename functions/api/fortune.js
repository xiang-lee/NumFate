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
  const metrics = collectMetrics(numbers)
  const schema = {
    title: 'string, 8-18字',
    overview: 'string, 60-160字',
    destiny: 'string, 80-220字',
    weekly: 'string, 80-220字',
    blessings: ['string', 'string', 'string'],
    cautions: ['string', 'string', 'string'],
    ritual: 'string, 40-140字',
    sigils: ['string', 'string', 'string'],
  }

  const systemPrompt = [
    '你是高阶玄幻命理师，擅长从数字中推演命势。',
    '你必须先在内部完成多步推演：数理拆解 -> 象意映射 -> 现实情境 -> 可执行建议。',
    '不要展示推理过程，只输出最终结论。',
    '写作要求：中文、具象、有画面感、避免空话、避免模板化。',
    '结果必须与输入数字强绑定，不同数字应明显不同。',
    '只输出 JSON 对象，禁止 markdown 和额外文本。',
  ].join('\n')

  const userPrompt = [
    `用户数字: ${numbers.join(', ')}`,
    `已计算特征: ${JSON.stringify(metrics)}`,
    `按此结构输出: ${JSON.stringify(schema)}`,
    'blessings/cautions/sigils 各必须严格 3 条。',
  ].join('\n')

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const content = await requestCompletion({
      apiBase,
      token,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9 + attempt * 0.05,
      maxTokens: 1800,
      responseFormat: { type: 'json_object' },
    })

    const repaired = await repairJsonIfNeeded({ apiBase, token, model, content })
    const parsed = parseJsonObject(repaired)
    if (!parsed) {
      continue
    }

    const normalized = normalizeFortune(parsed)
    if (normalized) {
      return normalized
    }
  }

  throw new Error('AI could not produce a valid fortune result. Please retry.')
}

async function requestCompletion({ apiBase, token, model, messages, temperature, maxTokens, responseFormat }) {
  const response = await fetch(`${apiBase}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      top_p: 0.95,
      response_format: responseFormat,
      messages,
    }),
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

  return content
}

async function repairJsonIfNeeded({ apiBase, token, model, content }) {
  if (parseJsonObject(content)) {
    return content
  }

  return requestCompletion({
    apiBase,
    token,
    model,
    temperature: 0.2,
    maxTokens: 1200,
    responseFormat: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: '你是 JSON 修复器。将输入内容转换为合法 JSON 对象，只输出 JSON。不得增删字段。',
      },
      {
        role: 'user',
        content,
      },
    ],
  })
}

function parseJsonObject(value) {
  const normalized = value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(normalized)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    const match = normalized.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[0])
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

function normalizeFortune(parsed) {
  const title = cleanText(parsed.title)
  const overview = cleanText(parsed.overview)
  const destiny = cleanText(parsed.destiny)
  const weekly = cleanText(parsed.weekly)
  const ritual = cleanText(parsed.ritual)
  const blessings = cleanList(parsed.blessings)
  const cautions = cleanList(parsed.cautions)
  const sigils = cleanList(parsed.sigils)

  if (
    title.length < 8 ||
    overview.length < 36 ||
    destiny.length < 40 ||
    weekly.length < 40 ||
    ritual.length < 20 ||
    blessings.length !== 3 ||
    cautions.length !== 3 ||
    sigils.length !== 3
  ) {
    return null
  }

  return { title, overview, destiny, weekly, blessings, cautions, ritual, sigils }
}

function cleanText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function cleanList(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 3)
}

function collectMetrics(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b)
  const sum = numbers.reduce((acc, n) => acc + n, 0)
  const mean = sum / numbers.length
  const median =
    numbers.length % 2 === 1
      ? sorted[(numbers.length - 1) / 2]
      : (sorted[numbers.length / 2 - 1] + sorted[numbers.length / 2]) / 2
  const spread = sorted[sorted.length - 1] - sorted[0]
  const oddCount = numbers.filter((n) => Math.abs(Math.round(n)) % 2 === 1).length
  const evenCount = numbers.length - oddCount
  const primeCount = numbers.filter((n) => isPrime(Math.abs(Math.round(n)))).length
  const digitalRoot = ((Math.abs(Math.round(sum)) - 1) % 9 + 9) % 9 + 1

  return {
    count: numbers.length,
    sum: Number(sum.toFixed(4)),
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    spread: Number(spread.toFixed(4)),
    oddCount,
    evenCount,
    primeCount,
    digitalRoot,
  }
}

function isPrime(value) {
  if (!Number.isInteger(value) || value < 2) return false
  for (let i = 2; i * i <= value; i += 1) {
    if (value % i === 0) return false
  }
  return true
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
