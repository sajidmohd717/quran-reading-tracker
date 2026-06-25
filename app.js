'use strict';

// ── Constants ──────────────────────────────────────────
const TOTAL_PAGES = 604;
const STORAGE_KEY = 'quranTracker_v1';
const CIRCUMFERENCE = 2 * Math.PI * 52; // 326.7

// ── SVG gradient ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('class', 'hidden');
  defs.innerHTML = `
    <defs>
      <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#2D6A4F"/>
        <stop offset="100%" stop-color="#74C69D"/>
      </linearGradient>
    </defs>`;
  document.body.prepend(defs);
  init();
});

// ── Storage ────────────────────────────────────────────
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [], currentPage: 0 };
    return JSON.parse(raw);
  } catch {
    return { sessions: [], currentPage: 0 };
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Streak ─────────────────────────────────────────────
function calcStreak(sessions) {
  if (!sessions.length) return 0;

  const uniqueDates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  const today     = todayStr();
  const yesterday = offsetDate(-1);

  // Streak is 0 if last session wasn't today or yesterday
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const expected = offsetDateFrom(uniqueDates[i - 1], -1);
    if (uniqueDates[i] === expected) streak++;
    else break;
  }
  return streak;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function offsetDate(days) {
  return offsetDateFrom(todayStr(), days);
}

function offsetDateFrom(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Render ─────────────────────────────────────────────
function render() {
  const { sessions, currentPage } = load();

  // Ring
  const pct = Math.min(currentPage / TOTAL_PAGES, 1);
  const offset = CIRCUMFERENCE * (1 - pct);
  document.getElementById('ringFill').style.strokeDashoffset = offset;
  document.getElementById('currentPage').textContent = currentPage;

  // Bar
  const pctRounded = Math.round(pct * 100);
  document.getElementById('barFill').style.width = pctRounded + '%';
  document.getElementById('barPct').textContent = pctRounded + '% complete';

  // Note
  const note = document.getElementById('progressNote');
  if (currentPage === 0) {
    note.textContent = 'Begin your reading below';
  } else if (currentPage >= TOTAL_PAGES) {
    note.textContent = 'Masha\'Allah! You\'ve completed the Quran 🎉';
  } else {
    note.textContent = `${TOTAL_PAGES - currentPage} pages remaining`;
  }

  // Stats
  const totalRead = sessions.reduce((s, x) => s + x.pagesRead, 0);
  document.getElementById('statStreak').textContent   = calcStreak(sessions);
  document.getElementById('statTotal').textContent    = totalRead;
  document.getElementById('statSessions').textContent = sessions.length;

  // Session list (most recent first, show all)
  const list = document.getElementById('sessionsList');
  const sorted = [...sessions].sort((a, b) => b.id - a.id);

  if (!sorted.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <div>No sessions yet.<br>Log your first reading session above!</div>
      </div>`;
    return;
  }

  list.innerHTML = sorted.map(s => `
    <div class="session-item" id="sess-${s.id}">
      <div class="session-icon">📖</div>
      <div class="session-info">
        <div class="session-pages">Pages ${s.startPage}–${s.endPage}</div>
        <div class="session-meta">${friendlyDate(s.date)}${s.notes ? ' · ' + escHtml(s.notes) : ''}</div>
      </div>
      <div class="session-badge">+${s.pagesRead}p</div>
      <button class="session-delete" onclick="deleteSession(${s.id})" title="Delete session">✕</button>
    </div>
  `).join('');
}

// ── Helpers ────────────────────────────────────────────
function friendlyDate(dateStr) {
  const today     = todayStr();
  const yesterday = offsetDate(-1);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ── Modal ──────────────────────────────────────────────
function openModal() {
  document.getElementById('sessionDate').value = todayStr();

  const { currentPage } = load();
  const fromInput = document.getElementById('fromPage');
  const toInput   = document.getElementById('toPage');

  fromInput.value = currentPage > 0 && currentPage < TOTAL_PAGES ? currentPage + 1 : '';
  toInput.value   = '';
  document.getElementById('sessionNotes').value = '';
  document.getElementById('pagesPreview').style.display = 'none';

  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => fromInput.focus(), 320);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// Close on overlay click (not modal itself)
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// Live pages-read preview
['fromPage', 'toPage'].forEach(id => {
  document.getElementById(id).addEventListener('input', updatePreview);
});

function updatePreview() {
  const from = parseInt(document.getElementById('fromPage').value);
  const to   = parseInt(document.getElementById('toPage').value);
  const preview = document.getElementById('pagesPreview');
  if (from > 0 && to >= from) {
    preview.textContent = `${to - from + 1} page${to - from + 1 !== 1 ? 's' : ''} in this session`;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

// ── Log session ────────────────────────────────────────
function logSession(e) {
  e.preventDefault();

  const date  = document.getElementById('sessionDate').value;
  const from  = parseInt(document.getElementById('fromPage').value);
  const to    = parseInt(document.getElementById('toPage').value);
  const notes = document.getElementById('sessionNotes').value.trim();

  if (from > to) {
    showToast('End page must be ≥ start page');
    return;
  }
  if (from < 1 || to > TOTAL_PAGES) {
    showToast(`Pages must be between 1 and ${TOTAL_PAGES}`);
    return;
  }

  const data = load();
  const pagesRead = to - from + 1;

  data.sessions.push({ id: Date.now(), date, startPage: from, endPage: to, pagesRead, notes });

  if (to > data.currentPage) data.currentPage = to;

  save(data);
  closeModal();
  render();
  showToast(`Logged ${pagesRead} page${pagesRead !== 1 ? 's' : ''} — Barakallahu feek!`);
}

// ── Delete session ─────────────────────────────────────
function deleteSession(id) {
  const data = load();
  data.sessions = data.sessions.filter(s => s.id !== id);

  // Recalculate currentPage from remaining sessions
  data.currentPage = data.sessions.length
    ? Math.max(...data.sessions.map(s => s.endPage))
    : 0;

  save(data);
  render();
  showToast('Session removed');
}

// ── Reset ──────────────────────────────────────────────
function confirmReset() {
  const menu = document.createElement('div');
  menu.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;z-index:200;
    font-family:inherit;
  `;
  menu.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:24px;max-width:300px;width:90%;text-align:center;">
      <p style="font-size:16px;font-weight:700;margin-bottom:8px;color:#1C2B22">Reset all data?</p>
      <p style="font-size:14px;color:#6B7E73;margin-bottom:20px;line-height:1.5">
        This will delete all your sessions and reset your progress. This cannot be undone.
      </p>
      <div style="display:flex;gap:10px;">
        <button id="cancelReset" style="flex:1;padding:11px;border-radius:10px;border:1.5px solid #DDE7E0;background:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;color:#1C2B22">Cancel</button>
        <button id="doReset"     style="flex:1;padding:11px;border-radius:10px;border:none;background:#e53e3e;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Reset</button>
      </div>
    </div>`;
  document.body.appendChild(menu);
  document.getElementById('cancelReset').onclick = () => menu.remove();
  document.getElementById('doReset').onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    menu.remove();
    render();
    showToast('Data reset');
  };
}

// ── Boot ───────────────────────────────────────────────
function init() {
  render();
}
