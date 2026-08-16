/* Attendance report fix for Portal Mahasiswa.
 * Loaded after admin-reports.js.
 *
 * Important: the admin report must read the same student/attendance source
 * used by the student portal. It must not depend on shift_schedule_*.
 */
(() => {
    const norm = value => String(value ?? '').trim().toLowerCase();

    const firstArray = value => {
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.items)) return value.items;
        if (Array.isArray(value?.data)) return value.data;
        if (Array.isArray(value?.records)) return value.records;
        if (Array.isArray(value?.students)) return value.students;
        if (Array.isArray(value?.employees)) return value.employees;
        return [];
    };

    const pick = (obj, keys) => {
        for (const key of keys) {
            const value = obj?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return value;
            }
        }
        return '';
    };

    const ID_KEYS = [
        'id', 'userId', 'userID', 'userid', 'studentId', 'studentID',
        'employeeId', 'employeeID', 'nim', 'NIM', 'email', 'Email',
        'User ID', 'Student ID', 'Nama', 'name', 'nama'
    ];

    const ATT_ID_KEYS = [
        'userId', 'userID', 'userid', 'studentId', 'studentID',
        'employeeId', 'employeeID', 'nim', 'NIM', 'email', 'Email',
        'User ID', 'Student ID', 'Nama', 'name', 'nama'
    ];

    const identitySet = obj => new Set(
        ID_KEYS
            .map(key => norm(obj?.[key]))
            .filter(Boolean)
    );

    const samePerson = (a, b) => {
        const left = identitySet(a);
        const right = new Set(ATT_ID_KEYS.map(key => norm(b?.[key])).filter(Boolean));
        for (const value of left) {
            if (right.has(value)) return true;
        }
        return false;
    };

    const getClockIn = a => pick(a, [
        'clockIn', 'clockin', 'clock_in', 'Clock In', 'Jam Masuk', 'jamMasuk', 'jam_masuk'
    ]);

    const getStatus = a => norm(pick(a, [
        'status', 'Status', 'Status Kehadiran', 'statusKehadiran'
    ]));

    const getDate = a => pick(a, [
        'date', 'tanggal', 'Date', 'Tanggal', 'attendanceDate', 'attendance_date'
    ]);

    const monthOf = value => {
        if (!value) return '';
        if (typeof value === 'string') {
            const match = value.match(/(\d{4})[-\/]([0-9]{1,2})/);
            if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}`;
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    const workdaysInMonth = monthFilter => {
        if (!monthFilter) return 0;
        const [year, month] = monthFilter.split('-').map(Number);
        if (!year || !month) return 0;
        const days = new Date(year, month, 0).getDate();
        let count = 0;
        for (let day = 1; day <= days; day++) {
            const weekday = new Date(year, month - 1, day).getDay();
            if (weekday !== 0 && weekday !== 6) count++;
        }
        return count;
    };

    const approvedDaysFor = (records, student, monthFilter, type) => {
        let total = 0;
        for (const record of firstArray(records)) {
            if (!samePerson(student, record)) continue;
            if (norm(record.status) !== 'approved') continue;

            if (type === 'izin') {
                if (monthFilter && monthOf(pick(record, ['date', 'tanggal', 'Date', 'Tanggal'])) !== monthFilter) continue;
                const duration = parseInt(record.duration, 10);
                total += Number.isFinite(duration) && duration > 0 ? duration : 1;
                continue;
            }

            const start = new Date(record.startDate || record.start_date || record.tanggalMulai);
            const end = new Date(record.endDate || record.end_date || record.tanggalSelesai || record.startDate);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

            if (!monthFilter) {
                total += Math.max(1, Math.floor((end - start) / 86400000) + 1);
                continue;
            }

            const [year, month] = monthFilter.split('-').map(Number);
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59);
            const overlapStart = start > monthStart ? start : monthStart;
            const overlapEnd = end < monthEnd ? end : monthEnd;
            if (overlapStart <= overlapEnd) {
                total += Math.floor((overlapEnd - overlapStart) / 86400000) + 1;
            }
        }
        return total;
    };

    /*
     * Replace the old report loader.
     * getAllAttendance() has proven unreliable for this admin report, while
     * getAttendance(studentId) is the endpoint already used by the student portal.
     * Fetch each student's attendance from that same endpoint.
     */
    const originalLoadData = adminReports.loadData.bind(adminReports);

    adminReports.loadData = async function () {
        let students = [];
        let jurnals = [];
        let leaves = [];
        let izinList = [];
        let settings = {};

        try {
            const [studentResult, journalResult, leaveResult, izinResult, settingsResult] = await Promise.all([
                api.getStudents(),
                api.getAllJournals(),
                api.getAllLeaves(),
                api.getAllIzin(),
                api.getSettings()
            ]);

            students = firstArray(studentResult?.data ?? studentResult);
            jurnals = firstArray(journalResult?.data ?? journalResult);
            leaves = firstArray(leaveResult?.data ?? leaveResult);
            izinList = firstArray(izinResult?.data ?? izinResult);
            settings = firstArray(settingsResult?.data ?? settingsResult).length
                ? firstArray(settingsResult?.data ?? settingsResult)[0]
                : (settingsResult?.data || {});
        } catch (error) {
            console.error('Student report base data error:', error);
            students = firstArray(storage.get('admin_students', []));
            jurnals = firstArray(storage.get('jurnals', []));
            leaves = firstArray(storage.get('leaves', []));
            izinList = firstArray(storage.get('izin', []));
            settings = storage.get('settings', {});
        }

        // Same attendance endpoint as the student dashboard.
        const attendanceResults = await Promise.allSettled(
            students.map(student => api.getAttendance(student.id))
        );

        const attendance = [];
        attendanceResults.forEach((result, index) => {
            if (result.status !== 'fulfilled') return;
            const rows = firstArray(result.value?.data ?? result.value);
            const student = students[index];
            rows.forEach(row => {
                // Some backends return all attendance even when userId is supplied.
                // Do not duplicate another student's record in that case.
                if (!row || samePerson(student, row)) attendance.push(row);
            });
        });

        this.rawEmployees = students;
        this.rawAttendance = attendance;
        this.rawLeaves = leaves;
        this.rawIzin = izinList;
        this.settings = settings || {};

        this.attendanceData = students.map(student => ({
            userId: student.id,
            name: student.name || student.nama || student.email || student.nim || '-',
            department: student.department || student.fakultas || student.prodi || '-',
            present: 0,
            late: 0,
            absent: 0,
            total: 0
        }));

        const currentUser = auth.getCurrentUser();
        this.jurnalData = jurnals.map(j => {
            const emp = students.find(s => samePerson(s, j)) ||
                (currentUser ? { name: currentUser.name, department: currentUser.department || '-' } : null) ||
                { name: 'Mahasiswa', department: '-' };
            return {
                date: j.date,
                name: emp.name,
                department: emp.department,
                tasks: j.tasks || '-',
                achievements: j.achievements || '-',
                obstacles: j.obstacles || '-',
                plan: j.plan || '-',
                photo: j.photo || null,
                status: j.tasks ? 'filled' : 'empty',
                updatedAt: j.updatedAt
            };
        });

        this.leaveData = [];
    };

    adminReports.getFilteredAttendance = function () {
        const monthFilter = this.filters?.attendance?.month || '';
        const deptFilter = this.filters?.attendance?.dept || '';
        const statusFilter = this.filters?.attendance?.status || '';
        const students = firstArray(this.rawEmployees);
        const attendances = firstArray(this.rawAttendance);

        return students.map(student => {
            const studentAttendance = attendances.filter(row => {
                if (!samePerson(student, row)) return false;
                return !monthFilter || monthOf(getDate(row)) === monthFilter;
            });

            const present = studentAttendance.filter(row => !!getClockIn(row)).length;
            const late = studentAttendance.filter(row => {
                const status = getStatus(row);
                return !!getClockIn(row) && (status === 'terlambat' || status === 'late');
            }).length;

            const leaveDays = approvedDaysFor(this.rawLeaves, student, monthFilter, 'leave');
            const izinDays = approvedDaysFor(this.rawIzin, student, monthFilter, 'izin');
            const baseline = monthFilter ? workdaysInMonth(monthFilter) : present + leaveDays + izinDays;
            const absent = monthFilter
                ? Math.max(0, baseline - present - leaveDays - izinDays)
                : 0;

            const row = {
                userId: student.id,
                name: student.name || student.nama || student.email || student.nim || '-',
                department: student.department || student.fakultas || student.prodi || '-',
                present,
                late,
                absent,
                total: present + absent
            };

            if (deptFilter && row.department !== deptFilter) return null;
            if (statusFilter === 'present' && row.present <= 0) return null;
            if (statusFilter === 'absent' && row.absent <= 0) return null;
            if (statusFilter === 'late' && row.late <= 0) return null;
            return row;
        }).filter(Boolean);
    };
})();
