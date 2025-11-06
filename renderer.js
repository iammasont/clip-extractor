let videoPath = null;
let inTime = null;
let outTime = null;
let queue = [];
let expandedIndices = new Set();
let defaultOutputFolder = null;
let isExporting = false;
let isMuted = false;
let isLoopEnabled = true; // Loop enabled by default

// Loaded assets management
let loadedVideos = [];
let currentVideoId = null;
let nextVideoId = 1;

// Render settings
let defaultCodec = 'h264';
let defaultBitrate = 25;
let defaultResolution = 'native';
let defaultFps = null;
let defaultAudioEnabled = true; 

// ADDED: History tracking
let urlHistory = [];
let historyIndex = 0;

// Timeline zoom state
let zoomLevel = 1; // 1 = full video visible
let viewStart = 0; // seconds
let viewEnd = 0; // seconds

// Interaction states
let isDraggingTimeline = false;
let isDraggingPlayhead = false;
let isDraggingOverview = false;
let isPanning = false;
let panStartX = 0;
let panStartViewStart = 0;
let panStartViewEnd = 0;
let isDraggingInMarker = false;
let isDraggingOutMarker = false;

// Elements
const urlInput = document.getElementById('url-input');
const browseBtn = document.getElementById('browse-btn');
const loadBtn = document.getElementById('load-btn');
const status = document.getElementById('status');

const videoSection = document.getElementById('video-section');
const videoPlayer = document.getElementById('video-player');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('duration');

const muteBtn = document.getElementById('mute-btn');
const unmutedIcon = document.getElementById('unmuted-icon');
const mutedIcon = document.getElementById('muted-icon');


const speedBtns = document.querySelectorAll('.speed-btn');

// Timeline elements
const timelineCanvas = document.getElementById('timeline-canvas');
const timelineOverlay = document.getElementById('timeline-overlay');
const timelineClip = document.getElementById('timeline-clip');
const inMarker = document.getElementById('in-marker');
const outMarker = document.getElementById('out-marker');
const timelinePlayhead = document.getElementById('timeline-playhead');

const zoomSlider = document.getElementById('zoom-slider');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const zoomLevelDisplay = document.getElementById('zoom-level');

const overviewBar = document.getElementById('overview-bar');
const overviewViewport = document.getElementById('overview-viewport');

// IN/OUT controls
const setInBtn = document.getElementById('set-in-btn');
const setOutBtn = document.getElementById('set-out-btn');
const loopBtn = document.getElementById('loop-btn');
// const clearInBtn = document.getElementById('clear-in-btn');
// const clearOutBtn = document.getElementById('clear-out-btn');
const addClipBtn = document.getElementById('add-clip-btn');
const addFrameBtn = document.getElementById('add-frame-btn');

// COMMENTED OUT - Display elements for IN/OUT times
// const inTimeDisplay = document.getElementById('in-time');
// const outTimeDisplay = document.getElementById('out-time');
// const clipDurationDisplay = document.getElementById('clip-duration');
// const clearInBtn = document.getElementById('clear-in-btn');
// const clearOutBtn = document.getElementById('clear-out-btn');

// Queue elements
const queueItems = document.getElementById('queue-items');
const clearQueueBtn = document.getElementById('clear-queue-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const outputDisplay = document.getElementById('output-display');
const setOutputBtn = document.getElementById('set-output-btn');
const exportBtn = document.getElementById('export-btn');

// Render settings
const defaultCodecSelect = document.getElementById('default-codec');
const defaultBitrateSlider = document.getElementById('default-bitrate');
const bitrateValue = document.getElementById('bitrate-value');
const bitrateRow = document.getElementById('bitrate-row');
const defaultResolutionSelect = document.getElementById('default-resolution');
const defaultAudioEnabledSelect = document.getElementById('default-audio-enabled');
const advancedToggleBtn = document.getElementById('advanced-toggle-btn');
const advancedSettings = document.getElementById('advanced-settings');
const defaultFpsInput = document.getElementById('default-fps');

// Progress
const progressBar = document.querySelector('.progress-bar');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const timeLabel = document.getElementById('time-label');

// Assets sidebar elements
const assetsSidebar = document.getElementById('assets-sidebar');
const assetsSidebarTab = document.getElementById('assets-sidebar-tab');
const assetsSidebarClose = document.getElementById('assets-sidebar-close');
const assetsItems = document.getElementById('assets-items');
const clearAssetsBtn = document.getElementById('clear-assets-btn');

// Download loader modal
const downloadLoaderModal = document.getElementById('download-loader-modal');
const downloadStatusText = document.getElementById('download-status-text');

// Utility functions
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseTime(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

let typewriterTimeout = null;
let currentTypewriterIndex = 0;

function updateStatus(text, color = '#00FF00') {
  // Cancel any ongoing typewriter effect
  if (typewriterTimeout) {
    clearTimeout(typewriterTimeout);
    typewriterTimeout = null;
  }
  
  status.style.color = color;
  currentTypewriterIndex = 0;
  
  // Typewriter effect
  function typeNextChar() {
    if (currentTypewriterIndex < text.length) {
      status.textContent = text.substring(0, currentTypewriterIndex + 1);
      currentTypewriterIndex++;
      typewriterTimeout = setTimeout(typeNextChar, 15); // 15ms per character
    }
  }
  
  status.textContent = '';
  typeNextChar();
}
// Window controls
document.getElementById('minimize-btn').addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

document.getElementById('close-btn').addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

// Browse for local file
browseBtn.addEventListener('click', async () => {
  const filePath = await window.electronAPI.selectVideoFile();
  if (filePath) {
    urlInput.value = filePath;
  }
});

// UPDATED: Merged Enter key with Arrow history
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loadBtn.click();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (urlHistory.length > 0) {
      historyIndex = Math.max(0, historyIndex - 1);
      urlInput.value = urlHistory[historyIndex];
      urlInput.select(); // Select text
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (urlHistory.length > 0) {
      historyIndex = Math.min(urlHistory.length, historyIndex + 1);
      if (historyIndex === urlHistory.length) {
        urlInput.value = ''; // Go to blank at the "bottom"
      } else {
        urlInput.value = urlHistory[historyIndex];
        urlInput.select(); // Select text
      }
    }
  }
});

// ADDED: Reset history index if user starts typing
urlInput.addEventListener('input', () => {
  // Don't reset if the input value is one from history
  if (urlHistory[historyIndex] && urlInput.value === urlHistory[historyIndex]) {
    return;
  }
  historyIndex = urlHistory.length;
});


