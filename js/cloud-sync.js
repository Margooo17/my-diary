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
        cloudFolder: '/diary-data',
        autoSync: true, // 启用自动同步
        syncInterval: 5 * 60 * 1000, // 自动保存间隔（毫秒）
        lastSyncKey: 'last_sync_timestamp'
    },
    
    // 同步状态
    syncState: {
        lastSyncTime: null,
        isSyncing: false,
        hasChanges: false,
        syncTimer: null
    },
    
    /**
     * 初始化云同步功能
     */
    init() {
        console.log('初始化云同步模块...');
        
        // 初始化Dropbox客户端
        this.initDropboxClient();
        
        // 绑定按钮事件
        this.bindEvents();
        
        // 检查是否从授权重定向返回
        this.checkAuthRedirect();
        
        // 设置自动同步
        this.setupAutoSync();
        
        // 设置页面关闭前保存
        this.setupBeforeUnloadSync();
    },
    
    /**
     * 初始化Dropbox客户端
     */
    initDropboxClient() {
        console.log('初始化Dropbox客户端...');
        
        try {
            if (typeof Dropbox === 'undefined') {
                console.error('Dropbox SDK未加载');
                return;
            }
            
            // 检测Dropbox SDK版本并使用不同的初始化方法
            if (typeof Dropbox.Dropbox === 'function') {
                // 新版SDK
                console.log('使用新版Dropbox SDK初始化');
                this.dropboxClient = new Dropbox.Dropbox({
                    clientId: this.config.clientId
                });
            } else if (typeof Dropbox === 'function') {
                // 旧版SDK
                console.log('使用旧版Dropbox SDK初始化');
                this.dropboxClient = new Dropbox({
                    clientId: this.config.clientId
                });
            } else {
                console.error('无法识别Dropbox SDK版本');
                return;
            }
            
            // 检查是否已授权
            const accessToken = localStorage.getItem('dropboxAccessToken') || localStorage.getItem('dropbox_access_token');
            
            if (accessToken) {
                console.log('发现访问令牌，设置到客户端');
                
                // 根据SDK版本设置令牌
                if (this.dropboxClient.auth) {
                    this.dropboxClient.auth.setAccessToken(accessToken);
                } else if (this.dropboxClient.setAccessToken) {
                    this.dropboxClient.setAccessToken(accessToken);
                }
                
                // 确保两个存储键都有相同的令牌值
                localStorage.setItem('dropboxAccessToken', accessToken);
                localStorage.setItem('dropbox_access_token', accessToken);
                this.showSyncStatus('已连接到Dropbox');
            } else {
                console.log('未找到访问令牌，需要授权');
                this.showSyncStatus('未连接到云存储');
            }
        } catch (error) {
            console.error('初始化Dropbox客户端失败:', error);
        }
    },
    
    /**
     * 绑定按钮事件
     */
    bindEvents() {
        // 创建并添加同步按钮到侧边栏
        this.createSyncButton();
        
        // 监听数据变化
        this.listenForDataChanges();
    },
    
    /**
     * 创建同步按钮
     */
    createSyncButton() {
        console.log('正在创建云同步按钮...');
        
        // 找到.data-actions容器
        const dataActions = document.querySelector('.data-actions');
        
        if (!dataActions) {
            console.error('找不到.data-actions元素，无法创建云同步按钮');
            return;
        }
        
        // 先检查是否已存在按钮
        if (document.querySelector('.cloud-sync-btn')) {
            console.log('云同步按钮已存在，绑定事件');
            const existingBtn = document.querySelector('.cloud-sync-btn');
            
            // 移除所有现有事件
            const newBtn = existingBtn.cloneNode(true);
            existingBtn.parentNode.replaceChild(newBtn, existingBtn);
            
            // 绑定新事件处理器
            newBtn.onclick = (e) => {
                e.preventDefault();
                console.log('云同步按钮被点击');
                
                // 检查是否已授权
                if (!this.dropboxClient || !this.dropboxClient.getAccessToken()) {
                    this.authorizeDropbox();
                } else {
                    this.syncData();
                }
            };
            return;
        }
        
        // 创建新按钮
        console.log('创建新的云同步按钮');
        const syncBtn = document.createElement('button');
        syncBtn.className = 'cloud-sync-btn';
        syncBtn.innerHTML = '<i class="fa fa-cloud"></i> 云同步';
        
        // 使用直接的onclick而不是addEventListener
        syncBtn.onclick = (e) => {
            e.preventDefault();
            console.log('云同步按钮被点击');
            
            // 检查是否已授权
            if (!this.dropboxClient || !this.dropboxClient.getAccessToken()) {
                this.authorizeDropbox();
            } else {
                this.syncData();
            }
        };
        
        // 直接添加到DOM
        dataActions.appendChild(syncBtn);
        console.log('云同步按钮已添加到DOM');
    },
    
    /**
     * 设置自动同步
     */
    setupAutoSync() {
        // 获取上次同步时间
        const lastSyncTime = localStorage.getItem(this.config.lastSyncKey);
        this.syncState.lastSyncTime = lastSyncTime ? parseInt(lastSyncTime) : null;
        
        // 如果启用了自动同步且已授权
        if (this.config.autoSync && this.dropboxClient.getAccessToken()) {
            // 页面加载完成后自动同步
            setTimeout(() => {
                this.autoSyncIfNeeded();
            }, 2000);
            
            // 设置定时同步
            this.syncState.syncTimer = setInterval(() => {
                if (this.syncState.hasChanges && !this.syncState.isSyncing) {
                    this.syncData();
                }
            }, this.config.syncInterval);
        }
    },
    
    /**
     * 监听数据变化
     */
    listenForDataChanges() {
        // 监听数据变化事件
        window.addEventListener('diary-data-changed', () => {
            this.syncState.hasChanges = true;
            console.log('检测到数据变化，等待自动同步...');
        });
        
        // 监听日记保存事件
        window.addEventListener('diary-saved', () => {
            this.syncState.hasChanges = true;
            console.log('检测到日记保存，等待自动同步...');
        });
        
        // 监听Storage变化
        window.addEventListener('storage', (event) => {
            if (event.key === 'diaries' || event.key === 'diaryEntries') {
                this.syncState.hasChanges = true;
                console.log('检测到localStorage变化，等待自动同步...');
            }
        });
    },
    
    /**
     * 设置页面关闭前同步
     */
    setupBeforeUnloadSync() {
        window.addEventListener('beforeunload', (event) => {
            // 如果有未保存的更改，尝试同步
            if (this.syncState.hasChanges && !this.syncState.isSyncing) {
                // 同步数据
                this.syncBeforeUnload();
                
                // 如果同步正在进行，提示用户可能需要等待
                if (this.syncState.isSyncing) {
                    const message = '正在保存数据，请等待同步完成...';
                    event.returnValue = message;
                    return message;
                }
            }
        });
    },
    
    /**
     * 检查是否需要自动同步
     */
    autoSyncIfNeeded() {
        // 如果未授权，不执行同步
        if (!this.dropboxClient.getAccessToken()) {
            console.log('未连接到云存储，跳过自动同步');
            return;
        }
        
        const now = Date.now();
        const timeSinceLastSync = this.syncState.lastSyncTime ? (now - this.syncState.lastSyncTime) : Infinity;
        
        // 如果从未同步过或距离上次同步时间超过阈值
        if (!this.syncState.lastSyncTime || timeSinceLastSync > this.config.syncInterval) {
            console.log('执行自动同步...');
            this.syncData(true); // true表示这是自动同步
        } else {
            console.log(`上次同步在 ${Math.round(timeSinceLastSync / 1000 / 60)} 分钟前，暂不需要同步`);
        }
    },
    
    /**
     * 页面关闭前同步
     */
    syncBeforeUnload() {
        // 确保已授权
        if (!this.dropboxClient.getAccessToken()) return;
        
        // 标记正在同步
        this.syncState.isSyncing = true;
        
        try {
            // 获取所有日记数据
            let diaryData = this.getAllDiaryData();
            
            // 检查是否有数据
            if (!Array.isArray(diaryData) || diaryData.length === 0) {
                console.log('没有数据需要同步');
                this.syncState.isSyncing = false;
                return;
            }
            
            const dataStr = JSON.stringify(diaryData);
            
            // 创建上传文件
            const filename = `diary_${new Date().toISOString().slice(0, 10)}.json`;
            const filePath = `${this.config.cloudFolder}/${filename}`;
            
            // 使用同步方式上传到Dropbox (注意：这不是真正的同步API调用，但在页面关闭前会尽力执行)
            this.dropboxClient.filesUpload({
                path: filePath,
                contents: dataStr,
                mode: 'overwrite'
            });
            
            console.log('页面关闭前同步尝试已执行');
        } catch (error) {
            console.error('页面关闭前同步失败:', error);
        } finally {
            // 重置同步状态
            this.syncState.isSyncing = false;
        }
    },
    
    /**
     * 获取所有日记数据
     */
    getAllDiaryData() {
        let diaryData = [];
        
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
        
        return diaryData;
    },
    
    /**
     * 检查是否从授权重定向返回
     */
    checkAuthRedirect() {
        console.log('检查授权重定向...');
        console.log('当前URL:', window.location.href);
        
        // 检查URL哈希（#后面的部分）
        const hash = window.location.hash;
        
        if (hash && hash.includes('access_token=')) {
            console.log('URL包含访问令牌');
            
            // 从哈希中提取访问令牌
            const hashParams = new URLSearchParams(hash.substr(1));
            const accessToken = hashParams.get('access_token');
            
            if (accessToken) {
                console.log('成功提取访问令牌，长度:', accessToken.length);
                
                // 保存访问令牌
                localStorage.setItem('dropboxAccessToken', accessToken);
                localStorage.setItem('dropbox_access_token', accessToken);
                
                // 根据SDK版本设置令牌
                if (this.dropboxClient) {
                    if (this.dropboxClient.auth) {
                        this.dropboxClient.auth.setAccessToken(accessToken);
                    } else {
                        this.dropboxClient.setAccessToken(accessToken);
                    }
                } else {
                    // 如果客户端未初始化，先初始化
                    this.initDropboxClient();
                }
                
                // 清除URL中的访问令牌
                window.history.replaceState({}, document.title, window.location.pathname);
                
                console.log('授权成功，准备同步数据');
                this.showSyncNotification('已成功连接到Dropbox', 'success');
                this.showSyncStatus('已连接到Dropbox');
                
                // 授权后立即同步
                setTimeout(() => {
                    this.syncData();
                }, 1000);
                
                return true;
            }
        }
        
        // 检查是否已授权
        const accessToken = localStorage.getItem('dropboxAccessToken') || localStorage.getItem('dropbox_access_token');
        if (accessToken && this.dropboxClient) {
            console.log('本地已有访问令牌，无需重新授权');
            return true;
        }
        
        console.log('未检测到授权重定向');
        return false;
    },
    
    /**
     * 授权Dropbox
     */
    authorizeDropbox() {
        console.log('开始Dropbox授权流程...');
        
        if (typeof Dropbox === 'undefined') {
            console.error('Dropbox SDK未正确加载');
            alert('无法连接到Dropbox，请确保网络连接正常');
            return;
        }
        
        try {
            // 确保客户端已初始化
            if (!this.dropboxClient) {
                this.initDropboxClient();
            }
            
            // 使用标准授权URL
            const authUrl = this.dropboxClient.auth.getAuthenticationUrl(this.config.redirectUri);
            console.log('授权URL:', authUrl);
            
            // 跳转到授权页面
            window.location.href = authUrl;
        } catch (error) {
            console.error('获取授权URL失败:', error);
            
            // 尝试备用方法
            try {
                // 创建新的auth实例
                const dbxAuth = new Dropbox.DropboxAuth({
                    clientId: this.config.clientId
                });
                
                const backupAuthUrl = dbxAuth.getAuthenticationUrl(
                    this.config.redirectUri,
                    null,
                    'token',
                    'code',
                    null,
                    null,
                    true
                );
                
                console.log('使用备用方法生成授权URL:', backupAuthUrl);
                window.location.href = backupAuthUrl;
            } catch (backupError) {
                console.error('备用授权方法也失败:', backupError);
                alert('无法连接到Dropbox，请稍后再试');
            }
        }
    },
    
    /**
     * 同步数据到云端
     */
    async syncData(isAutoSync = false) {
        // 避免重复同步
        if (this.syncState.isSyncing) {
            console.log('同步已在进行中，请稍候...');
            return;
        }
        
        console.log('开始同步数据');
        this.syncState.isSyncing = true;
        
        if (!isAutoSync) {
            this.showSyncProgress('正在同步...', false);
        }
        
        // 如果未授权，先进行授权
        if (!this.dropboxClient.getAccessToken()) {
            this.syncState.isSyncing = false;
            this.authorizeDropbox();
            return;
        }
        
        try {
            // 获取所有日记数据
            const diaryData = this.getAllDiaryData();
            
            // 检查是否有数据
            if (!Array.isArray(diaryData) || diaryData.length === 0) {
                this.showSyncNotification('没有发现需要同步的数据', 'warning');
                if (!isAutoSync) this.showSyncProgress('无数据可同步', true, true);
                this.syncState.isSyncing = false;
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
            
            // 如果不是自动同步，显示成功通知
            if (!isAutoSync) {
                this.showSyncNotification(`已成功同步${diaryData.length}条日记到云端`, 'success');
                this.showSyncProgress('同步成功', true);
            } else {
                console.log('自动同步完成');
            }
            
            // 更新最后同步时间
            this.syncState.lastSyncTime = Date.now();
            localStorage.setItem(this.config.lastSyncKey, this.syncState.lastSyncTime.toString());
            
            // 重置更改标记
            this.syncState.hasChanges = false;
            
            // 创建备份（在后台静默进行）
            this.createBackup(dataStr);
        } catch (error) {
            console.error('同步失败:', error);
            
            if (!isAutoSync) {
                this.showSyncNotification('同步失败: ' + error.message, 'error');
                this.showSyncProgress('同步失败', true, true);
            } else {
                console.error('自动同步失败:', error.message);
            }
        } finally {
            this.syncState.isSyncing = false;
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
        }
    },
    
    /**
     * 从云端下载数据
     */
    async downloadFromCloud() {
        try {
            // 显示下载进度
            this.showSyncProgress('正在从云端获取数据...', false);
            
            // 获取文件列表
            const response = await this.dropboxClient.filesListFolder({
                path: this.config.cloudFolder
            });
            
            // 如果没有文件，返回空数组
            if (response.result.entries.length === 0) {
                this.showSyncNotification('云端没有找到日记数据', 'warning');
                this.showSyncProgress('云端无数据', true, true);
                return null;
            }
            
            // 找到最新的日记数据文件
            const diaryFiles = response.result.entries
                .filter(entry => entry['.tag'] === 'file' && entry.name.startsWith('diary_'))
                .sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified));
            
            if (diaryFiles.length === 0) {
                this.showSyncNotification('云端没有找到有效的日记文件', 'warning');
                this.showSyncProgress('无有效文件', true, true);
                return null;
            }
            
            // 下载最新的文件
            const latestFile = diaryFiles[0];
            this.showSyncProgress(`正在下载: ${latestFile.name}`, false);
            
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
            
            if (!Array.isArray(diaryData)) {
                this.showSyncNotification('云端数据格式不正确', 'error');
                this.showSyncProgress('数据格式错误', true, true);
                return null;
            }
            
            this.showSyncProgress('数据获取成功', true);
            return diaryData;
        } catch (error) {
            console.error('从云端下载数据失败:', error);
            this.showSyncNotification('获取云端数据失败: ' + error.message, 'error');
            this.showSyncProgress('下载失败', true, true);
            return null;
        }
    },
    
    /**
     * 加载云端数据
     */
    async loadCloudData() {
        // 如果未授权，先进行授权
        if (!this.dropboxClient.getAccessToken()) {
            this.authorizeDropbox();
            return;
        }
        
        // 下载云端数据
        const cloudData = await this.downloadFromCloud();
        
        if (!cloudData) return;
        
        // 弹出确认对话框
        const confirmDownload = confirm(`确定要从云端加载${cloudData.length}条日记数据吗？这将替换当前本地数据。`);
        
        if (confirmDownload) {
            try {
                // 保存到本地
                await this.saveLocalData(cloudData);
                
                // 显示通知
                this.showSyncNotification(`已成功加载${cloudData.length}条云端日记`, 'success');
                
                // 刷新页面
                this.triggerPageRefresh();
            } catch (error) {
                console.error('保存云端数据失败:', error);
                this.showSyncNotification('保存云端数据失败: ' + error.message, 'error');
            }
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
            // 发送自定义事件
            window.dispatchEvent(new CustomEvent('diary-data-updated'));
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
        
        // 获取同步指示器
        const syncIndicator = document.querySelector('.auto-sync-indicator');
        
        if (syncIndicator) {
            if (!isComplete) {
                // 显示指示器
                syncIndicator.classList.add('active');
            } else {
                // 隐藏指示器（延迟）
                setTimeout(() => {
                    syncIndicator.classList.remove('active');
                }, 1000);
            }
        }
        
        // 将同步状态通知到页面
        const event = new CustomEvent('sync-status-changed', {
            detail: {
                message,
                isComplete,
                isError
            }
        });
        window.dispatchEvent(event);
    },
    
    /**
     * 显示同步通知
     */
    showSyncNotification(message, type = 'info') {
        // 移除现有通知
        const existingNotifications = document.querySelectorAll('.sync-notification');
        existingNotifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
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
    }
};

// 页面加载后初始化云同步模块
document.addEventListener('DOMContentLoaded', () => {
    CloudSync.init();
    
    // 监听日记保存事件
    window.addEventListener('diary-saved', () => {
        // 标记有未保存的更改
        CloudSync.syncState.hasChanges = true;
    });
}); 