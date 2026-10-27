"""G3 offline authoring/QA: exact Base idle translations; no runtime or R2 edits."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib,json,shutil,subprocess
import numpy as np
P=Path(__file__).resolve().parent; ROOT=P.parents[2];G2=P.parent
names=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front']
frames=['idle_01','idle_02','idle_03','attack_01','attack_02','attack_03','death_01','death_02']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=lambda f:Image.open(ROOT/'r2-upload/hero/v5/g2/base'/f'{f}.png').convert('RGBA')
source=base('idle_01'); records=[]; comps=[]
metadata={'compositionProfile':'leather_overlap_v1','hairMode':'hidden_full_cover','handOcclusion':{'sourceLayer':'arm_rear','after':'sword','frames':{}},'status':'IDLE_ONLY_REMAINING_POSES_BLOCKED','frames':{}}
for f,dy in [('idle_01',0),('idle_02',-12),('idle_03',-4)]:
 d=P/'exports'/f;d.mkdir(parents=True,exist_ok=True)
 t=Image.new('RGBA',(768,768));t.paste(source,(0,dy));assert t.tobytes()==base(f).tobytes()
 parts={}
 for n in names:
  orig=G2/'exports/idle_01'/f'{n}.png';target=d/f'{n}.png'
  if dy==0:shutil.copyfile(orig,target)
  else:
   im=Image.open(orig).convert('RGBA');out=Image.new('RGBA',(768,768));out.paste(im,(0,dy));out.save(target)
  im=Image.open(target);assert im.mode=='RGBA' and im.size==(768,768);parts[n]=im
  a=np.array(im)[:,:,3];r={'frame':f,'layer':n,'path':str(target.relative_to(ROOT)),'sha256':sha(target),'dimensions':[768,768],'mode':im.mode,'alphaBounds':im.getbbox(),'alphaNonzeroPixels':int((a>0).sum()),'edgeAlphaNonzero':int((a[0]>0).sum()+(a[-1]>0).sum()+(a[:,0]>0).sum()+(a[:,-1]>0).sum()),'offlineTranslation':[0,dy],'origin':[0,0]}
  if n=='coverage_underlay':
   assert not a.any();r['emptyReason']='Owner: coverage belongs to each equipment piece; no shared underlay artwork'
  assert r['edgeAlphaNonzero']==0
  if not dy:assert sha(orig)==sha(target)
  records.append(r)
 crop=[0,493+dy,768,42];metadata['handOcclusion']['frames'][f]={'crop':crop}
 metadata['frames'][f]={n:str((d/f'{n}.png').relative_to(ROOT)) for n in names}
 c=base(f)
 for n in ['coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet','sword']:c=Image.alpha_composite(c,parts[n])
 hand=Image.new('RGBA',(768,768));x,y,w,h=crop;hand.paste(parts['arm_rear'].crop((x,y,x+w,y+h)),(x,y));c=Image.alpha_composite(c,hand)
 if not dy:assert c.tobytes()==Image.open(G2/'qa/reassembled_preview.png').convert('RGBA').tobytes()
 c.save(P/'qa'/f'{f}_composite.png');comps.append(c)
for i,c in enumerate(comps):
 t=Image.new('RGBA',(768,768));t.paste(comps[0],(0,[0,-12,-4][i]));assert t.tobytes()==c.tobytes()
sheet=Image.new('RGBA',(1152,440),(222,226,232,255));dr=ImageDraw.Draw(sheet)
for i,c in enumerate(comps):
 sheet.alpha_composite(c.resize((384,384)),(i*384,30));dr.text((i*384+18,12),frames[i]+' / G4 REVIEW PENDING',fill=(20,25,30))
sheet.convert('RGB').save(P/'qa/IDLE_CONTACT_SHEET.png')
gifs=[]
for c in [comps[0],comps[1],comps[2],comps[1]]:
 bg=Image.new('RGBA',c.size,(222,226,232,255));bg.alpha_composite(c);gifs.append(bg.convert('RGB'))
gifs[0].save(P/'qa/idle_preview.gif',save_all=True,append_images=gifs[1:],duration=440,loop=0)
# Comparison uses ONLY uniform whole-sheet scaling to recover reference cell dimensions.
# It intentionally does not re-register individual generated bodies to conceal drift.
gen=Image.open(P/'masters/weapon_free_pose_attempt_01.png').convert('RGBA');native=gen.size;gen=gen.resize((1536,768),Image.Resampling.LANCZOS)
review=Image.new('RGBA',(1536,1000),(225,229,235,255));dr=ImageDraw.Draw(review)
for j,f in enumerate(frames[3:]):
 idx=frames.index(f);col=idx%4;row=idx//4;cell=gen.crop((col*384,row*384,(col+1)*384,(row+1)*384))
 x=(j%3)*512;y=(j//3)*500
 dr.text((x+12,y+12),f+' / HOLD: POSE + DESIGN DRIFT',fill=(155,30,30))
 b=base(f).resize((384,384));preview=Image.new('RGBA',(384,384),(100,105,115,255));preview.alpha_composite(cell)
 # cyan Base overlay makes actual pose mismatch visible without correcting it.
 a=b.getchannel('A').point(lambda v:round(v*.38));tint=Image.new('RGBA',b.size,(0,255,255,0));tint.putalpha(a);preview.alpha_composite(tint)
 review.alpha_composite(preview,(x+40,y+42));dr.text((x+12,y+440),'Cyan = unchanged Base; artwork = generated attempt',fill=(20,25,30))
review.convert('RGB').save(P/'qa/POSE_DRIFT_REVIEW.png')
(P/'IDLE_METADATA.json').write_text(json.dumps(metadata,indent=2)+'\n')
inventory=[{'frame':f,'layer':n,'status':'PRESENT_G4_PENDING' if f.startswith('idle') else 'MISSING_BLOCKED_POSE_REVIEW','path':str((P/'exports'/f/f'{n}.png').relative_to(ROOT)) if f.startswith('idle') else None} for f in frames for n in names]
report={'status':'G16_G3_BLOCKED_VISUAL_DEVIATION_REVIEW_REQUIRED','baseline':'1372ed16327aeb7290b1bad0a9c2fa022b425335','gate0Reused':True,'expectedPaths':56,'presentPaths':21,'missingPaths':35,'idle01ByteIdentical':True,'idleBaseExactTranslations':{'idle_02':[0,-12],'idle_03':[0,-4]},'idleCompositesExactTranslations':True,'generatedAttemptNativeDimensions':native,'generatedAttemptAccepted':False,'runtimeOffsetBaked':False,'runtimeManifestModified':False,'R2Published':False,'G4Ready':False,'inventory':inventory,'files':records,'baseHashes':{f:sha(ROOT/'r2-upload/hero/v5/g2/base'/f'{f}.png') for f in frames}}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
paths=sorted(p for p in P.rglob('*') if p.is_file() and p.name!='SHA256SUMS')
(P/'SHA256SUMS').write_text(''.join(f'{sha(p)}  {p.relative_to(P)}\n' for p in paths))
print('PASS: 21 PNG; locked Idle_01 bytes/composite; exact idle translations; alpha/dimension/no-clipping checks. HOLD: 35 paths, Attack/Death visual deviation.')
