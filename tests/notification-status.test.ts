import {expect,it} from 'vitest';
import worker,{type Env} from '../worker/index';
it('reports tenant Telegram readiness only when flag, secret and assigned recipient exist, without exposing secrets',async()=>{
  for(const [flag,token,chatId,enabled] of [['true','test-only-token','8006063245',true],['false','test-only-token','8006063245',false],['true','','8006063245',false],['true','test-only-token',null,false]] as const){
    const DB = {
      prepare(sql: string) {
        return {
          bind(restaurantId: unknown) {
            return {
              async first() {
                if (sql.includes('FROM sessions')) return { id: 'admin', restaurant_id: 'mediterrane-worms', email: 'amedspor21', demo: 0 };
                expect(restaurantId).toBe('mediterrane-worms');
                if (sql.includes('SELECT telegram_chat_id')) return { telegram_chat_id: chatId };
                return { id: 'mediterrane-worms', name: 'Test', address: 'Test', phone: 'Test', hours: '[]' };
              }
            };
          }
        };
      }
    } as unknown as D1Database;
    const response=await worker.fetch(new Request('https://example.com/api/admin/me',{headers:{Cookie:'session=test-session'}}),{DB,TELEGRAM_ENABLED:flag,TELEGRAM_BOT_TOKEN:token} as Env,{} as ExecutionContext);
    expect(response.status).toBe(200);const text=await response.text();expect(JSON.parse(text).telegramEnabled).toBe(enabled);expect(text).not.toContain('test-only-token');expect(text).not.toContain('8006063245');
  }
});
