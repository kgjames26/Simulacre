// Interface : quatre pages simples. Toutes les données viennent de la simulation ; rien n'est calculé ici.
const ui=id=>document.getElementById(id);
const number=new Intl.NumberFormat('fr-BE');
const fmt=v=>number.format(v??0);
const pct=v=>Math.round((v||0)*100)+' %';
export const TIME_SCALE=144;           // 1 jour fictif = 10 minutes de simulation
export const AGES=['Nourrisson','Bébé','Petit enfant','Enfant','Grand enfant','Jeune ado','Ado','Jeune homme','Homme'];
const MARCHE=['Se redresser','Ramper','Tenir debout','Premiers pas','Marcher'];
const PAGES={monde:'Le monde',cerveau:'Son cerveau',croissance:'Sa croissance',entourage:'Son entourage',nuits:'Ses nuits'};
const ANCIENNES={apprend:'cerveau',grandir:'croissance',paroles:'entourage',proches:'entourage',ensemble:'monde'};
const GENRES={social:'Relation',play:'Jeu',food:'Repas',sleep:'Sommeil',object:'Objet',care:'Soin',limite:'Limite'};
const VERBES={pousser:'Pousser',tirer:'Tirer',saisir:'Prendre',frapper:'Frapper',tourner:'Tourner',monter:'Monter sur',grimper:'Grimper sur',sauter:'Sauter sur'};
const EFFETS={mou:'c’est mou',soi_monte:'on peut s’y installer',lumiere:'ça s’allume',bruit:'ça fait du bruit',objet_bouge:'ça bouge',papier:'ça se feuillette',
  eau:'de l’eau coule',chaud:'c’est chaud',froid:'c’est froid',nourriture:'ça se mange',gout:'ça a du goût',perles:'les perles glissent',roues:'les roues tournent',
  mal:'ça fait mal',passage:'on peut passer',rebond:'ça rebondit',hauteur:'on monte haut',glisse:'ça glisse',balance:'ça se balance',tient:'on peut s’accrocher',
  effort:'il faut forcer',outil:'ça se prend en main',vivant:'c’est vivant',doux:'c’est doux',rond:'c’est rond',ecrit:'il y a des signes'};
const BESOINS={faim:'la faim',soif:'la soif',fatigue:'la fatigue',hygiene:'le besoin de se laver'};
const TRAITS={curiosite:'Curiosité',perseverance:'Persévérance',prudence:'Prudence',sociabilite:'Sociabilité',empathie:'Empathie',creativite:'Créativité',independance:'Indépendance',patience:'Patience',optimisme:'Optimisme',leadership:'Leadership'};
const CAPACITES={equilibre:'Équilibre',course:'Course',force:'Force',endurance:'Endurance'};
const cap=t=>t?t.charAt(0).toUpperCase()+t.slice(1):'';
const effets=l=>(l||[]).map(e=>EFFETS[e]||e).join(', ')||'rien de visible';
const stamp=sec=>{const t=Math.max(0,Math.floor(sec*TIME_SCALE));return 'Jour '+fmt(1+Math.floor(t/86400))+', '+String(Math.floor(t/3600)%24).padStart(2,'0')+' h '+String(Math.floor(t/60)%60).padStart(2,'0');};

const el=(tag,props={},...kids)=>{const {dataset,...rest}=props;const n=Object.assign(document.createElement(tag),rest);if(dataset)Object.assign(n.dataset,dataset);n.append(...kids.filter(k=>k!=null));return n;};
const row=(label,value)=>el('div',{className:'row'},el('span',{textContent:label}),el('strong',{textContent:value}));
const empty=text=>el('p',{className:'empty',textContent:text});
const badge=(text,kind='')=>el('span',{className:'badge '+kind,textContent:text});
const item=(title,sub,right)=>el('div',{className:'item'},el('strong',{textContent:title}),right||null,sub?el('small',{textContent:sub}):null);
function meter(label,value,warn){
  const track=el('div',{className:'track'+(warn?' warn':'')},el('i',{style:'width:'+Math.round(Math.max(0,Math.min(1,value))*100)+'%'}));
  return el('div',{className:'meter'},el('span',{textContent:label}),track,el('b',{textContent:pct(value)}));
}
// Jauge lisible d'un coup d'œil : tête triste à gauche, tête heureuse à droite, la barre entre les deux (plus elle est pleine, mieux c'est).
function humeurJauge(label,bien){
  const v=Math.max(0,Math.min(1,bien));
  const track=el('div',{className:'track'+(v<.35?' warn':'')},el('i',{style:'width:'+Math.round(v*100)+'%'}));
  return el('div',{className:'meter face',title:label+' : '+(v>.66?'ça va bien':v>.35?'moyen':'ça ne va pas')},el('span',{textContent:label}),
    el('span',{className:'tete',textContent:'☹️'}),track,el('span',{className:'tete',textContent:'😊'}));
}
// Ne repeint un bloc que si son contenu a changé.
function paint(id,key,build){const box=ui(id);if(!box||box.dataset.key===key)return;box.dataset.key=key;box.replaceChildren(...build());}

