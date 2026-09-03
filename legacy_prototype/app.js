// AgentChain Enterprise Platform Client JS Logic
// Real Backend API Integration with SIWE & PostgreSQL

const API_BASE = "";
let currentUser = null;
let authToken = localStorage.getItem("agentchain_auth_token") || null;
let authIsRegisterMode = false;

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupThemeToggle();
  setupAuthModal();
  setupSwarmLauncher();
  setupMarketplace();
  setupAgentStudio();
  setupFinancialLedger();
  setupAdminConsole();

  // Validate existing token
  if (authToken) {
    await fetchUserProfile();
  }
});

// ---------------------------------------------------------------------------
// 1. API HELPER WITH BEARER AUTH
// ---------------------------------------------------------------------------
async function apiRequest(endpoint, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.detail || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return data;
}

function showAlert(message, isError = false) {
  const banner = document.getElementById("alert-banner");
  if (!banner) return;
  banner.innerText = message;
  banner.className = `alert-banner ${isError ? "error" : "success"}`;
  banner.style.display = "block";
  setTimeout(() => {
    banner.style.display = "none";
  }, 4000);
}

// ---------------------------------------------------------------------------
// 2. NAVIGATION & THEME
// ---------------------------------------------------------------------------
function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const tab = e.target.dataset.tab;
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));

      e.target.classList.add("active");
      const targetPage = document.getElementById(`page-${tab}`);
      if (targetPage) targetPage.classList.add("active");

      // Tab specific refresh
      if (tab === "marketplace") loadMarketplaceAgents();
      if (tab === "earnings") loadFinancialSummary();
      if (tab === "admin") loadAdminDashboard();
      if (tab === "studio" && currentUser) loadMyAgents();
    });
  });
}

function setupThemeToggle() {
  const btn = document.getElementById("btn-theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    btn.innerText = isLight ? "🌙 Dark" : "☀️ Light";
  });
}

// ---------------------------------------------------------------------------
// 3. AUTHENTICATION & SIWE
// ---------------------------------------------------------------------------
function setupAuthModal() {
  const modal = document.getElementById("auth-modal");
  const btnOpen = document.getElementById("btn-auth-modal");
  const btnClose = document.getElementById("btn-close-auth-modal");
  const tabSiwe = document.getElementById("tab-auth-siwe");
  const tabPwd = document.getElementById("tab-auth-pwd");
  const panelSiwe = document.getElementById("panel-siwe");
  const panelPwd = document.getElementById("panel-password");
  const btnLogout = document.getElementById("btn-logout");

  btnOpen.addEventListener("click", () => { modal.style.display = "flex"; });
  btnClose.addEventListener("click", () => { modal.style.display = "none"; });

  tabSiwe.addEventListener("click", () => {
    tabSiwe.classList.add("active");
    tabPwd.classList.remove("active");
    panelSiwe.style.display = "block";
    panelPwd.style.display = "none";
  });

  tabPwd.addEventListener("click", () => {
    tabPwd.classList.add("active");
    tabSiwe.classList.remove("active");
    panelPwd.style.display = "block";
    panelSiwe.style.display = "none";
  });

  const toggleAuthMode = document.getElementById("toggle-auth-mode");
  toggleAuthMode.addEventListener("click", (e) => {
    e.preventDefault();
    authIsRegisterMode = !authIsRegisterMode;
    document.getElementById("auth-name-group").style.display = authIsRegisterMode ? "block" : "none";
    document.getElementById("btn-pwd-submit").innerText = authIsRegisterMode ? "Create Account" : "Sign In";
    toggleAuthMode.innerText = authIsRegisterMode ? "Already have an account? Sign In" : "Need an account? Register here";
  });

  // SIWE Web3 Login
  document.getElementById("btn-siwe-login").addEventListener("click", async () => {
    if (typeof window.ethereum === "undefined") {
      alert("No Ethereum browser wallet found. Please install MetaMask or use Email/Password.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];

      // 1. Get nonce challenge
      const { nonce } = await apiRequest("/api/v1/auth/nonce");

      // 2. Construct SIWE Message
      const domain = window.location.host;
      const siweMessage = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in with Ethereum to AgentChain Enterprise Platform.\n\nURI: ${window.location.origin}\nVersion: 1\nChain ID: 137\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

      // 3. Request Signature from Wallet
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [siweMessage, address]
      });

      // 4. Authenticate on backend
      const res = await apiRequest("/api/v1/auth/siwe", {
        method: "POST",
        body: JSON.stringify({
          wallet_address: address,
          message: siweMessage,
          signature: signature
        })
      });

      authToken = res.access_token;
      localStorage.setItem("agentchain_auth_token", authToken);
      modal.style.display = "none";
      await fetchUserProfile();
      showAlert("Successfully authenticated with Ethereum SIWE!");
    } catch (err) {
      console.error(err);
      showAlert(err.message, true);
    }
  });

  // Password Login / Register Form
  document.getElementById("form-pwd-auth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const fullName = document.getElementById("auth-name").value || "Agent Developer";

    try {
      let res;
      if (authIsRegisterMode) {
        res = await apiRequest("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, full_name: fullName })
        });
      } else {
        res = await apiRequest("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
      }

      authToken = res.access_token;
      localStorage.setItem("agentchain_auth_token", authToken);
      modal.style.display = "none";
      await fetchUserProfile();
      showAlert(`Welcome, ${res.email || "Developer"}!`);
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  btnLogout.addEventListener("click", async () => {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Backend logout request failed:", err);
    }
    authToken = null;
    currentUser = null;
    localStorage.removeItem("agentchain_auth_token");
    updateAuthUI();
    showAlert("Logged out successfully.");
  });
}

