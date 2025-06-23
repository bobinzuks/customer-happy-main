// Business Dashboard JavaScript - Real-time Analytics
class DashboardManager {
    constructor() {
        this.websocket = null;
        this.charts = {};
        this.currentBusinessId = 'all';
        this.currentDateRange = 'week';
        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        
        this.initializeDashboard();
    }

    async initializeDashboard() {
        try {
            // Show loading
            this.showLoading();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize WebSocket connection
            this.initializeWebSocket();
            
            // Load initial data
            await this.loadDashboardData();
            
            // Setup charts
            this.setupCharts();
            
            // Start real-time updates
            this.startRealTimeUpdates();
            
            // Hide loading
            this.hideLoading();
            
            console.log('Dashboard initialized successfully');
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('Failed to load dashboard. Please refresh the page.');
        }
    }

    setupEventListeners() {
        // Business selector
        const businessSelector = document.getElementById('business-selector');
        businessSelector.addEventListener('change', (e) => {
            this.currentBusinessId = e.target.value;
            this.loadDashboardData();
        });

        // Date range selector
        const dateRangeSelector = document.getElementById('date-range');
        dateRangeSelector.addEventListener('change', (e) => {
            this.currentDateRange = e.target.value;
            this.loadDashboardData();
        });

        // Chart filters
        document.querySelectorAll('.chart-filter').forEach(filter => {
            filter.addEventListener('click', (e) => {
                const period = e.target.dataset.period;
                const chartContainer = e.target.closest('.chart-container');
                const chartId = chartContainer.querySelector('canvas').id;
                
                // Update active filter
                chartContainer.querySelectorAll('.chart-filter').forEach(f => f.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update chart data
                this.updateChart(chartId, period);
            });
        });

        // Action buttons
        document.getElementById('start-campaign-btn').addEventListener('click', () => this.showCampaignModal());
        document.getElementById('export-data-btn').addEventListener('click', () => this.exportData());
        document.getElementById('refresh-activity').addEventListener('click', () => this.refreshActivity());

        // Quick actions
        document.getElementById('send-invites').addEventListener('click', () => this.showInviteModal());
        document.getElementById('view-reports').addEventListener('click', () => this.generateReport());
        document.getElementById('manage-templates').addEventListener('click', () => this.openTemplateEditor());
        document.getElementById('compliance-check').addEventListener('click', () => this.showComplianceReport());
    }

    initializeWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.websocket = new WebSocket(`${protocol}//${window.location.host}/ws/dashboard`);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.retryCount = 0;
                this.updateConnectionStatus(true);
                
                // Subscribe to updates for current business
                this.websocket.send(JSON.stringify({
                    type: 'subscribe',
                    businessId: this.currentBusinessId
                }));
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleRealTimeUpdate(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.websocket.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                
                // Attempt to reconnect
                if (this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    setTimeout(() => this.initializeWebSocket(), 5000 * this.retryCount);
                }
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            this.updateConnectionStatus(false);
        }
    }

    async loadDashboardData() {
        try {
            const params = new URLSearchParams({
                business: this.currentBusinessId,
                range: this.currentDateRange
            });

            const [kpiData, chartData, activityData] = await Promise.all([
                this.fetchKPIData(params),
                this.fetchChartData(params),
                this.fetchActivityData(params)
            ]);

            this.updateKPIs(kpiData);
            this.updateChartData(chartData);
            this.updateActivityFeed(activityData);

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showError('Failed to load some dashboard data. Please try refreshing.');
        }
    }

    async fetchKPIData(params) {
        const response = await fetch(`/api/dashboard/kpis?${params}`);
        if (!response.ok) throw new Error(`KPI fetch failed: ${response.status}`);
        return response.json();
    }

    async fetchChartData(params) {
        const response = await fetch(`/api/dashboard/charts?${params}`);
        if (!response.ok) throw new Error(`Chart data fetch failed: ${response.status}`);
        return response.json();
    }

    async fetchActivityData(params) {
        const response = await fetch(`/api/dashboard/activity?${params}`);
        if (!response.ok) throw new Error(`Activity fetch failed: ${response.status}`);
        return response.json();
    }

