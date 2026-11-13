// Les habitants du quartier : des familles dans toutes les maisons, de tous âges.
// On ne les voit pas dans la fenêtre de contrôle, mais ils obéissent aux mêmes règles que Néo et les PNJ :
// périmètre selon l'âge depuis leur maison, faim et fatigue, nuit à la maison, courses au commerce avec le même quota,
// langage selon leur étape de vie, traits de caractère. Personne n'explique rien à Néo.
const PRENOMS_F=['Emma','Léa','Chloé','Inès','Camille','Sarah','Manon','Jade','Louise','Alice','Zoé','Clara','Julia','Anna','Lou','Mila','Elsa','Nina','Agathe','Margaux','Lucie','Eva','Romane','Lina','Mia','Sofia','Hélène','Claire','Nadia','Isabelle','Sophie','Céline','Martine','Paule'];
const PRENOMS_M=['Lucas','Hugo','Louis','Gabriel','Arthur','Jules','Adam','Raphaël','Léo','Paul','Noé','Tom','Sacha','Victor','Maël','Ethan','Liam','Eliott','Simon','Robin','Antoine','Max','Oscar','Basile','Marc','Pierre','Olivier','Karim','Thomas','Didier','Bernard','Michel','Yves','Henri'];
let voisins=[];
const voisinsDehors=[];
const nuitDuQuartier=()=>{const {heure}=jourFictif();return heure<7||heure>=21;};
function creerVoisins(){
  let graine=20261113;
  const r=()=>(graine=(graine*16807)%2147483647)/2147483647;
  const pris=new Set();
  const prenom=f=>{const l=f?PRENOMS_F:PRENOMS_M;for(let k=0;k<40;k++){const n=l[Math.floor(r()*l.length)];if(!pris.has(n)){pris.add(n);return n;}}return l[Math.floor(r()*l.length)];};
  const traits=()=>Object.fromEntries(Object.keys(TRAITS).map(t=>[t,+(.15+r()*.7).toFixed(2)]));
  voisins=[];
  let n=0;
  for(const f of QUARTIER.foyers){
    f.provisions=16+Math.floor(r()*10);
    const dejaEnfants=(f.maison.x===29&&f.maison.z===2)||(f.maison.x===21&&f.maison.z===31.5);
    const grandsParents=!dejaEnfants&&r()<.18;
    const adultes=dejaEnfants||grandsParents?2:1+(r()<.75?1:0);
    const sexes=adultes===2?[true,false]:[r()<.5];
    for(const fem of sexes)voisins.push({id:'v'+(n++),nom:prenom(fem),femme:fem,decalage:7+(grandsParents?1:0),vieux:grandsParents,foyer:f,caractere:traits()});
    // les enfants : de tous âges ; un décalage négatif = pas encore né quand Néo est tout petit
    const enfants=dejaEnfants||grandsParents?0:Math.floor(r()*3.4);
    for(let k=0;k<enfants;k++){const fem=r()<.5;voisins.push({id:'v'+(n++),nom:prenom(fem),femme:fem,decalage:Math.floor(r()*8)-2,foyer:f,caractere:traits()});}
  }
  for(const v of voisins)Object.assign(v,{x:v.foyer.porte.x,z:v.foyer.porte.z,floor:0,heading:0,phase:0,speed:0,moving:false,dedans:true,
    faim:r()*.4,fatigue:r()*.3,activite:'À la maison',but:null,prochain:r()*60,teinte:Math.floor(r()*8)});
  // Le commerce est approvisionné pour tout le quartier, pas plus.
  STOCK_JOUR_COMMERCE=100+10*QUARTIER.foyers.length;
  if(commerce.stock===100)commerce.stock=STOCK_JOUR_COMMERCE;
}
function sortir(v){v.dedans=false;v.x=v.foyer.porte.x;v.z=v.foyer.porte.z;v.speed=0;}
function rentrer(v){v.dedans=true;v.but=null;v.moving=false;v.activite='À la maison';v.x=v.foyer.porte.x;v.z=v.foyer.porte.z;}
// Ce qu'un habitant décide quand il est chez lui.
function deciderVoisin(v,s){
  const f=v.foyer,n=niveauDe(v),adulte=v.etape>=7;
  // manger : seulement ce que la famille a dans ses placards
  if(v.faim>.6&&f.provisions>0){f.provisions--;v.faim=.08;}
  if(nuitDuQuartier()){v.fatigue=Math.max(0,v.fatigue-.04);return;}
  if(s<v.prochain)return;
  const C=QUARTIER.commerce,membres=voisins.filter(o=>o.foyer===f&&o.etape>=0).length;
  // un adulte va au commerce quand les placards se vident (même quota que la famille de Néo)
  if(adulte&&f.provisions<membres*3&&!f.enCourse&&quotaRestant(v.id)>0&&commerce.stock>0){
    f.enCourse=true;sortir(v);v.but={type:'courses',phase:'aller',x:C.comptoir.x-1.6,z:C.comptoir.z,depuis:s};v.activite='Va au commerce';return;
  }
  const c=v.caractere;
  v.prochain=s+30+rng()*90*(1-c.curiosite*.5);
  if(n===0)return;                                    // les plus petits restent à l'intérieur
  const envie=c.curiosite*.5+c.sociabilite*.5;
  if(rng()>envie*.75)return;
  if(n>=3&&!adulte||adulte&&rng()<.25){
    const P=f.parc;sortir(v);
    v.but={type:'parc',x:P.centre.x+(rng()-.5)*7,z:P.centre.z+(rng()-.5)*6,jusqua:s+60+rng()*120,depuis:s};
    v.activite='Va à l’aire de jeux';return;
  }
  const J=f.jardin;sortir(v);
  v.but={type:'jardin',x:J.x0+1+rng()*(J.x1-J.x0-2),z:J.z0+.5+rng()*Math.max(.2,J.z1-J.z0-1),jusqua:s+40+rng()*60,depuis:s};
  v.activite='Joue dans son jardin';
}
// Ce qu'un habitant fait dehors.
function agirVoisin(v,s){
  const b=v.but,f=v.foyer;
  if(!b){retourMaison(v,s);return;}
  if(nuitDuQuartier()&&b.type!=='retour'){v.but={type:'retour',depuis:s};return;}
  if(b.type==='retour'){retourMaison(v,s);return;}
  const d=move(v,b.x,b.z,v.etape>=7?1.7:1.8);
  if(b.type==='courses'){
    if(b.phase==='aller'&&d<.7){
      const pris=prelever(v.id);f.provisions+=pris;f.enCourse=false;commerce.visites++;
      v.carry=pris?'sac':null;v.but={type:'retour',depuis:s};v.activite='Rentre avec ses courses';
    }else if(s-b.depuis>420){f.enCourse=false;v.but={type:'retour',depuis:s};}
    return;
  }
  if(d<.6){
    // sur place : on bouge un peu, comme les autres
    if(s>=b.jusqua){v.but={type:'retour',depuis:s};return;}
    if(rng()<.01){const r=b.type==='parc'?3:1.2;b.x+= (rng()-.5)*r;b.z+=(rng()-.5)*r;}
    v.activite=b.type==='parc'?'Joue à l’aire de jeux':'Joue dans son jardin';
  }else if(s-b.depuis>300&&d>2)v.but={type:'retour',depuis:s};
}
function retourMaison(v,s){
  const p=v.foyer.porte;
  v.activite='Rentre à la maison';
  const d=move(v,p.x,p.z,1.7);
  if(d<.6||s-(v.but?.depuis??s)>300){v.carry=null;rentrer(v);v.prochain=s+40;}
}
function stepVoisins(s){
  if(!voisins.length)creerVoisins();
  voisinsDehors.length=0;
  const lent=ticks%30===0;
  for(let k=0;k<voisins.length;k++){
    const v=voisins[k];
    v.etape=Math.min(8,age+v.decalage);
    if(v.etape<0){if(!v.dedans)rentrer(v);continue;}       // pas encore né
    if(lent){v.faim=Math.min(1,v.faim+30*DT*.0021);v.fatigue=Math.min(1,v.fatigue+30*DT*.0015);}
    if(v.dedans){if(lent)deciderVoisin(v,s);continue;}
    // dehors : un pas toutes les deux images (deux fois plus long), pour alléger le calcul
    if((k+ticks)%2===0)agirVoisin(v,s);
    if(!v.dedans)voisinsDehors.push(v);
  }
  // Ils parlent avec les mots de leur âge — on ne garde que ce que Néo peut entendre.
  if(ticks%90===0&&!sleeps.has(alex)){
    const proches=voisinsDehors.filter(v=>v.etape>=1&&Math.hypot(v.x-alex.x,v.z-alex.z)<5.2&&(alex.floor||0)===0);
    for(const a of proches){
      if(s<(a.prochaineParole||0))continue;
      const autre=proches.find(b=>b!==a&&Math.hypot(b.x-a.x,b.z-a.z)<3.5)||(Math.hypot(a.x-alex.x,a.z-alex.z)<2.6?alex:null);
      if(!autre)continue;
      a.prochaineParole=s+25+rng()*30;
      dialogue.parleVoisin(s,a,autre,alex,languageScene);
      break;
    }
  }
}
// Juliette, comme tous les grands frères et sœurs : s'occuper de son petit frère et jouer avec lui,
// et aussi avec les autres de son âge ou plus grands. Toujours dans son propre périmètre.
function stepGrandeSoeur(p,s,goalX,goalZ){
  const e=etapeDe(p);
  const neo=!sleeps.has(alex)&&!alex.lie&&(alex.floor||0)===(p.floor||0)&&autorisePour(p,alex.x,alex.z,alex.floor||0);
  const besoin=alex.hunger>.55||alex.fatigue>.65||(alex.thirst||0)>.6;
  if(neo&&(besoin||Math.sin(s*.017)>-.4)){
    const a=s*.2,d=move(p,alex.x+Math.cos(a)*.8,alex.z+Math.sin(a)*.8,.9);
    p.activity=besoin?'S’occupe de Néo':'Joue avec Néo';
    if(d<1.3&&s>=(p.prochainSoin||0)){
      p.prochainSoin=s+40;
      alex.pleasure=clamp((alex.pleasure||0)+(besoin?.12:.07),0,1);
      relationshipEvent('alex','juliette',besoin?'Juliette s’occupe de Néo':'Juliette joue avec Néo',s,age);
      Brain.lien(opaque('personne:juliette'),.6);
      evoluer('juliette','empathie',.002);
      note(besoin?'Juliette s’occupe de Néo.':'Juliette joue avec Néo.',besoin?'care':'play');
    }
    return;
  }
  const amis=voisinsDehors.filter(v=>v.etape>=e&&v.etape<7&&autorisePour(p,v.x,v.z,0));
  if(amis.length){
    const v=amis.reduce((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)<Math.hypot(b.x-p.x,b.z-p.z)?a:b);
    const d=move(p,v.x+.7,v.z+.4,.9);p.activity='Joue avec '+v.nom;
    if(d<1.4&&s>=(p.prochainJeu||0)){p.prochainJeu=s+120;note('Juliette joue avec '+v.nom+'.','play');evoluer('juliette','sociabilite',.002);}
    return;
  }
  p.activity='Se déplace';
  move(p,goalX,goalZ,.75);
}
// Les quatre enfants du début vivent chez eux : dedans tant que leur âge ne leur permet pas de sortir, et la nuit.
function stepEnfantVoisin(p,i,s){
  const f=p.foyer;if(!f)return false;
  const n=niveauDe(p);
  if(n===0||nuitDuQuartier()){
    if(p.dedans){p.moving=false;p.activity=n===0?'Est à la maison':'Dort à la maison';return true;}
    p.activity='Rentre à la maison';
    if(n===0||move(p,f.porte.x,f.porte.z,.85)<.6){p.dedans=true;p.moving=false;p.x=f.porte.x;p.z=f.porte.z;}
    return true;
  }
  if(p.dedans){p.dedans=false;p.x=f.porte.x;p.z=f.porte.z;}
  return false;
}
function attribuerFoyers(){
  const fo=(x,z)=>QUARTIER.foyers.find(f=>f.maison.x===x&&f.maison.z===z);
  const maisons={timeo:fo(29,2),nathan:fo(29,2),lidia:fo(21,31.5),rose:fo(21,31.5)};
  for(const p of people){
    const f=maisons[p.id];if(!f)continue;
    Object.defineProperty(p,'foyer',{value:f,enumerable:false,writable:true,configurable:true});
    const k=p.id==='timeo'||p.id==='lidia'?-1.3:1.3;
    p.homeX=f.porte.x+k;p.homeZ=f.porte.z+(f.porte.z>f.maison.z?1:-.6);
  }
}
const vueVoisins=()=>voisinsDehors.map(v=>[+v.x.toFixed(2),+v.z.toFixed(2),+(v.heading||0).toFixed(2),v.etape,v.teinte+(v.femme?8:0),v.moving?+(v.phase%6.283).toFixed(2):-1]);
