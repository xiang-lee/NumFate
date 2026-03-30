export function readSharedInput(search) {
  const params = new URLSearchParams(String(search || ''))
  const value = params.get('numbers')
  return typeof value === 'string' ? value.slice(0, 200) : ''
}

export function buildSharePath(pathname, search, hash, numbers) {
  if (!pathname) return ''

  const params = new URLSearchParams(String(search || ''))
  if (Array.isArray(numbers) && numbers.length > 0) {
    params.set('numbers', numbers.join(','))
  } else {
    params.delete('numbers')
  }

  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}${hash || ''}`
}

export function buildShareUrl(origin, pathname, numbers) {
  if (!origin || !pathname || !Array.isArray(numbers) || numbers.length === 0) return ''

  return new URL(buildSharePath(pathname, '', '', numbers), origin).toString()
}
