from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,hashlib
P=Path(__file__).resolve().parent;R=P.parents[5];src=P.parent/'azure-order-correction/exports';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
resolved=json.loads(subprocess.check_output(['node',str(P.parent/'bounded-overlap-review/resolve.cjs')],cwd=R))['azure'];mapping={'arm_rear':'arm_front','arm_front':'arm_rear'}
labels=['Base','Underlay','Chest + shoulder plates','Trousers + boots','Extended arm','Helmet','Complete sword','Raised sword arm']
rows=[];azparts=[];leparts=[]
for i,entry in enumerate(resolved):
 n=entry['name'];azpath=R/'r2-upload'/entry['path'].split('?')[0];ln=mapping.get(n,n);lp=azpath if n=='base' else src/(ln+'.png')
 for f in [azpath,lp]:assert Image.open(f).size==(768,768) and Image.open(f).mode=='RGBA'
 assert subprocess.check_output(['git','show','origin/main:'+str(azpath.relative_to(R))],cwd=R)==azpath.read_bytes()
 rows.append({'backToFront':i+1,'meaning':labels[i],'azureLayer':n,'azureManifestPath':entry['path'],'azureSha256':sha(azpath),'leatherLayer':ln,'leatherSource':str(lp.relative_to(R)),'leatherSha256':sha(lp)})
 azparts.append(Image.open(azpath).convert('RGBA'));leparts.append(Image.open(lp).convert('RGBA'))
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
BG=(220,225,233,255)
def flat(im):
 bg=Image.new('RGBA',im.size,BG);bg.alpha_composite(im);return bg.convert('RGB')
def cumulative(parts):
 out=Image.new('RGBA',(768,768));seq=[]
 for part in parts:out=Image.alpha_composite(out,part);seq.append(out.copy())
 return seq
az=cumulative(azparts);le=cumulative(leparts)
# Full fixed source canvas is used for all composites; one identical review crop
# and proportional scale is used only to make the step sheet legible.
sheet=Image.new('RGB',(1200,8*330+55),BG[:3]);d=ImageDraw.Draw(sheet)
for c,t in enumerate(['AZURE isolated part','AZURE accumulated','LEATHER isolated part','LEATHER accumulated']):d.text((c*300+8,12),t,font=font,fill='black')
for i,row in enumerate(rows):
 y=55+i*330
 for c,im in enumerate([azparts[i],az[i],leparts[i],le[i]]):
  thumb=flat(im.crop((65,120,545,700))).resize((240,290),Image.Resampling.LANCZOS);sheet.paste(thumb,(c*300+30,y+35))
  lname=row['azureLayer'] if c<2 else row['leatherLayer'];d.text((c*300+7,y),f'{i+1}. {lname}',font=font,fill='black');d.text((c*300+7,y+19),row['meaning'],font=small,fill=(65,65,65))
sheet.save(P/'LAYER_WALKTHROUGH.png')
az[-1].save(P/'azure_reassembled.png');le[-1].save(P/'leather_reassembled.png')
comparison=Image.new('RGB',(1536,820),BG[:3]);comparison.paste(flat(az[-1]),(0,52));comparison.paste(flat(le[-1]),(768,52));d=ImageDraw.Draw(comparison);d.text((20,12),'AZURE / actual manifest + resolver order',font=font,fill='black');d.text((788,12),'LEATHER / matching anatomical order',font=font,fill='black');d.text((788,33),'No masks / no hand crop / no extra torso pass',font=small,fill='black');comparison.save(P/'COMPARISON.png')
# A direct pixel assertion prevents the diagnostic from becoming a hidden art edit.
assert le[-1].tobytes()==Image.open(P.parent/'azure-order-correction/reassembled.png').convert('RGBA').tobytes()
report={'status':'AZURE_LAYER_ORDER_VERIFIED_ATTACK_01_VISUAL_ACCEPTANCE_PENDING','main':'7ef31753b969386d2750857dddaa53d44c03081c','branchParent':'1ca732eba38a77a27a07adee5dd66c4ea6f395a1','risk':'LOW offline composition evidence only','rows':rows,'masksUsed':False,'extraTorsoPass':False,'extraHandPass':False,'artworkModified':False,'samePixelsAsEarlierUnmaskedAzureOrderCheckpoint':True,'runtimeModified':False,'runtimeOffsetBaked':False,'visualAccepted':False,'G3Complete':False,'knownIssues':['Waist insertion remains above chest skirt under strict Azure order.','Sleeve insertion remains above shoulder plates under strict Azure order.','This offline anatomical mapping is different from merged leather_overlap_v1; no runtime or slot remapping authorized.']}
(P/'ORDER.json').write_text(json.dumps(report,indent=2)+'\n')
(P/'SHA256SUMS').write_text(''.join(sha(f)+'  '+f.name+'\n' for f in sorted(P.iterdir()) if f.is_file() and f.name!='SHA256SUMS'))
print('PASS: Azure resolver + manifest verified, eight accumulation stages, exact anatomical mapping, same Leather pixels as prior unmasked Azure-order checkpoint.')
