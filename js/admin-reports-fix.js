/* Final attendance report fix for Portal Mahasiswa. */
(() => {
    const norm = v => String(v ?? '').trim().toLowerCase();
    const arr = v => {
        if (Array.isArray(v)) return v;
        if (Array.isArray(v?.data)) return v.data;
        if (Array.isArray(v?.items)) return v.items;
        if (Array.isArray(v?.records)) return v.records;
        if (Array.isArray(v?.students)) return v.students;
        return [];
    };
    const val = (o, keys) => {
        for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null && String(o[k]).trim() !== '') return o[k];
        return '';
    };
    const id = o => norm(val(o, ['id','userId','userID','userid','studentId','studentID','employeeId','employeeID','nim','NIM','email','Email','User ID','Student ID']));
    const name = o => norm(val(o, ['name','nama','Nama']));
    const same = (student, attendance) => {
        const a = id(student), b = id(attendance);
        if (a && b) return a === b;
        const an = name(student), bn = name(attendance);
        return !!an && !!bn && an === bn;
    };
    const clockIn = a => val(a, ['clockIn','clockin','clock_in','Clock In','Jam Masuk','jamMasuk','jam_masuk']);
    const status = a => norm(val(a, ['status','Status','Status Kehadiran','statusKehadiran']));
    const dateValue = a => val(a, ['date','tanggal','Date','Tanggal','attendanceDate','attendance_date']);
    const monthOf = v => {
        if (!v) return '';
        const s = String(v);
        const m = s.match(/(\d{4})[-\/]([0-9]{1,2})/);
        if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}`;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    };
    const workdaysElapsed = month => {
        if (!month) return 0;
        const [y,m] = month.split('-').map(Number);
        if (!y || !m) return 0;
        const today = new Date();
        const current = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
        if (month > current) return 0;
        const last = month < current ? new Date(y,m,0).getDate() : today.getDate();
        let n = 0;
        for (let d=1; d<=last; d++) {
            const wd = new Date(y,m-1,d).getDay();
            if (wd !== 0 && wd !== 6) n++;
        }
        return n;
    };
    const approvedDays = (records, student, month, izin=false) => {
        let total = 0;
        for (const r of arr(records)) {
            if (!same(student,r) || norm(r.status) !== 'approved') continue;
            if (izin) {
                if (month && monthOf(val(r,['date','tanggal','Date','Tanggal'])) !== month) continue;
                const d = parseInt(r.duration,10);
                total += Number.isFinite(d) && d > 0 ? d : 1;
                continue;
            }
            const s = new Date(r.startDate || r.start_date || r.tanggalMulai);
            const e = new Date(r.endDate || r.end_date || r.tanggalSelesai || r.startDate);
            if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;
            if (!month) { total += Math.max(1,Math.floor((e-s)/86400000)+1); continue; }
            const [y,m] = month.split('-').map(Number);
            const ms = new Date(y,m-1,1), me = new Date(y,m,0,23,59,59);
            const a = s > ms ? s : ms, b = e < me ? e : me;
            if (a <= b) total += Math.floor((b-a)/86400000)+1;
        }
        return total;
    };

    adminReports.loadData = async function() {
        let students=[], journals=[], leaves=[], izin=[], settings={};
        try {
            const [sr,jr,lr,ir,setr,ar] = await Promise.all([
                api.getStudents(), api.getAllJournals(), api.getAllLeaves(), api.getAllIzin(), api.getSettings(), api.getAllAttendance()
            ]);
            students = arr(sr?.data ?? sr);
            journals = arr(jr?.data ?? jr);
            leaves = arr(lr?.data ?? lr);
            izin = arr(ir?.data ?? ir);
            settings = setr?.data || {};
            this.rawAttendance = arr(ar?.data ?? ar);
        } catch (e) {
            console.error('Attendance report load error:',e);
            students = arr(storage.get('admin_students',[]));
            journals = arr(storage.get('jurnals',[]));
            leaves = arr(storage.get('leaves',[]));
            izin = arr(storage.get('izin',[]));
            settings = storage.get('settings',{});
            this.rawAttendance = arr(storage.get('attendance',[]));
        }
        this.rawEmployees=students; this.rawLeaves=leaves; this.rawIzin=izin; this.settings=settings||{};
        this.attendanceData=[];
        this.jurnalData=journals.map(j=>{
            const s=students.find(x=>same(x,j)) || {name:'Mahasiswa',department:'-'};
            return {date:j.date,name:s.name||s.nama||'-',department:s.department||s.prodi||'-',tasks:j.tasks||'-',achievements:j.achievements||'-',obstacles:j.obstacles||'-',plan:j.plan||'-',photo:j.photo||null,status:j.tasks?'filled':'empty',updatedAt:j.updatedAt};
        });
        this.leaveData=[];
    };

    adminReports.getFilteredAttendance = function() {
        const input=document.getElementById('attendance-month');
        const month=this.filters?.attendance?.month || input?.value || '';
        const dept=this.filters?.attendance?.dept || '';
        const st=this.filters?.attendance?.status || '';
        const students=arr(this.rawEmployees), attendance=arr(this.rawAttendance);
        const days=workdaysElapsed(month);
        return students.map(s=>{
            const rows=attendance.filter(a=>same(s,a) && (!month || monthOf(dateValue(a))===month));
            const present=rows.filter(a=>!!clockIn(a)).length;
            const late=rows.filter(a=>!!clockIn(a) && (status(a)==='terlambat'||status(a)==='late')).length;
            const leave=approvedDays(this.rawLeaves,s,month,false), izin=approvedDays(this.rawIzin,s,month,true);
            const absent=month ? Math.max(0,days-present-leave-izin) : 0;
            const row={userId:s.id,name:s.name||s.nama||s.email||s.nim||'-',department:s.department||s.fakultas||s.prodi||'-',present,late,absent,total:present+absent};
            if(dept && row.department!==dept) return null;
            if(st==='present' && row.present<=0) return null;
            if(st==='absent' && row.absent<=0) return null;
            if(st==='late' && row.late<=0) return null;
            return row;
        }).filter(Boolean);
    };
})();
