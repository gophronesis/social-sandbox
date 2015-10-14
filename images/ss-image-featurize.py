# Run:
# find images | xargs file | grep ASCII | sed "s/:.*//" | xargs -I {} rm {}
# in baltimore_images or else you might have errors for deleted picutes

import os, sys, itertools, zipfile
import numpy as np
import pandas as pd
from PIL import Image

# Utility for chunkign
def chunks(l, n):
    n = max(1, n)
    return [l[i:i + n] for i in range(0, len(l), n)]


CAFFE_ROOT = '/Users/BenJohnson/projects/software/caffe/'
sys.path.insert(0, CAFFE_ROOT + 'python')
import caffe

sys.path.append('/Users/BenJohnson/projects/caffe_featurize')
from caffe_featurizer import CaffeFeaturizer
cf = CaffeFeaturizer(CAFFE_ROOT)

# --
# User defined

def get_files():
    image_pth  = '/Users/BenJohnson/data/images/baltimore/images/'
    return [image_pth + x for x in os.listdir(image_pth)]

# --

files = get_files()

out        = None
CHUNK_SIZE = 250

outfile = open('baltimore_features.csv', 'ab')

counter = 0
all_chunks = chunks(files, CHUNK_SIZE)
for chunk in all_chunks:
    print 'chunk :: %d' % counter
    
    cf.set_batch_size(len(chunk))
    
    # cf.set_files(files_sub)
    cf.set_files(itertools.chain(chunk))
    
    cf.load_files()
    cf.forward()
    
    feats = pd.DataFrame(cf.featurize())
    feats['id'] = chunk
    feats = feats.drop(cf.errs)
    
    print 'saving...'
    # Should really be saving in a sparse format
    feats.to_csv(outfile, sep = '\t', fmt='%s', index = False, header = False)
    
    counter += 1

outfile.close()
