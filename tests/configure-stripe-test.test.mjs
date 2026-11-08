import { describe,it,expect,vi } from 'vitest';
import { configureStripeTest } from '../scripts/configure-stripe-test.mjs';
describe('test payment setup (no real external services)',()=>{
  const key='sk_test_not_a_real_secret',webhook='whsec_not_a_real_secret';
  it('rejects live keys before any network or Cloudflare operation',async()=>{
    const run=vi.fn(),fetcher=vi.fn();
    await expect(configureStripeTest('--cloudflare',{read:async()=> 'sk_live_rejected',run,fetcher})).rejects.toThrow('Nur sk_test_');
    expect(run).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps secrets off CLI arguments and verifies the account before deploying',async()=>{
    const values=[key,webhook],run=vi.fn(),fetcher=vi.fn(async()=>Response.json({id:'acct_test'}));
    await configureStripeTest('--cloudflare',{read:async()=>values.shift(),run,fetcher});
    expect(fetcher.mock.calls[0][0]).toBe('https://api.stripe.com/v1/account');
    expect(run).toHaveBeenCalledTimes(4);
    const puts=run.mock.calls.filter(call=>call[1].includes('secret'));
    expect(puts).toHaveLength(2);
    expect(puts[0][2].input).toBe(key+'\n');expect(puts[1][2].input).toBe(webhook+'\n');
    for(const call of run.mock.calls){expect(JSON.stringify(call[1])).not.toContain(key);expect(JSON.stringify(call[1])).not.toContain(webhook);}
  });
  it('does not mutate Cloudflare when Stripe rejects the account key',async()=>{
    const values=[key,webhook],run=vi.fn();
    await expect(configureStripeTest('--cloudflare',{read:async()=>values.shift(),run,fetcher:async()=>new Response('',{status:401})})).rejects.toThrow('bestätigt');
    expect(run).not.toHaveBeenCalled();
  });
});
