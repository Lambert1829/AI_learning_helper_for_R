d <- data.frame(group=c("A","A","B"),score=c(80,100,60))
print(aggregate(d$score,list(group=d$group),mean))
print(tapply(d$score,d$group,mean))
