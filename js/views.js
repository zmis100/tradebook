/* 트레이드북 화면 — 홈(복기 대기) / 일지 / 결산 / 설정 */
'use strict';

let listYm = ymOf(todayStr()), statsYm = ymOf(todayStr()), listFilter = 'all', listQuery = '';
const ratioTxt = v => v === Infinity ? '∞' : isFinite(v) ? v.toFixed(2) : '-';

function tradeRowHTML(t) {
  if (t.status === 'flat') return `<button class="trade-row" data-open="${t.id}">
    <div class="tr-main"><div class="tr-name">😴 무포지션</div><div class="tr-sub">${esc([(t.tags || []).slice(0, 3).join(' · '), t.catalyst].filter(Boolean).join(' / ')) || '&nbsp;'}</div></div>
    <div class="tr-pnl"><small class="muted">—</small></div></button>`;
  const c = calcTrade(t, settings);
  const sub = [t.strategy, (t.tags || []).slice(0, 2).join(' · ')].filter(Boolean).join(' · ');
  return `<button class="trade-row" data-open="${t.id}">
    <div class="tr-main"><div class="tr-name">${esc(t.name)} ${c ? '' : '<span class="badge open">보유</span>'}</div><div class="tr-sub">${esc(sub) || '&nbsp;'}</div></div>
    <div class="tr-pnl">${c ? `<span class="${pnlClass(c.net)}">${fmtPct(c.pct)}</span><small class="${pnlClass(c.net)} amt">${amt(c.net)}</small>` : `<small class="muted">${fmtNum(t.buyPrice)}원</small>`}</div></button>`;
}
function bindRows(root) { root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openTradeDetail(b.dataset.open)); }

