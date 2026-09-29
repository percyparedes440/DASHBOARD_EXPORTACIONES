const SUPABASE_URL = "https://lbkccbleirtyrsydqsdp.supabase.co";
const SUPABASE_KEY = "sb_publishable_XPE6TpfX2lnNDXPlkCBfcQ_8jj0hQBN";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

Chart.register(ChartDataLabels);
Chart.defaults.plugins.datalabels = {
  color: "#156082",
  font: { family: "Inter", size: 10, weight: "600" },
  anchor: "end",
  align: "end",
  offset: 2,
  clamp: true,
};

let dataGlobal = [];
let dataBackup = [];
let charts = {};

let reporteMatriz = [];
let seccionActual = "dashboard";

const COLORS = {
  primary: "#3A82C8",
  primaryLight: "#A6CAEC",
  primaryDark: "#156082",
  green: "#397940",
  orange: "#F26F2B",
  textDim: "#5A7A8F",
};

const PALETTE_DONUT = [
  COLORS.primary,
  COLORS.primaryLight,
  COLORS.primaryDark,
  COLORS.green,
  COLORS.orange,
];

document.getElementById("fechaActual").textContent =
  new Date().toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });

// ============ CARGA ============
async function cargarDatos() {
  try {
    const { data, error } = await supabaseClient
      .from("REPORTE DE EXPORTACIONES")
      .select("*")
      .eq("sheet_name", "BD")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    dataGlobal = data.data;
    dataBackup = data.data;
    document.getElementById("sheetName").textContent = "Pestaña: " + data.sheet_name;

    const { data: dataReporte } = await supabaseClient
      .from("REPORTE DE EXPORTACIONES")
      .select("data")
      .eq("sheet_name", "REPORTE DIARIO")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (dataReporte) reporteMatriz = dataReporte.data;

    document.getElementById("loading").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    calcularKPIs();
    cargarFiltros();
    crearGraficos();
    crearTablas();

    document.getElementById("dashTabs").style.display = "flex";
    document.getElementById("fechaActualReporte").textContent =
      new Date().toLocaleDateString("es-PE", {
        day: "2-digit", month: "short", year: "numeric",
      });

    document.querySelectorAll("#dashTabs .tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        cambiarSeccion(tab.dataset.seccion);
      });
    });

    renderReporteDiario();
  } catch (err) {
    document.getElementById("loading").innerHTML = `
            <p style="color:#F26F2B;">No hay datos disponibles.</p>
            <p style="color:#5A7A8F;margin-top:10px;">Sube un Excel desde el index.html.</p>
        `;
    console.error(err);
  }
}

// ============ HELPERS ============
function col(clave) {
  if (dataGlobal.length === 0) return null;
  const keys = Object.keys(dataGlobal[0]);
  return keys.find(k => k.trim().toLowerCase() === clave.trim().toLowerCase());
}
function norm(v) { return v !== undefined && v !== null ? v.toString().trim() : ""; }
function num(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  return parseFloat(v.toString().replace(/[^0-9.-]/g, "")) || 0;
}
function moneyUSD(v) { return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function moneySoles(v) { return "S/ " + v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function ordenarMeses(labels) {
  const orden = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SETIEMBRE","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
  return labels.sort((a, b) => orden.indexOf(a.toUpperCase()) - orden.indexOf(b.toUpperCase()));
}
function abreviar(v) {
  const n = Number(v);
  if (isNaN(n)) return v;
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toString();
}

// ============ RENDERIZADORES ============
function tooltipStyle() {
  return { backgroundColor: "#156082", titleColor: "#FFFFFF", bodyColor: "#FFFFFF", borderColor: "#3A82C8", borderWidth: 1, padding: 12, cornerRadius: 8 };
}

function renderLine(id, labels, data, color) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ data, borderColor: color || COLORS.primary, backgroundColor: "rgba(58, 130, 200, 0.1)", borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: color || COLORS.primary, pointBorderColor: "#FFFFFF", pointBorderWidth: 2, pointRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 30 } },
      plugins: {
        legend: { display: false }, tooltip: tooltipStyle(),
        datalabels: { display: true, align: (ctx) => ctx.dataIndex === 0 ? "right" : "top", anchor: (ctx) => ctx.dataIndex === 0 ? "start" : "end", offset: (ctx) => ctx.dataIndex === 0 ? 6 : 4, color: "#156082", font: { family: "Inter", size: 10, weight: "600" }, formatter: (v) => Number(v).toLocaleString("es-PE") }
      },
      scales: {
        x: { ticks: { color: COLORS.textDim, font: { family: "Inter", size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: COLORS.textDim, callback: (v) => abreviar(v) }, grid: { color: "rgba(214, 228, 240, 0.5)" } }
      }
    }
  });
}

