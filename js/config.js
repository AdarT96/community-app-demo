/* ============================================================
   הגדרות Frontend
   ============================================================
   חשוב: לא שומרים מפתח Gemini בצד לקוח.
   החיבור למודל מתבצע דרך backend proxy ב- /api/gemini
   ============================================================ */

const APP_CONFIG = {
  useGeminiProxy: true,
  geminiProxyUrl: '/api/gemini',
  geminiModel: 'gemini-2.0-flash',
  // לשימוש פיתוח בלבד (לא מומלץ בפרודקשן):
  allowDirectGemini: false,
  geminiApiKey: '',
};
