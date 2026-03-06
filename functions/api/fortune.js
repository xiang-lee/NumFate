const DEFAULT_API_BASE = 'https://space.ai-builders.com/backend'
const DEFAULT_MODEL = 'gemini-3-flash-preview'

export async function onRequestPost(context) {
  try {
    const { body, errorResponse } = await parseRequestBody(context.request)
    if (errorResponse) {
      return errorResponse
    }

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

async function parseRequestBody(request) {
  try {
    const body = await request.json()
    return { body, errorResponse: null }
  } catch {
    return {
      body: null,
      errorResponse: json({ error: 'Request body must be valid JSON.' }, 400),
    }
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

  let content
  try {
    content = await requestCompletion({
      apiBase,
      token,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.95,
      maxTokens: 1000,
      responseFormat: { type: 'json_object' },
      timeoutMs: 45000,
    })
  } catch (error) {
    if (!String(error?.message || '').includes('timeout')) {
      throw error
    }

    content = await requestCompletion({
      apiBase,
      token,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${userPrompt}\n请缩短内容，控制在 500 字以内。` },
      ],
      temperature: 0.8,
      maxTokens: 700,
      responseFormat: { type: 'json_object' },
      timeoutMs: 30000,
    })
  }

  const parsed = parseJsonObject(content)
  const normalized = parsed ? normalizeFortune(parsed) : null
  if (normalized) {
    return normalized
  }

  const repaired = await requestCompletion({
    apiBase,
    token,
    model,
    temperature: 0.35,
    maxTokens: 1100,
    timeoutMs: 20000,
    responseFormat: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '你是 JSON 结构修复器。将输入内容重写为合法 JSON 对象，字段必须包含 title,overview,destiny,weekly,blessings,cautions,ritual,sigils。只输出 JSON。',
      },
      {
        role: 'user',
        content,
      },
    ],
  })

  const repairedParsed = parseJsonObject(repaired)
  const repairedNormalized = repairedParsed ? normalizeFortune(repairedParsed) : null
  if (repairedNormalized) {
    return repairedNormalized
  }

  const rawFallback = normalizeRawFortune(`${content}\n${repaired}`)
  if (rawFallback) {
    return rawFallback
  }

  throw new Error('AI could not produce a valid fortune result in time. Please retry.')
}

async function requestCompletion({ apiBase, token, model, messages, temperature, maxTokens, responseFormat, timeoutMs }) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs)

  let response
  try {
    response = await fetch(`${apiBase}/v1/chat/completions`, {
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
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('AI request timeout. Please retry.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

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
  const sourceText = mergedText(parsed)
  const title = pickText([parsed.title, sentenceAt(sourceText, 0), sentenceAt(sourceText, 1)], 2, 24)
  const overview = pickText([parsed.overview, sentenceBlock(sourceText, 0, 2), sourceText], 8, 260)
  const destiny = pickText([parsed.destiny, sentenceBlock(sourceText, 2, 4), sourceText], 8, 320)
  const weekly = pickText([parsed.weekly, sentenceBlock(sourceText, 4, 6), sourceText], 8, 320)
  const ritual = pickText([parsed.ritual, sentenceBlock(sourceText, 6, 8), sourceText], 8, 220)
  const blessings = normalizeList(parsed.blessings, sourceText)
  const cautions = normalizeList(parsed.cautions, sourceText)
  const sigils = normalizeList(parsed.sigils, sourceText)

  if (
    title.length < 2 ||
    overview.length < 8 ||
    destiny.length < 8 ||
    weekly.length < 8 ||
    ritual.length < 8 ||
    blessings.length !== 3 ||
    cautions.length !== 3 ||
    sigils.length !== 3
  ) {
    return null
  }

  return { title, overview, destiny, weekly, blessings, cautions, ritual, sigils }
}

function normalizeRawFortune(raw) {
  const text = cleanText(raw)
  if (!text) return null

  const title = sentenceAt(text, 0).slice(0, 24)
  const overview = sentenceBlock(text, 0, 2)
  const destiny = sentenceBlock(text, 2, 5)
  const weekly = sentenceBlock(text, 5, 8)
  const ritual = sentenceBlock(text, 8, 10)
  const list = listFromText(text)

  if (!title || !overview || !destiny || !weekly || !ritual || list.length === 0) {
    return null
  }

  return {
    title,
    overview,
    destiny,
    weekly,
    blessings: completeThree(list),
    cautions: completeThree([...list].reverse()),
    ritual,
    sigils: completeThree(list.map((item) => item.slice(0, 12))),
  }
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

function normalizeList(value, sourceText) {
  const items = cleanList(value)
  if (items.length === 0 && typeof value === 'string') {
    items.push(...listFromText(value))
  }
  if (items.length === 0) {
    items.push(...listFromText(sourceText))
  }
  if (items.length === 0) return []
  return completeThree(items)
}

function completeThree(items) {
  const output = items.filter(Boolean).slice(0, 3)
  while (output.length < 3) {
    output.push(output[output.length % output.length])
  }
  return output
}

function listFromText(text) {
  return cleanText(text)
    .split(/[。！？!?.;；，,、\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)
    .slice(0, 3)
}

function sentenceAt(text, index) {
  return sentences(text)[index] || ''
}

function sentenceBlock(text, start, end) {
  const group = sentences(text).slice(start, end).join('。').trim()
  return group || sentenceAt(text, start)
}

function sentences(text) {
  return cleanText(text)
    .split(/[。！？!?.]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function pickText(candidates, minLength, maxLength) {
  for (const candidate of candidates) {
    const cleaned = cleanText(candidate)
    if (cleaned.length >= minLength) {
      return cleaned.slice(0, maxLength)
    }
  }
  return ''
}

function mergedText(parsed) {
  const values = Object.values(parsed)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => cleanText(value))
    .filter(Boolean)
  return values.join('。')
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
