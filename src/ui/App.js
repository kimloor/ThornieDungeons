function ThornieDungeons() {
  // `account` holds the multi-character save (up to MAX_CHARACTER_SLOTS characters + shared
  // diamonds), built fresh from the server's responses every session. `save` keeps the flat
  // single-character shape ({gold, character:{...}, pets, ...}) — the "runtime view" of
  // whichever character slot is currently active — so every existing combat/shop/blacksmith/
  // inventory function below (which all read save.gold / save.character directly) needs zero
  // changes for multi-character support. See flattenCharacterForRuntime()/packRuntimeIntoSlot()
  // in state/save.js.
  const [account, setAccount] = useState(null);
  const [save, setSave] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading, login, characterSelect, menu, town, map, combat, result, defeat
  const [cred, setCred] = useState({
    url: "",
    id: "",
    password: ""
  });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [player, setPlayer] = useState(null); // ephemeral combat state, derived fresh from save each stage entry
  const [resumeRun, setResumeRun] = useState(null); // persisted current HP/MP + floor restored after entering a character
  const [equipped, setEquipped] = useState(emptyEquipped());
  const [inventory, setInventory] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(1);
  // Encounter now supports 1-3 monsters on the field at once.
  const [monsters, setMonsters] = useState([]);
  // Combat-only state for the Active Pet as a real unit on the field (HP, cooldown).
  const [petCombat, setPetCombat] = useState(null); // { instId, defId, name, icon, hp, maxHp, atk, def, speed, cooldown, active, passive, extra }
  const [targetUid, setTargetUid] = useState(null); // uid of the monster the player is currently targeting
  // Turn Order Queue UI: the planned action order for the current round (Player first,
  // then Pet + Monsters sorted by Speed), plus which unit's action is currently resolving.
  const [turnQueue, setTurnQueue] = useState([]); // [{key, kind, uid?, name, icon, speed}]
  const [activeTurnKey, setActiveTurnKey] = useState(null);
  const [log, setLogState] = useState(["Welcome to ThornieDungeons!"]);
  // Keeps the last 3 combat messages, newest first, so the log panel can show
  // a short scrolling history instead of overwriting a single line.
  const setLog = msg => setLogState(prev => [msg, ...prev].slice(0, 3));
  const [busy, setBusy] = useState(false);
  // Separate lock for item-mutating actions (Enhance/Empower/Reroll/Salvage/Sell/Equip/BuyMaterial).
  // itemActionLockRef is checked+set *synchronously* so a rapid second click can never slip in
  // and run against a stale `save`/`inventory` closure before the first click's state has
  // committed — the ref only unlocks on the next tick (after React has flushed the update),
  // not at the end of the (synchronous) handler itself. itemActionBusy is the render-visible
  // twin used to actually disable/gray out the buttons in the UI.
  const itemActionLockRef = useRef(false);
  const [itemActionBusy, setItemActionBusy] = useState(false);
  function guardItemAction(fn) {
    return (...args) => {
      if (itemActionLockRef.current) {
        return {
          ok: false,
          message: "⏳ กำลังดำเนินการอยู่ กรุณารอสักครู่..."
        };
      }
      itemActionLockRef.current = true;
      setItemActionBusy(true);
      try {
        return fn(...args);
      } finally {
        setTimeout(() => {
          itemActionLockRef.current = false;
          setItemActionBusy(false);
        }, 0);
      }
    };
  }
  const monstersRef = useRef([]);
  const petCombatRef = useRef(null);
  const playerRef = useRef(null);
  const combatOutcomeRef = useRef(null);
  useEffect(() => { monstersRef.current = monsters; }, [monsters]);
  useEffect(() => { petCombatRef.current = petCombat; }, [petCombat]);
  useEffect(() => { playerRef.current = player; }, [player]);
  const [heroAnim, setHeroAnim] = useState("");
  const [petAnim, setPetAnim] = useState("");
  const [enemyAnims, setEnemyAnims] = useState({}); // uid -> anim class
  const [floats, setFloats] = useState([]);
  const [dropItem, setDropItem] = useState(null);
  const [lastRewards, setLastRewards] = useState({
    gold: 0,
    xp: 0,
    leveledUp: false,
    unlockedNext: false,
    newSkill: null,
    newPet: null
  });
  const [invOpen, setInvOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [blacksmithOpen, setBlacksmithOpen] = useState(false);
  const [shopStock, setShopStock] = useState({
    potionPrice: 0,
    items: []
  });
  const [gachaResult, setGachaResult] = useState(null);
  const floatId = useRef(0);
  const potions = save ? save.potions : 0;
  useEffect(() => {
    (async () => {
      
      // โหลด R2 Asset Manifest ก่อนเริ่มระบบเกม
      try {
        await loadAssetManifest();
      } catch (err) {
        console.warn("R2 Asset Manifest failed to load:", err);
        ASSETS = {};
      }
      
      const cfg = await loadCachedConfig();
      setCred(c => ({
        ...c,
        url: DEFAULT_SERVER_URL,
        id: cfg.id || ""
      }));
      setPhase("login");

      // Prefer the latest server balance config; cache is only a fallback when offline.
      const freshConfig = await cloudGetConfig(DEFAULT_SERVER_URL);
      if (freshConfig && !freshConfig.error) {
        applyGameConfig(freshConfig);
        writeCachedGameConfig(freshConfig);
      } else {
        const cachedGameConfig = await loadCachedGameConfig();
        if (cachedGameConfig) applyGameConfig(cachedGameConfig);
      }
    })();
  }, []);
  const cloudWriteQueue = useRef(Promise.resolve());
  const enqueueCloudWrite = useCallback(task => {
    cloudWriteQueue.current = cloudWriteQueue.current
      .catch(() => {})
      .then(() => task())
      .catch(() => {});
    return cloudWriteQueue.current;
  }, []);
  // Each of these now targets ONE specific character (by characterId), matching the schema-v2
  // API worker where every character has its own real row — the server itself refuses (403s)
  // any of these if characterId doesn't actually belong to the authenticated account, so there's
  // no client-side "don't let this wipe another character" bookkeeping needed anymore (that used
  // to live here as otherSlotsRawItemsRef / the character-count safety net; both are gone now
  // that the server enforces isolation directly).
  const pushCharacterProgress = useCallback((characterId, diamonds, progress) => {
    if (!cred.url || !cred.id || !cred.password || !characterId) return;
    enqueueCloudWrite(() => cloudSaveCharacterProgress(cred.url, cred.id, cred.password, characterId, diamonds, progress));
  }, [cred, enqueueCloudWrite]);
  const pushItems = useCallback((inv, eq, characterId) => {
    if (!cred.url || !cred.id || !cred.password || !characterId) return;
    enqueueCloudWrite(() => cloudSyncItems(cred.url, cred.id, cred.password, characterId, itemsToServerList(inv, eq)));
  }, [cred, enqueueCloudWrite]);
  const pushRunState = useCallback((runState) => {
    // runState === undefined -> caller has nothing to save yet, skip.
    // runState === null -> explicit request to clear the checkpoint (both local + cloud).
    if (!cred.url || !cred.id || !cred.password || runState === undefined) return;
    const characterId = save && save.characterId;
    if (!characterId) return;
    const key = `thornie-run-${cred.id}-${characterId}`;
    try {
      if (runState === null) window.localStorage?.removeItem(key);
      else window.localStorage?.setItem(key, JSON.stringify(runState));
    } catch (e) {}
    enqueueCloudWrite(() => cloudSaveRunState(cred.url, cred.id, cred.password, characterId, runState));
  }, [cred, save, enqueueCloudWrite]);
  // Updates the runtime `save` view immediately, mirrors the change into the active character's
  // slot inside `account` (functional setState, so it always folds into the latest account
  // regardless of render timing), and pushes straight to that character's own row server-side.
  const persistSave = useCallback(next => {
    setSave(next);
    setAccount(prevAccount => {
      if (!prevAccount || prevAccount.activeSlot === null) return prevAccount;
      const characters = prevAccount.characters.slice();
      characters[prevAccount.activeSlot] = packRuntimeIntoSlot(characters[prevAccount.activeSlot], next);
      return {
        ...prevAccount,
        diamonds: next.diamonds,
        characters
      };
    });
    if (next.characterId) {
      pushCharacterProgress(next.characterId, next.diamonds, characterProgressToServer(next));
    }
  }, [pushCharacterProgress]);
  const persistItems = useCallback((inv, eq) => {
    if (save && save.characterId) pushItems(inv, eq, save.characterId);
  }, [pushItems, save]);
  function spawnFloat(side, text, color) {
    const id = ++floatId.current;
    setFloats(f => [...f, {
      id,
      side,
      text,
      color
    }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 900);
  }
  async function handleLogin() {
    setAuthError("");
    if (!cred.url || !cred.id || !cred.password) {
      setAuthError("กรอกให้ครบทุกช่องนะคะ");
      return;
    }
    setAuthBusy(true);
    const res = await cloudLogin(cred.url, cred.id, cred.password);
    setAuthBusy(false);
    if (res.error === "not_found") {
      setAuthError("ไม่พบ Player ID นี้ — กด \"สร้างบัญชีใหม่\" ก่อนนะคะ");
      return;
    }
    if (res.error === "wrong_password") {
      setAuthError("รหัสผ่านไม่ถูกต้อง");
      return;
    }
    if (res.error) {
      setAuthError("เชื่อมต่อ Server ไม่ได้ ลองใหม่อีกครั้ง");
      return;
    }
    writeCachedConfig({
      url: cred.url,
      id: cred.id
    });
    setAccount(accountFromLoginResponse(res));
    setPhase("characterSelect");
  }
  async function handleRegister() {
    setAuthError("");
    if (!cred.url || !cred.id || !cred.password) {
      setAuthError("กรอกให้ครบทุกช่องนะคะ");
      return;
    }
    setAuthBusy(true);
    const res = await cloudRegister(cred.url, cred.id, cred.password);
    setAuthBusy(false);
    if (res.error === "id_taken") {
      setAuthError("Player ID นี้มีคนใช้แล้ว ลองชื่ออื่น หรือกด \"เข้าสู่ระบบ\" ถ้าเป็นของคุณเอง");
      return;
    }
    if (res.error) {
      setAuthError("เชื่อมต่อ Server ไม่ได้ ลองใหม่อีกครั้ง");
      return;
    }
    writeCachedConfig({
      url: cred.url,
      id: cred.id
    });
    setAccount(defaultSave());
    setPhase("characterSelect");
  }
  async function handleCreateCharacter(slotIndex, name) {
    if (!account) return {
      ok: false,
      message: "กรุณาลองใหม่อีกครั้ง"
    };
    const cleanName = String(name || "").trim();
    const finalName = cleanName || `Character ${slotIndex + 1}`;
    // Instant client-side check first (better UX — no network round trip for the common case);
    // the server enforces the same rule authoritatively below regardless.
    if (isCharacterNameTaken(account, finalName)) {
      return {
        ok: false,
        message: "ชื่อนี้มีตัวละครอื่นในบัญชีใช้อยู่แล้ว ลองชื่ออื่นนะคะ"
      };
    }
    const res = await cloudCreateCharacter(cred.url, cred.id, cred.password, slotIndex, name);
    if (res.error === "name_taken") return {
      ok: false,
      message: "ชื่อนี้มีตัวละครอื่นในบัญชีใช้อยู่แล้ว ลองชื่ออื่นนะคะ"
    };
    if (res.error === "slot_occupied") return {
      ok: false,
      message: "ช่องนี้มีตัวละครอยู่แล้ว"
    };
    if (res.error) return {
      ok: false,
      message: "เชื่อมต่อ Server ไม่ได้ ลองใหม่อีกครั้ง"
    };
    setAccount(prev => {
      if (!prev) return prev;
      const characters = prev.characters.slice();
      characters[slotIndex] = characterFromServerRow(res.character);
      return {
        ...prev,
        characters
      };
    });
    return {
      ok: true,
      message: ""
    };
  }
  async function handleDeleteCharacter(slotIndex) {
    const res = await cloudDeleteCharacter(cred.url, cred.id, cred.password, slotIndex);
    if (res.error) {
      console.error("[ThornieDungeons] deleteCharacter failed:", res.error);
      return;
    }
    setAccount(prev => {
      if (!prev) return prev;
      const characters = prev.characters.slice();
      characters[slotIndex] = null;
      return {
        ...prev,
        characters,
        activeSlot: prev.activeSlot === slotIndex ? null : prev.activeSlot
      };
    });
  }
  async function enterCharacterSlot(slotIndex) {
    if (!account || !account.characters[slotIndex]) return;
    const res = await cloudEnterCharacter(cred.url, cred.id, cred.password, slotIndex);
    if (res.error) {
      console.error("[ThornieDungeons] enterCharacter failed:", res.error);
      return;
    }
    const characterSlot = characterFromServerRow(res.character);
    const nextAccount = (() => {
      const characters = account.characters.slice();
      characters[slotIndex] = characterSlot;
      return {
        ...account,
        characters,
        activeSlot: slotIndex
      };
    })();
    setAccount(nextAccount);
    const {
      equipped: eq,
      inventory: inv
    } = itemsFromServerList(res.items || []);
    setEquipped(eq);
    setInventory(inv);
    // Mid-combat resume checkpoint is namespaced per-character so switching characters never
    // shows a stale "resume at floor X" prompt left over from a different character's last run.
    // enterCharacter already returns this character's own run_state row directly (scoped
    // server-side by character_id) — localStorage is only the fallback if that's empty.
    const runKey = `thornie-run-${cred.id}-${characterSlot.id}`;
    let savedRun = null;
    const rs = res.runState;
    if (rs && (rs.hp !== undefined || rs.mp !== undefined)) {
      savedRun = {
        floor: Number(rs.floor) || 1,
        hp: Number(rs.hp),
        mp: Number(rs.mp)
      };
    } else {
      try {
        savedRun = safeJsonParse(window.localStorage?.getItem(runKey), null);
      } catch (e) {}
    }
    if (savedRun && Number.isFinite(savedRun.hp) && Number.isFinite(savedRun.mp)) {
      setResumeRun(savedRun);
      setSelectedFloor(savedRun.floor || 1);
    } else {
      setResumeRun(null);
    }
    setSave(flattenCharacterForRuntime(nextAccount, slotIndex));
    setPhase("menu");
  }
  function backToCharacterSelect() {
    // Fold any in-flight state back into the account before leaving, same as a normal save,
    // so switching characters never loses the last few seconds of progress.
    if (save) persistSave(save);
    setPlayer(null);
    setResumeRun(null);
    setPhase("characterSelect");
  }
  function logout() {
    // Same safety-net flush as backToCharacterSelect — leaving the account context
    // entirely should never skip the final sync, even though every mutation already
    // persists immediately on its own.
    if (save) persistSave(save);
    setCred(c => ({
      ...c,
      password: ""
    }));
    setAccount(null);
    setSave(null);
    setPlayer(null);
    setResumeRun(null);
    setAuthError("");
    setPhase("login");
  }
  function enterStage(floorNum, carryPlayer = null, options = {}) {
    const allowResume = options.allowResume !== false;
    combatOutcomeRef.current = null;
    setSelectedFloor(floorNum);
    const resumeCarry = allowResume && !carryPlayer && resumeRun && Number(resumeRun.floor) === Number(floorNum) ? resumeRun : null;
    const nextPlayer = freshPlayerFromSave(save, carryPlayer || resumeCarry);
    setPlayer(nextPlayer);
    // resumeRun is only meant to restore the session you left off at login.
    // Consume it on the very first stage entry no matter what (matched or
    // not) so a stale login-time checkpoint can never silently resurface
    // later in the session (e.g. on Retry Stage for a floor number that
    // happens to coincide with it).
    if (resumeRun) setResumeRun(null);
    pushRunState({
      floor: Number(floorNum) || 1,
      level: nextPlayer.level,
      xp: nextPlayer.xp,
      hp: nextPlayer.hp,
      mp: nextPlayer.mp,
      base_atk: nextPlayer.baseAtk,
      base_def: nextPlayer.baseDef,
      base_max_hp: nextPlayer.baseMaxHp,
      base_max_mp: nextPlayer.baseMaxMp
    });
    const spawned = makeEncounter(floorNum);
    setMonsters(spawned);
    setTargetUid(spawned[0] ? spawned[0].uid : null);
    const initialPet = buildPetCombatUnit();
    setPetCombat(initialPet);
    const initItems = [{ key: "player", kind: "player", name: "You", icon: "🧙", speed: nextPlayer.baseSpeed || 0 }];
    if (initialPet && initialPet.hp > 0) {
      initItems.push({ key: "pet", kind: "pet", name: initialPet.name, icon: initialPet.icon, speed: initialPet.speed });
    }
    spawned.forEach(m => {
      if (m.hp > 0) initItems.push({ key: m.uid, kind: "monster", uid: m.uid, name: m.name, icon: "👹", speed: m.speed });
    });
    const initRest = buildTurnQueue(initItems.filter(it => it.kind !== "player")).map(({ _r, ...r }) => r);
    setTurnQueue([initItems[0], ...initRest]);
    setActiveTurnKey(null);
    setDropItem(null);
    const boss = spawned.find(m => m.isBoss);
    setLog(boss ? `A ${boss.name} blocks the way!` : spawned.length > 1 ? `${spawned.length} monsters appear: ${spawned.map(m => m.name).join(", ")}!` : `A wild ${spawned[0].name} appears!`);
    setPhase("combat");
  }
  // Builds the Active Pet as a real combat unit (own HP/ATK/DEF/Speed) for this fight.
  function buildPetCombatUnit(carryHp = null) {
    const petActive = activePetInstance(save);
    if (!petActive) return null;
    const cs = petCombatStats(petActive.inst);
    return {
      instId: petActive.inst.instId,
      defId: petActive.def.id,
      name: petActive.def.name,
      icon: petActive.def.icon,
      active: petActive.def.active,
      passive: petActive.def.passive,
      extra: petActive.def.extra,
      maxHp: cs.maxHp,
      hp: Number.isFinite(carryHp) ? Math.max(0, Math.min(cs.maxHp, carryHp)) : cs.maxHp,
      atk: cs.atk,
      def: cs.def,
      speed: cs.speed,
      evasion: cs.evasion,
      hitRate: cs.hitRate,
      critChance: cs.critChance,
      cooldown: 0
    };
  }
  const runStateSaveTimer = useRef(null);
  function buildRunStateSnapshot(floor, p) {
    if (!p) return null;
    return {
      floor: Number(floor) || 1,
      level: Number(p.level) || 1,
      xp: Math.max(0, Number(p.xp) || 0),
      hp: Math.max(0, Number(p.hp) || 0),
      mp: Math.max(0, Number(p.mp) || 0),
      base_atk: Number(p.baseAtk) || 0,
      base_def: Number(p.baseDef) || 0,
      base_max_hp: Number(p.baseMaxHp) || 0,
      base_max_mp: Number(p.baseMaxMp) || 0
    };
  }
  function saveCombatRunState(floor, p) {
    const snapshot = buildRunStateSnapshot(floor, p);
    if (snapshot) pushRunState(snapshot);
  }
  useEffect(() => {
    if (!player || !cred.url || !cred.id || !cred.password || !save || combatOutcomeRef.current) return;
    if (runStateSaveTimer.current) clearTimeout(runStateSaveTimer.current);
    runStateSaveTimer.current = setTimeout(() => {
      if (!combatOutcomeRef.current) saveCombatRunState(selectedFloor, player);
    }, 150);
    return () => {
      if (runStateSaveTimer.current) clearTimeout(runStateSaveTimer.current);
    };
  }, [player?.hp, player?.mp, selectedFloor, cred.url, cred.id, cred.password, save, pushRunState]);

  function endCombatWin() {
    if (combatOutcomeRef.current) return;
    const currentMonsters = monstersRef.current.length ? monstersRef.current : monsters;
    const currentPlayer = playerRef.current || player;
    if (!currentMonsters.length || currentMonsters.some(m => m.hp > 0)) return;
    combatOutcomeRef.current = "victory";
    if (runStateSaveTimer.current) clearTimeout(runStateSaveTimer.current);
    setBusy(false);
    // Rewards aggregate across every monster that was on the field this encounter.
    const gained = currentMonsters.reduce((sum, m) => sum + m.gold, 0);
    const xpGained = currentMonsters.reduce((sum, m) => sum + m.xp, 0);
    const bossMonster = currentMonsters.find(m => m.isBoss) || null;
    const modifier = currentMonsters.map(m => m.modifier).find(Boolean) || null;
    // Equipment now only comes from a reward CHEST on boss floors (every 5th floor).
    // Regular monsters instead have a chance to drop a stack of junk material (stone/grass/
    // wood/iron/mana stone) used for crafting, selling, and the Enhancement/Empowerment systems.
    let drop = null;
    let junkDrop = null;
    let nextInvAfterCombat = inventory;
    let nextChestPity = save.chestPity || 0;
    if (bossMonster) {
      const chestRarity = rollChestRarity(bossMonster.isEliteBoss, nextChestPity);
      nextChestPity = chestRarity === "elite" || chestRarity === "mythic" ? 0 : nextChestPity + 1;
      drop = generateDrop(selectedFloor, {
        forceRarity: chestRarity
      });
      nextInvAfterCombat = [...inventory, drop];
    } else {
      // Each defeated monster in the pack gets its own independent roll for junk material.
      const junkDrops = [];
      currentMonsters.forEach(m => {
        const matChance = 0.45 + (currentPlayer.dropBonus || 0) / 100 + (m.modifier?.dropBonusFlat || 0) / 100;
        if (Math.random() < matChance) {
          const jd = rollJunkDrop(selectedFloor, m.modifier);
          junkDrops.push(jd);
          nextInvAfterCombat = addJunkToInventory(nextInvAfterCombat, jd.type, jd.amount);
        }
      });
      if (junkDrops.length) {
        // Combine same-type drops for a single summary banner.
        const merged = {};
        junkDrops.forEach(jd => { merged[jd.type] = (merged[jd.type] || 0) + jd.amount; });
        const [type, amount] = Object.entries(merged)[0];
        junkDrop = { type, amount };
      }
    }
    if (nextInvAfterCombat !== inventory) {
      setInventory(nextInvAfterCombat);
      persistItems(nextInvAfterCombat, equipped);
    }
    setDropItem(drop);
    const diamondsGained = bossMonster && bossMonster.isEliteBoss ? 20 + Math.round(selectedFloor / 2) : 0;
    let xp = save.character.xp + xpGained;
    let level = save.character.level;
    let statPoints = save.character.statPoints;
    let leveledUp = false;
    while (level < MAX_LEVEL && xp >= xpToNext(level)) {
      xp -= xpToNext(level);
      level += 1;
      statPoints += STAT_POINTS_PER_LEVEL;
      leveledUp = true;
    }
    if (level >= MAX_LEVEL) {
      level = MAX_LEVEL;
      xp = 0;
    }
    const newSkill = leveledUp ? SKILLS.find(s => s.unlockLevel > save.character.level && s.unlockLevel <= level) : null;
    const unlockedNext = selectedFloor === save.unlockedFloor;
    let newPets = save.pets;
    let newActivePetId = save.activePetId;
    let newPet = null;
    const alreadyHasStarter = (save.pets || []).some(p => p.defId === starterPetDef().id);
    if (selectedFloor === 5 && bossMonster && unlockedNext && !alreadyHasStarter) {
      const starter = starterPetDef();
      const inst = newPetInstance(starter.id);
      newPets = [...(save.pets || []), inst];
      if (!newActivePetId) newActivePetId = inst.instId;
      newPet = starter;
    }
    const nextSave = {
      ...save,
      gold: save.gold + gained,
      diamonds: save.diamonds + diamondsGained,
      unlockedFloor: unlockedNext ? save.unlockedFloor + 1 : save.unlockedFloor,
      chestPity: nextChestPity,
      character: {
        ...save.character,
        level,
        xp,
        statPoints
      },
      pets: newPets,
      activePetId: newActivePetId
    };
    // Commit the post-combat character state immediately. This is important because
    // `save` and `player` are React state values and are updated asynchronously.
    // Saving the checkpoint from the old state here can make HP/MP/XP appear to
    // roll back when the next stage is entered or the game is reloaded.
    persistSave(nextSave);
    const postBattlePlayer = freshPlayerFromSave(nextSave, {
      hp: currentPlayer.hp,
      mp: currentPlayer.mp
    });
    setPlayer(postBattlePlayer);
    saveCombatRunState(selectedFloor, postBattlePlayer);
    setLastRewards({
      gold: gained,
      xp: xpGained,
      leveledUp,
      unlockedNext,
      newSkill,
      newPet,
      isBoss: !!bossMonster,
      junkDrop,
      modifier,
      isEliteBoss: !!(bossMonster && bossMonster.isEliteBoss),
      diamonds: diamondsGained
    });
    setLog(newPet ? `Victory! You received a companion: ${newPet.name}!` : newSkill ? `Victory! Level up! New skill: ${newSkill.name}!` : leveledUp ? `Victory! Level up! +${gained}g` : `Victory! +${gained}g, +${xpGained}xp`);
    setPhase("result");
  }
  function playerLost() {
    if (combatOutcomeRef.current) return;
    combatOutcomeRef.current = "defeat";
    if (runStateSaveTimer.current) clearTimeout(runStateSaveTimer.current);
    setBusy(false);
    const currentPlayer = playerRef.current || player;
    if (currentPlayer) {
      const defeatedPlayer = { ...currentPlayer, hp: 0 };
      setPlayer(defeatedPlayer);
      // A defeat is also a completed combat. Persist HP=0 immediately so a
      // reload cannot restore an older HP checkpoint. Retry will overwrite it
      // with a fresh full-HP checkpoint when the stage is entered again.
      saveCombatRunState(selectedFloor, defeatedPlayer);
    }
    setLog("You were defeated...");
    setPhase("defeat");
  }
  // ---------- targeting helpers ----------
  function firstAliveMonster() {
    return monstersRef.current.find(m => m.hp > 0) || null;
  }
  function getTargetMonster() {
    const explicit = monstersRef.current.find(m => m.uid === targetUid && m.hp > 0);
    return explicit || firstAliveMonster();
  }
  function updateMonster(uid, updater) {
    setMonsters(ms => ms.map(m => m.uid === uid ? updater(m) : m));
  }
  function setMonsterAnim(uid, anim) {
    setEnemyAnims(prev => ({ ...prev, [uid]: anim }));
  }
  function selectTarget(uid) {
    const m = monstersRef.current.find(x => x.uid === uid);
    if (m && m.hp > 0) setTargetUid(uid);
  }
  // Builds the Turn Order Queue UI data for the round about to run: the Player
  // always resolves first (their action is tap-driven), followed by Active Pet
  // and every living Monster sorted by Speed (AGI-derived), highest first.
  function computeRoundQueueDisplay() {
    const p = playerRef.current || player;
    const items = [{ key: "player", kind: "player", name: "You", icon: "🧙", speed: (p && p.baseSpeed) || 0 }];
    const pet = petCombatRef.current;
    if (pet && pet.hp > 0) {
      items.push({ key: "pet", kind: "pet", name: pet.name, icon: pet.icon, speed: pet.speed });
    }
    monstersRef.current.forEach(m => {
      if (m.hp > 0) items.push({ key: m.uid, kind: "monster", uid: m.uid, name: m.name, icon: "👹", speed: m.speed });
    });
    const rest = buildTurnQueue(items.filter(it => it.kind !== "player")).map(({ _r, ...r }) => r);
    return [items[0], ...rest];
  }

  function playerTurn(action, skillKey) {
    if (busy || !player) return;
    const target = getTargetMonster();
    if ((action === "attack" || action === "skill") && !target) return;
    const stats = getStats(player, equipped);
    setBusy(true);
    // Lock in this round's Turn Order Queue the moment the player commits to an action,
    // so the queue bar reflects exactly what's about to resolve.
    setTurnQueue(computeRoundQueueDisplay());
    setActiveTurnKey("player");
    if (action === "attack") {
      const isMiss = Math.random() * 100 >= stats.accuracy;
      const isCrit = !isMiss && Math.random() * 100 < stats.critChance;
      let dmg = Math.max(2, Math.round(stats.atk - target.def * 0.6 + (Math.random() * 4 - 2)));
      if (isCrit) dmg = Math.round(dmg * (1 + stats.critDamage / 100));
      setHeroAnim("attack");
      setTimeout(() => {
        if (isMiss) {
          spawnFloat(target.uid, "MISS", "#B9AEDD");
          setLog(`You attack but miss ${target.name}!`);
        } else {
          updateMonster(target.uid, m => {
            const nh = Math.max(0, m.hp - dmg);
            spawnFloat(target.uid, isCrit ? `-${dmg} CRIT!` : `-${dmg}`, isCrit ? "#FFD166" : "#FF6B6B");
            setMonsterAnim(target.uid, "hurt");
            return { ...m, hp: nh };
          });
          setLog(isCrit ? `You land a CRITICAL hit on ${target.name} for ${dmg}!` : `You attack ${target.name} for ${dmg}!`);
        }
        setHeroAnim("");
        setTimeout(() => runQueueAfterPlayer(), 350);
      }, 300);
    } else if (action === "skill") {
      const skill = SKILLS.find(s => s.key === skillKey);
      if (!skill || player.mp < skill.mp) {
        setBusy(false);
        return;
      }
      const isMiss = skill.type === "damage" && Math.random() * 100 >= stats.accuracy;
      const isCrit = skill.type === "damage" && !isMiss && (skill.guaranteedCrit || Math.random() * 100 < stats.critChance);
      setPlayer(p => ({
        ...p,
        mp: p.mp - skill.mp
      }));
      setHeroAnim("attack");
      setTimeout(() => {
        if (skill.type === "damage") {
          if (isMiss) {
            spawnFloat(target.uid, "MISS", "#B9AEDD");
            setLog(`${skill.name} misses ${target.name}!`);
          } else {
            const pierce = skill.defPierce || 0;
            let dmg = Math.max(4, Math.round(stats.atk * skill.mult - target.def * (1 - pierce) * 0.6 + (Math.random() * 5 - 2)));
            if (isCrit) dmg = Math.round(dmg * (1 + stats.critDamage / 100));
            const freeze = skill.freezeChance ? Math.random() < skill.freezeChance : false;
            updateMonster(target.uid, m => {
              const nh = Math.max(0, m.hp - dmg);
              spawnFloat(target.uid, isCrit ? `-${dmg} CRIT!` : `-${dmg}`, isCrit ? "#FFD166" : "#8B6AE8");
              setMonsterAnim(target.uid, "hurt");
              const next = { ...m, hp: nh };
              if (freeze) next.frozenTurns = (m.frozenTurns || 0) + skill.freezeTurns;
              if (skill.poisonTurns) {
                next.poisonTurns = skill.poisonTurns;
                next.poisonDmg = Math.max(1, Math.round(stats.atk * skill.poisonPct));
              }
              return next;
            });
            setLog(freeze ? `${skill.name} freezes ${target.name} solid!` : `You use ${skill.name} on ${target.name} for ${dmg}${isCrit ? " (CRIT!)" : ""}!`);
          }
        } else if (skill.type === "heal") {
          setPlayer(p => {
            const heal = Math.round(stats.maxHp * skill.healPct);
            spawnFloat("hero", `+${heal}`, "#4CAF7D");
            return {
              ...p,
              hp: Math.min(stats.maxHp, p.hp + heal)
            };
          });
          setLog(`You cast ${skill.name} and recover HP.`);
        } else if (skill.type === "buffAtk") {
          setPlayer(p => ({
            ...p,
            atkBuffPct: skill.pct,
            atkBuffTurns: skill.turns
          }));
          spawnFloat("hero", "ATK UP", "#FFD166");
          setLog(`You cast ${skill.name}! ATK increased for ${skill.turns} turns.`);
        } else if (skill.type === "buffDef") {
          setPlayer(p => ({
            ...p,
            defBuffPct: skill.pct,
            defBuffTurns: skill.turns
          }));
          spawnFloat("hero", "DEF UP", "#7FB8E8");
          setLog(`You cast ${skill.name}! DEF increased for ${skill.turns} turns.`);
        }
        setHeroAnim("");
        setTimeout(() => runQueueAfterPlayer(), 350);
      }, 300);
    } else if (action === "item") {
      if (potions <= 0) {
        setBusy(false);
        return;
      }
      persistSave({
        ...save,
        potions: save.potions - 1
      });
      setPlayer(p => {
        const heal = Math.round(stats.maxHp * 0.4);
        spawnFloat("hero", `+${heal}`, "#4CAF7D");
        return {
          ...p,
          hp: Math.min(stats.maxHp, p.hp + heal)
        };
      });
      setLog("You drink a potion and recover HP.");
      setTimeout(() => runQueueAfterPlayer(), 500);
    } else if (action === "flee") {
      const success = Math.random() < 0.55;
      if (success) {
        setLog("You escaped safely.");
        setMonsters([]);
        setPetCombat(null);
        setTurnQueue([]);
        setActiveTurnKey(null);
        pushRunState(null);
        setPhase("map");
        setBusy(false);
      } else {
        setLog("Couldn't escape!");
        setTimeout(() => runQueueAfterPlayer(), 500);
      }
    }
  }
  // ---------- Round-based Initiative Queue ----------
  // After the player's own action resolves, every remaining living unit on the
  // field (Active Pet + all Monsters) takes its action in order of Speed (AGI),
  // highest first. Once the queue is drained, buffs/cooldowns tick and control
  // returns to the player for the next round.
  function runQueueAfterPlayer() {
    if (combatOutcomeRef.current) return;
    if (monstersRef.current.length && monstersRef.current.every(m => m.hp <= 0)) {
      endCombatWin();
      return;
    }
    const units = [];
    if (petCombatRef.current && petCombatRef.current.hp > 0) {
      units.push({ kind: "pet", speed: petCombatRef.current.speed });
    }
    monstersRef.current.forEach(m => {
      if (m.hp > 0) units.push({ kind: "monster", uid: m.uid, speed: m.speed });
    });
    const queue = buildTurnQueue(units);
    processQueue(queue, 0);
  }
  function processQueue(queue, index) {
    if (combatOutcomeRef.current) return;
    if (index >= queue.length) {
      setActiveTurnKey(null);
      if (monstersRef.current.length && monstersRef.current.every(m => m.hp <= 0)) {
        setTurnQueue([]);
        endCombatWin();
        return;
      }
      if ((playerRef.current?.hp || 0) <= 0) {
        setTurnQueue([]);
        playerLost();
        return;
      }
      setTurnQueue(computeRoundQueueDisplay());
      setBusy(false);
      tickPlayerBuffs();
      tickPetCooldown();
      return;
    }
    const unit = queue[index];
    setActiveTurnKey(unit.kind === "pet" ? "pet" : unit.uid);
    const advance = () => {
      if (combatOutcomeRef.current) return;
      // Check outcome immediately after every single action, not just at round end,
      // so combat stops the instant the player or all monsters are downed.
      if ((playerRef.current?.hp || 0) <= 0) {
        setActiveTurnKey(null);
        playerLost();
        return;
      }
      if (monstersRef.current.length && monstersRef.current.every(mm => mm.hp <= 0)) {
        setActiveTurnKey(null);
        endCombatWin();
        return;
      }
      processQueue(queue, index + 1);
    };
    if (unit.kind === "pet") {
      doPetAction(advance);
    } else {
      const m = monstersRef.current.find(mm => mm.uid === unit.uid);
      if (!m || m.hp <= 0) {
        advance();
        return;
      }
      doMonsterAction(m, advance);
    }
  }
  function doPetAction(cb) {
    const pet = petCombatRef.current;
    if (!pet || pet.hp <= 0 || pet.cooldown > 0) {
      cb();
      return;
    }
    const skill = pet.active;
    setPetCombat(p => p ? { ...p, cooldown: skill.cooldown } : p);
    setPetAnim("attack");
    setTimeout(() => {
      if (skill.type === "damage") {
        const target = firstAliveMonster();
        if (target) {
          let dmg = Math.max(2, Math.round(pet.atk * skill.mult - target.def * 0.5 + (Math.random() * 3 - 1)));
          const hasStun = pet.extra && pet.extra.type === "stun";
          const stun = hasStun ? Math.random() < pet.extra.pct : false;
          updateMonster(target.uid, m => {
            const nh = Math.max(0, m.hp - dmg);
            spawnFloat(target.uid, `${pet.icon}-${dmg}`, "#7FE0B0");
            setMonsterAnim(target.uid, "hurt");
            const next = { ...m, hp: nh };
            if (stun) next.frozenTurns = (m.frozenTurns || 0) + 1;
            return next;
          });
          setLog(stun ? `${pet.name} uses ${skill.name} and stuns ${target.name}!` : `${pet.name} uses ${skill.name} on ${target.name} for ${dmg}!`);
        }
      } else if (skill.type === "regen") {
        setPlayer(p => {
          if (!p) return p;
          const capStats = getStats(p, equipped);
          const heal = Math.round(capStats.maxHp * skill.regenPct);
          spawnFloat("hero", `+${heal}`, "#6FCF97");
          return {
            ...p,
            hp: Math.min(capStats.maxHp, p.hp + heal),
            regenAmount: heal,
            regenTurns: Math.max(0, skill.regenTurns - 1)
          };
        });
        setLog(`${pet.name} uses ${skill.name} on You!`);
      }
      setPetAnim("");
      setTimeout(() => cb(), 280);
    }, 220);
  }
  function doMonsterAction(m, cb) {
    if (combatOutcomeRef.current) {
      cb();
      return;
    }
    if (m.poisonTurns > 0) {
      const pdmg = m.poisonDmg || 0;
      const nh = Math.max(0, m.hp - pdmg);
      updateMonster(m.uid, mm => ({ ...mm, hp: nh, poisonTurns: mm.poisonTurns - 1 }));
      spawnFloat(m.uid, `-${pdmg} ☠️`, "#6FCF97");
      if (nh <= 0) {
        setLog(`${m.name} succumbed to poison!`);
        cb();
        return;
      }
      setLog(`${m.name} takes ${pdmg} poison damage!`);
    }
    const fresh = monstersRef.current.find(x => x.uid === m.uid) || m;
    if (fresh.frozenTurns > 0) {
      updateMonster(m.uid, mm => ({ ...mm, frozenTurns: mm.frozenTurns - 1 }));
      setLog(`${fresh.name} is frozen solid and can't move!`);
      cb();
      return;
    }
    const stats = getStats(playerRef.current || player, equipped);
    const pet = petCombatRef.current;
    const canHitPet = pet && pet.hp > 0;
    // Monsters mostly go for the player, but may occasionally swing at the pet instead.
    const targetIsPet = canHitPet && Math.random() < 0.3;
    setMonsterAnim(m.uid, "attack");
    setTimeout(() => {
      if (combatOutcomeRef.current) {
        setMonsterAnim(m.uid, "");
        cb();
        return;
      }
      if (targetIsPet) {
        const dodged = Math.random() * 100 < (pet.evasion || 0);
        const dmg = dodged ? 0 : Math.max(1, Math.round(fresh.atk - pet.def * 0.6 + (Math.random() * 3 - 1)));
        if (dodged) {
          spawnFloat("pet", "MISS", "#B9AEDD");
          setLog(`${pet.name} dodged ${fresh.name}'s attack!`);
        } else {
          setPetCombat(p => p ? { ...p, hp: Math.max(0, p.hp - dmg) } : p);
          spawnFloat("pet", `-${dmg}`, "#FF6B6B");
          setPetAnim("hurt");
          setLog(`${fresh.name} strikes your ${pet.name} for ${dmg}!`);
        }
      } else {
        const hasGuard = pet && pet.hp > 0 && pet.extra && pet.extra.type === "block";
        const blocked = hasGuard && Math.random() < pet.extra.pct;
        const dodged = !blocked && Math.random() * 100 < stats.dodgeChance;
        const dmg = blocked || dodged ? 0 : Math.max(1, Math.round(fresh.atk - stats.def * 0.6 + (Math.random() * 3 - 1)));
        if (blocked) {
          spawnFloat("hero", "BLOCKED 🛡️", "#B9AEDD");
          setLog(`${pet.name} blocked the attack!`);
        } else if (dodged) {
          spawnFloat("hero", "MISS", "#B9AEDD");
          setLog(`You dodged ${fresh.name}'s attack!`);
        } else {
          const hasStatusWard = pet && pet.passive && pet.passive.type === "statusResist";
          const resisted = hasStatusWard && Math.random() < pet.passive.pct;
          const weakenProc = fresh.isBoss && !resisted && Math.random() < 0.25;
          const currentPlayer = playerRef.current || player;
          const nh = Math.max(0, currentPlayer.hp - dmg);
          setPlayer(p => {
            if (!p || combatOutcomeRef.current) return p;
            const next = { ...p, hp: nh };
            setHeroAnim("hurt");
            if (weakenProc && nh > 0) {
              next.weakenPct = 0.2;
              next.weakenTurns = 2;
            }
            return next;
          });
          spawnFloat("hero", `-${dmg}`, "#FF6B6B");
          setLog(weakenProc && nh > 0 ? `${fresh.name} strikes You for ${dmg} and weakens you!` : `${fresh.name} strikes You for ${dmg}!`);
        }
      }
      setMonsterAnim(m.uid, "");
      setHeroAnim("");
      setPetAnim("");
      cb();
    }, 300);
  }
  function tickPlayerBuffs() {
    setPlayer(p => {
      if (!p) return p;
      const next = {
        ...p
      };
      if (next.atkBuffTurns > 0) {
        next.atkBuffTurns -= 1;
        if (next.atkBuffTurns === 0) next.atkBuffPct = 0;
      }
      if (next.defBuffTurns > 0) {
        next.defBuffTurns -= 1;
        if (next.defBuffTurns === 0) next.defBuffPct = 0;
      }
      if (next.weakenTurns > 0) {
        next.weakenTurns -= 1;
        if (next.weakenTurns === 0) next.weakenPct = 0;
      }
      if (next.hp > 0 && next.regenTurns > 0 && next.regenAmount > 0 && !combatOutcomeRef.current) {
        const capStats = getStats(next, equipped);
        next.hp = Math.min(capStats.maxHp, next.hp + next.regenAmount);
        next.regenTurns -= 1;
        spawnFloat("hero", `+${next.regenAmount}`, "#6FCF97");
      }
      return next;
    });
  }
  function tickPetCooldown() {
    setPetCombat(p => p && p.cooldown > 0 ? { ...p, cooldown: p.cooldown - 1 } : p);
  }
  function retryStage() {
    // Defeat means HP hit 0 — always start the retry fully healed, since
    // carrying 0 HP over would just mean an instant loss again.
    combatOutcomeRef.current = null;
    enterStage(selectedFloor, null, { allowResume: false });
  }
  function retryStageAfterWin() {
    // Retrying a stage you just cleared keeps your real current HP/MP,
    // same rule as advancing to the next stage — no free heal.
    combatOutcomeRef.current = null;
    enterStage(selectedFloor, player, { allowResume: false });
  }
  function backToMap() {
    combatOutcomeRef.current = null;
    setMonsters([]);
    setPetCombat(null);
    setDropItem(null);
    pushRunState(null);
    setPhase("map");
  }
  function nextStage() {
    // Dungeon run rule: carry the current HP/MP into the next stage.
    combatOutcomeRef.current = null;
    enterStage(selectedFloor + 1, player);
  }
  function addStatPoint(key) {
    if (save.character.statPoints <= 0) return;
    const nextStats = {
      ...save.character.stats,
      [key]: save.character.stats[key] + 1
    };
    persistSave({
      ...save,
      character: {
        ...save.character,
        statPoints: save.character.statPoints - 1,
        stats: nextStats
      }
    });
  }
  function equipItem(item) {
    const slot = item.type;
    const prevItem = equipped[slot];
    const newEq = {
      ...equipped,
      [slot]: item
    };
    let nextInv = inventory.filter(i => i.id !== item.id);
    if (prevItem) nextInv = [...nextInv, prevItem];
    setEquipped(newEq);
    setInventory(nextInv);
    persistItems(nextInv, newEq);
  }
  function unequipItem(slot) {
    const item = equipped[slot];
    if (!item) return;
    const newEq = {
      ...equipped,
      [slot]: null
    };
    const nextInv = [...inventory, item];
    setEquipped(newEq);
    setInventory(nextInv);
    persistItems(nextInv, newEq);
  }
  function sellItem(item) {
    const price = sellPrice(item);
    const nextInv = inventory.filter(i => i.id !== item.id);
    setInventory(nextInv);
    persistItems(nextInv, equipped);
    persistSave({
      ...save,
      gold: save.gold + price
    });
  }
  function findItemAndLocation(itemId) {
    for (const slot of SLOT_ORDER) {
      if (equipped[slot] && equipped[slot].id === itemId) return {
        item: equipped[slot],
        location: "equipped",
        slot
      };
    }
    const index = inventory.findIndex(i => i.id === itemId);
    if (index >= 0) return {
      item: inventory[index],
      location: "inventory",
      index
    };
    return null;
  }
  function applyItemUpdate(itemId, updater) {
    const found = findItemAndLocation(itemId);
    if (!found) return;
    const updated = updater({
      ...found.item,
      empowerSlots: [...(found.item.empowerSlots || [])]
    });
    let nextEquipped = equipped,
      nextInventory = inventory;
    if (found.location === "equipped") {
      nextEquipped = {
        ...equipped,
        [found.slot]: updated
      };
      setEquipped(nextEquipped);
    } else {
      nextInventory = inventory.map((it, i) => i === found.index ? updated : it);
      setInventory(nextInventory);
    }
    persistItems(nextInventory, nextEquipped);
  }
  function enhanceItem(itemId) {
    const found = findItemAndLocation(itemId);
    if (!found) return {
      ok: false,
      message: "ไม่พบไอเทม"
    };
    const it = found.item;
    const level = it.enhanceLevel || 0;
    if (level >= ENHANCE_MAX) return {
      ok: false,
      message: "ตีบวกถึงระดับสูงสุดแล้ว (+" + ENHANCE_MAX + ")"
    };
    const cost = enhanceCost(level);
    if (junkTotal(inventory, "iron") < cost.iron || save.gold < cost.gold) {
      return {
        ok: false,
        message: `วัตถุดิบ/ทองไม่พอ (ต้องการ 🔩${cost.iron} 🪙${cost.gold})`
      };
    }
    const invAfterCost = removeJunkFromInventory(inventory, "iron", cost.iron);
    setInventory(invAfterCost);
    persistItems(invAfterCost, equipped);
    persistSave({
      ...save,
      gold: save.gold - cost.gold
    });
    const success = Math.random() * 100 < enhanceSuccessRate(level);
    const riskDowngrade = !success && level >= ENHANCE_DOWNGRADE_LEVEL;
    const stones = save.protectionStones || 0;
    const useStone = riskDowngrade && stones > 0;
    if (useStone) {
      persistSave({
        ...save,
        gold: save.gold - cost.gold,
        protectionStones: stones - 1
      });
    }
    if (success) {
      applyItemUpdate(itemId, prev => ({
        ...prev,
        enhanceLevel: level + 1
      }));
      return {
        ok: true,
        message: `✨ ตีบวกสำเร็จ! ${it.name} +${level + 1}`
      };
    }
    if (riskDowngrade && !useStone) {
      const newLevel = Math.max(0, level - 1);
      applyItemUpdate(itemId, prev => ({
        ...prev,
        enhanceLevel: newLevel
      }));
      return {
        ok: false,
        message: `💥 ตีบวกล้มเหลว! ${it.name} ร่วงเหลือ +${newLevel}`
      };
    }
    if (useStone) {
      return {
        ok: false,
        message: `🛡️ ตีบวกล้มเหลว แต่หินป้องกันช่วยไว้! ${it.name} ยังคง +${level}`
      };
    }
    return {
      ok: false,
      message: `💢 ตีบวกล้มเหลว... (${it.name} ยังคง +${level})`
    };
  }
  function toggleEmpowerLock(itemId, slotIndex) {
    applyItemUpdate(itemId, prev => {
      const slots = [...(prev.empowerSlots || [])];
      const s = slots[slotIndex];
      if (!s) return prev;
      slots[slotIndex] = {
        ...s,
        locked: !s.locked
      };
      return {
        ...prev,
        empowerSlots: slots
      };
    });
  }
  function rerollEmpowerItem(itemId) {
    const found = findItemAndLocation(itemId);
    if (!found) return {
      ok: false,
      message: "ไม่พบไอเทม"
    };
    const it = found.item;
    const slots = it.empowerSlots || [];
    const filled = slots.filter(Boolean);
    if (!filled.length) return {
      ok: false,
      message: "ยังไม่มีออฟชั่นให้รีรอล"
    };
    const lockedCount = filled.filter(s => s.locked).length;
    if (lockedCount === filled.length) return {
      ok: false,
      message: "ล็อกไว้ทุกออฟชั่นแล้ว ไม่มีอะไรให้รีรอล"
    };
    const cost = rerollCost(filled.length, lockedCount);
    if (junkTotal(inventory, "manaOre") < cost.manaOre || save.gold < cost.gold) {
      return {
        ok: false,
        message: `หินมานา/ทองไม่พอสำหรับรีรอล (ต้องการ 🔮${cost.manaOre} 🪙${cost.gold})`
      };
    }
    const invAfterCost = removeJunkFromInventory(inventory, "manaOre", cost.manaOre);
    setInventory(invAfterCost);
    persistItems(invAfterCost, equipped);
    persistSave({
      ...save,
      gold: save.gold - cost.gold
    });
    applyItemUpdate(itemId, prev => {
      const nextSlots = (prev.empowerSlots || []).map(s => {
        if (!s || s.locked) return s;
        return rollEmpowerBonus(prev.rarity);
      });
      return {
        ...prev,
        empowerSlots: nextSlots
      };
    });
    return {
      ok: true,
      message: `🔄 รีรอลออฟชั่นสำเร็จ! (ใช้ 🔮${cost.manaOre} 🪙${cost.gold}, ล็อกไว้ ${lockedCount} ช่อง)`
    };
  }
  function salvageItem(itemId) {
    const found = findItemAndLocation(itemId);
    if (!found) return {
      ok: false,
      message: "ไม่พบไอเทม"
    };
    if (found.location === "equipped") return {
      ok: false,
      message: "ถอดอุปกรณ์ก่อนแยกชิ้นส่วน"
    };
    const it = found.item;
    const y = salvageYield(it.rarity);
    let nextInv = inventory.filter(i => i.id !== itemId);
    nextInv = addJunkToInventory(nextInv, "iron", y.iron);
    nextInv = addJunkToInventory(nextInv, "manaOre", y.manaOre);
    setInventory(nextInv);
    persistItems(nextInv, equipped);
    return {
      ok: true,
      message: `♻️ แยกชิ้นส่วนได้ 🔩${y.iron} 🔮${y.manaOre}`
    };
  }
  function buyProtectionStone() {
    if (save.diamonds < PROTECTION_STONE_PRICE) return;
    persistSave({
      ...save,
      diamonds: save.diamonds - PROTECTION_STONE_PRICE,
      protectionStones: (save.protectionStones || 0) + 1
    });
  }
  function buyMaterial(type) {
    const price = MATERIAL_SHOP_PRICE[type];
    if (!price || save.gold < price) return;
    const nextInv = addJunkToInventory(inventory, type, 1);
    setInventory(nextInv);
    persistItems(nextInv, equipped);
    persistSave({
      ...save,
      gold: save.gold - price
    });
  }
  function empowerItem(itemId) {
    const found = findItemAndLocation(itemId);
    if (!found) return {
      ok: false,
      message: "ไม่พบไอเทม"
    };
    const it = found.item;
    const slots = it.empowerSlots || [];
    const nextIndex = slots.findIndex(s => !s);
    if (nextIndex === -1) return {
      ok: false,
      message: "เสริมพลังครบทุกออฟชั่นแล้ว"
    };
    const cost = empowerCost(nextIndex);
    if (junkTotal(inventory, "manaOre") < cost.manaOre || save.gold < cost.gold) {
      return {
        ok: false,
        message: `หินมานา/ทองไม่พอ (ต้องการ 🔮${cost.manaOre} 🪙${cost.gold})`
      };
    }
    const invAfterCost = removeJunkFromInventory(inventory, "manaOre", cost.manaOre);
    setInventory(invAfterCost);
    persistItems(invAfterCost, equipped);
    persistSave({
      ...save,
      gold: save.gold - cost.gold
    });
    const bonus = rollEmpowerBonus(it.rarity);
    applyItemUpdate(itemId, prev => {
      const nextSlots = [...(prev.empowerSlots || [])];
      nextSlots[nextIndex] = bonus;
      return {
        ...prev,
        empowerSlots: nextSlots
      };
    });
    return {
      ok: true,
      message: `🔮 เสริมพลังสำเร็จ! ได้รับ ${bonus.icon} +${bonus.value} ${bonus.label}`
    };
  }
  function openShop() {
    setShopStock(generateShopStock(save.unlockedFloor));
    setShopOpen(true);
  }
  function buyShopItem(item) {
    if (save.gold < item.price) return;
    const {
      price,
      ...pureItem
    } = item;
    const nextInv = [...inventory, pureItem];
    setInventory(nextInv);
    persistItems(nextInv, equipped);
    persistSave({
      ...save,
      gold: save.gold - item.price
    });
    setShopStock(s => ({
      ...s,
      items: s.items.filter(i => i.id !== item.id)
    }));
  }
  function buyShopPotion() {
    if (save.gold < shopStock.potionPrice) return;
    persistSave({
      ...save,
      gold: save.gold - shopStock.potionPrice,
      potions: save.potions + 1
    });
  }
  function equipPet(instId) {
    persistSave({
      ...save,
      activePetId: instId
    });
  }
  function unequipPet() {
    persistSave({
      ...save,
      activePetId: null
    });
  }
  function claimTestDiamonds() {
    persistSave({
      ...save,
      diamonds: save.diamonds + 500
    });
  }
  function pullGacha() {
    if (save.diamonds < GACHA_COST) return;
    const won = rollGachaPet();
    const already = (save.pets || []).some(p => p.defId === won.id);
    if (already) {
      // duplicate — refund partial diamonds as shards
      persistSave({
        ...save,
        diamonds: save.diamonds - GACHA_COST + 30
      });
      setGachaResult({
        pet: won,
        duplicate: true
      });
      return;
    }
    const inst = newPetInstance(won.id);
    const nextPets = [...(save.pets || []), inst];
    const nextActivePetId = save.activePetId || inst.instId;
    persistSave({
      ...save,
      diamonds: save.diamonds - GACHA_COST,
      pets: nextPets,
      activePetId: nextActivePetId
    });
    setGachaResult({
      pet: won,
      duplicate: false
    });
  }
  if (phase === "loading") {
    return /*#__PURE__*/React.createElement("div", {
      className: "md-root",
      style: {
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("style", null, STYLE), /*#__PURE__*/React.createElement("p", {
      className: "md-display",
      style: {
        color: "var(--gold)",
        fontWeight: 800
      }
    }, "Loading dungeon..."));
  }
  if (phase === "login" || (!save && phase !== "characterSelect")) {
    return /*#__PURE__*/React.createElement("div", {
      className: "md-root"
    }, /*#__PURE__*/React.createElement("style", null, STYLE), /*#__PURE__*/React.createElement(Starfield, null), /*#__PURE__*/React.createElement(LoginScreen, {
      cred: cred,
      setCred: setCred,
      error: authError,
      busy: authBusy,
      onLogin: handleLogin,
      onRegister: handleRegister
    }));
  }
  if (phase === "characterSelect") {
    return /*#__PURE__*/React.createElement("div", {
      className: "md-root"
    }, /*#__PURE__*/React.createElement("style", null, STYLE), /*#__PURE__*/React.createElement(Starfield, null), /*#__PURE__*/React.createElement(CharacterSelectScreen, {
      account: account,
      onEnter: enterCharacterSlot,
      onCreate: handleCreateCharacter,
      onDelete: handleDeleteCharacter,
      onLogout: logout
    }));
  }
  const charStats = characterBaseStats(save);
  const eqBonus = getEquipBonus(equipped);
  const outOfCombatStats = {
    atk: charStats.atk + eqBonus.atk,
    def: charStats.def + eqBonus.def,
    maxHp: charStats.maxHp + eqBonus.hp,
    maxMp: charStats.maxMp + eqBonus.mp,
    accuracy: charStats.accuracy,
    critChance: charStats.critChance,
    dodgeChance: charStats.dodgeChance
  };
  const cp = combatPower(player ? getStats(player, equipped) : outOfCombatStats, save.character.level);
  return /*#__PURE__*/React.createElement("div", {
    className: "md-root"
  }, /*#__PURE__*/React.createElement("style", null, STYLE), /*#__PURE__*/React.createElement(Starfield, null), phase !== "menu" && phase !== "login" && phase !== "combat" && /*#__PURE__*/React.createElement(StatusBar, {
    player: player,
    save: save,
    phase: phase,
    equipped: equipped
  }), phase === "menu" && /*#__PURE__*/React.createElement(HubScreen, {
    save: save,
    cp: cp,
    playerId: cred.id,
    onTown: () => setPhase("town"),
    onMap: () => setPhase("map"),
    onOpenInv: () => setInvOpen(true),
    onShop: openShop,
    onEnhance: () => setBlacksmithOpen(true),
    onPets: () => setPhase("pets"),
    onSave: () => persistSave(save),
    onSwitchCharacter: backToCharacterSelect,
    onLogout: logout
  }), phase === "town" && /*#__PURE__*/React.createElement(StatusScreen, {
    save: save,
    charStats: charStats,
    onAddStat: addStatPoint,
    onOpenInv: () => setInvOpen(true),
    onMap: () => setPhase("map"),
    onOpenPets: () => setPhase("pets"),
    onOpenSkill: () => setPhase("skill"),
    onBack: () => setPhase("menu")
  }), phase === "skill" && /*#__PURE__*/React.createElement(SkillScreen, {
    save: save,
    onBack: () => setPhase("town")
  }), phase === "map" && /*#__PURE__*/React.createElement(MapScreen, {
    unlockedFloor: save.unlockedFloor,
    hp: player ? player.hp : outOfCombatStats.maxHp,
    maxHp: outOfCombatStats.maxHp,
    mp: player ? player.mp : outOfCombatStats.maxMp,
    maxMp: outOfCombatStats.maxMp,
    // Same rule as nextStage/retryStageAfterWin: if there's a live player object
    // sitting in state (from the last stage you fought, incl. a flee), carry its
    // real current HP/MP into the newly-selected stage instead of full-healing —
    // Stage Select should only ever full-heal when there's truly no run to continue.
    onSelectFloor: floorNum => enterStage(floorNum, player),
    onSave: () => persistSave(save),
    onBack: () => setPhase("menu")
  }), phase === "pets" && /*#__PURE__*/React.createElement(PetScreen, {
    save: save,
    onEquip: equipPet,
    onUnequip: unequipPet,
    onOpenGacha: () => setPhase("gacha"),
    onBack: () => setPhase("menu")
  }), phase === "gacha" && /*#__PURE__*/React.createElement(GachaScreen, {
    save: save,
    gachaResult: gachaResult,
    onClearGachaResult: () => setGachaResult(null),
    onGacha: pullGacha,
    onClaimDiamonds: claimTestDiamonds,
    onBack: () => setPhase("pets")
  }), phase === "combat" && monsters.length > 0 && player && /*#__PURE__*/React.createElement(CombatScreen, {
    player: player,
    monsters: monsters,
    targetUid: targetUid,
    onSelectTarget: selectTarget,
    log: log,
    busy: busy,
    potions: potions,
    heroAnim: heroAnim,
    petAnim: petAnim,
    enemyAnims: enemyAnims,
    floats: floats,
    onAction: playerTurn,
    equipped: equipped,
    petCombat: petCombat,
    turnQueue: turnQueue,
    activeTurnKey: activeTurnKey
  }), phase === "result" && /*#__PURE__*/React.createElement(ResultScreen, {
    floor: selectedFloor,
    rewards: lastRewards,
    dropItem: dropItem,
    onNext: nextStage,
    onRetry: retryStageAfterWin,
    onMap: backToMap,
    onOpenInv: () => setInvOpen(true)
  }), phase === "defeat" && /*#__PURE__*/React.createElement(DefeatScreen, {
    floor: selectedFloor,
    onRetry: retryStage,
    onMap: backToMap
  }), invOpen && /*#__PURE__*/React.createElement(InventoryOverlay, {
    equipped: equipped,
    inventory: inventory,
    busy: itemActionBusy,
    gold: save.gold,
    diamonds: save.diamonds,
    protectionStones: save.protectionStones || 0,
    onEquip: guardItemAction(equipItem),
    onUnequip: guardItemAction(unequipItem),
    onSell: guardItemAction(sellItem),
    onSalvage: guardItemAction(salvageItem),
    onClose: () => setInvOpen(false)
  }), blacksmithOpen && /*#__PURE__*/React.createElement(BlacksmithOverlay, {
    equipped: equipped,
    inventory: inventory,
    busy: itemActionBusy,
    onEnhance: guardItemAction(enhanceItem),
    onEmpower: guardItemAction(empowerItem),
    onReroll: guardItemAction(rerollEmpowerItem),
    onToggleLock: toggleEmpowerLock,
    onOpenInventory: () => { setBlacksmithOpen(false); setInvOpen(true); },
    onClose: () => setBlacksmithOpen(false)
  }), shopOpen && /*#__PURE__*/React.createElement(ShopOverlay, {
    gold: save.gold,
    diamonds: save.diamonds,
    protectionStones: save.protectionStones || 0,
    stock: shopStock,
    onBuyItem: buyShopItem,
    onBuyPotion: buyShopPotion,
    onBuyProtectionStone: buyProtectionStone,
    onBuyMaterial: guardItemAction(buyMaterial),
    onClose: () => setShopOpen(false)
  }));
}
