d <- data.frame(name = c("Ann", "Ben", "Cai", "Dan"),
                math = c(85, 72, NA, 90),
                eng = c(78, 88, 91, NA))
d$total <- d$math + d$eng
both <- !is.na(d$total) & d$math >= 80
print(d[both, c("name", "total"), drop = FALSE])
print(d[["eng"]])
print(colnames(d))
