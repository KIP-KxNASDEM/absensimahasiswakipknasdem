/* Attendance report fix - uses the canonical getAllAttendance endpoint. */
(() => {
    const norm = v => String(v ?? '').trim().toLowerCase();

    const arr = v => {
        if (Array.isArray(v)) return v;
        if (Array.isArray(v?.data)) return v.data;
        if (Array.isArray(v?.items)) return v.items;
        if (Array.isArray(v?.records)) return v.records;
        return [];
    };

    const val = (o, keys) => {
        for (const key of keys) {
            if (o?.[key] !== undefined && o?.[key] !== null && String(o[key]).trim() !== '') {
                return o[key];
            }
        }
        return '';
    };

    const identityKeys = [
        'id', 'userId', 'userID', 'userid',
        'studentId', 'studentID',
        'employeeId', 'employeeID',
        'nim', 'NIM',
        'email', 'Email',
        'User ID', 'Student ID', 'Employee ID'
    ];

    const nameOf = o => norm(val(o, ['name', 'nama', 'Nama']));

    const identityTokens = o => {
        const set = new Set();
        identityKeys.forEach(key => {
            const value = norm(o?.[key]);
            if (value) set.add(value);
        });
        return set;
    };

    const samePerson = (student, record) => {
        const a = identityTokens(student);
        const b = identityTokens(record);
        for (const token of a) {
            if (b.has(token)) return true;
        }
        const an = nameOf(student);
        const bn = nameOf(record);
        return !!an && !!bn && an === bn;
    };

    const dateValue = r => val(r, [
        'date', 'tanggal', 'Date', 'Tanggal',
        'attendanceDate', 'attendance_date'
    ]);

    const clockIn = r => val(r, [
        'clockIn', 'clockin', 'clock_in', 'Clock In',
        'Jam Masuk', 'jamMasuk', 'jam_masuk'
    ]);

    const attendanceStatus = r => norm(val(r, [
        'status', 'Status', 'Status Kehadiran', 'statusKehadiran'
    ]));

    const monthOf = value => {
        if (!value) return '';
        const text = String(value);
        const match = text.match(/(\d{4})[-\/]([0-9]{1,2})/);
        if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}`;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    const workdaysElapsed = month => {
        if (!month) return 0;
        const [year, monthNumber] = month.split('-').map(Number);
        if (!year || !monthNumber) return 0;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (month > currentMonth) return 0;

        const lastDay = month < currentMonth
            ? new Date(year, monthNumber, 0).getDate()
            : now.getDate();

        let total = 0;
        for (let day = 1; day <= lastDay; day++) {
            const weekday = new Date(year, monthNumber - 1, day).getDay();
            if (weekday !== 0 && weekday !== 6) total++;
        }
        return total;
    };

    const approvedLeaveDays = (records, student, month, izin = false) => {
        let total = 0;

        arr(records).forEach(record => {
            if (!samePerson(student, record)) return;
            if (norm(record.status) !== 'approved') return;

            if (izin) {
                const recordMonth = monthOf(val(record, ['date', 'tanggal', 'Date', 'Tanggal']));
                if (month && recordMonth !== month) return;
                const duration = parseInt(record.duration, 10);
                total += Number.isFinite(duration) && duration > 0 ? duration : 1;
                return;
            }

            const start = new Date(record.startDate || record.start_date || record.tanggalMulai);
            const end = new Date(record.endDate || record.end_date || record.tanggalSelesai || record.startDate);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

            if (!month) {
                total += Math.max(1, Math.floor((end - start) / 86400000) + 1);
                return;
            }

            const [year, monthNumber] = month.split('-').map(Number);
            const monthStart = new Date(year, monthNumber - 1, 1);
            const monthEnd = new Date(year, monthNumber, 0, 23, 59, 59);
            const overlapStart = start > monthStart ? start : monthStart;
            const overlapEnd = end < monthEnd ? end : monthEnd;

            if (overlapStart <= overlapEnd) {
                total += Math.floor((overlapEnd - overlapStart) / 86400000) + 1;
            }
        });

        return total;
    };

    // Override ONLY the attendance report initializer.
    // Journal and leave reports continue using their original loadData().
    adminReports.initAttendanceReports = async function () {
        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }

        try {
            const [studentResult, attendanceResult, leaveResult, izinResult, settingsResult] = await Promise.all([
                api.getStudents(),
                api.getAllAttendance(),
                api.getAllLeaves(),
                api.getAllIzin(),
                api.getSettings()
            ]);

            this.rawEmployees = arr(studentResult?.data ?? studentResult);
            this.rawAttendance = arr(attendanceResult?.data ?? attendanceResult);
            this.rawLeaves = arr(leaveResult?.data ?? leaveResult);
            this.rawIzin = arr(izinResult?.data ?? izinResult);
            this.settings = settingsResult?.data || {};

            console.log('ATTENDANCE REPORT:', {
                students: this.rawEmployees.length,
                attendance: this.rawAttendance.length,
                leaves: this.rawLeaves.length,
                izin: this.rawIzin.length
            });

            this.attendanceData = [];
            this.bindAttendanceEvents();
            this.renderAttendanceReports();
        } catch (error) {
            console.error('Attendance report load error:', error);
            toast.error('Gagal memuat data absensi');
        }
    };

    adminReports.getFilteredAttendance = function () {
        const monthInput = document.getElementById('attendance-month');
        const month = this.filters?.attendance?.month || monthInput?.value || '';
        const department = this.filters?.attendance?.dept || '';
        const statusFilter = this.filters?.attendance?.status || '';

        const students = arr(this.rawEmployees);
        const attendance = arr(this.rawAttendance);
        const elapsedWorkdays = workdaysElapsed(month);

        return students.map(student => {
            const records = attendance.filter(record =>
                samePerson(student, record) &&
                (!month || monthOf(dateValue(record)) === month)
            );

            const present = records.filter(record => !!clockIn(record)).length;

            const late = records.filter(record => {
                const status = attendanceStatus(record);
                return !!clockIn(record) && (status === 'terlambat' || status === 'late');
            }).length;

            const leaveDays = approvedLeaveDays(this.rawLeaves, student, month, false);
            const izinDays = approvedLeaveDays(this.rawIzin, student, month, true);

            const absent = month
                ? Math.max(0, elapsedWorkdays - present - leaveDays - izinDays)
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

            if (department && row.department !== department) return null;
            if (statusFilter === 'present' && row.present <= 0) return null;
            if (statusFilter === 'absent' && row.absent <= 0) return null;
            if (statusFilter === 'late' && row.late <= 0) return null;

            return row;
        }).filter(Boolean);
    };
})();
