// Battle logs are session-only UI data. Checkpoints keep the deterministic combat state and
// log sequence, but never copy the readable log history into D1.
function battleCheckpointWithoutLog(checkpoint) {
  return checkpoint ? { ...checkpoint, log: [] } : checkpoint;
}

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
  const [phase, setPhase] = useState("loading"); // loading, login, characterSelect, menu, town, character, map, combat, result, defeat
  // Screens reachable from both Main Hub and Town return to the place that opened them.
  // This avoids hard-coding every Back button to Main Hub now that Town is a real hub too.
  const [characterReturnPhase, setCharacterReturnPhase] = useState("menu");
  const [petReturnPhase, setPetReturnPhase] = useState("menu");
  const [gachaReturnPhase, setGachaReturnPhase] = useState("pets");
  const [utilityReturnPhase, setUtilityReturnPhase] = useState("menu");
  // One-shot deep link set only by Friend's "Chat" action, consumed once by ChatScreen on
  // mount to open straight into that DM thread. Every other way of opening Chat clears
  // this first so a stale target can't resurface later.
  const [chatDirectTarget, setChatDirectTarget] = useState(null);
  // True only when character selection follows a successful login/register. It lets the
  // screen bridge from the login artwork without replaying that transition when switching
  // characters from inside the game.
  const [characterSelectEntry, setCharacterSelectEntry] = useState(false);
  const [loginTransitioning, setLoginTransitioning] = useState(false);
  const [cred, setCred] = useState({
    url: "",
    id: "",
    password: ""
  });
  const [rememberLogin, setRememberLogin] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [registrationRecovery, setRegistrationRecovery] = useState(null);
  const [passwordResetRecovery, setPasswordResetRecovery] = useState(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [recoveryConfigured, setRecoveryConfigured] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState("saved");
  const [persistenceMessage, setPersistenceMessage] = useState("");
  const persistenceRef = useRef(null);
  if (!persistenceRef.current) {
    persistenceRef.current = createPersistenceManager({
      onStatusChange: (status, detail) => {
        setPersistenceStatus(status);
        setPersistenceMessage(status === "failed"
          ? `บันทึก Cloud ไม่สำเร็จ (${detail?.error?.code || "unknown_error"})`
          : "");
      }
    });
  }
  const [player, setPlayer] = useState(null); // ephemeral combat state, derived fresh from save each stage entry
  const [resumeRun, setResumeRun] = useState(null); // persisted current HP/MP + floor restored after entering a character
  const [resumeBattle, setResumeBattle] = useState(null); // Battle V1 safe Action-boundary checkpoint
  const [battleState, setBattleState] = useState(null);
  const battleStateRef = useRef(null);
  const lastSafeBattleCheckpointRef = useRef(null);
  const confirmedBattleCheckpointRef = useRef({ battleId: null, safeActionSeq: -1 });
  const finishingBattleIdRef = useRef(null);
  const [battleFinishing, setBattleFinishing] = useState(false);
  const [equipped, setEquipped] = useState(emptyEquipped());
  const [inventory, setInventory] = useState([]);
  const [inventoryOverflow, setInventoryOverflow] = useState([]);
  const equippedRef = useRef(equipped);
  const inventoryRef = useRef(inventory);
  const inventoryOverflowRef = useRef(inventoryOverflow);
  const [selectedFloor, setSelectedFloor] = useState(1);
  // Encounter now supports 1-3 monsters on the field at once.
  const [monsters, setMonsters] = useState([]);
  // Combat-only state for the Active Pet as a real unit on the field (HP, cooldown).
  const [petCombat, setPetCombat] = useState(null); // { instId, defId, name, icon, hp, maxHp, atk, def, speed, cooldown, active, passive, extra }
  const [targetUid, setTargetUid] = useState(null); // uid of the monster the player is currently targeting
  // Turn Order Queue UI mirrors the Battle Core's deterministic Speed queue for
  // the current round, plus which unit's action is currently resolving.
  const [turnQueue, setTurnQueue] = useState([]); // [{key, kind, uid?, name, icon, speed}]
  const [activeTurnKey, setActiveTurnKey] = useState(null);
  const [log, setLogState] = useState([]);
  const [finishedBattleLog, setFinishedBattleLog] = useState([]);
  // Keep the current battle history newest-first. CombatScreen renders only the latest three
  // until the player opens the full log.
  const setLog = msg => setLogState(prev => [msg, ...prev].slice(0, 120));
  const [busy, setBusy] = useState(false);
  const [battleVfx, setBattleVfx] = useState([]);
  const battleVfxSeqRef = useRef(0);
  // Combat presentation speed. x1 keeps authored frame timing; x2 shortens the
  // action windows without changing damage, turn order, or cooldown rules.
  const [combatSpeed, setCombatSpeed] = useState(1);
  // The header's last cell is a large speed button for the opening rounds,
  // then becomes Skip after five player turns.
  const [combatTurnCount, setCombatTurnCount] = useState(0);
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
  const turnQueueRef = useRef([]);
  const combatOutcomeRef = useRef(null);
  useEffect(() => { monstersRef.current = monsters; }, [monsters]);
  useEffect(() => { petCombatRef.current = petCombat; }, [petCombat]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { equippedRef.current = equipped; }, [equipped]);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { inventoryOverflowRef.current = inventoryOverflow; }, [inventoryOverflow]);
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
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [shopStock, setShopStock] = useState({
    potions: [],
    items: []
  });
  const [gachaResult, setGachaResult] = useState(null);
  const floatId = useRef(0);
  // 4 combat quick slots — { kind: "skill", key } | { kind: "potion", potionId } | null.
  // Loaded/saved locally per-character (see loadQuickSlots/saveQuickSlotsLocal in save.js).
  const [quickSlots, setQuickSlots] = useState([null, null, null, null]);
  // Daily login streak state — backed by the real thornie-dungeons-api worker
  // (getDailyLogin/claimDailyLogin), fetched fresh each time a character is entered.
  const [dailyLogin, setDailyLogin] = useState({ state: { loginStreak: 0, lastClaimDate: "", totalClaims: 0 }, canClaim: false, preview: { streak: 1, reward: {} } });
  const [dailyLoginClaimResult, setDailyLoginClaimResult] = useState(null);
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
        id: cfg.id || "",
        password: ""
      }));
      setRememberLogin(false);
      setPhase("login");

      const rememberedSession = await AUTH_SESSION.load();
      if (rememberedSession) {
        const sessionResult = await cloudValidateSession(DEFAULT_SERVER_URL);
        if (sessionResult?.ok) {
          setCred({ url: DEFAULT_SERVER_URL, id: sessionResult.playerId, password: "" });
          setRememberLogin(!!rememberedSession.rememberLogin);
          setRecoveryConfigured(!!sessionResult.recoveryConfigured);
          writeCachedConfig({ url: DEFAULT_SERVER_URL, id: sessionResult.playerId });
          await beginCharacterSelect(accountFromLoginResponse(sessionResult));
        } else if (sessionResult?.error === "network_error") {
          setAuthError("เชื่อมต่อ Server ไม่ได้ — Session เดิมยังไม่ถูกลบ กรุณาลองใหม่");
        }
      }

      // Prefer the latest server balance config; cache is only a fallback when offline.
      const freshConfig = await cloudGetConfig(DEFAULT_SERVER_URL);
      if (freshConfig && !freshConfig.error) {
        applyGameConfig(freshConfig);
        writeCachedGameConfig(freshConfig);
      } else {
        const cachedGameConfig = await loadCachedGameConfig();
        if (cachedGameConfig) applyGameConfig(cachedGameConfig);
      }

      // Phase 4 refactor — recipes come from D1 now, not a hardcoded array, so new
      // crafted sets can go live with just an insert. Same fetch-then-cache-fallback
      // shape as the balance config above.
      const freshRecipes = await cloudGetRecipes(DEFAULT_SERVER_URL);
      if (freshRecipes && !freshRecipes.error && Array.isArray(freshRecipes.recipes)) {
        applyRecipes(freshRecipes.recipes);
        writeCachedRecipes(freshRecipes.recipes);
      } else {
        const cachedRecipes = await loadCachedRecipes();
        if (cachedRecipes) applyRecipes(cachedRecipes);
      }

      // Per-monster loot tables — same fetch-then-cache-fallback shape as recipes above.
      const freshMonsterLoot = await cloudGetMonsterLoot(DEFAULT_SERVER_URL);
      if (freshMonsterLoot && !freshMonsterLoot.error && freshMonsterLoot.monsterLoot) {
        applyMonsterLoot(freshMonsterLoot.monsterLoot);
        writeCachedMonsterLoot(freshMonsterLoot.monsterLoot);
      } else {
        const cachedMonsterLoot = await loadCachedMonsterLoot();
        if (cachedMonsterLoot) applyMonsterLoot(cachedMonsterLoot);
      }

      // Material names/icons (admin.html) — merges into the built-in JUNK_INFO defaults.
      const freshJunkInfo = await cloudGetJunkInfo(DEFAULT_SERVER_URL);
      if (freshJunkInfo && !freshJunkInfo.error && freshJunkInfo.junkInfo) {
        applyJunkInfo(freshJunkInfo.junkInfo);
        writeCachedJunkInfo(freshJunkInfo.junkInfo);
      } else {
        const cachedJunkInfo = await loadCachedJunkInfo();
        if (cachedJunkInfo) applyJunkInfo(cachedJunkInfo);
      }
    })();
  }, []);
  const persistenceContextFor = useCallback(characterId => makePersistenceContext({
    url: cred.url,
    accountId: cred.id,
    characterId,
    credential: { kind: "session_token" },
    sessionGeneration: AUTH_SESSION.getGeneration()
  }), [cred]);
  // Each of these now targets ONE specific character (by characterId), matching the schema-v2
  // API worker where every character has its own real row — the server itself refuses (403s)
  // any of these if characterId doesn't actually belong to the authenticated account, so there's
  // no client-side "don't let this wipe another character" bookkeeping needed anymore (that used
  // to live here as otherSlotsRawItemsRef / the character-count safety net; both are gone now
  // that the server enforces isolation directly).
  const pushCharacterProgress = useCallback((characterId, diamonds, progress) => {
    const context = persistenceContextFor(characterId);
    if (!context || !AUTH_SESSION.getToken()) return Promise.resolve(false);
    return persistenceRef.current.enqueue(context, "character_progress", { diamonds, progress }, (snapshot, owner) =>
      cloudSaveSnapshot(owner, "character_progress", snapshot));
  }, [persistenceContextFor]);
  const pushItems = useCallback((inv, eq, ov, characterId) => {
    const context = persistenceContextFor(characterId);
    if (!context || !AUTH_SESSION.getToken()) return Promise.resolve(false);
    return persistenceRef.current.enqueue(context, "items", itemsToServerList(inv, eq, ov), (snapshot, owner) =>
      cloudSaveSnapshot(owner, "items", snapshot));
  }, [persistenceContextFor]);

  const persistInventorySnapshot = useCallback((inv, eq, ov) => {
    if (save?.characterId) return pushItems(inv, eq, ov, save.characterId);
    return Promise.resolve(false);
  }, [pushItems, save]);

  const commitInventorySnapshot = useCallback((snapshot, eq = equippedRef.current) => {
    inventoryRef.current = snapshot.inventory;
    inventoryOverflowRef.current = snapshot.overflow;
    equippedRef.current = eq;
    setInventory(snapshot.inventory);
    setInventoryOverflow(snapshot.overflow);
    setEquipped(eq);
    persistInventorySnapshot(snapshot.inventory, eq, snapshot.overflow);
    return snapshot;
  }, [persistInventorySnapshot]);

  // Capacity-safe insertion boundary: battle, mail, daily, shop and crafting rewards
  // all use this path so a full bag can only move items to persistent Overflow.
  const insertCarriedItems = useCallback((items, inventoryBase = inventoryRef.current, eq = equippedRef.current) => {
    return commitInventorySnapshot(
      insertInventoryItems(inventoryBase, inventoryOverflowRef.current, items, INVENTORY_CAPACITY),
      eq
    );
  }, [commitInventorySnapshot]);
  // Applies a claimed mail's reward into local state (gold/diamonds/junk). The existing
  // autosave effect below then persists it via the normal saveCharacterProgress/syncItems
  // flow — the server never touches characters/items directly for rewards (see worker
  // mailbox comment), so this is the only place a mail reward actually "lands".
  const applyMailReward = useCallback((reward) => {
    if (!reward) return;
    if (reward.gold || reward.diamonds) {
      setSave(s => s && ({
        ...s,
        gold: s.gold + (Number(reward.gold) || 0),
        diamonds: s.diamonds + (Number(reward.diamonds) || 0)
      }));
    }
    const incoming = [];
    (reward.junk || []).forEach(j => incoming.push({ ...makeJunkItem(j.junkId, 1), quantity: Number(j.quantity) || 1 }));
    (reward.items || []).forEach(item => incoming.push(materializeMailItem(item)));
    if (incoming.length) insertCarriedItems(incoming);
  }, [insertCarriedItems]);
  const pushRunState = useCallback((runState) => {
    // runState === undefined -> caller has nothing to save yet, skip.
    // runState === null -> explicit request to clear the checkpoint (both local + cloud).
    if (!cred.url || !cred.id || !AUTH_SESSION.getToken() || runState === undefined) return Promise.resolve(false);
    const characterId = save && save.characterId;
    if (!characterId) return Promise.resolve(false);
    const key = `thornie-run-${cred.id}-${characterId}`;
    try {
      if (runState === null) window.localStorage?.removeItem(key);
      else window.localStorage?.setItem(key, JSON.stringify(runState));
    } catch (e) {}
    const context = persistenceContextFor(characterId);
    return persistenceRef.current.enqueue(context, "run_state", runState, (snapshot, owner) =>
      cloudSaveSnapshot(owner, "run_state", snapshot));
  }, [cred, save, persistenceContextFor]);
  const pushBattleCheckpoint = useCallback((checkpoint) => {
    if (!checkpoint || !save?.characterId || !AUTH_SESSION.getToken()) return Promise.resolve(false);
    const context = persistenceContextFor(save.characterId);
    const checkpointSnapshot = battleCheckpointWithoutLog(checkpoint);
    const pending = persistenceRef.current.enqueue(context, "battle_checkpoint", checkpointSnapshot, (snapshot, owner) =>
      cloudSaveSnapshot(owner, "battle_checkpoint", snapshot));
    pending.then(saved => {
      if (!saved) return;
      const confirmed = confirmedBattleCheckpointRef.current;
      if (confirmed.battleId !== checkpoint.battleId || checkpoint.safeActionSeq > confirmed.safeActionSeq) {
        confirmedBattleCheckpointRef.current = { battleId: checkpoint.battleId, safeActionSeq: checkpoint.safeActionSeq };
      }
    });
    return pending;
  }, [save?.characterId, persistenceContextFor]);
  const pushQuickSlots = useCallback((slots) => {
    if (!save?.characterId || !AUTH_SESSION.getToken()) return Promise.resolve(false);
    const context = persistenceContextFor(save.characterId);
    return persistenceRef.current.enqueue(context, "quick_slots", slots, (snapshot, owner) =>
      cloudSaveSnapshot(owner, "quick_slots", snapshot));
  }, [save?.characterId, persistenceContextFor]);
  useEffect(() => AUTH_SESSION.onInvalid((reason) => {
    const context = save?.characterId ? persistenceContextFor(save.characterId) : null;
    if (context) persistenceRef.current.invalidate(context);
    persistenceRef.current.setActiveContext(null);
    setAccount(null);
    setSave(null);
    setPlayer(null);
    setInventory([]);
    setInventoryOverflow([]);
    closeTransientOverlays();
    setCred(current => ({ ...current, password: "" }));
    setAuthError(reason === "session_replaced"
      ? "บัญชีนี้ถูกเข้าสู่ระบบจากอุปกรณ์อื่น"
      : reason === "session_expired" ? "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" : "Session ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
    setPhase("login");
  }), [save?.characterId, persistenceContextFor]);
  useEffect(() => {
    if (!save?.characterId) return undefined;
    const retryCurrent = () => {
      if (document.visibilityState && document.visibilityState !== "visible") return;
      void persistenceRef.current.retry(persistenceContextFor(save.characterId));
    };
    window.addEventListener("online", retryCurrent);
    document.addEventListener("visibilitychange", retryCurrent);
    return () => {
      window.removeEventListener("online", retryCurrent);
      document.removeEventListener("visibilitychange", retryCurrent);
    };
  }, [save?.characterId, persistenceContextFor]);
  useEffect(() => {
    if (phase !== "combat") return undefined;
    const rootStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previous = {
      rootOverflow: rootStyle.overflow,
      rootOverscroll: rootStyle.overscrollBehavior,
      bodyOverflow: bodyStyle.overflow,
      bodyOverscroll: bodyStyle.overscrollBehavior
    };
    rootStyle.overflow = "hidden";
    rootStyle.overscrollBehavior = "none";
    bodyStyle.overflow = "hidden";
    bodyStyle.overscrollBehavior = "none";
    return () => {
      rootStyle.overflow = previous.rootOverflow;
      rootStyle.overscrollBehavior = previous.rootOverscroll;
      bodyStyle.overflow = previous.bodyOverflow;
      bodyStyle.overscrollBehavior = previous.bodyOverscroll;
    };
  }, [phase]);
  useEffect(() => {
    if (!save?.characterId || !cred.url) return undefined;
    const persistSafeBattleBoundary = () => {
      const checkpoint = battleStateRef.current;
      if (checkpoint && !checkpoint.result) void cloudSaveBattleCheckpointOnClose(cred.url, save.characterId, battleCheckpointWithoutLog(checkpoint));
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") persistSafeBattleBoundary(); };
    window.addEventListener("pagehide", persistSafeBattleBoundary);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", persistSafeBattleBoundary);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cred.url, save?.characterId]);
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
    if (next.characterId) return pushCharacterProgress(next.characterId, next.diamonds, characterProgressToServer(next));
    return Promise.resolve(false);
  }, [pushCharacterProgress]);
  // Raid responses arrive asynchronously, so deduct from the latest save snapshot and persist
  // immediately. A plain setSave() here used to leave the server balance unchanged until some
  // later manual save/logout and could lose the charge if Safari closed first.
  const spendRaidDiamonds = useCallback(amount => {
    const cost = Math.max(0, Number(amount) || 0);
    if (!cost) return;
    setSave(current => {
      if (!current) return current;
      const next = { ...current, diamonds: Math.max(0, (Number(current.diamonds) || 0) - cost) };
      setAccount(prevAccount => {
        if (!prevAccount || prevAccount.activeSlot === null) return prevAccount;
        const characters = prevAccount.characters.slice();
        characters[prevAccount.activeSlot] = packRuntimeIntoSlot(characters[prevAccount.activeSlot], next);
        return { ...prevAccount, diamonds: next.diamonds, characters };
      });
      if (next.characterId) {
        pushCharacterProgress(next.characterId, next.diamonds, characterProgressToServer(next));
      }
      return next;
    });
  }, [pushCharacterProgress]);
  const persistItems = useCallback((inv, eq, ov = inventoryOverflowRef.current) => {
    inventoryRef.current = inv;
    equippedRef.current = eq;
    inventoryOverflowRef.current = ov;
    return persistInventorySnapshot(inv, eq, ov);
  }, [persistInventorySnapshot]);
  // Applies a server-confirmed craft result (see CraftingOverlay/handleCraftItem): the
  // server already validated+consumed materials/gold on ITS copy of the items/characters
  // rows, so this only needs to mirror that same removal locally, add the crafted item,
  // then push the resulting inventory/gold back up so both sides stay in sync.
  const applyCraftResult = useCallback((res) => {
    if (!res || !res.item) return;
    let next = inventoryRef.current;
    (res.consumed || []).forEach(m => {
      next = removeJunkFromInventory(next, m.junkId, m.qty) || next;
    });
    insertCarriedItems([materializeMailItem(res.item)], next);
    if (res.goldSpent) {
      persistSave({ ...save, gold: Math.max(0, save.gold - res.goldSpent) });
    }
  }, [insertCarriedItems, save, persistSave]);
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
  function handleRememberLogin(checked) {
    setRememberLogin(checked);
  }
  async function beginCharacterSelect(nextAccount) {
    setAccount(nextAccount);
    setLoginTransitioning(true);
    // Give Safari a committed login-screen frame before changing routes. Reduced-motion
    // users still receive a short cross-fade, without the first-person camera push.
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    await new Promise(resolve => setTimeout(resolve, reduceMotion ? 280 : 1250));
    setCharacterSelectEntry(true);
    setPhase("characterSelect");
    setLoginTransitioning(false);
  }
  async function handleLogin() {
    setAuthError("");
    if (!cred.url || !cred.id || !cred.password) {
      setAuthError("กรอกให้ครบทุกช่องนะคะ");
      return;
    }
    setAuthBusy(true);
    const res = await cloudLogin(cred.url, cred.id, cred.password, rememberLogin);
    setAuthBusy(false);
    if (res.error === "invalid_credentials") {
      setAuthError("Player ID หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    if (res.error) {
      setAuthError("เชื่อมต่อ Server ไม่ได้ ลองใหม่อีกครั้ง");
      return;
    }
    await AUTH_SESSION.setSession(res, rememberLogin);
    setCred(c => ({ ...c, id: res.playerId, password: "" }));
    setRecoveryConfigured(!!res.recoveryConfigured);
    writeCachedConfig({ url: cred.url, id: res.playerId });
    await beginCharacterSelect(accountFromLoginResponse(res));
  }
  async function handleRegister(form) {
    setAuthError("");
    if (!cred.url || !form?.id || !form?.password || !form?.confirmPassword) {
      setAuthError("กรอกให้ครบทุกช่องนะคะ");
      return { ok: false, error: "missing_fields" };
    }
    setAuthBusy(true);
    const res = await cloudRegister(cred.url, form.id, form.password, form.confirmPassword, rememberLogin);
    setAuthBusy(false);
    if (res.error === "id_unavailable") {
      setAuthError("Player ID นี้ไม่สามารถใช้งานได้");
      return { ok: false, error: res.error };
    }
    if (res.error) {
      setAuthError("เชื่อมต่อ Server ไม่ได้ ลองใหม่อีกครั้ง");
      return { ok: false, error: res.error };
    }
    await AUTH_SESSION.setSession(res, rememberLogin);
    setCred(c => ({ ...c, id: res.playerId, password: "" }));
    setRecoveryConfigured(true);
    writeCachedConfig({ url: cred.url, id: res.playerId });
    setRegistrationRecovery({ code: res.recoveryCode, account: defaultSave() });
    return { ok: true };
  }
  async function finishRegistrationRecovery() {
    const pending = registrationRecovery;
    setRegistrationRecovery(null);
    if (pending) await beginCharacterSelect(pending.account);
  }
  async function handleForgotPassword(form) {
    setAuthBusy(true);
    const res = await cloudForgotPassword(cred.url || DEFAULT_SERVER_URL, form.id, form.recoveryCode, form.newPassword, form.confirmPassword);
    setAuthBusy(false);
    if (!res?.ok) return { ok: false, error: res?.error || "network_error" };
    await AUTH_SESSION.clear("password_reset", false);
    setCred(c => ({ ...c, id: form.id, password: "" }));
    setPasswordResetRecovery(res.recoveryCode);
    writeCachedConfig({ url: cred.url || DEFAULT_SERVER_URL, id: form.id });
    return { ok: true, recoveryCode: res.recoveryCode };
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
    const res = await cloudCreateCharacter(cred.url, slotIndex, name);
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
    const res = await cloudDeleteCharacter(cred.url, slotIndex);
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
    const res = await cloudEnterCharacter(cred.url, slotIndex);
    if (res.error) {
      console.error("[ThornieDungeons] enterCharacter failed:", res.error);
      return;
    }
    const characterSlot = characterFromServerRow(res.character);
    const enteredPersistenceContext = persistenceContextFor(characterSlot.id);
    persistenceRef.current.setActiveContext(enteredPersistenceContext);
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
      inventory: inv,
      overflow: savedOverflow
    } = itemsFromServerList(res.items || []);
    let normalized = normalizeInventoryCapacity(inv, savedOverflow, INVENTORY_CAPACITY);
    // One-time migration: the old flat `potions` counter becomes real Small HP Potion stacks
    // in the inventory the first time this character loads post-update, then gets zeroed out
    // so it doesn't keep resurrecting extra potions on every future login.
    const migratedPotionCounter = characterSlot.potions > 0;
    if (migratedPotionCounter) {
      normalized = insertInventoryItems(normalized.inventory, normalized.overflow, [{ ...makePotionItem("hp_small", 1), quantity: characterSlot.potions }], INVENTORY_CAPACITY);
      characterSlot.potions = 0;
    }
    if (normalized.inventory.length !== inv.length || normalized.overflow.length !== savedOverflow.length || migratedPotionCounter) {
      pushItems(normalized.inventory, eq, normalized.overflow, characterSlot.id);
    }
    equippedRef.current = eq;
    inventoryRef.current = normalized.inventory;
    inventoryOverflowRef.current = normalized.overflow;
    setEquipped(eq);
    setInventory(normalized.inventory);
    setInventoryOverflow(normalized.overflow);
    // Cloud is authoritative for Battle V1 quick slots/checkpoints. Local slots
    // remain a rollout fallback for characters that have not synced settings yet.
    cloudGetBattleState(cred.url, characterSlot.id).then(async battleRes => {
      if (battleRes && battleRes.ok) {
        if (Array.isArray(battleRes.quickSlots) && battleRes.quickSlots.length === 4) setQuickSlots(battleRes.quickSlots);
        else setQuickSlots(await loadQuickSlots(cred.id, characterSlot.id));
        if (battleRes.checkpoint && battleRes.checkpoint.payload) setResumeBattle(battleRes.checkpoint.payload);
      } else {
        setQuickSlots(await loadQuickSlots(cred.id, characterSlot.id));
      }
    });
    cloudGetDailyLogin(cred.url, characterSlot.id).then(async dlRes => {
      if (!dlRes || !dlRes.ok) return;
      setDailyLogin({ state: dlRes.state, canClaim: dlRes.canClaim, preview: dlRes.preview });
      if (!dlRes.canClaim) return;
      // Auto-claim right away instead of waiting for the player to open a menu and press a
      // button — the popup below is what actually tells them they got it.
      const claim = await cloudClaimDailyLogin(cred.url, characterSlot.id);
      if (!claim || claim.error) return;
      setDailyLogin({ state: claim.state, canClaim: false, preview: dlRes.preview });
      setSave(s => s ? { ...s, gold: s.gold + (claim.reward.gold || 0), diamonds: s.diamonds + (claim.reward.diamonds || 0) } : s);
      setDailyLoginClaimResult({ reward: claim.reward, streak: claim.streak });
    });
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
        mp: Number(rs.mp),
        petState: normalizePetRunState(rs.pet_state_json || rs.petState)
      };
    } else {
      try {
        savedRun = safeJsonParse(window.localStorage?.getItem(runKey), null);
      } catch (e) {}
    }
    if (savedRun && !savedRun.petState) {
      savedRun.petState = normalizePetRunState(savedRun.pet_state_json);
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
  async function flushCurrentCharacter() {
    if (!save?.characterId) return true;
    persistSave(save);
    persistItems(inventory, equipped);
    if (player && !combatOutcomeRef.current) pushRunState(buildRunStateSnapshot(selectedFloor, player));
    return persistenceRef.current.flush(persistenceContextFor(save.characterId), { retryFailed: true });
  }
  async function manualSave() {
    const ok = await flushCurrentCharacter();
    if (!ok) setPersistenceMessage("บันทึก Cloud ไม่สำเร็จ — ข้อมูลล่าสุดยังรอส่งและกดบันทึกเพื่อลองใหม่ได้");
    return ok;
  }
  // Shared GameDock prop bundle for standalone utility pages (Friend now; Chat/Guild
  // later can reuse this too) — one call instead of hand-writing the same five
  // near-identical onCharacter/onOpenInv/onPets/onSettings/onSave closures per page.
  // `fromPhase` is the phase to return to when leaving via the dock (matches the
  // existing characterReturnPhase/petReturnPhase/utilityReturnPhase convention).
  function utilityDockProps(fromPhase) {
    return {
      onCharacter: () => { setCharacterReturnPhase(fromPhase); setPhase("character"); },
      onOpenInv: () => setInvOpen(true),
      onPets: () => { setPetReturnPhase(fromPhase); setPhase("pets"); },
      onSettings: () => setAccountSettingsOpen(true),
      onSave: manualSave,
    };
  }
  function closeTransientOverlays() {
    setAccountSettingsOpen(false);
    setInvOpen(false);
    setShopOpen(false);
    setBlacksmithOpen(false);
    setCraftingOpen(false);
  }
  async function backToCharacterSelect() {
    // Fold any in-flight state back into the account before leaving, same as a normal save,
    // so switching characters never loses the last few seconds of progress.
    const context = save?.characterId ? persistenceContextFor(save.characterId) : null;
    if (!(await flushCurrentCharacter())) {
      window.alert("ยังบันทึกข้อมูลไป Cloud ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      return false;
    }
    if (context) persistenceRef.current.invalidate(context);
    persistenceRef.current.setActiveContext(null);
    setPlayer(null);
    setSave(null);
    setResumeRun(null);
    setInventory([]);
    setInventoryOverflow([]);
    closeTransientOverlays();
    setCharacterSelectEntry(false);
    setPhase("characterSelect");
    return true;
  }
  async function logout() {
    // Same safety-net flush as backToCharacterSelect — leaving the account context
    // entirely should never skip the final sync, even though every mutation already
    // persists immediately on its own.
    const context = save?.characterId ? persistenceContextFor(save.characterId) : null;
    if (!(await flushCurrentCharacter())) {
      window.alert("ยังบันทึกข้อมูลไป Cloud ไม่สำเร็จ จึงยังไม่ออกจากระบบ กรุณาลองใหม่อีกครั้ง");
      return false;
    }
    const logoutResult = await cloudLogout(cred.url || DEFAULT_SERVER_URL);
    if (logoutResult?.error === "network_error" || logoutResult?.error === "server_error") {
      window.alert("ยังเชื่อมต่อ Server เพื่อออกจากระบบไม่ได้ Session ยังไม่ถูกลบ กรุณาลองใหม่");
      return false;
    }
    if (context) persistenceRef.current.invalidate(context);
    persistenceRef.current.setActiveContext(null);
    await AUTH_SESSION.clear("logout", false);
    setCred(c => ({
      ...c,
      password: ""
    }));
    setAccount(null);
    setSave(null);
    setPlayer(null);
    setResumeRun(null);
    setInventory([]);
    setInventoryOverflow([]);
    closeTransientOverlays();
    setCharacterSelectEntry(false);
    setLoginTransitioning(false);
    setAuthError("");
    setPhase("login");
    return true;
  }
  async function requireLoginAfterSecurityChange(message) {
    const context = save?.characterId ? persistenceContextFor(save.characterId) : null;
    if (context) persistenceRef.current.invalidate(context);
    persistenceRef.current.setActiveContext(null);
    await AUTH_SESSION.clear("security_change", false);
    closeTransientOverlays();
    setAccount(null);
    setSave(null);
    setPlayer(null);
    setInventory([]);
    setInventoryOverflow([]);
    setCred(current => ({ ...current, password: "" }));
    setAuthError(message || "กรุณาเข้าสู่ระบบใหม่");
    setPhase("login");
  }
  function battleQueueForUi(state) {
    return BATTLE_CORE_V1.upcomingActions(state, 4).map(id => {
      const unit = state.units[id];
      return { key: unit.kind === "hero" ? "player" : id, kind: unit.kind === "hero" ? "player" : unit.kind === "pet" ? "pet" : "monster", uid: unit.side === "enemy" ? id : undefined, name: unit.name, icon: unit.kind === "hero" ? "🧙" : unit.kind === "pet" ? (unit.icon || "🐾") : "👹", speed: unit.speed };
    });
  }
  function applyCoreBattleState(next, persistCheckpoint = true) {
    battleStateRef.current = next;
    if (!next.result) lastSafeBattleCheckpointRef.current = next;
    setBattleState(next);
    const heroUnit = next.units[next.heroId];
    const nextPlayer = heroUnit && playerRef.current ? {
      ...playerRef.current, hp: heroUnit.hp, mp: heroUnit.sp,
      defBuffTurns: heroUnit.statuses.def_up?.duration || 0,
      regenTurns: heroUnit.statuses.pet_regrowth?.duration || 0,
      battleStatuses: heroUnit.statuses,
      battleResources: next.resources,
      skillLevels: heroUnit.skills,
      cooldowns: heroUnit.cooldowns
    } : playerRef.current;
    if (nextPlayer) { playerRef.current = nextPlayer; setPlayer(nextPlayer); }
    const nextMonsters = next.enemyIds.map(id => {
      const unit = next.units[id];
      const previous = monstersRef.current.find(monster => monster.uid === id) || {
        ...unit,
        id: unit.monsterDefId || unit.id,
        uid: id
      };
      return { ...previous, hp: unit.hp, maxHp: unit.maxHp, poisonTurns: unit.statuses.poison?.duration || 0, poisonDmg: unit.statuses.poison?.damage || 0, frozenTurns: unit.statuses.stun?.duration || 0, battleStatuses: unit.statuses };
    });
    monstersRef.current = nextMonsters;
    setMonsters(nextMonsters);
    if (next.petId && next.units[next.petId]) {
      const petUnit = next.units[next.petId];
      const nextPet = { ...(petCombatRef.current || petUnit), hp: petUnit.hp, maxHp: petUnit.maxHp, cooldown: petUnit.cooldowns.pet_active || 0, battleStatuses: petUnit.statuses };
      petCombatRef.current = nextPet; setPetCombat(nextPet);
    }
    const queue = battleQueueForUi(next);
    turnQueueRef.current = queue; setTurnQueue(queue);
    const acting = BATTLE_CORE_V1.currentUnit(next);
    setActiveTurnKey(acting ? (acting.kind === "hero" ? "player" : acting.id) : null);
    setCombatTurnCount(next.heroTurnCount);
    if (next.selectedTargetId) setTargetUid(next.selectedTargetId);
    const messages = next.log.slice().reverse().map(entry => entry.text);
    if (messages.length) setLogState(messages);
    if (persistCheckpoint && !next.result) pushBattleCheckpoint(next);
  }
  async function finishCoreBattle(next) {
    if (!next?.battleId || finishingBattleIdRef.current === next.battleId) return;
    finishingBattleIdRef.current = next.battleId;
    // Battle resolution owns gameplay state; presentation must be reset before
    // leaving the scene so a terminal attack frame cannot leak into the next fight.
    setHeroAnim("");
    setPetAnim("");
    setEnemyAnims({});
    setBattleVfx([]);
    setBattleFinishing(true);
    setBusy(true);
    setLog("Confirming battle result…");
    if (save?.characterId) {
      // Completion requires a previously persisted safe Action boundary. If the
      // persistence queue has not confirmed it yet, write that idempotent snapshot
      // directly; cloud request de-duplication piggybacks an identical in-flight write.
      const safeCheckpoint = lastSafeBattleCheckpointRef.current;
      const confirmed = confirmedBattleCheckpointRef.current;
      if (safeCheckpoint?.battleId === next.battleId
          && safeCheckpoint.safeActionSeq < next.safeActionSeq
          && (confirmed.battleId !== next.battleId || confirmed.safeActionSeq < safeCheckpoint.safeActionSeq)) {
        const checkpointReceipt = await cloudSaveBattleCheckpoint(
          cred.url,
          save.characterId,
          safeCheckpoint.battleId,
          safeCheckpoint.safeActionSeq,
          battleCheckpointWithoutLog(safeCheckpoint)
        );
        if (!checkpointReceipt?.ok) {
          finishingBattleIdRef.current = null;
          setBattleFinishing(false);
          setBusy(false);
          setLog("Battle checkpoint sync failed — tap Attack to retry safely.");
          return;
        }
        confirmedBattleCheckpointRef.current = {
          battleId: safeCheckpoint.battleId,
          safeActionSeq: safeCheckpoint.safeActionSeq
        };
      }
      const receipt = await cloudCompleteBattle(cred.url, save.characterId, next.battleId, { result: next.result, safeActionSeq: next.safeActionSeq, floor: next.floor });
      if (!receipt?.ok) {
        finishingBattleIdRef.current = null;
        setBattleFinishing(false);
        setBusy(false);
        setLog("Battle result sync failed — tap Attack to retry safely.");
        return;
      }
    }
    setFinishedBattleLog(next.log.slice().reverse().map(entry => entry.text));
    if (next.result === "victory") endCombatWin();
    else if (next.result === "defeat") playerLost();
    else if (next.result === "fled") backToMap();
  }
  function driveCoreBattle(inputState, heroCommand = null, immediate = false) {
    const state = inputState || battleStateRef.current;
    if (!state || state.result) { if (state?.result) finishCoreBattle(state); return; }
    const actor = BATTLE_CORE_V1.currentUnit(state);
    if (!actor) return;
    if (actor.kind === "hero" && !heroCommand && !state.flags.auto && !state.flags.skipResolving) {
      applyCoreBattleState(state, false); setBusy(false); return;
    }
    setBusy(true);
    if (heroCommand?.type === "skip_battle") {
      setBattleVfx([]);
      const resolved = BATTLE_CORE_V1.simulateBattle(state);
      applyCoreBattleState(resolved, false); finishCoreBattle(resolved); return;
    }
    if (actor.kind === "hero" && ["basic", "active"].includes(heroCommand?.type)) setHeroAnim("attack");
    else if (actor.kind === "pet") setPetAnim("attack");
    else if (actor.side === "enemy") setEnemyAnims(current => ({ ...current, [actor.id]: "attack" }));
    const result = BATTLE_CORE_V1.battleStep(state, actor.kind === "hero" ? heroCommand : undefined);
    const next = result.state;
    const optionalBasicKey = BATTLE_VFX_PRESENTATION.OPTIONAL_BASIC_EFFECT_KEY;
    const basicEffectKey = battleVfxFrames(optionalBasicKey).length ? optionalBasicKey : "";
    const resolvedVfx = BATTLE_VFX_PRESENTATION.resolvedEvents(
      state, next, actor, heroCommand, result.completedAction, { basicEffectKey }
    );
    const vfxToken = ++battleVfxSeqRef.current;
    setBattleVfx(resolvedVfx.map((event, index) => ({
      ...event,
      id: `${vfxToken}:${index}`,
      targetKey: event.anchor === "arena" ? "vfx-arena"
        : event.anchor === "hero" ? "vfx-hero"
        : event.anchor === "pet" ? "vfx-pet"
        : event.anchor === "monster" ? "vfx-monster"
        : event.targetId === next.heroId ? "hero"
        : event.targetId === next.petId ? "pet"
        : event.targetId
    })));
    for (const [id, unit] of Object.entries(next.units)) {
      const before = state.units[id];
      if (before && unit.hp < before.hp) {
        if (unit.kind === "hero") setHeroAnim("hurt");
        else if (unit.kind === "pet") setPetAnim("hurt");
        else setEnemyAnims(current => ({ ...current, [id]: unit.dead ? "death" : "hurt" }));
      }
    }
    applyCoreBattleState(next, result.completedAction);
    if (next.result) { finishCoreBattle(next); return; }
    const delay = immediate ? 0 : combatDelay(actor.kind === "hero" ? 420 : 520);
    setTimeout(() => {
      setBattleVfx([]);
      setHeroAnim(""); setPetAnim("");
      setEnemyAnims(current => Object.fromEntries(Object.keys(current).map(id => [id, next.units[id]?.dead ? "death" : ""])));
      driveCoreBattle(next);
    }, delay);
  }
  function playerTurn(action, value) {
    if (busy || !battleStateRef.current) return;
    const state = battleStateRef.current;
    if (state.result) { void finishCoreBattle(state); return; }
    const actor = BATTLE_CORE_V1.currentUnit(state);
    if (!actor || actor.kind !== "hero") return;
    if (action === "skip") {
      if (state.heroTurnCount < 5) return;
      driveCoreBattle(state, { type: "skip_battle" }, true);
      return;
    }
    if (action === "item") {
      const def = getPotionDef(value);
      if (!def || potionTotal(inventory, value) <= 0) return;
      const nextInventory = removePotionFromInventory(inventory, value, 1);
      if (!nextInventory) return;
      setInventory(nextInventory); persistItems(nextInventory, equipped);
      const heroUnit = state.units[state.heroId];
      const heal = def.kind === "hp" ? heroUnit.maxHp * def.healPct : 0;
      const restoreSp = def.kind !== "hp" ? heroUnit.maxSp * def.healPct : 0;
      driveCoreBattle(state, { type: "potion", count: 1, heal, restoreSp });
      return;
    }
    const command = action === "skill" ? { type: "active", skillId: value, targetId: targetUid }
      : action === "flee" ? { type: "flee" }
      : { type: "basic", targetId: targetUid };
    driveCoreBattle(state, command);
  }
  function enterStage(floorNum, carryPlayer = null, options = {}) {
    const allowResume = options.allowResume !== false;
    combatOutcomeRef.current = null;
    finishingBattleIdRef.current = null;
    setHeroAnim("");
    setPetAnim("");
    setEnemyAnims({});
    setLogState([]);
    setBattleVfx([]);
    setFinishedBattleLog([]);
    setSelectedFloor(floorNum);
    const resumeCarry = allowResume && !carryPlayer && resumeRun && Number(resumeRun.floor) === Number(floorNum) ? resumeRun : null;
    const nextPlayer = freshPlayerFromSave(save, carryPlayer || resumeCarry);
    nextPlayer.skillLevels = { ...(save.character.skillLevels || {}) };
    nextPlayer.cooldowns = {};
    playerRef.current = nextPlayer;
    setPlayer(nextPlayer);
    // resumeRun is only meant to restore the session you left off at login.
    // Consume it on the very first stage entry no matter what (matched or
    // not) so a stale login-time checkpoint can never silently resurface
    // later in the session (e.g. on Retry Stage for a floor number that
    // happens to coincide with it).
    if (resumeRun) setResumeRun(null);
    // Dungeon Select pre-rolls a real encounter so its modifier, monster sprites and
    // reward preview are the same ones the player actually fights. All other entry
    // paths (retry/next/resume) keep generating encounters exactly as before.
    const spawned = Array.isArray(options.encounter) && options.encounter.length
      ? options.encounter
      : makeEncounter(floorNum);
    setMonsters(spawned);
    monstersRef.current = spawned;
    setTargetUid(spawned[0] ? spawned[0].uid : null);
    const carryPetHp = petCarryHpForFloor(
      floorNum,
      save.activePetId,
      petCombatRef.current,
      resumeCarry?.petState,
      !!(carryPlayer || resumeCarry)
    );
    const initialPet = buildPetCombatUnit(carryPetHp);
    setPetCombat(initialPet);
    petCombatRef.current = initialPet;
    pushRunState(buildRunStateSnapshot(floorNum, nextPlayer, initialPet));
    const baseStats = getStats(nextPlayer, equipped);
    const petDefId = initialPet?.defId;
    const toughness = heroSkillRankData(save.character.skillLevels, "toughness");
    const ironBody = heroSkillRankData(save.character.skillLevels, "iron_body");
    const battleHardened = heroSkillRankData(save.character.skillLevels, "battle_hardened");
    const stats = {
      ...baseStats,
      maxHp: Math.round(baseStats.maxHp * (1 + (toughness?.maxHpPct || 0) / 100)),
      def: Math.round(baseStats.def * (1 + (ironBody?.defPct || 0) / 100 + (petDefId === "inferno_drake" ? 0.08 : 0))),
      accuracy: Math.min(99, baseStats.accuracy + (petDefId === "hell_wolf" ? 8 : 0)),
      dodgeChance: baseStats.dodgeChance + (petDefId === "storm_phoenix" ? 8 : 0),
      critChance: baseStats.critChance + (petDefId === "ember_fox" ? 5 : 0),
      statusResist: (battleHardened?.statusResist || 0) + (petDefId === "moon_hare" ? 15 : 0)
    };
    const heroStartHp = (carryPlayer || resumeCarry) ? Math.min(stats.maxHp, nextPlayer.hp) : stats.maxHp;
    const learnedActives = heroActiveSkillList(save.character.skillLevels).map(skill => skill.key);
    const equippedActives = quickSlots.filter(slot => slot && slot.kind === "skill" && learnedActives.includes(slot.key)).map(slot => slot.key);
    let initialBattle;
    let resetOldCheckpoint = null;
    if (resumeBattle && Number(resumeBattle.floor) === Number(floorNum)) {
      try { initialBattle = BATTLE_CORE_V1.restoreCheckpoint(resumeBattle); }
      catch (e) {
        initialBattle = null;
        if (resumeBattle.battleId) resetOldCheckpoint = cloudClearBattleCheckpoint(cred.url, save.characterId, resumeBattle.battleId);
      }
      setResumeBattle(null);
    } else if (resumeBattle?.battleId) {
      resetOldCheckpoint = cloudClearBattleCheckpoint(cred.url, save.characterId, resumeBattle.battleId);
      setResumeBattle(null);
    }
    if (!initialBattle) initialBattle = BATTLE_CORE_V1.createDungeonBattle({
      battleId: `dungeon-${save.characterId}-${floorNum}-${Date.now()}`,
      floor: floorNum,
      mode: "dungeon",
      seed: (Date.now() ^ Number(floorNum)) >>> 0,
      hero: {
        id: "hero", kind: "hero", side: "ally", name: save.characterName || "Hero", hp: heroStartHp, maxHp: stats.maxHp,
        sp: nextPlayer.mp, maxSp: stats.maxMp, atk: stats.atk, def: stats.def, speed: stats.speed,
        accuracy: stats.accuracy, dodge: stats.dodgeChance, crit: stats.critChance,
        critDamage: 1 + stats.critDamage / 100, agi: save.character.stats.agi,
        skills: save.character.skillLevels, activeSkills: equippedActives, statusResist: stats.statusResist
      },
      pet: initialPet && {
        ...initialPet, id: "pet", kind: "pet", side: "ally", petDefId: initialPet.defId,
        def: Math.round(initialPet.def * (petDefId === "inferno_drake" ? 1.15 : 1)),
        accuracy: Math.min(99, initialPet.hitRate + (petDefId === "hell_wolf" ? 8 : 0)),
        dodge: initialPet.evasion + (petDefId === "storm_phoenix" ? 8 : 0),
        crit: initialPet.critChance + (petDefId === "ember_fox" ? 10 : 0),
        statusResist: petDefId === "moon_hare" ? 15 : 0
      },
      enemies: spawned.map((monster, index) => ({
        ...monster, monsterDefId: monster.id, id: monster.uid, kind: monster.isBoss ? "boss" : "monster", side: "enemy",
        maxHp: monster.maxHp, accuracy: 92, dodge: 0, crit: 5, tieOrder: index + 2
      }))
    });
    applyCoreBattleState(initialBattle, false);
    if (resetOldCheckpoint) resetOldCheckpoint.then(result => {
      if (result?.ok) pushBattleCheckpoint(initialBattle);
      else setLog("Checkpoint reset failed — battle progress will retry after reconnect.");
    });
    else pushBattleCheckpoint(initialBattle);
    setActiveTurnKey(null);
    setCombatTurnCount(0);
    setBattleFinishing(false);
    confirmedBattleCheckpointRef.current = { battleId: initialBattle.battleId, safeActionSeq: -1 };
    setDropItem(null);
    const displayMonsters = monstersRef.current;
    const boss = displayMonsters.find(m => m.isBoss);
    const encounterLog = boss ? `A ${boss.name} blocks the way!` : displayMonsters.length > 1 ? `${displayMonsters.length} monsters appear: ${displayMonsters.map(m => m.name).join(", ")}!` : `A wild ${displayMonsters[0].name} appears!`;
    setLogState([encounterLog, ...initialBattle.log.slice().reverse().map(entry => entry.text)]);
    const battleAssets = { equipped: save?.equipped || {}, pet: initialPet, monsters: displayMonsters };
    const criticalAssets = preloadBattleCriticalAssets(battleAssets);
    criticalAssets.ready.finally(() => {
      setPhase("combat");
      setTimeout(() => driveCoreBattle(initialBattle), 0);
      criticalAssets.settled.finally(() => warmBattleDeferredAssets(battleAssets));
    });
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
      vit: cs.rawStats?.vit || 0,
      cooldown: 0
    };
  }
  const runStateSaveTimer = useRef(null);
  function buildRunStateSnapshot(floor, p, currentPet = petCombatRef.current) {
    if (!p) return null;
    const petState = petRunStateSnapshot(currentPet, save?.activePetId);
    return {
      floor: Number(floor) || 1,
      level: Number(p.level) || 1,
      xp: Math.max(0, Number(p.xp) || 0),
      hp: Math.max(0, Number(p.hp) || 0),
      mp: Math.max(0, Number(p.mp) || 0),
      base_atk: Number(p.baseAtk) || 0,
      base_def: Number(p.baseDef) || 0,
      base_max_hp: Number(p.baseMaxHp) || 0,
      base_max_mp: Number(p.baseMaxMp) || 0,
      pet_state_json: JSON.stringify(petState || {})
    };
  }
  function saveCombatRunState(floor, p) {
    const snapshot = buildRunStateSnapshot(floor, p);
    if (snapshot) pushRunState(snapshot);
  }
  useEffect(() => {
    if (!player || !cred.url || !cred.id || !AUTH_SESSION.getToken() || !save || combatOutcomeRef.current) return;
    if (runStateSaveTimer.current) clearTimeout(runStateSaveTimer.current);
    runStateSaveTimer.current = setTimeout(() => {
      if (!combatOutcomeRef.current) saveCombatRunState(selectedFloor, player);
    }, 150);
    return () => {
      if (runStateSaveTimer.current) clearTimeout(runStateSaveTimer.current);
    };
  }, [player?.hp, player?.mp, petCombat?.hp, petCombat?.instId, selectedFloor, cred.url, cred.id, save, pushRunState]);

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
    const incomingItems = [];
    let nextChestPity = save.chestPity || 0;
    if (bossMonster) {
      const chestRarity = rollChestRarity(bossMonster.isEliteBoss, nextChestPity);
      nextChestPity = chestRarity === "elite" || chestRarity === "mythic" ? 0 : nextChestPity + 1;
      drop = generateDropForMonster(selectedFloor, bossMonster.id, {
        forceRarity: chestRarity
      });
      incomingItems.push(drop);
    } else {
      // Each defeated monster in the pack gets its own independent roll for junk material.
      const junkDrops = [];
      currentMonsters.forEach(m => {
        const matChance = 0.45 + (currentPlayer.dropBonus || 0) / 100 + (m.modifier?.dropBonusFlat || 0) / 100;
        if (Math.random() < matChance) {
          const jd = rollJunkDrop(selectedFloor, m.modifier);
          junkDrops.push(jd);
          incomingItems.push({ ...makeJunkItem(jd.type, 1), quantity: jd.amount });
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
    // Per-monster bonus junk table (design: admin-backend-design.md) — independent of the
    // generic junk roll above and applies to EVERY monster in the encounter, boss included,
    // since a monster with no configured rows here is a no-op. Merged into the same
    // junkDrop summary banner so nothing new needs to be shown to the player differently.
    const bonusJunk = [];
    currentMonsters.forEach(m => { bonusJunk.push(...rollMonsterBonusJunk(m.id)); });
    if (bonusJunk.length) {
      bonusJunk.forEach(jd => { incomingItems.push({ ...makeJunkItem(jd.type, 1), quantity: jd.amount }); });
      const merged = {};
      if (junkDrop) merged[junkDrop.type] = junkDrop.amount;
      bonusJunk.forEach(jd => { merged[jd.type] = (merged[jd.type] || 0) + jd.amount; });
      const [type, amount] = Object.entries(merged)[0];
      junkDrop = { type, amount };
    }
    if (incomingItems.length) insertCarriedItems(incomingItems);
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
    // Hero Skill V1 grants one point per level; skills are no longer auto-owned
    // at legacy level milestones.
    const newSkill = null;
    const unlockedNext = selectedFloor === save.unlockedFloor;
    // The equipped Pet participated even if it died, so it receives 80% of the
    // total Hero battle EXP before any new starter Pet is awarded.
    let newPets = grantActivePetBattleXp(save.pets, save.activePetId, xpGained);
    const petProgress = petProgressChange(save.pets, newPets, save.activePetId);
    let newActivePetId = save.activePetId;
    let newPet = null;
    const alreadyHasStarter = (save.pets || []).some(p => p.defId === starterPetDef().id);
    if (selectedFloor === 5 && bossMonster && unlockedNext && !alreadyHasStarter) {
      const starter = starterPetDef();
      const inst = newPetInstance(starter.id);
      newPets = [...newPets, inst];
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
      hp: battleStateRef.current?.flags.heroReviveNextFloor ? 1 : currentPlayer.hp,
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
      diamonds: diamondsGained,
      petProgress: petProgress ? {
        ...petProgress,
        name: getPetDef(petProgress.defId)?.name || petCombatRef.current?.name || "Pet"
      } : null
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
  function selectTarget(uid) {
    const m = monstersRef.current.find(x => x.uid === uid);
    if (m && m.hp > 0) {
      setTargetUid(uid);
      if (battleStateRef.current && battleStateRef.current.units[uid]) {
        const next = { ...battleStateRef.current, selectedTargetId: uid };
        battleStateRef.current = next;
        setBattleState(next);
      }
    }
  }
  function combatDelay(ms) {
    return Math.max(60, Math.round(ms / combatSpeed));
  }

  // Legacy App.js combat loop removed: Battle Core V1 is the sole resolver.
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
  function commitStatDraft(draft) {
    const safeDraft = Object.fromEntries(STAT_INFO.map(st => [st.key, Math.max(0, Math.floor(Number(draft?.[st.key]) || 0))]));
    const used = Object.values(safeDraft).reduce((sum, value) => sum + value, 0);
    if (!used || used > save.character.statPoints) return false;
    const nextStats = { ...save.character.stats };
    STAT_INFO.forEach(st => { nextStats[st.key] += safeDraft[st.key]; });
    persistSave({
      ...save,
      character: {
        ...save.character,
        statPoints: save.character.statPoints - used,
        stats: nextStats
      }
    });
    return true;
  }
  function resetAllStats() {
    const refunded = STAT_INFO.reduce((sum, st) => sum + Math.max(0, Number(save.character.stats[st.key]) || 0), 0);
    if (!refunded || save.diamonds < STAT_RESET_COST) return false;
    persistSave({
      ...save,
      diamonds: save.diamonds - STAT_RESET_COST,
      character: {
        ...save.character,
        statPoints: save.character.statPoints + refunded,
        stats: Object.fromEntries(STAT_INFO.map(st => [st.key, 0]))
      }
    });
    return true;
  }
  function commitSkillDraft(draft) {
    const currentLevels = { ...(save.character.skillLevels || {}) };
    let changed = false;
    for (const [key, amount] of Object.entries(draft || {})) {
      for (let index = 0; index < Math.floor(Number(amount) || 0); index++) {
        const check = canSpendHeroSkillPoint(save.character.level, currentLevels, key);
        if (!check.ok) break;
        currentLevels[key] = heroSkillRank(currentLevels, key) + 1;
        changed = true;
      }
    }
    if (!changed) return false;
    persistSave({
      ...save,
      character: { ...save.character, skillVersion: 1, skillLevels: currentLevels }
    });
    return true;
  }
  function learnHeroSkill(id) { return commitSkillDraft({ [id]: 1 }); }
  function resetAllSkills() {
    if (!heroSkillSpentPoints(save.character.skillLevels) || save.diamonds < SKILL_RESET_COST) return false;
    persistSave({
      ...save,
      diamonds: save.diamonds - SKILL_RESET_COST,
      character: { ...save.character, skillLevels: {} }
    });
    return true;
  }
  function equipItem(item) {
    const slot = item.type;
    const prevItem = equipped[slot];
    const newEq = {
      ...equipped,
      [slot]: item
    };
    const nextInv = inventoryRef.current.filter(i => i.id !== item.id);
    if (prevItem) insertCarriedItems([prevItem], nextInv, newEq);
    else commitInventorySnapshot({ inventory: nextInv, overflow: inventoryOverflowRef.current }, newEq);
  }
  function unequipItem(slot) {
    const item = equipped[slot];
    if (!item) return;
    const newEq = {
      ...equipped,
      [slot]: null
    };
    insertCarriedItems([item], inventoryRef.current, newEq);
  }
  function sellItem(item) {
    if (item?.favorite) return { ok: false, message: "ปลด Favorite/Lock ก่อนขาย" };
    const price = sellPrice(item);
    const nextInv = inventoryRef.current.filter(i => i.id !== item.id);
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
  function toggleItemFavorite(itemId) {
    const found = findItemAndLocation(itemId);
    if (!found) return;
    applyItemUpdate(itemId, item => ({ ...item, favorite: !item.favorite }));
  }
  function sortInventoryNow() {
    const next = sortInventoryDeterministic(inventoryRef.current);
    commitInventorySnapshot({ inventory: next, overflow: inventoryOverflowRef.current });
  }
  function claimOverflowOne(itemId) {
    return commitInventorySnapshot(claimOverflowItem(inventoryRef.current, inventoryOverflowRef.current, itemId));
  }
  function claimOverflowAll() {
    return commitInventorySnapshot(claimAllOverflowThatFits(inventoryRef.current, inventoryOverflowRef.current));
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
    if (it.favorite) return { ok: false, message: "ปลด Favorite/Lock ก่อนแยกชิ้นส่วน" };
    const y = salvageYield(it.rarity);
    let nextInv = inventory.filter(i => i.id !== itemId);
    const incoming = [
      { ...makeJunkItem("iron", 1), quantity: y.iron },
      { ...makeJunkItem("manaOre", 1), quantity: y.manaOre }
    ];
    // Crafted (Azure) gear also returns a cut of its original materials + the recipe
    // scroll in full — see craftSalvageRefund() in crafting.js for the split.
    const refund = craftSalvageRefund(it);
    let refundMsg = "";
    if (refund && refund.length) {
      refund.forEach(r => incoming.push({ ...makeJunkItem(r.junkId, 1), quantity: r.qty }));
      refundMsg = " + คืน " + refund.map(r => `${(JUNK_INFO[r.junkId] || {}).icon || "📦"}${r.qty}`).join(" ");
    }
    insertCarriedItems(incoming, nextInv);
    return {
      ok: true,
      message: `♻️ แยกชิ้นส่วนได้ 🔩${y.iron} 🔮${y.manaOre}${refundMsg}`
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
    insertCarriedItems([makeJunkItem(type, 1)]);
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
    insertCarriedItems([pureItem]);
    persistSave({
      ...save,
      gold: save.gold - item.price
    });
    setShopStock(s => ({
      ...s,
      items: s.items.filter(i => i.id !== item.id)
    }));
  }
  function buyShopPotionTier(potionId) {
    const def = getPotionDef(potionId);
    if (!def || save.gold < def.price) return;
    insertCarriedItems([makePotionItem(potionId, 1)]);
    persistSave({
      ...save,
      gold: save.gold - def.price
    });
  }
  // ---------- quick slots ----------
  function assignQuickSlot(index, entry) {
    setQuickSlots(qs => {
      const next = qs.slice();
      next[index] = entry;
      if (save && save.characterId) saveQuickSlotsLocal(cred.id, save.characterId, next);
      if (save && save.characterId) pushQuickSlots(next);
      return next;
    });
  }
  function clearQuickSlot(index) {
    assignQuickSlot(index, null);
  }
  function equipPet(instId) {
    petCombatRef.current = null;
    setPetCombat(null);
    persistSave({
      ...save,
      activePetId: instId
    });
  }
  function unequipPet() {
    petCombatRef.current = null;
    setPetCombat(null);
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
      // duplicate — no longer auto-refunded to diamonds; banked into the star-up pool instead,
      // spent manually by the player via starUpPet() below.
      const nextDup = { ...(save.petDuplicates || {}) };
      nextDup[won.id] = (nextDup[won.id] || 0) + 1;
      persistSave({
        ...save,
        diamonds: save.diamonds - GACHA_COST,
        petDuplicates: nextDup
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
  // Spends duplicates from save.petDuplicates[defId] to raise one pet instance's star by 1.
  // Returns {ok:true} on success, or {ok:false, need, have} so the UI can show exactly how many
  // more duplicates are needed (and highlight the shortfall) without guessing.
  function starUpPet(instId) {
    const pets = save.pets || [];
    const pet = pets.find(p => p.instId === instId);
    if (!pet) return { ok: false, need: 0, have: 0 };
    const cost = petStarUpCost(pet.star || 1);
    if (cost === null) return { ok: false, maxed: true };
    const have = petDuplicateCount(save.petDuplicates, pet.defId);
    if (have < cost) return { ok: false, need: cost, have };
    const nextDup = { ...(save.petDuplicates || {}) };
    nextDup[pet.defId] = have - cost;
    const nextPets = pets.map(p => p.instId === instId ? { ...p, star: (p.star || 1) + 1 } : p);
    persistSave({
      ...save,
      pets: nextPets,
      petDuplicates: nextDup
    });
    return { ok: true };
  }
  async function claimDailyLogin() {
    if (!dailyLogin.canClaim) return { ok: false, alreadyClaimed: true };
    const res = await cloudClaimDailyLogin(cred.url, save.characterId);
    if (!res || res.error) return { ok: false, error: res && res.error };
    setDailyLogin({ state: res.state, canClaim: false, preview: dailyLogin.preview });
    // The worker never touches characters.gold/players.diamonds directly for this reward —
    // same reasoning as the mailbox system: a server-side UPDATE gets silently reverted by
    // this client's own next full-state autosave. This is the only place the reward
    // actually "lands", exactly like a mailbox claim (applyMailReward).
    setSave(s => s && ({
      ...s,
      gold: s.gold + (res.reward.gold || 0),
      diamonds: s.diamonds + (res.reward.diamonds || 0)
    }));
    const incoming = [];
    (res.reward.junk || []).forEach(j => incoming.push({ ...makeJunkItem(j.junkId, 1), quantity: Number(j.quantity) || 1 }));
    (res.reward.items || []).forEach(item => incoming.push(materializeMailItem(item)));
    if (incoming.length) insertCarriedItems(incoming);
    setDailyLoginClaimResult({ reward: res.reward, streak: res.streak });
    return { ok: true, reward: res.reward, streak: res.streak };
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
      busy: authBusy || loginTransitioning,
      departing: loginTransitioning,
      rememberLogin: rememberLogin,
      onRememberLogin: handleRememberLogin,
      onLogin: handleLogin,
      onRegister: handleRegister,
      onForgotPassword: handleForgotPassword,
      registrationRecovery: registrationRecovery,
      onFinishRegistration: finishRegistrationRecovery,
      passwordResetRecovery: passwordResetRecovery,
      onClearPasswordResetRecovery: () => setPasswordResetRecovery(null)
    }));
  }
  if (phase === "characterSelect") {
    return /*#__PURE__*/React.createElement("div", {
      className: "md-root"
    }, /*#__PURE__*/React.createElement("style", null, STYLE), /*#__PURE__*/React.createElement(Starfield, null), /*#__PURE__*/React.createElement(CharacterSelectScreen, {
      account: account,
      entryTransition: characterSelectEntry,
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
  const characterDisplayStats = getStats(freshPlayerFromSave(save), equipped);
  // Reuse the first-person dungeon artwork throughout the authenticated game. Each screen
  // chooses its own veil strength so scenery never competes with stats, targets or actions.
  const heavyDungeonFade = ["map", "combat", "result", "defeat"].includes(phase);
  const dungeonFade = phase === "menu" ? "light" : heavyDungeonFade ? "heavy" : "medium";
  const dungeonModalOpen = invOpen || shopOpen || blacksmithOpen || craftingOpen;
  const isTown = phase === "town";
  return /*#__PURE__*/React.createElement("div", {
    className: isTown
      ? `md-root md-root-town${dungeonModalOpen ? " md-town-modal-open" : ""}`
      : `md-root md-root-dungeon md-dungeon-fade-${dungeonFade}${phase === "map" ? " md-root-map" : ""}${phase === "combat" ? " md-root-combat" : ""}${dungeonModalOpen ? " md-dungeon-modal-open" : ""}`
  }, /*#__PURE__*/React.createElement("style", null, STYLE), !isTown && /*#__PURE__*/React.createElement(Starfield, null), persistenceStatus === "failed" && /*#__PURE__*/React.createElement("div", {
    className: `md-save-state md-save-state-${persistenceStatus}`,
    role: persistenceStatus === "failed" ? "alert" : "status"
  }, persistenceStatus === "saving" ? "กำลังบันทึก…" : persistenceMessage || "บันทึก Cloud ไม่สำเร็จ — กดบันทึกเพื่อลองใหม่"), phase !== "menu" && phase !== "town" && phase !== "login" && phase !== "combat" && phase !== "character" && phase !== "skill" && phase !== "map" && /*#__PURE__*/React.createElement(StatusBar, {
    player: player,
    save: save,
    phase: phase,
    equipped: equipped
  }), phase === "menu" && /*#__PURE__*/React.createElement(HubScreen, {
    save: save,
    cp: cp,
    onTown: () => setPhase("town"),
    onCharacter: () => {
      setCharacterReturnPhase("menu");
      setPhase("character");
    },
    onMap: () => setPhase("map"),
    onOpenInv: () => setInvOpen(true),
    onShop: openShop,
    onEnhance: () => setBlacksmithOpen(true),
    onCraft: () => setCraftingOpen(true),
    onPets: () => {
      setPetReturnPhase("menu");
      setPhase("pets");
    },
    onLeaderboard: () => {
      setUtilityReturnPhase("menu");
      setPhase("leaderboard");
    },
    onRaid: () => {
      setUtilityReturnPhase("menu");
      setPhase("raid");
    },
    onArena: () => {
      setUtilityReturnPhase("menu");
      setPhase("arena");
    },
    onMailbox: () => {
      setUtilityReturnPhase("menu");
      setPhase("mailbox");
    },
    onSave: manualSave,
    onAccountSettings: () => setAccountSettingsOpen(true),
    onFriend: () => {
      setUtilityReturnPhase("menu");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setUtilityReturnPhase("menu");
      setPhase("chat");
    },
    dailyLogin: dailyLogin,
    dailyLoginClaimResult: dailyLoginClaimResult,
    onClaimDailyLogin: claimDailyLogin,
    onClearDailyLoginResult: () => setDailyLoginClaimResult(null)
  }), phase === "town" && /*#__PURE__*/React.createElement(TownScreen, {
    save: save,
    onCharacter: () => {
      setCharacterReturnPhase("town");
      setPhase("character");
    },
    onDungeon: () => setPhase("menu"),
    onOpenInv: () => setInvOpen(true),
    onShop: openShop,
    onEnhance: () => setBlacksmithOpen(true),
    onCraft: () => setCraftingOpen(true),
    onPets: () => {
      setPetReturnPhase("town");
      setPhase("pets");
    },
    onLeaderboard: () => {
      setUtilityReturnPhase("town");
      setPhase("leaderboard");
    },
    onRaid: () => {
      setUtilityReturnPhase("town");
      setPhase("raid");
    },
    onArena: () => {
      setUtilityReturnPhase("town");
      setPhase("arena");
    },
    onMailbox: () => {
      setUtilityReturnPhase("town");
      setPhase("mailbox");
    },
    onSummoning: () => {
      setGachaReturnPhase("town");
      setPhase("gacha");
    },
    onSave: manualSave,
    onAccountSettings: () => setAccountSettingsOpen(true),
    onFriend: () => {
      setUtilityReturnPhase("town");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setUtilityReturnPhase("town");
      setPhase("chat");
    },
    dailyLogin: dailyLogin,
    dailyLoginClaimResult: dailyLoginClaimResult,
    onClaimDailyLogin: claimDailyLogin,
    onClearDailyLoginResult: () => setDailyLoginClaimResult(null)
  }), phase === "character" && /*#__PURE__*/React.createElement(StatusScreen, {
    save: save,
    charStats: characterDisplayStats,
    cp: cp,
    onCommitStats: commitStatDraft,
    onResetStats: resetAllStats,
    onOpenInv: () => setInvOpen(true),
    onMap: () => setPhase("map"),
    onOpenPets: () => {
      setPetReturnPhase("character");
      setPhase("pets");
    },
    onOpenSkill: () => setPhase("skill"),
    onSettings: () => setAccountSettingsOpen(true),
    onSave: manualSave,
    onFriend: () => {
      setUtilityReturnPhase("character");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setUtilityReturnPhase("character");
      setPhase("chat");
    },
    onBack: () => setPhase(characterReturnPhase)
  }), phase === "skill" && /*#__PURE__*/React.createElement(HeroSkillV1Screen, {
    save: save,
    cp: cp,
    onLearnSkill: learnHeroSkill,
    onResetSkills: resetAllSkills,
    onOpenInv: () => setInvOpen(true),
    onOpenPets: () => {
      setPetReturnPhase("skill");
      setPhase("pets");
    },
    onSettings: () => setAccountSettingsOpen(true),
    onSave: manualSave,
    onFriend: () => {
      setUtilityReturnPhase("skill");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setUtilityReturnPhase("skill");
      setPhase("chat");
    },
    onBack: () => setPhase("character")
  }), phase === "map" && /*#__PURE__*/React.createElement(MapScreen, {
    save: save,
    unlockedFloor: save.unlockedFloor,
    onCharacter: () => {
      setCharacterReturnPhase("map");
      setPhase("character");
    },
    onOpenInv: () => setInvOpen(true),
    onPets: () => {
      setPetReturnPhase("map");
      setPhase("pets");
    },
    // Same rule as nextStage/retryStageAfterWin: if there's a live player object
    // sitting in state (from the last stage you fought, incl. a flee), carry its
    // real current HP/MP into the newly-selected stage instead of full-healing —
    // Stage Select should only ever full-heal when there's truly no run to continue.
    onSelectFloor: (floorNum, encounter) => enterStage(
      floorNum,
      player && player.hp > 0 ? player : null,
      { encounter }
    ),
    onSave: manualSave,
    onSettings: () => setAccountSettingsOpen(true),
    onFriend: () => {
      setUtilityReturnPhase("map");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setUtilityReturnPhase("map");
      setPhase("chat");
    },
    onBack: () => setPhase("menu")
  }), phase === "pets" && /*#__PURE__*/React.createElement(PetScreen, {
    save: save,
    onEquip: equipPet,
    onUnequip: unequipPet,
    onStarUp: starUpPet,
    onOpenGacha: () => {
      setGachaReturnPhase("pets");
      setPhase("gacha");
    },
    onCharacter: () => {
      setCharacterReturnPhase("pets");
      setPhase("character");
    },
    onOpenInv: () => setInvOpen(true),
    onSettings: () => setAccountSettingsOpen(true),
    onSave: manualSave,
    onFriend: () => {
      setUtilityReturnPhase("pets");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setUtilityReturnPhase("pets");
      setPhase("chat");
    },
    onBack: () => setPhase(petReturnPhase)
  }), phase === "leaderboard" && /*#__PURE__*/React.createElement(LeaderboardScreen, {
    serverUrl: cred.url,
    myCharacterId: save.characterId,
    onBack: () => setPhase(utilityReturnPhase)
  }), phase === "raid" && /*#__PURE__*/React.createElement(RaidScreen, {
    serverUrl: cred.url,
    characterId: save.characterId,
    diamonds: save.diamonds,
    onSpendDiamonds: spendRaidDiamonds,
    onBack: () => setPhase(utilityReturnPhase)
  }), phase === "arena" && /*#__PURE__*/React.createElement(ArenaScreen, {
    serverUrl: cred.url,
    characterId: save.characterId,
    diamonds: save.diamonds,
    onSpendDiamonds: spendRaidDiamonds,
    onBack: () => setPhase(utilityReturnPhase)
  }), phase === "mailbox" && /*#__PURE__*/React.createElement(MailboxScreen, {
    serverUrl: cred.url,
    characterId: save.characterId,
    onApplyReward: applyMailReward,
    onBack: () => setPhase(utilityReturnPhase)
  }), phase === "friend" && /*#__PURE__*/React.createElement(FriendScreen, {
    serverUrl: cred.url,
    characterId: save.characterId,
    ...utilityDockProps("friend"),
    onChat: () => {
      setChatDirectTarget(null);
      setUtilityReturnPhase("friend");
      setPhase("chat");
    },
    onChatWith: (friend) => {
      setChatDirectTarget({ characterId: friend.characterId, name: friend.name });
      setUtilityReturnPhase("friend");
      setPhase("chat");
    },
    onBack: () => setPhase(utilityReturnPhase)
  }), phase === "chat" && /*#__PURE__*/React.createElement(ChatScreen, {
    serverUrl: cred.url,
    characterId: save.characterId,
    characterName: save.characterName,
    initialDirectTarget: chatDirectTarget,
    ...utilityDockProps("chat"),
    onFriend: () => {
      setUtilityReturnPhase("chat");
      setPhase("friend");
    },
    onBack: () => setPhase(utilityReturnPhase)
  }), phase === "gacha" && /*#__PURE__*/React.createElement(GachaScreen, {
    save: save,
    gachaResult: gachaResult,
    onClearGachaResult: () => setGachaResult(null),
    onGacha: pullGacha,
    onClaimDiamonds: claimTestDiamonds,
    onBack: () => setPhase(gachaReturnPhase)
  }), phase === "combat" && monsters.length > 0 && player && /*#__PURE__*/React.createElement(CombatScreen, {
    player: player,
    heroName: save.characterName || "Hero",
    monsters: monsters,
    targetUid: targetUid,
    onSelectTarget: selectTarget,
    log: log,
    busy: busy,
    inventory: inventory,
    quickSlots: quickSlots,
    onAssignQuickSlot: assignQuickSlot,
    onClearQuickSlot: clearQuickSlot,
    heroAnim: heroAnim,
    petAnim: petAnim,
    enemyAnims: enemyAnims,
    floats: floats,
    onAction: playerTurn,
    equipped: equipped,
    petCombat: petCombat,
    turnQueue: turnQueue,
    activeTurnKey: activeTurnKey,
    battleRound: battleState?.round,
    battleFinishing: battleFinishing,
    combatSpeed: combatSpeed,
    battleVfx: battleVfx,
    combatTurnCount: combatTurnCount,
    onCycleCombatSpeed: () => setCombatSpeed(speed => speed === 1 ? 2 : 1)
  }), phase === "result" && /*#__PURE__*/React.createElement(ResultScreen, {
    floor: selectedFloor,
    rewards: lastRewards,
    dropItem: dropItem,
    battleLog: finishedBattleLog,
    onNext: nextStage,
    onRetry: retryStageAfterWin,
    onMap: backToMap,
    onOpenInv: () => setInvOpen(true)
  }), phase === "defeat" && /*#__PURE__*/React.createElement(DefeatScreen, {
    floor: selectedFloor,
    onRetry: retryStage,
    onMap: backToMap
  }), accountSettingsOpen && /*#__PURE__*/React.createElement(AccountSettingsOverlay, {
    serverUrl: cred.url,
    playerId: cred.id,
    recoveryConfigured: recoveryConfigured,
    onRecoveryConfigured: setRecoveryConfigured,
    onRequireLogin: requireLoginAfterSecurityChange,
    onSwitchCharacter: backToCharacterSelect,
    onLogout: logout,
    onClose: () => setAccountSettingsOpen(false)
  }), invOpen && /*#__PURE__*/React.createElement(InventoryOverlayV2, {
    equipped: equipped,
    inventory: inventory,
    overflow: inventoryOverflow,
    busy: itemActionBusy,
    characterName: save.characterName,
    save: save,
    onEquip: guardItemAction(equipItem),
    onUnequip: guardItemAction(unequipItem),
    onSell: guardItemAction(sellItem),
    onSalvage: guardItemAction(salvageItem),
    onToggleFavorite: guardItemAction(toggleItemFavorite),
    onSort: guardItemAction(sortInventoryNow),
    onClaimOverflow: guardItemAction(claimOverflowOne),
    onClaimAllOverflow: guardItemAction(claimOverflowAll),
    onCharacter: () => {
      setInvOpen(false);
      setCharacterReturnPhase(phase);
      setPhase("character");
    },
    onPets: () => {
      setInvOpen(false);
      setPetReturnPhase(phase);
      setPhase("pets");
    },
    onSettings: () => setAccountSettingsOpen(true),
    onSave: manualSave,
    onFriend: () => {
      setInvOpen(false);
      setUtilityReturnPhase(phase);
      setPhase("friend");
    },
    onChat: () => {
      setInvOpen(false);
      setChatDirectTarget(null);
      setUtilityReturnPhase(phase);
      setPhase("chat");
    },
    onClose: () => setInvOpen(false)
  }), blacksmithOpen && /*#__PURE__*/React.createElement(BlacksmithOverlay, {
    equipped: equipped,
    inventory: inventory,
    busy: itemActionBusy,
    gold: save.gold,
    onEnhance: guardItemAction(enhanceItem),
    onEmpower: guardItemAction(empowerItem),
    onReroll: guardItemAction(rerollEmpowerItem),
    onToggleLock: toggleEmpowerLock,
    onOpenInventory: () => { setBlacksmithOpen(false); setInvOpen(true); },
    onClose: () => setBlacksmithOpen(false)
  }), craftingOpen && /*#__PURE__*/React.createElement(CraftingOverlay, {
    serverUrl: cred.url,
    characterId: save.characterId,
    inventory: inventory,
    gold: save.gold,
    floor: save.unlockedFloor,
    busy: itemActionBusy,
    onCrafted: applyCraftResult,
    onClose: () => setCraftingOpen(false)
  }), shopOpen && /*#__PURE__*/React.createElement(ShopOverlay, {
    gold: save.gold,
    diamonds: save.diamonds,
    protectionStones: save.protectionStones || 0,
    stock: shopStock,
    onBuyItem: buyShopItem,
    onBuyPotionTier: buyShopPotionTier,
    onBuyProtectionStone: buyProtectionStone,
    onBuyMaterial: guardItemAction(buyMaterial),
    onClose: () => setShopOpen(false)
  }));
}
