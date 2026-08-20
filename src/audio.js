// ============================================================
// 音频引擎：Web Audio API 原生实现（设计文档：design/游戏音频系统设计.md）
// 架构：单 AudioContext + 三总线(SFX/Music/UI) + Master
// 抓放音参数化：weight/hardness/organic 驱动单一合成器，零资产区分 46 卡
// 背景音乐：循环播放 public/audio/background.mp3（接入 Music 总线，继承音乐音量/开关）
// ============================================================

let ctx = null;
let master = null, busSFX = null, busMusic = null, busUI = null;
let noiseBuf = null;          // 全局共享噪声 buffer
let bgm = null;               // 背景音乐 <audio> 元素
let bgmSrc = null;            // MediaElementAudioSourceNode（接入 Music 总线）
const BGM_URL = (import.meta.env.BASE_URL || "/") + "audio/background.mp3";
let mPhase = "day";           // 当前音乐昼夜状态（mp3 模式下仅作状态记录）
let mThreat = 0;              // 威胁等级 0~1
let muted = false;

// —— 卡类别声学参数（weight/hardness/organic）——
const CAT_SOUND = {
  unit:  { w: 0.35, h: 0.30, o: 1.0 },
  node:  { w: 0.85, h: 0.90, o: 0 },
  res:   { w: 0.50, h: 0.60, o: 0 },
  food:  { w: 0.20, h: 0.20, o: 0.4 },
  build: { w: 0.75, h: 0.70, o: 0 },
  item:  { w: 0.40, h: 0.80, o: 0 },
  life:  { w: 0.50, h: 0.30, o: 1.0 },
  mon:   { w: 0.60, h: 0.50, o: 0.6 }
};

// 音高随机抖动（手绘感，±5%）
function jitter(f) { return f * (1 + (Math.random() * 0.1 - 0.05)); }

// ===================== 初始化 =====================
// 必须由用户手势调用（autoplay 合规红线）
export function init() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    // 三总线 + master
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    busSFX = ctx.createGain(); busSFX.gain.value = 0.9; busSFX.connect(master);
    busMusic = ctx.createGain(); busMusic.gain.value = 0.5; busMusic.connect(master);
    busUI = ctx.createGain(); busUI.gain.value = 0.7; busUI.connect(master);
    // 背景音乐：循环 mp3，接入 Music 总线（音量/开关统一由总线控制）
    bgm = new Audio();
    bgm.src = BGM_URL;
    bgm.loop = true;
    bgm.preload = "auto";
    bgm.volume = 1;
    try { bgmSrc = ctx.createMediaElementSource(bgm); bgmSrc.connect(busMusic); } catch (e) { bgmSrc = null; }
    // 全局噪声 buffer（打击类共享）
    const len = ctx.sampleRate * 1;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (ctx.state === "suspended") ctx.resume();
    applyVol();              // 应用持久化的音量设置
    startMusic();
    return true;
  } catch (e) { return false; }
}

export function isReady() { return !!ctx; }

// ===================== 音量系统（持久化） =====================
const VOL_KEY = "niuniu_audio_v1";
// 音量状态：master 0~1；sfxOn/musicOn 布尔
let volState = { master: 0.9, sfxOn: true, musicOn: true };
try {
  const saved = JSON.parse(localStorage.getItem(VOL_KEY) || "null");
  if (saved) {
    if (typeof saved.master === "number") volState.master = Math.max(0, Math.min(1, saved.master));
    if (typeof saved.sfxOn === "boolean") volState.sfxOn = saved.sfxOn;
    if (typeof saved.musicOn === "boolean") volState.musicOn = saved.musicOn;
  }
} catch (e) { }

function saveVol() {
  try { localStorage.setItem(VOL_KEY, JSON.stringify(volState)); } catch (e) { }
}
function applyVol() {
  if (!ctx) return;
  master.gain.value = volState.master;
  busSFX.gain.value = volState.sfxOn ? 0.9 : 0;
  busMusic.gain.value = volState.musicOn ? 0.5 : 0;
  if (volState.musicOn && !muted) startMusic();
  else stopMusic();
}

// 主音量 0~1
export function setMasterVolume(v) {
  volState.master = Math.max(0, Math.min(1, v));
  saveVol(); applyVol();
}
// 音效开关
export function setSfxOn(on) {
  volState.sfxOn = !!on;
  saveVol(); applyVol();
}
// 背景音乐开关
export function setMusicOn(on) {
  volState.musicOn = !!on;
  saveVol(); applyVol();
}
// 读取当前设置（供设置面板渲染）
export function getAudioSettings() { return { ...volState }; }

