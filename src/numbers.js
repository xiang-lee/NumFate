const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)$/
const dateLikePattern = /(\d{1,4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,4})(?:\s*日)?/g

export function parseInput(raw) {
  const parts = normalizeInput(raw)
    .split(/[\s,，、]+/)
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

function normalizeInput(raw) {
  return String(raw).replace(dateLikePattern, '$1 $2 $3')
}
