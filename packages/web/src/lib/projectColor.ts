function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getProjectColor(
  id: string,
  dark: boolean
): {
  stripe: string;
  tint: string;
  dot: string;
} {
  const hue = hashString(id) % 360;
  if (dark) {
    return {
      stripe: `hsl(${hue} 60% 62%)`,
      tint: `hsl(${hue} 60% 55% / 0.14)`,
      dot: `hsl(${hue} 65% 65%)`,
    };
  }
  return {
    stripe: `hsl(${hue} 55% 48%)`,
    tint: `hsl(${hue} 70% 55% / 0.12)`,
    dot: `hsl(${hue} 60% 48%)`,
  };
}
