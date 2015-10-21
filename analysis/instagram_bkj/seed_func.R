
init <- function() {
    options(stringsAsFactors = F)
    
    require(compiler)
    enableJIT(3)
    
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

close_in_time <- function(x, N_MINUTES = 30) {
    N_SECONDS <- N_MINUTES * 60
    
    vec  <- as.numeric(x$date)
    res  <- rep(NA, nrow(x))
    lead <- follow <- 1
    while(lead <= nrow(x)) {
        d <- vec[lead] - vec[follow]
        if(d > N_SECONDS) {
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



