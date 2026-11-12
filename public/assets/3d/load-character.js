export async function loadCharacterModel(modelUrl='/assets/3d/popo_stickman_helmet.glb', partCount=57){
  const chunks=await Promise.all(Array.from({length:partCount},(_,i)=>fetch(modelUrl+'/part-'+String(i).padStart(3,'0')+'.bin').then(r=>{if(!r.ok)throw new Error('Partie du modèle manquante: '+i);return r.arrayBuffer()})));
  const total=chunks.reduce((n,c)=>n+c.byteLength,0), joined=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){joined.set(new Uint8Array(chunk),offset);offset+=chunk.byteLength}
  return joined.buffer;
}
export function applyCharacterVariant(root,variant){
  root.scale.setScalar(variant.scale);
  root.traverse(node=>{if(!node.isMesh)return;const materials=Array.isArray(node.material)?node.material:[node.material];
    for(const material of materials){if(!material||!material.color)continue;const name=(material.name||'').toLowerCase();
      if(name==='head')material.color.set(variant.skin);
      else if(name.includes('material.004'))material.color.set(variant.suit);
      else if(name.includes('material.003'))material.color.set(variant.accent);
      material.needsUpdate=true;
    }
  });
  return root;
}

export async function loadHouseModel(modelUrl='/assets/3d/big_housse.glb.gz',partCount=106){
  if(typeof DecompressionStream==='undefined')throw new Error('Ce navigateur ne prend pas en charge la décompression gzip.');
  const chunks=await Promise.all(Array.from({length:partCount},(_,i)=>fetch(modelUrl+'/part-'+String(i).padStart(3,'0')+'.bin').then(r=>{if(!r.ok)throw new Error('Partie de la maison manquante: '+i);return r.arrayBuffer()})));
  const total=chunks.reduce((n,c)=>n+c.byteLength,0),joined=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){joined.set(new Uint8Array(chunk),offset);offset+=chunk.byteLength}
  const stream=new Blob([joined]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
