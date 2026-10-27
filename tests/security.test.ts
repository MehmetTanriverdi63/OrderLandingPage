import { describe, expect, it } from 'vitest';
import { equal, sha256, verifyPassword, verifyStripeSignature } from '../worker/security';
import { pbkdf2Sync, createHmac } from 'node:crypto';
describe('credentials and payment signatures', () => {
  it('hashes tokens and compares secrets', async () => { expect((await sha256('token')).length).toBe(64); expect(equal('abc', 'abc')).toBe(true); expect(equal('abc', 'abd')).toBe(false); expect(equal('abc', 'ab')).toBe(false); });
  it('validates PBKDF2 and rejects wrong passwords', async () => { const stored = `100000:salt:${pbkdf2Sync('password', 'salt', 100000, 32, 'sha256').toString('hex')}`; expect(await verifyPassword('password', stored)).toBe(true); expect(await verifyPassword('wrong', stored)).toBe(false); });
  it('accepts signed fresh Stripe bodies and rejects replays/tampering', async () => { const now = Date.now(), t = String(Math.floor(now / 1000)), raw = '{"type":"checkout.session.completed"}', secret = 'whsec_test'; const signature = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex'); expect(await verifyStripeSignature(raw, `t=${t},v1=${signature}`, secret, now)).toBe(true); expect(await verifyStripeSignature(raw + ' ', `t=${t},v1=${signature}`, secret, now)).toBe(false); expect(await verifyStripeSignature(raw, `t=${t},v1=${signature}`, secret, now + 301000)).toBe(false); });
});
