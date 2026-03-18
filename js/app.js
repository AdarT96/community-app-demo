/* ============================================================
   מערך מילואים  –  לוגיקת האפליקציה
   ============================================================ */

const APP = {
  currentScreen: 'login',
  currentGroup: 'All',
  scheduleView: 'timeline',
  calendarDate: new Date(),
  contactSearch: '',
  networkSearch: '',
  biometricRegistered: false,
  expandedNetworkId: null,
  myCalendarEvents: new Set(),
};

// ── ניתוב מסכים ───────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) { target.classList.add('active'); APP.currentScreen = id; }
  updateBottomNav(id);
  updateGlobalGroupFilter();
}

function updateBottomNav(screenId) {
  const navMap = {
    home: 'nav-home', contacts: 'nav-contacts', networking: 'nav-contacts',
    schedule: 'nav-schedule', documents: 'nav-docs', admin: 'nav-admin',
  };
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navId = navMap[screenId];
  if (navId) { const el = document.getElementById(navId); if (el) el.classList.add('active'); }

  const noNav = ['login', 'register', 'pending'];
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) bottomNav.style.display = noNav.includes(screenId) ? 'none' : 'flex';

  // הצג/הסתר פילטר גלובלי
  const gf = document.getElementById('global-group-filter');
  if (gf) gf.style.display = noNav.includes(screenId) ? 'none' : 'flex';
}

// ── פילטר קבוצה גלובלי ─────────────────────────────────────
function renderGlobalGroupFilter() {
  const container = document.getElementById('global-group-filter');
  if (!container) return;
  container.innerHTML = MOCK_DATA.groups.map(g => `
    <div class="chip ${APP.currentGroup === g.value ? 'active' : ''}"
         onclick="selectGroup('${g.value}')">
      <span class="chip-icon">${g.icon}</span>${g.label}
    </div>
  `).join('');
}

function updateGlobalGroupFilter() {
  const gf = document.getElementById('global-group-filter');
  if (!gf) return;
  gf.querySelectorAll('.chip').forEach(c => {
    // sync active state
  });
  renderGlobalGroupFilter();
}

function selectGroup(group) {
  APP.currentGroup = group;
  renderGlobalGroupFilter();
  // עדכן מסכים פעילים
  if (APP.currentScreen === 'home')      { renderNextEvent(); renderBirthdays(); renderStats(); }
  if (APP.currentScreen === 'schedule')  { renderScheduleContent(); }
  if (APP.currentScreen === 'contacts')  { renderContacts(); }
  if (APP.currentScreen === 'networking'){ renderNetworking(); }
  if (APP.currentScreen === 'documents') { renderDocuments(); }
  // עדכן תווית סינון בלוח השנה
  const lbl = document.getElementById('schedule-group-label');
  if (lbl) lbl.textContent = MOCK_DATA.groupLabel(APP.currentGroup);
}

// ── שעון ──────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('status-time');
  if (el) el.textContent = new Date().toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit', hour12:false });
}

// ── טוסט ──────────────────────────────────────────────────────
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ══════════════════════════════════════════════════════════════
//  אימות
// ══════════════════════════════════════════════════════════════
function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!email || !password) { showToast('⚠️ אנא מלא את כל השדות.'); return; }
  const user = MOCK_DATA.users.find(u => u.email === email && u.password === password);
  if (!user)                { showToast('❌ אימייל או סיסמה שגויים.'); return; }
  if (user.status === 'rejected') { showToast('🚫 חשבונך נדחה. צור קשר עם מנהל.'); return; }
  MOCK_DATA.currentUser = user;
  APP.biometricRegistered = true;
  if (user.status === 'pending') { showScreen('pending'); return; }
  loadHomeScreen();
  showScreen('home');
}

function handleBiometricLogin() {
  if (!APP.biometricRegistered) { showToast('📲 יש להירשם תחילה להפעלת הביומטריה.'); return; }
  MOCK_DATA.currentUser = MOCK_DATA.users[0];
  loadHomeScreen();
  showScreen('home');
  showToast('🔐 כניסה ביומטרית הצליחה!');
}

function handleRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const group    = document.getElementById('reg-group').value;
  if (!name || !email || !password || !group) { showToast('⚠️ אנא מלא את כל השדות.'); return; }
  if (password.length < 4) { showToast('⚠️ הסיסמה חייבת להכיל לפחות 4 תווים.'); return; }
  if (MOCK_DATA.users.find(u => u.email === email)) { showToast('📧 כתובת אימייל זו כבר רשומה.'); return; }
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2);
  MOCK_DATA.users.push({ id: MOCK_DATA.users.length + 1, name, email, password, role:'user', status:'pending', group, phone:'', whatsapp:'', birthday:'', profession:'', skills:[], bio:'', avatar: initials });
  MOCK_DATA.currentUser = MOCK_DATA.users[MOCK_DATA.users.length - 1];
  showScreen('pending');
}

function handleLogout() {
  MOCK_DATA.currentUser = null;
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  showScreen('login');
}

// ══════════════════════════════════════════════════════════════
//  מסך בית
// ══════════════════════════════════════════════════════════════
function loadHomeScreen() {
  const u = MOCK_DATA.currentUser;
  if (!u) return;
  const el = document.getElementById('home-user-name');
  if (el) el.textContent = u.name.split(' ')[0];
  const av = document.getElementById('home-avatar');
  if (av) { av.textContent = u.avatar; av.style.background = MOCK_DATA.groupColor(u.group); }
  const adminNav = document.getElementById('nav-admin');
  if (adminNav) adminNav.style.display = (u.role === 'admin') ? 'flex' : 'none';

  renderGlobalGroupFilter();
  renderNextEvent();
  renderBirthdays();
  // סטטיסטיקות – מנהל בלבד
  const statsSection = document.getElementById('stats-section');
  if (statsSection) statsSection.style.display = (u.role === 'admin') ? 'block' : 'none';
  if (u.role === 'admin') renderStats();
  updateAdminBadge();
}

