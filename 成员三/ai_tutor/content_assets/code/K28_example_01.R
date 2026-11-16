d <- data.frame(id=1:3,score=c(80,NA,100))
d$was_missing <- is.na(d$score)
d$score[d$was_missing] <- mean(d$score,na.rm=TRUE)
print(d)
