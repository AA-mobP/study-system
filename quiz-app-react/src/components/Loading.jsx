import React from "react";
import "./Loading.css";

const Loading = ({ message = "جارٍ التحميل..." }) => {
  return (
    <div id="loading-overlay" className="loading-visible">
      <div className="loading-content">
        <div className="spinner" aria-hidden="true"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};

export default Loading;
