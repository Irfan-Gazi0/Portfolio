#!/usr/bin/env python3
"""Drop unused animation clips from a GLB, and everything they alone referenced.

Run once, by hand, and commit the output. This is not a build step: the site
never runs it, and `xr/assets/worker.glb` is a committed file like any image.

The source model ships 24 clips; the site plays five. The other nineteen are
about a third of the file — every one of them 62 joints' worth of keyframes for
a swordfight the site office is not going to have.

    python3 tools/trim-glb.py \
        "xr/Assets/Worker by Quaternius.glb" xr/assets/worker.glb \
        Idle Walk Run Wave Interact

Only glTF 2.0 binary in, glTF 2.0 binary out. Accessors are kept if a mesh, a
skin, or a surviving animation still names them; everything else goes, and the
binary chunk is rebuilt from the survivors.
"""

import json
import struct
import sys

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, length = struct.unpack('<III', data[:12])
    if magic != 0x46546C67:
        raise SystemExit(f'{path}: not a GLB')
    if version != 2:
        raise SystemExit(f'{path}: glTF {version}, expected 2')
    if length != len(data):
        raise SystemExit(f'{path}: header says {length} bytes, file is {len(data)}')

    gltf, binary, off = None, b'', 12
    while off < len(data):
        clen, ctype = struct.unpack('<II', data[off:off + 8])
        body = data[off + 8:off + 8 + clen]
        if ctype == JSON_CHUNK:
            gltf = json.loads(body.decode('utf-8'))
        elif ctype == BIN_CHUNK:
            binary = body
        off += 8 + clen

    if gltf is None:
        raise SystemExit(f'{path}: no JSON chunk')
    return gltf, binary


def write_glb(path, gltf, binary):
    # Both chunks are padded to four bytes — JSON with spaces, BIN with zeros,
    # which is what the spec asks for and what strict loaders check.
    js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    binary += b'\x00' * (-len(binary) % 4)

    total = 12 + 8 + len(js) + (8 + len(binary) if binary else 0)
    out = bytearray()
    out += struct.pack('<III', 0x46546C67, 2, total)
    out += struct.pack('<II', len(js), JSON_CHUNK) + js
    if binary:
        out += struct.pack('<II', len(binary), BIN_CHUNK) + binary
    open(path, 'wb').write(bytes(out))
    return total


def trim(gltf, binary, keep_names):
    animations = gltf.get('animations', [])
    # Clip names arrive as "CharacterArmature|Walk"; match the part that names
    # the action, so the armature can be renamed without breaking this.
    kept_anims = [a for a in animations
                  if a.get('name', '').rsplit('|', 1)[-1] in keep_names]

    found = {a.get('name', '').rsplit('|', 1)[-1] for a in kept_anims}
    missing = set(keep_names) - found
    if missing:
        raise SystemExit('no such clip: ' + ', '.join(sorted(missing)))

    # Everything still pointing at an accessor. Meshes and skins always survive;
    # only the animation list shrinks.
    live = set()
    for mesh in gltf.get('meshes', []):
        for prim in mesh.get('primitives', []):
            live.update(prim.get('attributes', {}).values())
            if 'indices' in prim:
                live.add(prim['indices'])
            for target in prim.get('targets', []):
                live.update(target.values())
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            live.add(skin['inverseBindMatrices'])
    for anim in kept_anims:
        for s in anim['samplers']:
            live.add(s['input'])
            live.add(s['output'])

    accessors = gltf['accessors']
    views = gltf['bufferViews']
    order = sorted(live)
    remap = {old: new for new, old in enumerate(order)}

    new_binary = bytearray()
    new_views = []
    new_accessors = []
    for old in order:
        acc = dict(accessors[old])
        if 'sparse' in acc:
            raise SystemExit(f'accessor {old} is sparse; this script cannot repack it')
        if 'bufferView' in acc:
            bv = views[acc['bufferView']]
            start = bv.get('byteOffset', 0)
            chunk = binary[start:start + bv['byteLength']]
            # Accessor byteOffsets are relative to the view, so copying the view
            # whole keeps every one of them valid without touching the accessor.
            new_binary += b'\x00' * (-len(new_binary) % 4)
            view = {'buffer': 0, 'byteOffset': len(new_binary), 'byteLength': len(chunk)}
            for key in ('byteStride', 'target'):
                if key in bv:
                    view[key] = bv[key]
            new_binary += chunk
            acc['bufferView'] = len(new_views)
            new_views.append(view)
        new_accessors.append(acc)

    for mesh in gltf.get('meshes', []):
        for prim in mesh.get('primitives', []):
            prim['attributes'] = {k: remap[v] for k, v in prim['attributes'].items()}
            if 'indices' in prim:
                prim['indices'] = remap[prim['indices']]
            for target in prim.get('targets', []):
                for k in list(target):
                    target[k] = remap[target[k]]
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = remap[skin['inverseBindMatrices']]
    for anim in kept_anims:
        for s in anim['samplers']:
            s['input'] = remap[s['input']]
            s['output'] = remap[s['output']]

    gltf['accessors'] = new_accessors
    gltf['bufferViews'] = new_views
    gltf['animations'] = kept_anims
    gltf['buffers'] = [{'byteLength': len(new_binary)}]
    return gltf, bytes(new_binary), len(animations)


