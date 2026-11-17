// Lote: otimização com risco + Monte Carlo + tornado nos 13 cenários. Uso: node run_scenarios.js [saida.json] [K] [alpha] [cenarios]
const fs=require('fs'),path=require('path');
const {load}=require('../backend/core_loader'),{makePool}=require('../backend/nodepool');const A=load();
const out=process.argv[2]||path.join(__dirname,'results_13.json'),K=+process.argv[3]||10,alpha=+process.argv[4]||.9,only=process.argv[5]?process.argv[5].split(',').map(Number):A.FUELS.map((_,i)=>i);
const params=fi=>{const d=A.FUELS[fi].d;return{fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5}};
(async()=>{const pool=makePool(),res=fs.existsSync(out)?JSON.parse(fs.readFileSync(out)):{};const T=['indireto','cercamento'];
 for(const fi of only){if(res[fi]&&!process.env.REDO){console.log(fi,'já calculado, pulando');continue}const t0=Date.now(),p=params(fi),d=A.FUELS[fi].d,nMax=d.n||60;
  const rs=await pool.run('resolve',{p});p.cs=rs.cs;
  const o=await A.optimizeFleetPar(pool,p,A.MODELS,nMax,'custo',T,{K,alpha},()=>{}),b=o.best;
  const row={fi,nome:A.FUELS[fi].name,cs:rs.cs,N:rs.N,nMax,t_opt_s:0};row.t_opt_s=(Date.now()-t0)/1000;
  if(!b){row.inviavel=true;res[fi]=row;fs.writeFileSync(out,JSON.stringify(res,null,1));console.log(fi,row.nome,'INVIÁVEL');continue}
  row.modelo=b.m.name;row.nMin=b.nMin;row.nRisco=b.nRob;row.capped=!!b.capped;row.P=b.P;row.Pci=b.Pci;row.nBusca=b.nSearch??b.nRob;row.confirmado=!!b.confirmed;row.Kconf=b.Kconf||null;row.tatica=b.tacticRob;row.custoOp=b.totRob;row.capex=b.nRob*b.m.cx;
  row.ranking=o.refined.map(r=>({modelo:r.m.name,nMin:r.nMin,nRisco:r.nRob,P:r.P,capped:!!r.capped,custoOp:r.totRob,capex:r.nRob*r.m.cx}));
  row.triagem=o.rows.map(r=>({modelo:r.m.name,nMin:r.nMin,custoOp:r.tot||null}));
  const full=await pool.run('full',{p,m:b.m,n:b.nRob,tactic:'auto',tacs:T,rec:false}),bare=await pool.run('bare',{p,m:b.m}),c=A.costs(p,b.m,b.nRob,full);
  row.final={ok:full.ok,burnedHa:full.burnedHa,burnedHaSemDrones:bare.burnedHa,tCont:full.tCont,tExt:full.tExt,litres:full.litres,flightH:full.flightH,lineM:full.lineM,tactic:full.tactic,tot:c.tot};
  const D=await A.mcDistribution(pool,p,b.m,b.nRob,T,24,A.UNC0,()=>{},2000);row.mc={K:D.K,P:D.P,ci:D.ci,burned:D.burned,cost:D.cost,nExt:D.tExt.length};
  const tor=await A.tornado(pool,p,b.m,Math.max(nMax,b.nRob*2),T,A.UNC0);row.tornado=tor.base?{baseN:tor.base.n,rows:tor.rows.slice(0,6).map(r=>({lab:r.lab,lo:r.lo.n,hi:r.hi.n,dLo:r.dLo,dHi:r.dHi}))}:null;
  row.t_total_s=(Date.now()-t0)/1000;res[fi]=row;fs.writeFileSync(out,JSON.stringify(res,null,1));
  console.log(fi,row.nome.slice(0,32).padEnd(32),row.modelo.padEnd(22),'nMin',row.nMin,'nRisco',row.nRisco,'P',row.P,'MC P',D.P.toFixed(2),row.t_total_s.toFixed(0)+'s')}
 pool.close()})();
