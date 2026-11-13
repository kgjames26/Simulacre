// A baked clearance grid keeps collision checks cheap even at accelerated simulation speed.
// La grille cuite couvre la propriété de Néo ; on l'agrandit au quartier : seules les routes, trottoirs, le portail
// et l'intérieur du commerce sont praticables, les autres propriétés sont fermées.
const navigation=(()=>{
  const base=COLLISION_MAP;
  let {originX,originZ,width,height}=base;const {cell,layers}=base;
  let grids=layers.map(encoded=>Uint8Array.from(atob(encoded),character=>character.charCodeAt(0)));
  if(typeof QUARTIER!=='undefined'){
    const R=QUARTIER.region;
    const ox=Math.round((originX-R.x0)/cell),oz=Math.round((originZ-R.z0)/cell);
    const nx=originX-ox*cell,nz=originZ-oz*cell;
    const w=Math.ceil((R.x1-nx)/cell),h=Math.ceil((R.z1-nz)/cell);
    const bytes=Math.ceil(w*h/8);
    const grandes=[new Uint8Array(bytes).fill(255),new Uint8Array(bytes).fill(255)];
    grids.forEach((grid,floor)=>{
      for(let j=0;j<height;j++)for(let i=0;i<width;i++){
        const id=i+j*width,blocked=grid[id>>3]&(1<<(id&7));
        if(!blocked){const k=(i+ox)+(j+oz)*w;grandes[floor][k>>3]&=~(1<<(k&7));}
      }
    });
    const set=(x,z,libre)=>{
      const i=Math.floor((x-nx)/cell),j=Math.floor((z-nz)/cell);
      if(i<0||j<0||i>=w||j>=h)return;
      const k=i+j*w;if(libre)grandes[0][k>>3]&=~(1<<(k&7));else grandes[0][k>>3]|=(1<<(k&7));
    };
    const remplir=(r,libre)=>{for(let z=r.z0;z<=r.z1;z+=cell*.9)for(let x=r.x0;x<=r.x1;x+=cell*.9)set(x,z,libre);};
    // clôture de la propriété : bande bloquée, sauf le portail
    const ring=3;
    for(let j=0;j<height;j++)for(let i=0;i<width;i++){
      if(i>=ring&&i<width-ring&&j>=ring&&j<height-ring)continue;
      const k=(i+ox)+(j+oz)*w;grandes[0][k>>3]|=(1<<(k&7));
    }
    for(const r of QUARTIER.libres)remplir(r,true);
    for(const r of QUARTIER.bloques)remplir(r,false);
    // les copies de l'aire de jeux reprennent les obstacles (équipements) de l'aire d'origine
    const F=QUARTIER.fenetre;
    for(const p of QUARTIER.parcs||[]){
      if(p.origine)continue;
      for(let j=0;j<height;j++)for(let i=0;i<width;i++){
        const x=base.originX+(i+.5)*cell,z=base.originZ+(j+.5)*cell;
        if(x<F.x0||x>F.x1||z<F.z0||z>F.z1)continue;
        const id=i+j*width;
        if(grids[0][id>>3]&(1<<(id&7)))set(x+p.dx,z+p.dz,false);
      }
    }
    originX=nx;originZ=nz;width=w;height=h;grids=grandes.slice(0,2);
    // la bande de clôture reste fermée hors portail (les trottoirs ne la recouvrent pas)
    const ouvert=x=>x>=QUARTIER.portail.x0&&x<=QUARTIER.portail.x1||x>=QUARTIER.entreeParc.x0&&x<=QUARTIER.entreeParc.x1;
    for(let z=11.6;z<=12.4;z+=cell*.9)for(let x=-19.2;x<=19.2;x+=cell*.9)if(!ouvert(x))set(x,z,false);
    const B=QUARTIER.barriere;
    for(let z=B.z0;z<=B.z1;z+=cell*.9)for(let x=B.x0;x<=B.x1;x+=cell*.9)if(z<B.porte.z0||z>B.porte.z1)set(x,z,false);
  }
  const size=width*height;
  const cells=(x,z)=>{
    const i=Math.floor((x-originX)/cell), j=Math.floor((z-originZ)/cell);
    return i>=0&&j>=0&&i<width&&j<height?i+j*width:-1;
  };
  const point=id=>({x:originX+(id%width+.5)*cell,z:originZ+(Math.floor(id/width)+.5)*cell});
  const free=(id,floor)=>id>=0&&id<size&&!(grids[floor][id>>3]&(1<<(id&7)));
  const isFree=(x,z,floor=0)=>free(cells(x,z),floor);
  const directions=[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
  function neighbors(id,floor,visit){
    const x=id%width,z=Math.floor(id/width);
    for(const [dx,dz] of directions){
      if(x+dx<0||x+dx>=width||z+dz<0||z+dz>=height)continue;
      const next=id+dx+dz*width;
      if(!free(next,floor)||dx&&dz&&(!free(id+dx,floor)||!free(id+dz*width,floor)))continue;
      visit(next,dx&&dz?1.414214:1);
    }
  }
  const components=grids.map((_,floor)=>{
    const marks=new Int32Array(size), queue=new Int32Array(size);
    let component=0;
    for(let id=0;id<size;id++){
      if(marks[id]||!free(id,floor))continue;
      marks[id]=++component;queue[0]=id;
      let end=1;
      for(let i=0;i<end;i++)neighbors(queue[i],floor,next=>{
        if(!marks[next]){marks[next]=component;queue[end++]=next;}
      });
    }
    return marks;
  });
  function nearest(x,z,floor,component,max=.85){
    const center=cells(x,z);
    if(center<0)return -1;
    if(free(center,floor)&&(!component||components[floor][center]===component))return center;
    const cx=center%width,cz=Math.floor(center/width),radius=Math.ceil(max/cell);
    let best=-1,distance=max*max;
    for(let j=Math.max(0,cz-radius);j<=Math.min(height-1,cz+radius);j++){
      for(let i=Math.max(0,cx-radius);i<=Math.min(width-1,cx+radius);i++){
        const id=i+j*width;
        if(!free(id,floor)||component&&components[floor][id]!==component)continue;
        const candidate=point(id),d=(candidate.x-x)**2+(candidate.z-z)**2;
        if(d<distance){best=id;distance=d;}
      }
    }
    return best;
  }
  function clear(x,z,tx,tz,floor){
    const n=Math.ceil(Math.hypot(tx-x,tz-z)/(cell*.35));
    let previous=cells(x,z);
    for(let i=1;i<=n;i++){
      const id=cells(x+(tx-x)*i/n,z+(tz-z)*i/n);
      if(!free(id,floor))return false;
      if(id%width!==previous%width&&Math.floor(id/width)!==Math.floor(previous/width)&&
         (!free(Math.floor(id/width)*width+previous%width,floor)||!free(Math.floor(previous/width)*width+id%width,floor)))return false;
      previous=id;
    }
    return true;
  }
  const cost=new Float64Array(size), parents=new Int32Array(size), seen=new Uint32Array(size);
  let search=0;
  function route(start,goal,floor){
    if(start===goal)return [];
    const endX=goal%width,endZ=Math.floor(goal/width);
    const estimate=id=>Math.hypot(id%width-endX,Math.floor(id/width)-endZ);
    const heap=[[start,0,estimate(start)]];
    seen[start]=++search;cost[start]=0;
    while(heap.length){
      const [id,d]=heap[0],last=heap.pop();
      if(heap.length){
        let index=0;
        while(index*2+1<heap.length){
          let child=index*2+1;
          if(heap[child+1]?.[2]<heap[child][2])child++;
          if(heap[child][2]>=last[2])break;
          heap[index]=heap[child];index=child;
        }
        heap[index]=last;
      }
      if(d!==cost[id])continue;
      if(id===goal){
        const path=[];
        for(let current=id;current!==start;current=parents[current])path.push(point(current));
        return path.reverse();
      }
      neighbors(id,floor,(next,step)=>{
        const travel=d+step;
        if(seen[next]===search&&travel>=cost[next])return;
        seen[next]=search;cost[next]=travel;parents[next]=id;
        const value=[next,travel,travel+estimate(next)];
        let index=heap.length;
        while(index>0){
          const parent=(index-1)>>1;
          if(heap[parent][2]<=value[2])break;
          heap[index]=heap[parent];index=parent;
        }
        heap[index]=value;
      });
    }
    return [];
  }
  const plans=new WeakMap();
  function next(person,x,z,floor,now){
    const start=cells(person.x,person.z);
    const component=components[floor][start];
    if(!component)return null;
    const target=cells(x,z);
    let plan=plans.get(person);
    if(!plan||plan.floor!==floor||plan.component!==component||plan.target!==target&&now>=plan.retry){
      const goal=nearest(x,z,floor,component);
      const destination=goal<0?null:point(goal);
      const path=destination&&clear(person.x,person.z,destination.x,destination.z,floor)?[destination]:
        goal<0?[]:route(start,goal,floor);
      plan={floor,component,target,goal,path,index:0,retry:now+.45};
      plans.set(person,plan);
    }
    while(plan.index<plan.path.length&&Math.hypot(person.x-plan.path[plan.index].x,person.z-plan.path[plan.index].z)<.044)plan.index++;
    if(plan.index<plan.path.length)return plan.path[plan.index];
    if(plan.goal===target&&clear(person.x,person.z,x,z,floor))return {x,z};
    return null;
  }
  return {isFree,clear,next,nearest,point};
})();
