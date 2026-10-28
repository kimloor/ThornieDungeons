from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,hashlib,json,shutil
P=Path(__file__).resolve().parent;A=P.parent;R=P.parents[5];E=P/'exports';E.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
records=[]
# Uniform whole-piece registration only. No Base or per-limb deformation.
for name,scale,left,top in [('legs_boots',.288,219,493),('arm_rear',.23,233,277),('arm_front',.21,383,438)]:
 raw=P/'masters'/f'{name}_raw.png';im=Image.open(raw).convert('RGBA');a=np.array(im);a[a[:,:,3]<12]=0;im=Image.fromarray(a);b=im.getbbox();tx=left-b[0]*scale;ty=top-b[1]*scale
 if name=='arm_front':
  # Rigid clothing registration around cap/wrist; no anatomy or source-limb deformation.
  import math
  angle=math.radians(-6);c=math.cos(angle);sn=math.sin(angle);scale=.21
  mat=np.array([[scale*c,-scale*sn],[scale*sn,scale*c]])
  trans=np.array([389,451])-mat@np.array([521,590]);tx,ty=map(float,trans);inv=np.linalg.inv(mat);t=-inv@trans
  out=im.transform((768,768),Image.Transform.AFFINE,(inv[0,0],inv[0,1],t[0],inv[1,0],inv[1,1],t[1]),Image.Resampling.BICUBIC)
 else:out=im.transform((768,768),Image.Transform.AFFINE,(1/scale,0,-tx/scale,0,1/scale,-ty/scale),Image.Resampling.BICUBIC)
 arr=np.array(out);arr[arr[:,:,3]<10]=0;out=Image.fromarray(arr);out.save(E/f'{name}.png');records.append({'layer':name,'rawDimensions':im.size,'rawBounds':b,'uniformScale':scale,'translation':[tx,ty]})
shutil.copyfile(A/'step-01-helmet/helmet.png',E/'helmet.png');shutil.copyfile(A/'step-02-chest/torso_armor.png',E/'torso_armor.png')
# Extend only hidden sleeve insertion using the same upper sleeve material.
rear=Image.open(E/'arm_rear.png').convert('RGBA');cap=rear.crop((278,405,317,442));under=Image.new('RGBA',(768,768));under.paste(cap,(287,425));rear=Image.alpha_composite(under,rear);rear.save(E/'arm_rear.png')
# Chest owns its narrow underarm seam filler; no shared coverage art.
chest=Image.open(E/'torso_armor.png').convert('RGBA');seam=chest.crop((310,451,323,490));under=Image.new('RGBA',(768,768));under.paste(seam,(294,452));chest=Image.alpha_composite(under,chest);chest.save(E/'torso_armor.png')
Image.new('RGBA',(768,768)).save(E/'coverage_underlay.png')
# Reuse complete weapon independently of all source masks.
shutil.copyfile(R/'docs/g16-leather-g2/g3/revision-a/candidate_exports/attack_01/sword.png',E/'sword.png')
# Bounded generated seam cleanup; only the two recorded equipment regions change.
clean=Image.open(P/'masters/seam_cleanup_raw.png').convert('RGBA').resize((768,768),Image.Resampling.LANCZOS)
for n,points in [('torso_armor',[(288,439),(314,439),(316,493),(295,493)]),('arm_front',[(404,451),(448,459),(487,469),(518,488),(520,528),(456,529),(420,490)])]:
 old=Image.open(E/f'{n}.png').convert('RGBA');mask=Image.new('L',(768,768));ImageDraw.Draw(mask).polygon(points,fill=255);o=np.array(old);g=np.array(clean);m=np.array(mask)>0;o[m]=g[m];o[o[:,:,3]<10]=0;Image.fromarray(o).save(E/f'{n}.png');mask.save(P/f'{n}_cleanup_mask.png')
