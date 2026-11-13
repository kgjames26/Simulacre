const playgroundFriends=['timeo','nathan','francoise','rose'];
const socialStyle={
  alex:{outreach:.64,care:.58},joseph:{outreach:.49,care:.83},marie:{outreach:.77,care:.92},
  juliette:{outreach:.58,care:.68},timeo:{outreach:.88,care:.62},nathan:{outreach:.61,care:.72},
  francoise:{outreach:.54,care:.82},rose:{outreach:.72,care:.76}
};
const adultCircle=new Set(['alex',...playgroundFriends]);
const female=new Set(['francoise','rose','marie','juliette']);
const FAMILLE=new Set(['alex','joseph','marie','juliette']);
let relationships={};
const relationshipCooldown={};
// Sentiments amoureux : tendresse, attirance, complicité (0-100). Rien n'est un objectif : cela peut ne jamais arriver.
// Une seule relation amoureuse à la fois, toujours avec le sexe opposé, jamais dans la famille.
const ACTES_AMOUREUX={
  'un regard':{min:0,effets:{attirance:3,tendresse:1},plaisir:.04,confiance:.01},
  'tenir la main':{min:20,effets:{tendresse:4,complicite:2},plaisir:.08,confiance:.02},
  'un cadeau':{min:25,effets:{complicite:4,tendresse:2},plaisir:.10,confiance:.03},
  'un câlin':{min:35,effets:{tendresse:5,attirance:1},plaisir:.15,confiance:.03},
  'un baiser':{min:50,effets:{attirance:6,tendresse:3},plaisir:.20,confiance:.04},
  'une dispute':{min:0,effets:{tendresse:-8,complicite:-4},plaisir:-.15,confiance:-.04}
};
const sexeOppose=(a,b)=>female.has(a)!==female.has(b);
const memeFamille=(a,b)=>FAMILLE.has(a)&&FAMILLE.has(b)&&!(a==='joseph'&&b==='marie'||a==='marie'&&b==='joseph');
function partnerOf(id){
  for(const r of Object.values(relationships))if(r.couple&&(r.a===id||r.b===id))return r.a===id?r.b:r.a;
  return null;
}
function isCourtshipEligible(a,b,age){
  if(age<7||a===b||!adultCircle.has(a)||!adultCircle.has(b)||!sexeOppose(a,b)||memeFamille(a,b))return false;
  const pa=partnerOf(a),pb=partnerOf(b);
  return (pa===null||pa===b)&&(pb===null||pb===a);
}
function relationship(a,b){
  const key=[a,b].sort().join(':');
  const r0=relationships[key];
  if(r0){r0.tendresse??=0;r0.attirance??=0;r0.complicite??=0;r0.actes??={};r0.separations??=0;r0.sepJusque??=0;return r0;}
  return relationships[key]={
    a,b,bond:0,romance:0,couple:key==='joseph:marie',met:0,history:[],
    tendresse:key==='joseph:marie'?80:0,attirance:key==='joseph:marie'?70:0,complicite:key==='joseph:marie'?85:0,
    actes:{},separations:0,sepJusque:0
  };
}
const romanceOf=r=>Math.round((r.tendresse+r.attirance+r.complicite)/3);
function acteAmoureux(data,nom,s){
  const acte=ACTES_AMOUREUX[nom];
  for(const [k,v] of Object.entries(acte.effets))data[k]=Math.max(0,Math.min(100,(data[k]||0)+v));
  data.romance=romanceOf(data);
  data.actes[nom]=(data.actes[nom]||0)+1;
  // Chacun en ressent les effets individuellement.
  if(typeof gagner==='function'){gagner(data.a,acte.plaisir,acte.confiance);gagner(data.b,acte.plaisir,acte.confiance);}
  return nom;
}
function choisirActe(data){
  const ok=Object.entries(ACTES_AMOUREUX).filter(([n,a])=>n!=='une dispute'&&a.min<=data.romance);
  return ok[Math.floor(rng()*ok.length)][0];
}
function rompre(data,s){
  data.couple=false;data.separations++;data.sepJusque=s+3000;
  for(const k of ['tendresse','attirance','complicite'])data[k]=Math.round(data[k]*.4);
  data.romance=romanceOf(data);
  if(typeof gagner==='function'){gagner(data.a,-.3,-.1);gagner(data.b,-.3,-.1);}
  if(typeof note==='function')note((characterNames[data.a]||data.a)+' et '+(characterNames[data.b]||data.b)+' se séparent.','social');
  return 'Séparation';
}
function relationshipEvent(a,b,kind,s,age){
  const data=relationship(a,b);
  const key=[a,b].sort().join(':');
  if((relationshipCooldown[key]||0)>s)return;
  relationshipCooldown[key]=s+12;
  const style=socialStyle[a], other=socialStyle[b];
  data.met++;
  data.bond=Math.min(100,data.bond+Math.round(2+4*(style.care+other.care)/2));
  let event=kind;
  if(data.couple){
    if(key!=='joseph:marie'&&data.tendresse<18)event=rompre(data,s);
    else if(rng()<(key==='joseph:marie'?.01:.07))event='Dispute ('+acteAmoureux(data,'une dispute',s)+')';
    else if(key!=='joseph:marie'&&data.complicite<40&&rng()<.004)event=rompre(data,s);
    else event='Moment tendre : '+acteAmoureux(data,choisirActe(data),s);
  }else if(s>=data.sepJusque&&isCourtshipEligible(a,b,age)&&data.bond>=30&&rng()<(style.outreach+other.outreach)*.3){
    event='Rapprochement : '+acteAmoureux(data,choisirActe(data),s);
    if(data.romance>=55&&data.tendresse>=50){
      data.couple=true;
      if(typeof note==='function')note((characterNames[a]||a)+' et '+(characterNames[b]||b)+' sont maintenant ensemble.','social');
      event='Ils se mettent ensemble';
    }
  }
  data.romance=romanceOf(data);
  data.history.push({at:s,event,bond:data.bond,romance:data.romance});
  if(data.history.length>160)data.history.splice(1,1);
}
function updateRelationships(alex,people,s,age){
  const population=[{...alex,id:'alex'},...people];
  for(let i=0;i<population.length;i++){
    const a=population[i];
    if(a.lie)continue;
    for(let j=i+1;j<population.length;j++){
      const b=population[j];
      if(b.lie||(a.floor||0)!==(b.floor||0)||Math.hypot(a.x-b.x,a.z-b.z)>1.15)continue;
      if(navigation.clear(a.x,a.z,b.x,b.z,a.floor||0))relationshipEvent(a.id,b.id,'Moment partagé',s,age);
    }
  }
}
relationship('joseph','marie').bond=78;