/* ===== 홈 ===== */
function renderHome() {
  const el = document.getElementById('tab-home'), live = liveTrades(), today = todayStr();
  if (!live.length) {
    el.innerHTML = `<div class="card empty" style="padding:32px 18px">
      <div style="font-size:40px">📒</div><h3 style="justify-content:center;font-size:18px;margin-top:8px">매매일지</h3>
      <p class="sub" style="font-size:14px;line-height:1.7">① 매수 직후 <b>근거를 30초 안에 박제</b><br>② 매도 후 그 근거를 보면서 <b>결과·복기</b><br>③ 블로그용 <b>카드 이미지</b>와 <b>월간 결산</b>은 자동</p>
      <div class="btn-row" style="max-width:360px;margin:16px auto 0"><button class="btn primary" id="h-first">＋ 첫 매수 기록</button><button class="btn" id="h-demo">샘플로 둘러보기</button></div></div>`;
    document.getElementById('h-first').onclick = () => openBuyForm();
    document.getElementById('h-demo').onclick = loadDemo;
    return;
  }
  const st = computeStats(closedIn(live, ymOf(today)), settings);
  const open = live.filter(t => t.status === 'open').sort((a, b) => a.buyDate.localeCompare(b.buyDate));
  const closedToday = sortClosed(live.filter(t => t.status === 'closed' && t.sellDate === today));
  const flatToday = live.filter(t => t.buyDate === today && t.status === 'flat');
  const note = getDayNote(today);
  el.innerHTML = `
    <div class="hello"><strong>${Number(today.slice(5, 7))}월 ${Number(today.slice(8))}일 (${dowOf(today)})</strong><span class="muted">${ymLabel(ymOf(today))} 누적</span></div>
    <div class="card"><div class="mini-kpis">
      <div><span>실현 손익</span><b class="${pnlClass(st.net)} amt">${masked() ? '•••' : fmtCompact(st.net)}</b></div>
      <div><span>승률</span><b>${st.n ? st.winRate.toFixed(0) + '%' : '-'}</b></div>
      <div><span>손익비</span><b>${st.n ? ratioTxt(st.payoff) : '-'}</b></div>
      <div><span>매매</span><b>${st.n}회</b></div></div></div>

    <div class="sec-title">⏳ 복기 대기 <span class="count">${open.length}건 · 매수 때 남긴 근거</span></div>
    ${open.length ? open.map(t => `<div class="card pending">
      <div class="pos-head"><div><div class="pos-name">${esc(t.name)}</div><div class="pos-meta">${esc(t.strategy || '')} · ${mdLabel(t.buyDate)} ${esc(t.buyTime || '')} · ${fmtNum(t.buyPrice)}원 × <span class="amt">${masked() ? '•••' : fmtNum(t.qty)}</span></div></div>
      <button class="btn small ghost" data-open="${t.id}">상세</button></div>
      ${thesisBlock(t)}
      <button class="btn primary block" data-sell="${t.id}">결과 기록하기</button></div>`).join('')
      : '<div class="card empty">보유 중인 종목 없음 — 매수하면 ＋기록 (쉬는 날은 무포지션으로 이유만)</div>'}

    <div class="sec-title">📝 오늘 <span class="count">${closedToday.length + open.filter(t => t.buyDate === today).length + flatToday.length}건</span></div>
    <div class="card">
      ${closedToday.length ? `<div class="label">📊 청산 결과</div>${closedToday.map(tradeRowHTML).join('')}` : ''}
      ${flatToday.length ? `<div class="label">😴 무포지션</div>${flatToday.map(tradeRowHTML).join('')}` : ''}
      <div class="label" style="margin-top:6px">시황 메모</div>
      ${note ? `<div class="thesis" style="margin-top:0"><p style="margin:0">${esc(note)}</p></div>` : '<p class="muted" style="margin:0 0 10px;font-size:14px">오늘 시장 분위기·내일 체크할 것</p>'}
      <div class="btn-row"><button class="btn small" id="h-note">${note ? '메모 수정' : '메모 쓰기'}</button>
        <button class="btn small accent" id="h-card">오늘 일일 카드</button><button class="btn small" id="h-blog">AI 블로그 초안</button></div>
    </div>`;
  bindRows(el);
  el.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => openSellForm(b.dataset.sell));
  document.getElementById('h-note').onclick = () => openDayNote(today);
  document.getElementById('h-card').onclick = () => openCard('day', today);
  document.getElementById('h-blog').onclick = () => showAiResult('블로그 초안 — ' + mdLabel(today), () => aiBlogDraft(today, masked()));
}

