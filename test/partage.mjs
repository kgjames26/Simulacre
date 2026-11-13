import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});`);
// Néo ne sait rien : personne ne reçoit rien.
run(`activityData=null;snapshot();`);
const vide=run(`people.map(p=>p.inherited)`);
if(vide.some(n=>n>0))throw new Error('partage sans savoir');
// Savoir publié mais faible : amis oui, famille non.
run(`Brain.state.partage.publie.push({});Brain.ouvrirPartage('amis');dialogue.view=()=>({vocabulary:Array.from({length:10},(_,i)=>({word:'m'+i}))});activityData=null;snapshot();`);
const r=run(`Object.fromEntries(people.map(p=>[p.id,p.partage]))`);
if(!r.timeo||!r.rose||r.joseph||r.marie)throw new Error('paliers incorrects '+JSON.stringify(r));
// Savoir élevé : la famille reçoit aussi.
run(`dialogue.view=()=>({vocabulary:Array.from({length:40},(_,i)=>({word:'m'+i}))});activityData=null;snapshot();`);
if(!run(`people.find(p=>p.id==='joseph').partage`)||!run(`Brain.state.partage.famille`))throw new Error('famille ne reçoit pas');
console.log('partage ok');
// Règle d'envie de bien-être : dépend du lien, du caractère et du mal-être ; rien d'écrit sur la façon de faire.
run(`globalThis.__p={bond:6,faim:.8};globalThis.__q={bond:0,faim:.9};globalThis.__r={bond:6,faim:0,peine:0};`);
const ep=run(`envieDeBienEtre('alex',__p)`);
if(!(ep>.2)||run(`envieDeBienEtre('alex',__q)`)!==0||run(`envieDeBienEtre('alex',__r)`)!==0)throw new Error('envie');
if(!(run(`envieDeBienEtre('marie',__p)`)>ep))throw new Error('le caractère doit compter (Marie plus attentive)');
console.log('envie ok');
// Les enfants du même âge ne parlent pas d'eux-mêmes : ils ne disent que des mots de Néo.
{
  const {run:r2}=boot();
  r2(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});`);
  r2(`for(const f of people.slice(3)){f.x=10;f.z=3;f.floor=0;f.dedans=false;}alex.x=11;alex.z=3;for(let i=0;i<120*300;i++){ticks++;dialogue.step(ticks*DT,alex,people,languageScene);}`);
  const enfants=r2(`dialogue.view().lines.filter(l=>['timeo','nathan','lidia','rose'].includes(l.speaker)).length`);
  if(enfants)throw new Error('les enfants parlent sans les mots de Néo');
  console.log('enfants muets ok');
}
// Bébés : quelques mots simples ; grands enfants : de vraies phrases tirées du langage des parents.
{
  const {run:r3}=boot();
  r3(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});age=1;`);
  r3(`for(const f of people.slice(3)){f.x=10;f.z=3;f.floor=0;f.dedans=false;f.age=1;}alex.x=30;alex.z=30;for(let i=0;i<120*400;i++){ticks++;dialogue.step(ticks*DT,alex,people,languageScene);}`);
  const bebe=JSON.parse(r3(`JSON.stringify(dialogue.view().lines.filter(l=>['timeo','nathan','lidia','rose'].includes(l.speaker)).map(l=>l.text))`));
  if(!bebe.length||bebe.some(t=>(t.match(/[\p{L}’'-]+/gu)||[]).length>1))throw new Error('bébés : un mot à la fois '+bebe.slice(0,3));
  r3(`age=5;for(const f of people.slice(3))f.age=5;for(let i=0;i<120*400;i++){ticks++;dialogue.step(ticks*DT,alex,people,languageScene);}`);
  const grands=JSON.parse(r3(`JSON.stringify(dialogue.view().lines.filter(l=>['timeo','nathan','lidia','rose'].includes(l.speaker)).slice(-10).map(l=>l.text))`));
  if(!grands.some(t=>t.split(/\s+/).length>=3))throw new Error('grands : phrases attendues '+grands.slice(0,3));
  console.log('langage par étape ok',bebe.slice(0,4).join(' | '),'||',grands.slice(0,3).join(' | '));
}