let names={},page='monde',current=null;

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
  if(n!==request||page!=='entourage')return;
  const rows=list.slice(0,PAGE_SIZE);
  paint('conversation-lines',rows.map(l=>l.id).join(','),()=>rows.length?rows.map(l=>{
    const who=names[l.speaker]||l.speaker,to=names[l.listener];
    return el('li',{},el('strong',{textContent:to?who+' → '+to:who}),document.createTextNode(' '+l.text),
      el('small',{textContent:stamp(l.at)+(l.speaker==='alex'?'':l.heardByNéo?' · Néo entend':' · trop loin pour Néo')}));
  }):[el('li',{textContent:'Aucune parole pour l’instant.'})]);
  ui('older-lines').hidden=list.length<=PAGE_SIZE;
  ui('older-lines').dataset.before=rows.at(-1)?.id||'';
  ui('live-lines').hidden=!stack.length;
}
const resetTranscript=()=>{before=Infinity;stack=[];renderTranscript();};

// ---------- page : le monde ----------
function renderMonde(s){
  const a=s.alex,b=s.brain,z=s.activityData?.zone;
  ui('age').textContent=AGES[s.age];
  if(z)ui('zone-chip').textContent='Permis : '+z.liste[z.niveau].nom;
  paint('neo-meters',[a.hunger,a.fatigue,a.thirst,a.pleasure,b?.emotions.confiance].map(v=>Math.round((v||0)*20)).join(),()=>[
    humeurJauge('Rassasié',1-a.hunger),humeurJauge('Reposé',1-a.fatigue),humeurJauge('Désaltéré',1-(a.thirst??0)),
    humeurJauge('Bien-être',a.pleasure||0),humeurJauge('Confiance',b?.emotions.confiance??.4)]);
  if(b){
    const sure=b.savoir.filter(c=>c.statut==='confirme').slice(0,4);
    paint('latest-understood',sure.map(c=>c.action+c.cible).join(),()=>sure.length?sure.map(c=>el('li',{textContent:(VERBES[c.action]||cap(c.action))+' '+c.cible+' : '+effets(c.effet)})):[el('li',{className:'muted',textContent:'Rien encore : il observe et essaie.'})]);
  }
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
    ['Social',b.personnes,'personnes connues · leadership '+pct(b.leadership)],['Émotions',Math.round(b.emotions.confiance*100)+' %','confiance en lui'],['Envies',b.envies,'questions et projets'],
    ['Associations',c.liens,c.deductions+' idées · '+c.confirmees+' vérifiées',true]];
  paint('regions',JSON.stringify(regions),()=>regions.map(([nom,n,desc,hub])=>el('div',{className:'region'+(hub?' hub':''),dataset:{empty:String(!n||n==='0 %')}},el('strong',{textContent:typeof n==='number'?fmt(n):n}),el('span',{textContent:nom}),el('small',{textContent:desc}))));
  paint('brain-causes',JSON.stringify(b.savoir.slice(0,12)),()=>b.savoir.length?b.savoir.slice(0,12).map(k=>{
    const [t,kind]=STATUTS[k.statut]||[k.statut,''];
    return item((VERBES[k.action]||cap(k.action))+' '+k.cible,'→ '+effets(k.effet)+' · '+k.reussites+' sur '+k.essais+' essais',badge(t,kind));
  }):[empty('Pas encore. Il doit d’abord essayer des gestes sur ce qui l’entoure.')]);
  paint('brain-ideas',JSON.stringify(c.idees.slice(0,10)),()=>c.idees.length?c.idees.slice(0,10).map(i=>{
    const [t,kind]=IDEES[i.statut]||[i.statut,''];
    return item(ideeTexte(i),'croise : '+i.regions.join(' + '),badge(t,kind));
  }):[empty('Pas encore d’idée : il lui faut d’abord vivre des choses.')]);
  const g=b.gestes;
  paint('brain-gestures',JSON.stringify(g),()=>[...g.innes.map(x=>el('span',{className:'chip off',textContent:cap(x)+' · inné'})),
    ...g.appris.map(x=>el('span',{className:'chip',textContent:cap(x)+' · appris'})),...g.enCours.map(x=>el('span',{className:'chip warm',textContent:cap(x)+' · il essaie'}))]);
  paint('brain-capacities',JSON.stringify(b.capacites),()=>Object.entries(CAPACITES).map(([k,l])=>meter(l,b.capacites[k]||0)));
  paint('brain-challenges',JSON.stringify(b.defis),()=>b.defis.map(d=>item(d.cible,d.reussites?'réussi '+d.reussites+' fois sur '+d.essais:'pas encore réussi ('+d.essais+' essais)',badge(d.reussites?'il y arrive':'trop dur',d.reussites?'good':'warm'))));
  const wishes=[...b.questions.map(q=>item(q.type==='jamais_essaye'?'Que faire avec '+q.ref+' ?':q.type==='surprise'?'Pourquoi '+q.ref+' a surpris ?':'Ça ne marche plus avec '+q.ref,null,badge('question'))),
    ...b.objectifs.filter(o=>o.statut==='actif').map(o=>item('Aller essayer '+o.cible,null,badge('envie','warm'))),
    ...(b.habitudes?[item(b.habitudes+' habitude'+(b.habitudes>1?'s':'')+' prise'+(b.habitudes>1?'s':''),null,badge('acquis','good'))]:[])];
  paint('brain-wishes',wishes.map(w=>w.textContent).join('|'),()=>wishes.length?wishes:[empty('Rien de précis pour l’instant : il explore au hasard.')]);
  const e=b.emotions;
  paint('brain-mood',[e.valence,e.peur,e.frustration,e.ennui].map(v=>Math.round(v*20)).join(),()=>[meter('Se sent bien',Math.max(0,e.valence)),meter('Peur',e.peur,true),meter('Frustration',e.frustration,true),meter('Ennui',e.ennui,true)]);
  if(b.caractere)paint('brain-traits',JSON.stringify(Object.values(b.caractere).map(v=>Math.round(v*50))),()=>Object.entries(TRAITS).map(([k,l])=>meter(l,b.caractere[k]||0)));
  renderVocabulary(s.dialogue);
  paint('brain-things',JSON.stringify(b.objets),()=>b.objets.length?b.objets.map(o=>el('div',{},el('strong',{textContent:o.nom}),el('small',{textContent:'vu '+o.vu+' fois'+(o.essais?' · essayé '+o.essais+' fois':' · jamais touché')+(o.mot?' · « '+o.mot+' »':'')}))):[empty('Rien pour l’instant.')]);
}
const norm=v=>v.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu,'');
function renderVocabulary(d){
  const words=d.vocabulary||[],q=norm(ui('vocabulary-search').value.trim());
  ui('vocabulary-count').textContent='· '+fmt(words.length);
  const vis=words.filter(w=>norm(w.word).includes(q)).sort((a,b)=>a.word.localeCompare(b.word,'fr'));
  paint('vocabulary-list',q+'|'+vis.map(w=>w.word+w.heard).join(),()=>vis.length?vis.map(w=>el('li',{},el('strong',{textContent:w.word}),el('small',{textContent:w.context+' · entendu '+w.heard+' fois'}))):[el('li',{textContent:words.length?'Aucun mot ne correspond.':'Aucun mot compris pour l’instant.'})]);
}