// Load video
loadBtn.addEventListener('click', async () => {
  const input = urlInput.value.trim();
  if (!input) return;

  updateStatus('DOWNLOADING SOURCE.....');
  loadBtn.disabled = true;
  browseBtn.disabled = true;
  urlInput.disabled = true;

  // Show loader modal for downloads
  const isUrl = !input.match(/^[a-zA-Z]:\\/) && !input.startsWith('/');
  if (isUrl) {
    downloadLoaderModal.classList.add('visible');
    downloadStatusText.textContent = 'DOWNLOADING...';
  }

  try {
    let downloadedPath = null;

    // Check if it's a local file path or URL
    if (input.match(/^[a-zA-Z]:\\/) || input.startsWith('/')) {
      // Local file
      downloadedPath = input;
    } else {
      // URL - download it
      updateStatus('DOWNLOADING SOURCE.....');
      downloadedPath = await window.electronAPI.downloadVideo(input);
    }

    // Extract filename from path
    const pathParts = downloadedPath.replace(/\\/g, '/').split('/');
    const filename = pathParts[pathParts.length - 1];

    // Generate thumbnail
    updateStatus('GENERATING THUMBNAIL.....');
    downloadStatusText.textContent = 'GENERATING THUMBNAIL...';
    let thumbnail = null;
    try {
      thumbnail = await generateThumbnail(downloadedPath);
    } catch (err) {
      console.error('Failed to generate thumbnail:', err);
    }

    // Add to loaded videos array
    const videoId = nextVideoId++;
    const videoAsset = {
      id: videoId,
      path: downloadedPath,
      name: filename,
      thumbnail: thumbnail,
      inTime: null,
      outTime: null
    };

    loadedVideos.push(videoAsset);

    // Switch to this video
    switchToVideo(videoId);

    // Render assets list
    renderAssets();
    
    // ADDED: Add to history
    if (input && (!urlHistory.length || urlHistory[urlHistory.length - 1] !== input)) {
      urlHistory.push(input);
    }
    historyIndex = urlHistory.length; // Reset index to the "bottom"

    // Clear the input
    urlInput.value = '';

    // Flash the assets sidebar tab if it's not open
    if (!assetsSidebar.classList.contains('expanded')) {
      assetsSidebar.style.borderRight = '2px solid #00FF00';
      setTimeout(() => {
        assetsSidebar.style.borderRight = '1px solid #333333';
      }, 500);
    }

  } catch (err) {
    console.error('Load error:', err);
    updateStatus(err.message || 'LOAD FAILED', '#FF3333');
    setTimeout(() => updateStatus('READY'), 5000);
  } finally {
    // Hide loader modal
    downloadLoaderModal.classList.remove('visible');
  }

  loadBtn.disabled = false;
  browseBtn.disabled = false;
  urlInput.disabled = false;
});

// Download progress
window.electronAPI.onDownloadProgress((percent) => {
  updateStatus(`DOWNLOADING... ${percent.toFixed(1)}%`);
  downloadStatusText.textContent = `DOWNLOADING... ${percent.toFixed(1)}%`;
});

// Download status updates (for multi-method attempts)
window.electronAPI.onDownloadStatus((statusText) => {
  updateStatus(statusText);
  downloadStatusText.textContent = statusText;
});

// Generate thumbnail from video
async function generateThumbnail(videoPath) {
  return new Promise((resolve, reject) => {
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.muted = true;

    tempVideo.addEventListener('loadeddata', () => {
      // Seek to 1 second or 10% of duration, whichever is smaller
      const seekTime = Math.min(1, tempVideo.duration * 0.1);
      tempVideo.currentTime = seekTime;
    }, { once: true });

    tempVideo.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');

        // Draw the video frame
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);

        // Convert to data URL
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        resolve(thumbnail);
      } catch (err) {
        reject(err);
      } finally {
        tempVideo.src = '';
      }
    }, { once: true });

    tempVideo.addEventListener('error', (e) => {
      reject(e);
    });

    tempVideo.src = `file://${videoPath}`;
  });
}

// Switch to a different video by ID
function switchToVideo(videoId) {
  const video = loadedVideos.find(v => v.id === videoId);
  if (!video) return;

  // Save current video's in/out points
  if (currentVideoId !== null) {
    const currentVideo = loadedVideos.find(v => v.id === currentVideoId);
    if (currentVideo) {
      currentVideo.inTime = inTime;
      currentVideo.outTime = outTime;
    }
  }

  // Switch to new video
  currentVideoId = videoId;
  videoPath = video.path;
  inTime = video.inTime;
  outTime = video.outTime;

  videoPlayer.src = `file://${videoPath}`;
  videoSection.style.display = 'flex';
  videoSection.classList.remove('disabled');
  updateStatus('SOURCE DOWNLOADED.... PREVIEW LOADING....');

  videoPlayer.addEventListener('loadedmetadata', () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initializeTimeline();
        // Force the zoom slider to trigger a redraw
        zoomSlider.value = 1;
        zoomSlider.dispatchEvent(new Event('input'));
        zoomSlider.value = 0;
        zoomSlider.dispatchEvent(new Event('input'));
        updateStatus('READY');
      });
    });
  }, { once: true });

  // Update UI
  renderAssets();
}

// Render loaded assets list
function renderAssets() {
  assetsItems.innerHTML = '';

  if (loadedVideos.length === 0) {
    assetsItems.innerHTML = '<div class="assets-empty">NO ASSETS LOADED</div>';
    return;
  }

  loadedVideos.forEach((asset) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'asset-item';
    if (asset.id === currentVideoId) {
      itemDiv.classList.add('active');
    }

    // Thumbnail
    if (asset.thumbnail) {
      const thumbnail = document.createElement('img');
      thumbnail.className = 'asset-thumbnail';
      thumbnail.src = asset.thumbnail;
      thumbnail.alt = asset.name;
      itemDiv.appendChild(thumbnail);
    }

    // Asset name overlay
    const nameSpan = document.createElement('span');
    nameSpan.className = 'asset-item-name';
    nameSpan.textContent = asset.name;
    nameSpan.title = asset.path;

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'asset-remove-btn';
    removeBtn.innerHTML = '✕';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAsset(asset.id);
    });

    // Click to switch
    itemDiv.addEventListener('click', () => {
      if (asset.id !== currentVideoId) {
        switchToVideo(asset.id);
      }
    });

    itemDiv.appendChild(nameSpan);
    itemDiv.appendChild(removeBtn);
    assetsItems.appendChild(itemDiv);
  });
}

// Remove an asset
function removeAsset(videoId) {
  const index = loadedVideos.findIndex(v => v.id === videoId);
  if (index === -1) return;

  loadedVideos.splice(index, 1);

  // If we removed the current video, switch to another or clear
  if (videoId === currentVideoId) {
    if (loadedVideos.length > 0) {
      // Switch to the first available video
      switchToVideo(loadedVideos[0].id);
    } else {
      // No videos left, reset
      currentVideoId = null;
      videoPath = null;
      inTime = null;
      outTime = null;
      videoPlayer.src = '';
      videoSection.classList.add('disabled');
      updateStatus('READY');
    }
  }

  renderAssets();
}

