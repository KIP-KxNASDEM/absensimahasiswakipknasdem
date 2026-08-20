/**
 * Portal Mahasiswa - Mobile Responsive
 * Mobile-specific functionality
 */

const mobile = {
    isMobile: false,
    sidebarOpen: false,
    _sidebarHome: null,
    _sidebarNextSibling: null,

    init() {
        this.checkMobile();
        this.initSidebar();
        this.initBottomNav();
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('orientationchange', () => setTimeout(() => this.handleResize(), 50));
    },

    checkMobile() {
        this.isMobile = window.innerWidth <= 768 || (window.innerWidth <= 1024 && window.innerHeight <= 600);
        return this.isMobile;
    },

    handleResize() {
        this.checkMobile();
        const menuToggle = document.getElementById('mobile-menu-toggle');
        if (menuToggle) menuToggle.style.display = this.isMobile ? 'flex' : 'none';

        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && this.isMobile) {
            this.mountSidebarToBody();
            this.sidebarOpen ? this.showSidebar() : this.hideSidebar();
        } else if (sidebar) {
            this.restoreSidebarHome();
            sidebar.classList.remove('open');
            sidebar.style.cssText = sidebar.style.cssText.replace(/(?:^|;)\s*(?:position|top|left|width|height|max-height|display|visibility|opacity|z-index|transform|pointer-events)\s*:[^;]*;?/gi, '');
            overlay?.classList.remove('show');
            if (overlay) overlay.style.cssText = overlay.style.cssText.replace(/(?:^|;)\s*(?:position|inset|z-index|display|visibility|opacity|pointer-events)\s*:[^;]*;?/gi, '');
            this.sidebarOpen = false;
            document.body.style.overflow = '';
        }

        const bottomNav = document.getElementById('bottom-nav');
        const session = window.auth?.currentUser || window.storage?.get('session');
        const isAdmin = session?.role === 'admin';
        if (bottomNav) bottomNav.style.display = this.isMobile && !isAdmin ? 'flex' : 'none';
        this.updateTableViews();
    },

    initSidebar() {
        const menuToggle = document.getElementById('mobile-menu-toggle');
        const overlay = document.getElementById('sidebar-overlay');
        const sidebarToggle = document.getElementById('sidebar-toggle');

        menuToggle?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleSidebar();
        });

        sidebarToggle?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.isMobile) this.closeSidebar();
            else document.getElementById('sidebar')?.classList.toggle('collapsed');
        });

        // Fallback delegated handler: catches the back button even if the sidebar
        // DOM is moved to <body> after initial event binding.
        document.addEventListener('click', (e) => {
            const target = e.target instanceof Element ? e.target.closest('#sidebar-toggle') : null;
            if (!target) return;
            e.preventDefault();
            e.stopPropagation();
            if (this.isMobile) this.closeSidebar();
        }, true);

        overlay?.addEventListener('click', () => this.closeSidebar());

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (this.isMobile) this.closeSidebar();
            });
        });
    },

    initBottomNav() {
        const bottomNav = document.getElementById('bottom-nav');
        if (!bottomNav) return;

        // Use delegation because the bottom navigation can be rendered/updated
        // after mobile.js initializes. Each item only needs data-page="...".
        bottomNav.addEventListener('click', (e) => {
            const item = e.target instanceof Element
                ? e.target.closest('.bottom-nav-item')
                : null;

            if (!item || !bottomNav.contains(item)) return;

            const page = item.dataset.page;
            if (!page || !window.router) return;

            e.preventDefault();
            e.stopPropagation();

            // Navigate through the SPA router so the actual page changes,
            // browser history is updated, and the active icon is refreshed.
            window.router.navigate(page);
        });

        // Make the active state match the current route on initial load.
        if (window.router?.currentPage) {
            this.updateBottomNav(window.router.currentPage);
        }
    },

    mountSidebarToBody() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar || sidebar.parentElement === document.body) return;
        this._sidebarHome = sidebar.parentNode;
        this._sidebarNextSibling = sidebar.nextSibling;
        document.body.appendChild(sidebar);
    },

    restoreSidebarHome() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar || !this._sidebarHome || sidebar.parentElement === this._sidebarHome) return;
        if (this._sidebarNextSibling && this._sidebarNextSibling.parentNode === this._sidebarHome) this._sidebarHome.insertBefore(sidebar, this._sidebarNextSibling);
        else this._sidebarHome.appendChild(sidebar);
    },

    showSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar) return;
        sidebar.classList.add('open');
        sidebar.style.setProperty('position', 'fixed', 'important');
        sidebar.style.setProperty('top', '0', 'important');
        sidebar.style.setProperty('left', '0', 'important');
        sidebar.style.setProperty('width', 'min(280px, 86vw)', 'important');
        sidebar.style.setProperty('height', '100dvh', 'important');
        sidebar.style.setProperty('max-height', '100dvh', 'important');
        sidebar.style.setProperty('display', 'flex', 'important');
        sidebar.style.setProperty('visibility', 'visible', 'important');
        sidebar.style.setProperty('opacity', '1', 'important');
        sidebar.style.setProperty('z-index', '2147483647', 'important');
        sidebar.style.setProperty('transform', 'translate3d(0,0,0)', 'important');
        sidebar.style.setProperty('pointer-events', 'auto', 'important');
        if (overlay) {
            overlay.classList.add('show');
            overlay.style.setProperty('position', 'fixed', 'important');
            overlay.style.setProperty('inset', '0', 'important');
            overlay.style.setProperty('display', 'block', 'important');
            overlay.style.setProperty('visibility', 'visible', 'important');
            overlay.style.setProperty('opacity', '1', 'important');
            overlay.style.setProperty('z-index', '2147483646', 'important');
            overlay.style.setProperty('pointer-events', 'auto', 'important');
        }
        document.body.style.overflow = 'hidden';
    },

    hideSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar) return;
        sidebar.classList.remove('open');
        sidebar.style.setProperty('position', 'fixed', 'important');
        sidebar.style.setProperty('top', '0', 'important');
        sidebar.style.setProperty('left', '0', 'important');
        sidebar.style.setProperty('width', 'min(280px, 86vw)', 'important');
        sidebar.style.setProperty('height', '100dvh', 'important');
        sidebar.style.setProperty('max-height', '100dvh', 'important');
        sidebar.style.setProperty('display', 'flex', 'important');
        sidebar.style.setProperty('visibility', 'visible', 'important');
        sidebar.style.setProperty('opacity', '1', 'important');
        sidebar.style.setProperty('z-index', '2147483647', 'important');
        sidebar.style.setProperty('transform', 'translate3d(-110%,0,0)', 'important');
        sidebar.style.setProperty('pointer-events', 'none', 'important');
        if (overlay) {
            overlay.classList.remove('show');
            overlay.style.setProperty('display', 'none', 'important');
            overlay.style.setProperty('visibility', 'hidden', 'important');
            overlay.style.setProperty('opacity', '0', 'important');
            overlay.style.setProperty('pointer-events', 'none', 'important');
        }
        document.body.style.overflow = '';
    },

    toggleSidebar() {
        if (!this.isMobile) return;
        this.sidebarOpen = !this.sidebarOpen;
        this.sidebarOpen ? this.showSidebar() : this.closeSidebar();
    },

    closeSidebar() {
        this.sidebarOpen = false;
        this.hideSidebar();
    },

    updateTableViews() {
        document.querySelectorAll('.table-responsive').forEach(container => {
            const table = container.querySelector('table');
            const mobileCards = container.nextElementSibling;
            if (table && mobileCards?.classList.contains('mobile-cards')) {
                container.style.display = this.isMobile ? 'none' : 'block';
                mobileCards.style.display = this.isMobile ? 'block' : 'none';
            }
        });
    },

    updateBottomNav(page) {
        const bottomNav = document.getElementById('bottom-nav');
        if (!bottomNav) return;
        bottomNav.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
    }
};

document.addEventListener('touchstart', handleTouchStart, { passive: true });
document.addEventListener('touchmove', handleTouchMove, { passive: true });
let xDown = null;
let yDown = null;
function handleTouchStart(evt) { xDown = evt.touches[0].clientX; yDown = evt.touches[0].clientY; }
function handleTouchMove(evt) {
    if (xDown === null || yDown === null) return;
    const xUp = evt.touches[0].clientX;
    const yUp = evt.touches[0].clientY;
    const xDiff = xDown - xUp;
    const yDiff = yDown - yUp;
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff < -50 && xDown < 50 && mobile.isMobile) mobile.toggleSidebar();
        if (xDiff > 50 && mobile.sidebarOpen) mobile.closeSidebar();
    }
    xDown = null;
    yDown = null;
}

document.addEventListener('DOMContentLoaded', () => mobile.init());
window.mobile = mobile;
