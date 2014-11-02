import collections
import math

import qtree

Vec3 = collections.namedtuple('Vec3', 'x y z'.split())
Star = collections.namedtuple('Star', 'name mag x y z dist color coords'.split())

def parse_csvline(csvline):
    fields = csvline.strip().split(',')
    name = fields[6] or fields[5] or fields[4] or ('HIP ' + fields[1])
    (rasc, decl, dist, mag, color) = [float(fields[i]) for i in (7, 8, 9, 13, 16)]
    rasc *= math.pi / 12
    decl *= math.pi / 180
    pos = Vec3(x = math.cos(decl) * -math.sin(rasc),
               y = math.sin(decl),
               z = math.cos(decl) * -math.cos(rasc) )
    for abc in ('xyz', 'yzx', 'zyx'):
        (a, b, c) = [getattr(pos, e) for e in abc]
        absa = abs(a)
        if absa >= max(abs(b), abs(c)):
            face = '%s%d' % (abc[0], int(a > 0))
            coords = [(e/absa + 1)/2 for e in (b, c)]
            break
    return (Star(name, mag, pos.x, pos.y, pos.z, dist, color, coords), face)


stars_by_face = collections.defaultdict(list)
print "processing csv"
for line in open('hygxyz.csv'):
    try:
        (star, face) = parse_csvline(line)
        if star.mag > -25:  # ignore the sun
            stars_by_face[face].append(star)
    except Exception:
        continue

import bisect
def bisector(starlist):
    # given an (overflowing) star list, return idx of first/brightest star that needs re-adding
    brightest_mag = int(starlist[-1][0] * 2) / 2.0
    return bisect.bisect_left(starlist, (brightest_mag, 0))

import json
import re
def dump_cats(qt, face):
    if qt.els:
        # filename includes node's location, size, and brightest magnitude
        path = 'cat_%s_%f_%f_%f_%f.json' % (face, qt.minx, qt.miny, qt.halfsize*2, qt.els[0][0])
        path = re.sub(r'(\d\.\d+?)0+', r'\1', path)
        with open(path, 'w') as fp:
            json.dump({'stars': [tuple(s[1])[:-1] for s in qt.els]}, fp)
    for c in qt.children:
        dump_cats(c, face)

for (face, stars) in stars_by_face.items():
    print "organizing stars for face", face
    stars.sort(key=lambda s: s.mag)

    # 3k stars per qtree node gives a nice spread (21 nodes per face)
    qt = qtree.SortedQuadTree(lambda (m, s): s.coords, 3000, bisector=bisector)
    for s in stars:
        qt.add((s.mag, s))
    dump_cats(qt, face)
