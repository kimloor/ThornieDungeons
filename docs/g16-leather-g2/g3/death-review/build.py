"""Bounded Death_01 clothing study. Never resamples canonical anatomy."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFont
import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates, distance_transform_edt
import json, hashlib, subprocess

P=Path(__file__).resolve().parent
R=P.parents[3]
S=R/'docs/g16-leather-g2/exports/idle_01'
E=P/'exports/death_01'; E.mkdir(parents=True,exist_ok=True)
Q=P/'qa'; Q.mkdir(exist_ok=True)
M=P/'masters'; M.mkdir(exist_ok=True)
LAYERS=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
guides={}
def warp(name,sp,tp):
    guides[name]={'source':sp,'target':tp,'method':'clothing-only thin-plate spline; manual visual surface guides, not rig pivots'}
    a=np.array(Image.open(S/(name+'.png')).convert('RGBA'))
    border=[[0,0],[768,0],[0,768],[768,768]]
    rbf=RBFInterpolator(np.array(border+tp,float),np.array(border+sp,float),kernel='thin_plate_spline')
    y,x=np.mgrid[:768,:768];xy=rbf(np.c_[x.ravel(),y.ravel()]).reshape(768,768,2)
    return Image.fromarray(np.stack([map_coordinates(a[:,:,c],[xy[:,:,1],xy[:,:,0]],order=1,mode='constant') for c in range(4)],-1))

parts={n:Image.new('RGBA',(768,768)) for n in LAYERS}
parts['helmet']=warp('helmet',
 [[260,290],[280,235],[355,205],[420,230],[449,280],[435,308],[390,287],[345,278],[325,329],[352,375],[295,356]],
 [[246,304],[259,251],[328,215],[390,225],[417,264],[412,283],[368,275],[326,291],[312,340],[336,380],[279,370]])
parts['torso_armor']=warp('torso_armor',
 [[281,400],[307,398],[333,384],[360,395],[384,402],[409,410],[423,426],[322,437],[397,438],[317,467],[382,473],[355,490],[309,497],[407,502]],
 [[320,387],[344,391],[361,373],[392,378],[422,383],[451,397],[466,417],[371,422],[446,414],[397,452],[459,440],[435,465],[389,480],[483,466]])
parts['arm_rear']=warp('arm_rear',
 [[300,398],[286,425],[278,453],[270,480],[268,507],[255,518],[285,516]],
 [[344,395],[323,420],[312,444],[303,467],[302,488],[287,491],[323,488]])
parts['arm_front']=warp('arm_front',
 [[414,418],[423,448],[436,475],[447,505],[448,520],[435,518],[462,515]],
 [[451,401],[472,418],[500,427],[530,439],[535,452],[514,448],[550,445]])
parts['legs_boots']=warp('legs_boots',
 [[320,476],[350,478],[391,477],[320,515],[306,551],[289,589],[285,619],[283,639],[381,517],[401,548],[382,583],[390,616],[399,636]],
 [[402,444],[432,442],[460,444],[428,484],[431,522],[402,553],[392,587],[390,611],[477,482],[501,516],[494,549],[499,579],[518,596]])

base=Image.open(R/'r2-upload/hero/v5/g2/base/death_01.png').convert('RGBA')
admissions={
 'legs_boots':{'donor':'legs_material_donor.png','box':[350,430,550,630], 'poly':[[394,446],[457,435],[480,456],[540,490],[540,621],[355,625],[354,549],[389,516]]},
 'arm_rear':{'donor':'right_arm_material_donor.png','box':[260,370,410,520], 'poly':[[355,375],[379,395],[371,425],[340,450],[329,473],[341,478],[336,501],[278,513],[272,477],[285,452],[295,429],[304,402],[327,380]]},
 'arm_front':{'donor':'left_arm_material_donor.png','box':[430,360,570,500], 'poly':[[450,386],[476,399],[498,414],[524,416],[551,431],[559,464],[504,466],[498,442],[475,440],[462,431],[447,418]]}}
for name,spec in admissions.items():
    box=spec['box'];x0,y0,x1,y1=box
    donor=Image.open(M/spec['donor']).convert('RGBA').resize((x1-x0,y1-y0),Image.Resampling.LANCZOS)
    a=np.array(donor)
    # Extend nearest interior material, excluding the donor's displaced outline.
    # Canonical contour supplies the final narrow outline, not generated geometry.
    interior=distance_transform_edt(a[:,:,3]>200)>2
    _,ix=distance_transform_edt(~interior,return_indices=True)
    rgb=a[ix[0],ix[1],:3]
    mask=Image.new('L',(768,768));ImageDraw.Draw(mask).polygon([tuple(v) for v in spec['poly']],fill=255)
    alpha=ImageChops.multiply(base.getchannel('A'),mask)
    # All generated geometry is rejected: bounded canonical body contours define
    # these three equipment silhouettes, including the original open fingers.
    out=np.zeros((768,768,4),np.uint8);out[y0:y1,x0:x1,:3]=rgb
    out[:,:,3]=np.array(alpha)
    contour=(distance_transform_edt(out[:,:,3]>32)<=1)&(out[:,:,3]>0)
    out[contour,:3]=[43,29,22];out[out[:,:,3]==0,:3]=0
    parts[name]=Image.fromarray(out)
    mask.save(M/(name+'_canonical_admission_mask.png'))
    spec['admittedChannels']='donor RGB only; canonical Base alpha inside manual part region; no donor geometry'

# Chest owns the white shirt coverage behind its adjoining sleeves and belt.
# Extend existing leather material into this bounded insertion; no shared underlay.
arr=np.array(parts['torso_armor']);mask=Image.new('L',(768,768))
ImageDraw.Draw(mask).polygon([(350,384),(373,380),(399,381),(423,383),(444,395),(451,419),(466,440),(392,468),(386,448),(358,433)],fill=255)
ba=np.array(base);white=(ba[:,:,0].astype(int)-ba[:,:,1].astype(int)<30)&(ba[:,:,0].astype(int)-ba[:,:,2].astype(int)<50)&(ba[:,:,2]>90)
white[:372]=False;white[470:]=False;white[:,:350]=False;white[:,470:]=False
needed=np.maximum(np.array(ImageChops.multiply(base.getchannel('A'),mask)),np.where(white,ba[:,:,3],0).astype(np.uint8));old=arr[:,:,3]
_,ix=distance_transform_edt(old<200,return_indices=True)
add=needed>old;arr[add,:3]=arr[ix[0],ix[1],:3][add];arr[:,:,3]=np.maximum(old,needed)
parts['torso_armor']=Image.fromarray(arr)
mask.save(M/'chest_owned_insertion_mask.png')

# Owner accepted the latest placement sheet on 2026-10-28. Bake only
# these exact offline integer shifts; all five other exports remain unchanged.
for n,(dx,dy) in {'helmet':(-2,-8),'torso_armor':(-2,-6)}.items():
    shifted=Image.new('RGBA',(768,768));shifted.paste(parts[n],(dx,dy));parts[n]=shifted
for n,im in parts.items():im.save(E/(n+'.png'))
orders={'authoring':['coverage_underlay','legs_boots','arm_front','torso_armor','helmet','sword','arm_rear'],
        'leather_runtime_no_weapon':['coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet','sword']}
for label,order in orders.items():
    out=base.copy()
    for n in order:out=Image.alpha_composite(out,parts[n])
    out.save(Q/(label+'.png'))

def flat(im):
    b=Image.new('RGBA',im.size,(220,225,233,255));b.alpha_composite(im);return b.convert('RGB')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
manifest=json.loads(subprocess.check_output(['git','show','origin/main:r2-upload/manifest.json'],cwd=R))['assets']['hero001']['v5']['g2']
azure=base.copy();azsources=[]
for n in LAYERS:
    f=R/'r2-upload'/manifest['equipment']['azure']['frames']['death_01'][n].split('?')[0]
    assert subprocess.check_output(['git','show','origin/main:'+str(f.relative_to(R))],cwd=R)==f.read_bytes()
    azure=Image.alpha_composite(azure,Image.open(f).convert('RGBA'));azsources.append({'layer':n,'path':str(f.relative_to(R)),'sha256':sha(f)})
azure.save(Q/'azure.png')
sheet=Image.new('RGB',(1920,590),(220,225,233));d=ImageDraw.Draw(sheet)
for i,(label,im) in enumerate([('Canonical Base / unchanged',base),('Azure / current main manifest',azure),('Leather Death_01 / OWNER APPROVED',Image.open(Q/'leather_runtime_no_weapon.png'))]):
    d.text((i*640+15,15),label,font=font,fill='black');sheet.paste(flat(im.crop((100,140,740,680))),(i*640,45))
sheet.save(P/'DEATH_01_COMPARISON.png')
sheet=Image.new('RGB',(1400,600),(220,225,233));d=ImageDraw.Draw(sheet)
for i,n in enumerate(LAYERS):
    im=parts[n];box=im.getbbox();d.text((i*200+5,12),n,font=font,fill='black')
    if box:
        c=flat(im.crop(box));c.thumbnail((190,440));sheet.paste(c,(i*200+(200-c.width)//2,55))
    else:d.text((i*200+10,90),'EMPTY',font=font,fill='black')
sheet.save(P/'SEVEN_PARTS.png')
records=[]
for n in LAYERS:
    f=E/(n+'.png');im=Image.open(f);a=np.array(im)[:,:,3]
    assert im.size==(768,768) and im.mode=='RGBA'
    assert not a[0].any() and not a[-1].any() and not a[:,0].any() and not a[:,-1].any()
    rec={'layer':n,'path':str(f.relative_to(R)),'sha256':sha(f),'dimensions':[768,768],'mode':'RGBA','origin':[0,0],'alphaBounds':im.getbbox(),'alphaNonzeroPixels':int((a>0).sum()),'edgeAlphaNonzero':0}
    if not a.any():rec['emptyReason']='Owner: coverage belongs to each equipment piece; no shared underlay artwork' if n=='coverage_underlay' else 'Death pose releases weapon; Azure Death contract has no required grip and transparent sword.'
    records.append(rec)
protected=list((R/'r2-upload/hero/v5/g2/base').glob('*.png'))+list((R/'docs/g16-leather-g2/g3/attack-back-torso-review/exports').glob('*/*.png'))+list(S.glob('*.png'))+list((P.parent/'exports').glob('idle_*/*.png'))
for f in protected:assert subprocess.check_output(['git','show','HEAD:'+str(f.relative_to(R))],cwd=R)==f.read_bytes()
(P/'PLACEMENT.json').write_text(json.dumps(guides,indent=2)+'\n')
(P/'DONOR_ADMISSION.json').write_text(json.dumps(admissions,indent=2)+'\n')
(P/'VALIDATION.json').write_text(json.dumps({'status':'DEATH_01_OWNER_APPROVED','mainChecked':subprocess.check_output(['git','rev-parse','origin/main'],cwd=R,text=True).strip(),'risk':'MEDIUM','ownerAccepted':'2026-10-28 latest placement-review-v2 after.png at 52252e222217c3b8207093d7dff59e3974c74698','approvedOfflineShifts':{'helmet':[-2,-8],'torso_armor':[-2,-6]},'torsoFacing':'front / reclined three-quarter','files':records,'azureSources':azsources,'protectedPngCount':len(protected),'protectedByteIdentical':True,'baseResampled':False,'runtimeChanged':False,'runtimeOffsetBaked':False,'productionManifestChanged':False,'death01VisualAcceptance':True,'technicalChecks':'PASS; final all-frame gate is in ../VALIDATION.json'},indent=2)+'\n')
print('PASS: Death_01 accepted positions baked into 7 paths; Base, Idle and Attack bytes unchanged.')
