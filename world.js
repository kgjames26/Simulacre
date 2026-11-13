// Côté monde : tout ce que la physique et la simulation savent des objets.
// Le cerveau (brain.js) n'y a jamais accès. Il ne reçoit que :
//  - percevoir() : des objets anonymes avec des traits mesurables, vus avec occlusion
//  - respond()   : des sensations observées après un geste, jamais une explication
// Les noms ci-dessous servent à l'observateur humain (interface) et aux personnages scriptés.
const observerNames={};
function opaque(key){
  let h=5381;
  const text='simulacre:'+key;
  for(let i=0;i<text.length;i++)h=((h<<5)+h+text.charCodeAt(i))>>>0;
  const id='o'+h.toString(36).slice(-4).padStart(4,'0');
  observerNames[id]=observerNames[id]&&observerNames[id]!==key?observerNames[id]+' / '+key:key;
  return id;
}
const observerLabel=id=>(observerNames[id]||'').replace(/^(lieu|objet|cuisine|porte|jeu|equip|personne|sujet):/,'');

// Mots-sujets des parents -> entité du monde qu'ils désignent (ou sujet sans entité).
const TOPIC_ENTITY={
  tapis:'lieu:tapis',canape:'objet:sofa',livre:'objet:book',porte:'porte:breezeway',baie:'lieu:baie',
  frigo:'cuisine:fridge',repas:'cuisine:serve',four:'cuisine:oven',eau:'objet:water',douche:'objet:shower',
  tele:'objet:tv',feu:'objet:fireplace',table:'cuisine:table',jardin:'lieu:jardin',trampoline:'equip:trampoline',
  couloir:'lieu:couloir'
};
const topicKey=topic=>TOPIC_ENTITY[topic]||'sujet:'+topic;
const topicCue=topic=>'thing:'+opaque(topicKey(topic));

// Repères de la villa et du parc (lieux sans effet). Les lettres du tapis forment le prénom NÉO.
const landmarks=[
  ['tapis',-8,2],['baie',-1,1],['table du salon',-5,-3],['cuisine',-2,-4],
  ['salon',-8,-2],['couloir',-7,0],['lettre N',-8,3],['lettre É',-5,1],['lettre O',-3,2],
  ['jardin',3,4],['chemin',5,3],['parc',8,5],['gravier',11,5],
  ['bordure',14,5],['bois',12,4]
];
// Traits : [hauteur, masse, mou, lumineux, vivant, écrit]
const landmarkTraits=name=>name.startsWith('lettre')?[0,0,0,0,0,1]:[0,0,0,0,0,0];

// Ce que fait chaque équipement quand on lui applique le bon geste. Jamais lu par le cerveau.
const HOUSE_EFFECTS={
  sofa:{name:'canapé',prim:'monter',flags:['mou','soi_monte'],activity:'Se repose sur le canapé',duration:8,
    traits:[.5,.9,1,0,0,0],besoin:o=>({fatigue:Math.min(.44,Math.max(0,o.fatigue-.05))}),plaisir:.1},
  tv:{name:'télévision',prim:'pousser',flags:['lumiere','bruit'],activity:'Regarde la télévision',duration:7,
    traits:[.6,.5,0,.8,0,0],plaisir:.1},
  book:{name:'livre',prim:'saisir',flags:['objet_bouge','papier'],activity:'Feuillette le livre',duration:8,
    traits:[.05,.05,0,0,0,0],plaisir:.05},
  water:{name:'fontaine à eau',prim:'pousser',flags:['eau'],activity:'Boit à la fontaine',duration:4,
    traits:[.9,.8,0,0,0,0],besoin:o=>({soif:Math.max(0,(o.thirst??.15)-.06)})},
  shower:{name:'douche',prim:'tourner',flags:['eau','chaud'],activity:'Prend une douche',duration:9,
    traits:[1.9,.9,0,0,0,0],besoin:o=>({hygiene:Math.max(0,1-(o.hygiene??.9))})},
  dishwasher:{name:'lave-vaisselle',prim:'tirer',flags:['objet_bouge','bruit'],activity:'Fait tourner le lave-vaisselle',duration:7,
    traits:[.85,.9,0,0,0,0]},
  fireplace:{name:'cheminée',prim:'pousser',flags:['lumiere','chaud'],activity:'Observe la cheminée allumée',duration:6,
    traits:[.9,.9,0,.7,0,0],plaisir:.08}
};
const KITCHEN_ENTITIES={
  fridge:{name:'frigo',traits:[1.7,.9,0,0,0,0],prim:'tirer',flags:['objet_bouge','froid']},
  oven:{name:'four',traits:[.9,.9,0,0,0,0],prim:'tirer',flags:['objet_bouge','chaud']},
  serve:{name:'comptoir',traits:[.9,.8,0,0,0,0]},
  table:{name:'table à manger',traits:[.75,.6,0,0,0,0],prim:'saisir'}
};
const PERSON_TRAITS=[1,.6,.3,0,1,0];
const doorPrimitive=door=>door.mechanism==='coulissante'?'tirer':'pousser';
const doorTraits=door=>door.mechanism==='coulissante'?[2,.4,0,.1,0,0]:[2,.4,0,0,0,0];

