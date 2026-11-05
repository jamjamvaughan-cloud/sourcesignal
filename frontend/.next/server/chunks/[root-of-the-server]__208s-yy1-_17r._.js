module.exports=[8875,(e,t,a)=>{t.exports=e.x("ioredis-23a6225d3f8c0bff",()=>require("ioredis-23a6225d3f8c0bff"))},36816,e=>e.a(async(t,a)=>{try{var r=e.i(8875),n=e.i(79603),i=t([n]);[n]=i.then?(await i)():i;let p=process.env.REDIS_URL?.trim()||"",E=globalThis,N=E.__sourceSignalCache??{client:null,redisStatus:p?"unknown":"disabled",lastRedisAttempt:0,postgresDisabled:!1,postgresRetryAt:0,memory:new Map};async function s(){let e;if(!p)return null;if("ready"===N.redisStatus&&N.client)return N.client;let t=Date.now();if("unavailable"===N.redisStatus&&t-N.lastRedisAttempt<15e3)return null;N.lastRedisAttempt=t,N.client||((e=new r.default(p,{lazyConnect:!0,enableOfflineQueue:!1,maxRetriesPerRequest:1,connectTimeout:1500,commandTimeout:1500,retryStrategy:()=>null})).on("ready",()=>{N.redisStatus="ready",console.log("[cache] Redis connected.")}),e.on("end",()=>{"disabled"!==N.redisStatus&&(N.redisStatus="unavailable")}),e.on("error",e=>{"unavailable"!==N.redisStatus&&console.warn(`[cache] Redis unavailable (${e.message}); using fallback store.`),N.redisStatus="unavailable"}),N.client=e);let a=N.client;try{if(("wait"===a.status||"end"===a.status)&&await a.connect(),"ready"===a.status)return N.redisStatus="ready",a;return N.redisStatus="unavailable",null}catch{return N.redisStatus="unavailable",null}}async function l(e){let t=await s();if(!t)return{ok:!1};try{return{ok:!0,value:await e(t)}}catch{return N.redisStatus="unavailable",N.lastRedisAttempt=Date.now(),{ok:!1}}}async function u(e){if(N.postgresDisabled||Date.now()<N.postgresRetryAt)return{ok:!1};try{return{ok:!0,value:await e()}}catch(e){return"42P01"===e.code?(N.postgresDisabled=!0,console.warn("[cache] cache_entries table missing; using in-memory fallback. Apply src/lib/db-schema.sql to enable the PostgreSQL cache.")):N.postgresRetryAt=Date.now()+1e4,{ok:!1}}}async function c(e,t,a){if((await u(async()=>(await (0,n.z)(`INSERT INTO cache_entries (key, value, expires_at, created_at, updated_at)
       VALUES (
         $1,
         $2,
         CASE WHEN $3::int IS NULL THEN NULL
              ELSE NOW() + make_interval(secs => $3::int) END,
         NOW(),
         NOW()
       )
       ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value,
              expires_at = EXCLUDED.expires_at,
              updated_at = NOW()`,[e,t,a&&a>0?a:null]),!0))).ok)return"postgres";if(N.memory.size>=1e4){let e=Date.now();for(let[t,a]of N.memory)null!==a.expiresAt&&a.expiresAt<=e&&N.memory.delete(t)}return N.memory.set(e,{value:t,expiresAt:a&&a>0?Date.now()+1e3*a:null}),"memory"}E.__sourceSignalCache=N;let f={async get(e){let t,a=await l(t=>t.get(e));if(a.ok&&"string"==typeof a.value)return a.value;let r=await u(async()=>{let t=await (0,n.z)(`SELECT value
           FROM cache_entries
          WHERE key = $1
            AND (expires_at IS NULL OR expires_at > NOW())`,[e]);return t.rows[0]?.value??null});return r.ok&&"string"==typeof r.value?r.value:(t=N.memory.get(e))?null!==t.expiresAt&&t.expiresAt<=Date.now()?(N.memory.delete(e),null):t.value:null},set:async(e,t,a)=>(await l(r=>a&&a>0?r.set(e,t,"EX",a):r.set(e,t))).ok?"redis":c(e,t,a),async del(e){let t=0,a=await l(t=>t.del(e));a.ok&&(t+=a.value??0);let r=await u(async()=>(await (0,n.z)("DELETE FROM cache_entries WHERE key = $1",[e])).rowCount??0);return r.ok&&(t+=r.value??0),t+=+!!N.memory.delete(e)},async keys(e){let t=new Set,a=await l(t=>t.keys(e));if(a.ok&&a.value)for(let e of a.value)t.add(e);let r=await u(async()=>(await (0,n.z)(`SELECT key
           FROM cache_entries
          WHERE key LIKE $1
            AND (expires_at IS NULL OR expires_at > NOW())`,[e.replace(/[\\%_]/g,"\\$&").replace(/\*/g,"%").replace(/\?/g,"_")])).rows.map(e=>e.key));if(r.ok&&r.value)for(let e of r.value)t.add(e);for(let a of function(e){let t,a=Date.now(),r=(t=e.replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*").replace(/\?/g,"."),RegExp(`^${t}$`)),n=[];for(let[e,t]of N.memory){if(null!==t.expiresAt&&t.expiresAt<=a){N.memory.delete(e);continue}r.test(e)&&n.push(e)}return n}(e))t.add(a);return Array.from(t)},async incr(e,t){let a=await l(async a=>{let r=await a.incr(e);return 1===r&&t&&t>0&&await a.expire(e,t),r});if(a.ok&&void 0!==a.value)return a.value;let r=await u(async()=>{let a=await (0,n.z)(`INSERT INTO cache_entries (key, value, expires_at, created_at, updated_at)
         VALUES (
           $1,
           '1',
           CASE WHEN $2::int IS NULL THEN NULL
                ELSE NOW() + make_interval(secs => $2::int) END,
           NOW(),
           NOW()
         )
         ON CONFLICT (key) DO UPDATE
            SET value = CASE
                  WHEN cache_entries.expires_at IS NOT NULL
                       AND cache_entries.expires_at <= NOW()
                    THEN '1'
                  ELSE ((cache_entries.value)::bigint + 1)::text
                END,
                expires_at = CASE
                  WHEN cache_entries.expires_at IS NOT NULL
                       AND cache_entries.expires_at <= NOW()
                    THEN CASE WHEN $2::int IS NULL THEN NULL
                              ELSE NOW() + make_interval(secs => $2::int) END
                  ELSE cache_entries.expires_at
                END,
                updated_at = NOW()
         RETURNING value`,[e,t&&t>0?t:null]);return Number(a.rows[0]?.value??0)});if(r.ok&&void 0!==r.value)return r.value;let i=Date.now(),s=N.memory.get(e);if(s&&(null===s.expiresAt||s.expiresAt>i)){let e=(Number(s.value)||0)+1;return s.value=String(e),e}return N.memory.set(e,{value:"1",expiresAt:t&&t>0?i+1e3*t:null}),1},async ping(){let e=await l(e=>e.ping());return e.ok&&"PONG"===e.value?"PONG":null}};async function o(e,t,a=604800){let r=`session:${e}`,n=JSON.stringify({...t,createdAt:t.createdAt??new Date().toISOString()}),i=await f.set(r,n,a);return"redis"===i&&await c(r,n,a),i}async function d(e){if(!e)return null;let t=await f.get(`session:${e}`);if(!t)return null;try{let e=JSON.parse(t);if(!e||"object"!=typeof e||"string"!=typeof e.userId)return null;return e}catch{return null}}async function y(e){e&&await f.del(`session:${e}`)}e.s(["u",0,y,"v",0,d,"w",0,f,"V",0,o]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__208s-yy1-_17r._.js.map