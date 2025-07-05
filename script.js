// --- Background Slideshow ---
function initBackgroundSlideshow() {
  const slideshow = document.querySelector('.background-slideshow');
  if (!slideshow) return;

  // Array of background images for the slideshow
  const backgrounds = [
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
  ];

  // Create slide elements
  backgrounds.forEach((bg, index) => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.style.backgroundImage = `url(${bg})`;
    if (index === 0) slide.classList.add('active');
    slideshow.appendChild(slide);
  });

  // Start slideshow
  let currentSlide = 0;
  const slides = slideshow.querySelectorAll('.slide');
  
  function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
  }

  // Change slide every 4 seconds
  setInterval(nextSlide, 4000);
}

// --- Emoji Rendering ---
function renderEmojis() {
  if (window.twemoji) {
    twemoji.parse(document.body);
  }
}

// --- Password Protection ---
const SITE_PASSWORD = 'rona2025'; // Change this to your desired password

// Check if user is already authenticated
function checkAuthentication() {
  if (sessionStorage.getItem('authenticated') === 'true') {
    showMainContent();
  } else {
    showPasswordScreen();
  }
}

// Show password screen
function showPasswordScreen() {
  document.getElementById('password-screen').style.display = 'flex';
  document.getElementById('main-content').style.display = 'none';
  
  // Focus on password input
  document.getElementById('password-input').focus();
  
  // Handle Enter key
  document.getElementById('password-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      checkPassword();
    }
  });
  
  // Handle login button
  document.getElementById('login-btn').addEventListener('click', checkPassword);
}

// Check password
function checkPassword() {
  const password = document.getElementById('password-input').value;
  const errorDiv = document.getElementById('password-error');
  
  if (password === SITE_PASSWORD) {
    sessionStorage.setItem('authenticated', 'true');
    showMainContent();
  } else {
    errorDiv.style.display = 'block';
    document.getElementById('password-input').value = '';
    document.getElementById('password-input').focus();
  }
}

// Show main content
function showMainContent() {
  document.getElementById('password-screen').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';
  initializeApp();
}

// Initialize the app (moved from global scope)
function initializeApp() {
  // Department switcher setup
  const deptSelect = document.getElementById('department-switcher');
  if (deptSelect) {
    deptSelect.value = getCurrentDepartment();
    deptSelect.addEventListener('change', (e) => {
      setCurrentDepartment(e.target.value);
      location.reload(); // For now, reload to re-init everything for the new department
    });
  }
  // Ensure not in edit mode on initial load
  setEditMode(false);
  // Debug: Log key dates
  const today = new Date();
  today.setHours(0,0,0,0);
  console.log('[DEBUG] Today:', today.toISOString().slice(0,10));
  console.log('[DEBUG] Initial weekStartDate:', weekStartDate);
  console.log('[DEBUG] getCurrentSundayISO():', getCurrentSundayISO());

  // On initial load, ensure weekStartDate is not in the past (do this FIRST)
  if (isWeekInPast(weekStartDate)) {
    weekStartDate = getCurrentSundayISO();
    console.log('[DEBUG] weekStartDate updated to current Sunday:', weekStartDate);
  }

  // Remove any schedule data before MIN_WEEK from the database on initial load
  fetch(`${API_BASE}/api/schedule/weeks?department=${encodeURIComponent(getCurrentDepartment())}`).then(res => res.json()).then(weeks => {
    weeks.forEach(week => {
      if (week < MIN_WEEK) {
        fetch(`${API_BASE}/api/schedule?week=${week}&department=${encodeURIComponent(getCurrentDepartment())}`, { method: 'DELETE' });
      }
    });
  });

  // Clear UI before loading
  document.getElementById('schedule-body').innerHTML = '';
  document.getElementById('print-preview').innerHTML = '';
  document.getElementById('warnings').innerHTML = '';

  cleanupOldWeeks().then(async () => {
    await loadEmployees();
    await loadAvailability(); // <-- Ensure availability is loaded before schedule data
    await loadData();
    createScheduleTable();
    updateSummary();
    highlightCoverage();
    renderPrintPreview();
    updateWeekRangeLabel();
    updatePrevButtonState();
    // Re-render emojis after all content is loaded
    renderEmojis();
  });

  // Week navigation arrows
  const prevBtn = document.getElementById('prev-week-btn');
  const nextBtn = document.getElementById('next-week-btn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      setEditMode(false);
      let d = new Date(weekStartDate);
      d.setDate(d.getDate() - 7);
      weekStartDate = d.toISOString().slice(0,10);
      if (isWeekInPast(weekStartDate)) {
        updatePrevButtonState();
        prevBtn.classList.add('shake');
        setTimeout(() => prevBtn.classList.remove('shake'), 400);
        return;
      }
      loadData().then(() => {
        createScheduleTable();
        updateSummary();
        highlightCoverage();
        renderPrintPreview();
        updateWeekRangeLabel();
        updatePrevButtonState();
        // Re-render emojis after navigation
        renderEmojis();
      });
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      setEditMode(false);
      let d = new Date(weekStartDate);
      d.setDate(d.getDate() + 7);
      weekStartDate = d.toISOString().slice(0,10);
      const minWeek = MIN_WEEK;
      if (weekStartDate < minWeek) {
        weekStartDate = minWeek;
      }
      loadData().then(() => {
        createScheduleTable();
        updateSummary();
        highlightCoverage();
        renderPrintPreview();
        updateWeekRangeLabel();
        updatePrevButtonState();
        // Re-render emojis after navigation
        renderEmojis();
      });
    });
  }

  // Add employee button logic
  document.getElementById('add-employee-btn').addEventListener('click', () => {
    if (!isEditMode) return;
    const newName = '';
    const newId = generateId();
    unsavedEmployees.push({ id: newId, name: newName });
    // Preserve scroll position
    const scrollY = window.scrollY;
    createScheduleTable();
    updateSummary();
    highlightCoverage();
    renderPrintPreview();
    window.scrollTo(window.scrollX, scrollY);
    // Re-render emojis after adding employee
    renderEmojis();
  });
  // Print button logic
  document.getElementById('print-btn').addEventListener('click', () => {
    window.print();
  });
  // Save button logic removed

  // Edit/Save Week Button Logic
  document.getElementById('edit-week-btn').addEventListener('click', () => {
    setEditMode(true);
  });
  document.getElementById('save-week-btn').addEventListener('click', async () => {
    applyEditsToEmployees();
    await saveEmployees();
    await saveAvailability();
    setEditMode(false);
    await saveData();
    createScheduleTable();
    updateSummary();
    highlightCoverage();
    renderPrintPreview();
    updateWeekRangeLabel();
    updatePrevButtonState();
    // Re-render emojis after saving
    renderEmojis();
  });
  document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    // Revert to last saved state
    unsavedEmployees = [];
    setEditMode(false);
    // Reload data from server to ensure we have the last saved state
    loadData().then(() => {
      createScheduleTable();
      updateSummary();
      highlightCoverage();
      renderPrintPreview();
      updateWeekRangeLabel();
      updatePrevButtonState();
      // Re-render emojis after canceling edit
      renderEmojis();
    });
  });
}

// --- Example Data ---
const employees = [];
let weekStartDate = getCurrentSundayISO(); // Always start with the current week
function generateId() {
  return 'emp_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
}

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Store availability by employee id
const availability = {};

// --- Store Hours ---
const storeHours = {
  Monday:    { open: 7, close: 21 },
  Tuesday:   { open: 7, close: 21 },
  Wednesday: { open: 7, close: 21 },
  Thursday:  { open: 7, close: 21 },
  Friday:    { open: 7, close: 21 },
  Saturday:  { open: 8, close: 20 },
  Sunday:    { open: 8, close: 20 }
};

