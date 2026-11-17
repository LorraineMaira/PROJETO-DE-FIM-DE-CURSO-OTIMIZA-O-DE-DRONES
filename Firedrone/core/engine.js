// ================= MOTOR v5: Rothermel + tempo de chegada (16 vizinhos) + combate por linha molhada =================
const M2FT=3.28084,KG2LB=2.20462,KJ2BTU=0.947817,MS2FTMIN=196.85,TMAX=6*3600,RATIO=.11,ETA=.5,VC=.85,DROPT=.3;
const K16=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]].map(([a,b])=>[a,b,Math.hypot(a,b),Math.atan2(b,a)]);
const N8=K16.slice(0,8);
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// Umidade de equilíbrio (Simard 1968), RH em %, T em °C
function emc(rh,T){const F=T*1.8+32;let e;if(rh<10)e=.03229+.281073*rh-.000578*rh*F;else if(rh<50)e=2.22749+.160107*rh-.014784*F;else e=21.0606+.005565*rh*rh-.00035*rh*F-.483199*rh;return Math.max(1.5,e)/100}
// Rothermel (1972), parâmetros em SI -> inglês internamente (mesma estrutura do framework). Qig CORRIGIDO: 250+1116*Mf (Mf adimensional).

// ---- Modelo de energia (Apêndice A): A.1-A.2 massa, A.3 potência de voo pairado, A.4-A.6 bateria (circuito equivalente + Shepherd). ----
const EP={g:9.81,FM:.7,DL:150,etaC:.9,pav:.03,sag:.05,socMin:.10,rho0:1.184,Ns:12,E0:3.85,K:.015,A:.25,B:15};
const vocv=s=>EP.Ns*(EP.E0-EP.K*(1-s)/s+EP.A*Math.exp(-EP.B*(1-s)));
function Ibat(P,s,R){const V=vocv(s),d=V*V-4*R*P/EP.etaC;if(d<=0)return Infinity;return(V-Math.sqrt(d))/(2*R)}
const ENC=new Map();
function energyModel(m,Tc){const key=m.name+'|'+Math.round(Tc);let e=ENC.get(key);if(e)return e;
 const Ad=m.mtow*EP.g/EP.DL,rho=101325/(287.05*(Tc+273.15)),Ph=(mass,r)=>Math.pow(mass*EP.g,1.5)/(Math.sqrt(2*r*Ad)*EP.FM),mref=m.empty+m.pay,Pav=EP.pav*Ph(mref,EP.rho0),
  Pref=Ph(mref,EP.rho0)+Pav,Iref=Pref/(EP.etaC*vocv(1)),R=EP.sag*vocv(1)/Iref;
 let integ=0;const n=400;for(let i=0;i<n;i++){const s=1-(1-EP.socMin)*(i+.5)/n;integ+=(1-EP.socMin)/n/Ibat(Pref,s,R)}
 const Q=m.end*60/(3600*integ);// Ah, calibrada para que a autonomia nominal valha a carga plena, rho0 e SoC de 100% a socMin
 const leg=(soc,mass,t)=>{let rem=t;while(rem>1e-9){const dt=Math.min(10,rem),I=Ibat(Ph(mass,rho)+Pav,soc,R);soc-=I*dt/(3600*Q);rem-=dt;if(soc<=EP.socMin)return soc}return soc};
 e={leg,Q,R,Ad,rho,socRes:1-.85*(1-EP.socMin),Pref,Iref};ENC.set(key,e);return e}
function rothermel(fm,Mf){const sig=fm.sigma/M2FT,w0=fm.w0*KG2LB/M2FT**2,del=fm.delta*M2FT,h=fm.h*KJ2BTU/KG2LB,rhop=fm.rho_p*KG2LB/M2FT**3;
 const rhob=w0/del,beta=rhob/rhop,bop=3.348*sig**-.8189,A=133*sig**-.7913,gmax=sig**1.5/(495+.0594*sig**1.5),ra=beta/bop,gp=gmax*ra**A*Math.exp(A*(1-ra));
 const mm=Math.min(Mf/fm.Mx,1),eM=Math.max(0,1-2.59*mm+5.11*mm**2-3.52*mm**3),eS=Math.min(1,.174*fm.SE**-.19),IR=gp*w0*(1-fm.ST)*h*eM*eS;
 const xi=Math.exp((.792+.681*Math.sqrt(sig))*(beta+.1))/(192+.2595*sig),eps=Math.exp(-138/sig),Qig=250+1116*Mf;
 const C=7.47*Math.exp(-.133*sig**.55),B=.02526*sig**.54,E=.715*Math.exp(-.000359*sig),R0=IR*xi/(rhob*eps*Qig)/M2FT; // m/min
 return{R0,IR,beta,bop,C,B,E,Ha:IR*(384/sig)*11.3565}} // Ha: kJ/m2 (calor por área, Byram)
