const API_BASE = ""; // relative calls for same-origin deployment
const HABITS_STORAGE_KEY = "habitsByUser";

function getLoggedInUser() {
  try {
    return JSON.parse(localStorage.getItem("loggedInUser")) || null;
  } catch (err) {
    console.error("Invalid loggedInUser data", err);
    return null;
  }
}

function saveLoggedInUser(user) {
  if (!user || !user.email) return;
  localStorage.setItem("loggedInUser", JSON.stringify(user));
}

function getUserHabits() {
  const user = getLoggedInUser();
  if (!user) return [];
  const all = JSON.parse(localStorage.getItem(HABITS_STORAGE_KEY) || "{}" );
  return all[user.email] || [];
}

function saveUserHabits(habitsArray) {
  const user = getLoggedInUser();
  if (!user || !user.email) return;
  const all = JSON.parse(localStorage.getItem(HABITS_STORAGE_KEY) || "{}" );
  all[user.email] = habitsArray;
  localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(all));
}

function ensureAuthenticated() {
  if (!localStorage.getItem("token") || !localStorage.getItem("loggedInUser")) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// Authentication UI functions
function showLogin() {
  console.log('showLogin called');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('signupForm').classList.add('hidden');
  document.getElementById('login-tab').classList.add('active');
  document.getElementById('signup-tab').classList.remove('active');
}

function showSignup() {
  console.log('showSignup called');
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('signupForm').classList.remove('hidden');
  document.getElementById('login-tab').classList.remove('active');
  document.getElementById('signup-tab').classList.add('active');
}

function showAlert(message, type = 'error') {
  const alertEl = document.getElementById('alert');
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.className = `mb-4 p-3 rounded-lg text-sm ${type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
  alertEl.classList.remove('hidden');
  setTimeout(() => alertEl.classList.add('hidden'), 5000);
}

function handleSignup() {
  console.log('handleSignup called');
  const nameEl = document.getElementById('signupName');
  const emailEl = document.getElementById('signupEmail');
  const passwordEl = document.getElementById('signupPassword');
  if (!nameEl || !emailEl || !passwordEl) {
    console.error('Signup form elements not found');
    showAlert('Form elements not found');
    return;
  }
  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();
  if (!name || !email || !password) {
    showAlert('Please fill in all fields');
    return;
  }
  console.log('Signup attempt:', {name, email, password});
  fetch(`${API_BASE}/signup`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name, email, password})
  }).then(res => {
    console.log('Signup response status:', res.status);
    if (res.ok) {
      console.log('Signup successful');
      // Save temporary logged in user after signup (but still force login for token security)
      saveLoggedInUser({name, email});
      showAlert('Account created successfully! Please login.', 'success');
      showLogin();
    } else {
      console.log('Signup failed');
      showAlert('Signup failed. Please try again.');
    }
  }).catch(err => {
    console.error('Signup error:', err);
    showAlert('Network error. Please check your connection.');
  });
}

function handleLogin() {
  console.log('handleLogin called');
  const emailEl = document.getElementById('loginEmail');
  const passwordEl = document.getElementById('loginPassword');
  if (!emailEl || !passwordEl) {
    console.error('Login form elements not found');
    showAlert('Form elements not found');
    return;
  }
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();
  if (!email || !password) {
    showAlert('Please enter email and password');
    return;
  }
  console.log('Login attempt:', {email, password});
  fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password})
  }).then(res => {
    console.log('Login response status:', res.status);
    return res.json();
  }).then(data => {
    if (data.token) {
      localStorage.setItem('token', data.token);
      const user = data.user || { name: email.split('@')[0], email };
      saveLoggedInUser(user);
      console.log('Login successful, user stored, redirecting to index.html');
      window.location.href = 'index.html';
    } else {
      console.log('Login failed: invalid credentials');
      showAlert('Invalid email or password');
    }
  }).catch(err => {
    console.error('Login error:', err);
    showAlert('Network error. Please check your connection.');
  });
}

function updateGreeting() {
  const hour = new Date().getHours();
  let greeting = "";

  if (hour >= 5 && hour < 12) {
    greeting = "Good Morning! ☀️";
  } else if (hour >= 12 && hour < 17) {
    greeting = "Good Afternoon! 🌤️";
  } else if (hour >= 17 && hour < 21) {
    greeting = "Good Evening! 🌆";
  } else {
    greeting = "Good Night! 🌙";
  }

 const el = document.getElementById("sidebar-greeting");
if (el) {
  el.innerText = greeting;
}
}
// ─── STATE ──────────────────────────────────────────────────────────────────
let state = { habits: [], tracking: {}, notes: [], projects: [] };

const today = new Date();
const todayKey = dateKey(today);
let calYear = today.getFullYear();
let calMonth = today.getMonth();
let selectedEmoji = '🎯';
let selectedColor = '#a78bfa';
let selectedNoteColor = '#fffbf0';
let reportMode = 'weekly';
let lineChart = null;
let reportChart = null;
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function getPct(key) {
  const h = state.habits;
  if (!h.length) return 0;
  const t = state.tracking[key] || {};
  const done = h.filter(h => t[h.id]).length;
  return Math.round((done / h.length) * 100);
}

// ─── API FUNCTIONS ──────────────────────────────────────────────────────────
async function loadHabits() {
  if (!ensureAuthenticated()) return;

  state.habits = getUserHabits();
  state.tracking = JSON.parse(localStorage.getItem('trackingByUser') || '{}')[getLoggedInUser()?.email] || {};

  // Keep backend sync (non-blocking), optional
  try {
    const response = await fetch(`${API_BASE}/habits`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": localStorage.getItem("token")
      }
    });
    if (response.ok) {
      const data = await response.json();
      // If backend has habits, do not overwrite local overrides; but if local empty, pick backend
      if (!state.habits.length && data.habits?.length) {
        state.habits = data.habits;
        saveUserHabits(state.habits);
      }
      state.tracking = data.tracking || state.tracking;
    }
  } catch (error) {
    console.warn("Could not fetch from backend, using local data", error);
  }

  updateDashboard();
  initLineChart();
  if (document.getElementById('section-calendar')?.classList.contains('active')) renderCalendar();
}

async function addHabit(habitData) {
  const user = getLoggedInUser();
  if (!user) {
    return showAlert('Please login first', 'error');
  }

  const habit = { id: Date.now().toString(), ...habitData };
  state.habits = [...state.habits, habit];
  saveUserHabits(state.habits);
  updateDashboard();

  // Send to backend when available
  try {
    const response = await fetch(`${API_BASE}/add-habit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": localStorage.getItem("token")
      },
      body: JSON.stringify({ ...habit, userEmail: user.email })
    });
    if (!response.ok) console.warn('Backend add-habit failed', response.statusText);
  } catch (error) {
    console.warn('Add habit backend request failed:', error);
  }
}

