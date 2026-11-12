// The parents share a phrase bank. Each entry has a context in the simulated world.
const ALEX_TOPICS = [
  ['tapis','le tapis',-8,2], ['canape','le canapé',-10,3.7],
  ['livre','le livre',-7.2,4.5], ['porte','la porte',-5.65,5.19],
  ['placard','le placard',-12.1,2.28], ['baie','la fenêtre',-1,1],
  ['frigo','le frigo',-1.23,.41], ['repas','le repas',-1.34,-1.53],
  ['assiette','l’assiette',-1.34,-1.53], ['four','le four',-1.0,-1.6],
  ['eau','l’eau',-9.44,6], ['douche','la douche',-4.4,4.85],
  ['tele','la télévision',-7.8,4.2], ['feu','le feu',-1.4,1.5],
  ['table','la table',-5,-3], ['jardin','le jardin',-2,5.8],
  ['trampoline','le trampoline',-2.07,6], ['couloir','le couloir',-7,0],
  ['mains','les mains',null,null], ['pieds','les pieds',null,null]
].map(([id,subject,x,z])=>({id,subject,x,z}));
const ALEX_OPENERS=[
  'Je regarde @', 'Tu vois @ ?', 'Je te montre @', 'Regarde @', 'On peut observer @',
  'Oui, je vois @', 'D’accord, je regarde @', 'Je vois aussi @', 'Oui, je remarque @', 'Je regarde à mon tour @'
];
const ALEX_ENDINGS=[
  '', ' un instant', ' avec toi', ' de près', ' de mon côté', ' pour bien observer',
  ' sans me presser', ' juste un peu', ' quelques secondes', ' encore une fois'
];
const ALEX_PHRASES=ALEX_TOPICS.flatMap(topic=>ALEX_OPENERS.map(frame=>
  ALEX_ENDINGS.map(ending=>frame.replace(' ?', '').replace('@',topic.subject)+ending+(frame.endsWith('?')?' ?':'.'))));
const alexTokens=text=>text.toLocaleLowerCase('fr').match(/[\p{L}]+/gu)||[];
// The learner receives words and weighted sensory observations in separate inputs.
function createLanguageMemory(){
  let samples=0, totals={}, evidence={}, orders={}, adjacent={}, lexicon={}, combinations={};
  const mode=cue=>cue.split(':',1)[0];
  function hear(text,observations,s,speaker){
    const tokens=alexTokens(text);
    const words=[...new Set(tokens.filter(word=>word.length>1))];
    const cues=Object.keys(observations);
    samples++;
    for(const cue of cues)totals[cue]=(totals[cue]||0)+observations[cue];
    for(let i=0;i<tokens.length;i++){
      for(let j=i+1;j<Math.min(tokens.length,i+4);j++){
        const from=tokens[i],to=tokens[j];
        if(from===to||from.length<2||to.length<2)continue;
        const following=orders[from]||=(Object.create(null));
        following[to]=(following[to]||0)+1;
        if(j===i+1){const pair=from+' '+to;adjacent[pair]=true;}
      }
    }
    for(const word of words){
      const record=evidence[word]||={heard:0,cues:{}};
      record.heard++;
      for(const cue of cues){
        const weight=observations[cue];
        if(weight<.45)continue;
        const match=record.cues[cue]||={support:0,voices:[],forms:[],contrasts:[],anchors:0};
        match.support+=weight;
        const edge=mode(cue)==='gesture'?tokens[0]:tokens.at(-1);
        if(edge===word)match.anchors=(match.anchors||0)+1;
        if(!match.voices.includes(speaker))match.voices.push(speaker);
        if(match.forms.length<5&&!match.forms.includes(text))match.forms.push(text);
        for(const other of cues){
          if(mode(other)!==mode(cue)&&observations[other]>=.75&&
             match.contrasts.length<5&&!match.contrasts.includes(other))match.contrasts.push(other);
        }
      }
      const ranked=Object.entries(record.cues).map(([cue,match])=>{
        const confidence=match.support/record.heard;
        const distinctiveness=confidence-totals[cue]/samples;
        return {cue,match,confidence,distinctiveness};
      }).sort((a,b)=>b.distinctiveness-a.distinctiveness);
      const best=ranked[0];
      if(!best)continue;
      const {cue,match,confidence,distinctiveness}=best;
      const existing=lexicon[word];
      const confirmed=match.support>=4.5&&confidence>=.67&&distinctiveness>=.21&&
        distinctiveness-(ranked[1]?.distinctiveness||0)>=.13&&
        (match.voices.length>=2||match.support>=7)&&match.forms.length>=3&&match.contrasts.length>=2&&match.anchors>=2;
      if(confirmed)lexicon[word]={cue,learnedAt:existing?.cue===cue?existing.learnedAt:s,confidence,heard:record.heard};
      else if(existing&&existing.cue===cue&&confidence>=.56)Object.assign(existing,{confidence,heard:record.heard});
      else if(existing&&(confidence<.56||existing.cue!==cue))delete lexicon[word];
    }
  }
  function compose(visible,s){
    const entries=Object.entries(lexicon).filter(([,entry])=>s-entry.learnedAt>=18);
    const things=entries.filter(([,entry])=>mode(entry.cue)==='thing');
    const actions=entries.filter(([,entry])=>mode(entry.cue)==='gesture');
    for(const [action,actionEntry] of actions){
      const before=things.filter(([word])=>(orders[action]?.[word]||0)>=2);
      const after=things.filter(([word])=>(orders[word]?.[action]||0)>=2);
      if(Math.max(before.length,after.length)<2||before.length===after.length)continue;
      for(const [word,entry] of things){
        if(!visible.includes(entry.cue))continue;
        const ordering=before.length>after.length?before:after;
        if(ordering.filter(([other])=>other!==word).length<2)continue;
        const phrase=ordering===before?action+' '+word:word+' '+action;
        if(adjacent[phrase]||combinations[phrase])continue;
        combinations[phrase]=true;
        return {phrase,gesture:actionEntry.cue.slice('gesture:'.length),cue:entry.cue};
      }
    }
    return null;
  }
  return {
    hear,compose,
    words:()=>Object.entries(lexicon).map(([word,entry])=>({word,...entry})),
    save:()=>({samples,totals,evidence,orders,adjacent,lexicon,combinations}),
    restore(data){
      if(data)({samples,totals,evidence,orders,adjacent,lexicon,combinations}=data);
    }
  };
}