const flameLen=(rt,Rms)=>.0775*Math.pow(Math.max(1e-6,rt.Ha*Rms),.46); // I em kW/m -> m
function headVec(rt,wind10,waf,wdir,gx,gy){const U=wind10*waf*MS2FTMIN,k=Math.pow(rt.beta/rt.bop,-rt.E),cap=rt.C*Math.pow(.9*rt.IR,rt.B)*k; // limite de vento efetivo 0,9*IR (Andrews 2013)
 const pw=Math.min(rt.C*Math.pow(U,rt.B)*k,cap),ts=Math.hypot(gx,gy),ps=5.275*Math.pow(rt.beta,-.3)*ts*ts;
 let vx=pw*Math.cos(wdir)+(ts>0?ps*gx/ts:0),vy=pw*Math.sin(wdir)+(ts>0?ps*gy/ts:0),ph=Math.min(Math.hypot(vx,vy),cap);
 const hd=ph>1e-9?Math.atan2(vy,vx):wdir,Ue=Math.pow(ph/k/rt.C,1/rt.B)/88,LB=Math.min(8,.936*Math.exp(.2566*Ue)+.461*Math.exp(-.1548*Ue)-.397);
 return{Rh:rt.R0*(1+ph),hd,e:Math.sqrt(Math.max(0,LB*LB-1))/LB}}
const rosDir=(Rh,e,th)=>Rh*(1-e)/(1-e*Math.cos(th));
function noiseField(N,seed,lam){const R=rng(seed),g=Math.ceil(N/lam)+3,v=Array.from({length:g*g},()=>R()*2-1),o=new Float32Array(N*N),s=u=>u*u*(3-2*u);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const fx=x/lam,fy=y/lam,ix=fx|0,iy=fy|0,sx=s(fx-ix),sy=s(fy-iy);o[y*N+x]=(v[iy*g+ix]*(1-sx)+v[iy*g+ix+1]*sx)*(1-sy)+(v[(iy+1)*g+ix]*(1-sx)+v[(iy+1)*g+ix+1]*sx)*sy}return o}
// ---- mundo (terreno, combustível, ROS por célula, base, ignição) ----
const WC=new Map();
function world(p,seed=1){const key=[p.fi,p.area,p.wind,p.wdir,p.slope,p.sdir,p.rh,p.temp,p.cs,p.bdist,p.brel,p.noise,p.w0f||1,seed].join('|');if(WC.has(key))return WC.get(key);
 const F0=FUELS[p.fi],F=p.w0f&&p.w0f!=1?{...F0,fm:{...F0.fm,w0:F0.fm.w0*p.w0f}}:F0,side=Math.sqrt(p.area*1e4);let cs=p.cs,N=Math.round(side/cs),capped=false;if(N>200){N=200;cs=side/200;capped=true}
 const Mf=emc(p.rh,p.temp)+F.addMf,rt=rothermel(F.fm,Mf),wd=p.wdir*Math.PI/180,sd=p.sdir*Math.PI/180,tS=Math.tan(p.slope*Math.PI/180),lam=Math.max(3,400/cs);
 const n1=noiseField(N,seed*7+1,lam),n2=noiseField(N,seed*7+2,lam),n3=noiseField(N,seed*7+3,Math.max(3,250/cs)),nz=p.noise?1:0;
 const Rh=new Float32Array(N*N),hd=new Float32Array(N*N),ec=new Float32Array(N*N),gX=new Float32Array(N*N),gY=new Float32Array(N*N);let Rmax=0;
 for(let i=0;i<N*N;i++){const a=nz*.35*n1[i],b=nz*.3*n2[i],gx=tS*(Math.cos(sd)*(1+a)-Math.sin(sd)*b),gy=tS*(Math.sin(sd)*(1+a)+Math.cos(sd)*b),H=headVec(rt,p.wind,F.waf,wd,gx,gy);
  Rh[i]=H.Rh*Math.exp(nz*.12*n3[i]);hd[i]=H.hd;ec[i]=H.e;gX[i]=gx;gY[i]=gy;if(Rh[i]>Rmax)Rmax=Rh[i]}
 const c=(N>>1)*N+(N>>1),h0=hd[c],clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ix=clamp(N/2-.18*N*Math.cos(h0),3,N-4),iy=clamp(N/2-.18*N*Math.sin(h0),3,N-4);
 const u={bar:[-Math.cos(h0),-Math.sin(h0)],fl:[-Math.sin(h0),Math.cos(h0)],sot:[Math.cos(h0),Math.sin(h0)]}[p.brel]||[-Math.cos(h0),-Math.sin(h0)];
 const bx=clamp(ix+u[0]*p.bdist/cs,1,N-2),by=clamp(iy+u[1]*p.bdist/cs,1,N-2);
 const W={N,cs,side,capped,Rh,hd,ec,gX,gY,rt,F,Mf,Rmax:Rmax/60,dt:Math.max(1,Math.min(10,.5*cs/(Rmax/60||1))),ix,iy,bx,by,bdistReal:Math.hypot(bx-ix,by-iy)*cs,h0,wd};
 if(WC.size>60)WC.clear();WC.set(key,W);return W}
