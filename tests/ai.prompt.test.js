/* AI 블로그 초안에 넘기는 기록 검증 (Gemini 호출 없음) — 실행: node tests/ai.prompt.test.js
   같은 날 사고 판 매매는 '전일결과'에만 한 번, 오늘 새로 산 것만 '오늘진입', 무포지션은 '무포지션' */
const assert = require('assert');
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, setTimeout, clearTimeout, crypto: globalThis.crypto, window: {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  document: { createElement: () => ({}), head: { appendChild() {} }, getElementById: () => null },
};
vm.createContext(ctx);
for (const f of ['js/core.js', 'js/sync.js', 'js/cards.js', 'js/ai.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);
run(`gemini = async ({ prompt }) => ({ text: prompt, model: 'stub', sources: [] });   // 프롬프트를 그대로 돌려받음
  const D = '2026-10-21', Y = '2026-10-20';
  const base = { qty: 1, sellQty: 1, tags: [], updatedAt: 1, deleted: false };
  trades.push(
    { ...base, id: 'same', status: 'closed', strategy: '단타', name: '당일매매', buyDate: D, buyPrice: 100, sellDate: D, sellPrice: 101 },
    { ...base, id: 'prev', status: 'closed', strategy: '종가베팅', name: '전일종베', buyDate: Y, buyPrice: 100, sellDate: D, sellPrice: 99 },
    { ...base, id: 'new', status: 'open', strategy: '종가베팅', name: '오늘진입종목', buyDate: D, buyPrice: 100 },
    { ...base, id: 'flat', status: 'flat', buyDate: D, tags: ['지수 약세'], reason: '쉼' });`);

(async () => {
  const r = await run(`aiBlogDraft('2026-10-21', false)`);
  const rec = JSON.parse(r.text.slice(r.text.indexOf('기록(JSON):') + '기록(JSON):'.length).trim());
  const names = arr => arr.map(x => x.종목);
  assert.deepStrictEqual(names(rec.전일결과).sort(), ['당일매매', '전일종베'], '청산 결과에 두 매매');
  assert.deepStrictEqual(names(rec.오늘진입), ['오늘진입종목'], '오늘 진입엔 새로 산 것만 (당일매매 제외)');
  assert.strictEqual(rec.무포지션.length, 1, '무포지션 1건');
  assert.strictEqual((r.text.match(/당일매매/g) || []).length, 1, '당일매매는 프롬프트에 한 번만');
  console.log('OK — AI 블로그 초안 기록 테스트 통과 (당일 매매 1회, 오늘 진입 1건, 무포지션 1건)');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
