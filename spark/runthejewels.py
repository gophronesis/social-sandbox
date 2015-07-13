import sys
import json
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
from kafka import SimpleProducer, KafkaClient
from itertools import chain
import pandas as pd, numpy as np
import geohash
ewma = pd.stats.moments.ewma
import math
from collections import Counter
import operator

es_read_conf = {
        "es.nodes" : "10.1.94.156",
        "es.port" : "9200",
        "es.resource" : "instagram/baltimore"
    } 

es_rdd = sc.newAPIHadoopRDD(
        inputFormatClass="org.elasticsearch.hadoop.mr.EsInputFormat",
        keyClass="org.apache.hadoop.io.NullWritable", 
        valueClass="org.elasticsearch.hadoop.mr.LinkedMapWritable", 
        conf=es_read_conf )
    
es_write_conf = {
    "es.nodes" : "10.1.94.156",
    "es.port": "9200",
    "es.resource" :"instagram/baltimore_events"
}

# this creates an RDD with a geohash and timebin (30 minute bins) as a key
hashkeys=es_rdd.map(lambda x: dict(x[1])).filter(lambda x: 'created_time' in x.keys())\
.map(lambda x: ((geohash.encode(float(x['location']['latitude']),float(x['location']['longitude']),6),int(x['created_time'])-int(x['created_time'])%1800)\
                ,x))

# processes the above RDD and constructs a time series for each geohash, identifies the top tags, most liked photos, and events using exponentially weighted moving average
events=hashkeys.map(lambda x: (x[0],{'tags':list(x[1]['tags']),'users':[x[1]['user']['username']],'timestamp':[x[1]['created_time']],'likes':[{'count':x[1]['likes']['count'],'id':x[1]['id']}]}))\
.reduceByKey(lambda x,y: {'users':x['users']+y['users'],'tags':x['tags']+y['tags'],'timestamp':x['timestamp']+y['timestamp'],'likes':x['likes']+y['likes']})\
.map(lambda x:(x[0][0],[{'timestamp':x[0][1],'count':len(x[1]['timestamp']),'tags':dict(Counter(x[1]['tags'])),'likes':x[1]['likes']}])).reduceByKey(lambda x,y:x+y).map(lambda x:(x[0],{'geohash':x[0],'data':process(x[1])})).filter(lambda x: x[1]['data']!=())\
.map(lambda item:('key',item[1]))

# saves the RDD to elasticsearch
events.saveAsNewAPIHadoopFile(
    path='-', 
    outputFormatClass="org.elasticsearch.hadoop.mr.EsOutputFormat",
    keyClass="org.apache.hadoop.io.NullWritable", 
    valueClass="org.elasticsearch.hadoop.mr.LinkedMapWritable", 
    conf=es_write_conf)

# main event detection function
def process(data):
    count=map(lambda x: x['count'],data)
    dates=np.array(map(lambda x: np.datetime64(x['timestamp'],'s'),data))
    tags=map(lambda x: x['tags'],data)
    likes=map(lambda x: x['likes'],data)
    ts=pd.Series(count, index=dates).sort_index()
    ts=ts.sort_index()
    new=pd.date_range(ts.index[0],ts.index[-1], freq="30min")
    ts_fill=ts.reindex(new).fillna(0)
    ma=ewma(ts_fill,span=6)
    alpha = 2.0/(7.0)
    mean = np.mean(ma)
    factor = 3*np.std(ma)
    ucl = mean+factor
    lcl = mean-factor
    events=ts_fill.index[np.logical_and(ts_fill.values[:]>ucl,ts_fill.values[:]>10)]
    final=[]
    for e in events:
        index=int(np.where(np.datetime64(e,'s')==dates)[0])
        toptags=dict(sorted(tags[index].iteritems(), key=operator.itemgetter(1), reverse=True)[:5])
        toplikes= tuple(sorted(likes[index], key=lambda k: k['count'],reverse=True)[:10])
        final.append({'likes':toplikes,'event':e.strftime('%s'), 'tags':toptags,'count':count[index]})
    return tuple(final)