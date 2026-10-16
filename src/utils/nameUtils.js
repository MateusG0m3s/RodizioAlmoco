// Utilitários de exibição de nomes de colaboradores

const nameParts = (name = '') => String(name).trim().split(/\s+/).filter(Boolean);

/**
 * Iniciais do primeiro e do último nome ("Monique Aparecida Hilleshein" → "MH").
 * Usar sempre o nome em vez do campo `avatar` salvo: assim duas pessoas com o
 * mesmo começo de nome (Mateus Augusto / Monique Aparecida) não ficam iguais.
 */
export function getInitials(name = '') {
  const parts = nameParts(name);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Primeiro + último nome, para colunas estreitas ("Mateus Augusto Santos Gomes" → "Mateus Gomes"). */
export function getShortName(name = '') {
  const parts = nameParts(name);
  return parts.length <= 2 ? parts.join(' ') : `${parts[0]} ${parts[parts.length - 1]}`;
}
