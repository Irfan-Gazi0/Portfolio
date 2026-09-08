"""What ground speed does each animation clip's stride actually imply?

WALK_STRIDE_SPEED and RUN_STRIDE_SPEED in xr/modules/worker.js come from here.
They are what stop the worker's feet from sliding: each clip is played at the
rate the ground is passing, so the pace has to be a real measurement of the
clip rather than a number that looked about right.

The clips carry no root motion — locomotion belongs to the site, not to the
model — so stride length is not stored anywhere. It is still measurable: the
feet are direct children of the root in this rig, so the distance a planted
foot travels backwards under the body is one step, and two steps make a cycle.

    python3 tools/measure-stride.py xr/assets/worker.glb

Run it again if the model is ever replaced, and copy the two figures across.
Like tools/trim-glb.py this is a one-off by hand; the site never runs it.
"""
import struct, json, math, sys

d = open(sys.argv[1], 'rb').read()
off, j, binoff = 12, None, None
while off < len(d):
    clen, ctype = struct.unpack('<II', d[off:off+8])
    if ctype == 0x4E4F534A: j = json.loads(d[off+8:off+8+clen].decode('utf-8'))
    else: binoff = off + 8
    off += 8 + clen

NC = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    n = NC[a['type']]
    s = binoff + bv.get('byteOffset',0) + a.get('byteOffset',0)
    return [list(struct.unpack_from('<%df'%n, d, s+k*4*n)) for k in range(a['count'])]

def mul(A,B):
    return [sum(A[r*4+k]*B[k*4+c] for k in range(4)) for r in range(4) for c in range(4)]

def trs(t,q,s):
    x,y,z,w = q
    xx,yy,zz = x*x,y*y,z*z
    m = [1-2*(yy+zz), 2*(x*y-z*w), 2*(x*z+y*w), 0,
         2*(x*y+z*w), 1-2*(xx+zz), 2*(y*z-x*w), 0,
         2*(x*z-y*w), 2*(y*z+x*w), 1-2*(xx+yy), 0,
         0,0,0,1]
    for c in range(3):
        for r in range(3): m[r*4+c] *= s[c]
    # row-major with translation in the last column
    return [m[0],m[1],m[2],t[0], m[4],m[5],m[6],t[1], m[8],m[9],m[10],t[2], 0,0,0,1]

def apply(M,p):
    return [sum(M[r*4+c]*(p[c] if c<3 else 1) for c in range(4)) for r in range(3)]

parent = {}
for i,n in enumerate(j['nodes']):
    for c in n.get('children',[]): parent[c] = i

# The three joints the measurement is taken from, by name rather than by index.
# On this rig they happen to be nodes 73, 77 and 10, but a replacement model
# would renumber them silently and the answer would still look plausible.
by_name = {n.get('name'): i for i,n in enumerate(j['nodes'])}
try:
    LEFT_FOOT, RIGHT_FOOT, TOP_OF_HEAD = by_name['Foot.L'], by_name['Foot.R'], by_name['Head_end']
except KeyError as e:
    raise SystemExit(f'{sys.argv[1]}: no joint named {e}. Name the feet and the '
                     'crown of the head here for the new rig.')

def chain(i):
    out = []
    while i is not None:
        out.append(i); i = parent.get(i)
    return list(reversed(out))

def sample(track, t):
    times, vals = track
    if t <= times[0]: return vals[0]
    if t >= times[-1]: return vals[-1]
    for k in range(len(times)-1):
        if times[k] <= t <= times[k+1]:
            f = (t-times[k]) / max(1e-9, times[k+1]-times[k])
            a, b = vals[k], vals[k+1]
            v = [a[i] + (b[i]-a[i])*f for i in range(len(a))]
            if len(v) == 4:
                n = math.sqrt(sum(c*c for c in v)) or 1
                v = [c/n for c in v]
            return v
    return vals[-1]

for anim in j['animations']:
    name = anim['name'].split('|')[-1]
    if name not in ('Walk','Run'): continue
    tracks = {}
    dur = 0
    for ch in anim['channels']:
        s = anim['samplers'][ch['sampler']]
        times = [v[0] for v in acc(s['input'])]
        tracks.setdefault(ch['target']['node'], {})[ch['target']['path']] = (times, acc(s['output']))
        dur = max(dur, times[-1])

    def world(node, t):
        M = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
        for i in chain(node):
            n = j['nodes'][i]
            tr = tracks.get(i, {})
            T = sample(tr['translation'], t) if 'translation' in tr else n.get('translation',[0,0,0])
            Q = sample(tr['rotation'], t) if 'rotation' in tr else n.get('rotation',[0,0,0,1])
            S = sample(tr['scale'], t) if 'scale' in tr else n.get('scale',[1,1,1])
            M = mul(M, trs(T,Q,S))
        return apply(M, [0,0,0])

    N = 120
    LF = [world(LEFT_FOOT, dur*k/N) for k in range(N+1)]
    RF = [world(RIGHT_FOOT, dur*k/N) for k in range(N+1)]
    head = [world(TOP_OF_HEAD, dur*k/N) for k in range(N+1)]

    fz = [p[2] for p in LF]                      # forward is +Z in world
    step = max(fz) - min(fz)
    floor = min(min(p[1] for p in LF), min(p[1] for p in RF))
    height = max(p[1] for p in head) - floor
    per_cycle = step * 2                          # two steps to a cycle
    print(f'{name:5s} dur {dur:.3f}s  step {step:.3f}  cycle {per_cycle:.3f}  '
          f'height {height:.3f}  -> {per_cycle/dur:.3f} u/s '
          f'= {(per_cycle/dur) * (1.78/height):.3f} m/s at 1.78 m tall')
