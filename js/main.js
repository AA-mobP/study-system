// تحديث العرض بعد تحميل الملف
function updateDisplayAfterFileLoad() {
  if (!appState.quizData) return;

  const activeTab = document.querySelector(".tab-button.active");

  if (activeTab && activeTab.id === "flashcards-tab") {
    // إذا كنا في تبويب البطاقات
    if (
      appState.quizData.flashcards &&
      appState.quizData.flashcards.length > 0
    ) {
      displayFlashcardPreview();
      NotificationManager.showSuccess(
        `تم تحميل ${appState.quizData.flashcards.length} بطاقة تعليمية`
      );
    } else {
      NotificationManager.showWarning("لا توجد بطاقات تعليمية في هذا الملف");
      // التبديل تلقائياً إلى تبويب الاختبار
      document.getElementById("quiz-tab").click();
    }
  } else {
    // إذا كنا في تبويب الاختبار
    if (
      appState.quizData.quizQuestions &&
      appState.quizData.quizQuestions.length > 0
    ) {
      showQuizPreview();
      NotificationManager.showSuccess(
        `تم تحميل ${appState.quizData.quizQuestions.length} سؤال`
      );
    } else {
      NotificationManager.showWarning("لا توجد أسئلة اختبار في هذا الملف");
      // التبديل تلقائياً إلى تبويب البطاقات إن أمكن
      if (
        appState.quizData.flashcards &&
        appState.quizData.flashcards.length > 0
      ) {
        document.getElementById("flashcards-tab").click();
      }
    }
  }

  // تحديث معلومات الملف
  updateFileInfo();
}

// عرض معاينة الاختبار
function showQuizPreview() {
  if (!appState.quizData || !appState.quizData.quizQuestions) return;

  const contentArea = document.getElementById("content-area");
  const firstQuestion = appState.quizData.quizQuestions[0];

  if (firstQuestion) {
    contentArea.innerHTML = `
      <div class="quiz-preview">
        <div class="question-preview">
          <h3>معاينة السؤال الأول:</h3>
          <div class="sample-question">
            <p class="question-text">${sanitizeHTML(firstQuestion.question)}</p>
            <div class="sample-answers">
              ${getPreviewAnswers(firstQuestion)
                .map(
                  (answer) =>
                    `<div class="sample-answer">${sanitizeHTML(answer)}</div>`
                )
                .join("")}
            </div>
          </div>
        </div>
        <div class="preview-info">
          <p>عدد الأسئلة: ${appState.quizData.quizQuestions.length}</p>
          <p>عدد البطاقات: ${appState.quizData.flashcards?.length || 0}</p>
          <p>مدة كل سؤال: ${appState.quizData.timer} ثانية</p>
          <p class="preview-hint">أدخل اسم المستخدم واضغط "ابدأ الاختبار" للمتابعة</p>
        </div>
      </div>
    `;
  }
}

// الحصول على معاينة الإجابات
function getPreviewAnswers(question) {
  if (question.answers && Array.isArray(question.answers)) {
    return question.answers.slice(0, 2); // أول إجابتين فقط للمعاينة
  } else if (question.correctAnswer && question.incorrectAnswers) {
    return [question.correctAnswer, question.incorrectAnswers[0]].filter(
      Boolean
    );
  }
  return ["إجابة تجريبية 1", "إجابة تجريبية 2"];
}

// تحديث معلومات الملف
function updateFileInfo() {
  if (!appState.quizData) return;

  const quizTitle = document.getElementById("quiz-title");
  if (quizTitle && appState.quizData.title) {
    quizTitle.textContent = appState.quizData.title;
  }

  // تحديث عداد الأسئلة إذا لم يكن هناك اختبار نشط
  if (!appState.isInitialized) {
    const questionCounter = document.getElementById("question-counter");
    if (questionCounter) {
      const flashcardCount = appState.quizData.flashcards?.length || 0;
      const questionCount = appState.quizData.quizQuestions?.length || 0;
      questionCounter.textContent = `البطاقات: ${flashcardCount} | الأسئلة: ${questionCount}`;
    }
  }
}
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

// ===== أنظمة إدارة الموارد والأخطاء =====
class ErrorHandler {
  static handleError(error, context = "", showToUser = true) {
    console.error(`[${context}]`, error);

    // تسجيل الخطأ
    this.logError(error, context);

    // إظهار رسالة للمستخدم
    if (showToUser) {
      this.showUserFriendlyMessage(error, context);
    }
  }

  static logError(error, context) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      context,
      message: error.message || error,
      stack: error.stack || "No stack trace",
      userAgent: navigator.userAgent,
    };

    // يمكن إرسال هذا إلى خدمة تسجيل خارجية
    console.debug("Error logged:", errorLog);
  }

  static showUserFriendlyMessage(error, context) {
    let message = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";

    if (context === "fileLoad") {
      message = "فشل في تحميل الملف. تأكد من صحة الملف والمحاولة مرة أخرى.";
    } else if (context === "quizInit") {
      message = "فشل في تهيئة الاختبار. تحقق من البيانات والمحاولة مرة أخرى.";
    } else if (context === "timer") {
      message = "مشكلة في المؤقت. سيتم المتابعة بدون مؤقت.";
    }

    NotificationManager.showError(message);
  }

  static getUserFriendlyMessage(error) {
    const errorMessages = {
      NetworkError: "مشكلة في الاتصال بالإنترنت",
      TypeError: "خطأ في البيانات المدخلة",
      ReferenceError: "مرجع غير صحيح في الكود",
      SyntaxError: "خطأ في تركيب الملف",
    };

    return errorMessages[error.name] || error.message || "خطأ غير محدد";
  }
}

