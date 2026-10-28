"""Current G3 inventory and review evidence; never modifies equipment artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import hashlib, json, subprocess, io

P=Path(__file__).resolve().parent; R=P.parents[2];D=P/'death-review';Q=P/'qa';Q.mkdir(exist_ok=True)
BASELINE='52252e222217c3b8207093d7dff59e3974c74698'
frames=['idle_01','idle_02','idle_03','attack_01','attack_02','attack_03','death_01','death_02']
names=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front']
sha=lambda b:hashlib.sha256(b).hexdigest()
source=lambda f:P/'exports'/f if f.startswith('idle') else P/'attack-back-torso-review/exports'/f if f.startswith('attack') else D/'exports'/f
gitbytes=lambda ref,path:subprocess.check_output(['git','show',ref+':'+str(path.relative_to(R))],cwd=R)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
comps={};records=[];basehash={};orders={};hand={}
for f in frames:
    basepath=R/'r2-upload/hero/v5/g2/base'/(f+'.png');data=basepath.read_bytes()
    assert data==gitbytes('origin/main',basepath);basehash[f]=sha(data)
    out=Image.open(basepath).convert('RGBA');parts={}
    assert sorted(x.stem for x in source(f).glob('*.png'))==sorted(names)
    for n in names:
        path=source(f)/(n+'.png');im=Image.open(path);assert im.size==(768,768) and im.mode=='RGBA'
        a=np.array(im)[:,:,3];assert not a[0].any() and not a[-1].any() and not a[:,0].any() and not a[:,-1].any()
        parts[n]=im
        rec={'frame':f,'layer':n,'path':str(path.relative_to(R)),'sha256':sha(path.read_bytes()),'dimensions':[768,768],'mode':'RGBA','origin':[0,0],'alphaBounds':im.getbbox(),'alphaNonzeroPixels':int((a>0).sum()),'edgeAlphaNonzero':0,'artStatus':'OWNER_REVIEW_PENDING' if f=='death_02' else 'ESTABLISHED_OWNER_ACCEPTED_REFERENCE'}
        if not a.any():
            rec['emptyReason']='Owner: coverage belongs to each equipment piece; no shared underlay artwork' if n=='coverage_underlay' else 'Death releases weapon; canonical Azure Death contract requires no grip and selects a transparent sword.'
            assert n=='coverage_underlay' or (n=='sword' and f.startswith('death'))
        if n=='coverage_underlay':assert not a.any()
        records.append(rec)
    if f.startswith('attack'):
        order=['coverage_underlay','legs_boots','arm_front','torso_armor','helmet','sword','arm_rear']
        hand[f]={'sourceLayer':'arm_rear','crop':None,'status':'UNRESOLVED_SEPARATE_DEV_REVIEW','offlineOrder':'full anatomical right arm after sword; Owner-approved artwork order, not current runtime certification'}
    else:
        order=['coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet','sword']
        hand[f]={'sourceLayer':'arm_rear','crop':[0,493+{'idle_01':0,'idle_02':-12,'idle_03':-4}[f],768,42],'status':'INHERITED_REVIEWED_IDLE_TRANSLATION'} if f.startswith('idle') else {'sourceLayer':'arm_rear','crop':None,'required':False,'status':'NOT_REQUIRED_EMPTY_DEATH_SWORD'}
    if f=='death_02':
        order=['coverage_underlay','legs_boots','arm_front','torso_armor','helmet','sword','arm_rear']
        hand[f]['offlineOrder']='Owner: anatomical right arm in front of chest armor; separate DEV compatibility gate'
    for n in order:out=Image.alpha_composite(out,parts[n])
    if f.startswith('idle'):
        x,y,w,h=hand[f]['crop'];overlay=Image.new('RGBA',(768,768));overlay.paste(parts['arm_rear'].crop((x,y,x+w,y+h)),(x,y));out=Image.alpha_composite(out,overlay)
    orders[f]=order;comps[f]=out;out.save(Q/(f+'_composite.png'))
    if f=='death_02':out.save(D/'qa/death_02.png')
assert len(records)==56

# Preserve every established Idle/Attack and the accepted Death_01 result.
protected=[]
for f in frames[:6]:
    for n in names:
        path=source(f)/(n+'.png');assert path.read_bytes()==gitbytes(BASELINE,path);protected.append(str(path.relative_to(R)))
for path in (R/'docs/g16-leather-g2/exports/idle_01').glob('*.png'):
    assert path.read_bytes()==gitbytes(BASELINE,path);protected.append(str(path.relative_to(R)))
approved=Image.open(io.BytesIO(subprocess.check_output(['git','show',BASELINE+':docs/g16-leather-g2/g3/death-review/placement-review-v2/after.png'],cwd=R))).convert('RGBA')
assert approved.tobytes()==comps['death_01'].tobytes()
for n in names:
    if n not in ['helmet','torso_armor']:
        path=source('death_01')/(n+'.png');assert path.read_bytes()==gitbytes(BASELINE,path)
for path in [R/'r2-upload/manifest.json',R/'src/phaser/presentation/HeroV5RuntimeContract.js']:
    assert path.read_bytes()==gitbytes(BASELINE,path)

def flat(im):
    bg=Image.new('RGBA',im.size,(220,225,233,255));bg.alpha_composite(im);return bg.convert('RGB')
def sheet(items,path,cols=3):
    rows=(len(items)+cols-1)//cols;im=Image.new('RGB',(cols*384,rows*420),(220,225,233));dr=ImageDraw.Draw(im)
    for i,f in enumerate(items):
        x=(i%cols)*384;y=(i//cols)*420
        dr.text((x+12,y+10),f+(' / REVIEW' if f=='death_02' else ' / accepted reference'),font=small,fill='black')
        im.paste(flat(comps[f]).resize((384,384),Image.Resampling.NEAREST),(x,y+32))
    im.save(path)
sheet(frames,Q/'FULL_SET_CONTACT_SHEET.png',4)
sheet(frames[:3],Q/'IDLE_CONTACT_SHEET.png')
sheet(frames[3:6],Q/'ATTACK_CONTACT_SHEET.png')
sheet(frames[6:],D/'DEATH_CONTACT_SHEET.png',2)
for anim,ids,durations in [('idle',[0,1,2,1],[440]*4),('attack',[3,4,5],[280,220,340]),('death',[6,7],[650,1200])]:
    images=[flat(comps[frames[i]]).resize((384,384),Image.Resampling.NEAREST) for i in ids]
    images[0].save(Q/(anim+'_preview.gif'),save_all=True,append_images=images[1:],duration=durations,loop=0,disposal=2)

js="""const fs=require('fs'),vm=require('vm'),cp=require('child_process');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('src/phaser/presentation/HeroV5RuntimeContract.js','utf8'),c);c.config=JSON.parse(cp.execFileSync('git',['show','origin/main:r2-upload/manifest.json'])).assets.hero001.v5.g2;c.opts={includeHair:false,includeWings:false,equipmentSelection:{equipment:Object.fromEntries(['helmet','chest','gloves','boots','weapon'].map(s=>[s,'azure']))}};const result={};for(const f of ['death_01','death_02']){c.f=f;result[f]=vm.runInContext('heroV5FrameLayers(config,f,opts)',c);}console.log(JSON.stringify(result));"""
resolved=json.loads(subprocess.check_output(['node','-e',js],cwd=R));azureledger={}
for f in frames[6:]:
    az=Image.new('RGBA',(768,768));azsources=[]
    for layer in resolved[f]:
        path=R/'r2-upload'/layer['path'].split('?')[0];data=path.read_bytes();assert data==gitbytes('origin/main',path)
        az=Image.alpha_composite(az,Image.open(path).convert('RGBA'));azsources.append({'name':layer['name'],'path':layer['path'],'sha256':sha(data)})
    azureledger[f]=azsources
    crop=(100,140,740,680) if f=='death_01' else (150,220,530,710)
    w=crop[2]-crop[0];h=crop[3]-crop[1];compare=Image.new('RGB',(w*3,h+50),(220,225,233));dr=ImageDraw.Draw(compare)
    base=Image.open(R/'r2-upload/hero/v5/g2/base'/(f+'.png')).convert('RGBA')
    for i,(label,im) in enumerate([('Canonical Base',base),('Azure / main resolver',az),('Leather / '+('OWNER REVIEW' if f=='death_02' else 'OWNER APPROVED'),comps[f])]):
        dr.text((i*w+10,12),label,font=small,fill='black');compare.paste(flat(im.crop(crop)),(i*w,45))
    compare.save(D/(f.upper()+'_COMPARISON.png'))

parts_sheet=Image.new('RGB',(800,7*230+40),(220,225,233));dr=ImageDraw.Draw(parts_sheet)
for col,f in enumerate(frames[6:]):
    dr.text((col*400+12,10),f+(' / Owner approved' if col==0 else ' / Owner review'),font=font,fill='black')
    for row,n in enumerate(names):
        im=Image.open(source(f)/(n+'.png'));box=im.getbbox();y=40+row*230
        dr.text((col*400+12,y+5),n,font=small,fill='black')
        if box:
            c=flat(im.crop(box));c.thumbnail((375,190));parts_sheet.paste(c,(col*400+(400-c.width)//2,y+32))
        else:dr.text((col*400+20,y+90),'INTENTIONALLY TRANSPARENT',font=small,fill='black')
parts_sheet.save(D/'DEATH_PARTS_SHEET.png')

# Direct before/after study of the requested order correction, identical art.
old=Image.open(R/'r2-upload/hero/v5/g2/base/death_02.png').convert('RGBA')
for n in ['coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet','sword']:
    old=Image.alpha_composite(old,Image.open(source('death_02')/(n+'.png')).convert('RGBA'))
new=comps['death_02'];diff=np.any(np.array(old)!=np.array(new),axis=2)
arm=np.array(Image.open(source('death_02')/'arm_rear.png'))[:,:,3]>0
assert not (diff & ~arm).any()
for rec in records:
    path=R/rec['path'];assert path.read_bytes()==gitbytes('2264d4117a711acaf453631fefd8d9cb36a34c16',path)
order_sheet=Image.new('RGB',(1000,950),(220,225,233));dr=ImageDraw.Draw(order_sheet)
for col,(label,im) in enumerate([('BEFORE / right arm behind armor',old),('AFTER / right arm in front of armor',new)]):
    x=col*500;dr.text((x+12,14),label,font=small,fill='black')
    order_sheet.paste(flat(im.crop((180,320,490,690))).resize((465,555),Image.Resampling.NEAREST),(x+17,50))
    order_sheet.paste(flat(im.crop((240,505,365,605))).resize((450,360),Image.Resampling.NEAREST),(x+25,580))
order_sheet.save(D/'DEATH_02_ARM_ORDER_COMPARISON.png')
report={'status':'DEATH_01_APPROVED_DEATH_02_OWNER_REVIEW_PENDING','mainChecked':subprocess.check_output(['git','rev-parse','origin/main'],cwd=R,text=True).strip(),'risk':'LOW offline order-only correction','expectedPaths':56,'presentPaths':56,'death02CandidatePaths':7,'establishedReferencePaths':49,'finalInventoryPromoted':False,'G3Complete':False,'G4Ready':False,'baseSha256':basehash,'protectedExistingEquipmentPngCount':len(protected),'protectedExistingEquipmentByteIdentical':True,'all56EquipmentPngsByteIdenticalTo':'2264d4117a711acaf453631fefd8d9cb36a34c16','death02RightArmOrderCorrection':{'sourceLayer':'arm_rear','anatomy':'right arm','visibleOrder':'right arm in front of chest','changedCompositePixels':int(diff.sum()),'allChangedPixelsInsideRightArmAlpha':True,'runtimeCompatible':None,'runtimeCompatibilityStatus':'UNREVIEWED_SEPARATE_DEV_GATE'},'death01ApprovedCompositePixelIdentical':True,'runtimeChanged':False,'productionManifestChanged':False,'runtimeOffsetBaked':False,'actualRuntimeRendererTested':False,'fullSetVisualAcceptance':False,'assemblyOrderByFrame':orders,'azureSources':azureledger,'handOcclusion':hand,'files':records,'remainingGate':'Owner acceptance of Death_02, then reconcile acceptance state and proceed G4 visual QA; separate DEV review for Attack/Death_02 foreground arm order and Attack hand crops.'}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
(D/'HAND_OCCLUSION.json').write_text(json.dumps({'frames':{k:v for k,v in hand.items() if k.startswith('death')},'attackStatus':'UNRESOLVED_SEPARATE_DEV_GATE','runtimeChanged':False},indent=2)+'\n')
(P/'SHA256SUMS').write_text(''.join(r['sha256']+'  '+str(Path(r['path']).relative_to(P.relative_to(R)))+'\n' for r in records))
print('PASS: 56 declared PNG paths (7 Death_02 candidates); Base and 49 existing equipment checkpoints preserved; Death_01 matches accepted preview. Owner Death_02 acceptance and G4 remain pending.')
