from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from scipy.ndimage import distance_transform_edt
import numpy as np,json,hashlib,subprocess,shutil
P=Path(__file__).resolve().parent;R=P.parents[3];V=P.parent/'attack-review-pack-v1';E=P/'exports';Q=P/'qa';Q.mkdir(exist_ok=True);sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();FRAMES=['attack_01','attack_02','attack_03'];LAYERS=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front'];records=[];registration={};outputs={}
for frame in FRAMES:
 outdir=E/frame;outdir.mkdir(parents=True,exist_ok=True)
 for layer in LAYERS:
  src=V/'exports'/frame/(layer+'.png');dst=outdir/src.name
  # The source pose/outline is locked: replace only torso material RGB. Source
  # alpha, including hidden insertion and chin clearance, is preserved exactly.
  if layer=='torso_armor' and frame!='attack_01':
   old=Image.open(src).convert('RGBA');a=np.array(old);donorpath=P/'masters'/(frame+'_back_donor.png');native=Image.open(donorpath).convert('RGBA');donor=native.resize((220,220),Image.Resampling.LANCZOS);d=np.array(donor)
   # Extend only donor material color into transparent donor edge pixels. This
   # admits no donor alpha or generated body silhouette into the equipment.
   missing=d[:,:,3]<200;_,indices=distance_transform_edt(missing,return_indices=True);rgb=d[indices[0],indices[1],:3];candidate=a.copy();candidate[360:580,220:440,:3]=rgb;transparent=a[:,:,3]==0;candidate[transparent,:3]=a[transparent,:3]
   assert np.array_equal(candidate[:,:,3],a[:,:,3]);Image.fromarray(candidate).save(dst);changed=np.any(a!=candidate,axis=2);ys,xs=np.where(changed);registration[frame]={'nativeDonorSize':list(native.size),'donorSha256':sha(donorpath),'inputSourceCrop':[220,360,440,580],'inputReviewSize':[1024,1024],'uniformNormalization':[220,220],'canvasPlacement':[220,360],'admittedChannels':'RGB only; original alpha exact','transparentDonorEdgeMethod':'nearest opaque donor material color, alpha threshold 200','changedRgbPixels':int(changed.sum()),'changedBounds':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'alphaPixelIdentical':True,'torsoFacing':'three_quarter_rear'}
  else:shutil.copyfile(src,dst)
  im=Image.open(dst);alpha=np.array(im)[:,:,3];assert im.mode=='RGBA' and im.size==(768,768);assert not alpha[0].any() and not alpha[-1].any() and not alpha[:,0].any() and not alpha[:,-1].any();same=sha(src)==sha(dst);expectedChange=frame!='attack_01' and layer=='torso_armor';assert same!=expectedChange;records.append({'frame':frame,'layer':layer,'path':str(dst.relative_to(P)),'dimensions':[768,768],'origin':[0,0],'mode':'RGBA','sha256':sha(dst),'sourceSha256':sha(src),'identicalToPrevious':same,'alphaBounds':im.getbbox(),'alphaNonzeroPixels':int((alpha>0).sum()),'edgeAlphaNonzero':0,**({'emptyReason':'Owner: coverage belongs to each equipment piece; no shared underlay artwork'} if layer=='coverage_underlay' else {})})
 basepath=R/'r2-upload/hero/v5/g2/base'/(frame+'.png');out=Image.open(basepath).convert('RGBA')
 for layer in ['coverage_underlay','legs_boots','arm_front','torso_armor','helmet','sword','arm_rear']:out=Image.alpha_composite(out,Image.open(outdir/(layer+'.png')).convert('RGBA'))
 before=Image.open(V/'qa'/(frame+'.png')).convert('RGBA');assert np.array_equal(np.array(out)[:,:,3],np.array(before)[:,:,3]);out.save(Q/(frame+'.png'));outputs[frame]=out
assert len(records)==21 and sum(x['identicalToPrevious'] for x in records)==19
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
def flat(im):
 b=Image.new('RGBA',im.size,(220,225,233,255));b.alpha_composite(im);return b.convert('RGB')
common=(80,150,660,700);sheet=Image.new('RGB',(1740,620),(220,225,233));draw=ImageDraw.Draw(sheet)
for i,(frame,im) in enumerate(outputs.items()):
 draw.text((i*580+12,15),frame+(' / FRONT / unchanged' if i==0 else ' / REAR TORSO / art review'),font=font,fill='black');sheet.paste(flat(im.crop(common)),(i*580,55))
sheet.save(P/'ATTACK_REVIEW_SHEET.png')
full=Image.new('RGBA',(2304,768))
for i,im in enumerate(outputs.values()):full.alpha_composite(im,(i*768,0))
full.save(P/'ATTACK_FULL_CANVAS_SHEET.png')
manifest=json.load(open(R/'r2-upload/manifest.json'))['assets']['hero001']['v5']['g2'];torso_sheet=Image.new('RGB',(1320,960),(220,225,233));draw=ImageDraw.Draw(torso_sheet);references=[]
for row,frame in enumerate(FRAMES[1:]):
 azpath=R/'r2-upload'/manifest['equipment']['azure']['frames'][frame]['torso_armor'].split('?')[0];assert subprocess.check_output(['git','show','origin/main:'+str(azpath.relative_to(R))],cwd=R)==azpath.read_bytes();references.append({'frame':frame,'selectedPath':manifest['equipment']['azure']['frames'][frame]['torso_armor'],'sha256':sha(azpath)})
 for col,(label,f) in enumerate([('BEFORE / front details',V/'exports'/frame/'torso_armor.png'),('AFTER / rear panel',E/frame/'torso_armor.png'),('AZURE / facing reference',azpath)]):
  draw.text((col*440+12,row*480+12),frame+' | '+label,font=font,fill='black');torso_sheet.paste(flat(Image.open(f).convert('RGBA').crop((220,360,440,580))).resize((440,440),Image.Resampling.NEAREST),(col*440,row*480+40))
