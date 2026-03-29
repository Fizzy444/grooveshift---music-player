const { ipcRenderer } = require('electron');
const path = require('path');
const { URL } = require('url');

const audio = document.getElementById('audio');
const playlist = document.getElementById('playlist');
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const muteBtn = document.getElementById('mute-btn');
const volSlider = document.getElementById('vol-slider');
const progressWrap = document.getElementById('progress-wrap');
const progressBar = document.getElementById('progress-bar');
const timeCur = document.getElementById('time-cur');
const timeTotal = document.getElementById('time-total');
const trackTitle = document.getElementById('track-title');
const trackReason = document.getElementById('track-reason');
const artwork = document.getElementById('artwork');
const artworkRing = document.getElementById('artwork-ring');
const ambientBg = document.getElementById('ambient-bg');
const vibeFill = document.getElementById('vibe-fill');
const vibeThumb = document.getElementById('vibe-thumb');
const vibeName = document.getElementById('vibe-name');
const vibeWhy = document.getElementById('vibe-why');
const canvas = document.getElementById('visualizer');
const ctx2d = canvas.getContext('2d');

let tracks = [];
let currentIndex = -1;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let vibeValue = 0.5;
let playCounts = {};
let currentSort = 'default';

let audioCtx = null;
let analyser = null;
let dataArray = null;

let shuffleHistory = [];
let shufflePos = -1;

const VIBES = [
  { min: 0,    max: 0.15, name: 'Deep Rest',  why: 'Slow, minimal — perfect for focus or sleep' },
  { min: 0.15, max: 0.30, name: 'Chill',      why: 'Low energy, smooth and easy' },
  { min: 0.30, max: 0.45, name: 'Relaxed',    why: 'Gentle momentum, no urgency' },
  { min: 0.45, max: 0.55, name: 'Balanced',   why: 'Drag to shift the energy of what plays next' },
  { min: 0.55, max: 0.70, name: 'Upbeat',     why: 'Building energy, keep the flow going' },
  { min: 0.70, max: 0.85, name: 'Energised',  why: 'High tempo, forward momentum' },
  { min: 0.85, max: 1.01, name: 'Full Hype',  why: 'Max energy — push through anything' },
];
const fs = require('fs');
let userDataPath = '';

ipcRenderer.invoke('get-userdata-path').then(p => {
  userDataPath = p;
  loadLibrary();
});
function getVibe(v) {
  return VIBES.find(b => v >= b.min && v < b.max) || VIBES[3];
}

