import { parseFortuneResponse } from './api-response.js'
import './style.css'
import { canReadClipboard, readClipboardText, writeClipboard } from './clipboard.js'
import { loadDraft, saveDraft } from './draft.js'
import { formatFortuneText } from './fortune-text.js'
import { collectMetrics } from './metrics.js'
import { buildNativeSharePayload, canNativeShare, isShareAbort } from './native-share.js'
import { parseInput } from './numbers.js'
import { preset } from './presets.js'
import { clearRecentInputs, loadRecentInputs, saveRecentInput } from './recent-inputs.js'
import { buildSharePath, buildShareUrl, readSharedInput } from './share-link.js'
import { shareableNumbers } from './share-state.js'
import { needsReveal, scrollBehavior } from './reveal.js'
import { isResultStale } from './result-state.js'
import { isSubmitShortcut } from './shortcut.js'
import { getSubmitState } from './submit-state.js'

const app = document.querySelector('#app')
const canPasteFromClipboard = canReadClipboard()

app.innerHTML = `
  <main class="page">
    <section class="mist-layer mist-1"></section>
    <section class="mist-layer mist-2"></section>
    <section class="constellation"></section>

    <div class="shell">
      <header class="hero">
        <p class="label">NUMFATE ORACLE</p>
        <h1>数字命盘天机台</h1>
        <p class="subtitle">
          输入一串与你有关的数字，比如生日、幸运数字、手机号尾号。命盘会交给 AI 解读，生成一份专属玄幻预言。
        </p>
      </header>

      <form id="fortune-form" class="oracle-card" autocomplete="off">
        <label for="numbers" class="input-label">你的命运数字</label>
        <div class="input-wrap">
          <textarea
            id="numbers"
            name="numbers"
            rows="3"
            placeholder="例如: 1994-07-16 或 9, 27, 108, 1314"
            aria-keyshortcuts="Control+Enter Meta+Enter"
            required
          ></textarea>
        </div>
        <div class="preset-row" aria-label="快速填充示例">
          <button type="button" class="preset-btn" data-preset="birthday">生日示例</button>
          <button type="button" class="preset-btn" data-preset="lucky">幸运数字</button>
          <button type="button" class="preset-btn" data-preset="work">事业节奏</button>
          ${canPasteFromClipboard ? '<button type="button" class="preset-btn paste-btn" id="paste-numbers-btn">读取剪贴板</button>' : ''}
          <button type="button" class="preset-btn" data-preset="clear">清空</button>
        </div>
        <section id="recent-inputs" class="recent-inputs hidden" aria-live="polite"></section>
        <p id="input-feedback" class="hint" aria-live="polite">可输入 2-12 个数字，支持逗号、空格、换行、全角数字，也支持生日格式如 1994-07-16。</p>
        <section id="metric-preview" class="metric-preview hidden" aria-live="polite"></section>
        <button type="submit" id="submit-btn">开启命盘推演</button>
      </form>

      <section id="result" class="result-card hidden" aria-live="polite"></section>
    </div>
  </main>
`

const form = document.querySelector('#fortune-form')
const input = document.querySelector('#numbers')
const submitButton = document.querySelector('#submit-btn')
const feedback = document.querySelector('#input-feedback')
const metricPreview = document.querySelector('#metric-preview')
const recentInputs = document.querySelector('#recent-inputs')
const resultCard = document.querySelector('#result')
const presetButtons = Array.from(document.querySelectorAll('[data-preset]'))
const pasteButton = document.querySelector('#paste-numbers-btn')
const draftStorage = globalThis.localStorage
let isSubmitting = false
let lastSubmittedNumbers = []

input.value = readSharedInput(globalThis.location?.search) || loadDraft(draftStorage)
renderRecentInputs(loadRecentInputs(draftStorage))

input.addEventListener('input', () => {
  const parsed = parseInput(input.value)
  applyParsedState(parsed)
  saveDraft(draftStorage, input.value)
})

input.addEventListener('keydown', (event) => {
  if (!isSubmitShortcut(event) || submitButton.disabled) return
  event.preventDefault()
  form.requestSubmit()
})

