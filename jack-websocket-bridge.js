#!/usr/bin/env node

/**
 * rmix-BAE WebSocket Bridge
 *
 * Receives audio samples from browser collectors via WebSocket
 * and outputs them to JACK audio server.
 *
 * Usage: node jack-websocket-bridge.js [options]
 * Options:
 *   --port <number>       WebSocket port (default: 9001)
 *   --samplerate <number> JACK sample rate (default: 48000)
 *   --channels <number>   Number of collectors (default: 2)
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');

// Configuration
const config = {
    wsPort: 9001,
    sampleRate: 48000,
    channels: 2,
    bufferSize: 128,
    clientName: 'rmix-brane'
};

// Parse command line arguments
process.argv.forEach((arg, i) => {
    if (arg === '--port' && process.argv[i + 1]) {
        config.wsPort = parseInt(process.argv[i + 1]);
    }
    if (arg === '--samplerate' && process.argv[i + 1]) {
        config.sampleRate = parseInt(process.argv[i + 1]);
    }
    if (arg === '--channels' && process.argv[i + 1]) {
        config.channels = parseInt(process.argv[i + 1]);
    }
});

console.log('🌊 rmix-BAE WebSocket-to-JACK Bridge');
console.log('=====================================');
console.log(`WebSocket Port: ${config.wsPort}`);
console.log(`Sample Rate: ${config.sampleRate} Hz`);
console.log(`Channels: ${config.channels}`);
console.log('');

// Create WebSocket server
const wss = new WebSocket.Server({ port: config.wsPort });

let connectedClient = null;
let sampleCount = 0;
let lastLogTime = Date.now();

wss.on('connection', (ws) => {
    console.log('✅ Browser connected');
    connectedClient = ws;

    ws.on('message', (data) => {
        // Receive Float32Array from browser
        const samples = new Float32Array(data.buffer || data);

        sampleCount += samples.length;

        // Log stats every second
        const now = Date.now();
        if (now - lastLogTime > 1000) {
            const samplesPerSecond = sampleCount;
            const fps = samplesPerSecond / config.channels;
            console.log(`📊 Receiving: ${samplesPerSecond} samples/sec (~${fps.toFixed(1)} fps), ${config.channels} collectors`);

            // Show sample values for debugging
            if (samples.length > 0) {
                const levels = Array.from(samples).map(s => s.toFixed(3));
                console.log(`   Sample values: [${levels.join(', ')}]`);
            }

            sampleCount = 0;
            lastLogTime = now;
        }

        // TODO: Send to JACK
        // For now, just log that we're receiving data
    });

    ws.on('close', () => {
        console.log('❌ Browser disconnected');
        connectedClient = null;
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

console.log(`🎧 Waiting for browser connection on ws://localhost:${config.wsPort}`);
console.log('');
console.log('Next steps:');
console.log('1. Open brane-with-collectors-websocket.html in browser');
console.log('2. Press D for demo mode');
console.log('3. Press O to connect WebSocket output');
console.log('4. Watch for samples arriving here');
console.log('');
console.log('Press Ctrl+C to stop');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...');
    wss.close();
    process.exit(0);
});
