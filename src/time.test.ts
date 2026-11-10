import { describe, expect, it } from "vitest";

import { parseDbTime, relativeTime } from "./time";

const NOW = Date.parse("2026-11-10T12:00:00Z");

describe("parseDbTime", () => {
  it("reads postgres text timestamps and ISO strings the same way", () => {
    expect(parseDbTime("2026-11-10 12:00:00+00")).toBe(NOW);
    expect(parseDbTime("2026-11-10T12:00:00.000Z")).toBe(NOW);
    expect(parseDbTime("2026-11-10 12:00:00")).toBe(NOW);
  });
});

describe("relativeTime", () => {
  it("uses plain words", () => {
    expect(relativeTime("2026-11-10 11:59:50+00", NOW)).toBe("just now");
    expect(relativeTime("2026-11-10 11:55:00+00", NOW)).toBe("5 minutes ago");
    expect(relativeTime("2026-11-10 09:00:00+00", NOW)).toBe("3 hours ago");
    expect(relativeTime("2026-11-09 12:00:00+00", NOW)).toBe("yesterday");
    expect(relativeTime("2026-11-05 12:00:00+00", NOW)).toBe("5 days ago");
  });
  it("returns an empty string for garbage", () => {
    expect(relativeTime("not a date", NOW)).toBe("");
  });
});