class Heap{constructor(){this.n=0;this.t=new Float64Array(1<<16);this.a=new Int32Array(1<<16);this.b=new Int32Array(1<<16)}
 push(t,a,b){if(this.n==this.t.length){const g=this.n*2,t2=new Float64Array(g),a2=new Int32Array(g),b2=new Int32Array(g);t2.set(this.t);a2.set(this.a);b2.set(this.b);this.t=t2;this.a=a2;this.b=b2}
  let i=this.n++;const T=this.t,A=this.a,B=this.b;while(i>0){const q=(i-1)>>1;if(T[q]<=t)break;T[i]=T[q];A[i]=A[q];B[i]=B[q];i=q}T[i]=t;A[i]=a;B[i]=b}
 pop(){const T=this.t,A=this.a,B=this.b;this.rt=T[0];this.ra=A[0];this.rb=B[0];const n=--this.n;if(n>0){const t=T[n],a=A[n],b=B[n];let i=0;for(;;){let c=2*i+1;if(c>=n)break;if(c+1<n&&T[c+1]<T[c])c++;if(T[c]>=t)break;T[i]=T[c];A[i]=A[c];B[i]=B[c];i=c}T[i]=t;A[i]=a;B[i]=b}}}
const wStrip=m=>m.ws?m.ws:(typeof process!=='undefined'&&process.env&&process.env.FD_WS)?+process.env.FD_WS:Math.max(2,Math.min(8,1.5+.04*m.pay)),lMax=m=>m.lmax?m.lmax:2.4+.012*m.pay;
const TACTICS={direto:'Ataque direto (cabeça)',flancos:'Flancos em pinça (do calcanhar à cabeça)',indireto:'Indireto (barreira à frente)',cercamento:'Cercamento (perímetro, setores)'};
function simulate(p,m,n,tactic='cercamento',seed=1,o={}){
 const W=world(p,seed),{N,cs,Rh,hd,ec,rt,F}=W,NN=N*N,TM=o.tstop||8*3600;
 const st=new Uint8Array(NN),T=new Float32Array(NN).fill(-1),tbE=new Float32Array(NN),smE=new Float32Array(NN),pend=new Int32Array(NN),wet=new Float32Array(NN),wetT=new Float32Array(NN),resv=new Float32Array(NN),mark=new Int32Array(NN),lined=new Uint8Array(NN),cool=new Uint8Array(NN);
 const q=(p.ratio||RATIO)*F.fm.w0/ETA,Ws=Math.min(cs,wStrip(m)*(p.wsf||1)),thrB=q*Ws*cs,thrS=.6*thrB,Lm=lMax(m)*(p.lmf||1),hl=1500*(.5+p.rh/100),vc=m.v*VC,wd=W.wd,tau=384/(F.fm.sigma/M2FT)*60,dt=W.dt,H=new Heap(),active=[];
 const smD=F.sm||900,rRe=-Math.log(1-Math.min(.4,.03*Math.sqrt(smD/300)*cs/30))/smD*(p.rrf||1),R2=rng(seed*13+5),delay=Math.max(p.delay||0,m.mob||0);
 let sx=0,sy=0,sc=0,t=0,stamp=0,esc=false,depotHit=-1,extN=0,nFlame=0,tCont=-1,tExt=-1,nextRe=60;
 const wetEff=(j,t)=>wet[j]*Math.pow(.5,(t-wetT[j])/hl),thrD=Lf=>thrB*(1+Lf/2),bw=(c,tt)=>wetEff(c,tt)>=thrB;
 const ros=(i,th)=>Rh[i]/60*(1-ec[i])/(1-ec[i]*Math.cos(th-hd[i]));
 function ignite(i,tt){st[i]=1;nFlame++;T[i]=tt;const x=i%N,y=(i/N)|0;sx+=x;sy+=y;sc++;tbE[i]=tt+1.5*cs/Math.max(Rh[i]/60,.01)+tau;active.push(i);if(x==0||y==0||x==N-1||y==N-1)esc=true;
  if(Math.hypot(x-W.bx,y-W.by)<1.5&&depotHit<0)depotHit=tt;
  for(const[a,b,d,ang]of K16){const X=x+a,Y=y+b;if(X<0||Y<0||X>=N||Y>=N)continue;const k=Y*N+X;if(st[k]!=0)continue;const r=ros(i,ang);if(r<1e-4)continue;H.push(tt+cs*d/r,k,i);pend[i]++}}
 const r0=Math.sqrt(p.a0*1e4/Math.PI)/cs;for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(Math.hypot(x-W.ix,y-W.iy)<=Math.max(.8,r0)&&st[y*N+x]==0)ignite(y*N+x,0);
 const dr=[];for(let k=0;k<n;k++)dr.push({s:'idle',load:m.pay,rem:0,route:[],leg:0,px:W.bx,py:W.by,wait:0});
 const legT=(ax,ay,bx,by)=>{const dx=(bx-ax)*cs,dy=(by-ay)*cs,D=Math.hypot(dx,dy);if(D<1)return 2;const d=Math.atan2(dy,dx)-wd,cr=p.wind*Math.sin(d);if(Math.abs(cr)>=vc*.9)return D/2;return D/Math.max(2,Math.sqrt(vc*vc-cr*cr)+p.wind*Math.cos(d))};
 const lastF=new Array(n).fill(null),lastM=new Array(n).fill(null);let snapF=null,snapM=null,snapP=null,peakN=-1,litres=0,drops=0,sorties=0,flight=0,rounds=0,lineM=0,hotN=0,lastWork=0;const ser=[0];
 let cT=-1,cC=null;
 const rec=o.rec?{dt:30,next:0,frames:[]}:null;
 const dpos=d=>{if(d.s=='fly'){const z=d.route[d.leg],q=d.tl>0?Math.max(0,Math.min(1,1-d.rem/d.tl)):1;return[d.px+(z.x-d.px)*q,d.py+(z.y-d.py)*q,2]}
  if(d.s=='ret'){const q=d.tl>0?Math.max(0,Math.min(1,1-d.rem/d.tl)):1;return[d.px+(W.bx-d.px)*q,d.py+(W.by-d.py)*q,3]}return[W.bx,W.by,d.s=='fill'?1:0]};
 function recFrame(force){if(!rec||(!force&&t<rec.next))return;const c=new Uint8Array(NN);for(let i=0;i<NN;i++)c[i]=st[i]|(lined[i]<<3)|(cool[i]<<4);
  const dd=new Float32Array(n*3);for(let k=0;k<n;k++){const q=dpos(dr[k]);dd[3*k]=q[0];dd[3*k+1]=q[1];dd[3*k+2]=q[2]}
  rec.frames.push({t,c,d:dd,burned:sc*cs*cs/1e4,flame:nFlame});rec.next=t+rec.dt;
  if(rec.frames.length>240){rec.frames=rec.frames.filter((_,i)=>i%2==0);rec.dt*=2;rec.next=t+rec.dt}}
 // Distância geodésica (m) do fogo ativo até cada célula intacta, sem atravessar linhas molhadas (chanfro 1/√2, 2 varreduras, só na janela do fogo)
 const dist=new Float32Array(NN),BIG=1e9;let dT=-1e9,bx0=0,bx1=0,by0=0,by1=0,dOK=false;
 const blockedC=(i)=>wet[i]>=thrB&&wetEff(i,t)>=thrB;
 function frontDist(){if(t-dT<5)return dOK;dT=t;let x0=N,x1=-1,y0=N,y1=-1;
  for(const i of active){if(st[i]!=1)continue;const x=i%N,y=(i/N)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<0){dOK=false;return false}const mg=Math.ceil(260/cs);bx0=Math.max(0,x0-mg);bx1=Math.min(N-1,x1+mg);by0=Math.max(0,y0-mg);by1=Math.min(N-1,y1+mg);
  for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){const i=y*N+x;dist[i]=st[i]==1?0:BIG}
  const S2=1.41421356,rel=(i,d,x,y,nx,ny,w)=>{if(nx<bx0||nx>bx1||ny<by0||ny>by1)return d;const v=dist[ny*N+nx]+w;return v<d?v:d};
  for(let it=0;it<2;it++){
   for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){const i=y*N+x;if(st[i]!=0||blockedC(i))continue;let d=dist[i];d=rel(i,d,x,y,x-1,y,1);d=rel(i,d,x,y,x-1,y-1,S2);d=rel(i,d,x,y,x,y-1,1);d=rel(i,d,x,y,x+1,y-1,S2);dist[i]=d}
   for(let y=by1;y>=by0;y--)for(let x=bx1;x>=bx0;x--){const i=y*N+x;if(st[i]!=0||blockedC(i))continue;let d=dist[i];d=rel(i,d,x,y,x+1,y,1);d=rel(i,d,x,y,x+1,y+1,S2);d=rel(i,d,x,y,x,y+1,1);d=rel(i,d,x,y,x-1,y+1,S2);dist[i]=d}}
  dOK=true;return true}
 // Candidatos: (1) chama p/ ataque direto, (2) brasa p/ rescaldo, (3) linha indireta a distância S = ROS·T_antecedência (em METROS, independente da célula)
 function cands(){stamp++;const out=[],cx=sx/sc,cy=sy/sc;
  const add=(j,type,edge)=>{const x=j%N,y=(j/N)|0,ps=Math.atan2(y-cy,x-cx),rel=ps-W.h0,phi=Math.abs(Math.atan2(Math.sin(rel-Math.PI),Math.cos(rel-Math.PI)));
   const rs=ros(j,ps),Lf=flameLen(rt,rs),need=(type==2?thrS:type?thrD(Lf):(p.nf||1.25)*thrB)-wetEff(j,t)-resv[j];if(need<.05*thrB)return;if(type==1&&Lf>Lm)return;
   out.push({j,x,y,type,edge,need,Lf,ros:rs,phi,pp:((ps-(W.h0+Math.PI))%(2*Math.PI)+2*Math.PI)%(2*Math.PI)})};
  for(const i of active){const x=i%N,y=(i/N)|0;if(st[i]==4){let hasU=false;for(const[a,b]of N8){const X=x+a,Y=y+b;if(X>=0&&Y>=0&&X<N&&Y<N&&st[Y*N+X]==0){hasU=true;break}}add(i,2,hasU)}else if(st[i]==1){let hasU=false;for(const[a,b]of N8){const X=x+a,Y=y+b;if(X>=0&&Y>=0&&X<N&&Y<N&&st[Y*N+X]==0){hasU=true;break}}if(hasU)add(i,1,true)}}
  if(p.adj!==0){for(const i of active){if(st[i]!=1)continue;const x=i%N,y=(i/N)|0;for(const[a,b]of N8){const X=x+a,Y=y+b;if(X<0||Y<0||X>=N||Y>=N)continue;const j=Y*N+X;if(st[j]==0&&mark[j]!=stamp&&wetEff(j,t)<1.25*thrB){mark[j]=stamp;add(j,0,true)}}}}
  if(frontDist()){const Tl=p.tmar||90,Smin=p.smin||40,hc=cs*(p.bw||.5);
   for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){const j=y*N+x;if(st[j]!=0)continue;const dm=dist[j]*cs;if(dm>=BIG*.5||dm>260+hc)continue;
    const ps=Math.atan2(y-cy,x-cx),R=ros(j,ps),S=Math.max(Smin,Math.min(200,R*(Tl+legT(W.bx,W.by,x,y))));if(Math.abs(dm-S)<=hc)add(j,0,true)}}
  return out}
 function plan(d,k){if(cT!==t){cC=cands();cT=t}const c=cC;if(!c.length)return null;
  const tf={direto:z=>z.type==1,flancos:z=>z.phi<=2.09,indireto:z=>z.type==0&&Math.PI-z.phi<=1.75,cercamento:z=>true}[tactic];
  let pool=c.filter(z=>z.type==2||tf(z));if(!pool.some(z=>z.type<2)&&tactic!='direto')pool=c.slice();if(!pool.length)return null;
  const sec=2*Math.PI/Math.max(1,n),pen=z=>z.type==2?0:tactic=='cercamento'?(Math.floor(z.pp/sec)==k%Math.max(1,n)?0:100):tactic=='flancos'?((z.pp<Math.PI)==(k%2==0)?0:50):0,
   key=z=>z.type==2?1e6+(z.edge?0:1e5)+z.pp:(tactic=='direto'||tactic=='indireto'?-z.ros*100:tactic=='flancos'?z.phi:z.pp)+pen(z);
  pool.sort((a,b)=>key(a)-key(b));const S=pool.slice(0,Math.max(40,Math.round(1200/cs))),route=[];let load=d.load,px=W.bx,py=W.by,tm=0;const maxE=m.end*60*.85,mRef=m.empty+m.pay,fE=l=>p.constEnd?1:Math.pow((m.empty+Math.max(0,l))/mRef,1.5),EM=(m.kind==='heli'||p.simpleE||p.constEnd)?null:energyModel(m,p.temp);let en=0,soc=1;
  while(load>.05*thrB&&S.length){let bi=-1,bd=1e18;
   for(let a=0;a<S.length;a++){const z=S[a];if(z.need<=.05*thrB)continue;const dd=route.length?Math.hypot(z.x-px,z.y-py):a;if(dd<bd){bd=dd;bi=a}}
   if(bi<0)break;const z=S[bi],v=Math.min(load,z.need),tg=legT(px,py,z.x,z.y)+DROPT,tb=legT(z.x,z.y,W.bx,W.by);let ego=0,s1=0;if(EM){s1=EM.leg(soc,m.empty+load,tg);if(EM.leg(s1,m.empty+load-v,tb)<EM.socRes){S.splice(bi,1);if(!route.length)continue;break}}else{ego=tg*fE(load);if(en+ego+tb*fE(load-v)>maxE){S.splice(bi,1);if(!route.length)continue;break}}
   route.push({j:z.j,x:z.x,y:z.y,vol:v,type:z.type});resv[z.j]+=v;z.need-=v;load-=v;en+=ego;if(EM)soc=s1;px=z.x;py=z.y;if(z.need<=.05*thrB)S.splice(bi,1)}
  return route.length?route:null}
 function arrive(z,d){const j=z.j;if(o.dbg){const k=st[j]+(z.type?"t"+z.type:"t0");o.dbg[k]=(o.dbg[k]||0)+1}resv[j]=Math.max(0,resv[j]-z.vol);if(st[j]==2||st[j]==3)return;const e=wetEff(j,t)+z.vol;wet[j]=e;wetT[j]=t;d.load-=z.vol;litres+=z.vol;drops++;lineM+=z.vol/(thrB/cs);lastWork=t;if(e>=thrB)lined[j]=1;
  if(st[j]==1){const x=j%N,y=(j/N)|0,Lf=flameLen(rt,ros(j,Math.atan2(y-sy/sc,x-sx/sc)));if(e>=thrD(Lf)){st[j]=3;nFlame--;extN++}}
  else if(st[j]==4&&e>=thrS){st[j]=3;extN++;cool[j]=1}}
 while(t<TM){t+=dt;
  while(H.n&&H.t[0]<=t){H.pop();const te=H.rt,k=H.ra,i=H.rb;pend[i]--;if(st[k]!=0||st[i]==3)continue;
   const xi=i%N,yi=(i/N)|0,dx=(k%N)-xi,dy=((k/N)|0)-yi,sxn=Math.sign(dx),syn=Math.sign(dy);let blk=bw(k,te);
   if(!blk){if(Math.abs(dx)==1&&Math.abs(dy)==1)blk=bw(i+dx,te)||bw(i+dy*N,te);else if(Math.abs(dx)==2)blk=bw(i+sxn,te)||bw(i+sxn+syn*N,te);else if(Math.abs(dy)==2)blk=bw(i+syn*N,te)||bw(i+sxn+syn*N,te)}
   if(blk){if(st[i]==1&&te<tbE[i]){H.push(te+20,k,i);pend[i]++}continue}if(o.leak&&te>delay+120){const w=wetEff(k,te)/thrB,c=(w<.01?'seca':w<.5?'<50%':'50-100%')+(st[i]==1?'':'/fonte-nao-chama');o.leak[c]=(o.leak[c]||0)+1;if(!o.leak.t0)o.leak.t0=Math.round(te);if(o.leakT){const b=Math.floor(te/300);o.leakT[b]=(o.leakT[b]||0)+1}}if(o.ign&&te>1200&&o.ign.length<10)o.ign.push({te:Math.round(te),src:[xi,yi],srcSt:st[i],srcT:Math.round(T[i]),dst:[k%N,(k/N)|0],d:Math.hypot(dx,dy).toFixed(1),wetDst:wetEff(k,te).toFixed(2),thrB:thrB.toFixed(2),lined:lined[k]});ignite(k,te)}
  if(t>=nextRe){nextRe=t+30;const pr=1-Math.exp(-rRe*30);for(let a=0;a<active.length;a++){const i=active[a];if(st[i]!=4||R2()>pr)continue;const x=i%N,y=(i/N)|0;
    for(const[aa,bb]of N8){const X=x+aa,Y=y+bb;if(X<0||Y<0||X>=N||Y>=N)continue;const j=Y*N+X;if(st[j]==0&&!bw(j,t)){ignite(j,t);break}}}}
  let w=0;hotN=0;for(let a=0;a<active.length;a++){const i=active[a];
   if(st[i]==1&&pend[i]<=0&&t>=tbE[i]){st[i]=4;nFlame--;smE[i]=t+smD}
   if(st[i]==4&&t>=smE[i])st[i]=2;
   if(st[i]==1||st[i]==4)active[w++]=i}active.length=w;
  if(nFlame==0&&!H.n){if(tCont<0)tCont=t}else tCont=-1;
  if(t%60<dt)ser.push(sc*cs*cs/1e4);
  if(o.fast&&(tCont>=0||sc*cs*cs/1e4>3*p.maxloss))break;
  if(nFlame==0&&!H.n&&!active.length){tExt=t;break}
  for(let k=0;k<n;k++){const d=dr[k];if(t<delay)break;
   if(d.s=='idle'){if(t<d.wait)continue;const r=plan(d,k);if(!r){d.wait=t+20;continue}d.route=r;d.leg=0;d.s='fly';d.rem=legT(W.bx,W.by,r[0].x,r[0].y)+DROPT;d.tl=d.rem;d.px=W.bx;d.py=W.by;
    const rr=r.map(z=>({x:z.x,y:z.y,type:z.type}));if(r[0].type<2&&nFlame>0){lastF[k]=rr;snapF={t,st:st.slice(),lined:lined.slice(),cool:cool.slice()};if(nFlame>=peakN){peakN=nFlame;snapP={t,st:st.slice(),lined:lined.slice(),cool:cool.slice(),routes:lastF.map(z=>z&&z.slice())}}}else{lastM[k]=rr;snapM={t,st:st.slice(),lined:lined.slice(),cool:cool.slice()}}rounds++}
   if(d.s=='fly'||d.s=='ret'){d.rem-=dt;flight+=dt;
    while(d.rem<=0){if(d.s=='fly'){const z=d.route[d.leg];arrive(z,d);d.px=z.x;d.py=z.y;d.leg++;if(d.leg<d.route.length){const nz=d.route[d.leg],L=legT(d.px,d.py,nz.x,nz.y)+DROPT;d.rem+=L;d.tl=L}else{d.s='ret';const L=legT(d.px,d.py,W.bx,W.by);d.rem+=L;d.tl=L}}
     else{d.s='fill';d.rem=m.rf;sorties++;break}}}
   else if(d.s=='fill'){d.rem-=dt;if(d.rem<=0){d.load=m.pay;d.s='idle'}}}
  if(rec)recFrame(false)}
 if(rec)recFrame(true);
 let bu=0;for(let i=0;i<NN;i++)if(T[i]>=0)bu++;
 const burnedHa=bu*cs*cs/1e4,frontOut=nFlame==0&&!H.n,done=o.fast?frontOut:tExt>=0;
 let head=0;const hx=Math.cos(W.h0),hy=Math.sin(W.h0);for(let i=0;i<NN;i++)if(T[i]>=0){const d=((i%N)-W.ix)*hx+(((i/N)|0)-W.iy)*hy;if(d>head)head=d}
 return{st,T,lined,cool,N,cs,W,ser,burnedHa,extHa:extN*cs*cs/1e4,contained:frontOut,extinct:tExt>=0,tCont:tCont>=0?tCont:null,tExt:tExt>=0?tExt:null,tEnd:t,tWork:lastWork,esc,depotHit,litres,drops,sorties,rounds,flightH:flight/3600,lineM,
  routes:lastF,routesM:lastM,snapF,snapM,snapP,rec:rec?{frames:rec.frames,dt:rec.dt}:null,nDr:n,tactic,headM:head*cs,ok:depotHit<0&&!esc&&burnedHa<=p.maxloss&&done,thrB,thrS,Ws,Lm,dt}}
