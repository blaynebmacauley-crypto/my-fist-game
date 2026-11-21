"""Create the project's original football athlete and its GLB animations.
Run: blender -b --factory-startup --python native/tools/build_athlete.py
No external geometry, photographs, fonts or texture files are required.
"""
import bpy
import math
import json
import os
import struct
from pathlib import Path
from mathutils import Vector

OUTPUT = Path(__file__).resolve().parents[1] / 'assets' / 'athlete.glb'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):
    bpy.data.materials.remove(data)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 37

# The modeling coordinates use Z up and -Y forward. glTF's standard conversion
# yields Y up / +Z forward in Godot. Mesh dimensions are meters.
def linear(hex_color):
    result = []
    for i in [0, 2, 4]:
        value = int(hex_color.lstrip('#')[i:i+2], 16) / 255
        result.append(value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4)
    return (*result, 1)


def image(name, size, paint):
    img = bpy.data.images.new(name, width=size, height=size, alpha=True)
    pixels = []
    for y in range(size):
        for x in range(size):
            pixels.extend(paint(x, y, size))
    img.pixels = pixels
    img.pack()
    return img


cloth = image('Original woven athletic cloth', 128, lambda x,y,s: ((.94 if (x % 4 < 2) != (y % 4 < 2) else 1),)*3 + (1,))


def material(name, color, roughness=.65, metallic=0, fabric=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    mat.diffuse_color = linear(color)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = linear(color)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if fabric:
        nodes = mat.node_tree.nodes
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = cloth
        tex.extension = 'REPEAT'
        mix = nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1
        mix.inputs[2].default_value = linear(color)
        mat.node_tree.links.new(tex.outputs['Color'], mix.inputs[1])
        mat.node_tree.links.new(mix.outputs['Color'], shader.inputs['Base Color'])
    return mat


mats = {
    'Jersey': material('Jersey', '#7d1835', .82, fabric=True),
    'Pants': material('Pants', '#d7d4c7', .85, fabric=True),
    'Helmet': material('Helmet', '#71132d', .22, .16),
    'Skin': material('Skin', '#a36c48', .61),
    'Gloves': material('Gloves', '#e9e7df', .62),
    'Cleats': material('Cleats', '#18212a', .44),
    'Facemask': material('Facemask', '#6a747c', .3, .65),
    'Sock': material('Sock', '#deded6', .87),
    'Trim': material('Trim', '#dbd8ca', .7),
    'Seam': material('Seam', '#461c2b', .9),
    'Sole': material('Sole', '#0d151c', .8),
    'Eye': material('Eye', '#29251f', .6),
    'EyeWhite': material('EyeWhite', '#bcb5a8', .65),
    'Lip': material('Lip', '#754631', .7),
}


def empty(name, pos=(0,0,0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = 'PLAIN_AXES'
    obj.parent = parent
    obj.location = pos
    return obj


root = empty('AthleteRoot')
body = empty('spine', (0,0,1.03), root)
head_pivot = empty('head', (0,0,.58), body)


def attach(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def smooth(obj):
    if obj.type == 'MESH':
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj


def finish(obj, name, mat, parent=root):
    obj.name = name
    obj.data.materials.append(mat)
    smooth(obj)
    bpy.context.view_layer.update()
    attach(obj, parent)
    return obj


# [absolute height, half width, front radius, back radius, lateral center].
def contour(name, rows, mat, parent=root, sides=20, subdivision=1):
    vertices, faces, uvs = [], [], []
    for z,w,front,back,center in rows:
        for j in range(sides):
            angle = j / sides * math.tau
            sin = math.sin(angle)
            vertices.append((center + math.cos(angle)*w, sin*(front if sin < 0 else back), z))
    for i in range(len(rows)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides; c=(i+1)*sides+(j+1)%sides; d=(i+1)*sides+j
            faces.append((a,b,c,d))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(rows)-1)*sides+j for j in range(sides)))
    mesh = bpy.data.meshes.new(name+' geometry')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    uv = mesh.uv_layers.new(name='Cloth UV')
    z0=rows[0][0]; span=rows[-1][0]-z0
    for poly in mesh.polygons:
        for loop in poly.loop_indices:
            index=mesh.loops[loop].vertex_index; row=index//sides; j=index%sides
            uv.data[loop].uv=(j/sides*6, (rows[row][0]-z0)/span*10)
    if subdivision:
        modifier=obj.modifiers.new('Smooth athletic silhouette', 'SUBSURF')
        modifier.levels=modifier.render_levels=subdivision
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj,name,mat,parent)


def ellipsoid(name, pos, scale, mat, parent=root, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=pos)
    obj=bpy.context.object
    obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(obj,name,mat,parent)


def tube(name, points, radius, mat, parent=root, resolution=3):
    curve=bpy.data.curves.new(name+' path','CURVE');curve.dimensions='3D'
    curve.resolution_u=8;curve.bevel_depth=radius;curve.bevel_resolution=resolution
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for point,co in zip(spline.bezier_points,points):
        point.co=co;point.handle_left_type=point.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    for other in bpy.context.selected_objects:
        if other!=obj:other.select_set(False)
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,name,mat,parent)


