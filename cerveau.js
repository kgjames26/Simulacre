// Cerveau de Néo. Une seule règle : on ne lui apprend rien. Il remplit lui-même chaque région
// à partir de ce qu'il perçoit, de ce qu'il essaie et de ce que son corps ressent.
//
// Inné : 4 gestes de mains, les besoins de tout humain, une très forte envie d'explorer et de s'améliorer.
// Tout le reste s'apprend. Aucun nom d'objet ici : seulement des identifiants opaques et des sensations.
//
// Régions (chacune garde sa propre mémoire) :
//   sens        ce qui arrive des yeux et des oreilles, instant par instant
//   corps       ses gestes, ses capacités physiques et ce qu'il sait de son propre corps
//   espace      les endroits connus et les limites rencontrées (là où on l'a retenu)
//   objets      les choses repérées, leurs ressemblances (familles), les signes écrits
//   memoire     ses essais et ses souvenirs complets
//   causes      « si je fais ceci à cela, il se passe ça »
//   social      les personnes, ce qu'elles lui apportent
//   emotions    humeur, peur, frustration, ennui, confiance en soi
//   envies      ses questions, ses objectifs, ses habitudes
//   associations le carrefour : relie toutes les régions, réveille les souvenirs, forme des idées
const Brain=(()=>{
  const VERSION=3;
  const PRIMITIVES=['pousser','tirer','saisir','frapper'];
  const APPRENABLES=['monter','tourner','grimper','sauter'];
  const CAPACITES=['equilibre','course','force','endurance'];
  const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  let sources={};
  let S;

  function fresh(seed){
    return {version:VERSION,seed:seed>>>0,rng:seed>>>0,consolidations:0,next:{e:1,c:1,q:1,g:1,s:1,m:1,i:1},journal:[],
      sens:{flux:[]},
      corps:{gestes:{},capacites:{equilibre:0,course:0,force:0,endurance:0},defis:{},motricite:null},
      espace:{cases:{},interdits:{}},
      objets:{registre:{},concepts:[],glyphes:{}},
      memoire:{essais:[],episodes:[],total:0},
      causes:{liste:[]},
      social:{personnes:{}},
      emotions:{valence:0,peur:0,frustration:0,ennui:0,confiance:.4,historique:[]},
      envies:{questions:[],objectifs:[],habitudes:[]},
      associations:{noeuds:{},liens:{},idees:[],travail:{items:[],t:0},surprise:0,deductions:0,v:0,sceneAt:-1e9},
      partage:{publie:[],amis:false,famille:false}};
  }
  S=fresh(1);

  function rand(){
    S.rng=(S.rng+0x6D2B79F5)>>>0;
    let t=S.rng;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return((t^(t>>>14))>>>0)/4294967296;
  }
  const init=seed=>{S=fresh(seed||1);};
  const save=()=>S;
  function restore(data){
    if(!data||data.version!==VERSION)return false;
    const base=fresh(data.seed);
    S=Object.assign(base,data);
    for(const k of Object.keys(base))if(base[k]&&typeof base[k]==='object'&&!Array.isArray(base[k]))S[k]=Object.assign(fresh(0)[k],data[k]);
    return true;
  }
  const bind=map=>{sources=Object.assign(sources,map);};
  function note(t,texte,ref){S.journal.push({t:Math.round(t),texte,ref});if(S.journal.length>120)S.journal.shift();}

  // ---------- sens ----------
  function sentir(t,vus){S.sens.flux.push({t:Math.round(t),n:vus});if(S.sens.flux.length>60)S.sens.flux.shift();}

  // ---------- objets ----------
  function vu(id,traits,pos,t,vivant){
    const R=S.objets.registre;
    let o=R[id];
    const nouveau=!o;
    if(!o)o=R[id]={id,traits,vu:0,essais:0,reussites:0,premier:Math.round(t),dernier:-1e9,inerte:false,vivant:!!vivant};
    if(t-o.dernier>4){o.vu++;if(traits[5]>0)S.objets.glyphes[id]=(S.objets.glyphes[id]||0)+1;}
    o.traits=traits;o.pos=pos;o.dernier=t;
    return {objet:o,nouveau};
  }
  const connu=id=>S.objets.registre[id];
  const registre=()=>Object.values(S.objets.registre);
  const distance=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+((v-(b[i]||0))*(i===0?.5:i===4?2:1))**2,0));
  function regrouper(t){
    const items=registre().filter(o=>o.vu>=2);
    const groupes=[];
    for(const o of items){
      const g=groupes.find(group=>group.some(m=>distance(m.traits,o.traits)<.4));
      if(g)g.push(o);else groupes.push([o]);
    }
    const anciens=new Map(S.objets.concepts.map(k=>[k.id,k]));
    S.objets.concepts=groupes.filter(g=>g.length>=2).map(g=>{
      const membres=g.map(o=>o.id).sort(),id='k-'+membres[0];
      const usages=[...new Set(confirmees().filter(c=>membres.includes(c.cible)).map(c=>c.action))];
      return {id,membres,usages,cree:anciens.get(id)?.cree??Math.round(t)};
    });
  }
  const familleDe=id=>S.objets.concepts.find(k=>k.membres.includes(id));

  // ---------- espace ----------
  const cle3=(x,z,f)=>Math.floor(x)+','+Math.floor(z)+','+(f||0);
  function lieu(x,z,floor){
    const k=cle3(x,z,floor),cases=S.espace.cases;
    if(!cases[k]&&Object.keys(cases).length>4000)return;
    cases[k]=(cases[k]||0)+1;
  }
  // Une limite : il voulait aller là, quelque chose (un adulte) l'a retenu. Il ne sait pas pourquoi.
  function retenu(x,z,floor,t){
    const k=cle3(x,z,floor),i=S.espace.interdits[k]||={n:0,t:0};
    if(t-i.t<1)return false;
    const premiere=i.n===0;
    i.n++;i.t=Math.round(t);
    S.emotions.frustration=Math.min(1,S.emotions.frustration+.04);
    return premiere;
  }
  const interdit=(x,z,floor)=>(S.espace.interdits[cle3(x,z,floor)]?.n||0);

  // ---------- social ----------
  function personne(id,pos,t){
    const p=S.social.personnes[id]||(S.social.personnes[id]={id,vu:0,lien:0,soulage:{},dernier:-1e9});
    if(t-p.dernier>4)p.vu++;
    p.dernier=t;p.pos=pos;
    return p;
  }
  function lien(id,delta){const p=S.social.personnes[id];if(p)p.lien=clamp(p.lien+delta,0,100);}
  function soulagement(besoin,id){const p=S.social.personnes[id];if(p)p.soulage[besoin]=(p.soulage[besoin]||0)+1;}

  // ---------- corps ----------
  const appris=g=>!!S.corps.gestes[g]?.appris;
  const repertoire=()=>PRIMITIVES.concat(APPRENABLES.filter(appris));
  // S'entraîner fait progresser une capacité, de moins en moins vite (rendement décroissant).
  function entrainer(nom,gain){
    const c=S.corps.capacites;
    const avant=c[nom]||0;
    c[nom]=clamp(avant+gain*(1-avant),0,1);
    return Math.floor(avant*10)<Math.floor(c[nom]*10);
  }
  const capacite=nom=>S.corps.capacites[nom]||0;
  // Un défi physique (grimper, se hisser…) : il apprend ce que son corps peut ou ne peut pas encore.
  function defi(cible,reussi){
    const d=S.corps.defis[cible]||={essais:0,reussites:0};
    d.essais++;if(reussi)d.reussites++;
    S.emotions.confiance=clamp(S.emotions.confiance+(reussi?.04:-.01),0,1);
  }

  // ---------- causes ----------
  const liste=()=>S.causes.liste;
  const cause=(action,cible)=>liste().find(c=>c.action===action&&c.cible===cible);
  const confirmees=()=>liste().filter(c=>c.statut==='confirme');
  function valeur(e){
    let r=(e.plaisir||0)*.8-(e.douleur||0)*1.5+(e.succes?.1:0);
    for(const v of Object.values(e.besoins||{}))r+=v;
    return r;
  }
  function essai(e){
    const rec={id:'e-'+(S.next.e++),...e};
    const M=S.memoire;
    M.essais.push(rec);if(M.essais.length>200)M.essais.shift();
    M.total++;
    const o=connu(e.cible);
    if(o){o.essais++;if(e.succes)o.reussites++;if(o.essais>=12&&!o.reussites)o.inerte=true;}
    let geste=null;
    if(APPRENABLES.includes(e.prim)&&!appris(e.prim)){
      const g=S.corps.gestes[e.prim]||=({essais:0,appris:false});
      g.essais++;
      if(g.essais>=3){g.appris=true;geste=e.prim;note(e.t,'nouveau geste : '+e.prim,e.prim);}
    }
    let c=cause(e.prim,e.cible);
    if(!c){
      c={id:'c-'+(S.next.c++),action:e.prim,cible:e.cible,effet:[],essais:0,reussites:0,echecs:0,confiance:0,
        statut:'essai',valeur:0,besoins:{},cree:Math.round(e.t)};
      liste().push(c);
    }
    c.essais++;
    const r=valeur(e);
    c.valeur+=(r-c.valeur)/c.essais;
    if(e.succes){
      c.reussites++;c.echecs=0;
      for(const f of e.effet)if(!c.effet.includes(f))c.effet.push(f);
      for(const [b,v] of Object.entries(e.besoins||{}))c.besoins[b]=(c.besoins[b]||0)+(v-(c.besoins[b]||0))/c.reussites;
    }else c.echecs++;
    c.confiance=+((c.reussites+.5)/(c.essais+1)).toFixed(3);
    let nouveau=false;
    if(c.statut==='confirme'){
      if(c.echecs>=4){c.statut='contredite';question('contredite',c.id,e.t);}
    }else if(c.reussites>=2&&c.reussites/c.essais>=.5){
      c.statut='confirme';c.echecs=0;nouveau=true;note(e.t,'compris',c.id);
    }else if(c.reussites>=1)c.statut='hypothese';
    const h=S.emotions;
    h.valence+=(clamp(r,-1,1)-h.valence)*.08;
    h.frustration=e.succes?h.frustration*.7:Math.min(1,h.frustration+.05);
    if(e.douleur)h.peur=Math.min(1,h.peur+e.douleur);
    h.confiance=clamp(h.confiance+(nouveau?.03:e.succes?.004:-.002),0,1);
    return {cause:c,nouveau,geste};
  }

  // Quel geste tenter ? Ce qui promet, ce qu'il connaît peu, et souvent un geste qu'il ne sait pas encore faire.
  function transfert(cible,prim){
    const k=familleDe(cible);
    if(!k||cause(prim,cible)?.essais)return 0;
    return k.membres.some(m=>m!==cible&&cause(prim,m)?.statut==='confirme')?.45:0;
  }
  const exploration=()=>clamp(1+S.emotions.ennui*.5-S.emotions.peur*.4,.4,1.6);
  function choisir(cible){
    const inconnus=APPRENABLES.filter(g=>!appris(g));
    if(inconnus.length&&rand()<.26*exploration())return inconnus[Math.floor(rand()*inconnus.length)];
    let total=0;
    for(const c of liste())if(c.cible===cible)total+=c.essais;
    let best=PRIMITIVES[0],bestScore=-1e9;
    for(const p of repertoire()){
      const c=cause(p,cible),n=c?c.essais:0;
      const moyenne=c?(c.reussites+.35)/(c.essais+1):.35;
      const curiosite=(.9-S.emotions.peur*.3+S.emotions.ennui*.3)*Math.sqrt(Math.log(total+2)/(n+1));
      const score=moyenne+curiosite+(c?c.valeur*.5:0)+transfert(cible,p)+rand()*1e-3;
      if(score>bestScore){bestScore=score;best=p;}
    }
    return best;
  }
  // Où trouver du soulagement pour un besoin : appris, jamais écrit.
  function besoinCible(besoin){
    let best=null,score=0;
    for(const c of confirmees()){
      const gain=c.besoins[besoin]||0;
      if(gain>.08&&gain*c.confiance>score){score=gain*c.confiance;best={id:c.cible,type:'objet'};}
    }
    for(const p of Object.values(S.social.personnes)){
      const n=p.soulage[besoin]||0,v=.25*Math.min(1,n/4);
      if(n>=1&&v>score){score=v;best={id:p.id,type:'personne'};}
    }
    return best;
  }

  // ---------- envies ----------
  function question(type,ref,t){
    const Q=S.envies.questions;
    if(Q.some(q=>q.type===type&&q.ref===ref&&q.statut==='ouverte'))return;
    Q.push({id:'q-'+(S.next.q++),type,ref,statut:'ouverte',cree:Math.round(t)});
    if(Q.length>60)S.envies.questions=Q.filter(q=>q.statut==='ouverte').slice(-40);
  }
  const actifs=()=>S.envies.objectifs.filter(g=>g.statut==='actif');
  function atteint(id,t){
    for(const g of S.envies.objectifs)if(g.statut==='actif'&&g.cible===id){
      g.statut='atteint';g.fin=Math.round(t);
      const q=S.envies.questions.find(q=>q.id===g.source);if(q)q.statut='resolue';
      S.emotions.confiance=clamp(S.emotions.confiance+.02,0,1);
    }
  }
  const nbAtteints=()=>S.envies.objectifs.filter(g=>g.statut==='atteint').length;
  const habitudes=()=>S.envies.habitudes;

  // ---------- consolidation (le « sommeil » du cerveau : on range, on croise, on oublie un peu) ----------
  function consolider(t){
    S.consolidations++;
    regrouper(t);
    for(const w of sources.lexique?.()||[]){
      const m=/^thing:(.+)$/.exec(w.cue||'');
      if(m&&connu(m[1]))connu(m[1]).mot=w.word;
    }
    for(const o of registre()){
      if(!o.vivant&&o.vu>=3&&o.essais===0)question('jamais_essaye',o.id,t);
      const q=S.envies.questions.find(q=>q.type==='jamais_essaye'&&q.ref===o.id&&q.statut==='ouverte');
      if(q&&o.essais>0)q.statut='resolue';
    }
    const ouvertes=S.envies.questions.filter(q=>q.statut==='ouverte'&&q.type==='jamais_essaye'&&
      !actifs().some(g=>g.source===q.id)&&connu(q.ref)&&!connu(q.ref).inerte).sort((a,b)=>connu(b.ref).vu-connu(a.ref).vu);
    for(const q of ouvertes){
      if(actifs().length>=3)break;
      S.envies.objectifs.push({id:'g-'+(S.next.g++),cible:q.ref,source:q.id,statut:'actif',cree:Math.round(t)});
    }
    if(S.envies.objectifs.length>50)S.envies.objectifs=actifs().concat(S.envies.objectifs.filter(g=>g.statut!=='actif').slice(-25));
    for(const c of confirmees())if(c.reussites>=5&&!habitudes().some(h=>h.cause===c.id))
      habitudes().push({id:'s-'+(S.next.s++),cause:c.id,cible:c.cible,action:c.action,cree:Math.round(t)});
    // les limites s'estompent : il finira par retenter (et découvrira qu'on l'y autorise peut-être)
    for(const [k,i] of Object.entries(S.espace.interdits)){i.n*=.85;if(i.n<.3)delete S.espace.interdits[k];}
    const h=S.emotions,compris=confirmees().length;
    h.ennui=clamp(h.ennui*.85+(S.memoire.total>20&&compris===(S.dernierCompris??compris)?.15:0),0,1);
    S.dernierCompris=compris;
    h.peur*=.9;h.frustration*=.9;
    h.historique.push({t:Math.round(t),v:+h.valence.toFixed(2),c:+h.confiance.toFixed(2)});
    if(h.historique.length>60)h.historique.shift();
  }

  // ---------- partage : seules les choses comprises sortent ----------
  function publier(t){
    const P=S.partage.publie;
    P.push({t:Math.round(t),causes:confirmees().filter(c=>c.essais>=3).map(c=>c.id),mots:(sources.lexique?.()||[]).length});
    if(P.length>4)P.shift();
  }
  function ouvrirPartage(qui){
    if(!S.partage.publie.length||S.partage[qui])return false;
    S.partage[qui]=true;return true;
  }

  // ---------- vue pour l'observateur (les noms viennent de label(), jamais du cerveau) ----------
  function view(label=id=>id){
    const nom=id=>label(id)||id;
    const savoir=liste().filter(c=>c.statut!=='essai').sort((a,b)=>(b.statut==='confirme')-(a.statut==='confirme')||b.confiance-a.confiance)
      .slice(0,30).map(c=>({id:c.id,statut:c.statut,action:c.action,cible:nom(c.cible),effet:c.effet,essais:c.essais,reussites:c.reussites}));
    return {
      gestes:{innes:PRIMITIVES,appris:APPRENABLES.filter(appris),enCours:APPRENABLES.filter(g=>!appris(g)&&(S.corps.gestes[g]?.essais||0)>0)},
      capacites:{...S.corps.capacites},
      defis:Object.entries(S.corps.defis).map(([id,d])=>({cible:nom(id),...d})),
      savoir,
      derniers:S.memoire.essais.slice(-6).reverse().map(e=>({action:e.prim,cible:nom(e.cible),succes:!!e.succes,effet:e.effet})),
      concepts:S.objets.concepts.map(k=>({membres:k.membres.map(nom),usages:k.usages})),
      questions:S.envies.questions.filter(q=>q.statut==='ouverte').slice(-8).map(q=>({type:q.type,ref:nom(q.ref)})),
      objectifs:S.envies.objectifs.slice(-8).reverse().map(g=>({statut:g.statut,cible:nom(g.cible)})),
      habitudes:habitudes().length,
      emotions:{valence:S.emotions.valence,peur:S.emotions.peur,frustration:S.emotions.frustration,ennui:S.emotions.ennui,confiance:S.emotions.confiance},
      objets:registre().filter(o=>!o.vivant).sort((a,b)=>b.vu-a.vu).slice(0,24).map(o=>({nom:nom(o.id),vu:o.vu,essais:o.essais,mot:o.mot})),
      lieux:Object.keys(S.espace.cases).length,
      limites:Object.keys(S.espace.interdits).length,
      personnes:Object.keys(S.social.personnes).length,
      partage:{amis:S.partage.amis,famille:S.partage.famille},
      compris:confirmees().length,essais:S.memoire.total,souvenirs:S.memoire.episodes.length,
      sens:S.sens.flux.at(-1)?.n||0,nbObjets:registre().filter(o=>!o.vivant).length,familles:S.objets.concepts.length,
      envies:S.envies.questions.filter(q=>q.statut==='ouverte').length+S.envies.objectifs.filter(g=>g.statut==='actif').length
    };
  }

  return {PRIMITIVES,APPRENABLES,CAPACITES,init,save,restore,bind,rand,note,sentir,vu,connu,registre,familleDe,
    lieu,retenu,interdit,personne,lien,soulagement,repertoire,appris,entrainer,capacite,defi,
    essai,cause,confirmees,choisir,besoinCible,question,atteint,nbAtteints,habitudes,consolider,publier,ouvrirPartage,view,
    get state(){return S;}};
})();
const rng=()=>Brain.rand();

