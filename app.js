// System Application State Architecture Matrix
let routineData = null;
let currentSelectedSemester = "1";
let currentSelectedSection = "1";
let currentFocusedDate = new Date(); // Tracks Calendar Context Window view states
let activeSelectedDate = new Date();  // Explicit day target picked by user operation

// Target Document DOM Node Pointers
const semesterGrid = document.getElementById('semester-grid');
const sectionSelect = document.getElementById('section-select');
const calendarMonthYearHeader = document.getElementById('calendar-month-year');
const calendarDaysGrid = document.getElementById('calendar-days-grid');
const selectedDateStringLabel = document.getElementById('selected-date-string');
const scheduleOutputMount = document.getElementById('schedule-output-mount');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

// Core Weekday Reference Mapping Array Key Definitions
const indexToDayMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Initialize system execution and fetch data store
 */
async function initializeApp() {
    try {
        const response = await fetch('data/routine_data.json');
        if (!response.ok) throw new Error("Database pipeline network sync exception.");
        routineData = await response.json();

        // Default to the first semester / first section reported by the data store.
        currentSelectedSemester = routineData.semesters?.[0] || "1";
        currentSelectedSection = routineData.sections_by_semester?.[currentSelectedSemester]?.[0] || "1A";

        renderSemesterGrid();
        
        populateSectionDropdown();
        attachEventHandlers();
        renderSystemState();
    } catch (error) {
        console.error(error);
        scheduleOutputMount.innerHTML = `
            <div class="bg-red-500/5 border border-red-500/10 rounded-xl p-5 text-center text-xs text-red-400 font-mono">
                Critical System Failure: Unable to securely deserialize static routine repository context records.
            </div>`;
    }
}

/**
 * Build the 2x4 semester selector grid (8 semesters -> 2 columns x 4 rows)
 * and visually highlight whichever semester is currently active.
 */
function renderSemesterGrid() {
    semesterGrid.innerHTML = "";
    if (!routineData || !routineData.semesters) return;

    const baseClasses = "px-3 py-2.5 rounded-md text-xs font-semibold tracking-wide border transition-colors duration-150 cursor-pointer";
    const inactiveClasses = "bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:bg-neutral-900 hover:text-white hover:border-neutral-700";
    const activeClasses = "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/30";

    routineData.semesters.forEach(sem => {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.textContent = `SEM ${sem}`;
        btn.className = `${baseClasses} ${sem === currentSelectedSemester ? activeClasses : inactiveClasses}`;
        btn.addEventListener('click', () => handleSemesterSelect(sem));
        semesterGrid.appendChild(btn);
    });
}

/**
 * Handle a semester button tap: switch the active semester, snap the
 * section dropdown to that semester's first section, and re-render.
 */
function handleSemesterSelect(sem) {
    if (sem === currentSelectedSemester) return;
    currentSelectedSemester = sem;
    currentSelectedSection = routineData.sections_by_semester?.[sem]?.[0] || currentSelectedSection;

    renderSemesterGrid();
    populateSectionDropdown();
    renderSystemState();
}

/**
 * Populate the section dropdown using ONLY the sections that belong to
 * the currently selected semester (fixes "dropdown shows all sections" bug).
 */
function populateSectionDropdown() {
    sectionSelect.innerHTML = "";
    const sectionsForSemester = routineData?.sections_by_semester?.[currentSelectedSemester] || [];

    sectionsForSemester.forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec;
        opt.textContent = `Section ${sec}`;
        if (sec === currentSelectedSection) opt.selected = true;
        sectionSelect.appendChild(opt);
    });
}

function attachEventHandlers() {
    sectionSelect.addEventListener('change', (e) => {
        currentSelectedSection = e.target.value;
        renderSystemState();
    });

    prevMonthBtn.addEventListener('click', () => {
        currentFocusedDate.setMonth(currentFocusedDate.getMonth() - 1);
        renderCalendarGrid();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentFocusedDate.setMonth(currentFocusedDate.getMonth() + 1);
        renderCalendarGrid();
    });
}

/**
 * Trigger master view pipeline synchronizations 
 */
function renderSystemState() {
    renderCalendarGrid();
    renderTimetableStream();
}

/**
 * Procedural Dynamic Execution: Build inline calendar day layout structures
 */
