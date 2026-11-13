// Le sommeil trie la mémoire : renforce, efface, fusionne, et fait rêver de choses à explorer.
import {boot} from './harness.mjs';
const {run}=boot();
run(`onmessage({data:{type:'house',geometry:__house}});onmessage({data:{type:'restore',state:null}});`);
run(`for(const r of records)r.mastered=true;skill=4;records[4].champions=[{valid:true,policy:Array(64).fill(.5),start:null}];`);
run(`for(let i=0;i<120*900;i++){ticks++;experience();}`);
// deux souvenirs identiques à fusionner + un lien faible à effacer
run(`const e=Brain.state.memoire.episodes;e.push({...e.at(-1)||{cible:'x',geste:'pousser',succes:false,effet:[]},t:ticks/120});e.push({...e.at(-1),t:ticks/120});Brain.state.associations.liens['a|b']={n:.5};`);
const avant=run(`Brain.state.memoire.episodes.length`);
const n=JSON.parse(run(`JSON.stringify(Brain.sommeil(ticks/120))`));
console.log(JSON.stringify(n));
const ok=n.fusionnes>=1&&n.effaces>=1&&!run(`'a|b' in Brain.state.associations.liens`)&&n.reves.length>=1&&run(`Brain.state.memoire.episodes.length`)<avant&&
  run(`Object.keys(Brain.state.sommeil.reves).length`)>=1&&JSON.stringify(run('Brain.save()')).indexOf('canapé')<0;
console.log(ok?'OK sommeil':'ECHEC sommeil');process.exit(ok?0:1);
