import './style.css'
import { formatFortuneText } from './fortune-text.js'
import { parseInput } from './numbers.js'
import { preset } from './presets.js'

const app = document.querySelector('#app')

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
            placeholder="例如: 9, 27, 108, 1314"
            required
          ></textarea>
        </div>
        <div class="preset-row" aria-label="快速填充示例">
          <button type="button" class="preset-btn" data-preset="birthday">生日示例</button>
          <button type="button" class="preset-btn" data-preset="lucky">幸运数字</button>
          <button type="button" class="preset-btn" data-preset="work">事业节奏</button>
          <button type="button" class="preset-btn" data-preset="clear">清空</button>
        </div>
        <p id="input-feedback" class="hint" aria-live="polite">可输入 2-12 个数字，支持逗号、空格或换行分隔。</p>
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
const resultCard = document.querySelector('#result')
const presetButtons = Array.from(document.querySelectorAll('[data-preset]'))

input.addEventListener('input', () => {
  renderFeedback(parseInput(input.value))
})

presetButtons.forEach((button) => {
  button.addEventListener('click', () => applyPreset(button.dataset.preset || ''))
})

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

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.error || '命盘推演失败，请稍后再试。')
    }

    renderFortune(payload)
  } catch (error) {
    renderError(error.message || '命盘推演失败，请稍后再试。')
  } finally {
    toggleLoading(false)
  }
})

renderFeedback(parseInput(input.value))

function toggleLoading(isLoading) {
  submitButton.disabled = isLoading
  submitButton.textContent = isLoading ? '命盘推演中...' : '开启命盘推演'
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
    feedback.textContent = '可输入 2-12 个数字，支持逗号、空格或换行分隔。'
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

  feedback.textContent = `已识别 ${count} 个有效数字，可以开始推演。`
}

function applyPreset(id) {
  input.value = id === 'clear' ? '' : preset(id)
  input.focus()
  renderFeedback(parseInput(input.value))
}

function renderFortune(data) {
  const blessings = Array.isArray(data.blessings) ? data.blessings : []
  const cautions = Array.isArray(data.cautions) ? data.cautions : []
  const sigils = Array.isArray(data.sigils) ? data.sigils : []

  resultCard.classList.remove('hidden', 'error')
  resultCard.innerHTML = `
    <div class="result-header">
      <p class="result-kicker">天机已现</p>
      <h2>${escapeHtml(data.title || '命运之卷')}</h2>
      <p>${escapeHtml(data.overview || '')}</p>
      <div class="result-actions">
        <button type="button" class="copy-btn" id="copy-result-btn">复制命盘结果</button>
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

  const copy = document.querySelector('#copy-result-btn')
  copy?.addEventListener('click', () => copyResult(data, copy))
}

async function copyResult(data, button) {
  const text = formatFortuneText(data)

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      fallbackCopy(text)
    }
    flashCopy(button, '已复制')
  } catch {
    flashCopy(button, '复制失败')
  }
}

function fallbackCopy(text) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', 'true')
  area.style.position = 'absolute'
  area.style.left = '-9999px'
  document.body.append(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

function flashCopy(button, text) {
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
  resultCard.classList.remove('hidden')
  resultCard.classList.add('error')
  resultCard.innerHTML = `<p>${escapeHtml(message)}</p>`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
