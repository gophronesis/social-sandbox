system.time({
    x <- read.csv('baltimore_features_v2.csv', sep = '\t', header = T, as.is = T)    
    x <- x[,-1]
    saveRDS(x, 'baltimore_features_v2.rds')
})