function renderBar(id, labels, data, color) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: color || COLORS.primary, borderRadius: 6, borderSkipped: false, barThickness: 24 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle(), datalabels: { anchor: "end", align: "top", formatter: (v) => Number(v).toLocaleString("es-PE") } },
      scales: { x: { ticks: { color: COLORS.textDim, font: { family: "Inter", size: 10 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: COLORS.textDim }, grid: { color: "rgba(214, 228, 240, 0.5)" } } }
    }
  });
}

function renderHBar(id, labels, data, color) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: color || COLORS.primary, borderRadius: 6, borderSkipped: false, barThickness: 16 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle(), datalabels: { anchor: "end", align: "right", formatter: (v) => Number(v).toLocaleString("es-PE") } },
      scales: { x: { ticks: { color: COLORS.textDim, font: { family: "Inter", size: 10 } }, grid: { color: "rgba(214, 228, 240, 0.5)" } }, y: { ticks: { color: COLORS.primaryDark, font: { family: "Inter", size: 10 } }, grid: { display: false } } }
    }
  });
}

function renderDoughnut(id, labels, data) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: PALETTE_DONUT.slice(0, labels.length), borderColor: "#FFFFFF", borderWidth: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { color: COLORS.textDim, font: { family: "Inter", size: 11 }, padding: 12, usePointStyle: true, boxWidth: 8 } },
        tooltip: tooltipStyle(),
        datalabels: { color: "#FFFFFF", anchor: "center", align: "center", formatter: (v, ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + Number(b), 0); const pct = total > 0 ? (Number(v) / total) * 100 : 0; return pct >= 4 ? Number(v).toLocaleString("es-PE") : ""; } }
      }
    }
  });
}

function renderCombo(id, labels, barDataUSD, barDataSoles, lineData, barColor, barColor2, lineColor) {
  const ctx = document.getElementById(id); if (!ctx) return;
  if (charts[id]) charts[id].destroy();

  const maxVal = Math.max(...barDataUSD, ...barDataSoles);

  charts[id] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar", label: "Venta USD", data: barDataUSD, backgroundColor: barColor,
          borderRadius: 6, borderSkipped: false, yAxisID: "y", order: 2,
barPercentage: 0.9, categoryPercentage: 0.8        },
        {
          type: "bar", label: "Venta S/", data: barDataSoles, backgroundColor: barColor2,
          borderRadius: 6, borderSkipped: false, yAxisID: "y", order: 2,
barPercentage: 0.9, categoryPercentage: 0.8        },
        {
          type: "line", label: "Despachos", data: lineData, borderColor: lineColor,
          backgroundColor: lineColor, borderWidth: 3, tension: 0.4,
          pointBackgroundColor: lineColor, pointBorderColor: "#FFFFFF",
          pointBorderWidth: 2, pointRadius: 5, yAxisID: "y1", order: 1
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: COLORS.textDim, font: { family: "Inter", size: 11 }, usePointStyle: true, boxWidth: 8 } },
        tooltip: tooltipStyle(),
        datalabels: {
          display: true,
          anchor: "end",
          align: "top",
          offset: 4,
          color: (ctx) => {
            if (ctx.dataset.type === "line") return "#000000";
            if (ctx.dataset.label === "Venta S/") return "#397940";
            return "#156082";
          },
          font: { family: "Inter", size: 10, weight: "700" },
          formatter: (v, ctx) => {
            const valor = Number(v).toLocaleString("es-PE");
            if (ctx.dataset.type === "line") return valor;
            if (ctx.dataset.label === "Venta USD") return "$" + valor;
            if (ctx.dataset.label === "Venta S/") return "S/ " + valor;
            return valor;
          }
        }
      },
      scales: {
        x: { ticks: { color: COLORS.textDim, font: { family: "Inter", size: 10 } }, grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          ticks: { color: COLORS.textDim, callback: (v) => abreviar(v) },
          grid: { color: COLORS.gridColor },
          suggestedMax: maxVal * 1.15
        },
        y1: { beginAtZero: true, position: "right", ticks: { color: COLORS.primaryDark }, grid: { display: false } }
      }
    }
  });
}

