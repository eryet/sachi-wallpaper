/* Continuous cloth/hair deformation. Shared vertices keep adjacent artwork joined. */
(function(scope,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else scope.SachiWind=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const DURATION=20,PADDING=64,TAU=Math.PI*2;
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const phase=t=>((t%DURATION)+DURATION)%DURATION;
  function pulse(t,start,rise,hold,fall){
    const d=t-start;if(d<0||d>rise+hold+fall)return 0;
    if(d<rise)return smooth(d/rise);
    if(d<rise+hold)return 1;
    return 1-smooth((d-rise-hold)/fall);
  }
  function gustAt(time){
    const t=phase(time);
    return pulse(t,.4,1.15,.5,4.1)+.32*pulse(t,6.5,.65,.2,1.6)+.94*pulse(t,9.7,1.5,.7,4.8);
  }
  function flow(time,delay){
    const t=phase(time-delay),force=gustAt(t);
    // The bulk of a lock or sleeve follows one sweep. A delayed release gives
    // it inertia; smaller travelling ripples belong at the flexible ends.
    return force-.15*gustAt(t-1.05);
  }
  // Saturation gives the upper end of the sliders more energy without allowing
  // folded mesh triangles when both the part and wind sliders are at maximum.
  const gain=strength=>(1-Math.exp(-1.3*Math.max(0,strength)))/(1-Math.exp(-1.3));
  // Precompute a periodic damped response, so scrubbing and playback use the
  // same motion. Three cycles settle the spring before retaining its last loop.
  function springLoop(frequency,damping){
    const count=2400,dt=DURATION/count,omega=TAU*frequency,samples=[];
    const acceleration=(p,v,force)=>omega*omega*(force-p)-2*damping*omega*v;
    let p=0,v=0;
    for(let cycle=0;cycle<3;cycle++)for(let i=0;i<count;i++){
      if(cycle===2)samples.push([p,v]);
      const t=i*dt,f0=gustAt(t),fm=gustAt(t+dt/2),f1=gustAt(t+dt);
      const a1=acceleration(p,v,f0),v2=v+a1*dt/2,a2=acceleration(p+v*dt/2,v2,fm);
      const v3=v+a2*dt/2,a3=acceleration(p+v2*dt/2,v3,fm);
      const v4=v+a3*dt,a4=acceleration(p+v3*dt,v4,f1);
      p+=dt*(v+2*v2+2*v3+v4)/6;v+=dt*(a1+2*a2+2*a3+a4)/6;
    }
    return time=>{
      const index=phase(time)/dt,i=Math.floor(index),u=index-i;
      const a=samples[i%count],b=samples[(i+1)%count],u2=u*u,u3=u2*u;
      return (2*u3-3*u2+1)*a[0]+(u3-2*u2+u)*dt*a[1]+(-2*u3+3*u2)*b[0]+(u3-u2)*dt*b[1];
    };
  }
  const longBob=springLoop(.70,.52),shortBob=springLoop(1.05,.60);
  function backResponse(time,outer=0){
    const t=phase(time),mix=clamp(outer);
    const quiet=smooth(t/.4)*(1-smooth((t-18.2)/.75));
    return ((1-mix)*longBob(t)+mix*shortBob(t))*quiet;
  }
  function backDeformation(x,y,time,strength){
    const outer=smooth((x-560)/140),length=425-150*outer;
    const u=clamp((y-175)/length),s=u*length;
    const response=backResponse(time-.12-.55*u-.12*(1-outer),outer);
    const angle=strength*(.28+.025*outer)*response*u,angle2=angle*angle;
    // Bend along an arc instead of shortening a straight hanging section.
    // The local ear contact is pinned, but the outer silhouette can still flow.
    const contact=1-.98*Math.exp(-(((x-536)/48)**2+((y-423)/86)**2));
    return [-s*angle*(.5-angle2/24)*contact,-s*angle2*(1/6-angle2/120)*contact];
  }
  function deformation(x,y,time,settings){
    const hair=gain(settings.hair*settings.wind),cloth=gain(settings.shirt*settings.wind);
    let dx=0,dy=0;
    if(hair){
      const hang=smooth((y-150)/545);
      const left=1-smooth((x-190)/145);
      // Only the back bob is held by the ear. The face-framing bang is free
      // in front of it, with a gradual release below its scalp attachment.
      const earHold=smooth((Math.abs(y-421)-65)/140);
      // Retain a small contact at the outer edge, so the ear join stays covered
      // while the inner edge bows with the passing wind.
      const earContact=settings.frontHair?Math.exp(-(((x-527)/48)**2+((y-438)/90)**2)):0;
      const frontRelease=settings.frontHair ? .7*smooth((y-235)/185)*(1-.96*earContact) : 0;
      const right=smooth((x-300)/190)*(earHold+(1-earHold)*frontRelease);
      const a=flow(time,Math.max(0,y-170)*.0017),b=flow(time,.24+Math.max(0,y-150)*.0018);
      const ripple=(.76*Math.sin(TAU*7*phase(time)/DURATION-y/68)+.24*Math.sin(TAU*11*phase(time)/DURATION-y/49))*gustAt(time-.45);
      dx-=hair*hang*(82*left*a+86*right*b);
      dy+=hair*hang*(-18*left*a-25*right*b+3.5*(left+right)*ripple);
      // Shorter fringe follows sooner. Face and ear are separate, unwarped passes.
      const fringe=smooth((y-95)/150)*(1-smooth((y-277)/85))*smooth((x-66)/90)*(1-smooth((x-450)/85));
      const f=flow(time,.08+Math.max(0,y-100)*.001);
      const rightFringe=smooth((x-285)/145);
      dx-=hair*(19+9*rightFringe)*fringe*f;dy-=hair*(6+3*rightFringe)*fringe*f;
      // Hold the temple attachment across every hair layer. A shared influence
      // avoids pulling the narrow side lock away from the fringe at its root.
      const temple=1-smooth(Math.hypot((x-79)/145,(y-263)/145));
      dx*=1-.92*temple;dy*=1-.92*temple;
      if(settings.backHair&&x>480&&y>245&&y<840){
        // The crown and clip share these upper pixels with the back layer.
        const weight=smooth((x-480)/70)*smooth((y-245)/100)*(1-smooth((y-640)/200)),back=backDeformation(x,y,time,hair);
        dx+=(back[0]-dx)*weight;dy+=(back[1]-dy)*weight;
      }
    }
    if(cloth){
      const neck=smooth((y-654)/155),bottom=1-smooth((y-930)/40);
      const edge=.32+.68*smooth(Math.abs(x-345)/310);
      const wind=flow(time,.55+(y-660)*.0015+x*.00045);
      // Heavier fabric billows first, then its free edges settle. The shoulder
      // carries much less flutter than the hem, preserving the drawn folds.
      const freeEdge=.22+.78*edge;
      const flutter=freeEdge*gustAt(time-.85)*(.78*Math.sin(TAU*8*phase(time)/DURATION-x/105-y/120)+.22*Math.sin(TAU*13*phase(time)/DURATION-x/67-y/85));
      dx+=cloth*neck*(-28*edge*wind+3.2*flutter);
      dy+=cloth*neck*bottom*(-19*edge*wind+3.8*flutter);
      const collar=smooth((y-652)/35)*(1-smooth((y-785)/45));
      const collarEdges=Math.exp(-(((x-160)/125)**2))+.85*Math.exp(-(((x-655)/90)**2));
      dx-=cloth*9*collar*collarEdges*flow(time,.45);
      dy-=cloth*12*collar*collarEdges*flow(time,.6);
    }
    return [dx,dy];
  }

  const prepareTransform=part=>({...part,cos:Math.cos((part.r||0)*Math.PI/180),sin:Math.sin((part.r||0)*Math.PI/180),x:part.x||0,y:part.y||0});
  const changes=part=>part&&(part.x||part.y||part.r||part.bend);
  function preparePose(pose){return {...pose,parts:(pose.parts||[]).filter(changes).map(prepareTransform),head:changes(pose.head)?prepareTransform({...pose.head,pivot:pose.head.pivot||[322,635]}):null,master:changes(pose.master)?prepareTransform(pose.master):null};}
  function applyPose(x,y,pose,sourceY=y,ox=0,oy=0){
    for(const p of pose.parts){
      const [ax,ay]=p.pivot;
      if(p.bend){const start=p.flexStart??ay,weight=clamp((y-start)/Math.max(40,p.bottom-start));x+=p.bend*weight*weight;}
      const dx=x-ax,dy=y-ay;x=ax+dx*p.cos-dy*p.sin+p.x;y=ay+dx*p.sin+dy*p.cos+p.y;
    }
    if(pose.head){
      const weight=pose.neck?1-smooth((sourceY-635)/65):1;
      const p=pose.head,[ax,ay]=p.pivot,dx=x-ax,dy=y-ay;
      const hx=ax+dx*p.cos-dy*p.sin+p.x,hy=ay+dx*p.sin+dy*p.cos+p.y;
      x+=(hx-x)*weight;y+=(hy-y)*weight;
    }
    if(pose.master){const p=pose.master,[ax,ay]=p.pivot,dx=x-ax,dy=y-ay;x=ax+dx*p.cos-dy*p.sin+p.x;y=ay+dx*p.sin+dy*p.cos+p.y;}
    if(pose.root){const p=pose.root;x=340+(x-340)*p.sx+p.x;y=970+(y-970)*p.sy+p.y;}
    return [x+ox,y+oy];
  }
  function posePoint(x,y,pose){return applyPose(x,y,preparePose(pose));}

  class Renderer {
    constructor(width,height){
      this.width=width;this.height=height;this.mode='webgl';
      this.canvas=document.createElement('canvas');this.canvas.width=width;this.canvas.height=height;
      try{this.initializeGL();}catch(error){this.fallback();}
    }
    initializeGL(){
      const gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true,depth:false,stencil:false});
      if(!gl)throw new Error('WebGL unavailable');this.gl=gl;
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
      const vertex=shader(gl.VERTEX_SHADER,'attribute vec2 position;attribute vec2 uv;varying vec2 tex;void main(){tex=uv;gl_Position=vec4(position,0.,1.);}');
      const fragment=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 tex;uniform sampler2D art;uniform vec4 uvBounds;void main(){if(tex.x<uvBounds.x||tex.y<uvBounds.y||tex.x>uvBounds.z||tex.y>uvBounds.w)discard;gl_FragColor=texture2D(art,tex);}');
      const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
      gl.deleteShader(vertex);gl.deleteShader(fragment);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);this.program=program;
      this.uvBounds=gl.getUniformLocation(program,'uvBounds');
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      const position=gl.getAttribLocation(program,'position'),uv=gl.getAttribLocation(program,'uv');
      gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,16,0);
      gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);
      this.textures=new Map();
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1i(gl.getUniformLocation(program,'art'),0);gl.viewport(0,0,this.width,this.height);
      this.grid(22);
      this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.fallback();},{once:true});
    }
    grid(size){
      this.columns=Math.ceil(this.width/size);this.rows=Math.ceil(this.height/size);
      this.points=[];this.triangles=[];
      for(let row=0;row<=this.rows;row++)for(let column=0;column<=this.columns;column++)this.points.push([column*this.width/this.columns,row*this.height/this.rows]);
      for(let row=0;row<this.rows;row++)for(let column=0;column<this.columns;column++){
        const a=row*(this.columns+1)+column,b=a+1,c=a+this.columns+1,d=c+1;
        this.triangles.push(a,b,d,a,d,c);
      }
      this.vertices=new Float32Array(this.triangles.length*4);
      this.meshes=new Map();this.positionCache=new Map();this.deformationCache=new Map();
    }
    fallback(){
      this.releaseGL();this.mode='canvas';
      this.canvas=document.createElement('canvas');this.canvas.width=this.width;this.canvas.height=this.height;
      this.context=this.canvas.getContext('2d');this.grid(46);
    }
    beginFrame(){
      this.positionCache.clear();
      this.deformationCache.clear();
      if(this.mode==='webgl'){this.gl.clearColor(0,0,0,0);this.gl.clear(this.gl.COLOR_BUFFER_BIT);}
      else{this.context.setTransform(1,0,0,1,0,0);this.context.clearRect(0,0,this.width,this.height);}
    }
    draw(source,time,settings,offset,key,revision,pose,bounds,texture=null){
      const moving=settings.wind>0&&(settings.hair>0||settings.shirt>0);
      const cacheKey=JSON.stringify([time,settings.hair,settings.shirt,settings.wind,!!settings.frontHair,!!settings.backHair,pose]);
      let positions=this.positionCache.get(cacheKey);
      if(!positions){
        const fieldKey=JSON.stringify([time,settings.hair,settings.shirt,settings.wind,!!settings.frontHair,!!settings.backHair,offset]);
        let field=this.deformationCache.get(fieldKey);
        if(!field){field=this.points.map(([x,y])=>{const px=x-offset[0],py=y-offset[1],[dx,dy]=moving?deformation(px,py,time,settings):[0,0];return [px+dx,py+dy];});this.deformationCache.set(fieldKey,field);}
        const prepared=preparePose(pose);
        positions=field.map(([x,y],index)=>applyPose(x,y,prepared,this.points[index][1]-offset[1],offset[0],offset[1]));
        this.positionCache.set(cacheKey,positions);}
      let triangles=this.meshes.get(key);
      if(!triangles){
        triangles=[];const [left,top,right,bottom]=bounds;
        for(let i=0;i<this.triangles.length;i+=3){
          const ids=this.triangles.slice(i,i+3),points=ids.map(id=>this.points[id]);
          if(Math.max(...points.map(p=>p[0]))<left+offset[0]||Math.min(...points.map(p=>p[0]))>right+offset[0]||Math.max(...points.map(p=>p[1]))<top+offset[1]||Math.min(...points.map(p=>p[1]))>bottom+offset[1])continue;
          triangles.push(...ids);
        }
        this.meshes.set(key,triangles);
      }
      this.lastDraw={positions,triangles};
      if(this.mode==='webgl'){
        const gl=this.gl;
        try{
          const textureKey=texture?.key||key;
          let cached=this.textures.get(textureKey);
          if(!cached){
            cached={texture:gl.createTexture(),revision:null};this.textures.set(textureKey,cached);gl.bindTexture(gl.TEXTURE_2D,cached.texture);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
          }else gl.bindTexture(gl.TEXTURE_2D,cached.texture);
          if(cached.revision!==revision){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);cached.revision=revision;}
          const tw=source.width,th=source.height;
          const frame=texture?.frame||[0,0,tw,th],origin=texture?.bounds||[-offset[0],-offset[1]];
          gl.uniform4f(this.uvBounds,frame[0]/tw,frame[1]/th,(frame[0]+frame[2])/tw,(frame[1]+frame[3])/th);
          triangles.forEach((point,index)=>{const [x,y]=positions[point],[u,v]=this.points[point];this.vertices.set([2*x/this.width-1,1-2*y/this.height,(u-offset[0]-origin[0]+frame[0])/tw,(v-offset[1]-origin[1]+frame[1])/th],index*4);});
          gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices.subarray(0,triangles.length*4),gl.DYNAMIC_DRAW);
          gl.drawArrays(gl.TRIANGLES,0,triangles.length);
          return this.canvas;
        }catch(error){this.fallback();return this.draw(source,time,settings,offset,key,revision,pose,bounds,texture);}
      }
      // Local-file browser restrictions can prohibit GPU texture uploads. This
      // lower-resolution mesh keeps the same motion without reading image pixels.
      const ctx=this.context;ctx.setTransform(1,0,0,1,0,0);
      const drawSource=()=>{
        if(texture){const [sx,sy,w,h]=texture.frame,[x,y]=texture.bounds;ctx.drawImage(source,sx,sy,w,h,x+offset[0],y+offset[1],w,h);}
        else ctx.drawImage(source,0,0);
      };
      if(!moving&&!pose.neck&&!(pose.parts||[]).some(part=>part.bend)){
        const p=positions[0],a=positions[this.columns],b=positions[this.rows*(this.columns+1)];
        ctx.save();ctx.setTransform((a[0]-p[0])/this.width,(a[1]-p[1])/this.width,(b[0]-p[0])/this.height,(b[1]-p[1])/this.height,p[0],p[1]);
        drawSource();ctx.restore();return this.canvas;
      }
      for(let i=0;i<triangles.length;i+=3){
        const ids=triangles.slice(i,i+3),s=ids.map(id=>this.points[id]),d=ids.map(id=>positions[id]);
        const [x0,y0]=s[0],[x1,y1]=s[1],[x2,y2]=s[2],det=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
        const a=((d[1][0]-d[0][0])*(y2-y0)-(d[2][0]-d[0][0])*(y1-y0))/det;
        const c=((x1-x0)*(d[2][0]-d[0][0])-(x2-x0)*(d[1][0]-d[0][0]))/det;
        const b=((d[1][1]-d[0][1])*(y2-y0)-(d[2][1]-d[0][1])*(y1-y0))/det;
        const e=((x1-x0)*(d[2][1]-d[0][1])-(x2-x0)*(d[1][1]-d[0][1]))/det;
        const center=[(d[0][0]+d[1][0]+d[2][0])/3,(d[0][1]+d[1][1]+d[2][1])/3];
        ctx.save();ctx.beginPath();
        // A subpixel overlap prevents antialiased cracks between triangles.
        d.forEach(([x,y],j)=>{const length=Math.hypot(x-center[0],y-center[1]),q=[x+.55*(x-center[0])/length,y+.55*(y-center[1])/length];if(j)ctx.lineTo(...q);else ctx.moveTo(...q);});
        ctx.closePath();ctx.clip();ctx.setTransform(a,b,c,e,d[0][0]-a*x0-c*y0,d[0][1]-b*x0-e*y0);drawSource();ctx.restore();
      }
      return this.canvas;
    }
    releaseGL(){if(this.gl){const gl=this.gl;for(const texture of this.textures?.values()||[])gl.deleteTexture(texture.texture);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);this.gl=null;}}
    destroy(){this.releaseGL();this.canvas.width=1;this.canvas.height=1;}
  }
  return {DURATION,PADDING,gustAt,flow,backResponse,deformation,posePoint,Renderer};
});
