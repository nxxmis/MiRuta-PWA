/**
 * MiRuta - Progressive Web App (PWA)
 * Main Application Logic & View Controller
 */

// Application State
const state = {
  currentTab: 'inicio', // 'inicio' | 'familias' | 'pagos' | 'ajustes'
  selectedTurn: 'Mañana', // 'Mañana' | 'Tarde'
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth() + 1, // 1-12
  inicioSearch: '',
  isReorderMode: false,
  familySearch: '',
  familyFilter: 'all', // 'all' | 'siblings' | 'pending' | 'ontime'
  paymentSearch: '',
  paymentFilter: 'all', // 'all' | 'pending' | 'ontime'
  activeModal: null, // modal id or null
  settings: null,
  cachedData: {
    families: [],
    children: [],
    payments: [],
    attendance: {},
    upcomingBirthdays: [],
    schools: []
  }
};

// DOM Ready initialization
document.addEventListener('DOMContentLoaded', async () => {
  const startTime = Date.now();

  // Splash Screen hide transition helper
  const hideSplash = () => {
    const splash = document.getElementById('splashScreen');
    if (splash) {
      splash.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 700);
    }
  };

  // Register Service Worker for offline PWA
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      console.log('MiRuta Service Worker registered successfully.');
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
    }
  }

  // Initialize DB and load state
  await MiRutaDB.init();
  await refreshData();
  
  // Set up event listeners
  setupNavigation();
  setupEventListeners();

  // Initial render
  renderApp();

  // Ensure splash screen displays smoothly for at least 900ms for a polished experience
  const elapsed = Date.now() - startTime;
  const delay = Math.max(0, 950 - elapsed);
  setTimeout(hideSplash, delay);
});

// Refresh all cached data from Dexie
async function refreshData() {
  state.settings = await MiRutaDB.getSettings();
  state.cachedData.families = await MiRutaDB.getFamilies();
  state.cachedData.children = await MiRutaDB.getAllChildren();
  state.cachedData.payments = await MiRutaDB.getPayments(state.selectedYear, state.selectedMonth);
  state.cachedData.attendance = await MiRutaDB.getTodayAttendance();
  state.cachedData.upcomingBirthdays = await MiRutaDB.getUpcomingBirthdays(state.settings.birthdayNoticeDays || 5);
  state.cachedData.schools = await MiRutaDB.getSchools();
}

// Global App Re-render
async function renderApp() {
  updateHeader();
  updateNotificationBadge();
  updateFab();

  if (state.currentTab === 'inicio') {
    await renderInicio();
  } else if (state.currentTab === 'familias') {
    await renderFamilias();
  } else if (state.currentTab === 'pagos') {
    await renderPagos();
  } else if (state.currentTab === 'ajustes') {
    await renderAjustes();
  }
}

// -------------------------------------------------------------
// Header & Floating Action Button
// -------------------------------------------------------------
function updateHeader() {
  const titles = {
    inicio: 'Inicio',
    familias: 'Familias',
    pagos: 'Control De Pagos',
    ajustes: 'Ajustes'
  };
  const titleEl = document.getElementById('headerTitle');
  if (titleEl) {
    titleEl.textContent = titles[state.currentTab] || 'MiRuta';
  }
}

function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  if (!badge) return;

  const bdayCount = state.cachedData.upcomingBirthdays.length;
  
  // Count families with debt in current month
  const totalWeeks = getWeeksInMonth(state.selectedYear, state.selectedMonth);
  let pendingDebtCount = 0;
  for (const fam of state.cachedData.families) {
    const famPayments = state.cachedData.payments.filter(p => p.familyId === fam.id);
    if (famPayments.length < totalWeeks) {
      pendingDebtCount++;
    }
  }

  const totalAlerts = bdayCount + pendingDebtCount;
  if (totalAlerts > 0) {
    badge.classList.remove('hidden');
    badge.textContent = totalAlerts > 9 ? '9+' : totalAlerts;
  } else {
    badge.classList.add('hidden');
  }
}

function updateFab() {
  const fab = document.getElementById('fabActionBtn');
  if (!fab) return;

  if (state.currentTab === 'inicio' || state.currentTab === 'pagos') {
    fab.classList.remove('hidden');
    fab.setAttribute('aria-label', 'Registrar Pago');
    fab.title = 'Registrar Pago';
    fab.querySelector('.material-symbols-outlined').textContent = 'add_circle';
  } else if (state.currentTab === 'familias') {
    fab.classList.remove('hidden');
    fab.setAttribute('aria-label', 'Nueva Familia');
    fab.title = 'Nueva Familia';
    fab.querySelector('.material-symbols-outlined').textContent = 'person_add';
  } else {
    fab.classList.add('hidden');
  }
}

// -------------------------------------------------------------
// Tab Navigation
// -------------------------------------------------------------
function setupNavigation() {
  const navLinks = document.querySelectorAll('nav [data-path]');
  navLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const path = link.getAttribute('data-path');
      
      navLinks.forEach(l => {
        l.className = 'flex flex-col items-center justify-center gap-1 min-w-[4rem] h-12 text-on-surface-variant transition-all hover:text-on-surface';
        l.removeAttribute('aria-current');
      });

      link.className = 'flex flex-col items-center justify-center gap-1 min-w-[4rem] h-12 transition-all text-secondary font-bold scale-105';
      link.setAttribute('aria-current', 'page');

      // Hide all view sections
      document.querySelectorAll('.view-tab').forEach(sec => sec.classList.add('hidden'));

      // Show selected section
      state.currentTab = path;
      const targetSec = document.getElementById(`view-${path}`);
      if (targetSec) targetSec.classList.remove('hidden');

      window.scrollTo({ top: 0, behavior: 'smooth' });
      await renderApp();
    });
  });

  // Header user profile button -> go to Ajustes
  const headerUserBtn = document.getElementById('headerUserBtn');
  if (headerUserBtn) {
    headerUserBtn.addEventListener('click', () => {
      const ajustesLink = document.querySelector('nav [data-path="ajustes"]');
      if (ajustesLink) ajustesLink.click();
    });
  }

  // Header notification bell button -> open Notifications Modal
  const notificationBtn = document.getElementById('notificationBtn');
  if (notificationBtn) {
    notificationBtn.addEventListener('click', () => {
      openNotificationsModal();
    });
  }

  // Floating Action Button (+) click
  const fabBtn = document.getElementById('fabActionBtn');
  if (fabBtn) {
    fabBtn.addEventListener('click', () => {
      if (state.currentTab === 'familias') {
        openFamilyModal();
      } else {
        openPaymentModal();
      }
    });
  }
}

// -------------------------------------------------------------
// 1. INICIO (DASHBOARD)
// -------------------------------------------------------------
async function renderInicio() {
  const settings = state.settings;
  const greetingEl = document.getElementById('dashboardGreeting');
  const vehicleStatusEl = document.getElementById('dashboardVehicleStatus');
  const dateSubtitleEl = document.getElementById('dashboardDateSubtitle');

  // Greeting & Vehicle
  if (greetingEl) {
    greetingEl.textContent = `¡Hola, ${settings.driverName ? settings.driverName.split(' ')[0] : 'Transportista'}!`;
  }
  if (vehicleStatusEl) {
    const unit = settings.vehicleUnit || 'Móvil #04';
    const plate = settings.vehiclePlate ? ` • ${settings.vehiclePlate}` : '';
    vehicleStatusEl.textContent = `Ruta Activa • ${unit}${plate}`;
  }
  if (dateSubtitleEl) {
    const dateFormatted = formatCurrentDateSpanish();
    const totalToday = state.cachedData.children.filter(c => c.turn === state.selectedTurn).length;
    dateSubtitleEl.textContent = `${dateFormatted} • ${totalToday} niños en turno ${state.selectedTurn.toLowerCase()}`;
  }

  // Birthday Alert Banner
  renderBirthdayBanner();

  // Financial Summary Card
  renderFinancialSummary();

  // Turn tabs (Mañana / Tarde)
  updateTurnTabs();

  // Children cards for selected turn
  renderChildrenCards();
}

function formatCurrentDateSpanish() {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const now = new Date();
  const dayName = days[now.getDay()];
  const dayNum = now.getDate();
  const monthName = months[now.getMonth()];
  return `${dayName}, ${dayNum} de ${monthName}`;
}

