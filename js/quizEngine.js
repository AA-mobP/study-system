import { shuffleArray } from "./shuffle.js";

// ===== فئات الأخطاء المخصصة =====
class QuizEngineError extends Error {
  constructor(message, code = "QUIZ_ENGINE_ERROR") {
    super(message);
    this.name = "QuizEngineError";
    this.code = code;
  }
}

class ValidationError extends QuizEngineError {
  constructor(message) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

class DataIntegrityError extends QuizEngineError {
  constructor(message) {
    super(message, "DATA_INTEGRITY_ERROR");
    this.name = "DataIntegrityError";
  }
}

// ===== نظام التحقق من صحة البيانات =====
class QuizValidator {
  static validateQuizData(quizData) {
    if (!quizData || typeof quizData !== "object") {
      throw new ValidationError("بيانات الاختبار يجب أن تكون كائناً صحيحاً");
    }

    // التحقق من الحقول المطلوبة
    if (!quizData.title || typeof quizData.title !== "string") {
      throw new ValidationError("عنوان الاختبار مطلوب ويجب أن يكون نصاً");
    }

    if (typeof quizData.timer !== "number" || quizData.timer <= 0) {
      throw new ValidationError("مدة المؤقت يجب أن تكون رقماً موجباً");
    }

    // التحقق من البطاقات التعليمية
    if (quizData.flashcards) {
      this.validateFlashcards(quizData.flashcards);
    }

    // التحقق من أسئلة الاختبار
    if (quizData.quizQuestions) {
      this.validateQuizQuestions(quizData.quizQuestions);
    }

    // التأكد من وجود محتوى
    const hasFlashcards = quizData.flashcards && quizData.flashcards.length > 0;
    const hasQuestions =
      quizData.quizQuestions && quizData.quizQuestions.length > 0;

    if (!hasFlashcards && !hasQuestions) {
      throw new ValidationError(
        "يجب أن يحتوي الاختبار على بطاقات تعليمية أو أسئلة على الأقل"
      );
    }

    return true;
  }

  static validateFlashcards(flashcards) {
    if (!Array.isArray(flashcards)) {
      throw new ValidationError("البطاقات التعليمية يجب أن تكون مصفوفة");
    }

    flashcards.forEach((card, index) => {
      if (!card || typeof card !== "object") {
        throw new ValidationError(`البطاقة رقم ${index + 1} غير صحيحة`);
      }

      if (!card.question || typeof card.question !== "string") {
        throw new ValidationError(
          `السؤال في البطاقة رقم ${index + 1} مطلوب ويجب أن يكون نصاً`
        );
      }

      if (!card.answer || typeof card.answer !== "string") {
        throw new ValidationError(
          `الإجابة في البطاقة رقم ${index + 1} مطلوبة ويجب أن تكون نصاً`
        );
      }

      // التحقق من طول النصوص
      if (card.question.trim().length < 3) {
        throw new ValidationError(
          `السؤال في البطاقة رقم ${index + 1} قصير جداً`
        );
      }

      if (card.answer.trim().length < 1) {
        throw new ValidationError(`الإجابة في البطاقة رقم ${index + 1} فارغة`);
      }
    });
  }

  static validateQuizQuestions(questions) {
    if (!Array.isArray(questions)) {
      throw new ValidationError("أسئلة الاختبار يجب أن تكون مصفوفة");
    }

    questions.forEach((question, index) => {
      if (!question || typeof question !== "object") {
        throw new ValidationError(`السؤال رقم ${index + 1} غير صحيح`);
      }

      if (!question.question || typeof question.question !== "string") {
        throw new ValidationError(
          `نص السؤال رقم ${index + 1} مطلوب ويجب أن يكون نصاً`
        );
      }

      if (question.question.trim().length < 5) {
        throw new ValidationError(`نص السؤال رقم ${index + 1} قصير جداً`);
      }

      // التحقق من الإجابات - دعم الهيكل القديم والجديد
      const hasCorrectAnswer = question.correctAnswer;
      const hasAnswersArray =
        question.answers && Array.isArray(question.answers);
      const hasIncorrectAnswers =
        question.incorrectAnswers && Array.isArray(question.incorrectAnswers);

      if (!hasCorrectAnswer && !hasAnswersArray) {
        throw new ValidationError(
          `السؤال رقم ${index + 1} يجب أن يحتوي على إجابة صحيحة`
        );
      }

      if (hasAnswersArray) {
        // الهيكل القديم - مصفوفة الإجابات
        if (question.answers.length < 2) {
          throw new ValidationError(
            `السؤال رقم ${index + 1} يجب أن يحتوي على إجابتين على الأقل`
          );
        }

        if (question.answers.length > 10) {
          throw new ValidationError(
            `السؤال رقم ${
              index + 1
            } يحتوي على إجابات كثيرة جداً (الحد الأقصى 10)`
          );
        }

        // التحقق من عدم تكرار الإجابات
        const uniqueAnswers = new Set(
          question.answers.map((a) => a.trim().toLowerCase())
        );
        if (uniqueAnswers.size !== question.answers.length) {
          throw new ValidationError(
            `السؤال رقم ${index + 1} يحتوي على إجابات مكررة`
          );
        }
      } else if (hasCorrectAnswer && hasIncorrectAnswers) {
        // الهيكل الجديد - إجابة صحيحة منفصلة
        if (question.incorrectAnswers.length < 1) {
          throw new ValidationError(
            `السؤال رقم ${
              index + 1
            } يجب أن يحتوي على إجابة خاطئة واحدة على الأقل`
          );
        }

        if (question.incorrectAnswers.length > 9) {
          throw new ValidationError(
            `السؤال رقم ${
              index + 1
            } يحتوي على إجابات خاطئة كثيرة جداً (الحد الأقصى 9)`
          );
        }

        // التحقق من عدم تطابق الإجابة الصحيحة مع الخاطئة
        const correctAnswerLower = question.correctAnswer.trim().toLowerCase();
        const duplicateIncorrect = question.incorrectAnswers.some(
          (incorrect) => incorrect.trim().toLowerCase() === correctAnswerLower
        );

        if (duplicateIncorrect) {
          throw new ValidationError(
            `السؤال رقم ${
              index + 1
            } يحتوي على إجابة صحيحة مكررة في الإجابات الخاطئة`
          );
        }
      }

      // التحقق من أن جميع الإجابات نصوص
      const allAnswers = hasAnswersArray
        ? question.answers
        : [question.correctAnswer, ...question.incorrectAnswers];

      allAnswers.forEach((answer, answerIndex) => {
        if (!answer || typeof answer !== "string") {
          throw new ValidationError(
            `الإجابة رقم ${answerIndex + 1} في السؤال ${
              index + 1
            } يجب أن تكون نصاً`
          );
        }

        if (answer.trim().length < 1) {
          throw new ValidationError(
            `الإجابة رقم ${answerIndex + 1} في السؤال ${index + 1} فارغة`
          );
        }

        if (answer.length > 200) {
          throw new ValidationError(
            `الإجابة رقم ${answerIndex + 1} في السؤال ${
              index + 1
            } طويلة جداً (الحد الأقصى 200 حرف)`
          );
        }
      });
    });
  }

