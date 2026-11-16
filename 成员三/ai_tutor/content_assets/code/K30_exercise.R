d <- data.frame(major = c("FIN", "ACC", "FIN", "ACC", "FIN"),
                score = c(88, 76, 92, NA, 81))
n <- tapply(!is.na(d$score), d$major, sum)
avg <- round(tapply(d$score, d$major, mean, na.rm = TRUE), 1)
top <- tapply(d$score, d$major, max, na.rm = TRUE)
print(rbind(n = n, mean = avg, max = top))
