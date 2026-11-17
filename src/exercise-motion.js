(() => {
  if (globalThis.PPExerciseMotion) return;
  // Side and front views use a common set of body landmarks. Alternating exercises
  // include both sides in the cycle. Static previews show the active position.
  const stand = [[190,69],[190,99],[189,157],[188,197],[191,237],[187,132],[185,163]];
  const squat = [[187,102],[185,132],[162,187],[209,202],[187,237],[210,155],[231,131]];
  const hinge = [[231,107],[207,124],[164,157],[185,199],[180,237],[207,160],[199,192]];
  const seated = [[158,80],[155,109],[153,166],[207,170],[210,230],[179,133],[192,166]];
  const floor = [[128,202],[155,218],[210,226],[248,191],[277,231],[170,211],[186,204]];
  const sitUp = [[174,134],[173,163],[210,226],[248,191],[277,231],[192,177],[204,160]];
  const plank = [[106,151],[132,164],[193,185],[238,206],[279,229],[139,200],[150,231]];
  const quad = [[113,146],[140,166],[207,170],[201,231],[244,232],[145,197],[142,232],[191,224],[229,226],[133,190],[128,225]];
  const hang = [[187,101],[187,129],[190,180],[190,210],[190,239],[186,87],[184,53]];
  const inverted = [[189,195],[189,168],[190,109],[190,67],[189,32],[190,201],[190,236]];
  const p = (base, ...changes) => Array.from({length: Math.max(base.length, changes.length)},
    (_, i) => changes[i] ?? base[i]);
  const db = 'dumbbell';
  const bench = '<path d="M111 174h98m-85 0v59m70-59v59"/>';
  const lowBench = '<path d="M91 198h87m-73 0v35m59-35v35"/>';
  const block = '<path d="M190 237v-29h68v29"/>';
  const bar = '<path d="M119 53h135m-126 0v181m117-181v181"/>';
  const parallels = '<path d="M124 156h119m-106 0v76m89-76v76m-81-85h112" opacity=".8"/>';
  const bike = '<circle cx="232" cy="206" r="31"/><circle cx="181" cy="190" r="15"/><path d="m141 229 40-39 51 16-36-68-15 52m15-52h21m-76 91h112m-100-79h30m-16 0 14 40"/>';
  const stairs = '<path d="M141 234h57v-20h22v-20h22v-20h24m-4 0v-66h-39m39 0-12 67"/>';
  const machine = '<path d="M101 233h158m-148 0v-73h73m-66 0v-57m119 130v-70h-38"/>';
  const hack = '<path d="M116 230h151m-20 0-75-145m55 135-75-145m-5 124h57"/>';
  const backBench = '<path d="m144 230 43-60h26m-2 0 21 63m-98-14h31"/>';
  const cable = '<path d="M111 228h89m-74-5v-49m143 59V100h-22m-22 81h43"/>';
  const sled = '<path d="M71 231h80m-66 0v-35m51 35v-35m-48 14h49"/>';
  const curl = p(stand,null,null,null,null,null,[200,124],[197,105]);
  const dipLow = [[177,110],[180,134],[191,186],[199,213],[181,233],[153,151],[166,157]];
  const dipTop = [[176,65],[176,94],[185,151],[194,190],[178,211],[168,125],[166,157]];
  const bikeBody = [[179,92],[166,118],[164,155],[190,163],[181,205],[186,134],[211,139],[197,173],[181,176]];
  const sidePlank = [[111,151],[133,172],[187,195],[232,211],[278,235],[131,204],[154,232]];
  const flight = p(stand,[190,57],[190,88],[189,145],[188,185],[192,219],[187,123],[185,154]);
  const highKnee = p(stand,null,null,null,[225,164],[226,199]);
  const stepped = p(stand,[206,51],[206,81],[213,138],[217,169],[221,205]);
  const entries = [
    ['Seated Calf Raise','seated-calf-raise',[seated,p(seated,null,null,null,[208,165],[225,216])],bench+block,'weight'],
    ['Standing Calf Raise','standing-calf-raise',[stand,p(stand,[190,61],[190,91],[189,149],[188,190],[203,224],[187,124],[185,155])],block],
    ['Stationary Bike','stationary-bike',[bikeBody,p(bikeBody,null,null,null,[190,184],[166,188],null,null,[201,179],[196,190]),p(bikeBody,null,null,null,[197,173],[181,176],null,null,[190,163],[181,205]),p(bikeBody,null,null,null,[201,179],[196,190],null,null,[190,184],[166,188])],bike,null,'time'],
    ['Bird Dog','bird-dog',[quad,p(quad,null,null,null,[248,169],[285,169],[110,165],[75,160]),quad,p(quad,null,null,null,null,null,null,null,[254,158],[293,155],[108,155],[75,150])]],
    ['Sit-up','sit-up',[floor,sitUp],null,'plate'],
    ['Dips','dips',[dipTop,dipLow],parallels],
    ['Bicep Curl','bicep-curl',[stand,curl],null,db],
    ['Tricep Dips','tricep-dips',[[[164,107],[162,136],[172,190],[222,206],[256,232],[143,168],[132,196]],[[168,139],[166,163],[177,218],[225,211],[256,232],[139,173],[132,196]]],lowBench],
    ['Side Plank','side-plank',[sidePlank,p(sidePlank,null,null,[187,182],null,null,null,null,null,null,[153,143],[168,112])],null,null,'time'],
    ['Dragon Flag','dragon-flag',[[[120,207],[146,217],[195,202],[233,193],[273,182],[134,194],[113,194]],[[120,207],[146,217],[171,166],[184,127],[197,91],[134,194],[113,194]]],'<path d="M94 230h96m-83 0v8m70-8v8"/>'],
    ['Handstand Hold','handstand-hold',[inverted,p(inverted,null,null,[190,108],[187,67],[186,32])],null,null,'time'],
    ['Handstand Push-up','handstand-push-up',[inverted,p(inverted,[189,222],[189,196],[190,135],[190,94],[189,60],[171,207],[190,236])]],
    ['Muscle-up','muscle-up',[hang,p(hang,[195,40],[193,69],[199,127],[214,164],[222,204],[174,66],[184,53]),p(hang,[187,24],[187,45],[187,100],[187,139],[187,174],[182,50],[184,53])],bar],
    ['Power Clean','power-clean',[[[214,112],[199,141],[165,180],[197,209],[191,237],[207,181],[204,216]],hinge,p(stand,null,null,null,null,null,[184,136],[184,140]),p(squat,null,null,null,null,null,[219,132],[197,125]),p(stand,null,null,null,null,null,[218,113],[203,94])],null,'barbell'],
    ['Weighted Pogo Hop','weighted-pogo-hop',[stand,flight,p(stand,null,null,null,[194,196],[188,237])],null,db],
    ['Side Lunge','side-lunge',[p(stand,null,null,null,[206,198],[221,237],null,null,[170,199],[160,237],[167,133],[165,163]),p(squat,[142,95],[146,126],[149,180],[128,207],[117,236],[163,143],[174,147],[207,206],[251,235],[133,144],[156,151])]],
    ['StairMaster','stairmaster',[p(stand,[194,68],[194,99],[190,151],[209,183],[215,212],[215,123],[232,112],[193,190],[189,231]),p(stand,[194,64],[194,96],[197,146],[194,188],[189,230],[215,123],[232,112],[217,172],[235,191])],stairs,null,'time'],
    ['Hex Bar Deadlift','hex-bar-deadlift',[hinge,stand],null,'hex'],
    ['Front Squat','front-squat',[p(stand,null,null,null,null,null,[219,110],[202,95]),p(squat,null,null,null,null,null,[220,147],[194,130])],null,'barbell'],
    ['Hack Squat','hack-squat',[p(stand,[161,68],[171,98],[192,152],[207,190],[211,214],[179,123],[184,105]),p(squat,[182,112],[192,141],[212,187],[236,186],[211,214],[209,155],[207,137])],hack],
    ['Leg Extension','leg-extension',[seated,p(seated,null,null,null,null,[260,174])],machine],
    ['Back Extension','back-extension',[[[218,205],[205,180],[184,167],[152,199],[120,228],[211,174],[220,171]],[[255,137],[226,151],[184,167],[152,199],[120,228],[225,144],[237,146]]],backBench],
    ['Hip Thrust','hip-thrust',[[[107,163],[129,179],[176,216],[225,189],[235,236],[149,189],[175,208]],[[105,158],[129,178],[177,184],[225,185],[235,236],[149,184],[175,181]]],lowBench,'barbell'],
    ['Lateral Shoulder Raise','lateral-shoulder-raise',[p(stand,null,null,null,[204,197],[206,237],[208,132],[212,163],[176,197],[175,237],[171,132],[167,163]),p(stand,null,null,null,[204,197],[206,237],[222,103],[252,100],[176,197],[175,237],[158,103],[129,100])],null,db],
    ['Horizontal Row','horizontal-row',[[[163,91],[164,121],[154,178],[201,182],[239,226],[202,141],[229,154]],[[157,91],[156,121],[154,178],[201,182],[239,226],[149,157],[176,151]]],cable,'handle'],
    ['Sled Pull','sled-pull',[[[204,95],[188,121],[166,167],[205,190],[217,232],[161,149],[135,169],[152,207],[133,232]],[[209,95],[194,120],[179,165],[173,208],[163,232],[168,148],[143,161],[219,186],[229,232]]],sled,'rope'],
    ['Step-up','step-up',[p(stand,null,null,null,[209,168],[221,205]),stepped],block],
    ['Hip Abductor','hip-abductor',[[[190,76],[190,105],[190,156],[204,191],[207,226],[206,137],[215,171],[176,191],[173,226],[174,137],[165,171]],[[190,76],[190,105],[190,156],[226,181],[247,219],[206,137],[215,171],[154,181],[133,219],[174,137],[165,171]]],'<path d="M165 160h50m-46 0v70m42-70v70m-64 0h85"/>'],
    ['Hip Adductor','hip-adductor',[[[190,76],[190,105],[190,156],[228,181],[253,219],[209,137],[221,171],[152,181],[127,219],[171,137],[159,171]],[[190,76],[190,105],[190,156],[204,191],[207,226],[209,137],[221,171],[176,191],[173,226],[171,137],[159,171]]],'<path d="M165 160h50m-46 0v70m42-70v70m-64 0h85"/>'],
    ['Weighted Hip Flexor High-Knee Curl','weighted-hip-flexor-high-knee-curl',[stand,highKnee],null,'ankle']
  ];
  const aliases = {
    'calf raises sitting':'Seated Calf Raise', 'calf raises standing':'Standing Calf Raise',
    'weighted sit-up':'Sit-up', 'weighted dips':'Dips', 'handstand holds':'Handstand Hold',
    'step ups':'Step-up', 'stepups':'Step-up', 'sit ups':'Sit-up',
    'handstand pushups':'Handstand Push-up', 'handstand push ups':'Handstand Push-up',
    'muscle ups':'Muscle-up', 'power cleans':'Power Clean', 'weighted pogo hops':'Weighted Pogo Hop',
    'side lunges':'Side Lunge', 'stair master':'StairMaster', 'back extensions':'Back Extension',
    'hip thrusts':'Hip Thrust', 'lateral shoulder raises':'Lateral Shoulder Raise',
    'hip abductors':'Hip Abductor', 'hip adductors':'Hip Adductor', 'hex bar deadlift':'Hex Bar Deadlift',
    'hip flexer high knee curls with weight':'Weighted Hip Flexor High-Knee Curl'
  };
  const normalize = value => String(value || '').trim().toLowerCase().replaceAll('-', ' ').replace(/\s+/g, ' ');
  const byName = new Map(entries.map(entry => [normalize(entry[0]),entry]));
  for (const [alias, name] of Object.entries(aliases)) byName.set(alias, byName.get(normalize(name)));

  const characters = [
    { skin:'#a55d4a', hair:'#292221', top:'#2d6954', pants:'#294a42', pony:true },
    { skin:'#df9e77', hair:'#543628', top:'#4d7863', pants:'#314f49', pony:false },
    { skin:'#83503d', hair:'#27232c', top:'#955e4f', pants:'#294943', pony:false },
    { skin:'#c68661', hair:'#332129', top:'#8b6050', pants:'#2c4847', pony:true }
  ];
  const picks = new Map();
  const cache = new Map();
  const duration = 2.25;
  const palette = {tools:'#889e94', shoes:'#203930'};
  const getCharacter = id => {
    if (!picks.has(id)) picks.set(id, Math.floor(Math.random() * characters.length));
    return picks.get(id);
  };

  function svg(entry, characterIndex, animate) {
    const [, id, frames, equipment, prop] = entry;
    const character = characters[characterIndex];
    const still = entry[5] === 'time' && id !== 'stationary-bike' && id !== 'stairmaster'
      ? frames[0] : frames[1] || frames[0];
    const poses = (animate ? [...frames, ...frames.slice(1,-1).reverse(), frames[0]] : [still]).map(frame => {
      const [head, shoulder, hip, knee, ankle, elbow, hand,
        farKnee = [knee[0]-10,knee[1]+4], farAnkle = [ankle[0]-12,ankle[1]],
        farElbow = [elbow[0]-8,elbow[1]+3], farHand = [hand[0]-10,hand[1]+2]] = frame;
      return {head, shoulder, hip, knee, ankle, elbow, hand, farKnee, farAnkle, farElbow, farHand};
    });
    const coord = (joint, axis, offset = 0) => poses.map(pose => pose[joint][axis] + offset);
    const attr = (name, values) => animate && new Set(values).size > 1
      ? '<animate attributeName="'+name+'" values="'+values.join(';')+'" dur="'+duration+'s" repeatCount="indefinite"/>'
      : '';
    const poly = (joints, color, width) => {
      const points = poses.map(pose => joints.map(joint => pose[joint].join(',')).join(' '));
      return '<polyline points="'+points[0]+'" stroke="'+color+'" stroke-width="'+width+'" fill="none">'+attr('points',points)+'</polyline>';
    };
    const circle = (joint, radius, color, ox=0, oy=0) => {
      const x=coord(joint,0,ox), y=coord(joint,1,oy);
      return '<circle cx="'+x[0]+'" cy="'+y[0]+'" r="'+radius+'" fill="'+color+'">'+attr('cx',x)+attr('cy',y)+'</circle>';
    };
    const segment = (a,b,color,width) => {
      const points = poses.map(pose => [a(pose),b(pose)].map(point=>point.join(',')).join(' '));
      return '<polyline points="'+points[0]+'" stroke="'+color+'" stroke-width="'+width+'" fill="none">'+attr('points',points)+'</polyline>';
    };
    const offset = (joint, x, y) => pose => [pose[joint][0]+x,pose[joint][1]+y];
    const shoe = joint => segment(offset(joint,-5,2),offset(joint,10,2),palette.shoes,12);
    const bell = joint => segment(offset(joint,-9,1),offset(joint,9,1),'#4a6056',12);
    const accessories = {
      dumbbell: () => bell('hand')+bell('farHand'),
      weight: () => circle('knee',13,'#65776c',-10,-8),
      plate: () => circle('hand',13,'#65776c'),
      barbell: () => segment(offset('hand',-27,0),offset('hand',28,0),'#54675f',5)+
        circle('hand',12,'#54675f',-25)+circle('hand',12,'#54675f',25),
      hex: () => segment(offset('hand',-32,7),offset('hand',27,7),'#54675f',5)+
        circle('hand',12,'#54675f',-27,7)+circle('hand',12,'#54675f',25,7),
      handle: () => segment(offset('hand',0,0),()=>[265,179],'#667b73',3)+bell('hand'),
      rope: () => segment(offset('hand',0,0),()=>[130,213],'#845e4b',3),
      ankle: () => circle('ankle',9,'#54675f',0,-8)
    };
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 392 300" stroke-linecap="round" stroke-linejoin="round">'+
      '<rect width="392" height="300" fill="#eef4e9"/>'+
      '<path d="M28 277h336" stroke="#cbd9ce" stroke-width="4"/><g transform="translate(-25.48 6.93) scale(1.13)">'+
      '<g fill="none" stroke="'+palette.tools+'" stroke-width="6">'+(equipment||'')+'</g>'+
      poly(['hip','farKnee','farAnkle'],'#566d70',15)+shoe('farAnkle')+
      poly(['shoulder','farElbow','farHand'],character.skin,11)+
      poly(['hip','knee','ankle'],character.pants,17)+shoe('ankle')+
      poly(['shoulder','hip'],character.top,35)+
      poly(['head','shoulder'],character.skin,14)+
      (character.pony ? circle('head',9,character.hair,-12,-6) : '')+
      circle('head',15,character.skin)+circle('head',11,character.hair,-4,-6)+
      circle('head',2,'#33292a',9,1)+
      poly(['shoulder','elbow','hand'],character.skin,11)+
      (accessories[prop]?.() || '')+'</g></svg>';
  }

  function asset(name, animate = false) {
    const entry = byName.get(normalize(name));
    if (!entry) return null;
    const id = entry[1];
    const character = getCharacter(id);
    const key = id + ':' + character + ':' + animate;
    if (!cache.has(key)) cache.set(key, 'data:image/svg+xml,' + encodeURIComponent(svg(entry,character,animate)));
    return cache.get(key);
  }

  globalThis.PPExerciseMotion = Object.freeze({
    catalog: entries.map(([name,id,,,,measurement]) => ({name,id,measurement})),
    find: name => {
      const entry = byName.get(normalize(name));
      return entry ? {name:entry[0],id:entry[1],measurement:entry[5]} : null;
    },
    asset
  });
})();