  static validateUsername(username) {
    if (!username || typeof username !== "string") {
      throw new ValidationError("اسم المستخدم مطلوب ويجب أن يكون نصاً");
    }

    const trimmed = username.trim();
    if (trimmed.length < 2) {
      throw new ValidationError(
        "اسم المستخدم يجب أن يحتوي على حرفين على الأقل"
      );
    }

    if (trimmed.length > 50) {
      throw new ValidationError("اسم المستخدم طويل جداً (الحد الأقصى 50 حرف)");
    }

    // منع الأحرف الخاصة التي قد تسبب مشاكل
    const invalidChars = /[<>\"'&]/;
    if (invalidChars.test(trimmed)) {
      throw new ValidationError("اسم المستخدم يحتوي على أحرف غير مسموحة");
    }

    return trimmed;
  }
}

// ===== حالة التطبيق الحالية المحسنة =====
let quizState = {
  // البيانات الأساسية
  quizData: null,
  username: "",

  // حالة التنقل
  currentIndex: 0,
  isFlashcardFlipped: false,
  mode: "flashcard",

  // بيانات الإجابات
  answers: [],
  wrongAnswers: [],
  skippedQuestions: [],

  // بيانات الوقت
  startTime: null,
  pauses: 0,
  pauseStartTime: null,
  totalPauseTime: 0,
  currentQuestionStartTime: null,
  questionTimeSpent: [],

  // حالة النظام
  isInitialized: false,
  isPaused: false,
  isFinished: false,

  // إحصائيات في الوقت الفعلي
  streak: 0, // عدد الإجابات الصحيحة المتتالية
  maxStreak: 0,
  averageTimePerQuestion: 0,

  // معلومات إضافية
  difficulty: "medium", // easy, medium, hard
  category: "",
  tags: [],
};

// ===== نظام إدارة الحالة =====
class QuizStateManager {
  static saveState() {
    try {
      const stateToSave = {
        ...quizState,
        // استبعاد البيانات الكبيرة أو الوظائف
        quizData: null, // نحفظ البيانات بشكل منفصل
      };

      sessionStorage.setItem("quizState", JSON.stringify(stateToSave));
      return true;
    } catch (error) {
      console.warn("فشل في حفظ حالة الاختبار:", error);
      return false;
    }
  }

  static loadState() {
    try {
      const saved = sessionStorage.getItem("quizState");
      if (saved) {
        const loadedState = JSON.parse(saved);

        // دمج الحالة المحفوظة مع الحالة الحالية
        Object.keys(loadedState).forEach((key) => {
          if (loadedState[key] !== null && loadedState[key] !== undefined) {
            quizState[key] = loadedState[key];
          }
        });

        return true;
      }
    } catch (error) {
      console.warn("فشل في تحميل حالة الاختبار:", error);
    }
    return false;
  }

  static clearState() {
    try {
      sessionStorage.removeItem("quizState");
      return true;
    } catch (error) {
      console.warn("فشل في مسح حالة الاختبار:", error);
      return false;
    }
  }

  static resetState() {
    const preservedData = {
      quizData: quizState.quizData,
      username: quizState.username,
    };

    // إعادة تعيين الحالة للقيم الافتراضية
    Object.keys(quizState).forEach((key) => {
      if (key === "quizData" || key === "username") {
        return; // الاحتفاظ بهذه القيم
      }

      switch (typeof quizState[key]) {
        case "number":
          quizState[key] = 0;
          break;
        case "boolean":
          quizState[key] = false;
          break;
        case "object":
          if (Array.isArray(quizState[key])) {
            quizState[key] = [];
          } else {
            quizState[key] = null;
          }
          break;
        case "string":
          if (key === "mode") {
            quizState[key] = "flashcard";
          } else if (key === "difficulty") {
            quizState[key] = "medium";
          } else {
            quizState[key] = "";
          }
          break;
      }
    });

    // استعادة البيانات المحفوظة
    Object.assign(quizState, preservedData);
  }
}

// ===== نظام إدارة الوقت =====
class TimeTracker {
  static startQuestion() {
    quizState.currentQuestionStartTime = new Date();
  }

  static endQuestion() {
    if (!quizState.currentQuestionStartTime) return 0;

    const endTime = new Date();
    const timeSpent = (endTime - quizState.currentQuestionStartTime) / 1000;

    // طرح وقت الإيقاف المؤقت إن وجد
    const adjustedTime = Math.max(0, timeSpent - this.getCurrentPauseTime());

    quizState.questionTimeSpent.push(adjustedTime);
    this.updateAverageTime();

    return adjustedTime;
  }

  static getCurrentPauseTime() {
    if (!quizState.isPaused || !quizState.pauseStartTime) return 0;
    return (new Date() - quizState.pauseStartTime) / 1000;
  }

