require(scales)
source('analysis/instagram_bkj/seed_func.R')
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

# < 30 minutes
# < 100 meters
# > 95 percentile random image similarity

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
fin <- fin[sapply(fin, length) > 0]


i   <- 1000
ids <- c(fin[[i]], names(fin)[i])
open_imgs(ids)

# ----------------------------------------------------------
# -- Expansion Rule --

lfin_all <- ldply(img_sims[sapply(img_sims, length) > 0], function(x) {
    data.frame(id = names(x), img_sim = x)
}, .parallel = TRUE)
names(lfin_all) <- c('source', 'target', 'sim')
lfin_all <- lfin_all[lfin_all$source != lfin_all$target,]

lfin       <- lfin_all[lfin_all$sim > img_thresh,]
levs       <- unique(c(lfin[['source']], lfin[['target']]))
lfin$hub   <- as.numeric(factor(lfin[['source']], levels = levs))
lfin$spoke <- as.numeric(factor(lfin[['target']],   levels = levs))

# two directional (for historical)
ccomps <- function(lfin, levs, backwards_only = FALSE) {
    sm <- t(sparseMatrix(i = lfin$hub, j = lfin$spoke, dims = c(length(levs), length(levs))))
    rownames(sm) <- colnames(sm) <- levs
    if(!backwards_only) { mm <- sm | t(sm) } else {mm <- t(mm)}
    while(TRUE) {
        mm_prev <- mm
        for(i in 1:3) {
            mm <- (mm %*% mm) > 0    
        }
        cat('.')
        if(sum(mm != mm_prev) == 0) break
    }
    if(!backwards_only) { mm <- mm | t(mm) }
    mm
}

# Equivalence classes give us events
cc            <- ccomps(lfin, levs, backwards_only = FALSE)
events        <- unique(alply(m3, 1, which, .parallel = TRUE))
events        <- lapply(events, function(i) levs[i])
names(events) <- 1:length(events)

event_mapping        <- ldply(events, as.matrix)
names(event_mapping) <- c('event_id', '.id')

lfin <- merge(lfin, event_mapping)

saveRDS(lfin, 'scratch/lfin.rds')
saveRDS(events, 'scratch/events.rds')

# --
big_events <- events[sapply(events, length) > 20]

tmp <- ldply(big_events, function(ids) {
    data.frame(
        count = length(ids),
        start = min(x$date[x$id %in% ids]),
        end   = max(x$date[x$id %in% ids])
    )    
}, .parallel = TRUE)
head(tmp)

# Inspecting events

sort(sapply(big_events, length))

i    <- which(sapply(big_events, length) == 484)
xsel <- which(x$id %in% big_events[[i]])

# Text
sample(x$text[xsel], 10)

# Dates
range(x$date[xsel])

# Images
open_imgs(sample(big_events[[i]], 10))

# Map
plot(head(x[,c('lon', 'lat')], 10000), cex = .2)
points(x[xsel, c('lon', 'lat')], col = alpha('red', .01), cex = 3)

# Network
lsel <- lfin[['.id']] %in% x$id[xsel]
tmp  <- lfin[lsel, ]
d3SimpleNetwork(
    tmp[, c('hub', 'spoke', 'event_id')], 
    width = 5000, height = 5000,
    file = '~/Desktop/test.html'
)

# << 
# How spread are the baseball tweets

plot(jitter(as.matrix(x[xsel, c('lon', 'lat')]), amount = .00001), col = alpha('black', .5), cex = 2)

dim(unique(x[xsel,c('lon', 'lat')]))


# >>

# -------------
# Birth of an event

ccb <- ccomps(lfin, levs, backwards_only = TRUE)

i         <- which(sapply(big_events, length) == 642)

tmpsel <- big_events[[i]]
plot(rowSums(ccb[tmpsel,])[1:200], type = 'l')

plot(rowSums(ccb) ~ x$date[match(rownames(ccb), x$id)], type = 'h')



tm <- x$date[x$id == big_events[[i]][100]]
sel <- x$id[which(abs(tm - x$date) < (60 * 60))]



plot(rowSums(ccb[(tmpsel - 1000) : tmpsel,]), type = 'l')


ccb[tmpsel, tmpsel]

k <- 1
which(ccb[big_events[[i]][k],])
k <- k + 1

# --------------------------------------------------------
# -- Fiddling with parameters --

i   <- 1000
sel <- which(x$id == names(fin)[i])

make_edges <- function(id, t, d, i) {
    cat('-')
    if(!(id %in% x$id)) return
    
    ths <- x[x$id == id,]
    
    # Time
    time_dist <- ths$date - x$date
    sub       <- x[abs(time_dist) < (t * 60),,drop=F] # Go forwards and backwards in time
    if(nrow(sub) == 0) return
    
    # Geo
    geo_dist <- distCosine(ths[, c('lon', 'lat')], sub[, c('lon', 'lat')])
    sub      <- sub[geo_dist < d,,drop=F]
    if(nrow(sub) == 0) return
    
    # # Image
    sub     <- sub[sub$id %in% rownames(img),,drop=F]
    v1      <- img[ths$id,]
    vs      <- img[sub$id,,drop=F]
    
    img_sim <- apply(vs, 1, cosine, v1)
    sub     <- sub[img_sim > i,]
    if(nrow(sub) == 0) return
    
    unlist(sub$id)
}

grid <- expand.grid(
    # t = seq(10, 60,  by = 10),
    d = seq(10, 300, by = 25)
    # i = seq(10, 100, by = 10)
)

out <- c()
for(r in 1:nrow(grid)) {
    id <- names(fin)[500]
    t  <- 30
    d  <- grid$d[r]
    i  <- .43

    new_edges <- id
    all_edges <- c()

    while(length(new_edges) > 0) {
        edge_candidates <- unlist(llply(new_edges, make_edges, t, d, i, .parallel = TRUE))
        new_edges       <- setdiff(edge_candidates, all_edges)
        all_edges       <- c(all_edges, new_edges)
        cat('new_edges ::', length(new_edges), '\n')
    }

    out <- c(out, length(all_edges))
    print(out)
}