// Le carrefour des régions : croise ce qu'il vit maintenant avec tout ce qu'il a vécu pour anticiper, déduire, imaginer.
const Cortex=(()=>{
  const MAX_EPISODES=250,MAX_LIENS=2500,MAX_IDEES=40;
  const A=()=>Brain.state.associations;
  let adj=null,adjV=-1,rappelCache=null,rappelAt=-1e9;
  const cle=(a,b)=>a<b?a+'|'+b:b+'|'+a;
  function lier(noeuds,poids=1,t=0){
    const c=A(),uniques=[...new Set(noeuds)].slice(0,10);
    for(const n of uniques){const k=c.noeuds[n]||={n:0};k.n+=poids;k.t=Math.round(t);}
    for(let i=0;i<uniques.length;i++)for(let j=i+1;j<uniques.length;j++){
      const l=c.liens[cle(uniques[i],uniques[j])]||={n:0};l.n+=poids;l.t=Math.round(t);
    }
    c.v++;
    if(Object.keys(c.liens).length>MAX_LIENS)elaguer();
  }
  function elaguer(){
    const c=A();
    for(const [k,l] of Object.entries(c.liens)){l.n*=.9;if(l.n<.4)delete c.liens[k];}
    for(const [k,n] of Object.entries(c.noeuds)){n.n*=.9;if(n.n<.4)delete c.noeuds[k];}
    c.v++;
  }
  function index(){
    const c=A();
    if(adj&&adjV===c.v)return adj;
    adj=new Map();
    for(const [k,l] of Object.entries(c.liens)){
      if(l.n<1.5)continue;
      const [a,b]=k.split('|'),f=l.n/Math.sqrt(((c.noeuds[a]?.n)||1)*((c.noeuds[b]?.n)||1));
      if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);
      adj.get(a).push([b,f]);adj.get(b).push([a,f]);
    }
    for(const list of adj.values())list.sort((x,y)=>y[1]-x[1]||(x[0]<y[0]?-1:1));
    adjV=c.v;
    return adj;
  }
  // Activation en cascade : ce qui est présent réveille ce qui lui a été associé, puis les associés des associés.
  function activer(graines,profondeur=2){
    const graph=index();
    let act=new Map(Object.entries(graines));
    const total=new Map(act);
    for(let h=0;h<profondeur;h++){
      const next=new Map();
      for(const [n,a] of act)for(const [m,f] of (graph.get(n)||[]).slice(0,12)){
        if(graines[m]!==undefined)continue;
        next.set(m,(next.get(m)||0)+a*f*.5);
      }
      for(const [m,a] of next)total.set(m,(total.get(m)||0)+a);
      act=next;
    }
    return total;
  }
  // Mémoire de travail : ce que chaque région apporte en ce moment (lieu, choses, personnes, besoins).
  function scene(t,ctx){
    const c=A(),items=[];
    if(ctx.lieu)items.push('lieu:'+ctx.lieu);
    for(const id of ctx.obj||[])items.push('obj:'+id);
    for(const id of ctx.pers||[])items.push('pers:'+id);
    for(const [b,v] of Object.entries(ctx.besoins||{}))if(v>.5)items.push('bes:'+b);
    c.travail={items:items.slice(0,16),t:Math.round(t)};
    if(t-c.sceneAt>30&&items.length>1){c.sceneAt=t;lier(items.slice(0,10),.6,t);}
  }
  function rappel(t){
    if(rappelCache&&t-rappelAt<5)return rappelCache;
    const graines={};
    for(const n of A().travail.items)graines[n]=n.startsWith('bes:')?1.2:.6;
    const out=new Map();let max=.0001;
    for(const [n,a] of activer(graines))if(n.startsWith('obj:')){out.set(n.slice(4),a);if(a>max)max=a;}
    for(const [id,a] of out)out.set(id,Math.min(1,a/max));
    rappelCache=out;rappelAt=t;
    return out;
  }
  // Imagination : prévoir l'effet d'un geste sur une chose jamais essayée, d'après des choses semblables.
  const dist=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+((v-(b[i]||0))*(i===0?.5:i===4?2:1))**2,0));
  function prevoir(prim,cible){
    const c0=Brain.cause(prim,cible);
    if(c0&&c0.essais>=2)return {p:c0.confiance,effets:c0.effet,analogue:false,sources:[]};
    const o0=Brain.connu(cible);
    if(!o0)return {p:.3,effets:[],analogue:false,sources:[]};
    let pesees=0,somme=0;const effets=[],sources=[];
    for(const c of Brain.confirmees()){
      if(c.action!==prim||c.cible===cible)continue;
      const o=Brain.connu(c.cible);if(!o)continue;
      const d=dist(o.traits,o0.traits);if(d>=.7)continue;
      const w=1-d/.7*.8;pesees+=w;somme+=w*c.confiance;
      for(const f of c.effet)if(!effets.includes(f))effets.push(f);
      sources.push(c.cible);
    }
    if(!pesees)return {p:.3,effets:[],analogue:false,sources:[]};
    return {p:somme/pesees,effets,analogue:true,sources:sources.slice(0,3)};
  }
  function apprendre(e,prevu,ctx={}){
    const c=A();
    const utiles=Object.entries(e.besoins||{}).filter(([,v])=>v>.05).map(([b])=>b);
    const noeuds=['ges:'+e.prim,'obj:'+e.cible,...(e.effet||[]).map(f=>'eff:'+f),...utiles.map(b=>'bes:'+b)];
    if(ctx.lieu)noeuds.push('lieu:'+ctx.lieu);
    for(const n of c.travail.items)if(n.startsWith('pers:'))noeuds.push(n);
    lier(noeuds,e.succes?1:.4,e.t);
    for(const b of utiles)lier(['bes:'+b,'obj:'+e.cible],2,e.t);
    const M=Brain.state.memoire;
    M.episodes.push({id:'m-'+(Brain.state.next.m++),t:Math.round(e.t),lieu:ctx.lieu||null,cible:e.cible,geste:e.prim,succes:!!e.succes,
      effet:(e.effet||[]).slice(0,4),soulage:utiles});
    if(M.episodes.length>MAX_EPISODES)M.episodes.shift();
    const ecart=Math.abs((e.succes?1:0)-(prevu?prevu.p:.3));
    c.surprise=+(c.surprise*.9+ecart*.1).toFixed(3);
    if(prevu?.analogue&&ecart>.6)Brain.question('surprise',e.cible,e.t);
    return verifier(e);
  }
  function verifier(e){
    let verdict=null;
    for(const idee of A().idees){
      if(idee.cible!==e.cible||idee.statut!=='idee')continue;
      let ok=null;
      if(idee.type==='analogie'&&idee.prim===e.prim)ok=!!e.succes;
      else if(idee.type==='besoin'&&Object.keys(e.besoins||{}).length)ok=(e.besoins[idee.besoin]||0)>.05;
      else if(idee.type==='besoin'&&idee.essais>=2)ok=false;
      if(ok===null)continue;
      idee.essais++;
      if(ok){idee.statut='confirmee';idee.fin=Math.round(e.t);verdict=idee;
        Brain.state.emotions.confiance=Math.min(1,Brain.state.emotions.confiance+.03);}
      else if(idee.essais>=2){idee.statut='refutee';idee.fin=Math.round(e.t);}
    }
    return verdict;
  }
  const attendue=cible=>A().idees.some(i=>i.cible===cible&&i.statut==='idee'&&i.type!=='mot');
  function idee(cible){
    let meilleure=null;
    for(const i of A().idees){
      if(i.cible!==cible||i.statut!=='idee'||!i.prim||!Brain.repertoire().includes(i.prim))continue;
      if(!meilleure||i.confiance>meilleure.confiance)meilleure=i;
    }
    return meilleure&&Brain.rand()<.75?meilleure.prim:null;
  }
  const existe=(type,cible,extra)=>A().idees.some(i=>i.type===type&&i.cible===cible&&(i.prim||i.besoin||i.mot||'')===(extra||'')&&i.statut!=='refutee');
  function creer(idee,t){
    const c=A();
    if(c.idees.filter(i=>i.statut==='idee').length>=MAX_IDEES)return;
    c.idees.push({id:'i-'+(Brain.state.next.i++),statut:'idee',essais:0,cree:Math.round(t),...idee});
    c.deductions++;
    if(c.idees.length>MAX_IDEES*3)c.idees=c.idees.filter(i=>i.statut!=='refutee').slice(-MAX_IDEES*2);
  }
  // Croiser les régions pour produire des idées, à vérifier ensuite par l'essai.
  function deduire(t,ctx={}){
    // langage × objets : un mot souvent entendu devant une chose finit par la désigner
    for(const m of ctx.lexique||[]){
      if(!(m.cue||'').startsWith('thing:'))continue;
      const id=m.cue.slice(6),o=Brain.connu(id);if(!o)continue;
      lier(['mot:'+m.word,'obj:'+id],Math.min(3,m.heard||1),t);
      if(!o.mot){o.mot=m.word;creer({type:'mot',cible:id,mot:m.word,confiance:Math.min(1,(m.heard||1)/6),statut:'confirmee',regions:['langage','objets','memoire']},t);}
    }
    // causes × objets × mémoire : par analogie, ce qui marcherait sur une chose jamais essayée
    const candidats=[];
    for(const o of Brain.registre()){
      if(o.vivant||o.inerte||o.essais>=3)continue;
      for(const prim of Brain.repertoire()){
        if(existe('analogie',o.id,prim))continue;
        const est=prevoir(prim,o.id);
        if(est.analogue&&est.p>=.5)candidats.push({o,prim,est,score:est.p*(1+1/(1+o.essais))});
      }
    }
    candidats.sort((a,b)=>b.score-a.score||(a.o.id<b.o.id?-1:1));
    for(const x of candidats.slice(0,3))creer({type:'analogie',cible:x.o.id,prim:x.prim,confiance:+x.est.p.toFixed(2),sources:x.est.sources,regions:['causes','objets','memoire']},t);
    // émotions/besoins × souvenirs × espace : ce qui ressemble à ce qui l'a déjà soulagé
    for(const besoin of ['faim','soif','fatigue','hygiene']){
      const top=[...activer({['bes:'+besoin]:1})].filter(([n,a])=>n.startsWith('obj:')&&a>.12).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1))[0];
      if(!top)continue;
      const id=top[0].slice(4),o=Brain.connu(id);
      if(!o||o.inerte||o.essais<1||existe('besoin',id,besoin)||Brain.besoinCible(besoin)?.id===id)continue;
      creer({type:'besoin',cible:id,besoin,confiance:+Math.min(1,top[1]).toFixed(2),regions:['emotions','memoire','espace']},t);
    }
    if(++A().v%20===0)elaguer();
  }
  const confirmees=()=>A().idees.filter(i=>i.statut==='confirmee'&&i.type!=='mot').length;
  function view(label=id=>id){
    const c=A(),nom=id=>label(id)||id;
    return {
      idees:c.idees.slice(-16).reverse().map(i=>({type:i.type,statut:i.statut,prim:i.prim,besoin:i.besoin,mot:i.mot,cible:nom(i.cible),
        sources:(i.sources||[]).map(nom),regions:i.regions||[]})),
      souvenirs:Brain.state.memoire.episodes.slice(-6).reverse().map(e=>({geste:e.geste,cible:nom(e.cible),succes:e.succes,effet:e.effet,soulage:e.soulage})),
      liens:Object.values(c.liens).filter(l=>l.n>=2).length,surprise:c.surprise,deductions:c.deductions,confirmees:confirmees()
    };
  }
  return {lier,activer,scene,rappel,prevoir,apprendre,idee,attendue,deduire,confirmees,view};
})();
