/* Responsive placement shared by the static illustration and animated layers. */
(function(scope,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else scope.SachiLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ART=[130,81,708,970],clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  function compute(width,height,art=ART,safe={}){
    width=Math.max(1,width);height=Math.max(1,height);
    const left=clamp(safe.left||0,0,width*.25),right=clamp(safe.right||0,0,width*.25);
    const top=clamp(safe.top||0,0,height*.25),bottom=clamp(safe.bottom||0,0,height*.25);
    const w=width-left-right,h=height-top-bottom,portrait=w/h<1.15;
    let scale,artLeft,artTop,clock;
    if(portrait){
      const gap=clamp(w*.055,16,48),time=clamp(w*.145,28,96),date=clamp(w*.043,12,26);
      const clockTop=top+clamp(h*.07,24,80),clockHeight=time*1.2+date*1.75;
      scale=Math.min(w/(art[2]+32),Math.max(1,h-(clockTop-top)-clockHeight-gap)/(art[3]-36));
      artLeft=left+(w-art[2]*scale)/2;
      // Continue the cropped illustration below the phone's home indicator.
      artTop=height-(art[3]-36)*scale;
      clock={size:time,date,top:clockTop,center:left+w/2,height:clockHeight};
    }else{
      const contentWidth=Math.min(w,h*2.2),offset=(w-contentWidth)/2;
      scale=Math.min(h/1080,w*.58/(art[2]+64));
      artLeft=left+offset+contentWidth*130/1920;
      artTop=height-(art[3]-51)*scale;
      clock={size:clamp(80*scale,22,160),date:clamp(24*scale,9,48),right:right+offset+contentWidth*140/1920,bottom:bottom+h*72/1080};
    }
    return {mode:portrait?'portrait':'landscape',width,height,scale,x:artLeft-art[0]*scale,y:artTop-art[1]*scale,
      art:{left:artLeft,top:artTop,width:art[2]*scale,height:art[3]*scale},clock,parallax:portrait?0:Math.min(24,24*scale)};
  }
  function particleMetrics(width,height,pixelRatio=1,count=1000,shooting=5){
    width=Math.max(1,width);height=Math.max(1,height);
    const area=width*height,density=clamp(area/(1920*1080),.08,2);
    const ratio=Math.min(Math.max(1,pixelRatio),2,Math.sqrt(3840*2160/area));
    return {width,height,ratio,pixelWidth:Math.max(1,Math.round(width*ratio)),pixelHeight:Math.max(1,Math.round(height*ratio)),
      stars:Math.round(Math.max(0,count)*density),shooting:Math.round(Math.max(0,shooting)*clamp(Math.sqrt(density),.4,1.4))};
  }
  function mount(root){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
    let state,resizeFrame=0,motionFrame=0,x=0,y=0,targetX=0,targetY=0,destroyed=false;
    const set=(name,value)=>root.style.setProperty(name,value+'px');
    const drift=()=>{set('--drift-x',x);set('--drift-y',y);set('--clock-drift-x',x*.3);set('--clock-drift-y',y*.3);};
    const reset=()=>{cancelAnimationFrame(motionFrame);motionFrame=0;x=y=targetX=targetY=0;drift();};
    function update(){
      resizeFrame=0;if(destroyed)return;
      const style=getComputedStyle(root),safe={};for(const side of ['left','right','top','bottom'])safe[side]=parseFloat(style.getPropertyValue('--safe-'+side))||0;
      state=compute(root.clientWidth,root.clientHeight,window.SachiAtlas?.artBounds||ART,safe);
      root.dataset.layout=state.mode;set('--character-x',state.x);set('--character-y',state.y);root.style.setProperty('--character-scale',state.scale);
      set('--clock-size',state.clock.size);set('--date-size',state.clock.date);
      for(const key of ['top','bottom','right','center'])set('--clock-'+key,state.clock[key]||0);
      reset();root.dispatchEvent(new CustomEvent('wallpaperresize',{detail:state}));
    }
    const schedule=()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(update);};
    function animate(){
      motionFrame=0;if(destroyed)return;x+=(targetX-x)*.12;y+=(targetY-y)*.12;drift();
      if(Math.abs(targetX-x)+Math.abs(targetY-y)>.02)motionFrame=requestAnimationFrame(animate);
    }
    function pointer(event){
      if(!state||!fine.matches||reduced.matches||event.pointerType==='touch'||!state.parallax)return;
      targetX=(.5-clamp(event.clientX/state.width,0,1))*2*state.parallax;
      targetY=(.5-clamp(event.clientY/state.height,0,1))*state.parallax;
      if(!motionFrame)motionFrame=requestAnimationFrame(animate);
    }
    const observer=new ResizeObserver(schedule);observer.observe(root);
    window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
    window.addEventListener('pointermove',pointer,{passive:true});document.documentElement.addEventListener('pointerleave',reset);window.addEventListener('blur',reset);
    reduced.addEventListener('change',reset);fine.addEventListener('change',reset);update();
    return {get state(){return state;},refresh:update,destroy(){destroyed=true;cancelAnimationFrame(resizeFrame);reset();observer.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.removeEventListener('pointermove',pointer);document.documentElement.removeEventListener('pointerleave',reset);window.removeEventListener('blur',reset);reduced.removeEventListener('change',reset);fine.removeEventListener('change',reset);}};
  }
  return {compute,particleMetrics,mount};
});