// --- Generate Table ---
function createScheduleTable() {
  const tbody = document.getElementById('schedule-body');
  tbody.innerHTML = '';
  const dataSource = getActiveEmployees();
  dataSource.forEach((emp, idx) => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    // Employment type dropdown
    if (!emp.employmentType) emp.employmentType = 'full';
    const empTypeDiv = document.createElement('div');
    empTypeDiv.style = 'margin-bottom:2px;';
    const empTypeLabel = document.createElement('label');
    empTypeLabel.textContent = 'Type: ';
    empTypeLabel.style = 'font-size:0.93em;margin-right:2px;';
    const empTypeSelect = document.createElement('select');
    empTypeSelect.style = 'font-size:0.97em;padding:2px 8px;border-radius:6px;border:1px solid #e0e0e0;background:#f7f8fa;margin-right:6px;';
    empTypeSelect.innerHTML = '<option value="full">Full Time</option><option value="part">Part Time</option>';
    empTypeSelect.value = emp.employmentType;
    empTypeSelect.disabled = !isEditMode;
    empTypeSelect.addEventListener('change', e => {
      if (!isEditMode) return;
      emp.employmentType = e.target.value;
      createScheduleTable();
      // Re-render emojis after employment type change
      renderEmojis();
    });
    empTypeLabel.appendChild(empTypeSelect);
    empTypeDiv.appendChild(empTypeLabel);
    nameTd.appendChild(empTypeDiv);
    // Editable name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = emp.name || '';
    nameInput.placeholder = 'Employee';
    nameInput.className = 'employee-name-input';
    nameInput.style = 'width:120px;height:36px;margin-right:14px;font-weight:600;font-size:1.05rem;border-radius:7px;border:1px solid #e0e0e0;padding:5px 10px;background:#f7f8fa;vertical-align:middle;line-height:1.3;box-sizing:border-box;';
    nameInput.disabled = !isEditMode;
    nameInput.addEventListener('change', e => {
      if (!isEditMode) return;
      dataSource[idx].name = e.target.value.trim();
      // Preserve scroll position
      const scrollY = window.scrollY;
      createScheduleTable();
      window.scrollTo(window.scrollX, scrollY);
      updateSummary();
      checkUnderstaffed();
      checkAvailabilityConflicts();
      highlightCoverage();
      // Re-render emojis after name change
      renderEmojis();
    });
    nameInput.addEventListener('input', e => {
      if (!isEditMode) return;
      dataSource[idx].name = e.target.value.trim();
    });
    nameTd.appendChild(nameInput);
    // Edit Availability button
    const availBtn = document.createElement('button');
    availBtn.textContent = 'Edit Availability';
    availBtn.title = 'Edit Availability';
    availBtn.style = 'width:150px;height:36px;margin-left:14px;margin-top:7px;background:#f3f4f7;border:none;color:#007aff;font-size:1.05rem;cursor:pointer;border-radius:7px;padding:5px 10px;vertical-align:middle;line-height:1.3;box-sizing:border-box;display:inline-block;white-space:nowrap;';
    availBtn.disabled = !isEditMode;
    availBtn.addEventListener('click', () => {
      if (isEditMode) {
        // Open modal first, then preserve scroll position and update table
        openAvailabilityModal(emp.id);
        const scrollY = window.scrollY;
        createScheduleTable();
        window.scrollTo(window.scrollX, scrollY);
        // Re-render emojis after opening availability modal
        renderEmojis();
      }
    });
    nameTd.appendChild(availBtn);
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = 'Remove 🗑️';
    removeBtn.title = 'Remove Employee';
    removeBtn.style = 'margin-left:10px;margin-top:2px;background:none;border:none;color:#b71c1c;font-size:1.08rem;cursor:pointer;vertical-align:middle;padding:3px 8px;';
    removeBtn.disabled = !isEditMode;
    removeBtn.addEventListener('click', () => {
      if (!isEditMode) return;
      dataSource.splice(idx, 1);
      delete availability[emp.id];
      createScheduleTable();
      updateSummary();
      checkUnderstaffed();
      checkAvailabilityConflicts();
      highlightCoverage();
      saveEmployees();
      // Re-render emojis after removing employee
      renderEmojis();
    });
    nameTd.appendChild(removeBtn);
    tr.appendChild(nameTd);
    days.forEach((day) => {
      const td = document.createElement('td');
      // Get allowed ranges for this employee/day
      const allowedRanges = (availability[emp.id] && availability[emp.id][day]) ? availability[emp.id][day] : [];
      // If not available, show message and skip dropdowns
      if (allowedRanges.length === 0) {
        const notAvailDiv = document.createElement('div');
        notAvailDiv.textContent = 'Not Available';
        notAvailDiv.style = 'color:#b71c1c;font-size:1em;font-weight:500;padding:8px 0;';
        td.appendChild(notAvailDiv);
        tr.appendChild(td);
        return;
      }
      // Special day buttons and logic
      if (!emp.specialDays) emp.specialDays = {};
      if (!emp.schedule) emp.schedule = {};
      if (!emp.notes) emp.notes = {}; // Initialize notes for new employees
      // OFF checkbox
      const off = document.createElement('input');
      off.type = 'checkbox';
      off.className = 'off-day';
      off.title = 'Off';
      off.disabled = !isEditMode;
      // --- VAC and RDO buttons ---
      const vacBtn = document.createElement('button');
      vacBtn.textContent = 'VAC';
      vacBtn.title = 'Vacation';
      vacBtn.className = 'special-btn vac';
      vacBtn.style = 'margin-left:6px;font-size:0.95em;cursor:pointer;border-radius:6px;padding:2px 8px;';
      vacBtn.disabled = !isEditMode;
      const rdoBtn = document.createElement('button');
      rdoBtn.textContent = 'RDO';
      rdoBtn.title = 'Requested Day Off';
      rdoBtn.className = 'special-btn rdo';
      rdoBtn.style = 'margin-left:6px;font-size:0.95em;cursor:pointer;border-radius:6px;padding:2px 8px;';
      rdoBtn.disabled = !isEditMode;
      // STAT button (for stat holidays, only for full time)
      const statBtn = document.createElement('button');
      statBtn.textContent = 'STAT';
      statBtn.title = 'Stat Holiday';
      statBtn.className = 'special-btn stat';
      statBtn.style = 'margin-left:6px;font-size:0.95em;cursor:pointer;border-radius:6px;padding:2px 8px;white-space:nowrap;';
      statBtn.disabled = !isEditMode;
      // Highlight if set
      function updateSpecialDayStyles() {
        vacBtn.classList.remove('selected');
        rdoBtn.classList.remove('selected');
        statBtn.classList.remove('selected');
        if (emp.specialDays[day] === 'VAC') vacBtn.classList.add('selected');
        if (emp.specialDays[day] === 'RDO') rdoBtn.classList.add('selected');
        if (emp.specialDays[day] === 'STAT') statBtn.classList.add('selected');
        off.checked = emp.specialDays[day] === 'OFF';
      }
      vacBtn.onclick = (e) => {
        if (!isEditMode) return;
        e.preventDefault();
        emp.specialDays[day] = emp.specialDays[day] === 'VAC' ? undefined : 'VAC';
        if (emp.specialDays[day]) {
          off.checked = false;
          emp.specialDays[day] = 'VAC';
        }
        if (emp.specialDays[day] === 'VAC') emp.specialDays[day] = 'VAC';
        if (emp.specialDays[day] !== 'VAC') emp.specialDays[day] = undefined;
        updateSpecialDayStyles();
        handleScheduleChange();
      };
      rdoBtn.onclick = (e) => {
        if (!isEditMode) return;
        e.preventDefault();
        emp.specialDays[day] = emp.specialDays[day] === 'RDO' ? undefined : 'RDO';
        if (emp.specialDays[day]) {
          off.checked = false;
          emp.specialDays[day] = 'RDO';
        }
        if (emp.specialDays[day] === 'RDO') emp.specialDays[day] = 'RDO';
        if (emp.specialDays[day] !== 'RDO') emp.specialDays[day] = undefined;
        updateSpecialDayStyles();
        handleScheduleChange();
      };
      statBtn.onclick = (e) => {
        if (!isEditMode) return;
        e.preventDefault();
        emp.specialDays[day] = emp.specialDays[day] === 'STAT' ? undefined : 'STAT';
        if (emp.specialDays[day]) {
          off.checked = false;
          emp.specialDays[day] = 'STAT';
        }
        if (emp.specialDays[day] === 'STAT') emp.specialDays[day] = 'STAT';
        if (emp.specialDays[day] !== 'STAT') emp.specialDays[day] = undefined;
        updateSpecialDayStyles();
        handleScheduleChange();
      };
      off.addEventListener('change', () => {
        if (!isEditMode) return;
        if (off.checked) {
          emp.specialDays[day] = 'OFF';
          vacBtn.style.opacity = '0.5';
          rdoBtn.style.opacity = '0.5';
          statBtn.style.opacity = '0.5';
        } else if (emp.specialDays[day] === 'OFF') {
          emp.specialDays[day] = undefined;
        }
        updateSpecialDayStyles();
        handleScheduleChange();
      });
      updateSpecialDayStyles();
      // Shift time dropdowns
      const startHour = document.createElement('select');
      startHour.className = 'start-hour';
      startHour.dataset.employee = emp.id;
      startHour.dataset.day = day;
      startHour.disabled = !isEditMode;
      const startHourDefault = document.createElement('option');
      startHourDefault.value = '';
      startHourDefault.textContent = '--';
      startHour.appendChild(startHourDefault);
      for (let h = 1; h <= 12; h++) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h;
        startHour.appendChild(opt);
      }
      // Start min
      const startMin = document.createElement('select');
      startMin.className = 'start-min';
      startMin.dataset.employee = emp.id;
      startMin.dataset.day = day;
      startMin.disabled = !isEditMode;
      const startMinDefault = document.createElement('option');
      startMinDefault.value = '';
      startMinDefault.textContent = '--';
      startMin.appendChild(startMinDefault);
      ['00', '15', '30', '45'].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        startMin.appendChild(opt);
      });
      // Start ampm
      const startAmPm = document.createElement('select');
      startAmPm.className = 'start-ampm';
      startAmPm.dataset.employee = emp.id;
      startAmPm.dataset.day = day;
      startAmPm.disabled = !isEditMode;
      const startAmPmDefault = document.createElement('option');
      startAmPmDefault.value = '';
      startAmPmDefault.textContent = '--';
      startAmPm.appendChild(startAmPmDefault);
      ['AM', 'PM'].forEach(ampm => {
        const opt = document.createElement('option');
        opt.value = ampm;
        opt.textContent = ampm;
        startAmPm.appendChild(opt);
      });
      // End hour
      const endHour = document.createElement('select');
      endHour.className = 'end-hour';
      endHour.dataset.employee = emp.id;
      endHour.dataset.day = day;
      endHour.disabled = !isEditMode;
      const endHourDefault = document.createElement('option');
      endHourDefault.value = '';
      endHourDefault.textContent = '--';
      endHour.appendChild(endHourDefault);
      for (let h = 1; h <= 12; h++) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h;
        endHour.appendChild(opt);
      }
      // End min
      const endMin = document.createElement('select');
      endMin.className = 'end-min';
      endMin.dataset.employee = emp.id;
      endMin.dataset.day = day;
      endMin.disabled = !isEditMode;
      const endMinDefault = document.createElement('option');
      endMinDefault.value = '';
      endMinDefault.textContent = '--';
      endMin.appendChild(endMinDefault);
      ['00', '15', '30', '45'].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        endMin.appendChild(opt);
      });
      // End ampm
      const endAmPm = document.createElement('select');
      endAmPm.className = 'end-ampm';
      endAmPm.dataset.employee = emp.id;
      endAmPm.dataset.day = day;
      endAmPm.disabled = !isEditMode;
      const endAmPmDefault = document.createElement('option');
      endAmPmDefault.value = '';
      endAmPmDefault.textContent = '--';
      endAmPm.appendChild(endAmPmDefault);
      ['AM', 'PM'].forEach(ampm => {
        const opt = document.createElement('option');
        opt.value = ampm;
        opt.textContent = ampm;
        endAmPm.appendChild(opt);
      });
      // Set dropdowns from emp.schedule if present
      let sched = emp.schedule[day];
      if (sched && sched.length === 2) {
        // Set start
        let start = sched[0];
        let end = sched[1];
        let startH = Math.floor(start);
        let startM = Math.round((start - startH) * 60).toString().padStart(2, '0');
        let startA = startH >= 12 ? 'PM' : 'AM';
        let startHourVal = startH % 12;
        if (startHourVal === 0) startHourVal = 12;
        startHour.value = startHourVal;
        startMin.value = startM;
        startAmPm.value = startA;
        // Set end
        let endH = Math.floor(end);
        let endM = Math.round((end - endH) * 60).toString().padStart(2, '0');
        let endA = endH >= 12 ? 'PM' : 'AM';
        let endHourVal = endH % 12;
        if (endHourVal === 0) endHourVal = 12;
        endHour.value = endHourVal;
        endMin.value = endM;
        endAmPm.value = endA;
      }
      // When dropdowns change, update emp.schedule
      function updateDayFromDropdowns() {
        if (!isEditMode) return;
        const sHour = startHour.value;
        const sMin = startMin.value;
        const sAmPm = startAmPm.value;
        const eHour = endHour.value;
        const eMin = endMin.value;
        const eAmPm = endAmPm.value;
        if (sHour && sMin && sAmPm && eHour && eMin && eAmPm) {
          let sh = parseInt(sHour, 10);
          let sm = parseInt(sMin, 10);
          let eh = parseInt(eHour, 10);
          let em = parseInt(eMin, 10);
          let s24 = (sAmPm === 'PM' && sh !== 12 ? sh + 12 : sAmPm === 'AM' && sh === 12 ? 0 : sh) + sm / 60;
          let e24 = (eAmPm === 'PM' && eh !== 12 ? eh + 12 : eAmPm === 'AM' && eh === 12 ? 0 : eh) + em / 60;
          if (s24 !== e24) {
            emp.schedule[day] = [s24, e24];
          } else {
            emp.schedule[day] = [];
          }
        } else {
          emp.schedule[day] = [];
        }
        handleScheduleChange();
        // Update only the availability preview for this cell
        const availPreview = td.querySelector('.availability-preview');
        if (availPreview) {
          // Rebuild the preview using the same logic as in createScheduleTable
          function readableTime(val) {
            if (val === undefined || val === "" || val === null || isNaN(val)) return null;
            let h = Math.floor(val);
            let m = Math.round((val - h) * 60);
            let ampm = h >= 12 ? 'PM' : 'AM';
            let hour = h % 12;
            if (hour === 0) hour = 12;
            return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
          }
          let hasConflict = false;
          let startH = undefined, endH = undefined;
          let invalidShift = false;
          if (sHour && sMin && sAmPm && eHour && eMin && eAmPm) {
            let sh = parseInt(sHour, 10);
            let sm = parseInt(sMin, 10);
            let eh = parseInt(eHour, 10);
            let em = parseInt(eMin, 10);
            startH = (sAmPm === 'PM' && sh !== 12 ? sh + 12 : sAmPm === 'AM' && sh === 12 ? 0 : sh) + sm / 60;
            endH = (eAmPm === 'PM' && eh !== 12 ? eh + 12 : eAmPm === 'AM' && eh === 12 ? 0 : eh) + em / 60;
            if (endH <= startH) {
              invalidShift = true;
            }
          }
          const allowedRanges = (availability[emp.id] && availability[emp.id][day]) ? availability[emp.id][day] : [];
          if (startH !== undefined && endH !== undefined && endH > startH) {
            const match = allowedRanges.some(([a, b]) => startH >= a && endH <= b);
            if (!match && allowedRanges.length > 0) {
              hasConflict = true;
            }
            if (allowedRanges.length === 0) {
              hasConflict = true;
            }
          }
          if (allowedRanges.length > 0) {
            availPreview.innerHTML = allowedRanges.map(([a, b]) => {
              if (a === 0 && b === 0) return '<span style="color:#b71c1c;">Not Available</span>';
              const startStr = readableTime(a);
              const endStr = readableTime(b);
              if (startStr && endStr && a !== b) {
                return `${startStr} - ${endStr}`;
              } else {
                return '<span style="color:#b71c1c;">Not Available</span>';
              }
            }).join('<br>');
          } else {
            availPreview.innerHTML = '<span style="color:#b71c1c;">Not Available</span>';
          }
          if (hasConflict || invalidShift) {
            availPreview.innerHTML += ' ⚠️';
          }
        }
      }
      [startHour, startMin, startAmPm, endHour, endMin, endAmPm].forEach(el => {
        el.addEventListener('change', updateDayFromDropdowns);
      });
      // Layout
      const timeRow = document.createElement('div');
      timeRow.className = 'time-range-row';
      const startGroup = document.createElement('span');
      startGroup.style.display = 'inline-flex';
      startGroup.style.alignItems = 'center';
      startGroup.appendChild(startHour);
      const sep1 = document.createElement('span'); sep1.textContent = ':'; sep1.className = 'time-sep';
      startGroup.appendChild(sep1);
      startGroup.appendChild(startMin);
      startGroup.appendChild(startAmPm);
      const endGroup = document.createElement('span');
      endGroup.style.display = 'inline-flex';
      endGroup.style.alignItems = 'center';
      endGroup.appendChild(endHour);
      const sep2 = document.createElement('span'); sep2.textContent = ':'; sep2.className = 'time-sep';
      endGroup.appendChild(sep2);
      endGroup.appendChild(endMin);
      endGroup.appendChild(endAmPm);
      timeRow.appendChild(startGroup);
      const dash = document.createElement('span'); dash.textContent = ' – '; dash.className = 'time-sep';
      timeRow.appendChild(dash);
      timeRow.appendChild(endGroup);
      td.appendChild(timeRow);
      // Special controls row
      const controlsRow = document.createElement('div');
      controlsRow.className = 'special-controls-row';
      const offLabel = document.createElement('label');
      offLabel.style.display = 'inline-flex';
      offLabel.style.alignItems = 'center';
      offLabel.style.gap = '2px';
      offLabel.style.whiteSpace = 'nowrap';
      offLabel.appendChild(off);
      offLabel.appendChild(document.createTextNode('Off'));
      controlsRow.appendChild(offLabel);
      controlsRow.appendChild(rdoBtn);
      controlsRow.appendChild(vacBtn);
      if (emp.employmentType === 'full') controlsRow.appendChild(statBtn);
      td.appendChild(controlsRow);
      // --- Add Note Button ---
      const noteBtn = document.createElement('button');
      noteBtn.textContent = emp.notes && emp.notes[day] ? '📋' : '📝';
      noteBtn.title = emp.notes && emp.notes[day] ? `Note: ${emp.notes[day]}` : 'Add Note';
      
      // More subtle styling for notes - noticeable but not overwhelming
      if (emp.notes && emp.notes[day]) {
        noteBtn.style = 'margin-top:4px;font-size:1em;cursor:pointer;border-radius:4px;padding:3px 6px;background:#e8f5e8;border:1px solid #4caf50;color:#2e7d32;font-weight:500;';
      } else {
        noteBtn.style = 'margin-top:4px;font-size:0.9em;cursor:pointer;border-radius:4px;padding:2px 6px;background:#f0f0f0;border:1px solid #ccc;';
      }
      
      noteBtn.disabled = !isEditMode;
      noteBtn.onclick = (e) => {
        if (!isEditMode) return;
        e.preventDefault();
        const note = prompt('Enter note for this day:', emp.notes && emp.notes[day] ? emp.notes[day] : '');
        if (note !== null) {
          if (!emp.notes) emp.notes = {};
          if (note.trim() === '') {
            delete emp.notes[day];
          } else {
            emp.notes[day] = note.trim();
          }
          handleScheduleChange();
          createScheduleTable(); // Recreate to update visual styling
        }
      };
      td.appendChild(noteBtn);
      
      // --- Delete Note Button (only show when note exists) ---
      if (emp.notes && emp.notes[day]) {
        const deleteNoteBtn = document.createElement('button');
        deleteNoteBtn.textContent = '🗑️';
        deleteNoteBtn.title = 'Delete Note';
        deleteNoteBtn.style = 'margin-top:4px;margin-left:3px;font-size:0.9em;cursor:pointer;border-radius:4px;padding:2px 5px;background:#ffe8e8;border:1px solid #f44336;color:#d32f2f;';
        deleteNoteBtn.disabled = !isEditMode;
        deleteNoteBtn.onclick = (e) => {
          if (!isEditMode) return;
          e.preventDefault();
          if (confirm(`Delete note "${emp.notes[day]}"?`)) {
            delete emp.notes[day];
            handleScheduleChange();
            createScheduleTable(); // Recreate to update visual styling
          }
        };
        td.appendChild(deleteNoteBtn);
      }
      // --- End Delete Note Button ---
      // --- Availability Preview (below controlsRow) ---
      const availPreview = document.createElement('div');
      availPreview.className = 'availability-preview';
      availPreview.style = 'font-size:0.92em;color:#888;margin-top:8px;font-style:italic;white-space:nowrap;';
      function readableTime(val) {
        if (val === undefined || val === "" || val === null || isNaN(val)) return null;
        let h = Math.floor(val);
        let m = Math.round((val - h) * 60);
        let ampm = h >= 12 ? 'PM' : 'AM';
        let hour = h % 12;
        if (hour === 0) hour = 12;
        return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
      }
      
      // Check for schedule conflict using current dropdowns if in edit mode
      let hasConflict = false;
      let startH = undefined, endH = undefined;
      let invalidShift = false;
      if (isEditMode) {
        // Try to get dropdown values for this cell
        const startHour = td.querySelector('select.start-hour');
        const startMin = td.querySelector('select.start-min');
        const startAmPm = td.querySelector('select.start-ampm');
        const endHour = td.querySelector('select.end-hour');
        const endMin = td.querySelector('select.end-min');
        const endAmPm = td.querySelector('select.end-ampm');
        if (startHour && startMin && startAmPm && endHour && endMin && endAmPm && startHour.value && startMin.value && startAmPm.value && endHour.value && endMin.value && endAmPm.value) {
          startH = getTimeFromDropdowns(startHour, startMin, startAmPm);
          endH = getTimeFromDropdowns(endHour, endMin, endAmPm);
          if (endH <= startH) {
            invalidShift = true;
          }
        }
      } else if (emp.schedule && emp.schedule[day]) {
        // Fallback to saved schedule
        const scheduleTime = emp.schedule[day];
        if (scheduleTime.start !== undefined && scheduleTime.end !== undefined) {
          startH = scheduleTime.start;
          endH = scheduleTime.end;
          if (endH <= startH) {
            invalidShift = true;
          }
        }
      }
      if (startH !== undefined && endH !== undefined && endH > startH) {
        // Check if this time block is in allowed availability
        const match = allowedRanges.some(([a, b]) => startH >= a && endH <= b);
        if (!match && allowedRanges.length > 0) {
          hasConflict = true;
        }
        if (allowedRanges.length === 0) {
          hasConflict = true;
        }
      }
      
      if (allowedRanges.length > 0) {
        availPreview.innerHTML = allowedRanges.map(([a, b]) => {
          if (a === 0 && b === 0) return '<span style="color:#b71c1c;">Not Available</span>';
          const startStr = readableTime(a);
          const endStr = readableTime(b);
          if (startStr && endStr && a !== b) {
            return `${startStr} - ${endStr}`;
          } else {
            return '<span style="color:#b71c1c;">Not Available</span>';
          }
        }).join('<br>');
      } else {
        availPreview.innerHTML = '<span style="color:#b71c1c;">Not Available</span>';
      }
      
      // Show warning if invalid shift or out of availability
      if (invalidShift || hasConflict) {
        availPreview.innerHTML += ' ⚠️';
      }
      
      td.appendChild(availPreview);
      // --- End availability preview ---
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  renderDateHeaderWithDates();
}

