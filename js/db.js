/**
 * MiRuta - IndexedDB Database Module using Dexie.js
 * 100% Local and Offline-First
 */

// Initialize Dexie
const db = new Dexie('MiRutaDB');

// Define Schema
db.version(1).stores({
  settings: 'id',
  families: '++id, repName, phone, createdAt',
  children: '++id, familyId, firstName, lastName, birthDate, school, turn, modality',
  payments: '++id, familyId, year, month, week, date, method, [year+month], [familyId+year+month]',
  attendance: 'id, childId, date, status, [childId+date]' // id: `${childId}_${date}`
});

// Upgrade / Schema verification for compound index [childId+date]
db.version(2).stores({
  attendance: 'id, childId, date, status, [childId+date]'
});

// Version 3: Soporte para pagos exonerados y estado
db.version(3).stores({
  payments: '++id, familyId, year, month, week, date, method, status, [year+month], [familyId+year+month]'
});

// Version 4: Soporte para orden personalizado de ruta (ordenManana, ordenTarde)
db.version(4).stores({
  children: '++id, familyId, firstName, lastName, birthDate, school, turn, modality, ordenManana, ordenTarde'
});

// Default Settings
const DEFAULT_SETTINGS = {
  id: 'config',
  driverName: 'Carlos Mendoza',
  driverPhone: '+58 412 1234567',
  vehicleUnit: 'Móvil #04',
  vehicleModel: 'Toyota HiAce 2022',
  vehiclePlate: 'AB123CD',
  birthdayNoticeDays: 5,
  pagoMovilBank: '0102 - Banco de Venezuela',
  pagoMovilId: 'V-18.765.432',
  pagoMovilPhone: '0412-1234567',
  schools: [
    'Colegio San José',
    'Colegio Alemán',
    'Instituto Montessori',
    'Colegio La Salle'
  ]
};

