import React from 'react';
import { CheckCircle2, Download, X, Play, Film, Sparkles } from 'lucide-react';
import { formatTime, formatFileSize } from '../utils/formatTime';

export default function ExportModal({
  isOpen,
  onClose,
  result,
  originalMetadata,
  settings
}) {
  if (!isOpen || !result) return null;

  const outputMeta = result.metadata || {};
  const origMeta = originalMetadata || {};

  const origRatio = origMeta.width && origMeta.height ? (origMeta.width / origMeta.height).toFixed(2) : '-';
  const outRatio = outputMeta.width && outputMeta.height ? (outputMeta.width / outputMeta.height).toFixed(2) : '-';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-success-badge">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="modal-heading">Video Exported Successfully!</h2>
              <p className="modal-subheading">Your edited video has been rendered and is ready to download.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Video Player for Exported Result */}
        <div className="modal-player-container">
          <video
            src={result.outputUrl}
            controls
            autoPlay
            loop
            className="exported-video-player"
          />
        </div>

        {/* Comparison Specs */}
        <div className="modal-specs-grid">
          <div className="spec-card">
            <div className="spec-label">Resolution & Ratio</div>
            <div className="spec-val-comparison">
              <span className="spec-orig">{origMeta.width}×{origMeta.height} ({origRatio}:1)</span>
              <span className="spec-arrow">➔</span>
              <strong className="spec-new">{outputMeta.width}×{outputMeta.height} ({outRatio}:1)</strong>
            </div>
            <div className="spec-note">
              {settings.isCropEnabled
                ? 'New video ratio matches cropped area'
                : 'Original video framing preserved'}
            </div>
          </div>

          <div className="spec-card">
            <div className="spec-label">Duration & Speed</div>
            <div className="spec-val-comparison">
              <span className="spec-orig">{formatTime(origMeta.duration)}</span>
              <span className="spec-arrow">➔</span>
              <strong className="spec-new">{formatTime(outputMeta.duration)}</strong>
            </div>
            <div className="spec-note">{settings.speed}x speed applied</div>
          </div>

          <div className="spec-card">
            <div className="spec-label">File Size</div>
            <div className="spec-val-comparison">
              <span className="spec-orig">{formatFileSize(origMeta.size)}</span>
              <span className="spec-arrow">➔</span>
              <strong className="spec-new">{formatFileSize(outputMeta.size)}</strong>
            </div>
            <div className="spec-note">H.264 high efficiency MP4</div>
          </div>

          <div className="spec-card">
            <div className="spec-label">Audio Volume</div>
            <div className="spec-val-comparison">
              <strong className="spec-new">{settings.volume}%</strong>
            </div>
            <div className="spec-note">{settings.volume === 0 ? 'Muted' : settings.volume > 100 ? 'Amplified' : 'Adjusted'}</div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions-row">
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
          >
            Back to Editor
          </button>

          <a
            href={result.downloadUrl}
            download={result.outputFilename || 'edited_video.mp4'}
            className="primary-download-btn"
          >
            <Download size={18} />
            <span>Download Video (.MP4)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
