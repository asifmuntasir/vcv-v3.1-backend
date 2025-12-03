import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv'; // Fixed: Changed require to import
import * as mediasoup from 'mediasoup';
import config from './config.js'; // Ensure path is correct
import Room from './sfu/Room.js';
import Peer from './sfu/Peer.js';

// --- Database & Routes ---
import connectDB from './db/db.js';
import meetingRoutes from './routes/meetingRoutes.js';

// --- Global Variables ---
let worker;
const rooms = new Map(); // Map<roomId, Room>

// --- Initialization ---
dotenv.config(); // Initialize environment variables
connectDB();     // Connect to MongoDB

const app = express();
app.use(cors());
app.use(express.json());

// --- API Routes ---
app.use('/api/meetings', meetingRoutes);

// Health Check Route
app.get('/', (req, res) => {
  res.send('VCV Signaling Server Running');
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow connections from React
    methods: ["GET", "POST"]
  }
});

// --- MediaSoup Worker Startup ---
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
}

// --- Helper: Get or Create Room ---
async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Room(roomId, worker, io);
    await room.createRouter();
    rooms.set(roomId, room);
    console.log(`✨ Created new room: ${roomId}`);
  }
  return room;
}

// --- Socket.io Signaling Events ---
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. Join Room
  socket.on('joinRoom', async ({ roomId, name, role }, callback) => {
    try {
      const room = await getOrCreateRoom(roomId);
      
      const peer = new Peer(socket.id, name);
      peer.role = role; // 'admin' or 'student'
      room.addPeer(peer);
      
      socket.join(roomId);
      socket.roomId = roomId;

      // Return RTP Capabilities so client knows what codecs are supported
      callback({
        rtpCapabilities: room.router.rtpCapabilities
      });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  // 2. Get Existing Producers (So I can see people already in the room)
  socket.on('getProducers', (callback) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    // Send back a list of all producer IDs except my own
    const producerList = [];
    room.peers.forEach(peer => {
      if (peer.id !== socket.id) {
        peer.producers.forEach(producer => {
          producerList.push(producer.id);
        });
      }
    });

    callback(producerList);
  });

  // 3. Create WebRTC Transport (For sending OR receiving)
  socket.on('createWebRtcTransport', async ({ consumer }, callback) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    const { transport, params } = await room.createWebRtcTransport(socket.id);
    const peer = room.getPeer(socket.id);
    peer.addTransport(transport);

    callback(params);
  });

  // 4. Connect Transport (DTLS)
  socket.on('transport-connect', async ({ dtlsParameters, transportId }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    await room.connectPeerTransport(socket.id, transportId, dtlsParameters);
  });

  // 5. Produce (Send Video/Audio)
  socket.on('transport-produce', async ({ kind, rtpParameters, appData, transportId }, callback) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    const id = await room.produce(socket.id, transportId, kind, rtpParameters);
    callback({ id });
  });

  // 6. Consume (Receive Video/Audio)
  socket.on('consume', async ({ rtpCapabilities, remoteProducerId, serverConsumerTransportId }, callback) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    try {
      const params = await room.consume(
        socket.id,
        serverConsumerTransportId,
        remoteProducerId,
        rtpCapabilities
      );
      callback(params);
    } catch (error) {
      console.error("Consume error:", error);
      callback({ error: error.message });
    }
  });

  // 7. Resume Consumer (After connection is established)
  socket.on('consumer-resume', async ({ consumerId }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    const peer = room.getPeer(socket.id);
    const consumer = peer.consumers.get(consumerId);
    if (consumer) await consumer.resume();
  });

  // 8. Admin Controls (Mute All)
  socket.on('admin:muteAll', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    // Broadcast event to frontend so React can update state
    socket.to(socket.roomId).emit('action:forceMute');
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.removePeer(socket.id);
        
        // Notify others to remove video tile
        socket.to(socket.roomId).emit('peerClosed', { peerId: socket.id });

        if (room.peers.size === 0) {
          rooms.delete(socket.roomId);
          console.log(`Room ${socket.roomId} closed (empty)`);
        }
      }
    }
  });
});

// --- Start Server ---
async function start() {
  try {
    await runMediasoupWorker();
    httpServer.listen(config.https.listenPort, () => {
      console.log(`🚀 VCV Server listening on port ${config.https.listenPort}`);
      console.log(`🔗 http://${config.domain}:${config.https.listenPort}`);
    });
  } catch (err) {
    console.error(err);
  }
}

start();