// ============ KPIs ============
function calcularKPIs() {
  const cDespacho = col("CANTIDAD DE DESPACHOS") || col("CANT_DESPACHOS");
  const cVolumen = col("VOLUMEN M3");
  const cUSD = col("VALOR DE_VENTA_$") || col("VALOR DE VENTA_$");
  const cSoles = col("VALOR DE_VENTA_S/.") || col("VALOR DE VENTA_S/.");
  const cPais = col("COUNTRY");
  const cCliente = col("NOMBRE_CLIENTE");

  let despachos = 0, volumen = 0, usd = 0, soles = 0;
  const paises = new Set(), clientes = new Set();

  dataGlobal.forEach((f) => {
    despachos += num(f[cDespacho]);
    volumen += num(f[cVolumen]);
    usd += num(f[cUSD]);
    soles += num(f[cSoles]);
    if (f[cPais]) paises.add(norm(f[cPais]));
    if (f[cCliente]) clientes.add(norm(f[cCliente]));
  });

  document.getElementById("kpiRow").innerHTML = `
        <div class="kpi-card"><div class="kpi-icon-circle"><i class="fas fa-boxes-stacked"></i></div>
            <div class="kpi-content"><span class="kpi-title">Despachos</span><span class="kpi-main">${despachos}</span><span class="kpi-trend">Total</span></div></div>
        <div class="kpi-card"><div class="kpi-icon-circle icon-cyan"><i class="fas fa-cube"></i></div>
            <div class="kpi-content"><span class="kpi-title">Volumen m³</span><span class="kpi-main">${volumen.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span><span class="kpi-trend">Total</span></div></div>
        <div class="kpi-card"><div class="kpi-icon-circle icon-green"><i class="fas fa-dollar-sign"></i></div>
            <div class="kpi-content"><span class="kpi-title">Venta USD</span><span class="kpi-main">${moneyUSD(usd)}</span><span class="kpi-trend">Total</span></div></div>
        <div class="kpi-card"><div class="kpi-icon-circle icon-orange"><i class="fas fa-coins"></i></div>
            <div class="kpi-content"><span class="kpi-title">Venta S/</span><span class="kpi-main">${moneySoles(soles)}</span><span class="kpi-trend">Total</span></div></div>
        <div class="kpi-card"><div class="kpi-icon-circle icon-cyan"><i class="fas fa-globe"></i></div>
            <div class="kpi-content"><span class="kpi-title">Países</span><span class="kpi-main">${paises.size}</span><span class="kpi-trend">Destinos</span></div></div>
        <div class="kpi-card"><div class="kpi-icon-circle icon-green"><i class="fas fa-users"></i></div>
            <div class="kpi-content"><span class="kpi-title">Clientes</span><span class="kpi-main">${clientes.size}</span><span class="kpi-trend">Únicos</span></div></div>
    `;

  const center = document.getElementById("centerTotal");
  if (center) center.textContent = despachos;
}

// ============ DROPDOWN CUSTOM ============
function inicializarDropdown(id, placeholder) {
  const cont = document.getElementById(id);
  if (!cont) return;
  const trigger = cont.querySelector(".custom-select-trigger");
  const label = cont.querySelector(".custom-select-label");
  const optsCont = cont.querySelector(".custom-select-options");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".custom-select.open").forEach(c => { if (c !== cont) c.classList.remove("open"); });
    cont.classList.toggle("open");
  });

  cont.setOptions = (valores) => {
    optsCont.innerHTML = "";
    const optTodos = document.createElement("div");
    optTodos.className = "custom-option" + (cont.dataset.value === "" ? " selected" : "");
    optTodos.textContent = placeholder;
    optTodos.dataset.value = "";
    optTodos.addEventListener("click", () => seleccionar(cont, label, placeholder, ""));
    optsCont.appendChild(optTodos);

    valores.forEach(v => {
      const opt = document.createElement("div");
      opt.className = "custom-option" + (cont.dataset.value === v ? " selected" : "");
      opt.textContent = v;
      opt.dataset.value = v;
      opt.addEventListener("click", () => seleccionar(cont, label, placeholder, v));
      optsCont.appendChild(opt);
    });
  };
}

function seleccionar(cont, label, placeholder, valor) {
  cont.dataset.value = valor;
  label.textContent = valor || placeholder;
  cont.classList.remove("open");
  cont.querySelectorAll(".custom-option").forEach(o => o.classList.toggle("selected", o.dataset.value === valor));
  aplicarFiltros();
}

document.addEventListener("click", () => {
  document.querySelectorAll(".custom-select.open").forEach(c => c.classList.remove("open"));
});

