// NetDevOps Frontend Application Logic

// API Configuration
const API_BASE = window.location.origin;

// State management
let devices = [];
let selectedDeviceHost = null;
let verificationData = {};

// DOM Elements
const elDeviceList = document.getElementById("deviceList");
const elTargetSelect = document.getElementById("targetDeviceSelect");
const elConfigForm = document.getElementById("configForm");
const elConsoleOutput = document.getElementById("consoleOutput");
const elVerificationGrid = document.getElementById("verificationGrid");

// Buttons
const elBtnPreview = document.getElementById("btnPreview");
const elBtnRunInit = document.getElementById("btnRunInit");
const elBtnRunVerify = document.getElementById("btnRunVerify");
const elBtnClearConsole = document.getElementById("btnClearConsole");

// Modals
const elAddDeviceModal = document.getElementById("addDeviceModal");
const elOpenAddModalBtn = document.getElementById("openAddDeviceModal");
const elCloseAddModalBtn = document.getElementById("closeAddDeviceModal");
const elCancelAddBtn = document.getElementById("btnCancelAdd");
const elAddDeviceForm = document.getElementById("addDeviceForm");

const elOutputDetailsModal = document.getElementById("outputDetailsModal");
const elCloseDetailsModalBtn = document.getElementById("closeDetailsModal");
const elDetailsTitle = document.getElementById("detailsTitle");
const elDetailsCommand = document.getElementById("detailsCommand");
const elDetailsOutput = document.getElementById("detailsOutput");
const elDetailsEvaluation = document.getElementById("detailsEvaluation");

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    fetchDevices();
    checkBackendHealth();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Console clear
    elBtnClearConsole.addEventListener("click", () => {
        elConsoleOutput.textContent = "--- 控制台已清空 ---";
    });

    // Modal toggles
    elOpenAddModalBtn.addEventListener("click", () => elAddDeviceModal.classList.add("active"));
    elCloseAddModalBtn.addEventListener("click", () => elAddDeviceModal.classList.remove("active"));
    elCancelAddBtn.addEventListener("click", () => elAddDeviceModal.classList.remove("active"));
    
    // Output modal close
    elCloseDetailsModalBtn.addEventListener("click", () => elOutputDetailsModal.classList.remove("active"));

    // Close modals on clicking overlay
    window.addEventListener("click", (e) => {
        if (e.target === elAddDeviceModal) elAddDeviceModal.classList.remove("active");
        if (e.target === elOutputDetailsModal) elOutputDetailsModal.classList.remove("active");
    });

    // Form submit to add device
    elAddDeviceForm.addEventListener("submit", handleAddDevice);

    // Dropdown change binds active selection
    elTargetSelect.addEventListener("change", (e) => {
        selectDevice(e.target.value);
    });

    // Main action buttons
    elBtnPreview.addEventListener("click", showConfigPreview);
    elBtnRunInit.addEventListener("click", runBaseInit);
    elBtnRunVerify.addEventListener("click", runValidation);
}

// Check API Health & Mock status
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        const health = await response.json();
        
        const backendStatus = document.getElementById("backendStatus");
        const mockStatus = document.getElementById("mockStatus");
        
        if (health.status === "healthy") {
            backendStatus.innerHTML = '<span class="pulse-dot green"></span>后端: 联机中';
        } else {
            backendStatus.innerHTML = '<span class="pulse-dot red"></span>后端: 异常';
        }

        if (health.mock_mode) {
            mockStatus.innerHTML = '<span class="pulse-dot blue"></span>模拟模式: 开启';
            mockStatus.style.display = "flex";
        } else {
            mockStatus.innerHTML = '<span class="pulse-dot red"></span>模拟模式: 关闭';
            mockStatus.style.display = "flex";
        }
    } catch (err) {
        console.error("Backend health check failed:", err);
        document.getElementById("backendStatus").innerHTML = '<span class="pulse-dot red"></span>后端: 连接失败';
    }
}

