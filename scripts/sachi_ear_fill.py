"""Continue the visible ear under the front lock without a vertical cut line."""
import numpy as np


EAR_SHAPE=('M550 357 C532 363 521 373 514 390 '
           'C507 410 503 433 501 452 C498 474 507 491 521 495 '
           'Q530 497 543 486 L578 453 L584 399 L573 368 Z')


def refine_ear_edge(labels, im, indices, outer):
    """Move the hair outline's dark antialiasing off the ear's flat surfaces.

    Compare against the same row inside the ear. Where a real inner fold
    touches the cut, the reference is also dark and the ear ink stays in place.
    """
    changed=0
    yy,xx=np.indices(labels.shape)
    top=np.interp(xx,[532,538,544,550],[370,366,361,357])
    above=(xx>=530)&(xx<=550)&(yy>=350)&(yy<top-2)&(labels==indices['ear-right'])
    labels[above]=indices['hair-back'];changed+=int(above.sum())
    for y in range(367,492):
        edge=int(outer[y])
        reference=np.median(im[y,edge+3:edge+7,:3].astype(float),axis=0)
        for x in range(edge+1,edge+4):
            if labels[y,x] not in [indices['ear-right'],indices['ear-inner']]:break
            difference=reference-im[y,x,:3].astype(float)
            dark_fringe=difference.min()>=6 and difference.mean()>=14
            bright_fringe=difference.max()<=-2 and difference.mean()<=-5
            if not (dark_fringe or bright_fringe):break
            labels[y,x]=indices['hair-side-right'];changed+=1
    return {'reassignedEdgePixels':changed,'unchangedSourceRGBA':True}


def ear_samples(im, labels, indices, outer):
    """Transport adjacent ear colours along its drawn folds beneath the bang.

    Sampling follows the slanted inner ridges and lower illuminated rim rather
    than averaging a horizontal row of skin, ink and cyan into a striped fill.
    """
    known=np.isin(labels,[indices['ear-right'],indices['ear-inner']])
    yy,xx=np.indices(known.shape)
    known&=(im[:,:,3]==255)&(xx>=outer[:,None]+3)&(xx<580)&(yy>=366)&(yy<493)
    coordinates=np.column_stack(np.nonzero(known))
    for y in range(354,501):
        # The upper ridges slope up to the right; the lobe's shadow slopes
        # down to the right. Blend between them inside the broad flat areas.
        slope=np.interp(y,[354,424,435,451,471,489,501],[-.55,-.55,-.45,.48,.48,-.2,-.2])
        for x in range(495,int(outer[y])+5):
            colour=None
            for step in range(0,65):
                sx=x+step;sy=y+step*slope;iy=int(np.floor(sy));f=sy-iy
                if known[iy,sx] and known[iy+1,sx]:
                    colour=im[iy,sx,:3]*(1-f)+im[iy+1,sx,:3]*f;break
            if colour is None:
                distance=(coordinates[:,0]-y)**2+(coordinates[:,1]-x)**2
                sy,sx=coordinates[np.argmin(distance)];colour=im[sy,sx,:3]
            yield x,y,tuple(np.rint(colour).astype(int))
