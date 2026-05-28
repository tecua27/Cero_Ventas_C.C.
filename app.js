// 1. Mapa de accesos por Identificador de Usuario único
const ACCESS_MAP = {
    "j.tenorio":   ["TODAS"],
    "blanca":      ["TODAS"],
    "julio1":      ["TODAS"],
    "guillo.ca":   ["TODAS"],
    "yara":        ["TODAS"],
    "maria.lui": ["exp att c center 2"],
    "supervisor2": ["exp att c center juarez 701"]
};

let rawSalesData = [];
let salesChartInstance = null;
let currentUser = null; 

// 2. Validación de Usuario de un solo paso
function handleLogin() {
    const userIn = document.getElementById("username").value.trim().toLowerCase();
    const errorMsg = document.getElementById("login-error");

    // Validamos si el string ingresado existe en nuestro mapa de llaves
    if (ACCESS_MAP[userIn]) {
        currentUser = { username: userIn, permisos: ACCESS_MAP[userIn] };
        
        // Transición de pantalla
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("dashboard-screen").style.display = "block";
        document.getElementById("current-user-badge").textContent = `Área: ${userIn.toUpperCase()}`;
        
        // Iniciar carga del JSON local
        loadDashboardData();
    } else {
        errorMsg.style.display = "block";
    }
}

// Escucha del botón Enter en el input de entrada
document.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && document.getElementById("login-screen").style.display !== "none") {
        handleLogin();
    }
});

// 3. Carga asíncrona de datos desde datos.json
function loadDashboardData() {
    fetch('datos.json')
        .then(response => {
            if (!response.ok) throw new Error("Error leyendo datos.json");
            return response.json();
        })
        .then(data => {
            rawSalesData = data;
            buildFilters();
            updateDashboard();
        })
        .catch(error => {
            console.error("Error al inicializar el dashboard:", error);
            alert("Error al cargar datos.json localmente.");
        });
}

// 4. Construcción dinámica de filtros basada en la restricción de área
function buildFilters() {
    const tiendaSelect = document.getElementById("filter-tienda");
    const jefeSelect = document.getElementById("filter-jefe");
    
    const currentTienda = tiendaSelect.value;
    const currentJefe = jefeSelect.value;

    // Reducir la base de datos origen según el permiso del ID ingresado
    const allowedData = currentUser.permisos.includes("TODAS") 
        ? rawSalesData 
        : rawSalesData.filter(d => currentUser.permisos.some(p => d.tienda.toLowerCase().includes(p.toLowerCase())));

    const uniqueTiendas = [...new Set(allowedData.map(d => d.tienda))];
    const filteredForJefes = currentTienda === "ALL" ? allowedData : allowedData.filter(d => d.tienda === currentTienda);
    const uniqueJefes = [...new Set(filteredForJefes.map(d => d.jefe))];

    // Configurar selector de sucursales
    if(tiendaSelect.options.length <= 1) {
        if (!currentUser.permisos.includes("TODAS") && uniqueTiendas.length === 1) {
            tiendaSelect.innerHTML = ""; // Quitar opción global si solo pertenece a una tienda
        } else {
            tiendaSelect.innerHTML = '<option value="ALL">Todas las Tiendas</option>';
        }

        uniqueTiendas.forEach(t => {
            tiendaSelect.add(new Option(t, t));
        });
    }

    // Configurar selector de Jefes
    jefeSelect.innerHTML = '<option value="ALL">Todos los Jefes</option>';
    uniqueJefes.forEach(j => {
        jefeSelect.add(new Option(j, j));
    });

    if (uniqueJefes.includes(currentJefe)) {
        jefeSelect.value = currentJefe;
    }
}