  static startPause() {
    if (!quizState.isPaused) {
      quizState.pauseStartTime = new Date();
      quizState.isPaused = true;
      quizState.pauses++;
    }
  }

  static endPause() {
    if (quizState.isPaused && quizState.pauseStartTime) {
      const pauseDuration = (new Date() - quizState.pauseStartTime) / 1000;
      quizState.totalPauseTime += pauseDuration;
      quizState.pauseStartTime = null;
      quizState.isPaused = false;
    }
  }

  static updateAverageTime() {
    if (quizState.questionTimeSpent.length > 0) {
      const total = quizState.questionTimeSpent.reduce(
        (sum, time) => sum + time,
        0
      );
      quizState.averageTimePerQuestion =
        total / quizState.questionTimeSpent.length;
    }
  }

  static getTotalTime() {
    if (!quizState.startTime) return 0;
    return (new Date() - quizState.startTime) / 1000 - quizState.totalPauseTime;
  }
}

// ===== نظام إدارة الإحصائيات =====
class StatsTracker {
  static updateStreak(isCorrect) {
    if (isCorrect) {
      quizState.streak++;
      quizState.maxStreak = Math.max(quizState.maxStreak, quizState.streak);
    } else {
      quizState.streak = 0;
    }
  }

  static calculateAccuracy() {
    if (quizState.answers.length === 0) return 0;
    const correct = quizState.answers.filter((a) => a.isCorrect).length;
    return (correct / quizState.answers.length) * 100;
  }

  static getPerformanceLevel() {
    const accuracy = this.calculateAccuracy();
    const avgTime = quizState.averageTimePerQuestion;
    const maxTime = quizState.quizData?.timer || 30;

    if (accuracy >= 90 && avgTime <= maxTime * 0.5) return "ممتاز";
    if (accuracy >= 80 && avgTime <= maxTime * 0.7) return "جيد جداً";
    if (accuracy >= 70 && avgTime <= maxTime * 0.9) return "جيد";
    if (accuracy >= 60) return "مقبول";
    return "يحتاج تحسين";
  }

  static getDifficultyAnalysis() {
    const totalQuestions = quizState.answers.length;
    if (totalQuestions === 0) return "غير متاح";

    const correctCount = quizState.answers.filter((a) => a.isCorrect).length;
    const accuracy = (correctCount / totalQuestions) * 100;
    const avgTime = quizState.averageTimePerQuestion;
    const maxTime = quizState.quizData?.timer || 30;

    if (accuracy >= 85 && avgTime <= maxTime * 0.6) return "سهل جداً";
    if (accuracy >= 75 && avgTime <= maxTime * 0.8) return "سهل";
    if (accuracy >= 60 && avgTime <= maxTime) return "متوسط";
    if (accuracy >= 40) return "صعب";
    return "صعب جداً";
  }
}

// ===== الوظائف الرئيسية المحسنة =====

/**
 * حساب إجمالي العناصر في الاختبار
 */
function getTotalItems() {
  const flashcardsCount = quizState.quizData?.flashcards?.length || 0;
  const questionsCount = quizState.quizData?.quizQuestions?.length || 0;
  return flashcardsCount + questionsCount;
}

/**
 * إيقاف الاختبار مؤقتاً
 */
export function pauseQuiz() {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    if (quizState.isPaused) {
      console.warn("الاختبار متوقف مؤقتاً بالفعل");
      return false;
    }

    TimeTracker.startPause();
    QuizStateManager.saveState();

    console.log("تم إيقاف الاختبار مؤقتاً");
    return true;
  } catch (error) {
    console.error("خطأ في إيقاف الاختبار مؤقتاً:", error);
    throw error;
  }
}

/**
 * استئناف الاختبار
 */
export function resumeQuiz() {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    if (!quizState.isPaused) {
      console.warn("الاختبار غير متوقف مؤقتاً");
      return false;
    }

    TimeTracker.endPause();
    TimeTracker.startQuestion(); // إعادة بدء تتبع السؤال الحالي
    QuizStateManager.saveState();

    console.log("تم استئناف الاختبار");
    return true;
  } catch (error) {
    console.error("خطأ في استئناف الاختبار:", error);
    throw error;
  }
}

/**
 * إنهاء الاختبار بشكل صريح
 */
export function finishQuiz() {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    if (quizState.isFinished) {
      console.warn("الاختبار منتهي بالفعل");
      return getResults();
    }

    // إنهاء تتبع السؤال الحالي إذا كان في وضع الاختبار
    if (quizState.mode === "quiz") {
      TimeTracker.endQuestion();
    }

    // إنهاء أي إيقاف مؤقت
    if (quizState.isPaused) {
      TimeTracker.endPause();
    }

    quizState.isFinished = true;
    QuizStateManager.saveState();

    console.log("تم إنهاء الاختبار");
    return getResults();
  } catch (error) {
    console.error("خطأ في إنهاء الاختبار:", error);
    throw error;
  }
}

/**
 * الحصول على نتائج الاختبار المحسنة
 */
