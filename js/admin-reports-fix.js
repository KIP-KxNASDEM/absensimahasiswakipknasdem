/* Attendance report matching fix. Loaded after admin-reports.js. */
(() => {
    const norm = value => String(value ?? '').trim().toLowerCase();

    const values = (obj, keys) => keys
        .map(key => obj?.[key])
        .map(norm)
        .filter(Boolean);

    const firstArray = value => {
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.items)) return value.items;
        if (Array.isArray(value?.data)) return value.data;
        if (Array.isArray(value?.records)) return value.records;
        if (Array.isArray(value?.students)) return value.students;
        if (Array.isArray(value?.employees)) return value.employees;
        return [];
    };

    const EMP_KEYS = [
        'id','userId','userID','userid','employeeId','employeeID',
        'studentId','studentID','nim','NIM','email','Email','name','nama'
    ];

    const ATT_KEYS = [
        'userId','userID','userid','employeeId','employeeID',
        'studentId','studentID','nim','NIM','email','Email',
        'User ID','Student ID','NIM','name','nama'
    ];

    const findEmployee = (attendance, employees) => {
        const aKeys = new Set(values(attendance, ATT_KEYS));
        if (!aKeys.size) return null;
        return employees.find(emp => values(emp, EMP_KEYS).some(key => aKeys.has(key))) || null;
    };

    const getClockIn = a => a?.clockIn ?? a?.clockin ?? a?.['Clock In'] ?? a?.['Jam Masuk'] ?? a?.jamMasuk;
    const getStatus = a => norm(a?.status ?? a?.Status ?? a?.['Status Kehadiran']);
    const getDate = a => a?.date ?? a?.tanggal ?? a?.Date ?? a?.Tanggal;

    const monthOf = value => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    adminReports.getFilteredAttendance = function () {
        const monthFilter = this.filters?.attendance?.month || '';
        const deptFilter = this.filters?.attendance?.dept || '';
        const statusFilter = this.filters?.attendance?.status || '';

        const employees = firstArray(this.rawEmployees);
        const attendances = firstArray(this.rawAttendance);
        const leaves = firstArray(this.rawLeaves);
        const izin = firstArray(this.rawIzin);

        return employees.map(employee => {
            const empAttendance = attendances.filter(a => {
                const matched = findEmployee(a, [employee]);
                if (!matched) return false;
                if (!monthFilter) return true;
                return monthOf(getDate(a)) === monthFilter;
            });

            const present = empAttendance.filter(a => !!getClockIn(a)).length;
            const late = empAttendance.filter(a => {
                const status = getStatus(a);
                return !!getClockIn(a) && (status === 'terlambat' || status === 'late');
            }).length;

            const empKeys = new Set(values(employee, EMP_KEYS));
            let leaveDays = 0;

            leaves.forEach(l => {
                const lKeys = new Set(values(l, EMP_KEYS));
                if (![...empKeys].some(k => lKeys.has(k))) return;
                if (norm(l.status) !== 'approved') return;
                const duration = parseInt(l.duration, 10);
                if (!monthFilter) {
                    leaveDays += Number.isFinite(duration) && duration > 0 ? duration : 1;
                    return;
                }
                const start = new Date(l.startDate);
                const end = new Date(l.endDate || l.startDate);
                const monthStart = new Date(`${monthFilter}-01T00:00:00`);
                const [y, m] = monthFilter.split('-').map(Number);
                const monthEnd = new Date(y, m, 0, 23, 59, 59);
                if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
                const overlapStart = start > monthStart ? start : monthStart;
                const overlapEnd = end < monthEnd ? end : monthEnd;
                if (overlapStart <= overlapEnd) {
                    leaveDays += Math.floor((overlapEnd - overlapStart) / 86400000) + 1;
                }
            });

            izin.forEach(i => {
                const iKeys = new Set(values(i, EMP_KEYS));
                if (![...empKeys].some(k => iKeys.has(k))) return;
                if (norm(i.status) !== 'approved') return;
                if (monthFilter && monthOf(i.date) !== monthFilter) return;
                const duration = parseInt(i.duration, 10);
                leaveDays += Number.isFinite(duration) && duration > 0 ? duration : 1;
            });

            let workDays = 0;
            if (monthFilter && this.settings) {
                const key = `shift_schedule_${monthFilter}`;
                let schedule = this.settings[key];
                try {
                    if (typeof schedule === 'string') schedule = JSON.parse(schedule);
                } catch (_) {
                    schedule = null;
                }
                const employeeSchedule = schedule?.[employee.id];
                if (employeeSchedule) {
                    const [year, month] = monthFilter.split('-').map(Number);
                    const days = new Date(year, month, 0).getDate();
                    for (let day = 1; day <= days; day++) {
                        const shift = employeeSchedule[day];
                        if (shift && norm(shift) !== 'libur') workDays++;
                    }
                }
            }

            const absent = workDays > 0
                ? Math.max(0, workDays - present - leaveDays)
                : 0;

            return {
                userId: employee.id,
                name: employee.name,
                department: employee.department,
                present,
                late,
                absent,
                total: present + absent
            };
        }).filter(row => {
            if (deptFilter && row.department !== deptFilter) return false;
            if (!statusFilter) return true;
            if (statusFilter === 'present') return row.present > 0;
            if (statusFilter === 'absent') return row.absent > 0;
            if (statusFilter === 'late') return row.late > 0;
            return true;
        });
    };
})();
