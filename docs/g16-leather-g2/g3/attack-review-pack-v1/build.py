from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import numpy as np,math,json,hashlib,subprocess
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates
O=Path(__file__).resolve().parent;R=O.parents[3];S=O.parent/'owner-selected-recut/attack_01/neckline-refinement-review/exports';Q=O/'qa';Q.mkdir(exist_ok=True);sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
parts={p.stem:Image.open(p).convert('RGBA') for p in S.glob('*.png')}
def translate(im,dx,dy):
 o=Image.new('RGBA',(768,768));o.paste(im,(dx,dy));return o
def maskout(im,poly):
 m=Image.new('L',(768,768));ImageDraw.Draw(m).polygon(poly,fill=255);o=im.copy();o.putalpha(ImageChops.subtract(im.getchannel('A'),m));return o
def clear_chin(im,dx=0,dy=0):
 xs=np.array([330,335,350,365,380,395,410,425,440,455])+dx
 ys=np.array([408,410,418,422,427,430,430,426,419,400])+dy+3
 poly=[(int(xs[0]),300),(int(xs[-1]),300)]+list(zip(xs[::-1].astype(int),ys[::-1].astype(int)))
 return maskout(im,poly)
parts['torso_armor']=clear_chin(parts['torso_armor'])

def transform(im,scale,angle,source,target):
 t=math.radians(angle);m=scale*np.array([[math.cos(t),-math.sin(t)],[math.sin(t),math.cos(t)]]);v=np.array(target)-m@np.array(source);inv=np.linalg.inv(m);b=-inv@v;return im.transform((768,768),Image.Transform.AFFINE,(*inv[0],b[0],*inv[1],b[1]),Image.Resampling.BICUBIC)
def tube(im,sp,tp,sw=65,tw=45):
 sp=np.array(sp,float);tp=np.array(tp,float)
 def verts(p,w):
  v=[]
  for i,a in enumerate(p):
   tangent=p[min(i+1,len(p)-1)]-p[max(0,i-1)];normal=np.array([-tangent[1],tangent[0]])/np.linalg.norm(tangent);v.append([a-normal*w,a,a+normal*w])
  return np.array(v)
 sv=verts(sp,sw);tv=verts(tp,tw);out=np.zeros((768,768,4),dtype=np.uint8);src=np.array(im)
 for i in range(len(sp)-1):
  for k in range(2):
   for ids in [[(i,k),(i+1,k),(i+1,k+1)],[(i,k),(i+1,k+1),(i,k+1)]]:
    s=np.array([sv[a,b] for a,b in ids]);t=np.array([tv[a,b] for a,b in ids]);mat=np.linalg.solve(np.c_[t,np.ones(3)],s);x0=max(0,int(t[:,0].min())-1);x1=min(768,int(t[:,0].max())+2);y0=max(0,int(t[:,1].min())-1);y1=min(768,int(t[:,1].max())+2)
    if x0>=x1 or y0>=y1:continue
    m=Image.new('1',(x1-x0,y1-y0));ImageDraw.Draw(m).polygon([tuple(v-[x0,y0]) for v in t],fill=1);keep=np.array(m,bool);yy,xx=np.mgrid[y0:y1,x0:x1];coords=np.stack([xx,yy,np.ones_like(xx)],-1)@mat
    a=np.stack([map_coordinates(src[:,:,c],[coords[:,:,1],coords[:,:,0]],order=1,mode='constant') for c in range(4)],-1);out[y0:y1,x0:x1][keep]=a[keep]
 return Image.fromarray(out)
