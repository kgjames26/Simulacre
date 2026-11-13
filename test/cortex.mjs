// Le cortex croise-t-il vraiment les régions ? On amène Néo devant chaque chose (sans navigation) et on regarde ce qu'il déduit.
import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});
skill=4;records[4].mastered=true;age=2;
globalThis.T=10;
globalThis.visite=(entity)=>{alex.x=entity.x;alex.z=entity.z;T+=25;perceiveStep(T);objectLearning[entity.id]=undefined;tryEntity(entity,T);};
globalThis.cycle=()=>{for(const entity of entities().filter(e=>e.kind==='objet'||e.kind==='porte'||e.kind==='lieu'))visite(entity);
  alex.thirst=.9;alex.hunger=.8;T+=70;Brain.consolider(T,{});Cortex.deduire(T,{lexique:[]});};`);
const mesure=()=>JSON.parse(run(`JSON.stringify((()=>{const v=Cortex.view(observerLabel);return {liens:v.liens,idees:Brain.state.associations.idees.length,deduit:v.deductions,confirmees:v.confirmees,souvenirs:Brain.state.memoire.episodes.length}})())`));
const stats=[];
for(let i=0;i<16;i++){run('cycle()');if(i%2===1)stats.push(mesure());}
console.log(stats.map(s=>JSON.stringify(s)).join('\n'));
const view=JSON.parse(run(`JSON.stringify(Cortex.view(observerLabel))`));
const multi=view.idees.filter(i=>i.regions.length>=2).length;
const types=[...new Set(view.idees.map(i=>i.type))];
console.log('types d\'idées :',types.join(', '),'· croisant ≥2 régions :',multi+'/'+view.idees.length);
const a=stats[0],z=stats.at(-1);
const ok=z.liens>a.liens&&z.deduit>0&&multi>0&&z.confirmees>=1;
console.log(ok?'OK cortex (plus de vécu → plus de liens, des idées vérifiées)':'ECHEC cortex');
process.exit(ok?0:1);
