# Where the extra body layers come from

These scripts prepare the inputs of `tools/build-body.mjs` for the layers that are not plain BodyParts3D organs.
They are kept as they were run; the folders under `/private/tmp` are working folders and can be changed at the top of each file.

- `bodyparts3d-vessels.py` lists the arteries and veins in the BodyParts3D "is a" part list and unpacks their OBJ files.
- `zanatomy-export.py` runs inside Blender (`Blender -b --disable-autoexec --factory-startup Startup.blend --python zanatomy-export.py`)
  and writes the nerves, the ligaments and tendons, and a set of reference bones of Z-Anatomy as plain triangles.
- `zanatomy-register.py` (Python with numpy) fits each Z-Anatomy reference bone onto the same BodyParts3D bone, bends the nerves,
  ligaments and tendons with a blend of those fits (weighted by distance to each bone), and saves them in the BodyParts3D OBJ
  convention with the list `extra.json`.

Then: `node tools/build-body.mjs parts.json <obj> muscles.json <obj> vessels.json <obj> extra.json <obj>`.

Sources and licences: BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan;
Z-Anatomy, the libre 3D atlas of anatomy, CC BY-SA 4.0 (https://github.com/Z-Anatomy/Models-of-human-anatomy).
