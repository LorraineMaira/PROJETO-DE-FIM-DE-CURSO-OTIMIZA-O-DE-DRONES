// Um drone, janela pequena: efeito isolado da resolução espacial (1 m até a malha da otimização) sobre o lançamento e a barreira.
const {load}=require('../backend/core_loader');const A=load();
const fs=require('fs');const out=process.argv[2]||'cell_test.json';
const m=A.MODELS.find(z=>z.name==='DJI FlyCart 30');
const base=(fi)=>{const d=A.FUELS[fi].d;return{fi,area:4,a0:.1,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:120,brel:d.brel,delay:0,maxloss:1e9,noise:0,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5}};
const res={model:m.name,pay:m.pay,rows:[]};
for(const fi of (process.argv[3]||"9,4,7").split(",").map(Number)){for(const cs of [1,2,3,5,10,15,20,30]){for(const tac of ['indireto','direto']){
 const p={...base(fi),cs};const t0=Date.now();
 const r0=A.simulate(p,{...m,pay:0,end:0},0,'indireto',1,{}); // sem drone
 const r=A.simulate(p,m,1,tac,1,{});const W=r.W;
 res.rows.push({fi:fi+1,cs:W.cs,N:W.N,dt:W.dt,tac,Rh:W.Rmax*60,Ws:r.Ws,thrB:r.thrB,litres:r.litres,drops:r.drops,lineM:r.lineM,sorties:r.sorties,burned:r.burnedHa,burned0:r0.burnedHa,tCont:r.tCont,ok:r.ok,ms:Date.now()-t0});
 console.log(fi+1,cs,tac,'N',W.N,'dt',W.dt.toFixed(1),'Ws',r.Ws.toFixed(1),'thrB',r.thrB.toFixed(2),'L',Math.round(r.litres),'lin',Math.round(r.lineM),'drops',Math.round(r.drops),'ha',r.burnedHa.toFixed(2),'sem',r0.burnedHa.toFixed(2),Date.now()-t0,'ms')}}}
fs.writeFileSync(out,JSON.stringify(res,null,1));
