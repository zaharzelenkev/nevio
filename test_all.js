#!/usr/bin/env node
// Комплексный тест NEVIO - проверяет что все работает после добавления предметов для BY
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(filePath, 'utf8');

let passed = 0;
let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); passed++; }
function fail(msg) { console.log(`❌ ${msg}`); failed++; }
function check(condition, msg) { condition ? ok(msg) : fail(msg); }

console.log('=== NEVIO FULL TEST ===');
console.log(`File: ${filePath}`);
console.log(`Size: ${content.length} bytes`);

// 1. Базовая структура HTML
check(content.includes('<!DOCTYPE html>'), 'HTML DOCTYPE present');
check(content.includes('<div class="page active" id="roleSelectionPage">'), 'Role selection page exists');
check(content.includes('id="mainPage"'), 'Main page exists');
check(content.includes('id="countryPage"'), 'Country page exists');
check(content.includes('id="actionPage"'), 'Action page exists');
check(content.includes('id="testPage"'), 'Test page exists');
check(content.includes('id="settingsPage"'), 'Settings page exists');
check(content.includes('id="progressPage"'), 'Progress page exists');
check(content.includes('id="teacherPage"'), 'Teacher page exists');
check(content.includes('id="officialPage"'), 'Official page exists');
check(content.includes('bottom-nav'), 'Bottom nav exists');

// 2. Конфигурация стран
check(content.includes("NEVIO_COUNTRIES"), 'NEVIO_COUNTRIES defined');
check(content.includes("BY: {"), 'BY country exists');
check(content.includes("RU: {"), 'RU country exists');
check(content.includes("KZ: {"), 'KZ country exists');
check(content.includes("UZ: {"), 'UZ country exists');

// 3. Предметы для Беларуси - все 21 из запроса
const requiredSubjects = [
  'Белорусский язык',
  'Белорусская литература',
  'Русский язык',
  'Русская литература',
  'Иностранный язык',
  'Математика',
  'Информатика',
  'Человек и мир',
  'Всемирная история',
  'История Беларуси',
  'Общество',
  'География',
  'Биология',
  'Физика',
  'Астрономия',
  'Химия',
  'Труды',
  'Искусство (отечественная и мировая художественная культура)',
  'Физическая культура и здоровье',
  'Подготовка к призыву на военную службу и медицинская подготовка',
  'Основы безопасности жизнедеятельности'
];

// Найти BY секцию - ищем ctSubjects для BY (первое вхождение после BY: {)
const bySectionMatch = content.match(/BY:\s*\{[\s\S]*?ctSubjects:\s*\[([^\]]+)\]/);
if (bySectionMatch) {
  const ctSubjectsStr = bySectionMatch[1];
  console.log('\n--- BY ctSubjects check ---');
  requiredSubjects.forEach(subj => {
    // Проверяем наличие предмета (точное совпадение внутри кавычек)
    const escaped = subj.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Ищем в массиве
    const present = ctSubjectsStr.includes(subj);
    check(present, `BY ctSubjects contains "${subj}"`);
  });
} else {
  fail('Could not extract BY ctSubjects');
}

// Проверка exam9Subjects и studySubjects для BY
const byExam9Match = content.match(/BY:[\s\S]*?exam9Subjects:\s*\[([^\]]+)\]/);
if (byExam9Match) {
  console.log('\n--- BY exam9Subjects check ---');
  const str = byExam9Match[1];
  requiredSubjects.forEach(subj => {
    check(str.includes(subj), `BY exam9Subjects contains "${subj}"`);
  });
} else fail('Could not extract BY exam9Subjects');

const byStudyMatch = content.match(/BY:[\s\S]*?studySubjects:\s*\[([^\]]+)\]/);
if (byStudyMatch) {
  console.log('\n--- BY studySubjects check ---');
  const str = byStudyMatch[1];
  requiredSubjects.forEach(subj => {
    check(str.includes(subj), `BY studySubjects contains "${subj}"`);
  });
} else fail('Could not extract BY studySubjects');

