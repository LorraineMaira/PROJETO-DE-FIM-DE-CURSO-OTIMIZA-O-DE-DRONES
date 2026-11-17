// Reexecuta só as aeronaves tripuladas (kind:'heli') nos 13 cenários e troca essas entradas no ranking de results_13.json. Uso: node heli_only.js results_13.json [K] [alpha]
const fs=require('fs');const {load}=require('../backend/core_loader'),{makePool}=require('../backend/nodepool');const A=load();
const file=process.argv[2],K=+process.argv[3]||10,alpha=+process.argv[4]||.9,res=JSON.parse(fs.readFileSync(file)),H=A.MODELS.filter(m=>m.kind==='heli'),T=['indireto','cercamento'];
const params=fi=>{const d=A.FUELS[fi].d;return{fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5}};
(async()=>{const pool=makePool();for(const fi of Object.keys(res).map(Number)){const p=params(fi),d=A.FUELS[fi].d,nMax=d.n||60,t0=Date.now();p.cs=res[fi].cs;
 const o=await A.optimizeFleetPar(pool,p,H,nMax,'custo',T,{K,alpha,topK:2},()=>{});
 const hr=o.refined.map(r=>({modelo:r.m.name,nMin:r.nMin,nRisco:r.nRob,P:r.P,capped:!!r.capped,custoOp:r.totRob,capex:r.nRob*r.m.cx,tripulada:true}));
 res[fi].ranking=res[fi].ranking.filter(x=>!/^(Aeronave|Helic)/.test(x.modelo)).concat(hr);
 res[fi].triagemTrip=o.rows.map(r=>({modelo:r.m.name,nMin:r.nMin,custoOp:r.tot||null}));
 fs.writeFileSync(file,JSON.stringify(res,null,1));console.log(fi+1,hr.map(h=>h.modelo.replace('Aeronave ','').slice(0,14)+' n'+h.nRisco+' $'+Math.round(h.custoOp)+(h.capped?'*':'')).join(' | '),((Date.now()-t0)/1000).toFixed(0)+'s')}
 pool.close()})();
