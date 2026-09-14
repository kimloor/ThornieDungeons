const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadPets() {
  const source = fs.readFileSync(path.join(__dirname, "../src/systems/pets.js"), "utf8") + "\nglobalThis.__pets={PET_V2_PLAYTEST,PET_POOL,PET_STAR_MULT,PET_STAR_UP_COST,petXpToNext,petCombatStats,getPetDef,grantActivePetBattleXp,petRunStateSnapshot,normalizePetRunState,petCarryHpForFloor,petProgressChange};";
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

test("rarity exposes Active-only R, Active+Passive SR, and Active+Passive+Extra SSR", () => {
  pets.PET_POOL.forEach(def => {
    assert.ok(def.active, `${def.id} active`);
    assert.equal(Boolean(def.passive), def.rarity !== "r", `${def.id} passive`);
    assert.equal(Boolean(def.extra), def.rarity === "ssr", `${def.id} extra`);
  });
});

test("only the participating active Pet gains 80% Hero EXP, including when dead", () => {
  const list = [{ instId: "active", defId: "sprout", level: 1, xp: 0, dead: true }, { instId: "other", defId: "flamekit", level: 1, xp: 0 }];
  const next = pets.grantActivePetBattleXp(list, "active", 25);
  assert.equal(next[0].xp, 20);
  assert.equal(next[1].xp, 0);
});

test("all eight Pet definitions expose the approved V2 role", () => {
  assert.deepEqual(
    Object.fromEntries(Array.from(pets.PET_POOL, pet => [pet.id, pet.role])),
    {
      sprout: "support", flamekit: "attack", sparkpup: "control", ember_fox: "attack",
      moon_hare: "support", hell_wolf: "control", inferno_drake: "tank", storm_phoenix: "control"
    }
  );
});

test("Pet run-state carries by active identity, revives dead Pets, and refills boss floors", () => {
  const live = { instId: "pet-a", hp: 17 };
  const snapshot = pets.petRunStateSnapshot(live, "pet-a");
  assert.deepEqual({ ...snapshot }, { activePetId: "pet-a", currentHp: 17, wasDead: false });
  assert.equal(pets.petCarryHpForFloor(2, "pet-a", null, JSON.stringify(snapshot), true), 17);
  assert.equal(pets.petCarryHpForFloor(2, "pet-b", null, snapshot, true), null);
  assert.equal(pets.petCarryHpForFloor(5, "pet-a", live, snapshot, true), null);
  assert.equal(pets.petCarryHpForFloor(2, "pet-a", { instId: "pet-a", hp: 0 }, snapshot, true), null);
  assert.equal(pets.petCarryHpForFloor(2, "pet-a", null, null, true), null);
});

test("result feedback derives actual applied Pet EXP and multi-level change without granting again", () => {
  const need1 = pets.petXpToNext(1);
  const before = [{ instId: "pet-a", defId: "sprout", level: 1, xp: need1 - 2 }];
  const after = pets.grantActivePetBattleXp(before, "pet-a", 100);
  const change = pets.petProgressChange(before, after, "pet-a");
  assert.equal(change.xpGained, 80);
  assert.equal(change.startLevel, 1);
  assert.ok(change.endLevel > 1);
  assert.equal(pets.petProgressChange([{ ...before[0], level: 50, xp: 0 }], [{ ...before[0], level: 50, xp: 0 }], "pet-a"), null);
});
