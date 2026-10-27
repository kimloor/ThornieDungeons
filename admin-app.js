const SERVER_URL = "https://thornie-dungeons-api.ekqtjl.workers.dev";
const ADMIN_SESSION_STORAGE = "thornie-admin-session";

// Static fallback monster list — kept in sync manually with ENEMY_POOL/BOSS_POOL in
// src/systems/pets.js. Only used to populate the dropdown; actual stat values always come
// from getGameConfig (falls back to these defaults — hpMult/atkMult=1, defBonus=0,
// goldMult/xpMult=1 — when a monster has no override yet).
const STATIC_MONSTERS = [
  { id: "jelly_slime", name: "Jelly Slime", isBoss: false },
  { id: "spore_cap", name: "Spore Cap", isBoss: false },
  { id: "tusky_boar", name: "Tusky Boar", isBoss: false },
  { id: "bramble_bat", name: "Bramble Bat", isBoss: false },
  { id: "bone_rattler", name: "Bone Rattler", isBoss: false },
  { id: "sandy_crab", name: "Sandy Crab", isBoss: false },
  { id: "moss_king", name: "Moss King", isBoss: true },
  { id: "ember_drake", name: "Ember Drake", isBoss: true },
  { id: "frost_warden", name: "Frost Warden", isBoss: true }
];

function adminToken() { return sessionStorage.getItem(ADMIN_SESSION_STORAGE) || ""; }

