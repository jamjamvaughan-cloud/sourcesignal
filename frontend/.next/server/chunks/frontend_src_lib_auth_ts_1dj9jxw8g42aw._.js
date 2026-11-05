module.exports=[85349,e=>e.a(async(r,n)=>{try{var t=e.i(79603),i=e.i(36816),s=e.i(28054),o=r([t,i]);[t,i]=o.then?(await o)():o;let m="session_id";function u(e){if(!e)return"; Domain=sourcesignal.site";let r=e.split(":")[0].toLowerCase();return"lvh.me"===r?"; Domain=.lvh.me":["localhost","127.0.0.1","::1"].includes(r)?"; Domain=localhost":"; Domain=sourcesignal.site"}function a(e){if(!e)return null;let r=e.match(RegExp(`(?:^|;\\s*)${m}=([^;]+)`));return r?.[1]??null}async function l(e){try{var r;let n=await (0,t.z)(`SELECT COALESCE(
                (
                  SELECT us.plan_tier
                    FROM user_subscriptions us
                   WHERE us.user_id = u.id
                     AND us.status IN ('active', 'trialing')
                   ORDER BY us.updated_at DESC NULLS LAST
                   LIMIT 1
                ),
                o.plan,
                u.subscription_tier,
                'free'
              ) AS plan_tier
         FROM users u
         LEFT JOIN LATERAL (
           SELECT org.plan
             FROM memberships m
             JOIN organisations org ON org.id = m.organisation_id
            WHERE m.user_id = u.id
            ORDER BY CASE WHEN org.plan = 'free' THEN 1 ELSE 0 END
            LIMIT 1
         ) o ON TRUE
        WHERE u.id = $1`,[e]);if((n.rowCount??0)===0)return"free";return r=n.rows[0]?.plan_tier,"pro"===r||"enterprise"===r||"business"===r?"pro":"free"}catch(r){return(0,s.C)("auth_plan_lookup_failed",{userId:e,error:r instanceof Error?r.message:String(r)}),"free"}}async function c(e){let r=await (0,t.z)(`SELECT o.id, o.name, o.country, o.plan, o.stripe_customer_id
       FROM organisations o
       JOIN memberships m ON m.organisation_id = o.id
      WHERE m.user_id = $1
      ORDER BY m.created_at ASC NULLS LAST
      LIMIT 1`,[e]);if((r.rowCount??0)===0)return null;let n=r.rows[0];return{id:n.id,name:n.name,country:n.country??null,plan:n.plan??"free",stripeCustomerId:n.stripe_customer_id??null}}async function E(e){if(!e)return null;let r=a(e);if(!r)return null;try{let e=await (0,i.v)(r);if(!e)return null;let n=await (0,t.z)(`SELECT u.id, u.email,
             o.country,
             u.country_preferences
         FROM users u
         LEFT JOIN LATERAL (
           SELECT org.country
             FROM memberships m
             JOIN organisations org ON org.id = m.organisation_id
            WHERE m.user_id = u.id
            ORDER BY m.created_at ASC NULLS LAST
            LIMIT 1
         ) o ON TRUE
        WHERE u.id = $1`,[e.userId]);if((n.rowCount??0)===0)return null;let s=n.rows[0];return{id:s.id,email:s.email,country:(Array.isArray(s.country_preferences)&&s.country_preferences[0]?s.country_preferences[0]:null)??s.country}}catch(e){return(0,s.C)("auth_session_lookup_failed",{sessionId:r.slice(0,12),error:e instanceof Error?e.stack??e.message:String(e)}),null}}e.s(["v",0,604800,"m",0,function(e,r=604800,n){let t=n?.split(":")[0].toLowerCase()==="lvh.me"||n?.includes("localhost")||n?.includes("127.0.0.1"),i=n?u(n):"; Domain=sourcesignal.site";return`${m}=${e}; Path=/; HttpOnly${t?"; SameSite=Lax":"; SameSite=None"}; Max-Age=${r}${t?"":"; Secure"}${i}`},"N",0,function(e){e?.split(":")[0].toLowerCase()==="lvh.me"||e?.includes("localhost")||e?.includes("127.0.0.1");let r=e?.includes("lvh.me")||e?.includes("localhost")?"":"; Secure",n=e?u(e):"; Domain=sourcesignal.site";return`${m}=; Path=/; HttpOnly; SameSite=None; Max-Age=0${r}${n}`},"i",0,E,"I",0,c,"D",0,l,"Y",0,a]),n()}catch(e){n(e)}},!1)];

//# sourceMappingURL=frontend_src_lib_auth_ts_1dj9jxw8g42aw._.js.map