
init <- function() {
    options(stringsAsFactors = F)
    require(lsa)
    require(doMC)
    registerDoMC(cores = 4)
    require(plyr)
    require(RJSONIO)
    require(colorout)
}

show_img <- function(img) {
    plot(1:2, type = 'n')
    rasterImage(img, 1, 1, 2, 2)
}

init()

# --
# Loading image features
x <- read.csv('foo.csv', as.is = T, header = F)
names(x)[1] <- 'id'
x$id <- gsub('.*/', '', x$id)

# --
# Loading metadata

m <- readLines('data/baltimore_metadata.csv')
m <- head(m, -1)
m <- lapply(m, fromJSON)
m <- ldply(m, .fun = function(x) as.data.frame(t(unlist(x))), .parallel = T)
names(m) <- c('score', 'type', 'id', 'created_time', 'img', 'lat', 'lon', 'index', 'loc', 'loc_id')

m <- m[m$id %in% x$id,]

m$lat <- as.numeric(m$lat)
m$lon <- as.numeric(m$lon)
m$created_time <- as.numeric(m$created_time)

m$date <- as.Date(m$created_time / (24 * 60 * 60), origin = '1970-01-01')

x <- x[order(x$id),]
m <- m[order(m$id),]

# --
# At the stadium

box <- list(
    lat = list(
        max = 39.2958349649,
        min = 39.2711346954
    ),
    lon = list(
        max = -76.6079764271,
        min = -76.6345746613
    )    
)

# Posts in region, in order
b     <- m[m$lat > box$lat$min & m$lat < box$lat$max & m$lon > box$lon$min & m$lon < box$lon$max,]
times <- as.Date(b$created_time / (24 * 60 * 60), origin = '1970-01-01')

# Images in regions, in order
bx  <- as.matrix(x[match(b$id, x$id),-1])

# Cosine similarity between images in region
# (Takes way too long)
sim       <- cosine(t(bx))
diag(sim) <- NA

# --
# Event detection
# Hypothesis: Given a small enough area where an event is homogenous, 
# we could see an increase in image similarity at the time of an event
# Need to work out how this is associated with volume though...

# Similarity of last K photos
sim_window <- function(sim, K = 5) {
    tmp <- sapply((K + 1) : nrow(sim), function(i) {
        mean(sim[(i - K) : (i - 1), i], na.rm = T)
    })
    
    c(rep(NA, K), tmp)
}

par(mfcol = c(2, 1), mar = rep(2, 4))
plot( sim_window(sim, 50), cex = .5, 
    col = 1 + (1:nrow(b) %in% which(b$loc == 'Oriole Park at Camden Yards')))
plot(times, col = 1 + (b$loc == 'Oriole Park at Camden Yards'))


# --

# For each post, find X geographically nearest posts
# and rank by compute image similarity

geo_distance <- as.matrix(dist(m[,c('lat', 'lon')]))
geo_distance <- apply(geo_distance, 2, order)[-1,]
colnames(geo_distance) <- m$id

loc_sim <- function(i, K = 10) {
    if(is.character(i)) {
        i <- colnames(geo_distance == i)
    }
    
    cs <- cosine(
        t(x[c(i, head(geo_distance[,i], K)), -1])
    )
    diag(cs) <- NA
    mean(cs, na.rm = T)
}

loc_sims <- laply(1:nrow(x), .fun = loc_sim, .parallel = T)
hist(loc_sims, 100, col = 'blue')

m_loc <- head(m[order(loc_sims, decreasing = T),], 100)
x_loc <- head(x[order(loc_sims, decreasing = T),], 100)

id   <- m_loc$id[50]
urls <- m[head(geo_distance[,id], 10),'img']
browseURL(m_loc$img[m_loc$id == id])
for(url in urls) {
    browseURL(url)
}


# ---
# Similarity vs distance for posts in the same hour

bball <- m[which(m$loc == 'Oriole Park at Camden Yards'),]
table(bball$lat)

id <- '961114618457642389_14896684'
urls <- m[head(geo_distance[,id], 10),'img']
browseURL(m_loc$img[m_loc$id == id])
for(url in urls) {
    browseURL(url)
}

# --

# For space and time, this is some kind of mixture model
#
# We could idealize it by saying
#
# Gaussian over space + time
# Uniform background noise




# img_sim, time_sim, loc_sim
                   