// W2-C: no HTML string is ever built from data. Every dynamic value reaches the DOM through
// textContent / value / DOM construction, so nothing needs escaping and the CSP can stay strict.
function el(tag, props, ...children) {
  const node = document.createElement(tag);
  const p = props || {};
  Object.keys(p).forEach(k => {
    if (k === "className") node.className = p[k];
    else if (k === "text") node.textContent = String(p[k] ?? "");
    else node[k] = p[k];
  });
  children.forEach(c => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}
function cell(value, className) {
  return el("td", className ? { className, text: value } : { text: value });
}

function setAdminUi(auth) {
  const loggedIn = !!auth?.admin;
  document.getElementById("adminLoginGate").style.display = loggedIn ? "none" : "flex";
  document.getElementById("adminApp").style.display = loggedIn ? "block" : "none";
  if (loggedIn) {
    const expiry = auth.expiresAt ? new Date(auth.expiresAt).toLocaleString() : "";
    document.getElementById("adminIdentity").textContent =
      `${auth.admin.playerId} · ${auth.admin.role}${expiry ? ` · หมดอายุ ${expiry}` : ""}`;
  } else {
    document.getElementById("adminIdentity").textContent = "";
  }
}

function clearAdminSession(message = "") {
  sessionStorage.removeItem(ADMIN_SESSION_STORAGE);
  setAdminUi(null);
  if (message) {
    const msg = document.getElementById("adminLoginMsg");
    msg.textContent = message;
    msg.className = "msg err";
  }
}

function authHeaders() {
  const token = adminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SERVER_URL}?${qs}`, { headers: authHeaders() });
  const data = await res.json();
  if (["admin_session_invalid", "admin_session_expired", "admin_session_revoked"].includes(data.error)) {
    clearAdminSession("เซสชัน Admin หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
  }
  return data;
}
async function apiPost(body) {
  const res = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (["admin_session_invalid", "admin_session_expired", "admin_session_revoked"].includes(data.error)) {
    clearAdminSession("เซสชัน Admin หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
  }
  return data;
}

document.getElementById("adminLoginForm").onsubmit = async (event) => {
  event.preventDefault();
  const id = document.getElementById("adminLoginId").value.trim();
  const passwordInput = document.getElementById("adminLoginPassword");
  const password = passwordInput.value;
  const msg = document.getElementById("adminLoginMsg");
  msg.textContent = "กำลังเข้าสู่ระบบ...";
  msg.className = "msg";
  try {
    const res = await apiPost({ action: "adminLogin", id, password });
    passwordInput.value = "";
    if (res.error) {
      msg.textContent = res.error === "admin_rate_limited"
        ? `ลองเข้าสู่ระบบถี่เกินไป กรุณารอ ${Number(res.retryAfter) || 1} วินาที`
        : "Player ID หรือ Password ไม่ถูกต้อง หรือบัญชีนี้ไม่มีสิทธิ์ Admin";
      msg.className = "msg err";
      return;
    }
    sessionStorage.setItem(ADMIN_SESSION_STORAGE, res.adminSessionToken);
    msg.textContent = "";
    setAdminUi(res);
    await loadDashboard();
  } catch (error) {
    passwordInput.value = "";
    msg.textContent = "เชื่อมต่อ Admin API ไม่สำเร็จ";
    msg.className = "msg err";
  }
};

document.getElementById("adminLogoutBtn").onclick = async () => {
  try { await apiPost({ action: "adminLogout" }); } catch (error) {}
  clearAdminSession();
};

async function restoreAdminSession() {
  if (!adminToken()) {
    setAdminUi(null);
    return;
  }
  try {
    const res = await apiGet({ action: "adminValidateSession" });
    if (res.error) {
      clearAdminSession();
      return;
    }
    setAdminUi(res);
    await loadDashboard();
  } catch (error) {
    // Network failure is not proof that the Admin session is invalid.
    // Keep the session token so a transient outage does not force re-login.
    setAdminUi(null);
    const msg = document.getElementById("adminLoginMsg");
    msg.textContent = "ตรวจสอบเซสชัน Admin ไม่สำเร็จ — session เดิมยังถูกเก็บไว้ ลองรีเฟรชอีกครั้ง";
    msg.className = "msg err";
  }
}

// ---------- tabs ----------
document.querySelectorAll(".tab").forEach(t => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll("main > section").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById("tab-" + t.dataset.tab).classList.add("active");
    if (t.dataset.tab === "dashboard") void loadDashboard();
    if (t.dataset.tab === "players") setTimeout(() => document.getElementById("playerSearchInput")?.focus(), 0);
  };
});

// ==================================================================
// DASHBOARD + PLAYER VIEWER — ADMIN V2 PHASE 1 (READ ONLY)
// ==================================================================
async function loadDashboard() {
  const msg = document.getElementById("dashboardMsg");
  msg.textContent = "กำลังโหลด...";
  msg.className = "msg";
  const res = await apiGet({ action: "getGameStats" });
  if (res.error) {
    msg.textContent = "โหลด Dashboard ไม่สำเร็จ: " + res.error;
    msg.className = "msg err";
    return;
  }
  const stats = res.stats || {};
  document.getElementById("statPlayers").textContent = Number(stats.players || 0).toLocaleString();
  document.getElementById("statCharacters").textContent = Number(stats.characters || 0).toLocaleString();
  document.getElementById("statItems").textContent = Number(stats.items || 0).toLocaleString();
  document.getElementById("statActiveRuns").textContent = Number(stats.activeRuns || 0).toLocaleString();
  document.getElementById("statAvgLevel").textContent = Number(stats.avgLevel || 0).toLocaleString();
  document.getElementById("statMaxFloor").textContent = Number(stats.maxFloor || 0).toLocaleString();
  msg.textContent = "อัปเดตแล้ว";
  msg.className = "msg ok";
}
document.getElementById("reloadDashboardBtn").onclick = () => void loadDashboard();

function renderPlayerSearchResults(rows) {
  const tbody = document.querySelector("#playerSearchTable tbody");
  tbody.replaceChildren();
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const viewBtn = el("button", { className: "viewPlayerBtn", text: "ดู" });
    viewBtn.onclick = () => void openPlayerViewer(row.playerId);
    tr.append(
      cell(row.playerId, "mono"),
      el("td", {}, String(row.characterNames || "—") + " ", el("span", { className: "pill", text: row.characterCount || 0 })),
      cell(row.maxLevel || 0),
      cell(row.maxFloor || 0),
      el("td", {}, viewBtn)
    );
    tbody.appendChild(tr);
  });
}

async function searchAdminPlayers() {
  const input = document.getElementById("playerSearchInput");
  const msg = document.getElementById("playerSearchMsg");
  const query = input.value.trim();
  if (!query) {
    msg.textContent = "กรอก Player ID หรือชื่อตัวละคร";
    msg.className = "msg err";
    renderPlayerSearchResults([]);
    return;
  }
  msg.textContent = "กำลังค้นหา...";
  msg.className = "msg";
  const res = await apiGet({ action: "adminSearchPlayers", query, limit: 50 });
  if (res.error) {
    msg.textContent = "ค้นหาไม่สำเร็จ: " + res.error;
    msg.className = "msg err";
    renderPlayerSearchResults([]);
    return;
  }
  const rows = Array.isArray(res.results) ? res.results : [];
  renderPlayerSearchResults(rows);
  msg.textContent = rows.length ? `พบ ${rows.length} บัญชี` : "ไม่พบผู้เล่น";
  msg.className = rows.length ? "msg ok" : "msg";
}
document.getElementById("playerSearchBtn").onclick = () => void searchAdminPlayers();
document.getElementById("playerSearchInput").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); void searchAdminPlayers(); }
});

function renderPlayerViewer(res) {
  const card = document.getElementById("playerViewerCard");
  const player = res.player || {};
  const characters = Array.isArray(res.characters) ? res.characters : [];
  const items = Array.isArray(res.items) ? res.items : [];
  card.style.display = "block";

  const meta = document.getElementById("playerViewerMeta");
  meta.replaceChildren();
  [
    `Player: ${player.id || "—"}`,
    `Diamonds: ${Number(player.diamonds) || 0}`,
    `Characters: ${characters.length}`,
    `Items: ${items.length}`
  ].forEach(text => {
    const span = document.createElement("span");
    span.textContent = text;
    meta.appendChild(span);
  });

  const charBody = document.querySelector("#playerCharacterTable tbody");
  charBody.replaceChildren();
  characters.forEach(ch => {
    const tr = document.createElement("tr");
    [ch.character_id, ch.name || "—", Number(ch.level) || 1, Number(ch.unlocked_floor) || 1, Number(ch.gold) || 0].forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = String(value);
      if (index === 0) td.className = "mono";
      tr.appendChild(td);
    });
    charBody.appendChild(tr);
  });

  const itemBody = document.querySelector("#playerItemTable tbody");
  itemBody.replaceChildren();
  items.forEach(item => {
    const tr = document.createElement("tr");
    const state = Number(item.equipped) === 1 ? "Equipped" : String(item.inventory_slot || "Inventory");
    [item.item_id, item.name || "—", item.slot_type || "—", item.rarity || "—", Number(item.enhance_level) || 0, state].forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = String(value);
      if (index === 0) td.className = "mono";
      tr.appendChild(td);
    });
    itemBody.appendChild(tr);
  });
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function openPlayerViewer(playerId) {
  const msg = document.getElementById("playerSearchMsg");
  msg.textContent = "กำลังโหลด Player Viewer...";
  msg.className = "msg";
  const res = await apiGet({ action: "getPlayer", id: playerId });
  if (res.error) {
    msg.textContent = "โหลด Player Viewer ไม่สำเร็จ: " + res.error;
    msg.className = "msg err";
    return;
  }
  renderPlayerViewer(res);
  msg.textContent = "โหลด Player Viewer แล้ว";
  msg.className = "msg ok";
}

// ==================================================================
// RECIPES TAB
// ==================================================================
let editingRecipeId = null;
let junkInfoCache = []; // shared with Junk Info tab — [{junk_id, name, icon}]

async function loadJunkInfoList() {
    const res = await apiGet({ action: "getSheet", sheet: "junk_info" });
  if (!res.error) junkInfoCache = res.rows || [];
  return junkInfoCache;
}

function junkSelectOptions(selected) {
  const ids = new Set(["gold"]);
  junkInfoCache.forEach(j => ids.add(j.junk_id));
  if (selected) ids.add(selected);
  return Array.from(ids).sort().map(id => {
    const match = junkInfoCache.find(j => j.junk_id === id);
    const label = id === "gold" ? "gold (ทอง)" : (match ? `${id} (${match.name})` : id);
    const opt = el("option", { value: String(id), text: label });
    if (id === selected) opt.selected = true;
    return opt;
  });
}

function materialRow(key = "", qty = "") {
  const div = document.createElement("div");
  div.className = "matRow";
  const select = el("select", { className: "matKey" });
  junkSelectOptions(key).forEach(o => select.appendChild(o));
  const qtyInput = el("input", { className: "matQty", type: "number", placeholder: "จำนวน", value: String(qty ?? "") });
  qtyInput.style.maxWidth = "100px";
  const removeBtn = el("button", { type: "button", text: "ลบ" });
  removeBtn.onclick = () => div.remove();
  div.append(select, qtyInput, removeBtn);
  return div;
}
document.getElementById("addMaterialRowBtn").onclick = () => {
  document.getElementById("materialRows").appendChild(materialRow());
};

function readMaterialsFromForm() {
  const out = {};
  document.querySelectorAll("#materialRows .matRow").forEach(row => {
    const k = row.querySelector(".matKey").value.trim();
    const v = Number(row.querySelector(".matQty").value);
    if (k && v > 0) out[k] = v;
  });
  return out;
}

function resetRecipeForm() {
  editingRecipeId = null;
  document.getElementById("recipeFormTitle").textContent = "เพิ่ม Recipe ใหม่";
  document.getElementById("f_recipeId").value = "";
  document.getElementById("f_recipeId").disabled = false;
  document.getElementById("f_type").value = "helmet";
  document.getElementById("f_name").value = "";
  document.getElementById("f_setId").value = "azure";
  document.getElementById("f_empowerSlotCount").value = 5;
  document.getElementById("materialRows").replaceChildren();
  document.getElementById("materialRows").appendChild(materialRow());
  document.getElementById("cancelRecipeEditBtn").style.display = "none";
}
resetRecipeForm();
document.getElementById("cancelRecipeEditBtn").onclick = resetRecipeForm;

let recipesCache = [];
async function loadRecipes() {
  const msg = document.getElementById("recipeMsg");
    await loadJunkInfoList(); // needed to populate the materials dropdown options
  const res = await apiGet({ action: "getSheet", sheet: "recipes" });
  if (res.error) { msg.textContent = "โหลดไม่สำเร็จ: " + res.error; msg.className = "msg err"; return; }
  recipesCache = (res.rows || []).map(r => {
    let def = {}, materials = {};
    try { def = JSON.parse(r.result_item_def || "{}"); } catch (e) {}
    try { materials = JSON.parse(r.materials_json || "{}"); } catch (e) {}
    return { recipeId: r.recipe_id, ...def, materials };
  });
  renderRecipeTable();
  resetRecipeForm(); // rebuild the empty form's material row now that junk options are loaded
}
document.getElementById("reloadRecipesBtn").onclick = loadRecipes;

function renderRecipeTable() {
  const tbody = document.querySelector("#recipeTable tbody");
  tbody.replaceChildren();
  document.getElementById("recipeEmptyMsg").style.display = recipesCache.length ? "none" : "block";
  recipesCache.forEach(r => {
    const tr = document.createElement("tr");
    const matStr = Object.entries(r.materials || {}).map(([k, v]) => `${k}:${v}`).join(", ");
    const editBtn = el("button", { className: "edit", text: "แก้" });
    const delBtn = el("button", { className: "del", text: "ลบ" });
    editBtn.onclick = () => editRecipe(r);
    delBtn.onclick = () => deleteRecipe(r.recipeId);
    tr.append(cell(r.recipeId), cell(r.type || ""), cell(r.name || ""), cell(r.setId || ""), cell(matStr), el("td", { className: "rowActions" }, editBtn, delBtn));
    tbody.appendChild(tr);
  });
}

function editRecipe(r) {
  editingRecipeId = r.recipeId;
  document.getElementById("recipeFormTitle").textContent = "แก้ไข: " + r.recipeId;
  document.getElementById("f_recipeId").value = r.recipeId;
  document.getElementById("f_recipeId").disabled = true;
  document.getElementById("f_type").value = r.type || "helmet";
  document.getElementById("f_name").value = r.name || "";
  document.getElementById("f_setId").value = r.setId || "azure";
  document.getElementById("f_empowerSlotCount").value = r.empowerSlotCount || 5;
  const rows = document.getElementById("materialRows");
  rows.replaceChildren();
  Object.entries(r.materials || {}).forEach(([k, v]) => rows.appendChild(materialRow(k, v)));
  if (!rows.children.length) rows.appendChild(materialRow());
  document.getElementById("cancelRecipeEditBtn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("saveRecipeBtn").onclick = async () => {
  const msg = document.getElementById("recipeMsg");
  const recipeId = document.getElementById("f_recipeId").value.trim();
  const type = document.getElementById("f_type").value;
  const name = document.getElementById("f_name").value.trim();
  const setId = document.getElementById("f_setId").value.trim() || "azure";
  const empowerSlotCount = Number(document.getElementById("f_empowerSlotCount").value) || 5;
  const materials = readMaterialsFromForm();
  if (!recipeId || !name || !Object.keys(materials).length) {
    msg.textContent = "กรอก recipe_id, ชื่อ, และวัตถุดิบอย่างน้อย 1 อย่าง";
    msg.className = "msg err";
    return;
  }
  const res = await apiPost({ action: "adminUpsertRecipe", recipeId, type, name, setId, empowerSlotCount, materials });
  if (res.error) { msg.textContent = "บันทึกไม่สำเร็จ: " + res.error; msg.className = "msg err"; return; }
  msg.textContent = "บันทึกแล้ว ✓"; msg.className = "msg ok";
  resetRecipeForm();
  loadRecipes();
};

async function deleteRecipe(recipeId) {
  if (!confirm(`ลบ recipe "${recipeId}" ?`)) return;
  const res = await apiPost({ action: "adminDeleteRecipe", recipeId });
  if (res.error) { alert("ลบไม่สำเร็จ: " + res.error); return; }
  loadRecipes();
}

// ==================================================================
// MONSTER DROPS TAB
// ==================================================================
let gameConfigCache = null;
let monsterLootCache = [];
let currentMonsterId = null;

function populateMonsterSelect() {
  const sel = document.getElementById("monsterSelect");
  sel.replaceChildren();
  STATIC_MONSTERS.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.name}${m.isBoss ? " (Boss)" : ""} — ${m.id}`;
    sel.appendChild(opt);
  });
}
populateMonsterSelect();