torso_sheet.save(P/'TORSO_BEFORE_AFTER_AZURE.png')
parts=Image.new('RGB',(1200,2005),(220,225,233));draw=ImageDraw.Draw(parts)
for i,frame in enumerate(FRAMES):
 draw.text((i*400+10,12),frame+' / isolated pieces',font=font,fill='black')
 for j,layer in enumerate(['helmet','torso_armor','arm_rear','arm_front','legs_boots','sword','coverage_underlay']):
  im=Image.open(E/frame/(layer+'.png')).convert('RGBA');box=im.getbbox();y=45+j*280;draw.text((i*400+12,y+5),layer,font=font,fill='black')
  if box:
   crop=flat(im.crop(box));crop.thumbnail((370,235),Image.Resampling.LANCZOS);parts.paste(crop,(i*400+(400-crop.width)//2,y+35+(235-crop.height)//2))
  else:draw.text((i*400+12,y+100),'INTENTIONALLY TRANSPARENT',font=small,fill='black')
parts.save(P/'EQUIPMENT_PARTS_SHEET.png')
# Same-scale Azure reference alongside corrected Leather. Pose accepted by Owner.
comparison=Image.new('RGB',(1396,2010),(220,225,233));draw=ImageDraw.Draw(comparison);draw.text((12,12),'POSES OWNER CONFIRMED / only rear torso material changed',font=font,fill='black')
for row,frame in enumerate(FRAMES):
 az=Image.open(V/'azure-comparison'/(frame+'_azure.png')).convert('RGBA')
 for col,(label,im) in enumerate([('AZURE',az),('LEATHER / corrected torso',outputs[frame])]):
  y=60+row*650;draw.text((col*698+12,y+8),frame+' | '+label,font=font,fill='black');comparison.paste(flat(im.crop((70,120,768,720))),(col*698,y+40))
comparison.save(P/'AZURE_LEATHER_COMPARISON.png')
basehash={}
for frame in ['idle_01','idle_02','idle_03','attack_01','attack_02','attack_03','death_01','death_02']:
 f=R/'r2-upload/hero/v5/g2/base'/(frame+'.png');assert subprocess.check_output(['git','show','origin/main:'+str(f.relative_to(R))],cwd=R)==f.read_bytes();basehash[frame]=sha(f)
protected=list((R/'docs/g16-leather-g2/exports/idle_01').glob('*.png'))+list((R/'docs/g16-leather-g2/g3/exports').glob('idle_*/*.png'))
for f in protected:assert subprocess.check_output(['git','show','origin/art/g16-g3-leather-frames:'+str(f.relative_to(R))],cwd=R)==f.read_bytes()
for f in [R/'src/phaser/presentation/HeroV5RuntimeContract.js',R/'r2-upload/manifest.json']:assert subprocess.check_output(['git','show','origin/main:'+str(f.relative_to(R))],cwd=R)==f.read_bytes()
report={'status':'ATTACK_REAR_TORSO_CORRECTION_COMPLETE_OWNER_ART_REVIEW_PENDING','mainChecked':'7ef31753b969386d2750857dddaa53d44c03081c','branchParent':'3f76ca6bc99c4099ee6f7f324a5d7304f740796a','risk':'MEDIUM torso material correction only','poseAcceptance':{'authority':'Owner explicitly confirmed all three attack poses match','attack_01':True,'attack_02':True,'attack_03':True,'poseChangesAuthorized':False},'torsoFacing':{'attack_01':'front','attack_02':'three_quarter_rear','attack_03':'three_quarter_rear'},'changedExportPaths':['exports/attack_02/torso_armor.png','exports/attack_03/torso_armor.png'],'unchangedExportPaths':19,'attack01AllSevenByteIdentical':True,'allTorsoAlphaPixelIdentical':True,'allCompositeAlphaPixelIdentical':True,'protectedIdlePngCount':len(protected),'baseHashes':basehash,'azureTorsoReferences':references,'materialRegistration':registration,'pipelinePath':'docs/EQUIPMENT-SPRITE-PIPELINE-V1.md','pipelineSha256':sha(R/'docs/EQUIPMENT-SPRITE-PIPELINE-V1.md'),'candidatePngPaths':21,'correctedTorsoArtworkAccepted':False,'G3Complete':False,'G4Ready':False,'deathFramesCreated':False,'finalInventoryPromotion':False,'runtimeChanged':False,'slotMappingChanged':False,'manifestChanged':False,'R2Uploaded':False,'deployed':False,'files':records,'knownIssues':['Owner has accepted the poses, not yet this corrected rear-torso artwork.','Previously existing non-torso seams are preserved; no new pose/arm/leg fitting is authorized here.','Runtime compatibility for Owner offline ordering and reconstructed per-pose hand crops remains a separate DEV review; no crop was broadened.','Death_01/02 still outstanding; do not claim G3 complete or 56/56 accepted.']}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n');(P/'SHA256SUMS').write_text(''.join(sha(f)+'  '+str(f.relative_to(P))+'\n' for f in sorted(P.rglob('*')) if f.is_file() and f.name!='SHA256SUMS'));print(json.dumps({'candidatePNG':21,'changedPNG':2,'unchangedPNG':19,'Attack01Unchanged':True,'allAlphaAndPosesUnchanged':True,'protectedIdle':len(protected),'BaseRuntimeManifestUnchanged':True}))
