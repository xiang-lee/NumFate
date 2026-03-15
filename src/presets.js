const presets = {
  birthday: '1994, 07, 16',
  lucky: '9, 27, 108, 1314',
  work: '3, 8, 21, 34, 55',
}

export function preset(id) {
  return presets[id] || ''
}

export function ids() {
  return Object.keys(presets)
}
