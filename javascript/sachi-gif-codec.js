/* A stable palette and a streaming encoder shared by the worker and fallback. */
(function(scope,factory){const api=factory(typeof module==='object'&&module.exports?require('./vendor/gifenc.js'):scope.gifenc);if(typeof module==='object'&&module.exports)module.exports=api;else scope.SachiGifCodec=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Gif){
  'use strict';
  const MAX_BYTES=128*1024*1024;
  const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  function binaryAlpha(rgba){
    for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]<128)rgba[i]=rgba[i+1]=rgba[i+2]=rgba[i+3]=0;else rgba[i+3]=255;}
    return rgba;
  }
  function create(samples,width,height,transparent=false){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>1000000)throw new Error('Choose a smaller GIF size.');
    if(!samples.length||samples.length%4)throw new Error('No palette samples were rendered.');
    const opaque=[];for(let i=0;i<samples.length;i+=4)if(samples[i+3]>=128)opaque.push(samples[i],samples[i+1],samples[i+2],255);
    const colors=opaque.length?Gif.quantize(new Uint8Array(opaque),255,{format:'rgb565'}):[[0,0,0]];
    const palette=[[0,0,0],...colors];
    // One stable, finer RGB lookup for the entire loop avoids per-frame color
    // rounding changes. A fixed spatial dither softens gradient bands without
    // introducing random animation noise. Transparency is kept separately so
    // it does not force the character into a coarse RGBA color space.
    const lookup=new Int16Array(262144);lookup.fill(-1);
    const indexFrame=rgba=>{
      const index=new Uint8Array(width*height);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const p=y*width+x,i=p*4;if(transparent&&rgba[i+3]<128)continue;
        const d=(BAYER[(y&3)*4+(x&3)]-7.5)*.5;
        const r=Math.max(0,Math.min(255,rgba[i]+d))>>2,g=Math.max(0,Math.min(255,rgba[i+1]+d))>>2,b=Math.max(0,Math.min(255,rgba[i+2]+d))>>2,key=(r<<12)|(g<<6)|b;
        let nearest=lookup[key];
        if(nearest<0){
          let distance=Infinity;const red=r*4+1.5,green=g*4+1.5,blue=b*4+1.5;
          for(let c=0;c<colors.length;c++){const color=colors[c],dr=red-color[0],dg=green-color[1],db=blue-color[2],error=dr*dr+dg*dg+db*db;if(error<distance){distance=error;nearest=c;}}
          lookup[key]=nearest;
        }
        index[p]=nearest+1;
      }
      return index;
    };
    const gif=Gif.GIFEncoder();let frames=0,finished=false,previous=null;
    return {
      write(rgba,delay){
        if(finished||rgba.length!==width*height*4||!Number.isFinite(delay)||delay<20)throw new Error('Invalid GIF frame.');
        let index=indexFrame(rgba);
        if(!transparent){
          // Reuse unchanged background/character pixels from the prior frame.
          // Index zero is reserved for "keep previous"; every changed pixel,
          // including newly exposed background, is painted with an opaque color.
          const full=index.slice();
          if(previous)for(let i=0;i<index.length;i++)if(index[i]===previous[i])index[i]=0;
          previous=full;
        }
        gif.writeFrame(index,width,height,{palette:frames===0?palette:undefined,delay,repeat:0,transparent:transparent||frames>0,transparentIndex:0,dispose:transparent?2:1});
        frames++;
        if(gif.bytesView().byteLength>MAX_BYTES)throw new Error('This GIF is too large. Try the Compact preset.');
      },
      finish(){if(finished||!frames)throw new Error('No animation frames were encoded.');finished=true;gif.finish();return gif.bytes();}
    };
  }
  return {create,binaryAlpha};
});
