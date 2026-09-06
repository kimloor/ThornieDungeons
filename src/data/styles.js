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
.md-enemy-img.attack { animation: md-lunge-l 0.35s ease; }
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

.md-hub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }
.md-hub-btn { font-family: 'Baloo 2', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: var(--panel); border: 1.5px solid var(--gold-deep); border-radius: 16px; padding: 14px 8px; color: var(--ink); cursor: pointer; box-shadow: 0 4px 0 rgba(0,0,0,0.35); transition: transform 0.08s ease, box-shadow 0.08s ease; }
.md-hub-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,0.35); }
.md-hub-btn .md-hub-icon { font-size: 26px; line-height: 1; }
.md-hub-btn .md-hub-label { font-weight: 800; font-size: 12.5px; }
.md-hub-btn.primary { background: linear-gradient(180deg, #FFE49A, var(--gold)); color: var(--bg-top); border-color: var(--gold-deep); }
.md-hub-footer { display: flex; gap: 8px; margin-top: 10px; }
.md-hub-footer .md-btn { flex: 1; }
.md-hub-save-btn { font-family: 'Baloo 2', sans-serif; display: block; margin: 10px auto 0; background: none; border: none; color: var(--ink-soft); font-size: 11.5px; font-weight: 700; opacity: 0.65; cursor: pointer; padding: 6px 10px; }
.md-hub-save-btn:active { opacity: 1; }

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
  animation: md-login-walk-forward .76s cubic-bezier(.22,.72,.18,1) both;
}
.md-login-wrap.is-departing .md-login-brand,
.md-login-wrap.is-departing .md-login-card {
  animation: md-login-ui-depart .42s ease-in both;
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
    md-character-depth-enter 1.45s cubic-bezier(.22,.72,.18,1) both,
    md-character-camera-idle 11s 1.45s ease-in-out infinite alternate;
}
.md-character-select-wrap.is-entering::after {
  animation: md-character-login-bridge 1.45s cubic-bezier(.22,.72,.18,1) both;
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
  animation: md-character-ui-enter .72s .78s ease-out both;
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
  .md-character-particles { animation: none !important; }
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

/* battle scene — RO-style grassy outdoor background */
.md-scene.battle-bg {
  background:
    radial-gradient(ellipse 55% 35% at 18% 12%, rgba(255,255,255,0.10), transparent 60%),
    radial-gradient(circle at 82% 25%, rgba(255,255,255,0.06), transparent 55%),
    radial-gradient(circle at 30% 85%, rgba(0,0,0,0.15), transparent 50%),
    linear-gradient(180deg, #7CA35A 0%, #5E8A44 45%, #4A6B37 100%);
  border-radius: 0 0 18px 18px;
  padding-top: 50px;
}
.md-scene.battle-bg .md-ground {
  background: linear-gradient(180deg, #3E5A2C 0%, #30461F 100%);
  border-top: 3px solid #6E9752;
  opacity: 0.9;
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
.md-boss-blob { width: 96px; height: 96px; margin: 10px auto 4px; display: flex; align-items: center; justify-content: center; font-size: 44px; border-radius: 46% 54% 58% 42% / 52% 46% 54% 48%; box-shadow: 0 6px 18px rgba(0,0,0,0.35), inset 0 -8px 14px rgba(0,0,0,0.2); animation: mdBossBlobPulse 2.6s ease-in-out infinite; }
@keyframes mdBossBlobPulse { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.05) rotate(-2deg); } }
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
