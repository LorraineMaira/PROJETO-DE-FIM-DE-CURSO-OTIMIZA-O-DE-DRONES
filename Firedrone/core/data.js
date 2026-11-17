const DR=[['Spider H32X',16,15,7.5,38,15.2,8000,'V'],['Spider H40X',20,15,7.5,44.8,18,10000,'V'],['Spider H60-4',30,15,10,70,28,14000,'P'],['Spider H120',52,15,8,120,40,18000,'P'],['Spider M65',62,15,12.3,111,34,22000,'V'],['Spider H160',72,15,7.5,149,51,25000,'V'],['Spider H200',92,15,9,200,60,38000,'P'],['Spider H300 (100 L)',100,15,11,254,74,48000,'V'],['Spider M400',150,15,10,400,120,70000,'P'],['Spider H300 Firefighting (4×25 kg)',100,15,15,257.8,107.8,55000,'V'],['DJI Agras T10',8,10,8,24.8,13,13999,'V'],['DJI Agras T20P',20,10,7,50,24,17000,'M'],['DJI Agras T25',20,10,7,52,25,23359,'V'],['DJI Agras T30',30,10,8,66.5,26,20000,'M'],['DJI Agras T40',40,10,8,90,38,26000,'M'],['DJI Agras T50',40,10,8,92,40,36699,'V'],['DJI Agras T100',100,20,8,175,75,55000,'P'],['DJI FlyCart 30',30,20,12,95,65,17000,'M'],['XAG P100 Pro',50,10,8,100,45,24000,'M'],['EAVision EA-30X',30,10,8,70,30,15000,'M']];
let MODELS=DR.map(a=>({name:a[0],pay:a[1],v:a[2],end:a[3],mtow:a[4],empty:a[5],cx:a[6],src:a[7],rf:(typeof process!=="undefined"&&process.env.FD_RFS?+process.env.FD_RFS:1.2)*a[1]+120,ox:Math.max(15,a[6]*.0025)}));
// Aeronaves tripuladas (kind:'heli') para comparação direta. Fonte: Tabela 2 do artigo CBA: carga (kg, tratada como litros de água), velocidade de solo (m/s; aqui v = valor do artigo / 0,85,
// porque o motor aplica 0,85 de cruzeiro), mobilização (mob, s: atraso mínimo até a chegada), recarga/reabastecimento (rf, s), OpEx (US$/h) e CapEx (US$).
// Estimados: ws (largura da faixa molhada por lançamento, m), lmax (chama máx. p/ ataque direto, m) e autonomia (end, min). A água é captada junto à base.
const HELI=[
 {name:'Aeronave Airbus AS350 B3 (Esquilo, 1.100 L)',ref:true,pay:1100,v:65/.85,end:120,mtow:2250,empty:1350,cx:4e6,src:'A',rf:60,ox:2294,kind:'heli',mob:900,ws:8,lmax:8},
 {name:'Aeronave Bell 505 (680 L)',pay:680,v:64/.85,end:120,mtow:1670,empty:1000,cx:1.5e6,src:'A',rf:60,ox:2068,kind:'heli',mob:900,ws:8,lmax:8},
 {name:'Aeronave Leonardo AW119 (1.200 L)',pay:1200,v:70/.85,end:120,mtow:2850,empty:1700,cx:4.5e6,src:'A',rf:60,ox:2902,kind:'heli',mob:900,ws:8,lmax:8},
 {name:'Aeronave UH-60 Black Hawk (3.000 L)',pay:3000,v:75/.85,end:120,mtow:9980,empty:5220,cx:15e6,src:'A',rf:90,ox:5500,kind:'heli',mob:1200,ws:10,lmax:8},
 {name:'Aeronave Air Tractor AT-802 (3.100 L)',pay:3100,v:80/.85,end:120,mtow:7257,empty:3000,cx:2.5e6,src:'A',rf:240,ox:3000,kind:'heli',mob:1800,ws:10,lmax:8}];
