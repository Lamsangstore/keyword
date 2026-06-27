// ═══════════════════════════════════════════════════════════════
//  Code.gs — Google Apps Script (Lamsang keyword)
//  สำเนาเก็บไว้ใน repo เพื่ออ้างอิง/เวอร์ชัน — ตัวจริงรันที่ script.google.com
//  ฉบับ MERGE-SAFE (preserve images + variants) + รองรับ manual p365Map + cache-buster
//
//  ทิศทางข้อมูล (Firebase = หลัก / Sheet = backup เท่านั้น):
//    Page365  ──30 นาที──▶  Firebase     (autoSyncStockFromPage365 — อัปเดต stock)
//    Firebase ──5 นาที───▶  Sheet         (autoSync — มิเรอร์ไว้เป็น backup)
//    Sheet    ──manual──▶   Firebase      (restoreSheetToFirebase — กู้คืนตอนฉุกเฉินเท่านั้น)
//  *** Sheet ไม่เขียนทับ Firebase อัตโนมัติ — doGet ปกติเป็น read/ping ไม่ push ***
//
//  Triggers ที่ต้องตั้ง (รันครั้งเดียว):
//    setupTrigger()                  → autoSync ทุก 5 นาที (Firebase → Sheet, backup)
//    setupAutoStockSyncTrigger()     → autoSyncStockFromPage365 ทุก 30 นาที (Page365 → Firebase)
// ═══════════════════════════════════════════════════════════════

const SPREADSHEET_ID  = '1QQmq9dB40rUOMV0vPLymRiPPdPbfVPMBH7zndRhYmy0';
const SHEET_PRODUCTS  = 'Products';
const SHEET_GENERAL   = 'General';
const FIREBASE_URL    = 'https://lamsang-keyword-default-rtdb.asia-southeast1.firebasedatabase.app';
// อ่าน secret จาก Script Properties (ไม่ hardcode ใน code)
const FIREBASE_SECRET = PropertiesService.getScriptProperties().getProperty('FIREBASE_SECRET') || '';
const BACKUP_KEEP     = 10;

function _authSuffix(prefix) {
  if (!FIREBASE_SECRET) return '';
  return (prefix || '?') + 'auth=' + FIREBASE_SECRET;
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function jsOutput(text) {
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ────────────────────────────────────────────────────────────────
// HTTP entry points
// ────────────────────────────────────────────────────────────────
function doGet(e) {
  const action   = (e && e.parameter && e.parameter.action)   || '';
  const callback = (e && e.parameter && e.parameter.callback) || '';
  let result;
  try {
    switch (action) {
      // ── Sheet → Firebase (merge-safe, preserve variants) — ต้องระบุ action ชัดเจนเท่านั้น
      //    ใช้เป็น "restore จาก backup" — ไม่ทำงานจาก GET เปล่า (ดู default)
      case 'syncAll':
        result = { success: true, products: pushProductsToFirebase(), general: pushGeneralToFirebase() };
        break;
      case 'syncProducts':
        result = { success: true, result: pushProductsToFirebase() };
        break;
      case 'syncGeneral':
        result = { success: true, result: pushGeneralToFirebase() };
        break;
      // ── READ-ONLY ──
      case 'ping':
        result = { success: true, message: 'pong', time: new Date().toISOString() };
        break;
      case 'getAllProducts':
        result = { success: true, rows: getProducts() };
        break;
      case 'getGeneralList':
        result = { success: true, rows: getGeneral() };
        break;
      default:
        // Firebase = หลัก, Sheet = backup → GET เปล่าไม่ push Sheet→Firebase อัตโนมัติ
        result = {
          success: true,
          message: 'Firebase is primary. Sheet is backup-only (auto Firebase→Sheet every 5 min). ' +
                   'Sheet→Firebase runs only with explicit action=syncAll / syncProducts / syncGeneral.',
          time: new Date().toISOString()
        };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }
  const json = JSON.stringify(result);
  if (callback) return jsOutput(callback + '(' + json + ')');
  return jsonOutput(result);
}

function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'updateProducts':
        updateProducts(body.rows);
        result = { success: true, count: (body.rows||[]).length };
        break;
      case 'updateGeneral':
        updateGeneral(body.rows);
        result = { success: true, count: (body.rows||[]).length };
        break;
      default:
        result = { success: false, error: 'Unknown: ' + body.action };
    }
  } catch(err) {
    result = { success: false, error: err.message };
  }
  return jsonOutput(result);
}

