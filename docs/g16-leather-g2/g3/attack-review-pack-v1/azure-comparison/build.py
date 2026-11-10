from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,hashlib,numpy as np
P=Path(__file__).resolve().parent;A=P.parent;R=P.parents[4];sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
js="""const fs=require('fs'),vm=require('vm');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('src/phaser/presentation/HeroV5RuntimeContract.js','utf8'),c);c.config=JSON.parse(fs.readFileSync('r2-upload/manifest.json')).assets.hero001.v5.g2;c.opts={includeHair:false,includeWings:false,equipmentSelection:{equipment:Object.fromEntries(['helmet','chest','gloves','boots','weapon'].map(s=>[s,'azure']))}};const result={};for(const f of ['attack_01','attack_02','attack_03']){c.f=f;result[f]=vm.runInContext('heroV5FrameLayers(config,f,opts)',c);}console.log(JSON.stringify(result));"""
resolved=json.loads(subprocess.check_output(['node','-e',js],cwd=R));(P/'AZURE_RESOLVED_LAYERS.json').write_text(json.dumps(resolved,indent=2)+'\n')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',21);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
box=(70,120,768,720);w=698;h=600;sheet=Image.new('RGB',(1396,3*650+60),(220,225,233));draw=ImageDraw.Draw(sheet);draw.text((15,15),'AZURE vs LEATHER / same canonical canvas, crop and scale / no wings',font=font,fill='black')
ledger=[]
def flat(im):
 b=Image.new('RGBA',im.size,(220,225,233,255));b.alpha_composite(im);return b.convert('RGB')
for row,frame in enumerate(['attack_01','attack_02','attack_03']):
 azure=Image.new('RGBA',(768,768));paths=[]
 for layer in resolved[frame]:
  f=R/'r2-upload'/layer['path'].split('?')[0];assert subprocess.check_output(['git','show','origin/main:'+str(f.relative_to(R))],cwd=R)==f.read_bytes();azure=Image.alpha_composite(azure,Image.open(f).convert('RGBA'));paths.append({'layer':layer['name'],'selectedPath':layer['path'],'sha256':sha(f)})
 basepath=R/'r2-upload/hero/v5/g2/base'/f'{frame}.png';leather=Image.open(basepath).convert('RGBA')
 for name in ['coverage_underlay','legs_boots','arm_front','torso_armor','helmet','sword','arm_rear']:leather=Image.alpha_composite(leather,Image.open(A/'exports'/frame/(name+'.png')).convert('RGBA'))
 assert leather.tobytes()==Image.open(A/'qa'/f'{frame}.png').convert('RGBA').tobytes()
 azure.save(P/(frame+'_azure.png'))
 for col,(label,im) in enumerate([('AZURE / current manifest + actual resolver',azure),('LEATHER / latest Owner-order candidate',leather)]):
  y=60+row*650;draw.text((col*w+12,y+5),frame+'  |  '+label,font=small,fill='black');sheet.paste(flat(im.crop(box)),(col*w,y+40))
 ledger.append({'frame':frame,'sharedBaseSha256':sha(basepath),'azureSources':paths,'azureCompositeSha256':sha(P/(frame+'_azure.png')),'leatherCandidate':'../qa/'+frame+'.png','leatherCompositeSha256':sha(A/'qa'/f'{frame}.png'),'sameCanvas':[768,768],'origin':[0,0],'comparisonCrop':box,'scale':1,'runtimeOffsetApplied':False,'wings':False})
sheet.save(P/'AZURE_LEATHER_ATTACK_COMPARISON.png')
(P/'VALIDATION.json').write_text(json.dumps({'status':'READ_ONLY_POSE_COMPARISON_NOT_VISUAL_ACCEPTANCE','main':'7ef31753b969386d2750857dddaa53d44c03081c','branchParent':'0f3c9ad90f1af45f0d2148efd228e5ce0712b933','risk':'LOW read-only QA evidence','frames':ledger,'artworkChanged':False,'runtimeChanged':False,'poseExactMatchClaimed':False},indent=2)+'\n')
(P/'SHA256SUMS').write_text(''.join(sha(f)+'  '+f.name+'\n' for f in sorted(P.iterdir()) if f.is_file() and f.name!='SHA256SUMS'));print('PASS: 3 Azure manifest/resolver composites, 3 Leather export reassemblies, unchanged shared Base; common crop and scale.')