document.getElementById("monsterSelect").onchange = renderMonsterSection;
document.getElementById("reloadMonsterDataBtn").onclick = async () => {
    const [cfgRes, lootRes] = await Promise.all([
    apiGet({ action: "getGameConfig" }),
    apiGet({ action: "getSheet", sheet: "monster_loot" })
  ]);
  if (lootRes.error) { alert("โหลด monster_loot ไม่สำเร็จ: " + lootRes.error); return; }
  gameConfigCache = cfgRes || {};
  monsterLootCache = lootRes.rows || [];
  renderMonsterSection();
};

function findMonsterConfig(id) {
  const list = (gameConfigCache && Array.isArray(gameConfigCache.monsters)) ? gameConfigCache.monsters : [];
  return list.find(m => m.id === id) || null;
}

function renderMonsterSection() {
  currentMonsterId = document.getElementById("monsterSelect").value;
  document.getElementById("monsterIdPill").textContent = currentMonsterId;
  const cfg = findMonsterConfig(currentMonsterId);
  document.getElementById("s_hpMult").value = cfg ? cfg.hpMult : 1;
  document.getElementById("s_atkMult").value = cfg ? cfg.atkMult : 1;
  document.getElementById("s_defBonus").value = cfg ? cfg.defBonus : 0;
  document.getElementById("s_goldMult").value = cfg ? cfg.goldMult : 1;
  document.getElementById("s_xpMult").value = cfg ? cfg.xpMult : 1;
  renderGearTable();
  renderJunkTable();
}

