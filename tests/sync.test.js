/* 동기화 검증 — 실행: node tests/sync.test.js (네트워크 안 씀: fetch·IndexedDB 가짜)
   1) 업로드 분할: 요청 하나가 약 700KB(또는 200행) 이하, 모든 행 정확히 한 번
   2) 경합: 업로드 도중 붙인 사진·지운 사진·저장한 기록이 사라지지 않고, 같은 id가 한 요청에 두 번 안 들어감 */
const assert = require('assert');
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {}, sent = [], img = {};
let remoteRows = [], gate = null;
const ctx = {
  console, setTimeout, clearTimeout, crypto: globalThis.crypto, window: {}, __img: img,
  document: { getElementById: () => null },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  fetch: async (url, opt = {}) => {
    if (!opt.method) return { ok: true, status: 200, json: async () => remoteRows };   // 받기(GET)
    sent.push(JSON.parse(opt.body));
    if (gate) await gate.promise;                                                      // 업로드가 걸려 있는 동안 끼어들기
    return { ok: true, status: 201, json: async () => [] };
  },
};
vm.createContext(ctx);
for (const f of ['js/core.js', 'js/sync.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);
run(`settings.supabaseUrl = 'https://example.supabase.co'; settings.supabaseKey = 'test';
  rerenderActive = () => {}; toast = () => {};
  idbOp = async (mode, fn) => { const req = fn({ get: id => ({ result: __img[id] }), put: (v, k) => { __img[k] = v; return {}; }, delete: k => { delete __img[k]; return {}; } }); return req && req.result; };
  __addImg = id => { __img[id] = { id, tradeId: 'T', src: 'data:image/jpeg;base64,AAAA' }; const p = loadJSON(LS.imgPending, []); p.push(id); localStorage.setItem(LS.imgPending, JSON.stringify(p)); };`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rowsOf = reqs => reqs.flat();

(async () => {
  // ---- 1) 업로드 분할 ----
  const big = n => 'x'.repeat(n);
  const rows = [];
  for (let i = 0; i < 9; i++) rows.push({ id: 'img' + i, kind: 'img', data: { src: big(300000) }, updated_at: 't', deleted: false });
  for (let i = 0; i < 450; i++) rows.push({ id: 'tr' + i, kind: 'trade', data: { name: 'a' }, updated_at: 't', deleted: false });
  rows.splice(3, 0, { id: 'huge', kind: 'img', data: { src: big(900000) }, updated_at: 't', deleted: false });
  ctx.__rows = rows;
  await run('sbUpsert(__rows)');
  const ids = rowsOf(sent).map(r => r.id);
  assert.deepStrictEqual(ids, rows.map(r => r.id), '모든 행을 순서대로 정확히 한 번');
  for (const b of sent) {
    assert.ok(b.length <= 200, '요청당 200행 이하');
    assert.ok(b.length === 1 || JSON.stringify(b).length <= 700400, '대형 단일 행이 아니면 약 700KB 이하');
  }
  assert.ok(sent.some(b => b.length === 1 && b[0].id === 'huge'), '한도보다 큰 행은 혼자 전송');
  sent.length = 0;
  await run('sbUpsert([])');
  assert.strictEqual(sent.length, 0, '빈 목록이면 요청 없음');

  // ---- 2) 경합 ----
  run(`trades.push({ id: 'T', status: 'open', name: 'A', buyDate: '2026-10-21', buyPrice: 1, qty: 1, updatedAt: 1000, deleted: false });
       __addImg('A'); __addImg('C');
       localStorage.setItem('tb_img_deleted', JSON.stringify(['X', 'X', 'C']));`);   // C: 대기+삭제 동시, X: 삭제 중복
  let release; gate = { promise: new Promise(r => { release = r; }) };
  const p = run('syncNow(false)');
  for (let i = 0; i < 50 && !sent.length; i++) await sleep(10);
  assert.ok(sent.length >= 1, '업로드 요청이 걸려 있음');
  const first = rowsOf(sent);
  assert.strictEqual(new Set(first.map(r => r.id)).size, first.length, '한 요청에 같은 id 두 번 없음');
  assert.ok(first.some(r => r.id === 'A' && !r.deleted), 'A 업로드');
  assert.ok(first.some(r => r.id === 'C' && r.deleted) && !first.some(r => r.id === 'C' && !r.deleted), 'C는 삭제만');
  assert.strictEqual(first.filter(r => r.id === 'X').length, 1, 'X 삭제 한 번');

  // 업로드가 걸려 있는 동안: 사진 추가, 올라간 사진 삭제, 기록 수정, 동기화 재요청
  run(`__addImg('B'); removeImage('A2'); upsertTrade(Object.assign({}, getTrade('T'), { name: 'EDITED' })); syncNow(false);`);
  assert.strictEqual(run('resyncNeeded'), true, '진행 중 요청은 끝난 뒤 다시');
  release(); gate = null; await p;

  assert.deepStrictEqual(JSON.parse(run(`localStorage.getItem(LS.imgPending)`)), ['B'], '동기화 중 붙인 B는 대기 목록에 남음');
  assert.deepStrictEqual(JSON.parse(run(`localStorage.getItem('tb_img_deleted')`)), ['A2'], '동기화 중 지운 A2 삭제 표시 남음');
  assert.strictEqual(run(`getTrade('T').name`), 'EDITED', '동기화 중 저장한 기록이 되돌아가지 않음');
  assert.strictEqual(JSON.parse(run(`localStorage.getItem(LS.trades)`)).find(t => t.id === 'T').name, 'EDITED', '저장소에도 수정본');

  // 다음 동기화(자동 재실행)에서 B 업로드 · A2 삭제 · 수정본 전송
  sent.length = 0;
  for (let i = 0; i < 60 && !sent.length; i++) await sleep(100);
  for (let i = 0; i < 20 && run('syncing'); i++) await sleep(50);
  const second = rowsOf(sent);
  assert.ok(second.some(r => r.id === 'B' && !r.deleted), 'B 업로드');
  assert.ok(second.some(r => r.id === 'A2' && r.deleted), 'A2 삭제');
  assert.ok(second.some(r => r.id === 'T' && r.data.name === 'EDITED'), '수정본 업로드');
  assert.strictEqual(new Set(second.map(r => r.id)).size, second.length, '두 번째도 중복 id 없음');
  assert.deepStrictEqual(JSON.parse(run(`localStorage.getItem(LS.imgPending)`)), [], '대기 목록 비워짐');

  // 원격에서 받은 더 최신 기록은 반영
  remoteRows = [{ id: 'T', kind: 'trade', data: { status: 'open', name: 'REMOTE', buyDate: '2026-10-21', buyPrice: 1, qty: 1 }, updated_at: new Date(Date.now() + 60000).toISOString(), deleted: false }];
  await run('syncNow(false)');
  assert.strictEqual(run(`getTrade('T').name`), 'REMOTE', '원격의 더 최신 기록 반영');

  console.log('OK — 동기화 테스트 통과 (분할 ' + ids.length + '행 · 경합 6가지)');
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
