/**
 * MAPLE DUNGEON — Cloud Save Backend (Normalized Schema)
 * ------------------------------------------------
 * ออกแบบให้แยกตารางตามชนิดข้อมูล (players / progress / run_state / items)
 * เพื่อให้ง่ายต่อการเพิ่มฟีเจอร์ใหม่ในอนาคต และย้ายไป SQL จริงได้ตรงๆ
 * (แต่ละชีต = 1 ตาราง, player_id = foreign key เชื่อมทุกตาราง)
 *
 * วิธีติดตั้ง (ทำครั้งเดียว):
 * 1. sheets.google.com สร้าง Google Sheet ใหม่
 * 2. Extensions > Apps Script > ลบโค้ดเดิม วางโค้ดนี้ทั้งหมดแทน
 * 3. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. คัดลอก Web app URL ไปวางในหน้า Login ของเกม
 *
 * ชีตทั้ง 4 ตัวจะถูกสร้างอัตโนมัติพร้อม header แถวแรกตอนเรียกใช้ครั้งแรก
 *
 * SQL เทียบเท่า (ไว้ใช้ตอนย้ายฐานข้อมูลจริงในอนาคต):
 *   CREATE TABLE players (
 *     id TEXT PRIMARY KEY, password TEXT, created_at TEXT
 *   );
 *   CREATE TABLE progress (
 *     player_id TEXT PRIMARY KEY REFERENCES players(id),
 *     bank_gold INTEGER, best_floor INTEGER,
 *     up_atk INTEGER, up_def INTEGER, up_hp INTEGER, up_mp INTEGER,
 *     updated_at TEXT
 *   );
 *   CREATE TABLE run_state (
 *     player_id TEXT PRIMARY KEY REFERENCES players(id),
 *     floor INTEGER, level INTEGER, xp INTEGER, hp INTEGER, mp INTEGER,
 *     base_atk INTEGER, base_def INTEGER, base_max_hp INTEGER, base_max_mp INTEGER,
 *     run_gold INTEGER, potions INTEGER, updated_at TEXT
 *   );
 *   CREATE TABLE items (
 *     item_id TEXT PRIMARY KEY, player_id TEXT REFERENCES players(id),
 *     slot_type TEXT, equipped INTEGER, rarity TEXT, name TEXT,
 *     atk INTEGER, def INTEGER, hp INTEGER, mp INTEGER, created_at TEXT
 *   );
 *
 * หมายเหตุความปลอดภัย: รหัสผ่านเก็บเป็น plain text เหมาะกับเกมส่วนตัว/เพื่อนเล่นกันเอง
 * ------------------------------------------------
 */

const SHEETS = {
  players: { name: "players", headers: ["id", "password", "created_at"] },
  progress: { name: "progress", headers: ["player_id", "bank_gold", "best_floor", "up_atk", "up_def", "up_hp", "up_mp", "updated_at"] },
  runState: { name: "run_state", headers: ["player_id", "floor", "level", "xp", "hp", "mp", "base_atk", "base_def", "base_max_hp", "base_max_mp", "run_gold", "potions", "updated_at"] },
  items: { name: "items", headers: ["item_id", "player_id", "slot_type", "equipped", "rarity", "name", "atk", "def", "hp", "mp", "created_at"] },
};

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "login") return handleLogin(e.parameter.id, e.parameter.password);
    return jsonResponse({ error: "unknown_action" });
  } catch (err) {
    return jsonResponse({ error: "server_error", message: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case "register": return handleRegister(body.id, body.password);
      case "saveProgress": return handleSaveProgress(body.id, body.password, body.progress);
      case "saveRunState": return handleSaveRunState(body.id, body.password, body.runState);
      case "syncItems": return handleSyncItems(body.id, body.password, body.items || []);
      default: return jsonResponse({ error: "unknown_action" });
    }
  } catch (err) {
    return jsonResponse({ error: "server_error", message: String(err) });
  }
}

// ---------- sheet helpers ----------
function getSheet(key) {
  const def = SHEETS[key];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.appendRow(def.headers);
    sheet.getRange(1, 1, 1, def.headers.length).setFontWeight("bold");
  }
  return sheet;
}

function rowsAsObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[i][idx]; });
    obj.__row = i + 1;
    rows.push(obj);
  }
  return rows;
}

function findByField(sheet, field, value) {
  return rowsAsObjects(sheet).find((r) => String(r[field]) === String(value)) || null;
}

