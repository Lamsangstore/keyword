// ── STATE ────────────────────────────────────────────────────
let productRows=[], generalRows=[], productKeys=[];
let currentSort='name_asc', currentTab='product';
let searchQuery='';
let selectedCat='ทั้งหมด'; // active category pill
let hideSoldOut = localStorage.getItem('hide_sold_v1')==='1'; // ซ่อนสินค้าหมด
let selectedColor = null; // null = ทุกสี
// Order matters — most specific keys FIRST (first match wins via .includes())
const CAT_ICONS = {
  // === เสื้อ — top wear (specific cuts first) ===
  'เสื้อไหมพรม':'🧶','ไหมพรม':'🧶',
  'เสื้อเชิ้ต':'👔','เสื้อเช็ต':'👔',
  'เสื้อครอป':'🎽','ครอป':'🎽',
  'เสื้อยืด':'👕',
  'เสื้อกล้าม':'🎽','กล้าม':'🎽',
  'เสื้อแขนยาว':'👚','แขนยาว':'👚','แขนกุด':'👚',
  // === กางเกง — pants by cut ===
  'กระบอกเล็ก':'👖','กระบอกกลาง':'👖','กระบอกใหญ่':'👖','กระบอก':'👖',
  'ขาม้า':'🐎','ขาสั้น':'🩳','ขายาว':'👖',
  'กางเกง':'👖','ยีนส์':'👖','jean':'👖',
  // === กระโปรง / ชุด ===
  'กระโปรง':'👗','เดรส':'👗','ชุด':'👗','dress':'👗',
  // === Accessories ===
  'เข็มขัด':'🎀','belt':'🎀',
  'รองเท้า':'👟','กระเป๋า':'👜','หมวก':'👒',
  // === Location / misc product ===
  'พิกัด':'📍','location':'📍',
  // === General / business terms ===
  'ทักทาย':'👋','ปิดท้าย':'🙏','ราคา':'💰','บริการ':'🛎️','ขนส่ง':'🚚',
  'เนื้อผ้า':'🧵','โปรโมชั่น':'🎉','โปรโม':'🎉',
  'ทั่วไป':'📋','ประเภท':'📂','ไม่เติมแล้ว':'📦','สินค้าหมด':'📦',
  'marketplace':'🛒','sync':'🔄','From':'🛒',
  // === Generic fallbacks (LAST) ===
  'เสื้อ':'👕',
};
function catIcon(t) {
  for (const k in CAT_ICONS) if (t.toLowerCase().includes(k.toLowerCase())) return CAT_ICONS[k];
  return '🏷️';
}

// ── ลักษณนาม (counter word) ตามหมวดสินค้า ──
// belts→เส้น, shoes→คู่, bags/hats→ใบ, clothing→ตัว, อื่นๆ→ชิ้น
const COUNTER_WORDS = [
  [['เข็มขัด','belt','สายคาด','สายนาฬิกา'], 'เส้น'],
  [['รองเท้า','shoe','sandal','sneaker','ถุงเท้า','ถุงน่อง'], 'คู่'],
  [['กระเป๋า','หมวก','bag','cap','hat'], 'ใบ'],
  [['เสื้อ','กางเกง','ยีนส์','jean','กระบอก','ขาสั้น','ขายาว','ขาม้า',
    'กระโปรง','เดรส','dress','ชุด','ครอป','crop','เชิ้ต','shirt','แขน','จัมพ์'], 'ตัว'],
];
function counterWord(row) {
  const hay = `${row?.[1]||''} ${row?.[0]||''}`.toLowerCase();
  for (const [keys, word] of COUNTER_WORDS) {
    if (keys.some(k => hay.includes(k.toLowerCase()))) return word;
  }
  return 'ชิ้น';
}

// ── COLOR FILTER — จัดสีของ variant เป็นกลุ่มสีหลัก ──
const COLOR_GROUPS = [
  { label:'ดำ',      sw:'#222222', keys:['ดำ','black'] },
  { label:'ขาว',     sw:'#ffffff', keys:['ขาว','white','ออฟไวท์','off white'] },
  { label:'ครีม',    sw:'#efe3c8', keys:['ครีม','เบจ','beige','cream','ไข่ไก่'] },
  { label:'เทา',     sw:'#9aa0a6', keys:['เทา','gray','grey'] },
  { label:'น้ำตาล',  sw:'#7a4a2b', keys:['น้ำตาล','brown','โกโก้','กาแฟ','coffee','tan','ตาล'] },
  { label:'กากี',    sw:'#b6a06a', keys:['กากี','khaki'] },
  { label:'แดง',     sw:'#d83a3a', keys:['แดง','red','เลือดหมู'] },
  { label:'ชมพู',    sw:'#f48fb1', keys:['ชมพู','pink','โอรส','โรส'] },
  { label:'ส้ม',     sw:'#f08a3c', keys:['ส้ม','orange','อิฐ'] },
  { label:'เหลือง',  sw:'#f2c64b', keys:['เหลือง','yellow','มัสตาร์ด','mustard'] },
  { label:'เขียว',   sw:'#5a9e57', keys:['เขียว','green','โอลีฟ','olive','ขี้ม้า','มินต์','mint'] },
  { label:'ฟ้า',     sw:'#5fb0e5', keys:['ฟ้า','sky'] },
  { label:'น้ำเงิน', sw:'#2c4a87', keys:['น้ำเงิน','navy','กรม','blue','denim','ยีน'] },
  { label:'ม่วง',    sw:'#9b6bc9', keys:['ม่วง','purple','violet','ลาเวนเดอร์','lavender'] },
  { label:'ลาย',     sw:'linear-gradient(45deg,#bbb 25%,#eee 25%,#eee 50%,#bbb 50%,#bbb 75%,#eee 75%)', keys:['ลาย','print','พิมพ์','สกรีน'] },
];
function productColorGroups(row){
  const out = new Set();
  getVariants(row).forEach(v => {
    const c = (parseVariant(v.name).color||'').toLowerCase();
    if (!c) return;
    for (const g of COLOR_GROUPS) if (g.keys.some(k => c.includes(k.toLowerCase()))) out.add(g.label);
  });
  return out;
}
// All distinct shades within a color group for a product (e.g. น้ำตาล →
// [น้ำตาลเข้ม, น้ำตาลอ่อน]). Stock is summed across sizes of the same shade.
function variantsForColor(row, colorLabel){
  const g = COLOR_GROUPS.find(x => x.label === colorLabel);
  if (!g) return [];
  const byShade = new Map(); // exact color name -> {name, img, count}
  for (const v of getVariants(row)){
    const cname = parseVariant(v.name).color || '';
    const c = cname.toLowerCase();
    if (!c || !g.keys.some(k => c.includes(k.toLowerCase()))) continue;
    const s = vStock(v);
    let ex = byShade.get(cname);
    if (!ex){ ex = { name: cname, img: '', count: 0 }; byShade.set(cname, ex); }
    if (s > 0) ex.count += s;   // นับเฉพาะจำนวนบวก (ติดลบ/0 = หมด)
    if (!ex.img && v.image) ex.img = v.image;
  }
  // stock = รวมจำนวนที่มีของ • avail = มีของ (count > 0)
  return [...byShade.values()].map(o => ({
    name: o.name, img: o.img, stock: o.count, avail: o.count > 0,
  }));
}
function toggleHideSold(btn){
  hideSoldOut = !hideSoldOut;
  localStorage.setItem('hide_sold_v1', hideSoldOut ? '1' : '0');
  updateHideSoldBtn(btn);
  window.renderProductGrid(productRows);
}
function updateHideSoldBtn(btn){
  btn = btn || document.getElementById('hideSoldBtn');
  if (!btn) return;
  btn.textContent = hideSoldOut ? '👁 แสดงของหมด' : '🙈 ซ่อนของหมด';
  btn.classList.toggle('on', hideSoldOut);
}
function buildColorChips(rows){
  const bar = document.getElementById('color-chip-bar');
  if (!bar) return;
  const present = new Map();
  (rows||[]).forEach(r => productColorGroups(r).forEach(lbl => present.set(lbl, (present.get(lbl)||0)+1)));
  const groups = COLOR_GROUPS.filter(g => present.has(g.label));
  if (groups.length < 2) { bar.style.display='none'; bar.innerHTML=''; return; }
  bar.style.display = 'flex';
  bar.innerHTML =
    `<button class="color-chip${!selectedColor?' active':''}" onclick="selectColorChip(null)">🎨 ทุกสี</button>` +
    groups.map(g => `<button class="color-chip${selectedColor===g.label?' active':''}" onclick="selectColorChip('${g.label}')">
      <span class="color-sw" style="background:${g.sw}"></span>${g.label}<span class="cc-count">${present.get(g.label)}</span>
    </button>`).join('');
}
function selectColorChip(label){
  selectedColor = label;
  buildColorChips(productRows);
  window.renderProductGrid(productRows);
}

function handleSearch(q) {
  searchQuery = q.toLowerCase().trim();
  if (currentTab==='product') window.renderProductGrid(productRows);
  else renderGeneralGrid(generalRows);
}

// ── CATEGORY PILLS + SIDEBAR ─────────────────────────────────
function buildCatPills(rows) {
  const bar     = document.getElementById('cat-pill-bar');
  const sidebar = document.getElementById('sidebar-cats');
  if (!bar && !sidebar) return;

  const counts = {};
  rows.forEach(r => { const t=r[1]||'ไม่ระบุ'; counts[t]=(counts[t]||0)+1; });
  const types = Object.keys(counts).sort((a,b)=>a.localeCompare(b,'th'));

  // escape สำหรับใช้ใน onclick attribute (single-quoted JS string)
  function escCat(s){ return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

  // ── Mobile pill bar ──
  if (bar) {
    bar.innerHTML = `<div class="cat-pill ${selectedCat==='ทั้งหมด'?'active':''}" onclick="selectCatPill('ทั้งหมด',this)">
      ✦ ทั้งหมด <span class="pill-count">${rows.length}</span>
    </div>` + types.map(t=>`
      <div class="cat-pill ${selectedCat===t?'active':''}" onclick="selectCatPill('${escCat(t)}',this)">
        ${catIcon(t)} ${t} <span class="pill-count">${counts[t]}</span>
      </div>`).join('');
  }

  // ── Desktop sidebar ──
  if (sidebar) {
    sidebar.innerHTML = `
      <button class="sidebar-cat-btn ${selectedCat==='ทั้งหมด'?'active':''}" onclick="selectCatPill('ทั้งหมด',this)">
        <span class="sidebar-cat-icon">✦</span>
        ทั้งหมด
        <span class="sidebar-cat-count">${rows.length}</span>
      </button>
      <div class="sidebar-divider"></div>
    ` + types.map(t=>`
      <button class="sidebar-cat-btn ${selectedCat===t?'active':''}" onclick="selectCatPill('${escCat(t)}',this)">
        <span class="sidebar-cat-icon">${catIcon(t)}</span>
        ${t}
        <span class="sidebar-cat-count">${counts[t]}</span>
      </button>`).join('');
  }
}

function selectCatPill(cat, el) {
  selectedCat = cat;
  showingFavOnly = false; // ปิด fav mode เมื่อกด category
  // sync pill bar
  document.querySelectorAll('.cat-pill').forEach(p=>p.classList.remove('active'));
  // sync sidebar
  document.querySelectorAll('.sidebar-cat-btn').forEach(p=>p.classList.remove('active'));
  // activate clicked element
  if(el){
    el.classList.add('active');
    if(el.scrollIntoView) el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  }
  // reset fav pill UI
  const favPill=document.getElementById('fav-tab-pill');
  if(favPill) favPill.classList.remove('active-fav');
  // re-render (ใช้ window.renderProductGrid เพื่อ pass through fav patch)
  window.renderProductGrid(productRows);
}

// ── FIREBASE ────────────────────────────────────────────────
let _customerDb = null;
let _customerP365Map = {};   // manual Page365 product↔product mapping (set in admin)
async function initFirebase(){
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  const db = firebase.database();
  _customerDb = db;
  db.ref('_adminSettings/p365Map').on('value', s => { _customerP365Map = s.val() || {}; });
  // ล็อกอิน anonymous เพื่อให้ผ่าน rules (หน้านี้อ่านอย่างเดียว + เพิ่ม log ได้)
  // ⚠️ ต้องรอเช็ก session เดิมก่อน — admin.html ใช้ origin เดียวกัน
  //    ถ้ายิง signInAnonymously ทันที จะไปเตะแอดมินที่ล็อกอินอยู่ให้หลุดเงียบ ๆ
  try {
    const existing = await new Promise(resolve => {
      const unsub = firebase.auth().onAuthStateChanged(u => { unsub(); resolve(u); });
    });
    if (!existing) await firebase.auth().signInAnonymously();
  } catch(e) {
    console.error('Anonymous auth failed:', e);
    showSyncToast('⚠️ Firebase auth ล้ม — เปิด Anonymous Auth ใน Console ก่อน', 'error');
  }
  db.ref('products').on('value', snap => {
    const raw = snap.val() || {};
    // Normalize: Firebase may return arrays as numeric-keyed objects
    const _entries = Object.entries(raw);
    productKeys = _entries.map(([k]) => k);
    productRows = _entries.map(([k, row]) => {
      let r = row;
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        const keys = Object.keys(r);
        if (keys.length && keys.every(k => /^\d+$/.test(k))) {
          r = keys.sort((a,b)=>Number(a)-Number(b)).map(k => r[k]);
        }
      }
      if (Array.isArray(r) && r[12] && typeof r[12] === 'object' && !Array.isArray(r[12])) {
        const vk = Object.keys(r[12]);
        if (vk.length && vk.every(k => /^\d+$/.test(k))) {
          r[12] = vk.sort((a,b)=>Number(a)-Number(b)).map(k => r[12][k]);
        }
      }
      return r;
    });
    buildCatPills(productRows);
    buildColorChips(productRows);
    updateHideSoldBtn();
    if (currentTab==='product') window.renderProductGrid(productRows);
    renderRecentRow();
    renderFreqRow();
    // Refresh detail page if currently viewing — keeps detail in sync with grid
    const detailView = document.getElementById('product-details-view');
    if (typeof currentDetailIdx === 'number' && currentDetailIdx >= 0
        && detailView && detailView.style.display === 'block') {
      showProductDetail(currentDetailIdx, false);
    }
  });
  db.ref('general').on('value', snap => {
    generalRows = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab==='general') renderGeneralGrid(generalRows);
  });
  // Reflect global lastSyncAt
  db.ref('_meta/lastSyncAt').on('value', snap => {
    customerLastSyncAt = snap.val() || 0;
    updateSyncBtnLabel();
  });
  // Subscribe promo config (live updates from admin)
  subscribePromo();
  // Subscribe product notes (admin can attach internal notes)
  subscribeProductNotes();
  // Subscribe theme/branding
  _customerDb.ref('_adminSettings/theme').on('value', snap => {
    const v = snap.val() || {};
    const r = document.documentElement.style;
    if (v.pink) r.setProperty('--pink', v.pink);
    if (v.purple) r.setProperty('--purple', v.purple);
  });
  // ไม่มี auto-sync ตอนเปิดหน้าแล้ว — การเขียน products ทำได้จากหน้า Admin เท่านั้น
  // (สต๊อกล่าสุดยังดึงมาแสดงตอนเปิดการ์ดสินค้าอยู่ ดู _autoSyncStockForDetail)
}

// ── CUSTOMER-SIDE PAGE365 SYNC ─────────────────────────────
const CUSTOMER_P365_PROXIES = [
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  url => `https://cors.lol/?url=${encodeURIComponent(url)}`,
  url => `https://thingproxy.freeboard.io/fetch/${url}`,
];
const CUSTOMER_SYNC_STALE_MS = 10 * 60 * 1000; // auto-sync if older than 10 min
let customerLastSyncAt = 0;
let customerSyncing = false;

async function _customerFetch(url) {
  // bust upstream cache for Page365 so CORS proxies don't serve stale stock
  if (/page365\.net/i.test(url)) url += (url.includes('?') ? '&' : '?') + '_cb=' + Date.now();
  let lastErr;
  for (const proxy of CUSTOMER_P365_PROXIES) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(proxy(url), { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(to);
      if (!res.ok) throw new Error('HTTP '+res.status);
      const txt = await res.text();
      try { return JSON.parse(txt); }
      catch { throw new Error('non-JSON'); }
    } catch(e) { lastErr = e; }
  }
  throw lastErr || new Error('CORS proxy failed');
}

