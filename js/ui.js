import { shuffleArray } from './shuffle.js';

// حالة واجهة المستخدم
const uiState = {
    currentQuestion: null,
    quizStatus: null,
    answerButtons: [],
    isTransitioning: false
};

// عناصر DOM المخزنة مسبقاً لتحسين الأداء
let domElements = {};

// معالج حدث النقر على الإجابة
function handleAnswerClick(event) {
    if (event.target.classList.contains('answer-btn')) {
        const selectedAnswer = event.target.getAttribute('data-answer');
        if (window.handleAnswer) {
            window.handleAnswer(selectedAnswer);
        }
    }
}

// تهيئة عناصر DOM
function cacheDOMElements() {
    domElements = {
        contentArea: document.getElementById('content-area'),
        quizTitle: document.getElementById('quiz-title'),
        questionCounter: document.getElementById('question-counter'),
        timerBar: document.getElementById('timer-bar'),
        timerText: document.getElementById('timer-text'),
        prevBtn: document.getElementById('prev-btn'),
        flipBtn: document.getElementById('flip-btn'),
        nextBtn: document.getElementById('next-btn'),
        resultsSection: document.getElementById('results'),
        totalQuestions: document.getElementById('total-questions'),
        correctAnswers: document.getElementById('correct-answers'),
        wrongAnswers: document.getElementById('wrong-answers'),
        pausesCount: document.getElementById('pauses-count'),
        wrongQuestionsList: document.getElementById('wrong-questions-list'),
        wrongQuestions: document.getElementById('wrong-questions'),
        comparisonSection: document.getElementById('comparison-section'),
        leaderboard: document.getElementById('leaderboard'),
        leaderboardBody: document.getElementById('leaderboard-body'),
        flashOverlay: document.getElementById('flash-overlay')
    };
}

// تحديث واجهة المستخدم بناءً على السؤال والحالة الحالية
export function updateUI(question, status) {
    if (!domElements.contentArea) {
        cacheDOMElements();
    }
    
    uiState.currentQuestion = question;
    uiState.quizStatus = status;
    
    // تنظيف المحتوى السابق
    clearContentArea();
    
    if (!question) {
        showNoContentMessage();
        return;
    }
    
    // تحديث واجهة المستخدم بناءً على نوع المحتوى
    if (question.type === 'flashcard') {
        renderFlashcard(question);
    } else if (question.type === 'question') {
        renderQuestion(question);
    }
    
    // تحديث معلومات الاختبار
    updateQuizInfo(question, status);
    
    // تحديث حالة أزرار التنقل
    updateNavigationButtons(status);
}

// تنظيف منطقة المحتوى
function clearContentArea() {
    if (domElements.contentArea) {
        domElements.contentArea.innerHTML = '';
        uiState.answerButtons = [];
    }
}

// عرض رسالة عند عدم وجود محتوى
function showNoContentMessage() {
    if (domElements.contentArea) {
        domElements.contentArea.innerHTML = `
            <div class="no-content">
                <h3>لا يوجد محتوى للعرض</h3>
                <p>تأكد من أن ملف JSON يحتوي على بطاقات تعليمية أو أسئلة.</p>
            </div>
        `;
    }
}

// عرض البطاقة التعليمية
function renderFlashcard(flashcard) {
    if (!domElements.contentArea) return;
    
    const flipClass = flashcard.isFlipped ? 'flipped' : '';
    
    domElements.contentArea.innerHTML = `
        <div class="flashcard ${flipClass}">
            <div class="flashcard-inner">
                <div class="flashcard-front">
                    <h3>${flashcard.data.question}</h3>
                    <p class="flashcard-hint">اضغط على السهم لأسفل أو زر القلب لرؤية الإجابة</p>
                </div>
                <div class="flashcard-back">
                    <p>${flashcard.data.answer}</p>
                </div>
            </div>
        </div>
    `;
}

