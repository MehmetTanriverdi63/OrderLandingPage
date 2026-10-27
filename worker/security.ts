export async function sha256(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function equal(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
export async function verifyPassword(password: string, stored: string) {
  const [iterations, salt, expected] = stored.split(':');
  if (!salt || !expected || Number(iterations) !== 100000) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: Number(iterations), hash: 'SHA-256' }, key, 256);
  const actual = [...new Uint8Array(bits)].map(n => n.toString(16).padStart(2, '0')).join('');
  return equal(actual, expected);
}
export async function verifyStripeSignature(body: string, header: string, secret: string, now = Date.now()) {
  const parts = header.split(',').map(x => x.split('='));
  const stamp = parts.find(p => p[0] === 't')?.[1];
  if (!stamp || !/^\d+$/.test(stamp) || Math.abs(now / 1000 - Number(stamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${stamp}.${body}`));
  const expected = [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, '0')).join('');
  return parts.some(p => p[0] === 'v1' && equal(p[1] || '', expected));
}
