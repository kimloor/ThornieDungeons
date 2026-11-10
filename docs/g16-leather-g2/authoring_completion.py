from pathlib import Path
from PIL import Image,ImageDraw,ImageChops,ImageFilter
from scipy import ndimage
import numpy as np,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
OLD=ROOT/'tmp/g16/weapon-free-g2/exports/idle_01'
OUT=ROOT/'tmp/g16/overlap-completed-g2'
DST=OUT/'exports/idle_01';DST.mkdir(parents=True,exist_ok=True)
(OUT/'qa').mkdir(exist_ok=True)
raw=Path('/workspace/scratch/6e896ce9ef5f/generated_images')
generated={'arm_rear':'exec-c05128b0-7056-4b99-b260-0a56c5318df4.png','arm_front':'exec-f1d047e9-d6f5-40a3-9f9c-8988c73dc45f.png','legs_boots':'exec-08049337-ce38-4dc8-85b5-97243305a7a7.png','torso_armor':'exec-9c059a03-3306-4547-bba9-e6e80625dee8.png'}
names=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front']
original={n:Image.open(OLD/f'{n}.png').convert('RGBA') for n in names}
parts={n:im.copy() for n,im in original.items()}
def normalize(path):
 im=Image.open(path).convert('RGBA').resize((768,768),Image.Resampling.LANCZOS)
 a=np.array(im);a[a[:,:,3]<12]=0;lab,_=ndimage.label(a[:,:,3]>0);size=np.bincount(lab.ravel());small=size<30;small[0]=False;a[small[lab]]=0
 return Image.fromarray(a)
for n,filename in generated.items():
 gen=normalize(raw/filename);gen.save(OUT/'qa'/f'{n}_generated_registered.png')
 old=original[n]; ga=np.array(gen);oa=np.array(old)
 yy,xx=np.indices(ga.shape[:2])
 if n in ('arm_rear','arm_front'):
  # Preserve original forearm and glove, blending only the hidden sleeve cap.
  join=433 if n=='arm_rear' else 446
  # Fit only the NEW hidden insertion sleeve back to the unchanged lower
  # sleeve cross-section. This prevents a double cut rim or open notch.
  mapped=np.zeros_like(ga)
  for y in range(join+4):
   gx=np.flatnonzero(ga[y,:,3]>16)
   if not len(gx):continue
   lo,hi=int(gx[0]),int(gx[-1])+1
   ox=np.flatnonzero(oa[y,:,3]>16)
   t=float(np.clip((y-(join-12))/12,0,1)) if len(ox) else 0
   nlo=round(lo*(1-t)+(int(ox[0]) if len(ox) else lo)*t)
   nhi=round(hi*(1-t)+(int(ox[-1])+1 if len(ox) else hi)*t)
   strip=Image.fromarray(ga[y:y+1,lo:hi]).resize((max(1,nhi-nlo),1),Image.Resampling.BICUBIC)
   mapped[y,nlo:nhi]=np.array(strip)[0]
  weight=np.clip((yy-(join-1))/4,0,1)
  mixed=(mapped.astype(float)*(1-weight[:,:,None])+oa.astype(float)*weight[:,:,None]).round().astype('uint8')
  mixed[yy>join+3]=oa[yy>join+3]
  parts[n]=Image.fromarray(mixed)
 elif n=='legs_boots':
  # Replace the pointed/jagged waist only. Knees and boots are the original.
  weight=np.clip((yy-505)/10,0,1)
  mixed=(ga.astype(float)*(1-weight[:,:,None])+oa.astype(float)*weight[:,:,None]).round().astype('uint8')
  mixed[yy>=515]=oa[yy>=515]
  parts[n]=Image.fromarray(mixed)
 elif n=='torso_armor':
  # Small source-matched edge completion; do not swap the approved interior.
  allowed=(ndimage.distance_transform_edt(oa[:,:,3]==0)<=6)&(yy<443)
  ga[~allowed]=0
  parts[n]=Image.alpha_composite(Image.fromarray(ga),old)
# Owner red mark: remove the thin far-side cheek strip below the brow.
im=parts['helmet'];cut=Image.new('L',(768,768));ImageDraw.Draw(cut).polygon([(426,317),(462,300),(480,301),(480,410),(426,410)],fill=255)
im.putalpha(ImageChops.subtract(im.getchannel('A'),cut));parts['helmet']=im

for n,im in parts.items():
 a=np.array(im);a[a[:,:,3]<10]=0;labels,_=ndimage.label(a[:,:,3]>0);sizes=np.bincount(labels.ravel());small=sizes<10;small[0]=False;a[small[labels]]=0
 if n=='helmet':
  labels,_=ndimage.label(a[:,:,3]>0);sizes=np.bincount(labels.ravel());sizes[0]=0;a[labels!=sizes.argmax()]=0
 if n in ('arm_rear','arm_front'):
  limit=436 if n=='arm_rear' else 449
  a[limit+1:]=np.array(original[n])[limit+1:]
 if n=='legs_boots':a[515:]=np.array(original[n])[515:]
 parts[n]=Image.fromarray(a);parts[n].save(DST/f'{n}.png')
 # Enlarged piece review remains separate from the registered export.
 bb=parts[n].getbbox()
 if bb:
  detail=parts[n].crop(bb);s=min(850/detail.width,700/detail.height);detail=detail.resize((round(detail.width*s),round(detail.height*s)))
  bg=Image.new('RGBA',detail.size,'#d9dfe6');bg.alpha_composite(detail);bg.convert('RGB').save(OUT/'qa'/f'{n}_detail.png')

