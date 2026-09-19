/**
 * 掛け算マスター PWA script.js
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State & Storage ---
    const STORAGE_KEY = 'kakezan_master_data_v1';

    let db = loadData();
    let currentGame = {
        mode: null,
        subParam: null,
        questions: [],
        currentIndex: 0,
        correctCount: 0,
        errorCount: 0,
        startTime: 0,
        timerInterval: null,
        elapsedSeconds: 0,
        currentInput: ''
    };

    let historyChartInstance = null;
    let graphRangeMode = 'week'; // 'week' or 'month'
    let graphOffsetDays = 0; // offset from current view
    let calendarDate = new Date();

    // --- DOM Elements ---
    const views = document.querySelectorAll('.view');
    
    // Top
    const topPlayerName = document.getElementById('top-player-name');
    const topStreak = document.getElementById('top-streak');
    const topLastPlay = document.getElementById('top-last-play');

    // Game
    const qNumEl = document.getElementById('game-q-num');
    const qTotalEl = document.getElementById('game-q-total');
    const accuracyEl = document.getElementById('game-accuracy');
    const timerEl = document.getElementById('game-timer');
    const questionTextEl = document.getElementById('question-text');
    const inputDisplayEl = document.getElementById('input-display');
    const taExtraInfo = document.getElementById('ta-extra-info');
    const taScoreEl = document.getElementById('ta-score');
    const taErrorsEl = document.getElementById('ta-errors');

    // Result
    const resModeEl = document.getElementById('res-mode');
    const resScoreEl = document.getElementById('res-score');
    const resAccuracyEl = document.getElementById('res-accuracy');
    const resTimeEl = document.getElementById('res-time');
    const resExtraMsg = document.getElementById('res-extra-msg');

    // History
    const totalPlayTimeEl = document.getElementById('total-play-time');
    const totalAnsCountEl = document.getElementById('total-ans-count');
    const statEndlessRecordEl = document.getElementById('stat-endless-record');
    const calTitleEl = document.getElementById('cal-title');
    const calendarGridEl = document.getElementById('calendar-grid');
    const graphDateRangeEl = document.getElementById('graph-date-range');
    const taTop3ListEl = document.getElementById('ta-top3-list');
    const taOtherListEl = document.getElementById('ta-other-list');
    const historyLogListEl = document.getElementById('history-log-list');

    // Settings
    const setCalTarget = document.getElementById('set-cal-target');
    const setDoubleCount = document.getElementById('set-double-count');
    const setTaTime = document.getElementById('set-ta-time');
    const setSound = document.getElementById('set-sound');
    const setEffect = document.getElementById('set-effect');
    const setUserSelect = document.getElementById('set-user-select');
    const newUserInput = document.getElementById('new-user-name');

    // --- Initialization ---
    initApp();

    function initApp() {
        verifyUserDB();
        updateTopView();
        setupEventListeners();
        registerServiceWorker();
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    // --- Data Management ---
    function getDefaultDB() {
        return {
            currentUserId: 'player_1',
            users: {
                'player_1': { name: 'プレイヤー1' }
            },
            settings: {
                calTarget: 1,
                doubleCount: 5,
                taTime: 30,
                sound: 'bell',
                effect: 'confetti'
            },
            // per user data stored separately or keyed
            userData: {
                'player_1': {
                    history: [],
                    kukuMatrix: initKukuMatrix(), // "a_b": {correct: 0, total: 0, history: [1,0,...]}
                    endlessMax: 0
                }
            }
        };
    }

    function initKukuMatrix() {
        let m = {};
        for(let i=1; i<=9; i++) {
            for(let j=1; j<=9; j++) {
                m[`${i}_${j}`] = { correct: 0, total: 0, history: [] };
            }
        }
        return m;
    }

    function loadData() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            const def = getDefaultDB();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(def));
            return def;
        }
        try {
            return JSON.parse(saved);
        } catch (e) {
            return getDefaultDB();
        }
    }

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }

    function verifyUserDB() {
        if (!db.users[db.currentUserId]) {
            db.currentUserId = Object.keys(db.users)[0] || 'player_1';
        }
        if (!db.userData[db.currentUserId]) {
            db.userData[db.currentUserId] = {
                history: [],
                kukuMatrix: initKukuMatrix(),
                endlessMax: 0
            };
        }
    }

    function getCurrentUserData() {
        verifyUserDB();
        return db.userData[db.currentUserId];
    }

    // --- Navigation ---
    function switchView(viewId) {
        views.forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + viewId);
        if (target) {
            target.classList.add('active');
            onViewEntered(viewId);
        }
    }

    function onViewEntered(viewId) {
        if (viewId === 'top') {
            updateTopView();
        } else if (viewId === 'history') {
            renderHistoryView();
        } else if (viewId === 'settings') {
            renderSettingsView();
        } else if (viewId === 'ranking') {
            renderRankingView();
        } else if (viewId === 'profile') {
            renderProfileView();
        }
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // Navigation buttons
        document.querySelectorAll('[data-target]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = btn.getAttribute('data-target');
                if (target === 'top') switchView('top');
                else if (target === 'play-menu') switchView('play-menu');
                else if (target === 'history-view') switchView('history');
                else if (target === 'settings-view') switchView('settings');
                else if (target === 'ranking-view') switchView('ranking');
            });
        });

        // Play Menu Selection
        document.querySelectorAll('.select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                if (mode === 'order') {
                    buildOrderSelect();
                    switchView('order-select');
                } else {
                    startPlay(mode, null);
                }
            });
        });

        // Quit game
        document.getElementById('btn-quit-game').addEventListener('click', () => {
            if (confirm('ゲームをやめますか？途中経過は保存されません。')) {
                stopGameTimer();
                switchView('top');
            }
        });

        // Numpad input
        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                handleNumpad(btn.getAttribute('data-num'));
            });
        });

        // User profile tap on top
        document.getElementById('btn-user-profile').addEventListener('click', () => {
            switchView('profile');
        });

        // Settings updates
        setCalTarget.addEventListener('change', () => { db.settings.calTarget = parseInt(setCalTarget.value)||1; saveData(); });
        setDoubleCount.addEventListener('change', () => { db.settings.doubleCount = parseInt(setDoubleCount.value)||5; saveData(); });
        setTaTime.addEventListener('change', () => { db.settings.taTime = parseInt(setTaTime.value)||30; saveData(); });
        setSound.addEventListener('change', () => { db.settings.sound = setSound.value; saveData(); });
        setEffect.addEventListener('change', () => { db.settings.effect = setEffect.value; saveData(); });

        document.getElementById('btn-switch-user').addEventListener('click', () => {
            db.currentUserId = setUserSelect.value;
            saveData();
            updateTopView();
            alert(`プレイヤーを ${db.users[db.currentUserId].name} に切り替えました`);
        });

        document.getElementById('btn-add-user').addEventListener('click', () => {
            const name = newUserInput.value.trim();
            if (!name) return;
            const newId = 'player_' + Date.now();
            db.users[newId] = { name };
            db.userData[newId] = { history: [], kukuMatrix: initKukuMatrix(), endlessMax: 0 };
            db.currentUserId = newId;
            newUserInput.value = '';
            saveData();
            renderSettingsView();
            updateTopView();
            alert(`プレイヤー ${name} を追加し切り替えました`);
        });

        // Export / Import
        document.getElementById('btn-export').addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute("href", dataStr);
            dlAnchor.setAttribute("download", "kakezan_master_backup.json");
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const imported = JSON.parse(evt.target.result);
                    if (imported.users && imported.userData) {
                        db = imported;
                        saveData();
                        initApp();
                        alert('データを正常に復元しました！');
                        switchView('top');
                    } else {
                        alert('無効なバックアップファイルです。');
                    }
                } catch (err) {
                    alert('ファイルの読み込みに失敗しました。');
                }
            };
            reader.readAsText(file);
        });

        // History Calendar Nav
        document.getElementById('cal-prev').addEventListener('click', () => {
            calendarDate.setMonth(calendarDate.getMonth() - 1);
            renderCalendar();
        });
        document.getElementById('cal-next').addEventListener('click', () => {
            calendarDate.setMonth(calendarDate.getMonth() + 1);
            renderCalendar();
        });

        // History Graph Range & Nav
        document.querySelectorAll('.range-switch .switch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.range-switch .switch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                graphRangeMode = btn.getAttribute('data-range');
                graphOffsetDays = 0;
                renderGraph();
            });
        });

        document.getElementById('graph-prev').addEventListener('click', () => {
            graphOffsetDays += (graphRangeMode === 'week' ? 7 : 30);
            renderGraph();
        });
        document.getElementById('graph-next').addEventListener('click', () => {
            graphOffsetDays = Math.max(0, graphOffsetDays - (graphRangeMode === 'week' ? 7 : 30));
            renderGraph();
        });
    }

    // --- Top View Logic ---
    function updateTopView() {
        verifyUserDB();
        const user = db.users[db.currentUserId];
        topPlayerName.textContent = user.name;
        
        const uData = getCurrentUserData();
        const streak = calculateStreak(uData.history);
        topStreak.textContent = streak;

        if (uData.history.length > 0) {
            const last = uData.history[uData.history.length - 1];
            topLastPlay.textContent = formatDateTime(last.timestamp);
        } else {
            topLastPlay.textContent = '未プレイ';
        }
    }

    function calculateStreak(history) {
        if (!history || history.length === 0) return 0;
        const daysPlayed = new Set(history.map(h => new Date(h.timestamp).toDateString()));
        let streak = 0;
        let d = new Date();
        while (true) {
            if (daysPlayed.has(d.toDateString())) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else {
                // Check if today hasn't been played yet, check yesterday
                if (streak === 0 && d.toDateString() === new Date().toDateString()) {
                    d.setDate(d.getDate() - 1);
                    continue;
                }
                break;
            }
        }
        return streak;
    }

    // --- Order Stage Select ---
    function buildOrderSelect() {
        const container = document.getElementById('dan-grid-container');
        container.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.className = 'dan-btn';
            btn.textContent = `${i}の段`;
            btn.addEventListener('click', () => {
                startPlay('order', i);
            });
            container.appendChild(btn);
        }
    }

    // --- Game Logic ---
    function startPlay(mode, subParam) {
        currentGame = {
            mode,
            subParam,
            questions: generateQuestions(mode, subParam),
            currentIndex: 0,
            correctCount: 0,
            errorCount: 0,
            startTime: Date.now(),
            timerInterval: null,
            elapsedSeconds: 0,
            currentInput: ''
        };

        switchView('game');
        setupGameUI();
        startGameTimer();
        loadCurrentQuestion();
    }

    function generateQuestions(mode, subParam) {
        let q = [];
        const uData = getCurrentUserData();

        if (mode === 'order') {
            // subParam is dan (1-9)
            for (let i = 1; i <= 9; i++) {
                q.push({ a: subParam, b: i, ans: subParam * i });
            }
        } else if (mode === 'random') {
            for (let i = 0; i < 9; i++) {
                let a = Math.floor(Math.random() * 9) + 1;
                let b = Math.floor(Math.random() * 9) + 1;
                q.push({ a, b, ans: a * b });
            }
        } else if (mode === 'review') {
            // Sort kuku matrix by accuracy ascending
            let entries = [];
            for(let key in uData.kukuMatrix) {
                let item = uData.kukuMatrix[key];
                let acc = item.total > 0 ? (item.correct / item.total) : 0;
                let [a, b] = key.split('_').map(Number);
                entries.push({ a, b, acc, total: item.total });
            }
            entries.sort((x, y) => {
                if (x.acc !== y.acc) return x.acc - y.acc;
                return x.total - y.total;
            });

            for (let i = 0; i < 9 && i < entries.length; i++) {
                let a = entries[i].a;
                let b = entries[i].b;
                q.push({ a, b, ans: a * b });
            }
            // Fallback if not enough entries
            while(q.length < 9) {
                let a = Math.floor(Math.random() * 9) + 1;
                let b = Math.floor(Math.random() * 9) + 1;
                q.push({ a, b, ans: a * b });
            }
        } else if (mode === 'double') {
            const count = db.settings.doubleCount || 5;
            for (let i = 0; i < count; i++) {
                let isLeftDouble = Math.random() < 0.5;
                let a, b;
                if (isLeftDouble) {
                    a = Math.floor(Math.random() * 90) + 10; // 10-99
                    b = Math.floor(Math.random() * 9) + 1;   // 1-9
                } else {
                    a = Math.floor(Math.random() * 9) + 1;   // 1-9
                    b = Math.floor(Math.random() * 90) + 10; // 10-99
                }
                q.push({ a, b, ans: a * b });
            }
        } else if (mode === 'endless') {
            // Endless starts with random kuku
            let a = Math.floor(Math.random() * 9) + 1;
            let b = Math.floor(Math.random() * 9) + 1;
            q.push({ a, b, ans: a * b });
        } else if (mode === 'timeattack') {
            // Generates continuous random questions for TA
            for (let i = 0; i < 50; i++) {
                let a = Math.floor(Math.random() * 9) + 1;
                let b = Math.floor(Math.random() * 9) + 1;
                q.push({ a, b, ans: a * b });
            }
        }
        return q;
    }

    function setupGameUI() {
        currentGame.currentInput = '';
        inputDisplayEl.textContent = '?';
        
        if (currentGame.mode === 'endless') {
            qTotalEl.textContent = '∞';
            taExtraInfo.classList.add('hidden');
        } else if (currentGame.mode === 'timeattack') {
            qTotalEl.textContent = 'TA';
            taExtraInfo.classList.remove('hidden');
            taScoreEl.textContent = currentGame.correctCount;
            taErrorsEl.textContent = currentGame.errorCount;
        } else {
            qTotalEl.textContent = currentGame.questions.length;
            taExtraInfo.classList.add('hidden');
        }
    }

    function startGameTimer() {
        currentGame.elapsedSeconds = 0;
        timerEl.textContent = '0';
        currentGame.startTime = Date.now();
        
        if (currentGame.mode === 'timeattack') {
            let limit = db.settings.taTime || 30;
            currentGame.timerInterval = setInterval(() => {
                currentGame.elapsedSeconds++;
                let remaining = limit - currentGame.elapsedSeconds;
                timerEl.textContent = Math.max(0, remaining);
                if (remaining <= 0) {
                    stopGameTimer();
                    endGame();
                }
            }, 1000);
        } else {
            currentGame.timerInterval = setInterval(() => {
                currentGame.elapsedSeconds++;
                timerEl.textContent = currentGame.elapsedSeconds;
            }, 1000);
        }
    }

    function stopGameTimer() {
        if (currentGame.timerInterval) {
            clearInterval(currentGame.timerInterval);
            currentGame.timerInterval = null;
        }
    }

    function loadCurrentQuestion() {
        if (currentGame.mode === 'endless' && currentGame.currentIndex >= currentGame.questions.length) {
            // Add more questions
            let includeDouble = currentGame.currentIndex >= 81; // After all kuku
            let a, b;
            if (includeDouble && Math.random() < 0.5) {
                let isLeft = Math.random() < 0.5;
                a = isLeft ? Math.floor(Math.random() * 90) + 10 : Math.floor(Math.random() * 9) + 1;
                b = isLeft ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * 90) + 10;
            } else {
                a = Math.floor(Math.random() * 9) + 1;
                b = Math.floor(Math.random() * 9) + 1;
            }
            currentGame.questions.push({ a, b, ans: a * b });
        }

        if (currentGame.mode !== 'endless' && currentGame.mode !== 'timeattack' && currentGame.currentIndex >= currentGame.questions.length) {
            endGame();
            return;
        }

        if (currentGame.mode === 'timeattack' && currentGame.currentIndex >= currentGame.questions.length) {
            // replenish TA questions if run out
            for (let i = 0; i < 20; i++) {
                let a = Math.floor(Math.random() * 9) + 1;
                let b = Math.floor(Math.random() * 9) + 1;
                currentGame.questions.push({ a, b, ans: a * b });
            }
        }

        const q = currentGame.questions[currentGame.currentIndex];
        questionTextEl.textContent = `${q.a} × ${q.b} = ?`;
        qNumEl.textContent = currentGame.currentIndex + 1;
        
        let totalAns = currentGame.correctCount + currentGame.errorCount;
        let acc = totalAns > 0 ? Math.round((currentGame.correctCount / totalAns) * 100) : 100;
        accuracyEl.textContent = acc;

        currentGame.currentInput = '';
        inputDisplayEl.textContent = '?';
    }

    function handleNumpad(val) {
        if (val === 'clear') {
            currentGame.currentInput = '';
        } else if (val === 'enter') {
            if (currentGame.currentInput !== '') {
                checkAnswer(parseInt(currentGame.currentInput));
            }
            return;
        } else {
            if (currentGame.currentInput.length < 4) {
                currentGame.currentInput += val;
            }
        }
        inputDisplayEl.textContent = currentGame.currentInput || '?';
    }

    function checkAnswer(userAns) {
        const q = currentGame.questions[currentGame.currentIndex];
        const isCorrect = (userAns === q.ans);

        recordAnswerToMatrix(q, isCorrect);

        if (isCorrect) {
            currentGame.correctCount++;
            playEffectAndSound();
            
            if (currentGame.mode === 'timeattack') {
                taScoreEl.textContent = currentGame.correctCount;
                currentGame.currentIndex++;
                loadCurrentQuestion();
            } else if (currentGame.mode === 'endless') {
                currentGame.currentIndex++;
                loadCurrentQuestion();
            } else {
                currentGame.currentIndex++;
                loadCurrentQuestion();
            }
        } else {
            currentGame.errorCount++;
            if (currentGame.mode === 'endless') {
                // Game over on endless mistake
                endGame();
                return;
            } else if (currentGame.mode === 'timeattack') {
                taErrorsEl.textContent = currentGame.errorCount;
                currentGame.currentIndex++;
                loadCurrentQuestion();
            } else {
                // Wrong in standard modes: flash red or proceed
                alert(`ざんねん！正解は ${q.ans} でした。`);
                currentGame.currentIndex++;
                loadCurrentQuestion();
            }
        }
    }

    function recordAnswerToMatrix(q, isCorrect) {
        // Only record kuku items (1-9 x 1-9) in matrix
        if (q.a <= 9 && q.b <= 9) {
            const uData = getCurrentUserData();
            const key = `${q.a}_${q.b}`;
            if (!uData.kukuMatrix[key]) {
                uData.kukuMatrix[key] = { correct: 0, total: 0, history: [] };
            }
            let item = uData.kukuMatrix[key];
            item.total++;
            if (isCorrect) item.correct++;
            item.history.push(isCorrect ? 1 : 0);
            if (item.history.length > 10) item.history.shift();
        }
    }

    function playEffectAndSound() {
        const settings = db.settings;
        // Sound
        if (settings.sound === 'bell') {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            } catch(e){}
        } else if (settings.sound === 'pop') {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } catch(e){}
        }

        // Effect
        if (typeof confetti !== 'undefined') {
            if (settings.effect === 'confetti') {
                confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
            } else if (settings.effect === 'cracker') {
                confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
                confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
            } else if (settings.effect === 'star') {
                confetti({ particleCount: 40, spread: 100, shapes: ['star'], colors: ['#ffd700', '#ffa500'] });
            }
        }
    }

    function endGame() {
        stopGameTimer();
        const uData = getCurrentUserData();
        const totalQ = currentGame.correctCount + currentGame.errorCount;
        const accuracy = totalQ > 0 ? Math.round((currentGame.correctCount / totalQ) * 100) : 0;
        const timeSpent = currentGame.elapsedSeconds;

        let modeName = currentGame.mode;
        if (modeName === 'order') modeName = `順番 (${currentGame.subParam}の段)`;
        else if (modeName === 'random') modeName = 'ランダム(9問)';
        else if (modeName === 'review') modeName = '復習';
        else if (modeName === 'double') modeName = '２桁';
        else if (modeName === 'endless') modeName = '間違えるまで';
        else if (modeName === 'timeattack') modeName = 'タイムアタック';

        // Save history entry
        const historyEntry = {
            mode: modeName,
            modeCode: currentGame.mode,
            timestamp: Date.now(),
            totalCount: totalQ,
            correctCount: currentGame.correctCount,
            errorCount: currentGame.errorCount,
            accuracy: accuracy,
            timeSpent: timeSpent
        };

        uData.history.push(historyEntry);

        let extraMsgText = '';
        if (currentGame.mode === 'endless') {
            let score = currentGame.correctCount;
            if (score > uData.endlessMax) {
                uData.endlessMax = score;
                extraMsgText = `🏆 新記録達成！ 間違えるまで記録: ${score}問`;
            } else {
                extraMsgText = `記録: ${score}問 (最高: ${uData.endlessMax}問)`;
            }
        } else if (currentGame.mode === 'timeattack') {
            extraMsgText = `正解数: ${currentGame.correctCount}問 (誤答: ${currentGame.errorCount})`;
        }

        saveData();

        // Show result view
        resModeEl.textContent = modeName;
        resScoreEl.textContent = `${currentGame.correctCount} / ${totalQ}`;
        resAccuracyEl.textContent = accuracy;
        resTimeEl.textContent = timeSpent;
        resExtraMsg.textContent = extraMsgText;

        switchView('result');
    }

    // --- History View Rendering ---
    function renderHistoryView() {
        verifyUserDB();
        const uData = getCurrentUserData();

        // Totals
        let totalTimeSec = uData.history.reduce((acc, cur) => acc + (cur.timeSpent || 0), 0);
        let totalAns = uData.history.reduce((acc, cur) => acc + (cur.totalCount || 0), 0);
        
        totalPlayTimeEl.textContent = Math.floor(totalTimeSec / 60) + '分';
        totalAnsCountEl.textContent = totalAns + '問';
        statEndlessRecordEl.textContent = uData.endlessMax + '問';

        renderCalendar();
        renderGraph();
        renderTARecords();
        renderHistoryLogs();
    }

    function renderCalendar() {
        const uData = getCurrentUserData();
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        calTitleEl.textContent = `${year}年 ${month + 1}月`;

        calendarGridEl.innerHTML = '';
        const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
        daysOfWeek.forEach(d => {
            const div = document.createElement('div');
            div.className = 'cal-header-cell';
            div.textContent = d;
            calendarGridEl.appendChild(div);
        });

        // Count plays per day string
        let playCountByDate = {};
        uData.history.forEach(h => {
            let dStr = new Date(h.timestamp).toDateString();
            playCountByDate[dStr] = (playCountByDate[dStr] || 0) + 1;
        });

        const targetCount = db.settings.calTarget || 1;
        const firstDayIndex = new Date(year, month, 1).getDay();
        const lastDayDate = new Date(year, month + 1, 0).getDate();

        // Blank cells before first day
        for (let i = 0; i < firstDayIndex; i++) {
            const div = document.createElement('div');
            calendarGridEl.appendChild(div);
        }

        for (let day = 1; day <= lastDayDate; day++) {
            const d = new Date(year, month, day);
            const dStr = d.toDateString();
            const count = playCountByDate[dStr] || 0;
            const isMarked = count >= targetCount;

            const div = document.createElement('div');
            div.className = `cal-cell ${isMarked ? 'marked' : ''}`;
            div.textContent = day;
            calendarGridEl.appendChild(div);
        }
    }

    function renderGraph() {
        const uData = getCurrentUserData();
        const ctx = document.getElementById('historyChart').getContext('2d');
        
        // Calculate date range
        let now = new Date();
        now.setHours(23, 59, 59, 999);
        let spanDays = graphRangeMode === 'week' ? 7 : 30;
        
        let endDate = new Date(now);
        endDate.setDate(endDate.getDate() - graphOffsetDays);
        let startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - spanDays + 1);
        startDate.setHours(0, 0, 0, 0);

        graphDateRangeEl.textContent = `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`;

        // Aggregate data by date
        let dateMap = {};
        let dIter = new Date(startDate);
        let labels = [];
        let playCounts = [];
        let accuracySums = [];
        let accuracyCounts = [];

        while (dIter <= endDate) {
            let key = dIter.toDateString();
            labels.push(`${dIter.getMonth()+1}/${dIter.getDate()}`);
            dateMap[key] = { count: 0, accSum: 0, accCount: 0 };
            dIter.setDate(dIter.getDate() + 1);
        }

        uData.history.forEach(h => {
            let hDate = new Date(h.timestamp);
            let key = hDate.toDateString();
            if (dateMap[key]) {
                dateMap[key].count++;
                dateMap[key].accSum += h.accuracy;
                dateMap[key].accCount++;
            }
        });

        dIter = new Date(startDate);
        while (dIter <= endDate) {
            let key = dIter.toDateString();
            let data = dateMap[key];
            playCounts.push(data.count);
            accuracyCounts.push(data.accCount > 0 ? Math.round(data.accSum / data.accCount) : 0);
            dIter.setDate(dIter.getDate() + 1);
        }

        if (historyChartInstance) {
            historyChartInstance.destroy();
        }

        historyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'プレイ回数',
                        data: playCounts,
                        backgroundColor: '#3b82f6',
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: '平均正答率(%)',
                        data: accuracyCounts,
                        type: 'line',
                        borderColor: '#f59e0b',
                        backgroundColor: '#f59e0b',
                        yAxisID: 'y1',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        max: 100,
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    function renderTARecords() {
        const uData = getCurrentUserData();
        // Filter Time Attack records
        let taLogs = uData.history.filter(h => h.modeCode === 'timeattack');
        // Sort by correctCount desc, accuracy desc, timeSpent asc
        taLogs.sort((a, b) => {
            if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
            if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
            return a.timeSpent - b.timeSpent;
        });

        taTop3ListEl.innerHTML = '';
        taOtherListEl.innerHTML = '';

        taLogs.forEach((log, index) => {
            let li = document.createElement('li');
            li.innerHTML = `<span>${index+1}位: 正解 ${log.correctCount}問 (正答率 ${log.accuracy}%)</span><span>${formatDateTime(log.timestamp)}</span>`;
            if (index < 3) {
                taTop3ListEl.appendChild(li);
            } else {
                taOtherListEl.appendChild(li);
            }
        });

        if (taTop3ListEl.children.length === 0) {
            taTop3ListEl.innerHTML = '<li class="log-item">記録なし</li>';
        }
        if (taOtherListEl.children.length === 0) {
            taOtherListEl.innerHTML = '<li class="log-item">記録なし</li>';
        }
    }

    function renderHistoryLogs() {
        const uData = getCurrentUserData();
        historyLogListEl.innerHTML = '';
        
        // Reverse chronological
        let sorted = [...uData.history].reverse();
        sorted.forEach(h => {
            let div = document.createElement('div');
            div.className = 'log-item';
            div.innerHTML = `
                <div>
                    <strong>${h.mode}</strong><br>
                    <small>${formatDateTime(h.timestamp)}</small>
                </div>
                <div style="text-align:right;">
                    出題:${h.totalCount} | 正解率:${h.accuracy}%<br>
                    時間:${h.timeSpent}秒
                </div>
            `;
            historyLogListEl.appendChild(div);
        });

        if (sorted.length === 0) {
            historyLogListEl.innerHTML = '<div class="log-item">履歴がありません</div>';
        }
    }

    // --- Settings View Rendering ---
    function renderSettingsView() {
        verifyUserDB();
        const settings = db.settings;
        setCalTarget.value = settings.calTarget;
        setDoubleCount.value = settings.doubleCount;
        setTaTime.value = settings.taTime;
        setSound.value = settings.sound;
        setEffect.value = settings.effect;

        // User select dropdown
        setUserSelect.innerHTML = '';
        for (let uId in db.users) {
            let opt = document.createElement('option');
            opt.value = uId;
            opt.textContent = db.users[uId].name;
            if (uId === db.currentUserId) opt.selected = true;
            setUserSelect.appendChild(opt);
        }
    }

    // --- Ranking View Rendering ---
    function renderRankingView() {
        const rankingContainer = document.getElementById('ranking-container');
        rankingContainer.innerHTML = '';

        // Collect stats across all users
        let usersPlayCount = [];
        let usersCorrectCount = [];
        let usersAccuracy = [];
        let usersStreak = [];
        let usersTARanking = [];

        for (let uId in db.users) {
            let uName = db.users[uId].name;
            let uData = db.userData[uId] || { history: [] };

            let playCount = uData.history.length;
            let correctSum = uData.history.reduce((acc, h) => acc + h.correctCount, 0);
            let totalSum = uData.history.reduce((acc, h) => acc + h.totalCount, 0);
            let accuracy = totalSum > 0 ? Math.round((correctSum / totalSum) * 100) : 0;
            let streak = calculateStreak(uData.history);

            let lastPlayDate = playCount > 0 ? formatDateTime(uData.history[uData.history.length - 1].timestamp) : '-';

            usersPlayCount.push({ name: uName, val: playCount, date: lastPlayDate });
            usersCorrectCount.push({ name: uName, val: correctSum, date: lastPlayDate });
            usersAccuracy.push({ name: uName, val: accuracy, date: lastPlayDate });
            usersStreak.push({ name: uName, val: streak, date: lastPlayDate });

            // TA best score
            let taLogs = uData.history.filter(h => h.modeCode === 'timeattack');
            if (taLogs.length > 0) {
                taLogs.sort((a, b) => b.correctCount - a.correctCount || b.accuracy - a.accuracy);
                usersTARanking.push({ name: uName, val: taLogs[0].correctCount, date: formatDateTime(taLogs[0].timestamp) });
            }
        }

        // Sort helpers
        usersPlayCount.sort((a,b) => b.val - a.val);
        usersCorrectCount.sort((a,b) => b.val - a.val);
        usersAccuracy.sort((a,b) => b.val - a.val);
        usersStreak.sort((a,b) => b.val - a.val);
        usersTARanking.sort((a,b) => b.val - a.val);

        createRankingSection('プレイ回数ランキング', usersPlayCount, '回');
        createRankingSection('正解数ランキング', usersCorrectCount, '問');
        createRankingSection('正答率ランキング', usersAccuracy, '%');
        createRankingSection('連続プレイ日数ランキング', usersStreak, '日');
        createRankingSection('タイムアタック最高記録ランキング', usersTARanking, '問');
    }

    function createRankingSection(title, list, unit) {
        const rankingContainer = document.getElementById('ranking-container');
        const sec = document.createElement('div');
        sec.className = 'ranking-section';
        
        let html = `<h3>${title}</h3>`;
        list.forEach((item, idx) => {
            html += `
                <div class="ranking-item">
                    <span><strong>${idx+1}位</strong> ${item.name}</span>
                    <span>${item.val}${unit} <small>(${item.date})</small></span>
                </div>
            `;
        });
        if (list.length === 0) {
            html += '<div class="ranking-item">データなし</div>';
        }
        sec.innerHTML = html;
        rankingContainer.appendChild(sec);
    }

    // --- Profile / Weakness Matrix View ---
    function renderProfileView() {
        verifyUserDB();
        const user = db.users[db.currentUserId];
        document.getElementById('profile-user-name').textContent = user.name;

        const container = document.getElementById('kuku-matrix-container');
        container.innerHTML = '';

        const uData = getCurrentUserData();
        const matrixGrid = document.createElement('div');
        matrixGrid.className = 'matrix-grid';

        for (let i = 1; i <= 9; i++) {
            for (let j = 1; j <= 9; j++) {
                let key = `${i}_${j}`;
                let item = uData.kukuMatrix[key] || { correct: 0, total: 0 };
                let acc = item.total > 0 ? Math.round((item.correct / item.total) * 100) : null;

                let bg = '#cbd5e1'; // default gray
                if (acc !== null) {
                    if (acc >= 80) bg = '#22c55e'; // green
                    else if (acc >= 50) bg = '#f59e0b'; // orange
                    else bg = '#ef4444'; // red
                }

                let cell = document.createElement('div');
                cell.className = 'matrix-cell';
                cell.style.backgroundColor = bg;
                cell.innerHTML = `${i}×${j}<br><span class="sub">${acc !== null ? acc + '%' : '-'}</span>`;
                matrixGrid.appendChild(cell);
            }
        }
        container.appendChild(matrixGrid);
    }

    // --- Utility Formatters ---
    function formatDateTime(ts) {
        const d = new Date(ts);
        return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function formatDateShort(d) {
        return `${d.getMonth()+1}/${d.getDate()}`;
    }
});