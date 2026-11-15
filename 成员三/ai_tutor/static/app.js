'use strict';
const $ = id => document.getElementById(id);
const STORE = 'r-tutor-mock-v1';
const UNITS = ['环境与自助学习','类型与缺失','向量与字符串','矩阵与数组','数据框','列表与批量处理','函数与控制','综合与包扩展'];
const mobile = matchMedia('(max-width:760px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let records = [], knowledge = [], relations = [], activeId = null, busy = false;
let currentView = '', pendingRecord = null;
let skipNextHashRoute = false, activeViewTransition = null, routeSequence = 0;
const FOLLOW_LABELS = {'举个例子':'例题','有什么易错点':'易错点','给我练习':'练习'};
let codeOpen = false, freshContext = false;
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
  fileInput.locked = value;
  for (const id of ['send','question','code','error-message','code-toggle','clear','history-clear','file-pick','file-remove','code-clear','topic-clear']) $(id).disabled = value;
  document.querySelectorAll('[data-request]').forEach(b => { b.disabled = value; });
  $('send').textContent = value ? '发送中…' : '发送 ↑';
}
function setCode(value) {
  if (currentView === 'review') value = true;
  codeOpen = value;
  $('code-panel').hidden = !value;
  $('code-toggle').textContent = value ? '收起代码' : '添加代码';
  $('code-toggle').setAttribute('aria-expanded', String(value));
}
function setMore(value, focus = false) {
  $('more-panel').hidden = !value;
  $('more-toggle').setAttribute('aria-expanded', String(value));
  if (focus) (value ? $('more-panel').querySelector('a') : $('more-toggle')).focus();
}
function selectTopic(id) {
  activeId = id || null;
  const k = knowledge.find(k => k.id === activeId);
  $('current-topic').textContent = k ? k.id + ' · ' + k.title : '';
  $('topic-chip').hidden = !k;
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
  $('review-empty').hidden = records.some(record => record.response.task_type === 'debug');
  for (const [index, record] of records.entries()) {
    const r = record.response, a = r.answer;
    const card = el('article', undefined, 'message' + (r.task_type === 'debug' ? ' review-message' : ''));
    card.id = 'record-' + index; card.tabIndex = -1;
    const user = el('div', undefined, 'question-group');
    user.append(el('p', record.display_question || record.request.question || '审查提交的R代码', 'question'));
    if (record.request.code || record.request.error_message) {
      const submitted = details('提交内容', 'user-code');
      codeBlock(submitted, record.request.code, '提交的代码');
      if (record.request.error_message) submitted.append(el('pre', record.request.error_message));
      user.append(submitted);
    }
    card.append(user);
    const assistant = el('div', undefined, 'assistant-answer');
    assistant.append(el('p', r.task_type === 'debug' ? (r.matched_case_id ? '参考案例 · ' + r.matched_case_id : '代码纠错') : '助教', 'answer-label'));
    if (r.task_type === 'debug' && r.status === 'no_match') assistant.append(el('p','当前资料未匹配到可靠案例。请补充最小复现代码、完整报错和预期结果。','review-advice'));
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
    codeBlock(assistant, a.corrected_code || a.example_code, a.corrected_code ? '参考修正' : '代码讲解', true);
    const follow = el('div', undefined, 'followups');
    (a.follow_ups || []).forEach(t => follow.append(button(FOLLOW_LABELS[t] || '继续提问', () => {
      navigate('chat'); setCode(false);
      if (!FOLLOW_LABELS[t]) { $('question').focus(); return; }
      send(t, {knowledgeId: r.related_knowledge?.[0] || null, useComposer: false, displayQuestion: FOLLOW_LABELS[t]});
    }, '', true)));
    if (r.task_type === 'exercise' && record.request.teaching_mode !== 'solution' && r.status === 'ok') {
      follow.append(button('参考答案', () => {
        navigate('chat'); setCode(false);
        send(record.request.question, {knowledgeId:r.related_knowledge?.[0] || null, useComposer:false, solution:true, displayQuestion:'参考答案'});
      }, 'solution', true));
    }
    follow.append(button('继续提问', () => $('question').focus()));
    assistant.append(follow);
    const extra = issue ? a.summary : a.summary.slice(direct.length).trim();
    if (extra || (a.issues || []).length || (a.steps || []).length > 3) {
      const explanation = details('深入讲解', 'explanation');
      if (extra) explanation.append(el('p', extra));
      (a.steps || []).slice(3).forEach(t => explanation.append(el('p',t)));
      (a.issues || []).forEach(i => explanation.append(el('p', i.kind + (i.line == null ? '' : ' · 第' + i.line + '行') + '：' + i.reason)));
      assistant.append(explanation);
    }
    if (a.expected_output) {
      const output = details('参考输出', 'reference-output');
      output.append(el('pre',a.expected_output)); assistant.append(output);
    }
    if ((r.citations || []).length) {
      const sources = details('内容来源', 'sources');
      for (const c of r.citations) {
        const row = el('div', undefined, 'source-row');
        row.append(button(c.knowledge_id, () => explainKnowledge(c.knowledge_id), '', true),
          el('span', c.file + ' · ' + c.locator));
        sources.append(row);
      }
      assistant.append(sources);
    }
    if ((r.related_knowledge || []).length) {
      const related = details('相关知识', 'related-knowledge');
      for (const id of r.related_knowledge) {
        const k = knowledge.find(item => item.id === id);
        related.append(button(id + (k ? ' · ' + k.title : ''), () => explainKnowledge(id), '', true));
      }
      assistant.append(related);
    }
    card.append(assistant); root.append(card);
  }
}
function scrollToLatest() {
  const card = [...$('messages').children].filter(n => currentView !== 'review' || n.classList.contains('review-message')).at(-1);
  if (card && mobile.matches && currentView === 'review') {card.scrollIntoView({block:'start',behavior:'instant'});return;}
  if (card) $('conversation-scroll').scrollTop += card.getBoundingClientRect().top - $('conversation-scroll').getBoundingClientRect().top - 16;
}
async function send(question, options = {}) {
  if (busy) return;
  const useComposer = options.useComposer !== false;
  const q = (question ?? $('question').value).trim();
  const includeCode = useComposer && (codeOpen || currentView === 'review');
  if (includeCode && fileInput.reading) { status('文件正在读取，请稍后发送。',true); return; }
  if (includeCode && fileInput.count() > 10000) { status('代码超过10000字符，请精简后再发送。',true); $('code').focus(); return; }
  const code = includeCode ? $('code').value : '';
  const error = includeCode ? $('error-message').value : '';
  if (!q && !code.trim()) { status('请先输入问题或代码。', true); $('question').focus(); return; }
  const body = {
    session_id:'local-browser', question:q, task_type:includeCode ? 'debug' : 'auto',
    code, error_message:error,
    knowledge_id:options.knowledgeId === undefined ? activeId : options.knowledgeId,
    teaching_mode:options.solution ? 'solution' : 'hint',
    history:(freshContext ? [] : records.slice(-6)).flatMap(x => [
      {role:'user',content:(x.request.question || '').slice(0,2000)},
      {role:'assistant',content:x.response.answer.summary.slice(0,1500)}
    ])
  };
  setBusy(true); status('正在查询…');
  try {
    const response = await api(includeCode ? '/api/review' : '/api/chat', body);
    records.push({time:new Date().toISOString(), request:body, response,
      ...(options.displayQuestion ? {display_question:options.displayQuestion} : {})});
    records = records.slice(-100); freshContext = false;
    renderRecords(); renderHistory(); selectTopic(response.related_knowledge?.[0] || null);
    if (useComposer) $('question').value = '';
    if (save()) status();
    scrollToLatest();
  } catch (e) { showError(e); }
  finally { setBusy(false); }
}
function explainKnowledge(id) {
  if (busy) return;
  navigate('chat');
  setCode(false);

  const k = knowledge.find(k => k.id === id);
  send('讲解这个知识点', {knowledgeId:id,useComposer:false,displayQuestion:'讲解 ' + id + (k ? ' · ' + k.title : '')});
}

