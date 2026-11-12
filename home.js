const residents=[alex,...people.slice(0,3)];
const residentNames={alex:'Alex',joseph:'Joseph',marie:'Marie',juliette:'Juliette'};
const floorHeight=1.9525;
const sleeps=new Map();

function takeServing(person){
  if(!kitchen.meals)return false;
  const quality=kitchen.servings.shift()??.62;
  kitchen.meals--;
  person.hunger=.08;
  person.pleasure=clamp((person.pleasure||0)+quality*.48,0,1);
  const name=residentNames[person.id||'alex'];
  if(person===alex){
    knowledge['goût du repas']={visits:(knowledge['goût du repas']?.visits||0)+1,
      senses:['goût','odorat'],type:'sensation',pleasure:quality};
  }
  note(name+(quality>=.75?' apprécie le goût du repas bien cuisiné.':' mange le repas préparé.'));
  return true;
}

const recipe=[
  ['fridge','Sort les ingrédients du frigo',1.8],
  ['cupboard','Prend un plat dans le placard',1.2],
  ['sink','Rince les légumes à l’évier',2.6],
  ['drawer','Prend les ustensiles dans le tiroir',1.1],
  ['counter','Prépare les ingrédients sur le plan de travail',4],
  ['hob','Fait revenir les ingrédients sur la plaque',4],
  ['oven','Enfourne et surveille la cuisson',12],
  ['serve','Dresse deux portions sur le comptoir',2],
  ['dishwasher','Charge et démarre le lave-vaisselle',2]
];
let kitchenOwner=null;
function stepKitchen(s){
  if(!house?.kitchen)return;
  if(s>=nextRefill){
    kitchen.ingredients=Math.min(8,kitchen.ingredients+1);
    nextRefill=s+19;
  }
  const running=kitchenOwner&&cooks[kitchenOwner];
  const station=running?.until?recipe[running.step][0]:null;
  kitchen.fridge+=clamp(Number(station==='fridge')-kitchen.fridge,-DT*2,DT*2);
  kitchen.oven=station==='oven'?1:0;
  kitchen.hob=station==='hob'?1:0;
  kitchen.sink=station==='sink'?1:0;
  kitchen.dishwasher=Number(s<(kitchen.washUntil||0));
  kitchen.ovenTemperature+=( (kitchen.oven?185:22)-kitchen.ovenTemperature)*DT*(kitchen.oven?.23:.052);
  if(kitchen.oven)running.temperature+=(kitchen.ovenTemperature-running.temperature)*DT*.42;
  if(kitchen.hob)running.temperature+=(68-running.temperature)*DT*.68;
  if(kitchen.oven&&running.temperature>80)running.cooked+=DT;
}
function releaseKitchen(person,s){
  const cook=cooks[person.id];
  cook.next=s+32;
  cook.step=0;
  cook.until=0;
  kitchenOwner=null;
}
function cookMeal(person,s){
  if(!house?.kitchen)return false;
  const cook=cooks[person.id] ||= {step:0,next:s+(person.id==='joseph'?2:18),until:0};
  if(!kitchenOwner&&s>=cook.next&&kitchen.ingredients&&kitchen.meals<=4){
    kitchenOwner=person.id;
    Object.assign(cook,{temperature:5,cooked:0,washed:false,prepared:false,deadline:s+45});
  }
  if(kitchenOwner!==person.id)return false;
  const [station,activity,duration]=recipe[cook.step];
  const target=house.kitchen[station];
  if(s>=cook.deadline){releaseKitchen(person,s);return false;}
  if(!cook.until){
    person.activity='Se rend au poste de cuisine';
    if(move(person,target.x,target.z,.92)>.14)return true;
    person.heading=target.heading;
    cook.until=s+duration;
  }
  person.activity=activity;
  if(s<cook.until)return true;
  if(station==='fridge')kitchen.ingredients--;
  if(station==='sink')cook.washed=true;
  if(station==='counter')cook.prepared=true;
  if(station==='oven'){
    cook.quality=clamp(.24+Number(cook.washed)*.12+Number(cook.prepared)*.16+
      .47*Math.exp(-(((cook.cooked-8)/5)**2)),0,1);
    kitchen.lastQuality=cook.quality;
  }
  if(station==='serve'){
    kitchen.servings.push(cook.quality,cook.quality);
    kitchen.meals=kitchen.servings.length;
    note(residentNames[person.id]+' prépare deux portions.');
  }
  if(station==='dishwasher'){
    kitchen.washUntil=s+16;
    releaseKitchen(person,s);
  }else{
    cook.step++;
    cook.until=0;
    cook.deadline=s+33;
  }
  return true;
}

function traverseStairs(person,sleep,direction){
  const steps=house.stairs;
  const target=steps[sleep.stair];
  const dx=target.x-person.x,dz=target.z-person.z;
  const d=Math.hypot(dx,dz);
  if(d<.009){
    person.x=target.x;person.z=target.z;person.y=target.y;
    sleep.stair+=direction;
    if(sleep.stair<0||sleep.stair>=steps.length){
      person.floor=direction===1?1:0;
      person.y=direction===1?floorHeight:0;
      sleep.phase=direction===1?'bed':'finished';
    }
    return;
  }
  const amount=Math.min(1,DT*.64/d);
  person.x+=dx*amount;
  person.z+=dz*amount;
  person.y+=(target.y-person.y)*amount;
  person.heading=Math.atan2(dx,dz);
  person.phase+=DT*5;
  person.moving=true;
}

