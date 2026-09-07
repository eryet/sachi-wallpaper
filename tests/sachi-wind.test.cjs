const test=require('node:test'),assert=require('node:assert/strict');
const wind=require('../javascript/sachi-wind.js');
const hair={hair:1,shirt:0,wind:1},shirt={hair:0,shirt:1,wind:1};

test('the temple stays attached while the free hair tips catch the gust',()=>{
  for(let t=0;t<20;t+=.05){
    assert.ok(Math.hypot(...wind.deformation(79,263,t,hair))<1);
    assert.deepEqual(wind.deformation(267,66,t,hair),[0,0]);
  }
  assert.ok(Math.hypot(...wind.deformation(110,695,2.8,hair))>65);
});

test('the neck follows the jaw while its lower attachment stays fixed',()=>{
  const head={x:-1.5,y:.55,r:-1.12,pivot:[322,655]};
  assert.deepEqual(wind.posePoint(330,630,{head,neck:true}),wind.posePoint(330,630,{head}));
  assert.deepEqual(wind.posePoint(330,700,{head,neck:true}),[330,700]);
  const full=wind.posePoint(380,667,{head}),blend=wind.posePoint(380,667,{head,neck:true});
  assert.ok(Math.hypot(blend[0]-380,blend[1]-667)>0);
  assert.ok(Math.hypot(blend[0]-380,blend[1]-667)<Math.hypot(full[0]-380,full[1]-667));
  for(let y=580;y<710;y+=2)for(let x=150;x<460;x+=10){
    const a=wind.posePoint(x,y,{head,neck:true}),b=wind.posePoint(x+1,y,{head,neck:true}),c=wind.posePoint(x,y+1,{head,neck:true});
    assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>.9);
  }
});

test('local tip bending leaves the root section unchanged',()=>{
  const part={pivot:[195,70],bottom:349,flexStart:243,bend:-8,r:0,x:0,y:0};
  assert.deepEqual(wind.posePoint(130,220,{parts:[part]}),[130,220]);
  assert.deepEqual(wind.posePoint(130,349,{parts:[part]}),[122,349]);
});

test('gusts build, release, and loop with continuous motion',()=>{
  assert.equal(wind.gustAt(0),0);assert.equal(wind.gustAt(20),0);
  assert.ok(wind.gustAt(1.6)>.9);assert.equal(wind.gustAt(9),0);
  for(const settings of [hair,{...hair,frontHair:true},{...hair,backHair:true},shirt])for(const [x,y] of [[100,690],[480,400],[550,630],[160,760],[670,900]]){
    assert.deepEqual(wind.deformation(x,y,0,settings),wind.deformation(x,y,20,settings));
    const a=wind.deformation(x,y,19.999,settings),b=wind.deformation(x,y,.001,settings);
    for(let k=0;k<2;k++)assert.ok(Math.abs(a[k]-b[k])<.001);
  }
});

test('the default gust produces a large hair sweep and visible cloth movement',()=>{
  let hairTravel=0,clothTravel=0;
  for(let t=0;t<7;t+=.05){
    hairTravel=Math.max(hairTravel,Math.hypot(...wind.deformation(110,695,t,hair)));
    clothTravel=Math.max(clothTravel,Math.hypot(...wind.deformation(665,870,t,shirt)));
  }
  assert.ok(hairTravel>65,`Hair moved only ${hairTravel}px`);
  assert.ok(clothTravel>25,`Cloth moved only ${clothTravel}px`);
});

test('roots and neck stay anchored and controls can remove all wind',()=>{
  for(let t=0;t<20;t+=.13){
    assert.deepEqual(wind.deformation(340,70,t,hair),[0,0]);
    assert.deepEqual(wind.deformation(340,640,t,shirt),[0,0]);
    assert.deepEqual(wind.deformation(100,690,t,{...hair,wind:0}),[0,0]);
    assert.deepEqual(wind.deformation(650,900,t,{hair:0,shirt:0,wind:1.5}),[0,0]);
    assert.equal(wind.deformation(340,970,t,shirt)[1],0,'The cropped lower hem must stay level');
  }
});

