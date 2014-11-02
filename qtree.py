import itertools

class SortedQuadTree(object):
    def __init__(self, get_coords, capacity, minx=0, miny=0, size=1, bisector=None):
        self.els = []
        self.children = []
        self.get_coords = get_coords
        self.bisector = bisector
        self.minx = minx
        self.miny = miny
        self.halfsize = size * 0.5
        self.capacity = capacity

    def add(self, el):
        if not self.children:
            self.els.append(el)
            if len(self.els) > self.capacity:
                self.subdivide()
                pos = self.bisector(self.children) if self.bisector else self.capacity
                for e in itertools.islice(self.els, pos, None):
                    self.add(e)
                del self.els[pos:]
        else:
            coords = self.get_coords(el)
            x = int(coords[0] - self.minx >= self.halfsize)
            y = int(coords[1] - self.miny >= self.halfsize)
            self.children[x + 2*y].add(el)

    def subdivide(self):
        for i in range(4):
            child = SortedQuadTree(self.get_coords, self.capacity,
                                   self.minx + (i % 2) * self.halfsize,
                                   self.miny + (i / 2) * self.halfsize,
                                   self.halfsize, self.bisector)
            self.children.append(child)


if __name__ == '__main__':
    def primitize(sqt):
        return {'els': sqt.els, 'children': [primitize(c) for c in sqt.children]}

    qt = SortedQuadTree(lambda x:x, 5)
    el = (0.1, 0.9)
    for repeat in range(7):
        qt.add(el)
    assert primitize(qt) == {
        'els': [el] * 5,
        'children': [
            {'els': []    , 'children': []},
            {'els': []    , 'children': []},
            {'els': [el]*2, 'children': []},
            {'els': []    , 'children': []},
        ],
    }

    qt = SortedQuadTree(lambda x:x, 3, size=10, bisector=lambda l:len(l) - 2)
    for i in range(9):
        qt.add((i, i+1))
    assert primitize(qt) == {
        'els': [(0,1), (1,2)],
        'children': [
            {'els': [(2,3), (3,4)], 'children': []},
            {'els': [], 'children': []},
            {'els': [(4,5)], 'children': []},
            {'els': [(5,6), (6,7)], 'children': [
                {'els': [], 'children': []},
                {'els': [], 'children': []},
                {'els': [(7,8)], 'children': []},
                {'els': [(8,9)], 'children': []},
            ]},
        ],
    }

    print "all tests pass"
