const playItems={
  football:{x:9,z:7,y:.35,vx:0,vy:0,vz:0,radius:.11,mass:.43,rollX:0,rollZ:0},
  softBall:{x:-6.1,z:3.05,y:.18,vx:0,vy:0,vz:0,radius:.062,mass:.075,rollX:0,rollZ:0},
  bikePark:{x:10.2,z:7.8,heading:0,steer:0,speed:0,pedal:0,rear:0},
  bikeHome:{x:-5.35,z:3.55,heading:0,steer:0,speed:0,pedal:0,rear:0},
  toy:{x:-11.4,z:-1.25,beads:[]}
};
const playNames={football:'ballon du parc',softBall:'petit ballon du salon',bikePark:'tricycle du parc',bikeHome:'tricycle de la maison',toy:'jeu de perles'};
const playTrials={};
const ballContacts={};
const pushBall=(ball,x,z,impulse=.2,lift=.02)=>{
  ball.vx+=x*impulse/ball.mass;
  ball.vz+=z*impulse/ball.mass;
  ball.vy+=lift/ball.mass;
};
function playControl(id,action,value){
  const item=playItems[id];
  if(!item)return;
  if(id==='football'||id==='softBall'){
    if(action==='push')pushBall(item,0,1,item.mass*2,item.mass*.85);
  }else if(id==='toy'){
    if(action==='slide'&&Number.isInteger(value?.bead)&&value.bead>=0&&value.bead<80&&Number.isFinite(value.position)){
      item.beads[value.bead]=clamp(value.position,0,1);
    }
  }else if(action==='pedal'){
    item.speed=clamp(item.speed+.6,0,2.6);
    item.pedal+=.22;
  }else if(action==='steer'&&Number.isFinite(value)){
    item.steer=clamp(value,-.56,.56);
  }
}
function stepBall(item){
  const floor=item.radius;
  if(item.y>floor+.0001||Math.abs(item.vy)>.015)item.vy-=9.81*DT;
  item.y+=item.vy*DT;
  if(item.y<floor){
    item.y=floor;
    item.vy=item.vy<-.23?-item.vy*(item.mass>.1?.62:.38):0;
  }
  const {x,z}=item;
  const nx=x+item.vx*DT,nz=z+item.vz*DT;
  if(nx>-18.8&&nx<18.8&&navigation.clear(x,z,nx,z,0))item.x=nx;
  else item.vx*=-.64;
  if(nz>-11.8&&nz<11.8&&navigation.clear(item.x,z,item.x,nz,0))item.z=nz;
  else item.vz*=-.64;
  const friction=Math.exp(-DT*(item.y<=floor+.003?1.25:.17));
  item.vx*=friction;item.vz*=friction;
  item.rollX+=(item.z-z)/item.radius;
  item.rollZ-=(item.x-x)/item.radius;
}
function stepPlay(){
  stepBall(playItems.football);
  stepBall(playItems.softBall);
  for(const bike of [playItems.bikeHome,playItems.bikePark]){
    if(bike.speed<.01)continue;
    const travel=bike.speed*DT;
    const heading=bike.heading+travel*Math.tan(bike.steer)/.69;
    const x=bike.x+Math.sin(heading)*travel,z=bike.z+Math.cos(heading)*travel;
    if(x<-18.4||x>18.4||Math.abs(z)>11.4||!navigation.clear(bike.x,bike.z,x,z,0)){
      bike.speed=0;
      continue;
    }
    bike.x=x;bike.z=z;bike.heading=heading;
    bike.pedal+=travel/.145;bike.rear+=travel/.10;
    bike.speed*=Math.exp(-DT*.75);
  }
}
function tryPlayObject(person,id,s){
  const item=playItems[id];
  if(!item||Math.hypot(item.x-person.x,item.z-person.z)>.49)return;
  if(id==='football'||id==='softBall'){
    if(!person.moving)return;
    const length=Math.max(.05,Math.hypot(item.x-person.x,item.z-person.z));
    const nx=(item.x-person.x)/length,nz=(item.z-person.z)/length;
    const speed=walkingBodies.get(person)?.pace??(person===alex?episode.pace:.75);
    const approach=speed*(Math.sin(person.heading)*nx+Math.cos(person.heading)*nz);
    const relative=approach-(item.vx*nx+item.vz*nz);
    const key=id+':'+(person.id||'alex');
    if(relative<.12||s<(ballContacts[key]||0))return;
    ballContacts[key]=s+.22;
    pushBall(item,nx,nz,item.mass*Math.min(2.4,relative*1.32),0);
    recordBallPlay(person.id||'alex',s);
    return;
  }
  const memory=playTrials[id]||={next:0,success:0,action:null};
  const label=id.startsWith('bike')?'tricycle':playNames[id];
  const learned=knowledge['usage · '+label];
  if((person!==alex&&!learned)||s<memory.next)return;
  memory.next=s+10;
  const action=memory.action??learned?.action??Math.floor(rng()*5);
  if(id==='toy'&&action===2){
    const index=Math.floor(rng()*12);
    playControl(id,'slide',{bead:index,position:rng()});
  }else if(id.startsWith('bike')&&action===3){
    playControl(id,'pedal');
  }else return;
  if(person===alex){
    memory.action=action;
    if(++memory.success===3){
      knowledge['usage · '+label]={visits:memory.success,action,senses:['contact','mouvement','mémoire'],type:'objet'};
      note('Néo découvre comment faire bouger le '+playNames[id]+'.','object');
    }
  }
}
