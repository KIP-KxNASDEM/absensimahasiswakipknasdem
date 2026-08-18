/**
 * Portal Mahasiswa - Dashboard
 * Dashboard functionality and charts
 */

const dashboard = {
    initialized: false,
    attendanceData: [],

    async init() {
        if (this.initialized) return;

        await this.loadData();

        this.updateWelcomeCard();
        this.updateStats();
        this.updateSessionInfo();
        this.updateProgressBar();

        this.initialized = true;
    },


    async loadData() {
        try {

            const currentUser = auth.getCurrentUser();

            if (
                currentUser &&
                (
                    currentUser.id ||
                    currentUser.uid ||
                    currentUser.userId ||
                    currentUser.studentId
                )
            ) {

                const userId =
                    currentUser.id ||
                    currentUser.uid ||
                    currentUser.userId ||
                    currentUser.studentId;


                const [attResult, settingsRes] = await Promise.all([
                    api.getAttendance(userId),
                    api.getSettings()
                ]);


                this.attendanceData =
                    (attResult && attResult.success)
                    ? attResult.data
                    : [];


                // Sync jadwal shift dari admin
                if (
                    settingsRes &&
                    settingsRes.success &&
                    settingsRes.data
                ) {

                    const globalSettings = settingsRes.data;
                    const loadedSchedules = {};


                    Object.keys(globalSettings).forEach(k => {

                        if (k.startsWith('shift_schedule_')) {

                            const monthKey =
                                k.replace(
                                    'shift_schedule_',
                                    ''
                                );

                            try {

                                loadedSchedules[monthKey] =
                                    JSON.parse(
                                        globalSettings[k]
                                    );

                            } catch(e){}

                        }

                    });


                    if(
                        Object.keys(loadedSchedules).length > 0
                    ){

                        storage.set(
                            'shift_schedule',
                            loadedSchedules
                        );

                    }

                }

            }


        } catch(error){

            console.error(
                'Error loading dashboard data:',
                error
            );

            this.attendanceData = [];

        }
    },


    updateWelcomeCard() {


        const welcomeCard =
            document.querySelector('.welcome-card');


        const greetingEl =
            document.querySelector(
                '.welcome-content h2'
            );


        const shiftEl =
            document.getElementById(
                'welcome-shift'
            );


        const iconEl =
            document.querySelector(
                '.welcome-illustration i'
            );



        if(!welcomeCard || !greetingEl)
            return;



        const hour =
            new Date().getHours();



        let greeting = 'Selamat Pagi';
        let icon = 'fa-sun';
        let className = 'morning';



        if(hour >= 11 && hour < 15){

            greeting='Selamat Siang';
            icon='fa-sun';
            className='afternoon';

        }
        else if(hour >=15 && hour <18){

            greeting='Selamat Sore';
            icon='fa-cloud-sun';
            className='evening';

        }
        else if(hour >=18){

            greeting='Selamat Malam';
            icon='fa-moon';
            className='evening';

        }



        const user =
            auth.getCurrentUser();



        const userName =
            user?.name?.split(' ')[0] || 'User';



        greetingEl.innerHTML =
            `${greeting}, <span id="welcome-name">${userName}</span>! 👋`;



        if(iconEl){

            iconEl.className =
                `fas ${icon}`;

        }


        welcomeCard.className =
            `welcome-card ${className}`;



        let currentShiftName =
            user?.shift || 'Pagi';



        try {


            const userId =
                String(
                    user?.id ||
                    user?.uid ||
                    user?.userId ||
                    user?.studentId ||
                    user?.nim ||
                    ''
                );



            const now = new Date();


            const key =
                `${now.getFullYear()}-${now.getMonth()+1}`;


            const currentDay =
                now.getDate();



            const schedules =
                storage.get(
                    'shift_schedule',
                    {}
                );



            console.log(
                'Dashboard Shift Sync - Key:',
                key,
                'UserId:',
                userId,
                'Day:',
                currentDay
            );



            if(
                schedules[key] &&
                schedules[key][userId]
            ){


                const assignedShift =
                    schedules[key][userId][currentDay];



                if(assignedShift){

                    currentShiftName =
                        assignedShift;

                }

            }


        }catch(e){

            console.error(
                'Error reading shift schedule:',
                e
            );

        }



        const shifts =
            storage.get(
                'shifts',
                []
            );


        const activeShift =
            shifts.find(
                s=>s.name===currentShiftName
            )
            ||
            shifts[0]
            ||
            {
                name:'Pagi',
                startTime:'08:00',
                endTime:'17:00'
            };



        if(shiftEl){

            if(currentShiftName==='Libur'){

                shiftEl.textContent =
                'Shift: Libur (Tidak ada jadwal)';

            }
            else{

                shiftEl.textContent =
                `Shift: ${activeShift.name} (${activeShift.startTime} - ${activeShift.endTime})`;

            }

        }

    },

        updateStats(){

        const attendance =
            this.attendanceData || [];


        const total =
            Math.max(
                26,
                attendance.length
            );


        const present =
            attendance.filter(
                a=>a.status==='ontime'
            ).length;


        const late =
            attendance.filter(
                a=>a.status==='late'
            ).length;


        const absent =
            attendance.filter(
                a=>a.status==='absent'
            ).length;



        const presentPercent =
            total > 0
            ?
            Math.round(
                (present / total) * 100
            )
            :
            0;



        const donutValue =
            document.querySelector(
                '.donut-value'
            );


        if(donutValue){

            donutValue.textContent =
                `${presentPercent}%`;

        }



        const legendValues =
            document.querySelectorAll(
                '.legend-value'
            );


        if(legendValues.length >= 3){

            legendValues[0].textContent =
                `${present} hari`;

            legendValues[1].textContent =
                `${late} hari`;

            legendValues[2].textContent =
                `${absent} hari`;

        }

    },



    updateSessionInfo(){


        const today =
            dateTime.getLocalDate();



        const attendance =
            this.attendanceData || [];



        const todayAttendance =
            attendance.find(
                a=>a.date===today
            );



        const clockInEl =
            document.getElementById(
                'dashboard-clock-in'
            );


        const clockOutEl =
            document.getElementById(
                'dashboard-clock-out'
            );


        const durationEl =
            document.getElementById(
                'dashboard-duration'
            );



        if(clockInEl)
            clockInEl.textContent='--:--';


        if(clockOutEl)
            clockOutEl.textContent='--:--';


        if(durationEl)
            durationEl.textContent='0j 0m';




        if(todayAttendance){


            if(clockInEl)
                clockInEl.textContent =
                    todayAttendance.clockIn || '--:--';



            if(clockOutEl)
                clockOutEl.textContent =
                    todayAttendance.clockOut || '--:--';




            if(
                todayAttendance.clockIn &&
                todayAttendance.clockOut &&
                durationEl
            ){

                durationEl.textContent =
                    dateTime.calculateDuration(
                        todayAttendance.clockIn,
                        todayAttendance.clockOut
                    );

            }

        }

    },



    updateProgressBar(){


        const now =
            new Date();



        const currentHour =
            now.getHours();



        const currentMinute =
            now.getMinutes();



        const currentTime =
            currentHour +
            (currentMinute / 60);



        const startHour = 8;
        const endHour = 17;



        const totalHours =
            endHour - startHour;



        let progress =
            (
                (currentTime - startHour)
                /
                totalHours
            )
            *
            100;



        progress =
            Math.max(
                0,
                Math.min(
                    100,
                    progress
                )
            );



        const progressFill =
            document.getElementById(
                'work-progress'
            );



        if(progressFill){

            progressFill.style.width =
                `${progress}%`;

        }

    }

};



// Global init router

window.initDashboard =
async function(){

    await dashboard.init();

};



// Auto update progress

setInterval(()=>{


    const page =
        document.getElementById(
            'page-dashboard'
        );


    if(
        page &&
        page.classList.contains('active')
    ){

        dashboard.updateProgressBar();

    }


},60000);