// Fetch list of devices
async function fetchDevices() {
    try {
        const response = await fetch(`${API_BASE}/api/devices`);
        devices = await response.json();
        
        renderDeviceList();
        populateTargetSelect();
    } catch (err) {
        console.error("Failed to fetch devices:", err);
        elDeviceList.innerHTML = `<div class="error-text"><i class="fa-solid fa-triangle-exclamation"></i> 无法加载设备列表</div>`;
    }
}

// Render Left Panel Device List
function renderDeviceList() {
    if (devices.length === 0) {
        elDeviceList.innerHTML = `<div class="empty-state-text">无登记设备，请点击右上角添加。</div>`;
        return;
    }

    elDeviceList.innerHTML = "";
    devices.forEach(device => {
        const devItem = document.createElement("div");
        devItem.className = `device-item ${selectedDeviceHost === device.host ? 'active' : ''}`;
        devItem.dataset.host = device.host;
        devItem.addEventListener("click", () => {
            elTargetSelect.value = device.host;
            selectDevice(device.host);
        });

        const statusTag = device.is_mock 
            ? '<span class="tag-mock"><i class="fa-solid fa-microchip"></i> MOCK</span>' 
            : '<span class="tag-real"><i class="fa-solid fa-ethernet"></i> REAL</span>';

        devItem.innerHTML = `
            <div class="device-item-header">
                <span class="device-name">${device.name}</span>
                ${statusTag}
            </div>
            <span class="device-ip">${device.host}</span>
            <div class="device-status">
                <span class="device-type-badge">${device.device_type}</span>
            </div>
        `;
        elDeviceList.appendChild(devItem);
    });
}

// Populate the select dropdown
function populateTargetSelect() {
    // Keep initial option
    elTargetSelect.innerHTML = '<option value="" disabled selected>选择执行设备...</option>';
    devices.forEach(device => {
        const opt = document.createElement("option");
        opt.value = device.host;
        opt.textContent = `${device.name} (${device.host})`;
        elTargetSelect.appendChild(opt);
    });

    if (selectedDeviceHost) {
        elTargetSelect.value = selectedDeviceHost;
    }
}

