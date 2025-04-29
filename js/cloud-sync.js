/**
 * 云同步模块
 * 处理与云存储的同步、备份和恢复功能
 */
const CloudSync = {
    // Dropbox API客户端
    dropboxClient: null,
    
    // 配置信息
    config: {
        clientId: '8fldvz7s2c4lsq5', // Dropbox应用键
        redirectUri: window.location.origin + window.location.pathname,
        cloudFolder: '/diary-data'
    },
    
    /**
     * 初始化云同步功能
     */
    init() {
        // 初始化Dropbox客户端
        this.initDropboxClient();
        
        // 绑定按钮事件
        this.bindEvents();
        
        // 检查是否从授权重定向返回
        this.checkAuthRedirect();
    },
    
    /**
     * 初始化Dropbox客户端
     */
    initDropboxClient() {
        this.dropboxClient = new Dropbox.Dropbox({
            clientId: this.config.clientId
        });
        
        // 检查是否已授权（同时支持两种可能的存储键）
        const accessToken = localStorage.getItem('dropboxAccessToken') || localStorage.getItem('dropbox_access_token');
        if (accessToken) {
            this.dropboxClient.setAccessToken(accessToken);
            // 确保两个存储键都有相同的令牌值
            localStorage.setItem('dropboxAccessToken', accessToken);
            localStorage.setItem('dropbox_access_token', accessToken);
            this.showSyncStatus('已连接到Dropbox');
        } else {
            this.showSyncStatus('未连接到云存储');
        }
    },
    
    /**
     * 绑定按钮事件
     */
    bindEvents() {
        // 同步按钮
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncData());
        }
        
        // 备份恢复按钮
        const backupRecoverBtn = document.getElementById('backup-recover-btn');
        if (backupRecoverBtn) {
            backupRecoverBtn.addEventListener('click', () => this.recoverFromBackup());
        }
    },
    
    /**
     * 检查是否从授权重定向返回
     */
    checkAuthRedirect() {
        const hashParams = new URLSearchParams(window.location.hash.substr(1));
        const accessToken = hashParams.get('access_token');
        
        if (accessToken) {
            // 保存访问令牌（同时保存到两个存储键）
            localStorage.setItem('dropboxAccessToken', accessToken);
            localStorage.setItem('dropbox_access_token', accessToken);
            this.dropboxClient.setAccessToken(accessToken);
            
            // 清除URL中的访问令牌
            window.history.replaceState(null, document.title, window.location.pathname);
            
            this.showSyncNotification('已成功连接到Dropbox', 'success');
            this.showSyncStatus('已连接到Dropbox');
        }
    },
    
    /**
     * 授权Dropbox
     */
    authorizeDropbox() {
        const authUrl = this.dropboxClient.getAuthenticationUrl(this.config.redirectUri);
        window.location.href = authUrl;
    },
    
    /**
     * 同步数据到云端
     */
    async syncData() {
        console.log('开始同步数据');
        this.showSyncProgress('正在同步...', false);
        
        // 如果未授权，先进行授权
        if (!this.dropboxClient.getAccessToken()) {
            this.authorizeDropbox();
            return;
        }
        
        try {
            // 获取所有日记数据（从不同的可能存储位置）
            let diaryData;
            
            // 尝试从 DiaryApp 获取数据
            if (typeof DiaryApp !== 'undefined' && typeof DiaryApp.getAllEntries === 'function') {
                diaryData = DiaryApp.getAllEntries();
                console.log('从 DiaryApp 获取数据，找到', diaryData.length, '条记录');
            } 
            // 尝试从 Storage 获取数据
            else if (typeof Storage !== 'undefined' && typeof Storage.getAllDiaries === 'function') {
                diaryData = Storage.getAllDiaries();
                console.log('从 Storage 获取数据，找到', diaryData.length, '条记录');
            } 
            // 直接从 localStorage 获取
            else {
                const diaryEntries = localStorage.getItem('diaryEntries');
                const diaries = localStorage.getItem('diaries');
                
                if (diaryEntries) {
                    diaryData = JSON.parse(diaryEntries);
                    console.log('从 localStorage.diaryEntries 获取数据，找到', diaryData.length, '条记录');
                } else if (diaries) {
                    diaryData = JSON.parse(diaries);
                    console.log('从 localStorage.diaries 获取数据，找到', diaryData.length, '条记录');
                } else {
                    diaryData = [];
                    console.log('无法找到任何数据源');
                }
            }
            
            // 检查是否有数据
            if (!Array.isArray(diaryData) || diaryData.length === 0) {
                this.showSyncNotification('没有发现需要同步的数据', 'warning');
                this.showSyncProgress('无数据可同步', true, true);
                return;
            }
            
            const dataStr = JSON.stringify(diaryData);
            
            // 创建上传文件
            const filename = `diary_${new Date().toISOString().slice(0, 10)}.json`;
            const filePath = `${this.config.cloudFolder}/${filename}`;
            
            // 确保目标文件夹存在
            try {
                await this.dropboxClient.filesCreateFolderV2({
                    path: this.config.cloudFolder,
                    autorename: false
                });
                console.log('已确认或创建云文件夹:', this.config.cloudFolder);
            } catch (error) {
                // 文件夹可能已存在，忽略错误
                if (error.status !== 409) {
                    console.error('创建云文件夹失败:', error);
                }
            }
            
            // 上传到Dropbox
            console.log('开始上传数据到:', filePath);
            const response = await this.dropboxClient.filesUpload({
                path: filePath,
                contents: dataStr,
                mode: 'overwrite'
            });
            
            console.log('同步完成:', response);
            this.showSyncNotification(`已成功同步${diaryData.length}条日记到云端`, 'success');
            this.showSyncProgress('同步成功', true);
            
            // 创建备份
            await this.createBackup(dataStr);
        } catch (error) {
            console.error('同步失败:', error);
            this.showSyncNotification('同步失败: ' + error.message, 'error');
            this.showSyncProgress('同步失败', true, true);
        }
    },
    
    /**
     * 创建数据备份
     */
    async createBackup(dataStr) {
        try {
            // 创建备份文件夹（如果不存在）
            try {
                await this.dropboxClient.filesCreateFolderV2({
                    path: '/backups',
                    autorename: false
                });
            } catch (error) {
                // 文件夹可能已存在，忽略错误
                if (error.status !== 409) {
                    throw error;
                }
            }
            
            // 生成备份文件名，包含时间戳
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `/backups/diary_backup_${timestamp}.json`;
            
            // 上传备份文件
            await this.dropboxClient.filesUpload({
                path: backupPath,
                contents: dataStr,
                mode: 'add'
            });
            
            console.log('备份创建成功');
        } catch (error) {
            console.error('创建备份失败:', error);
            this.showSyncNotification('创建备份失败: ' + error.message, 'warning');
        }
    },
    
    /**
     * 从备份恢复数据
     */
    async recoverFromBackup() {
        console.log('开始从备份恢复数据');
        this.showSyncProgress('正在获取备份列表...', false);
        
        if (!this.dropboxClient.getAccessToken()) {
            this.showSyncNotification('未连接云存储，请先授权Dropbox', 'error');
            this.showSyncProgress('未连接云存储', true, true);
            return;
        }
        
        try {
            // 获取备份文件夹中的文件列表
            const response = await this.dropboxClient.filesListFolder({
                path: '/backups'
            });
            
            const backups = response.result.entries
                .filter(entry => entry['.tag'] === 'file')
                .sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified)); // 按修改时间降序排序
            
            if (backups.length === 0) {
                this.showSyncNotification('未找到可用的备份', 'warning');
                this.showSyncProgress('没有找到备份文件', true, true);
                return;
            }
            
            // 显示备份选择对话框
            const backupDialog = document.createElement('div');
            backupDialog.className = 'backup-dialog-overlay';
            backupDialog.innerHTML = `
                <div class="backup-dialog">
                    <h3>选择要恢复的备份</h3>
                    <div class="backup-list">
                        ${backups.map((backup, index) => `
                            <div class="backup-item" data-index="${index}">
                                <div class="backup-info">
                                    <span class="backup-name">${backup.name}</span>
                                    <span class="backup-date">${new Date(backup.server_modified).toLocaleString()}</span>
                                    <span class="backup-size">${this.formatFileSize(backup.size)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="backup-dialog-buttons">
                        <button class="btn-secondary cancel-backup-btn">取消</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(backupDialog);
            
            // 等待用户选择备份文件
            const selectedBackup = await new Promise(resolve => {
                const backupItems = backupDialog.querySelectorAll('.backup-item');
                backupItems.forEach(item => {
                    item.addEventListener('click', () => {
                        const index = parseInt(item.getAttribute('data-index'));
                        document.body.removeChild(backupDialog);
                        resolve(backups[index]);
                    });
                });
                
                const cancelBtn = backupDialog.querySelector('.cancel-backup-btn');
                cancelBtn.addEventListener('click', () => {
                    document.body.removeChild(backupDialog);
                    resolve(null);
                });
            });
            
            if (!selectedBackup) {
                this.showSyncProgress('已取消恢复操作', true);
                return;
            }
            
            // 下载选择的备份文件
            this.showSyncProgress(`正在恢复备份: ${selectedBackup.name}...`, false);
            
            const fileData = await this.dropboxClient.filesDownload({
                path: selectedBackup.path_lower
            });
            
            // 读取备份文件内容
            const reader = new FileReader();
            const dataPromise = new Promise(resolve => {
                reader.onload = () => resolve(reader.result);
                reader.readAsText(fileData.result.fileBlob);
            });
            
            const dataStr = await dataPromise;
            const diaryData = JSON.parse(dataStr);
            
            if (!Array.isArray(diaryData)) {
                this.showSyncNotification('备份文件格式不正确', 'error');
                this.showSyncProgress('恢复失败：无效的备份格式', true, true);
                return;
            }

            let restored = false;
            
            // 尝试使用DiaryApp恢复
            if (typeof DiaryApp !== 'undefined' && typeof DiaryApp.restoreFromBackup === 'function') {
                restored = DiaryApp.restoreFromBackup(diaryData);
                console.log('通过DiaryApp恢复数据', restored ? '成功' : '失败');
            }
            
            // 尝试使用Storage恢复
            if (!restored && typeof Storage !== 'undefined' && typeof Storage.saveAllDiaries === 'function') {
                Storage.saveAllDiaries(diaryData);
                console.log('通过Storage恢复数据');
                restored = true;
            }
            
            // 直接保存到localStorage（同时存储到两个位置以确保兼容性）
            if (!restored) {
                // 存储到所有可能的位置，确保跨设备兼容
                localStorage.setItem('diaryEntries', JSON.stringify(diaryData));
                localStorage.setItem('diaries', JSON.stringify(diaryData));
                console.log('数据同时保存到diaryEntries和diaries');
                restored = true;
            } else {
                // 也确保所有地方都有同样的数据
                if (localStorage.getItem('diaryEntries') !== null) {
                    localStorage.setItem('diaries', localStorage.getItem('diaryEntries'));
                } else if (localStorage.getItem('diaries') !== null) {
                    localStorage.setItem('diaryEntries', localStorage.getItem('diaries'));
                }
            }
            
            if (restored) {
                this.showSyncNotification(`成功从备份恢复了${diaryData.length}条日记`, 'success');
                this.showSyncProgress('恢复完成', true);
                
                // 刷新页面数据
                this.triggerPageRefresh();
            } else {
                this.showSyncNotification('恢复失败：无法存储数据', 'error');
                this.showSyncProgress('恢复失败', true, true);
            }
        } catch (error) {
            console.error('恢复备份失败:', error);
            this.showSyncNotification('恢复备份失败: ' + error.message, 'error');
            this.showSyncProgress('恢复失败', true, true);
        }
    },
    
    /**
     * 显示同步状态
     */
    showSyncStatus(message) {
        const syncStatus = document.createElement('div');
        syncStatus.id = 'sync-status-text';
        syncStatus.className = 'sync-status-text';
        
        // 根据消息类型添加不同的class
        if (message.includes('未连接')) {
            syncStatus.classList.add('not-connected');
        } else if (message.includes('已连接')) {
            syncStatus.classList.add('connected');
        }
        
        syncStatus.textContent = message;
        
        // 查找旧的状态文本并替换
        const oldStatus = document.getElementById('sync-status-text');
        if (oldStatus) {
            oldStatus.replaceWith(syncStatus);
        } else {
            // 找到云同步按钮所在区域
            const syncArea = document.querySelector('.data-actions');
            if (syncArea) {
                syncArea.appendChild(syncStatus);
            }
        }
    },
    
    /**
     * 显示同步进度
     */
    showSyncProgress(message, isComplete, isError = false) {
        // 更新状态消息
        this.showSyncStatus(message);
        
        // 更新进度条
        const progressBar = document.getElementById('sync-progress-bar');
        if (progressBar) {
            if (isComplete) {
                progressBar.style.width = '100%';
                if (isError) {
                    progressBar.style.backgroundColor = '#f44336'; // 错误状态颜色
                } else {
                    progressBar.style.backgroundColor = '#4caf50'; // 成功状态颜色
                }
            } else {
                // 正在进行中的动画效果
                progressBar.style.width = '90%';
                progressBar.style.backgroundColor = '';
            }
            
            // 完成后重置
            if (isComplete) {
                setTimeout(() => {
                    progressBar.style.width = '0';
                    setTimeout(() => {
                        progressBar.style.backgroundColor = '';
                    }, 300);
                }, 2000);
            }
        }
    },
    
    /**
     * 显示同步通知
     */
    showSyncNotification(message, type = 'info') {
        // 移除现有通知
        const existingNotifications = document.querySelectorAll('.sync-notification');
        existingNotifications.forEach(notification => {
            document.body.removeChild(notification);
        });
        
        // 创建新通知
        const notification = document.createElement('div');
        notification.className = `sync-notification ${type}`;
        
        // 添加图标
        let icon = '';
        switch (type) {
            case 'success': icon = 'check-circle'; break;
            case 'error': icon = 'exclamation-circle'; break;
            case 'warning': icon = 'exclamation-triangle'; break;
            case 'info': icon = 'info-circle'; break;
        }
        
        notification.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        // 自动关闭
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },
    
    // 格式化文件大小显示
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * 检查访问令牌状态
     */
    async verifyTokenStatus() {
        try {
            // 检查是否有令牌
            const token = this.dropboxClient.getAccessToken();
            if (!token) {
                return { valid: false, message: '未授权' };
            }
            
            // 尝试获取用户信息以验证令牌有效性
            await this.dropboxClient.usersGetCurrentAccount();
            return { valid: true, message: '令牌有效' };
        } catch (error) {
            console.error('令牌验证失败:', error);
            return { valid: false, message: '令牌无效或已过期' };
        }
    },
    
    /**
     * 从云端下载数据
     */
    async downloadFromCloud() {
        try {
            // 获取文件列表
            const response = await this.dropboxClient.filesListFolder({
                path: this.config.cloudFolder
            });
            
            // 如果没有文件，返回空数组
            if (response.result.entries.length === 0) {
                return [];
            }
            
            // 找到最新的日记数据文件
            const diaryFiles = response.result.entries
                .filter(entry => entry['.tag'] === 'file' && entry.name.startsWith('diary_'))
                .sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified));
            
            if (diaryFiles.length === 0) {
                return [];
            }
            
            // 下载最新的文件
            const latestFile = diaryFiles[0];
            const fileData = await this.dropboxClient.filesDownload({
                path: latestFile.path_lower
            });
            
            // 读取文件内容
            const reader = new FileReader();
            const dataPromise = new Promise(resolve => {
                reader.onload = () => resolve(reader.result);
                reader.readAsText(fileData.result.fileBlob);
            });
            
            const dataStr = await dataPromise;
            const diaryData = JSON.parse(dataStr);
            
            return diaryData;
        } catch (error) {
            console.error('从云端下载数据失败:', error);
            throw error;
        }
    },

    /**
     * 保存数据到本地存储
     */
    async saveLocalData(data) {
        try {
            // 同时保存到两个存储位置，确保跨设备兼容性
            localStorage.setItem('diaryEntries', JSON.stringify(data));
            localStorage.setItem('diaries', JSON.stringify(data));
            console.log('数据已同时保存到diaryEntries和diaries');
            return true;
        } catch (error) {
            console.error('保存本地数据失败:', error);
            throw error;
        }
    },

    /**
     * 强制刷新页面数据
     */
    triggerPageRefresh() {
        // 如果有刷新日记列表的方法就调用
        if (typeof DiaryApp !== 'undefined' && typeof DiaryApp.loadEntries === 'function') {
            DiaryApp.loadEntries();
        } else if (typeof Diary !== 'undefined' && typeof Diary.loadDiaries === 'function') {
            Diary.loadDiaries();
        } else {
            // 如果都没有找到，尝试重载页面
            window.location.reload();
        }
    },

    /**
     * 超级强制同步 - 强制从云端获取数据并覆盖本地
     */
    async superForceSync() {
        console.log('执行超级强制同步');
        this.showSyncProgress('正在强制从云端同步...', false);
        
        try {
            // 验证令牌状态
            const tokenStatus = await this.verifyTokenStatus();
            if (!tokenStatus.valid) {
                console.log('令牌无效，需要重新授权');
                this.showSyncNotification('访问令牌无效，需要重新授权', 'error');
                this.showSyncProgress('同步失败: 需要授权', true, true);
                setTimeout(() => this.authorizeDropbox(), 1000);
                return;
            }
            
            // 从云端下载数据
            console.log('尝试从云端下载最新数据');
            const cloudData = await this.downloadFromCloud();
            
            if (Array.isArray(cloudData) && cloudData.length > 0) {
                console.log(`成功获取${cloudData.length}条云端数据`);
                
                // 保存到本地，完全覆盖本地数据
                await this.saveLocalData(cloudData);
                
                // 通知并刷新
                this.showSyncNotification(`已强制同步${cloudData.length}条日记`, 'success');
                this.showSyncProgress('强制同步成功', true);
                
                // 刷新页面数据
                this.triggerPageRefresh();
            } else {
                console.log('云端没有找到有效数据');
                this.showSyncNotification('云端没有找到有效数据', 'error');
                this.showSyncProgress('同步失败: 云端无数据', true, true);
            }
        } catch (error) {
            console.error('超级强制同步失败:', error);
            this.showSyncNotification('强制同步失败: ' + error.message, 'error');
            this.showSyncProgress('同步失败', true, true);
        }
    },

    /**
     * 紧急强制同步 - 与超级强制相似但有更多提示
     */
    async emergencyForceSync() {
        console.log('执行紧急强制同步');
        this.showSyncProgress('正在强制从云端同步...', false);
        
        try {
            // 检查令牌状态
            const tokenStatus = await this.verifyTokenStatus();
            if (!tokenStatus.valid) {
                console.log('令牌无效，需要重新授权');
                this.showSyncNotification('需要重新授权，请点击授权按钮', 'error');
                this.showSyncProgress('同步失败: 需要授权', true, true);
                setTimeout(() => this.authorizeDropbox(), 1000);
                return;
            }
            
            // 尝试从云端下载
            console.log('尝试从云端下载数据...');
            const cloudData = await this.downloadFromCloud();
            
            if (Array.isArray(cloudData) && cloudData.length > 0) {
                console.log(`成功获取${cloudData.length}条云端数据`);
                
                // 直接将云端数据保存到本地，覆盖本地数据
                await this.saveLocalData(cloudData);
                
                // 强制刷新页面
                this.triggerPageRefresh();
                
                // 显示成功通知
                this.showSyncNotification(`同步成功，已加载${cloudData.length}条日记`, 'success');
                this.showSyncProgress('同步成功', true);
            } else {
                console.log('云端没有数据或数据格式不正确');
                this.showSyncNotification('云端没有有效数据', 'error');
                this.showSyncProgress('同步失败: 云端无数据', true, true);
            }
        } catch (error) {
            console.error('紧急同步失败:', error);
            this.showSyncNotification('同步失败: ' + error.message, 'error');
            this.showSyncProgress('同步失败', true, true);
        }
    }
};

// 页面加载后初始化云同步模块
document.addEventListener('DOMContentLoaded', () => {
    CloudSync.init();
}); 