async function toggleHabitAPI(date, habitId) {
  const user = getLoggedInUser();
  if (!user) return;

  const trackingByUser = JSON.parse(localStorage.getItem('trackingByUser') || '{}');
  const userTracking = trackingByUser[user.email] || {};
  const dateTracking = userTracking[date] || {};
  dateTracking[habitId] = !dateTracking[habitId];
  userTracking[date] = dateTracking;
  trackingByUser[user.email] = userTracking;
  localStorage.setItem('trackingByUser', JSON.stringify(trackingByUser));
  state.tracking = userTracking;

  updateDashboard();
  if (document.getElementById('section-calendar')?.classList.contains('active')) renderCalendar();
  if (document.getElementById('day-modal')?.style.display !== 'none') openDayModal(date);
  initLineChart();

  try {
    const response = await fetch(`${API_BASE}/toggle-habit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": localStorage.getItem("token")
      },
      body: JSON.stringify({ date, habitId, userEmail: user.email })
    });
    if (!response.ok) console.warn('Backend toggle-habit failed', response.statusText);
  } catch (error) {
    console.warn('Toggle habit backend request failed:', error);
  }
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// ─── SECTION NAV ────────────────────────────────────────────────────────────
function showSection(id) {
  document.querySelectorAll('.section-view').forEach(e => e.classList.remove('active'));
  document.getElementById('section-'+id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
  event.currentTarget.classList.add('active');
  if (id === 'calendar') renderCalendar();
  if (id === 'reports') renderReports();
  if (id === 'notes') renderNotes();
  if (id === 'dashboard') { updateDashboard(); initLineChart(); }
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
function updateDashboard() {
  const now = new Date();
  const options = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  document.getElementById('dash-date').textContent = now.toLocaleDateString('en-US', options);

  const todayPct = getPct(todayKey);
  document.getElementById('stat-today').textContent = todayPct + '%';

  // Streak
  let streak = 0;
  let d = new Date(today);
  while (true) {
    const k = dateKey(d);
    if (getPct(k) >= 50) { streak++; d.setDate(d.getDate()-1); }
    else break;
    if (streak > 365) break;
  }
  document.getElementById('stat-streak').textContent = streak;

  // Weekly avg
  let weekTotal = 0, weekDays = 0;
  for (let i=0; i<7; i++) { const d2=new Date(today); d2.setDate(d2.getDate()-i); weekTotal+=getPct(dateKey(d2)); weekDays++; }
  const weekAvg = weekDays ? Math.round(weekTotal/weekDays) : 0;
  document.getElementById('stat-week').textContent = weekAvg+'%';

  // Monthly avg
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  let mTotal=0, mDays=0;
  for (let i=1; i<=today.getDate(); i++) {
    const k = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    mTotal += getPct(k); mDays++;
  }
  const mAvg = mDays ? Math.round(mTotal/mDays) : 0;
  document.getElementById('stat-month').textContent = mAvg+'%';

  // Monthly ring
  const ring = document.getElementById('monthly-ring');
  ring.setAttribute('stroke-dashoffset', 314 - (314 * mAvg / 100));
  document.getElementById('monthly-pct').textContent = mAvg+'%';

  // Done/missed counts for month
  let totalChecks=0, totalPossible=0;
  for (let i=1; i<=today.getDate(); i++) {
    const k = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const t = state.tracking[k]||{};
    totalPossible += state.habits.length;
    totalChecks += state.habits.filter(h=>t[h.id]).length;
  }
  document.getElementById('stat-done').textContent = totalChecks;
  document.getElementById('stat-missed').textContent = totalPossible - totalChecks;

  // Sidebar
  const todayT = state.tracking[todayKey]||{};
  const todayDone = state.habits.filter(h=>todayT[h.id]).length;
  document.getElementById('sidebar-prog').style.width = todayPct+'%';
  document.getElementById('sidebar-prog-txt').textContent = `${todayDone} / ${state.habits.length} habits done`;

  // Today habits
  renderTodayHabits();

  // Week circles
  renderWeekCircles();
}

function renderTodayHabits() {
  const list = document.getElementById('today-habits-list');
  const chip = document.getElementById('today-chip');
  if (!state.habits.length) {
    list.innerHTML = `<div style="text-align:center;padding:24px 0;color:#c4bdb5;font-size:13px;"><i data-lucide="inbox" style="width:28px;height:28px;margin:0 auto 8px;display:block;"></i>No habits yet. Add one!</div>`;
    chip.textContent = '0 / 0'; lucide.createIcons(); return;
  }
  const t = state.tracking[todayKey]||{};
  const done = state.habits.filter(h=>t[h.id]).length;
  chip.textContent = `${done} / ${state.habits.length}`;
  list.innerHTML = state.habits.map(h => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f5f3ef;">
      <div class="habit-check ${t[h.id]?'done':''}" onclick="toggleHabit('${todayKey}','${h.id}')" id="hc-${h.id}">
        ${t[h.id]?'<i data-lucide="check" style="width:10px;height:10px;color:#fff;"></i>':''}
      </div>
      <span style="font-size:14px;">${h.emoji}</span>
      <span style="font-size:13.5px;color:${t[h.id]?'#a09892':'#1e1a14'};${t[h.id]?'text-decoration:line-through;':''}">${h.name}</span>
      <div class="badge" style="background:${h.color};margin-left:auto;"></div>
    </div>
  `).join('');
  lucide.createIcons();
}

function toggleHabit(key, habitId) {
  toggleHabitAPI(key, habitId);
}

function renderWeekCircles() {
  const wrap = document.getElementById('week-circles');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = '';
  for (let i=6; i>=0; i--) {
    const d2 = new Date(today); d2.setDate(d2.getDate()-i);
    const k = dateKey(d2);
    const pct = getPct(k);
    const isToday = i===0;
    const r=18, circ=2*Math.PI*r;
    const offset = circ - (circ*pct/100);
    html += `<div style="display:flex;align-items:center;gap:10px;">
      <svg width="44" height="44"><circle cx="22" cy="22" r="${r}" fill="none" stroke="#ede9fe" stroke-width="4"/>
      <circle cx="22" cy="22" r="${r}" fill="none" stroke="${pct>=80?'#34d399':pct>=50?'#a78bfa':'#fbbf24'}" stroke-width="4" stroke-linecap="round"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" transform="rotate(-90 22 22)"/></svg>
      <div>
        <p style="font-size:12px;font-weight:${isToday?'700':'500'};color:${isToday?'#6d28d9':'#1e1a14'};">${isToday?'Today':days[d2.getDay()]}</p>
        <p style="font-size:11px;color:#a09892;">${pct}%</p>
      </div>
    </div>`;
  }
  wrap.innerHTML = html;
}

function initLineChart() {
  const labels = [], data = [];
  for (let i=13; i>=0; i--) {
    const d2=new Date(today); d2.setDate(d2.getDate()-i);
    labels.push(d2.getDate());
    data.push(getPct(dateKey(d2)));
  }
  const ctx = document.getElementById('lineChart').getContext('2d');
  if (lineChart) { lineChart.data.labels=labels; lineChart.data.datasets[0].data=data; lineChart.update(); return; }
  lineChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor:'#7c3aed', backgroundColor:'rgba(167,139,250,0.12)', fill:true, tension:0.4, pointBackgroundColor:'#7c3aed', pointRadius:4, pointHoverRadius:6, borderWidth:2 }] },
    options: { plugins:{legend:{display:false}}, scales:{ y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:10}},grid:{color:'#f0ede8'}}, x:{ticks:{font:{size:10}},grid:{display:false}} }, responsive:true, maintainAspectRatio:true }
  });
}

