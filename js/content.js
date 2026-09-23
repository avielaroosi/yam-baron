// כל התוכן של האתר במקום אחד. כדי להחליף טקסט/תמונה/מספר: עורכים כאן בלבד.
// נתיבי תמונות יחסיים לתיקיית הפרויקט (ללא / בהתחלה).
window.SITE = {
  name: "YAM BARON",
  sub: "Hair Studio",
  tagline: "עיצוב שיער · כלות · החלקות",
  heroText: "סטודיו בוטיק לעיצוב שיער. כלות, החלקות, צבע ותספורות, עם יחס אישי ותוצאה שנראית מושלם גם בתמונות וגם בחיים.",

  // מספר וואטסאפ בפורמט בינלאומי, ספרות בלבד, בלי + (למשל 9725XXXXXXXX). 972000000000 = מספר דמה.
  whatsapp: "972000000000",
  whatsappDefaultText: "היי ים, אשמח לשמוע פרטים ולתאם תור",
  instagram: "yambaron.hair", // בלי @
  phoneDisplay: "000-0000000",
  address: "רחוב הדוגמה 1, עיר", // כתובת דמה עד שתתקבל כתובת אמיתית
  hours: [
    { days: "ראשון–חמישי", time: "09:00–20:00" },
    { days: "שישי", time: "08:00–14:00" },
    { days: "שבת", time: "סגור" },
  ],

  hero: { image: "assets/img/hero.jpg", alt: "סטודיו YAM BARON לעיצוב שיער" },

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
    { type: "placeholder", poster: "assets/img/video-01.jpg", title: "החלקה: לפני ואחרי" },
    { type: "placeholder", poster: "assets/img/video-02.jpg", title: "תסרוקת כלה" },
    { type: "placeholder", poster: "assets/img/video-03.jpg", title: "מאחורי הקלעים בסטודיו" },
  ],

  about: {
    image: "assets/img/about.jpg",
    title: "נעים להכיר, ים",
    text: "מעצבת שיער עם אהבה גדולה לפרטים הקטנים. בסטודיו שלי כל לקוחה מקבלת זמן, הקשבה ותוצאה שמרגישה שלה. מתמחה בכלות, החלקות וצבע, ומאמינה ששיער טוב הוא כזה שנראה טוב גם בלי פילטר.",
  },
};
