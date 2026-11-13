# Lists the arteries and veins of BodyParts3D (the "is a" set) and unpacks their OBJ files.
import zipfile, collections, json, os
B='/private/tmp/bp3d'
rows=[l.rstrip('\n').split('\t') for l in open(B+'/dl/isa_element_parts.txt')][1:]
by=collections.defaultdict(list)
for cid,name,el in rows:
    if el not in by[name]: by[name].append(el)
art=sorted({e for c,n,e in rows if 'arter' in n.lower() or 'aort' in n.lower()})
vein=sorted({e for c,n,e in rows if any(w in n.lower() for w in ('vein','vena','venous'))})
both=set(art)&set(vein); assert not both, both
LAB={"arteries":["arch of aorta","abdominal aorta","common carotid artery","subclavian artery","brachial artery","radial artery","ulnar artery",
  "common iliac artery","femoral artery","popliteal artery","anterior tibial artery","posterior tibial artery","renal artery","pulmonary trunk","coronary artery"],
 "veins":["superior vena cava","inferior vena cava","internal jugular vein","subclavian vein","brachiocephalic vein","cephalic vein","basilic vein",
  "femoral vein","great saphenous vein","popliteal vein","hepatic portal vein","renal vein"]}
out={"arteries":{"elements":art,"labels":[]},"veins":{"elements":vein,"labels":[]}}
for layer,names in LAB.items():
    S=set(out[layer]["elements"])
    for n in names:
        found=False
        for side in ("right ","left "):
            els=[e for e in by.get(side+n,[]) if e in S]
            if els: out[layer]["labels"].append({"t":n[0].upper()+n[1:],"elements":els}); found=True
        if not found:
            els=[e for e in by.get(n,[]) if e in S]
            if els: out[layer]["labels"].append({"t":n[0].upper()+n[1:],"elements":els}); found=True
        if not found: print("no label for",n)
# (the dataset's spinal cord is only a 4 cm piece in the neck, so it is left out)
zi=zipfile.ZipFile(B+'/dl/isa.zip'); zp=zipfile.ZipFile(B+'/dl/partof.zip')
ni=set(zi.namelist()); np_=set(zp.namelist()); miss=0
for layer in out:
    for e in out[layer]["elements"]:
        dst=B+'/vessels/%s.obj'%e
        if os.path.exists(dst): continue
        a='isa_BP3D_4.0_obj_99/%s.obj'%e; b='partof_BP3D_4.0_obj_99/%s.obj'%e
        if a in ni: open(dst,'wb').write(zi.read(a))
        elif b in np_: open(dst,'wb').write(zp.read(b))
        else: miss+=1
json.dump(out,open(B+'/vessels/vessels.json','w'))
print({k:(len(v["elements"]),len(v["labels"])) for k,v in out.items()},"missing",miss)
