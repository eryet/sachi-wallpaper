/* Source-lash clearance, ear coverage and rendered loop continuity. */
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
  const results=[];
  for(const mode of ['chromium','canvas','webkit']){
    const browser=await (mode==='webkit'?webkit:chromium).launch({headless:true});
    try{
      const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto((process.env.SACHI_PREVIEW_URL||'http://127.0.0.1:8765')+'/animation-preview.html');
      await page.waitForFunction(()=>window.sachiPreview?.ready&&sachiPreview.rig);
      const result=await page.evaluate(mode=>{
        const p=sachiPreview;p.pause();p.seek(0);if(mode==='canvas')p.wind.fallback();
        const result={mode,lashSamples:0,minClearedLashRed:255,earSamples:0,minEarAlpha:255,frames:0,loopMatches:0};
        const capture=document.createElement('canvas');capture.width=p.canvas.width;capture.height=p.canvas.height;
        const ctx=capture.getContext('2d',{willReadFrequently:true});
        const read=()=>{ctx.clearRect(0,0,capture.width,capture.height);ctx.drawImage(p.canvas,0,0);return ctx.getImageData(0,0,capture.width,capture.height).data;};
        for(const side of ['left','right']){
          const eye=p.eyes[side],w=eye.original.width,h=eye.original.height;
          const original=eye.original.getContext('2d').getImageData(0,0,w,h).data;
          const context=p.context;p.context=ctx;
          for(const closure of [.4,.7,1]){
            p.drawEye(side,closure);
            const painted=eye.work.getContext('2d').getImageData(0,0,w,h).data,curve=SachiAnimation.eyeCurves(side,closure).upper;
            for(let y=0;y<h;y++)for(let x=0;x<w;x++){
              const i=(y*w+x)*4,wx=x+eye.x,wy=y+eye.y;
              // Leave room for the thick moving upper lash itself. Inspect
              // the old ink above its full compressed thickness.
              const clearance=35*(1-.66*closure)+3;
              if(original[i+3]<250||original[i]>=48||wx<curve[0][0]+14||wx>curve[3][0]-14||wy>=SachiAnimation.curveY(curve,wx)-clearance)continue;
              if(painted[i]<result.minClearedLashRed){result.minClearedLashRed=painted[i];result.darkestLashSample={side,closure,x:wx,y:wy};}result.lashSamples++;
            }
          }
          p.context=context;
        }
        for(const strength of [1,1.5]){
          p.setOptions({face:strength,hair:strength,shirt:strength,wind:strength});
          p.seek(0);const first=p.canvas.toDataURL();p.seek(20);
          if(p.canvas.toDataURL()===first)result.loopMatches++;
          for(let frame=0;frame<80;frame++){
            const time=frame/4;p.seek(time);const data=read();result.frames++;
            const state=SachiAnimation.sample(time,p.settings),h=SachiRig.pose(p.rig.parts.head,time);
            const pose={head:{x:h.x*strength,y:h.y*strength,r:h.r*strength+state.poses.head.r,pivot:p.rig.parts.head.pivot},root:state.poses.sachi};
            for(let y=356;y<=367;y++)for(let x=546;x<=560;x++){
              const point=SachiWind.posePoint(x,y,pose),px=Math.round(point[0]+p.padding),py=Math.round(point[1]+p.padding);
              result.minEarAlpha=Math.min(result.minEarAlpha,data[(py*capture.width+px)*4+3]);result.earSamples++;
            }
          }
        }
        return result;
      },mode);
      console.log(JSON.stringify(result));
      assert.ok(result.lashSamples>100,'No original lash pixels were examined');
      assert.ok(result.minClearedLashRed>80,'Original lash ink remains above the moving eyelid');
      assert.equal(result.minEarAlpha,255,'A gap opened between the ear and the back hair');
      assert.equal(result.loopMatches,2,'The rendered loop does not return to the same frame');
      assert.deepEqual(errors,[]);results.push(result);
    }finally{await browser.close();}
  }
  const sourceSha256=require('node:crypto').createHash('sha256').update(await fs.readFile(path.join(root,'images/sachi_ai_scale.svg'))).digest('hex');
  await fs.writeFile(path.join(root,'images/sachi-rig/detail-validation.json'),JSON.stringify({sourceSha256,results},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
