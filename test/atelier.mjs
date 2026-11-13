import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});house.objects.fireplace={x:-3,z:-1};`);
run(`globalThis.__j=people[0];__j.x=1;__j.z=-1;__j.homeX=1;__j.homeZ=-1;`);
// Abattage : l'arbre repousse, le tas grossit, la scie retourne au mur.
run(`routineScier(__j);`);
let n=0;while(run(`ROUT.has(__j)`)&&n<60000){run(`ticks++;stepRoutine(__j,ticks/120);stepAtelier(ticks/120)`);n++;}
const r=run(`({tas:atelier.bois.tas,coupes:atelier.arbre.coupes,scie:outil('scie').etat,t:atelier.arbre.t,carry:__j.carry})`);
if(ROUT_FAIL(r))throw new Error('scier '+JSON.stringify(r)+' après '+n);
function ROUT_FAIL(r){return !(r.coupes===1&&r.tas>=6&&r.scie==='mur'&&!r.carry);}
for(let i=0;i<60000&&run(`atelier.arbre.t`)<1;i++)run(`ticks++;stepAtelier(ticks/120)`);
if(run(`atelier.arbre.t`)<1)throw new Error('arbre ne repousse pas');
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
console.log('atelier ok');
