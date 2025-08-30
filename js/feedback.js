// ===== نظام التغذية الراجعة الصوتية والبصرية المحسن =====

// فئات الأخطاء المخصصة
class FeedbackError extends Error {
  constructor(message, code = "FEEDBACK_ERROR") {
    super(message);
    this.name = "FeedbackError";
    this.code = code;
  }
}

class AudioNotSupportedError extends FeedbackError {
  constructor(message = "الصوتيات غير مدعومة في هذا المتصفح") {
    super(message, "AUDIO_NOT_SUPPORTED");
    this.name = "AudioNotSupportedError";
  }
}

// نظام إدارة الموارد الصوتية
class AudioResourceManager {
  constructor() {
    this.audioCache = new Map();
    this.loadingPromises = new Map();
    this.maxCacheSize = 10;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  async loadAudio(id, src, options = {}) {
    try {
      // التحقق من وجود الصوت في الذاكرة التخزين المؤقت
      if (this.audioCache.has(id)) {
        return this.audioCache.get(id);
      }

      // التحقق من وجود عملية تحميل جارية
      if (this.loadingPromises.has(id)) {
        return await this.loadingPromises.get(id);
      }

      // إنشاء promise للتحميل
      const loadingPromise = this.createAudioWithRetry(src, options);
      this.loadingPromises.set(id, loadingPromise);

      try {
        const audio = await loadingPromise;

        // إدارة حجم الذاكرة التخزين المؤقت
        if (this.audioCache.size >= this.maxCacheSize) {
          this.evictOldestAudio();
        }

        this.audioCache.set(id, audio);
        this.loadingPromises.delete(id);

        return audio;
      } catch (error) {
        this.loadingPromises.delete(id);
        throw error;
      }
    } catch (error) {
      console.error(`فشل في تحميل الصوت ${id}:`, error);
      throw new FeedbackError(`فشل في تحميل الصوت: ${error.message}`);
    }
  }

  async createAudioWithRetry(src, options, attempt = 1) {
    try {
      const audio = new Audio();

      // تطبيق الخيارات
      audio.volume = options.volume !== undefined ? options.volume : 0.7;
      audio.loop = options.loop || false;
      audio.preload = options.preload || "auto";

      // وعد التحميل
      const loadPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("انتهت مهلة تحميل الصوت"));
        }, 10000);

        audio.addEventListener(
          "canplaythrough",
          () => {
            clearTimeout(timeout);
            resolve(audio);
          },
          { once: true }
        );

