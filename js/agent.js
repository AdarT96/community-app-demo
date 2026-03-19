/* ============================================================
   מערך מילואים  –  סוכן חכם
   ============================================================ */

// ── Gemini AI (אופציונלי, מוגדר ב-config.js) ────────────────

function buildSystemPrompt() {
  const user = MOCK_DATA.currentUser;
  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const isAdmin = user?.role === 'admin';

  const eventsText = MOCK_DATA.events.map(e =>
    `[${e.id}] ${e.title} | תאריך: ${e.date}${e.endDate && e.endDate !== e.date ? '–' + e.endDate : ''} | מיקום: ${e.location} | קבוצה: ${MOCK_DATA.groupLabel(e.group)} | סוג: ${MOCK_DATA.typeLabel(e.type)} | תיאור: ${e.description}`
  ).join('\n');

  const members = MOCK_DATA.getApprovedMembers();
  const membersText = members.map(u =>
    `${u.name} | תפקיד: ${u.profession} | קבוצה: ${MOCK_DATA.groupLabel(u.group)} | טלפון: ${u.phone || 'לא זמין'} | מיומנויות: ${(u.skills || []).join(', ')}${u.bio ? ' | ביוגרפיה: ' + u.bio : ''}${isAdmin && u.rank ? ' | דרגה: ' + u.rank : ''}${u.birthday ? ' | יום הולדת: ' + u.birthday : ''}`
  ).join('\n');

  const docsText = MOCK_DATA.documents.map(cat =>
    `קטגוריה: ${cat.category} – פריטים: ${cat.items.map(i => i.title).join(', ')}`
  ).join('\n');

  return `אתה סוכן חכם של אפליקציית "מערך מילואים".
ענה תמיד בעברית, בצורה תמציתית וידידותית.
היום: ${today}
משתמש מחובר: ${user?.name || 'אורח'} (${isAdmin ? 'מנהל' : 'חבר'})

=== אירועים מתוכננים ===
${eventsText}

=== חברי המערך ===
${membersText}

=== מסמכים וטפסים ===
${docsText}

=== הנחיות ===
- ענה ישירות בעברית
- לאירועים: ציין שם, תאריך מדויק, מיקום
- אם שואלים "מתי X" – תן תאריך ספציפי
- אם אין מידע – אמור זאת בכנות
- תשובה קצרה ומדויקת עדיפה`;
}

