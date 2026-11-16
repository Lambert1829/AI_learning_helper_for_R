d <- data.frame(id = c("S01", "S02", "S03", "S04", "S05"),
                score = c(92, NA, 78, 85, 60))
ok <- !is.na(d$score) & d$score >= 80
print(d[ok, ])
d$bonus <- d$score + 5
print(d[c("id", "bonus")])
print(sum(ok))
