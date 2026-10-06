/* 트레이드북 차트 — Canvas 2D 직접 그리기 (블로그 캡처 시 웹폰트·색 그대로 유지)
   스펙: 막대 ≤24px·데이터 끝 4px 라운드, 선 2px, 마커 r4+2px 링, 면적 10% 워시, 헤어라인 그리드 */
'use strict';

function cssVar(name, el) { return getComputedStyle(el || document.documentElement).getPropertyValue(name).trim(); }
function chartPalette(el) {
  return {
    up: cssVar('--up', el), down: cssVar('--down', el), text: cssVar('--text', el), text2: cssVar('--text-2', el),
    muted: cssVar('--muted', el), line: cssVar('--line', el), axis: cssVar('--axis', el), surface: cssVar('--surface', el),
    accent: cssVar('--accent', el), font: cssVar('--font', el) || 'sans-serif',
  };
}
function niceTicks(min, max, count = 4) {
  if (min === max) { const p = Math.abs(min) || 1; min -= p; max += p; }
  const raw = (max - min) / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
function prepCanvas(canvas, height) {
  const w = canvas.parentElement.clientWidth || 600, dpr = Math.max(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(height * dpr);
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: height };
}
function roundBar(ctx, x, y0, y1, bw, r) {      // y0=기준선, y1=데이터 끝 (끝만 라운드)
  const top = Math.min(y0, y1), hgt = Math.abs(y1 - y0); r = Math.min(r, hgt, bw / 2);
  ctx.beginPath();
  if (y1 <= y0) { ctx.moveTo(x, y0); ctx.lineTo(x, top + r); ctx.quadraticCurveTo(x, top, x + r, top); ctx.lineTo(x + bw - r, top); ctx.quadraticCurveTo(x + bw, top, x + bw, top + r); ctx.lineTo(x + bw, y0); }
  else { ctx.moveTo(x, y0); ctx.lineTo(x, y1 - r); ctx.quadraticCurveTo(x, y1, x + r, y1); ctx.lineTo(x + bw - r, y1); ctx.quadraticCurveTo(x + bw, y1, x + bw, y1 - r); ctx.lineTo(x + bw, y0); }
  ctx.closePath(); ctx.fill();
}

/* 공통 축: 왼쪽 y 눈금 + 헤어라인 그리드 + 0 기준선 */
function drawAxes(ctx, w, h, pad, ticks, ys, pal, fmtAxis, fs) {
  ctx.font = `600 ${fs}px ${pal.font}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const t of ticks) {
    const y = Math.round(ys(t)) + 0.5;
    ctx.strokeStyle = t === 0 ? pal.axis : pal.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = pal.muted; ctx.fillText(fmtAxis(t), pad.l - 6, y);
  }
}

/* 누적 손익 곡선 — points: [{label, value, sub}] */
function drawLineChart(canvas, points, opts = {}) {
  const H = opts.height || 200, pal = opts.palette || chartPalette(canvas), fs = opts.fontSize || 11;
  const fmtAxis = opts.fmtAxis || (v => fmtCompact(v).replace('+', '')), fmtTip = opts.fmtTip || (v => fmtSigned(v));
  const render = (hover) => {
    const { ctx, w, h } = prepCanvas(canvas, H);
    ctx.clearRect(0, 0, w, h);
    if (!points.length) { ctx.fillStyle = pal.muted; ctx.font = `600 13px ${pal.font}`; ctx.textAlign = 'center'; ctx.fillText('데이터 없음', w / 2, h / 2); return; }
    const vals = [0, ...points.map(p => p.value)];
    const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
    const pad = { l: opts.padL || 48, r: 14, t: 12, b: 22 };
    const ys = v => pad.t + (h - pad.t - pad.b) * (1 - (v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0]));
    const n = points.length, xs = i => pad.l + (n === 1 ? (w - pad.l - pad.r) / 2 : (w - pad.l - pad.r) * i / (n - 1));
    drawAxes(ctx, w, h, pad, ticks, ys, pal, fmtAxis, fs);
    const last = points[n - 1].value, col = last >= 0 ? pal.up : pal.down;
    // 면적 워시 (0 기준)
    ctx.beginPath(); ctx.moveTo(xs(0), ys(0));
    points.forEach((p, i) => ctx.lineTo(xs(i), ys(p.value)));
    ctx.lineTo(xs(n - 1), ys(0)); ctx.closePath();
    ctx.globalAlpha = 0.10; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
    // 선 2px
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(xs(i), ys(p.value)) : ctx.moveTo(xs(i), ys(p.value)));
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    // x 라벨: 처음·끝
    ctx.fillStyle = pal.muted; ctx.font = `600 ${fs}px ${pal.font}`; ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left'; ctx.fillText(points[0].label, pad.l, h - 6);
    if (n > 1) { ctx.textAlign = 'right'; ctx.fillText(points[n - 1].label, w - pad.r, h - 6); }
    // 끝점 마커 + 값 라벨
    const dot = (i, c) => { ctx.beginPath(); ctx.arc(xs(i), ys(points[i].value), 4, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = pal.surface; ctx.stroke(); };
    dot(n - 1, col);
    if (opts.endLabel !== false) {
      ctx.fillStyle = pal.text; ctx.font = `800 ${fs + 1}px ${pal.font}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText((opts.fmtEnd || fmtTip)(last), Math.min(w - pad.r, xs(n - 1)), ys(last) - 8 < pad.t + 10 ? ys(last) + 22 : ys(last) - 8);
    }
    if (hover !== undefined && hover !== null) {     // 크로스헤어
      ctx.strokeStyle = pal.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(xs(hover)) + 0.5, pad.t); ctx.lineTo(Math.round(xs(hover)) + 0.5, h - pad.b); ctx.stroke();
      dot(hover, points[hover].value >= 0 ? pal.up : pal.down);
    }
    canvas._geom = { xs, n, pad, w };
  };
  render();
  if (opts.interactive !== false) bindTip(canvas, i => { render(i); return { title: fmtTip(points[i].value), sub: points[i].label + (points[i].sub ? ' · ' + points[i].sub : '') }; }, () => render(), 'nearest');
}