// ─── CALENDAR ──────────────────────────────────────────────────────────────
function renderCalendar() {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-title').textContent = `${monthNames[calMonth]} ${calYear}`;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const todayObj = new Date();

  for (let i=0; i<firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'day-card empty'; el.style.minHeight='100px';
    grid.appendChild(el);
  }

  for (let d=1; d<=daysInMonth; d++) {
    const k = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const pct = getPct(k);
    const isToday = calYear===todayObj.getFullYear() && calMonth===todayObj.getMonth() && d===todayObj.getDate();
    const t = state.tracking[k]||{};
    const done = state.habits.filter(h=>t[h.id]).length;

    const el = document.createElement('div');
    el.className = 'day-card' + (isToday?' today':'');
    el.style.minHeight = '100px';
    el.onclick = () => openDayModal(k);

    const pctColor = pct>=80?'#059669':pct>=50?'#6d28d9':'#d97706';
    const habitsPreview = state.habits.slice(0,3).map(h=>`
      <div style="display:flex;align-items:center;gap:4px;margin-top:3px;">
        <div style="width:8px;height:8px;border-radius:2px;background:${t[h.id]?h.color:'#e5e0d8'};flex-shrink:0;"></div>
        <span style="font-size:9.5px;color:${t[h.id]?'#1e1a14':'#c4bdb5'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70px;">${h.name}</span>
      </div>`).join('');
    const more = state.habits.length > 3 ? `<span style="font-size:9px;color:#a09892;">+${state.habits.length-3} more</span>` : '';

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:13px;font-weight:${isToday?'700':'600'};color:${isToday?'#6d28d9':'#1e1a14'};">${d}</span>
        ${state.habits.length?`<span style="font-size:10px;font-weight:600;color:${pctColor};">${pct}%</span>`:''}
      </div>
      ${habitsPreview}${more}
      ${state.habits.length?`<div class="progress-bar-bg" style="margin-top:8px;"><div class="progress-bar-fill" style="width:${pct}%;background:${pctColor};"></div></div>`:''}
    `;
    grid.appendChild(el);
  }
}

function prevMonth() { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); }
function nextMonth() { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); }

// ─── DAY MODAL ──────────────────────────────────────────────────────────────
function openDayModal(key) {
  const [y,m,d] = key.split('-');
  const date = new Date(+y, +m-1, +d);
  const opts = { weekday:'long', month:'long', day:'numeric' };
  document.getElementById('day-modal-title').textContent = date.toLocaleDateString('en-US', opts);

  const pct = getPct(key);
  document.getElementById('day-modal-bar').style.width = pct+'%';
  const t = state.tracking[key]||{};
  const done = state.habits.filter(h=>t[h.id]).length;
  document.getElementById('day-modal-pct').textContent = `${done} / ${state.habits.length} habits — ${pct}% complete`;

  const list = document.getElementById('day-modal-list');
  if (!state.habits.length) {
    list.innerHTML = `<p style="text-align:center;color:#c4bdb5;font-size:13px;padding:16px 0;">No habits to track yet.</p>`;
  } else {
    list.innerHTML = state.habits.map(h=>`
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f5f3ef;" onclick="toggleHabit('${key}','${h.id}')">
        <div class="habit-check ${t[h.id]?'done':''}" id="dm-${h.id}">
          ${t[h.id]?'<i data-lucide="check" style="width:10px;height:10px;color:#fff;"></i>':''}
        </div>
        <span style="font-size:18px;">${h.emoji}</span>
        <span style="flex:1;font-size:14px;color:${t[h.id]?'#a09892':'#1e1a14'};${t[h.id]?'text-decoration:line-through;':''}">${h.name}</span>
        <div class="badge" style="background:${h.color};width:10px;height:10px;"></div>
      </div>
    `).join('');
    lucide.createIcons();
  }
  document.getElementById('day-modal').style.display = 'flex';
}

// ─── ADD HABIT MODAL ────────────────────────────────────────────────────────
function openAddHabitModal() {
  document.getElementById('habit-name-input').value = '';
  selectedEmoji = '🎯'; selectedColor = '#a78bfa';
  document.querySelectorAll('.emoji-opt').forEach(e=>e.classList.remove('selected'));
  document.querySelectorAll('.color-opt').forEach(e=>e.classList.remove('selected'));
  document.getElementById('add-modal').style.display = 'flex';
}

function pickEmoji(el) { document.querySelectorAll('.emoji-opt').forEach(e=>e.classList.remove('selected')); el.classList.add('selected'); selectedEmoji = el.dataset.val; }
function pickColor(el) { document.querySelectorAll('.color-opt').forEach(e=>e.classList.remove('selected')); el.classList.add('selected'); selectedColor = el.dataset.val; }
function pickNoteColor(el) { document.querySelectorAll('.note-color-opt').forEach(e=>e.classList.remove('active')); el.classList.add('active'); selectedNoteColor = el.dataset.val; }

function saveHabit() {
  const name = document.getElementById('habit-name-input').value.trim();
  if (!name) { document.getElementById('habit-name-input').style.borderColor='#f87171'; return; }
  const habitData = { name, emoji: selectedEmoji, color: selectedColor };
  addHabit(habitData);
  closeModal('add-modal');
}

function openManageModal() {
  const list = document.getElementById('manage-list');
  const empty = document.getElementById('manage-empty');
  if (!state.habits.length) { list.innerHTML=''; empty.style.display='block'; }
  else {
    empty.style.display='none';
    list.innerHTML = state.habits.map(h=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f5f3ef;">
        <div style="width:10px;height:10px;border-radius:50%;background:${h.color};flex-shrink:0;"></div>
        <span style="font-size:16px;">${h.emoji}</span>
        <span style="flex:1;font-size:13.5px;color:#1e1a14;">${h.name}</span>
        <button onclick="deleteHabit('${h.id}')" style="background:#fee2e2;border:none;border-radius:7px;padding:5px 10px;font-size:11.5px;color:#991b1b;cursor:pointer;font-weight:500;">Remove</button>
      </div>
    `).join('');
  }
  document.getElementById('manage-modal').style.display='flex';
}

