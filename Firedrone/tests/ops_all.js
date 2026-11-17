// Reexecuta as aeronaves tripuladas (as 5 do catálogo, AS350 B3 sempre incluída) e calcula as métricas operacionais (réplicas com incerteza, índices >= 3000)
// de TODOS os finalistas dos 13 cenários, atualizando o ranking de results_13.json. Uso: node ops_all.js results_13.json [K] [alpha]
const fs=require('fs');const {load}=require('../backend/core_loader'),{makePool}=require('../backend/nodepool');const A=load();
const file=process.argv[2],K=+process.argv[3]||10,alpha=+process.argv[4]||.9,res=JSON.parse(fs.readFileSync(file)),H=A.MODELS.filter(m=>m.kind==='heli'),T=['indireto','cercamento'];
const params=fi=>{const d=A.FUELS[fi].d;return{fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5}};
(async()=>{const pool=makePool();for(const fi of Object.keys(res).map(Number)){if(res[fi].as350Inviavel!==undefined){console.log(fi+1,'já feito');continue}const p=params(fi),d=A.FUELS[fi].d,nMax=d.n||60,t0=Date.now();p.cs=res[fi].cs;
 const o=await A.optimizeFleetPar(pool,p,H,nMax,'custo',T,{K,alpha,heliK:5},()=>{});
 const mk=r=>({modelo:r.m.name,nMin:r.nMin,nRisco:r.nRob,P:r.P,capped:!!r.capped,custoOp:r.totRob,capex:r.nRob*r.m.cx,tripulada:true,op:r.op,mobMin:Math.max(p.delay||0,r.m.mob||0)/60});
 const hr=o.refined.map(mk),ref=H.find(m=>m.ref),refInv=!hr.some(x=>x.modelo===ref.name);
 const dr=res[fi].ranking.filter(x=>!/^(Aeronave|Helic)/.test(x.modelo));
 for(const x of dr){const m=A.MODELS.find(z=>z.name===x.modelo),D=await A.mcDistribution(pool,p,m,x.nRisco,T,10,A.UNC0,()=>{},3000);x.op=A.opSummary(D.reps);x.mobMin=(p.delay||0)/60}
 res[fi].ranking=dr.concat(hr);res[fi].as350Inviavel=refInv;
 res[fi].triagemTrip=o.rows.map(r=>({modelo:r.m.name,nMin:r.nMin,custoOp:r.tot||null}));
 fs.writeFileSync(file,JSON.stringify(res,null,1));const a=hr.find(x=>x.modelo===ref.name);console.log(fi+1,a?'AS350 n'+a.nRisco+' $'+Math.round(a.custoOp)+' área '+(a.op?a.op.burned.toFixed(1):'-'):'AS350 inviável',((Date.now()-t0)/1000).toFixed(0)+'s')}
 pool.close()})();
