/* Answer feedback: per-answer rating, a local quality dashboard and CSV export.
   Everything stays in this browser (localStorage). The export feeds the answer-quality
   evaluation table; no feedback is sent to the server. */
const KEY = 'r-tutor-answer-feedback-v1';
const LIMIT = 500;
const REASONS = ['讲解有误', '没讲清楚', '代码有问题', '与问题无关', '篇幅不合适'];
const TASKS = {concept:'概念', function:'函数', debug:'纠错', exercise:'练习', auto:'问答'};
const SVG_NS = 'http://www.w3.org/2000/svg';
let dialog = null;

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    return data && data.version === 1 && data.items && typeof data.items === 'object' ? data : {version:1, items:{}};
  } catch { return {version:1, items:{}}; }
}
function persist(data) {
  const entries = Object.entries(data.items).sort((a, b) => a[1].at.localeCompare(b[1].at));
  data.items = Object.fromEntries(entries.slice(-LIMIT));
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}
export function feedbackEntries() {
  return Object.values(load().items).sort((a, b) => b.at.localeCompare(a.at));
}
function keyOf(record) {
  return record.response?.request_id || record.id || [record.time, record.request?.question].join('|');
}
function excerpt(answer) {
  const text = answer?.summary || answer?.content_markdown || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}
function save(record, rating, reasons = [], note = '') {
  const data = load(), r = record.response || {};
  data.items[keyOf(record)] = {
    id:keyOf(record), at:new Date().toISOString(), rating, reasons, note:note.trim().slice(0, 300),
    question:(record.display_question || record.request?.question || '代码纠错').slice(0, 300),
    task_type:r.task_type || record.request?.task_type || 'auto', mode:r.mode || 'mock',
    model:[r.provider, r.model].filter(Boolean).join(' · '), knowledge:(r.related_knowledge || []).slice(0, 4),
    case_id:r.matched_case_id || '', status:r.status || '', answer_excerpt:excerpt(r.answer)
  };
  return persist(data);
}
function remove(record) {
  const data = load(); delete data.items[keyOf(record)]; persist(data);
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function icon(path) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(SVG_NS, 'path'); shape.setAttribute('d', path);
  svg.append(shape); return svg;
}
const UP = 'M7 11v9H4v-9h3zm2 9V10l4.5-7c1.2 0 2 1 1.8 2.2L14.6 9H19c1.1 0 2 .9 2 2l-1.6 7.2c-.2.9-1 1.6-2 1.6H9z';
const DOWN = 'M17 13V4h3v9h-3zm-2-9v10l-4.5 7c-1.2 0-2-1-1.8-2.2L9.4 15H5c-1.1 0-2-.9-2-2l1.6-7.2c.2-.9 1-1.6 2-1.6H15z';

/* Inline strip under one answer. */
export function mountFeedback(container, record) {
  if (!record?.response?.answer) return;
  const strip = node('div', undefined, 'fb-strip');
  strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', '回答反馈');
  container.append(strip);
  render();

  function render() {
    strip.replaceChildren();
    strip.classList.remove('fb-done', 'fb-open');
    const existing = load().items[keyOf(record)];
    if (existing) {
      strip.classList.add('fb-done');
      const label = existing.rating > 0 ? '已标记为有帮助' : '已记录改进意见' + (existing.reasons.length ? '：' + existing.reasons.join('、') : '');
      const undo = node('button', '撤销', 'fb-link');
      undo.type = 'button';
      undo.addEventListener('click', () => { remove(record); render(); });
      strip.append(node('span', '', 'fb-pulse'), node('span', label, 'fb-state'), undo);
      return;
    }
    strip.append(node('span', '这条回答有帮助吗？', 'fb-ask'));
    const yes = node('button', undefined, 'fb-chip fb-up'), no = node('button', undefined, 'fb-chip fb-down');
    yes.type = no.type = 'button';
    yes.append(icon(UP), node('span', '有帮助')); no.append(icon(DOWN), node('span', '需改进'));
    yes.addEventListener('click', () => { save(record, 1); render(); });
    no.addEventListener('click', () => openReasons(no));
    strip.append(yes, no);
  }

  function openReasons(trigger) {
    strip.classList.add('fb-open');
    trigger.setAttribute('aria-expanded', 'true');
    const panel = node('div', undefined, 'fb-panel');
    const picks = node('div', undefined, 'fb-reasons');
    const chosen = new Set();
    for (const reason of REASONS) {
      const chip = node('button', reason, 'fb-reason');
      chip.type = 'button'; chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => {
        chosen.has(reason) ? chosen.delete(reason) : chosen.add(reason);
        chip.setAttribute('aria-pressed', String(chosen.has(reason)));
      });
      picks.append(chip);
    }
    const note = node('textarea', undefined, 'fb-note');
    note.rows = 2; note.maxLength = 300; note.placeholder = '可选：具体哪里有问题？';
    note.setAttribute('aria-label', '补充说明');
    const submit = node('button', '提交反馈', 'fb-submit'), cancel = node('button', '取消', 'fb-link');
    submit.type = cancel.type = 'button';
    submit.addEventListener('click', () => { save(record, -1, [...chosen], note.value); render(); });
    cancel.addEventListener('click', render);
    const row = node('div', undefined, 'fb-actions'); row.append(submit, cancel);
    panel.append(picks, note, row);
    strip.querySelector('.fb-panel')?.remove();
    strip.append(panel);
    picks.querySelector('button')?.focus();
  }
}

