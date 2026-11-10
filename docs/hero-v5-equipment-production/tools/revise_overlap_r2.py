"""Restore approved source pixels lost/misassigned by semantic cut masks. No source redraw."""
from build import *
from parts import HEAD,ARMS
from io import BytesIO
import zipfile
OUT=WORK/'revision-r2';OUT.mkdir(exist_ok=True)
HEAD['robot'][4]=[(0,240),(146,240),(166,225),(188,215),(218,211),(235,205),(254,205),(281,202),(317,192),(512,192)]
HEAD['skeleton'][4]=[(0,228),(169,228),(190,216),(218,218),(247,217),(275,217),(300,215),(326,209),(347,197),(512,197)]
ARMS['robot'][1][0]=[(222,141),(244,141),(262,150),(265,166),(254,184),(246,196),(235,222),(234,239),(252,250),(261,270),(243,285),(225,285),(205,272),(187,256),(172,252),(159,239),(160,219),(174,198),(195,184),(210,164),(213,151)]
archive=WORK/'HERO_V5_ROBOT_SKELETON_REVIEW.zip'
with zipfile.ZipFile(archive) as z:data={n:z.read(n) for n in z.namelist()}
fixes={}
for kind,idx,layers in [('robot',1,['arm_front']),('robot',4,['helmet','torso_armor','arm_front','arm_rear']),('skeleton',4,['helmet','torso_armor','arm_front','arm_rear'])]:
 atlas=clean(Image.open(WORK/'sources'/f'{kind}-atlas.png'));im=atlas.crop((idx%3*512,idx//3*512,idx%3*512+512,idx//3*512+512))
 parts=parts_fit(im,kind,idx);frame=UNIQUE[idx]
 for k in layers:
  a=np.array(parts[k]);lab,n=label(a[:,:,3]>8);sz=np.bincount(lab.ravel());keep=np.zeros(len(sz),bool)
  if len(sz)>1:keep[1+np.argmax(sz[1:])]=True
  a[~keep[lab]]=0;a[a[:,:,3]==0,:3]=0;im=Image.fromarray(a)
  key=f'{kind}/{frame}/{k}.png';b=BytesIO();im.save(b,format='PNG');fixes[key]=b.getvalue()
# Render only new review sheets first; package promotion occurs after visual inspection.
manifest=json.loads((ROOT/'r2-upload/manifest.json').read_text())['assets']['hero001']['v5']['g2']
order=['wing_far','base','hair_back','hair_front']+LAYERS+['wing_near']
for kind in ['robot','skeleton']:
 sheet=Image.new('RGB',(1536,832),'#202934');draw=ImageDraw.Draw(sheet)
 for i,f in enumerate(FRAMES):
  layers={}
  layers['base']=Image.open(ROOT/'r2-upload'/manifest['base']['frames'][f]).convert('RGBA')
  for k,p in manifest['wingTemplate']['frames'][f].items():layers[k]=Image.open(ROOT/'r2-upload'/p).convert('RGBA')
  layers['hair_back']=layers['hair_front']=Image.new('RGBA',(768,768))
  for k in LAYERS:
   key=f'{kind}/{f}/{k}.png';layers[k]=Image.open(BytesIO(fixes.get(key,data[key]))).convert('RGBA')
  full=Image.new('RGBA',(768,768))
  for k in order:full.alpha_composite(layers[k])
  if (kind,f) in [('robot','attack_01'),('robot','death_01'),('skeleton','death_01')]:full.save(OUT/f'{kind}-{f}-check.png')
  bg=Image.new('RGBA',(768,768),'#536171');bg.alpha_composite(full);sheet.paste(bg.resize((384,384)),(i%4*384,i//4*416+32));draw.text((i%4*384+10,i//4*416+8),kind+' / '+f+' / R2',fill='white')
 sheet.save(OUT/f'{kind}-asset-sheet-8-frames-r2.jpg',quality=95)
for key,b in fixes.items():
 p=OUT/'layers'/key;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
(OUT/'PATCHES.json').write_text(json.dumps({k:{'previousSha256':hashlib.sha256(data[k]).hexdigest(),'sha256':hashlib.sha256(v).hexdigest()} for k,v in fixes.items()},indent=2))
print('Created nine targeted layer patches and two 8-frame review sheets')
