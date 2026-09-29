const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { probeVideo, processVideo } = require('./ffmpeg-service');
const { ensureSampleVideo } = require('./sample-generator');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ensure directories exist
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const STATIC_DIR = fs.existsSync(DOCS_DIR) ? DOCS_DIR : DIST_DIR;

[UPLOADS_DIR, OUTPUTS_DIR, PUBLIC_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${cleanBase}_${Date.now()}_${uuidv4().slice(0, 6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

// Job tracking registry
const jobs = new Map();

/**
 * Stream video with HTTP 206 Partial Content support for seeking
 */
function streamVideoFile(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}

// Media streaming endpoints
app.get('/media/uploads/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  streamVideoFile(req, res, filePath);
});

app.get('/media/outputs/:filename', (req, res) => {
  const filePath = path.join(OUTPUTS_DIR, req.params.filename);
  streamVideoFile(req, res, filePath);
});

app.get('/media/sample', async (req, res) => {
  const samplePath = path.join(PUBLIC_DIR, 'sample.mp4');
  if (!fs.existsSync(samplePath)) {
    await ensureSampleVideo();
  }
  streamVideoFile(req, res, samplePath);
});

// API Routes

// 1. Get demo sample video metadata & URL
app.get('/api/sample', async (req, res) => {
  try {
    const samplePath = await ensureSampleVideo();
    const meta = await probeVideo(samplePath);
    res.json({
      success: true,
      filename: 'sample.mp4',
      name: 'Demo Test Video',
      url: '/media/sample',
      fullPath: samplePath,
      metadata: meta
    });
  } catch (err) {
    console.error('Error preparing sample video:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Upload video file
app.post('/api/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No video file provided' });
  }

  try {
    const filePath = req.file.path;
    const meta = await probeVideo(filePath);

    res.json({
      success: true,
      fileId: req.file.filename,
      name: req.file.originalname,
      url: `/media/uploads/${req.file.filename}`,
      fullPath: filePath,
      metadata: meta
    });
  } catch (err) {
    console.error('Error probing uploaded video:', err);
    // Remove invalid file
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(400).json({
      success: false,
      error: 'Invalid video file or unsupported codec: ' + err.message
    });
  }
});

// 3. Export video with cut, crop, speed, and volume
app.post('/api/export', async (req, res) => {
  try {
    const {
      sourceType, // 'upload' | 'sample'
      filename,
      startTime = 0,
      endTime = null,
      crop = null, // { x, y, width, height }
      speed = 1.0, // 0.25 to 4.0
      volume = 1.0 // 0.0 to 4.0
    } = req.body;

    let inputPath;
    if (sourceType === 'sample') {
      inputPath = path.join(PUBLIC_DIR, 'sample.mp4');
    } else {
      inputPath = path.join(UPLOADS_DIR, filename);
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ success: false, error: 'Source video not found' });
    }

    const jobId = uuidv4();
    const outputFilename = `export_${Date.now()}_${jobId.slice(0, 8)}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    const abortController = new AbortController();

    const job = {
      id: jobId,
      status: 'processing',
      percent: 0,
      currentTime: 0,
      totalTime: 0,
      outputFilename,
      outputUrl: `/media/outputs/${outputFilename}`,
      outputPath,
      downloadUrl: `/api/download/${outputFilename}`,
      error: null,
      abortController
    };

    jobs.set(jobId, job);

    // Respond immediately with jobId so frontend can poll or listen
    res.json({ success: true, jobId });

    // Start background FFmpeg processing
    processVideo({
      inputPath,
      outputPath,
      startTime,
      endTime,
      crop,
      speed: parseFloat(speed) || 1.0,
      volume: parseFloat(volume) !== undefined ? parseFloat(volume) : 1.0,
      signal: abortController.signal,
      onProgress: (p) => {
        job.percent = p.percent;
        job.currentTime = p.currentTime;
        job.totalTime = p.totalTime;
      }
    })
      .then((result) => {
        job.status = 'done';
        job.percent = 100;
        job.result = result;
      })
      .catch((err) => {
        console.error(`Export job ${jobId} failed:`, err);
        job.status = 'error';
        job.error = err.message;
      });
  } catch (err) {
    console.error('Error starting export:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Job status / progress polling endpoint
app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  res.json({
    success: true,
    jobId: job.id,
    status: job.status,
    percent: job.percent,
    currentTime: job.currentTime,
    totalTime: job.totalTime,
    outputUrl: job.outputUrl,
    downloadUrl: job.downloadUrl,
    outputFilename: job.outputFilename,
    error: job.error,
    result: job.result
  });
});

// 5. Cancel a running job
app.post('/api/jobs/:jobId/cancel', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  if (job.status === 'processing' && job.abortController) {
    job.abortController.abort();
    job.status = 'cancelled';
  }

  res.json({ success: true, message: 'Job cancelled' });
});

// 6. Direct file download endpoint
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(OUTPUTS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Exported file not found');
  }

  res.download(filePath, req.params.filename);
});

// In production, serve built frontend (docs/ or dist/)
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/media')) {
      return res.sendFile(path.join(STATIC_DIR, 'index.html'));
    }
    next();
  });
}

const server = app.listen(PORT, async () => {
  console.log(`Video Editor Server running on http://localhost:${PORT}`);
  await ensureSampleVideo().catch(() => {});
});

module.exports = { app, server };
