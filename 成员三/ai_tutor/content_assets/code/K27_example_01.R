x <- data.frame(id=1:3,score=c(80,90,70)); y <- data.frame(id=c(2,3),group=c("A","B"))
z <- merge(x,y,by="id",all.x=TRUE)
print(z); print(x[order(x$score,decreasing=TRUE),])