async function fetchUserProfile() {
  try {
    currentUser = await apiRequest("/api/v1/auth/me");
    updateAuthUI();
    loadMyTasks();
    loadFinancialSummary();
  } catch (err) {
    authToken = null;
    localStorage.removeItem("agentchain_auth_token");
    updateAuthUI();
  }
}

function updateAuthUI() {
  const btnAuth = document.getElementById("btn-auth-modal");
  const badge = document.getElementById("user-auth-badge");
  const badgeName = document.getElementById("badge-name");

  if (currentUser) {
    btnAuth.style.display = "none";
    badge.style.display = "flex";
    badgeName.innerText = currentUser.email || (currentUser.wallets[0] ? `${currentUser.wallets[0].address.slice(0,6)}...${currentUser.wallets[0].address.slice(-4)}` : "Authenticated");
  } else {
    btnAuth.style.display = "inline-flex";
    badge.style.display = "none";
  }
}

// ---------------------------------------------------------------------------
// 4. MULTI-AGENT SWARM WORKSPACE
// ---------------------------------------------------------------------------
function setupSwarmLauncher() {
  const btnRun = document.getElementById("btn-run-swarm");
  const btnRefresh = document.getElementById("btn-refresh-tasks");

  btnRefresh.addEventListener("click", loadMyTasks);

  btnRun.addEventListener("click", async () => {
    if (!currentUser) {
      showAlert("Please sign in or connect your wallet first.", true);
      document.getElementById("auth-modal").style.display = "flex";
      return;
    }

    const title = document.getElementById("task-title").value.trim() || "Multi-Agent Swarm Task";
    const prompt = document.getElementById("task-prompt").value.trim();
    const budget = parseFloat(document.getElementById("task-budget").value) || 1.0;

    if (!prompt) {
      showAlert("Please enter a goal prompt for the AI Swarm.", true);
      return;
    }

    const execCard = document.getElementById("execution-card");
    const outputConsole = document.getElementById("swarm-output");
    const statusTag = document.getElementById("swarm-status");
    const dagContainer = document.getElementById("dag-container");
    const proofBar = document.getElementById("proof-bar");
    const proofHashVal = document.getElementById("proof-hash-val");

    execCard.style.display = "block";
    statusTag.innerText = "Analyzing Intent & Building DAG...";
    statusTag.className = "status-tag pulse";
    proofBar.style.display = "none";
    outputConsole.innerText = "⚡ Initializing task orchestrator...\n⚡ Decomposing goal into topological Directed Acyclic Graph...";
    dagContainer.innerHTML = "<div class='dag-node-item'><span class='dag-badge'>Orchestrator</span>Analyzing swarm requirements...</div>";

    try {
      const res = await apiRequest("/api/v1/tasks/submit", {
        method: "POST",
        body: JSON.stringify({
          title,
          user_prompt: prompt,
          budget_usdc: budget
        })
      });

      statusTag.innerText = "Completed & Settled";
      statusTag.className = "status-tag success";

      // Render Dynamic DAG Nodes
      if (res.dag_plan && dagContainer) {
        dagContainer.innerHTML = "";
        res.dag_plan.forEach((st) => {
          const stepDiv = document.createElement("div");
          stepDiv.className = "dag-node-item completed";
          stepDiv.innerHTML = `
            <div class="dag-badge">Step ${st.step_order}</div>
            <strong>${st.domain.toUpperCase()} SPECIALIST</strong>
            <p style="font-size:12px; margin-top:4px; color:var(--text-muted);">${st.title}</p>
          `;
          dagContainer.appendChild(stepDiv);
        });
      }

      // Display Proof Hash
      proofBar.style.display = "flex";
      proofHashVal.innerText = res.proof_of_task_hash;

      // Render Deliverables
      outputConsole.innerText = res.final_output;
      showAlert("Swarm task executed, verified, and settled!");
      loadMyTasks();
      loadFinancialSummary();
    } catch (err) {
      statusTag.innerText = "Execution Failed";
      statusTag.className = "status-tag";
      outputConsole.innerText = `Error: ${err.message}`;
      showAlert(err.message, true);
    }
  });
}