// 兼容旧调用：全局静音
export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : volState.master;
  if (m) stopMusic();
  else if (volState.musicOn) startMusic();
}

// 暂停时：停音乐（SFX 不排队）
export function setPaused(p) {
  if (!ctx) return;
  if (p) stopMusic();
  else if (volState.musicOn) startMusic();
}

// ===================== 合成原语 =====================

// 打击 thunk：频率包络下落 + 低通 + 短衰减（重物/敲击）
function thunk(bus, { freq = 180, bright = 1500, vol = 0.5, decay = 0.15, wave = "triangle", pan } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator(); osc.type = wave; osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.35), t + decay);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = bright;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  osc.connect(lp); lp.connect(g); g.connect(bus);
  osc.start(t); osc.stop(t + decay + 0.02);
}

// 噪声 burst：短促噪声（点击/气流/打击主体）
function burst(bus, { vol = 0.3, decay = 0.1, filter = 2500, q = 1 } = {}) {
  if (!ctx || !noiseBuf) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = "lowpass"; bp.frequency.value = filter; bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(bp); bp.connect(g); g.connect(bus);
  src.start(t); src.stop(t + decay + 0.02);
}

// 单音（乐音：琶音/铃声）
function note(bus, freq, t, dur, vol, wave = "triangle") {
  if (!ctx) return;
  const osc = ctx.createOscillator(); osc.type = wave; osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); g.connect(bus);
  osc.start(t); osc.stop(t + dur + 0.05);
}

// 上行琶音（制作完成感，快速跳跃）
function arp(bus, baseFreq, stepSemis, vol = 0.4) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [0, 4, 7].forEach((s, i) => {
    note(bus, jitter(baseFreq * Math.pow(2, (s + stepSemis) / 12)), t0 + i * 0.055, 0.2, vol);
  });
}

// ===================== 参数化抓放 =====================
// cat: 卡类别；返回该类的声学参数（META 无覆盖时用默认表）
export function soundParams(cat) { return CAT_SOUND[cat] || { w: 0.5, h: 0.6, o: 0 }; }

// 抓起：轻物响重物轻；freq 随 weight 下降；organic 加活物颤音（轻快调：基准上移，衰减缩短）
export function grab(cat) {
  if (!ctx) return;
  const p = soundParams(cat);
  const freq = 300 - p.w * 110;
  const bright = 1600 + p.h * 3600;
  const vol = (0.9 - p.w * 0.4) * 0.55;
  const decay = 0.06 + p.w * 0.04;
  if (p.o > 0.5) {
    // 活物：微颤音双音（轻微不协和，像动物发声）
    thunk(busSFX, { freq: jitter(freq), bright, vol: vol * 0.8, decay, wave: "sine" });
    thunk(busSFX, { freq: jitter(freq * 1.07), bright, vol: vol * 0.5, decay: decay * 0.7, wave: "sine" });
  } else {
    thunk(busSFX, { freq: jitter(freq), bright, vol, decay, wave: "triangle" });
  }
}

// 放下：重物响轻物轻；衰减随 weight 增长；hardness 高加金属泛音（轻快调：基准上移，衰减缩短）
export function drop(cat, stacked) {
  if (!ctx) return;
  const p = soundParams(cat);
  const vol = (0.3 + p.w * 0.6) * 0.6;
  const decay = 0.07 + p.w * 0.12;
  burst(busSFX, { vol: vol * 0.6, decay: decay * 0.5, filter: 900 + p.h * 3000 });
  thunk(busSFX, { freq: jitter(210 - p.w * 55), bright: 1100 + p.h * 2400, vol, decay, wave: "triangle" });
  if (stacked && p.h > 0.7) {
    // 叠到金属/硬物上：短泛音
    note(busSFX, jitter(1320), ctx.currentTime, 0.06, vol * 0.3, "sine");
  }
}