function _custNormName(s){
  return String(s||'').trim().toLowerCase()
    .replace(/[\s\-_\.|\/\\()\[\]{}'"`,:;!?@#$%^&*+=~]+/g,'')
    .replace(/lamsang/g,'');
}
function _custNormVName(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,''); }

function updateSyncBtnLabel() {
  const lbls = document.querySelectorAll('.sync-label');
  if (!lbls.length) return;
  let text;
  if (!customerLastSyncAt) text = 'Sync stock';
  else {
    const min = Math.floor((Date.now() - customerLastSyncAt)/60000);
    if (min < 1) text = 'Sync ✓ <1m';
    else if (min < 60) text = `Sync ✓ ${min}m`;
    else if (min < 24*60) text = `Sync ${Math.floor(min/60)}h`;
    else text = `Sync ${Math.floor(min/1440)}d`;
  }
  lbls.forEach(l => l.textContent = text);
}
setInterval(updateSyncBtnLabel, 60000);

function _p365VariantPhoto(pv) {
  // Page365 returns the variant image under several possible keys
  return pv?.photo?.normal || pv?.photo?.url || pv?.photo_url || pv?.image_url
      || pv?.image?.normal || pv?.image?.url || pv?.image || '';
}

// ── STOCK SYNC ทั้งร้าน — ย้ายไปหน้า Admin แล้ว ─────────────
// หน้านี้เป็น "อ่านอย่างเดียว" ตาม database rules ใหม่:
// ผู้ใช้ที่ไม่ได้ล็อกอินเขียน products ไม่ได้อีกต่อไป
// การ sync ทั้งร้านทำได้ที่ admin.html (ต้องล็อกอินก่อน)
// ── รีเฟรชสต๊อกจาก Page365 (เห็นบนเครื่องตัวเอง ไม่บันทึกลงฐานข้อมูล) ──
// database rules ใหม่ไม่ให้หน้านี้เขียน products แล้ว แต่ "ดูสต๊อกล่าสุด" ยังทำได้
// โดยดึงจาก Page365 มาอัปเดตเฉพาะข้อมูลในเครื่องแล้ววาดใหม่
// การบันทึกให้ทุกคนเห็นตรงกัน ทำที่หน้า Admin (ปุ่ม Sync ทั้งหมด)
async function customerSyncFromPage365(silent) {
  if (customerSyncing) { if (!silent) showSyncToast('⏳ กำลังอัปเดตอยู่ — รอสักครู่', 'info'); return; }
  if (!productRows.length) { if (!silent) showSyncToast('❌ ยังโหลดสินค้าไม่เสร็จ', 'error'); return; }

  customerSyncing = true;
  const btns = document.querySelectorAll('.as-sync-btn');
  const lbls = document.querySelectorAll('.sync-label');
  btns.forEach(b => { b.classList.add('syncing'); b.disabled = true; });
  lbls.forEach(l => l.textContent = 'กำลังอัปเดต...');

  let matched = 0, changedRows = 0, changedVariants = 0;
  try {
    const list = await _custP365List();
    if (!list.length) throw new Error('โหลดรายการจาก Page365 ไม่ได้');

    const bySku = {}, byName = {};
    list.forEach(p => {
      const sku = String(p.parent_sku || p.sku || p.merchant_sku || '').trim();
      if (sku) bySku[sku] = p;
      byName[_custNormName(p.name)] = p;
    });

    for (let idx = 0; idx < productRows.length; idx++) {
      const row = productRows[idx], key = productKeys[idx];
      if (!Array.isArray(row[12]) || !row[12].length) continue;

      const manual = _customerP365Map[key];
      const sku = String(row[6] || '').trim();
      const norm = _custNormName(row[0] || '');
      let p365 = (manual && manual.id) ? { id: manual.id } : null;
      if (!p365 && sku) p365 = bySku[sku];
      if (!p365 && norm) p365 = byName[norm]
        || list.find(p => { const n = _custNormName(p.name); return n && (n.includes(norm) || norm.includes(n)); });
      if (!p365) continue;
      matched++;

      let detail;
      try { detail = await _customerFetch(`https://lamsangstores.page365.net/products/${p365.id}.json`); }
      catch (e) { continue; }
      const pvs = detail.variants || [];

      let hit = 0;
      const next = row[12].map(v => {
        const ov = manual?.variants?.[v.name];
        let pv;
        if (ov !== undefined) { if (ov === '') return v; pv = pvs.find(p => p.name === ov) || pvs.find(p => _custNormVName(p.name) === _custNormVName(ov)); }
        else pv = pvs.find(p => _custNormVName(p.name) === _custNormVName(v.name));
        if (!pv) return v;
        const ns = pv.in_stock ? (Number(pv.available) || 0) : 0;
        if (ns === (Number(v.stock) || 0)) return v;
        hit++;
        return { ...v, stock: ns };
      });
      if (hit) {
        const nr = [...row]; while (nr.length < 13) nr.push(''); nr[12] = next;
        productRows[idx] = nr;
        changedRows++; changedVariants += hit;
      }
    }

    // วาดใหม่ให้เห็นผลทันที
    buildCatPills(productRows);
    buildColorChips(productRows);
    if (currentTab === 'product') window.renderProductGrid(productRows);
    if (typeof currentDetailIdx === 'number' && currentDetailIdx >= 0
        && document.getElementById('product-details-view').style.display === 'block') {
      showProductDetail(currentDetailIdx, false);
    }
    customerLastSyncAt = Date.now();

    if (!silent) {
      showSyncToast(changedVariants
        ? `✓ อัปเดตสต๊อกแล้ว ${changedRows} สินค้า (${changedVariants} รุ่น) — เห็นเฉพาะเครื่องนี้`
        : `✓ สต๊อกเป็นปัจจุบันแล้ว (เทียบ ${matched} สินค้า)`, 'success');
    }
  } catch (e) {
    if (!silent) showSyncToast('❌ อัปเดตไม่สำเร็จ: ' + (e.message || 'unknown'), 'error');
  } finally {
    customerSyncing = false;
    btns.forEach(b => { b.classList.remove('syncing'); b.disabled = false; });
    updateSyncBtnLabel();
  }
}

// ── SYNC AUDIT: รุ่นที่จับคู่ Page365 ไม่ได้ (sync ไม่ได้) ──
let _umResult = null;
async function auditPage365Match() {
  const shop = 'lamsangstores';
  const seen = new Set(); const list = [];
  for (let page=1; page<=20; page++) {
    const d = await _customerFetch(`https://${shop}.page365.net/products.json?page=${page}`);
    if (!d.items?.length) break;
    let added = 0;
    for (const it of d.items) if (!seen.has(it.id)) { seen.add(it.id); list.push(it); added++; }
    if (added===0) break;
    if (d.count && list.length>=d.count) break;
  }
  const byName = {}, bySku = {};
  list.forEach(p => {
    byName[_custNormName(p.name)] = p;
    const sku = String(p.parent_sku || p.sku || p.merchant_sku || '').trim();
    if (sku) bySku[sku] = p;
  });
  const unmatched = [];
  productRows.forEach((row, idx) => {
    const sku = String(row[6]||'').trim();
    const norm = _custNormName(row[0]||'');
    let p = sku ? bySku[sku] : null;
    if (!p && norm) p = byName[norm] || list.find(x => _custNormName(x.name).includes(norm) || norm.includes(_custNormName(x.name)));
    if (!p) unmatched.push({ idx, name: row[0]||'(ไม่มีชื่อ)', sku, type: row[1]||'', sold: isSoldOut(row), reason: sku ? 'SKU & ชื่อไม่ตรงกับ Page365' : 'ไม่มี SKU + ชื่อไม่ตรง' });
  });
  return { page365Count: list.length, appCount: productRows.length, matched: productRows.length - unmatched.length, unmatched };
}

function openUnmatchedReport() {
  if (typeof closeCmdPalette === 'function') closeCmdPalette();
  const ov = document.getElementById('um-modal-overlay');
  if (!ov) return;
  ov.classList.add('open');
  document.getElementById('um-info').textContent = '⏳ กำลังตรวจรายการกับ Page365...';
  document.getElementById('um-list').innerHTML = '';
  auditPage365Match().then(res => {
    _umResult = res;
    document.getElementById('um-info').innerHTML =
      `Page365 มี <strong>${res.page365Count}</strong> รุ่น • แอปมี <strong>${res.appCount}</strong> รุ่น • ` +
      `จับคู่ได้ <strong style="color:#1a8f4f">${res.matched}</strong> • <strong style="color:#d92626">sync ไม่ได้ ${res.unmatched.length}</strong>`;
    if (!res.unmatched.length) {
      document.getElementById('um-list').innerHTML = '<div style="padding:30px;text-align:center;color:#1a8f4f;font-weight:700">🎉 ทุกรุ่นจับคู่ Page365 ได้หมดแล้ว</div>';
      return;
    }
    document.getElementById('um-list').innerHTML = res.unmatched.map((u,i) => `
      <div class="um-row" onclick="closeUnmatched();showProductDetail(${u.idx})">
        <div class="um-num">${i+1}</div>
        <div class="um-main">
          <div class="um-name">${esc(u.name)} ${u.sold?'<span class="um-sold">หมด</span>':''}</div>
          <div class="um-meta">${u.sku?`SKU: ${esc(u.sku)}`:'<span style="color:#d92626">ไม่มี SKU</span>'} • ${esc(u.type)}</div>
        </div>
      </div>`).join('');
  }).catch(e => {
    document.getElementById('um-info').textContent = '❌ ตรวจไม่สำเร็จ: ' + (e.message||'โหลด Page365 ไม่ได้');
  });
}
function closeUnmatched(){ document.getElementById('um-modal-overlay')?.classList.remove('open'); }
function copyUnmatchedList(){
  if (!_umResult?.unmatched?.length) return;
  const txt = `รุ่นที่ sync ไม่ได้ (${_umResult.unmatched.length} รุ่น) — เพิ่ม/แก้ชื่อหรือ SKU ใน Page365:\n` +
    _umResult.unmatched.map((u,i) => `${i+1}. ${u.name}${u.sku?` [SKU: ${u.sku}]`:' [ไม่มี SKU]'}`).join('\n');
  copyToClipboard(txt);
  showSyncToast('📋 Copy รายชื่อแล้ว', 'success');
}
function copyUnmatchedSkus(){
  if (!_umResult?.unmatched?.length) return;
  const skus = _umResult.unmatched.map(u=>u.sku).filter(Boolean);
  if (!skus.length) { showSyncToast('ไม่มี SKU ให้ก๊อป', 'error'); return; }
  copyToClipboard(skus.join('\n'));
  showSyncToast(`📋 Copy ${skus.length} SKU แล้ว`, 'success');
}

// ═══════════════════════════════════════════════
//  PROMO TIERS — read live from Firebase /_adminSettings/promo
// ═══════════════════════════════════════════════
const DEFAULT_PROMO = {
  enabled: true,
  header: '💰 ดีลเด็ดเฉพาะในแชท:',
  tiers: [
    { qty: 1, discount: 10 },
    { qty: 2, discount: 15 },
    { qty: 3, discount: 20 },
  ],
  shipping: '✅ พร้อมบริการ ส่งฟรีทั่วไทย ตั้งแต่ชิ้นแรก!',
  footer: 'เลือกชมสินค้าแล้วแคปรูปส่งมาสั่งซื้อในแชทนี้ได้เลยค่ะ',
};
let _promoConfig = DEFAULT_PROMO;

function subscribePromo() {
  if (!_customerDb) return;
  _customerDb.ref('_adminSettings/promo').on('value', snap => {
    const v = snap.val();
    if (v && typeof v === 'object') {
      // Normalize tiers (may come back as numeric-keyed object)
      let tiers = v.tiers;
      if (tiers && typeof tiers === 'object' && !Array.isArray(tiers)) {
        const k = Object.keys(tiers).filter(x=>/^\d+$/.test(x)).sort((a,b)=>Number(a)-Number(b));
        if (k.length) tiers = k.map(x => tiers[x]);
      }
      _promoConfig = {
        enabled: v.enabled !== false,
        header: v.header || DEFAULT_PROMO.header,
        tiers: Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_PROMO.tiers,
        shipping: v.shipping || '',
        footer: v.footer || '',
      };
    } else {
      _promoConfig = DEFAULT_PROMO;
    }
    // Refresh cart UI if drawer open
    if (document.getElementById('cart-drawer')?.classList.contains('open')) {
      renderCartDrawer();
    }
  });
}

function computePromo(items) {
  const p = _promoConfig || DEFAULT_PROMO;
  const totalQty = items.reduce((s, it) => s + (it.qty || 1), 0);
  const subtotal = items.reduce((s, it) => {
    const price = parseInt(String(it.price||'').replace(/[^0-9]/g,'')) || 0;
    return s + price * (it.qty || 1);
  }, 0);
  if (!p.enabled || !p.tiers?.length || totalQty === 0) {
    return { totalQty, subtotal, tier: null, discountPct: 0, discountAmt: 0, finalTotal: subtotal };
  }
  // Find best tier: highest qty threshold <= totalQty
  const sorted = [...p.tiers].sort((a,b) => (Number(a.qty)||0) - (Number(b.qty)||0));
  let tier = null;
  for (const t of sorted) {
    if (totalQty >= (Number(t.qty)||0)) tier = t;
  }
  const pct = tier ? (Number(tier.discount)||0) : 0;
  const discountAmt = Math.round(subtotal * pct / 100);
  return {
    totalQty, subtotal, tier,
    discountPct: pct,
    discountAmt,
    finalTotal: Math.max(0, subtotal - discountAmt)
  };
}

// Build per-quantity pricing from the configured promo tiers.
// Returns [{qty, pct, subtotal, total, avg}] sorted by qty, or [] if N/A.
function buildTierPricing(priceStr) {
  const unit = parseInt(String(priceStr||'').replace(/[^0-9]/g,'')) || 0;
  const p = _promoConfig || DEFAULT_PROMO;
  if (!unit || !p.enabled || !p.tiers?.length) return [];
  const sorted = [...p.tiers].sort((a,b) => (Number(a.qty)||0) - (Number(b.qty)||0));
  const out = [];
  const seen = new Set();
  for (const t of sorted) {
    const qty = Number(t.qty)||0;
    if (qty <= 0 || seen.has(qty)) continue;
    seen.add(qty);
    const pct = Number(t.discount)||0;
    const subtotal = unit * qty;
    const discountAmt = Math.round(subtotal * pct / 100);
    const total = subtotal - discountAmt;
    out.push({ qty, pct, subtotal, total, avg: Math.round(total/qty) });
  }
  return out;
}

// Plain-text version for sending to customers (Copy)
function tierPricingText(row) {
  const tiers = buildTierPricing(row?.[2]);
  if (!tiers.length) return '';
  const u = counterWord(row);
  const lines = tiers.map(t => t.qty === 1
    ? `${t.qty} ${u} ราคา ${t.total.toLocaleString()}฿${t.pct>0?` (ลด ${t.pct}%)`:''}`
    : `${t.qty} ${u} ราคาเฉลี่ย${u}ละ ${t.avg.toLocaleString()}฿ (รวม ${t.total.toLocaleString()}฿${t.pct>0?` ลด ${t.pct}%`:''})`
  );
  return '💰 ยิ่งซื้อเยอะ ยิ่งคุ้ม:\n' + lines.join('\n');
}

// HTML block shown in the product detail page
function buildTierPricingHtml(row, idx) {
  const tiers = buildTierPricing(row?.[2]);
  if (!tiers.length) return '';
  const u = counterWord(row);
  const rowsHtml = tiers.map(t => {
    const detail = t.qty === 1
      ? `ราคา <strong>${t.total.toLocaleString()}฿</strong>${(t.pct>0 && t.total<t.subtotal)?`<span class="tier-old">${t.subtotal.toLocaleString()}฿</span>`:''}`
      : `เฉลี่ย${u}ละ <strong>${t.avg.toLocaleString()}฿</strong> <span class="tier-sub">(รวม ${t.total.toLocaleString()}฿)</span>`;
    const badge = t.pct>0 ? `<span class="tier-badge">ลด ${t.pct}%</span>` : '';
    return `<div class="tier-row"><span class="tier-qty">${t.qty} ${u}</span><span class="tier-detail">${detail}</span>${badge}</div>`;
  }).join('');
  return `<div class="tier-pricing">
    <div class="tier-pricing-head"><span>💰 ยิ่งซื้อเยอะ ยิ่งคุ้ม</span>
      <button class="tier-copy-btn" onclick="copyTierPricing(${idx},this)">📋 Copy แจ้งลูกค้า</button>
    </div>
    ${rowsHtml}
  </div>`;
}

function copyTierPricing(idx, btn) {
  const row = productRows[idx];
  if (!row) return;
  const txt = tierPricingText(row);
  if (!txt) { showSyncToast('สินค้านี้ไม่มีราคาหลายชิ้น', 'error'); return; }
  copyToClipboard(`${row[0]||''}\n${txt}`);
  showSyncToast('📋 Copy ราคาหลายชิ้นแล้ว', 'success');
  _customerAudit('copy-tier-pricing', row[0]||'', '');
}

// ═══════════════════════════════════════════════
//  CART (ตะกร้าออเดอร์สำหรับคุยลูกค้า)
// ═══════════════════════════════════════════════
const CART_KEY = 'lamsang_cart_v1';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function saveCart(c) {
  localStorage.setItem(CART_KEY, JSON.stringify(c));
  updateCartBadge();
  const drawer = document.getElementById('cart-drawer');
  if (drawer?.classList.contains('open')) renderCartDrawer();
}
function addToCart(item) {
  const c = getCart();
  const idx = c.findIndex(x => x.idx === item.idx && x.variantName === item.variantName);
  if (idx >= 0) c[idx].qty = (c[idx].qty || 1) + (item.qty || 1);
  else c.push(item);
  saveCart(c);
  showSyncToast(`🛒 +1 ${item.name}${item.variantName?' • '+item.variantName:''}`, 'success');
  _customerAudit('cart-add', item.name||'', item.variantName||'');
}
function removeFromCart(i) { const c = getCart(); c.splice(i, 1); saveCart(c); }
function updateCartQty(i, qty) {
  const c = getCart();
  if (!c[i]) return;
  if (qty <= 0) { c.splice(i, 1); }
  else c[i].qty = qty;
  saveCart(c);
}
function clearCart() {
  if (!confirm('ล้างตะกร้าทั้งหมด?')) return;
  saveCart([]);
}
function updateCartBadge() {
  const count = getCart().reduce((s, it) => s + (it.qty || 1), 0);
  document.querySelectorAll('.cart-badge').forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'flex' : 'none';
  });
  // Floating FAB — only show when there's at least 1 item
  const fab = document.getElementById('cart-fab');
  const fabBadge = fab?.querySelector('.cart-fab-badge');
  if (fab) fab.classList.toggle('show', count > 0);
  if (fabBadge) fabBadge.textContent = count;
}

function openCartDrawer() {
  const d = document.getElementById('cart-drawer');
  if (d) { d.classList.add('open'); renderCartDrawer(); }
}
function closeCartDrawer() {
  document.getElementById('cart-drawer')?.classList.remove('open');
}

function renderCartDrawer() {
  const list = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const summary = document.getElementById('cart-promo-summary');
  if (!list || !totalEl) return;
  const items = getCart();
  if (!items.length) {
    list.innerHTML = '<div style="text-align:center;padding:50px 20px;color:var(--muted);font-size:.9em">🛒<br><br>ตะกร้าว่าง<br><span style="font-size:.85em">เปิดสินค้า → กด 🛒 เพิ่ม</span></div>';
    totalEl.textContent = '0';
    if (summary) summary.innerHTML = '';
    return;
  }
  list.innerHTML = items.map((it, i) => {
    const qty = it.qty || 1;
    const price = parseInt(String(it.price || '').replace(/[^0-9]/g, '')) || 0;
    const lineTotal = price * qty;
    return `<div class="cart-item">
      <div class="cart-item-img">${it.image ? `<img src="${esc(it.image)}" onerror="this.style.display='none';this.parentElement.textContent='📦'">` : '📦'}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(it.name || '')}</div>
        ${it.variantName ? `<div class="cart-item-variant">${esc(it.variantName)}</div>` : ''}
        <div class="cart-item-price">${price ? price + '฿' : '—'}${qty > 1 ? ` × ${qty} = <strong>${lineTotal}฿</strong>` : ''}</div>
      </div>
      <div class="cart-item-actions">
        <button class="cart-qty-btn" onclick="updateCartQty(${i}, ${qty - 1})">−</button>
        <span class="cart-qty">${qty}</span>
        <button class="cart-qty-btn" onclick="updateCartQty(${i}, ${qty + 1})">+</button>
        <button class="cart-remove-btn" onclick="removeFromCart(${i})" title="ลบ">✕</button>
      </div>
    </div>`;
  }).join('');

  // Promo computation + summary
  const p = computePromo(items);
  totalEl.textContent = p.finalTotal.toLocaleString();
  if (summary) {
    if (p.discountAmt > 0 && p.tier) {
      summary.innerHTML = `
        <div class="cart-promo-row"><span>ราคาเต็ม</span><span>${p.subtotal.toLocaleString()}฿</span></div>
        <div class="cart-promo-tier">🎯 ซื้อ ${p.totalQty} ชิ้น ลด ${p.discountPct}%</div>
        <div class="cart-promo-row cart-promo-discount"><span>ส่วนลด</span><span>−${p.discountAmt.toLocaleString()}฿</span></div>
      `;
    } else if (_promoConfig?.enabled && _promoConfig?.tiers?.length) {
      // Show next tier preview
      const sorted = [..._promoConfig.tiers].sort((a,b) => (Number(a.qty)||0) - (Number(b.qty)||0));
      const next = sorted.find(t => p.totalQty < (Number(t.qty)||0));
      if (next) {
        const need = (Number(next.qty)||0) - p.totalQty;
        summary.innerHTML = `<div class="cart-promo-hint">💡 เพิ่มอีก <strong>${need}</strong> ชิ้น → ลด <strong>${next.discount}%</strong></div>`;
      } else {
        summary.innerHTML = '';
      }
    } else {
      summary.innerHTML = '';
    }
  }
}

function generateCartMessage() {
  const items = getCart();
  if (!items.length) { showSyncToast('ตะกร้าว่าง', 'error'); return; }
  const lines = items.map((it, i) => {
    const qty = it.qty || 1;
    const price = parseInt(String(it.price || '').replace(/[^0-9]/g, '')) || 0;
    const lineTotal = price * qty;
    const variant = it.variantName ? ` ${it.variantName}` : '';
    const qtyStr = qty > 1 ? ` × ${qty}` : '';
    const priceStr = qty > 1 ? `${lineTotal}฿ (${price}×${qty})` : `${price}฿`;
    return `${i + 1}. ${it.name}${variant}${qtyStr} — ${priceStr}`;
  });
  const p = computePromo(items);
  let msg = `🛍️ สรุปออเดอร์\n\n${lines.join('\n')}`;
  if (p.discountAmt > 0 && p.tier) {
    msg += `\n\nราคาเต็ม: ${p.subtotal.toLocaleString()}฿`;
    msg += `\n🎯 ${_promoConfig.header || '💰 ดีลเด็ดเฉพาะในแชท:'}`;
    msg += `\n   ซื้อ ${p.totalQty} ชิ้น ลด ${p.discountPct}%`;
    msg += `\nส่วนลด: −${p.discountAmt.toLocaleString()}฿`;
    msg += `\n\n✨ รวมสุทธิ: ${p.finalTotal.toLocaleString()}฿`;
  } else {
    msg += `\n\n💰 รวม: ${p.subtotal.toLocaleString()}฿`;
  }
  if (_promoConfig?.shipping) msg += `\n\n${_promoConfig.shipping}`;
  if (_promoConfig?.footer) msg += `\n${_promoConfig.footer}`;
  copyToClipboard(msg);
  showSyncToast(`📋 Copy ${items.length} รายการ • ${p.finalTotal.toLocaleString()}฿`, 'success');
  logOrderHistory(items, p);
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => _fallbackCopy(text));
  } else _fallbackCopy(text);
}
function _fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
}

