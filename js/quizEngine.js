import { shuffleArray } from './shuffle.js';

// حالة التطبيق الحالية
let quizState = {
    quizData: null,
    username: '',
    currentIndex: 0,
    isFlashcardFlipped: false,
    mode: 'flashcard',
    answers: [],
    startTime: null,
    pauses: 0,
    wrongAnswers: [],
    currentQuestionStartTime: null
};

// تهيئة الاختبار
export function initializeQuiz(quizData, username) {
    quizState = {
        quizData,
        username,
        currentIndex: 0,
        isFlashcardFlipped: false,
        mode: 'flashcard',
        answers: [],
        startTime: new Date(),
        pauses: 0,
        wrongAnswers: [],
        currentQuestionStartTime: new Date()
    };
}

// الحصول على السؤال/البطاقة الحالية
export function getCurrentQuestion() {
    if (quizState.mode === 'flashcard') {
        if (!quizState.quizData.flashcards || quizState.quizData.flashcards.length === 0) {
            // إذا لم توجد بطاقات، انتقل مباشرة إلى وضع الاختبار
            quizState.mode = 'quiz';
            quizState.currentIndex = 0;
            return getCurrentQuestion();
        }
        
        if (quizState.currentIndex >= quizState.quizData.flashcards.length) {
            // إذا تجاوزنا عدد البطاقات، انتقل إلى وضع الاختبار
            quizState.mode = 'quiz';
            quizState.currentIndex = 0;
            return getCurrentQuestion();
        }
        
        const flashcard = quizState.quizData.flashcards[quizState.currentIndex];
        return {
            type: 'flashcard',
            data: flashcard,
            isFlipped: quizState.isFlashcardFlipped,
            index: quizState.currentIndex,
            total: quizState.quizData.flashcards.length
        };
    } else {
        if (!quizState.quizData.quizQuestions || quizState.quizData.quizQuestions.length === 0) {
            return null;
        }
        
        if (quizState.currentIndex >= quizState.quizData.quizQuestions.length) {
            return null;
        }
        
        const question = quizState.quizData.quizQuestions[quizState.currentIndex];
        
        // دعم الهيكل القديم والجديد لملفات JSON
        const correctAnswer = question.correctAnswer || (question.answers && question.answers[0]);
        const incorrectAnswers = question.incorrectAnswers || (question.answers && question.answers.slice(1)) || [];
        
        if (!correctAnswer) {
            console.error('لا توجد إجابة صحيحة محددة للسؤال:', question);
            return null;
        }
        
        // نسخ مصفوفة الإجابات الخاطئة وتخلط
        const shuffledIncorrect = [...incorrectAnswers];
        shuffleArray(shuffledIncorrect);
        
        // اختيار 3 إجابات خاطئة عشوائية (إذا كان هناك أكثر من 3)
        const selectedIncorrect = shuffledIncorrect.slice(0, 3);
        
        // إنشاء مصفوفة الإجابات النهائية مع الإجابة الصحيحة في مكان عشوائي
        const allAnswers = [correctAnswer, ...selectedIncorrect];
        shuffleArray(allAnswers);
        
        return {
            type: 'question',
            data: {
                question: question.question,
                answers: allAnswers,
                correctAnswer: correctAnswer
            },
            index: quizState.currentIndex,
            total: quizState.quizData.quizQuestions.length,
            timeStarted: quizState.currentQuestionStartTime
        };
    }
}

// الإجابة على سؤال
export function answerQuestion(selectedAnswer) {
    if (quizState.mode !== 'quiz') return false;
    
    const currentQuestion = getCurrentQuestion();
    if (!currentQuestion) return false;
    
    const isCorrect = selectedAnswer === currentQuestion.data.correctAnswer;
    
    // تسجيل الإجابة
    quizState.answers.push({
        questionIndex: quizState.currentIndex,
        selectedAnswer,
        isCorrect,
        timeSpent: (new Date() - quizState.currentQuestionStartTime) / 1000
    });
    
    // إذا كانت الإجابة خاطئة، تسجيل السؤال في قائمة الأخطاء
    if (!isCorrect) {
        quizState.wrongAnswers.push(quizState.currentIndex);
    }
    
    return isCorrect;
}

