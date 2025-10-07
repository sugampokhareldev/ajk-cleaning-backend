// Tailwind configuration
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',
        'primary-dark': '#1e3a8a',
        secondary: '#059669',
        'secondary-dark': '#047857',
      }
    }
  }
}

// Enhanced Chat Widget System for AJK Cleaning
class ChatWidget {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isTyping = false;
    this.typingTimeout = null;
    this.reconnectInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.unreadCount = 0;
    this.identifyTimeout = null;
    this.hasIdentified = false; // Track if we've sent the initial identify message
    
    // Try to load existing client ID from storage
    this.clientId = localStorage.getItem('chatClientId') || this.generateClientId();
    this.userName = localStorage.getItem('chatUserName') || 'Guest';
    this.userEmail = localStorage.getItem('chatUserEmail') || '';
    
    // Store client ID for future sessions
    localStorage.setItem('chatClientId', this.clientId);
    
    this.init();
  }
  
  generateClientId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return 'client_' + crypto.randomUUID();
      }
    } catch (e) {}
    return 'client_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
  
  init() {
    this.attachEventListeners();
    this.connectWebSocket();
    
    // Load any saved messages
    this.loadSavedMessages();
    
    // Auto-open chat if there are unread messages
    if (localStorage.getItem('chat-unread-count')) {
      this.unreadCount = parseInt(localStorage.getItem('chat-unread-count')) || 0;
      this.updateUnreadBadge();
    }
  }
  
  // Method to save user info
  saveUserInfo() {
    localStorage.setItem('chatUserName', this.userName);
    localStorage.setItem('chatUserEmail', this.userEmail);
    
    // Send identification to server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendIdentifyMessage();
    }
  }
  
  sendIdentifyMessage() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'identify',
        name: this.userName,
        email: this.userEmail,
        isAdmin: false,
        clientId: this.clientId
      }));
    }
  }
  
  attachEventListeners() {
    const chatToggle = document.getElementById('chat-toggle-enhanced');
    const chatWindow = document.getElementById('chat-window-enhanced');
    const closeChat = document.getElementById('close-chat');
    const minimizeChat = document.getElementById('minimize-chat');
    const chatInput = document.getElementById('chat-input-enhanced');
    const chatSend = document.getElementById('chat-send-enhanced');
    const saveUserInfo = document.getElementById('save-user-info');
    
    if (!chatToggle) {
      console.error('Chat toggle element not found');
      return;
    }
    
    chatToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleChat();
    });
    
    if (closeChat) closeChat.addEventListener('click', () => this.closeChat());
    if (minimizeChat) minimizeChat.addEventListener('click', () => this.minimizeChat());
    if (chatSend) chatSend.addEventListener('click', () => this.sendMessage());
    if (saveUserInfo) saveUserInfo.addEventListener('click', () => this.saveUserInfoForm());
    
    // Handle Enter key for sending messages
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      
      chatInput.addEventListener('input', () => this.handleTyping());
    }
    
    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#chat-widget-enhanced') && 
          chatWindow && chatWindow.classList.contains('open')) {
        this.closeChat();
      }
    });
  }
  
  connectWebSocket() {
    try {
      // Determine WebSocket protocol based on current page protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}?clientId=${encodeURIComponent(this.clientId)}`;
      
      console.log('Attempting WebSocket connection to:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus();
        this.enableChatInput();
        
        // The 'identify' message is now sent only when the user opens the chat.
        // This prevents creating empty chat sessions for every site visitor.
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.updateConnectionStatus();
        this.disableChatInput();
        
        // Clear the identify timeout
        if (this.identifyTimeout) {
          clearTimeout(this.identifyTimeout);
          this.identifyTimeout = null;
        }
        
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
        this.updateConnectionStatus('Connection error');
        
        // Clear the identify timeout
        if (this.identifyTimeout) {
          clearTimeout(this.identifyTimeout);
          this.identifyTimeout = null;
        }
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.enableDemoMode();
    }
  }
  
  enableDemoMode() {
    console.log('Running in demo mode - no WebSocket connection');
    this.isConnected = true;
    setTimeout(() => {
      this.updateConnectionStatus();
      this.enableChatInput();
      this.sendWelcomeMessage();
    }, 1000);
  }
  
  sendWelcomeMessage() {
    // Only send welcome message if we haven't sent it before in this session
    if (!localStorage.getItem('welcomeSent')) {
      this.displayMessage(
        "Thank you for contacting AJK Cleaning! We have received your message and will get back to you shortly. For immediate assistance, please call us at +49-17661852286 or email Rajau691@gmail.com.",
        'system',
        'Support'
      );
      localStorage.setItem('welcomeSent', 'true');
    }
  }
  
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay/1000}s...`);
      this.updateConnectionStatus(`Reconnecting in ${delay/1000}s...`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connectWebSocket();
        }
        this.updateConnectionStatus();
      }, delay);
    } else {
      console.log('Max reconnection attempts reached');
      this.updateConnectionStatus('Disconnected');
    }
  }
  
  updateConnectionStatus(customStatus = null) {
    const indicator = document.getElementById('connection-indicator');
    const status = document.getElementById('chat-status');
    
    if (!indicator || !status) return;
    
    if (customStatus) {
      status.textContent = customStatus;
      indicator.classList.remove('connected');
      return;
    }
    
    if (this.isConnected) {
      status.textContent = 'Online';
      indicator.classList.add('connected');
    } else {
      status.textContent = 'Connecting...';
      indicator.classList.remove('connected');
    }
  }
  
  enableChatInput() {
    const chatInput = document.getElementById('chat-input-enhanced');
    const chatSend = document.getElementById('chat-send-enhanced');
    
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.placeholder = 'Type your message...';
    }
    if (chatSend) {
      chatSend.disabled = false;
    }
  }
  
  disableChatInput() {
    const chatInput = document.getElementById('chat-input-enhanced');
    const chatSend = document.getElementById('chat-send-enhanced');
    
    if (chatInput) {
      chatInput.disabled = true;
      chatInput.placeholder = 'Connecting to chat...';
    }
    if (chatSend) {
      chatSend.disabled = true;
    }
  }
  
  handleServerMessage(data) {
    console.log('Received server message:', data);
    
    switch (data.type) {
      case 'chat':
        // Always display admin messages, only display user messages if they're not from this client
        if (data.isAdmin || data.clientId !== this.clientId) {
          // Use data.message OR data.text (server might send either)
          const messageText = data.message || data.text;
          const messageType = data.type === 'system' ? 'system' : (data.isAdmin ? 'admin' : 'user');
          this.displayMessage(
            messageText,
            messageType, 
            data.name || (data.isAdmin ? 'Support' : 'Guest'),
            data.timestamp
          );
          
          // Save message to localStorage
          this.saveMessageToStorage({
            text: messageText,
            type: messageType,
            sender: data.name || (data.isAdmin ? 'Support' : 'Guest'),
            timestamp: data.timestamp || new Date().toISOString()
          });
          
          if (data.isAdmin) {
            this.playNotificationSound();
            this.incrementUnreadCount();
          }
        }
        break;
        
      case 'system':
        this.displayMessage(data.message, 'system', 'System', data.timestamp);
        break;
        
      case 'history':
        // Load chat history from server
        if (data.messages && Array.isArray(data.messages)) {
          // Clear UI and local cache before rendering server history
          const messagesContainer = document.getElementById('chat-messages');
          if (messagesContainer) { messagesContainer.innerHTML = ''; }
          try { localStorage.setItem('chatMessages', '[]'); } catch (e) {}

          data.messages.forEach(msg => {
            // Use msg.message OR msg.text (server might send either)
            const messageText = msg.message || msg.text;
            const messageType = msg.type === 'system' ? 'system' : (msg.isAdmin ? 'admin' : 'user');
            this.displayMessage(
              messageText,
              messageType,
              msg.name || (msg.isAdmin ? 'Support' : 'Guest'),
              msg.timestamp
            );
            
            // Save to localStorage
            this.saveMessageToStorage({
              text: messageText,
              type: messageType,
              sender: msg.name || (msg.isAdmin ? 'Support' : 'Guest'),
              timestamp: msg.timestamp
            });
          });
        }
        break;
        
      case 'typing':
        // Only show typing indicators from others
        if (data.clientId !== this.clientId) {
          this.showTypingIndicator(data.isTyping, data.name);
        }
        break;
        
      case 'admin':
        // Admin notifications (for debugging)
        console.log('Admin notification:', data.message);
        break;
        
      case 'chat_reset':
        this.handleChatReset();
        break;
        
      case 'client_id':
        // Clear the identify timeout
        if (this.identifyTimeout) {
          clearTimeout(this.identifyTimeout);
          this.identifyTimeout = null;
        }

        // Update client ID if server provides a different one
        if (data.clientId && data.clientId !== this.clientId) {
          this.clientId = data.clientId;
          localStorage.setItem('chatClientId', this.clientId);
          console.log('Received new client ID:', this.clientId);
        }
        
        // Do not clear UI or local cache on client_id; history may have just been loaded
        // Now identify ourselves to the server with the updated clientId
        this.sendIdentifyMessage();
        break;
        
      default:
        // If we receive any message, it implies the server is aware of us.
        // If we haven't identified yet, and the chat is open, do so.
        const chatWindow = document.getElementById('chat-window-enhanced');
        if (!this.hasIdentified && chatWindow && chatWindow.classList.contains('open')) this.sendIdentifyMessage();
    }
  }
  
  saveMessageToStorage(message) {
    try {
      // Get existing messages
      const storedMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
      
      // Add new message
      storedMessages.push(message);
      
      // Save back to localStorage (limit to 100 messages to prevent storage issues)
      if (storedMessages.length > 100) {
        storedMessages.splice(0, storedMessages.length - 100);
      }
      
      localStorage.setItem('chatMessages', JSON.stringify(storedMessages));
    } catch (error) {
      console.error('Error saving message to storage:', error);
    }
  }
  
  loadSavedMessages() {
    try {
      const storedMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
      
      storedMessages.forEach(msg => {
        this.displayMessage(
          msg.text,
          msg.type,
          msg.sender,
          msg.timestamp
        );
      });
    } catch (error) {
      console.error('Error loading saved messages:', error);
    }
  }
  
  displayMessage(message, type, sender = '', timestamp = null) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const time = timestamp ? new Date(timestamp) : new Date();
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
      <div class="message-content">
        ${message.split('\n').map(line => `<p>${this.escapeHtml(line)}</p>`).join('')}
      </div>
      <div class="message-time">${timeStr}${sender && sender !== 'Guest' ? ` • ${sender}` : ''}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }
  
  showTypingIndicator(isTyping, senderName = 'Support') {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;
    
    const typingText = indicator.querySelector('.typing-text');
    
    if (isTyping) {
      typingText.textContent = `${senderName} is typing...`;
      indicator.style.display = 'flex';
    } else {
      indicator.style.display = 'none';
    }
    
    this.scrollToBottom();
  }
  
  toggleChat() {
    const chatWindow = document.getElementById('chat-window-enhanced');
    if (!chatWindow) return;
    
    const isOpen = chatWindow.classList.contains('open');
    
    if (isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }
  
  openChat() {
    const chatWindow = document.getElementById('chat-window-enhanced');
    const userInfo = document.getElementById('user-info');
    const chatInputArea = document.getElementById('chat-input-area');
    
    if (!chatWindow) return;
    
    chatWindow.style.display = 'flex';
    setTimeout(() => {
      chatWindow.classList.add('open');
    }, 10);
    
    // Show user info form if name is not set
    if ((!this.userName || this.userName === 'Guest') && userInfo && chatInputArea) {
      userInfo.style.display = 'flex';
      chatInputArea.style.display = 'none';
    } else if (userInfo && chatInputArea) {
      userInfo.style.display = 'none';
      chatInputArea.style.display = 'flex';
    }
    
    // Identify the user to the server the first time they open the chat.
    if (!this.hasIdentified && this.isConnected) {
      this.sendIdentifyMessage();
      this.hasIdentified = true;
    }
    
    this.clearUnreadCount();
    this.scrollToBottom();
  }
  
  closeChat() {
    const chatWindow = document.getElementById('chat-window-enhanced');
    if (!chatWindow) return;
    
    chatWindow.classList.remove('open');
    
    setTimeout(() => {
      chatWindow.style.display = 'none';
    }, 300);
  }
  
  minimizeChat() {
    this.closeChat();
  }
  
  // This method is called when the user submits the user info form
  saveUserInfoForm() {
    const nameInput = document.getElementById('user-name');
    const emailInput = document.getElementById('user-email');
    const userInfo = document.getElementById('user-info');
    const chatInputArea = document.getElementById('chat-input-area');
    const chatInput = document.getElementById('chat-input-enhanced');
    
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    const email = emailInput ? emailInput.value.trim() : '';
    
    if (!name) {
      nameInput.focus();
      nameInput.style.borderColor = '#ef4444';
      setTimeout(() => {
        nameInput.style.borderColor = '';
      }, 3000);
      return;
    }
    
    this.userName = name;
    this.userEmail = email;
    
    // Save to localStorage
    localStorage.setItem('chatUserName', name);
    if (email) localStorage.setItem('chatUserEmail', email);
    
    // Hide user info form and show chat input
    if (userInfo) userInfo.style.display = 'none';
    if (chatInputArea) chatInputArea.style.display = 'flex';
    
    // Update identification on server if connected
    this.sendIdentifyMessage();
    
    if (chatInput) chatInput.focus();
  }
  
  sendMessage() {
    const chatInput = document.getElementById('chat-input-enhanced');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Clear input immediately to prevent double-sending
    chatInput.value = '';
    
    console.log('Sending message:', message);
    
    // Display user message immediately for better UX
    this.displayMessage(message, 'user', this.userName);
    
    // Save to localStorage
    this.saveMessageToStorage({
      text: message,
      type: 'user',
      sender: this.userName,
      timestamp: new Date().toISOString()
    });
    
    // Send to server if connected
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'chat',
        text: message,
        name: this.userName,
        email: this.userEmail,
        clientId: this.clientId,
        timestamp: new Date().toISOString()
      }));
    } else {
      // Demo response when not connected to server
      console.log('Not connected to server, showing demo response');
      setTimeout(() => {
        this.displayMessage(
          "Thanks for your message! We're currently offline, but we'll get back to you soon. You can also call us at +49 017616146259.", 
          'admin', 
          'Support'
        );
        
        // Save demo response to storage
        this.saveMessageToStorage({
          text: "Thanks for your message! We're currently offline, but we'll get back to you soon. You can also call us at +49 017616146259.",
          type: 'admin',
          sender: 'Support',
          timestamp: new Date().toISOString()
        });
      }, 1000);
    }
    
    this.stopTyping();
  }
  
  handleTyping() {
    if (!this.isConnected) return;
    
    if (!this.isTyping) {
      this.isTyping = true;
      // Send typing indicator to server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'typing',
          isTyping: true,
          clientId: this.clientId
        }));
      }
    }
    
    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // Set new timeout to stop typing indicator
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 1000);
  }
  
  stopTyping() {
    if (this.isTyping) {
      this.isTyping = false;
      // Send stop typing indicator to server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'typing',
          isTyping: false,
          clientId: this.clientId
        }));
      }
    }
  }
  
  scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
  
  incrementUnreadCount() {
    const chatWindow = document.getElementById('chat-window-enhanced');
    if (!chatWindow || chatWindow.classList.contains('open')) return;
    
    this.unreadCount++;
    this.updateUnreadBadge();
    localStorage.setItem('chat-unread-count', this.unreadCount.toString());
  }
  
  clearUnreadCount() {
    this.unreadCount = 0;
    this.updateUnreadBadge();
    localStorage.setItem('chat-unread-count', '0');
  }

  // Handle server-initiated chat reset (e.g., admin deleted this chat)
  handleChatReset() {
    try {
      localStorage.removeItem('chatMessages');
      localStorage.removeItem('chat-unread-count');
      localStorage.removeItem('welcomeSent');
      localStorage.removeItem('chatUserName');
      localStorage.removeItem('chatUserEmail');
      localStorage.removeItem('chatClientId');
    } catch (e) {}

    this.userName = 'Guest';
    this.userEmail = '';
    this.clearUnreadCount();

    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
    }

    // Generate a new clientId so the next session is a brand-new ticket
    this.clientId = this.generateClientId();
    try { localStorage.setItem('chatClientId', this.clientId); } catch (e) {}

    // Inform the user
    this.displayMessage('Chat was reset. Please start a new conversation.', 'system', 'System', new Date().toISOString());

    // Force a reconnect so the server can initialize a fresh chat session
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.close(4000, 'reset'); } catch (e) {}
    } else {
      // If not open, connect immediately with the new clientId
      this.connectWebSocket();
    }
  }
  
  updateUnreadBadge() {
    const badge = document.getElementById('unread-badge');
    if (!badge) return;
    
    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
  
  playNotificationSound() {
    // Create a subtle notification sound
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gain.gain.setValueAtTime(0.1, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Ignore audio errors
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Enhanced mobile menu toggle
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
      mobileMenu.classList.toggle('open');
      menuBtn.classList.toggle('menu-open');
      menuBtn.setAttribute('aria-expanded', !isExpanded);
      mobileMenu.setAttribute('aria-hidden', isExpanded);
    });
    
    // Close mobile menu when clicking on links
    document.querySelectorAll('#mobile-menu a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        menuBtn.classList.remove('menu-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
      });
    });
  }
  
  // Enhanced Navbar scroll effect
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-link');
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('navbar-scrolled');
      navbar.classList.add('py-2');
      navbar.classList.remove('py-3');
    } else {
      navbar.classList.remove('navbar-scrolled');
      navbar.classList.remove('py-2');
      navbar.classList.add('py-3');
    }
    
    // Update active nav link based on scroll position
    const sections = document.querySelectorAll('section');
    let currentSection = '';
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      
      if (window.scrollY >= sectionTop - 100) {
        currentSection = section.getAttribute('id');
      }
    });
    
    navLinks.forEach(link => {
      link.classList.remove('active');
      link.setAttribute('aria-current', 'false');
      if (link.getAttribute('href').substring(1) === currentSection) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
    
    // Set Home as active if at the top of the page
    if (window.scrollY < 100) {
      const homeLink = document.querySelector('a[href="#home"]');
      if (homeLink) {
        homeLink.classList.add('active');
        homeLink.setAttribute('aria-current', 'page');
      }
    }
  });
  
  // Testimonial carousel
  const testimonialContainer = document.getElementById('testimonial-container');
  const testimonialDots = document.querySelectorAll('.testimonial-dot');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  let currentTestimonial = 0;
  
  function showTestimonial(index) {
    if (testimonialContainer) {
      testimonialContainer.scrollTo({
        left: testimonialContainer.clientWidth * index,
        behavior: 'smooth'
      });
    }
    
    // Update active dot
    testimonialDots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add('bg-primary');
        dot.classList.remove('bg-gray-300');
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.classList.remove('bg-primary');
        dot.classList.add('bg-gray-300');
        dot.setAttribute('aria-current', 'false');
      }
    });
    
    currentTestimonial = index;
  }
  
  testimonialDots.forEach((dot, index) => {
    dot.addEventListener('click', () => showTestimonial(index));
  });
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      let newIndex = currentTestimonial - 1;
      if (newIndex < 0) newIndex = testimonialDots.length - 1;
      showTestimonial(newIndex);
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      let newIndex = currentTestimonial + 1;
      if (newIndex >= testimonialDots.length) newIndex = 0;
      showTestimonial(newIndex);
    });
  }
  
  // Auto-rotate testimonials
  if (testimonialDots.length > 0) {
    setInterval(() => {
      let newIndex = currentTestimonial + 1;
      if (newIndex >= testimonialDots.length) newIndex = 0;
      showTestimonial(newIndex);
    }, 6000);
  }
  
  // FIXED FORM VALIDATION AND SUBMISSION
  const contactForm = document.getElementById('contact-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const nameError = document.getElementById('name-error');
  const emailError = document.getElementById('email-error');
  const submitBtn = document.getElementById('submit-btn');
  const submitText = document.getElementById('submit-text');
  const submitLoading = document.getElementById('submit-loading');
  const formSuccess = document.getElementById('form-success');
  const formError = document.getElementById('form-error');
  
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      console.log('Form submission started...');
      
      let isValid = true;
      
      // Validate name
      if (!nameInput.value.trim()) {
        if (nameError) nameError.classList.remove('hidden');
        if (nameInput) nameInput.setAttribute('aria-invalid', 'true');
        isValid = false;
        console.log('Name validation failed');
      } else {
        if (nameError) nameError.classList.add('hidden');
        if (nameInput) nameInput.setAttribute('aria-invalid', 'false');
      }
      
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value)) {
        if (emailError) emailError.classList.remove('hidden');
        if (emailInput) emailInput.setAttribute('aria-invalid', 'true');
        isValid = false;
        console.log('Email validation failed');
      } else {
        if (emailError) emailError.classList.add('hidden');
        if (emailInput) emailInput.setAttribute('aria-invalid', 'false');
      }
      
      if (isValid) {
        // Show loading state
        if (submitText) submitText.classList.add('hidden');
        if (submitLoading) submitLoading.classList.remove('hidden');
        if (submitBtn) submitBtn.disabled = true;
        
        try {
          // Prepare form data
          const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone')?.value?.trim() || '',
            service: document.getElementById('service')?.value || '',
            message: document.getElementById('message')?.value?.trim() || ''
          };
          
          console.log('Submitting form data:', formData);
          
          // Submit to the correct endpoint
          const response = await fetch('/api/form/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
            credentials: 'include'
          });
          
          console.log('Response status:', response.status);
          const responseData = await response.json();
          console.log('Response data:', responseData);
          
          if (response.ok && responseData.success) {
            // Show success message
            if (formSuccess) formSuccess.classList.remove('hidden');
            if (formError) formError.classList.add('hidden');
            
            // Reset form
            contactForm.reset();
            
            console.log('✅ Form submitted successfully!');
            
            // Auto-hide success message after 5 seconds
            setTimeout(() => {
              if (formSuccess) formSuccess.classList.add('hidden');
            }, 5000);
            
          } else {
            throw new Error(responseData.error || 'Submission failed');
          }
          
        } catch (error) {
          console.error('❌ Form submission error:', error);
          
          // Show error message
          if (formError) {
            formError.classList.remove('hidden');
            formError.textContent = `Error: ${error.message}`;
          }
          if (formSuccess) formSuccess.classList.add('hidden');
          
        } finally {
          // Reset button state
          if (submitText) submitText.classList.remove('hidden');
          if (submitLoading) submitLoading.classList.add('hidden');
          if (submitBtn) submitBtn.disabled = false;
        }
      } else {
        console.log('Form validation failed');
      }
    });
  }
  
  // Add intersection observer for animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in-up');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // Observe elements with the animation class
  document.querySelectorAll('.service-card, .testimonial-slide').forEach(el => {
    observer.observe(el);
  });
  
  // Set Home as active on page load
  const homeLink = document.querySelector('a[href="#home"]');
  if (homeLink) {
    homeLink.classList.add('active');
    homeLink.setAttribute('aria-current', 'page');
  }
  
  // Add touch event listeners for mobile
  if ('ontouchstart' in window) {
    // Increase touch targets for mobile
    document.querySelectorAll('a, button').forEach(el => {
      if (el.offsetWidth < 44 || el.offsetHeight < 44) {
        el.style.minWidth = '44px';
        el.style.minHeight = '44px';
        el.style.display = 'inline-flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
      }
    });
  }
  
  // Initialize enhanced chat widget
  setTimeout(() => {
    window.chatWidget = new ChatWidget();
    console.log('Chat widget initialized');
  }, 500);
});

// Test function to check server connectivity
async function testServerConnection() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    console.log('Server connection test:', data);
    return data;
  } catch (error) {
    console.error('Server connection failed:', error);
    return null;
  }
}

// Accessibility: Keyboard Navigation Support
document.addEventListener('DOMContentLoaded', function() {
  // Skip links functionality
  const skipLinks = document.querySelectorAll('.skip-link');
  skipLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Enhanced keyboard navigation for mobile menu
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (menuBtn && mobileMenu) {
    // Handle Enter and Space key presses
    menuBtn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });

    // Trap focus within mobile menu when open
    mobileMenu.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        menuBtn.click();
        menuBtn.focus();
      }
    });
  }

  // Enhanced form validation with accessibility
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    const inputs = contactForm.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      // Real-time validation with accessibility
      input.addEventListener('blur', function() {
        validateField(this);
      });
      
      input.addEventListener('input', function() {
        clearFieldError(this);
      });
    });
  }

  // Focus management for modals and overlays
  let focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  
  function trapFocus(element) {
    const focusableContent = element.querySelectorAll(focusableElements);
    const firstFocusableElement = focusableContent[0];
    const lastFocusableElement = focusableContent[focusableContent.length - 1];

    element.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
          }
        }
      }
    });
  }

  // Apply focus trapping to mobile menu
  if (mobileMenu) {
    trapFocus(mobileMenu);
  }
});

// Enhanced form validation with accessibility
function validateField(field) {
  const errorElement = document.getElementById(field.id + '-error');
  let isValid = true;
  let errorMessage = '';

  // Clear previous errors
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.classList.add('hidden');
  }

  // Validation rules
  if (field.hasAttribute('required') && !field.value.trim()) {
    isValid = false;
    errorMessage = 'This field is required';
  } else if (field.type === 'email' && field.value && !isValidEmail(field.value)) {
    isValid = false;
    errorMessage = 'Please enter a valid email address';
  } else if (field.type === 'tel' && field.value && !isValidPhone(field.value)) {
    isValid = false;
    errorMessage = 'Please enter a valid phone number';
  }

  // Display error if invalid
  if (!isValid && errorElement) {
    errorElement.textContent = errorMessage;
    errorElement.classList.remove('hidden');
    field.setAttribute('aria-invalid', 'true');
  } else {
    field.setAttribute('aria-invalid', 'false');
  }

  return isValid;
}

function clearFieldError(field) {
  const errorElement = document.getElementById(field.id + '-error');
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.classList.add('hidden');
  }
  field.setAttribute('aria-invalid', 'false');
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone) {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// PWA (Progressive Web App) Features
class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.installPrompt = document.getElementById('pwa-install-prompt');
    this.installBtn = document.getElementById('pwa-install-btn');
    this.dismissBtn = document.getElementById('pwa-dismiss-btn');
    
    this.init();
  }
  
  init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      this.registerServiceWorker();
    }
    
    // Handle install prompt
    this.setupInstallPrompt();
    
    // Handle app installation
    this.setupInstallHandlers();
    
    // Check if app is already installed
    this.checkInstallStatus();
  }
  
  async registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      
      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.showUpdateNotification();
          }
        });
      });
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
  
  setupInstallPrompt() {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA install prompt triggered');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt();
    });
    
    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.hideInstallPrompt();
      this.showInstallSuccess();
    });
  }
  
  setupInstallHandlers() {
    if (this.installBtn) {
      this.installBtn.addEventListener('click', async () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          console.log('PWA install outcome:', outcome);
          this.deferredPrompt = null;
          this.hideInstallPrompt();
        }
      });
    }
    
    if (this.dismissBtn) {
      this.dismissBtn.addEventListener('click', () => {
        this.hideInstallPrompt();
        // Don't show again for 7 days
        localStorage.setItem('pwa-dismissed', Date.now().toString());
      });
    }
  }
  
  showInstallPrompt() {
    // Check if user dismissed recently
    const dismissed = localStorage.getItem('pwa-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < sevenDays) {
        return;
      }
    }
    
    if (this.installPrompt) {
      this.installPrompt.classList.remove('hidden');
      // Auto-hide after 10 seconds
      setTimeout(() => {
        this.hideInstallPrompt();
      }, 10000);
    }
  }
  
  hideInstallPrompt() {
    if (this.installPrompt) {
      this.installPrompt.classList.add('hidden');
    }
  }
  
  showInstallSuccess() {
    // Show success notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = 'AJK Cleaning app installed successfully!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
  
  showUpdateNotification() {
    // Show update notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <span>App update available!</span>
        <button onclick="this.parentElement.parentElement.remove(); window.location.reload();" 
                class="bg-white text-blue-500 px-2 py-1 rounded text-sm">
          Update
        </button>
      </div>
    `;
    document.body.appendChild(notification);
  }
  
  checkInstallStatus() {
    // Check if app is running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('PWA is running in standalone mode');
      // Hide install prompt if already installed
      this.hideInstallPrompt();
    }
  }
  
  // Request notification permission
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted');
        return true;
      }
    }
    return false;
  }
  
  // Send notification
  sendNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        ...options
      });
    }
  }
}

