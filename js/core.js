/* 트레이드북 core — 유틸 · 저장 · 손익 계산 · 통계
   계산/통계 함수는 DOM 없이 동작 (tests/stats.test.js 에서 node 로 검증) */
'use strict';

const DEFAULT_SETTINGS = {
  feeBuy: 0.015,          // 매수 수수료 %
  feeSell: 0.015,         // 매도 수수료 %
  taxSell: 0.20,          // 매도 세금 % (2026~: 코스피 거래세 0.05 + 농특세 0.15, 코스닥 0.20)
  strategies: ['종가베팅', '스윙', '단타', '기타'],
  reasonTags: ['거래대금 상위', '신고가 돌파', '테마/재료', '공시·뉴스', '실적', '외인·기관 수급',
    '이평선 지지', '장 막판 강세', '눌림목', '섹터 동반 강세', '미국장 연동'],
  mistakeTags: ['손절 지연', '추격 매수', '비중 과다', '계획 미준수', '뇌동 매매', '익절 너무 빠름',
    '갭하락 대응 미흡', '물타기'],
  blogName: '',           // 블로그 카드 하단 서명
  styleSample: '',        // AI 블로그 초안용 내 글 샘플
  cardTheme: 'light',
  geminiKey: '',
  geminiModel: 'gemini-3.5-flash',
  supabaseUrl: '',
  supabaseKey: '',
};

