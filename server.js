const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve frontend
app.use(express.static('public'));

// File upload config
const upload = multer({ dest: 'uploads/' });


// =============================
// 🔴 LIVE MONITORING (TShark)
// =============================
let ipCount = {};
let protocolCount = {};
let scanMap = {};

const tshark = spawn(
    '"C:\\Program Files\\Wireshark\\tshark.exe"',
    [
        '-i', '1', // ⚠️ change if needed
        '-T', 'fields',
        '-e', 'ip.src',
        '-e', 'ip.dst',
        '-e', '_ws.col.Protocol'
    ],
    { shell: true }
);

// Prevent crash if tshark fails
tshark.on('error', (err) => {
    console.error("TShark error:", err.message);
});

// Read live packets
tshark.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');

    lines.forEach(line => {
        const [src, dst, protocol] = line.split('\t');

        if (!src || !protocol) return;

        // Count IPs
        ipCount[src] = (ipCount[src] || 0) + 1;

        // Count protocols
        protocolCount[protocol] = (protocolCount[protocol] || 0) + 1;

        // Track destinations
        if (!scanMap[src]) scanMap[src] = new Set();
        if (dst) scanMap[src].add(dst);
    });
});


// Send live updates every 2 sec
setInterval(() => {

    let attacks = detectAttacks(ipCount, scanMap);

    io.emit('update', {
        protocols: protocolCount,
        ipCount: ipCount,
        alerts: attacks
    });

}, 2000);


// =============================
// 📁 CSV UPLOAD ROUTE
// =============================
app.post('/upload', upload.single('file'), (req, res) => {

    let protocolCount = {};
    let ipCount = {};
    let scanMap = {};

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {

            let protocol = row.Protocol;
            let source = row.Source;
            let destination = row.Destination;

            if (!protocol || !source) return;

            // Count protocols
            protocolCount[protocol] = (protocolCount[protocol] || 0) + 1;

            // Count IPs
            ipCount[source] = (ipCount[source] || 0) + 1;

            // Track scan
            if (!scanMap[source]) scanMap[source] = new Set();
            if (destination) scanMap[source].add(destination);
        })
        .on('end', () => {

            let attacks = detectAttacks(ipCount, scanMap);

            // Top IPs
            let sorted = Object.entries(ipCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            let topIPs = {};
            sorted.forEach(([ip, count]) => {
                topIPs[ip] = count;
            });

            res.json({
                protocols: protocolCount,
                top_ips: topIPs,
                alerts: attacks
            });

            // Delete uploaded file (cleanup)
            fs.unlinkSync(req.file.path);
        })
        .on('error', (err) => {
            console.error("CSV Error:", err);
            res.status(500).json({ error: "CSV parsing failed" });
        });
});


// =============================
// 🧠 ATTACK DETECTION FUNCTION
// =============================
function detectAttacks(ipCount, scanMap) {

    let attacks = {};

    // DoS
    for (let ip in ipCount) {
        if (ipCount[ip] > 200) {
            attacks[ip] = "DoS Attack";
        }
    }

    // Brute Force
    for (let ip in ipCount) {
        if (ipCount[ip] > 100 && ipCount[ip] <= 200) {
            attacks[ip] = "Brute Force";
        }
    }

    // Port Scan
    for (let ip in scanMap) {
        if (scanMap[ip].size > 50) {
            attacks[ip] = "Port Scan";
        }
    }

    return attacks;
}


// =============================
// 🔌 SOCKET CONNECTION
// =============================
io.on('connection', (socket) => {
    console.log("Client connected");
});


// =============================
// 🚀 START SERVER
// =============================
server.listen(5000, () => {
    console.log("🔥 Server running on http://localhost:5000");
});