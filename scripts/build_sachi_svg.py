"""Rebuild the layered SVG without embedding a bitmap.

Requires Pillow and NumPy. Source samples become merged, same-color vector
regions. This deliberately preserves the PNG's detail instead of inventing
simplified curves. It is a dense, pixel-derived SVG, not a Bezier redraw.
"""
from __future__ import annotations

from collections import defaultdict
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw
from sachi_cut_masks import refine_hair_collar_masks, concealed_tip_samples
from sachi_face_cut import refine_left_face_cut, left_face_contour
from sachi_right_bang import refine_right_bang, concealed_right_samples, contours
from sachi_forehead_fill import forehead_field, crown_field, row_regions
from sachi_cheek_fill import cheek_neck_field, refine_cheek_edges, BOX as CHEEK_BOX

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "images/sachi_ai_scale.png"
OUT = ROOT / "images/sachi_ai_scale.svg"
BUILD = ROOT / ".svg-build"
BOX = (130, 81, 838, 1051)
NS = "http://www.w3.org/2000/svg"
INK = "http://www.inkscape.org/namespaces/inkscape"
ET.register_namespace("", NS)
ET.register_namespace("inkscape", INK)

# Anatomical labels use SCREEN left/right, not the character's left/right.
# Polygons select visible source pixels; later entries take precedence.
# Coordinates are relative to the top-left of the source's occupied bounds.
PARTS = [
    ("hair-back", "Back hair", "head", (352, 140), [(0,0),(708,0),(708,970),(0,970)]),
    ("neck", "Neck", "body", (323,644), [(128,508),(449,500),(451,667),(216,704),(155,630)]),
    ("face", "Face skin", "head", (293,472), [(88,237),(133,211),(175,85),(352,87),(446,226),(458,374),(450,460),(429,525),(403,585),(358,624),(281,648),(191,651),(142,589),(91,523),(73,440),(70,326)]),
    ("hair-crown", "Crown and fringe", "head", (321,83), [(0,0),(708,0),(708,121),(600,172),(522,168),(444,225),(443,305),(430,300),(382,275),(347,261),(304,254),(289,264),(285,223),(232,244),(237,263),(222,251),(210,174),(204,140),(198,120),(182,165),(137,234),(92,258),(37,355),(0,352)]),
    ("hair-fringe-left", "Left fringe", "hair-crown", (195,70), [(0,244),(91,69),(215,22),(210,65),(204,122),(181,169),(138,238),(94,258),(90,285),(74,283),(38,354),(27,319),(0,342)]),
    ("hair-fringe-center", "Center fringe", "hair-crown", (267,66), [(210,39),(326,38),(337,178),(350,269),(302,256),(288,267),(284,219),(278,239),(239,246),(241,264),(224,251),(210,177),(204,113)]),
    ("hair-fringe-right", "Right fringe", "hair-crown", (331,56), [(322,33),(386,38),(439,130),(446,291),(438,312),(426,294),(384,274),(349,267),(339,190)]),
    ("hair-side-left", "Left long side lock", "head", (79,263), [(66,265),(84,249),(94,336),(85,414),(84,495),(103,548),(132,589),(143,650),(150,712),(126,732),(111,700),(92,645),(80,589),(72,514),(61,428),(56,340)]),
    ("hair-side-right", "Right long side lock", "head", (414,135), [(345,19),(379,39),(418,60),(455,83),(493,155),(520,244),(540,341),(532,452),(514,555),(516,622),(542,680),(567,725),(530,714),(483,678),(460,630),(442,548),(433,461),(433,384),(443,299),(436,198),(411,123),(375,60)]),
    ("hair-face-strand", "Thin strand beside cheek", "head", (441,334), [(442,306),(449,357),(444,423),(431,492),(406,563),(374,624),(355,643),(377,607),(399,550),(418,481),(432,411)]),
    ("ear-right", "Visible ear", "head", (535,424), [(532,367),(550,356),(568,358),(580,369),(585,399),(582,449),(567,471),(544,489),(520,498),(517,474),(527,446)]),
    ("ear-inner", "Inner ear", "ear-right", (544,421), [(529,388),(553,379),(563,390),(571,418),(559,438),(537,463),(524,457),(527,434),(536,425),(526,413)]),
    ("hair-clip", "Hair clip", "head", (582,189), [(518,177),(519,195),(552,201),(577,211),(593,207),(603,219),(638,247),(654,217),(647,181),(629,159),(609,156),(598,179),(581,171),(569,182),(532,178)]),
    ("brow-left", "Left eyebrow", "head", (142,277), [(87,264),(121,251),(160,250),(182,266),(195,290),(201,316),(182,309),(161,286),(142,285),(106,303),(91,305)]),
    ("brow-right", "Right eyebrow", "head", (360,307), [(305,316),(337,300),(353,291),(368,292),(392,305),(420,327),(403,327),(376,311),(359,306),(334,312)]),
    ("eye-left-white", "Left eye white", "eye-left", (146,356), [(90,332),(108,317),(133,304),(149,299),(165,308),(183,329),(196,347),(197,365),(183,388),(170,402),(129,405),(111,393),(99,379),(92,359)]),
    ("iris-left", "Left iris", "eye-left", (159,359), [(131,326),(159,325),(175,333),(185,350),(185,369),(175,387),(157,394),(141,389),(130,375),(125,354)]),
    ("pupil-left", "Left pupil", "iris-left", (162,361), [(157,353),(167,353),(169,368),(157,370)]),
    ("lash-left-upper", "Left upper eyelashes", "eye-left", (144,328), [(91,330),(108,314),(145,302),(164,311),(178,323),(188,345),(194,361),(182,346),(173,342),(151,338),(133,337),(114,342),(100,353)]),
    ("lash-left-lower", "Left lower eyelashes", "eye-left", (151,391), [(129,384),(143,386),(161,386),(179,382),(177,392),(158,399),(132,400),(125,395)]),
    ("eye-left-highlights", "Left eye reflections", "eye-left", (142,352), [(127,330),(137,324),(147,326),(153,332),(146,344),(133,344)]),
    ("eye-left-glint", "Left lower eye glint", "iris-left", (169,380), [(161,371),(176,371),(177,385),(163,387)]),
    ("eye-right-white", "Right eye white", "eye-right", (377,376), [(303,340),(324,326),(350,318),(375,316),(401,331),(425,349),(439,365),(445,381),(438,400),(420,419),(407,433),(374,429),(340,418),(322,405),(310,380),(306,355)]),
    ("iris-right", "Right iris", "eye-right", (385,386), [(355,347),(378,344),(399,353),(415,367),(422,386),(413,404),(397,419),(374,419),(356,408),(346,389),(346,369)]),
    ("pupil-right", "Right pupil", "iris-right", (387,385), [(381,377),(393,377),(394,394),(380,394)]),
    ("lash-right-upper", "Right upper eyelashes", "eye-right", (372,347), [(307,347),(324,336),(317,335),(338,326),(363,319),(383,323),(406,337),(428,357),(443,369),(444,389),(435,404),(431,385),(411,365),(391,354),(374,349),(351,347),(329,352),(307,357)]),
    ("lash-right-lower", "Right lower eyelashes", "eye-right", (388,417), [(348,405),(369,412),(395,415),(414,405),(421,405),(417,416),(399,426),(373,422),(350,414)]),
    ("eye-right-highlights", "Right eye reflections", "eye-right", (363,350), [(348,340),(360,336),(371,341),(379,349),(372,359),(359,361),(347,351)]),
    ("eye-right-glint", "Right lower eye glint", "iris-right", (393,408), [(384,399),(402,399),(402,414),(387,417)]),
    ("nose", "Nose and bridge shadow", "head", (163,428), [(145,408),(158,397),(177,394),(185,405),(177,427),(171,441),(172,452),(161,462),(149,455),(142,436)]),
    ("nose-highlight", "Nose highlight", "nose", (181,425), [(175,417),(189,417),(189,432),(175,432)]),
    ("mouth-corner", "Left mouth corner", "head", (179,525), [(162,510),(178,514),(193,525),(201,538),(177,533),(163,524)]),
    ("mouth", "Mouth line", "head", (248,537), [(216,528),(236,530),(253,531),(278,530),(277,544),(256,549),(232,545),(219,541)]),
    ("lip-highlight", "Lower lip highlight", "head", (234,547), [(226,543),(242,543),(244,554),(226,554)]),
    ("cheek-left-marks", "Left cheek marks", "head", (112,393), [(101,378),(109,378),(114,385),(124,395),(124,410),(100,411)]),
    ("cheek-right-marks", "Right cheek marks", "head", (407,432), [(396,433),(407,420),(420,402),(429,401),(424,425),(414,441),(409,451),(397,451)]),
    ("coat-back", "Coat and rear panel", "body", (345,796), [(0,786),(90,739),(166,699),(231,669),(290,650),(350,648),(414,652),(466,667),(521,699),(575,719),(658,746),(708,775),(708,970),(0,970)]),
    ("collar-back", "Upper collar band", "body", (361,679), [(60,771),(127,731),(210,695),(277,660),(336,649),(390,650),(449,662),(523,696),(567,716),(639,737),(634,779),(570,751),(498,721),(422,693),(362,681),(307,684),(267,704),(216,720),(135,752),(78,809)]),
    ("collar-left", "Left folded collar", "body", (255,728), [(47,835),(77,796),(143,754),(214,725),(272,703),(317,701),(326,710),(296,731),(259,771),(224,812),(201,848),(166,878),(154,902),(122,936),(94,909),(62,874),(47,853)]),
    ("sleeve-main", "Shoulder and sleeve", "body", (328,732), [(184,970),(202,908),(212,851),(242,798),(278,750),(304,724),(326,710),(348,709),(375,718),(402,740),(426,772),(452,827),(479,883),(494,929),(482,970)]),
    ("sleeve-left-fold", "Left sleeve fold", "sleeve-main", (279,780), [(155,970),(171,921),(197,855),(239,799),(268,765),(246,806),(225,854),(212,907),(216,970)]),
    ("sleeve-right-panel", "Right sleeve panel", "sleeve-main", (373,745), [(367,732),(389,740),(410,760),(436,800),(458,851),(479,886),(493,930),(480,970),(382,970),(382,858),(377,784)]),
    ("shoulder-trim", "Cyan shoulder piping", "sleeve-main", (344,718), [(305,722),(325,704),(350,703),(377,712),(399,728),(419,750),(440,782),(463,834),(488,884),(497,925),(487,970),(466,970),(477,927),(475,891),(455,841),(431,793),(408,755),(384,733),(355,721),(330,718)]),
    ("coat-right-panel", "Right front coat panel", "body", (484,786), [(431,774),(469,794),(522,817),(578,838),(624,847),(672,868),(671,922),(652,967),(590,970),(517,970),(487,902),(461,842)]),
    ("coat-right-hem", "Right luminous hem", "coat-right-panel", (674,828), [(631,779),(657,790),(680,815),(702,847),(708,875),(695,923),(677,953),(656,970),(590,970),(629,958),(648,937),(665,910),(670,877),(662,850),(647,822)]),
    ("collar-right-tip", "Right collar tip", "body", (636,752), [(630,735),(663,746),(703,772),(690,812),(667,798),(634,782)]),
    ("collar-right-seam", "Right collar seam", "body", (634,765), [(596,725),(638,737),(633,773),(648,805),(643,832),(625,814),(609,800),(607,778),(591,771)]),
    ("clasp-left", "Left collar clasp", "collar-left", (77,862), [(45,840),(62,832),(88,838),(97,855),(99,881),(79,890),(67,871),(53,864)]),
    ("clasp-right", "Right collar clasp", "coat-right-panel", (653,886), [(641,854),(658,854),(669,872),(669,898),(658,916),(649,917),(634,899),(633,879)]),
    ("clasp-right-highlight", "Right clasp center", "clasp-right", (652,886), [(643,872),(657,870),(663,882),(660,896),(648,901),(640,892)]),
    ("strap-left", "Diagonal left strap", "body", (173,886), [(64,970),(102,938),(125,913),(145,883),(156,870),(183,858),(176,882),(160,907),(129,935),(101,970)]),
    ("cord-left", "Lower left cord", "body", (146,919), [(68,970),(111,938),(147,910),(186,883),(197,887),(166,917),(139,941),(123,970),(110,970),(127,946),(93,970)]),
]

