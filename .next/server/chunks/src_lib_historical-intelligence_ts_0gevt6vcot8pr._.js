module.exports=[70759,e=>e.a(async(t,a)=>{try{var n=e.i(43793),r=t([n]);function i(e,t){let a=new Date(e).getTime();return Math.round((new Date(t).getTime()-a)/864e5)}async function o(e){let t,a=(await (0,n.z)(`SELECT id, canonical_id, title, buyer, buyer_canonical_id, sector, region,
            closing_date, estimated_value, currency, winner, signal_tier,
            created_at, updated_at
     FROM opportunities
     WHERE buyer_canonical_id IS NOT NULL
       AND winner IS NOT NULL
       AND winner != ''
       AND LOWER(buyer) = LOWER($1)
       AND created_at >= NOW() - ($2 || ' days')::interval
     ORDER BY created_at DESC`,[e,1095])).rows.filter(t=>t.buyer&&t.buyer.toLowerCase()===e.toLowerCase());if(0===a.length)return{buyer:e,totalAwards:0,uniqueSuppliers:0,topSupplier:null,topSupplierWins:0,incumbentLockIn:!1,competitiveDensityTag:"Open Market Signal: No historical award data for this buyer."};let r=new Map;for(let e of a)e.winner&&r.set(e.winner,(r.get(e.winner)??0)+1);let i=Array.from(r.entries()).sort((e,t)=>t[1]-e[1])[0],o=i?.[1]??0,l=r.size,c=a.length>0&&o/a.length>.6;return t=c?`High incumbent lock-in: Supplier "${i?.[0]}" has won ${o} out of ${a.length} contracts with this buyer over 3 years.`:l>.8*a.length?`Open Market Signal: Buyer changes suppliers on ${Math.round(l/a.length*100)}% of renewals.`:`Mixed Market: ${l} suppliers across ${a.length} awards; no dominant incumbent.`,{buyer:e,totalAwards:a.length,uniqueSuppliers:l,topSupplier:i?.[0]??null,topSupplierWins:o,incumbentLockIn:c,competitiveDensityTag:t}}async function l(e,t){let a=(await (0,n.z)(`SELECT id, canonical_id, title, buyer, buyer_canonical_id, sector, region,
            closing_date, estimated_value, currency, winner, signal_tier,
            created_at, updated_at
     FROM opportunities WHERE canonical_id = $1`,[e])).rows[0];if(!a)return null;let r=a.title,o=a.buyer,l=null!=a.estimated_value?Number(a.estimated_value):null,c=a.currency,u=a.closing_date??t??null,s=null,d=!1,_=null,y=null;if(u&&(d=(s=i(new Date().toISOString(),u))>0&&s<=120)){_=`Upcoming Renewal Risk: "${r}" (${o??"unknown buyer"}) expires in ${s} days.`;let e=[];if(a.buyer_canonical_id?e=(await (0,n.z)(`SELECT id, canonical_id, title, buyer, buyer_canonical_id, sector,
                  region, closing_date, estimated_value, currency, winner,
                  signal_tier, created_at, updated_at
             FROM opportunities
            WHERE buyer_canonical_id = $1
              AND id <> $2
              AND created_at >= NOW() - ($3 || ' days')::interval
            ORDER BY created_at DESC`,[a.buyer_canonical_id,a.id,1095])).rows:o&&(e=(await (0,n.z)(`SELECT id, canonical_id, title, buyer, buyer_canonical_id, sector,
                  region, closing_date, estimated_value, currency, winner,
                  signal_tier, created_at, updated_at
             FROM opportunities
            WHERE LOWER(buyer) = LOWER($1)
              AND id <> $2
              AND created_at >= NOW() - ($3 || ' days')::interval
            ORDER BY created_at DESC`,[o,a.id,1095])).rows),e.length>0){let t=Math.round(e.filter(e=>!!e.closing_date&&!!e.created_at&&45>=i(e.created_at,e.closing_date)).length/e.length*100);y=`Historical data shows re-tender drops ${t}% of the time within 45 days prior to expiry.`}else y="No historical re-tender data available for this buyer."}return{canonicalId:a.canonical_id,title:r,buyer:o,estimatedValue:l,currency:c,closingDate:u,daysUntilExpiry:s,isExpiringSoon:d,renewalRiskTag:_,historicalRetenderPattern:y}}async function c(e){let t=Date.now(),a=new Date(t-6048e5).toISOString(),r=new Date(t-2592e6).toISOString(),i=await (0,n.z)(`SELECT id, buyer_canonical_id, buyer, sector, region, closing_date,
            estimated_value, currency, created_at
     FROM opportunities
     WHERE buyer_canonical_id = $1 AND created_at >= $2`,[e,a]),o=await (0,n.z)(`SELECT id, buyer_canonical_id, buyer, sector, region, closing_date,
            estimated_value, currency, created_at
     FROM opportunities
     WHERE buyer_canonical_id = $1
       AND created_at >= $2
       AND created_at < $3`,[e,r,a]),l=i.rows,c=o.rows,u=l.length,s=l.reduce((e,t)=>e+(Number(t.estimated_value)||0),0),d=c.length,_=c.reduce((e,t)=>e+(Number(t.estimated_value)||0),0),y=d>0?_/(30/7):0,g=s/1,p=d>0&&g>4*y,w=null;return w=p?`Budget Flush Detected: "${e}" has released ${Math.round(g/y)}x its normal weekly volume in the last 7 days.`:u>0?`Normal spending: ${u} opportunities in the last 7 days.`:`No recent procurement activity for "${e}".`,{buyer:e,transactionCount:u,totalValue:s,averageWeeklyValue:y,isBudgetFlush:p,flushTag:w}}async function u(e,t){let a=(await (0,n.z)(`SELECT
       COUNT(*) FILTER (
         WHERE created_at >= NOW() - ($3 || ' days')::interval
       ) AS current_count,
       COUNT(*) FILTER (
         WHERE created_at >= NOW() - ($4 || ' days')::interval
           AND created_at < NOW() - ($3 || ' days')::interval
       ) AS baseline_count
     FROM opportunities
     WHERE sector = $1 AND country = $2`,[e,t,30,60])).rows[0],r=Number(a?.current_count??0),i=Number(a?.baseline_count??0),o=0,l=null;return l=(o=0===i?100*(r>0):Math.round((r-i)/i*100))>=100?`${e} signals in ${t} grew ${o}% month-over-month compared to baseline.`:o>=20?`${e} signals in ${t} show moderate growth (+${o}%).`:o<=-20?`${e} signals in ${t} declined ${Math.abs(o)}% month-over-month.`:`${e} signals in ${t} are stable (${o}% change).`,{sector:e,country:t,currentPeriodCount:r,baselinePeriodCount:i,growthPercent:o,momentumTag:l}}[n]=r.then?(await r)():r,e.s(["B",0,o,"X",0,c,"F",0,l,"T",0,u]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=src_lib_historical-intelligence_ts_0gevt6vcot8pr._.js.map