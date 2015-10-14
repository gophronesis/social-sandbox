require(Matrix)
require(tm)

# "as the crow flies" distance between post locations
geodist <- function(v, z) {
    cat('=')
    distCosine(
        v[c('lon', 'lat')], 
        z[,c('lon', 'lat')]
    )
}

# Cosine similarity between bag-of-words representations
# Could do this more efficiently
textdist <- function(v, z) {
    cat('+')
    txt <- tolower(c(v$text, z$text))
    r   <- TermDocumentMatrix(
        Corpus(VectorSource(txt)),
        control = list(removePunctuation = TRUE, stopwords = TRUE)
    )
    sm    <- sparseMatrix(i = r$i, j = r$j, x = r$v)
    
    csim <- aaply(sm[,-1], 2, function(s) cosine(sm[,1], s), .parallel = TRUE)
    csim[is.nan(csim)] <- 0

    csim
}

# Cosine similarity between featurized images
imgdist <- function(v, z) {
    cat('-')
    v1 <- img[v$id,]
    vs <- img[intersect(z$id, rownames(img)),,drop = F]
    
    out <- apply(vs, 1, function(v) {
        cosine(v, v1)    
    })
    names(out) <- NULL
    out
}

# How to combine similarity measurements from multiple seeds?
combine <- function(a) {
    apply(do.call(rbind, a), 2, median)
}

# Get quantile of one vector if inserted into another
pvals <- function(a, b) {
    findInterval(a, sort(b)) / length(b)
}

# --

ids <- list(
    fired  = names(fin)[i],
    seeded = fin[[i]],
    all    = c(fin[[i]], names(fin)[i])
)

vals <- list(
    fired  = x[x$id == ids$fired,],
    seeded = x[x$id %in% ids$seeded,],
    all    = x[x$id %in% ids$all,]
)
vals <- lapply(vals, function(x) split(x, 1:nrow(x)))

ind <- which(x$id == ids$fired)
ex  <- x[(ind - 1000) : (ind - 1),]
bg  <- x[sample(1:nrow(x), 10000),]

ex <- ex[ex$id %in% rownames(img),]

ex_geo  <- llply(vals$all, .fun = function(v) geodist(v, ex), .parallel = TRUE)
bg_geo  <- llply(vals$all, .fun = function(v) geodist(v, bg), .parallel = TRUE)

ex_text <- llply(vals$all, .fun = function(v) textdist(v, ex), .parallel = TRUE)
bg_text <- llply(vals$all, .fun = function(v) textdist(v, bg), .parallel = FALSE)

ex_img  <- llply(vals$all, .fun = function(v) imgdist(v, ex), .parallel = TRUE)
bg_img  <- llply(vals$all, .fun = function(v) imgdist(v, bg), .parallel = TRUE)


# --

a <- pvals(combine(ex_img), combine(bg_img))
b <- combine(ex_geo)
plot(a, b, col = ex$id %in% ids$all + 1)

open_imgs(ex$id[a > .95 & b > 1000])

ex_hash <- llply(vals$all, .fun = function(v) hashdist(v, ex), .parallel = TRUE)
bg_hash <- llply(vals$all, .fun = function(v) hashdist(v, bg), .parallel = TRUE)