// Initialize PWA features
document.addEventListener('DOMContentLoaded', function() {
  window.pwaManager = new PWAManager();
  
  // Request notification permission on user interaction
  document.addEventListener('click', async () => {
    if (window.pwaManager) {
      await window.pwaManager.requestNotificationPermission();
    }
  }, { once: true });
});

// Performance Monitoring and Core Web Vitals
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.init();
  }
  
  init() {
    // Monitor Core Web Vitals
    this.measureLCP();
    this.measureFID();
    this.measureCLS();
    this.measureFCP();
    this.measureTTI();
    
    // Monitor resource loading
    this.monitorResourceTiming();
    
    // Monitor navigation timing
    this.monitorNavigationTiming();
  }
  
  measureLCP() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
        this.reportMetric('LCP', lastEntry.startTime);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  }
  
  measureFID() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.metrics.fid = entry.processingStart - entry.startTime;
          this.reportMetric('FID', this.metrics.fid);
        });
      });
      observer.observe({ entryTypes: ['first-input'] });
    }
  }
  
  measureCLS() {
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.metrics.cls = clsValue;
        this.reportMetric('CLS', clsValue);
      });
      observer.observe({ entryTypes: ['layout-shift'] });
    }
  }
  
  measureFCP() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          this.metrics.fcp = fcpEntry.startTime;
          this.reportMetric('FCP', fcpEntry.startTime);
        }
      });
      observer.observe({ entryTypes: ['paint'] });
    }
  }
  
  measureTTI() {
    // TTI is more complex to measure accurately
    // This is a simplified version
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const longTasks = entries.filter(entry => entry.duration > 50);
        if (longTasks.length === 0) {
          this.metrics.tti = performance.now();
          this.reportMetric('TTI', this.metrics.tti);
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    }
  }
  
  monitorResourceTiming() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.duration > 1000) { // Resources taking more than 1 second
            console.warn('Slow resource detected:', entry.name, entry.duration + 'ms');
          }
        });
      });
      observer.observe({ entryTypes: ['resource'] });
    }
  }
  
  monitorNavigationTiming() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        this.metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
        this.metrics.loadComplete = navigation.loadEventEnd - navigation.loadEventStart;
        this.metrics.domInteractive = navigation.domInteractive - navigation.navigationStart;
        
        this.reportMetric('DOMContentLoaded', this.metrics.domContentLoaded);
        this.reportMetric('LoadComplete', this.metrics.loadComplete);
        this.reportMetric('DOMInteractive', this.metrics.domInteractive);
      }
    });
  }
  
  reportMetric(name, value) {
    // Send to analytics service (replace with your analytics endpoint)
    if (typeof gtag !== 'undefined') {
      gtag('event', 'web_vitals', {
        event_category: 'Performance',
        event_label: name,
        value: Math.round(value)
      });
    }
    
    // Log to console for debugging
    console.log(`Performance Metric - ${name}:`, value + 'ms');
    
    // Store in localStorage for debugging
    const stored = JSON.parse(localStorage.getItem('performanceMetrics') || '{}');
    stored[name] = value;
    localStorage.setItem('performanceMetrics', JSON.stringify(stored));
  }
  
  getMetrics() {
    return this.metrics;
  }
  
  // Generate performance report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null,
      metrics: this.metrics
    };
    
    return report;
  }
}

