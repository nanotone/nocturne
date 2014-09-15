import json
import sys

cat = []
for line in open('hygxyz.csv'):
    fields = line.strip().split(',')
    try:
        mag = float(fields[13])
        if -25 < mag < 4.5:
            name = fields[6] or fields[5] or fields[4] or ('HIP ' + fields[1])
            rasc, decl, dist = map(float, fields[7:10])
            cat.append([name, mag, rasc, decl, dist])
    except Exception:
        pass
json.dump({'catalog': cat}, sys.stdout)
