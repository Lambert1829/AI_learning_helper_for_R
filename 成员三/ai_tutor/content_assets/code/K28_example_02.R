d <- data.frame(id = 1:5, score = c(80, NA, 95, 70, 88),
                note = c(NA, "late", NA, NA, "ok"))
print(nrow(na.omit(d)))
print(sum(complete.cases(d)))
kept <- d[!is.na(d$score), ]
print(nrow(kept))
print(round(mean(kept$score), 2))
