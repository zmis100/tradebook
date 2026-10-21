# 트레이드북 — 종가베팅 매매일지 PWA

매수할 때 **근거를 박제**하고, 다음 날 **그 근거를 보면서 복기**하고, 블로그용 **카드 이미지**와 **월간 결산**을 자동으로 만드는 개인 매매일지.
머니북과 같은 구조: 순수 HTML/CSS/JS, 빌드 없음, PWA(오프라인), Supabase REST 동기화.

## 하루 루틴
1. **15:20 종베 매수 직후** → `＋ 기록` → 📈 매수 (30초): 종목(자동완성) · 매수가 · 수량 · 근거 칩 · 재료 한 줄 · 내일 시나리오 · 확신도 · 차트 캡처(Ctrl+V)
   - 쉬는 날은 **😴 무포지션**: 종목·가격 없이 이유 칩 · 시장 상황 · 판단 · 내일 계획만 → 일일 카드·결산 캘린더(날짜 옆 😴, 손익 없는 날은 '관망')에 표시, 손익 통계엔 미포함
   - 글 쓰기 귀찮으면 "대충 쓰고 AI로 정리"에 막 적거나 폰 키보드 마이크로 말하기 → 항목 자동 채움
   - 저장 시각이 박제됨 (다음 날 이후 수정하면 "수정" 흔적도 남음)
2. **다음 날 매도 후** → 홈 `복기 대기` 카드: 어제 근거가 위에 그대로 보임 → 매도가 · 근거 적중(O/△/X) · 계획 이행(O/X) · 실수 칩 · 배운 점 · 매도·결과 캡처
   - 캡처는 매수·결과 폼 모두 장수 제한 없음 (이미지 선택 / ⧉ 붙여넣기 / Ctrl+V)
3. **블로그** → 매매 카드(첨부 사진 전부: 매수 사진은 근거 아래, 매도 사진은 복기 아래) / 일일 카드(전일 결과 + 오늘 진입 + 시황) / 결산 카드 → `이미지 저장`·`복사`·`공유`
   - 720px 레이아웃을 2배(1440px) PNG로 저장 → 모바일 블로그에서도 글씨가 큼
   - `금액 숨김` 켜면 금액·수량 대신 수익률만 표시
4. **월말** → 결산 탭: 손익·승률·손익비·매매 횟수·기대값·PF·연승/연패·MDD, 손익 캘린더, 누적 손익, 근거별 승률, 손실 키운 실수, 계획 이행별 성과, `AI 월간 코칭`

## 배포 (GitHub Pages, 머니북과 동일)
```bash
cd tradebook
git init -b main && git add . && git commit -m "트레이드북 v1"
gh repo create zmis100/tradebook --public --source . --push
gh api -X POST repos/zmis100/tradebook/pages -f "source[branch]=main" -f "source[path]=/"
```
→ `https://zmis100.github.io/tradebook/` · 폰에서 열고 "홈 화면에 추가" (아이콘 길게 누르면 `매수 기록` 바로가기)
코드 수정 후 배포할 때는 `sw.js`의 `CACHE` 버전을 올리기.

