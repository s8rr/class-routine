/* Exam routines: Mid + Final
 * Data:    data/mid.json and data/exam.json (each has its own enabled / default_mode / rules)
 * Depends: index.html ids  #class-view #exam-view #mode-toggle #season-badge
 * Links with app.js: reads currentSelectedSemester / activeSelectedDate, wraps
 *                    renderTimetableStream + renderCalendarGrid, calls handleSemesterSelect()
 */
(function () {
  'use strict';

  const SOURCES = [
    { url: 'data/mid.json', id: 'mid', label: 'Mid' },
    { url: 'data/exam.json', id: 'final', label: 'Final' },
  ];
  const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let sets = [];        // enabled exam sets, e.g. [mid, final]
  let mode = 'class';   // 'class' or a set id ('mid' / 'final')
  let sem = 'all';      // 'all' or '1'..'8'

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const isoOf = (t) => t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const active = () => sets.find((s) => s.id === mode);

  // "02:00 PM - 05:00 PM" -> start time in minutes (for sorting)
  function startMinutes(time) {
    const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(time || '');
    if (!m) return 0;
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + Number(m[2]);
  }
  const byDateTime = (a, b) => (a.date === b.date ? startMinutes(a.time) - startMinutes(b.time) : a.date.localeCompare(b.date));

  // ---- Loading -----------------------------------------------------------
  async function loadSets() {
    const loaded = await Promise.all(SOURCES.map(async (src) => {
      try {
        const res = await fetch(src.url);
        if (!res.ok) return null;
        const c = await res.json();
        c.id = c.id || src.id;
        c.label = c.label || src.label;
        return c;
      } catch (e) { return null; }
    }));
    return loaded
      .filter((c) => c && c.enabled === true && Array.isArray(c.exams) && c.exams.length)
      .map((c) => {
        const dates = c.exams.map((e) => e.date).sort();
        c.first = dates[0];
        c.last = dates[dates.length - 1];
        return c;
      });
  }

  // ---- Navbar toggle -----------------------------------------------------
  function buildToggle() {
    const box = $('mode-toggle');
    const items = [{ id: 'class', label: 'Class' }].concat(sets.map((s) => ({ id: s.id, label: s.label })));
    box.innerHTML = items.map((i) => `<button type="button" data-mode="${esc(i.id)}" class="px-3 py-1 rounded transition-colors">${esc(i.label)}</button>`).join('');
    box.classList.remove('hidden');
    box.classList.add('flex');
    box.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-mode]');
      if (b) setMode(b.dataset.mode, true);
    });
  }

  function paintToggle() {
    $('mode-toggle').querySelectorAll('button[data-mode]').forEach((b) => {
      const on = b.dataset.mode === mode;
      b.className = 'px-3 py-1 rounded transition-colors ' + (on ? 'bg-white text-black' : 'text-neutral-400 hover:text-white');
      b.setAttribute('aria-pressed', String(on));
    });
  }

  // ---- Exam view ---------------------------------------------------------
  function buildShell() {
    $('exam-view').innerHTML = `
      <div class="bg-[#050505] border border-neutral-900 rounded-xl p-5 space-y-4">
        <div>
          <h3 id="exam-title" class="text-white text-sm font-semibold tracking-tight"></h3>
          <p id="exam-note" class="text-xs text-neutral-500 mt-1"></p>
        </div>
        <div id="exam-sem-grid" class="grid grid-cols-3 sm:grid-cols-5 gap-2 font-mono"></div>
      </div>
      <section class="space-y-4 mt-12">
        <div class="flex justify-between items-baseline">
          <h2 id="exam-heading" class="text-xl font-bold text-white tracking-tight">Exam Routine</h2>
          <span id="exam-summary" class="text-xs font-mono text-neutral-500"></span>
        </div>
        <div id="exam-list" class="space-y-3"></div>
      </section>`;

    $('exam-sem-grid').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-sem]');
      if (!b) return;
      sem = b.dataset.sem;
      if (sem !== 'all' && typeof handleSemesterSelect === 'function' && typeof routineData !== 'undefined' && routineData) {
        try { handleSemesterSelect(sem); } catch (e) {}
      }
      renderPills();
      renderList();
    });
  }

  function renderPills() {
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
    const set = active();
    if (!set) return;
    $('exam-title').textContent = `${set.title || set.label + ' Examination'} · ${set.term || ''}`;
    $('exam-heading').textContent = `${set.label} Exam Routine`;
    $('exam-note').textContent = (set.classes_off_after === false)
      ? 'Classes continue after the exams. Pick your semester to see only your exams.'
      : 'No classes during or after these exams. Pick your semester to see only your exams.';

    const list = $('exam-list');
    const today = isoOf(new Date());
    const rows = set.exams.filter((e) => sem === 'all' || String(e.semester) === sem);

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
    mode = next === 'class' || sets.some((s) => s.id === next) ? next : 'class';
    const set = active();

    $('class-view').hidden = !!set;
    $('exam-view').hidden = !set;
    paintToggle();

    const term = (set || sets[0]).term || '';
    $('season-badge').textContent = set ? `${set.label} Exam · ${term}` : term;
    document.title = set ? `CSE ${set.label} Exam Routine | ${term}` : `CSE Class Routine | ${term}`;
    try { history.replaceState(null, '', set ? '#' + set.id : location.pathname + location.search); } catch (e) {}

    if (set) {
      if (fromClick && typeof currentSelectedSemester !== 'undefined') sem = String(currentSelectedSemester);
      renderPills();
      renderList();
    }
  }

  // ---- Class view integration ---------------------------------------------
  // On exam days: show that semester's exams. Inside an exam period: "classes off"
  // (if classes_off_during). After the last exam: "semester over" (if classes_off_after).
  // Wraps app.js functions at runtime; app.js itself is not modified.
  function examsOn(iso, s) {
    const out = [];
    sets.forEach((set) => {
      if (set.class_view_exams === false) return;
      set.exams.forEach((e) => { if (e.date === iso && String(e.semester) === String(s)) out.push({ set, e }); });
    });
    return out.sort((a, b) => startMinutes(a.e.time) - startMinutes(b.e.time));
  }

  function installClassViewHooks() {
    if (typeof renderTimetableStream !== 'function' || typeof renderCalendarGrid !== 'function') return;
    const hookSets = sets.filter((s) => s.class_view_exams !== false);
    if (!hookSets.length) return;

    const origTimetable = renderTimetableStream;
    const origCalendar = renderCalendarGrid;

    function setLabel() {
      const el = $('selected-date-string');
      if (el) el.textContent = activeSelectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    }
    const dashed = (html) => `<div class="bg-[#050505] border border-neutral-900 border-dashed rounded-xl p-8 text-center text-xs font-mono text-neutral-500">${html}</div>`;

    function showExams(items) {
      setLabel();
      $('schedule-output-mount').innerHTML = items.map(({ set, e }) => `
        <div class="bg-[#050505] border border-neutral-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-neutral-800 transition-colors">
          <div class="flex items-start gap-3.5">
            <div class="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-amber-500/40 border border-amber-500"></div>
            <div class="space-y-0.5">
              <span class="text-xs font-mono text-neutral-500 uppercase">${esc(e.time)}</span>
              <h3 class="text-base font-bold text-white tracking-tight">${esc(e.name)}</h3>
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs font-mono">
            <span class="bg-amber-500/5 border border-amber-500/20 px-2.5 py-1 rounded text-amber-400">${esc(set.label)} Exam</span>
            <span class="bg-[#111] border border-neutral-800 px-2.5 py-1 rounded text-neutral-300">${esc(e.code)}</span>
          </div>
        </div>`).join('');
    }

    function showNoExam(set, iso) {
      setLabel();
      const next = set.exams
        .filter((e) => e.date > iso && String(e.semester) === String(currentSelectedSemester))
        .sort(byDateTime)[0];
      const nextLine = next
        ? `<div class="pt-1 text-neutral-400">Next exam: ${parse(next.date).getDate()} ${MONTHS[parse(next.date).getMonth()]}, ${esc(next.name)}</div>`
        : '';
      $('schedule-output-mount').innerHTML = dashed(`No exam for this semester today. Classes are off during the ${esc(set.label.toLowerCase())} exam period.${nextLine}`);
    }

    function showOver(set) {
      setLabel();
      const msg = set.after_message || `The ${set.label.toLowerCase()} exams are over. There are no classes after them.`;
      $('schedule-output-mount').innerHTML = dashed(esc(msg));
    }

    renderTimetableStream = function () {
      const iso = isoOf(activeSelectedDate);

      // 1) an exam for the selected semester on this day
      const items = examsOn(iso, currentSelectedSemester);
      if (items.length) { showExams(items); return; }

      // 2) after the last exam of a set that ends the semester
      const over = hookSets.find((s) => iso > s.last && s.classes_off_after === true);
      if (over) { showOver(over); return; }

      // 3) inside an exam period, no exam for this semester today
      const inside = hookSets.find((s) => iso >= s.first && iso <= s.last && s.classes_off_during !== false);
      if (inside) {
        const dow = activeSelectedDate.getDay();
        const weekend = dow === 4 || dow === 5;   // Thu/Fri: app.js shows its own weekend card
        const exception = routineData && routineData.exceptions && routineData.exceptions[iso];
        if (!weekend && !exception) { showNoExam(inside, iso); return; }
      }

      origTimetable();
    };

    renderCalendarGrid = function () {
      origCalendar();
      const y = currentFocusedDate.getFullYear();
      const m = String(currentFocusedDate.getMonth() + 1).padStart(2, '0');
      document.querySelectorAll('#calendar-days-grid .calendar-cell-node').forEach((cell) => {
        if (cell.classList.contains('bg-blue-600')) return;
        const iso = `${y}-${m}-${String(parseInt(cell.textContent, 10)).padStart(2, '0')}`;
        if (examsOn(iso, currentSelectedSemester).length) {
          cell.classList.remove('text-neutral-400', 'text-red-400', 'bg-[#0a0a0a]', 'bg-red-500/5', 'border-red-500/10');
          cell.classList.add('text-amber-400', 'bg-amber-500/5', 'border-amber-500/10');
        }
      });
    };

    if (typeof routineData !== 'undefined' && routineData) renderSystemState();
  }

  // ---- Init --------------------------------------------------------------
  async function init() {
    if (!$('exam-view') || !$('class-view') || !$('mode-toggle')) return;
    sets = await loadSets();
    if (!sets.length) return;   // nothing enabled: site stays a normal class routine

    buildToggle();
    buildShell();
    installClassViewHooks();

    // URL hash (#class, #mid, #final, or legacy #exam) wins; otherwise default_mode from the json files
    const h = location.hash.replace('#', '');
    let start = 'class';
    if (h === 'class') start = 'class';
    else if (sets.some((s) => s.id === h)) start = h;
    else if (h === 'exam') start = sets[sets.length - 1].id;
    else {
      const def = sets.slice().reverse().find((s) => s.default_mode === 'exam');   // final wins over mid
      if (def) start = def.id;
    }
    setMode(start, false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