function deleteHabit(id) {
  const user = getLoggedInUser();
  if (!user) return;
  state.habits = state.habits.filter(h => h.id !== id);
  saveUserHabits(state.habits);
  updateDashboard();

  try {
    fetch(`${API_BASE}/delete-habit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('token')
      },
      body: JSON.stringify({ id, userEmail: user.email })
    });
  } catch (err) {
    console.warn('Delete habit backend request failed', err);
  }
}

// ─── REPORTS ───────────────────────────────────────────────────────────────
function switchReportTab(mode) {
  reportMode = mode;
  document.getElementById('tab-weekly').classList.toggle('active', mode==='weekly');
  document.getElementById('tab-monthly').classList.toggle('active', mode==='monthly');
  renderReports();
}

function renderReports() {
  const days = reportMode==='weekly' ? 7 : 30;
  let total=0, tracked=0, best=0, bestDay='';
  const labels=[], data=[];
  for (let i=days-1; i>=0; i--) {
    const d2=new Date(today); d2.setDate(d2.getDate()-i);
    const k=dateKey(d2);
    const p=getPct(k);
    total+=100; tracked+=p;
    if (p>best) { best=p; bestDay=d2.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}); }
    labels.push(d2.toLocaleDateString('en-US',{month:'short',day:'numeric'}));
    data.push(p);
  }
  const avg = Math.round(tracked/days);
  const streak2 = (() => { let s=0; for(let i=0;i<days;i++){const d2=new Date(today);d2.setDate(d2.getDate()-i);if(getPct(dateKey(d2))>=50)s++;else break;} return s; })();

  document.getElementById('rep-stat1').innerHTML = `<p style="font-size:11px;color:#a09892;margin-bottom:8px;">${days}-Day Avg</p><p style="font-size:28px;font-weight:700;color:#1e1a14;">${avg}%</p><p style="font-size:11px;color:#a09892;">completion</p>`;
  document.getElementById('rep-stat2').innerHTML = `<p style="font-size:11px;color:#a09892;margin-bottom:8px;">Best Day</p><p style="font-size:20px;font-weight:700;color:#1e1a14;">${best}%</p><p style="font-size:11px;color:#a09892;">${bestDay||'—'}</p>`;
  document.getElementById('rep-stat3').innerHTML = `<p style="font-size:11px;color:#a09892;margin-bottom:8px;">Current Streak</p><p style="font-size:28px;font-weight:700;color:#1e1a14;">${streak2} 🔥</p><p style="font-size:11px;color:#a09892;">days ≥50%</p>`;

  const ctx2 = document.getElementById('reportChart').getContext('2d');
  if (reportChart) { reportChart.data.labels=labels; reportChart.data.datasets[0].data=data; reportChart.update(); }
  else {
    reportChart = new Chart(ctx2, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: data.map(v=>v>=80?'#a78bfa':v>=50?'#c4b5fd':'#e9d5ff'), borderRadius:6, borderSkipped:false }] },
      options: { plugins:{legend:{display:false}}, scales:{ y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:10}},grid:{color:'#f0ede8'}}, x:{ticks:{font:{size:10},maxRotation:45},grid:{display:false}} }, responsive:true }
    });
  }

  // Breakdown
  const bd = document.getElementById('habit-breakdown');
  if (!state.habits.length) { bd.innerHTML='<p style="color:#c4bdb5;font-size:13px;text-align:center;padding:16px 0;">No habits yet.</p>'; return; }
  bd.innerHTML = state.habits.map(h=>{
    let hDone=0;
    for(let i=0;i<days;i++){const d2=new Date(today);d2.setDate(d2.getDate()-i);const t=state.tracking[dateKey(d2)]||{};if(t[h.id])hDone++;}
    const pct2=Math.round(hDone/days*100);
    return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f5f3ef;">
      <span style="font-size:18px;">${h.emoji}</span>
      <span style="flex:1;font-size:13px;color:#1e1a14;">${h.name}</span>
      <div style="width:120px;">
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct2}%;background:${h.color};"></div></div>
      </div>
      <span style="font-size:12px;font-weight:600;color:#1e1a14;min-width:36px;text-align:right;">${pct2}%</span>
    </div>`;
  }).join('');
}

