import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { PDFParse } from "pdf-parse";

type Role = "admin" | "supervisor" | "user";

type MidweekSectionId =
  | "treasuresOfTheBible"
  | "applyYourselfToTheFieldMinistry"
  | "livingAsChristians";

type AssignmentMode = "user" | "manual";

type AssignmentType =
  | "treasures"
  | "bible-reading"
  | "discussion"
  | "ministry"
  | "living"
  | "song"
  | "other";

interface RequesterProfile {
  role: Role;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
}

interface MidweekParticipant {
  id: string;
  mode: AssignmentMode;
  userId?: string;
  displayName: string;
  roleLabel?: string;
  isAssistant?: boolean;
}

interface MidweekAssignment {
  id: string;
  sectionId: MidweekSectionId;
  order: number;
  title: string;
  durationMinutes?: number;
  theme?: string;
  notes?: string;
  assignmentType?: AssignmentType;
  participants: MidweekParticipant[];
}

interface MidweekSection {
  id: MidweekSectionId;
  title: string;
  order: number;
  items: MidweekAssignment[];
}

interface ParsedWeekMeeting {
  weekLabel: string;
  weekKey: string;
  title: string;
  bibleReading: string;
  openingSong?: string;
  closingSong?: string;
  startDate: Date;
  endDate: Date;
  sections: MidweekSection[];
}

interface ImportMidweekFromPdfPayload {
  congregationId?: unknown;
  pdfBase64?: unknown;
  fileName?: unknown;
}

const SECTION_TITLES: Record<MidweekSectionId, string> = {
  treasuresOfTheBible: "Tesoros de la Biblia",
  applyYourselfToTheFieldMinistry: "Seamos mejores maestros",
  livingAsChristians: "Nuestra vida cristiana",
};

const MONTH_INDEX: Record<string, number> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  SETIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

const WEEK_RANGE_DASH_REGEX = /\b(\d{1,2})\s*-\s*(\d{1,2})\s+DE\s+/g;
const WEEK_RANGE_TO_REGEX =
  /\b(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+DE\s+(20\d{2}))?\s+A\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+DE\s+(20\d{2}))?/g;
const MONTH_NAMES = Object.keys(MONTH_INDEX);
const MONTH_NAMES_SORTED = [...MONTH_NAMES].sort((a, b) => b.length - a.length);
const ASSIGNMENT_ITEM_REGEX =
  /(?<![:\d])\b((?:[1-9]|1[0-5]))\.\s+(.+?)\s*\((\d{1,2})\s*MIN(?:S?)?\.?\)/g;
const SONG_WITH_PRAYER_REGEX = /CANCION\s+(\d{1,3})\s+Y\s+ORACION/g;
const SONG_GENERIC_REGEX = /CANCION\s+(\d{1,3})/g;
const CLOCK_TIME_REGEX = /\b([01]?\d|2[0-3])[.](\d{2})\b/g;
const PRE_HEADER_ASSIGNMENTS_WINDOW = 1250;
const MAX_WEEK_ASSIGNMENT_NUMBER = 9;
const MINISTRY_TITLE_HINTS = [
  "EMPIECE CONVERSACIONES",
  "HAGA REVISITAS",
  "HAGA DISCIPULOS",
  "EXPLIQUE SUS CREENCIAS",
  "DISCURSO",
  "PREDICACION",
];

