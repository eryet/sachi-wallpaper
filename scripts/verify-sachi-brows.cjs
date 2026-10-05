/* Verify face/bang independence against the local preview, including Canvas fallback. */
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
        const node=p.nodes.get('brow-right');
        const run=p.rigRuns.find(r=>r.ids.includes('brow-right'));
        const result={mode,bounds:node.bounds,facePass:run.pass==='face',joinedBacking:run.ids.includes('brow-right-continuation'),behindBangs:p.rigRuns.indexOf(run)<p.rigRuns.findIndex(r=>r.pass==='front-hair'),windChecks:0};
        p.rigView.solo='brow-right';p.setOptions({hair:1.5,face:1,shirt:0});
        for(const time of [0,1.5,2.8,3.92,5,7.8,12.3,14.23,17,19.9]){
          p.setOptions({wind:0});p.seek(time);const still=p.canvas.toDataURL();
          p.setOptions({wind:1.5});p.seek(time);
          if(still!==p.canvas.toDataURL())throw Error('Hair wind moved the eyebrow at '+time);
          result.windChecks++;
        }
        const capture=document.createElement('canvas');capture.width=p.canvas.width;capture.height=p.canvas.height;
        const ctx=capture.getContext('2d',{willReadFrequently:true});
        const centroid=()=>{ctx.clearRect(0,0,capture.width,capture.height);ctx.drawImage(p.canvas,0,0);const data=ctx.getImageData(0,0,capture.width,capture.height).data;let weight=0,x=0;for(let i=0;i<data.length;i+=4){const a=data[i+3];weight+=a;x+=a*((i/4)%capture.width);}return x/weight;};
        const project=SachiRig.preset(SachiAtlas);project.parts['brow-right'].tracks={};
        p.setRig(project);p.seek(0);const before=centroid();
        project.parts['brow-right'].values.x=8;p.setRig(project);p.seek(0);
        result.expressionTravel=centroid()-before;
        return result;
      },mode);
      console.log(JSON.stringify(result));
      assert.ok(result.bounds[1]<255&&result.bounds[1]+result.bounds[3]<310,'The brow layer still contains the eyelid crease');
      assert.ok(result.facePass&&result.joinedBacking&&result.behindBangs);
      assert.ok(Math.abs(result.expressionTravel-8)<.1,'The brow no longer follows its expression control');
      assert.deepEqual(errors,[]);results.push(result);
    }finally{await browser.close();}
  }
  const sourceSha256=require('node:crypto').createHash('sha256').update(await fs.readFile(path.join(root,'images/sachi_ai_scale.svg'))).digest('hex');
  await fs.writeFile(path.join(root,'images/sachi-rig/brow-validation.json'),JSON.stringify({sourceSha256,results},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
