import React, { useState } from 'react';
import { Volume2, VolumeX, Volume1, Volume } from 'lucide-react';

const VOLUME_PRESETS = [
  { label: 'Mute', value: 0 },
  { label: '50%', value: 50 },
  { label: '100% (Normal)', value: 100 },
  { label: '150%', value: 150 },
  { label: '200% (Boost)', value: 200 }
];

export default function VolumeControl({
  volume, // 0 to 200 (percentage)
  onChangeVolume,
  hasAudio = true
}) {
  const [prevVolume, setPrevVolume] = useState(100);

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      onChangeVolume(0);
    } else {
      onChangeVolume(prevVolume || 100);
    }
  };

  const getVolumeIcon = () => {
    if (volume === 0 || !hasAudio) return <VolumeX size={16} />;
    if (volume < 50) return <Volume size={16} />;
    if (volume <= 100) return <Volume1 size={16} />;
    return <Volume2 size={16} />;
  };

  return (
    <div className="control-card">
      <div className="control-header">
        <div className="title-group">
          <div className="panel-badge-icon">
            {getVolumeIcon()}
          </div>
          <div>
            <h3 className="panel-heading">Audio Volume</h3>
            <p className="panel-subheading">
              {hasAudio
                ? 'Adjust audio output from 0% (Mute) up to 200% boost'
                : 'No audio track detected in source video'}
            </p>
          </div>
        </div>

        <div className="value-display-badge">
          <button
            type="button"
            className={`mute-toggle-btn ${volume === 0 ? 'muted' : ''}`}
            onClick={toggleMute}
            title={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {getVolumeIcon()}
          </button>
          <span className="volume-number">{volume}%</span>
        </div>
      </div>

      {/* Slider */}
      <div className="slider-wrapper">
        <input
          type="range"
          min="0"
          max="200"
          step="5"
          value={volume}
          disabled={!hasAudio}
          onChange={(e) => onChangeVolume(parseInt(e.target.value, 10))}
          className="custom-range-slider volume-slider"
        />
        <div className="slider-scale-labels">
          <span>0% (Mute)</span>
          <span>100% (Original)</span>
          <span>200% (2x Boost)</span>
        </div>
      </div>

      {/* Presets */}
      <div className="preset-chip-group">
        {VOLUME_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={!hasAudio}
            className={`preset-chip ${volume === p.value ? 'active' : ''}`}
            onClick={() => onChangeVolume(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {volume > 100 && (
        <div className="boost-notice-banner">
          <span>⚡ <strong>Audio Boost active:</strong> Audio gain is amplified to {(volume / 100).toFixed(1)}x original levels.</span>
        </div>
      )}
    </div>
  );
}
