const test=require('node:test'),assert=require('node:assert/strict');
const {compute,particleMetrics}=require('../javascript/sachi-layout.js');

test('1080p keeps the original character framing and clock scale',()=>{
  const layout=compute(1920,1080);
  assert.equal(layout.mode,'landscape');assert.equal(layout.scale,1);
  assert.equal(layout.x,0);assert.equal(layout.y,80);assert.equal(layout.clock.size,80);
});

test('portrait phones and tablets keep the clock above the character and inside safe areas',()=>{
  for(const [width,height] of [[320,568],[390,844],[430,932],[768,1024],[1024,1366],[600,600]]){
    const layout=compute(width,height,undefined,{top:44,bottom:34,left:10,right:10});
    assert.equal(layout.mode,'portrait');assert.equal(layout.parallax,0);
    assert.ok(layout.art.top>layout.clock.top+layout.clock.height);
    assert.ok(layout.art.left>=10);assert.ok(layout.art.left+layout.art.width<=width-10);
    assert.ok(layout.clock.top>=44);assert.ok(layout.art.top>0);
    assert.ok(layout.art.top+layout.art.height>=height);
  }
});

test('landscape laptops, phones, ultrawide and 4K screens preserve proportions',()=>{
  for(const [w,h] of [[568,320],[844,390],[1024,768],[1366,768],[1440,900],[2560,1440],[3440,1440],[5120,1440],[3840,2160]]){
    const layout=compute(w,h);
    assert.equal(layout.mode,'landscape');assert.ok(layout.scale>0);
    assert.ok(layout.art.top>=0&&layout.art.left>0);
    assert.ok(layout.art.left+layout.art.width<w*.65);
    assert.ok(layout.clock.right>0&&layout.clock.bottom>0);
    assert.ok(layout.parallax<=24);
    assert.ok(Math.abs(layout.art.width/layout.art.height-708/970)<1e-8);
  }
});

test('particle density follows viewport area and backing pixels stay bounded on high-DPI screens',()=>{
  const desktop=particleMetrics(1920,1080),phone=particleMetrics(390,844,3),huge=particleMetrics(7680,4320,3);
  assert.equal(desktop.stars,1000);assert.ok(phone.stars<200);assert.equal(phone.ratio,2);
  assert.ok(huge.pixelWidth*huge.pixelHeight<=3840*2160);assert.equal(huge.stars,2000);
  assert.equal(particleMetrics(390,844,3,0,0).stars,0);assert.equal(particleMetrics(390,844,3,0,0).shooting,0);
});
