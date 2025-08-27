import { initFileSystem, openJsonFile, saveJsonFile } from "./fs.js";
import {
  initializeQuiz,
  getCurrentQuestion,
  answerQuestion,
  nextQuestion,
  prevQuestion,
  flipFlashcard,
  getQuizStatus,
  pauseQuiz,
  resumeQuiz,
  getResults,
} from "./quizEngine.js";
import {
  initTimer,
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  setTimeUpCallback,
  setTickCallback,
} from "./timer.js";
import {
  updateUI,
  showResults,
  showLeaderboard,
  flashScreen,
  updateTimerDisplay,
  highlightAnswer,
  destroyUI,
} from "./ui.js";
import {
  playSound,
  setAudioEnabled,
  setVisualEffectsEnabled,
} from "./feedback.js";
import { shuffleArray, shuffleQuizData, initShuffleSystem } from "./shuffle.js";
import {
  addSessionResult,
  getLeaderboard,
  compareUserPerformance,
  getSummaryStats,
} from "./stats.js";

// حالة التطبيق
let appState = {
  currentMode: null,
  isPaused: false,
  currentFileHandle: null,
  quizData: null,
  username: "",
};

// تهيئة التطبيق
async function initApp() {
  try {
    // تهيئة جميع الأنظمة
    await initFileSystem();
    initShuffleSystem();

    // إعداد معالجي الأحداث
    setupEventListeners();

    console.log("تم تهيئة التطبيق بنجاح");
  } catch (error) {
    console.error("فشل في تهيئة التطبيق:", error);
    showError("فشل في تهيئة التطبيق. يرجى تحديث الصفحة والمحاولة مرة أخرى.");
  }
}

// إعداد معالجي الأحداث
function setupEventListeners() {
  // الأزرار الرئيسية
  document.getElementById("start-btn").addEventListener("click", startQuiz);
  document.getElementById("pause-btn").addEventListener("click", togglePause);
  document.getElementById("prev-btn").addEventListener("click", navigatePrev);
  document
    .getElementById("flip-btn")
    .addEventListener("click", flipCurrentCard);
  document.getElementById("next-btn").addEventListener("click", navigateNext);
  document.getElementById("restart-btn").addEventListener("click", restartQuiz);
  document
    .getElementById("compare-btn")
    .addEventListener("click", showComparison);

  // أحداث لوحة المفاتيح
  document.addEventListener("keydown", handleKeyDown);
}

// بدء الاختبار
async function startQuiz() {
  try {
    const username = document.getElementById("username").value.trim();
    const jsonFile = document.getElementById("json-file").value.trim();

    if (!username) {
      showError("يرجى إدخال اسم المستخدم");
      return;
    }

    appState.username = username;

    // تحميل ملف JSON
    const fileData = await openJsonFile(jsonFile);
    if (!fileData) {
      showError("فشل في تحميل ملف JSON");
      return;
    }

    appState.quizData = fileData.data;
    appState.currentFileHandle = fileData.fileHandle;

    // خلط البيانات إذا لزم الأمر
    appState.quizData = shuffleQuizData(appState.quizData);

    // تهيئة الاختبار
    initializeQuiz(appState.quizData, username);

    // تحديث واجهة المستخدم
    updateUI(getCurrentQuestion(), getQuizStatus());

    // بدء المؤقت
    initTimer(appState.quizData.timer, handleTimeUp);
    setTickCallback(handleTimerTick);
    startTimer();

    // تحديث حالة التطبيق
    appState.currentMode = "quiz";
    appState.isPaused = false;

    // تفعيل الأزرار
    document.getElementById("pause-btn").disabled = false;
    document.getElementById("prev-btn").disabled = false;
    document.getElementById("flip-btn").disabled = false;
    document.getElementById("next-btn").disabled = false;
    document.getElementById("start-btn").disabled = true;
  } catch (error) {
    console.error("فشل في بدء الاختبار:", error);
    showError(
      "فشل في بدء الاختبار. يرجى التحقق من ملف JSON والمحاولة مرة أخرى."
    );
  }
}

