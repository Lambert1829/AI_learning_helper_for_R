/* Terminal-style code blocks: R syntax highlighting, line numbers and output colouring.
   Watches the page and upgrades every `.code-wrap pre` once, so codeBlock() callers in
   app.js, the learning center and the knowledge supplements need no changes. The text
   content of <pre> stays identical, so copy buttons and selection copy the original code. */
const KEYWORDS = new Set(['if', 'else', 'repeat', 'while', 'function', 'for', 'in', 'next', 'break', 'return', 'library', 'require']);
const CONSTANTS = new Set(['TRUE', 'FALSE', 'NULL', 'NA', 'NaN', 'Inf', 'T', 'F', 'NA_integer_', 'NA_real_', 'NA_character_']);
const TOKEN = new RegExp([
  '(?<comment>#[^\\n]*)',
  '(?<string>"(?:[^"\\\\\\n]|\\\\.)*"?|\'(?:[^\'\\\\\\n]|\\\\.)*\'?)',
  '(?<number>(?<![\\w.])(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?L?)',
  '(?<op><<-|->>|<-|->|\\|>|%[^%\\n]*%|==|!=|<=|>=|&&|\\|\\||[-+*/^~$@:=<>!&|?])',
  '(?<word>[A-Za-z.][\\w.]*)',
].join('|'), 'g');
const MAX_CHARS = 20000;

function span(text, className) {
  if (!className) return document.createTextNode(text);
  const node = document.createElement('span');
  node.className = className; node.textContent = text;
  return node;
}

/* Returns DocumentFragment-ready tokens for one line of R code. */
export function tokenize(line) {
  const parts = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    if (match.index > last) parts.push([line.slice(last, match.index), '']);
    const g = match.groups, text = match[0];
    let kind = '';
    if (g.comment) kind = 'tk-com';
    else if (g.string) kind = 'tk-str';
    else if (g.number) kind = 'tk-num';
    else if (g.op) kind = 'tk-op';
    else if (g.word) {
      const rest = line.slice(match.index + text.length);
      if (KEYWORDS.has(text)) kind = 'tk-key';
      else if (CONSTANTS.has(text)) kind = 'tk-const';
      else if (/^\s*\(/.test(rest)) kind = 'tk-fn';
      else if (/^\s*=(?!=)/.test(rest)) kind = 'tk-arg';
    }
    parts.push([text, kind]);
    last = match.index + text.length;
  }
  if (last < line.length) parts.push([line.slice(last), '']);
  return parts;
}

function outputClass(line) {
  if (/^\s*(Error|错误)/.test(line)) return 'out-err';
  if (/^\s*(Warning|In |警告)/.test(line)) return 'out-warn';
  return '';
}

export function upgrade(pre) {
  if (pre.dataset.terminal) return;
  const wrap = pre.closest('.code-wrap');
  const label = wrap?.querySelector('.code-heading span')?.textContent || '';
  const text = pre.textContent;
  pre.dataset.terminal = 'done';
  wrap?.classList.add('terminal');
  if (!text || text.length > MAX_CHARS) return;
  const isOutput = /输出|output/i.test(label);
  wrap?.classList.toggle('terminal-output', isOutput);
  const lines = text.split('\n');
  const fragment = document.createDocumentFragment();
  lines.forEach((line, index) => {
    const row = document.createElement('span');
    row.className = 'tl' + (isOutput ? ' ' + outputClass(line) : '');
    if (isOutput) row.textContent = line;
    else for (const [part, kind] of tokenize(line)) row.append(span(part, kind));
    fragment.append(row);
    if (index < lines.length - 1) fragment.append('\n');
  });
  pre.classList.toggle('numbered', !isOutput && lines.length > 1);
  pre.replaceChildren(fragment);
}

function scan(root) {
  if (root.nodeType !== 1) return;
  if (root.matches?.('.code-wrap pre')) upgrade(root);
  root.querySelectorAll?.('.code-wrap pre:not([data-terminal])').forEach(upgrade);
}

export function initTerminal() {
  if (!document.querySelector('link[data-code-terminal]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/static/code-terminal.css?v=learning-v1';
    link.dataset.codeTerminal = ''; document.head.append(link);
  }
  scan(document.body);
  new MutationObserver(records => {
    for (const record of records) record.addedNodes.forEach(scan);
  }).observe(document.body, {childList:true, subtree:true});
}