const sanitizeText = (value: string): string => {
  const shortWordStoplist = new Set([
    "a",
    "al",
    "de",
    "del",
    "el",
    "en",
    "la",
    "las",
    "lo",
    "los",
    "o",
    "u",
    "un",
    "una",
    "y",
  ]);

  const repairTitleWordSpacing = (text: string): string => {
    let repaired = text;
    let previous = "";

    while (previous !== repaired) {
      previous = repaired;

      repaired = repaired.replace(
        /\b([A-Za-z]{1,2})\s+([A-Za-z]{3,})\b/g,
        (_full, left: string, right: string) => {
          if (/\d/.test(left) || /\d/.test(right)) return `${left} ${right}`;
          if (shortWordStoplist.has(left.toLowerCase())) return `${left} ${right}`;
          return `${left}${right}`;
        }
      );

      repaired = repaired.replace(
        /\b([A-Za-z]{3,})\s+([A-Za-z]{1,2})\b/g,
        (_full, left: string, right: string) => {
          if (/\d/.test(left) || /\d/.test(right)) return `${left} ${right}`;
          if (shortWordStoplist.has(right.toLowerCase())) return `${left} ${right}`;
          return `${left}${right}`;
        }
      );
    }

    return repaired.replace(/\s+/g, " ").trim();
  };

  const compact = value
    .replace(/[´`¨^~]/g, "")
    .replace(/[^\w\s:.,;!?()\-\u00C0-\u017F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) return "";

  const words = compact.toLowerCase().split(" ");
  const titleWords = words.map((word) => {
    if (/\d/.test(word)) return word;
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
  });

  return repairTitleWordSpacing(titleWords.join(" "));
};

const normalizeForKey = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const compactLetters = (value: string): string =>
  normalizeForKey(value).replace(/[^A-Z]/g, "");

const resolveLeadingMonth = (value: string): string | null => {
  const compact = compactLetters(value);

  for (const monthName of MONTH_NAMES_SORTED) {
    if (compact.startsWith(monthName)) {
      return monthName;
    }
  }

  return null;
};

type ParsedWeekHeader = {
  index: number;
  rawWeekLabel: string;
};

const extractWeekHeaders = (normalizedText: string): ParsedWeekHeader[] => {
  const headers: ParsedWeekHeader[] = [];

  const pushHeader = (candidate: ParsedWeekHeader) => {
    const sameLabel = headers.find(
      (header) =>
        header.rawWeekLabel === candidate.rawWeekLabel &&
        Math.abs(header.index - candidate.index) <= 10
    );

    if (sameLabel) {
      return;
    }

    headers.push(candidate);
  };

  WEEK_RANGE_DASH_REGEX.lastIndex = 0;
  let dashMatch: RegExpExecArray | null;

  while ((dashMatch = WEEK_RANGE_DASH_REGEX.exec(normalizedText)) !== null) {
    const startDay = Number(dashMatch[1]);
    const endDay = Number(dashMatch[2]);

    const tail = normalizedText.slice(
      WEEK_RANGE_DASH_REGEX.lastIndex,
      WEEK_RANGE_DASH_REGEX.lastIndex + 140
    );
    const compactTail = compactLetters(tail);
    const firstMonth = resolveLeadingMonth(compactTail);

    if (!firstMonth) {
      continue;
    }

    let rawWeekLabel = `${startDay}-${endDay} DE ${firstMonth}`;
    const rest = compactTail.slice(firstMonth.length);

    if (rest.startsWith("Y")) {
      const secondMonth = resolveLeadingMonth(rest.slice(1));
      if (secondMonth) {
        rawWeekLabel = `${rawWeekLabel} Y ${secondMonth}`;
      }
    }

    pushHeader({
      index: dashMatch.index,
      rawWeekLabel,
    });
  }

  WEEK_RANGE_TO_REGEX.lastIndex = 0;
  let toMatch: RegExpExecArray | null;

  while ((toMatch = WEEK_RANGE_TO_REGEX.exec(normalizedText)) !== null) {
    const startDay = Number(toMatch[1]);
    const startMonth = resolveLeadingMonth(toMatch[2]) ?? toMatch[2];
    const endDay = Number(toMatch[4]);
    const endMonth = resolveLeadingMonth(toMatch[5]) ?? toMatch[5];

    let rawWeekLabel = `${startDay}-${endDay} DE ${startMonth}`;

    if (startMonth !== endMonth) {
      rawWeekLabel = `${rawWeekLabel} Y ${endMonth}`;
    }

    pushHeader({
      index: toMatch.index,
      rawWeekLabel,
    });
  }

  return headers.sort((left, right) => left.index - right.index);
};

const normalizePdfText = (text: string): string => {
  const shortWordStoplist = new Set([
    "A",
    "AL",
    "DE",
    "DEL",
    "EL",
    "EN",
    "LA",
    "LAS",
    "LO",
    "LOS",
    "O",
    "U",
    "UN",
    "UNA",
    "Y",
  ]);

  const repairBrokenWordSpacing = (value: string): string => {
    let repaired = value;
    let previous = "";

    while (previous !== repaired) {
      previous = repaired;

      repaired = repaired.replace(
        /\b([A-Z]{3,})\s+([A-Z]{1,3})\b/g,
        (_full, left: string, right: string) => {
          if (/\d/.test(left) || /\d/.test(right)) return `${left} ${right}`;
          if (shortWordStoplist.has(left) || shortWordStoplist.has(right)) {
            return `${left} ${right}`;
          }
          return `${left}${right}`;
        }
      );

      repaired = repaired.replace(
        /\b([A-Z]{1,2})\s+([A-Z]{3,})\b/g,
        (_full, left: string, right: string) => {
          if (/\d/.test(left) || /\d/.test(right)) return `${left} ${right}`;
          if (shortWordStoplist.has(left)) return `${left} ${right}`;
          return `${left}${right}`;
        }
      );
    }

    return repaired;
  };

  let normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  normalized = normalized.replace(/[´`¨^~]/g, " ");
  normalized = normalized.replace(/[\u0000-\u001F\u007F]/g, " ");
  normalized = normalized.replace(/(?:\/CR\s*){2,}/g, " ");
  normalized = normalized.replace(/\/CR/g, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();

  let previous = "";

  while (previous !== normalized) {
    previous = normalized;
    normalized = normalized.replace(/\b([A-Z])\s+([A-Z])\b/g, "$1$2");
    normalized = normalized.replace(/(\d)\s+(?=\d)/g, "$1");
    normalized = normalized.replace(/CANCION\s+(\d{3,4})\./g, (full, digits: string) => {
      const combined = Number(digits);
      if (!Number.isFinite(combined) || combined <= 151) return full;

      const splitCandidates = [2, 1];

      for (const assignmentDigits of splitCandidates) {
        if (digits.length <= assignmentDigits) continue;

        const songPart = digits.slice(0, -assignmentDigits);
        const assignmentPart = digits.slice(-assignmentDigits);

        const songNumber = Number(songPart);
        const assignmentNumber = Number(assignmentPart);

        if (
          Number.isFinite(songNumber) &&
          Number.isFinite(assignmentNumber) &&
          songNumber >= 1 &&
          songNumber <= 151 &&
          assignmentNumber >= 1 &&
          assignmentNumber <= 15
        ) {
          return `CANCION ${songNumber} ${assignmentNumber}.`;
        }
      }

      return full;
    });
    normalized = repairBrokenWordSpacing(normalized);
  }

  return normalized.replace(/\s+/g, " ").trim();
};

const parseWeekRange = (
  weekLabel: string,
  fallbackYear: number
): { startDate: Date; endDate: Date } => {
  const match = weekLabel.match(
    /^(\d{1,2})-(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+Y\s+([A-Z]+))?$/
  );

  if (!match) {
    const fallbackStart = new Date();
    fallbackStart.setHours(19, 30, 0, 0);

    return {
      startDate: fallbackStart,
      endDate: new Date(fallbackStart.getTime() + 105 * 60 * 1000),
    };
  }

  const startDay = Number(match[1]);
  const endDay = Number(match[2]);
  const startMonthName = match[3];
  const endMonthName = match[4];

  const startMonth = MONTH_INDEX[startMonthName] ?? new Date().getMonth() + 1;

  let endMonth = startMonth;
  if (endMonthName) {
    endMonth = MONTH_INDEX[endMonthName] ?? startMonth;
  } else if (endDay < startDay) {
    endMonth = startMonth === 12 ? 1 : startMonth + 1;
  }

  const startYear = fallbackYear;
  const endYear = startMonth === 12 && endMonth === 1 ? startYear + 1 : startYear;

  const startDate = new Date(startYear, startMonth - 1, startDay, 19, 30, 0, 0);

  const endDate = new Date(endYear, endMonth - 1, endDay, 21, 15, 0, 0);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    const fallbackStart = new Date();
    fallbackStart.setHours(19, 30, 0, 0);

    return {
      startDate: fallbackStart,
      endDate: new Date(fallbackStart.getTime() + 105 * 60 * 1000),
    };
  }

  return { startDate, endDate };
};

