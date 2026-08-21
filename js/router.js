/**
 * Portal Mahasiswa - Router
 * Simple SPA Router for vanilla JS
 */

const router = {
    currentPage: 'dashboard',
    routes: ['dashboard', 'absensi', 'face-recognition', 'izin', 'jurnal', 'cuti',
             'admin-dashboard', 'employees', 'attendance-reports', 'jurnal-reports',
             'leave-reports', 'shift-schedule', 'settings'],

    init() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) this.navigate(page);
            });
        });

        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) this.showPage(e.state.page, false);
        });

        const storedPage = storage.get('currentPage');
        if (storedPage && this.routes.includes(storedPage)) this.showPage(storedPage, false);
    },

    navigate(page) {
        if (!this.routes.includes(page)) return;
        this.showPage(page, true);
        storage.set('currentPage', page);
    },

    showPage(page, pushState = true) {
        this.currentPage = page;

        const titles = {
            dashboard: 'Dashboard',
            absensi: 'Absensi',
            jurnal: 'Jurnal Kerja',
            cuti: 'Pengajuan Cuti',
            'shift-schedule': 'Jadwal Shift',
            settings: 'Settings'
        };

        const company = storage.get('company', { name: 'Portal Mahasiswa' });
        document.title = `${titles[page]} - ${company.name}`;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) item.classList.add('active');
        });

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) targetPage.classList.add('active');

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = titles[page];

        if (pushState) history.pushState({ page }, titles[page], `#${page}`);

        this.triggerPageInit(page);
        document.querySelector('.page-content').scrollTop = 0;
    },

    triggerPageInit(page) {
        switch(page) {
            case 'dashboard':
                if (window.initDashboard) window.initDashboard();
                break;
            case 'absensi':
                if (window.initAbsensi) window.initAbsensi();
                break;
            case 'face-recognition':
                break;
            case 'izin':
                if (window.initIzin) window.initIzin();
                break;
            case 'jurnal':
                if (window.initJurnal) window.initJurnal();
                break;
            case 'cuti':
                if (window.initCuti) window.initCuti();
                break;
            case 'admin-dashboard':
                if (window.initAdminDashboard) window.initAdminDashboard();
                break;
            case 'employees':
                if (window.initEmployees) window.initEmployees();
                break;
            case 'attendance-reports':
                if (window.initAttendanceReports) window.initAttendanceReports();
                // admin-reports.js is loaded before router.js. Load the runtime patch after it
                // so the patched init is used on the first and subsequent visits.
                this.loadAttendanceReportPatch();
                break;
            case 'jurnal-reports':
                if (window.initJurnalReports) window.initJurnalReports();
                break;
            case 'leave-reports':
                if (window.initLeaveReports) window.initLeaveReports();
                break;
            case 'shift-schedule':
                if (window.initShiftSchedule) window.initShiftSchedule();
                break;
            case 'settings':
                if (window.initSettings) window.initSettings();
                break;
        }

        if (window.mobile) window.mobile.updateBottomNav(page);
    },

    loadAttendanceReportPatch() {
        if (window.__attendanceReportPatchLoaded) {
            if (window.initAttendanceReports) window.initAttendanceReports();
            return;
        }
        if (window.__attendanceReportPatchLoading) return;
        window.__attendanceReportPatchLoading = true;

        const script = document.createElement('script');
        script.src = `js/admin-attendance-report-patch.js?v=${Date.now()}`;
        script.onload = () => {
            window.__attendanceReportPatchLoaded = true;
            window.__attendanceReportPatchLoading = false;
            if (window.initAttendanceReports) window.initAttendanceReports();
        };
        script.onerror = () => {
            window.__attendanceReportPatchLoading = false;
            console.error('Gagal memuat patch Rekap Absensi.');
        };
        document.head.appendChild(script);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    router.init();
});

window.router = router;
