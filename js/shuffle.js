// حالة عمليات الخلط
const shuffleState = {
    randomGenerator: null,
    seed: Date.now(),
    previousShuffles: new Map()
};

// تهيئة نظام الخلط
export function initShuffleSystem(useSeed = false) {
    if (useSeed) {
        // استخدام بذرة ثابتة لأغراض الاختبار والتكرار
        shuffleState.seed = 123456789;
        shuffleState.randomGenerator = createSeededRandom(shuffleState.seed);
    } else {
        // استخدام بذرة عشوائية
        shuffleState.seed = Date.now();
        shuffleState.randomGenerator = Math.random;
    }
    
    console.log('تم تهيئة نظام الخلط بنجاح');
    return true;
}

// إنشاء دالة عشوائية مع بذرة (لأغراض الاختبار)
function createSeededRandom(seed) {
    return function() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

// خلط مصفوفة باستخدام خوارزمية Fisher-Yates
export function shuffleArray(array, key = null) {
    if (!array || !Array.isArray(array)) {
        console.error('المدخل يجب أن يكون مصفوفة');
        return array;
    }
    
    // إنشاء نسخة من المصفوفة الأصلية لتجنب التعديل عليها
    const shuffledArray = [...array];
    const length = shuffledArray.length;
    
    // إذا كانت المصفوفة تحتوي على عنصر واحد أو أقل، لا داعي للخلط
    if (length <= 1) {
        return shuffledArray;
    }
    
    // إذا كان هناك مفتاح محدد، التحقق من وجود خلط سابق
    if (key && shuffleState.previousShuffles.has(key)) {
        return shuffleState.previousShuffles.get(key);
    }
    
    // استخدام الخوارزمية العكسية للخلط (من أجل التوافق مع RTL)
    for (let i = length - 1; i > 0; i--) {
        // إنشاء رقم عشوائي
        const randomIndex = Math.floor(shuffleState.randomGenerator() * (i + 1));
        
        // تبديل العناصر
        [shuffledArray[i], shuffledArray[randomIndex]] = 
        [shuffledArray[randomIndex], shuffledArray[i]];
    }
    
    // إذا كان هناك مفتاح، حفظ النتيجة للاستخدام المستقبلي
    if (key) {
        shuffleState.previousShuffles.set(key, shuffledArray);
    }
    
    return shuffledArray;
}

// خلط كائن يحتوي على أسئلة وإجابات
export function shuffleQuizData(quizData) {
    if (!quizData) {
        console.error('بيانات الاختبار غير متوفرة');
        return null;
    }
    
    try {
        // إنشاء نسخة عميقة من البيانات لتجنب تعديل الأصل
        const shuffledData = JSON.parse(JSON.stringify(quizData));
        
        // خلط البطاقات التعليمية إذا كانت موجودة
        if (shuffledData.flashcards && Array.isArray(shuffledData.flashcards)) {
            shuffledData.flashcards = shuffleArray(shuffledData.flashcards, 'flashcards');
        }
        
        // خلط أسئلة الاختبار إذا كانت موجودة
        if (shuffledData.quizQuestions && Array.isArray(shuffledData.quizQuestions)) {
            shuffledData.quizQuestions = shuffleArray(shuffledData.quizQuestions, 'quizQuestions');
            
            // خلط الإجابات داخل كل سؤال
            shuffledData.quizQuestions.forEach((question, index) => {
                if (question.answers && Array.isArray(question.answers)) {
                    // حفظ الإجابة الصحيحة (الأولى في المصفوفة)
                    const correctAnswer = question.answers[0];
                    
                    // خلط الإجابات
                    const shuffledAnswers = shuffleArray(question.answers, `question-${index}`);
                    
                    // التأكد من أن الإجابة الصحيحة لا تزال موجودة
                    if (!shuffledAnswers.includes(correctAnswer)) {
                        console.warn('الإجابة الصحيحة فقدت أثناء الخلط، إضافتها مرة أخرى');
                        shuffledAnswers.push(correctAnswer);
                        shuffledData.quizQuestions[index].answers = shuffleArray(shuffledAnswers);
                    } else {
                        shuffledData.quizQuestions[index].answers = shuffledAnswers;
                    }
                }
            });
        }
        
        return shuffledData;
    } catch (error) {
        console.error('فشل في خلط بيانات الاختبار:', error);
        return quizData;
    }
}

// الحصول على ترتيب عشوائي للعناصر بناءً على عددها
export function getRandomOrder(count, key = null) {
    if (count <= 0) {
        return [];
    }
    
    // إنشاء مصفوفة بالأرقام من 0 إلى count-1
    const indices = Array.from({ length: count }, (_, i) => i);
    
    // خلط المصفوفة
    return shuffleArray(indices, key);
}

// إعادة تعيين نظام الخلط
export function resetShuffleSystem() {
    shuffleState.previousShuffles.clear();
    shuffleState.seed = Date.now();
    shuffleState.randomGenerator = Math.random;
    
    console.log('تم إعادة تعيين نظام الخلط');
}

// تعيين بذرة جديدة للعشوائية
export function setSeed(newSeed) {
    if (typeof newSeed === 'number') {
        shuffleState.seed = newSeed;
        shuffleState.randomGenerator = createSeededRandom(newSeed);
        console.log('تم تعيين بذرة جديدة لنظام الخلط');
        return true;
    }
    
    console.error('البذرة يجب أن تكون رقمية');
    return false;
}

// الحصول على البذرة الحالية
export function getCurrentSeed() {
    return shuffleState.seed;
}

// تصدير واجهة موحدة للتعامل مع نظام الخلط
export const shuffle = {
    init: initShuffleSystem,
    array: shuffleArray,
    quizData: shuffleQuizData,
    getOrder: getRandomOrder,
    reset: resetShuffleSystem,
    setSeed: setSeed,
    getSeed: getCurrentSeed
};

// تهيئة النظام عند التحميل
document.addEventListener('DOMContentLoaded', () => {
    // استخدام تهيئة افتراضية بدون بذرة ثابتة
    initShuffleSystem(false);
});

export default shuffle;