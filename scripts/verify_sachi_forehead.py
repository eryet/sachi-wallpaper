"""Check exported hidden colours against independently chosen source swatches."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
source=np.array(Image.open(ROOT/'images/sachi_ai_scale.png').convert('RGBA').crop((130,81,838,1051)))
swatches={
    'face':[(170,200),(160,225),(175,235),(245,278),(270,280),(310,285),(360,290),(400,303)],
    'hair':[(240,120),(280,120),(320,120),(370,120),(405,135),(250,170),(300,175)],
}
result={'sourceSha256':hashlib.sha256((ROOT/'images/sachi_ai_scale.svg').read_bytes()).hexdigest(),'surfaces':{}}
for surface,points in swatches.items():
    fill=np.array(Image.open(ROOT/f'images/sachi-rig/layers/{surface}-underpaint.png').convert('RGBA'))
    differences=[]
    for x,y in points:
        assert source[y,x,3]==fill[y,x,3]==255,(surface,x,y,'Missing surface')
        error=np.abs(source[y,x,:3].astype(int)-fill[y,x,:3].astype(int))
        assert error.max()<=3,(surface,x,y,error.tolist())
        differences.extend(error.tolist())
    result['surfaces'][surface]={'sourceSwatches':points,'maximumChannelError':int(max(differences)),
                                 'meanChannelError':round(float(np.mean(differences)),3)}
fit=json.loads((ROOT/'images/sachi_ai_scale.layers.json').read_text())['foreheadFill']
assert fit['holdoutSamples']>2000 and fit['holdoutMeanChannelError']<2
result['foreheadFit']=fit
(ROOT/'images/sachi-rig/forehead-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
