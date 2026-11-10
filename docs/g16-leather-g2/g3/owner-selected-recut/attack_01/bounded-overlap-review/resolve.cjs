// Offline fixture only. Does not write production manifest or runtime.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/phaser/presentation/HeroV5RuntimeContract.js','utf8'),ctx);
const config=JSON.parse(fs.readFileSync('r2-upload/manifest.json')).assets.hero001.v5.g2;
const slots=['helmet','chest','gloves','boots','weapon'],result={};
for(const family of ['azure','leather']) {
 const c=JSON.parse(JSON.stringify(config));
 if(family==='leather') {
  const dir='docs/g16-leather-g2/g3/owner-selected-recut/attack_01/bounded-overlap-review/exports/';
  c.equipment.leather={compositionProfile:'leather_overlap_v1',hairMode:'hidden_full_cover',
   frames:{attack_01:Object.fromEntries(['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front'].map(n=>[n,dir+n+'.png']))},
   handOcclusion:{sourceLayer:'arm_rear',after:'sword',frames:{attack_01:{crop:[278,282,65,58]}}}};
 }
 ctx.c=c;ctx.opts={includeHair:false,equipmentSelection:{equipment:Object.fromEntries(slots.map(x=>[x,family]))}};
 result[family]=vm.runInContext('heroV5FrameLayers(c,"attack_01",opts)',ctx);
}
assert.deepEqual(Array.from(result.azure,x=>x.name),['base','coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front']);
assert.deepEqual(Array.from(result.leather,x=>x.name),['base','coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet','sword','right_hand_occlusion']);
console.log(JSON.stringify(result,null,2));
