import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Crosshair, RotateCcw, Lock, Unlock } from 'lucide-react';

const ASPECT_PRESETS = [
  { label: 'Freeform', ratio: null },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '1:1', ratio: 1 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '21:9', ratio: 21 / 9 }
];

export default function CropOverlay({
  containerRef,
  videoRef,
  videoWidth,
  videoHeight,
  crop, // { x, y, width, height }
  onChangeCrop,
  onApplyCrop,
  onCancelCrop
}) {
  const [videoDisplayRect, setVideoDisplayRect] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('Freeform');
  const [isRatioLocked, setIsRatioLocked] = useState(false);

  // Compute displayed video rect within container
  const updateDisplayRect = useCallback(() => {
    if (!videoRef?.current || !videoWidth || !videoHeight) return;
    const video = videoRef.current;
    const container = containerRef?.current;

    const vRect = video.getBoundingClientRect();
    if (vRect.width === 0 || vRect.height === 0) return;

    const cRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };

    // Precise offset of the video relative to its container
    const left = vRect.left - cRect.left;
    const top = vRect.top - cRect.top;
    const width = vRect.width;
    const height = vRect.height;

    setVideoDisplayRect({
      left,
      top,
      width,
      height,
      scaleX: width / videoWidth,
      scaleY: height / videoHeight
    });
  }, [videoRef, containerRef, videoWidth, videoHeight]);

  useEffect(() => {
    updateDisplayRect();

    window.addEventListener('resize', updateDisplayRect);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateDisplayRect());
      if (videoRef?.current) ro.observe(videoRef.current);
      if (containerRef?.current) ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateDisplayRect);
      if (ro) ro.disconnect();
    };
  }, [updateDisplayRect, videoRef, containerRef]);

  // Keyboard shortcuts: Enter to Apply, Escape to Cancel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onApplyCrop();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancelCrop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onApplyCrop, onCancelCrop]);

  // Apply preset ratio
  const applyPreset = (preset) => {
    setSelectedPreset(preset.label);
    if (!videoWidth || !videoHeight) return;

    if (!preset.ratio) {
      setIsRatioLocked(false);
      return; // Freeform
    }

    setIsRatioLocked(true);
    const targetRatio = preset.ratio;
    let newW = videoWidth;
    let newH = Math.round(newW / targetRatio);

    if (newH > videoHeight) {
      newH = videoHeight;
      newW = Math.round(newH * targetRatio);
    }

    // Keep even numbers for H.264
    newW = Math.floor(newW / 2) * 2;
    newH = Math.floor(newH / 2) * 2;

    const newX = Math.floor((videoWidth - newW) / 2);
    const newY = Math.floor((videoHeight - newH) / 2);

    onChangeCrop({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: newW,
      height: newH
    });
  };

  // Center crop box
  const centerCrop = () => {
    if (!videoWidth || !videoHeight || !crop) return;
    const newX = Math.max(0, Math.floor((videoWidth - crop.width) / 2));
    const newY = Math.max(0, Math.floor((videoHeight - crop.height) / 2));
    onChangeCrop({
      ...crop,
      x: newX,
      y: newY
    });
  };

  // Reset to full video
  const resetToFull = () => {
    setSelectedPreset('Freeform');
    setIsRatioLocked(false);
    onChangeCrop({
      x: 0,
      y: 0,
      width: Math.floor(videoWidth / 2) * 2,
      height: Math.floor(videoHeight / 2) * 2
    });
  };

  // Mouse / Touch handlers for dragging and resizing
  const handlePointerDown = (e, handleType = null) => {
    e.stopPropagation();
    e.preventDefault();

    setActiveHandle(handleType);
    setIsDragging(true);
    setDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      initialCrop: { ...crop }
    });
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging || !dragStart || !videoDisplayRect) return;

      const deltaScreenX = e.clientX - dragStart.clientX;
      const deltaScreenY = e.clientY - dragStart.clientY;

      const deltaX = deltaScreenX / videoDisplayRect.scaleX;
      const deltaY = deltaScreenY / videoDisplayRect.scaleY;

      const { initialCrop } = dragStart;
      let { x, y, width, height } = initialCrop;
      const minSize = 24;

      const activeRatio = ASPECT_PRESETS.find((p) => p.label === selectedPreset)?.ratio;

      if (!activeHandle) {
        // Dragging the whole crop box anywhere inside the video boundaries
        x = Math.max(0, Math.min(videoWidth - width, initialCrop.x + deltaX));
        y = Math.max(0, Math.min(videoHeight - height, initialCrop.y + deltaY));
      } else {
        // Handle resizing in any direction
        if (activeHandle.includes('e')) {
          width = Math.max(minSize, Math.min(videoWidth - initialCrop.x, initialCrop.width + deltaX));
        }
        if (activeHandle.includes('s')) {
          height = Math.max(minSize, Math.min(videoHeight - initialCrop.y, initialCrop.height + deltaY));
        }
        if (activeHandle.includes('w')) {
          const maxLeftShift = initialCrop.x;
          const maxRightShift = initialCrop.width - minSize;
          const clampedDeltaX = Math.min(maxRightShift, Math.max(-maxLeftShift, deltaX));
          x = initialCrop.x + clampedDeltaX;
          width = initialCrop.width - clampedDeltaX;
        }
        if (activeHandle.includes('n')) {
          const maxTopShift = initialCrop.y;
          const maxBottomShift = initialCrop.height - minSize;
          const clampedDeltaY = Math.min(maxBottomShift, Math.max(-maxTopShift, deltaY));
          y = initialCrop.y + clampedDeltaY;
          height = initialCrop.height - clampedDeltaY;
        }

        // If ratio locked, scale height/width proportionally
        if (isRatioLocked && activeRatio) {
          if (activeHandle === 'e' || activeHandle === 'w') {
            height = Math.min(videoHeight - y, width / activeRatio);
            width = height * activeRatio;
          } else if (activeHandle === 's' || activeHandle === 'n') {
            width = Math.min(videoWidth - x, height * activeRatio);
            height = width / activeRatio;
          } else {
            const calcH = width / activeRatio;
            if (y + calcH <= videoHeight) {
              height = calcH;
            } else {
              height = videoHeight - y;
              width = height * activeRatio;
            }
          }
        }
      }

      // Enforce bounds and even integers for video encoding
      x = Math.max(0, Math.min(videoWidth - minSize, Math.round(x)));
      y = Math.max(0, Math.min(videoHeight - minSize, Math.round(y)));
      width = Math.max(minSize, Math.min(videoWidth - x, Math.round(width)));
      height = Math.max(minSize, Math.min(videoHeight - y, Math.round(height)));

      // Keep even numbers for video codecs
      width = Math.floor(width / 2) * 2;
      height = Math.floor(height / 2) * 2;

      onChangeCrop({ x, y, width, height });
    };

    const handlePointerUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setActiveHandle(null);
        setDragStart(null);
      }
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    isDragging,
    dragStart,
    activeHandle,
    videoDisplayRect,
    videoWidth,
    videoHeight,
    selectedPreset,
    isRatioLocked,
    onChangeCrop
  ]);

  if (!videoDisplayRect || !crop) return null;

  const currentRatio = (crop.width / crop.height).toFixed(2);
  const boxLeft = crop.x * videoDisplayRect.scaleX;
  const boxTop = crop.y * videoDisplayRect.scaleY;
  const boxWidth = crop.width * videoDisplayRect.scaleX;
  const boxHeight = crop.height * videoDisplayRect.scaleY;

  return (
    <div className="crop-overlay-wrapper">
      {/* Floating Crop Action Toolbar */}
      <div className="crop-toolbar">
        <div className="crop-presets">
          <span className="crop-toolbar-label">Ratio:</span>
          {ASPECT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`crop-preset-chip ${selectedPreset === preset.label ? 'active' : ''}`}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="crop-actions">
          <button
            type="button"
            className={`crop-action-btn ${isRatioLocked ? 'active' : ''}`}
            onClick={() => setIsRatioLocked(!isRatioLocked)}
            title={isRatioLocked ? 'Aspect Ratio Locked' : 'Freeform Resizing'}
          >
            {isRatioLocked ? <Lock size={13} /> : <Unlock size={13} />}
            <span>{isRatioLocked ? 'Locked' : 'Freeform'}</span>
          </button>
          <button
            type="button"
            className="crop-action-btn"
            onClick={centerCrop}
            title="Center crop box"
          >
            <Crosshair size={13} /> Center
          </button>
          <button
            type="button"
            className="crop-action-btn"
            onClick={resetToFull}
            title="Reset to full frame"
          >
            <RotateCcw size={13} /> Full
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            className="crop-cancel-btn"
            onClick={onCancelCrop}
            title="Cancel crop adjustment (Esc)"
          >
            <X size={14} /> Cancel
          </button>

          {/* Primary Apply Crop Button */}
          <button
            type="button"
            className="crop-apply-btn"
            onClick={onApplyCrop}
            title="Apply Crop and use as new working video (Enter)"
          >
            <Check size={16} /> Apply Crop
          </button>
        </div>
      </div>

      {/* Visual Overlay Pinning Exactly Over the Video */}
      <div
        className="crop-bounding-container"
        style={{
          left: videoDisplayRect.left,
          top: videoDisplayRect.top,
          width: videoDisplayRect.width,
          height: videoDisplayRect.height
        }}
      >
        {/* Shaded Cutout Mask Over Inactive Video Areas */}
        <svg className="crop-mask-svg">
          <defs>
            <mask id="crop-hole-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={boxLeft}
                y={boxTop}
                width={boxWidth}
                height={boxHeight}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.65)"
            mask="url(#crop-hole-mask)"
          />
        </svg>

        {/* Active Resizable & Draggable Crop Box */}
        <div
          className="crop-box"
          style={{
            left: boxLeft,
            top: boxTop,
            width: boxWidth,
            height: boxHeight,
            cursor: isDragging && !activeHandle ? 'grabbing' : 'grab'
          }}
          onPointerDown={(e) => handlePointerDown(e, null)}
        >
          {/* Rule of Thirds Grid */}
          <div className="crop-grid">
            <div className="crop-grid-h crop-grid-h1" />
            <div className="crop-grid-h crop-grid-h2" />
            <div className="crop-grid-v crop-grid-v1" />
            <div className="crop-grid-v crop-grid-v2" />
          </div>

          {/* Live Size & Ratio Indicator Badge */}
          <div className="crop-info-badge">
            <span className="crop-dims">{crop.width} × {crop.height}</span>
            <span className="crop-ratio-sub">({currentRatio}:1)</span>
          </div>

          {/* 8 Resize Handles */}
          <div className="crop-handle handle-nw" onPointerDown={(e) => handlePointerDown(e, 'nw')} />
          <div className="crop-handle handle-n" onPointerDown={(e) => handlePointerDown(e, 'n')} />
          <div className="crop-handle handle-ne" onPointerDown={(e) => handlePointerDown(e, 'ne')} />
          <div className="crop-handle handle-e" onPointerDown={(e) => handlePointerDown(e, 'e')} />
          <div className="crop-handle handle-se" onPointerDown={(e) => handlePointerDown(e, 'se')} />
          <div className="crop-handle handle-s" onPointerDown={(e) => handlePointerDown(e, 's')} />
          <div className="crop-handle handle-sw" onPointerDown={(e) => handlePointerDown(e, 'sw')} />
          <div className="crop-handle handle-w" onPointerDown={(e) => handlePointerDown(e, 'w')} />
        </div>
      </div>
    </div>
  );
}
