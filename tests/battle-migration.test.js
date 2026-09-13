const test = require("node:test");
const assert = require("node:assert/strict");
global.HERO_SKILLS_V1 = require("../src/systems/heroSkillsV1.js").HERO_SKILLS_V1;
const migration = require("../src/systems/battleMigration.js");

test("legacy skills reset to level entitlement while unrelated state is preserved", () => {
  const old = { diamonds: 77, character: { level: 40, skillLevels: { fireball: 7 } }, pets: [], quickSlots: [{ kind: "skill", key: "fireball" }, { kind: "potion" }, null, null] };
  const next = migration.migrateBattleV1Save(old);
  assert.equal(next.diamonds, 77);
  assert.deepEqual(next.character.skillLevels, {});
  assert.equal(next.character.skillResetPoints, 39);
  assert.equal(next.quickSlots[0], null);
  assert.equal(next.quickSlots[1].kind, "potion");
});

test("Thunder Cub maps to Hell Wolf and stars clamp without orphaning identity", () => {
  const next = migration.migrateBattleV1Save({ character: { level: 2, skillVersion: 1 }, pets: [{ instId: "p1", defId: "thunder_cub", star: 5, xp: 44 }], petDuplicates: { thunder_cub: 2, hell_wolf: 1 }, activePetId: "p1" });
  assert.deepEqual(next.pets[0], { instId: "p1", defId: "hell_wolf", star: 3, xp: 44 });
  assert.equal(next.petDuplicates.hell_wolf, 3);
  assert.equal(next.activePetId, "p1");
});
