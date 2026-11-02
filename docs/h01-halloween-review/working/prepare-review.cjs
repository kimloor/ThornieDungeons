// Review-only exports; never imported by the game or its build.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../../..');
const out = path.dirname(__dirname);
const asset = p => path.join(root, 'r2-upload', p.split('?')[0]);
const uri = p => 'data:image/' + (p.endsWith('.webp') ? 'webp' : 'png') + ';base64,' + fs.readFileSync(p).toString('base64');
const text = (w,h,lines) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101421"/>${lines.map(([x,y,s,size=22])=>`<text x="${x}" y="${y}" fill="#eee6ff" font-family="sans-serif" font-size="${size}">${s.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`).join('')}</svg>`);
async function sheet(dest,w,h,lines,items) {
  const layers=[];
  for (const [file,x,y,ww,hh] of items) layers.push({input:await sharp(file).resize(ww,hh,{fit:'contain',background:'#00000000'}).png().toBuffer(),left:x,top:y});
  await sharp(text(w,h,lines)).composite(layers).png().toFile(path.join(out,dest));
}
(async()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'r2-upload/manifest.json')));
 const base=asset(m.assets.hero001.v5.g2.base.frames.idle_01);
 const azure=m.assets.hero001.v5.g2.equipment.azure.frames.idle_01;
 const weapon=path.join(out,'excaliburnt/EXCALIBURNT_IDLE_01_WEAPON_ONLY.png');
 const dressed=[];
 for(const layer of ['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet']) dressed.push({input:asset(azure[layer])});
 const bareComposite=path.join(out,'excaliburnt/HERO_BASE_COMPOSITE_IDLE_01.png');
 await sharp(base).composite([{input:weapon}]).png().toFile(bareComposite);
 const handStudy=path.join(out,'excaliburnt/HERO_HAND_OVERLAP_STUDY.png');
 const hand=await sharp(base).extract({left:240,top:475,width:60,height:65}).png().toBuffer();
 await sharp(base).composite([{input:weapon},{input:hand,left:240,top:475}]).png().toFile(handStudy);
 const azureComposite=path.join(out,'excaliburnt/HERO_AZURE_COMPOSITE_IDLE_01.png');
 await sharp(base).composite([...dressed,{input:weapon},{input:asset(azure.arm_front)}]).png().toFile(azureComposite);
 const reference=path.join(out,'working/AZURE_REFERENCE_IDLE_01.png');
 await sharp(base).composite([...dressed,{input:asset(azure.sword)},{input:asset(azure.arm_front)}]).png().toFile(reference);
 const gate=path.join(out,'gate/HALLOWEEN_GATE_PROTOTYPE.png');
 await sheet('gate/GATE_BEFORE_AFTER.png',1040,880,[[36,40,'H01-03 / BOSS GATE RECOLOR REVIEW',26],[130,820,'Original / Gold'],[650,820,'Prototype / Dark purple'],[36,856,'Concept only - no production export or integration',17]],[[asset('ui/dungeon-select/dungeon-gate-boss-v2.webp'),30,65,480,720],[gate,530,65,480,720]]);
 await sheet('excaliburnt/HERO_GRIP_REVIEW.png',1536,900,[[35,42,'EXCALIBURNT / IDLE_01 ALIGNMENT REVIEW',28],[70,805,'Unchanged Base + weapon'],[570,805,'Azure + Excaliburnt'],[1090,805,'Azure reference'],[35,850,'Grip (270,505) / review composite only / no hand pixels in weapon',20]],[[bareComposite,0,60,512,720],[azureComposite,512,60,512,720],[reference,1024,60,512,720]]);
 await sheet('excaliburnt/HAND_OCCLUSION_COMPARISON.png',1100,820,[[35,42,'HAND OCCLUSION / AUTHORING STUDY ONLY',27],[50,740,'Raw Base + complete weapon'],[590,740,'Same Base hand restored in front'],[35,790,'Hand copied at unchanged coordinates; not a runtime layer authorization',18]],[[bareComposite,0,60,550,650],[handStudy,550,60,550,650]]);
 const icon=path.join(out,'excaliburnt/EXCALIBURNT_ICON_512.png');
 await sheet('excaliburnt/EXCALIBURNT_DESIGN_REVIEW.png',1280,1050,[[35,42,'EXCALIBURNT / MASTER + ICON PROTOTYPE',28],[70,1000,'Sword / Mythic / no unique status',21],[680,680,'Icon 512 x 512 / transparent',22],[680,750,'Small-size checks: 24 / 32 / 40 / 64 px',20],[680,945,'Stone stays at the blade tip',22]],[[path.join(out,'excaliburnt/EXCALIBURNT_MASTER_UPRIGHT.png'),0,60,640,900],[icon,680,100,512,512],[icon,700,800,24,24],[icon,760,796,32,32],[icon,825,792,40,40],[icon,910,780,64,64]]);
 const boss=path.join(out,'boss/HALOWEEN_NIGHTMARE_IDLE_01.png');
 const sil=path.join(out,'working/BOSS_SILHOUETTE.png');
 await sharp(boss).linear([0,0,0,1],[230,222,250,0]).png().toFile(sil);
 await sheet('boss/HALOWEEN_NIGHTMARE_CONCEPT_SHEET.png',1440,1000,[[35,42,'Haloween nightmare / CONCEPT + IDLE PROTOTYPE',29],[50,915,'Mounted grim reaper / skeletal horse / scythe / faces LEFT',23],[50,960,'One idle only - animation, rig and runtime acceptance pending',20]],[[boss,0,80,900,800],[sil,925,120,470,470],[boss,1035,660,240,240]]);
 await sheet('H01_03_REVIEW_OVERVIEW.png',1600,900,[[35,44,'H01-03 / HALLOWEEN GRAPHICS CONCEPT REVIEW',30],[75,840,'A / Boss Gate recolor'],[570,840,'B / Haloween nightmare'],[1190,840,'C / Excaliburnt'],[35,880,'Owner visual approval required / concept only / no production integration',18]],[[gate,25,80,400,700],[boss,440,100,700,700],[path.join(out,'excaliburnt/EXCALIBURNT_MASTER_UPRIGHT.png'),1140,80,420,700]]);
 for(const [name,file] of [['BASE',bareComposite],['AZURE',azureComposite],['HAND_STUDY',handStudy]]) await sharp(file).extract({left:215,top:455,width:135,height:120}).resize(540,480).png().toFile(path.join(out,`excaliburnt/GRIP_DETAIL_${name}.png`));
 const slots=[[79,2,.62],[58,20,.72],[75,39,.86],[49,58,.8],[23,72,.88]];
 const metrics=[];
 for(const [w,h] of [[360,800],[390,844],[1280,900]]){
  // Deterministic image composition, not a browser/runtime screenshot.
  const mh=h-230,mw=Math.round(mh*941/1672),mx=Math.round((w-mw)/2),my=140;
  const layers=[{input:await sharp(asset('ui/dungeon-select/dungeon-floor-select-v2.webp')).resize(mw,mh).png().toBuffer(),left:mx,top:my}];
  const rects={};
  for(const [i,[x,y,s]] of slots.entries()){
   const boss=i===1, gw=Math.round((boss?104:94)*s),gh=Math.round((boss?124:116)*s);
   const xx=Math.round(mx+mw*x/100-gw/2),yy=Math.round(my+mh*y/100+25*s);
   layers.push({input:await sharp(asset(`ui/dungeon-select/dungeon-gate-${boss?'boss':'normal'}-v2.webp`)).resize(gw,gh,{fit:'contain'}).png().toBuffer(),left:xx,top:yy});
   const label=Buffer.from(`<svg width="50" height="22" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="48" height="20" rx="6" fill="#0a1426" stroke="#bd994f"/><text x="25" y="16" text-anchor="middle" font-size="14" fill="#ffe3a0" font-family="sans-serif">${11-i}</text></svg>`);
   layers.push({input:label,left:Math.round(mx+mw*x/100-25),top:Math.round(my+mh*y/100)});
   rects['floor'+(11-i)]={x:xx,y:yy,width:gw,height:gh};
  }
  const e={x:Math.round(mx+mw*.31-104*.72/2),y:Math.round(my+mh*.13),width:Math.round(104*.72),height:Math.round(124*.72)};
  layers.push({input:await sharp(gate).resize(e.width,e.height,{fit:'contain'}).png().toBuffer(),left:e.x,top:e.y});
  const chrome=Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#070d1a"/><g font-family="sans-serif" text-anchor="middle"><text x="${w/2}" y="22" font-size="11" fill="#c4a5f4">H01-03 / PLACEMENT CONCEPT</text><rect x="10" y="34" width="${w-20}" height="34" rx="9" fill="#0e1b31" stroke="#8c6b32"/><text x="${w/2}" y="56" fill="#e9c67b" font-size="11">Gold 12,340 · Diamond 120 · Stones 24</text><text x="${w/2}" y="102" fill="#ffe5a0" font-size="20">DUNGEON FLOORS</text><text x="32" y="104" fill="#ffe5a0" font-size="30">‹</text><rect x="10" y="${h-76}" width="${w-20}" height="48" rx="10" fill="#0e1b31" stroke="#8c6b32"/><text x="${w/2}" y="${h-47}" fill="#e9c67b" font-size="11">Character · Inventory · Pets · Guild · Town</text><text x="${w/2}" y="${h-10}" fill="#a99abd" font-size="9">Static portrait-map study / sample UI / no runtime QA</text></g></svg>`);
  await sharp(chrome).composite(layers).png().toFile(path.join(out,`gate/PLACEMENT_${w}.png`));
  metrics.push({viewport:[w,h],event:e,...rects,map:{x:mx,y:my,width:mw,height:mh},header:{x:0,y:76,width:w,height:54},currency:{x:10,y:34,width:w-20,height:34},dock:{x:10,y:h-76,width:w-20,height:48}});
 }
 fs.writeFileSync(path.join(out,'gate/PLACEMENT_MEASUREMENTS.json'),JSON.stringify({kind:'static concept; not runtime QA',portraitMap:true,sourceGateSlotsUnchanged:slots,eventProposal:{xPercent:31,yPercent:13,scale:.72},viewports:metrics},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