presetButtons.forEach((button) => {
  button.addEventListener('click', () => applyPreset(button.dataset.preset || ''))
})

pasteButton?.addEventListener('click', () => pasteInput(pasteButton))

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const parsed = parseInput(input.value)
  if (parsed.invalid.length > 0) {
    renderError(`发现无效数字: ${formatInvalid(parsed.invalid)}。请只输入普通数字。`)
    return
  }

  const values = parsed.values
  if (values.length < 2 || values.length > 12) {
    renderError('请输入 2 到 12 个数字，再开始推演。')
    return
  }

  toggleLoading(true)

  try {
    const response = await fetch('/api/fortune', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ numbers: values }),
    })

    const { payload, error } = await parseFortuneResponse(response)
    if (!response.ok || !payload) {
      throw new Error(error || '命盘推演失败，请稍后再试。')
    }

    renderFortune(payload, values)
    renderRecentInputs(saveRecentInput(draftStorage, values))
  } catch (error) {
    renderError(error.message || '命盘推演失败，请稍后再试。')
  } finally {
    toggleLoading(false)
  }
})

applyParsedState(parseInput(input.value))

function toggleLoading(isLoading) {
  isSubmitting = isLoading
  syncSubmitState(parseInput(input.value))
}

function formatInvalid(list) {
  const shown = list.slice(0, 3).join('、')
  return list.length > 3 ? `${shown} 等 ${list.length} 项` : shown
}

function renderFeedback(parsed) {
  const count = parsed.values.length
  if (!feedback) return

  feedback.classList.toggle('hint-error', parsed.invalid.length > 0)
  feedback.classList.toggle('hint-ok', parsed.invalid.length === 0 && count >= 2 && count <= 12)

  if (parsed.invalid.length > 0) {
    feedback.textContent = `已识别 ${count} 个有效数字；发现无效项：${formatInvalid(parsed.invalid)}。`
    return
  }

  if (count === 0) {
    feedback.textContent = '可输入 2-12 个数字，支持逗号、空格、换行、全角数字，也支持生日格式如 1994-07-16；按 Ctrl/Cmd + Enter 可快速推演。'
    return
  }

  if (count < 2) {
    feedback.textContent = `目前识别到 ${count} 个数字，再输入 ${2 - count} 个即可开始推演。`
    return
  }

  if (count > 12) {
    feedback.textContent = `目前识别到 ${count} 个数字，超出上限 ${count - 12} 个。请精简后再推演。`
    return
  }

  feedback.textContent = `已识别 ${count} 个有效数字，可以开始推演；按 Ctrl/Cmd + Enter 可快速推演。`
}

function renderMetricPreview(parsed) {
  if (!metricPreview) return

  const values = parsed.values
  const ready = parsed.invalid.length === 0 && values.length >= 2 && values.length <= 12
  metricPreview.classList.toggle('hidden', !ready)
  if (!ready) {
    metricPreview.innerHTML = ''
    return
  }

  const metrics = collectMetrics(values)
  metricPreview.innerHTML = `
    <p class="metric-title">命盘速览</p>
    <div class="metric-grid">
      ${metricChip('总和', formatMetric(metrics.sum))}
      ${metricChip('数字根', metrics.digitalRoot)}
      ${metricChip('均值', formatMetric(metrics.mean))}
      ${metricChip('中位', formatMetric(metrics.median))}
      ${metricChip('跨度', formatMetric(metrics.spread))}
      ${metricChip('奇偶', `${metrics.oddCount}:${metrics.evenCount}`)}
      ${metricChip('质数', metrics.primeCount)}
    </div>
  `
}

function applyParsedState(parsed) {
  renderFeedback(parsed)
  renderMetricPreview(parsed)
  syncResultState(parsed)
  syncSubmitState(parsed)
  syncSharePath(shareableNumbers(parsed))
}

function applyPreset(id) {
  input.value = id === 'clear' ? '' : preset(id)
  input.focus()
  const parsed = parseInput(input.value)
  applyParsedState(parsed)
  saveDraft(draftStorage, input.value)
}

