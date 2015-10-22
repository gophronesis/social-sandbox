import h5py
import funcy as fnc
import numpy as np
import pandas as pd
import dask.bag as db
from pprint import pprint
from time import time
from scipy.spatial import distance as sc_dist


def latlon2meters(p1, N_METERS = 100.0):
    STEP = .00001
    DIST = STEP * N_METERS / (vincenty(p1[['lon', 'lat']], p1[['lon', 'lat']] + STEP).meters)
    return DIST


def close_sort(x, dist):
    length = len(x)
    lead   = 0
    follow = 0
    out    = []
    while lead < length:
        d = x[lead] - x[follow]
        if d > dist:
            follow += 1
        else:
            yield (lead, follow)
            lead += 1


def close_in_space(p, dist):
    sel = np.arange(p[1], p[0] + 1)
    
    # Vectorized version of great_circle distance
    tmp = frad[sel]
    ds  = np.vstack([tmp[-1,0] - tmp[:,0], tmp[-1,1] - tmp[:,1]]).T
    a   = np.sin(ds[:,0]) ** 2 + np.cos(tmp[-1, 0]) * np.cos(tmp[:, 0]) * (np.sin(ds[:,1]) ** 2)
    d   = 6372794 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    
    return ids[sel[d <= dist]]

def smartget(h, i):
    try:
        return h[i].value
    except:
        return None


def _img_sim(vec, tvec):
    try:
        return 1 - sc_dist.cosine(vec, tvec)
    except:
        return None


def img_sim(imgs, z):
    cand = z[:-1]
    targ = z[-1]
    tvec = imgs.get(targ, None)
    if type(tvec) != type(None):
        cvec = map(lambda x: imgs.get(x), cand)
        return (targ, zip(cand, map(lambda x: _img_sim(x, tvec), cvec)))
    else:
        return(targ, [])

# --

config = {
    'TIME' : 30 * 60,
    'DIST' : 100    
}

x    = pd.read_csv('/Users/BenJohnson/projects/social-sandbox/scratch/x.csv').sort('time')
imgs = h5py.File('/Users/BenJohnson/projects/social-sandbox/images/baltimore_features.h5', 'r')

ids  = np.array(x['id'])
frad = np.array(x[['lat', 'lon']]) * np.pi / 180


# Close in time (can't parallelize)
# Same as in R (1 sec)
cit = list(close_sort(list(x['time']), config['TIME']))

# Close in space (haven't parallelized)
# Same as in R (25 secs)
cis = map(lambda x: list(close_in_space(x, config['DIST'])), cit)


# Close in image space
# Good enough for now

ncis       = np.array(cis)
length     = len(ncis)
CHUNK_SIZE = 50000
lfin       = []

# TODO -- parallel reads on HDF5
for i in range(200):
    print i
    t = time()
    
    sel     = np.arange(i * CHUNK_SIZE, min(length, (i + 1) * CHUNK_SIZE))
    cis_sub = ncis[sel]
    print 'starting ::: %f' % (time() - t)
    
    if len(cis_sub) > 0:
        uids  = fnc.distinct(fnc.flatten(cis_sub))
        chunk = dict(map(lambda i: (i, smartget(imgs, i)), uids))
        print 'loading ::: %f' % (time() - t)
            
        cis_sub_ = db.from_sequence(cis_sub)
        lfin += cis_sub_.map(lambda x: img_sim(chunk, x)).compute()
        
    print 'total ::: %f' % (time() - t)

# --
# Output
adj = db.from_sequence(lfin)\
    .map(lambda x: [(x[0], y[0], y[1]) for y in x[1]])\
    .fold(lambda a, b: a + b)\
    .compute()

adj_df= pd.DataFrame(adj, columns = ('source', 'target', 'sim'))
adj_df.to_csv('scratch/adj_.csv')

# --
# Connected components


def cc(lfin):
    nt_nodes      = filter(lambda x: len(x[1]) > 0, lfin)
    new_c         = 1
    id_to_cluster = {}
    cluster_to_id = {}
    for n in nt_nodes:
        source  = n[0]
        targets = [t[0] for t in n[1]]
        
        id_to_cluster[source] = new_c
        cluster_to_id[new_c]  = [source]
        
        neib_clusters = set()
        for t in targets:
            c = id_to_cluster.get(t)
            if c:
                neib_clusters.update([c])
        
        for c in neib_clusters:
            for neib in cluster_to_id[c]:
                id_to_cluster[neib]  = new_c
            cluster_to_id[new_c] += cluster_to_id[c]
            del cluster_to_id[c]
            
        new_c += 1
    
    return {
        'id_to_cluster' : id_to_cluster, 
        'cluster_to_id' : cluster_to_id
    }
