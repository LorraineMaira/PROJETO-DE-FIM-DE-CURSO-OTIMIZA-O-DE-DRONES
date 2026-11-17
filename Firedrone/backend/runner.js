#!/usr/bin/env node
// Executor do motor FireDrone no Node: lê UM pedido JSON (stdin), escreve linhas JSON (stdout):
//   {"type":"progress","frac":0.4,"text":"..."}  ...  {"type":"result","data":{...}}  ou  {"type":"error","message":"..."}
// Usa exatamente o mesmo núcleo (../core) que o navegador executa nos Web Workers.
const {load}=require('./core_loader'),{makePool}=require('./nodepool');
const A=load();
const out=o=>process.stdout.write(JSON.stringify(o,(k,v)=>typeof v==='number'&&!isFinite(v)?null:v)+'\n');
const prog=(frac,text)=>out({type:'progress',frac:Math.max(0,Math.min(1,frac)),text});
const KEYS=['area','a0','wind','wdir','slope','sdir','rh','temp','bdist','brel','delay','maxloss','opsyr','life','fixop','logd','wcost','maxloss_pct','acMode','opsyrA','lifeA','contractA','logdA','cxfA'];
function buildParams(fi,ov={}){const F=A.FUELS[fi];if(!F)throw new Error('fuel_index inválido: '+fi);const d=F.d;
 const p={fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:d.bdist,brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5};
 for(const k of Object.keys(ov||{})){if(!KEYS.includes(k))throw new Error('parâmetro desconhecido em overrides: '+k+' (válidos: '+KEYS.join(', ')+')');p[k]=ov[k]}if(p.maxloss_pct!=null){p.maxloss=p.a0*p.maxloss_pct/100;delete p.maxloss_pct}
 p.bdist=Math.max(300,p.bdist);return p}
