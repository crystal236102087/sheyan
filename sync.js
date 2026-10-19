/* ============================================================
   奢眼 SHÉYAN · 云端行情同步模块
   ------------------------------------------------------------
   加载顺序（三级兜底，任何一环失败都不会白屏）：
     1) 先渲染本地内置 data.js —— 秒开，断网也能用
     2) 后台 fetch 云端 quote.json —— 带时间戳，绝不读缓存
     3) 云端更新时间更新 → 覆盖内存数据并静默重渲染
     4) 云端失败 → 继续用本地数据，不打扰用户
   ============================================================ */
(function () {
  const QUOTE_URL = "quote.json";
  const TIMEOUT = 6000;               // 6 秒拿不到就放弃，不拖慢体验
  const LS_KEY = "sheyan_quote_cache_v1";

  const log = (...a) => console.log("[行情同步]", ...a);

  /* 打包成全局状态，供 app.js 渲染时读取 */
  window.QUOTE_SYNC = {
    source: "local",                  // local | cloud | cache
    updated: null,
    loading: true,
    error: null
  };

  /* 把云端数据应用为全局数据。
     data.js 中已用 var 声明（而非 const），因此可以直接赋值覆盖，
     app.js 里所有渲染函数读到的就是新数据。 */
  function applyData(pack) {
    if (!pack || !Array.isArray(pack.products) || !pack.products.length) {
      throw new Error("数据格式不正确");
    }
    if (pack.meta) META = pack.meta;
    if (pack.brands && pack.brands.length) BRANDS = pack.brands;
    if (pack.details) BRAND_DETAIL = pack.details;
    PRODUCTS = pack.products;
    if (pack.index) INDEX = pack.index;
    if (pack.rules && pack.rules.length) RECOMMEND_RULES = pack.rules;
    // 顶层 updated 是权威日期，同步进 META，保证页面各处显示一致
    const stamp = pack.updated || (pack.meta && pack.meta.dataDate) || null;
    if (stamp) META.dataDate = stamp;
    window.QUOTE_SYNC.updated = stamp;
    window.QUOTE_SYNC.count = pack.products.length;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      // 缓存 7 天过期，避免用户长期不联网看到过时数据
      if (Date.now() - (obj._ts || 0) > 7 * 864e5) return null;
      return obj.pack;
    } catch (e) { return null; }
  }

  function writeCache(pack) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ _ts: Date.now(), pack }));
    } catch (e) { /* 配额满或隐私模式，忽略 */ }
  }

  /* 统一重渲染入口 */
  function rerender() {
    if (typeof renderHome === "function" && typeof state !== "undefined") {
      const tab = state.tab || "home";
      if (typeof go === "function") go(tab);
      const dd = document.getElementById("dataDate");
      if (dd && typeof META !== "undefined") dd.textContent = META.dataDate;
      const ms = document.getElementById("metaScope");
      if (ms && typeof META !== "undefined") ms.textContent = META.dataScope;
    }
    paintBadge();
  }

  /* 状态徽章：让用户看得见「这份行情是不是最新的」 */
  function paintBadge() {
    const el = document.getElementById("syncBadge");
    if (!el) return;
    const s = QUOTE_SYNC;
    el.classList.remove("ok", "warn", "loading");
    if (s.loading) {
      el.textContent = "同步中…";
      el.classList.add("loading");
      el.title = "正在向云端获取最新行情";
    } else if (s.source === "cloud") {
      el.textContent = "已是最新";
      el.classList.add("ok");
      el.title = "行情已从云端更新 · 点击可重新检查";
    } else if (s.source === "cache") {
      el.textContent = "离线缓存";
      el.classList.add("warn");
      el.title = "当前使用上次缓存的数据 · 点击重试联网";
    } else {
      el.textContent = "本地数据";
      el.classList.add("warn");
      el.title = "未连接到云端，使用内置数据 · 点击重试";
    }
  }

  /* 主流程：页面加载后立即执行 */
  function boot() {
    paintBadge();
    // 先看有没有可用缓存（比内置数据新）
    const cached = readCache();
    if (cached) {
      try {
        applyData(cached);
        rerender();
        QUOTE_SYNC.source = "cache";
        log("已加载本地缓存，更新日期", QUOTE_SYNC.updated);
      } catch (e) { /* 缓存坏了就用内置数据 */ }
    }
    fetchRemote();
    const badge = document.getElementById("syncBadge");
    if (badge) badge.addEventListener("click", () => {
      QUOTE_SYNC.loading = true;
      paintBadge();
      fetchRemote();
    });
  }

  async function fetchRemote() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      // 时间戳防缓存：确保每次打开都真的去服务器问一次
      const url = QUOTE_URL + "?t=" + Date.now();
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const pack = await res.json();
      clearTimeout(timer);

      applyData(pack);
      writeCache(pack);
      QUOTE_SYNC.source = "cloud";
      QUOTE_SYNC.loading = false;
      QUOTE_SYNC.error = null;
      window.QUOTE_SYNC.lastFetch = Date.now();
      log("云端更新成功 · 更新日期", QUOTE_SYNC.updated, "· 共", pack.products.length, "款");
      rerender();
    } catch (e) {
      clearTimeout(timer);
      QUOTE_SYNC.loading = false;
      QUOTE_SYNC.error = e.message || "网络不可用";
      log("云端获取失败，继续使用本地数据：", QUOTE_SYNC.error);
      paintBadge();
    }
  }

  // DOM 就绪后再跑，确保 app.js 的初始化已完成
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 0));
  } else {
    setTimeout(boot, 0);
  }
})();
