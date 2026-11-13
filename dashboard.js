// Interface : quatre pages simples. Toutes les données viennent de la simulation ; rien n'est calculé ici.
const ui=id=>document.getElementById(id);
const number=new Intl.NumberFormat('fr-BE');
const fmt=v=>number.format(v??0);
const pct=v=>Math.round((v||0)*100)+' %';
export const TIME_SCALE=144;           // 1 jour fictif = 10 minutes de simulation
export const AGES=['Nourrisson','Bébé','Petit enfant','Enfant','Grand enfant','Jeune ado','Ado','Jeune homme','Homme'];
const MARCHE=['Se redresser','Ramper','Tenir debout','Premiers pas','Marcher'];
const PAGES={monde:'Le monde',cerveau:'Son cerveau',croissance:'Sa croissance',decouvertes:'Ses découvertes',sociabilite:'Sa sociabilité',nuits:'Ses nuits'};
const ANCIENNES={apprend:'cerveau',grandir:'croissance',paroles:'sociabilite',proches:'sociabilite',entourage:'sociabilite',ensemble:'monde'};
const GENRES={social:'Relation',play:'Jeu',food:'Repas',sleep:'Sommeil',object:'Objet',care:'Soin',limite:'Limite'};
const VERBES={pousser:'Pousser',tirer:'Tirer',saisir:'Prendre',frapper:'Frapper',tourner:'Tourner',monter:'Monter sur',grimper:'Grimper sur',sauter:'Sauter sur'};
const EFFETS={mou:'c’est mou',soi_monte:'on peut s’y installer',lumiere:'ça s’allume',bruit:'ça fait du bruit',objet_bouge:'ça bouge',papier:'ça se feuillette',
  eau:'de l’eau coule',chaud:'c’est chaud',froid:'c’est froid',nourriture:'ça se mange',gout:'ça a du goût',perles:'les perles glissent',roues:'les roues tournent',
  mal:'ça fait mal',passage:'on peut passer',rebond:'ça rebondit',hauteur:'on monte haut',glisse:'ça glisse',balance:'ça se balance',tient:'on peut s’accrocher',
  effort:'il faut forcer',outil:'ça se prend en main',vivant:'c’est vivant',doux:'c’est doux',rond:'c’est rond',ecrit:'il y a des signes'};
const BESOINS={faim:'la faim',soif:'la soif',fatigue:'la fatigue',hygiene:'le besoin de se laver'};
// Le leadership est un trait parmi les autres, sans mise en avant.
const TRAITS={curiosite:'Curiosité',perseverance:'Persévérance',prudence:'Prudence',sociabilite:'Sociabilité',empathie:'Empathie',leadership:'Leadership',creativite:'Créativité',independance:'Indépendance',patience:'Patience',optimisme:'Optimisme'};
const CAPACITES={equilibre:'Équilibre',course:'Course',saut:'Saut',force:'Force',endurance:'Endurance',psychomotricite:'Psychomotricité',motriciteFine:'Motricité fine',douleur:'Gestion de la douleur'};
const cap=t=>t?t.charAt(0).toUpperCase()+t.slice(1):'';
const effets=l=>(l||[]).map(e=>EFFETS[e]||e).join(', ')||'rien de visible';
const stamp=sec=>{const t=Math.max(0,Math.floor(sec*TIME_SCALE));return 'Jour '+fmt(1+Math.floor(t/86400))+', '+String(Math.floor(t/3600)%24).padStart(2,'0')+' h '+String(Math.floor(t/60)%60).padStart(2,'0');};

const el=(tag,props={},...kids)=>{const {dataset,...rest}=props;const n=Object.assign(document.createElement(tag),rest);if(dataset)Object.assign(n.dataset,dataset);n.append(...kids.filter(k=>k!=null));return n;};
const row=(label,value)=>el('div',{className:'row'},el('span',{textContent:label}),el('strong',{textContent:value}));
const empty=text=>el('p',{className:'empty',textContent:text});
const badge=(text,kind='')=>el('span',{className:'badge '+kind,textContent:text});
const item=(title,sub,right)=>el('div',{className:'item'},el('strong',{textContent:title}),right||null,sub?el('small',{textContent:sub}):null);
// Jauge de quantité (ni bonne ni mauvaise en soi) : un mot à chaque bout au lieu d'un pourcentage.
function niveauJauge(label,valeur,gauche='peu',droite='très'){
  const v=Math.max(0,Math.min(1,valeur));
  const mot=v<.2?'très peu':v<.4?'un peu':v<.6?'moyen':v<.8?'beaucoup':'énormément';
  return el('div',{className:'meter niveau',title:label+' : '+mot},el('span',{textContent:label}),
    el('span',{className:'bout',textContent:gauche}),el('div',{className:'track neutre'},el('i',{style:'width:'+Math.round(v*100)+'%'})),el('span',{className:'bout',textContent:droite}));
}
// Jauge lisible d'un coup d'œil : tête triste à gauche, tête heureuse à droite, la barre entre les deux (plus elle est pleine, mieux c'est).
function humeurJauge(label,bien){
  const v=Math.max(0,Math.min(1,bien));
  const track=el('div',{className:'track'+(v<.35?' warn':'')},el('i',{style:'width:'+Math.round(v*100)+'%'}));
  return el('div',{className:'meter face',title:label+' : '+(v>.66?'ça va bien':v>.35?'moyen':'ça ne va pas')},el('span',{textContent:label}),
    el('span',{className:'tete',style:'font-size:'+(13+12*(1-v)).toFixed(1)+'px',textContent:'☹️'}),track,el('span',{className:'tete',style:'font-size:'+(13+12*v).toFixed(1)+'px',textContent:'😊'}));
}
// Ne repeint un bloc que si son contenu a changé.
function paint(id,key,build){const box=ui(id);if(!box||box.dataset.key===key)return;box.dataset.key=key;box.replaceChildren(...build());}