    updateKPIs(data) {
        // Update KPI values with animation
        const kpis = [
            { id: 'avg-rating', value: data.averageRating, format: (v) => v.toFixed(1) },
            { id: 'total-interviews', value: data.totalInterviews, format: (v) => v.toLocaleString() },
            { id: 'review-rate', value: data.reviewRate, format: (v) => Math.round(v) + '%' },
            { id: 'response-time', value: data.responseTime, format: (v) => v.toFixed(1) + 's' }
        ];

        kpis.forEach(kpi => {
            const element = document.getElementById(kpi.id);
            if (element) {
                this.animateValue(element, kpi.value, kpi.format);
            }
        });
    }

    animateValue(element, newValue, formatter) {
        const currentValue = parseFloat(element.textContent) || 0;
        const duration = 1000;
        const steps = 60;
        const stepValue = (newValue - currentValue) / steps;
        let current = currentValue;
        let step = 0;

        const animation = setInterval(() => {
            current += stepValue;
            step++;
            
            element.textContent = formatter(current);
            element.classList.add('updated');
            
            if (step >= steps) {
                clearInterval(animation);
                element.textContent = formatter(newValue);
                setTimeout(() => element.classList.remove('updated'), 2000);
            }
        }, duration / steps);
    }

    setupCharts() {
        // Sentiment Trend Chart
        this.setupSentimentChart();
        
        // Interview Volume Chart
        this.setupVolumeChart();
    }