# Chest-owned insertion extension covers the remaining neutral tank-top edge.
chest=Image.open(E/'torso_armor.png').convert('RGBA');patch=clean.crop((320,448,340,497));mask=Image.new('L',(20,49));ImageDraw.Draw(mask).polygon([(0,0),(18,0),(20,49),(12,49),(7,29),(3,14)],fill=255);under=Image.new('RGBA',(768,768));under.paste(patch,(289,448),mask);chest=Image.alpha_composite(under,chest);chest.save(E/'torso_armor.png')
parts={p.stem:Image.open(p).convert('RGBA') for p in E.glob('*.png')};basepath=R/'r2-upload/hero/v5/g2/base/attack_01.png';base=Image.open(basepath).convert('RGBA');crop=[277,277,67,69]
free=base.copy()
for n in ['coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet']:free=Image.alpha_composite(free,parts[n])
free.save(P/'weapon_free_composite.png');out=Image.alpha_composite(free,parts['sword']);x,y,w,h=crop;hand=Image.new('RGBA',(768,768));hand.paste(parts['arm_rear'].crop((x,y,x+w,y+h)),(x,y));out=Image.alpha_composite(out,hand);out.save(P/'reassembled_composite.png')
bg=Image.new('RGBA',(768,768),(218,224,233,255));bg.alpha_composite(out);bg.convert('RGB').save(P/'ASSEMBLY_REVIEW.png')
over=Image.new('RGBA',(768,768),(218,224,233,255));over.alpha_composite(Image.blend(base,free,.5));over.convert('RGB').save(P/'BASE_OVERLAY.png')
sheet=Image.new('RGBA',(1536,768),(218,224,233,255));s=Image.open(A/'step-01-helmet/owner_source.png').convert('RGBA').resize((768,768),Image.Resampling.LANCZOS);sheet.alpha_composite(s,(0,0));sheet.alpha_composite(out,(768,0));d=ImageDraw.Draw(sheet);d.text((20,20),'OWNER SELECTED SOURCE',fill=(25,35,50));d.text((788,20),'ACTUAL EXPORTED PARTS + UNCHANGED BASE / REVIEW',fill=(25,35,50));sheet.convert('RGB').save(P/'SOURCE_VS_ASSEMBLY.png')
sheet=Image.new('RGBA',(1600,1000),(230,234,240,255));d=ImageDraw.Draw(sheet)
names=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front'];files=[]
for i,n in enumerate(names):
 im=parts[n];ar=np.array(im)[:,:,3];assert im.size==(768,768);edge=int((ar[0]>0).sum()+(ar[-1]>0).sum()+(ar[:,0]>0).sum()+(ar[:,-1]>0).sum());assert edge==0
 f={'layer':n,'dimensions':[768,768],'mode':im.mode,'origin':[0,0],'alphaBounds':im.getbbox(),'alphaNonzeroPixels':int((ar>0).sum()),'edgeAlphaNonzero':edge,'sha256':sha(E/f'{n}.png')}
 if n=='coverage_underlay':assert not ar.any();f['emptyReason']='Owner: coverage belongs to each equipment piece; no shared underlay artwork'
 files.append(f);x=i%4*400;y=i//4*500;d.text((x+12,y+14),n,fill=(25,35,50));b=im.getbbox()
 if b:
  im=im.crop(b);scale=min(350/im.width,400/im.height);im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);sheet.alpha_composite(im,(x+20,y+55))
sheet.convert('RGB').save(P/'SEVEN_PARTS_REVIEW.png')
report={'status':'ATTACK_01_REASSEMBLY_OWNER_REVIEW_PENDING','latestMainChecked':'7ef31753b969386d2750857dddaa53d44c03081c','compositionProfile':'leather_overlap_v1','hairMode':'hidden_full_cover','handOcclusion':{'sourceLayer':'arm_rear','after':'sword','frames':{'attack_01':{'crop':crop,'status':'OFFLINE_REVIEW_CANDIDATE'}}},'baseSha256':sha(basepath),'baseModified':False,'runtimeOffsetBaked':False,'registeredPieces':records,'files':files,'helmetBytesUnchanged':sha(E/'helmet.png')==sha(A/'step-01-helmet/helmet.png'),'chestBytesUnchanged':sha(E/'torso_armor.png')==sha(A/'step-02-chest/torso_armor.png'),'frontRegistration':{'rawCapAnchor':[521,590],'targetCapAnchor':[389,451],'uniformScale':.21,'rotationDegrees':-6},'hiddenMaterialCompletion':'rear cap copied from its own upper sleeve; narrow chest underarm seam copied from chest interior; prior standalone masters unchanged','sourcePixelIdentityClaim':False,'fullFrameVisualAccepted':False,'promotedToFinal56':False,'R2Published':False,'runtimeSourceModified':False}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n');print('7/7 review PNG paths pass dimension/alpha/hash; visual acceptance PENDING')