function chooseBed(person){
  const taken=new Set([...sleeps.values()].map(sleep=>sleep.bed));
  const upstairs=person.id==='joseph'||person.id==='marie';
  return house.beds.find(bed=>bed.floor===Number(upstairs)&&!taken.has(bed))||
    house.beds.find(bed=>bed.floor===0&&!taken.has(bed));
}
function sleeping(person,s,canWalk=true){
  if(!house?.beds.length)return false;
  const id=person.id||'alex';
  const sleep=sleeps.get(person);
  if(!sleep){
    if(person.fatigue<.76||s<(person.sleepRetry||0))return false;
    if(kitchenOwner===id)return false;
    const bed=chooseBed(person);
    const carrier=canWalk?null:people.slice(0,2).find(parent=>!parent.floor&&!sleeps.has(parent)&&parent.id!==kitchenOwner);
    if(!bed||!canWalk&&!carrier)return false;
    sleeps.set(person,{bed,carrier,phase:carrier?'pickup':bed.floor?'stairs-start':'bed',until:s+80});
    return true;
  }
  const {bed,carrier}=sleep;
  const movePerson=carrier||person;
  const speed=person===alex&&!carrier ? .58 : .86;
  if(!['sleep','rise','down','exit','finished'].includes(sleep.phase)&&s>=sleep.until){
    if(person.floor){sleep.phase='exit';sleep.until=s+90;}
    else {sleeps.delete(person);person.sleepRetry=s+22;return false;}
  }
  if(sleep.phase==='pickup'){
    person.activity='Se fatigue';
    carrier.activity='Va chercher Alex';
    if(move(carrier,person.x,person.z,.83)<.24)sleep.phase='bed';
  }else if(sleep.phase==='stairs-start'){
    person.activity='Va vers l’escalier';
    const bottom=house.stairs[0];
    if(move(person,bottom.x,bottom.z,speed)<.075){sleep.phase='up';sleep.stair=0;}
  }else if(sleep.phase==='up'||sleep.phase==='down'){
    person.activity=sleep.phase==='up'?'Monte l’escalier':'Descend l’escalier';
    traverseStairs(person,sleep,sleep.phase==='up'?1:-1);
  }else if(sleep.phase==='bed'){
    person.activity=carrier?'Est porté vers son lit':'Va se coucher';
    if(carrier)carrier.activity='Porte Alex vers son lit';
    if(move(movePerson,bed.approach.x,bed.approach.z,speed)<.075){
      sleep.phase='settle';
      sleep.started=s;
      sleep.start={x:movePerson.x,z:movePerson.z,y:person.floor?floorHeight:0};
    }
    if(carrier){person.x=carrier.x;person.z=carrier.z;person.y=.62;person.heading=carrier.heading;}
  }else if(sleep.phase==='settle'||sleep.phase==='rise'){
    const rising=sleep.phase==='rise';
    const fraction=clamp((s-sleep.started)/1.35,0,1);
    const amount=rising?1-fraction:fraction;
    const from=sleep.start;
    person.x=from.x+(bed.x-from.x)*amount;
    person.z=from.z+(bed.z-from.z)*amount;
    person.y=from.y+(bed.y-from.y)*amount;
    person.heading=bed.heading;
    person.lie=amount;
    person.pose=0;person.tilt=0;person.effort=0;
    person.activity=rising?'Se relève du lit':'S’allonge sur le lit';
    if(fraction===1){
      sleep.phase=rising?(bed.floor?'exit':'finished'):'sleep';
      sleep.until=s+(person===alex?42:35);
      if(!rising)note(residentNames[id]+' s’endort dans un lit.');
    }
  }else if(sleep.phase==='sleep'){
    person.activity='Dort dans son lit';
    person.fatigue=Math.max(.025,person.fatigue-DT*.028);
    if(s>=sleep.until){
      sleep.phase='rise';sleep.started=s;
      if(person===alex){counts.life++;note('Alex se réveille reposé.');}
    }
  }else if(sleep.phase==='exit'){
    person.activity='Retourne à l’escalier';
    const top=house.stairs.at(-1);
    if(move(person,top.x,top.z,speed)<.075){sleep.phase='down';sleep.stair=house.stairs.length-1;}
  }else{
    person.lie=0;
    sleeps.delete(person);
    person.sleepRetry=s+35;
  }
  return true;
}

const doorHelp=new Map();
function askDoorHelp(person,door){
  if(person.id!=='juliette'&&person!==alex)return;
  if(!sleeps.has(person))return;
  const parent=people.slice(0,2).find(p=>!sleeps.has(p)&&p.id!==kitchenOwner&&
    (p.floor||0)===(door.floor||0)&&(!doorHelp.has(p)||doorHelp.get(p).door===door));
  if(parent&&!doorHelp.has(parent))doorHelp.set(parent,{door,person,until:ticks*DT+26});
}
function assistAtDoor(parent,s){
  const request=doorHelp.get(parent);
  if(!request)return false;
  const {person,door,until}=request;
  if(s>=until||!sleeps.has(person)||!doorNear(person,door,.70,.28)){
    doorHelp.delete(parent);
    return false;
  }
  parent.activity='Va ouvrir la porte';
  if(Math.hypot(parent.x-door.x,parent.z-door.z)<.47){
    useDoor(parent,door,s);
  }else{
    move(parent,door.x,door.z,.95);
  }
  return true;
}

function resetRestPosition(person){
  const floor=person.floor||0;
  const start=navigation.nearest(person.x,person.z,floor,null,1.4);
  if(start>=0&&!navigation.isFree(person.x,person.z,floor))Object.assign(person,navigation.point(start));
  person.lie=0;
  if(!floor)person.y=0;
  if(floor){person.y=floorHeight;sleeps.set(person,{bed:house.beds.find(bed=>bed.floor),phase:'exit'});}
}
