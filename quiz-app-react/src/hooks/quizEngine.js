// محاكاة لمحرك الاختبار (سيتم استبدالها بالمنطق الأصلي)
export const quizEngine = {
  data: null,
  currentIndex: 0,
  isFlipped: false,
  mode: "flashcard",
  answers: [],

  initialize(quizData, username) {
    this.data = quizData;
    this.username = username;
    this.currentIndex = 0;
    this.isFlipped = false;
    this.mode = "flashcard";
    this.answers = [];
  },

  getCurrentQuestion() {
    if (!this.data) return null;

    if (this.mode === "flashcard") {
      const flashcards = this.data.flashcards || [];
      if (this.currentIndex >= flashcards.length) {
        this.mode = "quiz";
        this.currentIndex = 0;
        return this.getCurrentQuestion();
      }

      return {
        type: "flashcard",
        data: flashcards[this.currentIndex],
        isFlipped: this.isFlipped,
        index: this.currentIndex,
        total: flashcards.length,
      };
    } else {
      const questions = this.data.quizQuestions || [];
      if (this.currentIndex >= questions.length) return null;

      return {
        type: "question",
        data: questions[this.currentIndex],
        index: this.currentIndex,
        total: questions.length,
      };
    }
  },

  answerQuestion(selectedAnswer) {
    const question = this.getCurrentQuestion();
    if (!question || question.type !== "question") return false;

    const isCorrect = selectedAnswer === question.data.correctAnswer;
    this.answers.push({
      questionIndex: this.currentIndex,
      selectedAnswer,
      isCorrect,
      timestamp: new Date().toISOString(),
    });

    return isCorrect;
  },

  nextQuestion() {
    const questions =
      this.mode === "flashcard"
        ? this.data.flashcards || []
        : this.data.quizQuestions || [];

    if (this.currentIndex < questions.length - 1) {
      this.currentIndex++;
      this.isFlipped = false;
      return true;
    }

    // إذا كان في وضع البطاقات وينتقل إلى الأسئلة
    if (this.mode === "flashcard" && this.data.quizQuestions?.length > 0) {
      this.mode = "quiz";
      this.currentIndex = 0;
      this.isFlipped = false;
      return true;
    }

    return false;
  },

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isFlipped = false;
      return true;
    }
    return false;
  },

  flipFlashcard() {
    this.isFlipped = !this.isFlipped;
  },

  getResults() {
    const correct = this.answers.filter((a) => a.isCorrect).length;
    const totalQuestions = this.data.quizQuestions?.length || 0;

    return {
      username: this.username,
      quizTitle: this.data.title,
      totalQuestions,
      correct,
      wrong: totalQuestions - correct,
      scorePercent: totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0,
      totalTimeSec: 300, // وقت افتراضي
      performanceLevel: this.getPerformanceLevel(correct, totalQuestions),
    };
  },

  getPerformanceLevel(correct, total) {
    if (total === 0) return "غير محدد";
    const percentage = (correct / total) * 100;

    if (percentage >= 90) return "ممتاز";
    if (percentage >= 80) return "جيد جداً";
    if (percentage >= 70) return "جيد";
    if (percentage >= 60) return "مقبول";
    return "يحتاج تحسين";
  },
};
