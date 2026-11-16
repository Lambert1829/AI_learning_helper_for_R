w <- data.frame(id = c("A", "B"), y2025 = c(80, 70), y2026 = c(90, 85), y2027 = c(92, NA))
l <- reshape(w, varying = c("y2025", "y2026", "y2027"), v.names = "score", timevar = "year",
             times = 2025:2027, idvar = "id", direction = "long")
print(nrow(l))
print(sum(is.na(l$score)))
print(l[l$year == 2027, c("id", "score")])