        audio.addEventListener(
          "error",
          (e) => {
            clearTimeout(timeout);
            reject(
              new Error(`فشل في تحميل الصوت: ${e.message || "خطأ غير معروف"}`)
            );
          },
          { once: true }
        );
      });

      audio.src = src;
      audio.load();

      return await loadPromise;
    } catch (error) {
      if (attempt < this.retryAttempts) {
        console.warn(
          `محاولة إعادة تحميل الصوت ${src} (المحاولة ${attempt + 1})`
        );
        await this.delay(this.retryDelay * attempt);
        return this.createAudioWithRetry(src, options, attempt + 1);
      }
      throw error;
    }
  }

  evictOldestAudio() {
    const firstKey = this.audioCache.keys().next().value;
    if (firstKey) {
      const audio = this.audioCache.get(firstKey);
      if (audio) {
        audio.src = "";
        audio.load();
      }
      this.audioCache.delete(firstKey);
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getAudio(id) {
    return this.audioCache.get(id);
  }

  hasAudio(id) {
    return this.audioCache.has(id);
  }

  removeAudio(id) {
    const audio = this.audioCache.get(id);
    if (audio) {
      audio.src = "";
      audio.load();
      this.audioCache.delete(id);
    }
  }

  clear() {
    for (const [id, audio] of this.audioCache) {
      audio.src = "";
      audio.load();
    }
    this.audioCache.clear();
    this.loadingPromises.clear();
  }

  getStats() {
    return {
      cachedAudios: this.audioCache.size,
      loadingAudios: this.loadingPromises.size,
      maxCacheSize: this.maxCacheSize,
    };
  }
}

// نظام إدارة التأثيرات البصرية
class VisualEffectsManager {
  constructor() {
    this.activeEffects = new Map();
    this.effectQueue = [];
    this.maxConcurrentEffects = 3;
    this.injectEffectStyles();
  }

  injectEffectStyles() {
    if (document.getElementById("effect-styles")) return;

    const style = document.createElement("style");
    style.id = "effect-styles";
    style.textContent = `
      @keyframes effectPulse {
        0% { 
          transform: scale(0.5); 
          opacity: 0; 
        }
        50% { 
          transform: scale(1.2); 
          opacity: 1; 
        }
        100% { 
          transform: scale(1); 
          opacity: 1; 
        }
      }
      
      @keyframes effectRipple {
        0% { 
          transform: scale(0); 
          opacity: 1; 
        }
        100% { 
          transform: scale(4); 
          opacity: 0; 
        }
      }
      
      .effect-ripple {
        position: absolute;
        border-radius: 50%;
        animation: effectRipple 0.8s ease-out;
      }
    `;

    document.head.appendChild(style);
  }

  async playEffect(type, options = {}) {
    try {
      const effectId = this.generateEffectId();

      // إذا كان هناك تأثيرات كثيرة، انتظر
      if (this.activeEffects.size >= this.maxConcurrentEffects) {
        await this.waitForSlot();
      }

      const effect = await this.createEffect(type, options);
      this.activeEffects.set(effectId, effect);

      // تشغيل التأثير
      await this.executeEffect(effect);

      // تنظيف التأثير
      this.activeEffects.delete(effectId);

      return effectId;
    } catch (error) {
      console.error("خطأ في تشغيل التأثير البصري:", error);
      throw new FeedbackError(`فشل في تشغيل التأثير البصري: ${error.message}`);
    }
  }

  async createEffect(type, options) {
    const elementId = options.elementId || `effect-${this.generateEffectId()}`;
    const duration = options.duration || 500;
    const intensity = Math.max(0, Math.min(1, options.intensity || 0.3));

    let element = document.getElementById(elementId);

    if (!element) {
      element = this.createElement(elementId, type, intensity, options);
    }

    return {
      element,
      type,
      duration,
      intensity,
      cleanup: () => this.cleanupEffect(element),
    };
  }

  createElement(elementId, type, intensity, options) {
    const element = document.createElement("div");
    element.id = elementId;
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");

    // الأنماط الأساسية
    Object.assign(element.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "10000",
      opacity: "0",
      transition: "opacity 0.3s ease-in-out",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });

    // تحديد اللون والتأثير بناءً على النوع
    const effectStyles = this.getEffectStyles(type, intensity);
    Object.assign(element.style, effectStyles);

    // إضافة محتوى التأثير إذا لزم الأمر
    if (options.showIcon !== false) {
      const icon = this.createEffectIcon(type);
      if (icon) {
        element.appendChild(icon);
      }
    }

    // إضافة نص وصفي للقارئ الشاشي
    element.setAttribute("aria-label", this.getEffectDescription(type));

    document.body.appendChild(element);
    return element;
  }

  createEffectIcon(type) {
    const icons = {
      correct: "✅",
      wrong: "❌",
      warning: "⚠️",
      info: "ℹ️",
      success: "🎉",
    };

    const iconText = icons[type];
    if (!iconText) return null;

    const iconElement = document.createElement("div");
    iconElement.className = "effect-icon";
    iconElement.textContent = iconText;

    Object.assign(iconElement.style, {
      fontSize: "4rem",
      animation: "effectPulse 0.6s ease-in-out",
      textShadow: "0 0 20px rgba(255, 255, 255, 0.8)",
      filter: "drop-shadow(0 0 10px rgba(0, 0, 0, 0.3))",
    });

    return iconElement;
  }

  getEffectStyles(type, intensity) {
    const styles = {
      correct: {
        background: `radial-gradient(circle, rgba(46, 204, 113, ${intensity}) 0%, rgba(46, 204, 113, ${
          intensity * 0.3
        }) 70%, transparent 100%)`,
        color: "#2ecc71",
      },
      wrong: {
        background: `radial-gradient(circle, rgba(231, 76, 60, ${intensity}) 0%, rgba(231, 76, 60, ${
          intensity * 0.3
        }) 70%, transparent 100%)`,
        color: "#e74c3c",
      },
      warning: {
        background: `radial-gradient(circle, rgba(243, 156, 18, ${intensity}) 0%, rgba(243, 156, 18, ${
          intensity * 0.3
        }) 70%, transparent 100%)`,
        color: "#f39c12",
      },
      info: {
        background: `radial-gradient(circle, rgba(52, 152, 219, ${intensity}) 0%, rgba(52, 152, 219, ${
          intensity * 0.3
        }) 70%, transparent 100%)`,
        color: "#3498db",
      },
      success: {
        background: `radial-gradient(circle, rgba(39, 174, 96, ${intensity}) 0%, rgba(39, 174, 96, ${
          intensity * 0.3
        }) 70%, transparent 100%)`,
        color: "#27ae60",
      },
    };

    return styles[type] || styles.info;
  }

  getEffectDescription(type) {
    const descriptions = {
      correct: "إجابة صحيحة",
      wrong: "إجابة خاطئة",
      warning: "تحذير",
      info: "معلومات",
      success: "نجح",
    };

    return descriptions[type] || "تأثير بصري";
  }

  async executeEffect(effect) {
    return new Promise((resolve) => {
      // إظهار التأثير
      requestAnimationFrame(() => {
        effect.element.style.opacity = "1";

        // إخفاء التأثير بعد المدة المحددة
        setTimeout(() => {
          effect.element.style.opacity = "0";

          // إزالة العنصر بعد انتهاء الانتقال
          setTimeout(() => {
            effect.cleanup();
            resolve();
          }, 300);
        }, effect.duration);
      });
    });
  }

  cleanupEffect(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  generateEffectId() {
    return `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async waitForSlot() {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.activeEffects.size < this.maxConcurrentEffects) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  getStats() {
    return {
      activeEffects: this.activeEffects.size,
      maxConcurrentEffects: this.maxConcurrentEffects,
      queuedEffects: this.effectQueue.length,
    };
  }

  clear() {
    // إنهاء جميع التأثيرات النشطة
    for (const [id, effect] of this.activeEffects) {
      effect.cleanup();
    }
    this.activeEffects.clear();
    this.effectQueue = [];
  }
}

// نظام إدارة التفضيلات
class PreferencesManager {
  constructor() {
    this.preferences = {
      audioEnabled: true,
      visualEffectsEnabled: true,
      volume: 0.7,
      reducedMotion: false,
      highContrast: false,
      autoplay: true,
    };

    this.loadPreferences();
    this.detectSystemPreferences();
  }

  loadPreferences() {
    try {
      const stored = localStorage.getItem("feedbackPreferences");
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.assign(this.preferences, parsed);
      }
    } catch (error) {
      console.warn("فشل في تحميل التفضيلات:", error);
    }
  }

  savePreferences() {
    try {
      localStorage.setItem(
        "feedbackPreferences",
        JSON.stringify(this.preferences)
      );
      return true;
    } catch (error) {
      console.warn("فشل في حفظ التفضيلات:", error);
      return false;
    }
  }

  detectSystemPreferences() {
    // اكتشاف تفضيل الحركة المخفضة
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      this.preferences.reducedMotion = true;
    }

    // اكتشاف تفضيل التباين العالي
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-contrast: high)").matches
    ) {
      this.preferences.highContrast = true;
    }

    // مراقبة التغييرات
    if (window.matchMedia) {
      window
        .matchMedia("(prefers-reduced-motion: reduce)")
        .addEventListener("change", (e) => {
          this.preferences.reducedMotion = e.matches;
          this.savePreferences();
        });

      window
        .matchMedia("(prefers-contrast: high)")
        .addEventListener("change", (e) => {
          this.preferences.highContrast = e.matches;
          this.savePreferences();
        });
    }
  }

  get(key) {
    return this.preferences[key];
  }

  set(key, value) {
    if (this.preferences.hasOwnProperty(key)) {
      this.preferences[key] = value;
      this.savePreferences();
      return true;
    }
    return false;
  }

  getAll() {
    return { ...this.preferences };
  }

  reset() {
    this.preferences = {
      audioEnabled: true,
      visualEffectsEnabled: true,
      volume: 0.7,
      reducedMotion: false,
      highContrast: false,
      autoplay: true,
    };
    this.savePreferences();
  }
}

// حالة النظام الرئيسي
const feedbackState = {
  isInitialized: false,
  audioResourceManager: new AudioResourceManager(),
  visualEffectsManager: new VisualEffectsManager(),
  preferencesManager: new PreferencesManager(),
  supportedFormats: [],
  isPlaying: false,
  currentSounds: new Set(),
  performanceMetrics: {
    audioLoadTime: [],
    effectRenderTime: [],
    totalInteractions: 0,
    successfulSounds: 0,
    failedSounds: 0,
  },
};

// ===== وظائف التهيئة =====

/**
 * تهيئة نظام التغذية الراجعة
 */
export async function initFeedbackSystem(options = {}) {
  try {
    console.log("بدء تهيئة نظام التغذية الراجعة...");

    // التحقق من دعم المتصفح
    const browserSupport = checkBrowserSupport();
    if (!browserSupport.audio && !browserSupport.visualEffects) {
      throw new FeedbackError("المتصفح لا يدعم أي من ميزات التغذية الراجعة");
    }

    // تحديد الصيغ المدعومة
    feedbackState.supportedFormats = detectSupportedAudioFormats();

    if (browserSupport.audio && feedbackState.supportedFormats.length === 0) {
      console.warn("لا توجد صيغ صوتية مدعومة");
      feedbackState.preferencesManager.set("audioEnabled", false);
    }

    // تحميل الأصوات الأساسية مسبقاً
    if (feedbackState.preferencesManager.get("audioEnabled")) {
      await preloadBasicSounds(options.sounds);
    }

    // إعداد مستمعي الأحداث
    setupEventListeners();

    // تهيئة مراقبة الأداء
    if (options.enablePerformanceMonitoring !== false) {
      setupPerformanceMonitoring();
    }

    feedbackState.isInitialized = true;
    console.log("تم تهيئة نظام التغذية الراجعة بنجاح");

    return {
      success: true,
      browserSupport,
      supportedFormats: feedbackState.supportedFormats,
      preferences: feedbackState.preferencesManager.getAll(),
    };
  } catch (error) {
    console.error("فشل في تهيئة نظام التغذية الراجعة:", error);
    throw error;
  }
}

/**
 * التحقق من دعم المتصفح
 */
function checkBrowserSupport() {
  const support = {
    audio: false,
    visualEffects: true, // معظم المتصفحات تدعم CSS/DOM
    webAudio: false,
    mediaSession: false,
  };

  // فحص دعم الصوت
  try {
    const audio = document.createElement("audio");
    support.audio = !!(
      audio.canPlayType &&
      (audio.canPlayType("audio/mpeg") !== "" ||
        audio.canPlayType("audio/wav") !== "")
    );
  } catch (e) {
    support.audio = false;
  }

  // فحص دعم Web Audio API
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    support.webAudio = !!AudioContext;
  } catch (e) {
    support.webAudio = false;
  }

  // فحص دعم Media Session API
  support.mediaSession = "mediaSession" in navigator;

  return support;
}

/**
 * اكتشاف الصيغ الصوتية المدعومة
 */
function detectSupportedAudioFormats() {
  const formats = [];
  const audio = document.createElement("audio");

  if (!audio.canPlayType) {
    return formats;
  }

  const testFormats = [
    { type: "audio/mpeg", ext: "mp3" },
    { type: "audio/wav", ext: "wav" },
    { type: "audio/ogg", ext: "ogg" },
    { type: "audio/mp4", ext: "m4a" },
    { type: "audio/webm", ext: "webm" },
  ];

  testFormats.forEach((format) => {
    const support = audio.canPlayType(format.type);
    if (support === "probably" || support === "maybe") {
      formats.push(format.ext);
    }
  });

  return formats;
}

/**
 * تحميل الأصوات الأساسية مسبقاً
 */
async function preloadBasicSounds(customSounds = {}) {
  const defaultSounds = {
    correct: "assets/sounds/correct.mp3",
    wrong: "assets/sounds/wrong.mp3",
    complete: "assets/sounds/complete.mp3",
    click: "assets/sounds/click.mp3",
    notification: "assets/sounds/notification.mp3",
  };

  const soundsToLoad = { ...defaultSounds, ...customSounds };
  const loadPromises = [];

  for (const [id, src] of Object.entries(soundsToLoad)) {
    if (
      src &&
      feedbackState.supportedFormats.some((format) => src.endsWith(format))
    ) {
      const loadPromise = feedbackState.audioResourceManager
        .loadAudio(id, src, {
          volume: feedbackState.preferencesManager.get("volume"),
        })
        .catch((error) => {
          console.warn(`فشل في تحميل الصوت ${id}:`, error);
          feedbackState.performanceMetrics.failedSounds++;
          return null;
        });

      loadPromises.push(loadPromise);
    }
  }

  const results = await Promise.allSettled(loadPromises);
  const successCount = results.filter(
    (result) => result.status === "fulfilled" && result.value !== null
  ).length;

  feedbackState.performanceMetrics.successfulSounds += successCount;

  console.log(`تم تحميل ${successCount} من أصل ${loadPromises.length} صوت`);
}

/**
 * إعداد مستمعي الأحداث
 */
function setupEventListeners() {
  // إيقاف الأصوات عند إخفاء الصفحة
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseAllSounds();
    } else if (feedbackState.preferencesManager.get("autoplay")) {
      resumeAllSounds();
    }
  });

  // إيقاف الأصوات عند فقدان التركيز
  window.addEventListener("blur", () => {
    pauseAllSounds();
  });

  // استئناف الأصوات عند عودة التركيز
  window.addEventListener("focus", () => {
    if (feedbackState.preferencesManager.get("autoplay")) {
      resumeAllSounds();
    }
  });

  // تنظيف الموارد عند إغلاق الصفحة
  window.addEventListener("beforeunload", () => {
    shutdownFeedbackSystem();
  });

  // مراقبة تغيير مستوى الصوت
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("volumechange", (details) => {
      if (details.volume !== undefined) {
        feedbackState.preferencesManager.set("volume", details.volume);
      }
    });
  }
}

/**
 * إعداد مراقبة الأداء
 */
function setupPerformanceMonitoring() {
  // مراقبة استهلاك الذاكرة
  setInterval(() => {
    if (performance.memory) {
      const memoryUsage = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
      };

      // إذا كان الاستهلاك مرتفعاً، قم بتنظيف الذاكرة التخزين المؤقت
      const usagePercent = (memoryUsage.used / memoryUsage.limit) * 100;
      if (usagePercent > 80) {
        console.warn("استهلاك ذاكرة مرتفع، تنظيف الذاكرة التخزين المؤقت...");
        cleanupUnusedResources();
      }
    }
  }, 30000); // كل 30 ثانية
}

/**
 * تنظيف الموارد غير المستخدمة
 */
function cleanupUnusedResources() {
  // تنظيف الأصوات غير المستخدمة
  const audioStats = feedbackState.audioResourceManager.getStats();
  if (audioStats.cachedAudios > 5) {
    console.log("تنظيف الذاكرة التخزين المؤقت للأصوات");
    // الاحتفاظ بالأصوات الأساسية فقط
    const essentialSounds = ["correct", "wrong", "complete", "click"];
    for (const [id] of feedbackState.audioResourceManager.audioCache) {
      if (!essentialSounds.includes(id)) {
        feedbackState.audioResourceManager.removeAudio(id);
      }
    }
  }

  // تنظيف التأثيرات البصرية
  feedbackState.visualEffectsManager.clear();
}

// ===== وظائف تشغيل الصوت =====

/**
 * تشغيل صوت محدد
 */
export async function playSound(soundId, options = {}) {
  if (!feedbackState.isInitialized) {
    console.warn("نظام التغذية الراجعة غير مهيأ");
    return false;
  }

  if (!feedbackState.preferencesManager.get("audioEnabled")) {
    return false;
  }

  try {
    const startTime = performance.now();
    feedbackState.performanceMetrics.totalInteractions++;

    // الحصول على الصوت
    let audio = feedbackState.audioResourceManager.getAudio(soundId);

    if (!audio) {
      // محاولة تحميل الصوت إذا لم يكن موجوداً
      const src = options.src || `assets/sounds/${soundId}.mp3`;
      audio = await feedbackState.audioResourceManager.loadAudio(
        soundId,
        src,
        options
      );
    }

    if (!audio) {
      throw new FeedbackError(`فشل في الحصول على الصوت: ${soundId}`);
    }

    // تطبيق الخيارات
    const volume =
      options.volume !== undefined
        ? Math.max(0, Math.min(1, options.volume))
        : feedbackState.preferencesManager.get("volume");

    audio.volume = volume;
    audio.loop = options.loop || false;
    audio.playbackRate = options.playbackRate || 1.0;

    // إيقاف التشغيل الحالي إذا لزم الأمر
    if (!audio.paused && options.interrupt !== false) {
      audio.pause();
      audio.currentTime = 0;
    }

    // تشغيل الصوت
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      await playPromise;

      feedbackState.isPlaying = true;
      feedbackState.currentSounds.add(audio);

      // إضافة مستمع انتهاء التشغيل
      const endHandler = () => {
        feedbackState.currentSounds.delete(audio);
        if (feedbackState.currentSounds.size === 0) {
          feedbackState.isPlaying = false;
        }
        audio.removeEventListener("ended", endHandler);
      };

      audio.addEventListener("ended", endHandler);

      // تسجيل الأداء
      const loadTime = performance.now() - startTime;
      feedbackState.performanceMetrics.audioLoadTime.push(loadTime);
      feedbackState.performanceMetrics.successfulSounds++;

      return true;
    }

    return false;
  } catch (error) {
    console.error(`خطأ في تشغيل الصوت ${soundId}:`, error);
    feedbackState.performanceMetrics.failedSounds++;

    // في حالة فشل التشغيل التلقائي، اعرض إشعاراً
    if (error.name === "NotAllowedError") {
      showAudioPermissionNotification();
    }

    return false;
  }
}

/**
 * إيقاف صوت محدد
 */
export function stopSound(soundId) {
  try {
    const audio = feedbackState.audioResourceManager.getAudio(soundId);
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      feedbackState.currentSounds.delete(audio);

      if (feedbackState.currentSounds.size === 0) {
        feedbackState.isPlaying = false;
      }

      return true;
    }
    return false;
  } catch (error) {
    console.error(`خطأ في إيقاف الصوت ${soundId}:`, error);
    return false;
  }
}

/**
 * إيقاف جميع الأصوات
 */
export function stopAllSounds() {
  try {
    let stoppedCount = 0;

    for (const audio of feedbackState.currentSounds) {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        stoppedCount++;
      }
    }

    feedbackState.currentSounds.clear();
    feedbackState.isPlaying = false;

    return stoppedCount;
  } catch (error) {
    console.error("خطأ في إيقاف جميع الأصوات:", error);
    return 0;
  }
}

/**
 * إيقاف جميع الأصوات مؤقتاً
 */
export function pauseAllSounds() {
  try {
    let pausedCount = 0;

    for (const audio of feedbackState.currentSounds) {
      if (!audio.paused) {
        audio.pause();
        pausedCount++;
      }
    }

    return pausedCount;
  } catch (error) {
    console.error("خطأ في إيقاف الأصوات مؤقتاً:", error);
    return 0;
  }
}

/**
 * استئناف جميع الأصوات
 */
export function resumeAllSounds() {
  try {
    let resumedCount = 0;

    for (const audio of feedbackState.currentSounds) {
      if (
        audio.paused &&
        audio.currentTime > 0 &&
        audio.currentTime < audio.duration
      ) {
        audio.play().catch((error) => {
          console.warn("فشل في استئناف الصوت:", error);
        });
        resumedCount++;
      }
    }

    return resumedCount;
  } catch (error) {
    console.error("خطأ في استئناف الأصوات:", error);
    return 0;
  }
}

// ===== وظائف التأثيرات البصرية =====

/**
 * تشغيل تأثير بصري
 */
export async function playVisualEffect(type, options = {}) {
  if (!feedbackState.isInitialized) {
    console.warn("نظام التغذية الراجعة غير مهيأ");
    return false;
  }

  if (!feedbackState.preferencesManager.get("visualEffectsEnabled")) {
    return false;
  }

  // تحقق من تفضيل الحركة المخفضة
  if (feedbackState.preferencesManager.get("reducedMotion") && !options.force) {
    // عرض تأثير مبسط بدلاً من ذلك
    return playSimplifiedEffect(type, options);
  }

  try {
    const startTime = performance.now();

    const effectId = await feedbackState.visualEffectsManager.playEffect(
      type,
      options
    );

    const renderTime = performance.now() - startTime;
    feedbackState.performanceMetrics.effectRenderTime.push(renderTime);

    return effectId;
  } catch (error) {
    console.error(`خطأ في تشغيل التأثير البصري ${type}:`, error);
    return false;
  }
}

/**
 * تشغيل تأثير مبسط للمستخدمين الذين يفضلون حركة أقل
 */
function playSimplifiedEffect(type, options) {
  try {
    const colors = {
      correct: "#2ecc71",
      wrong: "#e74c3c",
      warning: "#f39c12",
      info: "#3498db",
      success: "#27ae60",
    };

    const color = colors[type] || colors.info;

    // تأثير بسيط على الحدود أو الخلفية
    document.body.style.boxShadow = `inset 0 0 20px ${color}`;

    setTimeout(() => {
      document.body.style.boxShadow = "";
    }, options.duration || 300);

    return true;
  } catch (error) {
    console.error("خطأ في التأثير المبسط:", error);
    return false;
  }
}

/**
 * إزالة التأثير البصري
 */
export function removeVisualEffect(effectId) {
  // هذه الوظيفة مدرجة للتوافق مع النسخة السابقة
  // التأثيرات تُزال تلقائياً بعد انتهائها
  return true;
}

// ===== وظائف إدارة التفضيلات =====

/**
 * تفعيل أو تعطيل الصوت
 */
export function setAudioEnabled(enabled) {
  const result = feedbackState.preferencesManager.set(
    "audioEnabled",
    Boolean(enabled)
  );

  if (!enabled) {
    stopAllSounds();
  }

  return result;
}

/**
 * تفعيل أو تعطيل التأثيرات البصرية
 */
export function setVisualEffectsEnabled(enabled) {
  const result = feedbackState.preferencesManager.set(
    "visualEffectsEnabled",
    Boolean(enabled)
  );

  if (!enabled) {
    feedbackState.visualEffectsManager.clear();
  }

  return result;
}

/**
 * تعيين مستوى الصوت
 */
export function setVolume(volume) {
  const clampedVolume = Math.max(0, Math.min(1, Number(volume) || 0));
  return feedbackState.preferencesManager.set("volume", clampedVolume);
}

/**
 * التحقق من حالة الصوت
 */
export function isAudioEnabled() {
  return feedbackState.preferencesManager.get("audioEnabled");
}

/**
 * التحقق من حالة التأثيرات البصرية
 */
export function areVisualEffectsEnabled() {
  return feedbackState.preferencesManager.get("visualEffectsEnabled");
}

/**
 * الحصول على مستوى الصوت
 */
export function getVolume() {
  return feedbackState.preferencesManager.get("volume");
}

/**
 * الحصول على جميع التفضيلات
 */
export function getPreferences() {
  return feedbackState.preferencesManager.getAll();
}

/**
 * إعادة تعيين التفضيلات للإعدادات الافتراضية
 */
export function resetPreferences() {
  feedbackState.preferencesManager.reset();
  return true;
}

// ===== وظائف المراقبة والإحصائيات =====

/**
 * الحصول على إحصائيات الأداء
 */
export function getPerformanceStats() {
  const audioStats = feedbackState.audioResourceManager.getStats();
  const visualStats = feedbackState.visualEffectsManager.getStats();

  return {
    audio: {
      ...audioStats,
      averageLoadTime:
        feedbackState.performanceMetrics.audioLoadTime.length > 0
          ? feedbackState.performanceMetrics.audioLoadTime.reduce(
              (a, b) => a + b,
              0
            ) / feedbackState.performanceMetrics.audioLoadTime.length
          : 0,
      successRate:
        feedbackState.performanceMetrics.totalInteractions > 0
          ? (feedbackState.performanceMetrics.successfulSounds /
              feedbackState.performanceMetrics.totalInteractions) *
            100
          : 0,
    },
    visual: {
      ...visualStats,
      averageRenderTime:
        feedbackState.performanceMetrics.effectRenderTime.length > 0
          ? feedbackState.performanceMetrics.effectRenderTime.reduce(
              (a, b) => a + b,
              0
            ) / feedbackState.performanceMetrics.effectRenderTime.length
          : 0,
    },
    system: {
      isInitialized: feedbackState.isInitialized,
      supportedFormats: feedbackState.supportedFormats,
      totalInteractions: feedbackState.performanceMetrics.totalInteractions,
      currentlyPlaying: feedbackState.currentSounds.size,
    },
  };
}

/**
 * مسح إحصائيات الأداء
 */
export function clearPerformanceStats() {
  feedbackState.performanceMetrics = {
    audioLoadTime: [],
    effectRenderTime: [],
    totalInteractions: 0,
    successfulSounds: 0,
    failedSounds: 0,
  };
  return true;
}

// ===== وظائف التنظيف والإغلاق =====

/**
 * إغلاق نظام التغذية الراجعة
 */
export function shutdownFeedbackSystem() {
  try {
    console.log("إغلاق نظام التغذية الراجعة...");

    // إيقاف جميع الأصوات
    stopAllSounds();

    // تنظيف الموارد
    feedbackState.audioResourceManager.clear();
    feedbackState.visualEffectsManager.clear();

    // حفظ التفضيلات
    feedbackState.preferencesManager.savePreferences();

    // إعادة تعيين الحالة
    feedbackState.isInitialized = false;
    feedbackState.isPlaying = false;
    feedbackState.currentSounds.clear();

    console.log("تم إغلاق نظام التغذية الراجعة");
    return true;
  } catch (error) {
    console.error("خطأ في إغلاق نظام التغذية الراجعة:", error);
    return false;
  }
}

// ===== وظائف مساعدة =====

/**
 * إظهار إشعار إذن الصوت
 */
function showAudioPermissionNotification() {
  if (typeof window !== "undefined" && window.NotificationManager) {
    window.NotificationManager.showWarning(
      "يتطلب تشغيل الأصوات إذن المستخدم. اضغط على أي مكان لتفعيل الصوت.",
      10000
    );

    // إضافة مستمع لتفعيل الصوت عند التفاعل
    const enableAudioOnInteraction = () => {
      // محاولة تشغيل صوت صامت لتفعيل السياق الصوتي
      const silentAudio = new Audio(
        "data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8diJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhGC2t4vHNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwxGy2t4vFMdSUFJH"
      );
      silentAudio.volume = 0;
      silentAudio.play().catch(() => {});

      // إزالة المستمع بعد التفاعل الأول
      document.removeEventListener("click", enableAudioOnInteraction);
      document.removeEventListener("keydown", enableAudioOnInteraction);
      document.removeEventListener("touchstart", enableAudioOnInteraction);
    };

    document.addEventListener("click", enableAudioOnInteraction, {
      once: true,
    });
    document.addEventListener("keydown", enableAudioOnInteraction, {
      once: true,
    });
    document.addEventListener("touchstart", enableAudioOnInteraction, {
      once: true,
    });
  }
}

/**
 * تحميل صوت مخصص
 */
export async function loadCustomSound(id, src, options = {}) {
  if (!feedbackState.isInitialized) {
    throw new FeedbackError("النظام غير مهيأ");
  }

  try {
    const audio = await feedbackState.audioResourceManager.loadAudio(
      id,
      src,
      options
    );
    return audio !== null;
  } catch (error) {
    console.error(`فشل في تحميل الصوت المخصص ${id}:`, error);
    return false;
  }
}

/**
 * إزالة صوت من الذاكرة التخزين المؤقت
 */
export function removeSound(id) {
  if (!feedbackState.isInitialized) {
    return false;
  }

  try {
    feedbackState.audioResourceManager.removeAudio(id);
    return true;
  } catch (error) {
    console.error(`فشل في إزالة الصوت ${id}:`, error);
    return false;
  }
}

/**
 * فحص توفر صوت معين
 */
export function hasSound(id) {
  if (!feedbackState.isInitialized) {
    return false;
  }

  return feedbackState.audioResourceManager.hasAudio(id);
}

/**
 * تشغيل مجموعة من الأصوات بتسلسل
 */
export async function playSequence(soundIds, options = {}) {
  if (!feedbackState.isInitialized || !Array.isArray(soundIds)) {
    return false;
  }

  const delay = options.delay || 500;
  let playedCount = 0;

  try {
    for (const soundId of soundIds) {
      const success = await playSound(soundId, options);
      if (success) {
        playedCount++;
        if (delay > 0 && playedCount < soundIds.length) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return playedCount;
  } catch (error) {
    console.error("خطأ في تشغيل تسلسل الأصوات:", error);
    return playedCount;
  }
}

/**
 * تشغيل مجموعة من الأصوات معاً
 */
export async function playParallel(soundIds, options = {}) {
  if (!feedbackState.isInitialized || !Array.isArray(soundIds)) {
    return [];
  }

  try {
    const promises = soundIds.map((soundId) => playSound(soundId, options));
    const results = await Promise.allSettled(promises);

    return results.map((result, index) => ({
      soundId: soundIds[index],
      success: result.status === "fulfilled" && result.value === true,
      error: result.status === "rejected" ? result.reason : null,
    }));
  } catch (error) {
    console.error("خطأ في تشغيل الأصوات المتوازية:", error);
    return [];
  }
}

/**
 * تشغيل تأثير صوتي وبصري معاً
 */
export async function playFeedback(type, options = {}) {
  if (!feedbackState.isInitialized) {
    return { audio: false, visual: false };
  }

  const results = { audio: false, visual: false };

  try {
    // تشغيل متوازي للصوت والتأثير البصري
    const promises = [];

    if (feedbackState.preferencesManager.get("audioEnabled")) {
      promises.push(
        playSound(type, options.audio || {})
          .then((success) => {
            results.audio = success;
          })
          .catch(() => {
            results.audio = false;
          })
      );
    }

    if (feedbackState.preferencesManager.get("visualEffectsEnabled")) {
      promises.push(
        playVisualEffect(type, options.visual || {})
          .then((success) => {
            results.visual = !!success;
          })
          .catch(() => {
            results.visual = false;
          })
      );
    }

    await Promise.allSettled(promises);
    return results;
  } catch (error) {
    console.error(`خطأ في تشغيل التغذية الراجعة ${type}:`, error);
    return results;
  }
}

/**
 * إنشاء ملف تعريف مخصص للتغذية الراجعة
 */
export function createFeedbackProfile(name, settings) {
  try {
    const profiles = JSON.parse(
      localStorage.getItem("feedbackProfiles") || "{}"
    );

    profiles[name] = {
      ...feedbackState.preferencesManager.getAll(),
      ...settings,
      createdAt: new Date().toISOString(),
      lastUsed: null,
    };

    localStorage.setItem("feedbackProfiles", JSON.stringify(profiles));
    return true;
  } catch (error) {
    console.error("فشل في إنشاء ملف التعريف:", error);
    return false;
  }
}

/**
 * تحميل ملف تعريف مخصص
 */
export function loadFeedbackProfile(name) {
  try {
    const profiles = JSON.parse(
      localStorage.getItem("feedbackProfiles") || "{}"
    );

    if (profiles[name]) {
      const profile = profiles[name];

      // تطبيق الإعدادات
      Object.keys(profile).forEach((key) => {
        if (key !== "createdAt" && key !== "lastUsed") {
          feedbackState.preferencesManager.set(key, profile[key]);
        }
      });

      // تحديث وقت آخر استخدام
      profiles[name].lastUsed = new Date().toISOString();
      localStorage.setItem("feedbackProfiles", JSON.stringify(profiles));

      return true;
    }

    return false;
  } catch (error) {
    console.error("فشل في تحميل ملف التعريف:", error);
    return false;
  }
}

/**
 * الحصول على قائمة ملفات التعريف
 */
export function getFeedbackProfiles() {
  try {
    const profiles = JSON.parse(
      localStorage.getItem("feedbackProfiles") || "{}"
    );
    return Object.keys(profiles).map((name) => ({
      name,
      createdAt: profiles[name].createdAt,
      lastUsed: profiles[name].lastUsed,
    }));
  } catch (error) {
    console.error("فشل في الحصول على ملفات التعريف:", error);
    return [];
  }
}

/**
 * حذف ملف تعريف
 */
export function deleteFeedbackProfile(name) {
  try {
    const profiles = JSON.parse(
      localStorage.getItem("feedbackProfiles") || "{}"
    );

    if (profiles[name]) {
      delete profiles[name];
      localStorage.setItem("feedbackProfiles", JSON.stringify(profiles));
      return true;
    }

    return false;
  } catch (error) {
    console.error("فشل في حذف ملف التعريف:", error);
    return false;
  }
}

// ===== تصدير الواجهة الموحدة =====

/**
 * واجهة موحدة للتعامل مع نظام التغذية الراجعة
 */
export const feedback = {
  // التهيئة والإعداد
  init: initFeedbackSystem,
  shutdown: shutdownFeedbackSystem,

  // تشغيل الأصوات
  playSound,
  stopSound,
  stopAllSounds,
  pauseAllSounds,
  resumeAllSounds,
  loadCustomSound,
  removeSound,
  hasSound,

  // التأثيرات البصرية
  playVisualEffect,
  removeVisualEffect,

  // تشغيل متقدم
  playSequence,
  playParallel,
  playFeedback,

  // إدارة التفضيلات
  setAudioEnabled,
  setVisualEffectsEnabled,
  setVolume,
  isAudioEnabled,
  areVisualEffectsEnabled,
  getVolume,
  getPreferences,
  resetPreferences,

  // ملفات التعريف
  createProfile: createFeedbackProfile,
  loadProfile: loadFeedbackProfile,
  getProfiles: getFeedbackProfiles,
  deleteProfile: deleteFeedbackProfile,

  // المراقبة والإحصائيات
  getPerformanceStats,
  clearPerformanceStats,
};

// ===== التهيئة التلقائية =====

// تهيئة النظام عند تحميل الصفحة
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    // تهيئة تلقائية بإعدادات افتراضية
    initFeedbackSystem({
      enablePerformanceMonitoring: true,
      sounds: {
        // يمكن تخصيص الأصوات هنا
      },
    }).catch((error) => {
      console.warn("التهيئة التلقائية لنظام التغذية الراجعة فشلت:", error);
    });
  });
}

// التصدير الافتراضي
export default feedback;

console.log("تم تحميل نظام التغذية الراجعة المحسن v2.0");

// ===== إضافة دوال مساعدة مفقودة =====

/**
 * إنشاء تأثير الموجات (Ripple Effect)
 */
export function createRippleEffect(
  element,
  x,
  y,
  color = "rgba(255, 255, 255, 0.6)"
) {
  if (
    !element ||
    !feedbackState.preferencesManager.get("visualEffectsEnabled")
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const ripple = document.createElement("div");

  const size = Math.max(rect.width, rect.height);
  const posX = x - rect.left - size / 2;
  const posY = y - rect.top - size / 2;

  Object.assign(ripple.style, {
    position: "absolute",
    width: size + "px",
    height: size + "px",
    left: posX + "px",
    top: posY + "px",
    background: color,
    borderRadius: "50%",
    transform: "scale(0)",
    animation: "effectRipple 0.6s ease-out",
    pointerEvents: "none",
    zIndex: "1000",
  });

  ripple.className = "effect-ripple";
  element.appendChild(ripple);

  setTimeout(() => {
    if (ripple.parentNode) {
      ripple.parentNode.removeChild(ripple);
    }
  }, 600);

  return true;
}

/**
 * تشغيل تأثير اهتزاز للعنصر
 */
export function shakeElement(element, duration = 500) {
  if (
    !element ||
    !feedbackState.preferencesManager.get("visualEffectsEnabled")
  ) {
    return false;
  }

  if (feedbackState.preferencesManager.get("reducedMotion")) {
    // تأثير مبسط للمستخدمين الذين يفضلون حركة أقل
    element.style.outline = "2px solid #e74c3c";
    setTimeout(() => {
      element.style.outline = "";
    }, duration);
    return true;
  }

  const originalTransform = element.style.transform;
  const keyframes = [
    { transform: "translateX(0px)" },
    { transform: "translateX(-10px)" },
    { transform: "translateX(10px)" },
    { transform: "translateX(-10px)" },
    { transform: "translateX(10px)" },
    { transform: "translateX(-5px)" },
    { transform: "translateX(5px)" },
    { transform: "translateX(0px)" },
  ];

  const timing = {
    duration: duration,
    easing: "ease-in-out",
    iterations: 1,
  };

  element.animate(keyframes, timing).addEventListener("finish", () => {
    element.style.transform = originalTransform;
  });

  return true;
}

/**
 * تشغيل تأثير نبضة للعنصر
 */
export function pulseElement(element, color = "#3498db", duration = 800) {
  if (
    !element ||
    !feedbackState.preferencesManager.get("visualEffectsEnabled")
  ) {
    return false;
  }

  const originalBoxShadow = element.style.boxShadow;

  const keyframes = [
    {
      boxShadow: `0 0 0 0 ${color}`,
    },
    {
      boxShadow: `0 0 0 20px rgba(52, 152, 219, 0)`,
    },
  ];

  const timing = {
    duration: duration,
    easing: "ease-out",
    iterations: 1,
  };

  element.animate(keyframes, timing).addEventListener("finish", () => {
    element.style.boxShadow = originalBoxShadow;
  });

  return true;
}

/**
 * تشغيل مجموعة من التأثيرات المتتالية
 */
export async function playEffectSequence(effects, delay = 300) {
  if (!Array.isArray(effects) || effects.length === 0) {
    return [];
  }

  const results = [];

  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];

    try {
      let result;

      switch (effect.type) {
        case "sound":
          result = await playSound(effect.soundId, effect.options);
          break;
        case "visual":
          result = await playVisualEffect(effect.effectType, effect.options);
          break;
        case "ripple":
          result = createRippleEffect(
            effect.element,
            effect.x,
            effect.y,
            effect.color
          );
          break;
        case "shake":
          result = shakeElement(effect.element, effect.duration);
          break;
        case "pulse":
          result = pulseElement(effect.element, effect.color, effect.duration);
          break;
        default:
          result = false;
      }

      results.push({ index: i, success: result });

      // تأخير بين التأثيرات
      if (i < effects.length - 1 && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`خطأ في التأثير ${i}:`, error);
      results.push({ index: i, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * تشغيل احتفال نجاح
 */
export async function playCelebration(options = {}) {
  const celebrationEffects = [
    {
      type: "sound",
      soundId: "complete",
      options: { volume: options.volume || 0.8 },
    },
    {
      type: "visual",
      effectType: "success",
      options: {
        duration: 1000,
        intensity: 0.4,
        showIcon: true,
      },
    },
  ];

  // إضافة تأثيرات إضافية إذا لم يكن المستخدم يفضل حركة أقل
  if (!feedbackState.preferencesManager.get("reducedMotion")) {
    // إضافة تأثير confetti أو sparkles
    celebrationEffects.push({
      type: "visual",
      effectType: "confetti",
      options: {
        duration: 2000,
        particles: 50,
      },
    });
  }

  return await playEffectSequence(celebrationEffects, 100);
}

/**
 * حفظ تسجيل صوتي مخصص
 */
export async function recordCustomSound(soundId, duration = 3000) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new FeedbackError("المتصفح لا يدعم تسجيل الصوت");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const chunks = [];

    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(blob);

        try {
          const success = await loadCustomSound(soundId, audioUrl);
          stream.getTracks().forEach((track) => track.stop());
          resolve(success);
        } catch (error) {
          reject(error);
        }
      };

      mediaRecorder.onerror = (error) => {
        stream.getTracks().forEach((track) => track.stop());
        reject(new FeedbackError("خطأ في التسجيل: " + error.message));
      };

      mediaRecorder.start();

      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, duration);
    });
  } catch (error) {
    throw new FeedbackError("فشل في الوصول للميكروفون: " + error.message);
  }
}

/**
 * تصدير إعدادات الصوت والتأثيرات
 */
export function exportFeedbackSettings() {
  try {
    const settings = {
      preferences: feedbackState.preferencesManager.getAll(),
      profiles: getFeedbackProfiles(),
      customSounds: Array.from(
        feedbackState.audioResourceManager.audioCache.keys()
      ),
      performance: getPerformanceStats(),
      timestamp: new Date().toISOString(),
      version: "2.0",
    };

    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(dataBlob);
    link.download = `feedback-settings-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();

    URL.revokeObjectURL(link.href);
    return true;
  } catch (error) {
    console.error("فشل في تصدير الإعدادات:", error);
    return false;
  }
}

/**
 * استيراد إعدادات الصوت والتأثيرات
 */
export async function importFeedbackSettings(file) {
  if (!file || !file.type.includes("json")) {
    throw new FeedbackError("يجب اختيار ملف JSON صحيح");
  }

  try {
    const text = await file.text();
    const settings = JSON.parse(text);

    if (!settings.preferences || !settings.version) {
      throw new FeedbackError("ملف الإعدادات غير صحيح أو تالف");
    }

    // تطبيق التفضيلات
    if (settings.preferences) {
      Object.keys(settings.preferences).forEach((key) => {
        feedbackState.preferencesManager.set(key, settings.preferences[key]);
      });
    }

    // استيراد ملفات التعريف
    if (settings.profiles && Array.isArray(settings.profiles)) {
      const existingProfiles = JSON.parse(
        localStorage.getItem("feedbackProfiles") || "{}"
      );

      settings.profiles.forEach((profile) => {
        existingProfiles[profile.name] = {
          ...profile,
          importedAt: new Date().toISOString(),
        };
      });

      localStorage.setItem(
        "feedbackProfiles",
        JSON.stringify(existingProfiles)
      );
    }

    return true;
  } catch (error) {
    console.error("فشل في استيراد الإعدادات:", error);
    throw new FeedbackError("فشل في استيراد الإعدادات: " + error.message);
  }
}

// إضافة event listeners لإدارة التأثيرات التفاعلية
if (typeof document !== "undefined") {
  // إضافة تأثير ripple للأزرار عند النقر
  document.addEventListener("click", (event) => {
    if (!feedbackState.isInitialized) return;

    const target = event.target;
    if (target.tagName === "BUTTON" && !target.disabled) {
      createRippleEffect(target, event.clientX, event.clientY);
    }
  });

  // إضافة تأثيرات keyboard للتنقل
  document.addEventListener("keydown", (event) => {
    if (!feedbackState.isInitialized) return;

    // تشغيل صوت click عند استخدام مفاتيح التنقل
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
        "Enter",
      ].includes(event.code)
    ) {
      playSound("click", { volume: 0.3 }).catch(() => {});
    }
  });
}

