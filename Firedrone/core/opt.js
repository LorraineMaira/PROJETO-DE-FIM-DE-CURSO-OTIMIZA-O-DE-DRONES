// ================= NÚCLEO COMPARTILHADO: incerteza (Monte Carlo), otimização com risco, tornado, operações p/ workers =================
// Roda igual no navegador (Web Workers), no Node (worker_threads) e em thread única (fallback). Sem DOM.
// ---- incertezas padrão: meia-largura de uma distribuição uniforme em torno do valor-base ----
const UNC_INFO=[
 {k:'wind',lab:'Velocidade do vento',un:'± %',mul:1,def:.20,eng:1,src:'Previsão de vento a 10 m tem erro típico de 15–30% (INMET/modelos numéricos)'},
 {k:'wdir',lab:'Direção do vento',un:'± °',mul:0,def:15,eng:1,src:'Erro típico de direção em previsão de superfície: 10–20°'},
 {k:'rh',lab:'Umidade relativa',un:'± p.p.',mul:0,def:5,eng:1,src:'Erro de previsão/sensor de UR: 3–8 p.p.'},
 {k:'delay',lab:'Tempo de resposta (detecção+despacho)',un:'± %',mul:1,def:.30,eng:1,src:'Variabilidade operacional; sem série pública'},
 {k:'w0',lab:'Carga de combustível',un:'± %',mul:1,def:.15,eng:1,src:'Variação espacial de carga em campo: 15–30%'},
 {k:'ratio',lab:'Água por kg de combustível (razão de molhamento)',un:'± %',mul:1,def:.25,eng:1,src:'ESTIMADO (calibração do modelo de linha molhada)'},
 {k:'lmax',lab:'Limite de chama p/ ataque direto',un:'± %',mul:1,def:.20,eng:1,src:'ESTIMADO (chama máx. ≈ 2,4 m + 0,012·carga)'},
 {k:'rf',lab:'Tempo de recarga/troca de bateria',un:'± %',mul:1,def:.25,eng:1,src:'ESTIMADO (120 s + 1,2 s/L)'},
 {k:'speed',lab:'Velocidade de cruzeiro dos drones',un:'± %',mul:1,def:.10,eng:1,src:'Fabricante vs. vento/carga real'},
 {k:'rrf',lab:'Taxa de reignição de brasas',un:'± %',mul:1,def:.50,eng:1,src:'ESTIMADO (sem dado de campo)'},
 {k:'cx',lab:'Preço dos drones (CapEx)',un:'± %',mul:1,def:.25,eng:0,src:'Preços ESTIMADOS (exceto modelos com tabela pública)'},
 {k:'ws',lab:'Largura da faixa molhada por lançamento',un:'± %',mul:1,def:.25,eng:1,src:'ESTIMADO (largura = 1,5 m + 0,04 m/L de carga; define quanto a carga extra rende em metros de linha)'},
 {k:'logd',lab:'Custo logístico por drone por operação',un:'± %',mul:1,def:.50,eng:0,src:'ESTIMADO (piloto/auxiliar, baterias, transporte e montagem por drone)'},
 {k:'ox',lab:'Custo operacional por hora de voo',un:'± %',mul:1,def:.40,eng:0,src:'ESTIMADO (manutenção, baterias, pessoal)'},
 {k:'wcost',lab:'Custo da água',un:'± %',mul:1,def:.50,eng:0,src:'ESTIMADO (transporte e captação)'}];