const inferAssignmentType = (
  sectionId: MidweekSectionId,
  title: string
): AssignmentType => {
  const upper = title.toUpperCase();

  if (upper.includes("LECTURA DE LA BIBLIA")) return "bible-reading";
  if (upper.includes("BUSQUEMOS PERLAS")) return "discussion";
  if (upper.includes("CANCION")) return "song";

  if (sectionId === "treasuresOfTheBible") return "treasures";
  if (sectionId === "applyYourselfToTheFieldMinistry") return "ministry";
  if (sectionId === "livingAsChristians") return "living";

  return "other";
};

type ParsedAssignmentMatch = {
  number: number;
  index: number;
  title: string;
  durationMinutes?: number;
};

type WeekAssignmentCandidate = ParsedAssignmentMatch & {
  source: "pre" | "post";
  distanceToHeader: number;
};

type WeekAssignmentsResolution = {
  assignments: WeekAssignmentCandidate[];
  livingStartNumber: number;
  livingMarkerIndex?: number;
};

const extractAssignmentMatches = (
  block: string,
  indexOffset = 0
): ParsedAssignmentMatch[] => {
  const matches: ParsedAssignmentMatch[] = [];

  ASSIGNMENT_ITEM_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ASSIGNMENT_ITEM_REGEX.exec(block)) !== null) {
    const number = Number(match[1]);
    if (!Number.isFinite(number)) continue;

    let rawTitle = match[2].replace(/\s+/g, " ").trim();
    if (!rawTitle) continue;

    const nestedAssignmentPattern = /\b(?:[1-9]|1[0-5])\.\s+/;
    if (nestedAssignmentPattern.test(rawTitle)) {
      rawTitle = rawTitle.split(nestedAssignmentPattern)[0]?.trim() ?? "";
    }

    if (!rawTitle || rawTitle.length < 3) continue;
    if (rawTitle.length > 140) continue;

    const cleanTitle = sanitizeText(rawTitle.replace(/\s*-\s*/g, "-"));
    if (!cleanTitle || cleanTitle.length < 3) continue;

    const minutes = Number(match[3]);

    matches.push({
      number,
      index: indexOffset + match.index,
      title: cleanTitle,
      durationMinutes: Number.isFinite(minutes) ? minutes : undefined,
    });
  }

  return matches.sort((left, right) => left.index - right.index);
};