// Seed sample data for realistic demo
async function seedSampleData(force = false) {
  const familyCount = await db.families.count();
  if (familyCount > 0 && !force) return;

  if (force) {
    await db.attendance.clear();
    await db.payments.clear();
    await db.children.clear();
    await db.families.clear();
  }

  // Ensure settings exist
  const existingSettings = await db.settings.get('config');
  if (!existingSettings || force) {
    await db.settings.put(DEFAULT_SETTINGS);
  }

  // Current year & month for default payments (e.g. Nov 2026)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Format sample birthdates around current date so birthday alerts show up nicely!
  // Current month & day
  const m = String(currentMonth).padStart(2, '0');
  const d = now.getDate();
  
  // Birthdays: 
  // Sofía: TODAY!
  const bdayToday = `2016-${m}-${String(d).padStart(2, '0')}`;
  // Valentina: Tomorrow! (+1 day)
  const tomorrow = new Date(now);
  tomorrow.setDate(d + 1);
  const bdayTomorrow = `2015-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  // Lucía: In 3 days!
  const in3Days = new Date(now);
  in3Days.setDate(d + 3);
  const bdayIn3Days = `2018-${String(in3Days.getMonth() + 1).padStart(2, '0')}-${String(in3Days.getDate()).padStart(2, '0')}`;

  // 1. Familia González (Hermanos con Tarifa Grupal)
  const fam1Id = await db.families.add({
    repName: 'María González',
    phone: '+58 414 1234567',
    address: 'Cll 127 #15–30 (Edif. Los Pinos)',
    weeklyRate: 35.00,
    notes: 'Tarifa grupal especial por 2 hermanos',
    createdAt: new Date().toISOString()
  });

  await db.children.bulkAdd([
    {
      familyId: fam1Id,
      firstName: 'Mateo',
      lastName: 'González',
      birthDate: '2016-05-14',
      school: 'Colegio La Salle',
      turn: 'Mañana',
      modality: 'Completo',
      ordenManana: 1
    },
    {
      familyId: fam1Id,
      firstName: 'Lucía',
      lastName: 'González',
      birthDate: bdayIn3Days,
      school: 'Colegio La Salle',
      turn: 'Mañana',
      modality: 'Completo',
      ordenManana: 2
    }
  ]);

  // Pagos Familia 1: Sem 1, Sem 2, Sem 3 pagadas, Sem 4 pendiente
  await db.payments.bulkAdd([
    {
      familyId: fam1Id,
      year: currentYear,
      month: currentMonth,
      week: 1,
      amount: 35.00,
      method: 'pago_movil',
      reference: '4821',
      date: `${currentYear}-${m}-04`,
      notes: 'Pago Móvil Banco Mercantil',
      createdAt: new Date().toISOString()
    },
    {
      familyId: fam1Id,
      year: currentYear,
      month: currentMonth,
      week: 2,
      amount: 35.00,
      method: 'pago_movil',
      reference: '6190',
      date: `${currentYear}-${m}-11`,
      notes: 'Pago Móvil BDV',
      createdAt: new Date().toISOString()
    },
    {
      familyId: fam1Id,
      year: currentYear,
      month: currentMonth,
      week: 3,
      amount: 35.00,
      method: 'pago_movil',
      reference: '8492',
      date: `${currentYear}-${m}-18`,
      notes: 'Pago Móvil BDV',
      createdAt: new Date().toISOString()
    }
  ]);

  // 2. Familia Ramírez
  const fam2Id = await db.families.add({
    repName: 'Roberto Ramírez',
    phone: '+58 412 9876543',
    address: 'Cra 9 #114–22',
    weeklyRate: 25.00,
    notes: 'Pagador puntual',
    createdAt: new Date().toISOString()
  });

  await db.children.add({
    familyId: fam2Id,
    firstName: 'Lucas',
    lastName: 'Ramírez',
    birthDate: '2017-08-10',
    school: 'Colegio Alemán',
    turn: 'Mañana',
    modality: 'Completo',
    ordenManana: 3
  });

  // Pagos Familia 2: Sem 1 a Sem 4 al día
  await db.payments.bulkAdd([
    { familyId: fam2Id, year: currentYear, month: currentMonth, week: 1, amount: 25.00, method: 'transferencia', reference: '9921', date: `${currentYear}-${m}-03`, notes: '', createdAt: new Date().toISOString() },
    { familyId: fam2Id, year: currentYear, month: currentMonth, week: 2, amount: 25.00, method: 'transferencia', reference: '0144', date: `${currentYear}-${m}-10`, notes: '', createdAt: new Date().toISOString() },
    { familyId: fam2Id, year: currentYear, month: currentMonth, week: 3, amount: 25.00, method: 'transferencia', reference: '3819', date: `${currentYear}-${m}-17`, notes: '', createdAt: new Date().toISOString() },
    { familyId: fam2Id, year: currentYear, month: currentMonth, week: 4, amount: 25.00, method: 'transferencia', reference: '7205', date: `${currentYear}-${m}-20`, notes: '', createdAt: new Date().toISOString() }
  ]);

  // 3. Familia Castro
  const fam3Id = await db.families.add({
    repName: 'Carolina Castro',
    phone: '+58 424 5551234',
    address: 'Cll 100 #19–45',
    weeklyRate: 20.00,
    notes: 'Turno tarde solo ida',
    createdAt: new Date().toISOString()
  });

  await db.children.add({
    familyId: fam3Id,
    firstName: 'Valentina',
    lastName: 'Castro',
    birthDate: bdayTomorrow,
    school: 'Instituto Montessori',
    turn: 'Tarde',
    modality: 'Solo ida',
    ordenTarde: 1
  });

  await db.payments.bulkAdd([
    { familyId: fam3Id, year: currentYear, month: currentMonth, week: 1, amount: 20.00, method: 'efectivo', reference: '', date: `${currentYear}-${m}-05`, notes: 'Efectivo $', createdAt: new Date().toISOString() },
    { familyId: fam3Id, year: currentYear, month: currentMonth, week: 2, amount: 20.00, method: 'efectivo', reference: '', date: `${currentYear}-${m}-12`, notes: 'Efectivo $', createdAt: new Date().toISOString() },
    { familyId: fam3Id, year: currentYear, month: currentMonth, week: 3, amount: 20.00, method: 'efectivo', reference: '', date: `${currentYear}-${m}-19`, notes: 'Efectivo $', createdAt: new Date().toISOString() }
  ]);

  // 4. Familia Pérez
  const fam4Id = await db.families.add({
    repName: 'Fernando Pérez',
    phone: '+58 416 3334455',
    address: 'Av Cra 15 #85–12',
    weeklyRate: 20.00,
    notes: 'Turno mañana solo vuelta',
    createdAt: new Date().toISOString()
  });

  await db.children.add({
    familyId: fam4Id,
    firstName: 'Sofía',
    lastName: 'Pérez',
    birthDate: bdayToday,
    school: 'Colegio San José',
    turn: 'Mañana',
    modality: 'Solo vuelta',
    ordenManana: 4
  });

  await db.payments.bulkAdd([
    { familyId: fam4Id, year: currentYear, month: currentMonth, week: 1, amount: 20.00, method: 'pago_movil', reference: '1182', date: `${currentYear}-${m}-02`, notes: '', createdAt: new Date().toISOString() },
    { familyId: fam4Id, year: currentYear, month: currentMonth, week: 2, amount: 20.00, method: 'pago_movil', reference: '9031', date: `${currentYear}-${m}-09`, notes: '', createdAt: new Date().toISOString() }
  ]);

  // 5. Familia Morales
  const fam5Id = await db.families.add({
    repName: 'Andrea Morales',
    phone: '+58 412 7778899',
    address: 'Transv 23 #97–10',
    weeklyRate: 25.00,
    notes: '',
    createdAt: new Date().toISOString()
  });

  await db.children.add({
    familyId: fam5Id,
    firstName: 'Diego',
    lastName: 'Morales',
    birthDate: '2017-03-12',
    school: 'Colegio San José',
    turn: 'Tarde',
    modality: 'Completo',
    ordenTarde: 2
  });

  await db.payments.bulkAdd([
    { familyId: fam5Id, year: currentYear, month: currentMonth, week: 1, amount: 25.00, method: 'pago_movil', reference: '3310', date: `${currentYear}-${m}-04`, notes: '', createdAt: new Date().toISOString() },
    { familyId: fam5Id, year: currentYear, month: currentMonth, week: 2, amount: 25.00, method: 'pago_movil', reference: '5519', date: `${currentYear}-${m}-11`, notes: '', createdAt: new Date().toISOString() },
    { familyId: fam5Id, year: currentYear, month: currentMonth, week: 3, amount: 25.00, method: 'pago_movil', reference: '7721', date: `${currentYear}-${m}-18`, notes: '', createdAt: new Date().toISOString() },
    { familyId: fam5Id, year: currentYear, month: currentMonth, week: 4, amount: 25.00, method: 'pago_movil', reference: '8890', date: `${currentYear}-${m}-20`, notes: '', createdAt: new Date().toISOString() }
  ]);
}

// Data Access API
window.MiRutaDB = {
  db,

  // Initialize DB and ensure default settings
  async init() {
    let settings = await db.settings.get('config');
    if (!settings) {
      await db.settings.put(DEFAULT_SETTINGS);
    }
    // Check if we should seed initial data
    const famCount = await db.families.count();
    if (famCount === 0) {
      await seedSampleData();
    }
  },

  // Settings
  async getSettings() {
    let settings = await db.settings.get('config');
    if (!settings) {
      settings = { ...DEFAULT_SETTINGS };
      await db.settings.put(settings);
    }
    return settings;
  },

  async updateSettings(newSettings) {
    const current = await this.getSettings();
    const updated = { ...current, ...newSettings, id: 'config' };
    await db.settings.put(updated);
    return updated;
  },

  // Schools Catalog
  async getSchools() {
    const settings = await this.getSettings();
    return settings.schools || [];
  },

  async addSchool(schoolName) {
    if (!schoolName || !schoolName.trim()) return;
    const settings = await this.getSettings();
    const list = settings.schools || [];
    if (!list.includes(schoolName.trim())) {
      list.push(schoolName.trim());
      await this.updateSettings({ schools: list });
    }
    return list;
  },

  async removeSchool(schoolName) {
    const settings = await this.getSettings();
    const list = (settings.schools || []).filter(s => s !== schoolName);
    await this.updateSettings({ schools: list });
    return list;
  },

  // Families
  async getFamilies() {
    return await db.families.toArray();
  },

  async getFamily(id) {
    return await db.families.get(Number(id));
  },

  async saveFamily(familyData, childrenList = []) {
    return await db.transaction('rw', db.families, db.children, async () => {
      let familyId = familyData.id ? Number(familyData.id) : null;
      const famPayload = {
        repName: familyData.repName.trim(),
        phone: familyData.phone.trim(),
        address: familyData.address ? familyData.address.trim() : '',
        weeklyRate: parseFloat(familyData.weeklyRate) || 0,
        notes: familyData.notes ? familyData.notes.trim() : '',
        createdAt: familyData.createdAt || new Date().toISOString()
      };

      if (familyId) {
        famPayload.id = familyId;
        await db.families.put(famPayload);
      } else {
        familyId = await db.families.add(famPayload);
      }

      // Synchronize children for this family
      // Delete existing children of this family if updating
      if (familyData.id) {
        await db.children.where('familyId').equals(familyId).delete();
      }

      // Bulk add updated/new children
      for (const child of childrenList) {
        if (!child.firstName || !child.firstName.trim()) continue;
        await db.children.add({
          familyId: familyId,
          firstName: child.firstName.trim(),
          lastName: child.lastName ? child.lastName.trim() : '',
          birthDate: child.birthDate || '',
          school: child.school || '',
          turn: child.turn || 'Mañana',
          modality: child.modality || 'Completo',
          ordenManana: child.ordenManana != null ? Number(child.ordenManana) : null,
          ordenTarde: child.ordenTarde != null ? Number(child.ordenTarde) : null
        });
      }

      return familyId;
    });
  },

  async deleteFamily(familyId) {
    familyId = Number(familyId);
    return await db.transaction('rw', db.families, db.children, db.payments, async () => {
      await db.payments.where('familyId').equals(familyId).delete();
      await db.children.where('familyId').equals(familyId).delete();
      await db.families.delete(familyId);
    });
  },

  // Children
  async getAllChildren() {
    return await db.children.toArray();
  },

  async getChildrenByFamily(familyId) {
    return await db.children.where('familyId').equals(Number(familyId)).toArray();
  },

  // Calculate upcoming birthdays
  async getUpcomingBirthdays(noticeDays = 5) {
    const children = await db.children.toArray();
    const families = await db.families.toArray();
    const familyMap = new Map(families.map(f => [f.id, f]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [];

    for (const child of children) {
      if (!child.birthDate) continue;

      const [bYear, bMonth, bDay] = child.birthDate.split('-').map(Number);
      if (!bMonth || !bDay) continue;

      // Construct birthday for this year
      let nextBirthday = new Date(today.getFullYear(), bMonth - 1, bDay);
      nextBirthday.setHours(0, 0, 0, 0);

      // If already passed this year, look at next year
      if (nextBirthday < today) {
        nextBirthday = new Date(today.getFullYear() + 1, bMonth - 1, bDay);
      }

      const diffTime = nextBirthday.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= noticeDays) {
        const family = familyMap.get(child.familyId);
        const ageTurning = nextBirthday.getFullYear() - bYear;

        let labelDays = '';
        if (diffDays === 0) labelDays = '¡Hoy! 🎉';
        else if (diffDays === 1) labelDays = 'Mañana';
        else labelDays = `En ${diffDays} días`;

        upcoming.push({
          child,
          family,
          diffDays,
          labelDays,
          ageTurning,
          birthDateFormatted: `${bDay} de ${getMonthName(bMonth)}`
        });
      }
    }

    // Sort by days remaining ascending
    upcoming.sort((a, b) => a.diffDays - b.diffDays);
    return upcoming;
  },

  // Attendance (Daily strictly filtered by current system date in YYYY-MM-DD format)
  async getTodayAttendance() {
    const todayStr = getTodayDateStr();
    // Strictly filter by current system date (YYYY-MM-DD)
    // Any new day automatically starts every child in 'espera' (unboarded)
    const records = await db.attendance.where('date').equals(todayStr).toArray();
    const map = {};
    for (const r of records) {
      map[r.childId] = r.status;
    }
    return map;
  },

  async toggleChildAttendance(childId) {
    const todayStr = getTodayDateStr();
    const numChildId = Number(childId);
    const id = `${numChildId}_${todayStr}`;
    
    // Lookup strictly by composite ID or [childId+date] index for today
    let existing = await db.attendance.get(id);
    if (!existing) {
      existing = await db.attendance.where('[childId+date]').equals([numChildId, todayStr]).first();
    }

    // Cycle: 'espera' -> 'abordado' -> 'no_asistio' -> 'espera'
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

    await db.attendance.put({
      id,
      childId: numChildId,
      date: todayStr,
      status: newStatus,
      timestamp: new Date().toISOString()
    });
    return newStatus;
  },

  async setChildAttendance(childId, dateStr, status) {
    const numChildId = Number(childId);
    const id = `${numChildId}_${dateStr}`;
    await db.attendance.put({
      id,
      childId: numChildId,
      date: dateStr,
      status: status,
      timestamp: new Date().toISOString()
    });
    return status;
  },

  async updateChildrenOrder(updates, turn) {
    const field = turn === 'Mañana' ? 'ordenManana' : 'ordenTarde';
    await db.transaction('rw', db.children, async () => {
      for (const item of updates) {
        await db.children.update(Number(item.id), {
          [field]: Number(item.order)
        });
      }
    });
  },

  async getAttendanceHistory(childId) {
    return await db.attendance.where('childId').equals(Number(childId)).sortBy('date');
  },

  // Payments
  async getPayments(year, month) {
    return await db.payments.where({ year, month }).toArray();
  },

  async getPaymentsByFamily(familyId, year, month) {
    return await db.payments.where({ familyId: Number(familyId), year, month }).toArray();
  },

  async registerPayment(paymentData) {
    const isExonerated = paymentData.status === 'exonerado' || paymentData.method === 'exonerado';
    const payload = {
      familyId: Number(paymentData.familyId || paymentData.familiaId),
      year: Number(paymentData.year),
      month: Number(paymentData.month),
      week: Number(paymentData.week),
      amount: isExonerated ? 0 : (parseFloat(paymentData.amount || paymentData.monto) || 0),
      monto: isExonerated ? 0 : (parseFloat(paymentData.amount || paymentData.monto) || 0),
      method: paymentData.method || (isExonerated ? 'exonerado' : 'pago_movil'),
      status: isExonerated ? 'exonerado' : (paymentData.status || 'pagado'),
      estado: isExonerated ? 'exonerado' : (paymentData.status || 'pagado'),
      reason: paymentData.reason || paymentData.motivo || '',
      motivo: paymentData.motivo || paymentData.reason || '',
      reference: paymentData.reference ? paymentData.reference.trim() : (isExonerated ? 'EXONERADO' : ''),
      date: paymentData.date || getTodayDateStr(),
      notes: paymentData.notes ? paymentData.notes.trim() : (paymentData.motivo || ''),
      fechaInicio: paymentData.fechaInicio || paymentData.startDate || '',
      fechaFin: paymentData.fechaFin || paymentData.endDate || '',
      semanas: paymentData.semanas || [Number(paymentData.week)],
      createdAt: new Date().toISOString()
    };

    // If a payment already exists for this same family, year, month, week, update it
    const existing = await db.payments
      .where({
        familyId: payload.familyId,
        year: payload.year,
        month: payload.month,
        week: payload.week
      })
      .first();

    if (existing) {
      payload.id = existing.id;
      await db.payments.put(payload);
      return payload.id;
    } else {
      return await db.payments.add(payload);
    }
  },

  // Exonerar semanas para una o múltiples familias (Vacaciones, asuetos, etc.)
  async exonerateWeeks({ familyIds, year, month, weeks, reason, startDate, endDate, overwritePaid = false }) {
    const y = Number(year);
    const m = Number(month);
    const createdIds = [];

    const famList = Array.isArray(familyIds) ? familyIds : [familyIds];
    const weeksList = Array.isArray(weeks) ? weeks.map(Number) : [Number(weeks)];
    const motivoText = reason ? reason.trim() : 'Vacaciones escolares';

    for (const famId of famList) {
      for (const w of weeksList) {
        const existing = await db.payments
          .where({
            familyId: Number(famId),
            year: y,
            month: m,
            week: Number(w)
          })
          .first();

        // Si ya está pagado con monto > 0 y no se desea sobreescribir, respetamos el pago previo
        if (existing && !overwritePaid && existing.status !== 'exonerado' && existing.method !== 'exonerado' && (existing.amount || 0) > 0) {
          continue;
        }

        const record = {
          familyId: Number(famId),
          familiaId: Number(famId),
          year: y,
          month: m,
          week: Number(w),
          amount: 0,
          monto: 0,
          method: 'exonerado',
          status: 'exonerado',
          estado: 'exonerado',
          reason: motivoText,
          motivo: motivoText,
          reference: 'EXONERADO',
          notes: motivoText,
          fechaInicio: startDate || '',
          fechaFin: endDate || '',
          semanas: weeksList,
          date: getTodayDateStr(),
          createdAt: new Date().toISOString()
        };

        if (existing) {
          record.id = existing.id;
          await db.payments.put(record);
          createdIds.push(record.id);
        } else {
          const newId = await db.payments.add(record);
          createdIds.push(newId);
        }
      }
    }
    return createdIds;
  },

  async deletePayment(id) {
    return await db.payments.delete(Number(id));
  },

  // Backup & Restore
  async exportBackup() {
    const settings = await db.settings.toArray();
    const families = await db.families.toArray();
    const children = await db.children.toArray();
    const payments = await db.payments.toArray();
    const attendance = await db.attendance.toArray();

    return {
      version: 1,
      appName: 'MiRuta',
      exportedAt: new Date().toISOString(),
      data: {
        settings,
        families,
        children,
        payments,
        attendance
      }
    };
  },

  async importBackup(backupJson) {
    if (!backupJson || !backupJson.data) {
      throw new Error('Formato de archivo de respaldo inválido.');
    }

    return await db.transaction('rw', [db.settings, db.families, db.children, db.payments, db.attendance], async () => {
      const { settings, families, children, payments, attendance } = backupJson.data;

      if (settings && settings.length > 0) {
        await db.settings.clear();
        await db.settings.bulkAdd(settings);
      }
      if (families) {
        await db.families.clear();
        await db.families.bulkAdd(families);
      }
      if (children) {
        await db.children.clear();
        await db.children.bulkAdd(children);
      }
      if (payments) {
        await db.payments.clear();
        await db.payments.bulkAdd(payments);
      }
      if (attendance) {
        await db.attendance.clear();
        await db.attendance.bulkAdd(attendance);
      }
    });
  },

  async resetData() {
    await seedSampleData(true);
  }
};

// Utilities
function getTodayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthName(monthNumber) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[monthNumber - 1] || '';
}
