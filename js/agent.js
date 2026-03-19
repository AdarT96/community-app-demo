/* ============================================================
   מערך מילואים  –  סוכן חכם (Gemini AI Agent)
   ============================================================ */

// ── Gemini API ────────────────────────────────────────────────

function buildSystemPrompt() {
  const user = MOCK_DATA.currentUser;
  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const isAdmin = user?.role === 'admin';

  // Events
  const eventsText = MOCK_DATA.events.map(e =>
    `[${e.id}] ${e.title} | תאריך: ${e.date}${e.endDate && e.endDate !== e.date ? '–' + e.endDate : ''} | מיקום: ${e.location} | קבוצה: ${MOCK_DATA.groupLabel(e.group)} | סוג: ${MOCK_DATA.typeLabel(e.type)} | תיאור: ${e.description}`
  ).join('\n');

  // Members
  const members = MOCK_DATA.getApprovedMembers();
  const membersText = members.map(u =>
    `${u.name} | תפקיד: ${u.profession} | קבוצה: ${MOCK_DATA.groupLabel(u.group)} | טלפון: ${u.phone || 'לא זמין'} | מיומנויות: ${(u.skills || []).join(', ')}${u.bio ? ' | ביוגרפיה: ' + u.bio : ''}${isAdmin && u.rank ? ' | דרגה: ' + u.rank : ''}${u.birthday ? ' | יום הולדת: ' + u.birthday : ''}`
  ).join('\n');

  // Documents
  const docsText = MOCK_DATA.documents.map(cat =>
    `קטגוריה: ${cat.category} (${cat.icon}) – פריטים: ${cat.items.map(i => i.title).join(', ')}`
  ).join('\n');

  return `אתה סוכן חכם של אפליקציית "מערך מילואים" – מערכת ניהול קהילה לחיילי מילואים.
ענה תמיד בעברית, בצורה תמציתית וידידותית.
היום: ${today}
משתמש מחובר: ${user?.name || 'אורח'} (${isAdmin ? 'מנהל' : 'חבר'})

=== אירועים מתוכננים ===
${eventsText}

=== חברי המערך (${members.length} חברים) ===
${membersText}

=== מסמכים וטפסים ===
${docsText}

=== הנחיות תשובה ===
- ענה ישירות על השאלה בעברית
- לאירועים: ציין שם, תאריך מדויק, מיקום וסוג
- לאנשים: ציין שם, תפקיד, טלפון אם שאלו
- אם שואלים "מתי X" – תן תאריך ספציפי
- אם אין מידע רלוונטי – אמור זאת בכנות
- השתמש באמוג'י במידה (📅 לתאריכים, 📍 למיקומים, 👤 לאנשים)
- תשובה קצרה ומדויקת עדיפה על ארוכה`;
}

