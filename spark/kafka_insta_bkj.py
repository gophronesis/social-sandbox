#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

"""
 Counts words in UTF8 encoded, '\n' delimited text received from the network every second.
 Usage: kafka_wordcount.py <zk> <topic>

 To run this on your local machine, you need to setup Kafka and create a producer first, see
 http://kafka.apache.org/documentation.html#quickstart

 and then run the example
    `$ bin/spark-submit --jars external/kafka-assembly/target/scala-*/\
      spark-streaming-kafka-assembly-*.jar examples/src/main/python/streaming/kafka_wordcount.py \
      localhost:2181 test`
"""
from __future__ import print_function

import sys, json, math
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
from kafka import SimpleProducer, KafkaClient

import funcy as _
from pprint import pprint
import pybursts

def send(x):
    kafka     = KafkaClient("localhost:9092")
    producer  = SimpleProducer(kafka)
    for record in x:
        producer.send_messages("instacounts", json.dumps(record))

def parse(x):
    # return ' '.join([ y['caption']['text'].lower() for y in json.loads(x[1]) if y.get('caption') and y['caption'].get('text') and y['caption']['text'].strip() != ''])
    body = json.loads(x[1])
    return body[0]

def combine(a, b):
    if type(a) == type([]):
        return a + [b]
    else:
        return [a] + [b]

kafka    = KafkaClient("localhost:9092")
producer = SimpleProducer(kafka)

kafka.ensure_topic_exists(sys.argv[2])

def do_cat(x, y):
    return _.flatten([x, y])

def un_cat(x, y):
    return _.flatten([list(set(_.flatten(x)) - set(_.flatten([y])))])

def _sort(x):
    print('_sort')
    print(x)
    x.sort()
    return x

def split_time_by_loc(x):
    lat   = math.floor(x['location']['latitude'] * config['GRID_SCALE']) / config['GRID_SCALE']
    lon   = math.floor(x['location']['longitude'] * config['GRID_SCALE']) / config['GRID_SCALE']
    value = int(x['created_time'])
    # return ((lat, lon), value)
    return ((lon, lat), [value])

config = {
    "S"          : 2,
    "GAMMA"      : 0.5,
    "GRID_SCALE" : 20
}

if __name__ == "__main__":

    if len(sys.argv) != 3:
        print("Usage: kafka_wordcount.py <zk> <topic>", file=sys.stderr)
        exit(-1)

    # --
    # Input
    sc  = SparkContext(appName = "PythonStreamingKafkaWordCount")
    ssc = StreamingContext(sc, 3)
    StreamingContext.checkpoint(ssc, '/tmp')
    

    zkQuorum, topic = sys.argv[1:]
    kvs             = KafkaUtils.createStream(ssc, zkQuorum, "spark-streaming-consumer", {topic: 1})
    
    # -- hhty
    # Processing
    # lines = kvs.map(process)
    #             .reduce(lambda x: (x, 1))\
    #             .reduceByKey(lambda a, b: a + b)\
    #             .reduce(lambda a, b: combine(a, b)) # This doesn't work all of the way -- too nested
    
    # Pluck times
    times = kvs.map(parse)\
                .filter(lambda x: 'created_time' in x.keys())\
                .map(split_time_by_loc)
    
    # Apply algorithm to all times
    bursts = times.reduceByKeyAndWindow(lambda x, y: do_cat(x, y), lambda x, y: un_cat(x, y), 3, 3)\
                .mapValues(lambda x: _sort(x))\
                .map(lambda x: {
                    "loc"    : x[0],
                    "data"   : x[1],
                    "bursts" : pybursts.kleinberg(x[1], s = config['S'], gamma = config['GAMMA']).tolist()
                }); 
    # --
    # Output
    # Test producer
    producer.send_messages("instacounts", "<<starting-spark-streaming>>")
    
    # Send
    # This sends each thing individually -- would like to send entire histogram
    bursts.foreachRDD(lambda rdd: rdd.foreachPartition(send))
    
    # Start
    ssc.start()
    ssc.awaitTermination()
