import bpy,json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=r'D:/AI/小岛/mods/tripo_convert_f6547073-6975-44cc-9950-71bc422572bb.fbx')
for o in bpy.context.scene.objects:
 if o.type=='MESH': print('MESH',o.name,len(o.data.vertices),len(o.data.polygons),list(o.dimensions),[m.name for m in o.data.materials])
for im in bpy.data.images: print('IMAGE',im.name,im.size[:],im.filepath)
bpy.ops.wm.save_as_mainfile(filepath=r'D:/Codxe_file/Geam/dinosaur-island/assets/island-model/source.blend')
