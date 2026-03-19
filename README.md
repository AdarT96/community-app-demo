# Community App Demo

## הפעלת האפליקציה עם Gemini דרך Backend Proxy (מומלץ)

הפרויקט משתמש ב-Proxy בשרת (`/api/gemini`) כדי שה-API key לא ייחשף ב-frontend.

### 1) בחירת צורת הרצה

#### אפשרות A (מומלץ אצלך כרגע): Python בלבד

לא דורש npm/node.

```bash
python server.py
```

#### אפשרות B: Node.js (אם מותקן npm)

```bash
npm install
npm start
```

### 2) הגדרת משתני סביבה

העתק את הקובץ לדוגמה:

```bash
copy .env.example .env
```

ואז עדכן בקובץ `.env`:

```env
GEMINI_API_KEY=YOUR_REAL_KEY
PORT=3000
```

### 3) הרצה

- אם אין npm: `python server.py`
- אם יש npm: `npm start`

פתח בדפדפן:

`http://localhost:3000`

## מה השתנה בארכיטקטורה

- `js/config.js` מוגדר לעבוד מול proxy:
  - `useGeminiProxy: true`
  - `geminiProxyUrl: '/api/gemini'`
- `server.js` שולח את הבקשה ל-Gemini עם המפתח מהשרת (`GEMINI_API_KEY`)
- המשתמשים לא נדרשים להזין API key ולא רואים אותו

## הקשחת אבטחה (מומלץ לפרודקשן)

בוצעה הקשחה בסיסית לשרת `server.js` נגד גישה חיצונית לא מורשית:

- הגבלת Origins דרך `ALLOWED_ORIGINS`
- Rate limiting לנתיבי `/api/*`
- הגבלת גודל גוף בקשה (`BODY_LIMIT`)
- ולידציית קלט ב-`/api/gemini` (אורך query + מודלים מותרים בלבד)
- Security headers (כמו `X-Frame-Options`, `X-Content-Type-Options`)

### משתני סביבה חשובים

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.com,capacitor://localhost
ALLOWED_GEMINI_MODELS=gemini-2.0-flash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30
BODY_LIMIT=64kb
```

### הערות פרקטיות לסביבת 300 משתמשים

- אם רוב המשתמשים מוכרים אבל יש חשש מאיומים חיצוניים, ההגנות למעלה הן חובה מינימלית.
- לפרודקשן מלא מומלץ להוסיף גם:
  - אימות משתמשים (JWT/session)
  - הרשאות בצד שרת לכל פעולה רגישה
  - לוגים וניטור (429/403/5xx)
  - HTTPS בלבד
