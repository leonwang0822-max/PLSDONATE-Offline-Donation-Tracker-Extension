// content.js
// Runs on plsdonategifts.com to sync auth token to extension

console.log('PD Tracker Extension: Content Script Active');

function showSyncNotification(success) {
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.bottom = '20px';
  div.style.right = '20px';
  div.style.padding = '12px 20px';
  div.style.borderRadius = '8px';
  div.style.backgroundColor = success ? '#10b981' : '#ef4444';
  div.style.color = 'white';
  div.style.zIndex = '999999';
  div.style.fontFamily = 'system-ui, sans-serif';
  div.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
  div.style.transition = 'opacity 0.5s ease-out';
  div.style.fontSize = '14px';
  div.style.fontWeight = '500';
  div.style.display = 'flex';
  div.style.alignItems = 'center';
  div.style.gap = '8px';
  
  div.innerHTML = success 
    ? '<span>✓</span> PD Tracker: Login Synced'
    : '<span>✕</span> PD Tracker: Login Sync Failed';

  document.body.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 500);
  }, 3000);
}

function checkAuth() {
  try {
    const authStorage = localStorage.getItem('auth-storage');
    console.log('PD Tracker: Checking auth storage...', authStorage ? 'Found' : 'Not Found');
    
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      const token = parsed.state?.token;
      
      if (token) {
        console.log('PD Tracker: Token found, syncing...');
        chrome.runtime.sendMessage({
          type: 'AUTH_SYNC',
          token: token
        }, (response) => {
          // Check for lastError to detect if background script is reachable
          if (chrome.runtime.lastError) {
            console.error('PD Tracker: Sync Error', chrome.runtime.lastError);
          } else {
            console.log('PD Tracker: Sync Message Sent');
            showSyncNotification(true);
          }
        });
      } else {
        console.log('PD Tracker: No token in storage state');
      }
    }
  } catch (e) {
    console.error('PD Tracker: Error syncing auth:', e);
  }
}

// Check immediately
checkAuth();

// Check on storage change (login/logout)
window.addEventListener('storage', (e) => {
  if (e.key === 'auth-storage') {
    console.log('PD Tracker: Storage changed, re-checking...');
    checkAuth();
  }
});