function initializeTimeline() {
  durationDisplay.textContent = formatTime(videoPlayer.duration);
  viewStart = 0;
  viewEnd = videoPlayer.duration;
  zoomLevel = 1;
  
  // Set zoom slider
  zoomSlider.value = 0;
  
  // Force immediate redraw using requestAnimationFrame
  requestAnimationFrame(() => {
    drawTimeline();
    updateOverviewBar();
    updateZoomDisplay();
  });
  
  // Backup redraw
  setTimeout(() => {
    drawTimeline();
    updateOverviewBar();
    updateZoomDisplay();
  }, 100);
}

// Video player controls
playPauseBtn.addEventListener('click', () => {
  if (videoPlayer.paused) {
    videoPlayer.play();
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    videoPlayer.pause();
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
});

videoPlayer.addEventListener('timeupdate', () => {
  currentTimeDisplay.textContent = formatTime(videoPlayer.currentTime);
  updateTimelinePlayhead();

  // Loop between IN and OUT points if enabled
  if (isLoopEnabled && !videoPlayer.paused && inTime !== null && outTime !== null) {
    if (videoPlayer.currentTime >= outTime) {
      videoPlayer.currentTime = inTime;
    }
  }
});

videoPlayer.addEventListener('play', () => {
  playIcon.style.display = 'none';
  pauseIcon.style.display = 'block';
});

videoPlayer.addEventListener('pause', () => {
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
});

videoPlayer.addEventListener('durationchange', () => {
  console.log('Duration changed:', videoPlayer.duration);
  if (videoPlayer.duration && !isNaN(videoPlayer.duration)) {
    drawTimeline();
  }
});

muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  videoPlayer.muted = isMuted;
  
  if (isMuted) {
    unmutedIcon.style.display = 'none';
    mutedIcon.style.display = 'block';
  } else {
    unmutedIcon.style.display = 'block';
    mutedIcon.style.display = 'none';
  }
});

// Speed controls
speedBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const speed = parseFloat(btn.dataset.speed);
    videoPlayer.playbackRate = speed;
    
    speedBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Zoom slider control
zoomSlider.addEventListener('input', () => {
  if (!videoPlayer.duration) return;
  
  const sliderValue = parseInt(zoomSlider.value);
  
  if (sliderValue === 0) {
    // Full view
    zoomLevel = 1;
    viewStart = 0;
    viewEnd = videoPlayer.duration;
  } else {
    // Exponential zoom: 0-100 maps to 1x-100x zoom
    // Use exponential curve for smooth zoom feel
    zoomLevel = Math.pow(100, sliderValue / 100);
    
    // Keep current playhead position centered when zooming
    const centerTime = videoPlayer.currentTime;
    const viewRange = videoPlayer.duration / zoomLevel;
    
    viewStart = Math.max(0, centerTime - viewRange / 2);
    viewEnd = Math.min(videoPlayer.duration, centerTime + viewRange / 2);
    
    // Adjust if we hit boundaries
    if (viewStart === 0) {
      viewEnd = Math.min(videoPlayer.duration, viewRange);
    }
    if (viewEnd === videoPlayer.duration) {
      viewStart = Math.max(0, videoPlayer.duration - viewRange);
    }
  }
  
  drawTimeline();
  updateOverviewBar();
  updateZoomDisplay();
});

zoomResetBtn.addEventListener('click', () => {
  zoomLevel = 1;
  viewStart = 0;
  viewEnd = videoPlayer.duration;
  zoomSlider.value = 0;
  drawTimeline();
  updateOverviewBar();
  updateZoomDisplay();
});

function updateZoomSlider() {
  if (zoomLevel === 1) {
    zoomSlider.value = 0;
  } else {
    // Convert zoom level back to slider value (inverse of exponential)
    zoomSlider.value = Math.log(zoomLevel) / Math.log(100) * 100;
  }
}

function updateZoomDisplay() {
  if (zoomLevel === 1) {
    zoomLevelDisplay.textContent = 'FULL';
  } else {
    const viewRange = viewEnd - viewStart;
    if (viewRange < 60) {
      zoomLevelDisplay.textContent = `${viewRange.toFixed(1)}s`;
    } else {
      const mins = Math.floor(viewRange / 60);
      const secs = Math.floor(viewRange % 60);
      zoomLevelDisplay.textContent = `${mins}m ${secs}s`;
    }
  }
}

// Timeline mouse wheel zoom (with Cmd/Ctrl modifier support)
timelineOverlay.addEventListener('wheel', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!videoPlayer.duration) return;
  
  // Only zoom with mouse wheel OR with Cmd/Ctrl modifier
  // This allows normal scroll to work elsewhere but wheel always zooms on timeline
  
  const rect = timelineOverlay.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mousePercent = mouseX / rect.width;
  const mouseTime = viewStart + (viewEnd - viewStart) * mousePercent;
  
  const factor = e.deltaY < 0 ? 1.2 : 0.83;
  const currentRange = viewEnd - viewStart;
  const newRange = currentRange / factor;
  
  const minRange = 1;
  const maxRange = videoPlayer.duration;
  
  if (newRange < minRange || newRange > maxRange) return;
  
  // Zoom centered on mouse position
  viewStart = Math.max(0, mouseTime - newRange * mousePercent);
  viewEnd = Math.min(videoPlayer.duration, mouseTime + newRange * (1 - mousePercent));
  
  // Adjust if we hit boundaries
  if (viewStart === 0) {
    viewEnd = Math.min(videoPlayer.duration, newRange);
  }
  if (viewEnd === videoPlayer.duration) {
    viewStart = Math.max(0, videoPlayer.duration - newRange);
  }
  
  zoomLevel = videoPlayer.duration / (viewEnd - viewStart);
  
  drawTimeline();
  updateOverviewBar();
  updateZoomDisplay();
  updateZoomSlider();
});

// Timeline interaction
let lastScrubTime = 0;
const scrubThrottle = 16; // ~60fps

// Click and drag on playhead to scrub
timelinePlayhead.addEventListener('mousedown', (e) => {
  if (!videoPlayer.duration) return;
  e.stopPropagation();
  isDraggingPlayhead = true;
  document.body.style.cursor = 'ew-resize';
});

// Alt + drag on IN marker to adjust
inMarker.addEventListener('mousedown', (e) => {
  if (!videoPlayer.duration || !e.altKey) return;
  e.stopPropagation();
  e.preventDefault();
  isDraggingInMarker = true;
  document.body.style.cursor = 'ew-resize';
});

// Alt + drag on OUT marker to adjust
outMarker.addEventListener('mousedown', (e) => {
  if (!videoPlayer.duration || !e.altKey) return;
  e.stopPropagation();
  e.preventDefault();
  isDraggingOutMarker = true;
  document.body.style.cursor = 'ew-resize';
});

