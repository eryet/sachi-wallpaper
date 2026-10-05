"""Check the saved SVG's source samples and independently reviewed cut landmarks."""
import hashlib
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET
from zipfile import ZipFile
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SVG=ROOT/'images/sachi_ai_scale.svg'
source=np.array(Image.open(ROOT/'images/sachi_ai_scale.png').convert('RGBA').crop((130,81,838,1051)))
pixels=np.zeros_like(source)
coverage=np.zeros(source.shape[:2],dtype=np.uint8)
owners=np.full(source.shape[:2],'',dtype=object)
ns='{http://www.w3.org/2000/svg}'
for group in ET.parse(SVG).iter(ns+'g'):
    paint=group.find(ns+"g[@data-artwork='true']")
    if paint is None:continue
    for path in paint:
        color=path.get('fill').lstrip('#')
        rgba=[int(color[i:i+2],16) for i in [0,2,4]]+[round(float(path.get('fill-opacity','1'))*255)]
        for x,y,w,h,back in re.findall(r'M(\d+) (\d+)h(\d+)v(\d+)h-(\d+)z',path.get('d')):
            x,y,w,h,back=map(int,[x,y,w,h,back]);assert w==back
            pixels[y:y+h,x:x+w]=rgba
            coverage[y:y+h,x:x+w]+=1
            owners[y:y+h,x:x+w]=group.get('id')
visible=source[:,:,3]>0
assert np.all(coverage[visible]==1),'Lost or duplicated source pixels'
assert not np.any(coverage[~visible]),'Added pixels in source artwork'
assert np.array_equal(pixels[visible],source[visible]),'Source RGBA changed'
# Landmarks chosen from the original at 8x zoom, not from generated masks.
landmarks={
    'left outline':(146,670,'hair-side-left'),
    'left lower lock':(155,702,'hair-side-left'),
    'left collar ink':(135,724,'collar-back'),
    'left collar edge':(190,690,'collar-back'),
    'right inner collar ink':(490,679,'collar-back'),
    'right lock highlight':(535,690,'hair-side-right'),
    'right collar edge':(565,711,'collar-back'),
    'outer collar rim':(632,734,'collar-back'),
    'neck skin above collar':(400,653,'neck'),
    'cyan neck collar antialiasing':(400,655,'collar-back'),
    'right neck collar antialiasing':(420,659,'collar-back'),
    'right eyebrow inner tip':(320,261,'brow-right'),
    'right eyebrow arch':(365,262,'brow-right'),
    'right eyebrow outer stroke':(410,282,'brow-right'),
    'right eyelid crease':(352,297,'face'),
    'center fringe over eyebrow':(346,251,'hair-fringe-center'),
    'right fringe over eyebrow':(392,262,'hair-fringe-right'),
    'left fringe crossing eyebrow':(94,265,'hair-fringe-left'),
    'left eyebrow arch':(140,259,'brow-left'),
    'left temple skin':(86,300,'face'),
    'skin beside left eye':(90,320,'face'),
    'left inner lock edge':(86,380,'hair-side-left'),
    'right bang upper cyan edge':(530,250,'hair-side-right'),
    'right bang middle cyan edge':(531,300,'hair-side-right'),
    'right bang dark face outline':(436,400,'hair-side-right'),
    'right cheek strand':(423,480,'hair-face-strand'),
    'skin inside right hair fork':(443,500,'face'),
    'right fork upper ink':(444,470,'hair-side-right'),
    'right fork inner antialiasing':(447,500,'hair-side-right'),
    'right fork lower antialiasing':(449,520,'hair-side-right'),
    'neck inside right hair fork':(445,540,'neck'),
    'back hair beside right bang':(540,300,'hair-back'),
    'hair antialiasing beside upper ear':(530,380,'hair-side-right'),
    'hair antialiasing beside lobe':(520,480,'hair-side-right'),
    'hair highlight halo beside lobe':(521,480,'hair-side-right'),
    'back hair above ear':(536,360,'hair-back'),
    'visible upper ear':(540,380,'ear-right'),
    'visible inner ear':(550,410,'ear-inner'),
}
for name,(x,y,owner) in landmarks.items():
    assert visible[y,x],name+' must be visible'
    assert owners[y,x]==owner,f'{name}: expected {owner}, got {owners[y,x]}'
