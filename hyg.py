import json
import math
import sys

cat = {}
for line in open('hygxyz.csv'):
    fields = line.strip().split(',')
    try:
        mag = float(fields[13])
        if -25 < mag < 8.5:
            name = fields[6] or fields[5] or fields[4] or ('HIP ' + fields[1])
            rasc, decl, dist, color = map(float, fields[7:10] + [fields[16]])
            rasc *= math.pi / 12
            decl *= math.pi / 180
            x = math.cos(decl) * -math.sin(rasc)
            y = math.sin(decl)
            z = math.cos(decl) * -math.cos(rasc)
            if abs(x) > max(abs(y), abs(z)):
                key = 'x%d' % int(x > 0)
            elif abs(y) > max(abs(x), abs(z)):
                key = 'y%d' % int(y > 0)
            else:
                key = 'z%d' % int(z > 0)
            mag_bucket = max(round(mag * 2) / 2, 0.001)  # round to nearest half, and prevent -0.0
            key = '%s-%.1f' % (key, mag_bucket)
            if key not in cat:
                cat[key] = []
            cat[key].append([name, mag, x, y, z, dist, color])
    except Exception:
        pass
json.dump(cat, sys.stdout)