async function callGeminiAPI(query) {
  const apiKey = localStorage.getItem('community_gemini_key');
  if (!apiKey) return null;

  const systemPrompt = buildSystemPrompt();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: query }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 600 }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `שגיאה ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ── Keyword-based fallback agent ──────────────────────────────

const AGENT = {
  history: [],

  _stopWords: new Set([
    'מה','מי','איפה','מתי','כמה','איך','למה','האם','יש','אין',
    'של','על','עם','את','לי','לו','לה','לנו','לכם','לכן','להם',
    'הוא','היא','הם','הן','אני','אתה','את','אנחנו','אתם','אתן',
    'זה','זו','זאת','אלה','אלו','שם','פה','כאן','עכשיו','היום',
    'נשמע','קורה','חדש','חדשות','בסדר','טוב','יפה','נחמד',
    'תן','תני','תנו','רוצה','רוצים','תאריך','פרטים','מידע',
  ]),

  _isSmallTalk(q) {
    const greetings = [
      'שלום','היי','הי','מה נשמע','מה קורה','מה המצב','מה שלומך',
      'בוקר טוב','ערב טוב','לילה טוב','תודה','תודה רבה','מעולה',
      'כל הכבוד','אוקיי','אוקי','ok','hello','hi','hey',
      'מה אתה יכול','מה אתה','מה את','עזור','עזרה','help',
    ];
    return greetings.some(g => q.includes(g));
  },

  // Strip common Hebrew prefixes: ה, ב, ל, מ, כ, ו, ש
  _extractKeywords(q) {
    const prefixes = ['ה', 'ב', 'ל', 'מ', 'כ', 'ו', 'ש'];
    const stop = this._stopWords;
    const words = q.split(/\s+/).filter(w => w.length > 1);
    const result = new Set();
    words.forEach(w => {
      if (!stop.has(w) && w.length > 1) result.add(w);
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

  processQuery(query) {
    const user = MOCK_DATA.currentUser;
    if (!user) return { text: 'יש להתחבר תחילה כדי להשתמש בסוכן.', cards: [] };

    const q = query.trim().toLowerCase();
    const isAdmin = user.role === 'admin';

    if (this._isSmallTalk(q)) return this._defaultResponse(isAdmin);

    // Month events
    const monthMatch = this._matchMonth(q);
    if (monthMatch !== null) return this._getEventsByMonth(monthMatch, isAdmin);

    // Gibbush / specific event keywords (check BEFORE generic 'מתי')
    if (q.includes('גיבוש') || this._extractKeywords(q).includes('גיבוש')) {
      return this._searchEvent(q, isAdmin) || this._getEventsByKeyword('גיבוש', isAdmin);
    }

    // Event-related queries
    if (q.includes('אירוע') || q.includes('אירועים') || q.includes('לוז') || q.includes('לוח שנה') || q.includes('מתי') || q.includes('מועד')) {
      const eventResult = this._searchEvent(q, isAdmin);
      if (eventResult) return eventResult;
      return this._getUpcomingEvents(isAdmin);
    }

    // Person queries
    if (q.includes('פרטים') || q.includes('מי') || q.includes('מידע') || q.includes('איש') || q.includes('חבר') || q.includes('חברים') || q.includes('על')) {
      const personResult = this._searchPerson(q, isAdmin);
      if (personResult) return personResult;
      if (q.includes('חברים') || q.includes('כל החברים') || q.includes('רשימת חברים'))
        return this._getAllMembers(isAdmin);
    }

    // Birthdays
    if (q.includes('יום הולדת') || q.includes('ימי הולדת') || q.includes('הולדת')) {
      return this._getBirthdays();
    }

    // Documents
    if (q.includes('מסמך') || q.includes('מסמכים') || q.includes('טופס') || q.includes('טפסים') || q.includes('הורדה') || q.includes('קישור')) {
      return this._getDocuments(q, user);
    }

    // Stats (admin)
    if (isAdmin && (q.includes('סטטיסטיקה') || q.includes('כמה חברים') || q.includes('כמה אירועים') || q.includes('ממתינים') || q.includes('כמה') || q.includes('סה"כ'))) {
      return this._getStats();
    }

    // General search
    const personResult = this._searchPerson(q, isAdmin);
    if (personResult) return personResult;
    const eventResult = this._searchEvent(q, isAdmin);
    if (eventResult) return eventResult;

    return this._defaultResponse(isAdmin);
  },

  _matchMonth(q) {
    const months = {
      'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'מרס': 3, 'אפריל': 4,
      'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
      'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12
    };
    for (const [name, num] of Object.entries(months)) {
      if (q.includes(name)) return num;
    }
    return null;
  },

  _getEventsByMonth(monthNum, isAdmin) {
    const year = new Date().getFullYear();
    const prefix = `${year}-${String(monthNum).padStart(2, '0')}`;
    const monthNames = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    const events = MOCK_DATA.events.filter(e => e.date.startsWith(prefix));
    if (events.length === 0) return { text: `אין אירועים מתוכננים לחודש ${monthNames[monthNum]}.`, cards: [] };
    return {
      text: `🗓️ אירועים בחודש **${monthNames[monthNum]}** (${events.length} אירועים):`,
      cards: events.map(e => this._eventCard(e))
    };
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
    return {
      text: found.length === 1 ? `מצאתי אירוע תואם:` : `מצאתי ${found.length} אירועים תואמים:`,
      cards: found.map(e => this._eventCard(e))
    };
  },

  _getEventsByKeyword(keyword, isAdmin) {
    const found = MOCK_DATA.events.filter(e =>
      e.title.toLowerCase().includes(keyword) ||
      e.group.toLowerCase().includes(keyword) ||
      MOCK_DATA.groupLabel(e.group).includes(keyword)
    );
    if (found.length === 0) return { text: `לא נמצאו אירועים עם מילת המפתח "${keyword}".`, cards: [] };
    return { text: `מצאתי ${found.length} אירועים:`, cards: found.map(e => this._eventCard(e)) };
  },

  _getUpcomingEvents(isAdmin) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const events = MOCK_DATA.events
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
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
    return {
      text: found.length === 1 ? `מצאתי חבר תואם:` : `מצאתי ${found.length} חברים תואמים:`,
      cards: found.map(u => this._personCard(u, isAdmin))
    };
  },

  _getAllMembers(isAdmin) {
    const members = MOCK_DATA.getApprovedMembers();
    return { text: `👥 כל חברי המערך (${members.length} חברים):`, cards: members.map(u => this._personCard(u, isAdmin)) };
  },

  _getBirthdays() {
    const bdays = MOCK_DATA.getUpcomingBirthdays(30);
    if (bdays.length === 0) return { text: '🎂 אין ימי הולדת ב-30 הימים הקרובים.', cards: [] };
    return {
      text: `🎂 ימי הולדת קרובים (${bdays.length}):`,
      cards: bdays.map(u => ({
        type: 'birthday',
        name: u.name, avatar: u.avatar,
        color: MOCK_DATA.groupColor(u.group),
        date: MOCK_DATA.formatDate(u.birthday),
        daysUntil: u.daysUntil
      }))
    };
  },

  _getDocuments(q, user) {
    const isAdmin = user.role === 'admin';
    let docs = isAdmin ? MOCK_DATA.documents : MOCK_DATA.documents.filter(cat => cat.group === user.group || cat.group === 'All');
    const keywords = this._extractKeywords(q);
    const specificItems = [];
    docs.forEach(cat => {
      cat.items.forEach(item => {
        if (keywords.some(k => item.title.includes(k) || item.description.includes(k) || cat.category.includes(k))) {
          specificItems.push({ ...item, category: cat.category });
        }
      });
    });
    if (specificItems.length > 0) {
      return {
        text: `📂 מצאתי ${specificItems.length} מסמכים תואמים:`,
        cards: specificItems.map(item => ({ type: 'document', title: item.title, category: item.category, description: item.description, docType: item.type, url: item.url }))
      };
    }
    return {
      text: `📂 קטגוריות מסמכים זמינות עבורך (${docs.length}):`,
      cards: docs.map(cat => ({ type: 'doc-category', category: cat.category, icon: cat.icon, count: cat.items.length }))
    };
  },

  _getStats() {
    const approved = MOCK_DATA.getApprovedMembers().length;
    const pending = MOCK_DATA.getPendingUsers().length;
    const today = new Date();
    const upcoming = MOCK_DATA.events.filter(e => new Date(e.date) >= today).length;
    const groups = {};
    MOCK_DATA.getApprovedMembers().forEach(u => { groups[u.group] = (groups[u.group] || 0) + 1; });
    const groupBreakdown = Object.entries(groups).map(([g, n]) => `${MOCK_DATA.groupLabel(g)}: ${n}`).join(' | ');
    return {
      text: `📊 **סטטיסטיקות המערך:**\n👥 חברים מאושרים: ${approved}\n⏳ ממתינים לאישור: ${pending}\n📅 אירועים קרובים: ${upcoming}\n\n**פילוח לפי קבוצה:**\n${groupBreakdown}`,
      cards: []
    };
  },

  _defaultResponse(isAdmin) {
    const suggestions = ['מה האירועים במרץ?', 'מתי הגיבוש?', 'תן לי פרטים על דוד לוי', 'מי יום הולדת השבוע?', 'איפה טופס הרשמה?'];
    if (isAdmin) suggestions.push('כמה חברים יש במערך?');
    return { text: 'לא הצלחתי להבין את השאלה. אפשר לנסות לשאול:', suggestions, cards: [] };
  },

  _eventCard(ev) {
    return {
      type: 'event', id: ev.id, title: ev.title,
      date: MOCK_DATA.formatDate(ev.date),
      endDate: ev.date !== ev.endDate ? MOCK_DATA.formatDate(ev.endDate) : null,
      location: ev.location, description: ev.description,
      group: MOCK_DATA.groupLabel(ev.group),
      eventType: MOCK_DATA.typeLabel(ev.type),
      color: ev.color || MOCK_DATA.groupColor(ev.group)
    };
  },

  _personCard(u, isAdmin) {
    return {
      type: 'person', name: u.name, avatar: u.avatar,
      color: MOCK_DATA.groupColor(u.group), profession: u.profession,
      group: MOCK_DATA.groupLabel(u.group),
      phone: u.phone, whatsapp: u.whatsapp,
      skills: u.skills, bio: u.bio,
      rank: isAdmin ? u.rank : null,
      birthday: u.birthday ? MOCK_DATA.formatDate(u.birthday) : null
    };
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
  try {
    const messages = document.getElementById('agent-messages');
    if (messages) messages.innerHTML = '';
    renderAgentWelcome();
  } catch (e) {
    console.error('Agent welcome error:', e);
  }
  setTimeout(() => {
    const input = document.getElementById('agent-input');
    if (input) input.focus();
  }, 300);
}

function closeAgentChat() {
  const modal = document.getElementById('agent-modal');
  if (modal) { modal.style.display = 'none'; modal.classList.remove('open'); }
}

function renderAgentWelcome() {
  const user = MOCK_DATA.currentUser;
  const isAdmin = user?.role === 'admin';
  const hasKey = !!localStorage.getItem('community_gemini_key');

  const suggestions = [
    '📅 מה האירועים במרץ?', '📅 מה האירועים באפריל?',
    '🏕️ מתי הגיבוש?', '👤 פרטים על דוד לוי',
    '🎂 מי יום הולדת השבוע?', '📂 איפה טופס הרשמה?',
  ];
  if (isAdmin) suggestions.push('📊 כמה חברים יש?');

  const container = document.getElementById('agent-messages');
  if (!container) return;

  const firstName = user?.name?.split(' ')[0] || 'שלום';
  const modeLabel = hasKey
    ? `<span style="background:#C8F7C5;color:#1B5E20;padding:2px 8px;border-radius:20px;font-size:.7rem;font-weight:700">✨ Gemini AI</span>`
    : `<span style="background:#FFF3CD;color:#856404;padding:2px 8px;border-radius:20px;font-size:.7rem;font-weight:700">⚙️ מצב בסיסי</span>`;

  container.innerHTML = `
    <div class="agent-msg agent-bot">
      <div class="agent-avatar">🤖</div>
      <div class="agent-bubble">
        שלום ${firstName}! אני הסוכן החכם של המערך 👋 ${modeLabel}<br/>
        ${hasKey ? 'מופעל עם <strong>Gemini AI</strong> – שאל אותי כל דבר!' : 'שאל אותי על אירועים, חברים, מסמכים ועוד.<br/><small style="color:var(--md-on-surface-variant)">💡 חבר Gemini API להחכמת הסוכן →</small>'}<br/>
        <strong>מה תרצה לדעת?</strong>
      </div>
    </div>
    <div class="agent-suggestions">
      ${suggestions.map(s => `<button class="agent-chip" onclick="sendAgentSuggestion('${s}')">${s}</button>`).join('')}
      ${!hasKey ? `<button class="agent-chip" style="background:#EADDFF;color:#4A0080" onclick="showApiKeyDialog()">🔑 חבר Gemini AI</button>` : ''}
    </div>
  `;
}

// ── API Key Dialog ─────────────────────────────────────────────

function showApiKeyDialog() {
  const existing = localStorage.getItem('community_gemini_key') || '';
  const container = document.getElementById('agent-messages');
  if (!container) return;

  // Remove existing dialog if any
  const oldDialog = document.getElementById('api-key-dialog');
  if (oldDialog) oldDialog.remove();

  container.innerHTML += `
    <div id="api-key-dialog" style="margin:8px 0;background:var(--md-surface);border-radius:16px;padding:16px;border:2px solid #EADDFF">
      <div style="font-weight:700;font-size:.9rem;color:var(--md-primary);margin-bottom:8px">🔑 חיבור Gemini API</div>
      <div style="font-size:.78rem;color:var(--md-on-surface-variant);margin-bottom:12px;line-height:1.6">
        קבל מפתח API חינמי מ-<a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--md-primary)">Google AI Studio</a>.<br/>
        המפתח נשמר רק במכשיר שלך (localStorage).
      </div>
      <input type="text" id="api-key-input" placeholder="AIzaSy..." 
        style="width:100%;padding:10px 14px;border:1.5px solid var(--md-outline-variant);border-radius:8px;font-size:.85rem;font-family:monospace;outline:none;margin-bottom:10px"
        value="${existing}" />
      <div style="display:flex;gap:8px">
        <button onclick="saveApiKey()" style="flex:1;background:var(--md-primary);color:#fff;padding:10px;border-radius:24px;border:none;font-size:.85rem;cursor:pointer;font-family:inherit">שמור ✓</button>
        ${existing ? `<button onclick="removeApiKey()" style="background:#FFEBEE;color:#C62828;padding:10px 14px;border-radius:24px;border:none;font-size:.85rem;cursor:pointer;font-family:inherit">הסר</button>` : ''}
        <button onclick="document.getElementById('api-key-dialog').remove()" style="background:var(--md-surface-variant);padding:10px 14px;border-radius:24px;border:none;font-size:.85rem;cursor:pointer;font-family:inherit">ביטול</button>
      </div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;
}

