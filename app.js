// ===== State =====
let matType = 'bar';
let currentView = 'both';
let wholeData = null;
let wholeResult = null;
let splitShots = [];
let splitNextId = 1;
let apiKey = '';
let deferredInstallPrompt = null;
let records = [];

// ===== Init =====
window.addEventListener('DOMContentLoaded', () => {
  apiKey = localStorage.getItem('anthropic_api_key') || '';
  records = JSON.parse(localStorage.getItem('metal_records') || '[]');

  initVersionDisplay();
  updateApiKeyStatus();
  updateOnlineStatus();
  updateSaveFormVisibility();

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  if (!apiKey) setTimeout(() => openApiModal(), 600);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// ===== Version =====
function initVersionDisplay() {
  const v = window.APP_VERSION;
  if (!v) return;
  document.getElementById('header-ver').textContent = 'v' + v.version;
  document.getElementById('set-ver').textContent = 'v' + v.version;
  document.getElementById('set-build').textContent = 'Build ' + v.build;
  document.getElementById('set-date').textContent = v.releaseDate;
  document.getElementById('set-count').textContent = records.length + ' 件';

  const hist = document.getElementById('ver-history');
  hist.innerHTML = (v.history || []).map(h => `
    <div class="ver-item">
      <span class="ver-num">v${h.version}</span>
      <span class="ver-date">${h.date}</span>
      <span class="ver-note">${h.notes}</span>
    </div>`).join('');
}

// ===== Page navigation =====
function showPage(page) {
  ['measure','records','settings'].forEach(p => {
    document.getElementById('page-' + p).classList.toggle('active', p === page);
    document.getElementById('nav-' + p).classList.toggle('active', p === page);
  });
  if (page === 'records') renderRecords();
  if (page === 'settings') {
    document.getElementById('set-count').textContent = records.length + ' 件';
  }
}

// ===== Online/offline =====
function updateOnlineStatus() {
  document.getElementById('offline-bar').classList.toggle('show', !navigator.onLine);
}

// ===== Install =====
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('install_dismissed')) {
    document.getElementById('install-banner').classList.add('show');
  }
});

function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(() => {
    deferredInstallPrompt = null;
    document.getElementById('install-banner').classList.remove('show');
  });
}

function dismissInstall() {
  document.getElementById('install-banner').classList.remove('show');
  localStorage.setItem('install_dismissed', '1');
}

// ===== API Key =====
function openApiModal() { document.getElementById('api-modal').style.display = 'flex'; document.getElementById('api-key-input').value = apiKey; }
function closeApiModal() { document.getElementById('api-modal').style.display = 'none'; }
function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (key) { apiKey = key; localStorage.setItem('anthropic_api_key', key); }
  closeApiModal();
  updateApiKeyStatus();
  showToast('APIキーを保存しました');
}
function openApiModal_settings() { openApiModal(); }
function updateApiKeyStatus() {
  const el = document.getElementById('api-key-status');
  if (apiKey) el.textContent = 'sk-ant-***' + apiKey.slice(-4);
  else el.textContent = '未設定';
}

// ===== Material type =====
function switchMatType(t) {
  matType = t;
  document.getElementById('mat-bar').classList.toggle('active', t === 'bar');
  document.getElementById('mat-plate').classList.toggle('active', t === 'plate');
  resetMeasure();
}

// ===== View =====
function switchView(v) {
  currentView = v;
  ['both','whole','split'].forEach(x => document.getElementById('view-' + x).classList.toggle('active', x === v));
  document.getElementById('panel-whole').style.display = (v === 'both' || v === 'whole') ? '' : 'none';
  document.getElementById('panel-split').style.display = (v === 'both' || v === 'split') ? '' : 'none';
  updateDiff();
}

// ===== Whole =====
function handleWholeFile(e) {
  const file = e.target.files[0]; if (!file) return;
  e.target.value = '';
  const r = new FileReader();
  r.onload = ev => { wholeData = ev.target.result; startWholeAnalysis(); };
  r.readAsDataURL(file);
}