def row(z,w,front,back=None,center=0):
    return (z,w,front,front if back is None else back,center)


# A tapered padded torso transitions into shoulders and waist; it is not a stack
# of cylinders or detached spheres. Arm and thigh contours carry the musculature.
torso_rows=[row(.955,.158,.103,.105),row(.97,.167,.11,.112),row(1.03,.173,.117,.118),row(1.12,.185,.133,.124),row(1.24,.226,.157,.135),row(1.36,.262,.166,.143),row(1.45,.278,.157,.142),row(1.50,.255,.132,.126),row(1.535,.18,.102,.097),row(1.55,.085,.065,.065)]
contour('Fitted padded jersey',torso_rows,mats['Jersey'],body,sides=24)
contour('Football pants and glutes',[row(.79,.132,.097,.112),row(.82,.169,.115,.137),row(.89,.184,.126,.147),row(.96,.168,.114,.12),row(1.01,.16,.107,.11)],mats['Pants'],body,sides=24)
contour('Neck',[row(1.53,.06,.056),row(1.55,.058,.054),row(1.625,.053,.053),row(1.65,.055,.054)],mats['Skin'],head_pivot,sides=16)
tube('Fitted V collar',[(-.077,-.058,1.546),(-.054,-.071,1.538),(0,-.083,1.521),(.054,-.071,1.538),(.077,-.058,1.546)],.007,mats['Trim'],body)
# Shoulder yokes have a fitted sleeve opening and lower profile than toy caps.
upper_arms={};forearms={};hands={};hips={};knees={};ankles={}
for side,sign in [('L',-1),('R',1)]:
    shoulder=empty('upper_arm_'+side,(sign*.286,0,.435),body);upper_arms[side]=shoulder
    elbow=empty('forearm_'+side,(sign*.012,0,-.325),shoulder);forearms[side]=elbow
    wrist=empty('hand_'+side,(sign*.004,0,-.285),elbow);hands[side]=wrist
    sx=sign*.286
    contour('Padded sleeve '+side,[row(1.36,.076,.084,.078,sx),row(1.39,.092,.103,.092,sx),row(1.45,.108,.108,.101,sx),row(1.51,.094,.092,.085,sx),row(1.54,.064,.065,.06,sx)],mats['Jersey'],shoulder,sides=20)
    contour('Upper arm '+side,[row(1.122,.048,.049,.047,sx+sign*.012),row(1.15,.053,.054,.052,sx+sign*.01),row(1.23,.067,.066,.062,sx+sign*.009),row(1.32,.071,.068,.065,sx+sign*.005),row(1.39,.064,.063,.06,sx)],mats['Skin'],shoulder,sides=16)
    contour('Forearm '+side,[row(.85,.033,.034,.032,sx+sign*.016),row(.88,.037,.037,.035,sx+sign*.016),row(.97,.051,.049,.047,sx+sign*.015),row(1.05,.055,.053,.05,sx+sign*.012),row(1.14,.047,.047,.045,sx+sign*.012)],mats['Skin'],elbow,sides=16)
    hx=sx+sign*.016
    contour('Glove palm '+side,[row(.765,.027,.019,.021,hx),row(.78,.035,.023,.025,hx),row(.815,.038,.025,.027,hx),row(.848,.034,.025,.024,hx),row(.871,.03,.023,.022,hx)],mats['Gloves'],wrist,sides=16)
    for finger in range(4):
        fx=hx+(finger-1.5)*.017
        ellipsoid('Glove finger '+side+str(finger),(fx,-.007,.756),(.0085,.012,.031-(abs(finger-1.5)*.003)),mats['Gloves'],wrist,12,8)
    thumb=ellipsoid('Glove thumb '+side,(hx-sign*.039,-.008,.798),(.011,.016,.03),mats['Gloves'],wrist,12,8);thumb.rotation_euler.y=sign*.45
    hip=empty('thigh_'+side,(sign*.104,0,.91),root);hips[side]=hip
    knee=empty('shin_'+side,(0,0,-.40),hip);knees[side]=knee
    ankle=empty('ankle_'+side,(0,0,-.38),knee);ankles[side]=ankle
    lx=sign*.104
    contour('Football thigh '+side,[row(.505,.06,.063,.06,lx),row(.53,.068,.071,.068,lx),row(.62,.085,.087,.088,lx),row(.73,.102,.103,.108,lx),row(.84,.105,.1,.111,lx),row(.93,.092,.089,.102,lx)],mats['Pants'],hip,sides=20)
    contour('Calf and shin '+side,[row(.13,.033,.035,.033,lx),row(.17,.036,.038,.04,lx),row(.26,.049,.046,.059,lx),row(.35,.057,.05,.066,lx),row(.43,.052,.046,.058,lx),row(.515,.048,.045,.047,lx)],mats['Skin'],knee,sides=16)
    contour('Football sock '+side,[row(.10,.035,.037,.035,lx),row(.13,.035,.038,.036,lx),row(.20,.041,.042,.045,lx),row(.255,.047,.045,.053,lx),row(.267,.046,.044,.052,lx)],mats['Sock'],knee,sides=16)
    # Cleat toe is swept forward (-Y), narrow at heel, with a thin outsole.
    contour('Leather cleat '+side,[row(.032,.043,.137,.049,lx),row(.045,.052,.141,.052,lx),row(.065,.054,.131,.053,lx),row(.088,.048,.102,.05,lx),row(.12,.034,.052,.038,lx)],mats['Cleats'],ankle,sides=20)
    contour('Cleat sole '+side,[row(.012,.046,.137,.05,lx),row(.018,.053,.146,.054,lx),row(.028,.054,.146,.054,lx),row(.035,.05,.138,.05,lx)],mats['Sole'],ankle,sides=20,subdivision=0)
    for y in [-.105,-.04,.032]:
        for x in [-.031,.031]:
            ellipsoid('Stud '+side,(lx+x,y,.009),(.009,.009,.009),mats['Sole'],ankle,8,6)
    # Cloth seams, a subtle pants stripe and cleat laces remain original geometry.
    tube('Pants seam '+side,[(lx+sign*.094,.005,.88),(lx+sign*.102,.003,.74),(lx+sign*.076,.002,.55)],.0025,mats['Seam'],hip,1)
    for y in [-.077,-.059,-.041]:
        tube('Cleat lace '+side,[(lx-.023,y,.09),(lx,y+.003,.094),(lx+.023,y,.09)],.0017,mats['Trim'],ankle,1)
