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

const WEEK_RANGE_REGEX = /\b(\d{1,2}\s*-\s*\d{1,2})\s+DE\s+/g;
const MONTH_NAMES = Object.keys(MONTH_INDEX);
const MONTH_NAMES_SORTED = [...MONTH_NAMES].sort((a, b) => b.length - a.length);

const sanitizeText = (value: string): string => {
  const compact = value.replace(/\s+/g, " ").trim();

  if (!compact) return "";

  const words = compact.toLowerCase().split(" ");
  const titleWords = words.map((word) => {
    if (/\d/.test(word)) return word;
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
  });

  return titleWords.join(" ");
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
  let match: RegExpExecArray | null;

  while ((match = WEEK_RANGE_REGEX.exec(normalizedText)) !== null) {
    const range = match[1].replace(/\s*-\s*/g, "-").trim();
    const tail = normalizedText.slice(WEEK_RANGE_REGEX.lastIndex, WEEK_RANGE_REGEX.lastIndex + 120);
    const compactTail = compactLetters(tail);

    const firstMonth = resolveLeadingMonth(compactTail);

    if (!firstMonth) {
      continue;
    }

    let rawWeekLabel = `${range} DE ${firstMonth}`;
    const rest = compactTail.slice(firstMonth.length);

    if (rest.startsWith("Y")) {
      const secondMonth = resolveLeadingMonth(rest.slice(1));
      if (secondMonth) {
        rawWeekLabel = `${rawWeekLabel} Y ${secondMonth}`;
      }
    }

    if (headers.length === 0 || headers[headers.length - 1].rawWeekLabel !== rawWeekLabel) {
      headers.push({
        index: match.index,
        rawWeekLabel,
      });
    }
  }

  return headers;
};

const normalizePdfText = (text: string): string => {
  let normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  normalized = normalized.replace(/[\u0000-\u001F\u007F]/g, " ");
  normalized = normalized.replace(/(?:\/CR\s*){2,}/g, " ");
  normalized = normalized.replace(/\/CR/g, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();

  let previous = "";

  while (previous !== normalized) {
    previous = normalized;
    normalized = normalized.replace(/\b([A-Z])\s+([A-Z])\b/g, "$1$2");
    normalized = normalized.replace(/(\d)\s+(?=\d)/g, "$1");
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

const parseAssignmentsFromChunk = (
  chunk: string,
  sectionId: MidweekSectionId,
  weekSeed: string
): MidweekAssignment[] => {
  const assignments: MidweekAssignment[] = [];
  const itemRegex = /(\d+)\.\s+(.+?)\s*\((\d{1,2})\s*MINS?\.?\)/g;

  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(chunk)) !== null) {
    const rawTitle = match[2].replace(/\s+/g, " ").trim();
    if (!rawTitle) continue;

    const cleanTitle = sanitizeText(rawTitle.replace(/\s*-\s*/g, "-"));
    const minutes = Number(match[3]);

    assignments.push({
      id: `${sectionId}-${weekSeed}-${assignments.length + 1}`,
      sectionId,
      order: assignments.length,
      title: cleanTitle,
      durationMinutes: Number.isFinite(minutes) ? minutes : undefined,
      theme: "",
      notes: "",
      assignmentType: inferAssignmentType(sectionId, cleanTitle),
      participants: [],
    });
  }

  return assignments;
};

const buildSections = (
  weekKey: string,
  block: string
): MidweekSection[] => {
  const treasuresIndex = block.indexOf("TESOROS DE LA BIBLIA");
  const ministryIndex = block.indexOf("SEAMOS MEJORES MAESTROS");
  const livingIndex = block.indexOf("NUESTRA VIDA CRISTIANA");

  const treasuresChunk =
    treasuresIndex >= 0
      ? block.slice(
          treasuresIndex,
          ministryIndex > treasuresIndex ? ministryIndex : block.length
      )
      : "";

  const ministryChunk =
    ministryIndex >= 0
      ? block.slice(
          ministryIndex,
          livingIndex > ministryIndex ? livingIndex : block.length
      )
      : "";

  const livingChunk =
    livingIndex >= 0 ? block.slice(livingIndex, block.length) : "";

  const treasuresItems = parseAssignmentsFromChunk(
    treasuresChunk,
    "treasuresOfTheBible",
    weekKey
  );

  const ministryItems = parseAssignmentsFromChunk(
    ministryChunk,
    "applyYourselfToTheFieldMinistry",
    weekKey
  );

  const livingItems = parseAssignmentsFromChunk(
    livingChunk,
    "livingAsChristians",
    weekKey
  );

  const middleSongMatch =
    livingChunk.match(/\/SUBCANCION\s+(\d{1,3})/) ??
    block.match(/NUESTRA VIDA CRISTIANA\s*\/SUBCANCION\s+(\d{1,3})/);

  if (middleSongMatch?.[1]) {
    livingItems.unshift({
      id: `living-song-${weekKey}`,
      sectionId: "livingAsChristians",
      order: 0,
      title: `Cancion ${middleSongMatch[1]}`,
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
      items: normalizeOrder(treasuresItems),
    },
    {
      id: "applyYourselfToTheFieldMinistry",
      title: SECTION_TITLES.applyYourselfToTheFieldMinistry,
      order: 1,
      items: normalizeOrder(ministryItems),
    },
    {
      id: "livingAsChristians",
      title: SECTION_TITLES.livingAsChristians,
      order: 2,
      items: normalizeOrder(livingItems),
    },
  ];
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

    const bibleReadingMatch =
      block.match(/\/CAN\s*([A-Z0-9 ,.-]+?)\s*\/SUBCANCION/) ??
      block.match(/\bDE\s+[A-Z]+(?:\s+Y\s+[A-Z]+)?\s+([A-Z0-9 ,.-]{4,70})\s+CANCION\s+\d+/);

    const bibleReading = sanitizeText(
      (bibleReadingMatch?.[1] ?? "").replace(/\s*-\s*/g, "-")
    );

    const openingSongNumber =
      block.match(/\/SUBCANCION\s+(\d{1,3})\s+Y\s+ORACION/)?.[1];

    const closingSongNumber =
      block.match(/\/CAN\/SUBCANCION\s+(\d{1,3})\s+Y\s+ORACION/)?.[1];

    const sections = buildSections(weekKey, block);

    const parsedRange = parseWeekRange(rawWeekLabel, year);

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
      startDate: parsedRange.startDate,
      endDate: parsedRange.endDate,
      sections,
    });
  }

  return weeks;
};

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
