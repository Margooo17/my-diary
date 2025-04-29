/**
 * 日记应用主模块
 * 处理日记条目的增删改查和主界面交互
 */
const DiaryApp = {
    // 存储当前选中的日记条目ID
    currentEntryId: null,
    
    /**
     * 初始化应用
     */
    init() {
        // 绑定DOM事件
        this.bindEvents();
        
        // 加载并显示日记条目
        this.loadEntries();
        
        // 初始化主题切换
        this.initTheme();
    },
    
    /**
     * 绑定DOM事件
     */
    bindEvents() {
        // 保存按钮
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveEntry());
        }
        
        // 清除按钮
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearEditor());
        }
        
        // 主题切换按钮
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    },
    
    /**
     * 加载日记条目
     */
    loadEntries() {
        const entries = this.getAllEntries();
        const entriesContainer = document.querySelector('.diary-entries');
        
        if (!entriesContainer) return;
        
        // 清空容器
        entriesContainer.innerHTML = '';
        
        if (entries.length === 0) {
            entriesContainer.innerHTML = '<div class="empty-state">还没有日记，开始写下你的第一篇吧！</div>';
            return;
        }
        
        // 按日期降序排序
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 创建日记条目DOM
        entries.forEach(entry => {
            const entryElement = this.createEntryElement(entry);
            entriesContainer.appendChild(entryElement);
        });
    },
    
    /**
     * 创建日记条目元素
     */
    createEntryElement(entry) {
        const entryElement = document.createElement('div');
        entryElement.className = 'diary-entry';
        entryElement.setAttribute('data-id', entry.id);
        
        // 格式化日期
        const date = new Date(entry.date);
        const formattedDate = date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        
        // 日记预览内容（截取前100个字符）
        const previewContent = entry.content.length > 100 
            ? entry.content.substring(0, 100) + '...' 
            : entry.content;
        
        entryElement.innerHTML = `
            <div class="entry-header">
                <h3 class="entry-title">${entry.title || '无标题'}</h3>
                <div class="entry-date">${formattedDate}</div>
            </div>
            <div class="entry-preview">${previewContent}</div>
            <div class="entry-actions">
                <button class="edit-btn" data-id="${entry.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" data-id="${entry.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // 绑定编辑按钮事件
        const editBtn = entryElement.querySelector('.edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editEntry(entry.id);
        });
        
        // 绑定删除按钮事件
        const deleteBtn = entryElement.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteEntry(entry.id);
        });
        
        // 点击条目也可以编辑
        entryElement.addEventListener('click', () => {
            this.editEntry(entry.id);
        });
        
        return entryElement;
    },
    
    /**
     * 保存日记条目
     */
    saveEntry() {
        const titleInput = document.getElementById('entry-title');
        const contentInput = document.getElementById('entry-content');
        
        if (!contentInput) return;
        
        const title = titleInput ? titleInput.value.trim() : '';
        const content = contentInput.value.trim();
        
        // 内容不能为空
        if (content === '') {
            this.showNotification('日记内容不能为空', 'error');
            return;
        }
        
        // 确定是新建还是更新
        if (this.currentEntryId) {
            // 更新已有条目
            this.updateEntry(this.currentEntryId, title, content);
            this.showNotification('日记已更新', 'success');
        } else {
            // 创建新条目
            this.createEntry(title, content);
            this.showNotification('日记已保存', 'success');
        }
        
        // 重置编辑器
        this.clearEditor();
        
        // 重新加载条目列表
        this.loadEntries();
    },
    
    /**
     * 创建新日记条目
     */
    createEntry(title, content) {
        const entries = this.getAllEntries();
        
        // 生成唯一ID
        const id = Date.now().toString();
        
        // 创建新条目
        const newEntry = {
            id,
            title,
            content,
            date: new Date().toISOString()
        };
        
        // 添加到数组并保存
        entries.push(newEntry);
        this.saveEntries(entries);
        
        return id;
    },
    
    /**
     * 更新日记条目
     */
    updateEntry(id, title, content) {
        const entries = this.getAllEntries();
        const entryIndex = entries.findIndex(entry => entry.id === id);
        
        if (entryIndex !== -1) {
            // 更新条目，保留原始日期
            entries[entryIndex].title = title;
            entries[entryIndex].content = content;
            entries[entryIndex].lastModified = new Date().toISOString();
            
            this.saveEntries(entries);
        }
    },
    
    /**
     * 删除日记条目
     */
    deleteEntry(id) {
        // 确认删除
        if (!confirm('确定要删除这篇日记吗？此操作不可撤销。')) {
            return;
        }
        
        const entries = this.getAllEntries();
        const filteredEntries = entries.filter(entry => entry.id !== id);
        
        this.saveEntries(filteredEntries);
        this.loadEntries();
        
        // 如果当前正在编辑这个条目，清空编辑器
        if (this.currentEntryId === id) {
            this.clearEditor();
        }
        
        this.showNotification('日记已删除', 'info');
    },
    
    /**
     * 编辑日记条目
     */
    editEntry(id) {
        const entries = this.getAllEntries();
        const entry = entries.find(entry => entry.id === id);
        
        if (!entry) return;
        
        // 填充编辑器
        const titleInput = document.getElementById('entry-title');
        const contentInput = document.getElementById('entry-content');
        
        if (titleInput) titleInput.value = entry.title || '';
        if (contentInput) contentInput.value = entry.content || '';
        
        // 设置当前编辑的ID
        this.currentEntryId = id;
        
        // 聚焦到内容区域
        if (contentInput) contentInput.focus();
        
        // 高亮当前选中的条目
        document.querySelectorAll('.diary-entry').forEach(el => {
            el.classList.remove('active');
        });
        
        const activeEntry = document.querySelector(`.diary-entry[data-id="${id}"]`);
        if (activeEntry) {
            activeEntry.classList.add('active');
            // 滚动到可视区域
            activeEntry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },
    
    /**
     * 清空编辑器
     */
    clearEditor() {
        const titleInput = document.getElementById('entry-title');
        const contentInput = document.getElementById('entry-content');
        
        if (titleInput) titleInput.value = '';
        if (contentInput) contentInput.value = '';
        
        // 重置当前编辑的ID
        this.currentEntryId = null;
        
        // 取消高亮
        document.querySelectorAll('.diary-entry').forEach(el => {
            el.classList.remove('active');
        });
    },
    
    /**
     * 获取所有日记条目
     */
    getAllEntries() {
        const entriesJSON = localStorage.getItem('diaryEntries');
        return entriesJSON ? JSON.parse(entriesJSON) : [];
    },
    
    /**
     * 保存所有日记条目
     */
    saveEntries(entries) {
        localStorage.setItem('diaryEntries', JSON.stringify(entries));
    },
    
    /**
     * 从备份恢复数据
     */
    restoreFromBackup(data) {
        if (Array.isArray(data)) {
            this.saveEntries(data);
            this.loadEntries();
            return true;
        }
        return false;
    },
    
    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 使用云同步模块的通知功能
        if (window.CloudSync && typeof CloudSync.showSyncNotification === 'function') {
            CloudSync.showSyncNotification(message, type);
        } else {
            alert(message);
        }
    },
    
    /**
     * 初始化主题
     */
    initTheme() {
        // 从本地存储加载主题设置
        const savedTheme = localStorage.getItem('theme') || 'light';
        const savedColor = localStorage.getItem('themeColor') || 'pink';
        
        // 应用主题
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.documentElement.setAttribute('data-theme-color', savedColor);
    },
    
    /**
     * 切换深色/浅色主题
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // 切换主题
        document.documentElement.setAttribute('data-theme', newTheme);
        
        // 保存到本地存储
        localStorage.setItem('theme', newTheme);
    }
};

// 页面加载后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    DiaryApp.init();
}); 