function renderNextEvent() {
  const ev = MOCK_DATA.getNextEvent(APP.currentGroup);
  const container = document.getElementById('next-event-container');
  if (!container) return;
  if (!ev) {
    container.innerHTML = `<div class="card text-center text-muted" style="padding:24px">
      <div style="font-size:2rem">📅</div>
      <p style="margin-top:8px;font-size:.85rem">אין אירועים קרובים לקבוצה זו.</p>
    </div>`;
    return;
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const days = Math.ceil((new Date(ev.date) - today) / 86400000);
  container.innerHTML = `
    <div class="next-event-card" onclick="navigateTo('schedule')" style="cursor:pointer">
      <div class="event-tag">⚡ האירוע הבא</div>
      <div class="countdown-badge">
        <span class="count-num">${days === 0 ? '🔔' : days}</span>
        <span class="count-label">${days === 0 ? 'היום' : 'ימים'}</span>
      </div>
      <h3>${ev.title}</h3>
      <div class="event-meta">
        <span>📅 ${MOCK_DATA.formatDate(ev.date)}</span>
        <span>📍 ${ev.location}</span>
      </div>
    </div>`;
}

function renderBirthdays() {
  const birthdays = MOCK_DATA.getUpcomingBirthdays(30);
  const container = document.getElementById('birthday-container');
  if (!container) return;
  if (birthdays.length === 0) {
    container.innerHTML = `<p class="text-muted" style="font-size:.8rem;padding:8px 0">🎂 אין ימי הולדת ב-30 הימים הקרובים.</p>`;
    return;
  }
  container.innerHTML = `<div class="birthday-scroll">` +
    birthdays.map(u => {
      const daysText = u.daysUntil === 0 ? '🎂 היום!' : `בעוד ${u.daysUntil} י'`;
      return `<div class="birthday-card">
        <div class="b-avatar" style="background:${MOCK_DATA.groupColor(u.group)}">${u.avatar}</div>
        <div class="b-name">${u.name.split(' ')[0]}</div>
        <div class="b-days">${daysText}</div>
      </div>`;
    }).join('') + `</div>`;
}

function renderStats() {
  const approved = MOCK_DATA.getApprovedMembers().length;
  const pending  = MOCK_DATA.getPendingUsers().length;
  const events   = MOCK_DATA.events.filter(e => new Date(e.date) >= new Date()).length;
  const el = document.getElementById('stats-container');
  if (!el) return;
  el.innerHTML = `
    <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-num">${approved}</div><div class="stat-label">חברים</div></div>
    <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-num">${events}</div><div class="stat-label">אירועים</div></div>
    <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-num">${pending}</div><div class="stat-label">ממתינים</div></div>`;
}

function updateAdminBadge() {
  const badge = document.getElementById('admin-badge');
  if (!badge) return;
  const count = MOCK_DATA.getPendingUsers().length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// ══════════════════════════════════════════════════════════════
//  אנשי קשר
// ══════════════════════════════════════════════════════════════
function loadContacts() {
  APP.contactSearch = '';
  const inp = document.getElementById('contact-search');
  if (inp) inp.value = '';
  renderContacts();
}

function renderContacts() {
  const q = APP.contactSearch.toLowerCase();
  const members = MOCK_DATA.getApprovedMembers(APP.currentGroup === 'All' ? 'All' : APP.currentGroup)
    .filter(u => !q || u.name.includes(q) || u.profession.includes(q) || MOCK_DATA.groupLabel(u.group).includes(q) || u.phone.includes(q));

  const container = document.getElementById('contact-list');
  if (!container) return;

  if (members.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>לא נמצאו חברים.</p></div>`;
    return;
  }

  const isAdmin = MOCK_DATA.currentUser?.role === 'admin';
  container.innerHTML = members.map(u => `
    <div class="contact-card">
      <div class="contact-avatar" style="background:${MOCK_DATA.groupColor(u.group)}">${u.avatar}</div>
      <div class="contact-info">
        <div class="contact-name">${u.name}</div>
        <div class="contact-role">${u.profession}</div>
        ${isAdmin && u.rank ? `<div class="contact-rank">🎖️ ${u.rank}</div>` : ''}
        <div class="contact-phone">📱 ${u.phone || 'לא צוין'}</div>
        <span class="contact-group-badge" style="background:${MOCK_DATA.groupColor(u.group)}22;color:${MOCK_DATA.groupColor(u.group)}">${MOCK_DATA.groupLabel(u.group)}</span>
      </div>
      <div class="contact-actions">
        <button class="action-btn action-btn-call ripple" onclick="callMember('${u.phone}')" title="התקשר">📞</button>
        <button class="action-btn action-btn-wa ripple" onclick="whatsappMember('${u.whatsapp}')" title="WhatsApp">💬</button>
      </div>
    </div>`).join('');
}

function callMember(phone) {
  if (phone) showToast(`📞 מתקשר ל-${phone}…`);
}
function whatsappMember(wa) {
  if (wa) showToast(`💬 פותח WhatsApp…`);
}

// ── רשת קשרים (Networking) מורחבת ────────────────────────────
function loadNetworking() {
  APP.networkSearch = '';
  APP.expandedNetworkId = null;
  const inp = document.getElementById('network-search');
  if (inp) inp.value = '';
  renderNetworking();
}

function renderNetworking() {
  const q = APP.networkSearch.toLowerCase();
  const members = MOCK_DATA.getApprovedMembers(APP.currentGroup === 'All' ? 'All' : APP.currentGroup)
    .filter(u => !q ||
      u.name.includes(q) ||
      u.profession.includes(q) ||
      (u.bio && u.bio.includes(q)) ||
      u.skills.some(s => s.toLowerCase().includes(q))
    );

  const container = document.getElementById('network-list');
  if (!container) return;

  if (members.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>לא נמצאו חברים תואמים.</p></div>`;
    return;
  }

  container.innerHTML = members.map(u => {
    const isExpanded = APP.expandedNetworkId === u.id;
    const color = MOCK_DATA.groupColor(u.group);
    return `
    <div class="network-card-full" id="ncard-${u.id}">
      <!-- כותרת – תמיד מוצגת -->
      <div class="network-card-header" onclick="toggleNetworkCard(${u.id})">
        <div class="contact-avatar" style="background:${color};width:48px;height:48px;font-size:.9rem;flex-shrink:0">${u.avatar}</div>
        <div style="flex:1;min-width:0">
          <div class="network-name">${u.name}</div>
          <div class="network-profession">💼 ${u.profession}</div>
          ${MOCK_DATA.currentUser?.role === 'admin' && u.rank ? `<div class="contact-rank" style="margin-top:2px">🎖️ ${u.rank}</div>` : ''}
          <span class="contact-group-badge" style="background:${color}22;color:${color}">${MOCK_DATA.groupLabel(u.group)}</span>
        </div>
        <div class="network-expand-btn ${isExpanded ? 'open' : ''}">›</div>
      </div>

      <!-- תגיות מיומנויות – תמיד -->
      <div class="skill-tags" style="padding:0 14px 12px">
        ${u.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
      </div>

      <!-- פרטים מורחבים -->
      <div class="network-details ${isExpanded ? 'open' : ''}">
        <div class="divider" style="margin:0 0 12px"></div>

        <!-- ביו -->
        ${u.bio ? `
        <div class="network-bio-section">
          <div class="network-detail-label">👤 אודות</div>
          <div class="network-bio-text">${u.bio}</div>
        </div>` : ''}

        <!-- פרטי קשר -->
        <div class="network-contact-row">
          <div class="network-detail-label">📱 פרטי קשר</div>
          <div style="display:flex;gap:10px;margin-top:8px">
            <button class="btn btn-tonal btn-sm ripple" style="flex:1;border-radius:10px;padding:10px;flex-direction:column;gap:3px;height:auto"
              onclick="callMember('${u.phone}')">
              <span style="font-size:1.1rem">📞</span>
              <span style="font-size:.7rem">${u.phone || 'לא צוין'}</span>
            </button>
            <button class="btn btn-tonal btn-sm ripple" style="flex:1;border-radius:10px;padding:10px;flex-direction:column;gap:3px;height:auto;background:#E8F5E9"
              onclick="whatsappMember('${u.whatsapp}')">
              <span style="font-size:1.1rem">💬</span>
              <span style="font-size:.7rem">WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleNetworkCard(id) {
  APP.expandedNetworkId = APP.expandedNetworkId === id ? null : id;
  renderNetworking();
}

// ══════════════════════════════════════════════════════════════
//  לוח שנה / גנט
// ══════════════════════════════════════════════════════════════
function loadSchedule() {
  renderScheduleContent();
  const lbl = document.getElementById('schedule-group-label');
  if (lbl) lbl.textContent = MOCK_DATA.groupLabel(APP.currentGroup);
}

function setScheduleView(view) {
  APP.scheduleView = view;
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`toggle-${view}`);
  if (btn) btn.classList.add('active');
  document.getElementById('timeline-scroll').style.display = view === 'timeline' ? 'flex' : 'none';
  document.getElementById('calendar-scroll').style.display = view === 'calendar'  ? 'flex' : 'none';
  if (view === 'calendar') renderCalendar();
  else renderScheduleContent();
}

function renderScheduleContent() {
  const events = MOCK_DATA.getFilteredEvents(APP.currentGroup)
    .filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const container = document.getElementById('timeline-view');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>אין אירועים קרובים לקבוצה זו.</p></div>`;
    return;
  }

  const byMonth = {};
  events.forEach(ev => {
    const month = new Date(ev.date).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(ev);
  });

  const typeEmoji = { workshop:'🎓', social:'🎉', training:'💪', fitness:'🏃', meeting:'📋', ceremony:'🏅' };

  let html = '<div class="timeline">';
  Object.entries(byMonth).forEach(([month, evs]) => {
    html += `<div class="timeline-month-header">${month}</div>`;
    evs.forEach((ev, idx) => {
      const color = ev.color || MOCK_DATA.groupColor(ev.group);
      const emoji = typeEmoji[ev.type] || '📌';
      const isMultiDay = ev.date !== ev.endDate;
      html += `
        <div class="timeline-item">
          <div class="timeline-line">
            <div class="timeline-dot" style="background:${color}">${emoji}</div>
            ${idx < evs.length - 1 ? '<div class="timeline-connector"></div>' : ''}
          </div>
          <div class="event-card" style="border-color:${color}" onclick="showEventDetail(${ev.id})">
            <div class="event-title">${ev.title}</div>
            <div class="event-info">
              <span>📅 ${MOCK_DATA.formatDate(ev.date)}${isMultiDay ? ` – ${MOCK_DATA.formatDate(ev.endDate)}` : ''}</span>
              <span>📍 ${ev.location}</span>
            </div>
            <span class="event-type-badge" style="background:${color}22;color:${color}">${MOCK_DATA.typeLabel(ev.type)}</span>
          </div>
        </div>`;
    });
  });
  html += '</div>';
  container.innerHTML = html;
}

function showEventDetail(id) {
  const ev = MOCK_DATA.events.find(e => e.id === id);
  if (!ev) return;
  const typeEmoji = { workshop:'🎓', social:'🎉', training:'💪', fitness:'🏃', meeting:'📋', ceremony:'🏅' };
  const isMultiDay = ev.date !== ev.endDate;
  const color = ev.color || MOCK_DATA.groupColor(ev.group);
  const content = document.getElementById('event-modal-content');
  if (content) content.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title">${typeEmoji[ev.type] || '📌'} ${ev.title}</div>
    <div class="divider mb-8"></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;gap:10px;align-items:center">
        <span style="font-size:1.2rem">📅</span>
        <div>
          <div style="font-size:.7rem;color:var(--md-on-surface-variant);font-weight:700">תאריך</div>
          <div style="font-size:.9rem">${MOCK_DATA.formatDate(ev.date)}${isMultiDay ? ` – ${MOCK_DATA.formatDate(ev.endDate)}` : ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <span style="font-size:1.2rem">📍</span>
        <div>
          <div style="font-size:.7rem;color:var(--md-on-surface-variant);font-weight:700">מיקום</div>
          <div style="font-size:.9rem">${ev.location}</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <span style="font-size:1.2rem">${MOCK_DATA.groupIcon(ev.group)}</span>
        <div>
          <div style="font-size:.7rem;color:var(--md-on-surface-variant);font-weight:700">קבוצה</div>
          <div style="font-size:.9rem">${MOCK_DATA.groupLabel(ev.group)}</div>
        </div>
      </div>
      <div style="background:${color}15;border-radius:12px;padding:14px;border-right:3px solid ${color}">
        <div style="font-size:.75rem;color:var(--md-on-surface-variant);margin-bottom:6px;font-weight:600">תיאור האירוע</div>
        <div style="font-size:.875rem;line-height:1.7">${ev.description}</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-filled" onclick="closeModal('event-modal')" style="flex:1">סגור</button>
      <button class="btn ${APP.myCalendarEvents.has(ev.id) ? 'btn-outlined' : 'btn-tonal'}" 
        onclick="toggleMyCalendarEvent(${ev.id})" 
        style="flex:1.4;border-color:${APP.myCalendarEvents.has(ev.id) ? '#E53935' : 'transparent'};color:${APP.myCalendarEvents.has(ev.id) ? '#E53935' : 'inherit'}">
        ${APP.myCalendarEvents.has(ev.id) ? '🗑️ הסר מיומן' : '📌 הוסף ליומן שלי'}
      </button>
    </div>
  `;
  document.getElementById('event-modal').classList.add('open');
}

function toggleMyCalendarEvent(id) {
  if (APP.myCalendarEvents.has(id)) {
    APP.myCalendarEvents.delete(id);
    showToast('🗑️ הוסר מהיומן האישי');
  } else {
    APP.myCalendarEvents.add(id);
    showToast('📌 נוסף ליומן האישי!');
  }
  closeModal('event-modal');
  if (APP.scheduleView === 'calendar') renderCalendar();
  else renderScheduleContent();
}

// לוח חודשי
function renderCalendar() {
  const d = APP.calendarDate;
  const year = d.getFullYear(), month = d.getMonth();
  document.getElementById('cal-month-label').textContent = d.toLocaleDateString('he-IL', { month:'long', year:'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const today = new Date();
  const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
  const eventDays = new Set(
    MOCK_DATA.getFilteredEvents(APP.currentGroup)
      .map(e => e.date)
      .filter(d => d.startsWith(monthPrefix))
      .map(d => parseInt(d.split('-')[2]))
  );
  const myCalDays = new Set(
    MOCK_DATA.events
      .filter(e => APP.myCalendarEvents.has(e.id) && e.date.startsWith(monthPrefix))
      .map(e => parseInt(e.date.split('-')[2]))
  );
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  const days = ["א'","ב'","ג'","ד'","ה'","ו'","ש'"];
  let html = days.map(d => `<div class="cal-day-header">${d}</div>`).join('');
  for (let i = firstDay-1; i >= 0; i--) html += `<div class="cal-day other-month">${daysInPrev-i}</div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    html += `<div class="cal-day${isToday?' today':''}${eventDays.has(d)?' has-event':''}" onclick="calDayClick(${year},${month+1},${d})">${d}</div>`;
  }
  const cells = firstDay + daysInMonth;
  const rem = cells % 7 === 0 ? 0 : 7 - (cells % 7);
  for (let d = 1; d <= rem; d++) html += `<div class="cal-day other-month">${d}</div>`;
  grid.innerHTML = html;
}

function calPrev() { APP.calendarDate.setMonth(APP.calendarDate.getMonth()-1); renderCalendar(); }
function calNext() { APP.calendarDate.setMonth(APP.calendarDate.getMonth()+1); renderCalendar(); }
function calDayClick(y, m, d) {
  const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const evs = MOCK_DATA.events.filter(e => e.date === dateStr);
  if (evs.length === 0) { showToast('אין אירועים בתאריך זה.'); return; }
  evs.forEach(ev => setTimeout(() => showEventDetail(ev.id), 100));
}

// ══════════════════════════════════════════════════════════════
//  מסמכים
// ══════════════════════════════════════════════════════════════
function loadDocuments() {
  renderDocuments();
}

function renderDocuments() {
  const container = document.getElementById('doc-list');
  if (!container) return;

  // סנן לפי קבוצה: הצג תמיד "כללי" + הקבוצה שנבחרה
  const filtered = APP.currentGroup === 'All'
    ? MOCK_DATA.documents
    : MOCK_DATA.documents.filter(cat => cat.group === APP.currentGroup || cat.group === 'All');

  const typeIcon  = { form:'📋', pdf:'📄', doc:'📝' };
  const typeClass = { form:'doc-type-form', pdf:'doc-type-pdf', doc:'doc-type-doc' };

  container.innerHTML = filtered.map((cat, ci) => `
    <div class="doc-category" id="cat-${ci}">
      <div class="doc-category-header" onclick="toggleDocCategory(${ci})">
        <span class="doc-cat-icon">${cat.icon}</span>
        <span class="doc-cat-title">${cat.category}</span>
        <span class="doc-cat-count">${cat.items.length} פריטים</span>
        <span class="doc-cat-chevron">‹</span>
      </div>
      <div class="doc-category-items">
        ${cat.items.map(item => `
          <div class="doc-item" onclick="openDoc('${item.url}','${item.type}','${item.title.replace(/'/g,"\\'")}')">
            <div class="doc-type-icon ${typeClass[item.type]}">${typeIcon[item.type]}</div>
            <div class="doc-item-info">
              <div class="doc-item-title">${item.title}</div>
              <div class="doc-item-desc">${item.description}</div>
            </div>
            <span class="doc-item-action">‹</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function toggleDocCategory(idx) {
  const el = document.getElementById(`cat-${idx}`);
  if (el) el.classList.toggle('open');
}

function openDoc(url, type, title) {
  const action = type === 'form' ? '📋 פותח טופס' : type === 'pdf' ? '📄 מוריד PDF' : '📝 פותח מסמך';
  showToast(`${action}: ${title}`);
}

// ══════════════════════════════════════════════════════════════
//  פאנל ניהול
// ══════════════════════════════════════════════════════════════
function loadAdmin() {
  renderAdminPending();
  renderAdminQuickActions();
  renderAdminMemberList();
}

function renderAdminPending() {
  const pending = MOCK_DATA.getPendingUsers();
  const container = document.getElementById('admin-pending-list');
  if (!container) return;
  if (pending.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:20px"><div class="empty-icon">✅</div><p>אין בקשות ממתינות.</p></div>`;
    return;
  }
  container.innerHTML = pending.map(u => `
    <div class="user-approval-card">
      <div class="contact-avatar" style="background:${MOCK_DATA.groupColor(u.group)};width:44px;height:44px">${u.avatar}</div>
      <div class="user-approval-info">
        <div class="user-approval-name">${u.name}</div>
        <div class="user-approval-meta">${u.email} · ${MOCK_DATA.groupLabel(u.group)}</div>
      </div>
      <div class="approval-actions">
        <button class="btn btn-success btn-sm ripple" onclick="approveUser(${u.id})">✓</button>
        <button class="btn btn-error btn-sm ripple" onclick="rejectUser(${u.id})">✕</button>
      </div>
    </div>`).join('');
}

function approveUser(id) {
  const user = MOCK_DATA.users.find(u => u.id === id);
  if (user) { user.status = 'approved'; showToast(`✅ ${user.name} אושר!`); loadAdmin(); renderStats(); updateAdminBadge(); }
}
function rejectUser(id) {
  const user = MOCK_DATA.users.find(u => u.id === id);
  if (user) { user.status = 'rejected'; showToast(`❌ ${user.name} נדחה.`); loadAdmin(); updateAdminBadge(); }
}

function renderAdminQuickActions() {
  const actions = [
    { icon:'📅', bg:'#E8F5E9', title:'הוסף אירוע חדש',          desc:'הוסף אירוע ללוח הגנט',               action:'showAdminAddEvent()' },
    { icon:'👥', bg:'#E3F2FD', title:'עריכת רשימת חברים',        desc:'עדכן פרטי קשר של חברים',              action:"showToast('📝 עורך תוכן – בקרוב!')" },
    { icon:'📊', bg:'#FFF3E0', title:'ייצוא ל-Google Sheets',    desc:'סנכרן נתונים לגיליון',                 action:"showToast('📊 סנכרון Google Sheets – בקרוב!')" },
    { icon:'🔔', bg:'#FCE4EC', title:'שלח התראה לקבוצה',         desc:'שלח הודעה לחברי קבוצה',                action:'showAdminNotify()' },
  ];
  const container = document.getElementById('admin-actions');
  if (!container) return;
  container.innerHTML = actions.map(a => `
    <div class="admin-quick-action ripple" onclick="${a.action}">
      <div class="admin-qa-icon" style="background:${a.bg}">${a.icon}</div>
      <div class="admin-qa-info">
        <div class="admin-qa-title">${a.title}</div>
        <div class="admin-qa-desc">${a.desc}</div>
      </div>
      <span class="admin-qa-arrow">‹</span>
    </div>`).join('');
}

function renderAdminMemberList() {
  const container = document.getElementById('admin-member-list');
  if (!container) return;
  container.innerHTML = MOCK_DATA.users.map(u => `
    <div style="display:flex;align-items:center;gap:10px;background:var(--md-surface);border-radius:10px;padding:10px 14px;box-shadow:var(--shadow-1)">
      <div class="contact-avatar" style="background:${MOCK_DATA.groupColor(u.group)};width:36px;height:36px;font-size:.75rem">${u.avatar}</div>
      <div style="flex:1">
        <div style="font-size:.85rem;font-weight:500">${u.name}</div>
        <div style="font-size:.72rem;color:var(--md-on-surface-variant)">${MOCK_DATA.groupLabel(u.group)} · ${u.role === 'admin' ? 'מנהל' : 'חבר'}${u.rank ? ` · 🎖️ ${u.rank}` : ''}</div>
      </div>
      <span class="status-badge status-${u.status}">${MOCK_DATA.statusLabel(u.status)}</span>
    </div>`).join('');
}

function showAdminAddEvent() { document.getElementById('add-event-modal').classList.add('open'); }
function showAdminNotify()   { document.getElementById('notify-modal').classList.add('open'); }

function submitNewEvent() {
  const title    = document.getElementById('ev-title').value.trim();
  const date     = document.getElementById('ev-date').value;
  const location = document.getElementById('ev-location').value.trim();
  const group    = document.getElementById('ev-group').value;
  const type     = document.getElementById('ev-type').value;
  const desc     = document.getElementById('ev-desc').value.trim();
  if (!title || !date || !location || !group) { showToast('⚠️ אנא מלא את כל השדות החובה.'); return; }
  MOCK_DATA.events.push({ id: MOCK_DATA.events.length+1, title, date, endDate:date, group, location, description:desc||'אין תיאור.', type:type||'meeting', color:MOCK_DATA.groupColor(group) });
  closeModal('add-event-modal');
  showToast('✅ האירוע נוסף לגנט!');
  ['ev-title','ev-date','ev-location','ev-desc'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  renderNextEvent();
}

function sendNotification() {
  const msg = document.getElementById('notify-msg').value.trim();
  const group = document.getElementById('notify-group').value;
  if (!msg) { showToast('⚠️ אנא הכנס הודעה.'); return; }
  closeModal('notify-modal');
  showToast(`🔔 ההתראה נשלחה לקבוצת ${MOCK_DATA.groupLabel(group)}!`);
  document.getElementById('notify-msg').value = '';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// ══════════════════════════════════════════════════════════════
//  ניווט
// ══════════════════════════════════════════════════════════════
function navigateTo(screen) {
  showScreen(screen);
  if (screen === 'home')       loadHomeScreen();
  if (screen === 'contacts')   loadContacts();
  if (screen === 'networking') loadNetworking();
  if (screen === 'schedule')   loadSchedule();
  if (screen === 'documents')  loadDocuments();
  if (screen === 'admin')      loadAdmin();
}

function setContactTab(tab) {
  document.querySelectorAll('.contact-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.getElementById('contacts-screen-inner').style.display  = tab === 'directory' ? 'flex' : 'none';
  document.getElementById('networking-screen-inner').style.display = tab === 'networking' ? 'flex' : 'none';
  if (tab === 'directory') loadContacts(); else loadNetworking();
}

// ══════════════════════════════════════════════════════════════
//  אתחול
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 30000);
  showScreen('login');

  document.getElementById('contact-search')?.addEventListener('input', e => { APP.contactSearch = e.target.value; renderContacts(); });
  document.getElementById('network-search')?.addEventListener('input', e => { APP.networkSearch = e.target.value; renderNetworking(); });

  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });

  const dp = document.getElementById('ev-date');
  if (dp) dp.min = new Date().toISOString().split('T')[0];
});