function renderBirthdayBanner() {
  const bannerContainer = document.getElementById('birthdayBannerSection');
  if (!bannerContainer) return;

  const birthdays = state.cachedData.upcomingBirthdays;
  if (!birthdays || birthdays.length === 0) {
    bannerContainer.classList.add('hidden');
    return;
  }

  bannerContainer.classList.remove('hidden');

  // If there are upcoming birthdays, display the top one prominently with a counter if multiple
  const bday = birthdays[0];
  const moreCount = birthdays.length - 1;
  const repPhone = bday.family ? bday.family.phone.replace(/[^0-9]/g, '') : '';
  const repName = bday.family ? bday.family.repName : 'Representante';
  const childName = `${bday.child.firstName} ${bday.child.lastName}`.trim();
  
  // WhatsApp congratulate text
  const waMsg = encodeURIComponent(
    `¡Hola ${repName}! 🚍 Desde el transporte escolar te saludamos con mucho cariño. Queremos desearle a ${bday.child.firstName} un ¡Muy Feliz Cumpleaños! 🎂🎈🎉 Que Dios lo bendiga y pase un día increíble lleno de alegrías.`
  );
  const waUrl = repPhone ? `https://wa.me/${repPhone}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;

  bannerContainer.innerHTML = `
    <div class="bg-gradient-to-r from-primary-fixed to-primary-container/30 border border-primary-container/40 p-space-md rounded-2xl shadow-sm flex items-center justify-between gap-space-sm transition-all">
      <div class="flex items-center gap-space-sm min-w-0">
        <div class="w-12 h-12 rounded-xl bg-primary-container/40 flex items-center justify-center text-primary text-2xl flex-shrink-0 shadow-inner">
          🎂
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-label-sm text-label-sm uppercase tracking-wider font-extrabold text-on-primary-fixed-variant bg-primary-container/50 px-2 py-0.5 rounded-full">
              ${bday.labelDays}
            </span>
            ${moreCount > 0 ? `<span class="font-label-sm text-label-sm text-on-primary-fixed-variant font-bold">+${moreCount} más</span>` : ''}
          </div>
          <h3 class="font-headline-sm text-headline-sm text-on-surface font-extrabold tracking-tight truncate mt-0.5">
            ${childName} cumple ${bday.ageTurning} años
          </h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 truncate">
            <span>Rep: ${repName}</span>
            <span>•</span>
            <span>${bday.child.school || 'Transporte'}</span>
          </p>
        </div>
      </div>
      <a href="${waUrl}" target="_blank" class="flex-shrink-0 h-10 px-3.5 rounded-xl bg-secondary text-on-secondary font-label-md text-label-md font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-transform hover:opacity-95" title="Felicitar por WhatsApp">
        <span class="material-symbols-outlined text-[18px]">chat</span>
        <span class="hidden sm:inline">Felicitar</span>
      </a>
    </div>
  `;
}

function renderFinancialSummary() {
  const summarySection = document.getElementById('financialSummarySection');
  if (!summarySection) return;

  const currentYear = state.selectedYear;
  const currentMonth = state.selectedMonth;
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = monthNames[currentMonth - 1];

  const families = state.cachedData.families;
  const totalWeeks = getWeeksInMonth(currentYear, currentMonth);

  const monthPayments = state.cachedData.payments.filter(p => p.year === currentYear && p.month === currentMonth);
  let totalCollected = 0;
  monthPayments.forEach(p => {
    if (p.status !== 'exonerado' && p.method !== 'exonerado') {
      totalCollected += (p.amount || 0);
    }
  });

  // Calcular ingresos esperados (excluyendo semanas exoneradas) y familias al día
  let totalExpected = 0;
  let familiesOnTime = 0;

  families.forEach(fam => {
    const famPayments = monthPayments.filter(p => p.familyId === fam.id);
    const exoneratedCount = famPayments.filter(p => p.status === 'exonerado' || p.method === 'exonerado').length;
    const billableWeeks = Math.max(0, totalWeeks - exoneratedCount);
    totalExpected += (fam.weeklyRate || 0) * billableWeeks;

    if (famPayments.length >= totalWeeks) {
      familiesOnTime++;
    }
  });

  const percent = totalExpected > 0 ? Math.min(100, Math.round((totalCollected / totalExpected) * 100)) : 100;

  summarySection.innerHTML = `
    <div class="bg-surface-container-lowest p-space-md rounded-2xl shadow-[0_4px_16px_-2px_rgba(15,23,42,0.04)] flex flex-col gap-space-sm border border-surface-container/50">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-on-surface">
          <span class="material-symbols-outlined text-primary text-[20px]">account_balance_wallet</span>
          <span class="font-headline-sm text-headline-sm font-bold tracking-tight">Cobros de ${monthName}</span>
        </div>
        <span class="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-secondary-container/50 text-on-secondary-container font-extrabold">
          ${percent}% completado
        </span>
      </div>

      <!-- 2 Col Estadísticas -->
      <div class="grid grid-cols-2 gap-space-sm pt-1">
        <div class="bg-surface-container-low p-3 rounded-xl flex flex-col">
          <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Familias al día</span>
          <div class="flex items-baseline gap-1 mt-0.5">
            <span class="font-headline-lg text-headline-lg font-black text-on-surface">${familiesOnTime}</span>
            <span class="font-body-sm text-body-sm text-on-surface-variant font-bold">/ ${families.length}</span>
          </div>
        </div>

        <div class="bg-surface-container-low p-3 rounded-xl flex flex-col">
          <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Recaudado este mes</span>
          <div class="flex items-baseline gap-1 mt-0.5">
            <span class="font-headline-lg text-headline-lg font-black text-secondary">$${totalCollected.toFixed(0)}</span>
            <span class="font-body-sm text-body-sm text-on-surface-variant font-bold">/ $${totalExpected.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <!-- Barra de progreso -->
      <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden mt-1">
        <div class="h-full bg-secondary rounded-full transition-all duration-500" style="width: ${percent}%;"></div>
      </div>

      <!-- Botón ver detalle de cobros -->
      <button id="viewPaymentsDetailBtn" class="mt-1 w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]">
        <span class="material-symbols-outlined text-[18px] text-primary">receipt_long</span>
        <span>Ver detalle de cobros</span>
        <span class="material-symbols-outlined text-[16px]">chevron_right</span>
      </button>
    </div>
  `;

  document.getElementById('viewPaymentsDetailBtn')?.addEventListener('click', () => {
    const pagosLink = document.querySelector('nav [data-path="pagos"]');
    if (pagosLink) pagosLink.click();
  });
}

function updateTurnTabs() {
  const tabManana = document.getElementById('tabTurnManana');
  const tabTarde = document.getElementById('tabTurnTarde');
  if (!tabManana || !tabTarde) return;

  const mananaCount = state.cachedData.children.filter(c => c.turn === 'Mañana').length;
  const tardeCount = state.cachedData.children.filter(c => c.turn === 'Tarde').length;

  tabManana.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">wb_sunny</span>
    <span>Turno Mañana (${mananaCount})</span>
  `;
  tabTarde.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">wb_twilight</span>
    <span>Turno Tarde (${tardeCount})</span>
  `;

  if (state.selectedTurn === 'Mañana') {
    tabManana.className = 'flex-1 py-2.5 px-space-sm rounded-xl font-label-lg text-label-lg bg-surface-container-lowest text-on-surface shadow-sm font-bold transition-all flex items-center justify-center gap-1.5';
    tabTarde.className = 'flex-1 py-2.5 px-space-sm rounded-xl font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-all flex items-center justify-center gap-1.5';
  } else {
    tabTarde.className = 'flex-1 py-2.5 px-space-sm rounded-xl font-label-lg text-label-lg bg-surface-container-lowest text-on-surface shadow-sm font-bold transition-all flex items-center justify-center gap-1.5';
    tabManana.className = 'flex-1 py-2.5 px-space-sm rounded-xl font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-all flex items-center justify-center gap-1.5';
  }
}

function renderChildrenCards() {
  const container = document.getElementById('studentsContainer');
  if (!container) return;

  const turnField = state.selectedTurn === 'Mañana' ? 'ordenManana' : 'ordenTarde';
  let allTurnChildren = state.cachedData.children.filter(c => c.turn === state.selectedTurn);
  allTurnChildren.sort((a, b) => {
    const orderA = a[turnField] != null ? a[turnField] : a.id;
    const orderB = b[turnField] != null ? b[turnField] : b.id;
    return orderA - orderB;
  });

  const childOrderMap = new Map();
  allTurnChildren.forEach((c, idx) => {
    childOrderMap.set(c.id, idx + 1);
  });

  const families = state.cachedData.families;
  const familyMap = new Map(families.map(f => [f.id, f]));
  const attendance = state.cachedData.attendance;

  const q = normalizeSearchText(state.inicioSearch);
  let children = allTurnChildren;
  if (q) {
    children = allTurnChildren.filter(child => {
      const family = familyMap.get(child.familyId);
      const repName = family ? family.repName : '';
      const phone = family ? family.phone : '';
      const searchTarget = normalizeSearchText(`${child.firstName} ${child.lastName} ${child.school} ${repName} ${phone} ${child.modality}`);
      return searchTarget.includes(q);
    });
  }

  const countBadge = document.getElementById('studentsCountBadge');
  if (countBadge) {
    countBadge.textContent = children.length;
  }

  if (children.length === 0) {
    if (q) {
      container.innerHTML = `
        <div class="bg-surface-container-lowest p-space-xl rounded-2xl text-center flex flex-col items-center justify-center gap-2 border border-dashed border-outline-variant">
          <span class="material-symbols-outlined text-4xl text-on-surface-variant/50">search_off</span>
          <p class="font-headline-sm text-headline-sm text-on-surface font-bold">No se encontraron alumnos para "${escapeHtml(state.inicioSearch)}"</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Intenta buscar por otro nombre o limpia el filtro.</p>
          <button onclick="clearInicioSearch()" class="mt-2 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold shadow-sm transition-all">
            Limpiar búsqueda
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="bg-surface-container-lowest p-space-xl rounded-2xl text-center flex flex-col items-center justify-center gap-2 border border-dashed border-outline-variant">
          <span class="material-symbols-outlined text-4xl text-on-surface-variant/50">directions_bus</span>
          <p class="font-headline-sm text-headline-sm text-on-surface font-bold">No hay niños en el Turno ${state.selectedTurn}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Puedes agregar nuevos alumnos en la sección de Familias.</p>
          <button onclick="openFamilyModal()" class="mt-2 px-4 py-2 rounded-xl bg-secondary text-on-secondary font-label-md text-label-md font-bold shadow-sm">
            + Agregar Familia y Niños
          </button>
        </div>
      `;
    }
    return;
  }

  // Check which children have upcoming birthdays
  const upcomingMap = new Map(state.cachedData.upcomingBirthdays.map(b => [b.child.id, b]));

  let html = '';
  for (const child of children) {
    const family = familyMap.get(child.familyId);
    const repName = family ? family.repName : 'Sin representante';
    const repPhone = family ? family.phone.replace(/[^0-9]/g, '') : '';
    const attStatus = attendance[child.id] || 'espera';
    const bdayInfo = upcomingMap.get(child.id);
    const routePos = childOrderMap.get(child.id) || 1;

    const currentTurnIdx = allTurnChildren.findIndex(c => c.id === child.id);
    const isFirst = currentTurnIdx === 0;
    const isLast = currentTurnIdx === allTurnChildren.length - 1;

    // Initials avatar
    const initials = getInitials(child.firstName, child.lastName);
    const avatarBg = getAvatarColor(child.firstName);

    // Modality pill style & text
    let modalityHtml = '';
    if (child.modality === 'Solo ida') {
      modalityHtml = `
        <span class="font-label-sm text-label-sm px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-extrabold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
          Solo ida
        </span>
      `;
    } else if (child.modality === 'Solo vuelta') {
      modalityHtml = `
        <span class="font-label-sm text-label-sm px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-extrabold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
          Solo vuelta
        </span>
      `;
    } else {
      // Transporte Completo
      modalityHtml = `
        <span class="font-label-sm text-label-sm px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-extrabold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
          Transporte Completo
        </span>
      `;
    }

    // Status button style & text (supports 'espera', 'abordado', 'no_asistio')
    let statusBtnClass = '';
    let statusBtnText = '';
    if (attStatus === 'abordado') {
      statusBtnClass = 'status-btn font-label-md text-label-md px-3.5 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container font-extrabold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm';
      statusBtnText = '<span class="material-symbols-outlined text-[16px] text-secondary">check_circle</span><span>Abordado ✅</span>';
    } else if (attStatus === 'no_asistio') {
      statusBtnClass = 'status-btn font-label-md text-label-md px-3.5 py-1.5 rounded-xl bg-error-container/40 text-error font-extrabold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm border border-error/30';
      statusBtnText = '<span class="material-symbols-outlined text-[16px] text-error">person_off</span><span>No asistió ❌</span>';
    } else {
      statusBtnClass = 'status-btn font-label-md text-label-md px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold flex items-center gap-1.5 active:scale-95 transition-all';
      statusBtnText = '<span class="material-symbols-outlined text-[16px]">schedule</span><span>En espera ⏳</span>';
    }

    const waUrl = repPhone ? `https://wa.me/${repPhone}?text=${encodeURIComponent(`Hola ${repName}, te saluda el transporte escolar respecto a ${child.firstName}.`)}` : '#';

    // Action button in header: Reorder buttons if isReorderMode, else WhatsApp link
    let actionHtml = '';
    if (state.isReorderMode) {
      actionHtml = `
        <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
          <button type="button" onclick="moveChildRouteOrder(${child.id}, 'up')" ${isFirst ? 'disabled' : ''} class="w-10 h-10 rounded-xl ${isFirst ? 'opacity-20 bg-surface-container text-on-surface-variant cursor-not-allowed' : 'bg-primary-container/40 hover:bg-primary-container text-primary font-black active:scale-90 shadow-sm'} flex items-center justify-center transition-all" title="Subir parada en la ruta">
            <span class="material-symbols-outlined text-[24px]">arrow_upward</span>
          </button>
          <button type="button" onclick="moveChildRouteOrder(${child.id}, 'down')" ${isLast ? 'disabled' : ''} class="w-10 h-10 rounded-xl ${isLast ? 'opacity-20 bg-surface-container text-on-surface-variant cursor-not-allowed' : 'bg-primary-container/40 hover:bg-primary-container text-primary font-black active:scale-90 shadow-sm'} flex items-center justify-center transition-all" title="Bajar parada en la ruta">
            <span class="material-symbols-outlined text-[24px]">arrow_downward</span>
          </button>
        </div>
      `;
    } else {
      actionHtml = `
        <a href="${waUrl}" target="_blank" onclick="event.stopPropagation()" class="w-10 h-10 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary hover:text-on-secondary transition-colors flex items-center justify-center flex-shrink-0 active:scale-95" title="Contactar a ${repName} por WhatsApp">
          <span class="material-symbols-outlined text-[20px]">chat</span>
        </a>
      `;
    }

    const cardBorder = state.isReorderMode
      ? 'border-2 border-primary/50 shadow-md ring-1 ring-primary/20'
      : 'border border-surface-container/40 hover:shadow-md';

    html += `
      <div class="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col gap-space-sm ${cardBorder} transition-all cursor-pointer active:scale-[0.99]" onclick="openStudentAttendanceModal(${child.id})">
        <div class="flex items-start justify-between gap-space-sm">
          <div class="flex items-center gap-space-sm min-w-0">
            <!-- Avatar Iniciales con badge de orden de ruta -->
            <div class="relative w-12 h-12 rounded-2xl flex-shrink-0 ${avatarBg} font-headline-sm text-headline-sm font-extrabold flex items-center justify-center shadow-sm select-none">
              <span>${initials}</span>
              <span class="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-white text-[#065F46] border border-emerald-200 shadow-sm font-bold text-[10px] flex items-center justify-center select-none" title="Parada #${routePos}">#${routePos}</span>
              ${bdayInfo ? '<span class="absolute -bottom-1 -right-1 text-sm select-none" title="Cumpleaños próximo">🎂</span>' : ''}
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="font-headline-sm text-headline-sm text-on-surface font-extrabold truncate">
                  ${child.firstName} ${child.lastName}
                </h4>
                <!-- Chip Colegio -->
                <span class="font-label-sm text-label-sm px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-bold truncate max-w-[140px]">
                  ${child.school || 'Colegio'}
                </span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
                <span class="material-symbols-outlined text-[15px] text-outline">person</span>
                <span class="truncate">Rep: <strong class="text-on-surface">${repName}</strong></span>
              </p>
            </div>
          </div>

          <!-- Acción Cabecera: Botones de orden o WhatsApp -->
          ${actionHtml}
        </div>

        <!-- Fila Inferior: Píldora Modalidad y Botón Estado Abordado -->
        <div class="flex items-center justify-between pt-2 border-t border-surface-container">
          <div class="flex items-center gap-1.5">
            ${modalityHtml}
          </div>
          <button type="button" class="${statusBtnClass}" onclick="event.stopPropagation(); toggleAttendance(${child.id}, this)">
            ${statusBtnText}
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// Attendance toggle handler (Ciclo: En espera -> Abordado -> No asistió -> En espera)
window.toggleAttendance = async function(childId, btn) {
  try {
    const newStatus = await MiRutaDB.toggleChildAttendance(childId);
    state.cachedData.attendance[childId] = newStatus;
    
    if (newStatus === 'abordado') {
      btn.className = 'status-btn font-label-md text-label-md px-3.5 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container font-extrabold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm';
      btn.innerHTML = '<span class="material-symbols-outlined text-[16px] text-secondary">check_circle</span><span>Abordado ✅</span>';
      showToast('Estudiante marcado como Abordado', 'check_circle');
    } else if (newStatus === 'no_asistio') {
      btn.className = 'status-btn font-label-md text-label-md px-3.5 py-1.5 rounded-xl bg-error-container/40 text-error font-extrabold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm border border-error/30';
      btn.innerHTML = '<span class="material-symbols-outlined text-[16px] text-error">person_off</span><span>No asistió ❌</span>';
      showToast('Estudiante marcado como No asistió', 'person_off');
    } else {
      btn.className = 'status-btn font-label-md text-label-md px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold flex items-center gap-1.5 active:scale-95 transition-all';
      btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">schedule</span><span>En espera ⏳</span>';
      showToast('Estudiante en espera', 'schedule');
    }
  } catch (err) {
    console.error('Error toggling attendance:', err);
    showToast('Error al actualizar estado', 'error');
  }
};

// -------------------------------------------------------------
// CONTROLADOR DE ORDEN DE RUTA Y BÚSQUEDA INSTANTÁNEA
// -------------------------------------------------------------
window.toggleReorderMode = function() {
  state.isReorderMode = !state.isReorderMode;
  const btn = document.getElementById('toggleReorderBtn');
  const btnText = document.getElementById('reorderBtnText');
  const btnIcon = document.getElementById('reorderBtnIcon');
  if (state.isReorderMode) {
    if (btn) btn.className = 'px-3 py-1 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95';
    if (btnText) btnText.textContent = 'Listo';
    if (btnIcon) btnIcon.textContent = 'check';
    showToast('Modo ordenar ruta activo. Usa ▲ y ▼ para organizar.', 'swap_vert');
  } else {
    if (btn) btn.className = 'px-3 py-1 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 border border-surface-container/60';
    if (btnText) btnText.textContent = 'Ordenar ruta';
    if (btnIcon) btnIcon.textContent = 'swap_vert';
    showToast('Orden de ruta guardado', 'check_circle');
  }
  renderChildrenCards();
};

window.moveChildRouteOrder = async function(childId, direction) {
  const turnField = state.selectedTurn === 'Mañana' ? 'ordenManana' : 'ordenTarde';
  let turnChildren = state.cachedData.children.filter(c => c.turn === state.selectedTurn);
  turnChildren.sort((a, b) => {
    const valA = a[turnField] != null ? a[turnField] : a.id;
    const valB = b[turnField] != null ? b[turnField] : b.id;
    return valA - valB;
  });

  const idx = turnChildren.findIndex(c => c.id === Number(childId));
  if (idx === -1) return;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= turnChildren.length) return;

  // Swap
  const movedChild = turnChildren[idx];
  const targetChild = turnChildren[targetIdx];
  turnChildren[idx] = targetChild;
  turnChildren[targetIdx] = movedChild;

  // Assign normalized 1-based order
  const updates = [];
  turnChildren.forEach((c, newPos) => {
    c[turnField] = newPos + 1;
    updates.push({ id: c.id, order: newPos + 1 });
  });

  // Save to IndexedDB immediately
  await MiRutaDB.updateChildrenOrder(updates, state.selectedTurn);

  // Update in state cache
  updates.forEach(u => {
    const cached = state.cachedData.children.find(c => c.id === u.id);
    if (cached) cached[turnField] = u.order;
  });

  renderChildrenCards();
};

window.clearInicioSearch = function() {
  const inp = document.getElementById('inicioSearchInput');
  const btn = document.getElementById('inicioSearchClearBtn');
  if (inp) inp.value = '';
  if (btn) btn.classList.add('hidden');
  state.inicioSearch = '';
  renderChildrenCards();
};

window.clearFamilySearch = function() {
  const inp = document.getElementById('familySearchInput');
  const btn = document.getElementById('familySearchClearBtn');
  if (inp) inp.value = '';
  if (btn) btn.classList.add('hidden');
  state.familySearch = '';
  renderFamilias();
};

window.clearPaymentSearch = function() {
  const inp = document.getElementById('paymentSearchInput');
  const btn = document.getElementById('paymentSearchClearBtn');
  if (inp) inp.value = '';
  if (btn) btn.classList.add('hidden');
  state.paymentSearch = '';
  renderPagos();
};

// -------------------------------------------------------------
// HISTORIAL Y DETALLE DE ASISTENCIA POR ESTUDIANTE
// -------------------------------------------------------------
let currentStudentModalChildId = null;
let currentStudentWeekOffset = 0; // 0 = semana actual, -1 = semana anterior, etc.

function getMondayOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 es Domingo, 1 es Lunes
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

window.openStudentAttendanceModal = async function(childId) {
  currentStudentModalChildId = Number(childId);
  currentStudentWeekOffset = 0;

  const modal = document.getElementById('studentAttendanceModal');
  if (!modal) return;

  const child = state.cachedData.children.find(c => c.id === currentStudentModalChildId);
  if (!child) return;

  const family = state.cachedData.families.find(f => f.id === child.familyId);
  const repName = family ? family.repName : 'Sin representante';
  const repPhone = family ? family.phone : 'N/A';

  const avatarEl = document.getElementById('studentModalAvatar');
  if (avatarEl) {
    avatarEl.textContent = getInitials(child.firstName, child.lastName);
    avatarEl.className = `w-12 h-12 rounded-2xl flex-shrink-0 ${getAvatarColor(child.firstName)} font-headline-sm text-headline-sm font-extrabold flex items-center justify-center shadow-sm select-none shrink-0`;
  }
  document.getElementById('studentModalName').textContent = `${child.firstName} ${child.lastName}`;
  document.getElementById('studentModalSchool').textContent = child.school || 'Colegio';
  document.getElementById('studentModalTurn').textContent = child.turn || 'Mañana';
  document.getElementById('studentModalRep').textContent = repName;
  document.getElementById('studentModalPhone').textContent = repPhone;
  document.getElementById('studentModalModality').textContent = child.modality || 'Transporte Completo';

  await renderStudentAttendanceWeek();

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
};

window.changeStudentAttendanceWeek = async function(delta) {
  currentStudentWeekOffset += delta;
  await renderStudentAttendanceWeek();
};

window.renderStudentAttendanceWeek = async function() {
  if (!currentStudentModalChildId) return;

  const childId = currentStudentModalChildId;
  const history = await MiRutaDB.getAttendanceHistory(childId);

  // Mapa rápido fecha -> estado
  const attMap = {};
  for (const h of history) {
    attMap[h.date] = h.status;
  }

  // Total de días asistidos ('abordado') en el mes en curso
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const monthPrefix = `${curYear}-${String(curMonth).padStart(2, '0')}`;
  const monthAttendedDays = history.filter(h => h.date.startsWith(monthPrefix) && h.status === 'abordado').length;

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  document.getElementById('studentModalMonthName').textContent = `${monthNames[curMonth - 1]} ${curYear}`;
  document.getElementById('studentModalMonthCount').textContent = monthAttendedDays;

  // Calcular Lunes y Viernes de la semana según offset
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + (currentStudentWeekOffset * 7));
  const monday = getMondayOfWeek(baseDate);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const monDay = monday.getDate();
  const friDay = friday.getDate();
  const monMonth = monthNames[monday.getMonth()].substring(0, 3);
  const friMonth = monthNames[friday.getMonth()].substring(0, 3);
  const weekLabel = (monMonth === friMonth)
    ? `Semana ${monDay} al ${friDay} ${friMonth}`
    : `Semana ${monDay} ${monMonth} al ${friDay} ${friMonth}`;

  const labelEl = document.getElementById('studentWeekLabel');
  if (labelEl) labelEl.textContent = weekLabel;

  // Renderizar Lunes a Viernes
  const container = document.getElementById('studentWeekDaysContainer');
  if (!container) return;

  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const todayStr = getTodayDateStr();

  let daysHtml = '';
  for (let i = 0; i < 5; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = formatDateStr(dayDate);
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;
    const status = attMap[dateStr];

    let badgeHtml = '';
    let cardBg = 'bg-surface-container-low border-surface-container';

    if (status === 'abordado') {
      cardBg = 'bg-secondary-container/25 border-secondary/30';
      badgeHtml = `
        <span class="font-label-sm text-label-sm px-2.5 py-1 rounded-xl bg-secondary-container text-on-secondary-container font-black flex items-center gap-1 shadow-sm">
          <span class="material-symbols-outlined text-[15px] text-secondary">check_circle</span>
          Abordó ✅
        </span>
      `;
    } else if (status === 'no_asistio') {
      cardBg = 'bg-error-container/15 border-error/25';
      badgeHtml = `
        <span class="font-label-sm text-label-sm px-2.5 py-1 rounded-xl bg-error-container/40 text-error font-black flex items-center gap-1 shadow-sm border border-error/20">
          <span class="material-symbols-outlined text-[15px] text-error">person_off</span>
          No asistió ❌
        </span>
      `;
    } else if (status === 'espera') {
      badgeHtml = `
        <span class="font-label-sm text-label-sm px-2.5 py-1 rounded-xl bg-surface-container-high text-on-surface-variant font-bold flex items-center gap-1">
          <span class="material-symbols-outlined text-[15px]">schedule</span>
          En espera ⏳
        </span>
      `;
    } else {
      if (isFuture) {
        badgeHtml = `<span class="text-[12px] font-semibold text-outline px-1">Próximo</span>`;
      } else {
        badgeHtml = `
          <span class="font-label-sm text-label-sm px-2 py-0.5 rounded-lg bg-surface-container text-on-surface-variant font-medium flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px] text-outline">remove</span>
            Sin registro
          </span>
        `;
      }
    }

    daysHtml += `
      <div class="flex items-center justify-between p-2.5 rounded-xl border ${cardBg} transition-all">
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-lg ${isToday ? 'bg-primary text-on-primary font-black shadow-sm' : 'bg-surface-container text-on-surface font-bold'} flex items-center justify-center text-label-sm shrink-0">
            ${dayDate.getDate()}
          </span>
          <div class="flex flex-col">
            <span class="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5">
              ${dayNames[i]}
              ${isToday ? '<span class="text-[10px] font-black px-1.5 py-0.2 rounded bg-primary text-on-primary">HOY</span>' : ''}
            </span>
            <span class="text-[11px] text-on-surface-variant font-medium">${dateStr}</span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          ${!isFuture ? `
            <button type="button" onclick="cycleAttendanceForDate(${childId}, '${dateStr}')" class="active:scale-95 transition-transform" title="Cambiar estado: Abordó / No asistió / En espera">
              ${badgeHtml}
            </button>
            <button type="button" onclick="cycleAttendanceForDate(${childId}, '${dateStr}')" class="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform" title="Alternar asistencia">
              <span class="material-symbols-outlined text-[18px]">cached</span>
            </button>
          ` : badgeHtml}
        </div>
      </div>
    `;
  }

  container.innerHTML = daysHtml;
};

window.cycleAttendanceForDate = async function(childId, dateStr) {
  const numChildId = Number(childId);
  const id = `${numChildId}_${dateStr}`;
  let existing = await MiRutaDB.db.attendance.get(id);

  // Ciclo: 'espera' -> 'abordado' -> 'no_asistio' -> 'espera'
  let newStatus = 'abordado';
  if (existing) {
    if (existing.status === 'espera') {
      newStatus = 'abordado';
    } else if (existing.status === 'abordado') {
      newStatus = 'no_asistio';
    } else if (existing.status === 'no_asistio') {
      newStatus = 'espera';
    }
  }

  await MiRutaDB.db.attendance.put({
    id,
    childId: numChildId,
    date: dateStr,
    status: newStatus,
    timestamp: new Date().toISOString()
  });

  const todayStr = getTodayDateStr();
  if (dateStr === todayStr) {
    state.cachedData.attendance[numChildId] = newStatus;
  }

  await renderStudentAttendanceWeek();
  renderChildrenCards();
  const statusLabels = {
    abordado: 'Abordó ✅',
    no_asistio: 'No asistió ❌',
    espera: 'En espera ⏳'
  };
  showToast(`${dateStr}: ${statusLabels[newStatus]}`, newStatus === 'abordado' ? 'check_circle' : (newStatus === 'no_asistio' ? 'person_off' : 'schedule'));
};

window.toggleAttendanceForDate = window.cycleAttendanceForDate;

window.closeStudentAttendanceModal = function() {
  const modal = document.getElementById('studentAttendanceModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
  currentStudentModalChildId = null;
};

// -------------------------------------------------------------
// 2. DIRECTORIO DE FAMILIAS
// -------------------------------------------------------------
async function renderFamilias() {
  const container = document.getElementById('familiesListContainer');
  const countEl = document.getElementById('familiesDirectorySummary');
  if (!container) return;

  const families = state.cachedData.families;
  const children = state.cachedData.children;
  const payments = state.cachedData.payments;
  const totalWeeks = getWeeksInMonth(state.selectedYear, state.selectedMonth);

  // Group children by familyId
  const childrenByFam = new Map();
  children.forEach(c => {
    if (!childrenByFam.has(c.familyId)) childrenByFam.set(c.familyId, []);
    childrenByFam.get(c.familyId).push(c);
  });

  // Filter and search
  const q = normalizeSearchText(state.familySearch);
  const filter = state.familyFilter;

  const filteredFamilies = families.filter(fam => {
    const famChildren = childrenByFam.get(fam.id) || [];
    const childrenNames = famChildren.map(c => `${c.firstName} ${c.lastName} ${c.school}`).join(' ');
    const searchTarget = normalizeSearchText(`${fam.repName} ${fam.phone} ${fam.address} ${childrenNames}`);

    // Query match
    if (q && !searchTarget.includes(q)) return false;

    // Filter match
    const paidWeeks = payments.filter(p => p.familyId === fam.id).length;
    const hasDebt = paidWeeks < totalWeeks;

    if (filter === 'siblings' && famChildren.length <= 1) return false;
    if (filter === 'pending' && !hasDebt) return false;
    if (filter === 'ontime' && hasDebt) return false;

    return true;
  });

  if (countEl) {
    countEl.textContent = `${families.length} familias registradas • ${children.length} niños en total`;
  }

  if (filteredFamilies.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-container-lowest p-space-xl rounded-2xl text-center flex flex-col items-center justify-center gap-2 border border-dashed border-outline-variant">
        <span class="material-symbols-outlined text-4xl text-on-surface-variant/40">group_off</span>
        <p class="font-headline-sm text-headline-sm text-on-surface font-bold">No se encontraron familias</p>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Prueba con otro término de búsqueda o registra una nueva familia.</p>
        <button onclick="openFamilyModal()" class="mt-2 px-4 py-2 rounded-xl bg-secondary text-on-secondary font-label-md text-label-md font-bold shadow-sm">
          + Nueva Familia
        </button>
      </div>
    `;
    return;
  }

  let html = '';
  for (const fam of filteredFamilies) {
    const famChildren = childrenByFam.get(fam.id) || [];
    const cleanPhone = fam.phone.replace(/[^0-9]/g, '');
    const paidWeeks = payments.filter(p => p.familyId === fam.id).length;
    const hasDebt = paidWeeks < totalWeeks;
    const isMultiple = famChildren.length > 1;

    html += `
      <article class="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-[0px_4px_16px_-2px_rgba(15,23,42,0.04)] flex flex-col gap-space-sm border border-surface-container/50 hover:shadow-md transition-all">
        <!-- Encabezado de Representante -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                Rep: ${fam.repName}
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${isMultiple ? 'bg-primary-container/20 text-on-primary-container font-extrabold' : 'bg-surface-container text-on-surface-variant font-bold'} font-label-sm text-label-sm">
                <span class="material-symbols-outlined text-[13px]">payments</span>
                Tarifa: $${parseFloat(fam.weeklyRate).toFixed(0)}/sem
              </span>
            </div>

            ${fam.address ? `
              <div class="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm mt-0.5">
                <span class="material-symbols-outlined text-[16px] text-primary shrink-0">pin_drop</span>
                <span class="truncate">${fam.address}</span>
              </div>
            ` : ''}
          </div>

          <!-- Acciones Superiores: Llamar, WhatsApp, Editar, Eliminar -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <a href="tel:${cleanPhone}" class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors" title="Llamar a ${fam.repName}">
              <span class="material-symbols-outlined text-[18px]">call</span>
            </a>
            <a href="https://wa.me/${cleanPhone}" target="_blank" class="w-9 h-9 rounded-full bg-secondary-container/50 text-on-secondary-container flex items-center justify-center hover:bg-secondary-container transition-colors shadow-sm" title="WhatsApp con ${fam.repName}">
              <span class="material-symbols-outlined text-[18px]">chat</span>
            </a>
            <button onclick="openFamilyModal(${fam.id})" class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors" title="Editar familia">
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button onclick="confirmDeleteFamily(${fam.id}, '${escapeHtml(fam.repName)}')" class="w-9 h-9 rounded-full bg-error-container/40 text-error flex items-center justify-center hover:bg-error-container transition-colors" title="Eliminar familia">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>

        <!-- Lista de Niños / Hermanos -->
        <div class="flex flex-col gap-2 pt-1">
          ${famChildren.map(child => {
            const initials = getInitials(child.firstName, child.lastName);
            const avatarBg = getAvatarColor(child.firstName);
            const bdayFormatted = formatBirthDateAge(child.birthDate);
            return `
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-10 h-10 rounded-full flex-shrink-0 ${avatarBg} font-label-md text-label-md font-extrabold flex items-center justify-center shadow-sm select-none">
                    ${initials}
                  </div>
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-label-lg text-label-lg text-on-surface font-bold truncate">
                        ${child.firstName} ${child.lastName}
                      </span>
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-semibold truncate max-w-[130px]">
                        ${child.school || 'Sin colegio'}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm mt-0.5">
                      <span class="flex items-center gap-0.5 font-medium">
                        <span class="material-symbols-outlined text-[14px] text-primary">${child.turn === 'Mañana' ? 'wb_sunny' : 'wb_twilight'}</span>
                        ${child.turn}
                      </span>
                      <span>•</span>
                      <span class="text-on-surface-variant font-medium">${bdayFormatted}</span>
                    </div>
                  </div>
                </div>

                <div class="flex flex-col items-end gap-1 flex-shrink-0 pl-2">
                  <span class="px-2 py-0.5 rounded-full ${hasDebt ? 'bg-error-container text-error' : 'bg-secondary/10 text-secondary'} font-label-sm text-label-sm font-bold flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-[12px]">${hasDebt ? 'schedule' : 'check_circle'}</span>
                    ${hasDebt ? 'Debe' : 'Al día'}
                  </span>
                  <span class="px-2 py-0.5 rounded-full ${child.modality === 'Completo' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-primary-fixed text-on-primary-fixed-variant'} font-label-sm text-label-sm font-semibold">
                    ${child.modality}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Footer de Tarjeta con acciones rápidas -->
        <div class="pt-2 flex items-center justify-between gap-2 border-t border-surface-container/60">
          <a href="tel:${cleanPhone}" class="flex-1 py-2 px-3 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 hover:bg-surface-container-high transition-colors active:scale-95">
            <span class="material-symbols-outlined text-[16px] text-secondary">phone</span>
            <span>Llamar</span>
          </a>
          <a href="https://wa.me/${cleanPhone}" target="_blank" class="flex-1 py-2 px-3 rounded-xl bg-secondary-container/40 text-on-secondary-container font-label-md text-label-md flex items-center justify-center gap-1.5 hover:bg-secondary-container transition-colors active:scale-95 font-bold">
            <span class="material-symbols-outlined text-[16px]">chat</span>
            <span>WhatsApp</span>
          </a>
          <button onclick="openPaymentModal(${fam.id})" class="py-2 px-3 rounded-xl bg-secondary text-on-secondary font-label-md text-label-md font-bold flex items-center justify-center gap-1 hover:opacity-95 transition-all shadow-sm active:scale-95">
            <span class="material-symbols-outlined text-[16px]">add_circle</span>
            <span>Cobrar</span>
          </button>
        </div>
      </article>
    `;
  }

  container.innerHTML = html;
}

// -------------------------------------------------------------
// 3. CONTROL DE PAGOS SEMANALES
// -------------------------------------------------------------
async function renderPagos() {
  const currentYear = state.selectedYear;
  const currentMonth = state.selectedMonth;
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = monthNames[currentMonth - 1];

  const monthTextEl = document.getElementById('currentMonthText');
  const monthWeeksSubtitleEl = document.getElementById('currentMonthWeeksSubtitle');
  if (monthTextEl) monthTextEl.textContent = `${monthName} ${currentYear}`;

  const totalWeeks = getWeeksInMonth(currentYear, currentMonth);
  if (monthWeeksSubtitleEl) monthWeeksSubtitleEl.textContent = `${totalWeeks} semanas lectivas`;

  const families = state.cachedData.families;
  const children = state.cachedData.children;
  const payments = state.cachedData.payments.filter(p => p.year === currentYear && p.month === currentMonth);

  // Group children
  const childrenByFam = new Map();
  children.forEach(c => {
    if (!childrenByFam.has(c.familyId)) childrenByFam.set(c.familyId, []);
    childrenByFam.get(c.familyId).push(c);
  });

  // Calculate totals
  let totalExpected = 0;
  families.forEach(f => {
    const famPayments = payments.filter(p => p.familyId === f.id);
    const exoneratedCount = famPayments.filter(p => p.status === 'exonerado' || p.method === 'exonerado').length;
    const billableWeeks = Math.max(0, totalWeeks - exoneratedCount);
    totalExpected += (f.weeklyRate || 0) * billableWeeks;
  });

  let totalCollected = 0;
  payments.forEach(p => {
    if (p.status !== 'exonerado' && p.method !== 'exonerado') {
      totalCollected += (p.amount || 0);
    }
  });

  const totalPending = Math.max(0, totalExpected - totalCollected);
  const percent = totalExpected > 0 ? Math.min(100, Math.round((totalCollected / totalExpected) * 100)) : 100;

  // Header metrics
  const pendingAmountEl = document.getElementById('pendingAmountText');
  const collectedAmountEl = document.getElementById('collectedAmountText');
  const rateComplianceEl = document.getElementById('rateComplianceText');

  if (pendingAmountEl) pendingAmountEl.textContent = `Pendiente: $${totalPending.toFixed(0)}`;
  if (collectedAmountEl) collectedAmountEl.textContent = `$${totalCollected.toFixed(0)}`;
  if (rateComplianceEl) rateComplianceEl.textContent = `${percent}%`;

  // Search & Filter
  const q = normalizeSearchText(state.paymentSearch);
  const filter = state.paymentFilter;

  const filteredFamilies = families.filter(fam => {
    const famChildren = childrenByFam.get(fam.id) || [];
    const childrenNames = famChildren.map(c => `${c.firstName} ${c.lastName} ${c.school}`).join(' ');
    const searchTarget = normalizeSearchText(`${fam.repName} ${fam.phone} ${childrenNames}`);

    if (q && !searchTarget.includes(q)) return false;

    const famPayments = payments.filter(p => p.familyId === fam.id);
    const paidWeeksSet = new Map(famPayments.map(p => [p.week, p]));
    let pendingCount = 0;
    for (let w = 1; w <= totalWeeks; w++) {
      if (!paidWeeksSet.has(w)) pendingCount++;
    }
    const hasDebt = pendingCount > 0;

    if (filter === 'pending' && !hasDebt) return false;
    if (filter === 'ontime' && hasDebt) return false;

    return true;
  });

  const listContainer = document.getElementById('paymentsFamilyList');
  if (!listContainer) return;

  if (filteredFamilies.length === 0) {
    listContainer.innerHTML = `
      <div class="bg-surface-container-lowest p-space-xl rounded-2xl text-center flex flex-col items-center justify-center gap-2 border border-dashed border-outline-variant">
        <span class="material-symbols-outlined text-4xl text-on-surface-variant/40">savings</span>
        <p class="font-headline-sm text-headline-sm text-on-surface font-bold">No hay registros de cobro para mostrar</p>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Intenta cambiar el mes o limpiar los filtros.</p>
      </div>
    `;
    return;
  }

  let html = '';
  for (const fam of filteredFamilies) {
    const famChildren = childrenByFam.get(fam.id) || [];
    const famPayments = payments.filter(p => p.familyId === fam.id);
    const paidWeeksSet = new Map(famPayments.map(p => [p.week, p]));

    const childrenNames = famChildren.map(c => `${c.firstName} ${c.lastName[0] || ''}.`).join(', ');
    const schoolName = famChildren.length > 0 ? famChildren[0].school : '';
    const initials = getInitials(fam.repName, '');
    const cleanPhone = fam.phone.replace(/[^0-9]/g, '');

    // Identify pending and exonerated weeks
    const pendingWeeks = [];
    const exoneratedWeeks = [];
    for (let w = 1; w <= totalWeeks; w++) {
      const p = paidWeeksSet.get(w);
      if (!p) {
        pendingWeeks.push(w);
      } else if (p.status === 'exonerado' || p.method === 'exonerado') {
        exoneratedWeeks.push(w);
      }
    }
    const hasDebt = pendingWeeks.length > 0;
    const debtAmount = pendingWeeks.length * fam.weeklyRate;

    html += `
      <article class="family-card bg-surface-container-lowest rounded-2xl p-space-md shadow-[0_4px_16px_-2px_rgba(15,23,42,0.04)] flex flex-col gap-space-sm border border-surface-container/50 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between gap-space-sm">
          <div class="flex items-center gap-space-sm min-w-0">
            <div class="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-headline-sm text-headline-sm font-extrabold shadow-sm shrink-0">
              ${initials}
            </div>
            <div class="flex flex-col min-w-0">
              <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                ${fam.repName}
              </h2>
              <p class="font-body-sm text-body-sm text-on-surface-variant truncate">
                ${childrenNames} ${schoolName ? `(${schoolName})` : ''}
              </p>
            </div>
          </div>
          <div class="shrink-0 bg-primary-container/20 text-on-primary-container px-2.5 py-1 rounded-full font-label-md text-label-md font-extrabold">
            $${parseFloat(fam.weeklyRate).toFixed(0)}/sem
          </div>
        </div>

        <!-- Fila de Semanas -->
        <div class="pt-space-xs">
          <span class="font-label-sm text-label-sm text-on-surface-variant block mb-1.5 font-medium">Estado de cuotas semanales:</span>
          <div class="grid ${totalWeeks === 5 ? 'grid-cols-5' : 'grid-cols-4'} gap-1.5">
            ${Array.from({ length: totalWeeks }, (_, idx) => {
              const weekNum = idx + 1;
              const payment = paidWeeksSet.get(weekNum);
              if (payment) {
                const isExon = payment.status === 'exonerado' || payment.method === 'exonerado';
                if (isExon) {
                  // Week is EXONERATED
                  return `
                    <button type="button" onclick="showReceiptModal(${payment.id})" class="h-10 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-transform" title="Semana ${weekNum} Exonerada (${escapeHtml(payment.reason || payment.motivo || 'Vacaciones')}) - Clic para ver comprobante">
                      <span class="material-symbols-outlined text-[16px] text-tertiary">beach_access</span>
                      <span class="font-label-sm text-label-sm font-bold">Sem ${weekNum}</span>
                    </button>
                  `;
                } else {
                  // Week is PAID
                  return `
                    <button type="button" onclick="showReceiptModal(${payment.id})" class="h-10 rounded-xl bg-secondary text-on-secondary flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-transform" title="Semana ${weekNum} Pagada - Clic para ver recibo">
                      <span class="material-symbols-outlined text-[16px]">check</span>
                      <span class="font-label-sm text-label-sm font-bold">Sem ${weekNum}</span>
                    </button>
                  `;
                }
              } else {
                // Week is PENDING
                return `
                  <button type="button" onclick="openPaymentModal(${fam.id}, ${weekNum})" class="h-10 rounded-xl bg-error-container text-error flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-transform hover:bg-error-container/80 relative" title="Semana ${weekNum} Pendiente - Clic para cobrar">
                    <span class="material-symbols-outlined text-[16px]">schedule</span>
                    <span class="font-label-sm text-label-sm font-bold">Sem ${weekNum}</span>
                  </button>
                `;
              }
            }).join('')}
          </div>
        </div>

        <!-- Pie de Tarjeta / Acciones -->
        <div class="pt-space-xs mt-space-xs flex items-center justify-between gap-space-sm border-t border-surface-container/60">
          <div class="flex items-center gap-1.5 flex-wrap font-label-md text-label-md">
            ${hasDebt ? `
              <span class="material-symbols-outlined text-[16px] text-error">info</span>
              <span class="text-error font-extrabold">Debe $${debtAmount.toFixed(0)} (Sem ${pendingWeeks.join(', ')})</span>
            ` : `
              <span class="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
              <span class="text-secondary font-extrabold">Al día ✨</span>
            `}
            ${exoneratedWeeks.length > 0 ? `
              <span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-label-sm text-label-sm font-semibold flex items-center gap-1 border border-slate-200 dark:border-slate-700" title="${exoneratedWeeks.length} semana(s) exonerada(s)">
                <span class="material-symbols-outlined text-[13px] text-tertiary">beach_access</span>
                ${exoneratedWeeks.length} sem. exonerada${exoneratedWeeks.length > 1 ? 's' : ''}
              </span>
            ` : ''}
          </div>

          <div class="flex items-center gap-space-xs">
            ${hasDebt ? `
              <!-- Botón Recordar WhatsApp -->
              <button onclick="triggerWhatsAppReminder('${escapeHtml(fam.repName)}', '${escapeHtml(childrenNames)}', ${debtAmount}, '${pendingWeeks.join(', ')}', '${cleanPhone}')" class="h-9 px-3 rounded-lg bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md font-bold flex items-center gap-1.5 active:scale-95 transition-transform hover:opacity-90" title="Recordar por WhatsApp">
                <span class="material-symbols-outlined text-[17px]">chat</span>
                <span>Recordar</span>
              </button>
              <!-- Botón Cobrar -->
              <button onclick="openPaymentModal(${fam.id}, ${pendingWeeks[0]})" class="h-9 px-3 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-bold flex items-center gap-1 active:scale-95 transition-transform shadow-sm hover:opacity-95" title="Registrar Pago">
                <span class="material-symbols-outlined text-[17px]">add_circle</span>
                <span>Cobrar</span>
              </button>
            ` : `
              <button onclick="openExonerarModal(${fam.id})" class="h-9 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform" title="Exonerar semanas a esta familia">
                <span class="material-symbols-outlined text-[16px] text-tertiary">beach_access</span>
                <span>Exonerar</span>
              </button>
              <button onclick="openPaymentModal(${fam.id})" class="h-9 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold flex items-center gap-1 active:scale-95 transition-transform">
                <span class="material-symbols-outlined text-[17px]">add</span>
                <span>Adelanto</span>
              </button>
            `}
          </div>
        </div>
      </article>
    `;
  }

  listContainer.innerHTML = html;
}

// WhatsApp payment reminder
window.triggerWhatsAppReminder = function(repName, childrenNames, amount, weeks, phone) {
  const settings = state.settings;
  const driver = settings.driverName || 'el transporte escolar';
  const unit = settings.vehicleUnit || 'Transporte Escolar';
  
  const text = encodeURIComponent(
    `Hola ${repName}, te saluda ${driver} de ${unit}. 👋\n\nTe recordamos amablemente la cuota pendiente de transporte escolar correspondiente a la(s) semana(s) ${weeks} de ${childrenNames} por un monto de $${amount}.\n\n` +
    (settings.pagoMovilPhone ? `🏦 *Datos Pago Móvil:*\nBanco: ${settings.pagoMovilBank}\nTel: ${settings.pagoMovilPhone}\nCI/RIF: ${settings.pagoMovilId}\n\n` : '') +
    `¡Muchas gracias por su puntualidad y confianza! 🙏\n` +
    `────────────────────\n` +
    `🚐 *MiRuta* • Transporte Escolar`
  );

  const waUrl = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  showToast(`Abriendo WhatsApp para ${repName}...`, 'chat');
  window.open(waUrl, '_blank');
};

// -------------------------------------------------------------
// 4. VISTA DE AJUSTES (SETTINGS)
// -------------------------------------------------------------
async function renderAjustes() {
  const settings = state.settings;

  // Form fields
  const driverNameInput = document.getElementById('settingsDriverName');
  const driverPhoneInput = document.getElementById('settingsDriverPhone');
  const vehicleUnitInput = document.getElementById('settingsVehicleUnit');
  const vehicleModelInput = document.getElementById('settingsVehicleModel');
  const vehiclePlateInput = document.getElementById('settingsVehiclePlate');
  const birthdayDaysInput = document.getElementById('settingsBirthdayDays');
  const birthdayDaysVal = document.getElementById('settingsBirthdayDaysVal');

  const pmBankInput = document.getElementById('settingsPmBank');
  const pmPhoneInput = document.getElementById('settingsPmPhone');
  const pmIdInput = document.getElementById('settingsPmId');

  if (driverNameInput) driverNameInput.value = settings.driverName || '';
  if (driverPhoneInput) driverPhoneInput.value = settings.driverPhone || '';
  if (vehicleUnitInput) vehicleUnitInput.value = settings.vehicleUnit || '';
  if (vehicleModelInput) vehicleModelInput.value = settings.vehicleModel || '';
  if (vehiclePlateInput) vehiclePlateInput.value = settings.vehiclePlate || '';
  
  if (birthdayDaysInput) {
    birthdayDaysInput.value = settings.birthdayNoticeDays || 5;
    if (birthdayDaysVal) birthdayDaysVal.textContent = `${settings.birthdayNoticeDays || 5} días`;
  }

  if (pmBankInput) pmBankInput.value = settings.pagoMovilBank || '';
  if (pmPhoneInput) pmPhoneInput.value = settings.pagoMovilPhone || '';
  if (pmIdInput) pmIdInput.value = settings.pagoMovilId || '';

  // Render Schools Catalog
  renderSchoolsList();
}

function renderSchoolsList() {
  const container = document.getElementById('schoolsListContainer');
  if (!container) return;

  const schools = state.cachedData.schools || [];
  if (schools.length === 0) {
    container.innerHTML = `<p class="text-body-sm text-on-surface-variant italic">No hay colegios en el catálogo.</p>`;
    return;
  }

  container.innerHTML = schools.map(school => `
    <div class="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-surface-container">
      <div class="flex items-center gap-2 min-w-0">
        <span class="material-symbols-outlined text-[18px] text-primary">school</span>
        <span class="font-body-md text-body-md text-on-surface font-medium truncate">${escapeHtml(school)}</span>
      </div>
      <button onclick="handleDeleteSchool('${escapeHtml(school)}')" class="w-8 h-8 rounded-lg text-error hover:bg-error-container/40 flex items-center justify-center transition-colors" title="Eliminar colegio">
        <span class="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </div>
  `).join('');
}

window.handleDeleteSchool = async function(schoolName) {
  try {
    await MiRutaDB.removeSchool(schoolName);
    await refreshData();
    renderSchoolsList();
    showToast(`Colegio "${schoolName}" eliminado`, 'delete');
  } catch (err) {
    console.error(err);
    showToast('Error al eliminar colegio', 'error');
  }
};

window.handleAddSchool = async function() {
  const input = document.getElementById('newSchoolInput');
  if (!input || !input.value.trim()) return;

  const schoolName = input.value.trim();
  try {
    await MiRutaDB.addSchool(schoolName);
    input.value = '';
    await refreshData();
    renderSchoolsList();
    showToast(`Colegio "${schoolName}" agregado al catálogo`, 'check_circle');
  } catch (err) {
    console.error(err);
    showToast('Error al agregar colegio', 'error');
  }
};

window.handleSaveSettings = async function(e) {
  if (e) e.preventDefault();
  try {
    const updated = {
      driverName: document.getElementById('settingsDriverName').value.trim(),
      driverPhone: document.getElementById('settingsDriverPhone').value.trim(),
      vehicleUnit: document.getElementById('settingsVehicleUnit').value.trim(),
      vehicleModel: document.getElementById('settingsVehicleModel').value.trim(),
      vehiclePlate: document.getElementById('settingsVehiclePlate').value.trim(),
      birthdayNoticeDays: parseInt(document.getElementById('settingsBirthdayDays').value) || 5,
      pagoMovilBank: document.getElementById('settingsPmBank').value.trim(),
      pagoMovilPhone: document.getElementById('settingsPmPhone').value.trim(),
      pagoMovilId: document.getElementById('settingsPmId').value.trim()
    };

    await MiRutaDB.updateSettings(updated);
    await refreshData();
    showToast('¡Configuración guardada con éxito!', 'check_circle');
    updateHeader();
  } catch (err) {
    console.error(err);
    showToast('Error al guardar configuración', 'error');
  }
};

// -------------------------------------------------------------
// HELPER: Portapapeles Robusto con Fallback (HTTP Local y Móvil)
// -------------------------------------------------------------
window.copyToClipboard = async function(text, successMsg = '¡Copiado al portapapeles!') {
  if (!text) return false;

  let copied = false;

  // 1. Intentar API moderna de Clipboard si está en contexto seguro
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (e) {
      console.warn('navigator.clipboard no disponible o bloqueado, usando textarea fallback:', e);
    }
  }

  // 2. Fallback robusto usando <textarea> invisible + document.execCommand('copy')
  if (!copied) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      // Posición fija fuera del viewport para evitar saltos o scroll en el teléfono
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.fontSize = '16px'; // Evita zoom automático en iOS Safari
      textarea.setAttribute('readonly', '');

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      copied = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (err) {
      console.error('execCommand copy falló:', err);
      copied = false;
    }
  }

  if (copied) {
    showToast(successMsg, 'check_circle');
    return true;
  } else {
    showToast('No se pudo copiar automáticamente', 'error');
    return false;
  }
};

window.handleCopyPagoMovil = function() {
  const settings = state.settings || {};
  const bank = settings.pagoMovilBank || 'No configurado';
  const phone = settings.pagoMovilPhone || 'No configurado';
  const id = settings.pagoMovilId || 'No configurado';
  const name = settings.driverName || 'Transporte Escolar';

  const textToCopy = 
    `🚍 *DATOS DE PAGO MÓVIL - ${settings.vehicleUnit || 'MiRuta'}*\n` +
    `👤 Titular: ${name}\n` +
    `🏦 Banco: ${bank}\n` +
    `📱 Teléfono: ${phone}\n` +
    `🆔 Cédula/RIF: ${id}\n\n` +
    `Por favor enviar el capture o los últimos 4 dígitos de la referencia al pagar. ¡Muchas gracias! 🙏`;

  window.copyToClipboard(textToCopy, '¡Datos de Pago Móvil copiados al portapapeles!');
};

// -------------------------------------------------------------
// 5. MODALS & FORMS
// -------------------------------------------------------------

// MODAL: Registrar Pago / Exonerar Período (Bottom Sheet)
let currentPaymentModalMode = 'payment';

window.setPaymentModalMode = function(mode) {
  currentPaymentModalMode = mode;
  const payBtn = document.getElementById('modalModePaymentBtn');
  const exonBtn = document.getElementById('modalModeExonerateBtn');
  const payFields = document.getElementById('modalPaymentFieldsSection');
  const exonFields = document.getElementById('modalExonerateFieldsSection');
  const submitBtn = document.getElementById('modalSubmitPaymentBtn');
  const submitIcon = document.getElementById('modalSubmitPaymentIcon');
  const submitText = document.getElementById('modalSubmitPaymentText');
  const title = document.getElementById('paymentModalTitle');
  const subtitle = document.getElementById('paymentModalSubtitle');
  const dateLabel = document.getElementById('modalDateLabel');

  if (mode === 'exonerate') {
    if (payBtn) payBtn.className = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-1.5 text-on-surface-variant hover:text-on-surface';
    if (exonBtn) exonBtn.className = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-1.5 bg-surface-container-lowest text-on-surface shadow-sm';

    if (payFields) payFields.classList.add('hidden');
    if (exonFields) {
      exonFields.classList.remove('hidden');
      exonFields.classList.add('flex');
    }

    if (title) title.textContent = 'Exonerar Período';
    if (subtitle) subtitle.textContent = 'Semana sin cobro de tarifa';
    if (dateLabel) dateLabel.textContent = 'Fecha de exoneración';

    if (submitBtn) {
      submitBtn.className = 'w-full h-12 rounded-xl bg-tertiary text-on-tertiary font-label-lg text-label-lg font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-transform hover:opacity-95';
    }
    if (submitIcon) submitIcon.textContent = 'beach_access';
    if (submitText) submitText.textContent = 'Confirmar Exoneración ($0.00)';
  } else {
    if (payBtn) payBtn.className = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-1.5 bg-surface-container-lowest text-on-surface shadow-sm';
    if (exonBtn) exonBtn.className = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-1.5 text-on-surface-variant hover:text-on-surface';

    if (payFields) payFields.classList.remove('hidden');
    if (exonFields) {
      exonFields.classList.add('hidden');
      exonFields.classList.remove('flex');
    }

    if (title) title.textContent = 'Registrar Pago';
    if (subtitle) subtitle.textContent = 'Cuota de transporte escolar';
    if (dateLabel) dateLabel.textContent = 'Fecha de pago';

    if (submitBtn) {
      submitBtn.className = 'w-full h-12 rounded-xl bg-secondary text-on-secondary font-label-lg text-label-lg font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-transform hover:opacity-95';
    }
    if (submitIcon) submitIcon.textContent = 'check_circle';
    if (submitText) submitText.textContent = 'Confirmar y Guardar Pago';
  }
};

window.setModalExonReasonQuick = function(reason) {
  const input = document.getElementById('modalExonReasonInput');
  if (input) input.value = reason;

  document.querySelectorAll('.modal-exon-chip').forEach(chip => {
    if (chip.textContent.trim().toLowerCase().includes(reason.toLowerCase().slice(0, 5))) {
      chip.classList.add('bg-surface-container-high', 'text-on-surface');
      chip.classList.remove('text-on-surface-variant');
    } else {
      chip.classList.remove('bg-surface-container-high', 'text-on-surface');
      chip.classList.add('text-on-surface-variant');
    }
  });
};

window.onPaymentModalFamilyChange = function() {
  const familyId = document.getElementById('modalFamilySelect')?.value;
  if (!familyId) return;
  const fam = state.cachedData.families.find(f => f.id === Number(familyId));
  if (fam && document.getElementById('modalAmountInput')) {
    document.getElementById('modalAmountInput').value = parseFloat(fam.weeklyRate).toFixed(2);
  }
};

window.openPaymentModal = function(preselectedFamilyId = null, preselectedWeek = null, initialMode = 'payment') {
  const modal = document.getElementById('paymentModal');
  if (!modal) return;

  const families = state.cachedData.families;
  const familySelect = document.getElementById('modalFamilySelect');
  const weekSelect = document.getElementById('modalWeekSelect');
  const amountInput = document.getElementById('modalAmountInput');
  const refInput = document.getElementById('modalRefInput');
  const dateInput = document.getElementById('modalDateInput');
  const notesInput = document.getElementById('modalNotesInput');
  const reasonInput = document.getElementById('modalExonReasonInput');

  // Populate family select
  familySelect.innerHTML = families.map(f => `
    <option value="${f.id}" ${preselectedFamilyId && f.id === preselectedFamilyId ? 'selected' : ''}>
      ${escapeHtml(f.repName)} ($${parseFloat(f.weeklyRate).toFixed(0)}/sem)
    </option>
  `).join('');

  familySelect.onchange = window.onPaymentModalFamilyChange;

  // Auto set amount from selected family
  const selectedFamId = preselectedFamilyId || (families[0] ? families[0].id : null);
  const selectedFam = families.find(f => f.id === Number(selectedFamId));
  if (amountInput && selectedFam) {
    amountInput.value = parseFloat(selectedFam.weeklyRate).toFixed(2);
  }

  // Populate week select based on month
  const totalWeeks = getWeeksInMonth(state.selectedYear, state.selectedMonth);
  weekSelect.innerHTML = Array.from({ length: totalWeeks }, (_, i) => {
    const w = i + 1;
    return `<option value="${w}" ${preselectedWeek && preselectedWeek === w ? 'selected' : ''}>Semana ${w}</option>`;
  }).join('');

  // Default date to today
  if (dateInput) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    dateInput.value = `${y}-${m}-${d}`;
  }

  if (refInput) refInput.value = '';
  if (notesInput) notesInput.value = '';
  if (reasonInput) reasonInput.value = 'Vacaciones escolares';

  // Restore quick chips for exoneration in modal
  document.querySelectorAll('.modal-exon-chip').forEach((chip, idx) => {
    if (idx === 0) {
      chip.classList.add('bg-surface-container-high', 'text-on-surface');
      chip.classList.remove('text-on-surface-variant');
    } else {
      chip.classList.remove('bg-surface-container-high', 'text-on-surface');
      chip.classList.add('text-on-surface-variant');
    }
  });

  // Reset method to Pago Móvil
  selectPaymentMethod('pago_movil');

  // Set mode (default 'payment' or initialMode)
  setPaymentModalMode(initialMode || 'payment');

  // Show modal
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
};

window.closePaymentModal = function() {
  const modal = document.getElementById('paymentModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
};

window.selectPaymentMethod = function(method) {
  const methods = ['pago_movil', 'efectivo', 'transferencia'];
  const refContainer = document.getElementById('modalRefContainer');

  methods.forEach(m => {
    const btn = document.getElementById(`methodBtn_${m}`);
    if (!btn) return;
    if (m === method) {
      btn.className = 'method-btn h-12 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all border border-secondary';
    } else {
      btn.className = 'method-btn h-12 rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container font-label-md text-label-md font-bold flex flex-col items-center justify-center gap-0.5 transition-all';
    }
  });

  const hiddenInput = document.getElementById('modalPaymentMethod');
  if (hiddenInput) hiddenInput.value = method;

  // Toggle reference field for cash vs digital
  if (refContainer) {
    if (method === 'efectivo') {
      refContainer.classList.add('opacity-50');
      document.getElementById('modalRefInput').placeholder = 'Opcional (Efectivo)';
    } else {
      refContainer.classList.remove('opacity-50');
      document.getElementById('modalRefInput').placeholder = 'Ej: 8492';
    }
  }
};

window.confirmSavePayment = async function() {
  const familyId = document.getElementById('modalFamilySelect')?.value;
  const week = document.getElementById('modalWeekSelect')?.value;
  const date = document.getElementById('modalDateInput')?.value;
  const notes = document.getElementById('modalNotesInput')?.value || '';

  if (!familyId || !week) {
    showToast('Por favor selecciona la familia y la semana', 'error');
    return;
  }

  // MODO EXONERAR
  if (currentPaymentModalMode === 'exonerate') {
    const reason = document.getElementById('modalExonReasonInput')?.value.trim() || 'Vacaciones escolares';

    try {
      const paymentId = await MiRutaDB.registerPayment({
        familyId: Number(familyId),
        year: state.selectedYear,
        month: state.selectedMonth,
        week: Number(week),
        amount: 0,
        monto: 0,
        method: 'exonerado',
        reference: `EXO-S${week}`,
        date: date || new Date().toISOString().split('T')[0],
        status: 'exonerado',
        estado: 'exonerado',
        reason: reason,
        motivo: reason,
        notes: notes
      });

      closePaymentModal();
      await refreshData();
      await renderApp();

      showToast(`¡Semana ${week} exonerada ($0.00) con éxito!`, 'beach_access');

      // Mostrar comprobante visual de exoneración
      setTimeout(() => {
        showReceiptModal(paymentId, true);
      }, 400);

    } catch (err) {
      console.error('Error saving exoneration from payment modal:', err);
      showToast('Error al exonerar período', 'error');
    }
    return;
  }

  // MODO PAGO NORMAL
  const amount = document.getElementById('modalAmountInput')?.value;
  const method = document.getElementById('modalPaymentMethod')?.value || 'pago_movil';
  const reference = document.getElementById('modalRefInput')?.value;

  if (!amount) {
    showToast('Por favor completa el monto del pago', 'error');
    return;
  }

  try {
    const paymentId = await MiRutaDB.registerPayment({
      familyId: Number(familyId),
      year: state.selectedYear,
      month: state.selectedMonth,
      week: Number(week),
      amount: parseFloat(amount),
      method,
      reference,
      date,
      status: 'completado',
      notes
    });

    closePaymentModal();
    await refreshData();
    await renderApp();

    showToast(`¡Pago de $${parseFloat(amount).toFixed(0)} registrado con éxito!`, 'check_circle');

    // Prompt receipt option
    setTimeout(() => {
      showReceiptModal(paymentId, true);
    }, 400);

  } catch (err) {
    console.error('Error saving payment:', err);
    showToast('Error al registrar pago', 'error');
  }
};

// =============================================================
// MODAL: EXONERAR PAGOS / SEMANAS (VACACIONES Y ASUETOS)
// =============================================================

let currentExonScope = 'all';

window.openExonerarModal = function(preselectedFamilyId = null) {
  const modal = document.getElementById('exonerarModal');
  if (!modal) return;

  const currentYear = state.selectedYear;
  const currentMonth = state.selectedMonth;
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = monthNames[currentMonth - 1];

  const monthLabel = document.getElementById('exonMonthLabel');
  if (monthLabel) monthLabel.textContent = `${monthName} ${currentYear}`;

  // Llenar selector de familias
  const selectEl = document.getElementById('exonFamilySelect');
  if (selectEl) {
    const families = state.cachedData.families;
    selectEl.innerHTML = families.map(f => `
      <option value="${f.id}" ${preselectedFamilyId && f.id === preselectedFamilyId ? 'selected' : ''}>
        ${escapeHtml(f.repName)} (${f.phone}) - $${parseFloat(f.weeklyRate).toFixed(0)}/sem
      </option>
    `).join('');
  }

  // Generar checkboxes de semanas según el mes seleccionado
  const totalWeeks = getWeeksInMonth(currentYear, currentMonth);
  const weeksContainer = document.getElementById('exonWeeksCheckboxes');
  if (weeksContainer) {
    weeksContainer.innerHTML = Array.from({ length: totalWeeks }, (_, idx) => {
      const weekNum = idx + 1;
      return `
        <label class="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-surface-container-low border border-surface-container cursor-pointer select-none has-[:checked]:bg-secondary/10 has-[:checked]:border-secondary transition-all">
          <input type="checkbox" name="exonWeek" value="${weekNum}" checked class="w-4 h-4 rounded text-secondary focus:ring-0 cursor-pointer" />
          <span class="font-label-md text-label-md font-bold text-on-surface">Sem ${weekNum}</span>
        </label>
      `;
    }).join('');
  }

  // Resetear campos
  const reasonInput = document.getElementById('exonReasonInput');
  if (reasonInput) reasonInput.value = 'Vacaciones escolares';

  const startInput = document.getElementById('exonStartDateInput');
  if (startInput) startInput.value = '';

  const endInput = document.getElementById('exonEndDateInput');
  if (endInput) endInput.value = '';

  const overwriteCheckbox = document.getElementById('exonOverwriteCheckbox');
  if (overwriteCheckbox) overwriteCheckbox.checked = false;

  // Restaurar chips de motivo
  document.querySelectorAll('.exon-reason-chip').forEach((chip, idx) => {
    if (idx === 0) {
      chip.classList.add('bg-surface-container-high', 'text-on-surface');
      chip.classList.remove('text-on-surface-variant');
    } else {
      chip.classList.remove('bg-surface-container-high', 'text-on-surface');
      chip.classList.add('text-on-surface-variant');
    }
  });

  // Establecer alcance: Si viene familia seleccionada, 'single'; de lo contrario, 'all'
  setExonScope(preselectedFamilyId ? 'single' : 'all');

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
};

window.closeExonerarModal = function() {
  const modal = document.getElementById('exonerarModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
};

window.setExonScope = function(scope) {
  currentExonScope = scope;
  const singleBtn = document.getElementById('exonScopeSingleBtn');
  const allBtn = document.getElementById('exonScopeAllBtn');
  const famContainer = document.getElementById('exonFamilyContainer');

  if (scope === 'single') {
    if (singleBtn) {
      singleBtn.className = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-1.5 bg-surface-container-lowest text-on-surface shadow-sm';
    }
    if (allBtn) {
      allBtn.className = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-1.5 text-on-surface-variant hover:text-on-surface';
    }
    if (famContainer) famContainer.classList.remove('hidden');
  } else {
    if (allBtn) {
      allBtn.className = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-1.5 bg-surface-container-lowest text-on-surface shadow-sm';
    }
    if (singleBtn) {
      singleBtn.className = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-1.5 text-on-surface-variant hover:text-on-surface';
    }
    if (famContainer) famContainer.classList.add('hidden');
  }
};

window.setExonReasonQuick = function(reason) {
  const input = document.getElementById('exonReasonInput');
  if (input) input.value = reason;

  document.querySelectorAll('.exon-reason-chip').forEach(chip => {
    if (chip.textContent.trim().toLowerCase().includes(reason.toLowerCase().slice(0, 5))) {
      chip.classList.add('bg-surface-container-high', 'text-on-surface');
      chip.classList.remove('text-on-surface-variant');
    } else {
      chip.classList.remove('bg-surface-container-high', 'text-on-surface');
      chip.classList.add('text-on-surface-variant');
    }
  });
};

window.toggleAllExonWeeks = function() {
  const checkboxes = document.querySelectorAll('#exonWeeksCheckboxes input[type="checkbox"]');
  if (checkboxes.length === 0) return;
  const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
  checkboxes.forEach(cb => { cb.checked = anyUnchecked; });
};

window.confirmSaveExoneration = async function() {
  try {
    const selectedWeeks = Array.from(document.querySelectorAll('#exonWeeksCheckboxes input[type="checkbox"]:checked'))
      .map(cb => Number(cb.value));

    if (selectedWeeks.length === 0) {
      showToast('Selecciona al menos una semana a exonerar', 'error');
      return;
    }

    let targetFamilyIds = [];
    if (currentExonScope === 'single') {
      const famSelect = document.getElementById('exonFamilySelect');
      const famId = famSelect ? Number(famSelect.value) : null;
      if (!famId) {
        showToast('Selecciona una familia para exonerar', 'error');
        return;
      }
      targetFamilyIds = [famId];
    } else {
      targetFamilyIds = state.cachedData.families.map(f => f.id);
      if (targetFamilyIds.length === 0) {
        showToast('No hay familias registradas en el sistema', 'error');
        return;
      }
    }

    const reasonInput = document.getElementById('exonReasonInput');
    const reason = (reasonInput && reasonInput.value.trim()) ? reasonInput.value.trim() : 'Vacaciones escolares';

    const startDateInput = document.getElementById('exonStartDateInput');
    const startDate = (startDateInput && startDateInput.value) ? startDateInput.value : null;

    const endDateInput = document.getElementById('exonEndDateInput');
    const endDate = (endDateInput && endDateInput.value) ? endDateInput.value : null;

    const overwriteCheckbox = document.getElementById('exonOverwriteCheckbox');
    const overwritePaid = overwriteCheckbox ? overwriteCheckbox.checked : false;

    // Confirmación si es masivo
    if (currentExonScope === 'all') {
      const confirmMsg = `¿Deseas aplicar la exoneración por "${reason}" a todas las familias activas (${targetFamilyIds.length}) para las semanas ${selectedWeeks.join(', ')}?`;
      if (!confirm(confirmMsg)) return;
    }

    const createdIds = await MiRutaDB.exonerateWeeks({
      familyIds: targetFamilyIds,
      year: state.selectedYear,
      month: state.selectedMonth,
      weeks: selectedWeeks,
      reason,
      startDate,
      endDate,
      overwritePaid
    });

    closeExonerarModal();
    await refreshData();
    await renderApp();

    const scopeDesc = currentExonScope === 'all' ? 'toda la ruta' : 'la familia';
    showToast(`¡Semanas exoneradas (${createdIds.length} registro(s)) para ${scopeDesc}!`, 'beach_access');

    // Si fue una sola familia y se exoneró 1 sola semana, abrimos comprobante
    if (currentExonScope === 'single' && createdIds && createdIds.length === 1) {
      setTimeout(() => {
        showReceiptModal(createdIds[0]);
      }, 400);
    }
  } catch (err) {
    console.error('Error aplicando exoneración:', err);
    showToast('Error al aplicar exoneración', 'error');
  }
};

// =============================================================
// COMPROBANTE DE PAGO EN IMAGEN PNG (CANVAS 100% OFFLINE Y VECTORIAL)
// =============================================================

let currentReceiptCanvas = null;
let currentReceiptBlob = null;
let currentReceiptPayment = null;
let currentReceiptRepName = '';
let currentReceiptRepPhone = '';
let currentReceiptText = '';

// Caché en memoria para logo-miruta.png
let cachedLogoImage = null;

// Pre-carga inmediata de logo-miruta.png
(function preloadLogoMiruta() {
  try {
    const img = new Image();
    img.onload = () => { cachedLogoImage = img; };
    img.src = 'logo-miruta.png';
  } catch (e) {}
})();

// Carga asíncrona segura de logo-miruta.png con timeout de 600ms y fallback garantizado
function loadLogoMiruta(timeoutMs = 600) {
  if (cachedLogoImage && cachedLogoImage.complete && cachedLogoImage.naturalWidth > 0) {
    return Promise.resolve(cachedLogoImage);
  }
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      resolve(null); // Fallback al dibujo vectorial si tarda
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      cachedLogoImage = img;
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null); // Fallback si hay error al cargar
    };
    img.src = 'logo-miruta.png';
  });
}

// Helper para obtener nombres de colegios (uno o varios hermanos, o 'No especificado')
function getFamilySchools(children) {
  let schoolList = [];
  if (Array.isArray(children)) {
    for (const c of children) {
      const s = (c && c.school) ? String(c.school).trim() : '';
      if (s && !schoolList.includes(s)) {
        schoolList.push(s);
      }
    }
  }
  return schoolList.length > 0 ? schoolList.join(', ') : 'No especificado';
}

// Dibujador nativo de rectángulos redondeados
function drawRoundRect(ctx, x, y, w, h, r, fill = true, stroke = false) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y + r, x, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// Isotipo Vectorial Nativo de MiRuta (Fallback 100% seguro si el logo local tarda o no carga)
function drawMiRutaVectorLogo(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 64;
  ctx.scale(s, s);

  // Escudo contenedor blanco
  ctx.fillStyle = '#FFFFFF';
  drawRoundRect(ctx, 0, 0, 64, 64, 16, true, false);

  // Carrocería del Autobús Escolar (Ámbar Cálido)
  ctx.fillStyle = '#F59E0B';
  drawRoundRect(ctx, 10, 15, 44, 32, 8, true, false);

  // Techo / Visera superior
  ctx.fillStyle = '#D97706';
  drawRoundRect(ctx, 13, 13, 38, 5, 2, true, false);

  // Parabrisas y ventanas delanteras (Vidrio oscuro tintado)
  ctx.fillStyle = '#0F172A';
  drawRoundRect(ctx, 14, 21, 16, 12, 3, true, false);
  drawRoundRect(ctx, 34, 21, 16, 12, 3, true, false);

  // Faros delanteros luminosos
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(17, 39, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(47, 39, 3, 0, Math.PI * 2);
  ctx.fill();

  // Rejilla frontal
  ctx.fillStyle = '#CBD5E1';
  drawRoundRect(ctx, 24, 37, 16, 4, 2, true, false);

  // Ruedas en Slate Oscuro
  ctx.fillStyle = '#1E293B';
  drawRoundRect(ctx, 13, 45, 10, 6, 2, true, false);
  drawRoundRect(ctx, 41, 45, 10, 6, 2, true, false);

  ctx.restore();
}

// Generador de Comprobante Estilo Tarjeta Bancaria (600x820 px en Canvas 2D)
function generateReceiptCanvas(payment, family, children, settings, logoImg = null) {
  const isExon = payment.status === 'exonerado' || payment.method === 'exonerado';
  const canvas = document.createElement('canvas');
  const w = 600;
  const h = 820;
  // Escala Retina 2x para definición ultra-nítida en pantallas móviles
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // Fondo blanco limpio
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  // Borde sutil exterior de la tarjeta
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, w, h);

  // 1. Encabezado (Verde Esmeralda para Pagos, Azul Océano para Exoneraciones)
  const headerGrad = ctx.createLinearGradient(0, 0, w, 106);
  if (isExon) {
    headerGrad.addColorStop(0, '#0369A1');
    headerGrad.addColorStop(1, '#0284C7');
  } else {
    headerGrad.addColorStop(0, '#047857');
    headerGrad.addColorStop(1, '#059669');
  }
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, w, 106);

  // Franja dorada de la marca
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(0, 103, w, 3);

  // Logo Oficial MiRuta: logo-miruta.png con fallback al dibujo vectorial
  if (logoImg && logoImg.naturalWidth > 0) {
    try {
      ctx.save();
      // Fondo blanco redondeado para encuadrar elegantemente el logo oficial
      ctx.fillStyle = '#FFFFFF';
      drawRoundRect(ctx, 24, 22, 60, 60, 14, true, false);
      ctx.clip();
      ctx.drawImage(logoImg, 24, 22, 60, 60);
      ctx.restore();
      // Borde exterior blanco suave
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      drawRoundRect(ctx, 24, 22, 60, 60, 14, false, true);
    } catch (e) {
      drawMiRutaVectorLogo(ctx, 24, 22, 60);
    }
  } else {
    drawMiRutaVectorLogo(ctx, 24, 22, 60);
  }

  // Título oficial
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isExon ? 'MiRuta • Comprobante de Exoneración' : 'MiRuta • Comprobante de Pago', 96, 52);

  ctx.fillStyle = isExon ? '#BAE6FD' : '#A7F3D0';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(isExon ? 'TARIFA EXONERADA • PERÍODO VACACIONAL / ASUETO' : 'TRANSPORTE ESCOLAR • SISTEMA ADMINISTRATIVO', 96, 74);

  // Píldora de Número de Recibo (Superior Derecha)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  drawRoundRect(ctx, 450, 36, 126, 32, 10, true, false);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12.5px monospace';
  ctx.textAlign = 'center';
  const receiptNumStr = isExon 
    ? `#EXO-${String(payment.id).padStart(4, '0')}`
    : `#REC-${String(payment.id).padStart(4, '0')}`;
  ctx.fillText(receiptNumStr, 513, 56);

  // 2. Sello de Estado
  if (isExon) {
    ctx.fillStyle = '#F0F9FF';
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 140, 126, 320, 40, 20, true, true);

    ctx.fillStyle = '#0369A1';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏖️  CUOTA EXONERADA ($0.00)', 300, 151);
  } else {
    ctx.fillStyle = '#ECFDF5';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 160, 126, 280, 40, 20, true, true);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✓  PAGO CONFIRMADO', 300, 151);
  }

  // 3. Monto Hero Grande
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(isExon ? 'MONTO REGISTRADO (EXONERADO)' : 'MONTO TOTAL RECIBIDO', 300, 196);

  ctx.fillStyle = isExon ? '#0284C7' : '#0F172A';
  ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const amountStr = isExon ? '$0.00' : `$${parseFloat(payment.amount).toFixed(2)}`;
  ctx.fillText(amountStr, 300, 242);

  ctx.fillStyle = '#475569';
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const reasonText = payment.reason || payment.motivo || 'Vacaciones escolares';
  ctx.fillText(isExon ? `Tarifa Exonerada • ${reasonText}` : 'Cuota de Transporte Escolar', 300, 268);

  // 4. Divisor de Perforación de Ticket con Muescas Laterales
  const divY = 292;
  ctx.fillStyle = '#F1F5F9';
  // Muesca izquierda
  ctx.beginPath();
  ctx.arc(0, divY, 12, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  // Muesca derecha
  ctx.beginPath();
  ctx.arc(w, divY, 12, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
  ctx.stroke();

  // Línea de trazos
  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  ctx.moveTo(20, divY);
  ctx.lineTo(w - 20, divY);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]); // Restaurar trazo continuo

  // 5. Filas de Datos del Pago
  const repName = family ? family.repName : 'Representante';
  const childrenNames = children && children.length > 0 
    ? children.map(c => `${c.firstName} ${c.lastName}`).join(', ') 
    : 'Estudiante';

  // Colegio del estudiante o de los hermanos separados por coma (o 'No especificado')
  const schoolName = getFamilySchools(children);

  const methodMap = {
    pago_movil: 'Pago Móvil',
    efectivo: 'Efectivo',
    transferencia: 'Transferencia Bancaria',
    exonerado: 'Exoneración (Vacaciones)'
  };
  const methodLabel = methodMap[payment.method] || payment.method;

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = monthNames[(payment.month || 1) - 1];

  let timeFormatted = '';
  if (payment.createdAt) {
    try {
      const dt = new Date(payment.createdAt);
      timeFormatted = dt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {}
  }
  if (!timeFormatted) {
    timeFormatted = 'Conciliado';
  }
  const dateDisplay = `${payment.date} • ${timeFormatted}`;

  const rows = [
    { label: isExon ? 'Fecha Registro' : 'Fecha y Hora', value: dateDisplay },
    { label: 'Representante', value: repName, highlight: true },
    { label: 'Estudiante(s)', value: childrenNames },
    { label: 'Colegio', value: schoolName },
    { label: 'Período', value: `Semana ${payment.week} - ${monthName} ${payment.year}` },
    ...(isExon ? [
      { label: 'Condición', value: 'EXONERADO ($0.00)', highlight: true },
      { label: 'Motivo', value: reasonText },
      ...(payment.fechaInicio || payment.startDate ? [
        { label: 'Rango de Fechas', value: `${payment.fechaInicio || payment.startDate} al ${payment.fechaFin || payment.endDate || 'Fin de mes'}` }
      ] : [])
    ] : [
      { label: 'Método de Pago', value: methodLabel },
      { label: 'Nro. Referencia', value: payment.reference ? `#${payment.reference}` : 'Sin referencia', highlight: Boolean(payment.reference) }
    ]),
    { label: 'Unidad de Ruta', value: `${settings.vehicleUnit || 'Móvil #04'} (${settings.vehiclePlate || 'MiRuta'})` }
  ];

  let currentY = 326;
  const rowHeight = rows.length > 8 ? 32 : 36;

  rows.forEach((r, idx) => {
    // Fondo alternado
    if (idx % 2 === 0) {
      ctx.fillStyle = '#F8FAFC';
      drawRoundRect(ctx, 20, currentY - 22, w - 40, rowHeight - 5, 7, true, false);
    }

    // Etiqueta (izquierda)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = '600 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(r.label, 32, currentY);

    // Valor (derecha, truncado inteligente)
    ctx.textAlign = 'right';
    ctx.fillStyle = r.highlight ? (isExon ? '#0284C7' : '#0F172A') : '#1E293B';
    ctx.font = r.highlight
      ? 'bold 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      : '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    let displayVal = String(r.value);
    const maxValWidth = 330;
    if (ctx.measureText(displayVal).width > maxValWidth) {
      while (ctx.measureText(displayVal + '...').width > maxValWidth && displayVal.length > 0) {
        displayVal = displayVal.slice(0, -1);
      }
      displayVal += '...';
    }
    ctx.fillText(displayVal, w - 32, currentY);

    currentY += rowHeight;
  });

  // 6. Recuadro de Validación de Seguridad
  const secBoxY = 624;
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, 24, secBoxY, w - 48, 60, 10, true, true);

  ctx.textAlign = 'center';
  ctx.fillStyle = isExon ? '#0284C7' : '#059669';
  ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(isExon ? '🏖️ Período registrado como exonerado de cobro en MiRuta' : '🔒 Operación validada y conciliada exitosamente', 300, secBoxY + 24);

  const secHash = isExon 
    ? `MR-EXO-${String(payment.id).padStart(4, '0')}-${payment.date.replace(/-/g, '')}-W${payment.week}`
    : `MR-${String(payment.id).padStart(4, '0')}-${payment.date.replace(/-/g, '')}-${(payment.reference || '0000').slice(-4)}`;
  ctx.fillStyle = '#94A3B8';
  ctx.font = '10.5px monospace';
  ctx.fillText(`CÓDIGO DE VALIDACIÓN: ${secHash}`, 300, secBoxY + 44);

  // 7. Pie de Marca y Slogan
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(24, 706);
  ctx.lineTo(w - 24, 706);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('🚐 MiRuta • Tu transporte escolar, organizado y al día', 300, 735);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Comprobante administrativo emitido localmente desde la app MiRuta', 300, 755);

  return canvas;
}

