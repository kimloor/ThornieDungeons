"""Rebuild review-only Idle02/03 candidates from approved Idle01; never writes R2 staging."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import hashlib,json,numpy as np
R=Path(__file__).resolve().parents[3];O=Path(__file__).resolve().parent;S=R/'r2-upload/hero/v5/g2/equipment/skeleton';frames=['idle_01','idle_02','idle_03'];layers=['helmet','torso_armor','arm_rear','legs_boots'];deltas=[0,-12,-4]
def load(p):return Image.open(p).convert('RGBA')
def shift(im,dy):
 out=Image.new('RGBA',im.size);out.paste(im,(0,dy));return out
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
checks={};inventory=[];pub=json.loads((R/'docs/skeleton-visual-audit/approved-idle-01/PUBLICATION.json').read_text())
for n in layers:
 p=S/'idle_01'/(n+'.png');assert sha(p)==pub['objects'][str(p.relative_to(R/'r2-upload'))]['sha256']
# Existing motion must be exact, not inferred from approximate anatomy coordinates.
for n in ['base','coverage_underlay','arm_front','sword']:
 p1=R/'r2-upload/hero/v5/g2/base/idle_01.png' if n=='base' else S/'idle_01'/(n+'.png');a=load(p1)
 for f,dy in zip(frames[1:],deltas[1:]):
  p=R/'r2-upload/hero/v5/g2/base'/(f+'.png') if n=='base' else S/f/(n+'.png');same=np.array_equal(np.array(shift(a,dy)),np.array(load(p)));assert same,(n,f);checks[n+'/'+f]=same
for f,dy in zip(frames[1:],deltas[1:]):
 dest=O/'candidates'/f;dest.mkdir(parents=True,exist_ok=True)
 for n in layers:
  src=S/'idle_01'/(n+'.png');a=load(src);b=shift(a,dy);p=dest/(n+'.png');b.save(p);assert b.size==(768,768) and b.mode=='RGBA';assert np.count_nonzero(np.array(a)[:,:,3])==np.count_nonzero(np.array(b)[:,:,3]);assert np.array_equal(np.array(a)[-dy:],np.array(b)[:dy]);inventory.append({'frame':f,'layer':n,'candidate':str(p.relative_to(R)),'future_replacement_path':str((S/f/(n+'.png')).relative_to(R)),'source_idle01_sha256':sha(src),'original_sha256':sha(S/f/(n+'.png')),'candidate_sha256':sha(p),'delta':[0,dy],'rgba_exact_inverse_shift':True,'alpha_pixels_preserved':True,'dimensions':[768,768]})
rt=json.loads((O/'RUNTIME-REFERENCE.json').read_text());old=[];new=[]
for i,f in enumerate(frames):
 pair=[]
 for updated in [False,True]:
  im=Image.new('RGBA',(768,768))
  for l in rt['idle'][i]:
   assert (l['x'],l['y'],l['scale'],l['rotation'])==(0,84,1,0) and not l.get('crop');p=R/'r2-upload'/l['path'].split('?')[0]
   alt=O/'candidates'/f/(l['name']+'.png')
   if updated and alt.exists():p=alt
   im.alpha_composite(load(p))
  pair.append(im)
 old.append(pair[0]);new.append(pair[1])
for i,dy in enumerate(deltas):assert np.array_equal(np.array(new[i]),np.array(shift(new[0],dy))),frames[i]
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
def bg(im):
 b=Image.new('RGBA',im.size,(55,62,73,255));b.alpha_composite(im);return b.convert('RGB')
def sheet(items,cols,name):
 out=Image.new('RGB',(cols*384,50+((len(items)+cols-1)//cols)*425),(24,29,38));dr=ImageDraw.Draw(out);dr.text((12,14),'Skeleton Idle review | unchanged coordinates / runtime order',font=font,fill='white')
 for i,(title,im) in enumerate(items):
  x=i%cols*384;y=50+i//cols*425;out.paste(bg(im).resize((384,384)),(x,y+32));dr.text((x+9,y+8),title,font=font,fill='white')
 out.save(O/name)
sheet([(f+' / Current',old[i]) for i,f in enumerate(frames)]+[(f+' / Candidate',new[i]) for i,f in enumerate(frames)],3,'OLD-VS-NEW.png');sheet([(f+' / '+('Locked source' if i==0 else 'Candidate'),new[i]) for i,f in enumerate(frames)],3,'IDLE-01-03-ASSEMBLED.png')
sheet([(f+' / '+n,im.crop((240,350,480,665)).resize((768,768))) for i,f in enumerate(frames[1:],start=1) for n,im in [('Current',old[i]),('Candidate',new[i])]],2,'ALIGNMENT-DETAIL.png')
anim=[]
for i,f in enumerate(frames):
 out=Image.new('RGB',(768,425),(24,29,38));dr=ImageDraw.Draw(out);out.paste(bg(old[i]).resize((384,384)),(0,35));out.paste(bg(new[i]).resize((384,384)),(384,35));dr.text((10,8),f+' / Current',font=font,fill='white');dr.text((394,8),f+' / Candidate',font=font,fill='white');anim.append(out)
anim[0].save(O/'IDLE-COMPARISON.gif',save_all=True,append_images=anim[1:],duration=rt['frameMs'],loop=0)
(O/'INVENTORY.json').write_text(json.dumps({'baseline':'ab3a887ee2036ab37c6f5244c8658058e5291be0','source':'Owner-approved Idle01 revision07, source SHA locked','candidate_count':len(inventory),'inventory':inventory,'existing_motion_checks':checks,'assembled_full_rgba_exact_after_bob':True,'owner_visual_approval':'PENDING','publication':'NOT AUTHORIZED'},indent=2)+'\n');(O/'SHA256SUMS').write_text(''.join(x['candidate_sha256']+'  '+str(Path(x['candidate']).relative_to(O.relative_to(R)))+'\n' for x in inventory));print('PASS: 8 RGBA768 candidates, approved source hashes, exact Base/shared-layer bob, zero alpha clipping, exact full composite bob')