class ResourceManager {
  constructor() {
    this.resources = new Map();
    this.eventListeners = new Map();
    this.timeouts = new Set();
    this.intervals = new Set();
    this.abortControllers = new Map();
  }

  addEventListener(element, event, handler, options = {}) {
    try {
      const key = `${element.id || Math.random()}-${event}`;
      const abortController = new AbortController();

      element.addEventListener(event, handler, {
        ...options,
        signal: abortController.signal,
      });

      this.eventListeners.set(key, {
        element,
        event,
        handler,
        abortController,
      });
      return key;
    } catch (error) {
      ErrorHandler.handleError(error, "addEventListener", false);
      return null;
    }
  }

  removeEventListener(key) {
    const listener = this.eventListeners.get(key);
    if (listener) {
      listener.abortController.abort();
      this.eventListeners.delete(key);
    }
  }

  setTimeout(callback, delay) {
    const timeoutId = window.setTimeout(callback, delay);
    this.timeouts.add(timeoutId);
    return timeoutId;
  }

  setInterval(callback, interval) {
    const intervalId = window.setInterval(callback, interval);
    this.intervals.add(intervalId);
    return intervalId;
  }

  clearTimeout(timeoutId) {
    window.clearTimeout(timeoutId);
    this.timeouts.delete(timeoutId);
  }

  clearInterval(intervalId) {
    window.clearInterval(intervalId);
    this.intervals.delete(intervalId);
  }

  cleanup() {
    // تنظيف جميع مستمعي الأحداث
    this.eventListeners.forEach(({ abortController }) => {
      abortController.abort();
    });
    this.eventListeners.clear();

    // تنظيف المؤقتات
    this.timeouts.forEach((id) => window.clearTimeout(id));
    this.timeouts.clear();

    this.intervals.forEach((id) => window.clearInterval(id));
    this.intervals.clear();

    // تنظيف الموارد
    this.resources.clear();
    this.abortControllers.clear();
  }

  addResource(key, resource) {
    this.resources.set(key, resource);
  }

  getResource(key) {
    return this.resources.get(key);
  }

  removeResource(key) {
    const resource = this.resources.get(key);
    if (resource && typeof resource.destroy === "function") {
      resource.destroy();
    }
    this.resources.delete(key);
  }
}

class NotificationManager {
  static show(message, type = "info", duration = 5000) {
    try {
      const notification = document.createElement("div");
      notification.className = `notification notification-${type}`;
      notification.setAttribute("role", "alert");
      notification.setAttribute("aria-live", "polite");

      notification.innerHTML = `
        <div class="notification-content">
          <span class="notification-message">${this.sanitizeHTML(
            message
          )}</span>
          <button class="notification-close" aria-label="إغلاق الإشعار">×</button>
        </div>
      `;

      // إضافة مستمع إغلاق
      const closeBtn = notification.querySelector(".notification-close");
      closeBtn.addEventListener("click", () => this.remove(notification));

      // إضافة الإشعار للصفحة
      document.body.appendChild(notification);

      // إزالة تلقائية
      if (duration > 0) {
        setTimeout(() => this.remove(notification), duration);
      }

      // تأثير الدخول
      requestAnimationFrame(() => {
        notification.classList.add("notification-show");
      });

      return notification;
    } catch (error) {
      console.error("Failed to show notification:", error);
    }
  }

  static showError(message, duration = 8000) {
    return this.show(message, "error", duration);
  }

  static showSuccess(message, duration = 3000) {
    return this.show(message, "success", duration);
  }

  static showWarning(message, duration = 5000) {
    return this.show(message, "warning", duration);
  }