// ─── NOTES ─────────────────────────────────────────────────────────────────
function addNote() {
  document.getElementById('note-title-input').value='';
  document.getElementById('note-body-input').value='';
  selectedNoteColor='#fffbf0';
  document.querySelectorAll('.note-color-opt').forEach((e,i)=>e.classList.toggle('active',i===0));
  document.getElementById('note-modal').style.display='flex';
}

function saveNote() {
  const title=document.getElementById('note-title-input').value.trim()||'Untitled';
  const body=document.getElementById('note-body-input').value.trim();
  state.notes.unshift({ id:Date.now().toString(), title, body, color:selectedNoteColor, date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'}) });
  save(); closeModal('note-modal'); renderNotes();
}

function deleteNote(id) {
  state.notes = state.notes.filter(n=>n.id!==id);
  save(); renderNotes();
}

function renderNotes() {
  const grid=document.getElementById('notes-grid');
  if (!state.notes.length) {
    grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#c4bdb5;"><i data-lucide="sticky-note" style="width:40px;height:40px;margin:0 auto 10px;display:block;"></i><p style="font-size:14px;">No notes yet. Click "New Note" to add one!</p></div>`;
    lucide.createIcons(); return;
  }
  grid.innerHTML=state.notes.map(n=>`
    <div style="background:${n.color};border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:16px;position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <p style="font-size:14px;font-weight:600;color:#1e1a14;">${n.title}</p>
        <button onclick="deleteNote('${n.id}')" style="background:none;border:none;cursor:pointer;opacity:0.4;hover:opacity:1;"><i data-lucide="x" style="width:13px;height:13px;"></i></button>
      </div>
      <p style="font-size:12.5px;color:#5a5750;line-height:1.6;">${n.body}</p>
      <p style="font-size:10.5px;color:#a09892;margin-top:10px;">${n.date}</p>
    </div>
  `).join('');
  lucide.createIcons();
}

// ─── PROJECTS ──────────────────────────────────────────────────────────────
let projectFilters = { tags: [], status: [] };
let draggedProject = null;
let dragEdge = null;
let dragOffsetX = 0;

function getAllTags() {
  const tags = new Set();
  state.projects.forEach(p => {
    if (p.tags && Array.isArray(p.tags)) p.tags.forEach(t => tags.add(t));
  });
  return Array.from(tags).sort();
}

function getAllStatuses() {
  return ['Pending', 'Building', 'Completed'];
}

function openAddProjectModal() {
  document.getElementById('project-name-input').value = '';
  const today = new Date();
  document.getElementById('project-start-input').valueAsDate = today;
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  document.getElementById('project-end-input').valueAsDate = endDate;
  document.getElementById('project-status-input').value = 'Pending';
  document.getElementById('project-tags-input').value = '';
  selectedProjectColor = '#c4b5fd';
  document.querySelectorAll('.proj-color-opt').forEach(e=>e.classList.remove('selected'));
  document.querySelector('[data-val="#c4b5fd"]').classList.add('selected');
  document.getElementById('add-project-modal').style.display = 'flex';
}

function pickProjectColor(el) {
  document.querySelectorAll('.proj-color-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  selectedProjectColor = el.dataset.val;
}

function saveProject() {
  const name = document.getElementById('project-name-input').value.trim();
  const start = document.getElementById('project-start-input').value;
  const end = document.getElementById('project-end-input').value;
  const status = document.getElementById('project-status-input').value;
  const tagsStr = document.getElementById('project-tags-input').value.trim();

  if (!name || !start || !end) {
    alert('Please fill in all fields');
    return;
  }

  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
  state.projects.push({
    id: Date.now().toString(),
    name,
    startDate: start,
    endDate: end,
    status,
    tags,
    color: selectedProjectColor
  });
  save();
  closeModal('add-project-modal');
  renderTimeline();
}

function deleteProject(id) {
  state.projects = state.projects.filter(p => p.id !== id);
  save();
  renderTimeline();
}

function toggleFilter(type, value) {
  if (type === 'tag') {
    if (projectFilters.tags.includes(value)) {
      projectFilters.tags = projectFilters.tags.filter(t => t !== value);
    } else {
      projectFilters.tags.push(value);
    }
  } else if (type === 'status') {
    if (projectFilters.status.includes(value)) {
      projectFilters.status = projectFilters.status.filter(s => s !== value);
    } else {
      projectFilters.status.push(value);
    }
  }
  renderTimeline();
}

function matchesFilters(project) {
  if (projectFilters.tags.length > 0) {
    if (!project.tags || !projectFilters.tags.some(t => project.tags.includes(t))) return false;
  }
  if (projectFilters.status.length > 0) {
    if (!projectFilters.status.includes(project.status)) return false;
  }
  return true;
}

function renderTimeline() {
  const daysInMonth = 31;
  const today = new Date();
  const todayDate = today.getDate();

  // Render filters
  const filterPills = document.getElementById('filter-pills');
  let html = '';

  const allTags = getAllTags();
  allTags.forEach(tag => {
    const isActive = projectFilters.tags.includes(tag);
    html += `<div class="filter-pill ${isActive ? 'active' : ''}" onclick="toggleFilter('tag', '${tag}')">${tag} <i data-lucide="x" style="width:12px;height:12px;"></i></div>`;
  });

  getAllStatuses().forEach(status => {
    const isActive = projectFilters.status.includes(status);
    html += `<div class="filter-pill ${isActive ? 'active' : ''}" onclick="toggleFilter('status', '${status}')">${status}</div>`;
  });

  filterPills.innerHTML = html;
  lucide.createIcons();

  // Render timeline header (day numbers)
  const container = document.getElementById('timeline-container');
  const pxPerDay = 60;

  let header = '<div class="timeline-header" style="width:' + (daysInMonth * pxPerDay) + 'px;">';
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), i);
    const dayName = ['S','M','T','W','T','F','S'][date.getDay()];
    header += `<div class="timeline-day-header" style="min-width:${pxPerDay}px;"><div class="timeline-day-label">${i}</div><div style="font-size:9px;color:#c4bdb5;">${dayName}</div></div>`;
  }
  header += '</div>';

  // Render grid lines
  let gridLines = '';
  for (let i = 1; i <= daysInMonth; i++) {
    gridLines += `<div class="timeline-grid-line" style="left:${i * pxPerDay}px;"></div>`;
  }

  // Render today line
  let todayLine = `<div class="timeline-today-line" style="left:${(todayDate - 0.5) * pxPerDay}px;"></div>`;

  // Render projects
  const filteredProjects = state.projects.filter(matchesFilters);
  let tracks = '';

  filteredProjects.forEach((proj, idx) => {
    const startDate = new Date(proj.startDate);
    const endDate = new Date(proj.endDate);
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const duration = Math.max(1, endDay - startDay + 1);
    const left = (startDay - 1) * pxPerDay + 12;
    const width = Math.max(80, duration * pxPerDay - 24);

    const tag1 = proj.tags && proj.tags.length > 0 ? proj.tags[0] : '';
    const statusClass = `status-${proj.status.toLowerCase()}`;

    tracks += `<div class="timeline-row" style="min-height:56px;">
      <div class="project-bar" style="left:${left}px;width:${width}px;background:${proj.color};color:#fff;"
           onmousedown="startDragProject(event, '${proj.id}')" data-project-id="${proj.id}">
        <div class="project-bar-resize left"></div>
        <div class="project-bar-content">
          <div class="project-bar-title">${proj.name}</div>
          ${tag1 ? `<div class="project-bar-tag">${tag1}</div>` : ''}
        </div>
        <div class="project-bar-resize right"></div>
      </div>
    </div>`;
  });

  if (filteredProjects.length === 0) {
    tracks = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#c4bdb5;min-width:4000px;"><i data-lucide="inbox" style="width:40px;height:40px;margin:0 auto 10px;display:block;"></i><p>No projects match filters.</p></div>';
  }

  const innerTrack = `${header}${gridLines}${todayLine}<div class="timeline-track">${tracks}</div>`;
  container.innerHTML = innerTrack;
  lucide.createIcons();

  // Attach resize listeners
  document.querySelectorAll('.project-bar-resize').forEach(el => {
    el.addEventListener('mousedown', (e) => handleResizeStart(e));
  });
}