function bestTactic(p,m,n,seed=1,o={}){let b=null;for(const t of Object.keys(TACTICS)){const r=simulate(p,m,n,t,seed,o);if(!b||(r.ok&&!b.ok)||(r.ok==b.ok&&r.burnedHa<b.burnedHa))b=r}return b}
// Custo por operação da FROTA INTEIRA = termo de capital + operação. Capital: preço·n/(vida·operações/ano) (compra diluída) ou, p/ aeronave tripulada em modo 'contrato', contrato anual·n/operações por ano (tudo incluso: sem custo por hora de voo).
// Aeronaves usam, se informados, operações/ano (opsyrA), vida útil (lifeA), logística por aeronave (logdA) e fator de preço (cxfA).
const capDil=(p,m,n)=>{const A=m.kind==='heli',ops=Math.max(1,(A&&p.opsyrA)||p.opsyr);return A&&p.acMode==='contract'?(p.contractA||0)*n/ops:m.cx*(A?(p.cxfA||1):1)*n/(((A&&p.lifeA)||p.life)*ops)};
const costs=(p,m,n,r)=>{const A=m.kind==='heli',cx=capDil(p,m,n),ox=(A&&p.acMode==='contract'?0:m.ox*r.flightH)+p.wcost*r.litres/1000+p.fixop+((A&&p.logdA!=null?p.logdA:(p.logd||0)))*n;return{capex:m.cx*(A?(p.cxfA||1):1)*n,opex:ox,tot:cx+ox}};
// ---- análise por setores (fogo × drone) ----
function sectorsA(p,m){const W=world(p,1),{N,cs,Rh,hd,ec,rt,F}=W,c=(W.iy|0)*N+(W.ix|0),q=(p.ratio||RATIO)*F.fm.w0/ETA,Ws=Math.min(cs,wStrip(m)*(p.wsf||1)),thrB=q*Ws*cs,Lm=lMax(m)*(p.lmf||1),r00=Math.sqrt(p.a0*1e4/Math.PI),Tc=p.tc||1800,vc=m.v*VC,wd=W.wd;
 return Array.from({length:8},(_,k)=>{const th=k*Math.PI/4,R=rosDir(Rh[c],ec[c],th-hd[c])/60,Lf=flameLen(rt,R),direct=Lf<=Lm,thr=direct?thrB*(1+Lf/2):thrB,r0=r00+R*(p.delay||0);
  let rA=r0,dd=0,fly=0,tA=0;for(let it=0;it<3;it++){const x=W.ix+rA/cs*Math.cos(th),y=W.iy+rA/cs*Math.sin(th),dx=(x-W.bx)*cs,dy=(y-W.by)*cs;dd=Math.max(cs,Math.hypot(dx,dy));const a=Math.atan2(dy,dx)-wd,cr=p.wind*Math.sin(a),
    g1=Math.max(2,Math.sqrt(Math.max(1,vc*vc-cr*cr))+p.wind*Math.cos(a)),g2=Math.max(2,Math.sqrt(Math.max(1,vc*vc-cr*cr))-p.wind*Math.cos(a));tA=dd/g1;fly=dd/g1+dd/g2;rA=r0+R*tA}
  const C1=m.pay/(fly+m.rf+2*DROPT),Wl=(thr/cs)*(Math.PI/4)*(r0+R*(tA+Tc)),D=Wl/Tc,feas=fly<=m.end*60*.85,N_=feas?D/C1:Infinity;
  return{l:['L','NE','N','NO','O','SO','S','SE'][k],R:R*60,Lf,direct,D,C1,N:N_,feas,Fl:Lf}})}
