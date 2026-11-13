// Modèles 3D de l'atelier : arbre, tas de bois, mur d'outils, fleurs. Tout est construit ici à partir de formes simples.
const BOIS='#8a6a48',BOIS_CLAIR='#c79a62',ACIER='#aab2ba',NOIR='#2b2f33',ROUGE='#b8452f',VERT='#3f8a4a',BLEU='#3d6fa8',JAUNE='#e0b93a';
export function creerAtelier(T,scene,mat,pos){
  const M=c=>mat(c);
  const mesh=(geo,color,x=0,y=0,z=0,parent)=>{const m=new T.Mesh(geo,M(color));m.position.set(x,y,z);(parent||scene).add(m);return m;};
  const cyl=(r1,r2,h,seg=10)=>new T.CylinderGeometry(r1,r2,h,seg);
  const box=(w,h,d)=>new T.BoxGeometry(w,h,d);

  // --- Outils (axe long le long de y, face vers +x : ils s'accrochent au mur) ---
  const modeles={
    sac(){const g=new T.Group();mesh(box(.28,.34,.16),'#c9a46a',0,.17,0,g);mesh(cyl(.03,.03,.14,6),'#4a8a3a',-.07,.4,0,g);mesh(cyl(.03,.03,.12,6),'#d9792b',.06,.39,0,g);return g;},
    hache(){const g=new T.Group();mesh(cyl(.016,.016,.55),BOIS,0,0,0,g);const tete=mesh(box(.05,.14,.1),ACIER,0,.24,.04,g);mesh(box(.04,.06,.03),NOIR,0,.3,-.02,g);return g;},
    scie(){const g=new T.Group();mesh(box(.03,.035,.42),ACIER,0,0,0,g);mesh(box(.04,.07,.11),BOIS,0,.02,.26,g);for(let i=0;i<14;i++)mesh(box(.012,.012,.012),ACIER,0,-.022,-.19+i*.028,g);return g;},
    marteau(){const g=new T.Group();mesh(cyl(.014,.014,.3),BOIS,0,0,0,g);mesh(box(.05,.05,.12),NOIR,0,.16,0,g);return g;},
    clous(){const g=new T.Group();mesh(box(.08,.05,.11),BOIS_CLAIR,0,0,0,g);for(let i=0;i<5;i++)mesh(cyl(.004,.004,.07,5),ACIER,(i-2)*.012,.05,0,g);return g;},
    colle(){const g=new T.Group();mesh(cyl(.035,.04,.16),JAUNE,0,0,0,g);mesh(cyl(.01,.03,.05),'#f4f0e0',0,.1,0,g);return g;},
    vis(){const g=new T.Group();mesh(box(.08,.05,.11),'#6a7077',0,0,0,g);for(let i=0;i<5;i++)mesh(cyl(.004,.004,.06,5),ACIER,(i-2)*.012,.05,0,g);return g;},
    tournevis(){const g=new T.Group();mesh(cyl(.02,.02,.1),ROUGE,0,.05,0,g);mesh(cyl(.005,.005,.14),ACIER,0,-.07,0,g);return g;},
    arrosoir(){const g=new T.Group();mesh(cyl(.09,.11,.2,14),VERT,0,.1,0,g);const bec=mesh(cyl(.012,.02,.26),VERT,.14,.2,0,g);bec.rotation.z=-.9;mesh(new T.TorusGeometry(.07,.01,6,14,Math.PI),VERT,-.09,.2,0,g).rotation.z=Math.PI/2;return g;},
    tuyau(){const g=new T.Group();for(let i=0;i<4;i++)mesh(new T.TorusGeometry(.14,.017,7,20),'#2f8d5b',0,i*.036,0,g).rotation.x=Math.PI/2;mesh(cyl(.015,.015,.07),'#caa24a',.17,.02,0,g);return g;}
  };
  const bois=new T.Group();scene.add(bois);
  const murObj=[];
  // planche murale
  mesh(box(.05,.5,2.9),'#6e5236',pos.murX+.03,1.3,-1.75);
  mesh(box(.07,.04,2.9),'#6e5236',pos.murX+.05,1.04,-1.75);
  // robinet
  const robinet=new T.Group();mesh(cyl(.018,.018,.12),'#caa24a',0,0,0,robinet).rotation.z=Math.PI/2;mesh(cyl(.012,.012,.07),'#caa24a',.07,-.04,0,robinet);robinet.position.set(pos.murX+.07,.55,-.3);scene.add(robinet);
  const outils={};
  for(const [id,build] of Object.entries(modeles)){outils[id]={mur:build(),porte:build()};scene.add(outils[id].mur);}
  const orientationMur={hache:[0,0,0],scie:[0,0,Math.PI/2],marteau:[0,0,0],clous:[0,0,0],colle:[0,0,0],vis:[0,0,0],tournevis:[0,0,Math.PI/2],arrosoir:[0,0,0],tuyau:[Math.PI/2,0,0]};
  // --- Arbre ---
  const arbre=new T.Group();arbre.position.set(pos.arbre.x,0,pos.arbre.z);scene.add(arbre);
  const tronc=mesh(cyl(.17,.26,2.4,9),'#7a5636',0,1.2,0,arbre);
  const feuillage=new T.Group();feuillage.position.y=2.4;arbre.add(feuillage);
  for(const [x,y,z,r,c] of [[0,.7,0,1.25,'#4c8a4a'],[.7,.2,.3,.9,'#5a9a52'],[-.6,.3,-.4,.95,'#437d44'],[.1,1.3,.1,.8,'#5fa056']]){
    const b=mesh(new T.IcosahedronGeometry(r,1),c,x,y,z,feuillage);}
  const souche=mesh(cyl(.22,.28,.28,9),'#8c6a45',pos.arbre.x,.14,pos.arbre.z);
  const morceaux=[];for(let i=0;i<6;i++){const l=mesh(cyl(.07,.07,.4,8),BOIS_CLAIR,pos.arbre.x+.5+(i%3)*.22,.07,pos.arbre.z+.35+Math.floor(i/3)*.2);l.rotation.z=Math.PI/2;l.rotation.y=i*.4;morceaux.push(l);}
  // --- Tas de bois contre le mur ---
  const tas=[];for(let i=0;i<24;i++){const l=mesh(cyl(.075,.075,.5,8),BOIS_CLAIR,pos.tas.x+.1,.1+Math.floor(i/8)*.15,pos.tas.z-.55+(i%8)*.155);l.rotation.x=Math.PI/2;l.rotation.z=0;l.rotation.y=0;l.visible=false;tas.push(l);}
  // --- Planches (sciées par Joseph) empilées contre le mur ---
  const planches=[];for(let i=0;i<16;i++){const p=mesh(box(.9,.03,.16),'#d8b27a',pos.tas.x+.2,.03+Math.floor(i/4)*.035,pos.planches.z-.3+(i%4)*.2);p.rotation.y=Math.PI/2;p.visible=false;planches.push(p);}
  // --- Pommes tombées ---
  const pommes=[];for(let i=0;i<5;i++){const g=new T.Group();mesh(new T.SphereGeometry(.05,10,8),'#c9372c',0,.05,0,g);mesh(cyl(.004,.004,.03,4),'#5a3a22',0,.105,0,g);g.visible=false;scene.add(g);pommes.push(g);}
  // --- Fleurs ---
  const couleurs=['#e0556b','#f0b43a','#8f6ad6','#f5f0ea'];
  const fleurs=pos.fleurs.map(([x,z],i)=>{
    const g=new T.Group();g.position.set(x,0,z);scene.add(g);
    mesh(cyl(.13,.1,.18,12),'#a85a3c',0,.09,0,g);mesh(cyl(.12,.12,.02,12),'#4a3426',0,.18,0,g);
    const tiges=new T.Group();g.add(tiges);
    for(let k=0;k<3;k++){const a=k*2.1,tx=Math.cos(a)*.05,tz=Math.sin(a)*.05;
      mesh(cyl(.006,.006,.34,5),'#3c7a3c',tx,.36,tz,tiges);
      const fl=new T.Group();fl.position.set(tx,.55,tz);tiges.add(fl);
      mesh(new T.SphereGeometry(.03,8,6),'#e8c040',0,0,0,fl);
      for(let p=0;p<6;p++){const pe=mesh(new T.SphereGeometry(.035,7,5),couleurs[i],Math.cos(p*1.047)*.05,0,Math.sin(p*1.047)*.05,fl);pe.scale.y=.5;}
    }
    return {g,tiges};
  });
  const logPorte=()=>{const l=new T.Mesh(cyl(.07,.07,.4,8),M(BOIS_CLAIR));l.rotation.z=Math.PI/2;return l;};
  const echelleRig=1/1.85;
  const cachePorte=new WeakMap();
  return {
    update(a){
      if(!a)return;
      const t=a.arbre.t;
      arbre.visible=t>.14;arbre.scale.setScalar(.25+.75*t);arbre.rotation.z=-(a.arbre.chute||0)*1.45;
      souche.visible=t<.6;
      morceaux.forEach((m,i)=>{m.visible=i<a.arbre.morceaux;});
      tas.forEach((m,i)=>{m.visible=i<a.bois.tas;});
      planches.forEach((m,i)=>{m.visible=i<a.bois.planches;});
      pommes.forEach((g,i)=>{const m=a.pommes[i];g.visible=!!m;if(m)g.position.set(m.x,0,m.z);});
      for(const o of a.outils){
        const m=outils[o.id];if(!m)continue;
        const sur=o.etat==='mur',sol=o.etat==='sol';
        m.mur.visible=sur||sol;
        if(sur){m.mur.position.set(pos.murX+.1,1.25,o.z);m.mur.rotation.set(...orientationMur[o.id]);}
        if(sol){m.mur.position.set(o.x,0,o.z);m.mur.rotation.set(0,0,0);}
      }
      fleurs.forEach(({tiges},i)=>{const soif=a.fleurs[i].soif;tiges.scale.y=soif>.7?.78:1;tiges.rotation.z=soif>.7?.25:0;});
    },
    porteur(actor,carry){
      const rig=actor.rig;const poignet=rig.sides[1].wrist;
      let reg=cachePorte.get(actor);
      if(!reg){reg={groupe:new T.Group(),courant:null,items:{}};reg.groupe.position.set(.03,-.02,.02);poignet.add(reg.groupe);cachePorte.set(actor,reg);}
      if(reg.courant===carry)return;
      for(const it of Object.values(reg.items))it.visible=false;
      if(carry){
        if(!reg.items[carry]){
          const it=carry==='bûche'?logPorte():modeles[carry]();
          it.scale.setScalar(echelleRig);reg.groupe.add(it);reg.items[carry]=it;
        }
        reg.items[carry].visible=true;
      }
      reg.courant=carry;
    }
  };
}
