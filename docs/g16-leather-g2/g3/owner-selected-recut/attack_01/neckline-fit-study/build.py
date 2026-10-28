from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import numpy as np,json,hashlib,subprocess
P=Path(__file__).resolve().parent;R=P.parents[5];E=P.parent/'azure-order-correction/exports';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
basepath=R/'r2-upload/hero/v5/g2/base/attack_01.png';base=Image.open(basepath).convert('RGBA');parts={f.stem:Image.open(f).convert('RGBA') for f in E.glob('*.png')}
poly=[(327,388),(392,397),(394,417),(377,422),(372,428),(372,433),(368,436),(360,437),(350,433),(343,429),(338,420),(331,410)]
mask=Image.new('L',(768,768));ImageDraw.Draw(mask).polygon(poly,fill=255)
before=Image.open(P.parent/'owner-layer-order/reassembled.png').convert('RGBA');chest=parts['torso_armor'].copy();chest.putalpha(ImageChops.subtract(chest.getchannel('A'),mask));chest.save(P/'torso_armor_TRIAL.png');mask.save(P/'neckline_cut_mask.png');parts['torso_armor']=chest
order=['legs_boots','arm_front','torso_armor','helmet','sword','arm_rear'];after=base.copy()
for n in order:after=Image.alpha_composite(after,parts[n])
after.save(P/'reassembled_TRIAL.png')
def flat(im):
 b=Image.new('RGBA',im.size,(220,225,233,255));b.alpha_composite(im);return b.convert('RGB')
flat(after).save(P/'REVIEW_TRIAL.png')
# Proportional 3x enlargement, exact source coordinates. No body relocation.
sheet=Image.new('RGB',(1440,470),(220,225,233));d=ImageDraw.Draw(sheet)
owner=Image.open(P.parent/'step-01-helmet/owner_source.png').convert('RGBA').resize((768,768),Image.Resampling.LANCZOS)
for i,(name,im) in enumerate([('Canonical Base / original neck',base),('Owner source / reference',owner),('Before / collar hides neck',before),('Trial / neckline recut',after)]):
 d.text((i*360+8,15),name,fill='black');sheet.paste(flat(im.crop((310,385,430,465))).resize((360,240),Image.Resampling.NEAREST),(i*360,45))
d.text((15,320),'TRIAL ONLY: canonical neck revealed without head/body changes. Remaining shirt-edge and gold piping cleanup required.',fill='black');sheet.save(P/'NECK_COMPARISON.png')
orig=np.array(Image.open(E/'torso_armor.png'));modified=np.array(chest);changed=np.any(orig!=modified,axis=2);assert not changed[:388].any() and not changed[438:].any();assert np.array_equal(orig[:,:,:3],modified[:,:,:3])
for path in [basepath,R/'src/phaser/presentation/HeroV5RuntimeContract.js',R/'r2-upload/manifest.json']:assert subprocess.check_output(['git','show','origin/main:'+str(path.relative_to(R))],cwd=R)==path.read_bytes()
report={'status':'NECKLINE_METHOD_PROTOTYPE_NOT_FINAL','ownerOrderApproved':True,'artworkAccepted':False,'main':'7ef31753b969386d2750857dddaa53d44c03081c','branchParent':'b9c9a58fd56c5ce177412473fdb4d0b541c5c6de','risk':'LOW offline diagnostic and reversible neckline cut','finding':'Rigid high empty collar covers original neck and visually detaches head from torso. The cut reveals canonical neck skin.','method':'Alpha-only recut of candidate chest neckline; no new skin, pose or Base pixels. Keep full source chest and use a sibling TRIAL only.','polygon':poly,'changedChestAlphaPixels':int(changed.sum()),'rgbUnchanged':True,'sourceChestSha256':sha(E/'torso_armor.png'),'trialChestSha256':sha(P/'torso_armor_TRIAL.png'),'baseSha256':sha(basepath),'backToFront':['base']+order,'dimensions':[768,768],'origin':[0,0],'runtimeOffsetBaked':False,'runtimeChanged':False,'remainingWork':['Remove exposed white Base-shirt sliver at neck edge by adjusting chest-owned coverage.','Finish a narrow consistent leather/gold neckline following original neck; avoid recreating a tall hollow ring.','Retain original Base chin/neck shadow; inspect both helmet cheek edge and shoulder seams at gameplay scale.'],'productionChanges':False,'finalInventoryPromotion':False,'G3Complete':False}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n');(P/'SHA256SUMS').write_text(''.join(sha(f)+'  '+f.name+'\n' for f in sorted(P.iterdir()) if f.is_file() and f.name!='SHA256SUMS'));print('PASS: locked Owner order, chest alpha-only bounded neck cut, unchanged Base/manifest/runtime, trial not final.')
