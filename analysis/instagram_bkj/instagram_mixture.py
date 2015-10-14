import csv, itertools
from datetime import datetime
import numpy as np
import funcy as _
import matplotlib.pyplot as plt
import matplotlib as mpl

from sklearn import mixture
from scipy import linalg

# --
# Loading

data = []
with open('data/space_time.csv', 'rb') as f:
    reader = csv.DictReader(f)
    for r in reader:
        data.append(r)

# --
# Sub-sampling a little

x   = np.array([map(float, [x['loc.longitude'], x['loc.latitude'], x['time']]) for x in data])
# sel = np.random.choice(range(x.shape[0]), 100000)
# X   = x[sel]
lb = int(datetime.strptime('2015-04-10', '%Y-%m-%d').strftime('%s'))
ub = int(datetime.strptime('2015-04-11', '%Y-%m-%d').strftime('%s'))

X = x[x[:,2] < ub]
X = X[X[:,2] > lb]

# Trimming outliers
for i in range(3):
    X = X[X[:,i] > np.percentile(X[:,i], 2.5)]
    X = X[X[:,i] < np.percentile(X[:,i], 97.5)]

X_unscaled = X

# Centering
X = X - X.mean(0)
X = X / np.sqrt(X.var(0))

# --
# Wholesale from example

bics = []
for K in range(1, 20):
    gmm = mixture.GMM(n_components=K * 5, n_iter = 100, covariance_type='diag')
    gmm.fit(X)
    
    if not gmm.converged_:
        print 'not converged: ' + str(K)
        break
    
    print gmm.bic(X)
    bics.append(gmm.bic(X))

plt.scatter(range(len(bics)), bics)
plt.show()

# --
K   = 40
clf = mixture.GMM(n_components=K, n_iter = 100, covariance_type='diag')
clf.fit(X)

Y_ = clf.predict(X)
np.histogram(Y_, 1 + 20)

cmap   = plt.get_cmap('gnuplot')
colors = [cmap(i) for i in np.linspace(0, 1, K)]

for i, (mean, covar, color) in enumerate(zip(
        clf.means_, clf._get_covars(), colors)):
    # as the DP will not use every component it has access to
    # unless it needs it, we shouldn't plot the redundant
    # components.
    if not np.any(Y_ == i):
        continue
        
    # if i not in [11]:
    #     continue
    
    plt.subplot(2, 2, 1)
    plt.scatter(X[Y_ == i, 0], X[Y_ == i, 1], .8, color=color)
    
    plt.subplot(2, 2, 2)
    plt.scatter(X[Y_ == i, 2], X[Y_ == i, 1], .8, color=color)
    
    plt.subplot(2, 2, 3)
    plt.scatter(X[Y_ == i, 0], X[Y_ == i, 2], .8, color=color)

plt.show()

# Events close to the baseball stadium
ref = abs(X_unscaled[:,1] - 39.2839) + abs(X_unscaled[:,0] + 76.6217)

# Top 1000 tweets belong to 5 events
classes = [c for (a, c) in sorted(zip(ref, Y_), key = lambda x: x[0])]
vals    = _.distinct(classes[:1000])

times = [c for (a, c) in sorted(zip(ref, X_unscaled[:,2]), key = lambda x: x[0])]
day   = [datetime.fromtimestamp(int(x)).strftime('%m-%d') for x in times[:1000]]

l      = zip(classes, day)
counts = sorted([(x, l.count(x)) for x in _.distinct(l)], key = lambda x: x[1])
pprint(counts)


# --

clf = mixture.DPGMM(n_components = 40, 
    alpha = 1,
    covariance_type = 'diag',
    n_iter=1000)

clf.fit(X)
clf.converged_
Y_ = clf.predict(X)
np.histogram(Y_)

colors = ['r', 'g', 'b', 'c', 'm']
color_iter = itertools.cycle(colors)

i = 1
(clf, title) = (dpgmm, 'Dirichlet Process GMM')
for i, (mean, covar, color) in enumerate(zip(
        clf.means_, clf._get_covars(), color_iter)):
    # as the DP will not use every component it has access to
    # unless it needs it, we shouldn't plot the redundant
    # components.
    if not np.any(Y_ == i):
        continue
    plt.scatter(X[Y_ == i, 0], X[Y_ == i, 1], .8, color=color)
        
plt.show()
