let audioCtx = null;
let sourceNodeMap = new WeakMap();

export function setupVideoAudioGain(videoElement, gainValue = 1.0) {
  if (!videoElement) return null;

  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }

    if (!audioCtx) return null;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    let nodeData = sourceNodeMap.get(videoElement);
    if (!nodeData) {
      const source = audioCtx.createMediaElementSource(videoElement);
      const gainNode = audioCtx.createGain();
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      nodeData = { source, gainNode };
      sourceNodeMap.set(videoElement, nodeData);
    }

    if (nodeData.gainNode) {
      nodeData.gainNode.gain.setValueAtTime(
        Math.max(0, gainValue),
        audioCtx.currentTime
      );
    }

    return nodeData.gainNode;
  } catch (err) {
    // If MediaElementAudioSource already connected or cross-origin issue, fall back gracefully
    console.warn('WebAudio gain hook warning (fallback to standard video.volume):', err);
    return null;
  }
}