const UNC0=Object.fromEntries(UNC_INFO.map(x=>[x.k,x.def]));
const UKEYS=UNC_INFO.map(x=>x.k);
// Amostragem: hipercubo latino por blocos de LB réplicas. Em cada bloco, cada parâmetro tem exatamente uma amostra por faixa de 1/LB (marginais perfeitas),
// com permutações aleatórias reprodutíveis entre os parâmetros. Blocos sucessivos são independentes, então K pode crescer de 10 em 10 sem perder a estratificação.
// (A sequência de Halton usada antes tinha, em janelas de ~20 réplicas, marginais enviesadas nas bases altas; isso distorcia P.)
const LB=10;
function uvec(k,keys=UKEYS,seed=777){const b=Math.floor(k/LB),j=k%LB,u={};
 keys.forEach((key,d)=>{const R=rng(seed+1000003*b+7919*(d+1)),perm=Array.from({length:LB},(_,i)=>i);
  for(let i=LB-1;i>0;i--){const t=Math.floor(R()*(i+1));[perm[i],perm[t]]=[perm[t],perm[i]]}
  let jit=0;for(let i=0;i<=j;i++)jit=R();   // sorteio de posição dentro do estrato, por réplica
  u[key]=2*((perm[j]+jit)/LB)-1});return u}
const clampN=(v,a,b)=>Math.max(a,Math.min(b,v));
function applyU(p,m,unc,u){const f=k=>1+(u[k]||0)*(unc[k]||0);
 const p2={...p,wind:Math.max(.3,p.wind*f('wind')),wdir:p.wdir+(u.wdir||0)*(unc.wdir||0),rh:clampN(p.rh+(u.rh||0)*(unc.rh||0),5,95),delay:Math.max(0,(p.delay||0)*f('delay')),w0f:f('w0'),ratio:(p.ratio||RATIO)*f('ratio'),lmf:f('lmax'),wsf:f('ws'),logd:(p.logd||0)*f('logd'),rrf:f('rrf'),wcost:p.wcost*f('wcost')};
 const m2={...m,rf:m.rf*f('rf'),v:m.v*f('speed'),cx:m.cx*f('cx'),ox:m.ox*f('ox')};return{p2,m2}}