  static remove(notification) {
    if (notification && notification.parentNode) {
      notification.classList.add("notification-hide");
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }

  static sanitizeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

class ValidationUtils {
  static sanitizeInput(input) {
    if (typeof input !== "string") return "";

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      .trim();
  }

  static validateJsonStructure(data) {
    if (!data || typeof data !== "object") {
      throw new Error("البيانات يجب أن تكون كائن JSON صحيح");
    }

    const requiredFields = ["title", "timer"];
    const optionalFields = ["flashcards", "quizQuestions", "stats"];

    // التحقق من الحقول المطلوبة
    for (const field of requiredFields) {
      if (!data.hasOwnProperty(field)) {
        throw new Error(`الحقل المطلوب '${field}' غير موجود`);
      }
    }

    // التحقق من صحة المؤقت
    if (typeof data.timer !== "number" || data.timer <= 0) {
      throw new Error("قيمة المؤقت يجب أن تكون رقماً موجباً");
    }

    // التحقق من البطاقات التعليمية
    if (data.flashcards && !Array.isArray(data.flashcards)) {
      throw new Error("البطاقات التعليمية يجب أن تكون مصفوفة");
    }

    // التحقق من أسئلة الاختبار
    if (data.quizQuestions && !Array.isArray(data.quizQuestions)) {
      throw new Error("أسئلة الاختبار يجب أن تكون مصفوفة");
    }

    return true;
  }

  static validateUsername(username) {
    const sanitized = this.sanitizeInput(username);
    if (!sanitized) {
      throw new Error("اسم المستخدم مطلوب");
    }
    if (sanitized.length < 2) {
      throw new Error("اسم المستخدم يجب أن يحتوي على حرفين على الأقل");
    }
    if (sanitized.length > 50) {
      throw new Error("اسم المستخدم طويل جداً");
    }
    return sanitized;
  }

  static validateFileName(filename) {
    const sanitized = this.sanitizeInput(filename);
    if (!sanitized) {
      throw new Error("اسم الملف مطلوب");
    }

    const allowedExtensions = [".json"];
    const hasValidExtension = allowedExtensions.some((ext) =>
      sanitized.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      throw new Error("نوع الملف غير مدعوم. الملفات المدعومة: JSON");
    }

    return sanitized;
  }
}

class LoadingManager {
  static show(message = "جارٍ التحميل...") {
    if (document.getElementById("loading-overlay")) {
      return; // Loading already shown
    }

    const loader = document.createElement("div");
    loader.id = "loading-overlay";
    loader.setAttribute("aria-label", message);
    loader.setAttribute("role", "status");
    loader.innerHTML = `
      <div class="loading-content">
        <div class="spinner" aria-hidden="true"></div>
        <p class="loading-message">${NotificationManager.sanitizeHTML(
          message
        )}</p>
      </div>
    `;
    document.body.appendChild(loader);

    // تأثير الظهور
    requestAnimationFrame(() => {
      loader.classList.add("loading-visible");
    });
  }

  static hide() {
    const loader = document.getElementById("loading-overlay");
    if (loader) {
      loader.classList.add("loading-hide");
      setTimeout(() => {
        if (loader.parentNode) {
          loader.parentNode.removeChild(loader);
        }
      }, 300);
    }
  }

  static updateMessage(message) {
    const loader = document.getElementById("loading-overlay");
    const messageElement = loader?.querySelector(".loading-message");
    if (messageElement) {
      messageElement.textContent = message;
      loader.setAttribute("aria-label", message);
    }
  }
}

// ===== حالة التطبيق المحسنة =====
let appState = {
  currentMode: null,
  isPaused: false,
  currentFileHandle: null,
  quizData: null,
  username: "",
  isInitialized: false,
  resourceManager: new ResourceManager(),
};

// ===== دوال التطبيق المحسنة =====

// تهيئة التطبيق
async function initApp() {
  try {
    LoadingManager.show("تهيئة التطبيق...");

    // التحقق من دعم المتصفح للميزات المطلوبة
    if (!checkBrowserSupport()) {
      throw new Error("متصفحك لا يدعم جميع الميزات المطلوبة");
    }

    // تهيئة جميع الأنظمة
    await initFileSystem();
    initShuffleSystem();

    // إعداد معالجي الأحداث
    setupEventListeners();

    // تحميل الإعدادات المحفوظة
    loadSavedSettings();

    // تفعيل إمكانية الوصول
    setupAccessibility();

    appState.isInitialized = true;
    LoadingManager.hide();
    NotificationManager.showSuccess("تم تهيئة التطبيق بنجاح");

    console.log("تم تهيئة التطبيق بنجاح");
  } catch (error) {
    LoadingManager.hide();
    ErrorHandler.handleError(error, "appInit");
    NotificationManager.showError(
      "فشل في تهيئة التطبيق. يرجى تحديث الصفحة والمحاولة مرة أخرى."
    );
  }
}

// التحقق من دعم المتصفح
function checkBrowserSupport() {
  const required = [
    "localStorage",
    "addEventListener",
    "querySelector",
    "fetch",
  ];

  return required.every((feature) => feature in window || feature in document);
}

// تحميل الإعدادات المحفوظة
function loadSavedSettings() {
  try {
    const savedUsername = localStorage.getItem("lastUsername");
    if (savedUsername) {
      document.getElementById("username").value = savedUsername;
    }

    const savedFileName = localStorage.getItem("lastFileName");
    if (savedFileName) {
      document.getElementById("json-file").value = savedFileName;
    }

    const darkMode = localStorage.getItem("darkMode") === "true";
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.getElementById("dark-mode-toggle").textContent = "☀️";
    }
  } catch (error) {
    console.warn("فشل في تحميل الإعدادات المحفوظة:", error);
  }
}

// إعداد إمكانية الوصول
function setupAccessibility() {
  // إضافة skip link للمحتوى الرئيسي
  const skipLink = document.createElement("a");
  skipLink.href = "#content-area";
  skipLink.className = "skip-link";
  skipLink.textContent = "تخطي إلى المحتوى الرئيسي";
  document.body.insertBefore(skipLink, document.body.firstChild);

  // تحسين قابلية الوصول للأزرار
  const buttons = document.querySelectorAll("button");
  buttons.forEach((button) => {
    if (!button.getAttribute("aria-label") && !button.textContent.trim()) {
      button.setAttribute("aria-label", "زر");
    }
  });
}

// إعداد معالجي الأحداث المحسن
function setupEventListeners() {
  const rm = appState.resourceManager;

  // الأزرار الرئيسية
  rm.addEventListener(
    document.getElementById("start-btn"),
    "click",
    handleStartClick
  );
  rm.addEventListener(
    document.getElementById("pause-btn"),
    "click",
    handlePauseClick
  );
  rm.addEventListener(
    document.getElementById("prev-btn"),
    "click",
    handlePrevClick
  );
  rm.addEventListener(
    document.getElementById("flashcards-tab"),
    "click",
    handleFlashcardsTabClick
  );
  rm.addEventListener(
    document.getElementById("quiz-tab"),
    "click",
    handleQuizTabClick
  );
  rm.addEventListener(
    document.getElementById("dark-mode-toggle"),
    "click",
    handleDarkModeToggle
  );
  rm.addEventListener(
    document.getElementById("flip-btn"),
    "click",
    handleFlipClick
  );
  rm.addEventListener(
    document.getElementById("next-btn"),
    "click",
    handleNextClick
  );
  rm.addEventListener(
    document.getElementById("restart-btn"),
    "click",
    handleRestartClick
  );
  rm.addEventListener(
    document.getElementById("compare-btn"),
    "click",
    handleCompareClick
  );

  // أحداث لوحة المفاتيح
  rm.addEventListener(document, "keydown", handleKeyDown);

  // أحداث النافذة
  rm.addEventListener(window, "beforeunload", handleBeforeUnload);
  rm.addEventListener(window, "unload", handleUnload);

  // أحداث الأخطاء العامة
  rm.addEventListener(window, "error", handleGlobalError);
  rm.addEventListener(window, "unhandledrejection", handleUnhandledRejection);
}

// معالجات الأحداث المحسنة
async function handleStartClick() {
  try {
    await startQuiz();
  } catch (error) {
    ErrorHandler.handleError(error, "startQuiz");
  }
}

function handlePauseClick() {
  try {
    togglePause();
  } catch (error) {
    ErrorHandler.handleError(error, "pause");
  }
}

function handlePrevClick() {
  try {
    navigatePrev();
  } catch (error) {
    ErrorHandler.handleError(error, "navigation");
  }
}

async function handleLoadFileClick() {
  try {
    await openFilePicker();
  } catch (error) {
    ErrorHandler.handleError(error, "fileLoad");
  }
}

async function handleFileInputKeypress(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const filename = document.getElementById("json-file").value.trim();
    if (filename) {
      try {
        await loadJsonFile(filename);
        // بعد تحميل الملف، تحديث العرض حسب التبويب النشط
        updateDisplayAfterFileLoad();
      } catch (error) {
        ErrorHandler.handleError(error, "fileLoad");
      }
    }
  }
}