right_src=[[315,465],[303,440],[289,418],[269,397],[261,374],[272,349],[287,330],[307,308],[308,278],[308,265]]
left_src=[[370,431],[384,449],[414,468],[447,485],[473,493],[496,493],[518,493],[530,493]]
poses={
 'attack_02':{'helmet':[-34,-1],'chest':[-35,-8],'legs':[-39,2],'right':[[333,447],[352,447],[372,447],[392,447],[414,447],[438,447],[464,447],[490,447],[513,447],[524,447]],'left':[[293,418],[280,423],[261,431],[239,443],[221,453],[207,462],[188,469],[178,472]],'swordAngle':-88,'grip':[489,448]},
 'attack_03':{'helmet':[-34,-1],'chest':[-33,-6],'legs':[-30,3],'right':[[339,430],[350,449],[360,466],[371,485],[383,501],[394,518],[403,533],[416,548],[430,561],[439,570]],'left':[[297,420],[287,432],[274,455],[256,477],[240,493],[228,503],[208,511],[198,514]],'swordAngle':-12,'grip':[413,551]}}
def garment_tps(im,sp,tp):
 sp=np.array([[0,0],[768,0],[0,768],[768,768]]+sp,float);tp=np.array([[0,0],[768,0],[0,768],[768,768]]+tp,float)
 rbf=RBFInterpolator(tp,sp,kernel='thin_plate_spline');y,x=np.mgrid[0:768,0:768];xy=rbf(np.c_[x.ravel(),y.ravel()]).reshape(768,768,2);a=np.array(im);return Image.fromarray(np.stack([map_coordinates(a[:,:,c],[xy[:,:,1],xy[:,:,0]],order=1,mode='constant') for c in range(4)],-1))
def chest23(im,frame):
 sp=[[302,374],[308,397],[296,426],[302,450],[300,480],[300,505],[330,414],[350,436],[367,435],[379,427],[398,432],[390,475],[362,483],[393,505]]
 tp=[[280,409],[280,423],[276,439],[279,454],[278,481],[277,507],[293,416],[313,430],[330,430],[342,427],[356,438],[354,479],[325,486],[358,507]]
 if frame=='attack_03':tp=[[x+1,y+1] for x,y in tp]
 return garment_tps(im,sp,tp)
def legs03(im):
 sp=np.array([[0,0],[768,0],[0,768],[768,768],[280,500],[350,500],[420,500],[330,530],[304,572],[259,615],[245,648],[380,529],[415,568],[366,607],[380,641]],float)
 tp=np.array([[0,0],[768,0],[0,768],[768,768],[250,500],[320,500],[390,500],[304,531],[269,576],[235,620],[224,651],[345,530],[367,571],[324,621],[335,657]],float)
 rbf=RBFInterpolator(tp,sp,kernel='thin_plate_spline');y,x=np.mgrid[0:768,0:768];xy=rbf(np.c_[x.ravel(),y.ravel()]).reshape(768,768,2);a=np.array(im);return Image.fromarray(np.stack([map_coordinates(a[:,:,c],[xy[:,:,1],xy[:,:,0]],order=1,mode='constant') for c in range(4)],-1))
master=Image.open(R/'docs/g16-leather-g2/exports/idle_01/sword.png').convert('RGBA')
outputs={}
for frame in ['attack_01','attack_02','attack_03']:
 p={k:v.copy() for k,v in parts.items()}
 if frame!='attack_01':
  q=poses[frame];p['helmet']=translate(parts['helmet'],*q['helmet']);p['torso_armor']=chest23(parts['torso_armor'],frame);p['legs_boots']=translate(parts['legs_boots'],*q['legs']);p['arm_rear']=tube(parts['arm_rear'],right_src,q['right'],tw=60);p['arm_front']=translate(tube(parts['arm_front'],left_src,q['left'],tw=60),0,-3);p['sword']=transform(master,1,q['swordAngle'],[270,515],q['grip'])
  if frame=='attack_03':p['legs_boots']=legs03(parts['legs_boots'])
  p['torso_armor']=clear_chin(p['torso_armor'],-34,-1)
 E=O/'exports'/frame;E.mkdir(exist_ok=True,parents=True)
 for n,im in p.items():im.save(E/(n+'.png'))
 out=Image.open(R/'r2-upload/hero/v5/g2/base'/f'{frame}.png').convert('RGBA')
 for n in ['coverage_underlay','legs_boots','arm_front','torso_armor','helmet','sword','arm_rear']:out=Image.alpha_composite(out,p[n])
 out.save(Q/(frame+'.png'));outputs[frame]=out
