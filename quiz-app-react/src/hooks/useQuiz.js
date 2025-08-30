import { useState, useCallback, useRef } from "react";
import { quizEngine } from "../utils/quizEngine";
import { timer } from "../utils/timer";

export const useQuiz = () => {
  const [quizState, setQuizState] = useState({
    loading: false,
    loadingMessage: "",
    quizData: null,
    currentQuestion: null,
    currentMode: null,
    isPaused: false,
    isFinished: false,
    showResults: false,
    username: "",
  });

  const timerRef = useRef(null);

  const initializeQuiz = useCallback(async (quizData, username) => {
    setQuizState((prev) => ({
      ...prev,
      loading: true,
      loadingMessage: "جاري تهيئة الاختبار...",
    }));

    try {
      quizEngine.initialize(quizData, username);

      setQuizState((prev) => ({
        ...prev,
        quizData,
        username,
        currentMode: "flashcard",
        currentQuestion: quizEngine.getCurrentQuestion(),
        loading: false,
        loadingMessage: "",
      }));

      // بدء المؤقت إذا كان في وضع الاختبار
      if (quizState.currentMode === "quiz") {
        timer.init(quizData.timer, handleTimeUp, handleTimerTick);
        timer.start();
      }
    } catch (error) {
      setQuizState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  const answerQuestion = useCallback((selectedAnswer) => {
    const isCorrect = quizEngine.answerQuestion(selectedAnswer);
    setQuizState((prev) => ({
      ...prev,
      currentQuestion: quizEngine.getCurrentQuestion(),
    }));
    return isCorrect;
  }, []);

  const nextQuestion = useCallback(() => {
    const hasNext = quizEngine.nextQuestion();
    if (hasNext) {
      setQuizState((prev) => ({
        ...prev,
        currentQuestion: quizEngine.getCurrentQuestion(),
      }));

      if (quizState.currentMode === "quiz") {
        timer.reset(quizState.quizData.timer);
        timer.start();
      }
    } else {
      finishQuiz();
    }
  }, [quizState.quizData, quizState.currentMode]);

  const prevQuestion = useCallback(() => {
    const hasPrev = quizEngine.prevQuestion();
    if (hasPrev) {
      setQuizState((prev) => ({
        ...prev,
        currentQuestion: quizEngine.getCurrentQuestion(),
      }));

      if (quizState.currentMode === "quiz") {
        timer.reset(quizState.quizData.timer);
        timer.start();
      }
    }
  }, [quizState.quizData, quizState.currentMode]);

  const flipFlashcard = useCallback(() => {
    quizEngine.flipFlashcard();
    setQuizState((prev) => ({
      ...prev,
      currentQuestion: quizEngine.getCurrentQuestion(),
    }));
  }, []);

  const pauseQuiz = useCallback(() => {
    quizEngine.pauseQuiz();
    timer.pause();
    setQuizState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resumeQuiz = useCallback(() => {
    quizEngine.resumeQuiz();
    timer.resume();
    setQuizState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const finishQuiz = useCallback(() => {
    quizEngine.finishQuiz();
    timer.stop();
    setQuizState((prev) => ({
      ...prev,
      isFinished: true,
      showResults: true,
      isPaused: false,
    }));
  }, []);

  const handleTimeUp = useCallback(() => {
    showNotification("انتهى وقت السؤال!", "warning");
    nextQuestion();
  }, [nextQuestion]);

  const handleTimerTick = useCallback((remainingTime) => {
    // يمكن استخدام هذه الدالة لتحديث واجهة المؤقت
  }, []);

  return {
    quizState,
    initializeQuiz,
    answerQuestion,
    nextQuestion,
    prevQuestion,
    flipFlashcard,
    pauseQuiz,
    resumeQuiz,
    finishQuiz,
    getResults: quizEngine.getResults,
  };
};
