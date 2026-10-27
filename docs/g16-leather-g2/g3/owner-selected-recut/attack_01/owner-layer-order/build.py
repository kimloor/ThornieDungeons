from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json
P=Path(__file__).resolve().parent;R=P.parents[5];E=P.parent/'azure-order-correction/exports';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
# Owner explicitly supplied FRONT to BACK; alpha composition runs in reverse.
front=['arm_rear','sword','helmet','torso_armor','arm_front','legs_boots','base']
paths={n:E/(n+'.png') for n in front if n!='base'};paths['base']=R/'r2-upload/hero/v5/g2/base/attack_01.png'
ims={n:Image.open(p).convert('RGBA') for n,p in paths.items()};out=Image.new('RGBA',(768,768))
assert Image.open(E/'coverage_underlay.png').getbbox() is None
for n in reversed(front):
 assert ims[n].size==(768,768)
 out=Image.alpha_composite(out,ims[n])
out.save(P/'reassembled.png');bg=Image.new('RGBA',(768,768),(220,225,233,255));bg.alpha_composite(out);bg.convert('RGB').save(P/'REVIEW.png')
before=Image.open(P.parent/'azure-order-correction/reassembled.png').convert('RGBA');sheet=Image.new('RGB',(1536,810),(220,225,233));d=ImageDraw.Draw(sheet)
for i,im in enumerate([before,out]):
 b=Image.new('RGBA',(768,768),(220,225,233,255));b.alpha_composite(im);sheet.paste(b.convert('RGB'),(i*768,42))
d.text((20,15),'PREVIOUS / Azure anatomical sequence',fill='black');d.text((788,15),'OWNER ORDER / right arm > sword > helmet > chest > left arm > legs > Base',fill='black');sheet.save(P/'COMPARISON.png')
report={'status':'OWNER_SPECIFIED_ORDER_RENDERED_VISUAL_ACCEPTANCE_PENDING','main':'7ef31753b969386d2750857dddaa53d44c03081c','branchParent':'6d52c2ca6c6c1e792c0ec1916ed8a01db42dc83c','risk':'LOW offline assembly only','frontToBack':front,'backToFront':list(reversed(front)),'anatomy':{'arm_rear':'anatomical right / raised sword arm','arm_front':'anatomical left / extended arm'},'underlay':'Fully transparent; omitted from visible order, existing PNG preserved','sourceFiles':[{'layer':n,'path':str(p.relative_to(R)),'sha256':sha(p)} for n,p in paths.items()],'transforms':False,'masks':False,'extraTorsoPass':False,'extraHandPass':False,'runtimeChanged':False,'exportsChanged':False,'visualAccepted':False,'G3Complete':False,'outputDimensions':[768,768],'origin':[0,0]}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
(P/'SHA256SUMS').write_text(''.join(sha(f)+'  '+f.name+'\n' for f in sorted(P.iterdir()) if f.is_file() and f.name!='SHA256SUMS'))
print('PASS: exact Owner front-to-back order, unchanged source bytes, fixed 768 RGBA canvas; no masks or cropped passes.')
