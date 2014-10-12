import json
import math
import sys

cat = []
for line in open('hygxyz.csv'):
    fields = line.strip().split(',')
    try:
        mag = float(fields[13])
        if -25 < mag < 4.5:
            name = fields[6] or fields[5] or fields[4] or ('HIP ' + fields[1])
            rasc, decl, dist, color = map(float, fields[7:10] + [fields[16]])
            rasc *= math.pi / 12
            decl *= math.pi / 180
            x = math.cos(decl) * -math.sin(rasc)
            y = math.sin(decl)
            z = math.cos(decl) * -math.cos(rasc)
            cat.append([name, mag, x, y, z, dist, color])
    except Exception:
        pass
json.dump({'catalog': cat}, sys.stdout)
