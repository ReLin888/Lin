/* =========================================================
   Dear, My Love — background music
   A tiny generative music box (Web Audio), with an optional
   local audio file from SITE_CONFIG.music.audioFile.
   ========================================================= */
(function () {
  "use strict";

  const config = (window.DML_CONFIG && window.DML_CONFIG.music) || {};
  const dock = document.querySelector("[data-music]");
  const panel = document.querySelector("[data-music-panel]");
  const expand = document.querySelector("[data-music-expand]");
  const toggles = Array.from(document.querySelectorAll("[data-music-toggle]"));
  const volumeInput = document.querySelector("[data-music-volume]");
  const volumeOutput = document.querySelector("[data-music-volume-output]");
  const title = config.title || "A Little Serenade";
  const subtitle = config.subtitle || "一首不会结束的小夜曲";
  const requestedVolume = typeof config.volume === "number" ? config.volume : 0.34;

  let storedVolume = null;
  try {
    storedVolume = Number(window.localStorage.getItem("dml:music-volume"));
  } catch {
    storedVolume = null;
  }
  let volume = Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1
    ? storedVolume
    : Math.min(1, Math.max(0, requestedVolume));

  const state = {
    mode: config.audioFile ? "file" : "synth",
    playing: false,
    audio: null,
    context: null,
    master: null,
    bus: null,
    reverb: null,
    timer: 0,
    step: 0,
    nextTime: 0
  };

  document.querySelectorAll("[data-music-title]").forEach((element) => {
    element.textContent = title;
  });
  document.querySelectorAll("[data-music-subtitle]").forEach((element) => {
    element.textContent = subtitle;
  });
  document.querySelectorAll("[data-music-description]").forEach((element) => {
    element.textContent = state.mode === "file" ? "自定义音频 · 循环播放" : "原创音乐盒 · 实时生成";
  });
  if (volumeInput) {
    volumeInput.value = String(volume);
    volumeInput.style.setProperty("--volume-pct", `${Math.round(volume * 100)}%`);
  }
  if (volumeOutput) volumeOutput.textContent = `${Math.round(volume * 100)}%`;

  function makeContext() {
    if (state.context) return state.context;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    try {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = volume * 0.9;

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 20;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.02;
      compressor.release.value = 0.4;

      const bus = context.createGain();
      bus.gain.value = 1;
      const reverb = context.createConvolver();
      const length = Math.floor(context.sampleRate * 2.8);
      const impulse = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let index = 0; index < length; index += 1) {
          const decay = (1 - index / length) ** 2.8;
          data[index] = (Math.random() * 2 - 1) * decay;
        }
      }
      reverb.buffer = impulse;
      const wet = context.createGain();
      wet.gain.value = 0.24;

      bus.connect(master);
      bus.connect(reverb);
      reverb.connect(wet);
      wet.connect(master);
      master.connect(compressor);
      compressor.connect(context.destination);

      state.context = context;
      state.master = master;
      state.bus = bus;
      state.reverb = reverb;
      return context;
    } catch {
      return null;
    }
  }

  function midiToFrequency(note) {
    return 440 * 2 ** ((note - 69) / 12);
  }

  function tone(note, at, duration, level = 0.055, type = "sine") {
    const context = state.context;
    if (!context || !state.bus) return;
    const frequency = midiToFrequency(note);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    gain.connect(state.bus);

    const fundamental = context.createOscillator();
    fundamental.type = type;
    fundamental.frequency.setValueAtTime(frequency, at);
    fundamental.detune.setValueAtTime(-2, at);
    fundamental.connect(gain);
    fundamental.start(at);
    fundamental.stop(at + duration + 0.05);

    const shimmer = context.createOscillator();
    const shimmerGain = context.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(frequency * 2, at);
    shimmer.detune.setValueAtTime(4, at);
    shimmerGain.gain.value = level * 0.18;
    shimmer.connect(shimmerGain);
    shimmerGain.connect(gain);
    shimmer.start(at);
    shimmer.stop(at + Math.min(duration, 2.2) + 0.05);

    const air = context.createOscillator();
    const airGain = context.createGain();
    air.type = "triangle";
    air.frequency.setValueAtTime(frequency * 3, at);
    airGain.gain.value = level * 0.035;
    air.connect(airGain);
    airGain.connect(gain);
    air.start(at);
    air.stop(at + Math.min(duration, 1.4) + 0.05);
  }

  const progression = [
    [53, 57, 60, 64],
    [57, 60, 64, 67],
    [50, 53, 57, 60],
    [46, 50, 53, 57],
    [53, 57, 60, 64],
    [57, 60, 64, 67],
    [46, 50, 53, 57],
    [48, 52, 55, 59]
  ];
  const patterns = [
    [0, 2, 1, 3, 2, 1, 3, 2],
    [0, 1, 2, 3, 2, 3, 1, 2],
    [0, 2, 3, 1, 2, 0, 3, 1],
    [0, 1, 3, 2, 3, 1, 2, 0]
  ];
  const stepDuration = 60 / 72 / 2;

  function scheduleStep(step, at) {
    const bar = Math.floor(step / 8) % progression.length;
    const chord = progression[bar];
    const pattern = patterns[bar % patterns.length];
    const index = step % 8;
    const note = chord[pattern[index]] + 12;
    tone(note, at, stepDuration * 2.4, index === 0 ? 0.07 : 0.045, "sine");

    if (step % 8 === 0) {
      tone(chord[0] - 12, at, stepDuration * 7.2, 0.025, "triangle");
      chord.forEach((chordNote, chordIndex) => {
        tone(chordNote, at + chordIndex * 0.03, stepDuration * 7.4, 0.012, "sine");
      });
    }
    if (index === 4) {
      tone(chord[(pattern[index] + 1) % chord.length] + 24, at, stepDuration * 3.2, 0.018, "sine");
    }
    if (index === 6 && bar % 2 === 1) {
      tone(chord[pattern[index]] + 19, at, stepDuration * 2.8, 0.015, "triangle");
    }
  }

  function schedule() {
    const context = state.context;
    if (!context || !state.playing) return;
    while (state.nextTime < context.currentTime + 1.15) {
      scheduleStep(state.step, state.nextTime);
      state.nextTime += stepDuration;
      state.step += 1;
    }
  }

  function ensureFile() {
    if (state.audio || !config.audioFile) return state.audio;
    const audio = new Audio(config.audioFile);
    audio.loop = true;
    audio.preload = "metadata";
    audio.volume = volume;
    audio.addEventListener("error", () => {
      state.mode = "synth";
      state.audio = null;
      state.playing = false;
      document.querySelectorAll("[data-music-description]").forEach((element) => {
        element.textContent = "音频不可用 · 已切换内置音乐盒";
      });
      updateUI(false);
      window.DML?.toast("没有找到这首歌，先为你播放内置音乐盒。");
    });
    state.audio = audio;
    return audio;
  }

  async function startSynth() {
    if (!makeContext()) {
      window.DML?.toast("这个浏览器暂时不支持 Web Audio，背景音乐无法播放。");
      return false;
    }
    try {
      await state.context.resume();
    } catch {
      return false;
    }
    state.step = 0;
    state.nextTime = state.context.currentTime + 0.08;
    state.playing = true;
    window.clearInterval(state.timer);
    schedule();
    state.timer = window.setInterval(schedule, 240);
    updateUI(true);
    return true;
  }

  async function play() {
    if (state.mode === "file") {
      const audio = ensureFile();
      if (audio) {
        try {
          await audio.play();
          state.playing = true;
          updateUI(true);
          return true;
        } catch {
          // Fall through to the generated music box when autoplay or codec fails.
          state.mode = "synth";
          state.audio = null;
          document.querySelectorAll("[data-music-description]").forEach((element) => {
            element.textContent = "原创音乐盒 · 实时生成";
          });
        }
      }
    }
    return startSynth();
  }

  function pause() {
    state.playing = false;
    window.clearInterval(state.timer);
    if (state.mode === "file" && state.audio) state.audio.pause();
    if (state.context && state.context.state === "running") {
      state.context.suspend().catch(() => {});
    }
    updateUI(false);
  }

  function toggle() {
    if (state.playing) pause();
    else play();
  }

  function chime(stepIndex = 3) {
    if (!makeContext()) return;
    const context = state.context;
    const run = () => {
      const notes = [84, 88, 91, 96, 91, 88, 93, 96];
      const base = context.currentTime + 0.02;
      const note = notes[Math.abs(stepIndex) % notes.length];
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, base);
      gain.gain.exponentialRampToValueAtTime(0.05, base + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, base + 0.9);
      gain.connect(state.bus || state.master || context.destination);
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(midiToFrequency(note), base);
      oscillator.connect(gain);
      oscillator.start(base);
      oscillator.stop(base + 0.92);
    };
    if (context.state === "suspended") {
      context.resume().then(run).catch(() => {});
    } else {
      run();
    }
  }

  function updateUI(playing) {
    if (!dock) return;
    dock.classList.toggle("is-playing", playing);
    toggles.forEach((button) => {
      button.setAttribute("aria-pressed", String(playing));
      button.setAttribute("aria-label", playing ? "暂停背景音乐" : "播放背景音乐");
    });
    document.querySelectorAll("[data-music-state]").forEach((element) => {
      element.textContent = playing ? "Now playing" : "Play our song";
    });
  }

  function setVolume(next) {
    volume = Math.min(1, Math.max(0, next));
    if (state.master) state.master.gain.setTargetAtTime(volume * 0.9, state.context.currentTime, 0.08);
    if (state.audio) state.audio.volume = volume;
    if (volumeInput) {
      volumeInput.value = String(volume);
      volumeInput.style.setProperty("--volume-pct", `${Math.round(volume * 100)}%`);
    }
    if (volumeOutput) volumeOutput.textContent = `${Math.round(volume * 100)}%`;
    try {
      window.localStorage.setItem("dml:music-volume", String(volume));
    } catch {
      // Storage is optional.
    }
  }

  function setPanel(open) {
    if (!panel || !expand) return;
    panel.hidden = !open;
    expand.setAttribute("aria-expanded", String(open));
    if (open) panel.classList.add("is-open");
    else panel.classList.remove("is-open");
  }

  toggles.forEach((button) => {
    button.addEventListener("click", () => toggle());
  });

  if (expand) {
    expand.addEventListener("click", (event) => {
      event.stopPropagation();
      setPanel(panel ? panel.hidden : false);
    });
  }

  const closePanel = document.querySelector("[data-music-close]");
  if (closePanel) closePanel.addEventListener("click", () => setPanel(false));

  if (volumeInput) {
    volumeInput.addEventListener("input", () => setVolume(Number(volumeInput.value)));
  }

  document.addEventListener("click", (event) => {
    if (panel && !panel.hidden && dock && !dock.contains(event.target)) setPanel(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel && !panel.hidden) {
      setPanel(false);
      if (expand) expand.focus();
    }
  });

  setVolume(volume);
  updateUI(false);

  window.DML = window.DML || {};
  window.DML.audio = {
    play,
    pause,
    toggle,
    chime,
    setVolume,
    get isPlaying() {
      return state.playing;
    },
    get mode() {
      return state.mode;
    }
  };
})();
