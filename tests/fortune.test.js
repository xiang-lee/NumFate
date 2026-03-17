import test from 'node:test'
import assert from 'node:assert/strict'

import { __testables, onRequestPost } from '../functions/api/fortune.js'
import { formatFortuneText } from '../src/fortune-text.js'
import { parseInput } from '../src/numbers.js'
import { ids, preset } from '../src/presets.js'
import { isSubmitShortcut } from '../src/shortcut.js'

test('returns 400 when request body is invalid JSON', async () => {
  const context = {
    request: new Request('https://example.com/api/fortune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    }),
    env: {},
  }

  const response = await onRequestPost(context)
  const payload = await response.json()

  assert.equal(response.status, 400)
  assert.equal(payload.error, 'Request body must be valid JSON.')
})

test('returns 500 when token is missing for valid JSON body', async () => {
  const context = {
    request: new Request('https://example.com/api/fortune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers: [1, 2, 3] }),
    }),
    env: {},
  }

  const response = await onRequestPost(context)
  const payload = await response.json()

  assert.equal(response.status, 500)
  assert.equal(payload.error, 'AI token is not configured.')
})

test('collectMetrics keeps digital root at 0 when rounded sum is 0', () => {
  const metrics = __testables.collectMetrics([-4, 4, 0.2, -0.2])

  assert.equal(metrics.sum, 0)
  assert.equal(metrics.digitalRoot, 0)
})

test('collectMetrics still computes non-zero digital roots correctly', () => {
  const metrics = __testables.collectMetrics([9, 27, 108])

  assert.equal(metrics.sum, 144)
  assert.equal(metrics.digitalRoot, 9)
})

test('sanitizeNumbers keeps numeric strings and rejects coercion-only values', () => {
  const values = __testables.sanitizeNumbers([1, ' 2.5 ', '-3', '', ' ', null, true, false, {}, [], '1e3', '.75'])

  assert.deepEqual(values, [1, 2.5, -3, 0.75])
})

test('returns 400 when payload relies on boolean or null coercion', async () => {
  const context = {
    request: new Request('https://example.com/api/fortune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers: [null, false, true] }),
    }),
    env: { AI_BUILDER_TOKEN: 'token' },
  }

  const response = await onRequestPost(context)
  const payload = await response.json()

  assert.equal(response.status, 400)
  assert.equal(payload.error, 'Please provide between 2 and 12 numbers.')
})

test('parseInput reports invalid manual entries instead of dropping them', () => {
  const parsed = parseInput('9, abc, 27\n1e3  .5  0x10')

  assert.deepEqual(parsed.values, [9, 27, 0.5])
  assert.deepEqual(parsed.invalid, ['abc', '1e3', '0x10'])
})

test('parseInput keeps all valid entries so the UI can detect overflow before submit', () => {
  const parsed = parseInput('1 2 3 4 5 6 7 8 9 10 11 12 13')

  assert.equal(parsed.values.length, 13)
  assert.deepEqual(parsed.invalid, [])
})

test('formatFortuneText turns a reading into shareable plain text', () => {
  const text = formatFortuneText({
    title: '星河命卷',
    numbers: [9, 27, 108],
    overview: '今夜星轨偏东，宜聚焦真正重要的事。',
    destiny: '你近期的主线是收拢分散精力。',
    weekly: '未来七日适合先定节奏，再做扩张。',
    blessings: ['贵人回应更快', '适合整理计划', '适合开启新尝试'],
    cautions: ['避免同时开太多线', '减少情绪化决定', '别忽略睡眠'],
    ritual: '今晚写下三件最重要的事，并先完成第一件。',
    sigils: ['辰光', '定风', '曜心'],
  })

  assert.match(text, /【星河命卷】/)
  assert.match(text, /推演数字：9, 27, 108/)
  assert.match(text, /主命格：你近期的主线是收拢分散精力。/)
  assert.match(text, /机缘加持：\n- 贵人回应更快/)
  assert.match(text, /命盘符印：\n- 辰光/)
})

test('presets expose quick-fill examples for the form', () => {
  assert.deepEqual(ids(), ['birthday', 'lucky', 'work'])
  assert.equal(preset('birthday'), '1994, 07, 16')
  assert.equal(preset('lucky'), '9, 27, 108, 1314')
  assert.equal(preset('missing'), '')
})

test('isSubmitShortcut only accepts ctrl/cmd enter without composition or shift', () => {
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: true, metaKey: false, shiftKey: false, isComposing: false }), true)
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: false, metaKey: true, shiftKey: false, isComposing: false }), true)
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false }), false)
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: true, metaKey: false, shiftKey: true, isComposing: false }), false)
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: true, metaKey: false, shiftKey: false, isComposing: true }), false)
  assert.equal(isSubmitShortcut({ key: 'a', ctrlKey: true, metaKey: false, shiftKey: false, isComposing: false }), false)
})
