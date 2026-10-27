/* 트레이드북 앱 셸 — 탭 · 바텀시트 · 토스트 · 금액 숨김 · 초기화 */
'use strict';

const masked = () => document.body.classList.contains('masked');
const amt = n => masked() ? '•••원' : fmtSigned(n) + '원';
let activeTab = 'home';

function showTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + name));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.getElementById('fab').hidden = name === 'settings';
  rerenderActive();
  window.scrollTo(0, 0);
}
function rerenderActive() {
  const r = { home: renderHome, list: renderList, stats: renderStats, settings: renderSettings }[activeTab];
  if (r) r();
}

/* ---- 바텀시트: 안드로이드 뒤로가기로 닫힘, 취소 시 onCancel 실행 ---- */
const sheetEl = () => document.getElementById('sheet');
let sheetCancel = null;
function openSheet(title, html, onCancel) {
  const wasOpen = !sheetEl().hidden;
  document.getElementById('sheet-title').textContent = title;
  const body = document.getElementById('sheet-body');
  body.oninput = body.onclick = null;            // 이전 폼의 임시 저장 연결 끊기 (폼이 새로 연결함)
  body.innerHTML = html; body.scrollTop = 0;
  sheetEl().hidden = false; document.body.style.overflow = 'hidden';
  sheetCancel = onCancel || null;
  if (!wasOpen) history.pushState({ tbSheet: 1 }, '');
}
function hideSheet(saved) {
  if (sheetEl().hidden) return;
  sheetEl().hidden = true; document.body.style.overflow = '';
  document.getElementById('chart-tip').hidden = true;
  const cb = sheetCancel; sheetCancel = null;
  if (!saved && cb) cb();
}
function closeSheet(saved) {
  if (sheetEl().hidden) return;
  hideSheet(saved);
  if (history.state && history.state.tbSheet) history.back();
}
window.addEventListener('popstate', () => hideSheet(false));

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

function setMask(on) {
  document.body.classList.toggle('masked', on);
  localStorage.setItem(LS.mask, on ? '1' : '0');
  const b = document.getElementById('btn-mask');
  b.classList.toggle('on', on); b.textContent = on ? '•••' : '₩';
  b.title = on ? '금액 숨김 켜짐 — 탭해서 표시' : '금액 숨김 (블로그·외출용)';
}

/* ---- 초기화 ---- */
(function init() {
  document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  document.getElementById('fab').onclick = () => openBuyForm();
  // 기록 폼(글 쓰는 칸 있음)은 바깥 어두운 곳을 눌러도 안 닫힘 — ✕·뒤로가기로 닫고, 쓰던 건 임시 저장돼 다시 열면 이어 씀
  document.getElementById('sheet').addEventListener('click', e => {
    const c = e.target.closest('[data-close]'); if (!c) return;
    if (c.classList.contains('sheet-backdrop') && document.querySelector('#sheet-body textarea')) return;
    closeSheet(false);
  });
  document.getElementById('btn-mask').onclick = () => { setMask(!masked()); rerenderActive(); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheet(false);
    const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName);
    if (!typing && sheetEl().hidden && (e.key === 'n' || e.key === 'ㅜ')) { e.preventDefault(); openBuyForm(); }
  });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (activeTab === 'stats') renderStats(); }, 200); });
  // 폰 설정 링크: #setup=<base64url JSON {u,k,g}> → 이 기기에 키 저장 후 주소창에서 즉시 제거
  // (# 뒷부분은 서버로 전송되지 않음 → 키가 GitHub에 남지 않음)
  if (location.hash.startsWith('#setup=')) {
    try {
      const cfg = JSON.parse(atob(location.hash.slice(7).replace(/-/g, '+').replace(/_/g, '/')));
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.u || '') || !cfg.k) throw new Error('형식 오류');
      Object.assign(settings, { supabaseUrl: cfg.u, supabaseKey: cfg.k }, cfg.g ? { geminiKey: cfg.g } : {});
      localStorage.setItem(LS.settings, JSON.stringify(settings));   // _updatedAt 유지 → 설정 행은 업로드 안 함
      toast('설정 완료 — 동기화 시작');
    } catch (e) { toast('설정 링크 오류: ' + e.message); }
    history.replaceState(null, '', location.pathname + location.search);
  }
  setMask(localStorage.getItem(LS.mask) === '1');
  updateSyncBadge(sbConfigured() ? '대기' : '미설정');
  // 폰트 로드 후 다시 그려서 차트 글꼴 일치
  showTab('home');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (activeTab === 'stats') renderStats(); });
  // 홈 화면 바로가기 (#buy → 매수 기록 바로 열기)
  if (location.hash === '#buy') { history.replaceState(null, '', location.pathname); openBuyForm(); }
  // 미리보기 파라미터: ?demo (빈 상태면 샘플 넣기) &tab=stats &sheet=buy|sell|detail|card-trade|card-day|card-month
  const qp = new URLSearchParams(location.search);
  if (qp.has('demo') && !liveTrades().length) { trades.push(...makeDemoData(todayStr())); saveTrades(); rerenderActive(); }
  if (/^\d{4}-\d{2}$/.test(qp.get('ym') || '')) { statsYm = listYm = qp.get('ym'); rerenderActive(); }
  if (qp.get('tab')) showTab(qp.get('tab'));
  const sh = qp.get('sheet'), openT = liveTrades().find(t => t.status === 'open'), lastC = sortClosed(liveTrades().filter(t => t.status === 'closed')).pop();
  if (sh === 'buy') openBuyForm();
  if (sh === 'sell' && openT) openSellForm(openT.id);
  if (sh === 'detail' && lastC) openTradeDetail(lastC.id);
  if (sh === 'card-trade' && lastC) openCard('trade', lastC.id);
  if (sh === 'card-day' && lastC) openCard('day', lastC.sellDate);
  if (sh === 'card-month') openCard('month', qp.get('ym') || (lastC ? ymOf(lastC.sellDate) : ymOf(todayStr())));
  if (sbConfigured()) syncNow(false);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && sbConfigured()) syncNow(false); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
