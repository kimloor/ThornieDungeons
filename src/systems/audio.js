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
    this.audioContext = null;
    this.bgmMasterGain = null;
    this.sfxMasterGain = null;
    this.mediaNodes = new WeakMap();
    this.backgroundSuspended = false;
    this.backgroundResume = null;
    this.onUserGesture = () => {
      this.enableWebAudio();
      this.resumeRequestedPlayback();
    };
    this.onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.hidden) this.suspendForBackground();
      else this.resumeFromBackground();
    };
    this.onPageHide = () => this.suspendForBackground();
    this.onPageShow = () => this.resumeFromBackground();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", this.onPageHide);
      window.addEventListener("pageshow", this.onPageShow);
    }
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

  isDocumentHidden() {
    return typeof document !== "undefined" && document.hidden === true;
  }

  releaseMediaTrack(track) {
    if (!track?.audio) return;
    const audio = track.audio;
    try { audio.pause(); } catch (error) {}
    try { audio.removeAttribute("src"); audio.load(); } catch (error) {}
  }

  clearMediaSession() {
    try {
      if (typeof navigator !== "undefined" && navigator.mediaSession) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      }
    } catch (error) {}
  }

  suspendForBackground() {
    if (this.backgroundSuspended) return;
    this.backgroundSuspended = true;
    this.unbindGestureRecovery();

    const resumeTrack = this.transition?.incoming || this.active || this.pending;
    const resumeTime = Number(resumeTrack?.audio?.currentTime) || 0;
    this.backgroundResume = this.requestedGroup
      ? { groupKey: this.requestedGroup, currentTime: resumeTime }
      : null;

    const tracks = [this.active, this.pending, this.transition?.from, this.transition?.incoming]
      .filter(Boolean);
    if (this.transition) clearInterval(this.transition.timer);
    [...new Set(tracks)].forEach(track => this.releaseMediaTrack(track));
    this.active = null;
    this.pending = null;
    this.transition = null;
    this.clearMediaSession();

    if (this.audioContext?.state === "running") this.audioContext.suspend().catch(() => {});
  }

  resumeFromBackground() {
    if (this.isDocumentHidden()) return;
    const wasSuspended = this.backgroundSuspended;
    this.backgroundSuspended = false;
    if (!wasSuspended) return;
    if (this.audioContext?.state === "suspended") this.audioContext.resume().catch(() => {});
    const resume = this.backgroundResume;
    this.backgroundResume = null;
    if (resume?.groupKey) this.requestGroup(resume.groupKey, resume.currentTime);
    else if (this.requestedGroup) this.requestGroup(this.requestedGroup);
  }

  enableWebAudio() {
    if (typeof window === "undefined" || this.isDocumentHidden()) return false;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return false;
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContextCtor();
        this.bgmMasterGain = this.audioContext.createGain();
        this.sfxMasterGain = this.audioContext.createGain();
        this.bgmMasterGain.connect(this.audioContext.destination);
        this.sfxMasterGain.connect(this.audioContext.destination);
      }
      [this.active, this.pending, this.transition?.from, this.transition?.incoming]
        .filter(Boolean)
        .forEach(track => this.connectMediaTrack(track, "bgm"));
      if (this.audioContext.state === "suspended") this.audioContext.resume().catch(() => {});
      this.applyVolumes();
      return true;
    } catch (error) {
      return false;
    }
  }

  connectMediaTrack(track, channel = "bgm") {
    if (!track?.audio || !this.audioContext) return false;
    const existing = this.mediaNodes.get(track.audio);
    if (existing) {
      track.gainNode = existing.gain;
      return true;
    }
    const master = channel === "sfx" ? this.sfxMasterGain : this.bgmMasterGain;
    if (!master) return false;
    try {
      const source = this.audioContext.createMediaElementSource(track.audio);
      const gain = this.audioContext.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(master);
      this.mediaNodes.set(track.audio, { source, gain, channel });
      track.gainNode = gain;
      track.audio.volume = 1;
      return true;
    } catch (error) {
      return false;
    }
  }

  setTrackFade(track, fade, targetVolume = this.getBgmOutputVolume()) {
    if (!track?.audio) return;
    const safeFade = Math.max(0, Math.min(1, Number(fade) || 0));
    track.audio.muted = this.preferences.bgmMuted === true;
    if (track.gainNode && this.bgmMasterGain) {
      track.gainNode.gain.value = safeFade;
      track.audio.volume = 1;
    } else {
      track.audio.volume = targetVolume * safeFade;
    }
  }

  playSfx(assetKey, volumeScale = 1) {
    if (!assetKey || typeof Audio === "undefined" || this.isDocumentHidden() || this.backgroundSuspended) return Promise.resolve(false);
    const source = resolveAudioAsset(assetKey);
    if (!source) return Promise.resolve(false);
    const outputVolume = this.getSfxOutputVolume();
    if (outputVolume <= 0) return Promise.resolve(false);

    const audio = new Audio(source);
    audio.preload = "auto";
    audio.setAttribute("aria-hidden", "true");
    audio.muted = this.preferences.sfxMuted === true;
    const scale = clampAudioVolume(volumeScale);
    const track = { audio, gainNode: null };
    if (this.audioContext && this.connectMediaTrack(track, "sfx")) {
      this.sfxMasterGain.gain.value = outputVolume;
      track.gainNode.gain.value = scale;
      audio.volume = 1;
    } else {
      audio.volume = outputVolume * scale;
    }

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

  createTrack(groupKey, resumeTime = 0) {
    const source = this.assetPathForGroup(groupKey);
    if (!source || typeof Audio === "undefined") return null;
    const audio = new Audio(source);
    audio.preload = "auto";
    audio.loop = true;
    audio.setAttribute("aria-hidden", "true");
    audio.volume = 0;
    const safeResumeTime = Math.max(0, Number(resumeTime) || 0);
    if (safeResumeTime > 0) {
      const seek = () => { try { audio.currentTime = safeResumeTime; } catch (error) {} };
      if (audio.readyState >= 1) seek();
      else audio.addEventListener("loadedmetadata", seek, { once: true });
    }
    return audio;
  }

  playAudio(audio) {
    if (!audio) return Promise.reject(new Error("audio_unavailable"));
    if (this.isDocumentHidden() || this.backgroundSuspended) {
      audio.pause();
      return Promise.resolve(false);
    }
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
      this.setTrackFade(from, 1 - progress, targetVolume);
      this.setTrackFade(incoming, progress, targetVolume);
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

  requestGroup(groupKey, resumeTime = 0) {
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

    const incoming = this.createTrack(groupKey, resumeTime);
    if (!incoming) return;
    if (this.pending) this.stopTrack(this.pending);
    const previousTransition = this.transition;
    if (previousTransition) this.clearTransition();
    const from = this.active;
    const track = { groupKey, audio: incoming, gainNode: null };
    this.pending = track;
    if (this.audioContext) this.connectMediaTrack(track, "bgm");
    const token = ++this.transitionToken;
    this.playAudio(incoming).then(started => {
      if (this.requestedGroup !== groupKey || token !== this.transitionToken) {
        if (this.pending === track) this.pending = null;
        this.stopTrack(track);
        return;
      }
      if (!started) {
        // Keep the blocked track pending so the next valid user gesture can start
        // the same requested BGM instance instead of waiting for a phase change.
        this.bindGestureRecovery();
        return;
      }
      if (this.pending === track) this.pending = null;
      if (!from?.audio) {
        this.active = track;
        this.applyVolumes();
        return;
      }
      this.startCrossfade(from, track);
    });
  }

  resumeRequestedPlayback() {
    const target = this.transition?.incoming || this.active || this.pending;
    if (!target || target.groupKey !== this.requestedGroup) {
      if (this.requestedGroup) this.requestGroup(this.requestedGroup);
      return;
    }
    this.playAudio(target.audio).then(started => {
      if (!started) return;
      if (this.pending === target) {
        this.pending = null;
        if (!this.active?.audio) {
          this.active = target;
          this.applyVolumes();
        } else if (this.active !== target) {
          this.startCrossfade(this.active, target);
        }
        return;
      }
      if (this.transition?.incoming === target) this.startCrossfade(this.transition.from, target);
    });
  }

  applyVolumes() {
    const targetVolume = this.getBgmOutputVolume();
    if (this.transition) {
      const elapsed = Date.now() - this.transition.startedAt;
      const progress = Math.max(0, Math.min(1, elapsed / 1400));
      if (this.bgmMasterGain) this.bgmMasterGain.gain.value = targetVolume;
      this.setTrackFade(this.transition.from, 1 - progress, targetVolume);
      this.setTrackFade(this.transition.incoming, progress, targetVolume);
      return;
    }
    if (this.bgmMasterGain) this.bgmMasterGain.gain.value = targetVolume;
    if (this.sfxMasterGain) this.sfxMasterGain.gain.value = this.getSfxOutputVolume();
    if (this.active?.audio) this.setTrackFade(this.active, 1, targetVolume);
    if (this.pending?.audio) this.setTrackFade(this.pending, 0, targetVolume);
  }

  setScreenPhase(phase) {
    // Pages without an approved group keep the current group. This is intentional for utility
    // pages opened from either Town or the Dungeon Hub and avoids an unnecessary restart.
    if (phase === "town") this.requestGroup("town_theme");
    else if (["login", "characterSelect", "menu", "map"].includes(phase)) this.requestGroup("main_theme");
  }
}

const AUDIO_MANAGER = new AudioManager();
