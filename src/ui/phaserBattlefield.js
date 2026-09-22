// Phaser battlefield experiment.
// Presentation-only: Battle Core remains the sole gameplay resolver; preview deploys are isolated from production.
// Enabled only with ?phaserBattle=1 on the experiment branch.

const PHASER_RUNTIME_URL = "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js";
let phaserRuntimePromise = null;

function loadPhaserRuntime() {
  if (window.Phaser) return Promise.resolve(window.Phaser);
  if (phaserRuntimePromise) return phaserRuntimePromise;
  phaserRuntimePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-thornie-phaser="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Phaser), { once: true });
      existing.addEventListener("error", () => reject(new Error("Phaser runtime failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = PHASER_RUNTIME_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.thorniePhaser = "1";
    script.onload = () => window.Phaser ? resolve(window.Phaser) : reject(new Error("Phaser runtime missing after load"));
    script.onerror = () => reject(new Error("Phaser runtime failed to load"));
    document.head.appendChild(script);
  });
  return phaserRuntimePromise;
}

function phaserTextureKey(prefix, url) {
  let hash = 2166136261;
  const text = String(url || "");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

function ensurePhaserTexture(scene, key, url) {
  if (!url) return Promise.resolve(null);
  if (scene.textures.exists(key)) return Promise.resolve(key);
  return new Promise(resolve => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (!scene.sys?.isActive()) return resolve(null);
      if (!scene.textures.exists(key)) scene.textures.addImage(key, image);
      resolve(key);
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function phaserHpBar(scene, x, y, width, hp, maxHp) {
  const pct = Math.max(0, Math.min(1, Number(hp || 0) / Math.max(1, Number(maxHp || 1))));
  const bg = scene.add.rectangle(x, y, width, 7, 0x160d25, 0.88).setOrigin(0.5);
  bg.setStrokeStyle(1, 0xd8bd77, 0.7);
  const fillWidth = Math.max(0, (width - 2) * pct);
  const fill = scene.add.rectangle(x - width / 2 + 1, y, fillWidth, 5, 0x70d675, 1).setOrigin(0, 0.5);
  return [bg, fill];
}

async function renderPhaserBattleSnapshot(scene, snapshot, renderToken) {
  if (!scene.sys?.isActive()) return;
  if (scene.__thornieLayer) scene.__thornieLayer.destroy(true);
  const layer = scene.add.container(0, 0);
  scene.__thornieLayer = layer;

  const width = scene.scale.width;
  const height = scene.scale.height;
  const groundY = height * 0.78;
  const heroX = width * 0.22;
  const petX = width * 0.34;
  const monsterXs = snapshot.monsters.length === 1
    ? [width * 0.76]
    : snapshot.monsters.length === 2
      ? [width * 0.69, width * 0.83]
      : [width * 0.64, width * 0.77, width * 0.88];

  const ground = scene.add.ellipse(width / 2, groundY + 8, width * 0.82, Math.max(18, height * 0.08), 0x000000, 0.12);
  layer.add(ground);

  const heroConfig = getHeroV3Config("hero001");
  const heroSelection = heroVisualSelectionFromEquipment(snapshot.equipped || {});
  const heroFrame = snapshot.heroAnim === "attack" ? snapshot.frameTick % Math.max(1, heroConfig?.base?.attack?.length || 1) : 0;
  const heroLayers = resolveHeroV3Layers("hero001", heroSelection, snapshot.heroAnim || "idle", heroFrame) || [];
  const masterWidth = Number(heroConfig?.canvas?.width || 1254);
  const masterHeight = Number(heroConfig?.canvas?.height || 1254);
  const heroDisplay = Math.min(width * 0.24, height * 0.44);
  const heroScale = heroDisplay / Math.max(masterWidth, masterHeight);

  for (const heroLayer of heroLayers) {
    const key = phaserTextureKey("hero", heroLayer.url);
    const loaded = await ensurePhaserTexture(scene, key, heroLayer.url);
    if (!loaded || renderToken !== scene.__thornieRenderToken) continue;
    const img = scene.add.image(
      heroX + Number(heroLayer.x || 0) * heroScale,
      groundY - heroDisplay * 0.48 + Number(heroLayer.y || 0) * heroScale,
      loaded
    );
    img.setDisplaySize(masterWidth * heroScale, masterHeight * heroScale);
    img.setScale(img.scaleX * Number(heroLayer.scale || 1), img.scaleY * Number(heroLayer.scale || 1));
    img.setRotation(Number(heroLayer.rotation || 0) * Math.PI / 180);
    layer.add(img);
  }
  const heroLabel = scene.add.text(heroX, groundY + 22, snapshot.heroName || "Hero", {
    fontFamily: "system-ui, sans-serif", fontSize: Math.max(10, Math.round(width * 0.024)) + "px",
    color: "#fff4cf", stroke: "#1a1025", strokeThickness: 3
  }).setOrigin(0.5);
  layer.add(heroLabel);
  phaserHpBar(scene, heroX, groundY - heroDisplay * 0.58, Math.min(92, width * 0.22), snapshot.player.hp, snapshot.player.maxHp || snapshot.player.hp).forEach(o => layer.add(o));

  if (snapshot.petCombat) {
    const pet = snapshot.petCombat;
    const cfg = getPetSpriteConfig(pet.defId);
    const frames = getSpriteAnimationFrames(cfg, snapshot.petAnim || "idle", pet.hp <= 0);
    const src = frames.length ? frames[snapshot.frameTick % frames.length] : null;
    if (src) {
      const key = phaserTextureKey("pet", src);
      const loaded = await ensurePhaserTexture(scene, key, src);
      if (loaded && renderToken === scene.__thornieRenderToken) {
        const presentation = getPetPresentation(pet, cfg);
        const img = scene.add.image(petX, groundY - presentation.height * 0.42, loaded);
        const targetHeight = Math.min(height * 0.30, Math.max(74, presentation.height));
        img.setDisplaySize(img.width * (targetHeight / Math.max(1, img.height)), targetHeight);
        layer.add(img);
      }
    } else {
      layer.add(scene.add.text(petX, groundY - 28, pet.icon || "🐾", { fontSize: "34px" }).setOrigin(0.5));
    }
    layer.add(scene.add.text(petX, groundY + 20, pet.name || "Pet", {
      fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#dff7ff", stroke: "#1a1025", strokeThickness: 3
    }).setOrigin(0.5));
    phaserHpBar(scene, petX, groundY - 82, Math.min(76, width * 0.18), pet.hp, pet.maxHp).forEach(o => layer.add(o));
  }

  for (let i = 0; i < snapshot.monsters.length; i++) {
    const monster = snapshot.monsters[i];
    const x = monsterXs[Math.min(i, monsterXs.length - 1)];
    const cfg = getMonsterSpriteConfig(monster);
    const frames = getSpriteAnimationFrames(cfg, snapshot.enemyAnims?.[monster.uid] || "idle", monster.hp <= 0);
    const src = frames.length ? frames[snapshot.frameTick % frames.length] : null;
    let targetObject = null;
    if (src) {
      const key = phaserTextureKey("monster", src);
      const loaded = await ensurePhaserTexture(scene, key, src);
      if (loaded && renderToken === scene.__thornieRenderToken) {
        const presentation = getMonsterPresentation(monster);
        const img = scene.add.image(x, groundY - presentation.height * 0.48, loaded);
        const targetHeight = Math.min(height * 0.34, Math.max(58, presentation.height));
        img.setDisplaySize(img.width * (targetHeight / Math.max(1, img.height)), targetHeight);
        targetObject = img;
        layer.add(img);
      }
    }
    if (!targetObject) {
      targetObject = scene.add.circle(x, groundY - 32, 24, 0x7b5ec7, 0.95);
      layer.add(targetObject);
    }
    targetObject.setInteractive({ useHandCursor: true });
    targetObject.on("pointerup", () => snapshot.onSelectTarget?.(monster.uid));

    if (monster.uid === snapshot.targetUid && monster.hp > 0) {
      const ring = scene.add.ellipse(x, groundY + 4, 64, 18, 0x000000, 0);
      ring.setStrokeStyle(3, 0xffd166, 0.95);
      layer.add(ring);
    }
    layer.add(scene.add.text(x, groundY + 22, monster.name || "Monster", {
      fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#ffe9e9", stroke: "#1a1025", strokeThickness: 3
    }).setOrigin(0.5));
    phaserHpBar(scene, x, groundY - 86, Math.min(82, width * 0.19), monster.hp, monster.maxHp).forEach(o => layer.add(o));
  }

  const anchorFor = key => {
    if (key === "hero") return { x: heroX + width * 0.08, y: groundY - height * 0.16 };
    if (key === "pet") return { x: petX + width * 0.06, y: groundY - height * 0.11 };
    const idx = snapshot.monsters.findIndex(m => m.uid === key);
    if (idx >= 0) return { x: monsterXs[idx] - width * 0.05, y: groundY - height * 0.16 };
    return { x: width / 2, y: groundY - height * 0.16 };
  };

  for (const event of snapshot.battleVfx || []) {
    const frames = battleVfxFrames(event?.effectKey);
    if (!frames.length) continue;
    const src = frames[snapshot.frameTick % frames.length];
    const key = phaserTextureKey("vfx", src);
    const loaded = await ensurePhaserTexture(scene, key, src);
    if (!loaded || renderToken !== scene.__thornieRenderToken) continue;
    const anchor = anchorFor(event.targetKey);
    const img = scene.add.image(anchor.x, anchor.y, loaded);
    const targetWidth = Math.min(width * 0.30, 150);
    img.setDisplaySize(targetWidth, img.height * (targetWidth / Math.max(1, img.width)));
    img.setAlpha(0.95);
    layer.add(img);
  }

  if (renderToken !== scene.__thornieRenderToken) layer.destroy(true);
}

function PhaserBattlefieldPrototype({
  player,
  heroName,
  equipped,
  heroAnim,
  petCombat,
  petAnim,
  monsters,
  targetUid,
  onSelectTarget,
  enemyAnims,
  battleVfx,
  combatSpeed = 1
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const gameRef = useRef(null);
  const [runtimeError, setRuntimeError] = useState("");
  const [frameTick, setFrameTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setFrameTick(tick => (tick + 1) % 100000),
      Math.max(90, Math.round(190 / Math.max(1, combatSpeed || 1)))
    );
    return () => clearInterval(timer);
  }, [combatSpeed]);

  useEffect(() => {
    let cancelled = false;
    loadPhaserRuntime().then(Phaser => {
      if (cancelled || !mountRef.current) return;
      const scene = {
        create() {
          sceneRef.current = this;
        }
      };
      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: mountRef.current,
        transparent: true,
        backgroundColor: "rgba(0,0,0,0)",
        width: Math.max(320, mountRef.current.clientWidth || 320),
        height: Math.max(220, mountRef.current.clientHeight || 260),
        render: { antialias: true, pixelArt: false, roundPixels: true },
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene
      });
    }).catch(error => {
      if (!cancelled) setRuntimeError(error?.message || "Phaser failed to start");
    });
    return () => {
      cancelled = true;
      sceneRef.current = null;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !player) return;
    const renderToken = (scene.__thornieRenderToken || 0) + 1;
    scene.__thornieRenderToken = renderToken;
    renderPhaserBattleSnapshot(scene, {
      player: { ...player, maxHp: getStats(player, equipped).maxHp },
      heroName,
      equipped,
      heroAnim,
      petCombat,
      petAnim,
      monsters: monsters || [],
      targetUid,
      onSelectTarget,
      enemyAnims: enemyAnims || {},
      battleVfx: battleVfx || [],
      frameTick
    }, renderToken);
  }, [player, heroName, equipped, heroAnim, petCombat, petAnim, monsters, targetUid, onSelectTarget, enemyAnims, battleVfx, frameTick]);

  return /*#__PURE__*/React.createElement("div", {
    className: "md-phaser-battlefield",
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 3,
      overflow: "hidden",
      pointerEvents: "auto"
    }
  }, runtimeError
    ? /*#__PURE__*/React.createElement("div", {
        style: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#ffb0b0", fontSize: 12 }
      }, runtimeError)
    : /*#__PURE__*/React.createElement("div", {
        ref: mountRef,
        style: { width: "100%", height: "100%" }
      }));
}
