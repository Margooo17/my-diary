// 评论管理模块
const Comments = {
    // 创建评论元素
    createCommentElement(comment) {
        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        commentElement.dataset.id = comment.id;

        const contentElement = document.createElement('p');
        contentElement.className = 'comment-content';
        contentElement.textContent = comment.content;

        const timeElement = document.createElement('span');
        timeElement.className = 'comment-time';
        const date = new Date(comment.createdAt);
        timeElement.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-comment';
        deleteButton.innerHTML = '&times;';
        deleteButton.title = '删除评论';

        commentElement.appendChild(contentElement);
        commentElement.appendChild(timeElement);
        commentElement.appendChild(deleteButton);

        return commentElement;
    },

    // 创建评论输入区域
    createCommentInput() {
        const inputContainer = document.createElement('div');
        inputContainer.className = 'comment-input-container';

        const textarea = document.createElement('textarea');
        textarea.className = 'comment-input';
        textarea.placeholder = '写下你的想法...';

        const addButton = document.createElement('button');
        addButton.className = 'add-comment';
        addButton.textContent = '添加评论';

        inputContainer.appendChild(textarea);
        inputContainer.appendChild(addButton);

        return inputContainer;
    },

    // 渲染评论列表
    renderComments(diary) {
        const commentsContainer = document.querySelector(`#diary-${diary.id} .comments-container`);
        if (!commentsContainer) return;

        commentsContainer.innerHTML = '';
        
        // 添加评论输入区域
        const inputContainer = this.createCommentInput();
        commentsContainer.appendChild(inputContainer);

        // 添加评论列表
        if (diary.comments && diary.comments.length > 0) {
            const commentsList = document.createElement('div');
            commentsList.className = 'comments-list';
            
            diary.comments.forEach(comment => {
                const commentElement = this.createCommentElement(comment);
                commentsList.appendChild(commentElement);
            });
            
            commentsContainer.appendChild(commentsList);
            
            // 同时创建收起/展开评论的按钮
            if (!commentsContainer.querySelector('.comments-toggle')) {
                const toggleButton = document.createElement('div');
                toggleButton.className = 'comments-toggle collapsed';
                toggleButton.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/>
                    </svg>
                    <span>展开评论</span>
                `;
                
                // 默认收起评论列表
                commentsContainer.classList.add('collapsed');
                
                toggleButton.addEventListener('click', () => {
                    const isCollapsed = commentsContainer.classList.toggle('collapsed');
                    const toggleText = toggleButton.querySelector('span');
                    toggleText.textContent = isCollapsed ? '展开评论' : '收起评论';
                    toggleButton.classList.toggle('collapsed', isCollapsed);
                });
                
                commentsContainer.insertBefore(toggleButton, commentsContainer.firstChild);
            }
        }

        // 绑定添加评论事件
        const addButton = commentsContainer.querySelector('.add-comment');
        const textarea = commentsContainer.querySelector('.comment-input');
        
        addButton.addEventListener('click', () => {
            const content = textarea.value.trim();
            if (content) {
                const comment = {
                    content,
                    createdAt: new Date().toISOString()
                };
                
                const newComment = Storage.addComment(diary.id, comment);
                if (newComment) {
                    // 检查是否已存在评论列表，如果不存在则创建
                    let commentsList = commentsContainer.querySelector('.comments-list');
                    
                    // 如果没有评论列表，创建一个新的
                    if (!commentsList) {
                        commentsList = document.createElement('div');
                        commentsList.className = 'comments-list';
                        commentsContainer.appendChild(commentsList);
                        
                        // 同时创建收起/展开评论的按钮
                        if (!commentsContainer.querySelector('.comments-toggle')) {
                            const toggleButton = document.createElement('div');
                            toggleButton.className = 'comments-toggle collapsed';
                            toggleButton.innerHTML = `
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/>
                                </svg>
                                <span>展开评论</span>
                            `;
                            
                            // 默认收起评论列表
                            commentsContainer.classList.add('collapsed');
                            
                            toggleButton.addEventListener('click', () => {
                                const isCollapsed = commentsContainer.classList.toggle('collapsed');
                                const toggleText = toggleButton.querySelector('span');
                                toggleText.textContent = isCollapsed ? '展开评论' : '收起评论';
                                toggleButton.classList.toggle('collapsed', isCollapsed);
                            });
                            
                            commentsContainer.insertBefore(toggleButton, commentsContainer.firstChild);
                        }
                    }
                    
                    // 如果评论列表是收起状态，展开它
                    if (commentsContainer.classList.contains('collapsed')) {
                        const toggleButton = commentsContainer.querySelector('.comments-toggle');
                        if (toggleButton) {
                            toggleButton.click();
                        }
                    }
                    
                    const commentElement = this.createCommentElement(newComment);
                    commentsList.appendChild(commentElement);
                    textarea.value = '';
                }
            }
        });

        // 绑定删除评论事件
        commentsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-comment')) {
                const commentElement = e.target.closest('.comment');
                const commentId = commentElement.dataset.id;
                
                if (confirm('确定要删除这条评论吗？')) {
                    if (Storage.deleteComment(diary.id, commentId)) {
                        commentElement.remove();
                        
                        // 如果没有评论了，移除评论列表容器和切换按钮
                        const commentsList = commentsContainer.querySelector('.comments-list');
                        if (commentsList && !commentsList.children.length) {
                            commentsList.remove();
                            
                            const toggleButton = commentsContainer.querySelector('.comments-toggle');
                            if (toggleButton) {
                                toggleButton.remove();
                            }
                        }
                    }
                }
            }
        });
    }
}; 