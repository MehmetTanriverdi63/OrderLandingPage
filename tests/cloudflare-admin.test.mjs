import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {configureAdmin,checkAdmin} from '../scripts/cloudflare-admin.mjs';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
function fixture({wrongHash=false,importError=false}={}){
 const password=randomBytes(18).toString('base64url');let row,sqlPath;
 const run=vi.fn((command,args)=>{
  if(command==='git')return '';
  if(args.includes('--file')){
   sqlPath=args[args.indexOf('--file')+1];const sql=readFileSync(sqlPath,'utf8');expect(sql).not.toContain(password);expect(sql).not.toContain('RETURNING');
   if(importError){const error=new Error('raw CLI output must stay private');error.stderr='Authentication error [code: 10000]';throw error;}
   const hash=sql.match(/100000:[a-f0-9]+:[a-f0-9]+/)[0];
   row={id:'test-admin',restaurant_id:'mediterrane-worms',email:'amedspor21',demo:0,password_hash:wrongHash?'different':hash};
   return JSON.stringify([{success:true,results:[{'Total queries executed':2,'Rows written':1}]}]);
  }
  expect(args).toContain('--command');return JSON.stringify([{success:true,results:row?[row]:[]}]);
 });
 return {password,run,getPath:()=>sqlPath};
}
it('accepts D1 import statistics and separately verifies the saved admin/hash',async()=>{
 vi.stubEnv('ADMIN_PASSWORD','');const log=vi.spyOn(console,'log').mockImplementation(()=>{}),f=fixture();
 await configureAdmin('Amedspor21',{run:f.run,prompt:async()=>f.password});
 expect(f.run.mock.calls.filter(([,args])=>args.includes('--file'))).toHaveLength(1);
 expect(f.run.mock.calls.filter(([,args])=>args.includes('--command'))).toHaveLength(1);
 expect(existsSync(f.getPath())).toBe(false);expect(log.mock.calls.flat().join(' ')).toContain('erfolgreich eingerichtet');expect(log.mock.calls.flat().join(' ')).not.toContain(f.password);
});
it('rejects an existing account whose hash does not match the requested password',async()=>{
 vi.stubEnv('ADMIN_PASSWORD','');vi.spyOn(console,'log').mockImplementation(()=>{});const f=fixture({wrongHash:true});
 await expect(configureAdmin('Amedspor21',{run:f.run,prompt:async()=>f.password})).rejects.toThrow('konnte nicht bestätigt');expect(existsSync(f.getPath())).toBe(false);
});
it('reports expired authorization without exposing raw CLI output',async()=>{
 vi.stubEnv('ADMIN_PASSWORD','');vi.spyOn(console,'log').mockImplementation(()=>{});const f=fixture({importError:true});
 await expect(configureAdmin('Amedspor21',{run:f.run,prompt:async()=>f.password})).rejects.toThrow('Cloudflare-Anmeldung fehlt');expect(existsSync(f.getPath())).toBe(false);
});
it('checks account presence without importing SQL or asking for a password',()=>{
 vi.spyOn(console,'log').mockImplementation(()=>{});
 const run=vi.fn((command,args)=>{expect(args).toContain('--command');expect(args).not.toContain('--file');expect(args[args.indexOf('--command')+1]).not.toContain('password_hash');return JSON.stringify([{success:true,results:[{restaurant_id:'mediterrane-worms',email:'amedspor21',demo:0}]}]);});
 expect(checkAdmin('Amedspor21',{run})).toBe(true);expect(run).toHaveBeenCalledTimes(1);
});
