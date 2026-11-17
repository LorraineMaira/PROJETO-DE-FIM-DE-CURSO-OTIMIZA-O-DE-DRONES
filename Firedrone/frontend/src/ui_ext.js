// ===================== EXTENSÕES DE INTERFACE v6 (carregado ANTES de ui.js) =====================
// ---- pool de Web Workers: o mesmo núcleo (data+engine+opt) roda em N threads; se Worker/Blob forem bloqueados, cai em thread única ----
let _pool=null;
function prog(v,t){const b=document.getElementById('pbar');if(b)b.style.width=Math.round(Math.max(0,Math.min(1,v))*100)+'%';if(t!=null)$('status').textContent=t}
async function getPool(){if(_pool)return _pool;let ws=[];
 try{if(typeof Worker==='undefined'||typeof Blob==='undefined')throw new Error('sem Worker');
  const src=document.getElementById('core').textContent+"\nonmessage=e=>{const{id,op,args}=e.data;try{postMessage({id,res:OPS[op](args)})}catch(err){postMessage({id,err:String(err&&err.stack||err)})}};";
  const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'})),hc=navigator.hardwareConcurrency||4,size=Math.max(1,Math.min(8,hc<=2?hc:hc-1)),q=[],pend=new Map();let nid=1;
  const pump=()=>{for(const w of ws){if(w.busy||!q.length)continue;const t=q.shift();w.busy=t.id;w.postMessage({id:t.id,op:t.op,args:t.args})}};
  for(let i=0;i<size;i++){const w=new Worker(url);w.busy=null;
   w.onmessage=e=>{const m=e.data,p=pend.get(m.id);pend.delete(m.id);w.busy=null;if(p){m.err?p.rej(new Error(m.err)):p.res(m.res)}pump()};
   w.onerror=e=>{const id=w.busy;w.busy=null;if(id&&pend.has(id)){pend.get(id).rej(new Error(e.message||'erro no worker'));pend.delete(id)}};ws.push(w)}
  const pool={size,workers:true,run(op,args){return new Promise((res,rej)=>{const id=nid++;pend.set(id,{res,rej});q.push({id,op,args});pump()})}};
  await Promise.race([pool.run('ping',{}),new Promise((_,r)=>setTimeout(()=>r(new Error('tempo esgotado')),5000))]);
  _pool=pool;$('thr').textContent=size>1?'⚙ '+size+' threads em paralelo (Web Workers)':'⚙ 1 Web Worker (a tela não trava; núcleos insuficientes para paralelizar)'}
 catch(e){console.warn('Web Workers indisponíveis, usando thread única:',e);ws.forEach(w=>w.terminate());_pool=inlinePool();_pool.size=1;$('thr').textContent='⚙ thread única (Web Workers indisponíveis neste ambiente)'}
 return _pool}
const tacsOf=t=>t=='auto'?['indireto','cercamento']:[t];
// Em ambientes que bloqueiam downloads (artefato publicado, alguns navegadores embutidos) o conteúdo abre numa janela interna para copiar.
function showText(name,text){let d=document.getElementById('txtdlg');if(!d){d=document.createElement('div');d.id='txtdlg';d.style.cssText='position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML='<div style="background:var(--card);color:var(--fg);border:1px solid var(--bd);border-radius:12px;max-width:760px;width:100%;max-height:90%;display:flex;flex-direction:column;gap:8px;padding:14px"><b id="txtdlg_t"></b><p class="note" style="margin:0">Este ambiente bloqueia downloads. Copie o conteúdo e salve em um arquivo com este nome (ou abra o index.html direto no navegador, onde o download funciona).</p><textarea id="txtdlg_a" readonly style="flex:1;min-height:240px;font:12px/1.4 ui-monospace,monospace;background:var(--in);color:var(--fg);border:1px solid var(--bd);border-radius:8px;padding:8px"></textarea><div><button class="btn" id="txtdlg_c">Copiar</button> <button class="btn s" id="txtdlg_x">Fechar</button></div></div>';document.body.appendChild(d);
  $('txtdlg_x').onclick=()=>{d.style.display='none'};$('txtdlg_c').onclick=async()=>{const a=$('txtdlg_a');a.select();try{await navigator.clipboard.writeText(a.value);$('txtdlg_c').textContent='Copiado'}catch(e){document.execCommand&&document.execCommand('copy');$('txtdlg_c').textContent='Selecionado: use Ctrl+C'}}}
 d.style.display='flex';$('txtdlg_t').textContent=name;$('txtdlg_a').value=text;$('txtdlg_c').textContent='Copiar'}
