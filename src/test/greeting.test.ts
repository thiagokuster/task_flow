import { describe, expect, it } from "vitest";

import {
  dashboardSubtitle,
  displayFirstName,
  displayFullName,
  displayInitial,
  displayInitials,
} from "@/lib/greeting";

describe("displayFirstName", () => {
  it("uses the first word of the full name", () => {
    expect(displayFirstName("Thiago Kuster", "a@b.com")).toBe("Thiago");
  });

  it("falls back to the email local part", () => {
    expect(displayFirstName("  ", "thiago@example.com")).toBe("thiago");
  });

  it("falls back to você", () => {
    expect(displayFirstName(null, null)).toBe("você");
  });
});

describe("displayFullName and displayInitial", () => {
  it("keeps the full name and uses the first letter", () => {
    expect(displayFullName("Thiago Kuster", "a@b.com")).toBe("Thiago Kuster");
    expect(displayInitial("Thiago Kuster", "a@b.com")).toBe("T");
  });
});

describe("displayInitials", () => {
  it("uses first and last name letters", () => {
    expect(displayInitials("Thiago Kuster", "a@b.com")).toBe("TK");
    expect(displayInitials("Ana", "a@b.com")).toBe("A");
  });
});

describe("dashboardSubtitle", () => {
  it("pluralizes pending tasks", () => {
    expect(dashboardSubtitle({ pending: 0, inProgress: 0, done: 0 })).toBe(
      "Você tem 0 tarefas pendentes hoje",
    );
    expect(dashboardSubtitle({ pending: 1, inProgress: 0, done: 0 })).toBe(
      "Você tem 1 tarefa pendente hoje",
    );
    expect(dashboardSubtitle({ pending: 3, inProgress: 1, done: 0 })).toBe(
      "Você tem 3 tarefas pendentes hoje",
    );
  });

  it("celebrates when everything is done", () => {
    expect(dashboardSubtitle({ pending: 0, inProgress: 0, done: 2 })).toBe("Tudo em dia! 🎉");
  });
});