// --- Handle Schedule Changes ---
function handleScheduleChange() {
  updateSummary();
  checkUnderstaffed();
  checkAvailabilityConflicts();
  highlightCoverage();
  renderPrintPreview();
  // Update notes summary if in edit mode
  if (isEditMode) {
    showNotesSummary();
  }
  // Re-render emojis after schedule changes
  renderEmojis();
  // Removed saveData() from here
}

// --- Backend Integration ---
// Use the current hostname so API requests work from any device
// API base URL - points to the backend service
const API_BASE = 'https://rona-scheduler.onrender.com';

// Network status indicator
function showNetworkStatus(isOnline) {
  let statusDiv = document.getElementById('network-status');
  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.id = 'network-status';
    statusDiv.style = 'position:fixed;top:18px;left:18px;z-index:9999;padding:8px 16px;border-radius:6px;font-size:0.9em;box-shadow:0 2px 8px #0002;';
    document.body.appendChild(statusDiv);
  }
  
  if (isOnline) {
    statusDiv.textContent = '🟢 Online';
    statusDiv.style.background = '#e0ffe0';
    statusDiv.style.color = '#007a33';
    statusDiv.style.border = '1px solid #007a33';
    statusDiv.style.display = 'none';
  } else {
    statusDiv.textContent = '🔴 Offline - Changes saved locally';
    statusDiv.style.background = '#ffe0e0';
    statusDiv.style.color = '#b71c1c';
    statusDiv.style.border = '1px solid #b71c1c';
    statusDiv.style.display = 'block';
  }
}

