/* Gemini 실호출 검증 — 앱의 실제 코드(core·sync·cards·ai.js)를 그대로 불러서 호출
   키는 js/config.js(git 제외)에서 읽음. 실행: node tests/ai.live.test.js [--ping]
   주의: 무료 등급 한도를 조금 씀 (호출 5~10회) */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, fetch, setTimeout, clearTimeout, URL, URLSearchParams, crypto: globalThis.crypto, performance, AbortController,
  window: {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { createElement: () => ({}), head: { appendChild() {} }, getElementById: () => null, body: { classList: { contains: () => false } } },
};
vm.createContext(ctx);
for (const f of ['js/config.js', 'js/core.js', 'js/sync.js', 'js/cards.js', 'js/ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const run = code => vm.runInContext(code, ctx);
const short = (s, n = 160) => String(s).replace(/\s+/g, ' ').slice(0, n);

(async () => {
  if (!run('settings.geminiKey')) { console.log('❌ js/config.js 에 geminiKey 없음'); process.exit(1); }
  const out = [];
  const t = async (name, fn) => {
    const t0 = Date.now(), sec = () => ((Date.now() - t0) / 1000).toFixed(1);
    try { const r = await fn(); out.push(`✅ ${name} (${sec()}s) ${r}`); }
    catch (e) { out.push(`❌ ${name} (${sec()}s): ${e.message}`); }
    console.log(out[out.length - 1]);
  };

  if (process.argv.includes('--ping')) {   // 모델별 현재 응답 여부
    for (const m of ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite']) {
      const t0 = Date.now();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': run('settings.geminiKey') },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }] }),
      });
      const d = await res.json().catch(() => ({}));
      console.log(`  ${m.padEnd(26)} ${res.status} ${((Date.now() - t0) / 1000).toFixed(1)}s ${d.error ? short(d.error.message, 70) : (d.modelVersion || '')}`);
    }
  }

  await t('연결', async () => { const r = await run(`gemini({ prompt: '"연결 성공"이라고만 답해.', temperature: 0 })`); return `${r.model} → ${short(r.text, 40)}`; });

  await t('근거 정리(JSON 검증)', async () => {
    const r = await run(`aiStructureThesis('변압기 수주 공시 나오고 거래대금 1위, 장 막판까지 신고가 유지. 외인 3일 연속 순매수. 내일 갭 3% 뜨면 반 팔고 마이너스면 9시5분 손절. 확신 4 정도', { name: 'HD현대일렉트릭' }, [])`);
    const bad = r.tags.filter(x => !run('settings.reasonTags').includes(x));
    if (bad.length) throw new Error('허용 목록 밖 태그: ' + bad);
    return `${r.model} tags=${JSON.stringify(r.tags)} 목표=${r.targetPct} 손절=${r.stopPct} 확신=${r.confidence} 재료="${short(r.catalyst, 40)}" 시나리오="${short(r.scenario, 60)}"`;
  });

  await t('차트 이미지 입력', async () => {
    const png = fs.readFileSync(path.join(root, 'icons/icon-512.png')).toString('base64');
    ctx.__img = 'data:image/png;base64,' + png;
    const r = await run(`aiStructureThesis('차트만 보고 셋업 정리', { name: '테스트' }, [__img])`);
    return `${r.model} reason="${short(r.reason, 90)}"`;
  });

  run(`trades.push(...makeDemoData('2026-10-06'))`);
  const day = run(`sortClosed(liveTrades().filter(t => t.status === 'closed')).pop().sellDate`);
  await t('블로그 초안', async () => {
    const r = await run(`aiBlogDraft('${day}', false)`);
    if (/\*\*|^#/m.test(r.text)) throw new Error('마크다운 기호 포함: ' + short(r.text, 80));
    return `${r.model} ${r.text.length}자 | ${short(r.text, 110)}`;
  });

  await t('월간 코칭', async () => {
    const r = await run(`aiMonthCoach(addMonths(ymOf(todayStr()), -1))`);
    return `${r.model} ${r.text.length}자 | ${short(r.text, 110)}`;
  });

  const fails = out.filter(l => l.startsWith('❌')).length;
  console.log(fails ? `\n${fails}건 실패` : '\n전부 통과');
  process.exit(fails ? 1 : 0);
})();
