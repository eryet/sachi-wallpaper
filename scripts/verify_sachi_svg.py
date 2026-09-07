"""Verify structural invariants and an independently rendered, native-size SVG."""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("render",type=Path)
args=parser.parse_args()
tree=ET.parse(ROOT/"images/sachi_ai_scale.svg")
elements=list(tree.iter())
ids=[el.attrib["id"] for el in elements if "id" in el.attrib]
assert len(ids)==len(set(ids)), "Duplicate SVG IDs"
assert not any(el.tag.split('}')[-1] in {"image","foreignObject","script"} for el in elements)
assert not any(key.split('}')[-1]=="href" for el in elements for key in el.attrib)
source=np.asarray(Image.open(ROOT/"images/sachi_ai_scale.png").convert("RGBA"),dtype=np.float64)
render=np.asarray(Image.open(args.render).convert("RGBA"),dtype=np.float64)
assert source.shape==render.shape
inventory=json.loads((ROOT/"images/sachi_ai_scale.layers.json").read_text())
visible=int(np.count_nonzero(source[:,:,3]))
assert sum(row["source_pixels"] for row in inventory["layers"])==visible
assert all(row["source_pixels"]>0 for row in inventory["layers"]), "Empty part"
results={"unique_ids":len(ids),"artwork_layers":len(inventory["layers"]),"source_visible_pixels":visible,"source_coverage":"100%","embedded_images":0,"comparisons":{}}
for name,bg in [("dark",[22,33,55]),("white",[255,255,255])]:
    def composite(a):
        alpha=a[:,:,3:4]/255
        return np.rint(a[:,:,:3]*alpha+np.array(bg)*(1-alpha))
    a,b=composite(source),composite(render)
    error=np.abs(a-b)
    mse=float(np.mean(error**2))
    results["comparisons"][name]={"mean_absolute_channel_error":float(np.mean(error)),"max_channel_error":int(error.max()),"psnr_db":round(float(10*np.log10(255**2/mse)),3) if mse else "identical","exact_pixel_fraction":float(np.mean(np.all(a==b,axis=2)))}
    visible_error=error[source[:,:,3]>0]
    results["comparisons"][name]["visible_art_mean_absolute_channel_error"]=float(visible_error.mean())
    results["comparisons"][name]["visible_art_exact_pixel_fraction"]=float(np.mean(np.all(visible_error==0,axis=1)))
    assert error.mean()<.2, f"Unexpected rendering difference on {name}"
results["max_alpha_error"]=int(np.abs(source[:,:,3]-render[:,:,3]).max())
(ROOT/"images/sachi_ai_scale.validation.json").write_text(json.dumps(results,indent=2)+"\n")
print(json.dumps(results,indent=2))
