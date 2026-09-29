import React from 'react';
import { Film, Download, Loader2, XCircle, CheckCircle, Sparkles } from 'lucide-react';
import { formatTime } from '../utils/formatTime';

export default function ExportPanel({
  onExport,
  onCancel,
  isExporting,
  exportProgress,
  exportStatus,
  cutDuration,
  crop,
  isCropEnabled = false,
  speed,
  volume,
  videoMetadata
}) {
  const effectiveDuration = cutDuration / speed;
  const targetW = isCropEnabled && crop ? crop.width : videoMetadata?.width || 0;
  const targetH = isCropEnabled && crop ? crop.height : videoMetadata?.height || 0;
  const targetRatio = targetW && targetH ? (targetW / targetH).toFixed(2) : '1.78';

  return (
    <div className="export-panel-card">
      <div className="export-header">
        <div className="title-group">
          <div className="panel-badge-icon accent-icon">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="panel-heading">Render & Export Video</h3>
            <p className="panel-subheading">
              Apply cut, {isCropEnabled ? 'custom crop ratio' : 'original framing'}, speed retiming, and audio volume
            </p>
          </div>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="export-summary-grid">
        <div className="summary-pill">
          <span className="summary-label">Framing & Ratio:</span>
          <strong>
            {isCropEnabled ? (
              `${targetW} × ${targetH} (${targetRatio}:1)`
            ) : (
              `Original (${videoMetadata?.width}×${videoMetadata?.height})`
            )}
          </strong>
        </div>
        <div className="summary-pill">
          <span className="summary-label">Output Duration:</span>
          <strong>{formatTime(effectiveDuration)}</strong>
        </div>
        <div className="summary-pill">
          <span className="summary-label">Speed Retiming:</span>
          <strong>{speed.toFixed(2)}x</strong>
        </div>
        <div className="summary-pill">
          <span className="summary-label">Audio Level:</span>
          <strong>{volume}%</strong>
        </div>
      </div>

      {/* Export Action / Progress Area */}
      {isExporting ? (
        <div className="export-progress-area">
          <div className="progress-top-info">
            <div className="progress-status-text">
              <Loader2 size={16} className="spin-animation" />
              <span>{exportStatus || 'Rendering video with FFmpeg...'}</span>
            </div>
            <span className="progress-percentage-num">{exportProgress}%</span>
          </div>

          <div className="progress-track-bg">
            <div
              className="progress-track-fill"
              style={{ width: `${exportProgress}%` }}
            />
          </div>

          <div className="progress-footer">
            <button
              type="button"
              className="cancel-export-btn"
              onClick={onCancel}
            >
              <XCircle size={15} /> Cancel Render
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="main-export-button"
          onClick={onExport}
        >
          <Film size={18} />
          <span>
            Export Video ({targetW}×{targetH} @ {speed}x)
          </span>
        </button>
      )}
    </div>
  );
}
