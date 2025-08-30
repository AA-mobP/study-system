import React from "react";
import "./Navigation.css";

const Navigation = ({
  currentMode,
  currentIndex,
  totalItems,
  isPaused,
  onNext,
  onPrev,
  onPause,
  onResume,
  onFinish,
}) => {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalItems - 1;

  return (
    <nav id="navigation" role="navigation" aria-label="التنقل في الاختبار">
      <button
        id="prev-btn"
        type="button"
        disabled={isFirst}
        onClick={onPrev}
        aria-label="الانتقال إلى السؤال السابق"
      >
        ⬅️ السابق
      </button>

      {currentMode === "flashcard" && (
        <button
          id="flip-btn"
          type="button"
          onClick={onFlip}
          aria-label="قلب البطاقة لرؤية الإجابة"
        >
          🔄 قلب البطاقة
        </button>
      )}

      <button
        id="next-btn"
        type="button"
        onClick={isLast ? onFinish : onNext}
        aria-label={isLast ? "إنهاء الاختبار" : "الانتقال إلى السؤال التالي"}
      >
        {isLast ? "إنهاء الاختبار" : "التالي ➡️"}
      </button>

      {currentMode === "quiz" && (
        <button
          id="pause-btn"
          type="button"
          onClick={isPaused ? onResume : onPause}
          aria-label={isPaused ? "استئناف الاختبار" : "إيقاف الاختبار مؤقتاً"}
        >
          {isPaused ? "استئناف" : "إيقاف مؤقت"}
        </button>
      )}
    </nav>
  );
};

export default Navigation;