const findClosestLivingMarkerIndex = (
  normalizedText: string,
  headerIndex: number,
  searchStart: number,
  searchEnd: number
): number | undefined => {
  let cursor = Math.max(0, searchStart);
  let closest: number | undefined;

  while (cursor <= searchEnd) {
    const next = normalizedText.indexOf("NUESTRA VIDA CRISTIANA", cursor);
    if (next < 0 || next > searchEnd) break;

    if (
      typeof closest !== "number" ||
      Math.abs(next - headerIndex) < Math.abs(closest - headerIndex)
    ) {
      closest = next;
    }

    cursor = next + 1;
  }

  return closest;
};

const isCongregationStudyTitle = (title: string): boolean => {
  const compact = normalizeForKey(title).replace(/[^A-Z]/g, "");
  return compact.includes("ESTUDIOBIBLICODELACONGREGACION");
};

const scoreAssignmentCandidate = (
  candidate: WeekAssignmentCandidate,
  number: number
): number => {
  let score = candidate.distanceToHeader;

  if (number === 1 && candidate.source === "pre") {
    score += 260;
  }

  if (number >= 2 && number <= 6 && candidate.source === "post") {
    score += 220;
  }

  if (number >= 7 && candidate.source === "pre") {
    score += 120;
  }

  const normalizedTitle = normalizeForKey(candidate.title);

  if (number === 9 && !isCongregationStudyTitle(candidate.title)) {
    score += 640;
  }

  if (number > 3 && normalizedTitle.includes("BUSQUEMOS PERLAS")) {
    score += 360;
  }

  if (number > 3 && normalizedTitle.includes("LECTURA DE LA BIBLIA")) {
    score += 320;
  }

  return score;
};

const pickAssignmentsByNumber = (
  candidates: WeekAssignmentCandidate[]
): Map<number, WeekAssignmentCandidate> => {
  const selected = new Map<number, WeekAssignmentCandidate>();

  for (let number = 1; number <= MAX_WEEK_ASSIGNMENT_NUMBER; number += 1) {
    const options = candidates.filter((candidate) => candidate.number === number);
    if (options.length === 0) continue;

    const sorted = [...options].sort((left, right) => {
      const scoreDiff =
        scoreAssignmentCandidate(left, number) - scoreAssignmentCandidate(right, number);
      if (scoreDiff !== 0) return scoreDiff;

      if (left.distanceToHeader !== right.distanceToHeader) {
        return left.distanceToHeader - right.distanceToHeader;
      }

      if (left.source !== right.source) {
        if (number >= 2 && number <= 6) {
          return left.source === "pre" ? -1 : 1;
        }
        return left.source === "post" ? -1 : 1;
      }

      return left.index - right.index;
    });

    selected.set(number, sorted[0]);
  }

  return selected;
};

