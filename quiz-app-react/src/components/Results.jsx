import React from "react";
import "./Results.css";

const Results = ({ results, onRestart }) => {
  if (!results) {
    return (
      <section id="results" className="results">
        <div className="no-results">
          <h2>لا توجد نتائج لعرضها</h2>
          <p>يبدو أنه لم يتم إكمال أي اختبار بعد.</p>
        </div>
      </section>
    );
  }

  const {
    username,
    quizTitle,
    totalQuestions,
    correct,
    wrong,
    scorePercent,
    totalTimeSec,
    performanceLevel,
  } = results;

  return (
    <section id="results" className="results">
      <h2>نتيجة الاختبار</h2>

      <div id="stats" className="stats">
        <div className="stat-item">
          <span className="stat-label">اسم المستخدم:</span>
          <span className="stat-value">{username}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">عنوان الاختبار:</span>
          <span className="stat-value">{quizTitle}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">عدد الأسئلة:</span>
          <span className="stat-value">{totalQuestions}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">الإجابات الصحيحة:</span>
          <span className="stat-value">{correct}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">الإجابات الخاطئة:</span>
          <span className="stat-value">{wrong}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">النسبة المئوية:</span>
          <span className="stat-value">{scorePercent.toFixed(1)}%</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">الوقت المستغرق:</span>
          <span className="stat-value">
            {Math.floor(totalTimeSec / 60)}:
            {(totalTimeSec % 60).toString().padStart(2, "0")}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">مستوى الأداء:</span>
          <span className="stat-value">{performanceLevel}</span>
        </div>
      </div>

      <div className="results-actions">
        <button id="restart-btn" onClick={onRestart} className="primary">
          🔄 إعادة الاختبار
        </button>
      </div>
    </section>
  );
};

export default Results;
