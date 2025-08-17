// src/utils/colors.ts
export function getStableColor(seed: string): string {
  // hash -> hue, keep nice saturation/lightness for cohesive palette
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  const s = 60; // keep consistent
  const l = 55;
  return `hsl(${h}deg ${s}% ${l}%)`;
}