async function loadMyTasks() {
  if (!currentUser) return;
  const listContainer = document.getElementById("user-tasks-list");
  try {
    const tasks = await apiRequest("/api/v1/tasks/my");
    if (!tasks || tasks.length === 0) {
      listContainer.innerHTML = "<div class='empty-hint'>No past tasks yet.</div>";
      return;
    }

    listContainer.innerHTML = "";
    tasks.forEach(t => {
      const item = document.createElement("div");
      item.className = "project-item";
      item.innerHTML = `
        <strong>📁 ${t.title}</strong>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
          ${t.status} • $${t.budget_usdc.toFixed(2)} USDC
        </div>
      `;
      item.addEventListener("click", () => inspectTask(t.id));
      listContainer.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load tasks:", err);
  }
}

async function inspectTask(taskId) {
  try {
    const t = await apiRequest(`/api/v1/tasks/${taskId}`);
    const execCard = document.getElementById("execution-card");
    const outputConsole = document.getElementById("swarm-output");
    const statusTag = document.getElementById("swarm-status");
    const proofBar = document.getElementById("proof-bar");
    const proofHashVal = document.getElementById("proof-hash-val");

    execCard.style.display = "block";
    statusTag.innerText = t.status;
    statusTag.className = "status-tag success";

    if (t.proof_of_task_hash) {
      proofBar.style.display = "flex";
      proofHashVal.innerText = t.proof_of_task_hash;
    }
    outputConsole.innerText = t.final_output || "No deliverables recorded.";
  } catch (err) {
    showAlert(err.message, true);
  }
}

// ---------------------------------------------------------------------------
// 5. MARKETPLACE
// ---------------------------------------------------------------------------
function setupMarketplace() {
  const searchInput = document.getElementById("mkt-search");
  const catFilter = document.getElementById("mkt-category-filter");
  const btnRefresh = document.getElementById("btn-refresh-marketplace");

  btnRefresh.addEventListener("click", loadMarketplaceAgents);
  searchInput.addEventListener("input", debounce(loadMarketplaceAgents, 400));
  catFilter.addEventListener("change", loadMarketplaceAgents);

  loadMarketplaceAgents();
}

async function loadMarketplaceAgents() {
  const container = document.getElementById("marketplace-grid");
  const search = document.getElementById("mkt-search").value;
  const category = document.getElementById("mkt-category-filter").value;

  try {
    let url = `/api/v1/marketplace/agents?limit=30`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await apiRequest(url);
    if (!res.agents || res.agents.length === 0) {
      container.innerHTML = "<div class='empty-hint' style='grid-column: 1 / -1;'>No marketplace agents matching criteria. Publish your first agent in the Studio!</div>";
      return;
    }

    container.innerHTML = "";
    res.agents.forEach(agent => {
      const card = document.createElement("div");
      card.className = "agent-card";
      card.innerHTML = `
        <span class="cat-badge">${agent.category}</span>
        <h3>${agent.name}</h3>
        <p class="desc">${agent.description}</p>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          🤖 ${agent.model_provider.toUpperCase()} (${agent.model_name}) • ⭐ ${agent.rating} (${agent.total_reviews} reviews)
        </div>
        <div class="agent-card-footer">
          <span class="agent-price">$${agent.price_per_call_usdc.toFixed(4)} USDC</span>
          <button class="btn btn-primary btn-sm" onclick="hireMarketplaceAgent('${agent.id}', '${agent.name}')">Hire Agent</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div class='empty-hint' style='grid-column: 1 / -1; color: var(--accent-red);'>Failed to load agents: ${err.message}</div>`;
  }
}

window.hireMarketplaceAgent = function(agentId, agentName) {
  // Populate task prompt in Workspace
  document.querySelector('[data-tab="workspace"]').click();
  document.getElementById("task-title").value = `Direct Hire: ${agentName}`;
  document.getElementById("task-prompt").value = `Execute specialized assignment with ${agentName}. Objective: `;
  document.getElementById("task-prompt").focus();
  showAlert(`Loaded ${agentName} into Workspace. Provide your goal instructions and launch!`);
};

// ---------------------------------------------------------------------------
// 6. AGENT STUDIO
// ---------------------------------------------------------------------------
function setupAgentStudio() {
  const form = document.getElementById("form-create-agent");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showAlert("Please sign in to create and manage agents.", true);
      document.getElementById("auth-modal").style.display = "flex";
      return;
    }

    const name = document.getElementById("agent-name").value.trim();
    const slug = document.getElementById("agent-slug").value.trim();
    const category = document.getElementById("agent-category").value;
    const price = parseFloat(document.getElementById("agent-price").value) || 0.005;
    const desc = document.getElementById("agent-desc").value.trim();

    const provider = document.getElementById("agent-provider").value;
    const model = document.getElementById("agent-model").value.trim();
    const temp = parseFloat(document.getElementById("agent-temp").value) || 0.3;
    const tokens = parseInt(document.getElementById("agent-tokens").value) || 4096;
    const instructions = document.getElementById("agent-instructions").value.trim();

    const permNetwork = document.getElementById("perm-network").checked;
    const permFsRead = document.getElementById("perm-fs-read").checked;
    const permFsWrite = document.getElementById("perm-fs-write").checked;
    const permShell = document.getElementById("perm-shell").checked;

    try {
      // 1. Create Agent
      const createRes = await apiRequest("/api/v1/agents", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          description: desc,
          category,
          price_per_call_usdc: price,
          initial_version: {
            version: "v1.0.0",
            system_instructions: instructions,
            model_provider: provider,
            model_name: model,
            temperature: temp,
            max_tokens: tokens
          },
          tool_permissions: [
            {
              tool_name: "core_capabilities",
              network_enabled: permNetwork,
              filesystem_read: permFsRead,
              filesystem_write: permFsWrite,
              shell_enabled: permShell
            }
          ]
        })
      });

      // 2. Validate Agent
      const valRes = await apiRequest(`/api/v1/agents/${createRes.agent_id}/validate`, { method: "POST" });

      if (valRes.passed) {
        // 3. Submit for Review
        await apiRequest(`/api/v1/agents/${createRes.agent_id}/submit`, { method: "POST" });
        showAlert(`Agent '${name}' created, validated (Risk: ${valRes.risk_score}/100), and submitted for Admin Review!`);
      } else {
        showAlert(`Agent created but validation flagged issues (Risk: ${valRes.risk_score}/100). Status: ${valRes.new_agent_status}`, true);
      }

      form.reset();
      loadMyAgents();
    } catch (err) {
      showAlert(err.message, true);
    }
  });
}