document.getElementById("saveStatsBtn").onclick = async () => {
  const msg = document.getElementById("statsMsg");
  if (!gameConfigCache) { msg.textContent = "กด \"โหลดข้อมูลมอนสเตอร์ทั้งหมด\" ก่อน"; msg.className = "msg err"; return; }
  const list = Array.isArray(gameConfigCache.monsters) ? [...gameConfigCache.monsters] : STATIC_MONSTERS.map(m => ({ id: m.id, name: m.name, isBoss: m.isBoss, color: "#7ED9A8" }));
  const idx = list.findIndex(m => m.id === currentMonsterId);
  const staticMeta = STATIC_MONSTERS.find(m => m.id === currentMonsterId);
  const updated = {
    id: currentMonsterId,
    name: (idx >= 0 && list[idx].name) || (staticMeta && staticMeta.name) || currentMonsterId,
    color: (idx >= 0 && list[idx].color) || "#7ED9A8",
    isBoss: (staticMeta && staticMeta.isBoss) || false,
    hpMult: Number(document.getElementById("s_hpMult").value) || 1,
    atkMult: Number(document.getElementById("s_atkMult").value) || 1,
    defBonus: Number(document.getElementById("s_defBonus").value) || 0,
    goldMult: Number(document.getElementById("s_goldMult").value) || 1,
    xpMult: Number(document.getElementById("s_xpMult").value) || 1
  };
  if (idx >= 0) list[idx] = updated; else list.push(updated);
  const res = await apiPost({ action: "setGameConfigItem", key: "monsters", value: list });
  if (res.error) { msg.textContent = "บันทึกไม่สำเร็จ: " + res.error; msg.className = "msg err"; return; }
  gameConfigCache.monsters = list;
  msg.textContent = "บันทึกแล้ว ✓ (มีผลตอน client โหลด config รอบถัดไป)"; msg.className = "msg ok";
};

