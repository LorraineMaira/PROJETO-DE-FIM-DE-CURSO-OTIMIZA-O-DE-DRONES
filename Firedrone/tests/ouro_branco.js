// Serra do Ouro Branco (set/2017): condições não medidas -> campo rupestre (cenário 2) com janela de 3000 ha, foco de 10 ha (>10 focos).
const fs=require('fs');const {load}=require('../backend/core_loader');const A=load();
const fi=1,d=A.FUELS[fi].d,T=['indireto','cercamento'];
const p={fi,area:3000,a0:10,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:600,brel:d.brel,delay:d.resp,maxloss:1e9,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5};
const rs=A.resolve(p);p.cs=rs.cs;console.log('cs',p.cs,JSON.stringify(rs).slice(0,200));
const med=a=>{a=a.slice().sort((x,y)=>x-y);return a[a.length>>1]};
const AT=A.MODELS.find(z=>z.name.includes('AT-802')),AS=A.MODELS.find(z=>z.name.includes('AS350')),FC=A.MODELS.find(z=>z.name==='DJI FlyCart 30');
const AT19={...AT,pay:1900};
const per=r=>{const N=r.W.N,Tm=r.T;let e=0;for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(Tm[y*N+x]<0)continue;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=N||Y>=N)continue;if(Tm[Y*N+X]<0)e++}}return e*r.W.cs*Math.PI/4};
const F=[['sem combate',FC,0],['4 AT-802 (3.100 L)',AT,4],['4 AT-802 (1.900 L)',AT19,4],['1 AS350 B3',AS,1],['4 AT-802 (1.900 L) + ',AT19,4],['FlyCart 30 x40',FC,40],['FlyCart 30 x80',FC,80]].slice(0,4).concat([['FlyCart 30 x40',FC,40],['FlyCart 30 x80',FC,80],['FlyCart 30 x150',FC,150]]);
const out=[];
for(const [nm,m,n] of F){const rows=[];for(const sd of [1,2,3,4,5]){const r=n?A.bestOf(p,m,n,sd,T,{}):A.simulate(p,m,0,'indireto',sd,{tstop:6*3600});const c=n?A.costs(p,m,n,r):{tot:0};rows.push({ha:r.burnedHa,per:per(r),cost:c.tot,fh:r.flightH,L:r.litres,dr:r.drops,tc:r.tCont,esc:r.esc,dep:r.depotHit>=0,tend:r.tEnd})}
 const o={nm,n,ha:med(rows.map(x=>x.ha)),perKm:med(rows.map(x=>x.per))/1000,cost:med(rows.map(x=>x.cost)),fh:med(rows.map(x=>x.fh)),kL:med(rows.map(x=>x.L))/1000,drops:med(rows.map(x=>x.dr)),tcontMin:med(rows.map(x=>x.tc==null?-1:x.tc/60)),tend_h:med(rows.map(x=>x.tend))/3600,esc:rows.filter(x=>x.esc).length};out.push(o);console.log(JSON.stringify(o))}
fs.writeFileSync(process.argv[2],JSON.stringify(out));
