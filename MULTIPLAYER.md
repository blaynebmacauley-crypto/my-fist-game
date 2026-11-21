# Head-to-head networking

Two players connect through PeerJS/WebRTC. The production client uses the public PeerJS signaling broker and its public STUN/TURN configuration, including TCP relay URLs. GitHub Pages serves static game files; it does not host a game server. Connection availability depends on the signaling/relay services and each player’s network.

The host runs the football simulation and sends 20 Hz snapshots. The guest sends normalized movement and role-checked commands, never scores or actor positions. Versioned handshakes, session/match IDs, monotonic sequences, bounded JSON, heartbeat and disconnect handling reject stale or malformed messages. A room admits two players. Rematches use a new match ID. Saved careers are separate.

The guest interpolates authoritative actors, ball and contact animations. Touchdowns, safeties, interceptions and turnovers on downs change possession; online play does not simulate an absent opponent. Leaving or losing a connection stops the shared match.

## Verification

Unit tests cover scoring, possession, command validation and snapshot bounds. Real isolated Chromium sessions test create/join, host-only start, movement, passing, tackles, scores, possession changes, pause, a complete match, career-save preservation, rematch, phone layout and disconnect. Separate transport tests exercise room capacity, malformed payloads and room recreation.

In the managed cloud browser, non-proxied UDP is disabled by policy. Tests use a local signaling server and a TCP TURN relay without changing browser policy. These checks establish real two-browser WebRTC delivery and gameplay, not public Internet reachability. The public PeerJS broker cannot be reached from this cloud network, so production Internet connectivity was not verified here.