// Initialize performance monitoring
document.addEventListener('DOMContentLoaded', function() {
    window.performanceMonitor = new PerformanceMonitor();

    // Report performance metrics after page load
    window.addEventListener('load', () => {
        setTimeout(() => {
            const report = window.performanceMonitor.generateReport();
            console.log('Performance Report:', report);

            // Send to server for analysis
            fetch('/api/performance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(report)
            }).catch(error => {
                console.log('Failed to send performance report:', error);
            });
        }, 2000);
    });
});

// Enhanced Analytics and Error Tracking
class ClientAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userAgent = navigator.userAgent;
        this.startTime = Date.now();
        this.init();
    }

    init() {
        // Track page view
        this.trackPageView();
        
        // Track user interactions
        this.trackInteractions();
        
        // Track form submissions
        this.trackFormSubmissions();
        
        // Track performance issues
        this.trackPerformanceIssues();
        
        // Track errors
        this.trackErrors();
    }

    generateSessionId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    trackPageView() {
        const pageData = {
            page: window.location.pathname,
            referrer: document.referrer,
            userAgent: this.userAgent,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId
        };

        this.sendAnalytics('page_view', pageData);
    }

    trackInteractions() {
        // Track clicks on important elements
        document.addEventListener('click', (e) => {
            const element = e.target;
            const tagName = element.tagName.toLowerCase();
            
            // Track important interactions
            if (element.matches('a, button, [role="button"], .cta-button, .nav-item')) {
                this.sendAnalytics('interaction', {
                    type: 'click',
                    element: this.getElementInfo(element),
                    page: window.location.pathname,
                    timestamp: new Date().toISOString(),
                    sessionId: this.sessionId
                });
            }
        });

        // Track form interactions
        document.addEventListener('focus', (e) => {
            if (e.target.matches('input, textarea, select')) {
                this.sendAnalytics('interaction', {
                    type: 'focus',
                    element: this.getElementInfo(e.target),
                    page: window.location.pathname,
                    timestamp: new Date().toISOString(),
                    sessionId: this.sessionId
                });
            }
        });
    }

    trackFormSubmissions() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const formData = new FormData(form);
                const formType = form.id || 'unknown';
                
                this.sendAnalytics('form_submission', {
                    formType,
                    fields: Array.from(formData.keys()),
                    page: window.location.pathname,
                    timestamp: new Date().toISOString(),
                    sessionId: this.sessionId
                });
            });
        });
    }

    trackPerformanceIssues() {
        // Track slow resources
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (entry.duration > 1000) { // Resources taking more than 1 second
                        this.sendAnalytics('performance_issue', {
                            type: 'slow_resource',
                            resource: entry.name,
                            duration: entry.duration,
                            page: window.location.pathname,
                            timestamp: new Date().toISOString(),
                            sessionId: this.sessionId
                        });
                    }
                });
            });
            observer.observe({ entryTypes: ['resource'] });
        }

        // Track long tasks
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (entry.duration > 50) { // Tasks taking more than 50ms
                        this.sendAnalytics('performance_issue', {
                            type: 'long_task',
                            duration: entry.duration,
                            page: window.location.pathname,
                            timestamp: new Date().toISOString(),
                            sessionId: this.sessionId
                        });
                    }
                });
            });
            observer.observe({ entryTypes: ['longtask'] });
        }
    }

    trackErrors() {
        // Track JavaScript errors
        window.addEventListener('error', (e) => {
            this.sendError({
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                stack: e.error?.stack,
                page: window.location.pathname,
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId
            });
        });

        // Track unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.sendError({
                message: e.reason?.message || 'Unhandled Promise Rejection',
                stack: e.reason?.stack,
                page: window.location.pathname,
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId
            });
        });
    }

    getElementInfo(element) {
        return {
            tagName: element.tagName.toLowerCase(),
            id: element.id,
            className: element.className,
            text: element.textContent?.substring(0, 100),
            href: element.href
        };
    }

    sendAnalytics(type, data) {
        // Send to analytics endpoint
        fetch('/api/analytics/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type,
                data,
                userAgent: this.userAgent,
                ip: 'unknown' // Will be determined server-side
            })
        }).catch(error => {
            console.log('Failed to send analytics:', error);
        });
    }

    sendError(errorData) {
        // Send to error tracking endpoint
        fetch('/api/errors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: errorData,
                url: window.location.href,
                userAgent: this.userAgent,
                sessionId: this.sessionId
            })
        }).catch(error => {
            console.log('Failed to send error report:', error);
        });
    }
}