// Variant picker — opens when user clicks "🛒 เพิ่ม" in detail page
function openAddToCartPicker(idx) {
  const row = productRows[idx];
  if (!row) return;
  const variants = getVariants(row);
  if (!variants.length) {
    addToCart({
      idx, name: row[0] || '', price: row[2] || '', sku: row[6] || '',
      image: row[4] || '', variantName: '', qty: 1
    });
    return;
  }
  // Build picker UI — group by color
  const byColor = {};
  variants.forEach((v, vi) => {
    const { color } = parseVariant(v.name);
    const c = color || '—';
    if (!byColor[c]) byColor[c] = { img: '', items: [] };
    if (!byColor[c].img && v.image) byColor[c].img = v.image;
    byColor[c].items.push({ ...v, _vi: vi });
  });
  const colors = Object.keys(byColor);

  const body = document.getElementById('cart-picker-body');
  document.getElementById('cart-picker-title').textContent = `🛒 ${row[0] || 'เพิ่มลงตะกร้า'}`;
  body.innerHTML = colors.map(c => {
    const g = byColor[c];
    return `<div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:.88em;margin-bottom:6px;display:flex;align-items:center;gap:8px">
        ${g.img ? `<img src="${esc(g.img)}" style="width:24px;height:24px;border-radius:4px;object-fit:cover">` : ''}
        ${esc(c)}
      </div>
      <div class="cpv-grid">
        ${g.items.map(v => {
          const stock = vStock(v);
          const out = !vAvail(v);
          const {size} = parseVariant(v.name);
          const label = size || v.name;
          return `<button class="cpv-btn" ${out?'disabled':''} onclick="cartAddVariant(${idx}, ${v._vi})">
            <div class="cpv-img">${v.image ? `<img src="${esc(v.image)}">` : '📦'}</div>
            <div class="cpv-name">${esc(label)}</div>
            <div class="cpv-stock${out?' out':''}">${out ? 'หมด' : stock + ' ชิ้น'}</div>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
  document.getElementById('cart-picker').classList.add('open');
}

function closeCartPicker() {
  document.getElementById('cart-picker')?.classList.remove('open');
}

function cartAddVariant(idx, vi) {
  const row = productRows[idx];
  if (!row) return;
  const variants = getVariants(row);
  const v = variants[vi];
  if (!v) return;
  addToCart({
    idx, name: row[0] || '', price: row[2] || '', sku: row[6] || '',
    image: v.image || row[4] || '', variantName: v.name || '', qty: 1
  });
}

// ═══════════════════════════════════════════════
//  COPY TEMPLATES (เทมเพลตข้อความ chat)
// ═══════════════════════════════════════════════
const COPY_TEMPLATES = [
  {
    key: 'info',
    label: '📋 ข้อมูล',
    text: '{name}\nราคา {price}\n{detail}'
  },
  {
    key: 'ready',
    label: '✅ พร้อมส่ง',
    text: '{name} ราคา {price} ค่ะ มีของพร้อมส่งเลยนะคะ 🎀'
  },
  {
    key: 'out',
    label: '❌ ของหมด',
    text: 'ขออภัยค่ะ {name} หมดแล้วน้า 🙏 ตอนนี้ที่มีเหลือ: {avail}'
  },
  {
    key: 'sizes',
    label: '📏 ไซส์',
    text: '{name} ราคา {price} ค่ะ มีไซส์ {sizes} ลูกค้าใส่ไซส์อะไรคะ'
  },
  {
    key: 'colors',
    label: '🎨 สี',
    text: '{name} ราคา {price} ค่ะ มีสี {colors} ลูกค้าชอบสีไหนคะ'
  },
  {
    key: 'price',
    label: '💰 ราคา',
    text: '{name} ราคา {price} ค่ะ'
  },
  {
    key: 'bulk',
    label: '🧮 ราคาหลายชิ้น',
    text: '{name}\n{tierPricing}'
  },
  {
    key: 'close',
    label: '🎯 ปิดการขาย (ครบจบ)',
    text: '{name}\nราคาปกติ {price}\n\n{tierPricing}\n\n{shipping}\n{footer}'
  },
  {
    key: 'allcolors',
    label: '🖼️ ส่งรูปทุกสี',
    text: '{name} ราคา {price} ค่ะ\n\nรูปแต่ละสี:\n{colorImages}'
  },
];

function fillTemplate(tplText, row) {
  const variants = getVariants(row);
  const inStock = variants.filter(v => vAvail(v));
  const sizes = [...new Set(variants.map(v => parseVariant(v.name).size).filter(Boolean))];
  const sizeOrder = ['XS','S','M','L','XL','XXL','XXXL','3XL','4XL','5XL','FREE'];
  sizes.sort((a,b) => {
    const ai = sizeOrder.indexOf(String(a).toUpperCase());
    const bi = sizeOrder.indexOf(String(b).toUpperCase());
    if (ai>=0 && bi>=0) return ai-bi;
    if (ai>=0) return -1;
    if (bi>=0) return 1;
    return String(a).localeCompare(String(b));
  });
  const colors = [...new Set(variants.map(v => parseVariant(v.name).color).filter(Boolean))];
  const availLines = inStock.length
    ? inStock.map(v => `${v.name}: ${vStock(v)}`).join(', ')
    : '(ไม่มีเหลือ)';
  // Color image map (first variant image per color)
  const colorImgs = {};
  variants.forEach(v => {
    const {color} = parseVariant(v.name);
    if (color && !colorImgs[color] && v.image) colorImgs[color] = v.image;
  });
  const colorImageLines = Object.entries(colorImgs).length
    ? Object.entries(colorImgs).map(([c, img]) => `• ${c}: ${img}`).join('\n')
    : (row[4] ? `• รูปหลัก: ${row[4]}` : '(ไม่มีรูป)');
  return String(tplText||'')
    .replace(/\{name\}/g, row[0] || '')
    .replace(/\{price\}/g, row[2] || '')
    .replace(/\{detail\}/g, row[3] || '')
    .replace(/\{sku\}/g, row[6] || '')
    .replace(/\{sizes\}/g, sizes.join(', '))
    .replace(/\{colors\}/g, colors.join(', '))
    .replace(/\{avail\}/g, availLines)
    .replace(/\{tierPricing\}/g, tierPricingText(row))
    .replace(/\{shipping\}/g, (_promoConfig?.shipping) || '')
    .replace(/\{footer\}/g, (_promoConfig?.footer) || '')
    .replace(/\{colorImages\}/g, colorImageLines);
}

function copyWithTemplate(idx, key) {
  const row = productRows[idx];
  if (!row) return;
  const tpl = COPY_TEMPLATES.find(t => t.key === key) || COPY_TEMPLATES[0];
  const text = fillTemplate(tpl.text, row).replace(/\n{3,}/g, '\n\n').trim();
  copyToClipboard(text);
  showSyncToast(`📋 Copy ${tpl.label}`, 'success');
  _customerAudit('copy-template', row[0]||'', tpl.label);
}

// Optional audit log push from customer side
function _customerAudit(action, target, details) {
  if (!_customerDb) return;
  try {
    _customerDb.ref('_auditLog').push({
      ts: Date.now(),
      user: localStorage.getItem('admin_user') || 'index-user',
      action: String(action||''),
      target: String(target||''),
      details: details ? String(details).slice(0, 300) : ''
    }).catch(()=>{});
  } catch(e) {}
}

// Template menu next to Copy button
function toggleTemplateMenu(idx, btn) {
  const existing = document.getElementById('tpl-menu');
  if (existing) { existing.remove(); return; }
  const menu = document.createElement('div');
  menu.id = 'tpl-menu';
  menu.style.cssText = 'position:absolute;background:#fff;border:1px solid var(--pink-light);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.15);padding:6px;z-index:200;min-width:160px;display:flex;flex-direction:column;gap:2px;font-family:inherit';
  menu.innerHTML = COPY_TEMPLATES.map(t =>
    `<button onclick="copyWithTemplate(${idx},'${t.key}');document.getElementById('tpl-menu')?.remove()"
      style="background:transparent;border:none;text-align:left;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:.85em;font-family:inherit;color:inherit">${t.label}</button>`
  ).join('');
  document.body.appendChild(menu);
  if (document.body.classList.contains('dark')) {
    menu.style.background = '#2a2640';
    menu.style.borderColor = '#3a3458';
    menu.style.color = '#e4dfff';
  }
  const r = btn.getBoundingClientRect();
  menu.style.left = Math.min(r.left + window.scrollX, window.innerWidth - 180) + 'px';
  menu.style.top = (r.bottom + window.scrollY + 4) + 'px';
  setTimeout(() => {
    const close = e => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 0);
}

// ═══════════════════════════════════════════════
//  COMMAND PALETTE (Cmd+K / Ctrl+K)
// ═══════════════════════════════════════════════
let _cmdIndex = 0;
let _cmdItems = [];

const CMD_ACTIONS = [
  { keys: ['/sync','sync','/365'], label: '🔄 Sync stock จาก Page365', run: () => customerSyncFromPage365(false) },
  { keys: ['/check','sync ไม่ได้','unmatched','ตรวจ stock','รุ่นที่ sync ไม่ได้'], label: '⚠️ ตรวจรุ่นที่ Sync ไม่ได้', run: () => openUnmatchedReport() },
  { keys: ['/cart','cart','ตะกร้า','/ตะกร้า'], label: '🛒 เปิดตะกร้า', run: openCartDrawer },
  { keys: ['/dark','dark','/มืด'], label: '🌙 สลับ Dark mode', run: () => typeof toggleDark === 'function' && toggleDark() },
  { keys: ['/back','back','/กลับ'], label: '‹ กลับ', run: () => typeof handleBack === 'function' && handleBack() },
  { keys: ['/home','home','/หน้าแรก','หน้าแรก'], label: '🏠 กลับหน้าแรก', run: () => typeof goHome === 'function' && goHome() },
  { keys: ['/admin','admin'], label: '⚙️ เปิดแอดมิน', run: () => window.open('admin.html', '_blank') },
  { keys: ['/fav','fav','/โปรด'], label: '⭐ ดูรายการโปรด', run: () => { typeof showFavorites === 'function' && showFavorites(); closeCmdPalette(); } },
];

function openCmdPalette() {
  document.getElementById('cmd-palette').classList.add('open');
  const input = document.getElementById('cmd-input');
  input.value = '';
  _cmdIndex = 0;
  renderCmdResults('');
  setTimeout(() => input.focus(), 50);
}
function closeCmdPalette() {
  document.getElementById('cmd-palette').classList.remove('open');
}

// Smart search: supports >price, <price, =หมด, =เหลือน้อย, normal fuzzy
function _smartSearchMatch(row, q) {
  q = String(q||'').trim().toLowerCase();
  if (!q) return true;
  // > N → price > N
  if (q.startsWith('>')) {
    const n = parseInt(q.slice(1).replace(/[^0-9]/g,'')) || 0;
    return (parseInt(String(row[2]||'').replace(/[^0-9]/g,''))||0) > n;
  }
  if (q.startsWith('<')) {
    const n = parseInt(q.slice(1).replace(/[^0-9]/g,'')) || 0;
    return (parseInt(String(row[2]||'').replace(/[^0-9]/g,''))||0) < n;
  }
  // Stock status filters
  if (q === '=หมด' || q === 'sold') return isSoldOut(row);
  if (q === '=น้อย' || q === '=เหลือน้อย' || q === 'low') return hasLowStock(row);
  // Normal text match — try includes first, then fuzzy
  const name = (row[0]||'').toLowerCase();
  const type = (row[1]||'').toLowerCase();
  const sku  = (row[6]||'').toLowerCase();
  if (name.includes(q) || type.includes(q) || sku.includes(q)) return true;
  return _fuzzyMatch(q, name) || _fuzzyMatch(q, type);
}

// Simple fuzzy: every char of query must appear in order in target
function _fuzzyMatch(query, target) {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = String(target||'').toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function renderCmdResults(query) {
  const q = (query || '').trim();
  const list = document.getElementById('cmd-results');
  if (!list) return;
  const items = [];

  // 1. Action commands (only when query is empty OR starts with /)
  if (q === '' || q.startsWith('/')) {
    CMD_ACTIONS.forEach(a => {
      if (q === '' || a.keys.some(k => _fuzzyMatch(q, k) || _fuzzyMatch(q, a.label))) {
        items.push({ type: 'action', label: a.label, run: a.run });
      }
    });
  }

  // 2. SKU search (prefix :)
  if (q.startsWith(':')) {
    const skuQ = q.slice(1).toLowerCase();
    productRows.forEach((r, i) => {
      const sku = String(r[6]||'').toLowerCase();
      if (sku.includes(skuQ)) {
        items.push(_cmdProductItem(r, i));
      }
    });
  }
  // 3. Category filter (prefix #)
  else if (q.startsWith('#')) {
    const catQ = q.slice(1).toLowerCase();
    const matchCats = [...new Set(productRows.map(r => r[1]).filter(Boolean))]
      .filter(c => _fuzzyMatch(catQ, c));
    matchCats.forEach(c => {
      items.push({
        type: 'action',
        label: `📂 หมวด: ${c}`,
        run: () => {
          if (typeof selectedCat !== 'undefined') {
            selectedCat = c;
            window.renderProductGrid && window.renderProductGrid(productRows);
            closeCmdPalette();
          }
        }
      });
    });
  }
  // 4. Price filter (prefix > or <)
  else if (/^[<>]/.test(q)) {
    const op = q[0];
    const num = parseInt(q.slice(1).replace(/[^0-9]/g,'')) || 0;
    productRows.forEach((r, i) => {
      const price = parseInt(String(r[2]||'').replace(/[^0-9]/g,'')) || 0;
      if ((op === '>' && price > num) || (op === '<' && price < num)) {
        items.push(_cmdProductItem(r, i));
      }
    });
  }
  // 5. Free text — fuzzy match product name/type/sku
  else if (q && !q.startsWith('/')) {
    const scored = [];
    productRows.forEach((r, i) => {
      const name = String(r[0]||'').toLowerCase();
      const type = String(r[1]||'').toLowerCase();
      const sku  = String(r[6]||'').toLowerCase();
      const qLow = q.toLowerCase();
      let score = 0;
      if (name.startsWith(qLow)) score = 100;
      else if (name.includes(qLow)) score = 80;
      else if (type.includes(qLow)) score = 50;
      else if (sku.includes(qLow)) score = 40;
      else if (_fuzzyMatch(qLow, name)) score = 20;
      if (score > 0) scored.push({i, r, score});
    });
    scored.sort((a,b) => b.score - a.score);
    scored.slice(0, 30).forEach(({r, i}) => items.push(_cmdProductItem(r, i)));
  }
  // Empty query — show top 8 actions + 8 recent products
  else if (!q) {
    productRows.slice(0, 8).forEach((r, i) => items.push(_cmdProductItem(r, i)));
  }

  _cmdItems = items.slice(0, 50);
  if (!_cmdItems.length) {
    list.innerHTML = '<div class="cmd-empty">— ไม่พบรายการ —<br><small>ลอง /sync · :B17 · #เสื้อ · &gt;500</small></div>';
    return;
  }
  _cmdIndex = Math.min(_cmdIndex, _cmdItems.length - 1);
  list.innerHTML = _cmdItems.map((it, i) => {
    if (it.type === 'action') {
      return `<div class="cmd-item${i===_cmdIndex?' active':''}" data-i="${i}" onclick="runCmdItem(${i})">
        <div class="cmd-item-img">⚡</div>
        <div class="cmd-item-info"><div class="cmd-item-name">${esc(it.label)}</div></div>
        <span class="cmd-item-action">Action</span>
      </div>`;
    }
    return `<div class="cmd-item${i===_cmdIndex?' active':''}" data-i="${i}" onclick="runCmdItem(${i})">
      <div class="cmd-item-img">${it.img ? `<img src="${esc(it.img)}">` : '📦'}</div>
      <div class="cmd-item-info">
        <div class="cmd-item-name">${esc(it.label)}</div>
        <div class="cmd-item-meta">${esc(it.meta || '')}</div>
      </div>
    </div>`;
  }).join('');
  // Scroll active into view
  list.querySelector('.cmd-item.active')?.scrollIntoView({block:'nearest'});
}

function _cmdProductItem(r, i) {
  return {
    type: 'product',
    label: r[0] || '(ไม่มีชื่อ)',
    meta: `${r[1]||''} • ${r[2]||''}${r[6]?' • SKU '+r[6]:''}`,
    img: r[4] || '',
    run: () => { closeCmdPalette(); typeof showProductDetail === 'function' && showProductDetail(i); }
  };
}

function runCmdItem(i) {
  const it = _cmdItems[i];
  if (!it) return;
  try { it.run(); } catch(e) { console.warn(e); }
  if (it.type === 'action') closeCmdPalette();
}

// ═══════════════════════════════════════════════
//  ORDER HISTORY — log each generated cart message
// ═══════════════════════════════════════════════
function logOrderHistory(items, promo) {
  if (!_customerDb || !items?.length) return;
  try {
    _customerDb.ref('_orderHistory').push({
      ts: Date.now(),
      user: localStorage.getItem('admin_user') || 'index-user',
      itemCount: items.length,
      totalQty: items.reduce((s,it) => s + (it.qty||1), 0),
      subtotal: promo?.subtotal || 0,
      finalTotal: promo?.finalTotal || 0,
      discountPct: promo?.discountPct || 0,
      items: items.map(it => ({
        name: it.name, variant: it.variantName, qty: it.qty || 1,
        price: parseInt(String(it.price||'').replace(/[^0-9]/g,'')) || 0
      }))
    });
    // เดิมมีการลบ log เก่าทิ้งจากหน้านี้ — เอาออกแล้ว เพราะ rules ใหม่
    // ให้หน้านี้ "เพิ่มได้อย่างเดียว" ลบไม่ได้ (การล้าง log ทำที่หน้า Admin)
  } catch(e) { console.warn('order log:', e); }
}

// ═══════════════════════════════════════════════
//  BROWSER NOTIFICATIONS (alert on stock=0 after sync)
// ═══════════════════════════════════════════════
let _notifyPermAsked = false;
async function ensureNotifyPerm() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  if (_notifyPermAsked) return false;
  _notifyPermAsked = true;
  try { return (await Notification.requestPermission()) === 'granted'; }
  catch { return false; }
}
function notifyStockOut(productName, variantName) {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(`❌ หมดแล้ว: ${productName}`, {
      body: variantName ? `Variant: ${variantName}` : 'ทุกตัวเลือกหมด',
      icon: '/icon-192.png',
      tag: 'stock-out-' + productName,
    });
  } catch {}
}

// ═══════════════════════════════════════════════
//  INTERNAL NOTES per product (Firebase /_productNotes/<key>)
// ═══════════════════════════════════════════════
let _productNotes = {};
function subscribeProductNotes() {
  if (!_customerDb) return;
  _customerDb.ref('_productNotes').on('value', snap => {
    _productNotes = snap.val() || {};
    // Re-render detail if open
    if (typeof currentDetailIdx === 'number' && currentDetailIdx >= 0
        && document.getElementById('product-details-view')?.style.display === 'block') {
      showProductDetail(currentDetailIdx, false);
    }
  });
}
function getProductNote(idx) {
  if (typeof idx !== 'number' || !productRows[idx]) return '';
  // Need product key — but productRows is array. Look up by SKU instead
  const sku = String(productRows[idx][6]||'').trim();
  if (!sku) return '';
  // Find note key by matching SKU
  for (const [k, note] of Object.entries(_productNotes || {})) {
    if (k === sku) return note || '';
  }
  return '';
}

// ═══════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  // Cmd+K / Ctrl+K — open command palette from anywhere
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    openCmdPalette();
    return;
  }
  // Cmd palette navigation when open
  const cmdOpen = document.getElementById('cmd-palette')?.classList.contains('open');
  if (cmdOpen) {
    if (e.key === 'Escape') { e.preventDefault(); closeCmdPalette(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _cmdIndex = Math.min(_cmdItems.length - 1, _cmdIndex + 1);
      renderCmdResults(document.getElementById('cmd-input').value);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      _cmdIndex = Math.max(0, _cmdIndex - 1);
      renderCmdResults(document.getElementById('cmd-input').value);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      runCmdItem(_cmdIndex);
      return;
    }
    return;
  }
  const tag = e.target.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
  if (isInput) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  const modalOpen = document.querySelector('#cart-drawer.open, #cart-picker.open, #lightbox[style*="block"]');
  if (e.key === 'Escape') {
    if (document.getElementById('cart-picker')?.classList.contains('open')) { closeCartPicker(); return; }
    if (document.getElementById('cart-drawer')?.classList.contains('open')) { closeCartDrawer(); return; }
    return;
  }
  if (modalOpen) return;
  if (e.key === '/') {
    e.preventDefault();
    const s = document.getElementById('search-input');
    if (s) { s.focus(); s.select(); }
  } else if (e.key === 's' || e.key === 'S') {
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;
    customerSyncFromPage365(false);
  } else if ((e.key === 'T' || e.key === 't') && e.shiftKey) {
    openCartDrawer();
  } else if (e.key === 'c' && typeof currentDetailIdx === 'number' && currentDetailIdx >= 0) {
    copyWithTemplate(currentDetailIdx, 'info');
  } else if (e.key === 'b' && typeof currentDetailIdx === 'number' && currentDetailIdx >= 0) {
    handleBack();
  } else if (e.key === 'h' || e.key === 'H') {
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;
    goHome();
  }
});

