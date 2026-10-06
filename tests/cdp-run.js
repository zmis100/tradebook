/* 헤드리스 Edge를 '실제 시간'으로 돌려 페이지의 #out 결과를 읽음
   (--virtual-time-budget 은 IndexedDB·이미지 디코딩을 기다리지 않아 E2E에 부적합)
   사용: node tests/cdp-run.js <url> <프로필폴더> [타임아웃초=90] */
const { spawn } = require('child_process');
const [url, prof, tSec = '90'] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
  '--user-data-dir=' + prof, '--remote-debugging-port=' + port, url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page' && t.url.startsWith('http')); } catch (e) { /* 아직 기동 중 */ }
  }
  if (!target) { console.log('ERROR: 페이지 연결 실패'); proc.kill(); process.exit(1); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let seq = 0; const pending = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const evaluate = expr => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })); });
  const deadline = Date.now() + Number(tSec) * 1000;
  let text = '';
  while (Date.now() < deadline) {
    const r = await evaluate("(document.getElementById('out') || {}).textContent || ''");
    text = (r.result && r.result.result && r.result.result.value) || '';
    if (/DONE|ERROR/.test(text)) break;
    await sleep(500);
  }
  console.log(text.trim() || '(결과 없음 — 시간 초과)');
  ws.close(); proc.kill();
  process.exit(/DONE/.test(text) ? 0 : 1);
})();