// Click timeline to jump, drag to scrub
timelineOverlay.addEventListener('mousedown', (e) => {
  if (!videoPlayer.duration) return;
  
  // Check if Space key is held for panning
  if (e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    isDraggingTimeline = true;
    scrubToPosition(e);
  } else if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
    // Middle mouse or Shift+click to pan
    isPanning = true;
    panStartX = e.clientX;
    panStartViewStart = viewStart;
    panStartViewEnd = viewEnd;
    document.body.style.cursor = 'grab';
  }
});

document.addEventListener('mousemove', (e) => {
  if (isDraggingPlayhead || isDraggingTimeline) {
    const now = Date.now();
    if (now - lastScrubTime > scrubThrottle) {
      scrubToPosition(e);
      lastScrubTime = now;
    }
  } else if (isDraggingInMarker || isDraggingOutMarker) {
    // Drag in/out markers
    const rect = timelineOverlay.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = viewStart + (viewEnd - viewStart) * percent;

    if (isDraggingInMarker) {
      inTime = Math.max(0, Math.min(videoPlayer.duration, time));
      // Don't let IN go past OUT
      if (outTime !== null && inTime > outTime) {
        inTime = outTime;
      }
    } else if (isDraggingOutMarker) {
      outTime = Math.max(0, Math.min(videoPlayer.duration, time));
      // Don't let OUT go before IN
      if (inTime !== null && outTime < inTime) {
        outTime = inTime;
      }
    }

    drawTimeline();
  } else if (isPanning) {
    const dx = e.clientX - panStartX;
    const rect = timelineOverlay.getBoundingClientRect();
    const viewRange = panStartViewEnd - panStartViewStart;
    const timeDelta = -(dx / rect.width) * viewRange;

    viewStart = Math.max(0, Math.min(videoPlayer.duration - viewRange, panStartViewStart + timeDelta));
    viewEnd = viewStart + viewRange;

    drawTimeline();
    updateOverviewBar();
    document.body.style.cursor = 'grabbing';
  }
});

document.addEventListener('mouseup', () => {
  isDraggingTimeline = false;
  isDraggingPlayhead = false;
  isDraggingOverview = false;
  isPanning = false;
  isDraggingInMarker = false;
  isDraggingOutMarker = false;
  document.body.style.cursor = '';
});

function scrubToPosition(e) {
  const rect = timelineOverlay.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const time = viewStart + (viewEnd - viewStart) * percent;
  videoPlayer.currentTime = Math.max(0, Math.min(videoPlayer.duration, time));
}

// Overview bar interaction - drag to move work area
overviewViewport.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  isDraggingOverview = true;
  const rect = overviewBar.getBoundingClientRect();
  panStartX = e.clientX - rect.left;
  panStartViewStart = viewStart;
  panStartViewEnd = viewEnd;
});

overviewBar.addEventListener('mousedown', (e) => {
  if (isDraggingOverview) return;
  
  const rect = overviewBar.getBoundingClientRect();
  const clickPercent = (e.clientX - rect.left) / rect.width;
  const clickTime = clickPercent * videoPlayer.duration;
  
  const viewRange = viewEnd - viewStart;
  const halfRange = viewRange / 2;
  
  viewStart = Math.max(0, clickTime - halfRange);
  viewEnd = Math.min(videoPlayer.duration, clickTime + halfRange);
  
  // Adjust if we hit boundaries
  if (viewStart === 0) {
    viewEnd = Math.min(videoPlayer.duration, viewRange);
  }
  if (viewEnd === videoPlayer.duration) {
    viewStart = Math.max(0, videoPlayer.duration - viewRange);
  }
  
  drawTimeline();
  updateOverviewBar();
});

document.addEventListener('mousemove', (e) => {
  if (isDraggingOverview) {
    const rect = overviewBar.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const deltaPercent = (currentX - panStartX) / rect.width;
    const deltaTime = deltaPercent * videoPlayer.duration;
    
    const viewRange = panStartViewEnd - panStartViewStart;
    
    viewStart = Math.max(0, Math.min(videoPlayer.duration - viewRange, panStartViewStart + deltaTime));
    viewEnd = viewStart + viewRange;
    
    drawTimeline();
    updateOverviewBar();
  }
});

// Draw timeline with adaptive tick marks
function drawTimeline() {
   if (!videoPlayer.duration) {
    console.log('drawTimeline called but no duration yet');
    return;
  }
  
  console.log('Drawing timeline with duration:', videoPlayer.duration, 'viewStart:', viewStart, 'viewEnd:', viewEnd);
  
  
  if (!videoPlayer.duration) return;
  
  const ctx = timelineCanvas.getContext('2d');
  const dpr = window.devicePixelRatio;
  const rect = timelineCanvas.getBoundingClientRect();
  
  // Set canvas dimensions properly
  timelineCanvas.width = rect.width * dpr;
  timelineCanvas.height = rect.height * dpr;
  
  const width = timelineCanvas.width;
  const height = timelineCanvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Scale context for DPR
  ctx.scale(dpr, dpr);
  const canvasWidth = rect.width;
  const canvasHeight = rect.height;
  
  // Calculate adaptive tick increment
  const viewRange = viewEnd - viewStart;
  const idealTickCount = 8;
  const idealIncrement = viewRange / idealTickCount;
  
  // Nice increments in seconds
  const niceIncrements = [
    0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600
  ];
  
  let tickIncrement = niceIncrements[0];
  for (const inc of niceIncrements) {
    if (inc >= idealIncrement) {
      tickIncrement = inc;
      break;
    }
  }
  
  // Minor tick increment (half of major)
  const minorTickIncrement = tickIncrement / 2;
  
  // Draw ticks and labels
  ctx.fillStyle = '#666666';
  ctx.strokeStyle = '#333333';
  ctx.font = '10px JetBrains Mono';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 1;
  
  // Start from first major tick in view
  const firstTick = Math.ceil(viewStart / tickIncrement) * tickIncrement;
  
  // Draw minor ticks
  ctx.strokeStyle = '#222222';
  for (let t = Math.ceil(viewStart / minorTickIncrement) * minorTickIncrement; t <= viewEnd; t += minorTickIncrement) {
    if (Math.abs(t % tickIncrement) > 0.001) { // Not a major tick
      const x = ((t - viewStart) / viewRange) * canvasWidth;
      ctx.beginPath();
      ctx.moveTo(x, canvasHeight - 15);
      ctx.lineTo(x, canvasHeight - 10);
      ctx.stroke();
    }
  }
  
  // Draw major ticks and labels
  ctx.strokeStyle = '#333333';
  ctx.fillStyle = '#666666';
  for (let t = firstTick; t <= viewEnd; t += tickIncrement) {
    const x = ((t - viewStart) / viewRange) * canvasWidth;
    
    // Draw tick
    ctx.beginPath();
    ctx.moveTo(x, canvasHeight - 20);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
    
    // Draw label
    ctx.fillText(formatTime(t), x, canvasHeight - 23);
  }
  
  updateTimelineMarkers();
}