// ============ FILTROS ============
function cargarFiltros() {
  inicializarDropdown("csMes", "Mes");
  inicializarDropdown("csSemana", "Semana");
  inicializarDropdown("csUnidad", "Tipo Unidad");
  inicializarDropdown("csPais", "País");
  inicializarDropdown("csIncoterm", "Incoterm");

  const val = (columna) => [...new Set(dataBackup.map(f => norm(f[col(columna)])).filter(v => v !== ""))].sort();

  const ordenMeses = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SETIEMBRE","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
const meses = [...new Set(dataBackup.map(f => norm(f[col("MES")])).filter(v => v !== ""))];
meses.sort((a, b) => ordenMeses.indexOf(a.toUpperCase()) - ordenMeses.indexOf(b.toUpperCase()));
document.getElementById("csMes").setOptions(meses);
  document.getElementById("csSemana").setOptions(val("SEMANA"));
  document.getElementById("csUnidad").setOptions(val("TIPO DE UNIDAD"));
  document.getElementById("csPais").setOptions(val("COUNTRY"));
  document.getElementById("csIncoterm").setOptions(val("INCOTERMS"));
}

function aplicarFiltros() {
  const fecha = document.getElementById("filterFecha")?.value || "";
  const mes = document.getElementById("csMes")?.dataset.value || "";
  const semana = document.getElementById("csSemana")?.dataset.value || "";
  const unidad = document.getElementById("csUnidad")?.dataset.value || "";
  const pais = document.getElementById("csPais")?.dataset.value || "";
  const incoterm = document.getElementById("csIncoterm")?.dataset.value || "";

  const cFecha = col("FECHA_TRANSACCION");
  const cMes = col("MES");
  const cSem = col("SEMANA");
  const cUni = col("TIPO DE UNIDAD");
  const cPais = col("COUNTRY");
  const cInc = col("INCOTERMS");

  const backup = dataGlobal;
  dataGlobal = backup.filter((f) => {
    if (fecha) {
      const fechaFila = norm(f[cFecha]).split(" ")[0];
      if (fechaFila !== fecha) return false;
    }
    if (mes && norm(f[cMes]) !== mes) return false;
    if (semana && norm(f[cSem]) !== semana) return false;
    if (unidad && norm(f[cUni]) !== unidad) return false;
    if (pais && norm(f[cPais]) !== pais) return false;
    if (incoterm && norm(f[cInc]) !== incoterm) return false;
    return true;
  });

  calcularKPIs();
  crearGraficos();
  crearTablas();
  dataGlobal = backup;
}

