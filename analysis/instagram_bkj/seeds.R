init <- function() {
    require(compiler)
    enableJIT(3)

    options(stringsAsFactors = F)
    require(geosphere)
    require(plyr)
    require(lubridate)
    require(lsa)
    require(colorout)
    require(itertools)
    require(doMC)
    registerDoMC(cores = 5)
}

geosubset <- function(df, min_lon, min_lat, max_lon, max_lat) {
    df$lat > min_lat & 
    df$lat < max_lat & 
    df$lon > min_lon & 
    df$lon < max_lon
}

open_imgs <- function(pths) {
    pths2 <- file.path('~/data/images/baltimore/images', paste0(pths, '.jpg'))
    sapply(pths2, function(p) { system(paste('open', p)) })
}

init()

# --
# Load and subset

df      <- df.orig <- readRDS('data/df2.rds')
df      <- df[!is.na(df$time),]
df$date <- as.POSIXct(as.numeric(df$time), origin = "1970-01-01")
df      <- df[order(df$date),]

lon_sub <- df$lon > quantile(df$lon, .01) & df$lon < quantile(df$lon, .99)
lat_sub <- df$lat > quantile(df$lat, .01) & df$lat < quantile(df$lat, .99)
sub     <- lon_sub & lat_sub

x <- df[sub,]
saveRDS(x, 'scratch/x.rds')

# --------------------------------------------------------
# ---- Seeding -----
# Get near in time, space and image content

close_in_time <- function(x, N_MINUTES = 30) {
    N_SECONDS <- N_MINUTES * 60
    
    vec  <- as.numeric(x$date)
    res  <- rep(NA, nrow(x))
    lead <- follow <- 1
    while(lead <= nrow(x)) {
        d <- vec[lead] - vec[follow]
        if(d > (N_SECONDS)) {
            follow <- follow + 1
        } else {
            res[lead] <- follow
            lead      <- lead + 1
        }
    }
    
    res
}

close_in_space <- function(ind, N_METERS = 100) {
    sel   <- res[ind] : ind
    gdiff <- distCosine(x[ind, c('lon', 'lat')], x[sel, c('lon', 'lat')])
    
    sel[gdiff <= N_METERS]    
}

res          <- close_in_time(x)

cands_seq    <- 1:nrow(x)
cands        <- llply(cands_seq, close_in_space, .parallel = TRUE)
names(cands) <- cands_seq
saveRDS(cands, 'scratch/cands_30s_100m.rds')
mcands <- cands[sapply(cands, length) > 1]

# --
# Subset by date for development
mcands_dates <- x$date[as.numeric(names(mcands))]
sel <- mcands_dates > '2015-04-25' & mcands_dates < '2015-05-02'

ic  <- mcands[sel]
ic  <- llply(ic, function(inds) x$id[inds])
names(ic) <- x$id[as.numeric(names(ic))]

# --
# Featurize images
write.table(unique(unlist(ic)), 'image_subset.csv', 
    row.names = F, col.names = F, quote = FALSE)

write.table(x$id, 'image_all.csv', 
    row.names = F, col.names = F, quote = FALSE)


# ... Featurize in python, then reload ...

load_img <- function() {
    img    <- readRDS('images/baltimore_features_v2.rds')
    img$id <- gsub('.*/images/|\\.jpg', '', img$id)

    # >> !!
    # What's the deal with duplicate names?
    img <- img[-which(duplicated(img$id)),]
    # << !!

    rownames(img) <- img$id
    img$id        <- NULL
    as.matrix(img)
}

img  <- load_img()

ic_s <- llply(ic, function(x) { intersect(x, rownames(img)) }, .parallel = TRUE)

img_sims <- foreach(is = isplitVector(1:length(ic_s), chunkSize = 250), .combine = c) %dopar% {
    cat('+')
    foreach(i = is) %do% {
        ind <- names(ic_s)[i]
        if(ind %in% rownames(img)) {
            v1 <- img[ind,]
            vs <- img[ic_s[[i]],,drop = F]
            apply(vs, 1, function(v) {
                cosine(v, v1)    
            })
        }
    }
}
names(img_sims) <- names(ic_s)[1:length(img_sims)]
sims <- unlist(img_sims)
saveRDS(img_sims, 'scratch/img_sims.rds')

# What's a good cutoff for image similarity?
# Background image similarity distribution

inds <- matrix(sample(1:nrow(img), 2 * 50000, replace = TRUE), ncol = 2)

rand_img_sims <- aaply(inds, 1, function(i) {
    y1 <- unlist(img[i[1], ])
    y2 <- unlist(img[i[2], ])
    cosine(y1, y2)
}, .parallel = TRUE)

saveRDS(rand_img_sims, 'rand_img_sims.rds')

par(mfcol = c(2, 1), mar = rep(2, 4))
hist(sims[sims < 1], 250, col = 'red', xlim = c(0, 1))
hist(rand_img_sims, 250, col = 'green', xlim = c(0, 1))

img_thresh <- quantile(rand_img_sims, .95)
mean(sims[sims < 1] > img_thresh)

# For each event, get "close" posts
fin <- lapply(img_sims, function(i) {
    names(which(i > img_thresh))    
})
names(fin) <- names(img_sims)
fin <- fin[sapply(fin, length) > 1]

i   <- 1000
ids <- c(fin[[i]], names(fin)[i])
open_imgs(ids)

# ----------------------------------------------------------
# -- Expansion Rule --

lfin       <- ldply(fin, .fun = as.matrix)
levs       <- unique(c(lfin[['.id']], lfin[['1']]))
lfin$hub   <- as.numeric(factor(lfin[['.id']], levels = levs))
lfin$spoke <- as.numeric(factor(lfin[['1']],   levels = levs))

# two directional (for historical)
sm <- t(sparseMatrix(i = lfin$hub, j = lfin$spoke, dims = c(length(levs), length(levs))))
mm <- sm | t(sm)
while(TRUE) {
    mm_prev <- mm
    for(i in 1:3) {
        mm <- (mm %*% mm) > 0    
    }
    cat('.')
    if(sum(mm != mm_prev) == 0) break
}
m3 <- mm | t(mm)

# Equivalence classes give us events
events     <- unique(alply(m3, 1, which))
events     <- lapply(events, function(i) levs[i])
big_events <- events[sapply(events, length) > 3]

# Inspecting events
i    <- which(sapply(big_events, length) == 484)
xsel <- match(big_events[[i]], x$id)

# Text
sample(x$text[xsel])

# Dates
range(x$date[xsel])

# Images
open_imgs(sample(big_events[[i]], 10))

# Map
plot(head(x[,c('lon', 'lat')], 10000), cex = .2)
points(x[xsel, c('lon', 'lat')], col = 'red')


