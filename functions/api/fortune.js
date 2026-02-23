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
  const sharedStyle = [
    '你是玄幻命理师，语言神秘、有画面感，但保持积极。',
    '严格按要求输出，不要 markdown，不要编号，不要解释。',
    `用户数字: ${numbers.join(', ')}`,
  ].join('\n')

  const [title, overview, destiny, weekly, blessingsRaw, cautionsRaw, ritual] = await Promise.all([
    askField({
      apiBase,
      token,
      model,
      style: sharedStyle,
      instruction: '输出一个命盘标题，12字以内。',
      fallback: '命运之卷',
      maxLength: 20,
    }),
    askField({
      apiBase,
      token,
      model,
      style: sharedStyle,
      instruction: '输出总体判断，2句以内，60字以内。',
      fallback: '星图流转，天机已显。',
      maxLength: 90,
    }),
    askField({
      apiBase,
      token,
      model,
      style: sharedStyle,
      instruction: '输出主命格解读，2句以内，80字以内。',
      fallback: '你的命格正在转旺。',
      maxLength: 120,
    }),
    askField({
      apiBase,
      token,
      model,
      style: sharedStyle,
      instruction: '输出未来七日运势，2句以内，80字以内。',
      fallback: '未来七日宜稳中求进。',
      maxLength: 120,
    }),
    askField({
      apiBase,
      token,
      model,
      style: sharedStyle,
      instruction: '输出3条机缘建议，用|分隔，单条不超过12字。示例: 顺势而行|主动结缘|保持节律',
      fallback: '顺势而行|主动结缘|保持节律',
      maxLength: 120,
    }),
    askField({
      apiBase,
      token,
      model,
      style: sharedStyle,
      instruction: '输出3条避坑提醒，用|分隔，单条不超过12字。示例: 避免急躁|远离口舌|戒除拖延',
      fallback: '避免急躁|远离口舌|戒除拖延',
      maxLength: 120,
    }),
    askField({
      apiBase,
      token,
      model,
      style: sharedStyle,
      instruction: '输出开运小仪式，1-2句，60字以内。',
      fallback: '今日子时前写下心愿，明早再读一遍。',
      maxLength: 90,
    }),
  ])

  const base = buildDeterministicFortune(numbers)
  const blessings = toItems(blessingsRaw, base.blessings)
  const cautions = toItems(cautionsRaw, base.cautions)

  return {
    title: pickText(title, base.title, 8),
    overview: pickText(overview, base.overview, 24),
    destiny: pickText(destiny, base.destiny, 28),
    weekly: pickText(weekly, base.weekly, 26),
    blessings: blessings.map((item, index) => pickText(item, base.blessings[index], 4)),
    cautions: cautions.map((item, index) => pickText(item, base.cautions[index], 4)),
    ritual: pickText(ritual, base.ritual, 18),
  }
}

function buildDeterministicFortune(numbers) {
  const sum = numbers.reduce((total, value) => total + value, 0)
  const average = sum / numbers.length
  const root = digitalRoot(Math.round(Math.abs(sum)))
  const spread = Math.max(...numbers) - Math.min(...numbers)
  const rootNames = {
    1: '天启开锋',
    2: '月镜同心',
    3: '青木生辉',
    4: '玄土定鼎',
    5: '星河游侠',
    6: '曜火成仪',
    7: '雾海灵谕',
    8: '金阙聚势',
    9: '九曜归一',
  }
  const title = `${rootNames[root] || '命运之卷'}命盘`

  return {
    title,
    overview: `你的数字总和为 ${sum.toFixed(2)}，命盘主数落在 ${root}。这代表近期气机由散转聚，旧线索会重新串联，适合把长期目标重新立序。`,
    destiny: `你属于“${rootNames[root] || '命运之卷'}”型命格，擅长在复杂局面中识别关键机会。数列振幅 ${spread.toFixed(2)}，意味着你越是主动整合资源，越能在竞争中占先。`,
    weekly: `未来七日，前半段宜稳步推进、补齐细节；后半段适合对外沟通与争取支持。平均数 ${average.toFixed(2)} 显示贵人运偏强，真诚表达会带来回响。`,
    blessings: ['晨起先定一件要事', '主动联系关键伙伴', '夜间复盘三行心得'],
    cautions: ['避免情绪化决策', '不要同时开太多战线', '谨慎处理口头承诺'],
    ritual: `今晚用纸写下一个三日目标与一个七日目标，折叠置于枕边。明晨读出并立即完成第一步，命势会更快成形。`,
  }
}

function digitalRoot(number) {
  const safe = Math.max(1, Math.abs(Math.trunc(number)))
  return ((safe - 1) % 9) + 1
}

function pickText(value, fallback, minLength) {
  if (typeof value !== 'string') return fallback
  const cleaned = value.trim()
  if (cleaned.length < minLength) return fallback
  if (/[，,、:：;；(（]$/.test(cleaned)) return fallback
  return cleaned
}

async function askField({ apiBase, token, model, style, instruction, fallback, maxLength }) {
  try {
    const response = await fetch(`${apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 260,
        messages: [
          { role: 'system', content: style },
          { role: 'user', content: instruction },
        ],
      }),
    })

    if (!response.ok) {
      return fallback
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      return fallback
    }

    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    if (!cleaned) {
      return fallback
    }

    return cleaned.slice(0, maxLength)
  } catch {
    return fallback
  }
}

function toItems(value, fallback) {
  if (typeof value !== 'string') {
    return fallback
  }

  const items = value
    .split(/[|｜,，、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)

  if (items.length === 0) {
    return fallback
  }

  while (items.length < 3) {
    items.push(fallback[items.length])
  }

  return items
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