const inferLivingStartNumber = (
  selectedByNumber: Map<number, WeekAssignmentCandidate>,
  livingMarkerIndex: number | undefined
): number => {
  const numberSeven = selectedByNumber.get(7);

  if (!numberSeven) {
    if (selectedByNumber.has(8)) return 8;
    if (selectedByNumber.has(9)) return 9;
    return 8;
  }

  if (typeof livingMarkerIndex === "number") {
    return numberSeven.index >= livingMarkerIndex ? 7 : 8;
  }

  const normalizedTitle = normalizeForKey(numberSeven.title);
  const looksLikeMinistry = MINISTRY_TITLE_HINTS.some((hint) =>
    normalizedTitle.includes(hint)
  );

  return looksLikeMinistry ? 8 : 7;
};

const resolveWeekAssignments = (
  normalizedText: string,
  headerIndex: number,
  nextHeaderIndex: number | undefined
): WeekAssignmentsResolution => {
  const preStart = Math.max(0, headerIndex - PRE_HEADER_ASSIGNMENTS_WINDOW);
  const postEnd = nextHeaderIndex ?? normalizedText.length;

  const preSlice = normalizedText.slice(preStart, headerIndex);
  const postSlice = normalizedText.slice(headerIndex, postEnd);

  const preCandidates = extractAssignmentMatches(preSlice, preStart).map((candidate) => ({
    ...candidate,
    source: "pre" as const,
    distanceToHeader: Math.max(0, headerIndex - candidate.index),
  }));

  const postCandidates = extractAssignmentMatches(postSlice, headerIndex).map((candidate) => ({
    ...candidate,
    source: "post" as const,
    distanceToHeader: Math.max(0, candidate.index - headerIndex),
  }));

  const allCandidates = [...preCandidates, ...postCandidates];
  const selectedByNumber = pickAssignmentsByNumber(allCandidates);

  const livingMarkerIndex = findClosestLivingMarkerIndex(
    normalizedText,
    headerIndex,
    preStart,
    postEnd
  );

  const livingStartNumber = inferLivingStartNumber(
    selectedByNumber,
    livingMarkerIndex
  );

  const assignments = Array.from(selectedByNumber.values()).sort((left, right) => {
    if (left.number !== right.number) return left.number - right.number;
    return left.index - right.index;
  });

  return {
    assignments,
    livingStartNumber,
    livingMarkerIndex,
  };
};

const resolveLivingSectionSong = (
  block: string,
  livingSectionIndex: number | undefined
): string | undefined => {
  const allSongs: Array<{ index: number; number: string }> = [];
  SONG_GENERIC_REGEX.lastIndex = 0;
  let songMatch: RegExpExecArray | null;

  while ((songMatch = SONG_GENERIC_REGEX.exec(block)) !== null) {
    if (!songMatch[1]) continue;
    allSongs.push({
      index: songMatch.index,
      number: songMatch[1],
    });
  }

  if (allSongs.length === 0) return undefined;

  if (typeof livingSectionIndex === "number" && livingSectionIndex >= 0) {
    const candidate = allSongs.find((song) => song.index > livingSectionIndex);
    if (candidate) return candidate.number;
  }

  return allSongs.length >= 2 ? allSongs[1].number : allSongs[0].number;
};

const buildSections = (
  weekKey: string,
  assignments: WeekAssignmentCandidate[],
  livingStartNumber: number,
  middleSongNumber: string | undefined
): MidweekSection[] => {
  const resolveSectionByNumber = (number: number): MidweekSectionId => {
    if (number <= 3) return "treasuresOfTheBible";
    if (number < livingStartNumber) return "applyYourselfToTheFieldMinistry";
    return "livingAsChristians";
  };

  const grouped: Record<MidweekSectionId, MidweekAssignment[]> = {
    treasuresOfTheBible: [],
    applyYourselfToTheFieldMinistry: [],
    livingAsChristians: [],
  };

  assignments.forEach((assignment) => {
    if (assignment.number < 1 || assignment.number > MAX_WEEK_ASSIGNMENT_NUMBER) {
      return;
    }

    if (assignment.number === 9 && !isCongregationStudyTitle(assignment.title)) {
      return;
    }

    const sectionId = resolveSectionByNumber(assignment.number);

    grouped[sectionId].push({
      id: `${sectionId}-${weekKey}-${assignment.number}`,
      sectionId,
      order: grouped[sectionId].length,
      title: assignment.title,
      durationMinutes: assignment.durationMinutes,
      theme: "",
      notes: "",
      assignmentType: inferAssignmentType(sectionId, assignment.title),
      participants: [],
    });
  });

  if (middleSongNumber) {
    grouped.livingAsChristians.unshift({
      id: `living-song-${weekKey}`,
      sectionId: "livingAsChristians",
      order: 0,
      title: `Cancion ${middleSongNumber}`,
      theme: "",
      notes: "",
      assignmentType: "song",
      participants: [],
    });
  }

  const normalizeOrder = (items: MidweekAssignment[]): MidweekAssignment[] =>
    items.map((item, index) => ({ ...item, order: index }));

  return [
    {
      id: "treasuresOfTheBible",
      title: SECTION_TITLES.treasuresOfTheBible,
      order: 0,
      items: normalizeOrder(grouped.treasuresOfTheBible),
    },
    {
      id: "applyYourselfToTheFieldMinistry",
      title: SECTION_TITLES.applyYourselfToTheFieldMinistry,
      order: 1,
      items: normalizeOrder(grouped.applyYourselfToTheFieldMinistry),
    },
    {
      id: "livingAsChristians",
      title: SECTION_TITLES.livingAsChristians,
      order: 2,
      items: normalizeOrder(grouped.livingAsChristians),
    },
  ];
};

