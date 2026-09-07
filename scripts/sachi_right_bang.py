"""Source-ink cuts and concealed surfaces beside the screen-right bang.

Visible artwork keeps its original RGBA. Only ownership changes. Concealed
samples are separate vector underpainting fitted to the adjacent source surface.
"""
import numpy as np

INNER=[(140,426),(150,430),(175,435),(200,437),(225,439),(250,441),
       (275,443),(300,443),(325,442),(350,440),(375,439),(400,436),
       (425,432),(432,431),(440,446),(460,447),(480,447),(500,449),
       (520,451),(540,453),(560,457),(580,460),(600,463),(620,468),(625,470)]
OUTER=[(140,515),(150,518),(175,525),(200,530),(225,534),(250,535),
       (275,536),(300,535),(325,535),(350,533),(375,531),(400,528),
       (425,524),(450,522),(475,520),(500,518),(525,516),(550,515),
       (565,514),(580,513),(600,514),(620,517),(625,520)]
STRAND_INNER=[(430,430),(440,429),(460,425),(480,421),(500,417),
              (520,412),(540,406),(560,400),(580,393),(600,384),
              (620,372),(640,357),(643,354)]
STRAND_OUTER=[(430,440),(440,445),(460,442),(480,436),(500,430),
              (520,424),(540,416),(560,407),(580,396),(600,387),
              (620,375),(640,357),(643,354)]


def ink_contour(im, guide):
    expected=np.interp(np.arange(im.shape[0]),*np.array(guide).T)
    contour=np.rint(expected).astype(int)
    for y in range(guide[0][0],guide[-1][0]+1):
        columns=np.arange(round(expected[y])-3,round(expected[y])+4)
        rgb=im[y,columns,:3].astype(float)
        cost=rgb@np.array([.25,.5,.25])+5*(columns-expected[y])**2
        contour[y]=columns[np.argmin(cost)]
    return contour


def contours(im):
    inner,outer,strand_in,strand_out=[ink_contour(im,g) for g in [INNER,OUTER,STRAND_INNER,STRAND_OUTER]]
    # Give the moving hair the complete ink run at a skin-facing boundary.
    # A split through the ink would leave a stationary black ghost contour.
    for edge,first,last,direction in [(inner,285,625,-1),
                                     (strand_in,430,643,-1),
                                     (strand_out,465,643,1)]:
        for y in range(first,last+1):
            start=int(edge[y]);x=start
            while abs(x-start)<5 and max(im[y,x+direction,:3])<85:
                x+=direction
            if edge is inner:
                # Lash/neck ink touches the bang in the flattened source.
                # Keep those junctions on the traced curve, not on their spurs.
                expected=np.interp(y,*np.array(INNER).T)
                x=max(x,round(expected)-1)
            edge[y]=x
    for y in range(200,566):
        start=int(outer[y]);x=start
        while x-start<4 and max(im[y,x+1,:3])<75:x+=1
        outer[y]=x
    # Below the neck contact there is a real transparent gap. Preserve the
    # whole connected hair silhouette, including its faint antialiasing fringe.
    for y in range(568,626):
        x=int(inner[y]);minimum=max(0,x-14)
        while x>minimum and im[y,x-1,3]>0:x-=1
        if x>minimum:inner[y]=x
    return inner,outer,strand_in,strand_out


def refine_right_bang(labels,im,indices):
    before=labels.copy();yy,xx=np.indices(labels.shape)
    inner,outer,strand_in,strand_out=contours(im)
    # Split through the dark outline, retaining its skin-facing antialiasing
    # on the face and its hair-facing half on the moving lock.
    region=(yy>=140)&(yy<=625)
    main=region&(xx>=inner[:,None])&(xx<=outer[:,None])
    movable=np.isin(labels,[indices[n] for n in ['hair-side-right','hair-face-strand']])
    left=region&(xx<inner[:,None])&movable
    labels[left]=indices['face']
    # The lower triangular sliver is illuminated neck, not lavender face.
    neck_edge=np.interp(np.arange(im.shape[0]),[490,520,540,560,580,600,625],
                        [480,450,416,385,350,315,276])[:,None]
    labels[left&(xx>=neck_edge)]=indices['neck']
    labels[region&(xx>outer[:,None])&movable]=indices['hair-back']
    ear_return=region&(yy>=360)&(yy<491)&(xx>outer[:,None])&movable
    labels[ear_return]=indices['ear-right']
    labels[main]=indices['hair-side-right']
    between=(yy>=465)&(yy<=625)&(xx>strand_out[:,None])&(xx<inner[:,None])
    labels[between]=indices['face']
    labels[between&(xx>=neck_edge)]=indices['neck']
    strand=(yy>=430)&(yy<=643)&(xx>=strand_in[:,None])&(xx<=strand_out[:,None])
    labels[strand]=indices['hair-face-strand']
    # Clear skin carried by the coarse cheek-strand polygon below the split.
    old_strand=(labels==indices['hair-face-strand'])&(yy>=430)&~strand
    labels[old_strand]=indices['face']
    labels[old_strand&(xx>=neck_edge)]=indices['neck']
    labels[main]=indices['hair-side-right']
    # The short fringe's curved tip ends at the black ink, not the polygon's
    # diagonal strip of lavender forehead.
    rgb=im[:,:,:3].astype(float)
    skin=(rgb[:,:,0]>60)&(rgb[:,:,0]>.52*rgb[:,:,2])&(rgb[:,:,2]>110)
    tip=(labels==indices['hair-fringe-right'])&(yy>=260)&(yy<320)&skin
    labels[tip]=indices['face']
    ink=(rgb.max(axis=2)<85)
    remnant=region&(yy<355)&(xx>=inner[:,None]-4)&(xx<inner[:,None])&ink&(labels==indices['face'])
    labels[remnant]=indices['hair-side-right']
    fringe_alpha=region&(yy>=565)&(xx>outer[:,None])&(xx<=outer[:,None]+12)&(im[:,:,3]<128)
    labels[fringe_alpha]=indices['hair-side-right']
    return {'revision':'right-bang-ink-cut-1',
            'reassignedSourcePixels':int(np.count_nonzero((before!=labels)&(im[:,:,3]>0))),
            'unchangedSourceRGBA':True}


def concealed_right_samples(im,labels,indices):
    """Extend each surface's local shading beneath the moving bang.

    No cyan rim is copied into the back hair, and the lower hair extension
    tapers at the bob ends. The builder adds a separate concealed ear surface.
    """
    _,outer,_,_=contours(im)
    rows=np.arange(140,590)
    shades=[]
    for y in rows:
        edge=outer[y]
        block=im[max(0,y-2):y+3,edge+3:edge+74,:3].reshape(-1,3).astype(float)
        owner=labels[max(0,y-2):y+3,edge+3:edge+74].reshape(-1)
        valid=(owner==indices['hair-back'])&(block[:,0]>15)&(block[:,0]<65)&(block[:,1]<85)&(block[:,2]>55)
        shades.append(np.median(block[valid],axis=0) if valid.any() else [30,42,88])
    shades=np.array(shades)
    for i,y in enumerate(rows):
        color=np.rint(np.median(shades[max(0,i-12):i+13],axis=0)).astype(int)
        extent=46 if y<535 else max(0,46*(590-y)/55)
        for x in range(int(outer[y]-extent),outer[y]+5):
            if im[y,x,3]==0:continue
            yield 'hair',x,int(y),(*map(int,color),255)
