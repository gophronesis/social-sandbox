import json
from elasticsearch import Elasticsearch
from elasticsearch.helpers import scan, streaming_bulk, reindex


# -------------------------------------
# Dump from index to disk

INDEX    = 'instagram'
HOSTNAME = 'localhost'
HOSTPORT = 9205
OUTPATH  = 'instagram.json.txt'

client = Elasticsearch([ {'host' : HOSTNAME, 'port' : HOSTPORT} ])

def run(client, index, query):    
    for a in scan(client, index = index):
        yield a

counter = 0
with open(OUTPATH, 'wb') as f:
    for a in run(client, INDEX, QUERY):
        counter += 1
        f.write(json.dumps(a))
        f.write('\n')
        if counter % 100 == 0:
            print counter

# ----------------------------------------
# Copy from one index to another (possibly on another machine)

INDEX          = 'instagram'
LOCAL_HOSTNAME = 'localhost'
LOCAL_HOSTPORT = 9205

REMOTE_HOSTNAME = '10.1.94.156'
REMOTE_HOSTPORT = 9200

r_client = Elasticsearch([{'host' : REMOTE_HOSTNAME, 'port' : REMOTE_HOSTPORT}])
l_client = Elasticsearch([{'host' : LOCAL_HOSTNAME, 'port' : LOCAL_HOSTPORT}])

reindex(r_client, INDEX, INDEX, target_client = l_client)
