import bpy
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=r'D:/Codxe_file/Geam/dinosaur-island/assets/water-dragon/source.blend')
o=next(o for o in bpy.context.scene.objects if o.type=='MESH');p=[o.matrix_world@v.co for v in o.data.vertices];print('BOUNDS',[(min(v[k] for v in p),max(v[k] for v in p)) for k in range(3)])