let entityCache=null,entitySignature='';
function entities(){
  const signature=(house?'h':'-')+(park?'p':'-');
  if(entityCache&&signature===entitySignature)return entityCache;
  const list=[];
  const add=(key,kind,name,x,z,traits,extra={})=>{const id=opaque(key);observerNames[id]=kind+':'+name;list.push({key,id,kind,name,x,z,floor:0,traits,...extra});};
  for(const [name,x,z] of landmarks)add('lieu:'+name,'lieu',name,x,z,landmarkTraits(name));
  if(house){
    for(const [id,point] of Object.entries(house.objects))
      add('objet:'+id,'objet',HOUSE_EFFECTS[id].name,point.x,point.z,HOUSE_EFFECTS[id].traits,{houseId:id});
    for(const [id,spec] of Object.entries(KITCHEN_ENTITIES)){
      const station=house.kitchen[id];
      if(station)add('cuisine:'+id,'objet',spec.name,station.x,station.z,spec.traits,{kitchenId:id});
    }
    for(const door of house.doors.filter(item=>!item.floor))
      add('porte:'+door.id,'porte',door.name,door.x,door.z,doorTraits(door),{door});
    add('equip:trampoline','equipement','trampoline',house.trampoline.entryX,house.trampoline.entryZ,[.3,.5,.6,0,0,0],{equipId:'trampoline'});
  }
  if(park){
    const labels={slide:'toboggan',rope:'corde',swing:'balançoire',bars:'barres de grimpe',wall:'mur d’escalade'};
    const shapes={slide:[1.5,.9,0,0,0,0],rope:[2.5,.1,0,0,0,0],swing:[2,.4,0,0,0,0],bars:[2,.9,0,0,0,0],wall:[2.2,1,0,0,0,0]};
    for(const [id,label] of Object.entries(labels)){
      const spot=park.approaches?.[id];
      if(spot)add('equip:'+id,'equipement',label,spot.x,spot.z,shapes[id],{equipId:id});
    }
  }
  for(const person of people)add('personne:'+person.id,'personne',characterNames[person.id],0,0,PERSON_TRAITS,{dynamic:person});
  for(const id of Object.keys(playItems))
    add('jeu:'+id,'jeu',playNames[id],0,0,id==='toy'?[.3,.4,0,0,0,0]:id.startsWith('bike')?[.4,.5,0,0,0,0]:[.1,.2,.5,0,0,0],{dynamic:playItems[id],playId:id});
  entityCache=list;entitySignature=signature;
  return list;
}
const entityById=id=>entities().find(entity=>entity.id===id);

// Seule porte d'entrée de Néo vers le monde : ce que ses sens captent depuis sa position.
function percevoir(observer,range){
  const out=[];
  for(const entity of entities()){
    const source=entity.dynamic||entity;
    if((source.floor||0)!==(observer.floor||0))continue;
    if(entity.kind==='personne'&&source.lie>.8)continue;
    const distance=Math.hypot(source.x-observer.x,source.z-observer.z);
    if(distance>range)continue;
    if(distance>.3&&!languageVisibility(observer,source))continue;
    out.push({id:entity.id,x:source.x,z:source.z,dist:distance,traits:entity.traits,vivant:entity.kind==='personne'});
  }
  return out;
}

// Réaction physique du monde à un geste de Néo sur une entité. Renvoie uniquement des sensations.
function respond(entity,prim,s){
  const none={flags:[]};
  if(entity.houseId){
    const effect=HOUSE_EFFECTS[entity.houseId];
    if(prim!==effect.prim)return hit(entity,prim);
    return {flags:effect.flags,contact:{id:entity.houseId,until:s+effect.duration},
      besoins:effect.besoin?.(alex)??{},plaisir:effect.plaisir||0};
  }
  if(entity.kitchenId){
    const spec=KITCHEN_ENTITIES[entity.kitchenId];
    if(prim!==spec.prim)return hit(entity,prim);
    if(entity.kitchenId==='table'){
      if(kitchen.meals>0&&alex.hunger>.25){
        const before=alex.hunger;
        takeServing(alex);
        return {flags:['nourriture','gout'],besoins:{faim:Math.max(0,before-alex.hunger)},plaisir:.2};
      }
      return none;
    }
    return {flags:spec.flags};
  }
  if(entity.playId&&entity.playId!=='football'&&entity.playId!=='softBall'){
    if(entity.playId==='toy'&&prim==='tirer'){
      playControl('toy','slide',{bead:Math.floor(rng()*12),position:rng()});
      return {flags:['objet_bouge','perles'],plaisir:.05};
    }
    if(entity.playId.startsWith('bike')&&prim==='pousser'){
      playControl(entity.playId,'pedal');
      return {flags:['objet_bouge','roues'],plaisir:.05};
    }
  }
  return hit(entity,prim);
}
// Frapper un objet lourd fait du bruit et fait mal.
function hit(entity,prim){
  if(prim==='frapper'&&entity.traits[1]>=.5&&entity.kind==='objet')return {flags:['bruit','mal'],douleur:.08};
  return {flags:[]};
}