// الانتقال إلى السؤال/البطاقة التالية
export function nextQuestion() {
    // إعادة ضبط حالة قلب البطاقة
    quizState.isFlashcardFlipped = false;
    
    // تحديد الحد الأقصى للأسئلة/البطاقات بناءً على الوضع الحالي
    const maxIndex = quizState.mode === 'flashcard' 
        ? (quizState.quizData.flashcards?.length || 0) - 1
        : (quizState.quizData.quizQuestions?.length || 0) - 1;
    
    // إذا كنا في آخر عنصر، ننتقل إلى الوضع التالي أو ننهي الاختبار
    if (quizState.currentIndex >= maxIndex) {
        if (quizState.mode === 'flashcard' && quizState.quizData.quizQuestions?.length > 0) {
            // الانتقال من البطاقات إلى الأسئلة
            quizState.mode = 'quiz';
            quizState.currentIndex = 0;
            quizState.currentQuestionStartTime = new Date();
            return true;
        } else {
            // انتهاء الاختبار
            return false;
        }
    } else {
        // الانتقال إلى العنصر التالي
        quizState.currentIndex++;
        quizState.currentQuestionStartTime = new Date();
        return true;
    }
}

// العودة إلى السؤال/البطاقة السابقة
export function prevQuestion() {
    if (quizState.currentIndex > 0) {
        quizState.currentIndex--;
        quizState.isFlashcardFlipped = false;
        quizState.currentQuestionStartTime = new Date();
        return true;
    }
    return false;
}

// قلب البطاقة الحالية
export function flipFlashcard() {
    if (quizState.mode === 'flashcard') {
        quizState.isFlashcardFlipped = !quizState.isFlashcardFlipped;
    }
}

// الحصول على حالة الاختبار الحالية
export function getQuizStatus() {
    return {
        mode: quizState.mode,
        currentIndex: quizState.currentIndex,
        totalFlashcards: quizState.quizData.flashcards?.length || 0,
        totalQuestions: quizState.quizData.quizQuestions?.length || 0,
        isPaused: quizState.isPaused,
        pauses: quizState.pauses
    };
}

// إيقاف الاختبار مؤقتاً
export function pauseQuiz() {
    quizState.isPaused = true;
    quizState.pauses++;
}

// استئناف الاختبار
export function resumeQuiz() {
    quizState.isPaused = false;
    quizState.currentQuestionStartTime = new Date();
}

// الحصول على نتائج الاختبار
export function getResults() {
    const totalQuestions = quizState.quizData.quizQuestions?.length || 0;
    const answeredQuestions = quizState.answers.length;
    const correctAnswers = quizState.answers.filter(a => a.isCorrect).length;
    const wrongAnswers = quizState.answers.filter(a => !a.isCorrect).length;
    const skippedQuestions = totalQuestions - answeredQuestions;
    
    const totalTime = (new Date() - quizState.startTime) / 1000;
    
    // حساب متوسط الوقت لكل سؤال
    const totalQuestionTime = quizState.answers.reduce((total, answer) => total + answer.timeSpent, 0);
    const avgTimePerQuestion = answeredQuestions > 0 
        ? totalQuestionTime / answeredQuestions 
        : 0;
    
    // إنشاء قائمة بأوقات كل سؤال
    const perQuestionTime = quizState.answers.map(answer => answer.timeSpent);
    
    return {
        username: quizState.username,
        date: new Date().toISOString(),
        mode: 'quiz',
        totalQuestions: totalQuestions,
        correct: correctAnswers,
        wrong: wrongAnswers,
        skipped: skippedQuestions,
        pauses: quizState.pauses,
        avgTimePerQuestionSec: avgTimePerQuestion,
        perQuestionTimeSec: perQuestionTime,
        wrongQuestionsList: [...new Set(quizState.wrongAnswers)], // إزالة التكرارات
        scorePercent: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
        totalTimeSec: totalTime
    };
}

// التحقق مما إذا كان هناك محاولات سابقة للمستخدم
export function hasPreviousAttempts(quizData, username) {
    return quizData.stats && quizData.stats.some(stat => stat.username === username);
}