// ────────────────────────────────────────────────────────────────
// 🆕 BACKUP — snapshot /products to /_backups before destructive write
// ────────────────────────────────────────────────────────────────
function _backupProducts(note) {
  try {
    const resp = UrlFetchApp.fetch(FIREBASE_URL + '/products.json' + _authSuffix(), {
      method: 'GET', muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return null;
    const products = JSON.parse(resp.getContentText()) || {};
    const count = Object.keys(products).length;
    if (!count) return null;
    const bkId = 'bk_' + Date.now();
    UrlFetchApp.fetch(FIREBASE_URL + '/_backups/' + bkId + '.json' + _authSuffix(), {
      method: 'PUT', contentType: 'application/json',
      payload: JSON.stringify({
        meta: { ts: Date.now(), source: 'apps-script', count: count, note: note || 'apps script' },
        products: products
      }),
      muteHttpExceptions: true
    });
    _rotateBackups();
    Logger.log('📸 Backup: ' + bkId + ' (' + count + ' products)');
    return bkId;
  } catch(e) {
    Logger.log('Backup failed: ' + e.message);
    return null;
  }
}

function _rotateBackups() {
  try {
    const resp = UrlFetchApp.fetch(FIREBASE_URL + '/_backups.json?shallow=true' + _authSuffix('&'), {
      method: 'GET', muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return;
    const all = JSON.parse(resp.getContentText()) || {};
    const ids = Object.keys(all).sort();
    if (ids.length > BACKUP_KEEP) {
      ids.slice(0, ids.length - BACKUP_KEEP).forEach(id => {
        UrlFetchApp.fetch(FIREBASE_URL + '/_backups/' + id + '.json' + _authSuffix(), {
          method: 'DELETE', muteHttpExceptions: true
        });
      });
    }
  } catch(e) { Logger.log('Rotate failed: ' + e.message); }
}

// Normalize Firebase response — RTDB may return array as numeric-keyed object
function _toArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).filter(k => /^\d+$/.test(k))
                              .sort((a,b) => Number(a) - Number(b));
    if (keys.length) {
      const max = Number(keys[keys.length - 1]);
      const arr = new Array(max + 1).fill('');
      keys.forEach(k => arr[Number(k)] = v[k]);
      return arr;
    }
  }
  return [];
}

function pushProductsToFirebase() {
  const sheetRows = getProducts();
  const url = FIREBASE_URL + '/products.json' + _authSuffix();

  // 1) Backup before any change
  const bkId = _backupProducts('ก่อน Sheet → Firebase (merge)');

  // 2) Fetch current Firebase state
  const resp = UrlFetchApp.fetch(url, { method: 'GET', muteHttpExceptions: true });
  const current = resp.getResponseCode() === 200 ? (JSON.parse(resp.getContentText()) || {}) : {};

  // 3) Build SKU → existing-key map (defensive — handle both array and object form)
  const skuToKey = {};
  Object.keys(current).forEach(k => {
    const r = _toArray(current[k]);
    const sku = String(r[6] || '').trim();
    if (sku) skuToKey[sku] = k;
  });

  Logger.log('📊 Firebase ปัจจุบัน: ' + Object.keys(current).length + ' rows');
  Logger.log('📊 Sheet input: ' + sheetRows.length + ' rows');
  Logger.log('📊 Match-able SKUs: ' + Object.keys(skuToKey).length);

  // 4) Build PATCH updates
  const updates = {};
  let updated = 0, created = 0, skipped = 0, variantsPreserved = 0;

  sheetRows.forEach(sr => {
    const sku = String(sr[6] || '').trim();
    if (!sku) { skipped++; return; }
    const key = skuToKey[sku];

    if (key) {
      const existing = _toArray(current[key]);
      // CRITICAL: extract variants defensively
      const existingVariants = _toArray(existing[12]);
      if (existingVariants.length) variantsPreserved++;

      const merged = [];
      // Copy existing fields, fill missing with empty
      for (let i = 0; i < 12; i++) {
        merged.push(existing[i] != null ? existing[i] : '');
      }
      // ALWAYS preserve variants array
      merged.push(existingVariants);

      // Update text fields if Sheet has non-empty value
      [0,1,2,3,7,8,9,10,11].forEach(idx => {
        const v = sr[idx];
        if (v != null && String(v).trim()) merged[idx] = String(v);
      });
      // Images: fill only when existing is empty
      if (sr[4] && !merged[4]) merged[4] = String(sr[4]);
      if (sr[5] && !merged[5]) merged[5] = String(sr[5]);

      updates[key] = merged;
      updated++;
    } else {
      // New SKU — create with derived key
      const safeKey = 'sku_' + sku.replace(/[^a-zA-Z0-9_-]/g, '_');
      updates[safeKey] = [
        String(sr[0]||''), String(sr[1]||''), String(sr[2]||''), String(sr[3]||''),
        String(sr[4]||''), String(sr[5]||''), sku,
        String(sr[7]||''), String(sr[8]||''), String(sr[9]||''),
        String(sr[10]||''), String(sr[11]||''), []
      ];
      created++;
    }
  });

  Logger.log('📊 Variants preserved: ' + variantsPreserved + ' / ' + updated + ' updates');

  // 5) PATCH (preserves Firebase keys not in updates)
  const patchResp = UrlFetchApp.fetch(url, {
    method: 'PATCH', contentType: 'application/json',
    payload: JSON.stringify(updates),
    muteHttpExceptions: true
  });

  const code = patchResp.getResponseCode();
  if (code !== 200) throw new Error('Firebase PATCH error: ' + code + ' ' + patchResp.getContentText());

  Logger.log('✅ Products merged: updated=' + updated + ' created=' + created + ' skipped=' + skipped + ' variantsPreserved=' + variantsPreserved);
  return { updated: updated, created: created, skipped: skipped, variantsPreserved: variantsPreserved, backupId: bkId };
}

function pushGeneralToFirebase() {
  const rows = getGeneral();
  const obj  = {};
  rows.forEach((row, i) => { obj['row_' + i] = row; });
  const url = FIREBASE_URL + '/general.json' + _authSuffix();
  const resp = UrlFetchApp.fetch(url, {
    method: 'PUT', contentType: 'application/json',
    payload: JSON.stringify(obj), muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) throw new Error('Firebase general error: ' + resp.getResponseCode());
  return { count: rows.length };
}

// ────────────────────────────────────────────────────────────────
// READ Sheet (unchanged)
// ────────────────────────────────────────────────────────────────
function getProducts() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_PRODUCTS);
  if (!sheet) throw new Error('ไม่พบชีท: ' + SHEET_PRODUCTS);
  return sheet.getDataRange().getValues()
    .slice(1)
    .filter(r => r[1] && String(r[1]).trim() !== '')
    .map(r => [
      String(r[1]  || ''), String(r[2]  || ''), String(r[3]  || ''),
      String(r[4]  || ''), String(r[5]  || ''), String(r[6]  || ''),
      String(r[0]  || ''), String(r[12] || ''), String(r[11] || ''),
      String(r[8]  || ''), String(r[13] || ''), String(r[14] || ''),
    ]);
}

