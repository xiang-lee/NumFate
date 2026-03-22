export async function parseFortuneResponse(response) {
  const text = await response.text()
  const payload = parseJson(text)

  if (!response.ok) {
    return {
      payload: null,
      error: payload?.error || fallbackError(text, response.status),
    }
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { payload, error: null }
  }

  return {
    payload: null,
    error: '命盘结果解析失败，请稍后再试。',
  }
}

function parseJson(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return null

  try {
    return JSON.parse(normalized)
  } catch {
    return null
  }
}

function fallbackError(text, status) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return `命盘服务暂时不可用（${status}），请稍后再试。`
  }

  if (/<[^>]+>/.test(normalized)) {
    return `命盘服务暂时不可用（${status}），请稍后再试。`
  }

  return normalized.slice(0, 120)
}
