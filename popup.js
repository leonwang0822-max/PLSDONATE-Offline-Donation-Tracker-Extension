document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiUrl'], (result) => {
    // Default to the production URL
    const API_URL = result.apiUrl || 'https://plsdonategifts.com';
    initPopup(API_URL);
  });
});

function initPopup(API_URL) {
  fetchData(API_URL);
  
  document.getElementById('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: API_URL });
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    chrome.storage.sync.remove('authToken', () => {
      initPopup(API_URL); // Re-init to show login screen
    });
  });
  
  // Add retry listener if needed
  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'retry-btn') {
      fetchData(API_URL);
    }
  });
}

async function fetchData(baseUrl) {
  const container = document.getElementById('feed-container');
  container.innerHTML = `
    <div class="text-center py-10 text-slate-400">
      <div class="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2"></div>
      <p class="text-xs">Connecting to tracker...</p>
    </div>
  `;
  
  try {
    const { authToken } = await chrome.storage.sync.get(['authToken']);
    const logoutBtn = document.getElementById('logout-btn');
    
    if (authToken) {
      logoutBtn.classList.remove('hidden');
    } else {
      logoutBtn.classList.add('hidden');
    }

    const headers = {
      'Accept': 'application/json'
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${baseUrl}/api/donations`, { headers });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Please Login to plsdonategifts.com');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const donations = await response.json();
    renderDonations(donations);
    updateStats(donations);
    
  } catch (error) {
    console.error('Fetch error:', error);
    const isAuthError = error.message.includes('Login');
    
    // Hide logout button on error to avoid confusion or keep it if it's just a network error?
    // Better to keep it hidden if it's an auth error (user is effectively logged out)
    if (isAuthError) {
      document.getElementById('logout-btn').classList.add('hidden');
      
      // Minimal Login State
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full py-8 text-center">
          <div class="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-4 text-emerald-500 dark:text-emerald-400">
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
          </div>
          <h3 class="font-bold text-slate-800 dark:text-slate-100 mb-1">Connect Account</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-[200px]">
            Please log in to the dashboard to sync your donations.
          </p>
          <button id="login-btn" class="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30">
            Open Dashboard
          </button>
        </div>
      `;
      
      document.getElementById('login-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: `${baseUrl}/extension/login` });
      });
      return;
    }

    container.innerHTML = `
      <div class="text-center py-10 text-slate-500">
        <div class="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
        </div>
        <h3 class="font-bold">Connection Failed</h3>
        <p class="text-xs mt-1 mb-3 text-red-500">${error.message === 'Failed to fetch' ? 'Network/CORS Error' : error.message}</p>
        <p class="text-[10px] text-slate-400 mb-3">Target: ${baseUrl}</p>
        <button id="retry-btn" class="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors">Retry Connection</button>
      </div>
    `;
    
    document.getElementById('retry-btn').addEventListener('click', () => {
      fetchData(baseUrl);
    });

    // Hidden settings access just in case
    // document.getElementById('open-settings').addEventListener('click', () => ...
  }
}

function renderDonations(donations) {
  const container = document.getElementById('feed-container');
  
  if (donations.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <p>No donations yet.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = donations
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20) // Show last 20
    .map(d => createDonationCard(d))
    .join('');
}

function createDonationCard(donation) {
  const amount = Number(donation.amount).toLocaleString();
  const date = new Date(donation.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const isOwner = donation.senderId === 7453565354;

  return `
    <div class="donation-card dark:bg-slate-800 dark:border-slate-700/50 p-3 rounded-xl mb-3 border border-slate-100 shadow-sm bg-white group hover:border-emerald-500/30 transition-colors">
      <div class="flex justify-between items-start mb-2">
        <div class="flex items-center gap-2">
           <span class="text-[10px] font-medium text-slate-400">${date}</span>
           ${isOwner ? `
             <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-500 text-[9px] font-bold border border-yellow-400/20">
               <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"></path></svg>
               DEV
             </span>
           ` : ''}
        </div>
        <div class="font-black text-base text-emerald-500">R$${amount}</div>
      </div>
      
      <div class="flex items-center justify-between gap-2 mb-3">
        <!-- Sender -->
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm truncate text-slate-900 dark:text-slate-200" title="${donation.senderDisplayName}">${donation.senderDisplayName}</div>
          <div class="text-[10px] text-slate-400 truncate">@${donation.senderUsername}</div>
        </div>

        <!-- Arrow -->
        <div class="text-slate-300 dark:text-slate-600 px-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </div>

        <!-- Recipient -->
        <div class="flex-1 min-w-0 text-right">
          <div class="font-bold text-sm truncate text-slate-900 dark:text-slate-200" title="${donation.recipientDisplayName || donation.recipientName || donation.recipientUsername}">
            ${donation.recipientDisplayName || donation.recipientName || donation.recipientUsername || 'Unknown'}
          </div>
          <div class="text-[10px] text-slate-400 truncate">@${donation.recipientUsername}</div>
        </div>
      </div>
      
      ${donation.message ? `
        <div class="mt-2 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
          <p class="text-xs text-slate-600 dark:text-slate-400 italic break-words line-clamp-2">"${donation.message}"</p>
        </div>
      ` : ''}
    </div>
  `;
}

function updateStats(donations) {
  const total = donations.reduce((sum, d) => sum + Number(d.amount), 0);
  const recent = donations.filter(d => {
    const hours24 = 24 * 60 * 60 * 1000;
    return (Date.now() - new Date(d.timestamp).getTime()) < hours24;
  }).length;
  
  document.getElementById('stat-total').textContent = `R$${total.toLocaleString()}`;
  document.getElementById('stat-recent').textContent = recent;
}
