export function formatFortuneText(data) {
  const parts = [
    `【${data.title || '命运之卷'}】`,
    numberLine(data.numbers),
    data.overview || '',
    `主命格：${data.destiny || ''}`,
    `近七日气运：${data.weekly || ''}`,
    list('机缘加持', data.blessings),
    list('需避之象', data.cautions),
    `开运仪式：${data.ritual || ''}`,
    list('命盘符印', data.sigils),
  ]

  return parts.filter(Boolean).join('\n\n')
}

function list(title, items) {
  if (!Array.isArray(items) || items.length === 0) return ''
  return `${title}：\n${items.map((item) => `- ${item}`).join('\n')}`
}

function numberLine(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return ''
  return `推演数字：${numbers.join(', ')}`
}
