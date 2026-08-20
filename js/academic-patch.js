/**
 * Academic dimension compatibility layer.
 * Adds Kampus + Prodi/Jurusan to admin reports without breaking legacy data.
 */
(() => {
    let students = [];
    let loaded = false;

    const norm = v => String(v ?? '').trim().toLowerCase();
    const campusOf = s => s?.kampus || s?.campus || '-';
    const prodiOf = s => s?.prodi || s?.jurusan || s?.programStudi || '-';
    const nameOf = s => s?.name || s?.nama || s?.email || '-';

    const samePerson = (student, row) => {
        const keys = ['id','userId','userID','studentId','studentID','employeeId','employeeID','nim','NIM','email','Email'];
        for (const key of keys) {
            const a = norm(student?.[key]);
            const b = norm(row?.[key]);
            if (a && b && a === b) return true;
        }
        return norm(nameOf(student)) && norm(nameOf(student)) === norm(nameOf(row));
    };

    async function loadStudents() {
        if (loaded) return students;
        try {
            const result = await api.getEmployees();
            students = Array.isArray(result?.data) ? result.data : [];
        } catch (e) {
            students = [];
            console.error('Academic patch: gagal memuat mahasiswa', e);
        }
        loaded = true;
        return students;
    }

    function findStudentByName(name) {
        const target = norm(name);
        return students.find(s => norm(nameOf(s)) === target) || null;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    function patchPageTitle() {
        const nodes = document.querySelectorAll('*');
        nodes.forEach(el => {
            if (el.children.length === 0 && norm(el.textContent) === 'distribusi kehadiran per departemen') {
                el.textContent = 'Distribusi Kehadiran per Kampus';
            }
        });
    }

    function patchAttendanceTable() {
        const table = document.getElementById('attendance-reports-table');
        if (!table) return;
        const header = table.querySelector('thead tr:first-child');
        const body = document.getElementById('attendance-reports-body');
        if (!header || !body) return;

        const labels = [...header.children].map(x => norm(x.textContent));
        if (!labels.includes('kampus')) {
            const nameCell = header.children[0];
            if (nameCell) {
                const campus = document.createElement('th');
                campus.textContent = 'Kampus';
                const prodi = document.createElement('th');
                prodi.textContent = 'Prodi / Jurusan';
                nameCell.after(campus, prodi);
            }
        }

        [...body.querySelectorAll('tr')].forEach(row => {
            if (row.dataset.academicPatched === '1') return;
            const cells = row.children;
            if (!cells.length) return;
            const name = cells[0].textContent.trim();
            const student = findStudentByName(name);
            const campusCell = document.createElement('td');
            const prodiCell = document.createElement('td');
            campusCell.textContent = campusOf(student);
            prodiCell.textContent = prodiOf(student);
            cells[0].after(campusCell, prodiCell);
            row.dataset.academicPatched = '1';
        });
    }

    function patchSimpleReportTable(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;
        const header = table.querySelector('thead tr:first-child');
        const body = table.querySelector('tbody');
        if (!header || !body) return;

        let departmentIndex = [...header.children].findIndex(th => norm(th.textContent) === 'departemen');
        if (departmentIndex >= 0) {
            header.children[departmentIndex].textContent = 'Kampus';
            if (!header.querySelector('[data-prodi-header]')) {
                const th = document.createElement('th');
                th.textContent = 'Prodi / Jurusan';
                th.dataset.prodiHeader = '1';
                header.children[departmentIndex].after(th);
            }
        }

        [...body.querySelectorAll('tr')].forEach(row => {
            if (row.dataset.academicPatched === '1') return;
            const cells = row.children;
            if (!cells.length) return;
            const name = cells[0].textContent.trim();
            const student = findStudentByName(name);
            if (departmentIndex >= 0 && cells[departmentIndex]) {
                cells[departmentIndex].textContent = campusOf(student);
                const prodi = document.createElement('td');
                prodi.textContent = prodiOf(student);
                cells[departmentIndex].after(prodi);
            }
            row.dataset.academicPatched = '1';
        });
    }

    function patchFilters() {
        const pages = [
            {table:'attendance-reports-table', anchor:'attendance-month'},
            {table:'jurnal-reports-table', anchor:'jurnal-month'},
            {table:'leave-reports-table', anchor:'leave-month'}
        ];
        pages.forEach(({table, anchor}) => {
            const target = document.getElementById(table);
            const anchorInput = document.getElementById(anchor);
            if (!target || !anchorInput) return;
            const filterContainer = anchorInput.closest('.reports-filters');
            if (!filterContainer || filterContainer.querySelector(`[data-academic-filter="${table}"]`)) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'filter-group';
            wrapper.dataset.academicFilter = table;
            wrapper.innerHTML = `<label>Kampus</label><select class="academic-campus-filter"><option value="">Semua Kampus</option></select>`;
            filterContainer.appendChild(wrapper);

            const select = wrapper.querySelector('select');
            [...new Set(students.map(campusOf).filter(x => x && x !== '-'))].sort().forEach(campus => {
                const option = document.createElement('option');
                option.value = campus;
                option.textContent = campus;
                select.appendChild(option);
            });

            select.addEventListener('change', () => applyReportFilter(table, select.value));
        });
    }

    function applyReportFilter(tableId, campus) {
        const table = document.getElementById(tableId);
        if (!table) return;
        const body = table.querySelector('tbody');
        if (!body) return;
        [...body.querySelectorAll('tr')].forEach(row => {
            if (row.dataset.emptyRow === '1') return;
            const name = row.children[0]?.textContent.trim() || '';
            const student = findStudentByName(name);
            row.style.display = !campus || campusOf(student) === campus ? '' : 'none';
        });
    }

    async function patchAll() {
        await loadStudents();
        patchPageTitle();
        patchAttendanceTable();
        patchSimpleReportTable('jurnal-reports-table');
        patchSimpleReportTable('leave-reports-table');
        patchFilters();
    }

    const observer = new MutationObserver(() => {
        clearTimeout(observer.timer);
        observer.timer = setTimeout(patchAll, 80);
    });

    function start() {
        if (!document.body) return;
        observer.observe(document.body, {childList:true, subtree:true});
        patchAll();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
