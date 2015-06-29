#! /usr/local/bin/python

# Stream data out of Elasticsearch
# and into Kafka
#
# NB : This might not use the same serialization as Justin's scraper
# Should double check to make sure it's th same

import time, json
from datetime import datetime
from elasticsearch import Elasticsearch
from elasticsearch.helpers import scan
from kafka import SimpleProducer, KafkaClient
from kafka.common import LeaderNotAvailableError

config = {
	# Elasticsearch
	"HOSTNAME" : "localhost",
	"HOSTPORT" : 9205,
	
	"INDEX"    : 'instagram',
	"DOC_TYPE" : 'baltimore',
	
	'KAFKA'    : "localhost:9092",
	
	'TOPIC'    : 'throwaway',
	
	'QUERY'    : {
		"query" : {
			"range" : {
				"created_time" : {
					"gte" : str(int(time.mktime(datetime.strptime('2015-04-20 00:00:00', '%Y-%m-%d %H:%M:%S').timetuple()))),
					"lte" : str(int(time.mktime(datetime.strptime('2015-04-28 00:00:00', '%Y-%m-%d %H:%M:%S').timetuple())))
				}
			}
		},
		"sort": [{
			"created_time": {
				"order" : "asc"
			}
	    }]
	},
	'SPEED' : 60 * 250
}

es_client = Elasticsearch([{'host' : config['HOSTNAME'], 'port' : config['HOSTPORT']}])

def run():
	t       = -1
	counter = 0
	# Yield documents in order
	for a in scan(
		es_client, 
		index          = config['INDEX'], 
		doc_type       = config['DOC_TYPE'], 
		query          = config['QUERY'], 
		preserve_order = True):
		yield a['_source']

			

for a in run():
	print json.dumps({
		'loc' : a['location'],
		'user' : a['user']['username']
	})
	
