from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib,shutil,subprocess
P=Path(__file__).resolve().parent;R=P.parents[5];old=P.parent/'azure-order-correction';E=P/'exports';E.mkdir(exist_ok=True);M=P/'review_masks';M.mkdir(exist_ok=True)
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
N=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front']
for n in N:shutil.copyfile(old/'exports'/f'{n}.png',E/f'{n}.png')
ims={n:Image.open(E/f'{n}.png').convert('RGBA') for n in N};basepath=R/'r2-upload/hero/v5/g2/base/attack_01.png';base=Image.open(basepath).convert('RGBA');torso=np.array(ims['torso_armor'])[:,:,3]
# Offline visibility experiment only: preserve all insertion material in exports.
# A torso-alpha complement in each bounded insertion window hides only overlap.
windows={'arm_rear':(275,390,340,470),'arm_front':(365,420,435,495),'legs_boots':(275,470,410,535)}
masked=dict(ims);stats=[]
for n,box in windows.items():
 arr=np.array(ims[n]);keep=np.full((768,768),255,dtype=np.uint8);x0,y0,x1,y1=box;keep[y0:y1,x0:x1]=255-torso[y0:y1,x0:x1];a=arr[:,:,3].copy();arr[:,:,3]=((a.astype(np.uint16)*keep.astype(np.uint16)+127)//255).astype(np.uint8);masked[n]=Image.fromarray(arr);Image.fromarray(keep).save(M/f'{n}_visibility.png');changed=a!=arr[:,:,3];ys,xs=np.where(changed);stats.append({'layer':n,'window':box,'changedAlphaPixels':int(changed.sum()),'changedBounds':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'rgbUnchanged':True})
order=['coverage_underlay','torso_armor','legs_boots','arm_front','helmet','sword','arm_rear']
def compose(parts,seq,crop=None):
 out=base.copy()
 for n in seq:out=Image.alpha_composite(out,parts[n])
 if crop:
  hand=Image.new('RGBA',(768,768));x,y,w,h=crop;hand.paste(ims['arm_rear'].crop((x,y,x+w,y+h)),(x,y));out=Image.alpha_composite(out,hand);hand.save(P/'proposed_hand_occlusion.png')
 return out
resolved=json.loads(subprocess.check_output(['node',str(P/'resolve.cjs')],cwd=R));(P/'RESOLVED_LAYERS.json').write_text(json.dumps(resolved,indent=2)+'\n')
assert order==[{'arm_rear':'arm_front','arm_front':'arm_rear'}.get(x['name'],x['name']) for x in resolved['azure'][1:]]
before=compose(ims,order);after=compose(masked,order);after.save(P/'reassembled.png')
runtimeorder=[x['name'] for x in resolved['leather'][1:-1]];crop=resolved['leather'][-1]['crop'];runtime=compose(ims,runtimeorder,crop);runtime.save(P/'runtime_fixture_proposed_crop.png')
def flat(im):
 bg=Image.new('RGBA',im.size,(220,225,233,255));bg.alpha_composite(im);return bg.convert('RGB')
flat(after).save(P/'REVIEW.png')
def sheet(images,labels,path):
 s=Image.new('RGB',(768*len(images),805),(220,225,233));d=ImageDraw.Draw(s)
 for i,(im,label) in enumerate(zip(images,labels)):s.paste(flat(im),(i*768,35));d.text((i*768+15,12),label,fill=(25,35,50))
 s.save(path)
sheet([before,after,runtime],['BEFORE / Azure anatomical sequence','AFTER / same sequence + REVIEW-ONLY visibility masks','LEATHER runtime fixture / full exports + PROPOSED pose crop'],P/'ORDER_AND_MASK_COMPARISON.png')
regions={'helmet':(260,235,480,420),'shoulder_raised':(265,385,350,475),'shoulder_extended':(355,410,435,490),'waist':(280,470,415,540),'wrist_extended':(415,460,520,535),'sword_grip':(250,255,355,365)}
s=Image.new('RGB',(1200,870),(220,225,233));d=ImageDraw.Draw(s)
for i,(name,box) in enumerate(regions.items()):
 x=(i%3)*400;y=(i//3)*435;d.text((x+10,y+8),name+' / before -> after',fill='black')
 for j,im in enumerate([before,after]):
  detail=flat(im.crop(box));detail.thumbnail((195,350),Image.Resampling.NEAREST);scale=min(195/detail.width,350/detail.height);detail=detail.resize((round(detail.width*scale),round(detail.height*scale)),Image.Resampling.NEAREST);s.paste(detail,(x+5+j*198,y+30))
s.save(P/'DETAILS.png')
# Canonical-base fit evidence: no face replacement, no pose correction.
source=Image.open(P.parent/'step-01-helmet/owner_source.png').convert('RGBA').resize((768,768),Image.Resampling.LANCZOS)
cyan=Image.new('RGBA',(768,768),(0,190,220,0));cyan.putalpha(base.getchannel('A').point(lambda v:round(v*.45)))
sheet([base,source,Image.alpha_composite(after,cyan)],['CANONICAL BASE / untouched','OWNER SOURCE / whole canvas uniform resize only','BASE 45% CYAN over review / FIT NOT ACCEPTED'],P/'BASE_SOURCE_OVERLAY.png')
files=[]
for n in N:
 f=E/f'{n}.png';im=Image.open(f);a=np.array(im)[:,:,3];assert im.mode=='RGBA' and im.size==(768,768);assert not a[0].any() and not a[-1].any() and not a[:,0].any() and not a[:,-1].any();assert sha(f)==sha(old/'exports'/f.name);files.append({'layer':n,'sha256':sha(f),'dimensions':[768,768],'origin':[0,0],'alphaBounds':im.getbbox(),'identicalToCheckpoint':True,**({'emptyReason':'Owner: coverage belongs to each equipment piece; no shared underlay artwork'} if n=='coverage_underlay' else {})})
refs=['src/phaser/presentation/HeroV5RuntimeContract.js','r2-upload/manifest.json','r2-upload/hero/v5/g2/equipment/azure/attack_01/sword.png']+[f'r2-upload/hero/v5/g2/base/{n}.png' for n in ['idle_01','idle_02','idle_03','attack_01','attack_02','attack_03','death_01','death_02']]
for path in refs:assert subprocess.check_output(['git','show','origin/main:'+path],cwd=R)==(R/path).read_bytes(),path
protected=list((R/'docs/g16-leather-g2/exports/idle_01').glob('*.png'))+list((R/'docs/g16-leather-g2/g3/exports').glob('idle_*/*.png'))
for f in protected:assert subprocess.check_output(['git','show','HEAD:'+str(f.relative_to(R))],cwd=R)==f.read_bytes()
report={'status':'ATTACK_01_BOUNDED_OVERLAP_EXPERIMENT_OWNER_REVIEW_PENDING','main':'7ef31753b969386d2750857dddaa53d44c03081c','branchCheckpoint':'9ab7d5e9f62942c273edceb4142a4432348bf8b4','risk':'MEDIUM','visualApproved':False,'finalInventoryPromotion':False,'G3Complete':False,'G4Ready':False,'exportsUnchanged':True,'hiddenInsertionPreserved':True,'masksReviewOnly':True,'azureAnatomicalOrder':order,'extraTorsoPass':False,'maskStats':stats,'runtimeFixture':{'order':runtimeorder,'usesFullUnmaskedExports':True,'proposedCrop':crop,'cropOwnerReviewed':False,'liveMetadataChanged':False,'architectureChanged':False},'scopedReferenceChecks':[{'path':p,'sha256':sha(R/p),'identicalToLatestMain':True} for p in refs],'protectedIdlePngCount':len(protected),'files':files,'knownIssues':['Visibility masks are offline evidence only, not supported or integrated runtime metadata.','Arm filenames remain anatomically reversed relative to Azure; no slot remapping made.','Helmet and complete sword unchanged; owner must assess placement/hand occlusion.','Torso/limb/base fit still requires visual acceptance; masking does not certify anatomy. Raised shoulder armhole/ring remains visibly exposed after masks.', 'Leather runtime fixture places helmet over raised forearm/bracer outside the proposed glove crop; do not enlarge the crop to include unrelated forearm without review.','Proposed Attack_01 hand rectangle is not the Idle crop and still needs review.','Other four Attack/Death poses not started.'],'productionChanges':False}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
(P/'SHA256SUMS').write_text(''.join(sha(f)+'  '+str(f.relative_to(P))+'\n' for f in sorted(P.rglob('*')) if f.is_file() and f.name!='SHA256SUMS'))
print(json.dumps({'exports':len(files),'protectedIdle':len(protected),'maskStats':stats,'referencesUnchanged':len(refs)},indent=2))