function startDragProject(e, projectId) {
  if (e.target.classList.contains('project-bar-resize')) return;

  draggedProject = projectId;
  dragEdge = null;
  dragOffsetX = e.clientX;

  const bar = document.querySelector(`[data-project-id="${projectId}"]`);
  bar.classList.add('dragging');

  document.addEventListener('mousemove', dragProject);
  document.addEventListener('mouseup', stopDragProject);
  e.preventDefault();
}

function dragProject(e) {
  if (!draggedProject) return;
  const project = state.projects.find(p => p.id === draggedProject);
  if (!project) return;

  const delta = (e.clientX - dragOffsetX) / 60; // pixels to days
  const startDate = new Date(project.startDate);
  const newStart = new Date(startDate);
  newStart.setDate(newStart.getDate() + Math.round(delta));

  const endDate = new Date(project.endDate);
  const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  const newEnd = new Date(newStart);
  newEnd.setDate(newEnd.getDate() + duration - 1);

  project.startDate = formatDate(newStart);
  project.endDate = formatDate(newEnd);

  renderTimeline();
}

function stopDragProject() {
  if (draggedProject) {
    const bar = document.querySelector(`[data-project-id="${draggedProject}"]`);
    if (bar) bar.classList.remove('dragging');
  }
  draggedProject = null;
  save();
  document.removeEventListener('mousemove', dragProject);
  document.removeEventListener('mouseup', stopDragProject);
}