const extractSongsWithPrayer = (block: string): string[] => {
  const songs: string[] = [];
  SONG_WITH_PRAYER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SONG_WITH_PRAYER_REGEX.exec(block)) !== null) {
    if (!match[1]) continue;
    songs.push(match[1]);
  }

  return songs;
};

const resolveMeetingTimes = (
  block: string,
  baseStartDate: Date,
  sections: MidweekSection[]
): { startDate: Date; endDate: Date } => {
  const times: Array<{ hour: number; minute: number }> = [];
  CLOCK_TIME_REGEX.lastIndex = 0;
  let clockMatch: RegExpExecArray | null;

  while ((clockMatch = CLOCK_TIME_REGEX.exec(block)) !== null) {
    const hour = Number(clockMatch[1]);
    const minute = Number(clockMatch[2]);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;
    if (minute > 59) continue;

    times.push({ hour, minute });
  }

  const startDate = new Date(baseStartDate);

  if (times.length > 0) {
    startDate.setHours(times[0].hour, times[0].minute, 0, 0);

    const last = times[times.length - 1];
    const endDateByClock = new Date(baseStartDate);
    endDateByClock.setHours(last.hour, last.minute, 0, 0);

    if (endDateByClock.getTime() > startDate.getTime()) {
      return { startDate, endDate: endDateByClock };
    }
  }

  const totalAssignmentsMinutes = sections.reduce((total, section) => {
    return (
      total +
      section.items.reduce((sectionTotal, assignment) => {
        return sectionTotal + (assignment.durationMinutes ?? 0);
      }, 0)
    );
  }, 0);

  const estimatedMinutes = Math.min(
    150,
    Math.max(95, totalAssignmentsMinutes + 8)
  );

  return {
    startDate,
    endDate: new Date(startDate.getTime() + estimatedMinutes * 60 * 1000),
  };
};

const extractBibleReadingFromWeekBlock = (weekBlock: string): string => {
  const songIndex = weekBlock.indexOf("CANCION");

  if (songIndex > 0) {
    const headerChunk = weekBlock.slice(0, songIndex);
    const withoutRange = headerChunk.replace(
      /^\s*\d{1,2}\s*-\s*\d{1,2}\s+DE\s+[A-Z\s]+?(?:\s+Y\s+[A-Z\s]+)?\s+/,
      ""
    );

    const cleaned = sanitizeText(withoutRange.replace(/\s*-\s*/g, "-"));
    if (cleaned.length >= 3) {
      return cleaned;
    }
  }

  const fallbackMatch =
    weekBlock.match(
      /\b\d{1,2}\s*(?:-\s*\d{1,2}|DE\s+[A-Z]+(?:\s+DE\s+20\d{2})?\s+A\s+\d{1,2})\s+DE\s+[A-Z]+(?:\s+Y\s+[A-Z]+)?\s+([A-Z0-9 ,.-]{4,90})\s+CANCION\s+\d{1,3}/
    ) ??
    weekBlock.match(/\/CAN\s*([A-Z0-9 ,.-]+?)\s*\/SUBCANCION/) ??
    weekBlock.match(
      /\bDE\s+[A-Z]+(?:\s+Y\s+[A-Z]+)?\s+([A-Z0-9 ,.-]{4,80})\s+CANCION\s+\d{1,3}/
    );

  return sanitizeText((fallbackMatch?.[1] ?? "").replace(/\s*-\s*/g, "-"));
};

