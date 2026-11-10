"""Offline authored fitting; never changes base or runtime. Requires Pillow, numpy, scipy."""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates, distance_transform_edt, binary_fill_holes, label
ROOT=Path(__file__).resolve().parents[3]
WORK=ROOT/'docs/hero-v5-equipment-production'
BASE=ROOT/'r2-upload/hero/v5/g2/base'
AZ=ROOT/'r2-upload/hero/v5/g2/equipment/azure'
FRAMES=['idle_01','idle_02','idle_03','attack_01','attack_02','attack_03','death_01','death_02']
UNIQUE=['idle_01','attack_01','attack_02','attack_03','death_01','death_02']
LAYERS=['coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front']
# Four skull corners, foreground shoulder, rear shoulder, chest, hip,
# foreground grip, rear hand, foreground knee, rear knee, foreground foot, rear foot.
TARGET=[
[(170,134),(309,134),(170,268),(309,268),(203,274),(268,278),(236,294),(233,330),(180,336.667),(297,340),(207,367),(266,365),(188,416),(264,413)],
[(192,167),(317,167),(192,288),(317,288),(204,282),(267,292),(237,312),(233,348),(206.667,206),(325,333),(196,382),(266,371),(166,429),(249,417)],
[(159,167),(293,167),(159,288),(293,288),(238,296),(178,281),(214,316),(211,347),(326,298.667),(136,300),(177,382),(244,370),(141,433),(221,416)],
[(159,165),(294,165),(159,288),(294,288),(231,295),(190,286),(216,317),(212,348),(275.333,367.333),(152,326),(174,388),(229,390),(150,433),(224,432)],
[(158,134),(300,134),(158,255),(300,255),(232,270),(306,270),(268,282),(284,309),(199,324),(354,293),(290,344),(330,335),(261,395),(337,389)],
[(185,233),(324,233),(185,370),(324,370),(192,351),(240,375),(212,380),(181,404),(220,438),(264,438),(195,433),(161,429),(139,429),(176,441)]
]
SOURCES={
'robot':[
[(193,110),(343,110),(193,250),(343,250),(181,248),(302,268),(258,281),(240,341),(137,328),(328,334),(185,386),(288,380),(158,439),(276,429)],
[(219,114),(379,114),(219,261),(379,261),(221,268),(327,281),(288,302),(270,351),(235,167),(394,322),(219,393),(328,385),(171,440),(300,430)],
[(231,116),(392,116),(231,261),(392,261),(293,282),(217,265),(281,310),(262,350),(423,277),(166,284),(206,387),(321,386),(161,441),(299,428)],
[(186,112),(342,112),(186,263),(342,263),(230,275),(159,274),(227,308),(203,351),(315,344),(112,294),(159,390),(251,388),(122,426),(235,427)],
[(183,66),(312,66),(183,197),(312,197),(240,236),(322,228),(290,258),(303,302),(171,306),(407,276),(274,353),(372,342),(254,411),(374,399)],
[(247,239),(421,239),(247,367),(421,367),(263,341),(350,376),(276,386),(216,405),(296,450),(361,445),(221,443),(182,442),(143,445),(242,450)]
],
'skeleton':[
[(189,113),(344,113),(189,260),(344,260),(174,272),(300,283),(254,295),(248,350),(137,365),(328,375),(188,412),(281,411),(154,467),(291,472)],
[(221,126),(373,126),(221,286),(373,286),(211,276),(325,306),(284,312),(265,355),(238,146),(397,351),(198,410),(319,400),(150,473),(290,451)],
[(223,126),(434,126),(223,275),(434,275),(302,288),(229,280),(284,324),(262,361),(459,299),(169,306),(216,414),(333,396),(177,475),(306,447)],
[(191,177),(345,177),(191,286),(345,286),(243,302),(162,275),(218,317),(192,366),(327,389),(101,313),(150,416),(250,413),(107,460),(247,448)],
[(172,84),(323,84),(172,209),(323,209),(235,230),(339,228),(290,259),(314,306),(151,321),(438,281),(296,370),(383,353),(276,431),(408,432)],
[(242,239),(446,239),(242,386),(446,386),(253,350),(335,397),(267,392),(207,423),(299,457),(358,454),(223,450),(172,445),(140,452),(239,458)]
]}
def clean(im):
 a=np.array(im.convert('RGBA')); alpha=a[:,:,3].astype(float)
 # Remove faint halo, normalize the almost-opaque authored core.
 alpha=np.clip((alpha-8)*255/245,0,255).astype('uint8')
 labels,n=label(alpha>0); sizes=np.bincount(labels.ravel()); keep=sizes>=24;keep[0]=False
 alpha[~keep[labels]]=0;a[:,:,3]=alpha;a[alpha==0,:3]=0
 return Image.fromarray(a)
