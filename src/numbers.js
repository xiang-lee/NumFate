const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)$/

export function parseInput(raw) {
  const parts = String(raw)
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