# Small sewn chest/side lines add detail without oversized raised pads.
for sign in [-1,1]:
    tube('Jersey shoulder seam',[(sign*.09,-.072,1.53),(sign*.18,-.12,1.49),(sign*.25,-.12,1.45)],.0017,mats['Seam'],body,1)

# The helmet is genuinely open at the face. The rounded cutter leaves a smooth
# aperture rather than hiding a complete sphere behind a facial rectangle.
helmet=ellipsoid('Helmet shell',(0,0,1.765),(.132,.144,.16),mats['Helmet'],root,48,28)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,-.14,1.705))
cutter=bpy.context.object;cutter.name='Temporary rounded face aperture';cutter.scale=(.235,.23,.197)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bevel=cutter.modifiers.new('Rounded aperture','BEVEL');bevel.width=.025;bevel.segments=6
bpy.context.view_layer.objects.active=cutter;bpy.ops.object.modifier_apply(modifier=bevel.name)
bpy.context.view_layer.objects.active=helmet
modifier=helmet.modifiers.new('Open face aperture','BOOLEAN');modifier.operation='DIFFERENCE';modifier.object=cutter
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.data.objects.remove(cutter,do_unlink=True)
attach(helmet,head_pivot)
head=ellipsoid('Human head',(0,-.006,1.755),(.09,.087,.117),mats['Skin'],head_pivot,32,20)
ellipsoid('Nose bridge',(0,-.092,1.751),(.0105,.015,.021),mats['Skin'],head_pivot,16,10)
ellipsoid('Nose tip',(0,-.106,1.738),(.013,.013,.009),mats['Skin'],head_pivot,16,8)
for sign in [-1,1]:
    ellipsoid('Ear',(sign*.085,0,1.75),(.012,.018,.025),mats['Skin'],head_pivot,12,8)
    ellipsoid('Eye sclera',(sign*.032,-.0865,1.776),(.012,.0027,.0044),mats['EyeWhite'],head_pivot,12,8)
    ellipsoid('Eye pupil',(sign*.032,-.089,1.776),(.0036,.0015,.0037),mats['Eye'],head_pivot,12,8)
    tube('Eyebrow',[(sign*.046,-.084,1.786),(sign*.032,-.089,1.79),(sign*.02,-.088,1.787)],.0019,mats['Eye'],head_pivot,1)
