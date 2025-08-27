// حالة الإحصائيات
const statsState = {
    currentQuizData: null,
    userStats: new Map(),
    leaderboard: []
};

// تهيئة وحدة الإحصائيات
export function initStats(quizData) {
    if (!quizData) {
        console.error('بيانات الاختبار غير متوفرة لتهيئة الإحصائيات');
        return;
    }

    statsState.currentQuizData = quizData;
    
    // تحميل الإحصائيات الحالية
    loadUserStats();
    
    // إنشاء لوحة الصدارة
    generateLeaderboard();
    
    console.log('تم تهيئة وحدة الإحصائيات بنجاح');
}

// تحميل إحصائيات المستخدمين
function loadUserStats() {
    statsState.userStats.clear();
    
    if (!statsState.currentQuizData.stats) {
        statsState.currentQuizData.stats = [];
        return;
    }
    
    // تجميع إحصائيات كل مستخدم
    statsState.currentQuizData.stats.forEach(stat => {
        if (!statsState.userStats.has(stat.username)) {
            statsState.userStats.set(stat.username, []);
        }
        statsState.userStats.get(stat.username).push(stat);
    });
}

// إنشاء لوحة الصدارة
function generateLeaderboard() {
    statsState.leaderboard = [];
    
    // إذا لم توجد إحصائيات، إنشاء مصفوفة فارغة
    if (!statsState.currentQuizData.stats || statsState.currentQuizData.stats.length === 0) {
        return;
    }
    
    // تجميع أفضل نتائج لكل مستخدم
    const bestResults = new Map();
    
    statsState.currentQuizData.stats.forEach(stat => {
        if (!bestResults.has(stat.username) || 
            bestResults.get(stat.username).scorePercent < stat.scorePercent ||
            (bestResults.get(stat.username).scorePercent === stat.scorePercent && 
             bestResults.get(stat.username).correct < stat.correct)) {
            bestResults.set(stat.username, stat);
        }
    });
    
    // تحويل الخريطة إلى مصفوفة وترتيبها
    statsState.leaderboard = Array.from(bestResults.values())
        .sort((a, b) => {
            // الترتيب حسب النسبة المئوية أولاً
            if (b.scorePercent !== a.scorePercent) {
                return b.scorePercent - a.scorePercent;
            }
            // ثم حسب عدد الإجابات الصحيحة
            if (b.correct !== a.correct) {
                return b.correct - a.correct;
            }
            // ثم حسب التاريخ (الأحدث أولاً)
            return new Date(b.date) - new Date(a.date);
        })
        .map((stat, index) => ({
            rank: index + 1,
            username: stat.username,
            scorePercent: stat.scorePercent,
            correctAnswers: stat.correct,
            totalQuestions: stat.totalQuestions,
            date: stat.date
        }));
}

// إضافة نتيجة جديدة للجلسة
export function addSessionResult(quizData, newResult) {
    if (!quizData) {
        console.error('بيانات الاختبار غير متوفرة لإضافة النتيجة');
        return null;
    }
    
    // التأكد من وجود مصفوفة الإحصائيات
    if (!quizData.stats) {
        quizData.stats = [];
    }
    
    // التحقق من صحة البيانات
    if (!isValidResult(newResult)) {
        console.error('بيانات النتيجة غير صالحة');
        return quizData;
    }
    
    // إضافة النتيجة الجديدة
    quizData.stats.push(newResult);
    
    // تحديث الحالة المحلية
    statsState.currentQuizData = quizData;
    loadUserStats();
    generateLeaderboard();
    
    return quizData;
}

// التحقق من صحة بيانات النتيجة
function isValidResult(result) {
    const requiredFields = ['username', 'date', 'totalQuestions', 'correct', 'scorePercent'];
    
    for (const field of requiredFields) {
        if (result[field] === undefined || result[field] === null) {
            console.error(`حقل ${field} مفقود في بيانات النتيجة`);
            return false;
        }
    }
    
    // تحقق من أنواع البيانات
    if (typeof result.username !== 'string' || result.username.trim() === '') {
        console.error('اسم المستخدم غير صالح');
        return false;
    }
    
    if (typeof result.totalQuestions !== 'number' || result.totalQuestions <= 0) {
        console.error('عدد الأسئلة الإجمالي غير صالح');
        return false;
    }
    
    if (typeof result.correct !== 'number' || result.correct < 0 || result.correct > result.totalQuestions) {
        console.error('عدد الإجابات الصحيحة غير صالح');
        return false;
    }
    
    if (typeof result.scorePercent !== 'number' || result.scorePercent < 0 || result.scorePercent > 100) {
        console.error('النسبة المئوية للنتيجة غير صالحة');
        return false;
    }
    
    return true;
}

