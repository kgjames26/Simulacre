import {toyRailPoints} from '/toy-rails.js';

function assetMeshes(T,model){
  model.updateMatrixWorld(true);
  const meshes=new Map();
  model.traverse(source=>{
    if(!source.isMesh)return;
    const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);
    meshes.set(source.name,new T.Mesh(geometry,source.material));
  });
  return meshes;
}
function separateMesh(mesh){
  const {geometry}=mesh;
  const position=geometry.attributes.position,index=geometry.index;
  const parent=Array.from({length:position.count},(_,i)=>i);
  const root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));
  const join=(a,b)=>{parent[root(a)]=root(b);};
  const vertices=new Map();
  for(let i=0;i<position.count;i++){
    const key=[position.getX(i),position.getY(i),position.getZ(i)].map(v=>Math.round(v*1e4)).join(':');
    if(vertices.has(key))join(i,vertices.get(key));
    else vertices.set(key,i);
  }
  const count=index?.count??position.count,vertex=i=>index?index.getX(i):i;
  for(let i=0;i<count;i+=3){join(vertex(i),vertex(i+1));join(vertex(i),vertex(i+2));}
  const pieces=new Map();
  for(let i=0;i<count;i+=3){
    const first=vertex(i);
    const id=root(first);
    const list=pieces.get(id)||[];
    list.push(first,vertex(i+1),vertex(i+2));pieces.set(id,list);
  }
  return [...pieces.values()].map(indices=>{
    const piece=mesh.clone();
    piece.geometry=geometry.clone().setIndex(indices);
    return {mesh:piece,indices};
  });
}

