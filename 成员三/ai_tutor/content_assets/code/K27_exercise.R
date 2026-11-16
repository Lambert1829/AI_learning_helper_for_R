stu <- data.frame(id = c(1, 2, 3, 4), name = c("Ann", "Ben", "Cai", "Dan"))
sc <- data.frame(id = c(2, 4, 1), score = c(88, 95, 70))
joined <- merge(stu, sc, by = "id", all.x = TRUE)
print(nrow(joined))
print(sum(is.na(joined$score)))
ranked <- joined[order(joined$score, decreasing = TRUE, na.last = TRUE), c("name", "score")]
print(ranked)
