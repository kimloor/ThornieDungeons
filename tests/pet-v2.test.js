const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadPets() {
  const source = fs.readFileSync(path.join(__dirname, "../src/systems/pets.js"), "utf8") + "\nglobalThis.__pets={PET_V2_PLAYTEST,PET_POOL,PET_STAR_MULT,PET_STAR_UP_COST,petXpToNext,petCombatStats,getPetDef,grantActivePetBattleXp};";
  const sandbox = { console, Math, Date, BASE_SPEED: 100, roundInt: Math.round };
  vm.createContext(sandbox); vm.runInContext(source, sandbox); return sandbox.__pets;
}
const pets = loadPets();

test("Pet V2 roster maps Hell Wolf and keeps exactly 1-3 star progression", () => {
  assert.equal(pets.PET_POOL.length, 8);
  assert.ok(pets.getPetDef("hell_wolf"));
  assert.equal(pets.getPetDef("thunder_cub"), null);
  assert.deepEqual(Array.from(pets.PET_STAR_MULT), [1, 1.15, 1.35]);
  assert.deepEqual(Array.from(pets.PET_STAR_UP_COST), [1, 2]);
});

test("Pet level curve and centralized V2 stat conversion follow the contract", () => {
  assert.equal(pets.petXpToNext(1), Math.round(34 + 6 + .32));
  const sprout = pets.petCombatStats({ defId: "sprout", level: 1, star: 1 });
  assert.equal(sprout.atk, Math.round(5 + .7 + 3 * 2));
  assert.equal(sprout.maxHp, Math.round(30 + 4 + 5 * 7));
  const maxed = pets.petCombatStats({ defId: "sprout", level: 50, star: 3 });
  assert.ok(maxed.maxHp > sprout.maxHp);
  assert.ok(maxed.hitRate <= 99 && maxed.evasion <= 20 && maxed.critChance <= 25);
});

test("approved Pet actives and anti-loop metadata are present", () => {
  assert.equal(pets.getPetDef("sprout").active.cooldown, 3);
  assert.equal(pets.getPetDef("moon_hare").active.type, "groupHeal");
  assert.equal(pets.getPetDef("inferno_drake").extra.type, "heroBlock");
  assert.equal(pets.getPetDef("storm_phoenix").extra.type, "petCdrOnDebuff");
  assert.deepEqual({ ...pets.PET_V2_PLAYTEST }, { hellWolfPoisonAtkPct: 20, hellWolfPoisonTurns: 3 });
});

test("only the participating active Pet gains 80% Hero EXP, including when dead", () => {
  const list = [{ instId: "active", defId: "sprout", level: 1, xp: 0, dead: true }, { instId: "other", defId: "flamekit", level: 1, xp: 0 }];
  const next = pets.grantActivePetBattleXp(list, "active", 25);
  assert.equal(next[0].xp, 20);
  assert.equal(next[1].xp, 0);
});
