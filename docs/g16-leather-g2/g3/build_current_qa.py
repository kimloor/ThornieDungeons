"""Validate the final Owner-approved G4 files without rewriting artwork/evidence.
Run from any directory: python docs/g16-leather-g2/g3/build_current_qa.py
Historical Death reconstruction scripts reproduce G3 only, not these G4 repairs.
"""
from pathlib import Path
from PIL import Image
import hashlib, json, io, subprocess
import numpy as np
P=Path(__file__).resolve().parent;R=P.parents[2]
v=json.loads((P/'VALIDATION.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
# Accepted source tree identity avoids relying on a mutable branch or commit date.
SOURCE_TREE='44a6e60b9c3447ad81b91cdf539a9ae594bc36e5'
def previous(path):
    return subprocess.check_output(['git','show',SOURCE_TREE+':'+path],cwd=R)
def compose(f,parts):
    out=Image.open(R/'r2-upload/hero/v5/g2/base'/f'{f}.png').convert('RGBA')
    for n in v['assemblyOrderByFrame'][f]:out=Image.alpha_composite(out,parts[n])
    if f.startswith('idle'):
        x,y,w,h=v['handOcclusion'][f]['crop'];hand=Image.new('RGBA',(768,768));hand.paste(parts['arm_rear'].crop((x,y,x+w,y+h)),(x,y));out=Image.alpha_composite(out,hand)
    return out
assert len(v['files'])==56 and len({x['path'] for x in v['files']})==56
comps={};changed=0
for f,h in v['baseSha256'].items():
    path=f'r2-upload/hero/v5/g2/base/{f}.png';assert sha((R/path).read_bytes())==h==sha(previous(path))
    parts={};old={};rows=[x for x in v['files'] if x['frame']==f];assert len(rows)==7
    directory=(R/rows[0]['path']).parent;assert {p.name for p in directory.glob('*.png')}=={x['layer']+'.png' for x in rows}
    for rec in rows:
        b=(R/rec['path']).read_bytes();assert sha(b)==rec['sha256'];oldbytes=previous(rec['path']);assert sha(oldbytes)==rec['acceptedSourceSha256']
        delta=b!=oldbytes;assert delta==rec['changedSinceG3'];changed+=delta
        im=Image.open(io.BytesIO(b));assert im.mode=='RGBA' and im.size==(768,768) and rec['origin']==[0,0]
        a=np.array(im)[:,:,3];assert not any([a[0].any(),a[-1].any(),a[:,0].any(),a[:,-1].any()]);assert list(im.getbbox())==rec['alphaBounds'] if im.getbbox() else rec['alphaBounds'] is None
        if not a.any():assert rec['emptyReason']
        if rec['layer'] in ['helmet','sword','coverage_underlay']:assert not delta
        parts[rec['layer']]=im;old[rec['layer']]=Image.open(io.BytesIO(oldbytes)).convert('RGBA')
        if (f,rec['layer']) in [('death_01','arm_rear'),('death_01','legs_boots'),('death_02','legs_boots')]:assert np.array_equal(a,np.array(old[rec['layer']])[:,:,3])
    out=compose(f,parts);before=compose(f,old);assert np.array_equal(np.array(out)[:,:,3]>0,np.array(before)[:,:,3]>0)
    assert out.tobytes()==Image.open(P/'qa'/f'{f}_composite.png').convert('RGBA').tobytes();comps[f]=out
assert changed==11 and len(v['files'])-changed==45
for f,dy in [('idle_02',-12),('idle_03',-4)]:
    im=Image.new('RGBA',(768,768));im.paste(comps['idle_01'],(0,dy));assert im.tobytes()==comps[f].tobytes()
for rec in v['evidence']:
    p=R/rec['path'];assert sha(p.read_bytes())==rec['sha256']
    if p.suffix.lower() in ['.png','.gif']:
        with Image.open(p) as im:
            for i in range(getattr(im,'n_frames',1)):im.seek(i);im.load()
# Byte-preserve all accepted current-contract sources beyond this task.
for p in ['r2-upload/manifest.json','src/phaser/presentation/HeroV5RuntimeContract.js']:
    assert (R/p).read_bytes()==previous(p)
print('PASS: 56/56, 11 approved replacements, 45 preserved; 8 Bases; RGBA/origin/alpha; exact Idle bob; Death RGB alpha; helmets/swords/underlays; offline assemblies and evidence SHA. G5/G6 NOT certified.')