/* CSV for spreadsheets: UTF-8 BOM, CRLF, quoted cells, formula-like cells neutralised. */
function cell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function feedbackCsv(entries = feedbackEntries()) {
  const head = ['时间', '评价', '原因', '补充说明', '问题', '任务类型', '模式', '模型', '相关知识点', '匹配案例', '回答摘要', '请求编号'];
  const rows = entries.map(e => [e.at, e.rating > 0 ? '有帮助' : '需改进', e.reasons.join('、'), e.note, e.question,
    TASKS[e.task_type] || e.task_type, e.mode, e.model, e.knowledge.join(' '), e.case_id, e.answer_excerpt, e.id]);
  return '﻿' + [head, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], {type:'text/csv;charset=utf-8'}));
  const link = node('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function summarize(entries = feedbackEntries()) {
  const total = entries.length, up = entries.filter(e => e.rating > 0).length;
  const count = (list, pick) => list.reduce((acc, e) => { for (const k of pick(e)) acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const byTask = {};
  for (const e of entries) {
    const t = TASKS[e.task_type] || e.task_type;
    byTask[t] = byTask[t] || {up:0, total:0}; byTask[t].total++; if (e.rating > 0) byTask[t].up++;
  }
  return {total, up, down:total - up, rate:total ? up / total : 0, byTask,
    reasons:count(entries.filter(e => e.rating < 0), e => e.reasons.length ? e.reasons : ['未注明']),
    recentDown:entries.filter(e => e.rating < 0).slice(0, 5)};
}

function gauge(rate, total) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200'); svg.setAttribute('class', 'fbq-gauge');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', total ? `好评率${Math.round(rate * 100)}%` : '暂无反馈');
  const make = (tag, attrs) => { const e = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); svg.append(e); return e; };
  const C = 2 * Math.PI * 80;
  make('circle', {cx:100, cy:100, r:92, class:'fbq-orbit'});
  make('circle', {cx:100, cy:100, r:80, class:'fbq-track'});
  if (rate > 0) make('circle', {cx:100, cy:100, r:80, class:'fbq-arc', 'stroke-dasharray':`${(C * rate).toFixed(1)} ${C.toFixed(1)}`, transform:'rotate(-90 100 100)'});
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * 2 * Math.PI, r1 = 64, r2 = i % 5 ? 67 : 70;
    make('line', {x1:100 + r1 * Math.cos(a), y1:100 + r1 * Math.sin(a), x2:100 + r2 * Math.cos(a), y2:100 + r2 * Math.sin(a), class:'fbq-tick'});
  }
  const value = make('text', {x:100, y:104, class:'fbq-value'}); value.textContent = total ? Math.round(rate * 100) + '%' : '—';
  const label = make('text', {x:100, y:130, class:'fbq-label'}); label.textContent = '好评率';
  return svg;
}
function bars(title, rows, total, tone) {
  const section = node('section', undefined, 'fbq-card');
  section.append(node('h3', title));
  if (!rows.length) { section.append(node('p', '暂无数据', 'fbq-empty')); return section; }
  for (const [name, value, hint] of rows) {
    const row = node('div', undefined, 'fbq-bar');
    const meter = node('div', undefined, 'fbq-meter ' + tone);
    const fill = node('span'); fill.style.setProperty('--fill', (total ? value / total * 100 : 0).toFixed(1) + '%');
    meter.append(fill);
    row.append(node('span', name, 'fbq-name'), meter, node('span', hint ?? String(value), 'fbq-num'));
    section.append(row);
  }
  return section;
}