function getGeneral() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_GENERAL);
  if (!sheet) throw new Error('ไม่พบชีท: ' + SHEET_GENERAL);
  return sheet.getDataRange().getValues()
    .slice(1)
    .filter(r => r[0] && String(r[0]).trim() !== '')
    .map(r => [String(r[1]||''), String(r[0]||''), String(r[2]||''), String(r[3]||'')]);
}

// ────────────────────────────────────────────────────────────────
// WRITE Firebase → Sheet (unchanged — variants live in Firebase only)
// ────────────────────────────────────────────────────────────────
function updateProducts(rows) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_PRODUCTS);
  if (!sheet) sheet = ss.insertSheet(SHEET_PRODUCTS);
  sheet.clearContents();
  sheet.appendRow([
    'Parent SKU','ชื่อสินค้า','ประเภท','ราคา',
    'รายละเอียดสินค้า','รูปหลักสินค้า','รูปตารางไซส์',
    'รายละเอียด No L','พิกัด Link','คอลัมน์10',
    'Column10','Link Tiktok','Link Shopee','Link Lazada','Page 365'
  ]);
  (rows||[]).forEach(r => {
    const v = Array.isArray(r) ? r : [];
    sheet.appendRow([
      v[6]||'', v[0]||'', v[1]||'', v[2]||'', v[3]||'',
      v[4]||'', v[5]||'', '', v[9]||'', '', '',
      v[8]||'', v[7]||'', v[10]||'', v[11]||'',
    ]);
  });
}

