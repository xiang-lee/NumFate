export function readSharedInput(search) {
  const params = new URLSearchParams(String(search || ''))
  const value = params.get('numbers')
  return typeof value === 'string' ? value.slice(0, 200) : ''
}

export function buildShareUrl(origin, pathname, numbers) {
  if (!origin || !pathname || !Array.isArray(numbers) || numbers.length === 0) return ''

  const url = new URL(pathname, origin)
  url.searchParams.set('numbers', numbers.join(','))
  return url.toString()
}
