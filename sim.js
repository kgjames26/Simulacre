const DT = 1 / 120;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const initial = [18, 5, 0.36, 0.32, 3.7, 1.15];
const limits = [[2, 55], [0.4, 18], [0.03, 0.85], [0.05, 0.8], [1, 8], [0.1, 2]];
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
let ticks=0, trials=0, pecm=0, skill=0, age=0, score=0, mode='turbo';
let records = goals.map(()=>({best:-1e9,policy:[...initial],success:0,confirmed:0}));
let alex={x:-6.7,z:2.6,heading:0,phase:0,pose:0,tilt:0,effort:0,hunger:.1,fatigue:.05,activity:'Premiers mouvements'};
let ball={x:9,z:7,vx:0,vz:0};
let park=null;
let contact=null;
const rope={angle:0,angular:0};
const parkMemory={slide:0,rope:0};
const equipmentSeen={slide:0,rope:0};
const parkCooldown={slide:0,rope:0};
let explorationTarget=null, nextChoice=0;
let eventClock=0, episode, lastWall=performance.now(), accumulator=0;
function note(message) {
  journal.unshift({message,ticks});
  journal = journal.slice(0,6);
}
function newEpisode() {
  const record = records[skill];
  const replay = skill===4 && trials%3!==0;
  const noise = replay ? .025 : Math.max(.035,.24/(1+record.confirmed*.035));
  const policy = record.policy.map((v,i)=>clamp(v*(1+(Math.random()*2-1)*noise),...limits[i]));
  return {policy, time:0, theta:(Math.random()-.5)*(.7-skill*.09), angular:0, height:skill<2?.13:.39, vy:0,
    vx:0, distance:0, energy:0, phase:Math.random()*Math.PI*2, standing:0, contact:false, replay};
}
function motorStep() {
  const e=episode;
  const [gain,damping,stride,lift,frequency,power]=e.policy;
  const targetHeight=[.25,.19,.43,.45,.47][skill];
  const moving=skill===1 || skill>=3;
  e.phase+=frequency*DT;
  const drive=moving?Math.sin(e.phase):0;
  const force=clamp((targetHeight-e.height)*220-e.vy*16+9.81,0,23);
  const pulse=moving ? Math.max(0,drive) : 0;
  const torque=clamp(-gain*e.theta-damping*e.angular+drive*stride*2,-11,11);
  e.angular+=(9.81/targetHeight*Math.sin(e.theta)+torque*3)*DT;
  e.theta+=e.angular*DT;
  e.vy+=(force-9.81+pulse*lift)*DT;
  e.height+=e.vy*DT;
  if(e.height<.085){e.height=.085;e.vy=Math.max(0,-e.vy*.12);}
  e.contact=Math.abs(e.theta)<.42 && Math.abs(e.height-targetHeight)<.1;
  e.vx+=(e.contact && moving ? pulse*power*stride*8 : 0)*DT;
  e.vx*=Math.exp(-DT*(e.contact?2.5:5));
  e.distance+=e.vx*DT;
  e.standing+=e.contact?DT:0;
  e.energy+=(Math.abs(torque)*.08+force*.007)*DT;
  e.time+=DT;
  const duration=[1.1,2.5,2.4,3.2,4.2][skill];
  const fallen=e.time>.45 && Math.abs(e.theta)>1.15;
  if(!fallen && e.time<duration)return;
  trials++;
  const reward=e.standing+e.distance*2.4-e.energy*.15-(fallen?1.6:0);
  const r=records[skill];
  const valid=!fallen && e.standing/duration>.72 && e.distance>=[0,.28,0,.45,.8][skill];
  if(reward>r.best){r.best=reward;r.policy=e.policy;}
  r.success=valid?r.success+1:Math.max(0,r.success-1);
  if(valid){r.confirmed++;pecm+=1;}
  score=Math.round(100*e.standing/duration);
  if(skill<4 && r.success>=12 && r.confirmed>=[400,600,800,1000][skill]){
    note(goals[skill]+' · acquis sur plusieurs essais');
    skill++;
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
function move(p,x,z,speed) {
  const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);
  if(d<.09)return d;
  const step=Math.min(d,speed*DT);
  p.x=clamp(p.x+dx/d*step,-bounds.x+.5,bounds.x-.5);
  p.z=clamp(p.z+dz/d*step,-bounds.z+.5,bounds.z-.5);
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
    knowledge[id==='slide'?'toboggan':'corde']={visits:1,senses:['vision','contact','mouvement'],type:'jeu'};
    note(message);
  }
}
function stepPark(s) {
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
  if(!park||alex.x<4)return null;
  const bottom=park.slide.at(-1), end=ropeEnd();
  const items=[{id:'slide',name:'toboggan',x:bottom.x,z:bottom.z},{id:'rope',name:'corde',x:end.x,z:end.z}];
  let best=null;
  let bestScore=.04;
  for(const item of items){
    const distance=Math.hypot(item.x-alex.x,item.z-alex.z);
    if(distance>4||s<parkCooldown[item.id])continue;
    if(equipmentSeen[item.id]===0){
      equipmentSeen[item.id]=1;
      note('Alex remarque '+(item.id==='slide'?'le toboggan.':'la corde.'));
    }
    const value=(1+.25*Math.log1p(parkMemory[item.id]))/(1+distance*distance);
    if(value>bestScore){bestScore=value;best=item;}
  }
  return best;
}
function beginEquipment(item,s){
  if(item.id==='slide'){
    contact={kind:'climb'};
    alex.x=park.slide.at(-1).x;
    alex.z=park.slide.at(-1).z;
  }else{
    const direction=Math.sin(alex.heading)||1;
    rope.angular+=direction*.87;
    contact={kind:'rope',release:s+2.3};
  }
}
function experience() {
  alex.hunger=clamp(alex.hunger+DT*.002,0,1);
  alex.fatigue=clamp(alex.fatigue+DT*.0015,0,1);
  const s=ticks*DT;
  const usingEquipment=stepPark(s);
  if(!usingEquipment){
  alex.y=Math.max(0,(alex.y||0)-DT*2.8);
  if(skill===4 && records[4].confirmed>=12){
    if(!explorationTarget||s>=nextChoice){
      const weight = ([name,x,z]) => 1/(1+(knowledge[name]?.visits||0)*.22)/(1+Math.hypot(x-alex.x,z-alex.z)*.07);
      let draw=Math.random()*landmarks.reduce((sum,target)=>sum+weight(target),0);
      explorationTarget=landmarks.find(target=>(draw-=weight(target))<=0)||landmarks[0];
      nextChoice=s+17+Math.random()*19;
    }
    const target=explorationTarget;
    const friend=people[Math.floor(s/13)%people.length];
    let goal=target, category='exploration';
    const equipment=tryEquipment(s);
    if(alex.hunger>.66){goal=['repas',-2,-4];category='repas';}
    else if(alex.fatigue>.74){goal=['repos',-7,2];category='repos';}
    else if(equipment){goal=[equipment.name,equipment.x,equipment.z];category='équipement';}
    else if(Math.floor(s/10)%4===2){goal=[friend.id,friend.x,friend.z];category='social';}
    else if(alex.x>5 && Math.hypot(alex.x-ball.x,alex.z-ball.z)<2.8){
      goal=['balle',ball.x,ball.z];category='jeu';
    }
    alex.activity=category==='exploration'?'Explore · '+goal[0]:category==='social'?'Rencontre · '+goal[0]:category==='équipement'?'Observe · '+goal[0]:category;
    let [destinationX,destinationZ]=goal.slice(1);
    const crossing=(alex.x<-.5)!==(destinationX<-.5);
    if(crossing&&Math.abs(alex.z-4)>.45){
      destinationX=alex.x;
      destinationZ=4;
    }else if(crossing)destinationZ=4;
    const near=move(alex,destinationX,destinationZ,clamp(episode.vx*4,.24,1.35));
    if(category==='équipement'&&Math.hypot(alex.x-goal[1],alex.z-goal[2])<.23) beginEquipment(equipment,s);
    if(category!=='équipement'&&near<1 && Math.hypot(alex.x-goal[1],alex.z-goal[2])<1 && s>=eventClock){
      eventClock=s+3;
      learn(goal[0],category);
      if(category==='repas'||category==='repos'){
        counts.life++;
        if(category==='repas')alex.hunger=.08;else alex.fatigue=.06;
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
  } else alex.activity=goals[skill];
  alex.pose=skill===0?clamp(1-episode.height*2.5,.25,1):skill===1?.83:0;
  alex.tilt=episode.theta;
  alex.effort=skill>=3||skill===1?Math.sin(episode.phase)*.75:0;
  if(skill<4)alex.phase=episode.phase;
  }
  for(let i=0;i<people.length;i++){
    const p=people[i];
    const goalX=p.homeX+Math.sin(s*.21+i)*1.1;
    const goalZ=p.homeZ+Math.cos(s*.18+i)*1.2;
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
  return {ticks,trials,pecm,skill,age,score,alex,people,ball,counts,journal,mode,ropeEnd:park?ropeEnd():null,validated:records[4].confirmed};
}
function save() {
  return {ticks,trials,pecm,skill,age,score,alex,people,ball,counts,journal,records,knowledge,eventClock,parkMemory,equipmentSeen};
}
onmessage=({data})=>{
  if(data.type==='park'&&data.geometry.slide.length>1)park=data.geometry;
  if(data.type==='mode'){mode=data.mode;accumulator=0;lastWall=performance.now();}
  if(data.type==='restore'&&data.state){
    const s=data.state;
    if(!Array.isArray(s.records)||s.records.length!==5||!Number.isFinite(s.ticks))return;
    ({ticks,trials,pecm,skill,age,score,counts,journal,records,knowledge,eventClock}=s);
    Object.assign(alex,s.alex);
    Object.assign(parkMemory,s.parkMemory);
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
