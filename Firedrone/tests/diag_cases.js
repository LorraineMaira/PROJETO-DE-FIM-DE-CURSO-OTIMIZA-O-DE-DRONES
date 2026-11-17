// Diagnóstico dos cenários em que a frota de drones não atinge P>=90% ou não vence o AS350: indicadores e variações isoladas (what-if).
const fs=require('fs');const {load}=require('../backend/core_loader'),{makePool}=require('../backend/nodepool');const A=load();
const file=process.argv[2],outf=process.argv[3],only=process.argv[4]?process.argv[4].split(',').map(Number):[3,6,7,8,9,10],R=JSON.parse(fs.readFileSync(file));
const T=['indireto','cercamento'];
const params=fi=>{const d=A.FUELS[fi].d;return{fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,logd:150,wcost:5}};
(async()=>{const pool=makePool(),res=fs.existsSync(outf)?JSON.parse(fs.readFileSync(outf)):{};
 for(const fi of only){if(res[fi])continue;const s=R[fi],m=A.MODELS.find(z=>z.name===s.modelo),n=s.nRisco,p=params(fi);const rs=await pool.run('resolve',{p});p.cs=rs.cs;
  const W=A.world(p,1),bare=await pool.run('bare',{p,m}),d=A.FUELS[fi].d;
  const vc=m.v*.85,tv=p.bdist/vc,t1=Math.max(p.delay,0)+tv,rosH=W.Rmax*60,Lf=.0775*Math.pow(W.rt.Ha*W.Rmax,.46),Lm=2.4+.012*m.pay;
  const q=.11*W.F.fm.w0/.5,Ws=Math.min(W.cs,1.5+.04*m.pay),capLine=n*m.pay/(q*Ws),cyc=2*tv+1.2*m.pay+120+p.delay*0;
  const ser=bare.ser||[],A1=ser[Math.min(ser.length-1,Math.round(t1/60))]??null;
  const ind={fi:fi+1,nome:s.nome,modelo:s.modelo,n,tatica:s.tatica,P:s.mc.P,ci:s.mc.ci,ROS:rosH,Lf,Lmax:Lm,bdist:p.bdist,delay:p.delay,tVoo:tv,tPrimeiro:t1,A1ha:A1,perim1:A1!=null?2*Math.PI*Math.sqrt(A1*1e4/Math.PI):null,capLinhaCiclo:capLine,cicloMin:cyc/60,burned:s.mc.burned,semDrones:bare.burnedHa,as350:(s.ranking.find(x=>/AS350/.test(x.modelo))||{}).op||null,variants:{}};
  const V={base:{},'base ×0,5':{bdist:p.bdist*.5},'resposta ×0,5':{delay:p.delay*.5},'foco ×0,5':{a0:p.a0*.5},'vento ×0,7':{wind:p.wind*.7},'frota ×1,5':{n:Math.ceil(n*1.5)}};
  for(const [k,v] of Object.entries(V)){const pp={...p,...v};delete pp.n;const nn=v.n||n;const D=await A.mcDistribution(pool,pp,m,nn,T,24,A.UNC0,()=>{},5000);ind.variants[k]={P:D.P,ci:D.ci,burned:D.burned.p50,n:nn};console.log(fi+1,k,D.P.toFixed(2),D.burned.p50)}
  res[fi]=ind;fs.writeFileSync(outf,JSON.stringify(res,null,1))}
 pool.close()})();
