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

// Base de Datos Oficial Inicial Limpia para Producción (Sin usuarios previos)
const OFFICIAL_INITIAL_FRATERNOS = [];

let AppState = {
  configMultas: {
    retraso: 30,
    falta: 50,
    sinSalida: 30
  },
  fraternos: [],       // Danzantes oficiales activos (Inicialmente vacío en producción)
  postulantes: [],     // Postulantes en espera de aprobación por el Administrador
  ensayos: [
    { id: "ENS-2026-09-20", fecha: "2026-09-20", desc: "Ensayo General - Plaza Villarroel", horaInicio: "10:30", horaTolerancia: 10, cerrado: false },
    { id: "ENS-2026-09-27", fecha: "2026-09-27", desc: "Ensayo General - Av. Tejada Sorzano", horaInicio: "10:30", horaTolerancia: 10, cerrado: false },
    { id: "ENS-2026-10-04", fecha: "2026-10-04", desc: "Ensayo Pre-Entrada - Estadio Hernando Siles", horaInicio: "10:30", horaTolerancia: 10, cerrado: false }
  ],
  hitosCuotas: [
    { id: "HITO-1", nombre: "Cuota Ingreso de Bloque", monto: 150, fechaLimite: "2026-10-15" },
    { id: "HITO-2", nombre: "Cuota Inicial Traje de Baile", monto: 350, fechaLimite: "2026-11-01" },
    { id: "HITO-3", nombre: "Cuota Final Traje & Banda", monto: 400, fechaLimite: "2026-12-01" }
  ],
  asistencias: {},
  ensayoActivoId: "ENS-2026-09-20",
  finanzas: {}
};

let fotoRegistroBase64 = "";
let currentScanMode = 'ENTRADA';
let isLateSimulation = false;
let html5QrScanner = null;
let chartInstance = null;

