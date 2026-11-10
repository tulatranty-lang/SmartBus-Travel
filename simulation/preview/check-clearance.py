import bisect,collections,json,math,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]/'.artifacts/traffic-detail'
n=json.loads((root/'network.json').read_text(encoding='utf-8'))
scenario=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--scenario=')),'normal')
if scenario not in ['normal','busy','rain']:raise ValueError('Unknown scenario')
r=json.loads((root/('replay-'+scenario+'.json')).read_text(encoding='utf-8'))
bus=next(v for v in r['specs'] if v['type']=='bus')
def xy(c):return [(c[0]-n['origin'][0])*n['scale'][0],(c[1]-n['origin'][1])*n['scale'][1]]
grid=collections.defaultdict(list)
for road in n['roads']:
 points=[xy(p) for p in road['coords']]
 for a,b in zip(points,points[1:]):
  half=road['width']/2
  item=(a,b,half,road['id'])
  for x in range(math.floor((min(a[0],b[0])-half-5)/50),math.floor((max(a[0],b[0])+half+5)/50)+1):
   for y in range(math.floor((min(a[1],b[1])-half-5)/50),math.floor((max(a[1],b[1])+half+5)/50)+1):grid[x,y].append(item)
def outside(p):
 best=(float('inf'),None,None)
 for a,b,half,id in grid[math.floor(p[0]/50),math.floor(p[1]/50)]:
  dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy or 1)))
  margin=math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)-half
  if margin<best[0]:best=(margin,id,[a[0]+t*dx,a[1]+t*dy])
 return best
worst=(-float('inf'),None);samples=[]
for frame_i,frame in enumerate(r['frames']):
 v=next((v for v in frame if v[0]==0),None)
 if v is None:continue
 i=max(0,min(len(n['path'])-2,bisect.bisect(n['prefix'],v[1])-1));a,b=n['path'][i:i+2]
 t=(v[1]-n['prefix'][i])/(n['prefix'][i+1]-n['prefix'][i] or 1)
 front=[a[k]+(b[k]-a[k])*t for k in (0,1)]
 u=[math.cos(v[3]),math.sin(v[3])];normal=[-u[1],u[0]]
 for longitudinal in [0,-bus['length']]:
  for lateral in [-bus['width']/2,bus['width']/2]:
   p=[front[k]+u[k]*longitudinal+normal[k]*lateral for k in (0,1)]
   margin,id,closest=outside(p)
   if margin>worst[0]:worst=(margin,{'time':frame_i*r['period'],'s':v[1],'way':id,'point':p,'closestRoadPoint':closest,'bodyLongitudinalM':longitudinal,'bodyLateralM':lateral})
   if margin>.1:samples.append(margin)
result={'scenarioId':scenario,'estimatedRoadWidthEnvelopeOnly':True,'maxOutsideEstimatedAsphaltM':round(worst[0],3),'worst':worst[1],'bodyCornerSamplesOutsideByOver10cm':len(samples),'note':'Four body corners sampled at 0.25 s against source width or inferred lane width; not a surveyed curb, island, or legal-lane validation.'}
(root/('clearance-'+scenario+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
if scenario=='normal':(root/'clearance.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
