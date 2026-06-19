import Chart from 'chart.js/auto';
import * as pdfjsLib from 'pdfjs-dist';
// Windows必须这样导入worker
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

// 配置PDF.js worker（Windows路径修复）
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// 全局变量
let deliveryData = JSON.parse(localStorage.getItem('deliveryData')) || [];
let stockData = JSON.parse(localStorage.getItem('stockData')) || [];
let consumptionData = [];
let parsedPdfData = null;
let deleteTarget = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('PDF.js加载成功，版本:', pdfjsLib.version);
    
    // 设置当前日期
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    document.getElementById('current-date').textContent = today.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
    document.getElementById('delivery-date').value = dateString;
    document.getElementById('stock-date').value = dateString;
    
    // 渲染初始数据
    renderDeliveryTable();
    renderStockHistory();
    updateItemSelect();
    calculateConsumption();
    renderConsumptionTable();
    updateStats();
    initChart();
    
    // 事件监听
    setupEventListeners();
});

// 设置所有事件监听器
function setupEventListeners() {
    // PDF上传区域
    const uploadArea = document.getElementById('upload-area');
    const pdfInput = document.getElementById('pdf-input');
    
    uploadArea.addEventListener('click', () => pdfInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('border-primary');
        uploadArea.classList.add('bg-primary/5');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('border-primary');
        uploadArea.classList.remove('bg-primary/5');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('border-primary');
        uploadArea.classList.remove('bg-primary/5');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/pdf') {
                handlePdfUpload(file);
            } else {
                showError('请上传PDF格式的文件');
            }
        }
    });
    
    pdfInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handlePdfUpload(e.target.files[0]);
        }
    });
    
    // 确认导入按钮
    document.getElementById('confirm-import').addEventListener('click', importParsedData);
    
    // 关闭调试窗口
    document.getElementById('close-debug').addEventListener('click', () => {
        document.getElementById('debug-section').classList.add('hidden');
    });
    
    // 手动添加送货表单
    document.getElementById('manual-delivery-form').addEventListener('submit', addManualDelivery);
    
    // 库存更新表单
    document.getElementById('stock-update-form').addEventListener('submit', updateStock);
    
    // 重新计算按钮
    document.getElementById('recalculate-btn').addEventListener('click', () => {
        calculateConsumption();
        renderConsumptionTable();
        updateStats();
        updateChart();
    });
    
    // 清空送货数据
    document.getElementById('clear-delivery').addEventListener('click', () => {
        showModal('确定要清空所有送货记录吗？此操作无法撤销。', () => {
            deliveryData = [];
            localStorage.setItem('deliveryData', JSON.stringify(deliveryData));
            renderDeliveryTable();
            updateItemSelect();
            calculateConsumption();
            renderConsumptionTable();
            updateStats();
            updateChart();
        });
    });
    
    // 导出数据按钮
    document.getElementById('export-btn').addEventListener('click', exportData);
    
    // 模态框事件
    document.getElementById('cancel-delete').addEventListener('click', hideModal);
    document.getElementById('confirm-delete').addEventListener('click', confirmDelete);
}

