/* Run against the local preview server. PLAYWRIGHT_MODULE can select a shared install. */
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),url=process.env.SACHI_PREVIEW_URL||'http://127.0.0.1:8765';

(async()=>{
  const results=[];
  for(const mode of ['chromium','canvas','webkit']){
    const browser=await (mode==='webkit'?webkit:chromium).launch({headless:true});
    try{
      const page=await browser.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(url+'/animation-preview.html');
      await page.waitForFunction(()=>window.sachiPreview?.ready&&sachiPreview.rig);
      const result=await page.evaluate(mode=>{
        const p=sachiPreview;p.pause();p.seek(0);
        if(mode==='canvas')p.wind.fallback();
        const capture=document.createElement('canvas');capture.width=p.canvas.width;capture.height=p.canvas.height;
        const ctx=capture.getContext('2d',{willReadFrequently:true});
        // The visible canvas is the GPU surface; p.context is only the static
        // source painting context. Read the displayed animation, not that cache.
        const readFrame=()=>{ctx.clearRect(0,0,capture.width,capture.height);ctx.drawImage(p.canvas,0,0);return ctx.getImageData(0,0,capture.width,capture.height).data;};
        const result={mode,renderer:p.wind.mode,frames:0,neckSamples:0,maxNeckRed:0,minNeckAlpha:255};
        for(const strength of [1,1.5]){
          p.setOptions({face:strength,hair:strength,shirt:strength,wind:strength});
          for(let frame=0;frame<80;frame++){
            const time=frame/4;p.seek(time);result.frames++;
            const state=SachiAnimation.sample(time,p.settings),h=SachiRig.pose(p.rig.parts.head,time);
            const pose={neck:true,head:{x:h.x*strength,y:h.y*strength,r:h.r*strength+state.poses.head.r,pivot:p.rig.parts.head.pivot},root:state.poses.sachi};
            const image=readFrame();
            // Cross the old face/neck cut inside the black shadow. A pale
            // underpaint seam used to cross these otherwise dark source pixels.
            for(let y=646;y<=659;y++)for(let x=230;x<=240;x++){
              const point=SachiWind.posePoint(x,y,pose),px=Math.round(point[0]+p.padding),py=Math.round(point[1]+p.padding),i=(py*p.canvas.width+px)*4;
              result.maxNeckRed=Math.max(result.maxNeckRed,image[i]);
              result.minNeckAlpha=Math.min(result.minNeckAlpha,image[i+3]);result.neckSamples++;
            }
          }
        }
        // Fixed regression landmarks from the reproduced 2.8-second pose:
        // the face cut, lower collar cut, and their meeting point, respectively.
        p.setOptions({face:1,hair:1,shirt:1,wind:1});p.seek(2.8);
        const image=readFrame();
        result.joinLandmarks=[[347,709],[340,710],[321,716]].map(([x,y])=>{const i=(y*capture.width+x)*4;return {x,y,rgba:[...image.slice(i,i+4)]};});
        // Uniform opaque fabric exposes cracks in the Canvas triangle clips
        // independently of the illustration's intentional transparent gaps.
        const renderer=new SachiWind.Renderer(512,800);renderer.fallback();
        const source=document.createElement('canvas');source.width=512;source.height=800;
        const ink=source.getContext('2d');ink.fillStyle='#080c18';ink.fillRect(0,0,512,800);
        result.minMeshAlpha=255;result.meshSamples=0;
        for(const time of [0,1,2.8,3.92,5,12.3,19.9]){
          renderer.beginFrame();renderer.draw(source,time,{hair:0,shirt:1.5,wind:1.5},[0,0],'solid',1,{neck:true,head:{x:-2.4,y:3.8,r:-2.3,pivot:[322,635]}},[0,0,512,800]);
          const data=renderer.context.getImageData(100,550,300,190).data;
          for(let i=3;i<data.length;i+=4){result.minMeshAlpha=Math.min(result.minMeshAlpha,data[i]);result.meshSamples++;}
        }
        renderer.destroy();return result;
      },mode);
      console.log(JSON.stringify(result));
      assert.equal(result.renderer,mode==='canvas'?'canvas':'webgl');
      assert.ok(result.maxNeckRed<=30,`Pale neck seam: red channel reached ${result.maxNeckRed}`);
      assert.equal(result.minNeckAlpha,255,'A transparent crack opened inside the neck');
      for(const point of result.joinLandmarks)assert.ok(point.rgba[0]<=30&&point.rgba[3]===255,`Pale cut edge at ${point.x},${point.y}: ${point.rgba}`);
      assert.equal(result.minMeshAlpha,255,'Canvas triangle clips exposed a seam');
      assert.deepEqual(errors,[]);results.push(result);
    }finally{await browser.close();}
  }
  const sourceSha256=require('node:crypto').createHash('sha256').update(await fs.readFile(path.join(root,'images/sachi_ai_scale.svg'))).digest('hex');
  await fs.writeFile(path.join(root,'images/sachi-rig/neck-validation.json'),JSON.stringify({sourceSha256,strengths:[1,1.5],loopSeconds:20,sampleIntervalSeconds:.25,results},null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