// Wire up cmd input
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('cmd-input');
  if (inp) inp.addEventListener('input', e => { _cmdIndex = 0; renderCmdResults(e.target.value); });
});

// Initial cart badge update
window.addEventListener('DOMContentLoaded', updateCartBadge);

function showSyncToast(msg, type) {
  const el = document.createElement('div');
  el.textContent = msg;
  const bg = type==='error' ? '#d92626' : (type==='info' ? '#555' : '#1a6e3f');
  el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:${bg};color:#fff;padding:12px 20px;
    border-radius:12px;font-weight:600;font-size:.9em;z-index:9999;
    box-shadow:0 6px 20px rgba(0,0,0,.25);font-family:'Prompt',sans-serif`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── UTILS ───────────────────────────────────────────────────
function esc(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
function onImgLoad(img){ img.classList.add('loaded') }
function parsePrice(s){ return parseInt(String(s||'').replace(/[^0-9]/g,''))||0 }
function openLink(u){ if(u&&u.trim()) window.open(u.trim(),'_blank') }

function copyText(text, btn){
  const t = String(text||'').trim();
  if (!t||t==='undefined'){
    const o=btn.innerText; btn.innerText='ไม่มีข้อมูล';
    setTimeout(()=>btn.innerText=o,1000); return;
  }
  navigator.clipboard?.writeText(t).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=t;ta.style.cssText='position:fixed;left:-9999px';
    document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
  });
  const o=btn.innerText; btn.innerText='✓ Copied!'; btn.classList.add('copied');
  setTimeout(()=>{ btn.innerText=o; btn.classList.remove('copied') },1400);
}

// ── STOCK / SOLD OUT helpers ────────────────────────────────
function getVariants(row){
  const v = row?.[12];
  if (Array.isArray(v)) return v;
  // Firebase may return numeric-keyed array as plain object {"0":..., "1":...}
  if (v && typeof v === 'object') {
    return Object.keys(v).filter(k => /^\d+$/.test(k))
                         .sort((a,b) => Number(a) - Number(b))
                         .map(k => v[k]);
  }
  return [];
}
// ── STOCK SEMANTICS ──
// stock > 0 = จำนวนคงเหลือ • stock <= 0 (รวมค่าติดลบ เช่น -1) = หมด
function vStock(v){ const s = Number(v?.stock); return Number.isFinite(s) ? s : 0; }
function vAvail(v){ return vStock(v) > 0; }            // มีของเฉพาะจำนวนเป็นบวก
function isSoldOut(row){
  const vs = getVariants(row);
  if (!vs.length) return false;
  return vs.every(v => !vAvail(v));
}
function soldStampHTML(){ return '<div class="sold-stamp">SOLD OUT</div>'; }
function hasLowStock(row){
  const vs = getVariants(row);
  if (!vs.length || isSoldOut(row)) return false;
  return vs.some(v => { const s = vStock(v); return s > 0 && s <= 3; });
}
function lowStockBadgeHTML(){ return '<div class="low-stock-badge">⚠️ เหลือน้อย</div>'; }

// Parse variant name like "ดำ, S" → {color:"ดำ", size:"S"}; otherwise → {color: name}
function parseVariant(name) {
  const s = String(name||'').trim();
  const m = s.split(/\s*[,/]\s*/).filter(Boolean);
  if (m.length >= 2) return {color: m[0], size: m.slice(1).join(' ')};
  return {color: s, size: ''};
}
function groupVariantsBySize(variants) {
  // Returns {colors:[...], sizes:[...], grid:{color:{size: variant}}}
  const colors = [], sizes = [];
  const grid = {};
  variants.forEach(v => {
    const {color, size} = parseVariant(v.name);
    if (!grid[color]) { grid[color] = {}; colors.push(color); }
    grid[color][size] = v;
    if (!sizes.includes(size)) sizes.push(size);
  });
  // sort sizes by standard order if recognisable
  const sizeOrder = ['XS','S','M','L','XL','XXL','XXXL','3XL','4XL','5XL','FREE'];
  sizes.sort((a,b) => {
    const ai = sizeOrder.indexOf(a.toUpperCase()), bi = sizeOrder.indexOf(b.toUpperCase());
    if (ai>=0 && bi>=0) return ai-bi;
    if (ai>=0) return -1;
    if (bi>=0) return 1;
    return String(a).localeCompare(String(b));
  });
  return {colors, sizes, grid};
}
function hasSizeDimension(variants) {
  // Returns true if any variant has comma in name AND at least 2 sizes appear
  const parsed = variants.map(v => parseVariant(v.name));
  const sizes = new Set(parsed.map(p => p.size).filter(Boolean));
  return sizes.size >= 2;
}
// ── PRODUCT GRID ────────────────────────────────────────────
function renderProductGrid(rows){
  const el = document.getElementById('product-grid-view');
  if (!rows?.length){ el.innerHTML='<div class="loading-state"><div class="loader-ring"></div>กำลังโหลดสินค้า...</div>'; return }

  // 1) filter by selected category
  const byCat = selectedCat==='ทั้งหมด' ? rows : rows.filter(r=>(r[1]||'ไม่ระบุ')===selectedCat);

  // 2) filter by search — supports prefix filters and fuzzy match
  let list = searchQuery
    ? byCat.filter(r => _smartSearchMatch(r, searchQuery))
    : byCat;
  // 3) filter by color group
  if (selectedColor) list = list.filter(r => productColorGroups(r).has(selectedColor));
  // 4) hide sold-out (optional)
  if (hideSoldOut) list = list.filter(r => !isSoldOut(r));

  if (!list.length){
    const what = selectedColor ? `สี${selectedColor}` : (searchQuery||selectedCat);
    el.innerHTML=`<div class="loading-state" style="padding:60px 20px">🔍 ไม่พบ "${esc(what)}"${hideSoldOut?'<br><small style="opacity:.6">(ซ่อนของหมดอยู่)</small>':''}</div>`; return
  }

  // ถ้ากรองเฉพาะ 1 ประเภท → ไม่ต้องแสดง cat-head ซ้ำ
  const showCatHead = selectedCat==='ทั้งหมด';

  const map = {};
  list.forEach(r => {
    const i = productRows.indexOf(r);
    const t = r[1]||'ไม่ระบุ';
    if (!map[t]) map[t]=[];
    const base = {i, name:r[0], type:r[1], price:r[2], priceNum:parsePrice(r[2]), sku:r[6]};
    // color filter active → one card per matching shade (with that shade's image)
    const shades = selectedColor ? variantsForColor(r, selectedColor) : [];
    if (selectedColor && shades.length) {
      shades.forEach(vc => {
        if (hideSoldOut && !vc.avail) return;
        map[t].push({...base, img: vc.img||r[4], colorName: vc.name, colorStock: vc.stock, sold: !vc.avail});
      });
    } else {
      map[t].push({...base, img:r[4], colorName:'', sold:isSoldOut(r)});
    }
  });
  // in-stock first, then the chosen sort → sold-out items sink to the bottom
  Object.values(map).forEach(arr=>arr.sort((a,b)=>{
    if (a.sold !== b.sold) return a.sold ? 1 : -1;
    return currentSort==='name_asc'? a.name.localeCompare(b.name,'th')
      : currentSort==='price_asc'? a.priceNum-b.priceNum
      : b.priceNum-a.priceNum;
  }));

  let html='';
  let delay=0;
  Object.keys(map).sort((a,b)=>a.localeCompare(b,'th')).forEach(type=>{
    if(showCatHead){
      html+=`<div class="cat-head">${catIcon(type)} ${esc(type)} <span class="cat-badge">${map[type].length}</span></div>`;
    }
    html+=`<div class="product-grid">`;
    map[type].forEach(item=>{
      const img=item.img||'';
      const d=(delay%8)*60;
      const hasPikad=!!productRows[item.i]?.[9];
      const faved=isFav(item.i);
      const _r = productRows[item.i];
      const sold=item.sold;
      const low=item.colorName ? (!sold && item.colorStock>0 && item.colorStock<=3) : hasLowStock(_r);
      const copyBtn = item.img
        ? `<button class="btn btn-info" onclick="event.stopPropagation();copyImageFromUrl('${item.img.replace(/'/g,"\\'")}',this)">🖼️ Copy รูป</button>`
        : `<button class="btn btn-info" onclick="event.stopPropagation();copyProductInfo(${item.i},this)">📋 Copy</button>`;
      html+=`<div class="pcard${sold?' sold-out':''}" style="animation-delay:${d}ms" onclick="showProductDetail(${item.i})">
        <div class="pcard-img-wrap">
          <div class="pcard-img">
            ${img?`<img src="${img}" loading="lazy" onload="onImgLoad(this)">`:'<div class="no-img">📦</div>'}
          </div>
          ${sold?soldStampHTML():low?lowStockBadgeHTML():''}
          ${item.colorName?`<div class="pcard-color-badge">🎨 ${esc(item.colorName)}</div>`:''}
          <button class="fav-btn ${faved?'faved':''}" onclick="event.stopPropagation();toggleFav(${item.i},this)">${faved?'⭐':'☆'}</button>
          <div class="pcard-overlay">
            <span class="pcard-type">${esc(item.type||'')}</span>
            <div class="pcard-name">${esc(item.name)}</div>
            <div class="pcard-price">${esc(item.price)}</div>
          </div>
        </div>
        <div class="pcard-actions">
          ${copyBtn}
          <button class="btn btn-cart" onclick="event.stopPropagation();openAddToCartPicker(${item.i})" title="เพิ่มลงตะกร้า">🛒</button>
          ${hasPikad?`<button class="btn btn-loc" onclick="event.stopPropagation();copyText(productRows[${item.i}][9],this)">📍 พิกัด</button>`:''}
        </div>
      </div>`;
      delay++;
    });
    html+='</div>';
  });
  el.innerHTML=html;
}

function copyProductInfo(idx,btn){
  const r=productRows[idx]; if(!r) return;
  copyText(`ชื่อสินค้า: ${r[0]}\nประเภท: ${r[1]}\nราคา: ${r[2]}\nรายละเอียด: ${r[3]}`,btn);
}

// ── AUTO-SYNC STOCK เมื่อเปิดการ์ดสินค้า ──
let _autoSyncedAt = {};        // productKey -> ts (throttle)
let _p365ListSession = null;   // cached Page365 list for name/sku resolve
async function _custP365List(){
  if (_p365ListSession && (Date.now() - _p365ListSession.ts < 5*60*1000)) return _p365ListSession.list;
  const shop = 'lamsangstores';
  const seen = new Set(); const list = [];
  for (let page=1; page<=20; page++){
    const d = await _customerFetch(`https://${shop}.page365.net/products.json?page=${page}`);
    if (!d.items?.length) break;
    let added=0; for (const it of d.items){ if(!seen.has(it.id)){seen.add(it.id);list.push(it);added++;} }
    if (!added) break; if (d.count && list.length>=d.count) break;
  }
  _p365ListSession = { ts: Date.now(), list };
  return list;
}
function _setStockSyncStatus(text, ok){
  const el = document.getElementById('stock-sync-status');
  if (!el) return;
  if (!text){ el.style.display='none'; el.textContent=''; el.classList.remove('ok'); return; }
  el.style.display='inline-flex';
  el.textContent = text;
  el.classList.toggle('ok', !!ok);
}
async function autoSyncProductStock(idx){
  try{
    const row = productRows[idx]; const key = productKeys[idx];
    if (!row || !key || !_customerDb) return;
    if (_autoSyncedAt[key] && Date.now()-_autoSyncedAt[key] < 15000) return; // กันยิงซ้ำถี่ๆ
    _autoSyncedAt[key] = Date.now();
    const shop = 'lamsangstores';
    // resolve Page365 product: manual map → SKU → name
    const manual = _customerP365Map[key];
    let p365 = (manual && manual.id) ? { id: manual.id } : null;
    if (!p365){
      const list = await _custP365List();
      const sku = String(row[6]||'').trim(); const norm = _custNormName(row[0]||'');
      if (sku) p365 = list.find(p => String(p.parent_sku||p.sku||p.merchant_sku||'').trim() === sku) || null;
      if (!p365 && norm) p365 = list.find(p => _custNormName(p.name)===norm)
        || list.find(p => { const n=_custNormName(p.name); return n && (n.includes(norm)||norm.includes(n)); });
    }
    if (!p365) return; // ไม่เจอใน Page365 — ปล่อยตามเดิม
    _setStockSyncStatus('🔄 กำลังอัปเดตสต๊อกล่าสุด...');
    const detail = await _customerFetch(`https://${shop}.page365.net/products/${p365.id}.json`);
    const p365Vs = detail.variants || [];
    let cur = Array.isArray(row[12]) ? [...row[12]] : [];
    let changed = 0;
    cur = cur.map(v => {
      let pv; const ov = manual?.variants?.[v.name];
      if (ov !== undefined){ if (ov==='') return v; pv = p365Vs.find(p=>p.name===ov) || p365Vs.find(p=>_custNormVName(p.name)===_custNormVName(ov)); }
      else pv = p365Vs.find(p=>_custNormVName(p.name)===_custNormVName(v.name));
      if (pv){ const ns = pv.in_stock ? (Number(pv.available)||0) : 0; if (ns !== (Number(v.stock)||0)){ changed++; return {...v, stock: ns}; } }
      return v;
    });
    if (changed){
      const newRow = [...row]; while (newRow.length<13) newRow.push(''); newRow[12] = cur;
      productRows[idx] = newRow;
      // ไม่เขียนกลับ Firebase แล้ว — หน้านี้อ่านอย่างเดียว
      // อัปเดตแค่ข้อมูลในเครื่องแล้ววาดใหม่เอง (เมื่อก่อน listener เป็นคนวาดให้หลังเขียน)
      if (currentDetailIdx === idx) showProductDetail(idx, false);
      if (currentTab === 'product') window.renderProductGrid(productRows);
      _setStockSyncStatus('✓ อัปเดตสต๊อกล่าสุดแล้ว', true);
      setTimeout(() => _setStockSyncStatus(''), 2500);
    } else {
      _setStockSyncStatus('✓ สต๊อกเป็นปัจจุบัน', true);
      setTimeout(() => _setStockSyncStatus(''), 1800);
    }
  }catch(e){ _setStockSyncStatus(''); /* เงียบ — ไม่รบกวนการเปิดดูสินค้า */ }
}

