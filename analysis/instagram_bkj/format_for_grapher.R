require(plyr)
require(doMC)
registerDoMC(cores = 4)

# -- Loading data

x        <- readRDS('scratch/x.rds')
img_sims <- readRDS('scratch/img_sims.rds')

lfin_all <- ldply(img_sims[sapply(img_sims, length) > 0], function(x) {
    data.frame(id = names(x), img_sim = x)
}, .parallel = TRUE)
names(lfin_all) <- c('source', 'target', 'sim')
lfin_all <- lfin_all[lfin_all$source != lfin_all$target,]

lfin_all$source <- as.character(lfin_all$source)
lfin_all$target <- as.character(lfin_all$target)

# --

lfin_date <- x$date[match(lfin_all[['source']], x$id)]

lsel    <- lfin_date > '2015-04-25' & lfin_date < '2015-04-26'
tmp     <- lfin_all[lsel,]

tmp <- read.csv('~/projects/software/grapher/examples/preakness.csv', as.is = T)
tmp <- tmp[,-1]
tmplevs <- unique(c(tmp[['source']], tmp[['target']]))

tmp$source <- as.numeric(factor(tmp[['source']], tmplevs)) - 1 
tmp$target <- as.numeric(factor(tmp[['target']], tmplevs)) - 1

times <- as.numeric(x$date[match(tmplevs, x$id)])
lats  <- x$lat[match(tmplevs, x$id)]
lons  <- x$lon[match(tmplevs, x$id)]

cat(jsonlite::toJSON(list(
    meta = list(
        time = list(
            min = min(times, na.rm = T),
            max = max(times, na.rm = T)    
        ),
        lat = list(
            min = min(lats, na.rm = T),
            max = max(lats, na.rm = T)  
        ),
        lon = list(
            min = min(lons, na.rm = T),
            max = max(lons, na.rm = T)  
        )
    ),
    network = list(
        nodes = data.frame(
            name = tmplevs,
            time = as.numeric(x$date[match(tmplevs, x$id)]),
            lat  = x$lat[match(tmplevs, x$id)],
            lon  = x$lon[match(tmplevs, x$id)],
            path = paste0('/images/', tmplevs, '.jpg')
        ),
        links = tmp[,c('source', 'target', 'sim')]
    )
)), file = '~/projects/software/grapher/examples/preakness.json')

