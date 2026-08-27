function ThornieDungeons() {
  const [save, setSave] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading, login, menu, town, map, combat, result, defeat
  const [cred, setCred] = useState({
    url: "",
    id: "",
    password: ""
  });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [player, setPlayer] = useState(null); // ephemeral combat state, derived fresh from save each stage entry
  const [resumeRun, setResumeRun] = useState(null); // persisted current HP/MP + floor restored after login
  const [equipped, setEquipped] = useState(emptyEquipped());
  const [inventory, setInventory] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [enemy, setEnemy] = useState(null);
  const [log, setLogState] = useState(["Welcome to ThornieDungeons!"]);
  // Keeps the last 3 combat messages, newest first, so the log panel can show
  // a short scrolling history instead of overwriting a single line.
  const setLog = msg => setLogState(prev => [msg, ...prev].slice(0, 3));
  const [busy, setBusy] = useState(false);
  const enemyRef = useRef(null);
  const playerRef = useRef(null);
  const combatOutcomeRef = useRef(null);
  useEffect(() => { enemyRef.current = enemy; }, [enemy]);
  useEffect(() => { playerRef.current = player; }, [player]);
  const [heroAnim, setHeroAnim] = useState("");
  const [enemyAnim, setEnemyAnim] = useState("");
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
  const pushProgress = useCallback(nextSave => {
    if (!cred.url || !cred.id || !cred.password) return;
    enqueueCloudWrite(() => cloudSaveProgress(cred.url, cred.id, cred.password, progressToServer(nextSave)));
  }, [cred, enqueueCloudWrite]);
  const pushItems = useCallback((inv, eq) => {
    if (!cred.url || !cred.id || !cred.password) return;
    enqueueCloudWrite(() => cloudSyncItems(cred.url, cred.id, cred.password, itemsToServerList(inv, eq)));
  }, [cred, enqueueCloudWrite]);
  const pushRunState = useCallback((runState) => {
    // runState === undefined -> caller has nothing to save yet, skip.
    // runState === null -> explicit request to clear the checkpoint (both local + cloud).
    if (!cred.url || !cred.id || !cred.password || runState === undefined) return;
    const key = `thornie-run-${cred.id}`;
    try {
      if (runState === null) window.localStorage?.removeItem(key);
      else window.localStorage?.setItem(key, JSON.stringify(runState));
    } catch (e) {}
    enqueueCloudWrite(() => cloudSaveRunState(cred.url, cred.id, cred.password, runState));
  }, [cred, enqueueCloudWrite]);
  const persistSave = useCallback(next => {
    setSave(next);
    pushProgress(next);
  }, [pushProgress]);
  const persistItems = useCallback((inv, eq) => {
    pushItems(inv, eq);
  }, [pushItems]);
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
    const nextSave = progressFromServer(res.progress);
    setSave(nextSave);
    let savedRun = null;
    if (res.runState && (res.runState.hp !== undefined || res.runState.mp !== undefined)) {
      savedRun = {
        floor: Number(res.runState.floor) || 1,
        hp: Number(res.runState.hp),
        mp: Number(res.runState.mp)
      };
    } else {
      try {
        const raw = window.localStorage?.getItem(`thornie-run-${cred.id}`);
        if (raw) savedRun = JSON.parse(raw);
      } catch (e) {}
    }
    if (savedRun && Number.isFinite(savedRun.hp) && Number.isFinite(savedRun.mp)) {
      setResumeRun(savedRun);
      setSelectedFloor(savedRun.floor || 1);
    } else {
      setResumeRun(null);
    }
    const {
      equipped: eq,
      inventory: inv
    } = itemsFromServerList(res.items || []);
    setEquipped(eq);
    setInventory(inv);
    setPhase("menu");
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
    setSave(defaultSave());
    setEquipped(emptyEquipped());
    setInventory([]);
    setPhase("menu");
  }
  function logout() {
    setCred(c => ({
      ...c,
      password: ""
    }));
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
    const e = makeEnemy(floorNum);
    setEnemy(e);
    setDropItem(null);
    setLog(e.isBoss ? `A ${e.name} blocks the way!` : `A wild ${e.name} appears!`);
    setPhase("combat");
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
    const currentEnemy = enemyRef.current || enemy;
    const currentPlayer = playerRef.current || player;
    if (!currentEnemy || currentEnemy.hp > 0) return;
    combatOutcomeRef.current = "victory";
    if (runStateSaveTimer.current) clearTimeout(runStateSaveTimer.current);
    setBusy(false);
    const gained = currentEnemy.gold;
    const xpGained = currentEnemy.xp;
    const modifier = currentEnemy.modifier;
    // Equipment now only comes from a reward CHEST on boss floors (every 5th floor).
    // Regular monsters instead have a chance to drop a stack of junk material (stone/grass/
    // wood/iron/mana stone) used for crafting, selling, and the Enhancement/Empowerment systems.
    let drop = null;
    let junkDrop = null;
    let nextInvAfterCombat = inventory;
    let nextChestPity = save.chestPity || 0;
    if (currentEnemy.isBoss) {
      const chestRarity = rollChestRarity(currentEnemy.isEliteBoss, nextChestPity);
      nextChestPity = chestRarity === "elite" || chestRarity === "mythic" ? 0 : nextChestPity + 1;
      drop = generateDrop(selectedFloor, {
        forceRarity: chestRarity
      });
      nextInvAfterCombat = [...inventory, drop];
    } else {
      const matChance = 0.45 + (currentPlayer.dropBonus || 0) / 100 + (modifier?.dropBonusFlat || 0) / 100;
      if (Math.random() < matChance) {
        junkDrop = rollJunkDrop(selectedFloor, modifier);
        nextInvAfterCombat = addJunkToInventory(inventory, junkDrop.type, junkDrop.amount);
      }
    }
    if (nextInvAfterCombat !== inventory) {
      setInventory(nextInvAfterCombat);
      persistItems(nextInvAfterCombat, equipped);
    }
    setDropItem(drop);
    const diamondsGained = currentEnemy.isEliteBoss ? 20 + Math.round(selectedFloor / 2) : 0;
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
    if (selectedFloor === 5 && currentEnemy.isBoss && unlockedNext && !alreadyHasStarter) {
      const starter = starterPetDef();
      const instId = `pet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      newPets = [...(save.pets || []), {
        instId,
        defId: starter.id
      }];
      if (!newActivePetId) newActivePetId = instId;
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
      isBoss: currentEnemy.isBoss,
      junkDrop,
      modifier,
      isEliteBoss: currentEnemy.isEliteBoss,
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
  function playerTurn(action, skillKey) {
    if (busy || !enemy || !player) return;
    const stats = getStats(player, equipped);
    setBusy(true);
    if (action === "attack") {
      const isMiss = Math.random() * 100 >= stats.accuracy;
      const isCrit = !isMiss && Math.random() * 100 < stats.critChance;
      let dmg = Math.max(2, Math.round(stats.atk - enemy.def * 0.6 + (Math.random() * 4 - 2)));
      if (isCrit) dmg = Math.round(dmg * (1 + stats.critDamage / 100));
      setHeroAnim("attack");
      setTimeout(() => {
        if (isMiss) {
          spawnFloat("enemy", "MISS", "#B9AEDD");
          setLog("You missed!");
        } else {
          setEnemy(e => {
            const nh = Math.max(0, e.hp - dmg);
            spawnFloat("enemy", isCrit ? `-${dmg} CRIT!` : `-${dmg}`, isCrit ? "#FFD166" : "#FF6B6B");
            setEnemyAnim("hurt");
            return {
              ...e,
              hp: nh
            };
          });
        }
        setHeroAnim("");
        setTimeout(() => resolveAfterPlayerAction(true), 350);
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
            spawnFloat("enemy", "MISS", "#B9AEDD");
            setLog(`${skill.name} missed!`);
          } else {
            const pierce = skill.defPierce || 0;
            let dmg = Math.max(4, Math.round(stats.atk * skill.mult - enemy.def * (1 - pierce) * 0.6 + (Math.random() * 5 - 2)));
            if (isCrit) dmg = Math.round(dmg * (1 + stats.critDamage / 100));
            const freeze = skill.freezeChance ? Math.random() < skill.freezeChance : false;
            setEnemy(e => {
              const nh = Math.max(0, e.hp - dmg);
              spawnFloat("enemy", isCrit ? `-${dmg} CRIT!` : `-${dmg}`, isCrit ? "#FFD166" : "#8B6AE8");
              setEnemyAnim("hurt");
              const next = {
                ...e,
                hp: nh
              };
              if (freeze) next.frozenTurns = (e.frozenTurns || 0) + skill.freezeTurns;
              if (skill.poisonTurns) {
                next.poisonTurns = skill.poisonTurns;
                next.poisonDmg = Math.max(1, Math.round(stats.atk * skill.poisonPct));
              }
              return next;
            });
            setLog(freeze ? `${skill.name}! Enemy frozen solid!` : `${skill.name} hits for ${dmg}${isCrit ? " (CRIT!)" : ""}!`);
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
          setLog(`${skill.name}! Recovered HP.`);
        } else if (skill.type === "buffAtk") {
          setPlayer(p => ({
            ...p,
            atkBuffPct: skill.pct,
            atkBuffTurns: skill.turns
          }));
          spawnFloat("hero", "ATK UP", "#FFD166");
          setLog(`${skill.name}! ATK increased for ${skill.turns} turns.`);
        } else if (skill.type === "buffDef") {
          setPlayer(p => ({
            ...p,
            defBuffPct: skill.pct,
            defBuffTurns: skill.turns
          }));
          spawnFloat("hero", "DEF UP", "#7FB8E8");
          setLog(`${skill.name}! DEF increased for ${skill.turns} turns.`);
        }
        setHeroAnim("");
        setTimeout(() => resolveAfterPlayerAction(), 350);
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
      setTimeout(() => enemyTurn(), 500);
    } else if (action === "flee") {
      const success = Math.random() < 0.55;
      if (success) {
        setLog("You escaped safely.");
        setEnemy(null);
        pushRunState(null);
        setPhase("map");
        setBusy(false);
      } else {
        setLog("Couldn't escape!");
        setTimeout(() => enemyTurn(), 500);
      }
    }
  }
  function triggerPetSkill(cb) {
    const petActive = activePetInstance(save);
    if (!petActive || !player || player.petCooldown > 0) {
      cb();
      return;
    }
    const stats = getStats(player, equipped);
    const skill = petActive.def.active;
    setPlayer(p => ({
      ...p,
      petCooldown: skill.cooldown
    }));
    setTimeout(() => {
      if (skill.type === "damage") {
        setEnemy(e => {
          if (!e || e.hp <= 0) return e;
          let dmg = Math.max(2, Math.round(stats.atk * skill.mult - e.def * 0.5 + (Math.random() * 3 - 1)));
          const hasStun = petActive.def.extra && petActive.def.extra.type === "stun";
          const stun = hasStun ? Math.random() < petActive.def.extra.pct : false;
          const nh = Math.max(0, e.hp - dmg);
          spawnFloat("enemy", `${petActive.def.icon}-${dmg}`, "#7FE0B0");
          setEnemyAnim("hurt");
          setLog(stun ? `${petActive.def.icon} ${skill.name}! Enemy stunned!` : `${petActive.def.icon} ${skill.name} hits for ${dmg}!`);
          const next = {
            ...e,
            hp: nh
          };
          if (stun) next.frozenTurns = (e.frozenTurns || 0) + 1;
          return next;
        });
      } else if (skill.type === "regen") {
        const heal = Math.round(stats.maxHp * skill.regenPct);
        setPlayer(p => {
          spawnFloat("hero", `+${heal}`, "#6FCF97");
          return {
            ...p,
            hp: Math.min(stats.maxHp, p.hp + heal),
            regenAmount: heal,
            regenTurns: Math.max(0, skill.regenTurns - 1)
          };
        });
        setLog(`${petActive.def.icon} ${skill.name} activates!`);
      }
      setTimeout(() => cb(), 280);
    }, 220);
  }
  function resolveAfterPlayerAction(fromAttack) {
    if (combatOutcomeRef.current) return;
    const currentEnemy = enemyRef.current;
    if (!currentEnemy || currentEnemy.hp <= 0) {
      endCombatWin();
      return;
    }
    if (fromAttack) {
      setTimeout(() => triggerPetSkill(() => {
        if (combatOutcomeRef.current) return;
        if (enemyRef.current && enemyRef.current.hp <= 0) endCombatWin();
        else enemyTurn();
      }), 300);
    } else {
      setTimeout(() => {
        if (!combatOutcomeRef.current) enemyTurn();
      }, 400);
    }
  }
  function enemyTurn() {
    if (combatOutcomeRef.current) return;
    setEnemy(e => {
      if (!e || e.hp <= 0) {
        setTimeout(() => endCombatWin(), 0);
        return e;
      }
      let cur = { ...e };
      if (cur.poisonTurns > 0) {
        const pdmg = cur.poisonDmg || 0;
        cur.hp = Math.max(0, cur.hp - pdmg);
        cur.poisonTurns -= 1;
        spawnFloat("enemy", `-${pdmg} ☠️`, "#6FCF97");
        if (cur.hp <= 0) {
          setLog(`${cur.name} succumbed to poison!`);
          setTimeout(() => endCombatWin(), 0);
          return cur;
        }
      }
      if (cur.frozenTurns > 0) {
        cur.frozenTurns -= 1;
        setLog(`${cur.name} is frozen solid and can't move!`);
        setBusy(false);
        setTimeout(() => tickPlayerBuffs(), 0);
        return cur;
      }
      const stats = getStats(playerRef.current || player, equipped);
      const petActive = activePetInstance(save);
      const hasGuard = petActive && petActive.def.extra && petActive.def.extra.type === "block";
      const blocked = hasGuard && Math.random() < petActive.def.extra.pct;
      const dodged = !blocked && Math.random() * 100 < stats.dodgeChance;
      const dmg = blocked || dodged ? 0 : Math.max(1, Math.round(cur.atk - stats.def * 0.6 + (Math.random() * 3 - 1)));
      setEnemyAnim("attack");
      setTimeout(() => {
        if (combatOutcomeRef.current) return;
        if (blocked) {
          spawnFloat("hero", "BLOCKED 🛡️", "#B9AEDD");
          setLog(`${petActive.def.name} blocked the attack!`);
        } else if (dodged) {
          spawnFloat("hero", "MISS", "#B9AEDD");
          setLog(`You dodged ${cur.name}'s attack!`);
        } else {
          const hasStatusWard = petActive && petActive.def.passive && petActive.def.passive.type === "statusResist";
          const resisted = hasStatusWard && Math.random() < petActive.def.passive.pct;
          const weakenProc = cur.isBoss && !resisted && Math.random() < 0.25;
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
          if (nh <= 0) setTimeout(() => playerLost(), 0);
          setLog(weakenProc && nh > 0 ? `${cur.name} strikes for ${dmg} and weakens you!` : `${cur.name} strikes for ${dmg}!`);
        }
        setEnemyAnim("");
        if (!combatOutcomeRef.current) {
          setBusy(false);
          tickPlayerBuffs();
        }
      }, 300);
      return cur;
    });
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
      if (next.petCooldown > 0) next.petCooldown -= 1;
      if (next.hp > 0 && next.regenTurns > 0 && next.regenAmount > 0 && !combatOutcomeRef.current) {
        const capStats = getStats(next, equipped);
        next.hp = Math.min(capStats.maxHp, next.hp + next.regenAmount);
        next.regenTurns -= 1;
        spawnFloat("hero", `+${next.regenAmount}`, "#6FCF97");
      }
      return next;
    });
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
    setEnemy(null);
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
    const instId = `pet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nextPets = [...(save.pets || []), {
      instId,
      defId: won.id
    }];
    const nextActivePetId = save.activePetId || instId;
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
  if (phase === "login" || !save) {
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
  }), phase === "menu" && /*#__PURE__*/React.createElement(MenuScreen, {
    save: save,
    cp: cp,
    playerId: cred.id,
    onTown: () => setPhase("town"),
    onMap: () => setPhase("map"),
    onLogout: logout
  }), phase === "town" && /*#__PURE__*/React.createElement(CharacterScreen, {
    save: save,
    charStats: charStats,
    onAddStat: addStatPoint,
    onOpenInv: () => setInvOpen(true),
    onMap: () => setPhase("map"),
    onOpenPets: () => setPhase("pets"),
    onBack: () => setPhase("menu")
  }), phase === "map" && /*#__PURE__*/React.createElement(MapScreen, {
    unlockedFloor: save.unlockedFloor,
    onSelectFloor: enterStage,
    onOpenPets: () => setPhase("pets"),
    onBack: () => setPhase("town")
  }), phase === "pets" && /*#__PURE__*/React.createElement(PetScreen, {
    save: save,
    gachaResult: gachaResult,
    onClearGachaResult: () => setGachaResult(null),
    onEquip: equipPet,
    onUnequip: unequipPet,
    onGacha: pullGacha,
    onClaimDiamonds: claimTestDiamonds,
    onBack: () => setPhase("town")
  }), phase === "combat" && enemy && player && /*#__PURE__*/React.createElement(CombatScreen, {
    player: player,
    enemy: enemy,
    log: log,
    busy: busy,
    potions: potions,
    heroAnim: heroAnim,
    enemyAnim: enemyAnim,
    floats: floats,
    onAction: playerTurn,
    equipped: equipped,
    pet: activePetInstance(save)
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
  }), (phase === "town" || phase === "map" || phase === "pets") && /*#__PURE__*/React.createElement(FloatingQuickActions, {
    onShop: openShop,
    onCharacter: () => setPhase("town"),
    onBag: () => setInvOpen(true),
    onBlacksmith: () => setBlacksmithOpen(true),
    activePhase: phase
  }), invOpen && /*#__PURE__*/React.createElement(InventoryOverlay, {
    equipped: equipped,
    inventory: inventory,
    onEquip: equipItem,
    onUnequip: unequipItem,
    onSell: sellItem,
    onSalvage: salvageItem,
    onClose: () => setInvOpen(false)
  }), blacksmithOpen && /*#__PURE__*/React.createElement(BlacksmithOverlay, {
    equipped: equipped,
    inventory: inventory,
    onEnhance: enhanceItem,
    onEmpower: empowerItem,
    onReroll: rerollEmpowerItem,
    onToggleLock: toggleEmpowerLock,
    onClose: () => setBlacksmithOpen(false)
  }), shopOpen && /*#__PURE__*/React.createElement(ShopOverlay, {
    gold: save.gold,
    diamonds: save.diamonds,
    protectionStones: save.protectionStones || 0,
    stock: shopStock,
    onBuyItem: buyShopItem,
    onBuyPotion: buyShopPotion,
    onBuyProtectionStone: buyProtectionStone,
    onBuyMaterial: buyMaterial,
    onClose: () => setShopOpen(false)
  }));
}
