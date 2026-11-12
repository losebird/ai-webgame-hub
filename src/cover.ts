import { esc } from "./text.js";

const PALETTES = [
  ["#243056", "#f4efe6", "#c4622d"],
  ["#3d2b1f", "#f6efe4", "#d8a15a"],
  ["#1e3a34", "#e7efe8", "#c4622d"],
  ["#2c2440", "#f3e8ec", "#c47b8a"],
] as const;

export function coverSvg(title: string, kind: "game" | "link"): string {
  let index = 0;
  for (const char of title) index = (index + char.charCodeAt(0)) % PALETTES.length;
  const palette = PALETTES[index] ?? PALETTES[0];
  const [background, paper, accent] = palette;
  const letter = [...title][0] ?? "?";
  const label = kind === "link" ? "OFF SITE" : "ON SHELF";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="${background}"/>
  <circle cx="540" cy="64" r="36" fill="${accent}"/>
  <text x="52" y="210" fill="${paper}" font-family="Georgia, serif" font-size="128">${esc(letter)}</text>
  <text x="56" y="286" fill="${accent}" font-family="Georgia, serif" font-size="22">${label}</text>
</svg>`;
}