// 处理PDF上传
async function handlePdfUpload(file) {
    const uploadProgress = document.getElementById('upload-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressPercent = document.getElementById('progress-percent');
    const fileName = document.getElementById('file-name');
    const parseResult = document.getElementById('parse-result');
    const parseError = document.getElementById('parse-error');
    const parseMessage = document.getElementById('parse-message');
    const errorMessage = document.getElementById('error-message');
    const debugSection = document.getElementById('debug-section');
    const rawTextArea = document.getElementById('raw-text');
    
    // 重置状态
    parseResult.classList.add('hidden');
    parseError.classList.add('hidden');
    debugSection.classList.add('hidden');
    
    // 显示进度条
    uploadProgress.classList.remove('hidden');
    fileName.textContent = file.name;
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    
    console.log('开始解析PDF文件:', file.name, '大小:', file.size, '字节');
    
    try {
        // 模拟进度更新
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress > 80) progress = 80;
            progressBar.style.width = `${progress}%`;
            progressPercent.textContent = `${Math.round(progress)}%`;
        }, 200);
        
        // 读取文件
        const arrayBuffer = await file.arrayBuffer();
        console.log('文件读取完成，开始解析PDF...');
        
        // 解析PDF
        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            disableFontFace: true,
            disableRange: true,
            disableStream: true
        }).promise;
        
        console.log('PDF解析成功，总页数:', pdf.numPages);
        
        let textContent = '';
        
        // 提取所有页面文本
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log('正在解析第', i, '页...');
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            
            // 更准确地提取文本，保留换行信息
            let lastY = -1;
            let pageText = '';
            
            content.items.forEach(item => {
                // 如果Y坐标变化较大，说明是新行
                if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                    pageText += '\n';
                }
                pageText += item.str + ' ';
                lastY = item.transform[5];
            });
            
            textContent += pageText + '\n\n';
        }
        
        console.log('文本提取完成，总长度:', textContent.length);
        
        // 完成进度
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
        
        // 显示调试信息
        rawTextArea.value = textContent;
        debugSection.classList.remove('hidden');
        
        // 解析出库单数据
        parsedPdfData = parseDeliveryNote(textContent);
        console.log('解析结果:', parsedPdfData);
        
        // 显示解析结果
        setTimeout(() => {
            uploadProgress.classList.add('hidden');
            
            if (parsedPdfData && parsedPdfData.items.length > 0) {
                parseResult.classList.remove('hidden');
                parseMessage.textContent = `已识别到 ${parsedPdfData.items.length} 条物品记录，日期：${parsedPdfData.date || '未识别'}`;
                document.getElementById('confirm-import').disabled = false;
                document.getElementById('confirm-import').classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                parseError.classList.remove('hidden');
                errorMessage.textContent = '未能识别到有效数据，请查看下方原始文本并手动添加';
            }
        }, 500);
        
    } catch (error) {
        console.error('PDF解析错误:', error);
        clearInterval(progressInterval);
        uploadProgress.classList.add('hidden');
        parseError.classList.remove('hidden');
        errorMessage.textContent = `PDF解析失败: ${error.message}`;
    }
}

// 解析出库单文本
function parseDeliveryNote(text) {
    const result = {
        date: null,
        items: []
    };
    
    // 预处理文本
    text = text.replace(/\s+/g, ' ').trim();
    
    // 提取日期
    const datePatterns = [
        /(\d{4})年(\d{1,2})月(\d{1,2})日/,
        /(\d{4})-(\d{1,2})-(\d{1,2})/,
        /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
        /日期[:：]\s*(\d{4}-\d{1,2}-\d{1,2})/
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            if (pattern.source.includes('年')) {
                result.date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
            } else {
                result.date = match[1].replace(/\//g, '-');
            }
            break;
        }
    }
    
    if (!result.date) {
        result.date = new Date().toISOString().split('T')[0];
    }
    
    // 提取物品和数量
    const pattern1 = /([\u4e00-\u9fa5a-zA-Z0-9()（）\-]+?)\s+(\d+)\s*(个|盒|箱|瓶|支|袋)/g;
    
    let match;
    while ((match = pattern1.exec(text)) !== null) {
        const name = match[1].trim();
        const quantity = parseInt(match[2]);
        
        if (name.length > 1 && !name.includes('日期') && !name.includes('单号') && 
            !name.includes('合计') && !name.includes('金额')) {
            result.items.push({ name, quantity });
        }
    }
    
    // 去重
    const uniqueItems = {};
    result.items.forEach(item => {
        if (uniqueItems[item.name]) {
            uniqueItems[item.name].quantity += item.quantity;
        } else {
            uniqueItems[item.name] = item;
        }
    });
    
    result.items = Object.values(uniqueItems);
    
    return result;
}

// 导入解析的数据
function importParsedData() {
    if (!parsedPdfData || !parsedPdfData.items.length) return;
    
    const date = parsedPdfData.date || document.getElementById('delivery-date').value;
    
    parsedPdfData.items.forEach(item => {
        deliveryData.push({
            id: Date.now() + Math.random(),
            date: date,
            name: item.name,
            quantity: item.quantity,
            source: 'PDF导入'
        });
    });
    
    localStorage.setItem('deliveryData', JSON.stringify(deliveryData));
    
    renderDeliveryTable();
    updateItemSelect();
    calculateConsumption();
    renderConsumptionTable();
    updateStats();
    updateChart();
    
    document.getElementById('parse-result').classList.add('hidden');
    document.getElementById('debug-section').classList.add('hidden');
    document.getElementById('pdf-input').value = '';
    parsedPdfData = null;
    
    showToast('数据导入成功');
}