const SANDBOX=typeof window!=='undefined'&&!!window.claude;
function download(name,text,type='text/plain'){if(SANDBOX){showText(name,text);return}
 try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)}catch(e){showText(name,text)}}
// ---- incertezas: tabela editável ----
function buildUnc(def){$('utab').innerHTML='<tr><th>Parâmetro</th><th>Faixa (±)</th><th>Unid.</th><th>Origem</th></tr>'+UNC_INFO.map(x=>{const v=def?(x.mul?x.def*100:x.def):(window._uncSaved&&window._uncSaved[x.k]!=null?(x.mul?window._uncSaved[x.k]*100:window._uncSaved[x.k]):(x.mul?x.def*100:x.def)),est=x.src.startsWith('ESTIMADO');
  return `<tr><td>${x.lab}</td><td><input id="u_${x.k}" type="number" min="0" step="${x.mul?1:.5}" value="${v}"></td><td>${x.un.replace('± ','')}</td><td class="src"><span class="tag ${est?'e':'m'}">${est?'E':'M'}</span> ${x.src.replace('ESTIMADO ','').replace(/^\(|\)$/g,'')}</td></tr>`}).join('')}
function readUnc(){const u={};UNC_INFO.forEach(x=>{const el=document.getElementById('u_'+x.k),v=el?+el.value:(x.mul?x.def*100:x.def);u[x.k]=Math.max(0,x.mul?v/100:v)});return u}
buildUnc(true);
$('uzero').onclick=()=>{UNC_INFO.forEach(x=>$('u_'+x.k).value=0)};$('udef').onclick=()=>buildUnc(true);
// ---- Monte Carlo + tornado ----
function histBins(vals,nb,lo,hi){const w=(hi-lo)/nb||1,c=new Array(nb).fill(0);vals.forEach(v=>{c[Math.max(0,Math.min(nb-1,Math.floor((v-lo)/w)))]++});return{c,w}}
async function runMC(){const R=LAST;if(!R){$('mcst').textContent='Execute uma simulação antes (aba Cenário → ▶).';return}
 const pool=await getPool(),unc=readUnc(),K=Math.max(8,+$('kdist').value),tacs=tacsOf($('tactic').value),{p,m,nUse}=R,t0=performance.now();$('mcgo').disabled=true;
 try{prog(.05,'Monte Carlo…');const D=await mcDistribution(pool,p,m,nUse,tacs,K,unc,s=>{$('mcst').textContent=s;prog(.05+.5*parseInt(s.split(' ')[2])/K)},2000);R.mcD=D;renderMC(D,R);
  const T=await tornado(pool,p,m,Math.max(+$('n').value,nUse*2),tacs,unc,s=>{$('mcst').textContent=s;prog(.6+.38*parseInt(s.split(' ')[1])/UNC_INFO.length)});R.tor=T;renderTornado(T,R);
  prog(1,'Pronto.');$('mcst').textContent=`Concluído em ${((performance.now()-t0)/1000).toFixed(0)} s (${pool.size} thread${pool.size>1?'s':''}).`}
 catch(e){$('mcst').textContent='Erro: '+e.message;console.error(e)}$('mcgo').disabled=false}
