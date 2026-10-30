// Client Systems V1 / PR-B: declared API client policy, one entry per server action.
//
//   method       GET | POST
//   timeoutMs    client-side abort (0 = none). Reads: 15 s. POSTs get a timeout ONLY when the Worker
//                de-duplicates the action with a server-side receipt (requestId / operationId /
//                actionKey), so an ambiguous outcome can be replayed safely. Other POSTs keep no
//                client timeout and a single attempt (they may be non-idempotent).
//   retries      automatic transient retries (reads only; POST retries belong to PR-A with a reused id)
//   idempotency  "natural" (read) | "receipt" (server receipts) | "state" (state-guarded, e.g. only
//                pending requests can be resolved) | "none"
//   background   true = autosave / polling: must never become a blocking full-screen loading
const API_POLICY_DEFAULTS = Object.freeze({
  GET: Object.freeze({ method: "GET", timeoutMs: 15000, retries: 2, idempotency: "natural", background: false }),
  POST: Object.freeze({ method: "POST", timeoutMs: 0, retries: 0, idempotency: "none", background: false })
});

const P = Object.freeze({
  read: Object.freeze({ ...API_POLICY_DEFAULTS.GET }),
  readBackground: Object.freeze({ ...API_POLICY_DEFAULTS.GET, background: true }),
  write: Object.freeze({ ...API_POLICY_DEFAULTS.POST }),
  writeState: Object.freeze({ ...API_POLICY_DEFAULTS.POST, idempotency: "state" }),
  writeBackground: Object.freeze({ ...API_POLICY_DEFAULTS.POST, background: true }),
  writeReceipt: Object.freeze({ ...API_POLICY_DEFAULTS.POST, timeoutMs: 25000, idempotency: "receipt" })
});

const API_POLICY = Object.freeze({
  // read (30)
  getArenaV2History: P.read,
  getArenaV2Match: P.read,
  getArenaV2Opponents: P.read,
  getArenaV2PlayerCard: P.read,
  getArenaV2Ranking: P.read,
  getArenaV2Replay: P.read,
  getArenaV2Status: P.read,
  getBattleState: P.read,
  getBlockedList: P.read,
  getDailyLogin: P.read,
  getDungeonEncounterPreview: P.read,
  getFriendList: P.read,
  getFriendRequests: P.read,
  getGameConfig: P.read,
  getGuildApplications: P.read,
  getInventory: P.read,
  getJunkInfo: P.read,
  getLeaderboard: P.read,
  getLeaderboardHistory: P.read,
  getMailbox: P.read,
  getMonsterLoot: P.read,
  getMyApplications: P.read,
  getMyGuild: P.read,
  getPublicGuildProfile: P.read,
  getPublicProfile: P.read,
  getRaidStatus: P.read,
  getRecipes: P.read,
  searchCharacters: P.read,
  searchGuilds: P.read,
  validateSession: P.read,
  // readBackground (5)
  getDirectConversations: P.readBackground,
  getDirectMessages: P.readBackground,
  getGlobalChat: P.readBackground,
  getGuildChat: P.readBackground,
  getGuildChatStatus: P.readBackground,
  getHalloweenEventStatus: P.readBackground,
  // write (42)
  acceptGuildApplication: P.write,
  acknowledgeArenaV2Unlock: P.write,
  activateArenaV2Match: P.write,
  blockCharacter: P.write,
  cancelGuildApplication: P.write,
  changePassword: P.write,
  claimDailyLogin: P.write,
  claimMail: P.write,
  claimRaidMilestones: P.write,
  clearBattleCheckpoint: P.write,
  completeBattle: P.write,
  createCharacter: P.write,
  createGuild: P.write,
  createRecoveryCode: P.write,
  deleteAllClaimedMail: P.write,
  deleteCharacter: P.write,
  deleteMail: P.write,
  deleteMails: P.write,
  disbandGuild: P.write,
  donateGuildItem: P.write,
  enterCharacter: P.write,
  forgotPassword: P.write,
  kickGuildMember: P.write,
  leaveGuild: P.write,
  login: P.write,
  logout: P.write,
  prepareArenaV2Match: P.write,
  refreshArenaV2Opponents: P.write,
  register: P.write,
  rejectGuildApplication: P.write,
  removeFriend: P.write,
  requestGuildJoin: P.write,
  saveArenaV2Setup: P.write,
  sendDirectMessage: P.write,
  sendFriendRequest: P.write,
  sendGlobalMessage: P.write,
  sendGuildMessage: P.write,
  setArenaV2Auto: P.write,
  startDungeonBattle: P.write,
  transferGuildLeadership: P.write,
  unblockCharacter: P.write,
  updateGuildSettings: P.write,
  // writeState (4)
  acceptFriendRequest: P.writeState,
  cancelFriendRequest: P.writeState,
  claimAllMail: P.writeState,
  rejectFriendRequest: P.writeState,
  startHalloweenBattle: P.writeState,
  // writeBackground (4)
  markConversationRead: P.writeBackground,
  markGuildChatRead: P.writeBackground,
  saveBattleCheckpoint: P.writeBackground,
  syncItems: P.writeBackground,
  // writeReceipt (17)
  allocateHeroSkills: P.writeReceipt,
  allocateStats: P.writeReceipt,
  attackRaidBoss: P.writeReceipt,
  consumePotion: P.writeReceipt,
  craftItem: P.writeReceipt,
  getCharacterShopStock: P.writeReceipt,
  mutateLegacyBlacksmith: P.writeReceipt,
  mutateV2Blacksmith: P.writeReceipt,
  petEconomyAction: P.writeReceipt,
  purchaseCharacterResource: P.writeReceipt,
  purchaseShopEquipment: P.writeReceipt,
  refreshCharacterShopStock: P.writeReceipt,
  resetCharacterStats: P.writeReceipt,
  resetHeroSkills: P.writeReceipt,
  salvageItem: P.writeReceipt,
  sellCharacterItem: P.writeReceipt,
  submitArenaV2Action: P.writeReceipt
});

function apiPolicyFor(action, method = "POST") {
  const verb = String(method || "POST").toUpperCase() === "GET" ? "GET" : "POST";
  const entry = typeof action === "string" && Object.prototype.hasOwnProperty.call(API_POLICY, action) ? API_POLICY[action] : null;
  return entry && entry.method === verb ? entry : API_POLICY_DEFAULTS[verb];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { API_POLICY, API_POLICY_DEFAULTS, apiPolicyFor };
}