function renderGearTable() {
  const tbody = document.querySelector("#gearTable tbody");
  tbody.replaceChildren();
  const rows = monsterLootCache.filter(r => r.monster_id === currentMonsterId && r.kind === "gear");
  const totalWeight = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 1;
  rows.forEach(r => {
    const pct = ((Number(r.weight) || 0) / totalWeight * 100).toFixed(1);
    const tr = document.createElement("tr");
    const delBtn = el("button", { className: "del", text: "ลบ" });
    delBtn.onclick = () => deleteLootEntry(r.entry_id, "gear");
    tr.append(cell(r.item_type || ""), cell(r.rarity || "(ตามระบบเดิม)"), cell(r.weight), cell(`${pct}%`), el("td", { className: "rowActions" }, delBtn));
    tbody.appendChild(tr);
  });
}
function renderJunkTable() {
  const tbody = document.querySelector("#junkTable tbody");
  tbody.replaceChildren();
  const rows = monsterLootCache.filter(r => r.monster_id === currentMonsterId && r.kind === "junk");
  rows.forEach(r => {
    const tr = document.createElement("tr");
    const delBtn = el("button", { className: "del", text: "ลบ" });
    delBtn.onclick = () => deleteLootEntry(r.entry_id, "junk");
    tr.append(cell(r.junk_id), cell(`${r.qty_min}-${r.qty_max}`), cell(`${Math.round((Number(r.drop_chance) || 0) * 100)}%`), el("td", { className: "rowActions" }, delBtn));
    tbody.appendChild(tr);
  });
}

