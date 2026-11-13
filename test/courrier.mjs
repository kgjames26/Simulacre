import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});house.computer={x:-9,z:1,y:1.95,heading:0};entityCache=null;`);
if(!run(`entities().some(e=>e.computerId&&e.floor===1)`))throw new Error('ordinateur absent');
// Sans savoir, Néo n'écrit rien.
run(`for(let i=0;i<5;i++)utiliserOrdinateur(100+i*50);`);
if(run(`courrier.sortant.length`)!==0)throw new Error('message sans savoir');
run(`dialogue.view=()=>({phrases:[],vocabulary:[{word:'chat'},{word:'eau'}]});for(let i=0;i<4;i++)utiliserOrdinateur(1000+i*50);`);
const n=run(`courrier.sortant.length`);
if(n<1)throw new Error('Néo devrait pouvoir écrire');
const txt=run(`courrier.sortant[0].text`);
if(!/^(chat|eau)( (chat|eau)){0,2}$/.test(txt))throw new Error('texte inattendu '+txt);
// Seul, après une surprise : le message est signalé avec son contexte.
run(`alex.floor=1;for(const p of people){p.x=50;p.z=50;}(Brain.state.cortex||={}).surprise=.4;courrier.prochain=0;utiliserOrdinateur(9000);`);
if(!run(`courrier.sortant.at(-1).createur`)||!run(`courrier.sortant.at(-1).contexte.join(' ')`).includes('Jour'))throw new Error('contexte créateur');
// Ce que l'utilisateur écrit est lu à l'écran, une fois.
run(`dialogue.lireEcran=(t)=>{globalThis.__lu=t};onmessage({data:{type:'courrier',text:'bonjour'}});utiliserOrdinateur(5000);`);
if(run(`globalThis.__lu`)!=='bonjour')throw new Error('lecture');
// Aucun nom dans le cerveau.
if(/ordinateur/.test(run(`JSON.stringify(Brain.save())`)))throw new Error('fuite');
console.log('courrier ok');