// Fetch and restore availability on page load
async function loadAvailability() {
  try {
    const res = await fetch(`${API_BASE}/api/availability?department=${encodeURIComponent(getCurrentDepartment())}`);
    const avail = await res.json();
    Object.keys(avail).forEach(empId => {
      availability[empId] = avail[empId];
    });
  } catch (err) {
    console.error('[DEBUG] Failed to load availability:', err);
    showNetworkStatus(false);
  }
}

// Save availability to backend
async function saveAvailability() {
  try {
    await fetch(`${API_BASE}/api/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: availability, department: getCurrentDepartment() })
    });
  } catch (err) {
    console.error('[DEBUG] Failed to save availability:', err);
    showNetworkStatus(false);
  }
}

async function loadEmployees() {
  try {
    const res = await fetch(`${API_BASE}/api/employees?department=${encodeURIComponent(getCurrentDepartment())}`);
    const emps = await res.json();
    employees.length = 0;
    emps.forEach(e => employees.push(e));
  } catch (err) {
    console.error('[DEBUG] Failed to load employees:', err);
    showNetworkStatus(false);
  }
}
async function saveEmployees() {
  try {
    await fetch(`${API_BASE}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: employees, department: getCurrentDepartment() })
    });
  } catch (err) {
    console.error('[DEBUG] Failed to save employees:', err);
    showNetworkStatus(false);
  }
}

