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
    'left temple skin':(86,300,'face'),
    'skin beside left eye':(90,320,'face'),
    'left inner lock edge':(86,380,'hair-side-left'),
    'right bang upper cyan edge':(530,250,'hair-side-right'),
    'right bang middle cyan edge':(531,300,'hair-side-right'),
    'right bang dark face outline':(436,400,'hair-side-right'),
    'right cheek strand':(423,480,'hair-face-strand'),
    'skin inside right hair fork':(443,500,'face'),
    'neck inside right hair fork':(445,540,'neck'),
    'back hair beside right bang':(540,300,'hair-back'),
}
for name,(x,y,owner) in landmarks.items():
    assert visible[y,x],name+' must be visible'
    assert owners[y,x]==owner,f'{name}: expected {owner}, got {owners[y,x]}'
face_fill=np.array(Image.open(ROOT/'images/sachi-rig/layers/face-underpaint.png').convert('RGBA'))
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
    'sourcePixelsAssignedOnce':int(visible.sum()),'cutLandmarks':list(landmarks),
    'layerExport':{'artworkLayers':sum(p['visible'] for p in manifest['layers']),
    'hiddenFills':sum(not p['visible'] for p in manifest['layers']),
    'size':[708,970],'alphaExact':True,'compositedComparisons':comparisons}}
(ROOT/'images/sachi-rig/cutoff-validation.json').write_text(json.dumps(result,indent=2)+'\n')
validation=ROOT/'images/sachi-rig/validation.json'
data=json.loads(validation.read_text());data['layerExport']=result['layerExport']
validation.write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps(result,indent=2))
