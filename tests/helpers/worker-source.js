const fs = require("node:fs");
const path = require("node:path");

// Keep VM-based unit tests aligned with the deployed ESM Worker graph. The test
// harness intentionally flattens only the module syntax; it does not alter code
// or provide a second implementation of any handler.
function loadWorkerSource(root) {
  const repoRoot = root || path.resolve(__dirname, "../..");
  const shared = fs.readFileSync(path.join(repoRoot, "workers/modules/shared.js"), "utf8")
    .replace(/export \{[\s\S]*?\};\s*$/, "");
  const auth = fs.readFileSync(path.join(repoRoot, "workers/modules/auth.js"), "utf8")
    .replace(/^export function createAuthHandlers/, "function createAuthHandlers");
  const social = fs.readFileSync(path.join(repoRoot, "workers/modules/social.js"), "utf8")
    .replace(/^export function createSocialHandlers/, "function createSocialHandlers");
  const mailbox = fs.readFileSync(path.join(repoRoot, "workers/modules/mailbox.js"), "utf8")
    .replace(/^export function createMailboxHandlers/, "function createMailboxHandlers");
  const leaderboard = fs.readFileSync(path.join(repoRoot, "workers/modules/leaderboard.js"), "utf8")
    .replace(/^export function createLeaderboardHandlers/, "function createLeaderboardHandlers");
  const enhancementV2 = fs.readFileSync(path.join(repoRoot, "src/systems/enhancementV2.js"), "utf8");
  const worker = fs.readFileSync(path.join(repoRoot, "workers/thornie-dungeons-api.js"), "utf8")
    .replace(/^import \{[\s\S]*?\} from "\.\/modules\/shared\.js";\s*/m, "")
    .replace(/^import \{ createSocialHandlers \} from "\.\/modules\/social\.js";\s*/m, "")
    .replace(/^import \{ createMailboxHandlers \} from "\.\/modules\/mailbox\.js";\s*/m, "")
    .replace(/^import \{ createAuthHandlers \} from "\.\/modules\/auth\.js";\s*/m, "")
    .replace(/^import \{ createLeaderboardHandlers \} from "\.\/modules\/leaderboard\.js";\s*/m, "")
    .replace(/^import "\.\.\/src\/systems\/enhancementV2\.js";\s*/m, "");
  return `${shared}\n${auth}\n${social}\n${mailbox}\n${leaderboard}\n${enhancementV2}\n${worker}`;
}

module.exports = { loadWorkerSource };
