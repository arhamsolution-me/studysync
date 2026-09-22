/**
 * System Date & Time Utility for Academic Task Scheduling & AI Prompts
 * Ensures exact, timezone-aware, real-time calculation of calendar dates and deadlines.
 */

export interface SystemDateTimeInfo {
  now: Date;
  iso: string;
  dateStr: string; // "2026-09-19"
  timeStr12h: string; // "09:45 PM"
  timeStr24h: string; // "21:45"
  dayOfWeek: string; // "Saturday"
  dayOfMonth: number; // 19
  monthName: string; // "September"
  monthNum: number; // 9 (1-indexed)
  year: number; // 2026
  timezone: string; // "PKT" / "UTC+05:00"
  tomorrowDateStr: string; // "2026-09-20"
  tomorrowDayOfWeek: string; // "Sunday"
  parsoDateStr: string; // "2026-09-21"
  parsoDayOfWeek: string; // "Monday"
}

/**
 * Returns comprehensive current system date and time details.
 */
export function getSystemDateTime(baseDate: Date = new Date()): SystemDateTimeInfo {
  const now = new Date(baseDate);

  const year = now.getFullYear();
  const monthNum = now.getMonth() + 1;
  const dayOfMonth = now.getDate();

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${year}-${pad(monthNum)}-${pad(dayOfMonth)}`;

  const timeStr12h = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const timeStr24h = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });

  // Timezone calculation
  const tzOffsetMin = -now.getTimezoneOffset();
  const tzSign = tzOffsetMin >= 0 ? '+' : '-';
  const tzHours = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
  const tzMins = pad(Math.abs(tzOffsetMin) % 60);
  const timezone = `UTC${tzSign}${tzHours}:${tzMins}`;

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowDateStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
  const tomorrowDayOfWeek = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });

  // Parso (Day after tomorrow)
  const parso = new Date(now);
  parso.setDate(now.getDate() + 2);
  const parsoDateStr = `${parso.getFullYear()}-${pad(parso.getMonth() + 1)}-${pad(parso.getDate())}`;
  const parsoDayOfWeek = parso.toLocaleDateString('en-US', { weekday: 'long' });

  return {
    now,
    iso: now.toISOString(),
    dateStr,
    timeStr12h,
    timeStr24h,
    dayOfWeek,
    dayOfMonth,
    monthName,
    monthNum,
    year,
    timezone,
    tomorrowDateStr,
    tomorrowDayOfWeek,
    parsoDateStr,
    parsoDayOfWeek,
  };
}

/**
 * Builds an accurate, real-time markdown context block to inject into AI System Prompts.
 * Includes a 7-day calendar lookup table so the LLM never hallucinates days or dates.
 */
export function getAcademicCalendarPromptContext(baseDate: Date = new Date()): string {
  const dt = getSystemDateTime(baseDate);

  // Generate 7-day calendar lookup table with Roman Urdu days
  const pad = (n: number) => String(n).padStart(2, '0');
  let lookupTable = '';
  const romanUrduDays: Record<string, string> = {
    Sunday: 'itwar',
    Monday: 'somwar / peer',
    Tuesday: 'mangal',
    Wednesday: 'budh',
    Thursday: 'jummarat / jumerat',
    Friday: 'jumma / juma',
    Saturday: 'hafta',
  };

  for (let i = 0; i <= 7; i++) {
    const d = new Date(dt.now);
    d.setDate(dt.now.getDate() + i);
    const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const fullDay = d.toLocaleDateString('en-US', { weekday: 'long' });
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const urduDay = romanUrduDays[fullDay] || '';
    const label = i === 0 ? 'Today (aaj / aj)' : i === 1 ? 'Tomorrow (kal / kl / kall)' : i === 2 ? 'Day after tomorrow (parso / prso)' : `In ${i} days`;
    lookupTable += `  • ${label}: ${day} (${urduDay}), ${d.getDate()} ${month} ${d.getFullYear()} -> [${dStr}]\n`;
  }

  return `╔══════════════════════════════════════════════════════════════════════════════╗
║ ⏰ ACCURATE SYSTEM DATE & TIME CONTEXT (ALWAYS CALCULATE RELATIVE TO THIS)  ║
╚══════════════════════════════════════════════════════════════════════════════╝
• Current System Timestamp: ${dt.iso}
• Current Date: ${dt.dateStr} (${dt.dayOfWeek})
• Current Time: ${dt.timeStr12h} (${dt.timeStr24h} / ${dt.timezone})
• Current Year: ${dt.year} | Current Month: ${dt.monthName} (Month ${dt.monthNum})

🗓️ 7-DAY CALENDAR LOOKUP TABLE:
${lookupTable}
CRITICAL ACADEMIC SCHEDULING RULES (MUST FOLLOW):
1. SPECIFIC DATES:
   - When the user mentions a specific calendar date (e.g. "20 sep", "20 september", "20th sep", "25 oct"):
     YOU MUST USE THE CURRENT YEAR (${dt.year}).
     Example: "20 sep" MUST ALWAYS resolve to "${dt.year}-09-20T23:59:59.000Z"!
     NEVER hallucinate another month like November or a random future date!
2. RELATIVE DAYS:
   - "aaj" / "aj" / "today" = ${dt.dateStr}
   - "kal" / "kl" / "kall" / "tomorrow" = ${dt.tomorrowDateStr} (${dt.tomorrowDayOfWeek})
   - "parso" / "prso" / "parson" / "tarso" / "day after tomorrow" = ${dt.parsoDateStr} (${dt.parsoDayOfWeek})
   - "X din baad" = Add X days to ${dt.dateStr}
   - Weekdays (e.g. "Monday", "somwar", "peer", "Friday", "jumma") = Target the EXACT next occurrence in the lookup table above!
3. DEFAULT ACADEMIC TIMES:
   - Assignments / Submissions / Projects default to 23:59:59 (11:59 PM end of day) unless an exact hour is stated.
   - Quizzes / Tests / Exams default to 10:00:00 (10:00 AM) or 17:00:00 (05:00 PM) if no time is stated.
   - If the student specifies a time (e.g. "5 baje", "5 bjy", "at 2pm", "11:59 pm", "shaam 6 bjy", "raat 10 bje"): adhere strictly to that hour & minute!

╔══════════════════════════════════════════════════════════════════════════════╗
║ 🇵🇰 ROMAN URDU & COLLOQUIAL ACADEMIC SCHEDULING GUIDE (FEW-SHOT EXAMPLES)     ║
╚══════════════════════════════════════════════════════════════════════════════╝
University students frequently write in casual Roman Urdu with typing shortcuts and typos:
• "kal" / "kl" / "kall" -> TOMORROW (${dt.tomorrowDateStr})
• "parso" / "prso" / "parson" / "tarso" -> DAY AFTER TOMORROW (${dt.parsoDateStr})
• "aaj" / "aj" / "aj hi" -> TODAY (${dt.dateStr})
• "ara" / "mara" / "mera" / "mra" / "meri" -> "my" (e.g. "ara quz" = "mera quiz" / my quiz)
• "quz" / "qz" / "quizz" / "kwiz" -> Quiz (Type: "quiz")
• "asignment" / "asigmnt" / "asigmet" / "kam" -> Assignment (Type: "assignment")
• "pepar" / "paper" / "imtihan" / "viva" / "testt" -> Exam / Test (Type: "exam" or "quiz")
• "bje" / "bjy" / "baje" / "bajay" -> O'clock
• "subah" / "subha" / "fajr" -> Morning (AM)
• "dupehr" / "dopahar" -> Afternoon (PM)
• "shaam" / "sham" -> Evening (PM)
• "raat" -> Night (PM)
• "remainder" / "reminder" / "rmdr" / "yaad" / "yad" -> Set calendar reminder

FEW-SHOT TRAINING EXAMPLES (INPUT -> EXACT ACTION & DEADLINE):
1. User: "kal ara quz ha" OR "kl mera quiz hai" OR "kal quiz hai"
   -> INTENT: Student has a quiz TOMORROW. "ara quz" is a typo for "mera quiz".
   -> ACTION: MUST immediately invoke schedule_academic_task! Do NOT ask the student for missing title or course!
   -> Tool Call: schedule_academic_task(title="Quiz", type="quiz", deadline="${dt.tomorrowDateStr}T10:00:00.000Z", priority="high")
   -> Confirmation text: Confirm quiz is scheduled for tomorrow (${dt.tomorrowDayOfWeek}, ${dt.tomorrowDateStr}) at 10:00 AM with 24h & 12h email reminders.

2. User: "kl mera quiz hai 5 bjy" OR "kal 5 baje mara quiz ha"
   -> ACTION: schedule_academic_task(title="Quiz", type="quiz", deadline="${dt.tomorrowDateStr}T17:00:00.000Z", priority="high")

3. User: "parso assignment submit krni ha" OR "prso assignment deadline h"
   -> ACTION: schedule_academic_task(title="Assignment Submission", type="assignment", deadline="${dt.parsoDateStr}T23:59:59.000Z", priority="high")

4. User: "aj shaam 6 bje test ha" OR "aaj sham 6 bjy test h"
   -> ACTION: schedule_academic_task(title="Test", type="quiz", deadline="${dt.dateStr}T18:00:00.000Z", priority="high")

5. User: "aj raat 11 bje assignment submit krna h"
   -> ACTION: schedule_academic_task(title="Assignment Submission", type="assignment", deadline="${dt.dateStr}T23:00:00.000Z", priority="high")

6. User: "somwar ko quiz hai" OR "peer ko quiz h 10 bje"
   -> ACTION: Schedule for the next Monday in the 7-day table at 10:00 AM.

7. User: "jumma ko viva hai 2 bje" OR "juma ko lab test 2 bjy"
   -> ACTION: Schedule for next Friday at 14:00:00 (2:00 PM).

8. User: "25 sep ko project submission hai"
   -> ACTION: schedule_academic_task(title="Project Submission", type="project", deadline="${dt.year}-09-25T23:59:59.000Z", priority="medium")

9. User: "2 din baad submission hai" OR "do din baad assignment submit krni"
   -> ACTION: Schedule for Current Date + 2 days at 23:59:59.

10. User: "kal subah 9 bje exam h"
    -> ACTION: schedule_academic_task(title="Exam", type="exam", deadline="${dt.tomorrowDateStr}T09:00:00.000Z", priority="high")`;
}

/**
 * Month mappings including abbreviations and Roman Urdu representations.
 */
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, janv: 0,
  feb: 1, february: 1, febr: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, sitambar: 8, sitamber: 8,
  oct: 9, october: 9, aktubar: 9,
  nov: 10, november: 10, nawambar: 10,
  dec: 11, december: 11, desambar: 11,
};

/**
 * Roman Urdu and Hindi number words to numbers.
 */
const ROMAN_URDU_NUMBERS: Record<string, number> = {
  ek: 1, aik: 1, pehli: 1, pehla: 1,
  do: 2, dusri: 2, dusra: 2,
  teen: 3, teesri: 3,
  char: 4, chaar: 4, chouthi: 4,
  panch: 5, paanch: 5,
  che: 6, chheh: 6, chath: 6,
  sat: 7, saat: 7,
  ath: 8, aath: 8,
  nau: 9, no: 9,
  dus: 10, das: 10,
  gyara: 11, gyarah: 11,
  bara: 12, barah: 12,
  tera: 13, terah: 13,
  choda: 14, chaudah: 14,
  pandra: 15, pandrah: 15,
  sola: 16, solah: 16,
  satra: 17, satrah: 17,
  athara: 18, atharah: 18,
  unnees: 19, unnis: 19,
  bees: 20, bis: 20,
  ikkees: 21, ikkis: 21,
  baees: 22, bais: 22,
  teis: 23, teees: 23,
  chobees: 24, chaubees: 24,
  pachees: 25, pachis: 25,
  chhabees: 26, chabbis: 26,
  sataees: 27, satais: 27,
  athaees: 28, athais: 28,
  untees: 29, untis: 29,
  tees: 30, tis: 30,
  iktees: 31, iktis: 31,
};

/**
 * Deep, multi-stage parser that extracts the exact academic deadline Date
 * from student prompts (English, Urdu, Roman Urdu, or LLM ISO output).
 * Resolves dates strictly relative to the system date & time.
 */
export function deeplyCalculateAcademicDeadline(rawDeadline?: string, userPrompt: string = '', baseDate: Date = new Date()): Date {
  const prompt = userPrompt.toLowerCase().trim();
  const sysInfo = getSystemDateTime(baseDate);

  let targetDate = new Date(baseDate);
  let explicitDateFound = false;

  // ─── STAGE 1: Explicit Calendar Date Extraction (e.g. "20 sep", "20 september", "20th sep", "sep 20") ───
  // Pattern A: "20 sep", "20th september", "20-sep", "20 september"
  const dateMonthRegex = /\b(\d{1,2})(?:st|nd|rd|th)?[\s\-_]*(?:of\s*)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|janwari|farwari|aprail|mai|joon|joolai|agast|sitambar|sitamber|aktubar|aktobar|nawambar|desambar|disambar)\b/i;
  const matchA = prompt.match(dateMonthRegex);

  // Pattern B: "sep 20", "september 20th", "september 20"
  const monthDateRegex = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|janwari|farwari|aprail|mai|joon|joolai|agast|sitambar|sitamber|aktubar|aktobar|nawambar|desambar|disambar)[\s\-_]*(\d{1,2})(?:st|nd|rd|th)?\b/i;
  const matchB = prompt.match(monthDateRegex);

  // Pattern C: Numeric format e.g. "20/09", "20-09-2026", "20-09"
  const numericDateRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
  const matchC = prompt.match(numericDateRegex);

  if (matchA) {
    const day = parseInt(matchA[1], 10);
    const monthKey = matchA[2].toLowerCase();
    const monthIndex = MONTH_MAP[monthKey];

    if (day >= 1 && day <= 31 && monthIndex !== undefined) {
      let year = sysInfo.year;
      // If month has already passed in current year by more than 2 months, assume next year
      if (monthIndex < sysInfo.monthNum - 3) {
        year += 1;
      }
      targetDate = new Date(year, monthIndex, day);
      explicitDateFound = true;
    }
  } else if (matchB) {
    const monthKey = matchB[1].toLowerCase();
    const day = parseInt(matchB[2], 10);
    const monthIndex = MONTH_MAP[monthKey];

    if (day >= 1 && day <= 31 && monthIndex !== undefined) {
      let year = sysInfo.year;
      if (monthIndex < sysInfo.monthNum - 3) {
        year += 1;
      }
      targetDate = new Date(year, monthIndex, day);
      explicitDateFound = true;
    }
  } else if (matchC) {
    const p1 = parseInt(matchC[1], 10);
    const p2 = parseInt(matchC[2], 10);
    let year = matchC[3] ? parseInt(matchC[3], 10) : sysInfo.year;
    if (year < 100) year += 2000;

    // Typically day/month in Pakistan/UK format: DD/MM
    let day = p1;
    let monthIndex = p2 - 1;
    if (p1 <= 12 && p2 > 12) {
      // MM/DD format
      day = p2;
      monthIndex = p1 - 1;
    }

    if (day >= 1 && day <= 31 && monthIndex >= 0 && monthIndex <= 11) {
      targetDate = new Date(year, monthIndex, day);
      explicitDateFound = true;
    }
  }

  // Check Roman Urdu word numbers e.g. "bees sep", "ikkis september"
  if (!explicitDateFound) {
    for (const [word, num] of Object.entries(ROMAN_URDU_NUMBERS)) {
      const romanWordRegex = new RegExp(`\\b${word}\\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|sitambar|sitamber|aktubar|aktobar|nawambar|desambar)\\b`, 'i');
      const rMatch = prompt.match(romanWordRegex);
      if (rMatch) {
        const monthIndex = MONTH_MAP[rMatch[1].toLowerCase()];
        if (monthIndex !== undefined) {
          targetDate = new Date(sysInfo.year, monthIndex, num);
          explicitDateFound = true;
          break;
        }
      }
    }
  }

  // ─── STAGE 2: Relative Dates ("kal", "kl", "parso", "prso", "aj", "aaj", "5 din baad", "next Friday") ───
  if (!explicitDateFound) {
    // Relative days e.g. "5 din baad", "3 days later", "do din baad", "teen din baad"
    const relativeDaysMatch =
      prompt.match(/\b(\d+|ek|aik|do|teen|char|chaar|panch|paanch|che|chheh|sat|saat|ath|aath|nau|no|dus|das)\s*(?:din|days?)\s*(?:baad|bad|ke baad|ky bad|k bad|kay bad|later|after)\b/i) ||
      prompt.match(/\b(?:after|in)\s*(\d+|ek|aik|do|teen|char|chaar|panch|paanch|che|chheh|sat|saat|ath|aath|nau|no|dus|das)\s*(?:din|days?)\b/i);

    if (relativeDaysMatch) {
      const token = relativeDaysMatch[1].toLowerCase();
      const numFromWord = ROMAN_URDU_NUMBERS[token];
      const days = !isNaN(parseInt(token, 10)) ? parseInt(token, 10) : numFromWord || 1;
      if (days > 0) {
        targetDate = new Date(baseDate);
        targetDate.setDate(targetDate.getDate() + days);
        explicitDateFound = true;
      }
    } else if (/\b(?:parso|prso|parson|tarso|day after tomorrow)\b/i.test(prompt)) {
      // Parso / Day after tomorrow (+2 days)
      targetDate = new Date(baseDate);
      targetDate.setDate(targetDate.getDate() + 2);
      explicitDateFound = true;
    } else if (/\b(?:kal|kl|kall|tomorrow)\b/i.test(prompt)) {
      // Kal / Kl / Tomorrow (+1 day)
      targetDate = new Date(baseDate);
      targetDate.setDate(targetDate.getDate() + 1);
      explicitDateFound = true;
    } else if (/\b(?:aaj|aj|aaj\s*hi|aj\s*hi|today|tonight)\b/i.test(prompt)) {
      // Aaj / Aj / Today
      targetDate = new Date(baseDate);
      explicitDateFound = true;
    } else {
      // Weekdays in English & Roman Urdu
      const weekdays: Record<string, number> = {
        sunday: 0, sun: 0, itwar: 0, aitwar: 0,
        monday: 1, mon: 1, somwar: 1, peer: 1,
        tuesday: 2, tue: 2, tues: 2, mangal: 2,
        wednesday: 3, wed: 3, web: 3, budh: 3, budhwar: 3,
        thursday: 4, thu: 4, thur: 4, thurs: 4, jummarat: 4, jumerat: 4, jumeraat: 4,
        friday: 5, fri: 5, jumma: 5, juma: 5, sukarwar: 5,
        saturday: 6, sat: 6, hafta: 6, sanichar: 6,
      };

      for (const [dayName, targetDayNum] of Object.entries(weekdays)) {
        const dayRegex = new RegExp(`\\b${dayName}\\b`, 'i');
        if (dayRegex.test(prompt)) {
          targetDate = new Date(baseDate);
          const currentDayNum = targetDate.getDay();
          let diff = targetDayNum - currentDayNum;
          if (diff <= 0) diff += 7;
          targetDate.setDate(targetDate.getDate() + diff);
          explicitDateFound = true;
          break;
        }
      }
    }
  }

  // ─── STAGE 3: If no date in user text, check LLM rawDeadline ───
  if (!explicitDateFound && rawDeadline && !isNaN(new Date(rawDeadline).getTime())) {
    const rawDateObj = new Date(rawDeadline);
    // Use rawDeadline if it's within a reasonable academic window (not > 6 months away unless explicit)
    const diffMonths = (rawDateObj.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (diffMonths >= -0.1 && diffMonths <= 6) {
      targetDate = new Date(rawDateObj);
      explicitDateFound = true;
    }
  }

  // Fallback: tomorrow if nothing was detected at all
  if (!explicitDateFound) {
    targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // ─── STAGE 4: Time of Day Extraction ───
  const isExplicitAM = /\b(?:subah|subha|fajr|fajar|am|morning)\b/i.test(prompt);
  const isExplicitPM = /\b(?:shaam|sham|raat|dopahar|dupehr|pm|evening|night|afternoon)\b/i.test(prompt);

  // Time patterns: "5 bjy", "5 baje", "11:59 pm", "at 10"
  const timeWithWord = prompt.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(bjy|baje|bje|bajay|pm|am|o'?clock)\b/i);
  const timeWithColon = prompt.match(/\b(\d{1,2}):(\d{2})(?:\s*(pm|am))?\b/i);
  const timeWithAt = prompt.match(/\bat\s*(\d{1,2})(?:\s*(pm|am))?\b/i);
  const timeMatch = timeWithWord || timeWithColon || timeWithAt;

  const isAssignment = /\b(?:assignment|asignment|asigmnt|asigmet|submission|project|report|homework|kam)\b/i.test(prompt);
  const isQuizOrExam = /\b(?:quiz|quz|qz|quizz|exam|paper|pepar|test|viva|midterm|final)\b/i.test(prompt);

  // Default to 11:59:59 PM for assignments, 10:00 AM for quizzes/exams, 17:00:00 (5 PM) for other general tasks
  let hour = isAssignment ? 23 : isQuizOrExam ? 10 : 17;
  let minute = isAssignment ? 59 : 0;
  let second = isAssignment ? 59 : 0;

  if (timeMatch) {
    const rawH = parseInt(timeMatch[1], 10);
    const rawM = timeMatch[2] && !isNaN(parseInt(timeMatch[2], 10)) ? parseInt(timeMatch[2], 10) : 0;

    if (rawH >= 1 && rawH <= 24) {
      hour = rawH;
      minute = rawM;
      second = 0;

      const indicator = (timeMatch[3] || '').toLowerCase();
      if (indicator === 'pm' || isExplicitPM) {
        if (hour < 12) hour += 12;
      } else if (indicator === 'am' || isExplicitAM) {
        if (hour === 12) hour = 0;
      } else {
        // Natural context heuristics for conversational Roman Urdu (e.g. "5 baje" -> 5:00 PM)
        if (hour >= 1 && hour <= 6) {
          hour += 12; // 1-6 without AM specified -> PM
        }
      }
    }
  } else if (isExplicitPM) {
    if (/\b(?:shaam|sham)\b/i.test(prompt)) {
      hour = 18; // 6 PM
    } else if (/\b(?:raat)\b/i.test(prompt)) {
      hour = 21; // 9 PM
    } else if (/\b(?:dopahar|dupehr)\b/i.test(prompt)) {
      hour = 14; // 2 PM
    }
  } else if (isExplicitAM) {
    hour = 9; // 9 AM
  }

  targetDate.setHours(hour, minute, second, 0);
  return targetDate;
}