// Handle adding new device
async function handleAddDevice(e) {
    e.preventDefault();
    
    const newDevice = {
        name: document.getElementById("devName").value.trim(),
        host: document.getElementById("devHost").value.trim(),
        username: document.getElementById("devUser").value.trim(),
        password: document.getElementById("devPass").value,
        device_type: "hp_comware",
        is_mock: document.getElementById("devIsMock").checked
    };

    try {
        appendToConsole(`[+]正在向后端提交新设备: ${newDevice.name} (${newDevice.host})...`);
        const response = await fetch(`${API_BASE}/api/devices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newDevice)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "添加设备失败");
        }

        const saved = await response.json();
        appendToConsole(`[✔]设备 ${saved.name} 添加成功。`);
        
        // Refresh & close modal
        await fetchDevices();
        elAddDeviceModal.classList.remove("active");
        elAddDeviceForm.reset();
        
        // Auto select the new device
        selectDevice(saved.host);
    } catch (err) {
        appendToConsole(`[!]添加设备发生错误: ${err.message}`);
        alert(err.message);
    }
}

// Select a device
function selectDevice(host) {
    selectedDeviceHost = host;
    
    // Highlight list item
    document.querySelectorAll(".device-item").forEach(item => {
        if (item.dataset.host === host) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    // Enable buttons
    if (host) {
        elBtnPreview.disabled = false;
        elBtnRunInit.disabled = false;
        elBtnRunVerify.disabled = false;
        
        const dev = devices.find(d => d.host === host);
        appendToConsole(`[*]已选中设备: ${dev.name} (${dev.host}). ready.`);
    } else {
        elBtnPreview.disabled = true;
        elBtnRunInit.disabled = true;
        elBtnRunVerify.disabled = true;
    }
}

// Append log to console
function appendToConsole(text) {
    const timeStr = new Date().toLocaleTimeString();
    elConsoleOutput.textContent += `\n[${timeStr}] ${text}`;
    // Scroll console to bottom
    const body = elConsoleOutput.parentElement;
    body.scrollTop = body.scrollHeight;
}

// Client-side CLI config renderer
function renderH3CTemplate(params) {
    let t = `#\nsystem-view\n`;
    if (params.local_user) {
        t += `local-user ${params.local_user} class manage\n`;
        t += ` password simple ${params.local_password}\n`;
        t += ` service-type ssh telnet terminal\n`;
        t += ` authorization-attribute user-role level ${params.privilege}\n`;
        t += ` quit\n#\n`;
    }
    if (params.enable_ssh) {
        t += `ssh server enable\n`;
        t += `user-interface vty 0 63\n`;
        t += ` authentication-mode scheme\n`;
        t += ` protocol inbound all\n`;
        t += ` quit\n#\n`;
    }
    if (params.enable_telnet) {
        t += `telnet server enable\n#\n`;
    }
    if (params.enable_lldp) {
        t += `lldp global enable\n#\n`;
    }
    if (params.enable_stp) {
        t += `stp global enable\n#\n`;
    }
    if (params.ntp_server) {
        t += `clock timezone ${params.timezone} add ${params.timezone_offset || '08:00:00'}\n`;
        t += `ntp-service unicast-server ${params.ntp_server}\n#\n`;
    }
    t += `save force\n#\n`;
    return t;
}

// Get form parameters
function getFormParams() {
    return {
        local_user: document.getElementById("localUser").value.trim(),
        local_password: document.getElementById("localPassword").value,
        privilege: parseInt(document.getElementById("privilegeLevel").value),
        enable_ssh: document.getElementById("enableSSH").checked,
        enable_telnet: document.getElementById("enableTelnet").checked,
        enable_lldp: document.getElementById("enableLLDP").checked,
        enable_stp: document.getElementById("enableSTP").checked,
        ntp_server: document.getElementById("ntpServer").value.trim() || null,
        timezone: document.getElementById("timezoneName").value.trim() || null,
        timezone_offset: document.getElementById("timezoneOffset").value.trim() || null
    };
}

// Show local rendered configuration command list
function showConfigPreview() {
    if (!selectedDeviceHost) return;
    const params = getFormParams();
    const rendered = renderH3CTemplate(params);
    
    elConsoleOutput.textContent = `--- 正在预览将要下发的 H3C 命令行配置 ---`;
    elConsoleOutput.textContent += `\n${rendered}`;
    elConsoleOutput.parentElement.scrollTop = 0;
}

// Trigger Base configuration initialization on device
async function runBaseInit() {
    if (!selectedDeviceHost) return;
    const dev = devices.find(d => d.host === selectedDeviceHost);
    const params = getFormParams();
    
    elConsoleOutput.textContent = `--- 下发配置流程开始: 设备 ${dev.name} ---`;
    appendToConsole(`[+] 发起配置任务, 正在发送渲染参数...`);
    
    elBtnRunInit.disabled = true;
    elBtnRunVerify.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/api/run-init`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                device_host: selectedDeviceHost,
                params: params
            })
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            appendToConsole(`[✔] 配置下发完成！正在打印执行会话日志...`);
            elConsoleOutput.textContent += `\n\n=== 原始 SSH 执行日志 ===\n${data.log}`;
        } else {
            appendToConsole(`[❌] 配置下发失败！错误日志见下：`);
            elConsoleOutput.textContent += `\n\n=== 异常会话日志 ===\n${data.log}`;
        }
    } catch (err) {
        appendToConsole(`[!] 请求错误: 无法连接后端或任务超时. ${err.message}`);
    } finally {
        elBtnRunInit.disabled = false;
        elBtnRunVerify.disabled = false;
        elConsoleOutput.parentElement.scrollTop = elConsoleOutput.parentElement.scrollHeight;
    }
}

// Run state validation
async function runValidation() {
    if (!selectedDeviceHost) return;
    const dev = devices.find(d => d.host === selectedDeviceHost);
    const params = getFormParams();

    elConsoleOutput.textContent = `--- 状态验证流程开始: 设备 ${dev.name} ---`;
    appendToConsole(`[+] 正在请求后端建立 SSH 并抓取 display 状态...`);

    elBtnRunInit.disabled = true;
    elBtnRunVerify.disabled = true;
    elVerificationGrid.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> 正在收集设备状态并分析中...</div>`;

    try {
        const response = await fetch(`${API_BASE}/api/run-verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                device_host: selectedDeviceHost,
                params: params
            })
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            appendToConsole(`[✔] 状态收集完成，分析完毕。请查看报告面板。`);
            verificationData = data.results;
            renderVerificationCards();
            
            // Print raw verification logs to console
            elConsoleOutput.textContent += `\n\n=== 原始状态采集与验证日志 ===\n${data.raw_logs}`;
        } else {
            appendToConsole(`[❌] 状态收集阶段出现严重网络故障！`);
            elVerificationGrid.innerHTML = `
                <div class="empty-verify-state">
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--status-red)"></i>
                    <p>验证任务连接异常，无法获取设备数据。</p>
                </div>
            `;
            elConsoleOutput.textContent += `\n\n=== 异常会话日志 ===\n${data.raw_logs}`;
        }
    } catch (err) {
        appendToConsole(`[!] 请求错误: 无法拉取状态数据. ${err.message}`);
        elVerificationGrid.innerHTML = `
            <div class="empty-verify-state">
                <i class="fa-solid fa-wifi-slash" style="color: var(--status-red)"></i>
                <p>请求错误，连不上 API 服务。</p>
            </div>
        `;
    } finally {
        elBtnRunInit.disabled = false;
        elBtnRunVerify.disabled = false;
        elConsoleOutput.parentElement.scrollTop = elConsoleOutput.parentElement.scrollHeight;
    }
}

// Render dynamic verification cards
function renderVerificationCards() {
    elVerificationGrid.innerHTML = "";
    
    const keys = Object.keys(verificationData);
    if (keys.length === 0) {
        elVerificationGrid.innerHTML = `
            <div class="empty-verify-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>无可用数据。</p>
            </div>
        `;
        return;
    }

    keys.forEach(key => {
        const test = verificationData[key];
        const card = document.createElement("div");
        card.className = "verify-card";
        card.addEventListener("click", () => showDetailsModal(key));

        const badgeClass = test.passed ? "badge-pass" : "badge-fail";
        const badgeText = test.passed ? "PASS" : "FAIL";
        const icon = test.passed 
            ? '<i class="fa-regular fa-circle-check" style="color: var(--status-green)"></i>' 
            : '<i class="fa-regular fa-circle-xmark" style="color: var(--status-red)"></i>';

        card.innerHTML = `
            <div class="verify-card-header">
                <span>${key}</span>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="verify-card-body">
                <h3>${icon} ${test.desc}</h3>
                <p>点击查看 display 命令详情</p>
            </div>
        `;
        elVerificationGrid.appendChild(card);
    });
}

// Show output command details modal
function showDetailsModal(key) {
    const test = verificationData[key];
    if (!test) return;

    elDetailsTitle.textContent = `${test.desc} (${key.toUpperCase()})`;
    elDetailsCommand.textContent = test.command;
    elDetailsOutput.textContent = test.output;
    
    if (test.passed) {
        elDetailsEvaluation.className = "status-indicator badge-pass";
        elDetailsEvaluation.innerHTML = `<i class="fa-solid fa-check"></i> 评估通过: 该功能的运行状态符合预期关键字与规则要求。`;
    } else {
        elDetailsEvaluation.className = "status-indicator badge-fail";
        elDetailsEvaluation.innerHTML = `<i class="fa-solid fa-xmark"></i> 评估未通过: 未在输出内容中匹配到相应的启用标识。`;
    }

    elOutputDetailsModal.classList.add("active");
}
