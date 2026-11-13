// Pénurie, commerce de proximité, accès aux maisons, miroir des camarades. Aucun personnage n'explique rien à Néo.
// Argent = 0 : pas de prix ni de caisse. Chaque agent a un quota de prélèvement par jour fictif.
const QUOTA_JOUR=8,STOCK_JOUR_COMMERCE=60;
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
function autorise(x,z,floor){
  if(sleeps.has(alex))return true;
  const n=niveauAcces();
  if(floor===1)return n>=2;
  for(let i=0;i<=n;i++)for(const r of ZONES[i].rects)if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1)return true;
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
    {go:{x:p.homeX,z:p.homeZ},activity:'Range les provisions',duree:2,act:q=>{if(q.sac){ranger(q.sac);note(characterNames[q.id]+' rapporte des provisions du commerce ('+q.sac+').','food');}q.carry=null;q.sac=0;q.enCourse=false;commerce.visites++;}}
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
      if(move(marie,-6,-1,.9)<.5){v.phase='salon';v.until=s+30;acces.visites++;note('Marie fait entrer '+characterNames[ami.id]+' dans la maison.','social');}
    }else if(v.phase==='salon'){
      marie.activity='Reçoit '+characterNames[ami.id];
      if(s>=v.until)v.phase='sortie';
    }else{
      marie.activity='Raccompagne '+characterNames[ami.id];
      if(move(marie,ami.homeX,ami.homeZ,.9)<1.2){visiteAmi=null;marie.nextVisite=s+500;}
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
  f.activity='Suit Marie';
  move(f,m.x-.9,m.z+.4,.95);
  return true;
}
// Les camarades ne progressent pas seuls : ils reprennent en miroir ce que Néo a déjà fait sur les équipements du parc.
const leadershipDe=id=>id==='alex'?Brain.state.social.leadership||0:socialStyle[id]?.leadership||0;
function miroirAmi(f,i,s){
  // Si Néo entraîne davantage que cet enfant et qu'il est proche, l'enfant le suit.
  const d=Math.hypot(alex.x-f.x,alex.z-f.z);
  if((alex.floor||0)===(f.floor||0)&&d<9&&leadershipDe('alex')>leadershipDe(f.id)&&Math.sin(s*.03+i*2.1)>-.2){
    if(d>1.2&&ticks%240===0)Brain.entraine(.004);
    const a=i*1.6;
    return {x:alex.x+Math.cos(a)*1.1,z:alex.z+Math.sin(a)*1.1,activity:'Suit Néo'};
  }
  if(!park?.approaches)return null;
  const faits=Object.keys(parkMemory||{}).filter(id=>parkMemory[id]>=1&&park.approaches[id]);
  if(!faits.length||Math.sin(s*.05+i*1.7)<.25)return null;
  const id=faits[(Math.floor(s/40)+i)%faits.length],pt=park.approaches[id];
  if(ticks%600===0)Brain.entraine(.006);
  return {x:pt.x,z:pt.z,activity:'Refait ce que Néo a découvert au parc'};
}
