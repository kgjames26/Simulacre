const playgroundFriends=['timeo','nathan','francoise','rose'];
const socialStyle={
  alex:{outreach:.64,care:.58},joseph:{outreach:.49,care:.83},marie:{outreach:.77,care:.92},
  juliette:{outreach:.58,care:.68},timeo:{outreach:.88,care:.62},nathan:{outreach:.61,care:.72},
  francoise:{outreach:.54,care:.82},rose:{outreach:.72,care:.76}
};
const adultCircle=new Set(['alex',...playgroundFriends]);
const female=new Set(['francoise','rose']);
let relationships={};
const relationshipCooldown={};
function isCourtshipEligible(a,b,age){
  return age>=7&&a!==b&&adultCircle.has(a)&&adultCircle.has(b)&&female.has(a)!==female.has(b);
}
function relationship(a,b){
  const key=[a,b].sort().join(':');
  return relationships[key]||={
    a,b,bond:0,romance:0,couple:key==='joseph:marie',met:0,history:[]
  };
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
  if(data.couple)event=data.met%2===0?'Moment tendre en couple':'Attention entre partenaires';
  else if(isCourtshipEligible(a,b,age)&&data.bond>=30&&Math.random()<(style.outreach+other.outreach)*.3){
    data.romance=Math.min(100,data.romance+5);
    event='Rapprochement affectif';
  }
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
