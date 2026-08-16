/* Canonical attendance report fix + reliable detail modal. */
(() => {
    const norm = v => String(v ?? '').trim().toLowerCase();
    const arr = v => Array.isArray(v) ? v : (Array.isArray(v?.data) ? v.data : []);
    const val = (o, keys) => {
        for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null && String(o[k]).trim() !== '') return o[k];
        return '';
    };
    const identityKeys = ['id','userId','userID','userid','studentId','studentID','employeeId','employeeID','nim','NIM','email','Email','User ID','Student ID','Employee ID'];
    const tokens = o => new Set(identityKeys.map(k => norm(o?.[k])).filter(Boolean));
    const nameOf = o => norm(val(o, ['name','nama','Nama']));
    const samePerson = (a,b) => {
        const x=tokens(a), y=tokens(b); for(const t of x) if(y.has(t)) return true;
        const an=nameOf(a), bn=nameOf(b); return !!an && !!bn && an===bn;
    };
    const dateOf = r => val(r,['date','tanggal','Date','Tanggal','attendanceDate','attendance_date']);
    const monthOf = v => {
        const s=String(v??''), m=s.match(/(\d{4})[-\/]([0-9]{1,2})/);
        if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}`;
        const d=new Date(v); return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    };
    const clockIn = r => val(r,['clockIn','clockin','clock_in','Clock In','Jam Masuk','jamMasuk','jam_masuk']);
    const clockOut = r => val(r,['clockOut','clockout','clock_out','Clock Out','Jam Pulang','jamPulang','jam_pulang']);
    const status = r => norm(val(r,['status','Status','Status Kehadiran','statusKehadiran']));
    const late = r => status(r)==='terlambat'||status(r)==='late';
    const currentMonth = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
    const workdays = month => {
        if(!/^\d{4}-\d{2}$/.test(month)) return 0;
        const [y,m]=month.split('-').map(Number), now=new Date(), cm=currentMonth();
        if(month>cm) return 0;
        const end=month<cm?new Date(y,m,0).getDate():now.getDate(); let n=0;
        for(let d=1;d<=end;d++){const w=new Date(y,m-1,d).getDay();if(w!==0&&w!==6)n++;} return n;
    };
    const approvedDays=(records,student,month,isIzin=false)=>{
        let total=0;
        arr(records).forEach(r=>{
            if(!samePerson(student,r)||norm(r.status)!=='approved') return;
            if(isIzin){const rm=monthOf(val(r,['date','tanggal','Date','Tanggal']));if(month&&rm!==month)return;const d=parseInt(r.duration,10);total+=Number.isFinite(d)&&d>0?d:1;return;}
            const start=new Date(r.startDate||r.start_date||r.tanggalMulai), end=new Date(r.endDate||r.end_date||r.tanggalSelesai||r.startDate);
            if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())) return;
            if(!month){total+=Math.max(1,Math.floor((end-start)/86400000)+1);return;}
            const [y,m]=month.split('-').map(Number), ms=new Date(y,m-1,1), me=new Date(y,m,0,23,59,59), a=start>ms?start:ms, b=end<me?end:me;
            if(a<=b) total+=Math.floor((b-a)/86400000)+1;
        }); return total;
    };

    adminReports.initAttendanceReports = async function(){
        if(!auth.isAdmin()){toast.error('Anda tidak memiliki akses!');router.navigate('dashboard');return;}
        try{
            const [students,attendance,leaves,izin,settings]=await Promise.all([api.getStudents(),api.getAllAttendance(),api.getAllLeaves(),api.getAllIzin(),api.getSettings()]);
            this.rawEmployees=arr(students?.data??students); this.rawAttendance=arr(attendance?.data??attendance); this.rawLeaves=arr(leaves?.data??leaves); this.rawIzin=arr(izin?.data??izin); this.settings=settings?.data||{}; this.attendanceData=[];
            this.bindAttendanceEvents(); this.renderAttendanceReports();
        }catch(e){console.error(e);toast.error('Gagal memuat data absensi');}
    };

    adminReports.getFilteredAttendance = function(){
        const month=this.filters?.attendance?.month||document.getElementById('attendance-month')?.value||'';
        const dept=this.filters?.attendance?.dept||'', sf=this.filters?.attendance?.status||'';
        const students=arr(this.rawEmployees), attendance=arr(this.rawAttendance), wd=workdays(month);
        return students.map(s=>{
            const records=attendance.filter(r=>samePerson(s,r)&&(!month||monthOf(dateOf(r))===month));
            const l=records.filter(r=>!!clockIn(r)&&late(r)).length;
            const p=records.filter(r=>!!clockIn(r)&&!late(r)).length;
            const ld=approvedDays(this.rawLeaves,s,month,false), id=approvedDays(this.rawIzin,s,month,true);
            const absent=month?Math.max(0,wd-p-l-ld-id):0;
            const total=month?Math.max(0,wd-ld-id):p+l;
            const row={userId:s.id,name:s.name||s.nama||s.email||s.nim||'-',department:s.department||s.fakultas||s.prodi||'-',present:p,late:l,absent,total};
            if(dept&&row.department!==dept)return null;
            if(sf==='present'&&p<=0)return null;if(sf==='absent'&&absent<=0)return null;if(sf==='late'&&l<=0)return null;
            return row;
        }).filter(Boolean);
    };

    adminReports.viewDetail = function(name){
        const month=this.filters?.attendance?.month||document.getElementById('attendance-month')?.value||'';
        const student=arr(this.rawEmployees).find(s=>nameOf(s)===norm(name));
        if(!student){toast.error('Data mahasiswa tidak ditemukan');return;}
        const records=arr(this.rawAttendance).filter(r=>samePerson(student,r)&&(!month||monthOf(dateOf(r))===month)).sort((a,b)=>String(dateOf(b)).localeCompare(String(dateOf(a))));
        const summary=this.getFilteredAttendance().find(r=>samePerson(student,r))||{present:0,late:0,absent:workdays(month),total:workdays(month)};
        const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
        const rows=records.length?records.map(r=>{const has=!!clockIn(r), l=late(r), label=!has?'Absen':l?'Terlambat':'Hadir', cls=!has?'danger':l?'warning':'success';return `<tr><td>${esc(dateOf(r)||'-')}</td><td>${esc(val(r,['shift','Shift','shiftName'])||'Pagi')}</td><td>${esc(clockIn(r)||'-')}</td><td>${esc(clockOut(r)||'-')}</td><td><span class="status-badge ${cls}">${label}</span></td></tr>`;}).join(''):`<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">Belum ada data absensi pada periode ini.</td></tr>`;
        document.getElementById('attendance-detail-modal')?.remove();
        const root=document.createElement('div');root.id='attendance-detail-modal';root.innerHTML=`<div class="attendance-detail-backdrop"></div><div class="attendance-detail-dialog" role="dialog" aria-modal="true"><div class="attendance-detail-header"><div><h2>Detail Absensi</h2><p>${esc(student.name||student.nama||'-')}</p></div><button type="button" class="attendance-detail-close">&times;</button></div><div class="attendance-detail-body"><div class="attendance-detail-meta"><div><span>Departemen</span><strong>${esc(student.department||student.fakultas||student.prodi||'-')}</strong></div><div><span>Periode</span><strong>${esc(month||'Semua periode')}</strong></div></div><div class="attendance-detail-stats"><div><strong class="present">${summary.present}</strong><span>Hadir</span></div><div><strong class="late">${summary.late}</strong><span>Terlambat</span></div><div><strong class="absent">${summary.absent}</strong><span>Absen</span></div><div><strong>${summary.total}</strong><span>Total</span></div></div><div class="attendance-detail-history"><h3>Riwayat Absensi</h3><div class="attendance-detail-table-wrap"><table><thead><tr><th>Tanggal</th><th>Shift</th><th>Clock In</th><th>Clock Out</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div></div><div class="attendance-detail-footer"><button type="button" class="attendance-detail-close btn-secondary">Tutup</button></div></div>`;
        document.body.appendChild(root);
        const close=()=>{document.removeEventListener('keydown',key);root.remove();},key=e=>{if(e.key==='Escape')close()};
        root.querySelectorAll('.attendance-detail-close').forEach(b=>b.addEventListener('click',close));root.querySelector('.attendance-detail-backdrop').addEventListener('click',close);document.addEventListener('keydown',key);
    };

    const originalBind=adminReports.bindAttendanceEvents.bind(adminReports);
    adminReports.bindAttendanceEvents=function(){
        originalBind();
        const input=document.getElementById('attendance-month');
        if(input) input.onchange=e=>{this.filters.attendance.month=e.target.value;this.renderAttendanceReports();};
    };

    const style=document.createElement('style');style.textContent=`#attendance-detail-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;font-family:Poppins,sans-serif}#attendance-detail-modal .attendance-detail-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.52);backdrop-filter:blur(3px)}#attendance-detail-modal .attendance-detail-dialog{position:relative;width:min(900px,100%);max-height:85vh;overflow:hidden;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column}#attendance-detail-modal .attendance-detail-header{display:flex;justify-content:space-between;align-items:center;padding:22px 26px;border-bottom:1px solid #e8edf3}#attendance-detail-modal .attendance-detail-header h2{margin:0;font-size:21px;color:#1e293b}#attendance-detail-modal .attendance-detail-header p{margin:4px 0 0;color:#64748b;font-size:14px}#attendance-detail-modal .attendance-detail-close{border:0;background:#f1f5f9;color:#64748b;width:38px;height:38px;border-radius:10px;cursor:pointer;font-size:22px}#attendance-detail-modal .attendance-detail-body{padding:22px 26px;overflow:auto}#attendance-detail-modal .attendance-detail-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}#attendance-detail-modal .attendance-detail-meta>div,#attendance-detail-modal .attendance-detail-stats>div{padding:14px;background:#f8fafc;border-radius:10px}#attendance-detail-modal .attendance-detail-meta span,#attendance-detail-modal .attendance-detail-stats span{display:block;font-size:11px;color:#64748b;text-transform:uppercase}#attendance-detail-modal .attendance-detail-meta strong{display:block;margin-top:3px;color:#334155}#attendance-detail-modal .attendance-detail-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}#attendance-detail-modal .attendance-detail-stats>div{text-align:center}#attendance-detail-modal .attendance-detail-stats strong{display:block;font-size:24px;color:#334155}#attendance-detail-modal .attendance-detail-stats .present{color:#22b573}#attendance-detail-modal .attendance-detail-stats .late{color:#f59e0b}#attendance-detail-modal .attendance-detail-stats .absent{color:#ef4444}#attendance-detail-modal h3{font-size:15px;color:#334155;margin:0 0 10px}#attendance-detail-modal .attendance-detail-table-wrap{overflow:auto;border:1px solid #e8edf3;border-radius:10px}#attendance-detail-modal table{width:100%;min-width:620px;border-collapse:collapse}#attendance-detail-modal th{background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;text-align:left;padding:11px 13px}#attendance-detail-modal td{padding:12px 13px;border-top:1px solid #edf1f5;color:#475569;font-size:13px}#attendance-detail-modal .attendance-detail-footer{padding:14px 26px;border-top:1px solid #e8edf3;text-align:right}#attendance-detail-modal .attendance-detail-footer .btn-secondary{border:0;background:#eef2f7;color:#475569;border-radius:9px;padding:9px 18px;cursor:pointer}@media(max-width:600px){#attendance-detail-modal{padding:12px}#attendance-detail-modal .attendance-detail-meta{grid-template-columns:1fr}#attendance-detail-modal .attendance-detail-stats{grid-template-columns:repeat(2,1fr)}}`;document.head.appendChild(style);
})();
