from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,shutil,numpy as np
P=Path(__file__).resolve().parent;old=P.parent/'owner-position-correction';R=P.parents[5];E=P/'exports';E.mkdir(exist_ok=True)
for f in (old/'exports').glob('*.png'):
 if f.stem=='helmet':
  im=Image.open(f).convert('RGBA');o=Image.new('RGBA',(768,768));o.paste(im,(-4,0));o.save(E/f.name)
 else:shutil.copyfile(f,E/f.name)
azure=json.loads((P/'AZURE_RESOLVED_LAYERS.json').read_text());mapping={'arm_rear':'arm_front','arm_front':'arm_rear'};order=[mapping.get(x['name'],x['name']) for x in azure]
assert order==['base','coverage_underlay','torso_armor','legs_boots','arm_front','helmet','sword','arm_rear']
basepath=R/'r2-upload/hero/v5/g2/base/attack_01.png';base=Image.open(basepath).convert('RGBA');out=base.copy()
for n in order[1:]:out=Image.alpha_composite(out,Image.open(E/f'{n}.png').convert('RGBA'))
out.save(P/'reassembled.png');bg=Image.new('RGBA',(768,768),(220,225,233,255));bg.alpha_composite(out);bg.convert('RGB').save(P/'REVIEW.png')
az=base.copy()
for layer in azure[1:]:az=Image.alpha_composite(az,Image.open(R/'r2-upload'/layer['path'].split('?')[0]).convert('RGBA'))
sheet=Image.new('RGBA',(1536,768),(220,225,233,255));sheet.alpha_composite(az);sheet.alpha_composite(out,(768,0));d=ImageDraw.Draw(sheet);d.text((20,20),'AZURE / ACTUAL RESOLVER ORDER',fill=(25,35,50));d.text((788,20),'LEATHER / SAME ANATOMICAL ORDER / REVIEW',fill=(25,35,50));sheet.convert('RGB').save(P/'AZURE_ORDER_COMPARISON.png')
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();files=[]
for f in E.glob('*.png'):
 im=Image.open(f);a=np.array(im)[:,:,3];assert im.mode=='RGBA' and im.size==(768,768);assert not a[0].any() and not a[-1].any() and not a[:,0].any() and not a[:,-1].any();files.append({'layer':f.stem,'sha256':sha(f),'dimensions':[768,768],'mode':im.mode,'alphaBounds':im.getbbox(),'identicalToPrevious':sha(f)==sha(old/'exports'/f.name)})
report={'status':'OWNER_AZURE_ORDER_REVIEW_PENDING','helmetAdditionalDelta':[-4,0],'helmetTotalDeltaFromAzurePlacement':[-16,0],'azureResolverOrder':[x['name'] for x in azure],'anatomicalMapping':mapping,'leatherAuthoringOrder':order,'extraTorsoPass':False,'extraHandPass':False,'baseSha256':sha(basepath),'baseModified':False,'runtimeSourceModified':False,'leatherRuntimeProfileCompatibility':'DEV REVIEW REQUIRED; current Leather overlap profile does not resolve this order','visualApproved':False,'R2Uploaded':False,'files':files};(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
(P/'SHA256SUMS').write_text(''.join(sha(f)+'  '+str(f.relative_to(P))+'\n' for f in sorted(P.rglob('*')) if f.is_file() and f.name!='SHA256SUMS'));print('PASS: Azure actual resolver sequence mapped anatomically; helmet -4px; other six export bytes unchanged; 7 PNG technical checks')
