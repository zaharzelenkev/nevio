// Telegram WebApp API
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// Главный объект приложения
const app = {
    currentPage: 'home',
    currentRole: null,
    apiKey: null,

    init() {
        this.loadSettings();
        this.loadUserData();
        this.updateUI();
        this.checkApiKey();
    },

    loadSettings() {
        const theme = localStorage.getItem('theme') || 'light';
        const apiKey = localStorage.getItem('gemini_api_key');
        
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            const toggle = document.getElementById('theme-toggle');
            if (toggle) toggle.checked = true;
        }

        if (apiKey) {
            this.apiKey = apiKey;
            document.getElementById('api-key-input').value = apiKey;
        }
    },

    loadUserData() {
        this.currentRole = localStorage.getItem('user_role');
        
        // Загрузка данных из Telegram
        if (tg?.initDataUnsafe?.user) {
            const user = tg.initDataUnsafe.user;
            const userName = user.first_name || 'Пользователь';
            const userInitial = userName.charAt(0).toUpperCase();
            
            document.getElementById('profile-name').textContent = userName;
            document.getElementById('profile-avatar').textContent = userInitial;
        }
    },

    checkApiKey() {
        if (!this.apiKey) {
            setTimeout(() => {
                if (confirm('Для работы приложения нужен бесплатный API ключ Gemini. Перейти в настройки?')) {
                    this.navigate('settings');
                }
            }, 1000);
        }
    },

    updateUI() {
        // Обновление счётчиков
        const materials = JSON.parse(localStorage.getItem('teacher_materials') || '[]');
        const solutions = JSON.parse(localStorage.getItem('student_solutions') || '[]');
        
        document.getElementById('materials-count').textContent = `${materials.length} материалов`;
        document.getElementById('history-count').textContent = `${solutions.length} решений`;
        document.getElementById('solved-count').textContent = solutions.length;

        // Обновление профиля
        if (this.currentRole) {
            const roleText = this.currentRole === 'teacher' ? 'Учитель' : 'Ученик';
            document.getElementById('profile-role-text').textContent = roleText;
            
            if (this.currentRole === 'student') {
                document.getElementById('extra-label').textContent = 'Решено';
                document.getElementById('extra-value').textContent = solutions.length;
            } else {
                document.getElementById('extra-label').textContent = 'Материалов';
                document.getElementById('extra-value').textContent = materials.length;
            }
        }

        // Достижения
        this.updateAchievements();
        this.updateStreak();
    },

    updateAchievements() {
        const solutions = JSON.parse(localStorage.getItem('student_solutions') || '[]');
        const count = solutions.length;
        
        const badges = [
            { name: '🌱 Первые шаги', required: 1, icon: '🌱' },
            { name: '📚 Ученик', required: 5, icon: '📚' },
            { name: '⭐ Знаток', required: 15, icon: '⭐' },
            { name: '🏆 Мастер', required: 30, icon: '🏆' },
            { name: '💎 Перфекционист', required: 50, icon: '💎' }
        ];

        const badgeList = document.getElementById('badge-list');
        badgeList.innerHTML = '';

        badges.forEach(badge => {
            const unlocked = count >= badge.required;
            const badgeEl = document.createElement('div');
            badgeEl.className = `badge ${unlocked ? 'unlocked' : ''}`;
            badgeEl.innerHTML = `
                <div class="badge-icon">${badge.icon}</div>
                <div class="badge-name">${badge.name.split(' ')[1]}</div>
            `;
            badgeList.appendChild(badgeEl);
        });
    },

    updateStreak() {
        const solutions = JSON.parse(localStorage.getItem('student_solutions') || '[]');
        if (solutions.length === 0) {
            document.getElementById('streak-count').textContent = '0';
            return;
        }

        const dates = solutions.map(s => new Date(s.date).toDateString());
        const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
        
        let streak = 0;
        const today = new Date().toDateString();
        
        for (let i = 0; i < uniqueDates.length; i++) {
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - i);
            
            if (uniqueDates[i] === expectedDate.toDateString()) {
                streak++;
            } else {
                break;
            }
        }

        document.getElementById('streak-count').textContent = streak;
    },

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${pageId}`).classList.add('active');
        this.currentPage = pageId;
        
        // Скрыть навигацию на некоторых страницах
        const hideNavPages = ['create-conspect', 'create-tasks', 'solve', 'teacher-history', 'student-history'];
        const nav = document.getElementById('bottom-nav');
        if (hideNavPages.includes(pageId)) {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
        }
    },

    navigate(page) {
        this.showPage(page);
        
        // Обновление активной кнопки навигации
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
    },

    setRole(role) {
        this.currentRole = role;
        localStorage.setItem('user_role', role);
        
        if (role === 'teacher') {
            this.showPage('teacher');
        } else {
            this.showPage('student');
        }
        
        this.updateUI();
    },

    changeRole() {
        localStorage.removeItem('user_role');
        this.currentRole = null;
        this.navigate('home');
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    },

    saveApiKey() {
        const apiKey = document.getElementById('api-key-input').value.trim();
        
        if (!apiKey) {
            alert('Введите API ключ');
            return;
        }

        localStorage.setItem('gemini_api_key', apiKey);
        this.apiKey = apiKey;
        alert('✅ API ключ сохранён!');
    },

    // === ФУНКЦИИ ДЛЯ УЧИТЕЛЯ ===

    showCreateConspect() {
        this.showPage('create-conspect');
        document.getElementById('conspect-result').classList.add('hidden');
    },

    async generateConspect() {
        const topic = document.getElementById('conspect-topic').value.trim();
        const grade = document.getElementById('conspect-grade').value;
        const subject = document.getElementById('conspect-subject').value;

        if (!topic) {
            alert('Введите тему урока');
            return;
        }

        if (!this.apiKey) {
            alert('Сначала добавьте API ключ в настройках');
            this.navigate('settings');
            return;
        }

        const prompt = `Создай подробный конспект урока для ${grade} по предмету "${subject}" на тему "${topic}".

