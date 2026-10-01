const test=require('node:test'),assert=require('node:assert/strict');
const {PRESETS,plan}=require('../javascript/sachi-gif-export.js');
const Codec=require('../javascript/sachi-gif-codec.js');

test('GIF presets use the selected pixel size independently of the preview window',()=>{
  for(const preset of Object.keys(PRESETS))for(const [width,height] of [[1300,720],[300,460],[600,600]]){
    const p=plan({preset,width,height});
    assert.equal(Math.max(p.width,p.height),PRESETS[preset].edge);
    assert.ok(Math.abs(p.width/p.height-width/height)<.01);
  }
  assert.deepEqual([plan({preset:'ultra',width:320,height:180}).width,plan({preset:'ultra',width:320,height:180}).height],[1920,1080]);
});

test('GIF timing preserves the chosen speed with bounded frames and an exact cyclic endpoint',()=>{
  for(const preset of Object.keys(PRESETS))for(const speed of [.1,.25,.55,.95,1,1.15,1.55,2]){
    const p=plan({preset,width:1200,height:700,speed});
    assert.ok(p.frames<=1000);assert.equal(p.times[0],0);assert.ok(p.times.at(-1)<20);
    assert.equal(p.delays.reduce((a,b)=>a+b,0),Math.round(2000/speed)*10);
    for(let i=0;i<p.frames;i++){
      assert.ok(p.delays[i]>=20&&p.delays[i]%10===0);
      assert.ok(Math.abs(p.delays.slice(0,i).reduce((a,b)=>a+b,0)/1000-p.times[i]/speed)<.011);
    }
  }
});

test('GIF export rejects invalid settings instead of allocating unbounded images',()=>{
  for(const changes of [{preset:'huge'},{preset:'toString'},{preset:'__proto__'},{width:0},{height:Infinity},{speed:0},{speed:3},{duration:200}])assert.throws(()=>plan({width:600,height:400,...changes}));
  assert.throws(()=>Codec.create(new Uint8Array(4),2000,2000));
  assert.throws(()=>Codec.create(new Uint8Array(4),65536,1));
});

test('high-quality GIFs retain their frame rates and encode at full HD resolution',()=>{
  const high=plan({preset:'high',width:320,height:180}),ultra=plan({preset:'ultra',width:320,height:180});
  assert.equal(high.frames,600);assert.equal(ultra.frames,1000);assert.ok(ultra.delays.every(delay=>delay===20));
  const rgba=new Uint8Array(1920*1080*4);for(let i=3;i<rgba.length;i+=4)rgba[i]=255;
  const encoder=Codec.create(new Uint8Array([0,0,0,255]),1920,1080);encoder.write(rgba,20);
  const bytes=Buffer.from(encoder.finish());assert.equal(bytes.readUInt16LE(6),1920);assert.equal(bytes.readUInt16LE(8),1080);assert.equal(bytes.at(-1),0x3b);
});

test('the encoder writes an animated GIF with a reusable palette and infinite repeat',()=>{
  const pixels=new Uint8Array([255,0,0,255,0,0,255,255,0,0,255,255,255,0,0,255]);
  const encoder=Codec.create(pixels,2,2);encoder.write(pixels,50);encoder.write(pixels,80);
  const bytes=encoder.finish(),data=Buffer.from(bytes);
  assert.equal(data.subarray(0,6).toString(),'GIF89a');assert.equal(data.at(-1),0x3b);
  assert.equal(data.readUInt16LE(6),2);assert.equal(data.readUInt16LE(8),2);
  const loop=data.indexOf('NETSCAPE2.0');assert.ok(loop>0);assert.equal(data.readUInt16LE(loop+13),0);
  const control=[];for(let i=0;i<data.length-7;i++)if(data[i]===0x21&&data[i+1]===0xf9&&data[i+2]===4)control.push(data[i+3]);
  assert.deepEqual(control,[4,5],'Opaque first frame, then keep-previous transparent deltas');
  assert.throws(()=>encoder.write(pixels,50));assert.throws(()=>encoder.finish());
});

test('transparent GIF frames clear prior poses and reserve palette index zero',()=>{
  const rgba=new Uint8Array([5,10,15,0,100,120,200,255,100,120,200,100,100,120,200,255]);
  const encoder=Codec.create(rgba.slice(),2,2,true);encoder.write(rgba.slice(),50);encoder.write(rgba.slice(),50);
  const data=Buffer.from(encoder.finish()),controls=[];
  assert.equal(data[10]&7,0,'Only one visible color plus the reserved index; transparent samples do not dilute the palette');
  for(let i=0;i<data.length-7;i++)if(data[i]===0x21&&data[i+1]===0xf9&&data[i+2]===4)controls.push({flags:data[i+3],transparent:data[i+6]});
  assert.equal(controls.length,2);
  for(const c of controls){assert.equal(c.flags&1,1);assert.equal(c.flags>>2&7,2);assert.equal(c.transparent,0);}
  assert.deepEqual([...Codec.binaryAlpha(rgba)].filter((_,i)=>i%4===3),[0,255,0,255]);
});
