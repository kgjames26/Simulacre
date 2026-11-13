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
// Règle d'envie de bien-être : dépend du lien, du caractère et du mal-être ; rien d'écrit sur la façon de faire.
run(`globalThis.__p={bond:6,faim:.8};globalThis.__q={bond:0,faim:.9};globalThis.__r={bond:6,faim:0,peine:0};`);
const ep=run(`envieDeBienEtre('alex',__p)`);
if(!(ep>.3)||run(`envieDeBienEtre('alex',__q)`)!==0||run(`envieDeBienEtre('alex',__r)`)!==0)throw new Error('envie');
if(!(run(`envieDeBienEtre('marie',__p)`)>ep))throw new Error('le caractère doit compter (Marie plus attentive)');
console.log('envie ok');
