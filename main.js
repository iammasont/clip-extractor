const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

// CHANGED: This function is now platform-aware
function getBinaryPath(baseName) {
  // Check the operating system
  const isWindows = process.platform === 'win32';
  
  // Add '.exe' if on Windows, otherwise use the base name
  const binaryName = isWindows ? `${baseName}.exe` : baseName;

  if (app.isPackaged) {
    // In a packaged app, binaries are in the 'bin' folder inside 'resources'
    return path.join(process.resourcesPath, 'bin', binaryName);
  }
  // In development, they are in the 'bin' folder relative to main.js
  return path.join(__dirname, 'bin', binaryName);
}

// UNCHANGED (but noted from before, this is also Windows-specific)
function getPythonPath() {
  // Use bundled Python if available
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'python.exe');
  }
  // In development, check if bundled Python exists
  const bundledPython = path.join(__dirname, 'resources', 'python', 'python.exe');
  if (fs.existsSync(bundledPython)) {
    return bundledPython;
  }
  // Fall back to system Python
  return 'python';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 850,  /* CHANGED: Made smaller */
    height: 850, /* CHANGED: Made smaller */
    backgroundColor: '#000000',
    resizable: true, // Keep resizable
    autoHideMenuBar: true,
    frame: false,
    minWidth: 750, /* CHANGED: Set a reasonable minimum width */
    minHeight: 850, /* CHANGED: Set a reasonable minimum height */
    aspectRatio: 800 / 750, /* ADDED: This forces proportional scaling */
    icon: path.join(__dirname, 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Window controls
ipcMain.on('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.on('close-window', () => {
  mainWindow.close();
});

ipcMain.on('open-folder', (event, folderPath) => {
  shell.openPath(folderPath);
});

