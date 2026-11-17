const {load}=require('../backend/core_loader');const A=load();
const d=A.FUELS[1].d,T=['indireto','cercamento'];
const AT=A.MODELS.find(z=>z.name.includes('AT-802')),AT19={...AT,pay:1900};
const base={fi:1,area:6000,a0:10,wdir:d.wdir,slope:d.slope,sdir:d.sdir,temp:d.temp,brel:d.brel,maxloss:1e9,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5};
const med=a=>{a=a.slice().sort((x,y)=>x-y);return a[a.length>>1]};
const rows=[];
for(const wind of [2,3,4])for(const rh of [30,45])for(const a0 of [10,40])for(const bd of [3000,10000])for(const dl of [1800,7200]){
 const p={...base,wind,rh,a0,bdist:bd,delay:dl};p.cs=A.resolve(p).cs;
 const t0=Date.now();const R=[];
 for(const sd of [1,2,3]){const r=A.bestOf(p,AT19,4,sd,T,{tstop:120*3600});R.push(r)}
 const nc=A.simulate(p,AT19,0,'indireto',1,{tstop:120*3600});
 console.log(JSON.stringify({wind,rh,a0,bd,dl,cs:p.cs,nc:Math.round(nc.burnedHa),ha:Math.round(med(R.map(r=>r.burnedHa))),fh:+med(R.map(r=>r.flightH)).toFixed(1),kL:Math.round(med(R.map(r=>r.litres))/1000),tc:med(R.map(r=>r.tCont==null?-1:r.tCont/3600)).toFixed(1),s:((Date.now()-t0)/1000)|0}));
}
