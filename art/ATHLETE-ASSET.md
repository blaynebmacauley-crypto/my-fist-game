# Original football athlete

`athlete.glb` is original procedural artwork created for this project by
`native/tools/build_athlete.py`. The generator uses Blender's mesh, curve,
material, image and animation APIs. It does not download or incorporate a
third-party character, player scan, photograph, motion-capture clip, team logo,
real player's likeness, or font file.

The model and embedded textures may be used, modified and redistributed with
this project. There are no additional third-party athlete-asset license terms.
Blender and Godot are development tools, not embedded athlete artwork; the
application's Godot notices are documented separately.

The visual is a smooth, anatomically proportioned procedural football athlete,
not a scanned or photoreal character. Its default maroon/cream uniform and angular
helmet marks are fictional. The face uses small 3D features and a curved head;
there is no facial photograph or flat face decal. All numbers, woven cloth pixels,
seams, glove fingers, studs and facemask geometry were generated from code.

## Runtime contract

- Units are meters; the standing athlete is approximately 1.925 m high.
- In Godot, the feet rest at Y=0, up is +Y and forward is +Z.
- Main editable PBR material names are `Jersey`, `Pants`, `Helmet`, `Skin`,
  `Gloves`, `Cleats` and `Facemask`. Other materials supply socks, seams and trim.
- The neutral embedded weave supports uniform recoloring through material albedo.
- One imported `AnimationPlayer` contains `idle`, `run`, `carry`, `throw`, `catch`
  and `tackle`. Loop `idle`/`run`/`carry` in the runtime. All clips are authored
  object-pivot animations, not skeletal motion capture or physics ragdolls.
- The articulated hierarchy provides `spine`, `head`, `upper_arm_R/L`,
  `forearm_R/L`, `hand_R/L`, `thigh_R/L`, `shin_R/L` and `ankle_R/L`.
- `hand_R` and `hand_L` are moving wrist anchors for a held football.
- `jersey_front` and `jersey_back` are chest anchors with outward-facing local
  +Z normals for runtime number labels. They follow torso animations.
- `DefaultNumberFront` and `DefaultNumberBack` carry the embedded original seven.
  Hide them when displaying runtime jersey numbers.

The exported model has 29,960 triangles. Pieces are combined only when they share
an articulated parent and material, preserving elbow, knee, wrist and ankle
movement while reducing material draws. Godot can extract the two embedded PNG
textures into the assets directory during import; those images contain the same
project-generated pixels already packed in the GLB.

## Rebuild and verification

```sh
blender -b --factory-startup --python native/tools/build_athlete.py
```

The generator fixes Blender 4.3's lost multiply-color factor when exporting the
neutral weave: it writes explicit Jersey/Pants PBR base-color factors into the
finished GLB. No remote service or external asset is needed to regenerate it.

The completed GLB was imported by Godot 4.6.3 in a separate headless test project.
Verification checks the merged animation player and six clips, mesh/triangle
budget, jersey color factor, chest-anchor orientation and moving hand anchor.
