// Pénurie, commerce de proximité, accès aux maisons, miroir des camarades. Aucun personnage n'explique rien à Néo.
// Argent = 0 : pas de prix ni de caisse. Chaque agent a un quota de prélèvement par jour fictif.
const QUOTA_JOUR=14;let STOCK_JOUR_COMMERCE=100;   // assez pour nourrir la famille si les adultes font les courses, pas plus
let commerce={jour:0,stock:STOCK_JOUR_COMMERCE,prelev:{},total:0,visites:0};
let acces={amisAccompagnes:false,visites:0,niveau:0};
// Interdits des parents : zones où Néo peut aller, élargies petit à petit avec l'âge. Jamais chez les autres.
const ZONES=[
  {nom:'la maison',rects:[{x0:-13.2,x1:-.7,z0:-3.9,z1:6.3}]},
  {nom:'le jardin',rects:[QUARTIER.propriete]},
  {nom:'l’étage',etage:true,rects:[]},
  {nom:'l’aire de jeux',rects:[QUARTIER.parc,QUARTIER.entreeParc]},
  {nom:'le chemin du commerce',rects:[{x0:-6,x1:71,z0:11.4,z1:QUARTIER.ROUTE_Z+QUARTIER.T/2},QUARTIER.commerce.interieur,
    {x0:QUARTIER.commerce.porte.x-1.5,x1:QUARTIER.commerce.porte.x+1.5,z0:QUARTIER.commerce.interieur.z1-.2,z1:QUARTIER.trottoir.z1}]},
  {nom:'tout le quartier',rects:[QUARTIER.region]}
];
const AGE_ZONE=[0,0,1,2,3,4,5,5,5];
const niveauAcces=()=>AGE_ZONE[age]??5;
const dans=(r,x,z)=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1;
const FAMILLE_NEO=new Set(['joseph','marie','juliette']);
// Les mêmes règles pour tout le monde : chacun part de sa maison, son périmètre grandit avec son étape de vie.
function etapeDe(p){
  if(p===alex)return age;
  if(Number.isFinite(p.etape))return p.etape;
  if(p.id==='juliette')return Math.min(8,age+2);
  if(p.id==='joseph'||p.id==='marie')return 7;
  return age;                                   // les quatre enfants du début ont l'âge de Néo
}
const niveauDe=p=>p===alex?niveauAcces():AGE_ZONE[Math.max(0,etapeDe(p))]??5;
function zonesFoyer(f){
  if(f.zones)return f.zones;
  const J=f.jardin,P=f.parc.lot,m=3.6;
  const autour={x0:Math.min(J.x0,P.x0)-m,x1:Math.max(J.x1,P.x1)+m,z0:Math.min(J.z0,P.z0)-m,z1:Math.max(J.z1,P.z1)+m};
  const entree=f.parc.origine?[QUARTIER.entreeParc]:f.parc.chemin?[f.parc.chemin]:[];
  const rues=[...QUARTIER.tuiles.map(t=>({x0:t.x-QUARTIER.T/2,x1:t.x+QUARTIER.T/2,z0:t.z-QUARTIER.T/2,z1:t.z+QUARTIER.T/2})),QUARTIER.trottoir];
  return f.zones=[
    {nom:'sa maison',dedans:true,rects:[]},
    {nom:'son jardin',rects:[J]},
    {nom:'son jardin',rects:[J]},
    {nom:'son aire de jeux',rects:[J,P,autour,...entree]},
    {nom:'le chemin du commerce',rects:[J,P,autour,...entree,...rues,...ZONES[4].rects]},
    {nom:'tout le quartier',rects:[QUARTIER.region]}
  ];
}
const zonesDe=p=>p===alex||FAMILLE_NEO.has(p.id)?ZONES:p.foyer?zonesFoyer(p.foyer):ZONES;
// Chez les autres : un enfant n'entre jamais dans le jardin d'une autre famille (ni chez Néo s'il n'est pas de la famille).
function chezAutres(p,x,z){
  if(etapeDe(p)>=7)return false;
  const famille=p===alex||FAMILLE_NEO.has(p.id);
  if(!famille&&dans(QUARTIER.propriete,x,z))return true;
  for(const f of QUARTIER.foyers)if(f!==p.foyer&&dans(f.jardin,x,z))return true;
  return false;
}
function autorise(x,z,floor){
  if(sleeps.has(alex))return true;
  const n=niveauAcces();
  if(floor===1)return n>=2;
  if(chezAutres(alex,x,z))return false;
  for(let i=0;i<=n;i++)for(const r of ZONES[i].rects)if(dans(r,x,z))return true;
  return false;
}
function autorisePour(p,x,z,floor){
  if(p===alex)return autorise(x,z,floor);
  if(p.accompagne||sleeps.has(p)||etapeDe(p)>=7)return true;
  const n=niveauDe(p),Z=zonesDe(p);
  if(floor===1)return FAMILLE_NEO.has(p.id)&&n>=2;
  if(chezAutres(p,x,z))return false;
  for(let i=0;i<=n;i++)for(const r of Z[i].rects)if(dans(r,x,z))return true;
  return false;
}
function leverInterdits(){
  const n=niveauAcces();
  if(n<=acces.niveau)return;
  acces.niveau=n;
  note('Les parents laissent maintenant Néo aller dans '+ZONES[n].nom+'.','limite');
}
let visiteAmi=null;
function majJourCommerce(){
  const {jour}=jourFictif();
  if(commerce.jour!==jour){commerce.jour=jour;commerce.stock=STOCK_JOUR_COMMERCE;commerce.prelev={};}
}
function quotaRestant(id){majJourCommerce();return Math.max(0,QUOTA_JOUR-(commerce.prelev[id]||0));}
function prelever(id,max=QUOTA_JOUR){
  majJourCommerce();
  const n=Math.min(quotaRestant(id),commerce.stock,max);
  commerce.stock-=n;commerce.prelev[id]=(commerce.prelev[id]||0)+n;commerce.total+=n;
  return n;
}
// Les provisions rapportées sont rangées dans le garde-manger, là où il en manque le plus.
function ranger(n){
  ensureFoodStock();
  for(let k=0;k<n;k++){
    const faibles=kitchen.pantry.slice().sort((a,b)=>a.stock-b.stock);
    faibles[k%Math.max(1,Math.min(10,faibles.length))].stock++;
  }
  ensureFoodStock();
}
// Course au commerce : seuls les adultes y vont (ils gèrent leurs propres besoins).
function routineCourses(p){
  const C=QUARTIER.commerce,portail={x:-4,z:13.2},rue={x:-4,z:16.3},devant={x:C.porte.x,z:16.3};
  lancerRoutine(p,'Va au commerce',[
    {go:portail,activity:'Sort de la propriété'},
    {go:rue,activity:'Marche vers le commerce'},
    {go:devant,activity:'Marche vers le commerce'},
    {go:{x:C.porte.x,z:C.interieur.z1-.6},activity:'Entre dans le commerce'},
    {go:{x:C.comptoir.x-1.6,z:C.comptoir.z},activity:'Prend ses provisions',duree:4,act:q=>{q.sac=prelever(q.id);q.carry=q.sac?'sac':null;}},
    {go:{x:C.porte.x,z:C.interieur.z1-.6},activity:'Sort du commerce'},
    {go:devant,activity:'Rentre à la maison'},
    {go:rue,activity:'Rentre à la maison'},
    {go:portail,activity:'Rentre à la maison'},
    {go:{x:p.homeX,z:p.homeZ},activity:'Range les provisions',duree:2,act:q=>{if(q.sac){ranger(q.sac);note(characterNames[q.id]+' rapporte des provisions du commerce ('+q.sac+').','food');}q.carry=null;q.sac=0;q.enCourse=false;commerce.visites++;evoluer(q.id,'independance',.01);}}
  ]);
}
function stepCourses(p,i,s){
  if(p.enCourse&&ROUT.has(p))return stepRoutine(p,s);
  if(!house||(p.floor||0)!==0||ROUT.has(p)||sleeps.has(p))return false;
  p.prochaineCourse??=40+i*30;
  if(s>=p.prochaineCourse&&kitchen.ingredients<=26&&quotaRestant(p.id)>0&&commerce.stock>0&&!kitchenOwner){
    p.prochaineCourse=s+90;p.enCourse=true;routineCourses(p);return stepRoutine(p,s);
  }
  return false;
}
// Maison de Néo : jamais d'invité avant l'adolescence ; ensuite, un ami n'entre que s'il est accompagné d'un parent.
const peutEntrerChezNeo=(ami,accompagnePar)=>age>=6&&!!accompagnePar&&acces.amisAccompagnes;
function stepVisiteAmi(marie,s){
  acces.amisAccompagnes=age>=6;
  if(visiteAmi){
    const v=visiteAmi,ami=v.ami;
    if(v.phase==='cherche'){
      marie.activity='Va chercher '+characterNames[ami.id];
      if(move(marie,ami.x-.8,ami.z,.9)<.9){v.phase='entre';v.until=s+999;}
    }else if(v.phase==='entre'){
      marie.activity='Fait entrer '+characterNames[ami.id];
      if(move(marie,-6,-1,.9)<.5){v.phase='salon';v.until=s+30;acces.visites++;evoluer('marie','sociabilite',.01);evoluer(ami.id,'sociabilite',.01);note('Marie fait entrer '+characterNames[ami.id]+' dans la maison.','social');}
    }else if(v.phase==='salon'){
      marie.activity='Reçoit '+characterNames[ami.id];
      if(s>=v.until)v.phase='sortie';
    }else{
      marie.activity='Raccompagne '+characterNames[ami.id];
      if(move(marie,ami.homeX,ami.homeZ,.9)<1.2){ami.accompagne=false;visiteAmi=null;marie.nextVisite=s+500;}
    }
    return true;
  }
  if(age>=6&&s>=(marie.nextVisite??350)&&(marie.floor||0)===0&&!ROUT.has(marie)&&!kitchenOwner){
    const amis=people.slice(3).filter(f=>(f.floor||0)===0);
    if(amis.length){visiteAmi={ami:amis[Math.floor(rng()*amis.length)],phase:'cherche'};return true;}
  }
  return false;
}
// Un ami accompagné suit le parent ; seul, il n'entre jamais (les portes de la maison lui restent fermées).
function amiAccompagne(f,s){
  if(!visiteAmi||visiteAmi.ami!==f||visiteAmi.phase==='cherche')return false;
  const m=people[1];
  f.accompagne=true;f.dedans=false;
  f.activity='Suit Marie';
  move(f,m.x-.9,m.z+.4,.95);
  return true;
}
// Les camarades ne progressent pas seuls : ils reprennent en miroir ce que Néo a déjà fait sur les équipements du parc.
const leadershipDe=id=>caractereDe(id)?.leadership||0;
function miroirAmi(f,i,s){
  // Si Néo entraîne davantage que cet enfant et qu'il est proche, l'enfant le suit.
  const d=Math.hypot(alex.x-f.x,alex.z-f.z);
  if((alex.floor||0)===(f.floor||0)&&d<9&&leadershipDe('alex')>leadershipDe(f.id)&&Math.sin(s*.03+i*2.1)>-.2){
    if(d>1.2&&ticks%240===0){Brain.entraine(.004);evoluer(f.id,'sociabilite',.002);}
    const a=i*1.6;
    return {x:alex.x+Math.cos(a)*1.1,z:alex.z+Math.sin(a)*1.1,activity:'Suit Néo'};
  }
  if(!park?.approaches)return null;
  const faits=Object.keys(parkMemory||{}).filter(id=>parkMemory[id]>=1&&park.approaches[id]);
  if(!faits.length||Math.sin(s*.05+i*1.7)<.25)return null;
  const id=faits[(Math.floor(s/40)+i)%faits.length],pt=park.approaches[id];
  if(ticks%600===0){Brain.entraine(.006);evoluer(f.id,'curiosite',.004);}
  return {x:pt.x,z:pt.z,activity:'Refait ce que Néo a découvert au parc'};
}

