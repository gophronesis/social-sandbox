from __future__ import print_function

import sys
import json
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
from kafka import SimpleProducer, KafkaClient
from nltk.corpus import stopwords
import pybursts
from itertools import chain
import pandas as pd, numpy as np
ewma = pd.stats.moments.ewma
import math



def filt(a):
    if a[0] != '' and a[1] > 1 and a[0] not in stopwords.words('english'):
        return True
    return False

def send(x):
    kafka     = KafkaClient("10.3.2.75:9092")
    producer  = SimpleProducer(kafka)
    for record in x:
        producer.send_messages("bursts",str(record))


#process_ts
def process_ts(data):
    """Returns the timestamps in which a 3 standard deviation from the ewma occured"""
    dates=np.array(map(lambda x: float(x), data[1])).astype('datetime64[s]')
    ts=pd.DataFrame(dates,index=dates)
    #bin by every 30 minutes 
    bin_ts=ts.groupby(pd.TimeGrouper('30T')).size()
    #create a 3 hour moving average
    ma = ewma(bin_ts,span=6)
    alpha = 2.0/(7.0)
    mean = np.mean(ma)
    factor = 3.0*np.std(ma)
    ucl = mean+factor
    lcl = mean-factor
    return (bin_ts[ma>ucl])


def returnText(x):
    return ' '.join([ y['caption']['text'].lower() for y in json.loads(x[1]) if y.get('caption') and y['caption'].get('text') and y['caption']['text'].strip() != ''])
    #return len(json.loads(x[1]))
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: sparkburst.py <zk> <topic>", file=sys.stderr)
        exit(-1)

    kafka     = KafkaClient("10.3.2.75:9092")
    producer  = SimpleProducer(kafka)

    sc = SparkContext(appName="PythonStreamingKafkaWordCount")
    ssc = StreamingContext(sc, 120)

    zkQuorum, topic = sys.argv[1:]
    kvs = KafkaUtils.createStream(ssc, zkQuorum, "spark-streaming-consumer", {topic: 1})
    #lines = 
    lines=kvs.map(lambda x: json.loads(x[1])[0]).filter(lambda x: 'created_time' in x.keys())
    #.map(lambda x: x['created_time'])
    counts=kvs.map(lambda x: json.loads(x[1])[0]).filter(lambda x:'created_time' in x.keys()).map(lambda x: (("%.2f" % float(x['location']['latitude']),"%.2f" % float(x['location']['longitude'])),[str(x['created_time'])]))\
    .reduceByKey(lambda x,y: x+y)#.map(lambda x: sorted(map(int,x[1])))
#.map(lambda x:pybursts.kleinberg(x,s=2,gamma=0.5))
    ma_all=counts.map(lambda x: (x[0],process_ts(x)))
    ma_all.pprint()
    bursts=lines.map(lambda x: x.split('\n')).reduce(lambda x,y: sorted(map(int,x+y))).map(lambda x: pybursts.kleinberg(x,s=2,gamma=0.5))
   #reduceByWindow(lambda x,y: map(int,list(chain(*zip(x,y))))\
    #            ,lambda x,y: map(int,list(chain(*zip(x,y)))),240,120)
    #count = lines.reduce(lambda a,b: a+b)
    #lines.map(lambda 
    #counts = lines.flatMap(lambda line: line.replace('#',' ').split(" ")) \
    #    .map(lambda word: (word, 1)) \
    #    .reduceByKey(lambda a, b: a+b).filter(filt)
    #producer.send_messages("instacounts","yo")
    #counts.pprint()
    #bursts.foreachRDD(lambda rdd: rdd.foreachPartition(send))
    

    ssc.start()
    ssc.awaitTermination()
