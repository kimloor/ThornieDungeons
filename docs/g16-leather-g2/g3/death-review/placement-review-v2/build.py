"""Owner-requested placement-only comparison; no new equipment export paths."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, subprocess
import numpy as np

P=Path(__file__).resolve().parent; R=P.parents[4]
SOURCE='43d4e8db9be7701934a051217965c0ded53e1c3b'
E='docs/g16-leather-g2/g3/death-review/exports/death_01/'
names=['coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet','sword']
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(path):
    import io
    data=subprocess.check_output(['git','show',SOURCE+':'+path],cwd=R)
    return Image.open(io.BytesIO(data)).convert('RGBA'),sha(data)
parts={}; hashes={}
for n in names:parts[n],hashes[n]=read(E+n+'.png')
base,basehash=read('r2-upload/hero/v5/g2/base/death_01.png')
for n,dy in {'helmet':-8,'torso_armor':-6}.items():
    shifted=Image.new('RGBA',(768,768));shifted.paste(parts[n],(0,dy));parts[n]=shifted
before=base.copy()
for n in names:before=Image.alpha_composite(before,parts[n])
changed={n:im.copy() for n,im in parts.items()}
shifts={'helmet':-2,'torso_armor':-2}
for n,dx in shifts.items():
    out=Image.new('RGBA',(768,768));out.paste(parts[n],(dx,0))
    assert np.array_equal(np.array(out)[:,:768+dx],np.array(parts[n])[:,-dx:])
    assert not np.array(parts[n])[:,:-dx,3].any()
    changed[n]=out
after=base.copy()
for n in names:after=Image.alpha_composite(after,changed[n])
for n in names:
    if n not in shifts:assert parts[n].tobytes()==changed[n].tobytes()
before.save(P/'before.png');after.save(P/'after.png')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',24)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
bg=(224,228,235);sheet=Image.new('RGB',(1200,1130),bg);d=ImageDraw.Draw(sheet)
def flat(im):
    b=Image.new('RGBA',im.size,bg+(255,));b.alpha_composite(im);return b.convert('RGB')
for col,(label,im) in enumerate([('PREVIOUS / vertical placement retained',before),('AFTER / helmet + chest left 2 px',after)]):
    x=col*600;d.text((x+18,18),label,font=small,fill=(25,30,38))
    crop=flat(im.crop((210,175,570,635))).resize((540,690),Image.Resampling.NEAREST)
    sheet.paste(crop,(x+30,62))
    detail=flat(im.crop((290,330,470,430))).resize((540,300),Image.Resampling.NEAREST)
    sheet.paste(detail,(x+30,795));d.text((x+24,760),'Neck / shoulder detail',font=small,fill=(25,30,38))
sheet.save(P/'BEFORE_AFTER_SHEET.png')
report={'status':'PLACEMENT_ONLY_OWNER_REVIEW_PENDING','risk':'LOW','sourceCommit':SOURCE,'mainChecked':'614d8e363efa074d257319f3e3578a56196c2a06','canvas':[768,768],'origin':[0,0],'offlinePlacement':{'helmet':[-2,-8],'torso_armor':[-2,-6]},'deltaFromPrevious':{'helmet':[-2,0],'torso_armor':[-2,0]},'previousPlacementCommit':'0c3ff8b9782e28965c9bbe37b250afea72f6d072','method':'integer translation, no interpolation, regeneration or repaint','otherFiveLayersPixelIdentical':True,'canonicalBaseSha256':basehash,'sourceLayerSha256':hashes,'equipmentExportsModified':False,'extraEquipmentExportPaths':False,'runtimeChanged':False,'death02Started':False,'G3Complete':False,'handoff':'Owner accepted previous vertical placement; both pieces now move left a further 2px. All other parts retained. Review requested horizontal adjustment.'}
(P/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
(P/'SHA256SUMS').write_text(''.join(sha(f.read_bytes())+'  '+f.name+'\n' for f in sorted(P.iterdir()) if f.is_file() and f.name!='SHA256SUMS'))
print('PASS: two exact integer translations; no clipping; other five layers and Base unchanged.')
