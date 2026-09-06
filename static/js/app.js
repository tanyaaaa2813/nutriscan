// ── State ─────────────────────────────────────────────────────
const S = {
  user: null, permissions: [],
  records: [], tabFilter: 'all', page: 1, perPage: 8,
  wealthChart: null, eduChart: null,
  toggles: { tw: 'n', ts: 'n', tb: 'y' }
}
const AV_COLORS = ['#2E86DE','#FF6B35','#26C281','#A855F7','#FF4757','#FFD93D']

// ── Helpers ───────────────────────────────────────────────────
const can = (perm) => S.permissions.includes(perm)
const initials = (n) => n.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// ── Login / Logout ────────────────────────────────────────────
function fillDemo(email, password) {
  document.getElementById('login-email').value = email
  document.getElementById('login-password').value = password
}

async function doLogin() {
  const email    = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  const errEl    = document.getElementById('login-error')
  errEl.style.display = 'none'
  try {
    const res  = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (!data.success) { errEl.textContent = data.error; errEl.style.display = 'block'; return }
    S.user        = data.user
    S.permissions = data.permissions
    applyRoleUI()
    document.getElementById('page-login').style.display = 'none'
    document.getElementById('main-app').style.display   = 'flex'
    loadDashboard()
  } catch (e) {
    errEl.textContent = 'Connection error. Is Flask running on port 5000?'
    errEl.style.display = 'block'
  }
}

async function doLogout() {
  await fetch('/api/logout', { method: 'POST' })
  S.user = null; S.permissions = []; S.records = []
  document.getElementById('main-app').style.display = 'none'
  document.getElementById('page-login').style.display = 'flex'
}

// ── Apply role-based UI ───────────────────────────────────────
function applyRoleUI() {
  const u = S.user
  document.getElementById('sidebar-name').textContent = u.name
  document.getElementById('sidebar-role').textContent = u.role.replace('_', ' ')
  document.getElementById('sidebar-av').textContent   = initials(u.name)

  // Show/hide nav items based on permissions
  document.getElementById('nav-predict').style.display = can('predict') ? 'flex' : 'none'
  document.getElementById('nav-users').style.display   = can('manage_users') ? 'flex' : 'none'

  // Show/hide action buttons
  const btnExport  = document.getElementById('btn-export')
  const btnAddRec  = document.getElementById('btn-add-rec')
  const btnPredict = document.getElementById('btn-new-predict')
  if (btnExport)  btnExport.style.display  = can('export')   ? 'inline-flex' : 'none'
  if (btnAddRec)  btnAddRec.style.display  = can('predict')  ? 'inline-flex' : 'none'
  if (btnPredict) btnPredict.style.display = can('predict')  ? 'inline-flex' : 'none'

  // Hide Actions column for health workers & researchers
  const thActions = document.getElementById('th-actions')
  if (thActions) thActions.style.display = (can('records_edit') || can('records_delete')) ? '' : 'none'
}