const sumR=(r,c)=>({ok:r.ok,burned:r.burnedHa,tactic:r.tactic,litres:r.litres,flightH:r.flightH,tCont:r.tCont,tExt:r.tExt,tEnd:r.tEnd,esc:r.esc,depot:r.depotHit>=0,contained:r.contained,extinct:r.extinct,drops:r.drops,sorties:r.sorties,rounds:r.rounds,lineM:r.lineM,headM:r.headM,tot:c.tot,capex:c.capex,opex:c.opex});
function wilson(k,n,z=1.96){if(!n)return[0,1];const ph=k/n,d=1+z*z/n,c=ph+z*z/(2*n),a=z*Math.sqrt(ph*(1-ph)/n+z*z/(4*n*n));return[Math.max(0,(c-a)/d),Math.min(1,(c+a)/d)]}
function pct(a,q){if(!a.length)return NaN;const s=[...a].sort((x,y)=>x-y),i=(s.length-1)*q,l=Math.floor(i),h=Math.ceil(i);return s[l]+(s[h]-s[l])*(i-l)}
// ---- operações executadas nos workers (entrada e saída serializáveis) ----
const OPS={
 eval(a){const{p,m,n,seed=1,tacs,fast=1,rep=null,unc,keys}=a;let p2=p,m2=m,sd=seed;if(rep!=null){({p2,m2}=applyU(p,m,unc||UNC0,uvec(rep,keys||UKEYS)));sd=seed+rep}
  const r=bestOf(p2,m2,n,sd,tacs,{fast}),c=costs(p2,m2,n,r);return sumR(r,c)},
 minFleet(a){const{p,m,nMax,tacs,seed=1}=a,ev=n=>bestOf(p,m,n,seed,tacs,{fast:1}),top=ev(nMax);if(!top.ok)return{nMin:null};
  let lo=1,hi=nMax,best=top;while(lo<hi){const mid=(lo+hi)>>1,r=ev(mid);if(r.ok){hi=mid;best=r}else lo=mid+1}const c=costs(p,m,hi,best);return{nMin:hi,tactic:best.tactic,tot:c.tot,capex:c.capex}},
 // menor n que contém em ≥ 3 de 5 sementes (usado no tornado: mais estável que 1 semente)
 minN3(a){const{p,m,nMax,tacs,u}=a;let p2=p,m2=m;if(u)({p2,m2}=applyU(p,m,a.unc||UNC0,u));
  const ok=n=>{let k=0,f=0;for(const sd of[1,2,3,4,5]){if(bestOf(p2,m2,n,sd,tacs,{fast:1}).ok)k++;else f++;if(k>=3)return true;if(f>=3)return false}return false};
  if(!ok(nMax))return{n:null};let lo=1,hi=nMax;while(lo<hi){const mid=(lo+hi)>>1;if(ok(mid))hi=mid;else lo=mid+1}
  if(a.cost===false)return{n:hi};
  // custo = média de 5 execuções COMPLETAS (variação entre sementes é ±15%: uma só semente deixaria o tornado ruidoso)
  let tot=0,fl=0,li=0,tc={};for(const sd of[1,2,3,4,5]){const r=bestOf(p2,m2,hi,sd,tacs,{fast:0}),c=costs(p2,m2,hi,r);tot+=c.tot/5;fl+=r.flightH/5;li+=r.litres/5;tc[r.tactic]=(tc[r.tactic]||0)+1}
  return{n:hi,flightH:fl,litres:li,tot,capex:m2.cx*hi,tactic:Object.entries(tc).sort((a,b)=>b[1]-a[1])[0][0]}},
 // simulação completa para exibição (mantém campos espaciais)
 // simulação completa p/ exibição; rec=true grava quadros p/ a animação
 full(a){const{p,m,n,tactic,seed=1,tacs,rec=false}=a,o={rec};if(tactic&&tactic!=='auto')return simulate(p,m,n,tactic,seed,o);
  const b=bestOf(p,m,n,seed,tacs||Object.keys(TACTICS),{fast:1});return simulate(p,m,n,b.tactic,seed,o)},
 // variação de um parâmetro (sensibilidade): resultado resumido + ROS da cabeça
 sens(a){const{p,m,n,tactic,seed=1}=a,rr=simulate(p,m,n,tactic,seed,{fast:1}),W=world(p,1),c=(W.iy|0)*W.N+(W.ix|0);return{burned:rr.burnedHa,ok:rr.ok,ros:W.Rh[c]}},
 // análise mecanicista do rankeamento de drones por simulação completa de um (modelo, n)
 cost(a){const{p,m,n,tactic}=a,r=simulate(p,m,n,tactic,1,{}),c=costs(p,m,n,r);return{tot:c.tot,opex:c.opex,capex:c.capex,ok:r.ok,burned:r.burnedHa}},
 ping(){return 1},
 // fogo sem drones (referência) e resumo por tática, p/ a interface
 bare(a){const r=simulate(a.p,a.m,0,'cercamento',1,{tstop:4*3600});return{ser:r.ser,burnedHa:r.burnedHa}},
 tact(a){const r=simulate(a.p,a.m,a.n,a.tactic,1,{fast:1});return{tactic:r.tactic,burnedHa:r.burnedHa,extHa:r.extHa,lineM:r.lineM,litres:r.litres,sorties:r.sorties,ok:r.ok}},
 conv(a){return resolve(a.p,true)},
 resolve(a){return resolve(a.p)}
};
// ---- orquestração (pool: {size, run(op,args)->Promise}) ----
const J_OBJ=OBJ;
async function mcFleet(pool,p,m,n0,nMax,tacs,o,prog=()=>{}){ // menor n com P(conter) ≥ α sob incerteza
 const K=o.K,alpha=o.alpha,need=Math.ceil(alpha*K-1e-9),allow=K-need,unc=o.unc||UNC0;let n=n0,capped=false,reps=[],iter=0;
 const side=Math.sqrt(p.area*1e4);
 for(;;){reps=[];let fails=0,succ=0,i=0;
  while(i<K&&fails<=allow&&succ<need){const b=Math.min(pool.size,K-i),idx=Array.from({length:b},(_,j)=>i+j),rs=await Promise.all(idx.map(r=>pool.run('eval',{p,m,n,seed:1,tacs,fast:1,rep:r,unc})));for(const s of rs){reps.push(s);s.ok?succ++:fails++}i+=b}
  let pass=succ>=need;prog(`n=${n}: ${succ}/${reps.length} réplicas contiveram`);
  if(pass&&o.validate!==false){ // validação em malha mais fina (incerteza numérica): ≥ 2 de 3 réplicas
   const cf=[20,15].find(c=>c<p.cs&&side/c<=200);if(cf){const rs=await Promise.all([0,1,2].map(r=>pool.run('eval',{p:{...p,cs:cf},m,n,seed:1,tacs,fast:1,rep:r,unc})));if(rs.filter(s=>s.ok).length<2)pass=false}}
  if(pass)break;if(n>=nMax){capped=true;break}n=Math.min(nMax,Math.max(n+1,Math.ceil(n*1.12)));if(++iter>40){capped=true;break}}
 return{n,capped,reps}}
