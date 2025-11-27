import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as mediasoup from 'mediasoup';
import config from './config.js';

// --- Global Variables ---
let worker;
let router;
let producerTransport;
let consumerTransport;
let producer;
let consumer;

// --- Initialization ---
const app = express();
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.send('VCV Signaling Server Running');
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for dev
    methods: ["GET", "POST"]
  }
});

// --- MediaSoup Startup Logic ---
async function runMediasoupWorker() {
  worker = await mediasoup.createWorker({
    logLevel: config.mediasoup.worker.logLevel,
    logTags: config.mediasoup.worker.logTags,
    rtcMinPort: config.mediasoup.worker.rtcMinPort,
    rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
  });

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });

  console.log('✅ MediaSoup Worker created [pid:%d]', worker.pid);
  return worker;
}

// --- Socket.io Signaling Logic ---
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  // TODO: Add signaling events (joinRoom, createTransport, produce, consume)
});

// --- Start Server ---
async function start() {
  try {
    // 1. Start MediaSoup Worker
    await runMediasoupWorker();
    
    // 2. Start HTTP Server
    httpServer.listen(config.https.listenPort, () => {
      console.log(`🚀 VCV Server listening on port ${config.https.listenPort}`);
      console.log(`🔗 http://${config.domain}:${config.https.listenPort}`);
    });
  } catch (err) {
    console.error(err);
  }
}

start();