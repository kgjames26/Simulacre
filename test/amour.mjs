import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});`);
const el=(a,b)=>run(`isCourtshipEligible('${a}','${b}',8)`);
if(el('alex','juliette')||el('alex','timeo')||el('timeo','nathan'))throw new Error('famille ou même sexe');
if(!el('alex','rose')||!el('timeo','francoise'))throw new Error('éligibilité');
if(el('alex','rose')&&run(`isCourtshipEligible('alex','rose',6)`))throw new Error('âge');
// Une seule amoureuse à la fois.
run(`relationship('alex','rose').couple=true;`);
if(el('alex','francoise')||el('timeo','rose'))throw new Error('exclusivité');
if(!el('alex','rose'))throw new Error('partenaire');
// Les actes ont des effets individuels et des statistiques.
run(`relationships={};globalThis.__r=relationship('alex','rose');alex.pleasure=0;alex.confiance=.3;__r.romance=60;acteAmoureux(__r,'un baiser',1);`);
if(!(run(`__r.attirance`)>=6)||!(run(`alex.pleasure`)>.15)||!(run(`alex.confiance`)>.3))throw new Error('effets');
// Séparation possible, jamais pour les parents.
run(`__r.couple=true;__r.tendresse=5;__r.complicite=50;relationshipCooldown['alex:rose']=0;relationshipEvent('alex','rose','x',10,8);`);
if(run(`__r.couple`)||run(`__r.separations`)!==1)throw new Error('séparation');
run(`const jm=relationship('joseph','marie');jm.tendresse=0;relationshipCooldown['joseph:marie']=0;relationshipEvent('joseph','marie','x',10,8);`);
if(!run(`relationship('joseph','marie').couple`))throw new Error('parents');
console.log('amour ok');