function renderMC(D,R){const{p,m,nUse}=R,al=+$('alpha').value/100;$('mccard').hidden=false;const ci=D.ci.map(x=>f(x*100)+'%').join('–');
 const te=D.tExt.map(x=>x/60),tq=q=>te.length?f(pct(te,q)):'—';
 $('mcstat').innerHTML=[['Prob. de contenção',f(D.P*100)+'%','IC 95%: '+ci],['Área queimada P10 / P50 / P90',f(D.burned.p10,1)+' / '+f(D.burned.p50,1)+' / '+f(D.burned.p90,1)+' ha','pior réplica '+f(D.burned.max,1)+' ha (limite '+f(p.maxloss)+')'],['Custo/op. P10 / P50 / P90','US$ '+f(D.cost.p10)+' / '+f(D.cost.p50)+' / '+f(D.cost.p90),'média ponderada pelas réplicas'],['Extinção P50 / P90',tq(.5)+' / '+tq(.9)+' min',te.length+' de '+D.K+' réplicas extinguiram']].map(a=>`<div><span>${a[0]}</span><b>${a[1]}</b><span>${a[2]}</span></div>`).join('');
 const okk=D.P>=al-1e-9;$('mcmsg').className='msg '+(okk?'ok':D.P>=.5?'warn':'bad');
 $('mcmsg').innerHTML=`${nUse} × ${m.name}: contém o fogo em <b>${f(D.P*100)}%</b> das ${D.K} réplicas (meta ${f(al*100)}%). ${okk?'A frota atende à restrição de risco.':'<b>Abaixo da meta:</b> aumente a frota ou relaxe a meta; o ponto de otimização usa menos réplicas por teste e pode ficar ligeiramente abaixo desta estimativa maior.'}`;
 const B=D.reps.map(s=>s.burned),hi=Math.max(...B,p.maxloss*1.1),bn=histBins(B,10,0,hi);
 bars('mchist',null,bn.c.map((c,i)=>({l:f(i*bn.w)+'–'+f((i+1)*bn.w),v:[c],c:[(i+.5)*bn.w>p.maxloss?'#dc2626':'#4f9d5a']})),['Réplicas'],['#4f9d5a'],{rot:1,h:260,bw:26});
 if(te.length){const b2=histBins(te,8,Math.min(...te),Math.max(...te)+1e-6);bars('mcext',null,b2.c.map((c,i)=>({l:f(Math.min(...te)+i*b2.w),v:[c]})),['Réplicas'],['#2f80c9'],{h:260,bw:26})}else $('mcext').innerHTML='<p class="note">Nenhuma réplica chegou à extinção total.</p>'}
function renderTornado(T,R){$('tocard').hidden=false;if(!T.base){$('tochart').innerHTML='<p class="note">A frota máxima não contém o fogo no caso-base: não há tornado.</p>';$('totab').innerHTML='';return}
 const rows=T.rows,mx=Math.max(1,...rows.flatMap(r=>[Math.abs(r.dLo||0),Math.abs(r.dHi||0)])),W=760,L=270,Rg=W-L-20,cx=L+Rg/2,rh=26,H=rows.length*rh+34,X=v=>cx+Rg/2*v/mx;
 let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:none;font:11px system-ui;fill:currentColor"><line x1="${cx}" x2="${cx}" y1="10" y2="${H-18}" stroke="currentColor" opacity=".5"/>`;
 rows.forEach((r,i)=>{const y=14+i*rh;s+=`<text x="${L-8}" y="${y+12}" text-anchor="end">${r.lab.length>40?r.lab.slice(0,38)+'…':r.lab} (±${r.eng&&r.un.includes('%')?f(r.w*100):f(r.w*(r.un.includes('%')?100:1))}${r.un.replace('± ','')})</text>`;
  [[r.dLo,'#2f80c9','−',r.lo],[r.dHi,'#f4a259','+',r.hi]].forEach(([d,c,sg,o],k)=>{if(d==null){s+=`<text x="${cx+(k?6:-6)}" y="${y+(k?20:8)}" text-anchor="${k?'start':'end'}" fill="#dc2626">não contém</text>`;return}
   const x0=Math.min(cx,X(d)),w=Math.abs(X(d)-cx);s+=`<rect x="${x0}" y="${y+(k?11:1)}" width="${Math.max(1,w)}" height="9" fill="${c}" rx="2"><title>${r.lab} ${sg}: n = ${o.n}; Δ custo = US$ ${f(d)}</title></rect>`;
   s+=`<text x="${d>=0?x0+w+4:x0-4}" y="${y+(k?19:9)}" text-anchor="${d>=0?'start':'end'}" font-size="10" opacity=".85">n=${o.n}</text>`})});
 s+=`<text x="${cx}" y="${H-4}" text-anchor="middle" opacity=".7">Δ custo por operação (US$) · base: n = ${T.base.n}, US$ ${f(T.base.totRef)}</text></svg>`;$('tochart').innerHTML=s;
 $('lgt').innerHTML='<span><i style="background:#2f80c9"></i>extremo inferior (−)</span><span><i style="background:#f4a259"></i>extremo superior (+)</span>';
 $('totab').innerHTML=`<table><tr><th>Parâmetro</th><th>Tipo</th><th>Faixa</th><th>Frota (−/+)</th><th>Δ frota</th><th>Δ CapEx (US$)</th><th>Δ custo/op. (US$)</th></tr>`+rows.map(r=>{const cxm=R.m.cx,dc=(a,b)=>a==null?'✗':(a>=0?'+':'')+f(a*cxm);return `<tr><td>${r.lab}</td><td>${r.eng?'motor':'econômico'}</td><td>±${r.un.includes('%')?f(r.w*100)+'%':f(r.w)+r.un.replace('± ','').replace('%','')}</td><td>${r.lo.n??'✗'} / ${r.hi.n??'✗'}</td><td>${r.dnLo==null?'✗':(r.dnLo>=0?'+':'')+r.dnLo} / ${r.dnHi==null?'✗':(r.dnHi>=0?'+':'')+r.dnHi}</td><td>${r.eng?(r.dnLo==null?'✗':(r.dnLo>=0?'+':'')+f(r.dnLo*cxm))+' / '+(r.dnHi==null?'✗':(r.dnHi>=0?'+':'')+f(r.dnHi*cxm)):(r.k=='cx'?(r.dLo==null?'✗':f(r.lo.capex-T.base.n*cxm))+' / '+f(r.hi.capex-T.base.n*cxm):'—')}</td><td>${r.dLo==null?'✗':(r.dLo>=0?'+':'')+f(r.dLo)} / ${r.dHi==null?'✗':(r.dHi>=0?'+':'')+f(r.dHi)}</td></tr>`}).join('')+'</table>'}
