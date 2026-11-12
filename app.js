const ui = id => document.getElementById(id);
const ages = ['Bébé','Petit enfant','Enfant','Grand enfant','Petit ado','Ado','Jeune homme','Homme'];
const stages = ['Se redresser','Ramper','Tenir debout','Premiers pas','Marche'];
const format = new Intl.NumberFormat('fr-BE');
const saveKey = 'alex-simulacre-v3';
const worker = new Worker('/sim.js');
let snapshot, human = false, lastJournal = '';
const personNames={alex:'Alex',joseph:'Joseph',marie:'Marie',juliette:'Juliette',timeo:'Timéo',nathan:'Nathan',francoise:'Françoise',rose:'Rose'};
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
ui('reset-dialog').querySelector('form').addEventListener('submit',event=>{
  if(event.submitter?.value!=='reset')return;
  event.preventDefault();
  worker.terminate();
  try { localStorage.removeItem(saveKey); } catch {}
  location.reload();
});
try { worker.postMessage({type:'restore',state:JSON.parse(localStorage.getItem(saveKey))}); } catch {}
worker.onmessage = ({data}) => {
  if(data.type==='save'){
    try { localStorage.setItem(saveKey,JSON.stringify(data.state)); } catch {}
    return;
  }
  snapshot=data.state;
  const {ticks,age,skill,score,alex,trials,pecm,journal}=snapshot;
  const days=Math.floor(ticks/120/86400);
  ui('year').textContent='Année fictive '+format.format(1+Math.floor(days/365));
  ui('day').textContent='Jour '+(1+days%365);
  ui('age').textContent=ages[age];
  ui('skill').textContent=stages[skill];
  ui('balance').textContent=score+' %';
  ui('bar').value=score;
  const observed=following&&followedPerson!=='alex'?snapshot.people.find(person=>person.id===followedPerson):alex;
  ui('activity').textContent=observed?.activity||'Se déplace';
  if(snapshot.kitchen){
    ui('fridge-stock').textContent=snapshot.kitchen.ingredients+' / 8';
    ui('meal-stock').textContent=snapshot.kitchen.meals;
  }
  ui('trials').textContent=format.format(trials);
  ui('pecm').textContent=format.format(pecm);
  ui('hunger').textContent=Math.round(alex.hunger*100)+' %';
  ui('fatigue').textContent=Math.round(alex.fatigue*100)+' %';
  const journalKey=journal.map(event=>event.ticks+' '+event.message).join('|');
  if(journalKey!==lastJournal){
    lastJournal=journalKey;
    ui('journal').replaceChildren(...journal.map(event=>Object.assign(document.createElement('li'),{textContent:event.message})));
  }
};
worker.onerror=()=>{ui('mode').textContent='Simulation interrompue';};
ui('speed').onclick=()=>{
  human=!human;
  worker.postMessage({type:'mode',mode:human?'human':'turbo'});
  ui('speed').setAttribute('aria-pressed',String(human));
  ui('speed').textContent=human?'Réaccélérer':'Passer en temps réel';
  ui('mode').textContent=human?'Temps réel · ×1':'Simulation accélérée';
};
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.warn);

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
  let width=1,height=1,lastChildren=-1,ratio=1, overviewOrigin=null;
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
        const cut=material.clippingPlanes?.length?1.45:Infinity;
        const color=material.color||new T.Color('#b5b28a');
        const style=color.getStyle();
        for(let i=0;i<count;i+=stride){
          const vertices=[];let visible=false;
          for(let j=0;j<3;j++){
            const k=index?index.getX(i*3+j):i*3+j;
            point.fromBufferAttribute(position,k).applyMatrix4(mesh.matrixWorld);
            visible||=point.y<cut;
            point.y=Math.min(point.y,cut);
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
      if(lastChildren!==scene.children.length){
        const overview=camera.clone();
        overview.position.set(23,27,31);
        overview.lookAt(0,0,0);
        overview.zoom=1;
        overview.updateProjectionMatrix();
        paintWorld(scene,overview);
        overviewOrigin=project(screen.set(0,0,0).project(overview),overview);
        lastChildren=scene.children.length;
      }
      const origin=project(screen.set(0,0,0).project(camera),camera);
      context.fillStyle='#59766a';
      context.fillRect(0,0,width,height);
      context.drawImage(backdrop,origin[0]-overviewOrigin[0]*camera.zoom,origin[1]-overviewOrigin[1]*camera.zoom,width*camera.zoom,height*camera.zoom);
      for(const object of scene.children.filter(item=>item.userData.dynamic)){
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
          context.fillStyle='#f9b650';context.beginPath();context.arc(x,y,Math.max(2,.21*factor),0,Math.PI*2);context.fill();continue;
        }
        const size=object.scale.x*factor;
        context.strokeStyle=style.suit;context.lineWidth=Math.max(2,size*.19);context.lineCap='round';
        context.beginPath();context.moveTo(x,y-size*.17);context.lineTo(x,y-size*.49);context.stroke();
        context.fillStyle=style.skin;context.beginPath();context.arc(x,y-size*.62,Math.max(2,size*.16),0,Math.PI*2);context.fill();
      }
    }
  };
}
async function showWorld(){
  const [T,{GLTFLoader},assets]=await Promise.all([
    import('three'),import('three/addons/loaders/GLTFLoader.js'),import('/assets/3d/load-character.js')
  ]);
  const scene=new T.Scene();
  scene.background=new T.Color('#59766a');
  const canvas=document.createElement('canvas');
  const graphics=canvas.getContext('webgl2')||canvas.getContext('webgl');
  const renderer=graphics?new T.WebGLRenderer({canvas,context:graphics,antialias:true,powerPreference:'high-performance'}):softwareRenderer(T);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
  renderer.localClippingEnabled=true;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.25;
  ui('view').append(renderer.domElement);
  const camera=new T.OrthographicCamera();
  const offset=new T.Vector3(23,27,31);
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
  const sun=new T.DirectionalLight(0xfff0d1,2.1);sun.position.set(-10,22,10);scene.add(sun);
  const mat=color=>new T.MeshStandardMaterial({color,roughness:.9});
  function box(w,h,d,x,y,z,material){
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  }
  box(38,.65,24,0,-.36,0,mat('#8caa72'));
  box(39,.27,25,0,-.78,0,mat('#304e44'));
  box(15,.035,1.5,3,0,4,mat('#dbbc90'));
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
  const ball=new T.Mesh(new T.SphereGeometry(.21,18,12),mat('#f9b650'));ball.userData={dynamic:true,ball:true};scene.add(ball);
  const parse=(loader,data)=>new Promise((resolve,reject)=>loader.parse(data,'',resolve,reject));
  const actors=[];
  let physicalRope, trampolineMesh;
  const houseDoors=[];
  let interiorVisuals;
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
    const cut=new T.Plane(new T.Vector3(0,-1,0),1.45);
    scene.add(house);
    house.updateMatrixWorld(true);
    const sourcePoint=(x,z,height)=>house.localToWorld(new T.Vector3(x,height,-z));
    const trampoline=house.getObjectByName('Object_112');
    house.traverse(o=>{
      if(o.isMesh&&o!==trampoline)for(const m of [o.material].flat())m.clippingPlanes=[cut];
    });
    if(trampoline?.isMesh){
      trampoline.geometry=trampoline.geometry.clone();
      trampolineMesh={mesh:trampoline,original:trampoline.geometry.attributes.position.array.slice()};
    }
    const bed=sourcePoint(2.43,-6.88,.922);
    const entry=sourcePoint(2.43,-4.7,0);
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
      const at=(edge)=>alongDepth?sourcePoint(z,edge,0):sourcePoint(edge,z,0);
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
      houseDoors.push({id,root,pivot,mechanism,width,sign:id==='closet-right'?-1:1});
      if(!options.appliance){
        doors.push({id,name,mechanism,x:center.x,z:center.z,width,action,passage:options.passage??mechanism==='coulissante'});
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
    const points=(x,z)=>{const p=sourcePoint(x,z,0);return {x:p.x,z:p.z};};
    const kitchen={fridge:points(3.75,3.37),stove:points(3.55,6.35)};
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
      dishwasher:new T.PointLight(0x73d6ff,0,1.4)
    };
    lights.oven.position.copy(sourcePoint(4.28,6.49,.56));
    lights.dishwasher.position.copy(sourcePoint(4.28,5.38,.82));
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
      plate.position.copy(sourcePoint(4.53-(i%2)*.37,6.00+Math.floor(i/2)*.39,1.10));
      plate.visible=false;
      plate.userData.ignoreSoftware=true;
      plates.push(plate);
      scene.add(plate);
    }
    interiorVisuals={tv,flame,lights,water,plates};
    worker.postMessage({type:'house',geometry:{doors,kitchen,objects,trampoline:{x:bed.x,y:bed.y,z:bed.z,entryZ:entry.z}}});
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
      worker.postMessage({type:'park',geometry:{slide:slide.map(([x,y,z])=>({x,y,z})),rope:{x:anchor.x,y:anchor.y,z:anchor.z,length}}});
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
      const gait={value:0}, crouch={value:0};
      for(const {geometry,name} of geometries){
        const key=name.toLowerCase();
        const color=key.includes('head')?profile.skin:key.includes('glass')?'#9cdae6':key.includes('003')?profile.accent:profile.suit;
        const material=mat(color);
        if(key.includes('glass')){material.transparent=true;material.opacity=.34;material.depthWrite=false;}
        material.onBeforeCompile=shader=>{
          shader.uniforms.gait=gait;shader.uniforms.crouch=crouch;
          shader.vertexShader='uniform float gait; uniform float crouch;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
            #include <begin_vertex>
            float leg=1.0-smoothstep(0.28,0.48,position.y);
            float arm=smoothstep(.10,.28,abs(position.x))*smoothstep(.37,.53,position.y)*(1.0-smoothstep(.69,.77,position.y));
            transformed.y-=arm*.32;
            transformed.x*=1.0-arm*.52;
            transformed.z+=sign(position.x)*gait*(leg*.24-arm*.16);
            transformed.y*=1.0-crouch*.43;
          `);
        };
        root.add(new T.Mesh(geometry,material));
      }
      const label=document.createElement('button');
      label.type='button';label.className='tag'+(id==='alex'?' alex':'');label.textContent=profile.name;
      label.title='Suivre '+profile.name;label.onclick=()=>selectPerson(id);ui('labels').append(label);
      scene.add(root);actors.push({id,root,profile,label,gait,crouch});
    }
    actors[0].ageProfiles=profiles.variants.slice(0,8);
  })());
  const point=new T.Vector3();
  let last=performance.now(), followTime=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min(.05,(now-last)/1000);last=now;
    const focus=following&&actors.find(actor=>actor.id===followedPerson);
    if(focus){
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
      ball.position.set(snapshot.ball.x,.21,snapshot.ball.z);
      for(const door of houseDoors){
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
        lights.dishwasher.intensity=devices.dishwasher?1.8:0;
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
        const size=(main?actor.ageProfiles[snapshot.age].scale:actor.profile.scale)*1.85;
        actor.root.scale.setScalar(size);
        actor.root.position.lerp(point.set(p.x,p.y||0,p.z),1-Math.exp(-dt*(human?22:12)));
        actor.root.rotation.y=p.heading;
        actor.root.rotation.x=main?Math.max(-.45,Math.min(.45,p.tilt)):0;
        followTime+=main?dt:0;
        actor.gait.value=main&&snapshot.skill<3?p.effort:Math.sin(human?p.phase:followTime*7+actor.profile.scale*8)*.6;
        actor.crouch.value=main?p.pose:0;
        point.copy(actor.root.position);point.y+=size*(1-actor.crouch.value*.43)+.25;point.project(camera);
        actor.label.hidden=Math.abs(point.x)>1.04||Math.abs(point.y)>1.04;
        actor.label.style.left=(point.x*.5+.5)*100+'%';
        actor.label.style.top=(.5-point.y*.5)*100+'%';
      }
    }
    renderer.render(scene,camera);
  });
}
showWorld().catch(error=>{ui('scene-status').textContent='Scène 3D indisponible sur cet appareil';console.error(error);});