function handleFlashcardsTabClick() {
  try {
    switchToFlashcards();
  } catch (error) {
    ErrorHandler.handleError(error, "modeSwitch");
  }
}

function handleQuizTabClick() {
  try {
    switchToQuiz();
  } catch (error) {
    ErrorHandler.handleError(error, "modeSwitch");
  }
}

function handleDarkModeToggle() {
  try {
    toggleDarkMode();
  } catch (error) {
    ErrorHandler.handleError(error, "darkMode");
  }
}

function handleFlipClick() {
  try {
    flipCurrentCard();
  } catch (error) {
    ErrorHandler.handleError(error, "flip");
  }
}

function handleNextClick() {
  try {
    navigateNext();
  } catch (error) {
    ErrorHandler.handleError(error, "navigation");
  }
}

function handleRestartClick() {
  try {
    restartQuiz();
  } catch (error) {
    ErrorHandler.handleError(error, "restart");
  }
}

function handleCompareClick() {
  try {
    showComparison();
  } catch (error) {
    ErrorHandler.handleError(error, "comparison");
  }
}

function handleKeyDown(event) {
  try {
    if (!appState.isInitialized) return;

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
      case "Escape":
        event.preventDefault();
        if (appState.currentMode === "quiz") {
          if (confirm("هل تريد إيقاف الاختبار؟")) {
            finishQuiz();
          }
        }
        break;
    }
  } catch (error) {
    ErrorHandler.handleError(error, "keydown", false);
  }
}

function handleBeforeUnload(event) {
  if (appState.currentMode === "quiz" && !appState.isPaused) {
    event.preventDefault();
    event.returnValue = "لديك اختبار قيد التشغيل. هل أنت متأكد من الخروج؟";
  }
}

function handleUnload() {
  cleanup();
}

function handleGlobalError(event) {
  ErrorHandler.handleError(event.error || event, "globalError");
}

function handleUnhandledRejection(event) {
  ErrorHandler.handleError(event.reason, "unhandledRejection");
  event.preventDefault(); // منع الخطأ من الظهور في console
}

// دالة التحميل المحسنة لملفات JSON
async function loadJsonFile(filename) {
  try {
    const validatedFilename = ValidationUtils.validateFileName(filename);
    LoadingManager.show("تحميل الملف...");

    const fileData = await openJsonFile(validatedFilename);
    if (!fileData) {
      throw new Error("فشل في تحميل الملف");
    }

    // التحقق من صحة البيانات
    ValidationUtils.validateJsonStructure(fileData.data);

    appState.quizData = fileData.data;
    appState.currentFileHandle = fileData.fileHandle;

    // حفظ اسم الملف للمرة القادمة
    try {
      localStorage.setItem("lastFileName", validatedFilename);
    } catch (e) {
      console.warn("فشل في حفظ اسم الملف:", e);
    }

    LoadingManager.hide();

    // تحديث العرض بناءً على التبويب النشط
    updateDisplayAfterFileLoad();

    return true;
  } catch (error) {
    LoadingManager.hide();
    throw error;
  }
}

