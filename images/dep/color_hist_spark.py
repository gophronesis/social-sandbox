# import the necessary packages
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt
import os, cv2

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