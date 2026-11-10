"""Apply ONLY three recorded equipment repair masks; retain all other candidate pixels."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import json,hashlib
import numpy as np
P=Path(__file__).resolve().parent
raw=Image.open(P/'masters/attack_01_bounded_repair_raw.png').convert('RGBA')
gen=raw.resize((768,768),Image.Resampling.LANCZOS)
D=P/'candidate_exports/attack_01';R=P.parents[3]
base=Image.open(R/'r2-upload/hero/v5/g2/base/attack_01.png').convert('RGBA')
changes={
 'arm_front':[(445,473),(480,468),(511,481),(518,501),(507,521),(477,525),(451,511)],
 'helmet':[(312,337),(351,337),(349,355),(338,374),(338,413),(312,410)],
 'torso_armor':[(288,432),(305,437),(308,471),(318,485),(312,495),(288,489)]
}
records=[]
for name,points in changes.items():
 old=Image.open(D/(name+'.png')).convert('RGBA');mask=Image.new('L',(768,768));ImageDraw.Draw(mask).polygon(points,fill=255)
 if name=='helmet':
  # Extract leather only; the Base remains the source of ALL facial pixels.
  a=np.array(gen);skin=(a[:,:,0]>175)&(a[:,:,1]>95)&(a[:,:,2]>65)&(a[:,:,0]>a[:,:,1]*1.15)&(a[:,:,1]>a[:,:,2]*1.12)
  m=np.array(mask);m[skin]=0;mask=Image.fromarray(m)
 patch=gen.copy();patch.putalpha(ImageChops.multiply(patch.getchannel('A'),mask))
 out=old.copy();out.paste((0,0,0,0),(0,0,768,768),mask);out=Image.alpha_composite(out,patch)
 oa=np.array(old);na=np.array(out);mm=np.array(mask);delta=np.any(oa!=na,axis=2);assert not delta[mm==0].any()
 out.save(D/(name+'.png'));mask.save(P/'qa'/f'{name}_allowed_repair_mask.png')
 records.append({'layer':name,'allowedPolygon':points,'changedPixels':int(delta.sum()),'changedOutsideMask':0})
parts={p.stem:Image.open(p).convert('RGBA') for p in D.glob('*.png')};comp=base.copy();free=base.copy()
for n in ['coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet','sword']:
 comp=Image.alpha_composite(comp,parts[n])
 if n!='sword':free=Image.alpha_composite(free,parts[n])
hand=Image.new('RGBA',(768,768));hand.paste(parts['arm_rear'].crop((270,275,344,343)),(270,275));comp=Image.alpha_composite(comp,hand)
comp.save(P/'qa/attack_01_candidate_composite.png');free.save(P/'qa/attack_01_weapon_free_composite.png')
# Source means the reassembled weapon-free exported pieces on the UNCHANGED Base.
free.save(P/'masters/attack_01_reconstructed_weapon_free.png')
over=Image.new('RGBA',(768,768),(210,216,225,255));over.alpha_composite(Image.blend(base,free,.5));over.save(P/'qa/attack_01_base_overlay.png')
bb=np.array(base);cc=np.array(comp);assert np.array_equal(bb[356:412,356:446],cc[356:412,356:446])
(P/'BOUNDED_REPAIR.json').write_text(json.dumps({'mode':'built-in ImageGen then fixed-canvas masked extraction','rawDimensions':list(raw.size),'normalization':[768,768],'perLimbTransforms':False,'baseModified':False,'faceCoreBox':[356,356,446,412],'faceCoreRGBAUnchanged':True,'records':records},indent=2)+'\n')
