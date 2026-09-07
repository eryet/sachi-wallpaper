"""Source-guided pixel ownership at the long locks and the upper collar.

The seam stays inside the original dark ink. Only labels change: the source
RGBA samples, including all partially transparent edge pixels, are untouched.
Coordinates refer to the 708 x 970 occupied artwork, not the full PNG.
"""
import numpy as np


# These guides were traced at 8x nearest-neighbour zoom. Snap each column to
# the darkest nearby source sample, with a distance penalty to avoid jumping
# from the collar outline into a neighbouring black hair strand.
COLLAR_GUIDE = [
    (55,777),(75,762),(100,745),(120,732),(130,726),(140,721),
    (150,716),(160,711),(170,706),(180,699),(190,692),(200,685),
    (215,675),(230,669),(250,661),(275,654),(300,650),(325,649),
    (350,649),(375,650),(400,654),(425,660),(445,663),(460,667),
    (475,673),(490,679),(505,686),(520,692),(535,698),(550,704),
    (565,712),(580,717),(600,722),(620,729),(635,733),
]


def collar_seam(im):
    width = im.shape[1]
    guide = np.interp(np.arange(width), *np.array(COLLAR_GUIDE).T)
    seam = np.rint(guide).astype(int)
    for x in range(COLLAR_GUIDE[0][0], COLLAR_GUIDE[-1][0] + 1):
        rows = np.arange(int(guide[x])-2, int(guide[x])+4)
        rgb = im[rows,x,:3].astype(float)
        darkness = rgb @ np.array([.25,.5,.25])
        cost = darkness + 7 * (rows-guide[x])**2 + (im[rows,x,3]<128)*100
        seam[x] = rows[np.argmin(cost)]
    return seam


def refine_hair_collar_masks(labels, im, indices):
    before = labels.copy()
    yy,xx = np.indices(labels.shape)
    seam = collar_seam(im)[None,:]
    top=seam.copy()
    for x in range(55,591):
        center=int(seam[0,x]);rows=np.arange(center-9,center+1)
        transparent=rows[im[rows,x,3]==0]
        if len(transparent):
            top[0,x]=int(transparent[-1])+1
        else:
            # At the neck use the actual start of the ink, keeping cyan skin
            # off the shirt. At hair contacts the split is inside shared ink.
            while top[0,x]>center-5 and np.mean(im[top[0,x]-1,x,:3])<50:
                top[0,x]-=1
    contact_left=(xx>=128)&(xx<=171)
    contact_right=(xx>=513)&(xx<=556)
    top=np.where(contact_left,seam-3,np.where(contact_right,seam-2,top))
    # Give the collar its entire top ink band; the broad selection polygons
    # previously left pieces attached to the neck, back hair and side lock.
    band = (xx>=55)&(xx<=590)&((yy>=top)|((yy>=seam-9)&(im[:,:,3]<10)))&(yy<=seam+13)
    labels[band] = indices['collar-back']
    skin=(xx>=190)&(xx<=445)&(yy>=seam-9)&(yy<top)&np.isin(labels,[indices['collar-back'],indices['coat-back'],indices['hair-back']])
    labels[skin]=indices['neck']
    # Preserve the hair-facing half of the ink at each actual contact. All
    # remaining source samples underneath belong to the same collar surface.
    left_inner=np.interp(np.arange(im.shape[0]),
        [590,600,620,650,675,680,690,695,700,705,710],
        [142,141,143,147,152,153,157,161,164,167,170])[:,None]
    left = (xx>=75)&(xx<left_inner)&(yy>=590)&(yy<seam-3)
    # The real alpha gap separates this lock from the cheek/neck. Keep the
    # first connected run in every row, including antialiasing and thin ink.
    for y in range(590,738):
        row = (im[y,:,3]>0)&left[y]
        starts = np.flatnonzero(row & ~np.r_[False,row[:-1]])
        if not len(starts):
            continue
        start = int(starts[0]);end=start
        while end<im.shape[1] and row[end]:
            end+=1
        labels[y,start:end] = indices['hair-side-left']
    # Join the narrow dark root edge to the same lock above the alpha gap.
    root = (xx>=75)&(xx<142)&(yy>=540)&(yy<590)&(im[:,:,0]<110)&np.isin(labels,[indices['hair-back'],indices['hair-side-left']])
    labels[root] = indices['hair-side-left']
    inner = np.interp(np.arange(im.shape[0]),
                      [625,635,650,660,670,675,680,685,690,695,700,705],
                      [468,475,487,494,502,506,510,514,519,526,540,551])[:,None]
    right = (xx>=inner-1)&(xx<=556)&(yy>=625)&(yy<seam-2)
    labels[right] = indices['hair-side-right']
    # The source bob ends well above here. These formerly unclaimed samples
    # are the distant collar rim, including its cyan and low-alpha edge pixels.
    # Leaving them in the default back-hair selection creates a floating sliver.
    collar_rim=(labels==indices['hair-back'])&(yy>=650)&(xx>=557)
    labels[collar_rim]=indices['collar-back']
    # Outside each lock the collar silhouette, including its faint alpha
    # fringe, belongs to cloth. It must never sway with the back hair.
    changed = (before!=labels)&(im[:,:,3]>0)
    return {'revision':'hair-collar-pixel-cuts-1',
            'reassignedSourcePixels':int(changed.sum()),
            'unchangedSourceRGBA':True}


def concealed_tip_samples(im, side):
    """Inferred hidden tips, continued from the source's own cross-section.

    These are separate, hidden-by-default vector fills, never replacements for
    visible source pixels. The collar occludes them in the animated rig.
    """
    seam=collar_seam(im)
    if side=='left':
        # The supplied head sheet (5397-886454838.png) shows a slender side
        # lock with an oblique taper, rather than a rounded leaf-shaped end.
        # Only the concealed shape changes; its diagonal source contact stays.
        rows=[700,715,725,739,754,766,777]
        left=[116,124,131,137,143,147,150]
        right=[164,169,167,160,154,151,150]
        sample_y,x0,x1=700,116,164
        # Follow the existing blue lighting along the diagonal contact. The
        # last true hair sample is x=165; x=166 already belongs to the neck.
        profile_x=np.arange(128,166)
        profile=im[seam[profile_x]-5,profile_x,:3].astype(float)
    else:
        rows=[680,700,720,735,750]
        left=[510,535,552,566,582];right=[542,552,568,578,582]
        sample_y,x0,x1=680,510,542
    for y in range(rows[0],rows[-1]):
        lo=float(np.interp(y,rows,left));hi=float(np.interp(y,rows,right))
        for x in range(int(np.floor(lo)),int(np.ceil(hi))):
            if y<seam[x]-5:
                continue
            u=np.clip((x+.5-lo)/max(1,hi-lo),0,1)
            if side=='left':
                # Keep the join's source shading, then carry the ink stripe
                # smoothly into the taper. Fractional sampling removes the
                # stair-step stripe caused by rounding each row independently.
                depth=max(0,y-seam[x]+4)
                blend=np.clip((depth-3)/22,0,1)
                blend=blend*blend*(3-2*blend)
                sx=(x-depth*.25)*(1-blend)+(128+u*37)*blend
                rgb=np.array([np.interp(sx,profile_x,profile[:,c]) for c in range(3)])
                edge=np.clip(min(x+.5-lo,hi-x-.5)/1.6,0,1)
                rgb=np.rint(rgb*edge+np.array([3,8,22])*(1-edge))
                color=(*map(int,rgb),255)
            else:
                color=tuple(int(v) for v in im[sample_y,min(x1-1,int(x0+u*(x1-x0)))])
            yield x,y,color
