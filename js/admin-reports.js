/**
 * Portal Mahasiswa - Admin Reports
 * Reports and exports for admin
 */

const adminReports = {
    attendanceData: [],
    jurnalData: [],
    leaveData: [],
    filters: {
        attendance: { month: '', dept: '', status: '' },
        jurnal: { month: '', employee: '', status: '' },
        leave: { month: '', type: '', status: '' }
    },

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

    async loadData() {
        let employees = [];
        let jurnals = [];
        let leaves = [];
        let izinList = [];
        let attendances = [];

        try {
            const [empResult, journalResult, leaveResult, izinResult, attResult, settingsResult] = await Promise.all([
                api.getEmployees(),
                api.getAllJournals(),
                api.getAllLeaves(),
                api.getAllIzin(),
                api.getAllAttendance(),
                api.getSettings()
            ]);
            employees = empResult.data || [];
            jurnals = journalResult.data || [];
            leaves = leaveResult.data || [];
            izinList = izinResult.data || [];
            attendances = attResult.data || [];

            this.settings = settingsResult.data || {};
        } catch (error) {
            console.error('Error loading report data:', error);
            employees = storage.get('admin_employees', []);
            jurnals = storage.get('jurnals', []);
            leaves = storage.get('leaves', []);
            izinList = storage.get('izin', []);
            attendances = storage.get('attendance', []);
        }

        this.rawAttendance = attendances;
        this.rawEmployees = employees;
        this.rawLeaves = leaves;
        this.rawIzin = izinList;

        this.attendanceData = employees.map(emp => ({
            userId: emp.id,
            name: emp.name,
            department: emp.department,
            present: 0,
            late: 0,
            absent: 0,
            total: 0
        }));

        const currentUser = auth.getCurrentUser();

        this.jurnalData = jurnals.map(j => {
            let emp = employees.find(e => e.id === j.userId);
            if (!emp && currentUser) {
                emp = { name: currentUser.name };
            }
            if (!emp) {
                emp = { name: 'Mahasiswa' };
            }
            return {
                date: j.date,
                name: emp.name,
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
    },

    getFilteredJurnal() {
        return this.jurnalData.filter(row => {
            const matchesEmp = !this.filters.jurnal.employee || row.name === this.filters.jurnal.employee;
            const matchesStatus = !this.filters.jurnal.status || row.status === this.filters.jurnal.status;
            return matchesEmp && matchesStatus;
        });
    },

    renderJurnalReports() {
        const tbody = document.getElementById('jurnal-reports-body');
        if (!tbody) return;

        const data = this.getFilteredJurnal();

        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.date}</td>
                <td>${row.name}</td>
                <td>${row.tasks.substring(0, 30)}${row.tasks.length > 30 ? '...' : ''}</td>
                <td>${row.photo ? `<img src="${row.photo}" class="jurnal-thumbnail">` : '<span>-</span>'}</td>
                <td>${row.status === 'filled' ? 'Terisi' : 'Kosong'}</td>
                <td>
                    <button class="btn-action view" onclick="adminReports.viewJurnalDetail('${row.name}', '${row.date}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    viewJurnalDetail(name, date) {
        const jurnal = this.jurnalData.find(j => j.name === name && j.date === date);
        if (!jurnal) return;

        const content = `
            <div class="jurnal-detail-content">
                <div class="detail-row">
                    <label>Nama:</label>
                    <p>${jurnal.name}</p>
                </div>
                <div class="detail-row">
                    <label>Tanggal:</label>
                    <p>${dateTime.formatDate(new Date(jurnal.date), 'long')}</p>
                </div>
            </div>
        `;

        modal.show('Detail Jurnal', content, [
            { label: 'Tutup', class: 'btn-secondary', onClick: () => modal.close() }
        ]);
    }
};

window.initJurnalReports = () => {
    adminReports.initJurnalReports();
};

window.adminReports = adminReports;