// Tant que Néo ne marche pas, ses parents le prennent dans leurs bras et le déposent là où il faut :
// à table s'il a faim, près de l'eau s'il a soif, à la douche s'il en a besoin. Personne ne lui explique rien.
let portage=null,prochainPortage=60;
const neoMarche=()=>skill===4&&records[4].mastered;
function besoinPortage(){
  const o=house?.objects,k=house?.kitchen;
  if(alex.hunger>.5&&k?.table&&(kitchen.meals>0||kitchen.pantry?.some(f=>f.stock>0)))
    return {type:'faim',lieu:k.table,vers:'la table',sert:'Donne à manger à Néo'};
  if((alex.thirst||0)>.55&&o?.water)return {type:'soif',lieu:o.water,vers:'l’eau',sert:'Donne à boire à Néo'};
  if((alex.hygiene??1)<.3&&o?.shower)return {type:'hygiene',lieu:o.shower,vers:'la douche',sert:'Lave Néo'};
  return null;
}
function finPortage(s,pause=45){
  if(portage){portage.parent.activity='Se déplace';portage.parent.moving=false;}
  portage=null;prochainPortage=s+pause;alex.y=0;
}
function stepPorte(s){
  if(portage){
    const q=portage,p=q.parent;
    if(neoMarche()||sleeps.has(alex)||sleeps.has(p)||contact||s>q.fin){finPortage(s,60);return false;}
    alex.lie=0;alex.pose=0;alex.tilt=0;alex.effort=0;
    if(q.phase==='cherche'){
      alex.activity='Attend qu’on s’occupe de lui';p.activity='Va chercher Néo';
      if(move(p,alex.x,alex.z,.9)<.5){q.phase='porte';q.fin=s+60;}
    }else if(q.phase==='porte'){
      alex.activity='Est porté vers '+q.besoin.vers;p.activity='Porte Néo vers '+q.besoin.vers;
      const d=move(p,q.besoin.lieu.x,q.besoin.lieu.z,.8);
      alex.x=p.x;alex.z=p.z;alex.y=.62;alex.heading=p.heading;
      if(d<.9){q.phase='sert';q.jusqua=s+4;alex.y=0;}
    }else{
      alex.activity='Est auprès de '+q.besoin.vers;p.activity=q.besoin.sert;
      const a=(p.heading||0)+Math.PI/2,x=p.x+Math.sin(a)*.5,z=p.z+Math.cos(a)*.5;
      if(navigation.isFree(x,z,0)){alex.x=x;alex.z=z;}else{alex.x=p.x;alex.z=p.z;}
      alex.y=0;
      if(s>=q.jusqua){
        const t=q.besoin.type;
        if(t==='faim'){
          if(kitchen.meals>0)takeServing(alex);
          else{const f=kitchen.pantry?.find(x=>x.stock>0);if(f){f.stock--;ensureFoodStock();alex.hunger=Math.max(.08,alex.hunger-.4);alex.pleasure=clamp((alex.pleasure||0)+.1,0,1);}}
        }else if(t==='soif')alex.thirst=.06;
        else alex.hygiene=1;
        alex.pleasure=clamp((alex.pleasure||0)+.15,0,1);
        note(characterNames[p.id]+' porte Néo '+(t==='faim'?'à table et lui donne à manger':t==='soif'?'près de l’eau et lui donne à boire':'à la douche et le lave')+'.','care');
        relationshipEvent('alex',p.id,'Prend soin de Néo',s,age);Brain.lien(opaque('personne:'+p.id),1);evoluer(p.id,'empathie',.002);
        finPortage(s,t==='faim'?70:50);
      }
    }
    return true;
  }
  if(neoMarche()||!house||s<prochainPortage||sleeps.has(alex)||contact||objectContact||(alex.floor||0)!==0||alex.lie)return false;
  const besoin=besoinPortage();if(!besoin)return false;
  const parent=people.slice(0,2).filter(p=>!(p.floor||0)&&!sleeps.has(p)&&p.id!==kitchenOwner&&!ROUT.has(p)&&!p.enCourse&&!doorHelp.has(p))
    .sort((a,b)=>Math.hypot(a.x-alex.x,a.z-alex.z)-Math.hypot(b.x-alex.x,b.z-alex.z))[0];
  if(!parent){prochainPortage=s+10;return false;}
  portage={parent,besoin,phase:'cherche',fin:s+70};
  return true;
}
