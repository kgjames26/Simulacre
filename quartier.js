// Le quartier autour de la maison de Néo : routes, voisins, commerce de proximité, grand quartier résidentiel.
// Données pures partagées par la simulation (collisions) et la scène 3D. Unités : mètres. Une tuile de route = 7 m.
// Les kits Kenney (CC0) fournissent les modèles : routes, maisons de banlieue, mini-commerce.
const QUARTIER=(()=>{
  const T=7;                       // taille d'une tuile de route
  const ROUTE_Z=21,COTE_X=49;      // rue principale (est-ouest) et rue transversale (nord-sud)
  const region={x0:-45,x1:90,z0:-30.2,z1:52.1};   // zone où la simulation calcule les déplacements
  const monde={x0:-77,x1:147,z0:-49,z1:84};       // zone dessinée
  // --- réseau routier : cases (i,j) autour de (COTE_X, ROUTE_Z) ---
  const cases=new Set();
  const add=(i,j)=>cases.add(i+','+j);
  for(let i=-17;i<=13;i++){add(i,0);add(i,4);}          // rue principale et rue du sud
  for(let j=-8;j<=8;j++)add(0,j);                        // rue transversale
  for(let j=0;j<=8;j++){add(-9,j);add(5,j);}             // deux rues du grand quartier
  const centre=(i,j)=>({x:COTE_X+i*T,z:ROUTE_Z+j*T});
  const a=c=>cases.has(c);
  // Connexions par défaut des modèles (x+, x-, z+, z-) et rotation y qui amène chaque connexion à sa place.
  const DEFAUT={'road-straight':['x+','x-'],'road-bend':['x-','z+'],'road-end':['x+'],'road-intersection':['x+','x-','z+'],'road-crossroad':['x+','x-','z+','z-']};
  const vec={'x+':[1,0],'x-':[-1,0],'z+':[0,1],'z-':[0,-1]};
  const nom=v=>Object.entries(vec).find(([,w])=>Math.round(w[0])===Math.round(v[0])&&Math.round(w[1])===Math.round(v[1]))[0];
  function tourner(conn,theta){return conn.map(k=>{const [dx,dz]=vec[k];return nom([dx*Math.cos(theta)+dz*Math.sin(theta),-dx*Math.sin(theta)+dz*Math.cos(theta)]);});}
  function choisirTuile(conn){
    const n=conn.length;
    const modele=n===4?'road-crossroad':n===3?'road-intersection':n===1?'road-end':(n===2&&conn[0][0]===conn[1][0])?'road-straight':n===2?'road-bend':'road-straight';
    for(let k=0;k<4;k++){
      const th=k*Math.PI/2,r=tourner(DEFAUT[modele],th);
      if(r.length===conn.length&&conn.every(c=>r.includes(c)))return {modele,rot:th};
    }
    return {modele:'road-straight',rot:0};
  }
  const tuiles=[];
  for(const c of cases){
    const [i,j]=c.split(',').map(Number),p=centre(i,j);
    const conn=[];
    if(a((i+1)+','+j))conn.push('x+');if(a((i-1)+','+j))conn.push('x-');
    if(a(i+','+(j+1)))conn.push('z+');if(a(i+','+(j-1)))conn.push('z-');
    const {modele,rot}=choisirTuile(conn.length?conn:['x+','x-']);
    tuiles.push({modele,x:p.x,z:p.z,rot,i,j});
  }
  // --- maisons ---
  const HX=4.55+.6,HZ=3.6+.6;       // demi-empreinte (9,1 × 7,2 m) + marge
  const maisons=[];
  const maison=(modele,x,z,rot,proprio)=>{
    const tourne=Math.abs(Math.sin(rot))>.5;
    const hx=tourne?HZ:HX,hz=tourne?HX:HZ;
    if(tuiles.some(t=>x+hx>t.x-T/2-1&&x-hx<t.x+T/2+1&&z+hz>t.z-T/2-1&&z-hz<t.z+T/2+1))return;
    maisons.push({modele:'building-type-'+modele,x,z,rot,proprio,rect:{x0:x-hx,x1:x+hx,z0:z-hz,z1:z+hz}});
  };
  const FACE=0;                      // si les maisons Kenney regardent à l'inverse, passer à Math.PI
  // Les modèles Kenney regardent +z par défaut : face au sud (+z) = FACE ; face au nord (-z) = FACE + PI
  maison('c',29,2,FACE,'les voisins');           // les petits voisins, juste à côté (à l'est)
  maison('f',-29,2,FACE,'voisins de l’ouest');
  for(const [lettre,x] of [['a',-60],['d',-48]])maison(lettre,x,6,FACE,'quartier');
  for(const [lettre,x] of [['g',77],['h',88],['i',99],['j',110],['k',121],['l',132]])maison(lettre,x,6,FACE,'quartier');
  // Sud de la rue principale (face au nord)
  const sud=['m','n','o','p','q','r','s','t','u','a','b','c','d','e','f','g'];
  [-63,-49,-35,-21,-7,7,21,35].forEach((x,k)=>maison(sud[k],x,31.5,FACE+Math.PI,'quartier'));
  [63,77,91,105,119,133].forEach((x,k)=>maison(sud[(k+8)%16],x,31.5,FACE+Math.PI,'quartier'));
  // Entre les deux rues du sud : deux rangées dos à dos
  [-63,-49,-35,-21,35,63,77,91,105,119,133].forEach((x,k)=>maison(sud[(k+3)%16],x,40,FACE,'quartier'));
  [-63,-49,-35,-21,-7,7,21,35,63,77,91,105,119,133].forEach((x,k)=>maison(sud[(k+5)%16],x,58,FACE+Math.PI,'quartier'));
  // --- arbres décoratifs et lampadaires ---
  const arbres=[];
  const rngq=(()=>{let s=1234567;return()=>(s=(s*16807)%2147483647)/2147483647;})();
  for(let k=0;k<70;k++){
    const x=monde.x0+rngq()*(monde.x1-monde.x0),z=monde.z0+rngq()*(21-3.5-monde.z0-4);
    if(x>-24&&x<24&&z>-18)continue;                 // pas dans la propriété de Néo
    if(Math.abs(x-COTE_X)<5)continue;
    if(maisons.some(m=>x>m.rect.x0-2&&x<m.rect.x1+2&&z>m.rect.z0-2&&z<m.rect.z1+2))continue;
    arbres.push({modele:rngq()<.35?'tree-small':'tree-large',x,z,echelle:5+rngq()*2});
  }
  const lampadaires=[];
  for(let x=-63;x<=140;x+=14)lampadaires.push({x,z:ROUTE_Z-T/2-.3,rot:0},{x:x+7,z:ROUTE_Z+T/2+.3,rot:Math.PI});
  const panneaux=[{modele:'road-sign-stop',x:COTE_X-T/2-.4,z:ROUTE_Z-T/2-.4,rot:0},{modele:'road-sign-stop',x:COTE_X+T/2+.4,z:ROUTE_Z+T/2+.4,rot:Math.PI}];
  // --- commerce de proximité (mini-commerce Kenney, échelle 3) ---
  const commerce={x0:54,x1:70,z0:3,z1:16,porte:{x:62,z:15.9},comptoir:{x:66.8,z:12.6},
    interieur:{x0:55.8,x1:69.2,z0:4.6,z1:14.6},
    // zones de collision à l'intérieur : comptoir, rayons, congélateurs
    obstacles:[{x0:65.6,x1:68,z0:11.6,z1:13.4},{x0:57,x1:60.5,z0:7.2,z1:8.6},{x0:63,x1:66.5,z0:7.2,z1:8.6},{x0:56,x1:69,z0:4.6,z1:5.6}],
    rayons:[{x:58.7,z:9.6},{x:64.7,z:9.6}]};
  // --- propriétés privées : fermées à Néo ---
  const privees=[...maisons.map(m=>({...m.rect,nom:m.proprio})),
    {x0:19.4,x1:44,z0:-14,z1:14.4,nom:'jardin des voisins'},{x0:-44,x1:-19.4,z0:-14,z1:14.4,nom:'jardin des voisins de l’ouest'}];
  // --- zones praticables par tout le monde (hors de la propriété de Néo) ---
  const trottoir={x0:region.x0,x1:region.x1,z0:14.5,z1:ROUTE_Z-T/2};
  const portail={x0:-5,x1:-3,z0:11.5,z1:14.6};          // portail de la propriété de Néo (sur la rue)
  // La propriété de Néo s'arrête à x=4.3 ; à l'est, l'aire de jeux publique des petits voisins, ouverte sur la rue.
  const propriete={x0:-19,x1:4.3,z0:-12,z1:12};
  const parc={x0:4.3,x1:19,z0:-12,z1:12};
  const entreeParc={x0:8,x1:12,z0:11.5,z1:14.6};
  const barriere={x0:4.15,x1:4.45,z0:-12,z1:12,porte:{z0:3,z1:5}};   // clôture entre jardin et parc, avec une petite porte
  const rects=[];                                          // rectangles praticables
  for(const t of tuiles)rects.push({x0:t.x-T/2,x1:t.x+T/2,z0:t.z-T/2,z1:t.z+T/2});
  rects.push(trottoir,portail,entreeParc);
  const praticable=(x,z)=>{
    for(const r of rects)if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1)return true;
    const c=commerce,i=c.interieur;
    if(x>=i.x0&&x<=i.x1&&z>=i.z0&&z<=i.z1)return !c.obstacles.some(o=>x>=o.x0&&x<=o.x1&&z>=o.z0&&z<=o.z1);
    if(x>=c.porte.x-1.4&&x<=c.porte.x+1.4&&z>=i.z1&&z<=ROUTE_Z-T/2)return true;
    return false;
  };
  const c=commerce;
  const libres=[...rects,c.interieur,{x0:c.porte.x-1.4,x1:c.porte.x+1.4,z0:c.interieur.z1,z1:ROUTE_Z-T/2}];
  return {T,ROUTE_Z,COTE_X,region,monde,tuiles,maisons,arbres,lampadaires,panneaux,commerce,privees,praticable,portail,trottoir,libres,bloques:c.obstacles,propriete,parc,entreeParc,barriere};
})();
