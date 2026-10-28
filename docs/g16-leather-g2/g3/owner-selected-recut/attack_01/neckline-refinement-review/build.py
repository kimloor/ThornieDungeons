from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
from scipy.ndimage import map_coordinates
import numpy as np,json,hashlib,shutil,subprocess
P=Path(__file__).resolve().parent;R=P.parents[5];old=P.parent/'azure-order-correction/exports';E=P/'exports';E.mkdir(exist_ok=True);sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
N=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front'];trialpath=P.parent/'neckline-fit-study/torso_armor_TRIAL.png';trial=Image.open(trialpath).convert('RGBA')
# Generated donor is registered only by the fixed input review crop; no Base transform.
donorpath=P/'masters/generated_neckline_donor.png';donor=Image.open(donorpath).convert('RGBA').resize((256,256),Image.Resampling.LANCZOS);d=Image.new('RGBA',(768,768));d.paste(donor,(256,352));mask=Image.new('L',(768,768));ImageDraw.Draw(mask).rectangle((328,394,391,446),fill=255);mask=mask.filter(ImageFilter.GaussianBlur(1));chest=Image.composite(d,trial,mask)
# Bounded garment-edge fitting: raise/move only the right neckline toward the
# original neck edge so it covers the white undershirt sliver. Anatomy is untouched.
a=np.array(chest);y,x=np.mgrid[0:768,0:768].astype('float32');w=np.maximum(0,1-((x-375)/10)**2)*np.maximum(0,1-((y-430)/14)**2);w[(x<365)|(x>385)|(y<416)|(y>444)]=0
arr=np.stack([map_coordinates(a[:,:,i],[y+3*w,x+4*w],order=1,mode='constant') for i in range(4)],axis=-1);chest=Image.fromarray(arr)
source=np.array(Image.open(old/'torso_armor.png').convert('RGBA'));changed=np.any(source!=arr,axis=2);roi=np.zeros((768,768),bool);roi[388:450,324:397]=True;assert not changed[~roi].any();ys,xs=np.where(changed)
for n in N:
 if n=='torso_armor':chest.save(E/(n+'.png'))
 else:shutil.copyfile(old/(n+'.png'),E/(n+'.png'))
basepath=R/'r2-upload/hero/v5/g2/base/attack_01.png';base=Image.open(basepath).convert('RGBA');out=base.copy();order=['coverage_underlay','legs_boots','arm_front','torso_armor','helmet','sword','arm_rear']
for n in order:out=Image.alpha_composite(out,Image.open(E/(n+'.png')).convert('RGBA'))
out.save(P/'reassembled.png')
def flat(im):
 b=Image.new('RGBA',im.size,(220,225,233,255));b.alpha_composite(im);return b.convert('RGB')
flat(out).save(P/'REVIEW.png');box=(310,385,410,460);flat(out.crop(box)).resize((800,600),Image.Resampling.NEAREST).save(P/'NECK_DETAIL.png')
views=[Image.open(P.parent/'owner-layer-order/reassembled.png').convert('RGBA'),Image.open(P.parent/'neckline-fit-study/reassembled_TRIAL.png').convert('RGBA'),out];s=Image.new('RGB',(1200,390),(220,225,233));draw=ImageDraw.Draw(s)
for i,(label,im) in enumerate(zip(['BEFORE / high hollow collar','TRIAL / raw neckline cut','REFINED / finished leather + gold rim'],views)):
 draw.text((i*400+10,12),label,fill='black');s.paste(flat(im.crop(box)).resize((400,300),Image.Resampling.NEAREST),(i*400,42))
s.save(P/'NECK_COMPARISON.png')
files=[]
for n in N:
 f=E/(n+'.png');im=Image.open(f);a=np.array(im)[:,:,3];assert im.mode=='RGBA' and im.size==(768,768);assert not a[0].any() and not a[-1].any() and not a[:,0].any() and not a[:,-1].any();same=sha(f)==sha(old/f.name);assert same==(n!='torso_armor');files.append({'layer':n,'sha256':sha(f),'dimensions':[768,768],'mode':im.mode,'origin':[0,0],'alphaBounds':im.getbbox(),'alphaNonzeroPixels':int((a>0).sum()),'identicalToPrevious':same,**({'emptyReason':'Owner: coverage belongs to each equipment piece; no shared underlay artwork'} if n=='coverage_underlay' else {})})
protected=list((R/'docs/g16-leather-g2/exports/idle_01').glob('*.png'))+list((R/'docs/g16-leather-g2/g3/exports').glob('idle_*/*.png'))
for f in protected:assert subprocess.check_output(['git','show','origin/art/g16-g3-leather-frames:'+str(f.relative_to(R))],cwd=R)==f.read_bytes()
for f in [basepath,R/'src/phaser/presentation/HeroV5RuntimeContract.js',R/'r2-upload/manifest.json']:assert subprocess.check_output(['git','show','origin/main:'+str(f.relative_to(R))],cwd=R)==f.read_bytes()
report={'status':'NECKLINE_REFINEMENT_CANDIDATE_OWNER_REVIEW_PENDING','main':'7ef31753b969386d2750857dddaa53d44c03081c','branchParent':'0a6aaa407edcd1815dd3440bbaae731099e040dd','risk':'MEDIUM bounded art repair only','ownerLayerOrderAccepted':True,'fullAttack01ArtworkAccepted':False,'G3Complete':False,'G4Ready':False,'backToFront':['base']+order,'newArtMethod':'Built-in ImageGen isolated chest donor; only bounded neckline pixels admitted to candidate','generatedDonorSha256':sha(donorpath),'inputCrop':[256,352,512,608],'inputCropReviewSize':[1024,1024],'generatedSize':list(Image.open(donorpath).size),'donorUniformNormalization':[256,256],'donorCanvasPlacement':[256,352],'featheredRectangle':[328,394,391,446],'rightRimGarmentFit':{'support':[365,416,385,444],'samplingDeltaMaximum':[4,3],'anatomyAffected':False},'changedChestPixels':int(changed.sum()),'changedChestBounds':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'outsideBoundedRegionByteIdentical':True,'sixOtherExportsByteIdentical':True,'protectedIdlePngCount':len(protected),'baseSha256':sha(basepath),'baseModified':False,'runtimeChanged':False,'slotMappingChanged':False,'extraTorsoPass':False,'extraHandPass':False,'runtimeOffsetBaked':False,'finalInventoryPromotion':False,'productionChanges':False,'files':files,'knownIssues':['Owner must visually accept neckline and complete Attack_01 fit before other poses.','This uses Owner offline order, not a new runtime/profile implementation.','Previously existing white Base shirt under raised armpit is outside this neck repair and unchanged.']}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n');(P/'SHA256SUMS').write_text(''.join(sha(f)+'  '+str(f.relative_to(P))+'\n' for f in sorted(P.rglob('*')) if f.is_file() and f.name!='SHA256SUMS'));print(json.dumps({'status':report['status'],'changedBounds':report['changedChestBounds'],'changedPixels':report['changedChestPixels'],'protectedIdle':len(protected),'exports':7,'otherSixUnchanged':True}))