// عرض السؤال
function renderQuestion(question) {
    if (!domElements.contentArea) return;
    
    let answersHTML = '';
    question.data.answers.forEach((answer, index) => {
        const escapedAnswer = escapeAnswer(answer);
        answersHTML += `
            <button class="answer-btn" data-answer="${escapedAnswer}">
                ${answer}
            </button>
        `;
    });
    
    domElements.contentArea.innerHTML = `
        <div class="question">
            <h3 class="question-text">${question.data.question}</h3>
            <div class="answers">
                ${answersHTML}
            </div>
        </div>
    `;
    
    // تخزين أزرار الإجابة للإشارة إليها لاحقاً
    uiState.answerButtons = Array.from(domElements.contentArea.querySelectorAll('.answer-btn'));
    
    // إضافة مستمع الأحداث باستخدام التفويض
    domElements.contentArea.addEventListener('click', handleAnswerClick);
}

// تحديث معلومات الاختبار
function updateQuizInfo(question, status) {
    if (domElements.questionCounter) {
        const total = status.mode === 'flashcard' ? status.totalFlashcards : status.totalQuestions;
        const type = status.mode === 'flashcard' ? 'بطاقة' : 'سؤال';
        domElements.questionCounter.textContent = `${type} ${question.index + 1} من ${total}`;
    }
}

// تحديث حالة أزرار التنقل
function updateNavigationButtons(status) {
    if (!domElements.prevBtn || !domElements.nextBtn || !domElements.flipBtn) return;
    
    // تحديث زر السابق
    domElements.prevBtn.disabled = status.currentIndex === 0;
    
    // تحديث زر القلب (متاح فقط في وضع البطاقات)
    domElements.flipBtn.disabled = status.mode !== 'flashcard';
    
    // تحديث زر التالي
    if (status.mode === 'flashcard') {
        const isLastFlashcard = status.currentIndex === status.totalFlashcards - 1;
        domElements.nextBtn.textContent = isLastFlashcard ? 'بدء الاختبار' : 'التالي';
    } else {
        const isLastQuestion = status.currentIndex === status.totalQuestions - 1;
        domElements.nextBtn.textContent = isLastQuestion ? 'إنهاء الاختبار' : 'التالي';
    }
}

// تحديث عرض المؤقت
export function updateTimerDisplay(remainingTime, totalTime) {
    if (!domElements.timerBar || !domElements.timerText) return;
    
    // حساب النسبة المئوية للوقت المتبقي
    const percentage = (remainingTime / totalTime) * 100;
    
    // تحديث شريط التقدم
    domElements.timerBar.style.width = `${percentage}%`;
    
    // تحديث لون الشريط بناءً على الوقت المتبقي
    if (percentage > 50) {
        domElements.timerBar.style.backgroundColor = '#2ecc71'; // أخضر
    } else if (percentage > 25) {
        domElements.timerBar.style.backgroundColor = '#f39c12'; // برتقالي
    } else {
        domElements.timerBar.style.backgroundColor = '#e74c3c'; // أحمر
    }
    
    // تحديث النص
    domElements.timerText.textContent = `${remainingTime} ثانية`;
}

// عرض النتائج
export function showResults(results) {
    if (!domElements.resultsSection) cacheDOMElements();
    
    // تحديث الإحصائيات
    if (domElements.totalQuestions) domElements.totalQuestions.textContent = results.totalQuestions;
    if (domElements.correctAnswers) domElements.correctAnswers.textContent = results.correct;
    if (domElements.wrongAnswers) domElements.wrongAnswers.textContent = results.wrong;
    if (domElements.pausesCount) domElements.pausesCount.textContent = results.pauses;
    
    // عرض الأسئلة الخاطئة إن وجدت
    if (results.wrongQuestionsList && results.wrongQuestionsList.length > 0) {
        displayWrongQuestions(results.wrongQuestionsList, results.totalQuestions);
        domElements.wrongQuestionsList.classList.remove('hidden');
    } else {
        domElements.wrongQuestionsList.classList.add('hidden');
    }
    
    // إظهار قسم النتائج
    domElements.resultsSection.classList.remove('hidden');
}