// Select output folder
ipcMain.handle('select-output-folder', async (event, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: defaultPath
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Select local video file
ipcMain.handle('select-video-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Download video from URL using yt-dlp
ipcMain.handle('download-video', async (event, url) => {
  // Helper function to try downloading with specific options
  async function tryDownload(options, timeoutSeconds = 30) {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(app.getPath('temp'), `clip_extractor_${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      
      const outputTemplate = path.join(tempDir, 'video.%(ext)s');
      
      // CHANGED: Call the platform-aware function without .exe
      const ytdlpPath = getBinaryPath('yt-dlp');
      
      const args = [
        '--no-playlist',
        '--no-check-certificate',
        '--socket-timeout', '30',  // Add socket timeout
        '-o', outputTemplate
      ];
      
      // Add site-specific options
      if (options.cookies && options.browser) {
        args.push('--cookies-from-browser', options.browser);
      }
      
      if (options.referer) {
        args.push('--referer', options.referer);
      }
      
      if (options.userAgent) {
        args.push('--user-agent', options.userAgent);
      }
      
      if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          args.push('--add-header', `${key}:${value}`);
        }
      }
      
      // Add extractor args for better Vimeo authentication/extraction
      if (options.extractorArgs) {
        if (typeof options.extractorArgs === 'string') {
          args.push('--extractor-args', options.extractorArgs);
        } else {
          args.push('--extractor-args', 'vimeo:api_version=3.4');
        }
      }
      
      // Aggressive mode - try to bypass restrictions
      if (options.aggressive) {
        args.push('--geo-bypass');
        args.push('--force-ipv4');
      }
      
      // Add format selection for better quality
      if (options.format) {
        args.push('-f', options.format);
      }
      
      args.push(url);
      
      console.log(`Trying download with options:`, options);
      console.log('Full command:', ytdlpPath, args.join(' '));
      
      const ytdlp = spawn(ytdlpPath, args);
      
      let stderr = '';
      let stdout = '';
      let isResolved = false;
      
      // Set a timeout to kill the process if it hangs
      const timeout = setTimeout(() => {
        if (!isResolved) {
          console.log(`⏱ Timeout reached (${timeoutSeconds}s), killing process...`);
          ytdlp.kill('SIGTERM');
          setTimeout(() => {
            if (!ytdlp.killed) {
              ytdlp.kill('SIGKILL');
            }
          }, 3000);
          isResolved = true;
          reject({ 
            success: false, 
            stderr: `Timeout: Process took longer than ${timeoutSeconds} seconds`, 
            stdout, 
            options,
            timeout: true
          });
        }
      }, timeoutSeconds * 1000);
      
      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Parse progress
        const progressMatch = stdout.match(/(\d+\.\d+)%/);
        if (progressMatch) {
          mainWindow.webContents.send('download-progress', parseFloat(progressMatch[1]));
        }
      });
      
      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ytdlp.on('close', (code) => {
        clearTimeout(timeout);
        if (isResolved) return; // Already handled by timeout
        isResolved = true;
        
        if (code === 0) {
          // Find the downloaded file
          try {
            const files = fs.readdirSync(tempDir);
            const videoFile = files.find(f => f.startsWith('video.'));
            if (videoFile) {
              resolve({ success: true, path: path.join(tempDir, videoFile), options });
            } else {
              reject({ success: false, stderr: 'Video file not. Not found in temp directory', stdout, options });
            }
          } catch (err) {
            reject({ success: false, stderr: `Error reading temp directory: ${err.message}`, stdout, options });
          }
        } else {
          reject({ success: false, stderr, stdout, options });
        }
      });
      
      ytdlp.on('error', (err) => {
        clearTimeout(timeout);
        if (isResolved) return;
        isResolved = true;
        reject({ success: false, stderr: `Process error: ${err.message}`, stdout, options });
      });
    });
  }
  
  // Detect platform and set up download strategies
  let strategies = [];

  if (url.includes('pinterest.com') || url.includes('pin.it')) {
    // Pinterest strategies
    strategies = [
      // Pinterest with Chrome cookies and aggressive headers
      {
        name: 'Pinterest with Chrome cookies',
        cookies: true,
        browser: 'chrome',
        referer: 'https://www.pinterest.com/',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 90
      },
      // Try with Firefox
      {
        name: 'Pinterest with Firefox cookies',
        cookies: true,
        browser: 'firefox',
        referer: 'https://www.pinterest.com/',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        timeout: 90
      },
      // Try without cookies
      {
        name: 'Pinterest without cookies',
        referer: 'https://www.pinterest.com/',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 90
      }
    ];
  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    // YouTube strategies
    strategies = [
      {
        name: 'YouTube with Chrome cookies',
        cookies: true,
        browser: 'chrome',
        format: 'best[ext=mp4]/best',
        timeout: 180  // 3 minutes for YouTube downloads
      },
      {
        name: 'YouTube with Firefox cookies',
        cookies: true,
        browser: 'firefox',
        format: 'best[ext=mp4]/best',
        timeout: 180
      },
      {
        name: 'YouTube without cookies',
        format: 'best[ext=mp4]/best',
        timeout: 180
      }
    ];
  } else {
    // Default strategy for other sites
    strategies = [
      {
        name: 'Default download',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        timeout: 120
      }
    ];
  }

  // Try each strategy in order
  let lastError = null;
  let attemptNumber = 0;

  for (const strategy of strategies) {
    attemptNumber++;
    try {
      console.log(`\n========================================`);
      console.log(`Attempt ${attemptNumber}/${strategies.length}: ${strategy.name}`);
      console.log(`Timeout: ${strategy.timeout || 30}s`);
      console.log(`========================================`);

      // Update status in UI
      const statusMessage = attemptNumber === 1
        ? 'Downloading video...'
        : `Downloading video (attempt ${attemptNumber})...`;
      mainWindow.webContents.send('download-status', statusMessage);
      
      // Use custom timeout if specified, otherwise default 30s
      const result = await tryDownload(strategy, strategy.timeout || 30);
      console.log(`✓ SUCCESS with: ${strategy.name}`);
      console.log(`========================================\n`);
      return result.path;
    } catch (error) {
      console.log(`✗ FAILED with ${strategy.name}`);
      
      if (error.timeout) {
        console.log(`Reason: Timeout (took longer than ${strategy.timeout || 30} seconds)`);
      } else {
        const errorPreview = error.stderr?.substring(0, 200).replace(/\n/g, ' ');
        console.log(`Reason: ${errorPreview}`);
      }
      
      console.log(`Continuing to next method...`);
      lastError = error;
      
      // Continue to next strategy
      continue;
    }
  }
  
  // All strategies failed - build comprehensive error message
  console.log(`\n========================================`);
  console.log(`ALL METHODS FAILED (${strategies.length} attempts)`);
  console.log(`========================================\n`);
  
  // All strategies failed - build comprehensive error message
  const stderr = lastError?.stderr || '';
  let errorMsg = 'Download failed after trying all available methods.\n\n';

  if (url.includes('pinterest.com') || url.includes('pin.it')) {
    if (stderr.includes('No video formats found') || stderr.includes('Unsupported URL')) {
      errorMsg = '⚠ No video found on this Pinterest pin.\n\nThis pin may contain only images, not videos. Pinterest also has strict bot protection which can block downloads.';
    } else if (stderr.includes('HTTP Error 404')) {
      errorMsg = '⚠ Pinterest pin not found (404).\n\nCheck if the URL is correct.';
    } else if (stderr.includes('Unable to download JSON metadata') || stderr.includes('HTTP Error 403')) {
      errorMsg = '⚠ Pinterest blocked the download.\n\nPinterest has very aggressive bot protection. Try:\n1. Log into Pinterest in your browser\n2. View the pin to confirm it has a video\n3. Close all browser windows\n4. Try again\n\nNote: Some Pinterest videos may not be downloadable due to restrictions.';
    } else {
      const lines = stderr.split('\n').filter(l => l.trim() && !l.includes('WARNING'));
      errorMsg = '⚠ Pinterest download failed:\n\n' + lines.slice(-5).join('\n').substring(0, 300);
    }
  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    if (stderr.includes('Sign in to confirm') || stderr.includes('requires login')) {
      errorMsg = '⚠ YouTube requires authentication.\n\nLog into YouTube in your browser, close all windows, then try again.';
    } else if (stderr.includes('Private video')) {
      errorMsg = '⚠ This is a private YouTube video.\n\nLog into the correct YouTube account in your browser.';
    } else if (stderr.includes('HTTP Error 404')) {
      errorMsg = '⚠ Video not found (404).';
    } else {
      const lines = stderr.split('\n').filter(l => l.trim() && !l.includes('WARNING'));
      errorMsg = '⚠ YouTube download failed:\n\n' + lines.slice(-5).join('\n').substring(0, 300);
    }
  } else {
    const lines = stderr.split('\n').filter(l => l.trim() && !l.includes('WARNING'));
    errorMsg = '⚠ Download failed:\n\n' + lines.slice(-5).join('\n').substring(0, 300);
  }
  
  throw new Error(errorMsg);
});

// Helper function to extract clip with specified options
function extractClip({ inputPath, outputPath, startTime, endTime, codec = 'h24', bitrate = 25, resolution = 'native', fps = null, audioEnabled = true, playbackSpeed = 1.0 }) {
  return new Promise((resolve, reject) => {
    // CHANGED: Call the platform-aware function without .exe
    const ffmpegPath = getBinaryPath('ffmpeg');
    
    const args = ['-ss', startTime, '-i', inputPath];
    
    // Calculate duration
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const duration = end - start;
    args.push('-t', duration.toString());
    
    // Video filters array
    const videoFilters = [];
    const audioFilters = [];
    
    // Apply playback speed if not 1.0
    if (playbackSpeed !== 1.0) {
      videoFilters.push(`setpts=${1/playbackSpeed}*PTS`);
      if (audioEnabled !== false) {
        audioFilters.push(`atempo=${playbackSpeed}`);
      }
    }
    
    // Codec settings
    switch(codec) {
      case 'h264':
        args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18');
        if (bitrate) {
          args.push('-b:v', `${bitrate}M`);
        }
        if (audioEnabled !== false) {
          args.push('-c:a', 'aac', '-b:a', '192k');
        }
        break;
        
      case 'h265':
        args.push('-c:v', 'libx265', '-preset', 'fast', '-crf', '20');
        if (bitrate) {
          args.push('-b:v', `${bitrate}M`);
        }
        if (audioEnabled !== false) {
          args.push('-c:a', 'aac', '-b:a', '192k');
        }
        break;
        
      case 'prores422':
        args.push('-c:v', 'prores_ks', '-profile:v', '3');
        args.push('-pix_fmt', 'yuv422p10le');
        args.push('-vendor', 'apl0');
        if (audioEnabled !== false) {
          args.push('-c:a', 'pcm_s16le');
        }
        break;
        
      case 'prores4444':
        args.push('-c:v', 'prores_ks', '-profile:v', '4');
        args.push('-pix_fmt', 'yuva444p10le');
        args.push('-vendor', 'apl0');
        if (audioEnabled !== false) {
          args.push('-c:a', 'pcm_s16le');
        }
        break;
        
      case 'dnxhd':
        args.push('-c:v', 'dnxhd');
        // DNxHD requires specific resolution
        if (!videoFilters.some(f => f.includes('scale'))) {
          if (!resolution || resolution === 'native') {
            videoFilters.push('scale=-2:1080');
          }
        }
        args.push('-b:v', '185M');
        if (audioEnabled !== false) {
          args.push('-c:a', 'pcm_s16le');
        }
        break;
        
      case 'vp9':
        args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
        if (bitrate) {
          args.push('-b:v', `${bitrate}M`);
        }
        if (audioEnabled !== false) {
          args.push('-c:a', 'libopus', '-b:a', '192k');
        }
        break;
        
      default:
        args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18');
        if (audioEnabled !== false) {
          args.push('-c:a', 'aac', '-b:a', '192k');
        }
    }
    
    // Disable audio if requested
    if (audioEnabled === false) {
      args.push('-an');
    }
    
    // Resolution (add to video filters if not DNxHD or already handled)
    if (resolution && resolution !== 'native' && codec !== 'dnxhd') {
      const heights = { 
        '2160': 2160, 
        '1440': 1440, 
        '1080': 1080, 
        '720': 720, 
        '480': 480 
      };
      const height = heights[resolution];
      if (height) {
        videoFilters.push(`scale=-2:${height}`);
      }
    }
    
    // Apply video filters
    if (videoFilters.length > 0) {
      args.push('-vf', videoFilters.join(','));
    }
    
    // Apply audio filters (for speed changes)
    if (audioFilters.length > 0 && audioEnabled !== false) {
      args.push('-af', audioFilters.join(','));
    }
    
    // FPS
    if (fps) {
      args.push('-r', fps.toString());
    }
    
    // Frame-accurate cutting options
    args.push('-avoid_negative_ts', 'make_zero');
    args.push('-fflags', '+genpts');
    
    // Ensure MOV compatibility for ProRes/DNxHD
    if (codec === 'prores422' || codec === 'prores4444' || codec === 'dnxhd') {
      args.push('-movflags', '+faststart');
    }
    
    args.push('-y', outputPath);
    
    console.log('FFmpeg command:', ffmpegPath, args.join(' '));
    
    const ffmpeg = spawn(ffmpegPath, args, { shell: true });
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error('FFmpeg stderr:', stderr);
        reject(new Error(`FFmpeg failed: ${stderr}`));
      }
    });
  });
}

// Helper to parse HH:MM:SS to seconds
function parseTime(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// Helper function to extract frame
function extractFrame({ inputPath, outputPath, timestamp }) {
  return new Promise((resolve, reject) => {
    // CHANGED: Call the platform-aware function without .exe
    const ffmpegPath = getBinaryPath('ffmpeg');
    
    const args = [
      '-ss', timestamp,
      '-i', inputPath,
      '-frames:v', '1',
      '-q:v', '2',
      '-y',
      outputPath
    ];
    
    const ffmpeg = spawn(ffmpegPath, args, { shell: true });
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed: ${stderr}`));
      }
    });
  });
}

