"""Separate the screen-right eyebrow from the fringe covering its upper edge."""
import numpy as np
from PIL import Image, ImageDraw


UPPER=[(299,263),(317,258),(335,254),(348,249),(355,249),(369,254),
       (386,263),(403,272),(420,282),(435,293),(439,300)]
LOWER=[(299,265),(315,265),(332,266),(351,269),(369,273),(386,277),
       (403,283),(417,290),(430,297),(439,302)]
# These narrow fringe tips cross in front of the eyebrow in the source.
CONTACTS=[[(338,238),(350,238),(352,267),(347,265),(341,261)],
          [(385,246),(397,246),(400,275),(394,271),(388,266)]]


def refine_right_brow(labels, im, indices):
    yy,xx=np.indices(labels.shape)
    top=np.interp(xx, *np.array(UPPER).T)
    bottom=np.interp(xx, *np.array(LOWER).T)
    shape=(xx>=298)&(xx<=439)&(yy>=top-2)&(yy<=bottom+2)
    # Recover the antialiased lower outline as well as the solid ink. Keep
    # actual blue/cyan hair highlights with the foreground locks.
    r,g,b=im[:,:,:3].astype(float).transpose(2,0,1)
    # Blue antialiasing along the brow is still brow ink. Only the bright
    # outer hair highlight is excluded here; the crossing tips are cut below.
    hair_colour=(xx>=420)&(g>90)&(r<.72*b)&(yy<(top+bottom)/2)
    brow=shape&~hair_colour
    labels[brow]=indices['brow-right']
    wrong=(labels==indices['brow-right'])&~brow
    labels[wrong&~hair_colour]=indices['face']
    labels[wrong&hair_colour]=indices['hair-fringe-right']
    labels[wrong&hair_colour&(xx<353)]=indices['hair-fringe-center']
    contact=Image.new('L',(im.shape[1],im.shape[0]));draw=ImageDraw.Draw(contact)
    for polygon in CONTACTS:draw.polygon(polygon,fill=255)
    front=shape&(np.array(contact)>0)
    labels[front&(xx<353)]=indices['hair-fringe-center']
    labels[front&(xx>=353)]=indices['hair-fringe-right']


# Complete the brow beneath the crossing locks. The fill is hidden at rest;
# its parent supplies the facial expression transform, never the hair wind.
CONCEALED_BROW='M300 264 Q322 258 348 252 C362 246 402 272 438 300 C404 279 375 269 349 266 Q325 261 300 264 Z'


def refine_left_brow(labels, im, indices):
    """Return the narrow overlapping fringe to its own wind mesh."""
    yy,xx=np.indices(labels.shape)
    # The lock crosses the inner eyebrow at (94, 286), tapering to (96, 296).
    # Keep the diagonal brow stroke below the crossing on the face.
    center=np.interp(yy,[250,265,275,282,287,294,296],[93,94,94,94,95,96,96])
    radius=np.interp(yy,[250,278,284,296],[3,2,1,1])
    region=(yy>=250)&(yy<=296)&(np.abs(xx-center)<=radius)
    strand=(im[:,:,0]<110)&(im[:,:,1]<120)&(im[:,:,2]<192)
    labels[region&strand&(labels==indices['brow-left'])]=indices['hair-fringe-left']