function setNav(value) {
  $('main-nav').classList.toggle('nav-open', value);
  $('nav-toggle').setAttribute('aria-expanded', String(value));
}
function navigate(view, recordIndex = null) {
  pendingRecord = recordIndex;
  if (location.hash === '#/' + view) route();
  else { skipNextHashRoute = true; location.hash = '/' + view; route(); }
}
function route(focus = true) {
  let view = location.hash.slice(2);
  if (!['home','knowledge','chat','review','history'].includes(view)) {
    view = 'home'; history.replaceState(null, '', '#/home');
  }
  const previousView = currentView;
  const changed = view !== previousView;
  const learning = view === 'chat' || view === 'review';
  const sequence=++routeSequence;
  setNav(false); setMore(false);
  document.querySelectorAll('#main-nav a').forEach(a => {
    if (a.hash === '#/' + view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  currentView = view;
  const applyView=()=>{
    if (changed && view !== 'knowledge') mapUI.close(false);
    if (typeof mapUI.setActive === 'function') mapUI.setActive(view === 'knowledge');
    document.body.classList.toggle('learning', learning);
    document.body.classList.toggle('review-mode', view === 'review');
    $('home-view').hidden = view !== 'home';
    $('knowledge-view').hidden = view !== 'knowledge';
    $('history-view').hidden = view !== 'history';
    $('layout').hidden = !learning;
    $('workspace-title').textContent = view === 'review' ? '代码纠错' : 'AI问答';
    if (changed && learning) setCode(view === 'review');
    $('question').placeholder = view === 'review' ? '问题说明（可选）' : '输入问题，继续学习…';
  };
  const finish=()=>{
    if(sequence!==routeSequence)return;
    if (changed && view === 'knowledge') mapUI.center();
    if (changed) {
      window.scrollTo(0,0);
      if (focus) (learning ? $('workspace-title') : view === 'knowledge' ? $('map-title') : view === 'history' ? $('history-title') : $('main-content')).focus({preventScroll:true});
    }
    if (pendingRecord !== null) {
      const node = $('record-' + pendingRecord);
      pendingRecord = null;
      if (node) { node.scrollIntoView({block:'start',behavior:'instant'}); node.focus({preventScroll:true}); }
    }
  };
  const animate=changed&&!!previousView&&!reducedMotion.matches;
  if(animate&&document.startViewTransition){
    activeViewTransition?.skipTransition();
    const transition=document.startViewTransition(applyView);activeViewTransition=transition;
    transition.updateCallbackDone.then(finish,finish);
    transition.finished.finally(()=>{if(activeViewTransition===transition)activeViewTransition=null;});
  }else{
    applyView();
    if(animate){
      const incoming=learning?$('layout'):$(view+'-view');
      incoming.animate([{opacity:0},{opacity:1}],{duration:220,easing:'cubic-bezier(.22,.75,.25,1)'});
    }
    finish();
  }
}
function renderHistory() {
  const root = $('history-list'); root.replaceChildren();
  if (!records.length) {
    const empty = el('div', '暂无学习记录', 'empty-state');
    const link = el('a', 'AI问答'); link.href = '#/chat'; empty.append(link); root.append(empty); return;
  }
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i];
    const row = button(undefined, () => navigate(record.request.task_type === 'debug' ? 'review' : 'chat', i), 'history-row');
    const text = el('span'); text.append(el('strong', record.display_question || record.request.question || '代码纠错'));
    text.append(el('small', firstSentence(record.response.answer.summary).slice(0,90)));
    const date = new Date(record.time);
    row.append(text, el('time', Number.isNaN(date.getTime()) ? '学习记录' : date.toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})));
    root.append(row);
  }
}
const fileInput = new window.RFileInput();
const mapUI = new window.KnowledgeMap({api, codeBlock, units:UNITS,
  explain: id => explainKnowledge(id),
  exercise: id => { if(busy)return; navigate('chat');setCode(false);send('给我练习',{knowledgeId:id,useComposer:false,displayQuestion:'练习'}); }
});
$('topic-clear').onclick = () => {selectTopic(null); freshContext=true; $('question').focus();};
document.querySelector('.skip-link').onclick = e => { e.preventDefault(); $('main-content').focus(); };
window.addEventListener('hashchange', () => {if(skipNextHashRoute){skipNextHashRoute=false;return;}route();});
$('nav-toggle').onclick = () => { setMore(false); setNav(!$('main-nav').classList.contains('nav-open')); };
document.addEventListener('click', e => {
  if (!e.target.closest('#main-nav') && !e.target.closest('#nav-toggle')) setNav(false);
});
$('main-nav').addEventListener('click', e => { if (e.target.closest('a')) setNav(false); });

