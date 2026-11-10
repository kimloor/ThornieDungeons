from pathlib import Path
import json
from PIL import Image
R=Path(__file__).resolve().parents[2];O=Path(__file__).resolve().parent
p=R/'r2-upload/manifest.json';m=json.loads(p.read_text());e=m['assets']['hero001']['v5']['g2']['equipment']['azure']
e['fullFaceHelmet']=True;e['hideHairLayers']=['hair_back','hair_front'];e['helmetAssetRevision']='azure_angel_fullface_v1'
for f,layers in e['frames'].items():layers['helmet']=layers['helmet'].split('?')[0]+'?v=azure_angel_fullface_v1'
p.write_text(json.dumps(m,separators=(',',':'))+'\n')
base=R/'r2-upload/hero/v5/g2/equipment/azure'
for name in ['PUBLICATION.json','AZURE_FRAME_CONTRACT.json']:
 p=base/name;c=json.loads(p.read_text());c['fullFaceHelmet']=True;c['hideHairLayers']=['hair_back','hair_front'];c['helmetAssetRevision']='azure_angel_fullface_v1';c['helmetNotes']='User-approved Azure Angel full-face helmet replaces all eight original helmet.png files; native RGBA768 origin0,0. Hide both hair layers only while this helmet is equipped.'
 if name=='AZURE_FRAME_CONTRACT.json':c['status']='APPROVED_FOR_RUNTIME_PUBLICATION'
 p.write_text(json.dumps(c,indent=2)+'\n')
validation=json.loads((O/'VALIDATION.json').read_text());(base/'HELMET_VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n')
def gif(name,frames,durations):
 ims=[]
 for f in frames:
  a=Image.open(O/'composites'/f'{f}.png').convert('RGBA');bg=Image.new('RGBA',a.size,'#536171');bg.alpha_composite(a);ims.append(bg.convert('RGB').resize((512,512)))
 ims[0].save(O/name,save_all=True,append_images=ims[1:],duration=durations,loop=0,disposal=2)
gif('azure-fullface-idle.gif',['idle_01','idle_02','idle_03','idle_02'],[440]*4)
gif('azure-fullface-attack.gif',['idle_01','attack_01','attack_02','attack_03','idle_01'],[500]*5)
gif('azure-fullface-death.gif',['idle_01','death_01','death_02'],[500,600,1200])
