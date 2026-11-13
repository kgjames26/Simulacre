// Néo, marche acquise, vit une heure de simulation : il doit explorer, essayer, comprendre et grandir d'au moins un stade.
import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});`);
run(`for(const r of records)r.mastered=true;skill=4;records[4].champions=[{valid:true,policy:Array(64).fill(.5),start:null}];`);
run(`for(let i=0;i<120*3600;i++){ticks++;experience();}`);
const r=JSON.parse(run(`JSON.stringify({age,lieux:Object.keys(Brain.state.espace.cases).length,essais:Brain.state.memoire.total,causes:Brain.confirmees().length,mots:dialogue.view().vocabulary.length,gestes:Brain.APPRENABLES.filter(Brain.appris).length,limites:Object.keys(Brain.state.espace.interdits).length,etape:stageGoals})`));
console.log(JSON.stringify(r));
const ok=r.age>=1&&r.essais>=30&&r.lieux>=40;
console.log(ok?'OK stades':'ECHEC stades');
process.exit(ok?0:1);
