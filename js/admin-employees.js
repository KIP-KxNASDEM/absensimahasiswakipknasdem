/**
 * Portal Mahasiswa - Admin Employees
 * Employee management for admin
 * Academic dimensions: Kampus + Prodi/Jurusan
 */

const adminEmployees = {
    employees: [],
    currentPage: 1,
    perPage: 10,
    filters: {
        search: '',
        status: ''
    },

    async init() {
        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }

        this.cleanupLegacyEmployeeUi();
        this.ensureAcademicFields();
        await this.loadEmployees();
        this.bindEvents();
        this.renderTable();
        this.renderMobileCards();
        this.updatePaginationInfo();
    },

    cleanupLegacyEmployeeUi() {
        const deptFilter = document.getElementById('dept-filter');
        if (deptFilter) {
            const filterGroup = deptFilter.closest('.filter-group');
            if (filterGroup) filterGroup.remove();
        }

        const headerRow = document.querySelector('#employees-table thead tr');
        if (headerRow) {
            Array.from(headerRow.children).forEach((th) => {
                const label = th.textContent.trim().toLowerCase();
                if (label === 'departemen' || label === 'shift') th.remove();
            });
        }
    },

    ensureAcademicFields() {
        const form = document.getElementById('form-add-employee');
        const position = document.getElementById('emp-position');
        if (!form || !position || document.getElementById('emp-kampus')) return;

        const row = position.closest('.form-row');
        if (!row) return;

        const academicRow = document.createElement('div');
        academicRow.className = 'form-row two-col academic-fields-row';
        academicRow.innerHTML = `
            <div class="form-group">
                <label for="emp-kampus">Kampus</label>
                <input type="text" id="emp-kampus" placeholder="Nama kampus" required>
            </div>
            <div class="form-group">
                <label for="emp-prodi">Prodi / Jurusan</label>
                <input type="text" id="emp-prodi" placeholder="Program studi / jurusan" required>
            </div>
        `;
        row.parentNode.insertBefore(academicRow, row);
    },

    async loadEmployees() {
        try {
            const result = await api.getEmployees();
            this.employees = result.data || [];
        } catch (error) {
            console.error('Error loading employees:', error);
            this.employees = storage.get('admin_employees', []);
        }
    },

    bindEvents() {
        const searchInput = document.getElementById('employee-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.currentPage = 1;
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
            });
        }

        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.currentPage = 1;
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
            });
        }

        const addBtn = document.getElementById('btn-add-employee');
        if (addBtn) addBtn.addEventListener('click', () => this.showAddModal());

        const closeBtn = document.getElementById('btn-close-modal');
        const cancelBtn = document.getElementById('btn-cancel-add');
        const modal = document.getElementById('modal-add-employee');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hideAddModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideAddModal());
        if (modal) modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideAddModal();
        });

        const form = document.getElementById('form-add-employee');
        if (form) form.addEventListener('submit', (e) => this.handleAddEmployee(e));

        const joinDateInput = document.getElementById('emp-join-date');
        if (joinDateInput) joinDateInput.valueAsDate = new Date();
    },

    getFilteredEmployees() {
        return this.employees.filter(emp => {
            const name = String(emp.name || '').toLowerCase();
            const email = String(emp.email || '').toLowerCase();
            const position = String(emp.position || '').toLowerCase();
            const campus = String(emp.kampus || emp.campus || '').toLowerCase();
            const prodi = String(emp.prodi || emp.jurusan || emp.programStudi || '').toLowerCase();
            const matchesSearch = !this.filters.search ||
                name.includes(this.filters.search) ||
                email.includes(this.filters.search) ||
                position.includes(this.filters.search) ||
                campus.includes(this.filters.search) ||
                prodi.includes(this.filters.search);
            const matchesStatus = !this.filters.status || emp.status === this.filters.status;
            return matchesSearch && matchesStatus;
        });
    },

    campusOf(emp) {
        return emp?.kampus || emp?.campus || '-';
    },

    prodiOf(emp) {
        return emp?.prodi || emp?.jurusan || emp?.programStudi || '-';
    },

    renderTable() {
        const tbody = document.getElementById('employees-table-body');
        const table = document.getElementById('employees-table');
        if (!tbody) return;

        const headerRow = table?.querySelector('thead tr');
        if (headerRow) {
            headerRow.innerHTML = `
                <th>Mahasiswa</th>
                <th>ID</th>
                <th>Kampus</th>
                <th>Prodi / Jurusan</th>
                <th>Jabatan</th>
                <th>Status</th>
                <th>Aksi</th>
            `;
        }

        const filtered = this.getFilteredEmployees();
        const start = (this.currentPage - 1) * this.perPage;
        const paginated = filtered.slice(start, start + this.perPage);

        if (paginated.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:var(--spacing-xl);">Tidak ada data mahasiswa</td></tr>`;
            this.updatePagination(filtered.length);
            return;
        }

        tbody.innerHTML = paginated.map(emp => `
            <tr>
                <td>
                    <div class="employee-info">
                        <div class="employee-avatar"><img src="${getAvatarUrl(emp)}" alt="${emp.name}"></div>
                        <div class="employee-details">
                            <span class="employee-name">${emp.name || '-'}</span>
                            <span class="employee-email">${emp.email || '-'}</span>
                        </div>
                    </div>
                </td>
                <td>EMP${String(emp.id).padStart(3, '0')}</td>
                <td>${this.campusOf(emp)}</td>
                <td>${this.prodiOf(emp)}</td>
                <td>${emp.position || '-'}</td>
                <td><span class="status-badge ${emp.status}">${this.getStatusLabel(emp.status)}</span></td>
                <td>
                    <button class="btn-action view" onclick="adminEmployees.viewEmployee(${emp.id})" title="Lihat"><i class="fas fa-eye"></i></button>
                    <button class="btn-action edit" onclick="adminEmployees.editEmployee(${emp.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-action delete" onclick="adminEmployees.deleteEmployee(${emp.id})" title="Hapus"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');

        this.updatePagination(filtered.length);
    },

    renderMobileCards() {
        const container = document.getElementById('employees-mobile-cards');
        if (!container) return;
        const filtered = this.getFilteredEmployees();
        const start = (this.currentPage - 1) * this.perPage;
        const paginated = filtered.slice(start, start + this.perPage);

        container.innerHTML = paginated.map(emp => `
            <div class="mobile-card">
                <div class="mobile-card-header">
                    <div class="employee-info">
                        <div class="employee-avatar"><img src="${getAvatarUrl(emp)}" alt="${emp.name}"></div>
                        <div class="employee-details">
                            <span class="employee-name">${emp.name || '-'}</span>
                            <span class="employee-email">${emp.email || '-'}</span>
                        </div>
                    </div>
                    <span class="status-badge ${emp.status}">${this.getStatusLabel(emp.status)}</span>
                </div>
                <div class="mobile-card-row"><span class="mobile-card-label">ID</span><span class="mobile-card-value">EMP${String(emp.id).padStart(3, '0')}</span></div>
                <div class="mobile-card-row"><span class="mobile-card-label">Kampus</span><span class="mobile-card-value">${this.campusOf(emp)}</span></div>
                <div class="mobile-card-row"><span class="mobile-card-label">Prodi / Jurusan</span><span class="mobile-card-value">${this.prodiOf(emp)}</span></div>
                <div class="mobile-card-row"><span class="mobile-card-label">Jabatan</span><span class="mobile-card-value">${emp.position || '-'}</span></div>
                <div style="margin-top:var(--spacing);display:flex;gap:var(--spacing-xs);">
                    <button class="btn-action view" onclick="adminEmployees.viewEmployee(${emp.id})" style="flex:1;"><i class="fas fa-eye"></i> Lihat</button>
                    <button class="btn-action edit" onclick="adminEmployees.editEmployee(${emp.id})" style="flex:1;"><i class="fas fa-edit"></i> Edit</button>
                </div>
            </div>
        `).join('');
    },

    updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.perPage);
        const paginationButtons = document.querySelector('.pagination-buttons');
        if (paginationButtons) {
            let buttonsHtml = `<button class="btn-page" ${this.currentPage === 1 ? 'disabled' : ''} onclick="adminEmployees.goToPage(${this.currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
            for (let i = 1; i <= totalPages; i++) {
                buttonsHtml += `<button class="btn-page ${i === this.currentPage ? 'active' : ''}" onclick="adminEmployees.goToPage(${i})">${i}</button>`;
            }
            buttonsHtml += `<button class="btn-page" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="adminEmployees.goToPage(${this.currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
            paginationButtons.innerHTML = buttonsHtml;
        }
        this.updatePaginationInfo();
    },

    updatePaginationInfo() {
        const filtered = this.getFilteredEmployees();
        const start = (this.currentPage - 1) * this.perPage + 1;
        const end = Math.min(start + this.perPage - 1, filtered.length);
        const info = document.querySelector('.pagination-info');
        if (info) info.textContent = `Menampilkan ${filtered.length > 0 ? start : 0}-${end} dari ${filtered.length} mahasiswa`;
    },

    goToPage(page) {
        const totalPages = Math.ceil(this.getFilteredEmployees().length / this.perPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderTable();
            this.renderMobileCards();
        }
    },

    getStatusLabel(status) {
        const labels = { active: 'Aktif', 'on-leave': 'Cuti', inactive: 'Non-Aktif' };
        return labels[status] || status;
    },

    showAddModal() {
        this.ensureAcademicFields();
        const modal = document.getElementById('modal-add-employee');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    hideAddModal() {
        const modal = document.getElementById('modal-add-employee');
        const form = document.getElementById('form-add-employee');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (form) {
            form.reset();
            const joinDateInput = document.getElementById('emp-join-date');
            if (joinDateInput) joinDateInput.valueAsDate = new Date();
        }
    },

    async handleAddEmployee(e) {
        e.preventDefault();
        const name = document.getElementById('emp-name').value.trim();
        const email = document.getElementById('emp-email').value.trim();
        const kampus = document.getElementById('emp-kampus')?.value.trim() || '';
        const prodi = document.getElementById('emp-prodi')?.value.trim() || '';
        const position = document.getElementById('emp-position').value.trim();
        const status = document.getElementById('emp-status').value;
        const joinDate = document.getElementById('emp-join-date').value;

        if (!kampus || !prodi) {
            toast.error('Kampus dan Prodi/Jurusan wajib diisi');
            return;
        }

        const employeeData = {
            name,
            email,
            kampus,
            campus: kampus,
            prodi,
            jurusan: prodi,
            department: '-',
            position,
            shift: '-',
            status,
            joinDate,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${this.getRandomColor()}&color=fff`
        };

        try {
            const result = await api.addEmployee(employeeData);
            if (result.success) {
                this.employees.unshift(result.data);
                this.hideAddModal();
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
                toast.success(`Mahasiswa ${name} berhasil ditambahkan!`);
            } else {
                toast.error(result.error || 'Gagal menambahkan mahasiswa');
            }
        } catch (error) {
            console.error('Error adding employee:', error);
            toast.error('Terjadi kesalahan');
        }
    },

    getRandomColor() {
        const colors = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6', 'EC4899', '06B6D4'];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    viewEmployee(id) {
        const emp = this.employees.find(e => e.id === id);
        if (emp) {
            alert(`Detail Mahasiswa:\n\nNama: ${emp.name}\nEmail: ${emp.email}\nKampus: ${this.campusOf(emp)}\nProdi/Jurusan: ${this.prodiOf(emp)}\nJabatan: ${emp.position}\nStatus: ${this.getStatusLabel(emp.status)}\nBergabung: ${emp.joinDate}`);
        }
    },

    editEmployee(id) {
        toast.info('Fitur edit mahasiswa akan segera hadir');
    },

    async deleteEmployee(id) {
        if (confirm('Apakah Anda yakin ingin menghapus mahasiswa ini?')) {
            try {
                await api.deleteEmployee(id);
                this.employees = this.employees.filter(e => e.id !== id);
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
                toast.success('Mahasiswa berhasil dihapus');
            } catch (error) {
                console.error('Error deleting employee:', error);
                toast.error('Gagal menghapus mahasiswa');
            }
        }
    }
};

window.initEmployees = () => adminEmployees.init();
window.adminEmployees = adminEmployees;
