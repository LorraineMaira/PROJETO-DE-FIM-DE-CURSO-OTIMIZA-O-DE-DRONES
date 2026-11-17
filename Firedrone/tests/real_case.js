// Caso real (Serra do Cipó, ago/2024): meios reais (2 Air Tractor, 1 helicóptero) e frotas simuladas no cenário 13, mesma incerteza.
const fs=require('fs');const {load}=require('../backend/core_loader'),{makePool}=require('../backend/nodepool');const A=load();
const outf=process.argv[2],fi=12,T=['indireto','cercamento'];
const d=A.FUELS[fi].d,p={fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5};
(async()=>{const pool=makePool();const rs=await pool.run('resolve',{p});p.cs=rs.cs;const W=A.world(p,1);
 const m0=A.MODELS.find(z=>z.name==='DJI FlyCart 30'),bare=await pool.run('bare',{p,m:m0});const ser=bare.ser;
 const first=(ha)=>{const i=ser.findIndex(x=>x>=ha);return i<0?null:i};
 const out={cs:p.cs,N:W.N,dt:W.dt,ROS:W.Rmax*60,semDrones:bare.burnedHa,tempoHa:{h50:first(50),h200:first(200),h478:first(478),h800:first(790)},ser:ser.filter((_,i)=>i%5==0),fleets:[]};
 const F=[['AT-802',2],['AT-802',3],['AS350 B3',1],['AS350 B3',4],['DJI FlyCart 30',32]];
 for(const [nm,n] of F){const m=A.MODELS.find(z=>z.name.includes(nm));const D=await A.mcDistribution(pool,p,m,n,T,24,A.UNC0,()=>{},6000);
  out.fleets.push({modelo:m.name,n,P:D.P,ci:D.ci,burned:D.burned,op:A.opSummary(D.reps)});console.log(m.name,n,D.P.toFixed(2),JSON.stringify(D.burned));fs.writeFileSync(outf,JSON.stringify(out,null,1))}
 pool.close()})();