let names={},page='monde',current=null;

// ---------- panneaux dépliables : leur état ouvert/fermé est retenu ----------
let ouverts={};
try{ouverts=JSON.parse(localStorage.getItem('simulacre-panneaux'))||{};}catch{}
const retenir=()=>{try{localStorage.setItem('simulacre-panneaux',JSON.stringify(ouverts));}catch{}};
document.addEventListener('toggle',e=>{const id=e.target?.dataset?.id;if(id){ouverts[id]=e.target.open;retenir();}},true);
function restaurer(racine=document){for(const det of racine.querySelectorAll('details[data-id]'))if(det.dataset.id in ouverts)det.open=ouverts[det.dataset.id];}
// Fabrique un panneau (niveau 2 ou 3) : titre, sous-titre, pastille, contenu.
function panneau(id,{titre,sous,meta,metaKind='',etat,ouvert=false},...contenu){
  const det=el('details',{className:'acc',dataset:{id,...(etat?{etat}:{})}});
  det.open=id in ouverts?ouverts[id]:ouvert;
  det.append(el('summary',{},el('span',{className:'acc-t'},el('strong',{textContent:titre}),sous?el('small',{textContent:sous}):null),
    meta!=null?el('span',{className:'meta '+metaKind,textContent:meta}):null),el('div',{className:'acc-body'},...contenu));
  return det;
}
const setMeta=(id,text,kind='')=>{const m=ui(id);if(m){m.textContent=text??'';m.className='meta '+kind;}};

// ---------- archive des conversations (IndexedDB) ----------
let archive=null,latestArchived=0,archiveStatus='ouverture';
const recent=new Map();
function tx(mode,fn){return new Promise((ok,ko)=>{const t=archive.transaction('lines',mode);let r;t.oncomplete=()=>ok(r);t.onabort=t.onerror=()=>ko(t.error);fn(t.objectStore('lines'),v=>{r=v;});});}
const archiveReady=(async()=>{
  try{
    archive=await new Promise((ok,ko)=>{
      const q=indexedDB.open('alex-simulacre-conversations',2);
      q.onupgradeneeded=e=>{const st=e.oldVersion?q.transaction.objectStore('lines'):q.result.createObjectStore('lines',{keyPath:'id'});if(!st.indexNames.contains('speaker'))st.createIndex('speaker',['speaker','id']);};
      q.onsuccess=()=>ok(q.result);q.onerror=()=>ko(q.error);q.onblocked=()=>ko(new Error('bloqué'));
    });
    latestArchived=await tx('readonly',(st,done)=>{const r=st.openKeyCursor(null,'prev');r.onsuccess=()=>done(r.result?.key||0);});
    archiveStatus='prête';
  }catch{archive=null;archiveStatus='indisponible';}
  return latestArchived;
})();
function capture(lines){
  if(!lines?.length)return;
  const fresh=lines.filter(l=>l.id>latestArchived&&!recent.has(l.id));
  for(const l of lines)recent.set(l.id,l);
  while(recent.size>600)recent.delete(recent.keys().next().value);
  if(!fresh.length)return;
  archiveReady.then(async()=>{if(!archive)return;try{await tx('readwrite',st=>{for(const l of fresh)st.put(l);});latestArchived=Math.max(latestArchived,fresh.at(-1).id);}catch{archiveStatus='indisponible';}});
}
async function clearHistory(){await archiveReady;if(archive)await tx('readwrite',st=>st.clear());recent.clear();}
const PAGE_SIZE=40;let before=Infinity,stack=[],request=0;
async function history(){
  const speaker=ui('speaker-filter').value,b=before;
  const match=l=>l.id<b&&(!speaker||l.speaker===speaker);
  const out=new Map([...recent.values()].reverse().filter(match).slice(0,PAGE_SIZE+1).map(l=>[l.id,l]));
  if(archive){
    try{
      const older=await tx('readonly',(st,done)=>{
        const range=speaker?IDBKeyRange.bound([speaker,0],[speaker,Number.isFinite(b)?b:Number.MAX_SAFE_INTEGER],false,true):Number.isFinite(b)?IDBKeyRange.upperBound(b,true):null;
        const r=(speaker?st.index('speaker'):st).openCursor(range,'prev'),res=[];
        r.onsuccess=()=>{const c=r.result;if(!c||res.length>PAGE_SIZE){done(res);return;}if(match(c.value))res.push(c.value);c.continue();};
      });
      for(const l of older)out.set(l.id,l);
    }catch{archiveStatus='indisponible';}
  }
  return [...out.values()].sort((x,y)=>y.id-x.id).slice(0,PAGE_SIZE+1);
}
async function renderTranscript(){
  const n=++request,list=await history();
  if(n!==request||page!=='sociabilite')return;
  const rows=list.slice(0,PAGE_SIZE);
  paint('conversation-lines',rows.map(l=>l.id).join(','),()=>rows.length?rows.map(l=>{
    const who=names[l.speaker]||l.nomSpeaker||l.speaker,to=names[l.listener]||l.nomListener;
    return el('li',{},el('strong',{textContent:to?who+' → '+to:who}),document.createTextNode(' '+texteDit(l,to)),
      el('small',{textContent:stamp(l.at)+(l.speaker==='alex'?'':l.heardByNéo?' · Néo entend':' · trop loin pour Néo')}));
  }):[el('li',{textContent:'Aucune parole pour l’instant.'})]);
  ui('older-lines').hidden=list.length<=PAGE_SIZE;
  ui('older-lines').dataset.before=rows.at(-1)?.id||'';
  ui('live-lines').hidden=!stack.length;
}
// Quand on parle à Néo, on commence par son nom ; quand Néo parle à quelqu'un, son nom vient à la fin.
export function texteDit(l,to){
  let t=l.text||'';
  if(l.listener==='alex'&&l.speaker!=='alex'&&!/^néo\b/i.test(t))t='Néo, '+t.charAt(0).toLowerCase()+t.slice(1);
  if(l.speaker==='alex'&&to){const fin=t.match(/[.!?…]+$/)?.[0]||'';t=t.slice(0,t.length-fin.length).replace(/,\s*$/,'')+', '+to+(fin||'.');}
  return t;
}
const resetTranscript=()=>{before=Infinity;stack=[];renderTranscript();};