document.getElementById("addGearBtn").onclick = async () => {
  const msg = document.getElementById("gearMsg");
  if (!currentMonsterId) return;
  const entry = {
    monsterId: currentMonsterId,
    kind: "gear",
    itemType: document.getElementById("g_itemType").value,
    rarity: document.getElementById("g_rarity").value || null,
    weight: Number(document.getElementById("g_weight").value) || 1
  };
  const res = await apiPost({ action: "adminUpsertMonsterLootEntry", entry });
  if (res.error) { msg.textContent = "เพิ่มไม่สำเร็จ: " + res.error; msg.className = "msg err"; return; }
  msg.textContent = "เพิ่มแล้ว ✓"; msg.className = "msg ok";
  monsterLootCache.push({ entry_id: res.entryId, monster_id: currentMonsterId, kind: "gear", item_type: entry.itemType, rarity: entry.rarity, weight: entry.weight });
  renderGearTable();
};

document.getElementById("addJunkBtn").onclick = async () => {
  const msg = document.getElementById("junkMsg");
  if (!currentMonsterId) return;
  const junkId = document.getElementById("j_junkId").value.trim();
  if (!junkId) { msg.textContent = "กรอก junkId ก่อน"; msg.className = "msg err"; return; }
  const entry = {
    monsterId: currentMonsterId,
    kind: "junk",
    junkId,
    qtyMin: Number(document.getElementById("j_qtyMin").value) || 1,
    qtyMax: Number(document.getElementById("j_qtyMax").value) || 1,
    dropChance: Number(document.getElementById("j_dropChance").value)
  };
  entry.dropChance = isNaN(entry.dropChance) ? 1 : entry.dropChance;
  const res = await apiPost({ action: "adminUpsertMonsterLootEntry", entry });
  if (res.error) { msg.textContent = "เพิ่มไม่สำเร็จ: " + res.error; msg.className = "msg err"; return; }
  msg.textContent = "เพิ่มแล้ว ✓"; msg.className = "msg ok";
  monsterLootCache.push({ entry_id: res.entryId, monster_id: currentMonsterId, kind: "junk", junk_id: junkId, qty_min: entry.qtyMin, qty_max: entry.qtyMax, drop_chance: entry.dropChance });
  renderJunkTable();
};

