const ui = id => document.getElementById(id);
const ages = ['Bébé','Petit enfant','Enfant','Grand enfant','Petit ado','Ado','Jeune homme','Homme'];
const stages = ['Se redresser','Ramper','Tenir debout','Premiers pas','Marche'];
const format = new Intl.NumberFormat('fr-BE');
const saveKey = 'alex-simulacre-v3';
const worker = new Worker('/sim.js');
let snapshot, human = false, lastJournal = '';
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
  ui('activity').textContent=alex.activity;
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
  let width=1,height=1,lastChildren=-1,ratio=1;
  function project(vector,camera){
    return [(vector.x*.5+.5)*width,(.5-vector.y*.5)*height,vector.z];
  }
  function paintWorld(scene,camera){
    base.fillStyle='#59766a';base.fillRect(0,0,width,height);
    const triangles=[];
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    for(const root of scene.children){
      if(root.userData.dynamic)continue;
      root.traverse(mesh=>{
        if(!mesh.isMesh)return;
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
        paintWorld(scene,camera);
        lastChildren=scene.children.length;
      }
      context.drawImage(backdrop,0,0);
      for(const object of scene.children.filter(item=>item.userData.dynamic)){
        const [x,y]=project(screen.copy(object.position).project(camera),camera);
        const style=object.userData;
        const factor=height/(camera.top-camera.bottom);
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
  camera.position.set(23,27,31);
  camera.lookAt(0,0,0);
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
  let physicalRope;
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
    house.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())m.clippingPlanes=[cut];});
    scene.add(house);
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
      const label=document.createElement('span');label.className='tag'+(id==='alex'?' alex':'');label.textContent=profile.name;ui('labels').append(label);
      scene.add(root);actors.push({id,root,profile,label,gait,crouch});
    }
    actors[0].ageProfiles=profiles.variants.slice(0,8);
  })());
  const point=new T.Vector3();
  let last=performance.now(), followTime=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(snapshot){
      ball.position.set(snapshot.ball.x,.21,snapshot.ball.z);
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
        actor.label.style.left=(point.x*.5+.5)*100+'%';
        actor.label.style.top=(.5-point.y*.5)*100+'%';
      }
    }
    renderer.render(scene,camera);
  });
}
showWorld().catch(error=>{ui('scene-status').textContent='Scène 3D indisponible sur cet appareil';console.error(error);});
