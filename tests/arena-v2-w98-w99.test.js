const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const vm = require('node:vm');
const { loadWorkerSource } = require('./helpers/worker-source');

const ROOT = path.join(__dirname, '..');
const worker = loadWorkerSource(ROOT);
const playerCard = fs.readFileSync(path.join(ROOT, 'src/ui/playerCard.js'), 'utf8');
const arenaUi = fs.readFileSync(path.join(ROOT, 'src/ui/components.js'), 'utf8');
const arenaApi = fs.readFileSync(path.join(ROOT, 'src/state/api.js'), 'utf8');
const appUi = fs.readFileSync(path.join(ROOT, 'src/ui/App.js'), 'utf8');
const phaserUi = fs.readFileSync(path.join(ROOT, 'src/phaser/ui/PhaserBattlefield.js'), 'utf8');
const migration = fs.readFileSync(path.join(ROOT, 'migrations/auto/0024_arena_w98_rewards.sql'), 'utf8');
const mailboxModule = fs.readFileSync(path.join(ROOT, 'workers/modules/mailbox.js'), 'utf8');

class D1Statement {
  constructor(db, sql, values = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values) { return new D1Statement(this.db, this.sql, values); }
  async first() { return this.db.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.values) }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.values); return { meta: { changes: Number(r.changes) } }; }
}
class D1TestDb {
  constructor() { this.raw = new DatabaseSync(':memory:'); }
  prepare(sql) { return new D1Statement(this.raw, sql); }
  async batch(statements) { return statements.map(s => { const r = this.raw.prepare(s.sql).run(...s.values); return { meta: { changes: Number(r.changes) } }; }); }
}
function loadMailboxFns() {
  const source = worker.replace('export default {', 'const workerDefault = {') + '\nglobalThis.__mailboxFns = { sendMail, handleClaimAllMail };';
  const sandbox = { console, Response, crypto, TextEncoder, Uint8Array };
  vm.createContext(sandbox); vm.runInContext(source, sandbox); return sandbox.__mailboxFns;
}
function loadMailboxHandlers(deps) {
  const source = mailboxModule.replace('export function createMailboxHandlers', 'function createMailboxHandlers')
    + '\nglobalThis.__createMailboxHandlers = createMailboxHandlers;';
  const sandbox = { console, Response, crypto, TextEncoder, Uint8Array };
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  return sandbox.__createMailboxHandlers(deps);
}
const mailboxFns = loadMailboxFns();

test('W9.8 mailbox migration adds deterministic source and claim receipt identities', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE mailbox (mail_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', gold INTEGER NOT NULL DEFAULT 0, diamonds INTEGER NOT NULL DEFAULT 0, junk_json TEXT NOT NULL DEFAULT '', items_json TEXT NOT NULL DEFAULT '', claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, claimed_at TEXT NOT NULL DEFAULT '')`);
  db.exec(migration);
  db.prepare("INSERT INTO mailbox (mail_id, character_id, source_key, created_at) VALUES ('m1', 'c1', 'arena:season-reward:s1:c1', 'now')").run();
  assert.throws(() => db.prepare("INSERT INTO mailbox (mail_id, character_id, source_key, created_at) VALUES ('m2', 'c1', 'arena:season-reward:s1:c1', 'now')").run());
  db.prepare("INSERT INTO mailbox_claim_receipts (receipt_key, character_id, reward_json, created_at) VALUES ('mailbox:claim-all:c1:r1', 'c1', '{}', 'now')").run();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM mailbox_claim_receipts WHERE character_id = 'c1'").get().n, 1);
  db.close();
});

