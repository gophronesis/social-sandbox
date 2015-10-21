require(Matrix)
require(scales)
require(plyr)
require(colorout)
require(lubridate)

x      <- readRDS('scratch/x.rds')
lfin   <- readRDS('scratch/lfin.rds')
events <- readRDS('scratch/events.rds')

sel <- x$date > '2015-04-25' & x$date < '2015-05-02'
x   <- x[sel,]

# --
# Plotting over time
cnts        <- aggregate(1:nrow(x), by = list(format(x$date, '%Y-%m-%d %H')), length)
names(cnts) <- c('hour', 'count')
cnts$hour   <- as.POSIXct(paste0(cnts$hour, ':00:00'))
plot(cnts$count ~ cnts$hour, type = 'l', main = 'Posts over time', xlab = 'Time', ylab = 'N Posts')

big_events <- events[sapply(events, length) > 20]

# --
# Making xx
xx <- merge(x, ldply(big_events, as.matrix), by.x = 'id', by.y ='1', all.x = TRUE)
names(xx)[ncol(xx)] <- 'event_id'
xx$event_id <- as.numeric(xx$event_id)
xx$event_id[is.na(xx$event_id)] <- 0

# --
# Map of the city
xx$day <- day(xx$date)
d      <- unique(xx$day)[1]
sub    <- xx[xx$day == d,]
map    <- get_map('Baltimore', zoom = 15)
ggmap(map) + geom_point( aes(x = lon, y = lat, color = as.factor(event_id)), data = sub[sub$event_id > 0,])

# --
# Network plots
writeLinks <- function(df, outfile = '~/Desktop/links.js') {
    cat(
        paste('var links = ', jsonlite::toJSON(df)), 
        file = outfile
    )
}

sort(table(xx$event_id))

lsel <- lfin[['.id']] %in% xx$id[xx$event_id == 278]
writeLinks(data.frame(
    source = lfin$hub[lsel],
    target = lfin$spoke[lsel],
    id     = lfin$.id[lsel],
    time   = as.numeric(x$date[match(lfin$.id[lsel], x$id)]),
    offset = min(as.numeric(x$date[match(lfin$.id[lsel], x$id)])),
    diff   = diff(range(as.numeric(x$date[match(lfin$.id[lsel], x$id)])))
))

# <<

lsel    <- which(lfin[['.id']] %in% xx$id[xx$day == 25])
tmp     <- lfin[lsel,]
tmplevs <- unique(c(tmp[['.id']], tmp[['1']]))

tmp$source <- as.numeric(factor(tmp[['.id']], tmplevs)) - 1 
tmp$target <- as.numeric(factor(tmp[['1']], tmplevs)) - 1

times <- as.numeric(x$date[match(tmplevs, x$id)])
lats  <- x$lat[match(tmplevs, x$id)]

cat(jsonlite::toJSON(list(
    meta = list(
        time = list(
            min = min(times, na.rm = T),
            max = max(times, na.rm = T)    
        ),
        lat = list(
            min = min(lats, na.rm = T),
            max = max(lats, na.rm = T)  
        )
    ),
    network = list(
        nodes = data.frame(
            name = tmplevs,
            time = as.numeric(x$date[match(tmplevs, x$id)]),
            lat  = x$lat[match(tmplevs, x$id)]
        ),
        links = tmp[,c('source', 'target')]
    )
)), file = '~/projects/software/grapher/examples/test.json')



# >>


# --
# Birth of an event

lfin_sub <- lfin[lfin$.id %in% x$id[xx$day == 25],]

dm <- max(c(lfin$hub, lfin$spoke))

sm           <- t(sparseMatrix(i = lfin_sub$hub, j = lfin_sub$spoke, dims = c(dm, dm)))
rownames(sm) <- colnames(sm) <- levs
mm <- sm # asymettric
while(TRUE) {
    mm_prev <- mm
    for(i in 1:3) {
        mm <- (mm %*% mm) > 0    
    }
    cat('.')
    if(sum(mm != mm_prev) == 0) break
}
m3 <- mm | t(mm)






