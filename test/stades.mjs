import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});learnedMovement=(p,x,z)=>{const d=Math.hypot(x-p.x,z-p.z);if(d>.05){const k=Math.min(1,.012/d);walkStep(p,p.x+(x-p.x)*k,p.z+(z-p.z)*k);}return Math.hypot(x-p.x,z-p.z);};`);
run(`for(const r of records)r.mastered=true;skill=4;for(let i=0;i<120*3600;i++){ticks++;if(!sleeps.has(alex))motorStep();experience();}`);
console.log('stade',run('age'),JSON.stringify(run('stageGoals')));
console.log('causes',run('Brain.confirmees().length'),'mots',run('dialogue.view().vocabulary.length'),'gestes',run('Brain.APPRENABLES.filter(g=>Brain.state.gestes[g]?.appris).length'));
