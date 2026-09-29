const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

/**
 * Get video metadata via ffprobe
 */
function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const proc = spawn(ffprobePath, args);
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (d) => {
      output += d.toString();
    });

    proc.stderr.on('data', (d) => {
      errorOutput += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed (${code}): ${errorOutput}`));
      }
      try {
        const data = JSON.parse(output);
        const videoStream = (data.streams || []).find(s => s.codec_type === 'video');
        const audioStream = (data.streams || []).find(s => s.codec_type === 'audio');

        const duration = parseFloat(data.format?.duration || videoStream?.duration || 0);
        const width = parseInt(videoStream?.width || 0, 10);
        const height = parseInt(videoStream?.height || 0, 10);
        const size = parseInt(data.format?.size || 0, 10);
        const formatName = data.format?.format_name || '';

        resolve({
          duration,
          width,
          height,
          size,
          hasAudio: !!audioStream,
          format: formatName,
          videoCodec: videoStream?.codec_name || 'unknown',
          audioCodec: audioStream?.codec_name || 'none'
        });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e.message}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Build atempo filter chain for audio speed from 0.25x to 4.0x
 * FFmpeg atempo only supports 0.5 to 2.0 per filter instance
 */
function buildAtempoFilters(speed) {
  const filters = [];
  let s = speed;

  while (s > 2.0) {
    filters.push('atempo=2.0');
    s /= 2.0;
  }
  while (s < 0.5) {
    filters.push('atempo=0.5');
    s /= 0.5;
  }
  // Remaining factor
  if (Math.abs(s - 1.0) > 0.001) {
    filters.push(`atempo=${s.toFixed(4)}`);
  }
  return filters;
}

/**
 * Process video with trimming, cropping, speed, and volume
 */
function processVideo({
  inputPath,
  outputPath,
  startTime = 0,
  endTime = null,
  crop = null, // { x, y, width, height }
  speed = 1.0, // 0.25 to 4.0
  volume = 1.0, // 0.0 to 4.0
  onProgress = null,
  signal = null
}) {
  return new Promise(async (resolve, reject) => {
    try {
      const meta = await probeVideo(inputPath);
      const totalDuration = meta.duration || 10;
      
      const actualStart = Math.max(0, parseFloat(startTime) || 0);
      const actualEnd = (endTime !== null && endTime !== undefined && parseFloat(endTime) > actualStart) 
        ? Math.min(parseFloat(endTime), totalDuration) 
        : totalDuration;
      
      const clipDuration = Math.max(0.1, actualEnd - actualStart);
      const expectedOutputDuration = clipDuration / speed;

      // Build video filters
      const videoFilters = [];

      // 1. Crop filter (Crop area becomes the new video ratio)
      if (crop && crop.width > 0 && crop.height > 0) {
        // Enforce even dimensions for H.264
        let w = Math.floor(crop.width / 2) * 2;
        let h = Math.floor(crop.height / 2) * 2;
        let x = Math.floor(Math.max(0, crop.x || 0));
        let y = Math.floor(Math.max(0, crop.y || 0));

        // Constrain to source boundaries
        if (meta.width > 0) {
          w = Math.min(w, meta.width);
          if (x + w > meta.width) x = Math.max(0, meta.width - w);
        }
        if (meta.height > 0) {
          h = Math.min(h, meta.height);
          if (y + h > meta.height) y = Math.max(0, meta.height - h);
        }

        videoFilters.push(`crop=${w}:${h}:${x}:${y}`);
      }

      // 2. Speed filter on video
      if (Math.abs(speed - 1.0) > 0.001) {
        const ptsFactor = (1.0 / speed).toFixed(6);
        videoFilters.push(`setpts=${ptsFactor}*PTS`);
      }

      // Build audio filters
      const audioFilters = [];
      if (meta.hasAudio) {
        // Speed filter on audio
        if (Math.abs(speed - 1.0) > 0.001) {
          const atempos = buildAtempoFilters(speed);
          audioFilters.push(...atempos);
        }

        // Volume filter
        const vol = parseFloat(volume);
        if (isNaN(vol) || vol <= 0.001) {
          audioFilters.push('volume=0');
        } else if (Math.abs(vol - 1.0) > 0.001) {
          audioFilters.push(`volume=${vol.toFixed(2)}`);
        }
      }

      // Build FFmpeg command arguments
      const args = [
        '-y',
        '-ss', actualStart.toFixed(3),
        '-to', actualEnd.toFixed(3),
        '-i', inputPath
      ];

      if (videoFilters.length > 0) {
        args.push('-vf', videoFilters.join(','));
      }

      if (meta.hasAudio) {
        if (audioFilters.length > 0) {
          args.push('-af', audioFilters.join(','));
        }
        args.push('-c:a', 'aac', '-b:a', '192k');
      } else {
        args.push('-an');
      }

      // Output video codec & container optimizations
      args.push(
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputPath
      );

      console.log('Spawning FFmpeg with args:', args.join(' '));

      const proc = spawn(ffmpegPath, args);

      if (signal) {
        signal.addEventListener('abort', () => {
          try {
            proc.kill('SIGKILL');
          } catch (_) {}
          reject(new Error('Process cancelled by user'));
        });
      }

      let errorLogs = '';

      proc.stderr.on('data', (data) => {
        const str = data.toString();
        errorLogs += str;

        // Parse progress e.g. time=00:00:05.42
        const match = str.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
        if (match && onProgress) {
          const hours = parseFloat(match[1]);
          const minutes = parseFloat(match[2]);
          const seconds = parseFloat(match[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          const percent = Math.min(99, Math.max(0, (currentTime / expectedOutputDuration) * 100));
          onProgress({
            percent: Math.round(percent),
            currentTime,
            totalTime: expectedOutputDuration
          });
        }
      });

      proc.on('close', async (code) => {
        if (code === 0) {
          if (onProgress) onProgress({ percent: 100, currentTime: expectedOutputDuration, totalTime: expectedOutputDuration });
          try {
            const outMeta = await probeVideo(outputPath);
            resolve({
              outputPath,
              metadata: outMeta,
              originalMetadata: meta
            });
          } catch (e) {
            resolve({
              outputPath,
              metadata: { duration: expectedOutputDuration },
              originalMetadata: meta
            });
          }
        } else {
          reject(new Error(`FFmpeg exited with code ${code}.\n${errorLogs.slice(-1000)}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  probeVideo,
  processVideo,
  buildAtempoFilters
};
