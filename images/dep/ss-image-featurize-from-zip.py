# Run:
#  find . -type f -not -name "*.jpg" -print | xargs file | grep ASCII | sed "s/:.*//" | xargs -I {} rm {}
# in baltimore_images or else you might have errors for deleted picutes

import zipfile
import os, sys
import numpy as np
from PIL import Image

CAFFE_ROOT = '/Users/BenJohnson/projects/software/caffe/'
sys.path.insert(0, CAFFE_ROOT + 'python')
import caffe

sys.path.append('/Users/BenJohnson/projects/caffe_featurize')
from caffe_featurizer import CaffeFeaturizer
cf = CaffeFeaturizer(CAFFE_ROOT)

# --

def show_zipped_image(z, path):
    Image.open(z.open(path)).show()

def get_files():
    image_zip = '/Users/BenJohnson/data/images/baltimore.zip'
    z         = zipfile.ZipFile(image_zip)
    files     = filter(lambda x: 'jpg' in x, z.namelist())
    return files, z

def files_gen(z, files_sub):
    for f in files_sub:
        print f
        yield z.open(f)

# def get_files():
#     files      = [image_root + f for f in os.listdir(image_root)]
#     files      = filter(lambda x: 'jpg' not in x, files)
#     return files

# --
 
files, z = get_files()
files    = np.random.choice(files, len(files), replace = False)

files_sub = filter(lambda x: 
    '971262539333699605_40042113' in x or
    '971269168529894116_1642520217' in x or
    '971270075356285464_508376281' in x, 
files)

out        = None
CHUNK_SIZE = 250

# Getting rid of the ones that are already done
# os.remove('baltimore_features.csv')
done = []
with open('baltimore_features.csv', 'rb') as f:
    for l in f.readlines():
         done.append(l.split(',')[0])

files = list(set(files).difference(set(done)))

outfile = open('baltimore_features.csv', 'ab')

for i in xrange(0, len(files)):
    print '\n\n------' + str(i)
    if i * CHUNK_SIZE > len(files):
        break
    
    files_sub = files[(i * CHUNK_SIZE) : ((i+1) * CHUNK_SIZE)]
    
    cf.set_batch_size(len(files_sub))
    
    # cf.set_files(files_sub)
    cf.set_files(files_gen(z, files_sub))
    
    cf.load_files()
    cf.forward()
    
    feats = cf.featurize()
    tmp   = np.hstack((np.array([[f] for f in files_sub]), feats))
    
    print 'saving...'
    # Should really be saving in a sparse format
    np.savetxt(outfile, tmp, delimiter=',',fmt='%s')


outfile.close()


# --

import re

def row_id(x):
    return re.sub('baltimore/|\\.jpg', '', x.split(',')[0])

with open('baltimore_features.csv', 'rb') as f:
    for x in f:
        mid = row_id(x)
        with open('/Users/BenJohnson/data/images/baltimore/features/' + mid, 'wb') as g:
            g.write(x)