$('mcgo').onclick=runMC;
// ---- animação do combate ----
const AN={frames:null,i:0,play:false,last:0,acc:0,r:null,V:null,raf:0};
function setupAnim(r){AN.r=r;AN.frames=r.rec?r.rec.frames:null;AN.i=0;AN.play=false;AN.V=viewBox(r,r.routes);$('aplay').textContent='▶ Reproduzir';$('aseek').max=Math.max(0,(AN.frames||[]).length-1);$('aseek').value=0;
 if(AN.frames&&AN.frames.length)drawFrame(AN.i);else{const g=$('cvan').getContext('2d');g.clearRect(0,0,760,760);$('atime').textContent='Sem quadros gravados.'}}
function drawFrame(i){const r=AN.r,fr=AN.frames[i],cv=$('cvan'),g=cv.getContext('2d'),N=r.N,S=cv.width,V=AN.V,px=S/V.S;
 const img=cellsToCanvas(N,k=>{const c=fr.c[k];return stCol(c&7,(c>>3)&1,(c>>4)&1)});g.imageSmoothingEnabled=false;g.fillStyle='#4f6b55';g.fillRect(0,0,S,S);g.drawImage(img,V.a,N-V.b-V.S,V.S,V.S,0,0,S,S);
 const X=x=>(x-V.a)*px+px/2,Y=y=>S-((y-V.b)*px+px/2);tri(g,X(r.W.bx),Y(r.W.by),10);let fly=0,ret=0;
 for(let k=0;k<r.nDr;k++){const x=fr.d[3*k],y=fr.d[3*k+1],s=fr.d[3*k+2];if(s>=2){s==2?fly++:ret++;g.beginPath();g.arc(X(x),Y(y),4.5,0,7);g.fillStyle=s==2?'#2f80c9':'#9bd0ff';g.fill();g.lineWidth=1.2;g.strokeStyle='#fff';g.stroke()}}
 g.fillStyle='rgba(0,0,0,.55)';g.fillRect(8,8,176,50);g.fillStyle='#fff';g.font='13px system-ui';g.textAlign='left';g.fillText('t = '+f(fr.t/60,1)+' min',16,26);g.fillText('queimada: '+f(fr.burned,1)+' ha',16,46);
 g.fillStyle='#fff';g.fillRect(12,S-22,100/r.cs*px,5);g.fillText('100 m',12,S-28);
 $('aseek').value=i;$('atime').textContent=`quadro ${i+1}/${AN.frames.length} · t = ${f(fr.t/60,1)} min`;
 $('astat').innerHTML=[['Tempo',f(fr.t/60,1)+' min'],['Área queimada',f(fr.burned,1)+' ha'],['Frente em chamas',f(fr.flame*r.cs*r.cs/1e4,2)+' ha'],['Drones em voo',fly+ret+' de '+r.nDr+' ('+fly+' carregados)']].map(a=>`<div><span>${a[0]}</span><b>${a[1]}</b></div>`).join('')}
