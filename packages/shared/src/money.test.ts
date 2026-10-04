import { describe, expect, it } from "vitest";
import { formatMinorUnits, minorUnits, sumMinorUnits, toMinorUnits } from "./money";

describe("minorUnits", () => {
  it("accepts safe integers", () => expect(minorUnits(125)).toBe(125));
  it.each([1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("rejects %s", (value) => {
    expect(() => minorUnits(value)).toThrow(RangeError);
  });
});

describe("toMinorUnits", () => {
  it.each([
    ["0", 0], ["12", 1200], ["12.3", 1230], ["12.34", 1234], ["-0.05", -5], ["1234567.89", 123456789],
  ])("parses %s", (amount, expected) => expect(toMinorUnits(amount)).toBe(expected));
  it("accepts an explicit USD code", () => expect(toMinorUnits("1.00", "USD")).toBe(100));
  it.each(["", "1.234", "abc", "1,000.00", "1.", ".5", " 1"])("rejects malformed amount %j", (amount) => {
    expect(() => toMinorUnits(amount)).toThrow("decimal string");
  });
  it("rejects unsupported currencies", () => expect(() => toMinorUnits("1", "JPY")).toThrow("Unsupported currency"));
});

describe("formatMinorUnits", () => {
  it.each([
    [0, "$0.00"], [5, "$0.05"], [100, "$1.00"], [123456, "$1,234.56"], [-123456, "-$1,234.56"], [100000000, "$1,000,000.00"],
  ])("formats %s", (value, expected) => expect(formatMinorUnits(value)).toBe(expected));
  it("rejects unsupported currencies and non-integers", () => {
    expect(() => formatMinorUnits(1, "EUR")).toThrow("Unsupported currency");
    expect(() => formatMinorUnits(1.5)).toThrow(RangeError);
  });
});

describe("sumMinorUnits", () => {
  it("adds integers exactly", () => expect(sumMinorUnits([10, 20, 30])).toBe(60));
  it("returns zero for an empty list", () => expect(sumMinorUnits([])).toBe(0));
  it("rejects fractional or overflowing values", () => {
    expect(() => sumMinorUnits([1, 0.5])).toThrow(RangeError);
    expect(() => sumMinorUnits([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });
  it("does not lose precision when an intermediate total leaves the safe-integer range and returns via cancellation", () => {
    expect(sumMinorUnits([Number.MAX_SAFE_INTEGER, 2, -2])).toBe(Number.MAX_SAFE_INTEGER);
    expect(sumMinorUnits([Number.MIN_SAFE_INTEGER, -2, 2])).toBe(Number.MIN_SAFE_INTEGER);
  });
});