// ---------- page : le monde ----------
function renderMonde(s){
  const a=s.alex,b=s.brain,z=s.activityData?.zone;
  ui('age').textContent=AGES[s.age];
  if(z)setMeta('zone-chip',cap(z.liste[z.niveau].nom),'good');
  paint('neo-meters',[a.hunger,a.fatigue,a.thirst,a.pleasure,b?.emotions.confiance].map(v=>Math.round((v||0)*20)).join(),()=>[
    humeurJauge('Rassasié',1-a.hunger),humeurJauge('Reposé',1-a.fatigue),humeurJauge('Désaltéré',1-(a.thirst??0)),
    humeurJauge('Bien-être',a.pleasure||0),humeurJauge('Confiance',b?.emotions.confiance??.4)]);
  if(b){
    const sure=b.savoir.filter(c=>c.statut==='confirme').slice(0,4);
    paint('latest-understood',sure.map(c=>c.action+c.cible).join(),()=>sure.length?sure.map(c=>el('li',{textContent:(VERBES[c.action]||cap(c.action))+' '+c.cible+' : '+effets(c.effet)})):[el('li',{className:'muted',textContent:'Rien encore : il observe et essaie.'})]);
  }
  setMeta('meta-compris',fmt(b?.compris||0)+' compris',b?.compris?'good':'');
  if(s.journal[0])setMeta('meta-journal',stamp(s.journal[0].ticks/120).replace(/^.*, /,''));
  paint('journal',s.journal.map(j=>j.ticks).join(),()=>s.journal.length?s.journal.map(j=>el('li',{textContent:j.message})):[el('li',{className:'muted',textContent:'Il découvre ses mouvements.'})]);
}