def warp(im,src,dst):
 # Smooth offline inverse warp constrained by hand-authored body landmarks.
 src=np.array(src,float);dst=np.array(dst,float)
 rbf=RBFInterpolator(dst,src,kernel='thin_plate_spline',smoothing=1.0)
 yy,xx=np.mgrid[:768,:768];xy=np.stack([xx.ravel()/1.5,yy.ravel()/1.5],1)
 uv=np.concatenate([rbf(c) for c in np.array_split(xy,16)])
 arr=np.asarray(im).astype(float);a=arr[:,:,3]/255;arr[:,:,:3]*=a[:,:,None]
 out=np.stack([map_coordinates(arr[:,:,c],[uv[:,1],uv[:,0]],order=1,mode='constant',cval=0).reshape(768,768) for c in range(4)],2)
 aa=out[:,:,3]/255;out[:,:,:3]/=np.maximum(aa[:,:,None],1e-6)
 out=np.clip(out,0,255).astype('uint8');out[out[:,:,3]==0,:3]=0
 return Image.fromarray(out)
def shift(im,dy):
 o=Image.new('RGBA',(768,768));o.paste(im,(0,dy));return o

from parts import HEAD,ARMS
from scipy.ndimage import binary_dilation
TARGET[2][11]=(260,362)
TARGET[3][10]=(178,379)
TARGET[3][11]=(246,372)
SOURCES['skeleton'][3][:4]=[(191,130),(345,130),(191,294),(345,294)]
def poly(points):
 im=Image.new('L',(512,512));ImageDraw.Draw(im).polygon(points,fill=255);return np.array(im)>0
def affine_piece(im,mask,src,dst,similar=False):
 src=np.asarray(src,float);dst=np.asarray(dst,float)*1.5
 if similar:
  v=src[1]-src[0];w=dst[1]-dst[0];a=np.dot(v,w)/np.dot(v,v);b=(v[0]*w[1]-v[1]*w[0])/np.dot(v,v)
  linear=np.array([[a,-b],[b,a]]);offset=dst[0]-linear@src[0];m=np.column_stack([linear,offset])
 else:m=np.linalg.lstsq(np.column_stack([src,np.ones(len(src))]),dst,rcond=None)[0].T
 inv=np.linalg.inv(np.vstack([m,[0,0,1]]))[:2].ravel()
 arr=np.array(im);arr[:,:,3]=np.where(binary_dilation(mask,iterations=2),arr[:,:,3],0);arr[arr[:,:,3]==0,:3]=0
 return Image.fromarray(arr).transform((768,768),Image.Transform.AFFINE,tuple(inv),resample=Image.Resampling.BICUBIC)
def parts_fit(im,kind,i):
 src=SOURCES[kind][i];dst=TARGET[i]
 head=poly([(0,0),(512,0)]+list(reversed(HEAD[kind][i])))
 front=poly(ARMS[kind][i][0]);rear=poly(ARMS[kind][i][1]);rear&=~head
 # Foreground glove overrides helmet where the raised attack arm occludes it.
 if i!=1:front&=~head
 head&=~front
 yy,xx=np.mgrid[:512,:512];legs=(yy>src[7][1]-12)&~front&~rear&~head
 torso=~(head|front|rear|legs)
 pieces={
 'helmet':affine_piece(im,head,[src[j] for j in [0,1,2]],[dst[j] for j in [0,1,2]]),
 'torso_armor':affine_piece(im,torso,[src[j] for j in [4,5,7]],[dst[j] for j in [4,5,7]]),
 'legs_boots':affine_piece(im,legs,[src[j] for j in [7,12,13]],[dst[j] for j in [7,12,13]]),
 'arm_front':affine_piece(im,front,[src[j] for j in [4,8]],[dst[j] for j in [4,8]],True),
 'arm_rear':affine_piece(im,rear,[src[j] for j in [5,9]],[dst[j] for j in [5,9]],True),
 }
 # Fit only the leg region through hip, knees and feet; head and arms remain rigid.
 legarr=np.array(im);legarr[:,:,3]=np.where(binary_dilation(legs,iterations=2),legarr[:,:,3],0)
 pieces['legs_boots']=warp(Image.fromarray(legarr),[src[j] for j in [7,10,11,12,13]],[dst[j] for j in [7,10,11,12,13]])
 return pieces

