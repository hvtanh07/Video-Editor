import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import VideoUploader from './components/VideoUploader';
import VideoPlayer from './components/VideoPlayer';
import TrimTimeline from './components/TrimTimeline';
import CropControl from './components/CropControl';
import SpeedControl from './components/SpeedControl';
import VolumeControl from './components/VolumeControl';
import ExportPanel from './components/ExportPanel';
import ExportModal from './components/ExportModal';
import { renderVideoClientSide } from './utils/clientRender';

export default function App() {
  const [video, setVideo] = useState(null);

  // Active Editor State
  const [crop, setCrop] = useState(null); // { x, y, width, height } relative to source video
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(100);

  // Interactive Crop Adjustment State
  const [isAdjustingCrop, setIsAdjustingCrop] = useState(false);
  const [pendingCrop, setPendingCrop] = useState(null);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoopingSegment, setIsLoopingSegment] = useState(false);

  // Undo / Redo History Stack
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [currentJobId, setCurrentJobId] = useState(null);
  const [exportResult, setExportResult] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const playerRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Capture current state snapshot
  const getCurrentSnapshot = useCallback(() => {
    return {
      crop: crop ? { ...crop } : null,
      startTime,
      endTime,
      speed,
      volume
    };
  }, [crop, startTime, endTime, speed, volume]);

  // Record history step before applying a change
  const recordHistory = useCallback(() => {
    const current = getCurrentSnapshot();
    setPast((prev) => [...prev, current]);
    setFuture([]); // clear redo stack on new action
  }, [getCurrentSnapshot]);

  // Initialize video settings when video is selected
  const handleSelectVideo = (videoData) => {
    setVideo(videoData);
    const dur = videoData.metadata?.duration || 10;

    setCrop(null); // Initially uncropped (full frame)
    setStartTime(0);
    setEndTime(dur);
    setSpeed(1.0);
    setVolume(100);
    setCurrentTime(0);
    setIsPlaying(false);
    setIsLoopingSegment(false);
    setIsAdjustingCrop(false);
    setPendingCrop(null);
    setPast([]);
    setFuture([]);
  };

  // Load demo test video
  const handleLoadSample = async () => {
    try {
      const res = await fetch('/api/sample');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          handleSelectVideo({
            type: 'sample',
            filename: data.filename,
            name: data.name,
            url: data.url,
            metadata: data.metadata
          });
          return;
        }
      }
      throw new Error('Server sample endpoint not available');
    } catch (err) {
      // Static fallback for GitHub Pages
      const sampleUrl = './sample.mp4';
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = sampleUrl;
      tempVideo.onloadedmetadata = () => {
        handleSelectVideo({
          type: 'local',
          filename: 'sample.mp4',
          name: 'Demo Nature Sample',
          url: sampleUrl,
          metadata: {
            duration: tempVideo.duration || 10,
            width: tempVideo.videoWidth || 1280,
            height: tempVideo.videoHeight || 720,
            size: 1500000,
            format: 'video/mp4',
            fps: 30
          }
        });
      };
      tempVideo.onerror = () => {
        alert('Could not load sample video. Please upload your own video file.');
      };
    }
  };

  // Undo action (Ctrl+Z)
  const handleUndo = useCallback(() => {
    if (past.length === 0) return;

    const previousState = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const currentState = getCurrentSnapshot();

    setFuture((prev) => [currentState, ...prev]);
    setPast(newPast);

    // Apply previous state
    setCrop(previousState.crop ? { ...previousState.crop } : null);
    setStartTime(previousState.startTime);
    setEndTime(previousState.endTime);
    setSpeed(previousState.speed);
    setVolume(previousState.volume);

    // Close any active adjustment
    setIsAdjustingCrop(false);
    setPendingCrop(null);

    // Sync playhead
    if (playerRef.current) {
      playerRef.current.seekTo(previousState.startTime);
    }
  }, [past, getCurrentSnapshot]);

  // Redo action (Ctrl+C / Ctrl+Y / Ctrl+Shift+Z)
  const handleRedo = useCallback(() => {
    if (future.length === 0) return;

    const nextState = future[0];
    const newFuture = future.slice(1);
    const currentState = getCurrentSnapshot();

    setPast((prev) => [...prev, currentState]);
    setFuture(newFuture);

    // Apply next state
    setCrop(nextState.crop ? { ...nextState.crop } : null);
    setStartTime(nextState.startTime);
    setEndTime(nextState.endTime);
    setSpeed(nextState.speed);
    setVolume(nextState.volume);

    setIsAdjustingCrop(false);
    setPendingCrop(null);

    if (playerRef.current) {
      playerRef.current.seekTo(nextState.startTime);
    }
  }, [future, getCurrentSnapshot]);

  // Global Keyboard shortcuts: Ctrl+Z (Undo), Ctrl+C/Ctrl+Y (Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      const key = e.key.toLowerCase();

      // Undo: Ctrl + Z
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl + Y or Ctrl + Shift + Z
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Redo: Ctrl + C (per user request)
      if (key === 'c') {
        const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
        const hasSelection = (window.getSelection()?.toString() || '').length > 0;
        // If user is actively highlighting text to copy, let native copy happen
        if (!isInput || !hasSelection) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Play/pause toggle
  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // Preview cut from start
  const handlePlaySegment = () => {
    if (playerRef.current) {
      playerRef.current.playFromStart();
    } else {
      setCurrentTime(startTime);
      setIsPlaying(true);
    }
  };

  // Seek immediately
  const handleSeek = (newTime) => {
    if (newTime < startTime - 0.05 || newTime > endTime + 0.05) return;
    setCurrentTime(newTime);
    if (playerRef.current) {
      playerRef.current.seekTo(newTime);
    }
  };

  // Start cut change
  const handleChangeStart = (newStart) => {
    recordHistory();
    setStartTime(newStart);
    if (currentTime < newStart || currentTime > endTime) {
      handleSeek(newStart);
    }
  };

  // End cut change
  const handleChangeEnd = (newEnd) => {
    recordHistory();
    setEndTime(newEnd);
    if (currentTime > newEnd) {
      handleSeek(startTime);
    }
  };

  // Speed change
  const handleChangeSpeed = (newSpeed) => {
    recordHistory();
    setSpeed(newSpeed);
  };

  // Volume change
  const handleChangeVolume = (newVol) => {
    recordHistory();
    setVolume(newVol);
  };

  // --- CROP WORKFLOW ---

  // 1. User clicks "Crop Video": open interactive adjustment on player
  const handleStartCrop = () => {
    const srcW = video?.metadata?.width || 1280;
    const srcH = video?.metadata?.height || 720;

    // Start with current crop or full frame
    setPendingCrop(
      crop ? { ...crop } : { x: 0, y: 0, width: srcW, height: srcH }
    );
    setIsAdjustingCrop(true);
  };

  // 2. User clicks "Apply Crop": commit the crop, it becomes the new working video!
  const handleApplyCrop = () => {
    if (!pendingCrop) return;

    recordHistory();
    setCrop({ ...pendingCrop });
    setIsAdjustingCrop(false);
    setPendingCrop(null);
  };

  // 3. User cancels crop adjustment
  const handleCancelCrop = () => {
    setIsAdjustingCrop(false);
    setPendingCrop(null);
  };

  // 4. User resets back to full original video
  const handleResetCrop = () => {
    recordHistory();
    setCrop(null);
    setIsAdjustingCrop(false);
    setPendingCrop(null);
  };

  // --- EXPORT WORKFLOW ---
  const handleExport = async () => {
    if (!video) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Starting video export...');

    // 1. If backend server is available and video is on server, try native FFmpeg first
    if (video.type !== 'local') {
      try {
        const payload = {
          sourceType: video.type,
          filename: video.filename,
          startTime,
          endTime,
          crop: crop || null,
          speed,
          volume: volume / 100
        };

        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setCurrentJobId(data.jobId);
            setExportStatus('Processing video with FFmpeg...');

            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

            pollIntervalRef.current = setInterval(async () => {
              try {
                const pollRes = await fetch(`/api/jobs/${data.jobId}`);
                const jobData = await pollRes.json();

                if (!jobData.success) return;

                setExportProgress(jobData.percent || 0);

                if (jobData.status === 'processing') {
                  setExportStatus(`Rendering: ${jobData.percent}% completed`);
                } else if (jobData.status === 'done') {
                  clearInterval(pollIntervalRef.current);
                  setIsExporting(false);
                  setExportProgress(100);
                  setExportResult({
                    outputUrl: jobData.outputUrl,
                    downloadUrl: jobData.downloadUrl,
                    outputFilename: jobData.outputFilename,
                    metadata: jobData.result?.metadata,
                    originalMetadata: jobData.result?.originalMetadata
                  });
                  setShowExportModal(true);
                } else if (jobData.status === 'error' || jobData.status === 'cancelled') {
                  clearInterval(pollIntervalRef.current);
                  setIsExporting(false);
                  alert(`Export failed: ${jobData.error || 'Operation cancelled'}`);
                }
              } catch (err) {
                console.error('Polling error:', err);
              }
            }, 500);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend FFmpeg export unavailable, falling back to client-side renderer:', err);
      }
    }

    // 2. Client-side Fallback Renderer (for GitHub Pages static hosting or local browser mode)
    try {
      setExportStatus('Rendering video directly in browser (Canvas & MediaRecorder)...');
      const result = await renderVideoClientSide({
        videoUrl: video.url,
        sourceWidth: video.metadata?.width || 1280,
        sourceHeight: video.metadata?.height || 720,
        startTime,
        endTime,
        crop: crop || null,
        speed,
        volume: volume / 100,
        onProgress: ({ percent }) => {
          setExportProgress(percent);
          setExportStatus(`Rendering in browser: ${percent}% completed`);
        }
      });

      setIsExporting(false);
      setExportProgress(100);
      setExportResult(result);
      setShowExportModal(true);
    } catch (renderErr) {
      console.error('Client export failed:', renderErr);
      setIsExporting(false);
      alert('Export failed: ' + renderErr.message);
    }
  };

  const handleCancelExport = async () => {
    if (!currentJobId) return;
    try {
      await fetch(`/api/jobs/${currentJobId}/cancel`, { method: 'POST' });
    } catch (_) {}
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsExporting(false);
    setExportProgress(0);
    setExportStatus('');
  };

  const sourceW = video?.metadata?.width || 1280;
  const sourceH = video?.metadata?.height || 720;
  const workingW = crop ? crop.width : sourceW;
  const workingH = crop ? crop.height : sourceH;

  return (
    <div className="app-layout">
      <Header
        currentVideo={video}
        onChangeVideo={() => setVideo(null)}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <main className="main-container">
        {!video ? (
          <VideoUploader
            onSelectVideo={handleSelectVideo}
            onLoadSample={handleLoadSample}
            currentVideo={video}
          />
        ) : (
          <div className="studio-workspace">
            {/* Top Row: Video Player with Committed Cropped View */}
            <VideoPlayer
              ref={playerRef}
              videoUrl={video.url}
              metadata={video.metadata}
              startTime={startTime}
              endTime={endTime}
              committedCrop={crop}
              isAdjustingCrop={isAdjustingCrop}
              pendingCrop={pendingCrop}
              onStartCrop={handleStartCrop}
              onApplyCrop={handleApplyCrop}
              onCancelCrop={handleCancelCrop}
              onChangePendingCrop={(newPending) => setPendingCrop(newPending)}
              speed={speed}
              volume={volume}
              currentTime={currentTime}
              isPlaying={isPlaying}
              isLoopingSegment={isLoopingSegment}
              onTimeUpdate={(t) => setCurrentTime(t)}
              onLoadedMetadata={(m) => {
                if (!video.metadata) {
                  setVideo({ ...video, metadata: m });
                  setEndTime(m.duration);
                }
              }}
              onTogglePlay={handleTogglePlay}
              onSetPlaying={(val) => setIsPlaying(val)}
              onSeek={handleSeek}
            />

            {/* Middle Row: Trim / Cut Timeline */}
            <TrimTimeline
              duration={video.metadata?.duration || 10}
              currentTime={currentTime}
              startTime={startTime}
              endTime={endTime}
              isPlaying={isPlaying}
              isLoopingSegment={isLoopingSegment}
              onSeek={handleSeek}
              onChangeStart={handleChangeStart}
              onChangeEnd={handleChangeEnd}
              onTogglePlay={handleTogglePlay}
              onToggleLoopSegment={() => setIsLoopingSegment((prev) => !prev)}
              onPlaySegment={handlePlaySegment}
            />

            {/* Dedicated Crop Video Panel */}
            <CropControl
              isAdjustingCrop={isAdjustingCrop}
              onStartCrop={handleStartCrop}
              onApplyCrop={handleApplyCrop}
              onCancelCrop={handleCancelCrop}
              onResetCrop={handleResetCrop}
              isCropped={Boolean(crop)}
              pendingCrop={pendingCrop}
              onChangeCrop={(newCrop) => setPendingCrop(newCrop)}
              workingWidth={workingW}
              workingHeight={workingH}
              sourceWidth={sourceW}
              sourceHeight={sourceH}
            />

            {/* Controls Grid: Speed & Volume */}
            <div className="controls-grid">
              <SpeedControl
                speed={speed}
                onChangeSpeed={handleChangeSpeed}
                cutDuration={Math.max(0, endTime - startTime)}
              />

              <VolumeControl
                volume={volume}
                onChangeVolume={handleChangeVolume}
                hasAudio={video.metadata?.hasAudio}
              />
            </div>

            {/* Bottom Row: Export & Render Panel */}
            <ExportPanel
              onExport={handleExport}
              onCancel={handleCancelExport}
              isExporting={isExporting}
              exportProgress={exportProgress}
              exportStatus={exportStatus}
              cutDuration={Math.max(0, endTime - startTime)}
              crop={crop}
              isCropEnabled={Boolean(crop)}
              speed={speed}
              volume={volume}
              videoMetadata={video.metadata}
            />
          </div>
        )}
      </main>

      {/* Export Result Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        result={exportResult}
        originalMetadata={video?.metadata}
        settings={{
          speed,
          volume,
          startTime,
          endTime,
          crop,
          isCropEnabled: Boolean(crop)
        }}
      />
    </div>
  );
}
