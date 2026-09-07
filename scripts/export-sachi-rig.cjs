/* Export reusable, aligned PNG layers from the existing SVG-derived atlas. */
const fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const sharp=require(process.env.SHARP_MODULE||'sharp');
const Rig=require('../javascript/sachi-rig.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'images/sachi-rig');
(async()=>{
  const scope={window:{}};vm.runInNewContext(await fs.readFile(path.join(root,'images/sachi-animation/atlas.js'),'utf8'),scope);
  const atlas=scope.window.SachiAtlas,manifest={format:'sachi-aligned-layers',version:1,size:atlas.artBounds.slice(2),sourceCanvas:atlas.canvas,sourceOffset:atlas.artBounds.slice(0,2),sourceSha256:atlas.sourceSha256,order:'bottom-to-top',layers:[]};
  await fs.mkdir(path.join(out,'layers'),{recursive:true});
  for(const node of atlas.nodes){
    if(!node.frame||node.kind==='closed-eye')continue;
    const [left,top,width,height]=node.frame,[x,y]=node.bounds;
    await sharp(path.join(root,atlas.image)).extract({left,top,width,height}).extend({left:x,top:y,right:708-x-width,bottom:970-y-height,background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9}).toFile(path.join(out,'layers',node.id+'.png'));
    manifest.layers.push({id:node.id,name:Rig.label(node.id),parent:node.parent,pivot:node.pivot,visible:node.kind==='art',kind:node.kind,file:'layers/'+node.id+'.png'});
  }
  await fs.writeFile(path.join(out,'layers.json'),JSON.stringify(manifest,null,2)+'\n');
  // A rebuild must never overwrite a user's exported animation project.
  try{await fs.writeFile(path.join(out,'project.js'),'/* Default layered wallpaper loop. Replace with an editor export to customize. */\nwindow.SachiRigProject = '+JSON.stringify(Rig.preset(atlas))+';\n',{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
  console.log(`Exported ${manifest.layers.length} aligned layers and their hierarchy.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
