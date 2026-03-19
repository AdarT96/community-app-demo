# Community App Demo

## הפעלת האפליקציה עם Gemini דרך Backend Proxy (מומלץ)

הפרויקט משתמש ב-Proxy בשרת (`/api/gemini`) כדי שה-API key לא ייחשף ב-frontend.

### 1) התקנת תלויות

```bash
npm install
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

```bash
npm start
```

פתח בדפדפן:

`http://localhost:3000`

## מה השתנה בארכיטקטורה

- `js/config.js` מוגדר לעבוד מול proxy:
  - `useGeminiProxy: true`
  - `geminiProxyUrl: '/api/gemini'`
- `server.js` שולח את הבקשה ל-Gemini עם המפתח מהשרת (`GEMINI_API_KEY`)
- המשתמשים לא נדרשים להזין API key ולא רואים אותו