// MODAL: Recibo de Pago Digital (Visualización de Imagen PNG)
window.showReceiptModal = async function(paymentId, isNewlyCreated = false) {
  const modal = document.getElementById('receiptModal');
  if (!modal) return;

  const payment = await MiRutaDB.db.payments.get(Number(paymentId));
  if (!payment) return;

  const isExon = payment.status === 'exonerado' || payment.method === 'exonerado';
  const family = await MiRutaDB.db.families.get(payment.familyId);
  const children = await MiRutaDB.getChildrenByFamily(payment.familyId);
  const settings = state.settings || await MiRutaDB.getSettings();

  const repName = family ? family.repName : 'Representante';
  const repPhone = family ? family.phone.replace(/[^0-9]/g, '') : '';
  const childrenNames = children.map(c => `${c.firstName} ${c.lastName}`).join(', ');

  // Colegio del estudiante o de los hermanos separados por coma (o 'No especificado')
  const schoolName = getFamilySchools(children);

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = monthNames[payment.month - 1];

  const methodLabels = {
    pago_movil: 'Pago Móvil',
    efectivo: 'Efectivo',
    transferencia: 'Transferencia Bancaria',
    exonerado: 'Exoneración'
  };
  const methodLabel = methodLabels[payment.method] || payment.method;
  const reasonText = payment.reason || payment.motivo || 'Vacaciones escolares';

  // Texto del recibo para respaldo y portapapeles con firma oficial de marca
  const receiptText = isExon ?
    `🏖️ *CONSTANCIA DE EXONERACIÓN - ${settings.vehicleUnit || 'MiRuta'}* 🚍\n` +
    `────────────────────\n` +
    `📅 *Fecha:* ${payment.date}\n` +
    `👤 *Representante:* ${repName}\n` +
    `👧 *Alumno(s):* ${childrenNames}\n` +
    `🏫 *Colegio:* ${schoolName}\n` +
    `🗓 *Período:* Semana ${payment.week} de ${monthName} ${payment.year}\n` +
    `💵 *Tarifa:* $0.00 (EXONERADO)\n` +
    `🏖️ *Motivo:* ${reasonText}\n` +
    `✅ *Estado:* AL DÍA (SIN DEUDA PENDIENTE)\n` +
    `────────────────────\n` +
    `🚐 *MiRuta* • Transporte Escolar`
    :
    `🧾 *COMPROBANTE DE PAGO - ${settings.vehicleUnit || 'MiRuta'}* 🚍\n` +
    `────────────────────\n` +
    `📅 *Fecha:* ${payment.date}\n` +
    `👤 *Representante:* ${repName}\n` +
    `👧 *Alumno(s):* ${childrenNames}\n` +
    `🏫 *Colegio:* ${schoolName}\n` +
    `🗓 *Cuota:* Semana ${payment.week} de ${monthName} ${payment.year}\n` +
    `💵 *Monto Pagado:* $${parseFloat(payment.amount).toFixed(2)}\n` +
    `💳 *Método:* ${methodLabel}${payment.reference ? ` (Ref: #${payment.reference})` : ''}\n` +
    `✅ *Estado:* PAGADO Y CONCILIADO\n` +
    `────────────────────\n` +
    `🚐 *MiRuta* • Transporte Escolar`;

  // Almacenar en variables de estado del módulo
  currentReceiptPayment = payment;
  currentReceiptRepName = repName;
  currentReceiptRepPhone = repPhone;
  currentReceiptText = receiptText;

  // Actualizar títulos e ícono en la cabecera del modal
  const titleEl = document.getElementById('receiptModalTitle');
  const iconEl = document.getElementById('receiptModalIcon');
  const iconContainer = document.getElementById('receiptIconContainer');
  const badge = document.getElementById('receiptIdBadge');

  if (titleEl) titleEl.textContent = isExon ? 'Comprobante de Exoneración' : 'Comprobante de Pago';
  if (iconEl) iconEl.textContent = isExon ? 'beach_access' : 'verified';
  if (iconContainer) {
    if (isExon) {
      iconContainer.className = 'w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold';
    } else {
      iconContainer.className = 'w-8 h-8 rounded-lg bg-secondary-container/50 text-secondary flex items-center justify-center font-bold';
    }
  }
  if (badge) {
    badge.textContent = isExon ? `#EXO-${String(payment.id).padStart(4, '0')}` : `#REC-${String(payment.id).padStart(4, '0')}`;
  }

  const previewImg = document.getElementById('receiptCanvasImg');
  const spinner = document.getElementById('receiptLoadingSpinner');

  // Abrir modal inmediatamente
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');

  // Conectar botón de copiar texto
  const copyBtn = document.getElementById('receiptCopyBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      window.copyToClipboard(currentReceiptText, isExon ? '¡Constancia de exoneración copiada!' : '¡Texto del recibo copiado al portapapeles!');
    };
  }

  // Conectar botón de anular pago / exoneración
  const delBtn = document.getElementById('receiptDeleteBtn');
  if (delBtn) {
    delBtn.innerHTML = `
      <span class="material-symbols-outlined text-[16px]">delete</span>
      <span>${isExon ? 'Anular esta exoneración' : 'Anular este pago'}</span>
    `;
    delBtn.onclick = async () => {
      const confirmMsg = isExon
        ? `¿Deseas anular esta exoneración de la Semana ${payment.week}? La semana volverá a quedar pendiente de cobro.`
        : `¿Deseas anular y eliminar este pago de $${payment.amount}?`;
      if (confirm(confirmMsg)) {
        await MiRutaDB.deletePayment(payment.id);
        closeReceiptModal();
        await refreshData();
        await renderApp();
        showToast(isExon ? 'Exoneración anulada correctamente' : 'Pago eliminado correctamente', 'delete');
      }
    };
  }

  // Cargar logo-miruta.png antes de generar el canvas (con fallback seguro al dibujo vectorial si tarda)
  let logoImg = null;
  try {
    logoImg = await loadLogoMiruta(600);
  } catch (e) {
    logoImg = null;
  }

  // Generación del Comprobante en Canvas con fallback asegurado
  try {
    let canvas = generateReceiptCanvas(payment, family, children, settings, logoImg);
    let dataUrl;
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch (taintErr) {
      console.warn('Canvas protegido por origen local, reintentando con fallback vectorial:', taintErr);
      canvas = generateReceiptCanvas(payment, family, children, settings, null);
      dataUrl = canvas.toDataURL('image/png');
    }

    currentReceiptCanvas = canvas;

    canvas.toBlob((blob) => {
      currentReceiptBlob = blob;
    }, 'image/png');

    if (previewImg) {
      previewImg.src = dataUrl;
      previewImg.classList.remove('hidden');
    }
    if (spinner) {
      spinner.classList.add('hidden');
    }
  } catch (err) {
    console.error('Error generando comprobante en Canvas:', err);
    if (spinner) {
      spinner.innerHTML = '<span class="text-error font-medium">Error al generar imagen</span>';
    }
  }
};