function summ(p,m,n){const s=sectorsA(p,m),sum=s.reduce((t,x)=>t+x.N,0),Nt=isFinite(sum)?Math.max(1,Math.ceil(sum)):Infinity;return{s,Nt,ratio:isFinite(Nt)?n/Nt:0}}
function rank(p,n){const r=MODELS.map(m=>{const q=summ(p,m,n);return{m,...q,viable:q.Nt<=n,cost:q.Nt*m.cx}});const v=r.filter(x=>x.viable).sort((a,b)=>a.cost-b.cost);return{r,best:v[0]||null,v}}
// ---- resolução espacial/temporal automática: convergência de malha no próprio cenário (sem drones, sem ruído) ----
function convergence(p,list=[50,30,20,15,10]){const side=Math.sqrt(p.area*1e4),rows=[];
 for(const cs of list){const q={...p,cs,noise:0,a0:.02},W0=world(q,1),c=(W0.iy|0)*W0.N+(W0.ix|0),tmin=Math.max(5,Math.min(30,.35*side/W0.Rh[c])),t0=Date.now(),
  r=simulate(q,{pay:1,v:10,end:1,rf:1},0,'direto',1,{tstop:tmin*60}),W=r.W,th=W.Rh[c]*tmin;rows.push({cs:W.cs,N:W.N,dt:W.dt,tmin,burned:r.burnedHa,head:r.headM,theo:th,err:(r.headM-th)/th,ms:Date.now()-t0})}
 return rows}
