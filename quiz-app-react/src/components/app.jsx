import React, { useState, useEffect, useCallback } from "react";
import Header from "./components/Header/Header";
import QuizContainer from "./components/Quiz/QuizContainer";
import Results from "./components/Results/Results";
import Notification from "./components/Notification/Notification";
import Loading from "./components/common/Loading/Loading";
import { useQuiz } from "./hooks/useQuiz";
import { useFileSystem } from "./hooks/useFileSystem";
import { useNotification } from "./hooks/useNotification";
import "./styles/App.css";

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  const {
    quizState,
    initializeQuiz,
    answerQuestion,
    nextQuestion,
    prevQuestion,
    flipFlashcard,
    pauseQuiz,
    resumeQuiz,
    finishQuiz,
    getResults,
  } = useQuiz();

  const { loadJsonFile, openFilePicker } = useFileSystem();
  const { notifications, showNotification } = useNotification();

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  const handleStartQuiz = useCallback(
    async (username, quizData) => {
      try {
        await initializeQuiz(quizData, username);
        showNotification("تم بدء الاختبار بنجاح!", "success");
      } catch (error) {
        showNotification("فشل في بدء الاختبار: " + error.message, "error");
      }
    },
    [initializeQuiz, showNotification]
  );

  const handleDarkModeToggle = useCallback(() => {
    setDarkMode((prev) => !prev);
    showNotification(
      `تم التبديل إلى الوضع ${!darkMode ? "الداكن" : "الفاتح"}`,
      "info"
    );
  }, [darkMode, showNotification]);

  return (
    <div className={`app ${darkMode ? "dark-mode" : ""}`}>
      <Header
        darkMode={darkMode}
        onDarkModeToggle={handleDarkModeToggle}
        onLoadFile={openFilePicker}
        onStartQuiz={handleStartQuiz}
        quizData={quizState.quizData}
      />

      <main className="main-content">
        {quizState.loading && <Loading message={quizState.loadingMessage} />}

        {notifications.map((notification, index) => (
          <Notification
            key={index}
            message={notification.message}
            type={notification.type}
            duration={notification.duration}
          />
        ))}

        {!quizState.showResults ? (
          <QuizContainer
            quizState={quizState}
            onAnswer={answerQuestion}
            onNext={nextQuestion}
            onPrev={prevQuestion}
            onFlip={flipFlashcard}
            onPause={pauseQuiz}
            onResume={resumeQuiz}
            onFinish={finishQuiz}
          />
        ) : (
          <Results
            results={getResults()}
            onRestart={() => window.location.reload()}
          />
        )}
      </main>
    </div>
  );
}

export default App;