/* ===== 유틸 ===== */
const pad2 = n => String(n).padStart(2, '0');
function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
}
function dateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayStr() { return dateStr(new Date()); }
function nowTime() { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function ymOf(date) { return (date || '').slice(0, 7); }
function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}
function addDays(date, delta) {
  const [y, m, d] = date.split('-').map(Number);
  return dateStr(new Date(y, m - 1, d + delta));
}
function daysBetween(a, b) {
  if (!a || !b) return 0;
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function dowOf(date) { const [y, m, d] = date.split('-').map(Number); return DOW[new Date(y, m - 1, d).getDay()]; }
function mdLabel(date) { return date ? Number(date.slice(5, 7)) + '/' + Number(date.slice(8, 10)) + '(' + dowOf(date) + ')' : ''; }
function ymLabel(ym) { return ym.slice(0, 4) + '년 ' + Number(ym.slice(5, 7)) + '월'; }
function stampLabel(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function parseNum(v) {
  if (v === null || v === undefined || v === '') return NaN;
  return Number(String(v).replace(/[,\s원%]/g, ''));
}
function fmtNum(n, digits = 0) {
  if (!isFinite(n)) return '-';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtSigned(n) { return !isFinite(n) ? '-' : (n > 0 ? '+' : n < 0 ? '−' : '') + fmtNum(Math.abs(n)); }
function fmtPct(p, digits = 2) { return !isFinite(p) ? '-' : (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(digits) + '%'; }
/* 큰 금액 압축: 1,234,567 → 123.5만 / 1.23억 */
function fmtCompact(n) {
  if (!isFinite(n)) return '-';
  const a = Math.abs(n), s = n < 0 ? '−' : n > 0 ? '+' : '';
  if (a >= 1e8) return s + (a / 1e8).toFixed(2).replace(/\.?0+$/, '') + '억';
  if (a >= 1e4) return s + (a / 1e4).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, '') + '만';
  return s + fmtNum(a);
}
function pnlClass(n) { return n > 0 ? 'up' : n < 0 ? 'down' : 'flat'; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ===== 손익 계산 ===== */
/* 반환: 체결 수량 기준 매수금액·매도금액·수수료·세금·순손익·수익률. 미청산이면 null */
function calcTrade(t, s) {
  if (!t || t.status !== 'closed') return null;
  const qty = Number(t.sellQty) || Number(t.qty) || 0;
  const buyAmt = Number(t.buyPrice) * qty;
  const sellAmt = Number(t.sellPrice) * qty;
  const feeB = Math.floor(buyAmt * (s.feeBuy || 0) / 100);
  const feeS = Math.floor(sellAmt * (s.feeSell || 0) / 100);
  const tax = Math.floor(sellAmt * (s.taxSell || 0) / 100);
  let net = sellAmt - buyAmt - feeB - feeS - tax;
  const manual = t.netManual !== undefined && t.netManual !== null && t.netManual !== '' && isFinite(Number(t.netManual));
  if (manual) net = Number(t.netManual);           // 증권사 실현손익을 직접 입력한 경우 우선
  const pct = buyAmt ? net / buyAmt * 100 : 0;
  return { qty, buyAmt, sellAmt, fee: feeB + feeS, tax, net, pct, manual, holdDays: daysBetween(t.buyDate, t.sellDate) };
}

function sortClosed(list) {
  return [...list].sort((a, b) =>
    (a.sellDate || '').localeCompare(b.sellDate || '') || (a.sellTime || '').localeCompare(b.sellTime || '') ||
    (a.buyDate || '').localeCompare(b.buyDate || ''));
}
const isLive = t => t && !t.deleted;
function closedIn(trades, prefix) {
  return sortClosed(trades.filter(t => isLive(t) && t.status === 'closed' && (t.sellDate || '').startsWith(prefix)));
}

/* 그룹별 성과 (태그·확신도 등) */
function groupPerf(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const keys = [].concat(keyFn(r.t)).filter(k => k !== undefined && k !== null && k !== '');
    for (const k of keys) {
      const g = map.get(k) || { key: k, n: 0, wins: 0, net: 0, pctSum: 0 };
      g.n++; if (r.c.net > 0) g.wins++; g.net += r.c.net; g.pctSum += r.c.pct;
      map.set(k, g);
    }
  }
  return [...map.values()].map(g => ({ ...g, winRate: g.n ? g.wins / g.n * 100 : 0, avgPct: g.n ? g.pctSum / g.n : 0 }))
    .sort((a, b) => b.n - a.n || b.net - a.net);
}

/* 통계 — list: 청산된 매매(정렬 무관) */
function computeStats(list, s) {
  const rows = sortClosed(list).map(t => ({ t, c: calcTrade(t, s) })).filter(r => r.c);
  const n = rows.length;
  const wins = rows.filter(r => r.c.net > 0), losses = rows.filter(r => r.c.net < 0);
  const sum = (arr, f) => arr.reduce((a, r) => a + f(r), 0);
  const net = sum(rows, r => r.c.net);
  const grossWin = sum(wins, r => r.c.net), grossLoss = -sum(losses, r => r.c.net);
  const avgWinPct = wins.length ? sum(wins, r => r.c.pct) / wins.length : 0;
  const avgLossPct = losses.length ? sum(losses, r => r.c.pct) / losses.length : 0;   // 음수
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;                      // 양수
  const winRate = n ? wins.length / n * 100 : 0;
  const payoff = avgLossPct ? avgWinPct / Math.abs(avgLossPct) : (wins.length ? Infinity : 0);
  const profitFactor = grossLoss ? grossWin / grossLoss : (grossWin ? Infinity : 0);
  const expectancy = n ? (winRate / 100) * avgWinPct + (losses.length / n) * avgLossPct : 0;
  const avgPct = n ? sum(rows, r => r.c.pct) / n : 0;

  // 연승·연패 (청산 순서)
  let maxW = 0, maxL = 0, cw = 0, cl = 0;
  for (const r of rows) {
    if (r.c.net > 0) { cw++; cl = 0; } else if (r.c.net < 0) { cl++; cw = 0; } else { cw = 0; cl = 0; }
    maxW = Math.max(maxW, cw); maxL = Math.max(maxL, cl);
  }
  // 누적 손익·최대 낙폭 (0에서 시작)
  let cum = 0, peak = 0, mdd = 0;
  const equity = rows.map(r => {
    cum += r.c.net; peak = Math.max(peak, cum); mdd = Math.max(mdd, peak - cum);
    return { date: r.t.sellDate, name: r.t.name, net: r.c.net, cum };
  });
  // 일별 손익
  const byDay = {};
  for (const r of rows) {
    const d = r.t.sellDate;
    byDay[d] = byDay[d] || { net: 0, n: 0, wins: 0 };
    byDay[d].net += r.c.net; byDay[d].n++; if (r.c.net > 0) byDay[d].wins++;
  }
  const best = rows.reduce((b, r) => (!b || r.c.net > b.c.net ? r : b), null);
  const worst = rows.reduce((b, r) => (!b || r.c.net < b.c.net ? r : b), null);
  return {
    n, wins: wins.length, losses: losses.length, flats: n - wins.length - losses.length,
    winRate, net, grossWin, grossLoss, avgWin, avgLoss, avgWinPct, avgLossPct, avgPct,
    payoff, profitFactor, expectancy, maxWinStreak: maxW, maxLossStreak: maxL, mdd,
    fees: sum(rows, r => r.c.fee), taxes: sum(rows, r => r.c.tax),
    buyAmtSum: sum(rows, r => r.c.buyAmt),
    avgHold: n ? sum(rows, r => r.c.holdDays) / n : 0,
    best, worst, equity, byDay, rows,
    byReason: groupPerf(rows, t => t.tags || []),
    byMistake: groupPerf(rows, t => t.mistakes || []),
    byConfidence: groupPerf(rows, t => t.confidence ? t.confidence + '점' : '').sort((a, b) => a.key.localeCompare(b.key)),
    byPlan: groupPerf(rows, t => t.planKept === 'O' ? '계획대로' : t.planKept === 'X' ? '계획 이탈' : ''),
    byThesis: groupPerf(rows, t => ({ O: '근거 적중', '△': '부분 적중', X: '근거 빗나감' })[t.thesisHit] || ''),
    byStrategy: groupPerf(rows, t => t.strategy || ''),
  };
}

/* 연간: 월별 손익 */
function yearMonthly(trades, year, s) {
  return Array.from({ length: 12 }, (_, i) => {
    const ym = year + '-' + pad2(i + 1);
    const st = computeStats(closedIn(trades, ym), s);
    return { ym, net: st.net, n: st.n, winRate: st.winRate };
  });
}

/* ===== 종목 검색 (KRX 스냅샷 + 내가 매매한 종목 우선) ===== */
function searchStocks(q, trades, limit = 8) {
  q = (q || '').trim().toLowerCase();
  if (!q) return [];
  const out = [], seen = new Set();
  const push = (name, code, mk, mine) => {
    const k = name + '|' + code;
    if (seen.has(k) || out.length >= limit) return;
    seen.add(k); out.push({ name, code, mk, mine });
  };
  const mine = new Map();
  for (const t of (trades || [])) if (isLive(t) && t.name) mine.set(t.name, t);
  for (const [name, t] of mine) if (name.toLowerCase().includes(q) || (t.code || '').startsWith(q)) push(name, t.code || '', t.market || '', true);
  const list = (typeof window !== 'undefined' && window.KRX_STOCKS) || [];
  for (const [name, code, mk] of list) if (name.toLowerCase().startsWith(q) || code.startsWith(q)) push(name, code, mk, false);
  for (const [name, code, mk] of list) if (name.toLowerCase().includes(q)) push(name, code, mk, false);
  return out;
}
const MARKET_LABEL = { P: '코스피', D: '코스닥', X: '코넥스' };

/* ===== 샘플 데이터 (둘러보기용, demo:true 로 표시 → 설정에서 일괄 삭제) ===== */
function makeDemoData(baseDate) {
  const names = [['한화에어로스페이스', '012450', 'P'], ['HD현대일렉트릭', '267260', 'P'], ['알테오젠', '196170', 'D'],
    ['에코프로비엠', '247540', 'D'], ['SK하이닉스', '000660', 'P'], ['레인보우로보틱스', '277810', 'D'],
    ['두산에너빌리티', '034020', 'P'], ['리가켐바이오', '141080', 'D'], ['삼양식품', '003230', 'P'], ['펩트론', '087010', 'D']];
  const reasons = DEFAULT_SETTINGS.reasonTags, mistakes = DEFAULT_SETTINGS.mistakeTags;
  const catalysts = ['방산 수출 계약 기대감', '변압기 수주 공시', '기술이전 계약 뉴스', '2차전지 반등 + 외인 순매수',
    'HBM 공급 확대 보도', '로봇 테마 강세', '원전 수주 기대', '임상 결과 발표 앞둠', '수출 데이터 호조', '플랫폼 기술 계약'];
  const out = [];
  let d = baseDate || todayStr(), seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const prevBiz = x => { do { x = addDays(x, -1); } while (['토', '일'].includes(dowOf(x))); return x; };
  d = prevBiz(d);
  for (let i = 0; i < 34; i++) {
    const sellDate = d, buyDate = prevBiz(d);
    const [name, code, market] = names[Math.floor(rnd() * names.length)];
    const buyPrice = Math.round((20000 + rnd() * 280000) / 50) * 50;
    const r = (rnd() - 0.42) * 9;                    // 약간 우상향 분포
    const sellPrice = Math.round(buyPrice * (1 + r / 100) / 50) * 50;
    const qty = Math.max(1, Math.round(3000000 / buyPrice));
    const tags = [reasons[Math.floor(rnd() * reasons.length)], reasons[Math.floor(rnd() * reasons.length)]].filter((v, k, a) => a.indexOf(v) === k);
    const win = sellPrice > buyPrice;
    out.push({
      id: uid(), demo: true, status: 'closed', strategy: rnd() < 0.85 ? '종가베팅' : '스윙', name, code, market,
      buyDate, buyTime: '15:2' + Math.floor(rnd() * 9), buyPrice, qty,
      tags, catalyst: catalysts[Math.floor(rnd() * catalysts.length)],
      reason: '거래대금 터지면서 장 막판까지 고가 유지. 내일 시초 갭 기대.',
      targetPct: 3, stopPct: -2, scenario: '갭상 3% 이상이면 시가 절반 매도, 갭하락이면 9:10까지 보고 손절',
      confidence: 1 + Math.floor(rnd() * 5), thesisAt: new Date(buyDate + 'T15:2' + Math.floor(rnd() * 9) + ':00').getTime(),
      sellDate, sellTime: '09:0' + Math.floor(rnd() * 9), sellPrice, sellQty: qty,
      thesisHit: win ? (rnd() < 0.7 ? 'O' : '△') : (rnd() < 0.6 ? 'X' : '△'),
      planKept: rnd() < 0.72 ? 'O' : 'X',
      mistakes: win ? [] : [mistakes[Math.floor(rnd() * mistakes.length)]],
      review: win ? '시초 갭 뜨고 계획대로 분할 매도.' : '갭하락 후 반등 기다리다 손절 늦음.',
      lesson: win ? '거래대금 + 장 막판 강세 조합은 유효' : '갭하락이면 기계적으로 손절',
      reviewAt: new Date(sellDate + 'T09:30:00').getTime(), updatedAt: Date.now(), deleted: false,
    });
    d = prevBiz(d);
  }
  // 복기 대기(보유 중) 1건 — 어제 매수
  const y = prevBiz(baseDate || todayStr());
  out.push({
    id: uid(), demo: true, status: 'open', strategy: '종가베팅', name: 'HD현대일렉트릭', code: '267260', market: 'P',
    buyDate: y, buyTime: '15:24', buyPrice: 412500, qty: 7, tags: ['거래대금 상위', '신고가 돌파', '외인·기관 수급'],
    catalyst: '북미 변압기 대형 수주 공시 + 외인 3일 연속 순매수',
    reason: '장중 신고가 돌파 후 눌림 없이 마감. 전력기기 섹터 동반 강세라 내일 시초 갭 확률 높다고 판단.',
    targetPct: 4, stopPct: -2.5, scenario: '시가 +2% 이상 → 절반 익절 후 나머지 고점 추적 / 시가 마이너스 → 9:05 저점 이탈 시 전량 손절',
    confidence: 4, thesisAt: new Date(y + 'T15:24:00').getTime(), updatedAt: Date.now(), deleted: false,
  });
  return out;
}

/* node 테스트용 export */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_SETTINGS, calcTrade, computeStats, closedIn, yearMonthly, searchStocks,
    addMonths, addDays, daysBetween, fmtCompact, fmtPct, makeDemoData };
}
