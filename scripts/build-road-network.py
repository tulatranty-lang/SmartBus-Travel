"""Export road-following geometry independently of sparse source GPS anchors.

The public OSRM driving profile supplies OSM road geometry, not a verified bus
route or measured bus travel time. Both directions are requested separately.
Cached responses make the published artifact reproducible without network.
"""
import argparse
import concurrent.futures
import hashlib
import json
import math
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.artifacts/road-network'
SOURCE = ROOT / 'backend-api/data/import/smartbus-bus-data.normalized.json'
TARGET = ROOT / 'web/public/data/road-network.json'
CHECKED = '2026-11-11'
HEADERS = {'User-Agent': 'SmartBus-Road-Geometry/1.0 (https://github.com/tulatranty-lang/SmartBus-Travel)'}
lock = threading.Lock()
last_request = 0


def distance(a, b):
    k = math.pi / 180
    h = math.sin((b[1]-a[1])*k/2)**2 + math.cos(a[1]*k)*math.cos(b[1]*k)*math.sin((b[0]-a[0])*k/2)**2
    return 12742000 * math.atan2(math.sqrt(h), math.sqrt(max(0, 1-h)))


def point_on_named_road(name, reference, elements, desired=None):
    sx = 111195 * math.cos(math.radians(reference[1])); sy = 111195
    best = (float('inf'), reference)
    for way in elements:
        if way.get('tags', {}).get('name', '').replace('Đường ', '') != name:
            continue
        coords = [[p['lon'], p['lat']] for p in way['geometry']]
        for a, b in zip(coords, coords[1:]):
            dx, dy = (b[0]-a[0])*sx, (b[1]-a[1])*sy
            if desired and way.get('tags',{}).get('oneway') in ['yes','1','true','-1']:
                sign=-1 if way['tags'].get('oneway')=='-1' else 1
                alignment=(dx*desired[0]+dy*desired[1])*sign/(math.hypot(dx,dy)*math.hypot(*desired) or 1)
                if alignment<.15:continue
            t = max(0, min(1, (((reference[0]-a[0])*sx)*dx+((reference[1]-a[1])*sy)*dy)/(dx*dx+dy*dy or 1)))
            q = [a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])]
            d = distance(q, reference)
            if d < best[0]: best = (d, q)
    if best[0] == float('inf'): raise ValueError('Missing named road: ' + name)
    return [round(x, 7) for x in best[1]]


def route_points(route, elements, direction='outbound'):
    source = [[lng, lat] for lat, lng in route['path']]
    if route['routeCode'] != 'DN-06': return source if direction=='outbound' else list(reversed(source))
    # Named corridor controls replace two misplaced landmark coordinates.
    # No source coordinates are changed. The precise internal FPT loop remains
    # unverified; use the public named-road approach rather than inventing it.
    controls = [
        ('Nguyễn Văn Linh', [108.216, 16.0605]),
        ('Cầu Rồng', [108.2277, 16.0613]),
        ('Võ Văn Kiệt', [108.2392, 16.06235]),
        ('Võ Nguyên Giáp', [108.2470, 16.0623]),
        ('Trường Sa', [108.264, 16.008]),
        ('Võ Quý Huân', [108.2703, 15.9857]),
        ('Hoàng Minh Thắng', [108.2625, 15.9827]),
        ('Trần Quốc Vượng', [108.26395, 15.97799]),
        ('Nam Kỳ Khởi Nghĩa', [108.2604, 15.9779]),
        ('Trần Đại Nghĩa', [108.2548, 15.97675]),
    ]
    sequence=[(None,source[0])]+controls+[(None,source[-1])]
    if direction=='inbound':sequence.reverse()
    points=[]
    for i,(name,p) in enumerate(sequence):
        if not name:points.append(p);continue
        before=sequence[i-1][1];after=sequence[i+1][1]
        desired=[(after[0]-before[0])*math.cos(math.radians(p[1])),after[1]-before[1]]
        points.append(point_on_named_road(name,p,elements,desired))
    return points


