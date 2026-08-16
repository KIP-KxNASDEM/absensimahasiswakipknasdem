/* Detail attendance: show the full expected daily timeline, including ABSEN days. */
(() => {
    const norm = v => String(v ?? '').trim().toLowerCase();
    const arr = v => Array.isArray(v) ? v : (Array.isArray(v?.data) ? v.data : []);
    const val = (o, keys) => { for (const k of keys) if (o?.[k] != null && String(o[k]).trim() !== '') return o[k]; return ''; };
    const dateOf = r => val(r, ['date','tanggal','Date','Tanggal','attendanceDate','attendance_date']);
    const clockIn = r => val(r, ['clockIn','clockin','clock_in','Clock In','Jam Masuk','jamMasuk','jam_masuk']);
    const clockOut = r => val(r, ['clockOut','clockout','clock_out','Clock Out','Jam Pulang','jamPulang','jam_pulang']);
    const statusOf = r => norm(val(r, ['status','Status','Status Kehadiran','statusKehadiran']));
    const isLate = r => statusOf(r) === 'terlambat' || statusOf(r) === 'late';
    const monthOf = v => { const s=String(v??''), m=s.match(/(\d{4})[-\/]([0-9]{1,2})/); return m ? `${m[1]}-${String(m[2]).padStart(2,'0')}` : ''; };
    const nameOf = o => norm(val(o,['name','nama','Nama']));
    const samePerson = (a,b) => {
        const keys=['id','userId','userID','userid','studentId','studentID','employeeId','employeeID','nim','NIM','email','Email','User ID','Student ID','Employee ID'];
        for(const k of keys){const x=norm(a?.[k]),y=norm(b?.[k]);if(x&&y&&x===y)return true;}
        return !!nameOf(a)&&nameOf(a)===nameOf(b);
    };
    const dateKey = v => { const s=String(v??'').trim(), m=s.match(/(\d{4})[-\/]([0-9]{1,2})[-\/]([0-9]{1,2})/); return m ? `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}` : s.slice(0,10); };
    const esc = v => String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

    function buildTimeline(student, month, total) {
        const records=arr(adminReports.rawAttendance).filter(r=>samePerson(student,r)&&(!month||monthOf(dateOf(r))===month));
        const byDate=new Map(); records.forEach(r=>byDate.set(dateKey(dateOf(r)),r));
        const dates=new Set(byDate.keys());
        if(/^\d{4}-\d{2}$/.test(month)){
            const [y,m]=month.split('-').map(Number), now=new Date(), current=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            const end=month<current?new Date(y,m,0).getDate():now.getDate();
            // Fill missing expected days with weekdays until the monthly total is reached.
            for(let d=1;d<=end && dates.size<total;d++){
                const dt=new Date(y,m-1,d), wd=dt.getDay();
                if(wd!==0&&wd!==6) dates.add(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
            }
        }
        return [...dates].sort();
    }

    adminReports.viewDetail = function(name){
        const month=this.filters?.attendance?.month||document.getElementById('attendance-month')?.value||'';
        const student=arr(this.rawEmployees).find(s=>nameOf(s)===norm(name));
        if(!student){toast.error('Data mahasiswa tidak ditemukan');return;}
        const records=arr(this.rawAttendance).filter(r=>samePerson(student,r)&&(!month||monthOf(dateOf(r))===month));
        const base=this.getFilteredAttendance().find(r=>samePerson(student,r));
        const attended=records.filter(r=>!!clockIn(r));
        const lateCount=attended.filter(isLate).length;
        const presentCount=attended.filter(r=>!isLate(r)).length;
        const total=Math.max(0,Number(base?.total)||0);
        const absent=Math.max(0,total-presentCount-lateCount);
        const timeline=buildTimeline(student,month,total||attended.length);
        // If the source summary says 10 total but the timeline needs 9 ABSEN + 1 attendance, preserve that exact total.
        while(timeline.length < total){
            const [y,m]=month.split('-').map(Number); for(let d=1;d<=31&&timeline.length<total;d++){const k=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;if(!timeline.includes(k))timeline.push(k);} timeline.sort();
        }
        const byDate=new Map(records.map(r=>[dateKey(dateOf(r)),r]));
        const rows=timeline.map(d=>{
            const r=byDate.get(d), has=!!r&&!!clockIn(r), late=has&&isLate(r);
            const label=!has?'ABSEN':late?'TERLAMBAT':'HADIR', cls=!has?'danger':late?'warning':'success';
            return `<tr><td>${esc(d)}</td><td>${esc(val(r,['shift','Shift','shiftName'])||'Pagi')}</td><td>${esc(r?clockIn(r):'-')}</td><td>${esc(r?clockOut(r):'-')}</td><td><span class="status-badge ${cls}">${label}</span></td></tr>`;
        }).join('');
        document.getElementById('attendance-detail-modal')?.remove();
        const root=document.createElement('div'); root.id='attendance-detail-modal';
        root.innerHTML=`<div class="attendance-detail-backdrop"></div><div class="attendance-detail-dialog" role="dialog" aria-modal="true"><div class="attendance-detail-header"><div><h2>Detail Absensi</h2><p>${esc(student.name||student.nama||'-')}</p></div><button type="button" class="attendance-detail-close">&times;</button></div><div class="attendance-detail-body"><div class="attendance-detail-meta"><div><span>Departemen</span><strong>${esc(student.department||student.fakultas||student.prodi||'-')}</strong></div><div><span>Periode</span><strong>${esc(month||'Semua periode')}</strong></div></div><div class="attendance-detail-stats"><div><strong class="present">${presentCount}</strong><span>Hadir</span></div><div><strong class="late">${lateCount}</strong><span>Terlambat</span></div><div><strong class="absent">${absent}</strong><span>Absen</span></div><div><strong>${total}</strong><span>Total</span></div></div><div class="attendance-detail-history"><h3>Riwayat Absensi</h3><div class="attendance-detail-table-wrap"><table><thead><tr><th>Tanggal</th><th>Shift</th><th>Clock In</th><th>Clock Out</th><th>Status</th></tr></thead><tbody>${rows||'<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">Belum ada data absensi pada periode ini.</td></tr>'}</tbody></table></div></div></div><div class="attendance-detail-footer"><button type="button" class="attendance-detail-close btn-secondary">Tutup</button></div></div>`;
        document.body.appendChild(root);
        const close=()=>{document.removeEventListener('keydown',key);root.remove();}; const key=e=>{if(e.key==='Escape')close();};
        root.querySelectorAll('.attendance-detail-close').forEach(b=>b.addEventListener('click',close)); root.querySelector('.attendance-detail-backdrop').addEventListener('click',close); document.addEventListener('keydown',key);
    };
})();