function showProductDetail(idx,push=true){
  if (push && productRows[idx]) _customerAudit('view-product', productRows[idx][0]||'', '');
  const row=productRows[idx]; if(!row) return;
  if(push) _pushView({view:'detail',tab:'product',idx});
  document.getElementById('product-grid-view').style.display='none';
  document.getElementById('main-tabs').style.display='none';
  document.getElementById('product-header').style.display='none';
  document.getElementById('cat-pill-bar').style.display='none';
  document.getElementById('page-inner').style.display='block'; // full width detail
  const sidebar=document.getElementById('desktop-sidebar');
  if(sidebar) sidebar.style.display='none';
  document.getElementById('main-topbar').style.display='none';
  document.getElementById('top-nav').style.display='flex';
  document.body.classList.add('in-detail');

  const copyTxt=`ชื่อสินค้า: ${row[0]}\nประเภท: ${row[1]}\nราคา: ${row[2]}\nรายละเอียด: ${row[3]}`;
  const shopee=row[7]||'', tiktok=row[8]||'', loc=row[9]||'', lazada=row[10]||'', page365=row[11]||'';

  const sold = isSoldOut(row);
  const variants = getVariants(row);
  const baseFn = String(row[6]||row[0]||'image').replace(/[^a-zA-Z0-9_-]/g,'_');
  const heroActions = row[4] ? `
    <div class="img-actions-row">
      <button class="img-action-btn copy" onclick="copyImageFromUrl('${row[4]}',this)">📋 Copy</button>
      <button class="img-action-btn dl" onclick="downloadImageFromUrl('${row[4]}','${baseFn}.png',this)">⬇️ Download</button>
    </div>` : '';
  const imgHtml = row[4]
    ? `<div class="detail-img-wrap" style="position:relative">${sold?soldStampHTML():''}<img src="${row[4]}" onload="onImgLoad(this)" loading="lazy" onclick="openLightbox('${row[4]}','ภาพสินค้า: ${esc(row[0])}')" ${sold?'style="filter:grayscale(.6) brightness(.85)"':''}></div>${heroActions}`
    : `<div class="detail-img-wrap" style="position:relative">${sold?soldStampHTML():''}<div class="detail-img-none">📦</div></div>`;

  // Per-color images (one representative image per color) with a Copy button each
  const _jsq = s => String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const colorImageMap = {};
  variants.forEach(v => {
    const {color} = parseVariant(v.name);
    if (color && !colorImageMap[color] && v.image) colorImageMap[color] = v.image;
  });
  const colorImgEntries = Object.entries(colorImageMap);
  const colorImagesHtml = colorImgEntries.length ? `
    <div class="color-img-section">
      <div class="size-section-title">🎨 รูปภาพแยกสี</div>
      <div class="color-img-grid">
        ${colorImgEntries.map(([c, img]) => `
          <div class="color-img-card">
            <img class="color-img-thumb" src="${esc(img)}" loading="lazy" onerror="this.style.display='none'" onclick="openLightbox('${_jsq(img)}','${_jsq(c)} - ${_jsq(row[0]||'')}')">
            <div class="color-img-name">${esc(c)}</div>
            <button class="img-action-btn copy" onclick="copyImageFromUrl('${_jsq(img)}',this)">📋 Copy</button>
          </div>`).join('')}
      </div>
    </div>` : '';

  let variantsHtml = '';
  if (variants.length) {
    if (hasSizeDimension(variants)) {
      // Group by size, each section shows colors as chips with images
      const {colors, sizes, grid} = groupVariantsBySize(variants);
      // build color→image map (fallback to main product image)
      const colorImg = {};
      colors.forEach(c => {
        for (const s of sizes) {
          const v = grid[c]?.[s];
          if (v?.image) { colorImg[c] = v.image; break; }
        }
        if (!colorImg[c]) colorImg[c] = row[4] || '';
      });

      variantsHtml = `
        <div class="size-groups">
          ${sizes.map(size => {
            const items = colors.map(color => ({color, v: grid[color]?.[size]})).filter(x => x.v);
            if (!items.length) return '';
            const totalStock = items.reduce((s,x) => s + Math.max(0, vStock(x.v)), 0);
            const availCount = items.filter(x => vAvail(x.v)).length;
            const allSold = availCount === 0;
            return `
              <div class="size-group">
                <div class="size-group-head">
                  <div class="size-group-title">📏 <span class="size-badge">${esc(size||'—')}</span></div>
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                    <div class="size-group-summary ${allSold?'all-sold':''}">${allSold?'หมดทุกสี':`${availCount}/${items.length} สี • รวม ${totalStock} ชิ้น`}</div>
                    <button class="size-group-btn" onclick="event.stopPropagation();openCompositeImage(${idx},'${esc(size||'').replace(/'/g,"\\'")}')">📷 รูปรวม ${esc(size||'')}</button>
                  </div>
                </div>
                <div class="size-group-chips">
                  ${items.map(({color, v}) => {
                    const stock = vStock(v);
                    const sold = !vAvail(v);
                    const img = v.image || colorImg[color] || '';
                    return `<div class="sg-chip${sold?' sold':''}" title="${esc(v.sku||'')}">
                      <div class="img-wrap">
                        ${img ? `<img class="sg-chip-img" src="${esc(img)}" loading="lazy" onerror="this.style.display='none'">` : '<div class="sg-chip-img" style="display:flex;align-items:center;justify-content:center">🎨</div>'}
                        ${sold ? soldStampHTML() : ''}
                      </div>
                      <div class="sg-chip-name">${esc(color)}</div>
                      <div class="sg-chip-stock ${sold?'out':'in'}">${sold?'หมด':'เหลือ '+stock}</div>
                    </div>`;
                  }).join('')}
                </div>
              </div>`;
          }).join('')}
        </div>`;
    } else {
      // Flat chips for single-dim variants (belts etc.)
      variantsHtml = `
        <div class="variant-chips">
          ${variants.map(v => {
            const vSold = !vAvail(v);
            const s = vStock(v);
            return `<div class="variant-chip${vSold?' sold':''}" title="${esc(v.sku||'')}">
              <div style="position:relative">
                ${v.image?`<img class="variant-chip-img" src="${esc(v.image)}" onerror="this.style.display='none'">`:'<div class="variant-chip-img" style="display:flex;align-items:center;justify-content:center">🎨</div>'}
                ${vSold?soldStampHTML():''}
              </div>
              <div class="variant-chip-name">${esc(v.name||v.sku||'—')}</div>
              <div class="variant-chip-stock">${vSold?'หมด':'เหลือ '+s}</div>
            </div>`;
          }).join('')}
        </div>`;
    }
  }

  const favStyle = isFav(idx)
    ? 'background:rgba(255,59,107,.15);color:var(--pink);border:1px solid rgba(255,59,107,.3)'
    : 'background:rgba(0,0,0,.05);color:var(--muted);border:1px solid var(--border)';

  document.getElementById('product-details-view').innerHTML=`
    <div class="detail-page">
      <div class="detail-layout">
        ${imgHtml}
        ${(row[5]||colorImagesHtml)?`<div class="size-section">
          ${row[5]?`<div class="size-section-title">📏 ตารางไซส์</div>
          <img class="size-img" src="${row[5]}" onload="onImgLoad(this)" loading="lazy" onclick="openLightbox('${row[5]}','ตารางไซส์: ${esc(row[0])}')">
          <div class="img-actions-row">
            <button class="img-action-btn copy" onclick="copyImageFromUrl('${row[5]}',this)">📋 Copy</button>
            <button class="img-action-btn dl" onclick="downloadImageFromUrl('${row[5]}','${baseFn}_size.png',this)">⬇️ Download</button>
          </div>`:''}
          ${colorImagesHtml}
        </div>`:''}
      </div>
      <div class="detail-body">
        ${getProductNote(idx) ? `<div class="product-note">${esc(getProductNote(idx))}</div>` : ''}
        <div class="detail-name">${esc(row[0])}${sold?' <span style="color:#d92626;font-size:.6em;background:rgba(217,38,38,.1);padding:3px 10px;border-radius:10px;vertical-align:middle">SOLD OUT</span>':''}</div>
        ${row[6]?`<div class="detail-sku">SKU: ${esc(row[6])}</div>`:''}
        <div class="detail-type">${esc(row[1])}</div>
        <div class="detail-price">${esc(row[2])}</div>
        ${buildTierPricingHtml(row, idx)}
        <div id="stock-sync-status" class="stock-sync-status" style="display:none"></div>
        ${variants.length ? `<div id="detail-color-stock-area"></div>` : ''}
        ${variants.length ? `<div class="inline-comp-wrap" id="inline-comp-area"></div>` : ''}
        <div class="detail-action-row">
          <button class="btn btn-pink" onclick="copyWithTemplate(${idx}, 'info')">📋 Copy</button>
          <button class="btn btn-pink" style="padding:8px 10px" onclick="toggleTemplateMenu(${idx}, this)" title="เลือกเทมเพลต">▼</button>
          <button class="btn btn-info" onclick="openAddToCartPicker(${idx})">🛒 +</button>
          ${shopee?`<button class="btn btn-shopee" onclick="openLink('${shopee}')">🛒 Shopee</button>`:''}
          ${tiktok?`<button class="btn btn-tiktok" onclick="openLink('${tiktok}')">♪ TikTok</button>`:''}
          ${lazada?`<button class="btn btn-laz" onclick="openLink('${lazada}')">🟠 Lazada</button>`:''}
          ${page365?`<button class="btn btn-p365" onclick="openLink('${page365}')">📄 Page365</button>`:''}
          ${loc?`<button class="btn btn-loc" onclick="openLink('${loc}')">📍 พิกัด</button>`:''}
          ${variants.length && !hasSizeDimension(variants)?`<button class="btn btn-info" onclick="openCompositeImage(${idx})">📷 รูปรวม</button>`:''}
          <button class="btn btn-share" onclick="shareProduct(${idx})">↗ แชร์</button>
          <button id="fav-detail-btn" class="btn" style="${favStyle}" onclick="toggleFavDetail(${idx},this)">${isFav(idx)?'⭐ โปรด':'☆ บันทึก'}</button>
        </div>
      </div>
      <div class="detail-desc">${esc(String(row[3]||''))}</div>
    </div>`;
  document.getElementById('product-details-view').style.display='block';
  currentDetailIdx=idx; currentDetailRow=row;
  document.getElementById('fab-wrap').style.display='flex';
  addRecent(idx);
  if (push) bumpViewFreq(idx);   // นับ "เข้าบ่อยสุด" เฉพาะตอนกดเข้าจริง
  window.scrollTo(0,0);
  // Reset size filter for each new product
  _detailSelectedSize = null;
  // Initial render of color chips (all sizes)
  renderDetailColorChips(variants, null);
  // Build inline composite gallery (async)
  const compArea = document.getElementById('inline-comp-area');
  if (compArea) embedComposites(idx, compArea);
  // Auto-sync this product's stock from Page365 on a genuine card open
  if (push) autoSyncProductStock(idx);
}

// Currently selected size in detail page (null = ทุกไซส์)
let _detailSelectedSize = null;

function renderDetailColorChips(variants, selectedSize) {
  const area = document.getElementById('detail-color-stock-area');
  if (!area || !variants?.length) return;

  const hasSizes = new Set(variants.map(v => parseVariant(v.name).size).filter(Boolean)).size > 1;

  // Filter variants by selected size (if any)
  const filtered = selectedSize
    ? variants.filter(v => parseVariant(v.name).size === selectedSize)
    : variants;

  // Group by color
  const byColor = {};
  filtered.forEach(v => {
    const {color} = parseVariant(v.name);
    const c = color || '—';
    if (!byColor[c]) byColor[c] = { total: 0, items: 0, img: '' };
    const s = vStock(v);
    byColor[c].items++;
    if (s > 0) byColor[c].total += s;   // นับเฉพาะจำนวนบวก
    if (!byColor[c].img && v.image) byColor[c].img = v.image;
  });
  const colors = Object.keys(byColor);

  const subline = selectedSize
    ? `<div class="dss-current">📏 ไซส์ <strong>${esc(selectedSize)}</strong> — แยกตามสี <span style="color:var(--muted);font-weight:500">(เลือกไซส์อื่นที่ปุ่มด้านล่าง)</span></div>`
    : (hasSizes ? `<div class="dss-current">📦 รวมทุกไซส์ — แยกตามสี <span style="color:var(--muted);font-weight:500">(เลือกไซส์ที่ปุ่มด้านล่าง)</span></div>` : '');

  area.innerHTML = subline + `<div class="detail-color-stock">
    ${colors.map(c => {
      const g = byColor[c];
      const allOut = g.total === 0;   // ไม่มีจำนวนบวก = หมด
      const note = selectedSize ? '' : `<span class="dcs-sizes">• ${g.items} ไซส์</span>`;
      return `<div class="dcs-chip${allOut?' out':''}">
        ${g.img ? `<img src="${esc(g.img)}" onerror="this.style.display='none'">` : `<div class="dcs-fallback">${esc(c).slice(0,1)}</div>`}
        <div class="dcs-info">
          <div class="dcs-color">${esc(c)}</div>
          <div class="dcs-count">${allOut ? 'หมด' : g.total + ' ชิ้น'} ${note}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── GENERAL GRID ────────────────────────────────────────────
function renderGeneralGrid(rows){
  const el = document.getElementById('general-grid-view');
  if (!rows?.length){ el.innerHTML='<div class="loading-state">ไม่พบข้อมูล</div>'; return }

  const filtered = searchQuery
    ? rows.filter(r =>
        (r[1]||'').toLowerCase().includes(searchQuery)
     || (r[0]||'').toLowerCase().includes(searchQuery)
     || (r[2]||'').toLowerCase().includes(searchQuery))
    : rows;

  if (!filtered.length){ el.innerHTML=`<div class="loading-state">🔍 ไม่พบ "${searchQuery}"</div>`; return }

  const map={};
  filtered.forEach((r)=>{
    const i = generalRows.indexOf(r);
    const t=r[0]||'ทั่วไป';
    if(!map[t])map[t]=[];
    map[t].push({i,name:r[1]});
  });

  let html=''; let delay=0;
  Object.keys(map).sort((a,b)=>a.localeCompare(b,'th')).forEach(type=>{
    html+=`<div class="cat-head">${catIcon(type)} ${esc(type)} <span class="cat-badge">${map[type].length}</span></div>`;
    html+=`<div class="general-list">`;
    map[type].forEach(item=>{
      const d=(delay%6)*50;
      html+=`<div class="gcard" style="animation-delay:${d}ms" onclick="showGeneralDetail(${item.i})">
        <div class="gcard-icon">${catIcon(type)}</div>
        <div class="gcard-text">
          <div class="gcard-name">${esc(item.name)}</div>
          <div class="gcard-type">${esc(type)}</div>
        </div>
        <button class="btn btn-copy" onclick="event.stopPropagation();copyText(generalRows[${item.i}]?.[2],this)">Copy</button>
      </div>`;
      delay++;
    });
    html+='</div>';
  });
  el.innerHTML=html;
}

function showGeneralDetail(idx,push=true){
  const row=generalRows[idx]; if(!row) return;
  if(push) _pushView({view:'detail',tab:'general',idx});
  document.getElementById('general-grid-view').style.display='none';
  document.getElementById('main-tabs').style.display='none';
  document.getElementById('general-header').style.display='none';
  document.getElementById('page-inner').style.display='block';
  const sidebar=document.getElementById('desktop-sidebar');
  if(sidebar) sidebar.style.display='none';
  document.getElementById('main-topbar').style.display='none';
  document.getElementById('top-nav').style.display='flex';
  document.body.classList.add('in-detail');

  const imgHtml=row[3]?`<img class="gdetail-img" src="${row[3]}" onload="onImgLoad(this)" loading="lazy">`:'';
  document.getElementById('general-details-view').innerHTML=`
    <div class="detail-page gdetail-body">
      <div class="gdetail-name">${esc(row[1])}</div>
      <div class="gdetail-type">${catIcon(row[0])} ${esc(row[0])}</div>
      <div class="gdetail-actions">
        <button class="btn btn-pink" onclick='copyText(${JSON.stringify(String(row[2]||''))},this)'>📋 Copy ข้อความ</button>
      </div>
      <div class="gdetail-text">${esc(String(row[2]||''))}</div>
      ${imgHtml}
    </div>`;
  document.getElementById('general-details-view').style.display='block';
  window.scrollTo(0,0);
}

// ── TABS / NAVIGATION ────────────────────────────────────────
// นับความลึกของ history "เฉพาะในแอป" — history.length เชื่อไม่ได้
// เพราะมันนับหน้าเว็บอื่นที่เปิดมาก่อนในแท็บเดียวกันด้วย
// (ลูกค้ากดลิงก์มาจาก LINE/Facebook แล้วกด "กลับ" จะเด้งออกนอกเว็บ)
let _navDepth = 0;
function _pushView(state){
  _navDepth++;
  history.pushState({...state, _d:_navDepth}, '');
}
function switchTab(tab,push=true){
  currentTab=tab;
  document.getElementById('tabProduct').classList.toggle('active',tab==='product');
  document.getElementById('tabGeneral').classList.toggle('active',tab==='general');
  document.getElementById('tab-product-content').style.display=tab==='product'?'block':'none';
  document.getElementById('tab-general-content').style.display=tab==='general'?'block':'none';
  if(tab==='product'){
    showProductGrid(push);
    if(productRows.length){ buildCatPills(productRows); window.renderProductGrid(productRows); }
  } else {
    showGeneralGrid(push);
    if(generalRows.length) renderGeneralGrid(generalRows);
  }
}
function showProductGrid(push=true){
  document.getElementById('product-grid-view').style.display='block';
  document.getElementById('product-details-view').style.display='none';
  document.getElementById('main-tabs').style.display='flex';
  document.getElementById('product-header').style.display='block';
  document.getElementById('page-inner').style.display='';
  const sidebar=document.getElementById('desktop-sidebar');
  if(sidebar) sidebar.style.display='';
  document.getElementById('main-topbar').style.display='flex';
  document.getElementById('top-nav').style.display='none';
  document.body.classList.remove('in-detail');
  document.getElementById('fab-wrap').style.display='none';
  document.getElementById('fab-main').classList.remove('open');
  document.getElementById('fab-menu').classList.remove('open');
  updatePillBarVisibility();
  if(push) _pushView({view:'grid',tab:'product'});
}
function showGeneralGrid(push=true){
  document.getElementById('general-grid-view').style.display='block';
  document.getElementById('general-details-view').style.display='none';
  document.getElementById('main-tabs').style.display='flex';
  document.getElementById('general-header').style.display='block';
  document.getElementById('cat-pill-bar').style.display='none';
  document.getElementById('page-inner').style.display='';
  const sidebar=document.getElementById('desktop-sidebar');
  if(sidebar) sidebar.style.display='none';
  document.getElementById('main-topbar').style.display='flex';
  document.getElementById('top-nav').style.display='none';
  document.body.classList.remove('in-detail');
  document.getElementById('fab-wrap').style.display='none';
  document.getElementById('fab-main').classList.remove('open');
  document.getElementById('fab-menu').classList.remove('open');
  if(push) _pushView({view:'grid',tab:'general'});
}
// กลับ: ถ้ายังมีหน้าในแอปให้ย้อน ถ้าไม่มีแล้วให้กลับหน้าแรก (ไม่หลุดออกนอกเว็บ)
function handleBack(){ _navDepth>0 ? history.back() : goHome() }

// กลับหน้าแรกแบบตรง ๆ — ใช้ได้ทุกหน้า ไม่ต้องพึ่ง history
function goHome(){
  // ปิด overlay ที่อาจเปิดค้างอยู่
  try{ closeCartDrawer(); }catch(e){}
  try{ closeLightbox(); }catch(e){}
  try{ closeCmdPalette(); }catch(e){}
  // ล้างการค้นหา + ตัวกรอง ให้กลับสู่สภาพหน้าแรก
  searchQuery='';
  const s=document.getElementById('search-input'); if(s) s.value='';
  selectedCat='ทั้งหมด';
  selectedColor=null;
  showingFavOnly=false;
  const favPill=document.getElementById('fav-tab-pill');
  if(favPill) favPill.classList.remove('active-fav');
  currentDetailIdx=-1; currentDetailRow=null;
  // ถ้ายืนอยู่หน้าแรกอยู่แล้ว ไม่ต้องเพิ่ม history entry ซ้ำ
  const alreadyHome = currentTab==='product'
    && document.getElementById('product-details-view').style.display==='none';
  switchTab('product', !alreadyHome);
  if(productRows.length) buildCatPills(productRows);
  window.scrollTo(0,0);
}
window.goHome=goHome;
function handleSortChange(v){ currentSort=v; window.renderProductGrid(productRows) }
window.onpopstate=e=>{
  if(!e.state) return;
  const s=e.state;
  _navDepth = s._d || 0;
  if(s.view==='detail'){if(s.tab==='product')showProductDetail(s.idx,false);else showGeneralDetail(s.idx,false)}
  else switchTab(s.tab||'product',false);
};
document.addEventListener('DOMContentLoaded',()=>{
  history.replaceState({view:'grid',tab:'product',_d:0},'');
  initDark();
  initFirebase();
  initScrollTop();
  renderRecentRow();
  renderFreqRow();
  updateHideSoldBtn();
  updateFavPill();
  updatePillBarVisibility();
});

// อัพเดท pill bar visibility ตาม screen size
function updatePillBarVisibility(){
  const bar = document.getElementById('cat-pill-bar');
  if(!bar) return;
  const isProduct = currentTab === 'product';
  const isGrid = document.getElementById('product-grid-view')?.style.display !== 'none';
  const isDesktop = window.innerWidth >= 960;
  bar.style.display = (isProduct && isGrid && !isDesktop) ? 'flex' : 'none';
}
window.addEventListener('resize', updatePillBarVisibility, {passive:true});

/* ═══════════════ BLOCK 2 ═══════════════ */
// ═══════════════════════════════════════════════
//  NEW FEATURES JS
// ═══════════════════════════════════════════════

// ── STATE for new features ──────────────────────
let currentDetailIdx = -1;
let currentDetailRow = null;
let showingFavOnly   = false;

// ── DARK MODE ───────────────────────────────────
function initDark(){
  // Default to LIGHT mode regardless of OS preference; only flip if explicitly saved
  const saved = localStorage.getItem('dark');
  if(saved==='1'){
    document.body.classList.add('dark');
    const btn = document.getElementById('dark-toggle');
    if(btn) btn.textContent = '☀️';
  }
}
function toggleDark(){
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('dark', isDark?'1':'0');
  const btn = document.getElementById('dark-toggle');
  if(btn) btn.textContent = isDark ? '☀️' : '🌙';
}

// ── COPY TOAST ─────────────────────────────────
function showToast(label){
  const toast = document.getElementById('copy-toast');
  const text  = document.getElementById('toast-text');
  if(!toast) return;
  text.textContent = 'Copied: ' + label;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>toast.classList.remove('show'), 2200);
}
function copyInfoToast(text, label){
  const t = String(text||'').trim();
  if(!t) return;
  navigator.clipboard?.writeText(t).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=t;ta.style.cssText='position:fixed;left:-9999px';
    document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
  });
  showToast(label||t.substring(0,24)+(t.length>24?'…':''));
}
// override copyText to also show toast
const _origCopyText = copyText;
window.copyText = function(text, btn){
  _origCopyText(text, btn);
  const t = String(text||'').trim();
  if(t && t!=='undefined') showToast(t.substring(0,28)+(t.length>28?'…':''));
};

