const DRAFT_KEY = 'numfate:last-input'

export function loadDraft(storage) {
  if (!storage?.getItem) return ''

  try {
    return normalizeDraft(storage.getItem(DRAFT_KEY))
  } catch {
    return ''
  }
}

export function saveDraft(storage, value) {
  if (!storage?.setItem || !storage?.removeItem) return

  const draft = normalizeDraft(value)

  try {
    if (draft) {
      storage.setItem(DRAFT_KEY, draft)
      return
    }

    storage.removeItem(DRAFT_KEY)
  } catch {}
}

function normalizeDraft(value) {
  return typeof value === 'string' ? value.slice(0, 500) : ''
}
