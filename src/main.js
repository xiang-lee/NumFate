import './style.css'

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
        <p class="hint">可输入 2-12 个数字，支持逗号、空格或换行分隔。</p>
        <button type="submit" id="submit-btn">开启命盘推演</button>
      </form>

      <section id="result" class="result-card hidden" aria-live="polite"></section>
    </div>
  </main>
`

const form = document.querySelector('#fortune-form')
const input = document.querySelector('#numbers')
const submitButton = document.querySelector('#submit-btn')
const resultCard = document.querySelector('#result')

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const values = parseNumbers(input.value)
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

function parseNumbers(raw) {
  return raw
    .split(/[\s,，、]+/)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) => Number(piece))
    .filter((value) => Number.isFinite(value))
}

function toggleLoading(isLoading) {
  submitButton.disabled = isLoading
  submitButton.textContent = isLoading ? '命盘推演中...' : '开启命盘推演'
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
