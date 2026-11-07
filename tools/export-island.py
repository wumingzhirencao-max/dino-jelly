import bpy,json,base64,struct
from pathlib import Path
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=r'D:/Codxe_file/Geam/dinosaur-island/assets/island-model/source.blend')
o=next(o for o in bpy.context.scene.objects if o.type=='MESH');m=o.data;m.calc_loop_triangles();m.uv_layers.active
pts=[o.matrix_world@v.co for v in m.vertices];print('BOUNDS',[(min(v[k] for v in pts),max(v[k] for v in pts)) for k in range(3)])
print('ZQUANTILES',[sorted(v.z for v in pts)[int((len(pts)-1)*q)] for q in [.05,.15,.25,.5,.75,.9]])
p=[];n=[];uv=[]
for tri in m.loop_triangles:
 for li in tri.loops:
  loop=m.loops[li];v=pts[loop.vertex_index];normal=o.matrix_world.to_3x3()@m.vertices[loop.vertex_index].normal
  p.extend([v.x,v.z,-v.y]);n.extend([normal.x,normal.z,-normal.y]);uv.extend(m.uv_layers.active.data[li].uv[:])
im=next(im for im in bpy.data.images if im.size[0]>0);im.scale(2048,2048);im.filepath_raw=r'D:/Codxe_file/Geam/dinosaur-island/assets/island-model/albedo.png';im.file_format='PNG';im.save()
def enc(a):return base64.b64encode(struct.pack('<%sf'%len(a),*a)).decode()
data={'position':enc(p),'normal':enc(n),'uv':enc(uv),'count':len(p)//3}
Path(r'D:/Codxe_file/Geam/dinosaur-island/assets/island-model/model.js').write_text('window.FULL_ISLAND_MODEL='+json.dumps(data)+';',encoding='utf-8')