// Compartir imagen del recibo usando Web Share API con fallback directo a WhatsApp y descarga
window.shareReceiptImage = async function() {
  if (!currentReceiptCanvas || !currentReceiptPayment) {
    showToast('El comprobante no está listo aún', 'error');
    return;
  }

  // Asegurar que el Blob esté listo
  let blob = currentReceiptBlob;
  if (!blob) {
    blob = await new Promise(resolve => currentReceiptCanvas.toBlob(resolve, 'image/png'));
    currentReceiptBlob = blob;
  }

  const isExon = currentReceiptPayment.status === 'exonerado' || currentReceiptPayment.method === 'exonerado';
  const prefix = isExon ? 'exoneracion' : 'pago';
  const filename = `comprobante_miruta_${prefix}_${currentReceiptPayment.id}_sem${currentReceiptPayment.week}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  // 1. Web Share API nativa con soporte de archivos (envío como imagen a WhatsApp en móviles)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: isExon ? `Constancia de Exoneración #${currentReceiptPayment.id} - MiRuta` : `Comprobante de Pago #${currentReceiptPayment.id} - MiRuta`,
        text: isExon 
          ? `Constancia de tarifa exonerada de transporte escolar MiRuta para ${currentReceiptRepName}.`
          : `Comprobante de pago de transporte escolar MiRuta para ${currentReceiptRepName}.`
      });
      showToast('¡Comprobante compartido!', 'check_circle');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // Acción cancelada voluntariamente
      console.warn('navigator.share falló:', err);
    }
  }

  // 2. Fallback de escritorio: Descargar la imagen PNG y abrir WhatsApp con el texto
  window.downloadReceiptPng();
  if (currentReceiptRepPhone) {
    showToast('Descargando imagen. Abriendo WhatsApp...', 'download');
    setTimeout(() => {
      const waUrl = `https://wa.me/${currentReceiptRepPhone}?text=${encodeURIComponent(currentReceiptText)}`;
      window.open(waUrl, '_blank');
    }, 600);
  } else {
    showToast('Comprobante guardado en el dispositivo', 'download');
  }
};