function updateTimelinePlayhead() {
  if (!videoPlayer.duration) return;
  
  const percent = ((videoPlayer.currentTime - viewStart) / (viewEnd - viewStart)) * 100;
  
  if (percent >= 0 && percent <= 100) {
    timelinePlayhead.style.left = `${percent}%`;
    timelinePlayhead.style.display = 'block';
  } else {
    timelinePlayhead.style.display = 'none';
  }
}

function updateTimelineMarkers() {
  if (!videoPlayer.duration) return;
  
  const viewRange = viewEnd - viewStart;
  
  // Update IN marker
  if (inTime !== null) {
    const inPercent = ((inTime - viewStart) / viewRange) * 100;
    if (inPercent >= 0 && inPercent <= 100) {
      inMarker.style.left = `${inPercent}%`;
      inMarker.classList.add('visible');
    } else {
      inMarker.classList.remove('visible');
    }
  } else {
    inMarker.classList.remove('visible');
  }
  
  // Update OUT marker
  if (outTime !== null) {
    const outPercent = ((outTime - viewStart) / viewRange) * 100;
    if (outPercent >= 0 && outPercent <= 100) {
      outMarker.style.left = `${outPercent}%`;
      outMarker.classList.add('visible');
    } else {
      outMarker.classList.remove('visible');
    }
  } else {
    outMarker.classList.remove('visible');
  }
  
  // Update clip highlight
  if (inTime !== null && outTime !== null) {
    const inPercent = Math.max(0, ((inTime - viewStart) / viewRange) * 100);
    const outPercent = Math.min(100, ((outTime - viewStart) / viewRange) * 100);
    
    if (outPercent > 0 && inPercent < 100) {
      timelineClip.style.left = `${inPercent}%`;
      timelineClip.style.width = `${outPercent - inPercent}%`;
      timelineClip.classList.add('visible');
    } else {
      timelineClip.classList.remove('visible');
    }
  } else {
    timelineClip.classList.remove('visible');
  }
}

function updateOverviewBar() {
  if (!videoPlayer.duration) return;
  
  const startPercent = (viewStart / videoPlayer.duration) * 100;
  const endPercent = (viewEnd / videoPlayer.duration) * 100;
  
  overviewViewport.style.left = `${startPercent}%`;
  overviewViewport.style.width = `${endPercent - startPercent}%`;
}

// IN/OUT point controls
setInBtn.addEventListener('click', () => {
  inTime = videoPlayer.currentTime;
  // inTimeDisplay.textContent = formatTime(inTime);
  // clearInBtn.style.display = 'inline-block';
  // updateClipDuration();
  drawTimeline();
});

setOutBtn.addEventListener('click', () => {
  outTime = videoPlayer.currentTime;
  // outTimeDisplay.textContent = formatTime(outTime);
  // clearOutBtn.style.display = 'inline-block';
  // updateClipDuration();
  drawTimeline();
});

// Loop button control
loopBtn.addEventListener('click', () => {
  isLoopEnabled = !isLoopEnabled;
  if (isLoopEnabled) {
    loopBtn.classList.add('active');
  } else {
    loopBtn.classList.remove('active');
  }
});

// Set loop button to active by default
loopBtn.classList.add('active');

//
/*
clearInBtn.addEventListener('click', () => {
  inTime = null;
  inTimeDisplay.textContent = '--:--:--';
  clearInBtn.style.display = 'none';
  updateClipDuration();
  drawTimeline();
});

clearOutBtn.addEventListener('click', () => {
  outTime = null;
  outTimeDisplay.textContent = '--:--:--';
  clearOutBtn.style.display = 'none';
  updateClipDuration();
  drawTimeline();
});

function updateClipDuration() {
  if (inTime !== null && outTime !== null) {
    const duration = outTime - inTime;
    clipDurationDisplay.textContent = `${duration.toFixed(1)}s`;
  } else {
    clipDurationDisplay.textContent = '--';
  }
}
*/


// Add to queue
addClipBtn.addEventListener('click', () => {
  // Use IN/OUT points if set, otherwise export entire video
  const startTime = inTime !== null ? inTime : 0;
  const endTime = outTime !== null ? outTime : videoPlayer.duration;

  // Validate IN/OUT relationship if both are set
  if (inTime !== null && outTime !== null && inTime >= outTime) {
    updateStatus('OUT MUST BE AFTER IN', '#FF3333');
    setTimeout(() => updateStatus('READY'), 2000);
    return;
  }

  const duration = endTime - startTime;
  const isFullVideo = inTime === null && outTime === null;

  // Determine file extension based on CURRENT default codec setting
  let extension = 'mp4';

  if (defaultCodec === 'prores422' || defaultCodec === 'prores4444' || defaultCodec === 'dnxhd') {
    extension = 'mov';
  } else if (defaultCodec === 'vp9') {
    extension = 'webm';
  } else if (defaultCodec === 'h265' || defaultCodec === 'h264') {
    extension = 'mp4';
  }

  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const baseNumber = String(queue.length + 1).padStart(3, '0');
  const prefix = isFullVideo ? 'video' : 'clip';
  const filename = `${prefix}_${baseNumber}_${timestamp}.${extension}`;

  queue.push({
    type: 'clip',
    filename: filename,
    startTime: formatTime(startTime),
    endTime: formatTime(endTime),
    timestamp: null,
    outputPath: defaultOutputFolder || getDefaultOutputPath(),
    info: isFullVideo ? '(FULL VIDEO)' : `(${formatTime(startTime)}→${formatTime(endTime)})`,
    codec: null,
    bitrate: null,
    resolution: null,
    fps: null,
    container: null,
    audioEnabled: null
  });
  
  renderQueue();
  updateExportButton();
  
  // Show feedback
  updateStatus(`CLIP ADDED TO QUEUE (${queue.length} ITEMS)`, '#00FF00');
  setTimeout(() => updateStatus('READY'), 2000);
  
  // Flash the sidebar tab if it's not open
  if (!sidebar.classList.contains('expanded')) {
    sidebar.style.borderLeft = '2px solid #00FF00';
    setTimeout(() => {
      sidebar.style.borderLeft = '1px solid #333333';
    }, 500);
  }
});