function updateGeneral(rows) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_GENERAL);
  if (!sheet) sheet = ss.insertSheet(SHEET_GENERAL);
  sheet.clearContents();
  sheet.appendRow(['หัวข้อ','ประเภท','รายละเอียด/ข้อความที่ต้องการคัดลอก','URL รูปภาพประกอบ']);
  (rows||[]).forEach(r => {
    const v = Array.isArray(r) ? r : [];
    sheet.appendRow([v[1]||'', v[0]||'', v[2]||'', v[3]||'']);
  });
}

// ────────────────────────────────────────────────────────────────
// Auto-sync Firebase → Sheet every 5 min (safe)
// ────────────────────────────────────────────────────────────────
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'autoSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('autoSync').timeBased().everyMinutes(5).create();
  Logger.log('✅ Trigger: autoSync ทุก 5 นาที');
}

function autoSync() {
  try {
    pullFirebaseToSheet('products');
    pullFirebaseToSheet('general');
  } catch(e) { Logger.log('autoSync error: ' + e.message); }
}

function pullFirebaseToSheet(collection) {
  const url = FIREBASE_URL + '/' + collection + '.json' + _authSuffix();
  const resp = UrlFetchApp.fetch(url, { method: 'GET', muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('Firebase GET error: ' + resp.getResponseCode());
  const data = JSON.parse(resp.getContentText());
  if (!data) return 0;
  const rows = Object.values(data);
  if (collection === 'products') updateProducts(rows);
  else updateGeneral(rows);
  return rows.length;
}

function syncFirebaseToSheetNow() {
  Logger.log('products: ' + pullFirebaseToSheet('products'));
  Logger.log('general: '  + pullFirebaseToSheet('general'));
}

// ────────────────────────────────────────────────────────────────
// TEST
// ────────────────────────────────────────────────────────────────
function testPushAll() {
  Logger.log('=== Test Push (MERGE-SAFE) ===');
  Logger.log(JSON.stringify(pushProductsToFirebase()));
  Logger.log(JSON.stringify(pushGeneralToFirebase()));
}
function testProducts() {
  const r = getProducts();
  Logger.log('Products: ' + r.length);
  if (r[0]) Logger.log(JSON.stringify(r[0]));
}


// ════════════════════════════════════════════════════════════════
//  AUTO-SYNC STOCK FROM PAGE365 — ทุก 30 นาที (preserve รูป + variants)
//  • รองรับ manual matching map (_adminSettings/p365Map) ให้ตรงกับฝั่งแอป
//  • cache-buster กัน Page365/CDN cache ค่าสต๊อกเก่า
// ════════════════════════════════════════════════════════════════

const PAGE365_SHOP = 'lamsangstores';
const SYNC_INTERVAL_MIN = 30;

function _autoNormVName(s) {
  return String(s||'').trim().toLowerCase().replace(/\s+/g,'');
}
function _autoNormPName(s) {
  return String(s||'').trim().toLowerCase()
    .replace(/[\s\-_\.|\/\\()\[\]{}'"`,:;!?@#$%^&*+=~]+/g,'')
    .replace(/lamsang/g,'');
}
function _p365Fetch(url) {
  // cache-buster กัน Page365/CDN ส่งค่าเก่า (ให้ตรงกับสต๊อกสดจริง)
  if (/page365\.net/i.test(url)) url += (url.indexOf('?') >= 0 ? '&' : '?') + '_cb=' + Date.now();
  const resp = UrlFetchApp.fetch(url, {
    method:'GET', muteHttpExceptions: true,
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Page365 HTTP ' + code);
  return JSON.parse(resp.getContentText());
}

function autoSyncStockFromPage365() {
  const start = Date.now();
  Logger.log('🔄 Auto-sync from Page365 starting...');

  // 0) อ่าน manual matching map (ให้ตรงกับฝั่งแอป — รุ่นที่จับคู่เองใน admin)
  let p365Map = {};
  try {
    const mResp = UrlFetchApp.fetch(FIREBASE_URL + '/_adminSettings/p365Map.json' + _authSuffix(), {
      method:'GET', muteHttpExceptions:true
    });
    if (mResp.getResponseCode() === 200) p365Map = JSON.parse(mResp.getContentText()) || {};
  } catch(e) { Logger.log('map fetch err: ' + e.message); }

  // 1) Page365 product list (paginated)
  const products = [];
  const seenIds = new Set();
  for (let page = 1; page <= 20; page++) {
    const data = _p365Fetch('https://' + PAGE365_SHOP + '.page365.net/products.json?page=' + page);
    if (!data.items || data.items.length === 0) break;
    let added = 0;
    for (const item of data.items) {
      if (!seenIds.has(item.id)) { seenIds.add(item.id); products.push(item); added++; }
    }
    if (added === 0) break;
    if (data.count && products.length >= data.count) break;
  }
  Logger.log('📦 Page365: ' + products.length + ' products');
  if (products.length === 0) { Logger.log('⚠️ Page365 ว่าง — ยกเลิก'); return; }

  // 2) Build id + SKU + name index
  const byId = {}, byParentSku = {}, byName = {};
  products.forEach(p => {
    byId[p.id] = p;
    const sku = String(p.parent_sku || p.sku || p.merchant_sku || '').trim();
    if (sku) byParentSku[sku] = p;
    const norm = _autoNormPName(p.name);
    if (norm) byName[norm] = p;
  });

  // 3) Fetch current Firebase /products
  const fbUrl = FIREBASE_URL + '/products.json' + _authSuffix();
  const fbResp = UrlFetchApp.fetch(fbUrl, { method:'GET', muteHttpExceptions: true });
  if (fbResp.getResponseCode() !== 200) throw new Error('Firebase GET ' + fbResp.getResponseCode());
  const fbData = JSON.parse(fbResp.getContentText()) || {};
  Logger.log('🔥 Firebase: ' + Object.keys(fbData).length + ' products');

  // 4) Match + prepare updates
  const updates = {};
  let mManual=0, mSku=0, mName=0, unmatched=0, stockChanges=0, varsAdded=0;
  for (const key of Object.keys(fbData)) {
    const row = _toArray(fbData[key]);
    const manual = p365Map[key];
    // resolve: manual map → SKU → name (ลำดับเดียวกับฝั่งแอป)
    let p365 = (manual && manual.id) ? (byId[manual.id] || { id: manual.id }) : null;
    if (p365) mManual++;
    if (!p365) {
      const sku = String(row[6] || '').trim();
      p365 = sku ? byParentSku[sku] : null;
      if (p365) mSku++;
    }
    if (!p365) {
      const nameNorm = _autoNormPName(row[0]||'');
      p365 = nameNorm ? byName[nameNorm] : null;
      if (p365) mName++;
    }
    if (!p365) { unmatched++; continue; }

    let detail;
    try {
      detail = _p365Fetch('https://' + PAGE365_SHOP + '.page365.net/products/' + p365.id + '.json');
    } catch(e) {
      Logger.log('✗ ' + (row[0]||key) + ' detail err: ' + e.message);
      continue;
    }
    const p365Vs = detail.variants || [];
    let curVariants = _toArray(row[12]);

    // Update stock — honor manual variant overrides, else match by name (preserve image)
    let rowChanges = 0;
    curVariants = curVariants.map(v => {
      let pv;
      const ov = manual && manual.variants ? manual.variants[v && v.name] : undefined;
      if (ov !== undefined) {
        if (ov === '') return v;                 // ผู้ใช้เลือก "ข้าม"
        pv = p365Vs.find(p => p.name === ov) || p365Vs.find(p => _autoNormVName(p.name) === _autoNormVName(ov));
      } else {
        pv = p365Vs.find(p => _autoNormVName(p.name) === _autoNormVName(v && v.name));
      }
      if (pv) {
        const newStock = pv.in_stock ? (Number(pv.available)||0) : 0;
        if (newStock !== (Number(v && v.stock)||0)) rowChanges++;
        const merged = {};
        for (const k of Object.keys(v || {})) merged[k] = v[k];
        merged.stock = newStock;
        return merged;
      }
      return v;
    });

    // Add variants from Page365 that don't exist locally — เฉพาะตอนไม่ได้จับคู่เอง (กันเพิ่มผิดตัว)
    let rowAdded = 0;
    if (!manual || !manual.id) {
      const existingNames = new Set(curVariants.map(v => _autoNormVName(v && v.name)));
      p365Vs.forEach(pv => {
        if (existingNames.has(_autoNormVName(pv.name))) return;
        curVariants.push({
          sku: '', name: pv.name || '',
          stock: pv.in_stock ? (Number(pv.available)||0) : 0, image: ''
        });
        rowAdded++;
      });
    }

    if (rowChanges === 0 && rowAdded === 0) continue;

    const newRow = [];
    for (let i = 0; i < 13; i++) newRow.push(row[i] != null ? row[i] : (i === 12 ? [] : ''));
    newRow[12] = curVariants;
    updates[key] = newRow;
    stockChanges += rowChanges;
    varsAdded += rowAdded;
  }
  Logger.log('📊 Manual=' + mManual + ' SKU=' + mSku + ' Name=' + mName + ' Unmatched=' + unmatched);
  Logger.log('📊 Stock changes=' + stockChanges + ' New variants=' + varsAdded);

  if (Object.keys(updates).length === 0) { Logger.log('✓ ไม่มีอะไรเปลี่ยน'); return; }

  // 5) Backup + PATCH
  const bkId = _backupProducts('auto-sync ' + SYNC_INTERVAL_MIN + ' min trigger');
  Logger.log('📸 Backup: ' + bkId);
  const patchResp = UrlFetchApp.fetch(fbUrl, {
    method: 'PATCH', contentType: 'application/json',
    payload: JSON.stringify(updates), muteHttpExceptions: true
  });
  if (patchResp.getResponseCode() !== 200) {
    throw new Error('Firebase PATCH ' + patchResp.getResponseCode() + ': ' + patchResp.getContentText());
  }

  // Update lastSyncAt so clients see "Sync ✓ <Nm"
  UrlFetchApp.fetch(FIREBASE_URL + '/_meta/lastSyncAt.json' + _authSuffix(), {
    method: 'PUT', contentType: 'application/json',
    payload: JSON.stringify(Date.now()), muteHttpExceptions: true
  });

  const elapsed = Math.floor((Date.now() - start) / 1000);
  Logger.log('✅ Auto-sync done in ' + elapsed + 's: ' + Object.keys(updates).length + ' products');
}

// ── Run this ONCE to activate the trigger ──
function setupAutoStockSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'autoSyncStockFromPage365') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('autoSyncStockFromPage365').timeBased().everyMinutes(SYNC_INTERVAL_MIN).create();
  Logger.log('✅ Trigger set: ทุก ' + SYNC_INTERVAL_MIN + ' นาที');
}

// Manual test
function testAutoSync() {
  autoSyncStockFromPage365();
}
