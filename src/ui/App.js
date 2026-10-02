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
  const [arenaHud, setArenaHud] = useState(null);
  const [arenaFatal, setArenaFatal] = useState(null);
  // One-shot deep link set only by Friend's "Chat" action, consumed once by ChatScreen on
  // mount to open straight into that DM thread. Every other way of opening Chat clears
  // this first so a stale target can't resurface later.
  const [chatDirectTarget, setChatDirectTarget] = useState(null);
  const [chatInitialChannel, setChatInitialChannel] = useState("global");
  const [guildUnreadState, setGuildUnreadState] = useState({ characterId: null, unread: false });
  const guildUnread = guildUnreadState.characterId === save?.characterId && guildUnreadState.unread;
  const updateGuildUnread = (characterId, unread) => setGuildUnreadState({ characterId, unread });
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
  useEffect(() => {
    const characterId = save?.characterId;
    const level = Number(save?.character?.level) || 0;
    if (!cred.url || !characterId || level < 10) {
      setArenaHud(null);
      return undefined;
    }
    setArenaHud(null);
    let cancelled = false;
    const loadArenaHud = () => cloudGetArenaV2Status(cred.url, characterId).then(res => {
      if (cancelled || !res?.ok || res.unlocked === false) return;
      setArenaHud({
        arenaCoin: Number(res.player?.arenaCoin) || 0,
        tickets: Number(res.tickets?.tickets) || 0,
        ticketsMax: Number(res.tickets?.ticketsMax) || 10,
      });
    }).catch(() => {});
    loadArenaHud();
    const timer = setInterval(loadArenaHud, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cred.url, save?.characterId, save?.character?.level]);
  const refreshGuildChatStatus = useCallback((characterId) => cloudGetGuildChatStatus(cred.url, characterId).then((res) => {
    if (activeCharacterIdRef.current === characterId && res?.ok) setGuildUnreadState({ characterId, unread: !!res.guild?.unread });
  }).catch(() => {}), [cred.url]);
  const [rememberLogin, setRememberLogin] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [registrationRecovery, setRegistrationRecovery] = useState(null);
  const [passwordResetRecovery, setPasswordResetRecovery] = useState(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState(() => AUDIO_MANAGER.getState());
  const [playerCardTarget, setPlayerCardTarget] = useState(null);
  const [guildProfileTarget, setGuildProfileTarget] = useState(null);
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
  const potionRequestIdsRef = useRef(new Map());
  const [battleFinishing, setBattleFinishing] = useState(false);
  const [equipped, setEquipped] = useState(emptyEquipped());
  const [inventory, setInventory] = useState([]);
  const [inventoryOverflow, setInventoryOverflow] = useState([]);
  const equippedRef = useRef(equipped);
  const inventoryRef = useRef(inventory);
  const inventoryOverflowRef = useRef(inventoryOverflow);
  const donationInventoryGenerationRef = useRef(0);
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
  const blacksmithRequestRef = useRef(new Map());
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
      const release = () => {
        setTimeout(() => {
          itemActionLockRef.current = false;
          setItemActionBusy(false);
        }, 0);
      };
      try {
        const result = fn(...args);
        if (result && typeof result.then === "function") return result.finally(release);
        release();
        return result;
      } catch (error) {
        release();
        throw error;
      }
    };
  }
  const monstersRef = useRef([]);
  const petCombatRef = useRef(null);
  const playerRef = useRef(null);
  const turnQueueRef = useRef([]);
  const activeCharacterIdRef = useRef(null);
  useEffect(() => {
    if (!save?.characterId || phase !== "chat") return;
    let cancelled = false;
    const characterId = save.characterId;
    cloudGetGuildChatStatus(cred.url, characterId).then((res) => {
      if (!cancelled && activeCharacterIdRef.current === characterId && res?.ok) updateGuildUnread(characterId, !!res.guild?.unread);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [phase, save?.characterId, cred.url]);
  const combatOutcomeRef = useRef(null);
  useEffect(() => { monstersRef.current = monsters; }, [monsters]);
  useEffect(() => { activeCharacterIdRef.current = save?.characterId || null; }, [save?.characterId]);
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
  useEffect(() => AUDIO_MANAGER.subscribe(setAudioSettings), []);
  useEffect(() => {
    AUDIO_MANAGER.setScreenPhase(phase);
  }, [phase]);
  useEffect(() => {
    (async () => {
      
      // โหลด R2 Asset Manifest ก่อนเริ่มระบบเกม
      try {
        await loadAssetManifest();
        // The initial phase effect can run before the async R2 manifest exists.
        // Retry the already-requested BGM group now that manifest-backed audio paths resolve.
        AUDIO_MANAGER.resumeRequestedPlayback();
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
  // Mail rewards are already committed by the Worker. Drain pre-claim snapshots,
  // then replace local state from the authoritative post-claim response.
  const flushRewardClaimBarrier = useCallback(async characterId => {
    if (!characterId || activeCharacterIdRef.current !== characterId || !AUTH_SESSION.getToken()) return false;
    const context = persistenceContextFor(characterId);
    if (!context) return false;
    const flushed = await persistenceRef.current.flush(context, { retryFailed: true });
    return !!flushed && activeCharacterIdRef.current === characterId && !!AUTH_SESSION.getToken();
  }, [persistenceContextFor]);
  const applyMailReward = useCallback((snapshot, characterId) => {
    if (!snapshot || activeCharacterIdRef.current !== characterId) return;
    hydrateAuthoritativeBlacksmithSnapshot(snapshot, characterId);
  }, []);
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
  // Keep the local runtime/account view in step with server snapshots. This is not a persistence
  // API; cause-specific authenticated operations are the only writers for authoritative state.
  const setLocalCharacterView = useCallback(next => {
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
    return Promise.resolve(false);
  }, []);
  // Raid supplies the already-committed balance; the UI never computes or persists a spend.
  const spendRaidDiamonds = useCallback(balance => {
    const authoritativeBalance = Math.max(0, Number(balance) || 0);
    setSave(current => {
      if (!current) return current;
      const next = { ...current, diamonds: authoritativeBalance };
      setAccount(prevAccount => {
        if (!prevAccount || prevAccount.activeSlot === null) return prevAccount;
        const characters = prevAccount.characters.slice();
        characters[prevAccount.activeSlot] = packRuntimeIntoSlot(characters[prevAccount.activeSlot], next);
        return { ...prevAccount, diamonds: next.diamonds, characters };
      });
      return next;
    });
  }, []);
  const persistItems = useCallback((inv, eq, ov = inventoryOverflowRef.current) => {
    inventoryRef.current = inv;
    equippedRef.current = eq;
    inventoryOverflowRef.current = ov;
    return persistInventorySnapshot(inv, eq, ov);
  }, [persistInventorySnapshot]);
  // Crafting returns the same authoritative character/item snapshot used by W3
  // mutations. Hydrate it directly; generic item/save sync never creates, deletes, or
  // spends the W4 result on behalf of the Worker.
  function applyCraftResult(res) {
    if (!res || !res.item) return;
    hydrateAuthoritativeBlacksmithSnapshot(res);
  }
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
    AUDIO_MANAGER.handleUserGesture();
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
    if (res.error === "rate_limited") {
      const waitSeconds = Math.max(1, Number(res.retryAfter) || 30);
      const waitText = waitSeconds >= 60
        ? `ประมาณ ${Math.ceil(waitSeconds / 60)} นาที`
        : `ประมาณ ${waitSeconds} วินาที`;
      setAuthError(`ลองเข้าสู่ระบบผิดหลายครั้ง กรุณารอ ${waitText} แล้วลองใหม่`);
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
    AUDIO_MANAGER.handleUserGesture();
    setAuthError("");
    if (!cred.url || !form?.id || !form?.password || !form?.confirmPassword) {
      setAuthError("กรอกให้ครบทุกช่องนะคะ");
      return { ok: false, error: "missing_fields" };
    }
    setAuthBusy(true);
    const res = await cloudRegister(cred.url, form.id, form.password, form.confirmPassword, rememberLogin);
    setAuthBusy(false);
    if (res.error) {
      const registerErrors = {
        invalid_player_id: "Player ID ต้องยาว 4–20 ตัว และใช้ A-Z, a-z, 0-9, _ เท่านั้น",
        invalid_password_length: "Password ต้องยาว 4–32 ตัว",
        invalid_password_characters: "Password ใช้ได้เฉพาะ A-Z, a-z และ 0-9 เท่านั้น ห้ามเว้นวรรคหรือใช้อักขระพิเศษ",
        password_mismatch: "Confirm Password ไม่ตรงกัน",
        registration_unavailable: "สร้างบัญชีไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่",
        rate_limited: "สมัครบัญชีถี่เกินไปจากเครือข่ายนี้ กรุณาลองใหม่ภายหลัง",
      };
      setAuthError(registerErrors[res.error] || "เชื่อมต่อ Server ไม่ได้ ลองใหม่อีกครั้ง");
      return { ok: false, error: res.error, retryAfter: res.retryAfter };
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
    AUDIO_MANAGER.handleUserGesture();
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
      overflow: savedOverflow,
      legacyEquipmentMigrated
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
    if (normalized.inventory.length !== inv.length || normalized.overflow.length !== savedOverflow.length || migratedPotionCounter || legacyEquipmentMigrated) {
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
      hydrateAuthoritativeBlacksmithSnapshot(claim, characterSlot.id);
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
    persistItems(inventory, equipped);
    if (player && !combatOutcomeRef.current) pushRunState(buildRunStateSnapshot(selectedFloor, player));
    return persistenceRef.current.flush(persistenceContextFor(save.characterId), { retryFailed: true });
  }
  async function flushInventoryForDonation(characterId) {
    if (!characterId || activeCharacterIdRef.current !== characterId || !AUTH_SESSION.getToken()) return false;
    const context = persistenceContextFor(characterId);
    if (!context) return false;
    // Donation mutates items server-side. First enqueue the latest local full snapshot,
    // then wait until every older items snapshot for this character has drained so none
    // can arrive after donation and restore consumed junk.
    persistItems(inventoryRef.current, equippedRef.current, inventoryOverflowRef.current);
    const ok = await persistenceRef.current.flush(context, { retryFailed: true });
    if (!ok || activeCharacterIdRef.current !== characterId || !AUTH_SESSION.getToken()) return false;
    // Invalidate every inventory read already in flight before the donation POST begins.
    donationInventoryGenerationRef.current += 1;
    return true;
  }
  function applyGuildDonationLocally(junkId, quantity, remainingQuantity) {
    donationInventoryGenerationRef.current += 1;
    const currentInventory = inventoryRef.current;
    const hasAuthoritativeQuantity = Number.isFinite(Number(remainingQuantity)) && Number(remainingQuantity) >= 0;
    const targetQuantity = hasAuthoritativeQuantity ? Number(remainingQuantity) : null;
    const currentQuantity = currentInventory.reduce((sum, item) => (
      item.type === "junk" && item.junkId === junkId && !inventoryItemLocked(item)
        ? sum + inventoryItemQuantity(item)
        : sum
    ), 0);
    let nextInventory = currentInventory;
    if (targetQuantity !== null && currentQuantity > targetQuantity) {
      let remaining = currentQuantity - targetQuantity;
      nextInventory = currentInventory.flatMap(item => {
        if (remaining <= 0 || item.type !== "junk" || item.junkId !== junkId || inventoryItemLocked(item)) return [item];
        const take = Math.min(inventoryItemQuantity(item), remaining);
        remaining -= take;
        const left = inventoryItemQuantity(item) - take;
        return left > 0 ? [{ ...item, quantity: left }] : [];
      });
    } else if (targetQuantity !== null && currentQuantity < targetQuantity) {
      let remaining = targetQuantity - currentQuantity;
      nextInventory = currentInventory.map(item => {
        if (remaining <= 0 || item.type !== "junk" || item.junkId !== junkId || inventoryItemLocked(item) || item.quantity >= JUNK_STACK_MAX) return item;
        const add = Math.min(JUNK_STACK_MAX - item.quantity, remaining);
        remaining -= add;
        return { ...item, quantity: item.quantity + add };
      });
      while (remaining > 0) {
        const chunk = Math.min(JUNK_STACK_MAX, remaining);
        nextInventory.push(makeJunkItem(junkId, chunk));
        remaining -= chunk;
      }
    } else if (targetQuantity === null) {
      return false;
    }
    inventoryRef.current = nextInventory;
    setInventory(nextInventory);
    persistItems(nextInventory, equippedRef.current, inventoryOverflowRef.current);
    return true;
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
      onMainHub: () => setPhase("menu"),
    };
  }
  function handleArenaFatal(diagnostic) {
    setArenaFatal(diagnostic);
    // Leave the Arena route immediately. The server-side active match is not
    // touched, so reopening Arena performs the normal authoritative resume GET.
    setPhase(utilityReturnPhase || "menu");
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
    let completionReceipt = null;
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
      const rewardPlan = next.result === "victory" ? buildDungeonRewardPlan(next.battleId) : null;
      const receipt = await cloudCompleteBattle(cred.url, save.characterId, next.battleId, {
        result: next.result,
        safeActionSeq: next.safeActionSeq,
        floor: next.floor,
        reward: rewardPlan
      });
      if (!receipt?.ok) {
        finishingBattleIdRef.current = null;
        setBattleFinishing(false);
        setBusy(false);
        setLog("Battle result sync failed — tap Attack to retry safely.");
        return;
      }
      completionReceipt = receipt;
    }
    setFinishedBattleLog(next.log.slice().reverse().map(entry => entry.text));
    if (next.result === "victory") {
      if (completionReceipt && completionReceipt.firstCompletion === false) {
        // The server already applied this battle. Hydrate its authoritative snapshot rather
        // than replaying Gold/EXP/items locally, including after a crash before the first
        // client mirror completed.
        hydrateCommittedBattleSnapshot(completionReceipt);
        combatOutcomeRef.current = "victory";
        setDropItem(completionReceipt.result?.reward?.drop || null);
        setLastRewards({
          gold: 0,
          xp: 0,
          leveledUp: false,
          unlockedNext: false,
          newSkill: null,
          newPet: null,
          alreadyApplied: true,
          encounterType: completionReceipt.result?.reward?.encounterType,
          rewardRole: completionReceipt.result?.reward?.rewardRole,
          equipmentDrop: completionReceipt.result?.reward?.drop || null,
          firstClearAccessory: false,
          junkDrop: completionReceipt.result?.reward?.junkDrop || null
        });
        setBattleFinishing(false);
        setBusy(false);
        setPhase("result");
      } else {
        endCombatWin(next.battleId, completionReceipt?.result?.reward
          ? { ...completionReceipt.result.reward, authoritativeSnapshot: completionReceipt }
          : null);
      }
    }
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
      const resolved = DUNGEON_V2.simulateDungeonV2Battle(state, BATTLE_CORE_V1);
      applyCoreBattleState(resolved, false); finishCoreBattle(resolved); return;
    }
    if (actor.kind === "hero" && ["basic", "active"].includes(heroCommand?.type)) setHeroAnim("attack");
    else if (actor.kind === "pet") setPetAnim("attack");
    else if (actor.side === "enemy") setEnemyAnims(current => ({ ...current, [actor.id]: "attack" }));
    const result = BATTLE_CORE_V1.battleStep(state, actor.kind === "hero" ? heroCommand : undefined);
    const next = DUNGEON_V2.applyDungeonV2BossEnrage(result.state);
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
  async function consumeBattlePotion(state, potionId) {
    const def = getPotionDef(potionId);
    if (!def || !state?.battleId || busy) return;
    const operationKey = `${state.battleId}:${state.safeActionSeq}:${potionId}`;
    const requestId = potionRequestIdsRef.current.get(operationKey)
      || (globalThis.crypto?.randomUUID?.() || `potion-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    potionRequestIdsRef.current.set(operationKey, requestId);
    setBusy(true);
    const result = await cloudConsumePotion(cred.url, save.characterId, potionId, requestId);
    if (!result?.ok || activeCharacterIdRef.current !== save.characterId) {
      if (result?.error && !["network_error", "server_error", "timeout"].includes(result.error)) potionRequestIdsRef.current.delete(operationKey);
      setBusy(false);
      return;
    }
    potionRequestIdsRef.current.delete(operationKey);
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    const heroUnit = state.units[state.heroId];
    const heal = def.kind === "hp" ? heroUnit.maxHp * def.healPct : 0;
    const restoreSp = def.kind !== "hp" ? heroUnit.maxSp * def.healPct : 0;
    driveCoreBattle(state, { type: "potion", count: 1, heal, restoreSp });
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
      if (!getPotionDef(value) || potionTotal(inventory, value) <= 0) return;
      void consumeBattlePotion(state, value);
      return;
    }
    const command = action === "skill" ? { type: "active", skillId: value, targetId: targetUid }
      : action === "flee" ? { type: "flee" }
      : { type: "basic", targetId: targetUid };
    driveCoreBattle(state, command);
  }
  function enterStage(floorNum, carryPlayer = null, options = {}) {
    void (async () => {
    const allowResume = options.allowResume !== false;
    const resumableCheckpoint = allowResume && resumeBattle?.serverContext && Number(resumeBattle.floor) === Number(floorNum)
      ? resumeBattle
      : null;
    let battleAuthorization = null;
    setBusy(true);
    if (!resumableCheckpoint) {
      if (resumeBattle?.battleId) {
        const cleared = await cloudClearBattleCheckpoint(cred.url, save.characterId, resumeBattle.battleId);
        if (!cleared?.ok) throw new Error("checkpoint_reset_failed");
        setResumeBattle(null);
      }
      const started = await cloudStartDungeonBattle(cred.url, save.characterId, floorNum);
      if (!started?.ok || !started?.battleId || !started?.context) throw new Error(started?.error || "dungeon_start_failed");
      battleAuthorization = started;
    }
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
    // The map may preview a local encounter, but combat identity is established by
    // the Worker before Battle Core starts. Resume uses the same persisted context.
    const serverContext = resumableCheckpoint?.serverContext || battleAuthorization?.context;
    const spawned = makeEncounter(floorNum, { serverContext });
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
      statusResist: (baseStats.statusResist || 0) + (battleHardened?.statusResist || 0) + (petDefId === "moon_hare" ? 15 : 0)
    };
    const heroStartHp = (carryPlayer || resumeCarry) ? Math.min(stats.maxHp, nextPlayer.hp) : stats.maxHp;
    const learnedActives = heroActiveSkillList(save.character.skillLevels).map(skill => skill.key);
    const equippedActives = quickSlots.filter(slot => slot && slot.kind === "skill" && learnedActives.includes(slot.key)).map(slot => slot.key);
    let initialBattle;
    if (resumableCheckpoint) {
      try { initialBattle = BATTLE_CORE_V1.restoreCheckpoint(resumableCheckpoint); }
      catch (e) {
        await cloudClearBattleCheckpoint(cred.url, save.characterId, resumableCheckpoint.battleId);
        setResumeBattle(null);
        setBusy(false);
        enterStage(floorNum, carryPlayer, { ...options, allowResume: false });
        return;
      }
      setResumeBattle(null);
    }
    if (!initialBattle) initialBattle = BATTLE_CORE_V1.createDungeonBattle({
      battleId: battleAuthorization.battleId,
      floor: floorNum,
      mode: "dungeon",
      seed: battleAuthorization.context.encounterSeed,
      hero: {
        id: "hero", kind: "hero", side: "ally", name: save.characterName || "Hero", hp: heroStartHp, maxHp: stats.maxHp,
        sp: nextPlayer.mp, maxSp: stats.maxMp, atk: stats.atk, def: stats.def, speed: stats.speed,
        accuracy: stats.accuracy, dodge: stats.dodgeChance, crit: stats.critChance,
        critDamage: 1 + stats.critDamage / 100, agi: save.character.stats.agi,
        skills: save.character.skillLevels, activeSkills: equippedActives, statusResist: stats.statusResist,
        equipmentEffects: MYTHIC_V2.combatEffects(equipped)
      },
      pet: initialPet && {
        ...initialPet, id: "pet", kind: "pet", side: "ally", petDefId: initialPet.defId,
        def: Math.round(initialPet.def * (petDefId === "inferno_drake" ? 1.15 : 1)),
        accuracy: Math.min(99, initialPet.hitRate + (petDefId === "hell_wolf" ? 8 : 0)),
        dodge: initialPet.evasion + (petDefId === "storm_phoenix" ? 8 : 0),
        crit: initialPet.critChance + (petDefId === "ember_fox" ? 10 : 0),
        statusResist: petDefId === "moon_hare" ? 15 : 0
      },
      enemies: spawned.map((monster, index) => DUNGEON_V2.toDungeonV2BattleEnemy(monster, index))
    });
    if (battleAuthorization) initialBattle.serverContext = battleAuthorization.context;
    // Apply the Dungeon V2 enrage boundary before the first resumed checkpoint;
    // the serialized unit flag makes this exact-once across save/reload/resume.
    DUNGEON_V2.applyDungeonV2BossEnrage(initialBattle);
    applyCoreBattleState(initialBattle, false);
    pushBattleCheckpoint(initialBattle);
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
      setBusy(false);
      criticalAssets.settled.finally(() => warmBattleDeferredAssets(battleAssets));
    });
    })().catch(error => {
      setBusy(false);
      setBattleFinishing(false);
      setLog(error?.message === "dungeon_floor_locked"
        ? "This Dungeon Floor is not unlocked."
        : "Dungeon battle start failed — please try again.");
      setPhase("map");
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

  // Build the reward descriptor before Battle Result is committed. The Worker validates and
  // commits this descriptor together with the battle completion; this function has no state or
  // persistence side effects so a retry can submit the same plan safely.
  function buildDungeonRewardPlan(battleId = battleStateRef.current?.battleId || "") {
    const currentMonsters = monstersRef.current.length ? monstersRef.current : monsters;
    const currentPlayer = playerRef.current || player;
    if (!currentMonsters.length || currentMonsters.some(m => m.hp > 0)) return null;
    const encounterType = currentMonsters.map(m => m.encounterType).find(Boolean)
      || DUNGEON_V2.classifyDungeonEncounter(selectedFloor);
    const rewardRole = DUNGEON_REWARD_V2.dungeonV2RewardRole(encounterType);
    const packCount = currentMonsters.length;
    const gained = DUNGEON_REWARD_V2.dungeonV2RewardGold(selectedFloor, encounterType, packCount);
    const xpGained = DUNGEON_REWARD_V2.dungeonV2RewardExp(selectedFloor, encounterType, packCount);
    const bossMonster = currentMonsters.find(m => m.isBoss) || null;
    const currentReceipts = Array.isArray(save?.battleRewardReceipts) ? save.battleRewardReceipts : (Array.isArray(save?.rewardReceipts) ? save.rewardReceipts : []);
    const firstClearClaims = save?.firstClearAccessoryClaims || {};
    const unlockedNext = selectedFloor === save?.unlockedFloor;
    const firstClear = DUNGEON_REWARD_V2.dungeonV2FirstClearEligible({
      floor: selectedFloor,
      encounterType,
      unlockedNext,
      receipts: currentReceipts,
      firstClearAccessoryClaims: firstClearClaims
    });
    const starter = typeof starterPetDef === "function" ? starterPetDef() : null;
    const starterPetEligible = !!(starter && DUNGEON_V2.isDungeonV2StarterPetEligible({
      floor: selectedFloor,
      monsters: currentMonsters,
      unlockedNext,
      alreadyHasStarter: (save?.pets || []).some(p => p.defId === starter.id)
    }));
    let drop = null;
    let junkDrop = null;
    const incomingItems = [];
    if (rewardRole === "normal") {
      const junkDrops = [];
      currentMonsters.forEach(m => {
        const matChance = 0.45 + (currentPlayer?.dropBonus || 0) / 100 + (m.modifier?.dropBonusFlat || 0) / 100;
        if (Math.random() < matChance) {
          const jd = rollJunkDrop(selectedFloor, m.modifier);
          junkDrops.push(jd);
          incomingItems.push({ ...makeJunkItem(jd.type, 1), quantity: jd.amount });
        }
      });
      if (junkDrops.length) {
        const merged = {};
        junkDrops.forEach(jd => { merged[jd.type] = (merged[jd.type] || 0) + jd.amount; });
        const [type, amount] = Object.entries(merged)[0];
        junkDrop = { type, amount };
      }
      for (const monster of currentMonsters) {
        if (Math.random() < DUNGEON_REWARD_V2.dungeonV2GenericEquipmentChance("normal", currentPlayer?.dropBonus)) {
          drop = DUNGEON_REWARD_V2.dungeonV2GenerateEquipment({
            floor: selectedFloor,
            sourceType: "dungeon_normal",
            sourceIdentity: monster.id,
            lootTable: typeof monsterLootFor === "function" ? monsterLootFor(monster.id) : null
          });
          incomingItems.push(drop);
          break;
        }
      }
    } else if (rewardRole === "elite") {
      if (Math.random() < DUNGEON_REWARD_V2.dungeonV2GenericEquipmentChance("elite")) {
        drop = DUNGEON_REWARD_V2.dungeonV2GenerateEquipment({
          floor: selectedFloor,
          sourceType: "dungeon_elite",
          sourceIdentity: currentMonsters[0]?.id || null,
          lootTable: typeof monsterLootFor === "function" ? monsterLootFor(currentMonsters[0]?.id) : null
        });
        incomingItems.push(drop);
      }
      const eliteMonster = currentMonsters[0];
      const eliteMaterialChance = 0.45 + (currentPlayer?.dropBonus || 0) / 100 + (eliteMonster?.modifier?.dropBonusFlat || 0) / 100;
      if (Math.random() < eliteMaterialChance) {
        const material = rollJunkDrop(selectedFloor, eliteMonster?.modifier);
        material.amount = Math.max(1, Math.round(material.amount * 2));
        incomingItems.push({ ...makeJunkItem(material.type, 1), quantity: material.amount });
        junkDrop = { type: material.type, amount: material.amount };
      }
    } else if (firstClear) {
      const accessory = DUNGEON_REWARD_V2.dungeonV2FirstClearAccessory(selectedFloor);
      drop = DUNGEON_REWARD_V2.dungeonV2EquipmentItem({
        floor: selectedFloor,
        type: "accessory",
        rarity: accessory.rarity,
        sourceType: "dungeon_boss_first_clear",
        specialSource: "first_clear_accessory",
        sourceIdentity: bossMonster?.id || "chapter_boss"
      });
      incomingItems.push(drop);
    }
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
    return {
      battleId,
      floor: selectedFloor,
      encounterType,
      rewardRole,
      packCount,
      gold: gained,
      xp: xpGained,
      // Dungeon Reward V2 has no approved Diamond source. The Worker is authoritative
      // and normalizes this field to zero; keep the client descriptor aligned for
      // offline/retry parity instead of advertising a legacy boss Diamond grant.
      diamonds: 0,
      unlockedNext,
      firstClear,
      starterPetGrant: starterPetEligible ? { instance: newPetInstance(starter.id), defId: starter.id } : null,
      items: incomingItems,
      drop,
      junkDrop,
      sourceIdentity: bossMonster?.id || currentMonsters[0]?.id || null
    };
  }

  function applyCommittedDungeonReward(plan) {
    // The Worker has already committed the reward and returned the post-transaction
    // snapshot. Never mirror the descriptor back through generic save/item persistence:
    // that can race a newer server result and used to make the client a second writer.
    if (plan?.authoritativeSnapshot?.character) {
      const snapshot = plan.authoritativeSnapshot;
      const reward = plan;
      hydrateCommittedBattleSnapshot(snapshot);
      setDropItem(reward.drop || null);
      const authoritativeSave = flattenCharacterForRuntime({
        saveVersion: save.saveVersion,
        diamonds: snapshot.diamonds === undefined ? save.diamonds : Number(snapshot.diamonds) || 0,
        characters: [characterFromServerRow(snapshot.character)]
      }, 0);
      const currentMonsters = monstersRef.current.length ? monstersRef.current : monsters;
      const bossMonster = currentMonsters.find(m => m.isBoss) || null;
      const rewardFloor = Number(reward.floor) || selectedFloor;
      const nextPlayer = freshPlayerFromSave(authoritativeSave, {
        hp: battleStateRef.current?.flags.heroReviveNextFloor ? 1 : (playerRef.current || player)?.hp,
        mp: (playerRef.current || player)?.mp
      });
      setPlayer(nextPlayer);
      saveCombatRunState(rewardFloor, nextPlayer);
      setLastRewards({
        gold: Number(reward.gold) || 0,
        xp: Number(reward.xp) || 0,
        leveledUp: Number(snapshot.character.level) > Number(save.character.level),
        unlockedNext: !!reward.unlockedNext,
        newSkill: null,
        newPet: reward.starterPetGrant ? starterPetDef() : null,
        isBoss: !!bossMonster,
        encounterType: reward.encounterType,
        rewardRole: reward.rewardRole,
        equipmentDrop: reward.drop || null,
        firstClearAccessory: !!reward.firstClear,
        junkDrop: reward.junkDrop || null,
        modifier: currentMonsters.map(m => m.modifier).find(Boolean) || null,
        isEliteBoss: !!(bossMonster && bossMonster.isEliteBoss),
        diamonds: Number(reward.diamonds) || 0,
        petProgress: reward.petProgress ? { ...reward.petProgress, name: getPetDef(reward.petProgress.defId)?.name || "Pet" } : null,
        alreadyCommitted: true
      });
      setLog(`Victory! +${Number(reward.gold) || 0}g, +${Number(reward.xp) || 0}xp`);
      setPhase("result");
      return;
    }
    const currentMonsters = monstersRef.current.length ? monstersRef.current : monsters;
    const currentPlayer = playerRef.current || player;
    const gained = Number(plan?.gold) || 0;
    const xpGained = Number(plan?.xp) || 0;
    const selectedRewardFloor = Number(plan?.floor) || selectedFloor;
    const unlockedNext = !!plan?.unlockedNext;
    const firstClear = !!plan?.firstClear;
    const drop = plan?.drop || null;
    const junkDrop = plan?.junkDrop || null;
    const incomingItems = Array.isArray(plan?.items) ? plan.items : [];
    if (incomingItems.length) insertCarriedItems(incomingItems);
    setDropItem(drop);
    const bossMonster = currentMonsters.find(m => m.isBoss) || null;
    const diamondsGained = Number(plan?.diamonds) || 0;
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
    const newSkill = null;
    let newPets = grantActivePetBattleXp(save.pets, save.activePetId, xpGained);
    const petProgress = petProgressChange(save.pets, newPets, save.activePetId);
    let newActivePetId = save.activePetId;
    let newPet = null;
    const alreadyHasStarter = (save.pets || []).some(p => p.defId === starterPetDef().id);
    const committedStarter = plan?.starterPetGrant?.instance;
    if (committedStarter && !alreadyHasStarter) {
      newPets = [...newPets, committedStarter];
      if (!newActivePetId) newActivePetId = committedStarter.instId;
      newPet = starterPetDef();
    }
    if (!committedStarter && DUNGEON_V2.isDungeonV2StarterPetEligible({
      floor: selectedRewardFloor,
      monsters: currentMonsters,
      unlockedNext,
      alreadyHasStarter
    })) {
      const starter = starterPetDef();
      const inst = newPetInstance(starter.id);
      newPets = [...newPets, inst];
      if (!newActivePetId) newActivePetId = inst.instId;
      newPet = starter;
    }
    const battleReceipt = DUNGEON_REWARD_V2.dungeonV2RewardReceiptKey(plan?.battleId || battleStateRef.current?.battleId || "");
    const currentBattleReceipts = Array.isArray(save.battleRewardReceipts) ? save.battleRewardReceipts : (Array.isArray(save.rewardReceipts) ? save.rewardReceipts : []);
    const nextClaims = firstClear
      ? DUNGEON_REWARD_V2.dungeonV2ClaimFirstClear(save.firstClearAccessoryClaims, selectedRewardFloor)
      : (save.firstClearAccessoryClaims || {});
    const nextBattleReceipts = DUNGEON_REWARD_V2.dungeonV2AppendReceipts(currentBattleReceipts, battleReceipt);
    const nextSave = {
      ...save,
      gold: save.gold + gained,
      diamonds: save.diamonds + diamondsGained,
      unlockedFloor: unlockedNext ? save.unlockedFloor + 1 : save.unlockedFloor,
      chestPity: save.chestPity || 0,
      firstClearAccessoryClaims: nextClaims,
      battleRewardReceipts: nextBattleReceipts,
      rewardReceipts: nextBattleReceipts,
      character: { ...save.character, level, xp, statPoints },
      pets: newPets,
      activePetId: newActivePetId
    };
    setLocalCharacterView(nextSave);
    const postBattlePlayer = freshPlayerFromSave(nextSave, {
      hp: battleStateRef.current?.flags.heroReviveNextFloor ? 1 : currentPlayer.hp,
      mp: currentPlayer.mp
    });
    setPlayer(postBattlePlayer);
    saveCombatRunState(selectedRewardFloor, postBattlePlayer);
    setLastRewards({
      gold: gained,
      xp: xpGained,
      leveledUp,
      unlockedNext,
      newSkill,
      newPet,
      isBoss: !!bossMonster,
      encounterType: plan.encounterType,
      rewardRole: plan.rewardRole,
      equipmentDrop: drop,
      firstClearAccessory: firstClear,
      junkDrop,
      modifier: currentMonsters.map(m => m.modifier).find(Boolean) || null,
      isEliteBoss: !!(bossMonster && bossMonster.isEliteBoss),
      diamonds: diamondsGained,
      petProgress: petProgress ? { ...petProgress, name: getPetDef(petProgress.defId)?.name || petCombatRef.current?.name || "Pet" } : null
    });
    setLog(newPet ? `Victory! You received a companion: ${newPet.name}!` : newSkill ? `Victory! Level up! New skill: ${newSkill.name}!` : leveledUp ? `Victory! Level up! +${gained}g` : `Victory! +${gained}g, +${xpGained}xp`);
    setPhase("result");
  }
  function hydrateCommittedBattleSnapshot(snapshot) {
    if (!snapshot?.character) return;
    const slot = characterFromServerRow(snapshot.character);
    const nextSave = flattenCharacterForRuntime({
      saveVersion: save.saveVersion,
      diamonds: snapshot.diamonds === undefined ? save.diamonds : Number(snapshot.diamonds) || 0,
      characters: [slot]
    }, 0);
    const loaded = itemsFromServerList(snapshot.items || []);
    equippedRef.current = loaded.equipped;
    inventoryRef.current = loaded.inventory;
    inventoryOverflowRef.current = loaded.overflow;
    setEquipped(loaded.equipped);
    setInventory(loaded.inventory);
    setInventoryOverflow(loaded.overflow);
    setSave(nextSave);
    setAccount(previous => {
      if (!previous) return previous;
      const characters = previous.characters.slice();
      const slotIndex = characters.findIndex(candidate => candidate?.id === snapshot.character.character_id);
      if (slotIndex < 0) return previous;
      characters[slotIndex] = slot;
      return { ...previous, diamonds: nextSave.diamonds, characters };
    });
  }

  function endCombatWin(battleId = battleStateRef.current?.battleId || "", committedReward = null) {
    if (combatOutcomeRef.current) return;
    const currentMonsters = monstersRef.current.length ? monstersRef.current : monsters;
    const currentPlayer = playerRef.current || player;
    if (!currentMonsters.length || currentMonsters.some(m => m.hp > 0)) return;
    combatOutcomeRef.current = "victory";
    if (runStateSaveTimer.current) clearTimeout(runStateSaveTimer.current);
    setBusy(false);
    if (committedReward) {
      applyCommittedDungeonReward({ ...committedReward, battleId });
      return;
    }
    const encounterType = currentMonsters.map(m => m.encounterType).find(Boolean)
      || DUNGEON_V2.classifyDungeonEncounter(selectedFloor);
    const rewardRole = DUNGEON_REWARD_V2.dungeonV2RewardRole(encounterType);
    const packCount = currentMonsters.length;
    const gained = DUNGEON_REWARD_V2.dungeonV2RewardGold(selectedFloor, encounterType, packCount);
    const xpGained = DUNGEON_REWARD_V2.dungeonV2RewardExp(selectedFloor, encounterType, packCount);
    const bossMonster = currentMonsters.find(m => m.isBoss) || null;
    const modifier = currentMonsters.map(m => m.modifier).find(Boolean) || null;
    const currentReceipts = Array.isArray(save.battleRewardReceipts) ? save.battleRewardReceipts : (Array.isArray(save.rewardReceipts) ? save.rewardReceipts : []);
    const firstClearClaims = save.firstClearAccessoryClaims || {};
    const battleReceipt = DUNGEON_REWARD_V2.dungeonV2RewardReceiptKey(battleId);
    if (DUNGEON_REWARD_V2.dungeonV2HasReceipt(currentReceipts, battleReceipt)) return;
    let drop = null;
    let junkDrop = null;
    const incomingItems = [];
    const unlockedNext = selectedFloor === save.unlockedFloor;
    const firstClear = DUNGEON_REWARD_V2.dungeonV2FirstClearEligible({
      floor: selectedFloor,
      encounterType,
      unlockedNext,
      receipts: currentReceipts,
      firstClearAccessoryClaims: firstClearClaims
    });
    if (rewardRole === "normal") {
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
      // Generic equipment uses one independent 4% roll per defeated monster, but
      // the encounter can receive at most one item. Custom monster_loot rows may
      // choose a slot/rarity, but cannot escape the V2 pool or Mythic cap.
      for (const monster of currentMonsters) {
        if (Math.random() < DUNGEON_REWARD_V2.dungeonV2GenericEquipmentChance("normal", currentPlayer?.dropBonus)) {
          drop = DUNGEON_REWARD_V2.dungeonV2GenerateEquipment({
            floor: selectedFloor,
            sourceType: "dungeon_normal",
            sourceIdentity: monster.id,
            lootTable: typeof monsterLootFor === "function" ? monsterLootFor(monster.id) : null
          });
          incomingItems.push(drop);
          break;
        }
      }
    } else if (rewardRole === "elite") {
      // Elite is one encounter-level roll, not Normal's per-monster roll.
      if (Math.random() < DUNGEON_REWARD_V2.dungeonV2GenericEquipmentChance("elite")) {
        drop = DUNGEON_REWARD_V2.dungeonV2GenerateEquipment({
          floor: selectedFloor,
          sourceType: "dungeon_elite",
          sourceIdentity: currentMonsters[0]?.id || null,
          lootTable: typeof monsterLootFor === "function" ? monsterLootFor(currentMonsters[0]?.id) : null
        });
        incomingItems.push(drop);
      }
      // Preserve the existing junk-material architecture while applying the
      // contracted approximately x2 Elite quantity where that architecture exists.
      const eliteMonster = currentMonsters[0];
      const eliteMaterialChance = 0.45 + (currentPlayer?.dropBonus || 0) / 100 + (eliteMonster?.modifier?.dropBonusFlat || 0) / 100;
      if (Math.random() < eliteMaterialChance) {
        const material = rollJunkDrop(selectedFloor, eliteMonster?.modifier);
        material.amount = Math.max(1, Math.round(material.amount * 2));
        incomingItems.push({ ...makeJunkItem(material.type, 1), quantity: material.amount });
        junkDrop = { type: material.type, amount: material.amount };
      }
    } else if (firstClear) {
      const accessory = DUNGEON_REWARD_V2.dungeonV2FirstClearAccessory(selectedFloor);
      drop = DUNGEON_REWARD_V2.dungeonV2EquipmentItem({
        floor: selectedFloor,
        type: "accessory",
        rarity: accessory.rarity,
        sourceType: "dungeon_boss_first_clear",
        specialSource: "first_clear_accessory",
        sourceIdentity: bossMonster?.id || "chapter_boss"
      });
      // The existing capacity-safe insertion boundary routes a full inventory
      // into persistent Overflow/mailbox-compatible storage.
      incomingItems.push(drop);
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
    const diamondsGained = 0;
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
    // The equipped Pet participated even if it died, so it receives 80% of the
    // total Hero battle EXP before any new starter Pet is awarded.
    let newPets = grantActivePetBattleXp(save.pets, save.activePetId, xpGained);
    const petProgress = petProgressChange(save.pets, newPets, save.activePetId);
    let newActivePetId = save.activePetId;
    let newPet = null;
    const alreadyHasStarter = (save.pets || []).some(p => p.defId === starterPetDef().id);
    if (DUNGEON_V2.isDungeonV2StarterPetEligible({
      floor: selectedFloor,
      monsters: currentMonsters,
      unlockedNext,
      alreadyHasStarter
    })) {
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
      chestPity: save.chestPity || 0,
      firstClearAccessoryClaims: firstClear
        ? DUNGEON_REWARD_V2.dungeonV2ClaimFirstClear(firstClearClaims, selectedFloor)
        : firstClearClaims,
      battleRewardReceipts: DUNGEON_REWARD_V2.dungeonV2AppendReceipts(currentReceipts, battleReceipt),
      rewardReceipts: DUNGEON_REWARD_V2.dungeonV2AppendReceipts(currentReceipts, battleReceipt),
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
    setLocalCharacterView(nextSave);
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
      encounterType,
      rewardRole,
      equipmentDrop: drop,
      firstClearAccessory: firstClear,
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
  async function commitStatDraft(draft) {
    const safeDraft = Object.fromEntries(STAT_INFO.map(st => [st.key, Math.max(0, Math.floor(Number(draft?.[st.key]) || 0))]));
    const used = Object.values(safeDraft).reduce((sum, value) => sum + value, 0);
    if (!used || used > save.character.statPoints) return false;
    if (!await flushRewardClaimBarrier(save.characterId)) return false;
    const requestId = globalThis.crypto?.randomUUID?.() || `stat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudAllocateStats(cred.url, save.characterId, safeDraft, requestId);
    if (!result?.ok) return false;
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    return true;
  }
  async function resetAllStats() {
    const refunded = STAT_INFO.reduce((sum, st) => sum + Math.max(0, Number(save.character.stats[st.key]) || 0), 0);
    if (!refunded || save.diamonds < STAT_RESET_COST || !await flushRewardClaimBarrier(save.characterId)) return false;
    const requestId = globalThis.crypto?.randomUUID?.() || `stat-reset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudResetCharacterStats(cred.url, save.characterId, requestId);
    if (!result?.ok) return false;
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    return true;
  }
  async function commitSkillDraft(draft) {
    const normalized = Object.fromEntries(Object.entries(draft || {}).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]).filter(([, value]) => value > 0));
    if (!Object.keys(normalized).length || !await flushRewardClaimBarrier(save.characterId)) return false;
    const requestId = globalThis.crypto?.randomUUID?.() || `skill-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudAllocateHeroSkills(cred.url, save.characterId, normalized, requestId);
    if (!result?.ok) return false;
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    return true;
  }
  function learnHeroSkill(id) { return commitSkillDraft({ [id]: 1 }); }
  async function resetAllSkills() {
    if (!heroSkillSpentPoints(save.character.skillLevels) || save.diamonds < SKILL_RESET_COST || !await flushRewardClaimBarrier(save.characterId)) return false;
    const requestId = globalThis.crypto?.randomUUID?.() || `skill-reset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudResetHeroSkills(cred.url, save.characterId, requestId);
    if (!result?.ok) return false;
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
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
  async function sellItem(item) {
    if (item?.favorite) return { ok: false, message: "ปลด Favorite/Lock ก่อนขาย" };
    const found = findItemAndLocation(item?.id);
    if (!found || found.location === "equipped") return { ok: false, message: "ถอดอุปกรณ์ก่อนขาย" };
    if (!await flushRewardClaimBarrier(save.characterId)) return { ok: false, message: "บันทึกสถานะก่อนขายไม่สำเร็จ กรุณาลองใหม่" };
    const requestId = globalThis.crypto?.randomUUID?.() || `sell-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudSellCharacterItem(cred.url, save.characterId, item.id, requestId);
    if (!result?.ok) return { ok: false, message: result?.error === "item_favorited" ? "ปลด Favorite/Lock ก่อนขาย" : "ขายไอเท็มไม่สำเร็จ กรุณาลองใหม่" };
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    return { ok: true, message: `ขายสำเร็จ ได้รับ 🪙${result.result?.goldGained || 0}` };
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
  function hydrateAuthoritativeBlacksmithSnapshot(snapshot, expectedCharacterId = "") {
    const snapshotCharacterId = snapshot?.character?.character_id;
    if (!snapshotCharacterId || (expectedCharacterId && snapshotCharacterId !== expectedCharacterId)
      || (activeCharacterIdRef.current && activeCharacterIdRef.current !== snapshotCharacterId)) return;
    const currentSave = save || defaultSave();
    const slot = characterFromServerRow(snapshot.character);
    const loaded = itemsFromServerList(snapshot.items || []);
    equippedRef.current = loaded.equipped;
    inventoryRef.current = loaded.inventory;
    inventoryOverflowRef.current = loaded.overflow;
    setEquipped(loaded.equipped);
    setInventory(loaded.inventory);
    setInventoryOverflow(loaded.overflow);
    const diamonds = snapshot.diamonds === undefined ? Number(currentSave.diamonds) || 0 : Number(snapshot.diamonds) || 0;
    const nextSave = flattenCharacterForRuntime({ saveVersion: currentSave.saveVersion, diamonds, characters: [slot] }, 0);
    setSave(nextSave);
    setAccount(previous => {
      if (!previous) return previous;
      const characters = previous.characters.slice();
      const slotIndex = characters.findIndex(candidate => candidate?.id === snapshotCharacterId);
      if (slotIndex < 0) return previous;
      characters[slotIndex] = slot;
      return { ...previous, diamonds, characters };
    });
  }
  function blacksmithRequestId(action, itemId) {
    const suffix = typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `w3:${action}:${itemId}:${suffix}`;
  }
  async function mutateLegacyBlacksmith(itemId, mutation) {
    const context = persistenceContextFor(save.characterId);
    if (!context || !await flushRewardClaimBarrier(save.characterId)) return { ok: false, message: "บันทึกสถานะก่อนทำรายการไม่สำเร็จ กรุณาลองใหม่" };
    const requestKey = `legacy:${mutation.type}:${itemId}:${mutation.slotIndex ?? ""}:${mutation.useProtectionStone ? 1 : 0}`;
    const requestId = blacksmithRequestRef.current.get(requestKey) || `legacy-${mutation.type}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    blacksmithRequestRef.current.set(requestKey, requestId);
    const res = await cloudMutateLegacyBlacksmith(cred.url, save.characterId, itemId, mutation, requestId);
    if (!res?.ok) {
      if (!["network_error", "server_error", "timeout"].includes(res?.error)) blacksmithRequestRef.current.delete(requestKey);
      if (res?.character) hydrateAuthoritativeBlacksmithSnapshot(res);
      return { ok: false, message: res?.error === "insufficient_gold" ? "ทองไม่พอ" : res?.error === "insufficient_materials" ? "วัตถุดิบไม่พอ" : "ทำรายการ Blacksmith ไม่สำเร็จ" };
    }
    blacksmithRequestRef.current.delete(requestKey);
    hydrateAuthoritativeBlacksmithSnapshot(res);
    return { ok: true, result: res.result || {} };
  }
  async function mutateV2Blacksmith(itemId, mutation) {
    const context = persistenceContextFor(save.characterId);
    if (!context) return { ok: false, message: "ไม่พบสถานะ Cloud ของตัวละคร" };
    // Drain every older full-snapshot write before the authoritative transaction. Without
    // this barrier, a delayed pre-mutation Gold/items snapshot could arrive afterward and
    // restore resources or overwrite the server-confirmed item state.
    persistItems(inventoryRef.current, equippedRef.current, inventoryOverflowRef.current);
    const flushed = await persistenceRef.current.flush(context, { retryFailed: true });
    if (!flushed) return { ok: false, message: "บันทึกสถานะก่อนทำรายการไม่สำเร็จ กรุณาลองใหม่" };
    const requestKey = `${mutation.type}:${itemId}:${Number(mutation.expectedVersion) || 0}:${Number(mutation.slotIndex) || 0}:${mutation.useProtectionStone === true ? 1 : 0}`;
    const requestId = blacksmithRequestRef.current.get(requestKey) || blacksmithRequestId(mutation.type, itemId);
    blacksmithRequestRef.current.set(requestKey, requestId);
    const res = await cloudMutateV2Blacksmith(cred.url, save.characterId, itemId, mutation, requestId);
    if (!res?.ok) {
      if (!["network_error", "server_error", "timeout"].includes(res?.error)) blacksmithRequestRef.current.delete(requestKey);
      if (res?.character) hydrateAuthoritativeBlacksmithSnapshot(res);
      const messages = {
        enhance_max: "ตีบวกถึงระดับสูงสุดแล้ว (+10)",
        insufficient_gold: "ทองไม่พอ",
        insufficient_materials: res?.junkId === "iron" ? "เหล็กไม่พอ" : "Mana Ore ไม่พอ",
        insufficient_protection_stones: "Protection Stone ไม่พอ",
        protection_not_eligible: "ใช้ Protection Stone ได้ตั้งแต่การตี +6 → +7",
        empower_slots_full: "เสริมพลังครบทุกช่องแล้ว",
        cannot_lock_all_empower_slots: "ต้องเหลืออย่างน้อย 1 ช่องที่ปลดล็อกสำหรับรีโรล",
        all_empower_slots_locked: "ล็อกไว้ทุกออฟชั่นแล้ว ไม่มีช่องให้รีโรล",
        wing_empower_economy_unresolved: "Empower ของปีก Raid ยังไม่พร้อม",
        blacksmith_conflict: "สถานะไอเทมเปลี่ยนแล้ว กรุณาลองใหม่",
        blacksmith_version_conflict: "สถานะไอเทมเปลี่ยนแล้ว กรุณาโหลดสถานะล่าสุด"
      };
      return { ok: false, message: messages[res?.error] || "ทำรายการ Blacksmith V2 ไม่สำเร็จ" };
    }
    blacksmithRequestRef.current.delete(requestKey);
    hydrateAuthoritativeBlacksmithSnapshot(res);
    const result = res.mutation || {};
    if (mutation.type === "enhance") {
      if (result.success) return { ok: true, message: `✨ ตีบวกสำเร็จ! +${result.levelAfter}` };
      if (result.protectionConsumed) return { ok: false, message: `🛡️ ตีบวกล้มเหลว แต่ Protection Stone ป้องกันการลดระดับไว้ (+${result.levelAfter})` };
      if (result.downgraded) return { ok: false, message: `💥 ตีบวกล้มเหลว ลดเหลือ +${result.levelAfter}` };
      return { ok: false, message: `💢 ตีบวกล้มเหลว ระดับคงเดิม +${result.levelAfter}` };
    }
    if (mutation.type === "empower_open") return { ok: true, message: `🔮 เสริมพลังสำเร็จ! ${result.option?.icon || "✦"} +${result.option?.value || 0} ${result.option?.label || ""}` };
    if (mutation.type === "empower_lock") return { ok: true, message: result.locked ? "🔒 ล็อกออฟชั่นแล้ว" : "🔓 ปลดล็อกออฟชั่นแล้ว" };
    return { ok: true, message: `🔄 รีโรลออฟชั่นสำเร็จ! (ใช้ Mana Ore ×1 และ Gold ${result.cost?.gold || 0})` };
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
  function enhanceItem(itemId, useProtectionStone = false) {
    const found = findItemAndLocation(itemId);
    if (!found) return {
      ok: false,
      message: "ไม่พบไอเทม"
    };
    const it = found.item;
    if (ENHANCEMENT_V2.isV2Item(it)) return mutateV2Blacksmith(itemId, { type: "enhance", useProtectionStone: useProtectionStone === true, expectedVersion: Number(it.blacksmithVersion) || 0 });
    const level = it.enhanceLevel || 0;
    if (level >= ENHANCE_MAX) return {
      ok: false,
      message: "ตีบวกถึงระดับสูงสุดแล้ว (+" + ENHANCE_MAX + ")"
    };
    const wantsStone = useProtectionStone === true || (level >= ENHANCE_DOWNGRADE_LEVEL && (save.protectionStones || 0) > 0);
    return mutateLegacyBlacksmith(itemId, { type: "enhance", useProtectionStone: wantsStone }).then(({ ok, result }) => ({
      ok: !!ok && !!result.success,
      message: !ok ? "ทำรายการ Blacksmith ไม่สำเร็จ" : result.success ? `✨ ตีบวกสำเร็จ! ${it.name} +${result.levelAfter}` : result.protectionConsumed ? `🛡️ ตีบวกล้มเหลว แต่หินป้องกันช่วยไว้! ${it.name} ยังคง +${result.levelAfter}` : result.levelAfter < level ? `💥 ตีบวกล้มเหลว! ${it.name} ร่วงเหลือ +${result.levelAfter}` : `💢 ตีบวกล้มเหลว... (${it.name} ยังคง +${result.levelAfter})`
    }));
  }
  function toggleEmpowerLock(itemId, slotIndex) {
    const found = findItemAndLocation(itemId);
    if (!found) return { ok: false, message: "ไม่พบไอเทม" };
    if (ENHANCEMENT_V2.isV2Item(found.item)) return mutateV2Blacksmith(itemId, { type: "empower_lock", slotIndex, expectedVersion: Number(found.item.blacksmithVersion) || 0 });
    return mutateLegacyBlacksmith(itemId, { type: "empower_lock", slotIndex });
  }
  function rerollEmpowerItem(itemId) {
    const found = findItemAndLocation(itemId);
    if (!found) return {
      ok: false,
      message: "ไม่พบไอเทม"
    };
    const it = found.item;
    if (ENHANCEMENT_V2.isV2Item(it)) return mutateV2Blacksmith(itemId, { type: "empower_reroll", expectedVersion: Number(it.blacksmithVersion) || 0 });
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
    return mutateLegacyBlacksmith(itemId, { type: "empower_reroll" }).then(({ ok }) => ({ ok, message: ok ? `🔄 รีรอลออฟชั่นสำเร็จ! (ล็อกไว้ ${lockedCount} ช่อง)` : "รีรอลออฟชั่นไม่สำเร็จ" }));
  }
  async function salvageItem(itemId) {
    const found = findItemAndLocation(itemId);
    if (!found) return { ok: false, message: "ไม่พบไอเทม" };
    if (found.location === "equipped") return { ok: false, message: "ถอดอุปกรณ์ก่อนแยกชิ้นส่วน" };
    if (found.item.favorite) return { ok: false, message: "ปลด Favorite/Lock ก่อนแยกชิ้นส่วน" };
    if (!await flushRewardClaimBarrier(save.characterId)) return { ok: false, message: "บันทึกสถานะก่อนแยกชิ้นส่วนไม่สำเร็จ กรุณาลองใหม่" };
    const requestId = globalThis.crypto?.randomUUID?.() || `salvage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudSalvageItem(cred.url, save.characterId, itemId, requestId);
    if (!result?.ok) {
      const messages = {
        salvage_not_eligible: "ไอเทมนี้ยังไม่อยู่ในตาราง Salvage V2",
        mythic_salvage_not_eligible: "ไอเทมพิเศษนี้ไม่มีสูตรแยกชิ้นส่วนที่รองรับ",
        item_equipped: "ถอดอุปกรณ์ก่อนแยกชิ้นส่วน",
        item_favorited: "ปลด Favorite/Lock ก่อนแยกชิ้นส่วน"
      };
      return { ok: false, message: messages[result?.error] || "แยกชิ้นส่วนไม่สำเร็จ กรุณาลองใหม่" };
    }
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    const returned = (result.salvage?.materials || []).map(item => `${JUNK_INFO[item.junkId]?.icon || "📦"}${item.quantity} ${JUNK_INFO[item.junkId]?.name || item.junkId}`);
    return { ok: true, message: returned.length ? `♻️ แยกชิ้นส่วนได้ ${returned.join(" + ")}` : "♻️ แยกชิ้นส่วนแล้ว ไม่มีวัตถุดิบคืน" };
  }
  async function buyCharacterResource(kind, id = "") {
    if (!await flushRewardClaimBarrier(save.characterId)) return false;
    const requestId = globalThis.crypto?.randomUUID?.() || `purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudPurchaseCharacterResource(cred.url, save.characterId, { kind, id }, requestId);
    if (!result?.ok) return false;
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    return true;
  }
  function buyProtectionStone() {
    if (save.diamonds < PROTECTION_STONE_PRICE) return false;
    return buyCharacterResource("protection_stone");
  }
  function buyMaterial(type) {
    const price = MATERIAL_SHOP_PRICE[type];
    if (!price || save.gold < price) return false;
    return buyCharacterResource("material", type);
  }
  function empowerItem(itemId) {
    const found = findItemAndLocation(itemId);
    if (!found) return {
      ok: false,
      message: "ไม่พบไอเทม"
    };
    const it = found.item;
    if (ENHANCEMENT_V2.isV2Item(it)) return mutateV2Blacksmith(itemId, { type: "empower_open", expectedVersion: Number(it.blacksmithVersion) || 0 });
    const slots = it.empowerSlots || [];
    const nextIndex = slots.findIndex(s => !s);
    if (nextIndex === -1) return {
      ok: false,
      message: "เสริมพลังครบทุกออฟชั่นแล้ว"
    };
    return mutateLegacyBlacksmith(itemId, { type: "empower_open" }).then(({ ok, result }) => ({ ok, message: ok ? `🔮 เสริมพลังสำเร็จ! ได้รับ ${result.option?.icon || "✦"} +${result.option?.value || 0} ${result.option?.label || ""}` : "เสริมพลังไม่สำเร็จ" }));
  }
  async function openShop() {
    const requestId = globalThis.crypto?.randomUUID?.() || `shop-stock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudGetCharacterShopStock(cred.url, save.characterId, requestId);
    if (!result?.ok) return false;
    setShopStock({ items: result.result?.items || [], potions: POTION_DEFS });
    setShopOpen(true);
    return true;
  }
  async function buyShopItem(item) {
    if (!item?.offerId || save.gold < Number(item.price) || !await flushRewardClaimBarrier(save.characterId)) return false;
    const requestId = globalThis.crypto?.randomUUID?.() || `shop-buy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudPurchaseShopEquipment(cred.url, save.characterId, item.offerId, requestId);
    if (!result?.ok) return false;
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    setShopStock(stock => ({ ...stock, items: (stock?.items || []).filter(entry => entry.offerId !== item.offerId) }));
    return true;
  }
  function buyShopPotionTier(potionId) {
    const def = getPotionDef(potionId);
    if (!def || save.gold < def.price) return false;
    return buyCharacterResource("potion", potionId);
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
  async function commitActivePet(petAction, instId = "") {
    if (!await flushRewardClaimBarrier(save.characterId)) return false;
    const result = await cloudPetEconomyAction(cred.url, save.characterId, petAction, instId, "");
    if (!result?.ok) return false;
    petCombatRef.current = null;
    setPetCombat(null);
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    return true;
  }
  function equipPet(instId) { return commitActivePet("equip", instId); }
  function unequipPet() { return commitActivePet("unequip"); }
  async function pullGacha() {
    if (save.diamonds < GACHA_COST || !await flushRewardClaimBarrier(save.characterId)) return false;
    const requestId = globalThis.crypto?.randomUUID?.() || `pet-gacha-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudPetEconomyAction(cred.url, save.characterId, "gacha", "", requestId);
    if (!result?.ok) return false;
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    setGachaResult({ pet: getPetDef(result.result?.defId), duplicate: !!result.result?.duplicate });
    return true;
  }
  // Spends duplicates from save.petDuplicates[defId] to raise one pet instance's star by 1.
  // Returns {ok:true} on success, or {ok:false, need, have} so the UI can show exactly how many
  // more duplicates are needed (and highlight the shortfall) without guessing.
  async function starUpPet(instId) {
    const pets = save.pets || [];
    const pet = pets.find(p => p.instId === instId);
    if (!pet) return { ok: false, need: 0, have: 0 };
    const cost = petStarUpCost(pet.star || 1);
    if (cost === null) return { ok: false, maxed: true };
    const have = petDuplicateCount(save.petDuplicates, pet.defId);
    if (have < cost) return { ok: false, need: cost, have };
    if (!await flushRewardClaimBarrier(save.characterId)) return { ok: false, need: cost, have };
    const requestId = globalThis.crypto?.randomUUID?.() || `pet-star-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await cloudPetEconomyAction(cred.url, save.characterId, "star_up", instId, requestId);
    if (!result?.ok) return result?.error === "pet_star_max" ? { ok: false, maxed: true } : { ok: false, need: cost, have };
    hydrateAuthoritativeBlacksmithSnapshot(result, save.characterId);
    return { ok: true };
  }
  async function claimDailyLogin() {
    if (!dailyLogin.canClaim) return { ok: false, alreadyClaimed: true };
    if (!await flushRewardClaimBarrier(save.characterId)) return { ok: false, error: "save_barrier_failed" };
    const res = await cloudClaimDailyLogin(cred.url, save.characterId);
    if (!res || res.error) return { ok: false, error: res && res.error };
    setDailyLogin({ state: res.state, canClaim: false, preview: dailyLogin.preview });
    hydrateAuthoritativeBlacksmithSnapshot(res, save.characterId);
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
  }, persistenceStatus === "saving" ? "กำลังบันทึก…" : persistenceMessage || "บันทึก Cloud ไม่สำเร็จ — กดบันทึกเพื่อลองใหม่"), phase !== "menu" && phase !== "town" && phase !== "login" && phase !== "combat" && phase !== "character" && phase !== "skill" && phase !== "map" && phase !== "arena" && /*#__PURE__*/React.createElement(StatusBar, {
    player: player,
    save: save,
    phase: phase,
    equipped: equipped,
    arena: arenaHud
  }), phase === "menu" && /*#__PURE__*/React.createElement(HubScreen, {
    save: save,
    cp: cp,
    arenaHud: arenaHud,
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
      setChatInitialChannel("global");
      setUtilityReturnPhase("menu");
      setPhase("chat");
    },
    onGuild: () => {
      setUtilityReturnPhase("menu");
      setPhase("guild");
    },
    dailyLogin: dailyLogin,
    dailyLoginClaimResult: dailyLoginClaimResult,
    onClaimDailyLogin: claimDailyLogin,
    onClearDailyLoginResult: () => setDailyLoginClaimResult(null)
  }), phase === "town" && /*#__PURE__*/React.createElement(TownScreen, {
    save: save,
    arenaHud: arenaHud,
    onMainHub: () => setPhase("menu"),
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
      setChatInitialChannel("global");
      setUtilityReturnPhase("town");
      setPhase("chat");
    },
    onGuild: () => {
      setUtilityReturnPhase("town");
      setPhase("guild");
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
    onMainHub: () => setPhase("menu"),
    onFriend: () => {
      setUtilityReturnPhase("character");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setChatInitialChannel("global");
      setUtilityReturnPhase("character");
      setPhase("chat");
    },
    onGuild: () => {
      setUtilityReturnPhase("character");
      setPhase("guild");
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
    onMainHub: () => setPhase("menu"),
    onFriend: () => {
      setUtilityReturnPhase("skill");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setChatInitialChannel("global");
      setUtilityReturnPhase("skill");
      setPhase("chat");
    },
    onGuild: () => {
      setUtilityReturnPhase("skill");
      setPhase("guild");
    },
    onBack: () => setPhase("character")
  }), phase === "map" && /*#__PURE__*/React.createElement(MapScreen, {
    save: save,
    arenaHud: arenaHud,
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
    onMainHub: () => setPhase("menu"),
    onSettings: () => setAccountSettingsOpen(true),
    onFriend: () => {
      setUtilityReturnPhase("map");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setChatInitialChannel("global");
      setUtilityReturnPhase("map");
      setPhase("chat");
    },
    onGuild: () => {
      setUtilityReturnPhase("map");
      setPhase("guild");
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
    onMainHub: () => setPhase("menu"),
    onFriend: () => {
      setUtilityReturnPhase("pets");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setChatInitialChannel("global");
      setUtilityReturnPhase("pets");
      setPhase("chat");
    },
    onGuild: () => {
      setUtilityReturnPhase("pets");
      setPhase("guild");
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
  }), phase === "arena" && /*#__PURE__*/React.createElement(ArenaV2ErrorBoundary, {
    onFatal: handleArenaFatal,
    getContext: () => globalThis.__THORNIE_ARENA_CONTEXT__ || {}
  }, /*#__PURE__*/React.createElement(ArenaV2Screen, {
    serverUrl: cred.url,
    characterId: save.characterId,
    save: save,
    arenaHud: arenaHud,
    onHudChange: setArenaHud,
    ...utilityDockProps("arena"),
    onFatal: handleArenaFatal,
    onFriend: () => {
      setUtilityReturnPhase("arena");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setChatInitialChannel("global");
      setUtilityReturnPhase("arena");
      setPhase("chat");
    },
    onGuild: () => {
      setUtilityReturnPhase("arena");
      setPhase("guild");
    },
    onBack: () => setPhase(utilityReturnPhase)
  })), phase === "mailbox" && /*#__PURE__*/React.createElement(MailboxScreen, {
    serverUrl: cred.url,
    characterId: save.characterId,
    onBeforeClaim: flushRewardClaimBarrier,
    onApplyReward: applyMailReward,
    onBack: () => setPhase(utilityReturnPhase)
  }), phase === "friend" && /*#__PURE__*/React.createElement(FriendScreen, {
    serverUrl: cred.url,
    characterId: save.characterId,
    ...utilityDockProps("friend"),
    onChat: () => {
      setChatDirectTarget(null);
      setChatInitialChannel("global");
      setUtilityReturnPhase("friend");
      setPhase("chat");
    },
    onGuild: () => {
      setUtilityReturnPhase("friend");
      setPhase("guild");
    },
    onChatWith: (friend) => {
      setChatDirectTarget({ characterId: friend.characterId, name: friend.name });
      setChatInitialChannel("direct");
      setUtilityReturnPhase("friend");
      setPhase("chat");
    },
    onOpenPlayerCard: targetCharacterId => setPlayerCardTarget({ characterId: targetCharacterId }),
    onBack: () => setPhase(utilityReturnPhase)
  }), phase === "chat" && /*#__PURE__*/React.createElement(ChatScreen, {
    key: save.characterId,
    serverUrl: cred.url,
    characterId: save.characterId,
    characterName: save.characterName,
    initialDirectTarget: chatDirectTarget,
    initialChannel: chatInitialChannel,
    guildUnread,
    onGuildUnread: updateGuildUnread,
    onChannelChange: setChatInitialChannel,
    onOpenPlayerCard: targetCharacterId => setPlayerCardTarget({ characterId: targetCharacterId }),
    ...utilityDockProps("chat"),
    onFriend: () => {
      setUtilityReturnPhase("chat");
      setPhase("friend");
    },
    onGuild: () => {
      setUtilityReturnPhase("chat");
      setPhase("guild");
    },
    onBack: () => setPhase(utilityReturnPhase)
  }), phase === "guild" && /*#__PURE__*/React.createElement(GuildScreen, {
    serverUrl: cred.url,
    characterId: save.characterId,
    characterLevel: save.character.level,
    inventory: inventory,
    onBeforeDonate: flushInventoryForDonation,
    guildUnread,
    onRefreshGuildChatStatus: refreshGuildChatStatus,
    onRefreshInventory: async () => {
      const characterId = save.characterId;
      const donationGeneration = donationInventoryGenerationRef.current;
      const requestNonce = `${donationGeneration}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await cloudGetInventory(cred.url, characterId, requestNonce);
      if (!res || res.error || activeCharacterIdRef.current !== characterId || donationGeneration !== donationInventoryGenerationRef.current) return false;
      const next = itemsFromServerList(res.items || []);
      equippedRef.current = next.equipped;
      inventoryRef.current = next.inventory;
      inventoryOverflowRef.current = next.overflow;
      setEquipped(next.equipped);
      setInventory(next.inventory);
      setInventoryOverflow(next.overflow);
      return true;
    },
    onDonationCommitted: applyGuildDonationLocally,
    ...utilityDockProps("guild"),
    onFriend: () => {
      setUtilityReturnPhase("guild");
      setPhase("friend");
    },
    onChat: () => {
      setChatDirectTarget(null);
      setChatInitialChannel("guild");
      setUtilityReturnPhase("guild");
      setPhase("chat");
    },
    // Guild is a top-level utility destination. Always return to the explicit Main Hub
    // route so a stale utilityReturnPhase cannot leave the page mounted in place.
    onBack: () => setPhase("menu")
  }), phase === "gacha" && /*#__PURE__*/React.createElement(GachaScreen, {
    save: save,
    gachaResult: gachaResult,
    onClearGachaResult: () => setGachaResult(null),
    onGacha: pullGacha,
    onBack: () => setPhase(gachaReturnPhase)
  }), phase === "combat" && monsters.length > 0 && player && /*#__PURE__*/React.createElement(CombatScreen, {
    player: player,
    heroName: save.characterName || "Hero",
    battleState: battleState,
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
    audioSettings: audioSettings,
    onBgmVolumeChange: value => AUDIO_MANAGER.setBgmVolume(value),
    onBgmMuteChange: value => AUDIO_MANAGER.setBgmMuted(value),
    onSfxVolumeChange: value => AUDIO_MANAGER.setSfxVolume(value),
    onSfxMuteChange: value => AUDIO_MANAGER.setSfxMuted(value),
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
    onMainHub: () => { setInvOpen(false); setPhase("menu"); },
    onFriend: () => {
      setInvOpen(false);
      setUtilityReturnPhase(phase);
      setPhase("friend");
    },
    onChat: () => {
      setInvOpen(false);
      setChatDirectTarget(null);
      setChatInitialChannel("global");
      setUtilityReturnPhase(phase);
      setPhase("chat");
    },
    onGuild: () => {
      setInvOpen(false);
      setUtilityReturnPhase(phase);
      setPhase("guild");
    },
    onClose: () => setInvOpen(false)
  }), blacksmithOpen && /*#__PURE__*/React.createElement(BlacksmithOverlay, {
    equipped: equipped,
    inventory: inventory,
    busy: itemActionBusy,
    gold: save.gold,
    protectionStones: save.protectionStones || 0,
    onEnhance: guardItemAction(enhanceItem),
    onEmpower: guardItemAction(empowerItem),
    onReroll: guardItemAction(rerollEmpowerItem),
    onToggleLock: guardItemAction(toggleEmpowerLock),
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
    onBuyItem: guardItemAction(buyShopItem),
    onBuyPotionTier: guardItemAction(buyShopPotionTier),
    onBuyProtectionStone: guardItemAction(buyProtectionStone),
    onBuyMaterial: guardItemAction(buyMaterial),
    onClose: () => setShopOpen(false)
  }), playerCardTarget && /*#__PURE__*/React.createElement(PlayerCardOverlay, {
    serverUrl: cred.url,
    viewerCharacterId: save.characterId,
    targetCharacterId: playerCardTarget.characterId,
    onClose: () => setPlayerCardTarget(null),
    onGuildLink: guild => {
      if (guild?.guildId) setGuildProfileTarget({ guildId: guild.guildId });
    }
  }), guildProfileTarget && /*#__PURE__*/React.createElement(GuildProfileOverlay, {
    serverUrl: cred.url,
    characterId: save.characterId,
    guildId: guildProfileTarget.guildId,
    onClose: () => setGuildProfileTarget(null)
  }), arenaFatal && /*#__PURE__*/React.createElement(ArenaFatalDiagnosticOverlay, {
    diagnostic: arenaFatal,
    onResume: () => {
      setArenaFatal(null);
      setPhase("arena");
    },
    onClose: () => setArenaFatal(null)
  }));
}
