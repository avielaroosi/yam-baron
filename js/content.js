// כל התוכן של האתר במקום אחד. כדי להחליף טקסט/תמונה/מספר: עורכים כאן בלבד.
// נתיבי תמונות יחסיים לתיקיית הפרויקט (ללא / בהתחלה).
window.SITE = {
  name: "YAM BARON",
  sub: "Hair Studio",
  tagline: "עיצוב שיער · כלות · החלקות",
  heroText: "סטודיו בוטיק לעיצוב שיער. כלות, החלקות, צבע ותספורות, עם יחס אישי ותוצאה שנראית מושלמת גם בתמונות וגם בחיים.",

  // מספר וואטסאפ בפורמט בינלאומי, ספרות בלבד, בלי + (054-392-2677 → 972543922677).
  whatsapp: "972543922677",
  whatsappDefaultText: "היי ים, אשמח לשמוע פרטים ולתאם תור",
  instagram: "yam.baron_hair", // בלי @
  // phone = ספרות בפורמט בינלאומי, משמש לקישור ההתקשרות (tel:); phoneDisplay = מה שהמבקר רואה על המסך.
  phone: "972543922677",
  phoneDisplay: "054-392-2677",
  address: "נחל גלים 15, כפר יונה",
  // קואורדינטות למפת וויז (הניווט עצמו משתמש בכתובת למעלה). אם הכתובת משתנה: קליק ימני בגוגל מפות → העתקת המספרים.
  geo: { lat: 32.3119488, lon: 34.9267893 },
  hours: [
    { days: "ראשון–חמישי", time: "09:00–20:00" },
    { days: "שישי", time: "08:00–14:00" },
    { days: "שבת", time: "סגור" },
  ],

  // שימו לב: הנתיבים של hero.image ושל logo.hero מופיעים גם בשתי שורות
  // <link rel="preload"> ב-index.html. אם משנים כאן נתיב — חובה לעדכן גם שם.
  hero: { image: "assets/img/hero.jpg", alt: "ים בראון מסרקת כלה בסטודיו" },

  // לוגו: hero = לוגו מלא בגרסה לרקע כהה; mark = המונוגרמה בלבד (פוטר, אייקון)
  // הנתיב של logo.hero מופיע גם בשורת <link rel="preload"> ב-index.html — לעדכן בשני המקומות.
  logo: { hero: "assets/brand/logo-full-light.svg", mark: "assets/brand/logo-mark.png" },

  services: [
    {
      id: "bridal",
      title: "עיצוב כלות",
      desc: "תסרוקת כלה שמחזיקה מהבוקר ועד הריקוד האחרון. כולל פגישת ניסיון ותיאום מלא ליום החתונה.",
      image: "assets/img/service-bridal.jpg",
      whatsappText: "היי ים, אשמח לתאם עיצוב שיער לכלה",
    },
    {
      id: "straightening",
      title: "החלקות",
      desc: "החלקות מקצועיות לכל סוג שיער: חלק, בריא ומבריק לחודשים, בלי לפגוע בשיער.",
      image: "assets/img/service-straightening.jpg",
      whatsappText: "היי ים, אשמח לשמוע על החלקה ולתאם תור",
    },
    {
      id: "cut-color",
      title: "תספורות וצבע",
      desc: "תספורת שמתאימה למבנה הפנים, וצבע שנראה טבעי ומדויק. ייעוץ אישי לפני כל שינוי.",
      image: "assets/img/service-cut-color.jpg",
      whatsappText: "היי ים, אשמח לתאם תספורת / צבע",
    },
    {
      id: "events",
      title: "תסרוקות לאירועים",
      desc: "תסרוקת מעוצבת לאירוע, לצילומים או לערב מיוחד. מגיעות, יושבות, יוצאות מוכנות.",
      image: "assets/img/service-events.jpg",
      whatsappText: "היי ים, אשמח לתאם תסרוקת לאירוע",
    },
  ],

  gallery: [
    { src: "assets/img/gallery-01.jpg", alt: "עבודה מהסטודיו 1" },
    { src: "assets/img/gallery-02.jpg", alt: "עבודה מהסטודיו 2" },
    { src: "assets/img/gallery-03.jpg", alt: "עבודה מהסטודיו 3" },
    { src: "assets/img/gallery-04.jpg", alt: "עבודה מהסטודיו 4" },
    { src: "assets/img/gallery-05.jpg", alt: "עבודה מהסטודיו 5" },
    { src: "assets/img/gallery-06.jpg", alt: "עבודה מהסטודיו 6" },
    { src: "assets/img/gallery-07.jpg", alt: "עבודה מהסטודיו 7" },
    { src: "assets/img/gallery-08.jpg", alt: "עבודה מהסטודיו 8" },
  ],

  // type: "placeholder" (מסגרת עד שיגיע סרטון) | "file" (src = assets/video/x.mp4) | "youtube" (src = קישור Shorts/וידאו) | "instagram" (src = קישור לפוסט/ריל)
  videos: [
    { type: "file", src: "assets/video/yam-01.mp4", poster: "assets/img/video-yam-01.jpg", title: "רגעים מהסטודיו" },
    { type: "placeholder", poster: "assets/img/video-02.jpg", title: "תסרוקת כלה" },
    { type: "placeholder", poster: "assets/img/video-03.jpg", title: "מאחורי הקלעים בסטודיו" },
  ],

  about: {
    image: "assets/img/about.jpg",
    imageAlt: "ים בראון, מעצבת שיער",
    title: "נעים מאוד, אני ים בראון 🤍",
    // כל פריט ברשימה = פסקה נפרדת בדף
    text: [
      "מעצבת שיער לכלות וערב ומתמחה בהחלקות שיער.",
      "מאז שאני זוכרת את עצמי, עולם עיצוב השיער תמיד היה חלק ממני. אני אוהבת את היצירה, את השינוי, להוציא מכן את המיטב ובעיקר את המפגש עם כל נשמה שעוברת אצלי.",
      "עבורי, לעצב שיער לכלה, לסרק אמא של כלה או לגרום למלווה להרגיש בשיא שלה זו זכות גדולה.",
      "ובהחלקות? אני אוהבת במיוחד את הרגע שבו את מגיעה אליי אחרי שהרגשת שהשיער שלך פשוט לא מסתדר כמו שאת רוצה, ויוצאת עם שיער שאת עפה עליו. שיער שנוח לך איתו, מחמיא לך וממשיך איתך גם הרבה אחרי שיצאת מהמספרה.",
      "אני מאמינה שהלב והנשמה שלי חייבים להיות חלק מהעבודה. מקצועיות, הקשבה, יחס אישי ואהבה אמיתית למה שאני עושה, זה מה שמוביל אותי בכל פגישה איתכן ✨",
    ],
  },
};
