const DT = 1 / 120;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Motor commands are learned. Goals are used only to score the outcome.
const motorLimits=[[0,28],[-46,24],[-19,7],[-52,52],[-22,16],[0,1.6],[.8,7],[0,11]];
const motorGoals=[
  {height:.22,duration:2.7,distance:0,hold:.65,balance:.54},
  {height:.18,duration:3.1,distance:.26,hold:.8,balance:.65},
  {height:.44,duration:4.3,distance:0,hold:1.65,balance:.36},
  {height:.45,duration:4.7,distance:.43,hold:1.6,balance:.39},
  {height:.46,duration:5.3,distance:.83,hold:2,balance:.4}
];
const emptyRecord=()=>({champions:[],recent:[],confirmed:0,attempts:0,mastered:false});
const MOTOR_VERSION=2;
const goals = ['Se redresser', 'Ramper', 'Tenir debout', 'Faire ses premiers pas', 'Marcher'];
const people = [
  ['joseph', -7, 1], ['marie', -4, 2], ['juliette', -5, -1],
  ['timeo', 8, 4], ['nathan', 10, 6], ['francoise', 12, 3], ['rose', 14, 5]
].map(([id,x,z])=>({id,x,z,homeX:x,homeZ:z,heading:0,phase:0,bond:0,inherited:0}));
const bounds = {x:19,z:12};
const milestones = [
  {motor:1000000, life:0, cognition:0, play:0, social:0},
  {motor:2300000, life:8, cognition:3, play:1, social:2},
  {motor:3800000, life:18, cognition:6, play:5, social:8},
  {motor:5600000, life:30, cognition:9, play:12, social:20},
  {motor:7900000, life:48, cognition:12, play:25, social:35},
  {motor:10500000, life:70, cognition:15, play:40, social:55},
  {motor:13600000, life:100, cognition:18, play:65, social:80}
];
const landmarks = [
  ['tapis',-8,2],['baie',-1,1],['table',-5,-3],['cuisine',-2,-4],
  ['salon',-8,-2],['couloir',-7,0],['lettre A',-8,3],['lettre L',-5,1],['lettre E',-3,2],
  ['lettre X',-1,2],['jardin',3,4],['chemin',5,3],['parc',8,5],['gravier',11,5],
  ['bordure',14,5],['bois',12,4]
];
let knowledge = {};
let counts = {life:0,cognition:0,play:0,social:0};
let journal = [];
let ticks=0, trials=0, pecm=0, skill=0, age=0, score=0, mode='human';
let records=goals.map(emptyRecord);
let alex={x:-6.7,z:2.6,heading:0,phase:0,pose:0,tilt:0,effort:0,hunger:.1,fatigue:.05,activity:'Premiers mouvements'};
let ball={x:9,z:7,vx:0,vz:0};
let park=null;
let house=null;
const kitchen={ingredients:8,meals:0,fridge:0,oven:0};
const household={};
const objectLearning={};
const cooks={};
let nextRefill=0, objectContact=null;
const HOUSE_EFFECTS={
  sofa:{name:'canapé',activity:'Se repose sur le canapé',duration:8},
  tv:{name:'télévision',activity:'Regarde la télévision',duration:7},
  book:{name:'livre',activity:'Feuillette le livre',duration:8},
  water:{name:'fontaine à eau',activity:'Boit à la fontaine',duration:4},
  shower:{name:'douche',activity:'Prend une douche',duration:9},
  dishwasher:{name:'lave-vaisselle',activity:'Fait tourner le lave-vaisselle',duration:7},
  fireplace:{name:'cheminée',activity:'Observe la cheminée allumée',duration:6}
};
const doorKnowledge={};
const doorStates={};
let trampolineCooldown=0;
let membrane=0;
let contact=null;
const rope={angle:0,angular:0};
const parkMemory={slide:0,rope:0,trampoline:0};
const equipmentSeen={slide:0,rope:0,trampoline:0};
const parkCooldown={slide:0,rope:0,trampoline:0};
let explorationTarget=null;
let nextChoice=0;
let progressAt=0, closestGoal=Infinity;
const curiosity={};
let eventClock=0, episode, lastWall=performance.now(), accumulator=0;
function note(message) {
  journal.unshift({message,ticks});
  journal = journal.slice(0,6);
}
function newEpisode() {
  const record=records[skill];
  const parent=record.champions[Math.floor(Math.random()*Math.min(3,record.champions.length))];
  const trial=record.attempts;
  const replay=record.confirmed>0&&trial%3===0;
  const noise=replay?.018:record.confirmed>0?.09:.21;
  const policy=motorLimits.map(([min,max],i)=>{
    if(!parent||(!replay&&trial%9===8))return min+Math.random()*(max-min);
    return clamp(parent.policy[i]+(Math.random()+Math.random()-1)*(max-min)*noise,min,max);
  });
  // Every trial starts down low, with a different lean and contact.
  const theta=(Math.random()<.5?-1:1)*(.22+Math.random()*.45);
  return {policy,time:0,theta,angular:0,height:.09+Math.random()*.025,vy:0,
    vx:0,distance:0,effort:0,phase:Math.random()*Math.PI*2,hold:0,longest:0,
    quality:0,energy:0,fallen:false,settle:0,traction:.79+Math.random()*.2,
    disturbance:(Math.random()-.5)*.85};
}
function motorStep(){
  const e=episode;
  const goal=motorGoals[skill];
  const [push,heightFeedback,verticalFeedback,leanFeedback,turnFeedback,alternation,frequency,stride]=e.policy;
  if(!e.fallen){
    e.phase+=frequency*DT;
    const rhythm=Math.sin(e.phase);
    const force=clamp(push+heightFeedback*e.height+verticalFeedback*e.vy+rhythm*alternation,0,28);
    const torque=clamp(leanFeedback*e.theta+turnFeedback*e.angular+rhythm*alternation,-15,15);
    const planted=Math.abs(e.theta)<.93&&e.height<.54;
    const rocking=9.81*Math.sin(e.theta)/(.27+e.height);
    e.angular+=(rocking+(planted?torque*2.8:0)-e.angular*.38+e.disturbance)*DT;
    e.theta+=e.angular*DT;
    e.vy+=(planted?force-9.81:-9.81)*DT;
    e.height+=e.vy*DT;
    if(e.height<.085){e.height=.085;e.vy=Math.max(0,-e.vy*.07);}
    if(e.height>.66){e.height=.66;e.vy=Math.min(0,e.vy);}
    const grounded=planted&&Math.abs(e.theta)<.58&&e.height>.1;
    e.vx+=((grounded?Math.max(0,rhythm)*stride*e.traction:0)-e.vx*(grounded?3.1:5.2))*DT;
    e.distance+=e.vx*DT;
    e.effort=rhythm*clamp(stride/7,0,1);
    e.energy+=(force*.014+Math.abs(torque)*.025+stride*.014)*DT;
    const heightError=Math.abs(goal.height-e.height);
    e.quality+=Math.exp(-heightError*8-Math.abs(e.theta)*1.9)*DT;
    const stable=heightError<(skill===1?.075:.10)&&Math.abs(e.theta)<goal.balance&&Math.abs(e.vy)<.34;
    e.hold=stable?e.hold+DT:0;
    e.longest=Math.max(e.longest,e.hold);
    e.fallen=Math.abs(e.theta)>1.04&&e.time>.24;
  }else{
    e.vy-=9.81*DT;
    e.height=Math.max(.085,e.height+e.vy*DT);
    e.theta+=(Math.sign(e.theta)*1.49-e.theta)*DT*9;
    e.effort=0;
    e.settle+=DT;
  }
  e.time+=DT;
  if(e.fallen?e.settle<.75:e.time<goal.duration)return;
  const record=records[skill];
  const stable=e.longest>=goal.hold;
  const valid=stable&&e.distance>=goal.distance&&!e.fallen;
  const movement=goal.distance>0?Math.min(e.distance/goal.distance,1.45):0;
  const reward=e.quality/goal.duration+Math.min(e.longest/goal.hold,1.6)*.58+
    movement*.35+(valid?.65:0)-(e.fallen?.38:0)-e.energy*.018;
  trials++;
  record.attempts++;
  record.champions.push({policy:e.policy,reward,valid});
  record.champions.sort((a,b)=>b.reward-a.reward);
  record.champions.length=Math.min(9,record.champions.length);
  record.recent.push(valid);
  if(record.recent.length>8)record.recent.shift();
  score=Math.round(clamp(e.longest/goal.hold,0,1)*100);
  if(valid){
    record.confirmed++;pecm++;
    if(record.confirmed===1)note('Alex trouve un geste qui fonctionne · '+goals[skill]+'.');
  }
  if(!record.mastered&&record.recent.filter(Boolean).length>=6){
    record.mastered=true;
    knowledge['motricité · '+goals[skill]]={visits:record.attempts,senses:['position','effort','équilibre'],type:'geste'};
    note('Alex a retrouvé et confirmé son geste · '+goals[skill]+'.');
    if(skill<4)skill++;
  }
  episode=newEpisode();
}
function learn(name, type) {
  const entry=knowledge[name] ||= {visits:0, senses:[], type};
  entry.visits++;
  if(entry.visits===1) entry.senses.push('vision');
  if(entry.visits===2) entry.senses.push('contact');
  if(entry.visits===3){
    entry.senses.push('mémoire');
    counts.cognition++;
    note('Alex associe vision et contact · '+name);
  }
}
function doorRecord(mechanism){
  return doorKnowledge[mechanism] ||= {seen:0,attempts:0,success:0,known:false,actions:[0,0,0]};
}
function validateDoor(mechanism,record){
  if(record.known)return;
  record.known=true;
  counts.cognition++;
  knowledge['ouverture '+mechanism]={visits:record.attempts+record.seen,senses:['vision','contact','mouvement'],type:'mécanisme'};
  note(mechanism==='coulissante'?'Alex sait maintenant faire coulisser la porte.':'Alex sait maintenant ouvrir une porte à charnière.');
}
function useDoor(p,door,s) {
  const state=doorStates[door.id];
  const parent=p.id==='joseph'||p.id==='marie';
  const record=doorRecord(door.mechanism);
  if(!parent&&p!==alex&&!record.known)return;
  if(s<(p.nextDoorTry||0)||state.amount>.2||state.until>s)return;
  p.nextDoorTry=s+1.5;
  if(p===alex&&!record.known){
    record.attempts++;
    const action=record.actions.indexOf(Math.min(...record.actions));
    record.actions[action]++;
    if(action!==door.action){
      if(record.attempts<=2)note('Alex essaie une autre prise sur la '+door.name+'.');
      return;
    }
    record.success++;
    if(record.success>=2)validateDoor(door.mechanism,record);
  }
  state.until=s+4.2;
  if(parent&&Math.hypot(alex.x-door.x,alex.z-door.z)<2.4&&!record.known){
    record.seen++;
    note((p.id==='joseph'?'Joseph':'Marie')+' ouvre la '+door.name+' sous les yeux d’Alex.');

  }
}
function stepKitchen(s){
  if(!house?.kitchen)return;
  if(s>=nextRefill){
    kitchen.ingredients=Math.min(8,kitchen.ingredients+1);
    nextRefill=s+19;
  }
  const wantsFridge=Object.values(cooks).some(cook=>cook.phase==='take');
  const wantsOven=Object.values(cooks).some(cook=>cook.phase==='cook');
  kitchen.fridge+=clamp((wantsFridge?1:0)-kitchen.fridge,-DT*2,DT*2);
  kitchen.oven=wantsOven?1:0;
}
function cookMeal(person,s){
  if(!house?.kitchen)return false;
  const cook=cooks[person.id] ||= {phase:'idle',next:s+(person.id==='joseph'?2:20)};
  const {fridge,stove}=house.kitchen;
  if(cook.phase==='idle'){
    if(s<cook.next||kitchen.ingredients===0||kitchen.meals>=5)return false;
    cook.phase='fetch';
  }
  if(cook.phase==='fetch'){
    person.activity='Va chercher des ingrédients';
    if(move(person,fridge.x,fridge.z,.95)<.16){
      cook.phase='take';
      cook.until=s+2.1;
    }
  }else if(cook.phase==='take'){
    person.activity='Ouvre le frigo';
    if(s>=cook.until){
      if(kitchen.ingredients>0){kitchen.ingredients--;cook.phase='stove';}
      else {cook.phase='idle';cook.next=s+8;}
    }
  }else if(cook.phase==='stove'){
    person.activity='Apporte les ingrédients au plan de travail';
    if(move(person,stove.x,stove.z,.95)<.16){cook.phase='cook';cook.until=s+10;}
  }else{
    person.activity='Prépare le repas';
    if(s>=cook.until){
      kitchen.meals=Math.min(6,kitchen.meals+2);
      note((person.id==='joseph'?'Joseph':'Marie')+' prépare deux portions dans la cuisine.');
      cook.phase='idle';
      cook.next=s+29;
    }
  }
  return true;
}
function tryHouseObject(id,s){
  const record=objectLearning[id] ||= {attempts:0,success:0,next:0};
  if(record.next>s)return;
  const item=HOUSE_EFFECTS[id];
  record.attempts++;
  record.next=s+20;
  // Alex tries actions independently. Success becomes knowledge only after repetition.
  const usableAction={sofa:0,tv:2,book:1,water:2,shower:2,dishwasher:2,fireplace:2}[id];
  const actions=record.actions ||= [0,0,0];
  const leastTried=Math.min(...actions);
  const options=actions.map((tries,action)=>tries===leastTried?action:null).filter(action=>action!==null);
  const action=Number.isInteger(record.successfulAction)?record.successfulAction:options[Math.floor(Math.random()*options.length)];
  actions[action]++;
  if(action!==usableAction){
    if(record.attempts===1)note('Alex essaie de comprendre '+item.name+'.');
    return;
  }
  record.successfulAction=action;
  objectContact={id,until:s+item.duration};
  household[id]=1;
  if(++record.success===2){
    counts.cognition++;
    knowledge[item.name]={visits:2,senses:['vision','contact','effet'],type:'objet',action,effect:item.activity};
    note('Alex découvre comment utiliser le matériel · '+item.name+'.');
  }
}
function stepHouseObject(s){
  if(!objectContact)return false;
  const {id,until}=objectContact;
  alex.activity=HOUSE_EFFECTS[id].activity;
  alex.pose=id==='sofa'?.64:.12;
  alex.y=id==='sofa'?.37:0;
  alex.effort=0;
  if(s>=until){
    if(id==='sofa')alex.fatigue=Math.max(.05,alex.fatigue-.44);
    if(id==='water')alex.thirst=.06;
    if(id==='shower')alex.hygiene=1;
    counts.life++;
    household[id]=0;
    objectContact=null;
  }
  return true;
}
function stepDoors(s){
  if(!house)return;
  for(const door of house.doors){
    const state=doorStates[door.id];
    const occupied=[alex,...people].some(p=>Math.abs(p.x-door.x)<door.width/2+.12&&Math.abs(p.z-door.z)<.28);
    const target=state.until>s||occupied&&state.amount>.72?1:0;
    state.amount+=clamp(target-state.amount,-DT*1.75,DT*1.75);
  }
}
function move(p,x,z,speed) {
  const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);
  if(d<.09)return d;
  const step=Math.min(d,speed*DT);
  const nextX=clamp(p.x+dx/d*step,-bounds.x+.5,bounds.x-.5);
  const nextZ=clamp(p.z+dz/d*step,-bounds.z+.5,bounds.z-.5);
  for(const door of house?.doors||[]){
    if(Math.abs(p.x-door.x)>door.width/2+.13||Math.abs(p.z-door.z)>.58)continue;
    useDoor(p,door,ticks*DT);
    if(door.passage&&doorStates[door.id].amount<.78){
      const side=Math.sign(p.z-door.z)||1;
      if(side*(nextZ-door.z)<.14&&Math.abs(nextZ-door.z)<Math.abs(p.z-door.z))return d;
    }
  }
  p.x=nextX;
  p.z=nextZ;
  p.heading=Math.atan2(dx,dz);
  p.phase+=step*8;
  return d;
}
function slideSurface(x) {
  const points=park.slide;
  const i=points.findIndex(point=>point.x>=x);
  const right=points[Math.max(1,i<0?points.length-1:i)];
  const left=points[Math.max(0,i<0?points.length-2:i-1)];
  const slope=(right.y-left.y)/(right.x-left.x);
  return {y:left.y+slope*(x-left.x),slope};
}
function ropeEnd() {
  const {x,y,z,length}=park.rope;
  return {x:x+Math.sin(rope.angle)*length,y:y-Math.cos(rope.angle)*length,z};
}
function parkObservation(id,message) {
  parkMemory[id]++;
  counts.play++;
  if(parkMemory[id]===1) {
    counts.cognition++;
    knowledge[{slide:'toboggan',rope:'corde',trampoline:'trampoline'}[id]]={visits:1,senses:['vision','contact','mouvement'],type:'jeu'};
    note(message);
  }
}
function stepTrampoline(s){
  if(contact?.kind!=='trampoline'){
    membrane*=Math.exp(-DT*14);
    return false;
  }
  const bed=house.trampoline;
  const t=contact;
  t.time+=DT;
  if(t.mount){
    const step=DT*.92;
    alex.z=Math.min(bed.z,alex.z+step);
    alex.y=Math.min(bed.y,(alex.y||0)+step*.9);
    alex.activity='Monte sur le trampoline';
    alex.pose=.27;
    if(alex.z>=bed.z-.08){t.mount=false;alex.y=bed.y;t.velocity=2.6;t.time=0;}
    return true;
  }
  const mass=12+age*6;
  const compression=Math.max(0,bed.y-alex.y);
  const reaction=compression>0?Math.max(0,3200*compression-62*t.velocity):0;
  const previouslyInContact=t.touching;
  t.touching=compression>0;
  if(t.touching&&!previouslyInContact)t.landings++;
  if(previouslyInContact&&!t.touching&&t.landings<5&&t.velocity>0)t.velocity+=1.15;
  t.velocity+=(reaction/mass-9.81)*DT;
  alex.y+=t.velocity*DT;
  membrane=Math.min(.42,compression);
  alex.activity=alex.y>bed.y+.1?'Saute sur le trampoline':'Rebondit sur la toile';
  alex.pose=clamp(.12+compression*1.3,0,.72);
  alex.tilt=0;
  alex.effort=0;
  if(t.landings>=5&&compression>0&&Math.abs(t.velocity)<.25||t.time>10){
    if(t.landings>=2)parkObservation('trampoline','Alex découvre que la toile se tend sous son poids et le fait rebondir.');
    trampolineCooldown=s+90;
    contact={kind:'trampoline-exit'};
  }
  return true;
}
function leaveTrampoline(){
  const bed=house.trampoline;
  alex.z-=DT*.95;
  alex.activity='Descend du trampoline';
  if(alex.z<=bed.entryZ+.35)alex.y=Math.max(0,alex.y-DT*2.1);
  membrane*=Math.exp(-DT*14);
  if(alex.z<=bed.entryZ-.15&&alex.y<=0)contact=null;
  return true;
}
function stepPark(s) {
  if(contact?.kind==='trampoline-exit')return leaveTrampoline();
  if(stepTrampoline(s))return true;
  if(!park)return false;
  const hanging=contact?.kind==='rope';
  const acceleration=-9.81/park.rope.length*Math.sin(rope.angle)-rope.angular*(hanging?.45:1.1);
  rope.angular+=acceleration*DT;
  rope.angle+=rope.angular*DT;
  if(!contact)return false;
  if(contact.kind==='rope'){
    const end=ropeEnd();
    alex.x=end.x;alex.z=end.z;alex.y=Math.max(0,end.y-.21);
    alex.activity='Se suspend à la corde';
    alex.pose=.17;alex.tilt=-rope.angle;alex.effort=0;
    if(s>=contact.release){
      parkObservation('rope','Alex découvre que son poids fait osciller la corde.');
      parkCooldown.rope=s+28;
      contact=null;
    }
    return true;
  }
  const top=park.slide[0], bottom=park.slide.at(-1);
  if(contact.kind==='climb'){
    alex.activity='Remonte la pente du toboggan';
    alex.x=Math.max(top.x,alex.x-DT*.52);
    alex.heading=-Math.PI/2;
    alex.phase+=DT*7;
    if(alex.x<=top.x)contact={kind:'slide',velocity:.25};
  }else{
    alex.activity='Glisse sur le toboggan';
    const {slope}=slideSurface(alex.x);
    const normal=Math.hypot(1,slope);
    contact.velocity=Math.max(.12,contact.velocity+DT*(-9.81*slope/normal-.18*9.81/normal));
    alex.x=Math.min(bottom.x,alex.x+contact.velocity/normal*DT);
    alex.heading=Math.PI/2;
    if(alex.x>=bottom.x){
      parkObservation('slide','Alex découvre que la pente accélère sa descente.');
      parkCooldown.slide=s+33;
      contact=null;
    }
  }
  alex.z=bottom.z;alex.y=slideSurface(alex.x).y;
  alex.pose=contact?.kind==='climb'?.38:.66;
  alex.tilt=0;alex.effort=0;
  return true;
}
function tryEquipment(s) {
  const items=[];
  if(park&&alex.x>=4){
    const bottom=park.slide.at(-1),end=ropeEnd();
    items.push({id:'slide',name:'toboggan',x:bottom.x,z:bottom.z},{id:'rope',name:'corde',x:end.x,z:end.z});
  }
  if(house&&s>=trampolineCooldown){
    const bed=house.trampoline;
    items.push({id:'trampoline',name:'trampoline',x:bed.x,z:bed.entryZ});
  }
  let best=null;
  let bestScore=.04;
  for(const item of items){
    const distance=Math.hypot(item.x-alex.x,item.z-alex.z);
    if(distance>4||s<parkCooldown[item.id])continue;
    if(equipmentSeen[item.id]===0){
      equipmentSeen[item.id]=1;
      note('Alex remarque '+({slide:'le toboggan.',rope:'la corde.',trampoline:'le trampoline.'}[item.id]));
    }
    const value=(1+.25*Math.log1p(parkMemory[item.id]))/(1+distance*distance);
    if(value>bestScore){bestScore=value;best=item;}
  }
  return best;
}
function beginEquipment(item,s){
  if(item.id==='trampoline'){
    contact={kind:'trampoline',mount:true,time:0,velocity:0,landings:0,touching:false};
    alex.x=house.trampoline.x;alex.z=house.trampoline.entryZ;
    alex.heading=0;
  }else if(item.id==='slide'){
    contact={kind:'climb'};
    alex.x=park.slide.at(-1).x;
    alex.z=park.slide.at(-1).z;
  }else{
    const direction=Math.sin(alex.heading)||1;
    rope.angular+=direction*.87;
    contact={kind:'rope',release:s+2.3};
  }
}
function makeGoalOptions(){
  const options=landmarks.map(([name,x,z])=>({name,x,z,category:'exploration'}));
  if(house){
    options.push({name:'terrasse',x:house.trampoline.x,z:house.trampoline.entryZ,category:'exploration'});
    for(const [id,point] of Object.entries(house.objects)){
      options.push({...point,name:HOUSE_EFFECTS[id].name,id,category:'objet'});
    }
    for(const door of house.doors){
      options.push({name:'poignée de '+door.name,x:door.x,z:door.z+(alex.z<door.z?-.24:.24),category:'exploration'});
    }
  }
  for(const person of people){
    options.push({name:person.id,x:person.x,z:person.z,category:'social',person});
  }
  if(alex.x>4)options.push({name:'balle',x:ball.x,z:ball.z,category:'jeu'});
  return options;
}
function curiosityRecord(name){
  return curiosity[name] ||= {choices:0,completed:0,blocked:0,retryAt:0};
}
function chooseGoal(s){
  const options=makeGoalOptions();
  let candidates=options.filter(goal=>
    Math.hypot(goal.x-alex.x,goal.z-alex.z)<(age>2?14:9)&&curiosityRecord(goal.name).retryAt<=s);
  if(!candidates.length)candidates=options.filter(goal=>curiosityRecord(goal.name).retryAt<=s);
  if(!candidates.length)return null;
  const interest=goal=>{
    const record=curiosityRecord(goal.name);
    const observations=knowledge[goal.name]?.visits||0;
    const novelty=1.7/(1+observations+record.completed);
    const unfinished=record.choices>0&&record.completed===0?.32:0;
    const distance=Math.hypot(goal.x-alex.x,goal.z-alex.z);
    return (novelty+unfinished+.23)/(1+distance*.115+record.blocked*.12);
  };
  let pick=Math.random()*candidates.reduce((sum,goal)=>sum+interest(goal),0);
  const selected=candidates.find(goal=>(pick-=interest(goal))<=0)||candidates[0];
  curiosityRecord(selected.name).choices++;
  nextChoice=s+46;
  progressAt=s;
  closestGoal=Infinity;
  return selected;
}
function finishGoal(s,completed){
  if(!explorationTarget)return;
  const record=curiosityRecord(explorationTarget.name);
  if(completed)record.completed++;
  else record.blocked++;
  record.retryAt=s+(completed?50:20);
  explorationTarget=null;
}
function experience() {
  alex.hunger=clamp(alex.hunger+DT*.002,0,1);
  alex.fatigue=clamp(alex.fatigue+DT*.0015,0,1);
  const s=ticks*DT;
  stepDoors(s);
  stepKitchen(s);
  alex.thirst=clamp((alex.thirst??.15)+DT*.002,0,1);
  alex.hygiene=clamp((alex.hygiene??.9)-DT*.00065,0,1);
  const usingEquipment=stepHouseObject(s)||stepPark(s);
  if(!usingEquipment){
  alex.y=Math.max(0,(alex.y||0)-DT*2.8);
  if(skill===4 && records[4].mastered){
    if(explorationTarget&&explorationTarget.person){
      explorationTarget.x=explorationTarget.person.x;
      explorationTarget.z=explorationTarget.person.z;
    }
    if(explorationTarget?.category==='jeu'){
      explorationTarget.x=ball.x;
      explorationTarget.z=ball.z;
    }
    if(explorationTarget&&s>=nextChoice)finishGoal(s,false);
    explorationTarget ||= chooseGoal(s);
    const intention=explorationTarget;
    const friend=intention?.person;
    let goal=intention?[intention.name,intention.x,intention.z,intention.id]:['observe',alex.x,alex.z];
    let category=intention?.category||'observation';
    const equipment=tryEquipment(s);
    const objects=house?.objects;
    if(alex.hunger>.66&&house?.kitchen&&kitchen.meals>0){
      goal=['repas',house.kitchen.stove.x,house.kitchen.stove.z];category='repas';
    }else if(alex.thirst>.7&&objects?.water&&(objectLearning.water?.next||0)<=s){
      goal=['eau',objects.water.x,objects.water.z,'water'];category='objet';
    }else if(alex.fatigue>.74&&objects?.sofa&&(objectLearning.sofa?.next||0)<=s){
      goal=['canapé',objects.sofa.x,objects.sofa.z,'sofa'];category='objet';
    }else if(alex.hygiene<.25&&objects?.shower&&(objectLearning.shower?.next||0)<=s){
      goal=['douche',objects.shower.x,objects.shower.z,'shower'];category='objet';
    }else if(alex.hunger>.86&&!house){goal=['repas',-2,-4];category='repas';}
    else if(alex.fatigue>.74){goal=['repos',-7,2];category='repos';}
    else if(equipment){goal=[equipment.name,equipment.x,equipment.z];category='équipement';}
    alex.activity=category==='objet'?'Explore · '+goal[0]:category==='exploration'?'Explore · '+goal[0]:category==='social'?'Rencontre · '+goal[0]:category==='équipement'?'Observe · '+goal[0]:category;
    let [destinationX,destinationZ]=goal.slice(1);
    const crossing=(alex.x<-.5)!==(destinationX<-.5);
    if(crossing&&Math.abs(alex.z-4)>.45){
      destinationX=alex.x;
      destinationZ=4;
    }else if(crossing)destinationZ=4;
    const entrance=house?.doors.find(door=>door.id==='breezeway');
    if(entrance&&alex.x<-.5&&goal[1]<-.5){
      const side=Math.sign(alex.z-entrance.z)||-1;
      const targetSide=Math.sign(goal[2]-entrance.z)||side;
      if((side!==targetSide||Math.abs(alex.z-entrance.z)<.30)&&Math.abs(goal[2]-entrance.z)>.3){
        destinationX=entrance.x;
        destinationZ=Math.abs(alex.x-entrance.x)>.17&&Math.abs(alex.z-entrance.z)>.15?
          alex.z:entrance.z+targetSide*.48;
      }
    }
    const learnedStride=records[4].champions.find(candidate=>candidate.valid)?.policy[7]||0;
    const near=move(alex,destinationX,destinationZ,clamp(learnedStride*.17,.24,1.35));
    if(category==='équipement'&&Math.hypot(alex.x-goal[1],alex.z-goal[2])<.23) beginEquipment(equipment,s);
    const pursuingIntention=intention&&goal[0]===intention.name&&category===intention.category;
    if(pursuingIntention){
      const distance=Math.hypot(alex.x-goal[1],alex.z-goal[2]);
      if(distance<closestGoal-.16){closestGoal=distance;progressAt=s;}
      if(distance>1&&s-progressAt>22)finishGoal(s,false);
    }
    if(category==='objet'&&Math.hypot(alex.x-goal[1],alex.z-goal[2])<.22){
      tryHouseObject(goal[3],s);
      if(objectContact&&pursuingIntention)finishGoal(s,true);
    }
    if(category!=='observation'&&category!=='objet'&&category!=='équipement'&&near<1 && Math.hypot(alex.x-goal[1],alex.z-goal[2])<1 && s>=eventClock){
      eventClock=s+3;
      learn(goal[0],category);
      if(pursuingIntention)finishGoal(s,true);
      if(category==='repas'||category==='repos'){
        counts.life++;
        if(category==='repas'){
          if(house&&kitchen.meals===0)return;
          if(house)kitchen.meals--;
          alex.hunger=.08;
        }else alex.fatigue=.06;
        note(category==='repas'?'Alex prend un repas.':'Alex se repose.');
      }
      if(category==='social'){
        counts.social++; friend.bond++;
        if(friend.id==='marie'||friend.id==='joseph') note('Un câlin apaise Alex.');
      }
      if(category==='jeu'){
        counts.play++;
        ball.vx=Math.sin(alex.heading)*2;ball.vz=Math.cos(alex.heading)*2;
      }
    }
    alex.pose=0;
    alex.tilt=0;
    alex.effort=Math.sin(alex.phase)*.65;
  }else{
    alex.activity=episode.fallen?'Perd l’équilibre · recommence ensuite':goals[skill];
    alex.pose=clamp(1-(episode.height-.085)/.40,0,1);
    alex.tilt=episode.fallen?Math.sign(episode.theta)*1.25:episode.theta;
    alex.effort=episode.effort;
    alex.phase=episode.phase;
    if((skill===1||skill>=3)&&!episode.fallen){
      const center=alex.practiceZ??=alex.z;
      if(!episode.direction)episode.direction=alex.z>=center?-1:1;
      alex.z=clamp(alex.z+episode.direction*Math.min(.42,episode.vx)*DT,Math.max(-11.5,center-.8),Math.min(11.5,center+.8));
    }
  }
  }
  for(let i=0;i<people.length;i++){
    const p=people[i];
    p.activity='Se déplace';
    if(i<2&&cookMeal(p,s))continue;
    let goalX=p.homeX+Math.sin(s*.21+i)*1.1;
    let goalZ=p.homeZ+Math.cos(s*.18+i)*1.2;
    if(house&&i<3){
      const cycle=(s+i*20)%95;
      if(cycle<42){
        const door=house.doors[(Math.floor((s+i*20)/95)+i)%house.doors.length];
        goalX=door.x;
        goalZ=door.z+(door.passage&&cycle>24?.64:-.34);
      }
    }
    move(p,goalX,goalZ,.75);
    if((i<2&&age>=5)||(i>=2&&Object.keys(knowledge).length>i))p.inherited=counts.cognition;
    if(i>=3 && Math.hypot(p.x-ball.x,p.z-ball.z)<.65 && Math.hypot(ball.vx,ball.vz)<1.1){
      ball.vx=Math.sin(p.heading)*1.7; ball.vz=Math.cos(p.heading)*1.7;
    }
  }
  ball.x+=ball.vx*DT;ball.z+=ball.vz*DT;
  if(ball.x>18.5||ball.x<5){ball.x=clamp(ball.x,5,18.5);ball.vx*=-.65;}
  if(Math.abs(ball.z)>11.5){ball.z=clamp(ball.z,-11.5,11.5);ball.vz*=-.65;}
  ball.vx*=Math.exp(-DT*.9);ball.vz*=Math.exp(-DT*.9);
  const gate=milestones[age];
  if(gate&&skill===4&&pecm>=gate.motor&&Object.keys(counts).every(key=>counts[key]>=gate[key])){
    age++;note('Nouveau stade de développement · '+(age+1));
  }
}
function snapshot() {
  return {ticks,trials,pecm,skill,age,score,alex,people,ball,counts,journal,mode,ropeEnd:park?ropeEnd():null,doors:doorStates,membrane,kitchen,household,validated:records[4].confirmed};
}
function save() {
  return {motorVersion:MOTOR_VERSION,ticks,trials,pecm,skill,age,score,alex,people,ball,counts,journal,records,knowledge,eventClock,parkMemory,equipmentSeen,doorKnowledge,kitchen,objectLearning,nextRefill,curiosity};
}
onmessage=({data})=>{
  if(data.type==='house'){
    house=data.geometry;
    for(const door of house.doors)doorStates[door.id]||={amount:0,until:0};
  }
  if(data.type==='park'&&data.geometry.slide.length>1)park=data.geometry;
  if(data.type==='mode'){mode=data.mode;accumulator=0;lastWall=performance.now();}
  if(data.type==='restore'&&data.state){
    const s=data.state;
    if(!Array.isArray(s.records)||s.records.length!==5||!Number.isFinite(s.ticks))return;
    ({ticks,trials,pecm,skill,age,score,counts,journal,records,knowledge,eventClock}=s);
    if(s.motorVersion!==MOTOR_VERSION)records=goals.map((_,i)=>({
      ...emptyRecord(), mastered:i<skill, confirmed:i<skill?(s.records[i]?.confirmed||0):0
    }));
    Object.assign(curiosity,s.curiosity);
    Object.assign(alex,s.alex);
    Object.assign(parkMemory,s.parkMemory);
    Object.assign(doorKnowledge,s.doorKnowledge);
    Object.assign(kitchen,s.kitchen);
    Object.assign(objectLearning,s.objectLearning);
    nextRefill=Number.isFinite(s.nextRefill)?s.nextRefill:0;
    Object.assign(equipmentSeen,s.equipmentSeen);
    Object.assign(ball,s.ball);
    people.forEach((p,i)=>Object.assign(p,s.people[i]));
    episode=newEpisode();
  }
};
episode=newEpisode();
note('Alex commence à explorer ses mouvements.');
let lastPost=0,lastSave=0;
function run(){
  const now=performance.now();
  accumulator+=Math.min(.1,(now-lastWall)/1000);
  lastWall=now;
  if(mode==='human'){
    while(accumulator>=DT){ticks++;motorStep();experience();accumulator-=DT;}
  }else{
    accumulator=0;
    const deadline=performance.now()+11;
    do {
      for(let n=0;n<96;n++){
        ticks++;motorStep();
        if(ticks%4===0)for(let j=0;j<4;j++)experience();
      }
    }while(performance.now()<deadline);
  }
  if(now-lastPost>32){postMessage({type:'state',state:snapshot()});lastPost=now;}
  if(now-lastSave>4500){postMessage({type:'save',state:save()});lastSave=now;}
  setTimeout(run,mode==='human'?8:0);
}
run();
