const fs=require('fs');const {load}=require('../backend/core_loader'),{makePool}=require('../backend/nodepool');const A=load();
const R=JSON.parse(fs.readFileSync(process.argv[2])),T=['indireto','cercamento'],out={};
const params=fi=>{const d=A.FUELS[fi].d;return{fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5}};
(async()=>{const pool=makePool();for(const fi of [3,6,7,9,10]){const s=R[fi],m=A.MODELS.find(z=>z.name===s.modelo),p=params(fi),rs=await pool.run('resolve',{p});p.cs=rs.cs;
 const D=await A.mcDistribution(pool,p,m,s.nRisco,T,24,A.UNC0,()=>{},2000);const f=D.reps.filter(r=>!r.ok);
 const c={n:f.length,esc:f.filter(r=>r.esc).length,depot:f.filter(r=>r.depot).length,area:f.filter(r=>!r.esc&&!r.depot&&r.burned>p.maxloss).length,naoExt:f.filter(r=>!r.esc&&!r.depot&&r.burned<=p.maxloss).length,maxloss:p.maxloss,burnedFalhas:f.map(r=>+r.burned.toFixed(2)),tExtOk:D.reps.filter(r=>r.ok&&r.tExt!=null).map(r=>Math.round(r.tExt/60))};
 out[fi+1]=c;console.log(fi+1,JSON.stringify(c))}
 fs.writeFileSync(process.argv[3],JSON.stringify(out));pool.close()})();
