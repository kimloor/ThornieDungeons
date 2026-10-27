from pathlib import Path
from PIL import Image,ImageDraw
import subprocess,io,numpy as np,math,json,hashlib,shutil
P=Path(__file__).resolve().parent;R=P.parents[5];E=P/'exports';E.mkdir(exist_ok=True)
old='docs/g16-leather-g2/g3/owner-selected-recut/attack_01/assembly-review/exports/'
def oldimage(n):return Image.open(io.BytesIO(subprocess.check_output(['git','show','324cc1f:'+old+n+'.png'],cwd=R))).convert('RGBA')
def transform(im,scale,angle,source,target):
 t=math.radians(angle);m=scale*np.array([[math.cos(t),-math.sin(t)],[math.sin(t),math.cos(t)]]);v=np.array(target)-m@np.array(source);inv=np.linalg.inv(m);b=-inv@v;im=im.transform((768,768),Image.Transform.AFFINE,(inv[0,0],inv[0,1],b[0],inv[1,0],inv[1,1],b[1]),Image.Resampling.BICUBIC);return im,{'uniformScale':scale,'angleDegrees':angle,'sourceAnchor':source,'targetAnchor':target,'matrix':m.tolist(),'translation':v.tolist()}
records={}
for n,dx,dy in [('helmet',0,0),('arm_rear',0,0),('arm_front',2,-3),('legs_boots',-1,0)]:
 im=oldimage(n);out=Image.new('RGBA',(768,768));out.paste(im,(dx,dy));out.save(E/f'{n}.png');records[n]={'delta':[dx,dy],'basis':{'helmet':'shared canonical head reference; no Azure ornament bbox fitting','arm_rear':'Azure Attack01 raised grip [310,309] already shared','arm_front':'Azure opposite wrist visual alignment','legs_boots':'Azure left boot alpha contact x218 bottom667'}[n]}
chest=Image.open(P/'chest_clean_raw.png').convert('RGBA');chest,records['torso_armor']=transform(chest,.26,13,[711,848],[344,516]);chest.save(E/'torso_armor.png')
master=R/'docs/g16-leather-g2/exports/idle_01/sword.png';shutil.copyfile(master,P/'COMPLETE_SEPARATE_SWORD_MASTER.png');sword=Image.open(master).convert('RGBA');angle=math.degrees(math.atan2(133-272,79-264))-math.degrees(math.atan2(631-540,467-308));sword,records['sword']=transform(sword,1,angle,[270,515],[310,309]);sword.save(E/'sword.png')
Image.new('RGBA',(768,768)).save(E/'coverage_underlay.png')
parts={p.stem:Image.open(p).convert('RGBA') for p in E.glob('*.png')};basepath=R/'r2-upload/hero/v5/g2/base/attack_01.png';base=Image.open(basepath).convert('RGBA');free=base.copy()
for n in ['coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet']:free=Image.alpha_composite(free,parts[n])
free.save(P/'weapon_free.png');out=Image.alpha_composite(free,parts['sword']);crop=[277,277,67,69];x,y,w,h=crop;hand=Image.new('RGBA',(768,768));hand.paste(parts['arm_rear'].crop((x,y,x+w,y+h)),(x,y));out=Image.alpha_composite(out,hand);out.save(P/'reassembled.png');bg=Image.new('RGBA',(768,768),(219,225,234,255));bg.alpha_composite(out);bg.convert('RGB').save(P/'REVIEW.png')
manifest=json.load(open(R/'r2-upload/manifest.json'));af=manifest['assets']['hero001']['v5']['g2']['equipment']['azure']['frames']['attack_01'];az=base.copy()
for n in ['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front']:az=Image.alpha_composite(az,Image.open(R/'r2-upload'/af[n].split('?')[0]).convert('RGBA'))
sheet=Image.new('RGBA',(1536,768),(219,225,234,255));sheet.alpha_composite(az);sheet.alpha_composite(out,(768,0));d=ImageDraw.Draw(sheet);d.text((20,20),'CURRENT AZURE ATTACK_01',fill=(20,30,50));d.text((788,20),'LEATHER / SAME GRIP + AZURE POSITION GUIDES / REVIEW',fill=(20,30,50));sheet.convert('RGB').save(P/'AZURE_COMPARISON.png')
# No hand/face/body art is used as evidence for clean isolated armor.
a=parts['torso_armor'];b=a.getbbox();detail=a.crop(b);detail=detail.resize((round(detail.width*3),round(detail.height*3)),Image.Resampling.LANCZOS);bg=Image.new('RGBA',detail.size,(225,230,237,255));bg.alpha_composite(detail);bg.convert('RGB').save(P/'CHEST_CLEAN_DETAIL.png')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();files=[]
for f in E.glob('*.png'):
 im=Image.open(f);aa=np.array(im)[:,:,3];assert im.size==(768,768) and im.mode=='RGBA';assert not aa[0].any() and not aa[-1].any() and not aa[:,0].any() and not aa[:,-1].any();files.append({'name':f.stem,'size':[768,768],'mode':'RGBA','alphaBounds':im.getbbox(),'sha256':sha(f)})
report={'status':'OWNER_ALIGNMENT_REVIEW_PENDING','compositionProfile':'leather_overlap_v1','hairMode':'hidden_full_cover','handOcclusionCrop':crop,'transforms':records,'azureExactContractGrip':[310,309],'azureVisualGuides':{'buckle':[344,516],'oppositeWristAdjustment':[2,-3],'leftBootContact':[218,667]},'accuracy':'Grip is canonical contract; buckle/wrist are manual visual guides, not rig coordinates. Azure slot bboxes are not interchangeable anatomical anchors.','azureRaisedArmLayer':'arm_front','leatherRaisedArmLayer':'arm_rear','weaponSource':str(master.relative_to(R)),'weaponSourceSha256':sha(master),'baseSha256':sha(basepath),'baseModified':False,'runtimeArchitectureModified':False,'promotedToFinal':False,'R2Uploaded':False,'files':files}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n');print('7/7 RGBA fixed-canvas PNG pass; weapon angle',angle,'grip [310,309]; visual fit PENDING')
