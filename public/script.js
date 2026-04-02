let chart;
let socket = null;


// =============================
// 🔴 LIVE MONITORING
// =============================
function startLiveMonitoring() {

    if (socket) {
        alert("Live monitoring already running!");
        return;
    }

    socket = io();

    socket.on('connect', () => {
        console.log("Connected to live server");
    });

    socket.on('update', (data) => {
        console.log("LIVE DATA:", data);

        const formattedData = {
            protocols: data.protocols || {},
            top_ips: getTopIPs(data.ipCount || {}),
            alerts: data.alerts || {}
        };

        updateDashboard(formattedData);
    });

    socket.on('disconnect', () => {
        console.log("Disconnected from live server");
    });

    alert("✅ Live Monitoring Started");
}


// =============================
// 📁 CSV UPLOAD
// =============================
async function uploadFile() {

    // Stop live mode if running
    if (socket) {
        socket.disconnect();
        socket = null;
        alert("Live monitoring stopped. Showing CSV data.");
    }

    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a CSV file!");
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            throw new Error("Server error");
        }

        const data = await res.json();

        console.log("UPLOAD DATA:", data);

        if (data.error) {
            alert("Error: " + data.error);
            return;
        }

        updateDashboard(data);

    } catch (err) {
        console.error("Upload failed:", err);
        alert("Upload failed! Check backend.");
    }
}


// =============================
// 🧠 UPDATE DASHBOARD
// =============================
function updateDashboard(data) {

    // Safe access (avoid null errors)
    const protocolEl = document.getElementById('protocolCount');
    const topIPEl = document.getElementById('topIP');
    const alertCountEl = document.getElementById('alertCount');
    const alertsDiv = document.getElementById('alerts');
    const chartCanvas = document.getElementById('protocolChart');

    // =============================
    // 📊 CARDS
    // =============================

    if (protocolEl) {
        protocolEl.innerText = Object.keys(data.protocols).length;
    }

    if (topIPEl) {
        const [topIP, count] = Object.entries(data.top_ips)[0] || ["-", 0];
        topIPEl.innerText = `${topIP} (${count})`;
    }

    if (alertCountEl) {
        alertCountEl.innerText = Object.keys(data.alerts).length;
    }


    // =============================
    // 🚨 ALERTS
    // =============================

    if (alertsDiv) {
        let alertHTML = "";

        if (Object.keys(data.alerts).length === 0) {
            alertHTML = `<p style="color:lime;">✅ No attacks detected</p>`;
        } else {
            for (let ip in data.alerts) {
                alertHTML += `
                    <div class="alert-item">
                        🚨 ${data.alerts[ip]} from ${ip}
                    </div>
                `;
            }
        }

        alertsDiv.innerHTML = alertHTML;
    }


    // =============================
    // 📈 CHART
    // =============================

    if (!chartCanvas) return;

    const labels = Object.keys(data.protocols);
    const values = Object.values(data.protocols);

    // Destroy old chart
    if (chart) {
        chart.destroy();
    }

    chart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Protocol Usage',
                data: values,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: 'white'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: 'white' }
                },
                y: {
                    ticks: { color: 'white' }
                }
            }
        }
    });
}


// =============================
// 🔧 HELPER: TOP IPs
// =============================
function getTopIPs(ipCount) {

    const sorted = Object.entries(ipCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    let result = {};

    sorted.forEach(([ip, count]) => {
        result[ip] = count;
    });

    return result;
}