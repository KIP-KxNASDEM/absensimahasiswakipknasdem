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
            const a = norm(student?.[key]), b = norm(row?.[key]);
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

    function patchPageTitle() {
        document.querySelectorAll('*').forEach(el => {
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

        if (![...header.children].some(x => norm(x.textContent) === 'kampus')) {
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
            if (row.children.length < 2 || row.dataset.academicPatched === '1') return;
            const student = findStudentByName(row.children[0].textContent.trim());
            const campusCell = document.createElement('td');
            const prodiCell = document.createElement('td');
            campusCell.textContent = campusOf(student);
            prodiCell.textContent = prodiOf(student);
            row.children[0].after(campusCell, prodiCell);
            row.dataset.academicPatched = '1';
        });
    }

    function patchSimpleReportTable(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;
        const header = table.querySelector('thead tr:first-child');
        const body = table.querySelector('tbody');
        if (!header || !body) return;

        let campusIndex = [...header.children].findIndex(th => norm(th.textContent) === 'kampus');
        const departmentIndex = [...header.children].findIndex(th => norm(th.textContent) === 'departemen');
        if (campusIndex < 0 && departmentIndex >= 0) {
            header.children[departmentIndex].textContent = 'Kampus';
            campusIndex = departmentIndex;
        }
        if (campusIndex >= 0 && !header.querySelector('[data-prodi-header]')) {
            const th = document.createElement('th');
            th.textContent = 'Prodi / Jurusan';
            th.dataset.prodiHeader = '1';
            header.children[campusIndex].after(th);
        }
        campusIndex = [...header.children].findIndex(th => norm(th.textContent) === 'kampus');
        if (campusIndex < 0) return;

        [...body.querySelectorAll('tr')].forEach(row => {
            if (row.children.length <= campusIndex || row.dataset.academicPatched === '1') return;
            const student = findStudentByName(row.children[0].textContent.trim());
            row.children[campusIndex].textContent = campusOf(student);
            const prodi = document.createElement('td');
            prodi.textContent = prodiOf(student);
            row.children[campusIndex].after(prodi);
            row.dataset.academicPatched = '1';
        });
    }

    function uniqueValues(field) {
        return [...new Set(students.map(field).filter(x => x && x !== '-'))].sort((a,b) => String(a).localeCompare(String(b)));
    }

    function addSelectFilter(container, key, label, values, tableId) {
        if (container.querySelector(`[data-academic-filter="${tableId}-${key}"]`)) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'filter-group';
        wrapper.dataset.academicFilter = `${tableId}-${key}`;
        wrapper.innerHTML = `<label>${label}</label><select><option value="">Semua ${label}</option></select>`;
        const select = wrapper.querySelector('select');
        values.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
        container.appendChild(wrapper);
        select.addEventListener('change', () => applyReportFilters(tableId));
    }

    function patchFilters() {
        [
            {table:'attendance-reports-table', anchor:'attendance-month'},
            {table:'jurnal-reports-table', anchor:'jurnal-month'},
            {table:'leave-reports-table', anchor:'leave-month'}
        ].forEach(({table,anchor}) => {
            const anchorInput = document.getElementById(anchor);
            if (!document.getElementById(table) || !anchorInput) return;
            const container = anchorInput.closest('.reports-filters');
            if (!container) return;
            addSelectFilter(container, 'campus', 'Kampus', uniqueValues(campusOf), table);
            addSelectFilter(container, 'prodi', 'Prodi / Jurusan', uniqueValues(prodiOf), table);
        });
    }

    function applyReportFilters(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;
        const filterContainer = table.closest('.page')?.querySelector('.reports-filters');
        const campus = filterContainer?.querySelector(`[data-academic-filter="${tableId}-campus"] select`)?.value || '';
        const prodi = filterContainer?.querySelector(`[data-academic-filter="${tableId}-prodi"] select`)?.value || '';
        const body = table.querySelector('tbody');
        if (!body) return;
        [...body.querySelectorAll('tr')].forEach(row => {
            if (!row.children.length) return;
            const student = findStudentByName(row.children[0].textContent.trim());
            row.style.display = (!campus || campusOf(student) === campus) && (!prodi || prodiOf(student) === prodi) ? '' : 'none';
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
