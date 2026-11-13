import {boot} from './harness.mjs';
const sim=()=>{const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});learnedMovement=(p,x,z)=>{const d=Math.hypot(x-p.x,z-p.z);if(d>.05){const k=Math.min(1,.012/d);walkStep(p,p.x+(x-p.x)*k,p.z+(z-p.z)*k);}return Math.hypot(x-p.x,z-p.z);};skill=4;records[4].mastered=true;pecm=500;for(let i=0;i<120*300;i++){ticks++;if(!sleeps.has(alex))motorStep();experience();}`);
return JSON.stringify(run('Brain.save()'));};
const a=sim(),b=sim();
console.log(a===b?'OK déterminisme ('+a.length+' octets)':'ECHEC déterminisme');
process.exit(a===b?0:1);