// Confirmação com réplicas NOVAS (índices ≥ 1000, nunca usadas na busca). A busca escolhe o menor n que passou, o que superestima P (viés do vencedor);
// aqui n sobe (+10%) até a meta valer nas réplicas independentes.
async function confirmFleet(pool,p,m,n,nMax,tacs,o,prog=()=>{}){const Kc=o.confirmK||20,alpha=o.alpha,unc=o.unc||UNC0;let it=0,D;
 for(;;){D=await mcDistribution(pool,p,m,n,tacs,Kc,unc,t=>prog(`n=${n}: ${t}`),1000);
  if(D.P>=alpha-1e-9)return{n,D,capped:false,it};
  if(n>=nMax||++it>12)return{n,D,capped:true,it};
  n=Math.min(nMax,Math.max(n+1,Math.ceil(n*1.1)))}}
async function optimizeFleetPar(pool,p,models,nMax,objKey='custo',tacs=['indireto','cercamento'],o={},prog=()=>{}){
 o={mode:'mc',alpha:.9,K:10,unc:UNC0,topK:4,...o};const J=J_OBJ[objKey]||J_OBJ.custo,rows=new Array(models.length);let done=0;
 await Promise.all(models.map(async(m,mi)=>{const r=await pool.run('minFleet',{p,m,nMax,tacs});done++;prog(`Triagem ${done}/${models.length}: ${m.name}`);
  if(r.nMin==null){rows[mi]={m,mi,nMin:null};return}const cc={tot:r.tot,capex:r.capex};rows[mi]={m,mi,nMin:r.nMin,score:J(cc,m,r.nMin),tot:r.tot,tactic:r.tactic}}));
 const all=rows.filter(r=>r.nMin!=null).sort((a,b)=>a.score-b.score),isH=r=>r.m.kind==='heli',feas=[...new Set([...all.filter(r=>!isH(r)).slice(0,o.topK),...all.filter(isH).slice(0,o.heliK||2),...all.filter(r=>r.m.ref)])].sort((a,b)=>a.score-b.score),K=feas.length;
 await Promise.all(feas.map(async(r,k)=>{
  if(o.mode==='det'){r.nRob=r.nMin;r.capped=false;r.tacticRob=r.tactic;r.P=null;const fr=await pool.run('eval',{p,m:r.m,n:r.nMin,seed:1,tacs,fast:0});r.totRob=fr.tot;r.scoreRob=J({tot:fr.tot,capex:r.m.cx*r.nMin},r.m,r.nMin);return}
  const f=await mcFleet(pool,p,r.m,r.nMin,nMax,tacs,o,t=>prog(`Risco ${r.m.name}: ${t}`));r.nRob=f.n;r.capped=f.capped;r.mc=f.reps;
  const okc=f.reps.filter(s=>s.ok).length,n=f.reps.length;r.P=n?okc/n:0;r.Pci=wilson(okc,n);
  // custo com simulações COMPLETAS (até a extinção): 3 réplicas; as rápidas param na contenção e subestimam voo e água
  const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length),fr=await Promise.all([0,1,2].map(rp=>pool.run('eval',{p,m:r.m,n:f.n,seed:1,tacs,fast:0,rep:rp,unc:o.unc}))),tot=mean(fr.map(s=>s.tot));r.totRob=tot;
  const tc={};f.reps.forEach(s=>tc[s.tactic]=(tc[s.tactic]||0)+1);r.tacticRob=Object.entries(tc).sort((a,b)=>b[1]-a[1])[0][0];
  r.scoreRob=J({tot,capex:r.m.cx*f.n},r.m,f.n)}));
 let ref=feas.slice().sort((a,b)=>(a.capped-b.capped)||(a.scoreRob-b.scoreRob));
 if(o.mode==='mc'&&o.confirm!==false){ // confirma os 2 melhores em réplicas independentes e reordena
  const nc=ref.filter(r=>!r.capped),top=[...new Set([...nc.slice(0,o.confirmTop||2),...['heli',undefined].map(k=>nc.find(r=>r.m.kind===k)).filter(Boolean),...nc.filter(r=>r.m.ref)])];
  await Promise.all(top.map(async r=>{const c=await confirmFleet(pool,p,r.m,r.nRob,nMax,tacs,o,t=>prog(`Confirmação ${r.m.name}: ${t}`));
   r.nSearch=r.nRob;r.nRob=c.n;r.capped=c.capped;r.P=c.D.P;r.Pci=c.D.ci;r.confirmed=true;r.Kconf=c.D.K;r.confIters=c.it;
   const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length),fr=await Promise.all([0,1,2].map(rp=>pool.run('eval',{p,m:r.m,n:c.n,seed:1,tacs,fast:0,rep:1000+rp,unc:o.unc})));
   r.totRob=mean(fr.map(x=>x.tot));r.scoreRob=J({tot:r.totRob,capex:r.m.cx*c.n},r.m,c.n);
   const tc={};c.D.reps.forEach(x=>tc[x.tactic]=(tc[x.tactic]||0)+1);r.tacticRob=Object.entries(tc).sort((a,b)=>b[1]-a[1])[0][0];r.mcConf=c.D}));
  ref=ref.sort((a,b)=>(a.capped-b.capped)||(a.scoreRob-b.scoreRob))}
 // métricas operacionais de cada finalista: réplicas com incerteza (as da confirmação, quando existem; senão K novas, índices ≥ 3000)
 if(o.ops!==false){const Kop=o.mode==='det'?4:10;await Promise.all(ref.map(async r=>{const reps=r.mcConf?r.mcConf.reps:(await mcDistribution(pool,p,r.m,r.nRob,tacs,Kop,o.unc,()=>{},3000)).reps;r.op=opSummary(reps)}))}
 return{best:ref[0]||null,refined:ref,rows:rows.filter(Boolean).sort((a,b)=>(a.nMin==null)-(b.nMin==null)||((a.score||0)-(b.score||0))),opts:{mode:o.mode,alpha:o.alpha,K:o.K,confirmK:o.confirmK||20,confirm:o.confirm!==false}}}