// ---------- page : sa croissance ----------
function renderCroissance(s){
  paint('age-timeline',String(s.age),()=>AGES.map((n,i)=>el('li',{dataset:{state:i<s.age?'done':i===s.age?'active':'later'}},n,el('small',{textContent:i<s.age?'franchi':i===s.age?'maintenant':'à venir'}))));
  const etapes=s.brain?.etapes||[];
  paint('stage-goals',JSON.stringify(etapes),()=>etapes.length?etapes.map(e=>{
    const box=el('details',{className:'etape',open:e.etat==='en cours',dataset:{etat:e.etat}});
    const titre=e.etat==='fini'?'accompli'+(e.fin!=null?' · '+stamp(e.fin).replace(/, .*/,''):''):e.etat;
    box.append(el('summary',{},el('strong',{textContent:e.nom}),badge(titre,e.etat==='fini'?'good':e.etat==='en cours'?'warm':'')));
    for(const [type,nom] of [['physique','Son corps'],['mental','Sa tête']]){
      const liste=e.objectifs.filter(g=>g.type===type);
      if(!liste.length)continue;
      box.append(el('p',{className:'eyebrow',textContent:nom}),...liste.map(g=>item(g.label,null,badge(g.done?'✓ acquis':e.etat==='à venir'?'prévu':'pas encore',g.done?'good':''))));
    }
    if(!e.objectifs.length)box.append(empty('Adulte : il continue d’apprendre sans fin.'));
    return box;
  }):[empty('Évaluation en cours…')]);
  const z=s.activityData?.zone;
  if(z)paint('zones',JSON.stringify(z),()=>z.liste.map(x=>el('li',{dataset:{open:String(x.ouvert)}},el('span',{textContent:cap(x.nom)}),badge(x.ouvert?'permis':'dès '+(AGES[x.age]||'plus tard').toLowerCase(),x.ouvert?'good':''))));
  const m=s.activityData?.motor||[];
  paint('motor-steps',JSON.stringify(m)+s.skill,()=>m.map((r,i)=>el('div',{className:'step',dataset:{state:r.mastered?'done':i===s.skill?'active':'later'}},
    el('strong',{textContent:MARCHE[i]}),el('small',{textContent:r.mastered?'acquis':i===s.skill?r.recent+'/6 réussites récentes':'à venir'}),el('small',{textContent:fmt(r.attempts)+' essais'}))));
  const d=s.dialogue;
  paint('language-stats',[d.audible,d.known,d.spoken,d.composed].join(),()=>[row('Phrases entendues',fmt(d.audible)),row('Mots compris',fmt(d.known)),row('Mots répétés',fmt(d.spoken)),row('Phrases formées',fmt(d.composed))]);
  const ph=d.phrases||[];
  paint('composed-phrases',ph.map(p=>p.at).join(),()=>ph.length?ph.map(p=>el('li',{},el('strong',{textContent:'« '+p.text+' »'}),el('small',{textContent:stamp(p.at)}))):[el('li',{className:'muted',textContent:'Aucune phrase encore.'})]);
}