// عرض الأسئلة الخاطئة
function displayWrongQuestions(wrongQuestionsList, totalQuestions) {
    if (!domElements.wrongQuestions) return;
    
    domElements.wrongQuestions.innerHTML = '';
    
    wrongQuestionsList.forEach(questionIndex => {
        if (questionIndex < totalQuestions) {
            const li = document.createElement('li');
            li.textContent = `السؤال ${questionIndex + 1}`;
            li.setAttribute('data-question-index', questionIndex);
            domElements.wrongQuestions.appendChild(li);
        }
    });
}

// عرض لوحة الصدارة
export function showLeaderboard(leaderboardData) {
    if (!domElements.leaderboardBody) return;
    
    domElements.leaderboardBody.innerHTML = '';
    
    leaderboardData.forEach((entry, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${entry.username}</td>
            <td>${entry.correctAnswers}/${entry.totalQuestions}</td>
            <td>${entry.scorePercent.toFixed(1)}%</td>
        `;
        
        // تمييز المراكز الأولى
        if (index < 3) {
            row.classList.add(`rank-${index + 1}`);
        }
        
        domElements.leaderboardBody.appendChild(row);
    });
    
    domElements.leaderboard.classList.remove('hidden');
}

// تأثير الوميض البصري للإجابات
export function flashScreen(type) {
    if (!domElements.flashOverlay) return;
    
    // إزالة Classes السابقة
    domElements.flashOverlay.classList.remove('flash-correct', 'flash-wrong', 'flash-visible');
    
    // إضافة Class المناسب بناءً على نوع الإجابة
    domElements.flashOverlay.classList.add(`flash-${type}`, 'flash-visible');
    
    // إزالة التأثير بعد فترة
    setTimeout(() => {
        domElements.flashOverlay.classList.remove('flash-visible');
    }, 500);
}

// تمييز الإجابة المحددة
export function highlightAnswer(selectedAnswer, isCorrect) {
    if (!uiState.answerButtons.length) return;
    
    // إعادة تعيين كل الأزرار إلى حالتها الأصلية
    uiState.answerButtons.forEach(btn => {
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
    });
    
    // البحث عن الزر الذي تم النقر عليه
    const selectedButton = uiState.answerButtons.find(btn => 
        btn.getAttribute('data-answer') === selectedAnswer
    );
    
    if (selectedButton) {
        // تمييز الزر المحدد
        selectedButton.classList.add(isCorrect ? 'correct' : 'wrong');
        
        // إذا كانت الإجابة خاطئة، تمييز الإجابة الصحيحة أيضاً
        if (!isCorrect && uiState.currentQuestion) {
            const correctButton = uiState.answerButtons.find(btn => 
                btn.getAttribute('data-answer') === uiState.currentQuestion.data.correctAnswer
            );
            
            if (correctButton) {
                correctButton.classList.add('correct');
            }
        }
        
        // تعطيل جميع الأزرار بعد الاختيار
        uiState.answerButtons.forEach(btn => {
            btn.disabled = true;
        });
    }
}

// تهيئة واجهة المستخدم عند تحميل الصفحة
export function initUI() {
    cacheDOMElements();
    
    // إضافة معالج الحدث للوحة المفاتيح
    document.addEventListener('keydown', handleKeyDown);
    
    console.log('تم تهيئة واجهة المستخدم بنجاح');
}

// التعامل مع أحداث لوحة المفاتيح
function handleKeyDown(event) {
    // منع السلوك الافتراضي للسهم الأسفل لتفاصل التمرير
    if (event.key === 'ArrowDown') {
        event.preventDefault();
    }
}

// تهريب النص لتجنب مشاكل الأحرف الخاصة
function escapeAnswer(answer) {
    const div = document.createElement('div');
    div.textContent = answer;
    return div.innerHTML;
}

// إزالة مستمعي الأحداث عند التدمير
export function destroyUI() {
    document.removeEventListener('keydown', handleKeyDown);
    if (domElements.contentArea) {
        domElements.contentArea.removeEventListener('click', handleAnswerClick);
    }
    
    // تنظيف الإشارات
    domElements = {};
    uiState.answerButtons = [];
}

// تهيئة واجهة المستخدم عند تحميل الملف
initUI();