    setupSentimentChart() {
        const ctx = document.getElementById('sentiment-chart').getContext('2d');
        
        this.charts.sentiment = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Average Sentiment',
                    data: [],
                    borderColor: '#007AFF',
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#007AFF',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#007AFF',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: true,
                        min: -1,
                        max: 1,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(1);
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    setupVolumeChart() {
        const ctx = document.getElementById('volume-chart').getContext('2d');
        
        this.charts.volume = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Completed',
                        data: [],
                        backgroundColor: '#007AFF',
                        borderRadius: 4
                    },
                    {
                        label: 'Abandoned',
                        data: [],
                        backgroundColor: '#C7C7CC',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });
    }

    updateChartData(data) {
        // Update sentiment chart
        if (this.charts.sentiment && data.sentimentTrend) {
            this.charts.sentiment.data.labels = data.sentimentTrend.labels;
            this.charts.sentiment.data.datasets[0].data = data.sentimentTrend.data;
            this.charts.sentiment.update('none');
        }

        // Update volume chart
        if (this.charts.volume && data.volumeTrend) {
            this.charts.volume.data.labels = data.volumeTrend.labels;
            this.charts.volume.data.datasets[0].data = data.volumeTrend.completed;
            this.charts.volume.data.datasets[1].data = data.volumeTrend.abandoned;
            this.charts.volume.update('none');
        }
    }

    updateActivityFeed(activities) {
        const feed = document.getElementById('activity-feed');
        
        // Clear existing activities
        feed.innerHTML = '';
        
        activities.forEach(activity => {
            const activityElement = this.createActivityElement(activity);
            feed.appendChild(activityElement);
        });
    }

    createActivityElement(activity) {
        const div = document.createElement('div');
        div.className = `activity-item ${activity.type}`;
        
        div.innerHTML = `
            <div class="activity-icon">${activity.icon}</div>
            <div class="activity-content">
                <p><strong>${activity.title}</strong></p>
                <p class="activity-time">${this.formatTimeAgo(activity.timestamp)}</p>
                ${activity.preview ? `<div class="activity-preview">${activity.preview}</div>` : ''}
            </div>
            <div class="activity-actions">
                <button class="activity-action ${activity.urgent ? 'urgent' : ''}" aria-label="View details">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                    </svg>
                </button>
            </div>
        `;
        
        return div;
    }

    handleRealTimeUpdate(data) {
        switch (data.type) {
            case 'new_review':
                this.handleNewReview(data.payload);
                break;
            case 'interview_completed':
                this.handleInterviewCompleted(data.payload);
                break;
            case 'sentiment_update':
                this.handleSentimentUpdate(data.payload);
                break;
            case 'kpi_update':
                this.handleKPIUpdate(data.payload);
                break;
        }
    }

    handleNewReview(reviewData) {
        // Update average rating
        const ratingElement = document.getElementById('avg-rating');
        this.animateValue(ratingElement, reviewData.newAverage, (v) => v.toFixed(1));
        
        // Add to activity feed
        const newActivity = {
            type: reviewData.rating >= 4 ? 'positive' : 'negative',
            icon: reviewData.rating >= 4 ? '⭐' : '😞',
            title: `${reviewData.rating}-star review from ${reviewData.customerName}`,
            timestamp: new Date(reviewData.timestamp),
            preview: reviewData.preview,
            urgent: reviewData.rating < 3
        };
        
        this.addActivityToFeed(newActivity);
        
        // Show notification
        this.showNotification('New Review', `${reviewData.rating}-star review received`, reviewData.rating >= 4 ? 'success' : 'warning');
    }

    handleInterviewCompleted(interviewData) {
        // Update interview count
        const countElement = document.getElementById('total-interviews');
        const currentCount = parseInt(countElement.textContent.replace(/,/g, ''));
        this.animateValue(countElement, currentCount + 1, (v) => Math.round(v).toLocaleString());
        
        // Add to activity feed
        const newActivity = {
            type: 'interview',
            icon: '💬',
            title: 'Interview completed',
            timestamp: new Date(interviewData.timestamp),
            preview: `${interviewData.sentimentScore > 0 ? 'Positive' : 'Negative'} sentiment detected`,
            urgent: false
        };
        
        this.addActivityToFeed(newActivity);
    }

    addActivityToFeed(activity) {
        const feed = document.getElementById('activity-feed');
        const activityElement = this.createActivityElement(activity);
        
        // Add with animation
        activityElement.style.opacity = '0';
        activityElement.style.transform = 'translateY(-20px)';
        feed.insertBefore(activityElement, feed.firstChild);
        
        // Animate in
        setTimeout(() => {
            activityElement.style.transition = 'all 0.3s ease';
            activityElement.style.opacity = '1';
            activityElement.style.transform = 'translateY(0)';
        }, 10);
        
        // Remove old activities (keep max 10)
        while (feed.children.length > 10) {
            feed.removeChild(feed.lastChild);
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('.status-text');
        
        if (connected) {
            indicator.className = 'status-indicator connected';
            text.textContent = 'Real-time updates active';
        } else {
            indicator.className = 'status-indicator disconnected';
            text.textContent = 'Connection lost - retrying...';
        }
    }

    showNotification(title, message, type = 'info') {
        // Check if notifications are supported and permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/assets/icon-192.png',
                badge: '/assets/icon-72.png'
            });
        }
        
        // Also show in-app notification
        this.showInAppNotification(title, message, type);
    }

    showInAppNotification(title, message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 1px solid #D1D1D6;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            z-index: 1000;
            min-width: 300px;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
        
        // Manual close
        notification.querySelector('.notification-close').onclick = () => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        };
    }

    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    showError(message) {
        this.showInAppNotification('Error', message, 'error');
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const diff = now - new Date(timestamp);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    startRealTimeUpdates() {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Periodic data refresh (fallback for WebSocket)
        setInterval(() => {
            if (!this.isConnected) {
                this.loadDashboardData();
            }
        }, 60000); // Every minute
    }

    // Action handlers
    showCampaignModal() {
        alert('Campaign creation modal would open here');
    }

    async exportData() {
        try {
            const params = new URLSearchParams({
                business: this.currentBusinessId,
                range: this.currentDateRange,
                format: 'csv'
            });
            
            const response = await fetch(`/api/dashboard/export?${params}`);
            if (!response.ok) throw new Error('Export failed');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dashboard-data-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showNotification('Export Complete', 'Your data has been downloaded', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.showError('Failed to export data. Please try again.');
        }
    }

    refreshActivity() {
        const button = document.getElementById('refresh-activity');
        button.style.animation = 'spin 1s linear';
        
        this.fetchActivityData(new URLSearchParams({
            business: this.currentBusinessId,
            range: this.currentDateRange
        })).then(data => {
            this.updateActivityFeed(data);
            button.style.animation = '';
        }).catch(error => {
            console.error('Failed to refresh activity:', error);
            button.style.animation = '';
        });
    }

    showInviteModal() {
        alert('Invite modal would open here');
    }

    generateReport() {
        alert('Report generation would start here');
    }

    openTemplateEditor() {
        window.open('/templates', '_blank');
    }

    showComplianceReport() {
        window.open('/compliance', '_blank');
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .kpi-value.updated {
        animation: valueUpdate 0.5s ease;
    }
    
    @keyframes valueUpdate {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); color: var(--primary-color); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);