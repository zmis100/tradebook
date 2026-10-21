/* 트레이드북 블로그 카드 — 720px 고정폭, 2배 해상도 PNG(1440px)로 저장 → 블로그 모바일에서도 글씨가 큼
   종류: trade(매매 1건: 전일 근거 vs 결과) / day(일일: 어제 종베 결과 + 오늘 진입 + 시황) / month(월간 결산) */
'use strict';

const CARD_CSS = `
.bcard{--b-bg:#fff;--b-panel:#f5f5f2;--b-text:#111;--b-text2:#55534e;--b-muted:#8b8983;--b-line:#e6e5df;--up:#e34948;--down:#2a78d6;--b-up:#c62f2f;--b-down:#1f62b8;--b-accent:#4a3aa7;--b-chip:#ecebfa;--b-upwash:rgba(227,73,72,0.14);--b-downwash:rgba(42,120,214,0.14);--surface:#fff;--text:#111;--text-2:#55534e;--muted:#8b8983;--line:#e6e5df;--axis:#c9c8c0;
 width:720px;background:var(--b-bg);color:var(--b-text);font-family:"Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif;padding:40px 40px 28px;box-sizing:border-box;letter-spacing:-0.3px;line-height:1.5}
.bcard[data-theme=dark]{--b-bg:#16171a;--b-panel:#222327;--b-text:#fff;--b-text2:#c9c8c0;--b-muted:#8f8d87;--b-line:#2e2f33;--up:#e66767;--down:#3987e5;--b-up:#ff8080;--b-down:#74b0f5;--b-accent:#9085e9;--b-chip:#2c2a45;--b-upwash:rgba(230,103,103,0.20);--b-downwash:rgba(57,135,229,0.22);--surface:#16171a;--text:#fff;--text-2:#c9c8c0;--muted:#8f8d87;--line:#2e2f33;--axis:#3a3b40}
.bcard *{box-sizing:border-box}
.bc-kicker{font-size:17px;font-weight:700;color:var(--b-accent)}
.bc-title{font-size:34px;font-weight:800;margin:2px 0 0;letter-spacing:-0.8px;line-height:1.3}
.bc-sub{font-size:17px;color:var(--b-muted);font-weight:600;margin-top:4px}
.bc-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:22px 0 6px;padding-bottom:22px;border-bottom:2px solid var(--b-line)}
.bc-hero .big{font-size:54px;font-weight:800;letter-spacing:-1.5px;line-height:1}
.bc-hero .amt{font-size:21px;font-weight:700;margin-top:8px}
.bc-sec{margin-top:24px}
.bc-sec-t{font-size:19px;font-weight:800;display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
.bc-sec-t small{font-size:15px;color:var(--b-muted);font-weight:600}
.bc-panel{background:var(--b-panel);border-radius:18px;padding:18px 20px;font-size:19px}
.bc-panel p{margin:8px 0 0;white-space:pre-wrap}
.bc-k{display:inline-block;min-width:64px;font-size:15px;font-weight:800;color:var(--b-muted)}
.bc-chips{display:flex;flex-wrap:wrap;gap:8px}
.bc-chip{background:var(--b-chip);color:var(--b-accent);border-radius:999px;padding:5px 13px;font-size:16px;font-weight:700}
.bc-chip.miss{background:transparent;border:1.5px solid var(--b-line);color:var(--b-text2)}
.bc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.bc-grid.g3{grid-template-columns:repeat(3,1fr)}
.bc-kpi{background:var(--b-panel);border-radius:16px;padding:14px 16px}
.bc-kpi .l{font-size:14px;color:var(--b-muted);font-weight:700}
.bc-kpi .v{font-size:26px;font-weight:800;letter-spacing:-0.6px;line-height:1.3}
.bc-kpi .s{font-size:13px;color:var(--b-text2);font-weight:600}
.bc-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--b-line);font-size:18px}
.bc-row:last-child{border-bottom:0}
.bc-row .n{font-weight:800;font-size:20px}
.bc-row .d{font-size:15px;color:var(--b-text2);margin-top:2px}
.bc-row .r{text-align:right;font-weight:800;font-size:21px;white-space:nowrap}
.bc-row .r small{display:block;font-size:14px;font-weight:700}
.bc-flow{display:flex;align-items:center;gap:14px;font-size:22px;font-weight:800}
.bc-flow .arrow{color:var(--b-muted)}
.bc-badges{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.bc-badge{font-size:15px;font-weight:800;border-radius:8px;padding:4px 10px;background:var(--b-bg);border:1.5px solid var(--b-line)}
.bc-img{width:100%;border-radius:14px;display:block;border:1px solid var(--b-line)}
.bc-img+.bc-img{margin-top:12px}
.bc-panel+.bc-imgs{margin-top:14px}
.bc-sec .bc-imgs:not(:last-child){margin-bottom:14px}
.bc-cap{font-size:15px;font-weight:800;color:var(--b-muted);margin:12px 0 8px}
.bc-item{border-bottom:1px solid var(--b-line);padding-bottom:16px}
.bc-item:last-child{border-bottom:0;padding-bottom:0}
.bc-item>.bc-row{border-bottom:0}
.bc-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.bc-cal .w{text-align:center;font-size:13px;color:var(--b-muted);font-weight:700}
.bc-cal .c{background:var(--b-panel);border-radius:10px;min-height:62px;padding:6px 7px;display:flex;flex-direction:column;justify-content:space-between}
.bc-cal .c.e{background:transparent}
.bc-cal .c.u{background:var(--b-upwash)}
.bc-cal .c.dn{background:var(--b-downwash)}
.bc-cal .dd{font-size:12px;color:var(--b-muted);font-weight:700}
.bc-cal .vv{font-size:14px;font-weight:800;text-align:right;letter-spacing:-0.5px}
.bc-foot{display:flex;justify-content:space-between;margin-top:26px;padding-top:16px;border-top:1px solid var(--b-line);font-size:14px;color:var(--b-muted);font-weight:700}
.bcard .up{color:var(--b-up)}.bcard .down{color:var(--b-down)}.bcard .flat{color:var(--b-text2)}
.bc-stars{color:#f0a500;letter-spacing:1px}
`;
(function injectCardCss() { const s = document.createElement('style'); s.textContent = CARD_CSS; document.head.appendChild(s); })();

