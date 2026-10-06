/* 트레이드북 입력 폼 — 매수 기록(근거 박제) / 결과·복기 기록 / 시황 메모 / 매매 상세 */
'use strict';

const numInput = (id, val, ph) => `<input id="${id}" type="text" inputmode="decimal" autocomplete="off" placeholder="${ph || ''}" value="${val === undefined || val === null || val === '' ? '' : fmtNum(val, String(val).includes('.') ? 2 : 0)}">`;
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
/* 재료 확인: 네이버 뉴스 최신순 (Gemini 구글검색 연동은 무료 키에서 막혀 있음) */
const openNews = name => window.open('https://search.naver.com/search.naver?where=news&sort=1&query=' + encodeURIComponent(name), '_blank', 'noopener');
const nval = id => parseNum(val(id));
function bindCommaFormat(ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('blur', () => { const n = parseNum(el.value); if (isFinite(n)) el.value = fmtNum(n, Math.abs(n % 1) > 0 ? 2 : 0); }); });
}
function chipGroup(id, options, selected, multi, addable) {
  return `<div class="chips" id="${id}" data-multi="${multi ? 1 : 0}">${options.map(o => `<button type="button" class="chip${(multi ? selected.includes(o) : selected === o) ? ' on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}${addable ? '<button type="button" class="chip add" data-add>＋ 직접 추가</button>' : ''}</div>`;
}
function bindChips(id, settingsKey) {
  const box = document.getElementById(id);
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-add')) {
      const v = (prompt('추가할 항목') || '').trim(); if (!v) return;
      if (settingsKey && !settings[settingsKey].includes(v)) { settings[settingsKey].push(v); saveSettings(); }
      const nb = document.createElement('button'); nb.type = 'button'; nb.className = 'chip on'; nb.dataset.v = v; nb.textContent = v;
      box.insertBefore(nb, b); return;
    }
    if (box.dataset.multi === '1') b.classList.toggle('on');
    else box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
  });
}
const chipVals = id => [...document.querySelectorAll('#' + id + ' .chip.on')].map(b => b.dataset.v);
function setChips(id, vals) { document.querySelectorAll('#' + id + ' .chip').forEach(b => b.classList.toggle('on', vals.includes(b.dataset.v))); }
function segHTML(id, opts, cur) { return `<div class="seg" id="${id}">${opts.map(o => `<button type="button" data-v="${o}" class="${cur === o ? 'on' : ''}">${o}</button>`).join('')}</div>`; }
function bindSeg(id) { const box = document.getElementById(id); box.onclick = e => { const b = e.target.closest('button'); if (!b) return; const on = !b.classList.contains('on'); box.querySelectorAll('button').forEach(x => x.classList.remove('on')); if (on) b.classList.add('on'); }; }
const segVal = id => { const b = document.querySelector('#' + id + ' button.on'); return b ? b.dataset.v : ''; };
function starsHTML(cur) { return `<div class="stars" id="f-conf">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" class="${i <= (cur || 0) ? 'on' : ''}" aria-label="확신도 ${i}">★</button>`).join('')}</div>`; }
function bindStars() {
  const box = document.getElementById('f-conf');
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = Number(b.dataset.v); const cur = Number(box.dataset.v || 0); const nv = cur === v ? 0 : v; box.dataset.v = nv; box.querySelectorAll('button').forEach(x => x.classList.toggle('on', Number(x.dataset.v) <= nv)); };
}
function thesisBlock(t, title) {
  return `<div class="thesis"><div class="stamp"><span>${title || '📌 매수 근거'}</span><span>${t.thesisAt ? stampLabel(t.thesisAt) + ' 기록' : ''}${t.thesisEditedAt ? ' · ' + stampLabel(t.thesisEditedAt) + ' 수정' : ''}</span></div>
    ${(t.tags || []).length ? `<div class="chips">${t.tags.map(x => `<span class="chip static">${esc(x)}</span>`).join('')}</div>` : ''}
    ${t.catalyst ? `<p><span class="k">재료</span>${esc(t.catalyst)}</p>` : ''}
    ${t.reason ? `<p><span class="k">근거</span>${esc(t.reason)}</p>` : ''}
    ${planTxt(t) ? `<div class="plan-line"><span>${planTxt(t)}</span>${t.targetPct ? `<span class="muted">목표가 ${fmtNum(t.buyPrice * (1 + t.targetPct / 100))}</span>` : ''}${t.stopPct ? `<span class="muted">손절가 ${fmtNum(t.buyPrice * (1 + t.stopPct / 100))}</span>` : ''}</div>` : ''}
    ${t.scenario ? `<p><span class="k">시나리오</span>${esc(t.scenario)}</p>` : ''}
    ${t.confidence ? `<p><span class="k">확신도</span><span style="color:var(--warn)">${stars(t.confidence)}</span></p>` : ''}
    ${!(t.tags || []).length && !t.catalyst && !t.reason ? '<p class="muted">근거 기록 없음</p>' : ''}
  </div>`;
}

/* ===== 매수 기록 (근거 박제) ===== */
let formImgs = [];      // 이번 폼에서 새로 붙인 이미지 (취소 시 정리)
let buyPasteHandler = null;   // 매수 폼의 Ctrl+V 이미지 붙여넣기 (폼이 바뀌면 교체)
function openBuyForm(editId) {
  const t = editId ? JSON.parse(JSON.stringify(getTrade(editId))) : { id: uid(), status: 'open', strategy: settings.strategies[0], buyDate: todayStr(), tags: [], imgIds: [] };
  formImgs = [];
  openSheet(editId ? '매수 근거 수정' : '＋ 매수 기록', `
    ${chipGroup('f-strategy', settings.strategies, t.strategy, false)}
    <div class="field suggest" style="margin-top:12px"><span>종목</span>
      <input id="f-name" type="text" autocomplete="off" placeholder="종목명 또는 코드" value="${esc(t.name || '')}">
      <div class="suggest-list" id="f-suggest" hidden></div>
      <div class="hint" id="f-code-hint">${t.code ? esc(t.code) + ' · ' + (MARKET_LABEL[t.market] || '') : 'KRX 목록에서 자동완성 → 코드 자동 입력'}</div></div>
    <div class="grid2"><label class="field"><span>매수가</span>${numInput('f-bp', t.buyPrice, '원')}</label>
      <label class="field"><span>수량</span>${numInput('f-qty', t.qty, '주')}</label></div>
    <div class="calc-line" id="f-amt">매수금액 -</div>
    <label class="field"><span>매수일</span><input id="f-bd" type="date" value="${t.buyDate}"></label>

    <div class="ai-box"><span class="label">✨ 대충 쓰고 AI로 정리 <small>(폰 키보드 마이크로 말해도 됨)</small></span>
      <textarea id="f-raw" placeholder="예) 변압기 수주 공시 나오고 거래대금 1위, 장 막판까지 신고가 유지. 내일 갭 3% 뜨면 반 팔고 마이너스면 9시5분 손절"></textarea>
      <div class="btn-row" style="margin-top:8px"><button type="button" class="btn small accent" id="f-ai">AI로 항목 채우기</button><button type="button" class="btn small" id="f-news">뉴스 검색 ↗</button></div>
      <div class="hint" id="f-ai-msg"></div></div>

    <div class="field"><span>매수 근거 (탭해서 선택)</span>${chipGroup('f-tags', settings.reasonTags, t.tags || [], true, true)}</div>
    <label class="field"><span>재료 · 뉴스</span><input id="f-cat" type="text" placeholder="한 줄로" value="${esc(t.catalyst || '')}"></label>
    <label class="field"><span>근거 메모</span><textarea id="f-reason" placeholder="왜 샀나? 차트·수급·분위기">${esc(t.reason || '')}</textarea></label>
    <div class="grid2"><label class="field"><span>목표 %</span>${numInput('f-tp', t.targetPct, '예: 3')}</label>
      <label class="field"><span>손절 %</span>${numInput('f-sp', t.stopPct, '예: -2')}</label></div>
    <div class="chips" style="margin:-4px 0 12px">${[2, 3, 5].map(v => `<button type="button" class="chip" data-tp="${v}">목표 +${v}%</button>`).join('')}${[-1.5, -2, -3].map(v => `<button type="button" class="chip" data-sp="${v}">손절 ${v}%</button>`).join('')}</div>
    <label class="field"><span>내일 시나리오</span><textarea id="f-scn" placeholder="갭상이면? 갭하락이면?">${esc(t.scenario || '')}</textarea></label>
    <div class="field"><span>확신도</span>${starsHTML(t.confidence)}</div>
    <div class="field"><span>차트 캡처 <small>(캡처 후 <b>Ctrl+V</b> 또는 이미지 선택 — 블로그 카드에 들어감)</small></span>
      <div class="thumbs" id="f-thumbs"></div></div>
    <div class="sheet-foot btn-row"><button type="button" class="btn primary block" id="f-save">${editId ? '수정 저장' : '근거 박제하기'}</button></div>
  `, () => { formImgs.forEach(removeImage); formImgs = []; });

  document.getElementById('f-conf').dataset.v = t.confidence || 0;
  bindChips('f-strategy'); bindChips('f-tags', 'reasonTags'); bindStars(); bindCommaFormat(['f-bp', 'f-qty']);
  let code = t.code || '', market = t.market || '';
  // 종목 자동완성
  const nameEl = document.getElementById('f-name'), sug = document.getElementById('f-suggest');
  nameEl.addEventListener('input', () => {
    code = ''; market = ''; document.getElementById('f-code-hint').textContent = '목록에 없으면 그냥 입력해도 됨';
    const list = searchStocks(nameEl.value, liveTrades());
    sug.hidden = !list.length;
    sug.innerHTML = list.map(s => `<button type="button" data-n="${esc(s.name)}" data-c="${s.code}" data-m="${s.mk}"><span>${s.mine ? '★ ' : ''}${esc(s.name)}</span><span class="muted">${s.code} ${MARKET_LABEL[s.mk] || ''}</span></button>`).join('');
  });
  sug.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    nameEl.value = b.dataset.n; code = b.dataset.c; market = b.dataset.m; sug.hidden = true;
    document.getElementById('f-code-hint').textContent = code + ' · ' + (MARKET_LABEL[market] || '');
    document.getElementById('f-bp').focus();
  });
  nameEl.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 200));
  const upd = () => { const a = nval('f-bp') * nval('f-qty'); document.getElementById('f-amt').innerHTML = '매수금액 <b class="num">' + (isFinite(a) ? fmtNum(a) + '원' : '-') + '</b>'; };
  ['f-bp', 'f-qty'].forEach(id => document.getElementById(id).addEventListener('input', upd)); upd();
  document.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { document.getElementById('f-tp').value = b.dataset.tp; });
  document.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { document.getElementById('f-sp').value = b.dataset.sp; });
  // 차트 이미지
  const imgIds = [...(t.imgIds || [])];
  const addFiles = async files => {
    const room = 3 - imgIds.length;
    if (room <= 0) { toast('차트 이미지는 3장까지'); return; }
    for (const f of files.slice(0, room)) { const id = await addImage(f, t.id); imgIds.push(id); formImgs.push(id); }
    renderThumbs(); toast('차트 이미지 추가됨');
  };
  const renderThumbs = async () => {
    const box = document.getElementById('f-thumbs'); if (!box) return;
    const srcs = await Promise.all(imgIds.map(getImage));
    box.innerHTML = imgIds.map((id, i) => `<div class="thumb"><img src="${srcs[i] || ''}" alt=""><button type="button" data-rm="${id}" aria-label="삭제">✕</button></div>`).join('') +
      (imgIds.length < 3 ? '<label class="thumb-add">＋ 이미지<input type="file" accept="image/*" multiple hidden id="f-file"></label>' +
        (navigator.clipboard && navigator.clipboard.read ? '<button type="button" class="thumb-add" id="f-paste">⧉ 붙여넣기</button>' : '') : '');
    const fi = document.getElementById('f-file');
    if (fi) fi.onchange = () => addFiles([...fi.files]);
    const pb = document.getElementById('f-paste');
    if (pb) pb.onclick = async () => {
      try {
        const files = [];
        for (const it of await navigator.clipboard.read()) {
          const type = it.types.find(x => x.startsWith('image/'));
          if (type) files.push(new File([await it.getType(type)], 'chart.' + type.split('/')[1], { type }));
        }
        if (files.length) addFiles(files); else toast('클립보드에 이미지가 없음 — 캡처 먼저');
      } catch (e) { toast('클립보드 권한이 필요함 — PC는 Ctrl+V로 붙여넣기'); }
    };
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const id = b.dataset.rm; imgIds.splice(imgIds.indexOf(id), 1); removeImage(id); formImgs = formImgs.filter(x => x !== id); renderThumbs(); });
  };
  renderThumbs();
  // 캡처 → Ctrl+V: 폼 어디서든 이미지 붙여넣기 (글자 칸에 글자 붙여넣기는 그대로 둠)
  if (buyPasteHandler) document.removeEventListener('paste', buyPasteHandler);
  buyPasteHandler = e => {
    if (!document.getElementById('f-thumbs')) { document.removeEventListener('paste', buyPasteHandler); buyPasteHandler = null; return; }
    const cd = e.clipboardData; if (!cd) return;
    const files = [...cd.items].filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
    if (!files.length) return;
    if ([...cd.types].includes('text/plain') && /INPUT|TEXTAREA/.test((e.target || {}).tagName)) return;
    e.preventDefault(); addFiles(files);
  };
  document.addEventListener('paste', buyPasteHandler);
  // AI 정리
  document.getElementById('f-ai').onclick = async () => {
    const raw = val('f-raw'), msg = document.getElementById('f-ai-msg');
    if (!raw && !imgIds.length) { msg.textContent = '메모를 쓰거나 차트 이미지를 붙여주세요'; return; }
    msg.innerHTML = '<span class="spinner"></span> 정리 중…';
    try {
      const srcs = (await Promise.all(imgIds.slice(0, 1).map(getImage))).filter(Boolean);
      const r = await aiStructureThesis(raw || '(메모 없음 — 차트만 보고 셋업 정리)', { name: nameEl.value }, srcs);
      setChips('f-tags', [...new Set([...chipVals('f-tags'), ...r.tags])]);
      const fill = (id, v) => { const el = document.getElementById(id); if (v && !el.value.trim()) el.value = v; else if (v && el.value.trim() !== v) el.value = el.value.trim() + '\n' + v; };
      fill('f-cat', r.catalyst); fill('f-reason', r.reason); fill('f-scn', r.scenario);
      if (r.targetPct !== null && !val('f-tp')) document.getElementById('f-tp').value = r.targetPct;
      if (r.stopPct !== null && !val('f-sp')) document.getElementById('f-sp').value = r.stopPct;
      if (r.confidence) { const box = document.getElementById('f-conf'); box.dataset.v = r.confidence; box.querySelectorAll('button').forEach(x => x.classList.toggle('on', Number(x.dataset.v) <= r.confidence)); }
      msg.textContent = '채움 완료 (' + r.model + ') — 확인하고 고쳐서 저장';
    } catch (e) { msg.textContent = '실패: ' + e.message + ' (메모는 그대로 있음)'; }
  };
  document.getElementById('f-news').onclick = () => {
    const name = nameEl.value.trim(); if (!name) { toast('종목명부터 입력'); return; }
    openNews(name);
  };
  function collect() {
    return { strategy: chipVals('f-strategy')[0] || settings.strategies[0], name: nameEl.value.trim(), code, market,
      buyPrice: nval('f-bp'), qty: nval('f-qty'), buyDate: val('f-bd'), tags: chipVals('f-tags'),
      catalyst: val('f-cat'), reason: val('f-reason'), targetPct: isFinite(nval('f-tp')) ? nval('f-tp') : null,
      stopPct: isFinite(nval('f-sp')) ? -Math.abs(nval('f-sp')) : null, scenario: val('f-scn'), confidence: Number(document.getElementById('f-conf').dataset.v) || null };
  }
  document.getElementById('f-save').onclick = () => {
    const d = collect();
    if (!d.name) { toast('종목명을 입력하세요'); return; }
    if (!(d.buyPrice > 0) || !(d.qty > 0)) { toast('매수가·수량을 입력하세요'); return; }
    Object.assign(t, d, { imgIds });
    if (!t.thesisAt) t.thesisAt = Date.now();
    else if (Date.now() - t.thesisAt > 6 * 3600e3) t.thesisEditedAt = Date.now();   // 사후 수정 흔적 남김
    upsertTrade(t); formImgs = [];
    closeSheet(true); toast(editId ? '수정됨' : '근거 박제 완료 — 내일 복기 대기에 표시됨'); rerenderActive();
  };
}

/* ===== 결과 · 복기 기록 ===== */
function openSellForm(id) {
  const t = JSON.parse(JSON.stringify(getTrade(id)));
  const editing = t.status === 'closed';
  openSheet((editing ? '결과 수정 — ' : '결과 기록 — ') + t.name, `
    ${thesisBlock(t, '📌 ' + mdLabel(t.buyDate) + '의 내가 적은 근거')}
    <div class="pos-meta" style="margin:-2px 0 12px">매수 ${fmtNum(t.buyPrice)}원 × ${fmtNum(t.qty)}주 · ${mdLabel(t.buyDate)} ${esc(t.buyTime || '')}</div>
    <div class="grid2"><label class="field"><span>매도가</span>${numInput('s-sp', t.sellPrice, '원')}</label>
      <label class="field"><span>매도 수량</span>${numInput('s-qty', t.sellQty || t.qty, '주')}</label></div>
    <div class="calc-line" id="s-calc">-</div>
    <label class="field"><span>매도일</span><input id="s-sd" type="date" value="${t.sellDate || todayStr()}"></label>
    <details style="margin:-4px 0 12px"><summary class="hint">증권사 실현손익으로 직접 입력 (선택)</summary>
      <label class="field" style="margin-top:8px">${numInput('s-man', t.netManual, '예: 12,345 / -8,000 (비우면 자동 계산)')}</label></details>
    <div class="row wrap" style="gap:16px;margin-bottom:12px">
      <div><span class="label">근거 적중?</span>${segHTML('s-hit', ['O', '△', 'X'], t.thesisHit)}</div>
      <div><span class="label">계획대로 대응?</span>${segHTML('s-plan', ['O', 'X'], t.planKept)}</div></div>
    <div class="field"><span>실수 (있으면)</span>${chipGroup('s-mis', settings.mistakeTags, t.mistakes || [], true, true)}</div>
    <label class="field"><span>복기</span><textarea id="s-rev" placeholder="시초가 흐름, 대응, 결과">${esc(t.review || '')}</textarea></label>
    <label class="field"><span>배운 점 한 줄</span><input id="s-les" type="text" value="${esc(t.lesson || '')}" placeholder="다음에 똑같이 할 것 / 하지 말 것"></label>
    <div class="sheet-foot btn-row"><button type="button" class="btn primary block" id="s-save">${editing ? '수정 저장' : '결과 저장'}</button></div>`);
  bindSeg('s-hit'); bindSeg('s-plan'); bindChips('s-mis', 'mistakeTags'); bindCommaFormat(['s-sp', 's-qty', 's-man']);
  const calc = () => {
    const tmp = { ...t, status: 'closed', sellPrice: nval('s-sp'), sellQty: nval('s-qty'), netManual: val('s-man') === '' ? null : nval('s-man') };
    const c = isFinite(tmp.sellPrice) && tmp.sellPrice > 0 ? calcTrade(tmp, settings) : null;
    document.getElementById('s-calc').innerHTML = c ? `순손익 <b class="${pnlClass(c.net)} num amt">${fmtSigned(c.net)}원</b> · <b class="${pnlClass(c.net)}">${fmtPct(c.pct)}</b> <span class="muted">(수수료 ${fmtNum(c.fee)} · 세금 ${fmtNum(c.tax)}${c.manual ? ' · 직접입력' : ''})</span>` : '매도가 입력하면 수수료·세금 차감 손익 자동 계산';
  };
  ['s-sp', 's-qty', 's-man'].forEach(i => document.getElementById(i).addEventListener('input', calc)); calc();
  document.getElementById('s-save').onclick = () => {
    const sp = nval('s-sp'), sq = nval('s-qty');
    if (!(sp > 0)) { toast('매도가를 입력하세요'); return; }
    if (!(sq > 0) || sq > t.qty) { toast('매도 수량 확인 (1 ~ ' + t.qty + ')'); return; }
    Object.assign(t, { status: 'closed', sellPrice: sp, sellQty: sq, sellDate: val('s-sd'),
      netManual: val('s-man') === '' ? null : nval('s-man'), thesisHit: segVal('s-hit'), planKept: segVal('s-plan'),
      mistakes: chipVals('s-mis'), review: val('s-rev'), lesson: val('s-les'), reviewAt: t.reviewAt || Date.now() });
    upsertTrade(t); closeSheet(true); rerenderActive();
    const c = calcTrade(t, settings);
    toast(`저장 — ${t.name} ${fmtPct(c.pct)}`);
    setTimeout(() => openTradeDetail(t.id), 250);
  };
}

/* ===== 시황 메모 ===== */
function openDayNote(date) {
  openSheet('시황 메모 — ' + mdLabel(date), `
    <label class="field"><span>오늘 시장 · 내일 계획</span><textarea id="d-note" style="min-height:160px" placeholder="지수·주도 섹터·수급 / 내일 체크할 일정(CPI, 실적 등)">${esc(getDayNote(date))}</textarea></label>
    <div class="sheet-foot btn-row"><button type="button" class="btn primary block" id="d-save">저장</button></div>`);
  document.getElementById('d-save').onclick = () => { setDayNote(date, val('d-note')); closeSheet(true); toast('저장됨'); rerenderActive(); };
}

/* ===== 매매 상세 ===== */
async function openTradeDetail(id) {
  const t = getTrade(id); if (!t) return;
  const c = calcTrade(t, settings);
  openSheet(t.name + (t.code ? ' · ' + t.code : ''), `
    <div class="detail-top">${c ? `<div class="big ${pnlClass(c.net)}">${fmtPct(c.pct)}</div><div class="${pnlClass(c.net)} amt" style="font-weight:800">${amt(c.net)}</div>`
      : '<span class="badge open">보유 중 · 복기 대기</span>'}</div>
    <dl class="kv-list">
      <dt>전략</dt><dd>${esc(t.strategy || '-')}</dd>
      <dt>매수</dt><dd class="num">${mdLabel(t.buyDate)} ${esc(t.buyTime || '')} · ${fmtNum(t.buyPrice)}원 × <span class="amt-q">${masked() ? '•••' : fmtNum(t.qty)}</span></dd>
      ${c ? `<dt>매도</dt><dd class="num">${mdLabel(t.sellDate)} ${esc(t.sellTime || '')} · ${fmtNum(t.sellPrice)}원 × ${masked() ? '•••' : fmtNum(c.qty)}</dd>
      <dt>수수료·세금</dt><dd class="num">${masked() ? '•••' : fmtNum(c.fee) + ' · ' + fmtNum(c.tax)}${c.manual ? ' (직접입력)' : ''}</dd><dt>보유</dt><dd>${c.holdDays}일</dd>` : ''}
    </dl>
    ${thesisBlock(t)}
    <div class="thumbs" id="dt-imgs"></div>
    ${c ? `<div class="thesis"><div class="stamp"><span>📊 복기</span><span>${t.reviewAt ? stampLabel(t.reviewAt) : ''}</span></div>
      <div class="chips">${t.thesisHit ? `<span class="chip static">${HIT_LABEL[t.thesisHit]}</span>` : ''}${t.planKept ? `<span class="chip static">${t.planKept === 'O' ? '계획대로 O' : '계획 이탈 X'}</span>` : ''}${(t.mistakes || []).map(m => `<span class="chip static">${esc(m)}</span>`).join('')}</div>
      ${t.review ? `<p>${esc(t.review)}</p>` : ''}${t.lesson ? `<p><span class="k">배운 점</span><b>${esc(t.lesson)}</b></p>` : ''}</div>` : ''}
    <div class="btn-row" style="margin-top:12px">
      <button class="btn ${c ? '' : 'primary'}" id="dt-sell">${c ? '결과 수정' : '결과 기록'}</button>
      <button class="btn" id="dt-edit">근거 수정</button>
      <button class="btn accent" id="dt-card">블로그 카드</button></div>
    <div class="btn-row" style="margin-top:8px">
      <button class="btn small" id="dt-news">뉴스 검색 ↗</button>
      <button class="btn small danger" id="dt-del">삭제</button></div>`);
  const box = document.getElementById('dt-imgs');
  const srcs = await Promise.all((t.imgIds || []).map(getImage));
  box.innerHTML = srcs.map(s => s ? `<a class="thumb" href="${s}" target="_blank" rel="noopener"><img src="${s}" alt="차트"></a>` : '').join('');
  document.getElementById('dt-sell').onclick = () => openSellForm(id);
  document.getElementById('dt-edit').onclick = () => openBuyForm(id);
  document.getElementById('dt-card').onclick = () => openCard('trade', id);
  document.getElementById('dt-news').onclick = () => openNews(t.name);
  document.getElementById('dt-del').onclick = () => { if (confirm(t.name + ' 기록을 삭제할까요?')) { deleteTrade(id); closeSheet(true); toast('삭제됨'); rerenderActive(); } };
}
