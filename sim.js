importScripts('/dialogue.js','/collision-map.js','/navigation.js','/motor.js','/play.js','/social.js','/french-words.js');
const dialogue=createDialogue();
const languageScene={points:{},visible:languageVisibility, invitations:[Object.assign(playItems.toy,{id:'toy'}),Object.assign(playItems.bikeHome,{id:'bikeHome'})]};
const DT = 1 / 120;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const motorGoals=[
  {height:.175,duration:3.2,distance:0,hold:.32,balance:1.38},
  {height:.115,duration:4.4,distance:.115,hold:.24,balance:2.5},
  {height:.218,duration:5,distance:0,hold:.47,balance:.61},
  {height:.214,duration:6.4,distance:.075,hold:.45,balance:.65,strikes:2},
  {height:.22,duration:8,distance:.18,hold:.70,balance:.65,strikes:4}
];
const emptyRecord=()=>({champions:[],recent:[],confirmed:0,attempts:0,mastered:false});
const MOTOR_VERSION=3;
const JOINT_CHANNELS=11;
const neutralJoints=()=>Array.from({length:2*JOINT_CHANNELS},()=>0);
const goals = ['Se redresser', 'Ramper', 'Tenir debout', 'Faire ses premiers pas', 'Marcher'];
const people = [
  ['joseph', -7, 1], ['marie', -4, 2], ['juliette', -5, 1.45],
  ['timeo', 8, 4], ['nathan', 10, 6], ['francoise', 12, 3], ['rose', 14, 5]
].map(([id,x,z])=>({id,x,z,homeX:x,homeZ:z,heading:0,phase:0,bond:0,inherited:0}));
const bounds = {x:19,z:12};
const milestones = [
  {motor:35, life:0, cognition:0, play:0, social:0},
  {motor:62, life:8, cognition:3, play:1, social:2},
  {motor:92, life:18, cognition:6, play:5, social:8},
  {motor:125, life:30, cognition:9, play:12, social:20},
  {motor:170, life:48, cognition:12, play:25, social:35},
  {motor:220, life:70, cognition:15, play:40, social:55},
  {motor:280, life:100, cognition:18, play:65, social:80},
  {motor:400, life:150, cognition:25, play:100, social:120}
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
let interactions = [];
let ticks=0, trials=0, pecm=0, skill=0, age=0, score=0, mode='human';
let nextParentCare=0;
let records=goals.map(emptyRecord);
let alex={x:-8,z:-2,heading:0,phase:0,pose:0,tilt:0,effort:0,hunger:.1,fatigue:.05,activity:'Découvre le salon'};
const ball=playItems.football;
let park=null;
let house=null;
const kitchen={ingredients:8,meals:0,servings:[],fridge:0,oven:0,ovenTemperature:22,lastQuality:null};
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
importScripts('/home.js');
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
let eventClock=0, episode, lastWall=performance.now(), accumulator=0, readyToRun=false;
function note(message,kind) {
  const event={message,ticks,kind};
  journal.unshift(event);
  if(journal.length>6)journal.pop();
  if(kind)recordInteraction(message,kind);
}
function recordInteraction(message,kind){
  interactions.unshift({message,ticks,kind});
  if(interactions.length>100)interactions.pop();
}
function newEpisode(){
  const record=records[skill];
  const previous=records[skill-1];
  const pool=record.champions.length?record.champions:previous?.champions||[];
  const parent=pool[Math.floor(Math.random()*Math.min(5,pool.length))];
  const replay=record.confirmed>0&&record.attempts%8!==7&&pool.some(candidate=>candidate.valid);
  const reference=replay?pool.find(candidate=>candidate.valid):parent;
  const radius=replay?.006:record.attempts%7===0?.31:.15;
  const posture=Array.from({length:8},()=>Math.random());
  const common=Array.from({length:8},()=>Math.random()<.38?(Math.random()-Math.random())*radius:0);
  const acrossTime=Math.random()<.65;
  const policy=Array.from({length:64},(_,i)=>{
    if(!reference||record.attempts%31===30)return clamp(posture[i%8]+(acrossTime?0:(Math.random()-.5)*.52),0,1);
    if(!replay&&acrossTime)return clamp(reference.policy[i]+common[i%8],0,1);
    if(!replay&&Math.random()<.55)return reference.policy[i];
    return clamp(reference.policy[i]+(Math.random()-Math.random())*radius,0,1);
  });
  const available=previous?.champions.filter(candidate=>candidate.valid&&candidate.bestPose)||[];
  const starting=reference?.start||(available.length?available[Math.floor(Math.random()*Math.min(3,available.length))].bestPose:null);
  const body=motorBody(policy,starting);
  body.friction=.83+Math.random()*.055;
  return body;
}
function motorStep(){
  if(ticks%2)return;
  const e=simulateMotor(episode,episode.friction);
  const goal=motorGoals[skill];
  const grounded=e.particles[4].ground||e.particles[6].ground;
  const hands=e.particles[8].ground||e.particles[10].ground;
  const stable=e.height>=goal.height&&Math.abs(e.theta)<goal.balance&&
    (skill===0?true:skill===1?hands:grounded)&&(skill<2||!hands&&!e.particles[2].ground);
  e.hold=stable?e.hold+motorStepTime:0;
  e.longest=Math.max(e.longest,e.hold);
  const supportedTravel=skill===1?hands&&Math.abs(e.theta)<1.7:stable;
  if(supportedTravel)e.crawl+=e.delta;
  const upright=Math.exp(-Math.abs(e.theta)*1.5);
  const supported=grounded&&!hands&&!e.particles[2].ground;
  const posture=Math.min(e.height/goal.height,1.18)*upright;
  const supportQuality=skill>=2?(grounded?.24:0)+(supported?.56:0)+
    Math.min(.36,Math.max(0,e.particles[2].y-e.height))*.9:0;
  e.quality+=(posture+supportQuality)*motorStepTime;
  const poseScore=posture+(supported?.45:0);
  if(stable&&poseScore>e.bestPoseScore){
    e.bestPoseScore=poseScore;
    e.bestPose=e.particles.map(part=>[part.x-e.particles[0].x,part.y]);
  }
  if(e.time<goal.duration)return;
  const record=records[skill];
  const valid=e.longest>=goal.hold&&e.crawl>=goal.distance&&
    (!goal.strikes||e.strikes>=goal.strikes&&e.steps.every(count=>count>0));
  const reward=e.quality/goal.duration+Math.min(e.longest/goal.hold,1.5)*.8+
    (goal.distance?clamp(e.crawl/goal.distance,-1,1.5)*.8:0)+
    (goal.strikes?Math.min(e.strikes/goal.strikes,1.5)*1.7+Math.min(e.footWork,.22)*4:0)+(valid?1:0);
  trials++;record.attempts++;
  record.champions.push({policy:e.policy,start:e.start,bestPose:e.bestPose,reward,valid});
  record.champions.sort((a,b)=>Number(b.valid)-Number(a.valid)||b.reward-a.reward);
  if(record.champions.length>12)record.champions.pop();
  record.recent.push(valid);
  if(record.recent.length>8)record.recent.shift();
  score=Math.round(clamp(e.longest/goal.hold,0,1)*100);
  if(valid){
    record.confirmed++;pecm++;
    if(record.confirmed===1)note('Néo trouve un geste qui fonctionne · '+goals[skill]+'.');
  }
  if(!record.mastered&&record.recent.filter(Boolean).length>=6){
    record.mastered=true;
    knowledge['motricité · '+goals[skill]]={visits:record.attempts,senses:['appui','articulations','équilibre'],type:'geste'};
    note('Néo a confirmé son geste · '+goals[skill]+'.');
    if(skill<4)skill++;
  }
  episode=newEpisode();
}
function bodyPose(person,body){
  person.joints=body.joints;
  person.pose=clamp((.29-body.height)/.18,0,1);
  person.tilt=body.theta;
  person.effort=0;
  person.moving=Math.abs(body.delta)>.001;
}
function advanceBody(person,body,heading){
  if(ticks%2)return;
  const amount=body.delta;
  if(Math.abs(amount)<.0001)return;
  walkStep(person,person.x+Math.sin(heading)*amount,person.z+Math.cos(heading)*amount);
}
const walkingBodies=new WeakMap();
function learnedMovement(person,x,z){
  const distance=Math.hypot(x-person.x,z-person.z);
  const candidate=records[4].mastered&&records[4].champions.find(champion=>champion.valid);
  if(!candidate)return distance;
  let body=walkingBodies.get(person);
  if(!body||body.time>motorGoals[4].duration){
    body=motorBody(candidate.policy,candidate.start);
    walkingBodies.set(person,body);
  }
  const route=navigation.next(person,x,z,person.floor||0,ticks*DT);
  if(route&&distance>.05){
    person.heading=Math.atan2(route.x-person.x,route.z-person.z);
    if(ticks%2===0)simulateMotor(body);
    advanceBody(person,body,person.heading);
  }
  bodyPose(person,body);
  return distance;
}
function learn(name, type) {
  const entry=knowledge[name] ||= {visits:0, senses:[], type};
  entry.visits++;
  if(entry.visits===1) entry.senses.push('vision');
  if(entry.visits===2) entry.senses.push('contact');
  if(entry.visits===3){
    entry.senses.push('mémoire');
    counts.cognition++;
    note('Néo associe vision et contact · '+name);
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
  note(mechanism==='coulissante'?'Néo sait maintenant faire coulisser la porte.':'Néo sait maintenant ouvrir une porte à charnière.');
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
      if(record.attempts<=2)note('Néo essaie une autre prise sur la '+door.name+'.');
      return;
    }
    record.success++;
    if(record.success>=2)validateDoor(door.mechanism,record);
  }
  state.until=s+4.2;
  if(parent&&(alex.floor||0)===(door.floor||0)&&Math.hypot(alex.x-door.x,alex.z-door.z)<2.4&&!record.known){
    record.seen++;
    note(characterNames[p.id]+' ouvre la '+door.name+' sous les yeux d’Néo.','object');
  }else recordInteraction((characterNames[p.id]||'Néo')+' ouvre la '+door.name+'.','object');
}
function tryHouseObject(id,s){
  const record=objectLearning[id] ||= {attempts:0,success:0,next:0};
  if(record.next>s)return;
  const item=HOUSE_EFFECTS[id];
  record.attempts++;
  record.next=s+20;
  // Néo tries actions independently. Success becomes knowledge only after repetition.
  const usableAction={sofa:0,tv:2,book:1,water:2,shower:2,dishwasher:2,fireplace:2}[id];
  const actions=record.actions ||= [0,0,0];
  const leastTried=Math.min(...actions);
  const options=actions.map((tries,action)=>tries===leastTried?action:null).filter(action=>action!==null);
  const action=Number.isInteger(record.successfulAction)?record.successfulAction:options[Math.floor(Math.random()*options.length)];
  actions[action]++;
  if(action!==usableAction){
    if(record.attempts===1)note('Néo essaie de comprendre '+item.name+'.');
    return;
  }
  record.successfulAction=action;
  objectContact={id,until:s+item.duration};
  household[id]=1;
  if(++record.success===2){
    counts.cognition++;
    knowledge[item.name]={visits:2,senses:['vision','contact','effet'],type:'objet',action,effect:item.activity};
    note('Néo découvre comment utiliser le matériel · '+item.name+'.','object');
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
    const occupied=[alex,...people].some(p=>doorNear(p,door,.28,.12));
    const target=state.until>s||occupied&&state.amount>.72?1:0;
    state.amount+=clamp(target-state.amount,-DT*1.75,DT*1.75);
  }
}
function doorNear(p,door,depth,padding){
  if((p.floor||0)!==(door.floor||0))return false;
  const across=door.axis==='x';
  return Math.abs(across?p.x-door.x:p.z-door.z)<depth&&
    Math.abs(across?p.z-door.z:p.x-door.x)<door.width/2+padding;
}
function walkStep(p,x,z){
  if(!navigation.clear(p.x,p.z,x,z,p.floor||0))return false;
  for(const door of house?.doors||[]){
    if(!doorNear(p,door,.49,.10))continue;
    useDoor(p,door,ticks*DT);
    if(!door.passage||doorStates[door.id].amount>=.84)continue;
    const across=door.axis==='x';
    const current=across?p.x-door.x:p.z-door.z;
    const next=across?x-door.x:z-door.z;
    if((Math.sign(current)||1)*next<.18&&Math.abs(next-current)>1e-7&&
      Math.abs(next)<Math.abs(current)+Math.abs(next-current)*.1){askDoorHelp(p,door);return false;}
  }
  p.x=x;p.z=z;
  return true;
}
function move(p,x,z,speed) {
  x=clamp(x,-bounds.x+.5,bounds.x-.5);
  z=clamp(z,-bounds.z+.5,bounds.z-.5);
  const distance=Math.hypot(x-p.x,z-p.z);
  if(distance<.072)return distance;
  const target=navigation.next(p,x,z,p.floor||0,ticks*DT);
  if(!target)return distance;
  const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
  if(d<.001)return distance;
  const step=Math.min(d,speed*DT);
  if(walkStep(p,p.x+dx/d*step,p.z+dz/d*step)){
    p.heading=Math.atan2(dx,dz);
    p.phase+=step*8;
    p.moving=true;
  }
  return distance;
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
    note(message,'play');
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
    alex.x=Math.max(bed.x,alex.x-step);
    alex.z=bed.z;
    alex.y=bed.y*clamp((bed.entryX-alex.x)*2.2,0,1);
    alex.activity='Monte sur le trampoline';
    alex.pose=.27;
    if(alex.x<=bed.x+.08){t.mount=false;alex.y=bed.y;t.velocity=2.6;t.time=0;}
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
    if(t.landings>=2)parkObservation('trampoline','Néo découvre que la toile se tend sous son poids et le fait rebondir.');
    trampolineCooldown=s+90;
    contact={kind:'trampoline-exit'};
  }
  return true;
}
function leaveTrampoline(){
  const bed=house.trampoline;
  alex.x+=DT*.95;
  alex.activity='Descend du trampoline';
  if(alex.x>=bed.entryX-.42)alex.y=Math.max(0,alex.y-DT*2.1);
  membrane*=Math.exp(-DT*14);
  if(alex.x>=bed.entryX&&alex.y<=0)contact=null;
  return true;
}
function stepPark(s) {
  if(contact?.kind==='trampoline-exit')return leaveTrampoline();
  if(contact?.kind==='park-exit'){
    const destination=contact.destination;
    const d=Math.hypot(alex.x-destination.x,alex.z-destination.z);
    const fraction=Math.min(1,DT*.78/Math.max(.001,d));
    alex.x+=(destination.x-alex.x)*fraction;
    alex.z+=(destination.z-alex.z)*fraction;
    alex.y=Math.max(0,alex.y-DT*1.8);
    alex.activity='Reprend appui au sol';
    if(d<.015&&alex.y===0)contact=null;
    return true;
  }
  if(stepTrampoline(s))return true;
  if(!park)return false;
  const hanging=contact?.kind==='rope';
  const acceleration=-9.81/park.rope.length*Math.sin(rope.angle)-rope.angular*(hanging?.45:1.1);
  rope.angular+=acceleration*DT;
  rope.angle+=rope.angular*DT;
  if(!contact)return false;
  if(contact.kind==='rope-grip'){
    const end=ropeEnd();
    const elapsed=s-contact.started;
    alex.activity='Essaie de saisir la corde';
    alex.heading=Math.PI/2;
    alex.pose=.17;
    alex.joints=contact.joints.map((angle,i)=>i%JOINT_CHANNELS>=6?angle*clamp(elapsed*3,0,1):angle);
    if(elapsed<.46)return true;
    const grip=alex.joints.slice(6,11).reduce((sum,angle)=>sum+Math.sin(angle),0);
    if(grip>=3.45){
      alex.ropeGrip={targets:contact.joints.slice(6,11),successes:(alex.ropeGrip?.successes||0)+1};
      rope.angular+=(Math.sign(end.x-park.rope.x)||1)*.87;
      contact={kind:'rope',release:s+2.3,joints:contact.joints};
    }else{
      parkCooldown.rope=s+4;
      contact=null;
    }
    return true;
  }
  if(contact.kind==='rope'){
    const end=ropeEnd();
    alex.joints=contact.joints;
    alex.x=end.x;alex.z=end.z;alex.y=Math.max(0,end.y-.21);
    alex.activity='Se suspend à la corde';
    alex.pose=.17;alex.tilt=-rope.angle;alex.effort=0;
    if(s>=contact.release){
      parkObservation('rope','Néo découvre que son poids fait osciller la corde.');
      parkCooldown.rope=s+28;
      contact={kind:'park-exit',destination:park.approaches.rope};
    }
    return true;
  }
  const top=park.slide[0], bottom=park.slide.at(-1);
  if(contact.kind==='slide-entry'){
    const d=Math.hypot(alex.x-bottom.x,alex.z-bottom.z);
    const fraction=Math.min(1,DT*.65/Math.max(.001,d));
    alex.x+=(bottom.x-alex.x)*fraction;
    alex.z+=(bottom.z-alex.z)*fraction;
    alex.y=Math.min(bottom.y,(alex.y||0)+DT*.45);
    alex.activity='Prend appui sur le toboggan';
    if(d<.015)contact={kind:'climb'};
    return true;
  }
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
      parkObservation('slide','Néo découvre que la pente accélère sa descente.');
      parkCooldown.slide=s+33;
      contact={kind:'park-exit',destination:park.approaches.slide};
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
    for(const [id,name] of [['slide','toboggan'],['rope','corde']]){
      if(park.approaches[id])items.push({id,name,...park.approaches[id]});
    }
  }
  if(house&&s>=trampolineCooldown){
    const bed=house.trampoline;
    items.push({id:'trampoline',name:'trampoline',x:bed.entryX,z:bed.entryZ});
  }
  let best=null;
  let bestScore=.04;
  for(const item of items){
    const distance=Math.hypot(item.x-alex.x,item.z-alex.z);
    if(distance>4||s<parkCooldown[item.id])continue;
    if(equipmentSeen[item.id]===0){
      equipmentSeen[item.id]=1;
      note('Néo remarque '+({slide:'le toboggan.',rope:'la corde.',trampoline:'le trampoline.'}[item.id]));
    }
    const value=(1+.25*Math.log1p(parkMemory[item.id]))/(1+distance*distance);
    if(value>bestScore){bestScore=value;best=item;}
  }
  return best;
}
function beginEquipment(item,s){
  if(item.id==='trampoline'){
    contact={kind:'trampoline',mount:true,time:0,velocity:0,landings:0,touching:false};
    alex.z=house.trampoline.entryZ;
    alex.heading=0;
  }else if(item.id==='slide'){
    contact={kind:'slide-entry'};
  }else{
    const joints=neutralJoints();
    joints[0]=.28;joints[1]=.86;
    joints[11]=1.07;joints[12]=.2;
    for(let i=0;i<5;i++){
      const prior=alex.ropeGrip?.targets?.[i];
      joints[6+i]=Number.isFinite(prior)?clamp(prior+(Math.random()-.5)*.18,0,1.35):Math.random()*1.35;
    }
    contact={kind:'rope-grip',started:s,joints};
  }
}
function makeGoalOptions(){
  const options=landmarks.map(([name,x,z])=>({name,x,z,category:'exploration'}));
  if(house){
    options.push({name:'terrasse',x:house.trampoline.entryX,z:house.trampoline.entryZ,category:'exploration'});
    for(const [id,point] of Object.entries(house.objects)){
      options.push({...point,name:HOUSE_EFFECTS[id].name,id,category:'objet'});
    }
    for(const door of house.doors.filter(door=>!door.floor)){
      const side=(door.axis==='x'?alex.x-door.x:alex.z-door.z)<0?-.26:.26;
      options.push({name:'poignée de '+door.name,x:door.x+(door.axis==='x'?side:0),
        z:door.z+(door.axis==='x'?0:side),category:'exploration'});
    }
  }
  for(const person of people){
    if(person.floor||person.lie)continue;
    options.push({name:person.id,x:person.x,z:person.z,category:'social',person});
  }
  for(const [id,item] of Object.entries(playItems)){
    if(Math.hypot(item.x-alex.x,item.z-alex.z)>7)continue;
    options.push({name:playNames[id],id,x:item.x,z:item.z,category:'jeu'});
  }
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
function languageVisibility(observer,target){
  const distance=Math.hypot(target.x-observer.x,target.z-observer.z);
  const reach=Math.max(0,(distance-.24)/Math.max(.01,distance));
  return navigation.clear(observer.x,observer.z,observer.x+(target.x-observer.x)*reach,
    observer.z+(target.z-observer.z)*reach,observer.floor||0);
}
function experience() {
  alex.hunger=clamp(alex.hunger+DT*.002,0,1);
  alex.fatigue=clamp(alex.fatigue+DT*.0015,0,1);
  const s=ticks*DT;
  stepDoors(s);
  stepKitchen(s);
  alex.thirst=clamp((alex.thirst??.15)+DT*.002,0,1);
  alex.hygiene=clamp((alex.hygiene??.9)-DT*.00065,0,1);
  alex.joints=null;
  for(const person of residents){
    person.moving=false;
    person.pleasure=Math.max(0,(person.pleasure||0)-DT*.001);
  }
  const usingEquipment=stepHouseObject(s)||stepPark(s)||sleeping(alex,s,skill===4&&records[4].mastered);
  if(!usingEquipment){
  alex.y=Math.max(0,(alex.y||0)-DT*2.8);
  if(skill===4 && records[4].mastered){
    if(explorationTarget?.person?.floor)finishGoal(s,false);
    if(explorationTarget&&explorationTarget.person){
      explorationTarget.x=explorationTarget.person.x;
      explorationTarget.z=explorationTarget.person.z;
    }
    if(explorationTarget?.category==='jeu'){
      const item=playItems[explorationTarget.id];
      if(item){explorationTarget.x=item.x;explorationTarget.z=item.z;}
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
      goal=['repas',house.kitchen.table.x,house.kitchen.table.z];category='repas';
    }else if(alex.thirst>.7&&objects?.water&&(objectLearning.water?.next||0)<=s){
      goal=['eau',objects.water.x,objects.water.z,'water'];category='objet';
    }else if(alex.hygiene<.25&&objects?.shower&&(objectLearning.shower?.next||0)<=s){
      goal=['douche',objects.shower.x,objects.shower.z,'shower'];category='objet';
    }else if(alex.hunger>.86&&!house){goal=['repas',-2,-4];category='repas';}
    else if(equipment){goal=[equipment.name,equipment.x,equipment.z];category='équipement';}
    alex.activity=category==='objet'?'Explore · '+goal[0]:category==='exploration'?'Explore · '+goal[0]:category==='social'?'Rencontre · '+goal[0]:category==='équipement'?'Observe · '+goal[0]:category;
    const near=learnedMovement(alex,goal[1],goal[2]);
    if(category==='équipement'&&Math.hypot(alex.x-goal[1],alex.z-goal[2])<.23)beginEquipment(equipment,s);

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
    if(category!=='observation'&&category!=='objet'&&category!=='équipement'&&near<1 && Math.hypot(alex.x-goal[1],alex.z-goal[2])<1 && s>=eventClock && (category!=='social'||navigation.clear(alex.x,alex.z,friend.x,friend.z,0))){
      eventClock=s+3;
      learn(goal[0],category);
      if(pursuingIntention)finishGoal(s,true);
      if(category==='repas'||category==='repos'){
        counts.life++;
        if(category==='repas'){
          if(house&&kitchen.meals===0)return;
          if(house)takeServing(alex);
          else alex.hunger=.08;
        }else alex.fatigue=.06;
        if(!house)note('Néo prend un repas.');
      }
      if(category==='social'){
        counts.social++; friend.bond++;
        relationshipEvent('alex',friend.id,'Rencontre',s,age);
        if(friend.id==='marie'||friend.id==='joseph') note('Un câlin apaise Néo.','social');
        else note('Néo rencontre '+characterNames[friend.id]+'.','social');
      }
      if(category==='jeu'){
        counts.play++;
      }
    }
  }else{
    alex.activity=goals[skill];
    if(episode.heading==null)episode.heading=Math.random()*Math.PI*2;
    alex.heading=episode.heading;
    bodyPose(alex,episode);
    advanceBody(alex,episode,alex.heading);
  }
  }
  for(const [id,item] of Object.entries(playItems)){
    if(Math.hypot(alex.x-item.x,alex.z-item.z)<.49)tryPlayObject(alex,id,s);
  }
  for(let i=0;i<people.length;i++){
    const p=people[i];
    if(i<3){
      p.fatigue=clamp((p.fatigue??(.14+i*.06))+DT*.0023,0,1);
      p.hunger=clamp((p.hunger??.42)+DT*.0021,0,1);
      const carrying=sleeps.get(alex);
      if(carrying?.carrier===p&&['pickup','bed','settle'].includes(carrying.phase))continue;
      if(i<2&&assistAtDoor(p,s))continue;
      if(sleeping(p,s))continue;
      if(i<2&&cookMeal(p,s))continue;
      if(p.hunger>.62&&house?.kitchen&&kitchen.meals){
        const table=house.kitchen.table;
        p.activity='Va prendre un repas';
        if(move(p,table.x,table.z,.75)<.18)takeServing(p);
        continue;
      }
    }else p.moving=false;
    p.activity='Se déplace';
    let goalX=p.homeX+Math.sin(s*.21+i)*1.1;
    let goalZ=p.homeZ+Math.cos(s*.18+i)*1.2;
    if(house&&i<3){
      const cycle=(s+i*20)%95;
      if(cycle<42){
        const doors=house.doors.filter(door=>!door.floor);
        const door=doors[(Math.floor((s+i*20)/95)+i)%doors.length];
        goalX=door.x;
        goalZ=door.z+(door.passage&&cycle>24?.64:-.34);
      }
    }
    if(i<2&&age<7&&s%54<34){goalX=alex.x+(i===0?-.72:.72);goalZ=alex.z+(i===0?.55:-.55);p.activity='Va voir Néo';}
    if(i>=3){
      p.age=age;
      if(records[4].mastered){
        const style=socialStyle[p.id];
        if(Math.sin(s*.11+i*2)>1-style.outreach){
          goalX=ball.x;goalZ=ball.z;
          p.activity='S’intéresse au ballon';
        }
        learnedMovement(p,goalX,goalZ);
      }else{
        const acquired=records.findLastIndex(record=>record.mastered);
        const candidate=acquired>=0&&records[acquired].champions.find(champion=>champion.valid);
        let body=walkingBodies.get(p);
        if(candidate){
          if(!body||body.policy!==candidate.policy||body.time>motorGoals[acquired].duration){
            body=motorBody(candidate.policy,candidate.start);walkingBodies.set(p,body);
          }
          if(ticks%2===0)simulateMotor(body,.76+socialStyle[p.id].care*.14);
          bodyPose(p,body);
          advanceBody(p,body,p.heading);
          p.activity=goals[acquired];
        }else{p.pose=1;p.tilt=1.1;p.activity='Observe le parc';}
      }
    }else move(p,goalX,goalZ,.75);
    if(i<2&&age<7&&Math.hypot(p.x-alex.x,p.z-alex.z)<1.35&&s>=nextParentCare&&(alex.hunger>.24||alex.fatigue>.48||(alex.thirst||0)>.45)){
      if(alex.hunger>.24){if(kitchen.meals>0)takeServing(alex);else alex.hunger=Math.max(.08,alex.hunger-.38);}
      if(alex.fatigue>.48)alex.fatigue=Math.max(.12,alex.fatigue-.28);
      if((alex.thirst||0)>.45)alex.thirst=Math.max(.1,alex.thirst-.35);
      alex.pleasure=clamp((alex.pleasure||0)+.18,0,1);
      p.activity='Prend soin de Néo';nextParentCare=s+18;
      note(characterNames[p.id]+' prend soin de Néo.','care');
    }
    for(const id of ['football','softBall','bikePark','bikeHome','toy']){
      const item=playItems[id];
      if(Math.hypot(p.x-item.x,p.z-item.z)<.49)tryPlayObject(p,id,s);
    }
  }
  if(ticks%12===0){
    dialogue.step(s,alex,people,languageScene);
    updateRelationships(alex,people,s,age);
  }
  stepPlay();
  const gate=milestones[age];
  if(gate&&skill===4&&pecm>=gate.motor&&Object.keys(counts).every(key=>counts[key]>=gate[key])){
    age++;note('Nouveau stade de développement · '+(age+1));
  }
}
const characterNames={alex:'Néo',joseph:'Joseph',marie:'Marie',juliette:'Juliette',timeo:'Timéo',nathan:'Nathan',francoise:'Lyra',rose:'Rose'};
const nextBallEvent={};
function recordBallPlay(id,s){
  if(s<(nextBallEvent[id]||0))return;
  nextBallEvent[id]=s+9;
  note(characterNames[id]+' joue avec la balle.','play');
}
let activityData, nextActivitySnapshot=0;
function snapshot() {
  if(!activityData||ticks>=nextActivitySnapshot){
    const names=Object.keys(knowledge);
    const vocabulary=dialogue.view().vocabulary.map(entry=>entry.word);
    const shared={skills:records.flatMap((record,i)=>record.mastered?[goals[i]]:[]),discoveries:names,vocabulary};
    for(const p of people){
      if(playgroundFriends.includes(p.id))p.age=age;
      p.inherited=names.length+vocabulary.length;
       p.learnedFromNeo=[...names,...vocabulary];
      p.baseWords=familyLexicons[p.id]?.size||0;
    }
    activityData={equipment:parkMemory,gate:milestones[age],events:interactions,shared,
      motor:records.map(({attempts,confirmed,recent,mastered})=>({attempts,confirmed,recent:recent.filter(Boolean).length,mastered})),
      knowledgeCount:names.length,discoveries:names.slice(-8).reverse()};
    nextActivitySnapshot=ticks+36;
  }
  return {ticks,trials,pecm,skill,age,score,alex,people,ball,playItems,relationships,counts,journal,mode,ropeEnd:park?ropeEnd():null,doors:doorStates,membrane,kitchen,household,validated:records[4].confirmed,dialogue:dialogue.view(),activityData};
}
function save() {
  return {motorVersion:MOTOR_VERSION,ticks,trials,pecm,skill,age,score,alex,people,ball,counts,journal,records,knowledge,eventClock,playItems,playTrials,relationships,parkMemory,equipmentSeen,doorKnowledge,kitchen,objectLearning,nextRefill,curiosity,interactions,dialogue:dialogue.save()};
}
onmessage=({data})=>{
  if(data.type==='house'){
    house=data.geometry;
    const {objects,kitchen,trampoline,doors}=house;
    languageScene.points={canape:objects.sofa,livre:objects.book,eau:objects.water,douche:objects.shower,
      tele:objects.tv,feu:objects.fireplace,frigo:kitchen.fridge,four:kitchen.oven,
      repas:kitchen.serve,table:kitchen.table,porte:doors.find(door=>door.id==='breezeway'),
      trampoline:{x:trampoline.entryX,z:trampoline.entryZ}};
    for(const door of house.doors)doorStates[door.id]||={amount:0,until:0};
    for(const person of [...residents,...people.slice(3)])resetRestPosition(person);
    for(const item of Object.values(playItems)){
      if(navigation.isFree(item.x,item.z,0))continue;
      const nearest=navigation.nearest(item.x,item.z,0,null,1.2);
      if(nearest>=0)Object.assign(item,navigation.point(nearest));
    }
  }
  if(data.type==='play-control')playControl(data.id,data.action,data.value);
  if(data.type==='park'&&data.geometry.slide.length>1){
    park=data.geometry;
    park.approaches={};
    for(const [id,target] of [['slide',park.slide.at(-1)],['rope',park.rope]]){
      const safe=navigation.nearest(target.x,target.z,0,null,1.25);
      if(safe>=0)park.approaches[id]=navigation.point(safe);
    }
  }
  if(data.type==='mode'){mode=data.mode;accumulator=0;lastWall=performance.now();}
  if(data.type==='restore'){
    readyToRun=true;
    dialogue.resumeAt(data.archivedId);
    const s=data.state;
    if(!s)return;
    if(!Array.isArray(s.records)||s.records.length!==5||!Number.isFinite(s.ticks))return;
    ({ticks,trials,pecm,skill,age,score,counts,journal,records,knowledge,eventClock}=s);
    if(s.motorVersion!==MOTOR_VERSION)records=goals.map(emptyRecord);
    if(s.motorVersion!==MOTOR_VERSION){
      skill=0;score=0;trials=0;pecm=0;
      for(const name of Object.keys(knowledge))if(name.startsWith('motricité · '))delete knowledge[name];
      note('Néo recommence ses essais avec un corps articulé.');
    }
    dialogue.restore(s.dialogue);
    interactions=(s.interactions||[]).slice(0,100);
    activityData=null;
    Object.assign(curiosity,s.curiosity);
    Object.assign(alex,s.alex);
    Object.assign(parkMemory,s.parkMemory);
    Object.assign(doorKnowledge,s.doorKnowledge);
    Object.assign(kitchen,s.kitchen);
    if(!s.kitchen?.servings)kitchen.servings=Array(kitchen.meals).fill(.62);
    Object.assign(objectLearning,s.objectLearning);
    nextRefill=Number.isFinite(s.nextRefill)?s.nextRefill:0;
    Object.assign(equipmentSeen,s.equipmentSeen);
    if(s.motorVersion===MOTOR_VERSION)Object.assign(ball,s.ball);
    for(const [id,item] of Object.entries(s.playItems||{}))if(playItems[id])Object.assign(playItems[id],item);
    Object.assign(playTrials,s.playTrials);
    if(s.relationships)relationships=s.relationships;
    people.forEach((p,i)=>Object.assign(p,s.people[i]));
    if(house)for(const person of [...residents,...people.slice(3)])resetRestPosition(person);
    episode=newEpisode();
  }
};
episode=newEpisode();
note('Néo commence à explorer ses mouvements.');
let lastPost=0,lastSave=0;
function run(){
  const now=performance.now();
  if(!readyToRun){lastWall=now;setTimeout(run,16);return;}
  accumulator+=Math.min(.1,(now-lastWall)/1000);
  lastWall=now;
  if(mode==='human'){
    while(accumulator>=DT){ticks++;if(!sleeps.has(alex))motorStep();experience();accumulator-=DT;}
  }else{
    accumulator=0;
    const deadline=performance.now()+11;
    do {
      for(let n=0;n<96;n++){
        ticks++;if(!sleeps.has(alex))motorStep();experience();
      }
    }while(performance.now()<deadline);
  }
  if(now-lastPost>32){
    const lines=dialogue.takeNew();
    postMessage({type:'state',state:snapshot(),lines});lastPost=now;
  }
  if(now-lastSave>4500){postMessage({type:'save',state:save()});lastSave=now;}
  setTimeout(run,mode==='human'?8:0);
}
run();
