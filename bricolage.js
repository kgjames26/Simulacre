// Atelier, arbre, bois de chauffage, fleurs. Tout est scripté pour les adultes de la maison ;
// personne ne « sait » rien de plus que ce que montrent ces gestes, et Néo n'a jamais à y toucher.
// Si Néo touche un outil ou en assemble quelque chose de lui-même, il y gagne du plaisir et de la confiance.
const OUTILS_DEF=[
  ['hache','hache',-3.1],['scie','scie',-2.8],['marteau','marteau',-2.5],['clous','boîte de clous',-2.2],['colle','colle à bois',-1.9],
  ['vis','boîte de vis',-1.6],['tournevis','tournevis',-1.3],['arrosoir','arrosoir',-1.0],['tuyau','tuyau d’eau',-0.7]
];
const MUR_X=-0.46,STAND_X=0.28;
const ARBRE_POS={x:1.8,z:-8,stand:{x:.8,z:-8}};
// Tous les arbres se coupent à la hache et repoussent : le pommier du jardin, les arbres du jardin, du parc et du quartier.
function positionsArbres(){
  const l=[{x:ARBRE_POS.x,z:ARBRE_POS.z,pommier:true}];
  for(const [x,z] of [[-17,-10.5],[-15,10],[-6,-10],[-10,10],[7,-10],[16,-9],[17,9]])l.push({x,z});
  if(typeof QUARTIER!=='undefined')for(const a of QUARTIER.arbres)l.push({x:+a.x.toFixed(2),z:+a.z.toFixed(2),grand:a.modele==='tree-large'});
  return l;
}
const nouveauxArbres=()=>positionsArbres().map(p=>({...p,t:1,chute:0,morceaux:0,coupes:0}));
const standArbre=a=>({x:a.x-.9,z:a.z});
const dansPropriete=a=>a.x<4.2&&a.x>-19&&Math.abs(a.z)<12;
const TAS_POS={x:0.12,z:1.4,stand:{x:0.75,z:1.4}};
const PLANCHES_POS={x:0.18,z:2.7,stand:{x:0.75,z:2.7}};
const FLEURS_POS=[[1.4,6.9],[2.2,6.9],[3.0,6.9],[3.8,6.9]];
const ROBINET={x:MUR_X,z:-0.3,stand:{x:STAND_X,z:-0.3}};
function atelierInitial(){
  return {
    outils:OUTILS_DEF.map(([id,nom,z])=>({id,nom,x:MUR_X,z,floor:0,etat:'mur',plein:false})),
    arbres:nouveauxArbres(),
    bois:{tas:3,poele:.7,planches:0},
    pommes:[],
    prochainePomme:30,
    fleurs:FLEURS_POS.map(([x,z])=>({x,z,soif:.2})),
    suivant:{joseph:60,marie:40},
    neo:{touches:{},fabrications:0},
    confiance:{}
  };
}
let atelier=atelierInitial();
const outil=id=>atelier.outils.find(o=>o.id===id);
const pommier=()=>atelier.arbres[0];
function placeOutil(o){o.x=MUR_X;o.z=OUTILS_DEF.find(d=>d[0]===o.id)[2];o.etat='mur';o.plein=false;}
// Où trouver un outil : à son crochet, ou là où quelqu'un l'a laissé.
const standOutil=id=>()=>{const o=outil(id);return o.etat==='sol'?{x:o.x+.4,z:o.z}:{x:STAND_X,z:OUTILS_DEF.find(d=>d[0]===id)[2]};};
function jourFictif(){const sec=ticks/120*TIME_SCALE;return {jour:1+Math.floor(sec/86400),heure:sec%86400/3600};}
function temperature(){const {jour,heure}=jourFictif();return 11+9*Math.cos(2*Math.PI*(jour-200)/365)-(heure<7||heure>21?4:0);}
const froid=()=>temperature()<9;
const vieux=p=>age>=8&&(p.id==='joseph'||p.id==='marie');
function gagner(id,plaisir,confiance){
  const p=id==='alex'?alex:people.find(q=>q.id===id);if(!p)return;
  p.pleasure=clamp((p.pleasure||0)+plaisir,0,1);
  p.confiance=clamp((p.confiance??.4)+confiance,0,1);
}
// Une routine = liste d'étapes {go,duree,act,activity} exécutées dans l'ordre ; abandon si bloquée.
const ROUT=new WeakMap();
function lancerRoutine(p,nom,etapes){ROUT.set(p,{nom,etapes,i:0,debut:null});}
function stepRoutine(p,s){
  const r=ROUT.get(p);if(!r)return false;
  const e=r.etapes[r.i];
  if(!e){ROUT.delete(p);return false;}
  p.activity=e.activity||r.nom;
  // Délai de marche proportionnel à la distance : on ne « téléporte » plus personne au bout de 50 s.
  const go=typeof e.go==='function'?e.go():e.go;
  if(r.debut==null){r.debut=s;r.limite=s+(go?Math.hypot(go.x-p.x,go.z-p.z)/(.8*(p.vieux?.6:1))*1.6+15:0);}
  if(go){
    const reste=move(p,go.x,go.z,.8);
    if(reste>.4&&s<r.limite)return true;
  }
  if(e.duree&&e.until==null)e.until=s+e.duree*(vieux(p)?1.6:1);
  if(e.until&&s<e.until)return true;
  e.act?.(p,s);r.i++;r.debut=null;
  return true;
}
function prendre(p,id){const o=outil(id);if(alex.carry===id)alex.carry=null;o.etat='porte:'+p.id;p.carry=id;}
function poser(p,id){const o=outil(id);if(p.carry===id)p.carry=null;return o;}
// La hache abat l'arbre et le débite vite : le but n'est pas de passer du temps, mais d'avoir du bois près de la maison.
function abattre(arbre,qui){
  arbre.chute=.001;arbre.coupes++;
  if(arbre.pommier)atelier.pommes.length=0;
}
function routineAbattre(p,arbre){
  const stand=standOutil('hache'),pied=standArbre(arbre);
  const E=[
    {go:stand,activity:'Va chercher la hache',act:q=>prendre(q,'hache')},
    {go:pied,activity:'Frappe l’arbre à la hache',duree:5,act:()=>{abattre(arbre,'joseph');note('Joseph abat un arbre du jardin à la hache. Il repoussera.','object');}},
    {activity:'Regarde l’arbre tomber',duree:3,go:{x:pied.x-.5,z:pied.z}},
    {go:{x:pied.x,z:pied.z+.8},activity:'Coupe le tronc en morceaux à la hache',duree:4,act:()=>{note('Joseph coupe le tronc en petits morceaux.','object');}},
    {go:()=>({x:STAND_X,z:OUTILS_DEF.find(d=>d[0]==='hache')[2]}),activity:'Range la hache',act:q=>{const o=poser(q,'hache');placeOutil(o);}}
  ];
  for(let k=0;k<3;k++){
    E.push({go:pied,activity:'Ramasse du bois',act:q=>{if(arbre.morceaux>0){arbre.morceaux--;q.carry='bûche';}}});
    E.push({go:TAS_POS.stand,activity:'Empile le bois contre le mur',duree:2,act:q=>{if(q.carry==='bûche'){q.carry=null;atelier.bois.tas++;}}});
  }
  E.push({go:TAS_POS.stand,act:()=>{atelier.bois.tas+=3;arbre.morceaux=0;gagner('joseph',.1,.03);evoluer('joseph','perseverance',.01);}});
  lancerRoutine(p,'Bricole dehors',E);
}
// La scie, plus lente, sert à faire de jolies planches, rangées près de la maison.
function routinePlanches(p){
  const stand=standOutil('scie');
  lancerRoutine(p,'Fait des planches',[
    {go:stand,activity:'Va chercher la scie',act:q=>prendre(q,'scie')},
    {go:TAS_POS.stand,activity:'Prend une bûche',act:q=>{if(atelier.bois.tas>0)atelier.bois.tas--;}},
    {go:{x:PLANCHES_POS.stand.x,z:PLANCHES_POS.stand.z-.5},activity:'Scie des planches',duree:16,act:()=>{atelier.bois.planches+=2;}},
    {go:PLANCHES_POS.stand,activity:'Empile les planches contre le mur',duree:2,act:()=>{gagner('joseph',.08,.03);evoluer('joseph','patience',.012);evoluer('joseph','creativite',.006);note('Joseph range de nouvelles planches près de la maison.','object');}},
    {go:()=>({x:STAND_X,z:OUTILS_DEF.find(d=>d[0]==='scie')[2]}),activity:'Range la scie',act:q=>{const o=poser(q,'scie');placeOutil(o);}}
  ]);
}
function routineChauffage(p){
  const feu=house?.objects?.fireplace;if(!feu)return false;
  const E=[];
  for(let k=0;k<2;k++){
    E.push({go:TAS_POS.stand,activity:'Prend du bois pour le chauffage',act:q=>{if(atelier.bois.tas>0){atelier.bois.tas--;q.carry='bûche';}}});
    E.push({go:feu,activity:'Recharge le chauffage à bois',duree:3,act:q=>{if(q.carry==='bûche'){q.carry=null;atelier.bois.poele=Math.min(1,atelier.bois.poele+.4);}}});
  }
  E.push({go:{x:p.homeX,z:p.homeZ},act:()=>note('Joseph recharge le chauffage à bois.','object')});
  lancerRoutine(p,'Entretient le chauffage',E);return true;
}
function routineArroser(p){
  const stand=n=>standOutil(n);const sol={x:STAND_X+.3,z:-0.15};
  const E=[
    {go:stand('arrosoir'),activity:'Va chercher l’arrosoir',act:q=>prendre(q,'arrosoir')},
    {go:ROBINET.stand,activity:'Dépose l’arrosoir',act:q=>{const o=poser(q,'arrosoir');o.etat='sol';o.x=sol.x+.1;o.z=sol.z;}},
    {go:stand('tuyau'),activity:'Prend le tuyau d’eau',act:q=>prendre(q,'tuyau')},
    {go:{x:sol.x+.2,z:sol.z+.3},activity:'Remplit l’arrosoir avec le tuyau',duree:4,act:()=>{outil('arrosoir').plein=true;}},
    {go:stand('tuyau'),activity:'Range le tuyau',act:q=>{const o=poser(q,'tuyau');placeOutil(o);}},
    {go:{x:sol.x+.1,z:sol.z+.3},activity:'Reprend l’arrosoir',act:q=>{q.carry='arrosoir';outil('arrosoir').etat='porte:'+q.id;}}
  ];
  FLEURS_POS.forEach(([x,z],i)=>E.push({go:{x,z:z-.75},activity:'Arrose les fleurs',duree:3,act:()=>{atelier.fleurs[i].soif=0;}}));
  E.push({go:stand('arrosoir'),activity:'Range l’arrosoir',act:q=>{const o=poser(q,'arrosoir');placeOutil(o);gagner('marie',.18,.06);evoluer('marie','patience',.01);evoluer('marie','optimisme',.01);note('Marie arrose les fleurs. Cela lui fait plaisir.','care');}});
  lancerRoutine(p,'Entretient les fleurs',E);
}
function stepBricolage(p,i,s){
  if(!house||(p.floor||0)!==0||!navigation)return false;
  if(ROUT.has(p))return stepRoutine(p,s);
  if(p.id==='joseph'&&!vieux(p)){
    if(froid()&&atelier.bois.poele<.35&&atelier.bois.tas>0&&s>=atelier.suivant.joseph-30){if(routineChauffage(p)){atelier.suivant.joseph=s+60;return stepRoutine(p,s);}}
    if(atelier.bois.tas<3&&s>=atelier.suivant.joseph){
      const pret=atelier.arbres.filter(a=>dansPropriete(a)&&a.t>=.95&&!a.chute).sort((x,y)=>Math.hypot(x.x-TAS_POS.x,x.z-TAS_POS.z)-Math.hypot(y.x-TAS_POS.x,y.z-TAS_POS.z))[0];
      if(pret){atelier.suivant.joseph=s+240;routineAbattre(p,pret);return stepRoutine(p,s);}
    }
    if(atelier.bois.planches<8&&atelier.bois.tas>=3&&s>=atelier.suivant.joseph){atelier.suivant.joseph=s+200;routinePlanches(p);return stepRoutine(p,s);}
  }
  if(p.id==='marie'&&!vieux(p)&&s>=atelier.suivant.marie&&atelier.fleurs.some(f=>f.soif>.5)){atelier.suivant.marie=s+200;routineArroser(p);return stepRoutine(p,s);}
  return false;
}
// À chaque pas : repousse de l'arbre, soif des fleurs, feu, vieillesse.
function stepAtelier(s){
  const a=atelier;
  for(const arbre of a.arbres){
    if(arbre.chute>0){arbre.chute+=DT/2.5;if(arbre.chute>=1){arbre.chute=0;arbre.t=.12;arbre.morceaux=6;entityCache=null;}}
    else if(arbre.t<1)arbre.t=Math.min(1,arbre.t+DT/420);
  }
  // Un outil que Néo a pris : il le garde un moment, puis le laisse là où il est.
  if(alex.carry&&outil(alex.carry)){
    const o=outil(alex.carry);
    if(o.etat!=='porte:alex'||s>(alex.carryUntil||0)){if(o.etat==='porte:alex'){o.etat='sol';o.x=alex.x;o.z=alex.z;}alex.carry=null;entityCache=null;}
    else{o.x=alex.x;o.z=alex.z;}
  }
  // Pommes : elles tombent, restent un moment, puis disparaissent. Personne ne sait qu'on peut les manger.
  const pm=a.arbres[0];
  if(pm.t>=.95&&!pm.chute&&s>=a.prochainePomme&&a.pommes.length<5){
    const ang=rng()*Math.PI*2,r=.5+rng()*1.1;
    a.pommes.push({id:'p'+Math.floor(s),x:ARBRE_POS.x+Math.cos(ang)*r,z:ARBRE_POS.z+Math.sin(ang)*r,floor:0,nee:s});
    a.prochainePomme=s+45;entityCache=null;
  }
  if(a.pommes.some(m=>s-m.nee>150)){a.pommes=a.pommes.filter(m=>s-m.nee<=150);entityCache=null;}
  for(const f of a.fleurs)f.soif=Math.min(1,f.soif+DT/500);
  a.bois.poele=Math.max(0,a.bois.poele-DT*(froid()?.0035:.0006));
  for(const p of people.slice(0,2))p.vieux=vieux(p);
  for(const p of people.slice(0,2)){
    const o=p.carry&&outil(p.carry);if(o&&o.etat==='porte:'+p.id){o.x=p.x;o.z=p.z;}
  }
  if(froid()&&a.bois.poele>.05)household.fireplace=1;
}
// Néo : il peut toucher ou assembler, sans jamais en avoir la consigne. Rien n'est un objectif.
function neoToucheOutil(o,s){
  const n=atelier.neo;
  const premiere=!n.touches[o.id];
  n.touches[o.id]=(n.touches[o.id]||0)+1;
  if(premiere){gagner('alex',.08,.03);note('Néo touche pour la première fois '+o.nom+'.','object');}
  const distincts=Object.keys(n.touches).length,total=Object.values(n.touches).reduce((a,b)=>a+b,0);
  if(distincts>=2&&total>=4*(n.fabrications+1)){
    n.fabrications++;gagner('alex',.25,.08);Brain.trait('creativite',.05);
    note('Néo assemble quelque chose avec ce qu’il a trouvé. Il en est fier.','object');
  }
}
