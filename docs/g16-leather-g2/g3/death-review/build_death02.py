"""Distinct kneeling Death_02 reconstruction, canonical anatomy never resampled."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFont
import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates, distance_transform_edt, binary_dilation
import json, hashlib, sys

P=Path(__file__).resolve().parent; R=P.parents[3]
M=P/'masters/death_02';M.mkdir(parents=True,exist_ok=True)
S=R/'docs/g16-leather-g2/exports/idle_01'
LAYERS=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front']
base=Image.open(R/'r2-upload/hero/v5/g2/base/death_02.png').convert('RGBA')
specs={
 'arm_rear':{'box':[215,500,405,690],'poly':[[282,508],[310,525],[315,556],[319,586],[337,621],[351,640],[352,675],[307,675],[306,641],[285,617],[274,591],[260,565],[256,536],[264,516]],'designBox':[200,370,400,570]},
 'arm_front':{'box':[300,520,470,690],'poly':[[354,544],[368,562],[374,588],[394,614],[414,641],[418,673],[383,674],[377,641],[353,617],[340,587],[340,564]],'designBox':[370,390,510,530]},
 'legs_boots':{'box':[180,580,390,790],'poly':[[240,589],[302,592],[322,603],[352,615],[377,635],[376,665],[357,679],[184,679],[180,623],[224,610]],'designBox':[240,460,440,660]}}
for n,s in specs.items():
    mask=Image.new('L',(768,768));ImageDraw.Draw(mask).polygon([tuple(v) for v in s['poly']],fill=255)
    if n.startswith('arm_'):
        a=np.array(base).astype(float)
        skin=(a[:,:,0]>1.08*a[:,:,1])&(a[:,:,1]>1.1*a[:,:,2])&(a[:,:,0]>100)&(a[:,:,3]>10)
        skin=binary_dilation(skin,iterations=2)
        mask=ImageChops.multiply(mask,Image.fromarray((skin*255).astype(np.uint8)))
    mask=ImageChops.multiply(base.getchannel('A'),mask);mask.save(M/(n+'_canonical_mask.png'))
    if '--prepare' in sys.argv:
        target=base.copy();target.putalpha(mask)
        target.crop(s['box']).resize((1024,1024),Image.Resampling.LANCZOS).save(M/(n+'_pose_target.png'))
        Image.open(S/(n+'.png')).crop(s['designBox']).resize((1024,1024),Image.Resampling.LANCZOS).save(M/(n+'_design_reference.png'))
if '--prepare' in sys.argv:
    print('Prepared 3 bounded canonical pose targets and approved design references.');sys.exit()

def warp(n,sp,tp):
    border=[[0,0],[768,0],[0,768],[768,768]]
    rbf=RBFInterpolator(np.array(border+tp,float),np.array(border+sp,float),kernel='thin_plate_spline')
    y,x=np.mgrid[:768,:768];xy=rbf(np.c_[x.ravel(),y.ravel()]).reshape(768,768,2)
    a=np.array(Image.open(S/(n+'.png')).convert('RGBA'))
    guides[n]={'source':sp,'target':tp,'method':'clothing-only TPS, manual visual guides, not rig pivots'}
    return Image.fromarray(np.stack([map_coordinates(a[:,:,c],[xy[:,:,1],xy[:,:,0]],order=1,mode='constant') for c in range(4)],-1))
guides={};parts={n:Image.new('RGBA',(768,768)) for n in LAYERS}
parts['helmet']=warp('helmet',
 [[260,290],[280,235],[355,195],[420,230],[449,280],[435,308],[390,287],[345,278],[325,329],[352,375],[295,356]],
 [[276,434],[295,380],[395,342],[456,391],[470,452],[444,500],[405,466],[360,454],[315,485],[331,534],[277,502]])
parts['torso_armor']=warp('torso_armor',
 [[281,400],[307,398],[333,384],[360,395],[384,402],[409,410],[423,426],[322,437],[397,438],[317,467],[382,473],[355,490],[309,497],[407,502]],
 [[252,538],[278,532],[306,535],[328,550],[347,552],[355,566],[365,584],[270,566],[348,588],[254,594],[321,610],[288,610],[239,615],[338,631]])

for n,s in specs.items():
    x0,y0,x1,y1=s['box'];donor=Image.open(M/(n+'_material_donor.png')).convert('RGBA').resize((x1-x0,y1-y0),Image.Resampling.LANCZOS)
    a=np.array(donor);interior=distance_transform_edt(a[:,:,3]>200)>2
    _,ix=distance_transform_edt(~interior,return_indices=True);rgb=a[ix[0],ix[1],:3]
    out=np.zeros((768,768,4),np.uint8)
    # Leg reference canvas intentionally extends below the 768px export canvas.
    end=min(y1,768);out[y0:end,x0:x1,:3]=rgb[:end-y0]
    out[:,:,3]=np.array(Image.open(M/(n+'_canonical_mask.png')))
    contour=(distance_transform_edt(out[:,:,3]>32)<=1)&(out[:,:,3]>0)
    out[contour,:3]=[43,29,22];out[out[:,:,3]==0,:3]=0;parts[n]=Image.fromarray(out)
    s['admittedChannels']='donor RGB only; canonical per-part Base alpha; no generated anatomy'

# Finish chest-owned white-shirt coverage behind the sleeves and waist.
ch=np.array(parts['torso_armor']);ba=np.array(base)
white=(ba[:,:,0].astype(int)-ba[:,:,1].astype(int)<30)&(ba[:,:,0].astype(int)-ba[:,:,2].astype(int)<50)&(ba[:,:,2]>90)
white[:514]=False;white[615:]=False;white[:,:238]=False;white[:,355:]=False
needed=np.where(white,ba[:,:,3],0).astype(np.uint8);old=ch[:,:,3]
_,ix=distance_transform_edt(old<200,return_indices=True);add=needed>old
ch[add,:3]=ch[ix[0],ix[1],:3][add];ch[:,:,3]=np.maximum(old,needed)
# Preserve visible original chin: bounded equipment-alpha clearance only.
mask=Image.new('L',(768,768));ImageDraw.Draw(mask).polygon([(303,485),(440,485),(440,529),(425,535),(410,550),(391,559),(370,555),(348,546),(328,529),(313,511)],fill=255)
ch[:,:,3]=np.array(ImageChops.subtract(Image.fromarray(ch[:,:,3]),mask));parts['torso_armor']=Image.fromarray(ch)

E=P/'exports/death_02';E.mkdir(parents=True,exist_ok=True)
for n,im in parts.items():im.save(E/(n+'.png'))
# Owner: anatomical right arm (arm_rear) must appear in front of chest armor.
# Offline art assembly only; this does not change the runtime resolver.
order=['coverage_underlay','legs_boots','arm_front','torso_armor','helmet','sword','arm_rear']
out=base.copy()
for n in order:out=Image.alpha_composite(out,parts[n])
Q=P/'qa';Q.mkdir(exist_ok=True);out.save(Q/'death_02.png')
(P/'DEATH_02_PLACEMENT.json').write_text(json.dumps({'guides':guides,'admissions':specs,'order':order,'runtimeOffsetBaked':False,'generatedBaseUsed':False,'torsoFacing':'front / bowed three-quarter'},indent=2)+'\n')
print('Built 7 Death_02 candidate layers from distinct canonical kneeling pose; visual acceptance pending.')
