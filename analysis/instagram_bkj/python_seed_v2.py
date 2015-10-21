import h5py
from time import time
import numpy as np
import pandas as pd
import dask.bag as db
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

# # This is more accurate, but horribly slow
# def close_in_space(p, dist):
#     sel = np.arange(p[1], p[0] + 1)
#     tmp = f[sel]
#     v1  = tmp[-1]
#     return ids[sel[np.array(map(lambda v: vincenty(v, v1).meters <= dist, tmp))]]



def smartget(f, i):
    try:
        return f[i].value
    except:
        return None


def _img_sim(vec, tvec):
    try:
        return 1 - sc_dist.cosine(vec, tvec)
    except:
        return None


def img_sim(z):
    cand = z[:-1]
    targ = z[-1]
    tvec = smartget(imgs, targ)
    if type(tvec) != type(None):
        cvec = map(lambda x: smartget(imgs, x), cand)
        return (targ, zip(cand, map(lambda x: _img_sim(x, tvec), cvec)))
    else:
        return(targ, [])

# --

imgs = h5py.File('/Users/BenJohnson/projects/social-sandbox/images/baltimore_features.h5', 'r')

x   = pd.read_csv('/Users/BenJohnson/projects/social-sandbox/scratch/x.csv')
x   = x.sort('time')
ids = np.array(x['id'])

f    = np.array(x[['lat', 'lon']])
frad = f * np.pi / 180

DIST  = 100

T    = time()

# Close in time (can't parallelize)
# Same as in R
t   = time()
cit = list(close_sort(list(x['time']), 30 * 60))
time() - t

# Close in space (not work parallelize)
t   = time()
cis = map(lambda x: close_in_space(x, DIST), cit)
cis = map(list, cis)
time() - t

pd.Series(map(lambda x: len(x), cis)).value_counts()
sum(map(lambda x: len(x) == 1, cis))

# --
# from multiprocessing import Pool
# pool = Pool(8)

# tmp = []
# for i in range(20):
#     print i
#     start = i * 100000
#     stop  = (i + 1) * 100000
    
#     t    = time()
#     tmp += pool.map(img_sim, cis[start:stop])
#     time() - t

# --

# Images
cis_ = db.from_sequence(cis)
lfin = cis_.map(img_sim).compute()
print 'total time :: %f' % (time() - T)

lfin

# Adjacency matrix
adj = db.from_sequence(lfin)\
    .map(lambda x: [(x[0], y[0], y[1]) for y in x[1]])\
    .fold(lambda a, b: a + b)\
    .compute()

adj_ = pd.DataFrame(adj, columns = ('source', 'target', 'sim'))
adj_.to_csv('../scratch/adj_.csv')


# Connected components
nt_nodes = filter(lambda x: len(x[1]) > 0, lfin)

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

sorted(map(len, cluster_to_id.values()))
pd.Series(id_to_cluster.values()).value_counts()

# df = pd.DataFrame([{"id" : nt_nodes[0][0], "cluster" : 0}])
# i = 0
# for l in lfin:
#     if len(l[1]) > 0:
#         source  = l[0]
#         targets = [t[0] for t in l[1]]
#         sel     = ( df['id'] == np.array(targets) )
#         if sum(sel) > 0:
#             print df[sel]['cluster']
#             break
#         else:
#             df.append({'id' : source, 'cluster' : i})
#     else:
#         df.append({'id' : source, 'cluster' : i})
    
#     i += 1

