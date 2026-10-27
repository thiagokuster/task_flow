import { describe, expect, it } from "vitest";

import {
  dateInputFromDueAt,
  dueAtFromDateInput,
  formatDueDate,
  isDateInputPast,
  todayDateInput,
} from "@/lib/dates";

describe("due date helpers", () => {
  it("rejects empty or invalid values", () => {
    expect(dueAtFromDateInput("")).toBeNull();
    expect(dueAtFromDateInput("26-10-2026")).toBeNull();
    expect(dueAtFromDateInput("2026-13-01")).toBeNull();
  });

  it("round-trips a calendar date in the local timezone", () => {
    const iso = dueAtFromDateInput("2026-10-26");
    expect(iso).toBeTruthy();
    expect(dateInputFromDueAt(iso)).toBe("2026-10-26");
  });

  it("includes the year in the due date label", () => {
    const iso = dueAtFromDateInput("2026-09-10");
    expect(iso).toBeTruthy();
    expect(formatDueDate(iso as string)).toMatch(/2026/);
  });

  it("treats yesterday as past and today as valid", () => {
    const now = new Date(2026, 9, 26, 15, 0, 0);
    expect(todayDateInput(now)).toBe("2026-10-26");
    expect(isDateInputPast("2026-10-25", now)).toBe(true);
    expect(isDateInputPast("2026-10-26", now)).toBe(false);
    expect(isDateInputPast("2026-10-27", now)).toBe(false);
    expect(isDateInputPast("", now)).toBe(false);
  });
});
