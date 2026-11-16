w <- data.frame(id = c("S01", "S02", "S03"), q1 = c(80, 72, 90), q2 = c(85, 70, 95))
l <- reshape(w, varying = c("q1", "q2"), v.names = "score", timevar = "quiz",
             times = c("q1", "q2"), idvar = "id", direction = "long")
l <- l[order(l$id, l$quiz), ]
rownames(l) <- NULL
print(l)
print(nrow(l))
print(mean(l$score[l$quiz == "q2"]))
