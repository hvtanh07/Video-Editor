/**
 * In-browser MP4 Box Patcher and Indexer for Windows Media Player seek compatibility.
 * 
 * Chrome/Edge MediaRecorder produces fragmented MP4 (fMP4) without mvhd duration
 * and without an mfra (Movie Fragment Random Access) index box.
 * This causes Windows Media Player to treat the video as an endless livestream,
 * disabling the timeline slider and seeking.
 * 
 * This utility:
 * 1. Patches mvhd, tkhd, and mdhd boxes with the exact clip duration.
 * 2. Scans all moof fragments and constructs a compliant mfra index at the end of the file.
 */
export async function makeMp4Seekable(blob, durationSeconds) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const view = new DataView(uint8.buffer);
    const length = uint8.length;

    let pos = 0;
    let movieTimescale = 1000;
    const tracks = [];
    const moofs = [];

    // Scan top-level boxes
    while (pos + 8 <= length) {
      const size = view.getUint32(pos);
      const type = String.fromCharCode(
        uint8[pos + 4], uint8[pos + 5], uint8[pos + 6], uint8[pos + 7]
      );

      const boxSize = size === 1 
        ? Number(view.getBigUint64(pos + 8)) 
        : (size === 0 ? length - pos : size);

      if (boxSize < 8 || pos + boxSize > length) break;

      if (type === 'moov') {
        let moovPos = pos + 8;
        const moovEnd = pos + boxSize;

        while (moovPos + 8 <= moovEnd) {
          const subSize = view.getUint32(moovPos);
          const subType = String.fromCharCode(
            uint8[moovPos + 4], uint8[moovPos + 5], uint8[moovPos + 6], uint8[moovPos + 7]
          );
          const subBoxSize = subSize === 1 ? Number(view.getBigUint64(moovPos + 8)) : subSize;
          if (subBoxSize < 8) break;

          if (subType === 'mvhd') {
            const version = uint8[moovPos + 8];
            if (version === 0) {
              movieTimescale = view.getUint32(moovPos + 20) || 1000;
              const dur = Math.round(durationSeconds * movieTimescale);
              view.setUint32(moovPos + 24, dur);
            } else if (version === 1) {
              movieTimescale = view.getUint32(moovPos + 28) || 1000;
              const dur = BigInt(Math.round(durationSeconds * movieTimescale));
              view.setBigUint64(moovPos + 32, dur);
            }
          } else if (subType === 'trak') {
            let trakPos = moovPos + 8;
            const trakEnd = moovPos + subBoxSize;
            let currentTrackId = 1;
            let currentTimescale = movieTimescale;

            while (trakPos + 8 <= trakEnd) {
              const trkSize = view.getUint32(trakPos);
              const trkType = String.fromCharCode(
                uint8[trakPos + 4], uint8[trakPos + 5], uint8[trakPos + 6], uint8[trakPos + 7]
              );
              const trkBoxSize = trkSize === 1 ? Number(view.getBigUint64(trakPos + 8)) : trkSize;
              if (trkBoxSize < 8) break;

              if (trkType === 'tkhd') {
                const version = uint8[trakPos + 8];
                if (version === 0) {
                  currentTrackId = view.getUint32(trakPos + 20) || 1;
                  const dur = Math.round(durationSeconds * movieTimescale);
                  view.setUint32(trakPos + 28, dur);
                } else if (version === 1) {
                  currentTrackId = view.getUint32(trakPos + 28) || 1;
                  const dur = BigInt(Math.round(durationSeconds * movieTimescale));
                  view.setBigUint64(trakPos + 36, dur);
                }
              } else if (trkType === 'mdia') {
                let mdiaPos = trakPos + 8;
                const mdiaEnd = trakPos + trkBoxSize;

                while (mdiaPos + 8 <= mdiaEnd) {
                  const mdSize = view.getUint32(mdiaPos);
                  const mdType = String.fromCharCode(
                    uint8[mdiaPos + 4], uint8[mdiaPos + 5], uint8[mdiaPos + 6], uint8[mdiaPos + 7]
                  );
                  const mdBoxSize = mdSize === 1 ? Number(view.getBigUint64(mdiaPos + 8)) : mdSize;
                  if (mdBoxSize < 8) break;

                  if (mdType === 'mdhd') {
                    const version = uint8[mdiaPos + 8];
                    if (version === 0) {
                      currentTimescale = view.getUint32(mdiaPos + 20) || 1000;
                      const dur = Math.round(durationSeconds * currentTimescale);
                      view.setUint32(mdiaPos + 24, dur);
                    } else if (version === 1) {
                      currentTimescale = view.getUint32(mdiaPos + 28) || 1000;
                      const dur = BigInt(Math.round(durationSeconds * currentTimescale));
                      view.setBigUint64(mdiaPos + 32, dur);
                    }
                  }
                  mdiaPos += mdBoxSize;
                }
              }
              trakPos += trkBoxSize;
            }
            tracks.push({ trackId: currentTrackId, timescale: currentTimescale });
          }
          moovPos += subBoxSize;
        }
      } else if (type === 'moof') {
        moofs.push({ offset: pos });
      }

      pos += boxSize;
    }

    // If movie fragments were found, build and append mfra seek index box
    if (moofs.length > 0) {
      const mainTrack = tracks[0] || { trackId: 1, timescale: movieTimescale };
      const stepDuration = durationSeconds / Math.max(1, moofs.length);
      const numEntries = moofs.length;
      const entrySize = 11; // time(4) + offset(4) + traf(1) + trun(1) + sample(1)
      const tfraTotalSize = 24 + (numEntries * entrySize);

      const tfraBuf = new Uint8Array(tfraTotalSize);
      const tfraView = new DataView(tfraBuf.buffer);

      tfraView.setUint32(0, tfraTotalSize);
      tfraBuf[4] = 0x74; // 't'
      tfraBuf[5] = 0x66; // 'f'
      tfraBuf[6] = 0x72; // 'r'
      tfraBuf[7] = 0x61; // 'a'
      tfraBuf[8] = 0; // version 0
      tfraView.setUint32(12, mainTrack.trackId);
      tfraView.setUint32(16, 0); // reserved
      tfraView.setUint32(20, numEntries);

      let offset = 24;
      for (let i = 0; i < moofs.length; i++) {
        const time = Math.round(i * stepDuration * mainTrack.timescale);
        tfraView.setUint32(offset, time);
        tfraView.setUint32(offset + 4, moofs[i].offset);
        tfraBuf[offset + 8] = 1; // traf_number
        tfraBuf[offset + 9] = 1; // trun_number
        tfraBuf[offset + 10] = 1; // sample_number
        offset += entrySize;
      }

      // mfro box (16 bytes)
      const mfroBuf = new Uint8Array(16);
      const mfroView = new DataView(mfroBuf.buffer);
      mfroView.setUint32(0, 16);
      mfroBuf[4] = 0x6d; // 'm'
      mfroBuf[5] = 0x66; // 'f'
      mfroBuf[6] = 0x72; // 'r'
      mfroBuf[7] = 0x6f; // 'o'
      mfroView.setUint32(8, 0);

      const mfraTotalSize = 8 + tfraBuf.length + 16;
      mfroView.setUint32(12, mfraTotalSize);

      // mfra header (8 bytes)
      const mfraHeader = new Uint8Array(8);
      const mfraView = new DataView(mfraHeader.buffer);
      mfraView.setUint32(0, mfraTotalSize);
      mfraHeader[4] = 0x6d; // 'm'
      mfraHeader[5] = 0x66; // 'f'
      mfraHeader[6] = 0x72; // 'r'
      mfraHeader[7] = 0x61; // 'a'

      return new Blob([uint8, mfraHeader, tfraBuf, mfroBuf], { type: 'video/mp4' });
    }

    return new Blob([uint8], { type: 'video/mp4' });
  } catch (err) {
    console.warn('Failed to patch MP4 duration/index:', err);
    return blob; // fallback to original blob if patching encounters unexpected container
  }
}