// ── Navigation ─────────────────────────────────────────────────
function showPage(name, btn) {
  document.querySelectorAll('#main-app .page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  document.getElementById('page-' + name).classList.add('active')
  if (btn) btn.classList.add('active')
  else {
    const match = document.querySelector(`.nav-item[data-page="${name}"]`)
    if (match) match.classList.add('active')
  }
  if (name === 'dashboard') loadDashboard()
  if (name === 'records')   { loadRecords(); }
  if (name === 'users')     loadUsers()
}

// ── Toggle buttons ─────────────────────────────────────────────
function tog(group, val) {
  S.toggles[group] = val
  const y = document.getElementById(group + '-y')
  const n = document.getElementById(group + '-n')
  y.className = 'tog' + (val === 'y' ? ' tog-on' : '')
  n.className = 'tog' + (val === 'n' ? ' tog-off' : '')
}

// ── Predict ────────────────────────────────────────────────────
async function runPredict() {
  const name     = document.getElementById('f-name').value || 'Unknown'
  const age      = document.getElementById('f-age').value
  const weight   = document.getElementById('f-weight').value
  const height   = document.getElementById('f-height').value
  const siblings = document.getElementById('f-siblings').value
  const edu      = document.getElementById('f-edu').value
  const wealth   = document.getElementById('f-wealth').value

  if (!age || !weight || !height || siblings === '' || !edu || !wealth) {
    alert('⚠️ Please fill in all fields before predicting!'); return
  }

  const btn = document.getElementById('predict-btn')
  btn.disabled = true; btn.textContent = '⏳ Analysing...'

  try {
    const res  = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        child_name: name, age_months: age, weight_kg: weight,
        height_cm: height, num_siblings: siblings,
        mother_education: edu, wealth_index: wealth,
        clean_water: S.toggles.tw === 'y' ? 1 : 0,
        sanitation:  S.toggles.ts === 'y' ? 1 : 0,
        breastfed:   S.toggles.tb === 'y' ? 1 : 0,
      })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)

    const isRisk = data.prediction === 1
    const box    = document.getElementById('result-box')
    box.className = 'result-box ' + (isRisk ? 'risk' : 'safe')
    box.style.display = 'block'
    document.getElementById('r-emoji').textContent  = isRisk ? '⚠️' : '🎉'
    document.getElementById('r-title').textContent  = isRisk ? 'High Risk — Immediate attention recommended' : 'Low Risk — Child appears healthy'
    document.getElementById('r-prob').textContent   = `Risk probability: ${data.probability}%`
    setTimeout(() => { document.getElementById('r-fill').style.width = data.probability + '%' }, 80)

    const tips = document.getElementById('r-tips')
    const dotColor = isRisk ? '#FF6B35' : '#26C281'
    const items    = isRisk
      ? ['Schedule nutrition assessment with a health worker', 'Enroll in supplementary feeding programme', 'Improve access to clean water and sanitation', 'Increase dietary diversity immediately']
      : ['Continue breastfeeding and balanced diet', 'Regular monthly weight & height monitoring', 'Maintain hygiene and sanitation practices', 'Ensure routine immunizations are up to date']
    tips.innerHTML = `<p>Recommended actions</p>` +
      items.map(t => `<div class="tip-item"><div class="tip-dot" style="background:${dotColor}">›</div><span>${t}</span></div>`).join('')

    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  } catch (e) {
    alert('Error: ' + e.message)
  }
  btn.disabled = false; btn.textContent = '🔬 Analyse Malnutrition Risk'
}

