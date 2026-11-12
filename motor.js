// Sagittal articulated body. Motors apply paired internal corrections.
// Horizontal momentum changes through contact friction, never a gait or thrust command.
const motorBodies=[
  [0,.23,4,.065],[-.24,.17,3,.057],[-.38,.14,1.1,.083],
  [.12,.14,1,.034],[.22,.04,.55,.032],[.12,.14,1,.034],[.22,.04,.55,.032],
  [-.33,.06,.55,.026],[-.21,.027,.35,.023],[-.33,.06,.55,.026],[-.21,.027,.35,.023]
];
const motorBones=[[0,1,.245],[1,2,.142],[0,3,.155],[3,4,.142],[0,5,.155],[5,6,.142],
  [1,7,.141],[7,8,.129],[1,9,.141],[9,10,.129]];
const motorAngles=[
  [1,0,3,-1.25,1.45],[0,3,4,-2.42,0],[1,0,5,-1.25,1.45],[0,5,6,-2.42,0],
  [0,1,7,-2.15,1.9],[1,7,8,0,2.36],[0,1,9,-2.15,1.9],[1,9,10,0,2.36]
];
const wrapMotor=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const motorStepTime=1/60;
function motorBody(policy,start){
  const particles=motorBodies.map(([x,y,m,r],i)=>{
    if(start)[x,y]=start[i];
    return {x,y,px:x,py:y,w:1/m,r,ground:false};
  });
  return {policy,start,particles,time:0,delta:0,height:particles[0].y,theta:0,joints:Array(22).fill(0),
    travel:0,pace:0,strikes:0,steps:[0,0],lastFoot:-1,lift:[false,false],liftX:[0,0],footSupport:[-1,-1],footWork:0,hold:0,
    longest:0,quality:0,crawl:0,bestPose:null,bestPoseScore:-Infinity};
}
function keepLength(a,b,length){
  const x=b.x-a.x,y=b.y-a.y,d=Math.hypot(x,y)||.0001;
  const impulse=(d-length)/(d*(a.w+b.w));
  a.x+=x*impulse*a.w;a.y+=y*impulse*a.w;
  b.x-=x*impulse*b.w;b.y-=y*impulse*b.w;
}
function motorAngle(a,b,c,goal){
  const ax=a.x-b.x,ay=a.y-b.y,cx=c.x-b.x,cy=c.y-b.y;
  const aa=ax*ax+ay*ay,cc=cx*cx+cy*cy;
  if(aa<.00001||cc<.00001)return;
  const gax=ay/aa,gay=-ax/aa,gcx=-cy/cc,gcy=cx/cc;
  const gbx=-gax-gcx,gby=-gay-gcy;
  const error=wrapMotor(Math.atan2(ax*cy-ay*cx,ax*cx+ay*cy)-Math.PI-goal);
  const magnitude=Math.max(-.27,Math.min(.27,error))*.38/
    (a.w/aa+c.w/cc+b.w*(gbx*gbx+gby*gby));
  a.x-=magnitude*a.w*gax;a.y-=magnitude*a.w*gay;
  b.x-=magnitude*b.w*gbx;b.y-=magnitude*b.w*gby;
  c.x-=magnitude*c.w*gcx;c.y-=magnitude*c.w*gcy;
}
function floorContact(p,friction){
  if(p.y>=p.r)return;
  const penetration=p.r-p.y;
  p.y=p.r;
  const movement=p.x-p.px;
  p.x-=Math.max(-penetration*friction,Math.min(penetration*friction,movement));
  p.ground=true;
}
function simulateMotor(body,friction=.85,enabled=true){
  const p=body.particles;
  const oldX=p[0].x;
  body.time+=motorStepTime;
  for(const part of p){
    const x=part.x,y=part.y;
    part.x+=(part.x-part.px)*.995;
    part.y+=(part.y-part.py)*.995-9.81*motorStepTime**2;
    part.px=x;part.py=y;part.ground=false;
  }
  const phase=body.time/.32;
  const first=Math.floor(phase)%8, next=(first+1)%8, mix=phase%1;
  const targets=motorAngles.map(([,,,min,max],i)=>{
    const value=body.policy[first*8+i]*(1-mix)+body.policy[next*8+i]*mix;
    return min+(max-min)*value;
  });
  for(let loop=0;loop<5;loop++){
    for(const [a,b,length] of motorBones)keepLength(p[a],p[b],length);
    motorAngle(p[0],p[1],p[2],0);
    if(enabled)motorAngles.forEach(([a,b,c],i)=>motorAngle(p[a],p[b],p[c],targets[i]));
    for(const part of p)floorContact(part,friction);
  }
  body.delta=p[0].x-oldX;
  body.travel=p[0].x;
  body.height=p[0].y;
  body.theta=Math.atan2(p[1].x-p[0].x,p[1].y-p[0].y);
  for(let side=0;side<2;side++)if(p[side?6:4].ground)body.footSupport[side]=body.time;
  for(const [side,foot] of [[0,4],[1,6]]){
    const part=p[foot];
    if(part.y>part.r+.030&&!body.lift[side]){body.lift[side]=true;body.liftX[side]=part.x;}
    if(part.ground&&body.lift[side]){
      const advanced=part.x-body.liftX[side];
      const upright=body.height>.205&&Math.abs(body.theta)<.77;
      const supported=body.time-body.footSupport[1-side]<.115;
      if(upright&&supported)body.footWork+=Math.max(0,Math.min(.08,advanced));
      if(advanced>.024&&supported&&upright&&body.lastFoot!==side){
        body.strikes++;body.steps[side]++;body.lastFoot=side;
      }
      body.lift[side]=false;
    }
  }
  for(let side=0;side<2;side++){
    const offset=side*11;
    const knee=side?5:3,foot=knee+1,elbow=side?9:7,hand=elbow+1;
    const thigh=Math.atan2(p[knee].x-p[0].x,p[0].y-p[knee].y);
    const shin=Math.atan2(p[foot].x-p[knee].x,p[knee].y-p[foot].y);
    body.joints[offset]=Math.max(0,Math.min(1.5,1-Math.atan2(p[hand].x-p[1].x,p[1].y-p[hand].y)*.55));
    body.joints[offset+1]=Math.min(1.8,Math.abs(targets[side?7:5]));
    body.joints[offset+2]=-thigh;
    body.joints[offset+3]=Math.max(0,wrapMotor(thigh-shin));
    body.joints[offset+5]=Math.max(-.65,Math.min(.65,-shin));
  }
  body.pace=Math.abs(body.delta)/motorStepTime;
  return body;
}