const RC=new Map();
function resolve(p,force){const key=[p.fi,p.area,p.wind,p.wdir,p.slope,p.sdir,p.rh,p.temp,p.a0].join('|');if(!force&&RC.has(key))return RC.get(key);
 const side=Math.sqrt(p.area*1e4),r0=Math.sqrt(p.a0*1e4/Math.PI),all=[50,30,20,15,10].filter(c=>side/c<=200);let list=all.filter(c=>c<=Math.max(10,r0/1.5));if(!list.length)list=[Math.max(10,Math.ceil(side/200))];
 const rows=convergence(p,list),fine=rows[rows.length-1],Rhd=rows[0].theo/rows[0].tmin,MINC=Rhd>=5?20:0; // fogos lentos (< 5 m/min) podem usar malha fina
 // acoplamento com drones:deriva e altura de lançamento dão incerteza de 10–20 m na posição da água
 const elig=rows.filter(r=>r.cs>=MINC);let pick=elig.length?elig[elig.length-1]:fine,why=elig.length?(MINC?'malha mais fina com ≥ 20 m (limite de precisão de lançamento)':'malha mais fina permitida (fogo lento)'):'foco inicial pequeno exige malha < 20 m (resultado do combate menos confiável)';
 for(const r of elig){if(Math.abs(r.err)<=.04&&Math.abs(r.burned-fine.burned)/Math.max(1e-6,fine.burned)<=.08){pick=r;why='célula mais grossa (≥ 20 m) com erro de avanço ≤ 4% e área ≤ 8% da malha mais fina';break}}
 const out={cs:pick.cs,N:pick.N,dt:pick.dt,why,rows,limits:{N200:side/200,ign:r0/1.5}};RC.set(key,out);return out}
