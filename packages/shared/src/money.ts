// Deferred limitation: only USD (minor-unit exponent 2) is supported in this scaffold.
// Other currencies are rejected rather than guessed, because exponents differ (JPY 0, KWD 3).
export const SUPPORTED_CURRENCY = "USD";
const EXPONENT = 2;
const SCALE = 10 ** EXPONENT;

export type MinorUnits = number & { readonly __brand: "MinorUnits" };

function assertSupportedCurrency(currency: string): void {
  if (currency !== SUPPORTED_CURRENCY) {
    throw new RangeError(`Unsupported currency "${currency}". Only ${SUPPORTED_CURRENCY} is supported.`);
  }
}

/** Validates that a value is a safe integer number of minor units (cents). */
export function minorUnits(value: number): MinorUnits {
  if (!Number.isSafeInteger(value)) throw new RangeError("Minor units must be a safe integer.");
  return value as MinorUnits;
}

/** Parses a decimal string such as "1234.56" into minor units without floating-point arithmetic. */
export function toMinorUnits(amount: string, currency: string = SUPPORTED_CURRENCY): MinorUnits {
  assertSupportedCurrency(currency);
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) throw new RangeError("Amount must be a decimal string with at most two fraction digits.");
  const [, sign, whole, fraction = ""] = match;
  const magnitude = Number(whole) * SCALE + Number(fraction.padEnd(EXPONENT, "0"));
  return minorUnits(sign === "-" ? -magnitude : magnitude);
}

/** Formats minor units as a US dollar string such as "$1,234.56". */
export function formatMinorUnits(value: number, currency: string = SUPPORTED_CURRENCY): string {
  assertSupportedCurrency(currency);
  const amount = minorUnits(value);
  const magnitude = Math.abs(amount);
  const whole = Math.trunc(magnitude / SCALE).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (magnitude % SCALE).toString().padStart(EXPONENT, "0");
  return `${amount < 0 ? "-" : ""}$${whole}.${fraction}`;
}

/**
 * Sums minor units using BigInt so an intermediate total that exceeds Number's safe-integer
 * range (then returns to it through cancellation, e.g. MAX_SAFE_INTEGER + 2 - 2) cannot silently
 * lose precision. Every operand and the final total are still required to be safe integers.
 */
export function sumMinorUnits(values: readonly number[]): MinorUnits {
  let total = 0n;
  for (const value of values) {
    total += BigInt(minorUnits(value));
  }
  if (total < Number.MIN_SAFE_INTEGER || total > Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Minor units must be a safe integer.");
  }
  return minorUnits(Number(total));
}
