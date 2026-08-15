/**
 * Portal Mahasiswa - Admin Reports
 * Reports and exports for admin
 */

const adminReports = {

    // ==================================================
    // DATA
    // ==================================================

    attendanceData: [],
    jurnalData: [],
    leaveData: [],

    rawAttendance: [],
    rawEmployees: [],
    rawStudents: [],
    rawJournals: [],
    rawLeaves: [],
    rawIzin: [],

    filters: {
        attendance: {
            month: '',
            dept: '',
            status: ''
        },

        jurnal: {
            month: '',
            employee: '',
            status: ''
        },

        leave: {
            month: '',
            type: '',
            status: ''
        }
    },


    // ==================================================
    // INITIALIZATION
    // ==================================================

    async initAttendanceReports() {

        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }

        await this.loadData();

        this.bindAttendanceEvents();
        this.populateEmployeeFilter();
        this.renderAttendanceReports();
    },


    async initJurnalReports() {

        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }

        await this.loadData();

        this.bindJurnalEvents();
        this.populateEmployeeFilter();
        this.renderJurnalReports();
    },


    async initLeaveReports() {

        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }

        await this.loadData();

        this.bindLeaveEvents();
        this.renderLeaveReports();
    },


    // ==================================================
    // HELPER
    // ==================================================

    normalizeDate(value) {

        if (!value) {
            return '';
        }

        if (value instanceof Date) {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        }

        const str = String(value);

        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return str.substring(0, 10);
        }

        // DD/MM/YYYY
        const slash = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

        if (slash) {
            return `${slash[3]}-${slash[2]}-${slash[1]}`;
        }

        return str.substring(0, 10);
    },


    getMonthFromDate(value) {

        const date = this.normalizeDate(value);

        if (!date || date.length < 7) {
            return '';
        }

        return date.substring(0, 7);
    },


    // ==================================================
    // LOAD DATA
    // ==================================================

    async loadData() {

        let students = [];
        let jurnals = [];
        let leaves = [];
        let izinList = [];
        let attendances = [];

        try {

            const [
                studentResult,
                jurnalResult,
                leaveResult,
                izinResult,
                attResult
            ] = await Promise.all([

                api.getStudents(),

                api.getAllJournals(),

                api.getAllLeaves(),

                api.getAllIzin(),

                api.getAllAttendance()
            ]);


            students =
                studentResult && studentResult.success !== false
                    ? (studentResult.data || [])
                    : [];

            jurnals =
                jurnalResult && jurnalResult.success !== false
                    ? (jurnalResult.data || [])
                    : [];

            leaves =
                leaveResult && leaveResult.success !== false
                    ? (leaveResult.data || [])
                    : [];

            izinList =
                izinResult && izinResult.success !== false
                    ? (izinResult.data || [])
                    : [];

            attendances =
                attResult && attResult.success !== false
                    ? (attResult.data || [])
                    : [];


        } catch (error) {

            console.error(
                'Error loading report data:',
                error
            );


            // Fallback untuk mode lokal
            students =
                storage.get(
                    'admin_students',
                    []
                );

            jurnals =
                storage.get(
                    'jurnals',
                    []
                );

            leaves =
                storage.get(
                    'leaves',
                    []
                );

            izinList =
                storage.get(
                    'izin',
                    []
                );

            attendances =
                storage.get(
                    'attendance',
                    []
                );
        }


        // Simpan raw data
        this.rawStudents = students;
        this.rawEmployees = students;

        this.rawAttendance = attendances;
        this.rawJournals = jurnals;
        this.rawLeaves = leaves;
        this.rawIzin = izinList;


        // ==================================================
        // ATTENDANCE DATA
        // ==================================================

        this.buildAttendanceData();


        // ==================================================
        // JURNAL DATA
        // ==================================================

        this.jurnalData = jurnals.map(j => {

            const student = students.find(
                s =>
                    String(s.id) ===
                    String(j.userId)
            );


            return {

                date: this.normalizeDate(j.date),

                userId: j.userId,

                name:
                    student
                        ? student.name
                        : 'Mahasiswa',

                department:
                    student
                        ? (student.department || '-')
                        : '-',

                tasks:
                    j.tasks || '-',

                achievements:
                    j.achievements || '-',

                obstacles:
                    j.obstacles || '-',

                plan:
                    j.plan || '-',

                photo:
                    j.photo || null,

                status:
                    j.tasks
                        ? 'filled'
                        : 'empty',

                updatedAt:
                    j.updatedAt
            };
        });


        // ==================================================
        // LEAVE / IZIN DATA
        // ==================================================

        this.leaveData = [

            ...leaves.map(l => {

                const student =
                    students.find(
                        s =>
                            String(s.id) ===
                            String(l.userId)
                    );


                return {

                    userId:
                        l.userId,

                    name:
                        student
                            ? student.name
                            : 'Mahasiswa',

                    department:
                        student
                            ? (student.department || '-')
                            : '-',

                    type:
                        l.type === 'annual'
                            ? 'Cuti'
                            : (l.typeLabel || l.type || 'Cuti'),

                    dates:
                        l.startDate === l.endDate
                            ? this.normalizeDate(l.startDate)
                            : `${this.normalizeDate(l.startDate)} - ${this.normalizeDate(l.endDate)}`,

                    duration:
                        l.duration || 1,

                    reason:
                        l.reason || '-',

                    status:
                        l.status,

                    date:
                        this.normalizeDate(l.startDate)
                };
            }),


            ...izinList.map(i => {

                const student =
                    students.find(
                        s =>
                            String(s.id) ===
                            String(i.userId)
                    );


                return {

                    userId:
                        i.userId,

                    name:
                        student
                            ? student.name
                            : 'Mahasiswa',

                    department:
                        student
                            ? (student.department || '-')
                            : '-',

                    type:
                        'Izin',

                    dates:
                        this.normalizeDate(i.date),

                    duration:
                        i.duration || 1,

                    reason:
                        i.reason || '-',

                    status:
                        i.status,

                    date:
                        this.normalizeDate(i.date)
                };
            })
        ];
    },


    // ==================================================
    // BUILD ATTENDANCE SUMMARY
    // ==================================================

    buildAttendanceData() {

        const students =
            this.rawStudents || [];

        const attendances =
            this.rawAttendance || [];

        const leaves =
            this.rawLeaves || [];

        const izinList =
            this.rawIzin || [];


        this.attendanceData =
            students.map(student => {

                const studentId =
                    String(student.id);


                // ------------------------------------------
                // Attendance
                // ------------------------------------------

                const studentAttendance =
                    attendances.filter(
                        a =>
                            String(a.userId) ===
                            studentId
                    );


                let present = 0;
                let late = 0;


                studentAttendance.forEach(a => {

                    if (a.clockIn) {

                        present++;

                        if (
                            String(a.status || '')
                                .toLowerCase() ===
                            'terlambat'
                        ) {
                            late++;
                        }
                    }
                });


                // ------------------------------------------
                // Approved leave
                // ------------------------------------------

                const studentLeaves =
                    leaves.filter(
                        l =>
                            String(l.userId) ===
                                studentId &&
                            String(l.status)
                                .toLowerCase() ===
                                'approved'
                    );


                // ------------------------------------------
                // Approved izin
                // ------------------------------------------

                const studentIzin =
                    izinList.filter(
                        i =>
                            String(i.userId) ===
                                studentId &&
                            String(i.status)
                                .toLowerCase() ===
                                'approved'
                    );


                let absent = 0;


                studentLeaves.forEach(l => {

                    absent +=
                        parseInt(
                            l.duration,
                            10
                        ) || 1;
                });


                studentIzin.forEach(i => {

                    absent +=
                        parseInt(
                            i.duration,
                            10
                        ) || 1;
                });


                return {

                    id:
                        student.id,

                    name:
                        student.name || '-',

                    department:
                        student.department || '-',

                    present:
                        present,

                    late:
                        late,

                    absent:
                        absent,

                    total:
                        present + absent
                };
            });
    },


    // ==================================================
    // STUDENT FILTER
    // ==================================================

    populateEmployeeFilter() {

        const students =
            this.rawStudents || [];

        const select =
            document.getElementById(
                'jurnal-employee-filter'
            );


        if (!select) {
            return;
        }


        select.innerHTML =
            '<option value="">Semua Mahasiswa</option>' +

            students
                .map(student =>
                    `<option value="${student.name}">
                        ${student.name}
                    </option>`
                )
                .join('');
    },


    // ==================================================
    // ATTENDANCE EVENTS
    // ==================================================

    bindAttendanceEvents() {

        const exportBtn =
            document.getElementById(
                'btn-export-attendance'
            );


        if (exportBtn) {

            exportBtn.onclick = () =>
                this.exportToExcel(
                    'attendance'
                );
        }


        const printBtn =
            document.getElementById(
                'btn-print-attendance'
            );


        if (printBtn) {

            printBtn.onclick = () =>
                this.printReport(
                    'attendance'
                );
        }


        // Month
        const monthFilter =
            document.getElementById(
                'attendance-month'
            );


        if (monthFilter) {

            monthFilter.onchange = e => {

                this.filters.attendance.month =
                    e.target.value;

                this.renderAttendanceReports();
            };
        }


        // Department
        const deptFilter =
            document.getElementById(
                'report-dept-filter'
            );


        if (deptFilter) {

            deptFilter.onchange = e => {

                this.filters.attendance.dept =
                    e.target.value;

                this.renderAttendanceReports();
            };
        }


        // Status
        const statusFilter =
            document.getElementById(
                'report-status-filter'
            );


        if (statusFilter) {

            statusFilter.onchange = e => {

                this.filters.attendance.status =
                    e.target.value;

                this.renderAttendanceReports();
            };
        }
    },


    // ==================================================
    // JURNAL EVENTS
    // ==================================================

    bindJurnalEvents() {

        const exportBtn =
            document.getElementById(
                'btn-export-jurnal'
            );


        const printBtn =
            document.getElementById(
                'btn-print-jurnal'
            );


        if (exportBtn) {

            exportBtn.onclick = () =>
                this.exportToExcel(
                    'jurnal'
                );
        }


        if (printBtn) {

            printBtn.onclick = () =>
                this.printReport(
                    'jurnal'
                );
        }


        const monthFilter =
            document.getElementById(
                'jurnal-month'
            );


        if (monthFilter) {

            monthFilter.onchange = e => {

                this.filters.jurnal.month =
                    e.target.value;

                this.renderJurnalReports();
            };
        }


        const empFilter =
            document.getElementById(
                'jurnal-employee-filter'
            );


        if (empFilter) {

            empFilter.onchange = e => {

                this.filters.jurnal.employee =
                    e.target.value;

                this.renderJurnalReports();
            };
        }


        const statusFilter =
            document.getElementById(
                'jurnal-status-filter'
            );


        if (statusFilter) {

            statusFilter.onchange = e => {

                this.filters.jurnal.status =
                    e.target.value;

                this.renderJurnalReports();
            };
        }
    },


    // ==================================================
    // LEAVE EVENTS
    // ==================================================

    bindLeaveEvents() {

        const exportBtn =
            document.getElementById(
                'btn-export-leave'
            );


        const printBtn =
            document.getElementById(
                'btn-print-leave'
            );


        if (exportBtn) {

            exportBtn.onclick = () =>
                this.exportToExcel(
                    'leave'
                );
        }


        if (printBtn) {

            printBtn.onclick = () =>
                this.printReport(
                    'leave'
                );
        }


        const monthFilter =
            document.getElementById(
                'leave-month'
            );


        if (monthFilter) {

            monthFilter.onchange = e => {

                this.filters.leave.month =
                    e.target.value;

                this.renderLeaveReports();
            };
        }


        const typeFilter =
            document.getElementById(
                'leave-type-filter'
            );


        if (typeFilter) {

            typeFilter.onchange = e => {

                this.filters.leave.type =
                    e.target.value;

                this.renderLeaveReports();
            };
        }


        const statusFilter =
            document.getElementById(
                'leave-status-filter'
            );


        if (statusFilter) {

            statusFilter.onchange = e => {

                this.filters.leave.status =
                    e.target.value;

                this.renderLeaveReports();
            };
        }
    },


    // ==================================================
    // FILTER ATTENDANCE
    // ==================================================

    getFilteredAttendance() {

        const filter =
            this.filters.attendance;


        return this.attendanceData.filter(row => {

            const matchesDept =
                !filter.dept ||
                row.department ===
                    filter.dept;


            const matchesStatus =
                !filter.status ||

                (
                    filter.status ===
                    'present' &&
                    row.present > 0
                ) ||

                (
                    filter.status ===
                    'absent' &&
                    row.absent > 0
                ) ||

                (
                    filter.status ===
                    'late' &&
                    row.late > 0
                );


            return (
                matchesDept &&
                matchesStatus
            );
        });
    },


    // ==================================================
    // ATTENDANCE PERIOD SUMMARY
    // ==================================================

    getAttendanceSummaryByFilter() {

        const month =
            this.filters.attendance.month;


        const attendances =
            this.rawAttendance || [];


        const leaves =
            this.rawLeaves || [];


        const izinList =
            this.rawIzin || [];


        const students =
            this.rawStudents || [];


        return students.map(student => {

            const studentId =
                String(student.id);


            // Attendance pada bulan yang dipilih
            const studentAttendance =
                attendances.filter(a => {

                    const sameStudent =
                        String(a.userId) ===
                        studentId;

                    if (!sameStudent) {
                        return false;
                    }

                    if (!month) {
                        return true;
                    }

                    return (
                        this.getMonthFromDate(
                            a.date
                        ) === month
                    );
                });


            let present = 0;
            let late = 0;


            studentAttendance.forEach(a => {

                if (a.clockIn) {

                    present++;

                    if (
                        String(a.status || '')
                            .toLowerCase() ===
                        'terlambat'
                    ) {
                        late++;
                    }
                }
            });


            // Approved leaves
            const studentLeaves =
                leaves.filter(l => {

                    if (
                        String(l.userId) !==
                        studentId
                    ) {
                        return false;
                    }

                    if (
                        String(l.status)
                            .toLowerCase() !==
                        'approved'
                    ) {
                        return false;
                    }

                    if (!month) {
                        return true;
                    }

                    return (
                        this.getMonthFromDate(
                            l.startDate
                        ) === month
                    );
                });


            // Approved izin
            const studentIzin =
                izinList.filter(i => {

                    if (
                        String(i.userId) !==
                        studentId
                    ) {
                        return false;
                    }

                    if (
                        String(i.status)
                            .toLowerCase() !==
                        'approved'
                    ) {
                        return false;
                    }

                    if (!month) {
                        return true;
                    }

                    return (
                        this.getMonthFromDate(
                            i.date
                        ) === month
                    );
                });


            let absent = 0;


            studentLeaves.forEach(l => {

                absent +=
                    parseInt(
                        l.duration,
                        10
                    ) || 1;
            });


            studentIzin.forEach(i => {

                absent +=
                    parseInt(
                        i.duration,
                        10
                    ) || 1;
            });


            return {

                id:
                    student.id,

                name:
                    student.name || '-',

                department:
                    student.department || '-',

                present:
                    present,

                late:
                    late,

                absent:
                    absent,

                total:
                    present + absent
            };
        });
    },


    // ==================================================
    // FILTER JURNAL
    // ==================================================

    getFilteredJurnal() {

        const filter =
            this.filters.jurnal;


        return this.jurnalData.filter(row => {

            const matchesMonth =
                !filter.month ||
                this.getMonthFromDate(
                    row.date
                ) === filter.month;


            const matchesEmp =
                !filter.employee ||
                row.name ===
                    filter.employee;


            const matchesStatus =
                !filter.status ||
                row.status ===
                    filter.status;


            return (
                matchesMonth &&
                matchesEmp &&
                matchesStatus
            );
        });
    },


    // ==================================================
    // FILTER LEAVE
    // ==================================================

    getFilteredLeave() {

        const filter =
            this.filters.leave;


        return this.leaveData.filter(row => {

            const matchesMonth =
                !filter.month ||
                this.getMonthFromDate(
                    row.date
                ) === filter.month;


            const matchesType =
                !filter.type ||

                (
                    filter.type === 'cuti' &&
                    row.type
                        .toLowerCase()
                        .includes('cuti')
                ) ||

                (
                    filter.type === 'izin' &&
                    row.type
                        .toLowerCase()
                        .includes('izin')
                ) ||

                (
                    filter.type === 'sakit' &&
                    row.type
                        .toLowerCase()
                        .includes('sakit')
                );


            const matchesStatus =
                !filter.status ||
                row.status ===
                    filter.status;


            return (
                matchesMonth &&
                matchesType &&
                matchesStatus
            );
        });
    },


    // ==================================================
    // RENDER ATTENDANCE
    // ==================================================

    renderAttendanceReports() {

        const tbody =
            document.getElementById(
                'attendance-reports-body'
            );


        if (!tbody) {
            return;
        }


        // IMPORTANT:
        // Gunakan summary berdasarkan bulan,
        // bukan summary seluruh data.
        let data =
            this.getAttendanceSummaryByFilter();


        // Department
        const dept =
            this.filters.attendance.dept;


        if (dept) {

            data =
                data.filter(
                    row =>
                        row.department ===
                        dept
                );
        }


        // Status
        const status =
            this.filters.attendance.status;


        if (status) {

            data =
                data.filter(row => {

                    if (
                        status === 'present'
                    ) {
                        return row.present > 0;
                    }

                    if (
                        status === 'absent'
                    ) {
                        return row.absent > 0;
                    }

                    if (
                        status === 'late'
                    ) {
                        return row.late > 0;
                    }

                    return true;
                });
        }


        // --------------------------------------------------
        // TABLE
        // --------------------------------------------------

        tbody.innerHTML =
            data.map(row => `

                <tr>

                    <td>

                        <div class="employee-info">

                            <div class="employee-details">

                                <span class="employee-name">
                                    ${row.name}
                                </span>

                            </div>

                        </div>

                    </td>


                    <td>
                        ${row.department}
                    </td>


                    <td
                        class="text-center"
                        style="
                            color: var(--color-success);
                            font-weight: 600;
                        "
                    >
                        ${row.present}
                    </td>


                    <td
                        class="text-center"
                        style="
                            color: var(--color-warning);
                            font-weight: 600;
                        "
                    >
                        ${row.late}
                    </td>


                    <td
                        class="text-center"
                        style="
                            color: var(--color-danger);
                            font-weight: 600;
                        "
                    >
                        ${row.absent}
                    </td>


                    <td
                        class="text-center"
                    >
                        ${row.total}
                    </td>


                    <td>

                        <button
                            class="btn-action view"
                            onclick="adminReports.viewDetail('${row.name}')"
                        >

                            <i class="fas fa-eye"></i>

                        </button>

                    </td>

                </tr>

            `).join('');


        // --------------------------------------------------
        // EMPTY STATE
        // --------------------------------------------------

        if (data.length === 0) {

            tbody.innerHTML = `

                <tr>

                    <td
                        colspan="7"
                        class="text-center"
                    >
                        Belum ada data kehadiran.
                    </td>

                </tr>

            `;
        }


        // --------------------------------------------------
        // MOBILE
        // --------------------------------------------------

        const mobileContainer =
            document.getElementById(
                'attendance-mobile-cards'
            );


        if (mobileContainer) {

            mobileContainer.innerHTML =
                data.map(row => `

                    <div class="mobile-card">

                        <div class="mobile-card-header">

                            <span
                                class="mobile-card-title"
                            >
                                ${row.name}
                            </span>

                            <span
                                style="
                                    font-size:
                                    var(--font-size-xs);
                                    color:
                                    var(--text-muted);
                                "
                            >
                                ${row.department}
                            </span>

                        </div>


                        <div class="mobile-card-row">

                            <span
                                class="mobile-card-label"
                            >
                                Hadir
                            </span>

                            <span
                                class="mobile-card-value"
                                style="
                                    color:
                                    var(--color-success);
                                "
                            >
                                ${row.present}
                            </span>

                        </div>


                        <div class="mobile-card-row">

                            <span
                                class="mobile-card-label"
                            >
                                Terlambat
                            </span>

                            <span
                                class="mobile-card-value"
                                style="
                                    color:
                                    var(--color-warning);
                                "
                            >
                                ${row.late}
                            </span>

                        </div>


                        <div class="mobile-card-row">

                            <span
                                class="mobile-card-label"
                            >
                                Izin/Cuti
                            </span>

                            <span
                                class="mobile-card-value"
                                style="
                                    color:
                                    var(--color-danger);
                                "
                            >
                                ${row.absent}
                            </span>

                        </div>


                        <div class="mobile-card-row">

                            <span
                                class="mobile-card-label"
                            >
                                Total
                            </span>

                            <span
                                class="mobile-card-value"
                            >
                                ${row.total}
                            </span>

                        </div>

                    </div>

                `).join('');
        }
    },


    // ==================================================
    // RENDER JURNAL
    // ==================================================

    renderJurnalReports() {

        const tbody =
            document.getElementById(
                'jurnal-reports-body'
            );


        if (!tbody) {
            return;
        }


        const data =
            this.getFilteredJurnal();


        tbody.innerHTML =
            data.map(row => `

                <tr>

                    <td>
                        ${row.date}
                    </td>

                    <td>
                        ${row.name}
                    </td>

                    <td>
                        ${row.department}
                    </td>

                    <td>
                        ${row.tasks.substring(
                            0,
                            30
                        )}
                        ${row.tasks.length > 30
                            ? '...'
                            : ''}
                    </td>

                    <td>

                        ${
                            row.photo

                            ? `
                                <img
                                    src="${row.photo}"
                                    class="jurnal-thumbnail"
                                    onclick="adminReports.viewPhoto('${row.photo}')"
                                    title="Klik untuk melihat"
                                >
                              `

                            : `
                                <span
                                    class="no-photo-cell"
                                >
                                    -
                                </span>
                              `
                        }

                    </td>

                    <td>

                        <span
                            class="status-badge ${row.status}"
                        >
                            ${
                                row.status === 'filled'
                                    ? 'Terisi'
                                    : 'Kosong'
                            }
                        </span>

                    </td>

                    <td>

                        <button
                            class="btn-action view"
                            onclick="adminReports.viewJurnalDetail('${row.name}', '${row.date}')"
                        >

                            <i class="fas fa-eye"></i>

                        </button>

                    </td>

                </tr>

            `).join('');


        if (data.length === 0) {

            tbody.innerHTML = `

                <tr>

                    <td
                        colspan="7"
                        class="text-center"
                    >
                        Belum ada data jurnal.
                    </td>

                </tr>

            `;
        }
    },


    // ==================================================
    // RENDER LEAVE
    // ==================================================

    renderLeaveReports() {

        const tbody =
            document.getElementById(
                'leave-reports-body'
            );


        if (!tbody) {
            return;
        }


        const data =
            this.getFilteredLeave();


        const statusLabels = {

            pending:
                'Menunggu',

            approved:
                'Disetujui',

            rejected:
                'Ditolak'
        };


        tbody.innerHTML =
            data.map(row => `

                <tr>

                    <td>
                        ${row.name}
                    </td>

                    <td>
                        ${row.department}
                    </td>

                    <td>
                        ${row.type}
                    </td>

                    <td>
                        ${row.dates}
                    </td>

                    <td>
                        ${row.duration} hari
                    </td>

                    <td>
                        ${row.reason}
                    </td>

                    <td>

                        <span
                            class="status-badge ${row.status}"
                        >
                            ${
                                statusLabels[
                                    row.status
                                ] || row.status
                            }
                        </span>

                    </td>

                    <td>

                        <button
                            class="btn-action view"
                            onclick="adminReports.viewLeaveDetail('${row.name}')"
                        >

                            <i class="fas fa-eye"></i>

                        </button>

                    </td>

                </tr>

            `).join('');


        if (data.length === 0) {

            tbody.innerHTML = `

                <tr>

                    <td
                        colspan="8"
                        class="text-center"
                    >
                        Belum ada data cuti/izin.
                    </td>

                </tr>

            `;
        }
    },


    // ==================================================
    // EXPORT
    // ==================================================

    exportToExcel(type) {

        let data = [];
        let filename = '';


        switch (type) {

            case 'attendance':

                data =
                    this.getAttendanceSummaryByFilter();

                filename =
                    'Rekap_Absensi_Mahasiswa.csv';

                break;


            case 'jurnal':

                data =
                    this.getFilteredJurnal();

                filename =
                    'Rekap_Jurnal_Mahasiswa.csv';

                break;


            case 'leave':

                data =
                    this.getFilteredLeave();

                filename =
                    'Rekap_Cuti_Izin_Mahasiswa.csv';

                break;
        }


        if (!data.length) {

            toast.error(
                'Tidak ada data untuk diexport.'
            );

            return;
        }


        const csv =
            this.convertToCSV(data);


        this.downloadFile(
            csv,
            filename,
            'text/csv;charset=utf-8;'
        );


        toast.success(
            `Data berhasil diexport ke ${filename}`
        );
    },


    convertToCSV(data) {

        if (!data.length) {
            return '';
        }


        const headers =
            Object.keys(data[0]);


        const rows =
            data.map(row =>

                headers.map(header => {

                    let val =
                        row[header];

                    if (
                        val === null ||
                        val === undefined
                    ) {
                        val = '';
                    }

                    val =
                        String(val)
                            .replace(
                                /"/g,
                                '""'
                            );


                    return `"${val}"`;

                }).join(',')
            );


        return [
            headers.join(','),
            ...rows
        ].join('\n');
    },


    downloadFile(
        content,
        filename,
        contentType
    ) {

        const blob =
            new Blob(
                [content],
                {
                    type: contentType
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                'a'
            );


        link.href = url;
        link.download = filename;


        document.body.appendChild(
            link
        );


        link.click();


        document.body.removeChild(
            link
        );


        URL.revokeObjectURL(
            url
        );
    },


    printReport(type) {

        window.print();
    },


    // ==================================================
    // DETAIL
    // ==================================================

    viewDetail(name) {

        const student =
            this.rawStudents.find(
                s => s.name === name
            );


        if (!student) {

            toast.info(
                `Detail untuk ${name}`
            );

            return;
        }


        const attendance =
            this.rawAttendance.filter(
                a =>
                    String(a.userId) ===
                    String(student.id)
            );


        const content = `

            <div class="jurnal-detail-content">

                <div class="detail-row">
                    <label>Nama:</label>
                    <p>${student.name}</p>
                </div>

                <div class="detail-row">
                    <label>Departemen:</label>
                    <p>${student.department || '-'}</p>
                </div>

                <div class="detail-row">
                    <label>Total Rekaman Absensi:</label>
                    <p>${attendance.length}</p>
                </div>

            </div>

        `;


        modal.show(
            'Detail Kehadiran',
            content,
            [
                {
                    label:
                        'Tutup',

                    class:
                        'btn-secondary',

                    onClick:
                        () => modal.close()
                }
            ]
        );
    },


    viewJurnalDetail(name, date) {

        const jurnal =
            this.jurnalData.find(
                j =>
                    j.name === name &&
                    j.date === date
            );


        if (!jurnal) {

            toast.error(
                'Data jurnal tidak ditemukan'
            );

            return;
        }


        const photoHtml =
            jurnal.photo

                ? `

                    <div
                        class="detail-photo-section"
                    >

                        <label>
                            Foto Lampiran:
                        </label>

                        <img
                            src="${jurnal.photo}"
                            alt="Foto jurnal"
                            class="jurnal-photo-preview"
                            onclick="window.open('${jurnal.photo}', '_blank')"
                        >

                    </div>

                  `

                : `

                    <div
                        class="detail-photo-section"
                    >

                        <label>
                            Foto Lampiran:
                        </label>

                        <p class="no-photo">
                            Tidak ada foto
                        </p>

                    </div>

                  `;


        const content = `

            <div
                class="jurnal-detail-content"
            >

                <div class="detail-row">

                    <label>
                        Nama:
                    </label>

                    <p>
                        ${jurnal.name}
                    </p>

                </div>


                <div class="detail-row">

                    <label>
                        Departemen:
                    </label>

                    <p>
                        ${jurnal.department}
                    </p>

                </div>


                <div class="detail-row">

                    <label>
                        Tanggal:
                    </label>

                    <p>
                        ${dateTime.formatDate(
                            new Date(jurnal.date),
                            'long'
                        )}
                    </p>

                </div>


                <div class="detail-section">

                    <label>
                        Tugas:
                    </label>

                    <p>
                        ${jurnal.tasks.replace(
                            /\n/g,
                            '<br>'
                        )}
                    </p>

                </div>


                <div class="detail-section">

                    <label>
                        Pencapaian:
                    </label>

                    <p>
                        ${jurnal.achievements.replace(
                            /\n/g,
                            '<br>'
                        )}
                    </p>

                </div>


                <div class="detail-section">

                    <label>
                        Kendala:
                    </label>

                    <p>
                        ${jurnal.obstacles.replace(
                            /\n/g,
                            '<br>'
                        )}
                    </p>

                </div>


                <div class="detail-section">

                    <label>
                        Rencana:
                    </label>

                    <p>
                        ${jurnal.plan.replace(
                            /\n/g,
                            '<br'
                        )}
                    </p>

                </div>


                ${photoHtml}

            </div>

        `;


        modal.show(
            'Detail Jurnal',
            content,
            [
                {
                    label:
                        'Tutup',

                    class:
                        'btn-secondary',

                    onClick:
                        () => modal.close()
                }
            ]
        );
    },


    viewPhoto(photoUrl) {

        if (!photoUrl) {
            return;
        }


        const content = `

            <div
                class="photo-viewer-modal"
            >

                <img
                    src="${photoUrl}"
                    alt="Foto jurnal"
                    class="full-photo"
                >

            </div>

        `;


        modal.show(
            'Foto Lampiran',
            content,
            [

                {
                    label:
                        'Tutup',

                    class:
                        'btn-secondary',

                    onClick:
                        () => modal.close()
                },


                {
                    label:
                        'Buka di Tab Baru',

                    class:
                        'btn-primary',

                    onClick:
                        () =>
                            window.open(
                                photoUrl,
                                '_blank'
                            )
                }
            ]
        );
    },


    viewLeaveDetail(name) {

        const row =
            this.leaveData.find(
                l => l.name === name
            );


        if (!row) {

            toast.info(
                `Detail cuti/izin ${name}`
            );

            return;
        }


        const content = `

            <div class="jurnal-detail-content">

                <div class="detail-row">
                    <label>Nama:</label>
                    <p>${row.name}</p>
                </div>

                <div class="detail-row">
                    <label>Jenis:</label>
                    <p>${row.type}</p>
                </div>

                <div class="detail-row">
                    <label>Tanggal:</label>
                    <p>${row.dates}</p>
                </div>

                <div class="detail-row">
                    <label>Durasi:</label>
                    <p>${row.duration} hari</p>
                </div>

                <div class="detail-section">
                    <label>Alasan:</label>
                    <p>${row.reason}</p>
                </div>

            </div>

        `;


        modal.show(
            'Detail Cuti / Izin',
            content,
            [
                {
                    label:
                        'Tutup',

                    class:
                        'btn-secondary',

                    onClick:
                        () => modal.close()
                }
            ]
        );
    }
};


// ==================================================
// GLOBAL INIT FUNCTIONS
// ==================================================

window.initAttendanceReports = () => {

    adminReports.initAttendanceReports();

};


window.initJurnalReports = () => {

    adminReports.initJurnalReports();

};


window.initLeaveReports = () => {

    adminReports.initLeaveReports();

};


// ==================================================
// EXPOSE
// ==================================================

window.adminReports =
    adminReports;
