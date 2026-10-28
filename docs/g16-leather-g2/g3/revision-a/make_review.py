from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,subprocess
import numpy as np
P=Path(__file__).resolve().parent;G3=P.parent;R=P.parents[3]
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
def panel(im,box,size):
 return im.crop(box).resize(size,Image.Resampling.LANCZOS)
def bg_image(im,size):
 b=Image.new('RGBA',size,(218,224,233,255));b.alpha_composite(im);return b
base=Image.open(R/'r2-upload/hero/v5/g2/base/attack_01.png').convert('RGBA')
comp=Image.open(P/'qa/attack_01_candidate_composite.png').convert('RGBA')
g2=Image.open(P.parents[1]/'qa/reassembled_preview.png').convert('RGBA')
old=Image.open(G3/'masters/weapon_free_pose_attempt_01.png').convert('RGBA').resize((1536,768),Image.Resampling.LANCZOS).crop((1152,0,1536,384)).resize((768,768),Image.Resampling.LANCZOS)
sheet=Image.new('RGBA',(2048,840),(236,239,244,255));d=ImageDraw.Draw(sheet)
for i,(im,title) in enumerate([(g2,'LOCKED G2 DESIGN'),(base,'CANONICAL ATTACK_01 BASE'),(old,'OLD REJECTED SOURCE / REF ONLY'),(comp,'NEW ATTACK_01 CANDIDATE / HOLD')]):
 d.text((i*512+12,18),title,font=small,fill=(30,40,55));tile=bg_image(im,(768,768)).resize((512,512));sheet.alpha_composite(tile,(i*512,62))
labels=['Design reference; no changes.','Original file and origin unchanged.','No pixels reused in new candidates.','G2 contour / hidden material unresolved.']
for i,t in enumerate(labels):d.text((i*512+12,600),t,font=small,fill=(150,35,35) if i==3 else (30,40,55))
d.text((24,676),'PHASE A REVIEW HOLD — not an accepted fourth frame; 21/56 final paths retained.',font=font,fill=(150,35,35))
d.text((24,714),'Sword: untouched approved master, uniform offline rotation -115 degrees; grip center -> (310,309).',font=small,fill=(30,40,55))
d.text((24,748),'Face core [356,356,446,412] remains RGBA-identical to Base. No limb transforms.',font=small,fill=(30,40,55))
sheet.convert('RGB').save(P/'qa/ATTACK_01_RECONSTRUCTION_REVIEW.png')
details=[('HELMET / CHEEK: G2 CONTOUR REVIEW',(285,317,366,423)),('RAISED SHOULDER: DESIGN + HIDDEN CAP',(262,368,357,460)),('OPPOSITE WRIST / FULL GLOVE',(409,451,524,529)),('RIGHT-HAND / COMPLETE SWORD GRIP',(255,257,354,355))]
detail=Image.new('RGBA',(1600,1000),(235,238,243,255));d=ImageDraw.Draw(detail)
for i,(title,box) in enumerate(details):
 x=(i%2)*800;y=(i//2)*500;d.text((x+18,y+18),title,font=small,fill=(145,35,35));view=panel(comp,box,(360,360));bb=panel(base,box,(360,360));detail.alpha_composite(bg_image(view,view.size),(x+20,y+65));detail.alpha_composite(bg_image(bb,bb.size),(x+420,y+65));d.text((x+20,y+440),'Candidate composite',font=small,fill=(30,40,55));d.text((x+420,y+440),'Unchanged Base / same crop',font=small,fill=(30,40,55))
detail.convert('RGB').save(P/'qa/ATTACK_01_DETAIL_REVIEW.png')
# Isolated PNGs stay full canvas; only this review sheet uses zoomed details.
names=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front'];sheet=Image.new('RGBA',(1600,1080),(234,238,244,255));d=ImageDraw.Draw(sheet)
records=[]
for i,n in enumerate(names):
 path=P/'candidate_exports/attack_01'/f'{n}.png';im=Image.open(path).convert('RGBA');a=np.array(im)[:,:,3]
 x=(i%4)*400;y=(i//4)*540;d.text((x+15,y+16),n+' / CANDIDATE',font=small,fill=(35,45,60));bb=im.getbbox()
 if bb:
  crop=im.crop(bb);crop.thumbnail((340,400));tile=bg_image(crop,crop.size);sheet.alpha_composite(tile,(x+20,y+65))
 else:d.text((x+20,y+130),'INTENTIONALLY TRANSPARENT',font=small,fill=(35,45,60))
 r={'layer':n,'frame':'attack_01','status':'CANDIDATE_NOT_ACCEPTED','path':str(path.relative_to(R)),'dimensions':list(im.size),'mode':im.mode,'origin':[0,0],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'alphaBounds':bb,'alphaNonzeroPixels':int((a>0).sum()),'edgeAlphaNonzero':int((a[0]>0).sum()+(a[-1]>0).sum()+(a[:,0]>0).sum()+(a[:,-1]>0).sum())}
 assert im.size==(768,768) and im.mode=='RGBA' and r['edgeAlphaNonzero']==0
 if not bb:r['emptyReason']='Owner: coverage belongs to each equipment piece; no shared underlay artwork';assert n=='coverage_underlay'
 records.append(r)
sheet.convert('RGB').save(P/'qa/ATTACK_01_SEVEN_LAYER_REVIEW.png')
base_rgba=np.array(base);composite=np.array(comp)
x,y,r,b=356,356,446,412
assert np.array_equal(base_rgba[y:b,x:r],composite[y:b,x:r])
# Visibility diagnostic only: this is not a skin detector acceptance threshold.
x,y,r,b=446,478,516,524;v=base_rgba[y:b,x:r];c=composite[y:b,x:r];skin=(v[:,:,0]>170)&(v[:,:,1]>80)&(v[:,:,1]<220)&(v[:,:,2]<185)&(v[:,:,3]>200)
leak=int((skin&np.all(v==c,axis=2)).sum())
(P/'VALIDATION.json').write_text(json.dumps({'status':'PHASE_A_REVIEW_HOLD_NOT_ACCEPTED','risk':'MEDIUM','latestMainChecked':'32bca9eca232355a2ae98bc5f3fd54e9c5d28637','sourceMethod':'canonical per-pose Base + bounded equipment paintover; no rejected source pixels reused','finalPathsPresent':21,'candidatePaths':7,'candidateCountedAsFinal':False,'remainingFinalPaths':35,'baseSha256':hashlib.sha256((R/'r2-upload/hero/v5/g2/base/attack_01.png').read_bytes()).hexdigest(),'baseEdited':False,'faceCoreBox':[356,356,446,412],'faceCoreRGBAUnchanged':True,'oppositeHandDiagnostic':{'box':[446,478,516,524],'BaseSkinPixelsExactlyUnchangedInComposite':leak,'scope':'heuristic diagnostic, not full visual acceptance'},'sevenPngTechnicalChecks':'PASS','hiddenOverlapCompletion':'NOT_ACCEPTED; raised sleeve cap/helmet behind arm incomplete','designPreservation':'NOT_ACCEPTED; near cheek contour and raised shoulder differ from G2','cropDisposition':'[270,275,74,68] CANDIDATE ONLY; isolated helmet incomplete, no final clearance claim','G4Ready':False,'runtimeSourceModified':False,'r2Published':False,'productionTested':False,'files':records},indent=2)+'\n')
print('7 candidate PNG technical checks PASS; face core preserved; final accepted inventory remains 21/56; opposite-hand diagnostic remaining',leak)
