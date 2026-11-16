/* Defense demo mode: a guided, keyboard-driven tour for the project presentation.
   → / PageDown next, ← / PageUp previous, Esc exit. Each step performs its own action
   (switch page, open a topic, ask a preset question …) and highlights the area to talk about.
   Started from "更多 → 答辩演示模式" or by opening the page with ?demo in the URL. */
let app = null, hud = null, spot = null, index = -1, busy = false, raf = 0, token = 0;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, timeout = 6000) {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    const value = test();
    if (value) return value;
    await wait(80);
  }
  return null;
}
const last = selector => [...document.querySelectorAll(selector)].at(-1) || null;

const STEPS = [
  {kicker:'开场', title:'R语言学习助手', target:'.hero',
   say:'面向R语言初学者的AI助教：以小组整理的课程资料为依据回答问题、纠正代码，并记录学习过程。默认使用不需要密钥的模拟版，也可切换真实大模型。',
   run:async () => { app.navigate('home'); }},
  {kicker:'知识脉络', title:'三维知识地图', target:'#map-stage',
   say:'43个知识点按8个单元组织成知识地图，连线表示先修关系。可以按单元筛选、搜索函数名，点开任一知识点查看详情。',
   run:async () => { app.navigate('knowledge'); await wait(600); }},
  {kicker:'课程内容', title:'知识详情与深入学习', target:'#map-detail',
   say:'每个知识点有讲解、参数、示例和易错提醒。已有24个知识点配了补充讲义：分层例题、图解、易错案例和练习，代码输出都标注了是否经过R实测。',
   run:async () => {
     app.openKnowledge('K21');
     const part = await until(() => document.querySelector('#detail-body .supplement'));
     part?.querySelector('details')?.setAttribute('open', '');
     part?.scrollIntoView({block:'start', behavior:'smooth'});
   }},
  {kicker:'核心功能', title:'AI问答', target:() => last('#messages .message'),
   say:'学生用自然语言提问，助教先从课程资料中检索，再给出讲解、示例代码、内容来源和相关知识点，并可继续追问例题、易错点或练习。',
   run:async () => {
     await app.ask('NA和NaN有什么区别');
     last('#messages .message')?.scrollIntoView({block:'start', behavior:'smooth'});
   }},
  {kicker:'质量闭环', title:'回答反馈', target:() => last('#messages .fb-strip'),
   say:'每条回答下方都可以评价“有帮助”或“需改进”并说明原因。这些反馈会汇总成回答质量看板，作为我们评价AI回答质量的依据。',
   run:async () => {
     const strip = await until(() => last('#messages .fb-strip'));
     strip?.scrollIntoView({block:'center', behavior:'smooth'});
   }},
  {kicker:'核心功能', title:'代码纠错', target:() => last('#messages .message'),
   say:'粘贴代码和报错信息，助教对照14个典型错误案例定位原因，给出修正代码和预期输出。这里演示初学者最常见的错误：用 == NA 判断缺失。',
   run:async () => {
     await app.review('x <- c(1, NA, 3)\nx[x == NA]', '为什么不能用x == NA判断缺失？');
     last('#messages .message')?.scrollIntoView({block:'start', behavior:'smooth'});
   }},
  {kicker:'学习闭环', title:'学习中心与智能复习', target:'#history-view',
   say:'学习记录汇总浏览、练习和作答情况，并按间隔安排复习。答对一道变式题才能评为“熟练”，用来检验学生是否真正掌握，而不只是记住答案。',
   run:async () => { app.navigate('history'); await wait(500); }},
  {kicker:'评价依据', title:'回答质量看板', target:'dialog.fbq',
   say:'看板汇总好评率、各类任务的表现和改进原因，可一键导出表格。数据只保存在本机浏览器，不上传服务器。',
   run:async () => { app.openFeedback({modal:false}); await wait(400); },
   leave:() => app.closeFeedback()},
  {kicker:'总结', title:'谢谢聆听', target:null, finale:true,
   say:'课程资料驱动的问答与纠错 · 24个知识点的深入讲义 · 间隔复习与变式检验 · 回答质量反馈 · 支持离线使用和安装到手机',
   run:async () => { app.navigate('home'); }},
];

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function buildHud() {
  spot = node('div', undefined, 'demo-spot'); spot.setAttribute('aria-hidden', 'true');
  spot.append(node('span', undefined, 'demo-scan'));
  hud = node('section', undefined, 'demo-hud');
  hud.setAttribute('role', 'region'); hud.setAttribute('aria-label', '答辩演示控制');
  hud.innerHTML = `
    <div class="demo-top">
      <p class="demo-kicker"><span class="demo-dot"></span><span class="demo-mode">DEFENSE MODE</span><span class="demo-count"></span></p>
      <span class="demo-tools"><button type="button" class="demo-fold" aria-expanded="true">收起 H</button><button type="button" class="demo-exit" aria-label="退出演示">退出 Esc</button></span>
    </div>
    <ol class="demo-progress" aria-hidden="true"></ol>
    <h2 class="demo-title" aria-live="polite"></h2>
    <p class="demo-say"></p>
    <div class="demo-controls">
      <button type="button" class="demo-prev">← 上一步</button>
      <span class="demo-state" aria-live="polite"></span>
      <button type="button" class="demo-next">下一步 →</button>
    </div>`;
  const progress = hud.querySelector('.demo-progress');
  STEPS.forEach((step, i) => {
    const item = node('li'); item.title = step.title;
    item.addEventListener('click', () => go(i));
    progress.append(item);
  });
  hud.querySelector('.demo-prev').addEventListener('click', () => go(index - 1));
  hud.querySelector('.demo-next').addEventListener('click', () => index === STEPS.length - 1 ? stop() : go(index + 1));
  hud.querySelector('.demo-exit').addEventListener('click', stop);
  hud.querySelector('.demo-fold').addEventListener('click', fold);
  document.body.append(spot, hud);
}

