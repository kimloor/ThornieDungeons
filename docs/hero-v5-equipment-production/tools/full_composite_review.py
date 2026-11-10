"""Read-only asset composition from current manifest and frozen candidate ZIP."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from io import BytesIO
import json,zipfile,hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[3];DOC=ROOT/'docs/hero-v5-equipment-production';OUT=DOC/'full-composite-review'
OUT.mkdir(exist_ok=True)
manifest=json.loads((ROOT/'r2-upload/manifest.json').read_text())['assets']['hero001']['v5']['g2']
archive=DOC/'HERO_V5_ROBOT_SKELETON_REVIEW.zip';z=zipfile.ZipFile(archive)
FRAMES=['idle_01','idle_02','idle_03','attack_01','attack_02','attack_03','death_01','death_02']
ORDER=['wing_far','base','hair_back','hair_front','coverage_underlay','torso_armor','legs_boots','arm_rear','helmet','sword','arm_front','wing_near']
SEQS={'idle':(['idle_01','idle_02','idle_03','idle_02'],[350]*4),'attack':(['idle_01','attack_01','attack_02','attack_03','idle_01'],[650,650,650,650,650]),'death':(['idle_01','death_01','death_02'],[650,600,1200])}
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
report={'drawOrder':ORDER,'placement':'All native 768x768 layers at (0,0), no per-frame fitting/recentering. Whole review image uniformly downscaled.','hair':'current default Topknot source audited, BOTH hair layers suppressed for full-face helmets per user approval','wings':'current approved Wing R5','archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'sequences':SEQS,'sourceHashes':{},'frames':{},'outputs':{}}
def read(path):
 p=ROOT/'r2-upload'/path.split('?')[0];data=p.read_bytes();report['sourceHashes'][str(p.relative_to(ROOT))]=hashlib.sha256(data).hexdigest();return Image.open(BytesIO(data)).convert('RGBA')
def panel(im,label,size=512):
 bg=Image.new('RGBA',(768,768),'#536171');bg.alpha_composite(im);out=Image.new('RGB',(size,size+32),'#202934');out.paste(bg.convert('RGB').resize((size,size),Image.Resampling.LANCZOS),(0,32));ImageDraw.Draw(out).text((10,7),label,font=font,fill='white');return out
for kind in ['robot','skeleton']:
 composites={};report['frames'][kind]={}
 for f in FRAMES:
  layers={'base':read(manifest['base']['frames'][f])}
  for k,p in manifest['wingTemplate']['frames'][f].items():layers[k]=read(p)
  for k,p in manifest['hair'][manifest['defaultHair']]['frames'][f].items():layers[k]=read(p)
  # Full-face helmet policy: retain source audit but suppress both hair draw layers.
  for hk in ['hair_back','hair_front']:layers[hk]=Image.new('RGBA',(768,768))
  for k in ORDER[4:-1]:
   name=f'{kind}/{f}/{k}.png';data=z.read(name);layers[k]=Image.open(BytesIO(data)).convert('RGBA');report['sourceHashes']['ZIP:'+name]=hashlib.sha256(data).hexdigest()
  full=Image.new('RGBA',(768,768));before_near=None
  hair=Image.new('RGBA',(768,768));hair.alpha_composite(layers['hair_back']);hair.alpha_composite(layers['hair_front'])
  armor=Image.new('RGBA',(768,768))
  for k in ORDER:
   assert layers[k].size==(768,768)
   full.alpha_composite(layers[k])
   if k in ORDER[4:-1]:armor.alpha_composite(layers[k])
  composites[f]=full
  ha=np.asarray(hair)[:,:,3]/255;aa=np.asarray(armor)[:,:,3]/255;visible=ha*(1-aa)*(1-np.asarray(layers['wing_near'])[:,:,3]/255)
  report['frames'][kind][f]={'visibleHairPixelsAboveAlpha10':int((visible>10/255).sum()),'foregroundWingPixelsOverSword':int(((np.asarray(layers['wing_near'])[:,:,3]>128)&(np.asarray(layers['sword'])[:,:,3]>128)).sum()),'compositeBBox':full.getbbox()}
  # Lossless full-size reference for precise inspection.
  full.save(OUT/f'{kind}-full-{f}.png')
 sheet=Image.new('RGB',(4*384,2*416),'#202934')
 for i,f in enumerate(FRAMES):sheet.paste(panel(composites[f],kind+' / '+f,384),(i%4*384,i//4*416))
 sheet.save(OUT/f'{kind}-full-composite-contact-sheet.jpg',quality=93)
 for name,(frames,times) in SEQS.items():
  imgs=[panel(composites[f],f'{kind} / {f} / {ms} ms') for f,ms in zip(frames,times)]
  path=OUT/f'{kind}-full-{name}-slow.gif';buffer=BytesIO();imgs[0].save(buffer,format='GIF',save_all=True,append_images=imgs[1:],duration=times,loop=0,disposal=2,optimize=False);path.write_bytes(buffer.getvalue())
  assert path.stat().st_size>1000
  decoded=Image.open(path);actual=[]
  for j in range(decoded.n_frames):decoded.seek(j);decoded.load();actual.append(decoded.info['duration'])
  assert actual==times,(path,actual,times)
  report['outputs'][path.name]={'frameCount':decoded.n_frames,'durationsMs':actual,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
for p in OUT.glob('*contact-sheet.jpg'):report['outputs'][p.name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(OUT/'VALIDATION.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report['frames'],indent=2))
