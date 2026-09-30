import { describe, expect, it } from "vitest";
import { parseRunCommand, taskTitleFrom } from "@/lib/chat/run-command";

describe("parseRunCommand", () => {
  it("returns null for ordinary messages", () => {
    expect(parseRunCommand("what should we build next?")).toBeNull();
    expect(parseRunCommand("please /run this")).toBeNull();
    expect(parseRunCommand("/running late")).toBeNull();
  });

  it("returns the instruction after /run", () => {
    expect(parseRunCommand("/run build the pricing page")).toBe("build the pricing page");
    expect(parseRunCommand("  /RUN   @engineering ship it  ")).toBe("@engineering ship it");
  });

  it("keeps multi-line instructions", () => {
    expect(parseRunCommand("/run first line\nsecond line")).toBe("first line\nsecond line");
  });

  it("returns an empty string when /run has no instruction", () => {
    expect(parseRunCommand("/run")).toBe("");
    expect(parseRunCommand("/run   ")).toBe("");
  });
});

describe("taskTitleFrom", () => {
  it("drops leading mentions and caps the length", () => {
    expect(taskTitleFrom("@engineering build the pricing page")).toBe("build the pricing page");
    expect(taskTitleFrom("@a @b do it\nmore detail")).toBe("do it");
    expect(taskTitleFrom("x".repeat(200))).toHaveLength(80);
  });

  it("falls back when only a mention is given", () => {
    expect(taskTitleFrom("@engineering")).toBe("@engineering");
  });
});
