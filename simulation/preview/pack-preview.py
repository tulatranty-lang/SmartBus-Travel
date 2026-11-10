import json,math,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.artifacts/traffic-detail'
n=json.loads((OUT/'network.json').read_text(encoding='utf-8'))
r=json.loads((OUT/'replay.json').read_text(encoding='utf-8'))
def xy(c):return [(c[0]-n['origin'][0])*n['scale'][0],(c[1]-n['origin'][1])*n['scale'][1]]
def packed(coords):return [[round(p[0]*10),round(p[1]*10)] for p in map(xy,coords)]
samples=n['path'][::80]
buildings=[]
for id,coords in n['buildings']:
 pts=[xy(p) for p in coords]
 x=sum(p[0] for p in pts)/len(pts);y=sum(p[1] for p in pts)/len(pts)
 if min(math.hypot(x-p[0],y-p[1]) for p in samples)>250:continue
 buildings.append([id,packed(coords)])
roads=[[p['id'],p['name'],round(p['width'],1),p['lanes'],int(p['oneway']),int(p['laneEvidence']=='inferred'),packed(p['coords'])] for p in n['roads']]
base=json.loads((ROOT/'.artifacts/map-preview-data.json').read_text(encoding='utf-8'))
water=[[w[0],packed(w[2])] for w in base['water'] if any(108.211<p[0]<108.26 and 16.047<p[1]<16.073 for p in w[2])]
water += [['area',packed(p)] for p in base['ocean']]
crossings=[]
for p in n['crossings']:
 coord=xy(p['coord'])
 best=(float('inf'),0,0)
 for road in n['roads']:
  if road['width']<5:continue
  points=[xy(c) for c in road['coords']]
  for a,b in zip(points,points[1:]):
   dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((coord[0]-a[0])*dx+(coord[1]-a[1])*dy)/(dx*dx+dy*dy or 1)))
   dist=math.hypot(coord[0]-a[0]-t*dx,coord[1]-a[1]-t*dy)
   if dist<best[0]:best=(dist,math.atan2(dy,dx),road['width'])
 if best[0]<8:crossings.append([p['id'],round(coord[0],2),round(coord[1],2),round(best[1],4),best[2]])
data={'origin':n['origin'],'scale':n['scale'],'path':[[round(p[0],2),round(p[1],2)] for p in n['path'][::2]],'roads':roads,'buildings':buildings,'water':water,'crossings':crossings,'signals':[[p['id'],*map(lambda x:round(x,2),xy(p['coord']))] for p in n['signals']],'gates':n['gates'],'stop':n['stop'],'stats':n['stats'],'assumptions':n['assumptions'],'replay':r,'rawPoints':base['routes'][0]['points'],'oldShape':packed(base['routes'][0]['shape'])}
data['clearance']=json.loads((OUT/'clearance.json').read_text(encoding='utf-8'))
(OUT/'preview-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'bytes':(OUT/'preview-data.json').stat().st_size,'buildingsShown':len(buildings),'crossingsShown':len(crossings),'roads':len(roads),'pathPoints':len(data['path']),'replayStats':r['stats']},ensure_ascii=False))
