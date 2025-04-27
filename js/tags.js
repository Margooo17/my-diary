// 标签管理模块
const Tags = {
    // 当前选中的标签
    selectedTags: new Set(),
    // 当前激活的筛选标签
    activeFilterTag: null,

    // 获取所有标签
    getAllTags() {
        const diaries = Storage.getAllDiaries();
        const tagsSet = new Set();
        diaries.forEach(diary => {
            if (Array.isArray(diary.tags)) {
                diary.tags.forEach(tag => tagsSet.add(tag));
            } else if (diary.tags) {
                // 兼容旧数据：如果是字符串，则按逗号分隔
                diary.tags.split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0)
                    .forEach(tag => tagsSet.add(tag));
            }
        });
        return Array.from(tagsSet);
    },

    // 获取标签及其对应的日记数量
    getTagsCount() {
        const diaries = Storage.getAllDiaries();
        const tagsCount = {};
        
        diaries.forEach(diary => {
            let tags = [];
            if (Array.isArray(diary.tags)) {
                tags = diary.tags;
            } else if (diary.tags) {
                // 兼容旧数据
                tags = diary.tags.split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0);
            }
            
            tags.forEach(tag => {
                tagsCount[tag] = (tagsCount[tag] || 0) + 1;
            });
        });
        
        return tagsCount;
    },

    // 创建标签元素
    createTagElement(tag, isSelected = false, isDeletable = false, count = null) {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag' + (isSelected ? ' selected' : '') + 
            (tag === this.activeFilterTag ? ' active' : '');
        
        const tagContent = document.createElement('span');
        tagContent.className = 'tag-content';
        tagContent.textContent = tag;
        tagElement.appendChild(tagContent);
        
        // 添加日记数量显示
        if (count !== null && !isDeletable) {
            const countElement = document.createElement('span');
            countElement.className = 'tag-count';
            countElement.textContent = count;
            tagElement.appendChild(countElement);
        }

        if (isDeletable) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'tag-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeTag(tag);
            };
            tagElement.appendChild(deleteBtn);
        }

        if (!isDeletable) {
            tagElement.addEventListener('click', () => {
                this.filterByTag(tag);
            });
        }

        return tagElement;
    },

    // 更新侧边栏标签列表显示
    updateTagsList() {
        const tagsList = document.querySelector('.tags-list');
        tagsList.innerHTML = '';

        // 添加"显示全部"选项
        const allTagElement = document.createElement('span');
        allTagElement.className = 'tag all-tag' + (!this.activeFilterTag ? ' active' : '');
        allTagElement.textContent = '显示全部';
        allTagElement.addEventListener('click', () => {
            this.showAllDiaries();
        });
        tagsList.appendChild(allTagElement);

        // 添加分隔线
        const divider = document.createElement('div');
        divider.className = 'tags-divider';
        tagsList.appendChild(divider);

        // 获取所有标签及其数量
        const tags = this.getAllTags();
        const tagsCount = this.getTagsCount();
        
        // 显示其他标签及其对应的日记数量
        tags.forEach(tag => {
            const count = tagsCount[tag] || 0;
            tagsList.appendChild(this.createTagElement(tag, false, false, count));
        });
    },

    // 显示所有日记
    showAllDiaries() {
        this.activeFilterTag = null;
        Diary.renderDiaries();
        this.updateTagsList();
    },

    // 根据标签筛选日记
    filterByTag(tag) {
        this.activeFilterTag = tag;
        const diaries = Storage.getAllDiaries();
        const filteredDiaries = diaries.filter(diary => {
            if (Array.isArray(diary.tags)) {
                return diary.tags.includes(tag);
            } else if (diary.tags) {
                // 兼容旧数据
                return diary.tags.split(',')
                    .map(t => t.trim())
                    .includes(tag);
            }
            return false;
        });
        Diary.renderDiaries(filteredDiaries);
        this.updateTagsList();
    },

    // 初始化标签输入
    initTagsInput() {
        const input = document.querySelector('.tags-input input');
        const suggestionsDiv = document.querySelector('.tags-suggestions');
        
        // 清空已选标签
        this.selectedTags.clear();
        this.updateSelectedTagsDisplay();

        // 输入事件处理
        input.addEventListener('input', () => {
            const value = input.value.trim();
            if (value) {
                this.showTagSuggestions(value);
            } else {
                suggestionsDiv.innerHTML = '';
            }
        });

        // 回车添加标签
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = input.value.trim();
                if (value) {
                    this.addTag(value);
                    input.value = '';
                    suggestionsDiv.innerHTML = '';
                }
            }
        });

        // 点击空白处关闭建议
        document.addEventListener('click', () => {
            suggestionsDiv.innerHTML = '';
        });
    },

    // 显示标签建议
    showTagSuggestions(input) {
        const suggestionsDiv = document.querySelector('.tags-suggestions');
        const allTags = this.getAllTags();
        const matchingTags = allTags.filter(tag => 
            tag.toLowerCase().includes(input.toLowerCase()) &&
            !this.selectedTags.has(tag)
        );

        suggestionsDiv.innerHTML = '';
        matchingTags.slice(0, 5).forEach(tag => {
            const suggestion = document.createElement('div');
            suggestion.className = 'tag-suggestion';
            suggestion.textContent = tag;
            suggestion.onclick = (e) => {
                e.stopPropagation();
                this.addTag(tag);
                document.querySelector('.tags-input input').value = '';
                suggestionsDiv.innerHTML = '';
            };
            suggestionsDiv.appendChild(suggestion);
        });
    },

    // 添加标签
    addTag(tag) {
        tag = tag.trim();
        if (tag && !this.selectedTags.has(tag)) {
            this.selectedTags.add(tag);
            this.updateSelectedTagsDisplay();
        }
    },

    // 移除标签
    removeTag(tag) {
        this.selectedTags.delete(tag);
        this.updateSelectedTagsDisplay();
    },

    // 更新已选标签显示
    updateSelectedTagsDisplay() {
        const container = document.querySelector('.selected-tags');
        container.innerHTML = '';
        Array.from(this.selectedTags).forEach(tag => {
            container.appendChild(this.createTagElement(tag, true, true));
        });
    },

    // 获取当前选中的标签
    getSelectedTags() {
        return Array.from(this.selectedTags);
    },

    // 设置已选标签（用于编辑日记时）
    setSelectedTags(tags) {
        this.selectedTags.clear();
        if (Array.isArray(tags)) {
            tags.forEach(tag => this.selectedTags.add(tag));
        } else if (typeof tags === 'string') {
            tags.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0)
                .forEach(tag => this.selectedTags.add(tag));
        }
        this.updateSelectedTagsDisplay();
    }
}; 