// الحصول على لوحة الصدارة
export function getLeaderboard() {
    return statsState.leaderboard;
}

// الحصول على إحصائيات مستخدم معين
export function getUserStats(username) {
    if (!username || typeof username !== 'string') {
        console.error('اسم المستخدم غير صالح');
        return [];
    }
    
    return statsState.userStats.get(username) || [];
}

// مقارنة أداء المستخدم الحالي مع أدائه السابق
export function compareUserPerformance(username) {
    const userStats = getUserStats(username);
    
    if (userStats.length < 2) {
        return {
            hasEnoughData: false,
            message: 'لا توجد بيانات كافية للمقارنة'
        };
    }
    
    // ترتيب الإحصائيات حسب التاريخ (الأحدث أولاً)
    const sortedStats = userStats.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    const latestStat = sortedStats[0];
    const previousStats = sortedStats.slice(1);
    
    // حساب متوسط الأداء السابق
    const avgPreviousScore = previousStats.reduce((sum, stat) => 
        sum + stat.scorePercent, 0) / previousStats.length;
    
    // حساب التغير في الأداء
    const scoreChange = latestStat.scorePercent - avgPreviousScore;
    const absScoreChange = Math.abs(scoreChange);
    
    // تحديد اتجاه التغير
    let changeDirection = 'no-change';
    let changeMessage = 'لم يتغير أداؤك';
    
    if (scoreChange > 2) {
        changeDirection = 'improvement';
        changeMessage = `تحسن أداؤك بمقدار ${absScoreChange.toFixed(1)}%`;
    } else if (scoreChange < -2) {
        changeDirection = 'decline';
        changeMessage = `انخفض أداؤك بمقدار ${absScoreChange.toFixed(1)}%`;
    }
    
    // حساب التغير في الوقت المستغرق
    const avgPreviousTime = previousStats.reduce((sum, stat) => 
        sum + stat.avgTimePerQuestionSec, 0) / previousStats.length;
    
    const timeChange = latestStat.avgTimePerQuestionSec - avgPreviousTime;
    const absTimeChange = Math.abs(timeChange);
    
    // تحديد اتجاه التغير في الوقت
    let timeChangeDirection = 'no-change';
    let timeChangeMessage = 'لم يتغير متوسط وقت الإجابة';
    
    if (timeChange > 5) {
        timeChangeDirection = 'slower';
        timeChangeMessage = `زاد متوسط وقت إجابتك بمقدار ${absTimeChange.toFixed(1)} ثانية`;
    } else if (timeChange < -5) {
        timeChangeDirection = 'faster';
        timeChangeMessage = `قل متوسط وقت إجابتك بمقدار ${absTimeChange.toFixed(1)} ثانية`;
    }
    
    // حساب التغير في عدد التوقفات
    const avgPreviousPauses = previousStats.reduce((sum, stat) => 
        sum + stat.pauses, 0) / previousStats.length;
    
    const pausesChange = latestStat.pauses - avgPreviousPauses;
    const absPausesChange = Math.abs(pausesChange);
    
    // تحديد اتجاه التغير في التوقفات
    let pausesChangeDirection = 'no-change';
    let pausesChangeMessage = 'لم يتغير عدد التوقفات';
    
    if (pausesChange > 0.5) {
        pausesChangeDirection = 'more-pauses';
        pausesChangeMessage = `زاد عدد توقفاتك بمقدار ${absPausesChange.toFixed(1)}`;
    } else if (pausesChange < -0.5) {
        pausesChangeDirection = 'less-pauses';
        pausesChangeMessage = `قل عدد توقفاتك بمقدار ${absPausesChange.toFixed(1)}`;
    }
    
    return {
        hasEnoughData: true,
        latestStat,
        previousStats: previousStats.length,
        scoreChange: {
            value: scoreChange,
            direction: changeDirection,
            message: changeMessage
        },
        timeChange: {
            value: timeChange,
            direction: timeChangeDirection,
            message: timeChangeMessage
        },
        pausesChange: {
            value: pausesChange,
            direction: pausesChangeDirection,
            message: pausesChangeMessage
        },
        improvementAreas: calculateImprovementAreas(latestStat, previousStats)
    };
}

