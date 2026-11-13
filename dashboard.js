const ui=id=>document.getElementById(id);
const number=new Intl.NumberFormat('fr-BE');
const fmt=value=>number.format(value??0);
const percent=value=>value==null?'—':Math.round(value*100)+' %';
const ageNames=['Nourrisson','Bébé','Petit enfant','Enfant','Grand enfant','Jeune ado','Ado','Jeune homme','Homme'];
const motorNames=['Se redresser','Ramper','Tenir debout','Premiers pas','Marche'];
const countLabels={life:'Vie quotidienne',cognition:'Découvertes',play:'Expériences de jeu',social:'Interactions sociales'};
const eventLabels={social:'Relation',play:'Jeu',food:'Repas',sleep:'Sommeil',object:'Objet ou porte'};
const pageNames={ensemble:'Vue d’ensemble',monde:'Vue plein écran',statistiques:'Statique Néo',
  conversations:'Conversations',developpement:'Développement',relations:'Humeurs et relations'};
const tabLinks=[...document.querySelectorAll('.pages a')];
const detailPages=Object.keys(pageNames).slice(2);
const pageSize=48;
let page, current, historyBefore=Infinity, historyStack=[], historyRequest=0, displayedLines='';
let archive, recent=new Map(), latestArchived=0, archiveStatus='opening', pantrySignature='';

