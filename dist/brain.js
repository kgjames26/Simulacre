// Cerveau de Néo : 14 fichiers que Néo remplit lui-même à partir de ce qu'il perçoit et essaie.
// Règles : aucun nom d'objet, aucun mot, aucune table d'effets dans ce fichier.
// Les objets sont des identifiants opaques, les effets sont des sensations observées.
// Le monde (world.js) ne passe que par percevoir() ; ce module ne lit jamais l'état du monde.
const Brain=(()=>{
  const VERSION=2;
  // Gestes innés : Néo sait les faire, pas ce qu'ils provoquent.
  // Gestes de base innés : ceux des mains. Les autres s'apprennent en les tentant (babillage moteur).
  const PRIMITIVES=['pousser','tirer','saisir','frapper'];
  const APPRENABLES=['monter','tourner','grimper','sauter'];
  const DOMAINS=['moteur','vital','cognition','ludique','social'];
  const FILES=['sens.log','essais.jsonl','corps.json','objets.json','lieux.json','personnes.json','humeur.json',
    'causes.json','concepts.json','lexique.json','ecriture.json','savoir-faire.json','questions.json','objectifs.json'];
  let sources={};
  let S;

  function fresh(seed){
    return {version:VERSION,seed:seed>>>0,rng:seed>>>0,
      manifest:{tick:0,nEssais:0,xp:{moteur:0,vital:0,cognition:0,ludique:0,social:0},consolidations:0},
      sens:[],essais:[],objets:{},lieux:{cases:{}},personnes:{},
      humeur:{valence:0,eveil:0,peur:0,frustration:0,ennui:0,historique:[]},
      causes:[],concepts:[],ecriture:{glyphes:{}},savoirFaire:[],questions:[],objectifs:[],
      gestes:{},journal:[],publie:[],synchro:{amis:false,famille:false,proche:0},
      next:{e:1,c:1,q:1,g:1,s:1}};
  }
  S=fresh(1);

  // Générateur à graine : toute l'aléa du jeu passe ici pour que deux parties soient comparables.
  function rand(){
    S.rng=(S.rng+0x6D2B79F5)>>>0;
    let t=S.rng;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return((t^(t>>>14))>>>0)/4294967296;
  }
  const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));

  function init(seed){S=fresh(seed||1);}
  function save(){return S;}
  function restore(data){
    if(!data||data.version!==VERSION)return false;
    S=Object.assign(fresh(data.seed),data);
    S.manifest=Object.assign(fresh(0).manifest,data.manifest);
    return true;
  }
  function bind(map){sources=Object.assign(sources,map);}
  function xp(domaine,points=1){
    if(DOMAINS.includes(domaine))S.manifest.xp[domaine]+=points;
  }
  function note(t,texte,ref){
    S.journal.push({t:Math.round(t),texte,ref});
    if(S.journal.length>200)S.journal.shift();
  }

  // --- 1. sens.log : flux brut, tampon limité ---
  function sentir(t,vus,ecoute,corps){
    S.sens.push({t:Math.round(t),vus,ecoute,corps});
    if(S.sens.length>80)S.sens.shift();
  }

  // --- 4. objets.json : registre de ce que Néo a vu ---
  function vu(id,traits,pos,t,vivant){
    let o=S.objets[id];
    const nouveau=!o;
    if(!o)o=S.objets[id]={id,traits,vu:0,essais:0,reussites:0,premier:Math.round(t),dernier:-1e9,inerte:false,vivant:!!vivant};
    const frais=t-o.dernier>4;
    o.traits=traits;
    o.pos=pos;
    if(frais){
      o.vu++;
      if(traits[5]>0)S.ecriture.glyphes[id]=(S.ecriture.glyphes[id]||0)+1;
    }
    o.dernier=t;
    return {objet:o,nouveau};
  }
  const connu=id=>S.objets[id];
  function registre(){return Object.values(S.objets);}

  // --- 5. lieux.json : cases visitées ---
  function lieu(x,z,floor){
    const key=Math.floor(x)+','+Math.floor(z)+','+(floor||0);
    const cases=S.lieux.cases;
    if(!cases[key]&&Object.keys(cases).length>2500)return;
    cases[key]=(cases[key]||0)+1;
  }

  // --- 6. personnes.json ---
  function personne(id,pos,t){
    const p=S.personnes[id]||(S.personnes[id]={id,vu:0,lien:0,soulage:{},dernier:-1e9});
    if(t-p.dernier>4)p.vu++;
    p.dernier=t;p.pos=pos;
    return p;
  }
  function lien(id,delta){
    const p=S.personnes[id];
    if(p)p.lien=clamp(p.lien+delta,0,100);
  }
  function soulagement(besoin,id,delta){
    const p=S.personnes[id];
    if(!p||delta<=0)return;
    p.soulage[besoin]=(p.soulage[besoin]||0)+1;
  }

  // --- 8. causes.json : action sur un objet -> sensations observées ---
  const findCause=(prim,cible)=>S.causes.find(c=>c.enonce.action===prim&&c.enonce.cible===cible);
  function recompense(e){
    let r=(e.plaisir||0)*.8-(e.douleur||0)*1.5+(e.succes?.1:0);
    for(const v of Object.values(e.besoins||{}))r+=v;
    return r;
  }
  function essai(e){
    const rec={id:'e-'+(S.next.e++),...e};
    S.essais.push(rec);
    if(S.essais.length>300)S.essais.shift();
    S.manifest.nEssais++;
    const o=S.objets[e.cible];
    if(o){o.essais++;if(e.succes)o.reussites++;if(o.essais>=12&&!o.reussites)o.inerte=true;}
    let geste=null;
    if(APPRENABLES.includes(e.prim)&&!appris(e.prim)){
      const g=S.gestes[e.prim]||=({essais:0,appris:false});
      g.essais++;
      if(g.essais>=3){g.appris=true;geste=e.prim;xp('moteur',1);note(e.t,'nouveau geste appris : '+e.prim,e.prim);}
    }
    let c=findCause(e.prim,e.cible);
    if(!c){
      c={id:'c-'+(S.next.c++),type:'cause',enonce:{action:e.prim,cible:e.cible,effet:[]},
        essais:0,reussites:0,confiance:0,statut:'essai',valeur:0,besoins:{},preuves:[],
        cree:Math.round(e.t),revise:0,echecs:0};
      S.causes.push(c);
    }
    c.essais++;
    c.revise=Math.round(e.t);
    const r=recompense(e);
    c.valeur+=(r-c.valeur)/c.essais;
    if(e.succes){
      c.reussites++;c.echecs=0;
      for(const f of e.effet)if(!c.enonce.effet.includes(f))c.enonce.effet.push(f);
      for(const [b,v] of Object.entries(e.besoins||{}))c.besoins[b]=(c.besoins[b]||0)+(v-(c.besoins[b]||0))/c.reussites;
    }else c.echecs++;
    c.confiance=+((c.reussites+.5)/(c.essais+1)).toFixed(3);
    c.preuves.push({t:Math.round(e.t),essai:rec.id,succes:!!e.succes});
    if(c.preuves.length>6)c.preuves.shift();
    let nouveau=false;
    if(c.statut==='confirme'){
      if(c.echecs>=4){
        c.statut='contredite';
        question('cause_contredite',c.id,e.t);
        note(e.t,'une cause confirmée ne marche plus',c.id);
      }
    }else if(c.reussites>=2&&c.reussites/c.essais>=.5){
      c.statut='confirme';c.echecs=0;nouveau=true;
      xp('cognition',1);
      note(e.t,'cause confirmée',c.id);
    }else if(c.reussites>=1)c.statut='hypothese';
    // humeur : valence lissée, frustration après des échecs répétés, peur après un choc
    const h=S.humeur;
    h.valence+=(clamp(r,-1,1)-h.valence)*.08;
    h.frustration=e.succes?h.frustration*.7:Math.min(1,h.frustration+.06);
    if(e.douleur)h.peur=Math.min(1,h.peur+e.douleur);
    return {cause:c,nouveau,episode:rec,geste};
  }
  function causeDe(prim,cible){return findCause(prim,cible);}

  // Choix du geste : on tente de préférence ce qu'on connaît peu et qui promet (borne supérieure de confiance).
  function conceptDe(id){return S.concepts.find(k=>k.membres.includes(id));}
  function transfert(cible,prim){
    const k=conceptDe(cible);
    if(!k)return 0;
    const c=findCause(prim,cible);
    if(c&&c.essais>0)return 0;
    return k.membres.some(m=>m!==cible&&findCause(prim,m)?.statut==='confirme')?.45:0;
  }
  const appris=g=>!!S.gestes[g]?.appris;
  const repertoire=()=>PRIMITIVES.concat(APPRENABLES.filter(appris));
  function choisir(cible){
    // Envie très forte d'essayer : souvent, il tente un geste qu'il ne maîtrise pas encore.
    const inconnus=APPRENABLES.filter(g=>!appris(g));
    if(inconnus.length&&rand()<.26*exploration()){
      const g=inconnus[Math.floor(rand()*inconnus.length)];
      (S.gestes[g]||=({essais:0,appris:false})).tentes=(S.gestes[g].tentes||0)+1;
      return g;
    }
    let total=0;
    for(const c of S.causes)if(c.enonce.cible===cible)total+=c.essais;
    let best=PRIMITIVES[0],bestScore=-1e9;
    for(const p of repertoire()){
      const c=findCause(p,cible);
      const n=c?c.essais:0;
      const moyenne=c?(c.reussites+.35)/(c.essais+1):.35;
      const exploration=(.9-S.humeur.peur*.3+S.humeur.ennui*.3)*Math.sqrt(Math.log(total+2)/(n+1));
      const score=moyenne+exploration+(c?c.valeur*.5:0)+transfert(cible,p)+rand()*1e-3;
      if(score>bestScore){bestScore=score;best=p;}
    }
    return best;
  }

  // --- besoins : où chercher du soulagement, appris et non écrit ---
  function besoinCible(besoin){
    let best=null,score=0;
    for(const c of S.causes){
      if(c.statut!=='confirme')continue;
      const gain=c.besoins[besoin]||0;
      if(gain>.08&&gain*c.confiance>score){score=gain*c.confiance;best={id:c.enonce.cible,type:'objet'};}
    }
    for(const p of Object.values(S.personnes)){
      const n=p.soulage[besoin]||0;
      const valeur=.25*Math.min(1,n/4);
      if(n>=1&&valeur>score){score=valeur;best={id:p.id,type:'personne'};}
    }
    return best;
  }

  // --- 13/14. questions et objectifs ---
  function question(type,ref,t,texte){
    if(S.questions.some(q=>q.type===type&&q.ref===ref&&q.statut==='ouverte'))return;
    S.questions.push({id:'q-'+(S.next.q++),type,ref,texte:texte||type,statut:'ouverte',cree:Math.round(t)});
    if(S.questions.length>80)S.questions=S.questions.filter(q=>q.statut==='ouverte').slice(-60);
  }
  function objectifActif(){return S.objectifs.filter(g=>g.statut==='actif');}
  function atteint(id,t){
    for(const g of S.objectifs)if(g.statut==='actif'&&g.cible===id){
      g.statut='atteint';g.fin=Math.round(t);
      const q=S.questions.find(q=>q.id===g.source);
      if(q)q.statut='resolue';
      xp('cognition',1);
      note(t,'objectif atteint',g.id);
    }
  }
  function bloque(id,t){
    for(const g of S.objectifs)if(g.statut==='actif'&&g.cible===id){
      g.essais++;
      if(g.essais>=3){g.statut='abandonne';g.fin=Math.round(t);}
    }
  }
  const nbAtteints=()=>S.objectifs.filter(g=>g.statut==='atteint').length;

  // --- 9. concepts.json : regroupements par ressemblance de traits ---
  const distance=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+((v-(b[i]||0))*(i===0?.5:i===4?2:1))**2,0));
  function conceptualiser(t){
    const items=Object.values(S.objets).filter(o=>o.vu>=2);
    const groupes=[];
    for(const o of items){
      const g=groupes.find(group=>group.some(m=>distance(m.traits,o.traits)<.4));
      if(g)g.push(o);else groupes.push([o]);
    }
    const anciens=new Map(S.concepts.map(k=>[k.id,k]));
    S.concepts=groupes.filter(g=>g.length>=2).map(g=>{
      const membres=g.map(o=>o.id).sort();
      const id='k-'+membres[0];
      const ancien=anciens.get(id);
      const usages=[...new Set(S.causes.filter(c=>c.statut==='confirme'&&membres.includes(c.enonce.cible)).map(c=>c.enonce.action))];
      return {id,type:'concept',membres,usages,cree:ancien?.cree??Math.round(t),preuves:membres.length};
    });
    // lien mot <-> objet : un mot confirmé sur un repère connu nomme cet objet
    for(const w of sources.lexique?.()||[]){
      const m=/^thing:(.+)$/.exec(w.cue||'');
      if(m&&S.objets[m[1]])S.objets[m[1]].mot=w.word;
    }
  }

  // --- consolidation : le croisement lourd, pendant le sommeil ---
  function consolider(t,ctx={}){
    S.manifest.consolidations++;
    S.manifest.tick=Math.round(t);
    conceptualiser(t);
    for(const o of Object.values(S.objets)){
      if(!o.vivant&&o.vu>=3&&o.essais===0)question('objet_non_essaye',o.id,t,'objet vu mais jamais manipulé');
      const q=S.questions.find(q=>q.type==='objet_non_essaye'&&q.ref===o.id&&q.statut==='ouverte');
      if(q&&o.essais>0)q.statut='resolue';
    }
    for(const mot of ctx.motsSansLien||[])question('mot_sans_lien',mot,t,'mot entendu souvent sans objet associé');
    // objectifs : au plus trois, tirés des questions ouvertes
    const actifs=objectifActif();
    const ouvertes=S.questions.filter(q=>q.statut==='ouverte'&&q.type==='objet_non_essaye'&&
      !actifs.some(g=>g.source===q.id)&&S.objets[q.ref]&&!S.objets[q.ref].inerte);
    ouvertes.sort((a,b)=>(S.objets[b.ref].vu-S.objets[a.ref].vu));
    for(const q of ouvertes){
      if(objectifActif().length>=3)break;
      S.objectifs.push({id:'g-'+(S.next.g++),type:'explorer',cible:q.ref,source:q.id,statut:'actif',essais:0,cree:Math.round(t)});
    }
    if(S.objectifs.length>60)S.objectifs=S.objectifs.filter(g=>g.statut==='actif').concat(S.objectifs.filter(g=>g.statut!=='actif').slice(-30));
    // savoir-faire : une cause très souvent réussie devient une routine
    for(const c of S.causes){
      if(c.statut==='confirme'&&c.reussites>=5&&!S.savoirFaire.some(s=>s.cause===c.id)){
        S.savoirFaire.push({id:'s-'+(S.next.s++),type:'routine',cause:c.id,etapes:['aller_vers',c.enonce.action],cible:c.enonce.cible,cree:Math.round(t)});
      }
    }
    // humeur : l'ennui monte quand plus rien de nouveau n'est confirmé
    const h=S.humeur;
    const recent=S.causes.filter(c=>c.statut==='confirme').length;
    h.ennui=clamp(h.ennui*.85+(S.manifest.nEssais>20&&recent===(S.manifest.dernierConfirmes??recent)?.15:0),0,1);
    S.manifest.dernierConfirmes=recent;
    h.peur*=.9;
    h.historique.push({t:Math.round(t),v:+h.valence.toFixed(2),p:+h.peur.toFixed(2),f:+h.frustration.toFixed(2),e:+h.ennui.toFixed(2)});
    if(h.historique.length>60)h.historique.shift();
  }
  const exploration=()=>clamp(1+S.humeur.ennui*.5-S.humeur.peur*.4,.4,1.6);

  // --- publication : seules les entrées confirmées sortent, en lecture seule ---
  function publier(t){
    const mots=(sources.lexique?.()||[]).map(w=>w.word);
    const entree={t:Math.round(t),
      causes:S.causes.filter(c=>c.statut==='confirme'&&c.essais>=3).map(c=>({id:c.id,enonce:c.enonce,confiance:c.confiance})),
      concepts:S.concepts.map(k=>({id:k.id,membres:k.membres,usages:k.usages})),
      mots,competences:(sources.competences?.()||[])};
    S.publie.push(entree);
    if(S.publie.length>4)S.publie.shift();
    return entree;
  }
  // Les lecteurs lisent une version publiée, avec un retard (les amis ne devancent pas Néo).
  function lire(retard=0){return S.publie[Math.max(0,S.publie.length-1-retard)]||null;}
  const aSynchro=()=>S.synchro;
  function synchroniser(qui){
    if((qui==='amis'||qui==='famille')&&S.publie.length>0&&!S.synchro[qui]){S.synchro[qui]=true;return true;}
    if(qui==='proche'){S.synchro.proche=Math.min(1,S.synchro.proche+.05);}
    return false;
  }
  const confirmees=()=>S.causes.filter(c=>c.statut==='confirme');

  // Capacités signature : condition pour franchir un stade, lue dans les fichiers.
  function signature(age,ctx={}){
    const mots=ctx.mots??(sources.lexique?.().length||0);
    const causes=confirmees().length;
    const but=nbAtteints();
    switch(age){
      case 0:return mots>=1;
      case 1:return causes>=2;
      case 2:return mots>=5&&but>=1;
      case 3:return causes>=4&&S.concepts.length>=1;
      case 4:return but>=3;
      case 5:return S.synchro.amis;
      case 6:return S.savoirFaire.length>=1;
      case 7:return but>=6;
      default:return true;
    }
  }

  // --- vue pour l'interface (observateur) : label() traduit les identifiants opaques ---
  function taille(){
    return {
      'sens.log':S.sens.length,'essais.jsonl':S.manifest.nEssais,
      'corps.json':(sources.competences?.().length||0)+repertoire().length,'objets.json':Object.keys(S.objets).length,
      'lieux.json':Object.keys(S.lieux.cases).length,'personnes.json':Object.keys(S.personnes).length,
      'humeur.json':S.humeur.historique.length,'causes.json':S.causes.length,'concepts.json':S.concepts.length,
      'lexique.json':sources.lexique?.().length||0,'ecriture.json':Object.keys(S.ecriture.glyphes).length,
      'savoir-faire.json':S.savoirFaire.length,'questions.json':S.questions.length,'objectifs.json':S.objectifs.length
    };
  }
  function view(label=id=>id){
    const nom=id=>label(id)||id;
    const dernier=S.essais.slice(-8).reverse().map(e=>({id:e.id,t:e.t,action:e.prim,cible:nom(e.cible),succes:!!e.succes,effet:e.effet}));
    const savoir=S.causes.filter(c=>c.statut!=='essai').sort((a,b)=>(b.statut==='confirme')-(a.statut==='confirme')||b.confiance-a.confiance).slice(0,40)
      .map(c=>({id:c.id,statut:c.statut,action:c.enonce.action,cible:nom(c.enonce.cible),effet:c.enonce.effet,
        confiance:c.confiance,essais:c.essais,reussites:c.reussites,preuves:c.preuves}));
    return {
      gestes:{innes:PRIMITIVES,appris:APPRENABLES.filter(appris),enCours:APPRENABLES.filter(g=>!appris(g)&&(S.gestes[g]?.essais||0)>0)},
      version:S.version,seed:S.seed,xp:S.manifest.xp,tailles:taille(),fichiers:FILES,
      savoir,derniers:dernier,
      concepts:S.concepts.map(k=>({id:k.id,membres:k.membres.map(nom),usages:k.usages})),
      questions:S.questions.filter(q=>q.statut==='ouverte').slice(-12).map(q=>({id:q.id,type:q.type,texte:q.texte,ref:q.type==='mot_sans_lien'?q.ref:nom(q.ref)})),
      objectifs:S.objectifs.slice(-12).reverse().map(g=>({id:g.id,statut:g.statut,cible:nom(g.cible)})),
      humeur:{...S.humeur,historique:undefined},
      objets:Object.values(S.objets).sort((a,b)=>b.vu-a.vu).slice(0,24).map(o=>({id:o.id,nom:nom(o.id),vu:o.vu,essais:o.essais,reussites:o.reussites,mot:o.mot,inerte:o.inerte})),
      journal:S.journal.slice(-10).reverse().map(j=>({t:j.t,texte:j.texte,ref:j.ref})),
      synchro:S.synchro,publications:S.publie.length,
      lieux:Object.keys(S.lieux.cases).length,routines:S.savoirFaire.length
    };
  }

  return {synchroniser,PRIMITIVES,APPRENABLES,repertoire,DOMAINS,FILES,init,save,restore,bind,rand,xp,note,sentir,vu,connu,registre,lieu,personne,lien,
    soulagement,essai,causeDe,choisir,besoinCible,question,objectifActif,atteint,bloque,nbAtteints,consolider,
    exploration,publier,lire,aSynchro,confirmees,signature,view,taille,
    get state(){return S;}};
})();
const rng=()=>Brain.rand();
