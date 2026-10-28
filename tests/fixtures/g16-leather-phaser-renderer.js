// Browser-only G5 fixture. It renders the final G4 ledger through the actual
// EquipmentVisualResolver -> Hero V5 contract -> EventBridge -> HeroRenderer
// path without publishing the Leather family to the production manifest.
(async () => {
  const FRAME_IDS = ["idle_01", "idle_02", "idle_03", "attack_01", "attack_02", "attack_03", "death_01", "death_02"];
  const status = document.getElementById("status");
  const validation = await fetch("../../docs/g16-leather-g2/g3/VALIDATION.json").then(response => {
    if (!response.ok) throw new Error(`Validation fetch failed: ${response.status}`);
    return response.json();
  });
  const frames = Object.fromEntries(FRAME_IDS.map(frameId => [frameId, Object.fromEntries(
    validation.files.filter(file => file.frame === frameId).map(file => [file.layer, file.path])
  )]));
  const baseFrames = Object.fromEntries(FRAME_IDS.map(frameId => [frameId, `r2-upload/hero/v5/g2/base/${frameId}.png`]));
  const handFrames = Object.fromEntries(FRAME_IDS.map(frameId => [frameId, {
    crop: validation.handOcclusion[frameId]?.crop || null
  }]));

  globalThis.ASSETS = {
    hero001: { v5: { g2: {
      approval: "approved",
      canvas: { width: 768, height: 768 },
      base: { approval: "approved", frames: baseFrames },
      equipment: {
        leather: {
          approval: "approved",
          compositionProfile: "leather_overlap_v1",
          hairMode: "hidden_full_cover",
          frames,
          frameComposition: {
            attack_01: { foreground: ["arm_rear"] },
            attack_02: { foreground: ["arm_rear"] },
            attack_03: { foreground: ["arm_rear"] },
            death_02: { foreground: ["arm_rear"] }
          },
          handOcclusion: { sourceLayer: "arm_rear", after: "sword", frames: handFrames }
        }
      }
    } } }
  };

  const equipped = Object.fromEntries(["helmet", "chest", "gloves", "boots", "weapon"]
    .map(type => [type, { type, gearTier: 1 }]));
  const selection = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroV5Selection(equipped);
  const layerFrames = heroPresentationLayerFrames({}, { preferV5: true, v5Selection: selection });
  if (!layerFrames || layerFrames.mode !== "v5-g2-leather") throw new Error("Leather contract did not resolve");

  const Phaser = await THORNIE_PHASER_RUNTIME.load();
  const rendererMode = new URLSearchParams(location.search).get("renderer") === "auto" ? Phaser.AUTO : Phaser.CANVAS;
  let heroRenderer = null;
  let game = null;
  const frameLookup = Object.fromEntries([
    ...FRAME_IDS.slice(0, 3).map((frameId, index) => [frameId, ["idle", index]]),
    ...FRAME_IDS.slice(3, 6).map((frameId, index) => [frameId, ["attack", index]]),
    ...FRAME_IDS.slice(6).map((frameId, index) => [frameId, ["death", index]])
  ]);
  const textureKeys = new Map();
  const keyFor = reference => {
    const url = String(reference || "");
    if (!textureKeys.has(url)) textureKeys.set(url, `g16-g5-${textureKeys.size}`);
    return textureKeys.get(url);
  };

  class G16G5Scene extends Phaser.Scene {
    constructor() { super({ key: "G16G5Scene" }); }
    assetKey(reference) { return keyFor(reference); }
    preload() {
      const urls = SHARED_PHASER_ASSET_RESOLVER.resolveAll(
        ["idle", "attack", "death"].flatMap(state => layerFrames[state].flatMap(frame => frame.map(layer => layer.url)))
      );
      urls.forEach(url => this.load.image(keyFor(url), `../../${url}`));
    }
    create() {
      const root = this.add.container(384, 684);
      heroRenderer = new HeroRenderer(this, {
        root,
        data: { layerFrames },
        displaySize: 768,
        textureKey: keyFor
      });
      heroRenderer.applyVisualFrame("idle", 0);
      const battleActor = new HeroActor(this, {
        id: "g16-g5-hero", name: "G16 Leather", kind: "hero", hp: 1, maxHp: 1,
        alive: true, visualMode: layerFrames.mode, layerFrames
      });
      battleActor.container.setVisible(false);
      const battleOrders = {};
      [["idle", 0], ["attack", 0], ["attack", 1], ["attack", 2], ["death", 0], ["death", 1]].forEach(([state, index]) => {
        battleActor.applyVisualFrame(state, index);
        battleOrders[`${state}_${index}`] = battleActor.heroRenderer.root.list
          .filter(image => image.visible)
          .map(image => battleActor.heroRenderer.layerImages.find(entry => entry.image === image)?.name)
          .filter(Boolean);
      });
      window.__g16G5BattleActorSmoke = { ready: true, orders: battleOrders };
      battleActor.destroy();
      window.__g16G5Ready = true;
      status.textContent = `ready:${game.renderer.type}`;
    }
  }

  game = new Phaser.Game({
    type: rendererMode,
    parent: "stage",
    width: 768,
    height: 768,
    transparent: true,
    backgroundColor: "rgba(0,0,0,0)",
    banner: false,
    audio: { noAudio: true },
    render: { antialias: true, pixelArt: false, roundPixels: false, preserveDrawingBuffer: true },
    scene: G16G5Scene
  });

  window.__g16G5SetFrame = async frameId => {
    if (!window.__g16G5Ready || !frameLookup[frameId]) throw new Error(`Unknown or unavailable frame: ${frameId}`);
    const [state, index] = frameLookup[frameId];
    heroRenderer.applyVisualFrame(state, index);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const layers = layerFrames[state][index].map(layer => ({ name: layer.name, crop: layer.crop || null }));
    const visibleOrder = heroRenderer.root.list
      .filter(image => image.visible)
      .map(image => heroRenderer.layerImages.find(entry => entry.image === image)?.name)
      .filter(Boolean);
    status.textContent = `${frameId}:${game.renderer.type}`;
    return { frameId, state, index, layers, visibleOrder, rendererType: game.renderer.type };
  };
  const imageDataFor = url => new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 768;
      canvas.height = 768;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      resolve(context.getImageData(0, 0, 768, 768));
    };
    image.onerror = () => reject(new Error(`Reference image failed: ${url}`));
    image.src = url;
  });
  const comparisonFrames = [];
  window.__g16G5Compare = async frameId => {
    const transition = await window.__g16G5SetFrame(frameId);
    if (game.renderer.type !== Phaser.CANVAS) {
      return { ...transition, comparison: "visual-only-webgl" };
    }
    const actual = game.canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, 768, 768);
    const approved = await imageDataFor(`../../docs/g16-leather-g2/g3/qa/${frameId}_composite.png`);
    let differingPixels = 0;
    let maximumChannelDelta = 0;
    let visibleDifferingPixels = 0;
    let maximumVisibleChannelDelta = 0;
    let alphaDifferingPixels = 0;
    let maximumAlphaDelta = 0;
    let alphaSupportDifferingPixels = 0;
    let premultipliedDifferingPixels = 0;
    let maximumPremultipliedDelta = 0;
    for (let offset = 0; offset < actual.data.length; offset += 4) {
      let pixelDiffers = false;
      let maximumPixelDelta = 0;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(actual.data[offset + channel] - approved.data[offset + channel]);
        maximumChannelDelta = Math.max(maximumChannelDelta, delta);
        maximumPixelDelta = Math.max(maximumPixelDelta, delta);
        pixelDiffers ||= delta !== 0;
      }
      if (pixelDiffers) differingPixels += 1;
      const actualAlpha = actual.data[offset + 3];
      const approvedAlpha = approved.data[offset + 3];
      if (actualAlpha || approvedAlpha) {
        if (pixelDiffers) visibleDifferingPixels += 1;
        maximumVisibleChannelDelta = Math.max(maximumVisibleChannelDelta, maximumPixelDelta);
      }
      const alphaDelta = Math.abs(actualAlpha - approvedAlpha);
      if (alphaDelta) alphaDifferingPixels += 1;
      maximumAlphaDelta = Math.max(maximumAlphaDelta, alphaDelta);
      if (!!actualAlpha !== !!approvedAlpha) alphaSupportDifferingPixels += 1;
      let premultipliedDiffers = alphaDelta !== 0;
      let maximumPixelPremultipliedDelta = alphaDelta;
      for (let channel = 0; channel < 3; channel += 1) {
        const actualPremultiplied = Math.round(actual.data[offset + channel] * actualAlpha / 255);
        const approvedPremultiplied = Math.round(approved.data[offset + channel] * approvedAlpha / 255);
        const delta = Math.abs(actualPremultiplied - approvedPremultiplied);
        premultipliedDiffers ||= delta !== 0;
        maximumPixelPremultipliedDelta = Math.max(maximumPixelPremultipliedDelta, delta);
      }
      if (premultipliedDiffers) premultipliedDifferingPixels += 1;
      maximumPremultipliedDelta = Math.max(maximumPremultipliedDelta, maximumPixelPremultipliedDelta);
    }
    comparisonFrames.push({ frameId, actual, approved });
    return { ...transition, comparison: "rgba-exact", differingPixels, maximumChannelDelta,
      visibleDifferingPixels, maximumVisibleChannelDelta, alphaDifferingPixels,
      maximumAlphaDelta, alphaSupportDifferingPixels, premultipliedDifferingPixels,
      maximumPremultipliedDelta };
  };
  const buildComparisonSheet = () => {
    const tile = 256;
    const labelHeight = 28;
    const canvas = document.createElement("canvas");
    canvas.width = tile * 3;
    canvas.height = comparisonFrames.length * (tile + labelHeight);
    const context = canvas.getContext("2d");
    context.fillStyle = "#d9dfe6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    comparisonFrames.forEach(({ frameId, actual, approved }, row) => {
      const y = row * (tile + labelHeight);
      const source = document.createElement("canvas");
      source.width = source.height = 768;
      const sourceContext = source.getContext("2d");
      sourceContext.putImageData(approved, 0, 0);
      context.drawImage(source, 0, y, tile, tile);
      sourceContext.putImageData(actual, 0, 0);
      context.drawImage(source, tile, y, tile, tile);
      const diff = sourceContext.createImageData(768, 768);
      for (let offset = 0; offset < diff.data.length; offset += 4) {
        const visible = actual.data[offset + 3] || approved.data[offset + 3];
        for (let channel = 0; channel < 3; channel += 1) {
          diff.data[offset + channel] = visible
            ? Math.min(255, Math.abs(actual.data[offset + channel] - approved.data[offset + channel]) * 8)
            : 0;
        }
        diff.data[offset + 3] = 255;
      }
      sourceContext.putImageData(diff, 0, 0);
      context.drawImage(source, tile * 2, y, tile, tile);
      context.fillStyle = "#172033";
      context.font = "15px system-ui, sans-serif";
      context.fillText(`${frameId} — approved G4`, 8, y + tile + 20);
      context.fillText("actual Phaser Canvas", tile + 8, y + tile + 20);
      context.fillText("visible RGBA diff ×8", tile * 2 + 8, y + tile + 20);
    });
    const dataUrl = canvas.toDataURL("image/png");
    document.getElementById("comparison-sheet").src = dataUrl;
    document.getElementById("comparison-download").href = dataUrl;
  };
  window.__g16G5CompareAll = async () => {
    const results = [];
    for (const frameId of FRAME_IDS) results.push(await window.__g16G5Compare(frameId));
    buildComparisonSheet();
    return results;
  };
  window.__g16G5Capture = () => game.canvas.toDataURL("image/png");
  (async () => {
    while (!window.__g16G5Ready) await new Promise(resolve => setTimeout(resolve, 25));
    const previewLayerFrames = Object.fromEntries(Object.entries(layerFrames).map(([name, value]) => [name,
      Array.isArray(value) ? value.map(frame => Array.isArray(frame) ? frame.map(layer => ({
        ...layer, url: `../../${layer.url}`
      })) : frame) : value
    ]));
    const previewReady = new Promise(resolve => {
      const previewHost = createHeroPreviewHost({
        mountNode: document.getElementById("preview-host"),
        snapshot: { hero: { layerFrames: previewLayerFrames, layers: previewLayerFrames.idle[0] } },
        onReady: ({ game: previewGame, scene }) => resolve({
          ready: true,
          rendererType: previewGame?.renderer?.type,
          visibleOrder: scene?.heroRenderer?.root?.list
            ?.filter(image => image.visible)
            ?.map(image => scene.heroRenderer.layerImages.find(entry => entry.image === image)?.name)
            ?.filter(Boolean) || []
        }),
        onError: error => resolve({ ready: false, error: error.message })
      });
      previewHost.mount();
      window.__g16G5PreviewHost = previewHost;
      setTimeout(() => resolve({ ready: false, error: "preview host timeout" }), 10000);
    });
    const battleReady = new Promise(resolve => {
      const battleHost = createBattlefieldHost({
        mountNode: document.getElementById("battle-host"),
        snapshot: {
          battleId: "g16-g5-smoke",
          hero: {
            id: "g16-g5-host-hero", name: "G16 Leather", kind: "hero",
            hp: 1, maxHp: 1, alive: true, anim: "idle",
            visualMode: previewLayerFrames.mode,
            layerFrames: previewLayerFrames,
            layers: previewLayerFrames.idle[0]
          },
          pet: null,
          monsters: []
        },
        onReady: ({ game: battleGame, scene }) => resolve({
          ready: true,
          rendererType: battleGame?.renderer?.type,
          visibleOrder: scene?.actors?.hero?.heroRenderer?.root?.list
            ?.filter(image => image.visible)
            ?.map(image => scene.actors.hero.heroRenderer.layerImages.find(entry => entry.image === image)?.name)
            ?.filter(Boolean) || []
        }),
        onError: error => resolve({ ready: false, error: error.message })
      });
      battleHost.mount();
      window.__g16G5BattlefieldHost = battleHost;
      setTimeout(() => resolve({ ready: false, error: "battlefield host timeout" }), 10000);
    });
    const results = await window.__g16G5CompareAll();
    const hostSmoke = {
      preview: await previewReady,
      battlefield: await battleReady,
      battleActor: window.__g16G5BattleActorSmoke
    };
    document.getElementById("result").textContent = JSON.stringify({ frames: results, hostSmoke }, null, 2);
    document.body.dataset.comparison = "complete";
  })().catch(error => {
    document.getElementById("result").textContent = `comparison error: ${error.message}`;
    document.body.dataset.comparison = "error";
  });
})().catch(error => {
  document.getElementById("status").textContent = `error:${error.message}`;
  window.__g16G5Error = String(error?.stack || error);
  throw error;
});