// 4. Белорусские переводы
console.log('\n--- BY be translations check ---');
const beTranslations = [
  'Беларуская літаратура',
  'Руская літаратура',
  'Замежная мова',
  'Інфарматыка',
  'Чалавек і свет',
  'Сусветная гісторыя',
  'Геаграфія',
  'Астраномія',
  'Працоўнае навучанне',
  'Мастацтва (айчынная і сусветная мастацкая культура)',
  'Фізічная культура і здароўе',
  'Дапрызыўная і медыцынская падрыхтоўка',
  'Асновы бяспекі жыццядзейнасці'
];
beTranslations.forEach(tr => {
  check(content.includes(tr), `be translation contains "${tr}"`);
});

// 5. EIOR_SUBJECTS
console.log('\n--- EIOR_SUBJECTS check ---');
const eiorSubjects = [
  'Астрономия',
  'Труды',
  'Искусство (отечественная и мировая художественная культура)',
  'Физическая культура и здоровье',
  'Основы безопасности жизнедеятельности',
  'Иностранный язык',
  'Общество',
  'Подготовка к призыву на военную службу и медицинская подготовка'
];
eiorSubjects.forEach(subj => {
  check(content.includes(subj), `EIOR_SUBJECTS contains "${subj}"`);
});

// 6. Проверка что другие страны не сломаны
console.log('\n--- Other countries intact check ---');
check(content.includes("ctSubjects: ['Математика','Русский язык','Физика','Химия','Биология','История','Обществознание','Информатика','Литература','География','Английский язык']"), 'RU ctSubjects intact');
check(content.includes("Математическая грамотность"), 'KZ subjects intact');
check(content.includes("История Узбекистана"), 'UZ subjects intact');

// 7. Ключевые функции
console.log('\n--- Core functions check ---');
[
  'function subjectName',
  'function activeCountry',
  'function activeMenu',
  'function byMenu',
  'function buildMenuFor',
  'function loadMainMenu',
  'function openAction',
  'function generateForm',
  'function processAction',
  'function openCTTest',
  'function renderTestSetup',
  'function callProxy',
  'function init()',
  'function selectRole',
  'function showPage',
  'const NEVIO_COUNTRIES',
  'const EIOR_SUBJECTS',
  'const CT_KNOWLEDGE_BASE'
].forEach(fn => {
  check(content.includes(fn), `Function/const "${fn}" exists`);
});

// 8. Проверка синтаксиса JS (извлечь главный скрипт и проверить через node)
console.log('\n--- JS syntax check ---');
try {
  // Извлекаем большой скрипт (последний <script> без src)
  const scriptMatches = [...content.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  // Найти самый большой скрипт (основной)
  let mainScript = '';
  let maxLen = 0;
  scriptMatches.forEach(m => {
    if (m[1].length > maxLen) {
      maxLen = m[1].length;
      mainScript = m[1];
    }
  });
  if (mainScript.length > 10000) {
    const tmpPath = '/tmp/nevio_main.js';
    fs.writeFileSync(tmpPath, mainScript);
    const { execSync } = require('child_process');
    try {
      execSync(`node --check ${tmpPath}`, { stdio: 'pipe' });
      ok('Main JS syntax valid (node --check)');
    } catch (e) {
      fail(`JS syntax error: ${e.stderr?.toString().slice(0,500)}`);
    }
  } else {
    fail('Could not extract main script (too short)');
  }
} catch (e) {
  fail(`JS syntax check exception: ${e.message}`);
}

// 9. Проверка на незакрытые кавычки/скобки в BY массивах (простая эвристика)
console.log('\n--- Brackets balance check ---');
const byCtLine = content.match(/ctSubjects:\s*\[([^\]]+)\]/g);
if (byCtLine) {
  // Проверяем что количество открывающих [ равно закрывающим ] в целом файле (грубо)
  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/\]/g) || []).length;
  check(Math.abs(openBrackets - closeBrackets) < 10, `Brackets roughly balanced: [ ${openBrackets} vs ] ${closeBrackets}`);
}

