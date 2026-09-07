const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Rig=require('../javascript/sachi-rig.js');
const scope={window:{}};vm.runInNewContext(fs.readFileSync('images/sachi-animation/atlas.js','utf8'),scope);const atlas=scope.window.SachiAtlas;
test('default rig preserves the artwork hierarchy and editable parts',()=>{
  const project=Rig.preset(atlas);assert.equal(Object.keys(project.parts).length,57);
  for(const id of ['hair-side-left','brow-left','eye-left','iris-right','collar-left','coat-right-hem'])assert.ok(project.parts[id]);
  assert.deepEqual(Rig.validate(JSON.parse(JSON.stringify(project)),atlas),project);
});
test('all authored tracks wrap with matching values and velocities',()=>{
  for(const part of Object.values(Rig.preset(atlas).parts))for(const [parameter,keys] of Object.entries(part.tracks)){
    const at=time=>Rig.trackAt(keys,time,0,part.interpolation);
    assert.equal(at(0),at(20),parameter);
    const e=.00001,left=(at(0)-at(20-e))/e,right=(at(e)-at(0))/e;
    assert.ok(Math.abs(left-right)<.001,parameter+' velocity differs');
    for(const key of keys)assert.ok(Math.abs(at(key.time)-key.value)<1e-10);
  }
});
test('key editing canonicalizes the loop boundary and replaces matching times',()=>{
  const part=Rig.create(atlas).parts.head;Rig.keyframe(part,'r',0,2);Rig.keyframe(part,'r',20,3);
  assert.equal(part.tracks.r.length,1);assert.equal(part.tracks.r[0].value,3);
  Rig.keyframe(part,'r',10,-3);assert.equal(Rig.trackAt(part.tracks.r,5),0);assert.equal(Rig.trackAt(part.tracks.r,15),0);
  Rig.keyframe(part,'r',5,99);assert.equal(part.tracks.r[1].value,6);
});
test('import rejects incompatible art and invalid keyframes, and clamps poses',()=>{
  const project=Rig.create(atlas);project.parts.head.values.x=999;project.parts.head.pivot=[-100,2000];
  const safe=Rig.validate(project,atlas);assert.equal(safe.parts.head.values.x,30);assert.deepEqual(safe.parts.head.pivot,[0,970]);
  assert.throws(()=>Rig.validate({...project,sourceSha256:'other'},atlas),/different version/);
  project.parts.head.tracks.r=[{time:0,value:Infinity}];assert.throws(()=>Rig.validate(project,atlas),/invalid number/);
});
test('eyelids can be keyed independently without scaling the eyeballs',()=>{
  const project=Rig.create(atlas);Rig.keyframe(project.parts['eye-left'],'close',0,.8);
  assert.equal(Rig.pose(project.parts['eye-left'],3).close,.8);assert.equal(Rig.pose(project.parts['eye-right'],3).close,0);
  assert.equal(Rig.pose(project.parts['iris-left'],3).r,0);assert.equal(Rig.pose(project.parts['iris-left'],3).x,0);
});

test('head motion flows through intermediate keys without overshooting or stopping',()=>{
  const head=Rig.preset(atlas).parts.head,keys=head.tracks.r,e=.00001;
  const left=(Rig.pose(head,2.1).r-Rig.pose(head,2.1-e).r)/e,right=(Rig.pose(head,2.1+e).r-Rig.pose(head,2.1).r)/e;
  assert.ok(Math.abs(left-right)<.001);assert.ok(Math.abs(left)>.1,'The head should continue through this key');
  for(let time=0;time<20;time+=.01){const value=Rig.pose(head,time).r;assert.ok(value>=-2.30001&&value<=1.15001);}
  assert.deepEqual(Rig.pose(head,0),Rig.pose(head,20));
});

test('a preset update preserves edited layers and upgrades untouched defaults',()=>{
  const saved=Rig.create(atlas);delete saved.presetRevision;
  saved.parts.head.tracks.r=[{time:0,value:0},{time:2,value:-.2},{time:6,value:.12},{time:10,value:0},{time:13,value:-.15},{time:17,value:0}];
  saved.parts['hair-fringe-left'].values.x=3;saved.parts['collar-left'].visible=false;
  const updated=Rig.upgrade(saved,atlas);assert.equal(updated.presetRevision,5);
  assert.deepEqual(updated.parts.head,Rig.preset(atlas).parts.head);
  assert.equal(updated.parts['hair-fringe-left'].values.x,3);
  assert.equal(updated.parts['collar-left'].visible,false);
  assert.ok(updated.parts['hair-fringe-right'].tracks.bend.length>0);
  assert.deepEqual(Rig.upgrade(updated,atlas),updated);
});

