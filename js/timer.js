// حالة المؤقت
let timer = {
    duration: 0,
    remaining: 0,
    intervalId: null,
    isPaused: false,
    onTimeUp: null,
    onTick: null,
    startTime: null
};

// تهيئة المؤقت
export function initTimer(duration, onTimeUpCallback, onTickCallback = null) {
    timer = {
        duration,
        remaining: duration,
        intervalId: null,
        isPaused: false,
        onTimeUp: onTimeUpCallback,
        onTick: onTickCallback,
        startTime: Date.now()
    };
}

// بدء المؤقت
export function startTimer() {
    if (timer.intervalId) {
        clearInterval(timer.intervalId);
    }
    
    timer.intervalId = setInterval(() => {
        if (!timer.isPaused) {
            timer.remaining--;
            
            // تحديث واجهة المستخدم مع كل ثانية
            if (timer.onTick) {
                timer.onTick(timer.remaining);
            }
            
            // التحقق من انتهاء الوقت
            if (timer.remaining <= 0) {
                stopTimer();
                if (timer.onTimeUp) {
                    timer.onTimeUp();
                }
            }
        }
    }, 1000);
}

// إيقاف المؤقت
export function stopTimer() {
    if (timer.intervalId) {
        clearInterval(timer.intervalId);
        timer.intervalId = null;
    }
}

// إيقاف المؤقت مؤقتاً
export function pauseTimer() {
    timer.isPaused = true;
}

// استئناف المؤقت
export function resumeTimer() {
    timer.isPaused = false;
}

// إعادة تعيين المؤقت
export function resetTimer(newDuration = null) {
    stopTimer();
    
    if (newDuration !== null) {
        timer.duration = newDuration;
    }
    
    timer.remaining = timer.duration;
    timer.isPaused = false;
    timer.startTime = Date.now();
    
    // تحديث واجهة المستخدم
    if (timer.onTick) {
        timer.onTick(timer.remaining);
    }
}

// الحصول على الوقت المتبقي
export function getRemainingTime() {
    return timer.remaining;
}

// الحصول على الوقت المنقضي
export function getElapsedTime() {
    return Math.floor((Date.now() - timer.startTime) / 1000);
}

// التحقق مما إذا كان المؤقت متوقفاً مؤقتاً
export function isPaused() {
    return timer.isPaused;
}

// تعيين دالة الاستدعاء عند انتهاء الوقت
export function setTimeUpCallback(callback) {
    timer.onTimeUp = callback;
}

// تعيين دالة الاستدعاء عند كل ثانية
export function setTickCallback(callback) {
    timer.onTick = callback;
}