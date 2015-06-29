from elasticsearch import Elasticsearch

import tangelo
import cherrypy
import json
from datetime import datetime, timedelta
import numpy
from PIL import Image
import cv2



lat = None
lon = None
#GET /search/<fields>/<arg>/<arg>/...

def populateLinks(nodes,edges,mygraph):
    for source in edges.keys():
        for target in edges[source].keys():
            for relationship in edges[source][target].keys():
                mygraph["links"].append({"source":source,"target":target,"type":relationship, "value":edges[source][target][relationship]})

def addEdge(nodes,edges,mygraph,source,target,relationship):
    if source not in nodes:
        mygraph["nodes"].append({"name":source,"group":1})
        nodes[source] = len(mygraph["nodes"])-1
    if target not in nodes:
        mygraph["nodes"].append({"name":target,"group":1})
        nodes[target] = len(mygraph["nodes"])-1
    if nodes[source] not in edges:
        edges[nodes[source]] = {}
    if nodes[target] not in edges[nodes[source]]:
        edges[nodes[source]][nodes[target]] = {}
    if relationship not in edges[nodes[source]][nodes[target]]:
        edges[nodes[source]][nodes[target]][relationship] = 0
    edges[nodes[source]][nodes[target]][relationship] += 1




def similarness(image1,image2):
    """
Return the correlation distance be1tween the histograms. This is 'normalized' so that
1 is a perfect match while -1 is a complete mismatch and 0 is no match.
"""
    # Open and resize images to 200x200
    i1 = Image.open(image1).resize((200,200))
    i2 = Image.open(image2).resize((200,200))

    # Get histogram and seperate into RGB channels
    i1hist = numpy.array(i1.histogram()).astype('float32')
    i1r, i1b, i1g = i1hist[0:256], i1hist[256:256*2], i1hist[256*2:]
    # Re bin the histogram from 256 bins to 48 for each channel
    i1rh = numpy.array([sum(i1r[i*16:16*(i+1)]) for i in range(16)]).astype('float32')
    i1bh = numpy.array([sum(i1b[i*16:16*(i+1)]) for i in range(16)]).astype('float32')
    i1gh = numpy.array([sum(i1g[i*16:16*(i+1)]) for i in range(16)]).astype('float32')
    # Combine all the channels back into one array
    i1histbin = numpy.ravel([i1rh, i1bh, i1gh]).astype('float32')

    # Same steps for the second image
    i2hist = numpy.array(i2.histogram()).astype('float32')
    i2r, i2b, i2g = i2hist[0:256], i2hist[256:256*2], i2hist[256*2:]
    i2rh = numpy.array([sum(i2r[i*16:16*(i+1)]) for i in range(16)]).astype('float32')
    i2bh = numpy.array([sum(i2b[i*16:16*(i+1)]) for i in range(16)]).astype('float32')
    i2gh = numpy.array([sum(i2g[i*16:16*(i+1)]) for i in range(16)]).astype('float32')
    i2histbin = numpy.ravel([i2rh, i2bh, i2gh]).astype('float32')

    return cv2.compareHist(i1histbin, i2histbin, 0)

def time(*args,**kwargs):
    global lat
    global lon
    return lat, lon


def search(*args,**kwargs):
    global lat, lon
    lat = float(kwargs['lat'])
    min_lat = lat - .0005
    max_lat = lat + .0005
    lon = float(kwargs['lon'])
    min_lon = lon - .0005
    max_lon = lon + .0005
    es = Elasticsearch(['http://10.1.94.156:9200/'])
    res = es.search(index='instagram', doc_type="baltimore", body={"sort" : [{ "created_time" : {"order" : "asc"}}], \
        "size":8000, "fields":["images.thumbnail.url","user.username","comments.data.username","likes.*","link","id","location.latitude","location.longitude", "created_time"], \
        "query": {"bool": {"must": [{ "range": { "location.latitude": { \
        "gte": min_lat, "lte": max_lat, "boost": 2 } } }, { "range": { "location.longitude": { \
        "gte": min_lon, "lte": max_lon, "boost": 2} } }] } },"partial_fields": {"part": {"include": "likes.data.username","include": "comments.data.from.username"}}})

    mygraph = {"nodes":[], "links":[]}
    nodes = {}
    edges = {}
    m = {}
    for i in res['hits']['hits']:
        c = float(i['fields']['created_time'][0])
        dt = datetime.fromtimestamp(c)
        #return i
        #i1 = Image.open(str('/vagrant/insta/baltimore_images/' + i['fields']['id'][0] + '.jpg'))
        rounded = datetime(dt.year,dt.month,dt.day,dt.hour)
        creator = i["fields"]["user.username"][0]
        if "comments" in i["fields"]["part"][0]:
            for j in i["fields"]["part"][0]["comments"]["data"]:
                addEdge(nodes,edges,mygraph,j["from"]["username"],creator,"L")
        if "likes" in i["fields"]["part"][0]:
            for j in i["fields"]["part"][0]["likes"]["data"]:
                addEdge(nodes,edges,mygraph,j["username"],creator,"C")

        if m.get(rounded) == None:
            m[rounded] = 0
        m[rounded] += 1

    populateLinks(nodes,edges,mygraph)
    res['hourtimeseries'] = []
    res['graph'] = mygraph

    start = datetime(2015,4,1,0)
    end = datetime(2015,5,11,0)
    while start < end:
        if m.get(start) == None:
            res['hourtimeseries'].append({'x':int(start.strftime('%s')), 'y':0})
        else:
            res['hourtimeseries'].append({'x':int(start.strftime('%s')), 'y':m[start]})
        start = start + timedelta(hours=1)
    return res

actions = {
    "search": search,
    "time": time
}

def unknown(*args):
    return tangelo.HTTPStatusCode(400, "invalid service call")

@tangelo.restful
def get(action, *args, **kwargs):
    return actions.get(action, unknown)(*args,**kwargs)
