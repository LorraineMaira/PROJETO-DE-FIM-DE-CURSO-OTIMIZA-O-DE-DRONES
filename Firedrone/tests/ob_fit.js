const {load}=require('../backend/core_loader');const A=load();
const d=A.FUELS[1].d,T=['indireto','cercamento'];
const AT=A.MODELS.find(z=>z.name.includes('AT-802')),AT19={...AT,pay:1900};
const base={fi:1,area:6000,a0:40,wdir:d.wdir,slope:d.slope,sdir:d.sdir,temp:d.temp,brel:d.brel,maxloss:1e9,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5};
const med=a=>{a=a.slice().sort((x,y)=>x-y);return a[a.length>>1]};
for(const [wind,rh,bd,dl] of [[3,30,10000,7200],[3,30,15000,7200],[3,30,20000,7200],[3,35,15000,7200],[3,30,15000,5400],[3.3,35,15000,7200],[3,30,15000,10800]]){
 const p={...base,wind,rh,bdist:bd,delay:dl};p.cs=A.resolve(p).cs;const R=[];
 for(const sd of [1,2,3,4,5])R.push(A.bestOf(p,AT19,4,sd,T,{tstop:120*3600}));
 console.log(JSON.stringify({wind,rh,bd,dl,ha:R.map(r=>Math.round(r.burnedHa)),fh:R.map(r=>+r.flightH.toFixed(0)),kL:R.map(r=>Math.round(r.litres/1000)),ok:R.map(r=>+r.contained)}));
}