const HIT_LABEL = { O: '근거 적중 O', '△': '근거 부분 적중 △', X: '근거 빗나감 X' };
const cAmt = (n, masked) => masked ? '' : fmtSigned(n) + '원';
const stars = n => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
const planTxt = t => [isFinite(t.targetPct) && t.targetPct !== null && t.targetPct !== '' ? '목표 ' + fmtPct(Number(t.targetPct), 1) : '', isFinite(t.stopPct) && t.stopPct !== null && t.stopPct !== '' ? '손절 ' + fmtPct(Number(t.stopPct), 1) : ''].filter(Boolean).join(' · ');

function cardShell(o, inner) {
  return `<div class="bcard" data-theme="${o.theme}">${inner}
    <div class="bc-foot"><span>${esc(settings.blogName || '나의 매매일지')}</span><span>기록 · 트레이드북</span></div></div>`;
}
function thesisPanel(t) {
  return `<div class="bc-panel">
    ${(t.tags || []).length ? `<div class="bc-chips">${t.tags.map(x => `<span class="bc-chip">${esc(x)}</span>`).join('')}</div>` : ''}
    ${t.catalyst ? `<p><span class="bc-k">재료</span>${esc(t.catalyst)}</p>` : ''}
    ${t.reason ? `<p><span class="bc-k">근거</span>${esc(t.reason)}</p>` : ''}
    ${planTxt(t) ? `<p><span class="bc-k">계획</span><b>${planTxt(t)}</b>${t.scenario ? '<br>' + esc(t.scenario) : ''}</p>` : (t.scenario ? `<p><span class="bc-k">계획</span>${esc(t.scenario)}</p>` : '')}
    ${t.confidence ? `<p><span class="bc-k">확신도</span><span class="bc-stars">${stars(t.confidence)}</span></p>` : ''}
  </div>`;
}