export function getResults() {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    const totalQuestions = quizState.quizData?.quizQuestions?.length || 0;
    const answeredQuestions = quizState.answers.length;
    const correctAnswers = quizState.answers.filter((a) => a.isCorrect).length;
    const wrongAnswers = quizState.wrongAnswers.length;
    const skippedQuestions = quizState.skippedQuestions.length;
    const unansweredQuestions = Math.max(
      0,
      totalQuestions - answeredQuestions - skippedQuestions
    );

    const totalTime = TimeTracker.getTotalTime();
    const scorePercent =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // حساب الدرجات المرجحة حسب الصعوبة
    let weightedScore = 0;
    let totalWeight = 0;

    quizState.answers.forEach((answer) => {
      const weight = getQuestionWeight(answer.difficulty);
      totalWeight += weight;
      if (answer.isCorrect) {
        weightedScore += weight;
      }
    });

    const weightedScorePercent =
      totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;

    // إحصائيات الوقت
    const avgTimePerQuestion =
      quizState.questionTimeSpent.length > 0
        ? quizState.questionTimeSpent.reduce((sum, time) => sum + time, 0) /
          quizState.questionTimeSpent.length
        : 0;

    const fastestQuestion =
      quizState.questionTimeSpent.length > 0
        ? Math.min(...quizState.questionTimeSpent)
        : 0;

    const slowestQuestion =
      quizState.questionTimeSpent.length > 0
        ? Math.max(...quizState.questionTimeSpent)
        : 0;

    // تحليل الأداء حسب الفئة
    const categoryAnalysis = analyzeCategoryPerformance();

    // تحليل الأداء حسب الصعوبة
    const difficultyAnalysis = analyzeDifficultyPerformance();

    const results = {
      // معلومات أساسية
      username: quizState.username,
      date: new Date().toISOString(),
      quizTitle: quizState.quizData.title,
      mode: "quiz",

      // إحصائيات الأسئلة
      totalQuestions,
      answeredQuestions,
      correct: correctAnswers,
      wrong: wrongAnswers,
      skipped: skippedQuestions,
      unanswered: unansweredQuestions,

      // الدرجات
      scorePercent: Math.round(scorePercent * 100) / 100,
      weightedScorePercent: Math.round(weightedScorePercent * 100) / 100,
      letterGrade: getLetterGrade(scorePercent),

      // الوقت
      totalTimeSec: Math.round(totalTime),
      avgTimePerQuestionSec: Math.round(avgTimePerQuestion * 100) / 100,
      fastestQuestionSec: Math.round(fastestQuestion * 100) / 100,
      slowestQuestionSec: Math.round(slowestQuestion * 100) / 100,
      perQuestionTimeSec: quizState.questionTimeSpent.map(
        (t) => Math.round(t * 100) / 100
      ),

      // الإيقاف المؤقت
      pauses: quizState.pauses,
      totalPauseTimeSec: Math.round(quizState.totalPauseTime),

      // الأداء
      streak: quizState.streak,
      maxStreak: quizState.maxStreak,
      accuracy: Math.round(StatsTracker.calculateAccuracy() * 100) / 100,
      performanceLevel: StatsTracker.getPerformanceLevel(),
      difficultyAnalysis: StatsTracker.getDifficultyAnalysis(),

      // التحليلات المتقدمة
      categoryPerformance: categoryAnalysis,
      difficultyPerformance: difficultyAnalysis,

      // قوائم مفصلة
      wrongQuestionsList: quizState.wrongAnswers.map((wrong) => ({
        index: wrong.questionIndex,
        question: wrong.question,
        selectedAnswer: wrong.selectedAnswer,
        correctAnswer: wrong.correctAnswer,
        explanation: wrong.explanation,
      })),

      skippedQuestionsList: quizState.skippedQuestions.map((skipped) => ({
        index: skipped.questionIndex,
        question: skipped.question,
        correctAnswer: skipped.correctAnswer,
      })),

      detailedAnswers: quizState.answers.map((answer) => ({
        questionIndex: answer.questionIndex,
        isCorrect: answer.isCorrect,
        timeSpent: Math.round(answer.timeSpent * 100) / 100,
        category: answer.category,
        difficulty: answer.difficulty,
      })),

      // معلومات إضافية
      completionRate:
        totalQuestions > 0
          ? Math.round((answeredQuestions / totalQuestions) * 100)
          : 0,
      efficiency: calculateEfficiency(
        scorePercent,
        avgTimePerQuestion,
        quizState.quizData.timer
      ),
      improvement: calculateImprovement(),

      // بيانات خام للتحليلات المستقبلية
      rawData: {
        answers: quizState.answers,
        questionTimeSpent: quizState.questionTimeSpent,
        totalPauseTime: quizState.totalPauseTime,
        startTime: quizState.startTime,
        endTime: new Date(),
      },
    };

    console.log("تم حساب النتائج:", {
      score: results.scorePercent + "%",
      correct: results.correct,
      total: results.totalQuestions,
      time: results.totalTimeSec + "s",
    });

    return results;
  } catch (error) {
    console.error("خطأ في حساب النتائج:", error);
    throw new QuizEngineError("فشل في حساب النتائج: " + error.message);
  }
}

/**
 * حساب وزن السؤال حسب الصعوبة
 */
function getQuestionWeight(difficulty) {
  const weights = {
    easy: 1,
    medium: 1.5,
    hard: 2,
    expert: 3,
  };
  return weights[difficulty] || weights["medium"];
}

/**
 * تحديد الدرجة الحرفية
 */
function getLetterGrade(scorePercent) {
  if (scorePercent >= 90) return "A";
  if (scorePercent >= 80) return "B";
  if (scorePercent >= 70) return "C";
  if (scorePercent >= 60) return "D";
  return "F";
}

/**
 * تحليل الأداء حسب الفئة
 */
function analyzeCategoryPerformance() {
  const categoryStats = {};

  quizState.answers.forEach((answer) => {
    const category = answer.category || "عام";

    if (!categoryStats[category]) {
      categoryStats[category] = {
        total: 0,
        correct: 0,
        totalTime: 0,
        questions: [],
      };
    }

    categoryStats[category].total++;
    if (answer.isCorrect) {
      categoryStats[category].correct++;
    }
    categoryStats[category].totalTime += answer.timeSpent;
    categoryStats[category].questions.push(answer.questionIndex);
  });

  // حساب النسب والمتوسطات
  Object.keys(categoryStats).forEach((category) => {
    const stats = categoryStats[category];
    stats.accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    stats.avgTime = stats.total > 0 ? stats.totalTime / stats.total : 0;
    stats.accuracy = Math.round(stats.accuracy * 100) / 100;
    stats.avgTime = Math.round(stats.avgTime * 100) / 100;
  });

  return categoryStats;
}

/**
 * تحليل الأداء حسب الصعوبة
 */
