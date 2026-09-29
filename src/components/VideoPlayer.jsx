import React, {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef
} from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Crop
} from 'lucide-react';
import CropOverlay from './CropOverlay';
import { setupVideoAudioGain } from '../utils/webAudio';
import { formatTime } from '../utils/formatTime';

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    videoUrl,
    metadata,
    startTime = 0,
    endTime = 0,
    committedCrop = null, // { x, y, width, height }
    isAdjustingCrop = false,
    pendingCrop = null,
    onStartCrop,
    onApplyCrop,
    onCancelCrop,
    onChangePendingCrop,
    speed = 1.0,
    volume = 100,
    currentTime = 0,
    isPlaying = false,
    isLoopingSegment = false,
    onTimeUpdate,
    onLoadedMetadata,
    onTogglePlay,
    onSetPlaying,
    onSeek
  },
  ref
) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sourceW = metadata?.width || 1280;
  const sourceH = metadata?.height || 720;

  // Active working dimensions
  const hasCommittedCrop =
    committedCrop &&
    committedCrop.width > 0 &&
    committedCrop.height > 0 &&
    (committedCrop.width !== sourceW ||
      committedCrop.height !== sourceH ||
      committedCrop.x !== 0 ||
      committedCrop.y !== 0);

  const workingW = hasCommittedCrop ? committedCrop.width : sourceW;
  const workingH = hasCommittedCrop ? committedCrop.height : sourceH;
  const workingRatio = (workingW / workingH).toFixed(2);

  // Sync playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed || 1.0;
    }
  }, [speed]);

  // Sync volume with Web Audio amplifier for > 100%
  useEffect(() => {
    if (!videoRef.current) return;
    const volFraction = Math.max(0, volume / 100);
    videoRef.current.volume = Math.min(1.0, volFraction);
    setupVideoAudioGain(videoRef.current, volFraction);
  }, [volume]);

  // Handle play / pause state
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying && videoRef.current.paused) {
      if (
        videoRef.current.currentTime < startTime - 0.05 ||
        videoRef.current.currentTime >= endTime - 0.05
      ) {
        videoRef.current.currentTime = startTime;
        if (onTimeUpdate) onTimeUpdate(startTime);
      }
      videoRef.current.play().catch(() => {});
    } else if (!isPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [isPlaying, startTime, endTime, onTimeUpdate]);

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    seekTo: (targetTime) => {
      if (!videoRef.current) return;
      if (targetTime < startTime - 0.001 || targetTime > endTime + 0.001) return;
      const clamped = Math.max(startTime, Math.min(endTime, targetTime));
      videoRef.current.currentTime = clamped;
      if (onTimeUpdate) onTimeUpdate(clamped);
    },
    playFromStart: () => {
      if (!videoRef.current) return;
      videoRef.current.currentTime = startTime;
      if (onTimeUpdate) onTimeUpdate(startTime);
      if (onSetPlaying) onSetPlaying(true);
      videoRef.current.play().catch(() => {});
    },
    pause: () => {
      if (videoRef.current) videoRef.current.pause();
      if (onSetPlaying) onSetPlaying(false);
    },
    getVideoElement: () => videoRef.current
  }));

  // Handle video element time update and strictly enforce cut duration
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;

    if (cur >= endTime) {
      if (isLoopingSegment) {
        videoRef.current.currentTime = startTime;
        videoRef.current.play().catch(() => {});
        if (onTimeUpdate) onTimeUpdate(startTime);
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = startTime;
        if (onTimeUpdate) onTimeUpdate(startTime);
        if (onSetPlaying) onSetPlaying(false);
      }
      return;
    }

    if (cur < startTime - 0.05) {
      videoRef.current.currentTime = startTime;
      if (onTimeUpdate) onTimeUpdate(startTime);
      return;
    }

    if (onTimeUpdate) onTimeUpdate(cur);
  };

  // Keyboard shortcut: Spacebar to play/pause
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (onTogglePlay) onTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Framing calculation: exactly fills the canvas frame with NO stretching and NO black borders
  const getFramedVideoStyle = () => {
    if (!hasCommittedCrop || isAdjustingCrop) {
      return {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block'
      };
    }

    // Scale percentages relative to the container which has aspect-ratio: workingW / workingH
    const scaleW = (sourceW / workingW) * 100;
    const scaleH = (sourceH / workingH) * 100;
    const leftPct = -(committedCrop.x / workingW) * 100;
    const topPct = -(committedCrop.y / workingH) * 100;

    return {
      position: 'absolute',
      width: `${scaleW}%`,
      height: `${scaleH}%`,
      left: `${leftPct}%`,
      top: `${topPct}%`,
      maxWidth: 'none',
      maxHeight: 'none',
      objectFit: 'fill',
      display: 'block'
    };
  };

  // On-video scrubber click handler
  const handleScrubberClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const totalDur = metadata?.duration || 10;
    const clickedTime = (clickX / rect.width) * totalDur;

    if (clickedTime < startTime || clickedTime > endTime) return;

    if (videoRef.current) {
      videoRef.current.currentTime = clickedTime;
    }
    if (onTimeUpdate) onTimeUpdate(clickedTime);
  };

  const totalDur = Math.max(0.1, metadata?.duration || 10);
  const cutStartPercent = (startTime / totalDur) * 100;
  const cutEndPercent = (endTime / totalDur) * 100;
  const playheadPercent = (Math.max(startTime, Math.min(endTime, currentTime)) / totalDur) * 100;

  // Active frame aspect ratio:
  // When adjusting: full source ratio so user can frame from the full video
  // When committed: exactly the new cropped ratio!
  const canvasAspectRatio = isAdjustingCrop
    ? `${sourceW} / ${sourceH}`
    : `${workingW} / ${workingH}`;

  return (
    <div className="player-section-card">
      {/* Player Frame Header Status */}
      <div className="player-meta-bar">
        <div className="meta-left">
          <span className="live-indicator-pill">
            <span className="pulse-dot" /> LIVE PREVIEW
          </span>
          <span className="meta-resolution">
            Source: <strong>{sourceW}×{sourceH}</strong>
          </span>
          <span className="meta-divider">➔</span>
          <span className="meta-resolution highlight">
            Active Video: <strong>{workingW}×{workingH} ({workingRatio}:1)</strong>
          </span>
        </div>

        <div className="meta-right">
          {/* Crop Action in Player Header */}
          <button
            type="button"
            className={`crop-toggle-header-btn ${isAdjustingCrop ? 'active' : ''}`}
            onClick={isAdjustingCrop ? onCancelCrop : onStartCrop}
            title={isAdjustingCrop ? 'Cancel crop adjustment' : 'Crop the video'}
          >
            <Crop size={14} />
            <span>{isAdjustingCrop ? 'Adjusting Crop...' : 'Crop Video'}</span>
          </button>

          <span className="time-display">
            {formatTime(currentTime)} / {formatTime(metadata?.duration || 0)}
          </span>

          <button
            type="button"
            className="icon-btn"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            <Maximize size={15} />
          </button>
        </div>
      </div>

      {/* Outer Studio Stage - Full Width Dark Background */}
      <div className="video-stage-wrapper">
        {/* Inner Canvas Frame - Defined by the new video aspect ratio with ZERO black borders */}
        <div
          ref={containerRef}
          className="video-canvas-frame"
          style={{
            aspectRatio: canvasAspectRatio
          }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            className="main-video-element"
            style={getFramedVideoStyle()}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={(e) => {
              if (onLoadedMetadata) {
                onLoadedMetadata({
                  duration: e.target.duration,
                  width: e.target.videoWidth,
                  height: e.target.videoHeight
                });
              }
            }}
            onClick={onTogglePlay}
          />

          {/* Interactive Crop Adjustment Overlay ONLY when user is actively cropping */}
          {isAdjustingCrop && pendingCrop && (
            <CropOverlay
              containerRef={containerRef}
              videoRef={videoRef}
              videoWidth={sourceW}
              videoHeight={sourceH}
              crop={pendingCrop}
              onChangeCrop={onChangePendingCrop}
              onApplyCrop={onApplyCrop}
              onCancelCrop={onCancelCrop}
            />
          )}

          {/* Center Big Play/Pause Splash Overlay */}
          {!isPlaying && !isAdjustingCrop && (
            <button
              type="button"
              className="center-play-button"
              onClick={onTogglePlay}
              title="Click or press Space to Play"
            >
              <Play size={32} />
            </button>
          )}
        </div>
      </div>

      {/* On-Video Interactive Progress Scrubber */}
      <div
        className="on-video-scrubber-track"
        onClick={handleScrubberClick}
        title="Tap within the active cut segment to jump to that moment"
      >
        <div
          className="scrubber-outside-zone left"
          style={{ width: `${cutStartPercent}%` }}
        />
        <div
          className="scrubber-active-cut-zone"
          style={{
            left: `${cutStartPercent}%`,
            width: `${Math.max(0, cutEndPercent - cutStartPercent)}%`
          }}
        />
        <div
          className="scrubber-outside-zone right"
          style={{ left: `${cutEndPercent}%`, width: `${100 - cutEndPercent}%` }}
        />
        <div
          className="scrubber-playhead-marker"
          style={{ left: `${playheadPercent}%` }}
        />
      </div>

      {/* Quick Player Bar */}
      <div className="player-quick-bar">
        <div className="quick-playback-controls">
          <button
            type="button"
            className="play-pause-btn"
            onClick={onTogglePlay}
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            className="quick-icon-btn"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = startTime;
                if (onTimeUpdate) onTimeUpdate(startTime);
              }
            }}
            title="Seek to Start of cut"
          >
            <RotateCcw size={15} /> Jump to Cut Start
          </button>

          <button
            type="button"
            className={`quick-crop-action-btn ${isAdjustingCrop ? 'active' : ''}`}
            onClick={isAdjustingCrop ? onCancelCrop : onStartCrop}
            title="Crop the video"
          >
            <Crop size={15} />
            <span>{isAdjustingCrop ? 'Cancel Crop' : 'Crop Video'}</span>
          </button>
        </div>

        <div className="quick-preview-badge">
          {hasCommittedCrop ? (
            <span className="badge-preview-mode cropped">
              ✂ New Video Ratio: {workingW}×{workingH} ({workingRatio}:1)
            </span>
          ) : (
            <span className="badge-preview-mode standard">
              Full {sourceW}×{sourceH} original video
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