/* 첨부 사진 묶음 (세로로 이어 붙임, caption 있으면 위에 작은 제목) */
const cardImgs = (srcs, caption) => (srcs || []).length
  ? `<div class="bc-imgs">${caption ? `<div class="bc-cap">${caption}</div>` : ''}${srcs.map(s => `<img class="bc-img" src="${s}" alt="">`).join('')}</div>` : '';
/* 일일 카드에 들어가는 매매: 그날 청산 / 그날 진입(같은 날 사고 판 건 청산 쪽에만) / 무포지션 */
function dayParts(date) {
  const live = liveTrades();
  const closed = sortClosed(live.filter(t => t.status === 'closed' && t.sellDate === date));
  const opened = live.filter(t => t.buyDate === date && t.status !== 'flat' && !(t.status === 'closed' && t.sellDate === date))
    .sort((a, b) => (a.buyTime || '').localeCompare(b.buyTime || ''));
  const flats = live.filter(t => t.buyDate === date && t.status === 'flat');
  return { closed, opened, flats };
}

/* ---- 매매 1건 ---- */
function tradeCardHTML(t, o) {
  const c = calcTrade(t, settings);
  const head = `<div class="bc-kicker">${esc(t.strategy || '매매')} 매매일지</div>
    <div class="bc-title">${esc(t.name)} <span style="font-size:20px;color:var(--b-muted);font-weight:700">${esc(t.code || '')}</span></div>
    <div class="bc-sub">매수 ${mdLabel(t.buyDate)}${c ? ' → 매도 ' + mdLabel(t.sellDate) : ' · 보유 중'}</div>`;
  const hero = c ? `<div class="bc-hero"><div><div class="big ${pnlClass(c.net)}">${fmtPct(c.pct)}</div>${o.masked ? '' : `<div class="amt ${pnlClass(c.net)}">${cAmt(c.net)}</div>`}</div>
    <div class="bc-flow num">${fmtNum(t.buyPrice)}<span class="arrow">→</span>${fmtNum(t.sellPrice)}</div></div>` :
    `<div class="bc-hero"><div><div class="big" style="font-size:40px">매수 ${fmtNum(t.buyPrice)}원</div>${o.masked ? '' : `<div class="amt">${fmtNum(t.qty)}주</div>`}</div></div>`;
  const thesis = `<div class="bc-sec"><div class="bc-sec-t">📌 ${c ? (c.holdDays <= 3 ? '전일 매수 근거' : '매수 당시 근거') : '매수 근거'} <small>${t.thesisAt ? stampLabel(t.thesisAt) + ' 기록' : ''}</small></div>${thesisPanel(t)}</div>`;
  // 첨부 이미지 전부: 매수 시점 → 근거 아래, 매도·결과 → 복기 아래 (세로로 이어 붙임)
  const img = (o.buyImgs || []).length ? `<div class="bc-sec">${cardImgs(o.buyImgs)}</div>` : '';
  const result = c ? `<div class="bc-sec"><div class="bc-sec-t">📊 결과 · 복기 <small>${mdLabel(t.sellDate)} ${esc(t.sellTime || '')}</small></div>
    <div class="bc-panel">
      <div class="bc-badges" style="margin-top:0">${t.thesisHit ? `<span class="bc-badge">${HIT_LABEL[t.thesisHit]}</span>` : ''}${t.planKept ? `<span class="bc-badge">${t.planKept === 'O' ? '계획대로 대응 O' : '계획 이탈 X'}</span>` : ''}<span class="bc-badge">보유 ${c.holdDays}일</span></div>
      ${t.review ? `<p>${esc(t.review)}</p>` : ''}
      ${(t.mistakes || []).length ? `<div class="bc-chips" style="margin-top:10px">${t.mistakes.map(x => `<span class="bc-chip miss">${esc(x)}</span>`).join('')}</div>` : ''}
      ${t.lesson ? `<p><span class="bc-k">배운 점</span><b>${esc(t.lesson)}</b></p>` : ''}
    </div>${cardImgs(o.sellImgs)}</div>` : '';
  return cardShell(o, head + hero + thesis + img + result);
}