function analyzeDifficultyPerformance() {
  const difficultyStats = {};

  quizState.answers.forEach((answer) => {
    const difficulty = answer.difficulty || "medium";

    if (!difficultyStats[difficulty]) {
      difficultyStats[difficulty] = {
        total: 0,
        correct: 0,
        totalTime: 0,
        questions: [],
      };
    }

    difficultyStats[difficulty].total++;
    if (answer.isCorrect) {
      difficultyStats[difficulty].correct++;
    }
    difficultyStats[difficulty].totalTime += answer.timeSpent;
    difficultyStats[difficulty].questions.push(answer.questionIndex);
  });

  // حساب النسب والمتوسطات
  Object.keys(difficultyStats).forEach((difficulty) => {
    const stats = difficultyStats[difficulty];
    stats.accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    stats.avgTime = stats.total > 0 ? stats.totalTime / stats.total : 0;
    stats.accuracy = Math.round(stats.accuracy * 100) / 100;
    stats.avgTime = Math.round(stats.avgTime * 100) / 100;
  });

  return difficultyStats;
}

/**
 * حساب الكفاءة
 */
function calculateEfficiency(scorePercent, avgTime, maxTime) {
  if (maxTime <= 0 || avgTime <= 0) return 0;

  const timeEfficiency = Math.max(0, 1 - avgTime / maxTime);
  const accuracy = scorePercent / 100;

  // الكفاءة = (الدقة × 0.7) + (كفاءة الوقت × 0.3)
  const efficiency = accuracy * 0.7 + timeEfficiency * 0.3;

  return Math.round(efficiency * 100);
}

/**
 * حساب التحسن (يتطلب بيانات تاريخية)
 */
function calculateImprovement() {
  // هذه الوظيفة ستحتاج إلى بيانات من المحاولات السابقة
  // في الوقت الحالي، نعيد كائناً فارغاً
  return {
    available: false,
    message: "يتطلب محاولات سابقة",
  };
}

/**
 * إعادة تشغيل الاختبار
 */
export function restartQuiz() {
  try {
    if (!quizState.quizData) {
      throw new DataIntegrityError("لا توجد بيانات اختبار لإعادة التشغيل");
    }

    const preservedData = {
      quizData: quizState.quizData,
      username: quizState.username,
    };

    // إعادة تعيين الحالة
    QuizStateManager.resetState();
    Object.assign(quizState, preservedData);

    // إعادة تهيئة الاختبار
    quizState.startTime = new Date();
    quizState.isInitialized = true;
    TimeTracker.startQuestion();

    QuizStateManager.saveState();

    console.log("تم إعادة تشغيل الاختبار");
    return true;
  } catch (error) {
    console.error("خطأ في إعادة تشغيل الاختبار:", error);
    throw error;
  }
}

/**
 * التحقق من وجود محاولات سابقة للمستخدم
 */
export function hasPreviousAttempts(quizData, username) {
  try {
    if (!quizData || !quizData.stats || !username) {
      return false;
    }

    return quizData.stats.some(
      (stat) => stat.username === username && stat.totalQuestions > 0
    );
  } catch (error) {
    console.error("خطأ في التحقق من المحاولات السابقة:", error);
    return false;
  }
}

/**
 * الحصول على إحصائيات المستخدم السابقة
 */
export function getUserHistory(quizData, username) {
  try {
    if (!quizData || !quizData.stats || !username) {
      return [];
    }

    return quizData.stats
      .filter((stat) => stat.username === username)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    console.error("خطأ في الحصول على تاريخ المستخدم:", error);
    return [];
  }
}

/**
 * مقارنة الأداء الحالي مع المحاولات السابقة
 */
export function comparePerformance(currentResults, previousAttempts) {
  try {
    if (!previousAttempts || previousAttempts.length === 0) {
      return {
        available: false,
        message: "لا توجد محاولات سابقة للمقارنة",
      };
    }

    const lastAttempt = previousAttempts[0];
    const bestAttempt = previousAttempts.reduce((best, attempt) =>
      attempt.scorePercent > best.scorePercent ? attempt : best
    );

    return {
      available: true,
      current: currentResults.scorePercent,
      last: lastAttempt.scorePercent,
      best: bestAttempt.scorePercent,
      improvement: {
        fromLast: currentResults.scorePercent - lastAttempt.scorePercent,
        fromBest: currentResults.scorePercent - bestAttempt.scorePercent,
      },
      rank: getRankInHistory(currentResults, previousAttempts),
    };
  } catch (error) {
    console.error("خطأ في مقارنة الأداء:", error);
    return {
      available: false,
      message: "خطأ في حساب المقارنة",
    };
  }
}

/**
 * حساب ترتيب النتيجة الحالية في التاريخ
 */
function getRankInHistory(currentResults, previousAttempts) {
  const allScores = [
    ...previousAttempts.map((a) => a.scorePercent),
    currentResults.scorePercent,
  ];
  allScores.sort((a, b) => b - a);

  const currentRank = allScores.indexOf(currentResults.scorePercent) + 1;
  return {
    current: currentRank,
    total: allScores.length,
  };
}

/**
 * تصدير حالة الاختبار للتخزين الخارجي
 */
export function exportQuizState() {
  try {
    return {
      state: { ...quizState },
      timestamp: new Date().toISOString(),
      version: "2.0",
    };
  } catch (error) {
    console.error("خطأ في تصدير حالة الاختبار:", error);
    throw error;
  }
}

/**
 * استيراد حالة الاختبار من التخزين الخارجي
 */
export function importQuizState(exportedState) {
  try {
    if (!exportedState || !exportedState.state) {
      throw new ValidationError("البيانات المستوردة غير صحيحة");
    }

    // التحقق من الإصدار
    const version = exportedState.version || "1.0";
    if (version !== "2.0") {
      console.warn("إصدار غير متطابق، قد تحدث مشاكل في التوافق");
    }

    // استعادة الحالة
    Object.assign(quizState, exportedState.state);

    return true;
  } catch (error) {
    console.error("خطأ في استيراد حالة الاختبار:", error);
    throw error;
  }
}