function animLoop(ts){if(!AN.play)return;const fps=12*+$('aspd').value;AN.acc+=(ts-AN.last)/1000*fps;AN.last=ts;const adv=Math.floor(AN.acc);if(adv>0){AN.acc-=adv;AN.i=Math.min(AN.frames.length-1,AN.i+adv);drawFrame(AN.i);if(AN.i>=AN.frames.length-1){AN.play=false;$('aplay').textContent='↺ Repetir';return}}AN.raf=requestAnimationFrame(animLoop)}
$('aplay').onclick=()=>{if(!AN.frames||!AN.frames.length)return;if(AN.play){AN.play=false;$('aplay').textContent='▶ Reproduzir';return}if(AN.i>=AN.frames.length-1)AN.i=0;AN.play=true;AN.last=performance.now();AN.acc=0;$('aplay').textContent='⏸ Pausar';AN.raf=requestAnimationFrame(animLoop)};
$('aseek').oninput=()=>{if(!AN.frames)return;AN.i=+$('aseek').value;drawFrame(AN.i)};
// ---- salvar / abrir cenário ----
const SAVE_IDS=['fuel','area','a0','wind','wdir','slope','sdir','rh','temp','resp','bdist','brel','maxloss','model','n','tactic','obj','rigor','alpha','kmc','cmp','opsyr','life','fixop','logd','acmode','opsA','lifeA','contractA','logdA','cxfA','wcost','lat','lon','kdist'];
$('bsave').onclick=()=>{const o={app:'FireDrone',versao:7,campos:{},modelos_adicionados:MODELS.filter(m=>m.src==='U'),incertezas:readUnc()};SAVE_IDS.forEach(i=>{const e=$(i);if(e)o.campos[i]=e.type==='checkbox'?e.checked:e.value});download('cenario_firedrone.json',JSON.stringify(o,null,1),'application/json')};
$('bload').onclick=()=>$('fload').click();
$('fload').onchange=async e=>{const fl=e.target.files[0];if(!fl)return;try{const o=JSON.parse(await fl.text());if(o.app!=='FireDrone')throw new Error('arquivo não é um cenário do FireDrone');
 for(let i=MODELS.length-1;i>=0;i--)if(MODELS[i].src==='U')MODELS.splice(i,1);(o.modelos_adicionados||[]).forEach(m=>MODELS.push(m));refreshModels();
 for(const[k,v]of Object.entries(o.campos||{})){const el=$(k);if(!el)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=(k==='maxloss'&&(o.versao||0)<7)?Math.round(v/(+o.campos.a0||1)*100):v}mlHa();
 if(o.incertezas){window._uncSaved=o.incertezas;buildUnc(false)}update()}catch(err){$('status').textContent='Não foi possível abrir: '+err.message}e.target.value=''};