// 添加手动送货记录
function addManualDelivery(e) {
    e.preventDefault();
    
    const date = document.getElementById('delivery-date').value;
    const name = document.getElementById('item-name').value.trim();
    const quantity = parseInt(document.getElementById('delivery-quantity').value);
    
    if (!date || !name || isNaN(quantity) || quantity <= 0) {
        alert('请填写完整的送货信息');
        return;
    }
    
    deliveryData.push({
        id: Date.now(),
        date: date,
        name: name,
        quantity: quantity,
        source: '手动添加'
    });
    
    localStorage.setItem('deliveryData', JSON.stringify(deliveryData));
    
    document.getElementById('item-name').value = '';
    document.getElementById('delivery-quantity').value = '';
    
    renderDeliveryTable();
    updateItemSelect();
    calculateConsumption();
    renderConsumptionTable();
    updateStats();
    updateChart();
    
    showToast('送货记录添加成功');
}

// 更新库存
function updateStock(e) {
    e.preventDefault();
    
    const date = document.getElementById('stock-date').value;
    const item = document.getElementById('stock-item').value;
    const quantity = parseInt(document.getElementById('stock-quantity').value);
    
    if (!date || !item || isNaN(quantity) || quantity < 0) {
        alert('请填写完整的库存信息');
        return;
    }
    
    const existingIndex = stockData.findIndex(s => s.date === date && s.name === item);
    
    if (existingIndex !== -1) {
        stockData[existingIndex].quantity = quantity;
    } else {
        stockData.push({
            id: Date.now(),
            date: date,
            name: item,
            quantity: quantity
        });
    }
    
    localStorage.setItem('stockData', JSON.stringify(stockData));
    
    document.getElementById('stock-quantity').value = '';
    
    renderStockHistory();
    calculateConsumption();
    renderConsumptionTable();
    updateStats();
    updateChart();
    
    showToast('库存更新成功');
}

