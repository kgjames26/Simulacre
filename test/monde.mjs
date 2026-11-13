import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});`);
const libre=(x,z)=>run(`navigation.isFree(${x},${z},0)`);
// Propriétés privées fermées, routes ouvertes, portail ouvert, clôture fermée.
if(libre(29,5)||libre(-29,5)||libre(-60,6))throw new Error('propriété privée accessible');
if(!libre(10,16)||!libre(49,0)||!libre(-4,13))throw new Error('route fermée');
if(libre(0,12)||!libre(-4,12))throw new Error('clôture / portail');
// Néo (moins de 5 ans) reste dans sa propriété.
run(`age=2;alex.x=0;alex.z=0;for(let i=0;i<4000;i++){move(alex,-4,30,1)}`);
if(run(`alex.z`)>12)throw new Error('Néo est sorti');
// Pénurie : plus de remplissage magique.
run(`ensureFoodStock();kitchen.pantry.forEach(f=>f.stock=0);ensureFoodStock();nextRefill=0;stepKitchen(5000);stepKitchen(5100);`);
if(run(`kitchen.ingredients`)!==0)throw new Error('réapprovisionnement magique');
// Quota par agent et par jour, sans argent.
run(`commerce={jour:0,stock:60,prelev:{},total:0,visites:0};`);
const a=run(`prelever('joseph')`),b=run(`prelever('joseph')`);
if(a!==8||b!==0)throw new Error('quota '+a+' '+b);
if(run(`prelever('marie')`)!==8)throw new Error('quota par agent');
// Course complète : l'adulte revient avec des provisions rangées.
run(`commerce={jour:0,stock:60,prelev:{},total:0,visites:0};globalThis.__m=people[1];__m.x=-4;__m.z=10;__m.homeX=-4;__m.homeZ=10;routineCourses(__m);__m.enCourse=true;`);
let n=0;while(run(`ROUT.has(__m)`)&&n<400000){run(`ticks++;stepRoutine(__m,ticks/120)`);n++;}
if(run(`kitchen.ingredients`)<6||run(`commerce.visites`)!==1)throw new Error('course '+run(`kitchen.ingredients`)+' '+n);
// Un ami n'entre que accompagné, et pas avant l'adolescence.
if(run(`peutEntrerChezNeo({id:'timeo'},null)`)||run(`age=3;acces.amisAccompagnes=false;peutEntrerChezNeo({id:'timeo'},people[1])`))throw new Error('invitation');
console.log('monde ok');
