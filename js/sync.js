/* 트레이드북 데이터 계층 — localStorage 상태 + 이미지(IndexedDB) + Supabase 동기화(REST, 머니북과 같은 방식) */
'use strict';

const LS = { trades: 'tb_trades', days: 'tb_days', settings: 'tb_settings', lastSync: 'tb_last_sync', mask: 'tb_mask', imgPending: 'tb_img_pending' };
const SB_TABLE = 'tradebook';
const SETTINGS_ROW_ID = 'settings';
const DEVICE_ONLY_KEYS = ['supabaseUrl', 'supabaseKey'];   // 접속정보는 기기 로컬에만

const SUPABASE_SQL = `-- Supabase SQL Editor에서 실행 (여러 번 실행해도 안전)
create table if not exists ${SB_TABLE} (
  id text primary key,
  kind text not null default 'trade',
  data jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false
);
alter table ${SB_TABLE} enable row level security;
drop policy if exists "tradebook anon" on ${SB_TABLE};
create policy "tradebook anon" on ${SB_TABLE}
  for all to anon using (true) with check (true);
grant select, insert, update, delete on ${SB_TABLE} to anon;`;

function loadJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } }
function normalizeSettings(s) {
  const out = Object.assign({}, DEFAULT_SETTINGS, s || {});
  for (const k of ['strategies', 'reasonTags', 'mistakeTags', 'flatTags']) if (!Array.isArray(out[k]) || !out[k].length) out[k] = [...DEFAULT_SETTINGS[k]];
  for (const k of ['feeBuy', 'feeSell', 'taxSell']) { const v = Number(out[k]); out[k] = isFinite(v) ? v : DEFAULT_SETTINGS[k]; }
  delete out.dataGoKey;   // 제거된 기능(공공데이터 시세)의 예전 설정값 정리
  if (out.geminiModel === 'gemini-flash-latest') out.geminiModel = DEFAULT_SETTINGS.geminiModel;   // 예전 기본값(무료 등급 혼잡 잦음) 교체
  return out;
}

/* 개인 고정 키(js/config.js, git 제외) — 설정 값이 비어 있을 때만 채움 */
function applyConfigDefaults(s) {
  const cfg = (typeof window !== 'undefined' && window.TB_CONFIG) || {};
  for (const k of ['supabaseUrl', 'supabaseKey', 'geminiKey']) if (!s[k] && cfg[k]) s[k] = cfg[k];
  return s;
}
let settings = applyConfigDefaults(normalizeSettings(loadJSON(LS.settings, {})));
let trades = loadJSON(LS.trades, []);          // [{id,status,name,code,buy*,thesis*,sell*,review*,updatedAt,deleted}]
let days = loadJSON(LS.days, []);              // [{id:'day-YYYY-MM-DD',date,note,updatedAt,deleted}]

function saveTrades() { localStorage.setItem(LS.trades, JSON.stringify(trades)); scheduleSync(); }
function saveDays() { localStorage.setItem(LS.days, JSON.stringify(days)); scheduleSync(); }
function saveSettings() { settings._updatedAt = Date.now(); localStorage.setItem(LS.settings, JSON.stringify(settings)); scheduleSync(); }

const liveTrades = () => trades.filter(t => !t.deleted);
function getTrade(id) { return trades.find(t => t.id === id); }
function upsertTrade(t) {
  t.updatedAt = Date.now(); t.deleted = false;
  const i = trades.findIndex(x => x.id === t.id);
  if (i >= 0) trades[i] = t; else trades.push(t);
  saveTrades();
}
function deleteTrade(id) {
  const t = getTrade(id); if (!t) return;
  for (const imgId of [...(t.imgIds || []), ...(t.sellImgIds || [])]) removeImage(imgId);
  t.deleted = true; t.updatedAt = Date.now();
  saveTrades();
}
function getDayNote(date) { const d = days.find(x => x.id === 'day-' + date && !x.deleted); return d ? d.note : ''; }
function setDayNote(date, note) {
  const id = 'day-' + date;
  let d = days.find(x => x.id === id);
  if (!d) { d = { id, date }; days.push(d); }
  Object.assign(d, { note, updatedAt: Date.now(), deleted: !note });
  saveDays();
}

