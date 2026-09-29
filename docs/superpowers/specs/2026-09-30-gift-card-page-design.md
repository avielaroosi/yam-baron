# גיפט קארד — עמוד נפרד `gift.html` (אפיון מאושר)

תאריך: 2026-09-30. סטטוס: **מאושר על ידי הבעלים** (שיחה 2026-09-30). מחליף את הרעיון הקודם
(`2026-09-30-hair-date-gift-card-idea.md`): **אין חבילות, אין מחירים, אין קוד מימוש, אין HAIR DATE.**
הגיפט קארד הוא פתיח לשיחה: טקסט חם + כפתור וואטסאפ אחד. ההתאמה והמחיר נסגרים אישית עם ים.

## מטרה
לתת למבקרת (מישהי שרוצה להפתיע אישה שהיא אוהבת) דף שאפשר לשתף בסטורי/וואטסאפ, שמסביר את
הרעיון ומוביל לשיחה עם ים. הצלחה = לחיצה על כפתור הוואטסאפ עם ההודעה המוכנה.

## החלטות הבעלים
- רמה ב': עמוד נפרד + פס קצר בדף הבית שמוביל אליו (לא וואטסאפ ישיר מהפס).
- שם: "גיפט קארד". כתובת: `/gift.html`. אין "HAIR DATE".
- תמונה: העתק של `assets/img/gallery-b-07.jpg` בשם חדש `assets/img/gift-01.jpg` (לא נוגעים בגלריה).
- הודעת וואטסאפ מוכנה: `היי ים, אשמח לתאם גיפט קארד למישהי שאני אוהבת`
- הטקסט **בלי פסיקים ובלי מקפים** (בקשה מפורשת של הבעלים). משפטים קצרים במקום.

## הטקסט (מילה במילה)
כותרת: `המתנה שהיא תרגיש בה הכי יפה`

פסקאות:
1. `רוצה להפתיע מישהי שאת אוהבת?`
2. `עם גיפט קארד אישי היא תוכל להתפנק במה שהכי מתאים לה. החלקה. תסרוקת לאירוע. או פן.`
3. `כל שיער וכל בקשה הם שונים. לכן נתאים יחד את המתנה המושלמת. נדבר ונבין מה היא אוהבת ומה מתאים לה. את פרטי החבילה והמחיר נסגור באופן אישי.`

משפט סיום (מודגש בזהב): `הפתעה יפה מתחילה בשיחה אחת.`

כפתור: `בואו נתאים לה מתנה`

## העמוד `gift.html`
- `<html lang="he" dir="rtl">`. אותו `<head>` כמו index (גופנים, `css/style.css`, favicon, theme-color).
  מטא משלו: title `גיפט קארד | YAM BARON`, description (ללא פסיקים), og:title/og:description,
  og:image = `https://avielaroosi.github.io/yam-baron/assets/img/gift-01.jpg`, og:url = `.../gift.html`.
- מבנה:
  1. `header.topbar`: המונוגרמה (`SITE.logo.mark`) כקישור ל-`index.html`, aria-label "לדף הבית".
  2. `main > section.gift`: `img.gift__img` (gift-01.jpg, alt מהתוכן, `fetchpriority=high`, לא lazy)
     ו-`div.gift__body`: `h1.gift__title`, פסקאות ב-`div.gift__text`, `p.gift__closing`,
     `a.btn.btn--gold.btn--big#gift-cta` (wa.me, target=_blank, rel=noopener).
     טלפון: תמונה מעל הטקסט, טקסט ממורכז. ≥820px: שתי עמודות (grid), התמונה בעמודה בגובה
     מלא (object-fit: cover), הטקסט ממורכז אנכית.
  3. `footer.footer` זהה לדף הבית (מונוגרמה, wordmark, שנה) + קישור "חזרה לדף הבית".
  4. `a.wa-fab#wa-fab` זהה, href = wa.me עם `SITE.gift.whatsappText`.
- סקריפטים: `js/content.js` ואז `js/gift.js`. **לא** `main.js`, **לא** `intro.js`.
  אין פופאפ 10% ואין אנימציית פתיחה בעמוד הזה.
- אם `window.SITE` או `SITE.gift` חסרים: הודעת console.error והעמוד נשאר קריא (אין reveal-hide).

## הפס בדף הבית (`index.html`)
- `section.section.section--dark.section--divided.reveal#gift-band` בין `#testimonials` ל-`#about`.
- תוכן: `p.gift-band__eyebrow` "גיפט קארד", `h2.gift-band__title` = `SITE.gift.title`,
  `a.btn.btn--gold#gift-band-cta` "לפרטים על המתנה" → `gift.html`. ממורכז, עם קו זהב עליון.
- `main.js`: `renderGiftBand()` בתוך ה-boot (`safe("giftBand", ...)`). אם `S.gift` חסר או
  `S.gift.enabled === false` → הסקשן מקבל `hidden`.

## התוכן (`js/content.js`)
```js
gift: {
  enabled: true,
  title: "המתנה שהיא תרגיש בה הכי יפה",
  text: [ /* 3 פסקאות מלמעלה */ ],
  closing: "הפתעה יפה מתחילה בשיחה אחת.",
  cta: "בואו נתאים לה מתנה",
  whatsappText: "היי ים, אשמח לתאם גיפט קארד למישהי שאני אוהבת",
  image: "assets/img/gift-01.jpg",
  alt: "תסרוקת אסופה מעוצבת מהגב",
  bandEyebrow: "גיפט קארד",
  bandCta: "לפרטים על המתנה",
},
```

## CSS (`css/style.css`, בסוף הקובץ)
`.topbar`, `.gift`, `.gift__img`, `.gift__body`, `.gift__title`, `.gift__text`, `.gift__closing`
(זהב, גופן כותרות), `.gift-band*`. משתמשים במשתני הצבע והגופן הקיימים. `min-width: 820px`
לפריסת שתי עמודות, כמו שאר האתר.

## בדיקות
- `tools/check-content.mjs`: `SITE.gift` קיים עם title/text(רשימה לא ריקה)/closing/cta/whatsappText/
  image(קובץ קיים)/alt/bandEyebrow/bandCta.
- `tools/check-page.mjs`: פותח גם `gift.html` (mobile 390 + desktop 1440). בודק: אין שגיאות
  console/page, אין 404 מקומי, אין אלמנט שחורג ימינה/שמאלה, כל img עם alt, אין `href="#"`,
  `#gift-cta` ו-`#wa-fab` = wa.me עם המספר הנכון + הטקסט מקודד + target=_blank,
  h1 = `SITE.gift.title`, קישור לדף הבית קיים. בדף הבית: `#gift-band` מוצג, הכפתור מוביל
  ל-`gift.html`, והסדר testimonials → gift-band → about. צילומי מסך `tools/shots/gift-*.png`.
- הבעלים מאשר את צילומי המסך לפני הדחיפה.

## פריסה
push ל-`main` (GitHub Pages). כלל קיים: קבצים חדשים רק בשם חדש, לא מוחקים קבצים ישנים באותה דחיפה.
אחרי הדחיפה: בדיקה באוויר של `/gift.html` ושל הפס בדף הבית (זיכרון מטמון של content.js ~10 דק').

## מחוץ לתחום
סליקה, כרטיס אישי עם הקדשה (רמה ג'), מחירים/חבילות. אפשר להוסיף בשלב עתידי נפרד.
