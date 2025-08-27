// حالة نظام الملفات
const fsState = {
    hasFileSystemAccess: false,
    currentFileHandle: null,
    isSaving: false,
    pendingOperations: [],
    permissionCache: new Map()
};

// تهيئة نظام الملفات
export async function initFileSystem() {
    try {
        // التحقق من دعم File System Access API
        fsState.hasFileSystemAccess = 
            'showOpenFilePicker' in window && 
            'showSaveFilePicker' in window;
        
        if (!fsState.hasFileSystemAccess) {
            console.warn('File System Access API غير مدعوم في هذا المتصفح');
            setupFallbackFileSystem();
            return;
        }
        
        console.log('تم تهيئة نظام الملفات بنجاح');
        
        // محاولة استعادة آخر ملف تم فتحه (إن وجد)
        await restoreLastFile();
        
    } catch (error) {
        console.error('فشل في تهيئة نظام الملفات:', error);
        setupFallbackFileSystem();
    }
}

// إعداد نظام ملفات بديل
function setupFallbackFileSystem() {
    console.log('جاري إعداد نظام ملفات بديل...');
    // هنا يمكن تنفيذ حل بديل باستخدام localStorage أو IndexedDB
}

// فتح ملف JSON
export async function openJsonFile(filename = null) {
    if (!fsState.hasFileSystemAccess) {
        return openJsonFileFallback(filename);
    }
    
    try {
        const options = {
            types: [
                {
                    description: 'JSON Files',
                    accept: {
                        'application/json': ['.json']
                    }
                }
            ],
            multiple: false
        };
        
        // إذا كان هناك اسم ملف محدد، نضيفه إلى الاقتراحات
        if (filename) {
            options.suggestedName = filename;
            options.startIn = undefined; // استخدام المسار الافتراضي
        }
        
        const fileHandles = await window.showOpenFilePicker(options);
        const fileHandle = fileHandles[0];
        
        // التحقق من صلاحيات الملف
        if (await verifyFilePermissions(fileHandle)) {
            const file = await fileHandle.getFile();
            const contents = await file.text();
            
            let data;
            try {
                data = JSON.parse(contents);
            } catch (parseError) {
                throw new Error('ملف JSON غير صالح');
            }
            
            // حفظ المقبض للملف لاستخدامه لاحقاً
            fsState.currentFileHandle = fileHandle;
            
            // حفظ المرجع للملف لاستعادته لاحقاً
            saveFileReference(fileHandle);
            
            return { data, fileHandle };
        } else {
            throw new Error('لا توجد صلاحيات كافية لقراءة الملف');
        }
    } catch (error) {
        console.error('فشل في فتح الملف:', error);
        
        // إذا كان المستخدم ألغى العملية، لا نعرض خطأ
        if (error.name === 'AbortError') {
            return null;
        }
        
        throw error;
    }
}

// حفظ ملف JSON
export async function saveJsonFile(fileHandle, data) {
    if (!fsState.hasFileSystemAccess) {
        return saveJsonFileFallback(fileHandle, data);
    }
    
    // إذا كان هناك عملية حفظ جارية، نضيف العملية إلى قائمة الانتظار
    if (fsState.isSaving) {
        return new Promise((resolve, reject) => {
            fsState.pendingOperations.push({ fileHandle, data, resolve, reject });
        });
    }
    
    fsState.isSaving = true;
    
    try {
        // إنشاء نسخة احتياطية قبل الحفظ
        await createBackup(fileHandle);
        
        // إنشاء كاتب للملف
        const writable = await fileHandle.createWritable();
        
        // تحويل البيانات إلى تنسيق JSON مع مسافات بادئة
        const jsonData = JSON.stringify(data, null, 2);
        
        // كتابة المحتوى إلى الملف
        await writable.write(jsonData);
        
        // إغلاق الكاتب
        await writable.close();
        
        console.log('تم حفظ الملف بنجاح');
        
        // تحديث الوقت الأخير للتعديل
        updateLastModified(fileHandle);
        
        return true;
    } catch (error) {
        console.error('فشل في حفظ الملف:', error);
        
        // محاولة استعادة النسخة الاحتياطية
        try {
            await restoreBackup(fileHandle);
        } catch (restoreError) {
            console.error('فشل في استعادة النسخة الاحتياطية:', restoreError);
        }
        
        throw error;
    } finally {
        fsState.isSaving = false;
        
        // معالجة العمليات المنتظرة
        if (fsState.pendingOperations.length > 0) {
            const nextOperation = fsState.pendingOperations.shift();
            saveJsonFile(nextOperation.fileHandle, nextOperation.data)
                .then(nextOperation.resolve)
                .catch(nextOperation.reject);
        }
    }
}