/* ===== 이미지: 압축 후 IndexedDB 저장, 동기화 시 Supabase에 업로드 / 없으면 필요할 때 내려받기 ===== */
let _idb;
function idb() {
  if (_idb) return _idb;
  _idb = new Promise((res, rej) => {
    const r = indexedDB.open('tradebook', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('imgs');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return _idb;
}
async function idbOp(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('imgs', mode); const req = fn(tx.objectStore('imgs'));
    tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error);
  });
}
function compressImage(file, maxW = 1280, q = 0.78) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('이미지를 읽을 수 없음')); };
    img.src = url;
  });
}
async function addImage(file, tradeId) {
  const src = await compressImage(file);
  const id = uid();
  await idbOp('readwrite', s => s.put({ id, tradeId, src }, id));
  const pend = loadJSON(LS.imgPending, []); pend.push(id); localStorage.setItem(LS.imgPending, JSON.stringify(pend));
  scheduleSync();
  return id;
}
async function getImage(id) {
  let rec = await idbOp('readonly', s => s.get(id)).catch(() => null);
  if (rec) return rec.src;
  if (!sbConfigured()) return null;
  try {   // 다른 기기에서 첨부한 이미지 → 처음 볼 때 내려받아 캐시
    const res = await fetch(sbEndpoint() + '?select=data,deleted&id=eq.' + encodeURIComponent(id), { headers: sbHeaders() });
    const rows = res.ok ? await res.json() : [];
    if (!rows[0] || rows[0].deleted || !rows[0].data.src) return null;
    await idbOp('readwrite', s => s.put({ id, ...rows[0].data }, id));
    return rows[0].data.src;
  } catch (e) { return null; }
}
function removeImage(id) {
  idbOp('readwrite', s => s.delete(id)).catch(() => {});
  const pend = loadJSON(LS.imgPending, []);
  if (pend.includes(id)) localStorage.setItem(LS.imgPending, JSON.stringify(pend.filter(x => x !== id)));
  // 이미 올라갔을 수도 있으니(업로드 중·부분 실패) 항상 삭제 표시를 남김 — 같은 id 중복은 동기화 때 정리
  const del = loadJSON('tb_img_deleted', []);
  if (!del.includes(id)) { del.push(id); localStorage.setItem('tb_img_deleted', JSON.stringify(del)); }
}

/* ===== Supabase 동기화 ===== */
function sbConfigured() { return !!(settings.supabaseUrl && settings.supabaseKey); }
function sbHeaders() { return { apikey: settings.supabaseKey, Authorization: 'Bearer ' + settings.supabaseKey, 'Content-Type': 'application/json' }; }
function sbEndpoint() { return settings.supabaseUrl.replace(/\/+$/, '').replace(/\/rest\/v1$/, '') + '/rest/v1/' + SB_TABLE; }

function updateSyncBadge(msg) {
  const st = document.getElementById('sb-status');
  if (st) st.textContent = '동기화: ' + msg;
  const b = document.getElementById('sync-badge');
  if (!b) return;
  b.hidden = !sbConfigured();
  b.textContent = msg.startsWith('오류') ? '⚠ 동기화 오류' : '☁ ' + (msg.startsWith('완료') ? '동기화됨' : msg);
  b.classList.toggle('err', msg.startsWith('오류'));
}

