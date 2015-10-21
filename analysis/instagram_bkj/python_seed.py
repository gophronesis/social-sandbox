'''
$SPARK_HOME/bin/pyspark --master "local[5]" --driver-memory 6G --executor-memory 6G
'''

from time import time
import numpy as np
import pandas as pd
from geopy.distance import vincenty
from scipy.spatial import cKDTree
import scipy.spatial.distance as distance
from collections import deque
import sys
sys.setrecursionlimit(5000)

# from multiprocessing import Pool
# pool = Pool(5)

x = pd.read_csv('/Users/BenJohnson/projects/social-sandbox/scratch/x.csv')

# --
def latlon2meters(p1, N_METERS = 100.0):
    STEP = .00001
    DIST = STEP * N_METERS / (vincenty(p1[['lon', 'lat']], p1[['lon', 'lat']] + STEP).meters)
    return DIST

params = {
    'N_SECONDS' : 30 * 60,
    'N_METERS'  : latlon2meters(x.iloc[0][['lat', 'lon']])
}


# def img_filter(cand, targ):
#     try:
#         tvec = imgs[targ[0]].value
        
#         for c in cand:
#             try:
#                 cvec = imgs[c[0]].value
#                 c.append(cosine(tvec, cvec))
#             except:
#                 c.append(None)
#     except:
#         pass
    
#     return cand


def geo_filter(cands, targ, dist):
    return filter(lambda x: dist >= distance.euclidean(targ[2:4], x[2:4]), cands)


def f(z, dist):
    cands = deque()
    for targ in z:
        cands.append(list(targ))
        
        d = targ[1] - cands[0][1]
        
        while d > dist:
            try:
                cands.popleft()
            except:
                pass
            
            d = targ[1] - cands[0][1]
        
        # yield (targ[0], map(lambda x: x[0], list(cands)))
        # yield (targ[0], [x[0] for x in cands])
        # Streaming: 
        yield geo_filter(list(cands), targ, params['N_METERS'])


x   = x.sort('time')
t   = time()
z   = np.array(x[['id', 'time', 'lat', 'lon']])[0:10000]
close_in_time = list(f(z, params['N_SECONDS']))
time() - t

x   = x.sort('lat')
t   = time()
z   = np.array(x[['id', 'lat']])[0:10000]
close_in_time = list(f(z, params['N_METERS']))
time() - t



df = pd.DataFrame(close_in_time)

x1 = df.head()[[2, 3]]
x2 = df.head()[[6, 7]]

distance.euclidean()


# --

import dask.bag as db

t = time()
d = db.from_sequence(close_in_time, npartitions = 10)
close_in_space = d.filter(lambda x: dist >= distance.euclidean(targ[2:4], x[2:4])).compute()
time() - t




# --






t = time()

def mfun(z):
    return geo_filter(z[:-1], z[-1], params['N_METERS'])


tmp2 = pool.map(mfun, tmp[0:2000])



import h5py
imgs = h5py.File('/Users/BenJohnson/projects/social-sandbox/images/baltimore_features.h5', 'r')


import numpy as np




# --




close['time'] = list(
    close_sort( list(x['time']), params['N_SECONDS'] )
)



y   = close['time'][1000]
ids = x['id']


pool.map(lambda y: y, list(close['time'][1:1000]))


x = x.sort_values('lat')
tmp2 = []
for a in close_sort(list(x['lat']), params['DIST'], list(x['id'])):
    tmp2.append(a)

x = x.sort('lon')
close['lon'] = list(close_sort(list(x['lon']), params['DIST']))

map(len, close.values())


# def make_time_pairs(res_time):
#     pairs = []
#     for i in range(len(res_time)):
#         for j in range(int(res_time[i]), i):
#             pairs.append((i, j))
#     return pairs

# res_time   = close_in_time(x.time)
# time_pairs = make_time_pairs(res_time)


def fast_dist(i, dist = DIST, CHUNKSIZE = 10000):
    print i
    low  = CHUNKSIZE * (i - 1)
    mid  = CHUNKSIZE * (i)
    high = CHUNKSIZE * (i + 1)
    
    sel = np.arange(low, high)
    kd  = cKDTree(x.iloc[sel][['lat', 'lon']], leafsize = 500)
    ps  = list(kd.query_pairs(DIST))
    ps  = map(lambda x: (x[0] + low, x[1] + low), ps)
    return ps



all_ps = pool.map(fast_dist, range(1, 10))
all_ps = reduce(lambda a, b: a + b, all_ps)
all_ps = fnc.distinct(all_ps)






df = pd.DataFrame(all_ps)

