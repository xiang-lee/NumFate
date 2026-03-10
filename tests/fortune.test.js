import test from 'node:test'
import assert from 'node:assert/strict'

import { __testables, onRequestPost } from '../functions/api/fortune.js'

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
