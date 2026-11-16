d <- data.frame(id = 1:6, score = c(78, 85, 102, NA, 91, -5))
d$missing <- is.na(d$score)
d$out_of_range <- !d$missing & (d$score < 0 | d$score > 100)
print(d[d$missing | d$out_of_range, ])
clean <- d$score[!d$missing & !d$out_of_range]
print(c(valid = length(clean), mean = round(mean(clean), 2)))
