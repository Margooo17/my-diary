// 数据存储管理模块
const Storage = {
    // 存储限制常量
    LIMITS: {
        WARNING_COUNT: 1500,  // 警告阈值
        CRITICAL_COUNT: 2000, // 临界阈值
    },

    // 获取所有日记
    getAllDiaries() {
        const diaries = localStorage.getItem('diaries');
        return diaries ? JSON.parse(diaries) : [];
    },

    // 获取存储统计信息
    getStorageStats() {
        const diaries = this.getAllDiaries();
        const totalCount = diaries.length;
        
        // 按年份分组统计
        const yearlyStats = diaries.reduce((stats, diary) => {
            const year = new Date(diary.createdAt).getFullYear();
            if (!stats[year]) {
                stats[year] = {
                    count: 0,
                    totalBytes: 0
                };
            }
            stats[year].count++;
            // 估算单篇日记大小
            const diarySize = JSON.stringify(diary).length;
            stats[year].totalBytes += diarySize;
            return stats;
        }, {});

        // 计算总存储大小
        const totalBytes = Object.values(yearlyStats).reduce(
            (sum, stat) => sum + stat.totalBytes, 0
        );

        // 检查是否需要备份提醒
        const needsBackup = totalCount >= this.LIMITS.WARNING_COUNT;
        const isNearLimit = totalCount >= this.LIMITS.CRITICAL_COUNT;

        return {
            totalCount,
            totalBytes,
            yearlyStats,
            needsBackup,
            isNearLimit,
            remainingCount: this.LIMITS.CRITICAL_COUNT - totalCount
        };
    },

    // 保存所有日记
    saveAllDiaries(diaries) {
        // 为每条日记添加最后修改时间
        const updatedDiaries = diaries.map(diary => {
            if (!diary.lastModified) {
                diary.lastModified = new Date().toISOString();
            }
            return diary;
        });
        
        localStorage.setItem('diaries', JSON.stringify(updatedDiaries));
        
        // 检查并显示存储警告
        const stats = this.getStorageStats();
        if (stats.needsBackup) {
            this.showStorageWarning(stats);
        }
    },

    // 显示存储警告
    showStorageWarning(stats) {
        if (stats.isNearLimit) {
            alert(`⚠️ 警告：您的日记数量已达到${stats.totalCount}篇，即将达到存储上限！\n\n` +
                  `建议立即备份数据并清理旧日记。\n` +
                  `您可以按年份导出数据，然后删除较早的日记。`);
        } else if (stats.needsBackup) {
            alert(`提示：您的日记数量已达到${stats.totalCount}篇。\n\n` +
                  `建议及时备份数据，以防意外丢失。\n` +
                  `您还可以存储约${stats.remainingCount}篇日记。`);
        }
    },

    // 添加新日记
    addDiary(diary) {
        const diaries = this.getAllDiaries();
        const newDiary = {
            id: Date.now().toString(),
            content: diary.content,
            tags: diary.tags || [],
            comments: [], // 初始化评论数组
            createdAt: new Date().toISOString()
        };
        diaries.unshift(newDiary);
        this.saveAllDiaries(diaries);
        return newDiary;
    },

    // 更新日记
    updateDiary(id, updatedDiary) {
        const diaries = this.getAllDiaries();
        const index = diaries.findIndex(diary => diary.id === id);
        if (index !== -1) {
            diaries[index] = { ...diaries[index], ...updatedDiary };
            this.saveAllDiaries(diaries);
            return diaries[index];
        }
        return null;
    },

    // 删除日记
    deleteDiary(id) {
        const diaries = this.getAllDiaries();
        const filteredDiaries = diaries.filter(diary => diary.id !== id);
        this.saveAllDiaries(filteredDiaries);
    },

    // 按年份获取日记
    getDiariesByYear(year) {
        const diaries = this.getAllDiaries();
        return diaries.filter(diary => 
            new Date(diary.createdAt).getFullYear() === year
        );
    },

    // 按年份导出数据
    exportDataByYear(year) {
        const diaries = this.getDiariesByYear(year);
        
        // 创建自定义弹窗
        const dialog = document.createElement('div');
        dialog.className = 'export-dialog modal-overlay';
        dialog.innerHTML = `
            <div class="export-modal">
                <div class="modal-header">
                    <h3>导出 ${year} 年数据</h3>
                    <button class="close-export-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <p>请选择导出格式：</p>
                    <div class="export-option-group">
                        <div class="export-option">
                            <input type="radio" id="export-year-pdf" name="export-year-format" value="pdf">
                            <label for="export-year-pdf">PDF格式</label>
                        </div>
                        <div class="export-option">
                            <input type="radio" id="export-year-json" name="export-year-format" value="json">
                            <label for="export-year-json">JSON格式</label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="export-year-confirm-btn" class="primary-btn">导出数据</button>
                    <button id="export-year-cancel-btn" class="cancel-btn">取消</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 添加事件监听
        // 关闭按钮
        const closeBtn = dialog.querySelector('.close-export-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 取消按钮
        const cancelBtn = dialog.querySelector('#export-year-cancel-btn');
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 确认导出按钮
        const confirmBtn = dialog.querySelector('#export-year-confirm-btn');
        confirmBtn.addEventListener('click', () => {
            // 获取选中的导出格式
            const formatEl = dialog.querySelector('input[name="export-year-format"]:checked');
            const format = formatEl ? formatEl.value : null;
            
            // 检查用户是否已选择导出格式
            if (!format) {
                alert('请选择导出格式（PDF或JSON）');
                return;
            }
            
            // 关闭弹窗
            document.body.removeChild(dialog);
            
            // 执行导出
            if (format === 'pdf') {
                this.exportToPdf(diaries, `日记本-${year}年`);
            } else {
                this.downloadJSON(diaries, `diary-backup-${year}.json`);
            }
        });
    },
    
    // 将数据导出为JSON并下载
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // 导出所有数据
    exportData() {
        const stats = this.getStorageStats();
        const years = Object.keys(stats.yearlyStats).sort();
        
        // 创建自定义弹窗而不是使用confirm
        this.showExportDialog(stats, years);
    },
    
    // 显示自定义导出弹窗
    showExportDialog(stats, years) {
        // 创建弹窗元素
        const dialog = document.createElement('div');
        dialog.className = 'export-dialog modal-overlay';
        
        let dialogContent = `
            <div class="export-modal">
                <div class="modal-header">
                    <h3>导出数据</h3>
                    <button class="close-export-btn">&times;</button>
                </div>
                <div class="modal-body">
        `;
        
        // 添加统计信息
        dialogContent += `<p class="export-stats">您目前共有 <strong>${stats.totalCount}</strong> 篇日记`;
        
        if (years.length > 1) {
            dialogContent += `，跨越 <strong>${years.length}</strong> 个年份（${years[0]}~${years[years.length-1]}）`;
        }
        
        dialogContent += `</p>`;
        
        // 添加选项
        dialogContent += `
                    <div class="export-options">
                        <h4>请选择导出方式：</h4>
                        <div class="export-option-group">
        `;
        
        // 仅当有多个年份时显示按年份导出选项
        if (years.length > 1) {
            dialogContent += `
                            <div class="export-option">
                                <input type="radio" id="export-by-year" name="export-mode" value="by-year">
                                <label for="export-by-year">按年份分别导出</label>
                            </div>
            `;
        }
        
        dialogContent += `
                            <div class="export-option">
                                <input type="radio" id="export-all" name="export-mode" value="all" ${years.length <= 1 ? '' : ''}>
                                <label for="export-all">导出全部数据</label>
                            </div>
                        </div>
                        
                        <h4>请选择导出格式：</h4>
                        <div class="export-option-group">
                            <div class="export-option">
                                <input type="radio" id="export-pdf" name="export-format" value="pdf">
                                <label for="export-pdf">PDF格式</label>
                            </div>
                            <div class="export-option">
                                <input type="radio" id="export-json" name="export-format" value="json">
                                <label for="export-json">JSON格式</label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="export-confirm-btn" class="primary-btn">导出数据</button>
                    <button id="export-cancel-btn" class="cancel-btn">取消</button>
                </div>
            </div>
        `;
        
        dialog.innerHTML = dialogContent;
        document.body.appendChild(dialog);
        
        // 添加事件监听
        // 关闭按钮
        const closeBtn = dialog.querySelector('.close-export-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 取消按钮
        const cancelBtn = dialog.querySelector('#export-cancel-btn');
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 确认导出按钮
        const confirmBtn = dialog.querySelector('#export-confirm-btn');
        confirmBtn.addEventListener('click', () => {
            // 获取选中的导出模式
            const exportModeEl = dialog.querySelector('input[name="export-mode"]:checked');
            const exportMode = exportModeEl ? exportModeEl.value : null;
            
            // 获取选中的导出格式
            const exportFormatEl = dialog.querySelector('input[name="export-format"]:checked');
            const exportFormat = exportFormatEl ? exportFormatEl.value : null;
            
            // 检查用户是否已选择导出方式（当有多个年份时）
            if (years.length > 1 && !exportMode) {
                alert('请选择导出方式（按年份分别导出或导出全部数据）');
                return;
            }
            
            // 检查用户是否已选择导出格式
            if (!exportFormat) {
                alert('请选择导出格式（PDF或JSON）');
                return;
            }
            
            // 关闭弹窗
            document.body.removeChild(dialog);
            
            // 执行导出
            if (exportMode === 'by-year' && years.length > 1) {
                // 按年份导出
                years.forEach(year => {
                    const yearDiaries = this.getDiariesByYear(parseInt(year));
                    if (exportFormat === 'pdf') {
                        this.exportToPdf(yearDiaries, `日记本-${year}年`);
                    } else {
                        this.downloadJSON(yearDiaries, `diary-backup-${year}.json`);
                    }
                });
            } else {
                // 导出全部数据
                const data = this.getAllDiaries();
                if (exportFormat === 'pdf') {
                    this.exportToPdf(data, `日记本-全部日记-${new Date().toISOString().split('T')[0]}`);
                } else {
                    this.downloadJSON(data, `diary-backup-${new Date().toISOString().split('T')[0]}.json`);
                }
            }
        });
    },

    // 导入数据
    importData(jsonData) {
        try {
            // 尝试作为JSON解析
            const data = JSON.parse(jsonData);
            if (Array.isArray(data)) {
                // 检查导入后是否会超出限制
                const currentCount = this.getAllDiaries().length;
                const importCount = data.length;
                const totalCount = currentCount + importCount;
                
                if (totalCount > this.LIMITS.CRITICAL_COUNT) {
                    alert(`警告：导入的${importCount}篇日记加上现有的${currentCount}篇日记，` +
                          `将超出${this.LIMITS.CRITICAL_COUNT}篇的存储限制。\n\n` +
                          `建议先清理一些旧日记，或者分批导入。`);
                    return false;
                }
                
                // 合并并按时间排序
                const allDiaries = [...data, ...this.getAllDiaries()].sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                
                this.saveAllDiaries(allDiaries);
                return true;
            }
            return false;
        } catch (error) {
            // JSON解析失败，尝试作为纯文本处理
            console.log('JSON解析失败，尝试作为纯文本处理');
            return this.importFromText(jsonData);
        }
    },
    
    // 从纯文本导入日记
    importFromText(text) {
        if (!text || typeof text !== 'string' || text.trim() === '') {
            alert('导入的文本内容为空');
            return false;
        }
        
        // 分割出可能的日记条目
        const diaries = this.parseTextToDiaries(text);
        
        if (diaries.length === 0) {
            alert('未能从文本中识别出有效的日记内容');
            return false;
        }
        
        // 检查导入后是否会超出限制
        const currentCount = this.getAllDiaries().length;
        const importCount = diaries.length;
        const totalCount = currentCount + importCount;
        
        if (totalCount > this.LIMITS.CRITICAL_COUNT) {
            alert(`警告：识别出的${importCount}篇日记加上现有的${currentCount}篇日记，` +
                  `将超出${this.LIMITS.CRITICAL_COUNT}篇的存储限制。\n\n` +
                  `建议先清理一些旧日记，或者分批导入。`);
            return false;
        }
        
        // 合并现有日记，并按创建时间降序排序
        const allDiaries = [...diaries, ...this.getAllDiaries()].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        this.saveAllDiaries(allDiaries);
        alert(`成功从文本中导入了 ${diaries.length} 篇日记`);
        return true;
    },
    
    // 将文本解析为日记数组
    parseTextToDiaries(text) {
        const diaries = [];
        
        // 常见的日期格式正则表达式
        const datePatterns = [
            // yyyy-mm-dd 或 yyyy/mm/dd 格式 (带可选时间)
            /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})(?:\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?\s*[:\n]/,
            // yyyy年mm月dd日 格式 (带可选时间)
            /(\d{4}年\d{1,2}月\d{1,2}日)(?:\s+(\d{1,2}[点時时](?:\d{1,2}分)?(?:\d{1,2}秒)?))?\s*[:\n]/,
            // mm月dd日 格式 (带可选时间和年份)
            /(\d{1,2}月\d{1,2}日)(?:\s+(\d{1,2}[点時时](?:\d{1,2}分)?(?:\d{1,2}秒)?))?\s*[:\n]/,
            // dd/mm/yyyy 或 mm/dd/yyyy 格式 (带可选时间)
            /(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?\s*[:\n]/,
            // 星期X + 日期可选格式
            /([星期周][一二三四五六日末天])\s*[,，]?\s*(\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}[日]?)(?:\s+(\d{1,2}[:点時时]\d{1,2}(?:[:分]\d{1,2}(?:秒)?)?))?\s*[:\n]/,
        ];
        
        // 以可能的日期模式分割文本
        let segments = [text];
        let allMatches = [];
        
        // 对每种日期模式查找匹配
        datePatterns.forEach(pattern => {
            // 在文本中查找所有匹配
            const matches = [];
            let match;
            let tempText = text;
            let offset = 0;
            
            while ((match = pattern.exec(tempText)) !== null) {
                const fullMatch = match[0];
                const dateStr = match[1]; // 日期部分
                const timeStr = match[2] || ''; // 时间部分（可能为undefined）
                const position = match.index + offset;
                
                matches.push({
                    dateStr,
                    timeStr,
                    position,
                    fullMatch
                });
                
                // 更新临时文本和偏移量以继续搜索
                tempText = tempText.substring(match.index + fullMatch.length);
                offset += match.index + fullMatch.length;
            }
            
            // 添加到所有匹配中
            if (matches.length > 0) {
                allMatches = [...allMatches, ...matches];
            }
        });
        
        // 按位置排序所有匹配
        allMatches.sort((a, b) => a.position - b.position);
        
        // 使用匹配位置分割文本
        if (allMatches.length > 0) {
            segments = [];
            let lastPos = 0;
            
            allMatches.forEach((match, index) => {
                // 跳过太近的匹配（可能是误检测）
                if (index > 0 && match.position - allMatches[index-1].position < 10) {
                    return;
                }
                
                // 提取当前匹配之前的文本作为上一篇日记的内容
                if (index > 0 || match.position > 0) {
                    const prevContent = text.substring(lastPos, match.position).trim();
                    if (prevContent) {
                        segments.push({
                            content: prevContent,
                            dateMatch: index > 0 ? allMatches[index-1] : null
                        });
                    }
                }
                
                lastPos = match.position;
            });
            
            // 添加最后一个匹配之后的文本
            if (lastPos < text.length) {
                const lastContent = text.substring(lastPos).trim();
                if (lastContent) {
                    segments.push({
                        content: lastContent,
                        dateMatch: allMatches[allMatches.length-1]
                    });
                }
            }
        }
        
        // 处理分割的片段，创建日记对象
        segments.forEach(segment => {
            if (typeof segment === 'string') {
                // 没有找到日期匹配，将整个文本作为一篇日记
                if (segment.trim()) {
                    diaries.push({
                        id: Date.now() + '-' + Math.floor(Math.random() * 1000),
                        content: segment.trim(),
                        tags: [],
                        comments: [],
                        createdAt: new Date().toISOString()
                    });
                }
            } else {
                // 有日期匹配的片段
                let content = segment.content.trim();
                // 移除可能被包含在内容中的日期标记
                if (segment.dateMatch) {
                    content = content.replace(segment.dateMatch.fullMatch, '').trim();
                }
                
                if (content) {
                    // 创建日期对象
                    let diaryDate = new Date();
                    
                    if (segment.dateMatch) {
                        // 尝试解析日期字符串
                        const parsedDate = this.parseDateFromString(segment.dateMatch.dateStr, segment.dateMatch.timeStr);
                        if (parsedDate) {
                            diaryDate = parsedDate;
                        }
                    }
                    
                    // 创建日记对象
                    diaries.push({
                        id: diaryDate.getTime() + '-' + Math.floor(Math.random() * 1000),
                        content: content,
                        tags: [],
                        comments: [],
                        createdAt: diaryDate.toISOString()
                    });
                }
            }
        });
        
        return diaries;
    },
    
    // 从字符串解析日期
    parseDateFromString(dateStr, timeStr) {
        try {
            let year, month, day, hours = 0, minutes = 0, seconds = 0;
            const currentYear = new Date().getFullYear();
            
            // 处理各种日期格式
            if (dateStr.includes('-') || dateStr.includes('/')) {
                // yyyy-mm-dd 或 yyyy/mm/dd 格式
                if (dateStr.match(/^\d{4}[-\/]/)) {
                    const parts = dateStr.split(/[-\/]/);
                    year = parseInt(parts[0]);
                    month = parseInt(parts[1]) - 1; // 月份从0开始
                    day = parseInt(parts[2]);
                } 
                // dd/mm/yyyy 或 mm/dd/yyyy 格式
                else if (dateStr.match(/\d{4}$/)) {
                    const parts = dateStr.split('/');
                    year = parseInt(parts[2]);
                    // 根据地区习惯判断月日顺序，这里假设是mm/dd/yyyy
                    month = parseInt(parts[0]) - 1;
                    day = parseInt(parts[1]);
                }
            } 
            // yyyy年mm月dd日 格式
            else if (dateStr.includes('年') && dateStr.includes('月') && dateStr.includes('日')) {
                const yearMatch = dateStr.match(/(\d{4})年/);
                const monthMatch = dateStr.match(/(\d{1,2})月/);
                const dayMatch = dateStr.match(/(\d{1,2})日/);
                
                if (yearMatch && monthMatch && dayMatch) {
                    year = parseInt(yearMatch[1]);
                    month = parseInt(monthMatch[1]) - 1;
                    day = parseInt(dayMatch[1]);
                }
            }
            // mm月dd日 格式 (无年份，使用当前年)
            else if (dateStr.includes('月') && dateStr.includes('日') && !dateStr.includes('年')) {
                const monthMatch = dateStr.match(/(\d{1,2})月/);
                const dayMatch = dateStr.match(/(\d{1,2})日/);
                
                if (monthMatch && dayMatch) {
                    year = currentYear; // 使用当前年份
                    month = parseInt(monthMatch[1]) - 1;
                    day = parseInt(dayMatch[1]);
                }
            }
            // 星期X格式 (通常不包含具体日期，使用当前日期)
            else if (dateStr.match(/[星期周][一二三四五六日末天]/)) {
                const today = new Date();
                year = today.getFullYear();
                month = today.getMonth();
                day = today.getDate();
            }
            
            // 处理时间格式
            if (timeStr) {
                if (timeStr.includes(':')) {
                    // 标准时间格式 HH:MM:SS
                    const timeParts = timeStr.split(':');
                    hours = parseInt(timeParts[0]);
                    minutes = parseInt(timeParts[1]);
                    if (timeParts.length > 2) {
                        seconds = parseInt(timeParts[2]);
                    }
                } else if (timeStr.match(/\d+[点時时]/)) {
                    // 中文时间格式，如 "3点30分"
                    const hourMatch = timeStr.match(/(\d+)[点時时]/);
                    const minuteMatch = timeStr.match(/(\d+)分/);
                    const secondMatch = timeStr.match(/(\d+)秒/);
                    
                    if (hourMatch) {
                        hours = parseInt(hourMatch[1]);
                    }
                    if (minuteMatch) {
                        minutes = parseInt(minuteMatch[1]);
                    }
                    if (secondMatch) {
                        seconds = parseInt(secondMatch[1]);
                    }
                }
            }
            
            // 检查解析出的日期是否有效
            if (year && !isNaN(year) && !isNaN(month) && !isNaN(day)) {
                // 创建日期对象并返回
                return new Date(year, month, day, hours, minutes, seconds);
            }
        } catch (e) {
            console.error('解析日期失败:', e);
        }
        
        // 默认返回当前日期
        return new Date();
    },

    // 添加评论
    addComment(diaryId, comment) {
        const diaries = this.getAllDiaries();
        const diary = diaries.find(d => d.id === diaryId);
        if (diary) {
            if (!Array.isArray(diary.comments)) {
                diary.comments = [];
            }
            const newComment = {
                id: Date.now().toString(),
                content: comment.content,
                createdAt: comment.createdAt
            };
            diary.comments.push(newComment);
            this.saveAllDiaries(diaries);
            return newComment;
        }
        return null;
    },

    // 删除评论
    deleteComment(diaryId, commentId) {
        const diaries = this.getAllDiaries();
        const diary = diaries.find(d => d.id === diaryId);
        if (diary && Array.isArray(diary.comments)) {
            diary.comments = diary.comments.filter(c => c.id !== commentId);
            this.saveAllDiaries(diaries);
            return true;
        }
        return false;
    },

    // 将日记格式化为PDF友好的HTML
    formatDiariesForPdf(diaries) {
        // 获取当前主题模式
        const isDarkMode = document.body.classList.contains('dark-mode');
        
        // 获取用户设置的日记本名称
        const userTitle = localStorage.getItem('diaryTitle') || '博客式日记本';
        
        // 构建HTML模板
        let html = `
            <html>
            <head>
                <title>${userTitle}</title>
                <style>
                    @page {
                        margin: 20mm 15mm;
                        size: A4;
                    }
                    html, body {
                        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                        line-height: 1.5;
                        color: ${isDarkMode ? '#f0f0f0' : '#333'};
                        background-color: ${isDarkMode ? '#2d2d2d' : '#fff'};
                        padding: 0;
                        margin: 0;
                    }
                    /* 页眉样式 */
                    .header {
                        position: running(header);
                        text-align: center;
                        font-size: 10pt;
                        color: ${isDarkMode ? '#aaa' : '#666'};
                        padding-bottom: 5mm;
                        border-bottom: 0.5pt solid ${isDarkMode ? '#444' : '#ddd'};
                    }
                    /* 在每个页面顶部应用页眉 */
                    @page {
                        @top-center {
                            content: element(header);
                        }
                    }
                    
                    /* 使用类似Word的章节结构 */
                    .date-section {
                        /* 章节总是从新页开始 */
                        page-break-before: always;
                        margin-top: 0;
                    }
                    
                    /* 日期标题样式，模仿Word标题 */
                    .date-heading {
                        font-size: 16pt;
                        font-weight: bold;
                        color: ${isDarkMode ? '#e0e0e0' : '#333'};
                        padding: 8mm 0 4mm 0;
                        margin: 0;
                        border-bottom: 1pt solid ${isDarkMode ? '#555' : '#888'};
                        /* 确保标题与内容在同一页 */
                        page-break-after: avoid;
                    }
                    
                    /* 日记条目容器 */
                    .diary-container {
                        margin: 0;
                        padding: 0;
                    }
                    
                    /* 日记条目，模仿Word段落 */
                    .diary {
                        margin: 0 0 6mm 0;
                        padding: 4mm;
                        background-color: ${isDarkMode ? '#333' : '#f9f9f9'};
                        border: 1pt solid ${isDarkMode ? '#444' : '#eee'};
                        border-radius: 2mm;
                        page-break-inside: avoid;
                        orphans: 4;
                        widows: 4;
                        break-inside: avoid;
                        display: block;
                    }
                    
                    /* 文本内联样式 - 内联时间戳 */
                    .inline-time {
                        font-weight: bold;
                        color: ${isDarkMode ? '#bbb' : '#555'};
                        padding-right: 2mm;
                        border-right: 1pt solid ${isDarkMode ? '#444' : '#bbb'};
                        margin-right: 2mm;
                        white-space: nowrap;
                        display: inline;
                    }
                    
                    /* 日记内容 */
                    .diary-content-wrapper {
                        margin-top: 2mm;
                    }
                    
                    .diary-content {
                        white-space: pre-wrap;
                        font-size: 10.5pt;
                        line-height: 1.5;
                        margin: 2mm 0;
                    }
                    
                    /* 标签区域 */
                    .diary-tags {
                        display: flex;
                        flex-wrap: wrap;
                        margin: 3mm 0 0 0;
                    }
                    
                    /* 标签 */
                    .tag {
                        font-size: 9pt;
                        background-color: ${isDarkMode ? '#444' : '#f0f0f0'};
                        color: ${isDarkMode ? '#ccc' : '#666'};
                        padding: 1mm 2mm;
                        border-radius: 2mm;
                        margin-right: 2mm;
                        margin-bottom: 1mm;
                    }
                    
                    /* 评论区域 */
                    .comments-section {
                        margin-top: 3mm;
                        padding: 2mm 0 0 3mm;
                        border-left: 1.5pt solid ${isDarkMode ? '#555' : '#ddd'};
                    }
                    
                    /* 单条评论 */
                    .comment {
                        margin-bottom: 2mm;
                    }
                    
                    /* 评论内容 */
                    .comment-content {
                        font-size: 9pt;
                        font-style: italic;
                    }
                    
                    /* 评论时间 */
                    .comment-date {
                        font-size: 8pt;
                        color: ${isDarkMode ? '#999' : '#aaa'};
                    }
                    
                    /* 封面页 */
                    .cover-page {
                        text-align: center;
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        page-break-after: always;
                    }
                    
                    /* 封面标题 */
                    .cover-title {
                        font-size: 28pt;
                        margin-bottom: 20mm;
                        color: ${isDarkMode ? '#f0f0f0' : '#333'};
                    }
                    
                    /* 封面副标题 */
                    .cover-subtitle {
                        font-size: 14pt;
                        margin-bottom: 5mm;
                        color: ${isDarkMode ? '#aaa' : '#666'};
                    }
                    
                    /* 目录容器 */
                    .toc-container {
                        page-break-before: always;
                        page-break-after: always;
                        padding: 10mm 0;
                    }
                    
                    /* 目录标题 */
                    .toc-title {
                        font-size: 18pt;
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 10mm;
                    }
                    
                    /* 目录项 */
                    .toc-item {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 2mm;
                        border-bottom: 0.5pt dotted ${isDarkMode ? '#444' : '#ccc'};
                        padding-bottom: 1mm;
                    }
                    
                    /* 目录文本 */
                    .toc-text {
                        font-size: 11pt;
                    }
                    
                    /* 目录页码 */
                    .toc-page {
                        font-size: 11pt;
                    }
                    
                    /* 日记总数 */
                    .diary-count {
                        text-align: center;
                        margin: 10mm 0;
                        font-size: 12pt;
                        color: ${isDarkMode ? '#aaa' : '#888'};
                    }
                    
                    /* 分页控制 */
                    .page-break {
                        page-break-after: always;
                        height: 0;
                        clear: both;
                    }
                    
                    /* 长内容控制 */
                    .long-content {
                        max-height: 150mm;
                        overflow: hidden;
                        position: relative;
                    }
                    
                    /* 长内容标记 */
                    .long-content::after {
                        content: "...(内容过长，部分省略)";
                        position: absolute;
                        bottom: 0;
                        right: 0;
                        background-color: ${isDarkMode ? '#333' : '#f9f9f9'};
                        padding: 0 1mm;
                        font-style: italic;
                        font-size: 9pt;
                    }
                    
                    /* 时间内容组合，强制不分离 */
                    .time-content-group {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        display: block;
                    }
                </style>
            </head>
            <body>
                <!-- 页眉将在每页显示 -->
                <div class="header">${userTitle} - 日记记录</div>
                
                <!-- 封面页 -->
                <div class="cover-page">
                    <h1 class="cover-title">${userTitle}</h1>
                    <p class="cover-subtitle">共 ${diaries.length} 篇日记记录</p>
                    <p class="cover-subtitle">导出时间：${new Date().toLocaleString()}</p>
                </div>
            `;
            
        if (diaries.length > 0) {
            // 按照日期分组
            const diariesByDate = {};
            diaries.forEach(diary => {
                const date = new Date(diary.createdAt).toLocaleDateString('zh-CN');
                if (!diariesByDate[date]) {
                    diariesByDate[date] = [];
                }
                diariesByDate[date].push(diary);
            });
            
            // 将日期按时间降序排序
            const sortedDates = Object.keys(diariesByDate).sort((a, b) => {
                return new Date(b) - new Date(a);
            });
            
            // 添加目录页
            html += `
                <div class="toc-container">
                    <h2 class="toc-title">目录</h2>
            `;
            
            // 估计页码：封面(1页) + 目录(1页) + 正文(每日一节)
            let pageCount = 2;
            sortedDates.forEach((date, index) => {
                const entries = diariesByDate[date];
                html += `
                    <div class="toc-item">
                        <span class="toc-text">${date} (${entries.length}篇)</span>
                        <span class="toc-page">${pageCount + index}</span>
                    </div>
                `;
            });
            
            html += `
                    <div class="diary-count">共 ${diaries.length} 篇日记</div>
                </div>
            `;
            
            // 添加日记内容，按日期组织成章节
            sortedDates.forEach(date => {
                // 创建日期章节
                html += `
                    <section class="date-section">
                        <h2 class="date-heading">${date}</h2>
                        <div class="diary-container">
                `;
                
                // 添加该日期下的所有日记
                diariesByDate[date].forEach(diary => {
                    const time = new Date(diary.createdAt).toLocaleTimeString('zh-CN');
                    
                    // 判断内容长度，超长内容进行特殊处理
                    const isLongContent = diary.content.length > 3000;
                    const contentClass = isLongContent ? 'diary-content long-content' : 'diary-content';
                    
                    // 重要变化：将时间作为内联元素直接和内容放在一起，而不是分离的结构
                    html += `
                        <div class="diary">
                            <div class="time-content-group">
                                <p>
                                    <span class="inline-time">${time}</span>
                                    ${diary.content}
                                </p>
                            </div>
                    `;
                    
                    // 添加标签
                    if (diary.tags && diary.tags.length > 0) {
                        html += `<div class="diary-tags">`;
                        diary.tags.forEach(tag => {
                            html += `<span class="tag">${tag}</span>`;
                        });
                        html += `</div>`;
                    }
                    
                    // 添加评论
                    if (diary.comments && diary.comments.length > 0) {
                        html += `<div class="comments-section">`;
                        diary.comments.forEach(comment => {
                            const commentTime = new Date(comment.createdAt).toLocaleTimeString('zh-CN');
                            
                            html += `
                                <div class="comment">
                                    <div class="comment-content">${comment.content}</div>
                                    <div class="comment-date">${commentTime}</div>
                                </div>
                            `;
                        });
                        html += `</div>`;
                    }
                    
                    html += `</div>`;
                });
                
                html += `
                        </div>
                    </section>
                `;
            });
        }
        
        html += `
            </body>
            </html>
        `;
        
        return html;
    },
    
    // 导出为PDF
    exportToPdf(diaries, filename) {
        // 显示加载中的消息
        this.showMessage('正在生成PDF，请稍候...', 'info');

        // 格式化日记为HTML
        const html = this.formatDiariesForPdf(diaries);

        // 配置PDF选项
        const options = {
            margin: [15, 15, 15, 15], // 上, 右, 下, 左 边距
            filename: `${localStorage.getItem('diaryTitle') || '博客式日记本'}_${new Date().toLocaleDateString()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                letterRendering: true,
                dpi: 300
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait',
                compress: true 
            },
            pagebreak: { 
                mode: ['avoid-all', 'css', 'legacy'],
                before: '.page-break, .date-section',
                after: '.cover-page, .toc-container',
                avoid: '.diary, .time-content-group'
            }
        };

        // 使用html2pdf创建并下载PDF
        html2pdf()
            .from(html)
            .set(options)
            .toPdf()
            .get('pdf')
            .then((pdf) => {
                // 调整以使分页控制更有效
                pdf.setDisplayMode('fullwidth');
                return pdf;
            })
            .save()
            .then(() => {
                this.showMessage('PDF已成功导出！', 'success');
            })
            .catch(error => {
                console.error('PDF导出失败:', error);
                this.showMessage('PDF导出失败，请稍后再试。', 'error');
            });
    },

    // 显示消息
    showMessage(message, type) {
        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type}`;
        alertEl.textContent = message;
        document.body.appendChild(alertEl);
        setTimeout(() => {
            document.body.removeChild(alertEl);
        }, 3000);
    }
}; 