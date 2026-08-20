/**
 * Portal Mahasiswa - Admin Dashboard
 * Admin dashboard with campus attendance distribution
 */

const adminDashboard = {
    initialized: false,

    async init() {
        if (this.initialized) return;
        await new Promise(resolve => setTimeout(resolve, 500));
        const user = auth.getCurrentUser();
        if (!user || user.role !== 'admin') {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }
        try {
            await this.loadData();
            this.updateStats();
            this.renderRecentActivity();
            this.renderOnlineUsers();
            this.renderCampusAttendanceChart();
            this.initialized = true;
        } catch (error) {
            console.error('Dashboard init error:', error);
            toast.error('Gagal memuat dashboard');
        }
    },

    async loadData() {
        try {
            const [studentResult, attResult, leaveResult, izinResult] = await Promise.all([
                api.getStudents(),
                api.getAllAttendance(),
                api.getAllLeaves(),
                api.getAllIzin()
            ]);
            this.employees = studentResult.data || [];
            this.attendance = attResult.data || [];
            this.leaves = leaveResult.data || [];
            this.izin = izinResult.data || [];
            this.updateStats();
        } catch (error) {
            console.error('Error loading admin data:', error);
            this.employees = storage.get('admin_employees', []);
            this.attendance = storage.get('attendance', []);
            this.leaves = storage.get('leaves', []);
            this.izin = storage.get('izin', []);
            this.updateStats();
        }
    },

    updateStats() {
        const totalEmployees = this.employees.length;
        const todayStr = dateTime.getLocalDate();
        const todayAttendance = this.attendance.filter(a => a.date === todayStr);
        let presentToday = 0;
        let lateToday = 0;
        todayAttendance.forEach(att => {
            if (att.clockIn) {
                presentToday++;
                if (att.status && att.status.toLowerCase() === 'terlambat') lateToday++;
            }
        });
        const onLeave = this.leaves.filter(l => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr).length +
            this.izin.filter(i => i.status === 'approved' && i.date === todayStr).length;
        const absentToday = Math.max(0, totalEmployees - presentToday - onLeave);
        const pendingLeaves = this.leaves.filter(l => l.status === 'pending').length;
        const pendingIzin = this.izin.filter(i => i.status === 'pending').length;
        const els = {
            'total-employees': totalEmployees,
            'present-today': presentToday,
            'absent-today': absentToday,
            'late-today': lateToday,
            'on-leave': onLeave,
            'pending-requests': pendingLeaves + pendingIzin
        };
        Object.entries(els).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) this.animateNumber(el, parseInt(el.textContent) || 0, value);
        });
    },

    animateNumber(element, start, end) {
        const duration = 1000;
        const startTime = performance.now();
        const animate = currentTime => {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            element.textContent = Math.floor(start + (end - start) * easeOutQuart);
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    },

    campusOf(employee) {
        return employee?.kampus || employee?.campus || 'Kampus belum diisi';
    },

    personMatches(a, b) {
        const keys = ['id', 'userId', 'userID', 'studentId', 'studentID', 'employeeId', 'employeeID', 'nim', 'NIM', 'email', 'Email'];
        for (const key of keys) {
            const av = String(a?.[key] ?? '').trim().toLowerCase();
            const bv = String(b?.[key] ?? '').trim().toLowerCase();
            if (av && bv && av === bv) return true;
        }
        const an = String(a?.name || a?.nama || '').trim().toLowerCase();
        const bn = String(b?.name || b?.nama || '').trim().toLowerCase();
        return !!an && an === bn;
    },

    renderCampusAttendanceChart() {
        const container = document.getElementById('admin-dept-chart');
        if (!container) return;
        const today = dateTime.getLocalDate();
        const campusMap = {};

        (this.employees || []).forEach(student => {
            const campus = this.campusOf(student);
            if (!campusMap[campus]) campusMap[campus] = { total: 0, hadir: 0 };
            campusMap[campus].total++;
            const attended = (this.attendance || []).some(a => this.personMatches(student, a) && a.date === today && a.clockIn);
            if (attended) campusMap[campus].hadir++;
        });

        const rows = Object.entries(campusMap).sort((a, b) => b[1].hadir - a[1].hadir);
        if (!rows.length) {
            container.innerHTML = `<div class="chart-placeholder"><i class="fas fa-building-columns"></i><p>Belum ada data distribusi kehadiran per kampus</p></div>`;
            return;
        }

        const max = Math.max(...rows.map(([, v]) => v.hadir), 1);
        container.innerHTML = `
            <div style="padding:24px;width:100%;box-sizing:border-box;">
                ${rows.map(([campus, value]) => {
                    const percent = Math.round((value.hadir / max) * 100);
                    return `
                        <div style="margin-bottom:18px;">
                            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:7px;">
                                <span style="font-weight:600;color:var(--text-primary);">${campus}</span>
                                <span style="font-weight:600;color:var(--text-secondary);">${value.hadir} hadir / ${value.total}</span>
                            </div>
                            <div style="height:10px;background:#eef2f7;border-radius:999px;overflow:hidden;">
                                <div style="height:100%;width:${percent}%;background:#f59e0b;border-radius:999px;"></div>
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
    },

    renderRecentActivity() {
        const container = document.getElementById('admin-recent-activity');
        if (!container) return;
        const activities = [
            { user: 'Ahmad Rizky', action: 'Clock In', time: '5 menit yang lalu' },
            { user: 'Budi Santoso', action: 'Mengajukan Cuti', time: '15 menit yang lalu' },
            { user: 'Citra Dewi', action: 'Mengisi Jurnal', time: '30 menit yang lalu' },
            { user: 'Dedi Pratama', action: 'Clock Out', time: '1 jam yang lalu' },
            { user: 'Eka Putri', action: 'Izin Sakit', time: '2 jam yang lalu' }
        ];
        container.innerHTML = activities.map(act => `
            <div class="activity-item">
                <div class="activity-avatar"><img src="${getAvatarUrl(act)}" alt="${act.user}"></div>
                <div class="activity-content"><p class="activity-text"><strong>${act.user}</strong> ${act.action}</p><span class="activity-time">${act.time}</span></div>
            </div>`).join('');
    },

    renderOnlineUsers() {
        const container = document.getElementById('admin-online-users');
        if (!container) return;
        const onlineUsers = (this.employees || []).filter(e => e.status === 'active').slice(0, 5);
        const countEl = document.getElementById('online-count');
        if (countEl) countEl.textContent = onlineUsers.length;
        container.innerHTML = onlineUsers.map(user => `
            <div class="online-user-item">
                <div class="user-status-dot"></div>
                <div class="activity-avatar"><img src="${getAvatarUrl(user)}" alt="${user.name}"></div>
                <div class="activity-content"><p class="activity-text"><strong>${user.name}</strong></p><span class="activity-time">${this.campusOf(user)} - ${user.prodi || user.jurusan || user.position || '-'}</span></div>
            </div>`).join('');
    },

    initCharts() {
        const attendanceChart = document.getElementById('admin-attendance-chart');
        if (attendanceChart) attendanceChart.innerHTML = `<div class="chart-placeholder"><i class="fas fa-chart-bar"></i><p>Grafik Kehadiran 30 Hari Terakhir</p></div>`;
        this.renderCampusAttendanceChart();
    }
};

window.initAdminDashboard = () => {
    if (!adminDashboard.initialized) adminDashboard.init();
    else adminDashboard.loadData().then(() => adminDashboard.renderCampusAttendanceChart());
    adminDashboard.initCharts();
};

window.adminDashboard = adminDashboard;
