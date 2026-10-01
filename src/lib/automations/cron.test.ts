import { describe, expect, it } from "vitest";
import { cronError, describeCron, nextRun, parseCron } from "./cron";

const at = (iso: string) => new Date(iso);

describe("parseCron", () => {
  it("reads lists, ranges, steps, names and macros", () => {
    const spec = parseCron("*/15 9-17/4 1,15 jan-mar mon-fri");
    expect([...spec.minute.values]).toEqual([0, 15, 30, 45]);
    expect([...spec.hour.values]).toEqual([9, 13, 17]);
    expect([...spec.dom.values]).toEqual([1, 15]);
    expect([...spec.month.values]).toEqual([1, 2, 3]);
    expect([...spec.dow.values]).toEqual([1, 2, 3, 4, 5]);
    expect([...parseCron("0 0 * * 7").dow.values]).toEqual([0]);
    expect(parseCron("@weekly").dow.values.has(1)).toBe(true);
  });

  it("explains what is wrong with a bad expression", () => {
    expect(cronError("0 9 * *")).toMatch(/five fields/);
    expect(cronError("61 9 * * *")).toMatch(/outside 0-59/);
    expect(cronError("0 9 * * funday")).toMatch(/not a valid value/);
    expect(cronError("*/0 * * * *")).toMatch(/invalid step/);
    expect(cronError("0 9 * * 1")).toBeNull();
  });
});

describe("nextRun", () => {
  it("finds the next matching minute in UTC", () => {
    expect(nextRun("0 9 * * *", at("2026-10-01T08:59:30Z"))).toEqual(at("2026-10-01T09:00:00Z"));
    expect(nextRun("0 9 * * *", at("2026-10-01T09:00:00Z"))).toEqual(at("2026-10-02T09:00:00Z")); // strictly after
    expect(nextRun("*/15 * * * *", at("2026-10-01T10:07:00Z"))).toEqual(at("2026-10-01T10:15:00Z"));
    expect(nextRun("0 9 * * 1", at("2026-10-01T12:00:00Z"))).toEqual(at("2026-10-05T09:00:00Z")); // Thu -> Mon
    expect(nextRun("0 0 1 * *", at("2026-10-15T00:00:00Z"))).toEqual(at("2026-11-01T00:00:00Z"));
  });

  it("reads the schedule in the given time zone", () => {
    // 09:00 in Kolkata is 03:30 UTC.
    expect(nextRun("0 9 * * *", at("2026-10-01T00:00:00Z"), "Asia/Kolkata")).toEqual(at("2026-10-01T03:30:00Z"));
    // 09:00 in New York during EDT is 13:00 UTC, and 14:00 UTC after the clocks go back.
    expect(nextRun("0 9 * * *", at("2026-10-31T14:00:00Z"), "America/New_York")).toEqual(at("2026-11-01T14:00:00Z"));
  });

  it("handles DST: a skipped local time does not fire, the next day still does", () => {
    // 2026-03-08 02:30 does not exist in New York.
    expect(nextRun("30 2 * * *", at("2026-03-08T00:00:00Z"), "America/New_York")).toEqual(at("2026-03-09T06:30:00Z"));
    // Midnight right after a 23-hour day is not skipped.
    expect(nextRun("0 0 * * *", at("2026-03-08T12:00:00Z"), "America/New_York")).toEqual(at("2026-03-09T04:00:00Z"));
  });

  it("uses OR when both day fields are restricted, and gives up on impossible dates", () => {
    // The 13th or any Friday: from Thu 2026-10-01, Fri 10-02 comes first.
    expect(nextRun("0 12 13 * 5", at("2026-10-01T00:00:00Z"))).toEqual(at("2026-10-02T12:00:00Z"));
    expect(nextRun("0 0 31 2 *", at("2026-01-01T00:00:00Z"))).toBeNull();
  });
});

describe("describeCron", () => {
  it("names common schedules", () => {
    expect(describeCron("0 9 * * 1")).toBe("Every Monday at 09:00");
    expect(describeCron("30 8 * * 1-5")).toBe("Weekdays at 08:30");
    expect(describeCron("@daily")).toBe("Every day at 09:00");
    expect(describeCron("0 9 1 * *")).toBe("Monthly on day 1 at 09:00");
    expect(describeCron("*/5 * * * *")).toBe("*/5 * * * *");
  });
});
