export default class Peer {
  constructor(socketId, name) {
    this.id = socketId;
    this.name = name;
    this.transports = new Map(); // For sending/receiving media
    this.producers = new Map();  // Their Mic/Camera
    this.consumers = new Map();  // Streams they are watching
  }

  addTransport(transport) {
    this.transports.set(transport.id, transport);
  }

  getTransport(transportId) {
    return this.transports.get(transportId);
  }

  addProducer(producer) {
    this.producers.set(producer.id, producer);
  }

  getProducer(producerId) {
    return this.producers.get(producerId);
  }

  addConsumer(consumer) {
    this.consumers.set(consumer.id, consumer);
  }

  close() {
    this.transports.forEach(transport => transport.close());
  }
}