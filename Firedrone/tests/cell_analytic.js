// Um drone, uma célula: grandezas da regra do motor em função de cs (sem simulação), para FlyCart 30 e combustível do cenário 2 (w0=0,6), UR 25%.
const {load}=require('../backend/core_loader');const A=load();const m=A.MODELS.find(z=>z.name==='DJI FlyCart 30');
const w0=.6,q=.11*w0/.5,Wsmax=Math.min(8,Math.max(2,1.5+.04*m.pay)),hl=1500*(.5+25/100),ROS=10/60,vc=m.v*.85,rows=[];
for(const cs of [1,2,3,5,10,15,20,30]){const Ws=Math.min(cs,Wsmax),thr=q*Ws*cs,tgt=1.25*thr,cells=m.pay/tgt,line=cells*cs,dt=Math.max(1,Math.min(10,.5*cs/ROS)),hold=hl*Math.log2(1.25),cross=cs/ROS;
 rows.push({cs,Ws,thr,tgt,cells,line,stops:cells,dt,hold:hold/60,cross,crossDt:cross/dt,drift:15/cs,footprintRatio:Ws/cs,tStops:cells*.3,flyOver:line/vc})}
console.log(JSON.stringify({Wsmax,q,hl,rows},null,1));require('fs').writeFileSync(process.argv[2],JSON.stringify({Wsmax,q,hl,rows}))