// فتح مربع اختيار الملف
async function openFilePicker() {
  try {
    LoadingManager.show("اختيار الملف...");

    // محاولة استخدام File System Access API إن أمكن
    if ("showOpenFilePicker" in window) {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: "JSON files",
            accept: { "application/json": [".json"] },
          },
        ],
      });

      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);

      ValidationUtils.validateJsonStructure(data);

      appState.quizData = data;
      appState.currentFileHandle = fileHandle;

      document.getElementById("json-file").value = file.name;

      LoadingManager.hide();

      // تحديث العرض بعد تحميل الملف
      updateDisplayAfterFileLoad();
    } else {
      // Fallback للمتصفحات القديمة
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.onchange = async (event) => {
        try {
          const file = event.target.files[0];
          if (!file) {
            LoadingManager.hide();
            return;
          }

          const text = await file.text();
          const data = JSON.parse(text);

          ValidationUtils.validateJsonStructure(data);

          appState.quizData = data;
          document.getElementById("json-file").value = file.name;

          LoadingManager.hide();

          // تحديث العرض بعد تحميل الملف
          updateDisplayAfterFileLoad();
        } catch (error) {
          LoadingManager.hide();
          ErrorHandler.handleError(error, "filePicker");
        }
      };

      input.click();
      LoadingManager.hide(); // إخفاء loading فوراً للـ fallback
      return;
    }
  } catch (error) {
    LoadingManager.hide();
    if (error.name === "AbortError") {
      // المستخدم ألغى العملية
      return;
    }
    throw error;
  }
}

// دوال التبديل بين الأوضاع المحسنة
function switchToFlashcards() {
  if (!appState.quizData) {
    NotificationManager.showWarning("يرجى تحميل ملف الاختبار أولاً");
    return;
  }

  if (
    !appState.quizData.flashcards ||
    appState.quizData.flashcards.length === 0
  ) {
    NotificationManager.showWarning("لا توجد بطاقات تعليمية في هذا الملف");
    return;
  }

  appState.currentMode = "flashcard";
  updateUITabs("flashcard");
  initializeQuiz(appState.quizData, appState.username);
  updateUI(getCurrentQuestion(), getQuizStatus());

  // إعلان للقارئ الشاشي
  announceToScreenReader("تم التبديل إلى وضع البطاقات التعليمية");
}

function switchToQuiz() {
  if (!appState.quizData) {
    NotificationManager.showWarning("يرجى تحميل ملف الاختبار أولاً");
    return;
  }

  if (
    !appState.quizData.quizQuestions ||
    appState.quizData.quizQuestions.length === 0
  ) {
    NotificationManager.showWarning("لا توجد أسئلة اختبار في هذا الملف");
    return;
  }

  if (appState.currentMode === "quiz") {
    NotificationManager.showWarning("أنت في وضع الاختبار بالفعل");
    return;
  }

  const confirmed = confirm(
    "هل تريد بدء الاختبار؟ سيتم بدء المؤقت ولن يمكنك العودة للبطاقات أثناء الاختبار."
  );

  if (confirmed) {
    appState.currentMode = "quiz";
    updateUITabs("quiz");
    initializeQuiz(appState.quizData, appState.username);
    updateUI(getCurrentQuestion(), getQuizStatus());

    try {
      startTimer();
      announceToScreenReader("تم البدء في وضع الاختبار");
    } catch (error) {
      ErrorHandler.handleError(error, "timer");
    }
  }
}