def verify(path, expect_clips, expect_meshes, expect_skins, expect_nodes):
    """Re-read what was written and check it hangs together."""
    gltf, binary = read_glb(path)

    names = sorted(a.get('name', '').rsplit('|', 1)[-1] for a in gltf['animations'])
    assert names == sorted(expect_clips), f'clips: {names}'
    assert len(gltf['meshes']) == expect_meshes, 'mesh count changed'
    assert len(gltf['skins']) == expect_skins, 'skin count changed'
    assert len(gltf['nodes']) == expect_nodes, 'node count changed'
    assert gltf['buffers'][0]['byteLength'] <= len(binary), 'buffer overruns the BIN chunk'

    n_acc, n_views = len(gltf['accessors']), len(gltf['bufferViews'])
    for acc in gltf['accessors']:
        # An accessor without a view is zero-filled and owns no bytes — legal,
        # and what trim() itself already allows for.
        if 'bufferView' not in acc:
            continue
        bv = gltf['bufferViews'][acc['bufferView']]
        assert bv['byteOffset'] + bv['byteLength'] <= len(binary), 'view overruns the BIN chunk'

    def ok(i):
        assert 0 <= i < n_acc, f'accessor index {i} out of range'

    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            for i in prim['attributes'].values():
                ok(i)
            if 'indices' in prim:
                ok(prim['indices'])
    for skin in gltf['skins']:
        ok(skin['inverseBindMatrices'])
    n_nodes = len(gltf['nodes'])
    for anim in gltf['animations']:
        for s in anim['samplers']:
            ok(s['input'])
            ok(s['output'])
        for ch in anim['channels']:
            assert 0 <= ch['sampler'] < len(anim['samplers']), 'bad sampler index'
            assert 0 <= ch['target']['node'] < n_nodes, 'bad channel target'
    return n_acc, n_views


def main(argv):
    if len(argv) < 4:
        raise SystemExit(__doc__)
    src, dst, keep = argv[1], argv[2], set(argv[3:])

    gltf, binary = read_glb(src)
    before = len(open(src, 'rb').read())
    meshes, skins, nodes = len(gltf['meshes']), len(gltf['skins']), len(gltf['nodes'])
    acc_before, view_before = len(gltf['accessors']), len(gltf['bufferViews'])

    gltf, new_binary, anim_before = trim(gltf, binary, keep)
    after = write_glb(dst, gltf, new_binary)
    acc_after, view_after = verify(dst, keep, meshes, skins, nodes)

    print(f'{src} -> {dst}')
    print(f'  clips      {anim_before:>7} -> {len(gltf["animations"]):>7}   '
          + ', '.join(sorted(keep)))
    print(f'  accessors  {acc_before:>7} -> {acc_after:>7}')
    print(f'  views      {view_before:>7} -> {view_after:>7}')
    print(f'  bytes      {before:>7} -> {after:>7}   '
          f'({100 * (before - after) / before:.0f}% smaller)')


if __name__ == '__main__':
    main(sys.argv)
