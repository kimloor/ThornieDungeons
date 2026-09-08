const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Nunito:wght@500;700;800&display=swap');

.md-root {
  --bg-top: #1B1233;
  --bg-mid: #2C1E4A;
  --bg-bot: #402C63;
  --ink: #F3EEFF;
  --ink-soft: #B9AEDD;
  --gold: #FFD166;
  --gold-deep: #C9932A;
  --gold-glow: rgba(255,209,102,0.35);
  --coral: #FF6B6B;
  --coral-deep: #E14F4F;
  --violet: #8B6AE8;
  --violet-deep: #6C4AB6;
  --leaf: #4CAF7D;
  --leaf-deep: #379962;
  --panel: rgba(18,12,34,0.82);
  --panel-soft: rgba(255,255,255,0.06);
  --rare: #6FCF97;
  --unique: #4FA8E0;
  --elite: #FFB84D;
  --legendary: #FFD166;
  font-family: 'Nunito', sans-serif;
  color: var(--ink);
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  position: relative;
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 10px 34px rgba(0,0,0,0.5);
  background: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-mid) 45%, var(--bg-bot) 100%);
  min-height: 640px;
  display: flex;
  flex-direction: column;
}
.md-root * { box-sizing: border-box; }
.md-display { font-family: 'Baloo 2', sans-serif; }

/* Shared authenticated-game backdrop. Login keeps its original entrance scene and character
   select owns the first-person transition; every screen after selection reuses the deeper
   dungeon image with a page-specific readability veil. */
.md-root-dungeon { isolation: isolate; background: #071126; --md-dungeon-veil: .46; }
.md-root-dungeon::before,
.md-root-dungeon::after { content: ""; position: absolute; inset: 0; pointer-events: none; }
.md-root-dungeon::before {
  z-index: 0;
  background:
    linear-gradient(180deg, rgba(3,8,25,.06), rgba(3,8,25,.24)),
    url("ui/character-select-background.webp") center / cover no-repeat;
  transform: scale(1.025);
  animation: md-global-dungeon-breathe 14s ease-in-out infinite alternate;
}
.md-root-dungeon::after {
  z-index: 1;
  background: rgba(3,7,20,var(--md-dungeon-veil));
  box-shadow: inset 0 0 90px rgba(0,0,0,.28);
  transition: background-color .25s ease;
}
.md-root-dungeon.md-dungeon-fade-light { --md-dungeon-veil: .27; }
.md-root-dungeon.md-dungeon-fade-medium { --md-dungeon-veil: .47; }
.md-root-dungeon.md-dungeon-fade-heavy { --md-dungeon-veil: .61; }
.md-root-dungeon.md-dungeon-modal-open { --md-dungeon-veil: .69; }
/* Keep normal screens above the backdrop, but never rewrite overlay positioning. The inventory,
   blacksmith and daily-reward sheets rely on position:absolute to open over the current screen. */
.md-root-dungeon > :not(style):not(.md-stars):not(.md-equip-overlay) { position: relative; z-index: 2; }
@keyframes md-global-dungeon-breathe {
  0% { transform: scale(1.025) translate3d(0,0,0); filter: brightness(.92); }
  100% { transform: scale(1.055) translate3d(0,-.45%,0); filter: brightness(1.04); }
}

/* Town is a separate, sunlit world layer. All labels and hit targets remain code-rendered so
   they stay crisp, localizable and independently editable without regenerating the artwork. */
.md-root-town { isolation:isolate; background:#78bde9; }
.md-root-town::before,
.md-root-town::after { content:""; position:absolute; inset:0; pointer-events:none; }
.md-root-town::before {
  z-index:0;
  background:url("ui/town-background.webp") center / cover no-repeat;
  transform:scale(1.015);
  animation:md-town-camera-breathe 16s ease-in-out infinite alternate;
}
.md-root-town::after {
  z-index:1;
  background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,246,207,.02) 55%,rgba(2,10,28,.12));
  box-shadow:inset 0 0 55px rgba(14,55,92,.12);
}
.md-root-town.md-town-modal-open::after { background:rgba(3,8,24,.58); }
.md-root-town > :not(style):not(.md-stars):not(.md-equip-overlay) { position:relative; z-index:2; }
@keyframes md-town-camera-breathe {
  0% { transform:scale(1.015) translate3d(0,0,0); filter:saturate(1.02) brightness(.98); }
  100% { transform:scale(1.04) translate3d(0,-.35%,0); filter:saturate(1.07) brightness(1.03); }
}