function handleResizeStart(e) {
  const bar = e.target.closest('.project-bar');
  if (!bar) return;

  const projectId = bar.dataset.projectId;
  draggedProject = projectId;
  dragEdge = e.target.classList.contains('left') ? 'left' : 'right';
  dragOffsetX = e.clientX;

  bar.classList.add('dragging');

  document.addEventListener('mousemove', resizeProject);
  document.addEventListener('mouseup', stopResizeProject);
  e.preventDefault();
}

function resizeProject(e) {
  if (!draggedProject) return;
  const project = state.projects.find(p => p.id === draggedProject);
  if (!project) return;

  const delta = (e.clientX - dragOffsetX) / 60;

  if (dragEdge === 'left') {
    const newStart = new Date(project.startDate);
    newStart.setDate(newStart.getDate() + Math.round(delta));
    const endDate = new Date(project.endDate);
    if (newStart < endDate) {
      project.startDate = formatDate(newStart);
    }
  } else {
    const newEnd = new Date(project.endDate);
    newEnd.setDate(newEnd.getDate() + Math.round(delta));
    const startDate = new Date(project.startDate);
    if (newEnd > startDate) {
      project.endDate = formatDate(newEnd);
    }
  }

  renderTimeline();
}

function stopResizeProject() {
  if (draggedProject) {
    const bar = document.querySelector(`[data-project-id="${draggedProject}"]`);
    if (bar) bar.classList.remove('dragging');
  }
  draggedProject = null;
  dragEdge = null;
  save();
  document.removeEventListener('mousemove', resizeProject);
  document.removeEventListener('mouseup', stopResizeProject);
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

let selectedProjectColor = '#c4b5fd';

// ─── MODALS ─────────────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).style.display='none'; }
document.addEventListener('click', e=>{ if(e.target.classList.contains('modal-overlay')) e.target.style.display='none'; });

// ─── ELEMENT SDK ─────────────────────────────────────────────────────────────
const defaultConfig = { app_title: 'HabitFlow', greeting: 'Good morning! ✨' };
window.elementSdk && window.elementSdk.init({
  defaultConfig,
  onConfigChange: async (config) => {
    document.getElementById('sidebar-title').textContent = config.app_title || defaultConfig.app_title;
    document.getElementById('sidebar-greeting').textContent = config.greeting || defaultConfig.greeting;
  },
  mapToCapabilities: (config) => ({ recolorables:[], borderables:[], fontEditable:undefined, fontSizeable:undefined }),
  mapToEditPanelValues: (config) => new Map([
    ['app_title', config.app_title || defaultConfig.app_title],
    ['greeting', config.greeting || defaultConfig.greeting]
  ])
});

// ─── INIT ───────────────────────────────────────────────────────────────────
function save() { /* Data saved on server */ }
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  if (!ensureAuthenticated()) return;
  loadHabits();
  renderTimeline();
  const now = new Date();
  const h = now.getHours();
  const greet = h<12?'Good morning! ☀️':h<17?'Good afternoon! 🌤':h<21?'Good evening! 🌅':'Good night! 🌙';
  document.getElementById('sidebar-greeting').textContent = greet;
});
if (!localStorage.getItem("token") || !localStorage.getItem("loggedInUser")) {
  window.location.href = "login.html";
}
// Key enter for inputs
document.addEventListener('keydown', e=>{ if(e.key==='Enter' && document.getElementById('add-modal').style.display!=='none') saveNote(); });