const mm=x=>x==null?null:x/60;
async function run(req,pool){
 const fi=req.fuel_index??1,p=buildParams(fi,req.overrides),F=A.FUELS[fi],nMax=req.n??F.d.n??60,tac=req.tactic||'auto',tacs=tac==='auto'?['indireto','cercamento']:[tac];
 for(const c of req.custom_models||[]){A.MODELS.push({name:c.name,pay:c.pay,v:c.v,end:c.end,mtow:c.mtow||0,empty:c.empty||0,cx:c.cx,src:'U',rf:c.rf??120+1.2*c.pay,ox:c.ox??Math.max(15,c.cx*.0025)})}
 prog(.02,'Resolução espacial e temporal');const rs=await pool.run('resolve',{p});p.cs=rs.cs;const rk=A.rank(p,nMax);
 const mode=req.rigor==='det'||req.rigor==='min'?'det':'mc',alpha=req.alpha??.9,K=req.K??10,unc=Object.assign({},A.UNC0,req.unc||{});
 const sel=req.model??-1,cmp=req.compare??sel<0;let m,nUse,nMin,capped=false,optR=null,Pc=null,k=0;
 if(sel>=0&&!cmp){m=A.MODELS[sel];if(!m)throw new Error('model inválido');nUse=nMax;nMin=nMax}
 else{optR=await A.optimizeFleetPar(pool,p,A.MODELS,nMax,req.objective||'custo',tacs,{mode,alpha,K,unc},t=>{k++;prog(.05+.5*Math.min(1,k/70),t)});
  if(optR.best){const b=optR.best;m=b.m;nUse=b.nRob;nMin=b.nMin;capped=!!b.capped;if(mode==='mc'&&b.P!=null)Pc={P:b.P,ci:b.Pci,K:b.Kconf||K,alpha,confirmed:!!b.confirmed,n_search:b.nSearch??null}}
  else{m=rk.r.slice().sort((a,b)=>a.Nt-b.Nt)[0].m;nUse=nMax;nMin=nMax;capped=true}}
 prog(.6,'Simulação final');
 const ths=[30,20,15,10].filter(c=>c!=rs.cs&&Math.sqrt(p.area*1e4)/c<=200);
 const[r,r0,tl,rb]=await Promise.all([pool.run('full',{p,m,n:nUse,tactic:tac,tacs,rec:false}),pool.run('bare',{p,m}),
  Promise.all(Object.keys(A.TACTICS).map(t=>pool.run('tact',{p,m,n:nUse,tactic:t}))),
  Promise.all(ths.map(c2=>pool.run('eval',{p:{...p,cs:c2},m,n:nUse,seed:1,tacs,fast:1}).then(x=>({cs:c2,burned_ha:x.burned,contained:x.ok,tactic:x.tactic}))))]);
 const c=A.costs(p,m,nUse,r),sm=A.summ(p,m,nUse);
 const res={params:p,resolution:rs,model:m.name,model_spec:m,n_drones:nUse,n_min_single_run:nMin,fleet_capped:capped,tactic:r.tactic,contained_and_ok:r.ok,
  p_containment:Pc,burned_ha:r.burnedHa,burned_ha_without_drones:r0.burnedHa,front_contained_min:mm(r.tCont),fully_extinguished_min:mm(r.tExt),drones_worked_until_min:mm(r.tWork),
  water_m3:r.litres/1000,wet_line_m:r.lineM,drops:r.drops,sorties:r.sorties,replan_rounds:r.rounds,flight_drone_hours:r.flightH,base_distance_m:r.W.bdistReal,
  costs:{capex:c.capex,opex_per_operation:c.opex,total_per_operation:c.tot,per_month:c.tot*p.opsyr/12},
  tactics_table:tl,mesh_robustness:[{cs:rs.cs,burned_ha:r.burnedHa,contained:r.ok,tactic:r.tactic,used:true},...rb],
  sectors:sm.s,analytic_min_drones:sm.Nt,rank:rk.r.map(x=>({model:x.m.name,min_drones_analytic:x.Nt,ratio:x.ratio,viable:x.viable,capex_min:x.cost})),
  optimization:optR&&{opts:optR.opts,table:optR.rows.map(x=>{const q=optR.refined.find(y=>y.m===x.m);return{model:x.m.name,pay_l:x.m.pay,n_min_single_run:x.nMin,cost_per_op_min:x.tot??null,n_with_risk:q?q.nRob:null,p_containment:q&&q.P!=null?q.P:null,p_confirmed:q?!!q.confirmed:null,p_ci95:q?q.Pci??null:null,capped:q?!!q.capped:null,cost_per_op_final:q?q.totRob:null,capex_final:q?q.nRob*x.m.cx:null,chosen:x.m===m,kind:x.m.kind||'drone',operation:q?q.op||null:null}})},
  timeseries_ha:{with_drones:r.ser,without_drones:r0.ser},routes_peak_round:(r.snapP||r.snapF||{}).routes||r.routes};
 const Kd=req.mc_replicas??24;
 if(Kd>0){prog(.75,'Monte Carlo');const D=await A.mcDistribution(pool,p,m,nUse,tacs,Kd,unc,t=>prog(.75,t),2000);
  res.monte_carlo={replicas:D.K,p_containment:D.P,ci95:D.ci,burned_ha:D.burned,cost_per_op:D.cost,extinction_min:D.tExt.map(x=>x/60)}}
 if(req.tornado){prog(.86,'Tornado (parâmetros incertos)');const T=await A.tornado(pool,p,m,Math.max(nMax,nUse*2),tacs,unc,t=>prog(.86+.13*0,t));
  res.tornado=T.base?{base_n:T.base.n,base_cost:T.base.totRef,rows:T.rows.map(x=>({parameter:x.lab,range:x.w,unit:x.un,kind:x.eng?'motor':'econômico',n_low:x.lo.n,n_high:x.hi.n,delta_cost_low:x.dLo,delta_cost_high:x.dHi}))}:null}
 prog(1,'Concluído');return res}
async function main(){let s='';for await(const ch of process.stdin)s+=ch;const req=JSON.parse(s||'{}');
 if(req.op==='catalog'){out({type:'result',data:{drones:A.MODELS,fuels:A.FUELS.map((x,i)=>({index:i,name:x.name,fuel_model:x.fm,defaults:x.d})),uncertainties:A.UNC_INFO,defaults_note:'delay (s) = defaults.resp; overrides aceitos: area,a0,wind,wdir,slope,sdir,rh,temp,bdist,brel,delay,maxloss,opsyr,life,fixop,wcost'}});return}
 const pool=makePool(req.threads);try{
  if(req.op==='resolve'){const p=buildParams(req.fuel_index??1,req.overrides);out({type:'result',data:await pool.run(req.full?'conv':'resolve',{p})})}
  else if(req.op==='run'||!req.op){out({type:'result',data:await run(req,pool)})}
  else throw new Error('op desconhecida: '+req.op)}finally{pool.close()}}
main().then(()=>process.exit(0)).catch(e=>{out({type:'error',message:String(e&&e.message||e)});process.exit(1)});
