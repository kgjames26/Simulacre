import {spawnSync} from 'node:child_process';
const tests=['ignorance','determinisme','stades','cortex','partage','courrier'];
let failed=0;
for(const name of tests){
  const result=spawnSync(process.execPath,['test/'+name+'.mjs'],{encoding:'utf8'});
  const ok=result.status===0;
  console.log((ok?'✔ ':'✘ ')+name);
  if(!ok){failed++;console.log(result.stdout+result.stderr);}
}
process.exit(failed?1:0);