/**
 * تنظيف موارد محرك الاختبار
 */
export function cleanup() {
  try {
    // حفظ الحالة النهائية
    QuizStateManager.saveState();

    console.log("تم تنظيف محرك الاختبار");
    return true;
  } catch (error) {
    console.error("خطأ في تنظيف محرك الاختبار:", error);
    return false;
  }
}

// ===== معالجة الأحداث ومستمعي النافذة =====
if (typeof window !== "undefined") {
  // حفظ الحالة عند إغلاق النافذة
  window.addEventListener("beforeunload", () => {
    QuizStateManager.saveState();
  });

  // استعادة الحالة عند تحميل الصفحة
  window.addEventListener("load", () => {
    QuizStateManager.loadState();
  });
}

// ===== تصدير الواجهات والفئات للاستخدام الخارجي =====
export {
  QuizEngineError,
  ValidationError,
  DataIntegrityError,
  QuizValidator,
  QuizStateManager,
  TimeTracker,
  StatsTracker,
};

// تصدير حالة القراءة فقط للاختبار والتطوير
export const getQuizState = () => ({ ...quizState });

console.log("تم تحميل محرك الاختبار المحسن v2.0");
// تهيئة الاختبار مع التحقق من صحة البيانات

export function initializeQuiz(quizData, username) {
  try {
    // التحقق من صحة المدخلات
    QuizValidator.validateQuizData(quizData);
    const validatedUsername = QuizValidator.validateUsername(username);

    // إعادة تعيين الحالة
    QuizStateManager.resetState();

    // تهيئة البيانات الأساسية
    quizState.quizData = quizData;
    quizState.username = validatedUsername;
    quizState.startTime = new Date();
    quizState.isInitialized = true;

    // تحديد البيانات الإضافية
    quizState.category = quizData.category || "";
    quizState.difficulty = quizData.difficulty || "medium";
    quizState.tags = quizData.tags || [];

    // بدء تتبع الوقت للسؤال الأول
    TimeTracker.startQuestion();

    // حفظ الحالة
    QuizStateManager.saveState();

    console.log("تم تهيئة الاختبار بنجاح:", {
      title: quizData.title,
      flashcards: quizData.flashcards?.length || 0,
      questions: quizData.quizQuestions?.length || 0,
      username: validatedUsername,
    });

    return true;
  } catch (error) {
    console.error("فشل في تهيئة الاختبار:", error);

    if (error instanceof ValidationError) {
      throw error; // إعادة رمي أخطاء التحقق للمعالجة في المستوى الأعلى
    }

    throw new QuizEngineError("فشل في تهيئة الاختبار: " + error.message);
  }
}

/**
 * الحصول على السؤال/البطاقة الحالية مع تحسينات الأمان
 */
export function getCurrentQuestion() {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    if (quizState.isFinished) {
      return null;
    }

    if (quizState.mode === "flashcard") {
      return getCurrentFlashcard();
    } else {
      return getCurrentQuizQuestion();
    }
  } catch (error) {
    console.error("خطأ في الحصول على السؤال الحالي:", error);
    throw error;
  }
}

/**
 * الحصول على البطاقة التعليمية الحالية
 */
function getCurrentFlashcard() {
  const flashcards = quizState.quizData.flashcards;

  if (!flashcards || flashcards.length === 0) {
    // إذا لم توجد بطاقات، انتقل إلى وضع الاختبار
    quizState.mode = "quiz";
    quizState.currentIndex = 0;
    TimeTracker.startQuestion();
    return getCurrentQuizQuestion();
  }

  if (quizState.currentIndex >= flashcards.length) {
    // إذا تجاوزنا عدد البطاقات، انتقل إلى وضع الاختبار
    quizState.mode = "quiz";
    quizState.currentIndex = 0;
    TimeTracker.startQuestion();
    return getCurrentQuizQuestion();
  }

  const flashcard = flashcards[quizState.currentIndex];

  // التحقق من صحة البطاقة
  if (!flashcard || !flashcard.question || !flashcard.answer) {
    throw new DataIntegrityError(
      `البطاقة رقم ${quizState.currentIndex + 1} تحتوي على بيانات غير صحيحة`
    );
  }

  return {
    type: "flashcard",
    data: {
      question: sanitizeString(flashcard.question),
      answer: sanitizeString(flashcard.answer),
      hint: flashcard.hint ? sanitizeString(flashcard.hint) : null,
      category: flashcard.category || "",
      difficulty: flashcard.difficulty || "medium",
    },
    isFlipped: quizState.isFlashcardFlipped,
    index: quizState.currentIndex,
    total: flashcards.length,
    progress: ((quizState.currentIndex + 1) / flashcards.length) * 100,
  };
}

/**
 * الحصول على سؤال الاختبار الحالي
 */
