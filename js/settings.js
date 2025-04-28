// 设置管理模块
const Settings = {
    // 初始化
    init() {
        this.loadTitle();
        this.bindTitleEvents();
        this.initTheme();
        this.initThemeColorSelector();
        this.initEncouragements();
        this.initResetButton();
    },

    // 加载保存的标题
    loadTitle() {
        const savedTitle = localStorage.getItem('diaryTitle');
        if (savedTitle) {
            document.getElementById('diary-title').textContent = savedTitle;
            document.getElementById('page-title').textContent = savedTitle;
        } else {
            // 默认标题
            document.getElementById('diary-title').textContent = '博客式日记本';
            document.getElementById('page-title').textContent = '博客式日记本';
        }
    },

    // 保存标题
    saveTitle(title) {
        localStorage.setItem('diaryTitle', title);
        document.getElementById('page-title').textContent = title;
    },

    // 绑定标题编辑事件
    bindTitleEvents() {
        const titleElement = document.getElementById('diary-title');

        // 处理标题编辑
        titleElement.addEventListener('blur', () => {
            const newTitle = titleElement.textContent.trim();
            if (newTitle) {
                this.saveTitle(newTitle);
            } else {
                titleElement.textContent = '我的日记本';
                this.saveTitle('我的日记本');
            }
        });

        // 处理回车键
        titleElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleElement.blur();
            }
        });
    },

    // 初始化主题
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);

        // 绑定主题切换事件
        const themeToggleBtn = document.querySelector('.theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                this.updateThemeIcon(newTheme);
            });
        }
    },

    // 更新主题图标
    updateThemeIcon(theme) {
        const sunIcon = document.querySelector('.sun-icon');
        const moonIcon = document.querySelector('.moon-icon');
        
        if (sunIcon && moonIcon) {
            if (theme === 'light') {
                sunIcon.style.opacity = '1';
                moonIcon.style.opacity = '0';
            } else {
                sunIcon.style.opacity = '0';
                moonIcon.style.opacity = '1';
            }
        }
    },

    // 初始化主题颜色选择器
    initThemeColorSelector() {
        const themeSelector = document.createElement('div');
        themeSelector.className = 'theme-selector';
        themeSelector.innerHTML = `
            <h2>主题颜色</h2>
            <p class="section-desc">选择适合你风格的主题颜色</p>
            <div class="color-options">
                <div class="color-option" data-theme="pink" title="粉色主题"></div>
                <div class="color-option" data-theme="blue" title="蓝色主题"></div>
                <div class="color-option" data-theme="green" title="绿色主题"></div>
                <div class="color-option" data-theme="orange" title="橙色主题"></div>
            </div>
        `;

        // 插入到侧边栏适当位置
        const tagsSection = document.querySelector('.tags-section');
        tagsSection.parentNode.insertBefore(themeSelector, tagsSection.nextSibling);

        // 加载保存的主题颜色
        this.loadThemeColor();

        // 绑定颜色选择事件
        const colorOptions = themeSelector.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                const themeColor = option.getAttribute('data-theme');
                this.setThemeColor(themeColor);
                
                // 更新选择器显示
                colorOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
            });
        });
    },

    // 加载保存的主题颜色
    loadThemeColor() {
        const savedThemeColor = localStorage.getItem('themeColor') || 'pink';
        this.setThemeColor(savedThemeColor);
        
        // 更新选择器显示
        const activeOption = document.querySelector(`.color-option[data-theme="${savedThemeColor}"]`);
        if (activeOption) {
            activeOption.classList.add('active');
        }
    },

    // 设置主题颜色
    setThemeColor(color) {
        document.documentElement.setAttribute('data-theme-color', color);
        localStorage.setItem('themeColor', color);
    },

    // 初始化鼓励语管理
    initEncouragements() {
        const encouragementsSection = document.createElement('div');
        encouragementsSection.className = 'encouragements-section';
        encouragementsSection.innerHTML = `
            <h2>写作鼓励语</h2>
            <p class="section-desc">完成日记后随机显示，最多添加3条</p>
            <div class="encouragements-list"></div>
            <button class="add-encouragement-btn">添加鼓励语</button>
        `;

        // 插入到主题切换按钮之前
        const themeSwitch = document.querySelector('.theme-switch');
        themeSwitch.parentNode.insertBefore(encouragementsSection, themeSwitch);

        this.renderEncouragements();
        this.bindEncouragementEvents();
    },

    // 渲染鼓励语列表
    renderEncouragements() {
        const encouragementsList = document.querySelector('.encouragements-list');
        const encouragements = Storage.getEncouragements();
        
        encouragementsList.innerHTML = encouragements.map((text, index) => `
            <div class="encouragement-item">
                <input type="text" value="${text}" 
                       placeholder="最多10个汉字/单词/表情" />
                <button class="delete-encouragement-btn" data-index="${index}">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" 
                              fill="currentColor"/>
                    </svg>
                </button>
            </div>
        `).join('');

        // 根据数量控制添加按钮的显示
        const addBtn = document.querySelector('.add-encouragement-btn');
        addBtn.style.display = encouragements.length >= 3 ? 'none' : 'block';
        
        // 添加输入限制逻辑
        const inputs = document.querySelectorAll('.encouragement-item input');
        inputs.forEach(input => {
            input.addEventListener('input', function() {
                const text = this.value;
                const unitCount = this.countLanguageUnits(text);
                
                if (unitCount > 10) {
                    // 如果超过10个单位，截断文本
                    this.value = this.truncateToUnits(text, 10);
                }
            });
            
            // 添加计数方法
            input.countLanguageUnits = function(text) {
                // 将文本分割为Unicode字符数组
                const chars = [...text];
                
                let count = 0;
                let englishWord = '';
                
                for (const char of chars) {
                    if (/[\u4e00-\u9fa5]/.test(char)) {
                        // 汉字
                        count++;
                    } else if (/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u.test(char)) {
                        // Emoji - 使用Unicode范围匹配常见表情
                        count++;
                    } else if (/[a-zA-Z]/.test(char)) {
                        // 英文字母，累积到单词中
                        englishWord += char;
                    } else if (/\s|[,.!?;:]/.test(char) && englishWord.length > 0) {
                        // 空格或标点，如果有累积的单词则计数
                        count++;
                        englishWord = '';
                    }
                }
                
                // 处理末尾可能的英文单词
                if (englishWord.length > 0) {
                    count++;
                }
                
                return count;
            };
            
            // 添加截断方法
            input.truncateToUnits = function(text, maxUnits) {
                const chars = [...text];
                
                let result = '';
                let count = 0;
                let englishWord = '';
                
                for (const char of chars) {
                    if (/[\u4e00-\u9fa5]/.test(char)) {
                        // 汉字
                        if (count < maxUnits) {
                            result += char;
                            count++;
                        } else {
                            break;
                        }
                    } else if (/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u.test(char)) {
                        // Emoji - 使用Unicode范围匹配常见表情
                        if (count < maxUnits) {
                            result += char;
                            count++;
                        } else {
                            break;
                        }
                    } else if (/[a-zA-Z]/.test(char)) {
                        // 英文字母，累积到临时单词
                        englishWord += char;
                    } else if (/\s|[,.!?;:]/.test(char)) {
                        // 空格或标点
                        if (englishWord.length > 0) {
                            if (count < maxUnits) {
                                result += englishWord + char;
                                count++;
                                englishWord = '';
                            } else {
                                break;
                            }
                        } else {
                            result += char;
                        }
                    } else {
                        // 其他字符
                        result += char;
                    }
                }
                
                // 处理末尾可能的英文单词
                if (englishWord.length > 0 && count < maxUnits) {
                    result += englishWord;
                }
                
                return result;
            };
        });
    },

    // 绑定鼓励语相关事件
    bindEncouragementEvents() {
        const encouragementsSection = document.querySelector('.encouragements-section');
        
        // 添加新鼓励语
        encouragementsSection.querySelector('.add-encouragement-btn').addEventListener('click', () => {
            const encouragements = Storage.getEncouragements();
            if (encouragements.length < 3) {
                encouragements.push('');
                Storage.saveEncouragements(encouragements);
                this.renderEncouragements();
                
                // 设置标记，表示新增了鼓励语
                localStorage.setItem('recently_added_encouragement', 'true');
            }
        });

        // 删除鼓励语
        encouragementsSection.addEventListener('click', (e) => {
            if (e.target.closest('.delete-encouragement-btn')) {
                const index = e.target.closest('.delete-encouragement-btn').dataset.index;
                const encouragements = Storage.getEncouragements();
                encouragements.splice(index, 1);
                Storage.saveEncouragements(encouragements);
                this.renderEncouragements();
            }
        });

        // 编辑鼓励语
        encouragementsSection.addEventListener('input', (e) => {
            if (e.target.matches('.encouragement-item input')) {
                const inputs = document.querySelectorAll('.encouragement-item input');
                const encouragements = Array.from(inputs).map(input => input.value.trim());
                
                // 检查是否有内容变化，通过比较前后长度简单判断
                const oldEncouragements = Storage.getEncouragements();
                let hasChanged = encouragements.length !== oldEncouragements.length;
                
                if (!hasChanged) {
                    // 检查内容是否有变化
                    for (let i = 0; i < encouragements.length; i++) {
                        if (encouragements[i] !== oldEncouragements[i]) {
                            hasChanged = true;
                            break;
                        }
                    }
                }
                
                // 如果有变化，保存并设置标记
                if (hasChanged) {
                    Storage.saveEncouragements(encouragements);
                    
                    // 如果最后一项不为空，则设置标记
                    if (encouragements.length > 0 && encouragements[encouragements.length - 1].trim() !== '') {
                        localStorage.setItem('recently_added_encouragement', 'true');
                    }
                }
            }
        });
    },

    // 初始化重置按钮
    initResetButton() {
        const resetSection = document.createElement('div');
        resetSection.className = 'reset-section';
        resetSection.innerHTML = `
            <h2>数据重置</h2>
            <p class="section-desc">清除所有日记和设置，恢复到初始状态</p>
            <button class="reset-btn">重置数据</button>
        `;

        // 插入到主题切换按钮之前
        const themeSwitch = document.querySelector('.theme-switch');
        themeSwitch.parentNode.insertBefore(resetSection, themeSwitch);

        // 绑定重置按钮事件
        resetSection.querySelector('.reset-btn').addEventListener('click', () => {
            if (confirm('确定要重置所有数据吗？此操作将清除所有日记和设置，且无法恢复！')) {
                this.resetAllData();
            }
        });
    },

    // 重置所有数据
    resetAllData() {
        // 清除日记和设置
        localStorage.removeItem('diaries');
        localStorage.removeItem('diaryTitle');
        localStorage.removeItem('diary_encouragements');
        
        // 保留主题设置
        const theme = localStorage.getItem('theme') || 'light';
        const themeColor = localStorage.getItem('themeColor') || 'pink';
        
        // 清除所有localStorage数据
        localStorage.clear();
        
        // 恢复主题设置
        localStorage.setItem('theme', theme);
        localStorage.setItem('themeColor', themeColor);
        
        alert('数据已重置，页面将刷新。');
        window.location.reload();
    }
};

