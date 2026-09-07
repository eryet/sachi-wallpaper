/* Editable layer poses and cyclic motion tracks; shared by the editor and player. */
(function(scope,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else scope.SachiRig=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION=1,DURATION=20,STORAGE='sachi-layer-rig-v1',PRESET_REVISION=5;
  const PARAMETERS={x:{label:'Horizontal',min:-30,max:30,step:.1,unit:'px',value:0},y:{label:'Vertical',min:-30,max:30,step:.1,unit:'px',value:0},r:{label:'Rotation',min:-6,max:6,step:.05,unit:'°',value:0},bend:{label:'Tip bend',min:-35,max:35,step:.25,unit:'px',value:0},wind:{label:'Wind response',min:0,max:1.5,step:.05,unit:'×',value:1},lag:{label:'Wind delay',min:0,max:1,step:.05,unit:'s',value:0},close:{label:'Lid closure',min:0,max:1,step:.01,unit:'',value:0}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const phase=t=>((t%DURATION)+DURATION)%DURATION;
  const smooth=t=>t*t*(3-2*t);
  const label=id=>id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ');
  function bendStart(id,pivot,bottom){
    const locked=id==='hair-fringe-right'?.56:id.startsWith('hair-fringe-')?.62:id==='hair-side-left'?.18:id==='hair-side-right'?.25:id==='hair-face-strand'?.15:0;
    return pivot[1]+Math.max(80,bottom-pivot[1])*locked;
  }
  function create(atlas){
    return {format:'sachi-layer-rig',version:VERSION,presetRevision:PRESET_REVISION,name:'Sachi · passing gust',duration:DURATION,sourceSha256:atlas.sourceSha256,
      settings:{hair:1,face:1,shirt:1,wind:1},parts:Object.fromEntries(atlas.nodes.filter(n=>n.kind==='art').map(n=>[n.id,{pivot:[...n.pivot],visible:true,values:{},tracks:{}}]))};
  }
  // There is only one boundary key: 20 s is the same key as 0 s. Smoothstep
  // gives both sides of every key zero velocity, including the wrapping segment.
  function trackAt(keys,time,fallback=0,interpolation='ease'){
    if(!keys?.length)return fallback;
    if(keys.length===1)return keys[0].value;
    const t=phase(time);let right=keys.findIndex(key=>key.time>t);
    if(right<0)right=0;
    const left=(right+keys.length-1)%keys.length,a=keys[left],b=keys[right];
    let end=b.time,start=a.time,at=t;
    if(end<=start)end+=DURATION;if(at<start)at+=DURATION;
    const t01=clamp((at-start)/(end-start),0,1);
    if(interpolation==='flow'&&keys.length>2){
      const tangent=index=>{
        const current=keys[index],previous=keys[(index+keys.length-1)%keys.length],next=keys[(index+1)%keys.length];
        const h0=phase(current.time-previous.time),h1=phase(next.time-current.time),d0=(current.value-previous.value)/h0,d1=(next.value-current.value)/h1;
        if(d0*d1<=0)return 0;
        const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/d0+w1/d1);
      };
      const u=t01,u2=u*u,u3=u2*u,h=end-start;
      return (2*u3-3*u2+1)*a.value+(u3-2*u2+u)*h*tangent(left)+(-2*u3+3*u2)*b.value+(u3-u2)*h*tangent(right);
    }
    const u=smooth(t01);return a.value+(b.value-a.value)*u;
  }
  function pose(part,time){
    return Object.fromEntries(Object.entries(PARAMETERS).map(([key,p])=>[key,trackAt(part?.tracks?.[key],time,part?.values?.[key]??p.value,part?.interpolation)]));
  }
  function keyframe(part,key,time,value){
    if(!PARAMETERS[key]||!Number.isFinite(time)||!Number.isFinite(value))throw new Error('Invalid keyframe.');
    const spec=PARAMETERS[key],t=Math.round(phase(time)*100)/100%DURATION;
    const keys=(part.tracks[key]||[]).filter(k=>Math.abs(k.time-t)>.005);
    keys.push({time:t,value:clamp(value,spec.min,spec.max)});keys.sort((a,b)=>a.time-b.time);part.tracks[key]=keys;
  }
  function validate(input,atlas){
    if(!input||input.format!=='sachi-layer-rig'||input.version!==VERSION||input.duration!==DURATION)throw new Error('Choose a Sachi layer rig JSON with a 20-second loop.');
    if(input.sourceSha256!==atlas.sourceSha256&&!atlas.compatibleSourceSha256?.includes(input.sourceSha256))throw new Error('This rig belongs to a different version of the artwork.');
    const result=create(atlas);result.name=typeof input.name==='string'?input.name.slice(0,80):result.name;
    result.presetRevision=Number.isInteger(input.presetRevision)?input.presetRevision:1;
    for(const name of Object.keys(result.settings)){const value=input.settings?.[name];if(Number.isFinite(value))result.settings[name]=clamp(value,0,1.5);}
    for(const [id,part] of Object.entries(result.parts)){
      const data=input.parts?.[id];if(!data)continue;
      part.visible=data.visible!==false;
      if(data.interpolation==='flow')part.interpolation='flow';
      if(Array.isArray(data.pivot)&&data.pivot.length===2&&data.pivot.every(Number.isFinite))part.pivot=[clamp(data.pivot[0],0,708),clamp(data.pivot[1],0,970)];
      for(const [key,spec] of Object.entries(PARAMETERS)){
        if(Number.isFinite(data.values?.[key]))part.values[key]=clamp(data.values[key],spec.min,spec.max);
        const keys=data.tracks?.[key];
        if(keys!==undefined){if(!Array.isArray(keys)||keys.length>400)throw new Error('A track has too many keys or an invalid format.');
          for(const point of keys){if(!point||!Number.isFinite(point.time)||!Number.isFinite(point.value))throw new Error('A keyframe contains an invalid number.');keyframe(part,key,point.time,point.value);}}
      }
    }
    return result;
  }
  function legacyPreset(atlas){
    const project=create(atlas);
    // Small local follow-through sits on top of the existing continuous gust mesh.
    // Keep seam-sharing fabric parts neutral until their concealed edges are painted.
    for(const [id,amount] of [['hair-side-left',-3],['hair-face-strand',-2],['hair-fringe-center',-1.5],['collar-right-tip',-1.5],['cord-left',-2]]){
      for(const [time,value] of [[0,0],[1.6,amount*.35],[3,amount],[5.8,-amount*.2],[7.6,0],[11.8,amount*.8],[14,amount*.4],[17,0]])keyframe(project.parts[id],'bend',time,value);
    }
    for(const [time,value] of [[0,0],[2,-.2],[6,.12],[10,0],[13,-.15],[17,0]])keyframe(project.parts.head,'r',time,value);
    for(const id of ['brow-left','brow-right'])for(const [time,value] of [[0,0],[3,-.35],[6,0],[12,-.25],[16,0]])keyframe(project.parts[id],'y',time,value);
    return project;
  }
  function presetV2(atlas){
    const project=legacyPreset(atlas);
    const head=project.parts.head;head.pivot=[322,655];head.tracks={};head.interpolation='flow';
    for(const [parameter,keys] of Object.entries({
      r:[[0,0],[.8,-.06],[2.1,-.72],[3.5,-1.12],[5.2,-.35],[6.9,.3],[9,0],[10.4,-.08],[12.3,-.94],[14,-.6],[16.3,.24],[18.7,0]],
      x:[[0,0],[1,-.1],[3,-1.5],[4.8,-.8],[7,.25],[9.1,0],[12.5,-1.2],[14.6,-.5],[17,.2],[19,0]],
      y:[[0,0],[1.2,0],[3.2,.55],[5.5,.1],[7.8,-.2],[9.6,0],[12.8,.45],[15,.1],[17.7,-.15],[19,0]]
    }))for(const [t,v] of keys)keyframe(head,parameter,t,v);
    // Tips lag behind their roots; separate recoil times keep the silhouette alive.
    for(const [id,amount,delay] of [
      ['hair-fringe-left',-2.6,0],['hair-fringe-center',-3.2,-.15],['hair-fringe-right',-2.1,.2],
      ['hair-side-left',-8,.85],['hair-side-right',-5,1.05],['hair-face-strand',-4.5,.65]
    ]){
      const part=project.parts[id];part.tracks.bend=[];
      for(const [t,v] of [[0,0],[.55,0],[1.7+delay,amount*.55],[2.5+delay,amount],[4.7+delay,amount*.12],[5.9+delay,-amount*.28],[8.6+delay,0],[10.4+delay,amount*.4],[11.9+delay,amount*.88],[14.1+delay,amount*.1],[15.5+delay,-amount*.2],[18.5+delay,0]])keyframe(part,'bend',t,v);
    }
    return project;
  }
  function presetV3(atlas){
    const project=presetV2(atlas);
    // A shorter fringe responds first; the long lock and the cheek strand
    // arrive later, overshoot gently, and settle on different beats.
    for(const [id,amount,delay] of [
      ['hair-fringe-right',-4.5,.15],['hair-side-right',-10,.8],['hair-face-strand',-7,1.1]
    ]){
      const part=project.parts[id];part.tracks.bend=[];part.interpolation='flow';
      for(const [time,value] of [[0,0],[.55,0],[1.45+delay,amount*.48],
        [2.5+delay,amount],[4.5+delay,amount*.15],[5.7+delay,-amount*.27],
        [7.1+delay,amount*.06],[8.4+delay,0],[10.5+delay,amount*.44],
        [11.9+delay,amount*.9],[14+delay,amount*.12],[15.4+delay,-amount*.23],
        [16.9+delay,amount*.05],[18.6+delay,0]])keyframe(part,'bend',time,value);
    }
    return project;
  }
  function presetV4(atlas){
    const project=presetV3(atlas);
    // Continuous passing motion on both sides, with distinct recoil beats.
    // Roots and the reviewed right-hand tracks retain their attachments.
    for(const [id,amount,delay] of [
      ['hair-fringe-left',-2.6,0],['hair-fringe-center',-3.2,-.1],['hair-side-left',-8,.85]
    ]){
      const part=project.parts[id];part.tracks.bend=[];part.interpolation='flow';
      for(const [time,value] of [[0,0],[.55,0],[1.45+delay,amount*.48],
        [2.5+delay,amount],[4.5+delay,amount*.15],[5.7+delay,-amount*.27],
        [7.1+delay,amount*.06],[8.4+delay,0],[10.5+delay,amount*.44],
        [11.9+delay,amount*.9],[14+delay,amount*.12],[15.4+delay,-amount*.23],
        [16.9+delay,amount*.05],[18.6+delay,0]])keyframe(part,'bend',time,value);
    }
    // Only the free tips move independently; seam-sharing panels continue to
    // use a common cloth mesh. The cord trails the heavier collar.
    for(const [id,amount,delay] of [['collar-right-tip',-2.2,.45],['cord-left',-2.8,.95]]){
      const part=project.parts[id];part.tracks.bend=[];part.interpolation='flow';
      for(const [time,value] of [[0,0],[.65,0],[1.5+delay,amount*.42],
        [2.6+delay,amount],[4.8+delay,amount*.22],[6+delay,-amount*.2],
        [8.7+delay,0],[10.7+delay,amount*.35],[12+delay,amount*.85],
        [14.7+delay,amount*.12],[16.2+delay,-amount*.16],[18.7+delay,0]])keyframe(part,'bend',time,value);
    }
    return project;
  }
  function preset(atlas){
    const project=presetV4(atlas),head=project.parts.head;
    head.tracks={};head.interpolation='flow';
    // An attentive lean precedes a blink and small acknowledging nod. The
    // second response is softer, with a quiet interval before the loop wraps.
    // Rotation stays around the neck attachment; translations also blend into
    // the upper neck in the renderer, leaving the collar contact fixed.
    for(const [parameter,keys] of Object.entries({
      r:[[0,0],[.9,0],[1.65,-.65],[2.6,-1.9],[3.6,-2.3],[4.3,-1.95],[5.6,-.65],[7.1,.85],[8.15,1.15],[9.2,.6],[10.2,0],[11.3,0],[12.5,-1.4],[13.6,-1.65],[14.4,-.75],[15.4,.45],[16.5,.8],[18.2,0],[19.3,0]],
      x:[[0,0],[1,0],[2.8,-2.4],[4,-2],[5.7,-.5],[7.7,1.3],[9.5,.3],[10.5,0],[11.5,0],[13,-1.7],[14.4,-.9],[16,.7],[18.3,0],[19.3,0]],
      y:[[0,0],[.9,0],[1.8,-1.1],[2.8,-2.4],[3.6,-1.2],[4.05,3.8],[4.65,.65],[5.4,-.8],[6.6,0],[7.8,-.8],[9.03,1.8],[9.6,0],[11.4,0],[12.6,-1.2],[13.8,-.5],[14.23,2.9],[14.82,.4],[15.5,-.45],[17.7,0],[19.3,0]]
    }))for(const [t,v] of keys)keyframe(head,parameter,t,v);
    for(const [id,strength] of [['brow-left',1],['brow-right',.72]]){
      const part=project.parts[id];part.tracks={};part.interpolation='flow';
      for(const [t,v] of [[0,0],[1,0],[1.5,-1.6],[2.4,-2.2],[3.4,-1.2],[4.3,.25],[5.7,0],[7.5,-.4],[9.2,0],[11.6,0],[12.1,-1.1],[13.4,-1.5],[14.4,.2],[15.6,0],[19,0]])keyframe(part,'y',t,v*strength);
    }
    return project;
  }
  function upgrade(project,atlas){
    const result=validate(project,atlas);if(result.presetRevision>=PRESET_REVISION)return result;
    // Validation visits parameters in a fixed order. Saved presets may have
    // authored r/x/y in another order; object key order is not a custom edit.
    const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
    const signature=part=>JSON.stringify(canonical(part));
    const replaceUntouched=(old,next,ids)=>{
      for(const id of ids)if(signature(result.parts[id])===signature(old.parts[id]))result.parts[id]=next.parts[id];
    };
    if(result.presetRevision<2){
      replaceUntouched(legacyPreset(atlas),presetV2(atlas),['head','hair-fringe-left','hair-fringe-center','hair-fringe-right','hair-side-left','hair-side-right','hair-face-strand']);
    }
    if(result.presetRevision<3)replaceUntouched(presetV2(atlas),presetV3(atlas),['hair-fringe-right','hair-side-right','hair-face-strand']);
    if(result.presetRevision<4)replaceUntouched(presetV3(atlas),presetV4(atlas),['hair-fringe-left','hair-fringe-center','hair-side-left','collar-right-tip','cord-left']);
    if(result.presetRevision<5)replaceUntouched(presetV4(atlas),preset(atlas),['head','brow-left','brow-right']);
    result.presetRevision=PRESET_REVISION;return result;
  }
  return {VERSION,DURATION,STORAGE,PRESET_REVISION,PARAMETERS,phase,label,create,pose,trackAt,keyframe,validate,preset,upgrade,bendStart};
});
