import { expect, it } from 'vitest';
import { pbkdf2Sync, randomInt } from 'node:crypto';
import worker, { type Env } from '../worker/index';
it('authenticates a username case-insensitively with a local-preview four-character password and rejects a wrong password', async () => {
  const password=String(randomInt(1000,10000)), salt='username-login-test';
  const hash=`100000:${salt}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')}`;
  let inserted=false;
  const DB={prepare(sql:string){return {bind(...params:unknown[]){return {async first(){if(sql.includes('login_attempts'))return {count:1};if(sql.includes('FROM admins') && params[0]==='amedspor21')return {id:'preview-test',password_hash:hash,demo:0};return null;},async run(){inserted=true;return {success:true};}};}};}} as unknown as D1Database;
  const request=(value:string)=>new Request('https://private-preview.example/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://private-preview.example'},body:JSON.stringify({email:'Amedspor21',password:value})});
  const env={DB} as Env,ctx={} as ExecutionContext;
  const good=await worker.fetch(request(password),env,ctx);
  expect(good.status).toBe(200);expect(good.headers.get('set-cookie')).toContain('HttpOnly');expect(inserted).toBe(true);
  const bad=await worker.fetch(request(password+'x'),env,ctx);expect(bad.status).toBe(401);
});