// ── SCROLL TO TOP ───────────────────────────────
function initScrollTop(){
  const btn = document.getElementById('scroll-top');
  if(!btn) return;
  window.addEventListener('scroll', ()=>{
    btn.classList.toggle('show', window.scrollY > 320);
  }, {passive:true});
}

// ── SKELETON LOADING ────────────────────────────
function showSkeleton(){
  const el = document.getElementById('product-grid-view');
  if(!el) return;
  const n = 8;
  el.innerHTML = `<div class="skeleton-grid">${'<div class="skel-card"></div>'.repeat(n)}</div>`;
}

// ── RECENT ITEMS ────────────────────────────────
const MAX_RECENT = 5;
function getRecent(){ try{ return JSON.parse(localStorage.getItem('recent_v2')||'[]'); }catch(e){ return []; } }
function addRecent(idx){
  let arr = getRecent().filter(i=>i!==idx);
  arr.unshift(idx);
  arr = arr.slice(0, MAX_RECENT);
  localStorage.setItem('recent_v2', JSON.stringify(arr));
  renderRecentRow();
}
function renderRecentRow(){
  const arr = getRecent().filter(i=>productRows[i]);
  const sec = document.getElementById('recent-section');
  const row = document.getElementById('recent-row');
  if(!sec||!row) return;
  if(!arr.length){ sec.style.display='none'; return; }
  sec.style.display='block';
  row.innerHTML = arr.map(i=>{
    const r=productRows[i];
    return `<div class="recent-chip" onclick="showProductDetail(${i})">
      ${r[4]?`<img class="recent-chip-img" src="${r[4]}" onerror="this.style.display='none'">`:'<div class="recent-chip-img" style="display:flex;align-items:center;justify-content:center;font-size:1.2em">📦</div>'}
      <div class="recent-chip-info">
        <div class="recent-chip-name">${esc(r[0])}</div>
        <div class="recent-chip-price">${esc(r[2])}</div>
      </div>
    </div>`;
  }).join('');
}

// ── เข้าบ่อยสุด — นับครั้งที่เปิดดูสินค้า (key = ชื่อ+ประเภท เพื่อรอดเมื่อ reload) ──
function _prodKey(idx){ const r=productRows[idx]; return r?`${r[0]}__${r[1]}`:''; }
function getViewFreq(){ try{ return JSON.parse(localStorage.getItem('viewfreq_v1')||'{}'); }catch(e){ return {}; } }
function bumpViewFreq(idx){
  const k=_prodKey(idx); if(!k) return;
  const m=getViewFreq(); m[k]=(m[k]||0)+1;
  localStorage.setItem('viewfreq_v1', JSON.stringify(m));
  renderFreqRow();
}
function renderFreqRow(){
  const sec=document.getElementById('freq-section');
  const row=document.getElementById('freq-row');
  if(!sec||!row) return;
  const m=getViewFreq();
  // map current product key → idx (first match wins)
  const idxByKey={};
  productRows.forEach((r,i)=>{ const k=`${r[0]}__${r[1]}`; if(!(k in idxByKey)) idxByKey[k]=i; });
  const items=Object.entries(m)
    .filter(([k,c])=> c>=2 && (k in idxByKey))
    .sort((a,b)=> b[1]-a[1])
    .slice(0,6)
    .map(([k,c])=>({i:idxByKey[k], c}));
  if(!items.length){ sec.style.display='none'; return; }
  sec.style.display='block';
  row.innerHTML=items.map(({i,c})=>{
    const r=productRows[i];
    return `<div class="recent-chip" onclick="showProductDetail(${i})">
      ${r[4]?`<img class="recent-chip-img" src="${r[4]}" onerror="this.style.display='none'">`:'<div class="recent-chip-img" style="display:flex;align-items:center;justify-content:center;font-size:1.2em">📦</div>'}
      <div class="recent-chip-info">
        <div class="recent-chip-name">${esc(r[0])}</div>
        <div class="recent-chip-price">${esc(r[2])} <span class="freq-count">เข้า ${c}×</span></div>
      </div>
    </div>`;
  }).join('');
}

// ── FAVORITES — ใช้ชื่อสินค้า+ประเภท เป็น key เพื่อ persist ได้ถูกต้อง ──
function favKey(idx){ const r=productRows[idx]; return r?`${r[0]}__${r[1]}`:''; }
function getFavs(){ try{ return JSON.parse(localStorage.getItem('favs_v3')||'[]'); }catch(e){ return []; } }
function isFav(idx){ const k=favKey(idx); return k?getFavs().includes(k):false; }
function saveFavs(arr){ localStorage.setItem('favs_v3', JSON.stringify(arr)); }
function updateFavPill(){
  const favs = getFavs(); // array of "name__type" strings
  const pill = document.getElementById('fav-tab-pill');
  const cnt  = document.getElementById('fav-count');
  if(pill) pill.classList.toggle('has-fav', favs.length>0);
  if(cnt)  cnt.textContent = favs.length;
}
function toggleFav(idx, btn){
  const k = favKey(idx); if(!k) return;
  let arr = getFavs();
  const has = arr.includes(k);
  arr = has ? arr.filter(x=>x!==k) : [...arr,k];
  saveFavs(arr);
  if(btn){ btn.classList.toggle('faved',!has); btn.textContent=has?'☆':'⭐'; }
  updateFavPill();
  if(showingFavOnly) renderProductGrid(productRows);
}
function toggleFavDetail(idx, btn){
  const k = favKey(idx); if(!k) return;
  let arr = getFavs();
  const has = arr.includes(k);
  arr = has ? arr.filter(x=>x!==k) : [...arr,k];
  saveFavs(arr);
  const nowFav=!has;
  if(btn){
    btn.textContent=nowFav?'⭐ โปรด':'☆ บันทึก';
    btn.style.cssText=nowFav
      ?'background:rgba(255,59,107,.15);color:var(--pink);border:1px solid rgba(255,59,107,.3)'
      :'background:rgba(0,0,0,.05);color:var(--muted);border:1px solid var(--border)';
  }
  updateFavPill();
  showToast(nowFav?'บันทึกในรายการโปรด ⭐':'นำออกจากรายการโปรด');
}
function toggleFavTab(){
  showingFavOnly=!showingFavOnly;
  const pill=document.getElementById('fav-tab-pill');
  if(pill) pill.classList.toggle('active-fav',showingFavOnly);
  renderProductGrid(productRows);
}
// patch renderProductGrid to support fav filter
const _origRender = renderProductGrid;
window.renderProductGrid = function(rows){
  if(showingFavOnly){
    const el = document.getElementById('product-grid-view');
    if(!el) return;
    const favKeys = getFavs();
    // map favKeys กลับเป็น index ใน productRows
    let favIdxs = productRows.reduce((acc,r,i)=>{
      if(favKeys.includes(`${r[0]}__${r[1]}`)) acc.push(i);
      return acc;
    },[]);
    // apply color + hide-sold filters, sink sold-out to bottom
    if(selectedColor) favIdxs = favIdxs.filter(i=>productColorGroups(productRows[i]).has(selectedColor));
    if(hideSoldOut) favIdxs = favIdxs.filter(i=>!isSoldOut(productRows[i]));
    // expand to one card per matching shade when a color filter is active
    const favCards=[];
    favIdxs.forEach(i=>{
      const row=productRows[i];
      const shades = selectedColor ? variantsForColor(row, selectedColor) : [];
      if(selectedColor && shades.length){
        shades.forEach(vc=>{ if(hideSoldOut&&!vc.avail)return; favCards.push({i, img:vc.img||row[4]||'', colorName:vc.name, colorStock:vc.stock, sold:!vc.avail}); });
      } else {
        favCards.push({i, img:row[4]||'', colorName:'', sold:isSoldOut(row)});
      }
    });
    favCards.sort((a,b)=> a.sold===b.sold?0:(a.sold?1:-1));
    if(!favCards.length){
      el.innerHTML='<div class="loading-state" style="padding:60px 20px">⭐ ยังไม่มีรายการโปรด<br><small style="opacity:.5;font-size:.8em">กดดาว ☆ บนการ์ดเพื่อบันทึก</small></div>';
      return;
    }
    let html='<div class="product-grid">';
    let delay=0;
    favCards.forEach(item=>{
      const i=item.i, row=productRows[i], d=(delay%8)*60, hasPikad=!!row[9];
      const img=item.img, colorName=item.colorName, sold=item.sold;
      const low=colorName ? (!sold && item.colorStock>0 && item.colorStock<=3) : hasLowStock(row);
      const copyBtn = img
        ? `<button class="btn btn-info" onclick="event.stopPropagation();copyImageFromUrl('${img.replace(/'/g,"\\'")}',this)">🖼️ Copy รูป</button>`
        : `<button class="btn btn-info" onclick="event.stopPropagation();copyProductInfo(${i},this)">📋 Copy</button>`;
      html+=`<div class="pcard${sold?' sold-out':''}" style="animation-delay:${d}ms" onclick="showProductDetail(${i})">
        <div class="pcard-img-wrap">
          <div class="pcard-img">${img?`<img src="${img}" loading="lazy" onload="onImgLoad(this)">`:'<div class="no-img">📦</div>'}</div>
          ${sold?soldStampHTML():low?lowStockBadgeHTML():''}
          ${colorName?`<div class="pcard-color-badge">🎨 ${esc(colorName)}</div>`:''}
          <button class="fav-btn faved" onclick="event.stopPropagation();toggleFav(${i},this)">⭐</button>
          <div class="pcard-overlay">
            <span class="pcard-type">${esc(row[1]||'')}</span>
            <div class="pcard-name">${esc(row[0])}</div>
            <div class="pcard-price">${esc(row[2])}</div>
          </div>
        </div>
        <div class="pcard-actions">
          ${copyBtn}
          <button class="btn btn-cart" onclick="event.stopPropagation();openAddToCartPicker(${i})" title="เพิ่มลงตะกร้า">🛒</button>
          ${hasPikad?`<button class="btn btn-loc" onclick="event.stopPropagation();copyText(productRows[${i}][9],this)">📍 พิกัด</button>`:''}
        </div>
      </div>`;
      delay++;
    });
    html+='</div>';
    el.innerHTML=html;
    return;
  }
  _origRender.call(window, rows);
};

// ── LIGHTBOX ────────────────────────────────────
function openLightbox(src, caption){
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  if(!lb||!img) return;
  img.src = src;
  if(cap) cap.textContent = caption||'';
  lb.classList.add('open');
  document.body.style.overflow='hidden';
}
function closeLightbox(){
  document.getElementById('lightbox')?.classList.remove('open');
  document.body.style.overflow='';
}
document.getElementById('lightbox')?.addEventListener('click', e=>{
  if(e.target.id==='lightbox') closeLightbox();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeLightbox(); });

// ── SHARE ────────────────────────────────────────
async function shareProduct(idx){
  const r = productRows[idx]; if(!r) return;
  const text = `${r[0]}\nราคา: ${r[2]}\n${r[3]||''}`.trim();
  const url  = r[7]||r[10]||window.location.href;
  if(navigator.share){
    try{ await navigator.share({ title:r[0], text, url }); return; }catch(e){}
  }
  copyInfoToast(text+'\n'+url, 'Link แชร์');
}

// ── FAB QUICK COPY ───────────────────────────────
function toggleFab(){
  const fab  = document.getElementById('fab-main');
  const menu = document.getElementById('fab-menu');
  const isOpen = menu.classList.toggle('open');
  fab.classList.toggle('open', isOpen);
}
function fabCopy(type){
  const r = currentDetailRow; if(!r) return;
  let text='', label='';
  if(type==='all')  { text=`ชื่อสินค้า: ${r[0]}\nประเภท: ${r[1]}\nราคา: ${r[2]}\nรายละเอียด: ${r[3]}`; label='ข้อความทั้งหมด'; }
  if(type==='name') { text=r[0]; label='ชื่อสินค้า'; }
  if(type==='price'){ text=r[2]; label='ราคา'; }
  if(type==='desc') { text=r[3]; label='รายละเอียด'; }
  copyInfoToast(text, label);
  // close menu
  document.getElementById('fab-menu').classList.remove('open');
  document.getElementById('fab-main').classList.remove('open');
}
// close FAB when tapping outside
document.addEventListener('click', e=>{
  const wrap = document.getElementById('fab-wrap');
  if(wrap && !wrap.contains(e.target)){
    document.getElementById('fab-menu')?.classList.remove('open');
    document.getElementById('fab-main')?.classList.remove('open');
  }
});

// ── PATCH initFirebase to show skeleton first ───
const _origInitFirebase = initFirebase;
window.initFirebase = function(){
  showSkeleton(); // show skeleton while loading
  _origInitFirebase();
};

/* ═══════════════ BLOCK 3 ═══════════════ */
// ── PWA: Service Worker + Install Prompt ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('SW registered:', r.scope))
      .catch(e => console.warn('SW failed:', e));
  });
}

