import {bindPlayViews} from '/play-view.js';
import {setupDashboard,TIME_SCALE} from '/dashboard.js';
document.getElementById('enter-simulacre')?.addEventListener('click',()=>{document.getElementById('welcome-screen').hidden=true;try{sessionStorage.setItem('simulacre-intro-seen','1');}catch{}});
const ui = id => document.getElementById(id);
const ages = ['Nourrisson','Bébé','Petit enfant','Enfant','Grand enfant','Jeune ado','Ado','Jeune homme','Homme'];
const stages = ['Se redresser','Ramper','Tenir debout','Premiers pas','Marche'];
const format = new Intl.NumberFormat('fr-BE');
const saveKey = 'neo-simulacre-v4';
const worker = new Worker('/sim.js');
let snapshot, human = false, speedMode='turbo', upperFloorView=null, lastJournal = '', resetting=false, initialized=false;
const personNames={alex:'Néo',joseph:'Joseph',marie:'Marie',juliette:'Juliette',timeo:'Timéo',nathan:'Nathan',francoise:'Lyra',rose:'Rose'};
let lastDialogueId=0, lastDialoguePaint=0, voiceEnabled=false, conversationRows=[];
const dashboard=setupDashboard(personNames);
const voiceButton=ui('voice-toggle');
if('speechSynthesis' in window){
  voiceButton.hidden=false;
  voiceButton.onclick=()=>{
    voiceEnabled=!voiceEnabled;
    voiceButton.setAttribute('aria-pressed',String(voiceEnabled));
    voiceButton.textContent=voiceEnabled?'Couper les voix':'Activer les voix';
    if(!voiceEnabled)speechSynthesis.cancel();
  };
}
function updateDialogue(state){
  if(!state)return;
  const now=performance.now();
  if(!human&&now-lastDialoguePaint<250)return;
  lastDialoguePaint=now;
  const latest=state.lines.at(-1);
  if(!latest||latest.id===lastDialogueId)return;
  const previousId=lastDialogueId;
  lastDialogueId=latest.id;
  conversationRows=state.lines;
  ui('latest-line').textContent=personNames[latest.speaker]+' · '+latest.text;
  if(voiceEnabled&&human&&previousId&&!speechSynthesis.speaking&&!speechSynthesis.pending){
    const speech=new SpeechSynthesisUtterance(latest.text);
    speech.lang='fr-FR';
    const voices=speechSynthesis.getVoices().filter(voice=>voice.lang.toLowerCase().startsWith('fr'));
    speech.voice=voices[latest.speaker==='joseph'?1:0]||voices[0]||null;
    speech.pitch=latest.speaker==='alex'?1.35:latest.speaker==='marie'?1.13:.83;
    speech.rate=latest.speaker==='alex'?.77:.91;
    speechSynthesis.speak(speech);
  }
}
let followedPerson='alex', following=false;
function showFollowState(){
  const name=personNames[followedPerson];
  ui('follow').textContent='Suivi '+(/^[AEIOUY]/i.test(name)?'d’':'de ')+name;
  ui('follow').setAttribute('aria-pressed',String(following));
  ui('choose-person').textContent=name+' ▾';
}
function selectPerson(id){
  followedPerson=id;
  following=true;
  showFollowState();
}
ui('follow').onclick=()=>{following=!following;showFollowState();};
ui('choose-person').onclick=()=>ui('person-dialog').showModal();
for(const [id,name] of Object.entries(personNames)){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=name;
  button.onclick=()=>{selectPerson(id);ui('person-dialog').close();};
  ui('person-list').append(button);
}
ui('reset').onclick=()=>ui('reset-dialog').showModal();
ui('reset-dialog').querySelector('form').addEventListener('submit',async event=>{
  if(event.submitter?.value!=='reset')return;
  event.preventDefault();
  if(resetting)return;
  resetting=true;
  try {
    await dashboard.clearHistory();
    worker.terminate();
    try { localStorage.removeItem(saveKey); } catch {}
    location.reload();
  } catch {
    resetting=false;
    ui('reset-dialog').querySelector('p').textContent='Impossible d’effacer l’historique local. Réessayez.';
  }
});
dashboard.archiveReady.then(archivedId=>{
  let state;
  try { state=JSON.parse(localStorage.getItem(saveKey)); } catch {}
  if(state?.dialogue?.lines)dashboard.capture(state.dialogue.lines);
  worker.postMessage({type:'restore',state,archivedId});
  initialized=true;
});
worker.onmessage = ({data}) => {
  if(resetting)return;
  if(data.type==='save'&&initialized){
    try { localStorage.setItem(saveKey,JSON.stringify(data.state)); } catch {}
    return;
  }
  if(data.type!=='state')return;
  snapshot=data.state;
  dashboard.capture(data.lines);
  dashboard.update(snapshot);
  updateDialogue(snapshot.dialogue);
  const {ticks,age,skill,score,alex,trials,pecm,journal}=snapshot;
  const days=Math.floor(ticks/120*TIME_SCALE/86400);
  ui('year').textContent='Année '+format.format(1+Math.floor(days/365));
  ui('day').textContent='Jour '+(1+days%365);
  ui('age').textContent=ages[age];
  ui('skill').textContent=stages[skill];
  ui('balance').textContent=score+' %';
  ui('bar').value=score;
  const observed=following&&followedPerson!=='alex'?snapshot.people.find(person=>person.id===followedPerson):alex;
  ui('activity').textContent=observed?.activity||'Se déplace';
  ui('activity-person').textContent=following?personNames[followedPerson]:'Néo';
  ui('trials').textContent=format.format(trials);
  ui('motor-progress').textContent=format.format(pecm);
  ui('hunger').textContent=Math.round(alex.hunger*100)+' %';
  ui('fatigue').textContent=Math.round(alex.fatigue*100)+' %';
  ui('pleasure').textContent=Math.round((alex.pleasure||0)*100)+' %';
  const feelings=[];
  if(alex.hunger>.65)feelings.push('la faim');
  if(alex.fatigue>.7)feelings.push('la fatigue');
  if((alex.thirst||0)>.65)feelings.push('la soif');
  if((alex.pleasure||0)>.65)feelings.push('du plaisir');
  if(!feelings.length)feelings.push('un état calme et confortable');
  ui('neo-perception').lastElementChild.textContent='Il remarque : '+(alex.activity||'son environnement')+'. Il ressent : '+feelings.join(', ')+'.';
  const journalKey=journal.map(event=>event.ticks+' '+event.message).join('|');
  if(journalKey!==lastJournal){
    lastJournal=journalKey;
    ui('journal').replaceChildren(...journal.map(event=>Object.assign(document.createElement('li'),{textContent:event.message})));
  }
};
worker.onerror=()=>{ui('mode').textContent='Simulation interrompue';};
function setSpeedMode(next){
  speedMode=next;
  human=speedMode!=='turbo';
  if(!human&&voiceEnabled)speechSynthesis.cancel();
  worker.postMessage({type:'mode',mode:speedMode});
  const button=ui('speed-global');
  button.textContent=human?'Accélérer':'Ralentir';
  button.setAttribute('aria-pressed',String(human));
  ui('mode').textContent=human?'Vitesse normale · ×1':'Simulation accélérée';
}
// Un seul bouton : accéléré par défaut, ralenti à la demande, puis ré-accélération.
ui('speed-global').onclick=()=>setSpeedMode(human?'turbo':'human');
setSpeedMode('turbo');
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.warn);

const welcome=ui('welcome-screen');
if(sessionStorage.getItem('simulacre-intro-seen')==='1')welcome.hidden=true;
ui('enter-simulacre').addEventListener('click',()=>{welcome.hidden=true;sessionStorage.setItem('simulacre-intro-seen','1');});