addFrameBtn.addEventListener('click', () => {
  const timestamp = videoPlayer.currentTime;
  
  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const baseNumber = String(queue.length + 1).padStart(3, '0');
  const filename = `frame_${baseNumber}_${timeStr}.jpg`;
  
  queue.push({
    type: 'frame',
    filename: filename,
    startTime: null,
    endTime: null,
    timestamp: formatTime(timestamp),
    outputPath: defaultOutputFolder || getDefaultOutputPath(),
    info: `(${formatTime(timestamp)})`,
    codec: null,
    bitrate: null,
    resolution: null,
    fps: null,
    container: null
  });
  
  renderQueue();
  updateExportButton();
  
  // Show feedback
  updateStatus(`FRAME ADDED TO QUEUE (${queue.length} ITEMS)`, '#00FF00');
  setTimeout(() => updateStatus('READY'), 2000);
  
  // Flash the sidebar tab if it's not open
  if (!sidebar.classList.contains('expanded')) {
    sidebar.style.borderLeft = '2px solid #00FF00';
    setTimeout(() => {
      sidebar.style.borderLeft = '1px solid #333333';
    }, 500);
  }
});

function getDefaultOutputPath() {
  if (videoPath) {
    const pathParts = videoPath.replace(/\\/g, '/').split('/');
    pathParts.pop();
    pathParts.push('clips');
    return pathParts.join('/');
  }
  return 'C:/clips';
}