const parseMidweekWeeks = (rawText: string): ParsedWeekMeeting[] => {
  const normalizedText = normalizePdfText(rawText);
  const yearMatch = normalizedText.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

  const headers = extractWeekHeaders(normalizedText);

  if (headers.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "No se detectaron semanas en el PDF."
    );
  }

  const weeks: ParsedWeekMeeting[] = [];

  for (let index = 0; index < headers.length; index += 1) {
    const current = headers[index];
    const next = headers[index + 1];

    const blockStart = current.index;
    const blockEnd = next?.index ?? normalizedText.length;

    const block = normalizedText.slice(blockStart, blockEnd);

    const rawWeekLabel = current.rawWeekLabel
      .replace(/\s*\-\s*/g, "-")
      .replace(/\s+/g, " ")
      .trim();

    const weekLabel =
      rawWeekLabel.charAt(0) + rawWeekLabel.slice(1).toLowerCase();

    const weekKey = normalizeForKey(rawWeekLabel);
    const bibleReading = extractBibleReadingFromWeekBlock(block);

    const songsWithPrayer = extractSongsWithPrayer(block);

    const openingSongNumber = songsWithPrayer[0];
    const closingSongNumber =
      songsWithPrayer.length > 1
        ? songsWithPrayer[songsWithPrayer.length - 1]
        : undefined;

    const weekAssignments = resolveWeekAssignments(
      normalizedText,
      current.index,
      next?.index
    );

    const songSearchStart = Math.max(
      0,
      current.index - PRE_HEADER_ASSIGNMENTS_WINDOW
    );
    const songSearchBlock = normalizedText.slice(songSearchStart, blockEnd);

    const livingMarkerInSongBlock =
      typeof weekAssignments.livingMarkerIndex === "number" &&
      weekAssignments.livingMarkerIndex >= songSearchStart
        ? weekAssignments.livingMarkerIndex - songSearchStart
        : undefined;

    const middleSongNumber = resolveLivingSectionSong(
      songSearchBlock,
      livingMarkerInSongBlock
    );

    const sections = buildSections(
      weekKey,
      weekAssignments.assignments,
      weekAssignments.livingStartNumber,
      middleSongNumber
    );

    const parsedRange = parseWeekRange(rawWeekLabel, year);
    const parsedTimes = resolveMeetingTimes(
      block,
      parsedRange.startDate,
      sections
    );

    weeks.push({
      weekLabel,
      weekKey,
      title: `Reunion entre semana ${weekLabel.toLowerCase()}`,
      bibleReading,
      openingSong: openingSongNumber
        ? `Cancion ${openingSongNumber}`
        : undefined,
      closingSong: closingSongNumber
        ? `Cancion ${closingSongNumber}`
        : undefined,
      startDate: parsedTimes.startDate,
      endDate: parsedTimes.endDate,
      sections,
    });
  }

  return weeks;
};

export const __parseMidweekWeeksForTesting = parseMidweekWeeks;
export const __normalizePdfTextForTesting = normalizePdfText;
export const __extractWeekHeadersForTesting = extractWeekHeaders;

const normalizeWeekKey = (value: string): string =>
  normalizeForKey(value.replace(/\s*\-\s*/g, "-"));

const getExistingSections = (value: unknown): MidweekSection[] => {
  if (!Array.isArray(value)) return [];

  return value.filter((section): section is MidweekSection => {
    return (
      typeof section === "object" &&
      section !== null &&
      "id" in section &&
      "items" in section
    );
  });
};

const mergeParticipants = (
  existingSections: MidweekSection[],
  nextSections: MidweekSection[]
): MidweekSection[] => {
  const byKey = new Map<string, MidweekParticipant[]>();

  existingSections.forEach((section) => {
    section.items.forEach((assignment) => {
      const key = `${section.id}:${normalizeWeekKey(assignment.title)}`;
      byKey.set(key, assignment.participants ?? []);
    });
  });

  return nextSections.map((section) => ({
    ...section,
    items: section.items.map((assignment) => {
      const key = `${section.id}:${normalizeWeekKey(assignment.title)}`;
      const participants = byKey.get(key) ?? assignment.participants;

      return {
        ...assignment,
        participants,
      };
    }),
  }));
};

const getRequesterProfile = async (uid: string): Promise<RequesterProfile> => {
  const db = getFirestore();
  const snap = await db.collection("users").doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError(
      "permission-denied",
      "No existe perfil del usuario autenticado."
    );
  }

  const data = snap.data();

  if (!data?.isActive) {
    throw new HttpsError(
      "permission-denied",
      "El usuario autenticado esta inactivo."
    );
  }

  return data as RequesterProfile;
};

