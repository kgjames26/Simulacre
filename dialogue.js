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
const ALEX_FILLER=new Set([
  ...alexTokens(ALEX_OPENERS.join(' ')+' '+ALEX_ENDINGS.join(' ')),
  'le','la','les','l','un','une'
]);

function createDialogue(){
  const lines=[], outgoing=[];
  let turn=0;
  let id=0,next=2,pending=null,lastTopic=-1,imitation=null;
  let heard=0,audibleCount=0,lexicon={},spoken=0,lastImitation=-1e9;
  const occurrence={};
  const heardTotal={};
  function emit(s,speaker,text,heardByAlex,listener){
    const line={id:++id,at:s,speaker,text,heardByAlex,listener};
    lines.push(line);outgoing.push(line);
    if(speaker!=='alex'&&heardByAlex)audibleCount++;
    if(lines.length>40)lines.shift();
  }
  function hear(text,cue,s,speaker){
    heard++;
    const words=[...new Set(alexTokens(text).filter(word=>!ALEX_FILLER.has(word)&&word.length>1))];
    for(const word of words){
      heardTotal[word]=(heardTotal[word]||0)+1;
      if(!cue)continue;
      const senses=occurrence[word] ||= {};
      const observed=senses[cue] ||= {count:0,voices:0,forms:[]};
      observed.count++;
      observed.voices|=speaker==='joseph'?1:2;
      if(observed.forms.length<8&&!observed.forms.includes(text))observed.forms.push(text);
      if(!lexicon[word]&&observed.count>=4&&observed.voices===3&&observed.forms.length>=3&&observed.count/heardTotal[word]>=.7){
        lexicon[word]={cue,learnedAt:s,uses:0};
      }
    }
  }
  const near=(a,b,range)=>(a.floor||0)===(b.floor||0)&&!a.lie&&!b.lie&&Math.hypot(a.x-b.x,a.z-b.z)<range;
  function speak(s,speaker,alex,topicIndex,isReply,listener){
    const topic=ALEX_TOPICS[topicIndex];
    const forms=ALEX_PHRASES[topicIndex*10+(isReply?5:0)+Math.floor(Math.random()*5)];
    const text=forms[Math.floor(Math.random()*forms.length)];
    const audible=near(speaker,alex,5.2);
    emit(s,speaker.id,text,audible,listener.id);
    if(audible){
      const visible=topic.x===null?Math.hypot(speaker.x-alex.x,speaker.z-alex.z)<3.2:
        Math.hypot(topic.x-alex.x,topic.z-alex.z)<4.5;
      hear(text,visible?topic.id:null,s,speaker.id);
      const candidates=Object.entries(lexicon).filter(([,entry])=>entry.cue===topic.id&&
        s-entry.learnedAt>=16&&visible&&s-lastImitation>32);
      if(candidates.length){
        const [word,entry]=candidates.sort((a,b)=>a[1].uses-b[1].uses)[0];
        imitation={word,at:s+Math.max(2.7,text.length*.097)};
      }
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
  function otherExchange(s,alex,people){
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
      pending={speaker:second,listener:first,reply};
      next=s+Math.max(2.8,text.length*.095);
      return true;
    }
    return false;
  }
  return {
    step(s,alex,people){
      if(imitation&&s>=imitation.at&&!alex.lie){
        const {word}=imitation;
        lexicon[word].uses++;
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
            next=s+Math.max(3,reply.length*.1);
          }else{
            speak(s,speaker,alex,topic,true,listener);
            next+=2+Math.random()*3.3;
          }
          return;
        }
      }
      const [joseph,marie]=people;
      turn++;
      if((turn%3!==0||!near(joseph,marie,5.4))&&otherExchange(s,alex,people))return;
      if(!near(joseph,marie,5.4)){next=s+1.4;return;}
      const nearby=ALEX_TOPICS.map((topic,i)=>({topic,i})).filter(({topic})=>topic.x===null||
        Math.min(Math.hypot(topic.x-joseph.x,topic.z-joseph.z),Math.hypot(topic.x-marie.x,topic.z-marie.z))<3.6);
      const repeat=nearby.find(option=>option.i===lastTopic);
      const chosen=repeat&&Math.random()<.55?repeat:nearby[Math.floor(Math.random()*nearby.length)];
      if(!chosen){next=s+2;return;}
      lastTopic=chosen.i;
      const speaker=Math.random()<.5?joseph:marie;
      const other=speaker===joseph?marie:joseph;
      speak(s,speaker,alex,lastTopic,false,other);
      pending={speaker:other,listener:speaker,topic:lastTopic};
    },
    takeNew(){return outgoing.splice(0);},
    resumeAt(last){id=Math.max(id,last||0);},
    view(){return {lines,heard,audible:audibleCount,known:Object.keys(lexicon).length,spoken};},
    save(){return {id,lines,heard,audibleCount,lexicon,spoken,lastImitation,occurrence,heardTotal};},
    restore(data){
      if(!data)return;
      id=Math.max(id,data.id||0); heard=data.heard||0; audibleCount=data.audibleCount??heard; spoken=data.spoken||0;
      lexicon=data.lexicon||{};lastImitation=Number.isFinite(data.lastImitation)?data.lastImitation:-1e9;
      lines.push(...(data.lines||[]).slice(-40));
      Object.assign(occurrence,data.occurrence);
      Object.assign(heardTotal,data.heardTotal);
    }
  };
}