PARENTS = {
    "body": ("sachi", "Body and clothing", (340,850)),
    "head": ("sachi", "Head and facial features", (322,635)),
    "eye-left": ("head", "Left eye assembly", (147,359)),
    "eye-right": ("head", "Right eye assembly", (378,379)),
}


def element(tag, attrs=None, parent=None):
    el = ET.Element(f"{{{NS}}}{tag}", attrs or {})
    if parent is not None:
        parent.append(el)
    return el


def region_path(points):
    return "M" + " L".join(f"{x} {y}" for x,y in points) + " Z"


def build():
    BUILD.mkdir(exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    im = np.array(source.crop(BOX))
    height,width = im.shape[:2]
    label_image = Image.new("L", (width,height), 0)
    draw = ImageDraw.Draw(label_image)
    for index, part in enumerate(PARTS):
        draw.polygon(part[4], fill=index)
    labels = np.array(label_image)
    # The flattened source contains fringe ink just beyond the selection
    # polygons. Keep it with the hair so a gust cannot leave old tips on the face.
    indices={part[0]:i for i,part in enumerate(PARTS)}
    yy,xx=np.mgrid[:height,:width]
    fringe_ink=(labels==indices["face"])&(yy<275)&(im[:,:,0]<105)&(im[:,:,3]>0)
    for ident,zone in [("hair-fringe-left",xx<205),("hair-fringe-center",(xx>=205)&(xx<305)),("hair-fringe-right",xx>=305)]:
        labels[fringe_ink&zone]=indices[ident]

    cut_report=refine_hair_collar_masks(labels,im,indices)
    face_cut_report=refine_left_face_cut(labels,im,indices)
    right_bang_report=refine_right_bang(labels,im,indices)
    _,_,strand_inner,strand_outer=contours(im)
    cheek_edge_report=refine_cheek_edges(labels,im,indices,strand_inner,strand_outer)

    # Merge exact-equal neighboring samples horizontally, then vertically.
    # Every nontransparent source sample is represented exactly once.
    regions = defaultdict(list)
    active = {}
    rect_count = 0
    for y in range(height):
        row=im[y]
        changes=np.any(row[1:] != row[:-1],axis=1) | (labels[y,1:] != labels[y,:-1])
        edges=np.r_[0,np.flatnonzero(changes)+1,width]
        next_active={}
        for x,x2 in zip(edges[:-1],edges[1:]):
            rgba=tuple(int(v) for v in row[x])
            if not rgba[3]:
                continue
            layer=int(labels[y,x])
            key=(layer,rgba,int(x),int(x2-x))
            if key in active:
                rect=active.pop(key)
                rect[3]+=1
            else:
                rect=[int(x),y,int(x2-x),1]
            next_active[key]=rect
        for (layer,rgba,_,_),rect in active.items():
            regions[(layer,rgba)].append(rect)
            rect_count+=1
        active=next_active
    for (layer,rgba,_,_),rect in active.items():
        regions[(layer,rgba)].append(rect)
        rect_count+=1

    svg=element("svg", {"version":"1.1", "width":"1920", "height":"1080", "viewBox":"0 0 1920 1080", "role":"img", "aria-labelledby":"sachi-title sachi-description"})
    element("title", {"id":"sachi-title"}, svg).text="Sachi — faithful layered vector reconstruction"
    element("desc", {"id":"sachi-description"}, svg).text=(
        "Dense, pixel-derived vector paths preserve the source PNG's colors and alpha. "
        "No embedded bitmap. Parts can be transformed independently. This is not a "
        "simplified Bezier redraw; source pixel geometry remains visible at high zoom. "
        "Hidden underpainting and closed-eye guides support restrained puppet animation. "
        "Left and right refer to screen directions.")
    metadata=element("metadata", parent=svg)
    metadata.text=json.dumps({"source":"sachi_ai_scale.png", "source_sha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "art_bounds":[130,81,708,970], "geometry":"Merged exact-color source-sample regions", "left_right_convention":"screen", "underpainting":"Reconstructed approximations, hidden by default", "generator":"scripts/build_sachi_svg.py"})
    defs=element("defs", parent=svg)
    sampling=element("filter",{"id":"motion-sampling","x":"-10%","y":"-10%","width":"120%","height":"120%","color-interpolation-filters":"sRGB"},defs)
    element("feGaussianBlur",{"stdDeviation":".01"},sampling)
    silhouette=element("clipPath",{"id":"source-silhouette","clipPathUnits":"userSpaceOnUse"},defs)
    silhouette_runs=[]
    for y in range(height):
        opaque=im[y,:,3]>=128
        boundaries=np.flatnonzero(np.diff(np.r_[False,opaque,False].astype(np.int8)))
        silhouette_runs.extend(f"M{x} {y}h{x2-x}v1h-{x2-x}z" for x,x2 in zip(boundaries[::2],boundaries[1::2]))
    element("path",{"d":"".join(silhouette_runs)},silhouette)
    face_clip=element('clipPath',{'id':'face-left-contour','clipPathUnits':'userSpaceOnUse'},defs)
    contour=left_face_contour(im)
    # The hidden skin fill may reconstruct the forehead under the fringe, but
    # it must not fill the transparent opening behind the left side lock.
    element('path',{'d':''.join(f'M{int(x)+2 if x else 0} {y}H708v1H{int(x)+2 if x else 0}z' for y,x in enumerate(contour))},face_clip)
    back_clip=element('clipPath',{'id':'back-hair-hidden-contour','clipPathUnits':'userSpaceOnUse'},defs)
    _,right_edge,_,_=contours(im)
    element('path',{'d':''.join(f'M0 {y}H{int(right_edge[y])-44 if 140<=y<600 else 708}v1H0z' for y in range(height))},back_clip)
    for ident, color1,color2 in [("skin-fill","#8283c9","#7476bc"),("neck-fill","#8589c4","#a0e8f6"),("cloth-fill","#45658b","#2b426d"),("hair-fill","#26396d","#17264f")]:
        gradient=element("linearGradient", {"id":ident,"x1":"0","y1":"0","x2":"1","y2":"1"},defs)
        element("stop",{"offset":"0","stop-color":color1},gradient)
        element("stop",{"offset":"1","stop-color":color2},gradient)
    art=element("g", {"id":"sachi","transform":"translate(130 81)","data-pivot":"340 850", "data-bounds":"0 0 708 970"},svg)
    containers={"sachi":art}

    def group(ident,label,parent,pivot):
        g=element("g", {"id":ident,f"{{{INK}}}groupmode":"layer",f"{{{INK}}}label":label,"data-pivot":f"{pivot[0]} {pivot[1]}","style":f"transform-origin:{pivot[0]}px {pivot[1]}px;transform-box:view-box"},parent)
        containers[ident]=g
        return g

    body=group("body",PARENTS["body"][1],art,PARENTS["body"][2])
    head=group("head",PARENTS["head"][1],art,PARENTS["head"][2])

    hidden_groups={}
    hidden_shapes={}
    for ident,parent,d,fill in [
        ("body-underpaint",body,"M143 589 L433 530 L466 733 L225 776 Z","neck-fill"),
        ("coat-underpaint",body,"M77 805 Q305 612 535 721 L678 797 L660 970 L126 970 Z","cloth-fill"),
        ("face-underpaint",head,"M74 320 L82 268 Q135 205 190 117 Q229 159 258 182 Q365 173 443 301 L439 459 Q426 569 357 614 L199 636 Q91 533 74 442 Z","skin-fill"),
        ("hair-underpaint",head,"M97 175 Q327 -11 566 110 L637 270 L623 448 L543 568 L465 498 L451 225 L194 174 Z","hair-fill"),
    ]:
        g=element("g",{"id":ident,"class":"underpaint","style":"display:none","data-reconstructed":"true","clip-path":"url(#source-silhouette)"},parent)
        attrs={"d":d,"fill":f"url(#{fill})"}
        if ident=='face-underpaint':attrs['clip-path']='url(#face-left-contour)'
        if ident=='hair-underpaint':attrs['clip-path']='url(#back-hair-hidden-contour)'
        element("path",attrs,g)
        hidden_groups[ident]=g
        hidden_shapes[ident]=d

    forehead,forehead_report,_=forehead_field(im,labels,indices)
    crown=crown_field(im,labels,indices)
    for ident,field,box,surface,edge_clip in [
        ('face-underpaint',forehead,(70,110,448,340),'forehead','face-left-contour'),
        ('hair-underpaint',crown,(0,0,708,250),'crown','back-hair-hidden-contour'),
    ]:
        clip=element('clipPath',{'id':surface+'-hidden-shape','clipPathUnits':'userSpaceOnUse'},defs)
        element('path',{'d':hidden_shapes[ident]},clip)
        patch=element('g',{'data-surface':surface,'clip-path':f'url(#{surface}-hidden-shape)'},hidden_groups[ident])
        samples=defaultdict(list)
        for x,y,run_width,color in row_regions(field,box):samples[color].append(f'M{x} {y}h{run_width}v1h-{run_width}z')
        for color,paths in samples.items():
            element('path',{'d':''.join(paths),'fill':'#'+''.join(f'{v:02x}' for v in color),
                'shape-rendering':'crispEdges','clip-path':f'url(#{edge_clip})'},patch)

    concealed=defaultdict(list)
    for surface,x,y,rgba in concealed_right_samples(im,labels,indices):
        concealed[(surface,rgba)].append(f'M{x} {y}h1v1h-1z')
    for (surface,(r,g,b,a)),paths in concealed.items():
        parent=hidden_groups['hair-underpaint' if surface=='hair' else 'face-underpaint']
        element('path',{'data-surface':surface,'shape-rendering':'crispEdges',
            'fill':f'#{r:02x}{g:02x}{b:02x}','fill-opacity':str(a/255),'d':''.join(paths)},parent)

    # A rounded concealed ear contour avoids a rectangular colour patch when
    # the bang moves away. Visible ear pixels still render above this surface.
    ear_gradient=element('linearGradient',{'id':'ear-concealed-shading',
        'gradientUnits':'userSpaceOnUse','x1':'510','y1':'365','x2':'520','y2':'465'},defs)
    for offset,(x,y) in [('0',(548,370)),('1',(536,440))]:
        rgb=im[y,x,:3]
        element('stop',{'offset':offset,'stop-color':'#'+''.join(f'{v:02x}' for v in rgb)},ear_gradient)
    ear_occlusion=element('clipPath',{'id':'ear-behind-bang','clipPathUnits':'userSpaceOnUse'},defs)
    element('path',{'d':''.join(f'M470 {y}H{int(right_edge[y])+1}v1H470z' for y in range(353,492))},ear_occlusion)
    ear=element('g',{'data-surface':'concealed-ear','clip-path':'url(#ear-behind-bang)'},hidden_groups['face-underpaint'])
    ear_shape='M552 355 C527 350 513 365 508 389 L501 428 C497 450 495 470 509 485 Q520 493 540 480 L577 443 L583 396 L573 367 Z'
    element('path',{'d':ear_shape,'fill':'url(#ear-concealed-shading)'},ear)
    ear_clip=element('clipPath',{'id':'concealed-ear-contour'},defs)
    element('path',{'d':ear_shape},ear_clip)
    rgb=im[480,530,:3]
    element('path',{'d':'M497 455 Q510 477 535 466 L560 440 L582 419 L586 459 Q551 500 518 495 L493 480 Z',
        'fill':'#'+''.join(f'{v:02x}' for v in rgb),'clip-path':'url(#concealed-ear-contour)'},ear)
    ear_join=defaultdict(list)
    for y in range(360,491):
        edge=int(right_edge[y]);samples=im[y,edge+1:edge+10,:3].astype(float)
        valid=(samples[:,0]>65)&(samples[:,2]>110)
        if not valid.any():continue
        target=np.median(samples[valid][:3],axis=0)
        base=im[480,530,:3] if y>=473 else (im[370,548,:3].astype(float)*(1-(y-360)/130)+im[440,536,:3].astype(float)*((y-360)/130))
        for x in range(edge-24,edge+2):
            u=np.clip((x-edge+24)/18,0,1);u=u*u*(3-2*u)
            color=tuple(np.rint(base*(1-u)+target*u).astype(int))
            ear_join[color].append(f'M{x} {y}h1v1h-1z')
    for color,paths in ear_join.items():
        element('path',{'d':''.join(paths),'fill':'#'+''.join(f'{v:02x}' for v in color),
            'shape-rendering':'crispEdges','clip-path':'url(#concealed-ear-contour)'},ear)
    element('path',{'d':ear_shape,'fill':'none','stroke':'#040713','stroke-width':'2.5','stroke-linejoin':'round'},ear)

    cheek_neck,cheek_report=cheek_neck_field(im,labels,indices)
    cheek_report['edgeRefinement']=cheek_edge_report
    outside_cheek=element('clipPath',{'id':'outside-cheek-neck-patch','clipPathUnits':'userSpaceOnUse'},defs)
    left,top,right,bottom=CHEEK_BOX
    element('path',{'d':f'M0 0H708V970H0Z M{left} {top}H{right}V{bottom}H{left}Z','clip-rule':'evenodd'},outside_cheek)
    for ident in ['face-underpaint','body-underpaint']:
        # Replace the base fill here, rather than accumulating two antialiased
        # silhouettes and making their edge pixels more opaque.
        base=hidden_groups[ident][0];hidden_groups[ident].remove(base)
        outside=element('g',{'clip-path':'url(#outside-cheek-neck-patch)'})
        outside.append(base);hidden_groups[ident].insert(0,outside)
        clip_id=ident+'-cheek-neck-shape'
        clip=element('clipPath',{'id':clip_id,'clipPathUnits':'userSpaceOnUse'},defs)
        element('path',{'d':hidden_shapes[ident]},clip)
        patch=element('g',{'data-surface':'cheek-neck','clip-path':f'url(#{clip_id})'},hidden_groups[ident])
        samples=defaultdict(list)
        for x,y,run_width,color in row_regions(cheek_neck,CHEEK_BOX):
            samples[color].append(f'M{x} {y}h{run_width}v1h-{run_width}z')
        for color,paths in samples.items():
            attrs={'d':''.join(paths),'fill':'#'+''.join(f'{v:02x}' for v in color),'shape-rendering':'crispEdges'}
            if ident=='face-underpaint':attrs['clip-path']='url(#face-left-contour)'
            element('path',attrs,patch)

    # Fit local skin shading to the surrounding visible face for closed eyes.
    # These inferred vector gradients remain hidden in the original rest pose.
    face_index=next(i for i,part in enumerate(PARTS) if part[0]=="face")
    yy,xx=np.mgrid[:height,:width]
    for side,(left,top,right,bottom) in [("left",(88,299,202,405)),("right",(303,315,447,434))]:
        ring=(labels==face_index)&(xx>left-12)&(xx<right+12)&(yy>top-12)&(yy<bottom+12)&(im[:,:,3]>250)
        coordinates=np.column_stack([np.ones(np.count_nonzero(ring)),xx[ring],yy[ring]])
        colors=im[ring,:3].astype(float)
        fit=np.linalg.lstsq(coordinates,colors,rcond=None)[0]
        for _ in range(2):
            errors=np.linalg.norm(coordinates@fit-colors,axis=1)
            keep=errors<np.quantile(errors,.9)
            fit=np.linalg.lstsq(coordinates[keep],colors[keep],rcond=None)[0]
        axis=np.linalg.svd(fit[1:],full_matrices=False)[0][:,0]
        center=np.array([(left+right)/2,(top+bottom)/2])
        corners=np.array([[left,top],[right,top],[left,bottom],[right,bottom]])
        projections=(corners-center)@axis
        ends=[center+axis*value for value in [projections.min(),projections.max()]]
        gradient=element("linearGradient",{"id":f"eyelid-{side}-skin","gradientUnits":"userSpaceOnUse","x1":str(ends[0][0]),"y1":str(ends[0][1]),"x2":str(ends[1][0]),"y2":str(ends[1][1])},defs)
        for offset,point in zip(["0","1"],ends):
            rgb=np.clip(np.rint(np.r_[1,point]@fit),0,255).astype(int)
            element("stop",{"offset":offset,"stop-color":"#"+"".join(f"{v:02x}" for v in rgb)},gradient)
        patch=element("g",{"id":f"eyelid-{side}-underpaint","class":"underpaint","style":"display:none","data-reconstructed":"true"},head)
        element("path",{"d":f"M{left} {top}H{right}V{bottom}H{left}Z","fill":f"url(#eyelid-{side}-skin)"},patch)

    part_map={part[0]:part for part in PARTS}
    def ensure(ident):
        if ident in containers:
            return containers[ident]
        if ident in PARENTS:
            parent,label,pivot=PARENTS[ident]
        else:
            _,label,parent,pivot,_=part_map[ident]
        return group(ident,label,ensure(parent),pivot)

    for ident,_,_,_,_ in PARTS:
        ensure(ident)

    # Concealed hair ends are inferred from the neighbouring source shading.
    # Keep them separate and hidden in the SVG/rest pose. The rig draws these
    # beneath the source lock, and draws the collar over both surfaces.
    for side in ['left','right']:
        patch=element('g',{'id':f'hair-side-{side}-continuation',
            'class':'underpaint','style':'display:none','data-reconstructed':'true',
            'data-role':'hair-tip-continuation','shape-rendering':'crispEdges'},
            containers[f'hair-side-{side}'])
        samples=defaultdict(list)
        for x,y,rgba in concealed_tip_samples(im,side):
            if rgba[3]:samples[rgba].append(f'M{x} {y}h1v1h-1z')
        for (r,g,b,a),paths in samples.items():
            element('path',{'fill':f'#{r:02x}{g:02x}{b:02x}',
                'fill-opacity':str(a/255),'d':''.join(paths)},patch)

    layer_stats=[]
    for index,(ident,label,parent,pivot,poly) in enumerate(PARTS):
        g=containers[ident]
        # Shared sample edges must stay coincident at fractional display scales.
        # Per-region antialiasing would otherwise expose hairline seams.
        paint=element("g", {"data-artwork":"true", "shape-rendering":"crispEdges"})
        # Paint below child groups (which take precedence in the selection map).
        g.insert(0,paint)
        colors=0
        samples=int(np.count_nonzero((labels==index)&(im[:,:,3]>0)))
        for (region_index,rgba),rects in regions.items():
            if region_index != index:
                continue
            r,green,b,alpha=rgba
            attrs={"fill":f"#{r:02x}{green:02x}{b:02x}","d":"".join(f"M{x} {y}h{w}v{h}h-{w}z" for x,y,w,h in rects)}
            if alpha!=255:
                attrs["fill-opacity"]=f"{alpha/255:.8f}".rstrip("0")
            element("path",attrs,paint)
            colors+=1
        layer_stats.append({"id":ident,"label":label,"parent":parent,"pivot":list(pivot),"source_pixels":samples,"paths":colors})

    # Optional closed-eye drawings. These are reconstructed guides, not source art.
    for side,d in [("left","M98 354 Q140 383 183 359"),("right","M322 378 Q374 413 431 385")]:
        g=element("g",{"id":f"eyelid-{side}-closed","style":"display:none","data-reconstructed":"true"},head)
        element("path",{"d":d,"fill":"none","stroke":"#030510","stroke-width":"4","stroke-linecap":"round"},g)

    ET.ElementTree(svg).write(OUT,encoding="utf-8",xml_declaration=True)
    report={"source":SOURCE.relative_to(ROOT).as_posix(),"svg":OUT.relative_to(ROOT).as_posix(),"canvas":[1920,1080],"art_bounds":[130,81,708,970],"paths":sum(row["paths"] for row in layer_stats),"merged_rectangles":rect_count,"bytes":OUT.stat().st_size,"cutRefinement":cut_report,"faceCutRefinement":face_cut_report,"rightBangRefinement":right_bang_report,"foreheadFill":forehead_report,"cheekNeckFill":cheek_report,"layers":layer_stats}
    (ROOT/"images/sachi_ai_scale.layers.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({key:value for key,value in report.items() if key!="layers"},indent=2))

    # Inspection-only part map, useful when revising the selection polygons.
    rng=np.random.default_rng(14)
    palette=rng.integers(60,240,size=(len(PARTS),3),dtype=np.uint8)
    chart=palette[labels]
    chart[im[:,:,3]==0]=[22,33,55]
    Image.fromarray(chart).save(BUILD/"layer-map.png")


if __name__ == "__main__":
    build()
