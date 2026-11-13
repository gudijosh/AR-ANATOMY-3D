# Exports the nerves, the ligaments/tendons and a few reference bones of Z-Anatomy as plain triangles in world space.
import bpy, json, re, struct
OUT = '/private/tmp/zanatomy/out/'
dg = bpy.context.evaluated_depsgraph_get()
def cols(o): return [c.name for c in o.users_collection]
def kind(o):
    n = o.name; c = cols(o)
    if n.endswith(('.j', '.g', '.i')) or o.type not in ('MESH', 'CURVE'): return None
    if '1: Skeletal system' in c and o.type == 'MESH' and (re.match(r'^(Femur|Humerus|Tibia|Radius|Calcaneus|Clavicle|Scapula|Hip bone|Ulna|Fibula|Talus|Patella|First metatarsal bone|Fifth metatarsal bone|Temporal bone|Parietal bone|Maxilla)\.[lr]$', n) or re.match(r'^Vertebra [CTL]\d+$', n) or n in ('Mandible', 'Atlas (C1)', 'Body of sternum', 'Frontal bone', 'Occipital bone')): return 'ref'
    if '7: Nervous system & Sense organs' in c:
        if o.type == 'CURVE': return 'nerves'
        if re.search(r'spinal cord|Cauda equina|Spinal ganglion|filum', n, re.I): return 'nerves'
        return None
    if '3: Joints' in c: return 'tendons'
    if re.search(r'tendon|aponeurosis|retinaculum|iliotibial|linea alba|rectus sheath|fascia lata|thoracolumbar', n, re.I) and not re.search(r'sheath of|tendon sheath|bursa', n, re.I) and ('4: Muscular system' in c or '2: Muscular insertions' in c): return 'tendons'
    return None
index = []; blob = bytearray(); stats = {}
for o in bpy.data.objects:
    k = kind(o)
    if not k: continue
    e = o.evaluated_get(dg)
    try: me = e.to_mesh()
    except Exception as ex: stats.setdefault('fail', []).append(o.name); continue
    if me is None or len(me.polygons) == 0:
        stats.setdefault('nopoly_' + k, []).append([o.name, o.type, getattr(o.data, 'bevel_depth', None) if o.type == 'CURVE' else None]); e.to_mesh_clear(); continue
    me.calc_loop_triangles()
    M = e.matrix_world
    pos = []
    for v in me.vertices:
        w = M @ v.co; pos += [w.x, w.y, w.z]
    idx = []
    for t in me.loop_triangles: idx += list(t.vertices)
    index.append({"name": o.name, "kind": k, "type": o.type, "nv": len(pos) // 3, "ni": len(idx), "off": len(blob), "hidden": o.hide_viewport or o.hide_get() if hasattr(o, 'hide_get') else False})
    blob += struct.pack('<%df' % len(pos), *pos) + struct.pack('<%dI' % len(idx), *idx)
    e.to_mesh_clear()
open(OUT + 'export.bin', 'wb').write(blob)
json.dump({"index": index, "stats": stats}, open(OUT + 'export.json', 'w'))
print("EXPORTED", len(index), len(blob))
