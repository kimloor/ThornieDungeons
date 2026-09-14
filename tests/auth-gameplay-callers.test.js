const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const apiSource = fs.readFileSync(path.join(root, "src/state/api.js"), "utf8");
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");

test("Mailbox and Crafting UI callers use Auth V2 session signatures", () => {
  const mailbox = components.slice(components.indexOf("function MailboxScreen"), components.indexOf("function floorEventPreview"));
  const crafting = components.slice(components.indexOf("function CraftingOverlay"));
  assert.doesNotMatch(mailbox, /\bcred\b|password/);
  assert.doesNotMatch(crafting, /\bcred\b|password/);
  assert.match(mailbox, /cloudGetMailbox\(serverUrl \|\| DEFAULT_SERVER_URL, characterId\)/);
  assert.match(mailbox, /cloudClaimMail\(serverUrl \|\| DEFAULT_SERVER_URL, characterId, mailId\)/);
  assert.match(mailbox, /cloudClaimAllMail\(serverUrl \|\| DEFAULT_SERVER_URL, characterId\)/);
  assert.match(mailbox, /cloudDeleteMail\(serverUrl \|\| DEFAULT_SERVER_URL, characterId, mailId\)/);
  assert.match(mailbox, /cloudDeleteMails\(serverUrl \|\| DEFAULT_SERVER_URL, characterId, ids\)/);
  assert.match(mailbox, /cloudDeleteAllClaimedMail\(serverUrl \|\| DEFAULT_SERVER_URL, characterId\)/);
  assert.match(mailbox, /mailError &&/);
  assert.match(mailbox, /onClick: load }, "ลองใหม่"/);
  assert.match(crafting, /cloudCraftItem\(serverUrl \|\| DEFAULT_SERVER_URL, characterId, recipe\.recipeId\)/);
});

test("authenticated gameplay helpers send bearer auth without id/password payloads", async () => {
  const requests = [];
  const sandbox = {
    URLSearchParams,
    setTimeout: callback => callback(),
    AUTH_SESSION: { getToken: () => "session-token", getGeneration: () => 1, handleApiResult: result => result },
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      return { status: 200, json: async () => ({ ok: true, mails: [] }) };
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(apiSource, sandbox);
  await sandbox.cloudGetMailbox("https://api.test", "char-1");
  await sandbox.cloudClaimMail("https://api.test", "char-1", "mail-1");
  await sandbox.cloudClaimAllMail("https://api.test", "char-1");
  await sandbox.cloudDeleteMail("https://api.test", "char-1", "mail-1");
  await sandbox.cloudDeleteMails("https://api.test", "char-1", ["mail-1", "mail-2"]);
  await sandbox.cloudDeleteAllClaimedMail("https://api.test", "char-1");
  await sandbox.cloudCraftItem("https://api.test", "char-1", "recipe-1");
  await sandbox.cloudGetRaidStatus("https://api.test", "char-1");
  await sandbox.cloudGetArenaStatus("https://api.test", "char-1");

  assert.equal(requests.length, 9);
  for (const request of requests) {
    assert.equal(request.options.headers.Authorization, "Bearer session-token");
    assert.doesNotMatch(`${request.url}${request.options.body || ""}`, /password|session-token|"id"/i);
  }
});
