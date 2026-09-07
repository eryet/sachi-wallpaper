"""Extract renderable layer SVGs and hierarchy from the editable SVG master."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
BUILD=ROOT/".svg-build/animation-layers"
SOURCE=ROOT/"images/sachi_ai_scale.svg"
NS="http://www.w3.org/2000/svg"
ET.register_namespace("",NS)
BUILD.mkdir(parents=True,exist_ok=True)
tree=ET.parse(SOURCE)
root=tree.getroot()
defs=root.find(f"{{{NS}}}defs")
art=root.find(f".//*[@id='sachi']")
layers=[]

def visit(group,parent=None):
    ident=group.get("id")
    if not ident:
        return
    node={"id":ident,"parent":parent,"pivot":[float(v) for v in group.get("data-pivot","0 0").split()],"children":[]}
    if group.get('data-role'):
        node['role']=group.get('data-role')
    if "underpaint" in group.get("class",""):
        node["kind"]="underpaint"
    elif ident.startswith("eyelid-"):
        node["kind"]="closed-eye"
    else:
        node["kind"]="art"
    paint=group.find(f"{{{NS}}}g[@data-artwork='true']")
    content=paint if paint is not None else group if node["kind"]!="art" else None
    if content is not None:
        svg=ET.Element(f"{{{NS}}}svg",{"width":"708","height":"970","viewBox":"0 0 708 970"})
        svg.append(deepcopy(defs))
        copy=deepcopy(content)
        copy.attrib.pop("style",None)
        svg.append(copy)
        ET.ElementTree(svg).write(BUILD/f"{ident}.svg",encoding="utf-8",xml_declaration=True)
        node["file"]=f"{ident}.svg"
    layers.append(node)
    for child in group:
        if child.tag==f"{{{NS}}}g" and child.get("id"):
            node["children"].append(child.get("id"))
            visit(child,ident)

visit(art)
manifest={"version":1,"source":"images/sachi_ai_scale.svg","sourceSha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),"canvas":[1920,1080],"artBounds":[130,81,708,970],"nodes":layers}
# Only explicitly reviewed SVG revisions with the same part IDs/coordinates
# can migrate a saved rig. An arbitrary changed SVG remains incompatible.
revisions=ROOT/'scripts/sachi-art-revisions.json'
if revisions.exists():
    manifest['compatibleSourceSha256']=json.loads(revisions.read_text(encoding='utf-8')).get(manifest['sourceSha256'],[])
(BUILD/"hierarchy.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
print(f"Exported {sum('file' in node for node in layers)} layer SVGs from the master.")
