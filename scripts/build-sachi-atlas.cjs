/* Run export_sachi_animation.py first. SHARP_MODULE optionally selects a shared installation. */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const {eyeCurves,curveY} = require('../javascript/sachi-animation.js');
const root = path.resolve(__dirname, '..');
const input = path.join(root, '.svg-build/animation-layers');
const output = path.join(root, 'images/sachi-animation');

async function build() {
  const manifest = JSON.parse(await fs.readFile(path.join(input, 'hierarchy.json'), 'utf8'));
  const tiles = [];
  for (const node of manifest.nodes) {
    if (!node.file) continue;
    const {data, info} = await sharp(path.join(input, node.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let x0=info.width, y0=info.height, x1=-1, y1=-1;
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
      if(!data[(y*info.width+x)*4+3]) continue;
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    }
    if(x1<x0) throw new Error(`Empty layer: ${node.id}`);
    const width=x1-x0+1,height=y1-y0+1;
    const png=await sharp(data,{raw:info}).extract({left:x0,top:y0,width,height}).png().toBuffer();
    node.bounds=[x0,y0,width,height];delete node.file;
    tiles.push({node,png,width,height});
  }
  // Bake the stationary eyeballs and separate lash ink into the atlas. Runtime
  // never reads image pixels, so this also works with local-file wallpaper URLs.
  manifest.eyeTextures={};
  const nodes=new Map(manifest.nodes.map(node=>[node.id,node]));
  const layerTiles=new Map(tiles.map(tile=>[tile.node.id,tile]));
  const subtree=id=>[nodes.get(id),...nodes.get(id).children.flatMap(subtree)];
  for(const side of ['left','right']) {
    const parts=subtree('eye-'+side).filter(node=>node.bounds);
    const x=Math.min(...parts.map(node=>node.bounds[0])),y=Math.min(...parts.map(node=>node.bounds[1]));
    const width=Math.max(...parts.map(node=>node.bounds[0]+node.bounds[2]))-x;
    const height=Math.max(...parts.map(node=>node.bounds[1]+node.bounds[3]))-y;
    const raw=await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
      .composite(parts.map(node=>({input:layerTiles.get(node.id).png,left:node.bounds[0]-x,top:node.bounds[1]-y})))
      .raw().toBuffer();
    const masks={interior:Buffer.from(raw),upper:Buffer.alloc(raw.length),lower:Buffer.alloc(raw.length)};
    const geometry=eyeCurves(side,0);
    for(let column=0;column<width;column++) {
      const upperY=curveY(geometry.upper,x+column+.5),lowerY=curveY(geometry.lower,x+column+.5);
      for(let row=0;row<height;row++) {
        const offset=(row*width+column)*4,r=raw[offset],g=raw[offset+1],b=raw[offset+2],a=raw[offset+3];
        const ink=a>0&&r<48&&g<48&&b<65&&b-r<35,worldY=y+row+.5;
        const which=ink&&worldY<upperY+5?'upper':ink&&worldY>lowerY-6?'lower':null;
        if(which){raw.copy(masks[which],offset,offset,offset+4);masks.interior[offset+3]=0;}
      }
    }
    manifest.eyeTextures[side]={};
    for(const [kind,data] of Object.entries(masks)) {
      const node={bounds:[x,y,width,height]};
      const png=await sharp(data,{raw:{width,height,channels:4}}).png().toBuffer();
      manifest.eyeTextures[side][kind]=node;
      tiles.push({node,png,width,height});
    }
  }
  const width=2048,padding=3;
  let x=padding,y=padding,rowHeight=0;
  tiles.sort((a,b)=>b.height-a.height);
  for(const tile of tiles) {
    if(x+tile.width+padding>width) {x=padding;y+=rowHeight+padding*2;rowHeight=0;}
    tile.x=x;tile.y=y;tile.node.frame=[x,y,tile.width,tile.height];
    x+=tile.width+padding*2;rowHeight=Math.max(rowHeight,tile.height);
  }
  const height=y+rowHeight+padding;
  await fs.mkdir(output,{recursive:true});
  await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite(tiles.map(tile=>({input:tile.png,left:tile.x,top:tile.y})))
    .png({compressionLevel:9}).toFile(path.join(output,'atlas.png'));
  manifest.image='images/sachi-animation/atlas.png';manifest.atlasSize=[width,height];
  await fs.writeFile(path.join(output,'atlas.js'),'/* Generated from the editable SVG; rebuild after editing it. */\nwindow.SachiAtlas = '+JSON.stringify(manifest)+';\n');
  await fs.writeFile(path.join(input,'atlas-report.json'),JSON.stringify({tiles:tiles.length,width,height,bytes:(await fs.stat(path.join(output,'atlas.png'))).size},null,2));
  console.log(`Packed ${tiles.length} layers into ${width} x ${height} atlas.`);
}
build().catch(error=>{console.error(error);process.exitCode=1;});
