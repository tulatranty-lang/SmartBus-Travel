"""Prepare a small OSM corridor for an explicitly illustrative bus replay.

No source GPS is overwritten. No fictional buildings or signal locations.
Lane widths/connectors/stop position are model assumptions and exported as such.
"""
import collections
import heapq
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.artifacts/traffic-detail'
PROFILE=json.loads((ROOT/'simulation/profiles/dn06-citybus.json').read_text(encoding='utf-8'))
source=ET.parse(OUT/'danang-detail.osm.xml').getroot()
SX=111195*math.cos(math.radians(16.061))
SY=111195
ORIGIN=[108.23,16.06]
def xy(c):return [(c[0]-ORIGIN[0])*SX,(c[1]-ORIGIN[1])*SY]
def ll(c):return [round(ORIGIN[0]+c[0]/SX,7),round(ORIGIN[1]+c[1]/SY,7)]
def tags(e):return {t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}
nodes={n.attrib['id']:{'ll':[float(n.attrib['lon']),float(n.attrib['lat'])],'tags':tags(n)} for n in source.findall('node')}
for n in nodes.values():n['xy']=xy(n['ll'])
ways=[];buildings=[];crossings=[];signals=[];graph=collections.defaultdict(list)
for n_id,n in nodes.items():
 if n['tags'].get('highway')=='traffic_signals':signals.append({'id':n_id,'coord':n['ll']})
 if n['tags'].get('highway')=='crossing':crossings.append({'id':n_id,'coord':n['ll']})
allowed={'primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','residential','unclassified','service','trunk','trunk_link'}
corridor={'Cầu Rồng','Đường Võ Văn Kiệt','Võ Văn Kiệt','Đường Võ Nguyên Giáp','Võ Nguyên Giáp'}
for w in source.findall('way'):
 t=tags(w);ids=[x.attrib['ref'] for x in w.findall('nd') if x.attrib['ref'] in nodes]
 if len(ids)<2:continue
 coords=[nodes[i]['ll'] for i in ids]
 if 'building' in t and len(ids)>3 and ids[0]==ids[-1]:buildings.append([w.attrib['id'],coords])
 h=t.get('highway')
 if h not in allowed:continue
 if t.get('access')=='private' or t.get('motor_vehicle')=='no':continue
 one=t.get('oneway') in ['yes','1','true','-1']
 lanes=int(t.get('lanes','2' if not one else '1').split(';')[0]) if t.get('lanes','2').split(';')[0].isdigit() else 2
 directional=max(1,lanes if one else math.ceil(lanes/2))
 mv=t.get('motor_vehicle:lanes','').split('|')
 legal=[i for i in range(directional) if i>=len(mv) or mv[i] not in ['no','bicycle','designated']]
 bus_lane=min(legal) if legal else 0
 width=float(t.get('width','0').split(' ')[0]) if t.get('width','0').replace('.','',1).isdigit() else 0
 if width<=0:width=lanes*3.2
 way={'id':w.attrib['id'],'name':t.get('name',''),'coords':coords,'lanes':directional,'width':max(3.2,width),'oneway':one,'busLane':bus_lane,'laneEvidence':'osm' if 'lanes' in t else 'inferred','ids':ids}
 ways.append(way)
 for a,b in zip(ids,ids[1:]):
  pa,pb=nodes[a]['xy'],nodes[b]['xy'];length=math.dist(pa,pb)
  if length<.02:continue
  if t.get('oneway')!='-1':graph[a].append((b,length,way,1))
  if not one or t.get('oneway')=='-1':graph[b].append((a,length,way,-1))

start_way=next(w for w in ways if w['id']=='199383481')
end_way=next(w for w in ways if w['id']=='1112433482')
start=min(start_way['ids'],key=lambda i:math.dist(nodes[i]['xy'],xy([108.2302,16.0612])))
end=min(end_way['ids'],key=lambda i:math.dist(nodes[i]['xy'],xy([108.24675,16.0582])))
queue=[(0,start)];cost={start:0};prev={}
while queue:
 d,u=heapq.heappop(queue)
 if d!=cost.get(u):continue
 if u==end:break
 for v,length,w,direction in graph[u]:
  penalty=1 if w['name'] in corridor else 8
  nd=d+length*penalty
  if nd<cost.get(v,float('inf')):cost[v]=nd;prev[v]=(u,w,direction);heapq.heappush(queue,(nd,v))
