/* ============================================================
   奢眼 · 我的库存模块（本地 IndexedDB）+ PWA 注册
   ============================================================ */

/* ---------- PWA 注册（网络优先：线上永远自动用最新版本） ---------- */
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

const INV = {
  items: [],
  urls: [],
  editingId: null,
  formPhotos: [],
  newPhotoIds: [],
  removedPhotoIds: [],
  filter: "all",
  search: "",
  sort: "date"
};

const DBX = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      if (this.db) return res();
      const r = indexedDB.open("sheyan-db", 1);
      r.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains("items")) d.createObjectStore("items", { keyPath: "id" });
        if (!d.objectStoreNames.contains("photos")) d.createObjectStore("photos");
      };
      r.onsuccess = e => { this.db = e.target.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  st(n, m) { return this.db.transaction(n, m).objectStore(n); },
  put(n, v) { return new Promise((res, rej) => { const r = this.st(n, "readwrite").put(v); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  get(n, k) { return new Promise((res, rej) => { const r = this.st(n, "readonly").get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  all(n) { return new Promise((res, rej) => { const r = this.st(n, "readonly").getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); },
  del(n, k) { return new Promise((res, rej) => { const r = this.st(n, "readwrite").delete(k); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); },
  clear(n) { return new Promise((res, rej) => { const r = this.st(n, "readwrite").clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
};

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let _toastEl = null;
function toast(msg) {
  if (!_toastEl) {
    _toastEl = document.createElement("div");
    _toastEl.id = "toast";
    document.body.appendChild(_toastEl);
  }
  _toastEl.textContent = msg;
  _toastEl.classList.add("show");
  clearTimeout(_toastEl._tm);
  _toastEl._tm = setTimeout(() => _toastEl.classList.remove("show"), 2200);
}

/* ---------- 数据加载 ---------- */
async function loadInv() {
  await DBX.open();
  INV.items = await DBX.all("items");
}

/* ---------- 统计 ---------- */
function invStat() {
  const stock = INV.items.filter(i => i.status === "stock");
  const sold = INV.items.filter(i => i.status === "sold");
  const cost = stock.reduce((s, i) => s + (+i.cost || 0), 0);
  const ask = stock.reduce((s, i) => s + (+i.ask || 0), 0);
  const gain = sold.reduce((s, i) => s + ((+i.salePrice || 0) - (+i.cost || 0)), 0);
  const now = new Date();
  const mGain = sold.filter(i => {
    if (!i.saleDate) return false;
    const d = new Date(i.saleDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).reduce((s, i) => s + ((+i.salePrice || 0) - (+i.cost || 0)), 0);
  return { stock, sold, cost, ask, gain, mGain };
}

/* ---------- 列表渲染 ---------- */
function renderInv() {
  const st = invStat();
  $("#invStats").innerHTML = `
    <div class="stat"><div class="v">${st.stock.length}<span style="font-size:10px;color:var(--ink-3)"> 件</span></div><div class="k">在库货品</div></div>
    <div class="stat"><div class="v accent">${st.cost ? fmtShort(st.cost) : "0"}</div><div class="k">占用资金</div></div>
    <div class="stat"><div class="v">${st.ask - st.cost >= 0 ? "+" : ""}${st.ask ? fmtShort(st.ask - st.cost) : "0"}</div><div class="k">预期毛利</div></div>
    <div class="stat"><div class="v ${st.gain >= 0 ? "up" : "down"}">${st.gain ? (st.gain >= 0 ? "+" : "") + fmtShort(st.gain) : "0"}</div><div class="k">已实现毛利</div></div>`;

  $("#invMeta").textContent = INV.items.length ? `共 ${INV.items.length} 件 · 已售 ${st.sold.length} 件` : "";

  const chips = [["all", "全部"], ["stock", "在库"], ["sold", "已售"]];
  $("#invChips").innerHTML = chips.map(([k, v]) =>
    `<button class="seg2 ${INV.filter === k ? "on" : ""}" onclick="setInvFilter('${k}')">${v}</button>`).join("")
    + `<select class="sel-sort" onchange="setInvSort(this.value)">
        <option value="date" ${INV.sort === "date" ? "selected" : ""}>按收货时间</option>
        <option value="cost" ${INV.sort === "cost" ? "selected" : ""}>按成本金额</option>
        <option value="profit" ${INV.sort === "profit" ? "selected" : ""}>按预估毛利</option>
      </select>`;

  let list = INV.items.filter(i => INV.filter === "all" || i.status === INV.filter);
  if (INV.search) {
    const q = INV.search.toLowerCase();
    list = list.filter(i => ((i.name || "") + (i.brandName || "") + (i.spec || "") + (i.note || "")).toLowerCase().includes(q));
  }
  const sorters = {
    date:   (a, b) => (b.buyDate || "").localeCompare(a.buyDate || ""),
    cost:   (a, b) => (+b.cost || 0) - (+a.cost || 0),
    profit: (a, b) => {
      const pv = i => i.status === "sold" ? (+i.salePrice || 0) - (+i.cost || 0) : (+i.ask || 0) - (+i.cost || 0);
      return pv(b) - pv(a);
    }
  };
  list.sort(sorters[INV.sort]);

  INV.urls.forEach(u => URL.revokeObjectURL(u));
  INV.urls = [];

  $("#invList").innerHTML = list.length ? "" :
    `<div class="empty-mini">还没有货品。点右上角「＋ 收新货」录入第一件库存，<br>录完建议做一次 GitHub 备份。</div>`;

  list.forEach(i => {
    const el = document.createElement("div");
    el.className = "ichip";
    el.onclick = () => openItemForm(i.id);
    const profit = i.status === "sold"
      ? (+i.salePrice || 0) - (+i.cost || 0)
      : (+i.ask || 0) - (+i.cost || 0);
    const profitTxt = profit >= 0 ? "+" + fmtShort(profit) : "-" + fmtShort(-profit);
    const profitCls = profit >= 0 ? "profit" : "loss";
    const thumb = i.photos && i.photos.length
      ? `<img class="ichip-photo" data-pid="${i.photos[0]}">`
      : `<div class="ichip-nophoto">◆</div>`;
    el.innerHTML = `
      ${thumb}
      <div class="ichip-main">
        <div class="ichip-name">${esc(i.brandName || "")} ${esc(i.name)}</div>
        <div class="ichip-meta">${esc(i.cat || "")} · ${esc(i.spec || "—")} · 收于 ${esc(i.buyDate || "—")}</div>
        <div class="ichip-prices">
          <span>成本 <b>${fmtShort(i.cost)}</b></span>
          ${i.status === "sold"
            ? `<span>售出 <b>${fmtShort(i.salePrice)}</b></span>`
            : (i.ask ? `<span>挂牌 <b>${fmtShort(i.ask)}</b></span>` : "")}
          <span class="${profitCls}">${profitTxt}</span>
        </div>
      </div>
      <div class="ichip-side">
        <span class="ichip-status ${i.status}">${i.status === "sold" ? "已售" : "在库"}</span>
        <span class="ichip-cond">${esc(i.cond || "")}</span>
      </div>`;
    $("#invList").appendChild(el);
  });

  list.forEach(i => {
    if (!(i.photos && i.photos.length)) return;
    DBX.get("photos", i.photos[0]).then(rec => {
      if (!rec) return;
      const img = $(`#invList img[data-pid="${i.photos[0]}"]`);
      if (img) { const u = URL.createObjectURL(rec); INV.urls.push(u); img.src = u; }
    });
  });
}

function setInvFilter(k) { INV.filter = k; renderInv(); }
function setInvSort(k) { INV.sort = k; renderInv(); }

/* ---------- 录入 / 编辑表单 ---------- */
function fillBrandSelect(cat) {
  const sel = $("#fBrand");
  const opts = BRANDS.filter(b => !cat || b.cat === cat).map(b => `<option value="${b.id}">${b.name}</option>`);
  sel.innerHTML = `<option value="">— 选择品牌 —</option>` + opts.join("") + `<option value="custom">其他 / 自定义…</option>`;
  toggleCustomBrand();
}
function toggleCustomBrand() {
  $("#fCustomBrandWrap").style.display = $("#fBrand").value === "custom" ? "block" : "none";
}

function fillMarketSelect() {
  const sel = $("#fMarket");
  const groups = {};
  PRODUCTS.forEach(p => (groups[p.cat] = groups[p.cat] || []).push(p));
  sel.innerHTML = `<option value="">— 不使用 —</option>` + Object.keys(groups).map(c =>
    `<optgroup label="${c}">` + groups[c].map(p =>
      `<option value="${p.id}">${brandOf(p.brand).name} ${p.name}</option>`).join("") + `</optgroup>`).join("");
}

function cancelItemForm() {
  /* 清理本次新增但未保存的照片，避免孤儿文件占用空间 */
  INV.newPhotoIds.forEach(pid => DBX.del("photos", pid));
  go("inv");
  $$(".tabbar .tab").forEach(t => t.classList.toggle("on", t.dataset.tab === "inv"));
  renderInv();
}

function updateSoldWrap() {
  $("#fSoldWrap").style.display = $("#fStatus").value === "sold" ? "block" : "none";
}

async function openItemForm(id) {
  INV.editingId = id || null;
  INV.formPhotos = [];
  INV.newPhotoIds = [];
  INV.removedPhotoIds = [];

  $("#fCat").onchange = () => fillBrandSelect($("#fCat").value);
  $("#fBrand").onchange = toggleCustomBrand;
  $("#fStatus").onchange = updateSoldWrap;
  $("#fMarket").onchange = onMarketPick;
  $("#fCat").value = "包袋";
  fillBrandSelect("包袋");
  fillMarketSelect();

  $("#itemFormTitle").textContent = id ? "编辑货品" : "收新货";
  $("#fDeleteBtn").style.display = id ? "inline-block" : "none";
  $("#fMarketHint").textContent = "";

  if (id) {
    const it = INV.items.find(x => x.id === id);
    if (it) {
      $("#fCat").value = it.cat || "包袋";
      fillBrandSelect(it.cat);
      $("#fBrand").value = it.brandId || "custom";
      if (!$("#fBrand").value) $("#fBrand").value = "custom";
      toggleCustomBrand();
      $("#fCustomBrand").value = it.brandId === "custom" ? (it.brandName || "") : "";
      $("#fName").value = it.name || "";
      $("#fSpec").value = it.spec || "";
      $("#fCond").value = it.cond || "95新";
      $("#fAttach").value = it.attach || "部分附件";
      $("#fCost").value = it.cost || "";
      $("#fAsk").value = it.ask || "";
      $("#fBuyDate").value = it.buyDate || "";
      $("#fStatus").value = it.status || "stock";
      $("#fSalePrice").value = it.salePrice || "";
      $("#fSaleDate").value = it.saleDate || "";
      $("#fNote").value = it.note || "";
      $("#fMarket").value = it.marketId || "";
      INV.formPhotos = (it.photos || []).slice();
    }
  } else {
    ["fName", "fSpec", "fCost", "fAsk", "fNote", "fCustomBrand", "fSalePrice"].forEach(k => $("#" + k).value = "");
    $("#fCond").value = "95新";
    $("#fAttach").value = "部分附件";
    $("#fStatus").value = "stock";
    $("#fBuyDate").value = new Date().toISOString().slice(0, 10);
    $("#fSaleDate").value = new Date().toISOString().slice(0, 10);
  }
  updateSoldWrap();
  await renderFormPhotos();
  go("itemform");
  $$(".tabbar .tab").forEach(t => t.classList.remove("on"));
  $(".app-body").scrollTop = 0;
}

function onMarketPick() {
  const id = $("#fMarket").value;
  const hint = $("#fMarketHint");
  if (!id) { hint.textContent = ""; return; }
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  $("#fCat").value = p.cat;
  fillBrandSelect(p.cat);
  $("#fBrand").value = p.brand;
  toggleCustomBrand();
  $("#fName").value = p.name;
  $("#fSpec").value = p.spec;
  $("#fAsk").value = Math.round(p.high * 1.12 / 100) * 100;
  hint.textContent = `行情参考：95新全套回收 ${fmtShort(p.low)}~${fmtShort(p.high)} · 保值率 ${p.ret}%。挂牌价已按回收上沿 +12% 预填，可自行调整。`;
}

/* ---------- 照片 ---------- */
function compressImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 900;
      let w = img.width, h = img.height;
      if (Math.max(w, h) > max) {
        const k = max / Math.max(w, h);
        w = Math.round(w * k); h = Math.round(h * k);
      }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error("compress fail")), "image/jpeg", 0.72);
    };
    img.onerror = () => rej(new Error("img fail"));
    img.src = url;
  });
}

async function addPhotos(input) {
  for (const f of input.files) {
    try {
      const blob = await compressImage(f);
      const pid = uid();
      await DBX.put("photos", blob, pid);
      INV.formPhotos.push(pid);
      INV.newPhotoIds.push(pid);
    } catch (e) { console.warn("photo skip", e); }
  }
  input.value = "";
  renderFormPhotos();
}

function removePhoto(idx) {
  const pid = INV.formPhotos[idx];
  if (pid === undefined) return;
  INV.formPhotos.splice(idx, 1);
  INV.removedPhotoIds.push(pid);
  renderFormPhotos();
}

async function renderFormPhotos() {
  const row = $("#photoRow");
  row.innerHTML = "";
  for (const pid of INV.formPhotos) {
    const rec = await DBX.get("photos", pid);
    const wrap = document.createElement("div");
    wrap.className = "photo-thumb";
    if (rec) {
      const img = document.createElement("img");
      const u = URL.createObjectURL(rec);
      INV.urls.push(u);
      img.src = u;
      wrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "ichip-nophoto";
      ph.style.width = ph.style.height = "64px";
      ph.textContent = "◆";
      wrap.appendChild(ph);
    }
    const btn = document.createElement("button");
    btn.className = "ph-del"; btn.textContent = "×";
    btn.onclick = e => { e.stopPropagation(); removePhoto(INV.formPhotos.indexOf(pid)); };
    wrap.appendChild(btn);
    row.appendChild(wrap);
  }
}

/* ---------- 保存 / 删除 ---------- */
async function saveItem() {
  const name = $("#fName").value.trim();
  const cost = parseFloat($("#fCost").value);
  if (!name) return toast("请填写款式名称");
  if (isNaN(cost) || cost < 0) return toast("请填写有效的成本价");

  const brandId = $("#fBrand").value;
  const brandName = brandId === "custom" ? $("#fCustomBrand").value.trim() : (brandOf(brandId).name || brandId);

  const old = INV.editingId ? INV.items.find(x => x.id === INV.editingId) : null;
  const item = {
    id: INV.editingId || uid(),
    cat: $("#fCat").value,
    brandId: brandId,
    brandName: brandName || "未分类",
    name,
    spec: $("#fSpec").value.trim(),
    cond: $("#fCond").value,
    attach: $("#fAttach").value,
    cost,
    ask: parseFloat($("#fAsk").value) || 0,
    buyDate: $("#fBuyDate").value || new Date().toISOString().slice(0, 10),
    status: $("#fStatus").value,
    salePrice: parseFloat($("#fSalePrice").value) || 0,
    saleDate: $("#fSaleDate").value || "",
    note: $("#fNote").value.trim(),
    marketId: $("#fMarket").value || "",
    photos: INV.formPhotos.slice(),
    updated: Date.now(),
    created: old ? old.created : Date.now()
  };

  await DBX.put("items", item);
  for (const pid of INV.removedPhotoIds) await DBX.del("photos", pid);

  toast(INV.editingId ? "已保存 ✓" : "已入库 ✓");
  await loadInv();
  go("inv");
  $$(".tabbar .tab").forEach(t => t.classList.toggle("on", t.dataset.tab === "inv"));
  renderInv();
}

async function deleteItem() {
  if (!INV.editingId) return;
  const it = INV.items.find(x => x.id === INV.editingId);
  if (!it) return;
  if (!confirm(`确定删除「${it.brandName || ""} ${it.name}」？删除后不可恢复。`)) return;
  for (const pid of (it.photos || [])) await DBX.del("photos", pid);
  await DBX.del("items", INV.editingId);
  toast("已删除");
  await loadInv();
  go("inv");
  $$(".tabbar .tab").forEach(t => t.classList.toggle("on", t.dataset.tab === "inv"));
  renderInv();
}

/* ---------- 导出 / 导入 ---------- */
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function invExport() {
  const data = { app: "sheyan", version: 1, exportedAt: new Date().toISOString(), items: INV.items };
  download(`sheyan-inventory-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
  toast("已导出（不含照片）");
}

function invImportFile(input) {
  const f = input.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = async () => {
    try {
      const data = JSON.parse(rd.result);
      const items = data.items || [];
      if (!items.length) return toast("文件中没有库存数据");
      if (!confirm(`导入 ${items.length} 件货品，将覆盖当前 ${INV.items.length} 件，继续？`)) return;
      await DBX.clear("items");
      for (const it of items) await DBX.put("items", it);
      await loadInv();
      renderInv();
      toast("导入完成 ✓");
    } catch (e) { toast("文件解析失败"); }
    input.value = "";
  };
  rd.readAsText(f);
}

/* ---------- GitHub 云备份 ---------- */
function ghCfg() {
  return {
    owner: ($("#ghOwner").value || "").trim(),
    repo: ($("#ghRepo").value || "").trim(),
    pat: ($("#ghPat").value || "").trim()
  };
}
function ghSaveCfg() {
  localStorage.setItem("sheyan_gh", JSON.stringify(ghCfg()));
}
function ghLoadCfg() {
  try {
    const c = JSON.parse(localStorage.getItem("sheyan_gh") || "{}");
    if (c.owner) $("#ghOwner").value = c.owner;
    if (c.repo) $("#ghRepo").value = c.repo;
    if (c.pat) $("#ghPat").value = c.pat;
  } catch (e) {}
}
function ghStatus(msg) { $("#ghStatus").textContent = msg; }

function ghB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}
function ghUnb64(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function ghApi(path, opts) {
  const { pat } = ghCfg();
  const { owner, repo } = ghCfg();
  return fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`, Object.assign({
    headers: {
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github+json"
    }
  }, opts || {}));
}

async function ghBackup() {
  ghSaveCfg();
  const { owner, repo, pat } = ghCfg();
  if (!owner || !repo || !pat) return toast("请先填写用户名 / 仓库 / 令牌");
  if (!INV.items.length) return toast("当前库存为空");
  ghStatus("正在备份…");
  try {
    const json = JSON.stringify({ app: "sheyan", version: 1, exportedAt: new Date().toISOString(), items: INV.items }, null, 2);
    let sha;
    const head = await ghApi("contents/inventory-backup.json");
    if (head.status === 200) sha = (await head.json()).sha;
    const put = await ghApi("contents/inventory-backup.json", {
      method: "PUT",
      body: JSON.stringify({
        message: `库存备份 ${new Date().toLocaleString("zh-CN")}`,
        content: ghB64(json),
        ...(sha ? { sha } : {})
      })
    });
    if (put.status === 200 || put.status === 201) {
      ghStatus(`✓ 备份成功：${INV.items.length} 件货品已写入 ${owner}/${repo}（${new Date().toLocaleTimeString("zh-CN")}）`);
      toast("备份成功 ✓");
    } else {
      const err = await put.json().catch(() => ({}));
      ghStatus(`✗ 备份失败（HTTP ${put.status}）：${err.message || "请检查仓库名与令牌权限（需 Contents 读写）"}`);
    }
  } catch (e) {
    ghStatus("✗ 网络错误：" + e.message);
  }
}

async function ghRestore() {
  ghSaveCfg();
  const { owner, repo, pat } = ghCfg();
  if (!owner || !repo || !pat) return toast("请先填写用户名 / 仓库 / 令牌");
  ghStatus("正在读取云端备份…");
  try {
    const res = await ghApi("contents/inventory-backup.json");
    if (res.status === 404) { ghStatus("✗ 云端还没有备份文件"); return; }
    if (res.status !== 200) { ghStatus(`✗ 读取失败（HTTP ${res.status}），请检查令牌`); return; }
    const data = await res.json();
    const payload = JSON.parse(ghUnb64(data.content));
    const items = payload.items || [];
    if (!confirm(`云端备份共 ${items.length} 件（${(payload.exportedAt || "").slice(0, 10)}），将覆盖本地 ${INV.items.length} 件，继续？`)) return;
    await DBX.clear("items");
    for (const it of items) await DBX.put("items", it);
    await loadInv();
    renderInv();
    ghStatus(`✓ 已恢复 ${items.length} 件货品`);
    toast("恢复完成 ✓");
  } catch (e) {
    ghStatus("✗ 网络错误：" + e.message);
  }
}

/* ---------- 模块初始化 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadInv().then(() => ghLoadCfg()).catch(() => {});
});