base=Image.open(ROOT/'r2-upload/hero/v5/g2/base/idle_01.png').convert('RGBA')
# CURRENT contract retained as evidence, never silently called compatible.
contract=base.copy()
for n in names:contract.alpha_composite(parts[n])
contract.save(OUT/'qa/current_contract_order.png')
# Proposed authoring occlusion: sleeves and waist insertions under torso.
preview=base.copy()
proposed=['legs_boots','arm_rear','arm_front','torso_armor','helmet','sword']
for n in proposed:preview.alpha_composite(parts[n])
hand=parts['arm_rear'].copy();ha=np.array(hand);ha[:493,:,3]=0;ha[535:,:,3]=0;hand=Image.fromarray(ha)
preview.alpha_composite(hand);hand.save(OUT/'qa/right_hand_occlusion.png')
preview.save(OUT/'qa/reassembled_preview.png')
preview.save(OUT/'qa/idle_01_exact_order.png')
bg=Image.new('RGBA',(768,768),'#d9dfe6');bg.alpha_composite(preview);bg.convert('RGB').save(OUT/'qa/preview_on_grey.png')
records=[]
for n in names:
 a=np.array(parts[n]);o=np.array(original[n]);added=(a[:,:,3]>128)&(o[:,:,3]<128);removed=(a[:,:,3]<128)&(o[:,:,3]>128)
 opaque_above=np.zeros((768,768),bool)
 if n in proposed:
  for above in proposed[proposed.index(n)+1:]:opaque_above |= np.array(parts[above])[:,:,3]>240
 h=int((added&opaque_above).sum());v=int((added&(~opaque_above)).sum())
 rec={'name':n,'dimensions':[768,768],'mode':'RGBA','sha256':hashlib.sha256((DST/f'{n}.png').read_bytes()).hexdigest(),'addedAlphaPixels':int(added.sum()),'removedAlphaPixels':int(removed.sum()),'addedHiddenInProposedComposite':h,'addedVisibleInProposedComposite':v}
 if n in ('arm_rear','arm_front'):rec['originalLowerArmPixelsUnchanged']=bool(np.array_equal(a[(np.indices(a.shape[:2])[0]>(436 if n=='arm_rear' else 449))],o[(np.indices(a.shape[:2])[0]>(436 if n=='arm_rear' else 449))]))
 if n=='legs_boots':rec['originalPixelsFromY515Unchanged']=bool(np.array_equal(a[515:],o[515:]))
 records.append(rec)
 mask=np.zeros_like(a);mask[added]=[40,160,245,255];mask[removed]=[230,60,70,255];Image.fromarray(mask).save(OUT/'qa'/f'{n}_changes_blue_added_red_removed.png')
(OUT/'VALIDATION.json').write_text(json.dumps({'status':'G16_G2_OWNER_REVIEW_PENDING','coverageEmpty':True,'canvas':[768,768],'origin':[0,0],'runtimeChanged':False,'currentContractComposite':'qa/current_contract_order.png','proposedPreviewOrder':proposed+['right_hand_occlusion'],'runtimeCompatibility':'DEV approval required; proposed arms/waist-before-torso order differs from current contract','files':records},indent=2))
# Reuse sheet layout, explicitly label proposed preview rather than runtime.
code=(ROOT/'tmp/g16/g2-r3/make_review_sheet.py').read_text().replace('R3 REVIEW','OVERLAP COMPLETION').replace('G16_IDLE01_R3_ASSET_SHEET.png','G16_OVERLAP_COMPLETION_ASSET_SHEET.png')
code=code.replace('HELMET + HAIR','LEATHER HELMET').replace('Open brow guard; hair included','Far cheek strip removed at marked brow')
code=code.replace('03 BOOTS','03 LEGS / BOOTS').replace('Both boots; footwear edge coverage','Full waist insertion; original knees / boots')
code=code.replace('Image-left glove / wrist cuff','Rounded upper sleeve; original lower arm').replace('Image-right glove / wrist cuff','Rounded upper sleeve; original lower arm')
code=code.replace('Jerkin, shoulder, belt, side closure','Completed neck, shoulder + armhole edges')
code=code.replace('ASSEMBLED ON ORIGINAL BASE','PROPOSED OCCLUSION PREVIEW')
code=code.replace('Draw order:','Proposed preview order:').replace('Base > torso_armor > legs_boots','Base > legs > both sleeves > torso').replace('> arm_rear > helmet > sword > arm_front','> helmet > sword > right-hand pixels')
code=code.replace('No separate default hair in this composite','Sleeve/waist additions sit below torso').replace('Each export: 768 x 768 RGBA, origin (0,0)','768 x 768 RGBA; runtime order UNCHANGED')
code=code.replace('the current R3 cuts','the overlap-completed parts')
exec(compile(code,'make_review_sheet.py','exec'),{'__file__':str(OUT/'make_review_sheet.py')})
print(json.dumps(records))