async function loadData() {
  // Ensure weekStartDate is never before MIN_WEEK
  if (!weekStartDate || weekStartDate < MIN_WEEK) {
    weekStartDate = MIN_WEEK;
    console.log('[DEBUG] loadData forced weekStartDate to MIN_WEEK:', weekStartDate);
  }
  try {
    // Clear warnings before loading new data
    document.getElementById('warnings').innerHTML = '';
    console.log('[DEBUG] Loading data for week:', weekStartDate);
    const res = await fetch(`${API_BASE}/api/schedule?week=${weekStartDate}&department=${encodeURIComponent(getCurrentDepartment())}`);
    const schedData = await res.json();
    console.log('[DEBUG] Data received from backend:', JSON.stringify(schedData));
    // Clear schedule and specialDays for all employees (week-specific)
    employees.forEach(emp => {
      emp.schedule = {};
      emp.specialDays = {};
      emp.notes = {}; // Clear notes for all employees
    });
    // Restore per-week schedule/specialDays if present
    if (schedData.schedules) {
      for (const empId in schedData.schedules) {
        const emp = employees.find(e => e.id === empId);
        if (emp) {
          emp.schedule = schedData.schedules[empId].schedule || {};
          emp.specialDays = schedData.schedules[empId].specialDays || {};
          emp.notes = schedData.schedules[empId].notes || {}; // Restore notes
        }
      }
    }
    createScheduleTable();
    updateSummary();
    highlightCoverage();
    renderPrintPreview();
    updateWeekRangeLabel();
    updatePrevButtonState();
    checkUnderstaffed(); // Always recalculate warnings for the current week
    // Re-render emojis after loading data
    renderEmojis();
  } catch (err) {
    showStatus('Failed to load data from server.', true);
    console.error('[DEBUG] Load error:', err);
  }
}
async function saveData() {
  try {
    // Save only per-week schedule/specialDays
    const schedules = {};
    employees.forEach(emp => {
      schedules[emp.id] = {
        schedule: emp.schedule || {},
        specialDays: emp.specialDays || {},
        notes: emp.notes || {} // Include notes in the payload
      };
    });
    const payload = { weekStartDate, schedules, department: getCurrentDepartment() };
    console.log('[DEBUG] Payload being sent to backend:', JSON.stringify(payload));
    const res = await fetch(`${API_BASE}/api/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    console.log('[DEBUG] Save response:', result);
    showStatus('Schedule saved!', false);
  } catch (err) {
    showStatus('Failed to save data.', true);
    console.error('[DEBUG] Save error:', err);
  }
}

async function cleanupOldWeeks() {
  // Only run if weekStartDate is set
  if (!weekStartDate) return;
  try {
    const res = await fetch(`${API_BASE}/api/schedule/weeks?department=${encodeURIComponent(getCurrentDepartment())}`);
    const weeks = await res.json();
    for (const week of weeks) {
      if (week < weekStartDate) {
        await fetch(`${API_BASE}/api/schedule?week=${week}&department=${encodeURIComponent(getCurrentDepartment())}`, { method: 'DELETE' });
      }
    }
  } catch (err) {
    // Ignore errors for now
  }
}

function showStatus(msg, isError) {
  let div = document.getElementById('status-msg');
  if (!div) {
    div = document.createElement('div');
    div.id = 'status-msg';
    div.style = 'position:fixed;top:18px;right:18px;z-index:9999;padding:12px 22px;border-radius:9px;font-size:1.08em;box-shadow:0 2px 12px #0002;';
    document.body.appendChild(div);
  }
  div.textContent = msg;
  div.style.background = isError ? '#ffd6d6' : '#e0ffe0';
  div.style.color = isError ? '#b71c1c' : '#007a33';
  div.style.border = isError ? '1.5px solid #b71c1c' : '1.5px solid #007a33';
  div.style.display = 'block';
  setTimeout(() => { div.style.display = 'none'; }, 2500);
}

// --- Week Selector Logic ---

// Helper: Check if a week (Sunday-Saturday) is in the past
function isWeekInPast(weekStartDateStr) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const weekStart = new Date(weekStartDateStr);
  weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Saturday
  return weekEnd < today;
}

// For <input type=date>, get the previous Sunday for any selected date
function getSundayOfDate(dateStr) {
  // Parse as local date (not UTC)
  const [year, month, day] = dateStr.split('-').map(Number);
  // Always construct as local date
  const selected = new Date(year, month - 1, day);
  selected.setHours(0,0,0,0);
  // Calculate previous (or same) Sunday
  const dayOfWeek = selected.getDay();
  const sunday = new Date(selected);
  sunday.setDate(selected.getDate() - dayOfWeek);
  sunday.setHours(0,0,0,0);
  return sunday;
}

function getCurrentRealWorldSunday() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  return sunday.toISOString().slice(0,10);
}

function updatePrevButtonState() {
  const prevBtn = document.getElementById('prev-week-btn');
  if (!prevBtn) return;
  const currentSunday = getCurrentRealWorldSunday();
  if (weekStartDate <= currentSunday) {
    prevBtn.disabled = true;
    prevBtn.style.opacity = '0.5';
    prevBtn.style.cursor = 'not-allowed';
    prevBtn.style.background = '#eee';
    prevBtn.title = 'Cannot go to previous week';
  } else {
    prevBtn.disabled = false;
    prevBtn.style.opacity = '1';
    prevBtn.style.cursor = 'pointer';
    prevBtn.style.background = '#f7f8fa';
    prevBtn.title = 'Go to previous week';
  }
}

// --- Canadian Statutory Holidays (basic, can be expanded per province) ---
const canadianHolidays = [
  // Format: { month: 1-12, day: 1-31, name: 'Holiday Name' }
  { month: 1, day: 1, name: 'New Year\'s Day' },
  { month: 7, day: 1, name: 'Canada Day' },
  { month: 12, day: 25, name: 'Christmas Day' },
  { month: 12, day: 26, name: 'Boxing Day' },
  { month: 9, day: 2, name: 'Labour Day', floating: 'first-monday-sept' }, // Will handle below
  { month: 5, day: 24, name: 'Victoria Day', floating: 'monday-before-25-may' },
  { month: 10, day: 14, name: 'Thanksgiving', floating: 'second-monday-oct' },
  // Add more as needed
];

// Map holiday names to unique emojis
const holidayEmojis = {
  "New Year's Day": '🎉',
  "Canada Day": '🇨🇦',
  "Christmas Day": '🎄',
  "Boxing Day": '📦',
  "Labour Day": '🛠️',
  "Victoria Day": '👑',
  "Thanksgiving": '🦃',
};

function getHolidayEmoji(holidayName) {
  return holidayEmojis[holidayName] || '🎉';
}

function getHolidayForDate(date) {
  // date: JS Date object
  const m = date.getMonth() + 1;
  const d = date.getDate();
  // Fixed-date holidays
  for (const h of canadianHolidays) {
    if (!h.floating && h.month === m && h.day === d) return h.name;
  }
  // Floating holidays
  // Labour Day: first Monday in September
  if (m === 9 && date.getDay() === 1 && d <= 7) return 'Labour Day';
  // Victoria Day: Monday before May 25
  if (m === 5 && date.getDay() === 1 && d >= 18 && d <= 24) return 'Victoria Day';
  // Thanksgiving: second Monday in October
  if (m === 10 && date.getDay() === 1 && d >= 8 && d <= 14) return 'Thanksgiving';
  return null;
}

function getDateRowLabels() {
  // Always start from weekStartDate (Sunday), parse as local date to avoid timezone bugs
  let baseDate;
  if (weekStartDate) {
    const [year, month, day] = weekStartDate.split('-').map(Number);
    baseDate = new Date(year, month - 1, day);
  } else {
    baseDate = new Date();
  }
  baseDate.setHours(0,0,0,0);
  console.log('[DEBUG] getDateRowLabels: baseDate:', baseDate.toISOString());
  let labels = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate.getTime()); // clone baseDate
    d.setDate(d.getDate() + i); // add i days
    const holiday = getHolidayForDate(d);
    let label = `${d.getMonth()+1}/${d.getDate()}`;
    if (holiday) label += ` ${getHolidayEmoji(holiday)} ${holiday}`;
    labels.push(label);
  }
  console.log('[DEBUG] getDateRowLabels: weekStartDate:', weekStartDate, 'labels:', labels);
  return labels;
}

function renderDateRow() {
  // Remove the date row entirely
  const dateRow = document.getElementById('date-row');
  if (dateRow && dateRow.parentNode) {
    dateRow.parentNode.removeChild(dateRow);
  }
}

function updateWeekRangeLabel() {
  const label = document.getElementById('week-range-label');
  if (!label) return;
  if (!weekStartDate) {
    label.textContent = '';
    return;
  }
  // Parse weekStartDate as local date
  const [year, month, day] = weekStartDate.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day);
  end.setDate(start.getDate() + 6);
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  label.textContent = `${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, options)}`;
  console.log('[DEBUG] updateWeekRangeLabel:', label.textContent, 'weekStartDate:', weekStartDate);
}

let isEditMode = false;
let unsavedEmployees = [];

function setEditMode(editing) {
  isEditMode = editing;
  document.getElementById('edit-week-btn').style.display = editing ? 'none' : '';
  document.getElementById('save-week-btn').style.display = editing ? '' : 'none';
  document.getElementById('cancel-edit-btn').style.display = editing ? '' : 'none';
  // Toggle editing/not-editing class on body
  document.body.classList.toggle('editing', editing);
  document.body.classList.toggle('not-editing', !editing);
  // Show/hide add employee button
  const addEmpBtn = document.getElementById('add-employee-btn');
  if (addEmpBtn) addEmpBtn.style.display = editing ? '' : 'none';
  if (editing) {
    console.log('[EDIT MODE] Entered edit mode for week', weekStartDate);
    unsavedEmployees = JSON.parse(JSON.stringify(employees));
    showNotesSummary();
  } else {
    console.log('[EDIT MODE] Exited edit mode for week', weekStartDate);
    unsavedEmployees = [];
    hideNotesSummary();
  }
  createScheduleTable();
  // Re-render emojis after edit mode change
  renderEmojis();
}

function getActiveEmployees() {
  return isEditMode ? unsavedEmployees : employees;
}

function applyEditsToEmployees() {
  employees.length = 0;
  unsavedEmployees.forEach(e => employees.push(e));
  saveEmployees();
}

const MIN_WEEK = '2025-06-29';
function getCurrentSundayISO() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  return sunday.toISOString().slice(0,10);
}

function printSchedule() {
  window.print();
}

// --- Department Switcher Logic ---
const departmentOptions = [
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'head_cashier', label: 'Head Cashier' },
  { value: 'loadout', label: 'Loadout' },
  { value: 'front_end', label: 'Front End' },
];

function getCurrentDepartment() {
  return localStorage.getItem('rona_department') || 'customer_service';
}

function setCurrentDepartment(dept) {
  localStorage.setItem('rona_department', dept);
}

// Start the application with password protection
document.addEventListener('DOMContentLoaded', () => {
  initBackgroundSlideshow();
  checkAuthentication();
});

// --- Summary Row ---
function updateSummary() {
  const summaryRow = document.getElementById('summary-row');
  while (summaryRow.children.length > 1) summaryRow.removeChild(summaryRow.lastChild);
  let grandTotal = 0;
  const dataSource = getActiveEmployees();
  days.forEach((day) => {
    let totalHours = 0;
    let employeesScheduled = 0;
    dataSource.forEach((emp) => {
      if (emp.specialDays && emp.specialDays[day] === 'OFF') return;
      if (emp.schedule && Array.isArray(emp.schedule[day]) && emp.schedule[day].length === 2) {
        const startH = emp.schedule[day][0];
        const endH = emp.schedule[day][1];
        if (endH > startH) {
          totalHours += endH - startH;
          employeesScheduled++;
        }
      }
    });
    const td = document.createElement('td');
    td.innerHTML = `<strong>${totalHours}h</strong><br><span style="font-size:0.9em;">${employeesScheduled} staff</span>`;
    summaryRow.appendChild(td);
    grandTotal += totalHours;
  });
  // Update the first cell to show the grand total
  summaryRow.children[0].innerHTML = `<strong>Totals (${grandTotal}h)</strong>`;
}

function getTimeFromDropdowns(hourSel, minSel, ampmSel) {
  let h = parseInt(hourSel.value, 10);
  let m = parseInt(minSel.value, 10);
  if (ampmSel.value === 'PM' && h !== 12) h += 12;
  if (ampmSel.value === 'AM' && h === 12) h = 0;
  return h + m / 60;
}

// --- Understaffed Check ---
function checkUnderstaffed() {
  let warnings = [];
  const dataSource = getActiveEmployees();
  days.forEach(day => {
    let count = 0;
    dataSource.forEach(emp => {
      if (emp.specialDays && emp.specialDays[day] === 'OFF') return;
      if (emp.schedule && Array.isArray(emp.schedule[day]) && emp.schedule[day].length === 2) {
        const startH = emp.schedule[day][0];
        const endH = emp.schedule[day][1];
        if (endH > startH) count++;
      }
    });
    if (count < 3) {
      warnings.push(`Warning: Less than 3 employees scheduled on <strong>${day}</strong>.`);
    }
  });
  showWarnings(warnings);
}

// --- Availability Conflict Check ---
function checkAvailabilityConflicts() {
  let warnings = [];
  employees.forEach(emp => {
    days.forEach(day => {
      const off = document.querySelector(`input.off-day[data-employee="${emp.id}"][data-day="${day}"]`);
      const startHour = document.querySelector(`select.start-hour[data-employee="${emp.id}"][data-day="${day}"]`);
      const startMin = document.querySelector(`select.start-min[data-employee="${emp.id}"][data-day="${day}"]`);
      const startAmPm = document.querySelector(`select.start-ampm[data-employee="${emp.id}"][data-day="${day}"]`);
      const endHour = document.querySelector(`select.end-hour[data-employee="${emp.id}"][data-day="${day}"]`);
      const endMin = document.querySelector(`select.end-min[data-employee="${emp.id}"][data-day="${day}"]`);
      const endAmPm = document.querySelector(`select.end-ampm[data-employee="${emp.id}"][data-day="${day}"]`);
      if (off && !off.checked && startHour && startMin && startAmPm && endHour && endMin && endAmPm && startHour.value && startMin.value && startAmPm.value && endHour.value && endMin.value && endAmPm.value) {
        const startH = getTimeFromDropdowns(startHour, startMin, startAmPm);
        const endH = getTimeFromDropdowns(endHour, endMin, endAmPm);
        if (endH > startH) {
          // Check if this time block is in allowed availability
          const allowed = (availability[emp.id] && availability[emp.id][day]) ? availability[emp.id][day] : [];
          const match = allowed.some(([a, b]) => startH >= a && endH <= b);
          if (!match && allowed.length > 0) {
            warnings.push(`Conflict: <strong>${emp.name}</strong> is not available for <strong>${startHour.value}:${startMin.value} - ${endHour.value}:${endMin.value}</strong> on <strong>${day}</strong>.`);
          }
          if (allowed.length === 0) {
            warnings.push(`Conflict: <strong>${emp.name}</strong> is not available at all on <strong>${day}</strong>.`);
          }
        }
      }
    });
  });
  appendWarnings(warnings);
}

// --- Warning Display ---
function showWarnings(warnings) {
  const div = document.getElementById('warnings');
  // Preserve scroll position
  const scrollY = window.scrollY;
  div.innerHTML = warnings.length ? warnings.join('<br>') : '';
  window.scrollTo(window.scrollX, scrollY);
}
function appendWarnings(warnings) {
  const div = document.getElementById('warnings');
  // Preserve scroll position
  const scrollY = window.scrollY;
  if (warnings.length) {
    div.innerHTML += '<br>' + warnings.join('<br>');
  }
  window.scrollTo(window.scrollX, scrollY);
}

// --- Highlight Day Header if Missing Opener/Closer/Mid ---
function highlightCoverage() {
  days.forEach(day => {
    const th = document.querySelector(`#schedule-table th:nth-child(${days.indexOf(day)+2})`);
    const { open, close } = storeHours[day];
    let hasOpener = false, hasCloser = false, hasMid = false;
    employees.forEach(emp => {
      const off = document.querySelector(`input.off-day[data-employee="${emp.id}"][data-day="${day}"]`);
      const startHour = document.querySelector(`select.start-hour[data-employee="${emp.id}"][data-day="${day}"]`);
      const startMin = document.querySelector(`select.start-min[data-employee="${emp.id}"][data-day="${day}"]`);
      const startAmPm = document.querySelector(`select.start-ampm[data-employee="${emp.id}"][data-day="${day}"]`);
      const endHour = document.querySelector(`select.end-hour[data-employee="${emp.id}"][data-day="${day}"]`);
      const endMin = document.querySelector(`select.end-min[data-employee="${emp.id}"][data-day="${day}"]`);
      const endAmPm = document.querySelector(`select.end-ampm[data-employee="${emp.id}"][data-day="${day}"]`);
      if (off && !off.checked && startHour && startMin && startAmPm && endHour && endMin && endAmPm && startHour.value && startMin.value && startAmPm.value && endHour.value && endMin.value && endAmPm.value) {
        const startH = getTimeFromDropdowns(startHour, startMin, startAmPm);
        const endH = getTimeFromDropdowns(endHour, endMin, endAmPm);
        const duration = endH - startH;
        if (duration >= 2) {
          if (startH <= open && endH > startH) hasOpener = true;
          if (endH >= close && endH > startH) hasCloser = true;
          if (startH > open + 1 && endH < close - 1) hasMid = true;
        }
      }
    });
    if (hasOpener || hasCloser || hasMid) {
      th.style.backgroundColor = '#ffd740';
    } else {
      th.style.backgroundColor = '';
    }
  });
}