function opSummary(reps){const n=reps.length,M=a=>{const v=a.filter(x=>x!=null&&isFinite(x));return v.length?pct(v,.5):null},mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
 return{n,P:reps.filter(s=>s.ok).length/Math.max(1,n),burned:M(reps.map(s=>s.burned)),tCont:M(reps.map(s=>s.tCont)),nCont:reps.filter(s=>s.tCont!=null).length,tExt:M(reps.map(s=>s.tExt)),nExt:reps.filter(s=>s.tExt!=null).length,litres:mean(reps.map(s=>s.litres)),flightH:mean(reps.map(s=>s.flightH)),drops:mean(reps.map(s=>s.drops)),sorties:mean(reps.map(s=>s.sorties)),lineM:mean(reps.map(s=>s.lineM)),depot:reps.filter(s=>s.depot).length,esc:reps.filter(s=>s.esc).length}}
// distribuição do resultado para um (modelo, n): K réplicas com incerteza, sem parada antecipada
async function mcDistribution(pool,p,m,n,tacs,K,unc,prog=()=>{},off=0){const idx=Array.from({length:K},(_,i)=>i),res=[];
 for(let i=0;i<K;i+=pool.size){const rs=await Promise.all(idx.slice(i,i+pool.size).map(r=>pool.run('eval',{p,m,n,seed:1,tacs,fast:0,rep:off+r,unc})));res.push(...rs);prog(`Monte Carlo ${res.length}/${K}`)}
 const ok=res.filter(s=>s.ok).length,B=res.map(s=>s.burned),T=res.map(s=>s.tot);
 return{K,ok,P:ok/K,ci:wilson(ok,K),burned:{p10:pct(B,.1),p50:pct(B,.5),p90:pct(B,.9),max:Math.max(...B)},cost:{p10:pct(T,.1),p50:pct(T,.5),p90:pct(T,.9)},tExt:res.filter(s=>s.tExt!=null).map(s=>s.tExt),reps:res}}
