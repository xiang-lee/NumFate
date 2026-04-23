const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)$/
const dateLikePattern = /(\d{2,4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})(?:\s*日)?/g
const labelPattern = /[\p{Letter}]{1,12}\s*[：:]\s*/gu
const fullWidthMap = {
  '０': '0',
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9',
  '＋': '+',
  '－': '-',
  '．': '.',
  '／': '/',
}
const fullWidthPattern = /[０-９＋－．／]/g

export function parseInput(raw) {
  const parts = normalizeInput(raw)
    .split(/[\s,，、;；|｜]+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const values = []
  const invalid = []

  for (const part of parts) {
    if (!numberPattern.test(part)) {
      invalid.push(part)
      continue
    }

    const value = Number(part)
    if (!Number.isFinite(value)) {
      invalid.push(part)
      continue
    }

    values.push(value)
  }

  return { values, invalid }
}

export function previewValues(values, limit = 12) {
  const items = Array.isArray(values) ? values.map((value) => String(value)) : []
  return {
    shown: items.slice(0, limit),
    hiddenCount: Math.max(0, items.length - limit),
  }
}

export function describeParsedPreview(parsed, limit = 12) {
  const preview = previewValues(parsed?.values, limit)
  const invalidCount = Array.isArray(parsed?.invalid) ? parsed.invalid.length : 0
  const hasOnlyInvalid = preview.shown.length === 0 && invalidCount > 0
  const hasValues = preview.shown.length > 0

  return {
    ...preview,
    invalidCount,
    hasOnlyInvalid,
    hasValues,
    actionLabel: hasOnlyInvalid ? '清空输入' : invalidCount > 0 ? '仅保留有效数字' : '整理为标准格式',
    copyLabel: invalidCount > 0 ? '复制有效数字' : '复制数字',
  }
}

export function formatValues(values) {
  return Array.isArray(values) ? values.map((value) => String(value)).join(', ') : ''
}

function normalizeInput(raw) {
  return String(raw)
    .replace(fullWidthPattern, (char) => fullWidthMap[char] || char)
    .replace(labelPattern, '')
    .replace(dateLikePattern, '$1 $2 $3')
}