function getCurrentQuizQuestion() {
  const questions = quizState.quizData.quizQuestions;

  if (!questions || questions.length === 0) {
    return null;
  }

  if (quizState.currentIndex >= questions.length) {
    quizState.isFinished = true;
    return null;
  }

  const question = questions[quizState.currentIndex];

  // التحقق من صحة السؤال
  if (!question || !question.question) {
    throw new DataIntegrityError(
      `السؤال رقم ${quizState.currentIndex + 1} يحتوي على بيانات غير صحيحة`
    );
  }

  // دعم الهيكل القديم والجديد لملفات JSON
  let correctAnswer, incorrectAnswers;

  if (question.correctAnswer && question.incorrectAnswers) {
    // الهيكل الجديد
    correctAnswer = question.correctAnswer;
    incorrectAnswers = question.incorrectAnswers;
  } else if (question.answers && Array.isArray(question.answers)) {
    // الهيكل القديم
    correctAnswer = question.answers[0];
    incorrectAnswers = question.answers.slice(1);
  } else {
    throw new DataIntegrityError(
      `السؤال رقم ${quizState.currentIndex + 1} لا يحتوي على إجابات صحيحة`
    );
  }

  if (!correctAnswer) {
    throw new DataIntegrityError(
      `السؤال رقم ${quizState.currentIndex + 1} لا يحتوي على إجابة صحيحة`
    );
  }

  // نسخ وخلط الإجابات الخاطئة
  const shuffledIncorrect = [...incorrectAnswers];
  shuffleArray(shuffledIncorrect);

  // اختيار عدد محدود من الإجابات الخاطئة (الافتراضي 3)
  const maxIncorrectAnswers = Math.min(3, shuffledIncorrect.length);
  const selectedIncorrect = shuffledIncorrect.slice(0, maxIncorrectAnswers);

  // إنشاء مصفوفة الإجابات النهائية
  const allAnswers = [correctAnswer, ...selectedIncorrect];
  shuffleArray(allAnswers);

  // تنظيف وتأمين النصوص
  const sanitizedAnswers = allAnswers.map((answer) => sanitizeString(answer));
  const sanitizedCorrectAnswer = sanitizeString(correctAnswer);

  return {
    type: "question",
    data: {
      question: sanitizeString(question.question),
      answers: sanitizedAnswers,
      correctAnswer: sanitizedCorrectAnswer,
      explanation: question.explanation
        ? sanitizeString(question.explanation)
        : null,
      category: question.category || "",
      difficulty: question.difficulty || "medium",
      tags: question.tags || [],
    },
    index: quizState.currentIndex,
    total: questions.length,
    progress: ((quizState.currentIndex + 1) / questions.length) * 100,
    timeStarted: quizState.currentQuestionStartTime,

    // إحصائيات إضافية
    streak: quizState.streak,
    accuracy: StatsTracker.calculateAccuracy(),
    averageTime: quizState.averageTimePerQuestion,
  };
}

/**
 * تنظيف وتأمين النصوص من المحتوى الضار
 */
function sanitizeString(str) {
  if (typeof str !== "string") return "";

  return str
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
}

/**
 * الإجابة على سؤال مع تحسينات الأمان والتتبع
 */
export function answerQuestion(selectedAnswer) {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    if (quizState.mode !== "quiz") {
      throw new ValidationError(
        "الإجابة على الأسئلة متاحة فقط في وضع الاختبار"
      );
    }

    if (quizState.isPaused) {
      throw new ValidationError("لا يمكن الإجابة أثناء إيقاف الاختبار مؤقتاً");
    }

    if (quizState.isFinished) {
      throw new ValidationError("الاختبار منتهي بالفعل");
    }

    const currentQuestion = getCurrentQuestion();
    if (!currentQuestion) {
      throw new DataIntegrityError("لا يوجد سؤال حالي للإجابة عليه");
    }

    // تنظيف وتأمين الإجابة المحددة
    const cleanSelectedAnswer = sanitizeString(selectedAnswer);
    if (!cleanSelectedAnswer) {
      throw new ValidationError("الإجابة المحددة غير صحيحة");
    }

    // التحقق من أن الإجابة من ضمن الخيارات المتاحة
    const availableAnswers = currentQuestion.data.answers.map((a) =>
      sanitizeString(a)
    );
    if (!availableAnswers.includes(cleanSelectedAnswer)) {
      throw new ValidationError("الإجابة المحددة ليست من ضمن الخيارات المتاحة");
    }

    // حساب الوقت المستغرق
    const timeSpent = TimeTracker.endQuestion();

    // التحقق من الإجابة
    const isCorrect =
      cleanSelectedAnswer ===
      sanitizeString(currentQuestion.data.correctAnswer);

    // تحديث الإحصائيات
    StatsTracker.updateStreak(isCorrect);

    // تسجيل الإجابة
    const answerRecord = {
      questionIndex: quizState.currentIndex,
      question: currentQuestion.data.question,
      selectedAnswer: cleanSelectedAnswer,
      correctAnswer: currentQuestion.data.correctAnswer,
      isCorrect,
      timeSpent,
      timestamp: new Date().toISOString(),
      category: currentQuestion.data.category,
      difficulty: currentQuestion.data.difficulty,
    };

    quizState.answers.push(answerRecord);

    // إذا كانت الإجابة خاطئة، تسجيل السؤال في قائمة الأخطاء
    if (!isCorrect) {
      quizState.wrongAnswers.push({
        questionIndex: quizState.currentIndex,
        question: currentQuestion.data.question,
        selectedAnswer: cleanSelectedAnswer,
        correctAnswer: currentQuestion.data.correctAnswer,
        explanation: currentQuestion.data.explanation,
      });
    }

    // حفظ الحالة
    QuizStateManager.saveState();

    console.log("تم تسجيل الإجابة:", {
      question: quizState.currentIndex + 1,
      isCorrect,
      timeSpent: timeSpent.toFixed(2) + "s",
      accuracy: StatsTracker.calculateAccuracy().toFixed(1) + "%",
    });

    return isCorrect;
  } catch (error) {
    console.error("خطأ في تسجيل الإجابة:", error);
    throw error;
  }
}

/**
 * تخطي السؤال الحالي
 */
export function skipQuestion() {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    if (quizState.mode !== "quiz") {
      throw new ValidationError("تخطي الأسئلة متاح فقط في وضع الاختبار");
    }

    const currentQuestion = getCurrentQuestion();
    if (!currentQuestion) {
      return false;
    }

    const timeSpent = TimeTracker.endQuestion();

    // تسجيل السؤال كمتخطى
    quizState.skippedQuestions.push({
      questionIndex: quizState.currentIndex,
      question: currentQuestion.data.question,
      correctAnswer: currentQuestion.data.correctAnswer,
      timeSpent,
    });

    // حفظ الحالة
    QuizStateManager.saveState();

    return true;
  } catch (error) {
    console.error("خطأ في تخطي السؤال:", error);
    throw error;
  }
}

