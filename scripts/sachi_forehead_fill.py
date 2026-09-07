"""Source-matched vector underpainting for the moving top fringe.

The forehead uses a robust smooth surface fitted to clean skin. The crown uses
normalized local colour samples, excluding outline ink and the face, so the
highlight band continues behind the separated bangs.
"""
import numpy as np
from PIL import Image, ImageFilter


def skin_basis(x,y):
    x=(x-260)/200;y=(y-240)/150
    return np.stack([np.ones_like(x),x,y,x*x,x*y,y*y],axis=-1)


def forehead_field(im,labels,indices):
    yy,xx=np.indices(labels.shape);rgb=im[:,:,:3].astype(float)
    clean=(labels==indices['face'])&(im[:,:,3]>250)&(yy>=120)&(yy<=335)&(xx>=80)&(xx<=445)
    clean&=(rgb[:,:,0]>70)&(rgb[:,:,0]>.50*rgb[:,:,2])&(rgb[:,:,0]<.78*rgb[:,:,2])
    # Remove antialiasing beside lashes, brows, and the hair outline.
    inside=clean.copy()
    for offset in range(1,5):
        for axis in [0,1]:inside&=np.roll(clean,offset,axis)&np.roll(clean,-offset,axis)
    holdout=inside&((xx+2*yy)%7==0)
    training=inside&~holdout
    coordinates=skin_basis(xx[training],yy[training]);colors=rgb[training]
    keep=np.ones(len(colors),dtype=bool)
    for _ in range(4):
        fit=np.linalg.lstsq(coordinates[keep],colors[keep],rcond=None)[0]
        errors=np.linalg.norm(coordinates@fit-colors,axis=1)
        keep=errors<=np.quantile(errors,.90)
    field=np.clip(skin_basis(xx,yy)@fit,0,255)
    error=np.abs(field[holdout]-rgb[holdout])
    report={'cleanSkinSamples':int(inside.sum()),'holdoutSamples':int(holdout.sum()),
            'holdoutMeanChannelError':round(float(error.mean()),3),
            'holdout95PercentChannelError':round(float(np.quantile(error,.95)),3)}
    return np.rint(field).astype(np.uint8),report,holdout


def crown_field(im,labels,indices):
    rgb=im[:260,:,:3];r,g,b=rgb.astype(float).transpose(2,0,1)
    hair_ids=[value for name,value in indices.items() if name.startswith('hair-') and name!='hair-clip']
    valid=np.isin(labels[:260],hair_ids)&(im[:260,:,3]>250)&(r>12)&(g>18)&(b>45)&(r<.67*b)&(g<155)
    samples=np.zeros((*valid.shape,4),dtype=np.uint8)
    samples[:,:,:3]=np.where(valid[:,:,None],rgb,0);samples[:,:,3]=valid*255
    image=Image.fromarray(samples)
    field=np.zeros_like(rgb,dtype=float);filled=np.zeros(valid.shape,dtype=bool)
    for radius in [3,10,25,60]:
        blurred=np.array(image.filter(ImageFilter.GaussianBlur(radius))).astype(float)
        alpha=blurred[:,:,3];available=(alpha>=8)&~filled
        field[available]=blurred[available,:3]*255/alpha[available,None]
        filled|=available
    field[~filled]=[29,42,87]
    # Keep known clean colour transitions (especially the highlight band)
    # exact; interpolate only near removed ink and genuinely hidden areas.
    interior=valid.copy()
    for offset in [1,2]:
        for axis in [0,1]:interior&=np.roll(valid,offset,axis)&np.roll(valid,-offset,axis)
    field[interior]=rgb[interior]
    return np.rint(np.clip(field,0,255)).astype(np.uint8)


def row_regions(field,box):
    """Merge equal RGB samples into horizontal vector runs."""
    left,top,right,bottom=box
    for y in range(top,bottom):
        row=field[y,left:right]
        edges=np.r_[0,np.flatnonzero(np.any(row[1:]!=row[:-1],axis=1))+1,right-left]
        for start,end in zip(edges[:-1],edges[1:]):
            yield left+int(start),y,int(end-start),tuple(map(int,row[start]))
