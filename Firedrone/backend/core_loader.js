// Carrega o MESMO código do navegador (core/data.js + engine.js + opt.js) em Node.
const fs=require('fs'),path=require('path');
const DIR=path.join(__dirname,'..','core');
const coreSource=()=>['data.js','engine.js','opt.js'].map(f=>fs.readFileSync(path.join(DIR,f),'utf8')).join('\n');
const EXPORT=';return {FUELS,MODELS,simulate,bestOf,bestTactic,world,resolve,convergence,costs,summ,sectorsA,rank,TACTICS,OBJ,OPS,UNC0,UNC_INFO,UKEYS,optimizeFleetPar,confirmFleet,mcFleet,mcDistribution,opSummary,tornado,inlinePool,applyU,uvec,wilson,pct,RATIO,ETA,rng}';
module.exports={coreSource,EXPORT,load:()=>new Function(coreSource()+EXPORT)()};