/* ===== 일지 ===== */
function renderList() {
  const el = document.getElementById('tab-list');
  const q = listQuery.toLowerCase();
  const items = liveTrades().filter(t => {
    const d = t.status === 'closed' ? t.sellDate : t.buyDate;
    if (!(d || '').startsWith(listYm) && !(t.status === 'open' && listFilter === 'open')) return false;
    const c = calcTrade(t, settings);
    if (listFilter === 'open' && t.status !== 'open') return false;
    if (listFilter === 'win' && !(c && c.net > 0)) return false;
    if (listFilter === 'loss' && !(c && c.net < 0)) return false;
    if (q && ![t.name, t.status === 'flat' ? '무포지션' : '', ...(t.tags || []), t.catalyst, t.reason, t.scenario, t.review, ...(t.mistakes || [])]
      .filter(Boolean).join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
  const groups = {};
  for (const t of items) { const d = t.status === 'closed' ? t.sellDate : t.buyDate; (groups[d] = groups[d] || []).push(t); }
  const dates = Object.keys(groups).sort().reverse();
  el.innerHTML = `
    <div class="month-nav"><button class="icon-btn" data-ym="-1" aria-label="이전 달">◀</button><strong>${ymLabel(listYm)}</strong><button class="icon-btn" data-ym="1" aria-label="다음 달">▶</button></div>
    <div class="filters"><input id="l-q" type="search" placeholder="종목·근거·복기 검색" value="${esc(listQuery)}"></div>
    <div class="chips" style="margin-bottom:12px" id="l-f">${[['all', '전체'], ['open', '보유'], ['win', '수익'], ['loss', '손실']].map(([k, l]) => `<button class="chip${listFilter === k ? ' on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    ${dates.length ? dates.map(d => {
      const net = groups[d].reduce((a, t) => a + ((calcTrade(t, settings) || {}).net || 0), 0);
      return `<div class="day-group"><div class="day-head"><span>${mdLabel(d)}</span><span><span class="${pnlClass(net)} amt">${net ? amt(net) : ''}</span> <button class="btn small ghost" style="min-height:26px;padding:2px 8px" data-daycard="${d}">카드</button></span></div>${groups[d].map(tradeRowHTML).join('')}</div>`;
    }).join('') : '<div class="card empty">이 달 기록 없음</div>'}`;
  el.querySelectorAll('[data-ym]').forEach(b => b.onclick = () => { listYm = addMonths(listYm, Number(b.dataset.ym)); renderList(); });
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { listFilter = b.dataset.f; renderList(); });
  el.querySelectorAll('[data-daycard]').forEach(b => b.onclick = () => openCard('day', b.dataset.daycard));
  const qi = document.getElementById('l-q');
  qi.oninput = () => { listQuery = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { renderList(); const n = document.getElementById('l-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  bindRows(el);
}

/* ===== 결산 ===== */
function hbarsHTML(groups, mode) {
  if (!groups.length) return '<p class="muted" style="font-size:13px;margin:0">데이터 없음</p>';
  const max = Math.max(...groups.map(g => mode === 'loss' ? Math.abs(g.net) : g.winRate), 1);
  return `<div class="hbars">${groups.map(g => {
    const v = mode === 'loss' ? Math.abs(g.net) : g.winRate;
    const right = mode === 'loss' ? `<span class="down amt">${masked() ? g.n + '회' : fmtCompact(g.net)}</span> · ${g.n}회` : `${g.winRate.toFixed(0)}% · ${g.n}회 · <span class="${pnlClass(g.avgPct)}">${fmtPct(g.avgPct, 1)}</span>`;
    return `<div class="hbar"><span class="hl" title="${esc(g.key)}">${esc(g.key)}</span><span class="track"><span class="fill" style="width:${(v / max * 100).toFixed(1)}%;${mode === 'loss' ? 'background:var(--down)' : ''}"></span></span><span class="hv">${right}</span></div>`;
  }).join('')}</div>`;
}
/* 여러 그룹을 한 표로 (열 정렬 유지) — sections: [[groups, 제목], ...] */
function perfTable(sections) {
  const body = sections.filter(([g]) => g.length).map(([groups, title]) =>
    `<tr class="grp"><th>${title}</th><th>횟수</th><th>승률</th><th>평균</th></tr>` +
    groups.map(g => `<tr><td>${esc(g.key)}</td><td>${g.n}</td><td>${g.winRate.toFixed(0)}%</td><td class="${pnlClass(g.avgPct)}">${fmtPct(g.avgPct, 2)}</td></tr>`).join('')).join('');
  return body ? `<table class="table"><tbody>${body}</tbody></table>` : '';
}
function renderStats() {
  const el = document.getElementById('tab-stats'), live = liveTrades();
  const st = computeStats(closedIn(live, statsYm), settings);
  const flatDays = new Set(live.filter(t => t.status === 'flat' && (t.buyDate || '').startsWith(statsYm)).map(t => t.buyDate));
  const year = statsYm.slice(0, 4), ym12 = yearMonthly(live, year, settings);
  const [y, m] = statsYm.split('-').map(Number), first = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate(), today = todayStr();
  let cal = ['일', '월', '화', '수', '목', '금', '토'].map(w => `<div class="dow">${w}</div>`).join('');
  for (let i = 0; i < first; i++) cal += '<div class="cell blank"></div>';
  for (let d = 1; d <= last; d++) {
    const ds = statsYm + '-' + pad2(d), v = st.byDay[ds], flat = flatDays.has(ds);
    cal += `<button class="cell ${v ? pnlClass(v.net) : ''} ${ds === today ? 'today' : ''}" ${v || flat ? `data-day="${ds}"` : 'tabindex="-1"'} aria-label="${ds}${v ? ' ' + fmtSigned(v.net) : ''}${flat ? ' 무포지션' : ''}"><span class="d">${d}${flat ? ' 😴' : ''}</span>${v ? `<span class="v ${pnlClass(v.net)}">${masked() ? v.wins + '/' + v.n : fmtCompact(v.net)}</span>` : ''}</button>`;
  }
  el.innerHTML = `
    <div class="month-nav"><button class="icon-btn" data-sym="-1" aria-label="이전 달">◀</button><strong>${ymLabel(statsYm)} 결산</strong><button class="icon-btn" data-sym="1" aria-label="다음 달">▶</button></div>
    <div class="kpi-grid">
      <div class="kpi hero"><div class="kl">실현 손익 · 수수료·세금 차감</div><div class="kv ${pnlClass(st.net)} amt">${masked() ? '•••' : fmtSigned(st.net) + '원'}</div><div class="ks">수수료 ${masked() ? '•••' : fmtNum(st.fees)} · 세금 ${masked() ? '•••' : fmtNum(st.taxes)}</div></div>
      <div class="kpi"><div class="kl">승률</div><div class="kv">${st.n ? st.winRate.toFixed(1) + '%' : '-'}</div><div class="ks">${st.wins}승 ${st.losses}패${st.flats ? ' ' + st.flats + '무' : ''}</div></div>
      <div class="kpi"><div class="kl">손익비</div><div class="kv">${st.n ? ratioTxt(st.payoff) : '-'}</div><div class="ks">평균 ${fmtPct(st.avgWinPct, 1)} / ${fmtPct(st.avgLossPct, 1)}</div></div>
      <div class="kpi"><div class="kl">매매 횟수</div><div class="kv">${st.n}회</div><div class="ks">평균 보유 ${st.avgHold.toFixed(1)}일${flatDays.size ? ' · 무포지션 ' + flatDays.size + '일' : ''}</div></div>
      <div class="kpi"><div class="kl">기대값 (1회당)</div><div class="kv ${pnlClass(st.expectancy)}">${st.n ? fmtPct(st.expectancy) : '-'}</div><div class="ks">승률×평균수익 + 패율×평균손실</div></div>
      <div class="kpi"><div class="kl">Profit Factor</div><div class="kv">${st.n ? ratioTxt(st.profitFactor) : '-'}</div><div class="ks">총수익 ÷ 총손실</div></div>
      <div class="kpi"><div class="kl">최대 연승 / 연패</div><div class="kv">${st.maxWinStreak} / ${st.maxLossStreak}</div><div class="ks">청산 순서 기준</div></div>
      <div class="kpi"><div class="kl">최대 낙폭 (MDD)</div><div class="kv down amt">${masked() ? '•••' : st.mdd ? '−' + fmtCompact(st.mdd).replace(/^[+−]/, '') : '0'}</div><div class="ks">누적 손익 고점 대비</div></div>
    </div>
    <div class="btn-row" style="margin:12px 0"><button class="btn accent" id="s-card">결산 카드 (블로그)</button><button class="btn" id="s-coach">AI 월간 코칭</button></div>
    <div class="two-col">
      <div class="card"><h3>🗓 손익 캘린더 <span class="count muted" style="font-size:12px">${masked() ? '승/매매' : '일별 실현손익'}${flatDays.size ? ' · 😴 무포지션' : ''}</span></h3><div class="cal">${cal}</div></div>
      <div class="card"><h3>📈 누적 손익 <span class="muted" style="font-size:12px">청산 순서</span></h3><div class="chart-box"><canvas id="c-eq"></canvas></div>
        <h3 style="margin-top:16px">일별 손익</h3><div class="chart-box"><canvas id="c-day"></canvas></div></div>
    </div>
    <div class="two-col" style="margin-top:12px">
      <div class="card"><h3>근거별 승률 <span class="muted" style="font-size:12px">어떤 근거가 먹히나</span></h3>${hbarsHTML(st.byReason.slice(0, 8))}</div>
      <div class="card"><h3>손실 키운 실수 <span class="muted" style="font-size:12px">손실 합계</span></h3>${hbarsHTML(st.byMistake.filter(g => g.net < 0).sort((a, b) => a.net - b.net), 'loss')}</div>
    </div>
    <div class="card" style="margin-top:12px"><h3>과정 점검 <span class="muted" style="font-size:12px">근거를 지키면 결과가 좋은가</span></h3>
      <div class="scroll-x">${perfTable([[st.byPlan, '계획대로 여부'], [st.byThesis, '근거 적중'], [st.byConfidence, '확신도'], [st.byStrategy, '전략']])}</div>
      ${st.n ? '' : '<p class="muted" style="margin:0;font-size:13px">청산된 매매가 쌓이면 표시</p>'}</div>
    <div class="card"><h3>${year}년 월별 손익</h3><div class="chart-box"><canvas id="c-year"></canvas></div>
      <details class="tv"><summary>표로 보기</summary><table class="table"><thead><tr><th>월</th><th>매매</th><th>승률</th><th>손익</th></tr></thead><tbody>${ym12.filter(r => r.n).map(r => `<tr><td>${Number(r.ym.slice(5))}월</td><td>${r.n}</td><td>${r.winRate.toFixed(0)}%</td><td class="${pnlClass(r.net)} amt">${amt(r.net)}</td></tr>`).join('') || '<tr><td colspan="4">데이터 없음</td></tr>'}</tbody></table></details></div>
    <div class="card"><h3>이 달 매매 전체 <span class="count muted" style="font-size:12px">${st.n}건</span></h3><div class="scroll-x"><table class="table"><thead><tr><th>청산일</th><th>종목</th><th>수익률</th><th>손익</th><th>근거 적중</th></tr></thead><tbody>
      ${st.rows.map(r => `<tr data-open="${r.t.id}" style="cursor:pointer"><td>${mdLabel(r.t.sellDate)}</td><td style="text-align:left">${esc(r.t.name)}</td><td class="${pnlClass(r.c.net)}">${fmtPct(r.c.pct)}</td><td class="${pnlClass(r.c.net)} amt">${amt(r.c.net)}</td><td>${r.t.thesisHit || ''}</td></tr>`).join('')}</tbody></table></div></div>`;

  el.querySelectorAll('[data-sym]').forEach(b => b.onclick = () => { statsYm = addMonths(statsYm, Number(b.dataset.sym)); renderStats(); });
  el.querySelectorAll('[data-day]').forEach(b => b.onclick = () => openCard('day', b.dataset.day));
  bindRows(el);
  document.getElementById('s-card').onclick = () => openCard('month', statsYm);
  document.getElementById('s-coach').onclick = () => showAiResult('AI 월간 코칭 — ' + ymLabel(statsYm), () => aiMonthCoach(statsYm));
  // 차트
  const mk = masked();
  let cum = 0;
  const eqPts = st.rows.length ? [{ label: Number(statsYm.slice(5)) + '/1', value: 0, sub: '월초' }] : [];
  st.rows.forEach(r => { cum += mk ? r.c.pct : r.c.net; eqPts.push({ label: mdLabel(r.t.sellDate), value: cum, sub: r.t.name }); });
  drawLineChart(document.getElementById('c-eq'), eqPts, {
    height: 190, fmtAxis: mk ? (v => v.toFixed(0) + '%') : undefined, fmtTip: mk ? (v => fmtPct(v, 1)) : (v => fmtSigned(v) + '원'), fmtEnd: mk ? (v => fmtPct(v, 1)) : fmtCompact });
  const dayBars = [];
  for (let d = 1; d <= last; d++) { const ds = statsYm + '-' + pad2(d); if (['토', '일'].includes(dowOf(ds))) continue; const v = st.byDay[ds]; dayBars.push({ label: String(d), value: v ? v.net : 0, sub: v ? `${v.n}건 ${v.wins}승` : '' }); }
  drawBarChart(document.getElementById('c-day'), dayBars, { height: 150, maxXLabels: 6, fmtAxis: mk ? (() => '') : undefined, padL: mk ? 12 : 48, fmtTip: mk ? (v => (v > 0 ? '수익' : '손실')) : (v => fmtSigned(v) + '원') });
  drawBarChart(document.getElementById('c-year'), ym12.map(r => ({ label: Number(r.ym.slice(5)) + '월', value: r.net, sub: r.n ? `${r.n}회 · 승률 ${r.winRate.toFixed(0)}%` : '' })), {
    height: 170, maxXLabels: 12, fmtAxis: mk ? (() => '') : undefined, padL: mk ? 12 : 48, fmtTip: mk ? (v => (v > 0 ? '수익' : '손실')) : (v => fmtSigned(v) + '원') });
}

/* ===== 설정 ===== */
function renderSettings() {
  const el = document.getElementById('tab-settings'), s = settings;
  const hasDemo = trades.some(t => t.demo && !t.deleted);
  el.innerHTML = `
    <div class="card"><h3>수수료 · 세금 <span class="muted" style="font-size:12px">%</span></h3>
      <div class="grid3"><label class="field"><span>매수 수수료</span><input id="st-fb" inputmode="decimal" value="${s.feeBuy}"></label>
        <label class="field"><span>매도 수수료</span><input id="st-fs" inputmode="decimal" value="${s.feeSell}"></label>
        <label class="field"><span>매도 세금</span><input id="st-tx" inputmode="decimal" value="${s.taxSell}"></label></div>
      <p class="hint" style="margin-top:-4px">2026년~ 매도 세금 0.20% (코스피 거래세 0.05%+농특세 0.15%, 코스닥 0.20%). 수수료는 증권사 요율로.</p></div>

    <div class="card"><h3>블로그</h3>
      <label class="field"><span>카드 하단 서명 <small>(블로그 이름·닉네임)</small></span><input id="st-blog" value="${esc(s.blogName)}" placeholder="예: 종베하는 직장인"></label>
      <label class="field"><span>내 글 말투 샘플 <small>(AI 블로그 초안이 이 말투를 따라감)</small></span><textarea id="st-style" placeholder="예전 매매일지 글 하나를 붙여넣기">${esc(s.styleSample)}</textarea></label></div>

    <div class="card"><h3>태그 · 전략 <span class="muted" style="font-size:12px">쉼표로 구분</span></h3>
      <label class="field"><span>매수 근거 태그</span><textarea id="st-rt">${esc(s.reasonTags.join(', '))}</textarea></label>
      <label class="field"><span>실수 태그</span><textarea id="st-mt">${esc(s.mistakeTags.join(', '))}</textarea></label>
      <label class="field"><span>무포지션 이유 태그</span><textarea id="st-ft">${esc(s.flatTags.join(', '))}</textarea></label>
      <label class="field"><span>전략</span><input id="st-sg" value="${esc(s.strategies.join(', '))}"></label></div>

    <div class="card"><h3>Gemini AI <span class="muted" style="font-size:12px">무료 키: aistudio.google.com</span></h3>
      <label class="field"><span>API 키</span><input id="st-gk" type="password" autocomplete="off" value="${esc(s.geminiKey)}" placeholder="AIza…"></label>
      <label class="field"><span>글쓰기 모델 <small>(기본 gemini-3.5-flash · 혼잡·한도 초과 시 자동 전환 / 빠른 기록은 lite 고정)</small></span><input id="st-gm" list="st-gm-list" value="${esc(s.geminiModel)}"><datalist id="st-gm-list"></datalist></label>
      <div class="btn-row"><button class="btn small" id="st-gtest">연결 테스트</button><button class="btn small" id="st-glist">모델 목록 불러오기</button></div>
      <p class="hint" id="st-gmsg">무료 등급은 입력 내용이 구글 서비스 개선에 쓰일 수 있음 — 계좌번호 등 개인정보는 넣지 말 것. 키는 동기화로 내 다른 기기에도 전달됨.</p></div>

    <div class="card"><h3>클라우드 동기화 <span class="muted" style="font-size:12px">Supabase · 무료</span></h3>
      <label class="field"><span>Project URL</span><input id="st-su" value="${esc(s.supabaseUrl)}" placeholder="https://xxxx.supabase.co"></label>
      <label class="field"><span>publishable 키 <small>(예전 이름 anon · secret 키는 넣지 말 것)</small></span><input id="st-sk" type="password" autocomplete="off" value="${esc(s.supabaseKey)}"></label>
      <div class="btn-row"><button class="btn small primary" id="st-sync">저장 후 동기화</button><button class="btn small" id="st-sql">테이블 생성 SQL 복사</button></div>
      <p class="hint" id="sb-status">동기화: ${sbConfigured() ? '설정됨 (마지막: ' + (localStorage.getItem(LS.lastSync) || '없음') + ')' : '미설정 — 이 기기에만 저장 중'}</p></div>

    <div class="card"><h3>데이터</h3>
      <div class="btn-row"><button class="btn small" id="st-json">JSON 백업</button><label class="btn small">JSON 복원<input type="file" accept=".json,application/json" hidden id="st-restore"></label><button class="btn small" id="st-csv">CSV (엑셀)</button></div>
      <div class="btn-row" style="margin-top:8px">${hasDemo ? '<button class="btn small danger" id="st-demo-del">샘플 데이터 삭제</button>' : '<button class="btn small" id="st-demo">샘플 데이터 넣기</button>'}</div>
      <p class="hint">폰: 브라우저 메뉴 → "홈 화면에 추가" 하면 앱처럼 사용 (오프라인 OK)</p></div>
    <div class="btn-row" style="margin-bottom:20px"><button class="btn primary block" id="st-save">설정 저장</button></div>`;

  const list = v => v.split(',').map(x => x.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  const collect = () => {
    Object.assign(settings, {
      feeBuy: parseNum(val('st-fb')), feeSell: parseNum(val('st-fs')), taxSell: parseNum(val('st-tx')),
      blogName: val('st-blog'), styleSample: val('st-style'), reasonTags: list(val('st-rt')), mistakeTags: list(val('st-mt')), flatTags: list(val('st-ft')), strategies: list(val('st-sg')),
      geminiKey: val('st-gk'), geminiModel: val('st-gm') || DEFAULT_SETTINGS.geminiModel, supabaseUrl: val('st-su'), supabaseKey: val('st-sk'),
    });
    settings = applyConfigDefaults(normalizeSettings(settings)); saveSettings();
  };
  document.getElementById('st-save').onclick = () => { collect(); toast('저장됨'); renderSettings(); };
  document.getElementById('st-sync').onclick = () => { collect(); updateSyncBadge(sbConfigured() ? '연결 중…' : '미설정'); syncNow(true); };
  document.getElementById('st-sql').onclick = () => navigator.clipboard.writeText(SUPABASE_SQL).then(() => toast('SQL 복사됨 — Supabase SQL Editor에 붙여넣고 Run'));
  const gmsg = document.getElementById('st-gmsg');
  document.getElementById('st-gtest').onclick = async () => { collect(); gmsg.textContent = '테스트 중…'; try { const r = await gemini({ prompt: '"연결 성공"이라고만 답해.', temperature: 0, fast: true }); gmsg.textContent = '✅ ' + r.text.slice(0, 40) + ' (' + r.model + ')'; } catch (e) { gmsg.textContent = '❌ ' + e.message; } };
  document.getElementById('st-glist').onclick = async () => {
    collect(); gmsg.textContent = '불러오는 중…';
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': settings.geminiKey } });
      const data = await res.json(); if (!res.ok) throw new Error((data.error || {}).message || res.status);
      const names = (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''))
        .filter(n => /^gemini/.test(n) && !/embed|tts|live|image|transcribe|robotics|audio/.test(n));
      document.getElementById('st-gm-list').innerHTML = ['gemini-flash-latest', 'gemini-flash-lite-latest', ...names].map(n => `<option value="${esc(n)}">`).join('');
      gmsg.textContent = '✅ ' + names.length + '개 — 모델 칸을 탭하면 목록 표시 (flash 계열 권장)';
    } catch (e) { gmsg.textContent = '❌ ' + e.message; }
  };
  document.getElementById('st-json').onclick = () => download('tradebook_backup_' + todayStr() + '.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), trades, days, settings: { ...settings, supabaseKey: '', geminiKey: '' } }, null, 1), 'application/json');
  document.getElementById('st-restore').onchange = e => restoreJson(e.target.files[0]);
  document.getElementById('st-csv').onclick = exportCsv;
  const dd = document.getElementById('st-demo-del'); if (dd) dd.onclick = () => { trades = trades.filter(t => !t.demo); saveTrades(); toast('샘플 삭제됨'); renderSettings(); };   // 샘플은 동기화된 적 없으므로 로컬에서만 제거
  const dm = document.getElementById('st-demo'); if (dm) dm.onclick = loadDemo;
}

function loadDemo() { trades.push(...makeDemoData(todayStr())); saveTrades(); toast('샘플 데이터 추가 — 설정에서 언제든 삭제'); rerenderActive(); }
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function restoreJson(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result); if (!Array.isArray(d.trades)) throw new Error('형식 오류');
      const map = new Map(trades.map(t => [t.id, t])); let n = 0;
      for (const t of d.trades) { const cur = map.get(t.id); if (!cur || (t.updatedAt || 0) > (cur.updatedAt || 0)) { map.set(t.id, t); n++; } }
      trades = [...map.values()]; saveTrades();
      if (Array.isArray(d.days)) { const dm = new Map(days.map(x => [x.id, x])); d.days.forEach(x => { const c = dm.get(x.id); if (!c || x.updatedAt > c.updatedAt) dm.set(x.id, x); }); days = [...dm.values()]; saveDays(); }
      toast(`복원: ${n}건 반영 (최신 수정 우선 병합)`); rerenderActive();
    } catch (e) { toast('복원 실패: ' + e.message); }
  };
  r.readAsText(file);
}
function exportCsv() {
  const head = ['상태', '전략', '종목', '코드', '매수일', '매수시각', '매수가', '수량', '매도일', '매도시각', '매도가', '매도수량', '순손익', '수익률%', '수수료', '세금', '근거태그', '재료', '근거', '목표%', '손절%', '대응계획', '확신도', '근거기록시각', '근거적중', '계획대로', '실수', '복기', '배운점'];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = liveTrades().sort((a, b) => a.buyDate.localeCompare(b.buyDate)).map(t => {
    const c = calcTrade(t, settings) || {};
    return [t.status === 'open' ? '보유' : t.status === 'flat' ? '무포지션' : '청산', t.strategy, t.name, t.code, t.buyDate, t.buyTime, t.buyPrice, t.qty, t.sellDate, t.sellTime, t.sellPrice, t.sellQty, c.net, c.pct !== undefined ? c.pct.toFixed(2) : '', c.fee, c.tax,
      (t.tags || []).join('|'), t.catalyst, t.reason, t.targetPct, t.stopPct, t.scenario, t.confidence, t.thesisAt ? new Date(t.thesisAt).toLocaleString('ko-KR') : '', t.thesisHit, t.planKept, (t.mistakes || []).join('|'), t.review, t.lesson].map(q).join(',');
  });
  download('tradebook_' + todayStr() + '.csv', '﻿' + [head.map(q).join(','), ...rows].join('\r\n'), 'text/csv');
}