async function unzipPlayground(blob) {
  const data=new Uint8Array(await blob.arrayBuffer());
  const view=new DataView(data.buffer);
  const u16=i=>view.getUint16(i,true);
  const u32=i=>view.getUint32(i,true);
  let end=data.length-22;
  while(end>=Math.max(0,data.length-65557)&&u32(end)!==0x06054b50)end--;
  if(end<0||u32(end)!==0x06054b50)throw Error('Archive Cyprus illisible');
  const files=new Map();
  const decode=new TextDecoder();
  let entry=u32(end+16);
  for(let i=0;i<u16(end+10);i++){
    if(u32(entry)!==0x02014b50)throw Error('Index ZIP incomplet');
    const nameLength=u16(entry+28), extraLength=u16(entry+30), commentLength=u16(entry+32);
    const name=decode.decode(data.subarray(entry+46,entry+46+nameLength));
    const local=u32(entry+42), length=u32(entry+20), method=u16(entry+10);
    const start=local+30+u16(local+26)+u16(local+28);
    if(!name.endsWith('/')){
      const source=new Blob([data.subarray(start,start+length)]);
      if(method===0)files.set(name,await source.arrayBuffer());
      else if(method===8)files.set(name,await new Response(source.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else throw Error('Compression ZIP non prise en charge');
    }
    entry+=46+nameLength+extraLength+commentLength;
  }
  return files;
}
function modernizePopo(buffer) {
  const input=new DataView(buffer);
  const jsonLength=input.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength)));
  const key='KHR_materials_pbrSpecularGlossiness';
  for(const material of json.materials){
    const legacy=material.extensions?.[key];
    if(!legacy)continue;
    material.pbrMetallicRoughness={baseColorFactor:legacy.diffuseFactor,metallicFactor:0,roughnessFactor:1-(legacy.glossinessFactor??.2)};
    delete material.extensions[key];
  }
  for(const field of ['extensionsUsed','extensionsRequired']) if(json[field])json[field]=json[field].filter(name=>name!==key);
  const encoded=new TextEncoder().encode(JSON.stringify(json));
  const padded=Math.ceil(encoded.length/4)*4;
  const bin=new Uint8Array(buffer,20+jsonLength);
  const result=new Uint8Array(20+padded+bin.length);
  result.set(new Uint8Array(buffer,0,20));
  const header=new DataView(result.buffer);
  header.setUint32(8,result.length,true);
  header.setUint32(12,padded,true);
  result.fill(32,20,20+padded);
  result.set(encoded,20);
  result.set(bin,20+padded);
  return result.buffer;
}
function softwareRenderer(T){
  const canvas=document.createElement('canvas');
  const backdrop=document.createElement('canvas');
  const context=canvas.getContext('2d');
  const base=backdrop.getContext('2d');
  const screen=new T.Vector3(), point=new T.Vector3();
  let width=1,height=1,lastChildren=-1,ratio=1, overviewOrigin=null,lastCut=null;
  function project(vector,camera){
    return [(vector.x*.5+.5)*width,(.5-vector.y*.5)*height,vector.z];
  }
  function paintWorld(scene,camera){
    base.fillStyle='#59766a';base.fillRect(0,0,width,height);
    const triangles=[];
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    for(const root of scene.children){
      if(root.userData.dynamic||root.userData.ignoreSoftware)continue;
      root.traverse(mesh=>{
        if(!mesh.isMesh||!mesh.visible)return;
        const position=mesh.geometry.getAttribute('position'), index=mesh.geometry.index;
        const count=Math.floor((index?.count||position.count)/3);
        const stride=Math.max(1,Math.ceil(count/1100));
        const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
        const plane=material.clippingPlanes?.[0];
        const cut=plane?(plane.normal.y>0?-plane.constant:plane.constant):Infinity;
        const upper=Boolean(plane&&plane.normal.y>0);
        const color=material.color||new T.Color('#b5b28a');
        const style=color.getStyle();
        for(let i=0;i<count;i+=stride){
          const vertices=[];let visible=false;
          for(let j=0;j<3;j++){
            const k=index?index.getX(i*3+j):i*3+j;
            point.fromBufferAttribute(position,k).applyMatrix4(mesh.matrixWorld);
            visible||=upper?point.y>cut:point.y<cut;
            point.y=upper?Math.max(point.y,cut):Math.min(point.y,cut);
            vertices.push(project(screen.copy(point).project(camera),camera));
          }
          if(visible)triangles.push({vertices,style,depth:vertices.reduce((sum,p)=>sum+p[2],0)});
        }
      });
    }
    triangles.sort((a,b)=>b.depth-a.depth);
    for(const {vertices,style} of triangles){
      base.beginPath();base.moveTo(vertices[0][0],vertices[0][1]);
      base.lineTo(vertices[1][0],vertices[1][1]);base.lineTo(vertices[2][0],vertices[2][1]);
      base.closePath();base.fillStyle=style;base.fill();
    }
  }
  return {domElement:canvas,
    setPixelRatio(value){ratio=Math.min(1.25,value);},
    setSize(w,h){width=w*ratio;height=h*ratio;canvas.width=backdrop.width=width;canvas.height=backdrop.height=height;lastChildren=-1;},
    setAnimationLoop(draw){requestAnimationFrame(function frame(time){draw(time);requestAnimationFrame(frame);});},
    render(scene,camera){
      if(lastChildren!==scene.children.length||lastCut!==scene.userData.floorCut){
        const overview=camera.clone();
        overview.position.set(23,27,31);
        overview.lookAt(0,0,0);
        overview.zoom=1;
        overview.updateProjectionMatrix();
        paintWorld(scene,overview);
        overviewOrigin=project(screen.set(0,0,0).project(overview),overview);
        lastChildren=scene.children.length;lastCut=scene.userData.floorCut;
      }
      const origin=project(screen.set(0,0,0).project(camera),camera);
      context.fillStyle='#59766a';
      context.fillRect(0,0,width,height);
      context.drawImage(backdrop,origin[0]-overviewOrigin[0]*camera.zoom,origin[1]-overviewOrigin[1]*camera.zoom,width*camera.zoom,height*camera.zoom);
      for(const object of scene.children.filter(item=>item.userData.dynamic&&item.visible)){
        object.updateMatrixWorld(true);
        const [x,y]=project(screen.copy(object.position).project(camera),camera);
        const style=object.userData;
        const factor=height*camera.zoom/(camera.top-camera.bottom);
        if(style.door){
          const vertices=style.corners.map(corner=>project(screen.copy(corner).applyMatrix4(object.matrixWorld).project(camera),camera));
          context.fillStyle=style.color;
          context.beginPath();
          vertices.forEach(([px,py],i)=>i?context.lineTo(px,py):context.moveTo(px,py));
          context.closePath();context.fill();continue;
        }
        if(style.rope){
          const [ax,ay]=project(screen.copy(style.anchor).project(camera),camera);
          const [bx,by]=project(screen.copy(style.end).project(camera),camera);
          context.strokeStyle='#6a4b32';context.lineWidth=Math.max(2,.045*factor);
          context.beginPath();context.moveTo(ax,ay);context.lineTo(bx,by);context.stroke();continue;
        }
        if(style.ball){
          context.fillStyle='#f9b650';context.beginPath();context.arc(x,y,Math.max(2,style.ball*factor),0,Math.PI*2);context.fill();continue;
        }
        if(style.playSymbol){
          context.fillStyle=style.playSymbol==='bike'?'#df7245':'#ad8158';
          context.fillRect(x-factor*.28,y-factor*.34,factor*.56,factor*.34);continue;
        }
        const size=object.scale.x*factor;
        if(style.rig){
          const projectJoint=joint=>project(screen.setFromMatrixPosition(joint.matrixWorld).project(camera),camera);
          const stroke=(joints,color,weight)=>{
            context.strokeStyle=color;context.lineWidth=Math.max(1,size*weight);
            context.lineCap='round';context.lineJoin='round';context.beginPath();
            joints.forEach((joint,i)=>{const [px,py]=projectJoint(joint);if(i)context.lineTo(px,py);else context.moveTo(px,py);});
            context.stroke();
          };
          for(const side of style.rig.sides){
            stroke([side.hip,side.knee,side.ankle],style.suit,.083);
            stroke([side.hip,side.shoulder],style.suit,.115);
            stroke([side.shoulder,side.elbow,side.wrist],style.suit,.062);
            if(size>43)for(const finger of side.fingers)stroke([side.wrist,finger.base,finger.tip],style.skin,.014);
          }
          const [hx,hy]=project(screen.set(0,.107,0).applyMatrix4(style.rig.spine.at(-1).matrixWorld).project(camera),camera);
          const face=style.face;
          const radius=Math.max(2,size*.109);
          context.fillStyle=style.skin;context.beginPath();
          context.ellipse(hx,hy,radius*(face?.shape[0]||1),radius*(face?.shape[1]||1),0,0,Math.PI*2);context.fill();
          if(face&&size>34){
            context.fillStyle=face.hair;context.beginPath();
            context.ellipse(hx,hy-radius*.33,radius*.96,radius*.73,0,Math.PI,Math.PI*2);context.fill();
            if(face.style==='bun'||face.style==='tuft'){
              context.beginPath();context.arc(hx+radius*(face.style==='bun'?.61:-.3),hy-radius*.93,radius*.32,0,Math.PI*2);context.fill();
            }
            for(const side of [-1,1]){
              const eye=hx+side*radius*.37;
              context.fillStyle=face.eyes;context.beginPath();context.arc(eye,hy,radius*.085,0,Math.PI*2);context.fill();
              if(face.glasses){context.strokeStyle='#24374e';context.lineWidth=Math.max(1,radius*.05);context.beginPath();context.arc(eye,hy,radius*.24,0,Math.PI*2);context.stroke();}
            }
            context.strokeStyle=face.beard?face.hair:'#8b514b';context.lineWidth=Math.max(1,radius*(face.beard?.18:.055));
            context.beginPath();context.ellipse(hx,hy+radius*.40,radius*.22*face.mouth,radius*.085,0,0,Math.PI);context.stroke();
          }
          continue;
        }
        context.strokeStyle=style.suit;context.lineWidth=Math.max(2,size*.19);context.lineCap='round';
        const lean=object.rotation.x, crouch=style.crouch||0;
        const reach=size*(1-crouch*.52);
        const leanX=Math.sin(lean)*reach*.45, upright=Math.cos(lean)*reach;
        context.beginPath();context.moveTo(x,y-upright*.17);context.lineTo(x+leanX,y-upright*.49);context.stroke();
        context.fillStyle=style.skin;context.beginPath();context.arc(x+leanX*1.3,y-upright*.62,Math.max(2,size*.16),0,Math.PI*2);context.fill();
      }
    }
  };
}
const faceProfiles={
  alex:{shape:[1,1,1],hair:'#604332',style:'tuft',eyes:'#405a49',mouth:1},
  joseph:{shape:[1.08,1.06,1],hair:'#382d28',style:'crop',eyes:'#584535',beard:true,mouth:.9},
  marie:{shape:[.93,1.05,1],hair:'#56332c',style:'bun',eyes:'#476b63',mouth:1.19},
  juliette:{shape:[.91,1.01,1],hair:'#795033',style:'bob',eyes:'#544733',mouth:1.08},
  timeo:{shape:[.96,1.05,.98],hair:'#5b422f',style:'sweep',eyes:'#40555c',glasses:true,mouth:.86},
  nathan:{shape:[1.1,.94,1],hair:'#956434',style:'tuft',eyes:'#654b35',freckles:true,mouth:1.14},
  francoise:{shape:[1.01,1.06,.98],hair:'#2d2524',style:'curls',eyes:'#554133',mouth:1.22},
  rose:{shape:[1.04,.98,1],hair:'#a14927',style:'bob',eyes:'#527b61',freckles:true,mouth:1}
};
function buildFace(T,rig,id,skin){
  const profile=faceProfiles[id];
  const head=new T.Group();
  head.position.set(0,.842,0);
  head.scale.set(...profile.shape);
  head.position.y-=.735;
  rig.spine.at(-1).add(head);
  const material=color=>new T.MeshStandardMaterial({color,roughness:.82});
  const skinMaterial=material(skin);
  const hairMaterial=material(profile.hair);
  const whites=material('#f7f0e8');
  const iris=material(profile.eyes);
  const pupil=material('#171821');
  const lip=material('#8b514b');
  const sphere=new T.SphereGeometry(1,18,12);
  function oval(mat,x,y,z,sx,sy,sz){
    const mesh=new T.Mesh(sphere,mat);
    mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);head.add(mesh);return mesh;
  }
  oval(skinMaterial,0,-.007,0,.107,.128,.094);
  oval(skinMaterial,0,-.030,.091,.015,.020,.022);
  const eyes=[];
  for(const side of [-1,1]){
    oval(skinMaterial,side*.103,-.022,.004,.021,.028,.019);
    const eye=oval(whites,side*.041,.006,.083,.024,.017,.015);
    const details=[oval(iris,side*.041,.006,.096,.012,.012,.006),oval(pupil,side*.041,.006,.101,.006,.007,.003),
      oval(whites,side*.041+.004,.011,.103,.003,.003,.002)];
    const closed=oval(lip,side*.041,.006,.094,.023,.0027,.003);
    closed.visible=false;
    const brow=oval(hairMaterial,side*.043,.038,.084,.023,.0045,.005);
    brow.rotation.z=side*(id==='joseph'?.16:.08);
    eyes.push({open:[eye,...details],closed});
    if(profile.freckles)for(let i=0;i<3;i++)oval(lip,side*(.044+i*.01),-.027+(i%2)*.004,.088,.0027,.0025,.0028);
  }
  const mouth=oval(lip,0,-.065,.084,.025*profile.mouth,.006,.004);
  if(profile.beard){
    oval(hairMaterial,0,-.094,.043,.072,.032,.053);
    for(const side of [-1,1])oval(hairMaterial,side*.018,-.052,.089,.020,.006,.004);
  }
  const cap=new T.Mesh(new T.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.46),hairMaterial);
  cap.position.set(0,.015,-.009);cap.scale.set(.112,.121,.103);head.add(cap);
  if(profile.style==='bob'||profile.style==='bun'){
    for(const side of [-1,1])oval(hairMaterial,side*.091,-.01,-.035,.034,.09,.053);
  }
  if(profile.style==='bun')oval(hairMaterial,.017,.074,-.094,.059,.057,.056);
  if(profile.style==='sweep')oval(hairMaterial,-.037,.086,.055,.063,.025,.050).rotation.z=.32;
  if(profile.style==='tuft'){
    for(let i=0;i<3;i++)oval(hairMaterial,-.037+i*.028,.109+i*.006,.034,.029,.038,.040).rotation.z=.45;
  }
  if(profile.style==='curls'){
    for(let i=0;i<9;i++){
      const angle=i*Math.PI*2/9;
      oval(hairMaterial,Math.sin(angle)*.077,.077+Math.cos(i*2)*.013,Math.cos(angle)*.063,.040,.040,.042);
    }
  }
  if(profile.glasses){
    const frame=material('#24374e');
    for(const side of [-1,1]){
      const ring=new T.Mesh(new T.TorusGeometry(.031,.0036,7,18),frame);
      ring.position.set(side*.041,.006,.108);ring.scale.y=.77;head.add(ring);
    }
    oval(frame,0,.011,.109,.012,.0036,.0032);
  }
  return {head,mouth,eyes,profile};
}