async function callGeminiAPI(query) {
  const key = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.geminiApiKey) || '';
  if (!key) return null;

  const model = APP_CONFIG.geminiModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = {
    system_instruction: { parts: [{ text: buildSystemPrompt() }] },
    contents: [{ parts: [{ text: query }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `שגיאה ${resp.status}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ══════════════════════════════════════════════════════════════
//  סוכן keyword (עובד ללא API)
// ══════════════════════════════════════════════════════════════

const AGENT = {

  _stopWords: new Set([
    'מה','מי','איפה','מתי','כמה','איך','למה','האם','יש','אין',
    'של','על','עם','את','לי','לו','לה','לנו','לכם','לכן','להם',
    'הוא','היא','הם','הן','אני','אתה','את','אנחנו','אתם','אתן',
    'זה','זו','זאת','אלה','אלו','שם','פה','כאן','עכשיו','היום',
    'נשמע','קורה','חדש','חדשות','בסדר','טוב','יפה','נחמד',
    'תן','תני','תנו','רוצה','רוצים','תאריך','פרטים','מידע',
    'הבא','הקרוב','הבאה','הקרובה','הבאים','הקרובים',
  ]),

  _isSmallTalk(q) {
    const g = ['שלום','היי','הי','מה נשמע','מה קורה','מה המצב','מה שלומך',
      'בוקר טוב','ערב טוב','לילה טוב','תודה','תודה רבה','מעולה',
      'כל הכבוד','אוקיי','אוקי','ok','hello','hi','hey',
      'מה אתה יכול','עזור','עזרה','help'];
    return g.some(w => q.includes(w));
  },

  // ── חילוץ מילות מפתח + הסרת קידומות עבריות ──────────────
  _extractKeywords(q) {
    const prefixes = ['ה','ב','ל','מ','כ','ו','ש'];
    const stop = this._stopWords;
    const words = q.split(/\s+/).filter(w => w.length > 1);
    const result = new Set();
    words.forEach(w => {
      if (!stop.has(w)) result.add(w);
      if (w.length > 2 && prefixes.includes(w[0])) {
        const s1 = w.slice(1);
        if (!stop.has(s1) && s1.length > 1) result.add(s1);
        if (s1.length > 2 && prefixes.includes(s1[0])) {
          const s2 = s1.slice(1);
          if (!stop.has(s2) && s2.length > 1) result.add(s2);
        }
      }
    });
    return [...result].filter(w => w.length > 1);
  },

  // ── זיהוי כוונת "מתי X הקרוב" → מחזיר אירוע קרוב ──────────
  _findNextMatchingEvent(q) {
    const wantsNext = q.includes('הקרוב') || q.includes('הבא') || q.includes('הקרובה') || q.includes('הבאה') || q.includes('מתי');
    if (!wantsNext) return null;

    const keywords = this._extractKeywords(q);
    if (keywords.length === 0) return null;

    const today = new Date(); today.setHours(0,0,0,0);
    const upcoming = MOCK_DATA.events
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const found = upcoming.filter(e =>
      keywords.some(k =>
        e.title.toLowerCase().includes(k) ||
        e.location.toLowerCase().includes(k) ||
        e.description.toLowerCase().includes(k) ||
        MOCK_DATA.typeLabel(e.type).includes(k) ||
        MOCK_DATA.groupLabel(e.group).toLowerCase().includes(k)
      )
    );

    if (found.length === 0) return null;
    // Return the next one (closest date)
    return {
      text: `📅 הנה ${found.length > 1 ? found.length + ' האירועים הקרובים' : 'האירוע הקרוב'}:`,
      cards: found.map(e => this._eventCard(e))
    };
  },

  processQuery(query) {
    const user = MOCK_DATA.currentUser;
    if (!user) return { text: 'יש להתחבר תחילה כדי להשתמש בסוכן.', cards: [] };

    const q = query.trim().toLowerCase();
    const isAdmin = user.role === 'admin';

    if (this._isSmallTalk(q)) return this._defaultResponse(isAdmin);

    // ── חודש ───────────────────────────────────────────────
    const monthMatch = this._matchMonth(q);
    if (monthMatch !== null) return this._getEventsByMonth(monthMatch, isAdmin);

    // ── "מתי X הקרוב" – חיפוש אירוע קרוב ─────────────────
    if (q.includes('מתי') || q.includes('הקרוב') || q.includes('הבא')) {
      const next = this._findNextMatchingEvent(q);
      if (next) return next;
    }

    // ── ימי הולדת ────────────────────────────────────────
    if (q.includes('יום הולדת') || q.includes('ימי הולדת') || q.includes('הולדת')) {
      return this._getBirthdays();
    }

    // ── אנשים ────────────────────────────────────────────
    if (q.includes('פרטים') || q.includes('מי') || q.includes('מידע') || q.includes('איש') || q.includes('חבר') || q.includes('על') || q.includes('טלפון')) {
      const personResult = this._searchPerson(q, isAdmin);
      if (personResult) return personResult;
      if (q.includes('חברים') || q.includes('כל החברים') || q.includes('רשימת חברים'))
        return this._getAllMembers(isAdmin);
    }

    // ── מסמכים ───────────────────────────────────────────
    if (q.includes('מסמך') || q.includes('מסמכים') || q.includes('טופס') || q.includes('טפסים') || q.includes('הורדה') || q.includes('קישור')) {
      return this._getDocuments(q, user);
    }

    // ── סטטיסטיקות (מנהל) ─────────────────────────────────
    if (isAdmin && (q.includes('סטטיסטיקה') || q.includes('כמה חברים') || q.includes('כמה אירועים') || q.includes('ממתינים') || q.includes('כמה') || q.includes('סה"כ'))) {
      return this._getStats();
    }

    // ── אירועים כלליים ────────────────────────────────────
    if (q.includes('אירוע') || q.includes('אירועים') || q.includes('לוז') || q.includes('לוח שנה') || q.includes('מועד')) {
      const eventResult = this._searchEvent(q, isAdmin);
      if (eventResult) return eventResult;
      return this._getUpcomingEvents(isAdmin);
    }

    // ── חיפוש כללי ────────────────────────────────────────
    const personResult = this._searchPerson(q, isAdmin);
    if (personResult) return personResult;
    const eventResult = this._searchEvent(q, isAdmin);
    if (eventResult) return eventResult;

    return this._defaultResponse(isAdmin);
  },

  _matchMonth(q) {
    const m = { 'ינואר':1,'פברואר':2,'מרץ':3,'מרס':3,'אפריל':4,'מאי':5,'יוני':6,'יולי':7,'אוגוסט':8,'ספטמבר':9,'אוקטובר':10,'נובמבר':11,'דצמבר':12 };
    for (const [name, num] of Object.entries(m)) {
      if (q.includes(name)) return num;
    }
    return null;
  },

  _getEventsByMonth(monthNum, isAdmin) {
    const year = new Date().getFullYear();
    const prefix = `${year}-${String(monthNum).padStart(2,'0')}`;
    const names = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    const events = MOCK_DATA.events.filter(e => e.date.startsWith(prefix));
    if (events.length === 0) return { text: `אין אירועים מתוכננים לחודש ${names[monthNum]}.`, cards: [] };
    return { text: `🗓️ אירועים בחודש **${names[monthNum]}** (${events.length} אירועים):`, cards: events.map(e => this._eventCard(e)) };
  },

  _searchEvent(q, isAdmin) {
    const keywords = this._extractKeywords(q);
    if (keywords.length === 0) return null;
    const found = MOCK_DATA.events.filter(e =>
      keywords.some(k =>
        e.title.toLowerCase().includes(k) ||
        e.location.toLowerCase().includes(k) ||
        e.description.toLowerCase().includes(k) ||
        MOCK_DATA.typeLabel(e.type).includes(k) ||
        MOCK_DATA.groupLabel(e.group).toLowerCase().includes(k)
      )
    );
    if (found.length === 0) return null;
    return { text: found.length === 1 ? `מצאתי אירוע תואם:` : `מצאתי ${found.length} אירועים תואמים:`, cards: found.map(e => this._eventCard(e)) };
  },

  _getUpcomingEvents(isAdmin) {
    const today = new Date(); today.setHours(0,0,0,0);
    const events = MOCK_DATA.events.filter(e => new Date(e.date) >= today).sort((a,b) => new Date(a.date)-new Date(b.date)).slice(0,5);
    if (events.length === 0) return { text: 'אין אירועים קרובים.', cards: [] };
    return { text: `📅 5 האירועים הקרובים:`, cards: events.map(e => this._eventCard(e)) };
  },

  _searchPerson(q, isAdmin) {
    const approved = MOCK_DATA.users.filter(u => u.status === 'approved');
    const keywords = this._extractKeywords(q);
    if (keywords.length === 0) return null;
    const found = approved.filter(u =>
      keywords.some(k =>
        u.name.includes(k) ||
        u.profession.toLowerCase().includes(k) ||
        u.skills.some(s => s.toLowerCase().includes(k)) ||
        (u.bio && u.bio.includes(k)) ||
        MOCK_DATA.groupLabel(u.group).includes(k)
      )
    );
    if (found.length === 0) return null;
    return { text: found.length === 1 ? `מצאתי חבר תואם:` : `מצאתי ${found.length} חברים תואמים:`, cards: found.map(u => this._personCard(u, isAdmin)) };
  },

  _getAllMembers(isAdmin) {
    const m = MOCK_DATA.getApprovedMembers();
    return { text: `👥 כל חברי המערך (${m.length} חברים):`, cards: m.map(u => this._personCard(u, isAdmin)) };
  },

  _getBirthdays() {
    const bdays = MOCK_DATA.getUpcomingBirthdays(30);
    if (bdays.length === 0) return { text: '🎂 אין ימי הולדת ב-30 הימים הקרובים.', cards: [] };
    return {
      text: `🎂 ימי הולדת קרובים (${bdays.length}):`,
      cards: bdays.map(u => ({ type:'birthday', name:u.name, avatar:u.avatar, color:MOCK_DATA.groupColor(u.group), date:MOCK_DATA.formatDate(u.birthday), daysUntil:u.daysUntil }))
    };
  },

  _getDocuments(q, user) {
    const isAdmin = user.role === 'admin';
    let docs = isAdmin ? MOCK_DATA.documents : MOCK_DATA.documents.filter(cat => cat.group === user.group || cat.group === 'All');
    const keywords = this._extractKeywords(q);
    const specific = [];
    docs.forEach(cat => {
      cat.items.forEach(item => {
        if (keywords.some(k => item.title.includes(k) || item.description.includes(k) || cat.category.includes(k)))
          specific.push({ ...item, category: cat.category });
      });
    });
    if (specific.length > 0) return { text: `📂 מצאתי ${specific.length} מסמכים תואמים:`, cards: specific.map(i => ({ type:'document', title:i.title, category:i.category, description:i.description, docType:i.type, url:i.url })) };
    return { text: `📂 קטגוריות מסמכים (${docs.length}):`, cards: docs.map(cat => ({ type:'doc-category', category:cat.category, icon:cat.icon, count:cat.items.length })) };
  },

  _getStats() {
    const approved = MOCK_DATA.getApprovedMembers().length;
    const pending = MOCK_DATA.getPendingUsers().length;
    const today = new Date();
    const upcoming = MOCK_DATA.events.filter(e => new Date(e.date) >= today).length;
    const groups = {};
    MOCK_DATA.getApprovedMembers().forEach(u => { groups[u.group] = (groups[u.group]||0)+1; });
    const breakdown = Object.entries(groups).map(([g,n]) => `${MOCK_DATA.groupLabel(g)}: ${n}`).join(' | ');
    return { text: `📊 **סטטיסטיקות המערך:**\n👥 חברים מאושרים: ${approved}\n⏳ ממתינים לאישור: ${pending}\n📅 אירועים קרובים: ${upcoming}\n\n**פילוח לפי קבוצה:**\n${breakdown}`, cards: [] };
  },

  _defaultResponse(isAdmin) {
    const s = ['מה האירועים במרץ?','מתי הגיבוש הקרוב?','פרטים על דוד לוי','מי יום הולדת השבוע?','טופס הרשמה'];
    if (isAdmin) s.push('כמה חברים יש במערך?');
    return { text: 'לא הצלחתי להבין את השאלה. נסה לשאול:', suggestions: s, cards: [] };
  },

  _eventCard(ev) {
    return { type:'event', id:ev.id, title:ev.title, date:MOCK_DATA.formatDate(ev.date), endDate:ev.date !== ev.endDate ? MOCK_DATA.formatDate(ev.endDate) : null, location:ev.location, description:ev.description, group:MOCK_DATA.groupLabel(ev.group), eventType:MOCK_DATA.typeLabel(ev.type), color:ev.color || MOCK_DATA.groupColor(ev.group) };
  },

  _personCard(u, isAdmin) {
    return { type:'person', name:u.name, avatar:u.avatar, color:MOCK_DATA.groupColor(u.group), profession:u.profession, group:MOCK_DATA.groupLabel(u.group), phone:u.phone, whatsapp:u.whatsapp, skills:u.skills, bio:u.bio, rank:isAdmin ? u.rank : null, birthday:u.birthday ? MOCK_DATA.formatDate(u.birthday) : null };
  }
};

// ══════════════════════════════════════════════════════════════
//  ממשק צ'אט
// ══════════════════════════════════════════════════════════════

function openAgentChat() {
  const modal = document.getElementById('agent-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  modal.classList.add('open');
  try { const m = document.getElementById('agent-messages'); if (m) m.innerHTML = ''; renderAgentWelcome(); } catch(e) {}
  setTimeout(() => { const i = document.getElementById('agent-input'); if (i) i.focus(); }, 300);
}

function closeAgentChat() {
  const modal = document.getElementById('agent-modal');
  if (modal) { modal.style.display = 'none'; modal.classList.remove('open'); }
}

function renderAgentWelcome() {
  const user = MOCK_DATA.currentUser;
  const isAdmin = user?.role === 'admin';
  const hasGemini = !!(typeof APP_CONFIG !== 'undefined' && APP_CONFIG.geminiApiKey);

  const suggestions = [
    '📅 מה האירועים במרץ?', '📅 מה האירועים באפריל?',
    '🏕️ מתי הגיבוש הקרוב?', '👤 פרטים על דוד לוי',
    '🎂 מי יום הולדת השבוע?', '📂 טופס הרשמה',
  ];
  if (isAdmin) suggestions.push('📊 כמה חברים יש?');

  const container = document.getElementById('agent-messages');
  if (!container) return;

  const firstName = user?.name?.split(' ')[0] || 'שלום';
  const modeTag = hasGemini
    ? `<span style="background:#C8F7C5;color:#1B5E20;padding:2px 8px;border-radius:20px;font-size:.68rem;font-weight:700;vertical-align:middle">✨ Gemini AI</span>`
    : `<span style="background:#E8DEF8;color:#4A0080;padding:2px 8px;border-radius:20px;font-size:.68rem;font-weight:700;vertical-align:middle">🤖 מצב חכם</span>`;

  container.innerHTML = `
    <div class="agent-msg agent-bot">
      <div class="agent-avatar">🤖</div>
      <div class="agent-bubble">
        שלום ${firstName}! אני הסוכן החכם של המערך 👋 ${modeTag}<br/>
        שאל אותי על <strong>אירועים</strong>, <strong>חברים</strong>, <strong>מסמכים</strong> ועוד.<br/>
        <strong>מה תרצה לדעת?</strong>
      </div>
    </div>
    <div class="agent-suggestions">
      ${suggestions.map(s => `<button class="agent-chip" onclick="sendAgentSuggestion('${s}')">${s}</button>`).join('')}
    </div>
  `;
}

function sendAgentSuggestion(text) {
  const input = document.getElementById('agent-input');
  if (input) { input.value = text; sendAgentMessage(); }
}

function sendAgentMessage() {
  const input = document.getElementById('agent-input');
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;
  input.value = '';

  const container = document.getElementById('agent-messages');
  if (!container) return;

  const sugg = container.querySelector('.agent-suggestions');
  if (sugg) sugg.remove();

  container.innerHTML += `<div class="agent-msg agent-user"><div class="agent-bubble agent-bubble-user">${escapeHtml(query)}</div></div>`;

  const loadId = 'agent-loading-' + Date.now();
  container.innerHTML += `<div class="agent-msg agent-bot" id="${loadId}"><div class="agent-avatar">🤖</div><div class="agent-bubble agent-typing"><span></span><span></span><span></span></div></div>`;
  container.scrollTop = container.scrollHeight;

  const hasGemini = !!(typeof APP_CONFIG !== 'undefined' && APP_CONFIG.geminiApiKey);

  if (hasGemini) {
    callGeminiAPI(query)
      .then(text => {
        const el = document.getElementById(loadId); if (el) el.remove();
        if (text) renderGeminiResponse(text, container);
        else { renderAgentResponse(AGENT.processQuery(query), container); }
        container.scrollTop = container.scrollHeight;
      })
      .catch(err => {
        const el = document.getElementById(loadId); if (el) el.remove();
        container.innerHTML += `<div class="agent-msg agent-bot"><div class="agent-avatar">🤖</div><div class="agent-bubble" style="border-right:3px solid var(--md-error)">⚠️ שגיאת Gemini: ${escapeHtml(err.message)}</div></div>`;
        renderAgentResponse(AGENT.processQuery(query), container);
        container.scrollTop = container.scrollHeight;
      });
  } else {
    setTimeout(() => {
      const el = document.getElementById(loadId); if (el) el.remove();
      renderAgentResponse(AGENT.processQuery(query), container);
      container.scrollTop = container.scrollHeight;
    }, 500);
  }
}

function renderGeminiResponse(text, container) {
  container.innerHTML += `
    <div class="agent-msg agent-bot">
      <div class="agent-avatar">🤖</div>
      <div class="agent-bubble">
        ${formatAgentText(text)}
        <div style="margin-top:6px;font-size:.65rem;color:var(--md-on-surface-variant);opacity:.7">✨ Gemini AI</div>
      </div>
    </div>`;
}

function renderAgentResponse(response, container) {
  let html = `<div class="agent-msg agent-bot"><div class="agent-avatar">🤖</div><div class="agent-bubble">${formatAgentText(response.text)}</div></div>`;
  if (response.cards && response.cards.length > 0) {
    html += `<div class="agent-cards">`;
    response.cards.forEach(c => { html += renderAgentCard(c); });
    html += `</div>`;
  }
  if (response.suggestions && response.suggestions.length > 0) {
    html += `<div class="agent-suggestions">${response.suggestions.map(s => `<button class="agent-chip" onclick="sendAgentSuggestion('${s}')">${s}</button>`).join('')}</div>`;
  }
  container.innerHTML += html;
}

function renderAgentCard(card) {
  if (card.type === 'event') {
    return `
      <div class="agent-card agent-card-event" style="border-color:${card.color}" onclick="showEventDetail(${card.id}); closeAgentChat();">
        <div class="agent-card-header" style="background:${card.color}15">
          <span class="agent-card-title">${card.title}</span>
          <span class="agent-card-badge" style="background:${card.color};color:#fff">${card.eventType}</span>
        </div>
        <div class="agent-card-body">
          <div class="agent-card-row">📅 ${card.date}${card.endDate ? ` – ${card.endDate}` : ''}</div>
          <div class="agent-card-row">📍 ${card.location}</div>
          <div class="agent-card-row" style="color:var(--md-on-surface-variant);font-size:.75rem">${card.description}</div>
        </div>
        <div class="agent-card-footer">
          <span style="font-size:.72rem;color:${card.color}">${card.group}</span>
          <span class="agent-card-action">לפרטים ›</span>
        </div>
      </div>`;
  }

  if (card.type === 'person') {
    const wa = card.whatsapp ? `<a href="https://wa.me/${card.whatsapp}" target="_blank" class="agent-wa-btn">💬 WhatsApp</a>` : '';
    const ph = card.phone ? `<button class="agent-phone-btn" onclick="callMember('${card.phone}')">📞 ${card.phone}</button>` : '';
    return `
      <div class="agent-card agent-card-person">
        <div class="agent-card-header" style="background:${card.color}15">
          <div class="agent-person-avatar" style="background:${card.color}">${card.avatar}</div>
          <div>
            <div class="agent-card-title">${card.name}</div>
            <div style="font-size:.75rem;color:var(--md-on-surface-variant)">${card.profession}</div>
            ${card.rank ? `<div style="font-size:.72rem;color:#6750A4;margin-top:2px">🎖️ ${card.rank}</div>` : ''}
          </div>
          <span class="agent-card-badge" style="background:${card.color};color:#fff">${card.group}</span>
        </div>
        <div class="agent-card-body">
          ${card.skills && card.skills.length ? `<div class="skill-tags" style="margin-bottom:8px">${card.skills.map(s=>`<span class="skill-tag">${s}</span>`).join('')}</div>` : ''}
          ${card.bio ? `<div style="font-size:.78rem;color:var(--md-on-surface);line-height:1.6;margin-bottom:8px">${card.bio}</div>` : ''}
          ${card.birthday ? `<div class="agent-card-row">🎂 ${card.birthday}</div>` : ''}
        </div>
        <div class="agent-card-footer" style="gap:8px;flex-wrap:wrap">${ph}${wa}</div>
      </div>`;
  }

  if (card.type === 'birthday') {
    const d = card.daysUntil === 0 ? '🎂 היום!' : `בעוד ${card.daysUntil} ימים`;
    return `
      <div class="agent-card agent-card-birthday">
        <div class="agent-person-avatar" style="background:${card.color};width:40px;height:40px">${card.avatar}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:.88rem">${card.name}</div>
          <div style="font-size:.75rem;color:var(--md-on-surface-variant)">${card.date}</div>
        </div>
        <span class="agent-days-badge">${d}</span>
      </div>`;
  }

  if (card.type === 'document') {
    const icon = { form:'📋', pdf:'📄', doc:'📝' }[card.docType] || '📄';
    return `
      <div class="agent-card agent-card-doc" onclick="showToast('${icon} פותח: ${card.title}')">
        <div style="font-size:1.3rem">${icon}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:.85rem">${card.title}</div>
          <div style="font-size:.72rem;color:var(--md-on-surface-variant)">${card.category} · ${card.description}</div>
        </div>
        <span class="agent-card-action">›</span>
      </div>`;
  }

  if (card.type === 'doc-category') {
    return `
      <div class="agent-card agent-card-doc" onclick="navigateTo('documents'); closeAgentChat();">
        <div style="font-size:1.3rem">${card.icon}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:.85rem">${card.category}</div>
          <div style="font-size:.72rem;color:var(--md-on-surface-variant)">${card.count} פריטים</div>
        </div>
        <span class="agent-card-action">›</span>
      </div>`;
  }
  return '';
}

// ── Utilities ──────────────────────────────────────────────────

function formatAgentText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function handleAgentKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAgentMessage(); }
}

function clearAgentChat() {
  const c = document.getElementById('agent-messages');
  if (c) c.innerHTML = '';
  renderAgentWelcome();
}