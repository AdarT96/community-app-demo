/* ============================================================
   מערך מילואים  –  סוכן חכם (AI Agent)
   ============================================================ */

const AGENT = {
  history: [],

  // ── עיבוד שאלה ────────────────────────────────────────────
  processQuery(query) {
    const user = MOCK_DATA.currentUser;
    if (!user) return { text: 'יש להתחבר תחילה כדי להשתמש בסוכן.', cards: [] };

    const q = query.trim().toLowerCase();
    const isAdmin = user.role === 'admin';

    // ── אירועים לפי חודש ────────────────────────────────────
    const monthMatch = this._matchMonth(q);
    if (monthMatch !== null || q.includes('אירוע') || q.includes('אירועים') || q.includes('לו"ז') || q.includes('לוז') || q.includes('לוח שנה') || q.includes('מתי')) {
      if (monthMatch !== null) {
        return this._getEventsByMonth(monthMatch, isAdmin);
      }
      // חיפוש אירוע ספציפי
      const eventResult = this._searchEvent(q, isAdmin);
      if (eventResult) return eventResult;
      // כל האירועים הקרובים
      return this._getUpcomingEvents(isAdmin);
    }

    // ── חיפוש אדם ────────────────────────────────────────────
    if (q.includes('פרטים') || q.includes('מי') || q.includes('מידע') || q.includes('איש') || q.includes('חבר') || q.includes('חברים')) {
      const personResult = this._searchPerson(q, isAdmin);
      if (personResult) return personResult;
      if (q.includes('חברים') || q.includes('כל החברים') || q.includes('רשימת חברים')) {
        return this._getAllMembers(isAdmin);
      }
    }

    // ── ימי הולדת ────────────────────────────────────────────
    if (q.includes('יום הולדת') || q.includes('ימי הולדת') || q.includes('בוקרים') || q.includes('הולדת')) {
      return this._getBirthdays();
    }

    // ── מסמכים ───────────────────────────────────────────────
    if (q.includes('מסמך') || q.includes('מסמכים') || q.includes('טופס') || q.includes('טפסים') || q.includes('הורדה') || q.includes('קישור')) {
      return this._getDocuments(q, user);
    }

    // ── סטטיסטיקות (מנהל) ────────────────────────────────────
    if (isAdmin && (q.includes('סטטיסטיקה') || q.includes('סטטיסטיקות') || q.includes('כמה חברים') || q.includes('כמה אירועים') || q.includes('ממתינים') || q.includes('כמה') || q.includes('סה"כ'))) {
      return this._getStats();
    }

    // ── גיבוש ספציפי ─────────────────────────────────────────
    if (q.includes('גיבוש')) {
      return this._searchEvent(q, isAdmin) || this._getEventsByKeyword('גיבוש', isAdmin);
    }

    // ── ניסיון חיפוש כללי ────────────────────────────────────
    const personResult = this._searchPerson(q, isAdmin);
    if (personResult) return personResult;
    const eventResult = this._searchEvent(q, isAdmin);
    if (eventResult) return eventResult;

    // ── ברירת מחדל ──────────────────────────────────────────
    return this._defaultResponse(isAdmin);
  },

  // ── חיפוש חודש ───────────────────────────────────────────
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

  // ── אירועים לפי חודש ─────────────────────────────────────
  _getEventsByMonth(monthNum, isAdmin) {
    const year = new Date().getFullYear();
    const prefix = `${year}-${String(monthNum).padStart(2, '0')}`;
    const monthNames = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

    const events = MOCK_DATA.events.filter(e => e.date.startsWith(prefix));

    if (events.length === 0) {
      return { text: `אין אירועים מתוכננים לחודש ${monthNames[monthNum]}.`, cards: [] };
    }

    return {
      text: `🗓️ אירועים בחודש **${monthNames[monthNum]}** (${events.length} אירועים):`,
      cards: events.map(e => this._eventCard(e))
    };
  },

  // ── חיפוש אירוע לפי מילות מפתח ──────────────────────────
  _searchEvent(q, isAdmin) {
    const keywords = q.split(/\s+/).filter(w => w.length > 2);
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
      text: found.length === 1
        ? `מצאתי אירוע תואם:`
        : `מצאתי ${found.length} אירועים תואמים:`,
      cards: found.map(e => this._eventCard(e))
    };
  },

  // ── אירועים לפי מילת מפתח ────────────────────────────────
  _getEventsByKeyword(keyword, isAdmin) {
    const found = MOCK_DATA.events.filter(e =>
      e.title.toLowerCase().includes(keyword) ||
      e.group.toLowerCase().includes(keyword) ||
      MOCK_DATA.groupLabel(e.group).includes(keyword)
    );
    if (found.length === 0) return { text: `לא נמצאו אירועים עם מילת המפתח "${keyword}".`, cards: [] };
    return {
      text: `מצאתי ${found.length} אירועים:`,
      cards: found.map(e => this._eventCard(e))
    };
  },

  // ── אירועים קרובים ───────────────────────────────────────
  _getUpcomingEvents(isAdmin) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const events = MOCK_DATA.events
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
    if (events.length === 0) return { text: 'אין אירועים קרובים.', cards: [] };
    return {
      text: `📅 5 האירועים הקרובים:`,
      cards: events.map(e => this._eventCard(e))
    };
  },

  // ── חיפוש אדם ────────────────────────────────────────────
  _searchPerson(q, isAdmin) {
    const approved = MOCK_DATA.users.filter(u => u.status === 'approved');
    const keywords = q.split(/\s+/).filter(w => w.length > 1);

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
      text: found.length === 1
        ? `מצאתי חבר תואם:`
        : `מצאתי ${found.length} חברים תואמים:`,
      cards: found.map(u => this._personCard(u, isAdmin))
    };
  },

  // ── כל החברים ────────────────────────────────────────────
  _getAllMembers(isAdmin) {
    const members = MOCK_DATA.getApprovedMembers();
    return {
      text: `👥 כל חברי המערך (${members.length} חברים):`,
      cards: members.map(u => this._personCard(u, isAdmin))
    };
  },

  // ── ימי הולדת ────────────────────────────────────────────
  _getBirthdays() {
    const bdays = MOCK_DATA.getUpcomingBirthdays(30);
    if (bdays.length === 0) {
      return { text: '🎂 אין ימי הולדת ב-30 הימים הקרובים.', cards: [] };
    }
    return {
      text: `🎂 ימי הולדת קרובים (${bdays.length}):`,
      cards: bdays.map(u => ({
        type: 'birthday',
        name: u.name,
        avatar: u.avatar,
        color: MOCK_DATA.groupColor(u.group),
        date: MOCK_DATA.formatDate(u.birthday),
        daysUntil: u.daysUntil
      }))
    };
  },

  // ── מסמכים ───────────────────────────────────────────────
  _getDocuments(q, user) {
    const isAdmin = user.role === 'admin';
    let docs = isAdmin
      ? MOCK_DATA.documents
      : MOCK_DATA.documents.filter(cat => cat.group === user.group || cat.group === 'All');

    // חיפוש מסמך ספציפי
    const keywords = q.split(/\s+/).filter(w => w.length > 2);
    const specificItems = [];
    docs.forEach(cat => {
      cat.items.forEach(item => {
        if (keywords.some(k =>
          item.title.includes(k) ||
          item.description.includes(k) ||
          cat.category.includes(k)
        )) {
          specificItems.push({ ...item, category: cat.category });
        }
      });
    });

    if (specificItems.length > 0) {
      return {
        text: `📂 מצאתי ${specificItems.length} מסמכים תואמים:`,
        cards: specificItems.map(item => ({
          type: 'document',
          title: item.title,
          category: item.category,
          description: item.description,
          docType: item.type,
          url: item.url
        }))
      };
    }

    // כל הקטגוריות
    return {
      text: `📂 קטגוריות מסמכים זמינות עבורך (${docs.length}):`,
      cards: docs.map(cat => ({
        type: 'doc-category',
        category: cat.category,
        icon: cat.icon,
        count: cat.items.length
      }))
    };
  },

  // ── סטטיסטיקות ───────────────────────────────────────────
  _getStats() {
    const approved = MOCK_DATA.getApprovedMembers().length;
    const pending = MOCK_DATA.getPendingUsers().length;
    const today = new Date();
    const upcoming = MOCK_DATA.events.filter(e => new Date(e.date) >= today).length;
    const groups = {};
    MOCK_DATA.getApprovedMembers().forEach(u => {
      groups[u.group] = (groups[u.group] || 0) + 1;
    });
    const groupBreakdown = Object.entries(groups)
      .map(([g, n]) => `${MOCK_DATA.groupLabel(g)}: ${n}`)
      .join(' | ');

    return {
      text: `📊 **סטטיסטיקות המערך:**\n👥 חברים מאושרים: ${approved}\n⏳ ממתינים לאישור: ${pending}\n📅 אירועים קרובים: ${upcoming}\n\n**פילוח לפי קבוצה:**\n${groupBreakdown}`,
      cards: []
    };
  },

  // ── ברירת מחדל ───────────────────────────────────────────
  _defaultResponse(isAdmin) {
    const suggestions = [
      'מה האירועים במרץ?',
      'מתי הגיבוש?',
      'תן לי פרטים על דוד לוי',
      'מי יום הולדת השבוע?',
      'איפה טופס הרשמה?',
    ];
    if (isAdmin) suggestions.push('כמה חברים יש במערך?');

    return {
      text: 'לא הצלחתי להבין את השאלה. אפשר לנסות לשאול:',
      suggestions: suggestions,
      cards: []
    };
  },

  // ── כרטיסי תוכן ──────────────────────────────────────────
  _eventCard(ev) {
    return {
      type: 'event',
      id: ev.id,
      title: ev.title,
      date: MOCK_DATA.formatDate(ev.date),
      endDate: ev.date !== ev.endDate ? MOCK_DATA.formatDate(ev.endDate) : null,
      location: ev.location,
      description: ev.description,
      group: MOCK_DATA.groupLabel(ev.group),
      eventType: MOCK_DATA.typeLabel(ev.type),
      color: ev.color || MOCK_DATA.groupColor(ev.group)
    };
  },

  _personCard(u, isAdmin) {
    return {
      type: 'person',
      name: u.name,
      avatar: u.avatar,
      color: MOCK_DATA.groupColor(u.group),
      profession: u.profession,
      group: MOCK_DATA.groupLabel(u.group),
      phone: u.phone,
      whatsapp: u.whatsapp,
      skills: u.skills,
      bio: u.bio,
      rank: isAdmin ? u.rank : null,
      birthday: u.birthday ? MOCK_DATA.formatDateShort(u.birthday) : null
    };
  }
};