test('sendMail works against the real SQLite partial unique index and preserves legacy empty keys', async () => {
  const db = new D1TestDb();
  db.raw.exec(`CREATE TABLE mailbox (mail_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', gold INTEGER NOT NULL DEFAULT 0, diamonds INTEGER NOT NULL DEFAULT 0, junk_json TEXT NOT NULL DEFAULT '', items_json TEXT NOT NULL DEFAULT '', claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, claimed_at TEXT NOT NULL DEFAULT '')`);
  db.raw.exec(migration);
  await mailboxFns.sendMail(db, 'c1', 'A', 'B', { gold: 7 }, 'reward:s1:c1');
  await mailboxFns.sendMail(db, 'c1', 'A', 'B', { gold: 7 }, 'reward:s1:c1');
  await mailboxFns.sendMail(db, 'c1', 'legacy', 'B', { gold: 1 }, '');
  await mailboxFns.sendMail(db, 'c1', 'legacy', 'B', { gold: 1 }, '');
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM mailbox WHERE source_key = 'reward:s1:c1'").get().n, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM mailbox WHERE source_key = ''").get().n, 2);
});

test('Claim All concurrent calls claim each mail row once and replay from the committed snapshot', async () => {
  const db = new D1TestDb();
  db.raw.exec(`CREATE TABLE players (id TEXT PRIMARY KEY); CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL); CREATE TABLE items (item_id TEXT PRIMARY KEY, character_id TEXT NOT NULL); CREATE TABLE mailbox (mail_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, title TEXT, body TEXT, gold INTEGER, diamonds INTEGER, junk_json TEXT, items_json TEXT, claimed INTEGER, created_at TEXT, claimed_at TEXT DEFAULT '')`);
  db.raw.exec(migration);
  db.raw.prepare("INSERT INTO players VALUES ('p1')").run(); db.raw.prepare("INSERT INTO characters VALUES ('c1','p1')").run();
  db.raw.prepare("INSERT INTO mailbox (mail_id, character_id, gold, diamonds, junk_json, items_json, claimed, created_at) VALUES ('m1','c1',25,0,'','',0,'2026-01-01')").run();
  const session = { ok: true, row: { id: 'p1' } };
  const handlers = loadMailboxHandlers({
    json: value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }),
    nowIso: () => '2026-01-02T00:00:00.000Z',
    verifyPlayer: async () => ({ ok: true }),
    verifyOwnedCharacter: async () => ({ row: { character_id: 'c1', player_id: 'p1' } }),
    parseJsonColumn: (value, fallback) => { try { return JSON.parse(value || ''); } catch (_) { return fallback; } },
    buildRewardStatements: async () => [],
    getSnapshot: async () => ({ committedSnapshot: true })
  });
  const calls = await Promise.all([1, 2].map(() => handlers.handleClaimAllMail(db, 'p1', session, 'c1', 'stable-request')));
  const payloads = await Promise.all(calls.map(r => r.json()));
  assert.equal(payloads.filter(payload => payload.mailIds?.includes('m1')).length, 1);
  assert.equal(payloads.filter(payload => payload.replayed).length, 1);
  assert.ok(payloads.every(payload => payload.committedSnapshot));
  const replay = await (await handlers.handleClaimAllMail(db, 'p1', session, 'c1', 'stable-request')).json();
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.mailIds, []);
  assert.equal(replay.committedSnapshot, true);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM mailbox WHERE claimed = 1").get().n, 1);
});

