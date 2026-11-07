import bpy,json,base64,struct
from pathlib import Path
from mathutils import Vector,kdtree
root=Path(r'D:/Codxe_file/Geam/dinosaur-island');bpy.ops.wm.open_mainfile(filepath=str(root/'assets/water-dragon/source.blend'))
old=json.loads((root/'assets/water-dragon/old-parts.json').read_text());names=list(old);points=[]
for k,part in old.items():
 raw=base64.b64decode(part['position']);vs=struct.unpack('<%sf'%(len(raw)//4),raw)
 for i in range(0,len(vs),3):points.append((Vector(vs[i:i+3])+Vector(part['pivot']),names.index(k)))
kd=kdtree.KDTree(len(points))
for i,(p,k) in enumerate(points):kd.insert(p,i)
kd.balance();obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');m=obj.data;m.calc_loop_triangles();parts={k:{'p':[],'n':[],'uv':[]} for k in names}
for tri in m.loop_triangles:
 coords=[]
 for li in tri.loops:
  v=obj.matrix_world@m.vertices[m.loops[li].vertex_index].co;coords.append(Vector((v.x,v.z,-v.y)))
 center=sum(coords,Vector())/3;_,nearest,_=kd.find(center);name=names[points[nearest][1]];pivot=Vector(old[name]['pivot']);out=parts[name]
 for li,v in zip(tri.loops,coords):
  normal=obj.matrix_world.to_3x3()@m.vertices[m.loops[li].vertex_index].normal;out['p'].extend(v-pivot);out['n'].extend((normal.x,normal.z,-normal.y));out['uv'].extend(m.uv_layers.active.data[li].uv[:])
def enc(v):return base64.b64encode(struct.pack('<%sf'%len(v),*v)).decode()
result={}
for k,v in parts.items():result[k]={'position':enc(v['p']),'normal':enc(v['n']),'uv':enc(v['uv']),'pivot':old[k]['pivot']}
im=next(im for im in bpy.data.images if im.filepath.endswith('Color.png'));im.scale(2048,2048);im.filepath_raw=str(root/'assets/water-dragon/color.png');im.file_format='PNG';im.save()
data={'tris':sum(len(v['p'])//9 for v in parts.values()),'source':'tripo_convert_9ae21aff-4cf8-4f33-8df0-c40bfd8f42bc.fbx','parts':result,'images':{'basecolor':{'data':'data:image/png;base64,'+base64.b64encode((root/'assets/water-dragon/color.png').read_bytes()).decode()}}}
(root/'assets/water-dragon/model.js').write_text('window.PINK_MODEL='+json.dumps(data)+';',encoding='utf-8');print('PART TRIANGLES',[(k,len(v['p'])//9) for k,v in parts.items()])
