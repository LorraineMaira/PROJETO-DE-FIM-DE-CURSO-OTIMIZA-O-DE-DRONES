// Dependência da malha: frota mínima (1 réplica, maioria de 3 de 5 sementes) em células de 30/20/15 m para cenários escolhidos.
// Uso: node test_mesh.js [cenarios,separados,por,virgula] [modelo]
const {load}=require('../backend/core_loader'),{makePool}=require('../backend/nodepool');const A=load();
const sel=(process.argv[2]||'0,1,3,6,12').split(',').map(Number),mn=process.argv[3]||'Spider H40X',m=A.MODELS.find(x=>x.name===mn),T=['indireto','cercamento'];
const params=fi=>{const d=A.FUELS[fi].d;return{fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,wcost:5}};
(async()=>{const pool=makePool();console.log('Frota mínima (maioria 3/5 sementes) de',mn,'por tamanho de célula; 0 = não contém com 60\n');console.log('cenário'.padEnd(40),'30 m  20 m  15 m   variação');
 for(const fi of sel){const p=params(fi),side=Math.sqrt(p.area*1e4),r={};
  await Promise.all([30,20,15].filter(c=>side/c<=200).map(async c=>{const x=await pool.run('minN3',{p:{...p,cs:c},m,nMax:60,tacs:T,cost:false});r[c]=x.n}));
  const v=Object.values(r).filter(x=>x!=null),lo=Math.min(...v),hi=Math.max(...v);
  console.log((A.FUELS[fi].name.slice(0,38)).padEnd(40),[30,20,15].map(c=>String(r[c]===undefined?'—':r[c]==null?'✗':r[c]).padEnd(6)).join(''),v.length>1?`${lo}–${hi} (${((hi-lo)/Math.max(1,lo)*100).toFixed(0)}%)`:'')}
 pool.close()})();
