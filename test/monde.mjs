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
run(`commerce={jour:0,stock:100,prelev:{},total:0,visites:0};`);
const a=run(`prelever('joseph')`),b=run(`prelever('joseph')`);
if(a!==14||b!==0)throw new Error('quota '+a+' '+b);
if(run(`prelever('marie')`)!==14)throw new Error('quota par agent');
// Course complète : l'adulte revient avec des provisions rangées.
run(`commerce={jour:0,stock:100,prelev:{},total:0,visites:0};globalThis.__m=people[1];__m.x=-4;__m.z=10;__m.homeX=-4;__m.homeZ=10;routineCourses(__m);__m.enCourse=true;`);
let n=0;while(run(`ROUT.has(__m)`)&&n<400000){run(`ticks++;stepRoutine(__m,ticks/120)`);n++;}
if(run(`kitchen.ingredients`)<6||run(`commerce.visites`)!==1)throw new Error('course '+run(`kitchen.ingredients`)+' '+n);
// Un ami n'entre que accompagné, et pas avant l'adolescence.
if(run(`peutEntrerChezNeo({id:'timeo'},null)`)||run(`age=3;acces.amisAccompagnes=false;peutEntrerChezNeo({id:'timeo'},people[1])`))throw new Error('invitation');
// Interdits des parents qui s'élargissent avec l'âge.
const permis=(a,x,z,f=0)=>run(`age=${a};autorise(${x},${z},${f})`);
if(!permis(0,-8,0)||permis(0,0,-8)||permis(0,-8,0,1))throw new Error('nourrisson : seulement la maison');
if(!permis(2,0,-8)||permis(2,10,2)||permis(2,-8,0,1))throw new Error('petit enfant : jardin');
if(!permis(3,-8,0,1)||permis(3,10,2))throw new Error('enfant : étage');
if(!permis(4,10,2)||permis(4,30,16))throw new Error('grand enfant : aire de jeux');
if(!permis(5,30,16)||!permis(5,62,10)||permis(5,49,0))throw new Error('jeune ado : chemin du commerce');
if(!permis(6,49,0))throw new Error('ado : quartier');
// Néo est retenu au bord, et s'en souvient (un peu).
run(`age=2;acces.niveau=1;alex.floor=0;alex.x=4.2;alex.z=4;`);
if(!run(`navigation.clear(4.2,4,4.45,4,0)`))throw new Error('porte du parc fermée');
if(run(`walkStep(alex,4.45,4)`))throw new Error('Néo devait être retenu');
if(!run(`Brain.interdit(4.45,4,0)`))throw new Error('limite non mémorisée');
run(`age=4;leverInterdits();`);
if(run(`acces.niveau`)!==3||!run(`journal.some(j=>j.message.includes('aire de jeux'))`))throw new Error('levée des interdits');
console.log('monde ok');