test('the right-bang preset upgrades unchanged tracks and preserves customized motion',()=>{
  const saved=Rig.create(atlas);saved.presetRevision=2;saved.settings.wind=1.5;
  for(const [id,amount,delay] of [['hair-fringe-right',-2.1,.2],['hair-side-right',-5,1.05],['hair-face-strand',-4.5,.65]]){
    for(const [time,value] of [[0,0],[.55,0],[1.7+delay,amount*.55],[2.5+delay,amount],[4.7+delay,amount*.12],[5.9+delay,-amount*.28],[8.6+delay,0],[10.4+delay,amount*.4],[11.9+delay,amount*.88],[14.1+delay,amount*.1],[15.5+delay,-amount*.2],[18.5+delay,0]])Rig.keyframe(saved.parts[id],'bend',time,value);
  }
  Rig.keyframe(saved.parts['hair-side-right'],'bend',4,-11);
  saved.parts.head.values.r=.4;saved.parts['hair-side-left'].visible=false;
  const updated=Rig.upgrade(saved,atlas),next=Rig.preset(atlas);
  assert.equal(updated.presetRevision,5);assert.equal(updated.settings.wind,1.5);
  assert.deepEqual(updated.parts['hair-fringe-right'],next.parts['hair-fringe-right']);
  assert.deepEqual(updated.parts['hair-face-strand'],next.parts['hair-face-strand']);
  assert.deepEqual(updated.parts['hair-side-right'],saved.parts['hair-side-right']);
  assert.deepEqual(updated.parts.head,saved.parts.head);assert.equal(updated.parts['hair-side-left'].visible,false);
  const fringe=updated.parts['hair-fringe-right'],time=1.6,e=.00001;
  const left=(Rig.pose(fringe,time).bend-Rig.pose(fringe,time-e).bend)/e;
  const right=(Rig.pose(fringe,time+e).bend-Rig.pose(fringe,time).bend)/e;
  assert.ok(Math.abs(left-right)<.001);assert.ok(Math.abs(left)>.1);
  assert.deepEqual(Rig.pose(fringe,0),Rig.pose(fringe,20));
});

test('the whole-loop update migrates untouched left hair and cloth without changing custom parts',()=>{
  const saved=Rig.preset(atlas);saved.presetRevision=3;saved.settings.wind=1.5;
  for(const [id,amount,delay] of [['hair-fringe-left',-2.6,0],['hair-fringe-center',-3.2,-.15],['hair-side-left',-8,.85]]){
    const part=saved.parts[id];delete part.interpolation;part.tracks.bend=[];
    for(const [t,v] of [[0,0],[.55,0],[1.7+delay,amount*.55],[2.5+delay,amount],[4.7+delay,amount*.12],[5.9+delay,-amount*.28],[8.6+delay,0],[10.4+delay,amount*.4],[11.9+delay,amount*.88],[14.1+delay,amount*.1],[15.5+delay,-amount*.2],[18.5+delay,0]])Rig.keyframe(part,'bend',t,v);
  }
  for(const [id,amount] of [['collar-right-tip',-1.5],['cord-left',-2]]){
    const part=saved.parts[id];delete part.interpolation;part.tracks.bend=[];
    for(const [t,v] of [[0,0],[1.6,amount*.35],[3,amount],[5.8,-amount*.2],[7.6,0],[11.8,amount*.8],[14,amount*.4],[17,0]])Rig.keyframe(part,'bend',t,v);
  }
  saved.parts['hair-fringe-center'].values.x=2;
  Rig.keyframe(saved.parts['cord-left'],'bend',4,-3.75);
  const updated=Rig.upgrade(saved,atlas),next=Rig.preset(atlas);
  assert.equal(updated.presetRevision,5);assert.equal(updated.settings.wind,1.5);
  for(const id of ['hair-fringe-left','hair-side-left','collar-right-tip'])assert.deepEqual(updated.parts[id],next.parts[id]);
  for(const id of ['hair-fringe-center','cord-left','head','hair-fringe-right','hair-side-right'])assert.deepEqual(updated.parts[id],saved.parts[id]);
  assert.deepEqual(Rig.upgrade(updated,atlas),updated);
});

