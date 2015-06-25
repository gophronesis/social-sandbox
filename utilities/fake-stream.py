#! /usr/local/bin/python

# Stream data out of Elasticsearch
# and into Kafka
#
# NB : This might not use the same serialization as Justin's scraper
# Should double check to make sure it's th same

print 'initializing...'
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
					"gte" : str(int(time.mktime(datetime.strptime('2015-04-27 00:00:00', '%Y-%m-%d %H:%M:%S').timetuple()))),
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

print 'connecting...'
kafka     = KafkaClient(config['KAFKA'])
producer  = SimpleProducer(kafka)
es_client = Elasticsearch([{'host' : config['HOSTNAME'], 'port' : config['HOSTPORT']}])
print 'connected!'

# Should link this to config file
kafka.ensure_topic_exists(config['TOPIC'])
kafka.ensure_topic_exists('instagram_fake')
kafka.ensure_topic_exists('instacounts')

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
		
		counter += 1
		print counter
		
		# # Sleep for appropriate amount of time
		if t > -1:
			tdiff = (float(a['_source']['created_time']) - t)
			sl    = tdiff / config['SPEED']
			time.sleep(sl)
		
		t = float(a['_source']['created_time'])

			
def publish(a):
	print a
	try:
		producer.send_messages(config['TOPIC'], json.dumps([a]))
	except LeaderNotAvailableError:
		print 'error!'
		time.sleep(1)
		producer.send_messages(config['TOPIC'], json.dumps([a]))

print 'running...'
for a in run():
	publish(a)
	