tube('Natural lip line',[(-.018,-.085,1.708),(0,-.089,1.705),(.018,-.085,1.708)],.0015,mats['Lip'],head_pivot,1)
tube('Facemask upper bar',[(-.12,-.051,1.727),(-.118,-.132,1.686),(0,-.162,1.675),(.118,-.132,1.686),(.12,-.051,1.727)],.0047,mats['Facemask'],head_pivot,2)
tube('Facemask lower bar',[(-.113,-.055,1.687),(-.108,-.13,1.636),(0,-.157,1.63),(.108,-.13,1.636),(.113,-.055,1.687)],.0047,mats['Facemask'],head_pivot,2)
for x in [-.069,.069]:
    tube('Facemask vertical bar',[(x,-.142,1.718),(x,-.164,1.674),(x*.95,-.154,1.633)],.004,mats['Facemask'],head_pivot,2)
tube('Chin strap',[(-.11,-.025,1.70),(-.07,-.104,1.641),(0,-.117,1.629),(.07,-.104,1.641),(.11,-.025,1.70)],.004,mats['Trim'],head_pivot,2)
ellipsoid('Fitted chin cup',(0,-.112,1.632),(.034,.012,.013),mats['Trim'],head_pivot,16,8)
stripe=[]
for i in range(15):
    angle=-1.32+i/14*2.64
    stripe.append((0,.145*math.sin(angle),1.765+.161*math.cos(angle)))
tube('Helmet center stripe',stripe,.006,mats['Trim'],head_pivot,2)
# Original angular bolt marks on each helmet side, not real program branding.
for sign in [-1,1]:
    tube('Original helmet bolt',[(sign*.131,-.006,1.81),(sign*.134,.032,1.77),(sign*.134,.004,1.77),(sign*.13,.028,1.724)],.004,mats['Trim'],head_pivot,1)

# Embedded, independently hideable number artwork. Runtime Label3D numbers may
# replace these nodes for created athletes without touching uniform textures.
def inside(x,y,points):
    hit=False;j=len(points)-1
    for i,(xi,yi) in enumerate(points):
        xj,yj=points[j]
        if ((yi>y)!=(yj>y)) and x < (xj-xi)*(y-yi)/(yj-yi)+xi:hit=not hit
        j=i
    return hit
number_polygons=[[(.22,.79),(.81,.79),(.81,.91),(.22,.91)],[(.67,.83),(.81,.83),(.46,.11),(.29,.11)]]
def number_pixel(x,y,size):
    u=x/size;v=y/size
    if any(inside(u,v,p) for p in number_polygons):return (1,.98,.93,1)
    if any(any(inside(u+dx,v+dy,p) for dx,dy in [(.013,0),(-.013,0),(0,.013),(0,-.013)]) for p in number_polygons):return (.055,.065,.075,1)
    return (1,1,1,0)
number_image=image('Original jersey seven',256,number_pixel)
number_mat=material('NumberOverlay','#ffffff',.8)
number_mat.surface_render_method='DITHERED'
number_mat.use_backface_culling=False
tex=number_mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=number_image
shader=number_mat.node_tree.nodes.get('Principled BSDF');number_mat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color']);number_mat.node_tree.links.new(tex.outputs['Alpha'],shader.inputs['Alpha'])

def radius_at(z):
    for a,b in zip(torso_rows,torso_rows[1:]):
        if a[0]<=z<=b[0]:
            t=(z-a[0])/(b[0]-a[0]);return tuple(a[i]+(b[i]-a[i])*t for i in [1,2,3])
    return (.2,.14,.13)
