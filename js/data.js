// ============================================================
//  מערך מילואים  –  נתוני דמו
// ============================================================

const MOCK_DATA = {

  appName: "מערך מילואים",

  currentUser: null,

  // ── קבוצות ───────────────────────────────────────────────
  groups: [
    { value: "All",       label: "הכל",       icon: "🌐" },
    { value: "Operative", label: "אופרטיבי",  icon: "⚙️" },
    { value: "Social",    label: "חברתי",      icon: "🎉" },
    { value: "Gadna",     label: "גדנעות",     icon: "🪖" },
    { value: "Gibbush",   label: "גיבושים",    icon: "🏕️" },
    { value: "Training",  label: "הכשרות",     icon: "💪" },
  ],

  // ── משתמשים / חברים ──────────────────────────────────────
  users: [
    {
      id: 1, name: "דוד לוי", email: "david@example.com", password: "1234",
      role: "admin", status: "approved", group: "Operative",
      phone: "050-1234567", whatsapp: "972501234567",
      birthday: "1990-03-22", profession: "מהנדס תוכנה",
      skills: ["React", "Python", "ענן", "DevOps"],
      bio: "מהנדס תוכנה עם 10 שנות ניסיון בפיתוח מערכות ענן וממשקי משתמש. מומחה לארכיטקטורת מיקרו-שירותים ופיתוח אג'ייל. מוכן לייעץ ולסייע בכל נושא טכנולוגי.",
      avatar: "דל"
    },
    {
      id: 2, name: "יעל כהן", email: "yael@example.com", password: "1234",
      role: "user", status: "approved", group: "Social",
      phone: "052-2345678", whatsapp: "972522345678",
      birthday: "1992-03-25", profession: "מעצבת גרפית ו-UX",
      skills: ["פוטושופ", "פיגמה", "UI/UX", "מיתוג"],
      bio: "מעצבת גרפית עצמאית עם התמחות ב-UX/UI. עבדתי עם חברות סטארטאפ ועסקים קטנים לבניית זהות ויזואלית ומוצרים דיגיטליים. מחפשת שיתופי פעולה בתחום העיצוב.",
      avatar: "יכ"
    },
    {
      id: 3, name: "אבי מזרחי", email: "avi@example.com", password: "1234",
      role: "user", status: "approved", group: "Training",
      phone: "054-3456789", whatsapp: "972543456789",
      birthday: "1988-05-10", profession: "מאמן כושר מוסמך",
      skills: ["כושר גופני", "תזונה", "קרוספיט", "שיקום"],
      bio: "מאמן כושר מוסמך עם 8 שנות ניסיון. מתמחה בהכנה גופנית לשירות מבצעי ובשיקום ספורטאים לאחר פציעה. מוביל את קבוצת ההכשרות הגופניות של המערך.",
      avatar: "אמ"
    },
    {
      id: 4, name: "נועה שפירו", email: "noa@example.com", password: "1234",
      role: "user", status: "approved", group: "Operative",
      phone: "053-4567890", whatsapp: "972534567890",
      birthday: "1995-07-04", profession: "מנהלת פרויקטים (PMP)",
      skills: ["אג'ייל", "סקראם", "מנהיגות", "ניהול סיכונים"],
      bio: "בעלת הסמכת PMP עם ניסיון בניהול פרויקטים מורכבים בתחום הביטחוני והטכנולוגי. מובילה תהליכי שיפור ארגוני ובניית יכולות צוות.",
      avatar: "נש"
    },
    {
      id: 5, name: "רון כץ", email: "ron@example.com", password: "1234",
      role: "user", status: "approved", group: "Gadna",
      phone: "058-5678901", whatsapp: "972585678901",
      birthday: "2000-03-30", profession: "סטודנט + מדריך גדנ\"ע",
      skills: ["מנהיגות נוער", "עבודת צוות", "הדרכה", "כושר גופני"],
      bio: "מדריך גדנ\"ע מוסמך עם ניסיון של 3 שנים בהכנת נוער לפני גיוס. לומד תואר ראשון בחינוך ומנהיגות. שם דגש על פיתוח ערכים ורוח לחימה.",
      avatar: "רכ"
    },
    {
      id: 6, name: "מאיה בן-דוד", email: "maya@example.com", password: "1234",
      role: "user", status: "approved", group: "Social",
      phone: "050-6789012", whatsapp: "972506789012",
      birthday: "1993-12-15", profession: "פסיכולוגית קלינית",
      skills: ["ייעוץ", "דינמיקה קבוצתית", "CBT", "קבוצות תמיכה"],
      bio: "פסיכולוגית קלינית מוסמכת עם התמחות בטיפול בחרדה, PTSD ואתגרים הקשורים לשירות ביטחוני. מובילה סדנאות חוסן נפשי וקבוצות תמיכה לחברי המערך ובני משפחותיהם.",
      avatar: "מב"
    },
    {
      id: 7, name: "טל פרידמן", email: "tal@example.com", password: "1234",
      role: "user", status: "approved", group: "Training",
      phone: "052-7890123", whatsapp: "972527890123",
      birthday: "1991-09-08", profession: "פרמדיק ומדריך TCCC",
      skills: ["עזרה ראשונה", "TCCC", "טיפול חירום", "הדרכה רפואית"],
      bio: "פרמדיק מוסמך עם 6 שנות ניסיון בשטח. מדריך TCCC (Tactical Combat Casualty Care) ומוביל הכשרות רפואיות קרביות. זמין לייעוץ והדרכה בכל נושא רפואי.",
      avatar: "טפ"
    },
    {
      id: 8, name: "אורי פרץ", email: "ori@example.com", password: "1234",
      role: "user", status: "pending", group: "Operative",
      phone: "054-8901234", whatsapp: "972548901234",
      birthday: "1997-11-20", profession: "עורך דין – דיני עבודה",
      skills: ["דיני עבודה", "חוזים", "גישור", "ייצוג משפטי"],
      bio: "עורך דין המתמחה בדיני עבודה ונזקין. מוכן לסייע לחברי המערך בשאלות משפטיות הנוגעות לשירות מילואים, זכויות עובדים ופיצויים.",
      avatar: "אפ"
    },
    {
      id: 9, name: "שירה גולדברג", email: "shira@example.com", password: "1234",
      role: "user", status: "pending", group: "Gibbush",
      phone: "053-9012345", whatsapp: "972539012345",
      birthday: "1999-06-14", profession: "רואת חשבון (CPA)",
      skills: ["ראיית חשבון", "מיסוי", "אקסל", "דוחות כספיים"],
      bio: "רואת חשבון מוסמכת המתמחה במיסוי עסקי ואישי. מסייעת לחברי המערך בנושאי החזרי מס על שירות מילואים, ניהול תקציב וייעוץ כלכלי.",
      avatar: "שג"
    },
    {
      id: 10, name: "אייל הורוביץ", email: "eyal@example.com", password: "1234",
      role: "user", status: "rejected", group: "Training",
      phone: "058-0123456", whatsapp: "972580123456",
      birthday: "1985-02-28", profession: "אדריכל (רשיון A)",
      skills: ["AutoCAD", "Revit", "תכנון עירוני", "3D"],
      bio: "אדריכל מוסמך עם רישיון A ו-15 שנות ניסיון בתכנון מתחמים ומבנים מורכבים. מומחה לתכנון מתקנים ביטחוניים ותשתיות.",
      avatar: "אה"
    },
    {
      id: 11, name: "גלעד שמיר", email: "gilad@example.com", password: "1234",
      role: "user", status: "approved", group: "Gibbush",
      phone: "050-1111222", whatsapp: "972501111222",
      birthday: "1987-08-19", profession: "מאמן גיבוש ארגוני",
      skills: ["גיבוש צוות", "פאוור ניג'ט", "אימון קבוצתי", "פסיכולוגיה ספורטיבית"],
      bio: "מאמן גיבוש ארגוני עם ניסיון של 12 שנה. פיתחתי שיטת גיבוש ייחודית המשלבת אתגרי שטח עם כלים פסיכולוגיים. הובלתי מאות סדנאות גיבוש לצוותים מבצעיים ואזרחיים.",
      avatar: "גש"
    },
    {
      id: 12, name: "ליאת ברק", email: "liat@example.com", password: "1234",
      role: "user", status: "approved", group: "Gadna",
      phone: "052-3334444", whatsapp: "972523334444",
      birthday: "1994-11-03", profession: "מחנכת ומדריכת נוער",
      skills: ["חינוך", "מנהיגות נוער", "פדגוגיה", "סדנאות ערכים"],
      bio: "מחנכת ומדריכת נוער עם 8 שנות ניסיון בעבודה עם בני נוער בגיל הגדנ\"ע. מתמחה בפיתוח זהות לאומית ורוח ציונית. מובילה תוכניות הכנה ייחודיות לפני גיוס.",
      avatar: "לב"
    },
  ],

  // אירועי גנט
  events: [
    { id: 1,  title: "סדנת מנהיגות שנתית",       date: "2026-03-20", endDate: "2026-03-20", group: "Operative",  location: "בסיס תל אביב",          description: "יום פיתוח מיומנויות מנהיגות שנתי למפקדים ולבכירים.", type: "workshop",  color: "#6750A4" },
    { id: 2,  title: "מנגל גיבוש חברתי",          date: "2026-03-22", endDate: "2026-03-22", group: "Social",     location: "פארק הירקון",            description: "מפגש חברתי לסיום הרבעון לכל חברי המערך.", type: "social",    color: "#B5838D" },
    { id: 3,  title: "גדנ\"ע – יום הכנה",         date: "2026-03-25", endDate: "2026-03-27", group: "Gadna",      location: "מרכז הכשרה צפון",        description: "קורס הכנה לפני גיוס – 3 ימים אינטנסיביים.", type: "training",  color: "#E9C46A" },
    { id: 4,  title: "ריצת 5 ק\"מ – מערך מילואים", date: "2026-04-03", endDate: "2026-04-03", group: "Training",   location: "טיילת תל אביב",           description: "ריצה חודשית פתוחה לכל חברי המערך.", type: "fitness",   color: "#2A9D8F" },
    { id: 5,  title: "ישיבת מטה חודשית",           date: "2026-04-07", endDate: "2026-04-07", group: "Operative",  location: "מטה – חדר 3",             description: "סקירה מבצעית ותכנון רבעוני.", type: "meeting",   color: "#6750A4" },
    { id: 6,  title: "גיבוש – חדר בריחה",          date: "2026-04-12", endDate: "2026-04-12", group: "Gibbush",    location: "Escape HQ, ירושלים",     description: "פעילות גיבוש כיפית – חדר בריחה בקבוצות.", type: "social",    color: "#5C8374" },
    { id: 7,  title: "קורס TCCC – עזרה ראשונה",   date: "2026-04-18", endDate: "2026-04-19", group: "Training",   location: "תחנת מד\"א, חיפה",         description: "קורס TCCC מוסמך – טיפול קרבי ב-2 ימים.", type: "training",  color: "#2A9D8F" },
    { id: 8,  title: "טקס יום העצמאות",            date: "2026-04-23", endDate: "2026-04-23", group: "All",        location: "כיכר המרכז",              description: "השתתפות המערך בטקס הלאומי.", type: "ceremony",  color: "#E76F51" },
    { id: 9,  title: "מחנה קיץ גדנ\"ע",            date: "2026-05-10", endDate: "2026-05-14", group: "Gadna",      location: "בסיס אימונים צה\"ל",      description: "מחנה קיץ אינטנסיבי לפני גיוס – 5 ימים.", type: "training",  color: "#E9C46A" },
    { id: 10, title: "גיבוש שנתי – קיץ 2026",     date: "2026-05-28", endDate: "2026-05-29", group: "Gibbush",    location: "גליל עליון",              description: "גיבוש שנתי לכל המערך – לילה בשטח + פעילויות.", type: "training",  color: "#5C8374" },
    { id: 11, title: "יום אסטרטגיה שנתי",          date: "2026-06-01", endDate: "2026-06-01", group: "Operative",  location: "מרכז כנסים",              description: "יום תכנון ואסטרטגיה שנתי להנהגה.", type: "meeting",   color: "#6750A4" },
    { id: 12, title: "הכשרת מפקדים – מחזור ב'",   date: "2026-06-10", endDate: "2026-06-12", group: "Training",   location: "בסיס ההכשרה",             description: "הכשרת מפקדים למחזור ב' – 3 ימים.", type: "workshop",  color: "#2A9D8F" },
  ],

  // מסמכים וטפסים – מאורגן לפי קבוצות
  documents: [
    {
      category: "אופרטיבי",
      group: "Operative",
      icon: "⚙️",
      items: [
        { title: "טופס אישור משימה",              type: "form", url: "https://forms.google.com/op1",    description: "טופס לאישור ותיעוד משימות מבצעיות." },
        { title: "פקודות מבצע – תבנית",           type: "doc",  url: "https://drive.google.com/op1",    description: "תבנית רשמית לכתיבת פקודות מבצע." },
        { title: "דוח ביצוע משימה",               type: "form", url: "https://forms.google.com/op2",    description: "דוח תפעולי לסיום משימה." },
        { title: "נוהלי בטיחות – מסמך מרכזי",    type: "pdf",  url: "https://drive.google.com/op2",    description: "נוהלי הבטיחות המעודכנים של המערך." },
      ]
    },
    {
      category: "גדנעות",
      group: "Gadna",
      icon: "🪖",
      items: [
        { title: "טופס הרשמה לגדנ\"ע",            type: "form", url: "https://forms.google.com/gd1",    description: "הרשמה רשמית לתוכנית הגדנ\"ע." },
        { title: "אישור הורים – גדנ\"ע",           type: "form", url: "https://forms.google.com/gd2",    description: "נדרש לכל משתתף מתחת לגיל 18." },
        { title: "תוכנית גדנ\"ע – מסמך מלא",      type: "pdf",  url: "https://drive.google.com/gd1",    description: "תוכנית הגדנ\"ע המלאה – מטרות ולוז." },
        { title: "לוח זמנים – מחנה קיץ",          type: "pdf",  url: "https://drive.google.com/gd2",    description: "לוח זמנים מפורט למחנה קיץ גדנ\"ע." },
      ]
    },
    {
      category: "גיבושים",
      group: "Gibbush",
      icon: "🏕️",
      items: [
        { title: "טופס הצטרפות לגיבוש",           type: "form", url: "https://forms.google.com/gb1",    description: "הרשמה לפעילויות גיבוש קרובות." },
        { title: "כתב ויתור – פעילות שטח",         type: "form", url: "https://forms.google.com/gb2",    description: "כתב ויתור חובה לפעילויות שטח." },
        { title: "מדריך הגיבוש – מתכנן",          type: "doc",  url: "https://drive.google.com/gb1",    description: "מדריך לתכנון ועריכת גיבושים." },
        { title: "דוח גיבוש – תבנית",             type: "form", url: "https://forms.google.com/gb3",    description: "תבנית לדיווח לאחר פעילות גיבוש." },
      ]
    },
    {
      category: "הכשרות",
      group: "Training",
      icon: "💪",
      items: [
        { title: "טופס הרשמה להכשרה",             type: "form", url: "https://forms.google.com/tr1",    description: "הרשמה לקורסים והכשרות." },
        { title: "הנחיות אימון גופני",             type: "pdf",  url: "https://drive.google.com/tr1",    description: "הנחיות ותקנים רשמיים לאימון." },
        { title: "אישור רפואי לאימון",             type: "form", url: "https://forms.google.com/tr2",    description: "אישור רפואי לפני השתתפות בהכשרה." },
        { title: "תכנית תזונה מומלצת",             type: "doc",  url: "https://drive.google.com/tr2",    description: "תכנית תזונה לחברים פעילים." },
        { title: "לוח הכשרות – רבעוני",           type: "pdf",  url: "https://drive.google.com/tr3",    description: "לוח ההכשרות לרבעון הקרוב." },
      ]
    },
    {
      category: "חברתי",
      group: "Social",
      icon: "🎉",
      items: [
        { title: "טופס הצעת אירוע חברתי",          type: "form", url: "https://forms.google.com/sc1",    description: "הצע אירוע חברתי לקהילה." },
        { title: "כתב ויתור לטיולים",              type: "form", url: "https://forms.google.com/sc2",    description: "כתב ויתור לאירועים ופעילויות." },
        { title: "נהלי אירועי קהילה",              type: "pdf",  url: "https://drive.google.com/sc1",    description: "נהלים לארגון אירועים קהילתיים." },
      ]
    },
    {
      category: "כללי – כל הקבוצות",
      group: "All",
      icon: "�",
      items: [
        { title: "טופס הרשמה לחבר חדש",           type: "form", url: "https://forms.google.com/gen1",   description: "הרשמה רשמית לחברים חדשים במערך." },
        { title: "עדכון פרטים אישיים",             type: "form", url: "https://forms.google.com/gen2",   description: "עדכון פרטי קשר ומידע אישי." },
        { title: "עדכון איש קשר לחירום",           type: "form", url: "https://forms.google.com/gen3",   description: "עדכן פרטי איש הקשר שלך לחירום." },
        { title: "תקנון המערך",                    type: "pdf",  url: "https://drive.google.com/gen1",   description: "תקנון ונהלים רשמיים של מערך מילואים." },
      ]
    },
  ],

  // פונקציות עזר
  getUpcomingBirthdays(days = 30) {
    const today = new Date();
    return this.users
      .filter(u => u.status === "approved" && u.birthday)
      .map(u => {
        const bday = new Date(u.birthday);
        const next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const diff = Math.ceil((next - today) / 86400000);
        return { ...u, nextBirthday: next, daysUntil: diff };
      })
      .filter(u => u.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  },

  getNextEvent(group = "All") {
    const today = new Date();
    today.setHours(0,0,0,0);
    return this.events
      .filter(e => group === "All" || e.group === group || e.group === "All")
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
  },

  getFilteredEvents(group = "All") {
    if (group === "All") return this.events;
    return this.events.filter(e => e.group === group || e.group === "All");
  },

  getApprovedMembers(group = "All") {
    if (group === "All") return this.users.filter(u => u.status === "approved");
    return this.users.filter(u => u.status === "approved" && u.group === group);
  },

  getPendingUsers() {
    return this.users.filter(u => u.status === "pending");
  },

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  },

  formatDateShort(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  },

  groupLabel(group) {
    const g = this.groups.find(x => x.value === group);
    return g ? g.label : group;
  },

  groupIcon(group) {
    const g = this.groups.find(x => x.value === group);
    return g ? g.icon : "📌";
  },

  groupColor(group) {
    const map = {
      Operative: "#6750A4",
      Gadna:     "#D4A017",
      Gibbush:   "#5C8374",
      Training:  "#2A9D8F",
      Social:    "#B5838D",
      All:       "#264653",
    };
    return map[group] || "#6750A4";
  },

  statusLabel(status) {
    const map = { approved: "מאושר", pending: "ממתין", rejected: "נדחה" };
    return map[status] || status;
  },

  typeLabel(type) {
    const map = { workshop: "סדנה", social: "חברתי", training: "אימון/הכשרה", fitness: "כושר", meeting: "ישיבה", ceremony: "טקס" };
    return map[type] || type;
  }
};