// ============ GRÁFICOS ============
function crearGraficos() {
  const cMes = col("MES");
  const cSem = col("SEMANA");
  const cUSD = col("VALOR DE_VENTA_$") || col("VALOR DE VENTA_$");
  const cVol = col("VOLUMEN M3");
  const cDesp = col("CANTIDAD DE DESPACHOS") || col("CANT_DESPACHOS");
  const cTransp = col("TRANSPORTE");
  const cUni = col("TIPO DE UNIDAD");
  const cPais = col("COUNTRY");
  const cInc = col("INCOTERMS");
  const cSoles = col("VALOR DE_VENTA_S/.") || col("VALOR DE VENTA_S/.");

  // 1. Facturación por mes (ESTÁTICO)
  const porMesUSD = {};
  dataBackup.forEach((f) => {
    const m = norm(f[cMes]) || "Sin mes";
    porMesUSD[m] = (porMesUSD[m] || 0) + num(f[cUSD]);
  });
  const mesesOrdenados = ordenarMeses(Object.keys(porMesUSD));
  renderLine("chartFactMes", mesesOrdenados, mesesOrdenados.map((m) => porMesUSD[m]), COLORS.primary);

  // 2. Despachos por mes (ESTÁTICO)
  const porMesDesp = {};
  dataBackup.forEach((f) => {
    const m = norm(f[cMes]) || "Sin mes";
    porMesDesp[m] = (porMesDesp[m] || 0) + num(f[cDesp]);
  });
  renderLine("chartDespMes", mesesOrdenados, mesesOrdenados.map((m) => porMesDesp[m]), COLORS.primaryDark);

  // 3. Volumen por mes (ESTÁTICO)
  const porMesVol = {};
  dataBackup.forEach((f) => {
    const m = norm(f[cMes]) || "Sin mes";
    porMesVol[m] = (porMesVol[m] || 0) + num(f[cVol]);
  });
  renderLine("chartVolMes", mesesOrdenados, mesesOrdenados.map((m) => porMesVol[m]), COLORS.green);

  // 4. Despachos por semana
  const porSemana = {};
  dataGlobal.forEach((f) => {
    const s = norm(f[cSem]) || "Sin semana";
    porSemana[s] = (porSemana[s] || 0) + num(f[cDesp]);
  });
  const semanasOrdenadas = Object.keys(porSemana).sort();
  renderLine("chartDespSem", semanasOrdenadas, semanasOrdenadas.map((s) => porSemana[s]), COLORS.orange);

  // 5. Transporte (anillo)
  const porTransp = {};
  dataGlobal.forEach((f) => {
    const t = norm(f[cTransp]) || "Sin transporte";
    porTransp[t] = (porTransp[t] || 0) + num(f[cDesp]);
  });
  renderDoughnut("chartTransporte", Object.keys(porTransp), Object.values(porTransp));

  // 6. Tipo de unidad (anillo)
  const porUni = {};
  dataGlobal.forEach((f) => {
    const u = norm(f[cUni]) || "Sin tipo";
    porUni[u] = (porUni[u] || 0) + num(f[cDesp]);
  });
  renderDoughnut("chartTipoUnidad", Object.keys(porUni), Object.values(porUni));

  // 7. País (combo)
    const porPaisUSD = {}, porPaisSoles = {}, porPaisDesp = {};
  dataGlobal.forEach((f) => {
    const p = norm(f[cPais]) || "Sin país";
    porPaisUSD[p] = (porPaisUSD[p] || 0) + num(f[cUSD]);
    porPaisSoles[p] = (porPaisSoles[p] || 0) + num(f[cSoles]);
    porPaisDesp[p] = (porPaisDesp[p] || 0) + num(f[cDesp]);
  });
  const paisesArr = Object.keys(porPaisUSD).sort((a, b) => porPaisUSD[b] - porPaisUSD[a]).slice(0, 10);
  renderCombo("chartPais", paisesArr, paisesArr.map((p) => porPaisUSD[p]), paisesArr.map((p) => porPaisSoles[p]), paisesArr.map((p) => porPaisDesp[p]), COLORS.primary, COLORS.green, COLORS.orange);

  // 8. Incoterm (combo)
    const porIncUSD = {}, porIncSoles = {}, porIncDesp = {};
  dataGlobal.forEach((f) => {
    const i = norm(f[cInc]) || "Sin incoterm";
    porIncUSD[i] = (porIncUSD[i] || 0) + num(f[cUSD]);
    porIncSoles[i] = (porIncSoles[i] || 0) + num(f[cSoles]);
    porIncDesp[i] = (porIncDesp[i] || 0) + num(f[cDesp]);
  });
  const incArr = Object.keys(porIncUSD).sort((a, b) => porIncUSD[b] - porIncUSD[a]);
  renderCombo("chartIncoterm", incArr, incArr.map((i) => porIncUSD[i]), incArr.map((i) => porIncSoles[i]), incArr.map((i) => porIncDesp[i]), COLORS.primaryDark, COLORS.green, COLORS.orange);
}

// ============ TABLAS ============
function crearTablas() {
  const cCliente = col("NOMBRE_CLIENTE");
  const cUSD = col("VALOR DE_VENTA_$") || col("VALOR DE VENTA_$");
  const cSoles = col("VALOR DE_VENTA_S/.") || col("VALOR DE VENTA_S/.");
  const cDesp = col("CANTIDAD DE DESPACHOS") || col("CANT_DESPACHOS");

  const porCliente = {};
  dataGlobal.forEach((f) => {
    const c = norm(f[cCliente]) || "Sin cliente";
    if (!porCliente[c]) porCliente[c] = { usd: 0, soles: 0, desp: 0 };
    porCliente[c].usd += num(f[cUSD]);
    porCliente[c].soles += num(f[cSoles]);
    porCliente[c].desp += num(f[cDesp]);
  });

  const clientesArr = Object.entries(porCliente).sort((a, b) => b[1].usd - a[1].usd);
  const top5 = clientesArr.slice(0, 5);
  const bottom5 = clientesArr.filter((c) => c[1].usd > 0).slice(-5).reverse();

  document.getElementById("tablaTopClientes").innerHTML = generarTablaHTML(top5);
  document.getElementById("tablaBottomClientes").innerHTML = generarTablaHTML(bottom5);
}

function generarTablaHTML(arr) {
  let html = "<table><thead><tr><th>Cliente</th><th>Venta $</th><th>Venta S/</th><th>Desp.</th></tr></thead><tbody>";
  arr.forEach(([nombre, d]) => {
    html += `<tr><td>${nombre.substring(0, 35)}</td><td>${moneyUSD(d.usd)}</td><td>${moneySoles(d.soles)}</td><td>${d.desp}</td></tr>`;
  });
  html += "</tbody></table>";
  return html;
}

