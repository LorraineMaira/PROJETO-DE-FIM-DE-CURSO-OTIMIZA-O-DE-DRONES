// Triagem dos 20 modelos (1 réplica): menor frota e custo por operação. Uso: node triage_models.js 0,2,6
const {load}=require('../backend/core_loader'),{makePool}=require('../backend/nodepool');const A=load();
const sel=(process.argv[2]||'2').split(',').map(Number),T=['indireto','cercamento'];
(async()=>{const pool=makePool();
for(const fi of sel){const d=A.FUELS[fi].d,p={fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,wcost:5};
 const rs=A.resolve(p);p.cs=rs.cs;const out=[];
 await Promise.all(A.MODELS.map(async m=>{const r=await pool.run('minFleet',{p,m,nMax:60,tacs:T});out.push({m:m.name,pay:m.pay,n:r.nMin,tot:r.tot})}));
 out.sort((a,b)=>(a.tot??1e9)-(b.tot??1e9));console.log('\n'+A.FUELS[fi].name,'cs',p.cs);
 out.slice(0,8).forEach(x=>console.log(' ',x.m.padEnd(36),String(x.pay).padStart(4)+' L','n='+x.n,'US$'+Math.round(x.tot)));}
pool.close()})();
