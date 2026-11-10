import { describe, expect, it } from "vitest";
import { parseFigure } from "../src/lib/numbers";

describe("parseFigure", () => {
  it.each([
    ["831 million people", 831e6],
    ["US$2.7 trillion", 2.7e12],
    ["12,121 warheads", 12121],
    ["2.7°C by 2100", 2.7],
    ["4.8m deaths", 4.8e6],
    ["USD 223.3 bn", 223.3e9],
    ["about 59", 59],
  ])("%s", (text, expected) => {
    expect(parseFigure(text)).toBeCloseTo(expected);
  });

  it("returns null when there is no number", () => {
    expect(parseFigure("not available")).toBeNull();
  });
});
