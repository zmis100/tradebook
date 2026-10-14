/* 손익·통계 계산 검증 — 실행: node tests/stats.test.js
   기대값은 손으로 계산 (수수료 0.015%/0.015%, 매도세 0.20%, 원 미만 절사) */
const assert = require('assert');
const C = require('../js/core.js');
const S = { feeBuy: 0.015, feeSell: 0.015, taxSell: 0.20 };
const near = (a, b, msg, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} != ${b}`);

const T = (o) => ({ status: 'closed', deleted: false, buyDate: '2026-09-30', ...o });
const A = T({ id: 'A', buyPrice: 10000, qty: 100, sellPrice: 10500, sellDate: '2026-10-01', tags: ['거래대금 상위'], planKept: 'O', confidence: 4 });
const B = T({ id: 'B', buyPrice: 20000, qty: 50, sellPrice: 19600, sellDate: '2026-10-02', tags: ['거래대금 상위', '테마/재료'], mistakes: ['손절 지연'], planKept: 'X', confidence: 5 });
const Cc = T({ id: 'C', buyPrice: 5000, qty: 200, sellPrice: 5150, sellDate: '2026-10-03', tags: ['테마/재료'], planKept: 'O', confidence: 4 });
const open = { id: 'O', status: 'open', buyPrice: 1000, qty: 1, buyDate: '2026-10-03' };
const del = T({ id: 'X', deleted: true, buyPrice: 1000, qty: 1, sellPrice: 9000, sellDate: '2026-10-02' });
const sep = T({ id: 'S', buyPrice: 1000, qty: 10, sellPrice: 1100, sellDate: '2026-09-29' });

// 1) 단건 계산
const a = C.calcTrade(A, S);
assert.strictEqual(a.fee, 150 + 157); assert.strictEqual(a.tax, 2100); assert.strictEqual(a.net, 47593); near(a.pct, 4.7593, 'A pct');
assert.strictEqual(C.calcTrade(B, S).net, -22257);
assert.strictEqual(C.calcTrade(Cc, S).net, 27636);
assert.strictEqual(C.calcTrade(open, S), null);
const man = C.calcTrade(T({ buyPrice: 10000, qty: 100, sellPrice: 1, sellDate: '2026-10-01', netManual: '12345' }), S);
assert.strictEqual(man.net, 12345); near(man.pct, 1.2345, 'manual pct');
assert.strictEqual(C.calcTrade(T({ buyPrice: 10000, qty: 100, sellQty: 40, sellPrice: 11000, sellDate: '2026-10-01' }), S).qty, 40);

// 2) 월 필터: 삭제·미청산·다른 달 제외
const all = [Cc, open, A, del, B, sep];
const oct = C.closedIn(all, '2026-10');
assert.deepStrictEqual(oct.map(t => t.id), ['A', 'B', 'C']);

// 3) 월간 통계
const st = C.computeStats(oct, S);
assert.strictEqual(st.n, 3); assert.strictEqual(st.wins, 2); assert.strictEqual(st.losses, 1);
near(st.winRate, 66.6667, 'winRate');
assert.strictEqual(st.net, 52972);
assert.strictEqual(st.grossWin, 75229); assert.strictEqual(st.grossLoss, 22257);
near(st.profitFactor, 75229 / 22257, 'PF', 1e-9);
near(st.avgWinPct, 3.76145, 'avgWinPct'); near(st.avgLossPct, -2.2257, 'avgLossPct');
near(st.payoff, 3.76145 / 2.2257, 'payoff');
near(st.expectancy, (2 / 3) * 3.76145 - (1 / 3) * 2.2257, 'expectancy');
assert.strictEqual(st.mdd, 22257);
assert.deepStrictEqual(st.equity.map(e => e.cum), [47593, 25336, 52972]);
assert.strictEqual(st.maxWinStreak, 1); assert.strictEqual(st.maxLossStreak, 1);
assert.strictEqual(st.byDay['2026-10-02'].net, -22257);

// 4) 태그·계획 이행별 성과
const vol = st.byReason.find(g => g.key === '거래대금 상위');
assert.strictEqual(vol.n, 2); assert.strictEqual(vol.wins, 1); assert.strictEqual(vol.net, 47593 - 22257);
assert.strictEqual(st.byMistake[0].key, '손절 지연'); assert.strictEqual(st.byMistake[0].net, -22257);
const kept = st.byPlan.find(g => g.key === '계획대로');
assert.strictEqual(kept.n, 2); near(kept.winRate, 100, 'plan kept winRate');

// 5) 빈 달 / 전승 달에서 NaN·0나누기 없음
const empty = C.computeStats([], S);
assert.strictEqual(empty.n, 0); assert.strictEqual(empty.winRate, 0); assert.strictEqual(empty.payoff, 0);
const allWin = C.computeStats([A], S);
assert.strictEqual(allWin.payoff, Infinity); assert.strictEqual(allWin.profitFactor, Infinity);

// 6) 날짜 유틸 / 포맷
assert.strictEqual(C.addMonths('2026-01', -1), '2025-12');
assert.strictEqual(C.addDays('2026-02-28', 1), '2026-03-01');
assert.strictEqual(C.daysBetween('2026-10-02', '2026-10-05'), 3);
assert.strictEqual(C.fmtCompact(1234567), '+123만');
assert.strictEqual(C.fmtCompact(-250000000), '−2.5억');

// 7) 샘플 데이터가 통계를 통과
const demo = C.makeDemoData('2026-10-06');
const ds = C.computeStats(demo.filter(t => t.status === 'closed'), S);
assert.ok(ds.n > 20 && isFinite(ds.net) && ds.equity.length === ds.n, 'demo stats');
assert.strictEqual(demo.filter(t => t.status === 'open').length, 1);

// 8) 무포지션: 손익 계산·통계 제외, 그날 매수와 안 겹침, 목표·손절 필드 없음
const flats = demo.filter(t => t.status === 'flat');
assert.ok(flats.length > 0, '샘플에 무포지션 있음');
assert.strictEqual(C.calcTrade(flats[0], S), null);
assert.strictEqual(C.computeStats(demo, S).n, ds.n, '무포지션·보유는 통계 제외');
const buyDays = new Set(demo.filter(t => t.status !== 'flat').map(t => t.buyDate));
assert.ok(flats.every(f => !buyDays.has(f.buyDate) && !f.name && !f.buyPrice), '무포지션 날엔 매수·종목 없음');
assert.ok(demo.every(t => t.targetPct === undefined && t.stopPct === undefined), '목표·손절 필드 없음');
assert.ok(C.DEFAULT_SETTINGS.flatTags.length > 0);

console.log('OK — 손익/통계 테스트 전부 통과 (demo:', ds.n, '건, 승률', ds.winRate.toFixed(1) + '%, 무포지션', flats.length + '일)');