test('W9.8/W9.9 uses deterministic frame assets, rank history and V2 routes', () => {
  assert.match(worker, /arena-frame:\$\{current\.season_id\}:\$\{player\.character_id\}:\$\{rank\}/);
  assert.match(worker, /arena_rank_1/);
  assert.match(playerCard, /profileFrames\.arenaRank1/);
  assert.match(worker, /handleGetArenaV2History/);
  assert.match(worker, /handleGetArenaV2Ranking/);
  assert.match(worker, /refreshAvailableAt: state\?\.refresh_available_at \|\| null/);
  assert.match(worker, /claimedAt = `\$\{nowIso\(\)\}#\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(worker, /character_id = \? AND claimed = 0/);
});

function loadPreloadGate() {
  const start = arenaUi.indexOf('function createArenaV2PreloadGate');
  const end = arenaUi.indexOf('\n\n// W9.8/W9.9 authoritative Arena V2 surface', start);
  const sandbox = { Promise, setTimeout, clearTimeout, React: { createElement: () => null, Component: class {} } };
  vm.createContext(sandbox);
  vm.runInContext(`${arenaUi.slice(start, end)}\nglobalThis.createArenaV2PreloadGate = createArenaV2PreloadGate;`, sandbox);
  return sandbox.createArenaV2PreloadGate;
}

test('Arena Phaser preload gate activates only after READY and rejects error/timeout', async () => {
  const createGate = loadPreloadGate();
  const readyGate = createGate(100);
  readyGate.ready();
  assert.equal(await readyGate.promise, undefined);

  const failedGate = createGate(100);
  failedGate.fail('preload_error');
  await assert.rejects(failedGate.promise, /preload_error/);

  const timeoutGate = createGate(5);
  await assert.rejects(timeoutGate.promise, /arena_preload_timeout/);
});

test('Arena V2 frontend contract uses default Phaser, Player Card and no animation-frame activation shortcut', () => {
  assert.match(phaserUi, /props\.mode === "arena" \? true : isPhaserBattleRendererEnabled\(\)/);
  assert.match(phaserUi, /return value !== "0"/);
  assert.match(arenaApi, /function cloudGetArenaV2PlayerCard/);
  assert.match(arenaApi, /function cloudAcknowledgeArenaV2Unlock/);
  assert.match(arenaUi, /cloudGetArenaV2PlayerCard\(url, characterId, opponentKey\)/);
  assert.match(arenaUi, /function ArenaPlayerCardOverlay/);
  assert.match(arenaUi, /md-player-card-overlay md-arena-player-card-overlay/);
  assert.match(arenaUi, /ReactDOM\.createPortal/);
  assert.match(arenaUi, /cloudAcknowledgeArenaV2Unlock\(url, characterId\)/);
  assert.match(arenaUi, /refreshSeconds > 0/);
  assert.match(arenaUi, /REFRESH · \$\{refreshSeconds\}s/);
  assert.match(arenaUi, /optionalAsset\("arenaUi\.background"\)/);
  assert.match(arenaUi, /iconKey: "arenaCoin"/);
  assert.match(arenaUi, /iconKey: "arenaTicket"/);
  assert.match(arenaUi, /preloadGateRef\.current\?\.ready\(\)/);
  assert.match(arenaUi, /function formatArenaSeasonCountdown/);
  assert.match(arenaUi, /seasonCountdownText = formatArenaSeasonCountdown\(countdown\)/);
  assert.doesNotMatch(arenaUi, /const mins = Math\.floor\(countdown \/ 60000\)/);
  assert.match(arenaUi, /md-character-page-title md-arena-page-header/);
  assert.match(arenaUi, /React\.createElement\(GameDock/);
  assert.match(arenaUi, /className: "md-arena-scroll"/);
  assert.match(arenaUi, /onClick: \(\) => action\("active", skill, selected\)/);
  assert.doesNotMatch(arenaUi, /action\("skill", skill, selected\)/);
  assert.match(arenaUi, /onHudChange\?\.\(/);
  assert.match(arenaUi, /Standard BOT Loadout/);
  assert.match(arenaUi, /return "None"/);
  assert.match(appUi, /const \[arenaHud, setArenaHud\] = useState\(null\)/);
  assert.match(appUi, /arena: arenaHud/);
  assert.match(appUi, /\.\.\.utilityDockProps\("arena"\)/);
  assert.doesNotMatch(arenaUi.slice(arenaUi.indexOf('function ArenaV2Screen'), arenaUi.indexOf('\n}\n\n// Turns a mail')), /requestAnimationFrame/);
});


function loadPreparedPresentationHelpers() {
  const start = fs.readFileSync(path.join(ROOT, 'src/phaser/presentation/EventBridge.js'), 'utf8').indexOf('function arenaPreparedEquipmentMap');
  const sourceFile = fs.readFileSync(path.join(ROOT, 'src/phaser/presentation/EventBridge.js'), 'utf8');
  const end = sourceFile.indexOf('\nfunction arenaPresentationUnit', start);
  const sandbox = { React: { createElement: () => null, Component: class {} } };
  vm.createContext(sandbox);
  vm.runInContext(`${sourceFile.slice(start, end)}
globalThis.__prepared = { arenaPreparedEquipmentMap, arenaPreparedPresentationContext };`, sandbox);
  return sandbox.__prepared;
}

test('prepared Arena snapshot produces real Hero equipment and Pet presentation data before activation', () => {
  const { arenaPreparedPresentationContext } = loadPreparedPresentationHelpers();
  const prepared = arenaPreparedPresentationContext({
    seed: 42,
    attacker: {
      name: 'Hero A',
      stats: { maxHp: 500 },
      equipment: [{ slotType: 'helmet', name: 'Azure Helmet' }, { slotType: 'wings', name: 'Angel Wings' }],
      pet: { defId: 'sprout', level: 5 }
    },
    defender: {
      name: 'Hero B',
      stats: { maxHp: 450 },
      equipment: [{ slotType: 'weapon', name: 'Azure Sword' }],
      pet: { defId: 'flamekit', level: 4 }
    }
  });
  assert.equal(prepared.state.units.team_a_hero.maxHp, 500);
  assert.equal(prepared.state.units.team_a_pet.defId, 'sprout');
  assert.equal(prepared.state.units.team_b_pet.defId, 'flamekit');
  assert.equal(prepared.teams.team_a.equipped.helmet.name, 'Azure Helmet');
  assert.equal(prepared.teams.team_a.equipped.wings.name, 'Angel Wings');
  assert.equal(prepared.teams.team_b.equipped.weapon.name, 'Azure Sword');
});

function loadArenaCardHelpers() {
  const start = arenaUi.indexOf('function arenaPlayerCardEquipmentLabels');
  const end = arenaUi.indexOf('\n// W9.8/W9.9 authoritative Arena V2 surface', start);
  const sandbox = { React: { createElement: () => null, Component: class {} } };
  vm.createContext(sandbox);
  vm.runInContext(`${arenaUi.slice(start, end)}
globalThis.__card = { arenaPlayerCardEquipmentLabels, arenaPlayerCardPetLabel };`, sandbox);
  return sandbox.__card;
}

test('Arena Player Card normalizes equipment objects and Pet defId into render-safe strings', () => {
  const { arenaPlayerCardEquipmentLabels, arenaPlayerCardPetLabel } = loadArenaCardHelpers();
  assert.deepEqual(
    Array.from(arenaPlayerCardEquipmentLabels([
      { name: 'Azure Sword', enhanceLevel: 3 },
      { itemTemplateId: 'helm-01', slotType: 'helmet' }
    ])),
    ['Azure Sword +3', 'helm-01']
  );
  assert.equal(arenaPlayerCardPetLabel({ pet: { defId: 'sprout' } }), 'sprout');
  assert.equal(arenaPlayerCardPetLabel({}), 'None');
  assert.match(arenaUi, /arenaProfileFrameAsset\(card\.profileFrameKey\)/);
  assert.doesNotMatch(arenaUi, /playerCard\.equipmentSummary \|\| playerCard\.equipment \|\|/);
});

test('Arena Player Card renders equipped items as a fixed read-only horizontal icon strip', () => {
  const styles = fs.readFileSync(path.join(ROOT, 'src/data/styles.js'), 'utf8');
  assert.match(arenaUi, /className: "md-arena-equipment-icons"/);
  assert.match(arenaUi, /className: "md-arena-equipment-icon"/);
  assert.match(arenaUi, /React\.createElement\(GameIcon|e\(GameIcon/);
  assert.match(arenaUi, /fallback: SLOT_ICON\[slot\]/);
  const cardSection = arenaUi.slice(arenaUi.indexOf('function ArenaPlayerCardOverlay'), arenaUi.indexOf('function ArenaUnlockNotice'));
  const equipmentRule = styles.match(/\.md-arena-equipment-icons \{[^}]*\}/)?.[0] || '';
  assert.match(equipmentRule, /overflow:hidden/);
  assert.doesNotMatch(equipmentRule, /overflow-x:auto/);
  assert.doesNotMatch(cardSection, /onUnequip|onSalvage|onSell|SALVAGE|SELL/);
});

test('Arena browser shell reuses the shared global currency row, horizontal tabs and locked dock', () => {
  const styles = fs.readFileSync(path.join(ROOT, 'src/data/styles.js'), 'utf8');
  assert.match(arenaUi, /function GlobalCurrencyBar/);
  assert.match(arenaUi, /md-character-page-title md-arena-page-header/);
  assert.match(arenaUi, /md-arena-phaser-stage/);
  assert.match(arenaUi, /className: "md-arena-scroll"/);
  assert.match(arenaUi, /React\.createElement\(GlobalCurrencyBar/);
  assert.match(arenaUi, /md-tab-row md-arena-tab-row/);
  assert.match(arenaUi, /React\.createElement\(GameDock/);
  assert.match(styles, /\.md-hub-resources\.with-arena \{ grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.md-arena-v2 \{ display:flex; flex-direction:column; flex:1 1 auto; height:100dvh/);
  assert.match(styles, /\.md-arena-v2 > \.md-hub-dock \{ position:static; flex:0 0 auto; min-height:var\(--md-dock-height\)/);
  assert.match(styles, /\.md-arena-scroll \{ flex:1 1 auto; min-height:0; overflow-y:auto/);
  assert.match(styles, /\.md-arena-tab-row \{ display:grid; grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.md-arena-phaser-stage \{ position:relative;[^}]*min-height:clamp\(300px,48dvh,430px\)/);
  assert.match(appUi, /arena: arenaHud/);
  assert.match(appUi, /arenaHud: arenaHud/);
  assert.match(appUi, /phase !== "arena" && .*StatusBar/);
  assert.match(appUi, /cloudGetArenaV2Status\(cred\.url, characterId\)/);
  assert.doesNotMatch(arenaUi, /onHudChange\?\.\(null\)/);
});

test('Arena setup uses a top-level skill portal, blocks duplicate skills, and keeps XP progression authoritative', () => {
  const styles = fs.readFileSync(path.join(ROOT, 'src/data/styles.js'), 'utf8');
  const worker = fs.readFileSync(path.join(ROOT, 'workers/thornie-dungeons-api.js'), 'utf8');
  assert.match(arenaUi, /function ArenaSkillDropdown/);
  assert.match(arenaUi, /ReactDOM\.createPortal/);
  assert.match(arenaUi, /usedByOtherSlots/);
  assert.match(styles, /\.md-arena-setup-options-portal \{ position:fixed !important; z-index:2147483647 !important;/);
  assert.match(worker, /const seenSkills = new Set\(\);/);
  assert.match(worker, /function dungeonV2CharacterXpToNext\(level\)/);
  assert.match(worker, /while \(nextLevel < DUNGEON_CHARACTER_MAX_LEVEL && nextXp >= dungeonV2CharacterXpToNext\(nextLevel\)/);
  assert.match(worker, /level = \?, xp = \?, stat_points = \?/);
});

test('Arena HIGH blocker recovery is scoped, diagnostic-rich and preserves resume', () => {
  const head = fs.readFileSync(path.join(ROOT, 'head.html'), 'utf8');
  assert.doesNotMatch(head, /window\.__thornieArenaRuntimeError/);
  assert.doesNotMatch(head, /window\.__thornieArenaUnhandledRejection/);
  assert.match(head, /window\.__thornieCaptureRuntimeError/);
  assert.match(head, /window\.__thornieReportRuntimeError/);
  assert.match(arenaUi, /ArenaV2ErrorBoundary[\s\S]*React\.Component/);
  assert.match(arenaUi, /function arenaFatalDiagnostic\(/);
  assert.match(arenaUi, /matchId: String\(context\.matchId/);
  assert.match(arenaUi, /phaserStatus: String\(context\.phaserStatus/);
  assert.match(arenaUi, /setMatch\(null\)/);
  assert.match(arenaUi, /Do not call an Arena API here/);
  assert.match(arenaUi, /authoritative active match/);
  assert.match(appUi, /ArenaFatalDiagnosticOverlay/);
  assert.match(appUi, /setPhase\(utilityReturnPhase \|\| "menu"\)/);
});

test('Arena ATB reuses the shared four-slot TurnOrderBar with authoritative queue metadata', () => {
  assert.match(arenaUi, /md-arena-turn-order/);
  assert.match(arenaUi, /React\.createElement\(TurnOrderBar/);
  assert.match(arenaUi, /queue: arenaTurnQueue/);
  assert.match(arenaUi, /activeKey: match\.state\?\.currentActorId/);
  assert.match(arenaUi, /arenaTurnOrderIcon/);
  assert.match(phaserUi, /buildArenaBattlefieldSnapshot\(props\)/);
});


test('Arena Phaser receives prepared match snapshot so READY waits on actor assets before activate', () => {
  assert.match(arenaUi, /preparedSnapshot: match\.snapshot/);
  assert.match(phaserUi, /props\.preparedSnapshot/);
  const eventSource = fs.readFileSync(path.join(ROOT, 'src/phaser/presentation/EventBridge.js'), 'utf8');
  assert.match(eventSource, /arenaPreparedPresentationContext\(preparedSnapshot\)/);
  assert.match(eventSource, /equipped: arenaPreparedEquipmentMap\(member\?\.equipment\)/);
  assert.match(eventSource, /petCombat: petSource/);
  assert.match(eventSource, /state\.safeActionSeq \?\? state\.actionSeq \?\? state\.logSeq/);
});

function loadArenaPresentationUnit() {
  const sourceFile = fs.readFileSync(path.join(ROOT, 'src/phaser/presentation/EventBridge.js'), 'utf8');
  const start = sourceFile.indexOf('function arenaPresentationUnit');
  const end = sourceFile.indexOf('\nfunction buildArenaBattlefieldSnapshot', start);
  const sandbox = { Map };
  vm.createContext(sandbox);
  vm.runInContext(`${sourceFile.slice(start, end)}
globalThis.__arenaPresentationUnit = arenaPresentationUnit;`, sandbox);
  return sandbox.__arenaPresentationUnit;
}

test('Arena active public-state unit arrays keep all 2v2 presentation actors addressable', () => {
  const resolveUnit = loadArenaPresentationUnit();
  const state = {
    units: [
      { id: 'team_a_hero', side: 'team_a', kind: 'hero', hp: 100, maxHp: 100 },
      { id: 'team_a_pet', side: 'team_a', kind: 'pet', hp: 80, maxHp: 80 },
      { id: 'team_b_hero', side: 'team_b', kind: 'hero', hp: 100, maxHp: 100 },
      { id: 'team_b_pet', side: 'team_b', kind: 'pet', hp: 70, maxHp: 70 }
    ]
  };
  assert.equal(resolveUnit(state, 'team_a', 'hero').id, 'team_a_hero');
  assert.equal(resolveUnit(state, 'team_a', 'pet').id, 'team_a_pet');
  assert.equal(resolveUnit(state, 'team_b', 'hero').id, 'team_b_hero');
  assert.equal(resolveUnit(state, 'team_b', 'pet').id, 'team_b_pet');
});

test('Arena Hub Extension R1 binds approved asset families and keeps Battle/Result unskinned', () => {
  const styles = fs.readFileSync(path.join(ROOT, 'src/data/styles.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'r2-upload/manifest.json'), 'utf8'));
  for (const key of ['primary', 'secondary', 'danger']) assert.ok(manifest.assets.arenaUi.buttons[key]);
  for (const key of ['bronze', 'silver', 'gold', 'diamond']) assert.ok(manifest.assets.arenaUi.tiers[key]);
  for (const key of ['frame', 'fill', 'rewardSlot']) assert.ok(manifest.assets.arenaUi.progress[key]);
  for (const key of ['season', 'refresh', 'playerCard', 'info', 'playMilestone', 'winMilestone', 'attackHistory', 'defenseHistory']) {
    assert.ok(manifest.assets.arenaUi.icons[key]);
  }
  assert.match(arenaUi, /ARENA_HUB_MILESTONE_PRESENTATION/);
  assert.match(arenaUi, /optionalAsset\("arenaUi\.buttons\.primary"\)/);
  assert.match(arenaUi, /optionalAsset\("arenaUi\.tiers\.bronze"\)/);
  assert.match(arenaUi, /md-arena-milestone-panel/);
  assert.match(arenaUi, /className: !match \? "md-card md-arena-hub-panel md-arena-summary-panel" : "md-card"/);
  assert.match(arenaUi, /!match && currentTierBadge/);
  assert.match(arenaUi, /!match && arenaHubAssets\.icons\.season/);
  assert.match(arenaUi, /md-arena-summary-hint/);
  assert.doesNotMatch(arenaUi, /CURRENCY INFO/);
  assert.match(styles, /border-image-slice:32 fill/);
  assert.match(styles, /border-image-slice:16 fill/);
  assert.match(styles, /\.md-arena-progress-fill \{[^}]*width:0;[^}]*background-color:#2f8dff/);
  assert.doesNotMatch(styles, /clip-path:inset\(0 calc\(100% - var\(--arena-progress\)\)/);
  assert.match(styles, /content: "Ver 1.0.49"/);
  const battleStart = arenaUi.indexOf('    match && /*#__PURE__*/React.createElement(React.Fragment');
  const dockStart = arenaUi.indexOf('    !match && /*#__PURE__*/React.createElement(GameDock', battleStart);
  const battleSurface = arenaUi.slice(battleStart, dockStart);
  assert.doesNotMatch(battleSurface, /md-arena-hub-panel|md-arena-art-btn|arenaUi\.tiers|arenaUi\.progress/);
});

test('Arena Battle + Result Graphics R1 binds approved art without changing authoritative combat behavior', () => {
  const styles = fs.readFileSync(path.join(ROOT, 'src/data/styles.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'r2-upload/manifest.json'), 'utf8'));
  assert.equal(manifest.assets.arenaUi.battle.surrender, 'ui/arena/battle/button_surrender.png');
  assert.equal(manifest.assets.arenaUi.results.win, 'ui/arena/results/result_win.png');
  assert.equal(manifest.assets.arenaUi.results.loss, 'ui/arena/results/result_loss.png');
  assert.equal(manifest.assets.arenaUi.results.draw, 'ui/arena/results/result_draw.png');
  assert.match(arenaUi, /function arenaResultGraphicKey\(outcome\)/);
  assert.match(arenaUi, /optionalAsset\("arenaUi\.battle\.surrender"\)/);
  assert.match(arenaUi, /optionalAsset\("arenaUi\.results\.win"\)/);
  assert.match(arenaUi, /className: "md-card md-arena-result-card"/);
  assert.match(arenaUi, /className: "md-arena-result-emblem"/);
  assert.match(arenaUi, /className: "md-btn flee md-arena-surrender-btn"/);
  assert.match(arenaUi, /onClick: \(\) => action\("surrender", null, selected\)/);
  assert.match(arenaUi, /SURRENDER \(10s\)/);
  assert.match(arenaUi, /arenaResultGraphicKey\(resultView\.outcome\)/);
  assert.match(styles, /border-image-source:var\(--arena-surrender-button\)/);
  assert.match(styles, /\.md-arena-result-emblem/);
  assert.match(styles, /content: "Ver 1.0.49"/);
});

// W9 browser QA Batch 5 low/medium UI shell fixes only; final parity retrigger after generated frontend sync.
