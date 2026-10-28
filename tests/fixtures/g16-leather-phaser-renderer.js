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
  window.__g16G5Compare = async frameId => {
    const transition = await window.__g16G5SetFrame(frameId);
    if (game.renderer.type !== Phaser.CANVAS) {
      return { ...transition, comparison: "visual-only-webgl" };
    }
    const actual = game.canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, 768, 768);
    const approved = await imageDataFor(`../../docs/g16-leather-g2/g3/qa/${frameId}_composite.png`);
    let differingPixels = 0;
    let maximumChannelDelta = 0;
    for (let offset = 0; offset < actual.data.length; offset += 4) {
      let pixelDiffers = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(actual.data[offset + channel] - approved.data[offset + channel]);
        maximumChannelDelta = Math.max(maximumChannelDelta, delta);
        pixelDiffers ||= delta !== 0;
      }
      if (pixelDiffers) differingPixels += 1;
    }
    return { ...transition, comparison: "rgba-exact", differingPixels, maximumChannelDelta };
  };
  window.__g16G5CompareAll = async () => {
    const results = [];
    for (const frameId of FRAME_IDS) results.push(await window.__g16G5Compare(frameId));
    return results;
  };
  window.__g16G5Capture = () => game.canvas.toDataURL("image/png");
  (async () => {
    while (!window.__g16G5Ready) await new Promise(resolve => setTimeout(resolve, 25));
    const results = await window.__g16G5CompareAll();
    document.getElementById("result").textContent = JSON.stringify(results, null, 2);
    document.body.dataset.comparison = "complete";
  })();
})().catch(error => {
  document.getElementById("status").textContent = `error:${error.message}`;
  window.__g16G5Error = String(error?.stack || error);
  throw error;
});
