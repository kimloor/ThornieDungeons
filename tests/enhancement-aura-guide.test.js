const test = require("node:test");
const assert = require("node:assert/strict");
const { INFO_GUIDE } = require("../src/data/infoGuide.js");

test("Enhancement Aura copy is a valid subsection of the existing Refine topic", () => {
  const expectedIds = ["drops", "refine", "enchant", "stats", "cc-boss", "sets", "dungeon", "arena", "raid", "pets"];
  assert.deepEqual(INFO_GUIDE.topics.map(topic => topic.id), expectedIds);
  const refine = INFO_GUIDE.topics.find(topic => topic.id === "refine");
  assert.ok(refine);
  const aura = refine.blocks.find(block => block.heading === "ออร่าจากการตีบวก");
  assert.ok(aura, "Aura must be nested in Refine blocks, not a detached topic");
  assert.match(aura.body.join(" "), /ไม่เพิ่มค่าสเตตัสหรือความสามารถในการต่อสู้/);
  assert.match(aura.body.join(" "), /หมวก ชุดเกราะ ถุงมือ และรองเท้า/);
  assert.match(aura.body.join(" "), /อาวุธ ปีก และเครื่องประดับไม่นำมาคำนวณ/);
  assert.match(aura.rows[0][1], /\+4: Stage 1.*\+10: Stage 4/);
});
