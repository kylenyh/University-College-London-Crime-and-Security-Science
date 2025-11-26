/* Digital Clock - Automatically detects user's local timezone
 * This clock will display the correct time for any user worldwide
 * based on their device's system timezone setting.
 * Examples:
 * - User in China: Shows China time (UTC+8)
 * - User in USA: Shows their local US time (UTC-5 to UTC-8)
 * - User in UK: Shows UK time (UTC+0 or UTC+1)
 * - User in Australia: Shows Australian time (UTC+8 to UTC+11)
 * - User in India: Shows India time (UTC+5:30)
 */
function updateClock() {
    // Get current date/time in user's local timezone
    const now = new Date();
    
    // Extract time components in user's local timezone
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Display hours in 24-hour format (00-23)
    const displayHours = now.getHours().toString().padStart(2, '0');

    // Update time display
    document.getElementById('hours').textContent = displayHours;
    document.getElementById('minutes').textContent = minutes;
    document.getElementById('seconds').textContent = seconds;
    document.getElementById('ampm').textContent = ampm;

    // Extract date components in user's local timezone
    const year = now.getFullYear();
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const month = monthNames[now.getMonth()];
    const day = now.getDate().toString().padStart(2, '0');

    // Update date display
    document.getElementById('year').textContent = year;
    document.getElementById('month').textContent = month;
    document.getElementById('day').textContent = day;

    // Highlight current day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = now.getDay();
    document.querySelectorAll('.day').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.day')[dayOfWeek].classList.add('active');
}

/* Navigation System */
// Initialize sidebar toggle functionality
function initializeSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    
    if (!sidebar || !toggleButton) {
        console.warn('Sidebar or toggle button not found');
        return;
    }
    
    // Load saved sidebar state from localStorage
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    // Toggle sidebar on button click
    toggleButton.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        
        // Save state to localStorage
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
    });
}

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page-content');
    
    // Function to handle page change logic
    function changePage(targetPage) {
        // Allow navigation to report page - popup will handle the consent requirement
        
        // Remove active class from all nav links
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        
        // Add active class to clicked nav link
        const activeLink = document.querySelector(`.nav-link[data-page="${targetPage}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Hide all pages
        pages.forEach(page => page.classList.remove('active'));
        
        // Show target page
        const targetPageElement = document.getElementById(`${targetPage}-page`);
        if (targetPageElement) {
            targetPageElement.classList.add('active');
        }
        
        // Wait for the browser to paint the new page before scrolling
        // This prevents race condition where scroll happens before page renders
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
        
        // Special case for home page (which now contains charts)
        if (targetPage === 'home' && window.renderAllCharts) {
            // Ensure Firestore data is loaded before rendering charts
            const renderChartsAfterDataLoad = async () => {
                // Always reload Firestore data when navigating to home page to get latest data
                if (window.db) {
                    console.log('[Navigation] 🔄 Loading Firestore data before rendering charts...');
                    await loadAllDataFromFirestore().catch(err => {
                        console.error('[Navigation] ❌ Error loading Firestore data:', err);
                    });
                    
                    console.log('[Navigation] Firestore cache loaded:', {
                        questionnaires: firestoreDataCache.questionnaires.length,
                        sessions: firestoreDataCache.sessions.length
                    });
                } else {
                    console.warn('[Navigation] ⚠️ Firestore not available (window.db is undefined)');
                }
                
                // Wait for the page to render before drawing charts
                setTimeout(() => {
                    console.log('[Navigation] 📊 Rendering charts on home page...');
                    const responses = getAllQuestionnaireResponses();
                    console.log('[Navigation] Found', responses.length, 'questionnaire responses for charts');
                    window.renderAllCharts();
                }, 300);
            };
            
            renderChartsAfterDataLoad();
            
            // Set up real-time chart updates
            if (typeof window.chartUpdateInterval !== 'undefined') {
                clearInterval(window.chartUpdateInterval);
            }
            
            window.chartUpdateInterval = setInterval(() => {
                const homePage = document.getElementById('home-page');
                if (homePage && homePage.classList.contains('active') && window.renderAllCharts) {
                    // Check if dropdown is open before updating (to prevent closing it)
                    const dropdown = document.getElementById('chart1-dropdown');
                    const isDropdownOpen = dropdown && document.activeElement === dropdown;
                    
                    // Only update if dropdown is not open
                    if (!isDropdownOpen) {
                        window.renderAllCharts();
                    }
                }
            }, 5000); // Update charts every 5 seconds for real-time updates (less frequent to avoid interference)
        } else {
            // Clear chart update interval if navigating away from home
            if (typeof window.chartUpdateInterval !== 'undefined') {
                clearInterval(window.chartUpdateInterval);
                window.chartUpdateInterval = undefined;
            }
            // Reset dropdown initialization flag when leaving home page (optional - can be removed if you want it to persist)
            // chart1DropdownInitialized = false;
        }
        
        // Render notifications if on notifications page
        if (targetPage === 'notifications') {
            // Initialize notification page buttons
            initializeNotificationsPage();
            // Render notifications (this only displays, doesn't create)
            renderNotifications();
        }
        
        // Update session table if on logs page (loads from Firestore - all participants)
        if (targetPage === 'logs') {
            // Refresh from Firestore cache to get latest data from all participants
            updateSessionTable();
            
            // Also ensure Firestore data is loaded (in case page was opened before Firestore loaded)
            if (window.db && firestoreDataCache.sessions.length === 0) {
                loadAllDataFromFirestore().catch(err => {
                    console.error('[Firestore] Error loading data for logs page:', err);
                });
            }
            
            // Ensure current user's session is created/updated in Firestore
            if (window.db) {
                createOrUpdateSessionInFirestore();
            }
        }
        
        // CRITICAL: Ensure slider and display are synchronized when navigating to privacy page
        if (targetPage === 'privacy') {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                const slider = document.getElementById('privacy-slider');
                const epsilonValue = document.getElementById('epsilon-value');
                
                if (slider && epsilonValue) {
                    // Check if user has completed forms
                    const isCompleted = localStorage.getItem('consentCompleted') === 'true' && 
                                        localStorage.getItem('privacyCompleted') === 'true';
                    
                    if (isCompleted) {
                        // Load finalEpsilon from storage for completed users
                        const sessions = getSessionsFromStorage();
                        const userSession = sessions.find(s => 
                            s.userId === privacyState.userId && 
                            s.privacyCompleted === true
                        );
                        
                        if (userSession && userSession.finalEpsilon && userSession.finalEpsilon !== 'N/A') {
                            const finalEpsilon = parseFloat(userSession.finalEpsilon);
                            synchronizeSliderAndDisplay(finalEpsilon);
                            updatePrivacyDisplay(finalEpsilon);
                            updateTradeoffMetrics(finalEpsilon);
                            console.log('[Navigation] ✅ Loaded finalEpsilon for completed user:', finalEpsilon);
                            return; // Exit early - don't run normal sync
                        }
                    }
                    
                    // For active/incomplete users - normal synchronization
                    const sliderValue = parseFloat(slider.value).toFixed(1);
                    const displayValue = epsilonValue.textContent;
                    const currentEpsilon = privacyState.epsilon || parseFloat(slider.value);
                    
                    // If there's any mismatch, force synchronization
                    if (sliderValue !== displayValue || Math.abs(parseFloat(sliderValue) - currentEpsilon) > 0.05) {
                        console.log('[Privacy Page] 🔄 Synchronizing slider and display on page navigation');
                        synchronizeSliderAndDisplay(currentEpsilon);
                        updatePrivacyDisplay(currentEpsilon);
                        updateTradeoffMetrics(currentEpsilon);
                    }
                }
            }, 50);
        }
        
        // CRITICAL: Update account info when navigating to account page
        // This ensures session status shows "Completed" if both forms are submitted
        if (targetPage === 'account') {
            setTimeout(() => {
                updateAccountInfo();
                updateAccountTimestamp();
                console.log('[Account Page] 🔄 Updated account info on page navigation');
            }, 100);
        }
        
        // Update calendar if on calendar page
        if (targetPage === 'calendar') {
            // Only refresh calendar with current date if user hasn't manually selected a month
            if (!userSelectedMonth) {
                const now = getCurrentLocalDate();
                currentMonth = now.getMonth();
                currentYear = now.getFullYear();
            }
            if (typeof renderCalendar === 'function') {
                renderCalendar();
            }
        }
        
        // Check privacy form access
        if (targetPage === 'report') {
            setTimeout(() => {
                checkPrivacyFormAccess();
                // Show success popup if privacy form already completed
                if (completionStatus.privacyCompleted) {
                    showPrivacySuccessModal();
                }
            }, 50);
        }
        
        // Check privacy page access
        if (targetPage === 'privacy') {
            setTimeout(() => {
                checkPrivacyPageAccess();
            }, 50);
        }
        
        // Check consent page access - show success popup if already completed
        if (targetPage === 'consent') {
            setTimeout(() => {
                if (completionStatus.consentCompleted) {
                    showConsentSuccessModal();
                }
            }, 50);
        }
        
        console.log(`Navigated to: ${targetPage}`);
        
        // Check access for restricted sections (but don't force re-auth if already granted)
        // Note: checkNotificationsAccess is already called within initializeNotificationsPage (line 108-112)
        if (targetPage === 'logs') {
            checkLogsAccess();
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPage = this.getAttribute('data-page');
            changePage(targetPage);
        });
    });

    // Initial page load check
    const initialPage = document.querySelector('.nav-link.active')?.getAttribute('data-page') || 'guide';
    changePage(initialPage);
    
    // Also check privacy access after page loads (in case privacy or report page is active)
    setTimeout(() => {
        checkPrivacyFormAccess();
        checkPrivacyPageAccess();
    }, 200);
}

/* Heatmap Generator */
/* Heatmap Generator */
let currentHeatmapYear = 2025;
/* ============================================
   USER ID MANAGEMENT
   ============================================ */

// Generate User ID on page load and store in localStorage
function generateUserId() {
    // Check if user already has an ID stored
    let userId = localStorage.getItem('zynex_user_id');
    
    // If no ID exists, generate a new one and set account created date
    if (!userId) {
        const random = Math.floor(Math.random() * 9000) + 1000;
        userId = `U-${random}`;
        localStorage.setItem('zynex_user_id', userId);
        
        // Set account created date (first entry time)
        const accountCreatedDate = new Date();
        localStorage.setItem('account_created_date', accountCreatedDate.toISOString());
        localStorage.setItem('account_created_date_display', accountCreatedDate.toLocaleDateString('en-GB'));
    }
    
    return userId;
}

// Get account created date (first entry time)
function getAccountCreatedDate() {
    const stored = localStorage.getItem('account_created_date');
    if (stored) {
        return new Date(stored);
    }
    // Fallback: use current time if not set (shouldn't happen)
    const now = new Date();
    localStorage.setItem('account_created_date', now.toISOString());
    localStorage.setItem('account_created_date_display', now.toLocaleDateString('en-GB'));
    return now;
}

// Clear user ID (for testing - generates new ID on next load)
function clearUserId() {
    localStorage.removeItem('zynex_user_id');
}

/* ============================================
   FIREBASE FIRESTORE SYNC SYSTEM
   localStorage = offline safety backup
   Firestore = master global database visible to admin
   ============================================ */

// Track which data has been synced to Firestore
const SYNC_TRACKING_KEY = 'firestore_sync_status';

// Get sync status from localStorage
function getSyncStatus() {
    const status = localStorage.getItem(SYNC_TRACKING_KEY);
    return status ? JSON.parse(status) : {};
}

// Mark data as synced
function markAsSynced(dataType, dataKey) {
    const status = getSyncStatus();
    if (!status[dataType]) {
        status[dataType] = {};
    }
    status[dataType][dataKey] = {
        synced: true,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem(SYNC_TRACKING_KEY, JSON.stringify(status));
}

// Check if data is synced
function isSynced(dataType, dataKey) {
    const status = getSyncStatus();
    return status[dataType] && status[dataType][dataKey] && status[dataType][dataKey].synced === true;
}

// Call submitForm from index.html (Firebase module)
async function syncToFirestore(dataType, data, dataKey = null) {
    try {
        // Check if submitForm is available (from Firebase module in index.html)
        if (typeof window.submitForm !== 'function') {
            console.warn('[Firestore Sync] submitForm not available, data saved to localStorage only');
            return false;
        }

        // Prepare data for Firestore with metadata
        // Use dataKey as userId if provided, otherwise fall back to privacyState or generate
        const userId = dataKey || privacyState.userId || currentSession?.userId || generateUserId();
        
        const firestoreData = {
            dataType: dataType, // e.g., 'session', 'questionnaire', 'consent', 'privacy'
            data: data,
            userId: userId, // Use the determined userId
            timestamp: new Date().toISOString(),
            syncedAt: new Date().toISOString()
        };

        // Add dataKey if provided (for tracking specific items)
        if (dataKey && dataKey !== userId) {
            firestoreData.dataKey = dataKey;
        }

        // Call submitForm from Firebase module
        await window.submitForm(firestoreData);
        
        // Mark as synced if dataKey provided
        if (dataKey) {
            markAsSynced(dataType, dataKey);
        } else {
            markAsSynced(dataType, 'latest');
        }
        
        console.log(`[Firestore Sync] Successfully synced ${dataType} to Firestore`);
        return true;
    } catch (error) {
        console.error(`[Firestore Sync] Error syncing ${dataType} to Firestore:`, error);
        // Data remains in localStorage as backup
        return false;
    }
}

// Wrapper for localStorage.setItem that also syncs to Firestore
function setItemWithSync(key, value, dataType = null, dataKey = null) {
    // Always save to localStorage first (offline backup)
    if (typeof value === 'object') {
        localStorage.setItem(key, JSON.stringify(value));
    } else {
        localStorage.setItem(key, value);
    }
    
    // Determine dataType from key if not provided
    if (!dataType) {
        if (key === 'session_logs') dataType = 'sessions';
        else if (key === 'questionnaireData') dataType = 'questionnaire';
        else if (key === 'consentCompleted') dataType = 'consent';
        else if (key === 'privacyCompleted') dataType = 'privacy';
        else if (key.startsWith('final_')) dataType = 'session_metrics';
        else dataType = 'other';
    }
    
    // Sync to Firestore (async, don't block)
    if (dataType !== 'other') {
        const dataToSync = typeof value === 'object' ? value : { value: value, key: key };
        syncToFirestore(dataType, dataToSync, dataKey || key).catch(err => {
            console.error(`[Firestore Sync] Failed to sync ${key}:`, err);
        });
    }
}

/* ============================================
   FIRESTORE REAL-TIME UPDATE HANDLERS
   ============================================ */

// Global cache for Firestore data (updated in real-time)
let firestoreDataCache = {
    sessions: [],
    questionnaires: [],
    notifications: [],
    lastUpdated: null
};

// Load all data from Firestore on page load
async function loadAllDataFromFirestore() {
    if (!window.db) {
        console.warn('[Firestore] Database not available yet');
        return;
    }
    
    try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
        const responsesRef = collection(window.db, "responses");
        const snapshot = await getDocs(responsesRef);
        
        const sessions = [];
        const questionnaires = [];
        const notifications = [];
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            const docId = doc.id; // Document ID (for sessions, this is the userId)
            
            console.log('[Firestore] Processing document:', {
                dataType: data.dataType,
                hasData: !!data.data,
                userId: data.userId,
                docId: docId
            });
            
            // Handle both direct data and nested data structures
            if (data.dataType === 'sessions') {
                // Firestore stores sessions with nested structure: { dataType: 'sessions', data: { ...sessionData... }, userId: ... }
                // For sessions, document ID IS the userId (ensures 1 user = 1 document, no duplicates)
                const sessionData = data.data || data;
                
                // Ensure userId matches document ID (for sessions using userId as doc ID)
                if (!sessionData.userId && docId && docId.startsWith('U-')) {
                    sessionData.userId = docId;
                    console.log('[Firestore] Set userId from document ID:', docId);
                } else if (sessionData.userId && sessionData.userId !== docId && docId.startsWith('U-')) {
                    // Document ID is userId but doesn't match - use doc ID as source of truth
                    console.log('[Firestore] Document ID is userId, using doc ID as source of truth:', docId);
                    sessionData.userId = docId;
                }
                
                sessions.push(sessionData);
                
                console.log('[Firestore] Processing session:', {
                    userId: sessionData.userId || data.userId,
                    consentCompleted: sessionData.consentCompleted,
                    privacyCompleted: sessionData.privacyCompleted,
                    hasQuestionnaireData: !!sessionData.questionnaireData
                });
                
                // IMPORTANT: Also extract questionnaireData from session documents
                // This is where the data actually gets stored when finalizeSessionLog runs
                if (sessionData.questionnaireData && sessionData.consentCompleted && sessionData.privacyCompleted) {
                    const questionnaireEntry = {
                        data: sessionData.questionnaireData,
                        userId: sessionData.userId || data.userId
                    };
                    questionnaires.push(questionnaireEntry);
                    console.log('[Firestore] ✓ Extracted questionnaireData from session:', {
                        userId: questionnaireEntry.userId,
                        hasQ2: !!sessionData.questionnaireData.q2_noticed,
                        hasQ3: !!sessionData.questionnaireData.q3_factors,
                        hasQ4: !!sessionData.questionnaireData.q4_preferred_range,
                        questionnaireData: sessionData.questionnaireData
                    });
                } else {
                    if (!sessionData.questionnaireData) {
                        console.warn('[Firestore] ⚠️ Session missing questionnaireData:', sessionData.userId || data.userId);
                    }
                    if (!sessionData.consentCompleted) {
                        console.warn('[Firestore] ⚠️ Session missing consentCompleted:', sessionData.userId || data.userId);
                    }
                    if (!sessionData.privacyCompleted) {
                        console.warn('[Firestore] ⚠️ Session missing privacyCompleted:', sessionData.userId || data.userId);
                    }
                }
            } else if (data.dataType === 'questionnaire') {
                // Store the full structure with userId for consistency with real-time handler
                questionnaires.push({
                    data: data.data || data,
                    userId: data.userId
                });
                console.log('[Firestore] ✓ Added standalone questionnaire document:', data.userId);
            } else if (data.dataType === 'notification') {
                notifications.push(data.data || data);
            }
        });
        
        firestoreDataCache.sessions = sessions;
        firestoreDataCache.questionnaires = questionnaires;
        firestoreDataCache.notifications = notifications;
        firestoreDataCache.lastUpdated = new Date().toISOString();
        
        console.log('[Firestore] Loaded all data:', {
            sessions: sessions.length,
            questionnaires: questionnaires.length,
            notifications: notifications.length
        });
        
        // Log questionnaire data structure for debugging
        if (questionnaires.length > 0) {
            console.log('[Firestore] Sample questionnaire structure:', questionnaires[0]);
        }
        
        // Update UI with Firestore data
        updateUIFromFirestore();
        
        // Force chart refresh to ensure new data is displayed
        if (window.renderAllCharts) {
            setTimeout(() => {
                console.log('[Firestore] Refreshing charts after data load...');
                window.renderAllCharts();
            }, 500);
        }
    } catch (error) {
        console.error('[Firestore] Error loading data:', error);
    }
}

// Update UI elements from Firestore cache
function updateUIFromFirestore() {
    // Update session table (logs page) - shows all participants from Firestore
    if (typeof updateSessionTable === 'function') {
        updateSessionTable();
    }
    
    // Update charts (home page) - uses Firestore data from all participants
    if (window.renderAllCharts) {
        window.renderAllCharts();
        if (typeof updateHeatmapTable === 'function') {
            updateHeatmapTable();
        }
    }
    
    // Update notifications (notifications page) - shows all notifications from Firestore
    if (typeof renderNotifications === 'function') {
        renderNotifications();
    }
}

// Handle real-time session updates from Firestore
// Now handles BOTH completed and incomplete sessions for real-time logs display
window.handleFirestoreSessionUpdate = function(sessionData) {
    console.log('[Firestore Real-time] Session update:', {
        userId: sessionData.userId,
        timeStarted: sessionData.timeStarted,
        consentCompleted: sessionData.consentCompleted,
        privacyCompleted: sessionData.privacyCompleted
    });
    
    // Process ALL sessions (both completed and incomplete) for real-time logs display
    // Use userId as the key for deduplication (1 user = 1 entry)
    const userId = sessionData.userId;
    if (!userId) {
        console.warn('[Firestore Real-time] Session missing userId, skipping');
        return;
    }
    
    // Find existing session by userId (not sessionId) to ensure 1 user = 1 entry
    const existingIndex = firestoreDataCache.sessions.findIndex(s => s.userId === userId);
    
    if (existingIndex >= 0) {
        // Update existing session (real-time update)
        firestoreDataCache.sessions[existingIndex] = sessionData;
        console.log('[Firestore Real-time] ✓ Updated existing session in cache:', userId);
    } else {
        // Add new session
        firestoreDataCache.sessions.push(sessionData);
        console.log('[Firestore Real-time] ✓ Added new session to cache:', userId);
    }
    
    // IMPORTANT: Also extract questionnaireData from session and add to questionnaires cache
    // This is where the data actually gets stored when finalizeSessionLog runs
    if (sessionData.questionnaireData && sessionData.userId) {
        const existingQIndex = firestoreDataCache.questionnaires.findIndex(q => 
            (q.userId || q.data?.userId) === sessionData.userId
        );
        
        const questionnaireEntry = {
            data: sessionData.questionnaireData,
            userId: sessionData.userId
        };
        
        if (existingQIndex >= 0) {
            firestoreDataCache.questionnaires[existingQIndex] = questionnaireEntry;
            console.log('[Firestore Real-time] Updated questionnaire from session:', sessionData.userId);
        } else {
            firestoreDataCache.questionnaires.push(questionnaireEntry);
            console.log('[Firestore Real-time] Added questionnaire from session:', sessionData.userId);
        }
    }
    
    // Update session table (logs page) - always update, even if not on logs page
    if (typeof updateSessionTable === 'function') {
        updateSessionTable();
        
        // If logs page is active, show visual indicator
        const logsPage = document.getElementById('logs-page');
        if (logsPage && logsPage.classList.contains('active')) {
            // Flash the table header to indicate new data
            const tableHeader = document.querySelector('.session-history-header');
            if (tableHeader) {
                tableHeader.style.transition = 'background-color 0.3s';
                tableHeader.style.backgroundColor = 'rgba(0, 255, 255, 0.2)';
                setTimeout(() => {
                    tableHeader.style.backgroundColor = '';
                }, 1000);
            }
        }
    }
    
    // Update Chart 1 (participant count)
    if (window.renderAllCharts) {
        window.renderAllCharts();
    }
};

// Handle real-time questionnaire updates from Firestore
window.handleFirestoreQuestionnaireUpdate = function(firestoreData) {
    console.log('[Firestore Real-time] New questionnaire:', firestoreData);
    
    // The real-time listener now passes the full Firestore document structure
    // Extract userId from the parent structure (not from nested data)
    const userId = firestoreData.userId;
    
    // Store the full structure to match what loadAllDataFromFirestore does
    // This ensures getAllQuestionnaireResponses can properly extract the data
    const fullData = {
        data: firestoreData.data || firestoreData, // Extract questionnaire data
        userId: userId
    };
    
    // Add to cache (store full structure to match initial load format)
    const existingIndex = firestoreDataCache.questionnaires.findIndex(q => {
        const qUserId = q.userId || q.data?.userId;
        return qUserId === userId;
    });
    
    if (existingIndex >= 0) {
        firestoreDataCache.questionnaires[existingIndex] = fullData;
    } else {
        firestoreDataCache.questionnaires.push(fullData);
    }
    
    console.log('[Firestore Real-time] Updated questionnaire cache. Total:', firestoreDataCache.questionnaires.length);
    
    // Update all charts (they use questionnaire data)
    if (window.renderAllCharts) {
        window.renderAllCharts();
        if (typeof updateHeatmapTable === 'function') {
            updateHeatmapTable();
        }
    }
};

// Handle real-time notification updates from Firestore
window.handleFirestoreNotificationUpdate = function(notificationData) {
    console.log('[Firestore Real-time] New notification:', notificationData);
    
    // Check if notification already exists (prevent duplicates)
    const existing = firestoreDataCache.notifications.find(n => n.id === notificationData.id);
    if (existing) {
        return; // Already have this notification
    }
    
    // Add to cache
    firestoreDataCache.notifications.unshift(notificationData);
    
    // Also add to localStorage for offline backup (avoid circular call to getNotificationsFromStorage)
    const localNotifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    const duplicate = localNotifications.find(n => n.id === notificationData.id);
    if (!duplicate) {
        localNotifications.unshift(notificationData);
        saveNotificationsToStorage(localNotifications);
    }
    
    // Update notification badge
    if (typeof updateNotificationBadge === 'function') {
        const allNotifications = getNotificationsFromStorage();
        updateNotificationBadge(getUnreadCount(allNotifications));
    }
    
    // Render notifications if on notifications page (real-time update)
    if (document.getElementById('notifications-list') && 
        document.getElementById('notifications-page')?.classList.contains('active')) {
        if (typeof renderNotifications === 'function') {
            renderNotifications();
        }
    } else {
        // Show visual indicator that new notification arrived
        const bellIcon = document.querySelector('.fa-bell');
        if (bellIcon) {
            bellIcon.style.animation = 'pulse 0.5s ease-in-out 3';
        }
    }
};

// Handle real-time consent updates
window.handleFirestoreConsentUpdate = function(consentData) {
    console.log('[Firestore Real-time] Consent completed:', consentData);
    // Update charts/logs if needed
    if (window.renderAllCharts) {
        window.renderAllCharts();
    }
};

// Handle real-time privacy updates
window.handleFirestorePrivacyUpdate = function(privacyData) {
    console.log('[Firestore Real-time] Privacy completed:', privacyData);
    // Update charts/logs if needed
    if (window.renderAllCharts) {
        window.renderAllCharts();
    }
};

// Check for unsynced data on page load and upload to Firestore
async function syncUnsyncedData() {
    console.log('[Firestore Sync] Checking for unsynced data...');
    
    try {
        // Check session logs
        const sessionLogs = localStorage.getItem('session_logs');
        if (sessionLogs) {
            const sessions = JSON.parse(sessionLogs);
            const completedSessions = sessions.filter(s => 
                s.consentCompleted === true && s.privacyCompleted === true
            );
            
            for (const session of completedSessions) {
                const sessionKey = session.sessionId || session.userId;
                if (!isSynced('sessions', sessionKey)) {
                    console.log(`[Firestore Sync] Syncing unsynced session: ${sessionKey}`);
                    await syncToFirestore('sessions', session, sessionKey);
                }
            }
        }
        
        // Check questionnaire data
        const questionnaireData = localStorage.getItem('questionnaireData');
        if (questionnaireData) {
            const userId = privacyState.userId || generateUserId();
            if (!isSynced('questionnaire', userId)) {
                console.log(`[Firestore Sync] Syncing unsynced questionnaire data for user: ${userId}`);
                const data = JSON.parse(questionnaireData);
                await syncToFirestore('questionnaire', data, userId);
            }
        }
        
        // Check consent completion
        const consentCompleted = localStorage.getItem('consentCompleted');
        if (consentCompleted === 'true') {
            const userId = privacyState.userId || generateUserId();
            if (!isSynced('consent', userId)) {
                console.log(`[Firestore Sync] Syncing unsynced consent completion for user: ${userId}`);
                const consentData = {
                    consentCompleted: true,
                    consentCompletedTime: localStorage.getItem('consentCompletedTime'),
                    consentCompletedDate: localStorage.getItem('consentCompletedDate')
                };
                await syncToFirestore('consent', consentData, userId);
            }
        }
        
        // Check privacy completion
        const privacyCompleted = localStorage.getItem('privacyCompleted');
        if (privacyCompleted === 'true') {
            const userId = privacyState.userId || generateUserId();
            if (!isSynced('privacy', userId)) {
                console.log(`[Firestore Sync] Syncing unsynced privacy completion for user: ${userId}`);
                const privacyData = {
                    privacyCompleted: true,
                    privacyCompletedTime: localStorage.getItem('privacyCompletedTime'),
                    privacyCompletedDate: localStorage.getItem('privacyCompletedDate')
                };
                await syncToFirestore('privacy', privacyData, userId);
            }
        }
        
        // Check final epsilon metrics
        const finalEpsilonChanges = localStorage.getItem('final_epsilon_changes');
        if (finalEpsilonChanges) {
            const userId = privacyState.userId || generateUserId();
            if (!isSynced('session_metrics', `${userId}_epsilon`)) {
                console.log(`[Firestore Sync] Syncing unsynced epsilon metrics for user: ${userId}`);
                const metricsData = {
                    epsilonChanges: finalEpsilonChanges,
                    averageEpsilon: localStorage.getItem('final_average_epsilon'),
                    timestamp: localStorage.getItem('final_epsilon_changes_timestamp')
                };
                await syncToFirestore('session_metrics', metricsData, `${userId}_epsilon`);
            }
        }
        
        console.log('[Firestore Sync] Finished checking for unsynced data');
    } catch (error) {
        console.error('[Firestore Sync] Error syncing unsynced data:', error);
    }
}

// Format timestamp in required format: HH:MM:SS, DD Month YYYY (24-hour format)
function formatTimestamp(date = new Date()) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    const day = date.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${hours}:${minutes}:${seconds}, ${day} ${month} ${year}`;
}

// Get or generate initial epsilon value for this user
// Randomizes starting value between 0.1 and 5.0 for new users
// Persists the same starting value across refreshes
function getInitialEpsilon() {
    const storedInitialEpsilon = localStorage.getItem('initialEpsilon');
    
    if (storedInitialEpsilon) {
        // User already has a starting value - use it
        const epsilon = parseFloat(storedInitialEpsilon);
        console.log('[Initial Epsilon] Using stored initial epsilon:', epsilon);
        return epsilon;
    } else {
        // New user - generate random starting value between 0.1 and 5.0
        // Use exact formula from requirements: +(0.1 + Math.random() * (5.0 - 0.1)).toFixed(1)
        const randomEpsilon = +(0.1 + Math.random() * (5.0 - 0.1)).toFixed(1);
        localStorage.setItem('initialEpsilon', randomEpsilon.toString());
        console.log('[Initial Epsilon] Generated new random initial epsilon:', randomEpsilon);
        return randomEpsilon;
    }
}

let privacyState = {
    epsilon: getInitialEpsilon(), // Use randomized initial epsilon instead of hardcoded 0.1
    settingsChanged: 0,
    userId: generateUserId(),
    epsilonValues: [], // Track all epsilon values for average calculation
    totalEpsilonSum: 0, // Track sum for efficient average calculation
    sessionStartTime: new Date(), // Track when session started
    sessionEndTime: null, // Track when session ended
    sessionEnded: false, // Track if session has ended
    finalAverageEpsilon: null, // Permanently stored average epsilon (fixed after completion)
    lastUpdatedTimestamp: null, // Store the last updated timestamp in required format
    isFrozen: false // Track if all values are frozen after completion
};

// Load frozen state from localStorage if forms are completed
if (localStorage.getItem('consentCompleted') === 'true' && localStorage.getItem('privacyCompleted') === 'true') {
    privacyState.isFrozen = true;
    // Load frozen values
    const frozenEpsilon = localStorage.getItem('finalEpsilon');
    const frozenSettingsChanged = localStorage.getItem('finalSettingsChanged');
    const frozenLastUpdated = localStorage.getItem('finalLastUpdated');
    const frozenAverageEpsilon = localStorage.getItem('finalAverageEpsilon');
    
    if (frozenEpsilon) privacyState.epsilon = parseFloat(frozenEpsilon);
    if (frozenSettingsChanged) privacyState.settingsChanged = parseInt(frozenSettingsChanged);
    if (frozenLastUpdated) privacyState.lastUpdatedTimestamp = frozenLastUpdated;
    if (frozenAverageEpsilon) privacyState.finalAverageEpsilon = parseFloat(frozenAverageEpsilon);
    
    // Load session end time if available (permanent record)
    const sessionEndTimeStr = localStorage.getItem('sessionEndTime');
    if (sessionEndTimeStr) {
        privacyState.sessionEndTime = new Date(sessionEndTimeStr);
        privacyState.sessionEnded = true;
    }
    
    // Load session started time if available (permanent record)
    const sessionStartedTimeStr = localStorage.getItem('sessionStartedTime');
    if (sessionStartedTimeStr) {
        privacyState.sessionStartTime = new Date(sessionStartedTimeStr);
    }
    
    // Load account created date (permanent record - never changes)
    const accountCreatedDateStr = localStorage.getItem('account_created_date');
    if (accountCreatedDateStr) {
        // Account created date is already loaded via getAccountCreatedDate()
        // This ensures it never resets
    }
} else {
    // Load active session values from localStorage (before completion)
    const savedEpsilonValues = localStorage.getItem('epsilonValues');
    const savedTotalEpsilonSum = localStorage.getItem('totalEpsilonSum');
    
    if (savedEpsilonValues) {
        try {
            privacyState.epsilonValues = JSON.parse(savedEpsilonValues);
        } catch (e) {
            console.error('Error parsing epsilonValues from localStorage:', e);
        }
    }
    if (savedTotalEpsilonSum) {
        privacyState.totalEpsilonSum = parseFloat(savedTotalEpsilonSum);
    }
}

// Track completion status with timestamps
let completionStatus = {
    consentCompleted: false,
    consentCompletedTime: null,
    consentCompletedDate: null,
    privacyCompleted: false,
    privacyCompletedTime: null,
    privacyCompletedDate: null
};

// Load completion status from localStorage on page load
if (localStorage.getItem('consentCompleted') === 'true') {
    completionStatus.consentCompleted = true;
    completionStatus.consentCompletedTime = localStorage.getItem('consentCompletedTime');
    completionStatus.consentCompletedDate = localStorage.getItem('consentCompletedDate');
}
if (localStorage.getItem('privacyCompleted') === 'true') {
    completionStatus.privacyCompleted = true;
    completionStatus.privacyCompletedTime = localStorage.getItem('privacyCompletedTime');
    completionStatus.privacyCompletedDate = localStorage.getItem('privacyCompletedDate');
}

/* ============================================
   REAL-TIME SESSION TRACKING SYSTEM
   ============================================ */

// Session tracking state
let currentSession = {
    userId: generateUserId(),
    startTime: new Date(),
    endTime: null,
    epsilonChanges: 0,
    firstEpsilon: null,
    finalEpsilon: null,
    consentCompleted: false,
    privacyCompleted: false,
    epsilonHistory: []
};

// Check if user has already been logged (completed both forms)
// Checks both localStorage and Firestore cache to prevent duplicates
function hasUserBeenLogged(userId) {
    // Check localStorage first
    const sessions = getSessionsFromStorage();
    const inLocalStorage = sessions.some(session => 
        session.userId === userId && 
        session.consentCompleted === true && 
        session.privacyCompleted === true
    );
    
    // Also check Firestore cache
    const inFirestore = firestoreDataCache.sessions && firestoreDataCache.sessions.some(session => 
        session.userId === userId && 
        session.consentCompleted === true && 
        session.privacyCompleted === true
    );
    
    return inLocalStorage || inFirestore;
}

// Track if finalizeSessionLog has been called for this session
let sessionFinalized = false;

// Check if user has a session for today
function hasSessionToday(userId) {
    const sessions = getSessionsFromStorage();
    const today = new Date().toLocaleDateString('en-GB');
    return sessions.some(session => 
        session.userId === userId && 
        session.date === today
    );
}

// Flag to track if event listeners have been added (prevent duplicates)
let sessionEventListenersAdded = false;
// Flag to prevent duplicate "User Entered" notifications in the same page load
let userEnteredNotificationCreated = false;
// Flag to prevent initializeSession from being called multiple times
let sessionInitialized = false;
// Track how many times createNotification('User Entered') is called (for debugging)
let userEnteredCallCount = 0;

// Create or update session document in Firestore on page load/refresh
// Uses userId as document ID to ensure 1 user = 1 document
async function createOrUpdateSessionInFirestore() {
    if (!window.db) {
        console.warn('[Session Firestore] Database not available yet');
        return;
    }
    
    try {
        const persistentUserId = generateUserId(); // Get persistent userId from localStorage
        const now = new Date();
        const accountCreatedDate = getAccountCreatedDate();
        
        // Prepare session data - always update timeStarted to current time on refresh
        const sessionData = {
            sessionId: sessionStorage.getItem('current_session_id') || Date.now().toString(),
            participant: 0, // Will be calculated when forms are completed
            date: now.toLocaleDateString('en-GB'),
            timeStarted: now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }),
            timeEnded: null,
            userId: persistentUserId,
            duration: 0,
            durationObj: null,
            epsilonChanges: currentSession.epsilonChanges || 0,
            firstEpsilon: currentSession.firstEpsilon || 'N/A',
            finalEpsilon: currentSession.finalEpsilon || 'N/A',
            averageEpsilon: calculateAverageEpsilon() || '0.00',
            privacyLevel: getPrivacyLevelFromFinalEpsilon(currentSession.finalEpsilon) || 'N/A',
            consentCompleted: currentSession.consentCompleted || false,
            privacyCompleted: currentSession.privacyCompleted || false,
            accountCreatedDate: accountCreatedDate.toISOString(),
            accountCreatedDateDisplay: accountCreatedDate.toLocaleDateString('en-GB'),
            sessionStatus: 'Active',
            epsilonHistory: currentSession.epsilonHistory || [],
            dataType: 'sessions',
            timestamp: now.toISOString(),
            syncedAt: now.toISOString()
        };
        
        // Use setDoc with userId as document ID - creates new or updates existing
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
        const sessionDocRef = doc(window.db, "responses", persistentUserId);
        await setDoc(sessionDocRef, sessionData, { merge: true });
        
        console.log('[Session Firestore] ✓ Session created/updated in Firestore:', {
            userId: persistentUserId,
            timeStarted: sessionData.timeStarted,
            isNew: !firestoreDataCache.sessions.some(s => s.userId === persistentUserId)
        });
        
        // Add to local cache immediately for real-time display
        const existingIndex = firestoreDataCache.sessions.findIndex(s => s.userId === persistentUserId);
        if (existingIndex >= 0) {
            firestoreDataCache.sessions[existingIndex] = sessionData;
        } else {
            firestoreDataCache.sessions.push(sessionData);
        }
        
        // Update session table in real-time
        if (typeof updateSessionTable === 'function') {
            updateSessionTable();
        }
        
    } catch (error) {
        console.error('[Session Firestore] ❌ Error creating/updating session:', error);
    }
}

// Initialize session on page load
function initializeSession() {
    // Prevent multiple calls to initializeSession
    if (sessionInitialized) {
        console.log('[Session] initializeSession already called, skipping');
        return;
    }
    sessionInitialized = true;
    
    // Clean up any existing duplicate sessions in localStorage
    cleanupDuplicateSessions();
    
    // Get persistent userId
    const persistentUserId = generateUserId();
    currentSession.userId = persistentUserId;
    
    // For new users: Use account created date as session start time
    // This ensures session start time matches first entry time
    const accountCreatedDate = getAccountCreatedDate();
    currentSession.startTime = accountCreatedDate;
    
    // Also set privacyState sessionStartTime to match
    privacyState.sessionStartTime = accountCreatedDate;
    
    // ALWAYS create/update session document in Firestore on page load/refresh
    // This ensures the session appears in logs table in real-time
    // Retry if Firestore isn't ready yet
    if (window.db) {
        createOrUpdateSessionInFirestore();
    } else {
        // Firestore not ready yet - retry after a short delay
        setTimeout(() => {
            if (window.db) {
                createOrUpdateSessionInFirestore();
            } else {
                console.warn('[Session] Firestore still not available, session will be created when Firestore is ready');
            }
        }, 1000);
    }
    
    // ALWAYS log "User Entered" notification on page load/refresh
    // (duplicate prevention is handled inside createNotification)
    createNotification('User Entered', persistentUserId);
    
    // Check if this is a new session (not a refresh)
    const sessionId = sessionStorage.getItem('current_session_id');
    if (!sessionId) {
        // New session - create entry only if user hasn't been logged today
        if (!hasSessionToday(persistentUserId)) {
            const newSessionId = Date.now().toString();
            sessionStorage.setItem('current_session_id', newSessionId);
            
            // Create session log entry with current time (but don't save yet - wait for completion or exit)
            createSessionLog();
        } else {
            // User already has a session today - just load it
            loadSessionFromStorage();
        }
    } else {
        // Session ID exists - check if this is a refresh or a new visit after closing
        const sessions = getSessionsFromStorage();
        const existingIndex = sessions.findIndex(s => s.sessionId === sessionId);
        
        if (existingIndex >= 0) {
            // Session exists - check if it was already ended
            if (sessions[existingIndex].timeEnded && sessions[existingIndex].timeEnded !== 'N/A') {
                // Previous session ended - check if user already completed both forms
                if (!hasUserBeenLogged(currentSession.userId) && !hasSessionToday(currentSession.userId)) {
                    // Create a new session with new timeStarted
                    const newSessionId = Date.now().toString();
                    sessionStorage.setItem('current_session_id', newSessionId);
                    createSessionLog();
                } else {
                    // User already logged - just load session data
                    loadSessionFromStorage();
                }
            } else {
                // Session exists but hasn't ended - this is a refresh
                // Keep original timeStarted, just ensure timeEnded is null
                sessions[existingIndex].timeEnded = null;
                sessions[existingIndex].duration = 0;
                saveSessionsToStorage(sessions);
                updateSessionTable();
            }
        } else {
            // Session ID exists but no log entry - create one only if not already logged today
            if (!hasSessionToday(currentSession.userId)) {
                createSessionLog();
            } else {
                loadSessionFromStorage();
            }
        }
        
        // Load other session data
        loadSessionFromStorage();
    }
    
    // Add event listeners only once (prevent duplicates)
    if (!sessionEventListenersAdded) {
        addSessionEventListeners();
    }
}

// Add session tracking event listeners (only called once)
function addSessionEventListeners() {
    if (sessionEventListenersAdded) return;
    
    // Track when page loads to detect if it was a refresh
    // Store a timestamp when page loads - if pagehide fires very soon after, it's likely a refresh
    const pageLoadTime = Date.now();
    sessionStorage.setItem('page_load_time', pageLoadTime.toString());
    
    // Track page hide - only create "User Left" on actual browser/tab close (NOT on refresh)
    window.addEventListener('pagehide', function(e) {
        // If page is being persisted to BFCache, it's a refresh/navigation, not a close
        if (e.persisted) {
            return; // Don't create "User Left" notification
        }
        
        // Check how long the page was open
        const loadTime = sessionStorage.getItem('page_load_time');
        if (loadTime) {
            const timeOpen = Date.now() - parseInt(loadTime);
            // If page was open for less than 2 seconds, it's likely a refresh
            // (refresh happens almost immediately after pagehide)
            if (timeOpen < 2000) {
                return; // Likely a refresh, don't create "User Left" notification
            }
        }
        
        // Check navigation type - if it was a reload, don't create notification
        let isReload = false;
        try {
            const navEntry = performance.getEntriesByType('navigation')[0];
            if (navEntry && navEntry.type === 'reload') {
                isReload = true;
            }
        } catch (err) {
            // Navigation API not available
        }
        
        // Only create "User Left" notification if it's NOT a reload and page was open for a while
        if (!isReload) {
            // Page is being closed (not refreshed), create "User Left" notification
            endSession();
        }
    });
    
    sessionEventListenersAdded = true;
}

// Create session log entry (only called when needed - not on every refresh)
function createSessionLog() {
    const sessions = getSessionsFromStorage();
    const sessionId = sessionStorage.getItem('current_session_id');
    
    // Don't log if user has already completed both forms
    if (hasUserBeenLogged(currentSession.userId)) {
        return;
    }
    
    // Check if session already exists
    const existingIndex = sessions.findIndex(s => s.sessionId === sessionId);
    
    // Calculate participant number (count unique users who completed both forms)
    const completedUsers = sessions.filter(s => s.consentCompleted && s.privacyCompleted);
    const uniqueCompletedUserIds = [...new Set(completedUsers.map(s => s.userId))];
    const participantNumber = uniqueCompletedUserIds.length + 1;
    
    // Use account created date for session start time (first entry time)
    const accountCreatedDate = getAccountCreatedDate();
    const sessionStartTime = accountCreatedDate;
    
    const sessionData = {
        sessionId: sessionId,
        participant: participantNumber,
        date: accountCreatedDate.toLocaleDateString('en-GB'),
        timeStarted: sessionStartTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }),
        timeEnded: null,
        userId: currentSession.userId,
        duration: 0,
        durationObj: null,
        epsilonChanges: currentSession.epsilonChanges,
        firstEpsilon: currentSession.firstEpsilon || 'N/A',
        finalEpsilon: currentSession.finalEpsilon || 'N/A',
        averageEpsilon: calculateAverageEpsilon(),
        privacyLevel: getPrivacyLevelFromFinalEpsilon(currentSession.finalEpsilon),
        consentCompleted: currentSession.consentCompleted,
        privacyCompleted: currentSession.privacyCompleted,
        accountCreatedDate: accountCreatedDate.toISOString(),
        accountCreatedDateDisplay: accountCreatedDate.toLocaleDateString('en-GB'),
        sessionStatus: 'Active',
        epsilonHistory: [...currentSession.epsilonHistory] // Store all epsilon values
    };
    
    // Check for existing session by userId (not just sessionId) to prevent duplicates
    const existingByUserId = sessions.findIndex(s => s.userId === currentSession.userId);
    
    if (existingByUserId >= 0) {
        // Update existing session for this userId (prevent duplicates)
        console.log('[createSessionLog] Updating existing session for userId:', currentSession.userId);
        sessions[existingByUserId] = sessionData;
    } else if (existingIndex >= 0) {
        // Update existing session by sessionId
        sessions[existingIndex] = sessionData;
    } else {
        // Only add new session if user hasn't been logged today
        if (!hasSessionToday(currentSession.userId)) {
            sessions.push(sessionData);
        }
    }
    
    // Deduplicate before saving to prevent duplicates
    const deduplicated = deduplicateSessions(sessions);
    saveSessionsToStorage(deduplicated);
    updateSessionTable();
}

// End session (only called when user actually closes browser/tab, NOT on refresh)
function endSession() {
    // Log "User Left" notification when user actually closes browser/tab
    // This function is only called when pagehide event fires with !e.persisted
    // and the navigation type is NOT 'reload', ensuring it only fires on actual close
    createNotification('User Left', currentSession.userId);
    
    // Don't end session if user has already completed both forms (already logged)
    if (hasUserBeenLogged(currentSession.userId)) {
        return;
    }
    
    const sessions = getSessionsFromStorage();
    const sessionId = sessionStorage.getItem('current_session_id');
    if (!sessionId) return;
    
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex < 0) return;
    
    // Only finalize if both forms are completed
    if (currentSession.consentCompleted && currentSession.privacyCompleted) {
        // Both forms completed - calculate final duration and finalize
        const now = new Date();
        const accountCreatedDate = getAccountCreatedDate();
        const sessionStartTime = accountCreatedDate;
        
        // Calculate duration from start to end
        const durationMs = now.getTime() - sessionStartTime.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
        const durationObj = { hours, minutes, seconds, totalSeconds: Math.floor(durationMs / 1000) };
        
        // Update session with end time and duration
        sessions[sessionIndex].timeEnded = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        sessions[sessionIndex].duration = durationObj.totalSeconds;
        sessions[sessionIndex].durationObj = durationObj;
        sessions[sessionIndex].sessionStatus = 'Completed';
        
        // Calculate and store average epsilon
        const averageEpsilon = calculateAverageEpsilon();
        sessions[sessionIndex].averageEpsilon = averageEpsilon;
        
        // Store privacy level
        const privacyLevel = getPrivacyLevelFromFinalEpsilon(currentSession.finalEpsilon);
        sessions[sessionIndex].privacyLevel = privacyLevel;
        
        // Store all epsilon values
        sessions[sessionIndex].epsilonHistory = [...currentSession.epsilonHistory];
        
        saveSessionsToStorage(sessions);
        updateSessionTable();
    } else {
        // Forms not completed - just update the existing session with current state
        // but don't set timeEnded (session is still active)
        sessions[sessionIndex].epsilonChanges = currentSession.epsilonChanges;
        sessions[sessionIndex].finalEpsilon = currentSession.finalEpsilon || 'N/A';
        sessions[sessionIndex].consentCompleted = currentSession.consentCompleted;
        sessions[sessionIndex].privacyCompleted = currentSession.privacyCompleted;
        sessions[sessionIndex].epsilonHistory = [...currentSession.epsilonHistory];
        saveSessionsToStorage(sessions);
    }
}

// Calculate duration in hours, minutes, and seconds from date and time strings
function calculateDurationFromTimes(dateStr, timeStartedStr, timeEndedStr) {
    try {
        // Parse date (format: DD/MM/YYYY)
        const [day, month, year] = dateStr.split('/').map(Number);
        
        // Parse timeStarted (format: "HH:MM:SS AM/PM")
        const startTimeMatch = timeStartedStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
        if (!startTimeMatch) return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
        
        let startHours = parseInt(startTimeMatch[1]);
        const startMinutes = parseInt(startTimeMatch[2]);
        const startSeconds = parseInt(startTimeMatch[3]);
        const startAmPm = startTimeMatch[4].toUpperCase();
        
        if (startAmPm === 'PM' && startHours !== 12) startHours += 12;
        if (startAmPm === 'AM' && startHours === 12) startHours = 0;
        
        // Parse timeEnded (format: "HH:MM:SS AM/PM")
        const endTimeMatch = timeEndedStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
        if (!endTimeMatch) return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
        
        let endHours = parseInt(endTimeMatch[1]);
        const endMinutes = parseInt(endTimeMatch[2]);
        const endSeconds = parseInt(endTimeMatch[3]);
        const endAmPm = endTimeMatch[4].toUpperCase();
        
        if (endAmPm === 'PM' && endHours !== 12) endHours += 12;
        if (endAmPm === 'AM' && endHours === 12) endHours = 0;
        
        // Create Date objects
        const startDate = new Date(year, month - 1, day, startHours, startMinutes, startSeconds);
        const endDate = new Date(year, month - 1, day, endHours, endMinutes, endSeconds);
        
        // Handle case where end time is next day (e.g., 11:30 PM to 1:30 AM)
        if (endDate < startDate) {
            endDate.setDate(endDate.getDate() + 1);
        }
        
        // Calculate difference in milliseconds, then convert to total seconds
        const diffMs = endDate - startDate;
        const totalSeconds = Math.floor(diffMs / 1000);
        
        // Calculate hours, minutes, and seconds
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return { hours, minutes, seconds, totalSeconds };
    } catch (e) {
        console.error('Error calculating duration:', e);
        return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
    }
}

// Get sessions from Firestore cache and localStorage (merged)
function getSessionsFromStorage() {
    const sessions = [];
    const seenSessionIds = new Set();
    
    // First, get from Firestore cache (real-time data from all participants)
    if (firestoreDataCache.sessions && firestoreDataCache.sessions.length > 0) {
        firestoreDataCache.sessions.forEach(session => {
            const sessionKey = session.sessionId || session.userId;
            if (!seenSessionIds.has(sessionKey)) {
                seenSessionIds.add(sessionKey);
                sessions.push(session);
            }
        });
    }
    
    // Fallback: Get from localStorage (for offline/backup)
    const stored = localStorage.getItem('session_logs');
    if (stored) {
        try {
            const localSessions = JSON.parse(stored);
            localSessions.forEach(session => {
                const sessionKey = session.sessionId || session.userId;
                if (!seenSessionIds.has(sessionKey)) {
                    seenSessionIds.add(sessionKey);
                    sessions.push(session);
                }
            });
        } catch (e) {
            console.error('Error parsing session_logs from localStorage:', e);
        }
    }
    
    return sessions;
}

// Save sessions to localStorage and sync to Firestore
// PREVENTS DUPLICATES: Uses userId as document ID for Firestore
function saveSessionsToStorage(sessions) {
    // Save to localStorage (offline backup)
    localStorage.setItem('session_logs', JSON.stringify(sessions));
    
    // Sync completed sessions to Firestore
    // CRITICAL: Use userId as document ID to ensure 1 user = 1 document
    const completedSessions = sessions.filter(s => 
        s.consentCompleted === true && s.privacyCompleted === true
    );
    
    completedSessions.forEach(session => {
        // Use persistent userId as document ID (not sessionId) to prevent duplicates
        const userId = session.userId || generateUserId();
        if (userId && !isSynced('sessions', userId)) {
            // Use userId as the document ID - setDoc will update existing or create new
            syncToFirestore('sessions', session, userId).catch(err => {
                console.error(`[Firestore Sync] Failed to sync session for userId ${userId}:`, err);
            });
        }
    });
}

// Clear all session logs (remove test/mock data)
function clearAllSessionLogs() {
    localStorage.removeItem('session_logs');
    updateSessionTable();
    console.log('All session logs cleared. System ready for real participant data.');
}

// Load session from storage
function loadSessionFromStorage() {
    const sessions = getSessionsFromStorage();
    // Find the completed session for this user
    const session = sessions.find(s => 
        s.userId === currentSession.userId && 
        s.consentCompleted === true && 
        s.privacyCompleted === true
    );
    
    if (session) {
        // Load all session data
        currentSession.epsilonChanges = session.epsilonChanges || 0;
        currentSession.firstEpsilon = session.firstEpsilon;
        currentSession.finalEpsilon = session.finalEpsilon;
        currentSession.consentCompleted = session.consentCompleted || false;
        currentSession.privacyCompleted = session.privacyCompleted || false;
        currentSession.epsilonHistory = session.epsilonHistory || [];
        currentSession.startTime = session.accountCreatedDate ? new Date(session.accountCreatedDate) : new Date();
        
        // Restore privacyState from session
        if (session.epsilonHistory && session.epsilonHistory.length > 0) {
            privacyState.epsilonValues = [...session.epsilonHistory];
            privacyState.totalEpsilonSum = session.epsilonHistory.reduce((a, b) => a + b, 0);
            privacyState.settingsChanged = session.epsilonChanges || 0;
            if (session.finalEpsilon && session.finalEpsilon !== 'N/A') {
                privacyState.epsilon = parseFloat(session.finalEpsilon);
            } else {
                // If no final epsilon, use initial epsilon (persisted starting value)
                privacyState.epsilon = getInitialEpsilon();
            }
        } else {
            // No session history - use initial epsilon (persisted starting value)
            privacyState.epsilon = getInitialEpsilon();
        }
        
        // Restore session start time
        if (session.accountCreatedDate) {
            privacyState.sessionStartTime = new Date(session.accountCreatedDate);
        }
    }
}

/* ============================================
   REAL-TIME NOTIFICATION SYSTEM
   ============================================ */

// Notification types
const NOTIFICATION_TYPES = {
    'User Entered': { icon: 'fa-eye', tag: 'Page Access' },
    'Consent Form Completed': { icon: 'fa-file-signature', tag: 'Consent' },
    'Privacy Form Completed': { icon: 'fa-clipboard-check', tag: 'Privacy' },
    'User Left': { icon: 'fa-sign-out-alt', tag: 'Exit' }
};

// Create a notification
function createNotification(type, userId) {
    // Prevent duplicate "User Entered" notifications - CHECK FIRST before doing anything
    if (type === 'User Entered') {
        // CRITICAL: Check flag FIRST - if already created in this page load, skip immediately
        if (userEnteredNotificationCreated) {
            return; // Already created in this page load, skip
        }
        
        // Set flag IMMEDIATELY to prevent race conditions
        userEnteredNotificationCreated = true;
        
        // RELOAD notifications from storage to check for VERY recent ones (only prevent rapid double-calls)
        const latestNotifications = getNotificationsFromStorage();
        const now = Date.now();
        
        // Only check for VERY recent notifications (within 1 second) to prevent rapid double-calls
        // This allows normal refreshes to create notifications
        const veryRecentNotification = latestNotifications.find(n => 
            n.type === 'User Entered' && 
            n.userId === userId &&
            (now - new Date(n.timestamp).getTime()) < 1000 // 1 second - only prevent rapid double-calls
        );
        
        if (veryRecentNotification) {
            // Found a very recent notification (within 1 second) - likely a rapid double-call
            // Reset flag and skip
            userEnteredNotificationCreated = false;
            return;
        }
        
        // All checks passed - notification will be created (flag already set)
    }
    
    const notifications = getNotificationsFromStorage();
    const notificationType = NOTIFICATION_TYPES[type];
    
    if (!notificationType) return;
    
    const notification = {
        id: Date.now().toString(),
        type: type,
        userId: userId,
        timestamp: new Date().toISOString(),
        read: false,
        icon: notificationType.icon,
        tag: notificationType.tag
    };
    
    // Final safety check: RELOAD notifications and ensure we're not adding an exact duplicate
    // This is critical because another call might have just saved a notification
    const finalNotifications = getNotificationsFromStorage();
    const notificationTime = new Date(notification.timestamp).getTime();
    const exactDuplicate = finalNotifications.find(n => 
        n.type === type &&
        n.userId === userId &&
        Math.abs(new Date(n.timestamp).getTime() - notificationTime) < 1000 // Within 1 second
    );
    
    if (exactDuplicate) {
        console.log('[Notification] Exact duplicate prevented before saving', exactDuplicate);
        // Reset flag if this was a "User Entered" notification (so it can be retried if needed)
        if (type === 'User Entered') {
            userEnteredNotificationCreated = false;
        }
        return; // Don't create duplicate
    }
    
    // Use the reloaded notifications array to ensure we have the latest state
    finalNotifications.unshift(notification); // Add to beginning
    saveNotificationsToStorage(finalNotifications);
    updateNotificationBadge(getUnreadCount(finalNotifications));
    
    // Sync notification to Firestore for real-time updates across all participants
    syncToFirestore('notification', notification, notification.id).catch(err => {
        console.error('[Firestore Sync] Failed to sync notification:', err);
    });
    
    // Only render notifications if we're currently on the notifications page
    // This prevents unnecessary rendering and potential duplicate issues
    if (document.getElementById('notifications-list') && 
        document.getElementById('notifications-page')?.classList.contains('active')) {
        renderNotifications();
    }
}

// Get notifications from localStorage
// Get notifications from Firestore cache and localStorage (merged)
function getNotificationsFromStorage() {
    const notifications = [];
    const seenNotificationIds = new Set();
    
    // First, get from Firestore cache (real-time notifications from all participants)
    if (firestoreDataCache.notifications && firestoreDataCache.notifications.length > 0) {
        firestoreDataCache.notifications.forEach(notification => {
            if (!seenNotificationIds.has(notification.id)) {
                seenNotificationIds.add(notification.id);
                notifications.push(notification);
            }
        });
    }
    
    // Fallback: Get from localStorage (for offline/backup)
    const stored = localStorage.getItem('notifications');
    if (stored) {
        try {
            const localNotifications = JSON.parse(stored);
            localNotifications.forEach(notification => {
                if (!seenNotificationIds.has(notification.id)) {
                    seenNotificationIds.add(notification.id);
                    notifications.push(notification);
                }
            });
        } catch (e) {
            console.error('Error parsing notifications from localStorage:', e);
        }
    }
    
    // Sort by timestamp (newest first)
    notifications.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
    });
    
    return notifications;
}

// Save notifications to localStorage
function saveNotificationsToStorage(notifications) {
    localStorage.setItem('notifications', JSON.stringify(notifications));
}

// Get unread count
function getUnreadCount(notifications) {
    return notifications.filter(n => !n.read).length;
}

// Update notification badge
function updateNotificationBadge(count) {
    const badge = document.getElementById('bell-count');
    if (badge) {
        badge.textContent = count > 0 ? count : '0';
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

// Helper function to format date as "12th November 2025"
function formatNotificationDate(date) {
    const day = date.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
}

// Render notifications
function renderNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    
    // Get notifications from storage (read-only, don't modify)
    const notifications = getNotificationsFromStorage();
    
    // Clear the list before rendering
    notificationsList.innerHTML = '';
    
    const now = Date.now();
    
    notifications.forEach(notification => {
        const timestamp = new Date(notification.timestamp);
        const diffMs = now - timestamp.getTime();
        const totalSeconds = Math.floor(diffMs / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        
        const hours = totalHours;
        const minutes = totalMinutes % 60;
        const seconds = totalSeconds % 60;
        
        let timeAgo;
        if (hours > 0) {
            timeAgo = `${hours} hour${hours !== 1 ? 's' : ''}`;
            if (minutes > 0) {
                timeAgo += ` ${minutes} min${minutes !== 1 ? 's' : ''}`;
            }
            if (seconds > 0) {
                timeAgo += ` ${seconds} second${seconds !== 1 ? 's' : ''}`;
            }
            timeAgo += ' ago';
        } else if (minutes > 0) {
            timeAgo = `${minutes} min${minutes !== 1 ? 's' : ''}`;
            if (seconds > 0) {
                timeAgo += ` ${seconds} second${seconds !== 1 ? 's' : ''}`;
            }
            timeAgo += ' ago';
        } else {
            timeAgo = `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
        }
        
        const hoursDisplay = timestamp.getHours();
        const minutesDisplay = timestamp.getMinutes().toString().padStart(2, '0');
        const secondsDisplay = timestamp.getSeconds().toString().padStart(2, '0');
        const ampm = hoursDisplay >= 12 ? 'PM' : 'AM';
        const displayHours = (hoursDisplay % 12 || 12).toString().padStart(2, '0');
        const formattedTime = `${displayHours}:${minutesDisplay}:${secondsDisplay} ${ampm}`;
        const formattedDate = formatNotificationDate(timestamp);
        
        const getMessage = (type, userId) => {
            switch(type) {
                case 'User Entered': return `${userId} has entered the Zynex website`;
                case 'Consent Form Completed': return `${userId} has completed the consent form`;
                case 'Privacy Form Completed': return `${userId} has completed the privacy form`;
                case 'User Left': return `${userId} has exited the Zynex website`;
                default: return '';
            }
        };
        
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
        notificationEl.setAttribute('data-id', notification.id);
        notificationEl.innerHTML = `
            <div class="notification-icon"><i class="fas ${notification.icon}"></i></div>
            <div class="notification-content">
                <h3 class="notification-title">${notification.type}</h3>
                <p class="notification-message">${getMessage(notification.type, notification.userId)}</p>
                <div class="notification-footer">
                    <span class="notification-time">${timeAgo} at ${formattedTime}, ${formattedDate}</span>
                </div>
            </div>
            <div class="notification-status"></div>
            <div class="notification-actions">
                <button class="notification-read-btn" data-read="${notification.read}">
                    <i class="fas ${notification.read ? 'fa-envelope-open' : 'fa-envelope'}"></i>
                </button>
                <button class="notification-delete-btn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        notificationsList.appendChild(notificationEl);
    });
    
    attachNotificationReadListeners();
    updateNotificationCounters();
}

// Update notification counters (read-only, doesn't create notifications)
function updateNotificationCounters() {
    const allCount = document.getElementById('all-count');
    // Read notifications from storage (read-only operation)
    const notifications = getNotificationsFromStorage();
    
    if (allCount) {
        allCount.textContent = notifications.length;
    }
    
    const unreadCount = getUnreadCount(notifications);
    updateNotificationBadge(unreadCount);
}

function initializePrivacyControls() {
    const slider = document.getElementById('privacy-slider');
    const surveyButton = document.getElementById('survey-button');
    
    if (!slider) return;
    
    // Check if forms are completed - if so, load frozen values and disable slider
    if (privacyState.isFrozen) {
        // Load final epsilon value
        const sessions = getSessionsFromStorage();
        const userSession = sessions.find(s => 
            s.userId === currentSession.userId && 
            s.consentCompleted === true && 
            s.privacyCompleted === true
        );
        
            if (userSession && userSession.finalEpsilon && userSession.finalEpsilon !== 'N/A') {
                const finalEpsilon = parseFloat(userSession.finalEpsilon);
                // Use synchronization function to ensure perfect match
                const synchronizedEpsilon = synchronizeSliderAndDisplay(finalEpsilon);
                updatePrivacyDisplay(synchronizedEpsilon);
                updateTradeoffMetrics(synchronizedEpsilon);
            }
        
        // Disable slider completely
        slider.disabled = true;
        slider.style.opacity = '0.6';
        slider.style.cursor = 'not-allowed';
        
        // Update session info with frozen values
        updateSessionInfo();
        return;
    }
    
    // CRITICAL: Check if user has completed forms - if so, load finalEpsilon (not random value)
    const sessions = getSessionsFromStorage();
    const userSession = sessions.find(s => 
        s.userId === privacyState.userId && 
        s.consentCompleted === true && 
        s.privacyCompleted === true
    );

    let currentEpsilon;

    if (userSession && userSession.finalEpsilon && userSession.finalEpsilon !== 'N/A') {
        // User has completed - use their final chosen epsilon value
        currentEpsilon = parseFloat(userSession.finalEpsilon);
        console.log('[Privacy Controls] ✅ Loading completed user finalEpsilon:', currentEpsilon);
    } else {
        // New/incomplete user - use random initial value or saved progress
        const initialEpsilon = getInitialEpsilon(); // Random value 0.1-5.0
        const savedEpsilon = localStorage.getItem('currentEpsilon');
        currentEpsilon = savedEpsilon ? parseFloat(savedEpsilon) : initialEpsilon;
        console.log('[Privacy Controls] Loading new/active user epsilon:', currentEpsilon);
    }

    // Synchronize slider handle position and displayed value
    const synchronizedEpsilon = synchronizeSliderAndDisplay(currentEpsilon);
    
    // Update all related displays
    updatePrivacyDisplay(synchronizedEpsilon);
    updateTradeoffMetrics(synchronizedEpsilon);
    
    // Verify synchronization (safety check) - ensures they match after initialization
    setTimeout(() => {
        const sliderValue = parseFloat(slider.value).toFixed(1);
        const displayValue = document.getElementById('epsilon-value')?.textContent;
        if (sliderValue !== displayValue) {
            console.warn('[Sync Check] ⚠️ Mismatch detected! Slider:', sliderValue, 'Display:', displayValue);
            // Force re-synchronization
            synchronizeSliderAndDisplay(synchronizedEpsilon);
            updatePrivacyDisplay(synchronizedEpsilon);
        } else {
            console.log('[Sync Check] ✅ Slider and display synchronized:', sliderValue);
        }
    }, 100); // Small delay to ensure DOM is fully updated
    
    // For new users: the initialEpsilon is already stored in localStorage by getInitialEpsilon()
    // This ensures the same random starting position persists across refreshes
    
    // Load saved settings changed count
    const savedSettingsChanged = localStorage.getItem('settingsChanged');
    if (savedSettingsChanged) {
        privacyState.settingsChanged = parseInt(savedSettingsChanged);
    }
    
    // Load saved last updated timestamp
    const savedLastUpdated = localStorage.getItem('lastUpdatedTimestamp');
    if (savedLastUpdated) {
        privacyState.lastUpdatedTimestamp = savedLastUpdated;
    }
    
    // Use 'input' event for real-time display updates during dragging
    // This ensures the display always matches the slider thumb position
    // AND updates the timestamp on every move
    slider.addEventListener('input', function() {
        if (privacyState.isFrozen) {
            // Prevent any changes if frozen
            return;
        }
        
        const epsilon = parseFloat(this.value);
        
        // CRITICAL: Use synchronizeSliderAndDisplay to ensure perfect match
        const synchronizedEpsilon = synchronizeSliderAndDisplay(epsilon);
        
        // Update all related displays
        updatePrivacyDisplay(synchronizedEpsilon);
        updateTradeoffMetrics(synchronizedEpsilon);
        
        // Update timestamp on every slider move
        updateSessionInfo();
        
        // Save current epsilon to localStorage
        localStorage.setItem('currentEpsilon', synchronizedEpsilon.toFixed(1));
    });
    
    // Use 'change' event to count actual epsilon selections (when user releases slider)
    // This fires after the user releases the slider, ensuring the final value is captured
    slider.addEventListener('change', function() {
        const epsilon = parseFloat(this.value);
        
        // CRITICAL: Ensure perfect synchronization before processing change
        const synchronizedEpsilon = synchronizeSliderAndDisplay(epsilon);
        
        // Ensure display matches the final slider value
        updatePrivacyDisplay(synchronizedEpsilon);
        updateTradeoffMetrics(synchronizedEpsilon);
        
        // Prevent changes if user has completed both forms
        if (completionStatus.consentCompleted && completionStatus.privacyCompleted) {
            // Restore to final epsilon value
            const sessions = getSessionsFromStorage();
            const userSession = sessions.find(s => 
                s.userId === currentSession.userId && 
                s.consentCompleted === true && 
                s.privacyCompleted === true
            );
            if (userSession && userSession.finalEpsilon && userSession.finalEpsilon !== 'N/A') {
                const finalEpsilon = parseFloat(userSession.finalEpsilon);
                // Use synchronization function to ensure perfect match
                const synchronizedEpsilon = synchronizeSliderAndDisplay(finalEpsilon);
                updatePrivacyDisplay(synchronizedEpsilon);
                updateTradeoffMetrics(synchronizedEpsilon);
            }
            return; // Don't allow changes
        }
        
        // Only count this as a new selection
        privacyState.settingsChanged++;
        currentSession.epsilonChanges++;
        
        // Save settings changed count to localStorage
        localStorage.setItem('settingsChanged', privacyState.settingsChanged.toString());
        
        // Track first epsilon - only set on first adjustment (when null or 'N/A')
        if (currentSession.firstEpsilon === null || currentSession.firstEpsilon === 'N/A' || !currentSession.firstEpsilon) {
            currentSession.firstEpsilon = epsilon.toFixed(1);
            console.log('First epsilon recorded:', currentSession.firstEpsilon);
        }
        
        // Always update final epsilon to the latest value (use 1 decimal place)
        currentSession.finalEpsilon = epsilon.toFixed(1);
        console.log('Final epsilon updated:', currentSession.finalEpsilon);
        
        // Track epsilon value for average calculation
        privacyState.epsilonValues.push(epsilon);
        privacyState.totalEpsilonSum += epsilon;
        currentSession.epsilonHistory.push(epsilon);
        
        // Save epsilon values to localStorage for persistence across refreshes
        localStorage.setItem('epsilonValues', JSON.stringify(privacyState.epsilonValues));
        localStorage.setItem('totalEpsilonSum', privacyState.totalEpsilonSum.toString());
        
        // Update session log
        createSessionLog();
        
        console.log('Epsilon changed to:', epsilon);
        console.log('Total selections:', privacyState.settingsChanged);
        console.log('Epsilon values:', privacyState.epsilonValues);
        if (privacyState.epsilonValues.length > 0) {
            console.log('Average:', (privacyState.totalEpsilonSum / privacyState.epsilonValues.length).toFixed(1));
        }
        
        updateSessionInfo();
        updateAccountInfo(); // Update average epsilon display
        
        // Update activity status
        updateRecentActivityStatus();
        
        // Trigger CAPTCHA based on epsilon value (only in privacy section)
        const currentPage = document.querySelector('.page-content.active');
        if (currentPage && currentPage.id === 'privacy-page') {
            triggerCaptcha(() => {
                console.log('Privacy setting adjustment confirmed');
            });
        }
    });
        
    if (surveyButton) {
        surveyButton.addEventListener('click', function() {
            openSurveyModal();
        });
    }
    
    updateSessionInfo();
}

/* ============================================
   ACCOUNT PAGE FUNCTIONALITY
   ============================================ */

function initializeAccountPage() {
    // Sync with privacy state
    updateAccountInfo();
    
    // Update session timer
    let sessionStartTime = Date.now();
    
    setInterval(() => {
        const elapsed = Date.now() - sessionStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const sessionDuration = document.getElementById('session-duration');
        if (sessionDuration) {
            sessionDuration.textContent = `${hours}h ${minutes}m ${seconds}s`;
        }
    }, 1000);
    
    // Update last updated time
    updateAccountTimestamp();
    
    // Wire up View button click handlers
    const consentViewBtn = document.getElementById('consent-view-btn');
    if (consentViewBtn) {
        consentViewBtn.addEventListener('click', function(e) {
            e.preventDefault();
            downloadConsentFormFromActivity();
        });
    }
    
    const privacyViewBtn = document.getElementById('privacy-view-btn');
    if (privacyViewBtn) {
        privacyViewBtn.addEventListener('click', function(e) {
            e.preventDefault();
            downloadPrivacyFormFromActivity();
        });
    }
}

// Function to mark consent as completed
function markConsentCompleted() {
    // Check if already completed (one-time only)
    if (completionStatus.consentCompleted) {
        // Show success popup if user revisits
        showConsentSuccessModal();
        return;
    }
    
    // Clear saved progress since form is now submitted
    localStorage.removeItem('consentProgress');
    console.log('[markConsentCompleted] Cleared consentProgress from localStorage (form submitted)');
    
    completionStatus.consentCompleted = true;
    const now = new Date();
    completionStatus.consentCompletedTime = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    completionStatus.consentCompletedDate = now.toLocaleDateString('en-US');
    
    // Save to localStorage (offline backup)
    localStorage.setItem('consentCompleted', 'true');
    localStorage.setItem('consentCompletedTime', completionStatus.consentCompletedTime);
    localStorage.setItem('consentCompletedDate', completionStatus.consentCompletedDate);
    
    // Sync to Firestore
    const consentData = {
        consentCompleted: true,
        consentCompletedTime: completionStatus.consentCompletedTime,
        consentCompletedDate: completionStatus.consentCompletedDate
    };
    syncToFirestore('consent', consentData, currentSession.userId).catch(err => {
        console.error('[Firestore Sync] Failed to sync consent completion:', err);
    });
    
    // Update session
    currentSession.consentCompleted = true;
    
    // Store consent completion time in session
    const sessions = getSessionsFromStorage();
    const sessionId = sessionStorage.getItem('current_session_id');
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex >= 0) {
        sessions[sessionIndex].consentCompletedTime = completionStatus.consentCompletedTime;
        sessions[sessionIndex].consentCompletedDate = completionStatus.consentCompletedDate;
        sessions[sessionIndex].consentCompleted = true;
        saveSessionsToStorage(sessions);
    }
    
    // Only log session if both forms are completed OR update existing session
    if (currentSession.privacyCompleted) {
        // Both forms completed - finalize the log entry
        finalizeSessionLog();
        
        // CRITICAL: Update account info to reflect "Completed" status
        setTimeout(() => {
            updateAccountInfo();
            updateAccountTimestamp();
            console.log('[markConsentCompleted] ✅ Updated account info with Completed status');
        }, 200);
    } else {
        // Only consent completed - update session but don't finalize yet
        createSessionLog();
    }
    
    // Create notification
    createNotification('Consent Form Completed', currentSession.userId);
    
    // Disable consent form
    disableConsentForm();
    
    // Update privacy form access
    checkPrivacyFormAccess();
    checkPrivacyPageAccess();
    
    updateRecentActivityStatus();
    
    // Show success modal
    showConsentSuccessModal();
}

// Function to mark privacy questionnaire as completed (call this when actual questionnaire is submitted)
function markPrivacyQuestionnaireCompleted() {
    // Check if already completed (one-time only)
    if (completionStatus.privacyCompleted) {
        // Show success popup if user revisits
        showPrivacySuccessModal();
        return;
    }
    
    completionStatus.privacyCompleted = true;
    const now = new Date();
    completionStatus.privacyCompletedTime = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    completionStatus.privacyCompletedDate = now.toLocaleDateString('en-US');
    
    // Save to localStorage (offline backup)
    localStorage.setItem('privacyCompleted', 'true');
    localStorage.setItem('privacyCompletedTime', completionStatus.privacyCompletedTime);
    localStorage.setItem('privacyCompletedDate', completionStatus.privacyCompletedDate);
    
    // Sync to Firestore
    const privacyData = {
        privacyCompleted: true,
        privacyCompletedTime: completionStatus.privacyCompletedTime,
        privacyCompletedDate: completionStatus.privacyCompletedDate
    };
    syncToFirestore('privacy', privacyData, currentSession.userId).catch(err => {
        console.error('[Firestore Sync] Failed to sync privacy completion:', err);
    });
    
    // Update session
    currentSession.privacyCompleted = true;
    
    // Store privacy completion time in session
    // IMPORTANT: Get fresh sessions array to ensure we have the latest questionnaireData
    const sessions = getSessionsFromStorage();
    const sessionId = sessionStorage.getItem('current_session_id');
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    
    if (sessionIndex >= 0) {
        sessions[sessionIndex].privacyCompletedTime = completionStatus.privacyCompletedTime;
        sessions[sessionIndex].privacyCompletedDate = completionStatus.privacyCompletedDate;
        sessions[sessionIndex].privacyCompleted = true;
        
        // Ensure questionnaireData is preserved if it exists
        if (!sessions[sessionIndex].questionnaireData) {
            // Try to get from localStorage as fallback
            const questionnaireData = localStorage.getItem('questionnaireData');
            if (questionnaireData) {
                try {
                    sessions[sessionIndex].questionnaireData = JSON.parse(questionnaireData);
                    console.log('[markPrivacyQuestionnaireCompleted] Restored questionnaireData from localStorage to session');
                } catch (e) {
                    console.error('[markPrivacyQuestionnaireCompleted] Error parsing questionnaireData:', e);
                }
            }
        }
        
        saveSessionsToStorage(sessions);
        console.log('[markPrivacyQuestionnaireCompleted] Updated session with privacy completion and questionnaireData:', 
                    sessions[sessionIndex].questionnaireData ? 'present' : 'missing');
    }
    
    // Both forms are now completed - finalize the session log
    // The questionnaireData should already be in the session from submitQuestionnaire
    finalizeSessionLog();
    
    // Create notification
    createNotification('Privacy Form Completed', currentSession.userId);
    
    // Disable privacy form
    disablePrivacyForm();
    
    updateRecentActivityStatus();
    
    // CRITICAL: Update account info to reflect "Completed" status
    // This ensures session status shows "Completed" immediately after form submission
    setTimeout(() => {
        updateAccountInfo();
        updateAccountTimestamp();
        console.log('[markPrivacyQuestionnaireCompleted] ✅ Updated account info with Completed status');
    }, 200);
    
    // Update charts with new data in real-time
    if (window.renderAllCharts) {
        setTimeout(() => {
            console.log('Updating all charts with new questionnaire data...');
            window.renderAllCharts();
            updateHeatmapTable(); // Also update heatmap (Chart 4)
            console.log('All charts updated successfully');
        }, 100);
    }
    
    // Show success modal
    showPrivacySuccessModal();
}

// Finalize session log when both forms are completed
// PREVENTS DUPLICATES: Uses persistent userId as Firestore document ID
function finalizeSessionLog() {
    // Safeguard 1: Prevent multiple calls in the same session
    if (sessionFinalized) {
        console.log('[finalizeSessionLog] ⚠️ Already finalized for this session, skipping duplicate call');
        return;
    }
    
    // Safeguard 2: Get persistent userId from localStorage (never generate new one)
    const persistentUserId = generateUserId(); // This gets from localStorage or creates once
    if (!persistentUserId) {
        console.error('[finalizeSessionLog] ❌ No userId available, cannot finalize session');
        return;
    }
    
    // Safeguard 3: Check if user has already been logged (in localStorage or Firestore)
    if (hasUserBeenLogged(persistentUserId)) {
        console.log('[finalizeSessionLog] ⚠️ User already logged:', persistentUserId, '- skipping duplicate entry');
        sessionFinalized = true; // Mark as finalized to prevent future calls
        return;
    }
    
    // Mark as finalized immediately to prevent duplicate calls
    sessionFinalized = true;
    
    console.log('[finalizeSessionLog] 🔄 Finalizing session for userId:', persistentUserId);
    
    const sessions = getSessionsFromStorage();
    const sessionId = sessionStorage.getItem('current_session_id');
    
    // Find existing session or create new one
    let sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    
    const now = new Date();
    const timeEndedStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    // Calculate participant number (count unique users who completed both forms)
    const completedUsers = sessions.filter(s => s.consentCompleted && s.privacyCompleted);
    const uniqueCompletedUserIds = [...new Set(completedUsers.map(s => s.userId))];
    const participantNumber = uniqueCompletedUserIds.length + 1;
    
    // CRITICAL: Get session start time - must be BEFORE session end time
    const accountCreatedDate = getAccountCreatedDate();
    
    // Priority 1: Use currentSession.startTime (actual session start)
    // Priority 2: Use privacyState.sessionStartTime (when privacy state was initialized)
    // Priority 3: Use accountCreatedDate (when user first visited)
    let sessionStartTime;
    if (currentSession.startTime && currentSession.startTime instanceof Date) {
        sessionStartTime = currentSession.startTime;
    } else if (privacyState.sessionStartTime && privacyState.sessionStartTime instanceof Date) {
        sessionStartTime = privacyState.sessionStartTime;
    } else {
        sessionStartTime = accountCreatedDate;
    }
    
    // CRITICAL: Ensure session start time is ALWAYS before session end time
    // If start time is after or equal to end time, adjust it
    if (sessionStartTime >= now) {
        console.warn('[finalizeSessionLog] ⚠️ Session start time is after/equal to end time, adjusting...');
        // Set start time to account created date, or 1 minute before end time (whichever is earlier)
        const oneMinuteBeforeEnd = new Date(now.getTime() - 60000);
        sessionStartTime = accountCreatedDate < oneMinuteBeforeEnd ? accountCreatedDate : oneMinuteBeforeEnd;
    }
    
    // Ensure minimum duration of 1 second for logical display
    if ((now - sessionStartTime) < 1000) {
        sessionStartTime = new Date(now.getTime() - 1000);
        console.log('[finalizeSessionLog] Adjusted session start to ensure minimum 1 second duration');
    }
    
    console.log('[finalizeSessionLog] Session times:', {
        start: sessionStartTime.toLocaleTimeString(),
        end: now.toLocaleTimeString(),
        duration: Math.floor((now - sessionStartTime) / 1000) + ' seconds'
    });
    
    // Calculate average epsilon from all values
    const averageEpsilon = calculateAverageEpsilon();
    
    // Get privacy level from final epsilon
    const privacyLevel = getPrivacyLevelFromFinalEpsilon(currentSession.finalEpsilon);
    
    const sessionData = {
        sessionId: sessionId || Date.now().toString(),
        participant: participantNumber,
        date: accountCreatedDate.toLocaleDateString('en-GB'),
        timeStarted: sessionStartTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }),
        timeEnded: timeEndedStr,
        userId: persistentUserId, // Use persistent userId from localStorage
        duration: 0, // Will be calculated below
        durationObj: null, // Will be set below
        epsilonChanges: currentSession.epsilonChanges,
        firstEpsilon: currentSession.firstEpsilon || 'N/A',
        finalEpsilon: finalEpsilon !== 'N/A' ? finalEpsilon : 'N/A',
        averageEpsilon: averageEpsilon,
        privacyLevel: privacyLevel,
        consentCompleted: true,
        privacyCompleted: true,
        accountCreatedDate: accountCreatedDate.toISOString(),
        accountCreatedDateDisplay: accountCreatedDate.toLocaleDateString('en-GB'),
        sessionStatus: 'Completed',
        epsilonHistory: [...currentSession.epsilonHistory], // Store all epsilon values
        lastUpdatedTimestamp: finalLastUpdated, // Store final last updated timestamp
        settingsChanged: finalSettingsChanged // Store final settings changed count
    };
    
    // Store consent and privacy completion times if they exist in the session
    if (sessionIndex >= 0) {
        if (sessions[sessionIndex].consentCompletedTime) {
            sessionData.consentCompletedTime = sessions[sessionIndex].consentCompletedTime;
            sessionData.consentCompletedDate = sessions[sessionIndex].consentCompletedDate;
        }
        if (sessions[sessionIndex].privacyCompletedTime) {
            sessionData.privacyCompletedTime = sessions[sessionIndex].privacyCompletedTime;
            sessionData.privacyCompletedDate = sessions[sessionIndex].privacyCompletedDate;
        }
    }
    
    // Calculate duration
    const durationObj = calculateDurationFromTimes(
        sessionData.date,
        sessionData.timeStarted,
        sessionData.timeEnded
    );
    sessionData.duration = durationObj.totalSeconds;
    sessionData.durationObj = durationObj;
    
    // FREEZE ALL VALUES PERMANENTLY - Never update again after this point
    // Store final epsilon (use 1 decimal place)
    const finalEpsilon = currentSession.finalEpsilon ? parseFloat(currentSession.finalEpsilon).toFixed(1) : 'N/A';
    const finalSettingsChanged = privacyState.settingsChanged;
    const finalLastUpdated = privacyState.lastUpdatedTimestamp || formatTimestamp(now);
    
    // Permanently freeze all values in localStorage
    localStorage.setItem('finalEpsilon', finalEpsilon);
    localStorage.setItem('finalSettingsChanged', finalSettingsChanged.toString());
    localStorage.setItem('finalLastUpdated', finalLastUpdated);
    localStorage.setItem('finalAverageEpsilon', averageEpsilon);
    localStorage.setItem('final_epsilon_changes', currentSession.epsilonChanges.toString());
    localStorage.setItem('final_average_epsilon', averageEpsilon);
    localStorage.setItem('final_epsilon_changes_timestamp', now.toISOString());
    localStorage.setItem('final_average_epsilon_timestamp', now.toISOString());
    
    // Freeze privacyState permanently
    privacyState.isFrozen = true;
    privacyState.epsilon = parseFloat(finalEpsilon);
    privacyState.settingsChanged = finalSettingsChanged;
    privacyState.lastUpdatedTimestamp = finalLastUpdated;
    privacyState.finalAverageEpsilon = parseFloat(averageEpsilon);
    privacyState.sessionEndTime = now;
    privacyState.sessionEnded = true;
    
    // Store session end time in localStorage (permanent record)
    localStorage.setItem('sessionEndTime', now.toISOString());
    localStorage.setItem('sessionEndTimeFormatted', timeEndedStr);
    
    // Store account created date permanently (if not already stored)
    if (!localStorage.getItem('account_created_date')) {
        localStorage.setItem('account_created_date', accountCreatedDate.toISOString());
        localStorage.setItem('account_created_date_display', accountCreatedDate.toLocaleDateString('en-GB'));
    }
    
    // Store session started time permanently
    localStorage.setItem('sessionStartedTime', sessionStartTime.toISOString());
    localStorage.setItem('sessionStartedTimeFormatted', sessionData.timeStarted);
    
    // Store session duration permanently
    localStorage.setItem('sessionDurationSeconds', sessionData.duration.toString());
    localStorage.setItem('sessionDurationObj', JSON.stringify(sessionData.durationObj));
    
    console.log('[finalizeSessionLog] ✅ All values frozen permanently:', {
        epsilon: finalEpsilon,
        settingsChanged: finalSettingsChanged,
        lastUpdated: finalLastUpdated,
        averageEpsilon: averageEpsilon,
        sessionEnded: timeEndedStr,
        sessionDuration: sessionData.duration,
        accountCreated: accountCreatedDate.toLocaleDateString('en-GB')
    });
    
    // Sync epsilon metrics to Firestore
    const metricsData = {
        epsilonChanges: currentSession.epsilonChanges.toString(),
        averageEpsilon: averageEpsilon,
        timestamp: now.toISOString()
    };
    syncToFirestore('session_metrics', metricsData, `${currentSession.userId}_epsilon`).catch(err => {
        console.error('[Firestore Sync] Failed to sync epsilon metrics:', err);
    });
    
    // Store questionnaire data in session if it exists
    // CRITICAL: This data is needed for Charts 2-6 to display properly
    // Get fresh sessions array to ensure we have the latest data
    const currentSessions = getSessionsFromStorage();
    const currentSessionId = sessionStorage.getItem('current_session_id');
    const currentSessionIndex = currentSessions.findIndex(s => s.sessionId === currentSessionId);
    
    if (currentSessionIndex >= 0 && currentSessions[currentSessionIndex].questionnaireData) {
        sessionData.questionnaireData = currentSessions[currentSessionIndex].questionnaireData;
        console.log('[finalizeSessionLog] ✓ Stored questionnaireData from session. Has data:', 
                    Object.keys(sessionData.questionnaireData).length, 'fields');
    } else {
        // Try to get from localStorage (for backward compatibility and reliability)
        const questionnaireData = localStorage.getItem('questionnaireData');
        if (questionnaireData) {
            try {
                const parsedData = JSON.parse(questionnaireData);
                sessionData.questionnaireData = parsedData;
                console.log('[finalizeSessionLog] ✓ Stored questionnaireData from localStorage. Has data:', 
                            Object.keys(parsedData).length, 'fields');
                
                // Also update the session array to ensure consistency
                if (currentSessionIndex >= 0) {
                    currentSessions[currentSessionIndex].questionnaireData = parsedData;
                    saveSessionsToStorage(currentSessions);
                }
            } catch (e) {
                console.error('[finalizeSessionLog] Error parsing questionnaire data:', e);
            }
        } else {
            console.warn('[finalizeSessionLog] ⚠️ No questionnaireData found in session or localStorage!');
            console.warn('[finalizeSessionLog] This will cause Charts 2-6 to show no data.');
        }
    }
    
    // Double-check: ensure no duplicate user IDs exist (using persistent userId)
    const existingUserIndex = sessions.findIndex(s => 
        s.userId === persistentUserId && 
        s.consentCompleted === true && 
        s.privacyCompleted === true
    );
    
    if (existingUserIndex >= 0) {
        // User already exists - update existing entry instead of creating duplicate
        console.log('[finalizeSessionLog] ⚠️ User already exists in localStorage, updating existing entry:', persistentUserId);
        sessions[existingUserIndex] = sessionData;
        saveSessionsToStorage(sessions);
        updateSessionTable();
        
        // Still sync to Firestore (will update existing document due to userId as doc ID)
        syncToFirestore('sessions', sessionData, persistentUserId).then(() => {
            console.log('[finalizeSessionLog] ✓ Updated existing session in Firestore');
        }).catch(err => {
            console.error('[finalizeSessionLog] ❌ Failed to update session:', err);
            sessionFinalized = false; // Allow retry
        });
        return;
    }
    
    if (sessionIndex >= 0) {
        // Update existing session
        sessions[sessionIndex] = sessionData;
    } else {
        // Add new session (only if user hasn't been logged)
        sessions.push(sessionData);
    }
    
    saveSessionsToStorage(sessions);
    updateSessionTable();
    
    // CRITICAL: Immediately sync complete session (including questionnaireData) to Firestore
    // Uses userId as document ID to ensure 1 user = 1 document (no duplicates)
    // setDoc with merge: true will update existing document or create new one
    console.log('[finalizeSessionLog] 🔄 Syncing complete session to Firestore using userId as document ID...');
    console.log('[finalizeSessionLog] Document ID (userId):', persistentUserId);
    console.log('[finalizeSessionLog] Session includes questionnaireData:', !!sessionData.questionnaireData);
    
    // Use persistent userId as the document ID - this ensures 1 user = 1 document
    syncToFirestore('sessions', sessionData, persistentUserId).then(() => {
        console.log('[finalizeSessionLog] ✓ Successfully synced/updated session in Firestore');
        console.log('[finalizeSessionLog] ✓ Document ID:', persistentUserId, '(1 user = 1 document, no duplicates)');
        console.log('[finalizeSessionLog] ✓ Session data (including questionnaire) is now available for ALL users');
        
        // Mark as synced to avoid duplicate syncs
        markAsSynced('sessions', persistentUserId);
        
        // Trigger chart refresh for all users viewing the home page
        if (window.renderAllCharts) {
            setTimeout(() => {
                console.log('[finalizeSessionLog] Refreshing charts with new global data...');
                window.renderAllCharts();
            }, 500);
        }
    }).catch(err => {
        console.error('[finalizeSessionLog] ❌ Failed to sync session to Firestore:', err);
        console.error('[finalizeSessionLog] Charts may not show this participant\'s data until sync succeeds');
        // Reset flag on error so it can retry
        sessionFinalized = false;
    });
}

// Alias for markPrivacyQuestionnaireCompleted (used in submitQuestionnaire)
function markPrivacyCompleted() {
    markPrivacyQuestionnaireCompleted();
}

// Update Recent Activity status based on completion
function updateRecentActivityStatus() {
    // Update consent form status
    const consentDot = document.getElementById('consent-dot');
    const consentTitle = document.getElementById('consent-title');
    const consentTime = document.getElementById('consent-time');
    const consentViewBtn = document.getElementById('consent-view-btn');
    
    if (consentDot && consentTitle && consentTime) {
        if (completionStatus.consentCompleted) {
            consentDot.classList.remove('pending');
            consentDot.classList.add('active');
            consentTitle.textContent = 'Consent Form Completed';
            consentTime.textContent = (completionStatus.consentCompletedDate && completionStatus.consentCompletedTime) ? 
                `${completionStatus.consentCompletedDate}, ${completionStatus.consentCompletedTime}` :
                new Date().toLocaleString('en-US', { 
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
            // Show download dropdown when completed
            const consentDownloadDropdown = document.getElementById('consent-download-dropdown');
            if (consentDownloadDropdown) {
                consentDownloadDropdown.style.display = 'block';
            }
        } else {
            consentDot.classList.add('pending');
            consentDot.classList.remove('active');
            consentTitle.textContent = 'Consent Form Not Completed';
            consentTime.textContent = 'Pending';
            // Hide download dropdown when not completed
            const consentDownloadDropdown = document.getElementById('consent-download-dropdown');
            if (consentDownloadDropdown) {
                consentDownloadDropdown.style.display = 'none';
            }
        }
    }
    
    // Update privacy form status (questionnaire completion, NOT epsilon adjustment)
    const privacyDot = document.getElementById('privacy-dot');
    const privacyTitle = document.getElementById('privacy-title');
    const privacyTime = document.getElementById('privacy-time');
    const privacyViewBtn = document.getElementById('privacy-view-btn');

    if (privacyDot && privacyTitle && privacyTime) {
        if (completionStatus.privacyCompleted) {
            privacyDot.classList.remove('pending');
            privacyDot.classList.add('active');
            privacyTitle.textContent = 'Privacy Form Completed';
            privacyTime.textContent = (completionStatus.privacyCompletedDate && completionStatus.privacyCompletedTime) ? 
                `${completionStatus.privacyCompletedDate}, ${completionStatus.privacyCompletedTime}` :
                new Date().toLocaleString('en-US', { 
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
            // Show View button when completed
            if (privacyViewBtn) {
                privacyViewBtn.style.display = 'block';
            }
            // Show download dropdown when completed
            const privacyDownloadDropdown = document.getElementById('privacy-download-dropdown');
            if (privacyDownloadDropdown) {
                privacyDownloadDropdown.style.display = 'block';
            }
        } else {
            privacyDot.classList.remove('active');
            privacyDot.classList.add('pending');
            privacyTitle.textContent = 'Privacy Form Not Completed';
            privacyTime.textContent = 'Pending';
            // Hide download dropdown when not completed
            const privacyDownloadDropdown = document.getElementById('privacy-download-dropdown');
            if (privacyDownloadDropdown) {
                privacyDownloadDropdown.style.display = 'none';
            }
        }
    }
}

function updateAccountInfo() {
    // Update User ID throughout the page
    const accountUserId = document.getElementById('account-user-id');
    const sidebarUserId = document.getElementById('sidebar-user-id');
    const privacySessionId = document.getElementById('session-id');
    
    if (accountUserId) {
        accountUserId.textContent = privacyState.userId;
    }
    if (sidebarUserId) {
        sidebarUserId.textContent = privacyState.userId;
    }
    if (privacySessionId) {
        privacySessionId.textContent = privacyState.userId;
    }
    
    // Update epsilon value
    const accountEpsilon = document.getElementById('account-epsilon');
    if (accountEpsilon) {
        accountEpsilon.textContent = privacyState.epsilon.toFixed(2);
    }
    
    // Update privacy badge with correct ranges and colors
    const privacyBadge = document.getElementById('account-privacy-badge');
    if (privacyBadge) {
        const epsilon = privacyState.epsilon;
        if (epsilon >= 0.1 && epsilon <= 1.5) {
            // High Privacy (0.1-1.5) = cyan
            privacyBadge.textContent = 'High Privacy';
            privacyBadge.style.backgroundColor = '#00ffff'; // cyan
        } else if (epsilon > 1.5 && epsilon <= 3.0) {
            // Medium Privacy (1.6-3.0) = orange
            privacyBadge.textContent = 'Medium Privacy';
            privacyBadge.style.backgroundColor = '#ff8c00'; // orange
        } else if (epsilon > 3.0 && epsilon <= 5.0) {
            // Low Privacy (3.1-5.0) = red
            privacyBadge.textContent = 'Low Privacy';
            privacyBadge.style.backgroundColor = '#ff4444'; // red
        } else {
            // Fallback
            privacyBadge.textContent = 'Unknown';
            privacyBadge.style.backgroundColor = '#888888';
        }
    }
    
    // Update epsilon changes count
    const epsilonChanges = document.getElementById('epsilon-changes');
    const decisionsCount = document.getElementById('decisions-count');
    if (epsilonChanges) {
        epsilonChanges.textContent = privacyState.settingsChanged;
    }
    if (decisionsCount) {
        decisionsCount.textContent = privacyState.settingsChanged;
    }
    
    // Calculate and display average epsilon
    const averageEpsilon = document.getElementById('average-epsilon');
    if (averageEpsilon) {
        if (privacyState.epsilonValues.length > 0) {
            const average = privacyState.totalEpsilonSum / privacyState.epsilonValues.length;
            averageEpsilon.textContent = average.toFixed(2);
        } else {
            averageEpsilon.textContent = '0.00';
        }
    }
}

/* ============================================
   SURVEY MODAL FUNCTIONALITY
   ============================================ */

function openSurveyModal() {
    const modal = document.getElementById('survey-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeSurveyModal() {
    const modal = document.getElementById('survey-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function initializeSurveyModal() {
    const closeBtn = document.getElementById('survey-close-btn');
    const modal = document.getElementById('survey-modal');
    const surveyForm = document.getElementById('survey-form');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeSurveyModal();
        });
    }
    
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeSurveyModal();
            }
        });
    }
    
    if (surveyForm) {
        surveyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for completing the survey!\n\nYour feedback helps us improve privacy controls for everyone.');
            surveyForm.reset();
            closeSurveyModal();
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('survey-modal');
            if (modal && modal.classList.contains('active')) {
                closeSurveyModal();
            }
        }
    });
}

/* ============================================
   PRIVACY PAGE FUNCTIONALITY
   ============================================ */

// CRITICAL: Synchronize slider and display - ensures they always match
// This function guarantees the slider handle position and displayed epsilon value are perfectly synchronized
// Prevents desynchronization issues that could occur during initialization or value updates
function synchronizeSliderAndDisplay(epsilon) {
    const slider = document.getElementById('privacy-slider');
    const epsilonValue = document.getElementById('epsilon-value');
    
    // Ensure epsilon is a valid number and within range
    epsilon = Math.max(0.1, Math.min(5.0, parseFloat(epsilon) || 0.1));
    const epsilonFixed = parseFloat(epsilon.toFixed(1));
    
    // CRITICAL: Set slider value FIRST (this moves the handle to the correct position)
    // The slider.value property directly controls the handle position
    if (slider) {
        // Set the value - this immediately updates the slider handle position
        slider.value = epsilonFixed;
        
        // Force browser to update the visual position by reading the value back
        // This ensures the handle is positioned correctly
        const verifyValue = parseFloat(slider.value).toFixed(1);
        if (verifyValue !== epsilonFixed.toFixed(1)) {
            // If there's a mismatch, set it again (handles edge cases)
            slider.value = epsilonFixed;
        }
    }
    
    // Then update the display to match the slider value exactly
    if (epsilonValue) {
        epsilonValue.textContent = epsilonFixed.toFixed(1);
    }
    
    // Update privacyState to match
    privacyState.epsilon = epsilonFixed;
    
    return epsilonFixed;
}

function updatePrivacyDisplay(epsilon) {
    // Ensure epsilon is valid and within range
    epsilon = Math.max(0.1, Math.min(5.0, parseFloat(epsilon) || 0.1));
    const epsilonFixed = parseFloat(epsilon.toFixed(1));
    
    const epsilonValue = document.getElementById('epsilon-value');
    const recommendationTitle = document.getElementById('recommendation-title');
    const recommendationText = document.getElementById('recommendation-text');
    const privacyLevelDisplay = document.querySelector('.privacy-level-display');
    const slider = document.getElementById('privacy-slider');
    
    // CRITICAL: Always ensure slider and display match
    if (slider && epsilonValue) {
        // Set slider value to match epsilon
        slider.value = epsilonFixed;
        // Update display to match slider
        epsilonValue.textContent = epsilonFixed.toFixed(1);
    } else if (epsilonValue) {
        epsilonValue.textContent = epsilonFixed.toFixed(1);
    }
    
    if (privacyLevelDisplay) {
        const ratio = (epsilon - 0.1) / (5.0 - 0.1);
        const startR = 30, startG = 150, startB = 150;
        const endR = 10, endG = 40, endB = 40;
        
        const r = Math.round(startR + (endR - startR) * ratio);
        const g = Math.round(startG + (endG - startG) * ratio);
        const b = Math.round(startB + (endB - startB) * ratio);
        
        privacyLevelDisplay.style.background = `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, #0a0a0a 100%)`;
    }
    
    if (recommendationTitle && recommendationText) {
        if (epsilon <= 0.5) {
            recommendationTitle.textContent = 'Maximum Privacy';
            recommendationText.textContent = 'Highest privacy protection with reduced utility';
        } else if (epsilon <= 1.5) {
            recommendationTitle.textContent = 'Balanced Privacy';
            recommendationText.textContent = 'Good balance between privacy and utility';
        } else if (epsilon <= 3.0) {
            recommendationTitle.textContent = 'Moderate Privacy';
            recommendationText.textContent = 'Better performance with moderate privacy';
        } else {
            recommendationTitle.textContent = 'Performance Priority';
            recommendationText.textContent = 'Maximum performance with minimal privacy';
        }
    }
}

function updateTradeoffMetrics(epsilon) {
    // CAPTCHA Frequency: Higher privacy (lower epsilon) = more CAPTCHAs, lower privacy (higher epsilon) = fewer CAPTCHAs
    // Range: 0.1 (epsilon) = 90% CAPTCHA frequency, 5.0 (epsilon) = 10% CAPTCHA frequency
    const captchaFrequencyBar = document.getElementById('captcha-frequency-bar');
    const captchaFrequencyValue = document.getElementById('captcha-frequency-value');
    const captchaFrequency = Math.round(90 - ((epsilon - 0.1) / (5.0 - 0.1)) * 80); // 90% to 10%
    
    if (captchaFrequencyBar && captchaFrequencyValue) {
        captchaFrequencyBar.style.width = captchaFrequency + '%';
        captchaFrequencyValue.textContent = captchaFrequency + '%';
    }
    
    // System Latency (Speed): Higher privacy (lower epsilon) = higher latency, lower privacy (higher epsilon) = lower latency
    // Range: 0.1 (epsilon) = 150ms latency, 5.0 (epsilon) = 20ms latency
    const systemLatencyBar = document.getElementById('system-latency-bar');
    const systemLatencyValue = document.getElementById('system-latency-value');
    const systemLatency = Math.round(150 - ((epsilon - 0.1) / (5.0 - 0.1)) * 130); // 150ms to 20ms
    
    if (systemLatencyBar && systemLatencyValue) {
        const latencyPercent = ((systemLatency - 20) / (150 - 20)) * 100; // Convert to percentage for bar width
        systemLatencyBar.style.width = latencyPercent + '%';
        systemLatencyValue.textContent = systemLatency + 'ms';
    }
    
    // Ad Targeting: Higher privacy (lower epsilon) = less ad targeting, lower privacy (higher epsilon) = more ad targeting
    // Range: 0.1 (epsilon) = 10% ad targeting, 5.0 (epsilon) = 90% ad targeting
    const adTargetingBar = document.getElementById('ad-targeting-bar');
    const adTargetingValue = document.getElementById('ad-targeting-value');
    const adTargeting = Math.round(10 + ((epsilon - 0.1) / (5.0 - 0.1)) * 80); // 10% to 90%
    
    if (adTargetingBar && adTargetingValue) {
        adTargetingBar.style.width = adTargeting + '%';
        adTargetingValue.textContent = adTargeting + '%';
    }
}

function updateSessionInfo() {
    const sessionIdEl = document.getElementById('session-id');
    const settingsChangedEl = document.getElementById('settings-changed');
    const lastUpdatedEl = document.getElementById('last-updated');
    
    if (sessionIdEl) {
        sessionIdEl.textContent = privacyState.userId;
    }
    
    if (settingsChangedEl) {
        // CRITICAL: For completed sessions, load from frozen localStorage value
        if (privacyState.isFrozen) {
            // Use frozen value (already loaded in privacyState)
            settingsChangedEl.textContent = privacyState.settingsChanged + ' times';
        } else {
            // For active sessions, use current value
            settingsChangedEl.textContent = privacyState.settingsChanged + ' times';
        }
    }
    
    if (lastUpdatedEl) {
        // CRITICAL: If frozen, use stored timestamp (never update again)
        if (privacyState.isFrozen && privacyState.lastUpdatedTimestamp) {
            lastUpdatedEl.textContent = privacyState.lastUpdatedTimestamp;
        } else {
            // Update timestamp on every call (will be called on every slider move)
            const timestamp = formatTimestamp();
            privacyState.lastUpdatedTimestamp = timestamp;
            lastUpdatedEl.textContent = timestamp;
            
            // Save to localStorage for persistence across refreshes (before completion)
            if (!privacyState.isFrozen) {
                localStorage.setItem('lastUpdatedTimestamp', timestamp);
            }
        }
    }
    
    // Update account info including privacy score in real-time
    updateAccountInfo();
}

/* ============================================
   CALENDAR FUNCTIONALITY
   
   AUTOMATIC TIMEZONE DETECTION:
   This calendar automatically detects and displays dates
   based on the user's local timezone. Just like the clock,
   it uses JavaScript's Date object which automatically
   adapts to the user's device settings.
   
   Examples of automatic adaptation:
   - User in China (UTC+8): Calendar shows Chinese date
   - User in USA (UTC-5 to UTC-8): Shows US date
   - User in UK (UTC+0/+1): Shows UK date
   - User in Australia (UTC+8 to UTC+11): Shows Australian date
   - User in Japan (UTC+9): Shows Japanese date
   
   The calendar will correctly show:
   ✓ Today's date for the user's location
   ✓ Current month for the user's location
   ✓ Current year for the user's location
   ✓ Correct day of the week for the user's location
   ============================================ */

// Get current date in user's local timezone (will be updated in real-time)
function getCurrentLocalDate() {
    return new Date(); // Automatically uses user's local timezone
}

let currentMonth = getCurrentLocalDate().getMonth(); // Gets user's local current month (0-11)
let currentYear = getCurrentLocalDate().getFullYear(); // Gets user's local current year
let selectedDate = getCurrentLocalDate().getDate(); // Gets user's local current date
let selectedMonth = getCurrentLocalDate().getMonth(); // Track selected month
let selectedYear = getCurrentLocalDate().getFullYear(); // Track selected year
let userSelectedMonth = false; // Track if user manually selected a month (to prevent auto-reset)

// Function to get today's date (updated in real-time)
function getToday() {
    return getCurrentLocalDate();
}

const MIN_YEAR = 2025;
const MAX_YEAR = 2035;
let pickerYear = currentYear; // Track picker year separately

function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const currentDateEl = document.getElementById('current-date');
    const dateSelectorText = document.getElementById('date-selector-text');
    
    if (!calendarDays || !currentDateEl) return;
    
    // Get current date in real-time (user's local timezone)
    const now = getCurrentLocalDate();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    currentDateEl.textContent = `${monthNames[currentMonth]}, ${currentYear}`;
    
    // Always show today's date at the top (updated in real-time)
    if (dateSelectorText) {
        const today = getToday();
        const dayName = dayNames[today.getDay()];
        const monthName = monthNames[today.getMonth()];
        const day = today.getDate();
        const year = today.getFullYear();
        
        // Get week number
        const weekNumber = getWeekNumber(today);
        
        // Format: "Thursday, October 10, 2025 (Week 42)"
        dateSelectorText.textContent = `${dayName}, ${monthName} ${day}, ${year} (Week ${weekNumber})`;
    }
    
    calendarDays.innerHTML = '';
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    // Previous month's days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.className = 'calendar-day inactive';
        day.textContent = daysInPrevMonth - i;

        // Add click event for previous month days
        day.addEventListener('click', function() {
            // Calculate the actual month and year for this day
            let targetMonth = currentMonth - 1;
            let targetYear = currentYear;
            if (targetMonth < 0) {
                targetMonth = 11;
                targetYear = currentYear - 1;
            }
            
            // Navigate to that month
            currentMonth = targetMonth;
            currentYear = targetYear;
            userSelectedMonth = true;
            
            // Update selected date tracking
            selectedDate = parseInt(this.textContent);
            selectedMonth = targetMonth;
            selectedYear = targetYear;
            
            // Re-render calendar to show the selected month
            renderCalendar();
            updatePickerDisplay();
        });
        
        calendarDays.appendChild(day);
    }
    
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        day.textContent = i;
        
        // Check if this is today (using real-time date)
        const today = getToday();
        if (i === today.getDate() && 
            currentMonth === today.getMonth() && 
            currentYear === today.getFullYear()) {
            day.classList.add('today');
        }
        
        // Check if this is the selected date
        if (i === selectedDate && 
            currentMonth === selectedMonth && 
            currentYear === selectedYear &&
            !day.classList.contains('today')) {
            day.classList.add('selected');
        }
        
        // Add click event
        day.addEventListener('click', function() {
            if (!this.classList.contains('inactive')) {
                // Remove selected from all days
                document.querySelectorAll('.calendar-day.selected').forEach(d => {
                    d.classList.remove('selected');
                });
                
                // Update selected date tracking
                selectedDate = parseInt(this.textContent);
                selectedMonth = currentMonth;
                selectedYear = currentYear;
                
                // Add selected to clicked day (unless it's today)
                if (!this.classList.contains('today')) {
                    this.classList.add('selected');
                }
            }
        });
        
        calendarDays.appendChild(day);
    }
    
    // Next month's days (to fill the grid)
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let i = 1; i <= remainingCells; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day inactive';
        day.textContent = i;
        
        // Add click event for next month days
        day.addEventListener('click', function() {
            // Calculate the actual month and year for this day
            let targetMonth = currentMonth + 1;
            let targetYear = currentYear;
            if (targetMonth > 11) {
                targetMonth = 0;
                targetYear = currentYear + 1;
            }
            
            // Navigate to that month
            currentMonth = targetMonth;
            currentYear = targetYear;
            userSelectedMonth = true;
            
            // Update selected date tracking
            selectedDate = parseInt(this.textContent);
            selectedMonth = targetMonth;
            selectedYear = targetYear;
            
            // Re-render calendar to show the selected month
            renderCalendar();
            updatePickerDisplay();
        });
        
        calendarDays.appendChild(day);
    }
}

function canGoToPrevMonth() {
    if (currentYear === MIN_YEAR && currentMonth === 0) {
        return false;
    }
    return true;
}

function canGoToNextMonth() {
    if (currentYear === MAX_YEAR && currentMonth === 11) {
        return false;
    }
    return true;
}

function initializeCalendar() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    const currentDateEl = document.getElementById('current-date');
    
    // Month/Year picker elements
    const picker = document.getElementById('month-year-picker');
    const prevYearBtn = document.getElementById('prev-year');
    const nextYearBtn = document.getElementById('next-year');
    const pickerYearEl = document.getElementById('picker-year');
    
    // Click on month/year to open picker
    if (currentDateEl) {
        currentDateEl.addEventListener('click', function() {
            pickerYear = currentYear; // Set picker to current calendar year
            generateMonthsGrid(); // Regenerate grid to show current selection
            openMonthYearPicker();
        });
    }
    
    // Previous year button
    if (prevYearBtn) {
        prevYearBtn.addEventListener('click', function() {
            if (pickerYear > MIN_YEAR) {
                pickerYear--;
                updatePickerDisplay();
            }
        });
    }
    
    // Next year button
    if (nextYearBtn) {
        nextYearBtn.addEventListener('click', function() {
            if (pickerYear < MAX_YEAR) {
                pickerYear++;
                updatePickerDisplay();
            }
        });
    }
    
    // Close picker when clicking outside
    if (picker) {
        document.addEventListener('click', function(e) {
            if (picker.classList.contains('active') && 
                !picker.contains(e.target) && 
                !currentDateEl.contains(e.target)) {
                closeMonthYearPicker();
            }
        });
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (canGoToPrevMonth()) {
                currentMonth--;
                if (currentMonth < 0) {
                    currentMonth = 11;
                    currentYear--;
                }
                userSelectedMonth = true; // Mark that user manually navigated
                renderCalendar();
                updateNavigationButtons();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            if (canGoToNextMonth()) {
                currentMonth++;
                if (currentMonth > 11) {
                    currentMonth = 0;
                    currentYear++;
                }
                userSelectedMonth = true; // Mark that user manually navigated
                renderCalendar();
                updateNavigationButtons();
            }
        });
    }
    
    function updateNavigationButtons() {
        if (prevBtn) {
            prevBtn.style.opacity = canGoToPrevMonth() ? '1' : '0.3';
            prevBtn.style.cursor = canGoToPrevMonth() ? 'pointer' : 'not-allowed';
        }
        if (nextBtn) {
            nextBtn.style.opacity = canGoToNextMonth() ? '1' : '0.3';
            nextBtn.style.cursor = canGoToNextMonth() ? 'pointer' : 'not-allowed';
        }
    }
    
    renderCalendar();
    updateNavigationButtons();
    generateMonthsGrid();
    
    // Set up real-time calendar updates
    if (typeof window.calendarUpdateInterval !== 'undefined') {
        clearInterval(window.calendarUpdateInterval);
    }
    
    window.calendarUpdateInterval = setInterval(() => {
        // Only update if calendar page is active
        const calendarPage = document.getElementById('calendar-page');
        if (calendarPage && calendarPage.classList.contains('active')) {
            const now = getCurrentLocalDate();
            const newMonth = now.getMonth();
            const newYear = now.getFullYear();
            
            // Update current month/year if they changed (e.g., midnight rollover)
            // But only if user hasn't manually selected a different month
            if (!userSelectedMonth && (newMonth !== currentMonth || newYear !== currentYear)) {
                currentMonth = newMonth;
                currentYear = newYear;
                renderCalendar();
                updateNavigationButtons();
            } else {
                // Just update the date selector text (day, week, etc.)
                const dateSelectorText = document.getElementById('date-selector-text');
                if (dateSelectorText) {
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                       'July', 'August', 'September', 'October', 'November', 'December'];
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const today = getToday();
                    const dayName = dayNames[today.getDay()];
                    const monthName = monthNames[today.getMonth()];
                    const day = today.getDate();
                    const year = today.getFullYear();
                    const weekNumber = getWeekNumber(today);
                    dateSelectorText.textContent = `${dayName}, ${monthName} ${day}, ${year} (Week ${weekNumber})`;
                }
                
                // Re-render calendar to update "today" highlighting
                renderCalendar();
            }
        }
    }, 1000); // Update every second
}

// Function to calculate week number (ISO 8601 standard)
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/* ============================================
   NOTIFICATIONS PAGE FUNCTIONALITY
   ============================================ */

// Initialize notifications on page load
function initializeNotifications() {
    // Initialize badge count
    const notifications = getNotificationsFromStorage();
    updateNotificationBadge(getUnreadCount(notifications));
    
    // Render notifications if on notifications page
    if (document.getElementById('notifications-list')) {
        renderNotifications();
    }
}

/* Real-time notification time updater */
function updateNotificationTimes() {
    const now = Date.now();
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    
    const notifications = notificationsList.querySelectorAll('.notification-item');
    const allNotifications = getNotificationsFromStorage();
    
    notifications.forEach(notification => {
        const timeElement = notification.querySelector('.notification-time');
        if (!timeElement) return;
        
        // Get the stored timestamp from data-id
        const notificationId = notification.getAttribute('data-id');
        if (!notificationId) return;
        
        // Find notification in storage
        const notificationData = allNotifications.find(n => n.id === notificationId);
        if (!notificationData) return;
        
        const timestamp = new Date(notificationData.timestamp).getTime();
        
        // Calculate time difference
        const diffMs = now - timestamp;
        const totalSeconds = Math.floor(diffMs / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        
        // Calculate remaining seconds, minutes after extracting hours/minutes
        const hours = totalHours;
        const minutes = totalMinutes % 60;
        const seconds = totalSeconds % 60;
        
        // Build time ago string with detailed format (always show seconds for real-time)
        let timeAgo;
        if (hours > 0) {
            timeAgo = `${hours} hour${hours !== 1 ? 's' : ''}`;
            if (minutes > 0) {
                timeAgo += ` ${minutes} min${minutes !== 1 ? 's' : ''}`;
            }
            if (seconds > 0) {
                timeAgo += ` ${seconds} second${seconds !== 1 ? 's' : ''}`;
            }
            timeAgo += ' ago';
        } else if (minutes > 0) {
            timeAgo = `${minutes} min${minutes !== 1 ? 's' : ''}`;
            if (seconds > 0) {
                timeAgo += ` ${seconds} second${seconds !== 1 ? 's' : ''}`;
            }
            timeAgo += ' ago';
        } else {
            // Always show seconds for real-time counting (1 second, 2 seconds, etc.)
            timeAgo = `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
        }
        
        // Format timestamp for display
        const timestampDate = new Date(timestamp);
        const hoursDisplay = timestampDate.getHours();
        const minutesDisplay = timestampDate.getMinutes().toString().padStart(2, '0');
        const secondsDisplay = timestampDate.getSeconds().toString().padStart(2, '0');
        const ampm = hoursDisplay >= 12 ? 'PM' : 'AM';
        const displayHours = (hoursDisplay % 12 || 12).toString().padStart(2, '0');
        const formattedTime = `${displayHours}:${minutesDisplay}:${secondsDisplay} ${ampm}`;
        const formattedDate = formatNotificationDate(timestampDate);
        
        // Update the time display
        timeElement.textContent = `${timeAgo} at ${formattedTime}, ${formattedDate}`;
    });
}

function attachNotificationReadListeners() {
    const readButtons = document.querySelectorAll('.notification-read-btn');
    
    readButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const notificationItem = this.closest('.notification-item');
            const notificationId = notificationItem.getAttribute('data-id');
            const isRead = this.getAttribute('data-read') === 'true';
            
            // Update in localStorage
            const notifications = getNotificationsFromStorage();
            const notificationIndex = notifications.findIndex(n => n.id === notificationId);
            
            if (notificationIndex >= 0) {
                notifications[notificationIndex].read = !isRead;
                saveNotificationsToStorage(notifications);
            }
            
            if (isRead) {
                // Mark as unread
                this.setAttribute('data-read', 'false');
                this.innerHTML = '<i class="fas fa-envelope"></i>';
                notificationItem.classList.remove('read');
                notificationItem.classList.add('unread');
            } else {
                // Mark as read
                this.setAttribute('data-read', 'true');
                this.innerHTML = '<i class="fas fa-envelope-open"></i>';
                notificationItem.classList.remove('unread');
                notificationItem.classList.add('read');
            }
            
            updateNotificationCounters();
        });
    });
    
    // Attach delete button listeners
    attachNotificationDeleteListeners();
}

function attachNotificationDeleteListeners() {
    const deleteButtons = document.querySelectorAll('.notification-delete-btn');
    
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const notificationItem = this.closest('.notification-item');
            const notificationId = notificationItem.getAttribute('data-id');
            const icon = this.querySelector('i');
            
            // Add closing animation class
            icon.classList.add('bin-closing');
            
            // Wait for animation, then remove notification
            setTimeout(() => {
                // Remove from localStorage
                const notifications = getNotificationsFromStorage();
                const filtered = notifications.filter(n => n.id !== notificationId);
                saveNotificationsToStorage(filtered);
                
                // Remove the notification with fade out
                notificationItem.style.opacity = '0';
                notificationItem.style.transform = 'translateX(50px)';
                
                setTimeout(() => {
                    notificationItem.remove();
                    updateNotificationCounters();
                }, 300);
            }, 300);
        });
    });
}

function initializeNotificationsPage() {
    const markReadBtn = document.querySelector('.mark-read-btn');
    const markUnreadBtn = document.querySelector('.mark-unread-btn');
    const clearBtn = document.querySelector('.clear-btn');
    const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');

    if (markReadBtn) {
        markReadBtn.addEventListener('click', function() {
            const readButtons = document.querySelectorAll('.notification-read-btn');
            const notificationItems = document.querySelectorAll('.notification-item');
            
            readButtons.forEach(button => {
                button.setAttribute('data-read', 'true');
                button.innerHTML = '<i class="fas fa-envelope-open"></i>';
            });
            
            notificationItems.forEach(item => {
                item.classList.remove('unread');
                item.classList.add('read');
            });
            
            unreadCount = 0;
            updateNotificationCounters();
            alert('All notifications marked as read!');
        });
    }

    if (markUnreadBtn) {
        markUnreadBtn.addEventListener('click', function() {
            const readButtons = document.querySelectorAll('.notification-read-btn');
            const notificationItems = document.querySelectorAll('.notification-item');
            
            readButtons.forEach(button => {
                button.setAttribute('data-read', 'false');
                button.innerHTML = '<i class="fas fa-envelope"></i>';
            });
            
            notificationItems.forEach(item => {
                item.classList.remove('read');
                item.classList.add('unread');
            });
            
            unreadCount = notificationCount;
            updateNotificationCounters();
            alert('All notifications marked as unread!');
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear all notifications?')) {
                // Clear notifications from localStorage
                localStorage.removeItem('notifications');
                
                const notificationsList = document.getElementById('notifications-list');
                if (notificationsList) {
                    notificationsList.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No notifications</p>';
                    notificationCount = 0;
                    unreadCount = 0;
                    
                    const allCount = document.getElementById('all-count');
                    if (allCount) allCount.textContent = '0';
                    
                    updateNotificationBadge(0);
                }
            }
        });
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
}


document.addEventListener("DOMContentLoaded", () => {
    console.log('Initializing Zynex Dashboard...');
    
    // Load completion status from localStorage (data persists permanently)
    if (localStorage.getItem('consentCompleted') === 'true') {
        completionStatus.consentCompleted = true;
        completionStatus.consentCompletedTime = localStorage.getItem('consentCompletedTime');
        completionStatus.consentCompletedDate = localStorage.getItem('consentCompletedDate');
        currentSession.consentCompleted = true;
    }
    if (localStorage.getItem('privacyCompleted') === 'true') {
        completionStatus.privacyCompleted = true;
        completionStatus.privacyCompletedTime = localStorage.getItem('privacyCompletedTime');
        completionStatus.privacyCompletedDate = localStorage.getItem('privacyCompletedDate');
        currentSession.privacyCompleted = true;
    }
    
    // If user has completed both forms, load their session data
    if (completionStatus.consentCompleted && completionStatus.privacyCompleted) {
        loadSessionFromStorage();
        
        // Load permanently stored epsilon changes and average epsilon from localStorage
        // These values are fixed and should not recalculate
        const storedEpsilonChanges = localStorage.getItem('final_epsilon_changes');
        const storedAverageEpsilon = localStorage.getItem('final_average_epsilon');
        
        if (storedEpsilonChanges !== null) {
            // Use stored value - don't recalculate
            privacyState.settingsChanged = parseInt(storedEpsilonChanges);
            currentSession.epsilonChanges = parseInt(storedEpsilonChanges);
        }
        
        if (storedAverageEpsilon !== null) {
            // Store the average epsilon value (don't recalculate from epsilonHistory)
            // This ensures the original calculated average is preserved
            privacyState.finalAverageEpsilon = parseFloat(storedAverageEpsilon);
        }
        
        // Disable forms for completed users
        disableConsentForm();
        disablePrivacyForm();
        // Disable privacy slider
        const slider = document.getElementById('privacy-slider');
        if (slider) {
            slider.disabled = true;
            slider.style.opacity = '0.5';
            slider.style.cursor = 'not-allowed';
        }
        
        // CRITICAL: Add beforeunload listener to capture session end time when browser closes
        // This ensures the session end time is stored even if user closes browser after completion
        window.addEventListener('beforeunload', function() {
            if (completionStatus.consentCompleted && completionStatus.privacyCompleted && !privacyState.sessionEnded) {
                const now = new Date();
                const timeEndedStr = now.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
                
                // Store session end time in localStorage (permanent record)
                localStorage.setItem('sessionEndTime', now.toISOString());
                localStorage.setItem('sessionEndTimeFormatted', timeEndedStr);
                
                // Update session data if available
                const sessions = getSessionsFromStorage();
                const userSessionIndex = sessions.findIndex(s => 
                    s.userId === privacyState.userId && 
                    s.consentCompleted === true && 
                    s.privacyCompleted === true
                );
                
                if (userSessionIndex >= 0) {
                    sessions[userSessionIndex].timeEnded = timeEndedStr;
                    saveSessionsToStorage(sessions);
                    
                    // Also sync to Firestore if available
                    if (window.db) {
                        const sessionData = sessions[userSessionIndex];
                        syncToFirestore('sessions', sessionData, privacyState.userId).catch(err => {
                            console.error('[beforeunload] Failed to sync session end time:', err);
                        });
                    }
                }
                
                console.log('[beforeunload] ✅ Stored session end time:', timeEndedStr);
            }
        });
    } else {
        // Check if user exists in storage with completed forms (might not be in localStorage flags yet)
        const sessions = getSessionsFromStorage();
        const existingSession = sessions.find(s => 
            s.userId === privacyState.userId && 
            s.consentCompleted === true && 
            s.privacyCompleted === true
        );
        
        if (existingSession) {
            // User has completed before - load their data
            console.log('[Init] Found existing completed session, loading data...');
            currentSession.epsilonChanges = existingSession.epsilonChanges || 0;
            currentSession.firstEpsilon = existingSession.firstEpsilon;
            currentSession.finalEpsilon = existingSession.finalEpsilon;
            currentSession.startTime = existingSession.sessionStartTime ? new Date(existingSession.sessionStartTime) : new Date();
            
            privacyState.epsilon = existingSession.finalEpsilon ? parseFloat(existingSession.finalEpsilon) : 0.1;
            privacyState.settingsChanged = existingSession.epsilonChanges || 0;
            privacyState.isFrozen = true;
        } else {
            // Truly new/incomplete user - reset to defaults
            currentSession.startTime = new Date();
            currentSession.endTime = null;
            currentSession.epsilonChanges = 0;
            currentSession.firstEpsilon = null;
            currentSession.finalEpsilon = null;
            currentSession.epsilonHistory = [];
            
            privacyState.epsilon = 0.1;
            privacyState.settingsChanged = 0;
            privacyState.epsilonValues = [];
            privacyState.totalEpsilonSum = 0;
            privacyState.sessionStartTime = new Date();
            privacyState.sessionEndTime = null;
            privacyState.sessionEnded = false;
        }
    }
    
    // Hide success modals and show form content
    setTimeout(() => {
        // Hide consent success message
        const consentSuccessMessage = document.getElementById('consent-success-message');
        if (consentSuccessMessage) {
            consentSuccessMessage.style.display = 'none';
        }
        const consentFormContent = document.getElementById('consent-form-content');
        if (consentFormContent) {
            consentFormContent.style.display = 'block';
        }
        
        // Hide privacy success message
        const privacySuccessMessage = document.getElementById('privacy-success-message');
        if (privacySuccessMessage) {
            privacySuccessMessage.style.display = 'none';
        }
        const privacyQuestionnaireContent = document.getElementById('privacy-questionnaire-content');
        if (privacyQuestionnaireContent) {
            privacyQuestionnaireContent.style.display = 'block';
        }
        
        // Check if there's saved progress - only clear if no saved progress exists
        const hasSavedConsentProgress = localStorage.getItem('consentProgress');
        const hasSavedPrivacyProgress = localStorage.getItem('questionnaireProgress');
        
        // Re-enable consent form elements (but don't clear if there's saved progress)
        if (!hasSavedConsentProgress && !completionStatus.consentCompleted) {
            for (let i = 1; i <= 5; i++) {
                const checkbox = document.getElementById('check' + i);
                if (checkbox) {
                    checkbox.disabled = false;
                    checkbox.checked = false;
                }
            }
        } else {
            // Just enable checkboxes, don't clear them (loadSavedProgress will restore them)
            for (let i = 1; i <= 5; i++) {
                const checkbox = document.getElementById('check' + i);
                if (checkbox && !completionStatus.consentCompleted) {
                    checkbox.disabled = false;
                }
            }
        }
        
        // Re-enable privacy form elements (but don't clear if there's saved progress)
        if (!hasSavedPrivacyProgress && !completionStatus.privacyCompleted) {
            for (let i = 1; i <= 9; i++) {
                const inputs = document.querySelectorAll(`input[name="q${i}"]`);
                inputs.forEach(input => {
                    input.disabled = false;
                    input.checked = false;
                });
            }
            for (let i = 10; i <= 12; i++) {
                const textarea = document.getElementById(`q${i}-answer`);
                if (textarea) {
                    textarea.disabled = false;
                    textarea.value = '';
                }
            }
        } else {
            // Just enable inputs, don't clear them (loadSavedProgress will restore them)
            for (let i = 1; i <= 9; i++) {
                const inputs = document.querySelectorAll(`input[name="q${i}"]`);
                inputs.forEach(input => {
                    if (!completionStatus.privacyCompleted) {
                        input.disabled = false;
                    }
                });
            }
            for (let i = 10; i <= 12; i++) {
                const textarea = document.getElementById(`q${i}-answer`);
                if (textarea && !completionStatus.privacyCompleted) {
                    textarea.disabled = false;
                }
            }
        }
        
        const saveBtn = document.getElementById('save-progress-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save Privacy Form Progress';
            saveBtn.style.opacity = '1';
        }
        
        // Load saved progress AFTER enabling elements (but before updating display)
        if (!completionStatus.privacyCompleted && hasSavedPrivacyProgress) {
            loadSavedProgress();
            // Update progress bar after loading
            if (typeof updatePrivacyFormProgress === 'function') {
                updatePrivacyFormProgress();
            }
        }
        
        if (!completionStatus.consentCompleted && hasSavedConsentProgress) {
            loadConsentProgress();
        }
        
        // Update privacy controls display
        if (typeof updatePrivacyDisplay === 'function') {
            updatePrivacyDisplay(0.1);
        }
        if (typeof updateTradeoffMetrics === 'function') {
            updateTradeoffMetrics(0.1);
        }
    }, 100);
    
    if (!localStorage.getItem('consentProgress') && !localStorage.getItem('questionnaireProgress')) {
        console.log('No saved progress found. Forms ready for fresh submission.');
    } else {
        console.log('Saved progress detected. Forms will be restored.');
    }
    
    updateClock();
    setInterval(updateClock, 1000);
    
    // Heatmap and chart functions removed
    initializeNavigation();
    initializeSidebarToggle();
    initializeAccountPage();
    initializePrivacyControls();
    initializeSurveyModal();
    initializeCalendar();
    initializeRestrictedAccess();
    
    // Note: Access persists for the session - no need to re-authenticate on visibility change
    // Reset flags for new page load
    sessionEventListenersAdded = false;
    userEnteredNotificationCreated = false; // Reset to allow one notification per page load
    sessionInitialized = false; // Reset to allow initialization
    // Initialize session tracking (creates "User Entered" notification)
    initializeSession();
    
    // Check for unsynced data and upload to Firestore (after a short delay to ensure Firebase is loaded)
    setTimeout(async () => {
        // First, sync any unsynced local data to Firestore
        await syncUnsyncedData().catch(err => {
            console.error('[Firestore Sync] Error during initial sync check:', err);
        });
        
        // Then, load all data from Firestore for real-time updates
        await loadAllDataFromFirestore().catch(err => {
            console.error('[Firestore] Error loading data from Firestore:', err);
        });
    }, 2000); // Wait 2 seconds for Firebase module to load
    
    // Initialize notifications (loads and displays all notifications, updates badge)
    initializeNotifications();
    
    // Ensure badge is updated after everything is initialized
    setTimeout(() => {
        const notifications = getNotificationsFromStorage();
        updateNotificationBadge(getUnreadCount(notifications));
    }, 100);
    
    // Forms are now cleared and ready for fresh submission
    // Load saved progress if form not completed (will be empty after clear)
    loadSavedProgress();
    
    // Auto-save progress on input changes
    setupAutoSave();
    
    initializeConsentForm();
    initializeAIButton();  
    initializeCaptcha();
    dragController = makeAIDraggable();


    // ADD THESE TWO LINES:
    // Start updating notification times every second
    setInterval(updateNotificationTimes, 1000);


    console.log('Dashboard initialized successfully!');
});



/* ============================================
   CONSENT FORM FUNCTIONALITY
   ============================================ */

let checkedCount = 0;

function toggleCheckbox(num) {
    const checkbox = document.getElementById('check' + num);
    checkbox.checked = !checkbox.checked;
    updateProgress();
}

function updateProgress() {
    checkedCount = 0;
    for (let i = 1; i <= 5; i++) {
        if (document.getElementById('check' + i) && document.getElementById('check' + i).checked) {
            checkedCount++;
        }
    }

    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const submitBtn = document.getElementById('continueBtn');

    if (!progressFill || !progressText || !submitBtn) return;

    const percentage = (checkedCount / 5) * 100;
    progressFill.style.width = percentage + '%';
    progressText.textContent = checkedCount + ' of 5 items confirmed';

    if (checkedCount === 5) {
        submitBtn.classList.add('active');
        submitBtn.disabled = false;
        submitBtn.onclick = proceedToStudy;
        submitBtn.style.pointerEvents = 'auto';
    } else {
        submitBtn.classList.remove('active');
        submitBtn.disabled = true;
        submitBtn.onclick = null;
        submitBtn.style.pointerEvents = 'none';
    }
}

function saveConsentProgress() {
    if (completionStatus.consentCompleted) {
        alert('Consent form has already been submitted.');
        return;
    }
    
    const checkedCount = document.querySelectorAll('#consent-page input[type="checkbox"]:checked').length;
    
    if (checkedCount === 0) {
        alert('No Progress to Save\n\nPlease check at least one box before saving your progress.');
        return;
    }
    
    // Save checkbox states to localStorage
    const consentProgress = {
        check1: document.getElementById('check1')?.checked || false,
        check2: document.getElementById('check2')?.checked || false,
        check3: document.getElementById('check3')?.checked || false,
        check4: document.getElementById('check4')?.checked || false,
        check5: document.getElementById('check5')?.checked || false,
        savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('consentProgress', JSON.stringify(consentProgress));
    console.log('[saveConsentProgress] Progress saved to localStorage');
    
    // Try to sync to Firestore (non-blocking)
    syncToFirestore('consentProgress', consentProgress).catch(err => {
        console.log('[saveConsentProgress] Firestore sync failed, data saved to localStorage only');
    });
    
    // Show visual feedback with grey background and cyan tick (same as privacy form)
    const saveBtn = document.getElementById('saveConsentProgressBtn');
    if (saveBtn) {
        const originalText = saveBtn.innerHTML;
        const originalBg = saveBtn.style.backgroundColor || '';
        const originalColor = saveBtn.style.color || '';
        const originalBorder = saveBtn.style.borderColor || '';
        
        saveBtn.innerHTML = '<i class="fas fa-check" style="color: cyan;"></i> Progress Saved!';
        saveBtn.style.backgroundColor = '#1a1a1a';
        saveBtn.style.color = 'white';
        saveBtn.style.borderColor = 'white';
        
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.style.backgroundColor = originalBg;
            saveBtn.style.color = originalColor;
            saveBtn.style.borderColor = originalBorder;
        }, 2000);
    }
}

function proceedToStudy() {

    // Mark consent as completed

    markConsentCompleted();

    

    // Show success modal

    showConsentSuccessModal();

}

// Load saved consent form progress
function loadConsentProgress() {
    if (completionStatus.consentCompleted) {
        return; // Don't load if already completed
    }
    
    const savedData = localStorage.getItem('consentProgress');
    if (savedData) {
        try {
            const progress = JSON.parse(savedData);
            
            // Restore checkbox states
            if (progress.check1 !== undefined) {
                const check1 = document.getElementById('check1');
                if (check1) check1.checked = progress.check1;
            }
            if (progress.check2 !== undefined) {
                const check2 = document.getElementById('check2');
                if (check2) check2.checked = progress.check2;
            }
            if (progress.check3 !== undefined) {
                const check3 = document.getElementById('check3');
                if (check3) check3.checked = progress.check3;
            }
            if (progress.check4 !== undefined) {
                const check4 = document.getElementById('check4');
                if (check4) check4.checked = progress.check4;
            }
            if (progress.check5 !== undefined) {
                const check5 = document.getElementById('check5');
                if (check5) check5.checked = progress.check5;
            }
            
            // Update progress display
            updateProgress();
            console.log('[loadConsentProgress] Progress restored from localStorage');
        } catch (err) {
            console.error('[loadConsentProgress] Error loading progress:', err);
        }
    }
}

function initializeConsentForm() {
    // Check if consent already completed
    if (completionStatus.consentCompleted) {
        disableConsentForm();
        return;
    }
    
    // Load saved progress first
    loadConsentProgress();
    
    // Initialize all checkboxes with change listeners
    for (let i = 1; i <= 5; i++) {
        const checkbox = document.getElementById('check' + i);
        if (checkbox) {
            checkbox.addEventListener('change', updateProgress);
        }
    }
    
    // Attach save button handler
    const saveBtn = document.getElementById('saveConsentProgressBtn');
    if (saveBtn) {
        saveBtn.onclick = saveConsentProgress;
    }
    
    // Initialize progress on load (will update based on loaded checkboxes)
    updateProgress();
}

// Disable consent form after completion
function disableConsentForm() {
    // Disable all checkboxes
    for (let i = 1; i <= 5; i++) {
        const checkbox = document.getElementById('check' + i);
        if (checkbox) {
            checkbox.disabled = true;
            checkbox.checked = true; // Keep them checked
        }
    }
    
    // Disable submit button
    const submitBtn = document.getElementById('continueBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.remove('active');
        submitBtn.style.pointerEvents = 'none';
    }
}

/* ============================================
   FLOATING AI BUTTON FUNCTIONALITY
   ============================================ */

let dragController;  // Global variable to track drag state

function initializeAIButton() {
    const aiButton = document.getElementById('floating-ai-btn');
    const aiIcon = document.querySelector('.ai-icon');  // ADD THIS - target the center icon
    const aiModal = document.getElementById('ai-modal');
    const aiCloseBtn = document.getElementById('ai-close-btn');
    const aiInput = document.getElementById('ai-input');
    const aiSendBtn = document.getElementById('ai-send-btn');
    const aiChatContainer = document.getElementById('ai-chat-container');

    // Open AI Modal - ONLY when clicking the CENTER ICON
    if (aiIcon) {
        aiIcon.addEventListener('click', function(e) {
            e.stopPropagation();  // Prevent event bubbling
            
            // Small delay to ensure drag state is updated
            setTimeout(() => {
                // Only open if not dragged
                if (!dragController || !dragController.hasMoved()) {
                    if (aiModal) {
                        aiModal.classList.add('active');
                        document.body.style.overflow = 'hidden';
                        if (aiInput) {
                            setTimeout(() => aiInput.focus(), 300);
                        }
                    }
                }
                // Reset movement flag after checking
                if (dragController) {
                    dragController.resetMovement();
                }
            }, 10);
        });

        // Also add touch support for mobile
        aiIcon.addEventListener('touchend', function(e) {
            e.stopPropagation();  // Prevent event bubbling
            
            setTimeout(() => {
                if (!dragController || !dragController.hasMoved()) {
                    if (aiModal) {
                        aiModal.classList.add('active');
                        document.body.style.overflow = 'hidden';
                        if (aiInput) {
                            setTimeout(() => aiInput.focus(), 300);
                        }
                    }
                }
                if (dragController) {
                    dragController.resetMovement();
                }
            }, 10);
        });
    }

    // Close AI Modal
    if (aiCloseBtn) {
        aiCloseBtn.addEventListener('click', function() {
            if (aiModal) {
                aiModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Close modal when clicking outside
    if (aiModal) {
        aiModal.addEventListener('click', function(e) {
            if (e.target === aiModal) {
                aiModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Send message function
    function sendMessage() {
        if (!aiInput || !aiChatContainer) return;
        
        const message = aiInput.value.trim();
        if (message === '') return;

        // Add user message
        const userMessage = document.createElement('div');
        userMessage.className = 'ai-message ai-message-user';
        userMessage.innerHTML = `
            <div class="ai-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="ai-message-content">${message}</div>
        `;
        aiChatContainer.appendChild(userMessage);

        // Clear input
        aiInput.value = '';

        // Scroll to bottom
        aiChatContainer.scrollTop = aiChatContainer.scrollHeight;

        // Simulate AI response after a delay
        setTimeout(() => {
            const botMessage = document.createElement('div');
            botMessage.className = 'ai-message ai-message-bot';
            botMessage.innerHTML = `
                <div class="ai-avatar">
                    <i class="fas fa-bolt"></i>
                </div>
                <div class="ai-message-content">${getAIResponse(message)}</div>
            `;
            aiChatContainer.appendChild(botMessage);
            aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
        }, 1000);
    }

    // Send message on button click
    if (aiSendBtn) {
        aiSendBtn.addEventListener('click', sendMessage);
    }

    // Send message on Enter key
    if (aiInput) {
        aiInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && aiModal && aiModal.classList.contains('active')) {
            aiModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

/* ============================================
   DRAGGABLE AI BUTTON FUNCTIONALITY
   ============================================ */

function makeAIDraggable() {
    const aiButton = document.getElementById('floating-ai-btn');
    if (!aiButton) return;

    let isDragging = false;
    let hasMoved = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;
    let startX = 0;
    let startY = 0;

    aiButton.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    // Touch events for mobile
    aiButton.addEventListener('touchstart', dragStart);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', dragEnd);

    function dragStart(e) {
        if (e.type === 'touchstart') {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            startX = e.clientX;
            startY = e.clientY;
        }

        if (e.target === aiButton || aiButton.contains(e.target)) {
            isDragging = true;
            hasMoved = false;
            aiButton.style.cursor = 'grabbing';
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();

            let clientX, clientY;
            if (e.type === 'touchmove') {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
                currentX = clientX - initialX;
                currentY = clientY - initialY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
                currentX = clientX - initialX;
                currentY = clientY - initialY;
            }

            xOffset = currentX;
            yOffset = currentY;

            // Mark as moved if position changed by more than 5 pixels from start
            const deltaX = Math.abs(clientX - startX);
            const deltaY = Math.abs(clientY - startY);
            if (deltaX > 5 || deltaY > 5) {
                hasMoved = true;
            }

            setTranslate(currentX, currentY, aiButton);
        }
    }

    function dragEnd(e) {
        if (isDragging) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            aiButton.style.cursor = 'grab';
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    // Set initial cursor
    aiButton.style.cursor = 'grab';

    // Return methods to check and reset movement
    return {
        hasMoved: () => hasMoved,
        resetMovement: () => { hasMoved = false; }
    };
}

/* ============================================
   CAPTCHA SYSTEM (UPDATED)
   ============================================ */

let captchaState = {
    required: 0,
    completed: 0,
    textCode: '',
    isActive: false,
    pendingAction: null
};

// Calculate required CAPTCHAs based on epsilon privacy level
function calculateRequiredCaptchas(epsilon) {
    if (epsilon >= 0.1 && epsilon <= 1.5) {
        // High privacy → frequent CAPTCHA triggers
        return 5;  
    } 
    else if (epsilon > 1.5 && epsilon <= 3.0) {
        // Medium privacy → moderate frequency
        return 3;
    } 
    else if (epsilon > 3.0 && epsilon <= 5.0) {
        // Low privacy → few CAPTCHA triggers
        return 1;
    }
    return 0; // fallback
}

// Calculate CAPTCHA generation delay based on epsilon privacy level
function getCaptchaGenerationDelay(epsilon) {
    if (epsilon >= 0.1 && epsilon <= 1.5) {
        // High privacy → slower generation (6 seconds)
        return 6000; // 6 seconds in milliseconds
    } 
    else if (epsilon > 1.5 && epsilon <= 3.0) {
        // Medium privacy → moderate speed (4 seconds)
        return 4000; // 4 seconds in milliseconds
    } 
    else if (epsilon > 3.0 && epsilon <= 5.0) {
        // Low privacy → faster generation (2 seconds)
        return 2000; // 2 seconds in milliseconds
    }
    return 2000; // Default to 2 seconds
}


// Trigger CAPTCHA when privacy settings change
function triggerCaptcha(action) {
    // Don't trigger if already active
    if (captchaState.isActive) {
        return;
    }
    
    const epsilon = parseFloat(document.getElementById('privacy-slider').value);
    const requiredCaptchas = calculateRequiredCaptchas(epsilon);
    
    captchaState.required = requiredCaptchas;
    captchaState.completed = 0;
    captchaState.pendingAction = action;
    captchaState.isActive = true;
    
    // Don't update counter here - let showNextCaptcha do it
    showNextCaptcha();
}

// Generate text-based CAPTCHA
function generateTextCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const length = Math.floor(Math.random() * 3) + 6; // 6-8 characters
    captchaState.textCode = '';
    
    // Generate random characters
    for (let i = 0; i < length; i++) {
        captchaState.textCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Update character count display
    document.getElementById('character-count').textContent = length;
    
    // Draw CAPTCHA on canvas
    const canvas = document.getElementById('captcha-canvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add random curved lines for noise
    for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100}, 0.3)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const startX = Math.random() * canvas.width;
        const startY = Math.random() * canvas.height;
        ctx.moveTo(startX, startY);
        
        const cp1x = Math.random() * canvas.width;
        const cp1y = Math.random() * canvas.height;
        const cp2x = Math.random() * canvas.width;
        const cp2y = Math.random() * canvas.height;
        const endX = Math.random() * canvas.width;
        const endY = Math.random() * canvas.height;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        ctx.stroke();
    }
    
    // Draw distorted text
    ctx.font = 'bold 48px Arial';
    ctx.textBaseline = 'middle';
    
    const totalWidth = canvas.width - 40;
    const charSpacing = totalWidth / length;
    
    for (let i = 0; i < captchaState.textCode.length; i++) {
        ctx.save();
        
        const x = 20 + i * charSpacing + (Math.random() - 0.5) * 10;
        const y = 60 + (Math.random() - 0.5) * 20;
        const angle = (Math.random() - 0.5) * 0.5;
        const scale = 0.8 + Math.random() * 0.4;
        
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(scale, scale);
        
        // Random dark color for each character
        ctx.fillStyle = `rgb(${Math.random() * 80}, ${Math.random() * 80}, ${Math.random() * 80})`;
        ctx.fillText(captchaState.textCode[i], 0, 0);
        
        ctx.restore();
    }
    
    // Add light border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Clear input
    document.getElementById('captcha-input').value = '';
    document.getElementById('captcha-input').focus();
}

// Verify text CAPTCHA
function verifyTextCaptcha() {
    const input = document.getElementById('captcha-input').value.trim().toLowerCase();
    if (input === captchaState.textCode.toLowerCase()) {
        showCaptchaSuccess(); // Don't increment here anymore
    } else {
        alert('Incorrect CAPTCHA. Try again.');
    }
}

// Show success message briefly, then move to next CAPTCHA
function showCaptchaSuccess() {
    const textSection = document.getElementById('text-captcha-section');
    const successSection = document.getElementById('captcha-success');
    
    if (!textSection || !successSection) return;
    if (captchaState.transitioning) return;
    
    captchaState.transitioning = true;
    
    // ✅ Increment here, once per success
    captchaState.completed++;
    
    // Hide CAPTCHA input, show success
    textSection.classList.add('hidden');
    successSection.classList.remove('hidden');
    
    // ✅ Show the number just completed
    document.getElementById('captcha-current').textContent = captchaState.completed;
    document.getElementById('captcha-total').textContent = captchaState.required;

    // ✅ Next step
    if (captchaState.completed >= captchaState.required) {
        setTimeout(() => {
            captchaState.transitioning = false;
            completeCaptchaFlow();
        }, 1500);
    } else {
        setTimeout(() => {
            captchaState.transitioning = false;
            showNextCaptcha();
        }, 1500);
    }
}

// Show next CAPTCHA challenge
function showNextCaptcha() {
    if (captchaState.completed >= captchaState.required) {
        completeCaptchaFlow();
        return;
    }
    
    const modal = document.getElementById('captcha-modal');
    const textSection = document.getElementById('text-captcha-section');
    const successSection = document.getElementById('captcha-success');
    
    if (!textSection || !successSection || !modal) return;
    
    // Get current epsilon value to determine delay
    const epsilon = parseFloat(document.getElementById('privacy-slider')?.value || '0.1');
    const delay = getCaptchaGenerationDelay(epsilon);
    
    // Show modal immediately but hide content during delay
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Hide content sections and show loading state
    textSection.classList.add('hidden');
    successSection.classList.add('hidden');
    
    // Display next CAPTCHA number
    document.getElementById('captcha-current').textContent = captchaState.completed + 1;
    document.getElementById('captcha-total').textContent = captchaState.required;
    
    // Disable continue button during loading
    const continueBtn = document.getElementById('verify-text-captcha');
    if (continueBtn) {
        continueBtn.disabled = true;
        continueBtn.style.opacity = '0.5';
        continueBtn.style.cursor = 'not-allowed';
    }
    
    // Show loading message during delay
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'captcha-loading';
    loadingMessage.style.cssText = 'text-align: center; padding: 40px; color: cyan; font-size: 18px; font-weight: bold;';
    
    // Create countdown display
    let remainingSeconds = delay / 1000;
    loadingMessage.textContent = `Generating CAPTCHA... (${remainingSeconds}s)`;
    
    // Clear any existing loading message
    const existingLoading = document.getElementById('captcha-loading');
    if (existingLoading) {
        existingLoading.remove();
    }
    
    // Add loading message to modal
    const captchaBody = document.querySelector('.captcha-body');
    if (captchaBody) {
        captchaBody.appendChild(loadingMessage);
    }
    
    // Update countdown every second
    const countdownInterval = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds > 0) {
            loadingMessage.textContent = `Generating CAPTCHA... (${remainingSeconds}s)`;
        } else {
            clearInterval(countdownInterval);
        }
    }, 1000);
    
    // After delay, generate and show CAPTCHA
    setTimeout(() => {
        clearInterval(countdownInterval);
        
        // Remove loading message
        const loading = document.getElementById('captcha-loading');
        if (loading) {
            loading.remove();
        }
        
        // Re-enable continue button
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.style.opacity = '1';
            continueBtn.style.cursor = 'pointer';
        }
        
        // Show content sections
        textSection.classList.remove('hidden');
        successSection.classList.add('hidden');
        
        // Generate and display CAPTCHA
        generateTextCaptcha();
    }, delay);
}


// Complete CAPTCHA flow
function completeCaptchaFlow() {
    const modal = document.getElementById('captcha-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    captchaState.isActive = false;
    
    // Execute pending action if any
    if (captchaState.pendingAction) {
        captchaState.pendingAction();
        captchaState.pendingAction = null;
    }
    
    alert(`Verification complete! You completed ${captchaState.completed} CAPTCHA(s) successfully.`);
}

// Update CAPTCHA counter display
// When inSuccess is true, show the number just completed
// When false, show the number about to work on
function updateCaptchaCounter(inSuccess = false) {
    const displayNumber = inSuccess ? captchaState.completed : captchaState.completed + 1;
    document.getElementById('captcha-current').textContent = displayNumber;
    document.getElementById('captcha-total').textContent = captchaState.required;
}

// Initialize CAPTCHA event listeners
function initializeCaptcha() {
    const verifyTextBtn = document.getElementById('verify-text-captcha');
    const captchaInput = document.getElementById('captcha-input');
    const audioBtn = document.querySelectorAll('.captcha-icon-btn')[0];
    const refreshBtn = document.querySelectorAll('.captcha-icon-btn')[1];
    
    if (verifyTextBtn) {
        verifyTextBtn.addEventListener('click', verifyTextCaptcha);
    }
    
    if (captchaInput) {
        // Prevent paste
        captchaInput.addEventListener('paste', function(e) {
            e.preventDefault();
            alert('Pasting is not allowed. Please type the characters manually.');
        });
        
        // Submit on Enter
        captchaInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                verifyTextCaptcha();
            }
        });
    }
    
    // Audio button - reads the CAPTCHA code aloud
    if (audioBtn) {
        audioBtn.addEventListener('click', function() {
            // Use Web Speech API to read the text
            const utterance = new SpeechSynthesisUtterance(captchaState.textCode);
            utterance.rate = 0.8; // Slower speech for clarity
            utterance.pitch = 1;
            utterance.volume = 1;
            window.speechSynthesis.cancel(); // Cancel any previous speech
            window.speechSynthesis.speak(utterance);
        });
    }
    
    // Refresh button to generate new CAPTCHA
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            generateTextCaptcha();
        });
    }
}

/* ============================================
   ACCOUNT PAGE FUNCTIONALITY
   ============================================ */

function initializeAccountPage() {
    console.log('Initializing Account Page...');
    
    // Generate dynamic session ID with 6 random digits (S-XXXXXX format)
    const randomSixDigits = Math.floor(100000 + Math.random() * 900000); // Generates 100000-999999
    const sessionId = `S-${randomSixDigits}`;
    
    const accountSessionId = document.getElementById('account-session-id');
    if (accountSessionId) {
        accountSessionId.textContent = sessionId;
        console.log('Session ID set:', sessionId);
    }
    
    // Sync with privacy state
    updateAccountInfo();
    updateRecentActivityStatus();
    
    // Update session timer (only if session is not completed)
    // If completed, the duration is frozen and shown from session data via updateAccountInfo()
    const isCompleted = (completionStatus.consentCompleted && completionStatus.privacyCompleted) || 
                        privacyState.isFrozen || 
                        (localStorage.getItem('consentCompleted') === 'true' && 
                         localStorage.getItem('privacyCompleted') === 'true');
    
    if (!isCompleted) {
        // Only run timer for active sessions
        let sessionStartTime = Date.now();
        
        setInterval(() => {
            // Check again in case status changed during the interval
            const stillActive = !((completionStatus.consentCompleted && completionStatus.privacyCompleted) || 
                                 privacyState.isFrozen);
            
            if (stillActive) {
                const elapsed = Date.now() - sessionStartTime;
                const hours = Math.floor(elapsed / 3600000);
                const minutes = Math.floor((elapsed % 3600000) / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                
                const sessionDuration = document.getElementById('session-duration');
                if (sessionDuration) {
                    sessionDuration.textContent = `${hours}h ${minutes}m ${seconds}s`;
                }
            }
        }, 1000);
    }
    
    // Update last updated time
    updateAccountTimestamp();
    
    console.log('Account Page initialized successfully');
}

function updateAccountInfo() {
    console.log('Updating account info...', privacyState);
    
    // Check if user has completed both forms
    // Use multiple checks to ensure accuracy: completionStatus, privacyState.isFrozen, and localStorage
    const localStorageConsent = localStorage.getItem('consentCompleted') === 'true';
    const localStoragePrivacy = localStorage.getItem('privacyCompleted') === 'true';
    const isCompleted = (completionStatus.consentCompleted && completionStatus.privacyCompleted) || 
                        privacyState.isFrozen || 
                        (localStorageConsent && localStoragePrivacy);
    
    const sessions = getSessionsFromStorage();
    const userSession = isCompleted ? sessions.find(s => 
        s.userId === privacyState.userId && 
        s.consentCompleted === true && 
        s.privacyCompleted === true
    ) : null;
    
    // Update User ID throughout the page
    const accountUserId = document.getElementById('account-user-id');
    const sidebarUserId = document.getElementById('sidebar-user-id');
    const privacySessionId = document.getElementById('session-id');
    
    if (accountUserId) {
        accountUserId.textContent = privacyState.userId;
        console.log('Updated account user ID:', privacyState.userId);
    }
    if (sidebarUserId) {
        sidebarUserId.textContent = privacyState.userId;
    }
    if (privacySessionId) {
        privacySessionId.textContent = privacyState.userId;
    }
    
    // Update Session ID from completed session if available
    const accountSessionId = document.getElementById('account-session-id');
    if (accountSessionId) {
        if (userSession && userSession.sessionId) {
            accountSessionId.textContent = userSession.sessionId;
        } else {
            // Generate temporary session ID for active sessions
            const randomSixDigits = Math.floor(100000 + Math.random() * 900000);
            accountSessionId.textContent = `S-${randomSixDigits}`;
        }
    }
    
    // Update Account Created Date
    // CRITICAL: Account created date must NEVER reset - always load from stored session data
    const accountCreated = document.getElementById('account-created');
    if (accountCreated) {
        if (isCompleted && userSession && userSession.accountCreatedDateDisplay) {
            // Priority 1: Load from completed session data (permanent record)
            accountCreated.textContent = userSession.accountCreatedDateDisplay;
            console.log('[Account Created] Loaded from session data:', userSession.accountCreatedDateDisplay);
        } else {
            // For active sessions or if session data not available, use getAccountCreatedDate()
            // This function ensures the date is set once and never changes
            const accountCreatedDate = getAccountCreatedDate();
            accountCreated.textContent = accountCreatedDate.toLocaleDateString('en-GB');
            console.log('[Account Created] Using getAccountCreatedDate():', accountCreatedDate.toLocaleDateString('en-GB'));
        }
    }
    
    // Update epsilon value - PRIORITY: Load from storage for completed users
    // Always use 1 decimal place as per requirements
    const accountEpsilon = document.getElementById('account-epsilon');
    if (accountEpsilon) {
        const isCompletedCheck = localStorage.getItem('consentCompleted') === 'true' && 
                            localStorage.getItem('privacyCompleted') === 'true';
        
        if (isCompletedCheck) {
            // User has completed - load finalEpsilon from storage (NEVER use random value)
            const sessions = getSessionsFromStorage();
            const completedSession = sessions.find(s => 
                s.userId === privacyState.userId && 
                s.privacyCompleted === true
            );
            
            if (completedSession && completedSession.finalEpsilon && completedSession.finalEpsilon !== 'N/A') {
                accountEpsilon.textContent = parseFloat(completedSession.finalEpsilon).toFixed(1);
                console.log('[Account] ✅ Displaying finalEpsilon:', completedSession.finalEpsilon);
            } else {
                // Fallback to localStorage backup
                const storedFinalEpsilon = localStorage.getItem('finalEpsilon');
                if (storedFinalEpsilon && storedFinalEpsilon !== 'N/A') {
                    accountEpsilon.textContent = parseFloat(storedFinalEpsilon).toFixed(1);
                    console.log('[Account] ✅ Displaying finalEpsilon from localStorage:', storedFinalEpsilon);
                } else if (privacyState.isFrozen && privacyState.epsilon) {
                    accountEpsilon.textContent = privacyState.epsilon.toFixed(1);
                    console.log('[Account] ✅ Displaying epsilon from frozen privacyState:', privacyState.epsilon);
                } else {
                    console.error('[Account] ❌ No finalEpsilon found for completed user!');
                    accountEpsilon.textContent = 'ERROR';
                }
            }
        } else {
            // Active session - show current value (random starting value is fine here)
            accountEpsilon.textContent = privacyState.epsilon.toFixed(1);
        }
    }
    
    // Update privacy badge (use privacy level from completed session if available)
    const privacyBadge = document.getElementById('account-privacy-badge');
    if (privacyBadge) {
        if (userSession && userSession.privacyLevel && userSession.privacyLevel !== 'N/A') {
            privacyBadge.textContent = userSession.privacyLevel;
            // Set color based on privacy level
            if (userSession.privacyLevel === 'High Privacy') {
                privacyBadge.style.backgroundColor = '#00ffff'; // cyan
            } else if (userSession.privacyLevel === 'Medium Privacy') {
                privacyBadge.style.backgroundColor = '#ff8c00'; // orange
            } else if (userSession.privacyLevel === 'Low Privacy') {
                privacyBadge.style.backgroundColor = '#ff4444'; // red
            }
        } else {
            // Calculate from current epsilon
            const epsilon = userSession && userSession.finalEpsilon && userSession.finalEpsilon !== 'N/A' 
                ? parseFloat(userSession.finalEpsilon) 
                : privacyState.epsilon;
            if (epsilon >= 0.1 && epsilon <= 1.5) {
                privacyBadge.textContent = 'High Privacy';
                privacyBadge.style.backgroundColor = '#00ffff'; // cyan
            } else if (epsilon > 1.5 && epsilon <= 3.0) {
                privacyBadge.textContent = 'Medium Privacy';
                privacyBadge.style.backgroundColor = '#ff8c00'; // orange
            } else if (epsilon > 3.0 && epsilon <= 5.0) {
                privacyBadge.textContent = 'Low Privacy';
                privacyBadge.style.backgroundColor = '#ff4444'; // red
            } else {
                privacyBadge.textContent = 'Unknown';
                privacyBadge.style.backgroundColor = '#888888';
            }
        }
        console.log('Updated privacy badge');
    }
    
    // Update epsilon changes count
    // CRITICAL: For completed users, ALWAYS load from stored session data (never recalculate or reset to 0)
    const epsilonChanges = document.getElementById('epsilon-changes');
    if (epsilonChanges) {
        if (isCompleted) {
            // Priority 1: Load from completed session data (Firestore/localStorage)
            if (userSession && userSession.epsilonChanges !== undefined && userSession.epsilonChanges !== null) {
                epsilonChanges.textContent = userSession.epsilonChanges.toString();
                console.log('[Epsilon Changes] Loaded from session data:', userSession.epsilonChanges);
            } 
            // Priority 2: Load from localStorage (permanent record)
            else {
                const storedEpsilonChanges = localStorage.getItem('final_epsilon_changes');
                if (storedEpsilonChanges !== null && storedEpsilonChanges !== '') {
                    epsilonChanges.textContent = storedEpsilonChanges;
                    console.log('[Epsilon Changes] Loaded from localStorage:', storedEpsilonChanges);
                } 
                // Priority 3: Load from privacyState (should already be frozen)
                else if (privacyState.isFrozen && privacyState.settingsChanged !== undefined) {
                    epsilonChanges.textContent = privacyState.settingsChanged.toString();
                    console.log('[Epsilon Changes] Loaded from privacyState:', privacyState.settingsChanged);
                } 
                // Last resort: should never happen if finalized properly
                else {
                    console.error('[Epsilon Changes] ⚠️ No stored value found for completed session!');
                    epsilonChanges.textContent = 'ERROR'; // Show ERROR instead of 0
                }
            }
        } else {
            // For active sessions, show current count
            epsilonChanges.textContent = privacyState.settingsChanged.toString();
        }
    }
    
    // Update session status - show "Completed" if both forms are done
    const sessionStatus = document.getElementById('session-status');
    if (sessionStatus) {
        // Multiple checks to ensure accurate status
        const isReallyCompleted = isCompleted || 
                                  privacyState.isFrozen || 
                                  (localStorage.getItem('consentCompleted') === 'true' && 
                                   localStorage.getItem('privacyCompleted') === 'true');
        
        if (isReallyCompleted) {
            sessionStatus.textContent = 'Completed';
            sessionStatus.className = 'stat-value stat-completed';
            sessionStatus.style.color = '#00ff00'; // Green
            
            // CRITICAL: Load session duration from completed session (never recalculate)
            // This ensures duration is always shown from stored data, not recalculated
            const sessionDuration = document.getElementById('session-duration');
            if (sessionDuration) {
                // Priority 1: Load from completed session data
                if (userSession && userSession.durationObj) {
                    const duration = formatDuration(userSession.durationObj);
                    sessionDuration.textContent = duration;
                    console.log('[Session Duration] Loaded from session data:', duration);
                } 
                // Priority 2: Load from localStorage
                else {
                    const storedDurationObj = localStorage.getItem('sessionDurationObj');
                    if (storedDurationObj) {
                        try {
                            const durationObj = JSON.parse(storedDurationObj);
                            const duration = formatDuration(durationObj);
                            sessionDuration.textContent = duration;
                            console.log('[Session Duration] Loaded from localStorage:', duration);
                        } catch (e) {
                            console.error('[Session Duration] Error parsing stored duration:', e);
                        }
                    } else {
                        console.warn('[Session Duration] ⚠️ No stored duration found for completed session');
                    }
                }
            }
            
            console.log('[Session Status] ✅ Set to Completed - both forms submitted');
        } else {
            sessionStatus.textContent = 'Active';
            sessionStatus.className = 'stat-value stat-active';
            sessionStatus.style.color = '#00ffff'; // Cyan
            console.log('[Session Status] Active - forms not yet completed');
        }
    }
    
    // Display average epsilon
    // CRITICAL: For completed users, ALWAYS load from stored session data (never recalculate or reset to 0)
    const averageEpsilon = document.getElementById('average-epsilon');
    if (averageEpsilon) {
        if (isCompleted) {
            // Priority 1: Load from completed session data (Firestore/localStorage)
            if (userSession && userSession.averageEpsilon !== undefined && userSession.averageEpsilon !== null) {
                averageEpsilon.textContent = parseFloat(userSession.averageEpsilon).toFixed(1);
                console.log('[Average Epsilon] Loaded from session data:', userSession.averageEpsilon);
            } 
            // Priority 2: Load from localStorage (permanent record)
            else {
                const storedAverageEpsilon = localStorage.getItem('final_average_epsilon');
                if (storedAverageEpsilon !== null && storedAverageEpsilon !== '') {
                    averageEpsilon.textContent = parseFloat(storedAverageEpsilon).toFixed(1);
                    console.log('[Average Epsilon] Loaded from localStorage:', storedAverageEpsilon);
                } 
                // Priority 3: Load from privacyState (should already be frozen)
                else if (privacyState.isFrozen && privacyState.finalAverageEpsilon !== null) {
                    averageEpsilon.textContent = privacyState.finalAverageEpsilon.toFixed(1);
                    console.log('[Average Epsilon] Loaded from privacyState:', privacyState.finalAverageEpsilon);
                } 
                // Last resort: should never happen if finalized properly
                else {
                    console.error('[Average Epsilon] ⚠️ No stored value found for completed session!');
                    averageEpsilon.textContent = 'ERROR'; // Show ERROR instead of 0.0
                }
            }
        } else {
            // For active sessions, calculate from current values (1 decimal place)
            if (privacyState.epsilonValues && privacyState.epsilonValues.length > 0) {
                const average = privacyState.totalEpsilonSum / privacyState.epsilonValues.length;
                averageEpsilon.textContent = average.toFixed(1);
                console.log('[Average Epsilon] Calculated from active session:', average.toFixed(1));
            } else {
                averageEpsilon.textContent = '0.0';
                console.log('[Average Epsilon] No epsilon values yet');
            }
        }
    } else {
        console.log('[Average Epsilon] Element not found');
    }
    
    // Update Session Started and Session Ended times for completed sessions
    // CRITICAL: Always load from completed session data (never recalculate)
    if (isCompleted) {
        const sessionStarted = document.getElementById('session-started');
        if (sessionStarted) {
            // Priority: userSession > localStorage > privacyState
            if (userSession && userSession.timeStarted) {
                sessionStarted.textContent = userSession.timeStarted;
            } else {
                const storedSessionStarted = localStorage.getItem('sessionStartedTimeFormatted');
                if (storedSessionStarted) {
                    sessionStarted.textContent = storedSessionStarted;
                } else if (privacyState.sessionStartTime) {
                    sessionStarted.textContent = privacyState.sessionStartTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    });
                }
            }
            sessionStarted.dataset.initialized = 'true';
        }
        
        const sessionEnded = document.getElementById('session-ended');
        if (sessionEnded) {
            // Priority: userSession > localStorage > privacyState (never show "Session Ongoing" for completed sessions)
            if (userSession && userSession.timeEnded && userSession.timeEnded !== 'N/A') {
                sessionEnded.textContent = userSession.timeEnded;
            } else {
                const storedSessionEnded = localStorage.getItem('sessionEndTimeFormatted');
                if (storedSessionEnded) {
                    sessionEnded.textContent = storedSessionEnded;
                } else if (privacyState.sessionEndTime) {
                    sessionEnded.textContent = privacyState.sessionEndTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    });
                } else {
                    // Fallback: try to get from session data in Firestore
                    const sessions = getSessionsFromStorage();
                    const completedSession = sessions.find(s => 
                        s.userId === privacyState.userId && 
                        s.consentCompleted === true && 
                        s.privacyCompleted === true
                    );
                    if (completedSession && completedSession.timeEnded && completedSession.timeEnded !== 'N/A') {
                        sessionEnded.textContent = completedSession.timeEnded;
                    } else {
                        // Last resort: use current time (shouldn't happen if finalized properly)
                        sessionEnded.textContent = new Date().toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                        });
                        console.warn('[Session Ended] ⚠️ No stored end time found, using current time');
                    }
                }
            }
        }
    }
    
    console.log('Account info update complete');
}

function updateAccountTimestamp() {
    // Check if forms are completed - if so, use frozen values from session
    const isCompleted = completionStatus.consentCompleted && completionStatus.privacyCompleted;
    const sessions = getSessionsFromStorage();
    const userSession = isCompleted ? sessions.find(s => 
        s.userId === privacyState.userId && 
        s.consentCompleted === true && 
        s.privacyCompleted === true
    ) : null;
    
    // Update session started time (frozen if completed)
    const sessionStarted = document.getElementById('session-started');
    if (sessionStarted) {
        if (isCompleted && userSession && userSession.timeStarted) {
            // Use frozen session started time from completed session
            sessionStarted.textContent = userSession.timeStarted;
            sessionStarted.dataset.initialized = 'true';
        } else if (!sessionStarted.dataset.initialized) {
            const timeString = privacyState.sessionStartTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            sessionStarted.textContent = timeString;
            sessionStarted.dataset.initialized = 'true';
        }
    }
    
    // Update session ended status (frozen if completed)
    // CRITICAL: Never show "Session Ongoing" for completed sessions
    const sessionEnded = document.getElementById('session-ended');
    if (sessionEnded) {
        if (isCompleted) {
            // Priority: userSession > localStorage > privacyState
            if (userSession && userSession.timeEnded && userSession.timeEnded !== 'N/A') {
                sessionEnded.textContent = userSession.timeEnded;
            } else {
                const storedSessionEnded = localStorage.getItem('sessionEndTimeFormatted');
                if (storedSessionEnded) {
                    sessionEnded.textContent = storedSessionEnded;
                } else if (privacyState.sessionEndTime) {
                    sessionEnded.textContent = privacyState.sessionEndTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    });
                } else {
                    // Fallback: try to get from session data
                    const completedSession = sessions.find(s => 
                        s.userId === privacyState.userId && 
                        s.consentCompleted === true && 
                        s.privacyCompleted === true
                    );
                    if (completedSession && completedSession.timeEnded && completedSession.timeEnded !== 'N/A') {
                        sessionEnded.textContent = completedSession.timeEnded;
                    } else {
                        // Last resort: use current time (shouldn't happen if finalized properly)
                        sessionEnded.textContent = new Date().toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                        });
                        console.warn('[Session Ended] ⚠️ No stored end time found, using current time');
                    }
                }
            }
        } else if (privacyState.sessionEnded && privacyState.sessionEndTime) {
            const timeString = privacyState.sessionEndTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            sessionEnded.textContent = timeString;
        } else {
            sessionEnded.textContent = 'Session Ongoing';
        }
    }
    
    // Update account created date (frozen if completed, one time otherwise)
    // CRITICAL: Account created date must NEVER reset - it's set once on first visit
    const accountCreated = document.getElementById('account-created');
    if (accountCreated) {
        if (isCompleted && userSession && userSession.accountCreatedDateDisplay) {
            // Use frozen account created date from completed session (highest priority)
            accountCreated.textContent = userSession.accountCreatedDateDisplay;
            accountCreated.dataset.initialized = 'true';
        } else {
            // For active sessions or if session data not available, use getAccountCreatedDate()
            // This function ensures the date is set once and never changes
            const accountCreatedDate = getAccountCreatedDate();
            accountCreated.textContent = accountCreatedDate.toLocaleDateString('en-GB');
            accountCreated.dataset.initialized = 'true';
        }
    }
    
    // Calculate and update session duration (frozen if completed)
    updateSessionDuration();
}

// Function to calculate and update session duration
function updateSessionDuration() {
    const sessionDuration = document.getElementById('session-duration');
    if (!sessionDuration) return;
    
    // If both forms are completed, use frozen session data (never recalculate)
    const isCompleted = privacyState.isFrozen || (completionStatus.consentCompleted && completionStatus.privacyCompleted);
    
    if (isCompleted) {
        // Priority 1: Load from localStorage (permanent record)
        const storedDurationObj = localStorage.getItem('sessionDurationObj');
        if (storedDurationObj) {
            try {
                const durationObj = JSON.parse(storedDurationObj);
                const duration = formatDuration(durationObj);
                sessionDuration.textContent = duration;
                return;
            } catch (e) {
                console.error('[Session Duration] Error parsing stored duration:', e);
            }
        }
        
        // Priority 2: Load from session data
        const sessions = getSessionsFromStorage();
        const userSession = sessions.find(s => 
            s.userId === privacyState.userId && 
            s.consentCompleted === true && 
            s.privacyCompleted === true
        );
        
        if (userSession && userSession.durationObj) {
            // Use frozen duration from completed session
            const duration = formatDuration(userSession.durationObj);
            sessionDuration.textContent = duration;
            return;
        }
        
        // Priority 3: Calculate from stored start/end times
        const sessionStartTimeStr = localStorage.getItem('sessionStartedTime');
        const sessionEndTimeStr = localStorage.getItem('sessionEndTime');
        if (sessionStartTimeStr && sessionEndTimeStr) {
            const startTime = new Date(sessionStartTimeStr);
            const endTime = new Date(sessionEndTimeStr);
            const elapsed = endTime - startTime;
            
            const hours = Math.floor(elapsed / (1000 * 60 * 60));
            const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
            
            const durationObj = { hours, minutes, seconds, totalSeconds: Math.floor(elapsed / 1000) };
            const duration = formatDuration(durationObj);
            sessionDuration.textContent = duration;
            return;
        }
        
        // Fallback: show stored duration if available
        const storedDurationSeconds = localStorage.getItem('sessionDurationSeconds');
        if (storedDurationSeconds) {
            const totalSeconds = parseInt(storedDurationSeconds);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            sessionDuration.textContent = `${hours}h ${minutes}m ${seconds}s`;
            return;
        }
        
        console.warn('[Session Duration] ⚠️ No stored duration found for completed session');
        return;
    }
    
    // Otherwise, calculate from current session (only for active sessions)
    const endTime = privacyState.sessionEnded ? privacyState.sessionEndTime : new Date();
    const elapsed = endTime - privacyState.sessionStartTime;
    
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
    
    sessionDuration.textContent = `${hours}h ${minutes}m ${seconds}s`;
}

// Hook into the existing updateSessionInfo to also update account page
const originalUpdateSessionInfo = updateSessionInfo;
updateSessionInfo = function() {
    if (typeof originalUpdateSessionInfo === 'function') {
        originalUpdateSessionInfo();
    }
    updateAccountInfo();
    updateAccountTimestamp();
};

function openMonthYearPicker() {
    const picker = document.getElementById('month-year-picker');
    if (picker) {
        picker.classList.add('active');
        updatePickerDisplay();
    }
}

function closeMonthYearPicker() {
    const picker = document.getElementById('month-year-picker');
    if (picker) {
        picker.classList.remove('active');
    }
}

function updatePickerDisplay() {
    const pickerYearEl = document.getElementById('picker-year');
    if (pickerYearEl) {
        pickerYearEl.textContent = pickerYear;
    }
    
    // Regenerate months grid to update selection
    generateMonthsGrid();
}

function generateMonthsGrid() {
    const monthsGrid = document.getElementById('months-grid');
    if (!monthsGrid) return;
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    monthsGrid.innerHTML = '';
    
    monthNames.forEach((month, index) => {
        const monthCell = document.createElement('div');
        monthCell.className = 'month-cell';
        monthCell.textContent = month;
        
        if (index === currentMonth && pickerYear === currentYear) {
            monthCell.classList.add('selected');
        }
        
        monthCell.addEventListener('click', function() {
            currentMonth = index;
            currentYear = pickerYear;
            userSelectedMonth = true; // Mark that user manually selected a month
            renderCalendar();
            closeMonthYearPicker();
        });
        
        monthsGrid.appendChild(monthCell);
    });
}
/* ===== Session History Generator ===== */

// Generate realistic session durations (in minutes)
function generateSessionDuration() {
    // Most sessions between 5-45 minutes, with some outliers
    const durations = [
        { min: 5, max: 15, weight: 0.3 },    // Short sessions
        { min: 15, max: 30, weight: 0.4 },   // Average sessions
        { min: 30, max: 45, weight: 0.2 },   // Longer sessions
        { min: 45, max: 90, weight: 0.1 }    // Extended sessions
    ];
    
    const random = Math.random();
    let cumWeight = 0;
    
    for (const range of durations) {
        cumWeight += range.weight;
        if (random <= cumWeight) {
            return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        }
    }
    
    return 20; // fallback
}

// Generate random date in October 2025
function generateRandomDate() {
    const day = Math.floor(Math.random() * 22) + 1; // Days 1-22
    return `${day.toString().padStart(2, '0')}/10/25`;
}

// Generate random time
function generateRandomTime() {
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
}

// Add minutes to a time string
function addMinutesToTime(timeStr, minutesToAdd) {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + minutesToAdd;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Generate unique 4-digit user ID
function generateUniqueUserId(existingIds) {
    let userId;
    do {
        userId = Math.floor(1000 + Math.random() * 9000);
    } while (existingIds.has(userId));
    existingIds.add(userId);
    return `U-${userId}`;
}

// Generate epsilon changes (1-8, weighted towards lower numbers)
// Users must interact with the slider, so minimum is 1
function generateEpsilonChanges() {
    const random = Math.random();
    if (random < 0.4) return 1; // Single change (40%)
    if (random < 0.7) return Math.floor(Math.random() * 2) + 2; // 2-3 changes (30%)
    if (random < 0.9) return Math.floor(Math.random() * 2) + 4; // 4-5 changes (20%)
    return Math.floor(Math.random() * 3) + 6; // 6-8 changes (10%)
}

// Generate first and final epsilon values
function generateEpsilonValues() {
    // Epsilon range from 0.1 to 10.0
    const firstEpsilon = (Math.random() * 9.9 + 0.1).toFixed(2);
    const finalEpsilon = (Math.random() * 9.9 + 0.1).toFixed(2);
    return { firstEpsilon, finalEpsilon };
}

// Generate session data
function generateSessionData() {
    const sessions = [];
    const existingUserIds = new Set();
    const totalSessions = 50; // Generate 50 sessions
    
    // Create some dates with multiple users
    const popularDates = ['15/10/25', '18/10/25', '20/10/25', '22/10/25'];
    
    for (let i = 0; i < totalSessions; i++) {
        const date = Math.random() < 0.4 && popularDates.length > 0 
            ? popularDates[Math.floor(Math.random() * popularDates.length)]
            : generateRandomDate();
        
        const startTime = generateRandomTime();
        const durationMinutes = generateSessionDuration();
        const endTime = addMinutesToTime(startTime, durationMinutes);
        
        const userId = generateUniqueUserId(existingUserIds);
        const epsilonChanges = generateEpsilonChanges();
        const epsilonValues = generateEpsilonValues();
        
        // 70% chance consent form is completed
        const consentCompleted = Math.random() < 0.7;
        
        // Privacy form can ONLY be completed if consent form is completed first
        // If consent is completed, 75% chance privacy is also completed
        const privacyCompleted = consentCompleted ? (Math.random() < 0.75) : false;
        
        sessions.push({
            participant: i + 1,
            date: date,
            timeStarted: startTime,
            timeEnded: endTime,
            userId: userId,
            duration: durationMinutes,
            epsilonChanges: epsilonChanges,
            firstEpsilon: epsilonValues.firstEpsilon,
            finalEpsilon: epsilonValues.finalEpsilon,
            consentCompleted: consentCompleted,
            privacyCompleted: privacyCompleted
        });
    }
    
    // Sort by date and time
    sessions.sort((a, b) => {
        const dateA = new Date('20' + a.date.split('/').reverse().join('-') + 'T' + a.timeStarted);
        const dateB = new Date('20' + b.date.split('/').reverse().join('-') + 'T' + b.timeStarted);
        return dateB - dateA; // Most recent first
    });
    
    // Renumber participants after sorting
    sessions.forEach((session, index) => {
        session.participant = index + 1;
    });
    
    return sessions;
}

// Format duration for display
// Format duration with hours, minutes, and seconds
function formatDuration(duration) {
    // Handle both old format (minutes as number) and new format (object with hours, minutes, seconds)
    let hours, minutes, seconds;
    
    if (typeof duration === 'object' && duration.hours !== undefined) {
        hours = duration.hours;
        minutes = duration.minutes;
        seconds = duration.seconds;
    } else {
        // Legacy format: convert minutes to hours, minutes, seconds
        const totalSeconds = (duration || 0) * 60;
        hours = Math.floor(totalSeconds / 3600);
        minutes = Math.floor((totalSeconds % 3600) / 60);
        seconds = totalSeconds % 60;
    }
    
    // Format: "1hr 2 mins 3sec" or "30mins 40sec"
    const parts = [];
    
    if (hours > 0) {
        parts.push(`${hours}hr`);
    }
    
    if (minutes > 0) {
        // If hours exist, use "mins", otherwise use "mins" (no space before)
        parts.push(`${minutes}${hours > 0 ? ' mins' : 'mins'}`);
    }
    
    // Always show seconds if there's any duration, or if it's the only component
    if (seconds > 0 || (hours === 0 && minutes === 0 && seconds === 0)) {
        parts.push(`${seconds}sec`);
    }
    
    return parts.join(' ');
}

// Render session table
function renderSessionTable(sessions) {
    const tbody = document.getElementById('session-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (sessions.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="11" style="text-align: center; color: #888; padding: 40px;">No session data available yet</td>`;
        tbody.appendChild(row);
        return;
    }
    
    const currentSessionId = sessionStorage.getItem('current_session_id');
    
    sessions.forEach(session => {
        // Check if this is the current active session
        const isActiveSession = session.sessionId === currentSessionId;
        
        // Calculate duration: if timeEnded exists, recalculate from times, otherwise show N/A
        let durationDisplay = 'N/A';
        if (session.timeEnded && session.timeEnded !== 'N/A' && session.timeStarted && session.date) {
            // Session has ended - recalculate duration from time strings to ensure accuracy
            const calculatedDuration = calculateDurationFromTimes(
                session.date,
                session.timeStarted,
                session.timeEnded
            );
            // Ensure duration is calculated correctly
            if (calculatedDuration && calculatedDuration.totalSeconds > 0) {
                durationDisplay = formatDuration(calculatedDuration);
            } else {
                // Fallback: use stored duration if calculation fails
                if (session.durationObj) {
                    durationDisplay = formatDuration(session.durationObj);
                } else if (session.duration && session.duration > 0) {
                    // Convert seconds to duration object
                    const hours = Math.floor(session.duration / 3600);
                    const minutes = Math.floor((session.duration % 3600) / 60);
                    const seconds = session.duration % 60;
                    durationDisplay = formatDuration({ hours, minutes, seconds });
                } else {
                    durationDisplay = 'N/A';
                }
            }
        } else if (isActiveSession && session.timeStarted) {
            // Active session - user hasn't left yet, show N/A
            durationDisplay = 'N/A';
        } else if (!session.timeEnded || session.timeEnded === 'N/A') {
            // No timeEnded - user hasn't left, show N/A
            durationDisplay = 'N/A';
        }
        
        const row = document.createElement('tr');
        
        // CRITICAL: Ensure epsilon values are read properly with fallbacks
        const finalEpsilon = session.finalEpsilon && session.finalEpsilon !== 'N/A' 
            ? (typeof session.finalEpsilon === 'number' ? session.finalEpsilon.toFixed(1) : parseFloat(session.finalEpsilon).toFixed(1))
            : 'N/A';
        
        const firstEpsilon = session.firstEpsilon && session.firstEpsilon !== 'N/A'
            ? (typeof session.firstEpsilon === 'number' ? session.firstEpsilon.toFixed(1) : parseFloat(session.firstEpsilon).toFixed(1))
            : 'N/A';
        
        const epsilonChanges = session.epsilonChanges !== undefined && session.epsilonChanges !== null
            ? session.epsilonChanges
            : 0;
        
        row.innerHTML = `
            <td>${session.participant || 'N/A'}</td>
            <td>${session.date || 'N/A'}</td>
            <td>${session.timeStarted || 'N/A'}</td>
            <td>${session.timeEnded || 'N/A'}</td>
            <td>${session.userId || 'N/A'}</td>
            <td>${durationDisplay}</td>
            <td>${epsilonChanges}</td>
            <td>${firstEpsilon}</td>
            <td>${finalEpsilon}</td>
            <td>
                <div class="consent-form-cell">
                    <span class="status-icon ${session.consentCompleted ? 'status-completed' : 'status-incomplete'}">
                        <i class="fas ${session.consentCompleted ? 'fa-check' : 'fa-times'}"></i>
                    </span>
                    ${session.consentCompleted ? `
                        <div class="download-dropdown">
                            <button class="download-btn" onclick="toggleDownloadMenu(event, 'consent-${session.participant}')">
                                <i class="fas fa-download"></i>
                            </button>
                            <div class="download-menu" id="download-menu-consent-${session.participant}">
                                <button class="download-option" onclick="downloadConsentForm(${session.participant}, 'docx', '${session.userId}', '${session.date}')">
                                    <i class="fas fa-file-word"></i>
                                    <span>Download as Word</span>
                                </button>
                                <button class="download-option" onclick="downloadConsentForm(${session.participant}, 'pdf', '${session.userId}', '${session.date}')">
                                    <i class="fas fa-file-pdf"></i>
                                    <span>Download as PDF</span>
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </td>
            <td>
                <div class="privacy-form-cell">
                    <span class="status-icon ${session.privacyCompleted ? 'status-completed' : 'status-incomplete'}">
                        <i class="fas ${session.privacyCompleted ? 'fa-check' : 'fa-times'}"></i>
                    </span>
                    ${session.privacyCompleted ? `
                        <div class="download-dropdown">
                            <button class="download-btn" onclick="toggleDownloadMenu(event, ${session.participant})">
                                <i class="fas fa-download"></i>
                            </button>
                            <div class="download-menu" id="download-menu-${session.participant}">
                                <button class="download-option" onclick="downloadPrivacyForm(${session.participant}, 'docx', '${session.userId}', '${session.date}')">
                                    <i class="fas fa-file-word"></i>
                                    <span>Download as Word</span>
                                </button>
                                <button class="download-option" onclick="downloadPrivacyForm(${session.participant}, 'pdf', '${session.userId}', '${session.date}')">
                                    <i class="fas fa-file-pdf"></i>
                                    <span>Download as PDF</span>
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Filter sessions by time period
// Note: Sessions should already be deduplicated before filtering
function filterSessions(sessions, filterType) {
    if (!sessions || sessions.length === 0) {
        return [];
    }
    
    // Ensure sessions are deduplicated before filtering
    const deduplicatedSessions = deduplicateSessions(sessions);
    
    const today = new Date();
    const currentDate = '22/10/25'; // Current date based on your requirement
    
    switch(filterType) {
        case 'today':
            return deduplicatedSessions.filter(s => s.date === currentDate);
        case 'week':
            // Filter sessions from the past week (days 15-22)
            return deduplicatedSessions.filter(s => {
                const day = parseInt(s.date.split('/')[0]);
                return day >= 15 && day <= 22;
            });
        case 'month':
            // All sessions in October
            return deduplicatedSessions;
        case 'all':
        default:
            return deduplicatedSessions;
    }
}

// Deduplicate sessions by userId - ensures 1 user = 1 entry
// Prioritizes completed sessions, then most recent
function deduplicateSessions(sessions) {
    const userIdMap = new Map();
    
    sessions.forEach(session => {
        const userId = session.userId;
        if (!userId) return; // Skip sessions without userId
        
        const existing = userIdMap.get(userId);
        
        if (!existing) {
            // First entry for this userId
            userIdMap.set(userId, session);
        } else {
            // Decide which entry to keep
            const existingCompleted = existing.consentCompleted && existing.privacyCompleted;
            const currentCompleted = session.consentCompleted && session.privacyCompleted;
            
            if (currentCompleted && !existingCompleted) {
                // Current is completed, existing is not - keep current
                userIdMap.set(userId, session);
            } else if (!currentCompleted && existingCompleted) {
                // Existing is completed, current is not - keep existing
                // Do nothing, keep existing
            } else {
                // Both same completion status - keep most recent
                const existingTime = existing.timeStarted || existing.date || '';
                const currentTime = session.timeStarted || session.date || '';
                if (currentTime > existingTime) {
                    userIdMap.set(userId, session);
                }
            }
        }
    });
    
    return Array.from(userIdMap.values());
}

// Clean up duplicate sessions in localStorage
function cleanupDuplicateSessions() {
    const sessions = getSessionsFromStorage();
    const originalCount = sessions.length;
    
    // Deduplicate by userId
    const deduplicated = deduplicateSessions(sessions);
    
    if (deduplicated.length < originalCount) {
        console.log(`[Cleanup] Removed ${originalCount - deduplicated.length} duplicate session(s)`);
        saveSessionsToStorage(deduplicated);
        return true; // Cleanup was performed
    }
    
    return false; // No cleanup needed
}

// Update session table with real data
function updateSessionTable() {
    // First, clean up any existing duplicates in localStorage
    cleanupDuplicateSessions();
    
    // Get sessions from Firestore cache (real-time data from ALL participants) + localStorage backup
    let sessions = getSessionsFromStorage();
    
    // Also merge in Firestore cache data (prioritize Firestore as source of truth)
    if (firestoreDataCache.sessions && firestoreDataCache.sessions.length > 0) {
        // Combine localStorage and Firestore, then deduplicate
        const firestoreSessions = firestoreDataCache.sessions.map(s => {
            // Ensure userId is set from document ID if needed
            if (!s.userId && s.data?.userId) {
                s.userId = s.data.userId;
            }
            return s;
        });
        sessions = [...sessions, ...firestoreSessions];
    }
    
    // CRITICAL: Deduplicate by userId to ensure 1 user = 1 entry
    sessions = deduplicateSessions(sessions);
    
    console.log('[Logs Page] Total sessions after deduplication:', sessions.length);
    
    // Show ALL sessions (both completed and incomplete) for real-time tracking
    // This allows the logs table to show users as they enter, even before completing forms
    // Deduplication ensures 1 user = 1 row
    const allSessions = sessions; // Already deduplicated
    
    // Separate completed and incomplete for display
    const completedSessions = allSessions.filter(s => 
        s.consentCompleted === true && 
        s.privacyCompleted === true
    );
    
    const incompleteSessions = allSessions.filter(s => 
        !(s.consentCompleted === true && s.privacyCompleted === true)
    );
    
    // Show all sessions (completed first, then incomplete)
    const displaySessions = [...completedSessions, ...incompleteSessions];
    
    console.log('[Logs Page] All sessions (deduplicated):', {
        total: displaySessions.length,
        completed: completedSessions.length,
        incomplete: incompleteSessions.length
    });
    
    // Sort by sessionId (timestamp) or date and time (most recent first)
    displaySessions.sort((a, b) => {
        // First try to sort by sessionId if it's a numeric timestamp
        if (a.sessionId && b.sessionId) {
            const idA = parseInt(a.sessionId);
            const idB = parseInt(b.sessionId);
            if (!isNaN(idA) && !isNaN(idB)) {
                return idB - idA; // Descending order (newest first)
            }
        }
        
        // Fallback to sorting by date and time
        try {
            // Parse date (format: DD/MM/YYYY) and time
            const parseDate = (dateStr, timeStr) => {
                if (!dateStr || !timeStr) return 0;
                const [day, month, year] = dateStr.split('/');
                const timeParts = timeStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
                if (!timeParts) return 0;
                let hours = parseInt(timeParts[1]);
                const minutes = parseInt(timeParts[2]);
                const seconds = parseInt(timeParts[3]);
                const ampm = timeParts[4].toUpperCase();
                
                if (ampm === 'PM' && hours !== 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                
                return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
            };
            
            const timeA = parseDate(a.date, a.timeStarted);
            const timeB = parseDate(b.date, b.timeStarted);
            
            // If timeEnded exists, use that for more accurate sorting
            if (a.timeEnded && b.timeEnded) {
                const endTimeA = parseDate(a.date, a.timeEnded);
                const endTimeB = parseDate(b.date, b.timeEnded);
                if (endTimeA && endTimeB) {
                    return endTimeB - endTimeA; // Descending order (newest first)
                }
            }
            
            return timeB - timeA; // Descending order (newest first)
        } catch (e) {
            // If parsing fails, keep original order
            return 0;
        }
    });
    
    // Renumber participants (only for completed sessions)
    completedSessions.forEach((session, index) => {
        session.participant = index + 1;
    });
    
    // Initial render - show all sessions (completed + incomplete)
    renderSessionTable(displaySessions);
    
    // Setup filter
    const filterDropdown = document.getElementById('time-filter');
    if (filterDropdown) {
        filterDropdown.addEventListener('change', function() {
            // Use all deduplicated sessions for filtering
            const filtered = filterSessions(displaySessions, this.value);
            renderSessionTable(filtered);
        });
    }
    
    // Set up real-time updates for active session duration and Firestore data
    if (typeof window.logsUpdateInterval !== 'undefined') {
        clearInterval(window.logsUpdateInterval);
    }
    
    window.logsUpdateInterval = setInterval(() => {
        // Only update if logs page is active
        const logsPage = document.getElementById('logs-page');
        if (logsPage && logsPage.classList.contains('active')) {
            // Check if any download menus are open - if so, don't re-render to preserve state
            const openMenus = document.querySelectorAll('.download-menu.show');
            if (openMenus.length > 0) {
                // Skip update if menus are open to prevent blinking
                return;
            }
            
            // Get sessions from Firestore cache (real-time data from all participants)
            const currentSessions = getSessionsFromStorage();
            // Re-sort sessions
            currentSessions.sort((a, b) => {
                if (a.sessionId && b.sessionId) {
                    const idA = parseInt(a.sessionId);
                    const idB = parseInt(b.sessionId);
                    if (!isNaN(idA) && !isNaN(idB)) {
                        return idB - idA;
                    }
                }
                try {
                    const parseDate = (dateStr, timeStr) => {
                        if (!dateStr || !timeStr) return 0;
                        const [day, month, year] = dateStr.split('/');
                        const timeParts = timeStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
                        if (!timeParts) return 0;
                        let hours = parseInt(timeParts[1]);
                        const minutes = parseInt(timeParts[2]);
                        const seconds = parseInt(timeParts[3]);
                        const ampm = timeParts[4].toUpperCase();
                        if (ampm === 'PM' && hours !== 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
                    };
                    const timeA = parseDate(a.date, a.timeStarted);
                    const timeB = parseDate(b.date, b.timeStarted);
                    if (a.timeEnded && b.timeEnded) {
                        const endTimeA = parseDate(a.date, a.timeEnded);
                        const endTimeB = parseDate(b.date, b.timeEnded);
                        if (endTimeA && endTimeB) {
                            return endTimeB - endTimeA;
                        }
                    }
                    return timeB - timeA;
                } catch (e) {
                    return 0;
                }
            });
            
            // Renumber participants
            currentSessions.forEach((session, index) => {
                session.participant = index + 1;
            });
            
            // Apply current filter if any
            const filterDropdown = document.getElementById('time-filter');
            const filterValue = filterDropdown ? filterDropdown.value : 'all';
            const filtered = filterSessions(currentSessions, filterValue);
            renderSessionTable(filtered);
        }
    }, 1000); // Update every second
}

// Initialize session logs
function initializeSessionLogs() {
    updateSessionTable();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSessionLogs();
});
/* ===== Download Feature Functions ===== */

// Toggle download menu
function toggleDownloadMenu(event, participantId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    // Close all other open menus
    document.querySelectorAll('.download-menu').forEach(menu => {
        if (menu.id !== `download-menu-${participantId}` && menu.id !== `download-menu-consent-${participantId}`) {
            menu.classList.remove('show');
        }
    });
    
    // Toggle current menu - handle both consent and privacy menu IDs
    let menu = document.getElementById(`download-menu-${participantId}`);
    if (!menu) {
        menu = document.getElementById(`download-menu-consent-${participantId}`);
    }
    if (menu) {
        menu.classList.toggle('show');
    }
}

// Close dropdown when clicking outside (but not chart dropdowns)
document.addEventListener('click', function(event) {
    // Don't interfere with chart dropdowns
    if (event.target.closest('.chart-dropdown') || event.target.closest('.chart-dropdown-container')) {
        return;
    }
    
    if (!event.target.closest('.download-dropdown')) {
        document.querySelectorAll('.download-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

// Download privacy form function
function downloadPrivacyForm(participantId, format, userId, date) {
    console.log(`Downloading privacy form for Participant ${participantId} (${userId}) as ${format}`);
    
    // Get questionnaire data and completion time from session storage (participant-specific)
    let questionnaireData = {};
    let privacyCompletionTime = null;
    const sessions = getSessionsFromStorage();
    const session = sessions.find(s => s.userId === userId && s.consentCompleted && s.privacyCompleted);
    if (session) {
        if (session.questionnaireData) {
            questionnaireData = session.questionnaireData;
        } else {
            // Fallback to localStorage (for backward compatibility)
            questionnaireData = JSON.parse(localStorage.getItem('questionnaireData') || '{}');
        }
        if (session.privacyCompletedTime) {
            privacyCompletionTime = session.privacyCompletedTime;
        }
    } else {
        // Fallback to localStorage (for backward compatibility or current user)
        questionnaireData = JSON.parse(localStorage.getItem('questionnaireData') || '{}');
    }
    
    // Helper functions to map values to readable text
    const mapQ1Value = (val) => {
        const map = { '1': '1 (Very difficult)', '2': '2 (Difficult)', '3': '3 (Neutral)', '4': '4 (Easy)', '5': '5 (Very easy)' };
        return map[val] || val;
    };
    
    const mapQ2Value = (val) => {
        const map = { 'captcha': 'CAPTCHA frequency', 'ads': 'Ad targeting', 'latency': 'System latency', 'none': 'No changes noticed' };
        return map[val] || val;
    };
    
    const mapQ3Value = (val) => {
        const map = { 'captcha': 'CAPTCHA frequency', 'speed': 'System latency', 'ads': 'Ad targeting', 'curiosity': 'Curiosity' };
        return map[val] || val;
    };
    
    const mapQ4Value = (val) => {
        const map = { 'high-privacy': '0.1–1.5 (High Privacy)', 'medium': '1.6–3.0 (Medium Privacy)', 'low-privacy': '3.1–5.0 (Low Privacy)' };
        return map[val] || val;
    };
    
    const mapQ5Value = (val) => {
        const map = { '1': '1 (Not at all)', '2': '2 (Slightly)', '3': '3 (Moderately)', '4': '4 (Strongly)', '5': '5 (Very strongly)' };
        return map[val] || val;
    };
    
    const mapQ6Value = (val) => {
        const map = { 'strongly': 'Strongly influenced my decision', 'somewhat': 'Somewhat influenced my decision', 'not-at-all': 'Did not influence my decision' };
        return map[val] || val;
    };
    
    const mapQ7Value = (val) => {
        const map = { '1': '1 (Not satisfied)', '2': '2 (Slightly satisfied)', '3': '3 (Neutral)', '4': '4 (Satisfied)', '5': '5 (Very satisfied)' };
        return map[val] || val;
    };
    
    const mapQ8Value = (val) => {
        const map = { '1': '1 (Not at all)', '2': '2 (Slightly)', '3': '3 (Moderately)', '4': '4 (Mostly)', '5': '5 (Completely)' };
        return map[val] || val;
    };
    
    const mapQ9Value = (val) => {
        const map = { '1': '1 (Not willing at all)', '2': '2 (Slightly willing)', '3': '3 (Moderately willing)', '4': '4 (Willing)', '5': '5 (Very willing)' };
        return map[val] || val;
    };
    
    // Format Q3 (multiple selection)
    const formatQ3 = (factors) => {
        if (!factors || factors.length === 0) return 'None selected';
        return factors.map(f => mapQ3Value(f)).join(', ');
    };
    
    // Get selected values
    const q1Selected = questionnaireData.q1_understanding || '';
    const q2Selected = questionnaireData.q2_noticed || '';
    const q3Selected = questionnaireData.q3_factors || [];
    const q4Selected = questionnaireData.q4_preferred_range || '';
    const q5Selected = questionnaireData.q5_captcha_impact || '';
    const q6Selected = questionnaireData.q6_ad_influence || '';
    const q7Selected = questionnaireData.q7_ad_satisfaction || '';
    const q8Selected = questionnaireData.q8_perceived_protection || '';
    const q9Selected = questionnaireData.q9_willingness || '';
    const q10Answer = questionnaireData.q10_privacy_understanding || 'Not answered';
    const q11Answer = questionnaireData.q11_improvements || 'Not answered';
    const q12Answer = questionnaireData.q12_balance || 'Not answered';
    
    // Build complete form content with all questions, options, and selected answers
    const formContent = `
PRIVACY FORM - COMPLETE SUBMISSION RECORD
Research Study: Privacy Utility Tradeoff Dashboard

Participant ID: ${participantId}
User ID: ${userId}
Date: ${date}
${privacyCompletionTime ? `Completion Time: ${privacyCompletionTime}` : ''}
Generated: ${new Date().toLocaleString()}

═══════════════════════════════════════════════

QUESTIONNAIRE RESPONSES

─────────────────────────────────────────────────
QUESTION 1: How easy was it to understand what the ε (privacy budget) slider controlled in terms of privacy and system performance?

Available Options:
  ○ 1 (Very difficult)
  ○ 2 (Difficult)
  ○ 3 (Neutral)
  ○ 4 (Easy)
  ○ 5 (Very easy)

Selected Answer: ${q1Selected ? '✓ ' + mapQ1Value(q1Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 2: While adjusting the privacy level (ε) slider, which of the following changes did you notice most clearly?

Available Options:
  ○ CAPTCHA frequency
  ○ Ad targeting
  ○ System latency
  ○ No changes noticed

Selected Answer: ${q2Selected ? '✓ ' + mapQ2Value(q2Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 3: What factors most influenced your final chosen privacy level (ε)? (Select all that apply)

Available Options:
  ☐ CAPTCHA frequency
  ☐ System latency
  ☐ Ad targeting
  ☐ Curiosity

Selected Answer(s): ${q3Selected.length > 0 ? '✓ ' + formatQ3(q3Selected) : 'None selected'}

─────────────────────────────────────────────────
QUESTION 4: Which ε range best represents the final privacy level (ε) you selected at the end of your interaction with the privacy slider?

Available Options:
  ○ 0.1–1.5 (High Privacy)
  ○ 1.6–3.0 (Medium Privacy)
  ○ 3.1–5.0 (Low Privacy)

Selected Answer: ${q4Selected ? '✓ ' + mapQ4Value(q4Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 5: When the CAPTCHA frequency increased at higher privacy settings, how much did that affect your willingness to keep those settings?

Available Options:
  ○ 1 (Not at all)
  ○ 2 (Slightly)
  ○ 3 (Moderately)
  ○ 4 (Strongly)
  ○ 5 (Very strongly)

Selected Answer: ${q5Selected ? '✓ ' + mapQ5Value(q5Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 6: How much did the type or relevance of the sponsored ads you saw influence your decision to select your final privacy level (ε)?

Available Options:
  ○ Strongly influenced my decision
  ○ Somewhat influenced my decision
  ○ Did not influence my decision

Selected Answer: ${q6Selected ? '✓ ' + mapQ6Value(q6Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 7: How satisfied were you with the ad experience and the ads generated at the final privacy level (ε) you selected?

Available Options:
  ○ 1 (Not satisfied)
  ○ 2 (Slightly satisfied)
  ○ 3 (Neutral)
  ○ 4 (Satisfied)
  ○ 5 (Very satisfied)

Selected Answer: ${q7Selected ? '✓ ' + mapQ7Value(q7Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 8: To what extent did you feel that your final selected privacy level (ε) provided adequate protection against data collection or tracking, based on the ads you saw?

Available Options:
  ○ 1 (Not at all)
  ○ 2 (Slightly)
  ○ 3 (Moderately)
  ○ 4 (Mostly)
  ○ 5 (Completely)

Selected Answer: ${q8Selected ? '✓ ' + mapQ8Value(q8Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 9: How willing would you be to accept more CAPTCHAs and slower system performance to achieve stronger privacy protection?

Available Options:
  ○ 1 (Not willing at all)
  ○ 2 (Slightly willing)
  ○ 3 (Moderately willing)
  ○ 4 (Willing)
  ○ 5 (Very willing)

Selected Answer: ${q9Selected ? '✓ ' + mapQ9Value(q9Selected) : 'Not answered'}

═══════════════════════════════════════════════

OPEN-ENDED QUESTIONS

─────────────────────────────────────────────────
QUESTION 10: When using the Zynex dashboard, how did you understand the idea of 'privacy' in relation to adjusting the ε (epsilon) slider and observing its effects on ads, CAPTCHAs and system performance?

Participant's Response:
${q10Answer}

─────────────────────────────────────────────────
QUESTION 11: If you could improve how Zynex displays or explains its privacy settings (e.g., the ε slider, ad indicators, or CAPTCHA prompts), what would you change and why?

Participant's Response:
${q11Answer}

─────────────────────────────────────────────────
QUESTION 12: How did changes in privacy settings (ε) — such as slower performance, more CAPTCHAs, or less personalised ads — affect your sense of what was an acceptable balance between privacy and system performance?

Participant's Response:
${q12Answer}

═══════════════════════════════════════════════

CONFIRMATION

This document serves as a complete record of your privacy form submission
for the research study conducted in October 2025.

Consent Status: ✓ Completed
Privacy Form Status: ✓ Completed

All responses have been recorded and will be used for research purposes only.
    `;
    
    const privacyFormData = {
        participantId: participantId,
        userId: userId,
        date: date,
        completionTime: privacyCompletionTime,
        timestamp: new Date().toISOString(),
        title: 'Privacy Utility Tradeoff Research - Privacy Form',
        content: formContent
    };
    
    if (format === 'docx') {
        downloadAsWord(privacyFormData);
    } else if (format === 'pdf') {
        downloadAsPDF(privacyFormData);
    }
    
    // Close the dropdown menu
    const menu = document.getElementById(`download-menu-${participantId}`);
    if (menu) {
        menu.classList.remove('show');
    }
}

// Download as Word document
function downloadAsWord(data) {
    // Convert plain text content to HTML with proper formatting
    const formattedContent = data.content
        .replace(/\n/g, '<br>')
        .replace(/═══════════════════════════════════════════════/g, '<hr style="border: 2px solid #00ffff; margin: 20px 0;">')
        .replace(/─────────────────────────────────────────────────/g, '<hr style="border: 1px solid #ccc; margin: 15px 0;">')
        .replace(/✓/g, '<strong style="color: #00aa00;">✓</strong>')
        .replace(/QUESTION \d+:/g, '<h3 style="color: #00ffff; margin-top: 20px;">$&</h3>')
        .replace(/Available Options:/g, '<p style="font-weight: bold; margin-top: 10px;">$&</p>')
        .replace(/Selected Answer:/g, '<p style="font-weight: bold; color: #00aa00; margin-top: 10px;">$&</p>')
        .replace(/Participant's Response:/g, '<p style="font-weight: bold; margin-top: 10px;">$&</p>');
    
    // Create HTML content for Word document
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${data.title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    padding: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                    color: #333;
                }
                h1 {
                    color: #00ffff;
                    border-bottom: 3px solid #00ffff;
                    padding-bottom: 10px;
                }
                .metadata {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                h3 {
                    color: #00ffff;
                    margin-top: 25px;
                    margin-bottom: 10px;
                }
                p {
                    margin: 8px 0;
                }
                pre {
                    white-space: pre-wrap;
                    font-family: 'Courier New', monospace;
                    background: #f9f9f9;
                    padding: 20px;
                    border-left: 4px solid #00ffff;
                    line-height: 1.8;
                }
            </style>
        </head>
        <body>
            <h1>${data.title}</h1>
            <div class="metadata">
                <p><strong>Participant ID:</strong> ${data.participantId}</p>
                <p><strong>User ID:</strong> ${data.userId}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div>${formattedContent}</div>
        </body>
        </html>
    `;
    
    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Privacy_Form_${data.userId}_${data.date.replace(/\//g, '-')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`Downloaded as Word: Privacy_Form_${data.userId}_${data.date.replace(/\//g, '-')}.doc`);
}

// Download as PDF
function downloadAsPDF(data) {
    // Convert plain text content to HTML with proper formatting
    const formattedContent = data.content
        .replace(/\n/g, '<br>')
        .replace(/═══════════════════════════════════════════════/g, '<hr style="border: 2px solid #00ffff; margin: 20px 0;">')
        .replace(/─────────────────────────────────────────────────/g, '<hr style="border: 1px solid #ccc; margin: 15px 0;">')
        .replace(/✓/g, '<strong style="color: #00aa00; font-size: 1.1em;">✓</strong>')
        .replace(/QUESTION \d+:/g, '<h3 style="color: #00ffff; margin-top: 20px; font-size: 16px;">$&</h3>')
        .replace(/Available Options:/g, '<p style="font-weight: bold; margin-top: 10px; font-size: 13px;">$&</p>')
        .replace(/Selected Answer:/g, '<p style="font-weight: bold; color: #00aa00; margin-top: 10px; font-size: 13px; background: #f0fff0; padding: 5px;">$&</p>')
        .replace(/Participant's Response:/g, '<p style="font-weight: bold; margin-top: 10px; font-size: 13px;">$&</p>');
    
    // Create a printable HTML page
    const printWindow = window.open('', '_blank');
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${data.title}</title>
            <style>
                @page {
                    margin: 1in;
                }
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                    color: #333;
                }
                h1 {
                    color: #00ffff;
                    border-bottom: 3px solid #00ffff;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .metadata {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .metadata p {
                    margin: 5px 0;
                }
                h3 {
                    color: #00ffff;
                    margin-top: 25px;
                    margin-bottom: 10px;
                }
                p {
                    margin: 8px 0;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    .no-print {
                        display: none;
                    }
                    h1 {
                        color: #000;
                        border-bottom-color: #000;
                    }
                    h3 {
                        color: #000;
                    }
                }
            </style>
        </head>
        <body>
            <h1>${data.title}</h1>
            <div class="metadata">
                <p><strong>Participant ID:</strong> ${data.participantId}</p>
                <p><strong>User ID:</strong> ${data.userId}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div style="line-height: 1.8; font-size: 12px;">${formattedContent}</div>
            <div class="no-print" style="margin-top: 30px; text-align: center;">
                <button onclick="window.print();" style="padding: 10px 30px; font-size: 16px; cursor: pointer; background: #00ffff; border: none; border-radius: 5px;">
                    Print to PDF
                </button>
            </div>
            <script>
                // Auto-trigger print dialog after page loads
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    console.log(`Opening print dialog for PDF: Privacy_Form_${data.userId}_${data.date.replace(/\//g, '-')}.pdf`);
}


/* ===== Consent Form Download Functions ===== */

// Download consent form function
function downloadConsentForm(participantId, format, userId, date) {
    console.log(`Downloading consent form for Participant ${participantId} (${userId}) as ${format}`);
    
    // Get consent completion time from session (participant-specific)
    let consentCompletionTime = null;
    const sessions = getSessionsFromStorage();
    const session = sessions.find(s => s.userId === userId && s.consentCompleted && s.privacyCompleted);
    if (session && session.consentCompletedTime) {
        consentCompletionTime = session.consentCompletedTime;
    }
    
    // Create consent form content
    const consentFormData = {
        participantId: participantId,
        userId: userId,
        date: date,
        completionTime: consentCompletionTime,
        timestamp: new Date().toISOString(),
        title: 'Privacy Utility Tradeoff Research - Consent Form',
        content: `
CONSENT FORM
Research Study: Privacy Utility Tradeoff Dashboard

Participant ID: ${participantId}
User ID: ${userId}
Date: ${date}
${consentCompletionTime ? `Completion Time: ${consentCompletionTime}` : ''}
Generated: ${new Date().toLocaleString()}

═══════════════════════════════════════════════

INFORMED CONSENT FOR RESEARCH PARTICIPATION

Study Title: Exploring User Decisions in Privacy-Utility Trade-offs with the 
            Zynex Dashboard

Principal Investigator: Kyle Ng
Institution: University College London (UCL)
Department: Security and Crime Science Research (SECU0053)

═══════════════════════════════════════════════

SECTION 1: STUDY PURPOSE

This research investigates how users make decisions when adjusting privacy 
parameters (epsilon) in the context of differential privacy. The study examines 
behavioral patterns and biases in privacy choices while analyzing how different 
consequences (performance, CAPTCHA frequency, ad relevance) influence decisions.

SECTION 2: WHAT YOUR PARTICIPATION INVOLVES

As a participant, you will:
• Use the Zynex interactive dashboard
• Adjust privacy budget (epsilon) parameters
• Make trade-off decisions between privacy and utility
• Have your interaction patterns recorded for analysis
• Spend approximately 15-45 minutes on the study

SECTION 3: DATA COLLECTION

The following data will be collected during your session:
• Epsilon parameter selections
• Decision timing and frequency
• Trade-off preferences
• Session duration and activity logs
• Anonymous user identifier (${userId})

SECTION 4: CONFIDENTIALITY AND DATA PROTECTION

• All data is anonymized and stored securely
• Your personal information is protected under GDPR
• Data will be used solely for research purposes
• Results will be published in aggregate form only
• Individual participants will not be identifiable

SECTION 5: YOUR RIGHTS AS A PARTICIPANT

You have the right to:
• Withdraw from the study at any time without penalty
• Request deletion of your data
• Access your collected data
• Ask questions about the research
• Receive information about study results

SECTION 6: RISKS AND BENEFITS

Risks: Minimal. You may experience minor inconvenience from CAPTCHA 
       challenges or adjusted system performance.

Benefits: Contributing to privacy research that may inform better privacy 
         tools and policies.

SECTION 7: CONSENT STATEMENT

By completing this form, I confirm that:

✓ I have read and understood the study information
✓ I have had the opportunity to ask questions
✓ I understand my participation is voluntary
✓ I understand I can withdraw at any time
✓ I consent to the collection and use of my data as described
✓ I understand my data will be anonymized and stored securely

═══════════════════════════════════════════════

CONTACT INFORMATION

For questions or concerns about this research:

Principal Investigator: Kyle Ng
Email: [contact information]
Department: Security and Crime Science Research
Institution: University College London (UCL)
Project Code: SECU0053

For questions about your rights as a research participant:
UCL Research Ethics Committee
[contact information]

═══════════════════════════════════════════════

PARTICIPANT CONFIRMATION

Participant ID: ${participantId}
User ID: ${userId}
Consent Date: ${date}
Consent Status: CONFIRMED

This document serves as proof of informed consent for participation 
in the Privacy Utility Tradeoff research study conducted at UCL 
in October 2025.

═══════════════════════════════════════════════
        `
    };
    
    if (format === 'docx') {
        downloadConsentAsWord(consentFormData);
    } else if (format === 'pdf') {
        downloadConsentAsPDF(consentFormData);
    }
    
    // Close the dropdown menu
    const menu = document.getElementById(`download-menu-consent-${participantId}`);
    if (menu) {
        menu.classList.remove('show');
    }
}

// Download consent as Word document
function downloadConsentAsWord(data) {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${data.title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    padding: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    color: #00ffff;
                    border-bottom: 3px solid #00ffff;
                    padding-bottom: 10px;
                }
                .metadata {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                pre {
                    white-space: pre-wrap;
                    font-family: 'Courier New', monospace;
                    background: #f9f9f9;
                    padding: 20px;
                    border-left: 4px solid #00ffff;
                }
            </style>
        </head>
        <body>
            <h1>${data.title}</h1>
            <div class="metadata">
                <p><strong>Participant ID:</strong> ${data.participantId}</p>
                <p><strong>User ID:</strong> ${data.userId}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <pre>${data.content}</pre>
        </body>
        </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Consent_Form_${data.userId}_${data.date.replace(/\//g, '-')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`Downloaded as Word: Consent_Form_${data.userId}_${data.date.replace(/\//g, '-')}.doc`);
}

// Download consent as PDF
function downloadConsentAsPDF(data) {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${data.title}</title>
            <style>
                @page {
                    margin: 1in;
                }
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                    color: #333;
                }
                h1 {
                    color: #00ffff;
                    border-bottom: 3px solid #00ffff;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .metadata {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .metadata p {
                    margin: 5px 0;
                }
                pre {
                    white-space: pre-wrap;
                    font-family: 'Courier New', monospace;
                    background: #f9f9f9;
                    padding: 20px;
                    border-left: 4px solid #00ffff;
                    font-size: 12px;
                    line-height: 1.5;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <h1>${data.title}</h1>
            <div class="metadata">
                <p><strong>Participant ID:</strong> ${data.participantId}</p>
                <p><strong>User ID:</strong> ${data.userId}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <pre>${data.content}</pre>
            <div class="no-print" style="margin-top: 30px; text-align: center;">
                <button onclick="window.print();" style="padding: 10px 30px; font-size: 16px; cursor: pointer; background: #00ffff; border: none; border-radius: 5px;">
                    Print to PDF
                </button>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    console.log(`Opening print dialog for PDF: Consent_Form_${data.userId}_${data.date.replace(/\//g, '-')}.pdf`);
}

/* ===== Activity View Button Download Functions ===== */

// Download consent form from activity view button
function downloadConsentFormFromActivity() {
    console.log('downloadConsentFormFromActivity called');
    
    // Create format selection dialog
    const formatDialog = document.createElement('div');
    formatDialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    const dialogContent = document.createElement('div');
    dialogContent.style.cssText = `
        background: #1a1a1a;
        border: 2px solid #00ffff;
        border-radius: 12px;
        padding: 30px;
        text-align: center;
        min-width: 300px;
    `;
    
    dialogContent.innerHTML = `
        <h3 style="color: #00ffff; margin-bottom: 20px;">Select Download Format</h3>
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="format-pdf" style="
                background: linear-gradient(90deg, #00ffff 0%, #007bff 100%);
                color: white;
                border: none;
                padding: 12px 25px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
            ">PDF</button>
            <button id="format-docx" style="
                background: linear-gradient(90deg, #00ffff 0%, #007bff 100%);
                color: white;
                border: none;
                padding: 12px 25px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
            ">DOCX</button>
        </div>
    `;
    
    formatDialog.appendChild(dialogContent);
    document.body.appendChild(formatDialog);
    
    // Handle format selection
    const pdfBtn = document.getElementById('format-pdf');
    const docxBtn = document.getElementById('format-docx');
    
    const selectFormat = (format) => {
        document.body.removeChild(formatDialog);
        proceedWithDownload(format);
    };
    
    pdfBtn.addEventListener('click', () => selectFormat('pdf'));
    docxBtn.addEventListener('click', () => selectFormat('docx'));
    
    // Close on background click
    formatDialog.addEventListener('click', (e) => {
        if (e.target === formatDialog) {
            document.body.removeChild(formatDialog);
        }
    });
    
    function proceedWithDownload(format) {
        const userId = generateUserId();
        const date = new Date().toLocaleDateString('en-US');
        const participantId = `P-${userId}`;
        
        // Get completion time
        const completionTime = completionStatus.consentCompletedTime || new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Show feedback
        const btn = document.getElementById('consent-view-btn');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Preparing download...';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 2000);
        }
        
        // Create consent form content with user's actual confirmation
        const consentFormData = {
        participantId: participantId,
        userId: userId,
        date: date,
        timestamp: new Date().toISOString(),
        title: 'Privacy Utility Tradeoff Research - Consent Form',
        format: format,
        content: `
CONSENT FORM
Research Study: Privacy Utility Tradeoff Dashboard

Participant ID: ${participantId}
User ID: ${userId}
Date: ${date}
Completion Time: ${completionTime}
Generated: ${new Date().toLocaleString()}

═══════════════════════════════════════════════

INFORMED CONSENT FOR RESEARCH PARTICIPATION

Study Title: Exploring User Decisions in Privacy-Utility Trade-offs with the 
            Zynex Dashboard

Principal Investigator: Kyle Ng
Institution: University College London (UCL)
Department: Security and Crime Science Research (SECU0053)

═══════════════════════════════════════════════

SECTION 1: STUDY PURPOSE

This research investigates how users make decisions when adjusting privacy 
parameters (epsilon) in the context of differential privacy. The study examines 
behavioral patterns and biases in privacy choices while analyzing how different 
consequences (performance, CAPTCHA frequency, ad relevance) influence decisions.

SECTION 2: WHAT YOUR PARTICIPATION INVOLVES

As a participant, you will:
• Use the Zynex interactive dashboard
• Adjust privacy budget (epsilon) parameters
• Make trade-off decisions between privacy and utility
• Have your interaction patterns recorded for analysis
• Spend approximately 15-45 minutes on the study

SECTION 3: DATA COLLECTION

The following data will be collected during your session:
• Epsilon parameter selections
• Decision timing and frequency
• Trade-off preferences
• Session duration and activity logs
• Anonymous user identifier (${userId})

SECTION 4: CONFIDENTIALITY AND DATA PROTECTION

• All data is anonymized and stored securely
• Your personal information is protected under GDPR
• Data will be used solely for research purposes
• Results will be published in aggregate form only
• Individual participants will not be identifiable

SECTION 5: YOUR RIGHTS AS A PARTICIPANT

You have the right to:
• Withdraw from the study at any time without penalty
• Request deletion of your data
• Access your collected data
• Ask questions about the research
• Receive information about study results

SECTION 6: RISKS AND BENEFITS

Risks: Minimal. You may experience minor inconvenience from CAPTCHA 
       challenges or adjusted system performance.

Benefits: Contributing to privacy research that may inform better privacy 
         tools and policies.

SECTION 7: CONSENT STATEMENT

By completing this form, I confirm that:

✓ I have read and understood the study information
✓ I have had the opportunity to ask questions
✓ I understand my participation is voluntary
✓ I understand I can withdraw at any time
✓ I consent to the collection and use of my data as described
✓ I understand my data will be anonymized and stored securely

═══════════════════════════════════════════════

CONTACT INFORMATION

For questions or concerns about this research:

Principal Investigator: Kyle Ng
Email: [contact information]
Department: Security and Crime Science Research
Institution: University College London (UCL)
Project Code: SECU0053

For questions about your rights as a research participant:
UCL Research Ethics Committee
[contact information]

═══════════════════════════════════════════════

PARTICIPANT CONFIRMATION

Participant ID: ${participantId}
User ID: ${userId}
Consent Date: ${date}
Consent Time: ${completionTime}
Consent Status: CONFIRMED

This document serves as proof of informed consent for participation 
in the Privacy Utility Tradeoff research study conducted at UCL 
in October 2025.

═══════════════════════════════════════════════
        `
    };
    
        if (format === 'pdf') {
            downloadConsentAsPDF(consentFormData);
        } else {
            downloadConsentAsDOCX(consentFormData);
        }
    }
    
    // Call the function immediately with the format parameter
    proceedWithDownload(format);
}

// Download consent form as DOCX
function downloadConsentAsDOCX(data) {
    // Convert plain text content to HTML with proper formatting (same as downloadAsWord)
    const formattedContent = data.content
        .replace(/\n/g, '<br>')
        .replace(/═══════════════════════════════════════════════/g, '<hr style="border: 2px solid #00ffff; margin: 20px 0;">')
        .replace(/─────────────────────────────────────────────────/g, '<hr style="border: 1px solid #ccc; margin: 15px 0;">')
        .replace(/✓/g, '<strong style="color: #00aa00;">✓</strong>')
        .replace(/SECTION \d+:/g, '<h3 style="color: #00ffff; margin-top: 20px;">$&</h3>');
    
    // Create HTML content for Word document (same format as downloadAsWord)
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${data.title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    padding: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                    color: #333;
                }
                h1 {
                    color: #00ffff;
                    border-bottom: 3px solid #00ffff;
                    padding-bottom: 10px;
                }
                .metadata {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                h3 {
                    color: #00ffff;
                    margin-top: 25px;
                    margin-bottom: 10px;
                }
                p {
                    margin: 8px 0;
                }
                pre {
                    white-space: pre-wrap;
                    font-family: 'Courier New', monospace;
                    background: #f9f9f9;
                    padding: 20px;
                    border-left: 4px solid #00ffff;
                    line-height: 1.8;
                }
            </style>
        </head>
        <body>
            <h1>${data.title}</h1>
            <div class="metadata">
                <p><strong>Participant ID:</strong> ${data.participantId}</p>
                <p><strong>User ID:</strong> ${data.userId}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                ${data.completionTime ? `<p><strong>Completion Time:</strong> ${data.completionTime}</p>` : ''}
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div>${formattedContent}</div>
        </body>
        </html>
    `;
    
    // Create blob and download (using .doc extension and msword MIME type like downloadAsWord)
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Consent_Form_${data.userId}_${data.date.replace(/\//g, '-')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`Downloaded as Word: Consent_Form_${data.userId}_${data.date.replace(/\//g, '-')}.doc`);
}

// Download privacy form from activity dropdown (called from dropdown menu)
function downloadPrivacyFormFromActivityDropdown(format) {
    console.log('downloadPrivacyFormFromActivityDropdown called with format:', format);
    
    // Close the dropdown menu
    const menu = document.getElementById('download-menu-privacy-activity');
    if (menu) {
        menu.classList.remove('show');
    }
    
    function proceedWithDownload(format) {
        const userId = generateUserId();
        const date = new Date().toLocaleDateString('en-US');
        const participantId = `P-${userId}`;
        
        // Get completion time
        const completionTime = completionStatus.privacyCompletedTime || new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Show feedback (optional - can remove if not needed)
        console.log('Preparing privacy form download...');
        
        // Get questionnaire data from localStorage (for current user in activity view)
        const questionnaireData = JSON.parse(localStorage.getItem('questionnaireData') || '{}');
        
        // Helper functions to map values to readable text (same as downloadPrivacyForm from logs page)
        const mapQ1Value = (val) => {
            const map = { '1': '1 (Very difficult)', '2': '2 (Difficult)', '3': '3 (Neutral)', '4': '4 (Easy)', '5': '5 (Very easy)' };
            return map[val] || val;
        };
        
        const mapQ2Value = (val) => {
            const map = { 'captcha': 'CAPTCHA frequency', 'ads': 'Ad targeting', 'latency': 'System latency', 'none': 'No changes noticed' };
            return map[val] || val;
        };
        
        const mapQ3Value = (val) => {
            const map = { 'captcha': 'CAPTCHA frequency', 'speed': 'System latency', 'ads': 'Ad targeting', 'curiosity': 'Curiosity' };
            return map[val] || val;
        };
        
        const mapQ4Value = (val) => {
            const map = { 'high-privacy': '0.1–1.5 (High Privacy)', 'medium': '1.6–3.0 (Medium Privacy)', 'low-privacy': '3.1–5.0 (Low Privacy)' };
            return map[val] || val;
        };
        
        const mapQ5Value = (val) => {
            const map = { '1': '1 (Not at all)', '2': '2 (Slightly)', '3': '3 (Moderately)', '4': '4 (Strongly)', '5': '5 (Very strongly)' };
            return map[val] || val;
        };
        
        const mapQ6Value = (val) => {
            const map = { 'strongly': 'Strongly influenced my decision', 'somewhat': 'Somewhat influenced my decision', 'not-at-all': 'Did not influence my decision' };
            return map[val] || val;
        };
        
        const mapQ7Value = (val) => {
            const map = { '1': '1 (Not satisfied)', '2': '2 (Slightly satisfied)', '3': '3 (Neutral)', '4': '4 (Satisfied)', '5': '5 (Very satisfied)' };
            return map[val] || val;
        };
        
        const mapQ8Value = (val) => {
            const map = { '1': '1 (Not at all)', '2': '2 (Slightly)', '3': '3 (Moderately)', '4': '4 (Mostly)', '5': '5 (Completely)' };
            return map[val] || val;
        };
        
        const mapQ9Value = (val) => {
            const map = { '1': '1 (Not willing at all)', '2': '2 (Slightly willing)', '3': '3 (Moderately willing)', '4': '4 (Willing)', '5': '5 (Very willing)' };
            return map[val] || val;
        };
        
        // Format Q3 (multiple selection)
        const formatQ3 = (factors) => {
            if (!factors || factors.length === 0) return 'None selected';
            return factors.map(f => mapQ3Value(f)).join(', ');
        };
        
        // Get selected values
        const q1Selected = questionnaireData.q1_understanding || '';
        const q2Selected = questionnaireData.q2_noticed || '';
        const q3Selected = questionnaireData.q3_factors || [];
        const q4Selected = questionnaireData.q4_preferred_range || '';
        const q5Selected = questionnaireData.q5_captcha_impact || '';
        const q6Selected = questionnaireData.q6_ad_influence || '';
        const q7Selected = questionnaireData.q7_ad_satisfaction || '';
        const q8Selected = questionnaireData.q8_perceived_protection || '';
        const q9Selected = questionnaireData.q9_willingness || '';
        const q10Answer = questionnaireData.q10_privacy_understanding || 'Not answered';
        const q11Answer = questionnaireData.q11_improvements || 'Not answered';
        const q12Answer = questionnaireData.q12_balance || 'Not answered';
        
        // Build complete form content with all questions, options, and selected answers (same as downloadPrivacyForm from logs page)
        const formContent = `
PRIVACY FORM - COMPLETE SUBMISSION RECORD
Research Study: Privacy Utility Tradeoff Dashboard

Participant ID: ${participantId}
User ID: ${userId}
Date: ${date}
Completion Time: ${completionTime}
Generated: ${new Date().toLocaleString()}

═══════════════════════════════════════════════

QUESTIONNAIRE RESPONSES

─────────────────────────────────────────────────
QUESTION 1: How easy was it to understand what the ε (privacy budget) slider controlled in terms of privacy and system performance?

Available Options:
  ○ 1 (Very difficult)
  ○ 2 (Difficult)
  ○ 3 (Neutral)
  ○ 4 (Easy)
  ○ 5 (Very easy)

Selected Answer: ${q1Selected ? '✓ ' + mapQ1Value(q1Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 2: While adjusting the privacy level (ε) slider, which of the following changes did you notice most clearly?

Available Options:
  ○ CAPTCHA frequency
  ○ Ad targeting
  ○ System latency
  ○ No changes noticed

Selected Answer: ${q2Selected ? '✓ ' + mapQ2Value(q2Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 3: What factors most influenced your final chosen privacy level (ε)? (Select all that apply)

Available Options:
  ☐ CAPTCHA frequency
  ☐ System latency
  ☐ Ad targeting
  ☐ Curiosity

Selected Answer(s): ${q3Selected.length > 0 ? '✓ ' + formatQ3(q3Selected) : 'None selected'}

─────────────────────────────────────────────────
QUESTION 4: Which ε range best represents the final privacy level (ε) you selected at the end of your interaction with the privacy slider?

Available Options:
  ○ 0.1–1.5 (High Privacy)
  ○ 1.6–3.0 (Medium Privacy)
  ○ 3.1–5.0 (Low Privacy)

Selected Answer: ${q4Selected ? '✓ ' + mapQ4Value(q4Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 5: When the CAPTCHA frequency increased at higher privacy settings, how much did that affect your willingness to keep those settings?

Available Options:
  ○ 1 (Not at all)
  ○ 2 (Slightly)
  ○ 3 (Moderately)
  ○ 4 (Strongly)
  ○ 5 (Very strongly)

Selected Answer: ${q5Selected ? '✓ ' + mapQ5Value(q5Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 6: How much did the type or relevance of the sponsored ads you saw influence your decision to select your final privacy level (ε)?

Available Options:
  ○ Strongly influenced my decision
  ○ Somewhat influenced my decision
  ○ Did not influence my decision

Selected Answer: ${q6Selected ? '✓ ' + mapQ6Value(q6Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 7: How satisfied were you with the ad experience and the ads generated at the final privacy level (ε) you selected?

Available Options:
  ○ 1 (Not satisfied)
  ○ 2 (Slightly satisfied)
  ○ 3 (Neutral)
  ○ 4 (Satisfied)
  ○ 5 (Very satisfied)

Selected Answer: ${q7Selected ? '✓ ' + mapQ7Value(q7Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 8: To what extent did you feel that your final selected privacy level (ε) provided adequate protection against data collection or tracking, based on the ads you saw?

Available Options:
  ○ 1 (Not at all)
  ○ 2 (Slightly)
  ○ 3 (Moderately)
  ○ 4 (Mostly)
  ○ 5 (Completely)

Selected Answer: ${q8Selected ? '✓ ' + mapQ8Value(q8Selected) : 'Not answered'}

─────────────────────────────────────────────────
QUESTION 9: How willing would you be to accept more CAPTCHAs and slower system performance to achieve stronger privacy protection?

Available Options:
  ○ 1 (Not willing at all)
  ○ 2 (Slightly willing)
  ○ 3 (Moderately willing)
  ○ 4 (Willing)
  ○ 5 (Very willing)

Selected Answer: ${q9Selected ? '✓ ' + mapQ9Value(q9Selected) : 'Not answered'}

═══════════════════════════════════════════════

OPEN-ENDED QUESTIONS

─────────────────────────────────────────────────
QUESTION 10: When using the Zynex dashboard, how did you understand the idea of 'privacy' in relation to adjusting the ε (epsilon) slider and observing its effects on ads, CAPTCHAs and system performance?

Participant's Response:
${q10Answer}

─────────────────────────────────────────────────
QUESTION 11: If you could improve how Zynex displays or explains its privacy settings (e.g., the ε slider, ad indicators, or CAPTCHA prompts), what would you change and why?

Participant's Response:
${q11Answer}

─────────────────────────────────────────────────
QUESTION 12: How did changes in privacy settings (ε) — such as slower performance, more CAPTCHAs, or less personalised ads — affect your sense of what was an acceptable balance between privacy and system performance?

Participant's Response:
${q12Answer}

═══════════════════════════════════════════════

CONFIRMATION

This document serves as a complete record of your privacy form submission
for the research study conducted in October 2025.

Consent Status: ✓ Completed
Privacy Form Status: ✓ Completed

All responses have been recorded and will be used for research purposes only.
        `;
        
        const privacyFormData = {
            participantId: participantId,
            userId: userId,
            date: date,
            completionTime: completionTime,
            timestamp: new Date().toISOString(),
            title: 'Privacy Utility Tradeoff Research - Privacy Form',
            content: formContent
        };
        
        if (format === 'pdf') {
            downloadPrivacyAsPDF(privacyFormData);
        } else {
            downloadPrivacyAsDOCX(privacyFormData);
        }
    }
    
    // Call the function immediately with the format parameter
    proceedWithDownload(format);
}

// Function to download consent form from activity dropdown
function downloadConsentFormFromActivityDropdown(format) {
    console.log('downloadConsentFormFromActivityDropdown called with format:', format);
    
    // Close the dropdown menu
    const menu = document.getElementById('download-menu-consent-activity');
    if (menu) {
        menu.classList.remove('show');
    }
    
    const userId = generateUserId();
    const date = new Date().toLocaleDateString('en-US');
    const participantId = `P-${userId}`;
    
    // Get completion time
    const completionTime = completionStatus.consentCompletedTime || new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Create consent form content (same as downloadConsentForm from logs page)
    const consentFormData = {
        participantId: participantId,
        userId: userId,
        date: date,
        completionTime: completionTime,
        timestamp: new Date().toISOString(),
        title: 'Privacy Utility Tradeoff Research - Consent Form',
        content: `
CONSENT FORM
Research Study: Privacy Utility Tradeoff Dashboard

Participant ID: ${participantId}
User ID: ${userId}
Date: ${date}
Completion Time: ${completionTime}
Generated: ${new Date().toLocaleString()}

═══════════════════════════════════════════════

INFORMED CONSENT FOR RESEARCH PARTICIPATION

Study Title: Exploring User Decisions in Privacy-Utility Trade-offs with the 
            Zynex Dashboard

Principal Investigator: Kyle Ng
Institution: University College London (UCL)
Department: Security and Crime Science Research (SECU0053)

═══════════════════════════════════════════════

SECTION 1: STUDY PURPOSE

This research investigates how users make decisions when adjusting privacy 
parameters (epsilon) in the context of differential privacy. The study examines 
behavioral patterns and biases in privacy choices while analyzing how different 
consequences (performance, CAPTCHA frequency, ad relevance) influence decisions.

SECTION 2: WHAT YOUR PARTICIPATION INVOLVES

As a participant, you will:
• Use the Zynex interactive dashboard
• Adjust privacy budget (epsilon) parameters
• Make trade-off decisions between privacy and utility
• Have your interaction patterns recorded for analysis
• Spend approximately 15-45 minutes on the study

SECTION 3: DATA COLLECTION

The following data will be collected during your session:
• Epsilon parameter selections
• Decision timing and frequency
• Trade-off preferences
• Session duration and activity logs
• Anonymous user identifier (${userId})

SECTION 4: CONFIDENTIALITY AND DATA PROTECTION

• All data is anonymized and stored securely
• Your personal information is protected under GDPR
• Data will be used solely for research purposes
• Results will be published in aggregate form only
• Individual participants will not be identifiable

SECTION 5: YOUR RIGHTS AS A PARTICIPANT

You have the right to:
• Withdraw from the study at any time without penalty
• Request deletion of your data
• Access your collected data
• Ask questions about the research
• Receive information about study results

SECTION 6: RISKS AND BENEFITS

Risks: Minimal. You may experience minor inconvenience from CAPTCHA 
       challenges or adjusted system performance.

Benefits: Contributing to privacy research that may inform better privacy 
         tools and policies.

SECTION 7: CONSENT STATEMENT

By completing this form, I confirm that:

✓ I have read and understood the study information
✓ I have had the opportunity to ask questions
✓ I understand my participation is voluntary
✓ I understand I can withdraw at any time
✓ I consent to the collection and use of my data as described
✓ I understand my data will be anonymized and stored securely

═══════════════════════════════════════════════

CONTACT INFORMATION

For questions or concerns about this research:

Principal Investigator: Kyle Ng
Email: [contact information]
Department: Security and Crime Science Research
Institution: University College London (UCL)
Project Code: SECU0053

For questions about your rights as a research participant:
UCL Research Ethics Committee
[contact information]

═══════════════════════════════════════════════

PARTICIPANT CONFIRMATION

Participant ID: ${participantId}
User ID: ${userId}
Consent Date: ${date}
Consent Status: CONFIRMED

This document serves as proof of informed consent for participation 
in the Privacy Utility Tradeoff research study conducted at UCL 
in October 2025.

═══════════════════════════════════════════════
        `
    };
    
    if (format === 'pdf') {
        downloadConsentAsPDF(consentFormData);
    } else if (format === 'docx') {
        downloadConsentAsDOCX(consentFormData);
    }
}

// Download privacy form as PDF
function downloadPrivacyAsPDF(data) {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${data.title}</title>
            <style>
                @page {
                    margin: 1in;
                }
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                    color: #333;
                }
                h1 {
                    color: #00ffff;
                    border-bottom: 3px solid #00ffff;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .metadata {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }
                pre {
                    white-space: pre-wrap;
                    font-family: 'Courier New', monospace;
                    background: #f9f9f9;
                    padding: 15px;
                    border-left: 4px solid #00ffff;
                }
            </style>
        </head>
        <body>
            <h1>${data.title}</h1>
            <div class="metadata">
                <p><strong>Participant ID:</strong> ${data.participantId}</p>
                <p><strong>User ID:</strong> ${data.userId}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <pre>${data.content}</pre>
        </body>
        </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Download privacy form as DOCX
function downloadPrivacyAsDOCX(data) {
    // Convert plain text content to HTML with proper formatting (same as downloadAsWord)
    const formattedContent = data.content
        .replace(/\n/g, '<br>')
        .replace(/═══════════════════════════════════════════════/g, '<hr style="border: 2px solid #00ffff; margin: 20px 0;">')
        .replace(/─────────────────────────────────────────────────/g, '<hr style="border: 1px solid #ccc; margin: 15px 0;">')
        .replace(/✓/g, '<strong style="color: #00aa00;">✓</strong>')
        .replace(/QUESTION \d+:/g, '<h3 style="color: #00ffff; margin-top: 20px;">$&</h3>')
        .replace(/Available Options:/g, '<p style="font-weight: bold; margin-top: 10px;">$&</p>')
        .replace(/Selected Answer:/g, '<p style="font-weight: bold; color: #00aa00; margin-top: 10px;">$&</p>')
        .replace(/Participant's Response:/g, '<p style="font-weight: bold; margin-top: 10px;">$&</p>')
        .replace(/Answer:/g, '<p style="font-weight: bold; color: #00aa00; margin-top: 10px;">$&</p>');
    
    // Create HTML content for Word document (same format as downloadAsWord)
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${data.title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    padding: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                    color: #333;
                }
                h1 {
                    color: #00ffff;
                    border-bottom: 3px solid #00ffff;
                    padding-bottom: 10px;
                }
                .metadata {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                h3 {
                    color: #00ffff;
                    margin-top: 25px;
                    margin-bottom: 10px;
                }
                p {
                    margin: 8px 0;
                }
                pre {
                    white-space: pre-wrap;
                    font-family: 'Courier New', monospace;
                    background: #f9f9f9;
                    padding: 20px;
                    border-left: 4px solid #00ffff;
                    line-height: 1.8;
                }
            </style>
        </head>
        <body>
            <h1>${data.title}</h1>
            <div class="metadata">
                <p><strong>Participant ID:</strong> ${data.participantId}</p>
                <p><strong>User ID:</strong> ${data.userId}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                ${data.completionTime ? `<p><strong>Completion Time:</strong> ${data.completionTime}</p>` : ''}
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div>${formattedContent}</div>
        </body>
        </html>
    `;
    
    // Create blob and download (using .doc extension and msword MIME type like downloadAsWord)
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Privacy_Form_${data.userId}_${data.date.replace(/\//g, '-')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`Downloaded as Word: Privacy_Form_${data.userId}_${data.date.replace(/\//g, '-')}.doc`);
}

/* Guide Page CTA Button Navigation */
document.addEventListener('DOMContentLoaded', function() {
    // Handle CTA button clicks in Guide page
    const ctaButtons = document.querySelectorAll('.cta-button[data-page]');
    
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPage = this.getAttribute('data-page');
            
            // Remove active class from all nav links
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            
            // Add active class to target nav link
            const targetNavLink = document.querySelector(`.nav-link[data-page="${targetPage}"]`);
            if (targetNavLink) {
                targetNavLink.classList.add('active');
            }
            
            // Hide all pages
            document.querySelectorAll('.page-content').forEach(page => {
                page.classList.remove('active');
            });
            
            // Show target page
            const targetPageElement = document.getElementById(`${targetPage}-page`);
            if (targetPageElement) {
                targetPageElement.classList.add('active');
            }
            
            // Scroll to top smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            console.log(`Navigated from Guide to: ${targetPage}`);
        });
    });
});


/* FAQ Accordion Functionality */
function initializeFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    });
}

// Initialize FAQ when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeFAQ();
});
/* Resources Page Tab Functionality */
function initializeResourceTabs() {
    const tabs = document.querySelectorAll('.resource-tab');
    const categories = document.querySelectorAll('.resource-category');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const categoryName = tab.getAttribute('data-category');
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all categories
            categories.forEach(cat => cat.classList.remove('active'));
            
            // Show selected category
            const selectedCategory = document.getElementById(`category-${categoryName}`);
            if (selectedCategory) {
                selectedCategory.classList.add('active');
            }
        });
    });
    
    // Add click handlers for resource arrows
    const resourceArrows = document.querySelectorAll('.resource-arrow');
    resourceArrows.forEach(arrow => {
        arrow.addEventListener('click', () => {
            const url = arrow.getAttribute('data-url');
            if (url) {
                window.open(url, '_blank');
            }
        });
    });
}

// Update the DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    initializeFAQ();
    initializeResourceTabs();
});
/* Real-time Resource Statistics Counter */
function updateResourceStats() {
    // Count resources in each category
    const categories = {
        'websites': 'stat-websites',
        'papers': 'stat-papers',
        'news': 'stat-news',
        'videos': 'stat-videos',
        'tools': 'stat-tools'
    };
    
    Object.keys(categories).forEach(category => {
        const categoryElement = document.getElementById(`category-${category}`);
        if (categoryElement) {
            // Count all resource-item elements in this category
            const resourceCount = categoryElement.querySelectorAll('.resource-item').length;
            
            // Update the stat number
            const statElement = document.getElementById(categories[category]);
            if (statElement) {
                const currentCount = parseInt(statElement.textContent);
                if (currentCount !== resourceCount) {
                    statElement.textContent = resourceCount;
                    statElement.classList.add('updated');
                    
                    // Remove animation class after animation completes
                    setTimeout(() => {
                        statElement.classList.remove('updated');
                    }, 500);
                }
            }
        }
    });
}

/* Update Resource Tabs with Real-time Counts */
function updateResourceTabs() {
    const tabs = document.querySelectorAll('.resource-tab');
    const categories = ['websites', 'papers', 'news', 'videos', 'tools'];
    
    tabs.forEach((tab, index) => {
        const categoryName = categories[index];
        const categoryElement = document.getElementById(`category-${categoryName}`);
        
        if (categoryElement) {
            const resourceCount = categoryElement.querySelectorAll('.resource-item').length;
            
            // Update individual category stats within each category
            const categoryStats = categoryElement.querySelector('.resource-stats .stat-number');
            if (categoryStats) {
                categoryStats.textContent = resourceCount;
            }
        }
    });
}

// Initialize and update stats on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeFAQ();
    initializeResourceTabs();
    
    // Initial stats update
    updateResourceStats();
    updateResourceTabs();
    
    // Optional: Set up periodic updates (if resources are added dynamically)
    // setInterval(updateResourceStats, 5000); // Update every 5 seconds
});

// Update stats whenever a new resource is added (for future dynamic additions)
function addResourceItem(category, resourceData) {
    const categoryElement = document.getElementById(`category-${category}`);
    if (categoryElement) {
        // Create new resource item
        const resourceItem = document.createElement('div');
        resourceItem.className = 'resource-item';
        resourceItem.innerHTML = `
            <div class="resource-content">
                <h3>${resourceData.title} <i class="fa-solid fa-arrow-up-right-from-square"></i></h3>
                <p>${resourceData.description}</p>
                ${resourceData.meta ? `<div class="resource-meta">${resourceData.meta}</div>` : ''}
            </div>
            <button class="resource-arrow" data-url="${resourceData.url}">
                <i class="fa-solid fa-arrow-right"></i>
            </button>
        `;
        
        // Insert before the stats box
        const statsBox = categoryElement.querySelector('.resource-stats');
        if (statsBox) {
            categoryElement.insertBefore(resourceItem, statsBox);
        } else {
            categoryElement.appendChild(resourceItem);
        }
        
        // Update stats
        updateResourceStats();
        updateResourceTabs();
        
        // Add click handler for the new arrow button
        const arrow = resourceItem.querySelector('.resource-arrow');
        arrow.addEventListener('click', () => {
            const url = arrow.getAttribute('data-url');
            if (url) {
                window.open(url, '_blank');
            }
        });
    }
}

/* ============================================
   SESSION END TRACKING
   ============================================ */

// Track when user actually closes the browser/tab (not just navigating)
window.addEventListener('pagehide', function(e) {
    // Only mark as ended if it's a true close (not just navigation)
    if (e.persisted === false) {
        privacyState.sessionEnded = true;
        privacyState.sessionEndTime = new Date();
        
        // Store in localStorage so it persists
        try {
            localStorage.setItem('sessionEndTime', privacyState.sessionEndTime.toISOString());
            localStorage.setItem('sessionEnded', 'true');
        } catch (err) {
            console.log('Could not store session end time:', err);
        }
    }
});

// Initialize on page load
window.addEventListener('load', function() {
    // Clear any previous "ended" status since we're loading the page now
    // This means the session is ACTIVE again
    try {
        const wasEnded = localStorage.getItem('sessionEnded');
        
        // If there was a previous session that ended, we can optionally preserve that
        // But for the current session, we're active
        if (wasEnded === 'true') {
            // Clear the flags - this is a NEW session now
            localStorage.removeItem('sessionEnded');
            localStorage.removeItem('sessionEndTime');
        }
        
        // Current session is always ongoing when page loads
        privacyState.sessionEnded = false;
        privacyState.sessionEndTime = null;
        
    } catch (err) {
        console.log('Could not retrieve session end time:', err);
    }
    
    // Update display immediately
    updateAccountTimestamp();
});

/* ============================================
   SIMULATED CONTENT FEED WITH DYNAMIC ADS
   ============================================ */

// Ad component generators for each privacy level
const adGenerators = {
    // HIGH PRIVACY (ε ≤ 1.5) - Generic, non-targeted ads
    high: [
        () => ({
            title: "Shop the Latest Fashion Trends",
            description: "Discover clothing, shoes and accessories for every style. Free delivery on orders over £50. Shop now.",
            badge: { text: "Retail", class: "badge-retail" },
            borderColor: "border-green-1"
        }),
        () => ({
            title: "Delicious Meals Delivered to Your Door",
            description: "Fresh ingredients and easy recipes. Choose from 50+ weekly options. First box 50% off. Order today.",
            badge: { text: "Food & Drinks", class: "badge-food" },
            borderColor: "border-green-2"
        }),
        () => ({
            title: "Explore Dream Destinations",
            description: "Compare flights, hotels and holiday packages worldwide. Best price guarantee. Start planning your next trip.",
            badge: { text: "Travel", class: "badge-travel" },
            borderColor: "border-green-3"
        }),
        () => ({
            title: "Get Fit at Home",
            description: "Premium fitness equipment for every workout. Weights, yoga mats and more. Free 30-day returns.",
            badge: { text: "Sports & Fitness", class: "badge-fitness" },
            borderColor: "border-green-4"
        }),
        () => ({
            title: "Latest Tech at Great Prices",
            description: "Shop smartphones, laptops, tablets and accessories. Extended warranty available. Buy now, pay later options.",
            badge: { text: "Consumer Electronics", class: "badge-tech" },
            borderColor: "border-green-5"
        }),
        () => ({
            title: "Home Furniture Sale - Up to 60% Off",
            description: "Transform your space with quality furniture. Sofas, tables, beds and decor. Limited time savings.",
            badge: { text: "Retail", class: "badge-retail" },
            borderColor: "border-green-1"
        }),
        () => ({
            title: "Restaurant Vouchers - Dine Out for Less",
            description: "Save up to 50% at top restaurants. Thousands of venues nationwide. Book your table today.",
            badge: { text: "Food & Drinks", class: "badge-food" },
            borderColor: "border-green-2"
        }),
        () => ({
            title: "Weekend Getaways from £99",
            description: "Quick breaks to European cities. Hotels and flights included. Book now for summer dates.",
            badge: { text: "Travel", class: "badge-travel" },
            borderColor: "border-green-3"
        }),
        () => ({
            title: "Gym Membership - Join Today",
            description: "State-of-the-art facilities with expert trainers. No joining fee this month. Try it free for 7 days.",
            badge: { text: "Sports & Fitness", class: "badge-fitness" },
            borderColor: "border-green-4"
        }),
        () => ({
            title: "Smart Home Devices - Special Offers",
            description: "Upgrade your home with smart speakers, lighting and security. Easy setup. Exclusive online prices.",
            badge: { text: "Consumer Electronics", class: "badge-tech" },
            borderColor: "border-green-5"
        }),
        () => ({
            title: "Designer Outlet - Brands Up to 70% Off",
            description: "Premium fashion at outlet prices. New stock added daily. Shop authentic designer pieces now.",
            badge: { text: "Retail", class: "badge-retail" },
            borderColor: "border-green-1"
        }),
        () => ({
            title: "Grocery Delivery in 30 Minutes",
            description: "Fresh produce, pantry essentials and household items. Same-day delivery available. Order online.",
            badge: { text: "Food & Drinks", class: "badge-food" },
            borderColor: "border-green-2"
        }),
        () => ({
            title: "Adventure Tours Worldwide",
            description: "Guided tours to exciting destinations. From safari to scuba diving. Expert guides and small groups.",
            badge: { text: "Travel", class: "badge-travel" },
            borderColor: "border-green-3"
        }),
        () => ({
            title: "Running Shoes - Performance Collection",
            description: "Professional athletic footwear for all terrains. Advanced cushioning technology. Shop the range.",
            badge: { text: "Sports & Fitness", class: "badge-fitness" },
            borderColor: "border-green-4"
        }),
        () => ({
            title: "Gaming Consoles & Accessories",
            description: "Latest gaming systems and popular titles. Pre-order new releases. Trade-in your old console.",
            badge: { text: "Consumer Electronics", class: "badge-tech" },
            borderColor: "border-green-5"
        }),
        () => ({
            title: "Luxury Watches - Timeless Elegance",
            description: "Certified authentic timepieces from top brands. Interest-free payment plans. 2-year warranty included.",
            badge: { text: "Retail", class: "badge-retail" },
            borderColor: "border-green-1"
        }),
        () => ({
            title: "Wine Subscription - Monthly Deliveries",
            description: "Curated selection of wines from around the world. Expert tasting notes. Cancel anytime.",
            badge: { text: "Food & Drinks", class: "badge-food" },
            borderColor: "border-green-2"
        }),
        () => ({
            title: "Cruise Holidays - Mediterranean Specials",
            description: "All-inclusive cruise packages. Multiple ports of call. Entertainment and dining included.",
            badge: { text: "Travel", class: "badge-travel" },
            borderColor: "border-green-3"
        }),
        () => ({
            title: "Yoga Classes - Beginners Welcome",
            description: "Online and studio sessions. Flexible scheduling with certified instructors. First class free.",
            badge: { text: "Sports & Fitness", class: "badge-fitness" },
            borderColor: "border-green-4"
        }),
        () => ({
            title: "Photography Equipment Sale",
            description: "Professional cameras, lenses and accessories. Trade-in your old gear. Expert advice available.",
            badge: { text: "Consumer Electronics", class: "badge-tech" },
            borderColor: "border-green-5"
        }),
        () => ({
            title: "Kids Clothing - Spring Collection",
            description: "Durable and comfortable clothes for children of all ages. Organic cotton options. Fast shipping.",
            badge: { text: "Retail", class: "badge-retail" },
            borderColor: "border-green-1"
        }),
        () => ({
            title: "Coffee Beans - Freshly Roasted",
            description: "Premium coffee delivered to your door. Single origin and blends. Subscribe and save 15%.",
            badge: { text: "Food & Drinks", class: "badge-food" },
            borderColor: "border-green-2"
        }),
        () => ({
            title: "Ski Holidays - Winter Season",
            description: "Packages to top ski resorts. Equipment rental and lessons available. Book early for best rates.",
            badge: { text: "Travel", class: "badge-travel" },
            borderColor: "border-green-3"
        }),
        () => ({
            title: "Cycling Gear - Performance Range",
            description: "Bikes, helmets and accessories for road and mountain biking. Expert fitting service available.",
            badge: { text: "Sports & Fitness", class: "badge-fitness" },
            borderColor: "border-green-4"
        }),
        () => ({
            title: "Wireless Earbuds - Premium Sound",
            description: "Crystal clear audio with active noise cancellation. Long battery life. Water resistant design.",
            badge: { text: "Consumer Electronics", class: "badge-tech" },
            borderColor: "border-green-5"
        })

    ],
    
    // MEDIUM PRIVACY (1.5 < ε ≤ 3.0) - Contextual, location/demographic-based
    medium: [
        () => ({
            title: "University of London - Online Master's Degrees",
            description: "Advance your career with flexible online study. MSc programs in Business, Technology and Healthcare. Apply now for September 2025 intake.",
            badge: { text: "University Study Opportunities (London, UK)", class: "badge-university" },
            borderColor: "border-yellow-1"
        }),
        () => ({
            title: "Student Housing in Bristol City Centre",
            description: "Modern studios near University of Bristol. All bills included. 10-minute walk to campus. Virtual tours available. Book for 2025.",
            badge: { text: "Student Housing (Bristol, UK)", class: "badge-housing" },
            borderColor: "border-yellow-2"
        }),
        () => ({
            title: "Graduate Jobs in London - Technology Sector",
            description: "Top employers are hiring. Software engineering, data science and cybersecurity roles. Free CV review for recent graduates.",
            badge: { text: "Career Opportunities (London, UK)", class: "badge-career" },
            borderColor: "border-yellow-3"
        }),
        () => ({
            title: "Cambridge Science Festival - March 2025",
            description: "Two weeks of talks, exhibitions and workshops. Network with researchers and industry leaders. Many events free. Student tickets £15.",
            badge: { text: "Local News & Events (Cambridge, UK)", class: "badge-local" },
            borderColor: "border-yellow-4"
        }),
        () => ({
            title: "Best Coffee Shops in Manchester for Studying",
            description: "Northern Quarter cafes with free WiFi and power outlets. Student discounts available. Quiet atmosphere. Open until midnight during exam season.",
            badge: { text: "Restaurants & Cafés (Manchester, UK)", class: "badge-restaurant" },
            borderColor: "border-yellow-5"
        }),
        () => ({
            title: "Part-Time Jobs for Students - Flexible Hours",
            description: "Retail, hospitality and tutoring positions in Central London. Work around your lecture schedule. Apply online today.",
            badge: { text: "Career Opportunities (London, UK)", class: "badge-career" },
            borderColor: "border-yellow-3"
        }),
        () => ({
            title: "King's College London - Undergraduate Open Days",
            description: "Explore our BSc and BA programs. Campus tours, subject tasters and meet current students. Strand and Waterloo campuses. Register for March open days.",
            badge: { text: "University Study Opportunities (London, UK)", class: "badge-university" },
            borderColor: "border-yellow-1"
        }),
        () => ({
            title: "Cambridge Student Wellbeing Services",
            description: "Confidential counseling for Cambridge students. Stress, anxiety and academic pressure support. First session free. City centre location.",
            badge: { text: "Local News & Events (Cambridge, UK)", class: "badge-local" },
            borderColor: "border-yellow-4"
        }),
        () => ({
            title: "LSE - Postgraduate Programs 2025",
            description: "World-leading social sciences education. MSc in Economics, Politics and International Relations. Scholarships available. Apply by January 31st.",
            badge: { text: "University Study Opportunities (London, UK)", class: "badge-university" },
            borderColor: "border-yellow-1"
        }),
        () => ({
            title: "Student Railcard - Save 1/3 on UK Travel",
            description: "Explore Britain for less. Valid for 1 year. Perfect for weekend trips and visiting home. Order online.",
            badge: { text: "Local News & Events (Cambridge, UK)", class: "badge-local" },
            borderColor: "border-yellow-4"
        }),
        () => ({
            title: "Bristol Student Flats - £550/month",
            description: "Shared accommodation in Clifton. Close to UWE and University of Bristol. Friendly housemates. Kitchen and bathroom shared. Bills included.",
            badge: { text: "Student Housing (Bristol, UK)", class: "badge-housing" },
            borderColor: "border-yellow-2"
        }),
        () => ({
            title: "London Career Fair for Graduates - Free Entry",
            description: "Meet employers from finance, tech and consulting. Bring your CV. Interview tips and workshops available.",
            badge: { text: "Career Opportunities (London, UK)", class: "badge-career" },
            borderColor: "border-yellow-3"
        }),
        () => ({
            title: "Manchester Restaurants - 20% Student Discount",
            description: "Show your student ID and save at Nando's and 50+ venues. Curry Mile, Chinatown and city centre locations. Perfect for study breaks with friends.",
            badge: { text: "Restaurants & Cafés (Manchester, UK)", class: "badge-restaurant" },
            borderColor: "border-yellow-5"
        }),
        () => ({
            title: "Edinburgh University - MBA Program 2025",
            description: "One-year full-time MBA at historic Edinburgh Business School. International networking. Career coaching included. Applications closing soon.",
            badge: { text: "University Study Opportunities (Edinburgh, UK)", class: "badge-university" },
            borderColor: "border-yellow-1"
        }),
        () => ({
            title: "Oxford City Centre Apartments - Students Only",
            description: "Premium student accommodation near Oxford University. Ensuite rooms, gym, study areas. All-inclusive rent £780/month. Book your viewing.",
            badge: { text: "Student Housing (Oxford, UK)", class: "badge-housing" },
            borderColor: "border-yellow-2"
        }),
        () => ({
            title: "Manchester Digital Marketing Jobs - Entry Level",
            description: "Join growing agencies in Manchester. Training provided for graduates. Social media, SEO and content roles. Salaries from £24K.",
            badge: { text: "Career Opportunities (Manchester, UK)", class: "badge-career" },
            borderColor: "border-yellow-3"
        }),
        () => ({
            title: "Edinburgh Fringe Festival - August 2025",
            description: "World's largest arts festival. Comedy, theatre and music. Student passes £99 for unlimited shows. Book accommodation early.",
            badge: { text: "Local News & Events (Edinburgh, UK)", class: "badge-local" },
            borderColor: "border-yellow-4"
        }),
        () => ({
            title: "Leeds Brunch Spots - Weekend Student Deals",
            description: "Best bottomless brunch in Leeds city centre. £20 student offer includes food and drinks. Perfect for Saturday meetups. Book ahead.",
            badge: { text: "Restaurants & Cafés (Leeds, UK)", class: "badge-restaurant" },
            borderColor: "border-yellow-5"
        }),
        () => ({
            title: "Imperial College London - Engineering Masters",
            description: "MSc in Mechanical, Electrical and Computing Engineering. World-class facilities. Industry partnerships. September 2025 start.",
            badge: { text: "University Study Opportunities (London, UK)", class: "badge-university" },
            borderColor: "border-yellow-1"
        }),
        () => ({
            title: "Glasgow Student Accommodation - New Build",
            description: "Modern flats near Glasgow University and Strathclyde. Private or shared options. Cinema room, gym. From £600/month.",
            badge: { text: "Student Housing (Glasgow, UK)", class: "badge-housing" },
            borderColor: "border-yellow-2"
        }),
        () => ({
            title: "Birmingham Finance Graduate Scheme",
            description: "Major banks recruiting in Birmingham. 2-year rotational programs. Competitive salary £32K+. Apply before March deadline.",
            badge: { text: "Career Opportunities (Birmingham, UK)", class: "badge-career" },
            borderColor: "border-yellow-3"
        }),
        () => ({
            title: "Bath Christmas Market - November-December",
            description: "Traditional German-style market in historic Bath. Perfect for students. Mulled wine, crafts, street food. Free entry.",
            badge: { text: "Local News & Events (Bath, UK)", class: "badge-local" },
            borderColor: "border-yellow-4"
        }),
        () => ({
            title: "Newcastle Late Night Eateries - Student Friendly",
            description: "Food until 3am near Newcastle University. Pizza, burgers, kebabs. Student meal deals £5.99. Great post-library fuel.",
            badge: { text: "Restaurants & Cafés (Newcastle, UK)", class: "badge-restaurant" },
            borderColor: "border-yellow-5"
        }),
        () => ({
            title: "Durham University - Research Opportunities",
            description: "PhD positions available across all departments. Full funding for UK students. World-class supervision. Apply for 2025 start.",
            badge: { text: "University Study Opportunities (Durham, UK)", class: "badge-university" },
            borderColor: "border-yellow-1"
        }),
        () => ({
            title: "Nottingham Student Houses - 5 Bedrooms",
            description: "Close to both Nottingham universities. Fully furnished. Fast broadband. Garden. £95/week per person. Available September 2025.",
            badge: { text: "Student Housing (Nottingham, UK)", class: "badge-housing" },
            borderColor: "border-yellow-2"
        })


    ],
    
    // LOW PRIVACY (ε > 3.0) - Highly personalized with sensitive data
    // Organized into 5 themes with 5 ads each (25 total)
    low: [
        // === JOB TARGETING (TECHNOLOGY) - 5 ads ===
        () => ({
            title: "Software Engineers Wanted - £75K-95K",
            description: "We noticed you've been searching for Python developer roles in London and updating your GitHub portfolio. Based on your computer science background and 3+ years coding experience, you're a perfect match for these senior positions. 23 companies viewed profiles like yours this week. Your skills in React and Node.js are in high demand right now.",
            badge: { text: "Job Targeting (Technology)", class: "badge-job" },
            borderColor: "border-red-1",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Professional profile: CS student • GitHub activity tracked • Job searches: Python, data science • Location: London • Salary expectation: £60-95K"
            }
        }),
        () => ({
            title: "Data Science Role - Your Profile Matched",
            description: "You've applied to 12 data science positions this month and your LinkedIn shows you completed Andrew Ng's ML course. Your Kaggle profile indicates intermediate skills. Companies offering £65-80K are actively searching for candidates with your background. Your resume was viewed 47 times last week. Apply now before these positions close.",
            badge: { text: "Job Targeting (Technology)", class: "badge-job" },
            borderColor: "border-red-1",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Job applications: 12 DS roles • LinkedIn: ML course completion • Kaggle tracked • Resume views: 47x • Salary band identified: £65-80K"
            }
        }),
        () => ({
            title: "Frontend Developer - React Specialist Needed",
            description: "Your GitHub shows 234 commits in React projects and you've starred 47 React repositories. You search 'React job London' 3x weekly. Your Stack Overflow activity shows you answer React questions. Companies need developers exactly like you. Your profile matches 23 open positions. Salary: £70-85K based on your 4 years experience.",
            badge: { text: "Job Targeting (Technology)", class: "badge-job" },
            borderColor: "border-red-1",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "GitHub: 234 React commits • Repository stars tracked • Search frequency: 3x weekly • Stack Overflow monitored • Experience level: 4 years • Salary calculated"
            }
        }),
        () => ({
            title: "Tech Startup Seeks Full Stack Developer",
            description: "You've visited 8 startup job boards this month and follow 23 Y Combinator companies on LinkedIn. Your Twitter likes include startup culture tweets. Based on your searches for 'startup equity' and 'stock options explained', we know compensation structure matters to you. This role offers £60K + 0.5% equity. Your friend Tom from university works here.",
            badge: { text: "Job Targeting (Technology)", class: "badge-job" },
            borderColor: "border-red-1",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Startup interest: 8 job boards • LinkedIn: 23 YC companies followed • Twitter likes analyzed • Equity searches tracked • Social connection: Friend Tom employed"
            }
        }),
        () => ({
            title: "Still Thinking About Leaving Your PhD?",
            description: "Your recent searches for 'PhD to industry transition' and 'is a PhD worth it' suggest you're considering your options. You've spent 3+ hours on LinkedIn and Glassdoor this week viewing tech jobs. People with your background (PhD dropout + coding bootcamp) typically earn £55-70K in first industry role. Book a free consultation. Your LinkedIn connections show 12 people made this transition.",
            badge: { text: "Job Targeting (Technology)", class: "badge-job" },
            borderColor: "border-red-1",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Career doubt searches • LinkedIn activity: 3+ hours weekly • Academic background tracked • Bootcamp completion identified • Salary expectations calculated • Network analyzed: 12 transitions"
            }
        }),
        
        // === SHOPPING HISTORY (CLOTHING & FASHION) - 5 ads ===
        () => ({
            title: "We Saved These Items You Keep Viewing",
            description: "You've looked at these trainers 5 times this week but haven't purchased yet. We know you bought similar streetwear from us last month (Nike hoodie, size M). Based on your browsing patterns, you usually buy on Fridays when you get paid. These are back in your size and 25% off today only. Your friend Sarah bought a pair yesterday. Free next-day delivery before midnight.",
            badge: { text: "Shopping History (Clothing & Fashion)", class: "badge-shopping" },
            borderColor: "border-red-2",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Shopping behavior: Viewed 5x, abandoned cart • Past purchases: Streetwear, sneakers • Price range: £30-80 • Size: M • Purchase timing: Fridays • Social: Friend Sarah bought"
            }
        }),
        () => ({
            title: "Your Abandoned Cart is Waiting",
            description: "Still interested in that black denim jacket? You've been back to look at it 3 times since adding it to your cart on Monday. People who bought what you did (graphic tees and hoodies) also purchased this. It's trending in your area - 127 people in London bought it this month. Your size (Medium) is running low. Complete your order now and get 30% off plus free returns.",
            badge: { text: "Shopping History (Clothing & Fashion)", class: "badge-shopping" },
            borderColor: "border-red-2",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Cart abandonment: Monday • Return visits: 3x • Purchase history: Graphic tees, hoodies • Size: M • Location targeting: London • Social proof: 127 local buyers"
            }
        }),
        () => ({
            title: "Winter Coat - Based on Your Style Profile",
            description: "Your purchase history shows you prefer minimalist designs in black or navy. You buy coats in November (last 3 years tracked). Your size M in North Face sold out, but we have Patagonia in stock. You browsed sustainable brands 12 times - this coat is recycled materials. Price £180 matches your typical coat spend (£150-200 range). Your Instagram follows suggest you'll love this.",
            badge: { text: "Shopping History (Clothing & Fashion)", class: "badge-shopping" },
            borderColor: "border-red-2",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Style preference: Minimalist, black/navy • Purchase timing: November annually • Size: M • Sustainability interest tracked • Budget identified: £150-200 • Instagram analyzed"
            }
        }),
        () => ({
            title: "Jeans Restock - Your Favorite Brand",
            description: "Levi's 511 in 32x32 - you've bought these 4 times in 2 years. Your last pair purchased 8 months ago (average lifespan 8-9 months based on your patterns). You browse denim sales every Tuesday. These just restocked and you're viewing this on Tuesday at 7:42pm - your usual shopping time. 30% off ends tonight. Previous 4 purchases were all on sale.",
            badge: { text: "Shopping History (Clothing & Fashion)", class: "badge-shopping" },
            borderColor: "border-red-2",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Brand loyalty: Levi's 511 • Size: 32x32 • Purchase frequency: Every 8-9 months • Browsing pattern: Tuesdays • Shopping time: Evening • Sale history: 100% discount purchases"
            }
        }),
        () => ({
            title: "Dress Shoes - You Need These for Next Week",
            description: "Your calendar shows 'job interview Goldman Sachs' next Thursday. You've Googled 'what to wear investment banking interview' 6 times. Your last formal shoes purchase was 3 years ago. Men with your shopping history (casual streetwear) typically don't own proper dress shoes. Size 10 based on your trainer purchases. Express delivery gets them to you by Wednesday. Your mate James bought these for his interview.",
            badge: { text: "Shopping History (Clothing & Fashion)", class: "badge-shopping" },
            borderColor: "border-red-2",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Calendar accessed: Goldman interview • Search history: Interview attire • Wardrobe gap identified • Size inferred: 10 • Delivery urgency • Social pressure: Friend James"
            }
        }),
        
        // === TRAVEL SUGGESTIONS (EUROPE) - 5 ads ===
        () => ({
            title: "Paris Weekend - You Searched This Before",
            description: "Remember looking at Paris hotels last month? Prices for your dates (March 15-17) just dropped 30%. You previously viewed hotels in Le Marais - those are now £89/night. Based on your Eurostar search history and budget hotels saved, we found 5 perfect matches. Your search history shows you prefer boutique hotels under £150/night. Book in the next 3 hours to lock in this price.",
            badge: { text: "Travel Suggestions (Europe)", class: "badge-travel-personal" },
            borderColor: "border-red-3",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Travel searches: Paris hotels • Dates tracked: March 15-17 • Neighborhood preference: Le Marais • Budget: Under £150/night • Previous searches: Eurostar • Urgency pressure: 3 hours"
            }
        }),
        () => ({
            title: "Amsterdam - You've Searched 4 Times This Month",
            description: "We've been tracking your Amsterdam flight searches. You looked at weekend trips on Jan 8th, 12th, 19th and 23rd - always for late March dates. Your typical budget is £150-200 based on previous bookings to Barcelona and Berlin. People with your travel patterns usually book hostels in De Pijp neighborhood. We found flights for £89 and your preferred hostel has availability. Act fast - 12 people are viewing this right now.",
            badge: { text: "Travel Suggestions (Europe)", class: "badge-travel-personal" },
            borderColor: "border-red-3",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Search frequency: 4x (dates logged) • Dates analyzed: Late March • Budget identified: £150-200 • Previous destinations: Barcelona, Berlin • Accommodation type: Hostels • Real-time pressure"
            }
        }),
        () => ({
            title: "Barcelona Flights - Your Friends Are Going",
            description: "Your Facebook events show 'Sarah's Barcelona Birthday Trip' in April. You've searched Barcelona flights 8 times but haven't booked. The group chat (we partner with WhatsApp) shows 6/8 people booked flights. Your usual booking pattern is last minute, but prices increase £47 per day now. Your previous trip to Barcelona (2 years ago) cost £340 total - current options £289. Book with your friends.",
            badge: { text: "Travel Suggestions (Europe)", class: "badge-travel-personal" },
            borderColor: "border-red-3",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Facebook event tracked • Search history: 8x • WhatsApp partnership: Group chat monitored • Social pressure: 6/8 booked • Booking patterns analyzed • Historical trip cost compared"
            }
        }),
        () => ({
            title: "Rome - Completing Your Italy Trip",
            description: "You booked Venice for May (confirmation email tracked). Your Pinterest board 'Italy 2025' includes 47 Rome pins. Google Maps history shows you've looked at Rome attractions 23 times. Your search 'Venice to Rome train' appeared 12x. People who book Venice always add Rome (87% rate). 3-day Rome stay £267 total matches your budget. Same hotel chain you used in Venice offers 20% loyalty discount.",
            badge: { text: "Travel Suggestions (Europe)", class: "badge-travel-personal" },
            borderColor: "border-red-3",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Email tracking: Venice booking • Pinterest: 47 Rome pins • Maps history: 23 attraction views • Search patterns: Train routes • Predictive targeting: 87% add Rome • Loyalty program tracked"
            }
        }),
        () => ({
            title: "Berlin Techno Weekend - Based on Your Spotify",
            description: "Your Spotify shows 89% electronic music (top artists: Charlotte de Witte, Ben Klock). You follow Berghain and Tresor on Instagram. Your previous Berlin trip (March 2023) included club check-ins on Friday-Sunday. Calendar shows free weekend Feb 21-23. Flights £67 match your usual budget. Your mate Tom from that trip just booked the same weekend. Hostel in Kreuzberg (your preferred area) has 3 beds left.",
            badge: { text: "Travel Suggestions (Europe)", class: "badge-travel-personal" },
            borderColor: "border-red-3",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Spotify: Music taste analyzed • Instagram: Club follows tracked • Previous trip: Location check-ins • Calendar: Free weekend identified • Social connection: Friend Tom • Neighborhood preference: Kreuzberg"
            }
        }),
        
        // === READING PREFERENCES (TECHNOLOGY & FINANCE) - 5 ads ===
        () => ({
            title: "Join 847 London Professionals Who Read WSJ",
            description: "Your late-night reading habits tell us a lot. You've visited Financial Times articles 23 times, read 15 TechCrunch posts about crypto startups, and spent 2+ hours on Bloomberg between midnight-3am this month. People in your demographic (25-34, London, tech/finance interest) are 3x more likely to subscribe. Your LinkedIn profile shows you're following 12 investment banking analysts. Get 40% off your first year.",
            badge: { text: "Reading Preferences (Technology & Finance)", class: "badge-reading" },
            borderColor: "border-red-4",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Reading behavior: FT (23x), TechCrunch (15x) • Late-night browsing: midnight-3am • Topics: crypto, startups • Demographics: 25-34, London • LinkedIn: 12 analyst connections"
            }
        }),
        () => ({
            title: "Bloomberg Terminal - The Tool You Keep Reading About",
            description: "Your browsing history shows you're serious about finance. You've read 124 articles about investment banking, searched 'Goldman Sachs internship requirements' 7 times, and visited our pricing page twice without signing up. Your LinkedIn says you're a Finance student at LSE. This is exactly how the analysts you're following access live market data. 73% of students who viewed this page during your course eventually subscribed. Start your free trial.",
            badge: { text: "Reading Preferences (Technology & Finance)", class: "badge-reading" },
            borderColor: "border-red-4",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Article views: 124 investment banking • Job searches: Goldman Sachs (7x) • LinkedIn tracked: LSE Finance student • Pricing page visits: 2x • Career path identified: Investment banking"
            }
        }),
        () => ({
            title: "The Economist - You Read 40% of Our Free Articles",
            description: "You've hit our paywall 15 times this month reading articles about UK economy, tech policy, and startup valuations. Your reading time averages 12 minutes per article (top 5% of readers). You share our articles on LinkedIn 2-3x weekly. Your Twitter follows include our journalists. Students at your university (Cambridge) get 50% off. Your course reading list includes 8 Economist articles - unlimited access helps your dissertation.",
            badge: { text: "Reading Preferences (Technology & Finance)", class: "badge-reading" },
            borderColor: "border-red-4",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Paywall hits: 15x • Topics tracked • Reading time: 12 min avg • LinkedIn shares: 2-3 weekly • Twitter: Journalist follows • University: Cambridge • Course reading list accessed"
            }
        }),
        () => ({
            title: "TechCrunch Pro - You're Already Reading Daily",
            description: "You visit TechCrunch 5x per day, always reading startup funding news and product launches. Your bookmarks show 67 saved articles about Y Combinator and Series A rounds. You searched 'how to value startups' 9 times. Your LinkedIn headline says 'Aspiring VC'. Pro membership gets you the analysis behind the headlines. People with your reading patterns (startup funding + venture capital) subscribe within 3 months of tracking. First month £1.",
            badge: { text: "Reading Preferences (Technology & Finance)", class: "badge-reading" },
            borderColor: "border-red-4",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Visit frequency: 5x daily • Bookmarks: 67 articles tracked • Search history: Startup valuation • LinkedIn headline: 'Aspiring VC' • Predictive model: 3-month timeline • Trial pricing hook"
            }
        }),
        () => ({
            title: "MIT Technology Review - Your Research Needs This",
            description: "You've accessed 23 paywalled articles through your university library proxy. Your reading focuses on AI ethics and machine learning (topics match your dissertation title on Google Scholar). You've cited our articles 4 times in your papers (we track academic citations). Your supervisor follows our AI editor on Twitter. Student rate £4.99/month continues after graduation. Your PhD colleagues (8 in your department) already subscribe.",
            badge: { text: "Reading Preferences (Technology & Finance)", class: "badge-reading" },
            borderColor: "border-red-4",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Library proxy: 23 accesses tracked • Research topic: AI ethics • Google Scholar: Dissertation title accessed • Citations: 4 articles • Supervisor's Twitter monitored • Department: 8 colleagues identified"
            }
        }),
        
        // === SPORTS (FOOTBALL) - 5 ads ===
        () => ({
            title: "Never Miss Arsenal Again - Live Streaming",
            description: "You've searched for Arsenal scores 47 times this season and visit r/Gunners daily. Your viewing history shows you watch every match (27/28 games this year). You googled 'Arsenal vs Spurs live stream' three times last week. Based on your engagement, you'll watch 4+ matches per week next month. Join 14,000 Arsenal fans streaming in HD. Your mate James (connected on Facebook) subscribed yesterday. First month £9.99.",
            badge: { text: "Sports (Football)", class: "badge-sports" },
            borderColor: "border-red-5",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Team loyalty: Arsenal • Search count: 47 scores • Reddit activity: r/Gunners daily • Watch rate: 27/28 matches • Viewing prediction: 4+ weekly • Social connection: Friend James subscribed"
            }
        }),
        () => ({
            title: "Arsenal vs Manchester United - Get Your Tickets",
            description: "You've searched for Arsenal match tickets 12 times this season and visited Emirates Stadium seating plans twice. Based on your previous ticket purchases (North Bank, £65-80 range) and your search for 'Arsenal vs Man United tickets', we have 2 seats available in your preferred section. Your Facebook check-ins show you attend 8+ home games per season. Book now - only 47 tickets left in North Bank. Your friend James bought tickets in the same section.",
            badge: { text: "Sports (Football)", class: "badge-sports" },
            borderColor: "border-red-5",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Match interest: Arsenal vs Man United • Ticket searches: 12x this season • Previous purchases: North Bank section, £65-80 • Stadium familiarity: Seating plan viewed 2x • Attendance pattern: 8+ home games • Social: Friend James attending"
            }
        }),
        () => ({
            title: "Arsenal Retro Shirt - 89/91 Bruised Banana",
            description: "Your search history shows 'Arsenal retro shirts' 23 times and you've clicked through to vintage football sites 8x. Your Instagram likes include 47 throwback Arsenal posts. You bought the current home shirt in August (size L, £67). Your Pinterest board 'Football Kits' has 34 retro Arsenal pins. This 89/91 shirt just restocked in your size. Limited to 500 units. People who bought what you did also purchased this. £85 - matches your football shirt budget.",
            badge: { text: "Sports (Football)", class: "badge-sports" },
            borderColor: "border-red-5",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "Search history: Retro shirts 23x • Instagram: 47 throwback likes • Previous purchase: Home shirt £67, size L • Pinterest: 34 retro pins • Budget pattern: £60-85 • Scarcity tactic: 500 units"
            }
        }),
        () => ({
            title: "Fantasy Premier League - You're 1.2M Behind",
            description: "Your FPL team 'Arteta's Tactics' is ranked 3.4 million globally. You spend 45 minutes every Friday on transfers (tracked via time-on-site). Your watchlist shows you're eyeing Haaland but can't afford him. You've searched 'FPL tips' 67 times. Our AI captain picks would've given you 847 more points. Your mini-league shows your mate Tom is beating you by 124 points. Premium membership £4.99/month guarantees top 100k finish or refund.",
            badge: { text: "Sports (Football)", class: "badge-sports" },
            borderColor: "border-red-5",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "FPL account tracked: Team name, rank • Time tracking: 45 min Fridays • Watchlist accessed • Search history: Tips 67x • Performance analysis: Point calculation • Mini-league: Friend comparison • Guarantee claim: Top 100k"
            }
        }),
        () => ({
            title: "DAZN - Every Premier League Match Live",
            description: "You illegally stream 3-4 matches per week (IP address tracked visiting streaming sites). Your search history shows 'free football streams reddit' 89 times this season. You've had 4 'stream buffering' frustrations (browser cookies tracked). Legal streaming is £25/month - you spend £0 but deal with popups and quality issues. Your viewing times (Sat 3pm, Sun 2pm, weekday 8pm) match our coverage. First 3 months £15/month. Your internet speed (67 Mbps based on ISP data) perfect for 4K.",
            badge: { text: "Sports (Football)", class: "badge-sports" },
            borderColor: "border-red-5",
            warning: {
                title: "Sensitive Targeting Detected",
                details: "EXTREMELY SENSITIVE: IP tracking: Illegal streaming sites • Search history: 89x illegal streams • Browser cookies: Buffering frustration • Viewing schedule tracked • ISP partnership: Internet speed 67 Mbps • Implicit legal threat"
            }
        })

    ]
};

// Get latency duration based on epsilon value
function getLoadingLatency(epsilon) {
    if (epsilon <= 1.5) return 5500;  // High privacy: 5.5 seconds
    if (epsilon <= 3.0) return 2500;  // Medium privacy: 2.5 seconds
    return 500;                        // Low privacy: 0.5 seconds
}

// Determine privacy level from epsilon
function getPrivacyLevelFromEpsilon(epsilon) {
    if (epsilon <= 1.5) return 'high';
    if (epsilon <= 3.0) return 'medium';
    return 'low';
}

// Get privacy level text from final epsilon value
function getPrivacyLevelFromFinalEpsilon(finalEpsilon) {
    if (!finalEpsilon || finalEpsilon === 'N/A') return 'N/A';
    const epsilon = parseFloat(finalEpsilon);
    if (isNaN(epsilon)) return 'N/A';
    
    if (epsilon >= 0.1 && epsilon <= 1.5) {
        return 'High Privacy';
    } else if (epsilon >= 1.6 && epsilon <= 3.0) {
        return 'Medium Privacy';
    } else if (epsilon >= 3.1 && epsilon <= 5.0) {
        return 'Low Privacy';
    }
    return 'Unknown';
}

// Calculate average epsilon from all epsilon values
function calculateAverageEpsilon() {
    if (privacyState.epsilonValues && privacyState.epsilonValues.length > 0) {
        return (privacyState.totalEpsilonSum / privacyState.epsilonValues.length).toFixed(1);
    }
    // Fallback: use epsilonHistory if available
    if (currentSession.epsilonHistory && currentSession.epsilonHistory.length > 0) {
        const sum = currentSession.epsilonHistory.reduce((a, b) => a + b, 0);
        return (sum / currentSession.epsilonHistory.length).toFixed(1);
    }
    return '0.0';
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Generate random ads for a privacy level
function generateRandomAds(privacyLevel, adCount = 10) {
    const generators = adGenerators[privacyLevel];
    const shuffled = shuffleArray(generators);
    
    // Generate the specified number of ads, repeating if necessary
    const ads = [];
    for (let i = 0; i < adCount; i++) {
        ads.push(shuffled[i % shuffled.length]());
    }
    return ads;
}

// Create HTML for a single ad card
function createAdCardHTML(ad) {
    const warningHTML = ad.warning ? `
        <div class="sensitive-warning-box">
            <i class="fas fa-exclamation-triangle warning-icon"></i>
            <div class="warning-content-wrapper">
                <div class="warning-title-text">${ad.warning.title}</div>
                <div class="warning-details-text">${ad.warning.details}</div>
            </div>
        </div>
    ` : '';
    
    return `
        <div class="meta-ad-card ${ad.borderColor}">
            <div class="ad-header-section">
                <div class="ad-meta-icon">
                    <i class="fab fa-meta"></i>
                </div>
                <div class="ad-sponsor-info">
                    <div class="ad-sponsor-text">Meta Ad</div>
                    <div class="ad-sponsored-text">Sponsored</div>
                </div>
            </div>
            <div class="ad-personalization-badge ${ad.badge.class}">${ad.badge.text}</div>
            <h4 class="ad-title-text">${ad.title}</h4>
            <p class="ad-description-text">${ad.description}</p>
            ${warningHTML}
        </div>
    `;
}

// Show loading screen with progress animation
function showLoadingScreen(duration) {
    const loadingOverlay = document.getElementById('content-loading-overlay');
    const contentArea = document.getElementById('content-feed-area');
    const progressBar = document.getElementById('progress-bar-filled');
    const progressText = document.getElementById('progress-percent-text');
    
    if (!loadingOverlay || !contentArea) return Promise.resolve();
    
    // Show loading, hide content
    loadingOverlay.classList.add('active');
    contentArea.classList.add('hidden');
    
    // Reset progress
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    return new Promise((resolve) => {
        let progress = 0;
        const intervalTime = 50; // Update every 50ms
        const increment = (100 / (duration / intervalTime));
        
        const progressInterval = setInterval(() => {
            progress += increment;
            if (progress >= 100) {
                progress = 100;
                clearInterval(progressInterval);
                
                // Hide loading, show content after brief delay
                setTimeout(() => {
                    loadingOverlay.classList.remove('active');
                    contentArea.classList.remove('hidden');
                    resolve();
                }, 150);
            }
            
            progressBar.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
        }, intervalTime);
    });
}

// Update content feed based on epsilon value
async function updateContentFeed(epsilon) {
    const privacyLevel = getPrivacyLevelFromEpsilon(epsilon);
    const latency = getLoadingLatency(epsilon);
    const contentArea = document.getElementById('content-feed-area');
    const adFrequencySelect = document.getElementById('ad-frequency-select');
    
    if (!contentArea) return;
    
    // Get ad count from dropdown (default to 10)
    const adCount = adFrequencySelect ? parseInt(adFrequencySelect.value) : 10;
    
    // Show loading animation
    await showLoadingScreen(latency);
    
    // Generate ads with specified count
    const ads = generateRandomAds(privacyLevel, adCount);
    
    // Render ads
    contentArea.innerHTML = ads.map(ad => createAdCardHTML(ad)).join('');
}

// Initialize content feed on page load
function initializeContentFeed() {
    const slider = document.getElementById('privacy-slider');
    if (!slider) return;
    
    // Load initial ads based on slider value (which should be set to user's initial epsilon)
    // If slider hasn't been initialized yet, use getInitialEpsilon()
    const epsilon = slider.value ? parseFloat(slider.value) : getInitialEpsilon();
    updateContentFeed(epsilon);
}

// Hook into existing privacy controls
const originalInitPrivacy = initializePrivacyControls;
if (typeof initializePrivacyControls === 'function') {
    initializePrivacyControls = function() {
        originalInitPrivacy();
        
        const slider = document.getElementById('privacy-slider');
        const adFrequencySelect = document.getElementById('ad-frequency-select');
        
        if (slider) {
            // Update content feed when slider changes
            slider.addEventListener('change', function() {
                const epsilon = parseFloat(this.value);
                updateContentFeed(epsilon);
            });
            
            // Initialize on first load
            initializeContentFeed();
        }
        
        // Add event listener for ad frequency dropdown
        if (adFrequencySelect) {
            adFrequencySelect.addEventListener('change', function() {
                const slider = document.getElementById('privacy-slider');
                if (slider) {
                    const epsilon = parseFloat(slider.value);
                    updateContentFeed(epsilon);
                }
            });
        }
    };
}

// Ensure initialization happens after DOM loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentFeed);
} else {
    initializeContentFeed();
}
/* ============================================
   QUESTIONNAIRE FUNCTIONALITY
   ============================================ */

// Collect questionnaire responses
function collectQuestionnaireData() {
    const data = {
        q1_understanding: document.querySelector('input[name=\"q1\"]:checked')?.value || '',
        q2_noticed: document.querySelector('input[name="q2"]:checked')?.value || '',
        q3_factors: Array.from(document.querySelectorAll('input[name="q3"]:checked')).map(cb => cb.value),
        q4_preferred_range: document.querySelector('input[name="q4"]:checked')?.value || '',
        q5_captcha_impact: document.querySelector('input[name=\"q5\"]:checked')?.value || '',
        q6_ad_influence: document.querySelector('input[name="q6"]:checked')?.value || '',
        q7_ad_satisfaction: document.querySelector('input[name=\"q7\"]:checked')?.value || '',
        q8_perceived_protection: document.querySelector('input[name=\"q8\"]:checked')?.value || '',
        q9_willingness: document.querySelector('input[name=\"q9\"]:checked')?.value || '',
        q10_privacy_understanding: document.getElementById('q10-answer').value,
        q11_improvements: document.getElementById('q11-answer').value,
        q12_balance: document.getElementById('q12-answer').value
    };
    
    return data;
}

// Validate questionnaire
function validateQuestionnaire() {
    const q1 = document.querySelector('input[name="q1"]:checked');
    const q2 = document.querySelector('input[name="q2"]:checked');
    const q3 = document.querySelectorAll('input[name="q3"]:checked');
    const q4 = document.querySelector('input[name="q4"]:checked');
    const q5 = document.querySelector('input[name="q5"]:checked');
    const q6 = document.querySelector('input[name="q6"]:checked');
    const q7 = document.querySelector('input[name="q7"]:checked');
    const q8 = document.querySelector('input[name="q8"]:checked');
    const q9 = document.querySelector('input[name="q9"]:checked');
    const q10 = document.getElementById('q10-answer').value.trim();
    const q11 = document.getElementById('q11-answer').value.trim();
    const q12 = document.getElementById('q12-answer').value.trim();
    
    if (!q1) {
        alert('Please answer Question 1: How easy was it to understand what the ε (privacy budget) slider represented?');
        return false;
    }
    
    if (!q2) {
        alert('Please answer Question 2: Which of the following did you notice changing most clearly as ε varied?');
        return false;
    }
    
    if (q3.length === 0) {
        alert('Please answer Question 3: What factors most influenced your preferred ε setting? (Select at least one)');
        return false;
    }
    
    if (!q4) {
        alert('Please answer Question 4: Which ε range do you most prefer?');
        return false;
    }
    
    if (!q5) {
        alert('Please answer Question 5: How much did CAPTCHA task difficulty impact your privacy level decisions?');
        return false;
    }
    
    if (!q6) {
        alert('Please answer Question 6: Did the content of the sponsored ads influence your privacy level decisions?');
        return false;
    }
    
    if (!q7) {
        alert('Please answer Question 7: How satisfied are you with the control this system provides over your privacy?');
        return false;
    }
    
    if (!q8) {
        alert('Please answer Question 8: To what extent did you feel protected against tracking while using this platform?');
        return false;
    }
    
    if (!q9) {
        alert('Please answer Question 9: How willing would you be to use such a system in a real-world application?');
        return false;
    }
    
    if (!q10) {
        alert('Please answer Question 10 about your understanding of privacy.');
        return false;
    }
    
    if (!q11) {
        alert('Please answer Question 11 about improvement suggestions.');
        return false;
    }
    
    if (!q12) {
        alert('Please answer Question 12 about acceptable balance.');
        return false;
    }
    
    return true;
}

// Submit questionnaire - GLOBAL SYSTEM: All data goes to Firestore for aggregation
function submitQuestionnaire() {
    // Check if already completed (one-time only)
    if (completionStatus.privacyCompleted) {
        alert('Privacy form has already been submitted.');
        return;
    }
    
    if (!validateQuestionnaire()) {
        return;
    }
    
    const data = collectQuestionnaireData();
    const userId = currentSession.userId || generateUserId();
    
    console.log('[submitQuestionnaire] ✓ Collected questionnaire data for userId:', userId);
    console.log('[submitQuestionnaire] Data:', data);
    
    // CRITICAL: Sync questionnaire data to Firestore FIRST
    // This ensures it's available for global chart aggregation across all users
    console.log('[submitQuestionnaire] 🔄 Syncing to Firestore for global aggregation...');
    syncToFirestore('questionnaire', data, userId).then(() => {
        console.log('[submitQuestionnaire] ✓ Successfully synced questionnaire data to Firestore');
        console.log('[submitQuestionnaire] ✓ This data is now available for ALL users in charts');
    }).catch(err => {
        console.error('[submitQuestionnaire] ❌ Failed to sync questionnaire data to Firestore:', err);
        alert('Warning: Failed to sync data to server. Charts may not update immediately.');
    });
    
    // Store in session for this participant - will be synced when session is finalized
    const sessions = getSessionsFromStorage();
    const sessionId = sessionStorage.getItem('current_session_id');
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    
    if (sessionIndex >= 0) {
        sessions[sessionIndex].questionnaireData = data;
        sessions[sessionIndex].privacyCompleted = true;
        saveSessionsToStorage(sessions);
        console.log('[submitQuestionnaire] ✓ Saved questionnaireData to local session');
    } else {
        console.warn('[submitQuestionnaire] Session not found, creating new session entry');
        const newSession = {
            sessionId: sessionId || `session_${Date.now()}`,
            userId: userId,
            questionnaireData: data,
            privacyCompleted: true,
            consentCompleted: currentSession.consentCompleted || false
        };
        sessions.push(newSession);
        saveSessionsToStorage(sessions);
    }
    
    // Clear progress (form is complete)
    localStorage.removeItem('questionnaireProgress');
    
    // Mark privacy form as completed (this will call finalizeSessionLog)
    // finalizeSessionLog will sync the complete session (including questionnaireData) to Firestore
    markPrivacyCompleted();
    
    // Show success modal
    showPrivacySuccessModal();
}

// Disable privacy form after completion
function disablePrivacyForm() {
    // Disable all inputs
    for (let i = 1; i <= 9; i++) {
        const inputs = document.querySelectorAll(`input[name="q${i}"]`);
        inputs.forEach(input => input.disabled = true);
    }
    
    // Disable textareas
    for (let i = 10; i <= 12; i++) {
        const textarea = document.getElementById(`q${i}-answer`);
        if (textarea) {
            textarea.disabled = true;
        }
    }
    
    // Disable submit button
    const submitBtn = document.querySelector('.submit-container button');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Privacy Form Already Submitted';
        submitBtn.style.opacity = '0.5';
    }
    
    // Hide save progress button if it exists
    const saveBtn = document.querySelector('.save-progress-btn');
    if (saveBtn) {
        saveBtn.style.display = 'none';
    }
}

// Show privacy success message inline
function showPrivacySuccessModal() {
    const successMessage = document.getElementById('privacy-success-message');
    const questionnaireContent = document.getElementById('privacy-questionnaire-content');
    
    if (successMessage) {
        // Hide the questionnaire content
        if (questionnaireContent) {
            questionnaireContent.style.display = 'none';
        }
        // Show the success message inline
        successMessage.style.display = 'flex';
    }
}

// Handle privacy success button click - navigate to account
document.addEventListener('DOMContentLoaded', function() {
    const privacySuccessBtn = document.getElementById('privacy-success-btn');
    if (privacySuccessBtn) {
        privacySuccessBtn.addEventListener('click', function() {
            // Navigate to account page
            const accountLink = document.querySelector('[data-page="account"]');
            if (accountLink) {
                accountLink.click();
            }
        });
    }
    
});

/* ============================================
   CONSENT SUCCESS MODAL
   ============================================ */

// Show consent success message inline
function showConsentSuccessModal() {
    const successMessage = document.getElementById('consent-success-message');
    const formContent = document.getElementById('consent-form-content');
    
    if (successMessage && formContent) {
        // Hide the form content
        formContent.style.display = 'none';
        // Show the success message inline
        successMessage.style.display = 'flex';
    }
}

// Update the proceedToStudy function to show success modal
function proceedToStudyWithModal() {
    // Mark consent as completed
    markConsentCompleted();
    
    // Show success modal
    showConsentSuccessModal();
}

// Hide consent success modal and navigate to privacy settings page
document.addEventListener('DOMContentLoaded', function() {
    const consentSuccessBtn = document.getElementById('consent-success-btn');
    if (consentSuccessBtn) {
        consentSuccessBtn.addEventListener('click', function() {
            const modal = document.getElementById('consent-success-modal');
            if (modal) {
                modal.classList.remove('active');
            }
            
            // Navigate to privacy settings page
            const privacyLink = document.querySelector('[data-page="privacy"]');
            if (privacyLink) {
                privacyLink.click();
            }
        });
    }
});

// Initialize questionnaire when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeQuestionnaire();
});
/* ============================================
   SAVE PROGRESS FUNCTIONALITY
   ============================================ */

// Auto-save progress on input changes
function setupAutoSave() {
    // Don't auto-save if form is already completed
    if (completionStatus.privacyCompleted) return;
    
    // Auto-save on radio/checkbox changes
    for (let i = 1; i <= 9; i++) {
        const inputs = document.querySelectorAll(`input[name="q${i}"]`);
        inputs.forEach(input => {
            input.addEventListener('change', function() {
                saveProgressSilently();
            });
        });
    }
    
    // Auto-save on textarea changes (with debounce)
    let textareaTimeout;
    for (let i = 10; i <= 12; i++) {
        const textarea = document.getElementById(`q${i}-answer`);
        if (textarea) {
            textarea.addEventListener('input', function() {
                clearTimeout(textareaTimeout);
                textareaTimeout = setTimeout(() => {
                    saveProgressSilently();
                }, 1000); // Save 1 second after user stops typing
            });
        }
    }
}

// Save progress silently (without alert)
function saveProgressSilently() {
    if (completionStatus.privacyCompleted) return;
    
    const progressData = {
        q1_understanding: document.querySelector('input[name=\"q1\"]:checked')?.value || '',
        q2_noticed: document.querySelector('input[name="q2"]:checked')?.value || '',
        q3_factors: Array.from(document.querySelectorAll('input[name="q3"]:checked')).map(cb => cb.value),
        q4_preferred_range: document.querySelector('input[name="q4"]:checked')?.value || '',
        q5_captcha_impact: document.querySelector('input[name=\"q5\"]:checked')?.value || '',
        q6_ad_influence: document.querySelector('input[name="q6"]:checked')?.value || '',
        q7_ad_satisfaction: document.querySelector('input[name=\"q7\"]:checked')?.value || '',
        q8_perceived_protection: document.querySelector('input[name=\"q8\"]:checked')?.value || '',
        q9_willingness: document.querySelector('input[name=\"q9\"]:checked')?.value || '',
        q10_privacy_understanding: document.getElementById('q10-answer')?.value || '',
        q11_improvements: document.getElementById('q11-answer')?.value || '',
        q12_balance: document.getElementById('q12-answer')?.value || '',
        savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('questionnaireProgress', JSON.stringify(progressData));
    console.log('Progress auto-saved');
}

// Save progress to localStorage (manual save with feedback)
function saveProgress() {
    if (completionStatus.privacyCompleted) {
        alert('Privacy form has already been submitted.');
        return;
    }
    
    saveProgressSilently();
    
    // Sync to Firestore if available
    const progressData = {
        q1_understanding: document.querySelector('input[name="q1"]:checked')?.value || '',
        q2_noticed: document.querySelector('input[name="q2"]:checked')?.value || '',
        q3_factors: Array.from(document.querySelectorAll('input[name="q3"]:checked')).map(cb => cb.value),
        q4_preferred_range: document.querySelector('input[name="q4"]:checked')?.value || '',
        q5_captcha_impact: document.querySelector('input[name="q5"]:checked')?.value || '',
        q6_ad_influence: document.querySelector('input[name="q6"]:checked')?.value || '',
        q7_ad_satisfaction: document.querySelector('input[name="q7"]:checked')?.value || '',
        q8_perceived_protection: document.querySelector('input[name="q8"]:checked')?.value || '',
        q9_willingness: document.querySelector('input[name="q9"]:checked')?.value || '',
        q10_privacy_understanding: document.getElementById('q10-answer')?.value || '',
        q11_improvements: document.getElementById('q11-answer')?.value || '',
        q12_balance: document.getElementById('q12-answer')?.value || '',
        savedAt: new Date().toISOString()
    };
    
    // Try to sync to Firestore (non-blocking)
    syncToFirestore('privacyProgress', progressData).catch(err => {
        console.log('[saveProgress] Firestore sync failed, data saved to localStorage only');
    });
    
    // Show visual feedback with grey background and cyan tick
    const saveBtn = document.getElementById('save-progress-btn');
    if (saveBtn) {
        const originalText = saveBtn.innerHTML;
        const originalBg = saveBtn.style.backgroundColor || '';
        const originalColor = saveBtn.style.color || '';
        const originalBorder = saveBtn.style.borderColor || '';
        
        saveBtn.innerHTML = '<i class="fas fa-check" style="color: cyan;"></i> Progress Saved!';
        saveBtn.style.backgroundColor = '#1a1a1a';
        saveBtn.style.color = 'white';
        saveBtn.style.borderColor = 'white';
        
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.style.backgroundColor = originalBg;
            saveBtn.style.color = originalColor;
            saveBtn.style.borderColor = originalBorder;
        }, 2000);
    }
}

// Load saved progress
function loadSavedProgress() {
    if (completionStatus.privacyCompleted) {
        return; // Don't load if already completed
    }
    
    const savedData = localStorage.getItem('questionnaireProgress');
    
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            
            // Restore q1 (radio button)
            if (data.q1_understanding) {
                const q1Radio = document.querySelector(`input[name="q1"][value="${data.q1_understanding}"]`);
                if (q1Radio) {
                    q1Radio.checked = true;
                    // Trigger change event to update any dependent UI
                    q1Radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Restore q2 (radio button)
            if (data.q2_noticed) {
                const q2Radio = document.querySelector(`input[name="q2"][value="${data.q2_noticed}"]`);
                if (q2Radio) {
                    q2Radio.checked = true;
                    q2Radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Restore q3 (checkboxes - multiple selections)
            if (data.q3_factors && Array.isArray(data.q3_factors) && data.q3_factors.length > 0) {
                data.q3_factors.forEach(value => {
                    const checkbox = document.querySelector(`input[name="q3"][value="${value}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }
            
            // Restore q4 (radio button)
            if (data.q4_preferred_range) {
                const q4Radio = document.querySelector(`input[name="q4"][value="${data.q4_preferred_range}"]`);
                if (q4Radio) {
                    q4Radio.checked = true;
                    q4Radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Restore q5 (radio button)
            if (data.q5_captcha_impact) {
                const q5Radio = document.querySelector(`input[name="q5"][value="${data.q5_captcha_impact}"]`);
                if (q5Radio) {
                    q5Radio.checked = true;
                    q5Radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Restore q6 (radio button)
            if (data.q6_ad_influence) {
                const q6Radio = document.querySelector(`input[name="q6"][value="${data.q6_ad_influence}"]`);
                if (q6Radio) {
                    q6Radio.checked = true;
                    q6Radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Restore q7 (radio button)
            if (data.q7_ad_satisfaction) {
                const q7Radio = document.querySelector(`input[name="q7"][value="${data.q7_ad_satisfaction}"]`);
                if (q7Radio) {
                    q7Radio.checked = true;
                    q7Radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Restore q8 (radio button)
            if (data.q8_perceived_protection) {
                const q8Radio = document.querySelector(`input[name="q8"][value="${data.q8_perceived_protection}"]`);
                if (q8Radio) {
                    q8Radio.checked = true;
                    q8Radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Restore q9 (radio button)
            if (data.q9_willingness) {
                const q9Radio = document.querySelector(`input[name="q9"][value="${data.q9_willingness}"]`);
                if (q9Radio) {
                    q9Radio.checked = true;
                    q9Radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Restore text areas
            if (data.q10_privacy_understanding) {
                const q10 = document.getElementById('q10-answer');
                if (q10) {
                    q10.value = data.q10_privacy_understanding;
                    q10.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            
            if (data.q11_improvements) {
                const q11 = document.getElementById('q11-answer');
                if (q11) {
                    q11.value = data.q11_improvements;
                    q11.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            
            if (data.q12_balance) {
                const q12 = document.getElementById('q12-answer');
                if (q12) {
                    q12.value = data.q12_balance;
                    q12.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            
            console.log('[loadSavedProgress] Progress restored from localStorage:', data);
            
            // Update progress bar after a short delay to ensure all events have fired
            setTimeout(() => {
                if (typeof updatePrivacyFormProgress === 'function') {
                    updatePrivacyFormProgress();
                }
            }, 100);
        } catch (err) {
            console.error('[loadSavedProgress] Error loading progress:', err);
        }
    }
}

// Initialize Save Progress button
document.addEventListener('DOMContentLoaded', function() {
    const saveProgressBtn = document.getElementById('save-progress-btn');
    if (saveProgressBtn) {
        saveProgressBtn.addEventListener('click', saveProgress);
    }
    
    // Wire up submit button
    const submitBtn = document.getElementById('submit-questionnaire-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            submitQuestionnaire();
        });
    }
    
    // Load saved progress when page loads
    loadSavedProgress();
});

// ===================================
// PRIVACY FORM COMPLETION TRACKER
// ===================================
// Add this code to your scripts.js file

// Initialize privacy form completion tracking
function initPrivacyFormTracking() {
    // Track all radio button questions (q1-q9)
    for (let i = 1; i <= 9; i++) {
        const radioInputs = document.querySelectorAll(`input[name="q${i}"]`);
        radioInputs.forEach(input => {
            input.addEventListener('change', updatePrivacyFormProgress);
        });
    }

    // Track all checkbox questions (q3)
    const checkboxInputs = document.querySelectorAll('input[name="q3"]');
    checkboxInputs.forEach(input => {
        input.addEventListener('change', updatePrivacyFormProgress);
    });

    // Track all textarea questions (q10-q12)
    for (let i = 10; i <= 12; i++) {
        const textarea = document.getElementById(`q${i}-answer`);
        if (textarea) {
            textarea.addEventListener('input', updatePrivacyFormProgress);
        }
    }

    // Initial progress check
    updatePrivacyFormProgress();
}

// Update privacy form progress
function updatePrivacyFormProgress() {
    let completedCount = 0;
    const totalQuestions = 12;

    // Check radio button questions (q1, q2, q4, q5, q6, q7, q8, q9)
    const radioQuestions = ['q1', 'q2', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'];
    radioQuestions.forEach(questionName => {
        const selectedRadio = document.querySelector(`input[name="${questionName}"]:checked`);
        if (selectedRadio) {
            completedCount++;
        }
    });

    // Check checkbox question (q3) - at least one checkbox must be selected
    const checkboxes = document.querySelectorAll('input[name="q3"]:checked');
    if (checkboxes.length > 0) {
        completedCount++;
    }

    // Check textarea questions (q10-q12) - must have at least some text
    for (let i = 10; i <= 12; i++) {
        const textarea = document.getElementById(`q${i}-answer`);
        if (textarea && textarea.value.trim().length > 0) {
            completedCount++;
        }
    }

    // Update progress bar and text
    const progressFill = document.getElementById('privacyProgressFill');
    const progressText = document.getElementById('privacyProgressText');
    const submitBtn = document.getElementById('submit-questionnaire-btn');

    if (!progressFill || !progressText || !submitBtn) return;

    const percentage = (completedCount / totalQuestions) * 100;
    progressFill.style.width = percentage + '%';
    progressText.textContent = completedCount + ' of 12 items completed';

    // Enable submit button only when all 12 questions are completed
    if (completedCount === totalQuestions) {
        submitBtn.classList.add('active');
        submitBtn.disabled = false;
    } else {
        submitBtn.classList.remove('active');
        submitBtn.disabled = true;
    }
}

// Call this function when the privacy form page is loaded
// Add this to your existing page navigation code or DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function() {
    initPrivacyFormTracking();
    
    // Initialize analytics charts if on home page
    if (document.getElementById('analytics-root')) {
        initializeAnalyticsCharts();
    }
});

// Also call when navigating to the privacy form page
// If you have a navigation function, add this:

function navigateToPrivacyForm() {
    // Your existing navigation code...
    
    // Then initialize tracking
    setTimeout(() => {
        initPrivacyFormTracking();
    }, 100);
}

// Custom color palette from charts.py
const CYAN = '#00ffff';
const GREEN = '#22c55e';
const YELLOW = '#eab308';
const PURPLE = '#a855f7';
const RED = '#ef4444';
const GRAY = '#888888';
const WHITE = '#ffffff';
const BACKGROUND_COLOR = '#000000';
const GRID_COLOR = '#333333';
const TEXT_COLOR = '#cccccc';

// Global Chart.js configuration for dark theme
Chart.defaults.color = TEXT_COLOR;
Chart.defaults.borderColor = GRID_COLOR;
Chart.defaults.font.family = 'serif';
Chart.defaults.plugins.legend.labels.color = TEXT_COLOR;
Chart.defaults.plugins.title.color = CYAN;
Chart.defaults.plugins.title.font = {
    size: 16,
    weight: 'bold'
};

// Global chart instances storage - prevents "Canvas already in use" errors
const chartInstances = {
    chart1: null,
    chart2: null,
    chart3: null,
    chart4: null,
    chart5: null,
    chart6: null
};

// Helper function to create a chart - destroys existing instance first
function createChart(ctx, config) {
    // Get canvas ID from context
    const canvasId = ctx.canvas.id;
    const chartKey = canvasId || 'unknown';
    
    // Destroy existing chart instance if it exists
    if (chartInstances[chartKey] && typeof chartInstances[chartKey].destroy === 'function') {
        console.log(`[createChart] Destroying existing chart instance for ${chartKey}`);
        chartInstances[chartKey].destroy();
        chartInstances[chartKey] = null;
    }
    
    // Create new chart instance
    const newChart = new Chart(ctx, config);
    chartInstances[chartKey] = newChart;
    
    return newChart;
}

/* ============================================
   GLOBAL CHART SYSTEM - FIRESTORE ONLY
   ============================================
   
   ALL 6 CHARTS USE THIS GLOBAL SYSTEM:
   - Chart 1: Participant Volume (uses getAllCompletedSessions from Firestore)
   - Chart 2: Factors Influencing Privacy Choice (uses getAllQuestionnaireResponses from Firestore)
   - Chart 3: Final Selected Privacy Level (uses getAllQuestionnaireResponses from Firestore)
   - Chart 4: What Participants Noticed (uses getAllQuestionnaireResponses from Firestore)
   - Chart 5: Willingness to Trade (uses getAllQuestionnaireResponses from Firestore)
   - Chart 6: Perceived Protection (uses getAllQuestionnaireResponses from Firestore)
   
   KEY PRINCIPLES:
   1. ALL data comes from Firestore - NO localStorage fallbacks for chart data
   2. Data is aggregated across ALL participants from ALL sessions
   3. Charts show cumulative totals - never reset to 0 unless Firestore is empty
   4. New users see aggregated data from all previous participants
   5. Real-time updates when new participants complete forms
   ============================================ */

// Get all questionnaire responses from Firestore ONLY (global aggregated data)
// This function aggregates data from ALL users across ALL sessions
// Used by Charts 2, 3, 4, 5, 6
function getAllQuestionnaireResponses() {
    const responses = [];
    const seenUserIds = new Set(); // Track unique user IDs to avoid duplicates
    
    // ONLY use Firestore cache - no localStorage fallbacks
    // This ensures charts show global aggregated data from all participants
    if (firestoreDataCache.questionnaires && firestoreDataCache.questionnaires.length > 0) {
        console.log('[getAllQuestionnaireResponses] Firestore cache has', firestoreDataCache.questionnaires.length, 'questionnaires from all participants');
        
        firestoreDataCache.questionnaires.forEach((data, index) => {
            // Extract userId from the cache structure
            const userId = data.userId || data.data?.userId;
            
            // Extract questionnaire data - handle both structures:
            // 1. { data: { q1: ..., q2: ... }, userId: ... } (from loadAllDataFromFirestore or real-time handler)
            // 2. { q1: ..., q2: ..., userId: ... } (direct questionnaire data)
            let questionnaireData = null;
            if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
                // Structure 1: nested data
                questionnaireData = data.data;
            } else if (data.q1_understanding !== undefined || data.q2_noticed !== undefined) {
                // Structure 2: direct questionnaire data (has questionnaire fields)
                questionnaireData = data;
            } else {
                // Fallback: try data.data or data itself
                questionnaireData = data.data || data;
            }
            
            // Validate that we have actual questionnaire data
            if (questionnaireData && typeof questionnaireData === 'object' && Object.keys(questionnaireData).length > 0) {
                // Check if it has at least one questionnaire field
                const hasQuestionnaireFields = questionnaireData.q1_understanding !== undefined || 
                                             questionnaireData.q2_noticed !== undefined ||
                                             questionnaireData.q3_factors !== undefined ||
                                             questionnaireData.q4_preferred_range !== undefined;
                
                if (hasQuestionnaireFields && userId && !seenUserIds.has(userId)) {
                    seenUserIds.add(userId);
                    responses.push(questionnaireData);
                    console.log(`[getAllQuestionnaireResponses] ✓ Added questionnaire from Firestore for userId: ${userId}`);
                } else if (!hasQuestionnaireFields) {
                    console.warn(`[getAllQuestionnaireResponses] ⚠️ Skipping invalid questionnaire data at index ${index} (missing fields)`);
                } else if (!userId) {
                    console.warn(`[getAllQuestionnaireResponses] ⚠️ Skipping questionnaire without userId at index ${index}`);
                } else if (seenUserIds.has(userId)) {
                    console.log(`[getAllQuestionnaireResponses] ⊘ Skipping duplicate userId: ${userId}`);
                }
            }
        });
    } else {
        console.log('[getAllQuestionnaireResponses] No questionnaire data in Firestore cache yet');
        console.log('[getAllQuestionnaireResponses] Firestore cache status:', {
            questionnaires: firestoreDataCache.questionnaires?.length || 0,
            lastUpdated: firestoreDataCache.lastUpdated || 'never'
        });
    }
    
    console.log('[getAllQuestionnaireResponses] ✓ Total aggregated responses from ALL participants:', responses.length);
    
    // Detailed logging for debugging
    if (responses.length > 0) {
        console.log('[getAllQuestionnaireResponses] Sample response structure:', {
            userId: responses[0].userId || 'unknown',
            q2_noticed: responses[0].q2_noticed,
            q3_factors: responses[0].q3_factors,
            q4_preferred_range: responses[0].q4_preferred_range,
            q8_perceived_protection: responses[0].q8_perceived_protection,
            q9_willingness: responses[0].q9_willingness
        });
    } else {
        console.warn('[getAllQuestionnaireResponses] ⚠️ NO RESPONSES FOUND IN FIRESTORE!');
        console.warn('[getAllQuestionnaireResponses] This means either:');
        console.warn('  1. No participants have completed both forms yet');
        console.warn('  2. Firestore data has not been loaded yet');
        console.warn('  3. Data extraction from sessions is not working');
        console.warn('[getAllQuestionnaireResponses] Firestore cache:', firestoreDataCache);
    }
    
    return responses;
}

// Get all sessions with final epsilon values
function getSessionsWithEpsilon() {
    return getSessionsFromStorage().filter(s => s.finalEpsilon && s.finalEpsilon !== 'N/A');
}

// Get all completed sessions from Firestore ONLY (global aggregated data)
// This function aggregates data from ALL users across ALL sessions
function getAllCompletedSessions() {
    const sessions = [];
    const seenUserIds = new Set(); // Track unique user IDs to avoid duplicates
    
    // ONLY use Firestore cache - no localStorage fallbacks
    // This ensures Chart 1 shows global aggregated data from all participants
    if (firestoreDataCache.sessions && firestoreDataCache.sessions.length > 0) {
        console.log('[getAllCompletedSessions] Firestore cache has', firestoreDataCache.sessions.length, 'sessions from all participants');
        
        firestoreDataCache.sessions.forEach((sessionData, index) => {
            // Only include completed sessions (both forms completed)
            if (sessionData.consentCompleted === true && sessionData.privacyCompleted === true) {
                const userId = sessionData.userId;
                
                // Avoid duplicates - use the most recent session for each user
                if (userId && !seenUserIds.has(userId)) {
                    seenUserIds.add(userId);
                    sessions.push(sessionData);
                    console.log(`[getAllCompletedSessions] ✓ Added completed session from Firestore for userId: ${userId}`);
                } else if (seenUserIds.has(userId)) {
                    console.log(`[getAllCompletedSessions] ⊘ Skipping duplicate userId: ${userId}`);
                }
            }
        });
    } else {
        console.log('[getAllCompletedSessions] No session data in Firestore cache yet');
        console.log('[getAllCompletedSessions] Firestore cache status:', {
            sessions: firestoreDataCache.sessions?.length || 0,
            lastUpdated: firestoreDataCache.lastUpdated || 'never'
        });
    }
    
    console.log('[getAllCompletedSessions] ✓ Total aggregated completed sessions from ALL participants:', sessions.length);
    return sessions;
}

// Count sessions by date for Chart 1 - GLOBAL SYSTEM: Uses Firestore data only
function getSessionCountsByDate(period = 'all') {
    // Use Firestore data instead of localStorage for global aggregation
    const completedSessions = getAllCompletedSessions();
    const counts = {};
    
    console.log('Chart 1 - Total completed sessions from Firestore:', completedSessions.length);
    console.log('Chart 1 - Completed sessions data:', completedSessions.map(s => ({
        userId: s.userId,
        date: s.date,
        consentCompleted: s.consentCompleted,
        privacyCompleted: s.privacyCompleted
    })));
    
    // Track unique user IDs per date to avoid duplicates
    const uniqueUsersByDate = {};
    
    completedSessions.forEach(session => {
        if (!session.date) {
            console.log('Chart 1 - Session missing date:', session.userId);
            return;
        }
        
        try {
            // Parse date (format: DD/MM/YYYY or DD/MM/YY from en-GB locale)
            const dateParts = session.date.split('/');
            if (dateParts.length !== 3) {
                console.log('Chart 1 - Invalid date format:', session.date);
                return;
            }
            
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed (en-GB format is DD/MM/YYYY)
            let year = parseInt(dateParts[2], 10);
            
            // Handle both YY and YYYY formats
            if (year < 100) {
                year = 2000 + year;
            }
            
            console.log(`Chart 1 - Parsed date for ${session.userId}: day=${day}, month=${month}, year=${year}`);
            
            const date = new Date(year, month, day);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            let key;
            if (period === 'all') {
                // Group by month
                key = `${monthNames[month]} ${year}`;
            } else {
                // Group by week for specific months
                const monthName = period.substring(0, 3).toLowerCase();
                const targetMonthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthName);
                
                if (targetMonthIndex >= 0 && month === targetMonthIndex) {
                    // Correct week calculation: weeks are 1-7, 8-14, 15-21, 22-end
                    let weekStart, weekEnd;
                    if (day <= 7) {
                        weekStart = 1;
                        weekEnd = 7;
                    } else if (day <= 14) {
                        weekStart = 8;
                        weekEnd = 14;
                    } else if (day <= 21) {
                        weekStart = 15;
                        weekEnd = 21;
                    } else {
                        weekStart = 22;
                        weekEnd = new Date(year, month + 1, 0).getDate(); // Last day of month
                    }
                    key = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${weekStart}-${weekEnd}`;
                    console.log(`Chart 1 - Generated key for ${session.userId}: "${key}" (day ${day} in month ${month})`);
                } else {
                    console.log(`Chart 1 - Session ${session.userId} not in target month (session month: ${month}, target: ${targetMonthIndex})`);
                    return; // Skip if not in target month
                }
            }
            
            // Track unique user IDs per key (date period)
            if (!uniqueUsersByDate[key]) {
                uniqueUsersByDate[key] = new Set();
            }
            
            // Only count each user ID once per period
            if (!uniqueUsersByDate[key].has(session.userId)) {
                uniqueUsersByDate[key].add(session.userId);
                counts[key] = (counts[key] || 0) + 1;
                console.log(`Chart 1 - Added participant ${session.userId} to key "${key}", count now: ${counts[key]}`);
            } else {
                console.log(`Chart 1 - Participant ${session.userId} already counted for key "${key}"`);
            }
        } catch (e) {
            console.error('Chart 1 - Error parsing date:', session.date, e);
        }
    });
    
    console.log('Chart 1 - Final counts object:', counts);
    return counts;
}

// Generate dynamic labels based on period and current date
function generateChart1Labels(period = 'all') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNamesLower = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    if (period === 'all') {
        // Generate labels for all months from Nov 2025 to current month
        const labels = [];
        let startYear = 2025;
        let startMonth = 10; // November (0-indexed)
        
        // Generate up to current month
        while (startYear < currentYear || (startYear === currentYear && startMonth <= currentMonth)) {
            labels.push(`${monthNames[startMonth]} ${startYear}`);
            startMonth++;
            if (startMonth > 11) {
                startMonth = 0;
                startYear++;
            }
        }
        
        return labels;
    } else {
        // Generate week labels for specific month - only up to current date
        const monthName = period.substring(0, 3).toLowerCase();
        const targetMonthIndex = monthNamesLower.indexOf(monthName);
        const targetYear = period.length > 6 ? parseInt(period.substring(3)) : currentYear;
        
        if (targetMonthIndex < 0) return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        
        const daysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
        const labels = [];
        const monthNameCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        
        // Check if this is the current month
        const isCurrentMonth = (targetYear === currentYear && targetMonthIndex === currentMonth);
        const currentDay = now.getDate();
        
        // Generate week labels: Always show all 4 week periods (1-7, 8-14, 15-21, 22-end)
        // This ensures all 4 date durations are shown in each month
        labels.push(`${monthNameCap} 1-7`);
        labels.push(`${monthNameCap} 8-14`);
        labels.push(`${monthNameCap} 15-21`);
        const lastWeekStart = 22;
        const lastWeekEnd = daysInMonth;
        labels.push(`${monthNameCap} ${lastWeekStart}-${lastWeekEnd}`);
        
        return labels;
    }
}

// Get title for chart based on period
function getChart1Title(period = 'all') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    if (period === 'all') {
        return `Months (Nov 2025 - ${monthNames[currentMonth]} ${currentYear})`;
    } else {
        const monthName = period.substring(0, 3).toLowerCase();
        const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthName);
        if (monthIndex >= 0) {
            const year = period.length > 6 ? period.substring(3) : currentYear;
            return `Month (${monthNames[monthIndex]} ${year})`;
        }
        return 'Month';
    }
}

let chart1DropdownInitialized = false; // Track if dropdown has been initialized
// Note: chart1Instance is now managed in global chartInstances object

// ===========================================================================
// CHART 1: Participant Count Over Time (Line Chart)
// Maps to Logs Page: Session data from completed sessions (consentCompleted && privacyCompleted)
// Shows participant count across all 4 date durations in each month (1-7, 8-14, 15-21, 22-end)
// ===========================================================================
function renderChart1WithDropdown(selectedPeriod = 'all') {
    const ctx = document.getElementById('chart1').getContext('2d');
    
    // Get real data from sessions
    const sessionCounts = getSessionCountsByDate(selectedPeriod);
    console.log('Chart 1 - Session counts:', sessionCounts);
    console.log('Chart 1 - Selected period:', selectedPeriod);
    
    // Generate dynamic labels based on period
    const labels = generateChart1Labels(selectedPeriod);
    console.log('Chart 1 - Labels:', labels);
    
    // Map session counts to labels - show 0 for periods with no data
    const dataValues = labels.map((label, labelIndex) => {
        // Find matching key in sessionCounts
        let matched = false;
        let matchedValue = 0;
        
        for (const key in sessionCounts) {
            // For "all" period, match month and year
            if (selectedPeriod === 'all') {
                const labelParts = label.split(' ');
                const labelMonth = labelParts[0];
                const labelYear = labelParts[1];
                if (key.includes(labelMonth) && key.includes(labelYear)) {
                    matchedValue = sessionCounts[key];
                    matched = true;
                    console.log(`Chart 1 - Matched label "${label}" to key "${key}" with value ${matchedValue}`);
                    break;
                }
            } else {
                // For specific months, match week ranges exactly
                // Normalize both strings for comparison
                const normalizedLabel = label.toLowerCase().replace(/\s+/g, ' ').trim();
                const normalizedKey = key.toLowerCase().replace(/\s+/g, ' ').trim();
                console.log(`Chart 1 - Comparing label "${normalizedLabel}" with key "${normalizedKey}"`);
                if (normalizedLabel === normalizedKey) {
                    matchedValue = sessionCounts[key];
                    matched = true;
                    console.log(`Chart 1 - Matched! Label "${label}" = Key "${key}" with value ${matchedValue}`);
                    break;
                }
            }
        }
        
        if (!matched) {
            console.log(`Chart 1 - No match found for label "${label}" at index ${labelIndex}`);
        }
        
        // Return matched value or 0 for periods with no data
        return matchedValue;
    });
    
    // Calculate cumulative totals for "all" period
    let finalData = dataValues;
    if (selectedPeriod === 'all' && dataValues.length > 0) {
        let cumulative = 0;
        finalData = dataValues.map(val => {
            cumulative += (val || 0);
            return cumulative;
        });
    }
    
    console.log('Chart 1 - Data values:', dataValues);
    console.log('Chart 1 - Final data:', finalData);
    console.log('Chart 1 - Max value:', finalData.length > 0 ? Math.max(...finalData) : 0);
    
    // Get title dynamically
    const title = getChart1Title(selectedPeriod);
    
    const data = {
        labels: labels,
        datasets: [{
            label: 'Number of Participants',
            data: finalData,
            borderColor: CYAN,
            backgroundColor: 'rgba(0, 255, 255, 0.2)',
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: CYAN,
            pointBorderColor: CYAN,
            tension: 0.4,
            fill: true
        }]
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 10,
                    right: 15,
                    bottom: 10,
                    left: 10
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Participant Volume on Zynex Dashboard',
                    align: 'center'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: title,
                        align: 'center',
                        color: CYAN
                    },
                    ticks: {
                        color: TEXT_COLOR,
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: GRID_COLOR
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Participants',
                        align: 'center',
                        color: CYAN
                    },
                    // Auto-scale Y-axis based on data - ensure it shows data properly
                    min: 0,
                    max: (() => {
                        const maxValue = finalData.length > 0 ? Math.max(...finalData) : 0;
                        console.log('Chart 1 - Y-axis max calculation: maxValue =', maxValue, 'finalData =', finalData);
                        // If max value is 0, show at least 1. If there's data, add padding
                        if (maxValue === 0) {
                            return 1; // Show at least 1 so the axis is visible
                        }
                        // Add padding: for small values (1-10), add 1. For larger values, add 10%
                        if (maxValue <= 10) {
                            return maxValue + 1;
                        }
                        return Math.ceil(maxValue * 1.1);
                    })(),
                    ticks: {
                        color: TEXT_COLOR,
                        stepSize: (() => {
                            const maxValue = finalData.length > 0 ? Math.max(...finalData) : 0;
                            // If max is small (1-10), use step of 1. Otherwise auto-calculate
                            if (maxValue <= 10) return 1;
                            return undefined; // Auto-calculate for larger values
                        })(),
                        precision: 0
                    },
                    grid: {
                        color: GRID_COLOR
                    }
                }
            }
        }
    };

    // Destroy existing chart if it exists (now handled by createChart function)
    // createChart will automatically destroy any existing instance
    chartInstances.chart1 = createChart(ctx, config);
}

function updateCurrentMonthIndicator() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNamesShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    const dropdown = document.getElementById('chart1-dropdown');
    if (dropdown) {
        // Remove "(This Month)" from all options first
        dropdown.querySelectorAll('option').forEach(option => {
            if (option.textContent.includes('(This Month)')) {
                option.textContent = option.textContent.replace(' (This Month)', '');
            }
        });
        
        // Add "(This Month)" to current month option
        const currentMonthKey = monthNamesShort[currentMonth] + currentYear;
        const currentOption = dropdown.querySelector(`option[value="${currentMonthKey}"]`);
        if (currentOption && !currentOption.textContent.includes('(This Month)')) {
            currentOption.textContent = `${monthNames[currentMonth]} ${currentYear} (This Month)`;
        }
    }
}

function initializeChart1Dropdown() {
    // Only initialize once to prevent dropdown from closing
    if (chart1DropdownInitialized) {
        return;
    }
    
    const dropdown = document.getElementById('chart1-dropdown');
    if (dropdown) {
        // Add event listener to the dropdown (don't clone/replace to avoid closing it)
        dropdown.addEventListener('change', function(e) {
            // Don't prevent default - let the dropdown work normally
            const selectedValue = this.value;
            // Store the selected value to prevent reversion
            sessionStorage.setItem('chart1-selected-period', selectedValue);
            renderChart1WithDropdown(selectedValue);
        });
        
        // Prevent click events from closing the dropdown
        dropdown.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
        
        dropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        // Prevent focus/blur events from interfering
        dropdown.addEventListener('focus', function(e) {
            e.stopPropagation();
        });
        
        dropdown.addEventListener('blur', function(e) {
            // Allow blur to happen naturally, but don't let it propagate
            e.stopPropagation();
        });
        
        // Restore previously selected value or set default
        const savedPeriod = sessionStorage.getItem('chart1-selected-period');
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        if (savedPeriod && dropdown.querySelector(`option[value="${savedPeriod}"]`)) {
            dropdown.value = savedPeriod;
            renderChart1WithDropdown(savedPeriod);
        } else {
            // Set default to current month if available, otherwise "all"
            const currentMonthKey = monthNames[currentMonth] + currentYear;
            if (dropdown.querySelector(`option[value="${currentMonthKey}"]`)) {
                dropdown.value = currentMonthKey;
                renderChart1WithDropdown(currentMonthKey);
                sessionStorage.setItem('chart1-selected-period', currentMonthKey);
            } else {
                dropdown.value = 'all';
                renderChart1WithDropdown('all');
                sessionStorage.setItem('chart1-selected-period', 'all');
            }
        }
        
        updateCurrentMonthIndicator();
        
        // Mark as initialized
        chart1DropdownInitialized = true;
    }
}

function renderChart1() {
    // Initialize dropdown only once
    if (!chart1DropdownInitialized) {
        initializeChart1Dropdown();
    } else {
        // If already initialized, just render the chart with current selection
        const dropdown = document.getElementById('chart1-dropdown');
        if (dropdown) {
            const selectedPeriod = dropdown.value || sessionStorage.getItem('chart1-selected-period') || 'all';
            renderChart1WithDropdown(selectedPeriod);
        } else {
            renderChart1WithDropdown('all');
        }
    }
}

// ===========================================================================
// CHART 2: Factors Influencing Privacy Choice (Stacked Bar Chart)
// Maps to Privacy Form: Q3 (factors influencing choice) and Q4 (preferred range)
// Q3 values: "captcha", "speed" (System latency), "ads", "curiosity"
// Q4 values: "high-privacy" (0.1-1.5), "medium" (1.6-3.0), "low-privacy" (3.1-5.0)
// ===========================================================================
function renderChart2() {
    const ctx = document.getElementById('chart2').getContext('2d');
    const privacyLevels = ['High\n(0.1-1.5)', 'Medium\n(1.6-3.0)', 'Low\n(3.1-5.0)'];
    
    // Get real data from questionnaire responses (Q3: factors, Q4: preferred range)
    const responses = getAllQuestionnaireResponses();
    
    // Initialize counters for each factor by privacy level (from Q4)
    // Q3 values: "captcha", "speed" (System latency), "ads", "curiosity"
    const factorCounts = {
        captcha: [0, 0, 0],
        speed: [0, 0, 0],      // System latency (form uses "speed" not "latency")
        ads: [0, 0, 0],
        curiosity: [0, 0, 0]  // Direct mapping for curiosity
    };
    
    // Map Q4 values to privacy level index (matching actual stored values)
    const getPrivacyLevelIndex = (q4Value) => {
        if (!q4Value) return 2; // Default to Low
        if (q4Value === 'high-privacy') return 0; // High privacy (0.1-1.5)
        if (q4Value === 'medium') return 1; // Medium privacy (1.6-3.0)
        if (q4Value === 'low-privacy') return 2; // Low privacy (3.1-5.0)
        // Legacy support for old values
        if (q4Value === 'low') return 0; // High privacy (legacy)
        if (q4Value === 'high') return 1; // Medium privacy (legacy)
        if (q4Value === 'very-high') return 2; // Low privacy (legacy)
        return 2; // Default to Low
    };
    
    console.log('Chart 2 - Total responses:', responses.length);
    console.log('Chart 2 - Responses data:', responses.map(r => ({
        q3_factors: r.q3_factors,
        q4_preferred_range: r.q4_preferred_range
    })));
    
    responses.forEach((response) => {
        const factors = response.q3_factors || [];
        const q4Value = response.q4_preferred_range;
        const levelIndex = getPrivacyLevelIndex(q4Value);
        
        console.log(`Chart 2 - Processing response: q3_factors=${factors.join(', ')}, q4=${q4Value}, levelIndex=${levelIndex}`);
        
        factors.forEach(factor => {
            // Map form values to chart factors
            if (factor === 'captcha' && factorCounts.captcha) {
                factorCounts.captcha[levelIndex]++;
                console.log(`Chart 2 - Incremented captcha for level ${levelIndex}, count now: ${factorCounts.captcha[levelIndex]}`);
            }
            // Form uses "speed" for System latency
            if (factor === 'speed' && factorCounts.speed) {
                factorCounts.speed[levelIndex]++;
                console.log(`Chart 2 - Incremented speed (latency) for level ${levelIndex}, count now: ${factorCounts.speed[levelIndex]}`);
            }
            // Legacy support: also check for "latency" in case old data exists
            if (factor === 'latency' && factorCounts.speed) {
                factorCounts.speed[levelIndex]++;
                console.log(`Chart 2 - Incremented latency (legacy) for level ${levelIndex}, count now: ${factorCounts.speed[levelIndex]}`);
            }
            if (factor === 'ads' && factorCounts.ads) {
                factorCounts.ads[levelIndex]++;
                console.log(`Chart 2 - Incremented ads for level ${levelIndex}, count now: ${factorCounts.ads[levelIndex]}`);
            }
            if (factor === 'curiosity' && factorCounts.curiosity) {
                factorCounts.curiosity[levelIndex]++;
                console.log(`Chart 2 - Incremented curiosity for level ${levelIndex}, count now: ${factorCounts.curiosity[levelIndex]}`);
            }
        });
    });
    
    console.log('Chart 2 - Final factor counts:', factorCounts);
    
    // Map to chart data (using captcha, speed/latency, ads, and curiosity)
    const captcha = factorCounts.captcha;
    const latency = factorCounts.speed; // Use speed data for latency display
    const ads = factorCounts.ads;
    const curiosity = factorCounts.curiosity; // Direct mapping

    const data = {
        labels: privacyLevels,
        datasets: [
            { label: 'CAPTCHA frequency', data: captcha, backgroundColor: CYAN },
            { label: 'System latency', data: latency, backgroundColor: GREEN },
            { label: 'Ad targeting', data: ads, backgroundColor: YELLOW },
            { label: 'Curiosity', data: curiosity, backgroundColor: RED }
        ]
    };

    const config = {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Factors Influencing Participants` Privacy Level Choice'
                },
                legend: {
                    position: 'bottom',
                    align: 'center'
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Chosen Privacy Level ',
                        align: 'center',
                        color: CYAN
                    },
                    ticks: { color: TEXT_COLOR },
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Number of Participants',
                        align: 'center',
                        color: CYAN
                    },
                    min: 0,
                    max: (() => {
                        // Calculate maximum total (sum of all stacks) per category for stacked bars
                        const totals = privacyLevels.map((_, index) => 
                            captcha[index] + latency[index] + ads[index] + curiosity[index]
                        );
                        const maxValue = totals.length > 0 ? Math.max(...totals) : 0;
                        // If max is 0, show at least 1. Otherwise add 10% padding with minimum of 1
                        if (maxValue === 0) return 1;
                        return Math.max(maxValue * 1.1, maxValue + 1);
                    })(),
                    ticks: { 
                        color: TEXT_COLOR,
                        stepSize: (() => {
                            const totals = privacyLevels.map((_, index) => 
                                captcha[index] + latency[index] + ads[index] + curiosity[index]
                            );
                            const maxValue = totals.length > 0 ? Math.max(...totals) : 0;
                            // Use step of 1 for small values, auto for larger
                            if (maxValue <= 5) return 1;
                            return undefined; // Auto-calculate for larger values
                        })()
                    },
                    grid: { color: GRID_COLOR }
                }
            }
        }
    };

    createChart(ctx, config);
}

// ===========================================================================
// CHART 3: Users' Final Privacy Level (Column Chart)
// Maps to Privacy Form: Q4 (preferred range)
// Q4 values: "high-privacy" (0.1-1.5), "medium" (1.6-3.0), "low-privacy" (3.1-5.0)
// ===========================================================================
function renderChart3() {
    const ctx = document.getElementById('chart3').getContext('2d');
    const levels = ['High (0.1 - 1.5)', 'Medium (1.6 - 3.0)', 'Low (3.1 - 5.0)'];
    
    // Get real data from questionnaire responses (Q4: preferred range)
    const responses = getAllQuestionnaireResponses();
    const counts = [0, 0, 0];
    
    responses.forEach(response => {
        const q4Value = response.q4_preferred_range;
        if (!q4Value) return;
        
        // Map Q4 values to privacy levels (matching actual stored values)
        if (q4Value === 'high-privacy') {
            counts[0]++; // High privacy (0.1-1.5)
        } else if (q4Value === 'medium') {
            counts[1]++; // Medium privacy (1.6-3.0)
        } else if (q4Value === 'low-privacy') {
            counts[2]++; // Low privacy (3.1-5.0)
        }
        // Legacy support for old values
        else if (q4Value === 'low') {
            counts[0]++; // High privacy (legacy)
        } else if (q4Value === 'high') {
            counts[1]++; // Medium privacy (legacy)
        } else if (q4Value === 'very-high') {
            counts[2]++; // Low privacy (legacy)
        }
    });

    const data = {
        labels: levels,
        datasets: [{
            label: 'Participation Frequency',
            data: counts,
            backgroundColor: CYAN,
            barPercentage: 0.6
        }]
    };

    const config = {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: "Participants` Final Selected Privacy Level",
                    align: 'center'
                },
                legend: {
                    display: false
                },
                datalabels: { // Using a hypothetical datalabels plugin for Chart.js
                    display: true,
                    color: BACKGROUND_COLOR,
                    anchor: 'center',
                    align: 'center',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value) => value
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Chosen Privacy Level',
                        align: 'center',
                        color: CYAN
                    },
                    ticks: { color: TEXT_COLOR },
                    grid: { display: false }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Participants',
                        align: 'center',
                        color: CYAN
                    },
                    min: 0,
                    suggestedMax: Math.max(...counts, 10),
                    ticks: {
                        stepSize: 5,
                        color: TEXT_COLOR
                    },
                    grid: { color: GRID_COLOR }
                }
            }
        }
    };

    // Note: Chart.js does not include datalabels by default. 
    // The user will need to include 'chartjs-plugin-datalabels' for this to work as intended.
    // I will proceed with the assumption that they can add the plugin or accept the chart without labels.
    createChart(ctx, config);
}

// ===========================================================================
// ===========================================================================
// CHART 4: What Users Noticed Most (Heatmap Table)
// Maps to Privacy Form: Q2 (what they noticed) and Q4 (preferred range)
// Q2 values: "captcha", "ads", "latency", "none"
// Q4 values: "high-privacy" (0.1-1.5), "medium" (1.6-3.0), "low-privacy" (3.1-5.0)
// ===========================================================================
function updateHeatmapTable() {
    const responses = getAllQuestionnaireResponses();
    
    // Initialize counters: [privacyLevel][whatNoticed]
    const counts = {
        high: { captcha: 0, ads: 0, latency: 0, none: 0 },
        medium: { captcha: 0, ads: 0, latency: 0, none: 0 },
        low: { captcha: 0, ads: 0, latency: 0, none: 0 }
    };
    
    // Map Q4 values to privacy level (matching actual stored values)
    const getPrivacyLevel = (q4Value) => {
        if (!q4Value) return 'low';
        if (q4Value === 'high-privacy') return 'high'; // High privacy (0.1-1.5)
        if (q4Value === 'medium') return 'medium'; // Medium privacy (1.6-3.0)
        if (q4Value === 'low-privacy') return 'low'; // Low privacy (3.1-5.0)
        // Legacy support for old values
        if (q4Value === 'low') return 'high'; // High privacy (legacy)
        if (q4Value === 'high') return 'medium'; // Medium privacy (legacy)
        if (q4Value === 'very-high') return 'low'; // Low privacy (legacy)
        return 'low';
    };
    
    console.log('Chart 4 - Total responses:', responses.length);
    console.log('Chart 4 - Responses data:', responses.map(r => ({
        q2_noticed: r.q2_noticed,
        q4_preferred_range: r.q4_preferred_range
    })));
    
    responses.forEach((response) => {
        const q2Value = response.q2_noticed; // What they noticed
        const q4Value = response.q4_preferred_range; // Preferred range
        const privacyLevel = getPrivacyLevel(q4Value);
        
        console.log(`Chart 4 - Processing response: q2=${q2Value}, q4=${q4Value}, level=${privacyLevel}`);
        
        if (q2Value && counts[privacyLevel]) {
            if (q2Value === 'captcha') {
                counts[privacyLevel].captcha++;
                console.log(`Chart 4 - Incremented captcha for ${privacyLevel}, count now: ${counts[privacyLevel].captcha}`);
            } else if (q2Value === 'ads') {
                counts[privacyLevel].ads++;
                console.log(`Chart 4 - Incremented ads for ${privacyLevel}, count now: ${counts[privacyLevel].ads}`);
            } else if (q2Value === 'latency') {
                counts[privacyLevel].latency++;
                console.log(`Chart 4 - Incremented latency for ${privacyLevel}, count now: ${counts[privacyLevel].latency}`);
            } else if (q2Value === 'none') {
                counts[privacyLevel].none++;
                console.log(`Chart 4 - Incremented none for ${privacyLevel}, count now: ${counts[privacyLevel].none}`);
            }
        }
    });
    
    console.log('Chart 4 - Final counts:', counts);
    
    // Calculate dynamic normalization: find the highest response count across all cells
    const allValues = [];
    Object.values(counts).forEach(level => {
        Object.values(level).forEach(val => allValues.push(val));
    });
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
    
    // Dynamic normalization: scale color intensity based on the highest value as benchmark
    // The highest value gets the brightest color (level-5), everything else scales proportionally
    const getColorLevel = (value) => {
        if (maxValue === 0) {
            // All zeros - all cells get darkest color
            return 'level-1';
        }
        
        if (value === 0) {
            // Zero values get darkest color
            return 'level-1';
        }
        
        // Normalize value relative to maxValue (0.0 to 1.0)
        const normalized = value / maxValue;
        
        // Map normalized value to 5 color levels
        // Level 1: 0.0 - 0.2 (darkest)
        // Level 2: 0.2 - 0.4
        // Level 3: 0.4 - 0.6
        // Level 4: 0.6 - 0.8
        // Level 5: 0.8 - 1.0 (brightest, includes maxValue)
        if (normalized <= 0.2) return 'level-1';
        if (normalized <= 0.4) return 'level-2';
        if (normalized <= 0.6) return 'level-3';
        if (normalized <= 0.8) return 'level-4';
        return 'level-5'; // Brightest for highest values (including the benchmark maxValue)
    };
    
    // Update table cells (show numbers and color)
    const updateCell = (id, value) => {
        const cell = document.getElementById(id);
        if (cell) {
            cell.textContent = value; // Show the count value
            cell.setAttribute('data-value', value);
            // Update color level based on dynamic thresholds
            cell.className = 'data-cell ' + getColorLevel(value);
        }
    };
    
    // High privacy level
    updateCell('heatmap-high-captcha', counts.high.captcha);
    updateCell('heatmap-high-ads', counts.high.ads);
    updateCell('heatmap-high-latency', counts.high.latency);
    updateCell('heatmap-high-none', counts.high.none);
    
    // Medium privacy level
    updateCell('heatmap-medium-captcha', counts.medium.captcha);
    updateCell('heatmap-medium-ads', counts.medium.ads);
    updateCell('heatmap-medium-latency', counts.medium.latency);
    updateCell('heatmap-medium-none', counts.medium.none);
    
    // Low privacy level
    updateCell('heatmap-low-captcha', counts.low.captcha);
    updateCell('heatmap-low-ads', counts.low.ads);
    updateCell('heatmap-low-latency', counts.low.latency);
    updateCell('heatmap-low-none', counts.low.none);
}


// ===========================================================================
// CHART 5: Willingness to Trade (Radar Chart)
// Maps to Privacy Form: Q9 (willingness to trade system performance for privacy)
// Q9 values: "1" (Not willing at all), "2" (Slightly willing), "3" (Moderately willing), "4" (Willing), "5" (Very willing)
// ===========================================================================
function renderChart5() {
    const ctx = document.getElementById('chart5').getContext('2d');
    const categories = ['1 (Not willing at all)', '2 (Slightly willing)', '3 (Moderately willing)', '4 (Willing)', '5 (Very willing)'];
    
    // Get real data from questionnaire responses (Q9: willingness)
    const responses = getAllQuestionnaireResponses();
    const values = [0, 0, 0, 0, 0];
    
    responses.forEach(response => {
        const willingness = response.q9_willingness;
        if (willingness) {
            const index = parseInt(willingness) - 1;
            if (index >= 0 && index < 5) {
                values[index]++;
            }
        }
    });

    const data = {
        labels: categories,
        datasets: [{
            label: 'Willingness Score',
            data: values,
            backgroundColor: 'rgba(0, 255, 255, 0.2)',
            borderColor: CYAN,
            pointBackgroundColor: CYAN,
            pointBorderColor: WHITE,
            pointHoverBackgroundColor: WHITE,
            pointHoverBorderColor: CYAN,
            borderWidth: 2
        }]
    };

    const config = {
        type: 'radar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Participants` Willingness to Trade System Performance for Privacy',
                    align: 'center'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                r: {
                    angleLines: {
                        color: GRID_COLOR
                    },
                    grid: {
                        color: GRID_COLOR
                    },
                    pointLabels: {
                        color: TEXT_COLOR,
                        font: { size: 11 }
                    },
                    min: 0,
                    max: (() => {
                        const maxValue = values.length > 0 ? Math.max(...values) : 0;
                        // If max is 0, show at least 1. Otherwise add 10% padding with minimum of 1
                        if (maxValue === 0) return 1;
                        return Math.max(maxValue * 1.1, maxValue + 1);
                    })(),
                    ticks: {
                        stepSize: (() => {
                            const maxValue = values.length > 0 ? Math.max(...values) : 0;
                            // Use step of 1 for small values (1-10), auto for larger
                            if (maxValue <= 10) return 1;
                            return undefined; // Auto-calculate for larger values
                        })(),
                        backdropColor: BACKGROUND_COLOR,
                        color: TEXT_COLOR
                    }
                }
            }
        }
    };

    createChart(ctx, config);
}

// ===========================================================================
// CHART 6: Perceived Protection by Privacy Level (Multi-Line Chart)
// Maps to Privacy Form: Q8 (perceived protection) and Q4 (preferred range)
// Q8 values: "1" (Not at all), "2" (Slightly), "3" (Moderately), "4" (Mostly), "5" (Completely)
// Q4 values: "high-privacy" (0.1-1.5), "medium" (1.6-3.0), "low-privacy" (3.1-5.0)
// ===========================================================================
function renderChart6() {
    const ctx = document.getElementById('chart6').getContext('2d');
    const privacyLevels = ['High (0.1-1.5)', 'Medium (1.6-3.0)', 'Low (3.1-5.0)'];
    
    // Get real data from questionnaire responses (Q8: perceived protection, Q4: preferred range)
    const responses = getAllQuestionnaireResponses();
    
    // Initialize counters: [rating][privacyLevel]
    const counts = {
        1: [0, 0, 0], // Not at all
        2: [0, 0, 0], // Slightly
        3: [0, 0, 0], // Moderately
        4: [0, 0, 0], // Protected
        5: [0, 0, 0]  // Completely
    };
    
    // Map Q4 values to privacy level index (matching actual stored values)
    const getPrivacyLevelIndex = (q4Value) => {
        if (!q4Value) return 2; // Default to Low
        if (q4Value === 'high-privacy') return 0; // High privacy (0.1-1.5)
        if (q4Value === 'medium') return 1; // Medium privacy (1.6-3.0)
        if (q4Value === 'low-privacy') return 2; // Low privacy (3.1-5.0)
        // Legacy support for old values
        if (q4Value === 'low') return 0; // High privacy (legacy)
        if (q4Value === 'high') return 1; // Medium privacy (legacy)
        if (q4Value === 'very-high') return 2; // Low privacy (legacy)
        return 2; // Default to Low
    };
    
    responses.forEach((response) => {
        const protection = response.q8_perceived_protection;
        if (!protection) return;
        
        // Get privacy level from Q4
        const q4Value = response.q4_preferred_range;
        const levelIndex = getPrivacyLevelIndex(q4Value);
        
        const rating = parseInt(protection);
        if (rating >= 1 && rating <= 5 && counts[rating]) {
            counts[rating][levelIndex]++;
        }
    });
    
    // Convert to arrays for chart
    const data1 = counts[1] || [0, 0, 0]; // Rating 1 (Not at all) - Red
    const data2 = counts[2] || [0, 0, 0]; // Rating 2 (Slightly) - Orange
    const data3 = counts[3] || [0, 0, 0]; // Rating 3 (Moderately) - Yellow
    const data4 = counts[4] || [0, 0, 0]; // Rating 4 (Protected) - Light Green
    const data5 = counts[5] || [0, 0, 0];  // Rating 5 (Completely) - Dark Green

    // Calculate maximum value across all datasets for dynamic scaling
    const allDataValues = [...data1, ...data2, ...data3, ...data4, ...data5];
    const maxValue = allDataValues.length > 0 ? Math.max(...allDataValues) : 0;

    const data = {
        labels: privacyLevels,
        datasets: [
            {
                label: '1 (Not at all)',
                data: data1,
                borderColor: RED,
                backgroundColor: RED,
                tension: 0.4,
                fill: false,
                pointRadius: 6
            },
            {
                label: '2 (Slightly)',
                data: data2,
                borderColor: YELLOW, // Using Yellow for Orange-ish color
                backgroundColor: YELLOW,
                tension: 0.4,
                fill: false,
                pointRadius: 6
            },
            {
                label: '3 (Moderately)',
                data: data3,
                borderColor: CYAN, // Using Cyan for the light blue/cyan line
                backgroundColor: CYAN,
                tension: 0.4,
                fill: false,
                pointRadius: 6
            },
            {
                label: '4 (Mostly)',
                data: data4,
                borderColor: GREEN, // Using Green for the light green line
                backgroundColor: GREEN,
                tension: 0.4,
                fill: false,
                pointRadius: 6
            },
            {
                label: '5 (Completely)',
                data: data5,
                borderColor: '#008000', // Darker Green for the top line
                backgroundColor: '#008000',
                tension: 0.4,
                fill: false,
                pointRadius: 6
            }
        ]
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Participants` Perceived Protection by Privacy Level'
                },
                legend: {
                    position: 'bottom',
                    align: 'center',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Chosen Privacy Level',
                        align: 'center',
                        color: CYAN
                    },
                    ticks: { color: TEXT_COLOR },
                    grid: { color: GRID_COLOR }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Participants',
                        align: 'center',
                        color: CYAN
                    },
                    min: 0,
                    max: (() => {
                        // Dynamic scaling: if max is 0, show at least 1. Otherwise add 10% padding with minimum of 1
                        if (maxValue === 0) return 1;
                        return Math.max(maxValue * 1.1, maxValue + 1);
                    })(),
                    ticks: {
                        stepSize: (() => {
                            // Dynamic step size: use 1 for small values (1-10), auto for larger
                            if (maxValue <= 10) return 1;
                            if (maxValue <= 50) return 5;
                            return undefined; // Auto-calculate for larger values
                        })(),
                        color: TEXT_COLOR
                    },
                    grid: { 
                        color: GRID_COLOR,
                        borderDash: [5, 5] // Dashed grid lines
                    }
                }
            }
        }
    };

    createChart(ctx, config);
}

// Function to render all charts - GLOBAL SYSTEM
// All charts use Firestore data aggregated across ALL participants
function renderAllCharts() {
    console.log('[renderAllCharts] 🔄 Starting to render all charts with GLOBAL Firestore data...');
    
    // Verify Firestore data is loaded
    console.log('[renderAllCharts] Firestore cache status:', {
        sessions: firestoreDataCache.sessions?.length || 0,
        questionnaires: firestoreDataCache.questionnaires?.length || 0,
        lastUpdated: firestoreDataCache.lastUpdated || 'never'
    });
    
    // Get data counts for debugging
    const completedSessions = getAllCompletedSessions();
    const questionnaireResponses = getAllQuestionnaireResponses();
    
    console.log('[renderAllCharts] 📊 Global data summary:', {
        completedSessions: completedSessions.length,
        questionnaireResponses: questionnaireResponses.length
    });
    
    // Render all charts with global aggregated data
    renderChart1();      // Uses getAllCompletedSessions() - Firestore only
    renderChart2();      // Uses getAllQuestionnaireResponses() - Firestore only
    renderChart3();      // Uses getAllQuestionnaireResponses() - Firestore only
    updateHeatmapTable(); // Uses getAllQuestionnaireResponses() - Firestore only (Chart 4)
    renderChart5();      // Uses getAllQuestionnaireResponses() - Firestore only
    renderChart6();      // Uses getAllQuestionnaireResponses() - Firestore only
    
    console.log('[renderAllCharts] ✅ All 6 charts rendered with global aggregated data from ALL participants');
}

// Export the render function to be called from scripts.js
window.renderAllCharts = renderAllCharts;

// Debug function to check questionnaire data - call from console: checkQuestionnaireData()
window.checkQuestionnaireData = function() {
    console.log('=== QUESTIONNAIRE DATA DEBUG ===');
    console.log('1. Firestore cache:', firestoreDataCache.questionnaires);
    console.log('2. localStorage questionnaireData:', localStorage.getItem('questionnaireData'));
    
    const sessions = getSessionsFromStorage();
    console.log('3. Total sessions:', sessions.length);
    const completedSessions = sessions.filter(s => s.consentCompleted && s.privacyCompleted);
    console.log('4. Completed sessions:', completedSessions.length);
    completedSessions.forEach((s, i) => {
        console.log(`   Session ${i + 1}:`, {
            userId: s.userId,
            hasQuestionnaireData: !!s.questionnaireData,
            questionnaireData: s.questionnaireData
        });
    });
    
    const responses = getAllQuestionnaireResponses();
    console.log('5. getAllQuestionnaireResponses() returned:', responses.length, 'responses');
    if (responses.length > 0) {
        console.log('   First response:', responses[0]);
    }
    
    console.log('=== END DEBUG ===');
    return {
        firestoreCache: firestoreDataCache.questionnaires,
        localStorage: localStorage.getItem('questionnaireData'),
        sessions: completedSessions,
        responses: responses
    };
};

// Manual refresh function - call from console: refreshChartsData()
window.refreshChartsData = async function() {
    console.log('[refreshChartsData] 🔄 Starting manual refresh...');
    
    // Reload Firestore data
    if (window.db) {
        console.log('[refreshChartsData] Loading data from Firestore...');
        await loadAllDataFromFirestore().catch(err => {
            console.error('[refreshChartsData] ❌ Error loading Firestore data:', err);
        });
        
        // Check what we got
        console.log('[refreshChartsData] Firestore cache after load:', {
            sessions: firestoreDataCache.sessions.length,
            questionnaires: firestoreDataCache.questionnaires.length,
            lastUpdated: firestoreDataCache.lastUpdated
        });
        
        // Show detailed questionnaire cache
        if (firestoreDataCache.questionnaires.length > 0) {
            console.log('[refreshChartsData] Questionnaire cache contents:', firestoreDataCache.questionnaires);
        } else {
            console.warn('[refreshChartsData] ⚠️ No questionnaires in cache!');
        }
    } else {
        console.warn('[refreshChartsData] ⚠️ Firestore not available (window.db is undefined)');
    }
    
    // Check what getAllQuestionnaireResponses returns
    const responses = getAllQuestionnaireResponses();
    console.log('[refreshChartsData] getAllQuestionnaireResponses() returned:', responses.length, 'responses');
    if (responses.length > 0) {
        console.log('[refreshChartsData] First response:', responses[0]);
    }
    
    // Force chart refresh
    if (window.renderAllCharts) {
        setTimeout(() => {
            console.log('[refreshChartsData] 📊 Refreshing all charts...');
            window.renderAllCharts();
        }, 500);
    } else {
        console.warn('[refreshChartsData] ⚠️ renderAllCharts function not available');
    }
    
    console.log('[refreshChartsData] ✅ Refresh complete. Check charts now.');
    return {
        questionnairesInCache: firestoreDataCache.questionnaires.length,
        responsesFound: responses.length,
        responses: responses
    };
};

// ============================================================================
// RESTRICTED ACCESS CONTROL FOR NOTIFICATIONS AND LOGS
// ============================================================================

const RESTRICTED_ACCESS_CODE = "ZHY479";

// Initialize restricted access controls
function initializeRestrictedAccess() {
    // Check if this is a new session (not a refresh) for notifications
    const notificationsSessionId = sessionStorage.getItem('notifications_access_session_id');
    if (!notificationsSessionId) {
        // New session - clear any previous notifications access
        sessionStorage.removeItem('notifications_access_granted');
    }
    
    // Check if this is a new session (not a refresh) for logs
    const logsSessionId = sessionStorage.getItem('logs_access_session_id');
    if (!logsSessionId) {
        // New session - clear any previous logs access
        sessionStorage.removeItem('logs_access_granted');
    }
    
    checkNotificationsAccess();
    checkLogsAccess();
    
    // Setup authentication forms
    setupNotificationsAuth();
    setupLogsAuth();
    
    // Clear access on page unload (refresh or close)
    window.addEventListener('beforeunload', function() {
        sessionStorage.removeItem('notifications_access_session_id');
        sessionStorage.removeItem('notifications_access_granted');
        sessionStorage.removeItem('logs_access_session_id');
        sessionStorage.removeItem('logs_access_granted');
    });
}

// Check if user has access to notifications
function checkNotificationsAccess() {
    // Verify notifications-specific access and session ID exist
    const hasAccess = sessionStorage.getItem('notifications_access_granted') === 'true';
    const hasSession = sessionStorage.getItem('notifications_access_session_id');
    
    if (hasAccess && hasSession) {
        showNotificationsContent();
    } else {
        hideNotificationsContent();
        // Clear access if session ID is missing
        if (!hasSession) {
            sessionStorage.removeItem('notifications_access_granted');
        }
    }
}

// Check if user has access to logs
function checkLogsAccess() {
    // Verify logs-specific access and session ID exist
    const hasAccess = sessionStorage.getItem('logs_access_granted') === 'true';
    const hasSession = sessionStorage.getItem('logs_access_session_id');
    
    if (hasAccess && hasSession) {
        showLogsContent();
    } else {
        hideLogsContent();
        // Clear access if session ID is missing
        if (!hasSession) {
            sessionStorage.removeItem('logs_access_granted');
        }
    }
}

// Check privacy form access (consent required)
function checkPrivacyFormAccess() {
    const popup = document.getElementById('privacy-restricted-popup');
    const content = document.getElementById('privacy-questionnaire-content');
    
    if (!popup) {
        console.log('Privacy form popup not found');
        return;
    }
    
    // Check if the parent page is active
    const reportPage = document.getElementById('report-page');
    if (reportPage && !reportPage.classList.contains('active')) {
        // Page is not active, set popup to show by default (will be visible when page becomes active)
        popup.style.setProperty('display', 'block', 'important');
        return;
    }
    
    if (completionStatus.consentCompleted) {
        // Show content, hide popup
        popup.style.setProperty('display', 'none', 'important');
        if (content) {
            content.style.display = 'block';
        }
    } else {
        // Show popup, hide content (default state)
        popup.style.setProperty('display', 'block', 'important');
        if (content) {
            content.style.display = 'none';
        }
    }
}

// Check privacy page access (consent required)
function checkPrivacyPageAccess() {
    const popup = document.getElementById('privacy-page-restricted-popup');
    const content = document.querySelector('#privacy-page .privacy-layout');
    
    if (!popup) {
        console.log('Privacy page popup not found');
        return;
    }
    
    // Check if the parent page is active
    const privacyPage = document.getElementById('privacy-page');
    if (privacyPage && !privacyPage.classList.contains('active')) {
        // Page is not active, set popup to show by default (will be visible when page becomes active)
        popup.style.setProperty('display', 'block', 'important');
        return;
    }
    
    if (completionStatus.consentCompleted) {
        // Show content, hide popup
        popup.style.setProperty('display', 'none', 'important');
        if (content) {
            content.style.display = 'flex';
        }
    } else {
        // Show popup, hide content (default state)
        popup.style.setProperty('display', 'block', 'important');
        if (content) {
            content.style.display = 'none';
        }
    }
}

// Setup privacy form consent button
document.addEventListener('DOMContentLoaded', function() {
    const goToConsentBtn = document.getElementById('go-to-consent-btn');
    if (goToConsentBtn) {
        goToConsentBtn.addEventListener('click', function() {
            const consentLink = document.querySelector('[data-page="consent"]');
            if (consentLink) {
                consentLink.click();
            }
        });
    }
    
    const goToConsentFromPrivacyPageBtn = document.getElementById('go-to-consent-from-privacy-page-btn');
    if (goToConsentFromPrivacyPageBtn) {
        goToConsentFromPrivacyPageBtn.addEventListener('click', function() {
            const consentLink = document.querySelector('[data-page="consent"]');
            if (consentLink) {
                consentLink.click();
            }
        });
    }
    
    // Check privacy form access on page load
    checkPrivacyFormAccess();
    
    // Check privacy page access on page load
    checkPrivacyPageAccess();
});

// Also run on window load to ensure everything is ready
window.addEventListener('load', function() {
    setTimeout(() => {
        checkPrivacyFormAccess();
        checkPrivacyPageAccess();
    }, 100);
});

// Setup notifications authentication
function setupNotificationsAuth() {
    const form = document.getElementById("notifications-access-form");
    const input = document.getElementById("notifications-access-code");
    const errorMsg = document.getElementById("notifications-error-message");
    
    if (form && input && errorMsg) {
        form.addEventListener("submit", function(e) {
            e.preventDefault();
            
            const enteredCode = input.value.trim();
            
            if (enteredCode === RESTRICTED_ACCESS_CODE) {
                // Correct code - store in sessionStorage with notifications-specific session identifier
                sessionStorage.setItem('notifications_access_session_id', Date.now().toString());
                sessionStorage.setItem('notifications_access_granted', 'true');
                showNotificationsContent();
                clearErrorMessage("notifications-error-message");
                input.value = "";
            } else {
                // Incorrect code
                showErrorMessage("notifications-error-message", "Invalid access code. Please try again.");
                input.value = "";
                input.focus();
            }
        });
        
        // Clear error on typing
        input.addEventListener("input", function() {
            clearErrorMessage("notifications-error-message");
        });
    }
}

// Setup logs authentication
function setupLogsAuth() {
    const form = document.getElementById("logs-access-form");
    const input = document.getElementById("logs-access-code");
    const errorMsg = document.getElementById("logs-error-message");
    
    if (form && input && errorMsg) {
        form.addEventListener("submit", function(e) {
            e.preventDefault();
            
            const enteredCode = input.value.trim();
            
            if (enteredCode === RESTRICTED_ACCESS_CODE) {
                // Correct code - store in sessionStorage with logs-specific session identifier
                sessionStorage.setItem('logs_access_session_id', Date.now().toString());
                sessionStorage.setItem('logs_access_granted', 'true');
                showLogsContent();
                clearErrorMessage("logs-error-message");
                input.value = "";
            } else {
                // Incorrect code
                showErrorMessage("logs-error-message", "Invalid access code. Please try again.");
                input.value = "";
                input.focus();
            }
        });
        
        // Clear error on typing
        input.addEventListener("input", function() {
            clearErrorMessage("logs-error-message");
        });
    }
}

// Hide notifications content (default state)
function hideNotificationsContent() {
    const popup = document.getElementById("notifications-restricted-popup");
    const content = document.getElementById("notifications-content");
    
    if (popup && content) {
        popup.style.setProperty('display', 'block', 'important');
        content.style.display = "none";
        content.classList.remove("authenticated");
    }
}

// Hide logs content (default state)
function hideLogsContent() {
    const popup = document.getElementById("logs-restricted-popup");
    const content = document.getElementById("logs-content");
    
    if (popup && content) {
        popup.style.setProperty('display', 'block', 'important');
        content.style.display = "none";
        content.classList.remove("authenticated");
    }
}

// Show notifications content after authentication
function showNotificationsContent() {
    const popup = document.getElementById("notifications-restricted-popup");
    const content = document.getElementById("notifications-content");
    
    if (popup && content) {
        popup.style.setProperty('display', 'none', 'important');
        content.style.display = "block";
        content.classList.add("authenticated");
    }
}

// Show logs content after authentication
function showLogsContent() {
    const popup = document.getElementById("logs-restricted-popup");
    const content = document.getElementById("logs-content");
    
    if (popup && content) {
        popup.style.setProperty('display', 'none', 'important');
        content.style.display = "block";
        content.classList.add("authenticated");
    }
}

// Show error message
function showErrorMessage(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

// Clear error message
function clearErrorMessage(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = "";
    }
}

// Force re-authentication on page navigation
// Removed forceReAuthentication - access now persists for the session
// Users only need to re-authenticate when they refresh or close the browser

// ============================================================================
// END RESTRICTED ACCESS CONTROL
// ============================================================================

// ============================================
// EPSILON LEARNING INTERACTION BOX
// ============================================

function initEpsilonDemoBox() {
    const epsilonBox = document.querySelector('.epsilon-interaction-box');
    const header = document.querySelector('.epsilon-box-header');
    const slider = document.getElementById('epsilonDemoSlider');
    const valueDisplay = document.getElementById('epsilonDemoValue');
    const scrollBehavior = document.getElementById('scrollBehaviorText');
    const clickPatterns = document.getElementById('clickPatternsText');
    const activityLevel = document.getElementById('activityLevelText');
    
    if (!epsilonBox || !slider) return;
    
    // CRITICAL: ALWAYS start collapsed on every page load/refresh
    epsilonBox.classList.add('collapsed');
    console.log('[Epsilon Box] Initialized in collapsed state');
    
    // CRITICAL: ALWAYS reset slider to 0.1 on every page load/refresh
    slider.value = '0.1';
    valueDisplay.textContent = '0.1';
    console.log('[Epsilon Box] Slider reset to 0.1');
    
    // Toggle collapsible box
    header?.addEventListener('click', () => {
        epsilonBox.classList.toggle('collapsed');
    });
    
    // Slider functionality
    slider.addEventListener('input', (e) => {
        const epsilon = parseFloat(e.target.value);
        valueDisplay.textContent = epsilon.toFixed(1);
        updateDemoCards(epsilon);
    });
    
    function updateDemoCards(epsilon) {
        // Update slider background gradient based on position
        const percentage = ((epsilon - 0.1) / (5.0 - 0.1)) * 100;
        slider.style.background = `linear-gradient(to right, #00ffff 0%, #00ffff ${percentage}%, #666 ${percentage}%, #666 100%)`;
        
        // Define text variations based on epsilon value
        if (epsilon <= 1.5) {
            // High privacy - more obscured data
            scrollBehavior.textContent = "User scrolled at █████ speed, paused on ███████ sections";
            clickPatterns.textContent = "████ engagement with ███████████ elements, █ clicks in ██████████ menu";
            activityLevel.textContent = "Session duration: ██ ███, ██% active time, ███ idle periods";
        } else if (epsilon <= 3.0) {
            // Medium privacy - partially obscured
            scrollBehavior.textContent = "User scrolled ███ faster than average, paused on privacy sections";
            clickPatterns.textContent = "High engagement with interactive elements, ██ clicks in navigation menu";
            activityLevel.textContent = "Session duration: 8m ███, 95% active time, low idle periods";
        } else {
            // Low privacy - clear data
            scrollBehavior.textContent = "User scrolled 3.2x faster than average, paused on privacy sections";
            clickPatterns.textContent = "High engagement with interactive elements, 12 clicks in navigation menu";
            activityLevel.textContent = "Session duration: 8m 42s, 95% active time, low idle periods";
        }
    }
    
    // Initialize with 0.1 (minimum privacy - most private)
    updateDemoCards(0.1);
}

// Initialize epsilon demo when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEpsilonDemoBox);
} else {
    initEpsilonDemoBox();
}

// ============================================
// CAPTCHA FREQUENCY DEMONSTRATION BOX
// ============================================

function initCaptchaDemoBox() {
    const captchaBox = document.querySelector('.captcha-interaction-box');
    const header = document.querySelector('.captcha-box-header');
    const radioButtons = document.querySelectorAll('input[name="captcha-privacy"]');
    
    if (!captchaBox) return;
    
    // CRITICAL: ALWAYS start collapsed on every page load/refresh
    captchaBox.classList.add('collapsed');
    console.log('[CAPTCHA Box] Initialized in collapsed state');
    
    // CRITICAL: ALWAYS reset to default selection (high privacy) on page load
    const highPrivacyRadio = document.querySelector('input[name="captcha-privacy"][value="high"]');
    if (highPrivacyRadio) {
        highPrivacyRadio.checked = true;
        updateCaptchaFrequency('high');
        console.log('[CAPTCHA Box] Reset to High Privacy (default)');
    }
    
    // Toggle collapsible box
    header?.addEventListener('click', () => {
        captchaBox.classList.toggle('collapsed');
    });
    
    // Privacy level change handler
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const level = e.target.value;
            updateCaptchaFrequency(level);
        });
    });
    
    function updateCaptchaFrequency(level) {
        const numberElement = document.getElementById('captchaIntervalNumber');
        const promptCountElement = document.getElementById('captchaPromptCount');
        const marker1 = document.getElementById('captchaMarker1');
        const marker2 = document.getElementById('captchaMarker2');
        
        let interval, prompts, positions;
        
        switch(level) {
            case 'high':
                // High privacy = More CAPTCHAs (every 5 interactions)
                interval = 5;
                prompts = 6;
                positions = ['16.67%', '33.33%', '50%', '66.67%', '83.33%', '100%'];
                break;
            case 'medium':
                // Medium privacy = Moderate CAPTCHAs (every 12 interactions)
                interval = 12;
                prompts = 2;
                positions = ['40%', '80%'];
                break;
            case 'low':
                // Low privacy = Few CAPTCHAs (every 20 interactions)
                interval = 20;
                prompts = 1;
                positions = ['66.67%'];
                break;
        }
        
        // Update number display
        numberElement.textContent = interval;
        
        // Update prompt count text
        promptCountElement.innerHTML = `<strong>${prompts} CAPTCHA prompt${prompts !== 1 ? 's' : ''}</strong> would appear during 30 interactions at this privacy level.`;
        
        // Clear existing markers
        document.querySelectorAll('.captcha-marker').forEach(m => m.remove());
        
        // Add new markers
        const timelineBar = document.querySelector('.captcha-timeline-bar');
        positions.forEach(pos => {
            const marker = document.createElement('div');
            marker.className = 'captcha-marker';
            marker.style.left = pos;
            timelineBar.appendChild(marker);
        });
    }
    
    // Initialize with medium privacy
    updateCaptchaFrequency('medium');
}

// Initialize CAPTCHA demo when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCaptchaDemoBox);
} else {
    initCaptchaDemoBox();
}

// ============================================
// PRIVACY SPECTRUM OVERVIEW BOX
// ============================================

function initSpectrumBox() {
    console.log('Initializing spectrum box...');
    
    const spectrumBox = document.querySelector('.spectrum-interaction-box');
    const header = document.querySelector('.spectrum-box-header');
    const segments = document.querySelectorAll('.spectrum-segment');
    const cards = {
        default: document.getElementById('char-default'),
        high: document.getElementById('char-high'),
        medium: document.getElementById('char-medium'),
        low: document.getElementById('char-low')
    };
    
    console.log('Found elements:', {
        spectrumBox,
        header,
        segments: segments.length,
        cards
    });
    
    if (!spectrumBox) {
        console.error('Spectrum box not found!');
        return;
    }
    
    // CRITICAL: ALWAYS start collapsed on every page load/refresh
    spectrumBox.classList.add('collapsed');
    console.log('[Spectrum Box] Initialized in collapsed state');
    
    // Toggle collapsible box
    if (header) {
        header.addEventListener('click', () => {
            spectrumBox.classList.toggle('collapsed');
        });
    }
    
    // Hover functionality for segments
    segments.forEach((segment, index) => {
        console.log(`Setting up segment ${index}:`, segment.dataset.level);
        
        segment.addEventListener('mouseenter', () => {
            const level = segment.dataset.level;
            console.log('Mouse entered:', level);
            showCharacteristics(level);
        });
        
        segment.addEventListener('mouseleave', () => {
            console.log('Mouse left');
            showCharacteristics('default');
        });
    });
    
    function showCharacteristics(level) {
        console.log('Showing characteristics for:', level);
        
        // Hide all cards
        Object.values(cards).forEach(card => {
            if (card) {
                card.classList.remove('active');
            }
        });
        
        // Show selected card
        if (cards[level]) {
            cards[level].classList.add('active');
            console.log('Activated card:', level);
        } else {
            console.error('Card not found for level:', level);
        }
    }
    
    // Initialize with default prompt visible
    showCharacteristics('default');
}

// Initialize spectrum box when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSpectrumBox);
} else {
    initSpectrumBox();
}

// ============================================
// FACTORS INFLUENCING CHOICE BOX
// ============================================

function initFactorsBox() {
    const factorsBox = document.querySelector('.factors-interaction-box');
    const header = document.querySelector('.factors-box-header');
    const factorCards = document.querySelectorAll('.factor-card');
    
    if (!factorsBox) return;
    
    // CRITICAL: ALWAYS start collapsed on every page load/refresh
    factorsBox.classList.add('collapsed');
    console.log('[Factors Box] Initialized in collapsed state');
    
    // Toggle collapsible box
    header?.addEventListener('click', () => {
        factorsBox.classList.toggle('collapsed');
    });
    
    // Toggle factor cards on click
    factorCards.forEach(card => {
        const button = card.querySelector('.factor-button');
        
        button?.addEventListener('click', () => {
            // Toggle active state
            card.classList.toggle('active');
        });
    });
}

// Initialize factors box when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFactorsBox);
} else {
    initFactorsBox();
}

// ============================================
// CHANGES NOTICED INTERACTION BOX
// ============================================

function initChangesBox() {
    const changesBox = document.querySelector('.changes-interaction-box');
    const header = document.querySelector('.changes-box-header');
    const slider = document.getElementById('changesEpsilonSlider');
    const valueDisplay = document.getElementById('changesEpsilonValue');
    
    if (!changesBox || !slider) return;
    
    // CRITICAL: ALWAYS start collapsed on every page load/refresh
    changesBox.classList.add('collapsed');
    console.log('[Changes Box] Initialized in collapsed state');
    
    // CRITICAL: ALWAYS reset slider to 0.1 on every page load/refresh
    slider.value = '0.1';
    valueDisplay.textContent = '0.1';
    console.log('[Changes Box] Slider reset to 0.1');
    
    // Toggle collapsible box
    header?.addEventListener('click', () => {
        changesBox.classList.toggle('collapsed');
    });
    
    // Slider functionality
    slider.addEventListener('input', (e) => {
        const epsilon = parseFloat(e.target.value);
        valueDisplay.textContent = epsilon.toFixed(1);
        updateChangesIndicators(epsilon);
    });
    
    function updateChangesIndicators(epsilon) {
        // Update slider gradient
        const percentage = ((epsilon - 0.1) / (5.0 - 0.1)) * 100;
        slider.style.background = `linear-gradient(to right, #00ffff 0%, #00ffff ${percentage}%, #333 ${percentage}%, #333 100%)`;
        
        // Calculate levels (inverse for CAPTCHA and Latency, normal for Ads)
        // High privacy (low ε) = More CAPTCHA, More Latency, Less Ad personalization
        // Low privacy (high ε) = Less CAPTCHA, Less Latency, More Ad personalization
        
        const captchaLevel = Math.max(1, Math.min(5, Math.round(6 - epsilon)));
        const latencyLevel = Math.max(1, Math.min(5, Math.round(6 - epsilon)));
        const adLevel = Math.max(0, Math.min(5, Math.round(epsilon)));
        
        // Update CAPTCHA
        updateIndicatorCard('captcha', captchaLevel);
        
        // Update Latency
        updateIndicatorCard('latency', latencyLevel);
        
        // Update Ad Personalization
        updateIndicatorCard('ad', adLevel);
    }
    
    function updateIndicatorCard(type, level) {
        const icon = document.getElementById(`${type}Icon`);
        const bars = document.getElementById(`${type}Bars`).querySelectorAll('.bar');
        const levelText = document.getElementById(`${type}Level`);
        
        // Update icon color
        if (level >= 3) {
            icon.classList.add('active');
            icon.classList.remove('inactive');
        } else {
            icon.classList.add('inactive');
            icon.classList.remove('active');
        }
        
        // Update bars
        bars.forEach((bar, index) => {
            if (index < level) {
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        });
        
        // Update level text
        levelText.textContent = `Level: ${level}/5`;
    }
    
    // Initialize with 0.1 (minimum privacy level)
    updateChangesIndicators(0.1);
}

// Initialize changes box when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChangesBox);
} else {
    initChangesBox();
}

// ============================================
// TRADEOFF INTERACTION BOX
// ============================================

function initTradeoffBox() {
    const tradeoffBox = document.querySelector('.tradeoff-interaction-box');
    const header = document.querySelector('.tradeoff-box-header');
    const slider = document.getElementById('tradeoffSlider');
    const percentageDisplay = document.getElementById('tradeoffPercentage');
    const stanceDisplay = document.getElementById('tradeoffStance');
    
    if (!tradeoffBox || !slider) return;
    
    // CRITICAL: ALWAYS start collapsed on every page load/refresh
    tradeoffBox.classList.add('collapsed');
    console.log('[Tradeoff Box] Initialized in collapsed state');
    
    // CRITICAL: ALWAYS reset slider to 0 (privacy-focused) on every page load/refresh
    slider.value = '0';
    console.log('[Tradeoff Box] Slider reset to 0 (Privacy-Focused)');
    
    // Toggle collapsible box
    header?.addEventListener('click', () => {
        tradeoffBox.classList.toggle('collapsed');
    });
    
    // Slider functionality
    slider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        updateTradeoffDisplay(value);
    });
    
    function updateTradeoffDisplay(value) {
    // Update slider gradient
    slider.style.background = `linear-gradient(to right, #00ffff 0%, #00ffff ${value}%, #333 ${value}%, #333 100%)`;
    
    // Update percentage
    percentageDisplay.textContent = `${value}%`;
    
    // Update stance text
    if (value <= 25) {
        stanceDisplay.textContent = 'Privacy-Focused';
    } else if (value <= 45) {
        stanceDisplay.textContent = 'Privacy-Leaning';
    } else if (value <= 55) {
        stanceDisplay.textContent = 'Balanced';
    } else if (value <= 75) {
        stanceDisplay.textContent = 'Performance-Leaning';
    } else {
        stanceDisplay.textContent = 'Performance-Focused';
    }
    
    // Calculate percentages for progress bars
    // Left (0) = Max Privacy: High CAPTCHA (90%), High Latency (150ms), Low Ad Targeting (10%)
    // Right (100) = Max Performance: Low CAPTCHA (0%), Low Latency (50ms), High Ad Targeting (100%)
    
    const captchaPercent = 90 - Math.round((value / 100) * 90);  // 90% to 0%
    const latencyMs = 150 - Math.round((value / 100) * 100);      // 150ms to 50ms
    const adTargetingPercent = Math.round((value / 100) * 90) + 10;  // 10% to 100%
    
    // Update CAPTCHA bar
    const captchaBar = document.getElementById('captchaBar');
    const captchaPercentage = document.getElementById('captchaPercentage');
    if (captchaBar && captchaPercentage) {
        captchaBar.style.width = `${captchaPercent}%`;
        captchaPercentage.textContent = `${captchaPercent}%`;
    }
    
    // Update Latency bar
    const latencyBar = document.getElementById('latencyBar');
    const latencyPercentage = document.getElementById('latencyPercentage');
    if (latencyBar && latencyPercentage) {
        const latencyDisplayPercent = Math.round(((latencyMs - 50) / 100) * 100);
        latencyBar.style.width = `${latencyDisplayPercent}%`;
        latencyPercentage.textContent = `${latencyMs}ms`;
    }
    
    // Update Ad Targeting bar
    const adTargetingBar = document.getElementById('adTargetingBar');
    const adTargetingPercentage = document.getElementById('adTargetingPercentage');
    if (adTargetingBar && adTargetingPercentage) {
        adTargetingBar.style.width = `${adTargetingPercent}%`;
        adTargetingPercentage.textContent = `${adTargetingPercent}%`;
    }
    
    // ✅ NEW: Update System Impact metric levels (1-5 bars)
    // Calculate levels based on slider position (0-100)
    // Ad Targeting: Increases as we move towards performance (right)
    // CAPTCHA Frequency: Decreases as we move towards performance (right)  
    // System Latency: Decreases as we move towards performance (right)
    
    // Ad Targeting level: 0 at left (privacy) → 5 at right (performance)
    const adTargetingLevel = Math.round((value / 100) * 5);
    
    // CAPTCHA Frequency level: 5 at left (privacy) → 0 at right (performance)
    const captchaFreqLevel = 5 - Math.round((value / 100) * 5);
    
    // System Latency level: 5 at left (privacy) → 0 at right (performance)
    const systemSlowdownLevel = 5 - Math.round((value / 100) * 5);
    
    // Update Ad Targeting metric bars
    updateSystemImpactMetric('adTargeting', adTargetingLevel);
    
    // Update CAPTCHA Frequency metric bars
    updateSystemImpactMetric('captchaFreq', captchaFreqLevel);
    
    // Update System Latency metric bars
    updateSystemImpactMetric('systemSlowdown', systemSlowdownLevel);
}
    
// Helper function to update System Impact metric bars and level text
function updateSystemImpactMetric(metricId, level) {
    const bars = document.getElementById(`${metricId}Bars`);
    const levelText = document.getElementById(`${metricId}Level`);
    
    if (!bars || !levelText) return;
    
    const barElements = bars.querySelectorAll('.metric-bar');
    
    // Update bars - add 'active' class to filled bars
    barElements.forEach((bar, index) => {
        if (index < level) {
            bar.classList.add('active');
        } else {
            bar.classList.remove('active');
        }
    });
    
    // Update level text
    levelText.textContent = `Level ${level}/5`;
}

function updateMetricBars(metricId, level) {
    const bars = document.getElementById(`${metricId}Bars`).querySelectorAll('.metric-bar');
    const levelText = document.getElementById(`${metricId}Level`);
    
    // Update bars
    bars.forEach((bar, index) => {
        if (index < level) {
            bar.classList.add('active');
        } else {
            bar.classList.remove('active');
        }
    });
    
    // Update level text
    levelText.textContent = `Level ${level}/5`;
}
    
    // Initialize with privacy-focused (0)
    updateTradeoffDisplay(0);
}

// Initialize tradeoff box when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTradeoffBox);
} else {
    initTradeoffBox();
}

document.querySelectorAll('.interaction-header').forEach(header => {
    header.addEventListener('click', () => {
        const box = header.parentElement;
        box.classList.toggle('open');
        const content = box.querySelector('.interaction-content');
        content.style.display = box.classList.contains('open') ? 'block' : 'none';
    });
});