// Initialize client analytics
document.addEventListener('DOMContentLoaded', function() {
    window.clientAnalytics = new ClientAnalytics();
});

// Mobile-First Enhancements and Touch Gestures
class MobileEnhancements {
    constructor() {
        this.isMobile = this.detectMobile();
        this.touchStartY = 0;
        this.touchStartX = 0;
        this.swipeThreshold = 50;
        this.init();
    }

    init() {
        if (this.isMobile) {
            this.addTouchGestures();
            this.optimizeForMobile();
            this.addMobileSpecificFeatures();
            this.handleOrientationChanges();
        }
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768 ||
               ('ontouchstart' in window);
    }

    addTouchGestures() {
        // Swipe gestures for navigation
        this.addSwipeGestures();
        
        // Touch feedback for buttons
        this.addTouchFeedback();
        
        // Pull-to-refresh functionality
        this.addPullToRefresh();
        
        // Touch-friendly scrolling
        this.optimizeScrolling();
    }

    addSwipeGestures() {
        let startX, startY, endX, endY;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        document.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            
            // Horizontal swipe
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.swipeThreshold) {
                if (deltaX > 0) {
                    this.handleSwipeRight();
                } else {
                    this.handleSwipeLeft();
                }
            }
            
            // Vertical swipe
            if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > this.swipeThreshold) {
                if (deltaY > 0) {
                    this.handleSwipeDown();
                } else {
                    this.handleSwipeUp();
                }
            }
        });
    }

    handleSwipeLeft() {
        // Close mobile menu if open
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            this.toggleMobileMenu();
        }
        
        // Navigate to next section
        this.navigateToNextSection();
    }

    handleSwipeRight() {
        // Open mobile menu
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('hidden')) {
            this.toggleMobileMenu();
        }
        
        // Navigate to previous section
        this.navigateToPreviousSection();
    }

    handleSwipeUp() {
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    handleSwipeDown() {
        // Scroll to bottom
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    addTouchFeedback() {
        // Add visual feedback for touch interactions
        document.addEventListener('touchstart', (e) => {
            if (e.target.matches('button, a, [role="button"], .touchable')) {
                e.target.style.transform = 'scale(0.95)';
                e.target.style.transition = 'transform 0.1s ease';
            }
        });

        document.addEventListener('touchend', (e) => {
            if (e.target.matches('button, a, [role="button"], .touchable')) {
                e.target.style.transform = 'scale(1)';
            }
        });
    }

    addPullToRefresh() {
        let startY = 0;
        let isPulling = false;
        const pullThreshold = 100;

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (isPulling && window.scrollY === 0) {
                const currentY = e.touches[0].clientY;
                const deltaY = currentY - startY;
                
                if (deltaY > 0) {
                    e.preventDefault();
                    this.showPullToRefreshIndicator(deltaY);
                }
            }
        });

        document.addEventListener('touchend', (e) => {
            if (isPulling) {
                const currentY = e.changedTouches[0].clientY;
                const deltaY = currentY - startY;
                
                if (deltaY > pullThreshold) {
                    this.refreshPage();
                }
                
                this.hidePullToRefreshIndicator();
                isPulling = false;
            }
        });
    }

    showPullToRefreshIndicator(deltaY) {
        // Create or update pull-to-refresh indicator
        let indicator = document.getElementById('pull-to-refresh');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'pull-to-refresh';
            indicator.style.cssText = `
                position: fixed;
                top: -50px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--primary);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                z-index: 1000;
                transition: top 0.3s ease;
            `;
            indicator.innerHTML = 'Pull to refresh';
            document.body.appendChild(indicator);
        }
        
        const progress = Math.min(deltaY / 100, 1);
        indicator.style.top = `${-50 + (deltaY * 0.5)}px`;
        indicator.style.opacity = progress;
    }

    hidePullToRefreshIndicator() {
        const indicator = document.getElementById('pull-to-refresh');
        if (indicator) {
            indicator.style.top = '-50px';
            indicator.style.opacity = '0';
        }
    }

    refreshPage() {
        window.location.reload();
    }

    optimizeScrolling() {
        // Smooth scrolling for mobile
        document.documentElement.style.scrollBehavior = 'smooth';
        
        // Add momentum scrolling for iOS
        document.body.style.webkitOverflowScrolling = 'touch';
        
        // Prevent overscroll bounce
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('.scrollable')) {
                return;
            }
            
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
            const clientHeight = document.documentElement.clientHeight || window.innerHeight;
            
            if (scrollTop === 0 && e.touches[0].clientY > e.touches[0].clientY) {
                e.preventDefault();
            }
            
            if (scrollTop + clientHeight >= scrollHeight && e.touches[0].clientY < e.touches[0].clientY) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    optimizeForMobile() {
        // Add mobile-specific CSS classes
        document.body.classList.add('mobile-optimized');
        
        // Optimize viewport
        this.optimizeViewport();
        
        // Add mobile navigation enhancements
        this.enhanceMobileNavigation();
        
        // Optimize forms for mobile
        this.optimizeFormsForMobile();
        
        // Add mobile-specific performance optimizations
        this.addMobilePerformanceOptimizations();
    }

    optimizeViewport() {
        // Ensure proper viewport meta tag
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    }

    enhanceMobileNavigation() {
        const mobileMenu = document.getElementById('mobile-menu');
        const menuBtn = document.getElementById('menu-btn');
        
        if (mobileMenu && menuBtn) {
            // Add backdrop for mobile menu
            const backdrop = document.createElement('div');
            backdrop.id = 'mobile-menu-backdrop';
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 40;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(backdrop);
            
            // Enhanced mobile menu toggle
            const originalToggle = menuBtn.onclick;
            menuBtn.onclick = (e) => {
                e.preventDefault();
                this.toggleMobileMenu();
            };
            
            // Close menu when clicking backdrop
            backdrop.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }
    }

    toggleMobileMenu() {
        const mobileMenu = document.getElementById('mobile-menu');
        const backdrop = document.getElementById('mobile-menu-backdrop');
        const menuBtn = document.getElementById('menu-btn');
        
        if (mobileMenu) {
            const isHidden = mobileMenu.classList.contains('hidden');
            
            if (isHidden) {
                mobileMenu.classList.remove('hidden');
                if (backdrop) {
                    backdrop.style.opacity = '1';
                    backdrop.style.visibility = 'visible';
                }
                document.body.style.overflow = 'hidden';
            } else {
                mobileMenu.classList.add('hidden');
                if (backdrop) {
                    backdrop.style.opacity = '0';
                    backdrop.style.visibility = 'hidden';
                }
                document.body.style.overflow = '';
            }
        }
    }

    optimizeFormsForMobile() {
        // Optimize input types for mobile
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            if (input.type === 'tel') {
                input.setAttribute('inputmode', 'tel');
            } else if (input.type === 'email') {
                input.setAttribute('inputmode', 'email');
            } else if (input.type === 'number') {
                input.setAttribute('inputmode', 'numeric');
            }
        });
        
        // Add mobile-friendly form validation
        this.addMobileFormValidation();
    }

    addMobileFormValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                if (!form.checkValidity()) {
                    e.preventDefault();
                    this.showMobileValidationErrors(form);
                }
            });
        });
    }

    showMobileValidationErrors(form) {
        const invalidFields = form.querySelectorAll(':invalid');
        if (invalidFields.length > 0) {
            invalidFields[0].focus();
            invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    addMobileSpecificFeatures() {
        // Add mobile-specific features
        this.addMobileAppLikeFeatures();
        this.addMobileGestures();
        this.optimizeForTouch();
    }

    addMobileAppLikeFeatures() {
        // Add app-like features for mobile
        this.addMobileSplashScreen();
        this.addMobileLoadingStates();
        this.addMobileNotifications();
    }

    addMobileSplashScreen() {
        // Create splash screen for mobile
        if (this.isMobile && !sessionStorage.getItem('splashShown')) {
            const splash = document.createElement('div');
            splash.id = 'mobile-splash';
            splash.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, var(--primary), var(--secondary));
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                color: white;
            `;
            splash.innerHTML = `
                <img src="/images/logo.webp" alt="AJK Cleaning" style="width: 80px; height: 80px; margin-bottom: 1rem;">
                <h2 style="margin-bottom: 0.5rem;">AJK Cleaning</h2>
                <p style="opacity: 0.8;">Professional Cleaning Services</p>
            `;
            document.body.appendChild(splash);
            
            // Hide splash screen after 2 seconds
            setTimeout(() => {
                splash.style.opacity = '0';
                splash.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    splash.remove();
                    sessionStorage.setItem('splashShown', 'true');
                }, 500);
            }, 2000);
        }
    }

    addMobileLoadingStates() {
        // Add loading states for mobile
        const buttons = document.querySelectorAll('button[type="submit"]');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                if (this.isMobile) {
                    button.style.opacity = '0.7';
                    button.style.pointerEvents = 'none';
                }
            });
        });
    }

    addMobileNotifications() {
        // Add mobile-specific notifications
        if ('Notification' in window && Notification.permission === 'granted') {
            // Show mobile-specific notifications
            this.showMobileNotification('Welcome to AJK Cleaning!', {
                body: 'Get professional cleaning services at your fingertips',
                icon: '/android-chrome-192x192.png'
            });
        }
    }

    showMobileNotification(title, options) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                icon: '/android-chrome-192x192.png',
                badge: '/favicon-32x32.png',
                ...options
            });
        }
    }

    addMobileGestures() {
        // Add mobile-specific gestures
        this.addDoubleTapToZoom();
        this.addLongPressGestures();
        this.addPinchToZoom();
    }

    addDoubleTapToZoom() {
        let lastTap = 0;
        document.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 500 && tapLength > 0) {
                // Double tap detected
                this.handleDoubleTap(e);
            }
            lastTap = currentTime;
        });
    }

    handleDoubleTap(e) {
        // Handle double tap gesture
        const target = e.target;
        if (target.matches('img')) {
            this.zoomImage(target);
        }
    }

    zoomImage(img) {
        // Simple image zoom for mobile
        img.style.transform = img.style.transform === 'scale(1.5)' ? 'scale(1)' : 'scale(1.5)';
        img.style.transition = 'transform 0.3s ease';
    }

    addLongPressGestures() {
        let pressTimer;
        
        document.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                this.handleLongPress(e);
            }, 500);
        });
        
        document.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
        
        document.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        });
    }

    handleLongPress(e) {
        // Handle long press gesture
        const target = e.target;
        if (target.matches('img')) {
            this.showImageOptions(target);
        }
    }

    showImageOptions(img) {
        // Show image options for mobile
        const options = document.createElement('div');
        options.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
        `;
        options.innerHTML = `
            <button onclick="this.parentElement.remove()" style="margin-right: 1rem;">Close</button>
            <button onclick="window.open('${img.src}', '_blank')">Open Full Size</button>
        `;
        document.body.appendChild(options);
        
        // Remove options after 3 seconds
        setTimeout(() => {
            if (options.parentElement) {
                options.remove();
            }
        }, 3000);
    }

    addPinchToZoom() {
        // Add pinch-to-zoom functionality
        let initialDistance = 0;
        let initialScale = 1;
        
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const distance = this.getDistance(e.touches[0], e.touches[1]);
                initialDistance = distance;
                initialScale = 1;
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const distance = this.getDistance(e.touches[0], e.touches[1]);
                const scale = distance / initialDistance;
                
                // Apply pinch zoom to images
                const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
                if (target && target.matches('img')) {
                    target.style.transform = `scale(${scale})`;
                }
            }
        });
    }

    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    optimizeForTouch() {
        // Optimize touch interactions
        this.addTouchOptimizations();
        this.addMobileKeyboardHandling();
    }

    addTouchOptimizations() {
        // Add touch-specific optimizations
        document.body.style.touchAction = 'manipulation';
        
        // Optimize touch targets
        const touchTargets = document.querySelectorAll('button, a, input, select, textarea');
        touchTargets.forEach(target => {
            target.style.minHeight = '44px';
            target.style.minWidth = '44px';
        });
    }

    addMobileKeyboardHandling() {
        // Handle mobile keyboard
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                if (this.isMobile) {
                    // Scroll input into view
                    setTimeout(() => {
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                }
            });
        });
    }

    handleOrientationChanges() {
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.optimizeForOrientation();
            }, 100);
        });
    }

    optimizeForOrientation() {
        // Optimize layout for current orientation
        const isPortrait = window.innerHeight > window.innerWidth;
        
        if (isPortrait) {
            document.body.classList.add('portrait');
            document.body.classList.remove('landscape');
        } else {
            document.body.classList.add('landscape');
            document.body.classList.remove('portrait');
        }
    }

    navigateToNextSection() {
        // Navigate to next section
        const sections = document.querySelectorAll('section[id]');
        const currentSection = this.getCurrentSection();
        const currentIndex = Array.from(sections).indexOf(currentSection);
        
        if (currentIndex < sections.length - 1) {
            sections[currentIndex + 1].scrollIntoView({ behavior: 'smooth' });
        }
    }

    navigateToPreviousSection() {
        // Navigate to previous section
        const sections = document.querySelectorAll('section[id]');
        const currentSection = this.getCurrentSection();
        const currentIndex = Array.from(sections).indexOf(currentSection);
        
        if (currentIndex > 0) {
            sections[currentIndex - 1].scrollIntoView({ behavior: 'smooth' });
        }
    }

    getCurrentSection() {
        const sections = document.querySelectorAll('section[id]');
        let currentSection = sections[0];
        
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
                currentSection = section;
            }
        });
        
        return currentSection;
    }

    addMobilePerformanceOptimizations() {
        // Add mobile-specific performance optimizations
        this.optimizeImagesForMobile();
        this.addMobileLazyLoading();
        this.optimizeAnimationsForMobile();
    }

    optimizeImagesForMobile() {
        // Optimize images for mobile
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (this.isMobile) {
                img.loading = 'lazy';
                img.decoding = 'async';
            }
        });
    }

    addMobileLazyLoading() {
        // Enhanced lazy loading for mobile
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });
            
            const lazyImages = document.querySelectorAll('img[data-src]');
            lazyImages.forEach(img => imageObserver.observe(img));
        }
    }

    optimizeAnimationsForMobile() {
        // Optimize animations for mobile
        if (this.isMobile) {
            // Reduce motion for mobile
            document.documentElement.style.setProperty('--animation-duration', '0.3s');
            
            // Disable complex animations on mobile
            const animatedElements = document.querySelectorAll('[class*="animate"]');
            animatedElements.forEach(el => {
                el.style.animationDuration = '0.3s';
            });
        }
    }
}

// Initialize mobile enhancements
document.addEventListener('DOMContentLoaded', function() {
    window.mobileEnhancements = new MobileEnhancements();
});