/* 손익 막대 (0 기준 양방향) — bars: [{label, value, sub}] */
function drawBarChart(canvas, bars, opts = {}) {
  const H = opts.height || 180, pal = opts.palette || chartPalette(canvas), fs = opts.fontSize || 11;
  const fmtAxis = opts.fmtAxis || (v => fmtCompact(v).replace('+', '')), fmtTip = opts.fmtTip || (v => fmtSigned(v));
  const render = (hover) => {
    const { ctx, w, h } = prepCanvas(canvas, H);
    ctx.clearRect(0, 0, w, h);
    const vals = [0, ...bars.map(b => b.value)];
    const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
    const pad = { l: opts.padL || 48, r: 8, t: 10, b: 22 };
    const ys = v => pad.t + (h - pad.t - pad.b) * (1 - (v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0]));
    drawAxes(ctx, w, h, pad, ticks, ys, pal, fmtAxis, fs);
    const n = Math.max(bars.length, 1), band = (w - pad.l - pad.r) / n, bw = Math.max(2, Math.min(24, band - 2));
    bars.forEach((b, i) => {
      if (!b.value) return;
      const x = pad.l + band * i + (band - bw) / 2;
      ctx.fillStyle = b.value > 0 ? pal.up : pal.down;
      if (hover === i) ctx.globalAlpha = 0.75;
      roundBar(ctx, x, ys(0), ys(b.value), bw, 4);
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = pal.muted; ctx.font = `600 ${fs}px ${pal.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const every = Math.ceil(n / (opts.maxXLabels || 8));
    // 마지막 라벨은 항상 표시, 그 바로 앞의 정규 라벨은 겹치면 생략
    bars.forEach((b, i) => { if ((i % every === 0 && n - 1 - i >= Math.ceil(every / 2)) || i === n - 1) ctx.fillText(b.label, pad.l + band * (i + 0.5), h - 6); });
    canvas._geom = { band, pad, n };
  };
  render();
  if (opts.interactive !== false) bindTip(canvas, i => { render(i); const b = bars[i]; return { title: b.value ? fmtTip(b.value) : '매매 없음', sub: b.label + (b.sub ? ' · ' + b.sub : '') }; }, () => render(), 'band');
}

/* 툴팁 — 마우스·터치 공용, 보조 수단(값은 표/라벨로도 확인 가능) */
function bindTip(canvas, onHover, onLeave, mode) {
  const tip = document.getElementById('chart-tip');
  if (!tip) return;
  const idxAt = (clientX) => {
    const g = canvas._geom, rect = canvas.getBoundingClientRect(), x = clientX - rect.left;
    if (!g) return null;
    if (mode === 'band') { const i = Math.floor((x - g.pad.l) / g.band); return i >= 0 && i < g.n ? i : null; }
    let best = null, bd = Infinity; for (let i = 0; i < g.n; i++) { const d = Math.abs(g.xs(i) - x); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const move = (e) => {
    const i = idxAt(e.clientX);
    if (i === null) { leave(); return; }
    const info = onHover(i);
    tip.innerHTML = ''; const b = document.createElement('b'); b.textContent = info.title; const s = document.createElement('span'); s.className = 'muted'; s.textContent = info.sub;
    tip.append(b, s); tip.hidden = false;
    const tw = tip.offsetWidth; let left = e.clientX + 12; if (left + tw > window.innerWidth - 8) left = e.clientX - tw - 12;
    tip.style.left = left + 'px'; tip.style.top = (e.clientY - 48) + 'px';
  };
  const leave = () => { tip.hidden = true; onLeave(); };
  canvas.onpointermove = move; canvas.onpointerdown = move; canvas.onpointerleave = leave;
}
