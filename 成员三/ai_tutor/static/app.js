'use strict';
const $ = id => document.getElementById(id);
const STORE = 'r-tutor-mock-v1';
const UNITS = ['环境与自助学习','类型与缺失','向量与字符串','矩阵与数组','数据框','列表与批量处理','函数与控制','综合与包扩展'];
const mobile = matchMedia('(max-width:760px)');
let records = [], knowledge = [], activeId = null, busy = false;
let openUnit = null, desktopCollapsed = false, drawerOpen = false, codeOpen = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || '[]');
  if (Array.isArray(saved)) records = saved.filter(x => x?.request && typeof x?.response?.answer?.summary === 'string').slice(-100);
} catch { records = []; }
activeId = records.at(-1)?.response.related_knowledge?.[0] || null;

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function button(text, action, cls, request = false) {
  const b = el('button', text, cls);
  b.type = 'button'; b.onclick = action;
  if (request) { b.dataset.request = 'true'; b.disabled = busy; }
  return b;
}
function details(title, cls = '') {
  const node = el('details', undefined, 'secondary-details ' + cls);
  node.append(el('summary', title));
  return node;
}
function status(text = '', error = false) {
  $('status').textContent = text;
  $('status').hidden = !text;
  $('status').classList.toggle('error', error);
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(records)); return true; }
  catch { status('浏览器存储不可用，当前记录仍可导出。', true); return false; }
}
async function api(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? {'Content-Type': 'application/json'} : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });
  let data;
  try { data = await response.json(); } catch { throw Error('服务返回了无法读取的响应'); }
  if (!response.ok) throw Error(data.error?.message || '请求失败（' + response.status + '）');
  return data;
}
function showError(error) {
  status(error.name === 'TypeError' ? '无法连接本地服务，请启动服务后重试。' :
    error.name === 'TimeoutError' ? '请求超时，请重试。' : error.message, true);
}
function setBusy(value) {
  busy = value;
  for (const id of ['send','question','code','error-message','code-toggle','clear']) $(id).disabled = value;
  document.querySelectorAll('[data-request]').forEach(b => { b.disabled = value; });
  $('send').textContent = value ? '发送中…' : '发送 ↑';
}
function setCode(value) {
  codeOpen = value;
  $('code-panel').hidden = !value;
  $('code-toggle').textContent = value ? '− 收起代码' : '＋ 添加代码';
  $('code-toggle').setAttribute('aria-expanded', String(value));
}
function setMore(value, focus = false) {
  $('more-panel').hidden = !value;
  $('more-toggle').setAttribute('aria-expanded', String(value));
  if (focus) (value ? $('more-panel').querySelector('a') : $('more-toggle')).focus();
}
function updateSidebar() {
  $('layout').classList.toggle('sidebar-collapsed', !mobile.matches && desktopCollapsed);
  $('layout').classList.toggle('drawer-open', mobile.matches && drawerOpen);
  $('drawer-backdrop').hidden = !(mobile.matches && drawerOpen);
  const visible = mobile.matches ? drawerOpen : !desktopCollapsed;
  $('sidebar').inert = !visible;
  $('catalog-toggle').setAttribute('aria-expanded', String(visible));
  $('workspace').inert = mobile.matches && drawerOpen;
  document.querySelector('.app-header').inert = mobile.matches && drawerOpen;
  if (mobile.matches && drawerOpen) {
    $('sidebar').setAttribute('role', 'dialog'); $('sidebar').setAttribute('aria-modal', 'true');
  } else {
    $('sidebar').removeAttribute('role'); $('sidebar').removeAttribute('aria-modal');
  }
}
function toggleSidebar(force) {
  if (mobile.matches) drawerOpen = force === undefined ? !drawerOpen : force;
  else desktopCollapsed = force === undefined ? !desktopCollapsed : !force;
  updateSidebar();
  if (mobile.matches && drawerOpen) $('sidebar-close').focus();
  else if (force === false) $('catalog-toggle').focus();
}
function selectTopic(id) {
  activeId = id || null;
  const k = knowledge.find(k => k.id === activeId);
  $('current-topic').textContent = k ? k.id + ' · ' + k.title : '自由提问';
  $('current-topic').title = $('current-topic').textContent;
  openUnit = k?.chapter || null;
  renderCatalog();
}
function renderCatalog() {
  const query = $('search').value.trim().toLowerCase();
  const matches = knowledge.filter(k => (k.id + ' ' + k.title).toLowerCase().includes(query));
  const root = $('catalog'); root.replaceChildren();
  $('catalog-empty').hidden = !!matches.length;
  for (const unit of UNITS) {
    const items = matches.filter(k => k.chapter === unit);
    if (!items.length) continue;
    const group = el('details', undefined, 'unit');
    group.dataset.unit = unit;
    group.open = !!query || openUnit === unit;
    group.append(el('summary', unit));
    group.addEventListener('toggle', () => {
      if (!group.isConnected) return;
      if (!query && group.open) {
        openUnit = unit;
        root.querySelectorAll('.unit').forEach(other => { if (other !== group) other.open = false; });
      }
    });
    for (const k of items) {
      const b = button(undefined, () => explainKnowledge(k.id), k.id === activeId ? 'active' : '', true);
      b.append(el('span', k.id), el('span', k.title));
      if (k.id === activeId) b.setAttribute('aria-current', 'true');
      group.append(b);
    }
    root.append(group);
  }
}
function codeBlock(parent, text, label, unverified = false) {
  if (!text) return;
  const wrap = el('div', undefined, 'code-wrap');
  const heading = el('div', undefined, 'code-heading');
  heading.append(el('span', label));
  if (unverified) heading.append(el('span', '未运行验证', 'unverified'));
  const copy = button('复制代码', async () => {
    try { await navigator.clipboard.writeText(text); copy.textContent = '已复制'; }
    catch { status('复制失败，请手动选中代码复制。', true); }
  }, 'copy');
  heading.append(copy); wrap.append(heading, el('pre', text)); parent.append(wrap);
}
function firstSentence(text) {
  const match = text.match(/^.*?[。！？](?=\s|[^\x00-\x7F]|$)|^[^\n]+\n/u);
  return match ? match[0].trim() : text;
}
function renderRecords() {
  const root = $('messages'); root.replaceChildren();
  $('welcome').hidden = records.length > 0;
  for (const record of records) {
    const r = record.response, a = r.answer;
    const card = el('article', undefined, 'message');
    const user = el('div', undefined, 'question-group');
    user.append(el('p', record.display_question || record.request.question || '审查提交的R代码', 'question'));
    if (record.request.code || record.request.error_message) {
      const submitted = details('查看提交的代码与报错', 'user-code');
      codeBlock(submitted, record.request.code, '提交的代码');
      if (record.request.error_message) submitted.append(el('pre', record.request.error_message));
      user.append(submitted);
    }
    card.append(user);
    const assistant = el('div', undefined, 'assistant-answer');
    assistant.append(el('p', '助教', 'answer-label'));
    const issue = a.issues?.[0];
    const direct = firstSentence(issue?.reason || a.summary);
    assistant.append(el('h2', direct, 'answer-heading'));
    const steps = el('ol', undefined, 'steps');
    (a.steps || []).slice(0,3).forEach(t => {
      const text = issue && t === issue.reason ?
        '问题类型：' + ({error:'运行错误',warning:'警告',logic:'逻辑错误'}[issue.kind] || issue.kind) +
        (issue.line == null ? '。' : '；位置：第' + issue.line + '行。') : t;
      steps.append(el('li', text));
    });
    if (steps.childElementCount) assistant.append(steps);
    codeBlock(assistant, a.corrected_code || a.example_code, a.corrected_code ? '参考修正' : '代码示例', true);
    const follow = el('div', undefined, 'followups');
    (a.follow_ups || []).forEach(t => follow.append(button(t, () => {
      setCode(false);
      send(t, {knowledgeId: r.related_knowledge?.[0] || null, useComposer: false});
    }, '', true)));
    if (r.task_type === 'exercise' && record.request.teaching_mode !== 'solution' && r.status === 'ok') {
      follow.append(button('查看参考答案', () => {
        setCode(false);
        send(record.request.question, {knowledgeId:r.related_knowledge?.[0] || null, useComposer:false, solution:true});
      }, 'solution', true));
    }
    if (follow.childElementCount) assistant.append(follow);
    const extra = issue ? a.summary : a.summary.slice(direct.length).trim();
    if (extra || (a.issues || []).length || (a.steps || []).length > 3) {
      const explanation = details('补充讲解', 'explanation');
      if (extra) explanation.append(el('p', extra));
      (a.steps || []).slice(3).forEach(t => explanation.append(el('p',t)));
      (a.issues || []).forEach(i => explanation.append(el('p', i.kind + (i.line == null ? '' : ' · 第' + i.line + '行') + '：' + i.reason)));
      assistant.append(explanation);
    }
    if (a.expected_output) {
      const output = details('资料中的参考输出', 'reference-output');
      output.append(el('pre',a.expected_output)); assistant.append(output);
    }
    if ((r.citations || []).length) {
      const sources = details('资料来源', 'sources');
      for (const c of r.citations) {
        const row = el('div', undefined, 'source-row');
        row.append(button(c.knowledge_id, () => explainKnowledge(c.knowledge_id), '', true),
          el('span', c.file + ' · ' + c.locator));
        sources.append(row);
      }
      assistant.append(sources);
    }
    card.append(assistant); root.append(card);
  }
}
function scrollToLatest() {
  const card = $('messages').lastElementChild;
  if (card) $('conversation-scroll').scrollTop += card.getBoundingClientRect().top - $('conversation-scroll').getBoundingClientRect().top - 16;
}
async function send(question, options = {}) {
  if (busy) return;
  const useComposer = options.useComposer !== false;
  const q = (question ?? $('question').value).trim();
  const includeCode = useComposer && codeOpen;
  const code = includeCode ? $('code').value : '';
  const error = includeCode ? $('error-message').value : '';
  if (!q && !code.trim()) { status('请先输入问题或代码。', true); $('question').focus(); return; }
  const body = {
    session_id:'local-browser', question:q, task_type:includeCode ? 'debug' : 'auto',
    code, error_message:error,
    knowledge_id:options.knowledgeId === undefined ? activeId : options.knowledgeId,
    teaching_mode:options.solution ? 'solution' : 'hint',
    history:records.slice(-6).flatMap(x => [
      {role:'user',content:(x.request.question || '').slice(0,2000)},
      {role:'assistant',content:x.response.answer.summary.slice(0,1500)}
    ])
  };
  setBusy(true); status('正在查询…');
  try {
    const response = await api(includeCode ? '/api/review' : '/api/chat', body);
    records.push({time:new Date().toISOString(), request:body, response,
      ...(options.displayQuestion ? {display_question:options.displayQuestion} : {})});
    records = records.slice(-100);
    renderRecords(); selectTopic(response.related_knowledge?.[0] || null);
    if (useComposer) $('question').value = '';
    if (save()) status();
    scrollToLatest();
  } catch (e) { showError(e); }
  finally { setBusy(false); }
}
function explainKnowledge(id) {
  if (busy) return;
  setCode(false);
  if (mobile.matches) toggleSidebar(false);
  const k = knowledge.find(k => k.id === id);
  send('讲解这个知识点', {knowledgeId:id,useComposer:false,displayQuestion:'讲解 ' + id + (k ? ' · ' + k.title : '')});
}

