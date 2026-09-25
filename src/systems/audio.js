// Centralized BGM/SFX service. Audio preferences are device-local by design; no gameplay or
// account state is involved. BGM group changes are the only place that creates audio elements.
const AUDIO_STORAGE_KEY = "thornie-audio-v1";
const AUDIO_DEFAULTS = Object.freeze({
  bgmVolume: 0.5,
  bgmMuted: false,
  sfxVolume: 0.5,
  sfxMuted: false
});

function clampAudioVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return AUDIO_DEFAULTS.bgmVolume;
  return Math.max(0, Math.min(1, number));
}

function normalizeAudioPreferences(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    bgmVolume: clampAudioVolume(source.bgmVolume),
    bgmMuted: source.bgmMuted === true,
    sfxVolume: clampAudioVolume(source.sfxVolume),
    sfxMuted: source.sfxMuted === true
  };
}

function resolveAudioAsset(assetKey) {
  const entry = String(assetKey || "").split(".").reduce((obj, part) => obj?.[part], ASSETS);
  const path = typeof entry === "string" ? entry : entry?.path;
  return typeof path === "string" && path && typeof assetUrl === "function" ? assetUrl(path) : "";
}

class AudioManager {
  constructor() {
    this.preferences = this.loadPreferences();
    this.listeners = new Set();
    this.active = null;
    this.pending = null;
    this.transition = null;
    this.transitionToken = 0;
    this.requestedGroup = null;
    this.gestureRecoveryBound = false;
    this.onUserGesture = () => { this.resumeRequestedPlayback(); };
  }

  loadPreferences() {
    try {
      if (typeof window === "undefined") return { ...AUDIO_DEFAULTS };
      return normalizeAudioPreferences(JSON.parse(window.localStorage?.getItem(AUDIO_STORAGE_KEY) || "{}"));
    } catch (error) {
      return { ...AUDIO_DEFAULTS };
    }
  }