test('neither mesh folds over itself at maximum control settings',()=>{
  for(const category of ['hair','front-hair','back-hair','shirt']){
    const settings={hair:category.includes('hair')?1.5:0,shirt:category==='shirt'?1.5:0,wind:1.5,frontHair:category==='front-hair',backHair:category==='back-hair'};
    for(let t=0;t<20;t+=.4)for(let y=0;y<970;y+=22)for(let x=0;x<708;x+=22){
      const p=wind.deformation(x,y,t,settings),a=wind.deformation(x+.2,y,t,settings),b=wind.deformation(x,y+.2,t,settings);
      const determinant=(1+(a[0]-p[0])/.2)*(1+(b[1]-p[1])/.2)-(a[1]-p[1])/.2*(b[0]-p[0])/.2;
      assert.ok(determinant>.05,`${category} mesh folds at ${x},${y},${t}`);
    }
  }
});

test('the back silhouette flows past the ear while crown, clip, and ear contacts stay attached',()=>{
  const back={...hair,backHair:true};let outer=0,inner=0,contact=0;
  for(let t=0;t<20;t+=.05){
    outer=Math.max(outer,Math.hypot(...wind.deformation(680,430,t,back)));
    inner=Math.max(inner,Math.hypot(...wind.deformation(550,580,t,back)));
    contact=Math.max(contact,Math.hypot(...wind.deformation(536,423,t,back)));
    for(const [x,y] of [[267,66],[530,170],[600,215],[652,230]])assert.deepEqual(wind.deformation(x,y,t,back),wind.deformation(x,y,t,hair));
    assert.deepEqual(wind.deformation(110,695,t,back),wind.deformation(110,695,t,hair));
    assert.deepEqual(wind.deformation(680,430,t,{...back,wind:0}),[0,0]);
  }
  assert.ok(outer>25&&outer<55,'The outer silhouette should bend without a rigid ear-height band');
  assert.ok(inner>40&&inner<85,'Longer inner ends should retain a strong sweep');
  assert.ok(contact<1,'The hair pulled away from the ear attachment');
});

test('the back bob bends with limited shortening instead of folding its ends upward',()=>{
  const back={...hair,backHair:true};
  for(let t=0;t<20;t+=.03)for(const [x,y] of [[550,580],[610,550],[680,430]]){
    const [dx,dy]=wind.deformation(x,y,t,back);
    assert.ok(Math.abs(dy)<9,'A lock lost too much hanging length');
    assert.ok(Math.abs(dy)<=Math.abs(dx)*.2+.01,'The bend lifted the ends like a flap');
  }
});

test('back hair has distinct damped responses with smooth deterministic loop joins',()=>{
  const peaks=[];
  for(const outer of [0,1]){
    let peak=-Infinity,at=0;
    for(let t=0;t<6;t+=.005){const value=wind.backResponse(t,outer);if(value>peak){peak=value;at=t;}}
    peaks.push(at);assert.ok(peak>.9&&peak<1.2);
    for(const t of [0,1.7,2.33,6.5,14.1,19.999]){
      assert.ok(Math.abs(wind.backResponse(t,outer)-wind.backResponse(t+20,outer))<1e-10);
      const e=.00001,left=(wind.backResponse(t,outer)-wind.backResponse(t-e,outer))/e,right=(wind.backResponse(t+e,outer)-wind.backResponse(t,outer))/e;
      assert.ok(Math.abs(left-right)<.001,'The damped response has a velocity jump');
    }
    assert.equal(wind.backResponse(0,outer),0);assert.equal(wind.backResponse(20,outer),0);
  }
  assert.ok(peaks[0]>peaks[1]+.1,'The longer lock should reach its peak later');
});

test('the right bang bends through the middle while the scalp and ear contact stay attached',()=>{
  const front={...hair,frontHair:true};let middle=0,contact=0;
  for(let time=0;time<20;time+=.05){
    middle=Math.max(middle,Math.hypot(...wind.deformation(480,400,time,front)));
    contact=Math.max(contact,Math.hypot(...wind.deformation(527,438,time,front)));
    assert.deepEqual(wind.deformation(331,56,time,front),[0,0]);
    assert.deepEqual(wind.deformation(480,400,time,hair),[0,0]);
    assert.deepEqual(wind.deformation(110,695,time,front),wind.deformation(110,695,time,hair));
  }
  assert.ok(middle>15,'The middle of the bang is still rigid');
  assert.ok(contact<3,'The outer edge pulled away from the ear');
});