function applyRecentInput(value) {
  input.value = value
  input.focus()
  const parsed = parseInput(input.value)
  applyParsedState(parsed)
  saveDraft(draftStorage, input.value)
}

function renderFortune(data, numbers) {
  const blessings = Array.isArray(data.blessings) ? data.blessings : []
  const cautions = Array.isArray(data.cautions) ? data.cautions : []
  const sigils = Array.isArray(data.sigils) ? data.sigils : []
  const numberLabels = Array.isArray(numbers) ? numbers.map((item) => escapeHtml(String(item))) : []
  const nativeSharePayload = buildNativeSharePayload(data, numbers, globalThis.location)
  const showNativeShare = canNativeShare(nativeSharePayload)

  resultCard.classList.remove('hidden', 'error')
  resultCard.innerHTML = `
    <div class="result-header">
      <p class="result-kicker">天机已现</p>
      <h2>${escapeHtml(data.title || '命运之卷')}</h2>
      <p id="result-stale-note" class="stale-note hidden">输入已变更，当前结果基于上一组数字。重新推演后可刷新结果。</p>
      ${
        numberLabels.length
          ? `<div class="result-numbers"><span>本次推演数字</span><div class="number-chips">${numberLabels
              .map((item) => `<span class="number-chip">${item}</span>`)
              .join('')}</div></div>`
          : ''
      }
      <p>${escapeHtml(data.overview || '')}</p>
      <div class="result-actions">
        <button type="button" class="copy-btn" id="copy-result-btn">复制命盘结果</button>
        <button type="button" class="share-btn" id="copy-share-btn">复制分享链接</button>
        ${showNativeShare ? '<button type="button" class="native-share-btn" id="native-share-btn">系统分享</button>' : ''}
      </div>
    </div>

    <div class="result-grid">
      <article>
        <h3>主命格</h3>
        <p>${escapeHtml(data.destiny || '')}</p>
      </article>
      <article>
        <h3>近七日气运</h3>
        <p>${escapeHtml(data.weekly || '')}</p>
      </article>
      <article>
        <h3>机缘加持</h3>
        <ul>
          ${blessings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </article>
      <article>
        <h3>需避之象</h3>
        <ul>
          ${cautions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </article>
    </div>

    <article class="ritual">
      <h3>开运仪式</h3>
      <p>${escapeHtml(data.ritual || '')}</p>
    </article>

    ${
      sigils.length
        ? `<article class="ritual">
      <h3>命盘符印</h3>
      <ul>
        ${sigils.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </article>`
        : ''
    }
  `

  lastSubmittedNumbers = Array.isArray(numbers) ? [...numbers] : []
  setResultStale(false)

  const copy = document.querySelector('#copy-result-btn')
  copy?.addEventListener('click', () => copyResult(data, numbers, copy))
  const share = document.querySelector('#copy-share-btn')
  share?.addEventListener('click', () => copyShareLink(numbers, share))
  const nativeShare = document.querySelector('#native-share-btn')
  nativeShare?.addEventListener('click', () => shareResult(nativeSharePayload, nativeShare))
  revealResultCard()
}

async function copyResult(data, numbers, button) {
  const text = formatFortuneText({ ...data, numbers })

  const copied = await writeClipboard(text)
  flashAction(button, copied ? '已复制' : '复制失败')
}

async function copyShareLink(numbers, button) {
  const url = buildShareUrl(globalThis.location?.origin, globalThis.location?.pathname, numbers)
  if (!url) {
    flashAction(button, '暂无链接')
    return
  }

  const copied = await writeClipboard(url)
  flashAction(button, copied ? '链接已复制' : '复制失败')
}

async function shareResult(payload, button) {
  if (!canNativeShare(payload)) {
    flashAction(button, '暂不支持')
    return
  }

  const prev = button?.textContent || '系统分享'
  if (button) {
    button.disabled = true
    button.textContent = '分享中...'
  }

  try {
    await navigator.share(payload)
    if (button) {
      button.disabled = false
      button.textContent = prev
    }
    flashAction(button, '已分享')
  } catch (error) {
    if (button) {
      button.disabled = false
      button.textContent = prev
    }
    if (isShareAbort(error)) return
    flashAction(button, '分享失败')
  }
}

async function pasteInput(button) {
  const prev = button?.textContent || '读取剪贴板'
  if (button) {
    button.disabled = true
    button.textContent = '读取中...'
  }

  const text = await readClipboardText()
  if (button) {
    button.disabled = false
    button.textContent = prev
  }

  if (text === null) {
    flashAction(button, '读取失败')
    return
  }

  if (!text.trim()) {
    flashAction(button, '剪贴板为空')
    return
  }

  input.value = text
  input.focus()
  const parsed = parseInput(input.value)
  applyParsedState(parsed)
  saveDraft(draftStorage, input.value)
  flashAction(button, '已粘贴')
}

function flashAction(button, text) {
  if (!button) return
  const prev = button.textContent
  button.textContent = text
  button.disabled = true
  setTimeout(() => {
    button.textContent = prev
    button.disabled = false
  }, 1600)
}

function renderError(message) {
  lastSubmittedNumbers = []
  const canRetry = !getSubmitState(parseInput(input.value)).disabled
  resultCard.classList.remove('hidden')
  resultCard.classList.remove('stale')
  resultCard.classList.add('error')
  resultCard.innerHTML = `
    <p>${escapeHtml(message)}</p>
    ${canRetry ? '<div class="error-actions"><button type="button" class="retry-btn" id="retry-fortune-btn">重新推演</button></div>' : ''}
  `

  resultCard.querySelector('#retry-fortune-btn')?.addEventListener('click', () => {
    form.requestSubmit()
  })
  revealResultCard()
}

function syncResultState(parsed) {
  if (resultCard.classList.contains('hidden') || resultCard.classList.contains('error')) return
  setResultStale(isResultStale(parsed.values, lastSubmittedNumbers, parsed.invalid.length > 0))
}

function setResultStale(isStale) {
  resultCard.classList.toggle('stale', isStale)
  const note = document.querySelector('#result-stale-note')
  if (!note) return
  note.classList.toggle('hidden', !isStale)
}

function syncSubmitState(parsed) {
  const state = getSubmitState(parsed, isSubmitting)
  submitButton.disabled = state.disabled
  submitButton.dataset.loading = state.loading ? 'true' : 'false'
  submitButton.setAttribute('aria-disabled', String(state.disabled))
  submitButton.textContent = state.label
}

function renderRecentInputs(entries) {
  if (!recentInputs) return

  recentInputs.classList.toggle('hidden', entries.length === 0)
  if (entries.length === 0) {
    recentInputs.innerHTML = ''
    return
  }

  recentInputs.innerHTML = `
    <div class="recent-header">
      <p class="recent-title">最近推演</p>
      <button type="button" class="recent-clear">清除记录</button>
    </div>
    <div class="recent-list">
      ${entries.map((entry) => `<button type="button" class="recent-btn">${escapeHtml(entry)}</button>`).join('')}
    </div>
  `

  recentInputs.querySelector('.recent-clear')?.addEventListener('click', () => {
    renderRecentInputs(clearRecentInputs(draftStorage))
  })

  Array.from(recentInputs.querySelectorAll('.recent-btn')).forEach((button, index) => {
    button.addEventListener('click', () => applyRecentInput(entries[index]))
  })
}

function syncSharePath(numbers) {
  if (typeof history?.replaceState !== 'function' || !globalThis.location?.pathname) return

  const nextPath = buildSharePath(globalThis.location.pathname, globalThis.location.search, globalThis.location.hash, numbers)
  const currentPath = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`
  if (!nextPath || nextPath === currentPath) return

  history.replaceState(history.state, '', nextPath)
}

function revealResultCard() {
  if (typeof resultCard?.scrollIntoView !== 'function') return

  requestAnimationFrame(() => {
    const rect = resultCard.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    if (!needsReveal(rect, viewportHeight)) return

    resultCard.scrollIntoView({
      behavior: scrollBehavior(prefersReducedMotion()),
      block: 'start',
    })
  })
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

function metricChip(label, value) {
  return `<article class="metric-chip"><span>${label}</span><strong>${value}</strong></article>`
}

function formatMetric(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
