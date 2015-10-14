import os, sys, scipy

from skimage import io
from elasticsearch import Elasticsearch
from elasticsearch.helpers import scan, streaming_bulk


config = {
	'hostname' : '10.1.94.103',
	'hostport' : 9200
}

client = Elasticsearch([{'host' : '10.1.94.103', 'port' : 9200}])

body = {
	"_source" : ["images.standard_resolution.url", 'geoloc', 'created_time'],
	"query" : {
		"range" : {
			"created_time" : {
				"lte" : "2015-05-10",
				"gte" : "2015-05-10"
			}
		}
	},
}

res  = client.search(index = 'instagram_remap', doc_type = 'baltimore', body = body)

urls = _.map(lambda x: x['_source']['images']['standard_resolution']['url'], res['hits']['hits'])

url = urls[1]






# ------

'''
	bin/pyspark --master "local[3]" --jars jars/elasticsearch-hadoop-2.1.0.rc1.jar --driver-memory 6G --executor-memory 6G 
'''

import json, sys
import funcy as _
from skimage import io

config = {
	'hostname' : '10.1.94.103',
	'hostport' : 9200
}

query = {
	"_source" : ["images.low_resolution.url", 'geoloc', 'created_time'],
	"query" : {
		"filtered" : {
			"filter" : {
				"geo_bounding_box" : {"geoloc" : { 'bottom_right': { 'lat': 39.28287864841839, 'lon': -76.61981105804443 },
  'top_left': { 'lat': 39.28513741832134, 'lon': -76.62322282791138 } } }
			},
			"query" : {
		"range" : {
			"created_time" : {
              "from": "2015-04-09",
              "to"  : "2015-04-11"
   			}
		}
			
			}
		}
	}
}

resource_string = 'instagram_remap/baltimore'

rdd = sc.newAPIHadoopRDD(
    inputFormatClass = "org.elasticsearch.hadoop.mr.EsInputFormat",
    keyClass         = "org.apache.hadoop.io.NullWritable",
    valueClass       = "org.elasticsearch.hadoop.mr.LinkedMapWritable",
    conf             = {
        "es.nodes"    : config['hostname'],
        "es.port"     : str(config['hostport']),
        "es.resource" : resource_string,
        "es.query"    : json.dumps(query)
    }
)

rdd.count()


# --

# import the necessary packages
# import matplotlib.pyplot as plt
import os, cv2, datetime, math, numpy
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import pairwise_distances

def make_hist(image, plot = False, n_bins = 5):
	image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
	
	# show our image
	if plot:
		plt.figure()
		plt.axis("off")
		plt.imshow(image)
	
	color    = ('r','g','b')
	features = []
	for i,col in enumerate(color):
		hist = cv2.calcHist([image], [i], None, [n_bins], [0,256])
		features.extend(hist.flatten())
		
		if plot:
			plt.plot(hist,color = col)
			plt.xlim([0,256])
	
	# Normalized by total number of pixel-channels
	sm       = sum(features)
	features = [x / sm for x in features]
	return features

def get_image(x):
	url = x['images']['low_resolution']['url']
	try:
		x['raw_image'] = io.imread(url)
		print 'found :: ' + url
		return x
	except:
		print 'not_found :: ' + url
		pass

def featurize(x):
	x['hist'] = make_hist(x['raw_image'])
	return x

def round_time_down(x):
	dt = datetime.datetime.fromtimestamp(float(x['created_time']))
	dt = dt - datetime.timedelta(minutes = dt.minute, seconds = dt.second)
	return dt.strftime('%Y-%m-%dT%H:%M:%S')

def group(x, geo_bin = .1):
	dt  = round_time_down(x)
	lat = math.floor(x['geoloc']['lat'] / geo_bin) * geo_bin
	lon = math.floor(x['geoloc']['lon'] / geo_bin) * geo_bin
	return (dt, lat, lon)

# Trick that lets us disconnect from VPN for speed
rdd_ = rdd.collect()
rdd2 = sc.parallelize(rdd_)

w_images = rdd2.mapValues(get_image)
w_images.cache()
w_images.saveAsTextFile('/Users/BenJohnson/Desktop/test_baseball')

w_hist   = w_images.filter(lambda x: x[1] != None).mapValues(featurize)
w_hist.take(10)
binned   = w_hist.groupBy(lambda x: group(x[1]))



ds = binned.mapValues(lambda z: numpy.median(pairwise_distances(_.map(lambda x: x[1]['hist'], z), metric = 'cosine')))
ds.map(lambda x: x[0] + (x[1], )).saveAsTextFile('/Users/BenJohnson/Desktop/test_img')