// --- Availability Modal Logic ---
function openAvailabilityModal(employeeId, tempAvail) {
  const modal = document.getElementById('availability-modal');
  const form = document.getElementById('availability-form');
  const daysDiv = document.getElementById('availability-days');
  daysDiv.innerHTML = '';
  // Find employee by id
  const emp = employees.find(e => e.id === employeeId);
  // Set the modal title to the employee name
  modal.querySelector('h2').textContent = `Edit Availability: ${emp ? emp.name : ''}`;
  // Use provided tempAvail or make a deep copy of the current availability
  if (!tempAvail) tempAvail = JSON.parse(JSON.stringify(availability[employeeId] || {}));

  // --- Add readable preview of current availability ---
  let previewDiv = document.getElementById('availability-preview');
  if (!previewDiv) {
    previewDiv = document.createElement('div');
    previewDiv.id = 'availability-preview';
    previewDiv.style = 'margin-bottom:18px;padding:10px 12px;background:#f7f8fa;border-radius:8px;border:1px solid #e0e0e0;font-size:1.04em;';
    form.insertBefore(previewDiv, daysDiv);
  }
  function readableTime(val) {
    if (val === undefined || val === "" || val === null || isNaN(val)) return null;
    let h = Math.floor(val);
    let m = Math.round((val - h) * 60);
    let ampm = h >= 12 ? 'PM' : 'AM';
    let hour = h % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }
  function updatePreview() {
    let previewHtml = '<strong>Current Availability:</strong><br>';
    days.forEach(day => {
      const ranges = (tempAvail[day]) ? tempAvail[day] : [];
      if (ranges.length && ranges[0].length === 2 && !(ranges[0][0] === 0 && ranges[0][1] === 0)) {
        const startStr = readableTime(ranges[0][0]);
        const endStr = readableTime(ranges[0][1]);
        if (startStr && endStr && ranges[0][0] !== ranges[0][1]) {
          previewHtml += `<div><b>${day}:</b> ${startStr} - ${endStr}</div>`;
        } else {
          previewHtml += `<div><b>${day}:</b> <span style='color:#b71c1c;'>Not Available</span></div>`;
        }
      } else {
        previewHtml += `<div><b>${day}:</b> <span style='color:#b71c1c;'>Not Available</span></div>`;
      }
    });
    previewDiv.innerHTML = previewHtml;
  }
  updatePreview();
  // --- End preview ---

  // Build form for each day
  days.forEach(day => {
    const dayDiv = document.createElement('div');
    dayDiv.style = 'margin-bottom:10px;';
    const label = document.createElement('label');
    label.textContent = day + ': ';
    label.style = 'display:inline-block;width:90px;font-weight:500;';
    dayDiv.appendChild(label);
    // Full Availability button
    const fullAvailBtn = document.createElement('button');
    fullAvailBtn.type = 'button';
    fullAvailBtn.textContent = 'Full Availability';
    fullAvailBtn.style = 'margin-right:10px;background:#e0e0e0;border:none;border-radius:5px;padding:2px 10px;cursor:pointer;font-size:0.95em;';
    fullAvailBtn.disabled = !isEditMode;
    dayDiv.appendChild(fullAvailBtn);
    // Not Available button
    const notAvailBtn = document.createElement('button');
    notAvailBtn.type = 'button';
    notAvailBtn.textContent = 'Not Available';
    notAvailBtn.style = 'margin-right:10px;background:#ffe0e0;border:none;border-radius:5px;padding:2px 10px;cursor:pointer;font-size:0.95em;color:#b71c1c;';
    notAvailBtn.disabled = !isEditMode;
    dayDiv.appendChild(notAvailBtn);
    // Existing ranges
    const ranges = (tempAvail[day]) ? tempAvail[day] : [];
    const range = (ranges[0] || [""]);
    // Create dropdowns
    const startHour = document.createElement('select');
    startHour.name = `${day}-start-hour`;
    const startMin = document.createElement('select');
    startMin.name = `${day}-start-min`;
    const startAmPm = document.createElement('select');
    startAmPm.name = `${day}-start-ampm`;
    const endHour = document.createElement('select');
    endHour.name = `${day}-end-hour`;
    const endMin = document.createElement('select');
    endMin.name = `${day}-end-min`;
    const endAmPm = document.createElement('select');
    endAmPm.name = `${day}-end-ampm`;
    // Helper to convert decimal hour to hour, min, ampm
    function toHourMinAmPm(val) {
      if (val === undefined || val === "") return { hour: '', min: '', ampm: '' };
      let h = Math.floor(val);
      let m = Math.round((val - h) * 60);
      let ampm = h >= 12 ? 'PM' : 'AM';
      let hour = h % 12;
      if (hour === 0) hour = 12;
      return { hour: hour.toString(), min: m.toString().padStart(2, '0'), ampm };
    }
    const startVals = toHourMinAmPm(range[0]);
    const endVals = toHourMinAmPm(range[1]);
    // Helper to robustly set dropdown value
    function setDropdownValue(dropdown, val, fallback) {
      if (val !== undefined && val !== null && val !== "") {
        dropdown.value = String(val);
      } else if (fallback !== undefined) {
        dropdown.value = fallback;
      } else {
        dropdown.value = '';
      }
    }
    // Start hour
    const startHourDefault = document.createElement('option');
    startHourDefault.value = '';
    startHourDefault.textContent = '--';
    startHour.appendChild(startHourDefault);
    for (let h = 1; h <= 12; h++) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      startHour.appendChild(opt);
    }
    setDropdownValue(startHour, startVals.hour || (range[0] === 0 ? '12' : ''), '');
    // Start min
    const startMinDefault = document.createElement('option');
    startMinDefault.value = '';
    startMinDefault.textContent = '--';
    startMin.appendChild(startMinDefault);
    ['00', '15', '30', '45'].forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      startMin.appendChild(opt);
    });
    setDropdownValue(startMin, startVals.min || (range[0] === 0 ? '00' : ''), '');
    // Start ampm
    const startAmPmDefault = document.createElement('option');
    startAmPmDefault.value = '';
    startAmPmDefault.textContent = '--';
    startAmPm.appendChild(startAmPmDefault);
    ['AM', 'PM'].forEach(ampm => {
      const opt = document.createElement('option');
      opt.value = ampm;
      opt.textContent = ampm;
      startAmPm.appendChild(opt);
    });
    setDropdownValue(startAmPm, startVals.ampm || (range[0] === 0 ? 'AM' : ''), '');
    // End hour
    const endHourDefault = document.createElement('option');
    endHourDefault.value = '';
    endHourDefault.textContent = '--';
    endHour.appendChild(endHourDefault);
    for (let h = 1; h <= 12; h++) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      endHour.appendChild(opt);
    }
    setDropdownValue(endHour, endVals.hour || (range[1] === 0 ? '12' : ''), '');
    // End min
    const endMinDefault = document.createElement('option');
    endMinDefault.value = '';
    endMinDefault.textContent = '--';
    endMin.appendChild(endMinDefault);
    ['00', '15', '30', '45'].forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      endMin.appendChild(opt);
    });
    setDropdownValue(endMin, endVals.min || (range[1] === 0 ? '00' : ''), '');
    // End ampm
    const endAmPmDefault = document.createElement('option');
    endAmPmDefault.value = '';
    endAmPmDefault.textContent = '--';
    endAmPm.appendChild(endAmPmDefault);
    ['AM', 'PM'].forEach(ampm => {
      const opt = document.createElement('option');
      opt.value = ampm;
      opt.textContent = ampm;
      endAmPm.appendChild(opt);
    });
    setDropdownValue(endAmPm, endVals.ampm || (range[1] === 0 ? 'AM' : ''), '');
    // Move dropdowns into timeRangeDiv
    const timeRangeDiv = document.createElement('span');
    timeRangeDiv.appendChild(startHour);
    timeRangeDiv.appendChild(startMin);
    timeRangeDiv.appendChild(startAmPm);
    timeRangeDiv.appendChild(document.createTextNode(' - '));
    timeRangeDiv.appendChild(endHour);
    timeRangeDiv.appendChild(endMin);
    timeRangeDiv.appendChild(endAmPm);
    dayDiv.appendChild(timeRangeDiv);
    // Add event listeners to dropdowns to update tempAvail and preview live
    function updateDayFromDropdowns() {
      if (!isEditMode) return;
      const sHour = startHour.value;
      const sMin = startMin.value;
      const sAmPm = startAmPm.value;
      const eHour = endHour.value;
      const eMin = endMin.value;
      const eAmPm = endAmPm.value;
      if (sHour && sMin && sAmPm && eHour && eMin && eAmPm) {
        const startH = getTimeFromDropdowns({value: sHour}, {value: sMin}, {value: sAmPm});
        const endH = getTimeFromDropdowns({value: eHour}, {value: eMin}, {value: eAmPm});
        if (startH !== endH) {
          tempAvail[day] = [[startH, endH]];
        } else {
          tempAvail[day] = [];
        }
      } else {
        tempAvail[day] = [];
      }
      updatePreview();
    }
    [startHour, startMin, startAmPm, endHour, endMin, endAmPm].forEach(el => {
      el.addEventListener('change', updateDayFromDropdowns);
    });
    // Full Availability button logic (toggleable, no re-render)
    fullAvailBtn.onclick = (e) => {
      if (!isEditMode) return;
      e.preventDefault();
      if (["Saturday", "Sunday"].includes(day)) {
        // Weekends: 7:45am - 8:15pm
        tempAvail[day] = [[7.75, 20.25]];
        setDropdownValue(startHour, '7');
        setDropdownValue(startMin, '45');
        setDropdownValue(startAmPm, 'AM');
        setDropdownValue(endHour, '8');
        setDropdownValue(endMin, '15');
        setDropdownValue(endAmPm, 'PM');
      } else {
        // Weekdays: 6:45am - 9:15pm
        tempAvail[day] = [[6.75, 21.25]];
        setDropdownValue(startHour, '6');
        setDropdownValue(startMin, '45');
        setDropdownValue(startAmPm, 'AM');
        setDropdownValue(endHour, '9');
        setDropdownValue(endMin, '15');
        setDropdownValue(endAmPm, 'PM');
      }
      updatePreview();
    };
    // Not Available button logic (no re-render)
    notAvailBtn.onclick = (e) => {
      if (!isEditMode) return;
      e.preventDefault();
      tempAvail[day] = [];
      setDropdownValue(startHour, '');
      setDropdownValue(startMin, '');
      setDropdownValue(startAmPm, '');
      setDropdownValue(endHour, '');
      setDropdownValue(endMin, '');
      setDropdownValue(endAmPm, '');
      // Remove any specialDays for this employee and day
      if (availability[employeeId] && window.employees) {
        const emp = window.employees.find(e => e.id === employeeId);
        if (emp && emp.specialDays) {
          delete emp.specialDays[day];
        }
      }
      updatePreview();
    };
    daysDiv.appendChild(dayDiv);
  });
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  // Save/cancel logic
  document.getElementById('close-availability-btn').onclick = () => { modal.style.display = 'none'; };
  form.onsubmit = e => {
    if (!isEditMode) return;
    e.preventDefault();
    // Sync tempAvail with current dropdown values before saving
    days.forEach(day => {
      const sHour = form[`${day}-start-hour`]?.value;
      const sMin = form[`${day}-start-min`]?.value;
      const sAmPm = form[`${day}-start-ampm`]?.value;
      const eHour = form[`${day}-end-hour`]?.value;
      const eMin = form[`${day}-end-min`]?.value;
      const eAmPm = form[`${day}-end-ampm`]?.value;
      if (sHour && sMin && sAmPm && eHour && eMin && eAmPm) {
        const startH = getTimeFromDropdowns({value: sHour}, {value: sMin}, {value: sAmPm});
        const endH = getTimeFromDropdowns({value: eHour}, {value: eMin}, {value: eAmPm});
        if (startH !== endH) {
          tempAvail[day] = [[startH, endH]];
        } else {
          tempAvail[day] = [];
        }
      } else {
        tempAvail[day] = [];
      }
    });
    // Save tempAvail directly
    availability[employeeId] = JSON.parse(JSON.stringify(tempAvail));
    saveAvailability(); // Persist changes to backend
    modal.style.display = 'none';
    createScheduleTable();
    updateSummary();
    highlightCoverage();
    checkAvailabilityConflicts();
    // Removed saveData() from here
  };
}

