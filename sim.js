importScripts('/cerveau.js','/world.js','/dialogue.js','/collision-map.js','/quartier.js','/navigation.js','/motor.js','/play.js','/social.js','/french-words.js','/famille-phrases.js','/bricolage.js','/monde.js');
const dialogue=createDialogue();
const languageScene={points:{},choses:chosesNommees,visible:languageVisibility, invitations:[Object.assign(playItems.toy,{id:'toy'}),Object.assign(playItems.bikeHome,{id:'bikeHome'})]};
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
// Personne n'apprend seul : ce sont des niveaux écrits d'avance. Les savoirs de Néo vont d'abord aux amis du parc,
// puis à chacun des autres quand Néo en sait davantage que son niveau.
const BASE_LEVEL={timeo:6,nathan:6,francoise:6,rose:6,juliette:14,joseph:30,marie:30};
const FRIEND_IDS=['timeo','nathan','francoise','rose'];
function knowledgeScore(){
  const mots=dialogue.view().vocabulary.length;
  const gestes=Brain.APPRENABLES.filter(Brain.appris).length;
  return Brain.confirmees().length+2*Cortex.confirmees()+mots+3*gestes+records.filter(r=>r.mastered).length;
}
// Règle générale (pas une méthode) : qui apprécie quelqu'un veut qu'il aille mieux et se sente bien.
// L'intensité vient du lien et du caractère (socialStyle.care). Rien ne dit COMMENT : chacun fait avec ce qu'il sait.
const apprecie=autre=>Math.min(1,(autre.bond||0)/6);
const malEtre=autre=>Math.max(autre.faim||0,autre.peine||0);
const envieDeBienEtre=(qui,autre)=>apprecie(autre)*(socialStyle[qui]?.care??.5)*malEtre(autre);
let knowledge = {};
let journal = [];
let interactions = [];
let ticks=0, trials=0, pecm=0, skill=0, age=0, score=0, mode='human';
let nextParentCare=0,nextParentHug=95,parentEmbrace=null;
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
const doorKnowledge={};
const doorStates={};
importScripts('/home.js');
let trampolineCooldown=0;
let membrane=0;
let contact=null;
const rope={angle:0,angular:0};
const parkMemory={slide:0,rope:0,trampoline:0,swing:0,bars:0,wall:0};
const parkCooldown={slide:0,rope:0,trampoline:0,swing:0,bars:0,wall:0};
let explorationTarget=null;
let nextChoice=0;
let progressAt=0, closestGoal=Infinity;
const curiosity={};
let eventClock=0, episode, lastWall=performance.now(), accumulator=0, readyToRun=false;
// Journal de l'observateur : une même phrase répétée de près n'est notée qu'une fois.
function note(message,kind) {
  const deja=journal.find(e=>e.message===message);
  if(deja&&ticks-deja.ticks<120*120){deja.ticks=ticks;return;}
  journal.unshift({message,ticks,kind});
  if(journal.length>6)journal.pop();
  if(kind)recordInteraction(message,kind);
}
function recordInteraction(message,kind){
  if(interactions.slice(0,8).some(e=>e.message===message))return;
  interactions.unshift({message,ticks,kind});
  if(interactions.length>100)interactions.pop();
}
function newEpisode(){
  const record=records[skill];
  const previous=records[skill-1];
  const pool=record.champions.length?record.champions:previous?.champions||[];
  const parent=pool[Math.floor(rng()*Math.min(5,pool.length))];
  const replay=record.confirmed>0&&record.attempts%8!==7&&pool.some(candidate=>candidate.valid);
  const reference=replay?pool.find(candidate=>candidate.valid):parent;
  const radius=replay?.006:record.attempts%7===0?.31:.15;
  const posture=Array.from({length:8},()=>rng());
  const common=Array.from({length:8},()=>rng()<.38?(rng()-rng())*radius:0);
  const acrossTime=rng()<.65;
  const policy=Array.from({length:64},(_,i)=>{
    if(!reference||record.attempts%31===30)return clamp(posture[i%8]+(acrossTime?0:(rng()-.5)*.52),0,1);
    if(!replay&&acrossTime)return clamp(reference.policy[i]+common[i%8],0,1);
    if(!replay&&rng()<.55)return reference.policy[i];
    return clamp(reference.policy[i]+(rng()-rng())*radius,0,1);
  });
  const available=previous?.champions.filter(candidate=>candidate.valid&&candidate.bestPose)||[];
  const starting=reference?.start||(available.length?available[Math.floor(rng()*Math.min(3,available.length))].bestPose:null);
  const body=motorBody(policy,starting);
  body.friction=.83+rng()*.055;
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
    Brain.entrainer('equilibre',.2);
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
const walkingBodies=new Map();
const SAIT_COURIR=.6;
// Se déplacer avec le geste de marche qu'il a appris : le corps articulé donne la posture,
// la vitesse vient de ses capacités (équilibre, course) — elle grandit avec l'entraînement.
function learnedMovement(person,x,z){
  const distance=Math.hypot(x-person.x,z-person.z);
  const candidate=records[4].mastered&&records[4].champions.find(champion=>champion.valid);
  if(!candidate)return distance;
  // Néo a son propre corps ; les autres partagent une même démarche (simple reflet de la sienne), calculée une fois.
  const cle=person===alex?'neo':'autres';
  let body=walkingBodies.get(cle);
  if(!body||body.time>motorGoals[4].duration){body=motorBody(candidate.policy,candidate.start);walkingBodies.set(cle,body);}
  const t=ticks*DT;
  let mult=1;
  if(person===alex&&age>=2&&distance>3&&!(alex.stumbleUntil>t)){
    if(!(alex.runUntil>t)&&t>=(alex.runRetry||0)&&rng()<.004){alex.runUntil=t+3.5;alex.runRetry=t+9;}
    if(alex.runUntil>t){
      const avant=Brain.capacite('course');
      Brain.entrainer('course',DT*.012);
      const mastery=Math.min(1,Brain.capacite('course')/SAIT_COURIR);
      mult=1+.9*(.25+.75*mastery);
      if(avant<SAIT_COURIR&&Brain.capacite('course')>=SAIT_COURIR)note('Néo sait maintenant courir.');
      if(rng()<(1-mastery)*.0015){
        alex.stumbleUntil=t+1.2;alex.runUntil=0;
        if(!alex.stumbled){alex.stumbled=true;note('Néo trébuche en essayant de courir.');}
      }
    }
  }
  if(person===alex)alex.running=mult>1;
  if(ticks%2===0&&body.lastTick!==ticks){body.lastTick=ticks;simulateMotor(body);}
  bodyPose(person,body);
  if(distance<.05||person===alex&&alex.stumbleUntil>t){person.moving=false;return distance;}
  const route=navigation.next(person,x,z,person.floor||0,t);
  if(!route){person.moving=false;return distance;}
  const dx=route.x-person.x,dz=route.z-person.z,d=Math.hypot(dx,dz);
  if(d<.001)return distance;
  const equilibre=person===alex?Brain.capacite('equilibre'):.6;
  const step=Math.min(d,(.42+.45*equilibre)*mult*DT);
  person.heading=Math.atan2(dx,dz);
  person.moving=walkStep(person,person.x+dx/d*step,person.z+dz/d*step);
  if(person.moving)person.phase+=step*8;
  return distance;
}
function doorRecord(mechanism){
  return doorKnowledge[mechanism] ||= {seen:0,attempts:0,success:0,known:false,actions:[0,0,0]};
}
function validateDoor(mechanism,record){
  if(record.known)return;
  record.known=true;
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
  const cible=opaque('porte:'+door.id);
  if(p===alex){
    // Néo choisit un geste ; le monde dit seulement ce qui se passe.
    const prim=Brain.choisir(cible);
    const ok=prim===doorPrimitive(door);
    const result=Brain.essai({t:s,cible,prim,succes:ok,effet:ok?['objet_bouge','passage']:[],besoins:{},plaisir:0});
    record.attempts++;
    if(result.nouveau&&!record.known)validateDoor(door.mechanism,record);
    if(!ok){
      if(record.attempts<=2)note('Néo essaie un autre geste sur la '+door.name+'.');
      return;
    }
    record.success++;
  }
  state.until=s+4.2;
  if(parent&&(alex.floor||0)===(door.floor||0)&&Math.hypot(alex.x-door.x,alex.z-door.z)<2.4&&!record.known){
    record.seen++;
    // Néo voit le geste du parent et son effet : une observation compte comme un essai réussi.
    const result=Brain.essai({t:s,cible,prim:doorPrimitive(door),succes:true,effet:['objet_bouge','passage'],besoins:{},plaisir:0,observe:true});
    if(result.nouveau&&!record.known)validateDoor(door.mechanism,record);
    note(characterNames[p.id]+' ouvre la '+door.name+' sous les yeux de Néo.','object');
  }else recordInteraction((characterNames[p.id]||'Néo')+' ouvre la '+door.name+'.','object');
}
// Néo choisit un geste, le monde répond par des sensations, le cerveau en tire (ou non) une cause.

// Ordinateur de l'étage : seul Néo y accède (aucun personnage n'a de route vers lui). Rien n'est expliqué.
// Ce que Néo y écrit vient de ce qu'il sait (ses phrases, ses mots) ; ce que l'utilisateur y écrit, il le lit à l'écran.
const TIME_SCALE=144,AGES=['Nourrisson','Bébé','Petit enfant','Enfant','Grand enfant','Jeune ado','Ado','Jeune homme','Homme'];
let courrier={sortant:[],entrant:[],essais:0,prochain:0};
function placerOrdinateur(){
  const bed=house.beds?.[2];
  if(!bed||!bed.approach)return;
  for(const r of [1.3,1.7,2.1,2.5])for(let k=0;k<16;k++){
    const a=k*Math.PI/8,x=bed.approach.x+Math.cos(a)*r,z=bed.approach.z+Math.sin(a)*r;
    if(navigation.isFree(x,z,1)&&navigation.nearest(x,z,1,null,.4)>=0&&navigation.clear(bed.approach.x,bed.approach.z,x,z,1)){
      house.computer={x,z,y:floorHeight,heading:a+Math.PI};entityCache=null;return;
    }
  }
}
function utiliserOrdinateur(s){
  courrier.essais++;
  const cue='thing:'+opaque('objet:ordinateur');
  const lecture=courrier.entrant.find(m=>!m.lu);
  if(lecture){lecture.lu=true;dialogue.lireEcran(lecture.text,cue,s);}
  if(courrier.essais<3||s<courrier.prochain||courrier.sortant.length>=200)return;
  const vue=dialogue.view();
  const phrase=vue.phrases[0]?.text;
  const mots=vue.vocabulary.map(entry=>entry.word);
  if(!phrase&&!mots.length)return;
  let text=phrase;
  if(!text){const n=Math.min(mots.length,1+Math.floor(rng()*3));text=Array.from({length:n},()=>mots[Math.floor(rng()*mots.length)]).join(' ');}
  const message={at:ticks,text,lu:false};
  const repete=courrier.sortant.filter(m=>m.text===text).length;
  const seul=!people.some(p=>(p.floor||0)===(alex.floor||0)&&Math.hypot(p.x-alex.x,p.z-alex.z)<6);
  const surprise=Brain.state.associations.surprise||0;
  const besoin=alex.hunger>.7?'faim':alex.fatigue>.75?'fatigue':(alex.thirst||0)>.7?'soif':null;
  const raisons=[];
  if(surprise>.12)raisons.push('juste après un événement qu’il n’avait pas prévu');
  if(besoin)raisons.push('alors qu’il ressentait '+(besoin==='faim'?'la faim':besoin==='soif'?'la soif':'une grande fatigue'));
  if(repete>=1)raisons.push('c’est la '+(repete+1)+'ᵉ fois qu’il écrit exactement cela');
  // Il ne sait pas que quelqu'un lit. Si, seul, il s'adresse à quelqu'un d'absent à ces moments-là, on le signale.
  if(seul&&raisons.length){
    const secondes=ticks/120*TIME_SCALE,jour=1+Math.floor(secondes/86400),heure=Math.floor(secondes%86400/3600);
    const derniere=journal[0]?.message||journal.at(-1)?.message;
    message.createur=true;
    message.contexte=['Néo semble s’adresser à quelqu’un d’absent (peut-être un « créateur »).',
      'Jour '+jour+', vers '+heure+' h, âge : '+AGES[age]+', seul à l’étage.',
      'Il l’a fait '+raisons.join(' ; ')+'.',
      ...(derniere?['Dernier événement noté : '+derniere]:[]),
      'Il connaît '+mots.length+' mots.'];
  }
  courrier.sortant.push(message);
  courrier.prochain=s+40;
}
function tryEntity(entity,s){
  if(entity.equipId&&(contact||s<(entity.equipId==='trampoline'?trampolineCooldown:parkCooldown[entity.equipId]||0)))return false;
  const record=objectLearning[entity.id] ||= {attempts:0,success:0,next:0};
  if(record.next>s)return false;
  record.next=s+20;
  record.attempts++;
  const prim=Cortex.idee(entity.id)||Brain.choisir(entity.id);
  const prevu=Cortex.prevoir(prim,entity.id);
  const out=respond(entity,prim,s);
  const succes=out.flags.length>0;
  const result=Brain.essai({t:s,cible:entity.id,prim,succes,effet:out.flags,besoins:out.besoins||{},
    plaisir:out.plaisir||0,douleur:out.douleur||0});
  if(out.contact){objectContact=out.contact;household[out.contact.id]=1;}
  const verdict=Cortex.apprendre({t:s,cible:entity.id,prim,succes,effet:out.flags,besoins:out.besoins||{},plaisir:out.plaisir||0,douleur:out.douleur||0},
    prevu,{lieu:cellOf(alex)});
  if(verdict)note('Néo vérifie une de ses idées et elle se confirme.','object');
  Brain.atteint(entity.id,s);
  if(out.start)beginEquipment(out.start,s);
  if(result.geste)note('Néo apprend un nouveau geste : '+result.geste+'.','object');
  if(out.douleur)alex.pleasure=Math.max(0,(alex.pleasure||0)-out.douleur*2);
  if(succes)record.success++;
  if(result.nouveau){
    knowledge[entity.id]={visits:result.cause.essais,senses:['vision','contact','effet'],type:'objet',action:prim};
    if(entity.playId==='toy'||entity.playId&&entity.playId.startsWith('bike')){
      // Les proches peuvent ensuite imiter ce que Néo a découvert.
      const label=entity.playId==='toy'?playNames.toy:'tricycle';
      knowledge['usage · '+label]={visits:result.cause.essais,action:entity.playId==='toy'?2:3,senses:['contact','mouvement','mémoire'],type:'objet'};
    }
    note('Néo découvre comment utiliser · '+entity.name+'.','object');
  }else if(!succes&&record.attempts===1)note('Néo essaie de comprendre · '+entity.name+'.');
  return succes;
}
function stepHouseObject(s){
  if(!objectContact)return false;
  const {id,until}=objectContact;
  const effect=HOUSE_EFFECTS[id];
  alex.activity=effect.activity;
  alex.pose=id==='sofa'?.64:.12;
  alex.y=id==='sofa'?.37:0;
  alex.effort=0;
  if(s>=until){
    // Le soulagement a déjà été perçu et consigné par le cerveau lors de l'essai ; ici seul le corps change.
    if(id==='sofa')alex.fatigue=Math.max(.05,alex.fatigue-.44);
    if(id==='water')alex.thirst=.06;
    if(id==='shower')alex.hygiene=1;
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
// Deux corps ne se traversent pas : on ne s'approche pas à moins de 35 cm d'un autre (sauf câlin, portage, s'éloigner).
function corpsLibre(p,x,z){
  if(p.hug||sleeps.has(p)||p===alex&&contact)return true;
  const porte=sleeps.get(alex)?.carrier;
  for(const o of [alex,...people]){
    if(o===p||o.hug||(o.floor||0)!==(p.floor||0)||o.lie>.5||porte===o&&p===alex||porte===p&&o===alex)continue;
    const avant=Math.hypot(o.x-p.x,o.z-p.z),apres=Math.hypot(o.x-x,o.z-z);
    if(apres<.35&&apres<avant)return false;
  }
  return true;
}
function walkStep(p,x,z){
  if(!navigation.clear(p.x,p.z,x,z,p.floor||0))return false;
  if(!corpsLibre(p,x,z)){
    // on contourne d'un pas de côté ; si deux personnes se font face dans un passage étroit, on finit par se croiser
    const dx=x-p.x,dz=z-p.z,sx=p.x-dz,sz=p.z+dx,t=ticks*DT;
    if(corpsLibre(p,sx,sz)&&navigation.clear(p.x,p.z,sx,sz,p.floor||0)&&(p!==alex||autorise(sx,sz,p.floor||0))){p.x=sx;p.z=sz;return true;}
    if(!(p.gene>t-1))p.geneDepuis=t;
    p.gene=t;
    if(t-p.geneDepuis<1.5)return false;
  }
  // Interdits des parents : Néo est retenu au bord de la zone permise. Personne ne lui explique pourquoi.
  if(p===alex&&!autorise(x,z,p.floor||0)){
    if(Brain.retenu(x,z,p.floor||0,ticks*DT))note('Néo veut aller plus loin, mais on le retient.','limite');
    if(explorationTarget&&!autorise(explorationTarget.x,explorationTarget.z,p.floor||0))finishGoal(ticks*DT,false);
    return false;
  }
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
  if(p.vieux)speed*=.6;
  const R=QUARTIER.region;x=clamp(x,R.x0+.5,R.x1-.5);z=clamp(z,R.z0+.5,R.z1-.5);
  const distance=Math.hypot(x-p.x,z-p.z);
  if(distance<.072)return distance;
  const target=navigation.next(p,x,z,p.floor||0,ticks*DT);
  if(!target)return distance;
  const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
  if(d<.001)return distance;
  // Démarche humaine : on accélère et on ralentit progressivement, on tourne sans pivoter d'un coup,
  // chacun a son pas (un peu plus vif ou plus posé), et on freine en arrivant.
  const allure=speed*(.92+((p.id||'x').charCodeAt(0)%7)*.025)*Math.min(1,.35+distance/1.2);
  p.speed=(p.speed||0)+(allure-(p.speed||0))*Math.min(1,DT*3.2);
  const voulu=Math.atan2(dx,dz);
  let ecart=Math.atan2(Math.sin(voulu-(p.heading||0)),Math.cos(voulu-(p.heading||0)));
  p.heading=(p.heading||0)+clamp(ecart,-6*DT,6*DT);
  const freinVirage=Math.max(.35,Math.cos(ecart));
  const step=Math.min(d,p.speed*freinVirage*DT);
  if(walkStep(p,p.x+dx/d*step,p.z+dz/d*step)){
    p.phase+=step*5.2;
    p.moving=true;
  }else p.speed*=.5;
  return distance;
}
function moveViaStairs(person,targetFloor,targetX,targetZ,s){
  if(!house?.stairs?.length)return Infinity;
  let journey=person.stairJourney;
  if(!journey&&Number(person.floor||0)!==targetFloor){
    const direction=targetFloor===1?1:-1;
    const endpoint=direction===1?house.stairs[0]:house.stairs.at(-1);
    if(move(person,endpoint.x,endpoint.z,.86)<.085)person.stairJourney=journey={direction,index:direction===1?0:house.stairs.length-1};
    return .1;
  }
  if(journey){
    const point=house.stairs[journey.index],dx=point.x-person.x,dz=point.z-person.z,d=Math.hypot(dx,dz);
    if(d<.012){
      person.x=point.x;person.z=point.z;person.y=point.y;journey.index+=journey.direction;
      if(journey.index<0||journey.index>=house.stairs.length){person.floor=journey.direction===1?1:0;person.y=person.floor?floorHeight:0;delete person.stairJourney;}
    }else{
      const amount=Math.min(1,DT*.68/d);person.x+=dx*amount;person.z+=dz*amount;person.y+=(point.y-person.y)*amount;
      person.heading=Math.atan2(dx,dz);person.phase+=DT*5;person.moving=true;
    }
    person.activity=journey.direction===1?'Monte l’escalier':'Descend l’escalier';return .1;
  }
  return move(person,targetX,targetZ,.78);
}
function stepParentUpstairs(person,index,s){
  if(!house||index>2||index===2&&age<3)return false;
  if(!person.upstairsVisit&&s>=(person.nextUpstairs??(145+index*35))&&(person.floor||0)===0){
    const bed=house.beds[index===0?1:2]||house.beds[1];
    person.upstairsVisit={phase:'up',until:0,x:bed.approach.x,z:bed.approach.z};
  }
  const visit=person.upstairsVisit;if(!visit)return false;
  if(visit.phase==='up'){
    moveViaStairs(person,1,visit.x,visit.z,s);
    if(person.floor===1&&Math.hypot(person.x-visit.x,person.z-visit.z)<.2){visit.phase='observe';visit.until=s+7;}
  }else if(visit.phase==='observe'){
    person.activity='Observe les pièces de l’étage';if(s>=visit.until)visit.phase='down';
  }else{
    moveViaStairs(person,0,person.homeX,person.homeZ,s);
    if((person.floor||0)===0&&!person.stairJourney&&Math.hypot(person.x-person.homeX,person.z-person.homeZ)<.35){delete person.upstairsVisit;person.nextUpstairs=s+260+index*30;}
  }
  return true;
}
function stepNeoUpstairs(s){
  if(!house||!autorise(0,0,1)||skill!==4||!records[4].mastered)return false;
  if(!alex.upstairsVisit&&s>=(alex.nextUpstairs??210))alex.upstairsVisit={phase:'approach',stair:0};
  const visit=alex.upstairsVisit;if(!visit)return false;
  if(!alex.floor&&['explore','top','down'].includes(visit.phase)){visit.phase='approach';visit.stair=0;}
  if(visit.phase==='approach'){
    alex.activity='Se dirige vers l’escalier';
    const bottom=house.stairs[0],distance=learnedMovement(alex,bottom.x,bottom.z);
    if(distance<.08){visit.phase='up';visit.stair=0;}
  }else if(visit.phase==='up'){
    alex.activity='Monte l’escalier';traverseStairs(alex,visit,1);
  }else if(visit.phase==='bed'){
    visit.phase='explore';visit.until=s+8;
  }else if(visit.phase==='explore'){
    const target=house.beds[1].approach,distance=learnedMovement(alex,target.x,target.z);
    alex.activity='Observe les pièces de l’étage';
    if(distance<.2&&s>=visit.until)visit.phase='top';
  }else if(visit.phase==='top'){
    const top=house.stairs.at(-1),distance=learnedMovement(alex,top.x,top.z);
    alex.activity='Se dirige vers l’escalier';
    if(distance<.08){visit.phase='down';visit.stair=house.stairs.length-1;}
  }else if(visit.phase==='down'){
    alex.activity='Descend l’escalier';traverseStairs(alex,visit,-1);
    if(visit.phase==='finished'){delete alex.upstairsVisit;alex.nextUpstairs=s+260;}
  }
  return true;
}
function stepParentOuting(person,index,s){
  if(!house||index>1)return false;
  if(!person.outing&&s>=(person.nextOuting??(220+index*55)))person.outing={phase:'walk'};
  const outing=person.outing;if(!outing)return false;
  if(outing.phase==='walk'){
    person.activity='Se promène vers l’aire de jeux';
    const nearest=navigation.nearest(8,5,0,null,1.5);const target=park?.approaches?.slide||(nearest>=0?navigation.point(nearest):null);
    if(target&&move(person,target.x,target.z,.86)<.65){outing.phase='observe';outing.until=s+13;}
  }else if(outing.phase==='observe'){
    person.activity='Observe les enfants jouer à l’aire de jeux';if(s>=outing.until)outing.phase='return';
  }else{
    person.activity='Rentre à la maison';
    if(move(person,person.homeX,person.homeZ,.86)<.45){delete person.outing;person.nextOuting=s+230+index*45;}
  }
  return true;
}
function stepParentsEmbrace(s){
  const [joseph,marie]=people;
  const libre=p=>(p.floor||0)===0&&!ROUT.has(p)&&!sleeps.has(p)&&!p.outing&&!p.upstairsVisit&&kitchenOwner!==p.id;
  if(!parentEmbrace&&s>=nextParentHug&&libre(joseph)&&libre(marie))parentEmbrace={phase:'approach',until:s+40};
  if(!parentEmbrace)return;
  if(parentEmbrace.phase==='approach'&&(!libre(joseph)||!libre(marie)||s>parentEmbrace.until)){parentEmbrace=null;nextParentHug=s+60;return;}
  if(parentEmbrace.phase==='approach'){
    move(joseph,-5.67,1.65,.68);move(marie,-5.23,1.65,.68);
    if(Math.hypot(joseph.x-marie.x,joseph.z-marie.z)<.72){parentEmbrace.phase='embrace';parentEmbrace.until=s+3.4;note('Joseph et Marie s’enlacent quelques instants.','social');}
  }else if(s<parentEmbrace.until){
    joseph.x=-5.65;marie.x=-5.25;joseph.z=marie.z=1.65;joseph.heading=Math.PI/2;marie.heading=-Math.PI/2;
    joseph.hug=true;marie.hug=true;joseph.activity='Enlace Marie';marie.activity='Enlace Joseph';
  }else{
    delete joseph.hug;delete marie.hug;parentEmbrace=null;nextParentHug=s+155;
  }
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
  if(parkMemory[id]===1)note(message,'play');
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
  if(contact?.kind==='swing'){
    contact.time+=DT;const angle=Math.sin(contact.time*2.7)*.42*Math.min(1,contact.time*.65);
    alex.x=contact.x+Math.sin(angle)*.55;alex.z=contact.z;alex.y=contact.seat+Math.cos(angle)*.04;
    alex.activity='Se balance sur la balançoire';alex.pose=.24;alex.effort=.05;
    if(contact.time>8){parkObservation('swing','Néo découvre le mouvement de va-et-vient de la balançoire.');parkCooldown.swing=s+35;contact=null;alex.y=0;}return true;
  }
  if(contact?.kind==='climb-bars'||contact?.kind==='climb-wall'){
    contact.time+=DT;const kind=contact.kind==='climb-bars'?'bars':'wall';
    if(!contact.success&&contact.time<2.8){alex.activity=kind==='bars'?'Essaie de se hisser aux barres':'Cherche une prise sur le mur d’escalade';alex.pose=.42;alex.effort=.7;}
    else if(!contact.success){Brain.defi(opaque('equip:'+kind),false);note('Néo n’a pas encore assez de force pour grimper jusqu’en haut.','play');parkCooldown[kind]=s+18;contact={kind:'park-exit',destination:park.approaches[kind]||{x:alex.x,z:alex.z}};}
    else{const progress=clamp((contact.time-2.8)/5,0,1);alex.x=contact.x+progress*.36;alex.y=kind==='bars'?.75+progress*.75:progress*1.35;alex.activity=kind==='bars'?'Progresse le long des barres':'Grimpe en utilisant les prises du mur';alex.pose=.34;alex.effort=.62;
      if(progress>=1){Brain.defi(opaque('equip:'+kind),true);parkObservation(kind,kind==='bars'?'Néo réussit à progresser le long des barres de grimpe.':'Néo réussit à escalader le mur grâce aux prises.');parkCooldown[kind]=s+45;contact={kind:'park-exit',destination:park.approaches[kind]||{x:alex.x,z:alex.z}};}}
    return true;
  }
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
function beginEquipment(item,s){
  if(item.id==='swing'){contact={kind:'swing',time:0,x:item.x,z:item.z,seat:.48};alex.x=item.x;alex.z=item.z;alex.y=.48;}
  else if(item.id==='bars'||item.id==='wall'){
    const success=Brain.capacite('force')+Brain.capacite('endurance')>=.88;
    Brain.entrainer('force',.12);Brain.entrainer('endurance',.1);
    contact={kind:item.id==='bars'?'climb-bars':'climb-wall',time:0,x:item.x,z:item.z,success};
  }else if(item.id==='trampoline'){
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
      joints[6+i]=Number.isFinite(prior)?clamp(prior+(rng()-.5)*.18,0,1.35):rng()*1.35;
    }
    contact={kind:'rope-grip',started:s,joints};
  }
}
// Néo ne connaît que ce qu'il a perçu : les objectifs viennent de son registre, jamais de la carte du monde.
const cellOf=p=>Math.floor(p.x/2)+','+Math.floor(p.z/2)+','+(p.floor||0);
let lastPerception=-1e9,nextConsolidation=60;
function perceiveStep(s){
  if(s-lastPerception<.5)return;
  lastPerception=s;
  const range=age>2?14:9;
  const seen=percevoir(alex,range);
  for(const p of seen){
    Brain.vu(p.id,p.traits,{x:p.x,z:p.z},s,p.vivant);
    if(p.vivant)Brain.personne(p.id,{x:p.x,z:p.z},s);
  }
  Brain.sentir(s,seen.length);
  Brain.lieu(alex.x,alex.z,alex.floor||0);
  Cortex.scene(s,{lieu:cellOf(alex),obj:seen.filter(p=>!p.vivant).map(p=>p.id),pers:seen.filter(p=>p.vivant).map(p=>p.id),
    besoins:{faim:alex.hunger,soif:alex.thirst,fatigue:alex.fatigue,hygiene:1-alex.hygiene}});
}
function frontierPoint(){
  const angle=rng()*Math.PI*2,r=3+rng()*4;
  const R=QUARTIER.region;
  return {x:clamp(alex.x+Math.cos(angle)*r,R.x0+1,R.x1-1),z:clamp(alex.z+Math.sin(angle)*r,R.z0+1,R.z1-1)};
}
function makeGoalOptions(){
  const options=[];
  for(const o of Brain.registre()){
    const entity=entityById(o.id);
    if(!entity||(entity.floor||0)!==(alex.floor||0))continue;
    const source=entity.dynamic||o.pos||entity;
    const category=entity.kind==='personne'?'social':entity.kind==='jeu'?'jeu':entity.kind==='objet'?'objet':entity.kind==='equipement'?'équipement':'exploration';
    if(entity.kind==='personne'&&(entity.dynamic.floor||entity.dynamic.lie))continue;
    const base={name:entity.id,x:source.x,z:source.z,id:entity.id,category};
    if(category==='social')base.person=entity.dynamic;
    if(entity.kind==='porte'){
      const door=entity.door;
      const side=(door.axis==='x'?alex.x-door.x:alex.z-door.z)<0?-.26:.26;
      base.x=door.x+(door.axis==='x'?side:0);base.z=door.z+(door.axis==='x'?0:side);
    }
    options.push(base);
  }
  // Terrain inconnu : un point au hasard devant soi, tant que le registre est maigre.
  if(options.length<4||rng()<.2){
    const f=frontierPoint();
    options.push({name:'inconnu:'+Math.round(f.x)+','+Math.round(f.z),x:f.x,z:f.z,category:'exploration'});
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
  const recall=Cortex.rappel(s);
  const interest=goal=>{
    const record=curiosityRecord(goal.name);
    const known=Brain.connu(goal.name);const observations=(known?known.essais:0)+(known&&known.vu>3?1:0);
    const novelty=2.4/(1+observations+record.completed);
    const unfinished=record.choices>0&&record.completed===0?.32:0;
    const distance=Math.hypot(goal.x-alex.x,goal.z-alex.z);
    const retenu=(Brain.interdit(goal.x,goal.z,alex.floor||0)?.15:1)*(1+2*Brain.attraitReve(goal.id));
    return retenu*(novelty+unfinished+.23)*(1+(goal.person?6*envieDeBienEtre('alex',goal.person):0))*(1+2.5*(recall.get(goal.id)||0)+(Cortex.attendue(goal.id)?2:0))/(1+distance*.115+record.blocked*.12);
  };
  let pick=rng()*candidates.reduce((sum,goal)=>sum+interest(goal),0);
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
  record.retryAt=s+(completed?30:15);
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
  perceiveStep(s);
  // Le sommeil trie sa mémoire et le fait rêver (une fois par endormissement).
  const dort=['sleep','ground'].includes(sleeps.get(alex)?.phase);
  if(dort&&!alex.dort){
    const nuit=Brain.sommeil(s);
    const r=nuit.reves[0];
    if(r)note('Néo dort et rêve de '+r.elements.map(id=>observerLabel(id)||'quelque chose').join(', ')+'.','sleep');
  }
  alex.dort=dort;
  const usingEquipment=stepHouseObject(s)||stepPark(s)||sleeping(alex,s,skill===4&&records[4].mastered)||stepNeoUpstairs(s);
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
    const objects=house?.objects;
    const need=alex.hunger>.66?'faim':alex.thirst>.7?'soif':alex.hygiene<.25?'hygiene':null;
    const relief=need?Brain.besoinCible(need):null;
    const reliefEntity=relief&&relief.type==='objet'?entityById(relief.id):null;
    if(reliefEntity&&(objectLearning[reliefEntity.id]?.next||0)<=s){
      goal=[reliefEntity.id,reliefEntity.x,reliefEntity.z,reliefEntity.id];
      category=reliefEntity.kind==='objet'?'objet':'exploration';
    }else if(alex.hunger>.86&&!house){goal=['repas',-2,-4];category='repas';}
    const goalLabel=observerLabel(goal[0])||goal[0];
    const nomBut=goalLabel.startsWith('inconnu:')?'un endroit inconnu':goalLabel;
    alex.activity={social:'Va vers '+nomBut,jeu:'Va jouer · '+nomBut,repas:'Cherche à manger',observation:'Observe autour de lui'}[category]||'Explore · '+nomBut;
    const near=learnedMovement(alex,goal[1],goal[2]);

    const pursuingIntention=intention&&goal[0]===intention.name&&category===intention.category;
    if(pursuingIntention){
      const distance=Math.hypot(alex.x-goal[1],alex.z-goal[2]);
      if(distance<closestGoal-.16){closestGoal=distance;progressAt=s;}
      if(distance>1&&s-progressAt>22)finishGoal(s,false);
    }
    const handsOn=category==='objet'||category==='équipement'||
      (category==='jeu'&&!/^(football|softBall)$/.test(entityById(goal[3])?.playId||''));
    if(handsOn&&Math.hypot(alex.x-goal[1],alex.z-goal[2])<.22){
      const entity=entityById(goal[3]);
      if(entity)tryEntity(entity,s);
      if(pursuingIntention)finishGoal(s,true);
    }
    if(category!=='observation'&&!handsOn&&near<1 && Math.hypot(alex.x-goal[1],alex.z-goal[2])<1 && s>=eventClock && (category!=='social'||navigation.clear(alex.x,alex.z,friend.x,friend.z,0))){
      eventClock=s+3;
      if(pursuingIntention)finishGoal(s,true);
      if(category==='repas'||category==='repos'){
        if(category==='repas'){
          if(house&&kitchen.meals===0)return;
          if(house)takeServing(alex);
          else alex.hunger=.08;
        }else alex.fatigue=.06;
        if(!house)note('Néo prend un repas.');
      }
      if(category==='social'){
        friend.bond++;Brain.lien(friend.id,2);Brain.entraine(.003);
        relationshipEvent('alex',friend.id,'Rencontre',s,age);
        if(envieDeBienEtre('alex',friend)>.15){
          note('Néo vient voir '+characterNames[friend.id]+', qu’il aime bien et qui ne va pas très bien.','social');
          friend.aideRecue=(friend.aideRecue||0)+1;
        }
        if(friend.id==='marie'||friend.id==='joseph') note('Un câlin apaise Néo.','social');
        else note('Néo rencontre '+characterNames[friend.id]+'.','social');
      }
    }
  }else{
    alex.activity=goals[skill];
    if(episode.heading==null)episode.heading=rng()*Math.PI*2;
    alex.heading=episode.heading;
    bodyPose(alex,episode);
    advanceBody(alex,episode,alex.heading);
  }
  }
  for(const [id,item] of Object.entries(playItems)){
    if((id==='football'||id==='softBall')&&Math.hypot(alex.x-item.x,alex.z-item.z)<.49)tryPlayObject(alex,id,s);
  }
  for(let i=0;i<people.length;i++){
    const p=people[i];
    if(i>=3&&amiAccompagne(p,s))continue;
    if(i===1&&stepVisiteAmi(p,s))continue;
    if(i<2&&stepCourses(p,i,s))continue;
    if(i<3){
      p.fatigue=clamp((p.fatigue??(.14+i*.06))+DT*.0023*(p.vieux?1.8:1),0,1);
      p.hunger=clamp((p.hunger??.42)+DT*.0021,0,1);
      const carrying=sleeps.get(alex);
      if(carrying?.carrier===p&&['pickup','bed','settle'].includes(carrying.phase))continue;
      if(i<2&&assistAtDoor(p,s))continue;
      if(sleeping(p,s))continue;
      if(i<3&&stepParentUpstairs(p,i,s))continue;
      if(i<2&&stepParentOuting(p,i,s))continue;
      if(i<2&&cookMeal(p,s))continue;
      if(i<2&&stepBricolage(p,i,s))continue;
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
      const doors=house.doors.filter(door=>!door.floor);
      if(cycle<42&&doors.length){
        const door=doors[(Math.floor((s+i*20)/95)+i)%doors.length];
        goalX=door.x;
        goalZ=door.z+(door.passage&&cycle>24?.64:-.34);
      }
    }
    const child=i===0?alex:people[2];
    if(i<2&&age<7&&s%54<34){goalX=child.x+(i===0?-.72:.72);goalZ=child.z+(i===0?.55:-.55);p.activity='Va voir '+(i===0?'Néo':'Juliette');}
    if(i===2){
      const first=people[3],second=people[4];goalX=(first.x+second.x)/2;goalZ=(first.z+second.z)/2;p.activity='Joue avec Timéo et Nathan';move(p,goalX,goalZ,.92);
      if(Math.hypot(p.x-goalX,p.z-goalZ)<.9&&s>=(p.nextPlayWithKids||0)){p.nextPlayWithKids=s+600;note('Juliette joue avec les enfants à l’aire de jeux.','play');}
    }else if(i>=3){
      p.age=age;
      if(records[4].mastered){
        const style=socialStyle[p.id];
        if(Math.sin(s*.11+i*2)>1-style.outreach){
          goalX=ball.x;goalZ=ball.z;
          p.activity='S’intéresse au ballon';
        }
        const miroir=miroirAmi(p,i,s);
        if(miroir){goalX=miroir.x;goalZ=miroir.z;p.activity=miroir.activity;}
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
    if(i<2&&age<7&&Math.hypot(p.x-child.x,p.z-child.z)<1.35&&s>=nextParentCare&&(child.hunger>.24||child.fatigue>.48||(child.thirst||0)>.45)){
      if(child.hunger>.24){if(kitchen.meals>0)takeServing(child);else child.hunger=Math.max(.08,child.hunger-.38);}
      if(child.fatigue>.48)child.fatigue=Math.max(.12,child.fatigue-.28);
      if((child.thirst||0)>.45)child.thirst=Math.max(.1,child.thirst-.35);
      child.pleasure=clamp((child.pleasure||0)+.18,0,1);
      p.activity='Prend soin de '+(child===alex?'Néo':'Juliette');nextParentCare=s+18;
      note(characterNames[p.id]+' prend soin de '+(child===alex?'Néo':'Juliette')+'.','care');
    }
    for(const id of ['football','softBall','bikePark','bikeHome','toy']){
      const item=playItems[id];
      if(Math.hypot(p.x-item.x,p.z-item.z)<.49)tryPlayObject(p,id,s);
    }
  }
  stepParentsEmbrace(s);
  stepAtelier(s);
  if(ticks%12===0){
    dialogue.step(s,alex,people,languageScene);
    updateRelationships(alex,people,s,age);
  }
  stepPlay();
  if(s>=nextConsolidation){
    nextConsolidation=s+60;
    Brain.consolider(s);
    Cortex.deduire(s,{lexique:dialogue.view().vocabulary});
    if(age>=2)Brain.publier(s);
    if(age>=2&&Brain.ouvrirPartage('amis')&&(Brain.entraine(.05),true))note('Ses amis du parc commencent à reprendre ce que Néo découvre.','social');
    for(const p of people){p.faim=Math.min(1,(p.faim||0)+.06);p.peine=Math.min(1,(p.peine||0)+.03);if(p.faim>=1)p.faim=.15;if(p.peine>=1)p.peine=.2;}
  }
  if(ticks%600===0){
    stageGoals=evaluateStageGoals();
    if(age<8&&stageGoals.length&&stageGoals.every(goal=>goal.done)){
      historiqueEtapes.push({age,at:Math.round(s)});
      age++;note('Néo grandit : il devient '+AGES[age].toLowerCase()+'.');
      leverInterdits();
      stageGoals=evaluateStageGoals();
    }
  }
}
const characterNames={alex:'Néo',joseph:'Joseph',marie:'Marie',juliette:'Juliette',timeo:'Timéo',nathan:'Nathan',francoise:'Lyra',rose:'Rose'};
const nextBallEvent={};
function recordBallPlay(id,s){
  if(s<(nextBallEvent[id]||0))return;
  nextBallEvent[id]=s+9;
  note(characterNames[id]+' joue avec la balle.','play');
}
// Compétences attendues pour quitter chaque stade, comme pour un enfant : le corps (physique) et la compréhension (mental).
// Elles se lisent dans l'état du corps et dans les fichiers du cerveau ; rien n'est donné à Néo.
let stageGoals=[];
function tableEtapes(){
  const st=Brain.state;
  const mots=dialogue.view().vocabulary.length,phrases=dialogue.view().composed||0;
  const sure=Brain.confirmees();
  const gestes=Brain.APPRENABLES.filter(Brain.appris).length;
  const proches=Object.values(st.social.personnes).filter(p=>p.vu>=3).length;
  const parc=new Set(sure.filter(c=>entityById(c.cible)?.kind==='equipement').map(c=>c.cible)).size;
  const besoins=new Set(sure.flatMap(c=>Object.keys(c.besoins).filter(k=>c.besoins[k]>.08))).size;
  const familles=st.objets.concepts.length,habitudes=Brain.habitudes().length,idees=Cortex.confirmees();
  const grimpe=Object.values(st.corps.defis).some(d=>d.reussites>0);
  const P='physique',M='mental';
  const table=[
    [[P,'Se redresser et ramper',records[0].mastered&&records[1].mastered],[M,'Reconnaître ses proches',proches>=2],[M,'Comprendre un premier mot',mots>=1]],
    [[P,'Tenir debout et faire ses premiers pas',records[2].mastered&&records[3].mastered],[M,'Voir que ses gestes ont des effets',sure.length>=2],[M,'Comprendre 3 mots',mots>=3]],
    [[P,'Marcher seul',records[4].mastered],[P,'Apprendre un nouveau geste',gestes>=1],[M,'Comprendre 6 mots',mots>=6]],
    [[P,'Maîtriser tous ses gestes',gestes>=4],[P,'Courir',Brain.capacite('course')>=SAIT_COURIR],[M,'Regrouper les choses par famille',familles>=1],[M,'Dire sa première phrase',phrases>=1],[M,'Avoir une idée et la vérifier',idees>=1]],
    [[P,'Jouer avec 2 équipements du parc',parc>=2],[P,'Réussir à grimper',grimpe],[M,'Atteindre 3 envies',Brain.nbAtteints()>=3],[M,'Comprendre 12 mots',mots>=12]],
    [[M,'Se débrouiller seul pour 2 besoins',besoins>=2],[M,'Comprendre 8 choses',sure.length>=8],[M,'Vérifier 4 de ses idées',idees>=4]],
    [[P,'Être endurant',Brain.capacite('endurance')>=.6],[M,'Acquérir une habitude',habitudes>=1],[M,'Former 5 phrases',phrases>=5],[M,'Comprendre 25 mots',mots>=25]],
    [[P,'Être fort',Brain.capacite('force')>=.7],[M,'Avoir 3 habitudes',habitudes>=3],[M,'Comprendre 15 choses',sure.length>=15],[M,'Vérifier 10 de ses idées',idees>=10]]
  ];
  return table;
}
let historiqueEtapes=[];
function evaluateStageGoals(){return (tableEtapes()[age]||[]).map(([type,label,done])=>({type,label,done:!!done}));}
// Toutes les étapes : ce qui est prévu, ce qui est en cours, et ce qui a été accompli (avec le moment).
function vueEtapes(){
  const table=tableEtapes();
  return AGES.map((nom,i)=>{
    const fait=historiqueEtapes.find(h=>h.age===i);
    return {age:i,nom,etat:i<age?'fini':i===age?'en cours':'à venir',fin:fait?.at??null,
      objectifs:i===age?stageGoals:(table[i]||[]).map(([type,label])=>({type,label,done:i<age}))};
  });
}
let activityData, nextActivitySnapshot=0, brainView=null;
function snapshot() {
  if(!activityData||ticks>=nextActivitySnapshot){
    const vocabulary=dialogue.view().vocabulary.map(entry=>entry.word);
    const K=knowledgeScore(),partage=Brain.state.partage;
    if(!partage.famille&&K>BASE_LEVEL.marie&&Brain.ouvrirPartage('famille'))note('Néo en sait maintenant plus que ses parents : eux aussi reprennent ses découvertes.','social');
    for(const p of people){
      if(p.id==='juliette')p.age=Math.min(8,age+2);else if(playgroundFriends.includes(p.id))p.age=age;
      const recoit=FRIEND_IDS.includes(p.id)?partage.amis:(partage.amis&&K>BASE_LEVEL[p.id]);
      p.niveau=BASE_LEVEL[p.id];p.partage=recoit;p.leadership=socialStyle[p.id]?.leadership||0;
      p.inherited=recoit?Brain.confirmees().length+vocabulary.length:0;
      if(recoit&&familyLexicons[p.id])for(const word of vocabulary)familyLexicons[p.id].add(word);
      p.baseWords=familyLexicons[p.id]?.size||0;
    }
    const n=niveauAcces();
    activityData={courrier:{sortant:courrier.sortant.slice(-40),nonLus:courrier.sortant.filter(m=>!m.lu).length},
      events:interactions.slice(0,60),zone:{niveau:n,liste:ZONES.map((z,i)=>({nom:z.nom,ouvert:i<=n,age:AGE_ZONE.indexOf(i)}))},
      motor:records.map(({attempts,confirmed,recent,mastered})=>({attempts,confirmed,recent:recent.filter(Boolean).length,mastered}))};
    brainView=Brain.view(observerLabel);
    brainView.etape=stageGoals;
    brainView.etapes=vueEtapes();
    brainView.mots=vocabulary.length;
    brainView.cortex=Cortex.view(observerLabel);
    nextActivitySnapshot=ticks+36;
  }
  alex.leadership=Brain.state.social.leadership||0;
  return {commerce:{stock:commerce.stock,visites:commerce.visites,quota:QUOTA_JOUR,prelev:{...commerce.prelev}},acces:{...acces},
    atelier:{outils:atelier.outils.map(o=>({...o})),arbre:{...atelier.arbre},bois:{...atelier.bois},fleurs:atelier.fleurs.map(f=>({...f})),pommes:atelier.pommes.map(p=>({...p}))},
    computer:house?.computer||null,ticks,skill,age,score,alex,people,playItems,relationships,journal,mode,ropeEnd:park?ropeEnd():null,doors:doorStates,membrane,kitchen,household,
    dialogue:dialogue.view(),brain:brainView,activityData,courrier:activityData.courrier,
    playgroundMotion:contact?.kind==='swing'?{swingAngle:Math.sin(contact.time*2.7)*.42}:null};
}
function save() {
  return {historiqueEtapes,commerce,acces,atelier,courrier,brain:Brain.save(),motorVersion:MOTOR_VERSION,ticks,trials,pecm,skill,age,score,alex,people,ball,journal,records,knowledge,eventClock,playItems,playTrials,relationships,parkMemory,doorKnowledge,kitchen,objectLearning,nextRefill,curiosity,interactions,nextParentCare,nextParentHug,parentEmbrace,dialogue:dialogue.save()};
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
    placerOrdinateur();
    for(const person of [...residents,...people.slice(3)])resetRestPosition(person);
    const salon=navigation.nearest(-8,-2,0,null,1.2);
    if(salon>=0){const start=navigation.point(salon);alex.x=start.x;alex.z=start.z;alex.y=0;}
    for(const item of Object.values(playItems)){
      if(navigation.isFree(item.x,item.z,0))continue;
      const nearest=navigation.nearest(item.x,item.z,0,null,1.2);
      if(nearest>=0)Object.assign(item,navigation.point(nearest));
    }
  }
  if(data.type==='courrier'&&typeof data.text==='string'&&data.text.trim())courrier.entrant.push({at:ticks,text:data.text.trim().slice(0,200),lu:false});
  if(data.type==='courrier-lu')for(const m of courrier.sortant)m.lu=true;
  if(data.type==='play-control')playControl(data.id,data.action,data.value);
  if(data.type==='park'&&data.geometry.slide.length>1){
    park=data.geometry;
    park.approaches={};
    for(const [id,target] of [['slide',park.slide.at(-1)],['rope',park.rope],...Object.entries(park.equipment||{})]){
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
    ({ticks,trials,pecm,skill,age,score,journal,records,knowledge,eventClock,nextParentCare,nextParentHug,parentEmbrace}=s);
    if(s.motorVersion!==MOTOR_VERSION)records=goals.map(emptyRecord);
    if(s.motorVersion!==MOTOR_VERSION){
      skill=0;score=0;trials=0;pecm=0;
      for(const name of Object.keys(knowledge))if(name.startsWith('motricité · '))delete knowledge[name];
      note('Néo recommence ses essais avec un corps articulé.');
    }
    if(!Brain.restore(s.brain))note('Néo repart avec un cerveau vierge : son cerveau a été réorganisé.');
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
    if(s.courrier)courrier=s.courrier;
    if(s.commerce)commerce=s.commerce;
    if(Array.isArray(s.historiqueEtapes))historiqueEtapes=s.historiqueEtapes;
    if(s.acces)acces=s.acces;
    if(s.atelier?.outils&&s.atelier.fleurs)atelier=s.atelier;
    nextRefill=Number.isFinite(s.nextRefill)?s.nextRefill:0;
    if(s.motorVersion===MOTOR_VERSION)Object.assign(ball,s.ball);
    for(const [id,item] of Object.entries(s.playItems||{}))if(playItems[id])Object.assign(playItems[id],item);
    Object.assign(playTrials,s.playTrials);
    if(s.relationships)relationships=s.relationships;
    people.forEach((p,i)=>Object.assign(p,s.people[i]));
    if(house)for(const person of [...residents,...people.slice(3)])resetRestPosition(person);
    episode=newEpisode();
  }
};
Brain.init(20260101);
Brain.bind({lexique:()=>dialogue.view().vocabulary});
episode=newEpisode();
note('Néo commence à explorer ses mouvements.');
let lastPost=0,lastSave=0;
function run(){
  const now=performance.now();
  if(!readyToRun){lastWall=now;setTimeout(run,16);return;}
  accumulator+=Math.min(.1,(now-lastWall)/1000)*(mode==='slow'?.45:1);
  lastWall=now;
  if(mode==='human'||mode==='slow'){
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
  setTimeout(run,mode==='turbo'?0:8);
}
run();
