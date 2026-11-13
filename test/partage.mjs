import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});`);
// Néo ne sait rien : personne ne reçoit rien.
run(`activityData=null;snapshot();`);
const vide=run(`people.map(p=>p.inherited)`);
if(vide.some(n=>n>0))throw new Error('partage sans savoir');
// Savoir publié mais faible : amis oui, famille non.
run(`Brain.state.publie.push({});Brain.synchroniser('amis');dialogue.view=()=>({vocabulary:Array.from({length:10},(_,i)=>({word:'m'+i}))});activityData=null;snapshot();`);
const r=run(`Object.fromEntries(people.map(p=>[p.id,p.partage]))`);
if(!r.timeo||!r.rose||r.joseph||r.marie)throw new Error('paliers incorrects '+JSON.stringify(r));
// Savoir élevé : la famille reçoit aussi.
run(`dialogue.view=()=>({vocabulary:Array.from({length:40},(_,i)=>({word:'m'+i}))});activityData=null;snapshot();`);
if(!run(`people.find(p=>p.id==='joseph').partage`)||!run(`Brain.state.synchro.famille`))throw new Error('famille ne reçoit pas');
console.log('partage ok');
// Aide : un ami aimé qui a faim reçoit de l'aide ; un inconnu non (logique de condition).
run(`globalThis.__p={bond:3,faim:.8};globalThis.__q={bond:1,faim:.9};`);
if(!run(`aEnvieDAider(__p)&&aBesoin(__p)`)||run(`aEnvieDAider(__q)`))throw new Error('aide');
console.log('aide ok');