// ---------- page : son cerveau ----------
const IDEES={idee:['à vérifier','warm'],confirmee:['vérifiée','good'],refutee:['fausse','bad']};
const STATUTS={confirme:['sûr','good'],hypothese:['il le pense','warm'],contredite:['s’est trompé','bad']};
function ideeTexte(i){
  if(i.type==='mot')return '« '+i.mot+' » veut dire : '+i.cible;
  if(i.type==='besoin')return 'Contre '+(BESOINS[i.besoin]||i.besoin)+', '+i.cible+' pourrait aider';
  return (VERBES[i.prim]||cap(i.prim))+' '+i.cible+' devrait marcher'+(i.sources.length?', comme avec '+i.sources.join(' et '):'');
}
function renderCerveau(s){
  const b=s.brain;if(!b)return;
  const c=b.cortex;
  const regions=[
    ['Sens',b.sens,'choses perçues en ce moment'],['Corps',b.gestes.innes.length+b.gestes.appris.length,'gestes qu’il sait faire'],
    ['Espace',b.lieux,'endroits connus · '+b.limites+' limite'+(b.limites>1?'s':'')],['Objets',b.nbObjets,'choses repérées · '+b.familles+' famille'+(b.familles>1?'s':'')],
    ['Mémoire',b.souvenirs,'souvenirs complets'],['Causes',b.compris,'choses comprises'],['Langage',b.mots,'mots compris'],
    ['Social',b.personnes,'personnes connues'],['Émotions',Math.round(b.emotions.confiance*100)+' %','confiance en lui'],['Envies',b.envies,'questions et projets'],
    ['Associations',c.liens,c.deductions+' idées · '+c.confirmees+' vérifiées',true]];
  paint('regions',JSON.stringify(regions),()=>regions.map(([nom,n,desc,hub])=>el('div',{className:'region'+(hub?' hub':''),dataset:{empty:String(!n||n==='0 %')}},el('strong',{textContent:typeof n==='number'?fmt(n):n}),el('span',{textContent:nom}),el('small',{textContent:desc}))));
  setMeta('meta-comprend',fmt(b.compris)+' compris · '+fmt(c.confirmees)+' idées vérifiées');
  setMeta('meta-causes',fmt(b.savoir.length));setMeta('meta-idees',fmt(c.idees.length));setMeta('meta-familles',fmt(b.concepts.length));setMeta('meta-choses',fmt(b.nbObjets));
  setMeta('meta-envies',fmt(b.envies));
  paint('brain-families',JSON.stringify(b.concepts),()=>b.concepts.length?b.concepts.map(k=>item(k.membres.join(', '),k.usages.length?'il sait : '+k.usages.map(u=>VERBES[u]||u).join(', '):'il ne sait pas encore quoi en faire',badge(k.membres.length+' choses'))):[empty('Pas encore : il faut d’abord voir plusieurs fois des choses qui se ressemblent.')]);
  paint('brain-causes',JSON.stringify(b.savoir.slice(0,12)),()=>b.savoir.length?b.savoir.slice(0,12).map(k=>{
    const [t,kind]=STATUTS[k.statut]||[k.statut,''];
    return item((VERBES[k.action]||cap(k.action))+' '+k.cible,'→ '+effets(k.effet)+' · '+k.reussites+' sur '+k.essais+' essais',badge(t,kind));
  }):[empty('Pas encore. Il doit d’abord essayer des gestes sur ce qui l’entoure.')]);
  paint('brain-ideas',JSON.stringify(c.idees.slice(0,10)),()=>c.idees.length?c.idees.slice(0,10).map(i=>{
    const [t,kind]=IDEES[i.statut]||[i.statut,''];
    return item(ideeTexte(i),'croise : '+i.regions.join(' + '),badge(t,kind));
  }):[empty('Pas encore d’idée : il lui faut d’abord vivre des choses.')]);
  const wishes=[...b.questions.map(q=>item(q.type==='jamais_essaye'?'Que faire avec '+q.ref+' ?':q.type==='surprise'?'Pourquoi '+q.ref+' a surpris ?':'Ça ne marche plus avec '+q.ref,null,badge('question'))),
    ...b.objectifs.filter(o=>o.statut==='actif').map(o=>item('Aller essayer '+o.cible,null,badge('envie','warm'))),
    ...(b.habitudes?[item(b.habitudes+' habitude'+(b.habitudes>1?'s':'')+' prise'+(b.habitudes>1?'s':''),null,badge('acquis','good'))]:[])];
  paint('brain-wishes',wishes.map(w=>w.textContent).join('|'),()=>wishes.length?wishes:[empty('Rien de précis pour l’instant : il explore au hasard.')]);
  const e=b.emotions;
  paint('brain-mood',[e.valence,e.peur,e.frustration,e.ennui].map(v=>Math.round(v*20)).join(),()=>[humeurJauge('Se sent bien',(e.valence+1)/2),humeurJauge('Rassuré',1-e.peur),humeurJauge('Serein',1-e.frustration),humeurJauge('Intéressé',1-e.ennui)]);
  if(b.caractere)paint('brain-traits',JSON.stringify(Object.values(b.caractere).map(v=>Math.round(v*50))),()=>Object.entries(TRAITS).map(([k,l])=>niveauJauge(l,b.caractere[k]||0)));
  renderVocabulary(s.dialogue);
  paint('brain-things',JSON.stringify(b.objets),()=>b.objets.length?b.objets.map(o=>el('div',{},el('strong',{textContent:o.nom}),el('small',{textContent:'vu '+o.vu+' fois'+(o.essais?' · essayé '+o.essais+' fois':' · jamais touché')+(o.mot?' · « '+o.mot+' »':'')}))):[empty('Rien pour l’instant.')]);
}
const norm=v=>v.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu,'');
function renderVocabulary(d){
  const words=d.vocabulary||[],q=norm(ui('vocabulary-search').value.trim());
  setMeta('vocabulary-count',fmt(words.length)+(words.length>1?' mots':' mot'));
  const vis=words.filter(w=>norm(w.word).includes(q)).sort((a,b)=>a.word.localeCompare(b.word,'fr'));
  paint('vocabulary-list',q+'|'+vis.map(w=>w.word+w.heard).join(),()=>vis.length?vis.map(w=>el('li',{},el('strong',{textContent:w.word}),el('small',{textContent:w.context+' · entendu '+w.heard+' fois'}))):[el('li',{textContent:words.length?'Aucun mot ne correspond.':'Aucun mot compris pour l’instant.'})]);
}

