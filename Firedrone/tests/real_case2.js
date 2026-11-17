// Cenário 13: área, perímetro queimado (grade, corrigido por pi/4) e custo por operação, mediana de 5 sementes.
const fs=require('fs');const {load}=require('../backend/core_loader');const A=load();
const fi=12,d=A.FUELS[fi].d,T=['indireto','cercamento'];
const p={fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5};
p.cs=A.resolve(p).cs;
const per=r=>{const N=r.W.N,Tm=r.T;let e=0;for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(Tm[y*N+x]<0)continue;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=N||Y>=N)continue;if(Tm[Y*N+X]<0)e++}}return e*r.W.cs*Math.PI/4};
const med=a=>{a=a.slice().sort((x,y)=>x-y);return a[a.length>>1]};
const F=[['sem combate',null,0],['AT-802',2],['AT-802',3],['AS350 B3',1],['AS350 B3',4],['DJI FlyCart 30',32]],out=[];
for(const [nm,n] of F){const m=nm==='sem combate'?A.MODELS.find(z=>z.name==='DJI FlyCart 30'):A.MODELS.find(z=>z.name.includes(nm));const rows=[];
 for(const sd of [1,2,3,4,5]){const r=n?A.bestOf(p,m,n,sd,T,{}):A.simulate(p,m,0,'indireto',sd,{tstop:4*3600});const c=n?A.costs(p,m,n,r):{tot:0};rows.push({ha:r.burnedHa,per:per(r),cost:c.tot,ok:r.ok,fh:r.flightH})}
 const o={nm,n,ha:med(rows.map(x=>x.ha)),perKm:med(rows.map(x=>x.per))/1000,cost:med(rows.map(x=>x.cost)),ok:rows.filter(x=>x.ok).length};o.shape=o.perKm*1000/(2*Math.sqrt(Math.PI*o.ha*1e4));out.push(o);console.log(JSON.stringify(o))}
fs.writeFileSync(process.argv[2],JSON.stringify(out));