// Queue rendering
function renderQueue() {
  queueItems.innerHTML = '';
  
  if (queue.length === 0) {
    queueItems.innerHTML = '<div class="queue-empty">NO ITEMS IN QUEUE</div>';
    return;
  }
  
  queue.forEach((item, index) => {
    const isExpanded = expandedIndices.has(index);
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'queue-item';
    
    // Header row
    const headerDiv = document.createElement('div');
    headerDiv.className = 'queue-header-row';
    
    // Arrow
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.innerHTML = isExpanded ? `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    ` : `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      if (expandedIndices.has(index)) {
        expandedIndices.delete(index);
      } else {
        expandedIndices.add(index);
      }
      renderQueue();
    });
    
    // Filename (editable)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'queue-item-name';
    nameSpan.textContent = item.filename;
    nameSpan.contentEditable = true;
    
    nameSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      nameSpan.classList.add('editing');
      nameSpan.focus();
      
      const range = document.createRange();
      range.selectNodeContents(nameSpan);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    
    nameSpan.addEventListener('blur', () => {
      nameSpan.classList.remove('editing');
      item.filename = nameSpan.textContent.trim();
    });
    
    nameSpan.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameSpan.blur();
      } else if (e.key === 'Escape') {
        nameSpan.textContent = item.filename;
        nameSpan.blur();
      }
    });
    
    // Info
    const infoSpan = document.createElement('span');
    infoSpan.className = 'queue-item-info';
    infoSpan.textContent = item.info;
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '✕';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      queue.splice(index, 1);
      expandedIndices.delete(index);
      renderQueue();
      updateExportButton();
    });
    
    headerDiv.appendChild(arrow);
    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(infoSpan);
    headerDiv.appendChild(removeBtn);
    
    itemDiv.appendChild(headerDiv);
    
    // Details (expanded) - with render settings override
    if (isExpanded) {
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'queue-details';
      
      // Output path
      const pathRow = document.createElement('div');
      pathRow.className = 'detail-row';
      
      const pathInput = document.createElement('input');
      pathInput.type = 'text';
      pathInput.className = 'detail-input';
      pathInput.value = item.outputPath;
      pathInput.readOnly = true;
      pathInput.style.flex = '1';
      
      const browseBtn = document.createElement('button');
      browseBtn.textContent = 'BROWSE';
      browseBtn.className = 'btn-small';
      browseBtn.style.marginLeft = '8px';
      browseBtn.addEventListener('click', async () => {
        const folder = await window.electronAPI.selectOutputFolder(item.outputPath);
        if (folder) {
          item.outputPath = folder;
          renderQueue();
        }
      });
      
      pathRow.appendChild(pathInput);
      pathRow.appendChild(browseBtn);
      
      detailsDiv.appendChild(pathRow);
      
      // Render settings overrides (only for clips, not frames)
      if (item.type === 'clip') {
        // Codec override
        const codecRow = document.createElement('div');
        codecRow.className = 'detail-row';
        
        const codecLabel = document.createElement('label');
        codecLabel.textContent = 'Codec:';
        
        const codecSelect = document.createElement('select');
        codecSelect.className = 'setting-select';
        codecSelect.innerHTML = `
          <option value="">Use Default</option>
          <option value="h264">H.264</option>
          <option value="h265">H.265</option>
          <option value="prores422">ProRes 422</option>
          <option value="prores4444">ProRes 4444</option>
          <option value="dnxhd">DNxHD</option>
          <option value="vp9">VP9</option>
        `;
        codecSelect.value = item.codec || '';
        codecSelect.addEventListener('change', () => {
          const newCodec = codecSelect.value || defaultCodec;
          item.codec = codecSelect.value || null;
          
          // Update filename extension based on codec
          let newExtension = 'mp4'; // default
          
          if (newCodec === 'prores422' || newCodec === 'prores4444' || newCodec === 'dnxhd') {
            newExtension = 'mov';
          } else if (newCodec === 'vp9') {
            newExtension = 'webm';
          } else if (newCodec === 'h265' || newCodec === 'h264') {
            newExtension = 'mp4';
          }
          
          // Change the file extension
          const oldFilename = item.filename;
          const nameWithoutExt = oldFilename.substring(0, oldFilename.lastIndexOf('.'));
          item.filename = `${nameWithoutExt}.${newExtension}`;
          
          renderQueue();
        });
        
        codecRow.appendChild(codecLabel);
        codecRow.appendChild(codecSelect);
        detailsDiv.appendChild(codecRow);
        
        // Resolution override
        const resRow = document.createElement('div');
        resRow.className = 'detail-row';
        
        const resLabel = document.createElement('label');
        resLabel.textContent = 'Resolution:';
        
        const resSelect = document.createElement('select');
        resSelect.className = 'setting-select';
        resSelect.innerHTML = `
          <option value="">Use Default</option>
          <option value="native">Native</option>
          <option value="1080">1080p</option>
          <option value="720">720p</option>
          <option value="480">480p</option>
        `;
        resSelect.value = item.resolution || '';
        resSelect.addEventListener('change', () => {
          item.resolution = resSelect.value || null;
        });
        
        resRow.appendChild(resLabel);
        resRow.appendChild(resSelect);
        detailsDiv.appendChild(resRow);
      }
      
      // Reset button
      const resetBtn = document.createElement('button');
      resetBtn.textContent = 'RESET TO DEFAULT';
      resetBtn.className = 'reset-btn';
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.outputPath = defaultOutputFolder || getDefaultOutputPath();
        item.codec = null;
        item.bitrate = null;
        item.resolution = null;
        item.fps = null;
        renderQueue();
      });
      
      detailsDiv.appendChild(resetBtn);
      itemDiv.appendChild(detailsDiv);
    }
    
    queueItems.appendChild(itemDiv);
  });
}

// Clear queue
clearQueueBtn.addEventListener('click', () => {
  queue = [];
  expandedIndices.clear();
  renderQueue();
  updateExportButton();
});

// Settings modal controls
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('visible');
});

closeModalBtn.addEventListener('click', () => {
  settingsModal.classList.remove('visible');
});

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('visible');
  }
});

// Render settings controls
// Settings modal controls
settingsBtn.addEventListener('click', () => {
  // Load current values into modal when opening
  defaultCodecSelect.value = defaultCodec;
  defaultBitrateSlider.value = defaultBitrate;
  bitrateValue.textContent = `${defaultBitrate} Mbps`;
  defaultResolutionSelect.value = defaultResolution;
  defaultAudioEnabledSelect.value = defaultAudioEnabled ? 'true' : 'false';
  defaultFpsInput.value = defaultFps || '';
  
  // Show/hide bitrate row based on codec
  if (defaultCodec === 'prores422' || defaultCodec === 'prores4444' || defaultCodec === 'dnxhd') {
    bitrateRow.style.display = 'none';
  } else {
    bitrateRow.style.display = 'flex';
  }
  
  settingsModal.classList.add('visible');
  // DON'T close the sidebar - let it stay open
});

closeModalBtn.addEventListener('click', () => {
  settingsModal.classList.remove('visible');
});

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('visible');
  }
});

// Update bitrate display when slider moves (just visual feedback)
defaultBitrateSlider.addEventListener('input', () => {
  bitrateValue.textContent = `${defaultBitrateSlider.value} Mbps`;
});

// Update bitrate row visibility when codec changes in modal (just visual feedback)
defaultCodecSelect.addEventListener('change', () => {
  const codec = defaultCodecSelect.value;
  if (codec === 'prores422' || codec === 'prores4444' || codec === 'dnxhd') {
    bitrateRow.style.display = 'none';
  } else {
    bitrateRow.style.display = 'flex';
  }
});

// SAVE SETTINGS BUTTON - This is where changes actually apply
const saveSettingsBtn = document.getElementById('save-settings-btn');
saveSettingsBtn.addEventListener('click', () => {
  // Apply all settings
  defaultCodec = defaultCodecSelect.value;
  defaultBitrate = parseInt(defaultBitrateSlider.value);
  defaultResolution = defaultResolutionSelect.value;
  defaultAudioEnabled = defaultAudioEnabledSelect.value === 'true';
  const fpsValue = parseInt(defaultFpsInput.value);
  defaultFps = fpsValue > 0 ? fpsValue : null;
  
  // Update all queue items that don't have codec overrides to use new extension
  queue.forEach(item => {
    if (item.type === 'clip' && !item.codec) {
      // This item uses default codec, update its extension
      let newExtension = 'mp4';
      
      if (defaultCodec === 'prores422' || defaultCodec === 'prores4444' || defaultCodec === 'dnxhd') {
        newExtension = 'mov';
      } else if (defaultCodec === 'vp9') {
        newExtension = 'webm';
      } else if (defaultCodec === 'h265' || defaultCodec === 'h264') {
        newExtension = 'mp4';
      }
      
      // Update the filename extension
      const oldFilename = item.filename;
      const lastDotIndex = oldFilename.lastIndexOf('.');
      if (lastDotIndex > 0) {
        const nameWithoutExt = oldFilename.substring(0, lastDotIndex);
        item.filename = `${nameWithoutExt}.${newExtension}`;
      }
    }
  });
  
  // Re-render queue to show updated extensions
  renderQueue();
  
  // Close modal
  settingsModal.classList.remove('visible');
  
  // Show confirmation
  updateStatus('SETTINGS SAVED', '#00FF00');
  setTimeout(() => {
    updateStatus('READY');
  }, 1500);
});

// Advanced toggle
advancedToggleBtn.addEventListener('click', () => {
  const icon = advancedToggleBtn.querySelector('svg');
  if (advancedSettings.style.display === 'none') {
    advancedSettings.style.display = 'flex';
    advancedToggleBtn.innerHTML = icon.outerHTML + ' HIDE ADVANCED';
  } else {
    advancedSettings.style.display = 'none';
    advancedToggleBtn.innerHTML = icon.outerHTML + ' ADVANCED';
  }
});

// Set output folder
setOutputBtn.addEventListener('click', async () => {
  const folder = await window.electronAPI.selectOutputFolder();
  if (folder) {
    defaultOutputFolder = folder;
    const displayPath = folder.length > 50 ? '...' + folder.slice(-47) : folder;
    outputDisplay.textContent = displayPath;
    outputDisplay.classList.add('set');
  }
});

// Update export button
function updateExportButton() {
  if (queue.length > 0) {
    exportBtn.disabled = false;
    exportBtn.textContent = `EXPORT ALL (${queue.length})`;
  } else {
    exportBtn.disabled = true;
    exportBtn.textContent = 'EXPORT ALL (0)';
  }
}

// Export queue
exportBtn.addEventListener('click', async () => {
  if (queue.length === 0 || isExporting) return;
  
  isExporting = true;
  exportBtn.disabled = true;
  progressBar.classList.add('visible');
  updateStatus('EXPORTING...');
  
  const startTime = Date.now();
  
  // Build export options with render settings
 // Build export options with render settings
  const exportQueue = queue.map(item => {
    const outputPath = item.outputPath.replace(/\\/g, '/');
    
    // Determine the actual codec that will be used
    const actualCodec = item.codec || defaultCodec;
    
    // Determine correct extension for this codec
    let correctExtension = 'mp4';
    if (actualCodec === 'prores422' || actualCodec === 'prores4444' || actualCodec === 'dnxhd') {
      correctExtension = 'mov';
    } else if (actualCodec === 'vp9') {
      correctExtension = 'webm';
    }
    
    // Fix the filename extension if it doesn't match
    let filename = item.filename;
    const currentExtension = filename.substring(filename.lastIndexOf('.') + 1);
    if (currentExtension !== correctExtension) {
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
      filename = `${nameWithoutExt}.${correctExtension}`;
    }
    
    const fullPath = `${outputPath}/${filename}`;
    
    return {
      inputPath: videoPath,
      outputPath: fullPath,
      outputFolder: outputPath,
      type: item.type,
      startTime: item.startTime,
      endTime: item.endTime,
      timestamp: item.timestamp,
      codec: actualCodec,
      bitrate: item.bitrate || defaultBitrate,
      resolution: item.resolution || defaultResolution,
      fps: item.fps || defaultFps,
      audioEnabled: item.audioEnabled !== null ? item.audioEnabled : defaultAudioEnabled,
      playbackSpeed: item.playbackSpeed || 1
    };
  });
  
  try {
    const results = await window.electronAPI.exportQueue({
      videoPath: videoPath,
      queue: exportQueue
    });
    
    const totalTime = (Date.now() - startTime) / 1000;
    const mins = Math.floor(totalTime / 60);
    const secs = Math.floor(totalTime % 60);
    
    progressLabel.textContent = `✓ EXPORTED ${results.exported} FILES`;
    progressLabel.className = 'progress-label success';
    timeLabel.textContent = `• TOTAL_TIME: ${mins}m ${secs}s`;
    
    updateStatus('EXPORT COMPLETE');
    progressFill.style.width = '100%';
    progressFill.style.backgroundColor = '#00FF00';
    
    // Open output folder
    if (queue.length > 0) {
      window.electronAPI.openFolder(queue[0].outputPath);
    }
    
    // Clear queue after successful export
    setTimeout(() => {
      queue = [];
      expandedIndices.clear();
      renderQueue();
      updateExportButton();
      progressBar.classList.remove('visible');
      progressLabel.textContent = '';
      timeLabel.textContent = '';
      progressFill.style.width = '0%';
    }, 3000);
    
  } catch (err) {
    console.error('Export error:', err);
    progressLabel.textContent = '• EXPORT FAILED';
    progressLabel.className = 'progress-label error';
    updateStatus('EXPORT FAILED', '#FF3333');
  }
  
  isExporting = false;
});

// Export progress
window.electronAPI.onExportProgress((data) => {
  const percent = data.current / data.total;
  progressFill.style.width = `${percent * 100}%`;
  
  if (percent < 0.33) {
    progressFill.style.backgroundColor = '#FF3333';
  } else if (percent < 0.66) {
    progressFill.style.backgroundColor = '#FFA500';
  } else {
    progressFill.style.backgroundColor = '#00FF00';
  }
  
  progressLabel.textContent = `• EXPORTING [${data.current}/${data.total}] ${data.filename}`;
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Close modal with Escape
  if (e.key === 'Escape' && settingsModal.classList.contains('visible')) {
    settingsModal.classList.remove('visible');
    return;
  }
  
  // Ignore if typing in input or editing contenteditable
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.contentEditable === 'true') return;
  
  // Ignore if video isn't loaded
  if (!videoPath) return;
  
  // Check for Space key for play/pause
  if (e.code === 'Space') {
    // Only handle if not also being used for panning
    if (!isPanning) {
      e.preventDefault();
      playPauseBtn.click();
    }
  }
  
  switch(e.key.toLowerCase()) {
     case 'e':
      e.preventDefault();
      // Toggle export queue sidebar
      if (sidebar.classList.contains('expanded')) {
        sidebar.classList.remove('expanded');
      } else {
        sidebar.classList.add('expanded');
      }
      break;
    case 'a':
      e.preventDefault();
      // Toggle assets sidebar
      if (assetsSidebar.classList.contains('expanded')) {
        assetsSidebar.classList.remove('expanded');
      } else {
        assetsSidebar.classList.add('expanded');
      }
      break;
    case 'm':
      e.preventDefault();
      muteBtn.click();
      break;
    case 'i':
      e.preventDefault();
      if (e.shiftKey && inTime !== null) {
        videoPlayer.currentTime = inTime;
      } else {
        setInBtn.click();
      }
      break;
    case 'o':
      e.preventDefault();
      if (e.shiftKey && outTime !== null) {
        videoPlayer.currentTime = outTime;
      } else {
        setOutBtn.click();
      }
      break;
    case 'arrowleft':
      e.preventDefault();
      if (e.shiftKey) {
        // Shift = 5 seconds
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
      } else {
        // Regular = 1 frame at 30fps (0.033s for frame accuracy)
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 0.033);
      }
      break;
    case 'arrowright':
      e.preventDefault();
      if (e.shiftKey) {
        // Shift = 5 seconds
        videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 5);
      } else {
        // Regular = 1 frame at 30fps (0.033s for frame accuracy)
        videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 0.033);
      }
      break;
    case 'j':
      e.preventDefault();
      videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 1);
      break;
    case 'k':
      e.preventDefault();
      playPauseBtn.click();
      break;
    case 'l':
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+L toggles loop
        loopBtn.click();
      } else {
        // L alone steps forward 1 second
        videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 1);
      }
      break;
    case '=':
    case '+':
      e.preventDefault();
      zoomSlider.value = Math.min(100, parseInt(zoomSlider.value) + 10);
      zoomSlider.dispatchEvent(new Event('input'));
      break;
    case '-':
    case '_':
      e.preventDefault();
      zoomSlider.value = Math.max(0, parseInt(zoomSlider.value) - 10);
      zoomSlider.dispatchEvent(new Event('input'));
      break;
      
  }
});

      // Sidebar controls
      const sidebar = document.getElementById('sidebar');
      const sidebarTab = document.getElementById('sidebar-tab');
      const sidebarClose = document.getElementById('sidebar-close');

      sidebarTab.addEventListener('click', () => {
        sidebar.classList.add('expanded');
      });

      sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('expanded');
      });

      // Close sidebar when clicking outside (optional)
      document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('expanded') &&
            !sidebar.contains(e.target) &&
            e.target !== sidebarTab) {
          sidebar.classList.remove('expanded');
        }
      });

      // Assets Sidebar controls
      assetsSidebarTab.addEventListener('click', () => {
        assetsSidebar.classList.add('expanded');
      });

      assetsSidebarClose.addEventListener('click', () => {
        assetsSidebar.classList.remove('expanded');
      });

      // Close assets sidebar when clicking outside
      document.addEventListener('click', (e) => {
        if (assetsSidebar.classList.contains('expanded') &&
            !assetsSidebar.contains(e.target) &&
            e.target !== assetsSidebarTab) {
          assetsSidebar.classList.remove('expanded');
        }
      });

      // Clear assets button
      clearAssetsBtn.addEventListener('click', () => {
        if (confirm('Clear all loaded assets?')) {
          loadedVideos = [];
          currentVideoId = null;
          videoPath = null;
          inTime = null;
          outTime = null;
          videoPlayer.src = '';
          videoSection.classList.add('disabled');
          renderAssets();
          updateStatus('READY');
        }
      });

      // Hotkey modal controls
const hotkeyBtn = document.getElementById('hotkey-btn');
const hotkeyModal = document.getElementById('hotkey-modal');
const closeHotkeyBtn = document.getElementById('close-hotkey-btn');

hotkeyBtn.addEventListener('click', () => {
  hotkeyModal.classList.add('visible');
});

closeHotkeyBtn.addEventListener('click', () => {
  hotkeyModal.classList.remove('visible');
});

// Close modal when clicking outside
hotkeyModal.addEventListener('click', (e) => {
  if (e.target === hotkeyModal) {
    hotkeyModal.classList.remove('visible');
  }
});

// Also handle ESC key for hotkey modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && hotkeyModal.classList.contains('visible')) {
    hotkeyModal.classList.remove('visible');
    return;
  }
  
  // Add ? key to open hotkey modal
  if (e.key === '?' && !e.target.matches('input, select, [contenteditable="true"]')) {
    e.preventDefault();
    hotkeyModal.classList.add('visible');
  }
});

// Initialize
updateExportButton();