const assertManager = (profile: RequesterProfile): void => {
  if (profile.role !== "admin" && profile.role !== "supervisor") {
    throw new HttpsError(
      "permission-denied",
      "Solo admin o supervisor pueden importar reuniones."
    );
  }
};

export const importMidweekMeetingsFromPdf = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
    }

    const payload = (request.data ?? {}) as ImportMidweekFromPdfPayload;

    if (
      typeof payload.congregationId !== "string" ||
      typeof payload.pdfBase64 !== "string"
    ) {
      throw new HttpsError("invalid-argument", "Payload invalido.");
    }

    if (payload.pdfBase64.trim().length === 0) {
      throw new HttpsError("invalid-argument", "El PDF esta vacio.");
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertManager(requester);

    if (payload.congregationId !== requester.congregationId) {
      throw new HttpsError(
        "permission-denied",
        "No puedes importar reuniones para otra congregacion."
      );
    }

    const pdfBuffer = Buffer.from(payload.pdfBase64, "base64");

    if (pdfBuffer.length === 0) {
      throw new HttpsError("invalid-argument", "No se pudo leer el archivo PDF.");
    }

    if (pdfBuffer.length > 12 * 1024 * 1024) {
      throw new HttpsError(
        "invalid-argument",
        "El PDF es demasiado grande. Limite: 12 MB."
      );
    }

    const parser = new PDFParse({ data: pdfBuffer });

    let extractedText = "";

    try {
      const parsed = await parser.getText();
      extractedText = parsed.text ?? "";
    } finally {
      await parser.destroy();
    }

    if (extractedText.trim().length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "No se pudo extraer texto del PDF."
      );
    }

    const parsedWeeks = parseMidweekWeeks(extractedText);

    if (parsedWeeks.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "No se encontraron semanas de reunion en el PDF."
      );
    }

    const db = getFirestore();
    const meetingsRef = db
      .collection("congregations")
      .doc(payload.congregationId)
      .collection("meetings");

    const existingSnap = await meetingsRef
      .where("meetingCategory", "==", "midweek")
      .get();

    const existingByWeek = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();

    existingSnap.docs.forEach((docSnap) => {
      const weekLabel = docSnap.get("weekLabel");
      if (typeof weekLabel === "string" && weekLabel.trim().length > 0) {
        existingByWeek.set(normalizeWeekKey(weekLabel), docSnap);
      }
    });

    let createdCount = 0;
    let updatedCount = 0;

    for (const week of parsedWeeks) {
      const existing = existingByWeek.get(week.weekKey);
      const organizerName =
        requester.displayName ?? requester.email ?? "Usuario";

      if (existing) {
        const existingSections = getExistingSections(existing.get("midweekSections"));
        const mergedSections = mergeParticipants(existingSections, week.sections);

        await existing.ref.update({
          title: week.title,
          description: `Importada desde ${String(payload.fileName ?? "PDF")}`,
          weekLabel: week.weekLabel,
          bibleReading: week.bibleReading,
          startDate: Timestamp.fromDate(week.startDate),
          endDate: Timestamp.fromDate(week.endDate),
          status: "pending",
          openingSong: week.openingSong ?? null,
          closingSong: week.closingSong ?? null,
          midweekSections: mergedSections,
          updatedBy: request.auth.uid,
          updatedAt: FieldValue.serverTimestamp(),
        });

        updatedCount += 1;
        continue;
      }

      await meetingsRef.add({
        meetingCategory: "midweek",
        type: "midweek",
        title: week.title,
        description: `Importada desde ${String(payload.fileName ?? "PDF")}`,
        weekLabel: week.weekLabel,
        bibleReading: week.bibleReading,
        startDate: Timestamp.fromDate(week.startDate),
        endDate: Timestamp.fromDate(week.endDate),
        status: "pending",
        location: null,
        meetingUrl: null,
        notes: null,
        openingSong: week.openingSong ?? null,
        openingPrayer: null,
        closingSong: week.closingSong ?? null,
        closingPrayer: null,
        chairman: null,
        midweekSections: week.sections,
        organizerUid: request.auth.uid,
        organizerName,
        attendees: request.auth.uid ? [request.auth.uid] : [],
        attendeeNames: [],
        createdBy: request.auth.uid,
        updatedBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      createdCount += 1;
    }

    return {
      ok: true,
      createdCount,
      updatedCount,
      totalWeeks: parsedWeeks.length,
      importedWeekLabels: parsedWeeks.map((week) => week.weekLabel),
    };
  }
);
