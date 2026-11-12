// A baked clearance grid keeps collision checks cheap even at accelerated simulation speed.
const navigation=(()=>{
  const {originX,originZ,width,height,cell,layers}=COLLISION_MAP;
  const grids=layers.map(encoded=>Uint8Array.from(atob(encoded),character=>character.charCodeAt(0)));
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
    const marks=new Uint16Array(size), queue=new Int32Array(size);
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