// ---------- page : ses découvertes, par genre ----------
const GENRES_DECOUVERTE=[
  ['objet','Les objets','Ce qu’ils font quand il les touche'],['jeu','Les jeux et les jouets','Ce qu’on peut en faire'],
  ['equipement','L’aire de jeux et le trampoline','Glisser, se balancer, grimper…'],['porte','Les portes','Elles s’ouvrent, on passe'],
  ['lieu','Les endroits','Ce qu’il a remarqué en explorant'],['autre','Autres choses','Outils, arbres, fleurs…']];
function renderDecouvertes(s){
  const b=s.brain,d=b?.decouvertes;if(!d)return;
  const c=b.cortex||{idees:[]},mots=s.dialogue?.vocabulary||[];
  const cle=JSON.stringify([d,mots.length,b.concepts.length,c.confirmees]);
  const box=ui('decouvertes');if(box.dataset.key===cle)return;box.dataset.key=cle;
  const cause=k=>item((VERBES[k.action]||cap(k.action))+' '+k.cible,'→ '+effets(k.effet)+(k.besoins?.length?' · aide contre '+k.besoins.map(x=>BESOINS[x]||x).join(', '):'')+' · '+k.reussites+' sur '+k.essais,badge('compris','good'));
  const groupes=[];
  groupes.push(['d-corps','Son corps','Ce que son corps a appris à faire',d.corps.map(x=>item(x,null,badge('sait faire','good')))]);
  const vus=new Set(GENRES_DECOUVERTE.map(g=>g[0]));
  for(const [genre,titre,sous] of GENRES_DECOUVERTE){
    const l=d.causes.filter(k=>genre==='autre'?!vus.has(k.genre)||k.genre==='autre':k.genre===genre);
    groupes.push(['d-'+genre,titre,sous,l.map(cause)]);
  }
  const besoins=d.causes.filter(k=>k.besoins?.length);
  groupes.push(['d-besoins','Ce qui soulage ses besoins','La faim, la soif, la fatigue…',besoins.map(cause)]);
  groupes.push(['d-personnes','Les personnes','Ceux qu’il reconnaît',d.personnes.map(p=>item(p.nom,'vu '+fmt(p.vu)+' fois',badge('lien '+p.lien)))]);
  groupes.push(['d-mots','Les mots','Ce qu’il a deviné en écoutant',mots.slice().sort((x,y)=>x.word.localeCompare(y.word,'fr')).map(w=>item(w.word,w.context))]);
  groupes.push(['d-idees','Ses idées vérifiées','Déduites en croisant ce qu’il sait, confirmées en essayant',c.idees.filter(i=>i.statut==='confirmee').map(i=>item(ideeTexte(i),null,badge('vérifiée','good')))]);
  groupes.push(['d-familles','Les familles de choses','Ce qui se ressemble à ses yeux',b.concepts.map(k=>item(k.membres.join(', '),k.usages.length?'il sait : '+k.usages.map(u=>VERBES[u]||u).join(', '):null))]);
  groupes.push(['d-habitudes','Ses habitudes','Ce qu’il refait parce que ça marche',d.habitudes.map(h=>item((VERBES[h.action]||cap(h.action))+' '+h.cible))]);
  groupes.push(['d-lieux','Les lieux','L’espace qu’il connaît',[item(fmt(d.lieux)+' endroits connus',d.limites?fmt(d.limites)+' limite'+(d.limites>1?'s':'')+' rencontrée'+(d.limites>1?'s':''):null)]]);
  box.replaceChildren(...groupes.map(([id,titre,sous,liste])=>panneau(id,{titre,sous,meta:fmt(id==='d-lieux'?d.lieux:liste.length),metaKind:liste.length?'good':''},
    el('div',{className:'stack'},...(liste.length?liste:[empty('Rien encore : il le découvrira seul.')])))));
}