// ── Dashboard ──────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await fetch('/api/analytics').then(r => r.json())
    document.getElementById('d-total').textContent   = data.total
    document.getElementById('d-risk').textContent    = data.at_risk
    document.getElementById('d-healthy').textContent = data.healthy
    document.getElementById('d-rate').textContent    = data.risk_rate + '%'

    // Wealth chart
    const wLabels = ['poor','middle','rich']
    const wRisk   = wLabels.map(k => (data.by_wealth[k] || {}).at_risk || 0)
    const wSafe   = wLabels.map(k => ((data.by_wealth[k] || {}).total || 0) - ((data.by_wealth[k] || {}).at_risk || 0))
    if (S.wealthChart) S.wealthChart.destroy()
    S.wealthChart = new Chart(document.getElementById('wealthChart'), {
      type: 'bar',
      data: { labels: ['Poor','Middle','Rich'], datasets: [
        { label:'At Risk', data: wRisk, backgroundColor:'#FF6B7A', borderRadius:6, stack:'s' },
        { label:'Healthy', data: wSafe, backgroundColor:'#42D695', borderRadius:6, stack:'s' }
      ]},
      options: chartOpts()
    })

    // Education chart
    const eLabels = ['none','primary','secondary','higher']
    const eRates  = eLabels.map(k => {
      const g = data.by_education[k] || {}
      return g.total ? Math.round(g.at_risk / g.total * 100) : 0
    })
    if (S.eduChart) S.eduChart.destroy()
    S.eduChart = new Chart(document.getElementById('eduChart'), {
      type: 'bar',
      data: { labels: ['None','Primary','Secondary','Higher'], datasets: [{
        label:'% At Risk', data: eRates,
        backgroundColor: ['#FF6B7A','#FFD93D','#55A3E8','#42D695'], borderRadius: 6
      }]},
      options: { ...chartOpts(), plugins: { legend: { display: false } }, scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Nunito', weight: '700' }, color: '#6b8cae' } },
        y: { max: 100, ticks: { callback: v => v + '%', font: { family: 'Nunito', weight: '700' }, color: '#6b8cae' }, grid: { color: 'rgba(46,134,222,.08)' } }
      }}
    })

    // Recent list
    const el = document.getElementById('recent-list')
    if (!data.recent.length) {
      el.innerHTML = '<div class="empty-state"><span>🍼</span><p>No predictions yet. Use Predict Risk to get started!</p></div>'; return
    }
    el.innerHTML = data.recent.map((r, i) => `
      <div class="recent-item">
        <div class="recent-left">
          <div class="child-av" style="background:${AV_COLORS[i % 6]}">${initials(r.child_name)}</div>
          <div><div class="recent-name">${r.child_name}</div><div class="recent-meta">${r.age_months} months · ${r.weight_kg} kg</div></div>
        </div>
        <span class="badge badge-${r.prediction ? 'risk' : 'safe'}"><span class="badge-dot"></span>${r.prediction ? '⚠️ At Risk' : '✅ Healthy'}</span>
      </div>`).join('')
  } catch (e) { console.error('Dashboard error:', e) }
}

function chartOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { font: { family: 'Nunito', weight: '700' }, color: '#6b8cae' } } },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Nunito', weight: '700' }, color: '#6b8cae' } },
      y: { stacked: true, ticks: { font: { family: 'Nunito', weight: '700' }, color: '#6b8cae' }, grid: { color: 'rgba(46,134,222,.08)' } }
    }
  }
}

// ── Records ────────────────────────────────────────────────────
async function loadRecords() {
  try {
    S.records = await fetch('/api/records').then(r => r.json())
    updateRecStats(); renderTable()
  } catch (e) { console.error('Records error:', e) }
}

function filterTab(btn, val) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  S.tabFilter = val; S.page = 1; renderTable()
}