## 연동 설정 (앱 설정 탭)
| 항목 | 방법 | 비용 |
|---|---|---|
| 클라우드 동기화 | Supabase **전용 프로젝트 `매매일지`**(서울 리전)에서 SQL Editor → `테이블 생성 SQL 복사` 내용 실행(여러 번 실행해도 안전) → Project URL·publishable 키 입력 (**secret 키 금지**) | 무료 |
| Gemini AI | [aistudio.google.com/apikey](https://aistudio.google.com/apikey)에서 키 발급 → 입력 → `연결 테스트` | 무료 등급 |

- 동기화 테이블은 `tradebook` 하나 (`kind` = trade / day / settings / img). 저장 후 2.5초 뒤 자동 동기화, 앱을 다시 열 때도 동기화. 같은 기록은 최신 수정이 이김(LWW).
- Supabase 접속정보는 기기마다 입력(동기화 안 함). Gemini 키는 설정과 함께 동기화됨.
- 차트 이미지는 압축(최대 1280px JPEG) 후 IndexedDB + Supabase에 저장, 다른 기기에선 처음 볼 때 내려받음.
- Gemini 무료 등급은 입력 내용이 구글 서비스 개선에 쓰일 수 있음 → 계좌번호 등 개인정보 입력 금지. 한도는 AI Studio에서 확인. 빠른 기록(근거 정리)은 `flash-lite-latest` 우선(≈1초), 글쓰기(블로그·코칭)는 `3.5-flash`(생각 '낮음', ≈3초) 우선. 혼잡(503)은 같은 모델 1회 재시도, 한도 초과(429)·모델 종료(404)·시간 초과(20/45초)면 다음 모델로 자동 전환 (2.5 계열은 신규 키에서 종료, 3.8은 무료 등급 혼잡 잦음 — 2026-10 실측).
- 구글 검색 연동(그라운딩)은 무료 키에서 막혀 있음(429, 결제 등록 필요) → `뉴스 검색` 버튼은 네이버 뉴스(최신순)를 새 탭으로 연다.
- 네이버 증권·DART는 브라우저에서 직접 호출 불가(CORS) → 쓰려면 Apps Script 등 중계 서버 필요.

## Supabase 일시정지 방지 (선택)
무료 프로젝트는 7일간 DB 요청이 없으면 자동 일시정지된다 (무료에선 기한 변경 불가, Pro는 일시정지 없음).
Google Apps Script로 하루 1번 작은 조회를 보내면 멈추지 않는다.
1. script.google.com → 새 프로젝트 → 아래 코드 붙여넣기
2. 프로젝트 설정 → 스크립트 속성: `SUPABASE_URL`(Project URL), `SUPABASE_KEY`(publishable 키)
3. `keepAlive` 한 번 실행해서 권한 허용 → 실행 로그 `200` 확인
4. 트리거 추가 → `keepAlive` · 시간 기반 · 일 단위 타이머 (실패하면 구글이 메일로 알림)
```javascript
function keepAlive() {
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty('SUPABASE_URL').replace(/\/+$/, '') + '/rest/v1/tradebook?select=id&limit=1';
  const key = p.getProperty('SUPABASE_KEY');
  const res = UrlFetchApp.fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
  console.log(res.getResponseCode(), res.getContentText().slice(0, 80));
  if (res.getResponseCode() !== 200) throw new Error('Supabase 응답 ' + res.getResponseCode());
}
```
멈췄더라도 대시보드에서 Restore → 기록은 기기에 남아 있으므로 그대로 다시 동기화된다.

## 계산 기준
- 순손익 = 매도금액 − 매수금액 − 수수료(매수·매도) − 매도 세금, 원 미만 절사. 증권사 실현손익을 직접 입력하면 그 값 우선.
- 기본값: 수수료 0.015%/0.015%, 매도 세금 0.20% (2026년~ 코스피 거래세 0.05%+농특세 0.15%, 코스닥 0.20%). 설정에서 변경.
- 월 통계는 **청산일(매도일)** 기준. 승률 = 수익 거래 ÷ 전체, 손익비 = 평균 수익률 ÷ |평균 손실률|, PF = 총수익 ÷ 총손실, 기대값 = 승률×평균수익률 + 패율×평균손실률.
- 수익 = 빨강, 손실 = 파랑 (국내 관례), 항상 +/− 부호 병기.

## 파일
```
index.html · style.css · manifest.webmanifest · sw.js · icons/
js/core.js    계산·통계(순수 함수) · 샘플 데이터
js/sync.js    localStorage 상태 · IndexedDB 이미지 · Supabase 동기화
js/charts.js  Canvas 차트 (블로그 캡처 시 폰트 유지)
js/cards.js   블로그 카드 3종 + PNG 저장 (html2canvas)
js/ai.js      Gemini (근거 정리 · 차트 이미지 읽기 · 블로그 초안 · 월간 코칭)
js/config.js  개인 고정 키 (git 제외 — 이 PC 전용)
js/forms.js   매수/결과/메모/상세 시트
js/views.js   홈·일지·결산·설정 화면
js/app.js     셸 · 초기화
js/stocks.js  KRX 상장종목 2,802개 스냅샷 (2026-10-06, 자동완성용 — 신규 상장은 직접 입력)
tests/        stats.test.js (node) · frame.html (412px 모바일) · export.html (PNG 결과 확인, http 서버 필요)
              ai.live.test.js (Gemini 실호출) · sync-e2e.html + cdp-run.js (Supabase 두 기기 동기화, 실제 시간)
```
- 미리보기: `index.html?demo` (빈 상태면 샘플 데이터), `&tab=stats&ym=2026-09`, `&sheet=buy|sell|detail|card-trade|card-day|card-month`
- 테스트: `node tests/stats.test.js` / `python -m http.server 8765` 후 `http://127.0.0.1:8765/tests/export.html`
