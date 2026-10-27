/* 트레이드북 입력 폼 — 매수 기록 / 무포지션 기록(근거 박제) · 결과·복기 기록 · 시황 메모 · 상세 */
'use strict';

const numInput = (id, val, ph) => `<input id="${id}" type="text" inputmode="decimal" autocomplete="off" placeholder="${ph || ''}" value="${val === undefined || val === null || val === '' ? '' : fmtNum(val, String(val).includes('.') ? 2 : 0)}">`;
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
/* 재료 확인: 네이버 뉴스 최신순 (Gemini 구글검색 연동은 무료 키에서 막혀 있음) */
const openNews = name => window.open('https://search.naver.com/search.naver?where=news&sort=1&query=' + encodeURIComponent(name), '_blank', 'noopener');
const nval = id => parseNum(val(id));
/* 종목 자동완성 목록 (매수 폼 · 여러 종목 폼) */
const stockSuggestHTML = list => list.map(s => `<button type="button" data-n="${esc(s.name)}" data-c="${s.code}" data-m="${s.mk}"><span>${s.mine ? '★ ' : ''}${esc(s.name)}</span><span class="muted">${s.code} ${MARKET_LABEL[s.mk] || ''}</span></button>`).join('');
/* 숫자 칸: 입력하는 동안 천 단위 쉼표를 바로 찍고, 커서는 같은 숫자 뒤에 유지 */
function formatTyping(el) {
  const raw = el.value, caret = el.selectionStart ?? raw.length;
  const keep = ch => /[\d.\-]/.test(ch);
  const before = [...raw.slice(0, caret)].filter(keep).length;
  let [int, ...dec] = raw.replace(/[^\d.\-]/g, '').split('.');
  const neg = int.startsWith('-');
  int = int.replace(/-/g, '').replace(/^0+(?=\d)/, '');
  const out = (neg ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec.length ? '.' + dec.join('') : '');
  if (out === raw) return;
  el.value = out;
  let pos = 0;
  for (let n = 0; pos < out.length && n < before; pos++) if (keep(out[pos])) n++;
  el.setSelectionRange(pos, pos);
}
function bindCommaFormat(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', () => formatTyping(el));
    el.addEventListener('blur', () => { const n = parseNum(el.value); if (isFinite(n)) el.value = fmtNum(n, Math.abs(n % 1) > 0 ? 2 : 0); });
  });
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
function starsHTML(cur, id = 'f-conf') { return `<div class="stars" id="${id}">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" class="${i <= (cur || 0) ? 'on' : ''}" aria-label="확신도 ${i}">★</button>`).join('')}</div>`; }
function bindStars(id = 'f-conf') {
  const box = document.getElementById(id);
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = Number(b.dataset.v); const cur = Number(box.dataset.v || 0); const nv = cur === v ? 0 : v; box.dataset.v = nv; box.querySelectorAll('button').forEach(x => x.classList.toggle('on', Number(x.dataset.v) <= nv)); };
}
const isFlat = t => !!t && t.status === 'flat';
function thesisBlock(t, title) {
  const flat = isFlat(t);
  const L = flat ? { cat: '시장', reason: '판단', scn: '내일 계획' } : { cat: '재료', reason: '근거', scn: '계획' };
  return `<div class="thesis"><div class="stamp"><span>${title || (flat ? '😴 무포지션 이유' : '📌 매수 근거')}</span><span>${t.thesisAt ? stampLabel(t.thesisAt) + ' 기록' : ''}${t.thesisEditedAt ? ' · ' + stampLabel(t.thesisEditedAt) + ' 수정' : ''}</span></div>
    ${(t.tags || []).length ? `<div class="chips">${t.tags.map(x => `<span class="chip static">${esc(x)}</span>`).join('')}</div>` : ''}
    ${t.catalyst ? `<p><span class="k">${L.cat}</span>${esc(t.catalyst)}</p>` : ''}
    ${t.reason ? `<p><span class="k">${L.reason}</span>${esc(t.reason)}</p>` : ''}
    ${planTxt(t) ? `<div class="plan-line"><span>${planTxt(t)}</span>${t.targetPct ? `<span class="muted">목표가 ${fmtNum(t.buyPrice * (1 + t.targetPct / 100))}</span>` : ''}${t.stopPct ? `<span class="muted">손절가 ${fmtNum(t.buyPrice * (1 + t.stopPct / 100))}</span>` : ''}</div>` : ''}
    ${t.scenario ? `<p><span class="k">${L.scn}</span>${esc(t.scenario)}</p>` : ''}
    ${t.confidence ? `<p><span class="k">확신도</span><span style="color:var(--warn)">${stars(t.confidence)}</span></p>` : ''}
    ${!(t.tags || []).length && !t.catalyst && !t.reason ? `<p class="muted">${flat ? '이유' : '근거'} 기록 없음</p>` : ''}
  </div>`;
}

/* ===== 이미지 첨부 칸 (매수·결과·여러 종목 폼 공용) — 파일 선택 · ⧉ 붙여넣기 · Ctrl+V, 장수 제한 없음
   폼마다 자기 상태: 취소하면 새로 붙인 것만 지우고, 뺀 기존 사진은 저장할 때만 지움
   notes가 null이면 사진별 메모 없이 썸네일만 / isTarget이 있으면 여러 칸 폼의 한 칸 (Ctrl+V는 isTarget()인 칸만, 정리는 폼이 함) ===== */
let activeImageField = null;   // 지금 열린 폼의 첨부 칸 (Ctrl+V 대상)
/* ===== 작성 중 임시 저장 — 저장 안 하고 닫혔거나(✕·뒤로가기) 앱이 새로 열려도, 같은 기록을 다시 열면 이어 씀 (이 기기에만)
   키: buy:new(새 매수·무포지션) · buy:<id>(근거 수정) · sell:<id>(결과 기록) · note:<날짜>(시황 메모) ===== */
const DRAFTS = 'tb_drafts';
const draftGet = k => loadJSON(DRAFTS, {})[k] || null;
function draftSet(k, v) { const all = loadJSON(DRAFTS, {}); if (v) all[k] = v; else delete all[k]; localStorage.setItem(DRAFTS, JSON.stringify(all)); }
const draftBar = label => `<div class="draft-bar"><span>📝 작성 중이던 내용을 불러옴</span><button type="button" class="btn small" id="draft-clear">${label}</button></div>`;
/* 사진별 메모(imgNotes: {사진id: 메모}) 중 남아 있는 사진 것만, 빈 메모는 빼고 */
const pruneNotes = (notes, ids) => Object.fromEntries(Object.entries(notes || {}).filter(([k, v]) => ids.includes(k) && v && v.trim()));
function mountImageField(boxId, ids, tradeId, notes = {}, isTarget = null) {
  if (!isTarget && activeImageField) activeImageField.cancel();   // 저장 없이 바뀐 이전 폼 정리
  const added = [], removed = [];
  let adding = 0, alive = true, rseq = 0, focusId = null;
  const changed = () => { const bx = document.getElementById(boxId); if (bx) bx.dispatchEvent(new Event('input', { bubbles: true })); };   // 폼 임시 저장에 알림
  const render = async () => {
    const my = ++rseq;
    const srcs = await Promise.all(ids.map(getImage));
    const box = document.getElementById(boxId);
    if (!box || my !== rseq) return;                 // 더 최근에 시작한 그리기가 있으면 양보
    // 메모 입력 중이면 다시 그린 뒤 커서 위치 복원
    const act = document.activeElement, keep = act && act.dataset && box.contains(act) && act.dataset.note
      ? { id: act.dataset.note, s: act.selectionStart, e: act.selectionEnd } : null;
    box.innerHTML = (notes ? `<div class="imgrows">${ids.map((id, i) => `<div class="imgrow"><div class="thumb"><img src="${srcs[i] || ''}" alt=""></div>
        <textarea data-note="${id}" placeholder="이 캡처에 대한 이유·메모 (${i + 1}번)">${esc(notes[id] || '')}</textarea>
        <button type="button" class="imgrm" data-rm="${id}" aria-label="삭제">✕</button></div>`).join('')}</div>`
      : ids.map((id, i) => `<div class="thumb"><img src="${srcs[i] || ''}" alt=""><button type="button" data-rm="${id}" aria-label="삭제">✕</button></div>`).join('')) +
      '<label class="thumb-add">＋ 이미지<input type="file" accept="image/*" multiple hidden></label>' +
      (navigator.clipboard && navigator.clipboard.read ? '<button type="button" class="thumb-add" data-paste>⧉ 붙여넣기</button>' : '');
    box.querySelectorAll('[data-note]').forEach(ta => { ta.oninput = () => { notes[ta.dataset.note] = ta.value; }; });
    const target = focusId || (keep && keep.id);
    const ta = target && box.querySelector(`[data-note="${target}"]`);
    if (ta) { ta.focus(); if (!focusId && keep) ta.setSelectionRange(keep.s, keep.e); }
    focusId = null;
    const fi = box.querySelector('input[type=file]');
    fi.onchange = () => addFiles([...fi.files]);
    const pb = box.querySelector('[data-paste]');
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
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
      const id = b.dataset.rm, i = ids.indexOf(id);
      if (i < 0) return;                                       // 빠른 연속 클릭: 이미 뺀 사진
      ids.splice(i, 1); b.closest(notes ? '.imgrow' : '.thumb').remove(); if (notes) delete notes[id];
      const j = added.indexOf(id);
      if (j >= 0) { added.splice(j, 1); removeImage(id); }     // 방금 붙인 것 → 바로 지움
      else if (!removed.includes(id)) removed.push(id);        // 저장돼 있던 것 → 저장할 때 지움
      changed();
    });
  };
  const addFiles = async files => {
    if (!files.length || !alive) return;
    adding++; let n = 0;
    try {
      for (const f of files) {
        const id = await addImage(f, tradeId);
        if (!alive) { removeImage(id); break; }                // 그사이 폼을 닫았으면 되돌림
        ids.push(id); added.push(id); n++;
        focusId = id; render(); changed();                     // 한 장씩 바로 보이고, 방금 붙인 사진의 메모 칸으로 커서
      }
    } catch (e) { toast('이미지 추가 실패: ' + e.message); }
    finally { adding--; }
    if (n && alive) toast(`이미지 ${n}장 추가됨`);
  };
  // 캡처 → Ctrl+V: 이 폼이 열려 있을 때만 (글자 칸에 글자 붙여넣기는 그대로 둠)
  const onPaste = e => {
    if (!alive || document.getElementById('sheet').hidden || !document.getElementById(boxId)) return;
    if (isTarget && !isTarget()) return;                     // 여러 칸 폼: 지금 고른 칸만 받음
    const cd = e.clipboardData; if (!cd) return;
    const files = [...cd.items].filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
    if (!files.length) return;
    if ([...cd.types].includes('text/plain') && /INPUT|TEXTAREA/.test((e.target || {}).tagName)) return;
    e.preventDefault(); addFiles(files);
  };
  document.addEventListener('paste', onPaste);
  const field = {
    busy: () => adding > 0,
    detach() { alive = false; document.removeEventListener('paste', onPaste); if (activeImageField === field) activeImageField = null; },
    // orig: 저장돼 있는 사진 — 임시 저장에서 이어 붙였던 사진을 뺐으면(저장된 적 없음) 그것도 지움
    cancel(orig) { field.detach(); added.splice(0).forEach(removeImage); if (orig) removed.splice(0).filter(id => !orig.includes(id)).forEach(removeImage); },
    keep(orig = []) { field.detach(); removed.splice(0).filter(id => !orig.includes(id)).forEach(removeImage); },   // 임시 저장: 붙인 사진은 남김
    commit() { field.detach(); removed.splice(0).forEach(removeImage); },
  };
  if (!isTarget) activeImageField = field;
  render();
  return field;
}

/* ===== 매수 / 무포지션 기록 (근거 박제) =====
   새 매수는 종목 칸 1. 2. 3. …(＋ 종목 추가) — 칸마다 매매 1건, 전략·날짜는 위에서 한 번
   단타를 고르면 칸이 짧아짐: 매수가·매도가·수량 + 당일 매수·매도 이유 + 캡처 (새 기록에서 매도가까지 넣으면 그날 청산)
   칸 id: 1번 칸은 예전 그대로(f-name …), 2번부터 뒤에 번호(f-name-1 …) */
const FORM_TEXT = {
  buy: { title: '＋ 매수 기록', date: '매수일', cat: '재료', catPh: '뉴스·공시·테마 한 줄', reason: '근거', reasonPh: '왜 샀나? 차트·수급·분위기',
    scn: '대응 계획', scnPh: '갭상·갭하락·익절·손절 때 어떻게 할지', save: '근거 박제하기',
    raw: '예) 변압기 수주 공시 나오고 거래대금 1위, 장 막판까지 신고가 유지. 내일 갭 3% 뜨면 반 팔고 마이너스면 9시5분 손절' },
  flat: { title: '😴 무포지션 기록', date: '날짜', cat: '시장', catPh: '예: 지수 장 막판 밀림, 주도 섹터 없음', reason: '판단', reasonPh: '왜 쉬기로 했나? 봤던 후보·패스 이유',
    scn: '내일 계획', scnPh: '내일 체크할 것', save: '무포지션 박제하기',
    raw: '예) 지수 막판에 밀리고 거래대금 상위가 다 테마 끝물이라 패스. 내일 CPI 보고 다시' },
  quick: { reason: '당일 매수·매도 이유', reasonPh: '왜 사고 왜 팔았나? 차트·수급·대응' },   // 단타 칸
};
const fid = (k, n) => k ? `f-${n}-${k}` : `f-${n}`;
/* 종목 칸 하나 — data-buyonly(매수만) · data-flatonly(무포지션만) · data-full(단타면 숨김) · data-sellonly(단타 새 기록만) */
function buyEntryHTML(k, t) {
  const id = n => fid(k, n), flat = isFlat(t);
  return `<div class="bentry" data-k="${k}"${k ? ' data-buyonly' : ''}>
    <div class="bentry-no">${k + 1}.</div>
    <div data-buyonly>
      <div class="field suggest"><span>종목</span>
        <input id="${id('name')}" type="text" autocomplete="off" placeholder="종목명 또는 코드" value="${esc(t.name || '')}">
        <div class="suggest-list" id="${id('suggest')}" hidden></div>
        <div class="hint" id="${id('code-hint')}">${t.code ? esc(t.code) + ' · ' + (MARKET_LABEL[t.market] || '') : 'KRX 목록에서 자동완성 → 코드 자동 입력'}</div></div>
      <div class="pricegrid"><label class="field"><span>매수가</span>${numInput(id('bp'), t.buyPrice, '원')}</label>
        <label class="field" data-sellonly><span>매도가</span>${numInput(id('sell'), '', '원')}</label>
        <label class="field"><span>수량</span>${numInput(id('qty'), t.qty, '주')}</label></div>
      <div class="calc-line" id="${id('amt')}">매수금액 -</div>
    </div>
    <div class="ai-box" data-full><span class="label">✨ 대충 쓰고 AI로 정리 <small>(폰 키보드 마이크로 말해도 됨)</small></span>
      <textarea id="${id('raw')}"></textarea>
      <div class="btn-row" style="margin-top:8px"><button type="button" class="btn small accent" id="${id('ai')}">AI로 항목 채우기</button><button type="button" class="btn small" id="${id('news')}" data-buyonly>뉴스 검색 ↗</button></div>
      <div class="hint" id="${id('ai-msg')}"></div></div>
    <div class="field" data-buyonly data-full><span>매수 근거 (탭해서 선택)</span>${chipGroup(id('tags'), settings.reasonTags, flat ? [] : (t.tags || []), true, true)}</div>
    ${k ? '' : `<div class="field" data-flatonly><span>무포지션 이유 (탭해서 선택)</span>${chipGroup('f-ftags', settings.flatTags, flat ? (t.tags || []) : [], true, true)}</div>`}
    <label class="field" data-full><span id="${id('lab-cat')}">재료</span><input id="${id('cat')}" type="text" value="${esc(t.catalyst || '')}"></label>
    <label class="field"><span id="${id('lab-reason')}">근거</span><textarea id="${id('reason')}">${esc(t.reason || '')}</textarea></label>
    <label class="field" data-full><span id="${id('lab-scn')}">대응 계획</span><textarea id="${id('scn')}">${esc(t.scenario || '')}</textarea></label>
    <div class="field" data-buyonly data-full><span>확신도</span>${starsHTML(t.confidence, id('conf'))}</div>
    <div class="field"><span>차트 캡처 <small id="${id('img-hint')}"></small></span>
      <div class="thumbs" id="${id('thumbs')}"></div></div>
  </div>`;
}
function openBuyForm(editId, startMode) {
  const fresh = () => ({ id: uid(), status: 'open', strategy: settings.strategies[0], buyDate: todayStr(), tags: [], imgIds: [] });
  const t0 = editId ? JSON.parse(JSON.stringify(getTrade(editId))) : fresh();
  const dkey = 'buy:' + (editId || 'new'), draft = draftGet(dkey);
  const origIds = editId ? [...(t0.imgIds || []), ...(t0.sellImgIds || [])] : [];   // 저장돼 있는 사진
  // 임시 저장한 칸 → 매매 모양 (글자 칸은 그린 뒤 그대로 채움)
  const fromDraft = d => ({ id: d.id, code: d.code, market: d.market, tags: d.tags, confidence: d.conf, imgIds: d.imgIds });
  if (draft) Object.assign(t0, fromDraft(draft.entries[0]), { imgNotes: { ...(t0.imgNotes || {}), ...draft.entries[0].notes },
    strategy: draft.strategy || t0.strategy, buyDate: draft.date || t0.buyDate });
  let mode = draft ? startMode || draft.mode : isFlat(t0) || startMode === 'flat' ? 'flat' : 'buy';
  const canSwitch = t0.status !== 'closed';      // 결과까지 기록된 매매는 무포지션으로 바꾸지 않음
  if (activeImageField) activeImageField.cancel();   // 저장 없이 바뀐 이전 폼 정리
  const entries = [];                                // 종목 칸: { k, t, imgIds, notes, field, code, market }
  let cur = 0;                                       // Ctrl+V 받을 칸 = 커서가 있는 칸, 없으면 마지막으로 누른 칸
  let done = false, initSig = '';                    // done: 저장·버리기 끝남 (더는 임시 저장 안 함)
  const group = {
    busy: () => entries.some(e => e.field.busy()),
    cancel() {   // 저장 안 하고 닫힘: 쓴 게 있으면 임시 저장(붙인 사진도 남김), 없으면 붙인 사진 정리
      if (activeImageField === group) activeImageField = null;
      if (done) return; done = true;
      const keep = box.isConnected ? persist() : !!draftGet(dkey);
      entries.forEach(e => (keep ? e.field.keep(origIds) : e.field.cancel(origIds)));
    },
  };
  activeImageField = group;
  openSheet(FORM_TEXT[mode].title, `
    ${draft ? draftBar(editId ? '처음 상태로' : '새로 쓰기') : ''}
    <div class="seg" id="f-mode" style="display:${canSwitch ? 'grid' : 'none'};grid-template-columns:1fr 1fr;margin-bottom:14px">
      <button type="button" data-v="buy">📈 매수</button><button type="button" data-v="flat">😴 무포지션</button></div>
    <div data-buyonly style="margin-bottom:12px">${chipGroup('f-strategy', settings.strategies, t0.strategy, false)}</div>
    <label class="field"><span id="f-lab-date">매수일</span><input id="f-bd" type="date" value="${t0.buyDate}"></label>
    <div id="f-entries">${buyEntryHTML(0, t0)}</div>
    ${editId ? '' : `<button type="button" class="btn block" id="f-add" data-buyonly style="margin-bottom:6px">＋ 2번 종목 추가</button>
      <div class="hint" data-buyonly style="margin:0 0 12px">종목마다 칸 하나 · 캡처 Ctrl+V는 커서가 있는 칸으로</div>`}
    <div class="sheet-foot btn-row"><button type="button" class="btn primary block" id="f-save">저장</button></div>
  `, () => group.cancel());

  const box = document.getElementById('f-entries');
  const isQuick = () => mode === 'buy' && chipVals('f-strategy')[0] === '단타';
  const pick = el => { cur = Number(el.dataset.k); box.querySelectorAll('.bentry').forEach(x => x.classList.toggle('cur', x === el)); };
  const targetK = () => {
    const el = document.activeElement && document.activeElement.closest && document.activeElement.closest('.bentry');
    if (el && box.contains(el) && Number(el.dataset.k) !== cur) pick(el);
    return cur;
  };
  const onTouch = ev => { const el = ev.target.closest && ev.target.closest('.bentry'); if (el) pick(el); };
  box.addEventListener('focusin', onTouch); box.addEventListener('pointerdown', onTouch);
  // 매수금액, 단타 새 기록은 매도가까지 넣으면 수수료·세금 뺀 손익
  const calc = e => {
    const id = n => fid(e.k, n), bp = nval(id('bp')), q = nval(id('qty')), sp = nval(id('sell')), a = bp * q, quickNew = isQuick() && !editId;
    const c = quickNew && bp > 0 && q > 0 && sp > 0 ? calcTrade({ status: 'closed', buyPrice: bp, sellPrice: sp, qty: q, sellQty: q }, settings) : null;
    document.getElementById(id('amt')).innerHTML = c
      ? `순손익 <b class="${pnlClass(c.net)} num amt">${fmtSigned(c.net)}원</b> · <b class="${pnlClass(c.net)}">${fmtPct(c.pct)}</b> <span class="muted">(수수료·세금 차감)</span>`
      : '매수금액 <b class="num">' + (isFinite(a) ? fmtNum(a) + '원' : '-') + '</b>' + (quickNew ? ' <span class="muted">· 매도가까지 넣으면 바로 청산</span>' : '');
  };
  // 매수 ↔ 무포지션 · 단타 ↔ 다른 전략: 보일 칸과 이름표를 맞춤 (숨긴 칸의 값은 그대로 둠)
  const applyMode = () => {
    const T = FORM_TEXT[mode], quick = isQuick();
    document.querySelectorAll('#f-mode button').forEach(b => b.classList.toggle('on', b.dataset.v === mode));
    document.getElementById('sheet-title').textContent = editId ? T.title.replace(/^\S+ /, '') + ' 수정' : T.title;
    document.querySelectorAll('#sheet-body [data-buyonly], #sheet-body [data-flatonly], #sheet-body [data-full], #sheet-body [data-sellonly]').forEach(el => {
      el.hidden = (el.hasAttribute('data-buyonly') && mode !== 'buy') || (el.hasAttribute('data-flatonly') && mode !== 'flat')
        || (el.hasAttribute('data-full') && quick) || (el.hasAttribute('data-sellonly') && !(quick && !editId));
    });
    box.classList.toggle('multi', mode === 'buy' && !editId);   // 새 매수: 칸 번호·테두리
    document.getElementById('f-lab-date').textContent = T.date;
    entries.forEach(e => {
      const el = n => document.getElementById(fid(e.k, n));
      el('lab-cat').textContent = T.cat; el('cat').placeholder = T.catPh;
      el('lab-reason').textContent = quick ? FORM_TEXT.quick.reason : T.reason; el('reason').placeholder = quick ? FORM_TEXT.quick.reasonPh : T.reasonPh;
      el('lab-scn').textContent = T.scn; el('scn').placeholder = T.scnPh; el('raw').placeholder = T.raw;
      el('img-hint').innerHTML = '(캡처 후 <b>Ctrl+V</b> 또는 이미지 선택 — ' + (mode === 'flat' ? '블로그 일일 카드에 들어감' : '블로그 카드에 들어감') + ')';
      calc(e);
    });
    document.getElementById('f-save').textContent = editId ? '수정 저장' : T.save;
  };
  const bindEntry = e => {
    const k = e.k, id = n => fid(k, n);
    bindChips(id('tags'), 'reasonTags'); if (!k) bindChips('f-ftags', 'flatTags');
    document.getElementById(id('conf')).dataset.v = e.t.confidence || 0; bindStars(id('conf'));
    bindCommaFormat([id('bp'), id('sell'), id('qty')]);
    [id('bp'), id('sell'), id('qty')].forEach(x => document.getElementById(x).addEventListener('input', () => calc(e)));
    // 종목 자동완성
    const nameEl = document.getElementById(id('name')), sug = document.getElementById(id('suggest'));
    nameEl.addEventListener('input', () => {
      e.code = ''; e.market = ''; document.getElementById(id('code-hint')).textContent = '목록에 없으면 그냥 입력해도 됨';
      const list = searchStocks(nameEl.value, liveTrades());
      sug.hidden = !list.length;
      sug.innerHTML = stockSuggestHTML(list);
    });
    sug.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      nameEl.value = b.dataset.n; e.code = b.dataset.c; e.market = b.dataset.m; sug.hidden = true;
      document.getElementById(id('code-hint')).textContent = e.code + ' · ' + (MARKET_LABEL[e.market] || '');
      document.getElementById(id('bp')).focus();
    });
    nameEl.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 200));
    // 차트 이미지 (장수 제한 없음, 사진마다 메모) — Ctrl+V는 이 칸이 대상일 때만
    e.field = mountImageField(id('thumbs'), e.imgIds, e.t.id, e.notes, () => targetK() === k);
    // AI 정리 (매수 근거 / 무포지션 이유)
    document.getElementById(id('ai')).onclick = async () => {
      const raw = val(id('raw')), msg = document.getElementById(id('ai-msg'));
      if (!raw && !e.imgIds.length) { msg.textContent = '메모를 쓰거나 차트 이미지를 붙여주세요'; return; }
      msg.innerHTML = '<span class="spinner"></span> 정리 중…';
      try {
        const srcs = (await Promise.all(e.imgIds.slice(0, 1).map(getImage))).filter(Boolean);
        const r = await aiStructureThesis(raw || '(메모 없음 — 차트만 보고 정리)', { name: nameEl.value, mode }, srcs);
        const tagBox = mode === 'flat' ? 'f-ftags' : id('tags');
        setChips(tagBox, [...new Set([...chipVals(tagBox), ...r.tags])]);
        const fill = (fieldId, v) => { const el = document.getElementById(fieldId); if (v && !el.value.trim()) el.value = v; else if (v && el.value.trim() !== v) el.value = el.value.trim() + '\n' + v; };
        fill(id('cat'), r.catalyst); fill(id('reason'), r.reason); fill(id('scn'), r.scenario);
        if (mode === 'buy' && r.confidence) { const cb = document.getElementById(id('conf')); cb.dataset.v = r.confidence; cb.querySelectorAll('button').forEach(x => x.classList.toggle('on', Number(x.dataset.v) <= r.confidence)); }
        msg.textContent = '채움 완료 (' + r.model + ') — 확인하고 고쳐서 저장';
      } catch (err) { msg.textContent = '실패: ' + err.message + ' (메모는 그대로 있음)'; }
    };
    document.getElementById(id('news')).onclick = () => {
      const name = nameEl.value.trim(); if (!name) { toast('종목명부터 입력'); return; }
      openNews(name);
    };
  };
  const addEntry = t => {
    const e = { k: entries.length, t, imgIds: [...(t.imgIds || [])], notes: { ...(t.imgNotes || {}) }, code: t.code || '', market: t.market || '' };
    if (e.k) box.insertAdjacentHTML('beforeend', buyEntryHTML(e.k, t));   // 1번 칸은 처음부터 그려져 있음
    entries.push(e); bindEntry(e);
    return e;
  };
  addEntry(t0);
  if (draft) {   // 임시 저장 이어 쓰기: 칸 수·글자·칩 되살림
    draft.entries.slice(1).forEach(d => addEntry({ ...fresh(), ...fromDraft(d), imgNotes: d.notes }));
    draft.entries.forEach((d, k) => {
      ['name', 'bp', 'sell', 'qty', 'raw', 'cat', 'reason', 'scn'].forEach(n => { document.getElementById(fid(k, n)).value = d[n] || ''; });
      setChips(fid(k, 'tags'), d.tags || []);
    });
    setChips('f-ftags', draft.ftags || []);
  }
  document.getElementById('f-mode').onclick = ev => { const b = ev.target.closest('button'); if (!b) return; mode = b.dataset.v; applyMode(); };
  bindChips('f-strategy');
  document.getElementById('f-strategy').addEventListener('click', applyMode);   // 단타를 고르면 칸이 짧아짐
  const addBtn = document.getElementById('f-add');
  if (addBtn) addBtn.onclick = () => {
    const e = addEntry(fresh()); applyMode(); pick(box.lastElementChild);
    addBtn.textContent = `＋ ${entries.length + 1}번 종목 추가`;
    document.getElementById(fid(e.k, 'name')).focus();
  };
  if (addBtn) addBtn.textContent = `＋ ${entries.length + 1}번 종목 추가`;
  applyMode(); pick(box.firstElementChild);

  // 임시 저장: 글자·칩·사진이 바뀔 때마다 (새 기록은 뭔가 썼을 때만, 수정은 처음과 달라졌을 때만)
  const snapshot = () => ({ mode, strategy: chipVals('f-strategy')[0] || '', date: val('f-bd'), ftags: chipVals('f-ftags'),
    entries: entries.map(e => {
      const v = n => val(fid(e.k, n));
      return { id: e.t.id, code: e.code, market: e.market, name: v('name'), bp: v('bp'), sell: v('sell'), qty: v('qty'), raw: v('raw'),
        cat: v('cat'), reason: v('reason'), scn: v('scn'), tags: chipVals(fid(e.k, 'tags')), conf: Number(document.getElementById(fid(e.k, 'conf')).dataset.v) || 0,
        imgIds: [...e.imgIds], notes: Object.fromEntries(e.imgIds.map(id => [id, e.notes[id] || ''])) };
    }) });
  const isBlank = s => !s.ftags.length && s.entries.every(d => !d.name && !d.bp && !d.sell && !d.qty && !d.raw && !d.cat && !d.reason && !d.scn
    && !d.tags.length && !d.conf && !d.imgIds.length);
  const persist = () => { const s = snapshot(), keep = editId ? !!draft || JSON.stringify(s) !== initSig : !isBlank(s); draftSet(dkey, keep ? s : null); return keep; };
  initSig = JSON.stringify(snapshot());
  const body = document.getElementById('sheet-body');
  body.oninput = body.onclick = () => { if (!done) persist(); };
  const clr = document.getElementById('draft-clear');
  if (clr) clr.onclick = () => {   // 임시 저장 버리고 처음 상태로
    done = true; draftSet(dkey, null);
    if (activeImageField === group) activeImageField = null;
    entries.forEach(e => { e.field.cancel(origIds); e.imgIds.filter(id => !origIds.includes(id)).forEach(removeImage); });
    openBuyForm(editId, startMode);
  };
  if (draft) toast('작성 중이던 ' + (editId ? '수정 내용' : '기록') + ' 불러옴');

  document.getElementById('f-save').onclick = () => {
    if (group.busy()) { toast('이미지 추가 중 — 끝나면 저장해주세요'); return; }
    const date = val('f-bd');
    if (!date) { toast('날짜를 입력하세요'); return; }   // 날짜 없으면 어느 화면에서도 못 찾음
    const now = Date.now(), quickNew = isQuick() && !editId, rows = [];
    if (mode === 'flat') {
      const d = { buyDate: date, catalyst: val('f-cat'), reason: val('f-reason'), scenario: val('f-scn'), status: 'flat', tags: chipVals('f-ftags'),
        // 종목·가격·예전 목표/손절/시각은 지움
        strategy: undefined, name: undefined, code: undefined, market: undefined, buyPrice: undefined, qty: undefined, confidence: undefined,
        targetPct: undefined, stopPct: undefined, buyTime: undefined };
      if (!d.tags.length && !d.reason && !d.catalyst) { toast('무포지션 이유를 하나 이상 남겨주세요'); return; }
      rows.push({ e: entries[0], d });
    } else {
      const many = entries.length > 1;
      for (const e of entries) {
        const id = n => fid(e.k, n), sell = val(id('sell'));
        const d = { buyDate: date, catalyst: val(id('cat')), reason: val(id('reason')), scenario: val(id('scn')),
          ...(isFlat(e.t) ? { status: 'open' } : {}), strategy: chipVals('f-strategy')[0] || settings.strategies[0],
          name: val(id('name')), code: e.code, market: e.market, buyPrice: nval(id('bp')), qty: nval(id('qty')), tags: chipVals(id('tags')),
          confidence: Number(document.getElementById(id('conf')).dataset.v) || null };
        // 여러 칸일 때 아무것도 안 쓴 칸은 건너뜀
        if (many && !d.name && !val(id('bp')) && !val(id('qty')) && !sell && !d.reason && !d.catalyst && !d.scenario && !d.tags.length && !e.imgIds.length && !val(id('raw'))) continue;
        const bad = msg => {
          toast((many ? `${e.k + 1}번 칸: ` : '') + msg);
          if (many) { const el = box.children[e.k]; pick(el); el.scrollIntoView({ block: 'center' }); }
        };
        if (!d.name) { bad('종목명을 입력하세요'); return; }
        if (!(d.buyPrice > 0) || !(d.qty > 0)) { bad('매수가·수량을 입력하세요'); return; }
        const sp = quickNew && sell ? nval(id('sell')) : NaN;
        if (quickNew && sell && !(sp > 0)) { bad('매도가를 확인하세요'); return; }
        rows.push({ e, d, sp });
      }
      if (!rows.length) { toast('종목명을 입력하세요'); return; }
    }
    done = true; draftSet(dkey, null);   // 저장하면 임시 저장은 지움
    rows.forEach(({ e, d, sp }) => {
      const t = e.t;
      Object.assign(t, d, { imgIds: e.imgIds, imgNotes: pruneNotes(e.notes, [...e.imgIds, ...(t.sellImgIds || [])]) });
      if (sp > 0) Object.assign(t, { status: 'closed', sellDate: date, sellPrice: sp, sellQty: t.qty, netManual: null, mistakes: [], reviewAt: now });   // 단타: 그날 청산
      if (!t.thesisAt) t.thesisAt = now;
      else if (now - t.thesisAt > 6 * 3600e3) t.thesisEditedAt = now;   // 사후 수정 흔적 남김
      upsertTrade(t);
    });
    // 저장한 칸의 사진은 확정, 저장 안 한 칸(빈 칸 · 무포지션일 때 2번부터 — 늘 새 칸)에 붙인 사진은 정리
    entries.forEach(e => (rows.some(r => r.e === e) ? e.field.commit() : (e.field.cancel(), e.imgIds.forEach(removeImage))));
    // 예전에 임시 저장하면서 뺀, 저장돼 있던 사진
    if (editId) origIds.filter(id => ![...(t0.imgIds || []), ...(t0.sellImgIds || [])].includes(id)).forEach(removeImage);
    if (activeImageField === group) activeImageField = null;
    closeSheet(true);
    const closedN = rows.filter(r => r.sp > 0).length, t1 = rows[0].e.t;
    toast(editId ? '수정됨' : mode === 'flat' ? '무포지션 박제 완료'
      : rows.length > 1 ? `${rows.length}종목 근거 박제 완료${closedN ? ` · 청산 ${closedN}건` : ''}`
      : closedN ? `저장 — ${t1.name} ${fmtPct(calcTrade(t1, settings).pct)}` : '근거 박제 완료 — 복기 대기에 표시됨');
    rerenderActive();
  };
}

/* ===== 결과 · 복기 기록 ===== */
function openSellForm(id) {
  const t = JSON.parse(JSON.stringify(getTrade(id)));
  const editing = t.status === 'closed';
  const dkey = 'sell:' + id, draft = draftGet(dkey), origIds = [...(t.imgIds || []), ...(t.sellImgIds || [])];   // 저장돼 있는 사진
  let done = false, initSig = '';
  if (activeImageField) activeImageField.cancel();   // 저장 없이 바뀐 이전 폼 정리 (이전 폼 화면이 남아 있을 때)
  openSheet((editing ? '결과 수정 — ' : '결과 기록 — ') + t.name, `
    ${draft ? draftBar('처음 상태로') : ''}
    ${thesisBlock(t, '📌 매수 근거 · ' + mdLabel(t.buyDate))}
    <div class="pos-meta" style="margin:-2px 0 12px">매수 ${fmtNum(t.buyPrice)}원 × ${fmtNum(t.qty)}주 · ${mdLabel(t.buyDate)} ${esc(t.buyTime || '')}</div>
    <div class="grid2"><label class="field"><span>매도가</span>${numInput('s-sp', t.sellPrice, '원')}</label>
      <label class="field"><span>매도 수량</span>${numInput('s-qty', t.sellQty || t.qty, '주')}</label></div>
    <div class="calc-line" id="s-calc">-</div>
    <label class="field"><span>매도일</span><input id="s-sd" type="date" value="${t.sellDate || todayStr()}"></label>
    <details style="margin:-4px 0 12px"><summary class="hint">증권사 실현손익으로 직접 입력 (선택)</summary>
      <label class="field" style="margin-top:8px">${numInput('s-man', t.netManual, '예: 12,345 / -8,000 (비우면 자동 계산)')}</label></details>
    <div class="row wrap" style="gap:16px;margin-bottom:12px">
      <div><span class="label">근거 적중?</span>${segHTML('s-hit', ['O', '△', 'X'], t.thesisHit)}</div>
      <div><span class="label">계획대로 했나?</span>${segHTML('s-plan', ['O', 'X'], t.planKept)}</div></div>
    <div class="field"><span>실수 (있으면)</span>${chipGroup('s-mis', settings.mistakeTags, t.mistakes || [], true, true)}</div>
    <label class="field"><span>복기</span><textarea id="s-rev" placeholder="매수 후 흐름, 대응, 결과">${esc(t.review || '')}</textarea></label>
    <label class="field"><span>배운 점 한 줄</span><input id="s-les" type="text" value="${esc(t.lesson || '')}" placeholder="다음에 똑같이 할 것 / 하지 말 것"></label>
    <div class="field"><span>매도·결과 캡처 <small>(캡처 후 <b>Ctrl+V</b> 또는 이미지 선택 — 블로그 카드 결과 아래에 들어감)</small></span>
      <div class="thumbs" id="s-thumbs"></div></div>
    <div class="sheet-foot btn-row"><button type="button" class="btn primary block" id="s-save">${editing ? '수정 저장' : '결과 저장'}</button></div>`, () => wrap.cancel());
  bindSeg('s-hit'); bindSeg('s-plan'); bindChips('s-mis', 'mistakeTags'); bindCommaFormat(['s-sp', 's-qty', 's-man']);
  if (draft) {   // 임시 저장 이어 쓰기
    [['s-sp', 'sp'], ['s-qty', 'qty'], ['s-sd', 'sd'], ['s-man', 'man'], ['s-rev', 'rev'], ['s-les', 'les']].forEach(([el, k]) => { document.getElementById(el).value = draft[k] || ''; });
    [['s-hit', 'hit'], ['s-plan', 'plan']].forEach(([el, k]) => document.querySelectorAll('#' + el + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === draft[k])));
    setChips('s-mis', draft.mis || []);
    if (draft.man) document.querySelector('#sheet-body details').open = true;
  }
  const sellImgIds = [...(draft ? draft.imgIds : t.sellImgIds || [])];
  const notes = { ...(t.imgNotes || {}), ...(draft ? draft.notes : {}) };
  const imgField = mountImageField('s-thumbs', sellImgIds, t.id, notes, () => true);
  const wrap = {
    busy: () => imgField.busy(),
    cancel() {   // 저장 안 하고 닫힘: 쓴 게 있으면 임시 저장(붙인 사진도 남김)
      if (activeImageField === wrap) activeImageField = null;
      if (done) return; done = true;
      const keep = box.isConnected ? persist() : !!draftGet(dkey);
      if (keep) imgField.keep(origIds); else imgField.cancel(origIds);
    },
  };
  activeImageField = wrap;
  const calc = () => {
    const tmp = { ...t, status: 'closed', sellPrice: nval('s-sp'), sellQty: nval('s-qty'), netManual: val('s-man') === '' ? null : nval('s-man') };
    const c = isFinite(tmp.sellPrice) && tmp.sellPrice > 0 ? calcTrade(tmp, settings) : null;
    document.getElementById('s-calc').innerHTML = c ? `순손익 <b class="${pnlClass(c.net)} num amt">${fmtSigned(c.net)}원</b> · <b class="${pnlClass(c.net)}">${fmtPct(c.pct)}</b> <span class="muted">(수수료 ${fmtNum(c.fee)} · 세금 ${fmtNum(c.tax)}${c.manual ? ' · 직접입력' : ''})</span>` : '매도가 입력하면 수수료·세금 차감 손익 자동 계산';
  };
  ['s-sp', 's-qty', 's-man'].forEach(i => document.getElementById(i).addEventListener('input', calc)); calc();
  // 임시 저장: 바뀔 때마다 (처음과 달라졌을 때만)
  const box = document.getElementById('s-thumbs');
  const snapshot = () => ({ sp: val('s-sp'), qty: val('s-qty'), sd: val('s-sd'), man: val('s-man'), hit: segVal('s-hit'), plan: segVal('s-plan'),
    mis: chipVals('s-mis'), rev: val('s-rev'), les: val('s-les'), imgIds: [...sellImgIds], notes: Object.fromEntries(sellImgIds.map(x => [x, notes[x] || ''])) });
  const persist = () => { const s = snapshot(), keep = !!draft || JSON.stringify(s) !== initSig; draftSet(dkey, keep ? s : null); return keep; };
  initSig = JSON.stringify(snapshot());
  const body = document.getElementById('sheet-body');
  body.oninput = body.onclick = () => { if (!done) persist(); };
  const clr = document.getElementById('draft-clear');
  if (clr) clr.onclick = () => {   // 임시 저장 버리고 처음 상태로
    done = true; draftSet(dkey, null);
    if (activeImageField === wrap) activeImageField = null;
    imgField.cancel(origIds); sellImgIds.filter(x => !origIds.includes(x)).forEach(removeImage);
    openSellForm(id);
  };
  if (draft) toast('작성 중이던 결과 기록 불러옴');
  document.getElementById('s-save').onclick = () => {
    if (imgField.busy()) { toast('이미지 추가 중 — 끝나면 저장해주세요'); return; }
    const sp = nval('s-sp'), sq = nval('s-qty');
    if (!(sp > 0)) { toast('매도가를 입력하세요'); return; }
    if (!(sq > 0) || sq > t.qty) { toast('매도 수량 확인 (1 ~ ' + t.qty + ')'); return; }
    done = true; draftSet(dkey, null);   // 저장하면 임시 저장은 지움
    Object.assign(t, { status: 'closed', sellPrice: sp, sellQty: sq, sellDate: val('s-sd'),
      netManual: val('s-man') === '' ? null : nval('s-man'), thesisHit: segVal('s-hit'), planKept: segVal('s-plan'),
      mistakes: chipVals('s-mis'), review: val('s-rev'), lesson: val('s-les'), sellImgIds,
      imgNotes: pruneNotes(notes, [...(t.imgIds || []), ...sellImgIds]), reviewAt: t.reviewAt || Date.now() });
    upsertTrade(t); imgField.commit();
    origIds.filter(x => ![...(t.imgIds || []), ...sellImgIds].includes(x)).forEach(removeImage);   // 예전에 임시 저장하면서 뺀, 저장돼 있던 사진
    if (activeImageField === wrap) activeImageField = null;
    closeSheet(true); rerenderActive();
    const c = calcTrade(t, settings);
    toast(`저장 — ${t.name} ${fmtPct(c.pct)}`);
    setTimeout(() => openTradeDetail(t.id), 250);
  };
}

/* ===== 시황 메모 ===== */
function openDayNote(date) {
  const dkey = 'note:' + date, draft = draftGet(dkey);
  let done = false;
  openSheet('시황 메모 — ' + mdLabel(date), `
    ${draft ? draftBar('처음 상태로') : ''}
    <label class="field"><span>오늘 시장 · 내일 계획</span><textarea id="d-note" style="min-height:160px" placeholder="지수·주도 섹터·수급 / 내일 체크할 일정(CPI, 실적 등)">${esc(draft ? draft.text : getDayNote(date))}</textarea></label>
    <div class="sheet-foot btn-row"><button type="button" class="btn primary block" id="d-save">저장</button></div>`);
  // 임시 저장: 저장된 메모와 달라졌을 때만
  document.getElementById('sheet-body').oninput = () => { if (!done) { const v = val('d-note'); draftSet(dkey, v !== getDayNote(date).trim() ? { text: v } : null); } };
  const clr = document.getElementById('draft-clear');
  if (clr) clr.onclick = () => { done = true; draftSet(dkey, null); openDayNote(date); };
  if (draft) toast('작성 중이던 메모 불러옴');
  document.getElementById('d-save').onclick = () => { done = true; draftSet(dkey, null); setDayNote(date, val('d-note')); closeSheet(true); toast('저장됨'); rerenderActive(); };
}

/* ===== 매매 / 무포지션 상세 ===== */
async function showImages(boxId, ids, notes) {
  const box = document.getElementById(boxId); if (!box) return;
  const items = (await Promise.all((ids || []).map(async id => ({ src: await getImage(id), note: (notes || {})[id] || '' })))).filter(x => x.src);
  const srcs = items.map(x => x.src);
  box.innerHTML = items.length ? `<div class="imgrows">${items.map((x, i) => `<div class="imgrow view"><button type="button" class="thumb" data-i="${i}" style="padding:0;cursor:zoom-in"><img src="${x.src}" alt="차트"></button>
    <div class="imgnote-v">${x.note ? esc(x.note) : ''}</div></div>`).join('')}</div>` : '';
  // data: 주소는 새 탭으로 바로 못 열어서(브라우저 차단) blob 주소로 변환해 열기
  box.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
    const blob = await (await fetch(srcs[b.dataset.i])).blob();
    window.open(URL.createObjectURL(blob), '_blank');
  });
}
async function openTradeDetail(id) {
  const t = getTrade(id); if (!t) return;
  if (isFlat(t)) {
    openSheet('😴 무포지션 · ' + mdLabel(t.buyDate), `
      ${thesisBlock(t)}
      <div class="thumbs" id="dt-imgs"></div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn" id="dt-edit">수정</button>
        <button class="btn accent" id="dt-card">일일 카드</button>
        <button class="btn danger" id="dt-del">삭제</button></div>`);
    document.getElementById('dt-edit').onclick = () => openBuyForm(id);
    document.getElementById('dt-card').onclick = () => openCard('day', t.buyDate);
    document.getElementById('dt-del').onclick = () => { if (confirm(mdLabel(t.buyDate) + ' 무포지션 기록을 삭제할까요?')) { deleteTrade(id); closeSheet(true); toast('삭제됨'); rerenderActive(); } };
    await showImages('dt-imgs', t.imgIds, t.imgNotes);
    return;
  }
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
      ${t.review ? `<p>${esc(t.review)}</p>` : ''}${t.lesson ? `<p><span class="k">배운 점</span><b>${esc(t.lesson)}</b></p>` : ''}
      <div class="thumbs" id="dt-simgs" style="margin-top:8px"></div></div>` : ''}
    <div class="btn-row" style="margin-top:12px">
      <button class="btn ${c ? '' : 'primary'}" id="dt-sell">${c ? '결과 수정' : '결과 기록'}</button>
      <button class="btn" id="dt-edit">근거 수정</button>
      <button class="btn accent" id="dt-card">블로그 카드</button></div>
    <div class="btn-row" style="margin-top:8px">
      <button class="btn small" id="dt-news">뉴스 검색 ↗</button>
      <button class="btn small danger" id="dt-del">삭제</button></div>`);
  document.getElementById('dt-sell').onclick = () => openSellForm(id);
  document.getElementById('dt-edit').onclick = () => openBuyForm(id);
  document.getElementById('dt-card').onclick = () => openCard('trade', id);
  document.getElementById('dt-news').onclick = () => openNews(t.name);
  document.getElementById('dt-del').onclick = () => { if (confirm(t.name + ' 기록을 삭제할까요?')) { deleteTrade(id); closeSheet(true); toast('삭제됨'); rerenderActive(); } };
  await Promise.all([showImages('dt-imgs', t.imgIds, t.imgNotes), showImages('dt-simgs', t.sellImgIds, t.imgNotes)]);
}