// ===================== 事件分发 =====================
// 所有游戏内音效统一入口：play("事件名", opts)
export function play(name, opts) {
  if (!ctx || muted) return;
  opts = opts || {};
  try {
    const t = ctx.currentTime;
    switch (name) {
      case "ui.click":
        burst(busUI, { vol: 0.22, decay: 0.05, filter: 3200 });
        thunk(busUI, { freq: 740, vol: 0.16, decay: 0.05, wave: "sine" });
        break;
      case "ui.open":
        note(busUI, 660, t, 0.1, 0.2); note(busUI, 880, t + 0.05, 0.12, 0.18);
        break;
      case "ui.close":
        note(busUI, 880, t, 0.1, 0.18); note(busUI, 660, t + 0.05, 0.11, 0.18);
        break;
      case "ui.error":
        thunk(busUI, { freq: 260, vol: 0.25, decay: 0.16, wave: "square" });
        break;
      case "ui.task":
        arp(busUI, 659, 4, 0.35); // E 大调上行（更亮）
        break;
      case "craft.finish":
        // 按 recipe kind 微调音高：build 低 / eat 高
        arp(busSFX, 659 * Math.pow(2, (opts.step || 0) / 12), 0, 0.4);
        break;
      case "eat":
        burst(busSFX, { vol: 0.25, decay: 0.04, filter: 2600 });
        burst(busSFX, { vol: 0.2, decay: 0.05, filter: 2000 });
        break;
      case "feed":
        note(busSFX, 880, t, 0.09, 0.22); note(busSFX, 1174, t + 0.07, 0.13, 0.2);
        break;
      case "breed":
        note(busSFX, 1318, t, 0.18, 0.25); note(busSFX, 1760, t + 0.1, 0.24, 0.22);
        break;
      case "combat.hit":
        thunk(busSFX, { freq: 160, vol: 0.28, decay: 0.06, wave: "square" });
        break;
      case "combat.kill":
        thunk(busSFX, { freq: 520, vol: 0.3, decay: 0.3, wave: "sawtooth" });
        burst(busSFX, { vol: 0.2, decay: 0.22, filter: 1800 });
        break;
      case "combat.monster":
        thunk(busSFX, { freq: 130, vol: 0.32, decay: 0.4, wave: "sawtooth" });
        note(busSFX, 196, t, 0.32, 0.14, "sine");
        break;
      case "money.sell":
        note(busSFX, 988, t, 0.09, 0.22); note(busSFX, 1480, t + 0.07, 0.16, 0.2);
        break;
      case "night.start":
        thunk(busSFX, { freq: 196, vol: 0.18, decay: 0.5, wave: "sine" });
        burst(busSFX, { vol: 0.1, decay: 0.4, filter: 600 });
        break;
      case "day.start":
        note(busSFX, 1046, t, 0.1, 0.18); note(busSFX, 1318, t + 0.08, 0.14, 0.16);
        note(busSFX, 1760, t + 0.16, 0.18, 0.14);
        break;
      case "starve":
        thunk(busSFX, { freq: 330, vol: 0.24, decay: 0.4, wave: "sawtooth" });
        thunk(busSFX, { freq: 196, vol: 0.2, decay: 0.5, wave: "sawtooth" });
        break;
      case "badge":
        note(busUI, 587, t, 0.09, 0.2); note(busUI, 784, t + 0.08, 0.14, 0.18);
        break;
      case "gather.wood":
        thunk(busSFX, { freq: jitter(587), vol: 0.38, decay: 0.06, wave: "triangle" });
        thunk(busSFX, { freq: jitter(440), vol: 0.28, decay: 0.08, wave: "triangle" });
        break;
      case "gather.stone":
        burst(busSFX, { vol: 0.24, decay: 0.08, filter: 1100 });
        thunk(busSFX, { freq: 330, vol: 0.28, decay: 0.22, wave: "sine" });
        break;
      case "gather.berry":
        note(busSFX, 880, t, 0.07, 0.2); note(busSFX, 1174, t + 0.05, 0.09, 0.18);
        break;
      case "gather.ore":
        thunk(busSFX, { freq: jitter(440), vol: 0.28, decay: 0.2, wave: "triangle" });
        note(busSFX, jitter(1174), t + 0.04, 0.1, 0.18, "sine");
        break;
      default: break;
    }
  } catch (e) { /* 音频异常静默 */ }
}

// ===================== 背景音乐（循环 mp3） =====================
// 受音乐开关 / 静音 / 暂停控制，音量由 Music 总线增益统一调节
function startMusic() {
  if (!bgm || !volState.musicOn || muted) return;
  bgm.play().catch(() => {});   // 自动播放被拦截时静默忽略
}
function stopMusic() {
  if (bgm) bgm.pause();
}

// 由游戏循环驱动：昼夜 + 威胁（mp3 模式下仅记录状态，不改变曲目）
export function setMusicState(phase, threat) {
  if (phase !== mPhase || Math.abs(threat - mThreat) > 0.05) {
    mPhase = phase;
    mThreat = Math.max(0, Math.min(1, threat));
  }
}
