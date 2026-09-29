const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

function ensureSampleVideo() {
  return new Promise((resolve, reject) => {
    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const samplePath = path.join(publicDir, 'sample.mp4');
    if (fs.existsSync(samplePath) && fs.statSync(samplePath).size > 1000) {
      return resolve(samplePath);
    }

    console.log('Generating demo sample video for instant testing...');

    // Creates an 8-second 1280x720 30fps colorful video with moving test pattern and a gentle audio tone
    const args = [
      '-y',
      '-f', 'lavfi',
      '-i', 'testsrc=duration=8:size=1280x720:rate=30',
      '-f', 'lavfi',
      '-i', 'sine=frequency=523.25:duration=8', // C5 note
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-shortest',
      samplePath
    ];

    const proc = spawn(ffmpegPath, args);

    proc.stderr.on('data', (d) => {
      // ffmpeg writes progress to stderr
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('Sample video generated at:', samplePath);
        resolve(samplePath);
      } else {
        console.error('Failed to generate sample video, exit code:', code);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = { ensureSampleVideo };

if (require.main === module) {
  ensureSampleVideo().catch(console.error);
}