// ================= OTIMIZAÇÃO DE FROTA (modelo × nº de drones × tática) =================
// min J(m,n,τ)  s.a.  contenção (área ≤ A_max, base e borda intactas) em simulação (malha escolhida, semente 1),
// robustez (contém nas malhas mais finas e em ≥ 2 de 3 réplicas), n ≤ n_max; autonomia/ciclo e limite de chama valem dentro da simulação.
const OBJ={custo:(c,m,n)=>c.tot,capex:(c,m,n)=>m.cx*n,drones:(c,m,n)=>n+1e-9*c.tot};
const tick=()=>new Promise(r=>setTimeout(r,0));
function bestOf(p,m,n,seed,tacs,o){let b=null;for(const t of tacs){const r=simulate(p,m,n,t,seed,o);if(!b||(r.ok&&!b.ok)||(r.ok==b.ok&&r.burnedHa<b.burnedHa))b=r}return b}
function robustFleet(p,m,n0,nMax,tacs){let n=n0,capped=false;const side=Math.sqrt(p.area*1e4),okAt=(c,nn,sd)=>bestOf({...p,cs:c},m,nn,sd,tacs,{fast:1}).ok;
 for(const c of [30,20,15,10].filter(c=>c<p.cs&&side/c<=200)){let ok=okAt(c,n,1);while(!ok&&n<nMax){n=Math.min(nMax,Math.ceil(n*1.25)+1);ok=okAt(c,n,1)}if(!ok){capped=true;break}}
 for(let it=0;it<3&&!capped;it++){let pass=0;for(const sd of [2,3,4])if(okAt(p.cs,n,sd))pass++;if(pass>=2)break;if(n>=nMax){capped=true;break}n=Math.min(nMax,Math.ceil(n*1.15)+1)}
 return{n,capped}}
