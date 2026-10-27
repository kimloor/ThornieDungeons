"""Attack_01 candidate extraction; original Base is never edited or repositioned."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import numpy as np,json,math,hashlib
P=Path(__file__).resolve().parent;R=P.parents[3];G2=P.parents[1]
src=Image.open(P/'masters/attack_01_registered.png').convert('RGBA')
base=Image.open(R/'r2-upload/hero/v5/g2/base/attack_01.png').convert('RGBA')
D=P/'candidate_exports/attack_01';D.mkdir(parents=True,exist_ok=True)
def polygon(points):
 m=Image.new('L',(768,768));ImageDraw.Draw(m).polygon(points,fill=255);return m
def cut(points):
 out=src.copy();m=polygon(points);out.putalpha(ImageChops.multiply(out.getchannel('A'),m));return out
parts={}
parts['coverage_underlay']=Image.new('RGBA',(768,768))
parts['arm_rear']=cut([(300,270),(326,279),(344,298),(344,317),(321,337),(294,343),(281,361),(283,380),(293,394),(319,412),(323,437),(312,451),(292,445),(271,426),(250,410),(230,389),(225,362),(242,338),(265,316),(270,291),(287,277)])
# Keep the raised pauldron with chest, excluding it from the sleeve source.
shoulder=[(293,375),(307,374),(323,385),(340,411),(332,428),(319,432),(308,423),(302,406)]
rear_alpha=ImageChops.subtract(parts['arm_rear'].getchannel('A'),polygon(shoulder));parts['arm_rear'].putalpha(rear_alpha)
parts['arm_front']=cut([(387,437),(410,444),(432,453),(453,465),(468,468),(484,461),(501,467),(517,483),(521,501),(511,515),(493,523),(475,517),(454,505),(430,500),(411,489),(390,479),(375,460)])
# Torso owns both shoulders and split-skirt/belt edge.
parts['torso_armor']=cut([(292,375),(307,374),(323,385),(339,406),(354,415),(373,415),(389,420),(410,431),(422,447),(408,452),(395,449),(391,471),(384,486),(389,498),(407,513),(380,516),(354,509),(338,517),(309,511),(283,510),(281,494),(291,480),(291,454),(285,436),(300,429),(310,424),(304,408)])
parts['legs_boots']=cut([(286,506),(309,500),(338,510),(354,505),(380,502),(408,519),(456,554),(444,577),(423,595),(395,605),(396,623),(398,643),(384,656),(360,655),(343,641),(331,610),(335,588),(343,571),(341,552),(324,564),(307,586),(288,611),(274,641),(256,674),(226,679),(206,661),(211,633),(237,598),(255,570),(270,542)])
# Source-only continuous trouser waistband insertion. No shared coverage layer.
patch=src.crop((311,517,358,531)).resize((80,19));band=Image.new('RGBA',(768,768));band.paste(patch,(301,495));parts['legs_boots']=Image.alpha_composite(band,parts['legs_boots'])
# Helmet extraction explicitly excludes the original face, gloved arm and shoulder.
helmet=src.copy();region=polygon([(290,261),(326,245),(367,238),(389,234),(414,249),(442,275),(465,315),(477,345),(461,365),(456,348),(434,350),(412,335),(385,324),(362,320),(348,329),(336,344),(328,362),(330,393),(335,411),(311,407),(290,397),(279,380),(268,350),(272,306),(285,283)])
region=ImageChops.subtract(region,parts['arm_rear'].getchannel('A'));region=ImageChops.subtract(region,polygon(shoulder));helmet.putalpha(ImageChops.multiply(helmet.getchannel('A'),region));parts['helmet']=helmet
# Complete approved G2 sword master: uniform rigid authoring transform about its grip.
sword=Image.open(G2/'exports/idle_01/sword.png').convert('RGBA');angle=math.radians(-115);c,s=math.cos(angle),math.sin(angle);px,py=270,512;tx,ty=310,309
# PIL affine maps output coordinates back to the untouched complete sword master.
inv=(c,s,px-c*tx-s*ty,-s,c,py+s*tx-c*ty)
parts['sword']=sword.transform((768,768),Image.Transform.AFFINE,inv,Image.Resampling.BICUBIC)
for n,im in parts.items():im.save(D/(n+'.png'))
crop=[270,275,74,68]
def composite(crop):
 out=base.copy()
 for n in ['coverage_underlay','legs_boots','arm_rear','arm_front','torso_armor','helmet','sword']:out=Image.alpha_composite(out,parts[n])
 x,y,w,h=crop;hand=Image.new('RGBA',(768,768));hand.paste(parts['arm_rear'].crop((x,y,x+w,y+h)),(x,y));return Image.alpha_composite(out,hand)
comp=composite(crop);comp.save(P/'qa/attack_01_candidate_composite.png')
free=base.copy()
for n in ['legs_boots','arm_rear','arm_front','torso_armor','helmet']:free=Image.alpha_composite(free,parts[n])
free.save(P/'qa/attack_01_weapon_free_composite.png')
# Preserve the actual Base in comparison; never use the generated face.
overlay=Image.blend(base,free,.5);bg=Image.new('RGBA',(768,768),(215,220,228,255));bg.alpha_composite(overlay);bg.save(P/'qa/attack_01_base_overlay.png')
meta={'status':'CANDIDATE_NOT_ACCEPTED','compositionProfile':'leather_overlap_v1','hairMode':'hidden_full_cover','canvas':[768,768],'origin':[0,0],'frame':'attack_01','handOcclusion':{'sourceLayer':'arm_rear','after':'sword','frames':{'attack_01':{'crop':crop,'review':'candidate; inspect raised forearm/helmet interference'}}},'weaponRegistration':{'source':'../../exports/idle_01/sword.png','sourceCanvas':[768,768],'sourceGrip':[270,512],'targetGrip':[310,309],'uniformScale':1,'rotationDegrees':-115,'runtimeTransform':False},'emptyReason':'Owner: coverage belongs to each equipment piece; no shared underlay artwork'}
(P/'CANDIDATE_METADATA.json').write_text(json.dumps(meta,indent=2)+'\n')