// tornado: efeito de cada incerteza (nos extremos −/+) na frota necessária e no custo por operação, p/ o modelo escolhido
async function tornado(pool,p,m,nMax,tacs,unc,prog=()=>{}){
 // Parâmetros de MOTOR: efeito na frota necessária n (maioria 3 de 5 sementes). O custo é recalculado com o consumo (horas de voo, água) da simulação-base,
 // porque o consumo de uma execução varia ±15% só por semente e mascararia o efeito. Parâmetros ECONÔMICOS: efeito analítico sobre o custo da base.
 const base=await pool.run('minN3',{p,m,nMax,tacs});if(base.n==null)return{base:null,rows:[]};
 const rows=[];let done=0;const cons={flightH:base.flightH,litres:base.litres};
 await Promise.all(UNC_INFO.map(async x=>{const w=unc[x.k]||0;if(!w)return;const out=[];
  for(const s of[-1,1]){
   if(x.eng){const r=await pool.run('minN3',{p,m,nMax,tacs,u:{[x.k]:s},unc,cost:false});out.push(r.n==null?{n:null}:{n:r.n,tot:costs(p,m,r.n,cons).tot,capex:m.cx*r.n})}
   else{const{p2,m2}=applyU(p,m,unc,{[x.k]:s}),c=costs(p2,m2,base.n,cons);out.push({n:base.n,tot:c.tot,capex:c.capex})}}
  done++;prog(`Tornado ${done}/${UNC_INFO.length}: ${x.lab}`);rows.push({k:x.k,lab:x.lab,un:x.un,w,eng:x.eng,lo:out[0],hi:out[1]})}));
 const bc=costs(p,m,base.n,cons);base.totRef=bc.tot;
 rows.forEach(r=>{const d=s=>s.n==null?null:s.tot-bc.tot,dn=s=>s.n==null?null:s.n-base.n;r.dLo=d(r.lo);r.dHi=d(r.hi);r.dnLo=dn(r.lo);r.dnHi=dn(r.hi);r.swing=Math.max(Math.abs(r.dLo??1e9),Math.abs(r.dHi??1e9))});
 rows.sort((a,b)=>b.swing-a.swing);return{base,rows}}
// pool de thread única (fallback): mesma interface, cede o laço de eventos entre tarefas
function inlinePool(){let chain=Promise.resolve();return{size:4,inline:true,run(op,args){const t=chain.then(()=>new Promise(r=>setTimeout(r,0))).then(()=>OPS[op](args));chain=t.catch(()=>{});return t},close(){}}}
