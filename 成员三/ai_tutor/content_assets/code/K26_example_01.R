d <- data.frame(id=1:3,score=c(80,NA,90))
d$pass <- !is.na(d$score) & d$score>=85
print(d[d$pass,c("id","score"),drop=FALSE])
print(d["score"])
print(class(d$score))
print(class(d["score"]))
