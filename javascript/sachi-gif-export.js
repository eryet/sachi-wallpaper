/* Deterministic GIF export of the current preview, without moving its playhead. */
(function(scope,factory){const api=factory(typeof module==='object'&&module.exports?require('./sachi-gif-codec.js'):scope.SachiGifCodec);if(typeof module==='object'&&module.exports)module.exports=api;else scope.SachiGifExport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Codec){
  'use strict';
  const PRESETS={compact:{edge:360,fps:12,label:'Compact'},balanced:{edge:640,fps:20,label:'Balanced'},detailed:{edge:960,fps:25,label:'Detailed'}};
  function plan({preset='balanced',width,height,speed=1,duration=20}){
    const choice=PRESETS[preset];
    if(!choice||![width,height,speed,duration].every(Number.isFinite)||width<=0||height<=0||speed<.1||speed>2||duration!==20)throw new Error('Invalid GIF export settings.');
    const scale=Math.min(1,choice.edge/Math.max(width,height));
    // Slowing down changes delays, not the number of source samples. This
    // preserves the selected speed without producing thousands of duplicate
    // intermediate frames or accumulating a full RGBA animation in memory.
    const frames=Math.ceil(duration*choice.fps/Math.max(1,speed)),ticks=Math.round(duration/speed*100);
    return {preset,width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),frames,duration:ticks/100,speed,
      times:Array.from({length:frames},(_,i)=>i*duration/frames),
      delays:Array.from({length:frames},(_,i)=>(Math.round((i+1)*ticks/frames)-Math.round(i*ticks/frames))*10)};
  }
  const abortError=()=>new DOMException('Export cancelled.','AbortError');
  const check=signal=>{if(signal?.aborted)throw abortError();};
  const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
  function abortable(promise,signal){
    check(signal);if(!signal)return promise;
    return new Promise((resolve,reject)=>{
      const abort=()=>reject(abortError());signal.addEventListener('abort',abort,{once:true});
      promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
    });
  }
  function cover(ctx,image,width,height){
    const scale=Math.max(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;
    ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h);
  }
  async function encoderFor(samples,info,transparent,signal){
    let worker,pending=null,nextId=0;
    const close=()=>{worker?.terminate();worker=null;if(pending){pending.reject(abortError());pending=null;}};
    signal?.addEventListener('abort',close,{once:true});
    const cleanup=()=>{signal?.removeEventListener('abort',close);close();};
    try{
      worker=new Worker(new URL('javascript/sachi-gif-worker.js',document.baseURI));
      worker.onmessage=event=>{if(!pending||pending.id!==event.data.id)return;const job=pending;pending=null;if(event.data.error)job.reject(new Error(event.data.error));else job.resolve(event.data.bytes);};
      worker.onerror=event=>{event.preventDefault();if(pending){const job=pending;pending=null;job.reject(new Error('GIF worker could not finish.'));}};
      const call=(type,data,transfer=[])=>new Promise((resolve,reject)=>{check(signal);const id=++nextId;pending={id,resolve,reject};try{worker.postMessage({id,type,...data},transfer);}catch(error){pending=null;reject(error);}});
      // Keep the small palette sample buffer until initialization succeeds, so
      // browsers that disable workers can use the local encoder instead.
      await call('init',{samples:samples.buffer,width:info.width,height:info.height,transparent});
      return {write:(rgba,delay)=>call('frame',{rgba:rgba.buffer,delay},[rgba.buffer]),finish:async()=>new Uint8Array(await call('finish',{})),close:cleanup};
    }catch(error){cleanup();check(signal);}
    const encoder=Codec.create(samples,info.width,info.height,transparent);
    return {write:async(rgba,delay)=>{check(signal);encoder.write(rgba,delay);await yieldUI();},finish:async()=>encoder.finish(),close(){}};
  }
  async function render({player,scene,preset='balanced',background=true,transparent=false,signal,onProgress=()=>{}}){
    if(!player.ready)throw new Error('Wait for the character to finish loading.');
    check(signal);
    const settings={...player.settings},rig=player.rig?structuredClone(player.rig):null;
    const info=plan({preset,width:scene.clientWidth,height:scene.clientHeight,speed:settings.speed});
    let clone,holder,encoder;
    try{
      onProgress({phase:'Preparing colors',done:0,total:10,progress:0});
      holder=document.createElement('div');holder.setAttribute('aria-hidden','true');holder.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none';
      const canvas=document.createElement('canvas');holder.append(canvas);document.body.append(holder);
      clone=new SachiAnimation.Player(canvas,player.atlas,{...settings,framing:player.framing,padding:player.padding,imageUrl:player.image.src});
      await abortable(clone.loaded,signal);check(signal);clone.setRig(rig);
      const frame=document.createElement('canvas');frame.width=info.width;frame.height=info.height;
      const ctx=frame.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingQuality='high';
      const backdrop=document.createElement('canvas');backdrop.width=info.width;backdrop.height=info.height;
      const bg=backdrop.getContext('2d');
      if(!transparent){
        bg.fillStyle='#162137';bg.fillRect(0,0,info.width,info.height);
        if(background){
          const image=new Image();image.src=new URL('images/background.jpg',document.baseURI);
          await abortable(image.decode(),signal);check(signal);cover(bg,image,info.width,info.height);
          bg.fillStyle='#12203888';bg.fillRect(0,0,info.width,info.height);
        }
      }
      const compose=time=>{
        clone.seek(time);ctx.clearRect(0,0,info.width,info.height);ctx.drawImage(backdrop,0,0);
        const scale=Math.min(info.width/clone.canvas.width,info.height/clone.canvas.height),w=clone.canvas.width*scale,h=clone.canvas.height*scale;
        ctx.drawImage(clone.canvas,(info.width-w)/2,(info.height-h)/2,w,h);
      };
      const thumbnail=document.createElement('canvas'),ratio=Math.min(1,240/Math.max(info.width,info.height));
      thumbnail.width=Math.max(1,Math.round(info.width*ratio));thumbnail.height=Math.max(1,Math.round(info.height*ratio));
      const thumb=thumbnail.getContext('2d',{willReadFrequently:true}),sampleTimes=[0,2,3.92,5,7.8,10,12.5,14.11,16.5,19];
      const stride=thumbnail.width*thumbnail.height*4,copies=transparent?1:3,samples=new Uint8Array(stride*sampleTimes.length*copies);
      for(const [i,time] of sampleTimes.entries()){
        check(signal);compose(time);thumb.clearRect(0,0,thumbnail.width,thumbnail.height);thumb.drawImage(frame,0,0,thumbnail.width,thumbnail.height);
        samples.set(thumb.getImageData(0,0,thumbnail.width,thumbnail.height).data,i*stride*copies);
        if(!transparent){
          // Give face and clothing gradients more palette weight than the
          // photographic backdrop. Transparent samples are ignored by the codec.
          thumb.clearRect(0,0,thumbnail.width,thumbnail.height);const s=Math.min(thumbnail.width/clone.canvas.width,thumbnail.height/clone.canvas.height),w=clone.canvas.width*s,h=clone.canvas.height*s;
          thumb.drawImage(clone.canvas,(thumbnail.width-w)/2,(thumbnail.height-h)/2,w,h);
          const character=thumb.getImageData(0,0,thumbnail.width,thumbnail.height).data;
          for(let copy=1;copy<copies;copy++)samples.set(character,(i*copies+copy)*stride);
        }
        onProgress({phase:'Preparing colors',done:i+1,total:sampleTimes.length,progress:(i+1)/sampleTimes.length*.08});await yieldUI();
      }
      encoder=await encoderFor(samples,info,transparent,signal);
      for(let i=0;i<info.frames;i++){
        check(signal);compose(info.times[i]);
        await encoder.write(ctx.getImageData(0,0,info.width,info.height).data,info.delays[i]);
        onProgress({phase:'Rendering GIF',done:i+1,total:info.frames,progress:.08+.9*(i+1)/info.frames});
      }
      check(signal);onProgress({phase:'Finishing GIF',done:info.frames,total:info.frames,progress:.99});
      const bytes=await encoder.finish();check(signal);
      return {blob:new Blob([bytes],{type:'image/gif'}),info,settings,rig};
    }finally{encoder?.close();clone?.destroy();holder?.remove();}
  }
  function bindPreview(player,scene){
    const $=id=>document.getElementById(id),preset=$('gif-preset'),background=$('gif-background'),button=$('export-gif'),cancel=$('cancel-gif'),progress=$('gif-progress'),status=$('gif-status'),download=$('gif-download');
    let controller=null,url=null;
    const summary=()=>{
      try{const info=plan({preset:preset.value,width:scene.clientWidth,height:scene.clientHeight,speed:player.settings.speed});$('gif-summary').textContent=`${info.width} × ${info.height} · ${info.duration.toFixed(1)} s at ${info.speed}× · ${info.frames} frames · repeats forever`;}
      catch(error){$('gif-summary').textContent='Waiting for the preview…';}
    };
    const clearDownload=()=>{if(url)URL.revokeObjectURL(url);url=null;download.hidden=true;download.removeAttribute('href');};
    const exportGif=async()=>{
      if(controller)return;
      controller=new AbortController();const job=controller;clearDownload();
      button.disabled=preset.disabled=background.disabled=true;cancel.hidden=false;progress.hidden=false;progress.value=0;
      status.textContent='Preparing the current motion settings…';
      try{
        const result=await render({player,scene,preset:preset.value,transparent:background.value==='transparent',background:$('background').checked,signal:job.signal,
          onProgress:value=>{progress.value=value.progress;const percent=Math.floor(value.progress*100);if(status.dataset.percent!==String(percent)){status.dataset.percent=String(percent);status.textContent=`${value.phase} · ${percent}%`;}}});
        url=URL.createObjectURL(result.blob);download.href=url;download.download=`sachi-${result.info.preset}-${result.info.speed}x.gif`;download.hidden=false;
        download.textContent=`Download GIF · ${(result.blob.size/1048576).toFixed(1)} MB`;
        status.textContent=`Ready · ${result.info.width} × ${result.info.height} · ${result.info.duration.toFixed(1)} seconds`;progress.value=1;
        download.click();
      }catch(error){status.textContent=error.name==='AbortError'?'Export cancelled.':error.name==='SecurityError'?'Open this preview through the local server to export a GIF.':`Could not export: ${error.message}`;}
      finally{controller=null;button.disabled=preset.disabled=background.disabled=false;cancel.hidden=true;progress.hidden=true;delete status.dataset.percent;summary();}
    };
    button.addEventListener('click',exportGif);cancel.addEventListener('click',()=>controller?.abort());
    document.addEventListener('input',summary);preset.addEventListener('change',summary);
    new ResizeObserver(summary).observe(scene);player.loaded.then(summary,()=>{});
    window.addEventListener('pagehide',()=>{controller?.abort();clearDownload();});summary();
    return {exportGif,cancel:()=>controller?.abort()};
  }
  return {PRESETS,plan,render,bindPreview};
});
