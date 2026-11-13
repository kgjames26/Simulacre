import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
export function boot({seed}={}){
  const messages=[];
  const ctx={console,Math,Date,performance,setTimeout:()=>0,clearTimeout(){},
    postMessage:m=>messages.push(m),
    importScripts:(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,f.replace(/^\//,'')),'utf8'),ctx,{filename:f});}};
  ctx.atob=atob;ctx.btoa=btoa;ctx.TextEncoder=TextEncoder;ctx.TextDecoder=TextDecoder;ctx.self=ctx;ctx.fetch=undefined;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'sim.js'),'utf8'),ctx,{filename:'sim.js'});
  const house={
    objects:{sofa:{x:-6,z:-1},tv:{x:-9,z:-3},book:{x:-4,z:0},water:{x:-3,z:-4.5},shower:{x:-8,z:2},dishwasher:{x:-2,z:-3.5},fireplace:{x:-9.5,z:0}},
    kitchen:{fridge:{x:-1,z:-4,heading:0},oven:{x:-2.5,z:-4.4,heading:0},serve:{x:-3,z:-3,heading:0},table:{x:-4,z:-3.5,heading:0},cupboard:{x:-1.5,z:-4,heading:0},sink:{x:-2,z:-4,heading:0},drawer:{x:-2.2,z:-4,heading:0},counter:{x:-2.4,z:-4,heading:0},hob:{x:-2.6,z:-4,heading:0}},
    trampoline:{entryX:4,entryZ:4},beds:[],stairs:[],
    doors:[{id:'breezeway',name:'porte',x:-6,z:1,axis:'z',width:1,mechanism:'coulissante',floor:0,passage:true}]
  };
  vm.runInContext(`onmessage=onmessage`,ctx);
  ctx.__house=house;
  vm.runInContext('stepParentUpstairs=()=>false;stepNeoUpstairs=()=>false;cookMeal=()=>false;',ctx);
  return {ctx,messages,run:code=>vm.runInContext(code,ctx)};
}