// حفظ ملف جديد
export async function saveNewJsonFile(data, suggestedName = 'quiz.json') {
    if (!fsState.hasFileSystemAccess) {
        return saveNewJsonFileFallback(data, suggestedName);
    }
    
    try {
        const options = {
            types: [
                {
                    description: 'JSON Files',
                    accept: {
                        'application/json': ['.json']
                    }
                }
            ],
            suggestedName
        };
        
        const fileHandle = await window.showSaveFilePicker(options);
        
        // حفظ الملف
        await saveJsonFile(fileHandle, data);
        
        // حفظ المرجع للملف
        saveFileReference(fileHandle);
        
        return fileHandle;
    } catch (error) {
        console.error('فشل في حفظ الملف الجديد:', error);
        
        // إذا كان المستخدم ألغى العملية، لا نعرض خطأ
        if (error.name === 'AbortError') {
            return null;
        }
        
        throw error;
    }
}

// التحقق من صلاحيات الملف
async function verifyFilePermissions(fileHandle, readWrite = false) {
    const cacheKey = `${fileHandle.name}-${readWrite ? 'rw' : 'r'}`;
    
    // التحقق من الذاكرة المخبأة أولاً
    if (fsState.permissionCache.has(cacheKey)) {
        return fsState.permissionCache.get(cacheKey);
    }
    
    const options = {};
    if (readWrite) {
        options.mode = 'readwrite';
    }
    
    // التحقق من الصلاحيات الحالية
    let granted = false;
    if (await fileHandle.queryPermission(options) === 'granted') {
        granted = true;
    } else {
        // طلب الصلاحيات إذا لم تكن ممنوحة
        if (await fileHandle.requestPermission(options) === 'granted') {
            granted = true;
        }
    }
    
    // تخزين القرار في الذاكرة المخبأة
    fsState.permissionCache.set(cacheKey, granted);
    
    return granted;
}

// إنشاء نسخة احتياطية
async function createBackup(fileHandle) {
    try {
        const file = await fileHandle.getFile();
        const contents = await file.text();
        
        // استخدام IndexedDB للنسخ الاحتياطي إذا كان متاحاً
        if ('indexedDB' in window) {
            await saveBackupToIndexedDB(fileHandle.name, contents);
        } else {
            // استخدام localStorage كبديل
            const backupKey = `backup_${fileHandle.name}`;
            localStorage.setItem(backupKey, contents);
        }
        
        console.log('تم إنشاء نسخة احتياطية');
    } catch (error) {
        console.warn('فشل في إنشاء نسخة احتياطية:', error);
    }
}

// استعادة النسخة الاحتياطية
async function restoreBackup(fileHandle) {
    try {
        let backupContents = null;
        
        if ('indexedDB' in window) {
            backupContents = await getBackupFromIndexedDB(fileHandle.name);
        } else {
            const backupKey = `backup_${fileHandle.name}`;
            backupContents = localStorage.getItem(backupKey);
        }
        
        if (backupContents) {
            const writable = await fileHandle.createWritable();
            await writable.write(backupContents);
            await writable.close();
            
            console.log('تم استعادة النسخة الاحتياطية');
            return true;
        }
    } catch (error) {
        console.error('فشل في استعادة النسخة الاحتياطية:', error);
    }
    
    return false;
}

// حفظ النسخة الاحتياطية في IndexedDB
async function saveBackupToIndexedDB(filename, contents) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuizAppBackups', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['backups'], 'readwrite');
            const store = transaction.objectStore('backups');
            
            const backup = {
                filename,
                contents,
                timestamp: Date.now()
            };
            
            const putRequest = store.put(backup);
            
            putRequest.onerror = () => reject(putRequest.error);
            putRequest.onsuccess = () => resolve();
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore('backups', { keyPath: 'filename' });
        };
    });
}

