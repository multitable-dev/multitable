const PALETTE = [
  { name: 'White', hex: '#E8E8E8' },
  { name: 'Red', hex: '#DF0100' },
  { name: 'Blue', hex: '#0071E3' },
  { name: 'Green', hex: '#0A7C4F' },
  { name: 'Black', hex: '#2A2A28' },
  { name: 'Purple', hex: '#6B2D8C' },
  { name: 'Yellow', hex: '#FFBF00' },
  { name: 'Orange', hex: '#F9A227' },
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.replace('#', '');
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

export function getProjectColor(
  id: string,
  _dark: boolean
): {
  stripe: string;
  tint: string;
  dot: string;
} {
  const { hex } = PALETTE[hashString(id) % PALETTE.length];
  const { r, g, b } = hexToRgb(hex);
  return {
    stripe: hex,
    tint: `rgba(${r}, ${g}, ${b}, 0.12)`,
    dot: hex,
  };
}
