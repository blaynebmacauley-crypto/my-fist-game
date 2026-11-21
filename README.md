# Saturday Lights — browser edition, V13

A no-install browser football prototype. Serve this directory over HTTP; opening index.html directly from a file URL will not support module/GLB loading. The published browser edition is the primary experience. The earlier native PC release is retained in the downloads archive.

The V12 presentation uses an original imported football athlete with 35 source meshes, six authored animation clips, mirrored left-handed carry/throw motion, actual animated hand anchors, editable uniforms and live jersey numbers. All 22 athletes share loaded geometry and textures while keeping independent animation state and cosmetic materials. A failed model download is visible and retryable, and play does not fall back silently to older placeholder artwork.

The field sits in an enclosed three-tier stadium with 17,733 instanced spectators, a new turf texture, original midfield crest, updated daylight/fill, rails, aisles and sideline staff. Architecture and crowds are batched to limit draw calls. The lobby, four-step creator, career tabs, bottom score strip and touch controls have desktop and phone layouts. Barlow fonts are hosted locally; there are no external runtime font or asset CDNs.

QB/RB/WR/LB gameplay, camera-relative movement, pass restrictions beyond scrimmage, skill moves, grounded tackles, simulated opposing possessions, three HS games, recruiting and four condensed college seasons remain available. Existing browser career saves use the same localStorage key and are retained.

## Play with a friend

Choose **Play with a friend**, create a room and share its code or invite link. Your friend joins from another browser; the host starts once both players are connected. Keep the host tab open throughout the match.

The host starts on offense as quarterback/ball carrier; the guest starts as linebacker. Possession changes swap these roles. WASD moves, Shift sprints, Space snaps on offense, 1/2/3 passes, Q/E cuts with the ball and E tackles on defense. Both players share the score, game clock and pause. Friendly matches never change saved career progress. After the final whistle, return to the room for a rematch.

## Development

Use Node 20+ for the tests. Install development dependencies with `npm install`, then run:

- `npm test`: meaningful rules, career, route, profile and possession checks.
- `npm run test:multiplayer`: two-browser full-match checks with the local signaling server (see ../server/README.md).
- `npm run serve`: HTTP server on port 8091.
- `npm run test:browser`: integration checks against http://127.0.0.1:8091 (override GAME_URL when needed). Set CHROMIUM_PATH if Chromium is not /usr/bin/chromium.

Functional browser checks disable automatic RAF and step the real exported game loop to avoid software-GPU timing races. Rendered screenshots still use the actual Three.js scene. The suite checks imported models and animated hands, controls, passing restrictions, tackles/scoring, four-step creation and reload, phone controls, touch recruitment scrolling and asset failure/retry.

## Artwork and licenses

This remains a stylized prototype. The athletes, animations, uniforms, field art and stadium are original procedural artwork, not player scans or EA assets. College program names identify schools, while players, coaches and offers are fictional. There are no official logos or licensed real-player likenesses.

Three.js and the bundled GLTFLoader/BufferGeometryUtils are r170 under the MIT license; see vendor/THREE-LICENSE.txt. Barlow and Barlow Condensed use the SIL Open Font License; notices are in assets/fonts. Original athlete provenance and its Blender source generator are in art/.

PeerJS 1.5.5 is bundled under MIT; see vendor/PEERJS-LICENSE.txt. See MULTIPLAYER.md for networking and verification details.
