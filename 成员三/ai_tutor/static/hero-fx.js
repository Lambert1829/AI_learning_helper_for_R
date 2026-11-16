/* Home hero effects: a "data constellation" canvas behind the headline, a shimmering
   headline and a live stats band that counts up from real numbers (/api/health and the
   review bank). Runs only while the hero is on screen; respects prefers-reduced-motion. */
const GLYPHS = ['<-', '%in%', 'NA', 'c()', 'mean()', 'TRUE', 'df$x', '%*%', 'apply()', '{ }', 'NULL', 'x[i]', 'paste0()', 'is.na()'];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function constellation(hero) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-fx'; canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }
  let w = 0, h = 0, dpr = 1, nodes = [], glyphs = [], raf = 0, visible = true;
  const mouse = {x:-1e4, y:-1e4};

  function resize() {
    const r = hero.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(90, Math.max(30, w * h / 16000)));
    nodes = Array.from({length:count}, () => ({x:Math.random() * w, y:Math.random() * h,
      vx:(Math.random() - .5) * .35, vy:(Math.random() - .5) * .35, r:Math.random() * 1.6 + .9}));
    glyphs = Array.from({length:Math.round(count / 6)}, () => ({text:GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      x:Math.random() * w, y:Math.random() * h, vy:-(Math.random() * .25 + .08), size:Math.random() * 6 + 12, a:Math.random() * .12 + .06}));
    if (reduced()) draw();
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '600 14px ui-monospace, Menlo, Consolas, monospace';
    for (const g of glyphs) {
      ctx.font = `600 ${g.size}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.fillStyle = `rgba(122, 92, 255, ${g.a})`;
      ctx.fillText(g.text, g.x, g.y);
    }
    const link = Math.min(150, w / 7);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d < link) {
          ctx.strokeStyle = `rgba(0, 113, 227, ${(1 - d / link) * .22})`;
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (md < 180) {
        ctx.strokeStyle = `rgba(122, 92, 255, ${(1 - md / 180) * .45})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
      ctx.fillStyle = md < 180 ? 'rgba(122, 92, 255, .85)' : 'rgba(0, 113, 227, .55)';
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  function step() {
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
      const dx = mouse.x - n.x, dy = mouse.y - n.y, d = Math.hypot(dx, dy);
      if (d < 180 && d > 1) { n.x += dx / d * .25; n.y += dy / d * .25; }
    }
    for (const g of glyphs) { g.y += g.vy; if (g.y < -20) { g.y = h + 20; g.x = Math.random() * w; } }
    draw();
    raf = requestAnimationFrame(step);
  }
  function run() {
    cancelAnimationFrame(raf);
    if (visible && !document.hidden && !reduced() && !hero.closest('[hidden]')) raf = requestAnimationFrame(step);
  }
  hero.addEventListener('pointermove', event => { const r = hero.getBoundingClientRect(); mouse.x = event.clientX - r.left; mouse.y = event.clientY - r.top; });
  hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  new ResizeObserver(() => { resize(); run(); }).observe(hero);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; run(); }).observe(hero);
  document.addEventListener('visibilitychange', run);
  resize(); run();
}

function countUp(node, target) {
  if (reduced()) { node.textContent = target; return; }
  const start = performance.now(), duration = 1400;
  const tick = now => {
    const t = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - t, 3);
    node.textContent = Math.round(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function stats(hero) {
  const actions = hero.querySelector('.hero-actions');
  if (!actions) return;
  let health = null, bank = null;
  try { health = await (await fetch('/api/health')).json(); } catch {}
  try { bank = await (await fetch('/static/review-bank.json?v=learning-v1')).json(); } catch {}
  const c = health?.counts || {};
  const items = [['知识点', c.knowledge, '8个单元'], ['深入讲义', c.supplements, '分层例题与图解'],
    ['复习题', bank?.items?.length, '含变式检验'], ['错误案例', c.errors, '典型报错对照']]
    .filter(([, value]) => Number.isFinite(value) && value > 0);
  if (!items.length) return;
  const band = document.createElement('div');
  band.className = 'hero-stats'; band.setAttribute('aria-label', '课程资源概况');
  for (const [label, value, note] of items) {
    const tile = document.createElement('div'); tile.className = 'hero-stat';
    const num = document.createElement('strong'); num.textContent = reduced() ? value : '0'; num.dataset.target = value;
    num.setAttribute('aria-label', `${label}${value}`);
    const name = document.createElement('span'); name.textContent = label;
    const small = document.createElement('small'); small.textContent = note;
    tile.append(num, name, small); band.append(tile);
  }
  actions.after(band);
  const io = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    band.querySelectorAll('strong').forEach(n => countUp(n, Number(n.dataset.target)));
  });
  io.observe(band);
}

export function initHeroFx() {
  const hero = document.querySelector('#home-view .hero');
  if (!hero || hero.dataset.fx) return;
  hero.dataset.fx = 'on';
  if (!document.querySelector('link[data-hero-fx]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/static/hero-fx.css?v=learning-v1';
    link.dataset.heroFx = ''; document.head.append(link);
  }
  hero.querySelector('h1')?.classList.add('fx-shimmer');
  constellation(hero);
  stats(hero);
}