MODELS.push(...HELI);
const FM=(w0,delta,sigma,Mx,extra={})=>({w0,delta,sigma,Mx,h:18607,rho_p:512,ST:.0555,SE:.01,...extra});
// Combustíveis de camada única (estilo NFFL/Anderson 1982, SI). waf = fator de ajuste do vento 10 m -> meia-chama. addMf = umidade extra (fração) p/ combustível vivo/serapilheira.
// d = condições típicas de ataque inicial: area ha, a0 ha, vento m/s, vento p/ °, declive °, aclive °, UR %, T °C, base m, base rel., resolução m, perda máx ha
const FUELS=[
{name:'1 · Pampa / gramínea curta (NFFL 1)',fm:FM(.166,.305,11483,.12),sm:300,waf:.4,addMf:0,d:{resp:300,n:60,area:300,a0:.3,wind:5,wdir:20,slope:2,sdir:0,rh:35,temp:28,bdist:500,brel:'bar',maxloss:20}},
{name:'2 · Campo rupestre (campo sujo rochoso)',fm:FM(.6,.35,11500,.12),sm:400,waf:.4,addMf:0,d:{resp:300,n:60,area:400,a0:.5,wind:5,wdir:45,slope:12,sdir:45,rh:25,temp:26,bdist:600,brel:'bar',maxloss:25}},
{name:'3 · Cerrado campo limpo/sujo (NFFL 3)',fm:FM(.673,.76,4921,.25),sm:600,waf:.4,addMf:0,d:{resp:300,n:60,area:500,a0:.5,wind:4,wdir:30,slope:5,sdir:30,rh:30,temp:30,bdist:600,brel:'bar',maxloss:30}},
{name:'4 · Cerrado sentido restrito (framework)',fm:FM(1.123,1.83,6561.7,.2),sm:1500,waf:.3,addMf:0,d:{resp:180,n:60,area:500,a0:.5,wind:2.5,wdir:45,slope:2,sdir:45,rh:40,temp:30,bdist:700,brel:'bar',maxloss:40}},
{name:'5 · Cerradão (serapilheira + sub-bosque)',fm:FM(.9,.3,6562,.25),sm:3600,waf:.2,addMf:.03,d:{resp:300,n:60,area:400,a0:.3,wind:3,wdir:60,slope:4,sdir:60,rh:40,temp:28,bdist:500,brel:'bar',maxloss:20}},
{name:'6 · Pantanal (capim alto)',fm:FM(.8,1.0,4900,.25),sm:900,waf:.4,addMf:.02,d:{resp:300,n:60,area:600,a0:.5,wind:4,wdir:0,slope:.5,sdir:0,rh:45,temp:33,bdist:800,brel:'bar',maxloss:40}},
{name:'7 · Caatinga arbustiva (NFFL 5)',fm:FM(.6,.6,6562,.2),sm:900,waf:.3,addMf:0,d:{resp:300,n:60,area:500,a0:.5,wind:4,wdir:90,slope:5,sdir:90,rh:25,temp:34,bdist:700,brel:'bar',maxloss:35}},
{name:'8 · Mata Atlântica estacional (serapilheira)',fm:FM(.65,.06,8202,.25),sm:3600,waf:.15,addMf:.03,d:{resp:300,n:60,area:300,a0:.3,wind:3,wdir:45,slope:15,sdir:45,rh:40,temp:27,bdist:500,brel:'bar',maxloss:15}},
{name:'9 · Amazônia (floresta úmida)',fm:FM(1.6,2.4,3200,1.8),sm:2400,waf:.1,addMf:.9,d:{resp:300,n:60,area:300,a0:.3,wind:2,wdir:0,slope:2,sdir:0,rh:70,temp:30,bdist:500,brel:'bar',maxloss:15}},
{name:'10 · Eucalipto (serapilheira)',fm:FM(1.0,.15,5700,.25),sm:3600,waf:.2,addMf:.02,d:{resp:300,n:60,area:400,a0:.5,wind:4,wdir:45,slope:5,sdir:45,rh:35,temp:30,bdist:600,brel:'bar',maxloss:25}},
{name:'11 · Pinus (acículas, NFFL 8)',fm:FM(.45,.06,6562,.3),sm:3600,waf:.2,addMf:.02,d:{resp:300,n:60,area:400,a0:.5,wind:4,wdir:45,slope:8,sdir:45,rh:40,temp:26,bdist:600,brel:'bar',maxloss:20}},
{name:'12 · Pasto de braquiária / capim-gordura',fm:FM(.7,.8,5900,.25),sm:600,waf:.4,addMf:0,d:{resp:300,n:60,area:500,a0:.5,wind:5,wdir:45,slope:3,sdir:45,rh:30,temp:32,bdist:700,brel:'bar',maxloss:30}},
{name:'13 · Serra do Cipó — campo rupestre (REAL ago/2024)',fm:FM(.6,.35,11500,.12),sm:400,waf:.4,addMf:0,d:{resp:300,n:60,area:800,a0:2,wind:7,wdir:45,slope:15,sdir:45,rh:20,temp:28,bdist:500,brel:'bar',maxloss:80}}];
