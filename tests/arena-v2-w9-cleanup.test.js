const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const worker = fs.readFileSync(path.join(ROOT, 'workers/thornie-dungeons-api.js'), 'utf8');
const api = fs.readFileSync(path.join(ROOT, 'src/state/api.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'src/ui/components.js'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'src/data/styles.js'), 'utf8');

test('W9 closeout removes legacy Arena V1 runtime entry points', () => {
  for (const route of ['getArenaStatus', 'getArenaOpponents', 'startArenaMatch', 'submitArenaTurn']) {
    assert.doesNotMatch(worker, new RegExp('["\\']' + route + '["\\']'));
  }
  for (const helper of ['cloudGetArenaStatus', 'cloudGetArenaOpponents', 'cloudStartArenaMatch', 'cloudSubmitArenaTurn']) {
    assert.doesNotMatch(api, new RegExp('function ' + helper + '\\b'));
  }
  assert.doesNotMatch(ui, /function ArenaScreen\b|function ArenaLobby\b|PVP_TICKET_MAX_CLIENT/);
  assert.doesNotMatch(styles, /\.md-pvp-stage\b|\.md-pvp-unit\b|\.md-pvp-skill-btn\b/);
});

test('global Arena leaderboard compatibility key reads authoritative V2 season data', () => {
  assert.match(worker, /if \(board === "pvp"\)/);
  assert.match(worker, /FROM arena_season_players p/);
  assert.match(worker, /JOIN characters c ON c\.character_id = p\.character_id/);
  assert.match(worker, /ORDER BY p\.rating DESC, p\.attack_wins DESC, p\.rating_reached_at ASC, p\.character_id ASC/);
  assert.doesNotMatch(worker, /FROM pvp_ranking/);
});

test('Arena V2 runtime remains present after V1 cutover', () => {
  for (const route of ['getArenaV2Status', 'getArenaV2Opponents', 'prepareArenaV2Match', 'activateArenaV2Match', 'submitArenaV2Action']) {
    assert.match(worker, new RegExp(route));
  }
  assert.match(ui, /function ArenaV2Screen\b/);
  assert.match(api, /function cloudGetArenaV2Status\b/);
});