.md-stars { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.md-star-dot { position: absolute; background: #fff; border-radius: 50%; opacity: 0.5; animation: md-twinkle 3s ease-in-out infinite; }
@keyframes md-twinkle { 0%,100% { opacity: 0.15; } 50% { opacity: 0.7; } }

.md-status {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  background: rgba(10,6,22,0.55);
  backdrop-filter: blur(3px);
  border-bottom: 2px solid var(--gold-deep);
}
.md-status-chip {
  display: flex; align-items: center; gap: 4px;
  background: var(--panel);
  border: 1.5px solid var(--gold-deep);
  border-radius: 999px;
  padding: 3px 10px 3px 6px;
  font-weight: 800;
  font-size: 12.5px;
  color: var(--gold);
  white-space: nowrap;
}
.md-chip-icon { font-size: 14px; }
.md-bars { flex: 1; margin: 0 8px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.md-bar-track { height: 8px; border-radius: 6px; background: rgba(0,0,0,0.4); overflow: hidden; border: 1px solid rgba(255,209,102,0.25); }
.md-bar-fill { height: 100%; border-radius: 6px; transition: width 0.4s ease; }
.md-bar-label { font-size: 9px; font-weight: 800; color: var(--ink-soft); letter-spacing: 0.3px; }

.md-scene { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; padding: 14px 16px 8px; min-height: 240px; }
.md-floor-tag {
  align-self: center; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 13px; color: var(--bg-top);
  background: linear-gradient(180deg, #FFE49A, var(--gold)); padding: 4px 18px; border-radius: 999px;
  box-shadow: 0 3px 0 var(--gold-deep); margin-bottom: 6px; border: 1px solid rgba(255,255,255,0.5);
}

.md-arena { flex: 1; display: flex; flex-wrap: nowrap; align-items: flex-end; justify-content: space-between; position: relative; padding: 10px 6px 20px; gap: 6px; }
.md-ground { position: absolute; left: -16px; right: -16px; bottom: 0; height: 26px; background: linear-gradient(180deg, #4A3670 0%, #2C1E4A 100%); border-top: 3px solid var(--gold-deep); opacity: 0.7; }

.md-sprite-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; z-index: 2; }
.md-sprite-name { font-family:'Baloo 2'; font-weight: 700; font-size: 11px; background: rgba(10,6,22,0.75); color: var(--gold); border: 1px solid var(--gold-deep); padding: 1px 8px; border-radius: 999px; max-width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.md-enemy-hpbar { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 74px; }
.md-enemy-hpbar-track { width: 100%; height: 7px; border-radius: 4px; background: rgba(0,0,0,0.5); border: 1px solid rgba(0,0,0,0.6); overflow: hidden; }
.md-enemy-hpbar-fill { height: 100%; transition: width 0.4s ease; background: linear-gradient(90deg,#FF8787,#E14F4F); }
.md-enemy-hpbar-hp { font-size: 8.5px; font-weight: 800; color: var(--ink-soft); }

.md-hero { width: 62px; height: 70px; position: relative; animation: md-idle 2.2s ease-in-out infinite; filter: drop-shadow(0 0 8px var(--gold-glow)); }
.md-hero .body { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 46px; height: 46px; border-radius: 50% 50% 46% 46%; background: var(--coral); border: 3px solid #1B1233; }
.md-hero .head { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 40px; height: 36px; border-radius: 50%; background: #FFE0C2; border: 3px solid #1B1233; }
.md-hero .hair { position: absolute; top: -6px; left: 50%; transform: translateX(-50%); width: 44px; height: 20px; border-radius: 50% 50% 0 0; background: var(--gold-deep); border: 3px solid #1B1233; border-bottom: none; }
.md-hero .eye { position: absolute; width: 4px; height: 6px; background: #1B1233; border-radius: 2px; top: 16px; }
.md-hero .eye.l { left: 12px; } .md-hero .eye.r { right: 12px; }
.md-hero.attack { animation: md-lunge 0.35s ease; }
.md-hero.hurt { animation: md-shake 0.35s ease; }

.md-hero-v3-canvas {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  filter: drop-shadow(0 0 8px var(--gold-glow));
  animation: md-idle 2.2s ease-in-out infinite;
}
.md-hero-v3-canvas.attack { animation: md-lunge 0.35s ease; }
.md-hero-v3-canvas.hurt { animation: md-shake 0.35s ease; }
.md-hero-v3-master {
  position: relative;
  flex: 0 0 auto;
  transform-origin: center center;
  image-rendering: pixelated;
}
.md-hero-v3-layer {
  position: absolute;
  display: block;
  transform-origin: top left;
  pointer-events: none;
  user-select: none;
  image-rendering: pixelated;
}

.md-enemy { width: 64px; height: 64px; position: relative; animation: md-idle 1.8s ease-in-out infinite; filter: drop-shadow(0 0 6px rgba(255,107,107,0.35)); }
.md-enemy .blob { position: absolute; inset: 0; border-radius: 46% 46% 52% 52% / 55% 55% 45% 45%; border: 3px solid #1B1233; }
.md-enemy .eye { position: absolute; width: 6px; height: 8px; background: #1B1233; border-radius: 3px; top: 40%; }
.md-enemy .eye.l { left: 30%; } .md-enemy .eye.r { right: 30%; }
.md-enemy.attack { animation: md-lunge-l 0.35s ease; }
.md-enemy.hurt { animation: md-shake 0.35s ease; }
.md-enemy.boss { width: 84px; height: 84px; }

.md-enemy-img { width: 64px; height: 64px; position: relative; display: block; animation: md-idle 1.8s ease-in-out infinite; filter: drop-shadow(0 0 6px rgba(255,107,107,0.35)); image-rendering: -webkit-optimize-contrast; }
.md-enemy-img.attack { animation: none; }
.md-enemy-img.hurt { animation: md-shake 0.35s ease; }
.md-enemy-img.boss { width: 84px; height: 84px; }

@keyframes md-idle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes md-lunge { 0% { transform: translateX(0); } 40% { transform: translateX(14px) rotate(-6deg); } 100% { transform: translateX(0); } }
@keyframes md-lunge-l { 0% { transform: translateX(0); } 40% { transform: translateX(-14px) rotate(6deg); } 100% { transform: translateX(0); } }
@keyframes md-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }

.md-dmg-float { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); font-family: 'Baloo 2'; font-weight: 800; font-size: 16px; pointer-events: none; animation: md-float-up 0.9s ease forwards; z-index: 5; text-shadow: 0 2px 0 rgba(0,0,0,0.4); }
@keyframes md-float-up { 0% { opacity: 1; transform: translate(-50%, 0);} 100% { opacity: 0; transform: translate(-50%, -34px);} }

.md-log { background: rgba(10,6,22,0.6); border: 1px solid rgba(255,209,102,0.25); border-radius: 12px; padding: 8px 12px; min-height: 62px; max-height: 78px; overflow-y: auto; margin-bottom: 0; display: flex; flex-direction: column; gap: 3px; justify-content: flex-start; }
.md-log-line { font-size: 11px; font-weight: 700; color: var(--ink-soft); text-align: center; opacity: 0.6; overflow-wrap: break-word; word-break: break-word; padding: 0 4px; }
.md-log-line:before { content: '💬 '; }
.md-log-line.latest { font-size: 12.5px; color: var(--ink); opacity: 1; }

.md-panel { position: relative; z-index: 2; background: rgba(10,6,22,0.5); border-top: 2px solid var(--gold-deep); padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.md-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.md-btn { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 14px; border: none; border-radius: 14px; padding: 12px 10px; color: #fff; cursor: pointer; box-shadow: 0 4px 0 rgba(0,0,0,0.35); transition: transform 0.08s ease, box-shadow 0.08s ease; display: flex; align-items: center; justify-content: center; gap: 6px; }
.md-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,0.35); }
.md-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.md-btn.attack { background: linear-gradient(180deg, #FF8787, var(--coral)); }
.md-btn.skill { background: linear-gradient(180deg, #A78BF0, var(--violet)); }
.md-btn.item { background: linear-gradient(180deg, #6FD19C, var(--leaf)); }
.md-btn.flee { background: #5B5470; }
.md-btn.primary { background: linear-gradient(180deg, #FFE49A, var(--gold)); color: var(--bg-top); }
.md-btn.info { background: var(--violet-deep); }
.md-btn.wide { grid-column: 1 / -1; }
.md-btn.small { padding: 8px; font-size: 12px; }

.md-card { background: var(--panel); border-radius: 16px; padding: 14px; border: 1.5px solid var(--gold-deep); }
.md-charselect-slot { min-height: 76px; display: flex; flex-direction: column; justify-content: center; }
.md-title { font-family:'Baloo 2'; font-weight: 800; font-size: 17px; margin: 0 0 4px; color: var(--gold); }
.md-sub { font-size: 12.5px; color: var(--ink-soft); font-weight: 700; margin: 0 0 10px; }

.md-shop-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px dashed rgba(255,209,102,0.2); }
.md-shop-row:last-child { border-bottom: none; }
.md-shop-row > div:first-child { min-width: 0; flex: 1; } /* text side must be allowed to shrink for ellipsis to work in a flex row */
.md-shop-info { font-weight: 800; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.md-shop-lv { font-size: 11px; color: var(--ink-soft); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.md-buy-btn { font-family: 'Baloo 2'; font-weight: 700; font-size: 12px; background: linear-gradient(180deg, #FFE49A, var(--gold)); border: none; border-radius: 999px; padding: 6px 12px; color: var(--bg-top); cursor: pointer; box-shadow: 0 3px 0 var(--gold-deep); flex-shrink: 0; white-space: nowrap; }
.md-buy-btn:disabled { opacity: 0.35; }
.md-buy-btn:active { transform: translateY(2px); box-shadow: none; }
.md-cost-insufficient { color: #ff5566 !important; font-weight: 900; }

.md-menu-title { text-align: center; padding: 30px 20px 6px; position: relative; z-index: 2; }
.md-menu-title h1 { font-family:'Baloo 2'; font-size: 30px; margin: 0; color: var(--gold); text-shadow: 0 3px 0 rgba(0,0,0,0.4), 0 0 18px var(--gold-glow); }
.md-menu-title p { font-weight: 800; color: var(--ink-soft); font-size: 13px; margin: 4px 0 0; }

.md-cp-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.35); border: 1px solid var(--gold-deep); border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 800; color: var(--gold); max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Main Hub v2 — a first-person dungeon antechamber rather than a flat button directory. */
.md-hub-shell { flex:1; min-height:640px; padding:max(10px,env(safe-area-inset-top)) 10px max(10px,env(safe-area-inset-bottom)); display:flex; flex-direction:column; gap:8px; position:relative; overflow:hidden; }
.md-hub-topbar { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; border:1px solid rgba(255,209,102,.38); border-radius:16px; background:linear-gradient(110deg,rgba(5,14,37,.88),rgba(14,31,64,.68)); box-shadow:0 8px 24px rgba(0,0,0,.3); backdrop-filter:blur(9px); }
.md-hub-profile { min-width:0; display:flex; align-items:center; gap:8px; }
.md-hub-mark { width:39px; height:39px; flex:0 0 39px; border-radius:11px; border:1px solid rgba(255,209,102,.74); box-shadow:0 0 14px rgba(0,184,255,.25); }
.md-hub-profile-copy { min-width:0; display:flex; flex-direction:column; line-height:1.15; }
.md-hub-profile-copy > strong { color:var(--gold); font-family:'Baloo 2'; font-size:18px; line-height:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow:0 0 12px rgba(255,209,102,.22); }
.md-hub-character-meta { margin-top:4px; display:flex; align-items:center; gap:6px; }
.md-hub-character-meta b { padding:2px 7px; border-radius:7px; background:linear-gradient(180deg,#ffe293,#d99727); color:#18112e; font-family:'Baloo 2'; font-size:9px; line-height:1.1; }
.md-hub-character-meta span { color:#9edfff; font-size:9px; font-weight:900; white-space:nowrap; }
.md-hub-top-actions { display:flex; gap:6px; }
.md-hub-icon-btn { width:44px; height:44px; padding:0; position:relative; display:grid; place-items:center; border-radius:13px; border:1px solid rgba(255,209,102,.34); background:rgba(5,13,35,.76); color:var(--ink); font-size:21px; cursor:pointer; }
.md-hub-icon-btn:active { transform:translateY(2px); }
.md-hub-icon-btn i { position:absolute; top:4px; right:4px; width:9px; height:9px; border-radius:50%; background:#ff5566; border:2px solid #09152f; box-shadow:0 0 9px #ff5566; animation:md-hub-alert 1.15s ease-in-out infinite; }
.md-hub-resources { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }
.md-hub-resources span { min-width:0; padding:5px 6px; text-align:center; border-radius:10px; border:1px solid rgba(99,177,232,.25); background:rgba(4,13,35,.65); color:var(--ink-soft); font-size:9px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; backdrop-filter:blur(6px); }
.md-hub-resources b { color:var(--ink); }
.md-hub-world { flex:1; min-height:365px; position:relative; overflow:hidden; border:1px solid rgba(255,209,102,.26); border-radius:22px; background:radial-gradient(circle at 50% 39%,rgba(0,170,255,.12),transparent 28%),linear-gradient(180deg,rgba(2,9,27,.10),rgba(2,9,27,.02) 45%,rgba(2,8,24,.48)); box-shadow:inset 0 0 45px rgba(0,0,0,.2),0 10px 28px rgba(0,0,0,.25); }
.md-hub-world::before { content:""; position:absolute; left:50%; top:27%; width:130px; height:180px; transform:translateX(-50%); border-radius:50%; background:radial-gradient(ellipse,rgba(42,198,255,.18),rgba(31,116,255,.06) 48%,transparent 72%); filter:blur(7px); animation:md-hub-gate-glow 3.5s ease-in-out infinite; pointer-events:none; }
.md-hub-raid-callout { position:absolute; top:8px; left:8px; right:8px; min-height:48px; z-index:3; display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid rgba(255,125,104,.58); border-radius:14px; background:linear-gradient(100deg,rgba(60,13,32,.88),rgba(19,17,45,.78)); color:var(--ink); text-align:left; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,.28); }
.md-hub-raid-callout > img { width:34px; height:34px; flex:0 0 34px; filter:drop-shadow(0 0 6px rgba(255,108,92,.3)); }
.md-hub-raid-callout div { flex:1; display:flex; flex-direction:column; line-height:1.05; }
.md-hub-raid-callout small { color:#ffb3a3; font-size:7.5px; letter-spacing:1.4px; font-weight:900; }
.md-hub-raid-callout strong { font-family:'Baloo 2'; font-size:13px; }
.md-hub-raid-callout > b { color:var(--gold); font-size:9px; }
.md-hub-gate-focus { position:absolute; z-index:2; top:28%; left:12px; right:12px; display:flex; flex-direction:column; align-items:center; text-align:center; pointer-events:none; }
.md-hub-gate-focus span { color:#a8e8ff; font-family:'Baloo 2'; font-size:11px; font-weight:900; letter-spacing:.5px; text-shadow:0 2px 6px #000,0 0 10px #009be8; }
.md-hub-gate-focus strong { margin-top:-2px; color:#ffe6a2; font-family:'Baloo 2'; font-size:58px; line-height:.95; text-shadow:0 4px 0 rgba(0,0,0,.7),0 0 24px rgba(68,200,255,.45); }
.md-hub-world-actions { position:absolute; z-index:4; left:10px; right:10px; bottom:10px; display:grid; grid-template-columns:.82fr 1.55fr; gap:8px; align-items:stretch; }
.md-hub-town-btn,.md-hub-enter-btn { min-height:65px; border-radius:17px; cursor:pointer; }
.md-hub-town-btn { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border:1px solid rgba(139,213,255,.65); background:linear-gradient(180deg,rgba(22,67,115,.95),rgba(7,27,61,.97)); color:#dff4ff; box-shadow:0 7px 0 #041329,0 0 18px rgba(60,183,255,.16); }
.md-hub-town-btn span { font-size:21px; line-height:1; }
.md-hub-town-btn b { font-family:'Baloo 2'; font-size:12px; }
.md-hub-enter-btn { display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid #ffe29a; background:linear-gradient(180deg,#ffe9a8,#ffc95f); color:#15112c; box-shadow:0 7px 0 #9c6315,0 0 25px rgba(255,209,102,.34); }
.md-hub-enter-btn span { font-family:'Baloo 2'; font-size:20px; font-weight:900; line-height:1.05; }
.md-hub-enter-btn small { font-size:8.5px; font-weight:900; opacity:.7; }
.md-hub-enter-btn:active,.md-hub-town-btn:active { transform:translateY(4px); }
.md-hub-enter-btn:active { box-shadow:0 3px 0 #9c6315,0 0 18px rgba(255,209,102,.25); }
.md-hub-town-btn:active { box-shadow:0 3px 0 #041329; }
.md-hub-dock { min-height:72px; padding:6px; display:grid; grid-template-columns:repeat(4,1fr); gap:4px; border:1px solid rgba(255,209,102,.34); border-radius:18px; background:linear-gradient(180deg,rgba(11,27,58,.94),rgba(4,12,31,.96)); box-shadow:0 -6px 22px rgba(0,0,0,.26); backdrop-filter:blur(10px); }
.md-hub-dock button { min-width:0; min-height:56px; padding:4px 2px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border:1px solid transparent; border-radius:12px; background:transparent; color:var(--ink-soft); font-size:20px; cursor:pointer; }
.md-hub-dock button > img { width:34px; height:34px; filter:drop-shadow(0 2px 4px rgba(0,0,0,.45)); }
.md-hub-dock button span { font-family:'Baloo 2'; font-size:9px; font-weight:800; }
.md-hub-dock button:active,.md-hub-dock button.active { color:var(--gold); border-color:rgba(255,209,102,.35); background:rgba(255,209,102,.08); }
.md-hub-more-panel { position:absolute; z-index:12; left:10px; right:10px; bottom:91px; padding:10px; border:1px solid var(--gold-deep); border-radius:18px; background:linear-gradient(180deg,rgba(20,30,66,.98),rgba(8,13,36,.99)); box-shadow:0 -8px 32px rgba(0,0,0,.55); backdrop-filter:blur(12px); animation:md-hub-more-in .18s ease-out both; }
.md-hub-more-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; color:var(--gold); font-family:'Baloo 2'; }
.md-hub-more-head button { width:36px; height:36px; border:0; border-radius:10px; background:rgba(255,255,255,.06); color:var(--ink); cursor:pointer; }
.md-hub-more-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.md-hub-more-grid button { min-width:0; min-height:57px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; border:1px solid rgba(110,198,255,.24); border-radius:12px; background:rgba(255,255,255,.035); color:var(--ink); font-size:19px; cursor:pointer; }
.md-hub-more-grid button > img { width:29px; height:29px; }
.md-hub-more-grid button span { font-family:'Baloo 2'; font-size:8.5px; font-weight:800; white-space:nowrap; }
.md-hub-more-grid button.danger { color:#ff9b9b; }

/* Character Status / Skills — data-first layout. The page deliberately has no hero or
   equipment artwork: the scroll area belongs to readable stats and reversible previews. */
.md-character-page { flex:1; min-height:640px; height:calc(100dvh - 32px); max-height:900px; padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom)); display:flex; flex-direction:column; gap:7px; position:relative; overflow:hidden; }
.md-character-page-title { min-height:48px; display:grid; grid-template-columns:48px 1fr 48px; align-items:center; }
.md-character-page-title button { width:44px; height:44px; border:1px solid #f3c759; border-radius:13px; background:linear-gradient(180deg,rgba(10,35,74,.96),rgba(3,16,42,.98)); color:#ffe496; font-family:'Baloo 2'; font-size:34px; line-height:1; box-shadow:0 3px 0 #6c4616; cursor:pointer; }
.md-character-page-title h1 { grid-column:2; margin:0; padding:3px 20px; justify-self:center; border-bottom:1px solid rgba(255,209,102,.62); color:#ffe6a0; font-family:'Baloo 2'; font-size:25px; line-height:1; text-shadow:0 2px 5px #000; }
.md-character-summary { padding:10px 13px 9px; border:1.5px solid #d8aa3d; border-radius:15px; background:linear-gradient(105deg,rgba(5,21,52,.95),rgba(6,18,43,.91)); box-shadow:inset 0 0 18px rgba(39,155,255,.08),0 5px 16px rgba(0,0,0,.28); }
.md-character-summary-main { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.md-character-summary-main strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#ffe6a0; font-family:'Baloo 2'; font-size:21px; line-height:1; }
.md-character-summary-main b { flex:0 0 auto; color:#ffd166; font-family:'Baloo 2'; font-size:15px; }
.md-character-level { margin-top:4px; color:#e5f3ff; font-family:'Baloo 2'; font-size:12px; font-weight:800; }
.md-character-exp { margin-top:3px; display:flex; align-items:center; gap:7px; color:#cfe5ff; font-size:9px; font-weight:900; }
.md-character-exp i { flex:1; height:7px; overflow:hidden; border:1px solid rgba(112,172,229,.65); border-radius:99px; background:#020919; }
.md-character-exp i b { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#168eff,#55e7ff); box-shadow:0 0 9px rgba(59,211,255,.65); }
.md-character-tabs { min-height:45px; display:grid; grid-template-columns:1fr 1fr; gap:5px; }
.md-character-tabs button { border:1px solid rgba(116,166,220,.45); border-radius:11px; background:linear-gradient(180deg,rgba(7,28,64,.92),rgba(3,14,38,.96)); color:#dbeaff; font-family:'Baloo 2'; font-size:14px; font-weight:800; cursor:pointer; }
.md-character-tabs button.active { border-color:#4ad7ff; color:#eafdff; background:linear-gradient(180deg,rgba(10,76,140,.95),rgba(5,31,78,.97)); box-shadow:inset 0 0 15px rgba(41,187,255,.2),0 0 9px rgba(40,198,255,.36); }
.md-character-scroll { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; display:flex; flex-direction:column; gap:7px; padding-bottom:2px; }
.md-status-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.md-stat-card,.md-upgrade-card,.md-skill-list { border:1px solid rgba(224,177,63,.78); border-radius:14px; background:linear-gradient(180deg,rgba(4,20,49,.94),rgba(3,13,35,.96)); box-shadow:inset 0 0 14px rgba(32,132,229,.06); }
.md-stat-card { padding:8px 9px 6px; }
.md-stat-card h2,.md-upgrade-head h2 { margin:0 0 4px; color:#ffe09a; font-family:'Baloo 2'; font-size:12px; line-height:1.1; }
.md-derived-row { min-height:25px; padding:3px 1px; display:flex; justify-content:space-between; align-items:center; gap:5px; border-top:1px solid rgba(102,160,218,.22); color:#e6f2ff; font-size:9px; font-weight:800; }
.md-derived-row > span:first-child { color:#bcd5f1; white-space:nowrap; }
.md-preview-value { color:#49e3ff !important; font-weight:900; text-shadow:0 0 8px rgba(55,215,255,.55); }
.md-advanced-toggle { width:100%; min-height:25px; margin-top:3px; border:1px solid rgba(94,161,223,.28); border-radius:8px; background:rgba(255,255,255,.035); color:#d8eaff; font-family:'Baloo 2'; font-size:9px; font-weight:800; cursor:pointer; }
.md-upgrade-card { padding:9px; }
.md-upgrade-head { display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:5px; margin-bottom:3px; }
.md-upgrade-head h2 { margin:0; font-size:15px; }
.md-upgrade-head > span { padding:3px 7px; border:1px solid rgba(255,209,102,.38); border-radius:8px; color:#cfe1f5; font-size:8px; font-weight:800; white-space:nowrap; }
.md-upgrade-head > span b { color:#ffe08d; font-size:11px; }
.md-upgrade-row { min-height:37px; display:grid; grid-template-columns:minmax(83px,1fr) 34px minmax(82px,auto) 34px; align-items:center; gap:5px; border-top:1px solid rgba(99,157,216,.21); }
.md-upgrade-name { color:#eef6ff; font-family:'Baloo 2'; font-size:11px; font-weight:800; }
.md-upgrade-value { text-align:center; color:#dcecff; font-size:10px; font-weight:800; white-space:nowrap; }
.md-upgrade-row button,.md-skill-level-control button { width:32px; height:30px; padding:0; border:1px solid #47ceff; border-radius:8px; background:rgba(7,39,83,.92); color:#dff8ff; font-size:19px; font-weight:900; box-shadow:inset 0 0 9px rgba(43,192,255,.12); cursor:pointer; }
.md-upgrade-row button:disabled,.md-skill-level-control button:disabled { opacity:.3; }
.md-preview-help { min-height:35px; display:flex; align-items:center; justify-content:space-between; gap:5px; color:#b9d3ef; font-size:8.5px; font-weight:800; }
.md-preview-help > span:first-child { color:#aeeeff; }
.md-preview-help button { min-height:28px; padding:3px 10px; border:1px solid rgba(123,165,209,.38); border-radius:8px; background:rgba(255,255,255,.04); color:#d9eaff; font-family:'Baloo 2'; font-size:9px; font-weight:800; cursor:pointer; }
.md-preview-help button:disabled { opacity:.35; }
.md-character-actions { display:grid; grid-template-columns:minmax(108px,.55fr) minmax(0,1.45fr); gap:7px; }
.md-character-actions button { min-height:47px; padding:7px 8px; border-radius:11px; font-family:'Baloo 2'; font-size:11px; font-weight:900; cursor:pointer; }
.md-character-actions button:disabled { opacity:.4; cursor:not-allowed; }
.md-character-actions .reset { border:1.5px solid #45d7ff; background:linear-gradient(180deg,rgba(7,50,100,.98),rgba(3,25,64,.98)); color:#e1f8ff; box-shadow:inset 0 0 12px rgba(42,188,255,.12),0 3px 0 #062d52; }
.md-character-actions .reset span { display:block; color:#76e8ff; font-size:9px; white-space:nowrap; }
.md-character-actions .apply { border:1.5px solid #fff0a8; background:linear-gradient(180deg,#ffe894,#f2bb43); color:#20142d; box-shadow:inset 0 0 9px rgba(255,255,255,.25),0 3px 0 #8b5a18; }
.md-character-page > .md-hub-dock { flex:0 0 auto; min-height:67px; }
.md-character-page > .md-hub-dock button { min-height:51px; }
.md-character-more { position:absolute; z-index:15; left:8px; right:8px; bottom:82px; padding:8px; border:1px solid #d3a844; border-radius:14px; background:rgba(4,17,44,.98); box-shadow:0 -5px 22px rgba(0,0,0,.45); }
.md-character-more button { width:100%; min-height:42px; border:1px solid rgba(91,196,255,.38); border-radius:10px; background:rgba(255,255,255,.04); color:#e2f3ff; font-family:'Baloo 2'; font-weight:800; }
.md-character-confirm { position:absolute; z-index:50; inset:0; padding:18px; display:grid; place-items:center; background:rgba(1,5,17,.8); backdrop-filter:blur(5px); }
.md-character-confirm-card { width:100%; max-width:340px; padding:18px; border:1.5px solid #e1b13e; border-radius:17px; background:linear-gradient(180deg,#0c2451,#06132f); text-align:center; box-shadow:0 16px 45px rgba(0,0,0,.62); }
.md-character-confirm-card h3 { margin:0; color:#ffe297; font-family:'Baloo 2'; font-size:20px; }
.md-character-confirm-card p { margin:7px 0; color:#c5d9f2; font-size:11px; font-weight:700; }
.md-character-confirm-card > strong { color:#72e5ff; font-family:'Baloo 2'; }
.md-character-confirm-card > div { margin-top:13px; display:grid; grid-template-columns:1fr 1fr; gap:7px; }
.md-character-confirm-card button { min-height:42px; border:1px solid rgba(122,167,214,.5); border-radius:10px; background:#19284b; color:#eef7ff; font-family:'Baloo 2'; font-weight:800; }
.md-character-confirm-card button.confirm { border-color:#ffe499; background:linear-gradient(180deg,#ffe894,#efb43b); color:#20142d; }
.md-skill-toolbar { min-height:43px; padding:8px 12px; display:flex; align-items:center; border:1px solid rgba(220,174,61,.76); border-radius:12px; background:rgba(4,20,49,.94); color:#ffe19a; font-family:'Baloo 2'; font-size:14px; }
.md-skill-filters { min-height:39px; display:grid; grid-template-columns:repeat(3,1fr); border:1px solid rgba(95,157,220,.35); border-radius:11px; overflow:hidden; background:rgba(3,16,41,.92); }
.md-skill-filters button { border:0; border-right:1px solid rgba(95,157,220,.28); background:transparent; color:#bfd5ee; font-family:'Baloo 2'; font-size:10px; font-weight:800; }
.md-skill-filters button:last-child { border-right:0; }
.md-skill-filters button.active { color:#e8fbff; background:rgba(17,115,191,.48); box-shadow:inset 0 -2px #49dfff; }
.md-skill-list { padding:7px; display:flex; flex-direction:column; gap:5px; }
.md-skill-upgrade { min-height:67px; padding:7px; display:grid; grid-template-columns:43px minmax(0,1fr) auto; align-items:center; gap:7px; border:1px solid rgba(99,160,218,.28); border-radius:11px; background:rgba(255,255,255,.025); }
.md-skill-upgrade.locked { opacity:.5; }
.md-skill-upgrade-icon { width:42px; height:42px; display:grid; place-items:center; border:1px solid #d6a73e; border-radius:10px; background:radial-gradient(circle,rgba(31,133,223,.3),rgba(2,12,34,.92)); font-size:24px; }
.md-skill-upgrade-copy { min-width:0; display:flex; flex-direction:column; }
.md-skill-upgrade-copy strong { color:#ffe19a; font-family:'Baloo 2'; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.md-skill-upgrade-copy small { color:#c1d7ef; font-size:8.5px; font-weight:800; line-height:1.25; }
.md-skill-level-control { display:grid; grid-template-columns:32px minmax(61px,auto) 32px; align-items:center; gap:4px; }
.md-skill-level-control > span { text-align:center; color:#dcecff; font-size:9px; font-weight:900; white-space:nowrap; }
.md-skill-empty { padding:30px 12px; text-align:center; color:#adc5e1; font-size:11px; font-weight:800; }

@media (max-width:380px) {
  .md-character-page { padding-left:6px; padding-right:6px; }
  .md-character-summary-main strong { font-size:19px; }
  .md-status-grid { grid-template-columns:1fr; }
  .md-upgrade-row { grid-template-columns:minmax(76px,1fr) 31px minmax(74px,auto) 31px; gap:3px; }
  .md-upgrade-row button,.md-skill-level-control button { width:29px; }
  .md-character-actions { grid-template-columns:101px 1fr; }
  .md-skill-upgrade { grid-template-columns:39px minmax(0,1fr); }
  .md-skill-upgrade-icon { width:38px; height:38px; }
  .md-skill-level-control { grid-column:1 / -1; justify-content:end; }
}

/* Town hub — landmark buttons sit over the art instead of being baked into it. */
.md-town-shell { flex:1; min-height:640px; padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom)); display:flex; flex-direction:column; gap:6px; position:relative; overflow:hidden; }
.md-town-resources { position:relative; z-index:8; }
.md-town-resources span { background:linear-gradient(180deg,rgba(6,24,51,.92),rgba(3,14,34,.9)); border-color:rgba(255,210,105,.55); color:#e9f7ff; box-shadow:0 3px 10px rgba(0,0,0,.22); }
.md-town-world { flex:1; min-height:470px; position:relative; }
.md-town-title { position:absolute; z-index:6; top:1px; left:50%; transform:translateX(-50%); margin:0; min-width:116px; padding:3px 19px 4px; border:1px solid rgba(255,220,132,.9); border-radius:999px; background:linear-gradient(180deg,rgba(8,38,76,.94),rgba(3,20,48,.95)); box-shadow:0 3px 0 rgba(91,53,16,.78),0 4px 14px rgba(0,0,0,.25); color:#fff0bc; font-family:'Baloo 2'; font-size:21px; line-height:1.05; text-align:center; text-shadow:0 2px 0 rgba(0,0,0,.5); }
.md-town-leaderboard { position:absolute; z-index:7; top:-2px; left:0; width:96px; padding:0; display:flex; flex-direction:column; align-items:center; border:0; background:transparent; color:#071b3b; cursor:pointer; filter:drop-shadow(0 2px 3px rgba(255,255,255,.75)); }
.md-town-leaderboard img { width:72px; height:52px; object-fit:contain; animation:md-town-bird-float 2.8s ease-in-out infinite; }
.md-town-leaderboard span { margin-top:-5px; padding:2px 7px; border:1px solid #e5b94f; border-radius:999px; background:rgba(5,27,61,.94); color:#fff0bc; font-family:'Baloo 2'; font-size:8px; font-weight:800; letter-spacing:.1px; box-shadow:0 3px 8px rgba(0,0,0,.25); }
.md-town-hotspot { position:absolute; z-index:5; min-height:34px; padding:4px 10px; display:flex; align-items:center; gap:4px; border:1px solid rgba(255,222,137,.96); border-radius:999px; background:linear-gradient(180deg,rgba(8,48,91,.94),rgba(3,24,57,.96)); color:#fff3c5; box-shadow:0 3px 0 rgba(103,59,16,.82),0 3px 12px rgba(0,0,0,.28),0 0 11px rgba(255,210,93,.22); cursor:pointer; white-space:nowrap; }
.md-town-hotspot:active,.md-town-leaderboard:active,.md-town-chat:active,.md-town-dungeon:active { transform:translateY(2px); }
.md-town-hotspot strong { font-family:'Baloo 2'; font-size:11px; line-height:1; }
.md-town-hotspot-icon { color:#ffd878; font-size:14px; line-height:1; }
.md-town-hotspot.guild { top:28%; left:1%; }
.md-town-hotspot.arena { top:20%; left:50%; transform:translateX(-50%); }
.md-town-hotspot.arena:active { transform:translate(-50%,2px); }
.md-town-hotspot.summoning { top:32%; right:0; }
.md-town-hotspot.home { top:61%; left:50%; transform:translateX(-50%); }
.md-town-hotspot.home:active { transform:translate(-50%,2px); }
.md-town-hotspot.enhance { top:70%; left:0; }
.md-town-hotspot.shop { top:70%; right:0; }
.md-town-dungeon { position:absolute; z-index:6; left:50%; bottom:1.5%; transform:translateX(-50%); min-width:156px; min-height:42px; padding:18px 17px 3px; border:1px solid rgba(111,163,203,.62); border-radius:19px 19px 11px 11px; background:radial-gradient(ellipse at 50% 8%,rgba(24,148,219,.38),rgba(4,14,34,.93) 60%); color:#c7def0; box-shadow:0 5px 0 #020816,0 0 16px rgba(25,139,212,.28),inset 0 0 14px rgba(0,0,0,.45); cursor:pointer; }
.md-town-dungeon:active { transform:translate(-50%,2px); }
.md-town-dungeon span { font-family:'Baloo 2'; font-size:10px; font-weight:800; text-shadow:0 2px 3px #000; }
.md-town-chat { position:absolute; z-index:8; right:1px; bottom:2%; width:48px; height:48px; padding:3px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid #f0c35a; border-radius:50%; background:linear-gradient(180deg,rgba(13,62,108,.96),rgba(4,25,58,.98)); color:#ffe8a4; box-shadow:0 3px 0 #633a12,0 4px 12px rgba(0,0,0,.3); cursor:pointer; }
.md-town-chat span { font-size:14px; line-height:.7; }
.md-town-chat b { margin-top:3px; font-family:'Baloo 2'; font-size:8px; }
.md-town-notice { position:absolute; z-index:11; left:50%; bottom:10%; transform:translateX(-50%); width:max-content; max-width:84%; padding:7px 13px; border:1px solid #efd06e; border-radius:999px; background:rgba(4,17,40,.94); color:#fff0b7; font-family:'Baloo 2'; font-size:10px; font-weight:800; box-shadow:0 5px 18px rgba(0,0,0,.35); animation:md-town-notice-in .18s ease-out both; }
.md-town-more-panel { bottom:88px; }
@keyframes md-town-bird-float { 0%,100% { transform:translateY(0) rotate(-2deg); } 50% { transform:translateY(-4px) rotate(2deg); } }
@keyframes md-town-notice-in { from { opacity:0; transform:translate(-50%,7px); } to { opacity:1; transform:translate(-50%,0); } }
@keyframes md-hub-gate-glow { 0%,100% { opacity:.55; transform:translateX(-50%) scale(.92); } 50% { opacity:1; transform:translateX(-50%) scale(1.08); } }
@keyframes md-hub-alert { 0%,100% { transform:scale(.82); } 50% { transform:scale(1.18); } }
@keyframes md-hub-more-in { from { opacity:0; transform:translateY(8px) scale(.98); } to { opacity:1; transform:none; } }

@media (max-width:380px) {
  .md-town-title { min-width:103px; font-size:19px; }
  .md-town-leaderboard { width:88px; }
  .md-town-leaderboard img { width:66px; }
  .md-town-hotspot { padding:4px 8px; }
  .md-town-hotspot strong { font-size:10px; }
}

/* boss/elite/floor-modifier pill above the arena — previously had no base rule at all (only
   inline colors), so it was a full-width block with no width cap: long modifier names would
   wrap awkwardly instead of sitting as a compact centered pill. width:fit-content lets the
   inline margin:"0 auto" actually center it, max-width+ellipsis keeps it on one line. */
.md-modifier-chip { display: block; width: fit-content; max-width: 92%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* stars for equipment rarity */
.md-stars-row { display: flex; gap: 1px; }
.md-star { font-size: 11px; color: var(--gold); text-shadow: 0 0 4px var(--gold-glow); }
.md-star.dim { color: rgba(255,255,255,0.15); }

/* equipment / inventory */
.md-slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
.md-slot { border-radius: 12px; padding: 8px 6px; text-align: center; background: rgba(255,255,255,0.04); border: 1.5px dashed rgba(255,209,102,0.3); cursor: pointer; }
.md-slot.filled { border-style: solid; background: var(--panel); border-color: var(--gold-deep); }
.md-slot-icon { font-size: 20px; }
.md-slot-label { font-size: 10px; font-weight: 800; color: var(--ink-soft); margin-top: 2px; }
.md-slot-name { font-size: 10.5px; font-weight: 800; margin-top: 2px; line-height: 1.15; color: var(--gold); }

.md-inv-list { display: flex; flex-direction: column; gap: 6px; max-height: 230px; overflow-y: auto; }
.md-shop-list { display: flex; flex-direction: column; gap: 6px; }
.md-inv-item { display: flex; align-items: center; justify-content: space-between; background: var(--panel); border-radius: 10px; padding: 7px 10px; border-left: 4px solid var(--rare); }
.md-inv-item.unique { border-left-color: var(--unique); }
.md-inv-item.elite { border-left-color: var(--elite); }
.md-inv-name { font-weight: 800; font-size: 12.5px; }
.md-inv-stat { font-size: 10.5px; color: var(--ink-soft); font-weight: 700; }
.md-drop-banner { text-align: center; font-family:'Baloo 2'; font-weight: 700; font-size: 13px; padding: 8px; border-radius: 10px; margin-top: 8px; border: 1px solid var(--gold-deep); }

/* stage select */
.md-stage-list { display: flex; flex-direction: column; gap: 8px; max-height: 340px; overflow-y: auto; padding-right: 2px; }
.md-stage-node {
  display: flex; align-items: center; gap: 12px; text-align: left;
  background: var(--panel); border: 1.5px solid var(--gold-deep); border-radius: 14px; padding: 10px 12px;
  font-family: 'Nunito'; cursor: pointer; color: var(--ink);
}
.md-stage-node.boss { border-color: var(--gold); background: linear-gradient(90deg, rgba(255,209,102,0.15), var(--panel)); }
.md-stage-node.locked { opacity: 0.4; cursor: not-allowed; border-style: dashed; }
.md-stage-num { width: 38px; height: 38px; border-radius: 10px; background: rgba(255,209,102,0.15); display: flex; align-items: center; justify-content: center; font-family: 'Baloo 2'; font-weight: 800; font-size: 15px; color: var(--gold); flex-shrink: 0; }
.md-stage-node.boss .md-stage-num { background: linear-gradient(180deg, #FFE49A, var(--gold)); color: var(--bg-top); }
.md-stage-info { flex: 1; }
.md-stage-title { font-weight: 800; font-size: 13.5px; }
.md-stage-sub { font-size: 10.5px; color: var(--ink-soft); font-weight: 700; }
.md-stage-arrow { color: var(--gold); font-size: 16px; }

/* Dungeon Floor Select v2 — interactive gates are part of a vertically scrolling gothic
   passage, while the approved first-person background remains R2-hosted and shared with
   the rest of the dungeon. There is deliberately no hero artwork and no Dungeon dock tab. */
.md-root-dungeon.md-root-map { --md-dungeon-veil:.22; }
.md-root-dungeon.md-root-map::before {
  background:
    radial-gradient(circle at 52% 28%,rgba(0,117,255,.16),transparent 28%),
    linear-gradient(180deg,rgba(2,7,21,.08),rgba(2,8,25,.19) 62%,rgba(1,5,18,.5)),
    url("ui/character-select-background.webp") center top / cover no-repeat;
  filter:saturate(.9) contrast(1.08) brightness(.78);
}
.md-dungeon-map-page {
  flex:1; min-height:640px; height:calc(100dvh - 32px); max-height:900px;
  padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom));
  display:flex; flex-direction:column; gap:6px; position:relative; overflow:hidden;
}
.md-dungeon-resources { z-index:8; flex:0 0 auto; }
.md-dungeon-resources span { border-color:rgba(224,177,63,.5); background:linear-gradient(180deg,rgba(4,20,49,.92),rgba(2,10,29,.9)); }
.md-dungeon-map-header { min-height:54px; flex:0 0 auto; display:grid; grid-template-columns:45px 1fr 45px; align-items:center; gap:5px; padding:3px 5px 5px; border-bottom:1px solid rgba(222,175,61,.46); text-align:center; text-shadow:0 2px 5px #000; }
.md-dungeon-map-header > button { width:41px; height:41px; border:1px solid #e4b84f; border-radius:12px; background:linear-gradient(180deg,rgba(8,34,73,.96),rgba(3,15,39,.98)); color:#ffe49a; font-family:'Baloo 2'; font-size:31px; line-height:1; box-shadow:0 3px 0 #684314; cursor:pointer; }
.md-dungeon-map-header > div { grid-column:2; min-width:0; }
.md-dungeon-map-header h1 { margin:0; color:#ffe7a5; font-family:'Baloo 2'; font-size:22px; line-height:1.05; }
.md-dungeon-map-header p { margin:2px 0 0; color:#c3daf4; font-size:8.5px; font-weight:800; }
.md-dungeon-floor-world { flex:1; min-height:0; position:relative; overflow:hidden; border:1px solid rgba(220,172,58,.34); border-radius:18px; background-image:linear-gradient(180deg,rgba(2,7,20,.08),rgba(1,5,16,.2)),url("ui/dungeon-select/dungeon-floor-select-v2.webp"); background-size:cover; background-position:center bottom; background-repeat:no-repeat; box-shadow:inset 0 0 42px rgba(0,0,0,.36),0 7px 24px rgba(0,0,0,.28); }
.md-dungeon-floor-node { width:124px; min-height:142px; padding:0; position:absolute; z-index:2; display:flex; flex-direction:column; align-items:center; border:0; background:transparent; color:#d4d8e1; cursor:pointer; filter:drop-shadow(0 7px 6px rgba(0,0,0,.72)); transform:translateX(-50%) scale(var(--md-gate-scale,1)); transform-origin:center top; }
.md-dungeon-floor-node:disabled { cursor:not-allowed; }
.md-dungeon-floor-number { min-width:43px; height:25px; margin-bottom:-4px; z-index:4; display:grid; place-items:center; padding:1px 9px; border:1px solid #71684f; border-radius:10px 10px 5px 5px; background:linear-gradient(180deg,#17243a,#060b15); color:#e5e7e8; font-family:'Baloo 2'; font-size:15px; font-weight:900; line-height:1; box-shadow:0 2px 0 #02050b; }
.md-dungeon-boss-label { position:absolute; z-index:5; top:23px; padding:1px 7px; border:1px solid #9b6e20; border-radius:999px; background:#130c08; color:#d7a334; font-family:'Baloo 2'; font-size:6.5px; font-weight:900; letter-spacing:.5px; }
.md-dungeon-door { width:94px; height:116px; position:relative; display:block; }
.md-dungeon-door > img { width:100%; height:100%; display:block; object-fit:contain; object-position:center bottom; user-select:none; -webkit-user-drag:none; transition:filter .2s ease,transform .2s ease; }
.md-dungeon-lock { position:absolute; z-index:6; left:50%; top:52%; width:29px; height:27px; transform:translate(-50%,-50%); display:grid; place-items:center; border:2px solid #8b929a; border-radius:5px; background:#313943; color:#bec6cf; font-size:14px; box-shadow:0 3px 6px #000; }
.md-dungeon-lock::before { content:""; position:absolute; left:6px; right:6px; top:-14px; height:15px; border:3px solid #90979e; border-bottom:0; border-radius:10px 10px 0 0; }
.md-dungeon-floor-state { min-width:70px; min-height:18px; z-index:4; margin-top:-7px; padding:2px 8px; border:1px solid #58594f; border-radius:6px; background:rgba(4,9,18,.94); color:#9ea6af; font-family:'Baloo 2'; font-size:7.5px; font-weight:800; line-height:1.35; }
.md-dungeon-floor-node.cleared .md-dungeon-door > img { filter:grayscale(.82) saturate(.35) brightness(.58); }
.md-dungeon-floor-node.current .md-dungeon-door > img { filter:saturate(1.28) brightness(1.08) drop-shadow(0 0 8px rgba(0,157,255,.95)) drop-shadow(0 0 15px rgba(0,83,255,.62)); transform:scale(1.04); }
.md-dungeon-floor-node.current .md-dungeon-floor-number,.md-dungeon-floor-node.current .md-dungeon-floor-state { border-color:#35bfff; color:#c9f5ff; box-shadow:0 0 10px rgba(0,157,255,.65); }
.md-dungeon-floor-node.locked { opacity:.84; filter:drop-shadow(0 8px 7px rgba(0,0,0,.85)); }
.md-dungeon-floor-node.locked .md-dungeon-door > img { filter:grayscale(.9) saturate(.15) brightness(.42); }
.md-dungeon-floor-node.boss .md-dungeon-door { width:104px; height:124px; }
.md-dungeon-floor-node.boss.current .md-dungeon-door > img { filter:saturate(1.18) brightness(1.05) drop-shadow(0 0 8px rgba(255,174,38,.9)) drop-shadow(0 0 16px rgba(185,87,0,.62)); }
.md-dungeon-floor-node.boss.current .md-dungeon-floor-number,.md-dungeon-floor-node.boss.current .md-dungeon-floor-state { border-color:#cf922d; color:#ffe2a0; box-shadow:0 0 10px rgba(218,137,25,.42); }
.md-dungeon-floor-node:active:not(:disabled) { filter:brightness(.88) drop-shadow(0 5px 5px rgba(0,0,0,.72)); }
.md-dungeon-map-page > .md-hub-dock { flex:0 0 auto; min-height:67px; z-index:10; }
.md-dungeon-map-page > .md-hub-dock button { min-height:51px; }
.md-dungeon-more-panel { bottom:82px; }

.md-floor-detail-backdrop { position:absolute; z-index:40; inset:0; display:flex; align-items:flex-end; background:rgba(1,5,16,.66); backdrop-filter:blur(2px); animation:md-floor-backdrop-in .2s ease-out both; }
.md-floor-detail-sheet { width:100%; max-height:min(79dvh,700px); padding:13px 12px max(13px,env(safe-area-inset-bottom)); position:relative; overflow-y:auto; overscroll-behavior:contain; border:1.5px solid #d4a43a; border-bottom:0; border-radius:23px 23px 0 0; background:linear-gradient(180deg,rgba(7,25,57,.98),rgba(3,12,32,.99)); box-shadow:0 -12px 38px rgba(0,0,0,.64),inset 0 0 25px rgba(28,127,232,.07); animation:md-floor-sheet-in .26s cubic-bezier(.22,.75,.24,1) both; }
.md-floor-detail-x { position:absolute; z-index:3; top:10px; right:10px; width:34px; height:34px; border:1px solid rgba(221,176,65,.64); border-radius:10px; background:rgba(3,12,31,.84); color:#ffe098; font-weight:900; cursor:pointer; }
.md-floor-detail-heading { min-height:58px; display:flex; align-items:center; justify-content:space-between; gap:44px; padding:2px 38px 7px 2px; border-bottom:1px solid rgba(218,171,58,.4); }
.md-floor-detail-heading small { color:#66d9ff; font-size:7px; font-weight:900; letter-spacing:1.2px; }
.md-floor-detail-heading h2 { margin:0; color:#ffe4a0; font-family:'Baloo 2'; font-size:27px; line-height:1; }
.md-floor-detail-heading.boss small { color:#ffc04d; }
.md-floor-cp { flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-end; }
.md-floor-cp span { color:#bfd4ec; font-size:7.5px; font-weight:800; }
.md-floor-cp strong { color:#ffcf65; font-family:'Baloo 2'; font-size:18px; line-height:1.05; }
.md-floor-monster-stage { min-height:116px; padding:10px 6px 4px; display:flex; align-items:flex-end; justify-content:center; gap:2px; overflow:hidden; border-bottom:1px solid rgba(83,161,225,.22); background:radial-gradient(ellipse at 50% 84%,rgba(23,132,218,.25),transparent 55%); }
.md-floor-monster { min-width:0; flex:0 1 94px; display:flex; flex-direction:column; align-items:center; color:#bfd6ed; font-size:7.5px; font-weight:800; text-align:center; }
.md-floor-monster-sprite { width:76px; height:76px; object-fit:contain; filter:drop-shadow(0 6px 5px rgba(0,0,0,.75)); }
.md-floor-monster-sprite.boss { width:104px; height:94px; }
.md-floor-monster-fallback { width:68px; height:68px; display:grid; place-items:center; font-size:35px; filter:grayscale(.3); }
.md-floor-monster > span { width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-shadow:0 2px 3px #000; }
.md-floor-detail-sheet > h3 { margin:9px 0 4px; color:#ffe2a0; font-family:'Baloo 2'; font-size:12px; }
.md-floor-events { display:flex; flex-direction:column; gap:4px; }
.md-floor-events > div { min-height:30px; padding:5px 9px; display:flex; align-items:center; gap:8px; border:1px solid rgba(80,164,225,.25); border-left-color:#3ccaff; border-radius:8px; background:rgba(255,255,255,.025); color:#dcecff; }
.md-floor-events span { width:20px; text-align:center; }
.md-floor-events b { font-size:9px; }
.md-floor-rewards { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; }
.md-floor-rewards > div { min-width:0; min-height:62px; padding:5px 2px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid rgba(218,171,58,.43); border-radius:10px; background:linear-gradient(180deg,rgba(10,32,67,.86),rgba(3,14,37,.92)); }
.md-floor-rewards span { font-size:19px; line-height:1.1; }
.md-floor-rewards b { color:#fff0bc; font-family:'Baloo 2'; font-size:10px; }
.md-floor-rewards small { max-width:100%; color:#a9c2df; font-size:6.5px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.md-floor-detail-actions { margin-top:11px; display:grid; grid-template-columns:.72fr 1.5fr; gap:7px; }
.md-floor-detail-actions button { min-height:48px; border-radius:12px; font-family:'Baloo 2'; font-size:13px; font-weight:900; cursor:pointer; }
.md-floor-detail-actions .close { border:1px solid rgba(119,158,202,.55); background:linear-gradient(180deg,#162b4d,#09162e); color:#dbeaff; box-shadow:0 3px 0 #030915; }
.md-floor-detail-actions .enter { border:1.5px solid #5ce1ff; background:linear-gradient(180deg,#0e71cf,#07408c); color:#f2fbff; font-size:17px; box-shadow:0 4px 0 #03245a,0 0 17px rgba(34,184,255,.38); }
@keyframes md-floor-backdrop-in { from { opacity:0; } to { opacity:1; } }
@keyframes md-floor-sheet-in { from { transform:translateY(100%); } to { transform:none; } }

@media (max-width:380px) {
  .md-dungeon-map-page { padding-left:6px; padding-right:6px; }
  .md-dungeon-map-header h1 { font-size:20px; }
  .md-dungeon-floor-node { width:112px; min-height:136px; }
  .md-dungeon-door { width:88px; height:108px; }
  .md-dungeon-floor-node.boss .md-dungeon-door { width:97px; height:116px; }
  .md-floor-detail-sheet { padding-left:9px; padding-right:9px; max-height:82dvh; }
  .md-floor-detail-heading { gap:8px; }
  .md-floor-detail-heading h2 { font-size:24px; }
  .md-floor-cp strong { font-size:16px; }
  .md-floor-monster-stage { min-height:104px; }
  .md-floor-monster-sprite { width:66px; height:66px; }
  .md-floor-monster-sprite.boss { width:90px; height:82px; }
  .md-floor-detail-actions .enter { font-size:15px; }
}

/* login */
.md-login-wrap {
  flex: 1; min-height: 640px; display: flex; flex-direction: column; justify-content: center;
  padding: 20px; position: relative; z-index: 2; isolation: isolate;
  background-image:
    linear-gradient(180deg, rgba(5,8,24,0.08) 0%, rgba(5,8,24,0.28) 46%, rgba(5,8,24,0.5) 100%),
    url("ui/login-background.webp");
  background-size: cover; background-position: center; background-repeat: no-repeat;
}
.md-login-wrap::before {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: radial-gradient(circle at 50% 38%, rgba(20,135,255,0.12), rgba(4,6,20,0.2) 62%, rgba(4,6,20,0.58) 100%);
}
.md-login-brand { padding: 0 0 12px !important; filter: drop-shadow(0 4px 10px rgba(0,0,0,.75)); }
.md-login-emblem {
  width: 86px; height: 86px; display: block; margin: 0 auto 7px; border-radius: 22px;
  border: 2px solid var(--gold); box-shadow: 0 0 0 3px rgba(8,17,45,.72), 0 0 22px rgba(0,194,255,.72);
}
.md-login-brand h1 { font-size: 28px !important; line-height: 1; letter-spacing: -.4px; color: #FFE49A; }
.md-login-brand p { color: #D8E9FF; text-shadow: 0 2px 5px #050817; margin-top: 8px; }
.md-login-wrap.is-departing {
  pointer-events: none; transform-origin: 50% 47%;
  animation: md-login-walk-forward 1.25s cubic-bezier(.22,.72,.18,1) both;
}
.md-login-wrap.is-departing .md-login-brand,
.md-login-wrap.is-departing .md-login-card {
  animation: md-login-ui-depart .72s ease-in both;
}
.md-login-card {
  padding: 16px; border: 1.5px solid #E6B84F;
  background: linear-gradient(180deg, rgba(10,18,43,.91), rgba(7,12,31,.94));
  box-shadow: inset 0 0 22px rgba(44,157,255,.12), 0 10px 28px rgba(0,0,0,.58), 0 0 0 1px rgba(82,194,255,.16);
  backdrop-filter: blur(7px);
}
.md-field-label { font-weight: 800; font-size: 12px; color: #D8E9FF; margin: 10px 0 5px; }
.md-field {
  width: 100%; min-height: 44px; border: 1.5px solid rgba(130,177,236,.72); border-radius: 10px;
  padding: 10px 12px; font-family: 'Nunito'; font-weight: 700; font-size: 14px;
  background: rgba(2,8,25,.7); color: var(--ink); box-shadow: inset 0 0 10px rgba(57,130,218,.1);
}
.md-field::placeholder { color: rgba(216,233,255,.45); }
.md-field:focus { outline: none; border-color: #5ED8FF; box-shadow: 0 0 0 3px rgba(49,185,255,.14), inset 0 0 10px rgba(57,130,218,.12); }
.md-login-card .md-btn-row { grid-template-columns: 1fr; gap: 9px; }
.md-login-card .md-btn { min-height: 45px; border-radius: 10px; }
.md-login-card .md-btn.primary { border: 1px solid #FFE49A; box-shadow: 0 4px 0 #9B691D, 0 0 15px rgba(255,209,102,.2); }
.md-login-card .md-btn.info { background: rgba(8,31,70,.86); border: 1.5px solid #42C8FF; color: #DDF6FF; box-shadow: 0 3px 0 #174B78; }
.md-auth-error { color: #FF9B9B; font-weight: 800; font-size: 12px; text-align: center; margin-top: 7px; }
.md-hint { font-size: 10.5px; color: #AFC7E8; font-weight: 700; line-height: 1.45; margin: 11px 0 0; text-align: center; }
.md-remember-password {
  display: flex; align-items: center; gap: 9px; width: fit-content; margin: 11px 0 2px;
  color: #C8DCF7; font-size: 11.5px; font-weight: 800; cursor: pointer; user-select: none;
}
.md-remember-password input {
  position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;
}
.md-remember-check {
  width: 21px; height: 21px; flex: 0 0 21px; position: relative;
  border: 1.5px solid #69A9EE; border-radius: 5px;
  background: rgba(1,7,24,.86); box-shadow: inset 0 0 7px rgba(45,148,255,.2);
}
.md-remember-password input:checked + .md-remember-check {
  border-color: #FFE49A;
  background: linear-gradient(180deg, #FFE8A3, #DFA739);
  box-shadow: inset 0 0 0 2px #A66C17, 0 0 10px rgba(255,209,102,.34);
}
.md-remember-password input:checked + .md-remember-check::after {
  content: "✓"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #211430; font-size: 15px; font-weight: 900; line-height: 1;
}
.md-remember-password input:focus-visible + .md-remember-check {
  outline: 2px solid #5ED8FF; outline-offset: 2px;
}
.md-remember-password input:disabled + .md-remember-check,
.md-remember-password input:disabled + .md-remember-check + span { opacity: .5; }

/* LOGIN ORNAMENT PASS
   Makes the real HTML controls match the approved login mockup more closely.
   Kept as CSS (not baked into the background) so inputs/buttons remain accessible. */
.md-login-card .md-field {
  border-radius: 4px;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
  padding-left: 58px;
  background-color: rgba(1, 7, 24, .84);
  background-repeat: no-repeat;
  background-position: 19px center;
  background-size: 23px 23px;
  box-shadow: inset 0 0 0 1px rgba(95, 151, 219, .24), inset 0 0 18px rgba(34, 115, 214, .12);
}
.md-login-card input:not([type="password"]).md-field {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23FFD166' d='M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Z'/%3E%3C/svg%3E");
}
.md-login-card input[type="password"].md-field {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23FFD166' d='M17 9h-1V7A4 4 0 0 0 8 7v2H7a2 2 0 0 0-2 2v9h14v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4V7Zm3 8.7V18h-2v-2.3a2 2 0 1 1 2 0Z'/%3E%3C/svg%3E");
}
.md-login-card .md-btn {
  position: relative; overflow: hidden; border-radius: 4px;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
  letter-spacing: .2px;
}
.md-login-card .md-btn::before,
.md-login-card .md-btn::after {
  content: "◆"; position: absolute; top: 50%; transform: translateY(-50%);
  font-size: 10px; line-height: 1;
}
.md-login-card .md-btn::before { left: 16px; }
.md-login-card .md-btn::after { right: 16px; }
.md-login-card .md-btn.primary {
  color: #231536;
  background:
    linear-gradient(110deg, rgba(255,255,255,.3), transparent 24% 76%, rgba(255,255,255,.2)),
    linear-gradient(180deg, #FFE8A3 0%, #FFD166 58%, #E5A936 100%);
  border: 2px solid #FFF0B1;
  box-shadow: inset 0 0 0 2px #D39324, inset 0 0 12px rgba(255,255,255,.28), 0 5px 0 #845312, 0 0 17px rgba(255,209,102,.28);
}
.md-login-card .md-btn.primary::before,
.md-login-card .md-btn.primary::after { color: #9A6416; }
.md-login-card .md-btn.info {
  color: #DDF6FF;
  background: linear-gradient(180deg, rgba(11,48,96,.98), rgba(5,24,58,.98));
  border: 2px solid #55D7FF;
  box-shadow: inset 0 0 0 2px #155589, inset 0 0 18px rgba(36,177,255,.12), 0 5px 0 #08375F, 0 0 14px rgba(38,190,255,.22);
}
.md-login-card .md-btn.info::before,
.md-login-card .md-btn.info::after { color: #61E2FF; text-shadow: 0 0 7px #22BFFF; }

@media (max-height: 680px) {
  .md-login-wrap { justify-content: flex-start; padding-top: 16px; }
  .md-login-emblem { width: 68px; height: 68px; border-radius: 17px; }
  .md-login-brand { padding-bottom: 7px !important; }
  .md-login-card { padding: 12px 15px; }
}

/* FIRST-PERSON CHARACTER SELECT
   The generated background is the next physical space beyond login-background.webp.
   Motion stays in lightweight CSS layers: camera push, rune glow, fog and particles. */
.md-character-select-wrap {
  flex: 1; min-height: 640px; display: flex; flex-direction: column; justify-content: center;
  padding: 18px 16px 20px; position: relative; z-index: 1; isolation: isolate; overflow: hidden;
  background: #071126;
}
.md-character-select-wrap::before,
.md-character-select-wrap::after {
  content: ""; position: absolute; inset: -3%; pointer-events: none;
  background-position: center; background-size: cover; background-repeat: no-repeat;
}
.md-character-select-wrap::before {
  z-index: 0;
  background-image:
    linear-gradient(180deg, rgba(3,7,20,.08), rgba(3,8,25,.22) 43%, rgba(2,6,19,.46)),
    url("ui/character-select-background.webp");
  transform: scale(1.02);
  animation: md-character-camera-idle 11s ease-in-out infinite alternate;
}
.md-character-select-wrap::after {
  z-index: 1; opacity: 0;
  background-image:
    linear-gradient(180deg, rgba(5,8,24,.08), rgba(5,8,24,.34) 58%, rgba(5,8,24,.54)),
    url("ui/login-background.webp");
}
.md-character-select-wrap.is-entering::before {
  animation:
    md-character-depth-enter 1.9s cubic-bezier(.22,.72,.18,1) both,
    md-character-camera-idle 11s 1.9s ease-in-out infinite alternate;
}
.md-character-select-wrap.is-entering::after {
  animation: md-character-login-bridge 1.9s cubic-bezier(.22,.72,.18,1) both;
}
.md-character-atmosphere { position: absolute; inset: 0; z-index: 2; overflow: hidden; pointer-events: none; }
.md-character-door-glow {
  position: absolute; width: 58%; height: 47%; left: 21%; top: 2%; opacity: .5;
  background: radial-gradient(ellipse, rgba(22,188,255,.34) 0%, rgba(17,103,218,.13) 38%, transparent 72%);
  filter: blur(8px); animation: md-character-glow 3.4s ease-in-out infinite;
}
.md-character-torch-glow {
  position: absolute; inset: 0; opacity: .38; mix-blend-mode: screen;
  background:
    radial-gradient(circle at 13% 23%, rgba(255,174,53,.48), transparent 12%),
    radial-gradient(circle at 87% 23%, rgba(255,174,53,.48), transparent 12%),
    radial-gradient(circle at 25% 43%, rgba(34,188,255,.32), transparent 10%),
    radial-gradient(circle at 75% 43%, rgba(34,188,255,.32), transparent 10%);
  animation: md-character-torch-flicker 1.45s steps(4,end) infinite;
}
.md-character-fog {
  position: absolute; left: -35%; width: 170%; height: 24%; border-radius: 50%; opacity: .2;
  background:
    radial-gradient(ellipse at 22% 55%, rgba(167,211,255,.5), transparent 30%),
    radial-gradient(ellipse at 57% 46%, rgba(105,175,242,.4), transparent 32%),
    radial-gradient(ellipse at 82% 58%, rgba(158,209,255,.42), transparent 28%);
  filter: blur(18px);
}
.md-character-fog-a { bottom: 15%; opacity: .3; animation: md-character-fog-drift 9s ease-in-out infinite alternate; }
.md-character-fog-b { bottom: 38%; opacity: .18; transform: scaleX(-1); animation: md-character-fog-drift 12s -4s ease-in-out infinite alternate-reverse; }
.md-character-particles {
  position: absolute; inset: -12% 0 0; opacity: .72;
  background-image:
    radial-gradient(circle, #6BE6FF 0 1px, transparent 1.8px),
    radial-gradient(circle, #24AFFF 0 1.2px, transparent 2px),
    radial-gradient(circle, rgba(255,222,132,.9) 0 .8px, transparent 1.7px);
  background-position: 12px 18px, 54px 82px, 27px 46px;
  background-size: 91px 119px, 137px 163px, 173px 211px;
  animation: md-character-particles-rise 10s linear infinite;
}
.md-character-select-wrap > :not(.md-character-atmosphere) { position: relative; z-index: 3; }
.md-character-select-wrap.is-entering > :not(.md-character-atmosphere) {
  animation: md-character-ui-enter .86s 1.05s ease-out both;
}
.md-character-select-title { padding: 0 0 11px; filter: drop-shadow(0 3px 8px rgba(0,0,0,.9)); }
.md-character-select-title h1 { font-size: 27px !important; color: #FFE49A; }
.md-character-select-title p { color: #D8E9FF; text-shadow: 0 2px 5px #030716; }
.md-character-slot-list { gap: 9px !important; }
.md-character-select-wrap .md-charselect-slot {
  min-height: 78px; padding: 13px 14px;
  background: linear-gradient(180deg, rgba(8,20,48,.92), rgba(4,11,31,.95));
  border: 1.5px solid #D4A63D;
  box-shadow: inset 0 0 18px rgba(45,148,255,.1), 0 7px 18px rgba(0,0,0,.44), 0 0 0 1px rgba(54,197,255,.12);
  backdrop-filter: blur(6px);
}
.md-charselect-crest {
  width: 46px; height: 46px; flex: 0 0 46px; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; border: 1.5px solid #E6B84F; color: #8EEBFF;
  font-family: 'Baloo 2'; font-size: 29px; font-weight: 800;
  background: radial-gradient(circle, rgba(24,140,255,.35), rgba(2,12,38,.94) 68%);
  box-shadow: inset 0 0 12px rgba(66,200,255,.2), 0 0 12px rgba(32,185,255,.22);
  text-shadow: 0 0 8px #24B7FF;
}
.md-character-select-wrap .md-charselect-slot .md-btn.primary {
  border: 1px solid #FFF0B1; box-shadow: 0 4px 0 #805113, 0 0 12px rgba(255,209,102,.19);
}
.md-character-select-wrap .md-charselect-slot > .md-btn.primary {
  background: linear-gradient(180deg, rgba(12,49,96,.98), rgba(5,24,58,.98));
  border: 1.5px solid #4DD3FF; color: #E2F7FF;
  box-shadow: 0 4px 0 #08375F, inset 0 0 13px rgba(36,177,255,.12);
}
.md-character-select-wrap .md-charselect-slot .md-btn.primary.wide:not(:only-child) {
  background: linear-gradient(180deg, #FFE8A3, #FFD166);
  border-color: #FFF0B1; color: #231536; box-shadow: 0 4px 0 #805113;
}
.md-character-logout { margin-top: 13px !important; background: rgba(5,15,38,.86) !important; border: 1px solid rgba(118,167,225,.58) !important; }

@keyframes md-character-login-bridge {
  0% { opacity: 1; transform: scale(1.13) translateY(1.8%); filter: blur(.7px); }
  58% { opacity: .64; }
  100% { opacity: 0; transform: scale(1.27) translateY(3.5%); filter: blur(1.7px); }
}
@keyframes md-login-walk-forward {
  0% { transform: scale(1); filter: brightness(1) blur(0); }
  100% { transform: scale(1.13) translateY(1.8%); filter: brightness(.76) blur(.7px); }
}
@keyframes md-login-ui-depart {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-12px); }
}
@keyframes md-character-depth-enter {
  0% { opacity: .2; transform: scale(.94) translateY(-2%); filter: brightness(.55) blur(1px); }
  100% { opacity: 1; transform: scale(1.02); filter: brightness(1) blur(0); }
}
@keyframes md-character-camera-idle {
  0% { transform: scale(1.02) translate3d(0,0,0); }
  100% { transform: scale(1.07) translate3d(0,-.8%,0); }
}
@keyframes md-character-ui-enter {
  0% { opacity: 0; transform: translateY(18px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes md-character-glow {
  0%,100% { opacity: .32; transform: scale(.94); }
  50% { opacity: .63; transform: scale(1.06); }
}
@keyframes md-character-torch-flicker {
  0%,100% { opacity: .27; filter: brightness(.88); }
  33% { opacity: .48; filter: brightness(1.22); }
  67% { opacity: .34; filter: brightness(1.02); }
}
@keyframes md-character-fog-drift {
  0% { transform: translate3d(-5%,0,0) scaleY(.82); }
  100% { transform: translate3d(6%,2%,0) scaleY(1.08); }
}
@keyframes md-character-particles-rise {
  from { transform: translateY(7%); }
  to { transform: translateY(-7%); }
}

@media (max-height: 680px) {
  .md-character-select-wrap { justify-content: flex-start; padding-top: 13px; }
  .md-character-select-title { padding-bottom: 7px; }
  .md-character-select-title h1 { font-size: 24px !important; }
  .md-character-select-wrap .md-charselect-slot { min-height: 70px; padding: 10px 12px; }
  .md-character-logout { margin-top: 9px !important; }
}
@media (prefers-reduced-motion: reduce) {
  .md-character-select-wrap::before,
  .md-character-select-wrap::after,
  .md-character-select-wrap.is-entering::before,
  .md-character-select-wrap.is-entering::after,
  .md-character-select-wrap.is-entering > :not(.md-character-atmosphere),
  .md-login-wrap.is-departing,
  .md-login-wrap.is-departing .md-login-brand,
  .md-login-wrap.is-departing .md-login-card,
  .md-character-door-glow,
  .md-character-torch-glow,
  .md-character-fog,
  .md-character-particles,
  .md-root-dungeon::before,
  .md-root-town::before,
  .md-town-leaderboard img,
  .md-town-notice,
  .md-hub-world::before,
  .md-hub-hotspot,
  .md-hub-icon-btn i,
  .md-hub-more-panel { animation: none !important; }
  .md-character-select-wrap::after { opacity: 0; }
  .md-login-wrap.is-departing .md-login-brand,
  .md-login-wrap.is-departing .md-login-card { opacity: .35; transition: opacity .18s ease; }
}

.md-inv-item.epic { border-left-color: var(--legendary); }

/* stage select dropdown */
.md-select {
  width: 100%; border: 1.5px solid var(--gold-deep); border-radius: 12px; padding: 12px 14px;
  font-family: 'Nunito'; font-weight: 800; font-size: 14px; background: rgba(0,0,0,0.35); color: var(--ink);
  appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FFD166'><path d='M7 10l5 5 5-5z'/></svg>");
  background-repeat: no-repeat; background-position: right 12px center; background-size: 18px;
}
.md-select:focus { outline: none; border-color: var(--gold); }
.md-select option { background: var(--bg-mid); color: var(--ink); }
.md-select option:disabled { color: rgba(255,255,255,0.35); }
.md-floor-slider { display: flex; gap: 8px; overflow-x: auto; padding: 4px 2px 8px; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; }
.md-floor-chip { flex: 0 0 auto; scroll-snap-align: center; min-width: 62px; padding: 10px 6px; border-radius: 12px; border: 1.5px solid rgba(255,209,102,0.3); background: var(--panel); color: var(--ink); text-align: center; font-weight: 800; font-size: 12px; cursor: pointer; }
.md-floor-chip.selected { border-color: var(--gold); background: rgba(255,209,102,0.16); box-shadow: 0 0 0 2px var(--gold-glow); }
.md-floor-chip.locked { opacity: 0.45; cursor: not-allowed; }
.md-floor-chip .sub { display:block; font-size: 9px; color: var(--ink-soft); font-weight: 700; margin-top: 2px; }
.md-map-bars { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.md-monster-board { display: flex; flex-direction: column; flex-wrap: nowrap; gap: 8px; align-items: flex-end; justify-content: flex-end; }
.md-monster-board .md-sprite-wrap { transform: scale(0.82); transform-origin: bottom center; }

/* floating quick-access buttons (shop / character / bag) */
.md-fab-stack {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 10px; z-index: 15;
}
.md-fab {
  width: 46px; height: 46px; border-radius: 50%; border: 1.5px solid var(--gold-deep);
  background: var(--panel); color: var(--ink); display: flex; align-items: center; justify-content: center;
  font-size: 20px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.4); backdrop-filter: blur(2px);
  transition: transform 0.08s ease;
}
.md-fab:active { transform: scale(0.92); }
.md-fab.active { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold-glow), 0 4px 10px rgba(0,0,0,0.4); }
.md-fab-icon { line-height: 1; }

/* pet status readout in combat */
.md-pet-chip {
  display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 800; color: var(--ink);
  background: rgba(10,6,22,0.55); border: 1.5px solid var(--violet-deep); border-radius: 999px; padding: 4px 10px 4px 6px;
  flex-shrink: 0; white-space: nowrap;
}
.md-pet-chip .cd { color: var(--ink-soft); font-weight: 700; }
.md-pet-chip.ready { border-color: var(--leaf-deep); }

/* turn order queue bar — shows action order for the current round, sorted by Speed */
.md-turn-queue {
  min-height: 30px;
  display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
  background: rgba(10,6,22,0.5); border: 1px solid rgba(255,209,102,0.22); border-radius: 999px;
  padding: 4px 8px; margin: 0 0 8px; position: relative; z-index: 6;
}
.md-turn-queue-item {
  display: flex; align-items: center; gap: 2px; opacity: 0.55; transition: opacity 0.2s ease, transform 0.2s ease;
}
.md-turn-queue-item.active { opacity: 1; transform: scale(1.18); }
.md-turn-queue-item.done { opacity: 0.28; }
.md-turn-queue-icon {
  width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 11px; background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,209,102,0.35);
}
.md-turn-queue-item.player .md-turn-queue-icon { border-color: var(--gold); }
.md-turn-queue-item.pet .md-turn-queue-icon { border-color: var(--violet-deep); }
.md-turn-queue-item.monster .md-turn-queue-icon { border-color: var(--coral-deep); }
.md-turn-queue-item.active .md-turn-queue-icon { box-shadow: 0 0 0 2px var(--gold-glow); }
.md-turn-queue-arrow { color: var(--ink-soft); font-size: 11px; opacity: 0.6; }

/* Battle uses the shared dungeon backdrop too; these translucent arena lights keep units and
   HP bars readable while allowing the global scene to remain visible underneath. */
.md-scene.battle-bg {
  background:
    radial-gradient(ellipse 55% 35% at 18% 12%, rgba(80,190,255,.12), transparent 60%),
    radial-gradient(circle at 82% 25%, rgba(255,209,102,.08), transparent 55%),
    radial-gradient(circle at 30% 85%, rgba(0,0,0,.25), transparent 50%),
    linear-gradient(180deg, rgba(11,28,59,.34) 0%, rgba(8,20,46,.47) 48%, rgba(4,12,31,.62) 100%);
  border-radius: 0 0 18px 18px;
  padding-top: 50px;
}
.md-scene.battle-bg .md-ground {
  background: linear-gradient(180deg, rgba(18,53,83,.72) 0%, rgba(7,24,48,.84) 100%);
  border-top: 3px solid rgba(78,190,236,.58);
  opacity: .78;
}
.md-scene.battle-bg .md-arena { padding: 6px 6px 18px; }

/* ---- battle top status bar: level + hp/mp/xp, no longer floats over the arena ---- */
.md-battle-top {
  position: relative; z-index: 6; display: flex; align-items: center; gap: 10px;
  background: linear-gradient(180deg, rgba(32,20,58,0.88), rgba(18,11,34,0.88));
  border: 1.5px solid var(--gold-deep); border-radius: 14px;
  padding: 7px 10px; margin-bottom: 8px; box-shadow: 0 3px 10px rgba(0,0,0,0.3);
}
.md-hud-lv {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: radial-gradient(circle at 35% 30%, #FFE49A, var(--gold-deep));
  border: 2px solid #2B1B08; color: #2B1B08; font-family: 'Baloo 2'; font-weight: 800; font-size: 15px;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.4);
}
.md-hud-bars { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.md-hud-row { display: flex; align-items: center; gap: 5px; }
.md-hud-label { font-family: 'Baloo 2'; font-size: 8.5px; font-weight: 800; color: var(--ink-soft); width: 16px; flex-shrink: 0; }
.md-hud-track { position: relative; flex: 1; height: 10px; border-radius: 5px; background: rgba(0,0,0,0.55); border: 1px solid rgba(0,0,0,0.6); overflow: hidden; }
.md-hud-track.xp { height: 4px; background: rgba(0,0,0,0.4); margin-left: 21px; }
.md-hud-fill { height: 100%; transition: width 0.4s ease; }
.md-hud-track.hp .md-hud-fill { background: linear-gradient(90deg, #FF8A5B, #E03A3A); }
.md-hud-track.mp .md-hud-fill { background: linear-gradient(90deg, #5B9CFF, #2C5FDB); }
.md-hud-track.xp .md-hud-fill { background: linear-gradient(90deg, #FFE49A, var(--gold)); }
.md-hud-txt { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,0.85); }

/* compact left-aligned HP/MP/EXP readout — no full-width bars here anymore.
   Real-time HP is shown on a small bar over the hero's head in the arena instead,
   the same way monsters/pets already show theirs. */
.md-hud-text { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; flex: 0 1 auto; min-width: 0; }
.md-hud-text-row { font-family: 'Baloo 2'; font-size: 10.5px; font-weight: 800; color: var(--ink); white-space: nowrap; }
.md-hud-text-row.xp { color: var(--gold); font-size: 9.5px; }
.md-hud-pet { margin-left: auto; display: flex; flex-direction: column; align-items: center; gap: 2px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,209,102,0.3); border-radius: 10px; padding: 4px 9px; flex-shrink: 0; }
.md-hud-pet-icon { font-size: 17px; line-height: 1; }
.md-hud-pet-cd { font-size: 8.5px; font-weight: 800; color: var(--ink-soft); white-space: nowrap; }
.md-hud-pet-cd.ready { color: #8ee0a8; }

.md-rail-badge {
  position: absolute; bottom: -5px; right: -5px; background: var(--gold); color: var(--bg-top);
  font-style: normal; font-family: 'Baloo 2'; font-weight: 800; font-size: 10px; border-radius: 999px;
  padding: 1px 5px; border: 1.5px solid var(--bg-top); min-width: 14px; text-align: center; line-height: 1.3;
}

/* ---- battle action dock: one unified bottom bar instead of floating clusters ---- */
.md-battle-dock {
  position: relative; z-index: 6; display: flex; align-items: center; justify-content: space-between;
  gap: 6px; padding: 6px 10px 0;
}
.md-dock-auto {
  padding: 8px 12px; border-radius: 999px; cursor: pointer; flex-shrink: 0;
  border: 2px solid var(--gold-deep); background: linear-gradient(180deg, rgba(64,46,22,0.92), rgba(28,18,8,0.92));
  color: #fff; font-family: 'Baloo 2'; font-weight: 800; font-size: 11px; letter-spacing: 0.4px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
}
.md-dock-auto:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.5); }
.md-dock-auto.active { border-color: var(--leaf-deep); background: linear-gradient(180deg, rgba(40,80,50,0.95), rgba(16,36,20,0.95)); }
.md-dock-circle {
  position: relative; width: 46px; height: 46px; border-radius: 50%; padding: 0; cursor: pointer; flex-shrink: 0;
  border: 2px solid var(--gold-deep); background: linear-gradient(180deg, rgba(64,46,22,0.92), rgba(28,18,8,0.92));
  display: flex; align-items: center; justify-content: center; font-size: 19px; color: #fff;
  box-shadow: 0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
}
.md-dock-circle.skill { border-color: var(--violet-deep); }
.md-dock-circle.flee { border-color: #E14F4F; }
.md-dock-circle:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.5); }
.md-dock-circle:disabled { opacity: 0.4; cursor: not-allowed; }
.md-dock-attack {
  width: 68px; height: 68px; border-radius: 50%; flex-shrink: 0; padding: 0; cursor: pointer;
  border: 3px solid var(--coral-deep); background: radial-gradient(circle at 35% 30%, #FF9B7A, #C23B2E);
  display: flex; align-items: center; justify-content: center; font-size: 28px; color: #fff;
  transform: translateY(-12px);
  box-shadow: 0 6px 0 rgba(0,0,0,0.5), 0 8px 16px rgba(194,59,46,0.4), inset 0 1px 0 rgba(255,255,255,0.25);
}
.md-dock-attack:active { transform: translateY(-9px); box-shadow: 0 3px 0 rgba(0,0,0,0.5); }
.md-dock-attack:disabled { opacity: 0.4; cursor: not-allowed; }

.md-skill-popover {
  position: absolute; right: 10px; bottom: 100%; margin-bottom: 8px; z-index: 7;
  display: grid; grid-template-columns: repeat(3, 46px); gap: 6px;
  padding: 8px; border: 2px solid var(--violet-deep); border-radius: 14px; background: rgba(20,12,30,0.92);
  box-shadow: 0 6px 18px rgba(0,0,0,0.4);
}
.md-skill-cell {
  position: relative; width: 46px; height: 46px; border-radius: 10px; padding: 0; cursor: pointer;
  border: 2px solid var(--violet-deep); background: linear-gradient(180deg, rgba(64,46,22,0.92), rgba(28,18,8,0.92));
  color: #fff; font-size: 19px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
}
.md-skill-cell:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.5); }
.md-skill-cell:disabled { opacity: 0.35; cursor: not-allowed; }
.md-skill-num {
  position: absolute; top: 1px; left: 3px; font-size: 9px; font-weight: 800; color: var(--gold);
  font-family: 'Baloo 2';
}

/* ---- quick slots: 4 always-visible one-tap combat slots + assign/edit UI ---- */
.md-quickslot-bar { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.md-quickslot-bar.battle { position: relative; }
.md-quickslot-btn {
  position: relative; width: 40px; height: 40px; border-radius: 12px; padding: 0; cursor: pointer;
  border: 2px solid var(--gold-deep); background: linear-gradient(180deg, rgba(64,46,22,0.92), rgba(28,18,8,0.92));
  display: flex; align-items: center; justify-content: center; font-size: 17px; color: #fff;
  box-shadow: 0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15); flex-shrink: 0;
}
.md-quickslot-btn.empty { opacity: 0.55; border-style: dashed; }
.md-quickslot-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.5); }
.md-quickslot-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.md-quickslot-btn.editing { border-color: #E14F4F; }
.md-quickslot-icon { pointer-events: none; }
.md-quickslot-edit {
  width: 30px; height: 30px; border-radius: 50%; padding: 0; cursor: pointer; flex-shrink: 0;
  border: 2px solid var(--violet-deep); background: rgba(20,12,30,0.92); color: #fff; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
}
.md-quickslot-edit.active { border-color: #8ee0a8; color: #8ee0a8; }
.md-skill-popover.quickslot-assign, .md-skill-popover.more {
  right: auto; left: 0; grid-template-columns: none; display: flex; flex-direction: column;
  width: min(78vw, 300px); max-height: 50vh; overflow-y: auto;
}
.md-quickslot-popover-title { font-family: 'Baloo 2'; font-weight: 800; font-size: 11.5px; color: var(--gold); margin-bottom: 6px; }
.md-quickslot-popover-list { display: flex; flex-direction: column; gap: 4px; }
.md-quickslot-popover-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer;
  padding: 7px 10px; border-radius: 10px; border: 1.5px solid var(--violet-deep);
  background: rgba(64,46,22,0.5); color: #fff; font-family: 'Baloo 2'; font-size: 12px; font-weight: 700;
}
.md-quickslot-popover-item:active { transform: translateY(1px); }
.md-quickslot-popover-item:disabled { opacity: 0.4; cursor: not-allowed; }
.md-quickslot-popover-sub { color: var(--ink-soft); font-size: 10.5px; font-weight: 800; flex-shrink: 0; }

/* quick slot panel inside the Inventory sheet */
.md-quickslot-panel { margin: 4px 0 10px; padding: 8px 10px; border-radius: 14px; border: 1.5px solid var(--gold-deep); background: rgba(0,0,0,0.22); position: relative; }
.md-quickslot-panel-label { font-family: 'Baloo 2'; font-weight: 800; font-size: 11px; color: var(--gold); margin-bottom: 6px; }
.md-quickslot-clear {
  position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%;
  background: #E14F4F; color: #fff; font-size: 9px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; border: 1.5px solid rgba(0,0,0,0.4);
}
.md-quickslot-popover { margin-top: 8px; padding: 8px; border-radius: 12px; border: 1.5px solid var(--violet-deep); background: rgba(20,12,30,0.92); }


/* ---- character equipment / inventory redesign ---- */
.md-equip-overlay { position:absolute; inset:0; z-index:20; background:rgba(6,3,15,0.82); display:flex; align-items:flex-end; justify-content:center; }
.md-equip-sheet { width:100%; max-height:96%; overflow-y:auto; background:linear-gradient(180deg,#30204f 0%,#1b1233 72%,#120b24 100%); border:1.5px solid var(--gold-deep); border-bottom:none; border-radius:22px 22px 0 0; padding:12px 12px 18px; box-shadow:0 -12px 35px rgba(0,0,0,.45); }
.md-equip-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.md-equip-head-title { font-family:'Baloo 2'; font-size:19px; font-weight:800; color:var(--gold); margin:0; }
.md-equip-head-sub { font-size:10px; color:var(--ink-soft); font-weight:800; }
.md-equip-stage { position:relative; min-height:320px; margin:4px 0 10px; border:1px solid rgba(255,209,102,.22); border-radius:18px; background:radial-gradient(circle at 50% 46%,rgba(139,106,232,.20),transparent 34%),linear-gradient(180deg,rgba(10,6,22,.22),rgba(10,6,22,.58)); overflow:hidden; }
.md-equip-stage:before { content:''; position:absolute; left:50%; bottom:34px; width:150px; height:22px; transform:translateX(-50%); border-radius:50%; background:rgba(0,0,0,.38); filter:blur(2px); }
.md-equip-character { position:absolute; left:50%; top:50%; transform:translate(-50%,-45%); display:flex; align-items:center; justify-content:center; width:108px; height:132px; z-index:2; }
.md-equip-character .md-sprite-wrap { transform:scale(1.55); transform-origin:center bottom; }
.md-equip-character .md-sprite-name { display:none; }
.md-equip-slots { position:absolute; inset:12px; z-index:3; }
.md-equip-slot { position:absolute; width:72px; min-height:70px; padding:6px 4px; border:1.5px solid rgba(255,209,102,.48); border-radius:13px; background:rgba(10,6,22,.78); box-shadow:0 4px 12px rgba(0,0,0,.28); cursor:pointer; text-align:center; }
.md-equip-slot.empty { border-style:dashed; opacity:.72; }
.md-equip-slot.selected { border-color:var(--gold); box-shadow:0 0 0 2px var(--gold-glow),0 5px 14px rgba(0,0,0,.35); }
.md-equip-slot.weapon { left:2px; top:50%; transform:translateY(-50%); }
.md-equip-slot.accessory { right:2px; top:50%; transform:translateY(-50%); }
.md-equip-slot.helmet { left:50%; top:4px; transform:translateX(-50%); }
.md-equip-slot.chest { left:2px; top:16px; }
.md-equip-slot.gloves { right:2px; top:16px; }
.md-equip-slot.boots { left:50%; bottom:3px; transform:translateX(-50%); }
.md-equip-slot-icon { font-size:22px; line-height:22px; }
.md-equip-slot-label { font-size:9px; color:var(--ink-soft); font-weight:800; margin-top:2px; }
.md-equip-slot-name { font-size:9px; color:var(--gold); font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; max-width: 100%; }
.md-equip-slot-stat { font-size:8px; color:var(--ink-soft); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.md-equip-slot-hint { font-size:7.5px; color:var(--ink-soft); opacity:0.7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.md-blacksmith-slots { display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; padding:10px; }
.md-blacksmith-slots .md-equip-slot { position: static !important; left:auto !important; right:auto !important; top:auto !important; bottom:auto !important; transform:none !important; width:100% !important; min-height:76px; }
.md-equip-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, auto); gap: 8px; align-items: stretch; padding: 8px 2px; position: relative; }
.md-equip-grid .md-equip-slot { position: static !important; left:auto !important; right:auto !important; top:auto !important; bottom:auto !important; transform:none !important; width:100% !important; min-height:72px; }
.md-equip-grid .md-equip-hero { grid-column: 2; grid-row: 2 / span 2; display: flex; align-items: flex-end; justify-content: center; pointer-events: none; }
.md-equip-grid .md-equip-slot-soon { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 12px; border: 1.5px dashed rgba(255,209,102,0.3); background: rgba(0,0,0,0.18); min-height: 72px; opacity: 0.55; }
.md-equip-grid .md-equip-slot-soon .icon { font-size: 20px; }
.md-equip-grid .md-equip-slot-soon .label { font-size: 9px; font-weight: 800; color: var(--ink-soft); }
.md-equip-summary { display:flex; justify-content:center; gap:7px; flex-wrap:wrap; margin:0 0 8px; }
.md-equip-stat-chip { border:1px solid rgba(255,209,102,.28); background:rgba(0,0,0,.22); border-radius:999px; padding:3px 8px; font-size:10px; font-weight:800; color:var(--ink-soft); white-space: nowrap; flex-shrink: 0; }
.md-equip-stat-chip b { color:var(--gold); }
.md-inventory-header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:7px 0; }
.md-inventory-header > div:first-child { min-width: 0; overflow: hidden; }
.md-inventory-title { font-family:'Baloo 2'; font-size:16px; font-weight:800; color:var(--gold); white-space: nowrap; }
.md-inventory-count { font-size:10px; color:var(--ink-soft); font-weight:800; white-space: nowrap; }
.md-inventory-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; }
.md-inventory-cell { min-width:0; aspect-ratio:1/1; border-radius:11px; border:1px solid rgba(255,209,102,.22); background:rgba(255,255,255,.035); position:relative; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.md-inventory-cell.empty { cursor:default; opacity:.55; }
.md-inventory-cell.selected { border:2px solid var(--gold); background:rgba(255,209,102,.11); box-shadow:0 0 0 2px var(--gold-glow); }
.md-inventory-cell.rare { border-color:rgba(111,207,151,.58); }
.md-inventory-cell.unique { border-color:rgba(79,168,224,.7); }
.md-inventory-cell.elite { border-color:rgba(255,184,77,.78); }
.md-inventory-cell-icon { font-size:22px; line-height:1; }
.md-inventory-cell-num { position:absolute; left:4px; top:3px; font-size:8px; color:var(--ink-soft); font-weight:800; }
.md-inventory-cell-qty { position:absolute; right:4px; bottom:3px; font-size:8px; color:var(--gold); font-weight:800; }
.md-inventory-cell-stars { position:absolute; left:50%; bottom:3px; transform:translateX(-50%) scale(.72); transform-origin:center; white-space:nowrap; }
.md-inventory-toggle { width:100%; margin-top:6px; padding:6px; border-radius:10px; border:1px dashed rgba(255,209,102,.4); background:rgba(255,255,255,.03); color:var(--ink-soft); font-family:'Baloo 2'; font-size:10.5px; font-weight:800; cursor:pointer; }
.md-inventory-toggle:active { background:rgba(255,209,102,.1); }
.md-item-detail { margin-top:8px; padding:9px 10px; border:1px solid rgba(255,209,102,.28); border-radius:13px; background:rgba(0,0,0,.22); min-height:54px; }
.md-item-detail-name { font-size:12px; font-weight:800; color:var(--gold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.md-item-detail-sub { font-size:10px; color:var(--ink-soft); font-weight:700; margin-top:2px; }
.md-item-actions { display:grid; grid-template-columns:1.2fr 1fr 1fr; gap:7px; margin-top:8px; }
.md-item-actions .md-btn { min-height:42px; padding:8px 6px; font-size:12px; }
.md-equip-close { margin-top:8px; }
@media (max-width:380px) {
  .md-equip-stage { min-height:300px; }
  .md-equip-slot { width:65px; min-height:65px; }
  .md-equip-character .md-sprite-wrap { transform:scale(1.35); }
}

/* ---- mobile web polish ---- */
@media (max-width: 480px) {
  body { padding: 0 !important; }
  .md-root { max-width: 100%; min-height: 100vh; min-height: 100dvh; border-radius: 0; box-shadow: none; }
}
.md-btn { min-height: 46px; }
.md-raid-boss-sprite { display:block; width:min(72vw, 280px); height:clamp(180px, 42vh, 310px); margin:10px auto 4px; object-fit:contain; object-position:center; user-select:none; -webkit-user-drag:none; }
.md-raid-boss-fallback { display:flex; align-items:center; justify-content:center; min-height:180px; border:1px dashed rgba(255,209,102,.45); border-radius:18px; background:radial-gradient(circle, rgba(167,139,240,.22), rgba(16,18,32,.18) 70%); color:var(--gold); font-size:22px; font-weight:900; letter-spacing:.18em; }
.md-toast { position: sticky; top: 4px; z-index: 20; margin: 0 auto 10px; padding: 10px 14px; border-radius: 12px; background: linear-gradient(135deg, var(--violet-deep), var(--violet)); border: 1px solid var(--gold-glow); color: var(--ink); font-size: 13px; text-align: center; box-shadow: 0 6px 16px rgba(0,0,0,0.4); animation: mdToastIn 0.25s ease-out; }
@keyframes mdToastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.md-fab, .md-buy-btn, select.md-select { touch-action: manipulation; }
/* ---- blacksmith anvil result animation ---- */
@keyframes anvil-success-flash {
  0% { box-shadow: 0 0 0 0 rgba(255,209,102,0.0); transform: scale(1); }
  30% { box-shadow: 0 0 22px 6px rgba(255,209,102,0.65); transform: scale(1.05); }
  100% { box-shadow: 0 0 0 0 rgba(255,209,102,0.0); transform: scale(1); }
}
@keyframes anvil-fail-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
.md-anvil-result-success { animation: anvil-success-flash 0.6s ease-out; }
.md-anvil-result-fail { animation: anvil-fail-shake 0.4s ease-in-out; border-color: #ff5566 !important; }
.md-blacksmith-icon { font-size: 40px; text-align: center; margin: 6px 0; transition: transform 0.15s ease; }
`;
