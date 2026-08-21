/* Robust attendance report patch. Loaded by router only on the admin attendance report page. */
(() => {
    const report = window.adminReports;
    if (!report) return;

    const arr = value => Array.isArray(value) ? value : (Array.isArray(value?.data) ? value.data : []);
    const norm = value => String(value ?? '').trim().toLowerCase();
    const val = (obj, keys) => {
        for (const key of keys) {
            if (obj?.[key] !== undefined && obj?.[key] !== null && String(obj[key]).trim() !== '') return obj[key];
        }
        return '';
    };
    const dateOf = row => val(row, ['date', 'tanggal', 'Date', 'Tanggal', 'attendanceDate', 'attendance_date']);
    const clockIn = row => val(row, ['clockIn', 'clockin', 'clock_in', 'Clock In', 'Jam Masuk', 'jamMasuk', 'jam_masuk']);
    const clockOut = row => val(row, ['clockOut', 'clockout', 'clock_out', 'Clock Out', 'Jam Pulang', 'jamPulang', 'jam_pulang']);
    const statusOf = row => norm(val(row, ['status', 'Status', 'Status Kehadiran', 'statusKehadiran']));
    const isLate = row => ['terlambat', 'late'].includes(statusOf(row));
    const employeeId = employee => val(employee, ['id', 'userId', 'studentId', 'employeeId', 'uid']);
    const attendanceUserId = row => val(row, ['userId', 'userID', 'userid', 'studentId', 'studentID', 'employeeId', 'employeeID', 'User ID', 'Student ID', 'Employee ID']);
    const dateKey = value => {
        const text = String(value ?? '').trim();
        const match = text.match(/(\d{4})[-\/]([0-9]{1,2})[-\/]([0-9]{1,2})/);
        return match ? `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}` : text.slice(0, 10);
    };
    const monthOf = value => dateKey(value).slice(0, 7);
    const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const sameStudent = (employee, attendance) => {
        const eid = norm(employeeId(employee));
        const aid = norm(attendanceUserId(attendance));
        if (eid && aid) return eid === aid;
        const en = norm(val(employee, ['name', 'nama', 'Nama']));
        const an = norm(val(attendance, ['name', 'nama', 'Nama']));
        return !!en && !!an && en === an;
    };

    const scheduleDates = (settings, employee, month) => {
        if (!/^\d{4}-\d{2}$/.test(month)) return [];
        let data = settings?.[`shift_schedule_${month}`];
        try { if (typeof data === 'string') data = JSON.parse(data); } catch (_) { data = null; }
        const id = employeeId(employee);
        const schedule = data?.[id] ?? data?.[String(id)];
        const [year, monthNumber] = month.split('-').map(Number);
        const daysInMonth = new Date(year, monthNumber, 0).getDate();
        const dates = [];
        if (schedule) {
            for (let day = 1; day <= daysInMonth; day++) {
                const shift = schedule[day] ?? schedule[String(day)];
                if (shift && norm(shift) !== 'libur') dates.push(`${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
            }
            return dates;
        }
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const endDay = month === currentMonth ? today.getDate() : daysInMonth;
        for (let day = 1; day <= endDay; day++) {
            const weekday = new Date(year, monthNumber - 1, day).getDay();
            if (weekday !== 0 && weekday !== 6) dates.push(`${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
        return dates;
    };

    const approvedDates = (records, employee, month, isIzin = false) => {
        const result = new Set();
        arr(records).forEach(row => {
            if (!sameStudent(employee, row) || norm(row.status) !== 'approved') return;
            if (isIzin) {
                const start = dateKey(val(row, ['date', 'tanggal', 'Date', 'Tanggal']));
                if (!start || monthOf(start) !== month) return;
                const duration = Math.max(1, parseInt(row.duration, 10) || 1);
                const base = new Date(`${start}T00:00:00`);
                for (let i = 0; i < duration; i++) { const d = new Date(base); d.setDate(d.getDate() + i); result.add(dateKey(d.toISOString().slice(0, 10))); }
                return;
            }
            const startValue = val(row, ['startDate', 'start_date', 'tanggalMulai']);
            const endValue = val(row, ['endDate', 'end_date', 'tanggalSelesai']) || startValue;
            if (!startValue) return;
            const start = new Date(startValue), end = new Date(endValue);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = dateKey(d.toISOString().slice(0, 10));
                if (monthOf(key) === month) result.add(key);
            }
        });
        return result;
    };

    const summary = (employee, month) => {
        const attendance = arr(report.rawAttendance).filter(row => sameStudent(employee, row) && (!month || monthOf(dateOf(row)) === month));
        const late = attendance.filter(row => !!clockIn(row) && isLate(row)).length;
        const present = attendance.filter(row => !!clockIn(row) && !isLate(row)).length;
        const expected = scheduleDates(report.settings || {}, employee, month);
        const excluded = new Set([...approvedDates(report.rawLeaves, employee, month), ...approvedDates(report.rawIzin, employee, month, true)]);
        const active = expected.filter(date => !excluded.has(date));
        const absent = Math.max(0, active.length - present - late);
        return { present, late, absent, total: active.length || (present + late + absent), expected: active, attendance };
    };

    const loadOne = async (promise, fallback) => {
        try { const result = await promise; return result?.data !== undefined ? result.data : (result || fallback); }
        catch (error) { console.error('Attendance report load failed:', error); return fallback; }
    };

    report.initAttendanceReports = async function () {
        if (!auth.isAdmin()) { toast.error('Anda tidak memiliki akses!'); router.navigate('dashboard'); return; }
        const monthInput = document.getElementById('attendance-month');
        const statusInput = document.getElementById('report-status-filter');
        const currentMonth = dateTime.getLocalDate().slice(0, 7);
        if (monthInput && !monthInput.value) monthInput.value = currentMonth;
        this.filters = this.filters || {};
        this.filters.attendance = this.filters.attendance || { month: '', status: '' };
        this.filters.attendance.month = monthInput?.value || currentMonth;
        this.filters.attendance.status = statusInput?.value || '';

        const deptFilter = document.getElementById('report-dept-filter');
        if (deptFilter) deptFilter.closest('.filter-group')?.remove();
        const headerRow = document.querySelector('#attendance-reports-table thead tr:first-child');
        if (headerRow) Array.from(headerRow.children).forEach(th => { if (th.textContent.trim().toLowerCase() === 'departemen') th.remove(); });

        const [employees, attendance, leaves, izin, settings] = await Promise.all([
            loadOne(api.getEmployees(), storage.get('admin_employees', [])),
            loadOne(api.getAllAttendance(), storage.get('attendance', [])),
            loadOne(api.getAllLeaves(), storage.get('leaves', [])),
            loadOne(api.getAllIzin(), storage.get('izin', [])),
            loadOne(api.getSettings(), {})
        ]);
        this.rawEmployees = arr(employees);
        this.rawAttendance = arr(attendance);
        this.rawLeaves = arr(leaves);
        this.rawIzin = arr(izin);
        this.settings = settings || {};

        if (monthInput) monthInput.onchange = () => { this.filters.attendance.month = monthInput.value || currentMonth; this.renderAttendanceReports(); };
        if (statusInput) statusInput.onchange = () => { this.filters.attendance.status = statusInput.value || ''; this.renderAttendanceReports(); };
        this.renderAttendanceReports();
    };

    report.getFilteredAttendance = function () {
        const month = this.filters?.attendance?.month || document.getElementById('attendance-month')?.value || '';
        const status = this.filters?.attendance?.status || document.getElementById('report-status-filter')?.value || '';
        return arr(this.rawEmployees).map(employee => {
            const s = summary(employee, month);
            const row = { userId: employeeId(employee), name: val(employee, ['name', 'nama', 'Nama', 'email', 'nim']) || '-', present: s.present, late: s.late, absent: s.absent, total: s.total };
            if (status === 'present' && row.present <= 0) return null;
            if (status === 'absent' && row.absent <= 0) return null;
            if (status === 'late' && row.late <= 0) return null;
            return row;
        }).filter(Boolean);
    };

    report.renderAttendanceReports = function () {
        const tbody = document.getElementById('attendance-reports-body');
        if (!tbody) return;
        const data = this.getFilteredAttendance();
        tbody.innerHTML = data.length ? data.map(row => `
            <tr>
                <td><div class="employee-info"><div class="employee-details"><span class="employee-name">${esc(row.name)}</span></div></div></td>
                <td class="text-center" style="color:var(--color-success);font-weight:600;">${row.present}</td>
                <td class="text-center" style="color:var(--color-warning);font-weight:600;">${row.late}</td>
                <td class="text-center" style="color:var(--color-danger);font-weight:600;">${row.absent}</td>
                <td class="text-center">${row.total}</td>
                <td><button class="btn-action view" onclick="adminReports.viewDetail('${esc(row.userId)}')" title="Lihat detail"><i class="fas fa-eye"></i></button></td>
            </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8;">Tidak ada data absensi pada filter yang dipilih.</td></tr>`;

        const mobileContainer = document.getElementById('attendance-mobile-cards');
        if (mobileContainer) mobileContainer.innerHTML = data.map(row => `
            <div class="mobile-card"><div class="mobile-card-header"><span class="mobile-card-title">${esc(row.name)}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Hadir</span><span class="mobile-card-value" style="color:var(--color-success);">${row.present}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Terlambat</span><span class="mobile-card-value" style="color:var(--color-warning);">${row.late}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Absen</span><span class="mobile-card-value" style="color:var(--color-danger);">${row.absent}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Total</span><span class="mobile-card-value">${row.total}</span></div></div>`).join('');
    };

    report.viewDetail = function (id) {
        const month = this.filters?.attendance?.month || document.getElementById('attendance-month')?.value || '';
        const employee = arr(this.rawEmployees).find(item => norm(employeeId(item)) === norm(id));
        if (!employee) { toast.error('Data mahasiswa tidak ditemukan'); return; }
        const s = summary(employee, month);
        const byDate = new Map(s.attendance.map(row => [dateKey(dateOf(row)), row]));
        const rows = s.expected.map(date => {
            const row = byDate.get(date), has = !!row && !!clockIn(row), late = has && isLate(row);
            const label = !has ? 'Absen' : late ? 'Terlambat' : 'Hadir';
            const cls = !has ? 'danger' : late ? 'warning' : 'success';
            return `<tr><td>${esc(date)}</td><td>${esc(val(row, ['shift', 'Shift', 'shiftName']) || 'Pagi')}</td><td>${esc(row ? clockIn(row) : '-')}</td><td>${esc(row ? clockOut(row) : '-')}</td><td><span class="status-badge ${cls}">${label}</span></td></tr>`;
        }).join('');
        document.getElementById('attendance-detail-modal')?.remove();
        const root = document.createElement('div');
        root.id = 'attendance-detail-modal';
        root.innerHTML = `<div class="attendance-detail-backdrop"></div><div class="attendance-detail-dialog" role="dialog" aria-modal="true">
            <div class="attendance-detail-header"><div><h2>Detail Absensi</h2><p>${esc(val(employee, ['name', 'nama', 'Nama']) || '-')}</p></div><button type="button" class="attendance-detail-close">&times;</button></div>
            <div class="attendance-detail-body"><div class="attendance-detail-meta"><div><span>Periode</span><strong>${esc(month || 'Semua periode')}</strong></div></div>
            <div class="attendance-detail-stats"><div><strong class="present">${s.present}</strong><span>Hadir</span></div><div><strong class="late">${s.late}</strong><span>Terlambat</span></div><div><strong class="absent">${s.absent}</strong><span>Absen</span></div><div><strong>${s.total}</strong><span>Total</span></div></div>
            <div class="attendance-detail-history"><h3>Riwayat Absensi</h3><div class="attendance-detail-table-wrap"><table><thead><tr><th>Tanggal</th><th>Shift</th><th>Clock In</th><th>Clock Out</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">Belum ada data absensi pada periode ini.</td></tr>'}</tbody></table></div></div></div>
            <div class="attendance-detail-footer"><button type="button" class="attendance-detail-close btn-secondary">Tutup</button></div></div>`;
        document.body.appendChild(root);
        const close = () => root.remove();
        root.querySelectorAll('.attendance-detail-close').forEach(button => button.addEventListener('click', close));
        root.querySelector('.attendance-detail-backdrop')?.addEventListener('click', close);
    };
})();
