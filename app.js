/* ============================================================
   奢眼 SHÉYAN · 应用逻辑
   ============================================================ */

/* ---------- 通用 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const fmt = n => {
  if (n === null || n === undefined || n === 0) return "—";
  if (n >= 10000) {
    const w = n / 10000;
    return "¥" + (w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)) + "万";
  }
  return "¥" + n.toLocaleString("zh-CN");
};
const fmtShort = n => {
  if (!n) return "—";
  if (n >= 10000) return (n / 10000).toFixed(n % 10000 === 0 ? 0 : 1) + "万";
  return n.toLocaleString("zh-CN");
};
const brandOf = id => BRANDS.find(b => b.id === id) || { name: id, color: "#888", mono: "?" };

/* ---------- 状态 ---------- */
const state = {
  tab: "home",
  brandFilter: "all",
  catFilter: "all",
  search: "",
  moversTab: "up",
  sortBy: "heat",
  detailId: null,
  authBrand: "chanel",
  budget: 30000,
  scenario: "invest"
};

/* ============================================================
   路由
   ============================================================ */
function go(tab) {
  state.tab = tab;
  $$(".view").forEach(v => v.classList.remove("active"));
  const el = $("#view-" + tab);
  if (el) el.classList.add("active");
  $$(".tabbar .tab").forEach(t => t.classList.toggle("on", t.dataset.tab === tab));
  $(".app-body").scrollTop = 0;
  if (tab === "market") renderMarket();
  if (tab === "brand") renderBrandList();
  if (tab === "tool") renderTool();
  if (tab === "me") renderMe();
  if (tab === "home") renderHome();
  if (tab === "inv" && typeof renderInv === "function") renderInv();
}

/* ============================================================
   首页
   ============================================================ */