// ---------- page : son entourage ----------
function humeur(p){if(p.lie>.8)return 'dort';if(p.fatigue>.7)return 'fatigué';if(p.hunger>.65)return 'a faim';if((p.pleasure||0)>.2)return 'content';return 'calme';}
function renderEntourage(s){
  const people=[{...s.alex,id:'alex'},...s.people];
  paint('people',people.map(p=>[p.id,p.activity,humeur(p),p.partage,p.vieux,Object.values(p.caractere||{}).map(v=>Math.round(v*40)).join('')].join()).join('|'),()=>people.map(p=>{
    const info=p.id==='alex'?badge(AGES[s.age]):p.partage?badge('reçoit ses découvertes','good'):badge('ne reçoit rien encore');
    return el('article',{className:'person'},el('header',{},el('h3',{textContent:names[p.id]+(p.vieux?' · âgé':'')}),badge(humeur(p),'')),
      el('p',{textContent:p.activity||'—'}),meter('Leadership',p.leadership||0),
      p.caractere?el('div',{className:'chips'},...Object.entries(p.caractere).filter(([k])=>k!=='leadership').sort((x,y)=>y[1]-x[1]).slice(0,3).map(([k])=>el('span',{className:'chip off',textContent:TRAITS[k]}))):null,
      p.caractere?el('details',{className:'traits'},el('summary',{textContent:'Caractère'}),...Object.entries(TRAITS).map(([k,l])=>meter(l,p.caractere[k]||0))):null,info);
  }));
  renderRelation(s);
  const kind=ui('interaction-filter').value,events=(s.activityData?.events||[]).filter(e=>!kind||e.kind===kind).slice(0,40);
  paint('interaction-lines',kind+events.map(e=>e.ticks).join(),()=>events.length?events.map(e=>el('li',{},document.createTextNode(e.message),el('small',{textContent:(GENRES[e.kind]||'')+' · '+stamp(e.ticks/120)}))):[el('li',{textContent:'Rien pour ce filtre.'})]);
  const k=s.kitchen||{},c=s.commerce;
  paint('household',JSON.stringify([k.ingredients,k.meals,c,s.acces]),()=>[row('Provisions à la maison',fmt(k.ingredients)+' ingrédients'),row('Repas prêts',fmt(k.meals)),
    ...(c?[row('Stock du commerce aujourd’hui',fmt(c.stock)),row('Droit par personne et par jour',fmt(c.quota)),row('Courses rapportées',fmt(c.visites))]:[]),
    row('Amis à la maison',s.acces?.amisAccompagnes?'seulement accompagnés ('+fmt(s.acces.visites)+' visites)':'pas encore')]);
  const d=s.dialogue;
  ui('listening-summary').textContent=fmt(d.audible)+' phrases entendues par Néo · '+fmt(d.known)+' mots compris'+(archiveStatus==='indisponible'?' · historique local indisponible':'');
}
let relationKeys='';
function renderRelation(s){
  const pairs=Object.entries(s.relationships||{}).sort(([,a],[,b])=>Number(b.couple)-Number(a.couple)||b.bond-a.bond);
  const select=ui('relationship-filter'),keys=pairs.map(([id])=>id).join();
  if(keys!==relationKeys){const v=select.value;select.replaceChildren(...pairs.map(([id,r])=>new Option(names[r.a]+' et '+names[r.b],id)));if(pairs.some(([id])=>id===v))select.value=v;relationKeys=keys;}
  const r=s.relationships?.[select.value]||pairs[0]?.[1];
  if(!r){paint('relationship-summary','0',()=>[empty('Aucun lien pour l’instant.')]);ui('relationship-history').replaceChildren();return;}
  const label=r.couple?'En couple':r.romance>20?'Attirance':r.bond>=45?'Proches':'Se connaissent';
  paint('relationship-summary',JSON.stringify([r.a,r.b,r.bond,r.tendresse,r.attirance,r.complicite,r.couple]),()=>[meter(label,r.bond/100),
    ...(r.tendresse||r.attirance||r.complicite?[meter('Tendresse',(r.tendresse||0)/100),meter('Attirance',(r.attirance||0)/100),meter('Complicité',(r.complicite||0)/100)]:[]),
    ...(r.separations?[row('Séparations',fmt(r.separations))]:[])]);
  const ev=r.history.slice(-30).reverse();
  paint('relationship-history',r.a+r.b+ev.length+(ev[0]?.at||''),()=>ev.map(e=>el('li',{},document.createTextNode(e.event),el('small',{textContent:stamp(e.at)}))));
}