$('ask-form').onsubmit = e => { e.preventDefault(); send(); };
$('code-toggle').onclick = () => { setCode(!codeOpen); if (codeOpen) $('code').focus(); };
$('catalog-toggle').onclick = () => toggleSidebar();
$('sidebar-close').onclick = () => toggleSidebar(false);
$('drawer-backdrop').onclick = () => toggleSidebar(false);
$('search').oninput = renderCatalog;
$('more-toggle').onclick = () => setMore($('more-panel').hidden);
$('more-toggle').onkeydown = e => { if (e.key === 'ArrowDown') { e.preventDefault(); setMore(true,true); } };
document.addEventListener('click', e => { if (!e.target.closest('.more-wrap')) setMore(false); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (mobile.matches && drawerOpen) { toggleSidebar(false); e.preventDefault(); }
    if (!$('more-panel').hidden) { setMore(false,true); e.preventDefault(); }
  }
  if (e.key === 'Tab' && mobile.matches && drawerOpen) {
    const focusable = [...$('sidebar').querySelectorAll('button:not(:disabled),input,summary')].filter(n => n.getClientRects().length && n.checkVisibility());
    const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
mobile.addEventListener('change', () => { drawerOpen = false; updateSidebar(); });
$('version-open').onclick = () => { setMore(false); $('version-dialog').showModal(); };
$('version-close').onclick = () => $('version-dialog').close();
$('version-dialog').addEventListener('close', () => $('more-toggle').focus());
$('clear').onclick = () => {
  if (busy) return;
  records = []; setMore(false); setCode(false); selectTopic(null); renderRecords();
  if (save()) status();
  $('question').focus();
};
$('export').onclick = () => {
  setMore(false);
  const blob = new Blob([JSON.stringify({mode:'mock',records},null,2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob), link = el('a');
  link.href = url; link.download = 'R语言学习记录.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.querySelectorAll('[data-example]').forEach(b => {
  b.dataset.request = 'true'; b.onclick = () => { setCode(false); send(b.dataset.example,{useComposer:false}); };
});
$('debug-example').dataset.request = 'true';
$('debug-example').onclick = () => {
  setCode(true); $('code').value = 'x <- c(1, NA, 3)\nx[x == NA]'; $('error-message').value = '';
  send('为什么不能用x == NA判断缺失？');
};
renderRecords(); updateSidebar();
Promise.all([api('/api/health'),api('/api/knowledge')]).then(([health,data]) => {
  knowledge = data.items;
  $('version-number').textContent = '应用 ' + health.version + ' · 知识版本 ' + health.knowledge_version;
  selectTopic(activeId);
}).catch(() => status('无法连接本地服务，请启动服务后刷新。', true));