// Descargar imagen PNG del comprobante
window.downloadReceiptPng = function() {
  if (!currentReceiptCanvas || !currentReceiptPayment) {
    showToast('El comprobante no está listo aún', 'error');
    return;
  }
  const isExon = currentReceiptPayment.status === 'exonerado' || currentReceiptPayment.method === 'exonerado';
  const prefix = isExon ? 'exoneracion' : 'pago';
  const filename = `comprobante_miruta_${prefix}_${currentReceiptPayment.id}_sem${currentReceiptPayment.week}.png`;
  const link = document.createElement('a');
  link.download = filename;
  link.href = currentReceiptCanvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('¡Comprobante PNG descargado!', 'check_circle');
};

window.closeReceiptModal = function() {
  const modal = document.getElementById('receiptModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
};

// MODAL: Nueva / Editar Familia
let currentEditingFamilyId = null;

window.openFamilyModal = async function(familyId = null) {
  currentEditingFamilyId = familyId ? Number(familyId) : null;
  const modal = document.getElementById('familyModal');
  if (!modal) return;

  const titleEl = document.getElementById('familyModalTitle');
  const repNameInput = document.getElementById('familyRepNameInput');
  const phoneInput = document.getElementById('familyPhoneInput');
  const addressInput = document.getElementById('familyAddressInput');
  const weeklyRateInput = document.getElementById('familyWeeklyRateInput');
  const notesInput = document.getElementById('familyNotesInput');
  const childrenContainer = document.getElementById('familyChildrenContainer');

  childrenContainer.innerHTML = '';

  if (familyId) {
    titleEl.textContent = 'Editar Familia';
    const fam = await MiRutaDB.getFamily(familyId);
    const children = await MiRutaDB.getChildrenByFamily(familyId);

    repNameInput.value = fam.repName || '';
    phoneInput.value = fam.phone || '';
    addressInput.value = fam.address || '';
    weeklyRateInput.value = fam.weeklyRate || '';
    notesInput.value = fam.notes || '';

    if (children.length > 0) {
      children.forEach(c => addChildRow(c));
    } else {
      addChildRow();
    }
  } else {
    titleEl.textContent = 'Nueva Familia';
    repNameInput.value = '';
    phoneInput.value = '';
    addressInput.value = '';
    weeklyRateInput.value = '35.00';
    notesInput.value = '';
    addChildRow();
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
};

window.closeFamilyModal = function() {
  const modal = document.getElementById('familyModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
};

window.addChildRow = function(existingChild = null) {
  const container = document.getElementById('familyChildrenContainer');
  if (!container) return;

  const index = container.children.length;
  const schools = state.cachedData.schools || [];

  const div = document.createElement('div');
  div.className = 'child-row bg-surface-container-low p-3.5 rounded-2xl flex flex-col gap-2.5 border border-surface-container relative';
  div.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="font-label-md text-label-md text-primary font-extrabold flex items-center gap-1">
        <span class="material-symbols-outlined text-[16px]">child_care</span>
        <span>Niño/a #${index + 1}</span>
      </span>
      ${index > 0 ? `
        <button type="button" onclick="this.closest('.child-row').remove(); reindexChildRows();" class="text-error hover:bg-error-container/40 p-1 rounded-lg text-xs font-bold flex items-center gap-0.5">
          <span class="material-symbols-outlined text-[16px]">remove_circle</span>
          <span>Quitar</span>
        </button>
      ` : ''}
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="font-label-sm text-label-sm text-on-surface-variant font-bold">Nombre *</label>
        <input type="text" class="child-first-name w-full h-10 px-3 rounded-xl bg-surface-container-lowest font-body-md text-on-surface border border-surface-container focus:outline-none focus:border-primary" placeholder="Ej: Mateo" value="${existingChild ? escapeHtml(existingChild.firstName) : ''}" required />
      </div>
      <div>
        <label class="font-label-sm text-label-sm text-on-surface-variant font-bold">Apellido</label>
        <input type="text" class="child-last-name w-full h-10 px-3 rounded-xl bg-surface-container-lowest font-body-md text-on-surface border border-surface-container focus:outline-none focus:border-primary" placeholder="Ej: González" value="${existingChild ? escapeHtml(existingChild.lastName) : ''}" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="font-label-sm text-label-sm text-on-surface-variant font-bold">Fecha de Nacimiento</label>
        <input type="date" class="child-birthdate w-full h-10 px-3 rounded-xl bg-surface-container-lowest font-body-md text-on-surface border border-surface-container focus:outline-none focus:border-primary" value="${existingChild ? existingChild.birthDate : ''}" />
      </div>
      <div>
        <label class="font-label-sm text-label-sm text-on-surface-variant font-bold">Colegio</label>
        <select class="child-school w-full h-10 px-3 rounded-xl bg-surface-container-lowest font-body-md text-on-surface border border-surface-container focus:outline-none focus:border-primary">
          <option value="">Seleccionar...</option>
          ${schools.map(s => `
            <option value="${escapeHtml(s)}" ${existingChild && existingChild.school === s ? 'selected' : ''}>${escapeHtml(s)}</option>
          `).join('')}
        </select>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="font-label-sm text-label-sm text-on-surface-variant font-bold">Turno</label>
        <select class="child-turn w-full h-10 px-3 rounded-xl bg-surface-container-lowest font-body-md text-on-surface border border-surface-container focus:outline-none focus:border-primary">
          <option value="Mañana" ${existingChild && existingChild.turn === 'Mañana' ? 'selected' : ''}>Mañana ☀️</option>
          <option value="Tarde" ${existingChild && existingChild.turn === 'Tarde' ? 'selected' : ''}>Tarde 🌅</option>
        </select>
      </div>
      <div>
        <label class="font-label-sm text-label-sm text-on-surface-variant font-bold">Modalidad</label>
        <select class="child-modality w-full h-10 px-3 rounded-xl bg-surface-container-lowest font-body-md text-on-surface border border-surface-container focus:outline-none focus:border-primary">
          <option value="Completo" ${!existingChild || existingChild.modality === 'Completo' ? 'selected' : ''}>Completo</option>
          <option value="Solo ida" ${existingChild && existingChild.modality === 'Solo ida' ? 'selected' : ''}>Solo ida</option>
          <option value="Solo vuelta" ${existingChild && existingChild.modality === 'Solo vuelta' ? 'selected' : ''}>Solo vuelta</option>
        </select>
      </div>
    </div>
  `;

  container.appendChild(div);
};

window.reindexChildRows = function() {
  const container = document.getElementById('familyChildrenContainer');
  if (!container) return;
  const rows = container.querySelectorAll('.child-row');
  rows.forEach((row, i) => {
    const title = row.querySelector('.font-label-md span:last-child');
    if (title) title.textContent = `Niño/a #${i + 1}`;
  });
};

window.confirmSaveFamily = async function() {
  const repName = document.getElementById('familyRepNameInput').value.trim();
  const phone = document.getElementById('familyPhoneInput').value.trim();
  const address = document.getElementById('familyAddressInput').value.trim();
  const weeklyRate = parseFloat(document.getElementById('familyWeeklyRateInput').value) || 0;
  const notes = document.getElementById('familyNotesInput').value.trim();

  if (!repName) {
    showToast('El nombre del representante es obligatorio', 'error');
    return;
  }
  if (!phone) {
    showToast('El teléfono/WhatsApp es obligatorio', 'error');
    return;
  }

  // Extract children
  const rows = document.querySelectorAll('#familyChildrenContainer .child-row');
  const childrenList = [];
  rows.forEach(row => {
    const firstName = row.querySelector('.child-first-name').value.trim();
    if (!firstName) return;
    childrenList.push({
      firstName,
      lastName: row.querySelector('.child-last-name').value.trim(),
      birthDate: row.querySelector('.child-birthdate').value,
      school: row.querySelector('.child-school').value,
      turn: row.querySelector('.child-turn').value,
      modality: row.querySelector('.child-modality').value
    });
  });

  if (childrenList.length === 0) {
    showToast('Debes registrar al menos un niño para esta familia', 'error');
    return;
  }

  try {
    await MiRutaDB.saveFamily(
      {
        id: currentEditingFamilyId,
        repName,
        phone,
        address,
        weeklyRate,
        notes
      },
      childrenList
    );

    closeFamilyModal();
    await refreshData();
    await renderApp();

    showToast(`Familia "${repName}" guardada exitosamente`, 'check_circle');
  } catch (err) {
    console.error('Error saving family:', err);
    showToast('Error al guardar la familia', 'error');
  }
};

window.confirmDeleteFamily = async function(familyId, familyName) {
  if (confirm(`¿Estás seguro de eliminar a la familia "${familyName}" y a todos sus alumnos asociados? Esta acción no se puede deshacer.`)) {
    try {
      await MiRutaDB.deleteFamily(familyId);
      await refreshData();
      await renderApp();
      showToast(`Familia "${familyName}" eliminada`, 'delete');
    } catch (err) {
      console.error(err);
      showToast('Error al eliminar familia', 'error');
    }
  }
};

// MODAL: Notificaciones Activas (Campanita)
window.openNotificationsModal = function() {
  const modal = document.getElementById('notificationsModal');
  if (!modal) return;

  const bdays = state.cachedData.upcomingBirthdays;
  const families = state.cachedData.families;
  const totalWeeks = getWeeksInMonth(state.selectedYear, state.selectedMonth);
  const payments = state.cachedData.payments;

  // Pending payments
  const pendingFamilies = [];
  families.forEach(fam => {
    const paidWeeks = payments.filter(p => p.familyId === fam.id).length;
    if (paidWeeks < totalWeeks) {
      const debtWeeks = totalWeeks - paidWeeks;
      pendingFamilies.push({
        fam,
        debtWeeks,
        debtAmount: debtWeeks * fam.weeklyRate
      });
    }
  });

  const bdayListEl = document.getElementById('notifBdayList');
  const debtListEl = document.getElementById('notifDebtList');

  // Render Birthdays
  if (bdays.length === 0) {
    bdayListEl.innerHTML = `<p class="text-body-sm text-on-surface-variant italic">No hay cumpleaños próximos en los siguientes ${state.settings.birthdayNoticeDays || 5} días.</p>`;
  } else {
    bdayListEl.innerHTML = bdays.map(b => {
      const repPhone = b.family ? b.family.phone.replace(/[^0-9]/g, '') : '';
      const repName = b.family ? b.family.repName : 'Representante';
      const waMsg = encodeURIComponent(
        `¡Hola ${repName}! 🚍 Desde el transporte escolar te saludamos con mucho cariño. Queremos desearle a ${b.child.firstName} un ¡Muy Feliz Cumpleaños! 🎂🎈🎉 Que Dios lo bendiga y pase un día increíble.`
      );
      const waUrl = repPhone ? `https://wa.me/${repPhone}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;
      return `
        <div class="p-3 rounded-xl bg-primary-container/20 border border-primary-container/40 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-label-sm text-label-sm uppercase font-extrabold text-on-primary-fixed-variant bg-primary-container/50 px-2 py-0.5 rounded-full">
                ${b.labelDays}
              </span>
              <span class="font-label-sm text-label-sm font-bold text-on-surface">${b.birthDateFormatted}</span>
            </div>
            <h4 class="font-headline-sm text-headline-sm text-on-surface font-extrabold truncate mt-0.5">
              ${b.child.firstName} ${b.child.lastName} (${b.ageTurning} años)
            </h4>
            <p class="font-body-sm text-body-sm text-on-surface-variant truncate">Rep: ${repName}</p>
          </div>
          <a href="${waUrl}" target="_blank" class="shrink-0 h-9 px-3 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-bold flex items-center gap-1 shadow-sm active:scale-95" title="Felicitar por WhatsApp">
            <span class="material-symbols-outlined text-[16px]">chat</span>
            <span>Felicitar</span>
          </a>
        </div>
      `;
    }).join('');
  }

  // Render Debts
  if (pendingFamilies.length === 0) {
    debtListEl.innerHTML = `<p class="text-body-sm text-secondary font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">check_circle</span>¡Todas las familias están al día con sus cuotas!</p>`;
  } else {
    debtListEl.innerHTML = pendingFamilies.map(item => {
      const cleanPhone = item.fam.phone.replace(/[^0-9]/g, '');
      return `
        <div class="p-3 rounded-xl bg-error-container/30 border border-error-container/60 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <h4 class="font-label-lg text-label-lg text-on-surface font-bold truncate">
              ${escapeHtml(item.fam.repName)}
            </h4>
            <p class="font-body-sm text-body-sm text-error font-extrabold">
              Debe: $${item.debtAmount.toFixed(0)} (${item.debtWeeks} semana(s) pendiente(s))
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="closeNotificationsModal(); openPaymentModal(${item.fam.id})" class="h-8 px-2.5 rounded-lg bg-secondary text-on-secondary font-label-sm text-label-sm font-bold flex items-center gap-1">
              <span>Cobrar</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
};

window.closeNotificationsModal = function() {
  const modal = document.getElementById('notificationsModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
};

// -------------------------------------------------------------
// 6. BACKUP & RESTORE (.json)
// -------------------------------------------------------------
window.handleExportBackup = async function() {
  try {
    const backupData = await MiRutaDB.exportBackup();
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const filename = `miruta_respaldo_${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Respaldo descargado: ${filename}`, 'download');
  } catch (err) {
    console.error('Error exporting backup:', err);
    showToast('Error al exportar respaldo', 'error');
  }
};

window.handleImportBackup = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const backupJson = JSON.parse(e.target.result);
      if (confirm('¿Deseas restaurar este respaldo? Los datos actuales serán reemplazados por los datos del archivo.')) {
        await MiRutaDB.importBackup(backupJson);
        await refreshData();
        await renderApp();
        showToast('¡Copia de seguridad restaurada con éxito!', 'cloud_done');
      }
    } catch (err) {
      console.error('Error restoring backup:', err);
      showToast('Archivo de respaldo inválido o dañado', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset input
};

window.handleResetDemoData = async function() {
  if (confirm('¿Cargar datos de demostración? Se reestablecerán las familias y pagos de ejemplo para pruebas.')) {
    try {
      await MiRutaDB.resetData();
      await refreshData();
      await renderApp();
      showToast('Datos de demostración cargados', 'dataset');
    } catch (err) {
      console.error(err);
      showToast('Error al recargar datos', 'error');
    }
  }
};

// -------------------------------------------------------------
// EVENT LISTENERS & HELPERS
// -------------------------------------------------------------
function setupEventListeners() {
  // Turn Tabs on Dashboard
  document.getElementById('tabTurnManana')?.addEventListener('click', () => {
    state.selectedTurn = 'Mañana';
    updateTurnTabs();
    renderChildrenCards();
  });
  document.getElementById('tabTurnTarde')?.addEventListener('click', () => {
    state.selectedTurn = 'Tarde';
    updateTurnTabs();
    renderChildrenCards();
  });

  // Inicio Search
  const inicioSearchInput = document.getElementById('inicioSearchInput');
  const inicioSearchClearBtn = document.getElementById('inicioSearchClearBtn');
  if (inicioSearchInput) {
    inicioSearchInput.addEventListener('input', (e) => {
      state.inicioSearch = e.target.value;
      if (inicioSearchClearBtn) {
        inicioSearchClearBtn.classList.toggle('hidden', !e.target.value);
      }
      renderChildrenCards();
    });
  }

  // Family Search & Filter
  const famSearchInput = document.getElementById('familySearchInput');
  const famSearchClearBtn = document.getElementById('familySearchClearBtn');
  if (famSearchInput) {
    famSearchInput.addEventListener('input', (e) => {
      state.familySearch = e.target.value;
      if (famSearchClearBtn) {
        famSearchClearBtn.classList.toggle('hidden', !e.target.value);
      }
      renderFamilias();
    });
  }

  const famFilterPills = document.querySelectorAll('.family-filter-pill');
  famFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      famFilterPills.forEach(p => {
        p.className = 'family-filter-pill px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant font-label-md text-label-md font-semibold transition-colors';
      });
      pill.className = 'family-filter-pill px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md font-bold transition-colors';
      state.familyFilter = pill.getAttribute('data-filter') || 'all';
      renderFamilias();
    });
  });

  // Payment Month Navigation
  document.getElementById('prevMonthBtn')?.addEventListener('click', async () => {
    state.selectedMonth--;
    if (state.selectedMonth < 1) {
      state.selectedMonth = 12;
      state.selectedYear--;
    }
    await refreshData();
    renderPagos();
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', async () => {
    state.selectedMonth++;
    if (state.selectedMonth > 12) {
      state.selectedMonth = 1;
      state.selectedYear++;
    }
    await refreshData();
    renderPagos();
  });

  // Payment Search & Filter
  const paySearchInput = document.getElementById('paymentSearchInput');
  const paySearchClearBtn = document.getElementById('paymentSearchClearBtn');
  if (paySearchInput) {
    paySearchInput.addEventListener('input', (e) => {
      state.paymentSearch = e.target.value;
      if (paySearchClearBtn) {
        paySearchClearBtn.classList.toggle('hidden', !e.target.value);
      }
      renderPagos();
    });
  }

  const payFilterPills = document.querySelectorAll('.payment-filter-pill');
  payFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      payFilterPills.forEach(p => {
        p.className = 'payment-filter-pill px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant font-label-md text-label-md font-semibold transition-colors';
      });
      pill.className = 'payment-filter-pill px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md font-bold transition-colors';
      state.paymentFilter = pill.getAttribute('data-filter') || 'all';
      renderPagos();
    });
  });

  // Birthday Notice Days Slider in Settings
  const bdaySlider = document.getElementById('settingsBirthdayDays');
  const bdayVal = document.getElementById('settingsBirthdayDaysVal');
  if (bdaySlider && bdayVal) {
    bdaySlider.addEventListener('input', (e) => {
      bdayVal.textContent = `${e.target.value} días`;
    });
  }

  // Family Select change in payment modal
  const famSelect = document.getElementById('modalFamilySelect');
  if (famSelect) {
    famSelect.addEventListener('change', (e) => {
      const famId = Number(e.target.value);
      const fam = state.cachedData.families.find(f => f.id === famId);
      if (fam) {
        document.getElementById('modalAmountInput').value = parseFloat(fam.weeklyRate).toFixed(2);
      }
    });
  }
}

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
function getWeeksInMonth(year, month) {
  // Calculates whether month has 4 or 5 school weeks based on calendar Mondays
  const daysInMonth = new Date(year, month, 0).getDate();
  let mondays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 1) mondays++;
  }
  return mondays >= 5 ? 5 : 4;
}