// --- Print Preview Logic ---
function renderPrintPreview() {
  const preview = document.getElementById('print-preview');
  if (!preview) return;
  // Helper for readable time
  function readableTime(val) {
    let h = Math.floor(val);
    let m = Math.round((val - h) * 60);
    let ampm = h >= 12 ? 'PM' : 'AM';
    let hour = h % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }
  // Build table
  let html = '';
  // Print week range at top
  if (weekStartDate) {
    // Parse weekStartDate as local date
    const [year, month, day] = weekStartDate.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day);
    end.setDate(start.getDate() + 6);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    html += `<div style='font-size:1.13em;font-weight:600;margin-bottom:10px;'>Week of ${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, options)}</div>`;
    console.log('[DEBUG] renderPrintPreview: weekStartDate:', weekStartDate, 'range:', start.toLocaleDateString(undefined, options), '-', end.toLocaleDateString(undefined, options));
  }
  html += '<table class="preview-table">';
  html += '<thead>';
  // Date row first
  html += '<tr><td class="preview-th">Date</td>';
  // Use getDateRowLabels for holiday emoji
  const labels = getDateRowLabels();
  labels.forEach(label => html += `<td class="preview-th">${label}</td>`);
  html += '</tr>';
  // Then day-of-week row
  html += '<tr><th class="preview-th">Employee</th>';
  days.forEach(day => {
    html += `<th class="preview-th">${day}</th>`;
  });
  html += '</tr>';
  html += '</thead><tbody>';
  employees.forEach(emp => {
    // Calculate total hours for this employee
    let empTotal = 0;
    days.forEach(day => {
      if (emp.specialDays && emp.specialDays[day] === 'OFF') return;
      if (emp.schedule && Array.isArray(emp.schedule[day]) && emp.schedule[day].length === 2) {
        const startH = emp.schedule[day][0];
        const endH = emp.schedule[day][1];
        if (endH > startH) {
          empTotal += endH - startH;
        }
      }
    });
    html += `<tr><td class="preview-td">${emp.name || ''} <span style='font-size:0.95em;color:#007a33;font-weight:500;'>(${empTotal}h)</span></td>`;
    days.forEach(day => {
      let cell = '';
      let cellStyle = '';
      // Special days
      if (emp.specialDays && emp.specialDays[day] === 'STAT') {
        cell = '<span style="color:#007a33;font-weight:500;">STAT</span>';
      } else if (emp.specialDays && emp.specialDays[day] === 'VAC') {
        cell = '<span style="color:#ff8c00;font-weight:500;">VAC</span>';
      } else if (emp.specialDays && emp.specialDays[day] === 'RDO') {
        cell = '<span style="color:#007aff;font-weight:500;">RDO</span>';
      } else if (emp.specialDays && emp.specialDays[day] === 'OFF') {
        cell = '<span style="color:#b71c1c;font-weight:500;">OFF</span>';
      } else {
        // Use schedule data if present, otherwise show blank if not available
        let scheduled = emp.schedule && emp.schedule[day];
        const allowedRanges = (availability[emp.id] && availability[emp.id][day]) ? availability[emp.id][day] : [];
        if (scheduled && scheduled.length === 2) {
          cell = `${readableTime(scheduled[0])} – ${readableTime(scheduled[1])}`;
        } else if (allowedRanges.length === 0) {
          cell = '';
        } else {
          cell = '';
        }
      }
      // Add note if present
      if (emp.notes && emp.notes[day]) {
        cell = `<span style=\"font-style:italic;\">${cell}<br><span style=\"font-size:0.9em;color:#666;\">${emp.notes[day]}</span></span>`;
        cellStyle = 'background: #f7f7f7; opacity: 0.75;';
      }
      html += `<td class=\"preview-td\" style=\"${cellStyle}\">${cell}</td>`;
    });
    html += '</tr>';
  });
  // Add totals row at the bottom
  let grandTotal = 0;
  html += '<tr><th class="preview-th" style="background:#f3f4f7;">Totals</th>';
  days.forEach((day, i) => {
    let totalHours = 0;
    let employeesScheduled = 0;
    employees.forEach(emp => {
      if (emp.specialDays && emp.specialDays[day] === 'OFF') return;
      if (emp.schedule && Array.isArray(emp.schedule[day]) && emp.schedule[day].length === 2) {
        const startH = emp.schedule[day][0];
        const endH = emp.schedule[day][1];
        if (endH > startH) {
          totalHours += endH - startH;
          employeesScheduled++;
        }
      }
    });
    grandTotal += totalHours;
    html += `<td class="preview-td" style="background:#f3f4f7;"><strong>${totalHours}h</strong><br><span style="font-size:0.9em;">${employeesScheduled} staff</span></td>`;
  });
  html += '</tr>';
  // Add grand total in the first cell
  html = html.replace('<th class="preview-th" style="background:#f3f4f7;">Totals</th>', `<th class="preview-th" style="background:#f3f4f7;">Totals (${grandTotal}h)</th>`);
  html += '</tbody></table>';
  preview.innerHTML = html;
}

