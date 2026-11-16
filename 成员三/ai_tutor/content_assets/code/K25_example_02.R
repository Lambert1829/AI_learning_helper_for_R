d <- data.frame(id = c("S01", "S02", "S03", "S04"),
                major = c("FIN", "ACC", "FIN", "ECO"),
                score = c(88, 92, 75, 81),
                stringsAsFactors = FALSE)
print(dim(d))
print(names(d))
print(head(d, 2))
print(d[d$major == "FIN", ])