/* ---- 일일 카드 ---- */
function dayCardHTML(date, o) {
  const live = liveTrades();
  const { closed, opened, flats } = dayParts(date);
  const pics = id => (o.imgMap || {})[id] || {};   // cardHTML에서 미리 읽어 둔 첨부 사진
  const st = computeStats(closed, settings), mst = computeStats(closedIn(live, ymOf(date)), settings);
  const note = getDayNote(date);
  // 제목은 그날 매매의 전략을 따름 (여러 개면 함께, 무포지션만 있는 날은 기본 전략)
  const strategies = [...new Set([...closed, ...opened].map(t => t.strategy).filter(Boolean))];
  const kicker = (strategies.length ? strategies.join(' · ') : (settings.strategies[0] || '')) + ' 매매일지';
  const head = `<div class="bc-kicker">${esc(kicker)}</div><div class="bc-title">${date.slice(0, 4)}.${date.slice(5, 7)}.${date.slice(8)} (${dowOf(date)})</div>`;
  const dayPct = st.buyAmtSum ? st.net / st.buyAmtSum * 100 : 0;
  const hero = closed.length ? `<div class="bc-hero"><div><div class="bc-sub" style="margin:0 0 6px">오늘 실현 ${closed.length}건 · ${st.wins}승 ${st.losses}패</div>
      <div class="big ${pnlClass(st.net)}">${o.masked ? fmtPct(dayPct) : fmtSigned(st.net) + '원'}</div></div>
      <div style="text-align:right"><div class="bc-sub" style="margin:0">${Number(date.slice(5, 7))}월 누적</div><div style="font-size:24px;font-weight:800" class="${pnlClass(mst.net)}">${o.masked ? '승률 ' + mst.winRate.toFixed(0) + '%' : fmtCompact(mst.net)}</div></div></div>` : '';
  const closedSec = closed.length ? `<div class="bc-sec"><div class="bc-sec-t">📊 청산 결과</div>${closed.map(t => {
    const c = calcTrade(t, settings);
    const row = `<div class="bc-row"><div style="min-width:0"><div class="n">${esc(t.name)}</div>
      <div class="d">${esc([(t.tags || []).slice(0, 3).join(' · '), t.catalyst].filter(Boolean).join(' / '))}</div>
      <div class="d"><b>${t.thesisHit ? HIT_LABEL[t.thesisHit] : ''}</b>${t.lesson ? ' — ' + esc(t.lesson) : ''}</div></div>
      <div class="r ${pnlClass(c.net)}">${fmtPct(c.pct)}${o.masked ? '' : `<small>${fmtSigned(c.net)}</small>`}</div></div>`;
    const p = pics(t.id), photos = cardImgs(p.buy, '📌 매수 시점') + cardImgs(p.sell, '📊 매도·결과');
    return photos ? `<div class="bc-item">${row}${photos}</div>` : row;
  }).join('')}</div>` : '';
  const openSec = opened.length ? `<div class="bc-sec"><div class="bc-sec-t">📌 오늘 진입 (내일 결과)</div>${opened.map(t => `
    <div class="bc-panel" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:21px">${esc(t.name)}</b>
      <span style="font-size:16px;color:var(--b-muted);font-weight:700">${fmtNum(t.buyPrice)}원 ${t.buyTime ? '· ' + esc(t.buyTime) : ''}</span></div>
      ${(t.tags || []).length ? `<div class="bc-chips" style="margin-top:8px">${t.tags.map(x => `<span class="bc-chip">${esc(x)}</span>`).join('')}</div>` : ''}
      ${t.catalyst ? `<p><span class="bc-k">재료</span>${esc(t.catalyst)}</p>` : ''}
      ${t.reason ? `<p><span class="bc-k">근거</span>${esc(t.reason)}</p>` : ''}
      ${planTxt(t) || t.scenario ? `<p><span class="bc-k">계획</span><b>${planTxt(t)}</b>${t.scenario ? (planTxt(t) ? '<br>' : '') + esc(t.scenario) : ''}</p>` : ''}
    </div>${cardImgs(pics(t.id).buy)}`).join('')}</div>` : '';
  const flatSec = flats.length ? `<div class="bc-sec"><div class="bc-sec-t">😴 오늘 무포지션 <small>${flats[0].thesisAt ? stampLabel(flats[0].thesisAt) + ' 기록' : ''}</small></div>${flats.map(t => `
    <div class="bc-panel" style="margin-bottom:10px">
      ${(t.tags || []).length ? `<div class="bc-chips">${t.tags.map(x => `<span class="bc-chip">${esc(x)}</span>`).join('')}</div>` : ''}
      ${t.catalyst ? `<p><span class="bc-k">시장</span>${esc(t.catalyst)}</p>` : ''}
      ${t.reason ? `<p><span class="bc-k">판단</span>${esc(t.reason)}</p>` : ''}
      ${t.scenario ? `<p><span class="bc-k">내일</span>${esc(t.scenario)}</p>` : ''}
    </div>${cardImgs(pics(t.id).buy)}`).join('')}</div>` : '';
  const noteSec = note ? `<div class="bc-sec"><div class="bc-sec-t">📝 시황 메모</div><div class="bc-panel"><p style="margin:0">${esc(note)}</p></div></div>` : '';
  const empty = !closed.length && !opened.length && !flats.length && !note ? `<div class="bc-panel" style="margin-top:20px">이 날짜 기록이 없음</div>` : '';
  return cardShell(o, head + hero + closedSec + openSec + flatSec + noteSec + empty);
}

