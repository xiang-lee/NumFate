import { buildShareUrl } from './share-link.js'

export function buildNativeSharePayload(data, numbers, locationLike = {}) {
  const payload = {
    title: data?.title || '命运之卷',
  }

  const text = [
    Array.isArray(numbers) && numbers.length > 0 ? `推演数字：${numbers.join(', ')}` : '',
    String(data?.overview || '').trim(),
  ]
    .filter(Boolean)
    .join('\n')

  if (text) payload.text = text

  const url = buildShareUrl(locationLike.origin, locationLike.pathname, numbers)
  if (url) payload.url = url

  return payload
}

export function canNativeShare(payload, env = {}) {
  const nav = env.navigator ?? globalThis.navigator
  if (typeof nav?.share !== 'function') return false
  if (typeof nav.canShare === 'function') {
    try {
      return nav.canShare(payload)
    } catch {
      return false
    }
  }
  return true
}

export function isShareAbort(error) {
  return error?.name === 'AbortError'
}