// التعامل مع انتهاء الوقت
function handleTimeUp() {
  if (appState.currentMode === "quiz") {
    navigateNext();
  }
}

// التعامل مع تحديث المؤقت
function handleTimerTick(remainingTime) {
  updateTimerDisplay(remainingTime, appState.quizData.timer);
}

// التبديل بين الإيقاف المؤقت والاستئناف
function togglePause() {
  if (appState.isPaused) {
    resumeQuiz();
    resumeTimer();
    appState.isPaused = false;
    document.getElementById("pause-btn").textContent = "إيقاف مؤقت";
  } else {
    pauseQuiz();
    pauseTimer();
    appState.isPaused = true;
    document.getElementById("pause-btn").textContent = "استئناف";
  }
}

// التنقل إلى السؤال السابق
function navigatePrev() {
  prevQuestion();
  updateUI(getCurrentQuestion(), getQuizStatus());
  resetTimer(appState.quizData.timer);
  startTimer();
}

// قلب البطاقة الحالية
function flipCurrentCard() {
  flipFlashcard();
  updateUI(getCurrentQuestion(), getQuizStatus());
}

// التنقل إلى السؤال التالي
function navigateNext() {
  const hasNext = nextQuestion();

  if (hasNext) {
    updateUI(getCurrentQuestion(), getQuizStatus());
    resetTimer(appState.quizData.timer);
    startTimer();
  } else {
    finishQuiz();
  }
}

// إنهاء الاختبار وعرض النتائج
async function finishQuiz() {
  stopTimer();

  const results = getResults();
  showResults(results);

  // حفظ الإحصائيات
  if (appState.currentFileHandle) {
    const updatedData = addSessionResult(appState.quizData, results);
    await saveJsonFile(appState.currentFileHandle, updatedData);
    appState.quizData = updatedData;
  }

  // إظهار زر المقارنة إذا كانت هناك إحصائيات سابقة
  const userStats =
    appState.quizData.stats?.filter(
      (stat) => stat.username === appState.username
    ) || [];
  if (userStats.length > 1) {
    document.getElementById("comparison-section").classList.remove("hidden");
  }
}

// إعادة开始 الاختبار
function restartQuiz() {
  // إخفاء النتائج
  document.getElementById("results").classList.add("hidden");
  document.getElementById("leaderboard").classList.add("hidden");
  document.getElementById("comparison-section").classList.add("hidden");

  // إعادة تعيين الأنظمة
  stopTimer();

  // بدء الاختبار مرة أخرى
  startQuiz();
}

// عرض المقارنة
function showComparison() {
  const leaderboard = getLeaderboard(appState.quizData);
  showLeaderboard(leaderboard);
}

// التعامل مع ضغطات المفاتيح
function handleKeyDown(event) {
  if (appState.currentMode !== "quiz" && appState.currentMode !== "flashcard")
    return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (appState.currentMode === "flashcard") {
        flipCurrentCard();
      }
      break;
    case "ArrowLeft":
      event.preventDefault();
      navigatePrev();
      break;
    case "ArrowRight":
      event.preventDefault();
      navigateNext();
      break;
    case " ":
      event.preventDefault();
      togglePause();
      break;
  }
}

// التعامل مع الإجابة على السؤال
window.handleAnswer = function (selectedAnswer) {
  const isCorrect = answerQuestion(selectedAnswer);

  // تقديم تغذية راجعة
  if (isCorrect) {
    playSound("correct");
    flashScreen("correct");
  } else {
    playSound("wrong");
    flashScreen("wrong");
  }

  // تمييز الإجابة
  highlightAnswer(selectedAnswer, isCorrect);

  // الانتقال التلقائي بعد تأخير
  setTimeout(() => {
    navigateNext();
  }, 1500);
};

// عرض خطأ
function showError(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e74c3c;
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 10000;
        max-width: 300px;
    `;

  document.body.appendChild(errorDiv);

  // إزالة رسالة الخطأ بعد 5 ثوان
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 5000);
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", initApp);

// تنظيف الموارد عند إغلاق الصفحة
window.addEventListener("beforeunload", () => {
  destroyUI();
  stopTimer();
});