/* ---- 월간 결산 ---- */
function monthCardHTML(ym, o) {
  const st = computeStats(closedIn(liveTrades(), ym), settings);
  const flatDays = new Set(liveTrades().filter(t => t.status === 'flat' && (t.buyDate || '').startsWith(ym)).map(t => t.buyDate));
  const ratio = v => v === Infinity ? '∞' : v.toFixed(2);
  const kpis = [
    ['승률', st.winRate.toFixed(1) + '%', `${st.wins}승 ${st.losses}패`],
    ['손익비', ratio(st.payoff), `평균 ${fmtPct(st.avgWinPct, 1)} / ${fmtPct(st.avgLossPct, 1)}`],
    ['매매 횟수', st.n + '회', flatDays.size ? `무포지션 ${flatDays.size}일` : `평균 보유 ${st.avgHold.toFixed(1)}일`],
    ['기대값', fmtPct(st.expectancy), '매매 1회당'],
    ['Profit Factor', ratio(st.profitFactor), '총수익 ÷ 총손실'],
    ['최대 연승', st.maxWinStreak + '연승', '최대 연패 ' + st.maxLossStreak],
    ['최고 매매', st.best ? fmtPct(st.best.c.pct, 1) : '-', st.best ? st.best.t.name : ''],
    ['최악 매매', st.worst ? fmtPct(st.worst.c.pct, 1) : '-', st.worst ? st.worst.t.name : ''],
  ];
  const sumPct = st.rows.reduce((a, r) => a + r.c.pct, 0);
  const head = `<div class="bc-kicker">월간 결산</div><div class="bc-title">${ymLabel(ym)} 매매 결산</div>`;
  const hero = `<div class="bc-hero"><div><div class="bc-sub" style="margin:0 0 6px">${o.masked ? '수익률 합계' : '실현 손익 (수수료·세금 차감)'}</div>
    <div class="big ${pnlClass(st.net)}">${o.masked ? fmtPct(sumPct, 1) : fmtSigned(st.net) + '원'}</div></div>
    ${o.masked ? '' : `<div style="text-align:right;font-size:15px;color:var(--b-muted);font-weight:700">수수료 ${fmtNum(st.fees)}<br>세금 ${fmtNum(st.taxes)}</div>`}</div>`;
  const grid = `<div class="bc-sec"><div class="bc-grid">${kpis.map(([l, v, s]) => `<div class="bc-kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`).join('')}</div></div>`;
  // 캘린더
  const [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate();
  let cells = ['일', '월', '화', '수', '목', '금', '토'].map(w => `<div class="w">${w}</div>`).join('');
  for (let i = 0; i < first; i++) cells += '<div class="c e"></div>';
  for (let d = 1; d <= last; d++) {
    const ds = ym + '-' + pad2(d), v = st.byDay[ds];
    const dayRows = v ? st.rows.filter(r => r.t.sellDate === ds) : [];
    const dp = v ? dayRows.reduce((a, r) => a + r.c.net, 0) / dayRows.reduce((a, r) => a + r.c.buyAmt, 0) * 100 : 0;
    cells += `<div class="c ${v ? (v.net > 0 ? 'u' : v.net < 0 ? 'dn' : '') : ''}"><span class="dd">${d}${flatDays.has(ds) ? ' 😴' : ''}</span>${v ? `<span class="vv ${pnlClass(v.net)}">${o.masked ? fmtPct(dp, 1) : fmtCompact(v.net)}</span>` : flatDays.has(ds) ? '<span class="vv" style="color:var(--b-muted)">관망</span>' : ''}</div>`;
  }
  const cal = `<div class="bc-sec"><div class="bc-sec-t">🗓 손익 캘린더</div><div class="bc-cal">${cells}</div></div>`;
  const curve = `<div class="bc-sec"><div class="bc-sec-t">📈 누적 ${o.masked ? '수익률' : '손익'} <small>청산 순서</small></div><div class="chart-box"><canvas data-card-chart="equity"></canvas></div></div>`;
  const topR = st.byReason.slice(0, 4), topM = st.byMistake.filter(g => g.net < 0).sort((a, b) => a.net - b.net).slice(0, 3);
  const tags = (topR.length || topM.length) ? `<div class="bc-sec"><div class="bc-grid" style="grid-template-columns:1fr 1fr">
    <div class="bc-panel" style="font-size:16px"><b>근거별 승률</b>${topR.map(g => `<div style="display:flex;justify-content:space-between;margin-top:6px"><span>${esc(g.key)}</span><b>${g.winRate.toFixed(0)}% <span style="color:var(--b-muted);font-weight:600">(${g.n})</span></b></div>`).join('')}</div>
    <div class="bc-panel" style="font-size:16px"><b>손실 키운 실수</b>${topM.length ? topM.map(g => `<div style="display:flex;justify-content:space-between;margin-top:6px"><span>${esc(g.key)}</span><b class="down">${o.masked ? g.n + '회' : fmtCompact(g.net)}</b></div>`).join('') : '<div style="margin-top:6px;color:var(--b-muted)">없음 👍</div>'}</div>
  </div></div>` : '';
  return cardShell(o, head + hero + grid + cal + curve + tags);
}

function drawCardCharts(root, kind, payload, o) {
  if (kind !== 'month') return;
  const cv = root.querySelector('[data-card-chart="equity"]');
  if (!cv) return;
  const st = computeStats(closedIn(liveTrades(), payload), settings);
  let cum = 0;
  const pts = st.rows.length ? [{ label: Number(payload.slice(5)) + '/1', value: 0 }] : [];
  st.rows.forEach(r => { cum += o.masked ? r.c.pct : r.c.net; pts.push({ label: mdLabel(r.t.sellDate).replace(/\(.\)/, ''), value: cum }); });
  const bc = root.querySelector('.bcard') || root;
  const pal = Object.assign(chartPalette(bc), { font: '"Pretendard Variable", Pretendard, sans-serif' });
  drawLineChart(cv, pts, { height: 230, palette: pal, fontSize: 14, padL: 64, interactive: false,
    fmtAxis: o.masked ? (v => v.toFixed(0) + '%') : (v => fmtCompact(v).replace('+', '')),
    fmtTip: o.masked ? (v => fmtPct(v, 1)) : (v => fmtCompact(v)) });
}

/* ---- 미리보기 + 저장/복사/공유 ---- */
let cardState = null;
async function openCard(kind, payload) {
  cardState = { kind, payload, theme: settings.cardTheme || 'light', masked: document.body.classList.contains('masked'), withBuyImg: true, withSellImg: true };
  const t = kind === 'trade' ? getTrade(payload) : null;
  const imgTrades = t ? [t] : kind === 'day' ? (p => [...p.closed, ...p.opened, ...p.flats])(dayParts(payload)) : [];
  const title = kind === 'trade' ? '블로그 카드 — ' + t.name : kind === 'day' ? '일일 카드 — ' + mdLabel(payload) : '결산 카드 — ' + ymLabel(payload);
  openSheet(title, `
    <div class="row wrap" style="margin-bottom:10px">
      <div class="seg" id="cd-theme"><button data-v="light">라이트</button><button data-v="dark">다크</button></div>
      <button class="chip" id="cd-mask">금액 숨김</button>
      ${imgTrades.some(x => (x.imgIds || []).length) ? '<button class="chip" id="cd-bimg">매수 캡처</button>' : ''}
      ${imgTrades.some(x => (x.sellImgIds || []).length) ? '<button class="chip" id="cd-simg">매도 캡처</button>' : ''}
    </div>
    <div class="card-preview-wrap" id="cd-wrap"><div class="card-preview-scale" id="cd-prev"></div></div>
    <div class="sheet-foot btn-row">
      <button class="btn primary" id="cd-save">⬇ 이미지 저장</button>
      <button class="btn" id="cd-copy">⧉ 복사</button>
      ${navigator.canShare ? '<button class="btn" id="cd-share">↗ 공유</button>' : ''}
    </div>`);
  const sync = () => {
    document.querySelectorAll('#cd-theme button').forEach(b => b.classList.toggle('on', b.dataset.v === cardState.theme));
    document.getElementById('cd-mask').classList.toggle('on', cardState.masked);
    const bb = document.getElementById('cd-bimg'); if (bb) bb.classList.toggle('on', cardState.withBuyImg);
    const sb = document.getElementById('cd-simg'); if (sb) sb.classList.toggle('on', cardState.withSellImg);
  };
  document.querySelectorAll('#cd-theme button').forEach(b => b.onclick = () => { cardState.theme = b.dataset.v; settings.cardTheme = b.dataset.v; saveSettings(); sync(); renderPreview(); });
  document.getElementById('cd-mask').onclick = () => { cardState.masked = !cardState.masked; sync(); renderPreview(); };
  // 매수·매도 캡처 따로 끄기 (예: 금액 숨김일 때 체결 화면 캡처만 빼기)
  const bb = document.getElementById('cd-bimg'); if (bb) bb.onclick = () => { cardState.withBuyImg = !cardState.withBuyImg; sync(); renderPreview(); };
  const sbi = document.getElementById('cd-simg'); if (sbi) sbi.onclick = () => { cardState.withSellImg = !cardState.withSellImg; sync(); renderPreview(); };
  document.getElementById('cd-save').onclick = () => exportCard('save');
  document.getElementById('cd-copy').onclick = () => exportCard('copy');
  const sb = document.getElementById('cd-share'); if (sb) sb.onclick = () => exportCard('share');
  sync(); await renderPreview();
}
async function cardHTML() {
  const { kind, payload } = cardState, o = { theme: cardState.theme, masked: cardState.masked };
  const load = (on, ids) => on ? Promise.all((ids || []).map(getImage)).then(a => a.filter(Boolean)) : [];
  if (kind === 'trade') {
    const t = getTrade(payload);
    [o.buyImgs, o.sellImgs] = await Promise.all([load(cardState.withBuyImg, t.imgIds), load(cardState.withSellImg, t.sellImgIds)]);
    return tradeCardHTML(t, o);
  }
  if (kind === 'day') {   // 그날 카드에 나오는 매매들의 사진을 미리 읽어 둠 (매도 사진은 청산된 매매만)
    const p = dayParts(payload);
    o.imgMap = {};
    await Promise.all([...p.closed, ...p.opened, ...p.flats].map(async t => {
      const [buy, sell] = await Promise.all([load(cardState.withBuyImg, t.imgIds), load(cardState.withSellImg && t.status === 'closed', t.sellImgIds)]);
      o.imgMap[t.id] = { buy, sell };
    }));
    return dayCardHTML(payload, o);
  }
  return monthCardHTML(payload, o);
}
async function renderPreview() {
  const prev = document.getElementById('cd-prev'), wrap = document.getElementById('cd-wrap');
  if (!prev) return;
  prev.innerHTML = await cardHTML();
  const scale = Math.min(1, wrap.clientWidth / 720);
  prev.style.transform = `scale(${scale})`; prev.style.width = '720px';
  // 차트는 원본 크기로 그린 뒤 축소 표시
  drawCardCharts(prev, cardState.kind, cardState.payload, cardState);
  await imagesReady(prev);   // 첨부 이미지가 다 읽힌 뒤 높이를 재야 미리보기가 잘리지 않음
  wrap.style.height = Math.ceil(prev.firstElementChild.offsetHeight * scale) + 'px';
}
function imagesReady(root) {
  return Promise.all([...root.querySelectorAll('img')].map(img => (img.decode ? img.decode() : Promise.resolve()).catch(() => {})));
}
async function renderCardCanvas() {
  if (typeof html2canvas === 'undefined') throw new Error('캡처 라이브러리 로드 실패 (인터넷 연결 확인)');
  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;left:-10000px;top:0;width:720px;';
  stage.innerHTML = await cardHTML();
  document.body.appendChild(stage);
  drawCardCharts(stage, cardState.kind, cardState.payload, cardState);
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  await imagesReady(stage);
  try {
    const el = stage.firstElementChild;
    // 사진이 많아 아주 길어지면 브라우저 캔버스 한계(높이 약 32,000px)를 넘지 않게 배율을 낮춤
    const h = Math.max(1, el.offsetHeight), ua = navigator.userAgent;
    let scale = Math.min(2, 30000 / h);
    if (/iPhone|iPad|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|Edg|Android/.test(ua)))
      scale = Math.min(scale, Math.sqrt(16e6 / (720 * h)));   // 아이폰·사파리는 캔버스 면적 한도(약 1,670만 픽셀)
    scale = Math.max(scale, 0.5);
    return await html2canvas(el, { scale, backgroundColor: getComputedStyle(el).backgroundColor, useCORS: true, logging: false });
  } finally { stage.remove(); }
}
function cardFileName() {
  const { kind, payload } = cardState;
  const t = kind === 'trade' ? getTrade(payload) : null;
  return 'tradebook_' + (kind === 'trade' ? (t.sellDate || t.buyDate).replace(/-/g, '') + '_' + t.name : kind === 'day' ? payload.replace(/-/g, '') : payload.replace('-', '') + '_결산') + '.png';
}
async function exportCard(mode) {
  try {
    toast('이미지 만드는 중…');
    const canvas = await renderCardCanvas();
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const name = cardFileName();
    if (mode === 'copy') {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('클립보드에 복사됨 — 블로그 에디터에 붙여넣기');
    } else if (mode === 'share') {
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: name });
      else throw new Error('이 기기는 이미지 공유 미지원');
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('저장됨: ' + name);
    }
  } catch (e) { if (e.name !== 'AbortError') toast('실패: ' + e.message); }
}