test('hair and fabric continue through passing keys and stay within their authored range',()=>{
  const project=Rig.preset(atlas),e=.00001;
  for(const id of ['hair-fringe-left','hair-fringe-center','hair-side-left','collar-right-tip','cord-left']){
    const part=project.parts[id],keys=part.tracks.bend,t=keys[2].time;
    const left=(Rig.pose(part,t).bend-Rig.pose(part,t-e).bend)/e;
    const right=(Rig.pose(part,t+e).bend-Rig.pose(part,t).bend)/e;
    assert.ok(Math.abs(left)>.1,id+' stopped at a passing key');assert.ok(Math.abs(left-right)<.001,id+' velocity jumped');
    const lo=Math.min(...keys.map(k=>k.value)),hi=Math.max(...keys.map(k=>k.value));
    for(let time=0;time<20;time+=.02){const v=Rig.pose(part,time).bend;assert.ok(v>=lo-1e-8&&v<=hi+1e-8,id+' overshot its safe range');}
  }
});

test('the reviewed mask revision migrates saved poses without accepting unrelated artwork',()=>{
  const previous='ce446e95660d93683289f46997bc4851109d7917d9f637d1895407a8bb0f7208';
  const saved=Rig.preset(atlas);saved.sourceSha256=previous;saved.settings.wind=.95;
  saved.parts['hair-side-left'].values.lag=.7;saved.parts['collar-back'].visible=false;
  Rig.keyframe(saved.parts['hair-side-right'],'x',4,3.5);
  const migrated=Rig.upgrade(saved,atlas);
  assert.equal(migrated.sourceSha256,atlas.sourceSha256);
  assert.equal(migrated.settings.wind,.95);
  assert.deepEqual(migrated.parts,saved.parts);
  for(const revision of atlas.compatibleSourceSha256){
    const updated=Rig.upgrade({...saved,sourceSha256:revision},atlas);
    assert.equal(updated.sourceSha256,atlas.sourceSha256);
    assert.deepEqual(updated.parts,saved.parts);assert.equal(updated.settings.wind,.95);
  }
  assert.throws(()=>Rig.validate({...saved,sourceSha256:'unrelated'},atlas),/different version/);
  assert.throws(()=>Rig.validate(saved,{...atlas,sourceSha256:'future',compatibleSourceSha256:[]}),/different version/);
});

test('the reaction anticipates the tilt with brows and follows its blink with a nod',()=>{
  const project=Rig.preset(atlas),head=t=>Rig.pose(project.parts.head,t);
  const eyebrow=t=>Rig.pose(project.parts['brow-left'],t);
  assert.ok(eyebrow(1.5).y<-1.5&&Math.abs(head(1.5).r)<.65,'Brows should lead the head');
  assert.ok(head(3.6).r<-2,'The attentive tilt should be visible');
  assert.equal(require('../javascript/sachi-animation.js').blinkAt(3.92),1);
  assert.ok(head(3.92).y>1,'The blink should occur during the nod');
  assert.ok(head(4.05).y>3.5&&head(4.65).y<1,'The nod should recover smoothly');
  assert.ok(Math.abs(head(13.6).r)<Math.abs(head(3.6).r),'The second reaction should be softer');
  for(const t of [0,10.6,11,19.5,20])for(const key of ['x','y','r'])assert.equal(head(t)[key],0,'Quiet intervals should settle');
});

test('the reaction update migrates default head and brows while preserving custom facial and clothing edits',()=>{
  const v4=require('./fixtures/preset-v4-face.json');
  const saved=Rig.create(atlas);saved.presetRevision=4;Object.assign(saved.parts,structuredClone(v4));
  saved.settings.face=.8;saved.parts['collar-left'].values.x=2;
  Rig.keyframe(saved.parts['eye-right'],'close',3,.4);
  const next=Rig.preset(atlas),updated=Rig.upgrade(saved,atlas);
  for(const id of Object.keys(v4))assert.deepEqual(updated.parts[id],next.parts[id]);
  assert.equal(updated.settings.face,.8);assert.equal(updated.parts['collar-left'].values.x,2);
  assert.deepEqual(updated.parts['eye-right'],saved.parts['eye-right']);
  saved.parts.head.values.r=.7;saved.parts['brow-left'].visible=false;
  const custom=Rig.upgrade(saved,atlas);
  assert.deepEqual(custom.parts.head,saved.parts.head);assert.deepEqual(custom.parts['brow-left'],saved.parts['brow-left']);
  assert.deepEqual(custom.parts['brow-right'],next.parts['brow-right']);
});