if end not in prev:raise RuntimeError('No directed road corridor found')
segments=[];curr=end
while curr!=start:
 old,w,direction=prev[curr];segments.append((old,curr,w,direction));curr=old
segments.reverse()

def normalize(v):
 l=math.hypot(*v);return [v[0]/l,v[1]/l] if l else [1,0]

# Offset each sourced carriageway into a legal illustrative lane. Smooth only
# the transitions between lane centres; do not run a free spline over the city.
centre=[]
for i,(a,b,w,direction) in enumerate(segments):
 pa,pb=nodes[a]['xy'],nodes[b]['xy']
 centre.append(pa)
 if i==len(segments)-1:centre.append(pb)

def resample(points,spacing=.5):
 out=[points[0]];carry=0
 for a,b in zip(points,points[1:]):
  length=math.dist(a,b)
  if not length:continue
  dist=spacing-carry
  while dist<length:
   out.append([a[k]+(b[k]-a[k])*dist/length for k in (0,1)]);dist+=spacing
  carry=length-(dist-spacing)
 out.append(points[-1]);return out
# C1 tangent connectors are generated only around selected source bends.
# Width-envelope and swept-body checks remain mandatory for the pilot.
centre_prefix=[0]
for a,b in zip(centre,centre[1:]):centre_prefix.append(centre_prefix[-1]+math.dist(a,b))
def on_centre(s):
 for i in range(len(centre_prefix)-1):
  if centre_prefix[i+1]>=s:
   t=(s-centre_prefix[i])/(centre_prefix[i+1]-centre_prefix[i] or 1)
   return [centre[i][k]+(centre[i+1][k]-centre[i][k])*t for k in (0,1)]
 return centre[-1]
turns=[]
for i in range(1,len(centre)-1):
 p=centre[i];a=on_centre(max(0,centre_prefix[i]-8));b=on_centre(min(centre_prefix[-1],centre_prefix[i]+8))
 vin=normalize([p[0]-a[0],p[1]-a[1]]);vout=normalize([b[0]-p[0],b[1]-p[1]])
 angle=math.acos(max(-1,min(1,sum(vin[k]*vout[k] for k in (0,1)))))
 if angle>math.radians(12):turns.append((angle,i))
chosen=[]
for angle,i in sorted(turns,reverse=True):
 s=centre_prefix[i]
 if all(abs(s-centre_prefix[j])>48 for j in chosen):chosen.append(i)
chosen.sort()
centre_smooth=[];last_s=0
for i in chosen:
 trim=max(12,min(22,PROFILE['vehicle']['wheelbase']*3.5))
 s=centre_prefix[i];entry=max(last_s,s-trim);exit=min(centre_prefix[-1],s+trim)
 for j,p in enumerate(centre):
  if last_s<=centre_prefix[j]<entry:centre_smooth.append(p)
 a,p,b=on_centre(entry),centre[i],on_centre(exit)
 ae=on_centre(max(0,entry-1));af=on_centre(min(centre_prefix[-1],entry+1))
 be=on_centre(max(0,exit-1));bf=on_centre(min(centre_prefix[-1],exit+1))
 va=normalize([af[k]-ae[k] for k in (0,1)]);vb=normalize([bf[k]-be[k] for k in (0,1)])
 handle=min(18,(exit-entry)/3)
 ca=[a[k]+va[k]*handle for k in (0,1)];cb=[b[k]-vb[k]*handle for k in (0,1)]
 for j in range(65):
  t=j/64;centre_smooth.append([(1-t)**3*a[k]+3*(1-t)**2*t*ca[k]+3*(1-t)*t*t*cb[k]+t**3*b[k] for k in (0,1)])
 last_s=exit
for j,p in enumerate(centre):
 if centre_prefix[j]>=last_s:centre_smooth.append(p)