/**
 * الانتقال إلى السؤال/البطاقة التالية
 */
export function nextQuestion() {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    // إعادة ضبط حالة قلب البطاقة
    quizState.isFlashcardFlipped = false;

    // تحديد الحد الأقصى للأسئلة/البطاقات بناءً على الوضع الحالي
    const currentCollection =
      quizState.mode === "flashcard"
        ? quizState.quizData.flashcards
        : quizState.quizData.quizQuestions;

    const maxIndex = (currentCollection?.length || 0) - 1;

    // إذا كنا في آخر عنصر، تحقق من إمكانية الانتقال إلى الوضع التالي
    if (quizState.currentIndex >= maxIndex) {
      if (
        quizState.mode === "flashcard" &&
        quizState.quizData.quizQuestions?.length > 0
      ) {
        // الانتقال من البطاقات إلى الأسئلة
        quizState.mode = "quiz";
        quizState.currentIndex = 0;
        TimeTracker.startQuestion();

        console.log("تم الانتقال من البطاقات التعليمية إلى وضع الاختبار");
        QuizStateManager.saveState();
        return true;
      } else {
        // انتهاء الاختبار
        quizState.isFinished = true;
        QuizStateManager.saveState();

        console.log("انتهى الاختبار");
        return false;
      }
    } else {
      // الانتقال إلى العنصر التالي
      quizState.currentIndex++;
      TimeTracker.startQuestion();

      QuizStateManager.saveState();
      return true;
    }
  } catch (error) {
    console.error("خطأ في الانتقال إلى السؤال التالي:", error);
    throw error;
  }
}

/**
 * العودة إلى السؤال/البطاقة السابقة
 */
export function prevQuestion() {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    if (quizState.currentIndex > 0) {
      quizState.currentIndex--;
      quizState.isFlashcardFlipped = false;
      TimeTracker.startQuestion();

      QuizStateManager.saveState();
      return true;
    }

    return false;
  } catch (error) {
    console.error("خطأ في العودة إلى السؤال السابق:", error);
    throw error;
  }
}

/**
 * الانتقال إلى سؤال محدد
 */
export function goToQuestion(questionIndex) {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    const currentCollection =
      quizState.mode === "flashcard"
        ? quizState.quizData.flashcards
        : quizState.quizData.quizQuestions;

    if (
      !currentCollection ||
      questionIndex < 0 ||
      questionIndex >= currentCollection.length
    ) {
      throw new ValidationError("رقم السؤال غير صحيح");
    }

    quizState.currentIndex = questionIndex;
    quizState.isFlashcardFlipped = false;
    TimeTracker.startQuestion();

    QuizStateManager.saveState();
    return true;
  } catch (error) {
    console.error("خطأ في الانتقال إلى السؤال المحدد:", error);
    throw error;
  }
}

/**
 * قلب البطاقة الحالية
 */
export function flipFlashcard() {
  try {
    if (!quizState.isInitialized) {
      throw new DataIntegrityError("الاختبار غير مهيأ");
    }

    if (quizState.mode !== "flashcard") {
      throw new ValidationError(
        "قلب البطاقة متاح فقط في وضع البطاقات التعليمية"
      );
    }

    quizState.isFlashcardFlipped = !quizState.isFlashcardFlipped;

    QuizStateManager.saveState();
    return quizState.isFlashcardFlipped;
  } catch (error) {
    console.error("خطأ في قلب البطاقة:", error);
    throw error;
  }
}

/**
 * الحصول على حالة الاختبار الحالية
 */
export function getQuizStatus() {
  try {
    const flashcards = quizState.quizData?.flashcards || [];
    const questions = quizState.quizData?.quizQuestions || [];

    return {
      // الحالة الأساسية
      mode: quizState.mode,
      currentIndex: quizState.currentIndex,
      isInitialized: quizState.isInitialized,
      isPaused: quizState.isPaused,
      isFinished: quizState.isFinished,

      // المحتوى
      totalFlashcards: flashcards.length,
      totalQuestions: questions.length,
      hasFlashcards: flashcards.length > 0,
      hasQuestions: questions.length > 0,

      // التقدم
      progress: getCurrentProgress(),

      // الإحصائيات
      pauses: quizState.pauses,
      totalAnswers: quizState.answers.length,
      correctAnswers: quizState.answers.filter((a) => a.isCorrect).length,
      wrongAnswers: quizState.wrongAnswers.length,
      skippedQuestions: quizState.skippedQuestions.length,

      // الوقت
      totalTime: TimeTracker.getTotalTime(),
      averageTimePerQuestion: quizState.averageTimePerQuestion,

      // الأداء
      streak: quizState.streak,
      maxStreak: quizState.maxStreak,
      accuracy: StatsTracker.calculateAccuracy(),
      performanceLevel: StatsTracker.getPerformanceLevel(),
      difficulty: StatsTracker.getDifficultyAnalysis(),
    };
  } catch (error) {
    console.error("خطأ في الحصول على حالة الاختبار:", error);
    return {
      mode: "flashcard",
      currentIndex: 0,
      isInitialized: false,
      isPaused: false,
      isFinished: false,
      totalFlashcards: 0,
      totalQuestions: 0,
      hasFlashcards: false,
      hasQuestions: false,
      progress: 0,
      pauses: 0,
      error: error.message,
    };
  }
}

/**
 * حساب التقدم الحالي
 */
function getCurrentProgress() {
  if (!quizState.isInitialized) return 0;

  const totalItems = getTotalItems();
  if (totalItems === 0) return 0;

  let completedItems = 0;

  if (quizState.mode === "flashcard") {
    completedItems = quizState.currentIndex;
  } else {
    // في وضع الاختبار، نحسب البطاقات المكتملة + الأسئلة الحالية
    const flashcardsCount = quizState.quizData?.flashcards?.length || 0;
    completedItems = flashcardsCount + quizState.currentIndex;
  }

  return Math.min(100, (completedItems / totalItems) * 100);
}