// تحديد مجالات التحسين
function calculateImprovementAreas(latestStat, previousStats) {
    const improvementAreas = [];
    
    // إذا كان هناك أسئلة خاطئة
    if (latestStat.wrongQuestionsList && latestStat.wrongQuestionsList.length > 0) {
        improvementAreas.push({
            type: 'wrong-answers',
            count: latestStat.wrongQuestionsList.length,
            message: `لديك ${latestStat.wrongQuestionsList.length} سؤال تحتاج إلى مراجعة`
        });
    }
    
    // إذا كان هناك أسئلة تم تخطيها
    if (latestStat.skipped && latestStat.skipped > 0) {
        improvementAreas.push({
            type: 'skipped-questions',
            count: latestStat.skipped,
            message: `قمت بتخطي ${latestStat.skipped} سؤال`
        });
    }
    
    // مقارنة مع الأداء السابق
    if (previousStats.length > 0) {
        const avgPreviousScore = previousStats.reduce((sum, stat) => 
            sum + stat.scorePercent, 0) / previousStats.length;
        
        if (latestStat.scorePercent < avgPreviousScore) {
            improvementAreas.push({
                type: 'score-decline',
                change: (avgPreviousScore - latestStat.scorePercent).toFixed(1),
                message: `انخفضت نتيجتك بمقدار ${(avgPreviousScore - latestStat.scorePercent).toFixed(1)}% compared to your average`
            });
        }
    }
    
    return improvementAreas;
}

// الحصول على إحصائيات ملخصة للعرض
export function getSummaryStats(username) {
    const userStats = getUserStats(username);
    
    if (userStats.length === 0) {
        return {
            totalAttempts: 0,
            averageScore: 0,
            bestScore: 0,
            improvementTrend: 'no-data'
        };
    }
    
    // حساب الإحصائيات
    const totalAttempts = userStats.length;
    const averageScore = userStats.reduce((sum, stat) => sum + stat.scorePercent, 0) / totalAttempts;
    const bestScore = Math.max(...userStats.map(stat => stat.scorePercent));
    
    // تحديد اتجاه التحسن
    const sortedByDate = userStats.sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstScore = sortedByDate[0].scorePercent;
    const lastScore = sortedByDate[sortedByDate.length - 1].scorePercent;
    
    let improvementTrend = 'no-change';
    if (lastScore > firstScore + 5) {
        improvementTrend = 'improving';
    } else if (lastScore < firstScore - 5) {
        improvementTrend = 'declining';
    }
    
    return {
        totalAttempts,
        averageScore: Math.round(averageScore),
        bestScore: Math.round(bestScore),
        improvementTrend,
        lastAttempt: sortedByDate[sortedByDate.length - 1].date
    };
}

// تصدير البيانات للإحصائيات (للاستخدام في الرسوم البيانية)
export function getChartData(username) {
    const userStats = getUserStats(username);
    
    if (userStats.length === 0) {
        return null;
    }
    
    // ترتيب الإحصائيات حسب التاريخ
    const sortedStats = userStats.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // إعداد بيانات الرسم البياني
    return {
        labels: sortedStats.map(stat => new Date(stat.date).toLocaleDateString()),
        scores: sortedStats.map(stat => stat.scorePercent),
        times: sortedStats.map(stat => stat.avgTimePerQuestionSec),
        correctAnswers: sortedStats.map(stat => stat.correct),
        totalQuestions: sortedStats.map(stat => stat.totalQuestions)
    };
}

// تنظيف الإحصائيات القديمة (أكثر من 90 يومًا)
export function cleanupOldStats(quizData, maxAgeDays = 90) {
    if (!quizData.stats || quizData.stats.length === 0) {
        return quizData;
    }
    
    const now = new Date();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    
    // إنشاء نسخة احتياطية قبل التنظيف
    const backup = JSON.parse(JSON.stringify(quizData.stats));
    localStorage.setItem('statsBackup', JSON.stringify(backup));
    
    quizData.stats = quizData.stats.filter(stat => {
        const statDate = new Date(stat.date);
        return now - statDate < maxAgeMs;
    });
    
    // تحديث الحالة المحلية
    statsState.currentQuizData = quizData;
    loadUserStats();
    generateLeaderboard();
    
    return quizData;
}

// استعادة النسخة الاحتياطية للإحصائيات
export function restoreStatsBackup(quizData) {
    const backup = localStorage.getItem('statsBackup');
    if (backup) {
        try {
            quizData.stats = JSON.parse(backup);
            localStorage.removeItem('statsBackup');
            
            // تحديث الحالة المحلية
            statsState.currentQuizData = quizData;
            loadUserStats();
            generateLeaderboard();
            
            return quizData;
        } catch (error) {
            console.error('فشل في استعادة النسخة الاحتياطية', error);
        }
    }
    return quizData;
}

// تهيئة الوحدة عند التحميل
console.log('تم تحميل وحدة الإحصائيات');