Структура конспекта:
1. Цели урока
2. Основные понятия и определения
3. Теоретический материал с примерами
4. Практические задания (3-4 задачи с решениями)
5. Домашнее задание

Пиши простым языком, доступным для учеников. Используй примеры из жизни.`;

        this.showLoader();

        try {
            const result = await this.callGeminiAPI(prompt);
            
            document.getElementById('conspect-content').textContent = result;
            document.getElementById('conspect-result').classList.remove('hidden');

            // Сохранение в историю
            const materials = JSON.parse(localStorage.getItem('teacher_materials') || '[]');
            materials.unshift({
                type: 'conspect',
                topic,
                grade,
                subject,
                content: result,
                date: new Date().toISOString()
            });
            localStorage.setItem('teacher_materials', JSON.stringify(materials));
            
            this.updateUI();
        } catch (error) {
            alert('Ошибка генерации: ' + error.message);
        } finally {
            this.hideLoader();
        }
    },

    showCreateTasks() {
        this.showPage('create-tasks');
        document.getElementById('tasks-result').classList.add('hidden');
    },

    async generateTasks() {
        const topic = document.getElementById('tasks-topic').value.trim();
        const count = document.getElementById('tasks-count').value;
        const difficulty = document.getElementById('tasks-difficulty').value;

        if (!topic) {
            alert('Введите тему задач');
            return;
        }

        if (!this.apiKey) {
            alert('Сначала добавьте API ключ в настройках');
            this.navigate('settings');
            return;
        }

        const prompt = `Создай ${count} задач по теме "${topic}" сложности "${difficulty}".

Для каждой задачи укажи:
1. Номер задачи
2. Условие
3. Подробное решение
4. Ответ