// 10. Проверка что нет дублирующихся id в EIOR_SUBJECTS (только внутри массива)
console.log('\n--- EIOR duplicate ID check ---');
const eiorBlockMatch = content.match(/const EIOR_SUBJECTS = \[([\s\S]*?)\];/);
if (eiorBlockMatch) {
  const block = eiorBlockMatch[1];
  const idMatches = [...block.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);
  const slugMatches = [...block.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
  const uniqueIds = new Set(idMatches);
  const uniqueSlugs = new Set(slugMatches);
  check(idMatches.length === uniqueIds.size, `EIOR_SUBJECTS IDs unique: ${idMatches.length} ids, ${uniqueIds.size} unique (${[...idMatches].join(', ')})`);
  check(slugMatches.length === uniqueSlugs.size, `EIOR_SUBJECTS slugs unique: ${slugMatches.length} slugs, ${uniqueSlugs.size} unique`);
  // Проверка что все требуемые предметы есть
  check(idMatches.includes('astronomia'), 'EIOR has astronomia id');
  check(idMatches.includes('trud'), 'EIOR has trud id');
  check(idMatches.includes('iskusstvo'), 'EIOR has iskusstvo id');
  check(idMatches.includes('fizkultura'), 'EIOR has fizkultura id');
  check(idMatches.includes('obzh'), 'EIOR has obzh id');
} else {
  fail('Could not extract EIOR_SUBJECTS block');
}

// 11. Размер файла не должен быть слишком маленьким или огромным
console.log('\n--- File size check ---');
check(content.length > 400000, `File size >400KB: ${content.length}`);
check(content.length < 1000000, `File size <1MB: ${content.length}`);

// 12. Финальная полировка: карточка-приветствие, дневник, ошибки, сканер, презентации, Plus, варианты
console.log('\n--- Final polish checks ---');
check(content.includes('id="greetRoot"'), 'Greeting card mount on main page');
check(content.includes('greet-brand') && content.includes("t('app.subtitle')"), 'Card titled with Nevio subtitle');
check(content.includes('function renderGreetCard'), 'renderGreetCard defined');
check(content.includes("t(nevioGreetingKey())") || content.includes("'greet.morning'"), 'Time-based greetings');
check(content.includes('Начни заниматься — Nevio будет собирать твою статистику'), 'Empty-state text (no fake stats)');
check(content.includes("localStorage.setItem('nevioExam_v1'") || content.includes("'nevioExam_v1'"), 'User-set exam date only');
check(content.includes("const PROGRESS_KEY = 'nevioProgress_v1'") && content.includes('cp.daily'), 'Daily activity store');
check(content.includes('function startNevioActivityTracking'), 'Activity heartbeat tracker');
check(content.includes("const DIARY_KEY = 'nevioDiary_v1'"), 'Grade diary store');
check(content.includes('renderDiarySection'), 'Diary renderer');
check(content.includes('diaryActiveQuarter'), 'Diary quarter helper');
check(content.includes("t('diary.yearAvg')"), 'Quarter/year average');
check(content.includes('function addMistake') && content.includes('function resolveMistakes'), 'Mistake ledger add/resolve');
check(content.includes("if (!isCorrect) noteTestMistake(testState, q, selectedIndex)"), 'Wrong test answer → mistake record');
check(content.includes('function startMistakePractice'), 'Practice-from-mistake generator');
check(content.includes("if (!ok) cpDaily(cp).mistakes++;") || content.includes('cpDaily(cp).mistakes++'), 'Mistake daily counter');
check(content.includes('renderPracticeFeedback()'), 'Understanding-updated feedback');
check(content.includes("function openMistakeExplain") && content.includes("mistake_explain"), 'Error explanation flow');
check(content.includes("t('mist.deep')") && content.includes('mistake_deep'), 'Deep analysis (Plus)');
check(content.includes("'Объясни проще'") || content.includes("'simple.btn'") && content.includes('SIMPLER_ASK'), 'Simpler explanation button');
check(content.includes('function nevioBehaviorPolicy'), 'Behavior policy: explain→steps→check→similar');
check(content.includes('function nevioStudentContext'), 'Student context into AI prompts');
check(content.includes("state.grade = m[1] + ' ' + t('form.gradeWord')") || content.includes("state.grade = m[1] + ' '"), 'Preferred grade persisted');
check(content.includes('function openScan') && content.includes('function scanFormHtml'), 'Smart scanner UI');
check(content.includes('capture="environment"'), 'Scanner camera mode');
check(content.includes('function nevioVisionComplete') && content.includes('function nevioOcr'), 'Vision + free OCR fallback chain');
check(content.includes('tesseract.min.js'), 'Tesseract.js free OCR backup');
check(/scanRun\('explain'\)|scanRun\(\\'explain\\'\)/.test(content) || content.includes("scanRun(\\'explain\\')"), 'Scan action: explain');
check(content.includes("scanRun(\\'check\\')"), 'Scan action: check my work');
check(content.includes("scanRun(\\'test\\')"), 'Scan action: make test');
check(content.includes("scanRun(\\'summary\\')"), 'Scan action: summary');
check(content.includes("scanRun(\\'errors\\')"), 'Scan action: find errors');
check(content.includes('function runScanCheck') && content.includes('parseScanTopics'), 'Scan check → mistake topics');
check(content.includes('function runPresentation') && content.includes('function parsePresentationJSON'), 'Presentation generation');
check(content.includes('function buildDeckHtml') && content.includes('function deckDownload'), 'Own slide viewer + .html export (zero cost)');
check(content.includes('id="deckViewer"'), 'Deck viewer markup');
check(content.includes('function presSlideOptions'), 'Slide count selector');
check(content.includes("if (n > 12 && !isPlus())"), 'Only 16-20 slides gated by Plus');
check(content.includes('function isPlus') && content.includes("state.plan === 'plus'"), 'Plan flag');
check(content.includes('NEVIO Free') && content.includes('NEVIO Plus'), 'Both plans described');
check(content.includes('€1,99') && content.includes('€2,99'), 'Pricing 1.99/2.99');
check(content.includes('function renderWeeklyStatsSection'), 'Weekly stats section');
check(content.includes('function renderPlusUI') && content.includes('id="plusRoot"'), 'Plus page wired');
check(content.includes('id="settingsPlanValue"'), 'Settings shows plan');
check(content.includes("'quick_lesson'") && content.includes('attachQuickLessonChips'), 'Quick lesson kit + follow-up chips');
check(content.includes('function generateVariantQuestions'), 'Teacher unique variants generator');
check(content.includes('function applyVariantAssignment'), 'Variants assigned by student name');
check(content.includes('a.vars') || content.includes('.vars['), 'Variants stored in assignment');
check((content.match(/title=\\"?https/g) || []).length === 0, 'No raw https URL in titles');
check(!(content.split('class="adu-item"')[1] || '').includes("href.replace('https://','')"), 'Browse list: raw URL hidden');
check(!(content.match(/function enhanceAduItemLive[\s\S]{0,4000}/) || [''])[0].includes("' + href + '"), 'adu.by live list: raw URL hidden');
// Free tier keeps core functions unlocked:
for (const fn of ['processAction', 'startInteractiveTest', 'openScan', 'runPresentation', 'renderProgressPage', 'openTeacher']) {
  check(content.includes('function ' + fn), `Core function present: ${fn}`);
}
check(content.includes("'BY'") && content.includes("'RU'") && content.includes("'KZ'") && content.includes("'UZ'"), 'All 4 countries kept');

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed+failed}`);
if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED');
  process.exit(0);
} else {
  console.log('⚠️ SOME TESTS FAILED');
  process.exit(1);
}