async function sbPullAll() {
  const rows = [], page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(sbEndpoint() + '?select=id,kind,data,updated_at,deleted&kind=neq.img', {
      headers: { ...sbHeaders(), Range: `${from}-${from + page - 1}` },
    });
    if (!res.ok && res.status !== 206) throw new Error('HTTP ' + res.status + (res.status === 404 ? ' (테이블 생성 SQL 실행 필요)' : ''));
    const chunk = await res.json();
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}
async function sbUpsert(rows) {
  // 이미지가 많아도 요청 하나가 너무 커지지 않게 약 700KB(또는 200행)씩 나눠 보냄
  let batch = [], size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const res = await fetch(sbEndpoint(), {
      method: 'POST', headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error('업로드 HTTP ' + res.status);
    batch = []; size = 0;
  };
  for (const r of rows) {
    const len = JSON.stringify(r).length;
    if (batch.length && (size + len > 700000 || batch.length >= 200)) await flush();
    batch.push(r); size += len;
  }
  await flush();
}
function mergeLww(localArr, remoteRows, toPush, kind) {
  const remoteMap = new Map(remoteRows.map(r => [r.id, r]));
  const localMap = new Map(localArr.map(t => [t.id, t]));
  const pulledRows = [];
  for (const r of remoteRows) {
    const rt = { ...r.data, id: r.id, updatedAt: new Date(r.updated_at).getTime(), deleted: r.deleted };
    const lt = localMap.get(r.id);
    if (!lt || rt.updatedAt > lt.updatedAt) { localMap.set(r.id, rt); pulledRows.push(rt); }
  }
  for (const t of localMap.values()) {
    if (t.demo) continue;   // 샘플 데이터는 기기 안에서만 (클라우드로 안 올림)
    const r = remoteMap.get(t.id);
    if (t.updatedAt > (r ? new Date(r.updated_at).getTime() : -1)) {
      const { id, updatedAt, deleted, ...data } = t;
      toPush.push({ id, kind, data, updated_at: new Date(updatedAt).toISOString(), deleted: !!deleted });
    }
  }
  return { pulledRows, pulled: pulledRows.length };
}
/* 동기화 중(통신 대기 사이)에 저장한 로컬 기록은 지키고, 원격에서 받은 것 중 더 최신인 것만 반영 */
function applyPulled(arr, pulledRows) {
  const m = new Map(arr.map(x => [x.id, x]));
  for (const rt of pulledRows) { const cur = m.get(rt.id); if (!cur || rt.updatedAt > cur.updatedAt) m.set(rt.id, rt); }
  return [...m.values()];
}

let syncing = false, syncTimer = null, resyncNeeded = false;
function scheduleSync() {
  if (!sbConfigured()) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 2500);
}
async function syncNow(showResult) {
  if (!sbConfigured()) { if (showResult) toast('설정 탭에서 Supabase를 먼저 연결해주세요'); return; }
  if (syncing) { resyncNeeded = true; return; }   // 진행 중이면 끝난 뒤 한 번 더
  syncing = true; resyncNeeded = false;
  try {
    updateSyncBadge('동기화 중…');
    const remote = await sbPullAll();
    const toPush = [];
    const tr = mergeLww(trades, remote.filter(r => r.kind === 'trade'), toPush, 'trade');
    const dy = mergeLww(days, remote.filter(r => r.kind === 'day'), toPush, 'day');
    // 설정: 최신 우선, 접속정보는 기기 로컬 유지
    const rs = remote.find(r => r.id === SETTINGS_ROW_ID);
    const localT = settings._updatedAt || 0, remoteT = rs ? new Date(rs.updated_at).getTime() : -1;
    let settingsPulled = false;
    if (rs && remoteT > localT) {
      const creds = {}; DEVICE_ONLY_KEYS.forEach(k => { creds[k] = settings[k]; });
      settings = applyConfigDefaults(Object.assign(normalizeSettings(rs.data), creds, { _updatedAt: remoteT }));
      localStorage.setItem(LS.settings, JSON.stringify(settings));
      settingsPulled = true;
    } else if (localT > 0 && localT > remoteT) {
      const shared = { ...settings }; DEVICE_ONLY_KEYS.forEach(k => delete shared[k]); delete shared._updatedAt;
      toPush.push({ id: SETTINGS_ROW_ID, kind: 'settings', data: shared, updated_at: new Date(localT).toISOString(), deleted: false });
    }
    // 이미지: 대기 중 업로드 + 삭제 표시 — 같은 id는 요청에 한 번만 (삭제가 우선, 중복 시 서버가 요청 전체를 거부)
    const pend = [...new Set(loadJSON(LS.imgPending, []))], dels = [...new Set(loadJSON('tb_img_deleted', []))];
    const delSet = new Set(dels);
    for (const id of pend) {
      if (delSet.has(id)) continue;
      const rec = await idbOp('readonly', s => s.get(id)).catch(() => null);
      if (rec) toPush.push({ id, kind: 'img', data: { tradeId: rec.tradeId, src: rec.src }, updated_at: new Date().toISOString(), deleted: false });
    }
    for (const id of dels) toPush.push({ id, kind: 'img', data: {}, updated_at: new Date().toISOString(), deleted: true });

    if (toPush.length) await sbUpsert(toPush);
    // 이번에 보낸 것만 목록에서 지움 — 동기화 도중 새로 붙이거나 지운 사진은 다음 동기화로
    const sentP = new Set(pend), sentD = new Set(dels);
    localStorage.setItem(LS.imgPending, JSON.stringify(loadJSON(LS.imgPending, []).filter(id => !sentP.has(id))));
    localStorage.setItem('tb_img_deleted', JSON.stringify(loadJSON('tb_img_deleted', []).filter(id => !sentD.has(id))));
    trades = applyPulled(trades, tr.pulledRows); days = applyPulled(days, dy.pulledRows);
    localStorage.setItem(LS.trades, JSON.stringify(trades)); localStorage.setItem(LS.days, JSON.stringify(days));
    const stamp = new Date().toLocaleString('ko-KR', { hour12: false });
    localStorage.setItem(LS.lastSync, stamp);
    updateSyncBadge('완료 ' + stamp);
    if (showResult) toast(`동기화 완료 (받기 ${tr.pulled + dy.pulled} · 보내기 ${toPush.length})`);
    if ((tr.pulled + dy.pulled) || settingsPulled) rerenderActive();
  } catch (e) {
    updateSyncBadge('오류 — ' + e.message);
    if (showResult) toast('동기화 실패: ' + e.message);
  } finally {
    syncing = false;
    if (resyncNeeded) { resyncNeeded = false; scheduleSync(); }
  }
}