// دالة تنظيف HTML لمنع XSS
function sanitizeHTML(str) {
  if (typeof str !== "string") return "";

  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// دالة عرض معاينة البطاقات بدون تهيئة كاملة
function displayFlashcardPreview() {
  if (!appState.quizData || !appState.quizData.flashcards) return;

  const contentArea = document.getElementById("content-area");
  const firstCard = appState.quizData.flashcards[0];

  if (firstCard) {
    contentArea.innerHTML = `
      <div class="flashcard-preview">
        <div class="flashcard">
          <div class="flashcard-inner">
            <div class="flashcard-front">
              <h3>${sanitizeHTML(firstCard.question)}</h3>
              <p class="flashcard-hint">أدخل اسم المستخدم واضغط "ابدأ الاختبار" للمتابعة</p>
            </div>
          </div>
        </div>
        <div class="preview-info">
          <p>عدد البطاقات: ${appState.quizData.flashcards.length}</p>
          <p>عدد الأسئلة: ${appState.quizData.quizQuestions?.length || 0}</p>
        </div>
      </div>
    `;
  }
}

// دالة فرض بدء وضع الاختبار مباشرة
function forceStartQuizMode() {
  // هذه الدالة تجبر النظام على بدء الاختبار مباشرة دون المرور بالبطاقات
  // يتم استدعاؤها من quizEngine.js
  if (window.forceQuizMode) {
    window.forceQuizMode();
  }
}

// تحديث حالة أزرار التنقل بناءً على الوضع الحالي
function updateNavigationButtonsState() {
  const prevBtn = document.getElementById("prev-btn");
  const flipBtn = document.getElementById("flip-btn");
  const nextBtn = document.getElementById("next-btn");

  if (!prevBtn || !flipBtn || !nextBtn) return;

  if (appState.currentMode === "flashcard") {
    prevBtn.disabled = !appState.username;
    flipBtn.disabled = !appState.username;
    nextBtn.disabled = !appState.username;

    if (appState.username) {
      prevBtn.textContent = "⬅️ السابق";
      nextBtn.textContent = "التالي ➡️";
    }
  } else if (appState.currentMode === "quiz") {
    prevBtn.disabled = false;
    flipBtn.disabled = true; // القلب غير متاح في وضع الاختبار
    nextBtn.disabled = false;

    prevBtn.textContent = "⬅️ السابق";
    nextBtn.textContent = "التالي ➡️";
  } else {
    // لا يوجد وضع محدد
    prevBtn.disabled = true;
    flipBtn.disabled = true;
    nextBtn.disabled = true;
  }
}
function updateUITabs(activeTab) {
  try {
    const flashcardsTab = document.getElementById("flashcards-tab");
    const quizTab = document.getElementById("quiz-tab");

    flashcardsTab.classList.toggle("active", activeTab === "flashcard");
    quizTab.classList.toggle("active", activeTab === "quiz");

    // تحديث ARIA attributes
    flashcardsTab.setAttribute("aria-selected", activeTab === "flashcard");
    quizTab.setAttribute("aria-selected", activeTab === "quiz");

    // تحديث tabindex
    flashcardsTab.tabIndex = activeTab === "flashcard" ? 0 : -1;
    quizTab.tabIndex = activeTab === "quiz" ? 0 : -1;
  } catch (error) {
    ErrorHandler.handleError(error, "updateTabs", false);
  }
}

// دالة تبديل الوضع الداكن المحسنة
function toggleDarkMode() {
  try {
    const body = document.body;
    const toggle = document.getElementById("dark-mode-toggle");

    body.classList.toggle("dark-mode");
    const isDarkMode = body.classList.contains("dark-mode");

    // تحديث النص والـ aria-label
    toggle.textContent = isDarkMode ? "☀️" : "🌙";
    toggle.setAttribute(
      "aria-label",
      isDarkMode ? "تبديل إلى الوضع الفاتح" : "تبديل إلى الوضع الداكن"
    );

    // حفظ التفضيل
    try {
      localStorage.setItem("darkMode", isDarkMode);
    } catch (e) {
      console.warn("فشل في حفظ تفضيل الوضع الداكن:", e);
    }

    announceToScreenReader(
      `تم التبديل إلى ${isDarkMode ? "الوضع الداكن" : "الوضع الفاتح"}`
    );
  } catch (error) {
    ErrorHandler.handleError(error, "darkMode", false);
  }
}

// بدء الاختبار المحسن
async function startQuiz() {
  try {
    // التحقق من صحة البيانات المدخلة
    const usernameInput = document.getElementById("username").value.trim();
    const jsonFileInput = document.getElementById("json-file").value.trim();

    if (!usernameInput) {
      NotificationManager.showWarning("يرجى إدخال اسم المستخدم");
      document.getElementById("username").focus();
      return;
    }

    if (!jsonFileInput && !appState.quizData) {
      NotificationManager.showWarning("يرجى تحديد ملف الاختبار");
      document.getElementById("json-file").focus();
      return;
    }

    LoadingManager.show("إعداد الاختبار...");

    // تنظيف وتصحيح اسم المستخدم
    const validatedUsername = ValidationUtils.validateUsername(usernameInput);
    appState.username = validatedUsername;

    // حفظ اسم المستخدم للمرة القادمة
    try {
      localStorage.setItem("lastUsername", validatedUsername);
    } catch (e) {
      console.warn("فشل في حفظ اسم المستخدم:", e);
    }

    // تحميل ملف JSON إذا لم يكن محملاً
    if (!appState.quizData && jsonFileInput) {
      await loadJsonFile(jsonFileInput);
    }

    if (!appState.quizData) {
      throw new Error("لا توجد بيانات للاختبار");
    }

    // خلط البيانات إذا لزم الأمر
    LoadingManager.updateMessage("خلط الأسئلة...");
    appState.quizData = shuffleQuizData(appState.quizData);

    // تهيئة الاختبار
    LoadingManager.updateMessage("تهيئة الاختبار...");
    initializeQuiz(appState.quizData, validatedUsername);

    // تحديث واجهة المستخدم
    updateUI(getCurrentQuestion(), getQuizStatus());

    // بدء المؤقت
    try {
      initTimer(appState.quizData.timer, handleTimeUp);
      setTickCallback(handleTimerTick);
      startTimer();
    } catch (timerError) {
      ErrorHandler.handleError(timerError, "timer");
      NotificationManager.showWarning("مشكلة في المؤقت، سيتم المتابعة بدونه");
    }

    // تحديث حالة التطبيق
    appState.currentMode = "quiz";
    appState.isPaused = false;

    // تفعيل/تعطيل الأزرار
    updateButtonStates(true);

    LoadingManager.hide();
    NotificationManager.showSuccess("تم بدء الاختبار بنجاح!");
    announceToScreenReader("تم بدء الاختبار");
  } catch (error) {
    LoadingManager.hide();
    throw error;
  }
}

// تحديث حالة الأزرار
function updateButtonStates(quizStarted) {
  try {
    const buttons = {
      pause: document.getElementById("pause-btn"),
      prev: document.getElementById("prev-btn"),
      flip: document.getElementById("flip-btn"),
      next: document.getElementById("next-btn"),
      start: document.getElementById("start-btn"),
    };

    if (quizStarted) {
      buttons.pause.disabled = false;
      buttons.prev.disabled = false;
      buttons.flip.disabled = false;
      buttons.next.disabled = false;
      buttons.start.disabled = true;
    } else {
      buttons.pause.disabled = true;
      buttons.prev.disabled = true;
      buttons.flip.disabled = true;
      buttons.next.disabled = true;
      buttons.start.disabled = false;
    }

    // تحديث aria-disabled
    Object.values(buttons).forEach((button) => {
      if (button) {
        button.setAttribute("aria-disabled", button.disabled);
      }
    });
  } catch (error) {
    ErrorHandler.handleError(error, "updateButtons", false);
  }
}

// التعامل مع انتهاء الوقت
function handleTimeUp() {
  try {
    if (appState.currentMode === "quiz") {
      NotificationManager.showWarning("انتهى وقت السؤال");
      announceToScreenReader("انتهى وقت السؤال، الانتقال إلى السؤال التالي");
      navigateNext();
    }
  } catch (error) {
    ErrorHandler.handleError(error, "timeUp", false);
  }
}

// التعامل مع تحديث المؤقت
function handleTimerTick(remainingTime) {
  try {
    updateTimerDisplay(remainingTime, appState.quizData.timer);

    // تحذير عند اقتراب انتهاء الوقت
    if (remainingTime === 10) {
      announceToScreenReader("عشر ثوانٍ متبقية");
    } else if (remainingTime === 5) {
      announceToScreenReader("خمس ثوانٍ متبقية");
    }
  } catch (error) {
    ErrorHandler.handleError(error, "timerTick", false);
  }
}

// التبديل بين الإيقاف المؤقت والاستئناف المحسن
function togglePause() {
  try {
    if (!appState.currentMode) {
      NotificationManager.showWarning("لم يتم بدء الاختبار بعد");
      return;
    }

    const pauseBtn = document.getElementById("pause-btn");

    if (appState.isPaused) {
      resumeQuiz();
      resumeTimer();
      appState.isPaused = false;
      pauseBtn.textContent = "إيقاف مؤقت";
      pauseBtn.setAttribute("aria-label", "إيقاف الاختبار مؤقتاً");
      announceToScreenReader("تم استئناف الاختبار");
    } else {
      pauseQuiz();
      pauseTimer();
      appState.isPaused = true;
      pauseBtn.textContent = "استئناف";
      pauseBtn.setAttribute("aria-label", "استئناف الاختبار");
      announceToScreenReader("تم إيقاف الاختبار مؤقتاً");
    }
  } catch (error) {
    ErrorHandler.handleError(error, "togglePause");
  }
}

// التنقل إلى السؤال السابق المحسن
function navigatePrev() {
  try {
    if (!appState.currentMode) {
      NotificationManager.showWarning("لم يتم بدء الاختبار بعد");
      return;
    }

    const success = prevQuestion();
    if (success) {
      updateUI(getCurrentQuestion(), getQuizStatus());

      if (appState.currentMode === "quiz") {
        resetTimer(appState.quizData.timer);
        startTimer();
      }

      announceToScreenReader("الانتقال إلى السؤال السابق");
    } else {
      announceToScreenReader("أنت في بداية الاختبار");
    }
  } catch (error) {
    ErrorHandler.handleError(error, "navigatePrev");
  }
}

// قلب البطاقة الحالية المحسن
function flipCurrentCard() {
  try {
    if (appState.currentMode !== "flashcard") {
      NotificationManager.showWarning(
        "قلب البطاقة متاح فقط في وضع البطاقات التعليمية"
      );
      return;
    }

    flipFlashcard();
    updateUI(getCurrentQuestion(), getQuizStatus());
    announceToScreenReader("تم قلب البطاقة");
  } catch (error) {
    ErrorHandler.handleError(error, "flipCard");
  }
}

// التنقل إلى السؤال التالي المحسن
function navigateNext() {
  try {
    if (!appState.currentMode) {
      NotificationManager.showWarning("لم يتم بدء الاختبار بعد");
      return;
    }

    const hasNext = nextQuestion();

    if (hasNext) {
      updateUI(getCurrentQuestion(), getQuizStatus());

      if (appState.currentMode === "quiz") {
        resetTimer(appState.quizData.timer);
        startTimer();
      }

      announceToScreenReader("الانتقال إلى السؤال التالي");
    } else {
      announceToScreenReader("انتهاء الاختبار");
      finishQuiz();
    }
  } catch (error) {
    ErrorHandler.handleError(error, "navigateNext");
  }
}

// إنهاء الاختبار وعرض النتائج المحسن
async function finishQuiz() {
  try {
    LoadingManager.show("حساب النتائج...");

    // إيقاف المؤقت
    stopTimer();

    // الحصول على النتائج
    const results = getResults();

    // عرض النتائج
    showResults(results);

    // حفظ الإحصائيات إذا أمكن
    if (appState.currentFileHandle && results) {
      try {
        LoadingManager.updateMessage("حفظ النتائج...");
        const updatedData = addSessionResult(appState.quizData, results);
        await saveJsonFile(appState.currentFileHandle, updatedData);
        appState.quizData = updatedData;
        NotificationManager.showSuccess("تم حفظ النتائج بنجاح");
      } catch (saveError) {
        console.warn("فشل في حفظ النتائج:", saveError);
        NotificationManager.showWarning("تم حساب النتائج ولكن فشل حفظها");
      }
    }

    // إظهار زر المقارنة إذا كانت هناك إحصائيات سابقة
    const userStats =
      appState.quizData.stats?.filter(
        (stat) => stat.username === appState.username
      ) || [];

    if (userStats.length > 1) {
      document.getElementById("comparison-section").classList.remove("hidden");
    }

    // تحديث حالة الأزرار
    updateButtonStates(false);

    LoadingManager.hide();
    announceToScreenReader(
      `انتهى الاختبار. النتيجة: ${results.correct} من ${results.totalQuestions} صحيحة`
    );
  } catch (error) {
    LoadingManager.hide();
    ErrorHandler.handleError(error, "finishQuiz");
  }
}

// إعادة بدء الاختبار المحسن
async function restartQuiz() {
  try {
    const confirmed = confirm(
      "هل تريد إعادة بدء الاختبار؟ سيتم فقدان النتائج الحالية."
    );

    if (!confirmed) return;

    LoadingManager.show("إعادة تشغيل الاختبار...");

    // إخفاء النتائج
    document.getElementById("results").classList.add("hidden");
    document.getElementById("leaderboard").classList.add("hidden");
    document.getElementById("comparison-section").classList.add("hidden");

    // إعادة تعيين الأنظمة
    stopTimer();

    // إعادة خلط البيانات
    if (appState.quizData) {
      appState.quizData = shuffleQuizData(appState.quizData);
    }

    // بدء الاختبار مرة أخرى
    await startQuiz();

    LoadingManager.hide();
  } catch (error) {
    LoadingManager.hide();
    ErrorHandler.handleError(error, "restartQuiz");
  }
}

// عرض المقارنة المحسن
function showComparison() {
  try {
    if (!appState.quizData || !appState.quizData.stats) {
      NotificationManager.showWarning("لا توجد إحصائيات للمقارنة");
      return;
    }

    const leaderboard = getLeaderboard(appState.quizData);
    showLeaderboard(leaderboard);
    announceToScreenReader("تم عرض لوحة الصدارة");
  } catch (error) {
    ErrorHandler.handleError(error, "showComparison");
  }
}

// التعامل مع الإجابة على السؤال المحسن
window.handleAnswer = function (selectedAnswer) {
  try {
    if (!selectedAnswer || typeof selectedAnswer !== "string") {
      console.warn("إجابة غير صحيحة:", selectedAnswer);
      return;
    }

    const isCorrect = answerQuestion(selectedAnswer);

    // تقديم تغذية راجعة
    if (isCorrect) {
      playSound("correct");
      flashScreen("correct");
      announceToScreenReader("إجابة صحيحة");
    } else {
      playSound("wrong");
      flashScreen("wrong");
      announceToScreenReader("إجابة خاطئة");
    }

    // تمييز الإجابة
    highlightAnswer(selectedAnswer, isCorrect);

    // الانتقال التلقائي بعد تأخير
    const delay = isCorrect ? 1500 : 2000; // وقت أطول للإجابات الخاطئة
    appState.resourceManager.setTimeout(() => {
      try {
        navigateNext();
      } catch (error) {
        ErrorHandler.handleError(error, "autoNavigate", false);
      }
    }, delay);
  } catch (error) {
    ErrorHandler.handleError(error, "handleAnswer");
  }
};

// دالة الإعلان لقارئ الشاشة
function announceToScreenReader(message) {
  try {
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = message;

    document.body.appendChild(announcement);

    appState.resourceManager.setTimeout(() => {
      if (announcement.parentNode) {
        announcement.parentNode.removeChild(announcement);
      }
    }, 1000);
  } catch (error) {
    console.warn("فشل في الإعلان لقارئ الشاشة:", error);
  }
}

// تنظيف الموارد
function cleanup() {
  try {
    if (appState.resourceManager) {
      appState.resourceManager.cleanup();
    }

    destroyUI();
    stopTimer();

    // تنظيف حالة التطبيق
    appState.currentMode = null;
    appState.isPaused = false;
    appState.isInitialized = false;
  } catch (error) {
    console.error("خطأ أثناء التنظيف:", error);
  }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
  initApp().catch((error) => {
    console.error("فشل في تهيئة التطبيق:", error);
    NotificationManager.showError(
      "فشل في تهيئة التطبيق. يرجى إعادة تحميل الصفحة."
    );
  });
});