# Inspect the fully revealed ear, without the front lock hiding its seam.
# Samples are on flat skin/rim surfaces, away from the intentional ink folds.
ear=Image.new('RGBA',(708,970))
for name in ['face-underpaint','ear-right','ear-inner']:
    ear.alpha_composite(Image.open(ROOT/f'images/sachi-rig/layers/{name}.png').convert('RGBA'))
ear=np.array(ear).astype(int)
ear_steps=[]
for x,y in [(530,380),(527,412),(526,418),(524,444),(520,480),(520,484),(520,488)]:
    strip=ear[y,x-2:x+4]
    assert np.all(strip[:,3]==255),f'Ear backing gap at {x},{y}'
    step=int(np.abs(np.diff(strip[:,:3],axis=0)).max())
    assert step<=14,f'Visible ear cut seam at {x},{y}: {step}'
    ear_steps.append({'point':[x,y],'maximumAdjacentChannelStep':step})
face_fill=np.array(Image.open(ROOT/'images/sachi-rig/layers/face-underpaint.png').convert('RGBA'))
fork_steps=[]
for x,y,reference_x in [(445,480,441),(446,490,442),(447,500,443),(448,510,444),(449,520,445),(450,530,446),(451,540,447)]:
    assert face_fill[y,x,3]==255,f'Missing cheek backing at {x},{y}'
    error=int(np.abs(face_fill[y,x,:3].astype(int)-source[y,reference_x,:3].astype(int)).max())
    assert error<=8,f'Hair outline or mismatched fill remains at {x},{y}: {error}'
    fork_steps.append({'point':[x,y],'reference':[reference_x,y],'maximumChannelError':error})
for x,y in [(456,500),(457,530),(458,544)]:
    assert face_fill[y,x,3]==0,f'Cheek backing extends into the back hair at {x},{y}'
for x,y in [(80,350),(85,400),(80,470),(105,540)]:
    assert face_fill[y,x,3]==0,f'Hidden skin protrudes behind the left lock at {x},{y}'
manifest=json.loads((ROOT/'images/sachi-rig/layers.json').read_text())
assert manifest['sourceSha256']==hashlib.sha256(SVG.read_bytes()).hexdigest()
hair_fill=np.array(Image.open(ROOT/'images/sachi-rig/layers/hair-underpaint.png').convert('RGBA'))
# The revealed backing belongs to the dark bob, so it cannot contain the cyan
# front highlight or lavender face colour. These points are under the long bang.
for x,y in [(515,280),(515,320),(502,510)]:
    r,g,b,a=map(int,hair_fill[y,x]);assert a==255
    assert r<65 and g<85 and b>55,(x,y,(r,g,b,a))
with ZipFile(ROOT/'images/sachi-rig/sachi-layers.ora') as archive:
    merged=np.array(Image.open(archive.open('mergedimage.png')).convert('RGBA'))
assert np.array_equal(merged[:,:,3],source[:,:,3]),'Export alpha changed'
comparisons={}
for name,bg in [('dark',[22,33,55]),('white',[255,255,255])]:
    def composite(a):
        alpha=a[:,:,3:4].astype(float)/255
        return np.rint(a[:,:,:3]*alpha+np.array(bg)*(1-alpha))
    error=np.abs(composite(merged)-composite(source))
    assert error.max()<=3
    comparisons[name]={'maxChannelError':int(error.max()),'visibleArtMeanChannelError':float(error[visible].mean())}
result={'sourceSha256':manifest['sourceSha256'],'exactSourceRGBA':True,
    'leftFaceFillClipped':True,
    'rightBangBackingUsesHairShading':True,
    'revealedEarContinuity':ear_steps,
    'revealedHairForkContinuity':fork_steps,
    'sourcePixelsAssignedOnce':int(visible.sum()),'cutLandmarks':list(landmarks),
    'layerExport':{'artworkLayers':sum(p['visible'] for p in manifest['layers']),
    'hiddenFills':sum(not p['visible'] for p in manifest['layers']),
    'size':[708,970],'alphaExact':True,'compositedComparisons':comparisons}}
(ROOT/'images/sachi-rig/cutoff-validation.json').write_text(json.dumps(result,indent=2)+'\n')
validation=ROOT/'images/sachi-rig/validation.json'
data=json.loads(validation.read_text());data['layerExport']=result['layerExport']
validation.write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps(result,indent=2))
