import {afterEach,expect,it,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {activateCloudflareTelegram} from '../scripts/cloudflare-telegram.mjs';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
function fixture(){
 const token='123456789:'+randomBytes(24).toString('base64url');vi.stubEnv('CODESPACES','true');vi.stubEnv('TELEGRAM_BOT_TOKEN',token);
 const fetcher=vi.fn(async url=>{expect(String(url)).toContain('/getChat?chat_id=8006063245');return Response.json({ok:true,result:{id:8006063245}});});
 const run=vi.fn((cmd,args,options)=>{
  expect(args.join(' ')).not.toContain(token);
  if(args.includes('put')){expect(options.input).toBe(token+'\n');expect(args).toContain('TELEGRAM_BOT_TOKEN');}
  if(args.includes('d1')){expect(args).toContain('--remote');expect(args).toContain('--command');return JSON.stringify([{success:true,results:[{id:'mediterrane-worms',telegram_chat_id:'8006063245'}]}]);}
  return '';
 });return {token,fetcher,run};
}
it('verifies recipient, builds, assigns remote chat, pipes secret and deploys in order',async()=>{
 const log=vi.spyOn(console,'log').mockImplementation(()=>{}),f=fixture();await activateCloudflareTelegram('8006063245',f);
 expect(f.run).toHaveBeenCalledTimes(4);expect(f.run.mock.calls[0][0]).toBe('npm');expect(f.run.mock.calls[1][1]).toContain('d1');expect(f.run.mock.calls[2][1]).toContain('put');expect(f.run.mock.calls[3][1]).toContain('deploy');expect(log.mock.calls.flat().join(' ')).not.toContain(f.token);expect(f.fetcher).toHaveBeenCalledTimes(1);
});
it('does not mutate Cloudflare when Telegram recipient verification fails',async()=>{
 vi.spyOn(console,'log').mockImplementation(()=>{});const f=fixture();f.fetcher.mockResolvedValue(Response.json({ok:true,result:{id:999}}));await expect(activateCloudflareTelegram('8006063245',f)).rejects.toThrow('nicht überein');expect(f.run).not.toHaveBeenCalled();
});
it('does not store secrets or deploy after remote database failure',async()=>{
 vi.spyOn(console,'log').mockImplementation(()=>{});const f=fixture();f.run.mockImplementation((cmd,args)=>{if(args.includes('d1'))throw new Error('DB failure');return '';});await expect(activateCloudflareTelegram('8006063245',f)).rejects.toThrow('Remote-Chatzuordnung');expect(f.run).toHaveBeenCalledTimes(2);
});