function renderDashboard() {
  const s = summarize(), body = dialog.querySelector('.fbq-body');
  body.replaceChildren();
  const hero = node('div', undefined, 'fbq-hero');
  const tiles = node('div', undefined, 'fbq-tiles');
  for (const [label, value, tone] of [['反馈总数', s.total, ''], ['有帮助', s.up, 'up'], ['需改进', s.down, 'down']]) {
    const tile = node('div', undefined, 'fbq-tile ' + tone);
    tile.append(node('strong', String(value)), node('span', label));
    tiles.append(tile);
  }
  hero.append(gauge(s.rate, s.total), tiles);
  body.append(hero);
  const tasks = Object.entries(s.byTask).sort((a, b) => b[1].total - a[1].total)
    .map(([name, v]) => [name, v.up, `${v.up}/${v.total}`]);
  const maxTask = Math.max(1, ...Object.values(s.byTask).map(v => v.total));
  const grid = node('div', undefined, 'fbq-grid');
  grid.append(bars('各类任务好评', tasks, maxTask, 'up'),
    bars('改进原因分布', Object.entries(s.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]), Math.max(1, s.down), 'down'));
  body.append(grid);
  const recent = node('section', undefined, 'fbq-card fbq-recent');
  recent.append(node('h3', '最近的改进意见'));
  if (!s.recentDown.length) recent.append(node('p', s.total ? '目前没有改进意见。' : '还没有反馈。在AI问答或代码纠错的回答下方点选即可记录。', 'fbq-empty'));
  for (const e of s.recentDown) {
    const item = node('article', undefined, 'fbq-item');
    item.append(node('p', e.question, 'fbq-q'),
      node('p', [e.reasons.join('、') || '未注明原因', e.note].filter(Boolean).join(' · '), 'fbq-why'),
      node('time', new Date(e.at).toLocaleString('zh-CN', {hour12:false}), 'fbq-time'));
    recent.append(item);
  }
  body.append(recent);
  dialog.querySelector('.fbq-export').disabled = !s.total;
  dialog.querySelector('.fbq-clear').disabled = !s.total;
}

function buildDialog() {
  dialog = node('dialog', undefined, 'fbq');
  dialog.setAttribute('aria-labelledby', 'fbq-title');
  const head = node('div', undefined, 'fbq-head');
  const titles = node('div');
  titles.append(node('p', 'ANSWER QUALITY · LOCAL', 'fbq-kicker'), node('h2', '回答质量看板'));
  titles.lastChild.id = 'fbq-title';
  const close = node('button', '关闭 ×', 'fbq-close'); close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  head.append(titles, close);
  const body = node('div', undefined, 'fbq-body');
  const foot = node('div', undefined, 'fbq-foot');
  const note = node('p', '反馈只保存在本浏览器，可导出为表格用于回答质量评价。', 'fbq-footnote');
  const exportButton = node('button', '导出CSV', 'fbq-export'), clear = node('button', '清空反馈', 'fbq-clear');
  exportButton.type = clear.type = 'button';
  exportButton.addEventListener('click', () => download(feedbackCsv(), `回答反馈_${new Date().toISOString().slice(0, 10)}.csv`));
  clear.addEventListener('click', () => {
    if (!confirm('清空本浏览器中的全部回答反馈？此操作不可撤销。')) return;
    try { localStorage.removeItem(KEY); } catch {}
    renderDashboard();
    document.dispatchEvent(new CustomEvent('answer-feedback-cleared'));
  });
  const buttons = node('div', undefined, 'fbq-buttons'); buttons.append(clear, exportButton);
  foot.append(note, buttons);
  dialog.append(head, body, foot);
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
}
export function openDashboard() {
  if (!dialog) buildDialog();
  renderDashboard();
  dialog.showModal();
}

/* Adds the dashboard entry to the "更多" menu and loads the stylesheet. */
export function initFeedback({menu = document.getElementById('more-panel'), onOpen} = {}) {
  if (!document.querySelector('link[data-answer-feedback]')) {
    const link = node('link'); link.rel = 'stylesheet'; link.href = '/static/answer-feedback.css?v=learning-v1';
    link.dataset.answerFeedback = ''; document.head.append(link);
  }
  if (menu && !menu.querySelector('#feedback-open')) {
    const entry = node('button', '回答质量看板'); entry.id = 'feedback-open'; entry.type = 'button';
    entry.addEventListener('click', () => { onOpen?.(); openDashboard(); });
    const anchor = menu.querySelector('#version-open');
    anchor ? menu.insertBefore(entry, anchor) : menu.append(entry);
  }
}