function getMontoMulta(tipo) {
  if (!AppState.configMultas) {
    AppState.configMultas = { retraso: 30, falta: 50, sinSalida: 30 };
  }
  const key = String(tipo).toLowerCase();
  if (key.includes('retraso') || key.includes('atraso')) {
    return AppState.configMultas.retraso !== undefined ? Number(AppState.configMultas.retraso) : 30;
  }
  if (key.includes('falta') || key.includes('inasistencia')) {
    return AppState.configMultas.falta !== undefined ? Number(AppState.configMultas.falta) : 50;
  }
  if (key.includes('salida')) {
    return AppState.configMultas.sinSalida !== undefined ? Number(AppState.configMultas.sinSalida) : 30;
  }
  return 30;
}

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
  const PROD_CLEAN_KEY = "SAMBOS_PROD_CLEAN_V2026_1";
  // Limpieza inicial de depuración: si existen datos demo residuales en el navegador, se purgan para producción
  if (!localStorage.getItem(PROD_CLEAN_KEY)) {
    localStorage.removeItem("SAMBOS_MASTER_STATE");
    localStorage.removeItem("sambos_fraternos");
    localStorage.removeItem("fraternos_illimani");
    localStorage.removeItem("fraterno_logueado");
    localStorage.removeItem("sambos_active_user");
    localStorage.setItem(PROD_CLEAN_KEY, "true");
    AppState.fraternos = [];
    AppState.postulantes = [];
    AppState.finanzas = {};
    saveState();
  }

  const savedMaster = localStorage.getItem("SAMBOS_MASTER_STATE") || localStorage.getItem("sambos_fraternos");
  if (!savedMaster) {
    AppState.fraternos = [];
    AppState.postulantes = [];
    AppState.finanzas = {};
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
      AppState.fraternos = [];
    }
  }

  if (!AppState.fraternos) AppState.fraternos = [];
  if (!AppState.postulantes) AppState.postulantes = [];
  if (!AppState.finanzas) AppState.finanzas = {};
  if (!AppState.configMultas) {
    AppState.configMultas = { retraso: 30, falta: 50, sinSalida: 30 };
  }

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

  if (!AppState.ensayoActivoId && AppState.ensayos && AppState.ensayos.length > 0) {
    AppState.ensayoActivoId = AppState.ensayos[0].id;
  }
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

  const regOrigen = document.getElementById('regOrigen');
  const groupRegPais = document.getElementById('groupRegPaisOrigen');
  const regPais = document.getElementById('regPaisOrigen');
  if (regOrigen && groupRegPais) {
    regOrigen.addEventListener('change', () => {
      if (regOrigen.value === 'Extranjero') {
        groupRegPais.style.display = 'block';
        if (regPais) regPais.required = true;
      } else {
        groupRegPais.style.display = 'none';
        if (regPais) {
          regPais.required = false;
          regPais.value = '';
        }
      }
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
  
  // CONDICIÓN AUTOMÁTICA DE PRODUCCIÓN:
  // Si la tabla de usuarios está vacía, la primera persona que se registre en la plataforma
  // recibe automáticamente el rol de "Administrador" (admin) con acceso total inmediato.
  // Los registros posteriores reciben el rol de "danzante" y quedan pendientes de aprobación.
  const esPrimerUsuario = (!AppState.fraternos || AppState.fraternos.length === 0);
  const roleType = esPrimerUsuario ? 'admin' : 'danzante';

  const tallaPolera = document.getElementById('regTallaPolera').value;
  const tallaChamarra = document.getElementById('regTallaChamarra').value;
  const tallaCanguro = document.getElementById('regTallaCanguro').value;
  const fichaMedica = document.getElementById('regFichaMedica').value.trim();

  const regOrigen = document.getElementById('regOrigen');
  const origenVal = regOrigen ? regOrigen.value : 'Bolivia';
  const regPais = document.getElementById('regPaisOrigen');
  const paisOrigenVal = (origenVal === 'Extranjero' && regPais) ? regPais.value.trim() : '';

  if (origenVal === 'Extranjero' && !paisOrigenVal) {
    showToast('País Obligatorio', 'Por favor indique su país de origen.', 'error');
    return;
  }

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
      origen: origenVal,
      pais_origen: paisOrigenVal,
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

    showToast('Administrador Registrado', `¡Bienvenido ${nombre}! Al ser el primer usuario registrado en la plataforma, se le asignó automáticamente el rol de Administrador con acceso total inmediato.`, 'success', 6000);
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
    origen: origenVal,
    pais_origen: paisOrigenVal,
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
      const montoRetraso = getMontoMulta('retraso');
      showToast('Simulación de Hora', isLateSimulation ? `Hora: 10:45 AM (Atraso Bs ${montoRetraso})` : 'Hora: 10:35 AM (Puntual Bs 0)', isLateSimulation ? 'warning' : 'success');
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

  const btnGuardarMultas = document.getElementById('btnGuardarConfigMultas');
  if (btnGuardarMultas) btnGuardarMultas.addEventListener('click', guardarConfigMultas);

  const formMultas = document.getElementById('formConfigMultas');
  if (formMultas) formMultas.addEventListener('submit', guardarConfigMultas);

  renderAdminData();
}

function guardarConfigMultas(e) {
  if (e) e.preventDefault();

  const inputRetraso = document.getElementById('cfgMultaRetraso');
  const inputFalta = document.getElementById('cfgMultaFalta');
  const inputSinSalida = document.getElementById('cfgMultaSinSalida');

  const retrasoVal = inputRetraso ? Math.max(0, parseInt(inputRetraso.value, 10) || 0) : 30;
  const faltaVal = inputFalta ? Math.max(0, parseInt(inputFalta.value, 10) || 0) : 50;
  const sinSalidaVal = inputSinSalida ? Math.max(0, parseInt(inputSinSalida.value, 10) || 0) : 30;

  AppState.configMultas = {
    retraso: retrasoVal,
    falta: faltaVal,
    sinSalida: sinSalidaVal
  };

  saveState();
  renderAdminData();

  showToast('Tarifas Guardadas', `Multas actualizadas: Retraso Bs ${retrasoVal}, Falta Bs ${faltaVal}, Sin Salida Bs ${sinSalidaVal}.`, 'success', 4000);
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
      const montoAtraso = getMontoMulta('retraso');
      dancer.estadoAsistencia = 'Atraso';
      dancer.multaBob = montoAtraso;
      dancer.deuda = (dancer.deuda || 0) + montoAtraso;
      syncAsistenciaRecord(ci, { horaEntrada: horaActual, estadoAsistencia: 'Atraso', multaBob: montoAtraso });
      showToast('ATRASO REGISTRADO', `[${dancer.nombre}] marcó a las ${horaActual}. Multa Bs ${montoAtraso}`, 'error');
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

  const montoFalta = getMontoMulta('falta');
  const montoSinSalida = getMontoMulta('sinSalida');

  fraternos.forEach(f => {
    if (!f.horaEntrada && f.estadoAsistencia !== 'Licencia Justificada') {
      f.estadoAsistencia = 'Falta';
      f.multaBob = montoFalta;
      f.deuda = (f.deuda || 0) + montoFalta;
      syncAsistenciaRecord(f.ci, { estadoAsistencia: 'Falta', multaBob: montoFalta });
      faltantes++;
    } else if (f.horaEntrada && !f.horaSalida && f.estadoAsistencia !== 'Licencia Justificada') {
      f.multaBob = (f.multaBob || 0) + montoSinSalida;
      f.deuda = (f.deuda || 0) + montoSinSalida;
      syncAsistenciaRecord(f.ci, { multaBob: (f.multaBob || 0) + montoSinSalida, sinSalida: true });
      sinSalida++;
    }
  });

  saveFraternos(fraternos);
  renderAdminData();

  showToast('Ensayo Concluido', `Faltas: ${faltantes} (Bs ${montoFalta}) | Sin Marcado de Salida: ${sinSalida} (Bs ${montoSinSalida}).`, 'warning', 6000);
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
  csvContent += "Bloque de Baile;Tipo de Fraterno;Origen / Pais;Carnet de Identidad;Nombre Completo del Fraterno;Talla de Polera;Talla de Chamarra;Talla de Canguro;Telefono Celular\n";

  sorted.forEach(f => {
    const tallas = f.tallas || {};
    const origenStr = (f.origen === 'Extranjero' && f.pais_origen) ? `${f.pais_origen} (Extranjero)` : (f.origen || 'Bolivia');
    const row = [
      `"${f.bloque || ''}"`,
      f.categoria || calcularCategoria(f.anioIngreso),
      `"${origenStr}"`,
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No hay días de ensayo general programados.</td></tr>`;
    return;
  }

  tbody.innerHTML = ensayos.map(e => {
    const isActive = e.id === AppState.ensayoActivoId;
    const estadoMarcado = e.estadoMarcado || (isActive ? currentScanMode : 'ENTRADA');

    let badgeClass = 'badge-gold';
    let estadoLabel = '🟢 Ingreso Habilitado';

    if (e.cerrado) {
      badgeClass = 'badge-danger';
      estadoLabel = '🔴 Concluido';
    } else if (estadoMarcado === 'SALIDA') {
      badgeClass = 'badge-primary';
      estadoLabel = '🔵 Salida Habilitada';
    }

    return `
      <tr style="${isActive ? 'background: rgba(255, 215, 0, 0.06); border-left: 3px solid var(--color-gold);' : ''}">
        <td>
          <input type="date" id="ensayo_fecha_${e.id}" class="form-control" value="${e.fecha}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; background: var(--bg-card); color: var(--color-white); min-width: 135px;" required>
          ${isActive ? '<span class="badge badge-gold" style="font-size:0.65rem; margin-top:0.3rem; display:inline-block;">DÍA ACTIVO</span>' : ''}
        </td>
        <td>
          <input type="text" id="ensayo_desc_${e.id}" class="form-control" value="${e.desc}" placeholder="Lugar o descripción del ensayo..." style="padding: 0.35rem 0.6rem; font-size: 0.85rem; background: var(--bg-card); color: var(--color-white); min-width: 200px;" required>
        </td>
        <td>
          <input type="time" id="ensayo_hora_${e.id}" class="form-control" value="${e.horaInicio || '10:30'}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; background: var(--bg-card); color: var(--color-white); width: 105px;" required>
        </td>
        <td>
          <span class="badge ${badgeClass}" style="font-size: 0.75rem; white-space: nowrap;">${estadoLabel}</span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-gold" style="padding: 0.35rem 0.65rem; font-size: 0.78rem; font-weight: 700;" onclick="guardarEdicionEnsayo('${e.id}')" title="Guardar y actualizar fecha, lugar y horario">
              <i class="fa-solid fa-floppy-disk"></i> Guardar
            </button>
            ${!isActive ? `
              <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;" onclick="seleccionarEnsayoActivo('${e.id}')" title="Activar este día para escaneo">
                <i class="fa-solid fa-calendar-check"></i> Activar
              </button>
            ` : ''}
            <button class="btn btn-gold" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; background: #198754; border-color: #198754; color: #fff;" onclick="setModoMarcadoEnsayo('${e.id}', 'ENTRADA')" title="Habilitar marcados de ingreso">
              <i class="fa-solid fa-right-to-bracket"></i> Ingreso
            </button>
            <button class="btn btn-gold" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; background: #0D6EFD; border-color: #0D6EFD; color: #fff;" onclick="setModoMarcadoEnsayo('${e.id}', 'SALIDA')" title="Habilitar marcados de salida">
              <i class="fa-solid fa-right-from-bracket"></i> Salida
            </button>
            <button class="btn btn-danger" style="padding: 0.35rem 0.55rem; font-size: 0.75rem;" onclick="eliminarEnsayo('${e.id}')" title="Eliminar este ensayo">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function guardarEdicionEnsayo(id) {
  const ens = (AppState.ensayos || []).find(e => e.id === id);
  if (!ens) return;

  const fechaEl = document.getElementById(`ensayo_fecha_${id}`);
  const descEl = document.getElementById(`ensayo_desc_${id}`);
  const horaEl = document.getElementById(`ensayo_hora_${id}`);

  if (!fechaEl || !descEl) return;

  const newFecha = fechaEl.value.trim();
  const newDesc = descEl.value.trim();
  const newHora = horaEl ? horaEl.value : (ens.horaInicio || '10:30');

  if (!newFecha || !newDesc) {
    showToast('Campos Incompletos', 'La fecha y el lugar/descripción son obligatorios.', 'error');
    return;
  }

  ens.fecha = newFecha;
  ens.desc = newDesc;
  ens.horaInicio = newHora;

  saveState();
  renderAdminData();
  showToast('Ensayo Actualizado', `Se guardaron los cambios para '${newDesc}' (${newFecha}).`, 'success', 3500);
}

function eliminarEnsayo(id) {
  if (!confirm('¿Está seguro de eliminar este ensayo general programado?')) return;
  AppState.ensayos = (AppState.ensayos || []).filter(e => e.id !== id);
  if (AppState.ensayoActivoId === id) {
    AppState.ensayoActivoId = AppState.ensayos.length > 0 ? AppState.ensayos[0].id : null;
  }
  saveState();
  renderAdminData();
  showToast('Ensayo Eliminado', 'El ensayo fue eliminado del cronograma.', 'warning');
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
      const mRetraso = getMontoMulta('retraso');
      const mFalta = getMontoMulta('falta');
      const mSinSalida = getMontoMulta('sinSalida');
      detailsEl.innerHTML = `Ensayo: <strong>${activeEnsayo.desc}</strong> | Fecha: <strong>${activeEnsayo.fecha}</strong> | Hora Inicio: <strong>${activeEnsayo.horaInicio || '10:30'} AM</strong> | Tolerancia: <strong>${activeEnsayo.horaTolerancia || 10} Min</strong> | Multas: Retraso <strong>Bs ${mRetraso}</strong> • Falta <strong>Bs ${mFalta}</strong> • Sin Salida <strong>Bs ${mSinSalida}</strong>`;
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
        <td>
          <input type="text" id="cuota_nombre_${h.id}" class="form-control" value="${h.nombre}" placeholder="Nombre o concepto de la cuota..." style="padding: 0.35rem 0.6rem; font-size: 0.85rem; background: var(--bg-card); color: var(--color-white); min-width: 190px;" required>
        </td>
        <td>
          <input type="date" id="cuota_fecha_${h.id}" class="form-control" value="${h.fechaLimite}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; background: var(--bg-card); color: var(--color-white); min-width: 135px;" required>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.3rem;">
            <span style="font-weight: 700; color: var(--color-gold); font-size: 0.85rem;">Bs</span>
            <input type="number" id="cuota_monto_${h.id}" class="form-control" value="${h.monto}" min="1" step="1" style="padding: 0.35rem 0.5rem; font-size: 0.95rem; font-weight: 800; background: var(--bg-card); color: #2ECC71; width: 100px;" required>
          </div>
        </td>
        <td>
          <span class="badge ${alDiaCount === fraternos.length && fraternos.length > 0 ? 'badge-puntual' : 'badge-gold'}" style="font-size: 0.75rem; white-space: nowrap;">
            ${alDiaCount} de ${fraternos.length} al Día
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-gold" style="padding: 0.35rem 0.65rem; font-size: 0.78rem; font-weight: 700;" onclick="guardarEdicionCuota('${h.id}')" title="Guardar cambios de nombre, fecha y monto">
              <i class="fa-solid fa-floppy-disk"></i> Guardar
            </button>
            <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;" onclick="openModalPagoManual('', 'CUOTA')" title="Cobrar cuota a un fraterno">
              <i class="fa-solid fa-hand-holding-dollar"></i> Cobrar
            </button>
            <button class="btn btn-danger" style="padding: 0.35rem 0.55rem; font-size: 0.75rem;" onclick="eliminarCuota('${h.id}')" title="Eliminar cuota">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function guardarEdicionCuota(id) {
  const cuota = (AppState.hitosCuotas || []).find(c => c.id === id);
  if (!cuota) return;

  const nombreEl = document.getElementById(`cuota_nombre_${id}`);
  const fechaEl = document.getElementById(`cuota_fecha_${id}`);
  const montoEl = document.getElementById(`cuota_monto_${id}`);

  if (!nombreEl || !fechaEl || !montoEl) return;

  const newNombre = nombreEl.value.trim();
  const newFecha = fechaEl.value.trim();
  const newMonto = parseFloat(montoEl.value) || 0;

  if (!newNombre || !newFecha || newMonto <= 0) {
    showToast('Campos Inválidos', 'Verifique que el nombre, fecha y monto en Bs sean válidos.', 'error');
    return;
  }

  cuota.nombre = newNombre;
  cuota.fechaLimite = newFecha;
  cuota.monto = newMonto;

  saveState();
  renderAdminData();
  showToast('Cuota Actualizada', `Se actualizó la cuota '${newNombre}' a Bs ${newMonto} (${newFecha}).`, 'success', 3500);
}

function eliminarCuota(id) {
  if (!confirm('¿Está seguro de eliminar esta cuota programada?')) return;
  AppState.hitosCuotas = (AppState.hitosCuotas || []).filter(c => c.id !== id);
  saveState();
  renderAdminData();
  showToast('Cuota Eliminada', 'La cuota fue eliminada del cronograma financiero.', 'warning');
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

function renderDesgloseMultasFraterno(dancer) {
  const container = document.getElementById('contenedorDesgloseMultasFraterno');
  const summaryBadge = document.getElementById('userMultasSummary');
  if (!container) return;

  const ensayos = AppState.ensayos || [];
  const asistencias = AppState.asistencias || {};
  const montoRetraso = getMontoMulta('retraso');
  const montoFalta = getMontoMulta('falta');
  const montoSinSalida = getMontoMulta('sinSalida');

  // Obtener pagos aprobados destinados a multas
  const pagosApproved = (dancer.pagos || []).filter(p => p.status === 'aprobado');
  const totalMultasAbonadas = pagosApproved
    .filter(p => p.tipo === 'MULTA' || (!p.tipo && !p.hitoId))
    .reduce((sum, p) => sum + (p.monto || 0), 0);

  // Recolectar lista de multas generadas por fecha de ensayo
  const multasLista = [];

  ensayos.forEach(ens => {
    const rec = (asistencias[ens.id] && asistencias[ens.id][dancer.ci]) ? asistencias[ens.id][dancer.ci] : null;

    const estadoAsist = rec ? rec.estadoAsistencia : (ens.id === AppState.ensayoActivoId ? dancer.estadoAsistencia : null);
    const horaEntrada = rec ? rec.horaEntrada : (ens.id === AppState.ensayoActivoId ? dancer.horaEntrada : null);
    const horaSalida = rec ? rec.horaSalida : (ens.id === AppState.ensayoActivoId ? dancer.horaSalida : null);
    const sinSalidaFlag = rec ? (rec.sinSalida || (horaEntrada && !horaSalida && ens.cerrado)) : (horaEntrada && !horaSalida && ens.cerrado);

    if (estadoAsist === 'Licencia Justificada') {
      return; // Licencia anula multa
    }

    // 1. Multa por Retraso
    if (estadoAsist === 'Atraso') {
      multasLista.push({
        ensayoId: ens.id,
        fecha: ens.fecha,
        desc: ens.desc,
        motivo: 'Retraso',
        icono: 'fa-solid fa-clock',
        colorMotivo: '#E67E22',
        monto: montoRetraso
      });
    } else if (estadoAsist === 'Falta' || (ens.cerrado && !horaEntrada)) {
      // 2. Multa por Falta
      multasLista.push({
        ensayoId: ens.id,
        fecha: ens.fecha,
        desc: ens.desc,
        motivo: 'Falta',
        icono: 'fa-solid fa-user-xmark',
        colorMotivo: '#FF6B6B',
        monto: montoFalta
      });
    }

    // 3. Multa por No Marcar Salida
    if (sinSalidaFlag) {
      multasLista.push({
        ensayoId: ens.id,
        fecha: ens.fecha,
        desc: ens.desc,
        motivo: 'No marcar salida',
        icono: 'fa-solid fa-right-from-bracket',
        colorMotivo: '#3498DB',
        monto: montoSinSalida
      });
    }
  });

  // Ordenar cronológicamente por fecha de ensayo
  multasLista.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  if (multasLista.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 1.5rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed var(--border-glass);">
        <i class="fa-solid fa-shield-heart" style="font-size: 2.2rem; color: #2ECC71; margin-bottom: 0.6rem; display: block;"></i>
        <strong style="color: #2ECC71; font-size: 1rem;">¡Sin multas registradas!</strong>
        <p style="margin: 0.3rem 0 0; font-size: 0.85rem;">Su historial de asistencia se encuentra al día y no registra sanciones de ensayo pendientes.</p>
      </div>
    `;
    if (summaryBadge) {
      summaryBadge.textContent = '0 Multas';
      summaryBadge.style.color = '#2ECC71';
    }
    return;
  }

  // Evaluar estado: 'Cancelado' (verde) vs 'Pendiente de Pago' (rojo)
  const deudaActual = dancer.deuda || 0;
  const totalCostoMultas = multasLista.reduce((s, m) => s + m.monto, 0);
  const montoPagado = Math.max(totalMultasAbonadas, Math.max(0, totalCostoMultas - deudaActual));
  let fondoCobro = (deudaActual === 0) ? Infinity : montoPagado;
  let pendientesCount = 0;

  container.innerHTML = multasLista.map(multa => {
    let cancelado = false;
    if (fondoCobro >= multa.monto) {
      cancelado = true;
      fondoCobro -= multa.monto;
    } else {
      cancelado = false;
      pendientesCount++;
    }

    const badgeEstado = cancelado
      ? `<span class="badge" style="background: rgba(46, 204, 113, 0.15); color: #2ECC71; border: 1px solid #2ECC71; padding: 0.45rem 0.9rem; font-size: 0.82rem; font-weight: 800; white-space: nowrap;">
           <i class="fa-solid fa-circle-check"></i> Cancelado
         </span>`
      : `<span class="badge" style="background: rgba(218, 41, 28, 0.15); color: #FF6B6B; border: 1px solid #DA291C; padding: 0.45rem 0.9rem; font-size: 0.82rem; font-weight: 800; white-space: nowrap;">
           <i class="fa-solid fa-circle-exclamation"></i> Pendiente de Pago
         </span>`;

    return `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 12px; padding: 1rem 1.2rem; margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;">
        <div style="flex: 1; min-width: 240px;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
            <strong style="color: var(--color-white); font-size: 0.98rem;">${multa.desc}</strong>
            <span class="badge" style="background: rgba(255,255,255,0.06); color: var(--color-gold); font-size: 0.75rem; border: 1px solid rgba(255,215,0,0.3);">
              <i class="fa-solid fa-calendar-day"></i> ${multa.fecha}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <span class="badge" style="background: rgba(0,0,0,0.3); color: ${multa.colorMotivo}; border: 1px solid ${multa.colorMotivo}; font-size: 0.8rem; font-weight: 700;">
              <i class="${multa.icono}"></i> Motivo: ${multa.motivo}
            </span>
            <span style="font-size: 0.85rem; color: var(--text-muted);">
              Tarifa Fijada: <strong style="color: var(--color-white);">Bs ${multa.monto}</strong>
            </span>
          </div>
        </div>
        <div>
          ${badgeEstado}
        </div>
      </div>
    `;
  }).join('');

  if (summaryBadge) {
    if (pendientesCount === 0) {
      summaryBadge.textContent = `${multasLista.length} Multas (Canceladas)`;
      summaryBadge.style.color = '#2ECC71';
    } else {
      summaryBadge.textContent = `${multasLista.length} Multas (${pendientesCount} Pendientes)`;
      summaryBadge.style.color = '#FF6B6B';
    }
  }
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
  const elDebtDetail = document.getElementById('profileDebtDetail');

  const saldoMultas = Math.max(0, (dancer.deuda || 0));

  if (elMultasDebt) elMultasDebt.textContent = `Bs ${saldoMultas}`;

  if (elDebtDetail) {
    if (saldoMultas === 0) {
      elDebtDetail.innerHTML = `<span style="color: #2ECC71; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> ¡Felicidades! No tiene multas pendientes de asistencia.</span>`;
    } else {
      elDebtDetail.innerHTML = `Estado: Saldo pendiente de multas: <strong style="color: var(--color-secondary);">Bs ${saldoMultas}</strong>`;
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

  const inputRetraso = document.getElementById('cfgMultaRetraso');
  const inputFalta = document.getElementById('cfgMultaFalta');
  const inputSinSalida = document.getElementById('cfgMultaSinSalida');
  if (AppState.configMultas) {
    if (inputRetraso && document.activeElement !== inputRetraso) inputRetraso.value = AppState.configMultas.retraso ?? 30;
    if (inputFalta && document.activeElement !== inputFalta) inputFalta.value = AppState.configMultas.falta ?? 50;
    if (inputSinSalida && document.activeElement !== inputSinSalida) inputSinSalida.value = AppState.configMultas.sinSalida ?? 30;
  }

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
        { label: `Atrasos (Bs ${getMontoMulta('retraso')})`, data: atrasosData, backgroundColor: '#E67E22' },
        { label: `Faltas (Bs ${getMontoMulta('falta')})`, data: faltasData, backgroundColor: '#DA291C' }
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
  if (elBloque) elBloque.textContent = `${dancer.bloque} • Bloque Illimani`;
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

  const elFoto = document.getElementById('perfilFoto');
  if (elFoto) {
    if (dancer.foto && dancer.foto.trim() !== '') {
      elFoto.src = dancer.foto;
    } else {
      elFoto.src = 'escudo.png';
    }
  }

  const btnCambiarFoto = document.getElementById('btnCambiarFotoPerfil');
  const inputCambiarFoto = document.getElementById('inputCambiarFotoPerfil');
  if (btnCambiarFoto && inputCambiarFoto) {
    btnCambiarFoto.addEventListener('click', () => inputCambiarFoto.click());
    inputCambiarFoto.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const newBase64 = e.target.result;
          dancer.foto = newBase64;
          if (elFoto) elFoto.src = newBase64;
          let fraternosList = getFraternos();
          const idx = fraternosList.findIndex(f => f.ci === dancer.ci);
          if (idx !== -1) {
            fraternosList[idx].foto = newBase64;
            saveFraternos(fraternosList);
          }
          localStorage.setItem('sambos_active_user', JSON.stringify(dancer));
          showToast('Fotografía Actualizada', 'Su fotografía de perfil se ha guardado exitosamente.', 'success');
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  const elOrigen = document.getElementById('perfilOrigen');
  if (elOrigen) {
    elOrigen.textContent = (dancer.origen === 'Extranjero' && dancer.pais_origen)
      ? `${dancer.pais_origen} (Extranjero)`
      : (dancer.origen || 'Bolivia');
  }

  // Poblar y enlazar formulario de datos del fraterno, tallas y ficha médica
  const selTallaPolera = document.getElementById('profileTallaPolera');
  const selTallaChamarra = document.getElementById('profileTallaChamarra');
  const selTallaCanguro = document.getElementById('profileTallaCanguro');
  if (selTallaPolera) selTallaPolera.value = tallas.polera || 'M';
  if (selTallaChamarra) selTallaChamarra.value = tallas.chamarra || 'M';
  if (selTallaCanguro) selTallaCanguro.value = tallas.canguro || 'M';

  const selProfileOrigen = document.getElementById('profileOrigen');
  const groupProfilePais = document.getElementById('groupProfilePais');
  const inputProfilePais = document.getElementById('profilePais');

  if (selProfileOrigen && groupProfilePais) {
    selProfileOrigen.value = dancer.origen || 'Bolivia';
    if (selProfileOrigen.value === 'Extranjero') {
      groupProfilePais.style.display = 'block';
      if (inputProfilePais) {
        inputProfilePais.value = dancer.pais_origen || '';
        inputProfilePais.required = true;
      }
    } else {
      groupProfilePais.style.display = 'none';
      if (inputProfilePais) {
        inputProfilePais.value = '';
        inputProfilePais.required = false;
      }
    }

    selProfileOrigen.addEventListener('change', () => {
      if (selProfileOrigen.value === 'Extranjero') {
        groupProfilePais.style.display = 'block';
        if (inputProfilePais) inputProfilePais.required = true;
      } else {
        groupProfilePais.style.display = 'none';
        if (inputProfilePais) {
          inputProfilePais.required = false;
          inputProfilePais.value = '';
        }
      }
    });
  }

  const inputPhone = document.getElementById('profilePhone');
  const inputEmerg = document.getElementById('profileEmergencyContact');
  const inputMed = document.getElementById('profileMedicalCondition');
  if (inputPhone) inputPhone.value = dancer.telefono || '';
  if (inputEmerg) inputEmerg.value = dancer.contacto_emergencia || '';
  if (inputMed) inputMed.value = dancer.ficha_medica || '';

  const formMedical = document.getElementById('formProfileMedical');
  if (formMedical) {
    formMedical.addEventListener('submit', function(e) {
      e.preventDefault();

      if (selTallaPolera && selTallaChamarra && selTallaCanguro) {
        dancer.tallas = {
          polera: selTallaPolera.value,
          chamarra: selTallaChamarra.value,
          canguro: selTallaCanguro.value
        };
        if (elPolera) elPolera.textContent = dancer.tallas.polera;
        if (elChamarra) elChamarra.textContent = dancer.tallas.chamarra;
        if (elCanguro) elCanguro.textContent = dancer.tallas.canguro;
      }

      if (selProfileOrigen) {
        dancer.origen = selProfileOrigen.value;
        dancer.pais_origen = (selProfileOrigen.value === 'Extranjero' && inputProfilePais) ? inputProfilePais.value.trim() : '';
        if (dancer.origen === 'Extranjero' && !dancer.pais_origen) {
          showToast('País Requerido', 'Por favor indique su país de origen.', 'error');
          return;
        }
        if (elOrigen) {
          elOrigen.textContent = (dancer.origen === 'Extranjero' && dancer.pais_origen)
            ? `${dancer.pais_origen} (Extranjero)`
            : dancer.origen;
        }
      }

      dancer.telefono = inputPhone ? inputPhone.value.trim() : (dancer.telefono || '');
      dancer.contacto_emergencia = inputEmerg ? inputEmerg.value.trim() : (dancer.contacto_emergencia || '');
      dancer.ficha_medica = inputMed ? inputMed.value.trim() : (dancer.ficha_medica || 'Ninguna');

      let fraternosList = getFraternos();
      const idx = fraternosList.findIndex(f => f.ci === dancer.ci);
      if (idx !== -1) {
        fraternosList[idx].tallas = dancer.tallas;
        fraternosList[idx].origen = dancer.origen;
        fraternosList[idx].pais_origen = dancer.pais_origen;
        fraternosList[idx].telefono = dancer.telefono;
        fraternosList[idx].contacto_emergencia = dancer.contacto_emergencia;
        fraternosList[idx].ficha_medica = dancer.ficha_medica;
        saveFraternos(fraternosList);
      }
      localStorage.setItem('sambos_active_user', JSON.stringify(dancer));
      showToast('Datos Actualizados', 'Sus datos personales, tallas y ficha médica se han guardado.', 'success');
    });
  }

  // Inicializar navegación por 3 pestañas interactivas de Fraterno
  initProfileTabNavigation();

  renderQRCodeFraterno(dancer.ci, dancer.nombre);
  renderHistorialEnsayosFraterno(dancer);
  renderDesgloseMultasFraterno(dancer);
  renderCuotasProgramadasFraterno(dancer);
  updateProfileFinancialSummary(dancer);

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('fraterno_logueado');
      localStorage.removeItem('sambos_active_user');
      window.location.href = 'index.html';
    });
  }
}

function initProfileTabNavigation() {
  const tabBtns = document.querySelectorAll('#profileNavTabs .tab-btn');
  const tabContents = document.querySelectorAll('#profileMainContainer .tab-content');

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

function renderQRCodeFraterno(ci, nombre = '') {
  const qrContainer = document.getElementById('qrGiganteBox');
  if (!qrContainer) return;
  qrContainer.innerHTML = '';

  const ciText = String(ci).trim();

  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(qrContainer, {
        text: ciText,
        width: 220,
        height: 220,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } catch(err) {
      renderQRImageFallback(qrContainer, ciText);
    }
  } else {
    renderQRImageFallback(qrContainer, ciText);
  }

  const btnDownloadQR = document.getElementById('btnDownloadQR');
  if (btnDownloadQR) {
    btnDownloadQR.onclick = () => {
      const canvas = qrContainer.querySelector('canvas');
      const img = qrContainer.querySelector('img');
      const link = document.createElement('a');
      link.download = `QR_Fraterno_${ciText}.png`;
      if (canvas) {
        link.href = canvas.toDataURL('image/png');
      } else if (img) {
        link.href = img.src;
      }
      link.click();
      showToast('Credencial Guardada', `Código QR de ${nombre || ciText} descargado correctamente.`, 'success');
    };
  }
}

function renderQRImageFallback(container, ciText) {
  const qrImg = document.createElement('img');
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ciText)}`;
  qrImg.alt = `Código QR CI ${ciText}`;
  qrImg.style.width = '220px';
  qrImg.style.height = '220px';
  qrImg.style.display = 'block';
  qrImg.style.margin = '0 auto';
  container.appendChild(qrImg);
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
