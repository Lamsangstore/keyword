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

  /** ประตูกั้นเต็มจอ — ใช้แอปต่อไม่ได้จนกว่าจะเข้าสู่ระบบ */
  function lock(msg) {
    if (locked) return;
    locked = true;
    const el = document.createElement('div');
    el.id = 'hub-login-gate';
    el.setAttribute('style', [
      'position:fixed', 'inset:0', 'z-index:2147483600',
      'background:#f8fafc',
      'display:flex', 'align-items:center', 'justify-content:center', 'padding:24px',
      'font-family:inherit', 'color:#0f172a', 'text-align:center'
    ].join(';'));
    el.innerHTML =
      '<div style="max-width:340px">' +
        '<div style="font-size:44px;line-height:1;margin-bottom:14px">🔒</div>' +
        '<div style="font-size:17px;font-weight:700;margin-bottom:6px">ต้องเข้าสู่ระบบก่อนใช้งาน</div>' +
        '<div style="font-size:13px;color:#475569;margin-bottom:18px">' +
          (msg || 'ใช้อีเมลกับรหัสผ่านเดียวกับระบบ HR ของร้าน') +
        '</div>' +
        '<a href="' + loginHref() + '" style="display:block;padding:13px 18px;border-radius:12px;' +
          'background:#0f172a;color:#fff;font-weight:700;font-size:15px;text-decoration:none">เข้าสู่ระบบ</a>' +
      '</div>';
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