// ============ LIMPIAR ============
document.getElementById("clearFilters")?.addEventListener("click", () => {
  ["csMes", "csSemana", "csUnidad", "csPais", "csIncoterm"].forEach(id => {
    const cont = document.getElementById(id);
    if (!cont) return;
    cont.dataset.value = "";
    const label = cont.querySelector(".custom-select-label");
    const placeholder = id === "csMes" ? "Mes"
      : id === "csSemana" ? "Semana"
      : id === "csUnidad" ? "Tipo Unidad"
      : id === "csPais" ? "País"
      : "Incoterm";
    label.textContent = placeholder;
    cont.querySelectorAll(".custom-option").forEach(o => o.classList.toggle("selected", o.dataset.value === ""));
  });
  const fechaInput = document.getElementById("filterFecha");
  if (fechaInput) fechaInput.value = "";
  aplicarFiltros();
});

// ============ NAVEGACIÓN ============
function cambiarSeccion(seccion) {
  seccionActual = seccion;
  document.querySelectorAll("#dashTabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.seccion === seccion));
  document.getElementById("dashboard").style.display = seccion === "dashboard" ? "block" : "none";
  document.getElementById("reporte").style.display = seccion === "reporte" ? "block" : "none";
}

// ============ REPORTE DIARIO ============
function renderReporteDiario() {
  if (!reporteMatriz || reporteMatriz.length === 0) {
    document.getElementById("tablaReporteDiario").innerHTML = "<p style='color:#5A7A8F;'>No hay datos de Reporte Diario.</p>";
    document.getElementById("tablaAcumulados").innerHTML = "";
    return;
  }

  calcularKPIsDia();

  // TABLA 1: Detalle por País / Cliente (B8:H, hasta encontrar PAÍS vacío)
    // TABLA 1: Detalle por País / Cliente
  const t1 = [];
  const enc = reporteMatriz[6] || [];
  t1.push([enc[0], enc[1], enc[2], enc[3], enc[4], enc[5], enc[6]]);

  let f = 7;
  while (true) {
    const fila = reporteMatriz[f] || [];
    const pais = (fila[0] || "").toString().trim();
    if (pais === "" || pais.toUpperCase() === "TOTAL GENERAL") break;
    t1.push([fila[0], fila[1], fila[2], fila[3], fila[4], fila[5], fila[6]]);
    f++;
  }

  document.getElementById("tablaReporteDiario").innerHTML = generarTablaExcel(t1, true);

  // TABLA 2: Datos Acumulados
  const t2 = [];
  for (let f = 11; f <= 16; f++) {
    const fila = reporteMatriz[f] || [];
    t2.push([fila[7], fila[8]]);
  }
  document.getElementById("tablaAcumulados").innerHTML = generarTablaExcel(t2, true);

  renderPaisReporte();
  renderIncotermReporte();
  renderSemanaReporte();
}

function generarTablaExcel(matriz, conHeader) {
  if (!matriz || matriz.length === 0) return "";
  let html = "<table class='tabla-excel'><tbody>";
  matriz.forEach((fila, i) => {
    const esHeader = conHeader && i === 0;
    html += "<tr>";
    fila.forEach((celda) => {
      const v = formatearCelda(celda);
      html += esHeader ? `<th>${v}</th>` : `<td>${v}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  return html;
}

function formatearCelda(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toLocaleString("es-PE") : v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return v;
}

function renderPaisReporte() {
  const filas = leerTablaReporte();
  if (filas.length === 0) return;

  const porPais = {};
  filas.forEach(f => {
    const p = f.pais;
    if (!porPais[p]) porPais[p] = { usd: 0, soles: 0, desp: 0 };
    porPais[p].usd += f.usd;
    porPais[p].soles += f.soles;
    porPais[p].desp += f.despachos;
  });

  const paisesArr = Object.keys(porPais).sort((a, b) => porPais[b].usd - porPais[a].usd);

  const ctx = document.getElementById("chartPaisReporte");
  if (!ctx) return;
  if (charts["chartPaisReporte"]) charts["chartPaisReporte"].destroy();

  const wrap = ctx.parentElement;
  let inner = wrap.querySelector(".chart-scroll-inner-v");
  if (!inner) {
    inner = document.createElement("div");
    inner.className = "chart-scroll-inner-v";
    wrap.appendChild(inner);
    inner.appendChild(ctx);
  }
  const altoCanvas = 650;
  wrap.style.height = "720px";
  wrap.style.overflowY = "auto";
  inner.style.height = altoCanvas + "px";
  inner.style.width = "100%";

  charts["chartPaisReporte"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: paisesArr,
      datasets: [
        { type: "bar", label: "Venta USD", data: paisesArr.map(p => porPais[p].usd), backgroundColor: COLORS.primary, borderRadius: 4, barThickness: 18, yAxisID: "y", order: 2 },
        { type: "bar", label: "Venta S/", data: paisesArr.map(p => porPais[p].soles), backgroundColor: COLORS.green, borderRadius: 4, barThickness: 18, yAxisID: "y", order: 2 },
        { type: "line", label: "Despachos", data: paisesArr.map(p => porPais[p].desp), borderColor: COLORS.orange, backgroundColor: COLORS.orange, borderWidth: 3, tension: 0.4, pointBackgroundColor: COLORS.orange, pointBorderColor: "#FFFFFF", pointBorderWidth: 2, pointRadius: 5, yAxisID: "y1", order: 0 },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 200 } },
      plugins: {
        legend: { position: "top", labels: { color: COLORS.textDim, font: { family: "Inter", size: 11 }, usePointStyle: true, boxWidth: 8 } },
        tooltip: tooltipStyle(),
        datalabels: {
          display: true,
          anchor: "end",
          align: "right",
          offset: 4,
          color: (ctx) => ctx.dataset.type === "line" ? "#000000" : "#156082",
          font: { family: "Inter", size: 10, weight: "700" },
          formatter: (v, ctx) => {
            const label = ctx.dataset.label;
            const valor = Number(v).toLocaleString("es-PE");
            if (label === "Venta USD") return "$" + valor;
            if (label === "Venta S/") return "S/ " + valor;
            return valor;
          },
        },
      },
      scales: {
        x: { beginAtZero: true, position: "bottom", ticks: { color: COLORS.textDim, callback: (v) => abreviar(v) }, grid: { color: "rgba(214, 228, 240, 0.5)" } },
        x1: { display: false },
        y: { offset: true, ticks: { color: COLORS.textDim, font: { family: "Inter", size: 10 } }, grid: { display: false } },
        y1: { display: false },
      },
    },
  });
}

renderIncotermReporte();

function renderIncotermReporte() {
  const filas = leerTablaReporte();
  if (filas.length === 0) return;

  const porInc = {};
  filas.forEach(f => {
    const i = f.incoterm || "Sin incoterm";
    porInc[i] = (porInc[i] || 0) + f.usd;
  });

  const labels = Object.keys(porInc);
  const datos = Object.values(porInc);

  const ctx = document.getElementById("chartIncotermReporte");
  if (!ctx) return;
  if (charts["chartIncotermReporte"]) charts["chartIncotermReporte"].destroy();

  charts["chartIncotermReporte"] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: datos, backgroundColor: PALETTE_DONUT.slice(0, labels.length), borderColor: "#FFFFFF", borderWidth: 3 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { position: "bottom", labels: { color: COLORS.textDim, font: { family: "Inter", size: 11 }, padding: 12, usePointStyle: true, boxWidth: 8 } },
        tooltip: tooltipStyle(),
        datalabels: {
          color: "#FFFFFF", anchor: "center", align: "center",
          font: { family: "Inter", size: 10, weight: "700" },
          formatter: (v, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + Number(b), 0);
            const pct = total > 0 ? (Number(v) / total) * 100 : 0;
            return pct >= 5 ? abreviar(v) : "";
          },
        },
      },
    },
  });
}

function renderSemanaReporte() {
  const cSem = col("SEMANA");
  const cDesp = col("CANTIDAD DE DESPACHOS") || col("CANT_DESPACHOS");
  const cMes = col("MES");

  if (!cSem) return;

  // Cargar opciones del filtro de mes (una vez)
  const select = document.getElementById("filterMesSemana");
  if (select && select.options.length <= 1) {
    const meses = [...new Set(dataBackup.map(f => norm(f[cMes])).filter(v => v))];
    const orden = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SETIEMBRE","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
    meses.sort((a, b) => orden.indexOf(a.toUpperCase()) - orden.indexOf(b.toUpperCase()));
    meses.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      select.appendChild(opt);
    });
    select.addEventListener("change", renderSemanaReporte);
  }

  const mesElegido = select ? select.value : "";
  let datosFiltrados = dataBackup;
  if (mesElegido) {
    datosFiltrados = dataBackup.filter(f => norm(f[cMes]) === mesElegido);
  }

  const porSemana = {};
  datosFiltrados.forEach((f) => {
    const s = norm(f[cSem]) || "Sin semana";
    porSemana[s] = (porSemana[s] || 0) + num(f[cDesp]);
  });

  const semanas = Object.keys(porSemana).sort();
  const datos = semanas.map(s => porSemana[s]);

  const ctx = document.getElementById("chartSemanaReporte");
  if (!ctx) return;
  if (charts["chartSemanaReporte"]) charts["chartSemanaReporte"].destroy();

  charts["chartSemanaReporte"] = new Chart(ctx, {
    type: "line",
    data: {
      labels: semanas,
      datasets: [{
        data: datos,
        borderColor: COLORS.orange,
        backgroundColor: "rgba(242, 111, 43, 0.15)",
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: COLORS.orange,
        pointBorderColor: "#FFFFFF",
        pointBorderWidth: 2,
        pointRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle(),
        datalabels: {
          display: true,
          align: "top",
          anchor: "end",
          offset: 4,
          color: "#156082",
          font: { family: "Inter", size: 10, weight: "600" },
          formatter: (v) => Number(v).toLocaleString("es-PE"),
        },
      },
      scales: {
        x: {
          ticks: { color: COLORS.textDim, font: { family: "Inter", size: 10 } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: COLORS.textDim, callback: (v) => abreviar(v) },
          grid: { color: "rgba(214, 228, 240, 0.5)" },
        },
      },
    },
  });
}

function calcularKPIsDia() {
  const cont = document.getElementById("kpiRowDia");
  if (!cont) return;

  // Total del día (suma de la Tabla 1)
  const filas = leerTablaReporte();
  let despDia = 0, volDia = 0, usdDia = 0, solesDia = 0;
  filas.forEach(f => {
    despDia += f.despachos;
    volDia += f.volumen;
    usdDia += f.usd;
    solesDia += f.soles;
  });

  // Acumulados (fila índice 7, columnas 7 a 10)
  const filaAcum = reporteMatriz[7] || [];
  const despTot = Number(filaAcum[7]) || 0;
  const volTot = Number(filaAcum[8]) || 0;
  const usdTot = Number(filaAcum[9]) || 0;
  const solesTot = Number(filaAcum[10]) || 0;  

  const tarjetas = [
    { icon: "fa-boxes-stacked", clase: "", titulo: "Despachos del Día", valor: despDia.toLocaleString("es-PE"), sub: "Total del día" },
    { icon: "fa-cube", clase: "icon-cyan", titulo: "Volumen del Día (m³)", valor: volDia.toLocaleString("es-PE", { maximumFractionDigits: 1 }), sub: "Total del día" },
    { icon: "fa-dollar-sign", clase: "icon-green", titulo: "Venta del Día (USD)", valor: moneyUSD(usdDia), sub: "Total del día" },
    { icon: "fa-coins", clase: "icon-orange", titulo: "Venta del Día (S/)", valor: moneySoles(solesDia), sub: "Total del día" },
    { icon: "fa-boxes-stacked", clase: "icon-cyan", titulo: "Cantidad de Despachos", valor: despTot.toLocaleString("es-PE"), sub: "Acumulado" },
{ icon: "fa-cube", clase: "icon-orange", titulo: "Volumen Despachado (m³)", valor: volTot.toLocaleString("es-PE", { maximumFractionDigits: 1 }), sub: "Acumulado" },
    { icon: "fa-dollar-sign", clase: "icon-green", titulo: "Venta Acumulada (USD)", valor: moneyUSD(usdTot), sub: "Total acumulado" },
    { icon: "fa-coins", clase: "icon-orange", titulo: "Venta Acumulada (S/)", valor: moneySoles(solesTot), sub: "Total acumulado" },
  ];

  cont.innerHTML = tarjetas.map(t => `
    <div class="kpi-card">
      <div class="kpi-icon-circle ${t.clase}"><i class="fas ${t.icon}"></i></div>
      <div class="kpi-content">
        <span class="kpi-title">${t.titulo}</span>
        <span class="kpi-main kpi-main-mini">${t.valor}</span>
        <span class="kpi-trend">${t.sub}</span>
      </div>
    </div>
  `).join("");
}

function leerTablaReporte() {
  const filas = [];
  let f = 7;
  while (true) {
    const fila = reporteMatriz[f] || [];
    const pais = (fila[0] || "").toString().trim();
    if (pais === "" || pais.toUpperCase() === "TOTAL GENERAL") break;
    filas.push({
      pais: pais,
      cliente: (fila[1] || "").toString().trim(),
      incoterm: (fila[2] || "").toString().trim(),
      despachos: Number(fila[3]) || 0,
      volumen: Number(fila[4]) || 0,
      usd: Number(fila[5]) || 0,
      soles: Number(fila[6]) || 0,
    });
    f++;
  }
  return filas;
}

cargarDatos();