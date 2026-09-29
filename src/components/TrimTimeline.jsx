import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Scissors, FastForward, Rewind, Repeat } from 'lucide-react';
import { formatTime } from '../utils/formatTime';

export default function TrimTimeline({
  duration,
  currentTime,
  startTime,
  endTime,
  isPlaying,
  isLoopingSegment,
  onSeek,
  onChangeStart,
  onChangeEnd,
  onTogglePlay,
  onToggleLoopSegment,
  onPlaySegment
}) {
  const barRef = useRef(null);
  const [activeDrag, setActiveDrag] = useState(null); // 'start' | 'end' | 'playhead'

  const safeDuration = Math.max(0.1, duration || 1);
  const startPercent = Math.min(100, Math.max(0, (startTime / safeDuration) * 100));
  const endPercent = Math.min(100, Math.max(0, (endTime / safeDuration) * 100));
  // Keep playhead visual position clamped between start and end
  const clampedCurrentTime = Math.max(startTime, Math.min(endTime, currentTime));
  const playheadPercent = Math.min(100, Math.max(0, (clampedCurrentTime / safeDuration) * 100));
  const cutDuration = Math.max(0, endTime - startTime);

  const getEventTime = (e) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percent = clickX / rect.width;
    return percent * safeDuration;
  };

  const handlePointerDown = (e, dragType) => {
    e.stopPropagation();
    e.preventDefault();

    if (dragType === 'playhead') {
      const t = getEventTime(e);
      // Requirement 4: Jump except for part outside the cut part
      if (t < startTime - 0.05 || t > endTime + 0.05) {
        return; // Ignore clicks outside the cut range
      }
      setActiveDrag(dragType);
      onSeek(t);
    } else {
      setActiveDrag(dragType);
    }
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!activeDrag) return;
      const t = getEventTime(e);

      if (activeDrag === 'start') {
        const newStart = Math.max(0, Math.min(endTime - 0.1, t));
        onChangeStart(newStart);
      } else if (activeDrag === 'end') {
        const newEnd = Math.max(startTime + 0.1, Math.min(safeDuration, t));
        onChangeEnd(newEnd);
      } else if (activeDrag === 'playhead') {
        // Clamp dragging within cut range
        const clampedT = Math.max(startTime, Math.min(endTime, t));
        onSeek(clampedT);
      }
    };

    const handlePointerUp = () => {
      if (activeDrag) {
        setActiveDrag(null);
      }
    };

    if (activeDrag) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, startTime, endTime, safeDuration, onChangeStart, onChangeEnd, onSeek]);

  // Step helpers
  const stepStart = (delta) => {
    const newStart = Math.max(0, Math.min(endTime - 0.1, startTime + delta));
    onChangeStart(newStart);
    onSeek(newStart);
  };

  const stepEnd = (delta) => {
    const newEnd = Math.max(startTime + 0.1, Math.min(safeDuration, endTime + delta));
    onChangeEnd(newEnd);
    if (currentTime > newEnd) onSeek(newEnd);
  };

  const setStartToCurrent = () => {
    const newStart = Math.min(endTime - 0.1, currentTime);
    onChangeStart(newStart);
  };

  const setEndToCurrent = () => {
    const newEnd = Math.max(startTime + 0.1, currentTime);
    onChangeEnd(newEnd);
  };

  const resetCut = () => {
    onChangeStart(0);
    onChangeEnd(safeDuration);
    onSeek(0);
  };

  return (
    <div className="trim-timeline-card">
      <div className="trim-header">
        <div className="trim-title-group">
          <div className="panel-badge-icon">
            <Scissors size={15} />
          </div>
          <div>
            <h3 className="panel-heading">Cut Video Range</h3>
            <p className="panel-subheading">
              Drag handles or click inside the cut segment to jump to that moment
            </p>
          </div>
        </div>

        <div className="trim-duration-badge">
          <span className="badge-label">Selected Duration:</span>
          <span className="badge-value highlight">{formatTime(cutDuration)}</span>
          <span className="badge-total">/ {formatTime(safeDuration)}</span>
        </div>
      </div>

      {/* Main Interactive Timeline Bar */}
      <div
        ref={barRef}
        className="timeline-track-container"
        onPointerDown={(e) => handlePointerDown(e, 'playhead')}
      >
        {/* Background Track */}
        <div className="timeline-track-bg" />

        {/* Dimmed Outside Left Zone */}
        <div
          className="timeline-outside-strip left"
          style={{ width: `${startPercent}%` }}
          title="Outside cut duration (clicks disabled)"
        />

        {/* Selected / Trimmed Region Highlight (Active click zone) */}
        <div
          className="timeline-selected-range"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`
          }}
          title="Click anywhere here to jump to that moment"
        />

        {/* Dimmed Outside Right Zone */}
        <div
          className="timeline-outside-strip right"
          style={{ left: `${endPercent}%`, width: `${100 - endPercent}%` }}
          title="Outside cut duration (clicks disabled)"
        />

        {/* Start Handle */}
        <div
          className={`timeline-handle handle-start ${activeDrag === 'start' ? 'active' : ''}`}
          style={{ left: `${startPercent}%` }}
          onPointerDown={(e) => handlePointerDown(e, 'start')}
          title="Drag to adjust Start Cut point"
        >
          <div className="handle-flag">IN</div>
          <div className="handle-bar" />
        </div>

        {/* End Handle */}
        <div
          className={`timeline-handle handle-end ${activeDrag === 'end' ? 'active' : ''}`}
          style={{ left: `${endPercent}%` }}
          onPointerDown={(e) => handlePointerDown(e, 'end')}
          title="Drag to adjust End Cut point"
        >
          <div className="handle-flag">OUT</div>
          <div className="handle-bar" />
        </div>

        {/* Current Playhead Scrubber */}
        <div
          className="timeline-playhead"
          style={{ left: `${playheadPercent}%` }}
          onPointerDown={(e) => handlePointerDown(e, 'playhead')}
          title={`Playhead: ${formatTime(clampedCurrentTime)}`}
        >
          <div className="playhead-pin" />
          <div className="playhead-line" />
        </div>
      </div>

      {/* Controls and Timestamp Steppers */}
      <div className="trim-controls-row">
        {/* Start Time Section */}
        <div className="trim-point-control">
          <div className="point-header">
            <span className="point-tag in-tag">START [IN]</span>
            <span className="point-time">{formatTime(startTime)}</span>
          </div>

          <div className="point-stepper-btn-group">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepStart(-1)}
              title="Minus 1 second"
            >
              -1s
            </button>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepStart(-0.1)}
              title="Minus 0.1 second"
            >
              -0.1s
            </button>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepStart(0.1)}
              title="Plus 0.1 second"
            >
              +0.1s
            </button>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepStart(1)}
              title="Plus 1 second"
            >
              +1s
            </button>
            <button
              type="button"
              className="set-current-btn"
              onClick={setStartToCurrent}
              title="Set Start to current playhead"
            >
              Mark Current
            </button>
          </div>
        </div>

        {/* Center Audition / Preview Buttons */}
        <div className="trim-audition-group">
          <button
            type="button"
            className="audition-btn primary"
            onClick={onPlaySegment}
            title="Preview cut from the start"
          >
            <Play size={14} /> Preview Cut
          </button>
          <button
            type="button"
            className={`audition-btn ${isLoopingSegment ? 'active' : ''}`}
            onClick={onToggleLoopSegment}
            title="Toggle loop for cut segment"
          >
            <Repeat size={14} /> Loop Cut
          </button>
          <button
            type="button"
            className="audition-btn"
            onClick={resetCut}
            title="Reset cut to full video"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        {/* End Time Section */}
        <div className="trim-point-control">
          <div className="point-header">
            <span className="point-tag out-tag">END [OUT]</span>
            <span className="point-time">{formatTime(endTime)}</span>
          </div>

          <div className="point-stepper-btn-group">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepEnd(-1)}
              title="Minus 1 second"
            >
              -1s
            </button>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepEnd(-0.1)}
              title="Minus 0.1 second"
            >
              -0.1s
            </button>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepEnd(0.1)}
              title="Plus 0.1 second"
            >
              +0.1s
            </button>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepEnd(1)}
              title="Plus 1 second"
            >
              +1s
            </button>
            <button
              type="button"
              className="set-current-btn"
              onClick={setEndToCurrent}
              title="Set End to current playhead"
            >
              Mark Current
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
