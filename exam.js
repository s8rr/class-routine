/* Exam Routine mode
 * Data:    data/exam.json  (edit "enabled" and "default_mode" there)
 * Depends: index.html ids  #class-view #exam-view #mode-toggle #mode-class #mode-exam #season-badge
 * Links with app.js: reads currentSelectedSemester and calls handleSemesterSelect()
 */
(function () {
  'use strict';

  const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let cfg = null;      // parsed exam.json
  let mode = 'class';  // 'class' | 'exam'
  let sem = 'all';     // 'all' | '1'..'8'

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const isoOf = (t) => t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

  // "02:00 PM - 05:00 PM" -> minutes since midnight of the start time (for sorting)
  function startMinutes(time) {
    const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(time || '');
    if (!m) return 0;
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + Number(m[2]);
  }

  // ---- Shell -------------------------------------------------------------
  function buildShell() {
    $('exam-view').innerHTML = `
      <div class="bg-[#050505] border border-neutral-900 rounded-xl p-5 space-y-4">
        <div>
          <h3 id="exam-title" class="text-white text-sm font-semibold tracking-tight"></h3>
          <p class="text-xs text-neutral-500 mt-1">No classes during exams. Pick your semester to see only your exams.</p>
        </div>
        <div id="exam-sem-grid" class="grid grid-cols-3 sm:grid-cols-5 gap-2 font-mono"></div>
      </div>
      <section class="space-y-4 mt-12">
        <div class="flex justify-between items-baseline">
          <h2 class="text-xl font-bold text-white tracking-tight">Exam Routine</h2>
          <span id="exam-summary" class="text-xs font-mono text-neutral-500"></span>
        </div>
        <div id="exam-list" class="space-y-3"></div>
      </section>`;
    $('exam-title').textContent = `${cfg.title || 'Exam Schedule'} · ${cfg.term || ''}`;

    $('exam-sem-grid').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-sem]');
      if (!b) return;
      sem = b.dataset.sem;
      // keep the class view on the same semester (app.js)
      if (sem !== 'all' && typeof handleSemesterSelect === 'function' && typeof routineData !== 'undefined' && routineData) {
        try { handleSemesterSelect(sem); } catch (e) {}
      }
      renderPills();
      renderList();
    });
  }

  // ---- Rendering ---------------------------------------------------------
  function renderPills() {
    // same look as the semester buttons in app.js
    const base = 'px-3 py-2.5 rounded-md text-xs font-semibold tracking-wide border transition-colors duration-150 cursor-pointer';
    const off = 'bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:bg-neutral-900 hover:text-white hover:border-neutral-700';
    const on = 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/30';
    const items = [['all', 'ALL']];
    for (let i = 1; i <= 8; i++) items.push([String(i), 'SEM ' + i]);
    $('exam-sem-grid').innerHTML = items.map(([v, label]) =>
      `<button type="button" data-sem="${v}" aria-pressed="${sem === v}" class="${base} ${sem === v ? on : off}">${label}</button>`
    ).join('');
  }

  function renderList() {
    const list = $('exam-list');
    const today = isoOf(new Date());
    const rows = cfg.exams.filter((e) => sem === 'all' || String(e.semester) === sem);

    const byDate = new Map();
    rows.forEach((e) => {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push(e);
    });
    const dates = [...byDate.keys()].sort();
    const nextDate = dates.find((d) => d >= today);

    $('exam-summary').textContent = dates.length
      ? `${dates.length} exam day${dates.length > 1 ? 's' : ''}` + (sem === 'all' ? '' : ` · SEM ${sem}`)
      : '';

    if (!dates.length) {
      list.innerHTML = '<div class="bg-[#050505] border border-neutral-900 border-dashed rounded-xl p-8 text-center text-xs font-mono text-neutral-500">No exams found for this semester.</div>';
      return;
    }

    list.innerHTML = dates.map((iso) => {
      const d = parse(iso);
      const past = iso < today;
      const isToday = iso === today;
      const isNext = iso === nextDate && !isToday;

      let tag = '';
      if (isToday) {
        tag = '<span class="text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">Today</span>';
      } else if (isNext) {
        const n = daysBetween(today, iso);
        tag = `<span class="text-[10px] font-mono bg-amber-500/5 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">${n === 1 ? 'Tomorrow' : 'In ' + n + ' days'}</span>`;
      } else if (past) {
        tag = '<span class="text-[10px] font-mono text-neutral-600">Done</span>';
      }

      // group this day's exams by time slot, earliest first
      const slots = new Map();
      byDate.get(iso).forEach((e) => {
        if (!slots.has(e.time)) slots.set(e.time, []);
        slots.get(e.time).push(e);
      });
      const slotHtml = [...slots.keys()].sort((a, b) => startMinutes(a) - startMinutes(b)).map((time) => `
        <div class="py-3 first:pt-0 last:pb-0">
          <div class="text-[11px] font-mono text-neutral-500 mb-2">${esc(time)}</div>
          <div class="space-y-2">
            ${slots.get(time).map((e) => `
              <div class="flex items-start gap-3">
                <span class="shrink-0 w-10 text-center text-[10px] font-mono text-neutral-400 bg-[#111] border border-neutral-800 rounded py-1">${esc(ORD[Number(e.semester)] || e.semester)}</span>
                <div class="min-w-0">
                  <div class="text-sm text-white leading-snug">${esc(e.name)}</div>
                  <div class="text-[11px] font-mono text-neutral-500">${esc(e.code)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('');

      return `
        <div class="bg-[#050505] border ${isToday ? 'border-blue-500/50' : 'border-neutral-900'} rounded-xl p-4 ${past ? 'opacity-50' : ''}">
          <div class="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-neutral-900">
            <div class="flex items-baseline gap-2">
              <span class="text-white font-semibold text-base">${d.getDate()} ${MONTHS[d.getMonth()]}</span>
              <span class="text-xs font-mono text-neutral-500">${DAYS[d.getDay()]}</span>
            </div>
            ${tag}
          </div>
          <div class="divide-y divide-neutral-900">${slotHtml}</div>
        </div>`;
    }).join('');
  }

  // ---- Mode switching ----------------------------------------------------
  function setMode(next, fromClick) {
    mode = next;
    const isExam = mode === 'exam';

    $('class-view').hidden = isExam;
    $('exam-view').hidden = !isExam;

    const active = 'px-3 py-1 rounded bg-white text-black transition-colors';
    const idle = 'px-3 py-1 rounded text-neutral-400 hover:text-white transition-colors';
    $('mode-class').className = isExam ? idle : active;
    $('mode-exam').className = isExam ? active : idle;
    $('mode-class').setAttribute('aria-pressed', String(!isExam));
    $('mode-exam').setAttribute('aria-pressed', String(isExam));

    $('season-badge').textContent = isExam ? `Exam · ${cfg.term}` : cfg.term;
    document.title = isExam ? `CSE Exam Routine | ${cfg.term}` : `CSE Class Routine | ${cfg.term}`;

    try { history.replaceState(null, '', isExam ? '#exam' : location.pathname + location.search); } catch (e) {}

    if (isExam) {
      // when the student taps Exam, start on the semester they picked in the class view
      if (fromClick && typeof currentSelectedSemester !== 'undefined') sem = String(currentSelectedSemester);
      renderPills();
      renderList();
    }
  }

  // ---- Init --------------------------------------------------------------
  async function init() {
    if (!$('exam-view') || !$('class-view')) return;

    try {
      const res = await fetch('data/exam.json');
      if (!res.ok) throw new Error('exam.json not found');
      cfg = await res.json();
    } catch (e) {
      console.warn('Exam routine unavailable:', e);
      return; // toggle stays hidden, normal routine is untouched
    }

    if (cfg.enabled !== true || !Array.isArray(cfg.exams) || !cfg.exams.length) return;

    // reveal the toggle
    const toggle = $('mode-toggle');
    toggle.classList.remove('hidden');
    toggle.classList.add('flex');

    buildShell();
    $('mode-class').addEventListener('click', () => setMode('class', true));
    $('mode-exam').addEventListener('click', () => setMode('exam', true));

    // #exam / #class in the URL wins, otherwise use default_mode from exam.json
    const start = location.hash === '#exam' ? 'exam'
                : location.hash === '#class' ? 'class'
                : (cfg.default_mode === 'exam' ? 'exam' : 'class');
    setMode(start, false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