function startWholeAnalysis() {
  wholeResult = null;
  document.getElementById('whole-empty').style.display = 'none';
  document.getElementById('whole-content').style.display = 'block';
  document.getElementById('whole-stats').style.display = 'none';
  document.getElementById('whole-legend').style.display = 'none';
  document.getElementById('whole-upload-wrap').style.display = 'none';
  document.getElementById('whole-analyzing').style.display = 'flex';
  document.getElementById('whole-cnt-hd').textContent = '';
  document.getElementById('whole-img').src = wholeData;
  analyzeImage(wholeData, result => {
    wholeResult = result;
    document.getElementById('whole-analyzing').style.display = 'none';
    const sure = Math.round(result.sure_count || 0);
    const unsure = Math.round(result.unsure_count || 0);
    const total = Math.round(result.total || 0);
    const unit = result.unit || (matType === 'bar' ? '本' : '枚');
    document.getElementById('ws-sure').textContent = sure;
    document.getElementById('ws-unsure').textContent = unsure;
    document.getElementById('ws-total').textContent = total;
    document.getElementById('ws-unit').textContent = '合計(' + unit + ')';
    document.getElementById('whole-stats').style.display = 'flex';
    document.getElementById('whole-legend').style.display = 'flex';
    document.getElementById('whole-upload-wrap').style.display = 'block';
    document.getElementById('whole-cnt-hd').textContent = total + unit;
    document.getElementById('whole-zone-lbl').textContent = '画像を変更';
    drawOnCanvas(result, document.getElementById('whole-img'), document.getElementById('whole-canvas'));
    updateDiff();
    updateSaveFormVisibility();
  }, err => {
    document.getElementById('whole-analyzing').style.display = 'none';
    document.getElementById('whole-upload-wrap').style.display = 'block';
    showToast('解析エラー: ' + (err.message || '接続を確認してください'), true);
  });
}

// ===== Split =====
function handleSplitFile(e) {
  const file = e.target.files[0]; if (!file) return;
  e.target.value = '';
  const r = new FileReader();
  r.onload = ev => addSplitShot(ev.target.result);
  r.readAsDataURL(file);
}

function addSplitShot(dataUrl) {
  const id = splitNextId++;
  const shot = { id, dataUrl, status: 'analyzing', result: null, expanded: false };
  splitShots.push(shot);
  document.getElementById('split-empty').style.display = 'none';
  const list = document.getElementById('split-list');
  const el = document.createElement('div');
  el.className = 'split-item'; el.id = 'si-' + id;
  el.innerHTML = buildSplitHTML(shot);
  list.appendChild(el);
  analyzeImage(dataUrl, result => {
    shot.result = result; shot.status = 'done';
    const el2 = document.getElementById('si-' + id);
    if (el2) el2.innerHTML = buildSplitHTML(shot);
    if (shot.expanded) setTimeout(() => drawSplitOverlay(shot), 50);
    updateSplitTotals(); updateDiff(); updateSaveFormVisibility();
  }, err => {
    shot.status = 'error'; shot.error = err.message || 'エラー';
    const el2 = document.getElementById('si-' + id);
    if (el2) el2.innerHTML = buildSplitHTML(shot);
  });
}

function buildSplitHTML(shot) {
  const unit = matType === 'bar' ? '本' : '枚';
  let expand = '', sub = '解析中';
  if (shot.status === 'analyzing') {
    expand = '<div class="analyzing"><div class="spinner"></div>AI解析中...</div>';
  } else if (shot.status === 'error') {
    expand = `<div style="padding:5px 9px;font-size:10px;color:#f87171">解析失敗: ${shot.error || ''}</div>`;
    sub = 'エラー';
  } else if (shot.status === 'done' && shot.result) {
    const r = shot.result;
    const sure = Math.round(r.sure_count || 0), unsure = Math.round(r.unsure_count || 0);
    sub = `${sure}確実 + ${unsure}不確実`;
    expand = `
      <div style="padding:4px 9px;display:flex;gap:5px;">
        <span class="mb mb-b">${sure}確実</span><span class="mb mb-y">${unsure}不確実</span>
      </div>
      <div class="img-wrap" style="border-radius:0;max-height:200px;margin:0;">
        <img id="simg-${shot.id}" src="${shot.dataUrl}" alt="分割${shot.id}">
        <canvas id="scv-${shot.id}"></canvas>
      </div>`;
  }
  const total = (shot.status === 'done' && shot.result) ? Math.round(shot.result.total || 0) : '';
  return `
    <div class="split-row" onclick="toggleSplit(${shot.id})">
      <img class="split-thumb" src="${shot.dataUrl}" alt="分割${shot.id}">
      <div class="split-info">
        <div class="split-name">撮影 ${shot.id}</div>
        <div class="split-sub">${sub}</div>
      </div>
      <div class="split-cnt">${total !== '' ? `<div class="n">${total}</div><div class="u">${unit}</div>` : ''}</div>
      <button class="split-del" onclick="event.stopPropagation();deleteSplit(${shot.id})" aria-label="削除">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="split-expand${shot.expanded ? ' open' : ''}" id="sexp-${shot.id}">${expand}</div>`;
}