async function loadMyAgents() {
  const container = document.getElementById("my-agents-list");
  if (!container || !currentUser) return;

  try {
    const agents = await apiRequest("/api/v1/agents/my");
    if (!agents || agents.length === 0) {
      container.innerHTML = "<div class='empty-hint'>You haven't created any agents yet. Fill out the form above to deploy one!</div>";
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Status</th>
            <th>Price</th>
            <th>Versions</th>
          </tr>
        </thead>
        <tbody>
          ${agents.map(a => `
            <tr>
              <td><strong>${a.name}</strong> (${a.slug})</td>
              <td>${a.category}</td>
              <td><span class="status-tag ${a.status === 'PUBLISHED' ? 'success' : ''}">${a.status}</span></td>
              <td>$${a.price_per_call_usdc.toFixed(4)} USDC</td>
              <td>${a.versions_count}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class='empty-hint' style='color: var(--accent-red);'>${err.message}</div>`;
  }
}

// ---------------------------------------------------------------------------
// 7. FINANCIAL LEDGER & WITHDRAWALS
// ---------------------------------------------------------------------------
function setupFinancialLedger() {
  const form = document.getElementById("form-withdrawal");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showAlert("Please sign in to request withdrawals.", true);
      return;
    }

    const wallet = document.getElementById("withdraw-wallet").value.trim();
    const amount = parseFloat(document.getElementById("withdraw-amount").value);

    try {
      const res = await apiRequest("/api/v1/financial/withdraw", {
        method: "POST",
        body: JSON.stringify({ destination_wallet: wallet, amount_usdc: amount })
      });

      showAlert(`Withdrawal of $${amount.toFixed(2)} USDC requested! Status: ${res.withdrawal_status}`);
      loadFinancialSummary();
    } catch (err) {
      showAlert(err.message, true);
    }
  });
}