for back in [False,True]:
    vertices=[];faces=[]
    for iz in range(9):
        z=1.11+iz/8*.30;w,front,rear=radius_at(z)
        for ix in range(9):
            x=(ix/8-.5)*.24;depth=(rear if back else front)*math.sqrt(max(.1,1-(x/w)**2))+.0018
            vertices.append((x,depth if back else -depth,z))
    for iz in range(8):
        for ix in range(8):
            a=iz*9+ix
            faces.append((a+9,a+10,a+1,a) if back else (a,a+1,a+10,a+9))
    mesh=bpy.data.meshes.new('Curved printed number');mesh.from_pydata(vertices,[],faces);mesh.update();uv=mesh.uv_layers.new(name='Number UV')
    for poly in mesh.polygons:
        for loop in poly.loop_indices:
            i=mesh.loops[loop].vertex_index;uv.data[loop].uv=(i%9/8,i//9/8)
    obj=bpy.data.objects.new('DefaultNumberBack' if back else 'DefaultNumberFront',mesh);bpy.context.collection.objects.link(obj);finish(obj,obj.name,number_mat,body)

# Runtime labels can follow chest motion using named anchors without replacing
# animation tracks or guessing how mesh origins were transformed at import.
front_anchor=empty('jersey_front',(0,-.174,.23),body)
front_anchor.rotation_euler=(0,0,0)
back_anchor=empty('jersey_back',(0,.151,.23),body)
back_anchor.rotation_euler.z=math.pi

# Merge only pieces sharing their exact articulated parent and material. This
# preserves elbow/knee/wrist pivots and lets twenty-two athletes share a budget
# of about 35 material draws each instead of drawing every finger and cage bar.
groups={}
for obj in list(scene.objects):
    if obj.type=='MESH' and not obj.name.startswith('DefaultNumber') and len(obj.data.materials)==1:
        key=(obj.parent.name if obj.parent else None,obj.data.materials[0].name)
        groups.setdefault(key,[]).append(obj)
for (parent_name,material_name),pieces in groups.items():
    if len(pieces)<2:continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces:obj.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0]
    bpy.ops.object.join()
    bpy.context.object.name=(parent_name or 'Root')+' '+material_name+' batch'

# Object-pivot animation imports as an ordinary Godot AnimationPlayer. Tracks
# share NLA names so each complete clip becomes one glTF animation, not many.
animated=[root,body,head_pivot,*upper_arms.values(),*forearms.values(),*hands.values(),*hips.values(),*knees.values(),*ankles.values()]
base={obj.name:(obj.location.copy(),obj.rotation_euler.copy()) for obj in animated}

def reset_pose():
    for obj in animated:
        obj.location=base[obj.name][0];obj.rotation_euler=base[obj.name][1]