// 初始化函数或在其他适当位置
if (!Storage.getEncouragements) {
    // 如果Storage没有getEncouragements方法，添加一个
    Storage.getEncouragements = function() {
        try {
            console.log("正在获取鼓励语...");
            // 旧的代码可能使用了错误的键名
            const encouragements = localStorage.getItem('encouragements') || localStorage.getItem('diary_encouragements');
            console.log("localStorage中的原始鼓励语数据:", encouragements);
            
            if (encouragements) {
                const parsed = JSON.parse(encouragements);
                console.log("解析后的鼓励语:", parsed);
                return parsed;
            }
            
            // 返回默认鼓励语，只有一条
            console.log("没有找到鼓励语，返回默认值");
            return ['真棒呀🥳'];
        } catch (e) {
            console.error('获取鼓励语失败:', e);
            // 出错时返回默认值
            return ['真棒呀🥳'];
        }
    };
}

if (!Storage.saveEncouragements) {
    // 如果Storage没有saveEncouragements方法，添加一个
    Storage.saveEncouragements = function(encouragements) {
        try {
            console.log("保存鼓励语:", encouragements);
            localStorage.setItem('encouragements', JSON.stringify(encouragements));
            // 同时删除可能存在的旧键名，保持一致性
            localStorage.removeItem('diary_encouragements');
            console.log("鼓励语保存成功");
            return true;
        } catch (e) {
            console.error('保存鼓励语失败:', e);
            return false;
        }
    };
} 