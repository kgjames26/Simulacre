import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});house.objects.fireplace={x:-3,z:-1};`);
run(`globalThis.__j=people[0];__j.x=1;__j.z=-1;__j.homeX=1;__j.homeZ=-1;`);
// Abattage : l'arbre repousse, le tas grossit, la scie retourne au mur.
run(`routineAbattre(__j,atelier.arbres[0]);`);
let n=0;while(run(`ROUT.has(__j)`)&&n<60000){run(`ticks++;stepRoutine(__j,ticks/120);stepAtelier(ticks/120)`);n++;}
const r=run(`({tas:atelier.bois.tas,coupes:atelier.arbres[0].coupes,scie:outil('hache').etat,t:atelier.arbres[0].t,carry:__j.carry})`);
if(ROUT_FAIL(r))throw new Error('scier '+JSON.stringify(r)+' après '+n);
function ROUT_FAIL(r){return !(r.coupes===1&&r.tas>=6&&r.scie==='mur'&&!r.carry);}
for(let i=0;i<60000&&run(`atelier.arbres[0].t`)<1;i++)run(`ticks++;stepAtelier(ticks/120)`);
if(run(`atelier.arbres[0].t`)<1)throw new Error('arbre ne repousse pas');
// Planches : la scie, plus lente, produit des planches rangées près de la maison.
run(`atelier.bois.tas=5;routinePlanches(__j);`);
n=0;while(run(`ROUT.has(__j)`)&&n<80000){run(`ticks++;stepRoutine(__j,ticks/120);stepAtelier(ticks/120)`);n++;}
if(run(`atelier.bois.planches`)<2||run(`outil('scie').etat`)!=='mur')throw new Error('planches');
// Pommes : elles tombent puis disparaissent ; Néo peut en manger sans que personne ne le sache.
run(`atelier.arbres[0].t=1;atelier.arbres[0].chute=0;atelier.prochainePomme=0;atelier.pommes=[];stepAtelier(1);`);
if(run(`atelier.pommes.length`)<1)throw new Error('pas de pomme');
run(`alex.hunger=.7;globalThis.__e=entities().find(e=>e.pommeId);`);
if(!run(`__e&&respond(__e,'saisir',5).flags.includes('gout')`)||!(run(`alex.hunger`)<.7))throw new Error('manger pomme');
run(`atelier.prochainePomme=1e9;atelier.pommes=[{id:'x',x:5,z:-4,floor:0,nee:0}];stepAtelier(400);`);
if(run(`atelier.pommes.length`)!==0)throw new Error('pomme persistante');
// Joseph âgé n'ira plus au bois.
run(`age=8;stepAtelier(1);atelier.bois.tas=0;atelier.bois.poele=0;atelier.arbres[0].t=1;atelier.suivant.joseph=0;__j.floor=0;`);
if(run(`stepBricolage(people[0],0,1000)||ROUT.has(people[0])`))throw new Error('Joseph âgé travaille le bois');
run(`age=3;stepAtelier(1)`);
// Fleurs : la soif monte, l'arrosoir revient au mur.
run(`globalThis.__m=people[1];__m.x=1;__m.z=3;atelier.fleurs.forEach(f=>f.soif=.9);routineArroser(__m);`);
n=0;while(run(`ROUT.has(__m)`)&&n<80000){run(`ticks++;stepRoutine(__m,ticks/120)`);n++;}
const f=run(`({soifs:atelier.fleurs.map(x=>x.soif),can:outil('arrosoir').etat,hose:outil('tuyau').etat,plein:outil('arrosoir').plein})`);
if(f.soifs.some(x=>x>0.1)||f.can!=='mur'||f.hose!=='mur'||f.plein)throw new Error('arroser '+JSON.stringify(f)+' '+n);
// Vieillesse
run(`age=8;stepAtelier(1)`);
if(!run(`people[0].vieux&&people[1].vieux`)||run(`people[2].vieux`))throw new Error('vieux');
run(`age=3;stepAtelier(1)`);
// Néo : rien d'obligatoire ; toucher des outils donne plaisir et confiance, assembler aussi.
run(`alex.pleasure=0;alex.confiance=.3;neoToucheOutil(outil('marteau'),1);neoToucheOutil(outil('vis'),2);neoToucheOutil(outil('vis'),3);neoToucheOutil(outil('marteau'),4);`);
if(!(run(`alex.confiance`)>.3)||run(`atelier.neo.fabrications`)<1)throw new Error('bricolage Néo');
// Tous les arbres : Néo peut en abattre un s'il tient la hache ; il repousse.
run(`placeOutil(outil('hache'));alex.carry=null;globalThis.__e=entities().find(e=>e.arbreIdx===5);respond(entities().find(e=>e.outilId==='hache'),'saisir',9000);`);
if(run(`alex.carry`)!=='hache')throw new Error('Néo ne garde pas la hache');
run(`atelier.arbres[5].t=1;atelier.arbres[5].chute=0;`);
if(!run(`respond(__e,'frapper',9001).flags.includes('tombe')`))throw new Error('Néo ne peut pas abattre un arbre');
for(let i=0;i<60000&&run(`atelier.arbres[5].t`)<1;i++)run(`ticks++;stepAtelier(ticks/120)`);
if(run(`atelier.arbres[5].t`)<1||run(`atelier.arbres.length`)<20)throw new Error('les arbres ne repoussent pas');
console.log('atelier ok');
