/* 트레이드북 AI — Gemini(무료 등급, 브라우저 직접 호출)
   가드레일: 모델 자동 폴백(404/429/5xx), JSON 응답 검증, 실패해도 사용자 입력은 그대로 둠 */
'use strict';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
/* 모델 순서 (2026-10 실측): 3.8(flash-latest)은 무료 등급 혼잡(503) 잦음, 2.5 계열은 신규 키에서 종료(404)
   fast = 빠른 기록용(lite ≈1초), quality = 글쓰기용(3.5-flash + 생각 '낮음' ≈3초) */
const MODEL_CHAIN = {
  fast: ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'],
  quality: ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'],
};
const GEMINI_ERR = { 404: '모델 종료', 429: '무료 한도 초과', 500: '서버 오류', 503: '혼잡' };
const AI_SYSTEM = '너는 한국 주식 단기매매(주로 종가베팅) 매매일지 도우미다. 사용자가 준 기록만 근거로 쓰고, 기록에 없는 사실·수치를 지어내지 않는다. 매수·매도 추천이나 종목 전망은 하지 않는다. 한국어로 간결하게 쓴다.';

async function gemini({ prompt, system = AI_SYSTEM, images = [], json = false, temperature = 0.4, fast = false }) {
  if (!settings.geminiKey) throw new Error('설정 탭에서 Gemini API 키를 먼저 입력하세요');
  const models = [...(fast ? [] : [settings.geminiModel]), ...MODEL_CHAIN[fast ? 'fast' : 'quality']].filter((m, i, a) => m && a.indexOf(m) === i);
  const parts = [{ text: prompt }];
  for (const src of images.filter(Boolean)) parts.push({ inline_data: { mime_type: src.slice(5, src.indexOf(';')), data: src.split(',')[1] } });
  const body = { contents: [{ role: 'user', parts }], systemInstruction: { parts: [{ text: system }] }, generationConfig: { temperature, thinkingConfig: { thinkingLevel: 'low' } } };
  if (json) body.generationConfig.responseMimeType = 'application/json';
  const fails = [];
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), fast ? 20000 : 45000);
      try {
        res = await fetch(GEMINI_BASE + m + ':generateContent', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.geminiKey }, body: JSON.stringify(body), signal: ctrl.signal,
        });
      } catch (e) {
        if (e.name === 'AbortError') { fails.push(`${m}: 시간 초과`); break; }   // 응답 지연 → 기다리지 않고 다음 모델
        throw new Error('네트워크 오류 — 인터넷 연결 확인');
      } finally { clearTimeout(timer); }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const cand = (data.candidates || [])[0];
        const text = cand && cand.content ? (cand.content.parts || []).map(p => p.text || '').join('').trim() : '';
        if (text) return { text, model: m, sources: ((cand.groundingMetadata || {}).groundingChunks || []).map(c => c.web).filter(Boolean) };
        fails.push(`${m}: 빈 응답(${(cand && cand.finishReason) || (data.promptFeedback && data.promptFeedback.blockReason) || '?'})`);
        break;
      }
      const msg = (data.error && data.error.message) || 'HTTP ' + res.status;
      if (res.status === 400 && /thinking/i.test(msg) && body.generationConfig.thinkingConfig) { delete body.generationConfig.thinkingConfig; attempt--; continue; }   // 생각 단계 미지원 모델 → 설정 빼고 재시도
      if (res.status === 503 && attempt === 0) { await new Promise(r => setTimeout(r, 1200)); continue; }   // 일시 혼잡 → 같은 모델 1회 재시도
      if (GEMINI_ERR[res.status] || /not found|not supported|no longer available/i.test(msg)) { fails.push(`${m}: ${GEMINI_ERR[res.status] || '사용 불가'}`); break; }
      throw new Error(/API key/i.test(msg) ? 'API 키가 올바르지 않음' : msg);
    }
  }
  throw new Error('모든 모델 실패 — ' + fails.join(' · '));
}
function parseJsonLoose(text) {
  const s = text.replace(/```(json)?/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('AI 응답이 JSON 형식이 아님');
  return JSON.parse(s.slice(a, b + 1));
}
const clip = (v, n) => (typeof v === 'string' ? v.trim() : '').slice(0, n);
const numOrNull = v => { const x = parseNum(v); return isFinite(x) ? Math.round(x * 10) / 10 : null; };

/* 1) 대충 쓴 메모(+차트 캡처) → 매수 근거 구조화 */
async function aiStructureThesis(raw, ctx, imgSrcs) {
  const prompt = `아래는 내가 방금 ${ctx.name || '어떤 종목'}을(를) 매수하면서 대충 적은 메모다${imgSrcs.length ? ' (첨부: 매수 시점 차트 캡처)' : ''}.
매매일지 항목으로 정리해서 JSON 하나만 출력해.
{
 "tags": [아래 목록에서 메모 내용에 해당하는 것만 고름],
 "catalyst": "재료/뉴스 한 줄 (메모에 없으면 빈 문자열)",
 "reason": "매수 근거 2~3문장. 차트 이미지가 있으면 보이는 셋업(추세·이평선·거래량·캔들)을 1문장 덧붙임",
 "targetPct": 목표 수익률 숫자(%, 메모에 없으면 null),
 "stopPct": 손절 기준 숫자(%, 음수, 메모에 없으면 null),
 "scenario": "내일 시나리오별 대응 (메모에 없으면 빈 문자열)",
 "confidence": 1~5 (메모의 확신 정도, 알 수 없으면 null)
}
태그 목록: ${JSON.stringify(settings.reasonTags)}
메모: """${raw}"""`;
  const r = await gemini({ prompt, images: imgSrcs, json: true, temperature: 0.2, fast: true });
  const j = parseJsonLoose(r.text);
  const conf = numOrNull(j.confidence);
  return {   // 검증: 허용 태그만, 숫자 범위 확인, 길이 제한
    tags: (Array.isArray(j.tags) ? j.tags : []).filter(t => settings.reasonTags.includes(t)),
    catalyst: clip(j.catalyst, 200), reason: clip(j.reason, 600), scenario: clip(j.scenario, 300),
    targetPct: numOrNull(j.targetPct), stopPct: (x => x === null ? null : -Math.abs(x))(numOrNull(j.stopPct)),
    confidence: conf && conf >= 1 && conf <= 5 ? Math.round(conf) : null, model: r.model,
  };
}

function tradeBrief(t) {
  const c = calcTrade(t, settings);
  return {
    종목: t.name, 전략: t.strategy, 매수: `${t.buyDate} ${t.buyTime || ''} ${t.buyPrice}원`, 근거태그: t.tags, 재료: t.catalyst, 근거: t.reason,
    계획: planTxt(t), 시나리오: t.scenario, 확신도: t.confidence, 근거기록시각: t.thesisAt ? stampLabel(t.thesisAt) : '',
    ...(c ? { 매도: `${t.sellDate} ${t.sellTime || ''} ${t.sellPrice}원`, 수익률: fmtPct(c.pct), 근거적중: t.thesisHit, 계획이행: t.planKept, 실수: t.mistakes, 복기: t.review, 배운점: t.lesson } : {}),
  };
}

/* 2) 블로그 글 초안 (네이버 블로그 붙여넣기용 — 마크다운 기호 없이) */
async function aiBlogDraft(date, masked) {
  const live = liveTrades();
  const closed = live.filter(t => t.status === 'closed' && t.sellDate === date).map(tradeBrief);
  const opened = live.filter(t => t.buyDate === date).map(tradeBrief);
  if (masked) [...closed, ...opened].forEach(b => { delete b.매수; delete b.매도; });
  const prompt = `내 매매 기록으로 ${date} 매매일지 블로그 글 초안을 써줘.
구성: 제목 1줄 → 전일 종가베팅 결과(전일에 적어둔 매수 근거를 먼저, 그다음 실제 결과와 복기) → 오늘 신규 진입 종목과 근거·내일 계획 → 시황 메모 → 마무리 한두 줄.
규칙: 마크다운 기호(#, **, -) 쓰지 말고 ■ ▶ 같은 기호와 줄바꿈으로 구분. 기록에 없는 내용은 지어내지 말 것. ${masked ? '금액·수량은 쓰지 말고 수익률만.' : ''}
${settings.styleSample ? '말투는 아래 내 예전 글과 비슷하게:\n"""' + settings.styleSample.slice(0, 1500) + '"""' : '말투: 담백한 개인 일지체.'}
기록(JSON): ${JSON.stringify({ 전일결과: closed, 오늘진입: opened, 시황메모: getDayNote(date) })}`;
  return gemini({ prompt, temperature: 0.6 });
}

/* 3) 월간 코칭 */
async function aiMonthCoach(ym) {
  const st = computeStats(closedIn(liveTrades(), ym), settings);
  if (!st.n) throw new Error('이 달에 청산된 매매가 없음');
  const rows = st.rows.map(r => [r.t.sellDate, r.t.name, +r.c.pct.toFixed(2), (r.t.tags || []).join('/'), (r.t.mistakes || []).join('/'), r.t.thesisHit || '', r.t.planKept || '', r.t.confidence || '']);
  const prompt = `${ymLabel(ym)} 내 매매 결과를 분석해줘.
요약: 매매 ${st.n}회, 승률 ${st.winRate.toFixed(1)}%, 손익비 ${isFinite(st.payoff) ? st.payoff.toFixed(2) : '∞'}, 평균수익 ${fmtPct(st.avgWinPct)}, 평균손실 ${fmtPct(st.avgLossPct)}, 기대값 ${fmtPct(st.expectancy)}, 최대연패 ${st.maxLossStreak}
매매 목록 [청산일, 종목, 수익률%, 근거태그, 실수태그, 근거적중(O/△/X), 계획이행(O/X), 확신도]:
${rows.map(r => JSON.stringify(r)).join('\n')}
출력 형식(마크다운 기호 없이):
■ 잘한 점 (2개)
■ 반복된 손실 패턴 (데이터로 확인되는 것만, 숫자 근거 포함, 최대 3개)
■ 다음 달 매매 규칙 제안 (구체적인 행동 규칙 3개)
■ 블로그용 월간 결산 코멘트 (3~4문장)`;
  return gemini({ prompt, temperature: 0.4 });
}

/* ---- AI 결과 시트 ---- */
async function showAiResult(title, run) {
  openSheet(title, `<div id="ai-res"><div class="row muted"><span class="spinner"></span> Gemini 작성 중… (무료 등급은 10~30초 걸릴 수 있음)</div></div>`);
  const box = document.getElementById('ai-res');
  try {
    const r = await run();
    box.innerHTML = `<div class="ai-out" id="ai-text"></div>
      ${r.sources && r.sources.length ? `<div class="ai-src"><b>출처</b><br>${r.sources.slice(0, 6).map(s => `<a href="${esc(s.uri)}" target="_blank" rel="noopener">${esc(s.title || s.uri)}</a>`).join('<br>')}</div>` : ''}
      <div class="hint">모델: ${esc(r.model)} · AI 결과는 틀릴 수 있으니 원문·기록과 대조 후 사용</div>
      <div class="sheet-foot btn-row"><button class="btn primary" id="ai-copy">⧉ 복사</button></div>`;
    document.getElementById('ai-text').textContent = r.text;
    document.getElementById('ai-copy').onclick = () => navigator.clipboard.writeText(r.text).then(() => toast('복사됨'));
  } catch (e) {
    box.innerHTML = `<div class="ai-out"></div>`;
    box.firstElementChild.textContent = '실패: ' + e.message;
  }
}
