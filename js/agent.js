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

function isGeminiEnabled() {
  if (typeof APP_CONFIG === 'undefined') return false;
  if (APP_CONFIG.useGeminiProxy) return true;
  return !!(APP_CONFIG.allowDirectGemini && APP_CONFIG.geminiApiKey);
}

async function callGeminiAPI(query) {
  if (!isGeminiEnabled()) return null;

  const model = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.geminiModel) || 'gemini-2.0-flash';
  const systemPrompt = buildSystemPrompt();

  // ברירת מחדל: עבודה דרך backend proxy (מאובטח)
  if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.useGeminiProxy) {
    const proxyUrl = APP_CONFIG.geminiProxyUrl || '/api/gemini';
    const resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, systemPrompt, model })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error || err?.message || `Proxy error ${resp.status}`);
    }
    const data = await resp.json();
    return data?.text || null;
  }

  // מצב fallback לפיתוח בלבד (לא מומלץ בפרודקשן)
  const key = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.geminiApiKey) || '';
  if (!(typeof APP_CONFIG !== 'undefined' && APP_CONFIG.allowDirectGemini && key)) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
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

  _lastContext: null,

  _stopWords: new Set([
    'מה','מי','איפה','מתי','כמה','איך','למה','האם','יש','אין',
    'של','על','עם','את','לי','לו','לה','לנו','לכם','לכן','להם',
    'הוא','היא','הם','הן','אני','אתה','את','אנחנו','אתם','אתן',
    'זה','זו','זאת','אלה','אלו','שם','פה','כאן','עכשיו','היום',
    'נשמע','קורה','חדש','חדשות','בסדר','טוב','יפה','נחמד',
    'תן','תני','תנו','תתן','רוצה','רוצים','תאריך','פרטים','מידע',
    'כל','הכל','שיש','לך','לי',
    'הבא','הקרוב','הבאה','הקרובה','הבאים','הקרובים',
  ]),

  _nameTokens(name) {
    return String(name || '')
      .toLowerCase()
      .split(/[\s\-־]+/)
      .filter(Boolean);
  },

  _setContext(ctx) {
    this._lastContext = { ...ctx, _ts: Date.now() };
  },

  _getContext() {
    if (!this._lastContext) return null;
    const maxAgeMs = 5 * 60 * 1000;
    if (Date.now() - this._lastContext._ts > maxAgeMs) {
      this._lastContext = null;
      return null;
    }
    return this._lastContext;
  },

  _handleFollowUpPeopleQuery(q, isAdmin) {
    const ctx = this._getContext();
    if (!ctx) return null;

    const isFollowUp = (
      q === 'מי זה' || q === 'מי זה?' ||
      q === 'מי הם' || q === 'מי הם?' ||
      q === 'מי אלו' || q === 'מי אלו?' ||
      q.includes('מי זה') || q.includes('מי הם') || q.includes('מי אלו') ||
      q.includes('תראה אותם') || q.includes('מי האנשים')
    );

    if (!isFollowUp) return null;
    if (!Array.isArray(ctx.members)) return null;

    const members = ctx.members;
    if (members.length === 0) {
      return { text: 'אין חברים להצגה עבור השאלה הקודמת.', cards: [] };
    }

    if (members.length === 1) {
      return {
        text: `זה החבר שנמצא:`,
        cards: [this._personCard(members[0], isAdmin)]
      };
    }

    return {
      text: `אלה החברים שנמצאו (${members.length}):`,
      cards: members.slice(0, 8).map(u => this._personCard(u, isAdmin))
    };
  },

  _isAllGroupsQuery(q) {
    return (
      q.includes('בכל הקבוצות') ||
      q.includes('בכל קבוצה') ||
      q.includes('כל הקבוצות') ||
      q.includes('קובוצ') // טיפול בטייפו נפוץ: "קובוצות"
    );
  },

  _isMyGroupQuery(q) {
    return q.includes('בקבוצה שלי') || q.includes('אצלי בקבוצה');
  },

  _statusWord(count) {
    return count === 1 ? 'מאושר' : 'מאושרים';
  },

  _handleCountScopeFollowUp(q) {
    const ctx = this._getContext();
    if (!ctx) return null;

    const asksScope = this._isAllGroupsQuery(q) || this._isMyGroupQuery(q) || !!this._matchGroupFromQuery(q);
    if (!asksScope) return null;

    let targetGroup = null;
    if (this._isAllGroupsQuery(q)) {
      targetGroup = 'All';
    } else if (this._isMyGroupQuery(q)) {
      targetGroup = MOCK_DATA.currentUser?.group || 'All';
    } else {
      targetGroup = this._matchGroupFromQuery(q) || 'All';
    }

    if (ctx.type === 'memberCount') {
      const members = MOCK_DATA.getApprovedMembers(targetGroup === 'All' ? 'All' : targetGroup);
      const memberWord = members.length === 1 ? 'חבר' : 'חברים';
      const text = targetGroup === 'All'
        ? `בכל הקבוצות יש ${members.length} ${memberWord} ${this._statusWord(members.length)}.`
        : `בקבוצת ${MOCK_DATA.groupLabel(targetGroup)} יש ${members.length} ${memberWord} ${this._statusWord(members.length)}.`;
      this._setContext({ type: 'memberCount', members, group: targetGroup });
      return { text, cards: [] };
    }

    if (ctx.type === 'professionCount' && Array.isArray(ctx.professionTerms)) {
      const members = MOCK_DATA.getApprovedMembers(targetGroup === 'All' ? 'All' : targetGroup);
      const matchedMembers = members.filter(u =>
        ctx.professionTerms.some(t => String(u.profession || '').toLowerCase().includes(t))
      );
      const count = matchedMembers.length;
      const professionWord = count === 1 ? ctx.professionSingular : ctx.professionPlural;
      const text = targetGroup === 'All'
        ? `בכל הקבוצות יש ${count} ${professionWord} ${this._statusWord(count)}.`
        : `בקבוצת ${MOCK_DATA.groupLabel(targetGroup)} יש ${count} ${professionWord} ${this._statusWord(count)}.`;
      this._setContext({
        type: 'professionCount',
        members: matchedMembers,
        group: targetGroup,
        profession: professionWord,
        professionTerms: ctx.professionTerms,
        professionSingular: ctx.professionSingular,
        professionPlural: ctx.professionPlural,
      });
      return { text, cards: [] };
    }

    return null;
  },

  _matchGroupFromQuery(q) {
    const groupMap = [
      { value: 'Operative', terms: ['אופרטיבי', 'אופרטיביים'] },
      { value: 'Gadna', terms: ['גדנע', 'גדנ"ע', 'גדנעות', 'גדנא'] },
      { value: 'Gibbush', terms: ['גיבוש', 'גיבושים'] },
      { value: 'Training', terms: ['הכשרה', 'הכשרות', 'אימון', 'אימונים'] },
      { value: 'Social', terms: ['חברתי', 'חברתיים'] },
      { value: 'All', terms: ['הכל', 'כללי', 'כל החברים'] },
    ];

    for (const g of groupMap) {
      if (g.terms.some(t => q.includes(t))) return g.value;
    }
    return null;
  },

  _countMembersAnswer(q) {
    const isCountQuery = q.includes('כמה') || q.includes('מספר') || q.includes('כמות');
    if (!isCountQuery || !q.includes('חבר')) return null;

    const group = this._matchGroupFromQuery(q);
    const members = MOCK_DATA.getApprovedMembers(group || 'All');
    const groupLabel = group ? MOCK_DATA.groupLabel(group) : 'במערך';
    const memberWord = members.length === 1 ? 'חבר' : 'חברים';
    const statusWord = this._statusWord(members.length);

    return {
      text: group
        ? `יש ${members.length} ${memberWord} ${statusWord} בקבוצת ${groupLabel}.`
        : `יש ${members.length} ${memberWord} ${statusWord} ${groupLabel}.`,
      cards: [],
      context: { type: 'memberCount', members, group }
    };
  },

  _countProfessionAnswer(q) {
    const isCountQuery = q.includes('כמה') || q.includes('מספר') || q.includes('כמות');
    if (!isCountQuery) return null;

    const professionMap = [
      { singular: 'מהנדס', plural: 'מהנדסים', terms: ['מהנדס', 'מהנדסים', 'הנדסה'] },
      { singular: 'פסיכולוג', plural: 'פסיכולוגים', terms: ['פסיכולוג', 'פסיכולוגית', 'פסיכולוגים', 'פסיכולוגיות'] },
      { singular: 'מאמן', plural: 'מאמנים', terms: ['מאמן', 'מאמנת', 'מאמנים', 'מאמנות'] },
      { singular: 'פרמדיק', plural: 'פרמדיקים', terms: ['פרמדיק', 'פרמדיקים'] },
      { singular: 'מדריך', plural: 'מדריכים', terms: ['מדריך', 'מדריכה', 'מדריכים', 'מדריכות'] },
      { singular: 'מנהל פרויקטים', plural: 'מנהלי פרויקטים', terms: ['מנהל פרויקטים', 'מנהלת פרויקטים', 'פרויקטים'] },
      { singular: 'מעצב', plural: 'מעצבים', terms: ['מעצב', 'מעצבת', 'מעצבים', 'מעצבות', 'ux', 'ui'] },
    ];

    const matched = professionMap.find(p => p.terms.some(t => q.includes(t)));
    if (!matched) return null;

    let group = this._matchGroupFromQuery(q);
    if (!group && (q.includes('בקבוצה') || q.includes('בקבוצה שלי'))) {
      const currentGroup = MOCK_DATA.currentUser?.group;
      if (currentGroup && currentGroup !== 'All') group = currentGroup;
    }

    const members = MOCK_DATA.getApprovedMembers(group || 'All');
    const count = members.filter(u =>
      matched.terms.some(t => String(u.profession || '').toLowerCase().includes(t))
    ).length;
    const matchedMembers = members.filter(u =>
      matched.terms.some(t => String(u.profession || '').toLowerCase().includes(t))
    );

    const groupText = group ? ` בקבוצת ${MOCK_DATA.groupLabel(group)}` : '';
    const professionWord = count === 1 ? matched.singular : matched.plural;
    const statusWord = this._statusWord(count);
    return {
      text: `יש ${count} ${professionWord} ${statusWord}${groupText}.`,
      cards: [],
      context: {
        type: 'professionCount',
        members: matchedMembers,
        group,
        profession: professionWord,
        professionTerms: matched.terms,
        professionSingular: matched.singular,
        professionPlural: matched.plural,
      }
    };
  },

  _looksLikePersonQuery(q, keywords) {
    const personIndicators = ['פרטים', 'מידע', 'מי', 'טלפון', 'וואטסאפ', 'חבר', 'איש', 'על'];
    if (personIndicators.some(t => q.includes(t))) return true;

    // חיפוש כללי: רק אם מילות החיפוש דומות לשמות אמיתיים (ומעל 2 תווים)
    const allNameTokens = new Set(
      MOCK_DATA.users
        .filter(u => u.status === 'approved')
        .flatMap(u => this._nameTokens(u.name))
    );

    return keywords.some(k => k.length >= 3 && [...allNameTokens].some(t => t.startsWith(k) || k.startsWith(t)));
  },

  _looksLikeEventQuery(q, keywords) {
    const eventIndicators = ['אירוע', 'אירועים', 'לוז', 'לו"ז', 'לוח שנה', 'מועד', 'תאריך', 'מתי', 'גיבוש', 'סדנה', 'טקס', 'ישיבה', 'אימון', 'תרגיל'];
    if (eventIndicators.some(t => q.includes(t))) return true;

    // בחיפוש כללי: רק אם יש דמיון אמיתי לכותרות/סוגי אירועים
    const eventTokens = new Set(
      MOCK_DATA.events.flatMap(e => [
        ...String(e.title || '').toLowerCase().split(/[\s\-־]+/),
        ...String(e.location || '').toLowerCase().split(/[\s\-־]+/),
        ...String(MOCK_DATA.typeLabel(e.type) || '').toLowerCase().split(/[\s\-־]+/)
      ]).filter(Boolean)
    );

    return keywords.some(k => k.length >= 3 && [...eventTokens].some(t => t.startsWith(k) || k.startsWith(t)));
  },

  _isSmallTalk(q) {
    const g = ['שלום','היי','הי','מה נשמע','מה קורה','מה המצב','מה שלומך',
      'בוקר טוב','ערב טוב','לילה טוב','תודה','תודה רבה','מעולה',
      'כל הכבוד','אוקיי','אוקי','ok','hello','hi','hey',
      'מה אתה יכול','עזור','עזרה','help'];
    return g.some(w => q.includes(w));
  },

  _smallTalkResponse() {
    return {
      text: 'אני מעולה, תודה ששאלת 😊 איך אפשר לעזור?',
      suggestions: ['מתי הגיבוש הקרוב?', 'מה האירועים במרץ?', 'פרטים על דוד לוי'],
      cards: []
    };
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
    const user = MOCK_DATA.currentUser || { name: 'אורח', role: 'user', group: 'All' };

    const q = query.trim().toLowerCase();
    const isAdmin = user.role === 'admin';

    const followUpScope = this._handleCountScopeFollowUp(q);
    if (followUpScope) return followUpScope;

    const followUpPeople = this._handleFollowUpPeopleQuery(q, isAdmin);
    if (followUpPeople) return followUpPeople;

    if (this._isSmallTalk(q)) return this._smallTalkResponse();

    // ── שאלות כמות/ספירה (ללא כרטיסים) ────────────────────
    const countAnswer = this._countMembersAnswer(q);
    if (countAnswer) {
      if (countAnswer.context) this._setContext(countAnswer.context);
      return { text: countAnswer.text, cards: countAnswer.cards };
    }

    const professionCountAnswer = this._countProfessionAnswer(q);
    if (professionCountAnswer) {
      if (professionCountAnswer.context) this._setContext(professionCountAnswer.context);
      return { text: professionCountAnswer.text, cards: professionCountAnswer.cards };
    }

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
    if (isAdmin && (
      q.includes('סטטיסטיקה') ||
      q.includes('סטטיסטיקות') ||
      q.includes('דוח') ||
      q.includes('פילוח') ||
      q.includes('כמה חברים במערך') ||
      q.includes('כמה אירועים') ||
      q.includes('ממתינים') ||
      q.includes('סה"כ במערך')
    )) {
      return this._getStats();
    }

    // ── אירועים כלליים ────────────────────────────────────
    if (q.includes('אירוע') || q.includes('אירועים') || q.includes('לוז') || q.includes('לוח שנה') || q.includes('מועד')) {
      const eventResult = this._searchEvent(q, isAdmin);
      if (eventResult) return eventResult;
      return this._getUpcomingEvents(isAdmin);
    }

    // ── חיפוש כללי ────────────────────────────────────────
    const genericKeywords = this._extractKeywords(q);
    if (this._looksLikePersonQuery(q, genericKeywords)) {
      const personResult = this._searchPerson(q, isAdmin);
      if (personResult) return personResult;
    }
    if (this._looksLikeEventQuery(q, genericKeywords)) {
      const eventResult = this._searchEvent(q, isAdmin);
      if (eventResult) return eventResult;
    }

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

    // עדיפות 1: חיפוש לפי שם (ולהימנע מהתאמות רחבות מה-bio/skills)
    const nameKeywords = keywords.filter(k =>
      approved.some(u => u.name.toLowerCase().includes(k))
    );

    if (nameKeywords.length > 0) {
      // התאמה חזקה: כל מילה חייבת להיות טוקן בשם ("דוד" לא יפול על "DevOps")
      const strongNameMatches = approved.filter(u => {
        const tokens = this._nameTokens(u.name);
        return nameKeywords.every(k => tokens.some(t => t === k || t.startsWith(k)));
      });

      // העדפה לשם שמתחיל במילת החיפוש (למשל "דוד" -> "דוד לוי" לפני "בן-דוד")
      const startsWithNameMatches = strongNameMatches.filter(u =>
        nameKeywords.every(k => u.name.toLowerCase().startsWith(k))
      );

      const finalNameMatches = startsWithNameMatches.length > 0 ? startsWithNameMatches : strongNameMatches;

      if (finalNameMatches.length > 0) {
        return {
          text: finalNameMatches.length === 1 ? `מצאתי חבר תואם:` : `מצאתי ${finalNameMatches.length} חברים תואמים:`,
          cards: finalNameMatches.map(u => this._personCard(u, isAdmin))
        };
      }
    }

    const exactNameMatches = approved.filter(u =>
      keywords.every(k => u.name.toLowerCase().includes(k))
    );
    if (exactNameMatches.length > 0) {
      return {
        text: exactNameMatches.length === 1 ? `מצאתי חבר תואם:` : `מצאתי ${exactNameMatches.length} חברים תואמים:`,
        cards: exactNameMatches.map(u => this._personCard(u, isAdmin))
      };
    }

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
  const disabledUntil = window.__geminiTemporarilyDisabledUntil || 0;
  const hasGemini = isGeminiEnabled() && Date.now() > disabledUntil;

  const suggestions = [
    '📅 מה האירועים במרץ?', '📅 מה האירועים באפריל?',
    '🏕️ מתי הגיבוש הקרוב?', '👤 פרטים על דוד לוי',
    '🎂 מי יום הולדת השבוע?', '📂 טופס הרשמה',
  ];
  if (isAdmin) suggestions.push('📊 כמה חברים יש?');

  const container = document.getElementById('agent-messages');
  if (!container) return;

  const firstName = user?.name?.split(' ')[0] || 'שלום';

  container.innerHTML = `
    <div class="agent-msg agent-bot">
      <div class="agent-avatar">🤖</div>
      <div class="agent-bubble">
        שלום ${firstName}! אני הסוכן החכם של המערך 👋<br/>
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

  const hasGemini = isGeminiEnabled();

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
        const msg = String(err?.message || '').toLowerCase();
        const isQuota = msg.includes('quota') || msg.includes('rate') || msg.includes('exceeded') || msg.includes('429') || msg.includes('resource_exhausted');
        if (isQuota) {
          window.__geminiTemporarilyDisabledUntil = Date.now() + 60 * 1000;
        }
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