/**
 * Verse boundaries containing words of Jesus in Matthew, Mark, and Luke.
 * Derived from the public-domain KJV OSIS red-letter milestones maintained by
 * open-bibles (who="Jesus"). Text still comes from the user's chosen Bolls
 * translation; this file only supplies speaker boundaries.
 */
(function (global) {
  "use strict";

  const RANGE_DATA = [
    "matthew|3:15;4:4,7,10,17,19;5:3-48;6:1-34;7:1-27;8:3-4,7,10-13,20,22,26,32;9:2,4-6,9,12-13,15-17,22,24,28-30,37-38;10:5-42;11:4-19,21-30;12:3-8,11-13,25-37,39-45,48-50;13:3-9,11-33,37-52;14:16,18,27,29,31;15:3-11,13-14,16-20,24,26,28,32,34;16:2-4,6,8-11,13,15,17-19,23-28;17:7,9,11-12,17,20-23,25-27;18:3-20,22-35;19:4-6,8-9,11-12,14,17-19,21,23-24,26,28-30;20:1-16,18-19,21-23,25-28,32;21:2-3,13,16,19,21-22,24-25,27-40,42-44;22:2-14,18-21,29-32,37-40,42-45;23:2-39;24:1-2,4-51;25:1-46;26:2,10-13,18,21,23-29,31-32,34,36,38-42,45-46,50,52-56,64,75;27:11,46;28:9-10,18-20",
    "mark|1:15,17,25,38,41,44;2:5,8-11,14,17,19-22,25-28;3:3-5,23-29,33-35;4:3-9,11-32,35,39-40;5:8-9,19,30,34,36,39,41;6:4,10-11,31,37-38,50;7:6-16,18-23,27,29,34;8:2-3,5,12,15,17-27,29,33-38;9:1,12-13,16,19,21,23,25,29,31,33,35,37,39-50;10:3,5-9,11-12,14-15,18-19,21,23-25,27,29-31,33-34,36,38-40,42-45,51-52;11:2-3,14,17,22-26,29-30,33;12:1-11,15-17,24-27,29-31,34-40,43-44;13:2,5-37;14:6-9,13-15,18,20-22,24-25,27-28,30,32,34,36-38,41-42,48-49,62,72;15:2,34;16:15-18",
    "luke|2:49;4:4,8,12,18-19,21,23-27,35,43;5:4,10,13-14,20,22-24,27,31-32,34-39;6:3-5,8-10,20-49;7:1-9,13-14,22-28,31-48,50;8:5-8,10-18,21-22,25,30,39,45-46,48,50,52,54;9:3-5,13-14,18,20,22-27,41,44,48,50,55-56,58-60,62;10:2-16,18-24,26,28,30-37,41-42;11:2-13,17-26,28-36,39-44,46-52;12:1-12,14-40,42-59;13:2-9,12,15-16,18-21,24-30,32-35;14:3,5,8-14,16-24,26-35;15:4-32;16:1-13,15-31;17:1-4,6-10,14,17-37;18:2-8,10-14,16-17,19-20,22,24-25,27,29-33,41-42;19:5,9-10,12-27,30-31,40,42-44,46;20:3-4,8-18,23-25,34-38,41-44,46-47;21:3-4,6,8-36;22:8,10-12,15-22,25-32,34-38,40,42,46,48,51-53,67-70;23:3,28-31,34,43,46;24:17,19,25-26,36,38-39,41,44,46-49",
  ];

  const redVerses = new Set();
  for (const bookData of RANGE_DATA) {
    const [book, chapters = ""] = bookData.split("|");
    for (const chapterData of chapters.split(";")) {
      const [chapter, ranges = ""] = chapterData.split(":");
      for (const range of ranges.split(",")) {
        const [fromText, toText = fromText] = range.split("-");
        const from = Number(fromText);
        const to = Number(toText);
        for (let verse = from; verse <= to; verse++) {
          redVerses.add(`${book}.${chapter}.${verse}`);
        }
      }
    }
  }

  function renderHtml(html, bookKey, chapter, verse) {
    const value = String(html || "");
    if (!redVerses.has(`${bookKey}.${chapter}.${verse}`)) return value;
    const open = value.search(/[\u201C"]/);
    const curlyClose = value.lastIndexOf("\u201D");
    const straightClose = value.lastIndexOf('"');
    const close = Math.max(curlyClose, straightClose);
    if (open >= 0 && close >= open) {
      return `${value.slice(0, open)}<span class="wj">${value.slice(open, close + 1)}</span>${value.slice(close + 1)}`;
    }
    return `<span class="wj">${value}</span>`;
  }

  global.ChristoRedLetter = {
    hasVerse(bookKey, chapter, verse) {
      return redVerses.has(`${bookKey}.${chapter}.${verse}`);
    },
    renderHtml,
    verseCount: redVerses.size,
  };
})(typeof window !== "undefined" ? window : globalThis);
