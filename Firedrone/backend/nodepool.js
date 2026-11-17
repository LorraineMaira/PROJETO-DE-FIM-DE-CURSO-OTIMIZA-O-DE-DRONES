// Pool de worker_threads: cada worker carrega o núcleo e executa OPS[op](args).
const {Worker}=require('worker_threads'),os=require('os'),{coreSource,EXPORT}=require('./core_loader');
const WCODE=`const {parentPort,workerData}=require('worker_threads');const api=new Function(workerData.code+workerData.exp)();
parentPort.on('message',({id,op,args})=>{try{parentPort.postMessage({id,res:api.OPS[op](args)})}catch(e){parentPort.postMessage({id,err:String(e&&e.stack||e)})}});`;
function makePool(size=Math.max(1,Math.min(8,os.cpus().length))){
 const code=coreSource(),ws=[],q=[],pend=new Map();let nid=1;
 const spawn=()=>{const w=new Worker(WCODE,{eval:true,workerData:{code,exp:EXPORT}});w.busy=null;
  w.on('message',m=>{const p=pend.get(m.id);pend.delete(m.id);w.busy=null;m.err?p.rej(new Error(m.err)):p.res(m.res);pump()});w.on('error',e=>{const id=w.busy;if(id&&pend.has(id)){pend.get(id).rej(e);pend.delete(id)}w.busy=null});return w};
 for(let i=0;i<size;i++)ws.push(spawn());
 function pump(){for(const w of ws){if(w.busy||!q.length)continue;const t=q.shift();w.busy=t.id;w.postMessage({id:t.id,op:t.op,args:t.args})}}
 return{size,run(op,args){return new Promise((res,rej)=>{const id=nid++;pend.set(id,{res,rej});q.push({id,op,args});pump()})},close(){ws.forEach(w=>w.terminate())}}}
module.exports={makePool};
