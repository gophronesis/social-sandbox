import urllib2, os, json, requests
from elasticsearch import Elasticsearch
from elasticsearch.helpers import scan, streaming_bulk

def download(id_, url):

    f = open(os.path.join('data/baltimore_images', id_), 'wb')
    f.write(requests.get(url).content)
    f.close()

config = {
	'hostname' : 'localhost',
	'hostport' : 9205,
	'index'    : 'instagram',
	'doc_type' : 'baltimore'
}

client = Elasticsearch([{'host' : config['hostname'], 'port' : config['hostport']}])

body = {
	"_source" : [
        "images.low_resolution.url",
        "created_time",
        "location"
    ]
}

f = open('data/baltimore_metadata.csv', 'wb')

for a in scan(client, index = config['index'], doc_type = config['doc_type'], query = body):
    print a['_id']
    download(a['_id'], a['_source']['images']['low_resolution']['url'])
    json.dump(a, f)
    f.write('\n')

f.close()