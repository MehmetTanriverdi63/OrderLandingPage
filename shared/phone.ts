/** Restore the German mobile trunk prefix sometimes omitted by browser autofill.
 * International numbers keep their country code; unknown local numbers are not guessed.
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!/^[+0-9 ()/\-]+$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') || digits.startsWith('00') || digits.startsWith('0')) return trimmed;
  if (/^49(?:15\d{9}|1[67]\d{8,9})$/.test(digits)) return `+${digits}`;
  if (/^(?:15\d{9}|1[67]\d{8,9})$/.test(digits)) return `0${digits}`;
  return trimmed;
}
