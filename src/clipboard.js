export async function writeClipboard(text, env = {}) {
  const targetNavigator = env.navigator ?? globalThis.navigator
  const targetDocument = env.document ?? globalThis.document

  if (targetNavigator?.clipboard?.writeText) {
    try {
      await targetNavigator.clipboard.writeText(text)
      return true
    } catch {}
  }

  return fallbackCopy(text, targetDocument)
}

export function canReadClipboard(env = {}) {
  const targetNavigator = env.navigator ?? globalThis.navigator
  return typeof targetNavigator?.clipboard?.readText === 'function'
}

export async function readClipboardText(env = {}) {
  const targetNavigator = env.navigator ?? globalThis.navigator
  if (!canReadClipboard({ navigator: targetNavigator })) {
    return null
  }

  try {
    const text = await targetNavigator.clipboard.readText()
    return typeof text === 'string' ? text : ''
  } catch {
    return null
  }
}

function fallbackCopy(text, doc) {
  if (!doc?.createElement || !doc.body?.append || typeof doc.execCommand !== 'function') {
    return false
  }

  const area = doc.createElement('textarea')
  area.value = text
  area.setAttribute?.('readonly', 'true')
  if (area.style) {
    area.style.position = 'absolute'
    area.style.left = '-9999px'
  }

  doc.body.append(area)

  try {
    area.select?.()
    return Boolean(doc.execCommand('copy'))
  } finally {
    area.remove?.()
  }
}
