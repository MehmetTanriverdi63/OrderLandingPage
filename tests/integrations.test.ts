import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import worker, { type Env } from '../worker/index';
import { sha256 } from '../worker/security';
const id = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const row = { id, restaurant_id: 'test', number: 1001, request_id: requestId, access_token_hash: 'hash', customer_name: 'Testgast', phone: '0123456789', note: '', pickup_at: '2030-01-01T11:00:00.000Z', confirmed_pickup: null, status: 'pending', payment_method: 'stripe', payment_status: 'awaiting_payment', total: 990, items: '[{"name":"Menü","quantity":1,"unitPrice":990,"selections":[]}]', created_at: '2026-10-27T11:00:00.000Z' };
function environment(overrides: Partial<Env> = {}) {
  const batches: unknown[][] = [];
  const db = { prepare(sql: string) { return { bind(...bindings: unknown[]) { return { async first() { if ((sql.includes('rate_limits') || sql.includes('login_attempts'))) return { count: 1 }; if (sql.includes('SELECT id,name,address,phone,hours')) return { id: 'test', name: 'Testrestaurant', hours: '[]' }; if (sql.includes('SELECT * FROM orders')) return { ...row }; if (sql.includes('SELECT telegram_chat_id')) return { telegram_chat_id: 'demo-chat' }; if (sql.includes('FROM admins')) return { id: 'demo', demo: 1 }; return null; }, sql, bindings }; } }; }, async batch(statements: unknown[]) { batches.push(statements); return [{ meta: { changes: batches.length === 1 ? 1 : 0 } }, { meta: { changes: 1 } }]; } };
  return { env: { DB: db as unknown as D1Database, STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_fake', ...overrides } as Env, batches };
}
const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
function checkout() { return new Request('https://example.com/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId: 'test', customerName: 'Testgast', phone: '0123456789', quotedTotal: 990, pickupAt: row.pickup_at, paymentMethod: 'stripe', consent: true, requestId, items: [{ productId: 'test', quantity: 1, selections: {} }] }) }); }
function webhook(changes: Record<string, unknown> = {}, invalid = false) {
  const event = { id: 'evt_test', livemode: false, type: 'checkout.session.completed', data: { object: { payment_status: 'paid', amount_total: 990, currency: 'eur', metadata: { order_id: id, restaurant_id: 'test' } } }, ...changes };
  const raw = JSON.stringify(event), t = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', invalid ? 'wrong' : 'whsec_fake').update(`${t}.${raw}`).digest('hex');
  return new Request('https://example.com/api/stripe/webhook', { method: 'POST', body: raw, headers: { 'Stripe-Signature': `t=${t},v1=${sig}` } });
}
afterEach(() => vi.unstubAllGlobals());
describe('Stripe test-only integration contracts (mocked external calls)', () => {
  it('creates checkout using server total, metadata, and idempotency', async () => {
    const fetcher = vi.fn(async () => Response.json({ url: 'https://checkout.stripe.com/test_session' })); vi.stubGlobal('fetch', fetcher);
    const { env } = environment(); const res = await worker.fetch(checkout(), env, ctx); expect(res.status).toBe(200);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]; expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    const form = new URLSearchParams(String(init.body)); expect(form.get('line_items[0][price_data][unit_amount]')).toBe('990'); expect(form.get('metadata[restaurant_id]')).toBe('test'); expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(`checkout-${id}`);
    const data = await res.json() as { token: string; paymentUrl: string }; expect(data.token).toBe(await sha256(`${requestId}:${id}`)); expect(data.paymentUrl).toContain('test_session');
  });
  it('resumes an unpaid test checkout through the private payment endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ url: 'https://checkout.stripe.com/test_retry' })));
    const { env } = environment();
    const req = new Request(`https://example.com/api/orders/${id}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-private-token' }, body: '{}' });
    const response = await worker.fetch(req, env, ctx); expect(response.status).toBe(200); expect(await response.text()).toContain('test_retry');
  });
  it('rejects live keys even when enabled', async () => { const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); const { env } = environment({ STRIPE_SECRET_KEY: 'sk_live_forbidden' }); expect((await worker.fetch(checkout(), env, ctx)).status).toBe(400); expect(fetcher).not.toHaveBeenCalled(); });
  it('handles external checkout failure without losing stored order', async () => { vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 }))); const { env } = environment(); const response = await worker.fetch(checkout(), env, ctx); expect(response.status).toBe(502); expect(await response.text()).toContain('gespeichert'); });
  it('records a verified paid test event and handles duplicate delivery', async () => { const { env, batches } = environment(); expect((await worker.fetch(webhook(), env, ctx)).status).toBe(200); expect((await worker.fetch(webhook(), env, ctx)).status).toBe(200); expect(batches).toHaveLength(2); });
  it('rejects invalid signatures and live events', async () => { const { env, batches } = environment(); expect((await worker.fetch(webhook({}, true), env, ctx)).status).toBe(400); expect((await worker.fetch(webhook({ livemode: true }), env, ctx)).status).toBe(400); expect(batches).toHaveLength(0); });
  it('rejects mismatched amounts', async () => { const { env, batches } = environment(); const bad = { data: { object: { payment_status: 'paid', amount_total: 1, currency: 'eur', metadata: { order_id: id, restaurant_id: 'test' } } } }; expect((await worker.fetch(webhook(bad), env, ctx)).status).toBe(400); expect(batches).toHaveLength(0); });
  it('blocks local demo login on a public host', async () => { const { env } = environment({ DEMO_MODE: 'true' }); const req = new Request('https://example.com/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@mediterrane.local', password: 'Demo-2026!' }) }); expect((await worker.fetch(req, env, ctx)).status).toBe(401); });
});

describe('Telegram opt-in contract (mocked, no real messages)', () => {
  it('never calls Telegram by default and notifies once for a paid order when opted in', async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true })); vi.stubGlobal('fetch', fetcher);
    const pending: Promise<unknown>[] = [];
    const context = { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as ExecutionContext;
    const disabled = environment(); await worker.fetch(webhook(), disabled.env, context); await Promise.all(pending); expect(fetcher).not.toHaveBeenCalled();
    const enabled = environment({ TELEGRAM_ENABLED: 'true', TELEGRAM_BOT_TOKEN: 'test-only-fake-token' });
    await worker.fetch(webhook(), enabled.env, context); await Promise.all(pending);
    await worker.fetch(webhook(), enabled.env, context); await Promise.all(pending);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit]; expect(call[0]).toContain('api.telegram.org'); const payload = JSON.parse(String(call[1].body)); expect(payload.chat_id).toBe('demo-chat'); expect(payload.text).toContain('Neue Bestellung #1001');
  });
});
