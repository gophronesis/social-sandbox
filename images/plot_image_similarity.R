require(xts)

fs <- grep('part-', dir(), value = T)

x <- do.call(rbind, lapply(fs, read.csv, as.is = T, header = F))
x <- apply(x, 2, function(x) gsub("\\(|\\)|\\'", '', x))
x <- as.data.frame(x)

names(x) <- c('date', 'lat', 'lon', 'val')

s <- split(x, paste(x$lat, x$lon))

ts <- lapply(s, function(x) {
		xts(apply(x[,-1], 2, as.numeric), strptime(x[,1], format = '%Y-%m-%dT%H:%M:%S'))
})

plot(ts[[1]]$val)