function renderHome() {
  const movers = MOVERS[state.moversTab];

  /* 指数迷你走势 */
  const pts = INDEX.points;
  const min = Math.min(...pts.map(p => p.v)) - 8;
  const max = Math.max(...pts.map(p => p.v)) + 8;
  const W = 300, H = 72;
  const poly = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - ((p.v - min) / (max - min)) * H;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const last = pts[pts.length - 1].v;
  const prev = pts[pts.length - 2].v;
  const chg = ((last - prev) / prev * 100).toFixed(1);
  const up = chg >= 0;

  $("#homeIndex").innerHTML = `
    <div class="idx-head">
      <div>
        <div class="idx-name">${INDEX.name}</div>
        <div class="idx-val">
          <span class="num">${last}</span>
          <span class="chg ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${chg}%</span>
        </div>
        <div class="idx-sub">基期 2024-09 = ${INDEX.base} · 更新于 ${META.dataDate}</div>
      </div>
      <div class="idx-badge">近 2 年</div>
    </div>
    <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="0,${H} ${poly} ${W},${H}" fill="url(#g1)"/>
      <polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${W}" cy="${(H - ((last - min) / (max - min)) * H).toFixed(1)}" r="3.5" fill="var(--accent)"/>
    </svg>
    <div class="idx-cats">
      ${INDEX.catTrend.map(c => `
        <div class="idx-cat">
          <div class="ic-name">${c.name}</div>
          <div class="ic-v ${c.v >= 0 ? 'up' : 'down'}">${c.v >= 0 ? '+' : ''}${c.v}%</div>
          <div class="ic-desc">${c.desc}</div>
        </div>`).join("")}
    </div>`;

  /* 涨跌榜 */
  $("#movers").innerHTML = movers.map(m => {
    const p = PRODUCTS.find(x => x.id === m.pid) || {};
    const b = brandOf(p.brand);
    return `<div class="mover" onclick="openDetail('${m.pid}')">
      <div class="mv-logo" style="background:${b.color}">${b.mono}</div>
      <div class="mv-main">
        <div class="mv-name">${m.name}</div>
        <div class="mv-note">${b.name} · ${m.note}</div>
      </div>
      <div class="mv-v ${m.v.startsWith('+') ? 'up' : 'down'}">${m.v}</div>
    </div>`;
  }).join("");

  /* 二级市场热门经典款 —— 按品牌分行陈列 */
  const SHOW_ROWS = [
    { brand: "hermes", ids: ["h1", "h2", "h4", "h5"] },
    { brand: "chanel", ids: ["c1", "c2", "c3"] },
    { brand: "lv",     ids: ["l3", "l2", "l4"] },
    { brand: "dior",   ids: ["d1", "d2"] },
    { brand: "gucci",  ids: ["g1", "g2"] },
    { brand: "rolex",  ids: ["r1", "r3"] },
    { brand: "patek",  ids: ["p1"] },
    { title: "经典首饰", en: "Fine Jewelry", color: "#9A7B4F", mono: "饰", cat: "首饰", ids: ["cj1", "v1"] }
  ];
  $("#homeShowcase").innerHTML = SHOW_ROWS.map(row => {
    let b, headName, headEn, headMeta;
    if (row.brand) {
      b = brandOf(row.brand);
      headName = b.name; headEn = b.en;
      headMeta = `保值率 ${b.ret}% · <b class="${b.trend >= 0 ? 'up' : 'down'}">${b.trend >= 0 ? '+' : ''}${b.trend}%</b>`;
    } else {
      b = { color: row.color, mono: row.mono };
      headName = row.title; headEn = row.en;
      headMeta = `<span class="sc-cat">${row.cat}</span>`;
    }
    const cards = row.ids.map(pid => {
      const p = PRODUCTS.find(x => x.id === pid);
      if (!p) return "";
      const up = p.trend >= 0;
      const img = p.img
        ? `<img src="${p.img}" loading="lazy" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="sc-ph" style="background:linear-gradient(135deg,${b.color},#1A1A1A);display:none">${b.mono}</div>`
        : `<div class="sc-ph" style="background:linear-gradient(135deg,${b.color},#1A1A1A)">${b.mono}</div>`;
      return `<div class="sc-card" onclick="openDetail('${p.id}')">
        <div class="sc-imgwrap">
          ${img}
          <div class="sc-trend ${up ? 'up' : 'down'}">${up ? '+' : ''}${p.trend}%</div>
        </div>
        <div class="sc-body">
          <div class="sc-name">${p.name}</div>
          <div class="sc-retail">官网 ${p.price > 0 ? '¥' + fmt(p.price) : '—'}</div>
          <div class="sc-sec">二手 ${fmtShort(p.low)}~${fmtShort(p.high)}</div>
        </div>
      </div>`;
    }).join("");
    return `<div class="sc-row">
      <div class="sc-head" ${row.brand ? `onclick="filterBrand('${row.brand}')"` : ""}>
        <div class="sc-logo" style="background:${b.color}">${b.mono}</div>
        <div class="sc-binfo">
          <div class="sc-bname">${headName} <span>${headEn}</span></div>
          <div class="sc-bmeta">${headMeta}</div>
        </div>
        <div class="sc-arrow">›</div>
      </div>
      <div class="sc-strip">${cards}</div>
    </div>`;
  }).join("");

  /* 今日提示 */
  $("#homeTip").innerHTML = `
    <div class="tip-title">今日行情提示</div>
    <div class="tip-body">
      腕表品类近三月整体承压（-6.4%），全金款跌幅最大；首饰与包袋小幅回暖。
      <b>报价请务必标注日期水印</b>，避免按旧行情收货造成亏损。
    </div>`;
}

/* ============================================================
   行情中心
   ============================================================ */