// ---------- page : sa croissance ----------
function renderCroissance(s){
  const b=s.brain;
  if(b){
    setMeta('meta-corps',fmt(b.gestes.innes.length+b.gestes.appris.length)+' gestes');
  const g=b.gestes;
  paint('brain-gestures',JSON.stringify(g),()=>[...g.innes.map(x=>el('span',{className:'chip off',textContent:cap(x)+' · inné'})),
    ...g.appris.map(x=>el('span',{className:'chip',textContent:cap(x)+' · appris'})),...g.enCours.map(x=>el('span',{className:'chip warm',textContent:cap(x)+' · il essaie'}))]);
  paint('brain-capacities',JSON.stringify(b.capacites),()=>Object.entries(CAPACITES).map(([k,l])=>niveauJauge(l,b.capacites[k]||0,'débutant','expert')));
  paint('brain-challenges',JSON.stringify(b.defis),()=>b.defis.map(d=>item(d.cible,d.reussites?'réussi '+d.reussites+' fois sur '+d.essais:'pas encore réussi ('+d.essais+' essais)',badge(d.reussites?'il y arrive':'trop dur',d.reussites?'good':'warm'))));
  }
  const etapes=s.brain?.etapes||[];
  setMeta('meta-age',AGES[s.age],'warm');
  paint('stage-goals',JSON.stringify(etapes),()=>etapes.length?etapes.map(e=>{
    const titre=e.etat==='fini'?'accompli'+(e.fin!=null?' · '+stamp(e.fin).replace(/, .*/,''):''):e.etat;
    const faits=e.objectifs.filter(g=>g.done).length;
    const contenu=[];
    for(const [type,nom] of [['physique','Son corps'],['mental','Sa tête']]){
      const liste=e.objectifs.filter(g=>g.type===type);
      if(liste.length)contenu.push(el('p',{className:'eyebrow',textContent:nom}),...liste.map(g=>item(g.label,null,badge(g.done?'✓ acquis':e.etat==='à venir'?'prévu':'pas encore',g.done?'good':''))));
    }
    if(!contenu.length)contenu.push(empty('Adulte : il continue d’apprendre sans fin.'));
    return panneau('etape-'+e.age,{titre:e.nom,sous:titre,meta:e.objectifs.length?faits+' / '+e.objectifs.length:null,metaKind:e.etat==='fini'?'good':e.etat==='en cours'?'warm':'',etat:e.etat,ouvert:e.etat==='en cours'},...contenu);
  }):[empty('Évaluation en cours…')]);
  const z=s.activityData?.zone;
  if(z)setMeta('meta-zones',cap(z.liste[z.niveau].nom),'good');
  if(z)paint('zones',JSON.stringify(z),()=>z.liste.map(x=>el('li',{dataset:{open:String(x.ouvert)}},el('span',{textContent:cap(x.nom)}),badge(x.ouvert?'permis':'dès '+(AGES[x.age]||'plus tard').toLowerCase(),x.ouvert?'good':''))));
  const m=s.activityData?.motor||[];
  paint('motor-steps',JSON.stringify(m)+s.skill,()=>m.map((r,i)=>el('div',{className:'step',dataset:{state:r.mastered?'done':i===s.skill?'active':'later'}},
    el('strong',{textContent:MARCHE[i]}),el('small',{textContent:r.mastered?'acquis':i===s.skill?r.recent+'/6 réussites récentes':'à venir'}),el('small',{textContent:fmt(r.attempts)+' essais'}))));
  setMeta('meta-marche',m.filter(r=>r.mastered).length+' / 5');
  const d=s.dialogue;
  setMeta('meta-langage',fmt(d.known)+' mots');
  paint('language-stats',[d.audible,d.known,d.spoken,d.composed].join(),()=>[row('Phrases entendues',fmt(d.audible)),row('Mots compris',fmt(d.known)),row('Mots répétés',fmt(d.spoken)),row('Phrases formées',fmt(d.composed))]);
  const ph=d.phrases||[];
  paint('composed-phrases',ph.map(p=>p.at).join(),()=>ph.length?ph.map(p=>el('li',{},el('strong',{textContent:'« '+p.text+' »'}),el('small',{textContent:stamp(p.at)}))):[el('li',{className:'muted',textContent:'Aucune phrase encore.'})]);
}