function writeRowByHeaders(sheet, headers, rowNum, obj) {
  const values = headers.map((h) => (obj[h] === undefined ? "" : obj[h]));
  sheet.getRange(rowNum, 1, 1, headers.length).setValues([values]);
}

function appendRowByHeaders(sheet, headers, obj) {
  const values = headers.map((h) => (obj[h] === undefined ? "" : obj[h]));
  sheet.appendRow(values);
}

// ---------- auth ----------
function verifyPlayer(id, password) {
  if (!id || !password) return { error: "missing_fields" };
  const sheet = getSheet("players");
  const row = findByField(sheet, "id", id);
  if (!row) return { error: "not_found" };
  if (String(row.password) !== String(password)) return { error: "wrong_password" };
  return { ok: true, row };
}

// ---------- handlers ----------
function handleRegister(id, password) {
  if (!id || !password) return jsonResponse({ error: "missing_fields" });
  const playersSheet = getSheet("players");
  if (findByField(playersSheet, "id", id)) return jsonResponse({ error: "id_taken" });

  const now = new Date().toISOString();
  appendRowByHeaders(playersSheet, SHEETS.players.headers, { id, password, created_at: now });

  const progressSheet = getSheet("progress");
  appendRowByHeaders(progressSheet, SHEETS.progress.headers, {
    player_id: id, bank_gold: 0, best_floor: 0, up_atk: 0, up_def: 0, up_hp: 0, up_mp: 0, updated_at: now,
  });

  return jsonResponse({ ok: true });
}

function handleLogin(id, password) {
  const auth = verifyPlayer(id, password);
  if (auth.error) return jsonResponse({ error: auth.error });

  const progressRow = findByField(getSheet("progress"), "player_id", id);
  const runRow = findByField(getSheet("run_state"), "player_id", id);
  const itemRows = rowsAsObjects(getSheet("items")).filter((r) => String(r.player_id) === String(id));

  return jsonResponse({
    ok: true,
    progress: progressRow ? stripRow(progressRow) : null,
    runState: runRow ? stripRow(runRow) : null,
    items: itemRows.map(stripRow),
  });
}

function handleSaveProgress(id, password, progress) {
  const auth = verifyPlayer(id, password);
  if (auth.error) return jsonResponse({ error: auth.error });
  if (!progress) return jsonResponse({ error: "missing_fields" });

  const sheet = getSheet("progress");
  const existing = findByField(sheet, "player_id", id);
  const now = new Date().toISOString();
  const obj = { player_id: id, ...progress, updated_at: now };
  if (existing) writeRowByHeaders(sheet, SHEETS.progress.headers, existing.__row, obj);
  else appendRowByHeaders(sheet, SHEETS.progress.headers, obj);

  return jsonResponse({ ok: true });
}

function handleSaveRunState(id, password, runState) {
  const auth = verifyPlayer(id, password);
  if (auth.error) return jsonResponse({ error: auth.error });

  const sheet = getSheet("run_state");
  const existing = findByField(sheet, "player_id", id);

  if (!runState) {
    // no active run -> remove the checkpoint row if present
    if (existing) sheet.deleteRow(existing.__row);
    return jsonResponse({ ok: true });
  }

  const now = new Date().toISOString();
  const obj = { player_id: id, ...runState, updated_at: now };
  if (existing) writeRowByHeaders(sheet, SHEETS.runState.headers, existing.__row, obj);
  else appendRowByHeaders(sheet, SHEETS.runState.headers, obj);

  return jsonResponse({ ok: true });
}

function handleSyncItems(id, password, items) {
  const auth = verifyPlayer(id, password);
  if (auth.error) return jsonResponse({ error: auth.error });

  const sheet = getSheet("items");
  // full-replace strategy: delete this player's existing rows, then reinsert the current list
  const existingRows = rowsAsObjects(sheet).filter((r) => String(r.player_id) === String(id));
  for (let i = existingRows.length - 1; i >= 0; i--) sheet.deleteRow(existingRows[i].__row);

  const now = new Date().toISOString();
  items.forEach((it) => {
    appendRowByHeaders(sheet, SHEETS.items.headers, {
      item_id: it.itemId, player_id: id, slot_type: it.slotType, equipped: it.equipped ? 1 : 0,
      rarity: it.rarity, name: it.name, atk: it.atk || 0, def: it.def || 0, hp: it.hp || 0, mp: it.mp || 0,
      created_at: now,
    });
  });

  return jsonResponse({ ok: true });
}

function stripRow(obj) {
  const clone = { ...obj };
  delete clone.__row;
  return clone;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
