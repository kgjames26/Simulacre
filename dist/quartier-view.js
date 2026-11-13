// Scène 3D du quartier : routes, maisons voisines, grand quartier, commerce de proximité (kits Kenney, CC0).
const BASE='/assets/kenney/';
export async function chargerQuartier(T,GLTFLoader,scene,Q){
  const loader=new GLTFLoader();
  const cache=new Map();
  const charger=async(kit,nom)=>{
    const cle=kit+'/'+nom;
    if(!cache.has(cle))cache.set(cle,loader.loadAsync(BASE+kit+'/'+nom+'.glb').then(g=>g.scene).catch(()=>null));
    return cache.get(cle);
  };
  const poser=async(kit,nom,{x,y=-.05,z,rot=0,echelle})=>{
    const base=await charger(kit,nom);if(!base)return null;
    const objet=base.clone(true);
    objet.scale.setScalar(echelle);objet.position.set(x,y,z);objet.rotation.y=rot;
    scene.add(objet);return objet;
  };
  const m=c=>new T.MeshStandardMaterial({color:c,roughness:.95});
  const boite=(w,h,d,x,y,z,c)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m(c));o.position.set(x,y,z);scene.add(o);return o;};
  // Sol herbeux, trottoir le long des propriétés, chemin du portail
  const M=Q.monde;
  boite(M.x1-M.x0,.2,M.z1-M.z0,(M.x0+M.x1)/2,-.2,(M.z0+M.z1)/2,'#7f9a6c');
  boite(Q.trottoir.x1-Q.trottoir.x0+60,.14,Q.trottoir.z1-Q.trottoir.z0,(Q.trottoir.x0+Q.trottoir.x1)/2,-.03,(Q.trottoir.z0+Q.trottoir.z1)/2,'#bdb8ae');
  boite(Q.portail.x1-Q.portail.x0,.06,Q.portail.z1-Q.portail.z0,(Q.portail.x0+Q.portail.x1)/2,-.04,(Q.portail.z0+Q.portail.z1)/2,'#cdbb9a');
  const travaux=[];
  for(const t of Q.tuiles)travaux.push(poser('roads',t.modele,{x:t.x,z:t.z,rot:t.rot,echelle:Q.T}));
  for(const h of Q.maisons)travaux.push(poser('suburban',h.modele,{x:h.x,z:h.z,rot:h.rot,echelle:7}));
  for(const a of Q.arbres)travaux.push(poser('suburban',a.modele,{x:a.x,z:a.z,echelle:a.echelle}));
  for(const l of Q.lampadaires)travaux.push(poser('roads','light-square',{x:l.x,z:l.z,rot:l.rot,echelle:5}));
  for(const p of Q.panneaux)travaux.push(poser('roads',p.modele,{x:p.x,z:p.z,rot:p.rot,echelle:5}));
  // Haie basse et clôtures autour des jardins des voisins
  for(const j of [{x0:19.4,x1:44,z0:-14,z1:14.4},{x0:-44,x1:-19.4,z0:-14,z1:14.4}]){
    for(let x=j.x0+1;x<j.x1;x+=2)travaux.push(poser('suburban','fence-low',{x,z:j.z1,rot:0,echelle:2}));
  }
  // --- Commerce ---
  const C=Q.commerce,E=3;
  const xs=[56.5,59.5,62.5,65.5,68.5],zs=[5.5,8.5,11.5,14.5];
  for(const x of xs)for(const z of zs)travaux.push(poser('shop','floor',{x,y:.01,z,echelle:E}));
  const sudX=C.porte.x;
  for(const x of xs){
    travaux.push(poser('shop','wall',{x,z:C.z0+1,rot:Math.PI,echelle:E}));
    travaux.push(poser('shop',Math.abs(x-sudX)<.1?'wall-door-rotate':'wall-window',{x,z:C.z1,rot:0,echelle:E}));
  }
  for(const z of zs){
    travaux.push(poser('shop','wall',{x:C.x0+1,z,rot:Math.PI/2,echelle:E}));
    travaux.push(poser('shop',z===8.5?'wall-window':'wall',{x:C.x1,z,rot:-Math.PI/2,echelle:E}));
  }
  for(const [x,z,r] of [[C.x0+1,C.z0+1,0],[C.x1,C.z0+1,Math.PI/2],[C.x0+1,C.z1,-Math.PI/2],[C.x1,C.z1,Math.PI]])travaux.push(poser('shop','wall-corner',{x,z,rot:r,echelle:E}));
  for(const r of C.rayons)travaux.push(poser('shop','shelf-boxes',{x:r.x,y:.01,z:r.z,rot:0,echelle:E}));
  travaux.push(poser('shop','shelf-bags',{x:61.5,y:.01,z:5.9,rot:Math.PI,echelle:E}));
  for(const x of [57.5,60.5,63.5])travaux.push(poser('shop','freezer',{x,y:.01,z:5.4,rot:Math.PI,echelle:E}));
  travaux.push(poser('shop','display-fruit',{x:58.2,y:.01,z:13.3,rot:0,echelle:E}));
  travaux.push(poser('shop','display-bread',{x:61,y:.01,z:12.2,rot:0,echelle:E}));
  travaux.push(poser('shop','shopping-basket',{x:57,y:.01,z:14.8,echelle:E}));
  travaux.push(poser('shop','cash-register',{x:C.comptoir.x,y:.01,z:C.comptoir.z,rot:Math.PI,echelle:E}));
  // Enseigne
  const toile=document.createElement('canvas');toile.width=512;toile.height=128;
  const c=toile.getContext('2d');c.fillStyle='#2f6b4c';c.fillRect(0,0,512,128);c.fillStyle='#fff6dc';c.font='bold 64px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('COMMERCE',256,68);
  const tex=new T.CanvasTexture(toile);tex.colorSpace=T.SRGBColorSpace;
  const enseigne=new T.Mesh(new T.PlaneGeometry(4.4,1.1),new T.MeshBasicMaterial({map:tex}));
  enseigne.position.set(C.porte.x,3.1,C.z1+1.02);scene.add(enseigne);
  // Commerçant : debout derrière le comptoir, il ne parle jamais.
  const base=await charger('shop','character-employee');
  if(base){
    const employe=base.clone(true);
    const boite3=new T.Box3().setFromObject(employe),h=boite3.max.y-boite3.min.y||1;
    employe.scale.setScalar(1.75/h);
    employe.position.set(C.comptoir.x+1.5,.02,C.comptoir.z-.2);employe.rotation.y=Math.PI;
    scene.add(employe);
  }
  await Promise.all(travaux);
}
