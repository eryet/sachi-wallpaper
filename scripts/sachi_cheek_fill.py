"""Continue cheek shading and the neck's angled light bands behind the strand."""
import numpy as np
from PIL import Image, ImageFilter

BOX=(300,410,462,665)


def refine_cheek_edges(labels,im,indices,inner,outer):
    """Keep dark antialiasing with the moving strand, not the exposed skin."""
    field,_=cheek_neck_field(im,labels,indices)
    count=0
    for y in range(435,643):
        for edge,direction in [(int(inner[y]),-1),(int(outer[y]),1)]:
            columns=edge+direction*np.arange(4,10)
            colors=im[y,columns,:3].astype(float)
            valid=np.isin(labels[y,columns],[indices['face'],indices['neck']])&(colors[:,0]>70)&(colors[:,2]>100)
            reference=field[y,edge+direction*2].astype(float)
            if valid.any():reference=np.maximum(reference,np.median(colors[valid],axis=0))
            for step in range(1,5):
                x=edge+direction*step
                if labels[y,x] not in [indices['face'],indices['neck']]:break
                difference=reference-im[y,x,:3].astype(float)
                if difference.min()<=5 or difference.mean()<=12:break
                labels[y,x]=indices['hair-face-strand'];count+=int(im[y,x,3]>0)
    return {'reassignedEdgePixels':count,'unchangedSourceRGBA':True}


def cheek_neck_field(im,labels,indices):
    yy,xx=np.indices(labels.shape)
    known=np.isin(labels,[indices['face'],indices['neck']])&(im[:,:,3]>250)
    # Remove the strand's antialiased ink from both sides of the colour samples.
    known&=(im[:,:,0]>70)&(im[:,:,2]>100)
    known=np.array(Image.fromarray((known*255).astype('uint8')).filter(ImageFilter.MinFilter(3)))>0
    left,top,right,bottom=BOX
    y,x=np.mgrid[top:bottom,left:right]
    # The source neck has a sloping upper glow, a shallow lower band edge,
    # and a steeper triangular shadow. Transport colour along each edge,
    # rather than smearing lavender vertically into the illuminated neck.
    band_bottom=709-.295*x
    shadow_bottom=999-.975*x
    slope=np.where(y<band_bottom-10,-.67,np.where(y<(band_bottom+shadow_bottom)/2,-.295,-.975))
    samples=[];distances=[]
    for direction in [-1,1]:
        colors=np.zeros((*x.shape,3),dtype=float);distance=np.full(x.shape,1000.)
        for step in range(1,100):
            sx=x+direction*step;sy=y+direction*step*slope
            iy=np.floor(sy).astype(int);fraction=sy-iy
            safe=(sx>=0)&(sx<im.shape[1])&(iy>=0)&(iy<im.shape[0]-1)
            sx=np.clip(sx,0,im.shape[1]-1);iy=np.clip(iy,0,im.shape[0]-2)
            valid=safe&known[iy,sx]&known[iy+1,sx]&(distance==1000)
            colors[valid]=im[iy[valid],sx[valid],:3]*(1-fraction[valid,None])+im[iy[valid]+1,sx[valid],:3]*fraction[valid,None]
            distance[valid]=step
        samples.append(colors);distances.append(distance)
    d0,d1=distances
    mix=d0/(d0+d1)
    colors=samples[0]*(1-mix[:,:,None])+samples[1]*mix[:,:,None]
    colors[d0==1000]=samples[1][d0==1000]
    colors[d1==1000]=samples[0][d1==1000]
    unresolved=(d0==1000)&(d1==1000)
    # At the very bottom, both rays can leave the visible neck. Use its nearest
    # clean source sample there, rather than introducing an unrelated flat fill.
    coordinates=np.column_stack(np.nonzero(known&(yy>=390)&(yy<685)&(xx>=280)&(xx<475)))
    for row,column in np.argwhere(unresolved):
        target=np.array([row+top,column+left])
        sy,sx=coordinates[np.argmin(np.sum((coordinates-target)**2,axis=1))]
        colors[row,column]=im[sy,sx,:3]
    # Source pixels which already belong to skin retain their exact colour.
    valid=known[top:bottom,left:right]
    colors[valid]=im[top:bottom,left:right,:3][valid]
    field=im[:,:,:3].copy();field[top:bottom,left:right]=np.rint(np.clip(colors,0,255)).astype('uint8')
    return field,{'box':list(BOX),'interpolatedPixels':int((~valid).sum()),'nearestSampleFallbackPixels':int(unresolved.sum()),'method':'edge-aligned source colour interpolation'}