def pose(clip,t,duration):
    reset_pose();u=t/duration;phase=u*math.tau
    if clip=='idle':
        body.location.z+=math.sin(phase)*.0025;body.rotation_euler.x=.025
        for side in ['L','R']:
            upper_arms[side].rotation_euler.x=-.035+math.sin(phase)*.008
            forearms[side].rotation_euler.x=-.055
    elif clip in ['run','carry']:
        body.location.z+=abs(math.sin(phase))*.012
        body.rotation_euler.x=.10;body.rotation_euler.z=math.sin(phase)*.025
        for side,offset in [('L',0),('R',math.pi)]:
            a=phase+offset
            hips[side].rotation_euler.x=-math.sin(a)*.68
            knees[side].rotation_euler.x=.18+max(0,math.cos(a))*.95
            ankles[side].rotation_euler.x=-knees[side].rotation_euler.x*.35
            upper_arms[side].rotation_euler.x=math.sin(a)*.55-.1
            forearms[side].rotation_euler.x=-.95+math.cos(a)*.13
        if clip=='carry':
            upper_arms['R'].rotation_euler=(-.25,-.16,-.06)
            forearms['R'].rotation_euler.x=-1.9
            hands['R'].rotation_euler.x=.12
    elif clip=='throw':
        a=math.sin(min(1,u/.42)*math.pi/2);release=max(0,min(1,(u-.42)/.32));recover=max(0,min(1,(u-.79)/.21))
        upper_arms['R'].rotation_euler=(-2.08*a+release*1.12, -.32*a, -.18*a)
        forearms['R'].rotation_euler.x=1.5*a-release*1.32
        body.rotation_euler.z=.21*a-.37*release
        body.rotation_euler.x=.035+release*.10
        upper_arms['L'].rotation_euler.x=-.6*a
        forearms['L'].rotation_euler.x=-.7*a
        for obj in [body,*upper_arms.values(),*forearms.values()]:
            obj.rotation_euler=tuple(v*(1-recover) for v in obj.rotation_euler)
    elif clip=='catch':
        lift=min(1,u/.3);recover=max(0,min(1,(u-.72)/.28));a=math.sin(lift*math.pi/2)*(1-recover)
        for side,sign in [('L',-1),('R',1)]:
            upper_arms[side].rotation_euler=(-1.78*a,sign*.1*a,sign*-.04*a)
            forearms[side].rotation_euler.x=-.16*a
            hands[side].rotation_euler.x=-.4*a
        head_pivot.rotation_euler.x=-.06*a
    elif clip=='tackle':
        wrap=min(1,u/.3);fall=max(0,min(1,(u-.25)/.62));fall=fall*fall*(3-2*fall)
        root.rotation_euler.x=fall*1.49;root.location.z=fall*.185;root.location.y=-fall*.22
        for side,sign in [('L',-1),('R',1)]:
            upper_arms[side].rotation_euler=(-.95*wrap,sign*.22*wrap,sign*.12*wrap)
            forearms[side].rotation_euler.x=-1.2*wrap
            hips[side].rotation_euler.x=-.16*wrap
            knees[side].rotation_euler.x=.5*wrap
        body.rotation_euler.x=.15*wrap


clips={'idle':2.4,'run':.8,'carry':.8,'throw':1.15,'catch':1.1,'tackle':1.3}
for clip,duration in clips.items():
    frames=round(duration*30)+1
    for obj in animated:
        obj.animation_data_create();obj.animation_data.action=bpy.data.actions.new(clip+'__'+obj.name)
    for i in range(frames):
        t=i/(frames-1)*duration;pose(clip,t,duration)
        for obj in animated:
            obj.keyframe_insert(data_path='location',frame=i+1)
            obj.keyframe_insert(data_path='rotation_euler',frame=i+1)
    for obj in animated:
        action=obj.animation_data.action
        for fcurve in action.fcurves:
            for key in fcurve.keyframe_points:key.interpolation='LINEAR'
        track=obj.animation_data.nla_tracks.new();track.name=clip
        strip=track.strips.new(clip,1,action);strip.name=clip
        obj.animation_data.action=None
        track.mute=True
reset_pose();scene.frame_set(1)
for obj in animated:
    for track in obj.animation_data.nla_tracks:track.mute=False
# Avoid default multi-track blending changing the base transform at export.
for obj in animated:
    for track in obj.animation_data.nla_tracks:track.mute=True
bpy.ops.object.select_all(action='SELECT')
# GLB packs both original PNG images and all material data into the single file.
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_optimize_animation_size=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
# Blender 4.3's exporter keeps the neutral weave but drops the multiply color
# when a MixRGB node drives Base Color. Preserve the PBR color factors explicitly
# in the GLB JSON; the white weave still supports runtime uniform recoloring.
raw=OUTPUT.read_bytes()
json_length=struct.unpack_from('<I',raw,12)[0]
asset=json.loads(raw[20:20+json_length])
for mat in asset.get('materials',[]):
    if mat.get('name') in ('Jersey','Pants'):
        mat.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=list(mats[mat['name']].diffuse_color)
asset.setdefault('asset',{}).setdefault('extras',{})['artwork']='Original procedural model and embedded texture artwork generated by build_athlete.py'
json_bytes=json.dumps(asset,separators=(',',':')).encode('utf-8')
json_bytes+=b' '*((-len(json_bytes))%4)
remaining=raw[20+json_length:]
OUTPUT.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(json_bytes)+len(remaining))+struct.pack('<I4s',len(json_bytes),b'JSON')+json_bytes+remaining)
triangles=0
for obj in scene.objects:
    if obj.type=='MESH':
        obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
print('ATHLETE_EXPORT',json.dumps({'path':str(OUTPUT),'bytes':OUTPUT.stat().st_size,'triangles':triangles,'animations':list(clips),'forward':'+Z after glTF conversion','height_m':1.925}))