// تنظيف الموارد عند إغلاق الصفحة
window.addEventListener("beforeunload", cleanup);
window.addEventListener("unload", cleanup);

// إظهار زر التخطي عند التمرير لأعلى
let lastScrollTop = 0;
let skipLink = document.querySelector(".skip-link");

if (skipLink) {
  window.addEventListener(
    "scroll",
    function () {
      let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      if (scrollTop > lastScrollTop) {
        // التمرير لأسفل - إخفاء الزر
        skipLink.classList.remove("visible");
      } else {
        // التمرير لأعلى - إظهار الزر
        if (scrollTop > 100) {
          // فقط إن كان التمرير لمسافة كافية
          skipLink.classList.add("visible");

          // إخفاء تلقائي بعد 3 ثوان
          clearTimeout(window.skipLinkTimeout);
          window.skipLinkTimeout = setTimeout(() => {
            skipLink.classList.remove("visible");
          }, 3000);
        }
      }
      lastScrollTop = scrollTop;
    },
    false
  );

  // إخفاء الزر عند النقر خارجيه
  document.addEventListener("click", function (e) {
    if (
      !skipLink.contains(e.target) &&
      !e.target.classList.contains("skip-link")
    ) {
      skipLink.classList.remove("visible");
    }
  });

  // إبقاء الزر مرئيًا عند التركيز عليه باللوحة
  skipLink.addEventListener("blur", function () {
    if (skipLink.classList.contains("visible")) {
      // البقاء مرئيًا حتى بعد فقدان التركيز إذا كان مرئيًا بالفعل
      setTimeout(() => {
        if (document.activeElement !== skipLink) {
          skipLink.classList.remove("visible");
        }
      }, 100);
    }
  });
}

// تصدير الدوال المهمة للاستخدام الخارجي
window.app = {
  navigateNext,
  navigatePrev,
  flipCurrentCard,
  togglePause,
  handleAnswer: window.handleAnswer,
};