const node=(tag,value,css)=>{
  const item=document.createElement(tag);
  if(value!=null)item.textContent=value;
  if(css)item.className=css;
  return item;
};
function row(label,value){
  const element=node('div',null,'line');
  element.append(node('span',label),node('strong',value));
  return element;
}
function stamp(seconds){
  const total=Math.max(0,Math.floor(seconds));
  const clock=[Math.floor(total/3600)%24,Math.floor(total/60)%60,total%60]
    .map(part=>String(part).padStart(2,'0')).join(':');
  return 'J'+fmt(1+Math.floor(total/86400))+' · '+clock;
}
function stat(label,value){
  const item=node('article',null,'stat');
  item.append(node('strong',value),node('small',label));
  return item;
}
function archiveTransaction(mode,run){
  return new Promise((resolve,reject)=>{
    const transaction=archive.transaction('lines',mode);
    let result;
    transaction.oncomplete=()=>resolve(result);
    transaction.onabort=()=>reject(transaction.error);
    transaction.onerror=()=>reject(transaction.error);
    run(transaction.objectStore('lines'),value=>{result=value;});
  });
}
async function openArchive(){
  try{
    archive=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('alex-simulacre-conversations',2);
      request.onupgradeneeded=event=>{
        const store=event.oldVersion?request.transaction.objectStore('lines'):request.result.createObjectStore('lines',{keyPath:'id'});
        if(!store.indexNames.contains('speaker'))store.createIndex('speaker',['speaker','id']);
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Archive indisponible'));
    });
    latestArchived=await archiveTransaction('readonly',(store,done)=>{
      const request=store.openKeyCursor(null,'prev');
      request.onsuccess=()=>done(request.result?.key||0);
    });
    archiveStatus='ready';
  }catch{archive=null;archiveStatus='unavailable';}
  return latestArchived;
}
const archiveReady=openArchive();
function capture(lines){
  if(!lines?.length)return;
  const fresh=lines.filter(line=>line.id>latestArchived&&!recent.has(line.id));
  for(const line of lines)recent.set(line.id,line);
  while(recent.size>600)recent.delete(recent.keys().next().value);
  if(!fresh.length)return;
  archiveReady.then(async()=>{
    if(!archive)return;
    try{
      await archiveTransaction('readwrite',store=>{
        for(const line of fresh)store.put(line);
      });
      latestArchived=Math.max(latestArchived,fresh.at(-1).id);
    }catch{archiveStatus='unavailable';}
  });
}
async function clearHistory(){
  await archiveReady;
  if(archive)await archiveTransaction('readwrite',store=>store.clear());
  recent.clear();
}
async function queryHistory(){
  const speaker=ui('speaker-filter').value, hearing=ui('hearing-filter').value;
  const before=historyBefore;
  const match=line=>line.id<before&&(!speaker||line.speaker===speaker)&&
    (!hearing||line.speaker!=='alex'&&line.heardByNéo===(hearing==='heard'));
  const entries=new Map([...recent.values()].reverse().filter(match).slice(0,pageSize+1).map(line=>[line.id,line]));
  if(archive){
    try{
      const older=await archiveTransaction('readonly',(store,done)=>{
        const range=speaker?IDBKeyRange.bound([speaker,0],[speaker,Number.isFinite(before)?before:Number.MAX_SAFE_INTEGER],false,true):
          Number.isFinite(before)?IDBKeyRange.upperBound(before,true):null;
        const request=(speaker?store.index('speaker'):store).openCursor(range,'prev');
        const results=[];
        request.onsuccess=()=>{
          const cursor=request.result;
          if(!cursor||results.length>pageSize){done(results);return;}
          if(match(cursor.value))results.push(cursor.value);
          cursor.continue();
        };
      });
      for(const line of older)entries.set(line.id,line);
    }catch{archiveStatus='unavailable';}
  }
  return [...entries.values()].sort((a,b)=>b.id-a.id).slice(0,pageSize+1);
}
let names={};
async function renderTranscript(){
  const request=++historyRequest;
  const list=await queryHistory();
  if(request!==historyRequest||page!=='conversations')return;
  const rows=list.slice(0,pageSize);
  const fingerprint=rows.map(line=>line.id).join(',');
  if(fingerprint!==displayedLines||!ui('conversation-lines').children.length){
    displayedLines=fingerprint;
    ui('conversation-lines').replaceChildren(...(rows.length?rows.map(line=>{
      const item=node('li');
      const from=names[line.speaker]||line.speaker;
      const to=names[line.listener];
      item.append(node('strong',to?from+' → '+to:from),document.createTextNode(' · '+line.text));
      const range=line.speaker==='alex'?'':line.heardByNéo?' · Entendue par Néo':' · Hors de portée d’Néo';
      item.append(node('small',stamp(line.at)+range));
      return item;
    }):[node('li','Aucune réplique pour ce filtre.')]));
  }
  ui('older-lines').hidden=list.length<=pageSize;
  ui('older-lines').dataset.before=rows.at(-1)?.id||'';
  ui('live-lines').hidden=historyStack.length===0;
}
function resetHistoryPage(){
  historyBefore=Infinity;historyStack=[];
  renderTranscript();
}
function renderStats(state){
  const {counts,kitchen,activityData,dialogue}=state;
  ui('stats-grid').replaceChildren(...[
    ['Essais moteurs',fmt(state.trials)],['Progrès moteurs confirmés',fmt(state.pecm)],['Stabilité du dernier essai',state.score+' %'],
    ['Marche · essais confirmés',fmt(state.validated)],
    ...Object.entries(countLabels).map(([key,label])=>[label,fmt(counts[key])]),
    ['Répliques entendues par Néo',fmt(dialogue.audible)],['Mots associés',fmt(dialogue.known)],
    ['Imitations de Néo',fmt(dialogue.spoken)],['Temps simulé',stamp(state.ticks/120)]
  ].map(([label,value])=>stat(label,value)));
  ui('fridge-stock').textContent=(kitchen.pantry?.length||0)+' aliments · '+fmt(kitchen.ingredients)+' unités';
  const pantry=(kitchen.pantry||[]).slice().sort((a,b)=>a.group.localeCompare(b.group,'fr')||a.name.localeCompare(b.name,'fr'));
  const signature=pantry.map(food=>food.id+':'+food.stock).join('|');
  if(signature!==pantrySignature){pantrySignature=signature;ui('fridge-inventory').replaceChildren(...pantry.map(food=>{const item=node('div',null,'food-item');item.append(node('strong',food.name),node('small',food.group+' · '+food.stock));return item;}));}
  ui('last-meal').textContent=kitchen.lastMeal?'Dernier plat : '+kitchen.lastMeal+' ('+(kitchen.lastIngredients||[]).join(', ')+')':'Aucun plat préparé pour le moment.';
  ui('meal-stock').textContent=kitchen.meals;
  ui('oven-temp').textContent=Math.round(kitchen.ovenTemperature)+' °C';
  ui('meal-quality').textContent=percent(kitchen.lastQuality);
  ui('equipment-stats').replaceChildren(...[['Trampoline','trampoline'],['Toboggan','slide'],['Corde','rope']]
    .map(([label,key])=>row(label,fmt(activityData.equipment[key])+' utilisations')));
}
const alphabet=new Intl.Collator('fr-BE');
const normalizeWord=value=>value.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu,'');
let vocabularyKey='';
function renderVocabulary(dialogue){
  const words=dialogue.vocabulary||[];
  const search=normalizeWord(ui('vocabulary-search').value.trim());
  const key=JSON.stringify([search,words]);
  if(key===vocabularyKey)return;
  vocabularyKey=key;
  ui('vocabulary-count').textContent='· '+fmt(words.length);
  const visible=words.filter(entry=>normalizeWord(entry.word).includes(search))
    .sort((a,b)=>alphabet.compare(a.word,b.word));
  ui('vocabulary-list').replaceChildren(...(visible.length?visible.map(entry=>{
    const item=node('li');
    item.append(node('strong',entry.word),node('span',entry.context),
      node('small',fmt(entry.heard)+(entry.heard===1?' occurrence entendue':' occurrences entendues')));
    return item;
  }):[node('li',words.length?'Aucun mot ne correspond à cette recherche.':'Aucun mot confirmé pour l’instant.')]));
}
function renderDevelopment(state){
  ui('age-timeline').replaceChildren(...ageNames.map((name,i)=>{
    const stateKey=i<state.age?'done':i===state.age?'active':'later';
    const item=node('li',name);
    item.dataset.state=stateKey;
    if(i===state.age)item.setAttribute('aria-current','step');
    item.append(node('small',stateKey==='done'?'Franchi':stateKey==='active'?'Stade actuel':'À venir'));
    return item;
  }));
  ui('motor-grid').replaceChildren(...state.activityData.motor.map((record,i)=>{
    const item=node('article');
    const status=node('span',record.mastered?'Acquis':i===state.skill?'En cours':'À venir','badge');
    status.dataset.state=record.mastered?'done':'pending';
    item.append(node('h3',motorNames[i]),status,row('Essais',fmt(record.attempts)),row('Réussites',fmt(record.confirmed)));
    if(i===state.skill&&!record.mastered)item.append(row('Réussites récentes',record.recent+' / 6 requises'));
    return item;
  }));
  const gate=state.activityData.gate;
  const gates=gate?[
    ['Progrès moteurs confirmés',fmt(state.pecm)+' / '+fmt(gate.motor)],
    ...Object.entries(countLabels).filter(([key])=>gate[key]>0).map(([key,label])=>[label,fmt(state.counts[key])+' / '+fmt(gate[key])])
  ]:[['Stade final','Atteint']];
  ui('age-gates').replaceChildren(...gates.map(([label,value])=>row(label,value)));
  ui('language-stats').replaceChildren(row('Répliques entendues',fmt(state.dialogue.audible)),
    row('Mots compris',fmt(state.dialogue.known)),row('Imitations',fmt(state.dialogue.spoken)),
    row('Phrases composées',fmt(state.dialogue.composed)),
    row('Connaissances en mémoire',fmt(state.activityData.knowledgeCount)));
  ui('discoveries').replaceChildren(...state.activityData.discoveries.map(name=>node('li',name)));
  renderVocabulary(state.dialogue);
  const phrases=state.dialogue.phrases||[];
  ui('composed-phrases').replaceChildren(...(phrases.length?phrases.map(phrase=>{
    const item=node('li');
    item.append(node('strong',phrase.text),node('small',stamp(phrase.at)));
    return item;
  }):[node('li','Néo n’a encore composé aucune phrase.')]));

}
function mood(person,isNéo){
  if(person.lie>.8)return 'Au repos';
  if(person.pleasure>.18)return 'Content';
  if(person.fatigue>.7)return 'Fatigué';
  if(person.hunger>.65)return 'Affamé';
  if(isNéo&&person.activity?.startsWith('Perd'))return 'Déconcentré';
  if(person.activity?.includes('Explore'))return 'Curieux';
  return person.moving?'Actif':'Calme';
}
let relationOptions='';
function renderRelationshipHistory(state){
  const pairs=Object.entries(state.relationships||{}).sort(([,a],[,b])=>Number(b.couple)-Number(a.couple)||b.bond-a.bond);
  const select=ui('relationship-filter');
  const key=pairs.map(([id])=>id).join(',');
  if(key!==relationOptions){
    const selected=select.value;
    select.replaceChildren(...pairs.map(([id,r])=>new Option(names[r.a]+' et '+names[r.b],id)));
    if(pairs.some(([id])=>id===selected))select.value=selected;
    relationOptions=key;
  }
  const pair=state.relationships?.[select.value]||pairs[0]?.[1];
  if(!pair){
    ui('relationship-summary').replaceChildren();
    ui('relationship-history').replaceChildren(node('li','Aucun lien enregistré.'));
    return;
  }
  const label=pair.couple?'Couple établi':pair.romance?'Rapprochement affectif':pair.bond>=45?'Lien proche':'Connaissance';
  const meter=node('meter');meter.min=0;meter.max=100;meter.value=pair.bond;meter.setAttribute('aria-label','Solidité du lien');
  ui('relationship-summary').replaceChildren(row(label,pair.bond+' / 100'),meter);
  const events=pair.history.slice().reverse();
  ui('relationship-history').replaceChildren(...(events.length?events.map(event=>{
    const item=node('li',event.event);
    item.append(node('small',stamp(event.at)+' · Lien '+event.bond+' / 100'+(event.romance?' · Affinité '+event.romance+' / 100':'')));
    return item;
  }):[node('li','Aucun changement enregistré pour cette relation.')]));
}
function renderRelations(state){
  renderRelationshipHistory(state);
  const people=[{...state.alex,id:'alex'},...state.people];
  ui('people-grid').replaceChildren(...people.map(person=>{
    const item=node('article',null,'person');
    item.append(node('h3',names[person.id]),node('small',mood(person,person.id==='alex')),
      node('p',person.activity||'Observe', 'activity'));
    if(person.hunger!=null)item.append(row('Faim',percent(person.hunger)),row('Fatigue',percent(person.fatigue)),
      row('Plaisir',percent(person.pleasure??0)));
    if(person.id==='alex')item.append(row('Soif',percent(person.thirst)),row('Hygiène',percent(person.hygiene)));
    else{
      if(person.age!=null)item.append(row('Stade',ageNames[person.age]));
      item.append(row('Acquis partagés',fmt(person.inherited)));
      if(person.baseWords)item.append(row('Vocabulaire supplémentaire',fmt(person.baseWords)));
    }
    return item;
  }));
  const kind=ui('interaction-filter').value;
  const events=state.activityData.events.filter(event=>!kind||event.kind===kind).slice(0,50);
  ui('interaction-lines').replaceChildren(...(events.length?events.map(event=>{
    const item=node('li',event.message);
    item.append(node('small',eventLabels[event.kind]+' · '+stamp(event.ticks/120)));
    return item;
  }):[node('li','Aucune interaction pour le moment.')]));
}
let lastPaint=-Infinity, lastLine=0;
function update(state,force=false){
  current=state;
  if(!state)return;
  const time=performance.now();
  if(!force&&time-lastPaint<500)return;
  lastPaint=time;
  if(page==='statistiques')renderStats(state);
  if(page==='developpement')renderDevelopment(state);
  if(page==='relations')renderRelations(state);
  if(page==='conversations'){
    const {audible,known,spoken,lines}=state.dialogue;
    ui('listening-summary').textContent=fmt(audible)+' répliques entendues par Néo · '+fmt(known)+' mots associés · '+fmt(spoken)+' imitations'+
      (archiveStatus==='unavailable'?' · Archive locale indisponible':'');
    const last=lines.at(-1)?.id||0;
    if(force||historyBefore===Infinity&&last!==lastLine)renderTranscript();
    lastLine=last;
  }
}
function showPage(scroll=false){
  const requested=location.hash.slice(1);
  page=Object.hasOwn(pageNames,requested)?requested:'ensemble';
  ui('main').dataset.page=page;
  ui('page-title').textContent=pageNames[page];
  document.title=pageNames[page]+' — Simulacre';
  for(const tab of tabLinks){
    if(tab.hash==='#'+page)tab.setAttribute('aria-current','page');
    else tab.removeAttribute('aria-current');
  }
  for(const key of detailPages)ui('page-'+key).hidden=page!==key;
  ui('world-layout').hidden=page!=='ensemble'&&page!=='monde';
  ui('overview-details').hidden=page!=='ensemble';
  const sceneLink=ui('scene-link');
  sceneLink.hidden=ui('world-layout').hidden;
  sceneLink.href=page==='monde'?'#ensemble':'#monde';
  sceneLink.textContent=page==='monde'?'Retour à la vue d’ensemble':'Ouvrir la vue plein écran ↗';
  const active=tabLinks.find(tab=>tab.hasAttribute('aria-current'));
  const navigation=active.parentElement;
  const left=active.getBoundingClientRect().left-navigation.getBoundingClientRect().left;
  if(left<0)navigation.scrollLeft+=left-5;
  else if(left+active.offsetWidth>navigation.clientWidth)navigation.scrollLeft+=left+active.offsetWidth-navigation.clientWidth+5;
  if(scroll)window.scrollTo(0,0);
  update(current,true);
}
export function setupDashboard(personNames){
  names=personNames;
  for(const [id,name] of Object.entries(names))ui('speaker-filter').append(new Option(name,id));
  ui('vocabulary-search').oninput=()=>{if(current)renderVocabulary(current.dialogue);};
  ui('speaker-filter').onchange=resetHistoryPage;
  ui('hearing-filter').onchange=resetHistoryPage;
  ui('interaction-filter').onchange=()=>update(current,true);
  ui('relationship-filter').onchange=()=>current&&renderRelationshipHistory(current);
  ui('older-lines').onclick=()=>{
    const before=Number(ui('older-lines').dataset.before);
    if(before){historyStack.push(historyBefore);historyBefore=before;renderTranscript();}
  };
  ui('live-lines').onclick=resetHistoryPage;
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]');
    if(!link||!Object.hasOwn(pageNames,link.hash.slice(1))||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
    event.preventDefault();
    if(location.hash!==link.hash)history.pushState(null,'',link.hash);
    showPage(true);
  });
  window.addEventListener('hashchange',()=>showPage(true));
  window.addEventListener('popstate',()=>showPage(true));
  showPage();
  return {capture,clearHistory,archiveReady,update};
}
