function hero(id, extra = {}) {
  return {
    id, kind: "hero", name: id,
    hp: 200, maxHp: 200, sp: 100, maxSp: 100,
    atk: 45, def: 8, speed: 100, accuracy: 100, dodge: 0, crit: 0, agi: 20,
    activeSkills: [], skills: {}, ...extra
  };
}

function pet(id, extra = {}) {
  return {
    id, kind: "pet", name: id, petDefId: "flamekit",
    hp: 80, maxHp: 80, atk: 18, def: 4, speed: 90,
    accuracy: 100, dodge: 0, crit: 0, ...extra
  };
}

function monster(id, extra = {}) {
  return {
    id, kind: "monster", name: id,
    hp: 100, maxHp: 100, atk: 12, def: 3, speed: 80,
    accuracy: 100, dodge: 0, crit: 0, ...extra
  };
}

module.exports = { hero, pet, monster };