function saveApiKey() {
  const input = document.getElementById('api-key-input');
  if (!input) return;
  const key = input.value.trim();
  if (!key) { showToast('אנא הכנס מפתח API'); return; }
  if (!key.startsWith('AIza')) { showToast('מפתח לא תקין (צריך להתחיל ב-AIza...)'); return; }
  localStorage.setItem('community_gemini_key', key);
  showToast('✅ מפתח Gemini נשמר!');
  // Reset chat to show new mode
  const messages = document.getElementById('agent-messages');
  if (messages) messages.innerHTML = '';
  renderAgentWelcome();
}

function removeApiKey() {
  localStorage.removeItem('community_gemini_key');
  showToast('🗑️ מפתח Gemini הוסר');
  const messages = document.getElementById('agent-messages');
  if (messages) messages.innerHTML = '';
  renderAgentWelcome();
}

// ── Message Sending ───────────────────────────────────────────

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

  container.innerHTML += `
    <div class="agent-msg agent-user">
      <div class="agent-bubble agent-bubble-user">${escapeHtml(query)}</div>
    </div>
  `;

  const loadId = 'agent-loading-' + Date.now();
  container.innerHTML += `
    <div class="agent-msg agent-bot" id="${loadId}">
      <div class="agent-avatar">🤖</div>
      <div class="agent-bubble agent-typing"><span></span><span></span><span></span></div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;

  const hasApiKey = !!localStorage.getItem('community_gemini_key');

  if (hasApiKey) {
    // Use Gemini AI
    callGeminiAPI(query)
      .then(text => {
        const loading = document.getElementById(loadId);
        if (loading) loading.remove();
        if (text) {
          renderGeminiResponse(text, container);
        } else {
          // Fallback to keyword agent
          const response = AGENT.processQuery(query);
          renderAgentResponse(response, container);
        }
        container.scrollTop = container.scrollHeight;
      })
      .catch(err => {
        const loading = document.getElementById(loadId);
        if (loading) loading.remove();
        container.innerHTML += `
          <div class="agent-msg agent-bot">
            <div class="agent-avatar">🤖</div>
            <div class="agent-bubble" style="border-right:3px solid var(--md-error)">
              ⚠️ שגיאה ב-Gemini: ${escapeHtml(err.message)}<br/>
              <small style="color:var(--md-on-surface-variant)">עובר למצב בסיסי…</small>
            </div>
          </div>`;
        // Fallback to keyword agent
        const response = AGENT.processQuery(query);
        renderAgentResponse(response, container);
        container.scrollTop = container.scrollHeight;
      });
  } else {
    // Keyword-based agent
    setTimeout(() => {
      const loading = document.getElementById(loadId);
      if (loading) loading.remove();
      const response = AGENT.processQuery(query);
      renderAgentResponse(response, container);
      container.scrollTop = container.scrollHeight;
    }, 600);
  }
}

function renderGeminiResponse(text, container) {
  // Format the Gemini text response nicely
  const formatted = formatAgentText(text);
  container.innerHTML += `
    <div class="agent-msg agent-bot">
      <div class="agent-avatar">🤖</div>
      <div class="agent-bubble" style="position:relative">
        ${formatted}
        <div style="margin-top:8px;font-size:.65rem;color:var(--md-on-surface-variant);opacity:0.7">✨ Gemini AI</div>
      </div>
    </div>`;
}

function renderAgentResponse(response, container) {
  let html = `<div class="agent-msg agent-bot">
    <div class="agent-avatar">🤖</div>
    <div class="agent-bubble">${formatAgentText(response.text)}</div>
  </div>`;

  if (response.cards && response.cards.length > 0) {
    html += `<div class="agent-cards">`;
    response.cards.forEach(card => { html += renderAgentCard(card); });
    html += `</div>`;
  }

  if (response.suggestions && response.suggestions.length > 0) {
    html += `<div class="agent-suggestions">
      ${response.suggestions.map(s => `<button class="agent-chip" onclick="sendAgentSuggestion('${s}')">${s}</button>`).join('')}
    </div>`;
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
    const waBtn = card.whatsapp ? `<a href="https://wa.me/${card.whatsapp}" target="_blank" class="agent-wa-btn">💬 WhatsApp</a>` : '';
    const phoneBtn = card.phone ? `<button class="agent-phone-btn" onclick="callMember('${card.phone}')">📞 ${card.phone}</button>` : '';
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
          ${card.skills && card.skills.length > 0 ? `<div class="skill-tags" style="margin-bottom:8px">${card.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}</div>` : ''}
          ${card.bio ? `<div style="font-size:.78rem;color:var(--md-on-surface);line-height:1.6;margin-bottom:8px">${card.bio}</div>` : ''}
          ${card.birthday ? `<div class="agent-card-row">🎂 ${card.birthday}</div>` : ''}
        </div>
        <div class="agent-card-footer" style="gap:8px;flex-wrap:wrap">${phoneBtn}${waBtn}</div>
      </div>`;
  }

  if (card.type === 'birthday') {
    const daysText = card.daysUntil === 0 ? '🎂 היום!' : `בעוד ${card.daysUntil} ימים`;
    return `
      <div class="agent-card agent-card-birthday">
        <div class="agent-person-avatar" style="background:${card.color};width:40px;height:40px">${card.avatar}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:.88rem">${card.name}</div>
          <div style="font-size:.75rem;color:var(--md-on-surface-variant)">${card.date}</div>
        </div>
        <span class="agent-days-badge">${daysText}</span>
      </div>`;
  }

  if (card.type === 'document') {
    const typeIcon = { form: '📋', pdf: '📄', doc: '📝' }[card.docType] || '📄';
    return `
      <div class="agent-card agent-card-doc" onclick="showToast('${typeIcon} פותח: ${card.title}')">
        <div style="font-size:1.3rem">${typeIcon}</div>
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

// ── Utilities ─────────────────────────────────────────────────

function formatAgentText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function handleAgentKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAgentMessage(); }
}

function clearAgentChat() {
  const container = document.getElementById('agent-messages');
  if (container) container.innerHTML = '';
  renderAgentWelcome();
}