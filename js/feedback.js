// حالة النظام الصوتي والبصري
const feedbackState = {
    audioEnabled: true,
    visualEffectsEnabled: true,
    audioElements: new Map(),
    isPlaying: false,
    currentFlash: null
};

// تهيئة النظام الصوتي والبصري
export function initFeedbackSystem() {
    // التحقق من دعم المتصفح للعناصر الصوتية
    if (!isAudioSupported()) {
        console.warn('المتصفح لا يدعم تشغيل الصوتيات بشكل كامل');
        feedbackState.audioEnabled = false;
    }
    
    // تحميل التفضيلات
    loadPreferences();
    
    // تحميل العناصر الصوتية مسبقاً
    preloadAudioElements();
    
    // إعداد مستمعي الأحداث
    setupEventListeners();
    
    console.log('تم تهيئة نظام التعزيز الصوتي والبصري بنجاح');
}

// التحقق من دعم الصوتيات
function isAudioSupported() {
    const audio = document.createElement('audio');
    return !!(
        audio.canPlayType &&
        (audio.canPlayType('audio/mp3') !== '' ||
         audio.canPlayType('audio/wav') !== '')
    );
}

// تحميل العناصر الصوتية مسبقاً
function preloadAudioElements() {
    // الصوتيات الأساسية
    const sounds = [
        { id: 'correct', src: 'assets/sounds/correct.mp3' },
        { id: 'wrong', src: 'assets/sounds/wrong.mp3' },
        { id: 'complete', src: 'assets/sounds/complete.mp3' },
        { id: 'click', src: 'assets/sounds/click.mp3' }
    ];
    
    sounds.forEach(sound => {
        try {
            const audio = new Audio();
            audio.src = sound.src;
            audio.preload = 'auto';
            audio.volume = 0.7;
            
            feedbackState.audioElements.set(sound.id, audio);
            
            // محاولة التحميل المسبق
            audio.load().catch(error => {
                console.warn(`فشل في تحميل الصوت: ${sound.id}`, error);
            });
        } catch (error) {
            console.error(`فشل في إنشاء عنصر صوتي: ${sound.id}`, error);
        }
    });
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // إيقاف الصوت عند إغلاق الصفحة أو الانتقال عنها
    window.addEventListener('beforeunload', stopAllSounds);
    window.addEventListener('pagehide', stopAllSounds);
    
    // إيقاف الصوت عند فقدان النافذة للتركيز
    window.addEventListener('blur', handleWindowBlur);
    
    // استئناف الصوت عند عودة النافذة للتركيز
    window.addEventListener('focus', handleWindowFocus);
}

// إزالة مستمعي الأحداث
function removeEventListeners() {
    window.removeEventListener('beforeunload', stopAllSounds);
    window.removeEventListener('pagehide', stopAllSounds);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
}

// التعامل مع فقدان التركيز
function handleWindowBlur() {
    if (feedbackState.isPlaying) {
        pauseAllSounds();
    }
}

// التعامل مع عودة التركيز
function handleWindowFocus() {
    resumeAllSounds();
}

// تشغيل صوت معين
export function playSound(soundId, options = {}) {
    if (!feedbackState.audioEnabled) return;
    
    try {
        const audio = feedbackState.audioElements.get(soundId);
        if (!audio) {
            console.warn(`الصوت غير موجود: ${soundId}`);
            return;
        }
        
        // إعداد الخيارات
        const volume = options.volume !== undefined ? options.volume : 0.7;
        const loop = options.loop || false;
        
        // تطبيق الخيارات
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.loop = loop;
        
        // إعادة تعيين الصوت إذا كان يشتغل بالفعل
        if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
        
        // تشغيل الصوت
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    feedbackState.isPlaying = true;
                    
                    // إضافة مستمع لمعرفة متى ينتهي الصوت
                    audio.onended = () => {
                        feedbackState.isPlaying = false;
                    };
                })
                .catch(error => {
                    console.error(`فشل في تشغيل الصوت: ${soundId}`, error);
                    feedbackState.audioEnabled = false;
                });
        }
    } catch (error) {
        console.error(`خطأ غير متوقع أثناء تشغيل الصوت: ${soundId}`, error);
    }
}