// استعادة النسخة الاحتياطية من IndexedDB
async function getBackupFromIndexedDB(filename) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuizAppBackups', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['backups'], 'readonly');
            const store = transaction.objectStore('backups');
            
            const getRequest = store.get(filename);
            
            getRequest.onerror = () => reject(getRequest.error);
            getRequest.onsuccess = () => {
                if (getRequest.result) {
                    resolve(getRequest.result.contents);
                } else {
                    resolve(null);
                }
            };
        };
    });
}

// حفظ مرجع الملف لاستعادته لاحقاً
function saveFileReference(fileHandle) {
    try {
        const fileInfo = {
            name: fileHandle.name,
            lastModified: Date.now()
        };
        
        localStorage.setItem('lastOpenedFile', JSON.stringify(fileInfo));
    } catch (error) {
        console.warn('فشل في حفظ مرجع الملف:', error);
    }
}

// استعادة آخر ملف تم فتحه
async function restoreLastFile() {
    try {
        const fileInfoStr = localStorage.getItem('lastOpenedFile');
        if (!fileInfoStr) return;
        
        const fileInfo = JSON.parse(fileInfoStr);
        
        // محاولة فتح الملف إذا كان عمره أقل من 7 أيام
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        if (fileInfo.lastModified > sevenDaysAgo) {
            // في File System Access API الحالي، لا يمكننا فتح الملف مباشرة من الاسم
            // سنقوم بحفظ المعلومات فقط لعرضها للمستخدم
            console.log('آخر ملف تم فتحه:', fileInfo.name);
        }
    } catch (error) {
        console.warn('فشل في استعادة آخر ملف:', error);
    }
}

// تحديث وقت التعديل الأخير
function updateLastModified(fileHandle) {
    try {
        const fileInfoStr = localStorage.getItem('lastOpenedFile');
        if (fileInfoStr) {
            const fileInfo = JSON.parse(fileInfoStr);
            if (fileInfo.name === fileHandle.name) {
                fileInfo.lastModified = Date.now();
                localStorage.setItem('lastOpenedFile', JSON.stringify(fileInfo));
            }
        }
    } catch (error) {
        console.warn('فشل في تحديث وقت التعديل:', error);
    }
}

// الحصول على معلومات الملف الحالي
export function getCurrentFileInfo() {
    if (!fsState.currentFileHandle) return null;
    
    return {
        name: fsState.currentFileHandle.name,
        handle: fsState.currentFileHandle
    };
}

// بدائل عند عدم دعم File System Access API
async function openJsonFileFallback(filename) {
    console.log('استخدام نظام الملفات البديل لفتح الملف');
    
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        if (filename) {
            input.setAttribute('name', filename);
        }
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) {
                reject(new Error('لم يتم اختيار ملف'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve({ data, fileHandle: null });
                } catch (error) {
                    reject(new Error('ملف JSON غير صالح'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('فشل في قراءة الملف'));
            };
            
            reader.readAsText(file);
        };
        
        input.oncancel = () => {
            reject(new Error('تم إلغاء عملية فتح الملف'));
        };
        
        input.click();
    });
}

async function saveJsonFileFallback(fileHandle, data) {
    console.log('استخدام نظام الملفات البديل لحفظ الملف');
    
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileHandle || 'quiz.json';
    a.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    return true;
}

async function saveNewJsonFileFallback(data, suggestedName) {
    return saveJsonFileFallback(suggestedName, data);
}

// تصدير واجهة موحدة للتعامل مع نظام الملفات
export const fileSystem = {
    init: initFileSystem,
    openFile: openJsonFile,
    saveFile: saveJsonFile,
    saveNewFile: saveNewJsonFile,
    getCurrentFile: getCurrentFileInfo,
    hasAccess: () => fsState.hasFileSystemAccess
};

// تهيئة نظام الملفات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initFileSystem().catch(error => {
            console.error('فشل في تهيئة نظام الملفات:', error);
        });
    }, 1000);
});

export default fileSystem;