function buildPopoRig(T,root,gloveMaterial){
  const bones=[];
  function joint(parent,x,y,z){
    const bone=new T.Bone();
    bone.position.set(x,y,z);
    parent.add(bone);
    bone.userData.index=bones.length;
    bones.push(bone);
    return bone;
  }
  const trunk=joint(root,0,0,0);
  const spine=[];
  for(const height of [.40,.47,.54,.61,.686,.735]){
    const previous=spine.at(-1);
    const previousHeight=spine.length?[.40,.47,.54,.61,.686][spine.length-1]:0;
    spine.push(joint(previous||trunk,0,height-previousHeight,0));
  }
  const sides=[-1,1].map(sign=>{
    const shoulder=joint(spine[4],sign*.122,0,0);
    const elbow=joint(shoulder,sign*.137,-.005,0);
    const wrist=joint(elbow,sign*.168,-.008,0);
    const hip=joint(spine[0],sign*.063,-.004,0);
    const knee=joint(hip,0,-.191,0);
    const ankle=joint(knee,0,-.161,0);
    const palm=new T.Mesh(new T.SphereGeometry(1,10,7),gloveMaterial);
    palm.position.x=sign*.026;
    palm.scale.set(.040,.026,.032);
    wrist.add(palm);
    const fingers=[];
    for(let i=0;i<5;i++){
      const thumb=i===0;
      const start=new T.Group();
      start.position.set(sign*(thumb?.023:.048),thumb?-.016:0,(i-2.3)*.012);
      start.rotation.z=thumb?-sign*.62:sign*(i-2.5)*.075;
      wrist.add(start);
      const base=new T.Group(); start.add(base);
      const length=[.046,.059,.066,.06,.049][i];
      const upper=new T.Mesh(new T.SphereGeometry(1,7,5),gloveMaterial);
      upper.scale.set(length*.35,.008,.008);
      upper.position.x=sign*length*.27;
      base.add(upper);
      const tip=new T.Group();tip.position.x=sign*length*.54;base.add(tip);
      const lower=new T.Mesh(new T.SphereGeometry(1,7,5),gloveMaterial);
      lower.scale.set(length*.27,.007,.007);
      lower.position.x=sign*length*.21;
      tip.add(lower);
      fingers.push({base,tip});
    }
    return {sign,shoulder,elbow,wrist,hip,knee,ankle,fingers};
  });
  return {bones,trunk,spine,sides,skeleton:new T.Skeleton(bones)};
}
function skinPopoGeometry(T,geometry,rig){
  const positions=geometry.attributes.position;
  const ids=new Uint16Array(positions.count*4),weights=new Float32Array(positions.count*4);
  const smooth=T.MathUtils.smoothstep;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i), y=positions.getY(i), a=Math.abs(x);
    const side=rig.sides[x<0?0:1];
    const arm=smooth(a,.108,.168)*smooth(y,.56,.64)*(1-smooth(y,.72,.77));
    const leg=1-smooth(y,.32,.415);
    let first=rig.trunk,second=rig.trunk,mix=0,influence=0;
    if(arm>.001){
      first=a<.35?side.shoulder:side.elbow;
      second=a<.35?side.elbow:side.wrist;
      mix=a<.35?smooth(a,.227,.291):smooth(a,.389,.443);
      influence=arm;
    }else if(leg>.001){
      first=y<.13?side.knee:side.hip;
      second=y<.13?side.ankle:side.knee;
      mix=y<.13?1-smooth(y,.025,.080):1-smooth(y,.17,.25);
      influence=leg;
    }
    const vertebra=rig.spine[Math.max(0,Math.min(5,Math.round((y-.40)/.069)))];
    const central=y>.38?vertebra:rig.trunk;
    ids.set([central.userData.index,first.userData.index,second.userData.index,0],i*4);
    weights.set([1-influence,influence*(1-mix),influence*mix,0],i*4);
  }
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  if(geometry.index){
    const triangles=[];
    for(let i=0;i<geometry.index.count;i+=3){
      const face=[geometry.index.getX(i),geometry.index.getX(i+1),geometry.index.getX(i+2)];
      if(face.every(vertex=>Math.abs(positions.getX(vertex))>.445&&positions.getY(vertex)>.57))continue;
      triangles.push(...face);
    }
    geometry.setIndex(triangles);
  }
}
function posePopo(rig,channels,crouch,gait,smoothing,lean=0){
  const smooth=(angle,target)=>angle+(target-angle)*smoothing;
  rig.trunk.position.y=smooth(rig.trunk.position.y,-crouch*.11);
  rig.spine.forEach((joint,i)=>{
    joint.rotation.x=smooth(joint.rotation.x,(crouch*.45-lean*.26)*(i<4?.19:.12));
    joint.rotation.y=smooth(joint.rotation.y,gait*(i<4?.045:-.06));
  });
  rig.sides.forEach((side,i)=>{
    const {sign,shoulder,elbow,wrist,hip,knee,ankle,fingers}=side;
    const offset=i*11;
    const value=(index,fallback)=>channels?.[offset+index]??fallback;
    shoulder.rotation.z=smooth(shoulder.rotation.z,-sign*value(0,1.10));
    shoulder.rotation.y=smooth(shoulder.rotation.y,sign*gait*.38);
    elbow.rotation.y=smooth(elbow.rotation.y,-sign*value(1,.24+crouch*.25));
    wrist.rotation.x=smooth(wrist.rotation.x,value(4,0));
    hip.rotation.x=smooth(hip.rotation.x,value(2,-sign*gait*.46-crouch*.58));
    knee.rotation.x=smooth(knee.rotation.x,value(3,Math.max(0,sign*gait)*.64+crouch*.62));
    ankle.rotation.x=smooth(ankle.rotation.x,value(5,-gait*.16));
    fingers.forEach(({base,tip},finger)=>{
      const curl=value(6+finger,.17);
      base.rotation.y=smooth(base.rotation.y,-sign*curl);
      tip.rotation.y=smooth(tip.rotation.y,-sign*curl*.72);
    });
  });
}