// إيقاف صوت معين
export function stopSound(soundId) {
    try {
        const audio = feedbackState.audioElements.get(soundId);
        if (audio && !audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
    } catch (error) {
        console.error(`خطأ أثناء إيقاف الصوت: ${soundId}`, error);
    }
}

// إيقاف جميع الأصوات
export function stopAllSounds() {
    feedbackState.audioElements.forEach(audio => {
        if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
    });
    
    feedbackState.isPlaying = false;
}

// إيقاف جميع الأصوات مؤقتاً
export function pauseAllSounds() {
    feedbackState.audioElements.forEach(audio => {
        if (!audio.paused) {
            audio.pause();
        }
    });
}

// استئناف جميع الأصوات
export function resumeAllSounds() {
    feedbackState.audioElements.forEach(audio => {
        if (audio.paused && audio.currentTime > 0 && audio.currentTime < audio.duration) {
            audio.play().catch(error => {
                console.error('فشل في استئناف الصوت', error);
            });
        }
    });
}

// تشغيل تأثير بصري
export function playVisualEffect(type, options = {}) {
    if (!feedbackState.visualEffectsEnabled) return;
    
    // إلغاء التأثير الحالي إذا كان موجوداً
    if (feedbackState.currentFlash) {
        clearTimeout(feedbackState.currentFlash.timeoutId);
        removeVisualEffect(feedbackState.currentFlash.elementId);
    }
    
    const elementId = options.elementId || 'flash-overlay';
    const duration = options.duration || 500;
    const intensity = options.intensity || 0.3;
    
    let element = document.getElementById(elementId);
    
    // إنشاء العنصر إذا لم يكن موجوداً
    if (!element) {
        element = document.createElement('div');
        element.id = elementId;
        element.style.position = 'fixed';
        element.style.top = '0';
        element.style.left = '0';
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.pointerEvents = 'none';
        element.style.zIndex = '10000';
        element.style.opacity = '0';
        element.style.transition = 'opacity 0.3s ease-in-out';
        
        document.body.appendChild(element);
    }
    
    // تحديد اللون بناءً على النوع
    let color;
    switch (type) {
        case 'correct':
            color = `rgba(0, 255, 0, ${intensity})`;
            break;
        case 'wrong':
            color = `rgba(255, 0, 0, ${intensity})`;
            break;
        case 'warning':
            color = `rgba(255, 165, 0, ${intensity})`;
            break;
        case 'neutral':
            color = `rgba(0, 0, 255, ${intensity})`;
            break;
        default:
            color = `rgba(255, 255, 255, ${intensity})`;
    }
    
    // تطبيق التأثير
    element.style.backgroundColor = color;
    element.style.opacity = '1';
    
    // إعداد إزالة التأثير بعد المدة المحددة
    const timeoutId = setTimeout(() => {
        element.style.opacity = '0';
        
        // إزالة العنصر completamente بعد انتهاء الانتقال
        setTimeout(() => {
            if (element.parentNode && element.style.opacity === '0') {
                element.parentNode.removeChild(element);
            }
        }, 300);
    }, duration);
    
    // حفظ حالة التأثير الحالي
    feedbackState.currentFlash = {
        elementId,
        timeoutId
    };
}

// إزالة التأثير البصري
export function removeVisualEffect(elementId = 'flash-overlay') {
    const element = document.getElementById(elementId);
    if (element && element.parentNode) {
        element.style.opacity = '0';
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 300);
    }
    
    feedbackState.currentFlash = null;
}

// تفعيل أو تعطيل الصوت
export function setAudioEnabled(enabled) {
    feedbackState.audioEnabled = enabled;
    
    if (!enabled) {
        stopAllSounds();
    }
    
    // حفظ التفضيل في localStorage
    try {
        localStorage.setItem('audioEnabled', enabled.toString());
    } catch (error) {
        console.warn('لا يمكن الوصول إلى localStorage', error);
    }
}

// تفعيل أو تعطيل التأثيرات البصرية
export function setVisualEffectsEnabled(enabled) {
    feedbackState.visualEffectsEnabled = enabled;
    
    if (!enabled && feedbackState.currentFlash) {
        removeVisualEffect(feedbackState.currentFlash.elementId);
    }
    
    // حفظ التفضيل في localStorage
    try {
        localStorage.setItem('visualEffectsEnabled', enabled.toString());
    } catch (error) {
        console.warn('لا يمكن الوصول إلى localStorage', error);
    }
}

// التحقق من حالة الصوت
export function isAudioEnabled() {
    return feedbackState.audioEnabled;
}

// التحقق من حالة التأثيرات البصرية
export function areVisualEffectsEnabled() {
    return feedbackState.visualEffectsEnabled;
}

// تحميل التفضيلات من localStorage
function loadPreferences() {
    try {
        const audioEnabled = localStorage.getItem('audioEnabled');
        if (audioEnabled !== null) {
            feedbackState.audioEnabled = audioEnabled === 'true';
        }
        
        const visualEffectsEnabled = localStorage.getItem('visualEffectsEnabled');
        if (visualEffectsEnabled !== null) {
            feedbackState.visualEffectsEnabled = visualEffectsEnabled === 'true';
        }
    } catch (error) {
        console.warn('لا يمكن الوصول إلى localStorage', error);
    }
}

// إغلاق نظام التعزيز
export function shutdownFeedbackSystem() {
    removeEventListeners();
    stopAllSounds();
    if (feedbackState.currentFlash) {
        removeVisualEffect(feedbackState.currentFlash.elementId);
    }
    
    // تنظيف الموارد
    feedbackState.audioElements.clear();
}

// تهيئة النظام عند التحميل
document.addEventListener('DOMContentLoaded', () => {
    initFeedbackSystem();
});

// واجهة للتفاعل مع الأحداث الخارجية
export const feedback = {
    playSound,
    stopSound,
    stopAllSounds,
    pauseAllSounds,
    resumeAllSounds,
    playVisualEffect,
    removeVisualEffect,
    setAudioEnabled,
    setVisualEffectsEnabled,
    isAudioEnabled,
    areVisualEffectsEnabled,
    shutdown: shutdownFeedbackSystem
};

// التصدير الافتراضي
export default feedback;