$('history-export').onclick = () => $('export').click();
$('history-clear').onclick = () => $('clear').click();
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
  }), {threshold:.12});
  document.querySelectorAll('.reveal').forEach(node => observer.observe(node));
}

$('ask-form').onsubmit = e => { e.preventDefault(); send(); };
$('code-toggle').onclick = () => { setCode(!codeOpen); if (codeOpen) $('code').focus(); };
$('more-toggle').onclick = () => setMore($('more-panel').hidden);
$('more-toggle').onkeydown = e => { if (e.key === 'ArrowDown') { e.preventDefault(); setMore(true,true); } };
document.addEventListener('click', e => { if (!e.target.closest('.more-wrap')) setMore(false); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('main-nav').classList.contains('nav-open')) { setNav(false); $('nav-toggle').focus(); e.preventDefault(); }
    if (!$('more-panel').hidden) { setMore(false,true); e.preventDefault(); }
  }
});
mobile.addEventListener('change', () => setNav(false));
$('version-open').onclick = () => { setMore(false); $('version-dialog').showModal(); };
$('version-close').onclick = () => $('version-dialog').close();
$('version-dialog').addEventListener('close', () => $('more-toggle').focus());
$('clear').onclick = () => {
  if (busy) return;
  records = []; setMore(false); setCode(false); selectTopic(null); renderRecords(); renderHistory();
  if (save()) status();
  if (currentView === 'chat' || currentView === 'review') $('question').focus();
  else if (currentView === 'history') $('history-title').focus();
  else $('more-toggle').focus();
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
  navigate('review'); setCode(true); $('code').value = 'x <- c(1, NA, 3)\nx[x == NA]'; fileInput.detach(); fileInput.count(); $('error-message').value = '';
  send('为什么不能用x == NA判断缺失？');
};
renderRecords(); renderHistory(); route(false);
Promise.all([api('/api/health'),api('/api/knowledge')]).then(([health,data]) => {
  knowledge = data.items; relations = data.relations || [];
  $('version-number').textContent = '应用 ' + health.version + ' · 知识版本 ' + health.knowledge_version;
  selectTopic(activeId); renderRecords(); mapUI.load(knowledge, relations);
}).catch(() => status('无法连接本地服务，请启动服务后刷新。', true));