async function showWorld(){
  const [T,{GLTFLoader},assets]=await Promise.all([
    import('three'),import('three/addons/loaders/GLTFLoader.js'),import('/assets/3d/load-character.js')
  ]);
  const scene=new T.Scene();
  scene.background=new T.Color('#5d7a70');
  const canvas=document.createElement('canvas');
  const graphics=canvas.getContext('webgl2')||canvas.getContext('webgl');
  const renderer=graphics?new T.WebGLRenderer({canvas,context:graphics,antialias:true,powerPreference:'high-performance'}):softwareRenderer(T);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
  renderer.localClippingEnabled=true;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  const realGL=!!graphics;
  if(realGL){renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;}
  ui('view').append(renderer.domElement);
  const camera=new T.OrthographicCamera();
  const baseOffset=new T.Vector3(23,27,31);
  const offset=baseOffset.clone();
  let cameraQuarter=0;
  ui('rotate-camera').onclick=()=>{cameraQuarter=(cameraQuarter+1)%4;offset.copy(baseOffset).applyAxisAngle(new T.Vector3(0,1,0),cameraQuarter*Math.PI/2);};
  ui('floor-view').onclick=()=>{upperFloorView=upperFloorView===true?false:true;desiredZoom=upperFloorView?1.4:1;ui('zoom-level').textContent=desiredZoom.toLocaleString('fr-BE',{maximumFractionDigits:1})+'×';ui('floor-view').textContent=upperFloorView?'Voir le rez-de-chaussée':'Voir l’étage';ui('floor-view').setAttribute('aria-pressed',String(upperFloorView));};
  const center=new T.Vector3();
  const manualCenter=new T.Vector3();
  const desiredCenter=new T.Vector3();
  camera.position.copy(offset);
  camera.lookAt(center);
  let desiredZoom=1;
  function zoomBy(ratio){
    desiredZoom=Math.max(1,Math.min(28,desiredZoom*ratio));
    ui('zoom-level').textContent=desiredZoom.toLocaleString('fr-BE',{maximumFractionDigits:1})+'×';
  }
  ui('zoom-in').onclick=()=>zoomBy(1.55);
  ui('zoom-out').onclick=()=>zoomBy(1/1.55);
  const view=ui('view');
  view.addEventListener('wheel',event=>{
    event.preventDefault();
    zoomBy(Math.exp(-event.deltaY*.0025));
  },{passive:false});
  const pointers=new Map();
  const position=event=>({x:event.clientX,y:event.clientY});
  function pinchDistance(){
    const [a,b]=pointers.values();
    return b?Math.hypot(a.x-b.x,a.y-b.y):0;
  }
  view.addEventListener('pointerdown',event=>{
    pointers.set(event.pointerId,position(event));
    view.setPointerCapture(event.pointerId);
  });
  view.addEventListener('pointermove',event=>{
    const previous=pointers.get(event.pointerId);
    if(!previous)return;
    const before=pinchDistance(), current=position(event);
    pointers.set(event.pointerId,current);
    if(before>0){zoomBy(pinchDistance()/before);return;}
    if(following)return;
    const unit=(camera.top-camera.bottom)/(Math.max(1,view.clientHeight)*camera.zoom);
    const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
    const up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
    up.y=0;
    manualCenter.addScaledVector(right,(previous.x-current.x)*unit);
    manualCenter.addScaledVector(up,(current.y-previous.y)*unit/Math.max(.25,up.lengthSq()));
    manualCenter.x=Math.max(-19,Math.min(19,manualCenter.x));
    manualCenter.z=Math.max(-12,Math.min(12,manualCenter.z));
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(name,event=>pointers.delete(event.pointerId));
  const resize=()=>{
    const {clientWidth:w,clientHeight:h}=ui('view');
    if(!w||!h)return;
    const aspect=w/h, half=Math.max(14.6,22.5/aspect);
    Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half,near:.1,far:170});
    camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
  };
  new ResizeObserver(resize).observe(ui('view')); resize();
  scene.add(new T.HemisphereLight(0xfff7df,0x688369,2.1));
  const sun=new T.DirectionalLight(0xfff0d1,2.3);sun.position.set(-10,22,10);scene.add(sun);
  if(realGL){
    const small=matchMedia('(pointer:coarse)').matches;
    sun.castShadow=true;
    sun.shadow.mapSize.set(small?1024:2048,small?1024:2048);
    Object.assign(sun.shadow.camera,{left:-26,right:26,top:20,bottom:-20,near:1,far:70});
    sun.shadow.bias=-.0004;sun.shadow.normalBias=.05;sun.shadow.radius=3;
    sun.target.position.set(0,0,0);scene.add(sun.target);
  }
  if(realGL){
    // Fond en dégradé radial : le diorama se détache au lieu de flotter sur un aplat.
    const bg=document.createElement('canvas');bg.width=bg.height=512;
    const g=bg.getContext('2d'),grad=g.createRadialGradient(256,230,30,256,256,360);
    grad.addColorStop(0,'#8fb0a3');grad.addColorStop(.55,'#5f8277');grad.addColorStop(1,'#2f4741');
    g.fillStyle=grad;g.fillRect(0,0,512,512);
    const tex=new T.CanvasTexture(bg);tex.colorSpace=T.SRGBColorSpace;scene.background=tex;
    // Lumière de remplissage froide, sans ombre, pour donner du volume côté ombre.
    const fill=new T.DirectionalLight(0xbfd8ff,.55);fill.position.set(14,10,-12);scene.add(fill);
  }
  let shadowPass=0;
  const flagShadows=()=>{if(!realGL)return;scene.traverse(o=>{if(o.isMesh&&!o.userData.shadowSet&&!o.material?.transparent){o.userData.shadowSet=true;o.castShadow=true;o.receiveShadow=true;}});};
  const mat=color=>new T.MeshStandardMaterial({color,roughness:.9});
  function box(w,h,d,x,y,z,material){
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  }
  function surfaceTexture(base,colors,repeat){
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,128,128);
    for(let i=0;i<850;i++){
      ctx.fillStyle=colors[i%colors.length];
      ctx.fillRect((i*67)%128,(i*i*13+17*i)%128,1+i%3,1+(i>>3)%3);
    }
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(...repeat);
    if(realGL)texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy?.()||1);
    return texture;
  }
  const lawn=mat('#849b73');
  lawn.map=surfaceTexture('#f2f6e8',['#cad2b9','#dee7d1','#e7efdc','#becaa9'],[20,13]);
  box(38,.65,24,0,-.36,0,lawn);
  box(39,.27,25,0,-.78,0,mat('#304e44'));
  const gravel=mat('#c3a582');gravel.map=surfaceTexture('#f8eddd',['#cfbaa0','#e2ceb5','#fff4dc'],[13,2]);
  box(15,.035,1.5,3,0,4,gravel);
  const fence=mat('#d9c6a3');
  for(const y of [.28,.7]){
    for(const x of [-19,19])box(.10,.10,24,x,y,0,fence);
    for(const z of [-12,12])box(38,.10,.10,0,y,z,fence);
  }
  for(let x=-19;x<=19;x+=2)for(const z of [-12,12])box(.15,.95,.15,x,.46,z,fence);
  for(let z=-10;z<=10;z+=2)for(const x of [-19,19])box(.15,.95,.15,x,.46,z,fence);
  for(const [i,[x,z]] of [[-17,-10],[-15,10],[-2,-10],[5,-10],[16,-9],[17,10],[-10,10]].entries()){
    box(.24,1.3,.24,x,.65,z,mat('#886746'));
    const crown=new T.Mesh(new T.IcosahedronGeometry(1.15+i%2*.2,1),mat(i%2?'#739854':'#547d52'));
    crown.position.set(x,1.75,z);scene.add(crown);
  }
  for(const [text,x,z] of [['SALON',-8,-2],['CUISINE',-2,-3],['A · L · E · X',-7,3]]){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=90;
    const context=canvas.getContext('2d');context.fillStyle='#28443a';context.fillRect(0,0,384,90);
    context.fillStyle='#fff0cf';context.font='bold 44px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillText(text,192,47);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const plaque=new T.Mesh(new T.PlaneGeometry(1.55,.36),new T.MeshBasicMaterial({map:texture}));
    plaque.position.set(x,.65,z);scene.add(plaque);
  }
  const play=bindPlayViews(T,scene,worker,mat,id=>{
    const item=snapshot?.playItems?.[id];
    if(!item)return;
    following=false;showFollowState();
    manualCenter.set(item.x,.25,item.z);
    zoomBy((id==='toy'?11:6)/desiredZoom);
  });
  const parse=(loader,data)=>new Promise((resolve,reject)=>loader.parse(data,'',resolve,reject));
  const actors=[];
  let physicalRope, trampolineMesh, swingSeat;
  const houseDoors=[];
  let interiorVisuals, houseCut, houseRoofMeshes=[];
  const ropeUp=new T.Vector3(0,1,0);
  const failures=[];
  let ready=0;
  function load(name, task){
    return task.then(()=>{ready++;}).catch(error=>{failures.push(name);console.error(name,error);}).finally(()=>{
      ui('scene-status').textContent=failures.length?'Chargement indisponible · '+failures.join(', '):ready===3?graphics?'Villa et parc · Vue en coupe':'Villa et parc · Rendu simplifié':'Chargement de la scène 3D…';
    });
  }
  load('villa', (async()=>{
    const {scene:house}=await parse(new GLTFLoader(),await assets.loadHouseModel());
    house.scale.setScalar(.65);house.position.set(-3.65,.035,2.6);
    const cut=houseCut=new T.Plane(new T.Vector3(0,-1,0),1.45);
    scene.add(house);
    house.updateMatrixWorld(true);
    houseRoofMeshes=[];
    house.traverse(object=>{
      if(!object.isMesh)return;
      const bounds=new T.Box3().setFromObject(object),size=bounds.getSize(new T.Vector3());
      const names=(object.name+' '+[object.material].flat().map(material=>material?.name||'').join(' ')).toLowerCase();
      const roofByName=/roof|toit|roofing|ceiling|plafond/.test(names);
      const roofByShape=bounds.min.y>3.15&&size.y<1.45&&Math.max(size.x,size.z)>1.8;
      if(roofByName||roofByShape)houseRoofMeshes.push(object);
    });
    const sourcePoint=(x,z,height)=>house.localToWorld(new T.Vector3(x,height,-z));
    const trampoline=house.getObjectByName('Object_112');
    const timber=surfaceTexture('#ebdbc3',['#ddd0b8','#cdbb9f','#efdfc5'],[3,3]);
    const plaster=surfaceTexture('#f5f0e4',['#dfd9cd','#ede7db','#f2eee6'],[2,2]);
    house.traverse(o=>{
      if(!o.isMesh||o===trampoline)return;
      for(const m of [o.material].flat()){
        m.clippingPlanes=[cut];
        const name=m.name.toLowerCase();
        if(/bois|wood|parquet/.test(name)){
          m.color.lerp(new T.Color('#b78e69'),.25);
          if(!m.map&&o.geometry.attributes.uv)m.map=timber;
        }else if(/wall|mur|brick|brique|enduit|stucco/.test(name)){
          m.color.lerp(new T.Color(/brick|brique/.test(name)?'#b5816c':'#e2d7c3'),.28);
          if(!m.map&&o.geometry.attributes.uv)m.map=plaster;
        }else if(/roof|toit|tile|tuile/.test(name)){
          m.color.set(/roof|toit/.test(name)?'#a96f57':'#c78b68');
        }else if(/glass|vitre|window|fenetre/.test(name)){
          m.color.set('#9bc6ce');m.transparent=true;m.opacity=.68;
        }else if(/metal|steel|acier|handle|poignee/.test(name)){
          m.color.set('#8b9694');
        }else if(!m.map&&m.color&&m.color.getHex()===0xffffff){
          m.color.set(/fabric|tissu|sofa|cushion/.test(name)?'#a9a18b':/ceramic|sink|bath|sanitaire/.test(name)?'#e8e8df':'#d4c7ae');
        }
      }
    });
    if(trampoline?.isMesh){
      trampoline.geometry=trampoline.geometry.clone();
      trampolineMesh={mesh:trampoline,original:trampoline.geometry.attributes.position.array.slice()};
    }
    const bed=sourcePoint(2.43,-6.88,.922);
    const entry=sourcePoint(6.65,-6.88,0);
    const doors=[];
    function makeDoor(source,id,name,mechanism,left,right,z,top,action,select,options={}){
      if(!source?.isMesh)return;
      const geometry=source.geometry.clone();
      if(select){
        const index=geometry.index;
        const positions=geometry.attributes.position;
        const moving=[],fixed=[];
        for(let i=0;i<index.count;i+=3){
          const face=[index.getX(i),index.getX(i+1),index.getX(i+2)];
          (face.every(vertex=>select(positions.getX(vertex),positions.getY(vertex),positions.getZ(vertex)))?moving:fixed).push(...face);
        }
        if(!moving.length)return;
        geometry.setIndex(moving);
        source.geometry=source.geometry.clone().setIndex(fixed);
      }else source.visible=false;
      const hinge=id==='closet-right'?right:left;
      const alongDepth=options.axis==='x';
      const at=(edge)=>alongDepth?sourcePoint(z,edge,options.base||0):sourcePoint(edge,z,options.base||0);
      const pivot=at(hinge);
      const center=at((left+right)/2);
      const width=(right-left)*.65;
      geometry.applyMatrix4(source.matrixWorld).translate(-pivot.x,-pivot.y,-pivot.z);
      const root=new T.Group();
      root.position.copy(pivot);
      const material=source.material.clone();
      root.add(new T.Mesh(geometry,material));
      const start=(left-hinge)*.65,end=(right-hinge)*.65;
      root.userData={dynamic:true,door:true,color:material.color.getStyle(),
        corners:[[start,0],[end,0],[end,top*.65],[start,top*.65]].map(([x,y])=>alongDepth?new T.Vector3(0,y,-x):new T.Vector3(x,y,0))};
      scene.add(root);
      houseDoors.push({id,root,pivot,mechanism,width,floor:options.base?1:0,sign:id==='closet-right'?-1:1});
      if(!options.appliance){
        doors.push({id,name,mechanism,x:center.x,z:center.z,width,action,axis:options.axis,floor:options.base?1:0,passage:options.passage??mechanism==='coulissante'});
      }
    }
    makeDoor(house.getObjectByName('Object_93'),'breezeway','porte coulissante','coulissante',-3.495,-2.704,-3.979,2.128,1);
    const closet=house.getObjectByName('Object_94');
    makeDoor(closet,'closet-left','porte gauche du placard','charnière',-13.62,-12.93,.49,1.9,2,(x,z)=>x>=-13.62&&x<=-12.93&&z>.305);
    makeDoor(closet,'closet-right','porte droite du placard','charnière',-12.50,-11.81,.49,1.9,2,(x,z)=>x>=-12.50&&x<=-11.81&&z>.305);
    const innerDoor=house.getObjectByName('Object_51');
    makeDoor(innerDoor,'interior-east','porte intérieure du couloir','charnière',3.54,4.34,-1.025,2.02,2,
      (x,z,y)=>x>=3.54&&x<=4.34&&z>=-1.057&&z<=-.993&&y<=2.04,{passage:true});
    const glass=house.getObjectByName('Object_54');
    makeDoor(glass,'shower-door','porte vitrée de la douche','charnière',-1.57,-1.04,-2.895,2.05,2,
      (x,z,y)=>x>=-1.57&&x<=-1.04&&z>=-2.912&&z<=-2.875&&y<=2.07,{passage:true});
    makeDoor(house.getObjectByName('Object_99'),'fridge','porte du frigo','charnière',2.87,3.88,4.22,2.05,2,null,
      {axis:'x',appliance:true});
    const selectLeaf=(x1,x2,z1,z2,y1,y2)=>(x,z,y)=>x>=x1&&x<=x2&&z>=z1&&z<=z2&&y>=y1&&y<=y2;
    makeDoor(house.getObjectByName('Object_6'),'bedroom-ground','porte de la chambre','charnière',-9.843,-8.943,.332,2,2,
      selectLeaf(-9.845,-8.941,.305,.359,-.01,2.005),{passage:true});
    makeDoor(innerDoor,'bedroom-east','porte latérale de la chambre','charnière',6.86,7.67,-8.22,2.15,2,
      selectLeaf(-8.256,-8.183,6.864,7.667,-.01,2.155),{axis:'x',passage:true});
    makeDoor(innerDoor,'front','porte d’entrée','charnière',-1.84,-1.08,8.666,2.14,2,
      selectLeaf(-1.841,-1.079,8.635,8.698,-.01,2.142),{passage:true});
    const upperDoor=house.getObjectByName('Object_17');
    for(const [id,left,right] of [['upper-bedroom',-8.84,-7.965],['upper-landing',-1.913,-1.038]]){
      makeDoor(upperDoor,id,'porte de l’étage','charnière',left,right,.609,2.16,2,
        selectLeaf(left-.002,right+.002,.582,.636,2.947,5.108),{base:2.95,passage:true});
    }
    makeDoor(upperDoor,'upper-bathroom','porte de la salle de bain','charnière',7.26,8.14,-9.633,2.16,2,
      selectLeaf(-9.66,-9.606,7.259,8.138,2.947,5.108),{base:2.95,axis:'x',passage:true});
    const points=(x,z,height=0)=>{const p=sourcePoint(x,z,height);return {x:p.x,y:p.y,z:p.z};};
    const station=(x,z,heading=Math.PI/2)=>({...points(x,z),heading});
    const kitchen={
      fridge:station(3.75,3.37),cupboard:station(3.68,7.48,Math.PI),sink:station(3.21,7.53,Math.PI),
      drawer:station(3.83,5.87),counter:station(3.82,4.43),hob:station(3.87,6.47),
      oven:station(3.75,6.47),serve:station(3.81,4.94),dishwasher:station(3.78,5.39),
      table:station(-1.30,4.45,-Math.PI/2)
    };
    const beds=[
      {...points(-12.39,5.85,.55),floor:0,heading:Math.PI,approach:points(-12.39,5.05)},
      {...points(-4.18,-2.50,3.54),floor:1,heading:-Math.PI/2,approach:points(-3.52,-2.50)},
      {...points(-12.49,-.64,3.84),floor:1,heading:0,approach:points(-10.88,-1.22)}
    ];
    const stairs=[[.15,.86,-.054],[-.05,.19,.18],[.03,-.22,.38],[.16,-.44,.54],[.39,-.46,.86],
      [.7,-.46,1.02],[1.05,-.46,1.26],[1.43,-.46,1.50],[1.83,-.46,1.72],[2.23,-.46,1.93],
      [2.65,-.46,2.14],[2.99,-.46,2.30],[3.50,-.42,2.62],[3.75,-.23,2.78],
      [3.85,.13,2.95],[4.10,.40,2.95]].map(([x,z,y])=>points(x,z,y));
    const objects={
      sofa:points(-10.15,-1.5),tv:points(-6.25,-2.3),book:points(-5.75,-2.9),
      water:points(-8.9,-5.23),shower:points(-1.16,-3.53),dishwasher:points(3.79,5.36),
      fireplace:points(3.73,1.67)
    };
    const tv=house.getObjectByName('Object_32');
    if(tv?.isMesh)tv.material=tv.material.clone();
    const flame=house.getObjectByName('Object_22');
    const lights={
      oven:new T.PointLight(0xff902c,0,2),
      dishwasher:new T.PointLight(0x73d6ff,0,1.4),
      hob:new T.PointLight(0xff5227,0,1.2),
      sink:new T.PointLight(0x83d9ff,0,1.05)
    };
    lights.oven.position.copy(sourcePoint(4.28,6.49,.56));
    lights.dishwasher.position.copy(sourcePoint(4.28,5.38,.82));
    lights.hob.position.copy(sourcePoint(4.59,6.48,.96));
    lights.sink.position.copy(sourcePoint(3.13,8.17,.99));
    scene.add(...Object.values(lights));
    const water=new T.Group();
    const dropsMaterial=new T.MeshBasicMaterial({color:0x9de8fa,transparent:true,opacity:.72});
    const dropGeometry=new T.SphereGeometry(.018,6,4);
    for(let i=0;i<14;i++){
      const drop=new T.Mesh(dropGeometry,dropsMaterial);
      drop.position.set(Math.sin(i*3.7)*.17,0,Math.cos(i*2.7)*.14);
      water.add(drop);
    }
    water.position.copy(sourcePoint(-1.10,-3.49,1.94));
    water.visible=false;
    water.userData.ignoreSoftware=true;
    scene.add(water);
    const plates=[];
    for(let i=0;i<6;i++){
      const plate=new T.Group();
      const dish=new T.Mesh(new T.CylinderGeometry(.10,.083,.018,16),mat('#f1ebd7'));
      const food=new T.Mesh(new T.SphereGeometry(.055,10,7),mat(i%2?'#bd5e37':'#90ab52'));
      food.scale.y=.48;food.position.y=.024;
      plate.add(dish,food);
      plate.position.copy(sourcePoint(-2.76-(i%2)*.42,3.67+Math.floor(i/2)*.66,1.08));
      plate.visible=false;
      plate.userData.ignoreSoftware=true;
      plates.push(plate);
      scene.add(plate);
    }
    interiorVisuals={tv,flame,lights,water,plates};
    worker.postMessage({type:'house',geometry:{doors,kitchen,objects,beds,stairs,trampoline:{x:bed.x,y:bed.y,z:bed.z,entryX:entry.x,entryZ:entry.z}}});
  })());
  load('aire de jeux', (async()=>{
    const files=await unzipPlayground(await assets.loadPlaygroundSourceZip());
    const urls=new Map();
    for(const [name,buffer] of files){
      if(name==='scene.gltf'||name==='license.txt')continue;
      const type=name.endsWith('.png')?'image/png':name.endsWith('.jpeg')?'image/jpeg':'application/octet-stream';
      urls.set(name,URL.createObjectURL(new Blob([buffer],{type})));
    }
    const manager=new T.LoadingManager();
    manager.setURLModifier(url=>urls.get(decodeURIComponent(url.replace(/^\.\//,'')))||url);
    try{
      const {scene:park,parser}=await parse(new GLTFLoader(manager),new TextDecoder().decode(files.get('scene.gltf')));
      const bounds=new T.Box3().setFromObject(park), span=bounds.getSize(new T.Vector3()), center=bounds.getCenter(new T.Vector3());
      const s=12/Math.max(span.x,span.z);
      park.scale.setScalar(s);park.position.set(10-center.x*s,.05-bounds.min.y*s,3-center.z*s);
      park.traverse(object=>{if(!object.isMesh)return;for(const material of [object.material].flat()){if(!material?.color)continue;const name=(object.name+' '+material.name).toLowerCase();if(!material.map&&material.color.getHex()===0xffffff)material.color.set(/slide|toboggan/.test(name)?'#d77a4e':/swing|balancoire/.test(name)?'#d4a653':/grass|herbe|tree|arbre/.test(name)?'#789b65':'#c5b79e');}});
      scene.add(park);
      park.updateMatrixWorld(true);
      const worldPoint=(x,z,height)=>park.localToWorld(new T.Vector3(x,height,-z));
      // Surface sampled down the center of Cyprus mesh 27.
      const heights=[59.2,59.2,55.7,51.1,47.6,45.1,42.6,39.3,35.6,30.8,25.3,20.5,15.8,12,8.5,5.7,3.8];
      const slide=heights.map((height,i)=>worldPoint(190+5*i,-34.6,height).toArray());
      const anchor=worldPoint(58.1,-21.14,98.43);
      const end=worldPoint(58.1,-21.14,4.71);
      const length=anchor.distanceTo(end);
      // Replace this strand in the rendered copy. Keep the rest of the rope mesh.
      park.traverse(mesh=>{
        if(!mesh.isMesh||parser.associations.get(mesh)?.meshes!==13)return;
        const geometry=mesh.geometry.clone();
        const positions=geometry.getAttribute('position');
        const index=geometry.index;
        if(!index)return;
        const indices=[];
        for(let i=0;i<index.count;i+=3){
          const triangle=[index.getX(i),index.getX(i+1),index.getX(i+2)];
          if(triangle.every(vertex=>positions.getX(vertex)>57&&positions.getX(vertex)<60))continue;
          indices.push(...triangle);
        }
        geometry.setIndex(indices);
        mesh.geometry=geometry;
      });
      physicalRope=new T.Mesh(new T.CylinderGeometry(.035,.035,1,9),mat('#6a4b32'));
      physicalRope.userData={dynamic:true,rope:true,anchor,end};
      scene.add(physicalRope);
      const equipment={swing:{x:13.5,z:6.2},bars:{x:11.2,z:7.0},wall:{x:15.3,z:6.5}};
      const postMaterial=mat('#8a6748'),barMaterial=mat('#d5a75e'),holdColors=['#d85c4a','#e4b94f','#5b9b83','#6888bd'];
      const post=(x,y,z,height,radius=.075,material=postMaterial)=>{const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,height,10),material);mesh.position.set(x,y+height/2,z);scene.add(mesh);};
      const beam=(a,b,radius,material)=>{const v=new T.Vector3(...a),w=new T.Vector3(...b),d=w.clone().sub(v);const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,d.length(),10),material);mesh.position.copy(v).add(w).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());scene.add(mesh);};
      const sx=equipment.swing.x,sz=equipment.swing.z;post(sx-.72,0,sz-.28,2.05);post(sx+.72,0,sz-.28,2.05);beam([sx-.82,2.02,sz-.28],[sx+.82,2.02,sz-.28],.065,barMaterial);
      swingSeat=new T.Group();swingSeat.position.set(sx,0,sz-.28);const ropeMat=mat('#6d5541');
      for(const x of [-.25,.25]){const rope=new T.Mesh(new T.CylinderGeometry(.018,.018,1.48,7),ropeMat);rope.position.set(x,1.26,0);swingSeat.add(rope);}
      const seat=new T.Mesh(new T.BoxGeometry(.62,.10,.28),mat('#c66f48'));seat.position.y=.49;swingSeat.add(seat);scene.add(swingSeat);
      const bx=equipment.bars.x,bz=equipment.bars.z;for(const x of [-.65,.65])post(bx+x,0,bz,2.05);beam([bx-.65,2.03,bz],[bx+.65,2.03,bz],.055,barMaterial);for(let i=0;i<7;i++){const x=bx-.54+i*.18;beam([x,2.03,bz-.34],[x,2.03,bz+.34],.045,barMaterial);}
      const wx=equipment.wall.x,wz=equipment.wall.z;const wallPanel=new T.Mesh(new T.BoxGeometry(1.45,2.1,.16),mat('#b77d58'));wallPanel.position.set(wx,1.05,wz);wallPanel.rotation.x=-.20;scene.add(wallPanel);
      for(let i=0;i<15;i++){const hold=new T.Mesh(new T.DodecahedronGeometry(.09,0),mat(holdColors[i%holdColors.length]));hold.position.set(wx+((i%3)-1)*.39,.28+Math.floor(i/3)*.35,wz-.13);scene.add(hold);}
      worker.postMessage({type:'park',geometry:{slide:slide.map(([x,y,z])=>({x,y,z})),rope:{x:anchor.x,y:anchor.y,z:anchor.z,length},equipment}});
    }finally{for(const url of urls.values())URL.revokeObjectURL(url);}
  })());
  load('personnages', (async()=>{
    const [binary,profiles]=await Promise.all([assets.loadCharacterModel(),fetch('/assets/3d/characters.json').then(r=>r.json())]);
    const {scene:model}=await parse(new GLTFLoader(),modernizePopo(binary));
    model.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(model), center=bounds.getCenter(new T.Vector3());
    const height=bounds.max.y-bounds.min.y;
    const geometries=[];
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      geometry.translate(-center.x,-bounds.min.y,-center.z);
      geometry.rotateY(Math.PI/2);
      geometry.scale(1/height,1/height,1/height);
      geometries.push({geometry,name:mesh.material.name});
    });
    for(const id of ['alex','joseph','marie','juliette','timeo','nathan','francoise','rose']){
      const profile=id==='alex'?profiles.variants[0]:profiles.variants.find(item=>item.id===id);
      const root=new T.Group();
      root.userData={dynamic:true,suit:profile.suit,skin:profile.skin};
      const rig=buildPopoRig(T,root,mat(profile.accent));
      root.userData.rig=rig;
      const face=buildFace(T,rig,id,profile.skin);
      root.userData.face=face.profile;
      for(const {geometry,name} of geometries){
        const key=name.toLowerCase();
        if(key.includes('head')||key.includes('glass'))continue;
        const material=mat(key.includes('003')?profile.accent:profile.suit);
        if(!geometry.hasAttribute('skinIndex'))skinPopoGeometry(T,geometry,rig);
        const mesh=new T.SkinnedMesh(geometry,material);
        mesh.frustumCulled=false;
        root.add(mesh);
        root.updateMatrixWorld(true);
        mesh.bind(rig.skeleton);
      }
      profile.name=personNames[id]||profile.name;
      const label=document.createElement('button');
      label.type='button';label.className='tag'+(id==='alex'?' alex':'');label.textContent=profile.name;
      label.title='Suivre '+profile.name;label.onclick=()=>selectPerson(id);ui('labels').append(label);
      scene.add(root);actors.push({id,root,profile,label,rig,face});
    }
    actors[0].ageProfiles=Array.from({length:9},(_,i)=>profiles.variants[Math.min(7,Math.max(0,i-1))]);
    const julietteActor=actors.find(actor=>actor.id==='juliette');
    if(julietteActor)julietteActor.ageProfiles=actors[0].ageProfiles;
  })());
  const assetURL='/assets/3d/';
  const readAsset=async file=>{
    const response=await fetch(assetURL+file);
    if(!response.ok)throw Error('Modèle indisponible : '+file);
    return response;
  };
  Promise.allSettled([
    (async()=>play.football((await parse(new GLTFLoader(),await (await readAsset('soccer_ball__football.glb')).arrayBuffer())).scene))(),
    (async()=>play.toy((await parse(new GLTFLoader(),await (await readAsset('kid_toy_low_poly.glb')).arrayBuffer())).scene))(),
    (async()=>{
      const files=await unzipPlayground(await (await readAsset('low_poly_kids_tricycle.zip')).blob());
      const urls=new Map();
      for(const [name,data] of files)if(name==='scene.bin'||name.startsWith('textures/')){
        const type=name.endsWith('.jpeg')?'image/jpeg':name.endsWith('.png')?'image/png':'application/octet-stream';
        urls.set(name,URL.createObjectURL(new Blob([data],{type})));
      }
      const manager=new T.LoadingManager();
      manager.setURLModifier(url=>urls.get(decodeURIComponent(url.replace(/^\.\//,'')))||url);
      try{play.tricycles((await parse(new GLTFLoader(manager),new TextDecoder().decode(files.get('scene.gltf')))).scene);}
      finally{for(const url of urls.values())URL.revokeObjectURL(url);}
    })()
  ]).then(results=>{for(const result of results)if(result.status==='rejected')console.warn(result.reason);});
  const point=new T.Vector3();
  let last=performance.now();
  renderer.setAnimationLoop(now=>{
    if(ui('world-layout').hidden){last=now;return;}
    const dt=Math.min(.05,(now-last)/1000);last=now;
    const focus=following&&actors.find(actor=>actor.id===followedPerson);
    if(upperFloorView!==null){desiredCenter.set(-3.65,upperFloorView?2.65:.65,2.6);manualCenter.copy(desiredCenter);}
    else if(focus){
      desiredCenter.copy(focus.root.position);
      desiredCenter.y+=focus.root.scale.x*.45;
      manualCenter.copy(desiredCenter);
    }else desiredCenter.copy(manualCenter);
    const smoothing=1-Math.exp(-dt*12);
    center.lerp(desiredCenter,smoothing);
    camera.position.copy(center).add(offset);
    camera.lookAt(center);
    camera.zoom+=(desiredZoom-camera.zoom)*smoothing;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    if(snapshot){
      const tracked=focus&&(focus.id==='alex'?snapshot.alex:snapshot.people.find(person=>person.id===focus.id));
      const upstairs=upperFloorView===null?Boolean(tracked?.floor||tracked?.y>1.1&&tracked?.activity.includes('escalier')):upperFloorView;
      if(upperFloorView===null)ui('floor-view').textContent=upstairs?'Voir le rez-de-chaussée':'Voir l’étage';
      if(houseCut){houseCut.normal.set(0,upstairs?1:-1,0);houseCut.constant=upstairs?-1.8:1.45;scene.userData.floorCut=upstairs?'upper':'ground';
      for(const roof of houseRoofMeshes)roof.visible=!upstairs;}
      play.update(snapshot.playItems);
      for(const door of houseDoors){
        door.root.visible=upperFloorView===true?Boolean(door.floor):upperFloorView===false?!door.floor:(!door.floor||upstairs);
        const amount=door.id==='fridge'?(snapshot.kitchen?.fridge||0):(snapshot.doors?.[door.id]?.amount||0);
        if(door.mechanism==='coulissante')door.root.position.x=door.pivot.x+door.width*amount;
        else door.root.rotation.y=door.sign*amount*1.5;
      }
      if(interiorVisuals){
        const {tv,flame,lights,water,plates}=interiorVisuals;
        const devices=snapshot.household||{};
        if(tv?.material.emissive){
          tv.material.emissive.set('#7fc3ef');
          tv.material.emissiveIntensity=devices.tv?.35+Math.sin(snapshot.ticks*.08)*.13:0;
        }
        if(flame)flame.visible=Boolean(devices.fireplace);
        lights.oven.intensity=snapshot.kitchen?.oven?3:0;
        lights.dishwasher.intensity=devices.dishwasher||snapshot.kitchen?.dishwasher?1.8:0;
        lights.hob.intensity=snapshot.kitchen?.hob?1.9:0;
        lights.sink.intensity=snapshot.kitchen?.sink?1.6:0;
        water.visible=Boolean(devices.shower);
        if(water.visible)water.children.forEach((drop,i)=>{drop.position.y=-((snapshot.ticks*.035+i*.17)%1.15);});
        plates.forEach((plate,i)=>{plate.visible=i<(snapshot.kitchen?.meals||0);});
      }
      if(graphics&&trampolineMesh){
        const {mesh,original}=trampolineMesh;
        const positions=mesh.geometry.attributes.position;
        const depth=snapshot.membrane||0;
        for(let i=0;i<positions.count;i++){
          const x=original[i*3],z=original[i*3+1],y=original[i*3+2];
          if(y<.84||y>.94)continue;
          const radius=((x-2.43)/2.79)**2+((z+6.88)/2.02)**2;
          positions.setZ(i,y-depth/.65*Math.max(0,1-radius));
        }
        positions.needsUpdate=true;
      }
      if(swingSeat&&snapshot.playgroundMotion)swingSeat.rotation.x=snapshot.playgroundMotion.swingAngle||0;
      if(physicalRope){
        const {anchor,end}=physicalRope.userData;
        if(snapshot.ropeEnd)end.set(snapshot.ropeEnd.x,snapshot.ropeEnd.y,snapshot.ropeEnd.z);
        physicalRope.position.copy(anchor).lerp(end,.5);
        const direction=point.copy(anchor).sub(end);
        physicalRope.scale.y=direction.length();
        physicalRope.quaternion.setFromUnitVectors(ropeUp,direction.normalize());
      }
      for(const actor of actors){
        const p=actor.id==='alex'?snapshot.alex:snapshot.people.find(person=>person.id===actor.id);
        const main=actor.id==='alex';
        const grows=main||['juliette','timeo','nathan','francoise','rose'].includes(actor.id);
        const ageIndex=Math.min(8,snapshot.age+(actor.id==='juliette'?2:0));
        const size=(grows?actors[0].ageProfiles[ageIndex].scale:actor.profile.scale)*1.85;
        actor.root.scale.setScalar(size);
        actor.root.position.lerp(point.set(p.x,p.y||0,p.z),1-Math.exp(-dt*(human?22:12)));
        const gesture=p.languageGesture;
        const lying=p.lie||0;
        actor.root.rotation.y=gesture&&!lying?gesture.heading:p.heading;
        actor.root.visible=upperFloorView===true?Boolean(p.floor):upperFloorView===false?!p.floor:(!p.floor||upstairs);
        actor.root.rotation.order='YXZ';
        actor.root.rotation.x=lying*Math.PI/2+Math.max(-1.38,Math.min(1.38,p.tilt||0))*(1-lying);
        const gait=lying?0:main?p.effort:p.moving?Math.sin(p.phase)*.6:0;
        const crouch=p.pose||0;
        const pointing=gesture?.kind==='point'&&!lying;
        posePopo(actor.rig,p.joints,crouch,gait,1-Math.exp(-dt*14),p.tilt||0);
        if(p.hug){
          for(const side of actor.rig.sides){side.shoulder.rotation.x=-.82;side.shoulder.rotation.z=Math.sign(side.shoulder.position.x||1)*.58;side.elbow.rotation.x=-1.02;side.wrist.rotation.x=.12;}
        }
        if(pointing){
          const arm=actor.rig.sides[1];
          arm.shoulder.rotation.z*=.7;
          arm.shoulder.rotation.y=-Math.PI/3;
          arm.elbow.rotation.y*=.6;
        }
        actor.root.userData.crouch=crouch;
        const line=conversationRows.at(-1);
        for(const eye of actor.face.eyes){
          eye.closed.visible=lying>.8;
          for(const detail of eye.open)detail.visible=!eye.closed.visible;
        }
        const talking=lying<.8&&line?.speaker===actor.id&&snapshot.ticks/120-line.at<Math.max(1,line.text.length*.077);
        actor.face.mouth.scale.y=talking?.008+Math.abs(Math.sin(now*.024))*.010:.006;
        point.copy(actor.root.position);point.y+=size*(1-crouch*.24)*(1-lying)+.25;point.project(camera);
        actor.label.hidden=!actor.root.visible||Math.abs(point.x)>1.04||Math.abs(point.y)>1.04;
        actor.label.style.left=(point.x*.5+.5)*100+'%';
        actor.label.style.top=(.5-point.y*.5)*100+'%';
      }
    }
    if(++shadowPass%60===1)flagShadows();
    renderer.render(scene,camera);
  });
}
showWorld().catch(error=>{ui('scene-status').textContent='Scène 3D indisponible sur cet appareil';console.error(error);});