  persistPreferences() {
    try {
      window.localStorage?.setItem(AUDIO_STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      // Private browsing/storage restrictions must not stop game rendering or playback.
    }
  }

  getState() {
    return { ...this.preferences };
  }

  subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  updatePreferences(patch) {
    this.preferences = normalizeAudioPreferences({ ...this.preferences, ...patch });
    this.persistPreferences();
    this.applyVolumes();
    this.notify();
  }

  setBgmVolume(value) {
    this.updatePreferences({ bgmVolume: clampAudioVolume(value) });
  }

  setBgmMuted(value) {
    this.updatePreferences({ bgmMuted: value === true });
  }

  setSfxVolume(value) {
    this.updatePreferences({ sfxVolume: clampAudioVolume(value) });
  }

  setSfxMuted(value) {
    this.updatePreferences({ sfxMuted: value === true });
  }

  getBgmOutputVolume() {
    return this.preferences.bgmMuted ? 0 : this.preferences.bgmVolume;
  }

  getSfxOutputVolume() {
    return this.preferences.sfxMuted ? 0 : this.preferences.sfxVolume;
  }

  playSfx(assetKey, volumeScale = 1) {
    if (!assetKey || typeof Audio === "undefined") return Promise.resolve(false);
    const source = resolveAudioAsset(assetKey);
    if (!source) return Promise.resolve(false);
    const outputVolume = this.getSfxOutputVolume();
    if (outputVolume <= 0) return Promise.resolve(false);

    const audio = new Audio(source);
    audio.preload = "auto";
    audio.setAttribute("aria-hidden", "true");
    audio.volume = outputVolume * clampAudioVolume(volumeScale);

    let playback;
    try { playback = audio.play(); } catch (error) { playback = Promise.reject(error); }
    return Promise.resolve(playback).then(() => true).catch(() => false);
  }

  bindGestureRecovery() {
    if (this.gestureRecoveryBound || typeof window === "undefined") return;
    this.gestureRecoveryBound = true;
    ["pointerdown", "touchstart", "keydown"].forEach(type => {
      window.addEventListener(type, this.onUserGesture, { passive: true, capture: true });
    });
  }

  unbindGestureRecovery() {
    if (!this.gestureRecoveryBound || typeof window === "undefined") return;
    this.gestureRecoveryBound = false;
    ["pointerdown", "touchstart", "keydown"].forEach(type => {
      window.removeEventListener(type, this.onUserGesture, { capture: true });
    });
  }

  assetPathForGroup(groupKey) {
    const key = groupKey === "town_theme" ? "audio.bgm.townTheme" : "audio.bgm.mainTheme";
    return resolveAudioAsset(key);
  }

  createTrack(groupKey) {
    const source = this.assetPathForGroup(groupKey);
    if (!source || typeof Audio === "undefined") return null;
    const audio = new Audio(source);
    audio.preload = "auto";
    audio.loop = true;
    audio.setAttribute("aria-hidden", "true");
    audio.volume = 0;
    return audio;
  }

  playAudio(audio) {
    if (!audio) return Promise.reject(new Error("audio_unavailable"));
    let playback;
    try { playback = audio.play(); } catch (error) { playback = Promise.reject(error); }
    return Promise.resolve(playback).then(() => {
      this.unbindGestureRecovery();
      return true;
    }).catch(() => {
      // Autoplay rejection is expected on browsers until the next user gesture.
      this.bindGestureRecovery();
      return false;
    });
  }

  stopTrack(track) {
    if (!track?.audio) return;
    track.audio.pause();
    try { track.audio.currentTime = 0; } catch (error) {}
  }

  clearTransition() {
    if (!this.transition) return;
    clearInterval(this.transition.timer);
    this.stopTrack(this.transition.incoming);
    this.transition = null;
  }

  startCrossfade(from, incoming) {
    const token = ++this.transitionToken;
    const duration = 1400;
    const startedAt = Date.now();
    if (this.transition) clearInterval(this.transition.timer);
    const tick = () => {
      if (!this.transition || this.transition.token !== token) return;
      const progress = Math.max(0, Math.min(1, (Date.now() - startedAt) / duration));
      const targetVolume = this.getBgmOutputVolume();
      from.audio.volume = targetVolume * (1 - progress);
      incoming.audio.volume = targetVolume * progress;
      if (progress >= 1) {
        clearInterval(this.transition.timer);
        this.stopTrack(from);
        this.active = incoming;
        this.transition = null;
        this.applyVolumes();
        if (this.requestedGroup !== incoming.groupKey) this.requestGroup(this.requestedGroup);
      }
    };
    this.transition = { from, incoming, token, startedAt, timer: setInterval(tick, 50) };
    tick();
  }

  requestGroup(groupKey) {
    if (!groupKey) return;
    this.requestedGroup = groupKey;
    this.bindGestureRecovery();

    if (this.transition?.incoming?.groupKey === groupKey) {
      this.applyVolumes();
      this.playAudio(this.transition.incoming.audio);
      return;
    }
    if (this.pending?.groupKey === groupKey) return;
    if (this.transition?.from?.groupKey === groupKey) {
      this.clearTransition();
      this.applyVolumes();
      this.playAudio(this.active?.audio);
      return;
    }
    if (this.active?.groupKey === groupKey) {
      this.applyVolumes();
      this.playAudio(this.active.audio);
      return;
    }

    const incoming = this.createTrack(groupKey);
    if (!incoming) return;
    if (this.pending) this.stopTrack(this.pending);
    const previousTransition = this.transition;
    if (previousTransition) this.clearTransition();
    const from = this.active;
    const track = { groupKey, audio: incoming };
    this.pending = track;
    const token = ++this.transitionToken;
    this.playAudio(incoming).then(started => {
      if (this.pending === track) this.pending = null;
      if (this.requestedGroup !== groupKey || token !== this.transitionToken) {
        this.stopTrack(track);
        return;
      }
      if (!started) return;
      if (!from?.audio) {
        this.active = track;
        this.applyVolumes();
        return;
      }
      this.startCrossfade(from, track);
    });
  }

  resumeRequestedPlayback() {
    const target = this.transition?.incoming || this.active;
    if (!target || target.groupKey !== this.requestedGroup) {
      if (this.requestedGroup) this.requestGroup(this.requestedGroup);
      return;
    }
    this.playAudio(target.audio).then(started => {
      if (started && this.transition?.incoming === target) this.startCrossfade(this.transition.from, target);
    });
  }

  applyVolumes() {
    const targetVolume = this.getBgmOutputVolume();
    if (this.transition) {
      const elapsed = Date.now() - this.transition.startedAt;
      const progress = Math.max(0, Math.min(1, elapsed / 1400));
      this.transition.from.audio.volume = targetVolume * (1 - progress);
      this.transition.incoming.audio.volume = targetVolume * progress;
      return;
    }
    if (this.active?.audio) this.active.audio.volume = targetVolume;
  }

  setScreenPhase(phase) {
    // Pages without an approved group keep the current group. This is intentional for utility
    // pages opened from either Town or the Dungeon Hub and avoids an unnecessary restart.
    if (phase === "town") this.requestGroup("town_theme");
    else if (["login", "characterSelect", "menu", "map"].includes(phase)) this.requestGroup("main_theme");
  }
}

const AUDIO_MANAGER = new AudioManager();
