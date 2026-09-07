"""Separate the screen-left lock from the face along the source's ink contour."""
import numpy as np


# The skin-facing edge of the ink, observed on the source at native pixels.
# Local colour gradients locate its antialiasing transition in each row.
LEFT_FACE_GUIDE=[
    (240,86),(245,85),(265,82),(280,81),(300,83),(320,85),
    (340,87),(360,90),(380,94),(400,95),(420,94),(440,90),
    (460,88),(480,88),(500,93),(520,101),(540,115),(550,123),
    (570,140),(580,151),(590,165),(610,188),(630,210),(640,241),
]


def left_face_contour(im):
    contour=np.zeros(im.shape[0],dtype=int)
    rows=np.arange(240,641)
    guide=np.interp(rows,*np.array(LEFT_FACE_GUIDE).T)
    for y,expected in zip(rows,guide):
        columns=np.arange(round(expected)-4,round(expected)+5)
        rgb=im[y,:,:3].astype(float)
        gradient=(rgb[columns]-rgb[columns-1])@np.array([1,.2,.25])
        # A gentle distance penalty keeps this on the face edge rather than
        # jumping to an eyelash, brow or an adjacent thin fringe strand.
        edge=columns[np.argmax(gradient-2*(columns-expected)**2)]
        contour[y]=edge-1
    contour[641:]=241
    return contour


def refine_left_face_cut(labels,im,indices):
    before=labels.copy();yy,xx=np.indices(labels.shape)
    contour=left_face_contour(im)[:,None]
    junction=(yy>=240)&(yy<580)&(xx>=55)&(xx<=contour+20)
    # The broad lock polygon carried this strip of skin with the hair. Return
    # it to the face, including the dark antialiasing on the face side of ink.
    carried=junction&(xx>=contour)&np.isin(labels,[indices['hair-side-left'],indices['hair-back']])
    labels[carried]=indices['face']
    # An earlier dark-fringe heuristic also included shaded lavender skin at
    # the temple. Preserve the real narrow fringe ink while returning its
    # neighbouring skin samples to the stationary face surface.
    rgb=im[:,:,:3].astype(float)
    shaded_skin=(rgb[:,:,0]>=60)&(rgb[:,:,0]>.43*rgb[:,:,2])&(rgb[:,:,2]>=130)
    temple=junction&(yy<300)&(xx>=contour)&(xx<=92)&shaded_skin&(labels==indices['hair-fringe-left'])
    labels[temple]=indices['face']
    # Conversely, the face selection held part of the long lock's dark edge.
    # Rejoin that edge to its hair mesh, leaving the face's own outline intact.
    edge=junction&(yy>=285)&(xx<contour)&(labels==indices['face'])
    labels[edge]=indices['hair-side-left']
    changed=(before!=labels)&(im[:,:,3]>0)
    return {'revision':'left-hair-face-cut-1','reassignedSourcePixels':int(changed.sum()),
            'unchangedSourceRGBA':True}
