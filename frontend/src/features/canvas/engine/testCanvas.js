/**
 * Test helpers: drive a BoardPlayer without a real canvas. The fake 2D context
 * accepts every call, measures text as 12 units per character, and the player's
 * animation loop is replaced so tests advance it by hand with drain().
 */
function fakeContext() {
  const target = {
    canvas: { width: 0, height: 0 },
    measureText: (text) => ({ width: String(text).length * 12 }),
  };
  const context = new Proxy(target, {
    get: (object, key) => (key in object ? object[key] : () => context),
    set: (object, key, value) => {
      object[key] = value;
      return true;
    },
  });
  return context;
}

export function attachFakeCanvas(player) {
  player.ink = fakeContext();
  player.sceneCtx = fakeContext();
  player.overlay = fakeContext();
  player.pixelScale = 1;
  player.fontsReady = true;
  player._wake = () => {};
  player.setInstant(true);
  return player;
}

/** Run the board until it can't move on (finished, waiting for the stream, or asking). */
export function drain(player, rounds = 60) {
  for (let i = 0; i < rounds; i += 1) {
    player.clock += 1e6;
    player._advance(1e6);
  }
  player._emit();
}
