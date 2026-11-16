stu <- data.frame(id = c("S01", "S02", "S03"), name = c("Ann", "Ben", "Cai"))
grade <- data.frame(id = c("S01", "S01", "S03", "S04"),
                    course = c("FIN", "ACC", "FIN", "ECO"),
                    score = c(88, 92, 75, 60))
print(anyDuplicated(stu$id))
m <- merge(stu, grade, by = "id")
m <- m[order(m$id, m$course), ]
rownames(m) <- NULL
print(m)
print(setdiff(grade$id, stu$id))
