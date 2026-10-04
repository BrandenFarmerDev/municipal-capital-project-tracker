import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
const palettes = source.split(':where(.qe-app[data-theme="dark"])');
const values = (css: string) => Object.fromEntries([...css.matchAll(/--qe-color-([\w-]+):\s*#([\da-f]{6});/g)].map((match) => [match[1], match[2]!])) as Record<string, string>;
const light = values(palettes[0]!);
const dark = { ...light, ...values(palettes[1]!) };

function luminance(hex: string) {
  const channels = hex.match(/../g)!.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels.reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index]!, 0);
}

function ratio(first: string, second: string) {
  const pair = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (pair[0]! + 0.05) / (pair[1]! + 0.05);
}

describe.each([["light", light], ["dark", dark]])("%s theme contrast", (_name, palette) => {
  it.each([
    ["text", "canvas"], ["text-secondary", "surface"], ["text-muted", "surface"], ["text-muted", "canvas"],
    ["link", "surface"], ["link", "canvas"], ["on-primary", "primary"], ["on-primary", "primary-hover"], ["on-primary", "primary-active"],
    ["info", "info-surface"], ["success", "success-surface"], ["warning", "warning-surface"], ["danger", "danger-surface"],
  ])("normal %s text on %s passes WCAG AA", (foreground, background) => {
    expect(ratio(palette[foreground]!, palette[background]!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each([["control-border", "surface"], ["focus", "surface"], ["focus", "canvas"]])("%s against %s is a discernible interface boundary", (foreground, background) => {
    expect(ratio(palette[foreground]!, palette[background]!)).toBeGreaterThanOrEqual(3);
  });
});
