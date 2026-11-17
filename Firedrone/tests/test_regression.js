// Regressão do motor: um (modelo, n) fixo em cada um dos 13 cenários; compara com tests/golden.json. Uso: node test_regression.js [--update]
const fs=require('fs'),path=require('path'),{load}=require('../backend/core_loader');const A=load(),G=path.join(__dirname,'golden.json');
const params=fi=>{const d=A.FUELS[fi].d;return{fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,wcost:5}};
const m=A.MODELS.find(x=>x.name==='Spider H40X'),T=['indireto','cercamento'],cur={};
for(let fi=0;fi<A.FUELS.length;fi++){const p=params(fi);p.cs=A.resolve(p).cs;const r=A.OPS.eval({p,m,n:20,seed:1,tacs:T,fast:1});cur[fi]={cs:p.cs,ok:r.ok,burned:+r.burned.toFixed(4),tactic:r.tactic,litres:Math.round(r.litres),tot:+r.tot.toFixed(2)}}
if(process.argv.includes('--update')||!fs.existsSync(G)){fs.writeFileSync(G,JSON.stringify(cur,null,1));console.log('golden.json gravado (',Object.keys(cur).length,'cenários )');process.exit(0)}
const gold=JSON.parse(fs.readFileSync(G));let bad=0;
for(const k of Object.keys(cur)){const a=cur[k],b=gold[k];const diff=!b||a.ok!==b.ok||a.tactic!==b.tactic||a.cs!==b.cs||Math.abs(a.burned-b.burned)>1e-3||Math.abs(a.tot-b.tot)>.01||a.litres!==b.litres;
 console.log((diff?'DIFERE ':'ok     ')+String(+k+1).padStart(2),A.FUELS[k].name.slice(0,34).padEnd(34),'cs',a.cs,a.ok?'contido':'não contido','área',a.burned,'ha',diff&&b?'(ref '+JSON.stringify(b)+')':'');if(diff)bad++}
console.log(bad?`\n${bad} cenário(s) mudaram. Se a mudança é intencional: node test_regression.js --update`:'\nRegressão OK: motor idêntico ao de referência.');process.exit(bad?1:0);
