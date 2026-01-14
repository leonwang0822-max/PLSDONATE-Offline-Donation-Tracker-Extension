// Initialize alarm
chrome.alarms.create('pollDonations', { periodInMinutes: 0.5 }); // Check every 30 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollDonations') {
    checkDonations();
  }
});

// Listen for config updates from options page or auth sync from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONFIG_UPDATED') {
    checkDonations(); // Check immediately with new config
  }
  if (message.type === 'AUTH_SYNC') {
    chrome.storage.sync.set({ authToken: message.token }, () => {
      console.log('Auth token synced from website');
      checkDonations(); // Retry connection
    });
  }
});

async function checkDonations() {
  try {
    const { apiUrl, authToken } = await chrome.storage.sync.get(['apiUrl', 'authToken']);
    const baseUrl = apiUrl || 'https://plsdonategifts.com';
    
    const headers = {
      'Accept': 'application/json'
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${baseUrl}/api/donations`, { headers });
    if (!response.ok) return;
    
    const donations = await response.json();
    if (donations.length === 0) return;
    
    // Sort by timestamp descending
    donations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const latestDonation = donations[0];
    
    const { lastDonationId } = await chrome.storage.local.get(['lastDonationId']);
      
    // If first run, just save
    if (!lastDonationId) {
      chrome.storage.local.set({ lastDonationId: latestDonation.id });
      return;
    }
    
    // If new donation detected (ID mismatch)
    if (latestDonation.id !== lastDonationId) {
      // Notify
      notifyDonation(latestDonation);
      
      // Update storage
      chrome.storage.local.set({ lastDonationId: latestDonation.id });
    }
    
  } catch (error) {
    console.log('Connection failed', error);
  }
}

function notifyDonation(donation) {
  const isIncoming = donation.transactionType === 'incoming';
  const amount = Number(donation.amount).toLocaleString();
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Transparent pixel fallback
    title: isIncoming ? `🎉 New Donation: R$${amount}` : `💸 Transfer: R$${amount}`,
    message: `${donation.senderDisplayName} sent R$${amount}\n"${donation.message || ''}"`,
    priority: 2
  });
}
