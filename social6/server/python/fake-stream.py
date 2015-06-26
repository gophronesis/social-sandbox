#! /usr/local/bin/python

# Stream data out of Elasticsearch
# and into Kafka
#
# NB : This might not use the same serialization as Justin's scraper
# Should double check to make sure it's th same

import time, json, sys
from datetime import datetime

from elasticsearch import Elasticsearch
from elasticsearch.helpers import scan

from kafka import SimpleProducer, KafkaClient
from kafka.common import LeaderNotAvailableError


def format_time(t):
	return str(int(time.mktime(datetime.strptime(t, '%Y-%m-%d %H:%M:%S').timetuple())))

def make_query(start_time = '2015-04-27 00:00:00', end_time = '2015-04-28 00:00:00'):
	return {
		"query" : {
			"range" : {
				"created_time" : {
					"gte" : format_time(start_time),
					"lte" : format_time(end_time)
				}
			}
		},
		"sort": [{
			"created_time": {
				"order" : "asc"
			}
	    }]
	}


def run(es_client, config):
	t       = -1
	counter = 0
	# Yield documents in order
	query = make_query(config['START_TIME'], config['END_TIME'])
	for a in scan(
		es_client, 
		index          = config['ES_INDEX'], 
		doc_type       = config['ES_TYPE'], 
		query          = query, 
		preserve_order = True):
		yield a['_source']
		
		counter += 1
		
		# # Sleep for appropriate amount of time
		if t > -1:
			tdiff = (float(a['_source']['created_time']) - t)
			sl    = tdiff / config['SPEED']
			time.sleep(sl)
		
		t = float(a['_source']['created_time'])

			
def publish(a, producer, config):
	try:
		producer.send_messages(config['RAW_TOPIC'], json.dumps([a]))
	except LeaderNotAvailableError:
		time.sleep(1)
		producer.send_messages(config['RAW_TOPIC'], json.dumps([a]))

def main():
	with open(sys.argv[1], 'rb') as f:
		config = json.load(f)
		
	kafka     = KafkaClient(config['KAFKA_HOST'] + ':9092')
	producer  = SimpleProducer(kafka)
	es_client = Elasticsearch([{'host' : config['ES_HOST'], 'port' : config['ES_PORT']}])

	# Should link this to config file
	kafka.ensure_topic_exists('throwaway')
	kafka.ensure_topic_exists('instagram_fake')
	kafka.ensure_topic_exists('instacounts')

	for a in run(es_client, config):
		publish(a, producer, config)

if __name__ == '__main__':
	main()