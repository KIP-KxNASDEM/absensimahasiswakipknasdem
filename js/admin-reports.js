/* Canonical attendance report fix: correct summary + complete daily detail. */
    
 (() => {


        const adminReports = {
            jurnalData: [],
            rawJournals: [],
            attendanceData: [],
            filters: {
                jurnal: {
                    employee: '',
                    status: ''
                }
            }
        };
     
const norm = v => String(v ?? '').trim().toLowerCase();
    const arr = v => {
    if (Array.isArray(v)) return v;

    if (Array.isArray(v?.data)) {
        return v.data;
    }

    if (Array.isArray(v?.result)) {
        return v.result;
    }

    return [];
};
    const dateOf = r => val(r, ['date', 'tanggal', 'Date', 'Tanggal', 'attendanceDate', 'attendance_date']);
    const clockIn = r => val(r, ['clockIn', 'clockin', 'clock_in', 'Clock In', 'Jam Masuk', 'jamMasuk', 'jam_masuk']);
    const clockOut = r => val(r, ['clockOut', 'clockout', 'clock_out', 'Clock Out', 'Jam Pulang', 'jamPulang', 'jam_pulang']);
    const statusOf = r => norm(val(r, ['status', 'Status', 'Status Kehadiran', 'statusKehadiran']));
    const isLate = r => statusOf(r) === 'terlambat' || statusOf(r) === 'late';
    const dateKey = v => {
        const s = String(v ?? '').trim();
        const m = s.match(/(\d{4})[-\/]([0-9]{1,2})[-\/]([0-9]{1,2})/);
        return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : s.slice(0, 10);
    };
    const monthOf = v => dateKey(v).slice(0, 7);
    const esc = v => String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const samePerson = (a, b) => {
        const keys = ['id', 'userId', 'userID', 'userid', 'studentId', 'studentID', 'employeeId', 'employeeID', 'nim', 'NIM', 'email', 'Email', 'User ID', 'Student ID', 'Employee ID'];
        for (const k of keys) {
            const av = norm(a?.[k]);
            const bv = norm(b?.[k]);
            if (av && bv && av === bv) return true;
        }
        const an = norm(val(a, ['name', 'nama', 'Nama']));
        const bn = norm(val(b, ['name', 'nama', 'Nama']));
        return !!an && an === bn;
    };

    const employeeId = e => e?.id ?? e?.userId ?? e?.employeeId ?? e?.studentId;

    const scheduleDates = (settings, employee, month) => {
        if (!/^\d{4}-\d{2}$/.test(month)) return [];

        let data = settings?.[`shift_schedule_${month}`];
        try {
            if (typeof data === 'string') data = JSON.parse(data);
        } catch (_) {
            data = null;
        }

        const id = employeeId(employee);
        const schedule = data?.[id] ?? data?.[String(id)];
        const [y, m] = month.split('-').map(Number);
        const days = new Date(y, m, 0).getDate();
        const out = [];

        if (schedule) {
            for (let d = 1; d <= days; d++) {
                const shift = schedule[d] ?? schedule[String(d)];
                if (shift && norm(shift) !== 'libur') {
                    out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
                }
            }
            return out;
        }

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const end = month === currentMonth ? now.getDate() : days;

        for (let d = 1; d <= end; d++) {
            const w = new Date(y, m - 1, d).getDay();
            if (w !== 0 && w !== 6) {
                out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
            }
        }
        return out;
    };

    const approvedDates = (records, employee, month, isIzin = false) => {
        const out = new Set();

        arr(records).forEach(r => {
            if (!samePerson(employee, r) || norm(r.status) !== 'approved') return;

            if (isIzin) {
                const d = dateKey(val(r, ['date', 'tanggal', 'Date', 'Tanggal']));
                if (d && monthOf(d) === month) {
                    const n = Math.max(1, parseInt(r.duration, 10) || 1);
                    const base = new Date(`${d}T00:00:00`);
                    for (let i = 0; i < n; i++) {
                        const x = new Date(base);
                        x.setDate(x.getDate() + i);
                        out.add(dateKey(x.toISOString().slice(0, 10)));
                    }
                }
                return;
            }

            const sr = val(r, ['startDate', 'start_date', 'tanggalMulai']);
            const er = val(r, ['endDate', 'end_date', 'tanggalSelesai']) || sr;
            if (!sr) return;

            const s = new Date(sr);
            const e = new Date(er);
            if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return;

            for (let x = new Date(s); x <= e; x.setDate(x.getDate() + 1)) {
                const d = dateKey(x.toISOString().slice(0, 10));
                if (monthOf(d) === month) out.add(d);
            }
        });

        return out;
    };

    const summary = (employee, month) => {
        const attendance = arr(adminReports.rawAttendance).filter(
            r => samePerson(employee, r) && (!month || monthOf(dateOf(r)) === month)
        );
        const late = attendance.filter(r => !!clockIn(r) && isLate(r)).length;
        const present = attendance.filter(r => !!clockIn(r) && !isLate(r)).length;
        const expected = scheduleDates(adminReports.settings, employee, month);
        const leave = approvedDates(adminReports.rawLeaves, employee, month);
        const izin = approvedDates(adminReports.rawIzin, employee, month, true);
        const excluded = new Set([...leave, ...izin]);
        const active = expected.filter(d => !excluded.has(d));
        const absent = Math.max(0, active.length - present - late);

        return {
            present,
            late,
            absent,
            total: active.length || (present + late + absent),
            expected: active,
            attendance
        };
    };

    const cleanupAttendanceUi = () => {
        const deptFilter = document.getElementById('report-dept-filter');
        if (deptFilter) {
            const group = deptFilter.closest('.filter-group');
            if (group) group.remove();
        }

        const firstHeaderRow = document.querySelector('#attendance-reports-table thead tr:first-child');
        if (firstHeaderRow) {
            Array.from(firstHeaderRow.children).forEach(th => {
                if (th.textContent.trim().toLowerCase() === 'departemen') th.remove();
            });
        }
    };

    adminReports.initAttendanceReports = async function () {
        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }

        cleanupAttendanceUi();

        try {
            const [e, a, l, i, j, s] = await Promise.all([
                api.getEmployees(),
                api.getAllAttendance(),
                api.getAllLeaves(),
                api.getAllIzin(),
                api.getAllJournals(),
                api.getSettings()
]);
            
        console.log("GET ALL JOURNALS RESPONSE:", j);
            this.rawEmployees = arr(e);
            this.rawAttendance = arr(a);
            this.rawLeaves = arr(l);
            this.rawIzin = arr(i);
            
            this.rawJournals = j?.data || [];
            this.jurnalData = j?.data || [];
        console.log("JURNAL INIT:", this.jurnalData);
            this.settings = s?.data || {};
            
            if (this.filters?.attendance) this.filters.attendance.dept = '';
            
            this.bindAttendanceEvents();
            this.populateEmployeeFilter?.();
            this.renderAttendanceReports();
            this.renderJournalReports?.();
        } catch (e) {
            console.error(e);
            toast.error('Gagal memuat data absensi');
        }
    };

     adminReports.bindAttendanceEvents = function () {
    const month = document.getElementById('attendance-month');
    const status = document.getElementById('attendance-status');

    if (month) {
        month.addEventListener('change', () => {
            this.renderAttendanceReports();
        });
    }

    if (status) {
        status.addEventListener('change', () => {
            this.renderAttendanceReports();
        });
    }
};


adminReports.populateEmployeeFilter = function () {
    const select = document.getElementById('attendance-employee');

    if (!select) return;

    select.innerHTML = '<option value="">Semua Mahasiswa</option>';

    (this.rawEmployees || []).forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id || emp.uid || '';
        option.textContent = emp.name || emp.nama || '-';
        select.appendChild(option);
    });
};
    adminReports.getFilteredAttendance = function () {
        const month = this.filters?.attendance?.month || document.getElementById('attendance-month')?.value || '';
        const sf = this.filters?.attendance?.status || '';

        return arr(this.rawEmployees).map(employee => {
            const s = summary(employee, month);
            const row = {
                userId: employeeId(employee),
                name: employee.name || employee.nama || employee.email || employee.nim || '-',
                present: s.present,
                late: s.late,
                absent: s.absent,
                total: s.total
            };

            if (sf === 'present' && row.present <= 0) return null;
            if (sf === 'absent' && row.absent <= 0) return null;
            if (sf === 'late' && row.late <= 0) return null;
            return row;
        }).filter(Boolean);
    };

    adminReports.renderAttendanceReports = function () {
       const tbody =
           document.getElementById('journal-reports-body') ||
           document.getElementById('journal-report-body');
        if (!tbody) return;

        const data = this.getFilteredAttendance();

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;padding:24px;color:#94a3b8;">
                        Tidak ada data absensi pada filter yang dipilih.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = data.map(row => `
                <tr>
                    <td>
                        <div class="employee-info">
                            <div class="employee-details">
                                <span class="employee-name">${esc(row.name)}</span>
                            </div>
                        </div>
                    </td>
                    <td class="text-center" style="color: var(--color-success); font-weight: 600;">${row.present}</td>
                    <td class="text-center" style="color: var(--color-warning); font-weight: 600;">${row.late}</td>
                    <td class="text-center" style="color: var(--color-danger); font-weight: 600;">${row.absent}</td>
                    <td class="text-center">${row.total}</td>
                    <td>
                        <button class="btn-action view" onclick="adminReports.viewDetail('${esc(row.name)}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        const mobileContainer = document.getElementById('attendance-mobile-cards');
        if (mobileContainer) {
            mobileContainer.innerHTML = data.map(row => `
                <div class="mobile-card">
                    <div class="mobile-card-header">
                        <span class="mobile-card-title">${esc(row.name)}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Hadir</span>
                        <span class="mobile-card-value" style="color: var(--color-success);">${row.present}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Terlambat</span>
                        <span class="mobile-card-value" style="color: var(--color-warning);">${row.late}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Absen</span>
                        <span class="mobile-card-value" style="color: var(--color-danger);">${row.absent}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Total</span>
                        <span class="mobile-card-value">${row.total}</span>
                    </div>
                </div>
            `).join('');
        }
    };

    adminReports.viewDetail = function (name) {
        const month = this.filters?.attendance?.month || document.getElementById('attendance-month')?.value || '';
       const employee = (this.rawEmployees || []).find(
 e =>
 String(e.id) === String(j.userId) ||
 String(e.userId) === String(j.userId)
);

        if (!employee) {
            toast.error('Data mahasiswa tidak ditemukan');
            return;
        }

        const s = summary(employee, month);
        const byDate = new Map(s.attendance.map(r => [dateKey(dateOf(r)), r]));
        const rows = s.expected.map(d => {
            const r = byDate.get(d);
            const has = !!r && !!clockIn(r);
            const late = has && isLate(r);
            const label = !has ? 'Absen' : late ? 'Terlambat' : 'Hadir';
            const cls = !has ? 'danger' : late ? 'warning' : 'success';
            return `<tr><td>${esc(d)}</td><td>${esc(val(r, ['shift', 'Shift', 'shiftName']) || 'Pagi')}</td><td>${esc(r ? clockIn(r) : '-')}</td><td>${esc(r ? clockOut(r) : '-')}</td><td><span class="status-badge ${cls}">${label}</span></td></tr>`;
        }).join('');

        document.getElementById('attendance-detail-modal')?.remove();

        const root = document.createElement('div');
        root.id = 'attendance-detail-modal';
        root.innerHTML = `
            <div class="attendance-detail-backdrop"></div>
            <div class="attendance-detail-dialog" role="dialog" aria-modal="true">
                <div class="attendance-detail-header">
                    <div>
                        <h2>Detail Absensi</h2>
                        <p>${esc(employee.name || employee.nama || '-')}</p>
                    </div>
                    <button type="button" class="attendance-detail-close">&times;</button>
                </div>
                <div class="attendance-detail-body">
                    <div class="attendance-detail-meta">
                        <div><span>Periode</span><strong>${esc(month || 'Semua periode')}</strong></div>
                    </div>
                    <div class="attendance-detail-stats">
                        <div><strong class="present">${s.present}</strong><span>Hadir</span></div>
                        <div><strong class="late">${s.late}</strong><span>Terlambat</span></div>
                        <div><strong class="absent">${s.absent}</strong><span>Absen</span></div>
                        <div><strong>${s.total}</strong><span>Total</span></div>
                    </div>
                    <div class="attendance-detail-history">
                        <h3>Riwayat Absensi</h3>
                        <div class="attendance-detail-table-wrap">
                            <table>
                                <thead><tr><th>Tanggal</th><th>Shift</th><th>Clock In</th><th>Clock Out</th><th>Status</th></tr></thead>
                                <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">Belum ada data absensi pada periode ini.</td></tr>'}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="attendance-detail-footer">
                    <button type="button" class="attendance-detail-close btn-secondary">Tutup</button>
                </div>
            </div>`;

        document.body.appendChild(root);

        const close = () => {
            document.removeEventListener('keydown', key);
            root.remove();
        };
        const key = e => {
            if (e.key === 'Escape') close();
        };

        root.querySelectorAll('.attendance-detail-close').forEach(b => b.addEventListener('click', close));
        root.querySelector('.attendance-detail-backdrop').addEventListener('click', close);
        document.addEventListener('keydown', key);
    };

    const style = document.createElement('style');
    style.textContent = `
        #attendance-detail-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;font-family:Poppins,sans-serif}
        #attendance-detail-modal .attendance-detail-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.52);backdrop-filter:blur(3px)}
        #attendance-detail-modal .attendance-detail-dialog{position:relative;width:min(900px,100%);max-height:85vh;overflow:hidden;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column}
        #attendance-detail-modal .attendance-detail-header{display:flex;justify-content:space-between;align-items:center;padding:22px 26px;border-bottom:1px solid #e8edf3}
        #attendance-detail-modal .attendance-detail-header h2{margin:0;font-size:21px;color:#1e293b}
        #attendance-detail-modal .attendance-detail-header p{margin:4px 0 0;color:#64748b;font-size:14px}
        #attendance-detail-modal .attendance-detail-close{border:0;background:#f1f5f9;color:#64748b;width:38px;height:38px;border-radius:10px;cursor:pointer;font-size:22px}
        #attendance-detail-modal .attendance-detail-body{padding:22px 26px;overflow:auto}
        #attendance-detail-modal .attendance-detail-meta{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:18px}
        #attendance-detail-modal .attendance-detail-meta>div,#attendance-detail-modal .attendance-detail-stats>div{padding:14px;background:#f8fafc;border-radius:10px}
        #attendance-detail-modal .attendance-detail-meta span,#attendance-detail-modal .attendance-detail-stats span{display:block;font-size:11px;color:#64748b;text-transform:uppercase}
        #attendance-detail-modal .attendance-detail-meta strong{display:block;margin-top:3px;color:#334155}
        #attendance-detail-modal .attendance-detail-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
        #attendance-detail-modal .attendance-detail-stats>div{text-align:center}
        #attendance-detail-modal .attendance-detail-stats strong{display:block;font-size:24px;color:#334155}
        #attendance-detail-modal .attendance-detail-stats .present{color:#22b573}
        #attendance-detail-modal .attendance-detail-stats .late{color:#f59e0b}
        #attendance-detail-modal .attendance-detail-stats .absent{color:#ef4444}
        #attendance-detail-modal h3{font-size:15px;color:#334155;margin:0 0 10px}
        #attendance-detail-modal .attendance-detail-table-wrap{overflow:auto;border:1px solid #e8edf3;border-radius:10px}
        #attendance-detail-modal table{width:100%;min-width:620px;border-collapse:collapse}
        #attendance-detail-modal th{background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;text-align:left;padding:11px 13px}
        #attendance-detail-modal td{padding:12px 13px;border-top:1px solid #edf1f5;color:#475569;font-size:13px}
        #attendance-detail-modal .attendance-detail-footer{padding:14px 26px;border-top:1px solid #e8edf3;text-align:right}
        #attendance-detail-modal .attendance-detail-footer .btn-secondary{border:0;background:#eef2f7;color:#475569;border-radius:9px;padding:9px 18px;cursor:pointer}
        @media(max-width:600px){
            #attendance-detail-modal{padding:12px}
            #attendance-detail-modal .attendance-detail-stats{grid-template-columns:repeat(2,1fr)}
        }
    `;
    document.head.appendChild(style);

    adminReports.renderJournalReports = function () {

    const tbody = document.getElementById('journal-report-body');

    if (!tbody) return;

    const journals = this.jurnalData || [];

    if (journals.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:24px;color:#94a3b8">
                    Belum ada data jurnal
                </td>
            </tr>
        `;
        return;
    }


    tbody.innerHTML = journals.map(j => {

        const employee = (this.rawEmployees || []).find(
            e => String(e.id) === String(j.userId)
        );


        return `
        <tr>
            <td>${esc(j.date || '-')}</td>

            <td>
                ${esc(employee?.name || '-')}
            </td>

            <td>
                ${esc(employee?.kampus || '-')}
            </td>

            <td>
                ${esc(employee?.prodi || '-')}
            </td>

            <td>
                ${esc(j.tasks || '-')}
            </td>

            <td>
                ${
                    j.photo 
                    ? `<img src="${esc(j.photo)}" width="50">`
                    : '-'
                }
            </td>

            <td>
                ${esc(j.achievements || '-')}
            </td>

        </tr>
        `;

    }).join('');

};
    
window.adminReports = adminReports;
 })();
