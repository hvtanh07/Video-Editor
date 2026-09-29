import React from 'react';
import {
  Crop,
  Check,
  X,
  RotateCcw,
  Crosshair,
  ArrowLeft,
  ArrowRight,
  Sparkles
} from 'lucide-react';

const ASPECT_PRESETS = [
  { label: 'Freeform', ratio: null, desc: 'Custom Shape' },
  { label: '16:9', ratio: 16 / 9, desc: 'Landscape' },
  { label: '9:16', ratio: 9 / 16, desc: 'Vertical / Shorts' },
  { label: '1:1', ratio: 1, desc: 'Square' },
  { label: '4:5', ratio: 4 / 5, desc: 'Portrait' },
  { label: '4:3', ratio: 4 / 3, desc: 'Classic' },
  { label: '21:9', ratio: 21 / 9, desc: 'Ultrawide' }
];

export default function CropControl({
  isAdjustingCrop,
  onStartCrop,
  onApplyCrop,
  onCancelCrop,
  onResetCrop,
  isCropped,
  pendingCrop,
  onChangeCrop,
  workingWidth = 1280,
  workingHeight = 720,
  sourceWidth = 1280,
  sourceHeight = 720
}) {
  const currentW = pendingCrop ? pendingCrop.width : workingWidth;
  const currentH = pendingCrop ? pendingCrop.height : workingHeight;
  const currentX = pendingCrop ? pendingCrop.x : 0;
  const currentY = pendingCrop ? pendingCrop.y : 0;
  const currentRatio = currentW && currentH ? (currentW / currentH).toFixed(2) : '1.78';

  // Apply ratio preset
  const applyPreset = (preset) => {
    if (!workingWidth || !workingHeight) return;

    if (!isAdjustingCrop) {
      onStartCrop();
    }

    if (!preset.ratio) {
      return; // Freeform
    }

    const targetRatio = preset.ratio;
    let newW = workingWidth;
    let newH = Math.round(newW / targetRatio);

    if (newH > workingHeight) {
      newH = workingHeight;
      newW = Math.round(newH * targetRatio);
    }

    newW = Math.floor(newW / 2) * 2;
    newH = Math.floor(newH / 2) * 2;

    const newX = Math.floor((workingWidth - newW) / 2);
    const newY = Math.floor((workingHeight - newH) / 2);

    onChangeCrop({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: newW,
      height: newH
    });
  };

  // Center crop box
  const centerCrop = () => {
    if (!workingWidth || !workingHeight || !pendingCrop) return;
    const newX = Math.max(0, Math.floor((workingWidth - pendingCrop.width) / 2));
    const newY = Math.max(0, Math.floor((workingHeight - pendingCrop.height) / 2));
    onChangeCrop({ ...pendingCrop, x: newX, y: newY });
  };

  const alignLeft = () => {
    if (!pendingCrop) return;
    onChangeCrop({ ...pendingCrop, x: 0 });
  };
  const alignRight = () => {
    if (!pendingCrop || !workingWidth) return;
    onChangeCrop({ ...pendingCrop, x: Math.max(0, workingWidth - pendingCrop.width) });
  };

  const stepWidth = (delta) => {
    if (!pendingCrop) return;
    let newW = Math.max(40, Math.min(workingWidth - pendingCrop.x, pendingCrop.width + delta));
    newW = Math.floor(newW / 2) * 2;
    onChangeCrop({ ...pendingCrop, width: newW });
  };

  const stepHeight = (delta) => {
    if (!pendingCrop) return;
    let newH = Math.max(40, Math.min(workingHeight - pendingCrop.y, pendingCrop.height + delta));
    newH = Math.floor(newH / 2) * 2;
    onChangeCrop({ ...pendingCrop, height: newH });
  };

  const handleWidthInput = (val) => {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 20) {
      let w = Math.min(workingWidth - currentX, parsed);
      w = Math.floor(w / 2) * 2;
      onChangeCrop({ ...pendingCrop, width: w });
    }
  };

  const handleHeightInput = (val) => {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 20) {
      let h = Math.min(workingHeight - currentY, parsed);
      h = Math.floor(h / 2) * 2;
      onChangeCrop({ ...pendingCrop, height: h });
    }
  };

  const activePreset = ASPECT_PRESETS.find(
    (p) => p.ratio && Math.abs(currentW / currentH - p.ratio) < 0.04
  );

  return (
    <div className={`control-card crop-control-card ${isAdjustingCrop ? 'adjusting-active' : ''}`}>
      <div className="control-header">
        <div className="title-group">
          <div className={`panel-badge-icon ${isAdjustingCrop ? 'accent-active' : ''}`}>
            <Crop size={16} />
          </div>
          <div>
            <h3 className="panel-heading">Crop Video</h3>
            <p className="panel-subheading">
              {isAdjustingCrop
                ? 'Adjust the crop box on the video, then click Apply Crop'
                : isCropped
                ? `Video is cropped to ${workingWidth} × ${workingHeight} (${(workingWidth / workingHeight).toFixed(2)}:1)`
                : `Full original resolution: ${sourceWidth} × ${sourceHeight}`}
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        {!isAdjustingCrop ? (
          <button
            type="button"
            className="crop-start-action-btn"
            onClick={onStartCrop}
            title="Start cropping the video"
          >
            <Crop size={15} />
            <span>Crop Video</span>
          </button>
        ) : (
          <div className="crop-adjust-header-actions">
            <button
              type="button"
              className="crop-cancel-btn-header"
              onClick={onCancelCrop}
              title="Cancel crop adjustment (Esc)"
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="button"
              className="crop-apply-btn-header"
              onClick={onApplyCrop}
              title="Apply crop to video (Enter)"
            >
              <Check size={15} /> Apply Crop
            </button>
          </div>
        )}
      </div>

      {isAdjustingCrop ? (
        /* Active Crop Adjustment Controls */
        <div className="crop-active-body">
          {/* Preset Buttons */}
          <div className="crop-ratio-selector">
            <div className="crop-section-label">Aspect Ratio Presets:</div>
            <div className="preset-chip-group">
              {ASPECT_PRESETS.map((p) => {
                const isSelected = p.ratio
                  ? Math.abs(currentW / currentH - p.ratio) < 0.04
                  : !activePreset;
                return (
                  <button
                    key={p.label}
                    type="button"
                    className={`preset-chip ${isSelected ? 'active' : ''}`}
                    onClick={() => applyPreset(p)}
                    title={p.desc}
                  >
                    <strong>{p.label}</strong>
                    <span className="preset-sub">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Steppers & Fine-Tuning */}
          <div className="crop-stats-bar">
            <div className="crop-dimensions-pill">
              <span className="pill-title">New Ratio:</span>
              <strong className="dims-highlight">
                {currentW} × {currentH}
              </strong>
              <span className="ratio-badge">({currentRatio}:1)</span>
            </div>

            <div className="crop-stepper-inputs">
              <div className="stepper-unit">
                <span className="stepper-label">W:</span>
                <input
                  type="number"
                  min="40"
                  max={workingWidth}
                  step="2"
                  value={currentW}
                  onChange={(e) => handleWidthInput(e.target.value)}
                  className="crop-num-input"
                />
                <button type="button" className="mini-step-btn" onClick={() => stepWidth(-50)}>-50</button>
                <button type="button" className="mini-step-btn" onClick={() => stepWidth(50)}>+50</button>
              </div>

              <div className="stepper-unit">
                <span className="stepper-label">H:</span>
                <input
                  type="number"
                  min="40"
                  max={workingHeight}
                  step="2"
                  value={currentH}
                  onChange={(e) => handleHeightInput(e.target.value)}
                  className="crop-num-input"
                />
                <button type="button" className="mini-step-btn" onClick={() => stepHeight(-50)}>-50</button>
                <button type="button" className="mini-step-btn" onClick={() => stepHeight(50)}>+50</button>
              </div>
            </div>

            <div className="crop-quick-actions">
              <button
                type="button"
                className="crop-util-btn"
                onClick={centerCrop}
                title="Center crop box"
              >
                <Crosshair size={13} /> Center
              </button>
              <button
                type="button"
                className="crop-util-btn"
                onClick={alignLeft}
                title="Align to Left edge"
              >
                <ArrowLeft size={13} /> Left
              </button>
              <button
                type="button"
                className="crop-util-btn"
                onClick={alignRight}
                title="Align to Right edge"
              >
                <ArrowRight size={13} /> Right
              </button>
            </div>
          </div>

          <div className="crop-apply-banner">
            <div className="banner-left">
              <span>🎯 Frame the exact area on the video above, then click Apply.</span>
            </div>
            <div className="banner-right">
              <button type="button" className="banner-apply-btn" onClick={onApplyCrop}>
                <Check size={16} /> Apply Crop (Enter)
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Video Status when not in adjustment */
        <div className="crop-summary-strip">
          <div className="crop-summary-info">
            <span className="ratio-status-pill">
              {isCropped ? '✂ Cropped Video' : 'Original Video Framing'}
            </span>
            <span className="ratio-dims-text">
              Dimensions: <strong>{workingWidth} × {workingHeight}</strong> ({(workingWidth / workingHeight).toFixed(2)}:1)
            </span>
          </div>

          <div className="crop-summary-actions">
            <button
              type="button"
              className="action-link-btn"
              onClick={onStartCrop}
            >
              <Crop size={14} /> {isCropped ? 'Crop Further' : 'Crop Video'}
            </button>
            {isCropped && (
              <button
                type="button"
                className="action-link-btn reset"
                onClick={onResetCrop}
                title="Reset back to original full video dimensions"
              >
                <RotateCcw size={14} /> Reset to Original
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
