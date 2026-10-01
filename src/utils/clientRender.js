import { makeMp4Seekable } from './mp4Fixer';
import fixWebmDuration from 'fix-webm-duration';

/**
 * Client-side video export for GitHub Pages static hosting
 * Uses HTML5 Canvas, Web Audio API, MediaRecorder, and container seekability patchers
 */
export async function renderVideoClientSide({
  videoUrl,
  sourceWidth,
  sourceHeight,
  startTime = 0,
  endTime,
  crop = null,
  speed = 1.0,
  volume = 1.0,
  onProgress
}) {
  return new Promise(async (resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.playsInline = true;

      await new Promise((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = (e) => rej(new Error('Failed to load video for client export: ' + e.message));
        setTimeout(() => rej(new Error('Video loading timed out')), 15000);
      });

      const actualDuration = video.duration || 10;
      const actualStart = Math.max(0, startTime || 0);
      const actualEnd = (endTime && endTime > actualStart) ? Math.min(endTime, actualDuration) : actualDuration;
      const clipDuration = Math.max(0.1, actualEnd - actualStart);

      const srcW = video.videoWidth || sourceWidth || 1280;
      const srcH = video.videoHeight || sourceHeight || 720;

      // Crop dimensions
      let outW = srcW;
      let outH = srcH;
      let cropX = 0;
      let cropY = 0;

      if (crop && crop.width > 0 && crop.height > 0) {
        outW = Math.floor(crop.width / 2) * 2;
        outH = Math.floor(crop.height / 2) * 2;
        cropX = Math.floor(crop.x);
        cropY = Math.floor(crop.y);
      }

      // Offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      // Web Audio setup
      let audioStreamDestination = null;
      let audioCtx = null;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtx = new AudioContext();
          const sourceNode = audioCtx.createMediaElementSource(video);
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = Math.max(0, volume);
          audioStreamDestination = audioCtx.createMediaStreamDestination();
          sourceNode.connect(gainNode);
          gainNode.connect(audioStreamDestination);
        }
      } catch (err) {
        console.warn('Audio hook unavailable for client export, recording video only:', err);
      }

      // Capture Canvas Stream (30 fps)
      const canvasStream = canvas.captureStream ? canvas.captureStream(30) : canvas.mozCaptureStream(30);

      // Combine video + audio tracks
      const tracks = [...canvasStream.getVideoTracks()];
      if (audioStreamDestination && audioStreamDestination.stream.getAudioTracks().length > 0 && volume > 0) {
        tracks.push(...audioStreamDestination.stream.getAudioTracks());
      }

      const combinedStream = new MediaStream(tracks);

      // Determine best supported MIME type
      const possibleTypes = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm'
      ];

      let mimeType = 'video/webm';
      let extension = 'webm';
      for (const t of possibleTypes) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          if (t.includes('mp4')) extension = 'mp4';
          break;
        }
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 4000000 // 4 Mbps
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const rawBlob = new Blob(chunks, { type: mimeType });
        const outputDuration = clipDuration / (speed || 1.0);
        let finalBlob = rawBlob;

        try {
          if (extension === 'mp4' || mimeType.includes('mp4')) {
            finalBlob = await makeMp4Seekable(rawBlob, outputDuration);
          } else if (extension === 'webm' || mimeType.includes('webm')) {
            finalBlob = await new Promise((resFix) => {
              try {
                fixWebmDuration(rawBlob, Math.round(outputDuration * 1000), (fixed) => {
                  resFix(fixed);
                });
              } catch (_) {
                resFix(rawBlob);
              }
            });
          }
        } catch (patchErr) {
          console.warn('Metadata patch error (using raw blob):', patchErr);
          finalBlob = rawBlob;
        }

        const outputUrl = URL.createObjectURL(finalBlob);
        const outputFilename = `export_${Date.now()}.${extension}`;

        if (audioCtx) {
          try { audioCtx.close(); } catch (_) {}
        }

        resolve({
          outputUrl,
          downloadUrl: outputUrl,
          outputFilename,
          metadata: {
            duration: outputDuration,
            width: outW,
            height: outH,
            size: finalBlob.size,
            format: extension.toUpperCase()
          },
          originalMetadata: {
            duration: actualDuration,
            width: srcW,
            height: srcH
          }
        });
      };

      // Set speed and seek
      video.playbackRate = speed || 1.0;
      video.currentTime = actualStart;

      await new Promise((r) => {
        video.onseeked = () => r();
        setTimeout(r, 1000);
      });

      recorder.start(100);

      // Play video and draw loop
      let isRecording = true;

      const finishRecording = () => {
        if (!isRecording) return;
        isRecording = false;
        video.pause();
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      };

      const drawFrame = () => {
        if (!isRecording) return;

        if (video.currentTime >= actualEnd || video.ended) {
          finishRecording();
          return;
        }

        // Draw cropped area
        ctx.drawImage(
          video,
          cropX, cropY, outW, outH,
          0, 0, outW, outH
        );

        const currentClipTime = Math.max(0, video.currentTime - actualStart);
        const percent = Math.min(99, Math.round((currentClipTime / clipDuration) * 100));
        if (onProgress) {
          onProgress({ percent, currentTime: currentClipTime, totalTime: clipDuration });
        }

        requestAnimationFrame(drawFrame);
      };

      try {
        await video.play();
        drawFrame();
      } catch (err) {
        finishRecording();
        reject(new Error('Playback failed during client recording: ' + err.message));
      }
    } catch (err) {
      reject(err);
    }
  });
}
