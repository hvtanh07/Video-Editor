import React from 'react';
import { Gauge, FastForward, RotateCcw } from 'lucide-react';
import { formatTime } from '../utils/formatTime';

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];

export default function SpeedControl({
  speed,
  onChangeSpeed,
  cutDuration = 0
}) {
  const effectiveDuration = cutDuration / speed;

  return (
    <div className="control-card">
      <div className="control-header">
        <div className="title-group">
          <div className="panel-badge-icon">
            <Gauge size={15} />
          </div>
          <div>
            <h3 className="panel-heading">Playback Speed</h3>
            <p className="panel-subheading">From 0.25x (Slow-Mo) to 4.0x (Hyperlapse)</p>
          </div>
        </div>

        <div className="value-display-badge">
          <span className="speed-number">{speed.toFixed(2)}x</span>
        </div>
      </div>

      {/* Slider */}
      <div className="slider-wrapper">
        <input
          type="range"
          min="0.25"
          max="4.0"
          step="0.05"
          value={speed}
          onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
          className="custom-range-slider"
        />
        <div className="slider-scale-labels">
          <span>0.25x</span>
          <span>1.0x (Normal)</span>
          <span>2.0x</span>
          <span>4.0x</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="preset-chip-group">
        {SPEED_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`preset-chip ${Math.abs(speed - p) < 0.01 ? 'active' : ''}`}
            onClick={() => onChangeSpeed(p)}
          >
            {p === 1.0 ? '1.0x (Normal)' : `${p}x`}
          </button>
        ))}
      </div>

      {/* Output Duration Preview */}
      {cutDuration > 0 && (
        <div className="duration-preview-pill">
          <span>Calculated Output Duration:</span>
          <strong>{formatTime(effectiveDuration)}</strong>
          {speed !== 1.0 && (
            <span className="duration-diff-hint">
              ({speed > 1.0 ? `${speed.toFixed(1)}x faster` : `${(1 / speed).toFixed(1)}x slower`})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
