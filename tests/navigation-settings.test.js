const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/ui/App.js"), "utf8");

function sourceBetween(start, end) {
  const from = components.indexOf(start);
  const to = components.indexOf(end, from);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return components.slice(from, to);
}

test("shared GameDock owns the only More menu with Settings, Save, and Friend", () => {
  const dock = sourceBetween("function GameDock", "// Renders the icon+amount chips");
  const panel = dock.slice(dock.indexOf("moreOpen &&"), dock.indexOf('React.createElement("nav"'));
  assert.match(panel, /Settings/);
  assert.match(panel, /Save/);
  assert.match(panel, /Friend/);
  assert.doesNotMatch(panel, /Daily|Mail|Shop|Enhance|Craft|Raid|Arena|Leaderboard|Switch Character|Logout|รายวัน|จดหมาย|อันดับ|ร้านค้า|ตีบวก|ประดิษฐ์|เปลี่ยนตัว|ออกจากระบบ/);
  assert.equal((components.match(/className: "md-hub-more-panel"/g) || []).length, 1);
});

test("Character, Inventory, Pet, and Map use shared non-navigating More behavior", () => {
  const characterDock = sourceBetween("function CharacterPageDock", "function PaidResetConfirm");
  const pet = sourceBetween("function PetScreen", "function GachaScreen");
  const inventory = sourceBetween("function InventoryOverlayV2", "function InventoryOverlay(");
  const map = sourceBetween("function MapScreen", "function ShopOverlay");
  assert.doesNotMatch(components, /md-character-more/);
  assert.match(characterDock, /onSettings[\s\S]*onSave[\s\S]*onFriend/);
  assert.match(pet, /activeKey: "pets"[\s\S]*onSettings[\s\S]*onSave[\s\S]*onFriend/);
  assert.match(inventory, /activeKey:"inventory", onSettings, onSave, onFriend/);
  assert.doesNotMatch(inventory, /onToggleMore:onClose/);
  assert.match(map, /e\(GameDock,[\s\S]*onSettings,[\s\S]*onSave,[\s\S]*onFriend/);
});

test("Settings is the account and security hub", () => {
  const settings = sourceBetween("function AccountSettingsOverlay", "function GameDock");
  assert.match(settings, /ACCOUNT & SECURITY/);
  assert.match(settings, /Player ID/);
  assert.match(settings, /Recovery Code/);
  assert.match(settings, /เปลี่ยน Password/);
  assert.match(settings, /onSwitchCharacter/);
  assert.match(settings, /onLogout/);
  assert.match(app, /onSwitchCharacter: backToCharacterSelect/);
  assert.match(app, /onLogout: logout/);
});

test("navigation callbacks preserve the existing return-phase flows", () => {
  assert.match(app, /setCharacterReturnPhase\("menu"\)/);
  assert.match(app, /setCharacterReturnPhase\("town"\)/);
  assert.match(app, /setCharacterReturnPhase\("map"\)/);
  assert.match(app, /setCharacterReturnPhase\("pets"\)/);
  assert.match(app, /onBack: \(\) => setPhase\(characterReturnPhase\)/);
  assert.match(app, /onBack: \(\) => setPhase\(petReturnPhase\)/);
  assert.match(app, /onBack: \(\) => setPhase\(utilityReturnPhase\)/);
  assert.match(app, /onBack: \(\) => setPhase\(gachaReturnPhase\)/);
});
