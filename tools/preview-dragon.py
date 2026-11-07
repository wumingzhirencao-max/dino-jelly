import bpy,math
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=r'D:/Codxe_file/Geam/dinosaur-island/assets/water-dragon/source.blend')
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.render.resolution_x=800;s.render.resolution_y=800;s.render.resolution_percentage=100
pts=[o.matrix_world@Vector(c) for o in s.objects if o.type=='MESH' for c in o.bound_box];center=sum(pts,Vector())/len(pts)
bpy.ops.object.camera_add(location=center+Vector((1.5,-2,1.3)));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.7;s.camera=cam
bpy.ops.object.light_add(type='AREA',location=center+Vector((-2,-3,4)));bpy.context.object.data.energy=350;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
s.world=bpy.data.worlds.new('World');s.world.use_nodes=True
bg=s.world.node_tree.nodes.new('ShaderNodeBackground');bg.inputs[0].default_value=(.7,.7,.7,1);bg.inputs[1].default_value=.6
out=s.world.node_tree.nodes.new('ShaderNodeOutputWorld');s.world.node_tree.links.new(bg.outputs[0],out.inputs[0])
s.render.filepath=r'D:/Codxe_file/Geam/dinosaur-island/assets/water-dragon/preview.png';bpy.ops.render.render(write_still=True)
