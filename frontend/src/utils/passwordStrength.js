export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { id: 'letter', label: 'A letter', test: (value) => /\p{L}/u.test(value) },
  { id: 'number', label: 'A number', test: (value) => /\d/.test(value) },
];

const LEVELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

/** Lightweight 0–4 score; the backend only enforces PASSWORD_RULES. */
export function scorePassword(value) {
  if (!value) return { score: 0, label: '' };
  let points = 0;
  if (value.length >= 8) points += 1;
  if (value.length >= 12) points += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) points += 1;
  if (/\d/.test(value)) points += 1;
  if (/[^\p{L}\d]/u.test(value)) points += 1;
  const meetsRules = PASSWORD_RULES.every((rule) => rule.test(value));
  const score = meetsRules ? Math.max(1, Math.min(4, points - 1)) : 0;
  return { score, label: LEVELS[score] };
}
