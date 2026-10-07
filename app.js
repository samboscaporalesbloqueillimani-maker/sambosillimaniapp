/* ==========================================================================
   SAMBOS CAPORALES BLOQUE ILLIMANI - CORE APPLICATION LOGIC (app.js)
   Página Principal con Login por CI + Autoregistro de Nuevos Fraternos con Foto
   Módulo Exclusivo de Admisiones en Panel Admin (Aprobar / Rechazar)
   Cuentas Corrientes Separadas, QR & Reportes Financieros en CSV
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. CONSTANTES Y CONFIGURACIÓN GENERAL
// --------------------------------------------------------------------------
const HORA_ENSAYO_INICIO = "10:30";
const TOLERANCIA_MINUTOS = 10;
const MULTA_ATRASO = 30;
const MULTA_FALTA = 50;
const MULTA_SIN_SALIDA = 30;

// Base de Datos Oficial Inicial
const OFFICIAL_INITIAL_FRATERNOS = [
  {
    id: "SB-01",
    ci: "1234567",
    nombre: "Carlos Llanes",
    bloque: "Varones",
    fechaNacimiento: "15/04/1998",
    anioIngreso: 2023,
    categoria: "Antiguo",
    direccion: "Av. Illimani #450",
    rol: "Admin / Guía Central",
    roleType: "admin",
    tallas: { polera: "M", chamarra: "L", canguro: "M" },
    pagos: [],
    deuda: 30,
    multasAcumuladas: 30,
    ficha_medica: "Ninguna",
    telefono: "77212345",
    contacto_emergencia: "María Llanes - 77512345",
    foto: "",
    horaEntrada: null,
    horaSalida: null,
    estadoAsistencia: "Pendiente",
    multaBob: 30
  },
  {
    id: "SB-02",
    ci: "7654321",
    nombre: "Elena Mendoza",
    bloque: "Cholitas",
    fechaNacimiento: "22/10/2000",
    anioIngreso: 2025,
    categoria: "Nuevo",
    direccion: "Calle Sagárnaga #120",
    rol: "Danzante",
    roleType: "danzante",
    tallas: { polera: "S", chamarra: "M", canguro: "S" },
    pagos: [],
    deuda: 50,
    multasAcumuladas: 50,
    ficha_medica: "Asma - Usa inhalador",
    telefono: "70612345",
    contacto_emergencia: "Pedro Mendoza - 70512345",
    foto: "",
    horaEntrada: null,
    horaSalida: null,
    estadoAsistencia: "Pendiente",
    multaBob: 50
  },
  {
    id: "SB-03",
    ci: "4567890",
    nombre: "Mateo Condori",
    bloque: "Jachas",
    fechaNacimiento: "05/08/1995",
    anioIngreso: 2022,
    categoria: "Antiguo",
    direccion: "Zona Central, Calle Potosí",
    rol: "Encargado de Asistencia",
    roleType: "encargado_asistencia",
    tallas: { polera: "XL", chamarra: "XL", canguro: "L" },
    pagos: [],
    deuda: 0,
    multasAcumuladas: 0,
    ficha_medica: "Ninguna",
    telefono: "71512345",
    contacto_emergencia: "Félix Condori - 71212345",
    foto: "",
    horaEntrada: null,
    horaSalida: null,
    estadoAsistencia: "Pendiente",
    multaBob: 0
  },
  {
    id: "SB-04",
    ci: "9876543",
    nombre: "Sofía Vargas",
    bloque: "Miskys",
    fechaNacimiento: "12/01/2002",
    anioIngreso: 2026,
    categoria: "Nuevo",
    direccion: "Sopocachi, Calle Belisario Salinas",
    rol: "Encargado de Pagos",
    roleType: "encargado_pagos",
    tallas: { polera: "M", chamarra: "M", canguro: "M" },
    pagos: [],
    deuda: 0,
    multasAcumuladas: 0,
    ficha_medica: "Alergia a la Penicilina",
    telefono: "73012345",
    contacto_emergencia: "Luz Vargas - 73212345",
    foto: "",
    horaEntrada: null,
    horaSalida: null,
    estadoAsistencia: "Pendiente",
    multaBob: 0
  }
];

let AppState = {
  fraternos: [],       // Danzantes oficiales activos
  postulantes: [       // Postulantes en espera de aprobación por el Administrador
    {
      id: "POST-901",
      ci: "8473921",
      nombre: "Carlos Fernando Mamani",
      bloque: "Varones",
      fechaNacimiento: "10/06/2001",
      anioIngreso: 2026,
      categoria: "Nuevo",
      direccion: "Zona Sur #300",
      rol: "Danzante",
      roleType: "danzante",
      tallas: { polera: "M", chamarra: "L", canguro: "M" },
      telefono: "71234567",
      contacto_emergencia: "Padre: Juan Mamani - 71234568",
      ficha_medica: "Ninguna",
      foto: ""
    }
  ],
  ensayos: [
    { id: "ENS-2026-09-20", fecha: "2026-09-20", desc: "Ensayo General - Plaza Villarroel", cerrado: false }
  ],
  hitosCuotas: [
    { id: "HITO-1", nombre: "Cuota Ingreso de Bloque", monto: 150, fechaLimite: "2026-10-01" }
  ],
  asistencias: { "ENS-2026-09-20": {} },
  ensayoActivoId: "ENS-2026-09-20",
  finanzas: {}
};

let fotoRegistroBase64 = "";
let currentScanMode = 'ENTRADA';
let isLateSimulation = false;
let html5QrScanner = null;
let chartInstance = null;

function calcularCategoria(anioIngreso) {
  const anio = parseInt(anioIngreso, 10);
  if (isNaN(anio)) return "Nuevo";
  return anio <= 2024 ? "Antiguo" : "Nuevo";
}

function getRoleTitle(roleType) {
  if (roleType === 'admin') return 'Admin / Guía Central';
  if (roleType === 'encargado_asistencia') return 'Encargado de Asistencia';
  if (roleType === 'encargado_pagos') return 'Encargado de Pagos';
  return 'Danzante / Fraterno';
}

function initLocalStorage() {
  const savedMaster = localStorage.getItem("SAMBOS_MASTER_STATE") || localStorage.getItem("sambos_fraternos");
  if (!savedMaster) {
    AppState.fraternos = OFFICIAL_INITIAL_FRATERNOS;
    AppState.fraternos.forEach(f => {
      AppState.finanzas[f.ci] = { hitosPagados: {}, totalMultasPendientes: f.deuda || 0 };
    });
    saveState();
  } else {
    try {
      const parsed = JSON.parse(savedMaster);
      if (parsed.fraternos) {
        AppState = parsed;
      } else if (Array.isArray(parsed)) {
        AppState.fraternos = parsed;
      }
    } catch(e) {
      AppState.fraternos = OFFICIAL_INITIAL_FRATERNOS;
    }
  }

  if (!AppState.fraternos) AppState.fraternos = OFFICIAL_INITIAL_FRATERNOS;
  if (!AppState.postulantes) AppState.postulantes = [];
  if (!AppState.finanzas) AppState.finanzas = {};

  if (!AppState.ensayos || !Array.isArray(AppState.ensayos) || AppState.ensayos.length === 0) {
    AppState.ensayos = [
      { id: "ENS-2026-09-20", fecha: "2026-09-20", desc: "Ensayo General - Plaza Villarroel", horaInicio: "10:30", horaTolerancia: 10, cerrado: false },
      { id: "ENS-2026-09-27", fecha: "2026-09-27", desc: "Ensayo General - Av. Tejada Sorzano", horaInicio: "10:30", horaTolerancia: 10, cerrado: false },
      { id: "ENS-2026-10-04", fecha: "2026-10-04", desc: "Ensayo Pre-Entrada - Estadio Hernando Siles", horaInicio: "10:30", horaTolerancia: 10, cerrado: false }
    ];
  }

  if (!AppState.hitosCuotas || !Array.isArray(AppState.hitosCuotas) || AppState.hitosCuotas.length === 0) {
    AppState.hitosCuotas = [
      { id: "HITO-1", nombre: "Cuota Ingreso de Bloque", monto: 150, fechaLimite: "2026-10-15" },
      { id: "HITO-2", nombre: "Cuota Inicial Traje de Baile", monto: 350, fechaLimite: "2026-11-01" },
      { id: "HITO-3", nombre: "Cuota Final Traje & Banda", monto: 400, fechaLimite: "2026-12-01" }
    ];
  }

  if (!AppState.ensayoActivoId) AppState.ensayoActivoId = AppState.ensayos[0].id;
  if (!AppState.asistencias) AppState.asistencias = {};

  AppState.fraternos.forEach(f => {
    f.categoria = calcularCategoria(f.anioIngreso);
    if (!AppState.finanzas[f.ci]) {
      AppState.finanzas[f.ci] = { hitosPagados: {}, totalMultasPendientes: f.deuda || 0 };
    }
  });
}

function syncAsistenciaRecord(ci, data) {
  const ensayoId = AppState.ensayoActivoId || (AppState.ensayos && AppState.ensayos[0] ? AppState.ensayos[0].id : "ENS-2026-09-20");
  if (!AppState.asistencias) AppState.asistencias = {};
  if (!AppState.asistencias[ensayoId]) AppState.asistencias[ensayoId] = {};
  if (!AppState.asistencias[ensayoId][ci]) AppState.asistencias[ensayoId][ci] = {};

  Object.assign(AppState.asistencias[ensayoId][ci], data);
}

function saveState() {
  localStorage.setItem("SAMBOS_MASTER_STATE", JSON.stringify(AppState));
  localStorage.setItem("sambos_fraternos", JSON.stringify(AppState.fraternos));
  localStorage.setItem("fraternos_illimani", JSON.stringify(AppState.fraternos));
}

function getFraternos() {
  return AppState.fraternos;
}

function saveFraternos(fraternos) {
  AppState.fraternos = fraternos;
  saveState();
}

// --------------------------------------------------------------------------
// 2. SISTEMA DE NOTIFICACIONES TOAST (4 SEGUNDOS)
// --------------------------------------------------------------------------
function showToast(title, message, type = 'success', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-triangle-exclamation';
  if (type === 'warning') iconClass = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 400);
  }, duration);
}

function playBeep(type = 'success') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'alarm') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(400, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {}
}

// --------------------------------------------------------------------------
// 3. PANTALLA PRINCIPAL: LOGIN POR CARNET & AUTOREGISTRO CON FOTO (index.html)
// --------------------------------------------------------------------------
function initWelcomeAndLogin() {
  const btnFuerza = document.getElementById('btnFuerza');
  const welcomeOverlay = document.getElementById('welcomeOverlay');
  const loginForm = document.getElementById('loginForm');
  const loginCI = document.getElementById('loginCI');

  if (btnFuerza && welcomeOverlay) {
    btnFuerza.addEventListener('click', () => {
      playFolkloreFanfare();
      showToast('¡Fuerza, Fe y Devoción!', 'Bienvenido al Bloque Illimani', 'success', 3000);
      welcomeOverlay.classList.add('fade-out');
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const ci = loginCI.value.trim();
      processLogin(ci);
    });

    document.querySelectorAll('.demo-login-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ci = btn.getAttribute('data-ci');
        const roleMode = btn.getAttribute('data-role');
        processLogin(ci, roleMode);
      });
    });
  }

  const btnOpenReg = document.getElementById('btnOpenRegisterModal');
  if (btnOpenReg) {
    btnOpenReg.addEventListener('click', () => {
      openRegisterModal();
    });
  }

  const chkNoCond = document.getElementById('chkNoCondition');
  const regFicha = document.getElementById('regFichaMedica');
  if (chkNoCond && regFicha) {
    chkNoCond.addEventListener('change', () => {
      if (chkNoCond.checked) {
        regFicha.value = 'Ninguna';
      } else if (regFicha.value === 'Ninguna') {
        regFicha.value = '';
      }
    });
  }

  const regAnio = document.getElementById('regAnioIngreso');
  const catPreview = document.getElementById('regCategoriaPreview');
  if (regAnio && catPreview) {
    regAnio.addEventListener('input', () => {
      const cat = calcularCategoria(regAnio.value);
      catPreview.innerHTML = `Categoría evaluada: <strong>${cat}</strong>`;
      catPreview.style.color = cat === 'Antiguo' ? 'var(--color-gold)' : '#FF6B6B';
    });
  }

  const formRegister = document.getElementById('formRegister');
  if (formRegister) {
    formRegister.addEventListener('submit', handleSelfRegistration);
  }
}

function openRegisterModal(prefillCI = '') {
  const modal = document.getElementById('registerModal');
  if (modal) {
    modal.classList.add('active');
    if (prefillCI) {
      const ciInput = document.getElementById('regCI');
      if (ciInput) ciInput.value = prefillCI;
    }
  }
}

function closeRegisterModal() {
  const modal = document.getElementById('registerModal');
  if (modal) modal.classList.remove('active');
}

function playFolkloreFanfare() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.12 + 0.3);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
    });
  } catch(e) {}
}

function processLogin(ci, forceRole = null) {
  const fraternos = getFraternos();
  const user = fraternos.find(f => f.ci === ci);

  // Comprobar si está en lista de postulantes pendientes
  const postulanteIdx = AppState.postulantes.findIndex(p => p.ci === ci);
  if (postulanteIdx !== -1) {
    const postulante = AppState.postulantes[postulanteIdx];
    
    // EL ADMINISTRADOR NUNCA REQUIERE APROBACIÓN: Se auto-aprueba e ingresa con acceso total
    if (forceRole === 'admin' || postulante.roleType === 'admin') {
      const nuevoId = "SB-" + String(AppState.fraternos.length + 1).padStart(2, '0');
      postulante.id = nuevoId;
      postulante.roleType = 'admin';
      postulante.rol = getRoleTitle('admin');
      delete postulante.estado;

      AppState.fraternos.push(postulante);
      AppState.finanzas[postulante.ci] = { hitosPagados: {}, totalMultasPendientes: 0 };
      AppState.postulantes.splice(postulanteIdx, 1);
      saveState();

      localStorage.setItem('fraterno_logueado', postulante.ci);
      localStorage.setItem('sambos_active_user', JSON.stringify(postulante));

      showToast('Acceso Administrador Activado', `Bienvenido ${postulante.nombre}. Cuenta de Administrador activada sin aprobación previa.`, 'success', 5000);
      setTimeout(() => { window.location.href = 'admin.html'; }, 700);
      return;
    }

    showToast('Solicitud en Revisión', `⚠️ Su solicitud de registro para ${postulante.nombre} está en proceso de revisión por el Administrador.`, 'warning', 6000);
    return;
  }

  if (!user) {
    showToast('CI No Registrado', `El CI ${ci} no existe en la fraternidad. Abriendo formulario de inscripción...`, 'warning');
    setTimeout(() => { openRegisterModal(ci); }, 700);
    return;
  }

  localStorage.setItem('fraterno_logueado', user.ci);
  localStorage.setItem('sambos_active_user', JSON.stringify(user));

  const role = forceRole || user.roleType || 'danzante';

  if (role === 'admin' || role === 'encargado_asistencia' || role === 'encargado_pagos') {
    showToast('Acceso Autorizado', `Bienvenido ${user.nombre} (${getRoleTitle(role)})`, 'success');
    setTimeout(() => { window.location.href = 'admin.html'; }, 700);
  } else {
    showToast('Acceso Danzante', `Bienvenido Fraterno ${user.nombre}`, 'success');
    setTimeout(() => { window.location.href = 'mi-perfil.html'; }, 700);
  }
}

// Previsualización de Foto de Perfil en Base64 durante Autoregistro
function previsualizarFotoRegistro(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      fotoRegistroBase64 = e.target.result;
      const previewBox = document.getElementById("upload-preview-avatar");
      if (previewBox) {
        previewBox.innerHTML = `<img src="${fotoRegistroBase64}" alt="Foto Perfil">`;
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// --------------------------------------------------------------------------
// 4. AUTOREGISTRO DE NUEVO POSTULANTE / ADMIN CON FOTO Y ANTI-DUPLICADOS
// --------------------------------------------------------------------------
function handleSelfRegistration(e) {
  e.preventDefault();

  const nombre = document.getElementById('regNombre').value.trim();
  const ci = document.getElementById('regCI').value.trim();
  const fechaNacimiento = document.getElementById('regFechaNacimiento').value.trim();
  const telefono = document.getElementById('regTelefono').value.trim();
  const direccion = document.getElementById('regDireccion').value.trim();
  const contactoEmergencia = document.getElementById('regContactoEmergencia').value.trim();
  const bloque = document.getElementById('regBloque').value;
  const anioIngreso = parseInt(document.getElementById('regAnioIngreso').value, 10);
  const roleType = 'danzante';
  const tallaPolera = document.getElementById('regTallaPolera').value;
  const tallaChamarra = document.getElementById('regTallaChamarra').value;
  const tallaCanguro = document.getElementById('regTallaCanguro').value;
  const fichaMedica = document.getElementById('regFichaMedica').value.trim();

  if (!nombre || !ci || !fechaNacimiento || !telefono || !direccion || !contactoEmergencia || !bloque || !anioIngreso || !fichaMedica) {
    showToast('Campos Incompletos', 'Por favor complete todos los campos requeridos.', 'error');
    return;
  }

  // FOTO DE PERFIL EN BASE64 OBLIGATORIA
  if (!fotoRegistroBase64) {
    showToast('Fotografía Requerida', 'Exigencia de la Fraternidad: Debe seleccionar su fotografía de perfil.', 'error');
    return;
  }

  // VALIDACIÓN ANTI-DUPLICADOS EN FRATERNOS Y POSTULANTES:
  const existeOficial = AppState.fraternos.find(f => f.ci === ci);
  const existePostulante = AppState.postulantes.find(p => p.ci === ci);

  if (existeOficial || existePostulante) {
    showToast('⚠️ Error de Duplicado', '⚠️ Error: Este número de carnet ya está registrado en el Bloque Illimani', 'error', 5000);
    return;
  }

  const categoriaCalculada = calcularCategoria(anioIngreso);

  // EL ADMINISTRADOR NO REQUIERE APROBACIÓN: Ingresa directamente como activo a AppState.fraternos
  if (roleType === 'admin') {
    const nuevoAdmin = {
      id: "SB-" + String(AppState.fraternos.length + 1).padStart(2, '0'),
      ci: ci,
      nombre: nombre,
      bloque: bloque,
      fechaNacimiento: fechaNacimiento,
      anioIngreso: anioIngreso,
      categoria: categoriaCalculada,
      direccion: direccion,
      rol: getRoleTitle('admin'),
      roleType: 'admin',
      tallas: { polera: tallaPolera, chamarra: tallaChamarra, canguro: tallaCanguro },
      pagos: [],
      deuda: 0,
      multasAcumuladas: 0,
      ficha_medica: fichaMedica,
      telefono: telefono,
      contacto_emergencia: contactoEmergencia,
      foto: fotoRegistroBase64,
      horaEntrada: null,
      horaSalida: null,
      estadoAsistencia: 'Pendiente',
      multaBob: 0
    };

    AppState.fraternos.push(nuevoAdmin);
    AppState.finanzas[ci] = { hitosPagados: {}, totalMultasPendientes: 0 };
    saveState();

    localStorage.setItem('fraterno_logueado', nuevoAdmin.ci);
    localStorage.setItem('sambos_active_user', JSON.stringify(nuevoAdmin));

    closeRegisterModal();
    fotoRegistroBase64 = "";

    showToast('Administrador Registrado', `¡Bienvenido ${nombre}! Su cuenta de Administrador tiene acceso total inmediato y no requiere aprobación.`, 'success', 5000);
    setTimeout(() => { window.location.href = 'admin.html'; }, 900);
    return;
  }

  // SI ES DANZANTE / FRATERNO: Pasa a lista de postulantes pendientes
  const nuevoPostulante = {
    id: "POST-" + Math.floor(1000 + Math.random() * 9000),
    ci: ci,
    nombre: nombre,
    bloque: bloque,
    fechaNacimiento: fechaNacimiento,
    anioIngreso: anioIngreso,
    categoria: categoriaCalculada,
    direccion: direccion,
    rol: "Danzante",
    roleType: "danzante",
    tallas: { polera: tallaPolera, chamarra: tallaChamarra, canguro: tallaCanguro },
    pagos: [],
    deuda: 0,
    ficha_medica: fichaMedica,
    telefono: telefono,
    contacto_emergencia: contactoEmergencia,
    foto: fotoRegistroBase64,
    estado: "Pendiente de Aprobación"
  };

  AppState.postulantes.push(nuevoPostulante);
  saveState();

  closeRegisterModal();
  fotoRegistroBase64 = "";

  showToast('Inscripción Enviada', `¡Gracias ${nombre}! Su solicitud fue enviada y será evaluada por el Administrador.`, 'success', 5000);
}

// --------------------------------------------------------------------------
// 5. EVALUACIÓN Y ADMISIONES EXCLUSIVAS DEL ADMINISTRADOR (admin.html)
// --------------------------------------------------------------------------
function renderAdmisionesTable() {
  const tbody = document.getElementById('tabla-admisiones-tbody');
  const badgeCount = document.getElementById('badge-pendientes-count');
  const navBadge = document.getElementById('navBadgePendientes');

  if (badgeCount) badgeCount.textContent = `${AppState.postulantes.length} Pendientes`;
  if (navBadge) navBadge.textContent = AppState.postulantes.length;
  if (!tbody) return;

  tbody.innerHTML = '';

  if (AppState.postulantes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No hay solicitudes de postulantes pendientes de evaluación.</td></tr>`;
    return;
  }

  AppState.postulantes.forEach(p => {
    const avatarThumb = p.foto 
      ? `<img src="${p.foto}" class="avatar-img-table" alt="Avatar">`
      : `<i class="fa-solid fa-user-clock" style="font-size: 1.5rem; color: var(--color-gold);"></i>`;

    tbody.innerHTML += `
      <tr>
        <td>${avatarThumb}</td>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.ci}</td>
        <td><span class="badge" style="background: rgba(255,255,255,0.08); color: var(--color-gold);">${p.bloque} (${p.categoria})</span></td>
        <td>${p.telefono}</td>
        <td>
          <button class="btn btn-gold" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; margin-right: 0.4rem;" onclick="evaluarPostulante('${p.id}', true)">
            <i class="fa-solid fa-user-check"></i> Aprobar
          </button>
          <button class="btn btn-danger" style="padding: 0.35rem 0.8rem; font-size: 0.8rem;" onclick="evaluarPostulante('${p.id}', false)">
            <i class="fa-solid fa-user-xmark"></i> Rechazar
          </button>
        </td>
      </tr>
    `;
  });
}

function evaluarPostulante(id, aprobado) {
  const idx = AppState.postulantes.findIndex(p => p.id === id);
  if (idx === -1) return;

  const candidato = AppState.postulantes[idx];

  if (aprobado) {
    const nuevoId = "SB-" + String(AppState.fraternos.length + 1).padStart(2, '0');
    candidato.id = nuevoId;
    delete candidato.estado;

    AppState.fraternos.push(candidato);
    AppState.finanzas[candidato.ci] = { hitosPagados: {}, totalMultasPendientes: 0 };

    showToast('Postulante Aprobado', `¡${candidato.nombre} fue aprobado e ingresado oficialmente como fraterno!`, 'success');
  } else {
    showToast('Solicitud Rechazada', `La solicitud de inscripción de ${candidato.nombre} fue rechazada.`, 'warning');
  }

  AppState.postulantes.splice(idx, 1);
  saveState();
  renderAdminData();
}

// --------------------------------------------------------------------------
// 6. PANEL DE ADMINISTRACIÓN Y CONTROL DE SEGURIDAD (admin.html)
// --------------------------------------------------------------------------
function initTabNavigation() {
  const tabBtns = document.querySelectorAll('#adminNavTabs .tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  if (!tabBtns.length) return;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

function initAdminPanel() {
  const activeUser = JSON.parse(localStorage.getItem('sambos_active_user'));
  const ciLogueado = localStorage.getItem('fraterno_logueado');
  const fraternos = getFraternos();
  const currentUser = fraternos.find(f => f.ci === (activeUser ? activeUser.ci : ciLogueado)) || activeUser;

  // SEGURIDAD: REDIRECCIÓN INMEDIATA SI NO TIENE PERMISOS DE ADMIN/PERSONAL
  if (!currentUser || currentUser.roleType === 'danzante' || currentUser.roleType === 'fraterno') {
    showToast('⚠️ Acceso Denegado', '⚠️ Acceso denegado: No tiene permisos de administración o personal.', 'error', 5000);
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
    return;
  }

  initTabNavigation();

  const adminNameEl = document.getElementById('adminUserName');
  const adminRoleBadge = document.getElementById('adminRoleBadge');
  if (adminNameEl) adminNameEl.textContent = currentUser.nombre;
  if (adminRoleBadge) adminRoleBadge.textContent = getRoleTitle(currentUser.roleType);

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('fraterno_logueado');
      localStorage.removeItem('sambos_active_user');
      window.location.href = 'index.html';
    });
  }

  aplicarRestriccionesDeRol(currentUser.roleType);

  const clockEl = document.getElementById('simulatedClock');
  const btnToggleSimTime = document.getElementById('btnToggleSimTime');

  function updateClockDisplay() {
    if (clockEl) {
      clockEl.textContent = isLateSimulation ? '10:45:00 AM (Atraso)' : '10:35:00 AM (A tiempo)';
      clockEl.style.color = isLateSimulation ? 'var(--color-secondary)' : '#2ECC71';
    }
  }
  updateClockDisplay();

  if (btnToggleSimTime) {
    btnToggleSimTime.addEventListener('click', () => {
      isLateSimulation = !isLateSimulation;
      updateClockDisplay();
      showToast('Simulación de Hora', isLateSimulation ? 'Hora: 10:45 AM (Atraso Bs 30)' : 'Hora: 10:35 AM (Puntual Bs 0)', isLateSimulation ? 'warning' : 'success');
      btnToggleSimTime.innerHTML = isLateSimulation 
        ? '<i class="fa-solid fa-backward-step"></i> Simular Puntual (10:35 AM)'
        : '<i class="fa-solid fa-forward-step"></i> Simular Atraso (10:45 AM)';
    });
  }

  const btnModeEntrada = document.getElementById('btnModeEntrada');
  const btnModeSalida = document.getElementById('btnModeSalida');

  if (btnModeEntrada && btnModeSalida) {
    btnModeEntrada.addEventListener('click', () => {
      currentScanMode = 'ENTRADA';
      btnModeEntrada.classList.add('active');
      btnModeSalida.classList.remove('active');
      showToast('Modo Escáner', 'Escaneando Entrada', 'success', 2000);
    });
    btnModeSalida.addEventListener('click', () => {
      currentScanMode = 'SALIDA';
      btnModeSalida.classList.add('active');
      btnModeEntrada.classList.remove('active');
      showToast('Modo Escáner', 'Escaneando Salida', 'warning', 2000);
    });
  }

  if (currentUser.roleType === 'admin' || currentUser.roleType === 'encargado_asistencia') {
    try {
      if (typeof Html5QrcodeScanner !== 'undefined') {
        html5QrScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
        html5QrScanner.render(onScanSuccess, onScanFailure);
      }
    } catch (e) {}
  }

  const btnConcluir = document.getElementById('btnConcluirEnsayo');
  if (btnConcluir) btnConcluir.addEventListener('click', concluirEnsayo);

  const formLicencia = document.getElementById('formLicencia');
  if (formLicencia) {
    formLicencia.addEventListener('submit', (e) => {
      e.preventDefault();
      const sel = document.getElementById('selectFraternoLicencia');
      const mot = document.getElementById('motivoLicencia').value;
      if (sel && sel.value) otorgarLicencia(sel.value, mot);
    });
  }

  const formStaffRole = document.getElementById('formStaffRole');
  if (formStaffRole) {
    formStaffRole.addEventListener('submit', guardarRolPersonal);
  }

  const btnOpenEnsayo = document.getElementById('btnOpenModalEnsayo');
  if (btnOpenEnsayo) btnOpenEnsayo.addEventListener('click', openModalCrearEnsayo);

  const formEnsayo = document.getElementById('formCrearEnsayo');
  if (formEnsayo) formEnsayo.addEventListener('submit', guardarNuevoEnsayo);

  const btnEnableIngreso = document.getElementById('btnEnableIngreso');
  if (btnEnableIngreso) {
    btnEnableIngreso.addEventListener('click', () => {
      setModoMarcadoEnsayo(AppState.ensayoActivoId, 'ENTRADA');
    });
  }

  const btnEnableSalida = document.getElementById('btnEnableSalida');
  if (btnEnableSalida) {
    btnEnableSalida.addEventListener('click', () => {
      setModoMarcadoEnsayo(AppState.ensayoActivoId, 'SALIDA');
    });
  }

  const selectEnsayo = document.getElementById('selectEnsayoActivo');
  if (selectEnsayo) {
    selectEnsayo.addEventListener('change', (e) => {
      AppState.ensayoActivoId = e.target.value;
      saveState();
      renderAdminData();
      showToast('Ensayo Seleccionado', 'Asistencia cargada para el día seleccionado.', 'success', 2000);
    });
  }

  const btnExportEnsayoDia = document.getElementById('btnExportEnsayoDia');
  if (btnExportEnsayoDia) {
    btnExportEnsayoDia.addEventListener('click', () => {
      exportarReporteAsistenciaDia();
    });
  }

  const btnExportTallas = document.getElementById('btnExportTallas');
  if (btnExportTallas) btnExportTallas.addEventListener('click', exportarLogisticaTallas);

  const btnExportCSV = document.getElementById('btnExportCSV');
  if (btnExportCSV) btnExportCSV.addEventListener('click', exportarCSV);

  const btnExportIngresos = document.getElementById('btnExportIngresos');
  if (btnExportIngresos) btnExportIngresos.addEventListener('click', exportarReporteIngresos);

  const btnOpenCuota = document.getElementById('btnOpenModalCrearCuota');
  if (btnOpenCuota) btnOpenCuota.addEventListener('click', openModalCrearCuota);

  const formCuota = document.getElementById('formCrearCuota');
  if (formCuota) formCuota.addEventListener('submit', guardarNuevaCuota);

  const btnOpenPago = document.getElementById('btnOpenModalPagoManual');
  if (btnOpenPago) btnOpenPago.addEventListener('click', () => openModalPagoManual('', 'CUOTA'));

  const formPago = document.getElementById('formPagoManual');
  if (formPago) formPago.addEventListener('submit', guardarPagoManual);

  const selManualTipo = document.getElementById('manualPagoTipo');
  const groupCuotaSel = document.getElementById('groupManualCuotaSelect');
  if (selManualTipo && groupCuotaSel) {
    selManualTipo.addEventListener('change', () => {
      groupCuotaSel.style.display = selManualTipo.value === 'CUOTA' ? 'block' : 'none';
    });
  }

  renderAdminData();
}

function aplicarRestriccionesDeRol(roleType) {
  const btnExportIngresos = document.getElementById('btnExportIngresos');

  // Botones de pestañas principales
  const navTabCronograma = document.getElementById('navTabCronograma');
  const navTabEscaner = document.getElementById('navTabEscaner');
  const navTabAdmisiones = document.getElementById('navTabAdmisiones');
  const navTabFraternos = document.getElementById('navTabFraternos');
  const navTabLicencias = document.getElementById('navTabLicencias');
  const navTabTesoreria = document.getElementById('navTabTesoreria');
  const navTabPersonal = document.getElementById('navTabPersonal');
  const navTabExportaciones = document.getElementById('navTabExportaciones');

  if (roleType === 'encargado_asistencia') {
    if (btnExportIngresos) btnExportIngresos.style.display = 'none';

    if (navTabCronograma) navTabCronograma.style.display = 'inline-flex';
    if (navTabEscaner) navTabEscaner.style.display = 'inline-flex';
    if (navTabAdmisiones) navTabAdmisiones.style.display = 'none';
    if (navTabFraternos) navTabFraternos.style.display = 'inline-flex';
    if (navTabLicencias) navTabLicencias.style.display = 'inline-flex';
    if (navTabTesoreria) navTabTesoreria.style.display = 'none';
    if (navTabPersonal) navTabPersonal.style.display = 'none';
    if (navTabExportaciones) navTabExportaciones.style.display = 'none';

    if (navTabCronograma) navTabCronograma.click();

  } else if (roleType === 'encargado_pagos') {
    if (btnExportIngresos) btnExportIngresos.style.display = 'inline-flex';

    if (navTabCronograma) navTabCronograma.style.display = 'none';
    if (navTabEscaner) navTabEscaner.style.display = 'none';
    if (navTabAdmisiones) navTabAdmisiones.style.display = 'none';
    if (navTabFraternos) navTabFraternos.style.display = 'inline-flex';
    if (navTabLicencias) navTabLicencias.style.display = 'none';
    if (navTabTesoreria) navTabTesoreria.style.display = 'inline-flex';
    if (navTabPersonal) navTabPersonal.style.display = 'none';
    if (navTabExportaciones) navTabExportaciones.style.display = 'inline-flex';

    if (navTabTesoreria) navTabTesoreria.click();

  } else {
    // Admin Principal tiene acceso total a las 8 pestañas
    if (btnExportIngresos) btnExportIngresos.style.display = 'inline-flex';

    if (navTabCronograma) navTabCronograma.style.display = 'inline-flex';
    if (navTabEscaner) navTabEscaner.style.display = 'inline-flex';
    if (navTabAdmisiones) navTabAdmisiones.style.display = 'inline-flex';
    if (navTabFraternos) navTabFraternos.style.display = 'inline-flex';
    if (navTabLicencias) navTabLicencias.style.display = 'inline-flex';
    if (navTabTesoreria) navTabTesoreria.style.display = 'inline-flex';
    if (navTabPersonal) navTabPersonal.style.display = 'inline-flex';
    if (navTabExportaciones) navTabExportaciones.style.display = 'inline-flex';
  }
}

function guardarRolPersonal(e) {
  e.preventDefault();

  const selectFraterno = document.getElementById('selectStaffFraterno');
  const selectRole = document.getElementById('selectStaffRole');

  if (!selectFraterno || !selectFraterno.value || !selectRole) return;

  const ciTarget = selectFraterno.value;
  const newRoleType = selectRole.value;

  let fraternos = getFraternos();
  const targetUser = fraternos.find(f => f.ci === ciTarget);

  if (targetUser) {
    targetUser.roleType = newRoleType;
    targetUser.rol = getRoleTitle(newRoleType);
    saveFraternos(fraternos);

    showToast('Permisos Actualizados', `Se asignó el rol '${getRoleTitle(newRoleType)}' a ${targetUser.nombre}.`, 'success');
    renderAdminData();
  }
}

function onScanSuccess(decodedText) {
  processQRScan(decodedText.trim());
}

function onScanFailure() {}

function processQRScan(ci) {
  let fraternos = getFraternos();
  const dancer = fraternos.find(f => f.ci === ci);

  if (!dancer) {
    showToast('Código QR Desconocido', `CI ${ci} no registrado.`, 'error');
    playBeep('alarm');
    return;
  }

  const horaActual = isLateSimulation ? '10:45 AM' : '10:35 AM';

  if (currentScanMode === 'ENTRADA') {
    dancer.horaEntrada = horaActual;
    if (!isLateSimulation) {
      dancer.estadoAsistencia = 'Puntual';
      dancer.multaBob = 0;
      syncAsistenciaRecord(ci, { horaEntrada: horaActual, estadoAsistencia: 'Puntual', multaBob: 0 });
      showToast('ENTRADA PUNTUAL', `[${dancer.nombre}] marcó entrada a las ${horaActual}.`, 'success');
      playBeep('success');
    } else {
      dancer.estadoAsistencia = 'Atraso';
      dancer.multaBob = MULTA_ATRASO;
      dancer.deuda = (dancer.deuda || 0) + MULTA_ATRASO;
      syncAsistenciaRecord(ci, { horaEntrada: horaActual, estadoAsistencia: 'Atraso', multaBob: MULTA_ATRASO });
      showToast('ATRASO REGISTRADO', `[${dancer.nombre}] marcó a las ${horaActual}. Multa Bs 30`, 'error');
      playBeep('alarm');
    }
  } else {
    dancer.horaSalida = horaActual;
    syncAsistenciaRecord(ci, { horaSalida: horaActual });
    showToast('MARCA DE SALIDA', `[${dancer.nombre}] registró salida a las ${horaActual}`, 'success');
    playBeep('success');
  }

  saveFraternos(fraternos);
  renderAdminData();

  if (dancer.ficha_medica && dancer.ficha_medica.trim().toLowerCase() !== 'ninguna') {
    playBeep('alarm');
    showMedicalAlertModal(dancer);
  }
}

function concluirEnsayo() {
  let fraternos = getFraternos();
  let faltantes = 0;
  let sinSalida = 0;

  const activeEnsayo = (AppState.ensayos || []).find(e => e.id === AppState.ensayoActivoId);
  if (activeEnsayo) activeEnsayo.cerrado = true;

  fraternos.forEach(f => {
    if (!f.horaEntrada && f.estadoAsistencia !== 'Licencia Justificada') {
      f.estadoAsistencia = 'Falta';
      f.multaBob = MULTA_FALTA;
      f.deuda = (f.deuda || 0) + MULTA_FALTA;
      syncAsistenciaRecord(f.ci, { estadoAsistencia: 'Falta', multaBob: MULTA_FALTA });
      faltantes++;
    } else if (f.horaEntrada && !f.horaSalida && f.estadoAsistencia !== 'Licencia Justificada') {
      f.multaBob = (f.multaBob || 0) + MULTA_SIN_SALIDA;
      f.deuda = (f.deuda || 0) + MULTA_SIN_SALIDA;
      syncAsistenciaRecord(f.ci, { multaBob: (f.multaBob || 0) + MULTA_SIN_SALIDA });
      sinSalida++;
    }
  });

  saveFraternos(fraternos);
  renderAdminData();

  showToast('Ensayo Concluido', `Faltas: ${faltantes} (Bs 50) | Sin Marcado de Salida: ${sinSalida} (Bs 30).`, 'warning', 6000);
}

function otorgarLicencia(ci, motivo) {
  let fraternos = getFraternos();
  const dancer = fraternos.find(f => f.ci === ci);
  if (dancer) {
    dancer.estadoAsistencia = 'Licencia Justificada';
    dancer.licenciaMotivo = motivo;
    dancer.multaBob = 0;
    syncAsistenciaRecord(ci, { estadoAsistencia: 'Licencia Justificada', licenciaMotivo: motivo, multaBob: 0 });
    saveFraternos(fraternos);
    renderAdminData();
    showToast('Licencia Concedida', `Licencia otorgada a ${dancer.nombre}. Multa anulada a Bs 0.`, 'warning');
  }
}

function renderReceiptsInbox() {
  const container = document.getElementById('receiptsInboxContainer');
  if (!container) return;

  const fraternos = getFraternos();
  let pendingReceipts = [];

  fraternos.forEach(f => {
    if (f.pagos && Array.isArray(f.pagos)) {
      f.pagos.forEach(p => {
        if (p.reciboBase64) {
          pendingReceipts.push({ ...p, fraternoNombre: f.nombre, fraternoCI: f.ci });
        }
      });
    }
  });

  if (pendingReceipts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-check-circle" style="font-size: 2.5rem; color: #2ECC71; margin-bottom: 0.5rem;"></i>
        <p>No hay comprobantes pendientes de validación.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = pendingReceipts.map(rec => `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem; display: flex; gap: 1.2rem; align-items: center; flex-wrap: wrap;">
      <img src="${rec.reciboBase64}" alt="Comprobante Base64" style="max-width: 140px; max-height: 120px; border-radius: 8px; border: 1px solid var(--border-glass); object-fit: cover;">
      <div style="flex: 1;">
        <h4 style="color: var(--color-white); font-weight: 700; font-size: 1.1rem;">
          ${rec.fraternoNombre} <span style="font-size: 0.85rem; color: var(--color-gold);">(CI: ${rec.fraternoCI})</span>
        </h4>
        <div style="font-size: 1.3rem; font-weight: 800; color: #2ECC71; margin: 0.3rem 0;">Bs ${rec.monto}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Fecha: ${rec.fecha || 'Reciente'} • Estado: <strong style="color: ${rec.status === 'aprobado' ? '#2ECC71' : rec.status === 'rechazado' ? '#FF6B6B' : 'var(--color-gold)'}">${(rec.status || 'Pendiente').toUpperCase()}</strong>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; min-width: 150px;">
        <button class="btn btn-gold" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="evaluarComprobante('${rec.fraternoCI}', ${rec.id}, 'aprobar')">
          <i class="fa-solid fa-check"></i> Aprobar Pago
        </button>
        <button class="btn btn-danger" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="evaluarComprobante('${rec.fraternoCI}', ${rec.id}, 'rechazar')">
          <i class="fa-solid fa-xmark"></i> Rechazar
        </button>
      </div>
    </div>
  `).join('');
}

function evaluarComprobante(ci, pagoId, accion) {
  let fraternos = getFraternos();
  const dancer = fraternos.find(f => f.ci === ci);

  if (dancer && dancer.pagos) {
    const pago = dancer.pagos.find(p => p.id === pagoId || p.monto);
    if (pago) {
      if (accion === 'aprobar') {
        pago.status = 'aprobado';
        dancer.deuda = Math.max(0, (dancer.deuda || 0) - (pago.monto || 0));
        showToast('Pago Aprobado', `Se dedujo Bs ${pago.monto} de la deuda de ${dancer.nombre}.`, 'success');
      } else {
        pago.status = 'rechazado';
        showToast('Pago Rechazado', `Se rechazó el comprobante por Bs ${pago.monto}.`, 'error');
      }
      saveFraternos(fraternos);
      renderAdminData();
    }
  }
}

function showMedicalAlertModal(dancer) {
  const modal = document.getElementById('medicalAlertModal');
  const nameEl = document.getElementById('modalFraternoName');
  const roleEl = document.getElementById('modalFraternoRole');
  const notesEl = document.getElementById('modalMedicalNotes');
  const contactEl = document.getElementById('modalEmergencyContact');
  const callBtn = document.getElementById('modalCallEmergencyBtn');

  if (modal && nameEl) {
    nameEl.textContent = dancer.nombre;
    roleEl.textContent = `Bloque ${dancer.bloque} • Categoría ${dancer.categoria} • CI: ${dancer.ci}`;
    notesEl.textContent = dancer.ficha_medica || 'Ninguna';
    contactEl.textContent = dancer.contacto_emergencia || 'No registrado';
    if (callBtn) {
      const phoneDigits = (dancer.contacto_emergencia || '').replace(/\D/g, '');
      callBtn.href = phoneDigits ? `tel:${phoneDigits}` : '#';
    }
    modal.classList.add('active');
  }
}

function closeMedicalModal() {
  const modal = document.getElementById('medicalAlertModal');
  if (modal) modal.classList.remove('active');
}

function showMedicalAlertModalByCI(ci) {
  const fraternos = getFraternos();
  const dancer = fraternos.find(f => f.ci === ci);
  if (dancer) showMedicalAlertModal(dancer);
}

// --------------------------------------------------------------------------
// 7. EXPORTACIÓN DE REPORTE DE INGRESOS FINANCIEROS (CSV)
// --------------------------------------------------------------------------
function exportarReporteIngresos() {
  const fraternos = getFraternos();
  let allPayments = [];

  fraternos.forEach(f => {
    if (f.pagos && Array.isArray(f.pagos) && f.pagos.length > 0) {
      f.pagos.forEach(p => {
        allPayments.push({
          fecha: p.fecha || new Date().toLocaleDateString(),
          ci: f.ci,
          nombre: f.nombre,
          bloque: f.bloque,
          categoria: f.categoria || calcularCategoria(f.anioIngreso),
          concepto: p.concepto || (f.multaBob > 0 ? "Multa Atraso" : "Mensualidad Ensayo"),
          metodo: p.metodo || (p.reciboBase64 ? "Transferencia Bancaria" : "Efectivo"),
          referencia: p.referencia || p.id || ("REC-" + Math.floor(100000 + Math.random() * 900000)),
          monto: p.monto || 0,
          rawFecha: p.fecha
        });
      });
    } else if ((f.deuda || 0) > 0) {
      allPayments.push({
        fecha: new Date().toLocaleDateString(),
        ci: f.ci,
        nombre: f.nombre,
        bloque: f.bloque,
        categoria: f.categoria || calcularCategoria(f.anioIngreso),
        concepto: f.estadoAsistencia === 'Falta' ? "Multa Falta" : "Multa Retraso",
        metodo: "Efectivo",
        referencia: "REG-" + Math.floor(100000 + Math.random() * 900000),
        monto: f.deuda || 30,
        rawFecha: new Date()
      });
    }
  });

  allPayments.sort((a, b) => new Date(a.rawFecha || 0) - new Date(b.rawFecha || 0));

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "Fecha de Pago;Carnet de Identidad (CI);Nombre Completo del Fraterno;Bloque de Baile;Tipo de Fraterno;Concepto del Pago;Metodo de Pago;Referencia;Monto Cancelado (Bs)\n";

  allPayments.forEach(p => {
    const row = [
      `"${p.fecha}"`,
      p.ci,
      `"${p.nombre}"`,
      `"${p.bloque}"`,
      p.categoria,
      `"${p.concepto}"`,
      `"${p.metodo}"`,
      `"${p.referencia}"`,
      p.monto
    ].join(";");
    csvContent += row + "\n";
  });

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const filename = `Reporte_Caja_Illimani_${dateStr}.csv`;

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Reporte Financiero', `Archivo '${filename}' ordenado cronológicamente descargado.`, 'success');
}

function exportarLogisticaTallas() {
  const fraternos = getFraternos();
  const sorted = [...fraternos].sort((a, b) => (a.bloque || '').localeCompare(b.bloque || ''));

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "Bloque de Baile;Tipo de Fraterno;Carnet de Identidad;Nombre Completo del Fraterno;Talla de Polera;Talla de Chamarra;Talla de Canguro;Telefono Celular\n";

  sorted.forEach(f => {
    const tallas = f.tallas || {};
    const row = [
      `"${f.bloque || ''}"`,
      f.categoria || calcularCategoria(f.anioIngreso),
      f.ci || '',
      `"${f.nombre || ''}"`,
      tallas.polera || '-',
      tallas.chamarra || '-',
      tallas.canguro || '-',
      f.telefono || ''
    ].join(";");
    csvContent += row + "\n";
  });

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const filename = `Logistica_Tallas_Illimani_${dateStr}.csv`;

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Logística de Tallas', `Archivo '${filename}' generado.`, 'success');
}

function exportarCSV() {
  const fraternos = getFraternos();
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "CI;Nombre;Bloque;AnioIngreso;Categoria;FechaNacimiento;HoraEntrada;HoraSalida;Estado;Deuda (BOB);Ficha Medica;Contacto Emergencia\n";

  fraternos.forEach(f => {
    const row = [
      f.ci,
      `"${f.nombre}"`,
      f.bloque,
      f.anioIngreso,
      f.categoria,
      f.fechaNacimiento,
      f.horaEntrada || "",
      f.horaSalida || "",
      f.estadoAsistencia || "Pendiente",
      f.deuda || 0,
      `"${f.ficha_medica || ''}"`,
      `"${f.contacto_emergencia || ''}"`
    ].join(";");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `asistencia_bloque_illimani_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Reporte CSV', 'Planilla exportada delimitada por punto y coma (;)', 'success');
}

function openModalCrearEnsayo() {
  const modal = document.getElementById('modalCrearEnsayo');
  if (modal) modal.classList.add('active');
}

function closeModalCrearEnsayo() {
  const modal = document.getElementById('modalCrearEnsayo');
  if (modal) modal.classList.remove('active');
}

function setModoMarcadoEnsayo(ensayoId, modo) {
  if (!AppState.ensayos) AppState.ensayos = [];
  if (ensayoId) AppState.ensayoActivoId = ensayoId;

  const activeEnsayo = AppState.ensayos.find(e => e.id === AppState.ensayoActivoId);
  if (activeEnsayo) {
    activeEnsayo.estadoMarcado = modo; // 'ENTRADA' | 'SALIDA'
  }

  currentScanMode = modo;
  saveState();
  renderAdminData();

  if (modo === 'ENTRADA') {
    showToast('Ingreso Habilitado', `🟢 Se habilitó el marcado de INGRESO para '${activeEnsayo ? activeEnsayo.desc : 'Ensayo General'}'.`, 'success', 4000);
  } else if (modo === 'SALIDA') {
    showToast('Salida Habilitada', `🔵 Se habilitó el marcado de SALIDA para '${activeEnsayo ? activeEnsayo.desc : 'Ensayo General'}'.`, 'success', 4000);
  }
}

function updateScanModeUI() {
  const btnModeEntrada = document.getElementById('btnModeEntrada');
  const btnModeSalida = document.getElementById('btnModeSalida');
  const badgeScanMode = document.getElementById('badgeScanModeActive');
  const statusText = document.getElementById('scannerStatusText');

  const activeEnsayo = (AppState.ensayos || []).find(e => e.id === AppState.ensayoActivoId);
  const currentMode = activeEnsayo && activeEnsayo.estadoMarcado ? activeEnsayo.estadoMarcado : currentScanMode;

  if (btnModeEntrada && btnModeSalida) {
    if (currentMode === 'ENTRADA') {
      btnModeEntrada.classList.add('active');
      btnModeSalida.classList.remove('active');
    } else {
      btnModeSalida.classList.add('active');
      btnModeEntrada.classList.remove('active');
    }
  }

  if (badgeScanMode) {
    if (currentMode === 'ENTRADA') {
      badgeScanMode.textContent = '🟢 MARCADOS DE INGRESO HABILITADOS';
      badgeScanMode.className = 'badge badge-gold';
    } else {
      badgeScanMode.textContent = '🔵 MARCADOS DE SALIDA HABILITADOS';
      badgeScanMode.className = 'badge';
      badgeScanMode.style.background = 'rgba(13, 110, 253, 0.2)';
      badgeScanMode.style.color = '#0D6EFD';
      badgeScanMode.style.border = '1px solid #0D6EFD';
    }
  }

  if (statusText) {
    statusText.innerHTML = currentMode === 'ENTRADA'
      ? `<i class="fa-solid fa-camera"></i> Cámara activada: Escaneando Hora de <strong>INGRESO</strong> por QR...`
      : `<i class="fa-solid fa-camera"></i> Cámara activada: Escaneando Hora de <strong>SALIDA</strong> por QR...`;
  }
}

function renderTablaEnsayosProgramados() {
  const tbody = document.getElementById('tablaEnsayosProgramadosBody');
  if (!tbody) return;

  const ensayos = AppState.ensayos || [];
  if (ensayos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1rem;">No hay días de ensayo general programados.</td></tr>`;
    return;
  }

  tbody.innerHTML = ensayos.map(e => {
    const isActive = e.id === AppState.ensayoActivoId;
    const estadoMarcado = e.estadoMarcado || (isActive ? currentScanMode : 'ENTRADA');

    let badgeClass = 'badge-gold';
    let estadoLabel = '🟢 Ingreso Habilitado';

    if (e.cerrado) {
      badgeClass = 'badge-danger';
      estadoLabel = '🔴 Ensayo Concluido';
    } else if (estadoMarcado === 'SALIDA') {
      badgeClass = 'badge-primary';
      estadoLabel = '🔵 Salida Habilitada';
    }

    return `
      <tr style="${isActive ? 'background: rgba(255, 215, 0, 0.06); border-left: 3px solid var(--color-gold);' : ''}">
        <td><strong>${e.fecha}</strong> ${isActive ? '<span class="badge badge-gold" style="font-size:0.7rem; margin-left:0.3rem;">ACTIVO</span>' : ''}</td>
        <td>${e.desc}</td>
        <td>${e.horaInicio || '10:30'} AM</td>
        <td><span class="badge ${badgeClass}">${estadoLabel}</span></td>
        <td>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            ${!isActive ? `
              <button class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="seleccionarEnsayoActivo('${e.id}')">
                <i class="fa-solid fa-calendar-check"></i> Activar Día
              </button>
            ` : ''}
            <button class="btn btn-gold" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; background: #198754; border-color: #198754; color: #fff;" onclick="setModoMarcadoEnsayo('${e.id}', 'ENTRADA')">
              <i class="fa-solid fa-right-to-bracket"></i> Habilitar Ingreso
            </button>
            <button class="btn btn-gold" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; background: #0D6EFD; border-color: #0D6EFD; color: #fff;" onclick="setModoMarcadoEnsayo('${e.id}', 'SALIDA')">
              <i class="fa-solid fa-right-from-bracket"></i> Habilitar Salida
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function seleccionarEnsayoActivo(ensayoId) {
  AppState.ensayoActivoId = ensayoId;
  saveState();
  renderAdminData();
  const ens = (AppState.ensayos || []).find(e => e.id === ensayoId);
  showToast('Ensayo Seleccionado', `Se activó la fecha '${ens ? ens.desc : ensayoId}'.`, 'success', 2500);
}

function guardarNuevoEnsayo(e) {
  e.preventDefault();
  const fecha = document.getElementById('newEnsayoFecha').value;
  const desc = document.getElementById('newEnsayoDesc').value.trim();
  const horaInicio = document.getElementById('newEnsayoHoraInicio').value;
  const tolerancia = parseInt(document.getElementById('newEnsayoTolerancia').value, 10) || 10;

  if (!fecha || !desc) {
    showToast('Campos Incompletos', 'Ingrese la fecha y el lugar/descripción del ensayo.', 'error');
    return;
  }

  const id = "ENS-" + fecha;
  const nuevoEnsayo = {
    id: id,
    fecha: fecha,
    desc: desc,
    horaInicio: horaInicio,
    horaTolerancia: tolerancia,
    estadoMarcado: "ENTRADA",
    cerrado: false
  };

  if (!AppState.ensayos) AppState.ensayos = [];
  AppState.ensayos.push(nuevoEnsayo);
  AppState.ensayoActivoId = id;
  if (!AppState.asistencias) AppState.asistencias = {};
  AppState.asistencias[id] = {};

  saveState();
  closeModalCrearEnsayo();
  renderAdminData();

  showToast('Ensayo Programado', `Nuevo Ensayo General '${desc}' programado para el ${fecha}.`, 'success', 4000);
}

function renderEnsayosSelector() {
  const select = document.getElementById('selectEnsayoActivo');
  const detailsEl = document.getElementById('infoEnsayoSelectedDetails');
  const badgeStatus = document.getElementById('badgeEnsayoStatus');
  if (!select) return;

  const ensayos = AppState.ensayos || [];
  if (!AppState.ensayoActivoId && ensayos.length > 0) {
    AppState.ensayoActivoId = ensayos[0].id;
  }

  select.innerHTML = ensayos.map(e => `
    <option value="${e.id}" ${e.id === AppState.ensayoActivoId ? 'selected' : ''}>
      📅 ${e.fecha} • ${e.desc} (Hora: ${e.horaInicio || '10:30'} AM)
    </option>
  `).join('');

  const activeEnsayo = ensayos.find(e => e.id === AppState.ensayoActivoId);
  if (activeEnsayo) {
    if (detailsEl) {
      detailsEl.innerHTML = `Ensayo: <strong>${activeEnsayo.desc}</strong> | Fecha: <strong>${activeEnsayo.fecha}</strong> | Hora Inicio: <strong>${activeEnsayo.horaInicio || '10:30'} AM</strong> | Tolerancia: <strong>${activeEnsayo.horaTolerancia || 10} Min</strong> | Multa Atraso: <strong>Bs 30</strong> | Falta: <strong>Bs 50</strong>`;
    }
    if (badgeStatus) {
      const modeLabel = activeEnsayo.estadoMarcado === 'SALIDA' ? 'Salida Habilitada' : 'Ingreso Habilitado';
      badgeStatus.textContent = activeEnsayo.cerrado ? 'Ensayo Concluido' : modeLabel;
      badgeStatus.className = activeEnsayo.cerrado ? 'badge badge-danger' : 'badge badge-gold';
    }
  }
}

function exportarReporteAsistenciaDia(targetEnsayoId = null) {
  const ensayoId = targetEnsayoId || AppState.ensayoActivoId || (AppState.ensayos && AppState.ensayos[0] ? AppState.ensayos[0].id : "ENS-2026-09-20");
  const ensayo = (AppState.ensayos || []).find(e => e.id === ensayoId) || { fecha: "Fecha", desc: "Ensayo General" };
  const asistenciasDia = (AppState.asistencias && AppState.asistencias[ensayoId]) ? AppState.asistencias[ensayoId] : {};
  const fraternos = getFraternos();

  const sorted = [...fraternos].sort((a, b) => (a.bloque || '').localeCompare(b.bloque || ''));

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += `Fecha de Ensayo;Lugar/Descripcion;Carnet de Identidad (CI);Nombre Completo del Fraterno;Bloque de Baile;Tipo de Fraterno;Hora Exacta Entrada;Hora Exacta Salida;Estado Asistencia;Multa Generada (Bs);Observaciones Medica\n`;

  sorted.forEach(f => {
    const record = asistenciasDia[f.ci] || {};
    const horaEntrada = record.horaEntrada || f.horaEntrada || "Sin Marcado";
    const horaSalida = record.horaSalida || f.horaSalida || "Sin Marcado";
    const estado = record.estadoAsistencia || f.estadoAsistencia || "Pendiente";
    const multa = record.multaBob !== undefined ? record.multaBob : (f.multaBob || 0);

    const row = [
      `"${ensayo.fecha}"`,
      `"${ensayo.desc}"`,
      f.ci,
      `"${f.nombre}"`,
      `"${f.bloque}"`,
      f.categoria || calcularCategoria(f.anioIngreso),
      `"${horaEntrada}"`,
      `"${horaSalida}"`,
      `"${estado}"`,
      multa,
      `"${f.ficha_medica || 'Ninguna'}"`
    ].join(";");
    csvContent += row + "\n";
  });

  const filename = `Reporte_Asistencia_Ensayo_${ensayo.fecha}.csv`;
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Reporte de Asistencia por Día', `Planilla '${filename}' generada con marcados exactos de entrada y salida.`, 'success', 5000);
}

function openModalCrearCuota() {
  const modal = document.getElementById('modalCrearCuota');
  if (modal) modal.classList.add('active');
}

function closeModalCrearCuota() {
  const modal = document.getElementById('modalCrearCuota');
  if (modal) modal.classList.remove('active');
}

function guardarNuevaCuota(e) {
  e.preventDefault();
  const nombre = document.getElementById('newCuotaNombre').value.trim();
  const fechaLimite = document.getElementById('newCuotaFechaLimite').value;
  const monto = parseFloat(document.getElementById('newCuotaMonto').value) || 0;

  if (!nombre || !fechaLimite || monto <= 0) {
    showToast('Campos Incompletos', 'Ingrese el nombre, fecha límite y monto válido.', 'error');
    return;
  }

  const id = "HITO-" + Math.floor(100 + Math.random() * 900);
  const nuevaCuota = { id, nombre, fechaLimite, monto };

  if (!AppState.hitosCuotas) AppState.hitosCuotas = [];
  AppState.hitosCuotas.push(nuevaCuota);
  saveState();

  closeModalCrearCuota();
  renderAdminData();

  showToast('Cuota Programada', `Se programó '${nombre}' (Bs ${monto}) con fecha límite ${fechaLimite}.`, 'success', 4000);
}

function openModalPagoManual(prefillCI = '', defaultTipo = 'CUOTA') {
  const modal = document.getElementById('modalPagoManual');
  const selFraterno = document.getElementById('manualPagoFraterno');
  const selTipo = document.getElementById('manualPagoTipo');
  const selCuota = document.getElementById('manualPagoCuotaSelect');
  const groupCuotaSel = document.getElementById('groupManualCuotaSelect');
  const dateInput = document.getElementById('manualPagoFecha');

  if (!modal) return;

  const fraternos = getFraternos();
  if (selFraterno) {
    selFraterno.innerHTML = '<option value="">-- Seleccionar Fraterno --</option>' +
      fraternos.map(f => `<option value="${f.ci}">${f.nombre} (${f.bloque} - CI: ${f.ci})</option>`).join('');
    if (prefillCI) selFraterno.value = prefillCI;
  }

  if (selCuota) {
    const cuotas = AppState.hitosCuotas || [];
    selCuota.innerHTML = cuotas.map(c => `<option value="${c.id}">${c.nombre} (Bs ${c.monto} - Límite: ${c.fechaLimite})</option>`).join('');
  }

  if (selTipo) selTipo.value = defaultTipo;
  if (groupCuotaSel) groupCuotaSel.style.display = defaultTipo === 'CUOTA' ? 'block' : 'none';

  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0,10);
  }

  modal.classList.add('active');
}

function closeModalPagoManual() {
  const modal = document.getElementById('modalPagoManual');
  if (modal) modal.classList.remove('active');
}

function guardarPagoManual(e) {
  e.preventDefault();

  const ci = document.getElementById('manualPagoFraterno').value;
  const tipo = document.getElementById('manualPagoTipo').value; // 'CUOTA' vs 'MULTA'
  const hitoId = document.getElementById('manualPagoCuotaSelect').value;
  const fecha = document.getElementById('manualPagoFecha').value || new Date().toLocaleDateString();
  const monto = parseFloat(document.getElementById('manualPagoMonto').value) || 0;
  const conceptoInput = document.getElementById('manualPagoConcepto').value.trim();

  if (!ci || monto <= 0) {
    showToast('Datos Inválidos', 'Seleccione un fraterno e ingrese un monto válido.', 'error');
    return;
  }

  let fraternos = getFraternos();
  const dancer = fraternos.find(f => f.ci === ci);
  if (!dancer) return;

  if (!dancer.pagos) dancer.pagos = [];

  let conceptoFinal = conceptoInput;
  if (!conceptoFinal) {
    if (tipo === 'CUOTA') {
      const cuotaObj = (AppState.hitosCuotas || []).find(c => c.id === hitoId);
      conceptoFinal = cuotaObj ? cuotaObj.nombre : "Pago de Cuota Programada";
    } else {
      conceptoFinal = "Pago de Multa por Asistencia";
    }
  }

  const nuevoPago = {
    id: "PAY-" + Math.floor(100000 + Math.random() * 900000),
    tipo: tipo,
    hitoId: tipo === 'CUOTA' ? hitoId : null,
    concepto: conceptoFinal,
    monto: monto,
    fecha: fecha,
    metodo: "Cobro Manual (Tesorería)",
    status: "aprobado",
    registradoPor: "Encargado de Pagos"
  };

  dancer.pagos.push(nuevoPago);

  if (tipo === 'MULTA') {
    dancer.deuda = Math.max(0, (dancer.deuda || 0) - monto);
  }

  saveFraternos(fraternos);
  closeModalPagoManual();
  renderAdminData();

  showToast('Pago Registrado', `Se registró el pago manual de Bs ${monto} (${tipo === 'CUOTA' ? 'Cuota' : 'Multa'}) para ${dancer.nombre}.`, 'success', 4000);
}

function renderTablaCuotasProgramadas() {
  const tbody = document.getElementById('tablaCuotasProgramadasBody');
  if (!tbody) return;

  const hitos = AppState.hitosCuotas || [];
  if (hitos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No hay cuotas financieras programadas.</td></tr>`;
    return;
  }

  const fraternos = getFraternos();

  tbody.innerHTML = hitos.map(h => {
    let alDiaCount = 0;
    fraternos.forEach(f => {
      const pagado = (f.pagos || []).some(p => p.status === 'aprobado' && (p.hitoId === h.id || (p.tipo === 'CUOTA' && p.concepto && p.concepto.toLowerCase().includes(h.nombre.toLowerCase()))));
      if (pagado) alDiaCount++;
    });

    return `
      <tr>
        <td><strong>${h.nombre}</strong></td>
        <td><i class="fa-solid fa-calendar-day" style="color: var(--color-gold);"></i> ${h.fechaLimite}</td>
        <td><strong style="color: #2ECC71; font-size: 1.05rem;">Bs ${h.monto}</strong></td>
        <td><span class="badge badge-gold">${alDiaCount} de ${fraternos.length} Fraternos Al Día</span></td>
        <td>
          <button class="btn btn-outline" style="padding: 0.3rem 0.7rem; font-size: 0.8rem;" onclick="openModalPagoManual('', 'CUOTA')">
            <i class="fa-solid fa-hand-holding-dollar"></i> Cobrar Cuota
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRegistroMultasTable() {
  const tbody = document.getElementById('tablaRegistroMultasBody');
  if (!tbody) return;

  const fraternos = getFraternos();
  const activeEnsayoId = AppState.ensayoActivoId || (AppState.ensayos && AppState.ensayos[0] ? AppState.ensayos[0].id : "ENS-2026-09-20");
  const asistenciasDia = (AppState.asistencias && AppState.asistencias[activeEnsayoId]) ? AppState.asistencias[activeEnsayoId] : {};

  tbody.innerHTML = fraternos.map(f => {
    const rec = asistenciasDia[f.ci] || {};
    const multasGeneradas = (rec.multaBob !== undefined ? rec.multaBob : (f.multaBob || 0)) + (f.multasAcumuladas || 0);

    const multasPagadas = (f.pagos || [])
      .filter(p => p.status === 'aprobado' && (p.tipo === 'MULTA' || (!p.tipo && !p.hitoId)))
      .reduce((sum, p) => sum + (p.monto || 0), 0);

    const saldoPendiente = Math.max(0, (f.deuda || 0));

    return `
      <tr>
        <td><strong>${f.nombre}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(CI: ${f.ci})</span></td>
        <td>${f.bloque}</td>
        <td>Bs ${multasGeneradas}</td>
        <td><span style="color: #2ECC71; font-weight: 700;">Bs ${multasPagadas}</span></td>
        <td><strong style="color: ${saldoPendiente > 0 ? 'var(--color-secondary)' : '#2ECC71'}; font-size: 1rem;">Bs ${saldoPendiente}</strong></td>
        <td>
          <button class="btn btn-gold" style="padding: 0.3rem 0.7rem; font-size: 0.8rem; background: linear-gradient(135deg, #DC3545 0%, #B02A37 100%); color: #FFF; border: none;" onclick="openModalPagoManual('${f.ci}', 'MULTA')">
            <i class="fa-solid fa-gavel"></i> Registrar Cobro Multa
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRegistroCuotasTable() {
  const tbody = document.getElementById('tablaRegistroCuotasBody');
  if (!tbody) return;

  const fraternos = getFraternos();
  const hitos = AppState.hitosCuotas || [];

  tbody.innerHTML = fraternos.map(f => {
    const pagosApproved = (f.pagos || []).filter(p => p.status === 'aprobado');
    
    let cuotasCanceladasCount = 0;
    hitos.forEach(h => {
      const pagado = pagosApproved.some(p => p.hitoId === h.id || (p.tipo === 'CUOTA' && p.concepto && p.concepto.toLowerCase().includes(h.nombre.toLowerCase())));
      if (pagado) cuotasCanceladasCount++;
    });

    const totalAbonadoCuotas = pagosApproved
      .filter(p => p.tipo === 'CUOTA' || p.hitoId)
      .reduce((sum, p) => sum + (p.monto || 0), 0);

    return `
      <tr>
        <td><strong>${f.nombre}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(CI: ${f.ci})</span></td>
        <td>${f.bloque}</td>
        <td>${hitos.length} Cuotas Programadas</td>
        <td><span class="badge ${cuotasCanceladasCount === hitos.length ? 'badge-puntual' : 'badge-gold'}">${cuotasCanceladasCount} de ${hitos.length} Pagadas</span></td>
        <td><strong style="color: #2ECC71; font-size: 1rem;">Bs ${totalAbonadoCuotas}</strong></td>
        <td>
          <button class="btn btn-gold" style="padding: 0.3rem 0.7rem; font-size: 0.8rem; background: linear-gradient(135deg, #0D6EFD 0%, #0B5ED7 100%); color: #FFF; border: none;" onclick="openModalPagoManual('${f.ci}', 'CUOTA')">
            <i class="fa-solid fa-file-invoice-dollar"></i> Registrar Cobro Cuota
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderCuotasProgramadasFraterno(dancer) {
  const container = document.getElementById('contenedorCuotasProgramadasFraterno');
  const summaryBadge = document.getElementById('userCuotasSummary');
  if (!container) return;

  const hitos = AppState.hitosCuotas || [];
  if (hitos.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1rem;">No hay cuotas financieras programadas activas.</div>`;
    if (summaryBadge) summaryBadge.textContent = '0 Cuotas';
    return;
  }

  const pagosApproved = (dancer.pagos || []).filter(p => p.status === 'aprobado');
  let paidCount = 0;

  container.innerHTML = hitos.map(hito => {
    const paidMatch = pagosApproved.find(p => p.hitoId === hito.id || (p.tipo === 'CUOTA' && p.concepto && p.concepto.toLowerCase().includes(hito.nombre.toLowerCase())));

    let statusBadge = '';
    if (paidMatch) {
      statusBadge = `<span class="badge badge-puntual" style="padding: 0.4rem 0.8rem; font-weight: 700;">🟢 PAGADO (Bs ${paidMatch.monto})</span>`;
      paidCount++;
    } else {
      statusBadge = `<span class="badge badge-danger" style="padding: 0.4rem 0.8rem; font-weight: 700;">🔴 PENDIENTE DE PAGO</span>`;
    }

    return `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 12px; padding: 1rem; margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;">
        <div>
          <strong style="color: var(--color-white); font-size: 1.05rem;">${hito.nombre}</strong>
          <div style="font-size: 0.85rem; color: var(--color-gold); margin-top: 0.2rem;">
            <i class="fa-solid fa-calendar-day"></i> Fecha Límite: <strong>${hito.fechaLimite}</strong> • Monto: <strong>Bs ${hito.monto}</strong>
          </div>
        </div>
        <div>
          ${statusBadge}
        </div>
      </div>
    `;
  }).join('');

  if (summaryBadge) summaryBadge.textContent = `${paidCount} de ${hitos.length} Cuotas Canceladas`;
}

function updateProfileFinancialSummary(dancer) {
  const elMultasDebt = document.getElementById('profileMultasDebt');
  const elCuotasDebt = document.getElementById('profileCuotasDebt');
  const elDebtDetail = document.getElementById('profileDebtDetail');

  const hitos = AppState.hitosCuotas || [];
  const totalCuotasMonto = hitos.reduce((sum, h) => sum + (h.monto || 0), 0);

  const pagosApproved = (dancer.pagos || []).filter(p => p.status === 'aprobado');

  const cuotasPagadasMonto = pagosApproved
    .filter(p => p.tipo === 'CUOTA' || p.hitoId)
    .reduce((sum, p) => sum + (p.monto || 0), 0);

  const multasPagadasMonto = pagosApproved
    .filter(p => p.tipo === 'MULTA' || (!p.tipo && !p.hitoId))
    .reduce((sum, p) => sum + (p.monto || 0), 0);

  const saldoMultas = Math.max(0, (dancer.deuda || 0));
  const saldoCuotas = Math.max(0, totalCuotasMonto - cuotasPagadasMonto);

  if (elMultasDebt) elMultasDebt.textContent = `Bs ${saldoMultas}`;
  if (elCuotasDebt) elCuotasDebt.textContent = `Bs ${saldoCuotas}`;

  if (elDebtDetail) {
    if (saldoMultas === 0 && saldoCuotas === 0) {
      elDebtDetail.innerHTML = `<span style="color: #2ECC71; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> ¡Felicidades! Su cuenta corriente se encuentra totalmente al día.</span>`;
    } else {
      elDebtDetail.innerHTML = `Resumen: Pendiente de Multas: <strong style="color: var(--color-secondary);">Bs ${saldoMultas}</strong> | Pendiente de Cuotas: <strong style="color: #3498DB;">Bs ${saldoCuotas}</strong>`;
    }
  }
}

function renderAdminData() {
  const fraternos = getFraternos();

  renderEnsayosSelector();
  renderTablaEnsayosProgramados();
  updateScanModeUI();

  const activeEnsayoId = AppState.ensayoActivoId || (AppState.ensayos && AppState.ensayos[0] ? AppState.ensayos[0].id : "ENS-2026-09-20");
  const asistenciasDia = (AppState.asistencias && AppState.asistencias[activeEnsayoId]) ? AppState.asistencias[activeEnsayoId] : {};

  const statTotal = document.getElementById('statTotalFraternos');
  const statPresentes = document.getElementById('statPresentes');
  const statMultas = document.getElementById('statMultasBob');
  const statCaja = document.getElementById('statCajaRecaudada');
  const statAlertas = document.getElementById('statAlertasMedicas');
  const statRecMultas = document.getElementById('statRecaudadoMultas');
  const statRecCuotas = document.getElementById('statRecaudadoCuotas');

  if (statTotal) statTotal.textContent = fraternos.length;
  
  const marcadosEntradaCount = fraternos.filter(f => {
    const rec = asistenciasDia[f.ci] || {};
    return rec.horaEntrada || f.horaEntrada;
  }).length;
  if (statPresentes) statPresentes.textContent = marcadosEntradaCount;
  
  const totalMultas = fraternos.reduce((sum, f) => {
    const rec = asistenciasDia[f.ci] || {};
    return sum + (rec.multaBob !== undefined ? rec.multaBob : (f.multaBob || 0));
  }, 0);
  if (statMultas) statMultas.textContent = `Bs ${totalMultas}`;
  
  const totalCaja = fraternos.reduce((sum, f) => {
    const pAprobados = (f.pagos || []).filter(p => p.status === 'aprobado').reduce((a, b) => a + (b.monto || 0), 0);
    return sum + pAprobados;
  }, 0);
  if (statCaja) statCaja.textContent = `Bs ${totalCaja}`;

  const totalMultasRecaudadas = fraternos.reduce((sum, f) => {
    const pAprobadosMulta = (f.pagos || []).filter(p => p.status === 'aprobado' && (p.tipo === 'MULTA' || (!p.tipo && !p.hitoId))).reduce((a, b) => a + (b.monto || 0), 0);
    return sum + pAprobadosMulta;
  }, 0);

  const totalCuotasRecaudadas = fraternos.reduce((sum, f) => {
    const pAprobadosCuota = (f.pagos || []).filter(p => p.status === 'aprobado' && (p.tipo === 'CUOTA' || p.hitoId)).reduce((a, b) => a + (b.monto || 0), 0);
    return sum + pAprobadosCuota;
  }, 0);

  if (statRecMultas) statRecMultas.textContent = `Bs ${totalMultasRecaudadas}`;
  if (statRecCuotas) statRecCuotas.textContent = `Bs ${totalCuotasRecaudadas}`;

  const totalAlertas = fraternos.filter(f => f.ficha_medica && f.ficha_medica.trim().toLowerCase() !== 'ninguna').length;
  if (statAlertas) statAlertas.textContent = totalAlertas;

  const quickPillsContainer = document.getElementById('quickScanPillsContainer');
  if (quickPillsContainer) {
    quickPillsContainer.innerHTML = fraternos.map(f => `
      <button type="button" class="pill-fraterno" onclick="processQRScan('${f.ci}')">
        <i class="fa-solid fa-qrcode"></i> ${f.nombre} (${f.bloque} - ${f.categoria})
      </button>
    `).join('');
  }

  const selectLicencia = document.getElementById('selectFraternoLicencia');
  if (selectLicencia) {
    selectLicencia.innerHTML = '<option value="">-- Seleccionar Danzante --</option>' + 
      fraternos.map(f => `<option value="${f.ci}">${f.nombre} (${f.bloque} - CI: ${f.ci})</option>`).join('');
  }

  const selectStaff = document.getElementById('selectStaffFraterno');
  if (selectStaff) {
    selectStaff.innerHTML = '<option value="">-- Seleccionar Fraterno para Configurar Permiso --</option>' +
      fraternos.map(f => `<option value="${f.ci}">${f.nombre} (${getRoleTitle(f.roleType)} - CI: ${f.ci})</option>`).join('');
  }

  const tableBody = document.getElementById('attendanceTableBody');
  if (tableBody) {
    tableBody.innerHTML = fraternos.map(f => {
      const rec = asistenciasDia[f.ci] || {};
      const hEntrada = rec.horaEntrada || f.horaEntrada || '-';
      const hSalida = rec.horaSalida || f.horaSalida || '-';
      const estAsist = rec.estadoAsistencia || f.estadoAsistencia || 'Pendiente';

      let badgeClass = 'badge-puntual';
      if (estAsist === 'Atraso') badgeClass = 'badge-atraso';
      if (estAsist === 'Falta') badgeClass = 'badge-falta';
      if (estAsist === 'Licencia Justificada') badgeClass = 'badge-licencia';

      const hasAlert = f.ficha_medica && f.ficha_medica.trim().toLowerCase() !== 'ninguna';

      return `
        <tr>
          <td>
            <strong>${f.nombre}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">CI: ${f.ci}</div>
          </td>
          <td>
            ${f.bloque}
            <span style="display:block; font-size:0.75rem; color: ${f.categoria === 'Antiguo' ? 'var(--color-gold)' : '#FF6B6B'}; font-weight:700;">
              ${f.categoria} (${f.anioIngreso})
            </span>
          </td>
          <td>
            <span class="badge" style="background: rgba(255,255,255,0.08); color: var(--color-gold); font-size: 0.75rem;">
              ${getRoleTitle(f.roleType)}
            </span>
          </td>
          <td><strong style="color: #2ECC71;">${hEntrada}</strong></td>
          <td><strong style="color: #E67E22;">${hSalida}</strong></td>
          <td><span class="badge ${badgeClass}">${estAsist}</span></td>
          <td>
            ${hasAlert 
              ? `<span class="badge badge-medical" onclick="showMedicalAlertModalByCI('${f.ci}')" style="cursor: pointer;">
                   <i class="fa-solid fa-heart-pulse"></i> ${f.ficha_medica}
                 </span>`
              : '<span style="font-size: 0.8rem; color: var(--text-muted);">Normal</span>'}
          </td>
          <td>
            <strong style="color: ${f.deuda > 0 ? 'var(--color-secondary)' : '#2ECC71'};">
              Bs ${f.deuda || 0}
            </strong>
          </td>
          <td>
            <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="processQRScan('${f.ci}')">
              <i class="fa-solid fa-qrcode"></i> Marcar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderTablaCuotasProgramadas();
  renderRegistroMultasTable();
  renderRegistroCuotasTable();
  renderAdmisionesTable();
  renderReceiptsInbox();
  renderChart(fraternos);
}

function renderChart(fraternos) {
  const canvas = document.getElementById('punctualityChart');
  if (!canvas) return;

  const bloques = ['Varones', 'Cholitas', 'Jachas', 'Miskys'];
  const activeEnsayoId = AppState.ensayoActivoId || (AppState.ensayos && AppState.ensayos[0] ? AppState.ensayos[0].id : "ENS-2026-09-20");
  const asistenciasDia = (AppState.asistencias && AppState.asistencias[activeEnsayoId]) ? AppState.asistencias[activeEnsayoId] : {};

  const puntualesData = bloques.map(b => fraternos.filter(f => {
    if (f.bloque !== b) return false;
    const st = (asistenciasDia[f.ci] ? asistenciasDia[f.ci].estadoAsistencia : f.estadoAsistencia);
    return st === 'Puntual';
  }).length);

  const atrasosData = bloques.map(b => fraternos.filter(f => {
    if (f.bloque !== b) return false;
    const st = (asistenciasDia[f.ci] ? asistenciasDia[f.ci].estadoAsistencia : f.estadoAsistencia);
    return st === 'Atraso';
  }).length);

  const faltasData = bloques.map(b => fraternos.filter(f => {
    if (f.bloque !== b) return false;
    const st = (asistenciasDia[f.ci] ? asistenciasDia[f.ci].estadoAsistencia : f.estadoAsistencia);
    return st === 'Falta';
  }).length);

  if (chartInstance) chartInstance.destroy();

  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: bloques,
      datasets: [
        { label: 'Puntuales (Bs 0)', data: puntualesData, backgroundColor: '#2ECC71' },
        { label: 'Atrasos (Bs 30)', data: atrasosData, backgroundColor: '#E67E22' },
        { label: 'Faltas (Bs 50)', data: faltasData, backgroundColor: '#DA291C' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, color: '#94A3B8' } },
        x: { ticks: { color: '#94A3B8' } }
      },
      plugins: {
        legend: { labels: { color: '#FFFFFF', font: { family: 'Outfit' } } }
      }
    }
  });
}

function renderHistorialEnsayosFraterno(dancer) {
  const container = document.getElementById('contenedorHistorialEnsayosFraterno');
  const summaryBadge = document.getElementById('userAsistenciaSummary');
  if (!container) return;

  const ensayos = AppState.ensayos || [];
  const asistencias = AppState.asistencias || {};
  let marcadosCount = 0;

  if (ensayos.length === 0) {
    container.innerHTML = `<div style="text-align:center; color: var(--text-muted); padding: 1rem;">No hay días de ensayo general programados.</div>`;
    return;
  }

  container.innerHTML = ensayos.map(ens => {
    const record = (asistencias[ens.id] && asistencias[ens.id][dancer.ci]) ? asistencias[ens.id][dancer.ci] : null;

    let entradaText = "Sin marca de entrada";
    let salidaText = "Sin marca de salida";
    let statusClass = "badge-danger";
    let statusLabel = "🔴 SIN MARCAR / AUSENTE";

    if (record) {
      if (record.horaEntrada) entradaText = record.horaEntrada;
      if (record.horaSalida) salidaText = record.horaSalida;

      if (record.estadoAsistencia === 'Licencia Justificada') {
        statusClass = "badge-licencia";
        statusLabel = "📋 LICENCIA JUSTIFICADA";
        marcadosCount++;
      } else if (record.horaEntrada && record.horaSalida) {
        statusClass = "badge-puntual";
        statusLabel = "🟢 MARCADO COMPLETO";
        marcadosCount++;
      } else if (record.horaEntrada) {
        statusClass = "badge-atraso";
        statusLabel = "🟡 SOLO ENTRADA";
        marcadosCount++;
      } else if (record.horaSalida) {
        statusClass = "badge-atraso";
        statusLabel = "🔵 SOLO SALIDA";
        marcadosCount++;
      }
    } else if (dancer.horaEntrada && ens.id === AppState.ensayoActivoId) {
      entradaText = dancer.horaEntrada;
      salidaText = dancer.horaSalida || "Sin marca de salida";
      statusClass = dancer.horaSalida ? "badge-puntual" : "badge-atraso";
      statusLabel = dancer.horaSalida ? "🟢 MARCADO COMPLETO" : "🟡 SOLO ENTRADA";
      marcadosCount++;
    }

    return `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 12px; padding: 1rem; margin-bottom: 0.8rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.6rem;">
          <div>
            <strong style="color: var(--color-white); font-size: 1rem;">${ens.desc}</strong>
            <div style="font-size: 0.8rem; color: var(--color-gold);">
              <i class="fa-solid fa-calendar-day"></i> ${ens.fecha} • Horario Inicio: ${ens.horaInicio || '10:30'} AM
            </div>
          </div>
          <span class="badge ${statusClass}" style="font-size: 0.8rem; padding: 0.4rem 0.7rem;">
            ${statusLabel}
          </span>
        </div>

        <div class="grid-2" style="font-size: 0.85rem; gap: 0.6rem;">
          <div style="background: rgba(0,0,0,0.2); padding: 0.6rem; border-radius: 8px;">
            <i class="fa-solid fa-right-to-bracket" style="color: #2ECC71;"></i> <strong>Hora Entrada:</strong> ${entradaText}
          </div>
          <div style="background: rgba(0,0,0,0.2); padding: 0.6rem; border-radius: 8px;">
            <i class="fa-solid fa-right-from-bracket" style="color: #E67E22;"></i> <strong>Hora Salida:</strong> ${salidaText}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (summaryBadge) summaryBadge.textContent = `${marcadosCount} de ${ensayos.length} Ensayos Marcados`;
}

function initProfilePanel() {
  const activeUser = JSON.parse(localStorage.getItem('sambos_active_user'));
  const ciLogueado = localStorage.getItem('fraterno_logueado');
  const fraternos = getFraternos();
  const dancer = fraternos.find(f => f.ci === (activeUser ? activeUser.ci : ciLogueado)) || activeUser;

  if (!dancer) {
    showToast('No Autenticado', 'Debe iniciar sesión para ver su perfil.', 'error');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
    return;
  }

  // Si el usuario es Administrador o Personal, mostrar botón hacia admin.html
  if (dancer.roleType === 'admin' || dancer.roleType === 'encargado_asistencia' || dancer.roleType === 'encargado_pagos') {
    const btnAdminNav = document.getElementById('btnAdminNavFromProfile');
    if (btnAdminNav) btnAdminNav.style.display = 'inline-flex';
  }

  const elNombre = document.getElementById('perfilNombre');
  const elBloque = document.getElementById('perfilBloque');
  const elCategoria = document.getElementById('perfilCategoria');
  const elCI = document.getElementById('perfilCI');
  const elFecha = document.getElementById('perfilFecha');
  const elAnio = document.getElementById('perfilAnio');
  const elPolera = document.getElementById('tallaPolera');
  const elChamarra = document.getElementById('tallaChamarra');
  const elCanguro = document.getElementById('tallaCanguro');

  if (elNombre) elNombre.textContent = dancer.nombre;
  if (elBloque) elBloque.textContent = `Bloque: ${dancer.bloque}`;
  if (elCategoria) {
    elCategoria.textContent = dancer.categoria || calcularCategoria(dancer.anioIngreso);
    elCategoria.style.background = dancer.categoria === 'Antiguo' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(231, 76, 60, 0.2)';
    elCategoria.style.color = dancer.categoria === 'Antiguo' ? 'var(--color-gold)' : '#FF6B6B';
  }
  if (elCI) elCI.textContent = dancer.ci;
  if (elFecha) elFecha.textContent = dancer.fechaNacimiento || '--/--/----';
  if (elAnio) elAnio.textContent = dancer.anioIngreso || '2026';

  const tallas = dancer.tallas || {};
  if (elPolera) elPolera.textContent = tallas.polera || '-';
  if (elChamarra) elChamarra.textContent = tallas.chamarra || '-';
  if (elCanguro) elCanguro.textContent = tallas.canguro || '-';

  renderHistorialEnsayosFraterno(dancer);
  renderCuotasProgramadasFraterno(dancer);
  updateProfileFinancialSummary(dancer);

  const receiptFileInput = document.getElementById('receiptFile');
  if (receiptFileInput) {
    receiptFileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const previewBox = document.getElementById('receiptPreviewBox');
          const previewImg = document.getElementById('receiptPreviewImg');
          if (previewBox && previewImg) {
            previewImg.src = e.target.result;
            previewBox.style.display = 'block';
          }
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  const formPagoDanzante = document.getElementById('formInformarPago');
  if (formPagoDanzante) {
    formPagoDanzante.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = parseFloat(document.getElementById('receiptAmount').value) || 0;
      const conceptType = document.getElementById('receiptConceptType') ? document.getElementById('receiptConceptType').value : 'CUOTA';
      const fileInput = document.getElementById('receiptFile');

      if (amount <= 0 || !fileInput || !fileInput.files[0]) {
        showToast('Campos Incompletos', 'Ingrese un monto válido y adjunte la foto del comprobante.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64Img = evt.target.result;
        const newPayment = {
          id: "REC-" + Math.floor(100000 + Math.random() * 900000),
          tipo: conceptType,
          monto: amount,
          concepto: conceptType === 'CUOTA' ? "Comprobante de Cuota Programada" : "Comprobante de Multa por Asistencia",
          fecha: new Date().toLocaleDateString(),
          reciboBase64: base64Img,
          status: "pendiente"
        };

        let fraternosList = getFraternos();
        const targetDancer = fraternosList.find(f => f.ci === dancer.ci);
        if (targetDancer) {
          if (!targetDancer.pagos) targetDancer.pagos = [];
          targetDancer.pagos.push(newPayment);
          saveFraternos(fraternosList);
          showToast('Comprobante Enviado', 'Su comprobante en BOB fue enviado a Tesorería para validación.', 'success', 5000);
          formPagoDanzante.reset();
          const previewBox = document.getElementById('receiptPreviewBox');
          if (previewBox) previewBox.style.display = 'none';
        }
      };
      reader.readAsDataURL(fileInput.files[0]);
    });
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('fraterno_logueado');
      localStorage.removeItem('sambos_active_user');
      window.location.href = 'index.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initLocalStorage();

  const path = window.location.pathname;
  if (path.includes('admin.html')) {
    initAdminPanel();
  } else if (path.includes('mi-perfil.html')) {
    initProfilePanel();
  } else {
    initWelcomeAndLogin();
  }
});
