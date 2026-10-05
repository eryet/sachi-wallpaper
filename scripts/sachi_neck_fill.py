"""Continue the visible neck shading across its concealed animation joins.

The face/neck cut crosses the dark chin shadow, so a generic blue skin fill
shows up as a bright line when the two surfaces move apart. Copy the actual
source colours over that join and extend the last neck sample under the collar.
The caller clips these samples to the existing hidden neck silhouette.
"""
import numpy as np


def neck_join_samples(im, labels, indices):
    known = np.isin(labels, [indices['face'], indices['neck']]) & (im[:, :, 3] > 250)
    for x in range(154, 458):
        rows = np.flatnonzero(known[580:690, x]) + 580
        if not len(rows):
            continue
        bottom = int(rows[-1])
        # The last row contains the collar ink's antialiasing, which alternates
        # with the staircase of the cut. Extending that row makes vertical dark
        # ticks. Sample inside the neck instead, above the antialiased edge.
        interior = rows[rows <= bottom - 4]
        continuation = int(interior[-1]) if len(interior) else bottom
        # Keep the cut-out strand's reconstructed skin from cheek_neck_field.
        # Only exact face/neck samples may replace the existing fill above it.
        for y in range(610, bottom + 25):
            if y <= bottom and not known[y, x]:
                continue
            color = tuple(int(v) for v in im[y if y <= bottom else continuation, x, :3])
            yield x, y, color