// ---------- page : sa sociabilité ----------
function humeur(p){if(p.lie>.8)return 'dort';if(p.fatigue>.7)return 'fatigué';if(p.hunger>.65)return 'a faim';if((p.pleasure||0)>.2)return 'content';return 'calme';}
function renderEntourage(s){
  const people=[{...s.alex,id:'alex'},...s.people];
  setMeta('meta-personnes',fmt(people.length));
  const box=ui('people');
  // Néo d'abord, puis les autres du plus proche au plus lointain.
  const tries=[people[0],...people.slice(1).sort((x,y)=>(y.affinite||0)-(x.affinite||0))];
  for(const p of tries){
    let f=fiches.get(p.id);
    if(!f){
      f={act:el('small'),meta:el('span',{className:'meta'}),infos:el('div',{className:'stack'}),aff:el('div',{className:'stack'}),comp:el('div',{className:'stack'}),traits:el('div',{className:'bars'})};
      f.det=el('details',{className:'acc',dataset:{id:'p-'+p.id}});
      f.det.open=ouverts['p-'+p.id]??false;
      const sous=p.id==='alex'?[]:[panneau('pa-'+p.id,{titre:'Affinité avec Néo',sous:'Ce qui les rapproche',ouvert:true},f.aff)];
      f.det.append(el('summary',{},el('span',{className:'acc-t'},el('strong',{textContent:names[p.id]}),f.act),f.meta),
        el('div',{className:'acc-body accs'},el('div',{className:'acc-body'},f.infos),...sous,
          panneau('pk-'+p.id,{titre:'Compétences',sous:p.id==='alex'?'Ce qu’il a appris':'Ce qu’il ou elle sait faire'},f.comp),
          panneau('pc-'+p.id,{titre:'Caractère',sous:'Évolue avec ce qu’il vit'},f.traits)));
      fiches.set(p.id,f);
    }
    f.act.textContent=(p.vieux?'Âgé · ':'')+(p.activity||'—');
    const hu=humeur(p);
    f.meta.textContent=p.id==='alex'?hu:hu+' · affinité '+Math.round((p.affinite||0)*100);
    f.meta.className='meta '+(hu==='a faim'||hu==='fatigué'?'warm':hu==='content'?'good':'');
    const cle=[p.partage,p.baseWords,s.age,Math.round((p.affinite||0)*50),p.rencontres,(p.competences||[]).join()].join();
    if(f.cle!==cle){
      f.cle=cle;
      const top=p.caractere?Object.entries(p.caractere).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([k])=>el('span',{className:'chip off',textContent:TRAITS[k]})):[];
      f.infos.replaceChildren(el('div',{className:'chips'},...top),
        p.id==='alex'?row('Étape de vie',AGES[s.age]):row('Ce que Néo découvre',p.partage?'il le reçoit':'pas encore'),
        ...(p.baseWords?[row('Mots connus',fmt(p.baseWords))]:[]));
      f.aff.replaceChildren(humeurJauge('Affinité',p.affinite||0),row('Rencontres avec Néo',fmt(p.rencontres||0)));
      const comp=p.competences||[];
      f.comp.replaceChildren(...(comp.length?comp.map(c=>item(c,null,badge('sait faire','good'))):[empty(p.id==='alex'?'Rien encore : il découvre son corps.':'Rien encore : ce que Néo valide viendra ici.')]));
    }
    const ct=JSON.stringify(Object.values(p.caractere||{}).map(v=>Math.round(v*50)));
    if(f.ct!==ct){f.ct=ct;f.traits.replaceChildren(...Object.entries(TRAITS).map(([k,l])=>niveauJauge(l,p.caractere?.[k]||0)));}
  }
  const ordre=tries.map(p=>p.id).join();
  if(box.dataset.ordre!==ordre){box.dataset.ordre=ordre;for(const p of tries)box.append(fiches.get(p.id).det);}
  renderRelation(s);
  const kind=ui('interaction-filter').value,events=(s.activityData?.events||[]).filter(e=>!kind||e.kind===kind).slice(0,40);
  paint('interaction-lines',kind+events.map(e=>e.ticks).join(),()=>events.length?events.map(e=>el('li',{},document.createTextNode(e.message),el('small',{textContent:(GENRES[e.kind]||'')+' · '+stamp(e.ticks/120)}))):[el('li',{textContent:'Rien pour ce filtre.'})]);
  const k=s.kitchen||{},c=s.commerce;
  paint('household',JSON.stringify([k.ingredients,k.meals,c,s.acces]),()=>[row('Provisions à la maison',fmt(k.ingredients)+' ingrédients'),row('Repas prêts',fmt(k.meals)),
    ...(c?[row('Stock du commerce aujourd’hui',fmt(c.stock)),row('Droit par personne et par jour',fmt(c.quota)),row('Courses rapportées',fmt(c.visites))]:[]),
    row('Amis à la maison',s.acces?.amisAccompagnes?'seulement accompagnés ('+fmt(s.acces.visites)+' visites)':'pas encore')]);
  const d=s.dialogue;
  ui('listening-summary').textContent=fmt(d.audible)+' phrases entendues par Néo · '+fmt(d.known)+(d.known>1?' mots compris':' mot compris')+(archiveStatus==='indisponible'?' · historique local indisponible':'');
}
const fiches=new Map();
// Liens : on choisit deux personnes, les statistiques de leur relation apparaissent.
let listesLiens=false;
function renderRelation(s){
  const A=ui('lien-a'),B=ui('lien-b');
  if(!listesLiens){
    const ids=['alex',...s.people.map(p=>p.id)];
    for(const sel of [A,B])sel.replaceChildren(new Option(sel===A?'Premier personnage…':'Second personnage…',''),...ids.map(id=>new Option(names[id],id)));
    A.value='alex';listesLiens=true;
  }
  const a=A.value,b=B.value;
  const r=a&&b&&a!==b?s.relationships?.[[a,b].sort().join(':')]:null;
  if(!a||!b||a===b){paint('relationship-summary','choix',()=>[empty('Choisissez deux personnes différentes.')]);ui('relationship-history').replaceChildren();return;}
  if(!r){paint('relationship-summary','aucun'+a+b,()=>[empty(names[a]+' et '+names[b]+' ne se sont pas encore vraiment rencontrés.')]);ui('relationship-history').replaceChildren();return;}
  const label=r.couple?'En couple':r.romance>20?'Attirance':r.bond>=45?'Proches':'Se connaissent';
  paint('relationship-summary',JSON.stringify([r.a,r.b,r.bond,r.tendresse,r.attirance,r.complicite,r.couple,r.met]),()=>[humeurJauge('Lien',r.bond/100),
    row('Ce qu’ils sont',label),row('Rencontres',fmt(r.met||0)),
    ...(r.tendresse||r.attirance||r.complicite?[niveauJauge('Tendresse',(r.tendresse||0)/100),niveauJauge('Attirance',(r.attirance||0)/100),niveauJauge('Complicité',(r.complicite||0)/100)]:[]),
    ...(r.separations?[row('Séparations',fmt(r.separations))]:[])]);
  const ev=r.history.slice(-30).reverse();
  paint('relationship-history',r.a+r.b+ev.length+(ev[0]?.at||''),()=>ev.length?ev.map(e=>el('li',{},document.createTextNode(e.event),el('small',{textContent:stamp(e.at)}))):[el('li',{textContent:'Rien pour l’instant.'})]);
}

