# YAM BARON | Hair Studio — דף נחיתה

דף אחד, בלי מערכת ניהול. כל התוכן יושב בקובץ אחד: `js/content.js`.

## איך מחליפים תוכן

**טקסטים, מספר וואטסאפ, אינסטגרם, כתובת, שעות:** פותחים את `js/content.js` ועורכים את הערכים.
- `whatsapp`: מספר בפורמט בינלאומי, ספרות בלבד, בלי + (למשל `972501234567`).
- `instagram`: שם המשתמש בלי @.
- `address`: כתובת מלאה בעברית; המפה בדף מתעדכנת לבד לפי הכתובת.

**תמונות:** שמים את הקובץ החדש בתיקייה `assets/img/` ומעדכנים את הנתיב ב-`content.js`.
- מומלץ JPEG עד 1600 פיקסל רוחב, עד ~500KB לתמונה.
- פתיח (`hero`): תמונה רוחבית. שירותים/גלריה/עלינו: תמונות לגובה (4:5).

**לוגו:** הקבצים יושבים בתיקייה `assets/brand/` — `logo-full-light.png` (הלוגו המלא, לפתיח הכהה), `logo-mark.png` (המונוגרמה, לפוטר ולפאביקון), ו-`logo-original.png` (קובץ המקור של הלקוח). להחלפה: שמים קובץ חדש עם אותו שם, או משנים את הנתיבים באובייקט `logo` בתוך `content.js`. הפאביקון הוא `assets/favicon.png` (מונוגרמה, 256×256).

**סרטונים:** ברשימה `videos`, כל פריט הוא אחד מ:
- `{ type: "file", src: "assets/video/x.mp4", poster: "assets/img/x.jpg", title: "..." }` — קובץ וידאו אנכי (9:16), מומלץ עד 20MB.
- `{ type: "youtube", src: "https://youtube.com/shorts/XXXX", title: "..." }` — קישור ליוטיוב (גם Shorts).
- `{ type: "instagram", src: "https://www.instagram.com/reel/XXXX/", title: "..." }` — קישור לריל/פוסט.
- `{ type: "placeholder", poster: "assets/img/x.jpg", title: "..." }` — מסגרת זמנית עד שיגיע סרטון.

## איך רואים את הדף במחשב

```bash
cd yam-baron
python3 -m http.server 8080
```
ואז פותחים בדפדפן: http://localhost:8080

## בדיקות אוטומטיות (פעם ראשונה: `cd tools && npm install`)

```bash
cd tools
node check-content.mjs   # בודק שהתוכן תקין ושכל התמונות קיימות
node check-page.mjs      # פותח את הדף בדפדפן סמוי, בודק קישורים, ושומר צילומי מסך ב-tools/shots
```

## העלאה לאוויר

האתר מתארח ב-GitHub Pages מהענף `main`. כל `git push` מעדכן את האתר תוך כדקה. הכתובת הזמנית תהיה `https://avielaroosi.github.io/yam-baron/` (ההגדרה תיעשה בשלב הבא).

## חיבור דומיין (כשיהיה)

1. יוצרים בשורש הפרויקט קובץ בשם `CNAME` שמכיל שורה אחת: `www.yambaron.co.il` (הדומיין שנקנה).
2. אצל ספק הדומיין: רשומת `CNAME` עבור `www` אל `avielaroosi.github.io`, ורשומות `A` עבור השורש אל
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. בהגדרות המאגר ב-GitHub → Pages → מסמנים "Enforce HTTPS" אחרי שהדומיין מאומת.
4. ב-`index.html` מעדכנים את `og:image` ו-`og:url` לכתובת הדומיין החדש.
