import test from 'node:test'
import assert from 'node:assert/strict'

import { onRequestPost } from '../functions/api/fortune.js'

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
