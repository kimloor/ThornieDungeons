// Scoped offline metadata integration against the actual merged resolver.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../../..');
const m = JSON.parse(fs.readFileSync(path.join(__dirname, 'IDLE_METADATA.json')));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'src/phaser/presentation/HeroV5RuntimeContract.js'), 'utf8'), ctx);
const selection = {equipment:Object.fromEntries(['chest','gloves','boots','helmet','weapon'].map(k=>[k,'leather']))};
for (const frame of Object.keys(m.frames)) {
 const config = {base:{frames:{[frame]:'base.png'}},equipment:{leather:m},hair:{topknot:{frames:{[frame]:{hair_back:'back.png',hair_front:'front.png'}}}}};
 const result = ctx.heroV5FrameLayers(config, frame, {equipmentSelection:selection});
 assert.deepEqual(Array.from(result,x=>x.name),['base','coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet','sword','right_hand_occlusion']);
 assert.deepEqual(Array.from(result.at(-1).crop),m.handOcclusion.frames[frame].crop);
 assert.equal(result.at(-1).path,m.frames[frame].arm_rear);
 assert.ok(result.every(x=>x.x===0 && x.y===84 && x.scale===1 && x.rotation===0));
 console.log(frame, JSON.stringify(result.at(-1).crop), 'actual merged resolver PASS');
}
