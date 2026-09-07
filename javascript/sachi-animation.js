/* Shared deterministic animation for the wallpaper and animation preview. */
(function (scope, factory) {
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./sachi-wind.js'):scope.SachiWind,node?require('./sachi-rig.js'):scope.SachiRig);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else scope.SachiAnimation=api;
})(typeof window!=='undefined'?window:globalThis,function (Wind,Rig) {
  'use strict';
  const DURATION=20;
  const DEFAULTS={hair:1,face:1,shirt:1,wind:1,speed:1,fps:60};
  const PREVIEW_PASSES=['neck','back-hair','face','front-hair','body'];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const phase=time=>((time%DURATION)+DURATION)%DURATION;
  const smooth=value=>value*value*(3-2*value);

  // Cubic curves follow the inside edges of the original upper/lower lashes.
  // Closing the aperture moves the upper lid most of the way; the iris stays put.
  const EYES={
    left:{upper:[[98,348],[118,322],[145,317],[187,355]],lower:[[98,348],[111,398],[165,412],[187,355]],region:'M92 333 L108 319 L132 306 Q149 297 162 311 L180 328 L193 349 L194 362 L184 384 L171 398 L131 402 L113 392 L101 378 L95 359 Z'},
    right:{upper:[[322,366],[347,334],[382,337],[435,385]],lower:[[322,366],[326,414],[386,440],[435,385]],region:'M307 341 L325 328 L351 320 Q375 314 398 333 L422 350 L435 366 L437 388 L428 409 L405 430 L375 425 L343 415 L325 403 L313 379 L310 357 Z'}
  };
  function eyeCurves(side,amount) {
    const eye=EYES[side],b=clamp(amount,0,1);
    const interpolate=(fraction)=>eye.upper.map((point,i)=>point.map((v,k)=>v+(eye.lower[i][k]-v)*fraction));
    return {upper:interpolate(.84*b),lower:interpolate(1-.16*b)};
  }
  function cubic(points,t) {
    const a=1-t;
    return [0,1].map(axis=>a*a*a*points[0][axis]+3*a*a*t*points[1][axis]+3*a*t*t*points[2][axis]+t*t*t*points[3][axis]);
  }
  function curveY(points,x) {
    if(x<=points[0][0])return points[0][1];
    if(x>=points[3][0])return points[3][1];
    let lo=0,hi=1;
    for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(cubic(points,mid)[0]<x)lo=mid;else hi=mid;}
    return cubic(points,(lo+hi)/2)[1];
  }
  function eyePath(upper,lower) {
    const path=new Path2D();path.moveTo(...upper[0]);
    path.bezierCurveTo(...upper[1],...upper[2],...upper[3]);
    path.lineTo(...lower[3]);path.bezierCurveTo(...lower[2],...lower[1],...lower[0]);path.closePath();return path;
  }

  function options(values={},base=DEFAULTS) {
    const result={...base};
    for(const key of Object.keys(DEFAULTS)) {
      if(typeof values[key]!=='number'||!Number.isFinite(values[key])) continue;
      const min=key==='speed' ? .1 : key==='fps' ? 1 : 0;
      const max=key==='fps' ? 120 : key==='speed' ? 2 : 1.5;
      result[key]=clamp(values[key],min,max);
    }
    return result;
  }
  function blinkAt(time) {
    const t=phase(time);
    // Fast closing, a brief contact, and a softer opening. The second blink
    // of the double-blink is shorter, rather than replaying an identical beat.
    for(const [start,close,hold,open] of [[3.8,.095,.025,.18],[8.9,.085,.02,.16],[14,.1,.03,.19],[14.46,.07,.015,.15]]) {
      const d=t-start;
      if(d<0||d>close+hold+open) continue;
      if(d<close) return smooth(d/close);
      if(d<close+hold) return 1;
      return 1-smooth((d-close-hold)/open);
    }
    return 0;
  }
  function breathAt(time){
    const t=phase(time),ease=u=>u*u*u*(u*(u*6-15)+10);
    // Four slightly different breaths close the loop exactly. Exhalation is
    // longer than inhalation; zero acceleration at the joins prevents a hitch.
    for(const [start,length,depth] of [[0,4.85,1],[4.85,5.25,.94],[10.1,5.3,1.04],[15.4,4.6,.97]]){
      const d=t-start;if(d<0||d>=length)continue;
      const inhale=length*.42;
      return depth*clamp(d<inhale?ease(d/inhale):1-ease((d-inhale)/(length-inhale)),0,1);
    }
    return 0;
  }
  function rigClosure(part,pose,automatic,strength){
    if(strength<=0)return 0;
    const authored=pose.close*Math.min(1,strength);
    return part.tracks.close?.length?authored:Math.max(automatic,authored);
  }
  function sample(time,settings=DEFAULTS,rest=false) {
    const config=options(settings),t=phase(time),poses={};
    const put=(id,r=0,x=0,y=0,sx=1,sy=1)=>{poses[id]={r,x,y,sx,sy};};
    if(rest) return {time:t,poses,blink:0,active:false};
    const wave=(cycles,delay=0)=>Math.sin(Math.PI*2*cycles*t/DURATION+delay)-Math.sin(delay);
    const breath=breathAt(t);
    const hair=config.hair,face=config.face,shirt=config.shirt;
    put('sachi',0,0,-.4*breath*shirt,1,1+.0024*breath*shirt);
    put('head',.065*wave(1)*face);
    put('hair-back',.035*wave(2,.3)*hair);
    put('hair-crown',.035*wave(2)*hair);
    put('hair-fringe-left',.09*wave(2,.10)*hair);
    put('hair-fringe-center',.06*wave(2,.25)*hair);
    put('hair-fringe-right',.10*wave(2,.40)*hair);
    put('hair-side-left',(.38*wave(2,.15)+.04*wave(4))*hair);
    put('hair-side-right',(-.34*wave(2,.4)-.035*wave(4,.2))*hair);
    put('hair-face-strand',-.20*wave(2,.55)*hair);
    put('hair-clip',.03*wave(2,.3)*hair);
    put('brow-left',0,0,-.15*wave(1)*face);
    put('brow-right',0,0,-.12*wave(1)*face);
    put('collar-back',.025*wave(4,.15)*shirt);
    put('collar-left',.09*wave(4,.25)*shirt);
    put('collar-right-tip',-.10*wave(4,.40)*shirt);
    put('collar-right-seam',-.035*wave(4,.3)*shirt);
    put('sleeve-main',.035*wave(4,.12)*shirt);
    put('sleeve-left-fold',.025*wave(4,.2)*shirt);
    put('coat-right-panel',-.03*wave(4,.35)*shirt);
    put('coat-right-hem',-.04*wave(4,.5)*shirt);
    put('strap-left',.06*wave(4,.35)*shirt);
    put('cord-left',.09*wave(4,.55)*shirt);
    const blink=face>0?blinkAt(t):0;
    put('eye-left');
    put('eye-right');
    return {time:t,poses,blink,active:hair+face+shirt>0};
  }

  class Player {
    constructor(canvas,atlas,settings={}) {
      this.canvas=canvas;this.paintCanvas=canvas;this.context=canvas.getContext('2d');
      if(!this.context) throw new Error('Canvas rendering is unavailable.');
      this.atlas=atlas;this.nodes=new Map(atlas.nodes.map(node=>[node.id,node]));
      this.categories=new Map();
      for(const node of atlas.nodes){
        let parent=node;while(parent.parent&&parent.parent!=='sachi')parent=this.nodes.get(parent.parent);
        this.categories.set(node.id,parent.id==='body'?'body':node.id==='hair-back'||node.id==='hair-underpaint'?'back-hair':node.id.startsWith('hair-')?'front-hair':'face');
      }
      // The neck sits behind the hair; the shirt covers the concealed ends.
      // Keep rig categories intact because its runs split neck and cloth later.
      this.previewCategories=new Map([...this.categories].map(([id,pass])=>[id,id==='neck'||id==='body-underpaint'?'neck':pass]));
      this.passBounds=new Map();
      for(const pass of PREVIEW_PASSES){
        const parts=atlas.nodes.filter(node=>node.bounds&&node.kind!=='closed-eye'&&this.previewCategories.get(node.id)===pass);
        this.passBounds.set(pass,[Math.min(...parts.map(node=>node.bounds[0]))-2,Math.min(...parts.map(node=>node.bounds[1]))-2,Math.max(...parts.map(node=>node.bounds[0]+node.bounds[2]))+2,Math.max(...parts.map(node=>node.bounds[1]+node.bounds[3]))+2]);
      }
      this.settings=options(settings);this.time=0;this.playing=false;this.ready=false;
      this.rig=null;this.rigView={solo:null,selected:null};
      this.reasons=new Set();this.handle=0;this.last=null;this.lastPaint=null;this.destroyed=false;
      this.framing=settings.framing==='wallpaper'?'wallpaper':'art';
      this.padding=Number.isFinite(settings.padding)?clamp(settings.padding,0,160):Wind.PADDING;
      const dimensions=this.framing==='wallpaper'?atlas.canvas:atlas.artBounds.slice(2);
      canvas.width=dimensions[0]+2*this.padding;canvas.height=dimensions[1]+2*this.padding;
      this.visibility=()=>this.suspend('document',document.hidden);
      document.addEventListener('visibilitychange',this.visibility);
      this.visibility();
      this.image=new Image();
      this.loaded=new Promise((resolve,reject)=>{
        this.image.onload=()=>{
          if(this.destroyed)return;
          try{this.buildComposites();this.buildEyes();this.ready=true;this.render(true);this.schedule();resolve(this);}
          catch(error){this.ready=false;reject(error);}
        };
        this.image.onerror=()=>reject(new Error('Could not load the Sachi layer atlas.'));
      });
      this.image.src=settings.imageUrl||atlas.image;
    }
    buildComposites() {
      // Unite static children before their parent moves. This prevents seams
      // around pupil, reflection, ear and clasp partitions during transforms.
      this.composites=new Map();
      const animated=new Set(Object.keys(sample(2.5).poses));
      const descendants=node=>node.children.flatMap(id=>[this.nodes.get(id),...descendants(this.nodes.get(id))]);
      for(const node of this.nodes.values()) {
        if(!node.children.length)continue;
        const children=descendants(node);
        if(children.some(child=>animated.has(child.id)||child.kind!=='art'))continue;
        const parts=[node,...children].filter(part=>part.frame);
        const x=Math.min(...parts.map(part=>part.bounds[0])),y=Math.min(...parts.map(part=>part.bounds[1]));
        const right=Math.max(...parts.map(part=>part.bounds[0]+part.bounds[2])),bottom=Math.max(...parts.map(part=>part.bounds[1]+part.bounds[3]));
        const canvas=document.createElement('canvas');canvas.width=right-x;canvas.height=bottom-y;
        const ctx=canvas.getContext('2d');
        for(const part of parts) {const [sx,sy,w,h]=part.frame;ctx.drawImage(this.image,sx,sy,w,h,part.bounds[0]-x,part.bounds[1]-y,w,h);}
        this.composites.set(node.id,{canvas,x,y});
      }
    }
    buildEyes() {
      this.eyes={};
      for(const side of ['left','right']) {
        const source=this.composites.get('eye-'+side),geometry=EYES[side];
        const width=source.canvas.width,height=source.canvas.height;
        const makeCanvas=()=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;};
        const upperY=[],lowerY=[];
        for(let x=0;x<width;x++){upperY.push(curveY(geometry.upper,x+source.x+.5));lowerY.push(curveY(geometry.lower,x+source.x+.5));}
        const textures=this.atlas.eyeTextures?.[side];
        if(!textures?.interior||!textures.upper||!textures.lower)throw new Error('The eye textures are missing. Rebuild the animation atlas.');
        this.eyes[side]={...source,original:source.canvas,work:makeCanvas(),paint:makeCanvas(),textures,upperY,lowerY,region:new Path2D(geometry.region),skin:this.nodes.get(`eyelid-${side}-underpaint`)};
      }
    }
    drawEye(side,amount) {
      const eye=this.eyes[side];
      if(amount<=.00001){this.context.drawImage(this.atRest?eye.original:eye.canvas,eye.x,eye.y);return;}
      const ctx=eye.work.getContext('2d');
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,eye.work.width,eye.work.height);ctx.translate(-eye.x,-eye.y);
      ctx.drawImage(eye.canvas,eye.x,eye.y);
      // Replace only the eye opening with skin; the surrounding source skin and
      // cheek details are left in place. Then reveal the stationary eyeball.
      ctx.save();ctx.clip(eye.region);
      const [sx,sy,w,h]=eye.skin.frame,[x,y]=eye.skin.bounds;
      ctx.drawImage(this.image,sx,sy,w,h,x,y,w,h);ctx.restore();
      const curves=eyeCurves(side,amount);
      if(amount<.99999) {
        ctx.save();ctx.clip(eyePath(curves.upper,curves.lower));
        const [ix,iy,iw,ih]=eye.textures.interior.frame;
        if(eye.customInterior)ctx.drawImage(eye.customInterior,eye.x,eye.y);
        else ctx.drawImage(this.image,ix,iy,iw,ih,eye.x,eye.y,iw,ih);
        ctx.restore();
      }
      for(const which of ['lower','upper']) {
        const original=which==='upper'?eye.upperY:eye.lowerY;
        const scale=1-(which==='upper'?.66:.30)*amount;
        const [lx,ly,,lh]=eye.textures[which].frame;
        // Narrow strips bend the original ink, retaining its taper and lash tips.
        for(let column=0;column<eye.canvas.width;column++) {
          const target=curveY(curves[which],eye.x+column+.5);
          const top=target+(eye.y-original[column])*scale;
          ctx.drawImage(this.image,lx+column,ly,1,lh,eye.x+column,top,1,lh*scale);
        }
      }
      // Blend into the fitted geometry near the open pose without a one-frame
      // change in the source's soft edge pixels. The rest pose stays exact.
      const blend=smooth(clamp(amount/.12,0,1));
      if(blend<1){ctx.globalAlpha=1-blend;ctx.drawImage(eye.canvas,eye.x,eye.y);ctx.globalAlpha=1;}
      this.context.drawImage(eye.work,eye.x,eye.y,eye.canvas.width,eye.canvas.height);
    }
    setOptions(values) {this.settings=options(values,this.settings);if(this.ready&&!this.playing)this.render(this.atRest);return this;}
    setRig(project){this.rig=project?Rig.validate(project,this.atlas):null;this.rigRuns=null;this.rigRevision=(this.rigRevision||0)+1;if(this.ready)this.render(this.atRest);return this;}
    updateRigEye(side,poses){
      const eye=this.eyes[side],ids=[];
      const collect=id=>{for(const child of this.nodes.get(id).children){ids.push(child);collect(child);}};collect('eye-'+side);
      const strength=this.settings.face;
      const changed=ids.some(id=>{const p=poses[id];return p&&((strength>0&&(p.x||p.y||p.r))||this.rig.parts[id].visible===false);});
      const revision=changed?JSON.stringify([strength,ids.map(id=>[poses[id],this.rig.parts[id].visible])]):'original';
      if(eye.customRevision===revision)return;eye.customRevision=revision;
      if(!changed){eye.canvas=eye.original;eye.customInterior=null;return;}
      const canvas=document.createElement('canvas');canvas.width=eye.original.width;canvas.height=eye.original.height;
      const ctx=canvas.getContext('2d');ctx.translate(-eye.x,-eye.y);
      const draw=id=>{
        const node=this.nodes.get(id),part=this.rig.parts[id],p=poses[id];if(part?.visible===false)return;
        ctx.save();if(p){const [x,y]=part.pivot;ctx.translate(x+p.x*strength,y+p.y*strength);ctx.rotate(p.r*strength*Math.PI/180);ctx.translate(-x,-y);}
        if(node.frame){const [sx,sy,w,h]=node.frame;ctx.drawImage(this.image,sx,sy,w,h,...node.bounds);}
        for(const child of node.children)draw(child);ctx.restore();
      };
      for(const child of this.nodes.get('eye-'+side).children)draw(child);
      eye.canvas=canvas;
      const interior=document.createElement('canvas');interior.width=canvas.width;interior.height=canvas.height;
      const ink=interior.getContext('2d');ink.drawImage(canvas,0,0);ink.globalCompositeOperation='destination-out';
      for(const which of ['upper','lower']){const [sx,sy,w,h]=eye.textures[which].frame;ink.drawImage(this.image,sx,sy,w,h,0,0,w,h);}
      eye.customInterior=interior;
    }
    buildRigRuns(){
      this.rigRuns=[];this.rigSolo=this.rigView.solo;this.wind.meshes.clear();
      const ancestors=id=>{const list=[];for(let n=this.nodes.get(id);n;n=this.nodes.get(n.parent))list.push(n.id);return list;};
      const draw=(id,pass)=>{
        const node=this.nodes.get(id),chain=ancestors(id),part=this.rig.parts[id];
        if(chain.some(parent=>this.rig.parts[parent]?.visible===false)||node.kind==='closed-eye')return;
        // Eyelid skin is sampled inside drawEye's curved opening. Rendering
        // its full rectangular texture here leaks skin outside the cheek.
        if(node.kind==='underpaint'&&id.startsWith('eyelid-'))return;
        const solo=this.rigView.solo,visible=!solo||chain.includes(solo);
        const paint=visible&&this.categories.get(id)===pass;
        const isEye=id==='eye-left'||id==='eye-right',compositeEye=isEye&&(!solo||visible);
        if(paint&&(node.frame||compositeEye)){
          const active=chain.filter(parent=>{const p=this.rig.parts[parent];return parent!=='head'&&parent!=='sachi'&&p&&['x','y','r','bend'].some(key=>p.values[key]||p.tracks[key]?.length);});
          const windId=chain.find(parent=>{const p=this.rig.parts[parent];return p&&['wind','lag'].some(key=>p.tracks[key]?.length||(p.values[key]??Rig.PARAMETERS[key].value)!==Rig.PARAMETERS[key].value);})||null;
          const neck=id==='neck'||id==='body-underpaint';
          const signature=JSON.stringify([pass,active,windId,compositeEye?id:null,neck]);
          let run=this.rigRuns.at(-1);
          if(!run||run.signature!==signature){run={signature,pass,active,windId,ids:[],eye:compositeEye?id:null,neck};this.rigRuns.push(run);}
          run.ids.push(id);
        }
        // Both neck surfaces share the head blend. The coat covers their lower
        // edge, so grouping the neck first also keeps their joint on one texture.
        const children=id==='body'?['body-underpaint','neck',...node.children.filter(child=>child!=='body-underpaint'&&child!=='neck')]:node.children;
        if(!compositeEye||!paint)for(const child of children)draw(child,pass);
      };
      for(const pass of ['body','back-hair','face','front-hair'])draw('sachi',pass);
      // Hair continues behind the upper collar. Keep the neck at the back,
      // then place the clothing surface in front of the flowing hair ends.
      this.rigRuns=[...this.rigRuns.filter(r=>r.pass!=='body'||r.neck),...this.rigRuns.filter(r=>r.pass==='body'&&!r.neck)];
      // Rejoin the fixed root pixels before the individual tip meshes are drawn.
      // This uses the existing artwork, filling subpixel seams between cut parts.
      // A layer with custom root transforms keeps its fully independent rendering.
      if(!this.rigView.solo){
        const roots=[];
        for(const id of ['hair-crown','hair-fringe-left','hair-fringe-center','hair-fringe-right','hair-side-left','hair-side-right','hair-face-strand']){
          const node=this.nodes.get(id),part=this.rig.parts[id],chain=ancestors(id);
          const independent=chain.some(parent=>{const p=this.rig.parts[parent];return p&&(p.visible===false||(parent!=='head'&&parent!=='sachi'&&(['x','y','r','wind','lag'].some(key=>p.tracks[key]?.length||(p.values[key]??Rig.PARAMETERS[key].value)!==Rig.PARAMETERS[key].value)||(parent!==id&&(p.values.bend||p.tracks.bend?.length)))));});
          if(independent)continue;
          const bottom=node.bounds[1]+node.bounds[3],end=id==='hair-crown'?bottom:Rig.bendStart(id,part.pivot,bottom);
          roots.push({node,end});
        }
        if(roots.length){
          const x=Math.min(...roots.map(r=>r.node.bounds[0])),y=Math.min(...roots.map(r=>r.node.bounds[1]));
          const w=Math.max(...roots.map(r=>r.node.bounds[0]+r.node.bounds[2]))-x,h=Math.ceil(Math.max(...roots.map(r=>r.end)))-y;
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
          for(const {node,end} of roots){const [sx,sy,width,height]=node.frame,cut=Math.max(0,Math.min(height,Math.floor(end)-node.bounds[1]));if(cut)ctx.drawImage(this.image,sx,sy,width,cut,node.bounds[0]-x,node.bounds[1]-y,width,cut);}
          const run={ids:[],pass:'front-hair',active:[],windId:null,neck:false,source:canvas,bounds:[x,y,w,h],roots:true};
          this.rigRuns.splice(this.rigRuns.findIndex(r=>r.pass==='front-hair'),0,run);
        }
      }
      for(const [index,run] of this.rigRuns.entries()){
        run.key='rig-run-'+index;
        if(run.roots)continue;
        if(run.eye){const eye=this.eyes[run.eye==='eye-left'?'left':'right'];run.bounds=[eye.x,eye.y,eye.original.width,eye.original.height];continue;}
        const parts=run.ids.map(id=>this.nodes.get(id)).sort((a,b)=>(b.role==='hair-tip-continuation')-(a.role==='hair-tip-continuation'));
        const x=Math.min(...parts.map(n=>n.bounds[0])),y=Math.min(...parts.map(n=>n.bounds[1]));
        const width=Math.max(...parts.map(n=>n.bounds[0]+n.bounds[2]))-x,height=Math.max(...parts.map(n=>n.bounds[1]+n.bounds[3]))-y;
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
        for(const n of parts){const [sx,sy,w,h]=n.frame;ctx.drawImage(this.image,sx,sy,w,h,n.bounds[0]-x,n.bounds[1]-y,w,h);}
        run.source=canvas;run.bounds=[x,y,width,height];
      }
    }
    renderRig(state){
      if(!this.wind)this.wind=new Wind.Renderer(this.canvas.width,this.canvas.height);
      if(!this.rigRuns||this.rigSolo!==this.rigView.solo)this.buildRigRuns();
      const main=this.context,offset=[this.padding,this.padding];
      if(this.framing==='wallpaper'){offset[0]+=this.atlas.artBounds[0];offset[1]+=this.atlas.artBounds[1];}
      const poses=Object.fromEntries(Object.entries(this.rig.parts).map(([id,part])=>[id,Rig.pose(part,this.time)]));
      for(const side of ['left','right'])this.updateRigEye(side,poses);
      this.wind.beginFrame();this.rigMesh=null;
      const categoryGain=id=>{const pass=this.categories.get(id);return id==='sachi'?1:id==='head'?this.settings.face:pass==='body'?this.settings.shirt:pass.includes('hair')?this.settings.hair:this.settings.face;};
      for(const run of this.rigRuns){
        const {pass,bounds}=run;let source=run.source,revision=this.rigRevision+'-'+this.rigSolo;
        if(run.eye){
          const id=run.eye,side=id==='eye-left'?'left':'right',eye=this.eyes[side],part=this.rig.parts[id],p=poses[id];
          const closure=rigClosure(part,p,state.blink,this.settings.face);
          revision=String(closure)+eye.customRevision;
          if(eye.paintRevision!==revision){const ctx=eye.paint.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,eye.paint.width,eye.paint.height);ctx.translate(-eye.x,-eye.y);this.context=ctx;this.drawEye(side,closure);this.context=main;eye.paintRevision=revision;}
          source=eye.paint;
        }
        const parts=run.active.map(id=>{const local=poses[id],part=this.rig.parts[id],strength=categoryGain(id),node=this.nodes.get(id),bottom=node.bounds?node.bounds[1]+node.bounds[3]:970;return {x:local.x*strength,y:local.y*strength,r:local.r*strength,bend:local.bend*strength,pivot:part.pivot,bottom,flexStart:Rig.bendStart(id,part.pivot,bottom)};});
        const p=poses[run.windId],settings={...this.settings,frontHair:pass==='front-hair',backHair:pass==='back-hair',hair:pass.includes('hair')?this.settings.hair:0,shirt:pass==='body'&&!run.neck?this.settings.shirt:0,wind:this.settings.wind*(p?.wind??1)};
        const h=poses.head,head=pass==='body'&&!run.neck?null:{x:h.x*this.settings.face,y:h.y*this.settings.face,r:h.r*this.settings.face+(state.poses.head?.r||0),pivot:this.rig.parts.head.pivot};
        const master={...poses.sachi,pivot:this.rig.parts.sachi.pivot};
        this.wind.draw(source,this.time-(p?.lag||0),settings,offset,run.key,revision,{head,neck:run.neck,master,root:state.poses.sachi,parts},[bounds[0],bounds[1],bounds[0]+bounds[2],bounds[1]+bounds[3]],{key:run.key,frame:[0,0,source.width,source.height],bounds});
        const selectedNode=this.nodes.get(this.rigView.selected);
        const inSelection=id=>{for(let n=this.nodes.get(id);n;n=this.nodes.get(n.parent))if(n.id===this.rigView.selected)return true;return false;};
        if(this.rigView.mesh&&(run.ids.includes(this.rigView.selected)||(!selectedNode?.frame&&run.ids.some(inSelection))||(run.eye&&selectedNode?.parent===run.eye))){
          const {positions,triangles}=this.wind.lastDraw,n=this.nodes.get(this.rigView.selected),b=n.bounds;
          const selected=[];
          for(let i=0;i<triangles.length;i+=3){const ids=triangles.slice(i,i+3),points=ids.map(id=>this.wind.points[id]);if(!b||points.some(([x,y])=>x>=b[0]+offset[0]&&x<=b[0]+b[2]+offset[0]&&y>=b[1]+offset[1]&&y<=b[1]+b[3]+offset[1]))selected.push(...ids);}
          if(!this.rigMesh)this.rigMesh={positions:[],triangles:[]};
          const start=this.rigMesh.positions.length;this.rigMesh.positions.push(...positions);this.rigMesh.triangles.push(...selected.map(index=>index+start));
        }
      }
      this.context=main;this.display(this.wind.canvas);
    }
    play() {this.playing=true;this.atRest=false;this.last=null;this.lastPaint=null;this.schedule();return this;}
    pause() {this.playing=false;this.cancel();return this;}
    stop() {this.pause();this.time=0;this.render(true);return this;}
    seek(time) {if(!Number.isFinite(time))return this;this.time=phase(time);this.last=null;this.render(false);return this;}
    suspend(reason,value) {if(value)this.reasons.add(reason);else this.reasons.delete(reason);if(this.reasons.size)this.cancel();else this.schedule();}
    cancel() {if(this.handle)cancelAnimationFrame(this.handle);this.handle=0;this.last=null;this.lastPaint=null;}
    schedule() {
      if(!this.ready||!this.playing||this.reasons.size||this.destroyed||this.handle)return;
      this.handle=requestAnimationFrame(now=>this.tick(now));
    }
    tick(now) {
      this.handle=0;
      if(!this.playing||this.reasons.size||this.destroyed)return;
      if(this.last!==null)this.time=phase(this.time+Math.min(.1,(now-this.last)/1000)*this.settings.speed);
      this.last=now;
      const interval=1000/this.settings.fps;
      if(this.lastPaint===null||now-this.lastPaint>=interval-.5) {
        this.render(false);this.lastPaint=now;
      }
      this.schedule();
    }
    render(rest=false) {
      if(!this.ready||this.destroyed)return;
      this.atRest=rest;
      const main=this.context,state=sample(this.time,this.settings,rest);
      if(this.rig&&!rest){this.renderRig(state);if(this.onframe)this.onframe(state);return;}
      const windy=!rest&&this.settings.wind>0&&(this.settings.hair>0||this.settings.shirt>0);
      const drawPass=(ctx,pass,clear=true)=>{
       this.context=ctx;
       ctx.setTransform(1,0,0,1,0,0);if(clear)ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
       ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
       ctx.save();ctx.translate(this.padding,this.padding);
       if(this.framing==='wallpaper')ctx.translate(this.atlas.artBounds[0],this.atlas.artBounds[1]);
       const draw=(id)=>{
        const node=this.nodes.get(id);if(!node)return;
        if(node.kind==='underpaint'&&id.startsWith('eyelid-'))return;
        if(node.kind==='underpaint'&&!state.active)return;
        if(node.kind==='closed-eye')return;
        const paint=pass==='all'||this.previewCategories.get(id)===pass;
        ctx.save();
        const p=windy?null:state.poses[id];
        if(p) {
          const pivot=id==='sachi'?[340,970]:node.pivot;
          ctx.translate(p.x+pivot[0],p.y+pivot[1]);ctx.rotate(p.r*Math.PI/180);ctx.scale(p.sx,p.sy);ctx.translate(-pivot[0],-pivot[1]);
        }
        if(id==='eye-left'||id==='eye-right') {
          if(paint)this.drawEye(id==='eye-left'?'left':'right',state.blink);
          ctx.restore();return;
        }
        const composite=this.composites.get(id);
        // The continuation shares its lock's transform and mesh. Lay it down
        // first so the original ink and antialiased cut edge remain on top.
        const tips=node.children.filter(child=>this.nodes.get(child).role==='hair-tip-continuation');
        for(const child of tips)draw(child);
        if(paint&&composite)ctx.drawImage(composite.canvas,composite.x,composite.y);
        else if(paint&&node.frame) {
          const [sx,sy,w,h]=node.frame,[x,y]=node.bounds;
          ctx.drawImage(this.image,sx,sy,w,h,x,y,w,h);
        }
        if(!composite||!paint)for(const child of node.children)if(!tips.includes(child))draw(child);
        ctx.restore();
      };
       draw('sachi');ctx.restore();
      };
      if(windy){
        if(!this.wind)this.wind=new Wind.Renderer(this.canvas.width,this.canvas.height);
        if(!this.windLayers)this.windLayers=new Map();
        const offset=[this.padding,this.padding];
        if(this.framing==='wallpaper'){offset[0]+=this.atlas.artBounds[0];offset[1]+=this.atlas.artBounds[1];}
        this.wind.beginFrame();
        // Keep the face and ear independent of the flowing hair. Cloth shares a
        // continuous mesh so collar, sleeve and seam partitions cannot tear apart.
        for(const pass of PREVIEW_PASSES){
          let layer=this.windLayers.get(pass);
          if(!layer){
            const canvas=document.createElement('canvas');canvas.width=this.canvas.width;canvas.height=this.canvas.height;
            layer={canvas,context:canvas.getContext('2d',{willReadFrequently:true}),revision:null};this.windLayers.set(pass,layer);
          }
          const revision=pass==='face'?state.blink:0;
          if(layer.revision!==revision){drawPass(layer.context,pass);layer.revision=revision;}
          const settings={...this.settings,frontHair:pass==='front-hair',backHair:pass==='back-hair',hair:pass==='back-hair'||pass==='front-hair'?this.settings.hair:0,shirt:pass==='body'?this.settings.shirt:0};
          this.wind.draw(layer.canvas,this.time,settings,offset,pass,revision,{head:pass==='body'?null:state.poses.head,neck:pass==='neck',root:state.poses.sachi},this.passBounds.get(pass));
        }
        // Present the GPU surface directly. Copying it back into Canvas 2D would
        // force a GPU readback every frame and make a strong gust visibly stutter.
        this.display(this.wind.canvas);
      }else{
        if(state.active)for(const [index,pass] of PREVIEW_PASSES.entries())drawPass(main,pass,index===0);
        else drawPass(main,'all');
        this.display(this.paintCanvas);
      }
      this.context=main;
      if(this.onframe)this.onframe(state);
    }
    display(canvas){
      if(this.canvas===canvas)return;
      for(const attribute of this.canvas.attributes)if(attribute.name!=='width'&&attribute.name!=='height')canvas.setAttribute(attribute.name,attribute.value);
      canvas.hidden=this.canvas.hidden;
      this.canvas.replaceWith(canvas);this.canvas=canvas;
    }
    destroy() {this.pause();this.destroyed=true;this.display(this.paintCanvas);if(this.wind)this.wind.destroy();document.removeEventListener('visibilitychange',this.visibility);this.image.onload=null;this.image.onerror=null;}
  }
  return {DURATION,DEFAULTS,options,blinkAt,breathAt,rigClosure,sample,eyeCurves,curveY,Player};
});