function targetOf(step) {
  if (!step?.target) return null;
  const element = typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
  return element && element.getClientRects().length ? element : null;
}
function track() {
  cancelAnimationFrame(raf);
  const loop = () => {
    const element = targetOf(STEPS[index]);
    if (element) {
      const r = element.getBoundingClientRect(), pad = 10;
      const top = Math.max(6, r.top - pad), left = Math.max(6, r.left - pad);
      // keep the frame above the HUD so nothing highlighted hides behind it
      const floor = hud ? hud.getBoundingClientRect().top - 10 : innerHeight - 6;
      const bottom = Math.max(top + 40, Math.min(innerHeight - 6, floor, r.bottom + pad)), right = Math.min(innerWidth - 6, r.right + pad);
      Object.assign(spot.style, {top:top + 'px', left:left + 'px', width:Math.max(0, right - left) + 'px', height:Math.max(0, bottom - top) + 'px'});
      spot.classList.add('on');
    } else spot.classList.remove('on');
    raf = requestAnimationFrame(loop);
  };
  loop();
}

async function go(next) {
  if (next < 0 || next >= STEPS.length || busy) return;
  const previous = STEPS[index];
  index = next;
  const mine = ++token, step = STEPS[index];
  busy = true;
  hud.classList.toggle('finale', !!step.finale);
  hud.querySelector('.demo-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;
  hud.querySelector('.demo-title').textContent = step.kicker + ' · ' + step.title;
  const say = hud.querySelector('.demo-say');
  say.replaceChildren();
  if (step.finale) step.say.split(' · ').forEach(text => say.append(node('span', text, 'demo-chip')));
  else say.textContent = step.say;
  document.body.classList.toggle('demo-finale', !!step.finale);
  hud.querySelectorAll('.demo-progress li').forEach((li, i) => { li.classList.toggle('done', i < index); li.classList.toggle('now', i === index); });
  hud.querySelector('.demo-prev').disabled = index === 0;
  hud.querySelector('.demo-next').textContent = index === STEPS.length - 1 ? '结束演示' : '下一步 →';
  hud.classList.remove('flash'); void hud.offsetWidth; hud.classList.add('flash');
  setState('正在准备…');
  try {
    previous?.leave?.();
    await step.run();
    if (mine === token) setState('');
  } catch (error) {
    if (mine === token) setState('这一步未能自动完成，可手动操作后继续。');
  } finally {
    if (mine === token) busy = false;
  }
}
function setState(text) {
  hud.querySelector('.demo-state').textContent = text;
  hud.classList.toggle('working', !!text && text.startsWith('正在'));
}

function fold() {
  const folded = hud.classList.toggle('folded');
  const button = hud.querySelector('.demo-fold');
  button.textContent = folded ? '展开 H' : '收起 H';
  button.setAttribute('aria-expanded', String(!folded));
}
function onKey(event) {
  if (!hud) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
  if (event.key === 'Escape') { event.preventDefault(); stop(); return; }
  if (typing) return;
  if (['ArrowRight', 'PageDown'].includes(event.key)) { event.preventDefault(); index === STEPS.length - 1 ? stop() : go(index + 1); }
  if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); go(index - 1); }
  if (event.key === 'h' || event.key === 'H') { event.preventDefault(); fold(); }
}

export async function startDemo() {
  if (hud) return;
  app.closeMenu?.();
  buildHud();
  document.body.classList.add('demo-active');
  document.addEventListener('keydown', onKey, true);
  index = -1; busy = false;
  track();
  await go(0);
  hud.querySelector('.demo-next').focus();
}
export function stopDemo() { stop(); }
function stop() {
  if (!hud) return;
  token++;
  STEPS[index]?.leave?.();
  cancelAnimationFrame(raf);
  document.removeEventListener('keydown', onKey, true);
  hud.remove(); spot.remove(); hud = spot = null; busy = false;
  document.body.classList.remove('demo-active', 'demo-finale');
  document.getElementById('more-toggle')?.focus();
}

/* api: {navigate, openKnowledge, ask, review, openFeedback, closeFeedback, closeMenu, menu} */
export function initDemo(api) {
  app = api;
  if (!document.querySelector('link[data-demo-mode]')) {
    const link = node('link'); link.rel = 'stylesheet'; link.href = '/static/demo-mode.css?v=learning-v1';
    link.dataset.demoMode = ''; document.head.append(link);
  }
  const menu = api.menu || document.getElementById('more-panel');
  if (menu && !menu.querySelector('#demo-open')) {
    const entry = node('button', '答辩演示模式'); entry.id = 'demo-open'; entry.type = 'button';
    entry.addEventListener('click', startDemo);
    menu.prepend(entry);
  }
  if (new URLSearchParams(location.search).has('demo')) {
    until(() => document.body.dataset.learningReady === 'true', 15000).then(startDemo);
  }
}
