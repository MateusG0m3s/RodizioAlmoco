// Paleta de avatares derivada da marca: todos com contraste >= 4,5:1 para as iniciais brancas.
export const AVATAR_PALETTE = [
  '#62257A', // roxo da logo
  '#4A3A8C', // índigo do wallpaper
  '#7A2E6E', // ameixa
  '#005E8E', // azul do "hub"
  '#2F4A7A', // ardósia
  '#1F5F73', // petróleo
  '#8A3150', // vinho
  '#5A4D63'  // grafite
];

// Cores antigas (Tailwind e paleta anterior da Equipe) ainda gravadas na nuvem: exibidas no tom equivalente da marca
const LEGACY_AVATAR_COLORS = {
  '#381267': '#62257A',
  '#7c3aed': '#7A2E6E',
  '#0284c7': '#005E8E',
  '#6366f1': '#4A3A8C',
  '#1a87cc': '#005E8E',
  '#8a44b0': '#62257A',
  '#ec4899': '#8A3150',
  '#f59e0b': '#7A2E6E',
  '#10b981': '#1F5F73',
  '#4fb3ee': '#2F4A7A',
  '#f97316': '#5A4D63',
  '#4f1f66': '#62257A',
  '#4a1c5c': '#62257A'
};

function hashSeed(seed) {
  const str = String(seed || '');
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Cor de exibição do avatar: mantém cores da paleta, converte as antigas e sorteia (estável) quando não há cor.
export function resolveAvatarColor(color, seed = '') {
  const key = typeof color === 'string' ? color.trim().toLowerCase() : '';
  if (key && LEGACY_AVATAR_COLORS[key]) return LEGACY_AVATAR_COLORS[key];
  if (key) return color;
  return AVATAR_PALETTE[hashSeed(seed) % AVATAR_PALETTE.length];
}