s=Image.new('RGB',(2304,820),(220,225,233));d=ImageDraw.Draw(s)
for i,(n,im) in enumerate(outputs.items()):
 bg=Image.new('RGBA',(768,768),(220,225,233,255));bg.alpha_composite(im);s.paste(bg.convert('RGB'),(i*768,40));d.text((i*768+20,15),n+' / candidate',fill='black')
s.save(O/'FULL_CANVAS_COMPARISON.png')

# Review-only common crop, applied identically to all frames. Exports stay origin 0.
def flat(im):
 bg=Image.new('RGBA',im.size,(220,225,233,255));bg.alpha_composite(im);return bg.convert('RGB')
common=(80,150,660,700);sheet=Image.new('RGB',(1740,620),(220,225,233));draw=ImageDraw.Draw(sheet)
for i,(frame,im) in enumerate(outputs.items()):
 draw.text((i*580+16,15),frame+' / OWNER REVIEW CANDIDATE',fill='black');sheet.paste(flat(im.crop(common)),(i*580,55))
sheet.save(O/'ATTACK_REVIEW_SHEET.png')
# Transparent fixed-canvas sheet; no per-pose trim/recenter or baked runtime offset.
sprites=Image.new('RGBA',(2304,768))
for i,im in enumerate(outputs.values()):sprites.alpha_composite(im,(i*768,0))
sprites.save(O/'ATTACK_FULL_CANVAS_SHEET.png')
# Isolated parts may be enlarged within cells for review only.
names=['helmet','torso_armor','arm_rear','arm_front','legs_boots','sword','coverage_underlay'];asset=Image.new('RGB',(1200,7*280+45),(220,225,233));draw=ImageDraw.Draw(asset)
for i,frame in enumerate(outputs):
 draw.text((i*400+12,12),frame+' / isolated parts enlarged',fill='black')
 for j,n in enumerate(names):
  im=Image.open(O/'exports'/frame/(n+'.png')).convert('RGBA');box=im.getbbox();y=45+j*280;draw.text((i*400+12,y+7),n,fill='black')
  if box:
   crop=flat(im.crop(box));crop.thumbnail((370,235),Image.Resampling.LANCZOS);asset.paste(crop,(i*400+(400-crop.width)//2,y+35+(235-crop.height)//2))
  else:draw.text((i*400+16,y+100),'INTENTIONALLY TRANSPARENT / coverage owned per piece',fill='black')
asset.save(O/'EQUIPMENT_PARTS_SHEET.png')
fit=Image.new('RGB',(1740,620),(220,225,233));draw=ImageDraw.Draw(fit)
for i,(frame,im) in enumerate(outputs.items()):
 base=Image.open(R/'r2-upload/hero/v5/g2/base'/f'{frame}.png').convert('RGBA');cyan=Image.new('RGBA',(768,768),(0,190,220,0));cyan.putalpha(base.getchannel('A').point(lambda v:round(v*.4)));preview=Image.alpha_composite(im,cyan);fit.paste(flat(preview.crop(common)),(i*580,55));draw.text((i*580+12,15),frame+' / original Base cyan 40% / fit review',fill='black')
fit.save(O/'BASE_FIT_SHEET.png')
# Neck/wrist crops are proportional and review-only.
details=Image.new('RGB',(1200,660),(220,225,233));draw=ImageDraw.Draw(details)
for i,(frame,im) in enumerate(outputs.items()):
 neck=(320,395,430,465) if frame=='attack_01' else (270,395,380,465)
 wrist={'attack_01':(265,265,350,350),'attack_02':(448,410,530,480),'attack_03':(385,510,455,580)}[frame]
 for j,(name,box) in enumerate([('neck / chin clearance',neck),('anatomical right glove / complete sword',wrist)]):
  crop=flat(im.crop(box));scale=min(390/crop.width,265/crop.height);crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.NEAREST);details.paste(crop,(i*400+(400-crop.width)//2,j*330+40));draw.text((i*400+10,j*330+12),frame+' / '+name,fill='black')
details.save(O/'NECK_AND_GRIP_DETAILS.png')
# Complete candidate inventory is separate from final G3 inventory.
files=[]
for frame in outputs:
 for f in sorted((O/'exports'/frame).glob('*.png')):
  im=Image.open(f);a=np.array(im)[:,:,3];assert im.mode=='RGBA' and im.size==(768,768);assert not a[0].any() and not a[-1].any() and not a[:,0].any() and not a[:,-1].any();files.append({'frame':frame,'layer':f.stem,'path':str(f.relative_to(O)),'status':'CANDIDATE_OWNER_REVIEW_PENDING','sha256':sha(f),'dimensions':[768,768],'origin':[0,0],'mode':'RGBA','alphaBounds':im.getbbox(),'alphaNonzeroPixels':int((a>0).sum()),'edgeAlphaNonzero':0,**({'emptyReason':'Owner: coverage belongs to each equipment piece; no shared underlay artwork'} if f.stem=='coverage_underlay' else {})})
assert len(files)==21
for n in ['coverage_underlay','legs_boots','arm_rear','helmet','sword','arm_front']:assert sha(O/'exports/attack_01'/f'{n}.png')==sha(S/f'{n}.png')
original=np.array(Image.open(S/'torso_armor.png'));cut=np.array(Image.open(O/'exports/attack_01/torso_armor.png'));diff=np.any(original!=cut,axis=2);yy,xx=np.where(diff);assert not diff[:300].any();assert not diff[435:].any();assert np.array_equal(original[:,:,:3],cut[:,:,:3])
basehash={}
for frame in ['idle_01','idle_02','idle_03','attack_01','attack_02','attack_03','death_01','death_02']:
 f=R/'r2-upload/hero/v5/g2/base'/f'{frame}.png';assert subprocess.check_output(['git','show','origin/main:'+str(f.relative_to(R))],cwd=R)==f.read_bytes();basehash[frame]=sha(f)
protected=list((R/'docs/g16-leather-g2/exports/idle_01').glob('*.png'))+list((R/'docs/g16-leather-g2/g3/exports').glob('idle_*/*.png'))
for f in protected:assert subprocess.check_output(['git','show','origin/art/g16-g3-leather-frames:'+str(f.relative_to(R))],cwd=R)==f.read_bytes()
for f in [R/'src/phaser/presentation/HeroV5RuntimeContract.js',R/'r2-upload/manifest.json']:assert subprocess.check_output(['git','show','origin/main:'+str(f.relative_to(R))],cwd=R)==f.read_bytes()
sourceCoverage={}
for layer,pts in [('arm_rear',right_src),('arm_front',left_src)]:
 pts=np.array(pts,float);coverage=Image.new('L',(768,768));draw=ImageDraw.Draw(coverage);verts=[]
 for i,point in enumerate(pts):
  tangent=pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)];normal=np.array([-tangent[1],tangent[0]])/np.linalg.norm(tangent);verts.append([point-65*normal,point+65*normal])
 for i in range(len(pts)-1):draw.polygon([tuple(verts[i][0]),tuple(verts[i+1][0]),tuple(verts[i+1][1]),tuple(verts[i][1])],fill=255)
 a=np.array(parts[layer])[:,:,3]>128;missed=a & (np.array(coverage)==0);sourceCoverage[layer]={'sourceAlphaAbove128Pixels':int(a.sum()),'outsideSourceMeshPixels':int(missed.sum()),'sourceMasterPreserved':True}
placements={'authoringOnly':True,'anatomyUnmodified':True,'origin':[0,0],'backToFront':['base','coverage_underlay','legs_boots','arm_front','torso_armor','helmet','sword','arm_rear'],'attack01ChinAlphaCut':{'changedPixels':int(diff.sum()),'bounds':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],'rule':'manual jaw clearance guide +3px, chest alpha only; approximate visual guide, not rig landmark'},'rightSourceGarmentTube':right_src,'leftSourceGarmentTube':left_src,'sourceMeshCoverage':sourceCoverage,'sourceTubeHalfWidth':65,'targetTubeHalfWidth':60,'leftArmAdditionalTranslation':[0,-3],'poses':poses,'swordSource':'docs/g16-leather-g2/exports/idle_01/sword.png','swordSourceSha256':sha(R/'docs/g16-leather-g2/exports/idle_01/sword.png'),'swordSourceGrip':[270,515],'garmentMeshDetails':'See build.py for all torso/leg TPS control points. These deform clothing pixels only; original Base is never remapped. Manual surface guides are not pixel-exact bone anchors.'}
(O/'PLACEMENT.json').write_text(json.dumps(placements,indent=2)+'\n')
hand={'status':'OFFLINE_OWNER_ORDER_ONLY_RUNTIME_REVIEW_REQUIRED','frames':{frame:{'sourceLayer':'arm_rear','anatomy':'right sword arm','offlineOrder':'entire right arm after complete sword','extraHandPass':False,'runtimeCrop':None,'runtimeCropStatus':'NOT_DEFINED_OR_APPROVED_FOR_THIS_NEW_POSE_EXPORT','grip':{'attack_01':[310,309],'attack_02':[489,448],'attack_03':[413,551]}[frame]} for frame in outputs}}
(O/'HAND_OCCLUSION.json').write_text(json.dumps(hand,indent=2)+'\n')
report={'status':'ATTACK_01_CHIN_TRIM_AND_ATTACK_02_03_RECONSTRUCTION_SHEET_OWNER_REVIEW_PENDING','mainChecked':'7ef31753b969386d2750857dddaa53d44c03081c','branchParent':'ae6c2bcd093c2c3482758abf59c638782bfbe81d','risk':'MEDIUM per-pose clothing reconstruction','ownerAuthorizedExpansion':True,'candidateFrameCount':3,'candidatePngPaths':21,'acceptedNewPngPaths':0,'finalInventoryPromotion':False,'G3Complete':False,'G4Ready':False,'baseHashes':basehash,'protectedIdlePngCount':len(protected),'baseAnatomyChanged':False,'sourceGenerationUsed':False,'rejectedSourcePixelsUsed':False,'sourceDesign':'Current Owner-selected Attack_01 parts, with neckline refinement and requested chin cut; complete independent sword master','method':'Per-pose clothing-only tube mesh/TPS and fixed offline placement on separate canonical Base frames. No whole-body generation or Base limb movement.','runtimeChanged':False,'slotMappingChanged':False,'runtimeOffsetBaked':False,'productionChanges':False,'handOcclusionReport':'HAND_OCCLUSION.json','placementReport':'PLACEMENT.json','knownVisualIssues':['New Attack_02/03 garments are review candidates: inspect shoulder/armhole, cuff and waist joins against BASE_FIT_SHEET.png; small Base slivers remain possible.','Garment mesh reconstruction may alter fold/pauldron perspective; Owner visual design acceptance is pending.','Owner-approved offline ordering differs from merged leather_overlap_v1. No new runtime crop/order implementation is made or approved.','Death_01/02 are not created; this is not G3 complete or 56/56 accepted.'],'files':files}
(O/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
(O/'SHA256SUMS').write_text(''.join(sha(f)+'  '+str(f.relative_to(O))+'\n' for f in sorted(O.rglob('*')) if f.is_file() and f.name!='SHA256SUMS'))
print(json.dumps({'candidateFrames':3,'candidatePNGs':21,'accepted':0,'attack01ChinCut':placements['attack01ChinAlphaCut'],'protectedIdle':len(protected),'BaseChanged':False,'runtimeChanged':False,'technicalChecks':'PASS'}))
