import React from "react";
import "./Flashcard.css";

const Flashcard = ({ card, isFlipped, onFlip }) => {
  const handleClick = () => {
    onFlip();
  };

  return (
    <div
      className={`flashcard ${isFlipped ? "flipped" : ""}`}
      onClick={handleClick}
      role="button"
      aria-label={isFlipped ? "إخفاء الإجابة" : "عرض الإجابة"}
      tabIndex={0}
      onKeyPress={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="flashcard-inner">
        <div className="flashcard-front">
          <h3>{card.data.question}</h3>
          <p className="flashcard-hint">انقر أو اضغط Enter لرؤية الإجابة</p>
        </div>
        <div className="flashcard-back">
          <p>{card.data.answer}</p>
          {card.data.hint && <p className="flashcard-hint">{card.data.hint}</p>}
        </div>
      </div>
    </div>
  );
};

export default Flashcard;