// ---------- page : ses nuits ----------
function renderNuits(s){
  const n=s.brain?.nuits||[];
  const tot=k=>n.reduce((a,x)=>a+x[k],0);
  const totals=[['Nuits',n.length,'derniers sommeils gardés'],['Liens renforcés',tot('renforces'),'ce qui allait ensemble'],['Liens effacés',tot('effaces'),'trop faibles pour compter'],
    ['Souvenirs fusionnés',tot('fusionnes'),'redondances retirées'],['Choses oubliées',tot('oublies'),'essais ratés, causes inutiles'],['Rêves',n.reduce((a,x)=>a+x.reves.length,0),'devenus des envies']];
  paint('nuits-total',JSON.stringify(totals),()=>totals.map(([nom,v,desc])=>el('div',{className:'region'},el('strong',{textContent:fmt(v)}),el('span',{textContent:nom}),el('small',{textContent:desc}))));
  setMeta('meta-nuits',fmt(n.length));
  paint('nuits',n.map(x=>x.t).join(),()=>n.length?n.map(x=>panneau('nuit-'+x.t,{titre:'Nuit du '+stamp(x.t).replace(/, .*/,''),sous:'endormi vers '+stamp(x.t).replace(/^.*, /,'')+' · '+x.reves.length+' rêve'+(x.reves.length>1?'s':''),meta:fmt(x.renforces)+' renforcés',metaKind:'good'},
    el('div',{className:'stack'},row('Liens renforcés',fmt(x.renforces)),row('Liens effacés',fmt(x.effaces)),row('Souvenirs fusionnés',fmt(x.fusionnes)),row('Choses oubliées',fmt(x.oublies))),
    ...x.reves.map(r=>el('p',{className:'dream',textContent:'Il rêve de '+r.elements.join(', puis de ')+'.'+(r.envie?' Au réveil, il a envie d’aller voir '+r.envie+'.':'')})))):[empty('Néo n’a pas encore dormi.')]);
}

// ---------- navigation ----------
let lastPaint=-1e9,lastLine=0;
function update(state,force=false){
  current=state;if(!state)return;
  const now=performance.now();
  if(!force&&now-lastPaint<400)return;
  lastPaint=now;
  const t=Math.floor(state.ticks/120*TIME_SCALE);
  ui('clock').replaceChildren('An '+(1+Math.floor(t/86400/365))+' · Jour '+(1+Math.floor(t/86400)%365),el('span',{className:'heure',textContent:' · '+String(Math.floor(t/3600)%24).padStart(2,'0')+' h'}));
  if(page==='monde')renderMonde(state);
  if(page==='cerveau')renderCerveau(state);
  if(page==='croissance')renderCroissance(state);
  if(page==='nuits')renderNuits(state);
  if(page==='decouvertes')renderDecouvertes(state);
  if(page==='sociabilite'){
    renderEntourage(state);
    const last=state.dialogue.lines.at(-1)?.id||0;
    if(force||before===Infinity&&last!==lastLine)renderTranscript();
    lastLine=last;
  }
}
function showPage(scroll){
  const h=location.hash.slice(1);
  page=PAGES[ANCIENNES[h]||h]?(ANCIENNES[h]||h):'monde';
  ui('main').dataset.page=page;
  ui('page-title').textContent=PAGES[page];
  document.title=PAGES[page]+' — Simulacre';
  for(const a of document.querySelectorAll('.tabs a'))a.hash==='#'+page?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');
  for(const k of Object.keys(PAGES))ui('page-'+k).hidden=k!==page;
  if(scroll)scrollTo(0,0);
  for(const box of document.querySelectorAll('[data-key]'))delete box.dataset.key;
  update(current,true);
}
export function setupDashboard(personNames){
  names=personNames;
  for(const [id,n] of Object.entries(names))ui('speaker-filter').append(new Option(n,id));
  ui('vocabulary-search').oninput=()=>current&&renderVocabulary(current.dialogue);
  ui('speaker-filter').onchange=resetTranscript;
  ui('interaction-filter').onchange=()=>update(current,true);
  ui('lien-a').onchange=ui('lien-b').onchange=()=>current&&renderRelation(current);
  ui('older-lines').onclick=()=>{const b=Number(ui('older-lines').dataset.before);if(b){stack.push(before);before=b;renderTranscript();}};
  ui('live-lines').onclick=resetTranscript;
  restaurer();
  addEventListener('hashchange',()=>showPage(true));
  showPage(false);
  return {capture,clearHistory,archiveReady,update};
}
