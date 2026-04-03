const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

window.app = {
  currentPage: 'home',
  currentRole: localStorage.getItem('nevio_role') || null,
  notificationsEnabled: localStorage.getItem('nevio_notifications') !== 'false',
  currentSolvedDraft: null,

  init() {
    this.applyTheme();
    this.loadTelegramProfile();
    this.bindSettings();
    this.renderRoleEntry();
    this.updateSidebarRole();
    this.updateAllDashboards();
    this.navigate('home');
  },

  getStorage(key, fallback = []) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  },

  setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  loadTelegramProfile() {
    let user = tg?.initDataUnsafe?.user || {
      first_name: 'Невио',
      last_name: '',
      username: 'local_user'
    };

    const firstName = user.first_name || 'Пользователь';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const avatarLetter = firstName.charAt(0).toUpperCase();

    document.getElementById('profile-name').textContent = fullName;
    document.getElementById('profile-avatar').textContent = avatarLetter;
  },

  bindSettings() {
    const theme = localStorage.getItem('nevio_theme') || 'dark';
    document.getElementById('theme-toggle').checked = theme === 'light';
    document.getElementById('notify-toggle').checked = this.notificationsEnabled;
  },

  applyTheme() {
    const theme = localStorage.getItem('nevio_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nevio_theme', next);
    document.getElementById('theme-toggle').checked = next === 'light';
    this.toast(`Тема переключена`);
  },

  toggleNotifications() {
    this.notificationsEnabled = document.getElementById('notify-toggle').checked;
    localStorage.setItem('nevio_notifications', String(this.notificationsEnabled));
    this.toast(this.notificationsEnabled ? 'Уведомления включены' : 'Уведомления выключены');
  },

  navigate(page) {
    this.showPage(page);
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });
  },

  showPage(page) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    this.currentPage = page;

    if (page === 'student-topics') this.renderTopicsJournal();
    if (page === 'quests') this.renderQuestPage();
    if (page === 'teacher-bank') this.renderTeacherBank();
    if (page === 'student-history') this.renderStudentHistory();
  },

  setRole(role) {
    this.currentRole = role;
    localStorage.setItem('nevio_role', role);
    this.updateSidebarRole();
    this.renderRoleEntry();
    this.updateAllDashboards();

    if (role === 'teacher') this.showPage('teacher');
    if (role === 'student') this.showPage('student');
  },

  changeRole() {
    localStorage.removeItem('nevio_role');
    this.currentRole = null;
    this.updateSidebarRole();
    this.renderRoleEntry();
    this.showPage('home');
    this.toast('Роль сброшена');
  },

  updateSidebarRole() {
    const roleMap = { teacher: 'Учитель', student: 'Ученик' };
    const roleText = roleMap[this.currentRole] || 'Не выбрана';
    document.getElementById('sidebar-role').textContent = roleText;
    document.getElementById('profile-role').textContent = roleText;
  },

  renderRoleEntry() {
    const wrap = document.getElementById('role-entry-panels');
    if (!this.currentRole) {
      wrap.innerHTML = '';
      return;
    }

    wrap.innerHTML = `
      <div class="panel" style="margin-top:18px;">
        <div class="panel-header">
          <h3>${this.currentRole === 'teacher' ? 'Быстрый вход в режим учителя' : 'Быстрый вход в режим ученика'}</h3>
          <button class="ghost-btn" onclick="app.showPage('${this.currentRole}')">Открыть</button>
        </div>
        <p class="muted">${this.currentRole === 'teacher'
          ? 'Продолжайте создавать конспекты, тесты и практику.'
          : 'Продолжайте решать задачи, проходить квесты и итог дня.'}</p>
      </div>
    `;
  },

  toast(message) {
    if (!this.notificationsEnabled) return;
    if (tg?.showPopup) {
      tg.showPopup({
        title: 'Невио',
        message,
        buttons: [{ type: 'ok' }]
      });
    } else {
      alert(message);
    }
  },

  showLoader() {
    document.getElementById('loader').classList.remove('hidden');
  },

  hideLoader() {
    document.getElementById('loader').classList.add('hidden');
  },

  copyTextById(id) {
    const text = document.getElementById(id)?.textContent?.trim();
    if (!text) return this.toast('Нет текста для копирования');
    navigator.clipboard.writeText(text).then(() => this.toast('Скопировано'));
  },

  async askAI(prompt, mode = 'general') {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Ошибка запроса к AI');
    }

    return response.json();
  },

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ru-RU');
  },

  formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('ru-RU');
  },

  todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  getLast7DaysKeys() {
    const arr = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return arr;
  },

  extractTopicFromText(text) {
    const cleaned = text.trim().replace(/\s+/g, ' ');
    if (cleaned.length <= 60) return cleaned;
    return cleaned.slice(0, 60).trim();
  },

  async generateConspect() {
    const topic = document.getElementById('conspect-topic').value.trim();
    const grade = document.getElementById('conspect-grade').value;
    const subject = document.getElementById('conspect-subject').value;
    if (!topic) return this.toast('Введите тему');

    const prompt = `
Создай профессиональный конспект урока для ${grade} по предмету "${subject}" на тему "${topic}".

Структура:
1. Тема и цель урока
2. План урока
3. Теория простым и точным языком
4. Примеры
5. Практика
6. Типичные ошибки
7. Домашнее задание
8. Мини-итог

Пиши структурно и без воды.
`;

    this.showLoader();
    try {
      const data = await this.askAI(prompt, 'teacher');
      document.getElementById('conspect-result').textContent = data.text;
      document.getElementById('conspect-result-panel').classList.remove('hidden');

      this.saveTeacherMaterial({
        type: 'Конспект',
        topic,
        meta: `${subject}, ${grade}`,
        content: data.text
      });

      this.updateAllDashboards();
      this.toast('Конспект создан');
    } catch (e) {
      this.toast(e.message);
    } finally {
      this.hideLoader();
    }
  },

  async generatePractice() {
    const topic = document.getElementById('practice-topic').value.trim();
    const count = document.getElementById('practice-count').value.trim();
    const difficulty = document.getElementById('practice-difficulty').value;
    if (!topic) return this.toast('Введите тему');

    const prompt = `
Создай набор из ${count} задач по теме "${topic}" со сложностью "${difficulty}".

Для каждой задачи:
1. Условие
2. Подсказка
3. Решение
4. Ответ

Сделай это пригодным для школьного занятия.
`;

    this.showLoader();
    try {
      const data = await this.askAI(prompt, 'teacher');
      document.getElementById('practice-result').textContent = data.text;
      document.getElementById('practice-result-panel').classList.remove('hidden');

      this.saveTeacherMaterial({
        type: 'Практика',
        topic,
        meta: `${difficulty}, ${count} задач`,
        content: data.text
      });

      this.updateAllDashboards();
      this.toast('Практика создана');
    } catch (e) {
      this.toast(e.message);
    } finally {
      this.hideLoader();
    }
  },

  async generateTeacherTest() {
    const topic = document.getElementById('teacher-test-topic').value.trim();
    const count = document.getElementById('teacher-test-count').value.trim();
    const format = document.getElementById('teacher-test-format').value;
    if (!topic) return this.toast('Введите тему');

    const prompt = `
Создай школьный тест по теме "${topic}".
Количество вопросов: ${count}
Формат: ${format}

Сделай:
1. Вопросы
2. Варианты ответов если уместно
3. Отдельный блок с правильными ответами
`;

    this.showLoader();
    try {
      const data = await this.askAI(prompt, 'teacher');
      document.getElementById('teacher-test-result').textContent = data.text;
      document.getElementById('teacher-test-result-panel').classList.remove('hidden');

      this.saveTeacherMaterial({
        type: 'Тест',
        topic,
        meta: `${format}, ${count} вопросов`,
        content: data.text
      });

      this.updateAllDashboards();
      this.toast('Тест создан');
    } catch (e) {
      this.toast(e.message);
    } finally {
      this.hideLoader();
    }
  },

  async generateSimpleExplanation() {
    const topic = document.getElementById('simple-topic').value.trim();
    if (!topic) return this.toast('Введите тему');

    const prompt = `
Объясни тему "${topic}" очень простым языком для школьника.

Структура:
1. Что это
2. Зачем нужно
3. Простой пример
4. Частые ошибки
5. Как быстро запомнить
`;

    this.showLoader();
    try {
      const data = await this.askAI(prompt, 'teacher');
      document.getElementById('simple-result').textContent = data.text;
      document.getElementById('simple-result-panel').classList.remove('hidden');

      this.saveTeacherMaterial({
        type: 'Простое объяснение',
        topic,
        meta: 'адаптированный материал',
        content: data.text
      });

      this.updateAllDashboards();
      this.toast('Объяснение готово');
    } catch (e) {
      this.toast(e.message);
    } finally {
      this.hideLoader();
    }
  },

  saveTeacherMaterial(item) {
    const data = this.getStorage('nevio_teacher_materials', []);
    data.unshift({
      ...item,
      createdAt: new Date().toISOString()
    });
    this.setStorage('nevio_teacher_materials', data);
  },

  showTeacherBank() {
    this.showPage('teacher-bank');
    this.renderTeacherBank();
  },

  renderTeacherBank() {
    const list = this.getStorage('nevio_teacher_materials', []);
    const box = document.getElementById('teacher-bank-list');

    if (!list.length) {
      box.innerHTML = `<div class="bank-item"><div class="item-title">Пока нет материалов</div><div class="item-meta">Создайте первый материал</div></div>`;
      return;
    }

    box.innerHTML = list.map(item => `
      <div class="bank-item">
        <div class="item-head">
          <div>
            <div class="item-title">${this.escapeHtml(item.type)}: ${this.escapeHtml(item.topic)}</div>
            <div class="item-meta">${this.escapeHtml(item.meta || '')}</div>
          </div>
          <div class="item-meta">${this.formatDateTime(item.createdAt)}</div>
        </div>
        <div class="result-text">${this.escapeHtml(item.content.slice(0, 500))}${item.content.length > 500 ? '...' : ''}</div>
      </div>
    `).join('');
  },

  async solveProblem() {
    const problem = document.getElementById('student-problem').value.trim();
    if (!problem) return this.toast('Введите задачу');

    const topicGuess = this.extractTopicFromText(problem);

    const prompt = `
Помоги решить задачу или объяснить учебный вопрос:

"${problem}"

Структура ответа:
1. Что нужно понять
2. Ключевая идея
3. Пошаговое объяснение
4. Ответ
5. Как проверить себя
6. Похожая тема
`;

    this.showLoader();
    try {
      const data = await this.askAI(prompt, 'student');
      document.getElementById('solve-result').textContent = data.text;
      document.getElementById('solve-result-panel').classList.remove('hidden');

      this.currentSolvedDraft = {
        problem,
        solution: data.text,
        topic: topicGuess,
        createdAt: new Date().toISOString(),
        dayKey: this.todayKey()
      };

      this.saveStudentQuery({
        type: 'solve',
        topic: topicGuess,
        question: problem
      });

      this.updateAllDashboards();
      this.toast('Решение готово');
    } catch (e) {
      this.toast(e.message);
    } finally {
      this.hideLoader();
    }
  },

  markSolved() {
    if (!this.currentSolvedDraft) return this.toast('Сначала получите решение');

    const list = this.getStorage('nevio_student_solutions', []);
    list.unshift(this.currentSolvedDraft);
    this.setStorage('nevio_student_solutions', list);

    this.currentSolvedDraft = null;
    this.updateAllDashboards();
    this.showPage('student');
    this.toast('Решение сохранено');
  },

  saveStudentQuery(item) {
    const data = this.getStorage('nevio_student_queries', []);
    data.unshift({
      ...item,
      createdAt: new Date().toISOString(),
      dayKey: this.todayKey()
    });
    this.setStorage('nevio_student_queries', data);
  },

  async generateDailyReviewQuiz() {
    const queries = this.getStorage('nevio_student_queries', []);
    const today = this.todayKey();
    const todayQueries = queries.filter(q => q.dayKey === today);

    if (!todayQueries.length) return this.toast('Сегодня ещё нет вопросов для теста');

    const topics = [...new Set(todayQueries.map(q => q.topic).filter(Boolean))];
    const questions = todayQueries.map(q => `- ${q.question}`).slice(0, 12).join('\n');

    const prompt = `
Собери итоговый тест по темам дня ученика.

Темы:
${topics.map(t => `- ${t}`).join('\n')}

Вопросы ученика:
${questions}

Сделай:
1. Краткое резюме дня
2. 6-8 вопросов на повторение
3. 2 задания повышенной сложности
4. Блок "проверь себя"
5. Ответы в конце
`;

    this.showLoader();
    try {
      const data = await this.askAI(prompt, 'student');
      document.getElementById('daily-quiz-result').textContent = data.text;
      this.showPage('daily-quiz');

      const drafts = this.getStorage('nevio_daily_quiz_drafts', []);
      drafts.unshift({
        date: new Date().toISOString(),
        dayKey: today,
        topics,
        content: data.text,
        completed: false
      });
      this.setStorage('nevio_daily_quiz_drafts', drafts);

      this.updateAllDashboards();
      this.toast('Итог дня готов');
    } catch (e) {
      this.toast(e.message);
    } finally {
      this.hideLoader();
    }
  },

  markDailyQuizCompleted() {
    const drafts = this.getStorage('nevio_daily_quiz_drafts', []);
    const today = this.todayKey();
    const target = drafts.find(d => d.dayKey === today);
    if (!target) return this.toast('Нет текущего теста');

    target.completed = true;
    target.completedAt = new Date().toISOString();
    this.setStorage('nevio_daily_quiz_drafts', drafts);

    const passed = this.getStorage('nevio_passed_quizzes', []);
    passed.unshift({
      dayKey: today,
      completedAt: target.completedAt,
      topics: target.topics,
      content: target.content
    });
    this.setStorage('nevio_passed_quizzes', passed);

    this.updateAllDashboards();
    this.toast('Тест отмечен как пройденный');
  },

  renderStudentHistory() {
    const list = this.getStorage('nevio_student_solutions', []);
    const box = document.getElementById('student-history-list');

    if (!list.length) {
      box.innerHTML = `<div class="history-item"><div class="item-title">История пока пуста</div><div class="item-meta">Решите первую задачу</div></div>`;
      return;
    }

    box.innerHTML = list.map(item => `
      <div class="history-item">
        <div class="item-head">
          <div class="item-title">${this.escapeHtml(item.topic || 'Без темы')}</div>
          <div class="item-meta">${this.formatDateTime(item.createdAt)}</div>
        </div>
        <div class="item-meta" style="margin-bottom:8px;">${this.escapeHtml(item.problem.slice(0, 160))}${item.problem.length > 160 ? '...' : ''}</div>
        <div class="result-text">${this.escapeHtml(item.solution.slice(0, 420))}${item.solution.length > 420 ? '...' : ''}</div>
      </div>
    `).join('');
  },

  showStudentHistory() {
    this.showPage('student-history');
    this.renderStudentHistory();
  },

  renderTopicsJournal() {
    const queries = this.getStorage('nevio_student_queries', []);
    const weekKeys = this.getLast7DaysKeys();

    const weekly = queries.filter(q => weekKeys.includes(q.dayKey));
    const groupedTopics = {};
    weekly.forEach(q => {
      const key = q.topic || 'Без темы';
      groupedTopics[key] = (groupedTopics[key] || 0) + 1;
    });

    const sortedTopics = Object.entries(groupedTopics).sort((a, b) => b[1] - a[1]);
    const topicBox = document.getElementById('topic-week-list');
    topicBox.innerHTML = sortedTopics.length
      ? sortedTopics.map(([topic, count]) => `
        <div class="list-item">
          <div class="item-head">
            <div class="item-title">${this.escapeHtml(topic)}</div>
            <div class="item-meta">${count} запросов</div>
          </div>
          <div class="progress"><div class="progress-bar" style="width:${Math.min(100, count * 20)}%"></div></div>
        </div>
      `).join('')
      : `<div class="list-item"><div class="item-title">Нет тем за неделю</div><div class="item-meta">Начните задавать вопросы</div></div>`;

    const todayQuestions = queries.filter(q => q.dayKey === this.todayKey()).slice(0, 10);
    const questionBox = document.getElementById('today-questions-list');
    questionBox.innerHTML = todayQuestions.length
      ? todayQuestions.map(q => `
        <div class="list-item">
          <div class="item-head">
            <div class="item-title">${this.escapeHtml(q.topic || 'Без темы')}</div>
            <div class="item-meta">${this.formatDateTime(q.createdAt)}</div>
          </div>
          <div class="item-meta">${this.escapeHtml(q.question.slice(0, 120))}${q.question.length > 120 ? '...' : ''}</div>
        </div>
      `).join('')
      : `<div class="list-item"><div class="item-title">Сегодня пока пусто</div><div class="item-meta">Список появится после первых вопросов</div></div>`;
  },

  getStudentStats() {
    const solutions = this.getStorage('nevio_student_solutions', []);
    const queries = this.getStorage('nevio_student_queries', []);
    const quizzes = this.getStorage('nevio_passed_quizzes', []);
    const weekKeys = this.getLast7DaysKeys();

    const weekQueries = queries.filter(q => weekKeys.includes(q.dayKey));
    const weekSolutions = solutions.filter(s => weekKeys.includes(s.dayKey));
    const uniqueTopicsWeek = [...new Set(weekQueries.map(q => q.topic).filter(Boolean))];
    const activeDays = [...new Set(queries.map(q => q.dayKey))];
    const streak = this.calculateStreak(activeDays);

    return { solutions, queries, quizzes, weekQueries, weekSolutions, uniqueTopicsWeek, streak };
  },

  calculateStreak(activeDays) {
    if (!activeDays.length) return 0;
    const set = new Set(activeDays);
    let streak = 0;
    const now = new Date();

    while (true) {
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (set.has(key)) {
        streak++;
        now.setDate(now.getDate() - 1);
      } else break;
    }
    return streak;
  },

  getQuestData() {
    const stats = this.getStudentStats();
    return [
      { title: 'Ритм недели', desc: 'Реши 5 задач за последние 7 дней', value: stats.weekSolutions.length, target: 5 },
      { title: 'Исследователь тем', desc: 'Изучи 3 разные темы за неделю', value: stats.uniqueTopicsWeek.length, target: 3 },
      { title: 'Возвращение к учебе', desc: 'Будь активен 3 дня подряд', value: stats.streak, target: 3 },
      { title: 'Проверка понимания', desc: 'Пройди 2 итоговых теста', value: stats.quizzes.length, target: 2 },
      { title: 'Любопытный ум', desc: 'Сделай 10 учебных запросов за неделю', value: stats.weekQueries.length, target: 10 }
    ];
  },

  getAchievements() {
    const stats = this.getStudentStats();
    return [
      { name: 'Старт', desc: 'Решить первую задачу', unlocked: stats.solutions.length >= 1, icon: this.iconRocket() },
      { name: 'Исследователь', desc: 'Изучить 5 разных тем', unlocked: [...new Set(stats.queries.map(q => q.topic).filter(Boolean))].length >= 5, icon: this.iconCompass() },
      { name: 'Устойчивый ритм', desc: 'Продержать серию 3 дня', unlocked: stats.streak >= 3, icon: this.iconPulse() },
      { name: 'Мастер повторения', desc: 'Пройти 3 итоговых теста', unlocked: stats.quizzes.length >= 3, icon: this.iconShield() },
      { name: 'Победитель недели', desc: 'Закрыть 3 квеста', unlocked: this.getQuestData().filter(q => q.value >= q.target).length >= 3, icon: this.iconCrown() },
      { name: 'Аналитик', desc: 'Сделать 20 учебных запросов', unlocked: stats.queries.length >= 20, icon: this.iconGraph() }
    ];
  },

  renderQuestPreview() {
    const quests = this.getQuestData();
    document.getElementById('quest-list').innerHTML = quests.slice(0, 3).map(q => {
      const progress = Math.min(100, Math.round((q.value / q.target) * 100));
      return `
        <div class="quest-item">
          <div class="quest-head">
            <div class="quest-title">${q.title}</div>
            <div class="quest-meta">${q.value}/${q.target}</div>
          </div>
          <div class="quest-meta">${q.desc}</div>
          <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
        </div>
      `;
    }).join('');
  },

  renderQuestPage() {
    const quests = this.getQuestData();
    document.getElementById('quest-page-list').innerHTML = quests.map(q => {
      const progress = Math.min(100, Math.round((q.value / q.target) * 100));
      return `
        <div class="quest-item">
          <div class="quest-head">
            <div class="quest-title">${q.title}</div>
            <div class="quest-meta">${q.value}/${q.target}</div>
          </div>
          <div class="quest-meta">${q.desc}</div>
          <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
        </div>
      `;
    }).join('');
  },

  renderAchievements() {
    const achievements = this.getAchievements();
    document.getElementById('achievement-grid').innerHTML = achievements.map(a => `
      <div class="achievement-card ${a.unlocked ? 'unlocked' : ''}">
        <div class="achievement-top">
          <div class="achievement-icon">${a.icon}</div>
          <div>
            <div class="achievement-name">${a.name}</div>
            <div class="item-meta">${a.unlocked ? 'Получено' : 'В процессе'}</div>
          </div>
        </div>
        <div class="achievement-desc">${a.desc}</div>
      </div>
    `).join('');
  },

  updateAllDashboards() {
    this.updateTeacherDashboard();
    this.updateStudentDashboard();
    this.updateProfileStats();
  },

  updateTeacherDashboard() {
    const materials = this.getStorage('nevio_teacher_materials', []);
    const conspects = materials.filter(x => x.type === 'Конспект').length;
    const tests = materials.filter(x => x.type === 'Тест').length;
    const practice = materials.filter(x => x.type === 'Практика').length;

    const topicMap = {};
    const typeMap = {};
    materials.forEach(m => {
      topicMap[m.topic] = (topicMap[m.topic] || 0) + 1;
      typeMap[m.type] = (typeMap[m.type] || 0) + 1;
    });

    const topTopic = Object.entries(topicMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const topType = Object.entries(typeMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const lastCreated = materials[0]?.createdAt ? this.formatDateTime(materials[0].createdAt) : '—';

    document.getElementById('teacher-materials-count').textContent = materials.length;
    document.getElementById('teacher-conspects-count').textContent = conspects;
    document.getElementById('teacher-tests-count').textContent = tests;
    document.getElementById('teacher-practice-count').textContent = practice;
    document.getElementById('teacher-top-topic').textContent = topTopic;
    document.getElementById('teacher-top-type').textContent = topType;
    document.getElementById('teacher-last-created').textContent = lastCreated;
  },

  updateStudentDashboard() {
    const stats = this.getStudentStats();

    document.getElementById('student-solved-count').textContent = stats.solutions.length;
    document.getElementById('student-week-topics-count').textContent = stats.uniqueTopicsWeek.length;
    document.getElementById('student-streak-count').textContent = stats.streak;
    document.getElementById('student-tests-count').textContent = stats.quizzes.length;

    const todayQueries = stats.queries.filter(q => q.dayKey === this.todayKey());
    if (!todayQueries.length) {
      document.getElementById('student-focus-topic').textContent = 'Пока нет активной темы';
      document.getElementById('student-focus-sub').textContent = 'Начните решать задачи, чтобы Невио собрал карту вашего дня';
    } else {
      const countMap = {};
      todayQueries.forEach(q => {
        const key = q.topic || 'Без темы';
        countMap[key] = (countMap[key] || 0) + 1;
      });
      const top = Object.entries(countMap).sort((a, b) => b[1] - a[1])[0];
      document.getElementById('student-focus-topic').textContent = top[0];
      document.getElementById('student-focus-sub').textContent = `Сегодня вы возвращались к этой теме ${top[1]} раз(а). В конце дня можно пройти тест именно по ней.`;
    }

    this.renderQuestPreview();
    this.renderAchievements();
  },

  updateProfileStats() {
    const materials = this.getStorage('nevio_teacher_materials', []);
    const solved = this.getStorage('nevio_student_solutions', []);
    const quizzes = this.getStorage('nevio_passed_quizzes', []);
    const streak = this.getStudentStats().streak;

    document.getElementById('profile-materials').textContent = materials.length;
    document.getElementById('profile-solved').textContent = solved.length;
    document.getElementById('profile-quizzes').textContent = quizzes.length;
    document.getElementById('profile-streak').textContent = streak;
  },

  iconRocket() {
    return `<svg viewBox="0 0 24 24"><path d="M14 4c3 1 5 3 6 6-2 4-5 7-9 9-3-1-5-3-6-6 2-4 5-7 9-9zM9 15l-2 5 5-2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  },
  iconCompass() {
    return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14.5 9.5l-2 5-5 2 2-5 5-2z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  },
  iconPulse() {
    return `<svg viewBox="0 0 24 24"><path d="M3 12h4l2-4 4 8 2-4h6" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  },
  iconShield() {
    return `<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  },
  iconCrown() {
    return `<svg viewBox="0 0 24 24"><path d="M4 18h16l-1-8-5 4-2-5-2 5-5-4-1 8z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  },
  iconGraph() {
    return `<svg viewBox="0 0 24 24"><path d="M4 19h16M7 16V9M12 16V5M17 16v-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  },

  escapeHtml(text = '') {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
