const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const worker = fs.readFileSync(path.join(root, "workers/thornie-dungeons-api.js"), "utf8");
const api = fs.readFileSync(path.join(root, "src/state/api.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/ui/App.js"), "utf8");

test("Guild chat reuses the existing schema and derives access from membership", () => {
  assert.match(worker, /function guildChatKey\(guildId\) \{ return `guild:\$\{guildId\}`; \}/);
  assert.match(worker, /async function getCurrentGuildMembership[\s\S]*?FROM guild_members gm JOIN guilds g/);
  assert.match(worker, /if \(action === "getGuildChat"\) return await handleGetGuildChat/);
  assert.match(worker, /case "sendGuildMessage"[\s\S]*?handleSendGuildMessage/);
  assert.match(worker, /case "markGuildChatRead"[\s\S]*?handleMarkGuildChatRead/);
  assert.match(worker, /if \(action === "getGuildChatStatus"\) return await handleGetGuildChatStatus/);
  assert.match(worker, /idx_chat_sender_nonce|client_nonce/);
  assert.doesNotMatch(fs.readdirSync(path.join(root, "migrations", "auto")).join("\n"), /guild_chat/i);
});

test("Guild chat enforces retention, visible-before-limit, unread rules, and lifecycle cleanup", () => {
  assert.match(worker, /CHAT_GUILD_RETENTION_DAYS = 14/);
  assert.match(worker, /channel='guild' AND guild_id=\? AND created_at>=\? AND id>\?\$\{blockedClause\} ORDER BY id ASC LIMIT 200/);
  assert.match(worker, /channel='guild' AND guild_id=\? AND created_at>=\?\$\{blockedClause\} ORDER BY id DESC LIMIT \?/);
  assert.match(worker, /from_character_id!=\?\$\{blockedClause\} LIMIT 1/);
  assert.match(worker, /guildChatBaselineStatement\(db, characterId, guildId, now\)/);
  assert.match(worker, /DELETE FROM chat_read_state WHERE character_id = \? AND conversation_key = \?`\)\.bind\(characterId, guildChatKey/);
  assert.match(worker, /DELETE FROM chat_read_state WHERE character_id = \? AND conversation_key = \?`\)\.bind\(targetCharacterId, guildChatKey/);
  assert.match(worker, /guildDeleted:/);
  assert.match(worker, /guild:%.*NOT EXISTS/s);
});

test("Guild chat client shares the existing ChatScreen and retains unread state by character", () => {
  assert.match(api, /function cloudGetGuildChat\(/);
  assert.match(api, /function cloudGetGuildChatStatus\(/);
  assert.match(api, /function cloudSendGuildMessage\(/);
  assert.match(api, /function cloudMarkGuildChatRead\(/);
  assert.match(ui, /\{ key: "guild", label: "กิลด์" \}/);
  assert.match(ui, /const lastGuildIdRef = React\.useRef\(0\)/);
  assert.match(ui, /setTimeout\(poll, delay\)/);
  assert.match(ui, /t\.key === "guild" && guildUnread/);
  assert.match(ui, /CHAT_TABS\.map/);
  assert.match(ui, /onClick: onChat }, "💬 แชทกิลด์"/);
  assert.match(app, /initialChannel: chatInitialChannel/);
  assert.match(app, /setChatInitialChannel\("guild"\)/);
  assert.match(app, /guildUnreadState\.characterId === save\?\.characterId/);
});