// 渲染送货表
function renderDeliveryTable() {
    const tbody = document.getElementById('delivery-table-body');
    
    if (deliveryData.length === 0) {
        tbody.innerHTML = `
            <tr class="border-b border-gray-100">
                <td colspan="5" class="py-8 text-center text-gray-400">暂无送货记录，请上传PDF或手动添加</td>
            </tr>
        `;
        return;
    }
    
    const sortedData = [...deliveryData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = sortedData.map(item => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="table-cell-padding">${item.date}</td>
            <td class="table-cell-padding">${item.name}</td>
            <td class="table-cell-padding text-right">${item.quantity}</td>
            <td class="table-cell-padding text-center">
                <span class="px-2 py-1 rounded-full text-xs ${item.source === 'PDF导入' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                    ${item.source}
                </span>
            </td>
            <td class="table-cell-padding text-center">
                <button class="text-danger hover:text-danger/80" onclick="deleteDelivery('${item.id}')">
                    <i class="fa fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// 渲染库存历史
function renderStockHistory() {
    const tbody = document.getElementById('stock-history-body');
    
    if (stockData.length === 0) {
        tbody.innerHTML = `
            <tr class="border-b border-gray-100">
                <td colspan="4" class="py-8 text-center text-gray-400">暂无库存记录</td>
            </tr>
        `;
        return;
    }
    
    const sortedData = [...stockData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = sortedData.map(item => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="table-cell-padding">${item.date}</td>
            <td class="table-cell-padding">${item.name}</td>
            <td class="table-cell-padding text-right">${item.quantity}</td>
            <td class="table-cell-padding text-center">
                <button class="text-danger hover:text-danger/80" onclick="deleteStock('${item.id}')">
                    <i class="fa fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// 更新物品选择下拉框
function updateItemSelect() {
    const select = document.getElementById('stock-item');
    const items = [...new Set(deliveryData.map(item => item.name))];
    
    if (items.length === 0) {
        select.innerHTML = '<option value="">选择物品</option>';
        return;
    }
    
    select.innerHTML = '<option value="">选择物品</option>' + 
        items.map(item => `<option value="${item}">${item}</option>`).join('');
}

// 计算消耗
function calculateConsumption() {
    consumptionData = [];
    const items = [...new Set([...deliveryData.map(i => i.name), ...stockData.map(i => i.name)])];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    items.forEach(itemName => {
        const totalDelivery = deliveryData
            .filter(i => i.name === itemName)
            .reduce((sum, i) => sum + i.quantity, 0);
        
        const itemStock = stockData.filter(i => i.name === itemName);
        let currentStock = 0;
        
        if (itemStock.length > 0) {
            const sortedStock = [...itemStock].sort((a, b) => new Date(b.date) - new Date(a.date));
            currentStock = sortedStock[0].quantity;
        }
        
        const totalConsumption = totalDelivery - currentStock;
        
        // 计算本月消耗
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const pastDelivery = deliveryData
            .filter(i => i.name === itemName && new Date(i.date) < firstDayOfMonth)
            .reduce((sum, i) => sum + i.quantity, 0);
        
        let firstDayStock = 0;
        const beforeFirstDay = itemStock
            .filter(i => new Date(i.date) < firstDayOfMonth)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (beforeFirstDay.length > 0) {
            firstDayStock = beforeFirstDay[0].quantity;
        }
        
        const pastConsumption = pastDelivery - firstDayStock;
        const monthlyConsumption = totalConsumption - pastConsumption;
        
        consumptionData.push({
            name: itemName,
            totalDelivery,
            currentStock,
            totalConsumption,
            pastConsumption,
            monthlyConsumption
        });
    });
}

// 渲染消耗计算表
function renderConsumptionTable() {
    const tbody = document.getElementById('consumption-table-body');
    
    if (consumptionData.length === 0) {
        tbody.innerHTML = `
            <tr class="border-b border-gray-100">
                <td colspan="6" class="py-8 text-center text-gray-400">暂无消耗数据，请先添加送货记录和库存</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = consumptionData.map(item => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="table-cell-padding font-medium">${item.name}</td>
            <td class="table-cell-padding text-right">${item.totalDelivery}</td>
            <td class="table-cell-padding text-right">${item.currentStock}</td>
            <td class="table-cell-padding text-right font-medium text-primary">${item.totalConsumption}</td>
            <td class="table-cell-padding text-right">${item.pastConsumption}</td>
            <td class="table-cell-padding text-right font-medium text-accent">${item.monthlyConsumption}</td>
        </tr>
    `).join('');
}

// 更新统计卡片
function updateStats() {
    const totalDelivery = consumptionData.reduce((sum, i) => sum + i.totalDelivery, 0);
    const currentStock = consumptionData.reduce((sum, i) => sum + i.currentStock, 0);
    const totalConsumption = consumptionData.reduce((sum, i) => sum + i.totalConsumption, 0);
    const monthlyConsumption = consumptionData.reduce((sum, i) => sum + i.monthlyConsumption, 0);
    
    document.getElementById('monthly-consumption').textContent = monthlyConsumption;
    document.getElementById('total-consumption').textContent = totalConsumption;
    document.getElementById('current-stock').textContent = currentStock;
    document.getElementById('total-delivery').textContent = totalDelivery;
}

// 初始化图表
let consumptionChart;

function initChart() {
    const ctx = document.getElementById('consumption-chart').getContext('2d');
    
    consumptionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '本月消耗趋势',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
    
    updateChart();
}

// 更新图表
function updateChart() {
    if (!consumptionChart) return;
    
    const labels = [];
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        labels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
        data.push(Math.round(consumptionData.reduce((sum, item) => sum + item.monthlyConsumption, 0) / 30));
    }
    
    consumptionChart.data.labels = labels;
    consumptionChart.data.datasets[0].data = data;
    consumptionChart.update();
}

// 删除送货记录
function deleteDelivery(id) {
    showModal('确定要删除这条送货记录吗？', () => {
        deliveryData = deliveryData.filter(item => item.id != id);
        localStorage.setItem('deliveryData', JSON.stringify(deliveryData));
        renderDeliveryTable();
        updateItemSelect();
        calculateConsumption();
        renderConsumptionTable();
        updateStats();
        updateChart();
        showToast('送货记录已删除');
    });
}

// 删除库存记录
function deleteStock(id) {
    showModal('确定要删除这条库存记录吗？', () => {
        stockData = stockData.filter(item => item.id != id);
        localStorage.setItem('stockData', JSON.stringify(stockData));
        renderStockHistory();
        calculateConsumption();
        renderConsumptionTable();
        updateStats();
        updateChart();
        showToast('库存记录已删除');
    });
}

// 显示确认模态框
function showModal(message, confirmCallback) {
    const modal = document.getElementById('confirm-modal');
    const modalContent = document.getElementById('modal-content');
    const modalMessage = document.getElementById('modal-message');
    
    modalMessage.textContent = message;
    deleteTarget = confirmCallback;
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
}

// 隐藏模态框
function hideModal() {
    const modal = document.getElementById('confirm-modal');
    const modalContent = document.getElementById('modal-content');
    
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        deleteTarget = null;
    }, 200);
}

// 确认删除
function confirmDelete() {
    if (deleteTarget) deleteTarget();
    hideModal();
}

// 显示提示
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-dark text-white px-4 py-2 rounded-lg shadow-lg transform translate-y-10 opacity-0 transition-all duration-300 z-50';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

// 导出数据
function exportData() {
    const exportData = {
        deliveryData,
        stockData,
        consumptionData,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `医院库存数据_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('数据导出成功');
}

// 显示错误
function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg transform translate-y-10 opacity-0 transition-all duration-300 z-50';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 5000);
}