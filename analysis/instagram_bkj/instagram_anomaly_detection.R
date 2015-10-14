x <- read.csv('00-HSMM-data-baseball.csv', as.is = T)

df <- data.frame(table(x$hour_))
df$time <- df$Var1
df$lfreq <- log(df$Freq)
df$week_hour <- paste0(wday(df$time), '-', sprintf('%02d', hour(df$time)))

df$ave  <- ave(df$Freq, df$week_hour, FUN = median)
df$diff <- df$Freq - df$ave

s <- df
plot(jitter(hour(s$time)), s$Freq - ave(s$Freq, hour(s$time), FUN = median), cex = .5, 
    col = wday(s$time))


# >>
# With entire dataset

# Generate candidate events through some process
# Determine whether they are real events or not

geosubset <- function(df, min_lon, min_lat, max_lon, max_lat) {
    df$lat > min_lat & 
    df$lat < max_lat & 
    df$lon > min_lon & 
    df$lon < max_lon
}

options(stringsAsFactors = F)
require(plyr)
require(lubridate)
require(colorout)
require(AnomalyDetection)
require(doMC)

df      <- df.orig <- readRDS('data/df2.rds')
df      <- df[!is.na(df$time),]
df$date <- as.POSIXct(as.numeric(df$time), origin = "1970-01-01")

# By Hour
sel <- which(geosubset(df, -76.666203,39.296048,-76.619511,39.327924) & hour(df$date) > 10 & hour(df$date) < 20)
byh <- ldply(lapply(split(1:length(sel), format(df$date[sel], '%Y-%m-%d %H')), sum))
names(byh) <- c('hour', 'count')
byh$hour <- as.POSIXct(byh$hour, format = '%Y-%m-%d %H')

plot(byh, type = 'h')

sel <- byh$hour < '2015-06-01'
res <- AnomalyDetectionTs(byh[sel,], max_anoms=.10, plot=TRUE)
res