function renderTable() {
  const search = (document.getElementById('search-inp').value || '').toLowerCase()
  const wf     = document.getElementById('fw-filter').value
  const ef     = document.getElementById('fe-filter').value

  let filtered = S.records.filter(r => {
    if (S.tabFilter === 'risk' && r.prediction !== 1) return false
    if (S.tabFilter === 'safe' && r.prediction !== 0) return false
    const name = (r.child_name || '').toLowerCase()
    const id   = ('NG-' + String(r.id).padStart(4, '0')).toLowerCase()
    if (search && !name.includes(search) && !id.includes(search)) return false
    if (wf && r.wealth_index !== wf) return false
    if (ef && r.mother_education !== ef) return false
    return true
  })

  document.getElementById('rec-count').textContent = filtered.length + ' records'
  const totalPages = Math.max(1, Math.ceil(filtered.length / S.perPage))
  if (S.page > totalPages) S.page = 1
  const slice = filtered.slice((S.page - 1) * S.perPage, S.page * S.perPage)

  const canEdit   = can('records_edit')
  const canDelete = can('records_delete')
  const tbody = document.getElementById('rec-tbody')

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span>🔍</span><p>No records found.</p></div></td></tr>`
  } else {
    const wColor = { poor: '#cc2233', middle: '#e6b800', rich: '#1a9460' }
    tbody.innerHTML = slice.map((r, i) => `
      <tr>
        <td>
          <div class="child-cell">
            <div class="child-av" style="background:${AV_COLORS[i % 6]}">${initials(r.child_name)}</div>
            <div><div class="child-name">${r.child_name}</div><div class="child-id">NG-${String(r.id).padStart(4,'0')}</div></div>
          </div>
        </td>
        <td>${r.age_months} mo</td>
        <td>${r.weight_kg} kg &nbsp;·&nbsp; ${r.height_cm} cm</td>
        <td><span style="font-weight:800;color:${wColor[r.wealth_index] || '#6b8cae'}">${capitalize(r.wealth_index || '')}</span></td>
        <td style="color:#6b8cae;text-transform:capitalize">${r.mother_education}</td>
        <td>
          <div class="prob-cell">
            <div class="prob-track"><div class="prob-fill" style="width:${r.probability}%;background:${r.prediction ? '#FF6B7A' : '#42D695'}"></div></div>
            <span style="font-size:.8rem;font-weight:700">${r.probability}%</span>
          </div>
        </td>
        <td><span class="badge badge-${r.prediction ? 'risk' : 'safe'}"><span class="badge-dot"></span>${r.prediction ? '⚠️ At Risk' : '✅ Healthy'}</span></td>
        <td>
          ${(canEdit || canDelete) ? `<div class="tbl-actions">
            ${canEdit ? `<button class="tbl-btn" title="View"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>` : ''}
            ${canDelete ? `<button class="tbl-btn del" title="Delete" onclick="deleteRecord(${r.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>` : ''}
          </div>` : '<span style="color:#c4d4e8;font-size:.78rem">—</span>'}
        </td>
      </tr>`).join('')
  }

  // Pagination
  document.getElementById('pg-info').textContent = `Page ${S.page} of ${totalPages}`
  const pgEl = document.getElementById('pg-btns')
  pgEl.innerHTML = ''
  const addBtn = (label, pg, active) => {
    const b = document.createElement('button')
    b.className = 'pg-btn' + (active ? ' active' : '')
    b.textContent = label
    b.onclick = () => { S.page = pg; renderTable() }
    pgEl.appendChild(b)
  }
  if (S.page > 1) addBtn('←', S.page - 1, false)
  for (let i = 1; i <= totalPages; i++) addBtn(i, i, i === S.page)
  if (S.page < totalPages) addBtn('→', S.page + 1, false)
}

async function deleteRecord(id) {
  if (!confirm('Delete this record? This cannot be undone.')) return
  await fetch('/api/records/' + id, { method: 'DELETE' })
  await loadRecords()
}

function updateRecStats() {
  const r = S.records
  const total = r.length, atRisk = r.filter(x => x.prediction === 1).length
  document.getElementById('r-total').textContent   = total
  document.getElementById('r-atrisk').textContent  = atRisk
  document.getElementById('r-healthy').textContent = total - atRisk
  document.getElementById('r-rate').textContent    = total ? Math.round(atRisk / total * 100) + '%' : '0%'
}

// ── Export ─────────────────────────────────────────────────────
function exportCSV() {
  window.location.href = '/api/export'
}

// ── Users (Admin) ──────────────────────────────────────────────
async function loadUsers() {
  try {
    const users = await fetch('/api/users').then(r => r.json())
    const el    = document.getElementById('users-list')
    el.innerHTML = users.map((u, i) => `
      <div class="user-row">
        <div class="user-row-left">
          <div class="user-av" style="background:${AV_COLORS[i % 6]}">${initials(u.name)}</div>
          <div>
            <div class="user-name">${u.name}</div>
            <div style="font-size:.78rem;color:#6b8cae;font-weight:600">${u.email}</div>
          </div>
        </div>
        <span class="role-chip role-${u.role}">${u.role.replace('_', ' ')}</span>
      </div>`).join('')
  } catch (e) { console.error('Users error:', e) }
}
