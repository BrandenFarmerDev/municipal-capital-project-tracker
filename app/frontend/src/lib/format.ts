import { formatMinorUnits } from "@municipal-tracker/shared";
import { isDateOnly } from "./project-response";

const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

/** Formats a date-only ISO string (YYYY-MM-DD) without shifting it across time zones. */
export function formatDate(value: string | null): string {
  if (!value) return "Not set";
  return isDateOnly(value) ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : "Unavailable";
}

export function formatBudget(minor: number, currency: string): string {
  try {
    return formatMinorUnits(minor, currency);
  } catch {
    return "Unavailable";
  }
}

export function labelFor(value: string): string {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
