import { useState, useCallback } from "react";

export const useFileSystem = () => {
  const [currentFile, setCurrentFile] = useState(null);

  const openFilePicker = useCallback(async () => {
    try {
      // محاكاة اختيار ملف (سيتم استبدالها بالتنفيذ الفعلي)
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.onchange = (event) => {
          const file = event.target.files[0];
          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              try {
                const data = JSON.parse(e.target.result);
                setCurrentFile({ file, data });
                resolve({ file, data });
              } catch (error) {
                throw new Error("ملف JSON غير صالح");
              }
            };

            reader.onerror = () => {
              throw new Error("فشل في قراءة الملف");
            };

            reader.readAsText(file);
          }
        };

        input.click();
      });
    } catch (error) {
      throw error;
    }
  }, []);

  const loadJsonFile = useCallback(async (filename) => {
    try {
      // في بيئة الإنتاج، سيتم جلب الملف من الخادم
      const response = await fetch(`/api/files/${filename}`);
      if (!response.ok) {
        throw new Error("فشل في تحميل الملف");
      }

      const data = await response.json();
      setCurrentFile({ filename, data });
      return data;
    } catch (error) {
      throw error;
    }
  }, []);

  return {
    currentFile,
    openFilePicker,
    loadJsonFile,
  };
};