// 5. Actualización de datos y Métricas
function updateDashboard() {
    const tiendaSelect = document.getElementById("filter-tienda");
    const selectedTienda = tiendaSelect.value;
    
    if (event && event.target.id === "filter-tienda") {
        buildFilters();
    }
    
    const selectedJefe = document.getElementById("filter-jefe").value;

    // Segmentar la información visible de raíz según el perfil
    let filteredData = currentUser.permisos.includes("TODAS") 
        ? rawSalesData 
        : rawSalesData.filter(d => currentUser.permisos.some(p => d.tienda.toLowerCase().includes(p.toLowerCase())));

    if (selectedTienda !== "ALL" && selectedTienda !== "") {
        filteredData = filteredData.filter(d => d.tienda === selectedTienda);
    }
    if (selectedJefe !== "ALL") {
        filteredData = filteredData.filter(d => d.jefe === selectedJefe);
    }

    const lowSalesData = filteredData.filter(d => d.ventas <= 6);
    const highSalesData = filteredData.filter(d => d.ventas >= 7);

    document.getElementById("kpi-total").textContent = filteredData.reduce((sum, item) => sum + item.ventas, 0);
    document.getElementById("kpi-alertas").textContent = lowSalesData.length;
    document.getElementById("kpi-tops").textContent = highSalesData.length;

    renderSegmentedTables(lowSalesData, highSalesData);
    renderSmartChart(filteredData, selectedJefe); 
}

// 6. Inyección de filas en las tablas
function renderSegmentedTables(lowData, highData) {
    const tbodyLow = document.getElementById("tbody-low-sales");
    const tbodyHigh = document.getElementById("tbody-high-sales");
    
    tbodyLow.innerHTML = "";
    tbodyHigh.innerHTML = "";

    const sortedLow = [...lowData].sort((a,b) => a.ventas - b.ventas);
    if(sortedLow.length === 0) {
        tbodyLow.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a0aec0;">Sin registros en este rango</td></tr>`;
    } else {
        sortedLow.forEach(item => {
            tbodyLow.innerHTML += `<tr><td><strong>${item.nombre}</strong></td><td>${item.ingreso}</td><td>${item.jefe}</td><td class="badge-danger">${item.ventas}</td></tr>`;
        });
    }

    const sortedHigh = [...highData].sort((a,b) => b.ventas - a.ventas);
    if(sortedHigh.length === 0) {
        tbodyHigh.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a0aec0;">Sin registros en este rango</td></tr>`;
    } else {
        sortedHigh.forEach(item => {
            tbodyHigh.innerHTML += `<tr><td><strong>${item.nombre}</strong></td><td>${item.ingreso}</td><td>${item.jefe}</td><td class="badge-success">${item.ventas}</td></tr>`;
        });
    }
}

// 7. Gráfico Dinámico (Vista Supervisores vs Desglose de Ejecutivos)
function renderSmartChart(data, selectedJefe) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (salesChartInstance) salesChartInstance.destroy();

    let labels = [];
    let chartValues = [];
    let backgroundColors = [];
    let datasetLabel = "";

    if (selectedJefe === "ALL") {
        const bossSalesMap = {};
        data.forEach(item => { bossSalesMap[item.jefe] = (bossSalesMap[item.jefe] || 0) + item.ventas; });

        const sortedBosses = Object.keys(bossSalesMap).map(jefe => {
            return { name: jefe, totalSales: bossSalesMap[jefe] };
        }).sort((a, b) => b.totalSales - a.totalSales);

        labels = sortedBosses.map(b => b.name.split(" ")[0] + " " + (b.name.split(" ")[1] || ""));
        chartValues = sortedBosses.map(b => b.totalSales);
        backgroundColors = Array(sortedBosses.length).fill('rgba(0, 86, 179, 0.8)');
        datasetLabel = 'Ventas Totales por Supervisor';
    } else {
        const sortedExecutives = [...data].sort((a, b) => b.ventas - a.ventas);
        labels = sortedExecutives.map(e => e.nombre.split(" ")[0] + " " + (e.nombre.split(" ")[1] || ""));
        chartValues = sortedExecutives.map(e => e.ventas);
        backgroundColors = sortedExecutives.map(e => {
            if (e.ventas < 6) return 'rgba(229, 62, 98, 0.8)';
            if (e.ventas > 7) return 'rgba(56, 161, 105, 0.8)';
            return 'rgba(160, 174, 192, 0.8)';
        });
        datasetLabel = `Ventas del Equipo de ${selectedJefe.split(" ")[0]}`;
    }

    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: datasetLabel, data: chartValues, backgroundColor: backgroundColors, borderRadius: 4 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { boxWidth: 0 } } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Unidades' }, grid: { color: '#e2e8f0' } },
                x: { ticks: { maxRotation: 45, minRotation: 45 }, grid: { display: false } }
            }
        }
    });
}