dense=resample(centre_smooth,.5)
raw_offsets=[]
for p in dense:
 best=(float('inf'),0)
 for i,(a,b) in enumerate(zip(centre,centre[1:])):
  dx,dy=b[0]-a[0],b[1]-a[1];ratio=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy or 1)))
  dist=math.hypot(p[0]-a[0]-ratio*dx,p[1]-a[1]-ratio*dy)
  if dist<best[0]:best=(dist,i)
 w=segments[best[1]][2]
 offset=(w['busLane']-(w['lanes']-1)/2)*3.2
 if not w['oneway']:offset+=w['width']/4
 raw_offsets.append(offset)
path=[]
for i,p in enumerate(dense):
 a=dense[max(0,i-5)];b=dense[min(len(dense)-1,i+5)]
 tangent=normalize([b[0]-a[0],b[1]-a[1]]);normal=[tangent[1],-tangent[0]]
 window=raw_offsets[max(0,i-40):min(len(dense),i+41)]
 offset=sum(window)/len(window)
 path.append([p[k]+normal[k]*offset for k in (0,1)])
connector_count=len(chosen)
prefix=[0]
for a,b in zip(path,path[1:]):prefix.append(prefix[-1]+math.dist(a,b))

def nearest(c):
 p=xy(c);best=(float('inf'),0)
 for i,(a,b) in enumerate(zip(path,path[1:])):
  dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy or 1)))
  d=math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
  if d<best[0]:best=(d,prefix[i]+t*(prefix[i+1]-prefix[i]))
 return best
gates=[]
route_node_ids={a for a,b,w,d in segments}|{b for a,b,w,d in segments}
for s in signals:
 if s['id'] not in route_node_ids:continue
 dist,measure=nearest(s['coord'])
 if dist<12 and 35<measure<prefix[-1]-35:
  s.update(distance=round(dist,2),s=round(max(0,measure-5),2))
  gates.append(s)
gates.sort(key=lambda g:g['s'])
cluster=[]
for g in gates:
 if not cluster or g['s']-cluster[-1]['s']>35:cluster.append(g)

curvature=[]
for i,p in enumerate(path):
 left=path[max(0,i-6)];right=path[min(len(path)-1,i+6)]
 before=normalize([p[0]-left[0],p[1]-left[1]]);after=normalize([right[0]-p[0],right[1]-p[1]])
 angle=math.acos(max(-1,min(1,before[0]*after[0]+before[1]*after[1])))
 distance=max(1,(math.dist(left,p)+math.dist(p,right))/2)
 curvature.append(angle/distance)

# The example boarding stop is a scenario placement, not a claim that a real
# passenger platform exists at this exact position.
stop=min(prefix[-1]-80,max(500,cluster[-1]['s']+95 if cluster else 650))
network={'origin':ORIGIN,'scale':[SX,SY],'path':[[round(p[0],3),round(p[1],3)] for p in path],'pathLngLat':[ll(p) for p in path],'prefix':[round(s,3) for s in prefix],'curvature':[round(k,5) for k in curvature],'gates':cluster,'signals':signals,'crossings':crossings,'buildings':buildings,'roads':[{k:v for k,v in w.items() if k!='ids'} for w in ways],'length':prefix[-1],'stop':{'s':stop,'duration':12,'source':'scenario','name':'Điểm dừng thử nghiệm'},'stats':{'signals':len(signals),'crossings':len(crossings),'buildings':len(buildings),'roadWays':len(ways),'routeNodes':len(segments)+1,'connectorCount':connector_count,'routeRoads':list(dict.fromkeys(w['name'] for a,b,w,d in segments))},'assumptions':{'laneWidthM':3.2,'signalCycleS':80,'stopLineOffsetM':5,'connectors':'junction tangent fillets, model geometry','busLengthM':12,'busWidthM':2.55,'officialRouteConfirmed':False}}
network['assumptions'].update(busLengthM=PROFILE['vehicle']['length'],busWidthM=PROFILE['vehicle']['width'])
network['stop'].pop('duration',None) # Dwell belongs to each passenger scenario.
(OUT/'network.json').write_text(json.dumps(network,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'lengthM':round(prefix[-1]),'stats':network['stats'],'gates':cluster,'stop':network['stop'],'bytes':(OUT/'network.json').stat().st_size},ensure_ascii=False))
