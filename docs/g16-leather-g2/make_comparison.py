from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
sheet=Image.new('RGB',(1800,720),'#eef0f3');d=ImageDraw.Draw(sheet)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
items=[('Previous cut preview',ROOT/'tmp/g16/weapon-free-g2/qa/reassembled_preview.png'),('Completed pieces: current contract',HERE/'qa/current_contract_order.png'),('Completed pieces: proposed overlap',HERE/'qa/reassembled_preview.png')]
for i,(title,path) in enumerate(items):
 im=Image.open(path).convert('RGBA').crop((220,175,490,660)).resize((330,594))
 bg=Image.new('RGBA',im.size,'#d9dfe6');bg.alpha_composite(im)
 sheet.paste(bg.convert('RGB'),(i*600+135,55));d.text((i*600+25,670),title,fill='#172033',font=font)
sheet.save(HERE/'qa/ORDER_COMPARISON.png')