function renderMarket() {
  /* 指数详解 */
  const pts = INDEX.points;
  const min = Math.min(...pts.map(p => p.v)) - 10;
  const max = Math.max(...pts.map(p => p.v)) + 10;
  const W = 620, H = 180, PL = 34, PB = 26;
  const xs = i => PL + (i / (pts.length - 1)) * (W - PL - 10);
  const ys = v => H - PB - ((v - min) / (max - min)) * (H - PB - 12);
  const line = pts.map((p, i) => `${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(" ");
  const area = `${PL},${H - PB} ${line} ${W - 10},${H - PB}`;
  const gridVals = [min + (max - min) * 0.25, min + (max - min) * 0.5, min + (max - min) * 0.75];

  $("#idxChart").innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="chart">
      <defs>
        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridVals.map(v => `<line x1="${PL}" y1="${ys(v)}" x2="${W - 10}" y2="${ys(v)}" class="grid"/>
        <text x="4" y="${ys(v) + 4}" class="axis">${v.toFixed(0)}</text>`).join("")}
      <polygon points="${area}" fill="url(#g2)"/>
      <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${xs(i)}" cy="${ys(p.v)}" r="3" fill="var(--card)" stroke="var(--accent)" stroke-width="2"/>`).join("")}
      ${pts.map((p, i) => `<text x="${xs(i)}" y="${H - 8}" class="axis mid">${p.m.slice(2)}</text>`).join("")}
    </svg>`;

  /* 保值率梯队 */
  $("#tiers").innerHTML = RETENTION_TIERS.map(t => `
    <div class="tier">
      <div class="tier-bar" style="background:${t.color}"></div>
      <div class="tier-body">
        <div class="tier-top">
          <span class="tier-name" style="color:${t.color}">${t.tier}</span>
          <span class="tier-ret">保值率 ${t.ret}</span>
        </div>
        <div class="tier-brands">${t.brands.map(b => `<span class="chip-s">${b}</span>`).join("")}</div>
        <div class="tier-note">${t.note}</div>
      </div>
    </div>`).join("");

  /* 品牌行情榜 */
  const sorted = [...BRANDS].sort((a, b) => b.ret - a.ret).filter(b => b.id !== "gucci" || true);
  $("#brandRank").innerHTML = sorted.map(b => {
    const cnt = PRODUCTS.filter(p => p.brand === b.id).length;
    return `<div class="rank-row" onclick="filterBrand('${b.id}')">
      <div class="rk-logo" style="background:${b.color}">${b.mono}</div>
      <div class="rk-main">
        <div class="rk-name">${b.name} <span class="rk-en">${b.en}</span></div>
        <div class="rk-meta">${b.cat} · ${b.tier} · ${cnt} 款在库</div>
      </div>
      <div class="rk-vals">
        <div class="rk-ret">${b.ret}%</div>
        <div class="rk-trend ${b.trend >= 0 ? 'up' : 'down'}">${b.trend >= 0 ? '+' : ''}${b.trend}%</div>
      </div>
    </div>`;
  }).join("");

  /* 价格区间悬浮图 */
  const rows = [...PRODUCTS].filter(p => p.price > 0).sort((a, b) => b.ret - a.ret).slice(0, 14);
  const maxV = Math.max(...rows.map(p => Math.max(p.price, p.high)));
  $("#priceBars").innerHTML = rows.map(p => {
    const pw = (p.price / maxV * 100).toFixed(1);
    const lw = (p.low / maxV * 100).toFixed(1);
    const hw = (p.high / maxV * 100).toFixed(1);
    const over = p.high > p.price;
    return `<div class="pb-row" onclick="openDetail('${p.id}')">
      <div class="pb-name">${p.name.length > 9 ? p.name.slice(0, 9) + '…' : p.name}</div>
      <div class="pb-track">
        <div class="pb-retail" style="width:${pw}%"></div>
        <div class="pb-range" style="left:${lw}%;width:calc(${hw}% - ${lw}%)"></div>
      </div>
      <div class="pb-val ${over ? 'up' : ''}">${fmtShort(p.low)}~${fmtShort(p.high)}</div>
    </div>`;
  }).join("");
}

/* ============================================================
   品牌 / 产品图鉴
   ============================================================ */
function renderBrandList() {
  const cats = ["all", "包袋", "腕表", "首饰"];
  $("#brandChips").innerHTML = cats.map(c => `
    <button class="chip ${state.catFilter === c ? 'on' : ''}" onclick="setCat('${c}')">
      ${c === "all" ? "全部" : c}
    </button>`).join("");

  const list = BRANDS.filter(b => state.catFilter === "all" || b.cat === state.catFilter);
  $("#brandGrid").innerHTML = list.map(b => `
    <div class="brand-card" onclick="filterBrand('${b.id}')">
      <div class="bc-logo" style="background:${b.color}">${b.mono}</div>
      <div class="bc-name">${b.name}</div>
      <div class="bc-en">${b.en}</div>
      <div class="bc-foot">
        <span class="bc-tag">${b.cat}</span>
        <span class="bc-ret">保值 ${b.ret}%</span>
      </div>
    </div>`).join("");
}

function setCat(c) {
  state.catFilter = c;
  renderBrandList();
}

function filterBrand(id) {
  state.brandFilter = id;
  state.tab = "products";
  state.search = "";
  $$(".view").forEach(v => v.classList.remove("active"));
  $("#view-products").classList.add("active");
  $$(".tabbar .tab").forEach(t => t.classList.remove("on"));
  renderProducts();
  $(".app-body").scrollTop = 0;
}

function backToBrands() {
  state.brandFilter = "all";
  state.tab = "brand";
  $$(".view").forEach(v => v.classList.remove("active"));
  $("#view-brand").classList.add("active");
  $$(".tabbar .tab").forEach(t => t.classList.toggle("on", t.dataset.tab === "brand"));
  renderBrandList();
  $(".app-body").scrollTop = 0;
}

function renderProducts() {
  const b = BRANDS.find(x => x.id === state.brandFilter);
  if (b) {
    const d = BRAND_DETAIL[b.id];
    $("#prodHeader").innerHTML = `
      <div class="ph-top">
        <button class="back" onclick="backToBrands()">‹ 全部品牌</button>
      </div>
      <div class="ph-brand">
        <div class="ph-logo" style="background:${b.color}">${b.mono}</div>
        <div>
          <div class="ph-name">${b.name}</div>
          <div class="ph-meta">${b.en} · ${b.tier} · 平均保值率 ${b.ret}%</div>
        </div>
      </div>
      ${d ? `<div class="ph-intro">${d.intro}</div>` : ""}
      ${d ? `<div class="ph-sec">
        <div class="ph-sec-t">行业规则 / 关键知识</div>
        ${d.rules.map(r => `<div class="ph-li">${r}</div>`).join("")}
      </div>
      <div class="ph-sec warn">
        <div class="ph-sec-t">风险提示</div>
        ${d.risks.map(r => `<div class="ph-li">${r}</div>`).join("")}
      </div>` : ""}`;
  } else {
    $("#prodHeader").innerHTML = `
      <div class="ph-top"><button class="back" onclick="backToBrands()">‹ 全部品牌</button></div>
      <div class="ph-brand"><div><div class="ph-name">全部产品</div>
      <div class="ph-meta">共 ${PRODUCTS.length} 款 · 精选行情库</div></div></div>`;
  }

  const sTokens = searchTokens(state.search || "");
  let list = PRODUCTS.filter(p => state.brandFilter === "all" || p.brand === state.brandFilter)
    .filter(p => !state.search || matchProduct(p, sTokens));

  const sorters = {
    heat:  (a, b) => b.heat - a.heat,
    ret:   (a, b) => b.ret - a.ret,
    trend: (a, b) => b.trend - a.trend,
    price: (a, b) => b.high - a.high
  };
  list.sort(sorters[state.sortBy]);

  const sorts = [["heat", "热度"], ["ret", "保值率"], ["trend", "涨幅"], ["price", "价格"]];
  $("#prodSort").innerHTML = sorts.map(([k, v]) =>
    `<button class="chip ${state.sortBy === k ? 'on' : ''}" onclick="setSort('${k}')">${v}</button>`).join("");

  $("#prodList").innerHTML = list.length
    ? list.map(cardHTML).join("")
    : `<div class="empty">没有匹配的款式<br><span style="font-size:12px;color:#999;margin-top:8px;display:block">试试：满天星 · 鹦鹉螺 · 熊猫迪 · Birkin · 满钻 · 蓝气球</span></div>`;
}

function setSort(k) { state.sortBy = k; renderProducts(); }

/* ---------- 搜索：容错归一 + 分词 + 别名匹配 ---------- */
const SEARCH_STOP = ["手表","腕表","包包","手提包","款式","系列","款","表","包"];
function normTxt(s){ return (s || "").toLowerCase().replace(/斐/g, "翡"); }
function squeeze(s){ return normTxt(s).replace(/\s+/g, ""); }
function searchTokens(q){
  const t = normTxt(q);
  if(!t.trim()) return [];
  let parts = t.split(/[\s,，、/|+]+/).map(w => squeeze(w)).filter(Boolean);
  if(parts.length === 1){
    const br = BRANDS.map(b => squeeze(b.name)).sort((a, b) => b.length - a.length)
      .find(n => parts[0].includes(n) && parts[0].length > n.length);
    if(br) parts = [br, parts[0].replace(br, "")];
  }
  parts = parts.map(w => {
    for(const s of SEARCH_STOP){ if(w.length > s.length && w.endsWith(s)) return w.slice(0, -s.length); }
    return w;
  });
  return [...new Set(parts)].filter(w => w && !SEARCH_STOP.includes(w));
}
function matchProduct(p, tokens){
  if(!tokens.length) return true;
  const b = brandOf(p.brand);
  const hay = squeeze([p.name, p.series, p.spec, b.name, b.en, (p.alias || ""), (p.tags || []).join("|"), (p.points || []).join("|")].join("|"));
  return tokens.every(w => hay.includes(w));
}

function cardHTML(p) {
  const b = brandOf(p.brand);
  const up = p.trend >= 0;
  const over = p.price > 0 && p.high > p.price;
  return `<div class="pcard" onclick="openDetail('${p.id}')">
    <div class="pc-top">
      <div class="pc-logo" style="background:${b.color}">${b.mono}</div>
      <div class="pc-title">
        <div class="pc-name">${p.name}</div>
        <div class="pc-series">${b.name} · ${p.series}</div>
      </div>
      <div class="pc-trend ${up ? 'up' : 'down'}">${up ? '+' : ''}${p.trend}%</div>
    </div>
    <div class="pc-spec">${p.spec}</div>
    <div class="pc-prices">
      <div class="pc-price-item">
        <div class="pp-label">专柜公价</div>
        <div class="pp-val">${fmt(p.price)}</div>
      </div>
      <div class="pc-price-item">
        <div class="pp-label">二手回收参考</div>
        <div class="pp-val accent">${fmtShort(p.low)} ~ ${fmtShort(p.high)}</div>
      </div>
      <div class="pc-price-item">
        <div class="pp-label">保值率</div>
        <div class="pp-val">${p.ret}%</div>
      </div>
    </div>
    <div class="pc-tags">
      ${p.tags.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join("")}
      ${over ? `<span class="tag hot">超公价</span>` : ""}
    </div>
  </div>`;
}

/* ============================================================
   产品详情
   ============================================================ */
function openDetail(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const b = brandOf(p.brand);
  const up = p.trend >= 0;
  const band = p.price > 0 ? (p.high / p.price * 100) : null;

  /* 价格历史模拟（基于 trend 反推） */
  const base = p.high;
  const hist = [0, 1, 2, 3, 4, 5].map(i => {
    const t = i - 5;
    const v = base * (1 + (p.trend / 100) * (t / 5) * 0.85);
    return v;
  });
  const H = 110, W = 300;
  const mn = Math.min(...hist) * 0.97, mx = Math.max(...hist) * 1.03;
  const pts = hist.map((v, i) => `${(i / 5 * W).toFixed(1)},${(H - (v - mn) / (mx - mn) * H).toFixed(1)}`).join(" ");

  $("#detailBody").innerHTML = `
    <div class="d-hero${p.img ? ' has-img' : ''}" style="--bc:${b.color}">
      ${p.img ? `<img class="d-hero-img" src="${p.img}" alt="${p.name}" onerror="this.remove()">` : ""}
      <div class="d-hero-logo" style="background:${b.color}">${b.mono}</div>
      <div class="d-hero-brand">${b.name} · ${b.en}</div>
      <h2 class="d-hero-name">${p.name}</h2>
      <div class="d-hero-spec">${p.spec}</div>
      <div class="d-hero-tags">${p.tags.map(t => `<span class="tag light">${t}</span>`).join("")}</div>
    </div>

    <div class="card d-price">
      <div class="d-price-grid">
        <div>
          <div class="pp-label">专柜公价</div>
          <div class="d-big">${fmt(p.price)}</div>
        </div>
        <div>
          <div class="pp-label">95新全套回收参考</div>
          <div class="d-big accent">${fmtShort(p.low)} <span class="dash">~</span> ${fmtShort(p.high)}</div>
        </div>
      </div>
      <div class="d-price-foot">
        <span>保值率 <b>${p.ret}%</b></span>
        <span>近90天 <b class="${up ? 'up' : 'down'}">${up ? '+' : ''}${p.trend}%</b></span>
        ${band ? `<span>${band >= 100 ? '超公价' : '折价'} <b class="${band >= 100 ? 'up' : 'down'}">${(band - 100).toFixed(0)}%</b></span>` : ""}
      </div>
      <div class="d-chart">
        <div class="d-chart-t">近 6 个月回收价走势（示意）</div>
        <svg viewBox="0 0 ${W} ${H}" class="spark2" preserveAspectRatio="none">
          <polyline points="${pts}" fill="none" stroke="${up ? 'var(--up)' : 'var(--down)'}" stroke-width="2.5" stroke-linejoin="round"/>
        </svg>
        <div class="d-chart-x"><span>6个月前</span><span>3个月前</span><span>本月</span></div>
      </div>
      <div class="d-note">口径：95新 · 全套附件 · ${META.dataDate}</div>
    </div>

    <div class="card">
      <div class="card-t">产品介绍</div>
      <div class="d-desc">${p.desc}</div>
      <div class="d-points">
        ${p.points.map(x => `<div class="d-point"><span class="dot"></span>${x}</div>`).join("")}
      </div>
    </div>

    <div class="card risk">
      <div class="card-t">收发货风险点</div>
      <div class="d-desc">${p.risk}</div>
    </div>

    <div class="card action">
      <div class="card-t">经营建议</div>
      <div class="d-desc">${p.advice}</div>
    </div>
  `;
  state.detailId = id;
  go("detail");
  $("#view-detail").classList.add("active");
  $$(".tabbar .tab").forEach(t => t.classList.remove("on"));
}

/* ============================================================
   工具：计价 + 鉴定 + 避坑
   ============================================================ */
function renderTool() {
  /* 计价模型 */
  $("#pmSteps").innerHTML = PRICING_MODEL.steps.map(s => `
    <div class="pm-step">
      <div class="pm-k">${s.k}</div>
      <div class="pm-w">${s.w}</div>
      <div class="pm-d">${s.desc}</div>
    </div>`).join("");

  $("#pmExample").innerHTML = `
    <div class="ex-t">${PRICING_MODEL.example.title}</div>
    ${PRICING_MODEL.example.rows.map(([k, v], i) => `
      <div class="ex-row ${i === PRICING_MODEL.example.rows.length - 1 ? 'total' : ''}">
        <span>${k}</span><b>${v}</b>
      </div>`).join("")}
    <div class="ex-note">${PRICING_MODEL.example.note}</div>`;

  /* 计价器 */
  renderCalculator();

  /* 风险清单 */
  $("#pmRisks").innerHTML = PRICING_MODEL.risks.map(r => `
    <div class="risk-row">
      <div class="risk-t">${r.t}</div>
      <div class="risk-d">${r.d}</div>
      <div class="risk-a">→ ${r.act}</div>
    </div>`).join("");

  /* 鉴定知识库 */
  renderAuth();

  /* 避坑清单 */
  $("#pitfalls").innerHTML = PITFALLS.map(p => `
    <div class="pf">
      <div class="pf-head"><span class="pf-k">${p.t}</span><span class="pf-t">${p.k}</span></div>
      <div class="pf-d">${p.d}</div>
    </div>`).join("");
}

function renderCalculator() {
  const el = $("#calcProducts");
  if (!el) return;
  el.innerHTML = PRODUCTS.filter(p => p.price > 0 || p.low > 0)
    .map(p => `<option value="${p.id}">${brandOf(p.brand).name} ${p.name}</option>`).join("");
  calc();
}

function calc() {
  const sel = $("#calcProducts");
  if (!sel) return;
  const pid = sel.value;
  const p = PRODUCTS.find(x => x.id === pid);
  if (!p) return;

  const condMap = { "99": 1.00, "95": 0.90, "9": 0.82, "85": 0.72 };
  const cond = parseFloat($("#calcCond").value);
  const condLabel = $("#calcCond").selectedOptions[0].textContent;
  const full = parseFloat($("#calcAttach").value);
  const attachLabel = $("#calcAttach").selectedOptions[0].textContent;
  const deduct = parseFloat($("#calcDeduct").value) || 0;

  const base = p.high;                              // 品类基准（取区间上沿）
  const afterCond = base * cond;
  const afterAttach = afterCond * full;
  const final = afterAttach * (1 - deduct / 100);

  $("#calcOut").innerHTML = `
    <div class="calc-line"><span>① 品类基准行情价</span><b>${fmt(Math.round(base))}</b></div>
    <div class="calc-line"><span>② 成色系数（${condLabel}）</span><b>× ${cond.toFixed(2)}</b></div>
    <div class="calc-line"><span>③ 附件系数（${attachLabel}）</span><b>× ${full.toFixed(2)}</b></div>
    <div class="calc-line"><span>④ 原装度扣减</span><b class="down">- ${deduct}%</b></div>
    <div class="calc-line total"><span>回收参考报价</span><b class="accent">${fmt(Math.round(final))}</b></div>
    <div class="calc-range">区间参考 ${fmt(Math.round(final * 0.94))} ~ ${fmt(Math.round(final * 1.06))}</div>
    <div class="ex-note">基准价取该款 95 新全套行情区间上沿。仅为逻辑演示，不构成报价承诺。</div>`;

  /* 毛利测算 */
  const retail = Math.round(final * 1.18);
  const gross = retail - Math.round(final);
  const rate = (gross / retail * 100).toFixed(1);
  $("#calcProfit").innerHTML = `
    <div class="calc-line"><span>假设零售出货价（+18%）</span><b>${fmt(retail)}</b></div>
    <div class="calc-line"><span>单件毛利</span><b class="up">${fmt(gross)}</b></div>
    <div class="calc-line"><span>毛利率</span><b>${rate}%</b></div>
    <div class="ex-note">行业参考：爱马仕/劳力士等硬通货毛利率可达 50%~100%，古驰/迪奥等流量款仅 10%~20%。行业平均净利率不足 8%。</div>`;
}

function renderAuth() {
  const t = AUTH_KB.find(x => x.brand === state.authBrand) || AUTH_KB[0];
  $("#authTabs").innerHTML = AUTH_KB.map(x =>
    `<button class="chip ${x.brand === state.authBrand ? 'on' : ''}" onclick="setAuth('${x.brand}')">${x.name}</button>`).join("");
  $("#authBody").innerHTML = t.items.map(i => `
    <div class="kb">
      <div class="kb-k">${i.k}</div>
      <div class="kb-v">${i.v}</div>
    </div>`).join("");
}

function setAuth(id) { state.authBrand = id; renderAuth(); }

/* ============================================================
   决策助手
   ============================================================ */
function renderMe() {
  $("#budgetChips").innerHTML = BUDGETS.map(v =>
    `<button class="chip ${state.budget === v ? 'on' : ''}" onclick="setBudget(${v})">${fmtShort(v)}</button>`).join("");

  $("#scenChips").innerHTML = SCENARIOS.map(s =>
    `<button class="chip scen ${state.scenario === s.id ? 'on' : ''}" onclick="setScen('${s.id}')">
      <span class="sc-icon">${s.icon}</span>${s.name}
    </button>`).join("");

  const scenName = SCENARIOS.find(s => s.id === state.scenario).name;

  /* 预算内可选：按公价或二手价落入区间 */
  const pool = PRODUCTS.filter(p => {
    const ref = p.price > 0 ? p.price : p.low * 1.5;
    return ref <= state.budget * 1.35;
  }).sort((a, b) => b.ret - a.ret);

  $("#recList").innerHTML = pool.length ? pool.map(p => {
    const b = brandOf(p.brand);
    const fit = (() => {
      const ref = p.price > 0 ? p.price : p.low * 1.5;
      if (ref <= state.budget) return { t: "预算内", c: "ok" };
      return { t: "需小幅超预算", c: "warn" };
    })();
    return `<div class="rec" onclick="openDetail('${p.id}')">
      <div class="rec-top">
        <div class="rec-logo" style="background:${b.color}">${b.mono}</div>
        <div class="rec-main">
          <div class="rec-name">${p.name}</div>
          <div class="rec-series">${b.name} · ${p.series} · ${p.spec}</div>
        </div>
        <div class="rec-fit ${fit.c}">${fit.t}</div>
      </div>
      <div class="rec-prices">
        <span>公价 ${p.price > 0 ? fmtShort(p.price) : '—'}</span>
        <span>二手 ${fmtShort(p.low)}~${fmtShort(p.high)}</span>
        <span class="ret">保值 ${p.ret}%</span>
      </div>
      <div class="rec-why">${scenName}场景：${p.advice}</div>
    </div>`;
  }).join("") : `<div class="empty">该预算段暂无推荐，试试提高预算或更换场景</div>`;

  /* 场景专属建议 */
  const hit = RECOMMEND_RULES.filter(r => r.scen === state.scenario).sort((a, b) => Math.abs(a.budget - state.budget) - Math.abs(b.budget - state.budget)).slice(0, 3);
  $("#scenPick").innerHTML = hit.map(r => {
    const p = PRODUCTS.find(x => x.id === r.pid);
    const b = p ? brandOf(p.brand) : {};
    return `<div class="scen-pick" onclick="openDetail('${r.pid}')">
      <div class="sp-head">
        <span class="sp-label">${r.label}</span>
        <span class="sp-budget">${fmtShort(r.budget)}档</span>
      </div>
      <div class="sp-why">${r.why}</div>
    </div>`;
  }).join("");
}

function setBudget(v) { state.budget = v; renderMe(); }
function setScen(id) { state.scenario = id; renderMe(); }

/* ============================================================
   搜索
   ============================================================ */
function onSearch(v) {
  state.search = v;
  state.brandFilter = "all";
  state.tab = "products";
  $$(".view").forEach(x => x.classList.remove("active"));
  $("#view-products").classList.add("active");
  $$(".tabbar .tab").forEach(t => t.classList.remove("on"));
  renderProducts();
}

function toggleMovers() {
  state.moversTab = state.moversTab === "up" ? "down" : "up";
  $$("#mvTabs .seg").forEach(s => s.classList.toggle("on", s.dataset.k === state.moversTab));
  renderHome();
  $("#homeTip").scrollIntoView({ block: "nearest" });
}

/* ============================================================
   初始化
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  $("#dataDate").textContent = META.dataDate;
  $("#metaScope").textContent = META.dataScope;
  renderHome();

  $$(".tabbar .tab").forEach(t => t.addEventListener("click", () => go(t.dataset.tab)));
  $$("#mvTabs .seg").forEach(s => s.addEventListener("click", () => {
    state.moversTab = s.dataset.k;
    $$("#mvTabs .seg").forEach(x => x.classList.toggle("on", x === s));
    renderHome();
  }));

  $("#searchInput").addEventListener("input", e => onSearch(e.target.value));

  ["calcProducts", "calcCond", "calcAttach", "calcDeduct"].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", calc);
    el.addEventListener("change", calc);
  });

  go("home");
});