// ---------- page : ses nuits ----------
function renderNuits(s){
  const n=s.brain?.nuits||[];
  const tot=k=>n.reduce((a,x)=>a+x[k],0);
  const totals=[['Nuits',n.length,'derniers sommeils gardés'],['Liens renforcés',tot('renforces'),'ce qui allait ensemble'],['Liens effacés',tot('effaces'),'trop faibles pour compter'],
    ['Souvenirs fusionnés',tot('fusionnes'),'redondances retirées'],['Choses oubliées',tot('oublies'),'essais ratés, causes inutiles'],['Rêves',n.reduce((a,x)=>a+x.reves.length,0),'devenus des envies']];
  paint('nuits-total',JSON.stringify(totals),()=>totals.map(([nom,v,desc])=>el('div',{className:'region'},el('strong',{textContent:fmt(v)}),el('span',{textContent:nom}),el('small',{textContent:desc}))));
  paint('nuits',n.map(x=>x.t).join(),()=>n.length?n.map(x=>el('article',{className:'card night'},
    el('div',{className:'card-head'},el('h3',{textContent:'Nuit du '+stamp(x.t).replace(/, .*/,'')}),el('small',{textContent:'endormi vers '+stamp(x.t).replace(/^.*, /,'')})),
    el('div',{className:'chips'},el('span',{className:'chip',textContent:fmt(x.renforces)+' liens renforcés'}),el('span',{className:'chip off',textContent:fmt(x.effaces)+' effacés'}),
      el('span',{className:'chip off',textContent:fmt(x.fusionnes)+' souvenirs fusionnés'}),el('span',{className:'chip off',textContent:fmt(x.oublies)+' oubliés'})),
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
  ui('clock').textContent='Année '+(1+Math.floor(t/86400/365))+' · Jour '+(1+Math.floor(t/86400)%365)+' · '+String(Math.floor(t/3600)%24).padStart(2,'0')+' h';
  if(page==='monde')renderMonde(state);
  if(page==='cerveau')renderCerveau(state);
  if(page==='croissance')renderCroissance(state);
  if(page==='nuits')renderNuits(state);
  if(page==='entourage'){
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
  ui('relationship-filter').onchange=()=>current&&renderRelation(current);
  ui('older-lines').onclick=()=>{const b=Number(ui('older-lines').dataset.before);if(b){stack.push(before);before=b;renderTranscript();}};
  ui('live-lines').onclick=resetTranscript;
  addEventListener('hashchange',()=>showPage(true));
  showPage(false);
  return {capture,clearHistory,archiveReady,update};
}
