"""Bake sword anchors, composite previews and audit the proposed Azure-compatible package."""
from build import *
import math,zipfile
OUT=WORK/'package'
GRIPS={'idle_01':(270,505),'idle_02':(270,493),'idle_03':(270,501),'attack_01':(310,309),'attack_02':(489,448),'attack_03':(413,551)}
ANGLES={'idle_01':135,'idle_02':135,'idle_03':135,'attack_01':-55,'attack_02':32,'attack_03':110}
REVIEW=WORK/'previews';REVIEW.mkdir(exist_ok=True)
source=clean(Image.open(WORK/'sources/swords.png'))
manifest={};audit={'status':'TECHNICAL_CHECKS_PASS_VISUAL_REVIEW_REQUIRED','canvas':[768,768],'origin':[0,7],'runtimeTransforms':False,'sets':{}}
for si,kind in enumerate(['robot','skeleton']):
 root=OUT/kind;masters=root/'masters';masters.mkdir(exist_ok=True)
 half=source.crop((si*768,0,(si+1)*768,1024));bb=half.getbbox();crop=half.crop(bb);scale=700/crop.height;size=(round(crop.width*scale),700);crop=crop.resize(size,Image.Resampling.LANCZOS)
 master=Image.new('RGBA',(768,768));left=384-size[0]//2;master.alpha_composite(crop,(left,34));mp=masters/f'{kind.upper()}_SWORD_UPRIGHT.png';master.save(mp)
 # Hand center read from the approved isolated sword master sheet; hilt is separate from guard.
 rawgrip=(551 if kind=='robot' else 994,797 if kind=='robot' else 806)
 grip=(left+(rawgrip[0]-si*768-bb[0])*scale,34+(rawgrip[1]-bb[1])*scale)
 manifest[kind]={'layerOrder':LAYERS,'frames':{}}
 records={};composites=[];sheet=Image.new('RGB',(4*384,2*384),'#526171');sd=ImageDraw.Draw(sheet)
 for j,f in enumerate(FRAMES):
  folder=root/f
  sword=Image.new('RGBA',(768,768))
  if f in GRIPS:
   theta=math.radians(ANGLES[f]);sc=.60;linear=sc*np.array([[math.cos(theta),-math.sin(theta)],[math.sin(theta),math.cos(theta)]])
   target=np.array(GRIPS[f]);offset=target-linear@np.array(grip);m=np.column_stack([linear,offset]);inv=np.linalg.inv(np.vstack([m,[0,0,1]]))[:2].ravel()
   sword=master.transform((768,768),Image.Transform.AFFINE,tuple(inv),resample=Image.Resampling.BICUBIC)
  sword.save(folder/'sword.png')
  full=Image.open(BASE/f'{f}.png').convert('RGBA');armor=Image.new('RGBA',(768,768));paths={};rec={}
  for k in LAYERS:
   p=folder/f'{k}.png';im=Image.open(p);assert im.mode=='RGBA' and im.size==(768,768)
   arr=np.array(im);arr[arr[:,:,3]==0,:3]=0;im=Image.fromarray(arr);im.save(p);assert not np.any(arr[arr[:,:,3]==0,:3])
   if k=='sword':assert bool(im.getbbox())==(f in GRIPS)
   elif not im.getbbox():raise AssertionError((kind,f,k,'empty required layer'))
   armor.alpha_composite(im);full.alpha_composite(im);paths[k]=f'hero/v5/g2/equipment/{kind}/{f}/{k}.png'
   rec[k]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bbox':im.getbbox()}
  basea=np.array(Image.open(BASE/f'{f}.png'))[:,:,3];coverage=np.array(armor)[:,:,3];assert not np.any((basea>200)&(coverage<200))
  full.save(REVIEW/f'{kind}-{f}.png');composites.append(full)
  bg=Image.new('RGBA',(768,768),'#526171');bg.alpha_composite(full);sheet.paste(bg.resize((384,384)),(j%4*384,j//4*384));sd.text((j%4*384+10,j//4*384+10),f,fill='white')
  manifest[kind]['frames'][f]=paths;records[f]=rec
  # Flat frame source belongs in masters, not among runtime layer PNGs.
  flat=folder/'armor-composite.png'
  if flat.exists():flat.rename(masters/f'{f}_ARMOR_COMPOSITE.png')
 sheet.save(REVIEW/f'{kind}-contact-sheet.jpg')
 for name,idx,durations in [('idle',[0,1,2,1],[220,180,220,180]),('attack',[0,3,4,5,0],[450,150,110,200,450]),('death',[0,6,7],[500,300,1000])]:
  imgs=[]
  for n in idx:
   bg=Image.new('RGBA',(768,768),'#526171');bg.alpha_composite(composites[n]);imgs.append(bg.convert('RGB').resize((384,384)))
  imgs[0].save(REVIEW/f'{kind}-{name}.gif',save_all=True,append_images=imgs[1:],duration=durations,loop=0)
 audit['sets'][kind]={'frameCount':8,'layerCount':56,'sourceGrip':grip,'targetGrips':GRIPS,'swordScale':.60,'swordRotations':ANGLES,'baseCoverageCheck':'PASS: all opaque base pixels covered','frames':records}
 contract={'status':'REVIEW_CANDIDATE_NOT_PUBLISHED','canvas':[768,768],'origin':[0,7],'frameNames':FRAMES,'layerOrder':LAYERS,'fullDrawOrder':['wing_far','base','hair_back','hair_front']+LAYERS+['wing_near'],'runtimeTransforms':False,'swordSourceGrip':grip,'targetGrips':GRIPS,'deathSword':'transparent empty layer, matching Azure','base':'Unmodified canonical Hero V5 G2 base','coverage':'Dark sealed undersuit uses exact base silhouette; helm covers the face.','limitations':['Visible-pose cutouts, not a reusable rig or hidden-surface model.','Hair/wing integration and engine-scale visual approval still required.']}
 (root/'FRAME_CONTRACT.json').write_text(json.dumps(contract,indent=2))
(WORK/'MANIFEST_PROPOSAL.json').write_text(json.dumps(manifest,indent=2))
# Freeze serialized layer bytes once; the audit and ZIP use the same snapshot.
frozen={}
for kind,st in audit['sets'].items():
 for frame,layers in st['frames'].items():
  for layer,rec in layers.items():
   key=f'{kind}/{frame}/{layer}.png';frozen[key]=(OUT/key).read_bytes();rec['sha256']=hashlib.sha256(frozen[key]).hexdigest()
(WORK/'VALIDATION.json').write_text(json.dumps(audit,indent=2))
zip_path=WORK/'HERO_V5_ROBOT_SKELETON_REVIEW.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(OUT.rglob('*')):
  if p.is_file() and p.name!='armor-composite.png':
   key=p.relative_to(OUT).as_posix()
   z.writestr(key,frozen[key]) if key in frozen else z.write(p,key)
 for p in [WORK/'VALIDATION.json',WORK/'MANIFEST_PROPOSAL.json']:z.write(p,p.name)
print(json.dumps({'layers':112,'zipBytes':zip_path.stat().st_size,'zipSha256':hashlib.sha256(zip_path.read_bytes()).hexdigest()},indent=2))

with zipfile.ZipFile(zip_path) as check:
 assert len(check.infolist())==134
 assert check.testzip() is None
 for kind,st in audit['sets'].items():
  for frame,layers in st['frames'].items():
   for layer,rec in layers.items():
    assert hashlib.sha256(check.read(f'{kind}/{frame}/{layer}.png')).hexdigest()==rec['sha256']
for p in REVIEW.glob('*.gif'):
 im=Image.open(p);im.load();assert im.n_frames>=3
print('PASS: 134 ZIP members, CRC, 112 hashes and six GIF decodes')
