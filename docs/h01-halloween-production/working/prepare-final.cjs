// Offline graphics evidence only. Does not edit the game, manifest or runtime.
const fs=require('fs'),path=require('path'),vm=require('vm'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),out=path.dirname(__dirname),assets=path.join(out,'assets');
const frameIds=['idle_01','idle_02','idle_03','attack_01','attack_02','attack_03','death_01','death_02'];
const asset=p=>path.join(root,'r2-upload',p.split('?')[0]);
const qa=path.join(out,'qa');fs.mkdirSync(qa,{recursive:true});
const art=p=>path.join(assets,p);
const svg=(w,h,texts)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#111725"/>${texts.map(([x,y,s,size=20])=>`<text x="${x}" y="${y}" fill="#ede4ff" font-family="sans-serif" font-size="${size}">${s.replace(/&/g,'&amp;')}</text>`).join('')}</svg>`);
async function sheet(file,items,cols,title,tile=320){let rows=Math.ceil(items.length/cols),layers=[],texts=[[24,34,title,24]];for(let i=0;i<items.length;i++){let x=(i%cols)*tile,y=60+Math.floor(i/cols)*(tile+32);layers.push({input:await sharp(items[i].file).resize(tile,tile).png().toBuffer(),left:x,top:y});texts.push([x+12,y+tile+22,items[i].label,15]);}await sharp(svg(cols*tile,60+rows*(tile+32),texts)).composite(layers).png().toFile(path.join(qa,file));}
async function flattenLayers(layers){let composites=[];for(const layer of layers){let file=layer.path.startsWith('h01-review:')?art(layer.path.slice(11)):asset(layer.path);let input;if(layer.crop){const [left,top,width,height]=layer.crop;input=await sharp(file).extract({left,top,width,height}).extend({left,top,right:768-left-width,bottom:768-top-height,background:'#00000000'}).png().toBuffer();}else input=file;composites.push({input});}return sharp({create:{width:768,height:768,channels:4,background:'#00000000'}}).composite(composites).png().toBuffer();}
(async()=>{
 const sources=JSON.parse(fs.readFileSync(path.join(__dirname,'BOSS_SOURCE_FILES.json'))),bosspath='monsters/haloween_nightmare';
 fs.copyFileSync(path.join(root,'docs/h01-halloween-review/boss/HALOWEEN_NIGHTMARE_IDLE_01.png'),art(bosspath+'/idle_01.png'));
 const sourceEvidence=[];
 for(const [id,name]of Object.entries(sources)){
  const src=path.join(__dirname,'boss-sources',name),meta=await sharp(src).metadata();
  const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});let cleaned=0;
  for(let i=3;i<data.length;i+=4)if(data[i]>0&&data[i]<4){data[i]=0;cleaned++;}
  await sharp(data,{raw:info}).resize(768,768).png().toFile(art(bosspath+'/'+id+'.png'));
  sourceEvidence.push({frame:id,source:name,sourceDimensions:[meta.width,meta.height],uniformCanvasScale:768/meta.width,origin:[0,0],trim:false,recenter:false,alphaCleanup:'only source alpha values 1..3 set to 0',removedSubvisibleAlphaPixels:cleaned});
 }
 fs.writeFileSync(path.join(out,'BOSS_AUTHORING.json'),JSON.stringify({approvedIdle01CopiedUnchanged:true,frames:sourceEvidence,phaserOrigin:[.5,1],ground:'standing foot contacts near y704; exact per-frame pixel measurements in VALIDATION.json'},null,2)+'\n');
 await sheet('BOSS_CONTACT_SHEET.png',Object.keys({idle_01:1,...sources}).map(id=>({file:art(bosspath+'/'+id+'.png'),label:id})),4,'Haloween nightmare / 7-frame artwork review',320);
 await sheet('WEAPON_CONTACT_SHEET.png',frameIds.map(id=>({file:art('hero/v5/g2/weapons/excaliburnt/'+id+'.png'),label:id+(id.startsWith('death')?' (intentional empty)':'')})),4,'Excaliburnt / fixed-canvas weapon layers',320);
 const m=JSON.parse(fs.readFileSync(path.join(root,'r2-upload/manifest.json'))),config=structuredClone(m.assets.hero001.v5.g2);
 config.equipment.excaliburnt={approval:'approved',frames:Object.fromEntries(frameIds.map(id=>[id,{sword:'h01-review:hero/v5/g2/weapons/excaliburnt/'+id+'.png'}]))};
 const context=vm.createContext({ASSETS:{hero001:{v5:{g2:config}}},URLSearchParams});
 vm.runInContext(fs.readFileSync(path.join(root,'src/phaser/presentation/HeroV5RuntimeContract.js'),'utf8')+'\nthis.frameLayers=heroV5FrameLayers;this.resolve=resolveHeroV5BaseWingContract;',context);
 const selections={bare:{},azure:{helmet:'azure',chest:'azure',gloves:'azure',boots:'azure'},azure_no_gloves:{helmet:'azure',chest:'azure',boots:'azure'},leather:{helmet:'leather',chest:'leather',gloves:'leather',boots:'leather'},leather_no_gloves:{helmet:'leather',chest:'leather',boots:'leather'},mixed:{helmet:'skeleton',chest:'leather',gloves:'azure',boots:'robot'},mixed_leather_gloves:{helmet:'azure',chest:'skeleton',gloves:'leather',boots:'azure'}};
 const reports=[];
 for(const [name,equipment]of Object.entries(selections)){
  const folder=path.join(qa,'hero',name);fs.mkdirSync(folder,{recursive:true});const items=[];
  for(const id of frameIds){const selection={equipment,bossWeapon:'excaliburnt'},layers=context.frameLayers(config,id,{includeHair:true,equipmentSelection:selection});
   const target=path.join(folder,id+'.png');fs.writeFileSync(target,await flattenLayers(layers));items.push({file:target,label:id});
   const swordIndex=layers.findIndex(l=>l.name==='sword'),post=layers.slice(swordIndex+1).map(l=>l.name);
   reports.push({selection:name,frame:id,layers:JSON.parse(JSON.stringify(layers)),postSwordLayers:post,hasScopedHandPass:post.includes('right_hand_occlusion'),note:'Actual main HeroV5RuntimeContract evaluated with isolated Excaliburnt texture config only; Sharp composition, NOT Phaser/browser/runtime QA; runtimeOffsetY=84 omitted equally from all layers in authoring-space output'});
  }
  await sheet('HERO_'+name.toUpperCase()+'_8_FRAMES.png',items,4,'Excaliburnt / '+name+' / exact current layer contract',280);
 }
 fs.writeFileSync(path.join(qa,'LAYER_CONTRACT_EVIDENCE.json'),JSON.stringify({productionManifestModified:false,fixtureConfigOnly:true,source:'src/phaser/presentation/HeroV5RuntimeContract.js',cases:reports},null,2)+'\n');
 const comparisons=[];
 for(const name of ['bare','azure','azure_no_gloves','leather','leather_no_gloves','mixed','mixed_leather_gloves']){
  const src=path.join(qa,'hero',name,'idle_01.png'),file=path.join(qa,'GRIP_'+name.toUpperCase()+'.png');
  await sharp(src).extract({left:215,top:455,width:135,height:120}).resize(540,480).png().toFile(file);comparisons.push({file,label:name});
 }
 await sheet('GRIP_COMPARISON.png',comparisons,4,'Idle_01 / gloves ON-OFF and mixed / current order evidence',300);
 const before=asset('ui/dungeon-select/dungeon-gate-boss-v2.webp'),after=art('ui/dungeon-select/dungeon-gate-halloween-v1.webp');
 await sheet('GATE_BEFORE_AFTER.png',[{file:before,label:'original Boss Gate unchanged'},{file:after,label:'Halloween final WebP Alpha'}],2,'Gate export / same full canvas and framing',500);
 for(const w of [360,390,1280])fs.copyFileSync(path.join(root,`docs/h01-halloween-review/gate/PLACEMENT_${w}.png`),path.join(qa,`GATE_MAP_${w}.png`));
 console.log(JSON.stringify({bossFrames:7,weaponPaths:8,heroComposites:reports.length,caseCount:Object.keys(selections).length}));
})().catch(e=>{console.error(e);process.exit(1)});
