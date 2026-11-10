"""Refine the generated pilot path against an estimated-width envelope.

This is not a survey or a replacement for the SUMO/legal-lane review. It operates
only on generated replay input, never on original GPS or OSM source files.
"""
import bisect,json,math,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
out=Path(__file__).resolve().parents[2]/'.artifacts/traffic-detail'
n=json.loads((out/'network.json').read_text(encoding='utf-8'))
c=json.loads((out/'clearance.json').read_text(encoding='utf-8'))
if c['maxOutsideEstimatedAsphaltM']<=.08:
 print('No further estimated-envelope correction needed');sys.exit(0)
if 'referencePath' not in n:
 n['referencePath']=n['path'];n['referencePrefix']=n['prefix'];n['lateralPlan']=[0]*len(n['path']);n['clearanceCorrections']=[]
pfx=n['referencePrefix'];base=n['referencePath'];s=c['worst']['s']-4
i=max(1,min(len(base)-2,bisect.bisect(pfx,s)-1));a,b=base[i-1],base[i+1]
dx,dy=b[0]-a[0],b[1]-a[1];l=math.hypot(dx,dy);normal=[dy/l,-dx/l]
p,q=c['worst']['point'],c['worst']['closestRoadPoint'];gx,gy=q[0]-p[0],q[1]-p[1];gl=math.hypot(gx,gy)
direction=(gx*normal[0]+gy*normal[1])/(gl or 1)
change=max(-1.5,min(1.5,(c['maxOutsideEstimatedAsphaltM']+.2)*direction))
for j,d in enumerate(pfx):
 weight=max(0,1-abs(d-s)/42)
 weight=weight*weight*(3-2*weight)
 n['lateralPlan'][j]=max(0,min(3.2,n['lateralPlan'][j]+change*weight))
path=[]
for j,p in enumerate(base):
 a=base[max(0,j-5)];b=base[min(len(base)-1,j+5)];dx,dy=b[0]-a[0],b[1]-a[1];l=math.hypot(dx,dy) or 1;shift=n['lateralPlan'][j]
 path.append([p[0]+dy/l*shift,p[1]-dx/l*shift])
n['path']=[[round(p[0],3),round(p[1],3)] for p in path];n['prefix']=[0]
for a,b in zip(path,path[1:]):n['prefix'].append(n['prefix'][-1]+math.dist(a,b))
n['length']=n['prefix'][-1]
n['pathLngLat']=[[round(n['origin'][0]+p[0]/n['scale'][0],7),round(n['origin'][1]+p[1]/n['scale'][1],7)] for p in path]
n['curvature']=[]
for j,p in enumerate(path):
 a=path[max(0,j-6)];b=path[min(len(path)-1,j+6)]
 av=[p[0]-a[0],p[1]-a[1]];bv=[b[0]-p[0],b[1]-p[1]];al=math.hypot(*av);bl=math.hypot(*bv)
 angle=math.acos(max(-1,min(1,sum(av[k]*bv[k] for k in (0,1))/(al*bl or 1)))) if al*bl else 0
 n['curvature'].append(round(angle/max(1,(al+bl)/2),5))
n['clearanceCorrections'].append({'sourceS':round(s,2),'maxShiftM':round(change,3),'spreadM':84,'usesInferredWidths':True})
n['assumptions']['clearanceOptimization']='local lateral plan, capped at 3.2 m; legal-lane and surveyed curb review still required'
(out/'network.json').write_text(json.dumps(n,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps(n['clearanceCorrections'][-1],ensure_ascii=False))