def fetch_route(route_id, direction, points, offline):
    global last_request
    coordinates = ';'.join(','.join(str(round(x, 7)) for x in p) for p in points)
    url = 'https://router.project-osrm.org/route/v1/driving/' + coordinates + '?overview=full&geometries=geojson&steps=false&continue_straight=true&annotations=false'
    key = hashlib.sha256(url.encode()).hexdigest()[:16]
    file = CACHE / (route_id+'-'+direction+'-'+key+'.json')
    if file.exists(): return json.loads(file.read_text(encoding='utf-8'))
    if offline: raise RuntimeError('Missing cache ' + file.name)
    for attempt in range(3):
        with lock:
            time.sleep(max(0, 1.05-(time.monotonic()-last_request)))
            last_request = time.monotonic()
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.load(response)
            if data.get('code') != 'Ok': raise RuntimeError(str(data.get('code')))
            file.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            return data
        except (urllib.error.URLError, TimeoutError, RuntimeError):
            if attempt == 2: raise
            time.sleep(2+attempt*3)


def project_anchors(coords, prefix, anchors):
    result = []; floor = 0
    sx = 111195 * math.cos(math.radians(coords[0][1])); sy = 111195
    for anchor in anchors:
        p = [anchor['lng'], anchor['lat']]; best = (float('inf'), floor, prefix[floor])
        for i in range(floor, len(coords)-1):
            a, b = coords[i:i+2]; dx, dy = (b[0]-a[0])*sx, (b[1]-a[1])*sy
            t = max(0, min(1, ((p[0]-a[0])*sx*dx+(p[1]-a[1])*sy*dy)/(dx*dx+dy*dy or 1)))
            q = [a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])]
            d = distance(p, q)
            if d < best[0]: best = (d, i, prefix[i]+t*(prefix[i+1]-prefix[i]))
        floor = best[1]
        result.append({'name': anchor['stopName'], 's': round(best[2], 2), 'distanceM': round(best[0], 1), 'sourceCoordinate': p, 'isVerifiedStop': False})
    return result


def direction_data(data, anchors):
    route = data['routes'][0]
    coords = [[round(x, 6) for x in p] for p in route['geometry']['coordinates']]
    coords = [p for i, p in enumerate(coords) if i == 0 or p != coords[i-1]]
    prefix = [0.0]
    for a, b in zip(coords, coords[1:]): prefix.append(prefix[-1]+distance(a, b))
    return {'coordinates': coords, 'distanceM': round(prefix[-1], 2), 'durationS': route['duration'],
            'anchors': project_anchors(coords, prefix, anchors), 'routingDistanceM': route['distance'],
            'maxSourceSnapM': round(max((w['distance'] for w in data.get('waypoints', [])), default=0), 1)}


def service_data(route):
    times = [(int(h)*60+int(m)) for h, m in re.findall(r'(\d{1,2}):(\d{2})', route.get('operatingTime', ''))]
    first, last = (min(times), max(times)) if times else (330, 1080)
    interval = route.get('intervalText', '')
    numbers = [int(n) for n in re.findall(r'\d+', interval)]
    if 'giờ' in interval: numbers = [n*60 for n in numbers]
    if 'chuyến/chiều/ngày' in interval: headway = max(30, round((last-first)/max(1, numbers[0]-1))) if numbers else 120
    else: headway = round(sum(numbers[:2])/len(numbers[:2])) if numbers else 45
    historical = '-old' in route['routeCode'] or '-tour' in route['routeCode'] or route['routeCode'] == 'DN-02'
    result = {'firstMinute': first, 'lastMinute': last, 'headwayMinutes': max(5, headway), 'fleetSize': max(1, route.get('vehicleCount', 2)),
              'source': 'source-estimate', 'historical': historical, 'operatingTime': route.get('operatingTime', ''),
              'intervalText': interval, 'avgSpeedKmh': route.get('avgSpeedKmh', 25), 'publishedDistanceKm': route.get('distanceKm')}
    if route['routeCode'] == 'DN-06': result.update(firstMinute=330, lastMinute=1165, headwayMinutes=45, fleetSize=5,
        firstByTerminal=[345,330], lastByTerminal=[1165,1140], source='published', operatingTime='Sân bay 05:45–19:25; Việt Hàn 05:30–19:00',
        intervalText='30–60 phút/chuyến', publishedDistanceKm=21.3, sourceUrl='https://www.danangbus.vn/lo-trinh-tuyen.html')
    return result


