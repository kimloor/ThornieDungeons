from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,hashlib
from scipy import ndimage
R=Path(__file__).resolve().parents[2];O=Path(__file__).resolve().parent
M=json.loads((R/'r2-upload/manifest.json').read_text())['assets']['hero001']['v5']['g2'];E=M['equipment']['azure'];FS=list(M['base']['frames'])
src=Image.open(O/'sources/helmet-pose-atlas.png').convert('RGBA')
boxes=[(0,0,384,512),(384,0,768,512),(768,0,1152,512),(1152,0,1536,512),(0,512,418,1024),(418,512,772,1024),(772,512,1152,1024),(1152,512,1536,1024)]
def clean(im):
 a=np.array(im);a[:,:,:3][a[:,:,3]==0]=0;return Image.fromarray(a)
arts=[]
for box in boxes:
 a=np.array(src.crop(box));lab,n=ndimage.label(a[:,:,3]>30);sizes=np.bincount(lab.ravel());sizes[0]=0;mask=ndimage.binary_dilation(lab==sizes.argmax(),iterations=1);a[~mask]=0
 # Generated opaque interiors arrive at alpha253; normalize to fully opaque.
 a[:,:,3]=np.minimum(a[:,:,3].astype(float)*255/253,255).astype('uint8');im=clean(Image.fromarray(a));arts.append(im.crop(im.getbbox()))
def read(p):return Image.open(R/'r2-upload'/p.split('?')[0]).convert('RGBA')
targets=[(400,411),(400,399),(400,407),(414,459),(376,458),(376,459),(391,408),(417,573)]
uvs=[(.73,.98)]*6+[(.67,.98),(.71,.98)]
widths=[285]*6+[285,285]
sheet=Image.new('RGB',(1536,832),'#202934');font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
report={'status':'PASS','canvas':[768,768],'fullFaceHelmet':True,'hideHairLayers':['hair_back','hair_front'],'inGameQA':False,'frames':{},'preservedHashes':{}}
for i,f in enumerate(FS):
 art=arts[0 if i<3 else i];w=widths[i];im=art.resize((w,round(w*art.height/art.width)),Image.Resampling.LANCZOS);u,v=uvs[i];x,y=targets[i];p=(round(x-u*im.width),round(y-v*im.height));helmet=Image.new('RGBA',(768,768));helmet.alpha_composite(im,p);helmet=clean(helmet)
 path=E['frames'][f]['helmet'].split('?')[0];helmet.save(R/'r2-upload'/path)
 comp=read(M['wingTemplate']['frames'][f]['wing_far']);comp.alpha_composite(read(M['base']['frames'][f]))
 for layer in E['layerOrder']:
  q=E['frames'][f][layer];comp.alpha_composite(read(q))
  if layer!='helmet':report['preservedHashes'][q.split('?')[0]]=hashlib.sha256((R/'r2-upload'/q.split('?')[0]).read_bytes()).hexdigest()
 comp.alpha_composite(read(M['wingTemplate']['frames'][f]['wing_near']))
 (O/'composites').mkdir(exist_ok=True);comp.save(O/'composites'/f'{f}.png')
 bg=Image.new('RGBA',(768,768),'#536171');bg.alpha_composite(comp);sheet.paste(bg.convert('RGB').resize((384,384),Image.Resampling.LANCZOS),(i%4*384,i//4*416+32));ImageDraw.Draw(sheet).text((i%4*384+10,i//4*416+8),'Azure / '+f,font=font,fill='white')
 a=np.array(helmet);assert not a[:,:,:3][a[:,:,3]==0].any();assert not (a[0,:,3].any() or a[-1,:,3].any() or a[:,0,3].any() or a[:,-1,3].any())
 report['frames'][f]={'bbox':helmet.getbbox(),'path':path,'sha256':hashlib.sha256((R/'r2-upload'/path).read_bytes()).hexdigest(),'chinAnchor':targets[i]}
sheet.save(O/'azure-fullface-8-frame-sheet.jpg',quality=95)
(O/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
print('8 native RGBA helmets and composites written; clean alpha and bounds PASS')