Задачи должны быть разнообразными и интересными.`;

        this.showLoader();

        try {
            const result = await this.callGeminiAPI(prompt);
            
            document.getElementById('tasks-content').textContent = result;
            document.getElementById('tasks-result').classList.remove('hidden');

            // Сохранение
            const materials = JSON.parse(localStorage.getItem('teacher_materials') || '[]');
            materials.unshift({
                type: 'tasks',
                topic,
                count,
                difficulty,
                content: result,
                date: new Date().toISOString()
            });
            localStorage.setItem('teacher_materials', JSON.stringify(materials));
            
            this.updateUI();
        } catch (error) {
            alert('Ошибка генерации: ' + error.message);
        } finally {
            this.hideLoader();
        }
    },

    showTeacherHistory() {
        this.showPage('teacher-history');
        const materials = JSON.parse(localStorage.getItem('teacher_materials') || '[]');
        const list = document.getElementById('teacher-history-list');

        if (materials.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">Пока нет созданных материалов</p>';
            return;
        }

        list.innerHTML = materials.map(m => `
            <div class="history-item">
                <div class="history-item-header">
                    <div class="history-item-title">${m.topic || 'Материал'}</div>
                    <div class="history-item-date">${new Date(m.date).toLocaleDateString()}</div>
                </div>
                <div class="history-item-content">${m.content.substring(0, 150)}...</div>
            </div>
        `).join('');
    },

    copyConspect() {
        const content = document.getElementById('conspect-content').textContent;
        navigator.clipboard.writeText(content).then(() => {
            alert('✅ Конспект скопирован!');
        });
    },

    // === ФУНКЦИИ ДЛЯ УЧЕНИКА ===

    showSolveProblem() {
        this.showPage('solve');
        document.getElementById('solution-result').classList.add('hidden');
    },

    async solveProblem() {
        const problem = document.getElementById('problem-input').value.trim();

        if (!problem) {
            alert('Введите задачу');
            return;
        }

        if (!this.apiKey) {
            alert('Сначала добавьте API ключ в настройках');
            this.navigate('settings');
            return;
        }

        const prompt = `Помоги решить эту задачу: "${problem}"

Дай подробное объяснение:
1. Что дано и что нужно найти
2. Какой метод/формул�� использовать
3. Пошаговое решение
4. Ответ
5. Дополнительные пояснения для лучшего понимания

Объясняй простым языком, как хороший учитель.`;

        this.showLoader();

        try {
            const result = await this.callGeminiAPI(prompt);
            
            document.getElementById('solution-content').textContent = result;
            document.getElementById('solution-result').classList.remove('hidden');

            // Временное хранение текущей задачи
            this.currentProblem = { problem, solution: result };
        } catch (error) {
            alert('Ошибка получения решения: ' + error.message);
        } finally {
            this.hideLoader();
        }
    },

    markAsSolved() {
        if (!this.currentProblem) return;

        const solutions = JSON.parse(localStorage.getItem('student_solutions') || '[]');
        solutions.push({
            ...this.currentProblem,
            date: new Date().toISOString()
        });
        localStorage.setItem('student_solutions', JSON.stringify(solutions));

        this.updateUI();
        alert('🎉 Отлично! Задача отмечена как решённая!');
        this.showPage('student');
    },

    showStudentHistory() {
        this.showPage('student-history');
        const solutions = JSON.parse(localStorage.getItem('student_solutions') || '[]');
        const list = document.getElementById('student-history-list');

        if (solutions.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">Пока нет решённых задач</p>';
            return;
        }

        list.innerHTML = solutions.slice().reverse().map(s => `
            <div class="history-item">
                <div class="history-item-header">
                    <div class="history-item-title">${s.problem.substring(0, 50)}...</div>
                    <div class="history-item-date">${new Date(s.date).toLocaleDateString()}</div>
                </div>
                <div class="history-item-content">${s.solution.substring(0, 150)}...</div>
            </div>
        `).join('');
    },

    // === API ===

    async callGeminiAPI(prompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error('API request failed. Check your API key.');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    },

    // === UI HELPERS ===

    showLoader() {
        document.getElementById('loader').classList.remove('hidden');
    },

    hideLoader() {
        document.getElementById('loader').classList.add('hidden');
    }
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