def build(offline=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    elements = json.loads((ROOT/'.artifacts/map-preview-osm.json').read_text(encoding='utf-8'))['elements']
    inputs = {(r['routeCode'],direction): route_points(r,elements,direction) for r in source['routes'] for direction in ['outbound','inbound']}
    jobs = {}; results = {}; errors = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for route in source['routes']:
            id = route['routeCode']
            for direction in ['outbound','inbound']:
                pts=inputs[id,direction]
                jobs[pool.submit(fetch_route, id, direction, pts, offline)] = (id, direction)
        for future in concurrent.futures.as_completed(jobs):
            id, direction = jobs[future]
            try: results[id, direction] = future.result()
            except Exception as exc: errors[id, direction] = str(exc)
            print(id, direction, 'OK' if (id, direction) in results else 'FAILED', flush=True)
    routes = []
    for r in source['routes']:
        id = r['routeCode']; anchors = sorted([s for s in source['routeStops'] if s['routeCode']==id], key=lambda s:s['sequenceNo'])
        if (id,'outbound') not in results or (id,'inbound') not in results: continue
        directions = {key: direction_data(results[id,key], anchors if key=='outbound' else list(reversed(anchors))) for key in ['outbound','inbound']}
        warnings = ['Hình học OSM theo hồ sơ xe cơ giới OSRM; chưa xác nhận quyền đi của xe buýt hoặc từng làn.']
        review = False
        ratio = directions['outbound']['distanceM']/(r.get('distanceKm',1)*1000)
        if ratio > 1.65 or ratio < .45:
            review = True; warnings.append('Cự ly dựng đường khác đáng kể cự ly nguồn; cần kiểm tra hành lang tuyến.')
        if max(v['maxSourceSnapM'] for v in directions.values())>250:
            review = True; warnings.append('Có điểm nguồn cách đường được ghép trên 250 m.')
        if id == 'DN-06': warnings.append('Mốc Võ Văn Kiệt/Võ Nguyên Giáp được thay bằng điểm khống chế trên đúng tên đường. Vòng đường nội bộ FPT chưa được xác nhận chi tiết.')
        entry = {'id': id, 'displayCode': r.get('displayCode', id), 'name': r['name'], 'provinceCode': r['provinceCode'],
            **directions, 'geometryStatus': 'review' if review else 'road-routed', 'warnings': warnings, 'service': service_data(r),
            'sourceAnchorCount': len(anchors), 'sourceCoordinateOrder': 'lng,lat', 'corridorCorrection': id=='DN-06'}
        routes.append(entry)
    data = {'version':'road-network-2026-11-11-v2', 'checkedAt':CHECKED, 'coordinateOrder':'longitude,latitude',
            'source':{'routing':'https://project-osrm.org/docs/v5.24.0/api/','geometry':'https://www.openstreetmap.org/copyright','license':'ODbL 1.0',
                      'profile':'OSRM driving, not bus access or observed travel time','sourceFiles':['smartbus-bus-data.normalized.json']},
            'routes':routes, 'unavailableRoutes':[{'id':id,'direction':direction,'reason':reason} for (id,direction),reason in errors.items()]}
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8',newline='\n')
    report = {'routes':len(routes),'directions':len(routes)*2,'vertices':sum(len(r[d]['coordinates']) for r in routes for d in ['outbound','inbound']),
        'reviewRoutes':[r['id'] for r in routes if r['geometryStatus']=='review'],'failedDirections':len(errors),'bytes':TARGET.stat().st_size}
    (CACHE/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False),flush=True)
    if not routes: raise RuntimeError('No road geometry was generated')


if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');args=parser.parse_args();build(args.offline)
