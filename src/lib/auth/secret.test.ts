import { describe, expect, it } from "vitest";
import { getAuthSecret } from "@/lib/auth/secret";

const env = (values: Record<string, string | undefined>) => values as unknown as NodeJS.ProcessEnv;
const STRONG = "x".repeat(40);

describe("getAuthSecret", () => {
  it("uses a dev fallback when unset outside production", () => {
    expect(getAuthSecret(env({ NODE_ENV: "development" }))).toBe("cofounder-local-dev-session-secret");
  });

  it("treats the .env.example placeholder as unset in development", () => {
    expect(getAuthSecret(env({ NODE_ENV: "development", AUTH_SECRET: "replace-me-for-provider-mode" }))).toBe(
      "cofounder-local-dev-session-secret"
    );
  });

  it("returns the configured secret when present", () => {
    expect(getAuthSecret(env({ NODE_ENV: "production", AUTH_SECRET: STRONG }))).toBe(STRONG);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["placeholder", "replace-me-for-provider-mode"],
    ["too short", "short-secret"]
  ])("throws in production when the secret is %s", (_label, value) => {
    expect(() => getAuthSecret(env({ NODE_ENV: "production", AUTH_SECRET: value }))).toThrow(/AUTH_SECRET/);
  });
});
