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

function normalizeInput(raw) {
  return String(raw)
    .replace(fullWidthPattern, (char) => fullWidthMap[char] || char)
    .replace(labelPattern, '')
    .replace(dateLikePattern, '$1 $2 $3')
}