// ══════════════════════════════════════════════════════════════
//  ממשק צ'אט
// ══════════════════════════════════════════════════════════════

function openAgentChat() {
  const modal = document.getElementById('agent-modal');
  if (modal) {
    modal.classList.add('open');
    // הצג שאלות ראשוניות אם הצ'אט ריק
    const messages = document.getElementById('agent-messages');
    if (messages && messages.children.length === 0) {
      renderAgentWelcome();
    }
    // פוקוס על שדה הקלט
    setTimeout(() => {
      const input = document.getElementById('agent-input');
      if (input) input.focus();
    }, 300);
  }
}

function closeAgentChat() {
  const modal = document.getElementById('agent-modal');
  if (modal) modal.classList.remove('open');
}

function renderAgentWelcome() {
  const user = MOCK_DATA.currentUser;
  const isAdmin = user?.role === 'admin';

  const suggestions = [
    '📅 מה האירועים במרץ?',
    '📅 מה האירועים באפריל?',
    '🏕️ מתי הגיבוש?',
    '👤 פרטים על דוד לוי',
    '🎂 מי יום הולדת השבוע?',
    '📂 איפה טופס הרשמה?',
  ];
  if (isAdmin) suggestions.push('📊 כמה חברים יש?');

  const container = document.getElementById('agent-messages');
  if (!container) return;

  const firstName = user?.name.split(' ')[0] || 'שלום';

  container.innerHTML = `
    <div class="agent-msg agent-bot">
      <div class="agent-avatar">🤖</div>
      <div class="agent-bubble">
        שלום ${firstName}! אני הסוכן החכם של המערך 👋<br/>
        אני יכול לענות על שאלות לגבי אירועים, חברים, מסמכים ועוד.<br/>
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
  if (input) {
    input.value = text;
    sendAgentMessage();
  }
}

function sendAgentMessage() {
  const input = document.getElementById('agent-input');
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;
  input.value = '';

  const container = document.getElementById('agent-messages');
  if (!container) return;

  // הסר suggestions
  const sugg = container.querySelector('.agent-suggestions');
  if (sugg) sugg.remove();

  // הוסף הודעת משתמש
  container.innerHTML += `
    <div class="agent-msg agent-user">
      <div class="agent-bubble agent-bubble-user">${escapeHtml(query)}</div>
    </div>
  `;

  // הוסף אנימציית טעינה
  const loadId = 'agent-loading-' + Date.now();
  container.innerHTML += `
    <div class="agent-msg agent-bot" id="${loadId}">
      <div class="agent-avatar">🤖</div>
      <div class="agent-bubble agent-typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;

  // עיבוד התשובה (עם השהיה קצרה לתחושת חשיבה)
  setTimeout(() => {
    const loading = document.getElementById(loadId);
    if (loading) loading.remove();

    const response = AGENT.processQuery(query);
    renderAgentResponse(response, container);
    container.scrollTop = container.scrollHeight;
  }, 600);
}

function renderAgentResponse(response, container) {
  let html = `<div class="agent-msg agent-bot">
    <div class="agent-avatar">🤖</div>
    <div class="agent-bubble">${formatAgentText(response.text)}</div>
  </div>`;

  // כרטיסים
  if (response.cards && response.cards.length > 0) {
    html += `<div class="agent-cards">`;
    response.cards.forEach(card => {
      html += renderAgentCard(card);
    });
    html += `</div>`;
  }

  // הצעות
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
    const waBtn = card.whatsapp
      ? `<a href="https://wa.me/${card.whatsapp}" target="_blank" class="agent-wa-btn">💬 WhatsApp</a>`
      : '';
    const phoneBtn = card.phone
      ? `<button class="agent-phone-btn" onclick="callMember('${card.phone}')">📞 ${card.phone}</button>`
      : '';
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
        <div class="agent-card-footer" style="gap:8px;flex-wrap:wrap">
          ${phoneBtn}
          ${waBtn}
        </div>
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

function formatAgentText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
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
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAgentMessage();
  }
}

function clearAgentChat() {
  const container = document.getElementById('agent-messages');
  if (container) container.innerHTML = '';
  renderAgentWelcome();
}