function renderDateHeaderWithDates() {
  const thead = document.querySelector('#schedule-table thead');
  if (!thead) return;
  // Remove any existing custom header
  const customHeader = document.getElementById('custom-day-header');
  if (customHeader) thead.removeChild(customHeader);
  // Build new header row
  const tr = document.createElement('tr');
  tr.id = 'custom-day-header';
  tr.innerHTML = '<th>Employee</th>';
  const labels = getDateRowLabels();
  days.forEach((day, i) => {
    tr.innerHTML += `<th>${day} <span style=\"color:#888;font-size:0.97em;\">${labels[i]}</span></th>`;
  });
  // Replace the default day-of-week row (first row)
  if (thead.firstChild) {
    thead.replaceChild(tr, thead.firstChild);
  } else {
    thead.appendChild(tr);
  }
}

// Add function to show notes summary
function showNotesSummary() {
  // Remove existing summary if any
  hideNotesSummary();
  
  const dataSource = getActiveEmployees();
  const notesData = [];
  
  // Collect all notes
  dataSource.forEach(emp => {
    if (emp.notes) {
      Object.keys(emp.notes).forEach(day => {
        if (emp.notes[day]) {
          notesData.push({
            employee: emp.name,
            day: day,
            note: emp.notes[day]
          });
        }
      });
    }
  });
  
  if (notesData.length === 0) return;
  
  // Create notes summary container
  const summaryContainer = document.createElement('div');
  summaryContainer.id = 'notes-summary';
  summaryContainer.style = 'background:#e8f5e8;border:2px solid #4caf50;border-radius:8px;padding:15px;margin:15px 0;box-shadow:0 2px 8px rgba(0,0,0,0.1);';
  
  const title = document.createElement('h3');
  title.textContent = `📋 Notes Summary (${notesData.length} note${notesData.length > 1 ? 's' : ''})`;
  title.style = 'margin:0 0 10px 0;color:#2e7d32;font-size:1.1em;';
  summaryContainer.appendChild(title);
  
  const notesList = document.createElement('div');
  notesData.forEach(item => {
    const noteItem = document.createElement('div');
    noteItem.style = 'margin:5px 0;padding:8px;background:#fff;border-radius:6px;border-left:4px solid #4caf50;';
    noteItem.innerHTML = `<strong>${item.employee}</strong> - <em>${item.day}</em>: ${item.note}`;
    notesList.appendChild(noteItem);
  });
  summaryContainer.appendChild(notesList);
  
  // Insert after the warnings div
  const warningsDiv = document.getElementById('warnings');
  warningsDiv.parentNode.insertBefore(summaryContainer, warningsDiv.nextSibling);
}

// Add function to hide notes summary
function hideNotesSummary() {
  const existingSummary = document.getElementById('notes-summary');
  if (existingSummary) {
    existingSummary.remove();
  }
}