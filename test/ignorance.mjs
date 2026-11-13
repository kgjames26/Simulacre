import {boot} from './harness.mjs';
const {ctx,run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});`);
run(`learnedMovement=(p,x,z)=>{const d=Math.hypot(x-p.x,z-p.z);if(d>.05){const k=Math.min(1,.012/d);walkStep(p,p.x+(x-p.x)*k,p.z+(z-p.z)*k);}return Math.hypot(x-p.x,z-p.z);};skill=4;records[4].mastered=true;records[4].confirmed=3;pecm=500;`);
run(`for(let i=0;i<120*600;i++){ticks++;if(!sleeps.has(alex))motorStep();experience();}`);
const brain=JSON.stringify(run('Brain.save()'));
const forbidden=['canapé','télévision','livre','fontaine','douche','frigo','cheminée','Joseph','Marie','Juliette','sofa','tv','fireplace','shower','kitchen'];
let bad=0;
for(const w of forbidden){
  const re=new RegExp('"[^"]*'+w+'[^"]*"','i');
  const m=brain.match(re);
  if(m){bad++;console.log('FUITE',w,m[0].slice(0,80));}
}
console.log('taille',JSON.stringify(run('Brain.taille()')));
console.log('causes confirmées',run('Brain.confirmees().length'),'objets',run('Brain.registre().length'));
console.log(bad?'ECHEC ignorance':'OK ignorance');
process.exit(bad?1:0);
