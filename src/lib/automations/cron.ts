/**
 * Five-field cron ("minute hour day-of-month month day-of-week") evaluated in an IANA time zone.
 *
 * Supports `*`, lists (1,15), ranges (1-5), steps (*\/15, 9-17/2), month and weekday names (jan, mon), 7 as Sunday,
 * and the macros @hourly, @daily, @weekly, @monthly, @yearly. As in standard cron, when both day-of-month and
 * day-of-week are restricted a day matches either one.
 */

type Field = { values: Set<number>; restricted: boolean };
export type CronSpec = { minute: Field; hour: Field; dom: Field; month: Field; dow: Field };

const MACROS: Record<string, string> = {
  "@hourly": "0 * * * *",
  "@daily": "0 9 * * *",
  "@weekly": "0 9 * * 1",
  "@monthly": "0 9 1 * *",
  "@yearly": "0 9 1 1 *",
  "@annually": "0 9 1 1 *"
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseField(text: string, min: number, max: number, names?: string[]): Field {
  const values = new Set<number>();
  const value = (token: string) => {
    const lower = token.toLowerCase();
    const named = names?.indexOf(lower) ?? -1;
    const n = named >= 0 ? named + (names === MONTHS ? 1 : 0) : Number(token);
    if (!Number.isInteger(n)) throw new Error(`"${token}" is not a valid value`);
    return n;
  };
  for (const part of text.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) throw new Error(`"${part}" has an invalid step`);
    let start: number;
    let end: number;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");
      start = value(a);
      end = value(b);
    } else {
      start = value(rangePart);
      end = stepPart === undefined ? start : max;
    }
    if (start < min || end > max || start > end) throw new Error(`"${part}" is outside ${min}-${max}`);
    for (let n = start; n <= end; n += step) values.add(n);
  }
  return { values, restricted: text !== "*" };
}

export function parseCron(expression: string): CronSpec {
  const text = MACROS[expression.trim().toLowerCase()] ?? expression.trim();
  const parts = text.split(/\s+/);
  if (parts.length !== 5) throw new Error("A schedule needs five fields: minute hour day-of-month month day-of-week.");
  const dow = parseField(parts[4], 0, 7, DAYS);
  if (dow.values.has(7)) {
    dow.values.delete(7);
    dow.values.add(0);
  }
  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dom: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12, MONTHS),
    dow
  };
}

/** Null when the expression is valid, otherwise why not. */
export function cronError(expression: string): string | null {
  try {
    parseCron(expression);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Wall-clock parts of `date` in `timeZone`. */
function localParts(date: Date, timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short"
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: DAYS.indexOf(String(parts.weekday).toLowerCase().slice(0, 3))
  };
}

function dayMatches(spec: CronSpec, day: number, weekday: number): boolean {
  if (spec.dom.restricted && spec.dow.restricted) return spec.dom.values.has(day) || spec.dow.values.has(weekday);
  if (spec.dom.restricted) return spec.dom.values.has(day);
  if (spec.dow.restricted) return spec.dow.values.has(weekday);
  return true;
}

const MINUTE = 60_000;

/**
 * The first time strictly after `after` that matches, in `timeZone`. Walks forward by day, hour and minute,
 * reading the wall clock at each step, so DST changes are handled (a skipped local time does not fire; a repeated
 * one fires once). Null when nothing matches within five years (e.g. "0 0 31 2 *").
 */
export function nextRun(expression: string | CronSpec, after: Date, timeZone = "UTC"): Date | null {
  const spec = typeof expression === "string" ? parseCron(expression) : expression;
  let t = Math.floor(after.getTime() / MINUTE) * MINUTE + MINUTE;
  const limit = after.getTime() + 5 * 366 * 24 * 60 * MINUTE;
  while (t <= limit) {
    const local = localParts(new Date(t), timeZone);
    if (!spec.month.values.has(local.month) || !dayMatches(spec, local.day, local.weekday)) {
      // Toward the next local day: stop an hour short of midnight (a DST day can be 23 or 25 hours long), then
      // the hour steps below finish the walk.
      t += Math.max(60 - local.minute, 23 * 60 - (local.hour * 60 + local.minute)) * MINUTE;
      continue;
    }
    if (!spec.hour.values.has(local.hour)) {
      t += (60 - local.minute) * MINUTE; // next hour
      continue;
    }
    if (!spec.minute.values.has(local.minute)) {
      t += MINUTE;
      continue;
    }
    return new Date(t);
  }
  return null;
}

/** A short English description for the UI ("Every Monday at 09:00"); falls back to the expression. */
export function describeCron(expression: string): string {
  const text = MACROS[expression.trim().toLowerCase()] ?? expression.trim();
  const [minute, hour, dom, month, dow] = text.split(/\s+/);
  const at = /^\d+$/.test(minute) && /^\d+$/.test(hour) ? `at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}` : null;
  if (!at) return minute === "0" && hour === "*" && dom === "*" && month === "*" && dow === "*" ? "Every hour" : expression;
  if (dom === "*" && month === "*" && dow === "*") return `Every day ${at}`;
  if (dom === "*" && month === "*" && dow === "1-5") return `Weekdays ${at}`;
  if (dom === "*" && month === "*" && /^[0-7]$/.test(dow)) {
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return `Every ${names[Number(dow)]} ${at}`;
  }
  if (/^\d+$/.test(dom) && month === "*" && dow === "*") return `Monthly on day ${dom} ${at}`;
  return expression;
}
