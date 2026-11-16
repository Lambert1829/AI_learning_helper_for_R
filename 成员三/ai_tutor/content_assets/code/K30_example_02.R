d <- data.frame(class = c("A", "A", "A", "B", "B"), score = c(80, NA, 92, 75, 85))
print(tapply(d$score, d$class, mean, na.rm = TRUE))
print(tapply(!is.na(d$score), d$class, sum))
print(aggregate(d$score, list(class = d$class), max, na.rm = TRUE))