def run():
 out=WORK/'package';out.mkdir(exist_ok=True)
 check=Image.new('RGB',(1536,1536),'#526171');d=ImageDraw.Draw(check);report={}
 for si,kind in enumerate(['robot','skeleton']):
  atlas=clean(Image.open(WORK/'sources'/f'{kind}-atlas.png'));fits={}
  for i,f in enumerate(UNIQUE):
   crop=atlas.crop((i%3*512,i//3*512,i%3*512+512,i//3*512+512));fits[f]=parts_fit(crop,kind,i)
  # A shared intact helmet prevents the raised-arm occlusion hole and keeps attacks consistent.
  idle_helmet=fits['idle_01']['helmet']
  for idx in [1,2,3]:
   frombox=np.array(TARGET[0][:3])*1.5;tobox=np.array(TARGET[idx][:3])*1.5
   m=np.linalg.lstsq(np.column_stack([frombox,np.ones(3)]),tobox,rcond=None)[0].T
   inv=np.linalg.inv(np.vstack([m,[0,0,1]]))[:2].ravel()
   fits[UNIQUE[idx]]['helmet']=idle_helmet.transform((768,768),Image.Transform.AFFINE,tuple(inv),resample=Image.Resampling.BICUBIC)
  for f,dy in [('idle_02',-12),('idle_03',-4)]:fits[f]={k:shift(v,dy) for k,v in fits['idle_01'].items()}
  report[kind]={}
  for j,f in enumerate(FRAMES):
   folder=out/kind/f;folder.mkdir(parents=True,exist_ok=True);base=Image.open(BASE/f'{f}.png').convert('RGBA')
   parts=fits[f]
   under=np.array(base);a=under[:,:,3].copy();under[:,:,:3]=[25,24,31] if kind=='robot' else [34,26,43];under[:,:,3]=a;under[a==0,:3]=0
   parts['coverage_underlay']=Image.fromarray(under)
   parts['sword']=Image.new('RGBA',(768,768))
   armor=Image.new('RGBA',(768,768))
   for k in LAYERS:
    if k not in ['coverage_underlay','sword']:
     ar=np.array(parts[k]);lab,n=label(ar[:,:,3]>8);sz=np.bincount(lab.ravel());keep=np.zeros(len(sz),bool);order=np.argsort(sz[1:])[::-1]+1;selected=order[:2 if k=='legs_boots' else 1];keep[selected[sz[selected]>=1000]]=True;ar[~keep[lab]]=0;parts[k]=Image.fromarray(ar)
    parts[k].save(folder/f'{k}.png');armor.alpha_composite(parts[k])
   armor.save(folder/'armor-composite.png')
   preview=Image.new('RGBA',(768,768),'#526171');preview.alpha_composite(base);preview.alpha_composite(armor)
   check.paste(preview.resize((384,384)),((j%4)*384,(si*2+j//4)*384));d.text(((j%4)*384+8,(si*2+j//4)*384+8),kind+' '+f,fill='white')
   no_under=Image.new('RGBA',(768,768))
   for k in LAYERS[1:]:no_under.alpha_composite(parts[k])
   ba=np.asarray(base)[:,:,3];fa=np.asarray(no_under)[:,:,3]
   report[kind][f]={'base_pixels_covered_by_underlay_only':int(((ba>200)&(fa<200)).sum()),'armor_bbox':armor.getbbox()}
 check.save(WORK/'fitting-check.jpg');(WORK/'fitting-metrics.json').write_text(json.dumps(report,indent=2))
if __name__=='__main__':run()