function getInitials(first = '', last = '') {
  const f = first.trim() ? first.trim()[0].toUpperCase() : '';
  const l = last.trim() ? last.trim()[0].toUpperCase() : '';
  return `${f}${l}` || 'AL';
}

function getAvatarColor(name = '') {
  const colors = [
    'bg-primary-container/25 text-primary',
    'bg-secondary-container/25 text-secondary',
    'bg-tertiary-container/25 text-tertiary',
    'bg-primary-fixed text-on-primary-fixed',
    'bg-secondary-fixed text-on-secondary-fixed'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function formatBirthDateAge(birthDateStr) {
  if (!birthDateStr) return 'Fecha no reg.';
  const [y, m, d] = birthDateStr.split('-').map(Number);
  if (!y || !m || !d) return 'Fecha no reg.';
  
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthName = months[m - 1] || '';

  const now = new Date();
  let age = now.getFullYear() - y;
  const hasHadBirthday = (now.getMonth() + 1 > m) || (now.getMonth() + 1 === m && now.getDate() >= d);
  if (!hasHadBirthday) age--;

  return `🎂 ${d} ${monthName} (${age} años)`;
}

function showToast(message, icon = 'check_circle') {
  const toast = document.getElementById('actionToast');
  const msgEl = document.getElementById('toastMsg');
  const iconEl = document.getElementById('toastIcon');
  if (!toast) return;

  if (msgEl) msgEl.textContent = message;
  if (iconEl) iconEl.textContent = icon;

  toast.classList.remove('opacity-0', '-translate-y-2', 'pointer-events-none');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2', 'pointer-events-none');
    toast.classList.remove('opacity-100', 'translate-y-0');
  }, 2600);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeSearchText(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// -------------------------------------------------------------
// GUÍA RÁPIDA DE USO MODAL
// -------------------------------------------------------------
window.openUserGuideModal = function() {
  const modal = document.getElementById('userGuideModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
};

window.closeUserGuideModal = function() {
  const modal = document.getElementById('userGuideModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
};

window.printUserGuide = function() {
  window.print();
};

