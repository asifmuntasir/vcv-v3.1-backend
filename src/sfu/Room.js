import config from '../config'

export default class Room {
  constructor(roomId, worker, io) {
    this.id = roomId;
    this.worker = worker;
    this.io = io; // Socket.io server instance
    this.router = null;
    this.peers = new Map(); // List of all people in the room
  }

  async createRouter() {
    const { mediaCodecs } = config.mediasoup.router;
    this.router = await this.worker.createRouter({ mediaCodecs });
    return this.router;
  }

  addPeer(peer) {
    this.peers.set(peer.id, peer);
  }

  getPeer(socketId) {
    return this.peers.get(socketId);
  }

  removePeer(socketId) {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.close();
      this.peers.delete(socketId);
    }
  }

  // --- WebRTC Logic ---

  async createWebRtcTransport(socketId) {
    const { maxIncomingBitrate, initialAvailableOutgoingBitrate } = config.mediasoup.webRtcTransport;

    const transport = await this.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    });

    if (maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(maxIncomingBitrate);
      } catch (error) {
        console.error('Error setting max bitrate', error);
      }
    }

    return {
      transport,
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  // Connect the transport (DTLS handshake)
  async connectPeerTransport(socketId, transportId, dtlsParameters) {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    const transport = peer.getTransport(transportId);
    if (transport) {
      await transport.connect({ dtlsParameters });
    }
  }

  // Allow a peer to send video (Produce)
  async produce(socketId, transportId, kind, rtpParameters) {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    const transport = peer.getTransport(transportId);
    
    const producer = await transport.produce({ kind, rtpParameters });
    peer.addProducer(producer);

    // Broadcast to everyone else: "New User is sending video!"
    this.broadcast(socketId, 'newProducer', {
      producerId: producer.id,
      producerSocketId: socketId,
    });

    return producer.id;
  }

  // Allow a peer to watch video (Consume)
  async consume(socketId, consumerTransportId, producerId, rtpCapabilities) {
    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      console.warn('Cannot consume this producer');
      return;
    }

    const peer = this.peers.get(socketId);
    const transport = peer.getTransport(consumerTransportId);

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Start paused, then resume
    });

    peer.addConsumer(consumer);

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  broadcast(senderSocketId, event, data) {
    this.peers.forEach((peer) => {
      if (peer.id !== senderSocketId) {
        // Send to specific socket via IO
        this.io.to(peer.id).emit(event, data);
      }
    });
  }
}