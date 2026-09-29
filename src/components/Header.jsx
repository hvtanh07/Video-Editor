import React from 'react';
import { Film, FolderUp, Undo2, Redo2 } from 'lucide-react';

export default function Header({
  currentVideo,
  onChangeVideo,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo
}) {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-badge">
          <Film size={22} className="logo-icon" />
        </div>
        <div className="title-wrapper">
          <h1 className="app-title">Video Editor Studio</h1>
          <div className="feature-badges">
            <span className="feat-chip">✂ Cut</span>
            <span className="feat-chip">📐 Crop Ratio</span>
            <span className="feat-chip">⚡ 0.25x – 4x Speed</span>
            <span className="feat-chip">🔊 Volume Boost</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Undo and Redo Controls */}
        <div className="history-btn-group">
          <button
            type="button"
            className="history-action-btn"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl + Z)"
          >
            <Undo2 size={16} />
            <span>Undo</span>
            <kbd className="kbd-shortcut">Ctrl+Z</kbd>
          </button>

          <button
            type="button"
            className="history-action-btn"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl + C / Ctrl + Y)"
          >
            <Redo2 size={16} />
            <span>Redo</span>
            <kbd className="kbd-shortcut">Ctrl+C</kbd>
          </button>
        </div>

        <div className="engine-status">
          <span className="status-dot-active" />
          <span className="status-label">FFmpeg Active</span>
        </div>

        {currentVideo && (
          <button
            type="button"
            className="change-video-btn"
            onClick={onChangeVideo}
            title="Upload or choose a different video"
          >
            <FolderUp size={15} /> Change Video
          </button>
        )}
      </div>
    </header>
  );
}
