# Native PC edition verification

Engine: Godot 4.6.3 stable, compatibility renderer. The project and exported games are native Godot programs, not browser wrappers. Unreal Engine is not installed or used in this build.

Completed checks:

- 262 integration checks against the actual native Main scene: 22 imported athlete models, six animation clips, hand anchors and collision bodies; legal and blocked forward passes; crossing and retreat lock; catches versus misses; handoffs; LB opponent run/pass behavior; live own-end-zone play and grounded safety; touchdowns and stopped dead-ball movement; physical skill movement, stamina, cooldown, pause and tackle mapping; three HS games, recruiting, signing, four condensed college seasons and persisted completion.
- 73 career checks: stat-driven recruiting, school offers, commitment, progression, XP accounting, role-specific upgrades, practice limits and validated save/load recovery.
- The actual native OpenGL scene renders on Linux with Mesa llvmpipe, and rendered screenshots are captured from the game viewport. This is functional/render verification, not a benchmark for gaming-PC performance.
- Official Godot Windows x86-64 and Linux x86-64 release templates are downloaded from the Godot release archive, checked against the archive entry CRC and recorded with hashes and upstream provenance. The export tool rejects script/import errors even when Godot returns zero.
- Each ZIP includes executable, required PCK data, instructions, asset provenance and Godot/third-party notices. SHA-256 checksums are distributed beside the downloads.

The Windows executable is cross-exported on Linux. No Windows machine or Windows runtime is available in this environment, so launching the Windows release on Windows has not been verified here. This is an unsigned prototype release.

The athlete model, cloth textures, animation clips and stadium are original procedural artwork. They are not scanned players, licensed roster data, official uniforms, or EA-quality production assets. Play uses simplified rules and condensed schedules; opponent possessions in offensive careers are simulated rather than full live opponent drives.
