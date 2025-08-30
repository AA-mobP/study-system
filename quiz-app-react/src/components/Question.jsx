import React from "react";
import "./Question.css";

const Question = ({ question, onAnswer }) => {
  const handleAnswerClick = (selectedAnswer) => {
    onAnswer(selectedAnswer);
  };

  return (
    <div className="question">
      <h3 className="question-text">{question.data.question}</h3>
      <div className="answers">
        {question.data.answers.map((answer, index) => (
          <button
            key={index}
            className="answer-btn"
            onClick={() => handleAnswerClick(answer)}
            data-answer={answer}
          >
            {answer}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Question;
