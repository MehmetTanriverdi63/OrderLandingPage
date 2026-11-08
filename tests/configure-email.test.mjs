import {describe,it,expect,vi} from 'vitest';
import {configureEmail} from '../scripts/configure-email.mjs';
describe('mail configuration without real provider or Cloudflare operations',()=>{
 it('pipes secrets to Wrangler and enables delivery only after credentials are stored',async()=>{const key='re_only_a_mock_key',values=['Mediterrane Küche <test@example.com>',key],run=vi.fn();await configureEmail('--cloudflare',{read:async()=>values.shift(),run});expect(run).toHaveBeenCalledTimes(8);const puts=run.mock.calls.filter(call=>call[1].includes('secret'));expect(puts[4][1]).toContain('EMAIL_ENABLED');expect(puts[1][2].input).toBe(key+'\n');for(const call of run.mock.calls)expect(JSON.stringify(call[1])).not.toContain(key);});
 it('rejects malformed sender headers without changing external settings',async()=>{const run=vi.fn();await expect(configureEmail('--cloudflare',{read:async()=> 'bad\nheader',run})).rejects.toThrow('Absenderformat');expect(run).not.toHaveBeenCalled();});
});
