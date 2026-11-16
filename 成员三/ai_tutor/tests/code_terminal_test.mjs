import assert from 'node:assert/strict';
import test from 'node:test';
const {tokenize} = await import('../static/code-terminal.js');
const kinds = line => tokenize(line).filter(([, k]) => k).map(([t, k]) => `${k}:${t}`);

test('tokens keep the original text exactly', () => {
  for (const line of ['x <- c(1, NA, 3)  # 缺失', 'd[d$score >= 85 & !is.na(d$score), , drop = FALSE]',
    'paste0("a\\"b", \'c\')', 'A %*% t(B) |> print()', '1e-3 + .5 - 2L', 'f <- function(x, ...) if (x) TRUE else NULL', '"unterminated']) {
    assert.equal(tokenize(line).map(([t]) => t).join(''), line);
  }
});

test('R syntax classes', () => {
  assert.deepEqual(kinds('x <- mean(v, na.rm = TRUE) # avg'),
    ['tk-op:<-', 'tk-fn:mean', 'tk-arg:na.rm', 'tk-op:=', 'tk-const:TRUE', 'tk-com:# avg']);
  assert.deepEqual(kinds('if (n == 0) return(NULL)'),
    ['tk-key:if', 'tk-op:==', 'tk-num:0', 'tk-key:return', 'tk-const:NULL']);
  assert.deepEqual(kinds('x %in% c("a", \'b\') & y != 1.5e2'),
    ['tk-op:%in%', 'tk-fn:c', 'tk-str:"a"', "tk-str:'b'", 'tk-op:&', 'tk-op:!=', 'tk-num:1.5e2']);
  assert.deepEqual(kinds('s <- "# not a comment"'), ['tk-op:<-', 'tk-str:"# not a comment"']);
  assert.deepEqual(kinds('x2 <- y.1'), ['tk-op:<-']);
});