async function loadFinancialSummary() {
  if (!currentUser) return;
  const balanceVal = document.getElementById("ledger-balance");
  const tableBody = document.getElementById("ledger-entries-body");

  try {
    const summary = await apiRequest("/api/v1/financial/summary");
    if (balanceVal) {
      balanceVal.innerText = `$${summary.available_balance_usdc.toFixed(2)} USDC`;
    }

    if (tableBody && summary.recent_entries && summary.recent_entries.length > 0) {
      tableBody.innerHTML = summary.recent_entries.map(e => `
        <tr>
          <td>${new Date(e.created_at).toLocaleString()}</td>
          <td><span class="status-tag ${e.type === 'CREDIT' ? 'success' : ''}">${e.type}</span></td>
          <td>${e.description}</td>
          <td style="font-family: var(--font-mono); font-weight: 700;">${e.type === 'CREDIT' ? '+' : '-'}$${e.amount.toFixed(2)}</td>
          <td style="font-family: var(--font-mono);">$${e.balance_after.toFixed(2)}</td>
        </tr>
      `).join("");
    }
  } catch (err) {
    console.error("Failed to load financial summary:", err);
  }
}

// ---------------------------------------------------------------------------
// 8. ADMIN CONSOLE & AUDIT TRAIL
// ---------------------------------------------------------------------------
function setupAdminConsole() {
  // Loaded when admin tab is opened
}

async function loadAdminDashboard() {
  const pendingContainer = document.getElementById("admin-pending-agents");
  const auditBody = document.getElementById("admin-audit-logs-body");
  const secBody = document.getElementById("admin-sec-events-body");

  try {
    // 1. Audit logs
    const logs = await apiRequest("/api/v1/admin/audit-logs");
    if (auditBody && logs) {
      auditBody.innerHTML = logs.length ? logs.map(l => `
        <tr>
          <td>${new Date(l.timestamp).toLocaleString()}</td>
          <td>${l.actor_id ? `${l.actor_id.slice(0,8)}...` : 'System'}</td>
          <td><strong>${l.action}</strong></td>
          <td>${l.resource_type}</td>
          <td>${l.resource_id || 'N/A'}</td>
        </tr>
      `).join("") : "<tr><td colspan='5' class='empty-cell'>No audit logs recorded yet.</td></tr>";
    }

    // 2. Security Events
    const secEvents = await apiRequest("/api/v1/admin/security-events");
    if (secBody && secEvents) {
      secBody.innerHTML = secEvents.length ? secEvents.map(s => `
        <tr>
          <td>${new Date(s.timestamp).toLocaleString()}</td>
          <td><span class="status-tag ${s.severity === 'CRITICAL' ? '' : 'pulse'}">${s.event_type}</span></td>
          <td><strong>${s.severity}</strong></td>
          <td>${s.mitigated ? '✅ Mitigated' : '⚠️ Flagged'}</td>
          <td><code>${JSON.stringify(s.payload)}</code></td>
        </tr>
      `).join("") : "<tr><td colspan='5' class='empty-cell'>No security incidents detected. Platform secure.</td></tr>";
    }

    // 3. Pending Agents
    const pending = await apiRequest("/api/v1/admin/agents/pending");
    if (pendingContainer && pending) {
      pendingContainer.innerHTML = pending.length ? `
        <table class="data-table">
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pending.map(p => `
              <tr>
                <td><strong>${p.name}</strong> (${p.slug})</td>
                <td>${p.category}</td>
                <td>${p.status}</td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="adminApproveAgent('${p.id}')">Approve</button>
                  <button class="btn btn-outline btn-sm" onclick="adminSuspendAgent('${p.id}')" style="margin-left: 6px;">Suspend</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : "<div class='empty-hint'>No agents currently pending moderation.</div>";
    }
  } catch (err) {
    if (pendingContainer) pendingContainer.innerHTML = `<div class='empty-hint' style='color: var(--accent-red);'>Admin Access Restricted: ${err.message}</div>`;
  }
}

window.adminApproveAgent = async function(agentId) {
  try {
    await apiRequest(`/api/v1/admin/agents/${agentId}/approve`, { method: "POST" });
    showAlert("Agent approved successfully.");
    loadAdminDashboard();
  } catch (err) {
    showAlert(err.message, true);
  }
};

window.adminSuspendAgent = async function(agentId) {
  try {
    await apiRequest(`/api/v1/admin/agents/${agentId}/suspend`, { method: "POST" });
    showAlert("Agent suspended.");
    loadAdminDashboard();
  } catch (err) {
    showAlert(err.message, true);
  }
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