function renderCalendarGrid() {
    calendarDaysGrid.innerHTML = "";
    
    const year = currentFocusedDate.getFullYear();
    const month = currentFocusedDate.getMonth();
    
    // Set Header string text contextual payload values (e.g., MARCH 2026)
    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    calendarMonthYearHeader.textContent = `${monthNames[month]} ${year}`;
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Inject dead empty placeholder cells to properly structure the first calendar row offset
    for (let i = 0; i < firstDayIndex; i++) {
        const spacer = document.createElement('div');
        calendarDaysGrid.appendChild(spacer);
    }
    
    // Generate active clickable calendar elements
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
        const cellDateObj = new Date(year, month, dayNum);
        const cellISOString = formatToISODate(cellDateObj);
        
        const cellButton = document.createElement('button');
        cellButton.className = "calendar-cell-node p-2 rounded text-xs font-mono select-none hover:bg-neutral-900 border border-transparent";
        cellButton.textContent = dayNum;
        
        // Handle stylistic coloring treatments for structural exception overlays
        const exceptionMatch = routineData?.exceptions?.[cellISOString];
        if (exceptionMatch) {
            if (exceptionMatch.type === "holiday") {
                cellButton.classList.add('text-red-400', 'bg-red-500/5', 'border-red-500/10');
            } else if (exceptionMatch.type === "exam") {
                cellButton.classList.add('text-amber-400', 'bg-amber-500/5', 'border-amber-500/10');
            }
        } else {
            cellButton.classList.add('text-neutral-400', 'bg-[#0a0a0a]');
        }
        
        // Highlight active date selection match properties
        if (formatToISODate(activeSelectedDate) === cellISOString) {
            cellButton.classList.remove('text-neutral-400', 'text-red-400', 'text-amber-400', 'bg-[#0a0a0a]', 'bg-red-500/5', 'bg-amber-500/5');
            cellButton.classList.add('bg-blue-600', 'text-white', 'font-bold');
        }
        
        // Contextual user interaction operational event loop configurations
        cellButton.addEventListener('click', () => {
            activeSelectedDate = cellDateObj;
            renderSystemState();
        });
        
        calendarDaysGrid.appendChild(cellButton);
    }
}

/**
 * Primary Timetable Extraction Core: Cross-reference calendar clicks with JSON data records
 */
function renderTimetableStream() {
    scheduleOutputMount.innerHTML = "";
    
    const isoDateKey = formatToISODate(activeSelectedDate);
    selectedDateStringLabel.textContent = activeSelectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    
    // Check Pipeline Priority 1: Custom Exception Entry Maps
    const exceptionDay = routineData?.exceptions?.[isoDateKey];
    if (exceptionDay) {
        let textStyleClass = "text-red-400 bg-red-500/5 border-red-500/10";
        let statusBadgeText = "OFF DAY";
        
        if (exceptionDay.type === "exam") {
            textStyleClass = "text-amber-400 bg-amber-500/5 border-amber-500/10";
            statusBadgeText = "EXAMINATION MATRIX";
        }
        
        scheduleOutputMount.innerHTML = `
            <div class="border rounded-xl p-8 text-center space-y-2 ${textStyleClass}">
                <span class="text-[10px] uppercase font-mono tracking-widest font-bold px-2 py-0.5 rounded border border-current">${statusBadgeText}</span>
                <h4 class="text-base font-bold text-white pt-2">${exceptionDay.name}</h4>
                <p class="text-xs opacity-70">Standard core operational templates suspended on this index target.</p>
            </div>`;
        return;
    }
    
    // Check Pipeline Priority 2: Weekend Off-Day Check (Friday fallback standard example context)
    const dayNameStr = indexToDayMap[activeSelectedDate.getDay()];
    if (dayNameStr === "Friday" || dayNameStr === "Thursday") {
        renderEmptyStateCard("Standard System Maintenance Weekend Holiday");
        return;
    }
    
    // Check Pipeline Priority 3: Extract weekly routine template data
    const sectionRoutineContext = routineData?.weekly_routine?.[currentSelectedSection];
    const classesForDayArray = sectionRoutineContext?.[dayNameStr] || [];
    
    if (classesForDayArray.length === 0) {
        renderEmptyStateCard("No core lecture distribution assets allocated for this day block.");
        return;
    }
    
    // Render and build individual dynamic table record cards
    classesForDayArray.forEach(lectureItem => {
        const itemCard = document.createElement('div');
        itemCard.className = "bg-[#050505] border border-neutral-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-neutral-800 transition-colors";
        
        itemCard.innerHTML = `
            <div class="flex items-start gap-3.5">
                <div class="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-blue-500/40 border border-blue-500"></div>
                <div class="space-y-0.5">
                    <span class="text-xs font-mono text-neutral-500 uppercase">${lectureItem.time}</span>
                    <h3 class="text-base font-bold text-white tracking-tight">${lectureItem.subject}</h3>
                </div>
            </div>
            <div class="flex items-center gap-2 text-xs font-mono">
                <span class="bg-[#111] border border-neutral-800 px-2.5 py-1 rounded text-neutral-300">Instructor: ${lectureItem.teacher}</span>
                <span class="bg-[#111] border border-neutral-800 px-2.5 py-1 rounded text-blue-400">Room: ${lectureItem.room}</span>
            </div>`;
        scheduleOutputMount.appendChild(itemCard);
    });
}

function renderEmptyStateCard(msg) {
    scheduleOutputMount.innerHTML = `
        <div class="bg-[#050505] border border-neutral-900 border-dashed rounded-xl p-8 text-center text-xs font-mono text-neutral-500">
            ${msg}
        </div>`;
}

function formatToISODate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Spark Runtime Activation execution loop logic hook
window.addEventListener('DOMContentLoaded', initializeApp);