/* One frame in flight keeps memory bounded even for a slow-motion export. */
importScripts('vendor/gifenc.js','sachi-gif-codec.js');
let encoder;
self.onmessage=event=>{
  const {id,type,...data}=event.data;
  try{
    if(type==='init')encoder=SachiGifCodec.create(new Uint8Array(data.samples),data.width,data.height,data.transparent);
    else if(type==='frame')encoder.write(new Uint8Array(data.rgba),data.delay);
    else if(type==='finish'){
      const bytes=encoder.finish();encoder=null;
      self.postMessage({id,bytes:bytes.buffer},[bytes.buffer]);return;
    }else throw new Error('Unknown GIF operation.');
    self.postMessage({id});
  }catch(error){encoder=null;self.postMessage({id,error:error.message});}
};
