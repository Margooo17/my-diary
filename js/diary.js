// 日记核心功能模块
const Diary = {
    // 初始化
    init() {
        console.log('初始化日记功能...');
        this.bindEvents();
        this.renderDiaries();
        Tags.updateTagsList();
        this.initSearch();
        
        // 确保在DOM加载完成后再次绑定保存按钮事件
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOM加载完成，重新绑定保存按钮事件');
            const saveBtn = document.querySelector('.diary-modal .save-btn');
            if (saveBtn) {
                console.log('找到保存按钮，绑定点击事件');
                // 移除可能存在的旧事件
                const newSaveBtn = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                
                // 添加新的点击事件
                newSaveBtn.addEventListener('click', () => {
                    console.log('保存按钮被点击(DOMContentLoaded)');
                    this.saveAndClose();
                });
            } else {
                console.error('无法找到保存按钮');
            }
        });
        
        // 添加云同步数据更新事件监听
        document.addEventListener('diaryDataRefreshed', (event) => {
            console.log('接收到数据刷新事件，重新渲染日记列表', event);
            
            try {
                // 确保从localStorage获取最新数据
                const diariesFromStorage = Storage.getAllDiaries();
                console.log(`从localStorage读取到${diariesFromStorage.length}条日记数据`);
                
                // 强制刷新UI
                this.renderDiaries(diariesFromStorage);
                Tags.updateTagsList();
                
                console.log('日记列表和标签刷新完成');
            } catch (error) {
                console.error('刷新日记列表失败:', error);
            }
        });
    },

    // 绑定事件
    bindEvents() {
        console.log('绑定事件...');
        // 新建日记按钮
        const newDiaryBtn = document.querySelector('.new-diary-btn');
        newDiaryBtn.addEventListener('click', () => this.showDiaryModal());

        // 导入导出按钮
        const importBtn = document.querySelector('.import-btn');
        const exportBtn = document.querySelector('.export-btn');
        
        console.log('导入按钮元素:', importBtn);
        console.log('导出按钮元素:', exportBtn);
        
        if (importBtn) {
            importBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showImportDialog();
            });
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => Storage.exportData());
        }

        // 初始化标签输入
        Tags.initTagsInput();

        // 绑定模态框按钮事件
        const modal = document.querySelector('.diary-modal');
        if (modal) {
            const saveBtn = modal.querySelector('.save-btn');
            const cancelBtn = modal.querySelector('.cancel-btn');
            const closeBtn = modal.querySelector('.close-btn');
            
            if (saveBtn) {
                // 移除所有现有的事件监听器
                const newSaveBtn = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                
                // 添加新的事件监听器
                newSaveBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.saveAndClose();
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.closeModal());
            }
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }
        }

        // 添加ESC键关闭功能
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                
                // 关闭导入对话框
                const importDialog = document.querySelector('.import-dialog');
                if (importDialog) {
                    document.body.removeChild(importDialog);
                }
            }
        });
    },

    // 显示写日记弹窗
    showDiaryModal(diary = null) {
        const modal = document.querySelector('.diary-modal');
        const contentInput = modal.querySelector('.diary-content');

        if (diary) {
            contentInput.value = diary.content;
            Tags.setSelectedTags(diary.tags || []);
            modal.dataset.diaryId = diary.id;
        } else {
            contentInput.value = '';
            Tags.setSelectedTags([]);
            delete modal.dataset.diaryId;
        }

        modal.style.display = 'flex';
        contentInput.focus();
    },

    // 分页相关变量
    PAGE_SIZE: 10, // 每页显示的日记数量
    currentPage: 1,

    // 渲染日记列表
    renderDiaries(diaries = null) {
        console.log(`开始渲染日记列表，${diaries ? '使用传入数据' : '使用Storage.getAllDiaries()'}`);
        const diaryList = document.querySelector('.diary-list');
        diaryList.innerHTML = '';

        // 添加统计信息
        const stats = Storage.getStorageStats();
        const statsElement = document.createElement('div');
        statsElement.className = 'diary-stats';
        
        // 生成年份统计HTML
        const yearStatsHtml = Object.entries(stats.yearlyStats)
            .sort(([yearA], [yearB]) => yearB - yearA) // 按年份降序排序
            .map(([year, yearStats]) => `
                <div class="year-stat">
                    <span>${year}年</span>
                    <span class="stat-value ${stats.totalCount > 1500 ? 'warning' : ''}">${yearStats.count}篇</span>
                </div>
            `).join('');

        statsElement.innerHTML = `
            <div class="stats-summary">
                <div class="stat-item">
                    <span class="stat-label">总日记</span>
                    <span class="stat-value ${stats.totalCount > 1500 ? 'warning' : ''}">${stats.totalCount}篇</span>
                    ${stats.totalCount > 1500 ? '<div class="stat-warning">建议导出备份哦~</div>' : ''}
                </div>
            </div>
            <div class="stats-yearly">
                <h3>年度记录</h3>
                ${yearStatsHtml}
            </div>
        `;
        
        diaryList.appendChild(statsElement);

        // 获取日记数据
        const allDiaries = diaries || Storage.getAllDiaries();
        console.log(`渲染${allDiaries.length}条日记数据`);
        
        // 计算总页数
        const totalPages = Math.ceil(allDiaries.length / this.PAGE_SIZE);
        
        // 获取当前页的日记
        const startIndex = (this.currentPage - 1) * this.PAGE_SIZE;
        const endIndex = startIndex + this.PAGE_SIZE;
        const currentDiaries = allDiaries.slice(startIndex, endIndex);
        console.log(`当前页(${this.currentPage}/${totalPages})显示${currentDiaries.length}条日记`);
        
        // 渲染日记列表
        currentDiaries.forEach(diary => {
            const diaryElement = document.createElement('article');
            diaryElement.id = `diary-${diary.id}`;
            diaryElement.className = 'diary-card';
            
            // 处理标签显示
            let tagsHtml = '';
            if (Array.isArray(diary.tags)) {
                tagsHtml = diary.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
            } else if (diary.tags) {
                // 兼容旧数据
                tagsHtml = diary.tags.split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0)
                    .map(tag => `<span class="tag">${tag}</span>`)
                    .join('');
            }
            
            // 检查内容是否超过一定长度
            const isLongContent = diary.content.length > 300;
            
            diaryElement.innerHTML = `
                <div class="diary-header">
                <div class="date">${new Date(diary.createdAt).toLocaleString()}</div>
                    <div class="diary-actions">
                        <button class="edit-btn">编辑</button>
                        <button class="delete-btn">删除</button>
                    </div>
                </div>
                <div class="content${isLongContent ? ' collapsed' : ''}"></div>
                ${isLongContent ? `
                <div class="content-toggle ${isLongContent ? 'collapsed' : ''}">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/>
                    </svg>
                    <span>展开全文</span>
                </div>` : ''}
                <div class="tags">
                    ${tagsHtml}
                </div>
                <div class="comments-container"></div>
            `;

            // 安全地设置日记内容文本，保留换行和空格
            const contentElement = diaryElement.querySelector('.content');
            contentElement.textContent = diary.content;

            // 如果内容较长，添加展开/收起功能
            if (isLongContent) {
                const contentToggleBtn = diaryElement.querySelector('.content-toggle');
                const contentToggleBtnSpan = contentToggleBtn.querySelector('span');
                
                contentToggleBtn.addEventListener('click', () => {
                    const isCollapsed = contentElement.classList.toggle('collapsed');
                    contentToggleBtn.classList.toggle('collapsed', isCollapsed);
                    contentToggleBtnSpan.textContent = isCollapsed ? '展开全文' : '收起全文';
                });
            }

            // 为编辑和删除按钮绑定事件
            diaryElement.querySelector('.edit-btn').onclick = () => this.showDiaryModal(diary);
            diaryElement.querySelector('.delete-btn').onclick = () => {
                if (confirm('确定要删除这篇日记吗？')) {
                    Storage.deleteDiary(diary.id);
                    this.renderDiaries();
                    Tags.updateTagsList();
                }
            };

            diaryList.appendChild(diaryElement);

            // 渲染评论
            const commentsContainer = diaryElement.querySelector('.comments-container');
            if (commentsContainer) {
                Comments.renderComments(diary);
            }
        });
        
        // 添加分页控件
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination';
        
        // 上一页按钮
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn prev-btn';
        prevBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/>
            </svg>
        `;
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderDiaries();
            }
        });
        
        // 页码信息
        const pageInfo = document.createElement('span');
        pageInfo.className = 'page-info';
        pageInfo.textContent = `${this.currentPage} / ${totalPages}`;
        
        // 下一页按钮
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn next-btn';
        nextBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/>
            </svg>
        `;
        nextBtn.disabled = this.currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderDiaries();
            }
        });
        
        paginationContainer.appendChild(prevBtn);
        paginationContainer.appendChild(pageInfo);
        paginationContainer.appendChild(nextBtn);
        diaryList.appendChild(paginationContainer);
    },

    // 显示导入对话框
    showImportDialog() {
        console.log('显示导入对话框...');
        
        try {
            // 检查是否已经存在导入对话框，如果存在则先移除
            const existingDialog = document.querySelector('.import-dialog');
            if (existingDialog) {
                console.log('检测到已存在的导入对话框，先移除');
                document.body.removeChild(existingDialog);
            }
            
            // 创建导入对话框
            const dialog = document.createElement('div');
            dialog.className = 'import-dialog modal';
            dialog.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>导入数据</h2>
                        <span class="close-import-btn">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="import-tabs">
                            <button class="import-tab-btn active" data-tab="file">从文件导入</button>
                            <button class="import-tab-btn" data-tab="text">从文本导入</button>
                        </div>
                        
                        <div class="import-tab-content active" id="file-import">
                            <p>请选择备份的JSON文件：</p>
                            <input type="file" id="import-file" accept=".json">
                        </div>
                        
                        <div class="import-tab-content" id="text-import">
                            <p>请粘贴包含日记内容的文本，系统会自动识别日期并分割为多篇日记：</p>
                            <textarea id="import-text" rows="10" placeholder="将文本粘贴在这里..."></textarea>
                            <div class="text-import-tips">
                                <p>支持的日期格式示例：</p>
                                <ul>
                                    <li>2023-01-01: 今天天气真好...</li>
                                    <li>2023年1月1日: 今天天气真好...</li>
                                    <li>1月1日: 今天天气真好...</li>
                                    <li>星期一，2023-01-01: 今天天气真好...</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="import-submit-btn">导入</button>
                        <button id="import-cancel-btn">取消</button>
                    </div>
                </div>
            `;
            
            console.log('创建导入对话框元素完成');
            document.body.appendChild(dialog);
            console.log('添加导入对话框到DOM完成');
            
            // 确保对话框显示在中心位置
            dialog.style.display = 'flex';
            dialog.style.justifyContent = 'center';
            dialog.style.alignItems = 'center';
            console.log('设置对话框显示状态完成');
            
            // 切换选项卡
            const tabBtns = dialog.querySelectorAll('.import-tab-btn');
            const tabContents = dialog.querySelectorAll('.import-tab-content');
            
            console.log('选项卡按钮数量:', tabBtns.length);
            console.log('选项卡内容数量:', tabContents.length);
            
            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    console.log('选项卡按钮被点击:', btn.getAttribute('data-tab'));
                    // 移除所有活动状态
                    tabBtns.forEach(b => b.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    
                    // 添加当前活动状态
                    btn.classList.add('active');
                    const tabId = btn.getAttribute('data-tab');
                    const content = dialog.querySelector(`#${tabId}-import`);
                    if (content) {
                        content.classList.add('active');
                    } else {
                        console.error(`找不到ID为${tabId}-import的内容元素`);
                    }
                });
            });
            
            // 关闭按钮点击事件
            const closeBtn = dialog.querySelector('.close-import-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    console.log('关闭按钮被点击');
                    document.body.removeChild(dialog);
                });
            } else {
                console.error('找不到关闭按钮');
            }
            
            // 取消按钮点击事件
            const cancelBtn = dialog.querySelector('#import-cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    console.log('取消按钮被点击');
                    document.body.removeChild(dialog);
                });
            } else {
                console.error('找不到取消按钮');
            }
            
            // 导入按钮点击事件
            const submitBtn = dialog.querySelector('#import-submit-btn');
            if (submitBtn) {
                submitBtn.addEventListener('click', () => {
                    console.log('导入按钮被点击');
                    const activeTab = dialog.querySelector('.import-tab-btn.active');
                    if (!activeTab) {
                        console.error('找不到活动选项卡');
                        return;
                    }
                    
                    const activeTabId = activeTab.getAttribute('data-tab');
                    console.log('当前活动选项卡:', activeTabId);
                    
                    if (activeTabId === 'file') {
                        // 从文件导入
                        const fileInput = document.getElementById('import-file');
                        if (!fileInput) {
                            console.error('找不到文件输入框');
                            return;
                        }
                        
                        const file = fileInput.files[0];
                        
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const content = e.target.result;
                                console.log('文件读取完成，内容长度:', content.length);
                                const success = Storage.importData(content);
                                
                                if (success) {
                                    console.log('导入成功');
                                    alert('数据导入成功！');
                                    this.renderDiaries();
                                    document.body.removeChild(dialog);
                                } else {
                                    console.error('导入失败');
                                    alert('数据导入失败，请检查文件格式是否正确。');
                                }
                            };
                            reader.readAsText(file);
                        } else {
                            alert('请选择要导入的文件。');
                        }
                    } else if (activeTabId === 'text') {
                        // 从文本导入
                        const textInput = document.getElementById('import-text');
                        if (!textInput) {
                            console.error('找不到文本输入框');
                            return;
                        }
                        
                        const text = textInput.value.trim();
                        console.log('文本输入内容长度:', text.length);
                        
                        if (text) {
                            const success = Storage.importData(text);
                            
                            if (success) {
                                console.log('文本导入成功');
                                alert('文本数据导入成功！');
                                this.renderDiaries();
                                document.body.removeChild(dialog);
                            } else {
                                console.error('文本导入失败');
                            }
                        } else {
                            alert('请输入要导入的文本内容。');
                        }
                    }
                });
            } else {
                console.error('找不到导入提交按钮');
            }
            
            // 支持粘贴
            const textArea = document.getElementById('import-text');
            if (textArea) {
                textArea.addEventListener('paste', (e) => {
                    console.log('检测到粘贴操作');
                    // 自动切换到文本标签页
                    tabBtns.forEach(b => b.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    
                    const textTabBtn = dialog.querySelector('[data-tab="text"]');
                    const textTabContent = dialog.querySelector('#text-import');
                    
                    if (textTabBtn) textTabBtn.classList.add('active');
                    if (textTabContent) textTabContent.classList.add('active');
                });
            } else {
                console.error('找不到文本区域元素');
            }
        } catch (error) {
            console.error('显示导入对话框时出现错误:', error);
            alert('打开导入对话框失败，请刷新页面后重试。');
        }
    },

    // 保存并关闭
    async saveAndClose() {
        // 防止重复提交
        if (this.isSaving) {
            console.log('正在保存中，请勿重复提交');
            return;
        }
        
        this.isSaving = true;
        
        try {
        const content = document.querySelector('.diary-content').value.trim();
        console.log('准备保存的内容:', content);
        
        if (!content) {
            console.log('内容为空，不保存');
            this.closeModal();
                return;
            }
            
        // 获取当前选中的标签
        const tags = Array.from(document.querySelectorAll('.selected-tags .tag'))
            .map(tag => tag.textContent.trim());
            console.log('标签:', tags);
            
        // 创建新日记对象
        const diary = {
            id: this.currentDiaryId || Date.now().toString(),
            content,
            createdAt: this.currentDiaryId ? this.currentDiaryCreatedAt : new Date().toISOString(),
            tags,
                comments: this.currentDiaryId ? (this.currentDiaryComments || []) : [],
                lastModified: new Date().toISOString()
        };
        
        console.log('保存的日记:', diary);
            
        // 保存到存储
        let diaries;
        if (this.currentDiaryId) {
                    // 更新现有日记
            diaries = Storage.getAllDiaries().map(d => 
                d.id === this.currentDiaryId ? diary : d
            );
                } else {
            // 添加新日记
            diaries = [diary, ...Storage.getAllDiaries()];
        }
        
            // 保存到本地存储
        Storage.saveAllDiaries(diaries);
                    
        // 显示成就动画
                        this.showAchievementAnimation();
        
        // 清空输入并关闭模态框
        this.closeModal();
                
        // 重新渲染日记列表
                this.renderDiaries();
        
            // 如果云同步模块存在且已授权，触发自动同步
        if (window.CloudSync && localStorage.getItem('dropbox_access_token')) {
                try {
                    // 等待一小段时间确保本地数据已完全保存
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await CloudSync.sync();
                } catch (error) {
                    console.error('云同步失败:', error);
                }
            }
        } catch (error) {
            console.error('保存日记失败:', error);
        } finally {
            this.isSaving = false;
        }
    },
    
    // 显示写作成就动画
    showAchievementAnimation() {
        try {
            // 显示写作达成动画
            const animation = document.createElement('div');
            animation.className = 'writing-achievement';
            
            // 获取鼓励语
            let encouragement = '写得真棒！';
            try {
                const encouragements = Storage.getEncouragements();
                console.log("获取到的鼓励语数组:", encouragements);
                
                // 检查是否有用户自定义的非空鼓励语
                const customEncouragements = encouragements.filter(item => item && item.trim().length > 0);
                console.log("过滤后的自定义鼓励语:", customEncouragements);
                
                if (customEncouragements.length > 0) {
                    // 检查localStorage中是否有标记表示最近添加了新的鼓励语
                    const recentlyAddedFlag = localStorage.getItem('recently_added_encouragement');
                    console.log("最近添加标记:", recentlyAddedFlag);
                    
                    if (recentlyAddedFlag === 'true') {
                        // 如果最近添加了鼓励语，则使用最后一条（最新添加的）
                        encouragement = customEncouragements[customEncouragements.length - 1];
                        console.log("使用最新添加的鼓励语:", encouragement);
                        // 使用后清除标记
                        localStorage.removeItem('recently_added_encouragement');
                        console.log("已清除最近添加标记");
                    } else {
                        // 否则随机选择一条显示
                        encouragement = customEncouragements[Math.floor(Math.random() * customEncouragements.length)];
                        console.log("随机选择的鼓励语:", encouragement);
                    }
                } else if (encouragements.length > 0 && encouragements[0]) {
                    // 如果没有自定义鼓励语，但是有默认的第一条，则使用它
                    encouragement = encouragements[0];
                    console.log("使用默认鼓励语:", encouragement);
                }
            } catch (e) {
                console.error('获取鼓励语失败', e);
            }
            
            animation.innerHTML = `
                <div class="achievement-content">
                    <svg class="achievement-icon" viewBox="0 0 24 24" width="32" height="32">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
                            fill="currentColor"/>
                    </svg>
                    <span class="achievement-text">${encouragement}</span>
                </div>
            `;
            document.body.appendChild(animation);
            animation.addEventListener('animationend', () => {
                animation.remove();
            });
        } catch (e) {
            console.error('显示动画失败', e);
        }
    },

    // 初始化搜索功能
    initSearch() {
        const searchInput = document.querySelector('.search-input');
        const searchBtn = document.querySelector('.search-btn');
        const dateCheckbox = document.querySelector('.search-date');
        const dateRange = document.querySelector('.date-range');
        const contentCheckbox = document.querySelector('.search-content');
        const commentsCheckbox = document.querySelector('.search-comments');

        if (!searchInput || !searchBtn) {
            console.warn('搜索相关元素未找到');
            return;
        }

        // 切换日期范围选择器的显示
        dateCheckbox.addEventListener('change', (e) => {
            dateRange.style.display = e.target.checked ? 'flex' : 'none';
            if (e.target.checked) {
                // 设置默认日期范围（最近一个月）
                const end = new Date();
                const start = new Date();
                start.setMonth(start.getMonth() - 1);
                
                document.querySelector('.date-start').value = start.toISOString().split('T')[0];
                document.querySelector('.date-end').value = end.toISOString().split('T')[0];
            }
        });

        // 防抖函数
        const debounce = (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        // 检查日期是否在范围内
        const isDateInRange = (dateStr) => {
            if (!dateCheckbox.checked) return true;
            
            const startDate = new Date(document.querySelector('.date-start').value);
            const endDate = new Date(document.querySelector('.date-end').value);
            endDate.setHours(23, 59, 59); // 设置为当天结束
            
            const date = new Date(dateStr);
            return date >= startDate && date <= endDate;
        };

        // 搜索函数
        const searchDiaries = (searchText) => {
            let filteredDiaries = [];
            
            // 如果启用内容搜索或评论搜索，使用索引搜索
            if ((contentCheckbox.checked || commentsCheckbox.checked) && searchText) {
                filteredDiaries = Storage.searchByIndex(searchText);
            } else {
                // 否则使用常规筛选
                const diaries = Storage.getAllDiaries();
                filteredDiaries = diaries.filter(diary => {
                    // 如果没有搜索文本且不需要日期筛选，显示所有日记
                    if (!searchText && !dateCheckbox.checked) return true;

                    // 检查日期范围
                    if (dateCheckbox.checked && !isDateInRange(diary.createdAt)) {
                        return false;
                    }

                    if (!searchText) return true;
                    
                    return false; // 如果需要搜索文本但没有选择搜索目标，则不显示
                });
            }
            
            // 应用日期过滤
            if (dateCheckbox.checked) {
                filteredDiaries = filteredDiaries.filter(diary => isDateInRange(diary.createdAt));
            }

            // 渲染搜索结果
            this.renderDiaries(filteredDiaries);

            // 高亮匹配文本
            if (searchText) {
                const diaryElements = document.querySelectorAll('.diary-card');
                const searchRegex = new RegExp(searchText, 'gi');
                
                diaryElements.forEach(element => {
                    if (contentCheckbox.checked) {
                        const content = element.querySelector('.content');
                        if (content) {
                            content.innerHTML = content.textContent.replace(
                                searchRegex,
                                match => `<mark class="highlight">${match}</mark>`
                            );
                        }
                    }

                    if (commentsCheckbox.checked) {
                        const comments = element.querySelectorAll('.comment-content');
                        comments.forEach(comment => {
                            comment.innerHTML = comment.textContent.replace(
                                searchRegex,
                                match => `<mark class="highlight">${match}</mark>`
                            );
                        });
                    }
                });
            }
        };

        // 添加搜索事件监听器
        const debouncedSearch = debounce((searchText) => searchDiaries(searchText), 300);

        // 监听搜索框输入
        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value.trim());
        });

        // 监听搜索按钮点击
        searchBtn.addEventListener('click', () => {
            searchDiaries(searchInput.value.trim());
        });

        // 监听回车键
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchDiaries(searchInput.value.trim());
            }
        });

        // 监听搜索选项变化
        [contentCheckbox, dateCheckbox, commentsCheckbox].forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                searchDiaries(searchInput.value.trim());
            });
        });

        // 监听日期范围变化
        document.querySelector('.date-start').addEventListener('change', () => {
            if (dateCheckbox.checked) searchDiaries(searchInput.value.trim());
        });
        document.querySelector('.date-end').addEventListener('change', () => {
            if (dateCheckbox.checked) searchDiaries(searchInput.value.trim());
        });
    },

    // 关闭模态框
    closeModal() {
        const modal = document.querySelector('.diary-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.querySelector('.diary-content').value = '';
            Tags.setSelectedTags([]);
            delete modal.dataset.diaryId;
        }
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    Diary.init();
}); 