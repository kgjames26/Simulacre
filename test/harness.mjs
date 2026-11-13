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
  // Positions réelles de la villa (mêmes transformations que app.js : x=-3.65+.65·x, z=2.6-.65·z).
  const P=(x,z,heading=0)=>({x:+(-3.65+.65*x).toFixed(2),z:+(2.6-.65*z).toFixed(2),heading});
  const house={
    objects:{sofa:P(-10.15,-1.5),tv:P(-6.25,-2.3),book:P(-5.75,-2.9),water:P(-8.9,-5.23),shower:P(-1.16,-3.53),dishwasher:P(3.79,5.36),fireplace:P(3.73,1.67)},
    kitchen:{fridge:P(3.75,3.37),cupboard:P(3.68,7.48),sink:P(3.21,7.53),drawer:P(3.83,5.87),counter:P(3.82,4.43),hob:P(3.87,6.47),oven:P(3.75,6.47),serve:P(3.81,4.94),dishwasher:P(3.78,5.39),table:P(-1.30,4.45)},
    trampoline:{x:-2.07,y:.6,z:7.07,entryX:.67,entryZ:7.07},
    beds:[{...P(-12.39,5.85),floor:0,approach:P(-12.39,5.05)}],stairs:[],
    doors:[]
  };
  vm.runInContext(`onmessage=onmessage`,ctx);
  ctx.__house=house;
  vm.runInContext('stepParentUpstairs=()=>false;stepNeoUpstairs=()=>false;cookMeal=()=>false;',ctx);
  return {ctx,messages,run:code=>vm.runInContext(code,ctx)};
}