// Legacy handlers for backwards compatibility
ipcMain.handle('extract-clip', async (event, options) => {
  return extractClip(options);
});

ipcMain.handle('extract-frame', async (event, options) => {
  return extractFrame(options);
});

// Batch export queue
ipcMain.handle('export-queue', async (event, { videoPath, queue }) => {
  const results = {
    exported: 0,
    failed: 0,
    totalTime: 0
  };
  
  const startTime = Date.now();

  const itemText = queue.length === 1 ? 'item' : 'items';
  console.log(`Starting export of ${queue.length} ${itemText}`);
  
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    
    console.log(`Exporting item ${i + 1}/${queue.length}: ${item.filename || item.outputPath}`);
    
    mainWindow.webContents.send('export-progress', {
      current: i + 1,
      total: queue.length,
      filename: item.filename || path.basename(item.outputPath)
    });
    
    try {
      // Ensure output folder exists
      const outputFolder = item.outputFolder || path.dirname(item.outputPath);
      fs.mkdirSync(outputFolder, { recursive: true });
      
      if (item.type === 'clip') {
        console.log(`Extracting clip: ${item.outputPath}`);
        await extractClip({
          inputPath: videoPath,
          outputPath: item.outputPath,
          startTime: item.startTime,
          endTime: item.endTime,
          codec: item.codec,
          bitrate: item.bitrate,
          resolution: item.resolution,
          fps: item.fps,
          audioEnabled: item.audioEnabled,
          playbackSpeed: item.playbackSpeed
        });
        console.log(`Clip exported successfully`);
      } else if (item.type === 'frame') {
        console.log(`Extracting frame: ${item.outputPath}`);
        await extractFrame({
          inputPath: videoPath,
          outputPath: item.outputPath,
          timestamp: item.timestamp
        });
        console.log(`Frame exported successfully`);
      }
      results.exported++;
    } catch (err) {
      console.error(`Export failed for ${item.filename || item.outputPath}:`, err);
      results.failed++;
    }
  }
  
  results.totalTime = (Date.now() - startTime) / 1000;
  console.log(`Export complete. Exported: ${results.exported}, Failed: ${results.failed}`);
  return results;
});


// Get video duration
ipcMain.handle('get-video-duration', async (event, videoPath) => {
  return new Promise((resolve, reject) => {
    // CHANGED: Call the platform-aware function without .exe
    const ffprobePath = getBinaryPath('ffprobe');
    
    const ffprobe = spawn(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ], { shell: true });
    
    let stdout = '';
    
    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(parseFloat(stdout.trim()));
      } else {
        reject(new Error('Failed to get video duration'));
      }
    });
  });
});