const LANGUAGE_GESTURES=['gaze','point'];
const LANGUAGE_FRAMES={
  gaze:['Je regarde @','Tu regardes @ ?','Je regarde encore @','Oui, je regarde @','Regarde @'],
  point:['Je montre @','Je te montre @','Je montre aussi @','Oui, je te montre @','Montre @']
};
const languageCueNames={
  'gesture:gaze':'Regard dirigé vers un objet',
  'gesture:point':'Geste pour montrer un objet'
};
for(const topic of ALEX_TOPICS)languageCueNames['thing:'+topic.id]=topic.subject;
const sayText=(frame,subject,ending='')=>frame.replace(' ?', '').replace('@',subject)+ending+(frame.endsWith('?')?' ?':'.');

function createDialogue(){
  const lines=[], outgoing=[];
  let turn=0;
  let id=0,next=2,pending=null,lastTopic=-1,imitation=null;
  let heard=0,audibleCount=0,spoken=0,lastImitation=-1e9;
  let composed=0,lastComposition=-1e9;
  const phrases=[];
  const language=createLanguageMemory();
  function emit(s,speaker,text,heardByAlex,listener){
    const line={id:++id,at:s,speaker,text,heardByAlex,listener};
    lines.push(line);outgoing.push(line);
    if(speaker!=='alex'&&heardByAlex)audibleCount++;
    if(lines.length>40)lines.shift();
  }
  const near=(a,b,range)=>(a.floor||0)===(b.floor||0)&&!a.lie&&!b.lie&&Math.hypot(a.x-b.x,a.z-b.z)<range;
  function landmarksInView(alex,scene){
    if(alex.floor||alex.lie)return [];
    return ALEX_TOPICS.flatMap(topic=>{
      const point=scene.points?.[topic.id]||topic;
      if(point.x===null||Math.hypot(point.x-alex.x,point.z-alex.z)>5.3||
         scene.visible&&!scene.visible(alex,point))return [];
      return [{cue:'thing:'+topic.id,x:point.x,z:point.z}];
    });
  }
  function observe(alex,speaker,scene){
    const cues={};
    const objects=landmarksInView(alex,scene);
    const gesture=speaker.languageGesture;
    const seesSpeaker=near(alex,speaker,4.6)&&(!scene.visible||scene.visible(alex,speaker));
    for(const thing of objects){
      let weight=.25;
      if(seesSpeaker&&gesture){
        const dx=thing.x-speaker.x,dz=thing.z-speaker.z,d=Math.hypot(dx,dz);
        const alignment=(dx*Math.sin(gesture.heading)+dz*Math.cos(gesture.heading))/Math.max(.01,d);
        if(d<4.4&&alignment>.965)weight=.95;
      }
      cues[thing.cue]=weight;
    }
    if(seesSpeaker&&gesture)cues['gesture:'+gesture.kind]=.95;
    return cues;
  }
  function topicsNear(speaker,scene){
    return ALEX_TOPICS.map((topic,i)=>({i,point:scene.points?.[topic.id]||topic}))
      .filter(({point})=>point.x!==null&&Math.hypot(point.x-speaker.x,point.z-speaker.z)<3.6&&
        (!scene.visible||scene.visible(speaker,point)));
  }
  function speak(s,speaker,alex,topicIndex,isReply,listener,scene){
    const topic=ALEX_TOPICS[topicIndex];
    const point=scene.points?.[topic.id]||topic;
    delete speaker.languageGesture;
    let text;
    if(point.x!==null){
      const kind=LANGUAGE_GESTURES[Math.floor(Math.random()*LANGUAGE_GESTURES.length)];
      const frames=LANGUAGE_FRAMES[kind];
      speaker.languageGesture={kind,heading:Math.atan2(point.x-speaker.x,point.z-speaker.z),until:s+1.5};
      text=sayText(frames[Math.floor(Math.random()*frames.length)],topic.subject,
        ALEX_ENDINGS[Math.floor(Math.random()*ALEX_ENDINGS.length)]);
    }else{
      const forms=ALEX_PHRASES[topicIndex*10+(isReply?5:0)+Math.floor(Math.random()*5)];
      text=forms[Math.floor(Math.random()*forms.length)];
    }
    const audible=near(speaker,alex,5.2);
    emit(s,speaker.id,text,audible,listener.id);
    if(audible){
      heard++;
      const observations=observe(alex,speaker,scene);
      language.hear(text,observations,s,speaker.id);
      const tokens=alexTokens(text);
      const match=language.words().find(entry=>tokens.includes(entry.word)&&observations[entry.cue]>=.75&&s-entry.learnedAt>=16);
      if(match&&s-lastImitation>32)imitation={word:match.word,at:s+Math.max(2.7,text.length*.097)};
    }
    next=s+Math.max(2.8,text.length*.095);
  }
  const parkLines=[
    ['On joue à la balle ?', 'Oui, je suis prêt.'],
    ['On reste près des jeux ?', 'D’accord, je reste ici.'],
    ['Tu as vu la balle ?', 'Oui, je la cherche aussi.'],
    ['On se rejoint par ici ?', 'Oui, j’arrive.']
  ];
  const familyLines=[
    ['Tu fais quoi ?', 'Je regarde autour de moi.'],
    ['Tu restes dans cette pièce ?', 'Oui, encore un instant.'],
    ['On se retrouve après ?', 'D’accord, à tout à l’heure.']
  ];
  function otherExchange(s,alex,people,scene){
    const groups=[people.slice(3),[people[2],...people.slice(0,2)]];
    const ordered=turn%3===1?groups:groups.slice().reverse();
    for(const group of ordered){
      const outside=group.length===4;
      const pairs=group.flatMap((person,i)=>group.slice(i+1)
        .filter(other=>(outside||i===0)&&near(person,other,outside?4.5:3.5)).map(other=>[person,other]));
      if(!pairs.length)continue;
      const [first,second]=pairs[Math.floor(Math.random()*pairs.length)];
      const bank=outside?parkLines:familyLines;
      const [text,reply]=bank[Math.floor(Math.random()*bank.length)];
      emit(s,first.id,text,near(first,alex,5.2),second.id);
      if(near(first,alex,5.2))language.hear(text,observe(alex,first,scene),s,first.id);
      pending={speaker:second,listener:first,reply};
      next=s+Math.max(2.8,text.length*.095);
      return true;
    }
    return false;
  }
  return {
    step(s,alex,people,scene={}){
      for(const person of [alex,...people]){
        if(person.languageGesture?.until<=s)delete person.languageGesture;
      }
      if(imitation&&s>=imitation.at&&!alex.lie){
        const {word}=imitation;
        spoken++;
        lastImitation=s;
        emit(s,'alex',word[0].toUpperCase()+word.slice(1)+'…',true);
        imitation=null;
        next=Math.max(next,s+1.7);
        return;
      }
      if(s<next)return;
      if(pending){
        const {speaker,listener,reply,topic}=pending;
        pending=null;
        if(near(speaker,listener,5.4)){
          if(reply){
            emit(s,speaker.id,reply,near(speaker,alex,5.2),listener.id);
            if(near(speaker,alex,5.2))language.hear(reply,observe(alex,speaker,scene),s,speaker.id);
            next=s+Math.max(3,reply.length*.1);
          }else{
            speak(s,speaker,alex,topic,true,listener,scene);
            next+=2+Math.random()*3.3;
          }
          return;
        }
      }
      const [joseph,marie]=people;
      turn++;
      const listening=people.find(person=>near(person,alex,3.1));
      if(listening&&s-lastComposition>=45){
        const visible=landmarksInView(alex,scene);
        const proposal=language.compose(visible.map(thing=>thing.cue),s);
        if(proposal){
          const target=visible.find(thing=>thing.cue===proposal.cue);
          alex.languageGesture={kind:proposal.gesture,heading:Math.atan2(target.x-alex.x,target.z-alex.z),until:s+1.5};
          const text=proposal.phrase[0].toUpperCase()+proposal.phrase.slice(1)+'.';
          emit(s,'alex',text,true,listening.id);
          phrases.unshift({text,at:s});
          if(phrases.length>6)phrases.pop();
          composed++;lastComposition=s;next=s+3;
          return;
        }
      }
      if(turn%3===0||!near(joseph,marie,5.4)){
        const nearbyParents=[joseph,marie].filter(parent=>near(parent,alex,4.2)&&
          (!scene.visible||scene.visible(alex,parent)));
        if(nearbyParents.length){
          const parent=nearbyParents[Math.floor(Math.random()*nearbyParents.length)];
          const shared=topicsNear(parent,scene).filter(({point})=>Math.hypot(point.x-alex.x,point.z-alex.z)<5.3&&
            (!scene.visible||scene.visible(alex,point)));
          if(shared.length){
            const topic=shared[Math.floor(Math.random()*shared.length)];
            speak(s,parent,alex,topic.i,false,{id:'alex'},scene);
            return;
          }
        }
      }
      if((turn%3!==0||!near(joseph,marie,5.4))&&otherExchange(s,alex,people,scene))return;
      if(!near(joseph,marie,5.4)){next=s+1.4;return;}
      const speaker=Math.random()<.5?joseph:marie;
      const nearby=topicsNear(speaker,scene);
      if(!nearby.length)nearby.push({i:ALEX_TOPICS.findIndex(topic=>topic.x===null)});
      const repeat=nearby.find(option=>option.i===lastTopic);
      const chosen=repeat&&Math.random()<.55?repeat:nearby[Math.floor(Math.random()*nearby.length)];
      if(!chosen){next=s+2;return;}
      lastTopic=chosen.i;
      const other=speaker===joseph?marie:joseph;
      speak(s,speaker,alex,lastTopic,false,other,scene);
      pending={speaker:other,listener:speaker,topic:lastTopic};
    },
    takeNew(){return outgoing.splice(0);},
    resumeAt(last){id=Math.max(id,last||0);},
    view(){
      const vocabulary=language.words().map(entry=>({...entry,context:languageCueNames[entry.cue]||entry.cue}));
      return {lines,heard,audible:audibleCount,known:vocabulary.length,vocabulary,spoken,composed,phrases};
    },
    save(){return {id,lines,heard,audibleCount,spoken,lastImitation,language:language.save(),composed,lastComposition,phrases};},
    restore(data){
      if(!data)return;
      id=Math.max(id,data.id||0); heard=data.heard||0; audibleCount=data.audibleCount??heard; spoken=data.spoken||0;
      language.restore(data.language);
      composed=data.composed||0;lastComposition=data.lastComposition??-1e9;
      phrases.push(...(data.phrases||[]).slice(0,6));
      lastImitation=Number.isFinite(data.lastImitation)?data.lastImitation:-1e9;
      lines.push(...(data.lines||[]).slice(-40));
    }
  };
}