// ---- clima real (Open-Meteo) ----
$('wx').onclick=async()=>{const la=+$('lat').value,lo=+$('lon').value;$('wxst').textContent='Buscando…';
 try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=auto`);if(!r.ok)throw new Error('HTTP '+r.status);
  const c=(await r.json()).current;$('temp').value=Math.round(c.temperature_2m);$('rh').value=Math.round(c.relative_humidity_2m);$('wind').value=+(+c.wind_speed_10m).toFixed(1);$('wdir').value=Math.round(((270-c.wind_direction_10m)%360+360)%360);
  $('wxst').textContent=`Clima em ${c.time}: ${f(c.temperature_2m)} °C · UR ${f(c.relative_humidity_2m)}% · vento ${f(c.wind_speed_10m,1)} m/s de ${f(c.wind_direction_10m)}° (compasso). Campos atualizados; clique em ▶ para simular.`}
 catch(e){$('wxst').textContent='Não foi possível buscar o clima ('+e.message+'). Sem internet ou o ambiente bloqueia a rede; preencha manualmente.'}};
// ---- histórico / comparação de execuções ----
const HIST=[];
function storeRun(){const R=LAST;if(!R)return;const{p,m,r,r0,c}=R;HIST.push({id:HIST.length+1,cen:FUELS[p.fi].name.replace(/^\d+ · /,''),model:m.name,n:R.nUse,tac:TACTICS[r.tactic].split(' (')[0],wind:p.wind,rh:p.rh,area:p.area,cs:r.cs,burned:r.burnedHa,burned0:r0.burnedHa,ok:r.ok,tCont:r.tCont,tExt:r.tExt,capex:c.capex,opex:c.opex,tot:c.tot,litres:r.litres,P:R.Pc?R.Pc.P:null});renderHist();$('status').textContent='Execução #'+HIST.length+' guardada (aba Execuções).'}
function renderHist(){if(!HIST.length){$('hist').innerHTML='<p class="note">Nenhuma execução guardada.</p>';$('hch1').innerHTML='';$('hch2').innerHTML='';return}
 $('hist').innerHTML='<table><tr><th>#</th><th>Cenário</th><th>Vento</th><th>UR</th><th>Modelo × n</th><th>Tática</th><th>Área (ha)</th><th>Sem drones</th><th>Contido</th><th>P(cont.)</th><th>Extinção (min)</th><th>CapEx (US$)</th><th>Custo/op. (US$)</th></tr>'+HIST.map(h=>`<tr><td>${h.id}</td><td>${h.cen}</td><td>${f(h.wind,1)}</td><td>${f(h.rh)}%</td><td>${h.model} × ${h.n}</td><td>${h.tac}</td><td>${f(h.burned,1)}</td><td>${f(h.burned0)}</td><td>${badge(h.ok,'sim','não')}</td><td>${h.P==null?'—':f(h.P*100)+'%'}</td><td>${h.tExt==null?'—':f(h.tExt/60)}</td><td>${f(h.capex)}</td><td>${f(h.tot)}</td></tr>`).join('')+'</table>';
 const lab=h=>'#'+h.id+' '+h.cen.slice(0,18);
 bars('hch1','lgh1',HIST.map(h=>({l:lab(h),v:[h.burned0,h.burned],c:[null,h.ok?'#4f9d5a':'#dc2626']})),['Sem drones (ha)','Com drones (ha)'],['#a8a29e','#4f9d5a'],{rot:1,h:300,bw:20});
 bars('hch2','lgh2',HIST.map(h=>({l:lab(h),v:[h.tot-h.opex,h.opex]})),['CapEx diluído/operação (US$)','Operação (US$)'],['#2f80c9','#f4a259'],{rot:1,h:300,bw:20})}
$('bstore').onclick=storeRun;$('hclr').onclick=()=>{HIST.length=0;renderHist()};
$('hcsv').onclick=()=>{if(!HIST.length)return;const k=Object.keys(HIST[0]);download('execucoes_firedrone.csv','﻿'+k.join(';')+'\n'+HIST.map(h=>k.map(x=>String(h[x]==null?'':h[x]).replace('.',',')).join(';')).join('\n'),'text/csv')};
$('bprint').onclick=()=>window.print();if(SANDBOX)$('bprint').hidden=true;renderHist();
// ---- relatório ----
$('brep').onclick=()=>{const R=LAST;if(!R){$('status').textContent='Execute uma simulação antes.';return}const{p,m,r,r0,c,nUse}=R,img=id=>{try{return $(id).toDataURL('image/png')}catch(e){return ''}},svg=id=>$(id)?$(id).innerHTML:'';
 const dt=new Date().toLocaleString('pt-BR'),F=FUELS[p.fi],mes=c.tot*p.opsyr/12;
 const P_=(a,b)=>`<tr><td>${a}</td><td>${b}</td></tr>`;
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório FireDrone</title><style>body{font:14px/1.5 system-ui,Segoe UI,Arial;max-width:980px;margin:24px auto;padding:0 16px;color:#222}h1{color:#15301f}h2{border-bottom:2px solid #e4572e;padding-bottom:3px;margin-top:26px}table{border-collapse:collapse;width:100%;font-size:12.5px;margin:8px 0}th,td{border-bottom:1px solid #ddd;padding:4px 8px;text-align:right}th:first-child,td:first-child{text-align:left}img{max-width:48%;border:1px solid #ccc;border-radius:8px}.row{display:flex;gap:12px;flex-wrap:wrap}.n{color:#666;font-size:12px}.best td{background:#e6f4e8;font-weight:700}.pill{border-radius:9px;padding:0 8px;color:#fff}.win{background:#4f9d5a}.lose{background:#dc2626}.hm{text-align:center}button{padding:8px 14px;margin:6px 0}@media print{button{display:none}}</style></head><body>
<button onclick="window.print()">🖨 Imprimir / salvar como PDF</button><h1>🔥 FireDrone · Relatório de simulação</h1><p class="n">Gerado em ${dt}. Simulador de combate a incêndios com enxame de drones (modelo de Rothermel, propagação por tempo de chegada, combate por linha molhada).</p>
<h2>1. Cenário</h2><table>${P_('Combustível / cenário',F.name)}${P_('Área da janela / foco inicial',f(p.area)+' ha / '+f(p.a0,1)+' ha')}${P_('Vento (10 m) / direção',f(p.wind,1)+' m/s / '+f(p.wdir)+'° (sopra para)')}${P_('Declividade / aclive para',f(p.slope,1)+'° / '+f(p.sdir)+'°')}${P_('UR / temperatura',f(p.rh)+'% / '+f(p.temp)+' °C')}${P_('Tempo de resposta',f(p.delay/60)+' min')}${P_('Base: distância ao foco',f(r.W.bdistReal)+' m ('+{bar:'barlavento',fl:'flanco',sot:'sotavento'}[p.brel]+')')}${P_('Perda máxima aceitável',f(p.maxloss)+' ha')}${P_('Resolução (definida pelo código)',f(r.cs,1)+' m · grade '+r.W.N+'×'+r.W.N+' · Δt '+f(r.W.dt,1)+' s')}</table>
<div class="row"><img src="${img('cv1')}"><img src="${img('cv')}"></div>
<h2>2. Resultado</h2><table>${P_('Modelo × frota',m.name+' × '+nUse+' ('+m.pay+' L por recarga)')}${P_('Tática',TACTICS[r.tactic])}${P_('Fogo contido?',r.ok?'<span class="pill win">sim</span>':'<span class="pill lose">não</span>')}${P_('Área queimada (com / sem drones)',f(r.burnedHa,1)+' ha / '+f(r0.burnedHa,1)+' ha')}${P_('Contenção da frente / extinção total',(r.tCont!=null?f(r.tCont/60)+' min':'não')+' / '+(r.tExt!=null?f(r.tExt/60)+' min':'não extinto'))}${P_('Água lançada / linha molhada',f(r.litres/1000,1)+' m³ em '+r.drops+' lançamentos / '+f(r.lineM)+' m')}${P_('Probabilidade de contenção (otimização)',R.Pc?f(R.Pc.P*100)+'% (IC95% '+R.Pc.ci.map(x=>f(x*100)).join('–')+'%) com '+R.Pc.K+' réplicas, meta '+f(R.Pc.alpha*100)+'%':'não calculada (modelo escolhido manualmente ou modo determinístico)')}${P_('CapEx da frota',' US$ '+f(c.capex))}${P_('Custo por operação / mensal','US$ '+f(c.tot)+' / US$ '+f(mes))}</table>
<div class="row"><img src="${img('cva')}"><div style="flex:1;min-width:260px">${svg('ev')}</div></div>
<h2>3. Táticas</h2>${svg('tacts')}<h2>4. Otimização da frota</h2>${svg('optab')}
${R.mcD?`<h2>5. Incerteza (Monte Carlo)</h2><div>${svg('mcstat').replace(/class="stat"/g,'')}</div><p>${svg('mcmsg')}</p><div class="row"><div>${svg('mchist')}</div><div>${svg('mcext')}</div></div>`:''}
${R.tor&&R.tor.base?`<h2>6. Parâmetros incertos (tornado)</h2>${svg('tochart')}${svg('totab')}`:''}
<h2>Premissas e limitações</h2><ul class="n"><li>Modelo de camada única de combustível (Rothermel 1972 com correção de Qig); sem modelo digital de terreno real, sem lançamento de fagulhas (spotting) e vento constante.</li><li>Preços (exceto tabelas públicas), recarga, custo operacional, razão de molhamento, limite de chama e reignição são <b>estimativas</b>: veja a faixa de incerteza na aba Incerteza.</li><li>Frotas homogêneas (um único modelo). O resultado de combate é um fenômeno de limiar: pequenas mudanças podem fazer o fogo escapar; por isso a frota é escolhida por probabilidade de contenção.</li><li>Validação contra um único evento real (Serra do Cipó, ago/2024), apenas na fase de ataque inicial.</li><li>Não substitui avaliação operacional nem regras de aviação (altura, BVLOS, separação de aeronaves tripuladas).</li></ul></body></html>`;
 download('relatorio_firedrone.html',html,'text/html');$('status').textContent='Relatório gerado (abra o arquivo e use Imprimir → Salvar como PDF).'};