function fmt(s) {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function baseName(fp) {
  return path.basename(fp, path.extname(fp));
}

function toFileUrl(fp) {
  const normalized = fp.replace(/\\/g, '/');
  const encoded = normalized.split('/').map(seg => encodeURIComponent(seg)).join('/');
  if (encoded.startsWith('/')) return 'file://' + encoded;
  return 'file:///' + encoded;
}

function initAnalyser() {
  if (audioCtx) return;
  try {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    const src = audioCtx.createMediaElementSource(audio);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (e) {
    audioCtx = null; analyser = null;
  }
}

function drawViz() {
  requestAnimationFrame(drawViz);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  ctx2d.clearRect(0, 0, w, h);
  if (!analyser || !isPlaying) return;
  analyser.getByteFrequencyData(dataArray);
  const barCount = 48;
  const barW = (w / barCount) - 1.5;
  for (let i = 0; i < barCount; i++) {
    const val = dataArray[Math.floor((i / barCount) * dataArray.length)] / 255;
    const bh = Math.max(2, val * h);
    ctx2d.fillStyle = `rgba(79,142,247,${0.3 + val * 0.7})`;
    ctx2d.beginPath();
    ctx2d.roundRect(i * (barW + 1.5), h - bh, barW, bh, 2);
    ctx2d.fill();
  }
}
drawViz();

function saveLibrary() {
  if (!userDataPath) return;
  const data = JSON.stringify({ tracks, playCounts });
  fs.writeFileSync(require('path').join(userDataPath, 'library.json'), data, 'utf8');
}

function loadLibrary() {
  try {
    const file = require('path').join(userDataPath, 'library.json');
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    tracks = (data.tracks || []).filter(fp => fs.existsSync(fp));
    playCounts = data.playCounts || {};
    renderPlaylist();
  } catch (e) {}
}

function renderPlaylist() {
  if (tracks.length === 0) {
    playlist.innerHTML = `<div class="empty-state"><div class="big">♫</div><p>Add files or a folder<br>to get started</p></div>`;
    return;
  }
  let sorted = [...tracks];
  if (currentSort === 'name') sorted.sort((a, b) => baseName(a).localeCompare(baseName(b)));
  else if (currentSort === 'vibe') sorted.sort((a, b) =>
    Math.abs((playCounts[a] || 0) - vibeValue * 10) - Math.abs((playCounts[b] || 0) - vibeValue * 10)
  );

  playlist.innerHTML = sorted.map((fp, i) => {
    const active = fp === tracks[currentIndex];
    const plays = playCounts[fp] || 0;
    const name = baseName(fp).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<div class="track-item${active ? ' active' : ''}" data-idx="${tracks.indexOf(fp)}">
      <span class="track-num">${active ? '▶' : i + 1}</span>
      <div class="track-info">
        <div class="track-name">${name}</div>
        <div class="track-plays">${plays > 0 ? `played ${plays}×` : ''}</div>
      </div>
    </div>`;
  }).join('');

  playlist.querySelectorAll('.track-item').forEach(el => {
    el.addEventListener('click', () => loadTrack(parseInt(el.dataset.idx), true));
  });
}

function setPlaying(state) {
  isPlaying = state;
  playBtn.innerHTML = state
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
  artwork.classList.toggle('playing', state);
  artworkRing.classList.toggle('playing', state);
  ambientBg.classList.toggle('active', state);
}

function doPlay() {
  if (!audioCtx) initAnalyser();
  const go = () => audio.play().then(() => setPlaying(true)).catch(err => {
    console.error('play failed:', err);
    setPlaying(false);
  });
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().then(go);
  else go();
}

function loadTrack(index, autoplay = false) {
  if (index < 0 || index >= tracks.length) return;
  currentIndex = index;
  const fp = tracks[index];

  audio.pause();
  audio.src = toFileUrl(fp);
  audio.load();

  const plays = playCounts[fp] || 0;
  trackTitle.textContent = baseName(fp);
  trackReason.textContent =
    plays >= 10 ? `Because you've played this ${plays} times` :
    plays >= 3  ? `You've returned to this ${plays} times` :
    plays === 0 ? 'First listen' : '';
  document.title = baseName(fp) + ' — GrooveShift';

  renderPlaylist();

  if (autoplay) {
    if (audio.readyState >= 3) {
      doPlay();
    } else {
      audio.addEventListener('canplaythrough', doPlay, { once: true });
    }
  }
}

playBtn.addEventListener('click', () => {
  if (tracks.length === 0) return;
  if (currentIndex === -1) { loadTrack(0, true); return; }
  if (isPlaying) { audio.pause(); setPlaying(false); }
  else doPlay();
});

nextBtn.addEventListener('click', () => {
  if (!tracks.length) return;
  if (isShuffle) {
    if (shufflePos < shuffleHistory.length - 1) {
      shufflePos++;
      loadTrack(shuffleHistory[shufflePos], false);
      doPlay();
    } else {
      const order = tracks.map((_, i) => ({ i, s: Math.random() })).sort((a,b) => b.s - a.s);
      const next = order[0].i;
      shuffleHistory = shuffleHistory.slice(0, shufflePos + 1);
      shuffleHistory.push(next);
      shufflePos++;
      loadTrack(next, true);
    }
  } else {
    loadTrack((currentIndex + 1) % tracks.length, true);
  }
});

prevBtn.addEventListener('click', () => {
  if (!tracks.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (isShuffle) {
    if (shufflePos > 0) {
      shufflePos--;
      loadTrack(shuffleHistory[shufflePos], false);
      doPlay();
    }
  } else {
    loadTrack((currentIndex - 1 + tracks.length) % tracks.length, true);
  }
});

audio.addEventListener('ended', () => {
  if (isRepeat) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  const fp = tracks[currentIndex];
  if (fp) playCounts[fp] = (playCounts[fp] || 0) + 1;
  saveLibrary();
  nextBtn.click();
});

audio.addEventListener('timeupdate', () => {
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  progressBar.style.width = pct + '%';
  timeCur.textContent = fmt(audio.currentTime);
  timeTotal.textContent = fmt(audio.duration);
});

audio.addEventListener('error', () => {
  console.error('Audio error code:', audio.error && audio.error.code, '| src:', audio.src);
  setPlaying(false);
});

progressWrap.addEventListener('click', e => {
  if (!audio.duration) return;
  const rect = progressWrap.getBoundingClientRect();
  audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
});

shuffleBtn.addEventListener('click', () => { isShuffle = !isShuffle; shuffleBtn.classList.toggle('active', isShuffle); });
repeatBtn.addEventListener('click', () => { isRepeat = !isRepeat; repeatBtn.classList.toggle('active', isRepeat); });

audio.volume = 0.8;
volSlider.addEventListener('input', () => { audio.volume = parseFloat(volSlider.value); });
muteBtn.addEventListener('click', () => { audio.muted = !audio.muted; muteBtn.classList.toggle('active', audio.muted); });

document.getElementById('btn-min').addEventListener('click', () => ipcRenderer.send('window-minimize'));
document.getElementById('btn-max').addEventListener('click', () => ipcRenderer.send('window-maximize'));
document.getElementById('btn-close').addEventListener('click', () => ipcRenderer.send('window-close'));

document.getElementById('add-files-btn').addEventListener('click', async () => {
  const files = await ipcRenderer.invoke('open-files');
  if (files && files.length) { tracks.push(...files.filter(f => !tracks.includes(f))); renderPlaylist(); saveLibrary();}
});

document.getElementById('add-folder-btn').addEventListener('click', async () => {
  const files = await ipcRenderer.invoke('open-folder');
  if (files && files.length) { tracks.push(...files.filter(f => !tracks.includes(f))); renderPlaylist(); saveLibrary();}
});

document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    renderPlaylist();
  });
});

let vibeDragging = false;
vibeThumb.addEventListener('mousedown', e => { vibeDragging = true; vibeThumb.classList.add('dragging'); e.preventDefault(); });
document.addEventListener('mousemove', e => {
  if (!vibeDragging) return;
  const rect = document.getElementById('vibe-track').getBoundingClientRect();
  vibeValue = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  updateVibeDial();
});
document.addEventListener('mouseup', () => {
  if (!vibeDragging) return;
  vibeDragging = false;
  vibeThumb.classList.remove('dragging');
  if (currentSort === 'vibe') renderPlaylist();
});

function updateVibeDial() {
  vibeFill.style.width = (vibeValue * 100) + '%';
  vibeThumb.style.left = (vibeValue * 100) + '%';
  const v = getVibe(vibeValue);
  vibeName.textContent = v.name;
  vibeWhy.textContent = v.why;
}
updateVibeDial();

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playBtn.click(); }
  if (e.code === 'ArrowRight' && e.altKey) nextBtn.click();
  if (e.code === 'ArrowLeft' && e.altKey) prevBtn.click();
});
