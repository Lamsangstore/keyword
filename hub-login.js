/* ก้อนเดียวกับทุกแอปของร้าน (Scanner · พิมพ์บาร์โค้ด · Good-Products · ExportVcanbuy)
   ต้องโหลด **ต้น <body>** ก่อนเนื้อหาอื่น — ไม่มีโทเค็นจะได้ปิดประตูทันที หน้าแอปไม่แวบให้เห็น */
/* ---------------------------------------------------------------------------
   ล็อกอินกลางของร้าน (เฟส G · 30 ก.ย. 2569) — ก้อนนี้เหมือนกันทุกแอป
   แก้ APP ให้ตรงกับ slug ในทะเบียน `src/lib/hub-apps.ts` ของเว็บร้านเท่านั้น

   กุญแจ Hub ที่ฝังในหน้าเว็บบอกได้แค่ว่า "คำขอมาจากแอปไหน" (ใครเปิด view-source ก็ได้ไป)
   ส่วนก้อนนี้ทำให้รู้ว่า **ใคร** กำลังใช้ — พนักงานเข้าสู่ระบบด้วยบัญชีเดียวกับ HRIS
   เว็บร้านออกโทเค็นของคนนั้นให้ (อายุ 30 วัน เก็บไว้ในเครื่องนี้)

   **ร้านสั่ง 30 ก.ย. 2569 ว่าทุกแอปต้องล็อกอินก่อนถึงใช้งานได้**
   แต่สวิตช์บังคับอยู่ที่เว็บร้าน (หลังบ้าน → Hub เชื่อมแอป) ไม่ได้อยู่ในโค้ดนี้ —
   แอปถามเซิร์ฟเวอร์ว่าบังคับหรือยัง แล้วค่อยกั้นหน้าจอ เปิด/ปิดได้โดยไม่ต้องแก้แอป

   เจ้าของร้านปิดบัญชี / กด "บังคับออกจากระบบ" / พนักงานลาออกใน HRIS = ตัดทุกแอปพร้อมกัน
--------------------------------------------------------------------------- */
window.HubLogin = (function () {
  const APP  = 'keyword';
  const BASE = 'https://lamsangstore.com';
  /* ชื่อแอปบนประตู — ตรงกับทะเบียนแอปของเว็บร้าน
     **ต้องประกาศไว้บนสุด** เพราะประตูปิดตั้งแต่ตอนโหลด (ก่อนถึงบรรทัดข้างล่าง) */
  const APP_NAMES = {
    scanner: 'Scanner แพคของ', barcode: 'พิมพ์บาร์โค้ด', analytics: 'Good-Products',
    vcanbuy: 'ExportVcanbuy', keyword: 'คีย์ลัด'
  };

  let token = '', user = null, locked = false;
  try {
    token = localStorage.getItem('hubUserToken') || '';
    user  = JSON.parse(localStorage.getItem('hubUser') || 'null');
  } catch (e) {}

  const listeners = [];
  function notify() { listeners.forEach(function (fn) { try { fn(user); } catch (e) {} }); }

  /* รับโทเค็นที่เว็บร้านส่งกลับมาทาง `#lsa=…` แล้วลบออกจากแถบที่อยู่ทันที
     (ส่งทาง hash ไม่ใช่ query โทเค็นจึงไม่ไปโผล่ใน log ของเซิร์ฟเวอร์ไหนเลย) */
  (function catchLogin() {
    const m = /[#&]lsa=([^&]+)/.exec(location.hash || '');
    if (!m) return;
    try {
      token = decodeURIComponent(m[1]);
      localStorage.setItem('hubUserToken', token);
    } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  })();

  /* ร้านสั่ง 30 ก.ย. 2569: ยังไม่ล็อกอิน = ค้างหน้าเข้าสู่ระบบ ห้ามเห็นหน้าแอปเลย
     ปิดทันทีตั้งแต่โหลดหน้า ไม่รอถามเซิร์ฟเวอร์ (ไม่งั้นหน้าแอปแวบขึ้นมาให้เห็นก่อน) */
  if (!token) lock();

  function setUser(u) {
    user = u || null;
    try {
      if (user) localStorage.setItem('hubUser', JSON.stringify(user));
      else localStorage.removeItem('hubUser');
    } catch (e) {}
    notify();
  }

  /** โทเค็นใช้ไม่ได้แล้ว (หมดอายุ · ถูกตัดสิทธิ์ · ลาออก) */
  function drop() {
    token = '';
    try { localStorage.removeItem('hubUserToken'); } catch (e) {}
    setUser(null);
  }

  function loginHref() {
    return BASE + '/app-login?app=' + APP + '&return=' +
      encodeURIComponent(location.origin + location.pathname);
  }

  /**
   * ประตูกั้นเต็มจอ — ใช้แอปต่อไม่ได้จนกว่าจะเข้าสู่ระบบ
   * **หน้าตาเดียวกับหน้าล็อกอิน HRIS** (ร้านสั่ง 30 ก.ย. 2569) พื้นดำ-ทอง · การ์ดขาวขอบทอง · ฟอนต์ Noto Sans Thai (ธีมกลาง Lamsang)
   * ชุดสีเดียวกับ `src/components/hris/HrisShell.tsx` ของเว็บร้าน — แก้ที่หนึ่งต้องตามไปแก้อีกที่
   */
  function lock(msg) {
    if (locked) return;
    locked = true;
    try {
      if (!document.getElementById('hub-login-font')) {
        const f = document.createElement('link');
        f.id = 'hub-login-font'; f.rel = 'stylesheet';
        f.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap';
        document.head.appendChild(f);
      }
    } catch (e) {}
    const el = document.createElement('div');
    el.id = 'hub-login-gate';
    el.setAttribute('style', [
      'position:fixed', 'inset:0', 'z-index:2147483600', 'overflow:auto',
      'background:#1c1b19',
      'background-image:radial-gradient(circle at 5% 5%,rgba(191,156,79,.16),transparent 38%),' +
        'radial-gradient(circle at 95% 95%,rgba(168,133,63,.16),transparent 38%)',
      'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
      'padding:24px 16px', "font-family:'Noto Sans Thai',system-ui,-apple-system,sans-serif", 'color:#27272a', 'text-align:center'
    ].join(';'));
    el.innerHTML =
      '<div style="width:100%;max-width:448px;box-sizing:border-box;background:#fff;border-radius:16px;' +
        'border-top:4px solid #a8853f;padding:36px 32px;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)">' +
        '<img src="https://lh3.googleusercontent.com/d/1wFGzcl5Y3yEfd39sA2LTbrgeNkgVxm27" alt="Lamsang" ' +
          'style="height:112px;width:auto;margin:0 auto 16px;display:block;object-fit:contain">' +
        '<div style="font-size:30px;font-weight:700;letter-spacing:.025em;color:#27272a">Lamsang Group</div>' +
        '<div style="font-size:14px;color:#71717a;margin-top:8px">เข้าใช้ ' + (APP_NAMES[APP] || 'แอปของร้าน') + '</div>' +
        '<div style="margin:28px 0 20px;padding:14px 16px;border-radius:12px;background:#fafafa;' +
          'border:1px solid #e4e4e7;font-size:14px;color:#52525b">' +
          '🔒 ' + (msg || 'ต้องเข้าสู่ระบบก่อนใช้งาน') + '</div>' +
        '<a href="' + loginHref() + '" style="display:flex;align-items:center;justify-content:center;gap:8px;' +
          'padding:13px 16px;border-radius:12px;background:#a8853f;color:#fff;font-weight:700;font-size:16px;' +
          'text-decoration:none;box-shadow:0 4px 6px -1px rgba(0,0,0,.1)">' +
          '<svg viewBox="0 0 512 512" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M217.9 105.9 340.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L217.9 406.1c-6.4 6.4-15 9.9-24 9.9-18.7 0-33.9-15.2-33.9-33.9V320H32c-17.7 0-32-14.3-32-32v-64c0-17.7 14.3-32 32-32h128v-62.1c0-18.7 15.2-33.9 33.9-33.9 9 0 17.6 3.6 24 9.9zM352 416h64c17.7 0 32-14.3 32-32V128c0-17.7-14.3-32-32-32h-64c-17.7 0-32-14.3-32-32s14.3-32 32-32h64c53 0 96 43 96 96v256c0 53-43 96-96 96h-64c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>' +
          'เข้าสู่ระบบ</a>' +
        '<div style="font-size:12px;color:#71717a;margin-top:14px">ใช้อีเมลและรหัสผ่านเดียวกับระบบ HRIS</div>' +
      '</div>' +
      '<div style="font-size:14px;color:#71717a;margin-top:32px">&copy; ' + new Date().getFullYear() +
        ' Lamsang Group All Rights Reserved.</div>';
    const put = function () { document.body.appendChild(el); };
    if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
  }

  function unlock() {
    locked = false;
    const el = document.getElementById('hub-login-gate');
    if (el) el.remove();
  }

  /** ถามเว็บร้านว่าโทเค็น (หรือกุญแจของแอป) ยังใช้ได้ไหม และเป็นของใคร */
  async function ask(auth) {
    const res = await fetch(BASE + '/api/hub/v1/session', {
      headers: { Authorization: 'Bearer ' + auth }, cache: 'no-store'
    });
    const body = await res.json().catch(function () { return {}; });
    return { status: res.status, body: body };
  }

  /**
   * เรียกตอนเปิดแอป — กั้นหน้าจอถ้าเว็บร้านสั่งให้บังคับล็อกอิน
   * appKey = กุญแจของแอป (ใช้ถามว่าตอนนี้บังคับหรือยัง ตอนที่ยังไม่มีคนล็อกอิน)
   *
   * **ไม่มีโทเค็น = ล็อกเสมอ** ไม่ว่าเว็บร้านจะเปิดสวิตช์บังคับหรือยัง
   * **มีโทเค็นแล้วเน็ตล่ม = ไม่กั้น** — ใช้ชื่อที่จำไว้ในเครื่องต่อไปก่อน
   * (งานหน้าร้านต้องไม่หยุดเพราะเว็บร้านเข้าไม่ถึงชั่วคราว · ถ้าถูกตัดสิทธิ์จริง
   *  คำขอถัดไปที่ยิงถึงเซิร์ฟเวอร์จะโดน 401 แล้วประตูจะปิดเอง)
   */
  async function enforce(appKey) {
    try {
      if (!token) { lock(); return false; }
      const r = await ask(token);
      if (r.status === 401) {
        if (token) drop();
        lock(r.body && r.body.error);
        return false;
      }
      if (r.status < 400) {
        setUser((r.body && r.body.user) || null);
        unlock();
        return true;
      }
    } catch (e) { /* ออฟไลน์ — ปล่อยผ่านด้วยชื่อที่จำไว้ */ }
    return true;
  }

  /* ---- ปุ่มบัญชีมุมขวาบน (30 ก.ย. 2569) --------------------------------------------
     วงกลมอักษรย่อ + ชื่อเล่น · กดแล้วเปิดเมนู: ชื่อเต็ม · ตำแหน่ง · ออกจากระบบ
     **ตรรกะอยู่ที่นี่ที่เดียว แต่หน้าตาเป็นของแต่ละแอป** — แอปส่งชุดสี/ฟอนต์/มุมโค้งของตัวเอง
     มาทาง theme (ใช้ตัวแปร CSS ของแอปนั้นได้เลย เช่น 'var(--accent)') จะได้กลืนกับแอปเดิม
     ร้านติว่าปุ่ม 👤 แบบเดิม "ดูโบราณ ไม่เข้ากับแอปไหนเลย" */
  const ROLE_TH = { OWNER: 'เจ้าของร้าน', MANAGER: 'ผู้จัดการ', STAFF: 'พนักงาน' };

  /** อักษรย่อบนวงกลม — ชื่อไทยที่ขึ้นต้นด้วยสระหน้า (เ แ โ ใ ไ) เอา 2 ตัว ไม่งั้นเหลือแต่สระ */
  function initials(u) {
    const n = String((u && (u.nickname || u.name)) || '').trim();
    if (!n) return '?';
    return /^[เแโใไ]/.test(n) ? n.slice(0, 2) : n.slice(0, 1).toUpperCase();
  }
  /** ชื่อบนปุ่ม — ชื่อเล่นจาก HRIS ก่อน ไม่มีค่อยใช้คำแรกของชื่อจริง */
  function shortName(u) {
    if (!u) return '';
    return String(u.nickname || (u.name || '').split(/\s+/)[0] || '').trim();
  }
  function css(el, o) { Object.keys(o).forEach(function (k) { if (o[k] != null) el.style[k] = o[k]; }); return el; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  let menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }

  /**
   * วางปุ่มบัญชีลงใน host (ตำแหน่งที่แอปเลือก) — เรียกซ้ำได้ ปุ่มจะวาดใหม่ตามคนที่ล็อกอิน
   * theme: {
   *   font, showName, reverse (ชื่ออยู่ซ้ายวงกลม),
   *   trigger: { bg, border, radius, shadow, color, pad, height, hover },
   *   avatar:  { size, radius, bg, color, shadow },
   *   menu:    { bg, border, radius, shadow, color, sub, divider, danger, badgeBg, badgeColor, blur }
   * }
   */
  function mountAccount(host, theme) {
    if (!host) return;
    const t = theme || {};
    const tr = t.trigger || {}, av = t.avatar || {}, mn = t.menu || {};
    const size = av.size || 30;

    function avatar(px) {
      const a = document.createElement('span');
      css(a, {
        width: px + 'px', height: px + 'px', minWidth: px + 'px', borderRadius: av.radius || '50%',
        background: av.bg || '#1c1b19', color: av.color || '#fff', boxShadow: av.shadow || 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(px * 0.42) + 'px', fontWeight: '700', lineHeight: '1', letterSpacing: '0'
      });
      a.textContent = initials(window.HubLogin.user());
      return a;
    }

    function openMenu(btn) {
      closeMenu();
      const u = window.HubLogin.user();
      if (!u) return;
      const r = btn.getBoundingClientRect();
      const m = document.createElement('div');
      m.setAttribute('role', 'menu');
      css(m, {
        position: 'fixed', zIndex: '2147483500',
        top: Math.round(r.bottom + 8) + 'px',
        /* ปกติเปิดชิดขวาของปุ่ม (ปุ่มบัญชีมักอยู่มุมขวา) — ถ้าปุ่มอยู่ฝั่งซ้ายจนเมนูจะล้นจอ ให้ชิดซ้ายของปุ่มแทน */
        right: r.right - 248 >= 8 ? Math.max(8, Math.round(window.innerWidth - r.right)) + 'px' : null,
        left: r.right - 248 >= 8 ? null : Math.max(8, Math.round(r.left)) + 'px',
        width: '248px', maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box',
        background: mn.bg || '#fff', color: mn.color || '#18181b',
        border: mn.border || '1px solid rgba(0,0,0,.08)', borderRadius: mn.radius || '14px',
        boxShadow: mn.shadow || '0 12px 32px rgba(0,0,0,.14)',
        fontFamily: t.font || 'inherit', overflow: 'hidden', textAlign: 'left',
        backdropFilter: mn.blur ? 'blur(18px) saturate(1.4)' : null,
        WebkitBackdropFilter: mn.blur ? 'blur(18px) saturate(1.4)' : null,
        transformOrigin: r.right - 248 >= 8 ? 'top right' : 'top left', transition: 'opacity .14s ease, transform .14s ease',
        opacity: '0', transform: 'scale(.96) translateY(-4px)'
      });
      const role = u.position || ROLE_TH[u.role] || '';
      const days = u.expiresAt ? Math.max(0, Math.ceil((new Date(u.expiresAt) - Date.now()) / 864e5)) : null;
      const divider = mn.divider || 'rgba(0,0,0,.07)';

      const head = css(document.createElement('div'), {
        display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 14px'
      });
      head.appendChild(avatar(40));
      const who = document.createElement('div');
      css(who, { minWidth: '0', flex: '1' });
      who.innerHTML =
        '<div style="font-weight:700;font-size:14px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
          esc(u.name) + '</div>' +
        (role ? '<span style="display:inline-block;margin-top:5px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;' +
          'background:' + (mn.badgeBg || 'rgba(0,0,0,.06)') + ';color:' + (mn.badgeColor || 'inherit') + '">' + esc(role) + '</span>' : '');
      head.appendChild(who);
      m.appendChild(head);

      const info = css(document.createElement('div'), {
        padding: '10px 16px', fontSize: '12px', color: mn.sub || '#71717a',
        borderTop: '1px solid ' + divider, lineHeight: '1.5'
      });
      info.textContent = 'กำลังใช้ ' + (APP_NAMES[APP] || 'แอปของร้าน') +
        (days != null ? ' · ต้องเข้าสู่ระบบใหม่ในอีก ' + days + ' วัน' : '');
      m.appendChild(info);

      const out = document.createElement('button');
      out.type = 'button';
      out.setAttribute('role', 'menuitem');
      css(out, {
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px',
        background: 'transparent', border: '0', borderTop: '1px solid ' + divider, cursor: 'pointer',
        color: mn.danger || '#dc2626', fontFamily: 'inherit', fontSize: '14px', fontWeight: '600', textAlign: 'left'
      });
      out.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
        '<polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>ออกจากระบบ';
      out.onmouseenter = function () { out.style.background = mn.hover || 'rgba(0,0,0,.04)'; };
      out.onmouseleave = function () { out.style.background = 'transparent'; };
      out.onclick = async function () {
        out.disabled = true;
        out.lastChild.textContent = 'กำลังออกจากระบบ…';
        await window.HubLogin.signOut();
        closeMenu();
        lock();                                  // ไม่มีโทเค็นแล้ว = ค้างหน้าเข้าสู่ระบบ
      };
      m.appendChild(out);

      document.body.appendChild(m);
      menuEl = m;
      /* บังคับวาดสถานะเริ่มก่อน แล้วค่อยเปลี่ยน — ไม่ใช้ requestAnimationFrame เพราะแท็บที่ไม่ได้อยู่หน้าจอ
         (หรือเครื่องที่ประหยัดแบต) อาจไม่เดินเฟรม เมนูจะค้างโปร่งใสมองไม่เห็น */
      void m.offsetWidth;
      m.style.opacity = '1'; m.style.transform = 'none';
    }

    function render() {
      const u = window.HubLogin.user();
      host.innerHTML = '';
      if (!u) return;                            // ยังไม่รู้ว่าเป็นใคร (ประตูปิดอยู่) — ไม่ต้องโชว์อะไร
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = u.name + ' — บัญชีของฉัน';
      btn.setAttribute('aria-haspopup', 'menu');
      css(btn, {
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        flexDirection: t.reverse ? 'row-reverse' : 'row',
        height: tr.height || 'auto', padding: tr.pad || '3px 12px 3px 3px',
        background: tr.bg || 'transparent', border: tr.border || '0', borderRadius: tr.radius || '999px',
        boxShadow: tr.shadow || 'none', color: tr.color || 'inherit', cursor: 'pointer',
        fontFamily: t.font || 'inherit', fontSize: '13px', fontWeight: '600', lineHeight: '1',
        maxWidth: '180px', transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease',
        WebkitTapHighlightColor: 'transparent'
      });
      btn.appendChild(avatar(size));
      if (t.showName !== false) {
        const nm = css(document.createElement('span'), {
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: '0'
        });
        nm.textContent = shortName(u);
        if (t.nameClass) nm.className = t.nameClass;
        btn.appendChild(nm);
      }
      btn.onmouseenter = function () { if (tr.hover) btn.style.background = tr.hover; };
      btn.onmouseleave = function () { btn.style.background = tr.bg || 'transparent'; btn.style.transform = 'none'; };
      btn.onmousedown = function () { btn.style.transform = 'scale(.97)'; };
      btn.onmouseup = function () { btn.style.transform = 'none'; };
      btn.onclick = function (e) {
        e.stopPropagation();
        if (menuEl && !menuEl.isConnected) menuEl = null;
        menuEl ? closeMenu() : openMenu(btn);
      };
      host.appendChild(btn);
    }

    /* เรียกตอนแอปโหลดเสร็จแล้ว (window.HubLogin มีแล้ว) — ชื่อเปลี่ยนเมื่อไรปุ่มวาดใหม่เอง */
    window.HubLogin.onChange(render);
  }

  document.addEventListener('click', function (e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, true);

  return {
    app: APP,
    user: function () { return user; },
    token: function () { return token; },
    locked: function () { return locked; },
    /** กุญแจที่ควรใช้ยิง Hub — โทเค็นของคนมาก่อน ไม่มีค่อยใช้กุญแจของแอป */
    auth: function (appKey) { return token || appKey || ''; },
    /**
     * เรียกเมื่อ Hub ตอบ 401 — คืน true ถ้ายังลองใหม่ด้วยกุญแจของแอปได้
     * (เว็บร้านยังไม่บังคับล็อกอินสำหรับแอปนี้) · คืน false = ปิดประตูแล้ว
     */
    async denied(res) {
      let msg = '';
      try { msg = ((await res.clone().json()) || {}).error || ''; } catch (e) {}
      const needLogin = msg.indexOf('เข้าสู่ระบบ') >= 0;
      if (token) drop();
      if (needLogin) { lock(msg); return false; }
      return true;
    },
    loginHref: loginHref,
    lock: lock,
    enforce: enforce,
    /** วางปุ่มบัญชี (วงกลมอักษรย่อ + ชื่อเล่น + เมนู) ในที่ที่แอปเลือก — ดู mountAccount ข้างบน */
    mountAccount: mountAccount,
    async signOut() {
      if (!token) return;
      try {
        await fetch(BASE + '/api/hub/v1/session', {
          method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
        });
      } catch (e) {}
      drop();
    },
    onChange: function (fn) { listeners.push(fn); fn(user); }
  };
})();
