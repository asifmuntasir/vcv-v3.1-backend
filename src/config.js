import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Manually reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  // server settings
  domain: process.env.DOMAIN || 'localhost',
  https: {
    listenPort: process.env.PORT || 4000,
    tls: {
      // Adjusted path: ../../ goes up from src/config -> src -> root
      cert: process.env.TLS_CERT || path.join(__dirname, '../../certs/privkey.pem'),
      key: process.env.TLS_KEY || path.join(__dirname, '../../certs/fullchain.pem'),
    }
  },
  
  // mediasoup settings
  mediasoup: {
    // Number of mediasoup workers to launch.
    numWorkers: Object.keys(os.cpus()).length,
    
    // mediasoup Worker settings.
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
      ],
    },
    
    // mediasoup Router settings.
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000
          }
        },
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000
          }
        }
      ]
    },
    
    // mediasoup WebRtcTransport settings
    webRtcTransport: {
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1' 
        }
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
      maxIncomingBitrate: 1500000
    }
  }
};