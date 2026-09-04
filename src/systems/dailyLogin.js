// ---------- Daily Login ----------
// Master reward data (day_index -> reward). Mirrors the `daily_login_rewards` D1 table from
// migration_v3, but shipped client-side for now since the real API Worker (deployed separately,
// not in this repo) doesn't have daily-login endpoints yet. Stored via kvGet/kvSet the same way
// quickSlots is (see quickSlotsStorageKey in state/save.js) — local-only, per player+character,
// until a real `daily_login_claims`-backed endpoint exists to sync it cross-device.
const DAILY_LOGIN_REWARDS = [
  { day: 1, gold: 50, diamonds: 0, potions: 1 },
  { day: 2, gold: 80, diamonds: 0, potions: 0 },
  { day: 3, gold: 0, diamonds: 20, potions: 0 },
  { day: 4, gold: 120, diamonds: 0, potions: 1 },
  { day: 5, gold: 0, diamonds: 30, potions: 0 },
  { day: 6, gold: 200, diamonds: 0, potions: 1 },
  { day: 7, gold: 0, diamonds: 100, potions: 3 } // bonus day, cycle repeats after this
];
function dailyLoginStorageKey(userId, characterId) {
  return `thornie-dailylogin-${userId}-${characterId}`;
}
function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, UTC day boundary
}
function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return todayKey(d);
}
async function loadDailyLogin(userId, characterId) {
  const raw = await kvGet(dailyLoginStorageKey(userId, characterId));
  const parsed = safeJsonParse(raw, null);
  if (parsed && typeof parsed === "object") {
    return {
      loginStreak: parsed.loginStreak || 0,
      lastClaimDate: parsed.lastClaimDate || "",
      totalClaims: parsed.totalClaims || 0
    };
  }
  return { loginStreak: 0, lastClaimDate: "", totalClaims: 0 };
}
async function saveDailyLoginLocal(userId, characterId, state) {
  await kvSet(dailyLoginStorageKey(userId, characterId), JSON.stringify(state));
}
function dailyLoginCanClaim(state) {
  return (state.lastClaimDate || "") !== todayKey();
}
// Computes the streak the *next* claim would land on (continues if last claim was
// yesterday, otherwise resets to day 1), and which reward that corresponds to.
function dailyLoginPreview(state) {
  const streak = state.lastClaimDate === yesterdayKey() ? (state.loginStreak || 0) + 1 : 1;
  const reward = DAILY_LOGIN_REWARDS[(streak - 1) % DAILY_LOGIN_REWARDS.length];
  return { streak, reward };
}
function dailyLoginClaim(state) {
  const { streak, reward } = dailyLoginPreview(state);
  const nextState = {
    loginStreak: streak,
    lastClaimDate: todayKey(),
    totalClaims: (state.totalClaims || 0) + 1
  };
  return { nextState, reward, streak };
}
