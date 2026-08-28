/* Detail attendance: show the full expected daily timeline, including ABSEN days. */
(() => {
    const norm = v => String(v ?? '').trim().toLowerCase();
    const arr = v => Array.isArray(v) ? v : (Array.isArray(v?.data) ? v.data : []);
    const val = (o, keys) => { for (const k of keys) if (o?.[k] != null && String(o[k]).trim() !== '') return o[k]; return ''; };
    const dateOf = r => val(r, ['date','tanggal','Date','Tanggal','attendanceDate','attendance_date']);
    const clockIn = r => val(r, ['clockIn','clockin','clock_out','Clock In','Jam Masuk','jamMasuk','jam_masuk']);
    const clockOut = r => val(r, ['clockOut','clockout','clock_out','Clock Out','Jam Pulang','jamPulang','jam_pulang']);
    const statusOf = r => norm(val(r, ['status','Status','Status Kehadiran','statusKehadiran']));
    const isLate = r => statusOf(r) === 'terlambat' || statusOf(r) === 'late';
    const monthOf = v => { const s=String(v??''), m=s.match(/(\d{4})[-\/]([0-9]{1,2})/); return m ? `${m[1]}-${String(m[2]).padStart(2,'0')}` : ''; };
    const nameOf = o => norm(val(o,['name','nama','Nama']));
    const samePerson = (a,b) => { const keys=['id','userId','userID','userid','studentId','studentID','employeeId','employeeID','nim','NIM','email','Email','User ID','Student ID','Employee ID']; for(const k of keys){const x=norm(a?.[k]),y=norm(b?.[k]);if(x&&y&&x===y)return true;} return !!nameOf(a)&&nameOf(a)===nameOf(b); };
    const dateKey = v => { const s=String(v??'').trim(), m=s.match(/(\d{4})[-\/]([0-9]{1,2})[-\/]([0-9]{1,2})/); return m ? `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}` : s.slice(0,10); };
    const esc = v => String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    function buildTimeline(student, month, total) { const records=arr(adminReports.rawAttendance).filter(r=>samePerson(student,r)&&(!month||monthOf(dateOf(r))===month)); const byDate=new Map(); records.forEach(r=>byDate.set(dateKey(dateOf(r)),r)); const dates=new Set(byDate.keys()); return [...dates].sort(); }
    adminReports.viewDetail = function(name){ const month=this.filters?.attendance?.month||document.getElementById('attendance-month')?.value||''; const student=arr(this.rawEmployees).find(s=>nameOf(s)===norm(name)); if(!student){toast.error('Data mahasiswa tidak ditemukan');return;} const records=arr(this.rawAttendance).filter(r=>samePerson(student,r)&&(!month||monthOf(dateOf(r))===month)); const total=Number(this.getFilteredAttendance().find(r=>samePerson(student,r))?.total)||0; const presentCount=records.filter(r=>!!clockIn(r)).length; const lateCount=records.filter(isLate).length; const absent=Math.max(0,total-presentCount-lateCount); const rows=buildTimeline(student,month,total).map(d=>`<tr><td>${esc(d)}</td></tr>`).join(''); document.getElementById('attendance-detail-modal')?.remove(); const root=document.createElement('div'); root.id='attendance-detail-modal'; root.innerHTML=`<div class="attendance-detail-backdrop"></div><div class="attendance-detail-dialog"><div class="attendance-detail-body"><div class="attendance-detail-meta"><div><span>Periode</span><strong>${esc(month||'Semua periode')}</strong></div></div><div class="attendance-detail-stats"><div><strong>${presentCount}</strong><span>Hadir</span></div><div><strong>${lateCount}</strong><span>Terlambat</span></div><div><strong>${absent}</strong><span>Absen</span></div><div><strong>${total}</strong><span>Total</span></div></div>${rows}</div></div>`; document.body.appendChild(root); };
})();