// إضافة دعم Web Audio API للتأثيرات المتقدمة
class WebAudioManager {
  constructor() {
    this.audioContext = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        throw new Error("Web Audio API غير مدعوم");
      }

      this.audioContext = new AudioContext();

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.warn("فشل في تهيئة Web Audio API:", error);
      return false;
    }
  }

  generateTone(frequency, duration, type = "sine") {
    if (!this.initialized || !this.audioContext) return null;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + duration
    );

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);

    return oscillator;
  }

  playSuccessChord() {
    if (!this.initialized) return false;

    // تشغيل وتر نجاح (C-E-G)
    this.generateTone(261.63, 0.5); // C
    setTimeout(() => this.generateTone(329.63, 0.5), 100); // E
    setTimeout(() => this.generateTone(392.0, 0.5), 200); // G

    return true;
  }

  playErrorSound() {
    if (!this.initialized) return false;

    // تشغيل صوت خطأ منخفض
    this.generateTone(200, 0.3, "sawtooth");
    setTimeout(() => this.generateTone(150, 0.3, "sawtooth"), 150);

    return true;
  }
}

// إضافة Web Audio Manager لحالة النظام
feedbackState.webAudioManager = new WebAudioManager();

// تهيئة Web Audio عند أول تفاعل
if (typeof document !== "undefined") {
  const initWebAudio = () => {
    feedbackState.webAudioManager.initialize();
    document.removeEventListener("click", initWebAudio);
    document.removeEventListener("keydown", initWebAudio);
  };

  document.addEventListener("click", initWebAudio, { once: true });
  document.addEventListener("keydown", initWebAudio, { once: true });
}
