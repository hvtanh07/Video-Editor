import React, { useState, useRef } from 'react';
import { UploadCloud, Film, PlayCircle, Sparkles, AlertCircle } from 'lucide-react';
import { formatFileSize } from '../utils/formatTime';

export default function VideoUploader({ onSelectVideo, onLoadSample, currentVideo }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const loadLocalVideo = (file) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = objectUrl;

      tempVideo.onloadedmetadata = () => {
        setUploading(false);
        onSelectVideo({
          type: 'local',
          filename: file.name,
          name: file.name,
          url: objectUrl,
          file: file,
          metadata: {
            duration: tempVideo.duration || 10,
            width: tempVideo.videoWidth || 1280,
            height: tempVideo.videoHeight || 720,
            size: file.size,
            format: file.type || 'video/mp4',
            fps: 30
          }
        });
      };

      tempVideo.onerror = () => {
        setUploading(false);
        setError('Could not read video metadata in browser.');
      };
    } catch (e) {
      setUploading(false);
      setError('Failed to process video: ' + e.message);
    }
  };

  const uploadFile = (file) => {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|mkv|avi|m4v)$/i)) {
      setError('Please select a valid video file (.mp4, .mov, .webm, .mkv, .avi)');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            setUploading(false);
            onSelectVideo({
              type: 'upload',
              filename: res.fileId,
              name: res.name,
              url: res.url,
              metadata: res.metadata
            });
            return;
          }
        } catch (e) {
          // Fall through to local fallback
        }
      }
      // On static hosting (e.g. GitHub Pages) or server error, use in-browser object URL
      loadLocalVideo(file);
    };

    xhr.onerror = () => {
      // In case of static GitHub Pages hosting or offline mode, fall back to browser processing
      loadLocalVideo(file);
    };

    xhr.send(formData);
  };

  return (
    <div className="uploader-container">
      {/* Upload Drop Zone */}
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.mov,.webm,.mkv,.avi"
          className="hidden-file-input"
          onChange={handleFileInputChange}
          disabled={uploading}
        />

        <div className="drop-zone-content">
          <div className="drop-icon-wrapper">
            <UploadCloud size={32} />
          </div>

          <div className="drop-text">
            <h4>{uploading ? 'Uploading Video...' : 'Drag & Drop your video here'}</h4>
            <p className="drop-subtext">
              {uploading
                ? `${uploadProgress}% uploaded`
                : 'Supports MP4, WebM, MOV, MKV, AVI • Up to 1GB'}
            </p>
          </div>

          {uploading ? (
            <div className="upload-progress-bar-container">
              <div
                className="upload-progress-bar-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          ) : (
            <button type="button" className="browse-files-btn">
              <Film size={16} /> Browse Video File
            </button>
          )}
        </div>
      </div>

      {/* Quick Sample Video Loader Card */}
      <div className="sample-loader-card">
        <div className="sample-info">
          <div className="sample-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="sample-title">Don't have a video on hand?</div>
            <div className="sample-desc">
              Instantly load a built-in HD 1080p demo test video with moving visuals and audio tone.
            </div>
          </div>
        </div>

        <button
          type="button"
          className="load-sample-btn"
          onClick={onLoadSample}
          disabled={uploading}
        >
          <PlayCircle size={16} /> Load Demo Video
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