async function deleteLootEntry(entryId, kind) {
  if (!confirm("ลบแถวนี้?")) return;
  const res = await apiPost({ action: "adminDeleteMonsterLootEntry", entryId });
  if (res.error) { alert("ลบไม่สำเร็จ: " + res.error); return; }
  monsterLootCache = monsterLootCache.filter(r => r.entry_id !== entryId);
  if (kind === "gear") renderGearTable(); else renderJunkTable();
}

// ==================================================================
// JUNK INFO TAB
// ==================================================================
let editingJunkId = null;

function resetJunkInfoForm() {
  editingJunkId = null;
  document.getElementById("junkInfoFormTitle").textContent = "เพิ่มวัตถุดิบใหม่";
  document.getElementById("ji_junkId").value = "";
  document.getElementById("ji_junkId").disabled = false;
  document.getElementById("ji_name").value = "";
  document.getElementById("ji_icon").value = "";
  document.getElementById("cancelJunkInfoEditBtn").style.display = "none";
}
document.getElementById("cancelJunkInfoEditBtn").onclick = resetJunkInfoForm;

function renderJunkInfoTable() {
  const tbody = document.querySelector("#junkInfoTable tbody");
  tbody.replaceChildren();
  document.getElementById("junkInfoEmptyMsg").style.display = junkInfoCache.length ? "none" : "block";
  junkInfoCache.forEach(j => {
    const tr = document.createElement("tr");
    const editBtn = el("button", { className: "edit", text: "แก้" });
    const delBtn = el("button", { className: "del", text: "ลบ" });
    editBtn.onclick = () => editJunkInfo(j);
    delBtn.onclick = () => deleteJunkInfo(j.junk_id);
    tr.append(cell(j.junk_id), cell(j.name), cell(j.icon), el("td", { className: "rowActions" }, editBtn, delBtn));
    tbody.appendChild(tr);
  });
}

function editJunkInfo(j) {
  editingJunkId = j.junk_id;
  document.getElementById("junkInfoFormTitle").textContent = "แก้ไข: " + j.junk_id;
  document.getElementById("ji_junkId").value = j.junk_id;
  document.getElementById("ji_junkId").disabled = true;
  document.getElementById("ji_name").value = j.name;
  document.getElementById("ji_icon").value = j.icon;
  document.getElementById("cancelJunkInfoEditBtn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("reloadJunkInfoBtn").onclick = async () => {
  const msg = document.getElementById("junkInfoMsg");
    await loadJunkInfoList();
  renderJunkInfoTable();
};

document.getElementById("saveJunkInfoBtn").onclick = async () => {
  const msg = document.getElementById("junkInfoMsg");
  const junkId = document.getElementById("ji_junkId").value.trim();
  const name = document.getElementById("ji_name").value.trim();
  const icon = document.getElementById("ji_icon").value.trim() || "📦";
  if (!junkId || !name) { msg.textContent = "กรอก junkId และชื่อก่อน"; msg.className = "msg err"; return; }
  const res = await apiPost({ action: "adminUpsertJunkInfo", junkId, name, icon });
  if (res.error) { msg.textContent = "บันทึกไม่สำเร็จ: " + res.error; msg.className = "msg err"; return; }
  msg.textContent = "บันทึกแล้ว ✓"; msg.className = "msg ok";
  resetJunkInfoForm();
  await loadJunkInfoList();
  renderJunkInfoTable();
};

async function deleteJunkInfo(junkId) {
  if (!confirm(`ลบวัตถุดิบ "${junkId}" ? (recipe ที่ใช้วัตถุดิบนี้อยู่จะยังอ้างอิง junkId เดิม แค่ไม่มีชื่อ/icon ให้แสดงในเกม)`)) return;
  const res = await apiPost({ action: "adminDeleteJunkInfo", junkId });
  if (res.error) { alert("ลบไม่สำเร็จ: " + res.error); return; }
  await loadJunkInfoList();
  renderJunkInfoTable();
}