export function bindPlayViews(T,scene,worker,mat,focus){
  const ui=id=>document.getElementById(id);
  const roots={};
  let sliders=[];
  const balls={football:.11,softBall:.062};
  for(const [id,radius] of Object.entries(balls)){
    const root=new T.Group();
    root.add(new T.Mesh(new T.SphereGeometry(radius,18,12),mat(id==='football'?'#eee7db':'#d39962')));
    root.userData={dynamic:true,ball:radius};
    scene.add(root);roots[id]=root;
  }
  const select=ui('play-select');
  const command=(action,value)=>worker.postMessage({type:'play-control',id:select.value,action,value});
  function updateControls(){
    const id=select.value;
    ui('ball-controls').hidden=!(id in balls);
    ui('bike-controls').hidden=!id.startsWith('bike');
    ui('toy-controls').hidden=id!=='toy';
  }
  select.onchange=()=>{updateControls();focus(select.value);};
  ui('ball-push').onclick=()=>command('push');
  ui('bike-pedal').onclick=()=>command('pedal');
  ui('bike-steer').oninput=event=>command('steer',Number(event.target.value));
  ui('bead-position').oninput=event=>command('slide',{bead:Number(ui('bead-select').value),position:Number(event.target.value)});
  ui('bead-select').onchange=()=>{ui('bead-position').value=sliders[Number(ui('bead-select').value)]?.last??.5;};
  ui('play-open').onclick=()=>{if(!ui('play-dialog').open)ui('play-dialog').show();focus(select.value);};
  updateControls();

  function football(model){
    const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3());
    const diameter=Math.max(...box.getSize(new T.Vector3()).toArray());
    model.position.sub(center);
    for(const [id,radius] of Object.entries(balls)){
      const root=roots[id];
      root.clear();
      const size=new T.Group();
      size.scale.setScalar(radius*2/diameter);
      size.add(model.clone(true));
      root.add(size);
    }
  }
  function tricycles(model){
    const meshes=assetMeshes(T,model);
    const frontNames=['Cylinder001_Tricycle_0','Circle_Tricycle_0'];
    for(const id of ['bikePark','bikeHome']){
      const root=new T.Group();
      const model=new T.Group();model.scale.setScalar(.183);root.add(model);
      const forkPivot=new T.Vector3(0,2.65,-.14),axle=new T.Vector3(0,.791,.266);
      const fork=new T.Group();fork.position.copy(forkPivot);model.add(fork);
      const wheel=new T.Group();wheel.position.copy(axle).sub(forkPivot);fork.add(wheel);
      const crank=new T.Group();crank.position.copy(wheel.position);fork.add(crank);
      const back=new T.Group();back.position.set(0,.543,-3.109);model.add(back);
      for(const [name,source] of meshes){
        const mesh=source.clone();
        const label=name.replace(/[.]/g,'');
        if(label===frontNames[0]){
          mesh.position.copy(axle).negate();wheel.add(mesh);
        }else if(label==='Cylinder002_Tricycle_0'){
          mesh.position.copy(back.position).negate();back.add(mesh);
        }else if(['BezierCurve_Tricycle_0','Cube001_Tricycle_0'].includes(label)){
          mesh.position.copy(axle).negate();crank.add(mesh);
        }else if([frontNames[1],'BezierCurve002_Tricycle_0','Cylinder003_Tricycle_0',
          'Cube003_Tricycle_0','Cylinder005_Tricycle_0','Plane002_Tricycle_0','Cube004_Tricycle_0'].includes(label)){
          mesh.position.copy(forkPivot).negate();fork.add(mesh);
        }else model.add(mesh);
      }
      root.userData={dynamic:true,playSymbol:'bike',fork,wheel,crank,back};
      scene.add(root);roots[id]=root;
    }
  }
  function toy(model){
    const meshes=assetMeshes(T,model);
    const tracks=[...toyRailPoints,...[-3,3].map(z=>[[-3.3,0,z],[-1,0,z],[1.2,0,z],[3.2,0,z]])];
    const curves=tracks.map(rail=>new T.CatmullRomCurve3(rail.map(point=>new T.Vector3(...point))));
    const root=new T.Group(), parts=new T.Group();
    parts.scale.setScalar(.067);parts.position.y=.028;root.add(parts);
    root.userData={dynamic:true,playSymbol:'toy'};
    for(const [name,mesh] of meshes){
      if(!/^Sphere(?:\d+)?_(?!Black)|Insect/.test(name.replaceAll('.',''))){parts.add(mesh);continue;}
      for(const piece of separateMesh(mesh)){
        const position=piece.mesh.geometry.attributes.position;
        const box=new T.Box3().makeEmpty(), temp=new T.Vector3();
        for(const index of piece.indices)box.expandByPoint(temp.fromBufferAttribute(position,index));
        const center=box.getCenter(new T.Vector3());
        let best={distance:Infinity};
        for(const curve of curves){
          for(let i=0;i<=130;i++){
            const t=i/130,point=curve.getPointAt(t);
            const distance=center.distanceToSquared(point);
            if(distance<best.distance)best={distance,t,curve,point};
          }
        }
        if(best.distance>2){parts.add(piece.mesh);continue;}
        const tangent=best.curve.getTangentAt(best.t);
        sliders.push({mesh:piece.mesh,curve:best.curve,tangent,base:best.point,initial:best.t,last:best.t});
        const option=new Option((name.includes('Insect')?'Animal ':'Perle ')+sliders.length,String(sliders.length-1));
        ui('bead-select').append(option);parts.add(piece.mesh);
      }
    }
    scene.add(root);roots.toy=root;
    ui('bead-select').onchange();
  }
  function update(items){
    if(!items)return;
    for(const [id,root] of Object.entries(roots)){
      const item=items[id];
      if(!item)continue;
      root.position.set(item.x,item.y||0,item.z);
      if(id in balls)root.rotation.set(item.rollX||0,0,item.rollZ||0);
      if(id.startsWith('bike')){
        root.rotation.y=item.heading;
        const {fork,wheel,crank,back}=root.userData;
        fork.rotation.y=item.steer;
        wheel.rotation.x=item.pedal;
        crank.rotation.x=item.pedal;
        back.rotation.x=item.rear;
      }
    }
    sliders.forEach((slider,i)=>{
      const t=items.toy.beads[i]??slider.initial;
      if(t===slider.last)return;
      slider.last=t;
      const point=slider.curve.getPointAt(t);
      slider.mesh.quaternion.setFromUnitVectors(slider.tangent,slider.curve.getTangentAt(t));
      slider.mesh.position.copy(point).sub(slider.base.clone().applyQuaternion(slider.mesh.quaternion));
    });
    if(document.activeElement!==ui('bead-position'))ui('bead-position').value=sliders[Number(ui('bead-select').value)]?.last??.5;
  }
  return {football,tricycles,toy,update};
}