function toggleSplit(id) {
  const shot = splitShots.find(s => s.id === id); if (!shot) return;
  shot.expanded = !shot.expanded;
  const exp = document.getElementById('sexp-' + id);
  if (exp) exp.classList.toggle('open', shot.expanded);
  if (shot.expanded && shot.status === 'done') setTimeout(() => drawSplitOverlay(shot), 50);
}

function deleteSplit(id) {
  splitShots = splitShots.filter(s => s.id !== id);
  const el = document.getElementById('si-' + id); if (el) el.remove();
  if (!splitShots.length) document.getElementById('split-empty').style.display = 'block';
  updateSplitTotals(); updateDiff(); updateSaveFormVisibility();
}

function updateSplitTotals() {
  const done = splitShots.filter(s => s.status === 'done' && s.result);
  const total = done.reduce((a, s) => a + Math.round(s.result.total || 0), 0);
  const sure = done.reduce((a, s) => a + Math.round(s.result.sure_count || 0), 0);
  const unsure = done.reduce((a, s) => a + Math.round(s.result.unsure_count || 0), 0);
  const unit = matType === 'bar' ? '本' : '枚';
  const bar = document.getElementById('split-total-bar');
  bar.style.display = splitShots.length ? '' : 'none';
  document.getElementById('stb-total').textContent = total;
  document.getElementById('stb-unit').textContent = unit + '（分割合計）';
  document.getElementById('stb-shots').textContent = splitShots.length;
  document.getElementById('stb-sure').textContent = sure;
  document.getElementById('stb-unsure').textContent = unsure;
  document.getElementById('split-cnt-hd').textContent = done.length ? total + unit : '';
}

// ===== Diff =====
function updateDiff() {
  const sec = document.getElementById('diff-section');
  const hasSplit = splitShots.some(s => s.status === 'done');
  if (!wholeResult || !hasSplit || currentView !== 'both') { sec.style.display = 'none'; return; }
  sec.style.display = '';
  const wTotal = Math.round(wholeResult.total || 0);
  const sDone = splitShots.filter(s => s.status === 'done' && s.result);
  const sTotal = sDone.reduce((a, s) => a + Math.round(s.result.total || 0), 0);
  const unit = matType === 'bar' ? '本' : '枚';
  document.getElementById('diff-whole').textContent = wTotal + unit;
  document.getElementById('diff-split').textContent = sTotal + unit;
  const diff = sTotal - wTotal;
  const chip = document.getElementById('diff-chip');
  const comment = document.getElementById('diff-comment');
  if (diff === 0) {
    chip.textContent = '一致'; chip.className = 'diff-chip dc-match';
    comment.textContent = '全体撮影と分割合算が一致しています。';
  } else if (diff > 0) {
    chip.textContent = '+' + diff + unit + ' 過多'; chip.className = 'diff-chip dc-over';
    comment.textContent = '分割合算が' + diff + unit + '多い結果です。重複撮影の可能性があります。';
  } else {
    chip.textContent = diff + unit + ' 不足'; chip.className = 'diff-chip dc-under';
    comment.textContent = '分割合算が' + Math.abs(diff) + unit + '少ない結果です。未撮影箇所がある可能性があります。';
  }
}

// ===== Save form =====
function updateSaveFormVisibility() {
  const hasData = wholeResult || splitShots.some(s => s.status === 'done');
  document.getElementById('save-form').style.display = hasData ? '' : 'none';
}

function saveRecord() {
  const mgmtId = document.getElementById('inp-mgmt-id').value.trim();
  if (!mgmtId) { showToast('管理番号を入力してください', true); return; }

  const unit = matType === 'bar' ? '本' : '枚';
  const done = splitShots.filter(s => s.status === 'done' && s.result);
  const splitTotal = done.reduce((a, s) => a + Math.round(s.result.total || 0), 0);
  const wTotal = wholeResult ? Math.round(wholeResult.total || 0) : null;

  const rec = {
    id: Date.now(),
    mgmtId,
    location: document.getElementById('inp-location').value.trim(),
    note: document.getElementById('inp-note').value.trim(),
    matType,
    unit,
    wholeTotal: wTotal,
    splitTotal: done.length ? splitTotal : null,
    finalTotal: wTotal !== null ? wTotal : splitTotal,
    shotCount: splitShots.length,
    thumbnail: wholeData || (splitShots[0] && splitShots[0].dataUrl) || '',
    savedAt: new Date().toISOString()
  };

  records.unshift(rec);
  localStorage.setItem('metal_records', JSON.stringify(records));
  showToast('保存しました：' + mgmtId);
  document.getElementById('inp-mgmt-id').value = '';
  document.getElementById('inp-location').value = '';
  document.getElementById('inp-note').value = '';
  document.getElementById('set-count').textContent = records.length + ' 件';
}

