# Registers Z-Anatomy reference bones onto the same bones of BodyParts3D (cm, +x left, +y up, +z front): one similarity per bone.
import json, zipfile, collections, numpy as np
Z='/private/tmp/zanatomy/out/'; d=json.load(open(Z+'export.json')); blob=open(Z+'export.bin','rb').read()
AX=np.array([[100,0,0],[0,0,100],[0,-100,0.]])   # metres, z up, -y front -> cm, y up, z front
def zmesh(o): return np.frombuffer(blob,'<f4',o['nv']*3,o['off']).reshape(-1,3).astype(float)@AX.T
rows=[l.rstrip('\n').split('\t') for l in open('/private/tmp/bp3d/dl/partof_element_parts.txt')][1:]
by=collections.defaultdict(list)
for c,n,e in rows: by[n].append(e)
zp=zipfile.ZipFile('/private/tmp/bp3d/dl/partof.zip')
def bp(concept):
    P=[]
    for e in by.get(concept,[]):
        for line in zp.read('partof_BP3D_4.0_obj_99/%s.obj'%e).decode().split('\n'):
            if line.startswith('v '):
                a=line.split(); P.append((float(a[1])*.1,float(a[3])*.1,-float(a[2])*.1))
    return np.array(P) if P else None
def sub(P,n,seed=1):
    if len(P)<=n: return P
    return P[np.random.RandomState(seed).choice(len(P),n,replace=False)]
def umeyama(A,B):
    ma,mb=A.mean(0),B.mean(0); A0,B0=A-ma,B-mb
    U,S,Vt=np.linalg.svd(B0.T@A0/len(A)); D=np.eye(3)
    if np.linalg.det(U@Vt)<0: D[2,2]=-1
    R=U@D@Vt; s=np.trace(np.diag(S)@D)/(A0**2).sum()*len(A)
    return s,R,mb-s*R@ma
def icp(src,dst):
    A=sub(src,700); B=sub(dst,3500)
    s,R,t=1.0,np.eye(3),(B.min(0)+B.max(0))/2-(A.min(0)+A.max(0))/2
    for it in range(40):
        P=s*A@R.T+t
        d2=((P[:,None,:]-B[None,:,:])**2).sum(2); j=d2.argmin(1); e=np.sqrt(d2[np.arange(len(A)),j])
        keep=e<=np.percentile(e,90)
        s,R,t=umeyama(A[keep],B[j[keep]])
    return s,R,t,float(np.sqrt(d2.min(1)).mean())
MAP={'Femur':'femur','Humerus':'humerus','Tibia':'tibia','Radius':'radius','Ulna':'ulna','Fibula':'fibula','Clavicle':'clavicle','Scapula':'scapula','Hip bone':'hip bone',
     'Calcaneus':'calcaneus','Talus':'talus','Patella':'patella','First metatarsal bone':'first metatarsal bone','Fifth metatarsal bone':'fifth metatarsal bone',
     'Temporal bone':'temporal bone','Parietal bone':'parietal bone','Maxilla':'maxilla'}
ORD=['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth']
import re
refs=[]
for o in d['index']:
    if o['kind']!='ref': continue
    n=o['name']; m=re.match(r'^Vertebra ([CTL])(\d+)$',n)
    if n[-2:] in('.l','.r') and n[:-2] in MAP: c=('left ' if n[-1]=='l' else 'right ')+MAP[n[:-2]]
    elif m: c=ORD[int(m.group(2))]+' '+{'C':'cervical','T':'thoracic','L':'lumbar'}[m.group(1)]+' vertebra'
    else: c={'Mandible':'mandible','Atlas (C1)':'atlas','Frontal bone':'frontal bone','Occipital bone':'occipital bone','Body of sternum':'body of sternum'}.get(n)
    b=bp(c) if c else None
    if b is None: print('no BP3D for',n,c); continue
    src=zmesh(o); s,R,t,err=icp(src,b)
    if err>0.6 or not 0.9<s<1.1: print('skipped %-22s scale %.3f err %.2f'%(n,s,err)); continue
    refs.append({"name":n,"s":s,"R":R,"t":t,"pts":sub(src,60,3)})
print('reference bones',len(refs),'mean scale %.3f'%np.mean([r['s'] for r in refs]))
BP=np.concatenate([r['pts'] for r in refs]).reshape(len(refs),60,3)
def warp(P):
    out=np.empty_like(P)
    for a in range(0,len(P),4000):
        Q=P[a:a+4000]
        d=np.sqrt(((Q[:,None,None,:]-BP[None])**2).sum(3)).min(2)      # distance to each bone
        w=1/(d+0.5)**4; w/=w.sum(1,keepdims=True)
        acc=np.zeros_like(Q)
        for i,r in enumerate(refs):
            wi=w[:,i]; m=wi>1e-4
            if m.any(): acc[m]+=wi[m,None]*(r['s']*Q[m]@r['R'].T+r['t'])
        out[a:a+4000]=acc/np.maximum(1e-9,(w*(w>1e-4)).sum(1,keepdims=True))
    return out
import os
OUTD='/private/tmp/zanatomy/obj/'; os.makedirs(OUTD,exist_ok=True)
LAB={"nerves":["Sciatic nerve","Median nerve","Ulnar nerve","Radial nerve","Femoral nerve","Tibial nerve","Common fibular nerve","Vagus nerve (X)","Axillary nerve",
  "Musculocutaneous nerve","Obturator nerve","Intercostal nerves","Phrenic nerve","Cauda equina","White matter of spinal cord","Facial nerve (VII)","Saphenous nerve","Pudendal nerve"],
 "tendons":["Calcaneal tendon","Patellar ligament","Anterior cruciate ligament","Posterior cruciate ligament","Tibial collateral ligament","Fibular collateral ligament",
  "Plantar aponeurosis","Iliotibial tract","Inguinal ligament","Anterior longitudinal ligament","Flexor retinaculum of wrist","Medial meniscus","Lateral meniscus","Iliofemoral ligament",
  "Coraco-acromial ligament","Ulnar collateral ligament of elbow joint","Interosseous membrane of forearm","Interosseous membrane of leg","Sacrotuberous ligament","Linea alba"]}
res={"nerves":{"keep":0.04,"elements":[],"labels":[]},"tendons":{"keep":0.07,"elements":[],"labels":[]}}
names={}
k=0
for o in d['index']:
    if o['kind'] not in res: continue
    P=warp(zmesh(o)); idx=np.frombuffer(blob,'<u4',o['ni'],o['off']+o['nv']*12).reshape(-1,3)
    if not np.isfinite(P).all(): print('bad',o['name']); continue
    k+=1; eid='ZA%04d'%k
    with open(OUTD+eid+'.obj','w') as f:   # the BodyParts3D file convention: mm, x left, y back, z up
        f.write(''.join('v %.2f %.2f %.2f\n'%(p[0]*10,-p[2]*10,p[1]*10) for p in P)); f.write(''.join('f %d %d %d\n'%(a+1,b+1,c+1) for a,b,c in idx))
    res[o['kind']]["elements"].append(eid); names[o['name']]=eid
for layer,L in LAB.items():
    for t in L:
        hit=False
        for suf in ('.r','.l',''):
            if t+suf in names and names[t+suf] in res[layer]["elements"]: res[layer]["labels"].append({"t":t,"elements":[names[t+suf]]}); hit=True
        if not hit: print('no label for',t)
json.dump(res,open(OUTD+'extra.json','w')); json.dump(names,open(OUTD+'names.json','w'))
print({k2:(len(v["elements"]),len(v["labels"])) for k2,v in res.items()})
