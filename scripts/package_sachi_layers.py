"""Package aligned layers in standard OpenRaster for illustration editors."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'images/sachi-rig'
data = json.loads((OUT / 'layers.json').read_text(encoding='utf-8'))
image = ET.Element('image', {'w': '708', 'h': '970', 'name': 'Sachi separated artwork', 'version': '0.0.3'})
stack = ET.SubElement(image, 'stack', {'name': 'Sachi'})
merged = Image.new('RGBA', (708, 970))
with ZipFile(OUT / 'sachi-layers.ora', 'w', compression=ZIP_DEFLATED) as archive:
    archive.writestr('mimetype', 'image/openraster', compress_type=ZIP_STORED)
    for layer in reversed(data['layers']):
        src = 'data/' + layer['id'] + '.png'
        ET.SubElement(stack, 'layer', {'name': layer['name'], 'src': src, 'x': '0', 'y': '0', 'opacity': '1.0', 'visibility': 'visible' if layer['visible'] else 'hidden', 'composite-op': 'svg:src-over'})
        archive.write(OUT / layer['file'], src)
    for layer in data['layers']:
        if layer['visible']:
            merged.alpha_composite(Image.open(OUT / layer['file']).convert('RGBA'))
    import io
    buffer = io.BytesIO()
    merged.save(buffer, format='PNG')
    archive.writestr('mergedimage.png', buffer.getvalue())
    merged.thumbnail((256, 256))
    buffer = io.BytesIO()
    merged.save(buffer, format='PNG')
    archive.writestr('Thumbnails/thumbnail.png', buffer.getvalue())
    archive.writestr('stack.xml', ET.tostring(image, encoding='utf-8', xml_declaration=True))
    archive.write(OUT / 'layers.json', 'sachi-layer-hierarchy.json')
print(f"Packaged sachi-layers.ora with {sum(p['visible'] for p in data['layers'])} artwork layers and {sum(not p['visible'] for p in data['layers'])} hidden fills.")
