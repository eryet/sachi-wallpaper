const test=require('node:test');
const assert=require('node:assert/strict');
const motion=require('../javascript/sachi-animation.js');

test('the full loop joins with continuous positions and velocities',()=>{
  const start=motion.sample(0),end=motion.sample(motion.DURATION);
  assert.deepEqual(end,start);
  const epsilon=.001,left=motion.sample(motion.DURATION-epsilon),right=motion.sample(epsilon);
  for(const id of Object.keys(start.poses))for(const key of ['r','x','y','sx','sy']) {
    assert.ok(Math.abs(left.poses[id][key]-right.poses[id][key])<.01,`${id} ${key} position seam`);
    const before=(start.poses[id][key]-left.poses[id][key])/epsilon;
    const after=(right.poses[id][key]-start.poses[id][key])/epsilon;
    assert.ok(Math.abs(before-after)<.002,`${id} ${key} velocity seam`);
  }
});

test('blinks close completely, reopen, and leave the loop boundary open',()=>{
  assert.equal(motion.blinkAt(0),0);assert.equal(motion.blinkAt(20),0);
  assert.equal(motion.blinkAt(3.92),1);assert.equal(motion.blinkAt(4.2),0);
  assert.equal(motion.sample(3.92,{face:.5}).blink,1,'A softer face setting should still finish each blink');
  let closures=0,closed=false;
  for(let t=0;t<20;t+=.005){const value=motion.blinkAt(t);assert.ok(value>=0&&value<=1);if(value>.99&&!closed)closures++;closed=value>.99;}
  assert.equal(closures,4);
});

test('hair, face, and shirt controls disable their respective motion',()=>{
  const hair=motion.sample(3.92,{hair:0,face:1,shirt:1});
  assert.equal(hair.poses['hair-side-left'].r,0);assert.equal(hair.poses['hair-side-right'].r,0);
  const face=motion.sample(3.92,{hair:1,face:0,shirt:1});
  assert.equal(face.blink,0);assert.equal(face.poses.head.r,0);
  const shirt=motion.sample(3.92,{hair:1,face:1,shirt:0});
  assert.equal(shirt.poses.sachi.sy,1);assert.equal(Math.abs(shirt.poses['collar-left'].r),0);
  assert.equal(motion.sample(3.92,{hair:0,face:0,shirt:0}).active,false);
  assert.deepEqual(motion.sample(3.92,undefined,true).poses,{});
});

test('invalid settings cannot poison transforms or playback timing',()=>{
  const settings=motion.options({hair:NaN,face:Infinity,shirt:-12,speed:0,fps:200});
  assert.equal(settings.hair,1);assert.equal(settings.face,1);assert.equal(settings.shirt,0);
  assert.equal(settings.speed,.1);assert.equal(settings.fps,120);
  for(let t=0;t<20;t+=.07)for(const p of Object.values(motion.sample(t,settings).poses))for(const value of Object.values(p))assert.ok(Number.isFinite(value));
});

test('hair sections follow different phases rather than moving as one rigid piece',()=>{
  const pose=motion.sample(2.5);
  assert.notEqual(pose.poses['hair-side-left'].r,pose.poses['hair-side-right'].r);
  assert.notEqual(pose.poses['hair-fringe-left'].r,pose.poses['hair-fringe-center'].r);
});

test('eyelids close to a shared curve, keep their corners anchored, and reopen',()=>{
  for(const side of ['left','right']) {
    const open=motion.eyeCurves(side,0),closed=motion.eyeCurves(side,1);
    assert.deepEqual(closed.upper,closed.lower);
    for(let amount=0;amount<=1;amount+=.05) {
      const curves=motion.eyeCurves(side,amount);
      assert.deepEqual(curves.upper[0],open.upper[0]);
      assert.deepEqual(curves.lower[3],open.lower[3]);
      for(let x=open.upper[0][0];x<=open.upper[3][0];x+=2) {
        const upper=motion.curveY(curves.upper,x),lower=motion.curveY(curves.lower,x);
        assert.ok(upper<=lower+.0001,`${side}: lids cross at ${amount}`);
        assert.ok(lower-upper<=motion.curveY(open.lower,x)-motion.curveY(open.upper,x)+.0001);
      }
    }
    assert.deepEqual(motion.eyeCurves(side,motion.blinkAt(4.2)),open);
  }
});

test('the eye artwork retains its proportions throughout each blink',()=>{
  for(let t=3.8;t<=4.12;t+=.005) {
    const frame=motion.sample(t);
    for(const id of ['eye-left','eye-right']) {
      assert.equal(frame.poses[id].sx,1);assert.equal(frame.poses[id].sy,1);
      assert.equal(frame.poses[id].x,0);assert.equal(frame.poses[id].y,0);
    }
  }
});

test('automatic rig blinks close fully at reduced face strength while authored lids retain control',()=>{
  const plain={tracks:{}},keyed={tracks:{close:[{time:0,value:.4}]}},p={close:.4};
  for(const strength of [.1,.25,.5,1,1.5]){
    assert.equal(motion.rigClosure(plain,p,1,strength),1);
    assert.equal(motion.rigClosure(keyed,p,1,strength),.4*Math.min(1,strength));
  }
  assert.equal(motion.rigClosure(plain,p,1,0),0);
  assert.equal(motion.rigClosure(keyed,p,1,0),0);
});

test('breathing varies gently, exhales longer, and crosses cycle joins without a hitch',()=>{
  const e=.0001,joins=[0,4.85,10.1,15.4,20],peaks=[];
  for(const t of joins){
    assert.ok(Math.abs(motion.breathAt(t))<1e-10);
    assert.ok(Math.abs((motion.breathAt(t+e)-motion.breathAt(t-e))/(2*e))<1e-6);
    assert.ok(Math.abs((motion.breathAt(t+e)-2*motion.breathAt(t)+motion.breathAt(t-e))/(e*e))<.001);
  }
  for(let i=0;i<joins.length-1;i++){
    const start=joins[i],end=joins[i+1];let peak=0,at=start;
    for(let t=start;t<end;t+=.005){const v=motion.breathAt(t);assert.ok(v>=0&&v<=1.05);if(v>peak){peak=v;at=t;}}
    peaks.push(peak);assert.ok(at-start<end-at,'The exhale should have more time to settle');
  }
  assert.ok(Math.max(...peaks)-Math.min(...peaks)>.05);
});

test('blink episodes vary in duration and open more slowly than they close',()=>{
  const episodes=[];let episode=null;
  for(let t=0;t<20;t+=.001){const b=motion.blinkAt(t);
    if(b>0&&!episode)episode={start:t,closed:null,reopen:null};
    if(episode&&b>=.99999&&episode.closed===null)episode.closed=t;
    if(episode&&episode.closed!==null&&b<.99999&&episode.reopen===null)episode.reopen=t;
    if(episode&&b===0){episode.end=t;episodes.push(episode);episode=null;}
  }
  assert.equal(episodes.length,4);
  for(const e of episodes)assert.ok(e.end-e.reopen>e.closed-e.start);
  assert.ok(episodes[3].end-episodes[3].start<episodes[2].end-episodes[2].start-.05);
});
