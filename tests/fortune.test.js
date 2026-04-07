import test from 'node:test'
import assert from 'node:assert/strict'

import { parseFortuneResponse } from '../src/api-response.js'
import { canReadClipboard, readClipboardText, writeClipboard } from '../src/clipboard.js'
import { loadDraft, saveDraft } from '../src/draft.js'
import { __testables, onRequestPost } from '../functions/api/fortune.js'
import { formatFortuneText } from '../src/fortune-text.js'
import { buildNativeSharePayload, canNativeShare, isShareAbort } from '../src/native-share.js'
import { parseInput } from '../src/numbers.js'
import { ids, preset } from '../src/presets.js'
import { clearRecentInputs, formatRecentInput, loadRecentInputs, saveRecentInput } from '../src/recent-inputs.js'
import { buildSharePath, buildShareUrl, readSharedInput } from '../src/share-link.js'
import { shareableNumbers } from '../src/share-state.js'
import { needsReveal, scrollBehavior } from '../src/reveal.js'
import { isResultStale, shouldOfferResultRefresh } from '../src/result-state.js'
import { isSubmitShortcut } from '../src/shortcut.js'
import { getSubmitState } from '../src/submit-state.js'

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

test('parseFortuneResponse reads successful JSON payloads', async () => {
  const response = new Response(JSON.stringify({ title: '星河命卷' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await parseFortuneResponse(response)

  assert.deepEqual(result, {
    payload: { title: '星河命卷' },
    error: null,
  })
})

test('parseFortuneResponse falls back to friendly error for HTML failures', async () => {
  const response = new Response('<html><body>502 Bad Gateway</body></html>', {
    status: 502,
    headers: { 'Content-Type': 'text/html' },
  })

  const result = await parseFortuneResponse(response)

  assert.equal(result.payload, null)
  assert.equal(result.error, '命盘服务暂时不可用（502），请稍后再试。')
})

test('parseFortuneResponse surfaces plain-text API errors', async () => {
  const response = new Response('Rate limit exceeded', {
    status: 429,
    headers: { 'Content-Type': 'text/plain' },
  })

  const result = await parseFortuneResponse(response)

  assert.equal(result.payload, null)
  assert.equal(result.error, 'Rate limit exceeded')
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

test('collectMetrics exposes richer preview stats for parity and primes', () => {
  const metrics = __testables.collectMetrics([2, 3, 8, 13])

  assert.equal(metrics.mean, 6.5)
  assert.equal(metrics.median, 5.5)
  assert.equal(metrics.spread, 11)
  assert.equal(metrics.oddCount, 2)
  assert.equal(metrics.evenCount, 2)
  assert.equal(metrics.primeCount, 3)
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

test('formatUpstreamError hides noisy 5xx upstream payloads', () => {
  const message = __testables.formatUpstreamError(502, '<html><body>Bad Gateway</body></html>', 'text/html')

  assert.equal(message, 'AI service is temporarily unavailable. Please retry.')
})

test('formatUpstreamError gives a friendly retry message for rate limits', () => {
  const message = __testables.formatUpstreamError(429, '{"error":{"message":"Too many requests"}}', 'application/json')

  assert.equal(message, 'AI service is busy right now. Please retry shortly.')
})

test('formatUpstreamError keeps useful 4xx request details', () => {
  const message = __testables.formatUpstreamError(400, '{"error":{"message":"Prompt is too long"}}', 'application/json')

  assert.equal(message, 'AI API error (400): Prompt is too long')
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

test('parseInput accepts common birthday formats as three numbers', () => {
  assert.deepEqual(parseInput('1994-07-16'), {
    values: [1994, 7, 16],
    invalid: [],
  })

  assert.deepEqual(parseInput('1994/07/16 9, 27'), {
    values: [1994, 7, 16, 9, 27],
    invalid: [],
  })

  assert.deepEqual(parseInput('1994年07月16日'), {
    values: [1994, 7, 16],
    invalid: [],
  })
})

test('parseInput normalizes full-width digits and punctuation', () => {
  assert.deepEqual(parseInput('１９９４－０７－１６'), {
    values: [1994, 7, 16],
    invalid: [],
  })

  assert.deepEqual(parseInput('９，２７，１０８'), {
    values: [9, 27, 108],
    invalid: [],
  })

  assert.deepEqual(parseInput('＋３．５ －２'), {
    values: [3.5, -2],
    invalid: [],
  })
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

test('recent inputs keep latest unique valid submissions', () => {
  const state = new Map()
  const storage = {
    getItem(key) {
      return state.has(key) ? state.get(key) : null
    },
    setItem(key, value) {
      state.set(key, value)
    },
    removeItem(key) {
      state.delete(key)
    },
  }

  assert.equal(formatRecentInput([9, 27, 108]), '9, 27, 108')
  saveRecentInput(storage, [9, 27, 108])
  saveRecentInput(storage, [3, 8, 21])
  saveRecentInput(storage, [9, 27, 108])
  saveRecentInput(storage, [1, 2])
  saveRecentInput(storage, [5, 13])
  saveRecentInput(storage, [7, 11])

  assert.deepEqual(loadRecentInputs(storage), ['7, 11', '5, 13', '1, 2', '9, 27, 108'])
  assert.deepEqual(clearRecentInputs(storage), [])
  assert.deepEqual(loadRecentInputs(storage), [])
})

test('share-link helpers restore shared numbers and build stable URLs', () => {
  assert.equal(readSharedInput('?numbers=9%2C27%2C108'), '9,27,108')
  assert.equal(readSharedInput('?foo=bar'), '')
  assert.equal(buildSharePath('/oracle', '?foo=bar', '#result', [9, 27, 108]), '/oracle?foo=bar&numbers=9%2C27%2C108#result')
  assert.equal(buildSharePath('/oracle', '?foo=bar&numbers=1%2C2', '#result', []), '/oracle?foo=bar#result')
  assert.equal(buildShareUrl('https://numfate.example', '/oracle', [9, 27, 108]), 'https://numfate.example/oracle?numbers=9%2C27%2C108')
})

test('shareableNumbers only keeps valid input sets in the share URL', () => {
  assert.deepEqual(shareableNumbers({ values: [9], invalid: [] }), [])
  assert.deepEqual(shareableNumbers({ values: [9, 27], invalid: [] }), [9, 27])
  assert.deepEqual(shareableNumbers({ values: [9, 27], invalid: ['abc'] }), [])
  assert.deepEqual(shareableNumbers({ values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], invalid: [] }), [])
})

test('writeClipboard uses navigator clipboard when available', async () => {
  let written = ''
  const ok = await writeClipboard('星河命卷', {
    navigator: {
      clipboard: {
        async writeText(value) {
          written = value
        },
      },
    },
  })

  assert.equal(ok, true)
  assert.equal(written, '星河命卷')
})

test('writeClipboard falls back to execCommand and reports failures', async () => {
  let appended = false
  let removed = false
  const area = {
    style: {},
    setAttribute() {},
    select() {},
    remove() {
      removed = true
    },
  }

  const ok = await writeClipboard('9,27,108', {
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error('clipboard unavailable')
        },
      },
    },
    document: {
      createElement() {
        return area
      },
      body: {
        append() {
          appended = true
        },
      },
      execCommand() {
        return false
      },
    },
  })

  assert.equal(ok, false)
  assert.equal(appended, true)
  assert.equal(removed, true)
})

test('clipboard read helpers detect support and read text safely', async () => {
  assert.equal(canReadClipboard({ navigator: { clipboard: { readText() {} } } }), true)
  assert.equal(canReadClipboard({ navigator: {} }), false)

  const okText = await readClipboardText({
    navigator: {
      clipboard: {
        async readText() {
          return '9, 27, 108'
        },
      },
    },
  })
  assert.equal(okText, '9, 27, 108')

  const failedText = await readClipboardText({
    navigator: {
      clipboard: {
        async readText() {
          throw new Error('denied')
        },
      },
    },
  })
  assert.equal(failedText, null)
})

test('native share helpers create payloads and respect capability checks', () => {
  const payload = buildNativeSharePayload(
    { title: '星河命卷', overview: '今夜适合重新聚焦主线。' },
    [9, 27, 108],
    { origin: 'https://numfate.example', pathname: '/oracle' },
  )

  assert.deepEqual(payload, {
    title: '星河命卷',
    text: '推演数字：9, 27, 108\n今夜适合重新聚焦主线。',
    url: 'https://numfate.example/oracle?numbers=9%2C27%2C108',
  })
  assert.equal(canNativeShare(payload, { navigator: { share() {}, canShare: () => true } }), true)
  assert.equal(canNativeShare(payload, { navigator: { share() {}, canShare: () => false } }), false)
  assert.equal(canNativeShare(payload, { navigator: { share() {} } }), true)
  assert.equal(isShareAbort({ name: 'AbortError' }), true)
  assert.equal(isShareAbort({ name: 'NotAllowedError' }), false)
})

test('saveDraft and loadDraft persist the latest raw input safely', () => {
  const state = new Map()
  const storage = {
    getItem(key) {
      return state.has(key) ? state.get(key) : null
    },
    setItem(key, value) {
      state.set(key, value)
    },
    removeItem(key) {
      state.delete(key)
    },
  }

  saveDraft(storage, '9, 27, 108')
  assert.equal(loadDraft(storage), '9, 27, 108')

  saveDraft(storage, '')
  assert.equal(loadDraft(storage), '')
})

test('needsReveal detects when the result card is outside the viewport', () => {
  assert.equal(needsReveal({ top: 20, bottom: 300 }, 640), false)
  assert.equal(needsReveal({ top: -12, bottom: 300 }, 640), true)
  assert.equal(needsReveal({ top: 20, bottom: 720 }, 640), true)
})

test('scrollBehavior respects reduced motion preferences', () => {
  assert.equal(scrollBehavior(true), 'auto')
  assert.equal(scrollBehavior(false), 'smooth')
})

test('getSubmitState disables submit until the input is ready', () => {
  assert.deepEqual(getSubmitState({ values: [], invalid: [] }), {
    disabled: true,
    label: '至少输入 2 个数字',
    loading: false,
  })

  assert.deepEqual(getSubmitState({ values: [9, 27], invalid: ['abc'] }), {
    disabled: true,
    label: '先修正无效项',
    loading: false,
  })

  assert.deepEqual(getSubmitState({ values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], invalid: [] }), {
    disabled: true,
    label: '最多输入 12 个数字',
    loading: false,
  })

  assert.deepEqual(getSubmitState({ values: [9, 27], invalid: [] }), {
    disabled: false,
    label: '开启命盘推演',
    loading: false,
  })

  assert.deepEqual(getSubmitState({ values: [9, 27], invalid: [] }, true), {
    disabled: true,
    label: '命盘推演中...',
    loading: true,
  })
})

test('isResultStale detects when current input no longer matches shown result', () => {
  assert.equal(isResultStale([9, 27, 108], [9, 27, 108], false), false)
  assert.equal(isResultStale([9, 27], [9, 27, 108], false), true)
  assert.equal(isResultStale([9, 28, 108], [9, 27, 108], false), true)
  assert.equal(isResultStale([9, 27, 108], [9, 27, 108], true), true)
  assert.equal(isResultStale([], [], false), false)
})

test('shouldOfferResultRefresh only appears for stale and valid current input', () => {
  assert.equal(shouldOfferResultRefresh(true, { values: [9, 27], invalid: [] }, false), true)
  assert.equal(shouldOfferResultRefresh(false, { values: [9, 27], invalid: [] }, false), false)
  assert.equal(shouldOfferResultRefresh(true, { values: [9], invalid: [] }, false), false)
  assert.equal(shouldOfferResultRefresh(true, { values: [9, 27], invalid: ['abc'] }, false), false)
  assert.equal(shouldOfferResultRefresh(true, { values: [9, 27], invalid: [] }, true), false)
})

test('isSubmitShortcut only accepts ctrl/cmd enter without composition or shift', () => {
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: true, metaKey: false, shiftKey: false, isComposing: false }), true)
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: false, metaKey: true, shiftKey: false, isComposing: false }), true)
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false }), false)
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: true, metaKey: false, shiftKey: true, isComposing: false }), false)
  assert.equal(isSubmitShortcut({ key: 'Enter', ctrlKey: true, metaKey: false, shiftKey: false, isComposing: true }), false)
  assert.equal(isSubmitShortcut({ key: 'a', ctrlKey: true, metaKey: false, shiftKey: false, isComposing: false }), false)
})
