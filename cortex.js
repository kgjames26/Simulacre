// Cortex associatif de Néo : croise les « régions » de son cerveau (vue, corps, mémoire, langage, émotions, projets)
// pour déduire, anticiper, inventer. Tout vit dans Brain.state.cortex ; rien n'y est nommé : seulement des identifiants anonymes.
//
//  - épisodes : souvenirs multi-régions (où, quoi, qui, quel besoin, quel geste, quel effet)
//  - associations : graphe qui se renforce chaque fois que deux choses vont ensemble (type « Hebb »)
//  - mémoire de travail : ce qui est présent maintenant ; elle réveille les souvenirs liés (activation en cascade)
//  - raisonnement : analogies, besoins ↔ objets, mots ↔ choses, surprise ; les résultats sont des IDÉES à vérifier
//  - imagination : avant d'agir, il prévoit l'effet d'un geste sur une chose jamais essayée à partir de choses semblables
const Cortex=(()=>{
  const REGIONS={
    sensorielle:{nom:'Sensations',fichiers:['sens.log']},
    moteur:{nom:'Corps et gestes',fichiers:['corps.json']},
    memoire:{nom:'Mémoire',fichiers:['essais.jsonl','episodes.json']},
    spatiale:{nom:'Vue et espace',fichiers:['objets.json','lieux.json']},
    sociale:{nom:'Autres et langage',fichiers:['personnes.json','lexique.json','ecriture.json']},
    limbique:{nom:'Émotions et besoins',fichiers:['humeur.json']},
    executive:{nom:'Envies et projets',fichiers:['questions.json','objectifs.json','savoir-faire.json']},
    associative:{nom:'Raisonnement',fichiers:['causes.json','concepts.json','associations.json','idees.json']}
  };
  const MAX_EPISODES=250,MAX_LIENS=2500,MAX_IDEES=40;
  const fresh=()=>({episodes:[],noeuds:{},liens:{},idees:[],travail:{items:[],t:0},surprise:0,next:1,v:0,sceneAt:-1e9,deductions:0});
  const S=()=>Brain.state.cortex||=fresh();
  let adj=null,adjV=-1,rappelCache=null,rappelAt=-1e9;

  // --- associations ---
  const cle=(a,b)=>a<b?a+'|'+b:b+'|'+a;
  function lier(noeuds,poids=1,t=0){
    const c=S();
    const liste=[...new Set(noeuds)].slice(0,10);
    for(const n of liste){const k=c.noeuds[n]||={n:0};k.n+=poids;k.t=Math.round(t);}
    for(let i=0;i<liste.length;i++)for(let j=i+1;j<liste.length;j++){
      const l=c.liens[cle(liste[i],liste[j])]||={n:0};
      l.n+=poids;l.t=Math.round(t);
    }
    c.v++;
    if(Object.keys(c.liens).length>MAX_LIENS)elaguer();
  }
  function elaguer(){
    const c=S();
    for(const [k,l] of Object.entries(c.liens)){l.n*=.9;if(l.n<.4)delete c.liens[k];}
    for(const [k,n] of Object.entries(c.noeuds)){n.n*=.9;if(n.n<.4)delete c.noeuds[k];}
    c.v++;
  }
  function index(){
    const c=S();
    if(adj&&adjV===c.v)return adj;
    adj=new Map();
    for(const [k,l] of Object.entries(c.liens)){
      if(l.n<1.5)continue;
      const [a,b]=k.split('|');
      const f=l.n/Math.sqrt(((c.noeuds[a]?.n)||1)*((c.noeuds[b]?.n)||1));
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
      for(const [n,a] of act){
        for(const [m,f] of (graph.get(n)||[]).slice(0,12)){
          if(graines[m]!==undefined)continue;
          next.set(m,(next.get(m)||0)+a*f*.5);
        }
      }
      for(const [m,a] of next)total.set(m,(total.get(m)||0)+a);
      act=next;
    }
    return total;
  }

  // --- mémoire de travail : ce qui se passe maintenant ---
  function scene(t,ctx){
    const c=S();
    const items=[];
    if(ctx.lieu)items.push('lieu:'+ctx.lieu);
    for(const id of ctx.obj||[])items.push('obj:'+id);
    for(const id of ctx.pers||[])items.push('pers:'+id);
    for(const [b,v] of Object.entries(ctx.besoins||{}))if(v>.5)items.push('bes:'+b);
    c.travail={items:items.slice(0,16),t:Math.round(t)};
    if(t-c.sceneAt>30&&items.length>1){
      c.sceneAt=t;
      lier(items.slice(0,10),.6,t);
    }
  }
  // Rappel : quelles choses connues sont réveillées par la situation présente (valeur 0..1).
  function rappel(t){
    if(rappelCache&&t-rappelAt<5)return rappelCache;
    const c=S();
    const graines={};
    for(const n of c.travail.items)graines[n]=n.startsWith('bes:')?1.2:.6;
    const act=activer(graines);
    const out=new Map();
    let max=.0001;
    for(const [n,a] of act)if(n.startsWith('obj:')){out.set(n.slice(4),a);if(a>max)max=a;}
    for(const [id,a] of out)out.set(id,Math.min(1,a/max));
    rappelCache=out;rappelAt=t;
    return out;
  }

  // --- prévision (imagination à court terme) ---
  function distance(a,b){return Math.sqrt(a.reduce((s,v,i)=>s+((v-(b[i]||0))*(i===0?.5:i===4?2:1))**2,0));}
  function prevoir(prim,cible){
    const cause=Brain.causeDe(prim,cible);
    if(cause&&cause.essais>=2)return {p:cause.confiance,effets:cause.enonce.effet,analogue:false,sources:[]};
    const cibleObj=Brain.connu(cible);
    if(!cibleObj)return {p:.3,effets:[],analogue:false,sources:[]};
    let pesees=0,somme=0;const effets=[],sources=[];
    for(const c of Brain.confirmees()){
      if(c.enonce.action!==prim||c.enonce.cible===cible)continue;
      const o=Brain.connu(c.enonce.cible);
      if(!o)continue;
      const d=distance(o.traits,cibleObj.traits);
      if(d>=.7)continue;
      const w=1-d/.7*.8;
      pesees+=w;somme+=w*c.confiance;
      for(const f of c.enonce.effet)if(!effets.includes(f))effets.push(f);
      sources.push(c.enonce.cible);
    }
    if(!pesees)return {p:.3,effets:[],analogue:false,sources:[]};
    return {p:somme/pesees,effets,analogue:true,sources:sources.slice(0,3)};
  }

  // --- apprendre d'un essai : souvenir + associations + surprise + vérification d'idées ---
  function apprendre(e,prevu,ctx={}){
    const c=S();
    const besoinsUtiles=Object.entries(e.besoins||{}).filter(([,v])=>v>.05).map(([b])=>b);
    const noeuds=['ges:'+e.prim,'obj:'+e.cible,...(e.effet||[]).map(f=>'eff:'+f),...besoinsUtiles.map(b=>'bes:'+b)];
    if(ctx.lieu)noeuds.push('lieu:'+ctx.lieu);
    for(const n of c.travail.items)if(n.startsWith('pers:'))noeuds.push(n);
    lier(noeuds,e.succes?1:.4,e.t);
    // les besoins soulagés se lient fortement à la chose qui les a soulagés
    for(const b of besoinsUtiles)lier(['bes:'+b,'obj:'+e.cible],2,e.t);
    c.episodes.push({id:'m-'+(c.next++),t:Math.round(e.t),lieu:ctx.lieu||null,cible:e.cible,geste:e.prim,succes:!!e.succes,
      effet:(e.effet||[]).slice(0,4),soulage:besoinsUtiles,plaisir:+(e.plaisir||0).toFixed(2),douleur:+(e.douleur||0).toFixed(2)});
    if(c.episodes.length>MAX_EPISODES)c.episodes.shift();
    // surprise : l'écart entre ce qu'il prévoyait et ce qui s'est passé
    const ecart=Math.abs((e.succes?1:0)-(prevu?prevu.p:.3));
    c.surprise=+(c.surprise*.9+ecart*.1).toFixed(3);
    if(prevu&&prevu.analogue&&ecart>.6)Brain.question('surprise',e.cible,e.t,'résultat inattendu');
    return verifier(e);
  }
  function verifier(e){
    const c=S();
    let verdict=null;
    for(const idee of c.idees){
      if(idee.cible!==e.cible||idee.statut==='confirmee'||idee.statut==='refutee')continue;
      let ok=null;
      if(idee.type==='analogie'&&idee.prim===e.prim)ok=!!e.succes;
      else if(idee.type==='besoin'&&Object.keys(e.besoins||{}).length)ok=(e.besoins[idee.besoin]||0)>.05;
      else if(idee.type==='besoin'&&idee.essais>=2)ok=false;
      if(ok===null)continue;
      idee.essais++;
      if(ok){idee.statut='confirmee';idee.fin=Math.round(e.t);Brain.xp('cognition',2);Brain.note(e.t,'idée confirmée',idee.id);verdict=idee;}
      else if(idee.essais>=2){idee.statut='refutee';idee.fin=Math.round(e.t);Brain.note(e.t,'idée réfutée',idee.id);}
    }
    return verdict;
  }
  const attendue=cible=>S().idees.some(i=>i.cible===cible&&i.statut==='idee'&&i.type!=='mot');
  // Une idée en attente pour cette chose : il l'essaie en priorité (envie d'expérimenter).
  function idee(cible){
    let meilleure=null;
    for(const i of S().idees){
      if(i.cible!==cible||i.statut!=='idee'||!i.prim)continue;
      if(!Brain.repertoire().includes(i.prim))continue;
      if(!meilleure||i.confiance>meilleure.confiance)meilleure=i;
    }
    if(meilleure&&Brain.rand()<.75)return meilleure.prim;
    return null;
  }

  // --- raisonnement : croiser les régions pour produire des idées ---
  function existe(type,cible,extra){return S().idees.some(i=>i.type===type&&i.cible===cible&&(i.prim||i.besoin||i.mot||'')===(extra||'')&&i.statut!=='refutee');}
  function creer(idee,t){
    const c=S();
    if(c.idees.filter(i=>i.statut==='idee').length>=MAX_IDEES)return;
    c.idees.push({id:'i-'+(c.next++),statut:'idee',essais:0,cree:Math.round(t),...idee});
    c.deductions++;
    if(c.idees.length>MAX_IDEES*3)c.idees=c.idees.filter(i=>i.statut==='idee'||i.statut==='confirmee').slice(-MAX_IDEES*2);
  }
  function deduire(t,ctx={}){
    const c=S();
    // 1. langage × vue : un mot souvent entendu devant une chose finit par la désigner
    for(const m of ctx.lexique||[]){
      const cue=m.cue||'';
      if(!cue.startsWith('thing:'))continue;
      const id=cue.slice(6),o=Brain.connu(id);
      if(!o)continue;
      lier(['mot:'+m.word,'obj:'+id],Math.min(3,m.heard||1),t);
      if(!o.mot){
        o.mot=m.word;
        creer({type:'mot',cible:id,mot:m.word,confiance:Math.min(1,(m.heard||1)/6),statut:'confirmee',fin:Math.round(t),
          regions:['sociale','spatiale','memoire']},t);
        Brain.xp('cognition',1);
      }
    }
    // 2. imagination par analogie : prévoir ce qui marcherait sur une chose jamais essayée
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
    for(const x of candidats.slice(0,3))
      creer({type:'analogie',cible:x.o.id,prim:x.prim,confiance:+x.est.p.toFixed(2),sources:x.est.sources,effetsPrevus:x.est.effets.slice(0,3),
        regions:['associative','memoire','spatiale']},t);
    // 3. besoins × souvenirs × lieux : à quoi ressemble ce qui l'a déjà soulagé, et où en trouver d'autre
    for(const besoin of ['faim','soif','fatigue','hygiene']){
      const act=activer({['bes:'+besoin]:1});
      const top=[...act].filter(([n,a])=>n.startsWith('obj:')&&a>.12).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1))[0];
      if(!top)continue;
      const id=top[0].slice(4),o=Brain.connu(id);
      if(!o||o.inerte||o.essais<1||existe('besoin',id,besoin))continue;
      const deja=Brain.besoinCible(besoin);
      if(deja&&deja.id===id)continue;
      creer({type:'besoin',cible:id,besoin,confiance:+Math.min(1,top[1]).toFixed(2),regions:['limbique','memoire','spatiale']},t);
    }
    elaguerSiBesoin();
  }
  function elaguerSiBesoin(){const c=S();c.v++;if(c.v%20===0)elaguer();}
  const confirmees=()=>S().idees.filter(i=>i.statut==='confirmee'&&i.type!=='mot').length;

  // --- vue pour l'observateur ---
  function tailles(){
    const c=S();
    return {'episodes.json':c.episodes.length,'associations.json':Object.keys(c.liens).length,'idees.json':c.idees.filter(i=>i.statut!=='refutee').length};
  }
  function view(label=id=>id,fichiers={}){
    const c=S();
    const nom=id=>label(id)||id;
    const idees=c.idees.slice(-24).reverse().map(i=>({id:i.id,type:i.type,statut:i.statut,prim:i.prim,besoin:i.besoin,mot:i.mot,
      cible:nom(i.cible),sources:(i.sources||[]).map(nom),effets:i.effetsPrevus||[],confiance:i.confiance,
      regions:(i.regions||[]).map(r=>REGIONS[r]?.nom||r),essais:i.essais}));
    const souvenirs=c.episodes.slice(-6).reverse().map(e=>({t:e.t,geste:e.geste,cible:nom(e.cible),succes:e.succes,effet:e.effet,soulage:e.soulage}));
    const regions=Object.entries(REGIONS).map(([id,r])=>({id,nom:r.nom,
      elements:r.fichiers.reduce((s,f)=>s+(fichiers[f]||0),0),fichiers:r.fichiers}));
    const liens=Object.values(c.liens).filter(l=>l.n>=2).length;
    return {regions,idees,souvenirs,liens,surprise:c.surprise,deductions:c.deductions,confirmees:confirmees(),
      travail:c.travail.items.length};
  }
  return {REGIONS,attendue,lier,activer,scene,rappel,prevoir,apprendre,idee,deduire,tailles,view,confirmees};
})();