// Android / Chrome install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  // แสดง banner ติดตั้งที่ด้านล่าง
  if (document.getElementById('install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.innerHTML = `
    <div style="
      position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
      background:linear-gradient(135deg,#1e1e35,#2a1a35);
      color:#fff;border-radius:16px;
      padding:14px 20px;
      display:flex;align-items:center;gap:12px;
      box-shadow:0 8px 32px rgba(0,0,0,.4);
      border:1px solid rgba(255,59,107,.3);
      z-index:9999;max-width:340px;width:90%;
      font-family:'Prompt',sans-serif;font-size:.85em;
      animation:slideUp .4s cubic-bezier(.22,1,.36,1) both;
    ">
      <img src="icon-192.png" style="width:40px;height:40px;border-radius:10px;flex-shrink:0" 
           onerror="this.style.display='none'">
      <div style="flex:1;line-height:1.4">
        <div style="font-weight:800;font-size:.95em">ติดตั้งแอป LAMSANG</div>
        <div style="opacity:.7;font-size:.8em">เพิ่มลงหน้าจอหลัก</div>
      </div>
      <button onclick="doInstall()" style="
        background:linear-gradient(135deg,#E0C7EE,#B894D8);
        color:#fff;border:none;border-radius:10px;
        padding:8px 14px;font-family:'Prompt',sans-serif;
        font-weight:700;font-size:.82em;cursor:pointer;
        white-space:nowrap;
      ">ติดตั้ง</button>
      <button onclick="dismissInstall()" style="
        background:none;border:none;color:rgba(255,255,255,.5);
        font-size:1.2em;cursor:pointer;padding:4px;line-height:1;
      ">✕</button>
    </div>
    <style>
      @keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    </style>
  `;
  document.body.appendChild(banner);
}

async function doInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  dismissInstall();
  if (outcome === 'accepted') console.log('PWA installed');
}

function dismissInstall() {
  const b = document.getElementById('install-banner');
  if (b) b.remove();
  // ไม่แสดงอีก 3 วัน
  localStorage.setItem('install-dismissed', Date.now());
}

window.addEventListener('appinstalled', () => {
  dismissInstall();
  console.log('App installed successfully');
});

// ═══════════════════════════════════════════════
//  COMPOSITE IMAGE GENERATOR (Marketing Card)
// ═══════════════════════════════════════════════
let ciGroups = [];
let ciIndex = 0;
let ciCurrentBlob = null;
let ciCurrentFilename = '';

// Some image hosts (assets.page365.net) don't send CORS headers, so we route
// through wsrv.nl which is designed for proxying images with proper CORS.
const CI_NEEDS_PROXY = /(^https?:\/\/assets\.page365\.net\/)/i;
function _ciWsrv(src) { return `https://wsrv.nl/?url=${encodeURIComponent(src)}&we&n=-1`; }
function _ciAllOrigins(src) { return `https://api.allorigins.win/raw?url=${encodeURIComponent(src)}`; }
function _ciLoadDirect(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
async function ciLoadImage(src) {
  if (!src) return null;
  // For Page365 assets, go straight to wsrv (image-specific proxy)
  if (CI_NEEDS_PROXY.test(src)) {
    let img = await _ciLoadDirect(_ciWsrv(src));
    if (img) return img;
    img = await _ciLoadDirect(_ciAllOrigins(src));
    return img;
  }
  // Direct first (Cloudinary etc. supports CORS)
  let img = await _ciLoadDirect(src);
  if (img) return img;
  // Fallback through wsrv then allorigins
  img = await _ciLoadDirect(_ciWsrv(src));
  if (img) return img;
  img = await _ciLoadDirect(_ciAllOrigins(src));
  return img;
}
// ── รอฟอนต์ก่อนวาด canvas ───────────────────────────────────
// canvas วาดข้อความด้วย 'Prompt' แล้วคำนวณตำแหน่ง/ความกว้างกล่องจาก measureText
// ถ้าฟอนต์ยังโหลดไม่เสร็จตอนวาด เบราว์เซอร์จะ fallback ไป Arial ซึ่งกว้างต่างกัน
// ถึง 10% (วัดจริง: 'ลด 20%' Prompt 81px / Arial 73px) → ป้ายล้นกรอบ ขีดฆ่าไม่ตรง
// และที่สำคัญคือ "แต่ละเครื่องออกมาไม่เหมือนกัน" ขึ้นกับว่าฟอนต์มาทันหรือไม่
// Safari เจอบ่อยกว่าเพราะเลื่อนโหลดฟอนต์นานกว่า Chrome
let _ciFontsReady = null;
function _ciEnsureFonts() {
  if (_ciFontsReady) return _ciFontsReady;
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  // ระบุตัวอย่างข้อความไทยด้วย — Google Fonts แยก subset ภาษาไทยเป็นคนละไฟล์
  const sample = 'ลดเฉลี่ยเส้นพร้อมส่งหมดปกติไซส์ABC0123.-%';
  const weights = [500, 600, 700, 800, 900];   // ครบทุกน้ำหนักที่ canvas ใช้
  _ciFontsReady = Promise.all(
    weights.map(w => document.fonts.load(`${w} 40px 'Prompt'`, sample).catch(() => null))
  ).then(() => document.fonts.ready).catch(() => null);
  return _ciFontsReady;
}

// ── บรรทัดตรวจสอบใต้รูป ────────────────────────────────────
// เวลารูปออกมาไม่ตรงกันในแต่ละเครื่อง อันนี้บอกได้ว่าเพราะอะไร:
// เครื่องนั้นใช้โค้ดเวอร์ชันไหน และฟอนต์ Prompt ถูกใช้วาดจริงหรือไม่
// (วัดข้อความไทยด้วย Prompt เทียบกับฟอนต์ระบบ — ถ้ากว้างเท่ากันแปลว่า
//  subset ภาษาไทยของ Prompt ไม่มา แล้วตกไปใช้ฟอนต์ระบบซึ่งกว้างคนละอย่าง)
function _ciDiagText() {
  try {
    const src = document.querySelector('script[src*="app.js"]')?.getAttribute('src') || '';
    const ver = (src.match(/v=(\d+)/) || [,'?'])[1];
    const c = document.createElement('canvas'), x = c.getContext('2d');
    const probe = 'ลด 20% เฉลี่ย';
    x.font = "800 40px 'Prompt', sans-serif"; const wPrompt = x.measureText(probe).width;
    x.font = "800 40px sans-serif";           const wSys    = x.measureText(probe).width;
    const thaiOK = Math.abs(wPrompt - wSys) > 0.5;
    const w900 = document.fonts && [...document.fonts].some(f => f.family.includes('Prompt') && f.weight === '900' && f.status === 'loaded');
    const ua = navigator.userAgent;
    const iosM = ua.match(/OS (\d+)[._](\d+)/);
    const engine = /iPhone|iPad|iPod/.test(ua) ? ('iOS' + (iosM ? ' ' + iosM[1] + '.' + iosM[2] : '') + ' WebKit')
                 : (/Safari/.test(ua) && !/Chrome/.test(ua) ? 'Safari' : 'Chromium');
    // ความกว้างข้อความที่วัดได้จริง — ตัวเลขนี้คือหัวใจ
    // ถ้าเครื่องอื่นได้ตัวเลขไม่เท่ากัน แปลว่าวัดข้อความคนละแบบ = ต้นเหตุที่เลย์เอาต์เลื่อน
    // ค่าอ้างอิงบน Chromium: 81 / 349
    x.font = "800 21px 'Prompt', Arial, sans-serif";
    const m1 = Math.round(x.measureText('ลด 20%').width);
    const m2 = Math.round(x.measureText('★ ดีลพิเศษเฉพาะในแชท · ยิ่งซื้อยิ่งคุ้ม').width);
    const cv = document.getElementById('ci-canvas');
    const cvSize = cv ? `${cv.width}x${cv.height}` : '?';
    // วัดจากพิกเซลจริงบน canvas ว่าป้ายเขียวขอบขวาสุดอยู่ตรงไหน
    // ค่าที่ถูกคือ 1021 (โค้ดตรึงไว้ที่ W-30-28) ถ้าได้เลขอื่น = วาดผิดตำแหน่งจริง
    // ถ้าได้ 1021 แต่รูปยังดูโดนตัด = วาดถูก แต่ไปเพี้ยนตอนบันทึก/แสดงผล
    let badgeRight = '?';
    try {
      if (cv) {
        const g = cv.getContext('2d');
        const y0 = Math.floor(cv.height * 0.75), hh = cv.height - y0;
        const px = g.getImageData(0, y0, cv.width, hh).data;
        let mx = -1;
        for (let i = 0; i < px.length; i += 4) {
          if (Math.abs(px[i] - 26) < 28 && Math.abs(px[i+1] - 143) < 28 && Math.abs(px[i+2] - 79) < 28) {
            const x = (i / 4) % cv.width;
            if (x > mx) mx = x;
          }
        }
        badgeRight = mx < 0 ? 'ไม่พบป้าย' : mx;
      }
    } catch (e) { badgeRight = 'อ่านไม่ได้'; }
    // ข้อความในกรอบทุกอันวาดแบบ textAlign='center' → หมึกต้องกระจายซ้าย/ขวาเท่ากัน
    // ถ้าเครื่องไหนได้ค่าเบี้ยวไปข้างเดียว แปลว่าการจัดกึ่งกลางไม่ถูกใช้
    // ตัวหนังสือจะทะลุออกนอกเม็ด/ป้ายทางขวา ซึ่งตรงกับอาการที่เห็น
    let ctr = '?';
    try {
      const probe = (font, s) => {
        x.font = font; x.textAlign = 'center';
        const m = x.measureText(s);
        return Math.round(m.actualBoundingBoxLeft) + '/' + Math.round(m.actualBoundingBoxRight);
      };
      ctr = probe("800 21px 'Prompt', Arial, sans-serif", 'ลด 20%')
          + ' · ' + probe("800 22px 'Prompt', Arial, sans-serif", '1 เส้น');
    } catch (e) { ctr = 'วัดไม่ได้'; }
    // บิตแมปถูกแล้ว แต่ยังดูเบี้ยว → เช็กว่าตอนแสดงผลบนจอ canvas ล้นกรอบจนโดนตัดหรือไม่
    let dispW = '?', boxW = '?';
    try {
      if (cv) {
        dispW = Math.round(cv.getBoundingClientRect().width);
        const box = cv.parentElement;
        boxW = Math.round(box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) - parseFloat(getComputedStyle(box).paddingRight));
      }
    } catch (e) {}
    return `🔎 ข้อมูลเครื่อง (แตะเพื่อก๊อป)\n`
         + `v${ver} · ${engine} · ไทย:${thaiOK ? 'Prompt ✓' : 'ฟอนต์ระบบ ✗'} · w900:${w900 ? '✓' : '✗'} · dpr${window.devicePixelRatio || 1}\n`
         + `วัดได้ ${m1}/${m2} (ควรเป็น 81/349) · canvas ${cvSize}\n`
         + `ขอบขวาป้าย ${badgeRight} (ควรเป็น 993)\n`
         + `แสดงผล ${dispW}px ในกรอบ ${boxW}px${dispW > boxW + 1 ? ' ⚠️ ล้นกรอบ' : ' ✓'}\n`
         + `กึ่งกลาง ${ctr} (ควรเป็น 40/40 · 25/25)`;
  } catch (e) { return 'diag error'; }
}
function copyCiDiag(el) {
  const payload = el.textContent.split('\n').slice(1).join(' | ');   // ตัดหัวข้อออก เอาเฉพาะข้อมูล
  navigator.clipboard?.writeText(payload).then(() => {
    const o = el.textContent;
    el.textContent = '✓ ก๊อปแล้ว — วางส่งได้เลย';
    setTimeout(() => el.textContent = o, 1500);
  }).catch(() => {});
}

// ── วาดข้อความโดยไม่พึ่ง ctx.textAlign ─────────────────────
// บน WebKit บางเครื่อง fillText ไม่ใช้ค่า ctx.textAlign ที่ตั้งไว้ (แต่ measureText ใช้)
// ผลคือข้อความที่ควรอยู่กึ่งกลางกรอบ ถูกวาดจากจุดกึ่งกลางแล้วยื่นไปทางขวา
// → ชื่อสีเลื่อนไม่ตรงเส้นขีดฆ่า, "เส้น" ทะลุเม็ดสีชมพู, "%" ทะลุป้ายเขียว
// แก้โดยคำนวณจุดเริ่มเองทุกครั้ง แล้ววาดแบบ left เสมอ — ได้ผลเหมือนกันทุกเบราว์เซอร์
function ciText(ctx, s, cx, y, align) {
  const str = String(s);
  ctx.textAlign = 'left';
  let x = cx;
  if (align === 'center') x = cx - ctx.measureText(str).width / 2;
  else if (align === 'right') x = cx - ctx.measureText(str).width;
  ctx.fillText(str, x, y);
}

function ciDrawSoldStamp(ctx, cx, cy, w) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 12);
  const h = w * 0.32;
  ctx.fillStyle = 'rgba(217, 38, 38, 0.92)';
  ctx.beginPath();
  ctx.rect(-w/2, -h/2, w, h);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(2, w * 0.012);
  ctx.strokeRect(-w/2 + 6, -h/2 + 6, w - 12, h - 12);
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${w * 0.20}px 'Prompt', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ciText(ctx, 'SOLD OUT', 0, 0, 'center');
  ctx.restore();
}

function openCompositeImage(idx, presetSize) {
  const row = productRows[idx]; if (!row) return;
  const variants = getVariants(row);
  if (!variants.length) {
    showSyncToast('สินค้านี้ไม่มีตัวเลือก — ไม่จำเป็นต้องใช้รูปรวม', 'error');
    return;
  }
  ciGroups = [];
  ciIndex = 0;
  const baseSku = (row[6]||row[0]||'product').replace(/[^a-zA-Z0-9_-]/g,'_');

  if (hasSizeDimension(variants)) {
    const {colors, sizes, grid} = groupVariantsBySize(variants);
    sizes.forEach(size => {
      const groupVs = colors.map(c => grid[c]?.[size]).filter(Boolean).map(v => ({...v, _color: parseVariant(v.name).color, _size: size}));
      if (!groupVs.length) return;
      ciGroups.push({
        title: row[0]||'',
        sizeLabel: size,
        variants: groupVs,
        filename: `${baseSku}_${size}.png`,
        blob: null,
        _row: row,
      });
    });
    // jump to preset size if requested
    if (presetSize) {
      const found = ciGroups.findIndex(g => g.sizeLabel === presetSize);
      if (found >= 0) ciIndex = found;
    }
  } else {
    ciGroups.push({
      title: row[0]||'',
      sizeLabel: '',
      variants: variants.map(v => ({...v, _color: parseVariant(v.name).color})),
      filename: `${baseSku}.png`,
      blob: null,
      _row: row,
    });
  }

  document.getElementById('ci-modal-overlay').classList.add('open');
  renderCiNav();
  renderCiGroup(ciIndex);
}
function closeCompositeImage() {
  document.getElementById('ci-modal-overlay').classList.remove('open');
}
function renderCiNav() {
  const nav = document.getElementById('ci-nav');
  if (ciGroups.length <= 1) { nav.innerHTML = ''; nav.style.display='none'; return; }
  nav.style.display = 'flex';
  nav.innerHTML = ciGroups.map((g, i) => `
    <button type="button" class="ci-tab${i===ciIndex?' active':''}" onclick="switchCiGroup(${i})">${esc(g.sizeLabel||'รวม')}</button>
  `).join('') + `<button type="button" class="ci-tab dl-all" onclick="downloadAllCi()">⬇️ ทั้งหมด</button>`;
}
async function switchCiGroup(idx) {
  ciIndex = idx;
  renderCiNav();
  await renderCiGroup(idx);
}

// Build the "ปิดการขาย" message for a product (image modal + Copy button share this)
function buildCloseSaleText(row){
  const tpl = COPY_TEMPLATES.find(t => t.key === 'close') || COPY_TEMPLATES[0];
  return fillTemplate(tpl.text, row).replace(/\n{3,}/g, '\n\n').trim();
}
function copyCloseSaleText(btn){
  const t = document.getElementById('ci-sale-text')?.value || '';
  if (!t) return;
  copyToClipboard(t);
  showSyncToast('📋 Copy ข้อความปิดการขายแล้ว', 'success');
}

async function renderCiGroup(idx) {
  const g = ciGroups[idx];
  const r = g._row;
  // populate the ready-to-send close-sale text (same for all size tabs)
  const saleBox = document.getElementById('ci-sale');
  const saleTxt = document.getElementById('ci-sale-text');
  if (saleBox && saleTxt) {
    const txt = buildCloseSaleText(r);
    saleTxt.value = txt;
    saleBox.style.display = txt ? 'block' : 'none';
  }
  const info = document.getElementById('ci-info');
  info.textContent = `กำลังสร้างภาพ ${idx+1}/${ciGroups.length}...`;
  await _ciDrawToCanvas(document.getElementById('ci-canvas'), g, r);
  const diag = document.getElementById('ci-diag');
  if (diag) diag.textContent = _ciDiagText();
  await new Promise(resolve => {
    document.getElementById('ci-canvas').toBlob(blob => {
      g.blob = blob;
      ciCurrentBlob = blob;
      ciCurrentFilename = g.filename;
      info.innerHTML = blob
        ? `✓ ${g.sizeLabel ? `ไซส์ ${g.sizeLabel}` : 'พร้อมใช้งาน'} (${(blob.size/1024).toFixed(1)} KB) — ${ciGroups.length>1?`รูปที่ ${idx+1}/${ciGroups.length}`:'พร้อม Copy/Download'}`
        : '⚠️ สร้างภาพไม่สำเร็จ';
      resolve();
    }, 'image/png');
  });
}

async function _ciDrawToCanvas(canvas, g, r) {
  await _ciEnsureFonts();   // ต้องรอก่อนวาด ไม่งั้นตำแหน่งเพี้ยน (ดู _ciEnsureFonts)
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height; // 1080x1080

  // ── Shiny white background ──────────────────────────
  // Base white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // Soft vertical sheen (lighter band across the middle)
  const sheen = ctx.createLinearGradient(0, 0, 0, H);
  sheen.addColorStop(0,   '#f3f1f6');
  sheen.addColorStop(0.45,'#ffffff');
  sheen.addColorStop(0.55,'#ffffff');
  sheen.addColorStop(1,   '#ececf2');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
  // Subtle radial spotlight from top-left for glossy highlight
  const spot = ctx.createRadialGradient(W*0.25, H*0.2, 0, W*0.25, H*0.2, W*0.7);
  spot.addColorStop(0, 'rgba(255,255,255,0.85)');
  spot.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  // top accent bar
  ctx.fillStyle = '#E87A90';
  ctx.fillRect(0, 0, W, 6);

  // Brand (small)
  ctx.fillStyle = '#999';
  ctx.font = "600 16px 'Prompt', Arial, sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ciText(ctx, 'LAMSANGSTORE', W/2, 18, 'center');

  // Title (smaller)
  ctx.fillStyle = '#352F44';
  ctx.font = "800 38px 'Prompt', Arial, sans-serif";
  ciText(ctx, String(g.title).slice(0, 40), W/2, 38, 'center');

  // Size badge (or "ทุกสี" label) — compact
  let headerBottom = 86;
  if (g.sizeLabel) {
    const txt = `ไซส์ ${g.sizeLabel}`;
    ctx.font = "700 24px 'Prompt', Arial, sans-serif";
    const bw = ctx.measureText(txt).width + 36;
    const by = 84;
    const bx = (W - bw) / 2;
    ctx.fillStyle = '#E87A90';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, 34, 17); else ctx.rect(bx, by, bw, 34);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ciText(ctx, txt, W/2, by + 17, 'center');
    headerBottom = by + 34 + 10;
  } else {
    headerBottom = 86;
  }

  // rounded-rect path helper
  const rr = (x,y,w,h,rad) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x,y,w,h,rad); else ctx.rect(x,y,w,h); };

  // ── Variant cards — neat catalog grid, every row centered ──
  const variants = g.variants;
  const count = variants.length;
  const cols = count <= 2 ? 2 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const gap = 14;
  const sideMargin = 26;
  const usableW = W - sideMargin*2;
  const cellW = (usableW - gap*(cols-1)) / cols;
  // Promo band at the bottom shows per-quantity pricing baked into the image
  const ciTiers = buildTierPricing(r[2]);
  const ciUnit = counterWord(r);
  const ciUnitPrice = parseInt(String(r[2]||'').replace(/[^0-9]/g,'')) || 0;  // ราคาปกติ
  const footerHeight = ciTiers.length ? 84 + ciTiers.length * 40 + 32 : 44;
  const gridTop = headerBottom;
  const gridBottom = H - footerHeight - 4;
  const cellH = (gridBottom - gridTop - gap*(rows-1)) / rows;
  // card internal metrics — keep overhead minimal so the product image is as large as possible
  const pad = Math.max(8, Math.round(cellW * 0.035));
  const nameFont = Math.max(15, Math.min(30, Math.round(cellW * 0.092)));
  const statusFont = Math.max(12, Math.min(19, Math.round(cellW * 0.052)));
  const labelArea = nameFont + statusFont + 12;
  // เข็มขัด/สายคาด (นับเป็น "เส้น") → กรอบแนวนอนเต็มกว้าง + crop ขอบขาวบน-ล่าง ให้สินค้าเต็มกรอบ
  const fillCrop = counterWord(r) === 'เส้น';
  const availW = cellW - pad*2;
  const availH = cellH - pad*2 - labelArea;
  const wellH = Math.max(60, availH);
  const wellW = fillCrop ? availW : Math.min(availW, availH);

  const vImgs = await Promise.all(variants.map(v => ciLoadImage(v.image || r[4])));

  for (let i = 0; i < count; i++) {
    const v = variants[i];
    const rowIdx = Math.floor(i / cols);
    const col = i % cols;
    const itemsInRow = Math.min(cols, count - rowIdx*cols);
    const rowW = itemsInRow*cellW + (itemsInRow-1)*gap;
    const rowStartX = (W - rowW) / 2;            // center every row
    const cardX = rowStartX + col*(cellW + gap);
    const cardY = gridTop + rowIdx*(cellH + gap);
    const cxC = cardX + cellW/2;
    const sold = !vAvail(v);

    // card background + soft shadow
    ctx.save();
    ctx.shadowColor = 'rgba(90,50,100,0.10)';
    ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    ctx.fillStyle = sold ? '#f7f4f8' : '#ffffff';
    rr(cardX, cardY, cellW, cellH, 22); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#efe4f1'; ctx.lineWidth = 1.5;
    rr(cardX, cardY, cellW, cellH, 22); ctx.stroke();

    // image well
    const ix = cardX + (cellW - wellW)/2;
    const iy = cardY + pad;
    ctx.fillStyle = '#f3eef8';
    rr(ix, iy, wellW, wellH, 16); ctx.fill();
    const vi = vImgs[i];
    if (vi) {
      ctx.save();
      rr(ix, iy, wellW, wellH, 16); ctx.clip();
      // belts: cover (crop ขอบ) ให้เต็มกรอบ • อื่นๆ: contain (เห็นทั้งรูป)
      const ratio = fillCrop ? Math.max(wellW/vi.width, wellH/vi.height) : Math.min(wellW/vi.width, wellH/vi.height);
      const dw = vi.width*ratio, dh = vi.height*ratio;
      ctx.drawImage(vi, ix + (wellW-dw)/2, iy + (wellH-dh)/2, dw, dh);
      ctx.restore();
    }
    if (sold) ciDrawSoldStamp(ctx, ix + wellW/2, iy + wellH/2, Math.min(wellW,wellH)*0.86);

    // color name
    const colorName = v._color || v.name || '';
    ctx.fillStyle = sold ? '#aaa' : '#352F44';
    ctx.font = `800 ${nameFont}px 'Prompt', Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const nameY = iy + wellH + 8;
    ciText(ctx, colorName, cxC, nameY, 'center');
    if (sold) {
      const tw = ctx.measureText(colorName).width;
      ctx.strokeStyle = '#bbb'; ctx.lineWidth = Math.max(1.5, nameFont*0.07);
      ctx.beginPath();
      ctx.moveTo(cxC - tw/2, nameY + nameFont/2);
      ctx.lineTo(cxC + tw/2, nameY + nameFont/2);
      ctx.stroke();
    }

    // stock status
    const stockN = vStock(v);
    const isLow = !sold && stockN > 0 && stockN <= 3;
    ctx.font = `700 ${statusFont}px 'Prompt', Arial, sans-serif`;
    const statusY = nameY + nameFont + 4;
    if (sold) { ctx.fillStyle = '#d92626'; ciText(ctx, '● หมด', cxC, statusY, 'center'); }
    else if (isLow) { ctx.fillStyle = '#d68910'; ciText(ctx, '⚠ เหลือน้อย', cxC, statusY, 'center'); }
    else { ctx.fillStyle = '#1a6e3f'; ciText(ctx, '● พร้อมส่ง', cxC, statusY, 'center'); }
  }

  // Footer
  if (ciTiers.length) {
    // ── Promo band: per-quantity pricing baked into the image ──
    const bandTop = H - footerHeight + 4;
    const bandH = footerHeight - 12;        // leave room for accent bar
    const padX = 30;
    const innerX = padX + 28;
    // soft gradient background + border
    const bg = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH);
    bg.addColorStop(0, '#FDEAF0'); bg.addColorStop(1, '#FBDCE6');
    ctx.fillStyle = bg;
    rr(padX, bandTop, W - padX*2, bandH, 24); ctx.fill();
    ctx.strokeStyle = '#F4C7D6'; ctx.lineWidth = 2;
    rr(padX, bandTop, W - padX*2, bandH, 24); ctx.stroke();

    // Title
    ctx.fillStyle = '#C63D60';
    ctx.font = "800 27px 'Prompt', Arial, sans-serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('★ ดีลพิเศษเฉพาะในแชท · ยิ่งซื้อยิ่งคุ้ม', innerX, bandTop + 30);

    // Tier rows — aligned columns: [qty pill] [price] ............ [discount]
    const pillW = 104, pillH = 36;
    const pillX = innerX;
    const priceX = pillX + pillW + 22;
    // เดิมเว้นจากขอบกรอบแค่ 28px (ให้สมมาตรกับ innerX ด้านซ้าย) — วาดถูกต้อง
    // แต่พอรูป 1080px ถูกย่อลงมาแสดงบนจอมือถือ (~750px) แล้วโดนบีบอัดตอนส่ง LINE
    // ช่องว่าง 28px เหลือไม่ถึง 20px จริง ขอบป้ายเขียวกับขอบกรอบชมพูกลืนกัน
    // จนดูเหมือนป้ายทะลุออกนอกกรอบ — เว้นให้กว้างขึ้นเพื่อให้ทนการย่อ/บีบอัด
    const badgeRight = W - padX - 56;
    ciTiers.forEach((t, i) => {
      const ly = bandTop + 72 + i*40;
      // qty pill
      ctx.fillStyle = '#E87A90';
      rr(pillX, ly - pillH/2, pillW, pillH, pillH/2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = "800 22px 'Prompt', Arial, sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ciText(ctx, `${t.qty} ${ciUnit}`, pillX + pillW/2, ly + 1, 'center');
      // price text
      ctx.textAlign = 'left';
      if (t.qty === 1) {
        ctx.fillStyle = '#352F44';
        ctx.font = "800 27px 'Prompt', Arial, sans-serif";
        const disc = `${t.total.toLocaleString()}.-`;
        ctx.fillText(disc, priceX, ly);
        // ราคาปกติ (ขีดฆ่า) ต่อท้าย
        if (ciUnitPrice > t.total) {
          const dw = ctx.measureText(disc).width;
          let ox = priceX + dw + 16;
          ctx.fillStyle = '#9c8aa3';
          ctx.font = "600 22px 'Prompt', Arial, sans-serif";
          ctx.fillText('ปกติ ', ox, ly + 1);
          ox += ctx.measureText('ปกติ ').width;
          const origStr = `${ciUnitPrice.toLocaleString()}.-`;
          ctx.fillText(origStr, ox, ly + 1);
          const ow = ctx.measureText(origStr).width;
          ctx.strokeStyle = '#c98ba0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(ox, ly + 1); ctx.lineTo(ox + ow, ly + 1); ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#352F44';
        ctx.font = "800 26px 'Prompt', Arial, sans-serif";
        const avgTxt = `เฉลี่ย ${t.avg.toLocaleString()}.-/${ciUnit}`;
        ctx.fillText(avgTxt, priceX, ly);
        const aw = ctx.measureText(avgTxt).width;
        ctx.fillStyle = '#9c8aa3';
        ctx.font = "600 21px 'Prompt', Arial, sans-serif";
        ctx.fillText(`(รวม ${t.total.toLocaleString()}.-)`, priceX + aw + 14, ly + 1);
      }
      // discount badge — right-aligned column
      if (t.pct > 0) {
        const bt = `ลด ${t.pct}%`;
        ctx.font = "800 21px 'Prompt', Arial, sans-serif";
        const bw = ctx.measureText(bt).width + 34;   // เผื่อขอบในป้ายให้ '%' ไม่ชิดขอบเขียว
        const bx = badgeRight - bw;
        ctx.fillStyle = '#1a8f4f';
        rr(bx, ly - 17, bw, 34, 17); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ciText(ctx, bt, bx + bw/2, ly + 1, 'center');
      }
    });
    // ── ส่งฟรี + เก็บปลายทาง ──
    const codY = bandTop + 72 + ciTiers.length * 40 + 6;
    ctx.fillStyle = '#7a5c68';
    ctx.font = "700 22px 'Prompt', Arial, sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ciText(ctx, 'ส่งฟรีทั่วไทย · เก็บปลายทาง +20 บาท', W/2, codY, 'center');
  } else {
    // Compact footer: price + SKU
    if (r[2]) {
      ctx.fillStyle = '#E87A90';
      ctx.font = "800 24px 'Prompt', Arial, sans-serif";
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(String(r[2]) + '.-', 30, H - 14);
    }
    if (r[6]) {
      ctx.fillStyle = '#999';
      ctx.font = "500 13px 'Prompt', Arial, sans-serif";
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ciText(ctx, 'SKU: ' + String(r[6]).slice(-20), W - 30, H - 14, 'right');
    }
  }
  // bottom accent bar
  ctx.fillStyle = '#E87A90';
  ctx.fillRect(0, H-6, W, 6);
}

async function copyCiImage() {
  if (!ciCurrentBlob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({'image/png': ciCurrentBlob})]);
    showSyncToast('Copy รูปสำเร็จ ✓ วางใน LINE/Messenger ได้เลย', 'success');
  } catch(e) {
    showSyncToast('Copy ไม่สำเร็จ — ลองดาวน์โหลดแทน', 'error');
  }
}
function downloadCiImage() {
  if (!ciCurrentBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(ciCurrentBlob);
  a.download = ciCurrentFilename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
// ─── Build composite groups for any product ─────────────
function _buildCompositeGroups(row) {
  const variants = getVariants(row);
  if (!variants.length) return [];
  const baseSku = (row[6]||row[0]||'product').replace(/[^a-zA-Z0-9_-]/g,'_');
  if (hasSizeDimension(variants)) {
    const {colors, sizes, grid} = groupVariantsBySize(variants);
    return sizes.map(size => {
      const items = colors.map(c => grid[c]?.[size]).filter(Boolean).map(v => ({...v, _color: parseVariant(v.name).color, _size: size}));
      if (!items.length) return null;
      return {title: row[0]||'', sizeLabel: size, variants: items, filename: `${baseSku}_${size}.png`, _row: row};
    }).filter(Boolean);
  }
  return [{title: row[0]||'', sizeLabel: '', variants: variants.map(v => ({...v, _color: parseVariant(v.name).color})), filename: `${baseSku}.png`, _row: row}];
}

// Embedded composite gallery in product detail page (LAZY)
window._inlineGroups = [];     // [{group, blob, url, ready}]
window._inlineActiveIdx = 0;
let _inlineProductRow = null;
let _inlineCanvas = null;

function _getInlineCanvas() {
  if (!_inlineCanvas) {
    _inlineCanvas = document.createElement('canvas');
    _inlineCanvas.width = 1080;
    _inlineCanvas.height = 1080;
  }
  return _inlineCanvas;
}

async function embedComposites(idx, container) {
  const row = productRows[idx]; if (!row) return;
  _inlineProductRow = row;
  const groups = _buildCompositeGroups(row);
  if (!groups.length) return;

  // Initialize items as not-ready
  window._inlineGroups = groups.map(g => ({group: g, blob: null, url: null, ready: false}));
  window._inlineActiveIdx = 0;

  // Show skeleton with tabs immediately
  renderInlineCompUI(container);

  // Render the first one
  await _renderInlineComp(0);
  renderInlineCompUI(container);
}

async function _renderInlineComp(i) {
  const item = window._inlineGroups[i];
  if (!item || item.ready) return;
  const canvas = _getInlineCanvas();
  await _ciDrawToCanvas(canvas, item.group, _inlineProductRow);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (!blob) return;
  item.blob = blob;
  item.url = URL.createObjectURL(blob);
  item.ready = true;
}

function renderInlineCompUI(container) {
  const items = window._inlineGroups;
  if (!items?.length) return;
  const activeIdx = Math.min(window._inlineActiveIdx, items.length-1);
  const active = items[activeIdx];
  const hasTabs = items.length > 1;
  const row = _inlineProductRow;

  const imgEl = active.ready
    ? `<img class="inline-comp-img" src="${active.url}" onclick="openLightbox('${active.url}','${esc(row[0]||'')}${active.group.sizeLabel?` - ไซส์ ${esc(active.group.sizeLabel)}`:''}')">`
    : `<div class="inline-comp-img" style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--muted)">
        <div class="inline-comp-loading-icon">🎨</div>
        <div>กำลังสร้าง...</div>
       </div>`;

  container.innerHTML = `
    <div class="inline-comp-item">
      ${hasTabs ? `
        <div class="inline-comp-tabs">
          ${items.map((it, i) => `
            <button class="inline-comp-tab${i===activeIdx?' active':''}${it.ready?'':' pending'}" onclick="switchInlineComp(${i})">
              <span class="inline-comp-tab-label">ไซส์</span>
              <span>${esc(it.group.sizeLabel||'รวม')}</span>
            </button>
          `).join('')}
        </div>
      ` : ''}
      ${imgEl}
      <div class="inline-comp-actions">
        <button class="inline-comp-btn-copy" ${active.ready?'':'disabled style="opacity:.5"'} onclick="copyInlineComp(window._inlineActiveIdx)">📋 Copy</button>
        <button class="inline-comp-btn-dl" ${active.ready?'':'disabled style="opacity:.5"'} onclick="downloadInlineComp(window._inlineActiveIdx)">⬇️ Download</button>
        ${hasTabs ? `<button class="inline-comp-btn-dl" style="background:#D69DD6" onclick="downloadAllInlineComp()">⬇️ ทั้งหมด</button>` : ''}
      </div>
    </div>`;
}

async function switchInlineComp(i) {
  window._inlineActiveIdx = i;
  const container = document.getElementById('inline-comp-area');
  if (!container) return;
  if (!window._inlineGroups[i].ready) {
    renderInlineCompUI(container); // show loading state
    await _renderInlineComp(i);
  }
  renderInlineCompUI(container);
  // Sync color chips with selected size
  const sizeLabel = window._inlineGroups[i]?.group?.sizeLabel || null;
  _detailSelectedSize = sizeLabel;
  if (currentDetailRow) {
    renderDetailColorChips(getVariants(currentDetailRow), sizeLabel);
  }
}

async function downloadAllInlineComp() {
  const items = window._inlineGroups;
  showSyncToast(`กำลังสร้าง ${items.length} ภาพ...`, 'success');
  for (let i = 0; i < items.length; i++) {
    if (!items[i].ready) await _renderInlineComp(i);
    if (!items[i].url) continue;
    const a = document.createElement('a');
    a.href = items[i].url;
    a.download = items[i].group.filename;
    a.click();
    await new Promise(r => setTimeout(r, 400));
  }
  showSyncToast(`ดาวน์โหลด ${items.length} ไฟล์ ✓`, 'success');
}

async function copyInlineComp(idx) {
  const it = window._inlineGroups?.[idx];
  if (!it?.ready) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({'image/png': it.blob})]);
    showSyncToast('Copy รูปสำเร็จ ✓', 'success');
  } catch(e) {
    showSyncToast('Copy ไม่สำเร็จ — ลองดาวน์โหลดแทน', 'error');
  }
}

// ─── Image URL → blob (handles CORS via wsrv.nl) ───────────
async function _fetchImageAsPngBlob(url) {
  const img = await ciLoadImage(url);
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return new Promise(resolve => c.toBlob(resolve, 'image/png'));
}

async function copyImageFromUrl(url, btn) {
  if (!url) return;
  const orig = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ กำลังโหลด...'; }
  try {
    const blob = await _fetchImageAsPngBlob(url);
    if (!blob) throw new Error('โหลดรูปไม่ได้');
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
    showSyncToast('Copy รูปสำเร็จ ✓ วางใน LINE/Messenger ได้เลย', 'success');
  } catch(e) {
    showSyncToast('Copy ไม่สำเร็จ: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

async function downloadImageFromUrl(url, filename, btn) {
  if (!url) return;
  const orig = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ กำลังโหลด...'; }
  try {
    const blob = await _fetchImageAsPngBlob(url);
    if (!blob) throw new Error('โหลดรูปไม่ได้');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'image.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    showSyncToast('ดาวน์โหลด ✓', 'success');
  } catch(e) {
    showSyncToast('Download ไม่สำเร็จ: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}
function downloadInlineComp(idx) {
  const it = window._inlineGroups?.[idx];
  if (!it?.ready) return;
  const a = document.createElement('a');
  a.href = it.url;
  a.download = it.group.filename;
  a.click();
}

async function downloadAllCi() {
  for (let i = 0; i < ciGroups.length; i++) {
    if (!ciGroups[i].blob) {
      ciIndex = i;
      renderCiNav();
      await renderCiGroup(i);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(ciGroups[i].blob);
    a.download = ciGroups[i].filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    await new Promise(r => setTimeout(r, 400));
  }
  showSyncToast(`ดาวน์โหลด ${ciGroups.length} ไฟล์ ✓`, 'success');
}

// ═══════════════════════════════════════════════
//  MOBILE FILTER SHEET
//  มือถือ: ยุบ หมวดหมู่ / สี / เรียง / ตัวเลือก ที่เมื่อก่อนกาง
//  เต็มหน้าจอ (กินพื้นที่ ~350px ก่อนเห็นสินค้าชิ้นแรก) ให้เหลือปุ่มเดียว
//  ตัวกรองใช้ตัวแปรและฟังก์ชันชุดเดิมทั้งหมด — แค่เปลี่ยนที่แสดงผล
// ═══════════════════════════════════════════════
const SORT_LABELS = {
  name_asc:   'ชื่อ (ก→ฮ)',
  price_asc:  'ราคา น้อย→มาก',
  price_desc: 'ราคา มาก→น้อย',
};

function _activeFilters(){
  const out = [];
  if (selectedCat && selectedCat !== 'ทั้งหมด') out.push(selectedCat);
  if (selectedColor) out.push('สี' + selectedColor);
  if (hideSoldOut) out.push('ซ่อนของหมด');
  if (showingFavOnly) out.push('รายการโปรด');
  if (currentSort !== 'name_asc') out.push(SORT_LABELS[currentSort] || currentSort);
  return out;
}

function _shownCount(){
  return document.querySelectorAll('#product-grid-view .pcard').length;
}

// อัปเดตแถบตัวกรองด้านบน (ป้ายจำนวน + สรุปว่ากรองอะไรอยู่)
function updateFilterBar(){
  const active = _activeFilters();
  const btn = document.getElementById('mfb-btn');
  const cnt = document.getElementById('mfb-count');
  const sum = document.getElementById('mfb-summary');
  const clr = document.getElementById('mfb-clear');
  if (!btn) return;
  btn.classList.toggle('has-filter', active.length > 0);
  if (cnt){
    cnt.textContent = active.length;
    cnt.style.display = active.length ? 'block' : 'none';
  }
  if (sum) sum.textContent = active.length ? active.join(' · ') : 'แสดงทั้งหมด';
  if (clr) clr.style.display = active.length ? 'block' : 'none';
  const apply = document.getElementById('fs-apply');
  if (apply) apply.textContent = `ดูสินค้า ${_shownCount()} รายการ`;
}

function _escAttr(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function renderFilterSheet(){
  const rows = productRows || [];

  // เรียงลำดับ
  const sortEl = document.getElementById('fs-sort');
  if (sortEl) sortEl.innerHTML = Object.entries(SORT_LABELS).map(([v,label]) =>
    `<button class="cat-pill${currentSort===v?' active':''}" onclick="pickSort('${v}')">${label}</button>`
  ).join('');

  // ประเภทสินค้า
  const catEl = document.getElementById('fs-cats');
  if (catEl){
    const counts = {};
    rows.forEach(r => { const t = r[1]||'ไม่ระบุ'; counts[t] = (counts[t]||0)+1; });
    const types = Object.keys(counts).sort((a,b)=>a.localeCompare(b,'th'));
    catEl.innerHTML =
      `<button class="cat-pill${selectedCat==='ทั้งหมด'?' active':''}" onclick="pickCat('ทั้งหมด')">✦ ทั้งหมด <span class="pill-count">${rows.length}</span></button>` +
      types.map(t => `<button class="cat-pill${selectedCat===t?' active':''}" onclick="pickCat('${_escAttr(t)}')">${catIcon(t)} ${t} <span class="pill-count">${counts[t]}</span></button>`).join('');
  }

  // สี — ใช้ชุดสีเดียวกับ chip bar เดิม
  const colEl = document.getElementById('fs-colors');
  const colSec = document.getElementById('fs-colors-sec');
  if (colEl){
    const present = new Map();
    rows.forEach(r => productColorGroups(r).forEach(lbl => present.set(lbl, (present.get(lbl)||0)+1)));
    const groups = COLOR_GROUPS.filter(g => present.has(g.label));
    if (groups.length < 2){
      if (colSec) colSec.style.display = 'none';
    } else {
      if (colSec) colSec.style.display = '';
      colEl.innerHTML =
        `<button class="color-chip${!selectedColor?' active':''}" onclick="pickColor(null)">🎨 ทุกสี</button>` +
        groups.map(g => `<button class="color-chip${selectedColor===g.label?' active':''}" onclick="pickColor('${_escAttr(g.label)}')">
          <span class="color-sw" style="background:${g.sw}"></span>${g.label}<span class="cc-count">${present.get(g.label)}</span>
        </button>`).join('');
    }
  }

  // ตัวเลือกอื่น
  const optEl = document.getElementById('fs-opts');
  if (optEl){
    const favCount = (typeof getFavs === 'function' ? getFavs().length : 0);
    optEl.innerHTML =
      `<button class="hide-sold-btn${hideSoldOut?' on':''}" onclick="pickHideSold()">${hideSoldOut?'👁 แสดงของหมด':'🙈 ซ่อนของหมด'}</button>` +
      (favCount ? `<button class="hide-sold-btn${showingFavOnly?' on':''}" onclick="pickFavOnly()">⭐ รายการโปรด ${favCount}</button>` : '') +
      `<button class="hide-sold-btn" onclick="closeFilterSheet();openUnmatchedReport()">⚠️ เช็ก Sync</button>`;
  }

  updateFilterBar();
}

// ── ตัวเลือกในชีต: เปลี่ยนค่าแล้ววาดใหม่ทันที (เห็นผลหลังชีตเลย) ──
function pickSort(v){
  const sel = document.getElementById('sortProduct');
  if (sel) sel.value = v;
  handleSortChange(v);
  renderFilterSheet();
}
function pickCat(cat){
  selectedCat = cat;
  showingFavOnly = false;
  buildCatPills(productRows);          // sync แถบเดิม + sidebar เดสก์ท็อป
  window.renderProductGrid(productRows);
  renderFilterSheet();
}
function pickColor(label){
  selectColorChip(label);
  renderFilterSheet();
}
function pickHideSold(){
  toggleHideSold(document.getElementById('hideSoldBtn'));
  renderFilterSheet();
}
function pickFavOnly(){
  toggleFavTab();
  renderFilterSheet();
}

function clearAllFilters(){
  selectedCat = 'ทั้งหมด';
  selectedColor = null;
  showingFavOnly = false;
  if (hideSoldOut) toggleHideSold(document.getElementById('hideSoldBtn'));
  const sel = document.getElementById('sortProduct');
  if (sel) sel.value = 'name_asc';
  currentSort = 'name_asc';
  const favPill = document.getElementById('fav-tab-pill');
  if (favPill) favPill.classList.remove('active-fav');
  buildCatPills(productRows);
  buildColorChips(productRows);
  window.renderProductGrid(productRows);
  renderFilterSheet();
}

function openFilterSheet(){
  renderFilterSheet();
  document.getElementById('filter-sheet').classList.add('open');
  const body = document.querySelector('#filter-sheet .fs-body');
  if (body) body.scrollTop = 0;   // เปิดใหม่ให้เริ่มที่บนสุดเสมอ
  document.body.style.overflow = 'hidden';
}
function closeFilterSheet(){
  document.getElementById('filter-sheet').classList.remove('open');
  document.body.style.overflow = '';
  updateFilterBar();
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('filter-sheet')?.classList.contains('open')) closeFilterSheet();
});
// หมุนจอ/ขยายหน้าต่างจนกลายเป็นเดสก์ท็อป — ปิดชีตทิ้ง เพราะเดสก์ท็อปใช้ sidebar แทน
window.addEventListener('resize', () => {
  if (window.innerWidth > 700 && document.getElementById('filter-sheet')?.classList.contains('open')) closeFilterSheet();
}, {passive:true});

// แถบตัวกรองต้องอัปเดตทุกครั้งที่ grid วาดใหม่ (จำนวน + สรุปว่ากรองอะไรอยู่)
// หุ้มทับ renderProductGrid ตัวที่ผ่าน fav patch มาแล้ว
(function(){
  const _prevRender = window.renderProductGrid;
  window.renderProductGrid = function(){
    const out = _prevRender.apply(this, arguments);
    try { updateFilterBar(); } catch(e){}
    return out;
  };
})();
document.addEventListener('DOMContentLoaded', updateFilterBar);