// ===== Records =====
function renderRecords() {
  const q = (document.getElementById('rec-search').value || '').trim().toLowerCase();
  const list = document.getElementById('rec-list');
  const filtered = records.filter(r =>
    !q || r.mgmtId.toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q)
  );
  if (!filtered.length) {
    list.innerHTML = `<div class="rec-empty"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>${q ? '検索結果がありません' : '記録がまだありません'}</div>`;
    return;
  }
  list.innerHTML = filtered.map(r => {
    const dt = new Date(r.savedAt);
    const dtStr = dt.getFullYear() + '/' + String(dt.getMonth()+1).padStart(2,'0') + '/' + String(dt.getDate()).padStart(2,'0') + ' ' + String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0');
    const matLabel = r.matType === 'bar' ? '棒材' : '板材';
    const thumb = r.thumbnail ? `<img class="rec-thumb" src="${r.thumbnail}" alt="${r.mgmtId}">` : `<div class="rec-thumb" style="display:flex;align-items:center;justify-content:center;color:#6b8aaa;font-size:10px;">なし</div>`;
    let detail = `<div class="rec-detail">`;
    detail += `種別：${matLabel}　`;
    if (r.wholeTotal !== null) detail += `全体：${r.wholeTotal}${r.unit}　`;
    if (r.splitTotal !== null) detail += `分割：${r.splitTotal}${r.unit}（${r.shotCount}枚）　`;
    if (r.location) detail += `<br>場所：${r.location}`;
    if (r.note) detail += `<br>備考：${r.note}`;
    detail += `</div>`;
    return `<div class="rec-card">
      <div class="rec-header" onclick="toggleRecDetail(${r.id})">
        ${thumb}
        <div class="rec-info">
          <div class="rec-id">${r.mgmtId}</div>
          <div class="rec-meta">${dtStr} · ${matLabel}</div>
        </div>
        <div class="rec-qty"><div class="n">${r.finalTotal}</div><div class="u">${r.unit}</div></div>
      </div>
      <div class="split-expand" id="rd-${r.id}">
        ${detail}
        <div class="rec-actions">
          <button class="rec-act-btn del" onclick="deleteRecord(${r.id})">削除</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleRecDetail(id) {
  const el = document.getElementById('rd-' + id);
  if (el) el.classList.toggle('open');
}

function deleteRecord(id) {
  if (!confirm('この記録を削除しますか？')) return;
  records = records.filter(r => r.id !== id);
  localStorage.setItem('metal_records', JSON.stringify(records));
  renderRecords();
  document.getElementById('set-count').textContent = records.length + ' 件';
  showToast('削除しました');
}

// ===== CSV export =====
function exportCSV() {
  if (!records.length) { showToast('記録がありません', true); return; }
  const header = ['管理番号','材料種別','合計数量','単位','全体撮影数量','分割撮影数量','分割枚数','保管場所','備考','保存日時'];
  const rows = records.map(r => [
    r.mgmtId,
    r.matType === 'bar' ? '棒材' : '板材',
    r.finalTotal,
    r.unit,
    r.wholeTotal !== null ? r.wholeTotal : '',
    r.splitTotal !== null ? r.splitTotal : '',
    r.shotCount || '',
    r.location || '',
    r.note || '',
    r.savedAt
  ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
  const csv = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '材料カウント_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSVをダウンロードしました');
}

// ===== Canvas overlay =====
function drawSplitOverlay(shot) {
  const img = document.getElementById('simg-' + shot.id);
  const canvas = document.getElementById('scv-' + shot.id);
  if (!img || !canvas) return;
  const draw = () => drawOnCanvas(shot.result, img, canvas);
  if (img.complete && img.naturalWidth > 0) draw(); else img.onload = draw;
}

function drawOnCanvas(result, img, canvas) {
  if (!result || !img || !canvas) return;
  const wrap = img.parentElement;
  const wW = wrap.clientWidth, wH = wrap.clientHeight;
  canvas.width = wW; canvas.height = wH;
  const nW = img.naturalWidth, nH = img.naturalHeight;
  if (!nW || !nH) return;
  const ratio = nW / nH, wR = wW / wH;
  let dW, dH, ox, oy;
  if (ratio > wR) { dW = wW; dH = wW / ratio; ox = 0; oy = (wH - dH) / 2; }
  else { dH = wH; dW = wH * ratio; ox = (wW - dW) / 2; oy = 0; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, wW, wH);
  (result.items || []).forEach(item => {
    const sure = (item.confidence || 0) >= 0.7;
    ctx.strokeStyle = sure ? '#3b9eff' : '#f5c842';
    ctx.fillStyle = sure ? 'rgba(59,158,255,.13)' : 'rgba(245,200,66,.13)';
    ctx.lineWidth = 2;
    if (matType === 'bar') {
      const cx = ox + (item.cx || .5) * dW, cy = oy + (item.cy || .5) * dH, r = (item.r || .04) * dW;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = sure ? '#3b9eff' : '#f5c842';
      ctx.font = 'bold ' + Math.max(9, Math.round(r * .8)) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(item.id, cx, cy);
    } else {
      const x1 = ox + (item.x1 || 0) * dW, y1 = oy + (item.y1 || 0) * dH;
      const x2 = ox + (item.x2 || 1) * dW, y2 = oy + (item.y2 || 1) * dH;
      ctx.beginPath(); ctx.rect(x1, y1, x2 - x1, y2 - y1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = sure ? '#3b9eff' : '#f5c842';
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(item.id, x1 + 3, y1 + 2);
    }
  });
}

// ===== AI Analysis =====
async function analyzeImage(dataUrl, onSuccess, onError) {
  if (!apiKey) { onError(new Error('APIキーが未設定です。設定タブから登録してください')); return; }
  if (!navigator.onLine) { onError(new Error('オフライン中です。接続を確認してください')); return; }
  const base64 = dataUrl.split(',')[1];
  const mediaType = dataUrl.split(';')[0].split(':')[1];
  const isBar = matType === 'bar';
  const prompt = isBar
    ? `この画像には金属棒材が束になって正面（断面側）から撮影されています。各棒材の断面を1本ずつ検出し座標と信頼度を返してください。JSON形式のみで回答（説明文・Markdownなし）:\n{"items":[{"id":1,"cx":0.5,"cy":0.5,"r":0.04,"confidence":0.9}],"total":0,"sure_count":0,"unsure_count":0,"overall_confidence":0.9,"method":"断面検出","notes":"","unit":"本"}`
    : `この画像には金属板材が積み重なっています。各板材の層を1枚ずつ検出し座標と信頼度を返してください。JSON形式のみで回答（説明文・Markdownなし）:\n{"items":[{"id":1,"x1":0.1,"y1":0.1,"x2":0.9,"y2":0.2,"confidence":0.9}],"total":0,"sure_count":0,"unsure_count":0,"overall_confidence":0.9,"method":"層検出","notes":"","unit":"枚"}`;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt }
        ]}]
      })
    });
    if (!resp.ok) { const e = await resp.json(); throw new Error(e.error?.message || 'HTTP ' + resp.status); }
    const data = await resp.json();
    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    onSuccess(JSON.parse(clean));
  } catch (e) { onError(e); }
}

// ===== Reset =====
function resetMeasure() {
  wholeData = null; wholeResult = null; splitShots = []; splitNextId = 1;
  document.getElementById('whole-empty').style.display = '';
  document.getElementById('whole-content').style.display = 'none';
  document.getElementById('whole-analyzing').style.display = 'none';
  document.getElementById('whole-upload-wrap').style.display = '';
  document.getElementById('whole-cnt-hd').textContent = '';
  document.getElementById('whole-zone-lbl').textContent = '全体撮影の画像を選択 / 撮影';
  document.getElementById('split-list').innerHTML = '<div class="empty-state" id="split-empty"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>分割撮影の画像を追加（複数枚可）</div>';
  document.getElementById('split-total-bar').style.display = 'none';
  document.getElementById('split-cnt-hd').textContent = '';
  document.getElementById('diff-section').style.display = 'none';
  document.getElementById('save-form').style.display = 'none';
}

// ===== Settings actions =====
function clearAllData() {
  if (!confirm('すべての記録・設定を削除します。この操作は元に戻せません。')) return;
  localStorage.clear();
  records = []; apiKey = '';
  updateApiKeyStatus();
  document.getElementById('set-count').textContent = '0 件';
  showToast('データを削除しました');
}

// ===== Toast =====
function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