async function optimizeFleet(p,nMax,objKey='custo',tacs=['indireto','cercamento'],prog=()=>{}){const J=OBJ[objKey]||OBJ.custo,rows=[];
 for(let mi=0;mi<MODELS.length;mi++){const m=MODELS[mi];prog(`Otimização · triagem ${mi+1}/${MODELS.length}: ${m.name}`);await tick();
  const ev=n=>bestOf(p,m,n,1,tacs,{fast:1}),top=ev(nMax);if(!top.ok){rows.push({m,mi,nMin:null});continue}
  let lo=1,hi=nMax,best=top;while(lo<hi){const mid=(lo+hi)>>1,r=ev(mid);if(r.ok){hi=mid;best=r}else lo=mid+1}
  const cc=costs(p,m,hi,best);rows.push({m,mi,nMin:hi,score:J(cc,m,hi),tot:cc.tot,tactic:best.tactic})}
 const feas=rows.filter(r=>r.nMin!=null).sort((a,b)=>a.score-b.score),K=Math.min(4,feas.length);
 for(let k=0;k<K;k++){const r=feas[k];prog(`Otimização · robustez ${k+1}/${K}: ${r.m.name}`);await tick();const rb=robustFleet(p,r.m,r.nMin,nMax,tacs);r.nRob=rb.n;r.capped=rb.capped;
  const sim=bestOf(p,r.m,rb.n,1,tacs,{fast:1}),cc=costs(p,r.m,rb.n,sim);r.tacticRob=sim.tactic;r.scoreRob=J(cc,r.m,rb.n);r.totRob=cc.tot}
 const ref=feas.slice(0,K).sort((a,b)=>(a.capped-b.capped)||(a.scoreRob-b.scoreRob));
 return{best:ref[0]||null,refined:ref,rows:rows.sort((a,b)=>(a.nMin==null)-(b.nMin==null)||((a.score||0)-(b.score||0)))}}
