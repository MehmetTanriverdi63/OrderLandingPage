import { z } from 'zod';
import { calculateItem, loginNameSchema, checkoutSchema, hoursSchema, pickupSlots, type Product, type Hours, type Order } from '../shared/model';
import { equal, sha256, verifyPassword, verifyStripeSignature } from './security';
export interface Env { DB: D1Database; ASSETS: Fetcher; DEMO_MODE?: string; STRIPE_ENABLED?: string; STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string; TELEGRAM_ENABLED?: string; TELEGRAM_BOT_TOKEN?: string }
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const fail = (status: number, message: string): never => { throw new HttpError(status, message); };
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
function local(req: Request) { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(req.url).hostname); }
function demoAllowed(req: Request, env: Env) { return local(req) && env.DEMO_MODE === 'true'; }
function stripeEnabled(env: Env) { return env.STRIPE_ENABLED === 'true' && !!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'); }
function product(row: Record<string, unknown>) { return { ...row, options: JSON.parse(row.options as string) } as Product; }
function order(row: Record<string, unknown>) { return { ...row, items: JSON.parse(row.items as string), access_token_hash: undefined, request_id: undefined } as unknown as Order; }
async function body(req: Request) {
  const text = await req.text();
  if (text.length > 30_000) fail(413, 'Anfrage zu groß.');
  try { return JSON.parse(text); } catch { return fail(400, 'Ungültiges JSON.'); }
}
async function limit(env: Env, key: string, count: number, minutes: number, table = 'rate_limits') {
  const now = Date.now();
  const row = await env.DB.prepare(`INSERT INTO ${table}(key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at < ? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at < ? THEN excluded.reset_at ELSE reset_at END RETURNING count`).bind(key, now + minutes * 60_000, now, now).first<{ count: number }>();
  if (!row || row.count > count) fail(429, 'Zu viele Versuche. Bitte später erneut versuchen.');
}
async function session(req: Request, env: Env) {
  const token = req.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('session='))?.slice(8);
  if (!token) return fail(401, 'Bitte zuerst anmelden.');
  const user = await env.DB.prepare('SELECT a.id,a.restaurant_id,a.email,a.demo FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token), Date.now()).first<{ id: string; restaurant_id: string; email: string; demo: number }>();
  if (!user || (user.demo && !demoAllowed(req, env))) return fail(401, 'Sitzung abgelaufen. Bitte erneut anmelden.');
  return user;
}
async function restaurant(env: Env, id: string) {
  const r = await env.DB.prepare('SELECT id,name,address,phone,hours FROM restaurants WHERE id=?').bind(id).first<{ id: string; name: string; address: string; phone: string; hours: string }>();
  if (!r) return fail(404, 'Restaurant nicht gefunden.');
  return { ...r, hours: JSON.parse(r.hours) as Hours };
}
async function notify(env: Env, o: Order) {
  if (env.TELEGRAM_ENABLED !== 'true' || !env.TELEGRAM_BOT_TOKEN) return;
  const r = await env.DB.prepare('SELECT telegram_chat_id FROM restaurants WHERE id=?').bind(o.restaurant_id).first<{ telegram_chat_id: string | null }>();
  if (!r?.telegram_chat_id) return;
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: r.telegram_chat_id, text: `Neue Bestellung #${o.number}\n${o.customer_name}\n${o.items.map(i => `${i.quantity}× ${i.name}`).join('\n')}\n${(o.total / 100).toFixed(2)} EUR · ${o.payment_method === 'cash' ? 'Barzahlung' : 'Stripe Test'}\nAbholwunsch: ${new Date(o.pickup_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}\nBitte im Dashboard bearbeiten.` }) });
  if (!response.ok) throw new Error('Telegram-Zustellung fehlgeschlagen');
}
function backgroundNotify(ctx: ExecutionContext, env: Env, o: Order) { ctx.waitUntil(notify(env, o).catch(() => console.error('Telegram-Zustellung fehlgeschlagen für Bestellung', o.id))); }
async function checkoutSession(env: Env, req: Request, o: Order, token: string) {
  if (!stripeEnabled(env)) return fail(400, 'Online-Zahlung ist derzeit deaktiviert. Bitte Barzahlung wählen.');
  const origin = new URL(req.url).origin;
  const form = new URLSearchParams({ mode: 'payment', 'payment_method_types[0]': 'card', 'line_items[0][price_data][currency]': 'eur', 'line_items[0][price_data][unit_amount]': String(o.total), 'line_items[0][price_data][product_data][name]': `Abholbestellung #${o.number} (TEST)`, 'line_items[0][quantity]': '1', success_url: `${origin}/?order=${o.id}&token=${token}`, cancel_url: `${origin}/?order=${o.id}&token=${token}&payment=cancelled`, 'metadata[order_id]': o.id, 'metadata[restaurant_id]': o.restaurant_id });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `checkout-${o.id}` }, body: form });
  if (!response.ok) return fail(502, 'Stripe ist gerade nicht verfügbar. Deine unbezahlte Bestellung ist gespeichert; bitte erneut versuchen.');
  const data = await response.json() as { url: string };
  return data.url;
}
async function api(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url), path = url.pathname, method = req.method;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && path !== '/api/stripe/webhook') {
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin && !(local(req) && /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin))) fail(403, 'Fremde Herkunft nicht erlaubt.');
    if (!req.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'JSON erforderlich.');
  }
  if (path === '/api/health') { await env.DB.prepare('SELECT 1').first(); return json({ ok: true }); }
  if (path === '/api/menu' && method === 'GET') {
    const id = url.searchParams.get('restaurant') || 'mediterrane-worms';
    const r = await restaurant(env, id);
    const rows = await env.DB.prepare('SELECT * FROM products WHERE restaurant_id=? AND available=1 ORDER BY sort_order,id').bind(id).all<Record<string, unknown>>();
    return json({ restaurant: r, products: rows.results.map(product), pickupSlots: pickupSlots(r.hours), stripeEnabled: stripeEnabled(env), demo: demoAllowed(req, env) });
  }
  if (path === '/api/orders' && method === 'POST') {
    await limit(env, `orders:${req.headers.get('CF-Connecting-IP') || 'local'}`, 30, 60);
    const input = checkoutSchema.parse(await body(req));
    if (input.paymentMethod === 'stripe' && !stripeEnabled(env)) fail(400, 'Online-Zahlung ist deaktiviert.');
    const r = await restaurant(env, input.restaurantId);
    let row = await env.DB.prepare('SELECT * FROM orders WHERE restaurant_id=? AND request_id=?').bind(r.id, input.requestId).first<Record<string, unknown>>();
    let created = false;
    if (!row) {
      if (!pickupSlots(r.hours).includes(input.pickupAt)) fail(400, 'Dieser Abholtermin ist nicht mehr verfügbar. Bitte neu auswählen.');
      const products = await env.DB.prepare('SELECT * FROM products WHERE restaurant_id=? AND available=1').bind(r.id).all<Record<string, unknown>>();
      let total = 0;
      const items = input.items.map(item => {
        const p = products.results.map(product).find(p => p.id === item.productId);
        if (!p) return fail(400, 'Ein Produkt ist nicht mehr verfügbar. Bitte Warenkorb aktualisieren.');
        let priced;
        try { priced = calculateItem(p, item); } catch (e) { return fail(400, (e as Error).message); }
        total += priced.unitPrice * item.quantity;
        return { name: p.name, quantity: item.quantity, ...priced };
      });
      if (total !== input.quotedTotal) fail(409, 'Der Preis hat sich geändert. Bitte den Warenkorb neu öffnen und die aktuellen Preise prüfen.');
      if (total > 100000 || input.items.reduce((n, i) => n + i.quantity, 0) > 50) fail(400, 'Für größere Bestellungen bitte direkt beim Restaurant anfragen.');
      const id = crypto.randomUUID();
      const accessToken = await sha256(`${input.requestId}:${id}`);
      row = await env.DB.prepare("INSERT INTO orders(id,restaurant_id,number,access_token_hash,request_id,customer_name,phone,note,pickup_at,payment_method,payment_status,total,items) SELECT ?,?,COALESCE(MAX(number),1000)+1,?,?,?,?,?,?,?,?,?,? FROM orders WHERE restaurant_id=? ON CONFLICT(restaurant_id,request_id) DO NOTHING RETURNING *").bind(id, r.id, await sha256(accessToken), input.requestId, input.customerName, input.phone, input.note, input.pickupAt, input.paymentMethod, input.paymentMethod === 'cash' ? 'unpaid' : 'awaiting_payment', total, JSON.stringify(items), r.id).first<Record<string, unknown>>();
      created = !!row;
      if (!row) row = await env.DB.prepare('SELECT * FROM orders WHERE restaurant_id=? AND request_id=?').bind(r.id, input.requestId).first<Record<string, unknown>>();
    }
    if (!row) fail(500, 'Bestellung konnte nicht gespeichert werden.');
    const o = order(row!);
    if (o.payment_method !== input.paymentMethod) fail(409, 'Die Zahlungsart dieser Bestellung steht bereits fest. Bitte den Checkout neu öffnen.');
    const token = await sha256(`${input.requestId}:${o.id}`);
    if (created && o.payment_method === 'cash') backgroundNotify(ctx, env, o);
    const paymentUrl = o.payment_method === 'stripe' && o.payment_status !== 'paid' ? await checkoutSession(env, req, o, token) : undefined;
    return json({ id: o.id, token, number: o.number, total: o.total, paymentUrl }, created ? 201 : 200);
  }
  const retryPayment = path.match(/^\/api\/orders\/([a-f0-9-]+)\/payment$/);
  if (retryPayment && method === 'POST') {
    await limit(env, `payment:${req.headers.get('CF-Connecting-IP') || 'local'}`, 20, 15);
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
    const row = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND access_token_hash=?').bind(retryPayment[1], await sha256(token)).first<Record<string, unknown>>();
    if (!row) return fail(404, 'Bestellung nicht gefunden.');
    const o = order(row);
    if (o.status !== 'pending' || o.payment_method !== 'stripe' || o.payment_status !== 'awaiting_payment') fail(409, 'Diese Bestellung kann nicht mehr online bezahlt werden.');
    if (Date.parse(o.pickup_at) < Date.now()) fail(409, 'Der Abholtermin ist abgelaufen. Bitte neu bestellen.');
    return json({ paymentUrl: await checkoutSession(env, req, o, token) });
  }
  const publicOrder = path.match(/^\/api\/orders\/([a-f0-9-]+)$/);
  if (publicOrder && method === 'GET') {
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
    const row = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND access_token_hash=?').bind(publicOrder[1], await sha256(token)).first<Record<string, unknown>>();
    if (!row) return fail(404, 'Bestellung nicht gefunden. Bitte den privaten Bestelllink verwenden.');
    const o = order(row);
    return json({ id: o.id, number: o.number, status: o.status, payment_method: o.payment_method, payment_status: o.payment_status, pickup_at: o.pickup_at, confirmed_pickup: o.confirmed_pickup, total: o.total, items: o.items });
  }
  if (path === '/api/admin/login' && method === 'POST') {
    await limit(env, `login:${req.headers.get('CF-Connecting-IP') || 'local'}`, 12, 15, 'login_attempts');
    const { email, password } = z.object({ email: loginNameSchema, password: z.string().min(1).max(200) }).parse(await body(req));
    const a = await env.DB.prepare('SELECT * FROM admins WHERE email=?').bind(email.toLowerCase()).first<{ id: string; password_hash: string; demo: number }>();
    if (!a || (a.demo && !demoAllowed(req, env)) || !await verifyPassword(password, a.password_hash)) fail(401, 'Benutzername/E-Mail oder Passwort ist nicht korrekt.');
    const token = crypto.randomUUID() + crypto.randomUUID();
    await env.DB.prepare('INSERT INTO sessions(token_hash,admin_id,expires_at) VALUES (?,?,?)').bind(await sha256(token), a!.id, Date.now() + 12 * 3600_000).run();
    return json({ ok: true }, 200, { 'Set-Cookie': `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${local(req) ? '' : '; Secure'}` });
  }
  if (path.startsWith('/api/admin/')) {
    const a = await session(req, env);
    if (path === '/api/admin/me' && method === 'GET') return json({ email: a.email, restaurant: await restaurant(env, a.restaurant_id) });
    if (path === '/api/admin/logout' && method === 'POST') {
      const token = req.headers.get('Cookie')?.match(/(?:^|;\s*)session=([^;]+)/)?.[1] || '';
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
      return json({ ok: true }, 200, { 'Set-Cookie': `session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${local(req) ? '' : '; Secure'}` });
    }
    if (path === '/api/admin/orders' && method === 'GET') {
      const rows = await env.DB.prepare('SELECT * FROM orders WHERE restaurant_id=? ORDER BY created_at DESC LIMIT 100').bind(a.restaurant_id).all<Record<string, unknown>>();
      return json({ orders: rows.results.map(order) });
    }
    const targetOrder = path.match(/^\/api\/admin\/orders\/([a-f0-9-]+)$/);
    if (targetOrder && method === 'PATCH') {
      const input = z.object({ status: z.enum(['accepted', 'rejected', 'ready', 'completed']), confirmedPickup: z.string().datetime().optional() }).parse(await body(req));
      const row = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND restaurant_id=?').bind(targetOrder[1], a.restaurant_id).first<Record<string, unknown>>();
      if (!row) return fail(404, 'Bestellung nicht gefunden.');
      const o = order(row);
      const transitions: Record<string, string[]> = { pending: ['accepted', 'rejected'], accepted: ['ready', 'rejected'], ready: ['completed'], rejected: [], completed: [] };
      if (!transitions[o.status]?.includes(input.status)) fail(409, 'Dieser Statuswechsel ist nicht möglich. Bitte aktualisieren.');
      if (o.payment_method === 'stripe' && o.payment_status !== 'paid' && input.status !== 'rejected') fail(409, 'Online-Zahlung ist noch nicht bestätigt.');
      if (input.status === 'accepted') {
        const r = await restaurant(env, a.restaurant_id);
        if (!input.confirmedPickup || !pickupSlots(r.hours, Date.now() - 25 * 60_000).includes(input.confirmedPickup)) fail(400, 'Bitte eine gültige Abholzeit bestätigen.');
      }
      const result = await env.DB.prepare("UPDATE orders SET status=?,confirmed_pickup=COALESCE(?,confirmed_pickup),payment_status=CASE WHEN payment_method='cash' AND ?='completed' THEN 'paid' ELSE payment_status END WHERE id=? AND restaurant_id=? AND status=?").bind(input.status, input.status === 'accepted' ? input.confirmedPickup : null, input.status, o.id, a.restaurant_id, o.status).run();
      if (!result.meta.changes) fail(409, 'Die Bestellung wurde inzwischen geändert. Bitte aktualisieren.');
      return json({ ok: true });
    }
    if (path === '/api/admin/products' && method === 'GET') {
      const rows = await env.DB.prepare('SELECT * FROM products WHERE restaurant_id=? ORDER BY sort_order,id').bind(a.restaurant_id).all<Record<string, unknown>>();
      return json({ products: rows.results.map(product) });
    }
    if (path === '/api/admin/products' && method === 'POST') {
      const input = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(500), category: z.string().min(1).max(60), price: z.number().int().min(50).max(50000) }).parse(await body(req));
      await env.DB.prepare("INSERT INTO products(id,restaurant_id,name,description,category,price,image) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), a.restaurant_id, input.name, input.description, input.category, input.price, '/images/menu-grid.png#2,0').run();
      return json({ ok: true }, 201);
    }
    const targetProduct = path.match(/^\/api\/admin\/products\/([a-zA-Z0-9-]+)$/);
    if (targetProduct && method === 'PATCH') {
      const input = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(500), price: z.number().int().min(50).max(50000), available: z.boolean() }).parse(await body(req));
      const result = await env.DB.prepare('UPDATE products SET name=?,description=?,price=?,available=? WHERE id=? AND restaurant_id=?').bind(input.name, input.description, input.price, Number(input.available), targetProduct[1], a.restaurant_id).run();
      if (!result.meta.changes) fail(404, 'Produkt nicht gefunden.');
      return json({ ok: true });
    }
    if (path === '/api/admin/hours' && method === 'PUT') {
      const hours = hoursSchema.parse(await body(req));
      await env.DB.prepare('UPDATE restaurants SET hours=? WHERE id=?').bind(JSON.stringify(hours), a.restaurant_id).run();
      return json({ ok: true });
    }
  }
  if (path === '/api/stripe/webhook' && method === 'POST') {
    if (!stripeEnabled(env) || !env.STRIPE_WEBHOOK_SECRET) fail(503, 'Stripe-Testintegration deaktiviert.');
    const raw = await req.text();
    if (!await verifyStripeSignature(raw, req.headers.get('Stripe-Signature') || '', env.STRIPE_WEBHOOK_SECRET!)) fail(400, 'Ungültige Webhook-Signatur.');
    const event = JSON.parse(raw);
    if (event.livemode !== false) fail(400, 'Nur Testereignisse erlaubt.');
    if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
      const s = event.data.object;
      const row = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND restaurant_id=? AND payment_method=?').bind(s.metadata?.order_id || '', s.metadata?.restaurant_id || '', 'stripe').first<Record<string, unknown>>();
      if (!row || s.amount_total !== row.total || s.currency !== 'eur') fail(400, 'Zahlungsbetrag oder Bestellung stimmt nicht überein.');
      const results = await env.DB.batch([
        env.DB.prepare('UPDATE orders SET payment_status=? WHERE id=? AND payment_status=?').bind('paid', row!.id, 'awaiting_payment'),
        env.DB.prepare('INSERT OR IGNORE INTO payment_events(id) VALUES (?)').bind(event.id)
      ]);
      if (results[0].meta.changes) backgroundNotify(ctx, env, { ...order(row!), payment_status: 'paid' });
    }
    return json({ received: true });
  }
  return fail(404, 'API-Endpunkt nicht gefunden.');
}
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    let res: Response;
    try { res = new URL(req.url).pathname.startsWith('/api/') ? await api(req, env, ctx) : await env.ASSETS.fetch(req); }
    catch (e) {
      if (e instanceof z.ZodError) res = json({ error: e.issues.map(i => i.message).join(' ') }, 400);
      else if (e instanceof HttpError) res = json({ error: e.message }, e.status);
      else { console.error('API error:', e instanceof Error ? e.name : 'unknown'); res = json({ error: 'Ein interner Fehler ist aufgetreten. Bitte erneut versuchen.' }, 500); }
    }
    const response = new Response(res.body, res);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    return response;
  }
};
