// ==UserScript==
// @name         Ekşi Author Filter
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Filters entries from specified authors on Ekşi Sözlük, loaded from a remote list.
// @author       Your Name // Added placeholder
// @match        *://eksisozluk.com/*--*
// @match        *://eksisozluk.com/basliklar/gundem*
// @match        *://eksisozluk.com/basliklar/bugun*
// @match        *://eksisozluk.com/basliklar/populer*
// @match        *://eksisozluk.com/basliklar/debe*
// @match        *://eksisozluk.com/basliklar/kanal/*
// @match        *://eksisozluk.com/
// @exclude      *://eksisozluk.com/biri/*
// @exclude      *://eksisozluk.com/mesaj/*
// @exclude      *://eksisozluk.com/ayarlar/*
// @exclude      *://eksisozluk.com/hesap/*
// @exclude      *://eksisozluk.com/tercihler/*
// @icon         https://eksisozluk.com/favicon.ico
// @connect      raw.githubusercontent.com // Made specific, removed * and gist
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(async () => {
    'use strict';

    // --- Constants ---
    const SCRIPT_NAME = "Ekşi Author Filter"; // Simplified name
    const AUTHOR_LIST_URL = "https://raw.githubusercontent.com/bat9254/troll-list/refs/heads/main/list.txt"; // Removed REPLACE comment
    const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
    const NETWORK_TIMEOUT_MS = 20000; // 20s
    const LOG_PREFIX = `[${SCRIPT_NAME}]`;
    const DEBOUNCE_DELAY_MS = 250;
    const TOPIC_WARNING_THRESHOLD = 3; // Minimum filtered entries (excluding first) to show warning
    const CSS_PREFIX = "efh-"; // Keep prefix for isolation

    // --- Storage Keys ---
    const KEY_PAUSED = "efh_paused_v2";
    const KEY_MODE = "efh_filterMode_v2"; // 'hide' or 'collapse'
    const KEY_SHOW_WARNING = "efh_showTopicWarning_v2";
    const KEY_LIST_RAW = "efh_authorListRaw_v2";
    const KEY_LAST_UPDATE = "efh_lastUpdateTime_v2";
    const KEY_TOTAL_FILTERED = "efh_totalFiltered_v2";

    // --- CSS ---
    GM_addStyle(`
        .${CSS_PREFIX}topic-warning { background-color:#fff0f0; border:1px solid #d9534f; border-left:3px solid #d9534f; border-radius:3px; padding:2px 6px; margin-left:8px; font-size:0.85em; color:#a94442; display:inline-block; vertical-align:middle; cursor:help; font-weight:bold; } /* Changed cursor */
        .${CSS_PREFIX}collapsed > .content, .${CSS_PREFIX}collapsed > footer > .feedback-container, .${CSS_PREFIX}collapsed > footer .entry-footer-bottom > .footer-info > div:not(#entry-nick-container):not(:has(.entry-date)) { display: none !important; }
        .${CSS_PREFIX}collapsed > footer, .${CSS_PREFIX}collapsed footer > .info, .${CSS_PREFIX}collapsed footer .entry-footer-bottom { min-height: 1px; }
        .${CSS_PREFIX}collapsed #entry-nick-container, .${CSS_PREFIX}collapsed .entry-date { display:inline-block !important; visibility:visible !important; opacity:1 !important; }
        .${CSS_PREFIX}collapsed { min-height:35px !important; padding-bottom:0 !important; margin-bottom:10px !important; border-left:3px solid #ffcccc !important; background-color:rgba(128,128,128,0.03); overflow:hidden; }
        .${CSS_PREFIX}collapse-placeholder { min-height:25px; background-color:transparent; border:none; padding:6px 10px 6px 12px; margin-bottom:0px; font-style:normal; color:#6c757d; position:relative; display:flex; align-items:center; flex-wrap:wrap; box-sizing:border-box; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}collapse-icon { margin-right:6px; opacity:0.9; font-style:normal; display:inline-block; color:#dc3545; cursor:help; } /* Added cursor */
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}collapse-text { margin-right:10px; flex-grow:1; display:inline-block; font-size:0.9em; font-weight:500; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}collapse-text strong { color:#dc3545; font-weight:600; }
        .${CSS_PREFIX}show-link { font-style:normal; flex-shrink:0; margin-left:auto; }
        .${CSS_PREFIX}show-link a { cursor:pointer; text-decoration:none; color:#0d6efd; font-size:0.9em; padding:1px 4px; border-radius:3px; font-weight:bold; border:1px solid transparent; transition: color 0.15s ease-in-out; }
        .${CSS_PREFIX}show-link a::before { content:"» "; opacity:0.7; }
        .${CSS_PREFIX}show-link a:hover { color:#0a58ca; text-decoration:underline; background-color:rgba(13,110,253,0.1); border-color:rgba(13,110,253,0.2); }
        .${CSS_PREFIX}hidden { display: none !important; }
        .${CSS_PREFIX}opened-warning { font-size:0.8em; color:#856404; background-color:#fff3cd; border:1px solid #ffeeba; border-radius:3px; padding:1px 4px; margin-left:8px; vertical-align:middle; cursor:help; display:inline-block; font-style:normal; font-weight:bold; } /* Added cursor */
    `);

    // --- Helpers ---
    const logger = {
        log: (...args) => console.log(LOG_PREFIX, ...args),
        warn: (...args) => console.warn(LOG_PREFIX, ...args),
        error: (...args) => console.error(LOG_PREFIX, ...args),
        debug: (...args) => console.debug(LOG_PREFIX, ...args), // Keep debug for development
    };
    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    };

    // --- GM API Check ---
    const requiredGmFunctions = ['GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'GM_registerMenuCommand', 'GM_addStyle', 'GM_deleteValue'];
    if (requiredGmFunctions.some(fn => typeof window[fn] !== 'function')) {
        const missing = requiredGmFunctions.filter(fn => typeof window[fn] !== 'function');
        const errorMsg = `KRİTİK HATA: Gerekli Tampermonkey API fonksiyonları eksik: ${missing.join(', ')}! Script ÇALIŞMAYACAK. Lütfen Tampermonkey'in güncel olduğundan ve script'e yetki verildiğinden emin olun.`;
        logger.error(errorMsg);
        alert(`${SCRIPT_NAME} - KRİTİK HATA:\n${errorMsg}`);
        return; // Stop execution
    }

    // --- Feedback ---
    function showFeedback(title, text, options = {}) {
        const { isError = false, silent = false } = options;
        const prefix = isError ? "HATA" : "BİLGİ";
        (isError ? logger.error : logger.log)(`${prefix}: ${title}`, text); // Log clearly
        if (!silent) {
            alert(`[${SCRIPT_NAME}] ${prefix}: ${title}\n\n${text}`);
        }
    }

    // --- State ---
    let config = {};
    let filteredAuthorsSet = new Set();
    let filteredListSize = 0;
    let filteredEntryCountOnPage = 0; // Renamed for clarity
    let firstEntryAuthorFilteredOnPage = false; // Renamed for clarity
    let topicWarningElement = null;

    // --- Config Load ---
    async function loadConfig() {
        logger.debug("Yapılandırma yükleniyor...");
        try {
            // Use Promise.all for parallel fetching
            const [paused, filterMode, showWarning, listRaw, lastUpdate, totalFiltered] = await Promise.all([
                GM_getValue(KEY_PAUSED, false),
                GM_getValue(KEY_MODE, "collapse"), // Default to collapse
                GM_getValue(KEY_SHOW_WARNING, true),
                GM_getValue(KEY_LIST_RAW, ""),
                GM_getValue(KEY_LAST_UPDATE, 0),
                GM_getValue(KEY_TOTAL_FILTERED, 0)
            ]);
            config = { paused, filterMode, showWarning, listRaw, lastUpdate, totalFiltered };
            filteredAuthorsSet = parseAuthorList(config.listRaw);
            filteredListSize = filteredAuthorsSet.size;
            logger.log(`Yapılandırma yüklendi. Durum: ${config.paused ? 'DURAKLATILDI' : 'AKTİF'}, Mod: ${config.filterMode}, Liste Boyutu: ${filteredListSize}, Toplam Filtrelenen: ${config.totalFiltered}`);
        } catch (err) {
            logger.error("Yapılandırma YÜKLENEMEDİ:", err);
            // Set defaults safely
            config = { paused: false, filterMode: 'collapse', showWarning: true, listRaw: '', lastUpdate: 0, totalFiltered: 0 };
            filteredAuthorsSet = new Set();
            filteredListSize = 0;
            showFeedback("Yapılandırma Hatası", "Ayarlar yüklenemedi! Varsayılanlar kullanılıyor.", { isError: true });
        }
    }

    // --- Core Functions ---
    const fetchList = () => new Promise((resolve, reject) => {
        logger.debug(`Liste isteniyor: ${AUTHOR_LIST_URL}`);
        GM_xmlhttpRequest({
            method: "GET",
            url: AUTHOR_LIST_URL,
            timeout: NETWORK_TIMEOUT_MS,
            responseType: 'text',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' }, // Stronger cache control
            onload: response => {
                if (response.status >= 200 && response.status < 300) {
                    logger.debug(`Liste başarıyla alındı (HTTP ${response.status}). Boyut: ${response.responseText.length} bytes.`);
                    resolve(response.responseText);
                } else {
                    logger.warn(`Liste alınamadı. Sunucu yanıtı: HTTP ${response.status} ${response.statusText}`);
                    reject(new Error(`HTTP ${response.status} ${response.statusText || 'Error'}`));
                }
            },
            onerror: response => {
                logger.error("Liste çekme sırasında ağ hatası:", response.statusText || 'Bilinmeyen ağ hatası', response);
                reject(new Error(`Ağ Hatası: ${response.statusText || 'Bilinmeyen'}`));
            },
            ontimeout: () => {
                logger.error(`Liste çekme zaman aşımına uğradı (${NETWORK_TIMEOUT_MS / 1000}s).`);
                reject(new Error(`Zaman Aşımı (${NETWORK_TIMEOUT_MS / 1000}s)`));
            }
        });
    });

    const parseAuthorList = (rawText) => {
        if (!rawText || typeof rawText !== 'string') {
            logger.warn("Ayrıştırılacak liste metni boş veya geçersiz.");
            return new Set();
        }
        try {
            const authors = rawText.split(/[\r\n]+/) // Handles different line endings
                .map(line => line.replace(/#.*$/, '').trim().toLowerCase()) // Remove comments, trim, lowercase
                .filter(line => line.length > 0); // Remove empty lines
            logger.debug(`Liste ayrıştırıldı, ${authors.length} potansiyel yazar bulundu.`);
            return new Set(authors);
        } catch (err) {
            logger.error("Liste AYRIŞTIRILAMADI:", err);
            showFeedback("Liste Ayrıştırma Hatası", `İndirilen liste işlenemedi. Hata: ${err.message}`, { isError: true });
            return new Set(); // Return empty set on error
        }
    };

    const syncList = async (force = false) => {
        logger.log(`Liste güncellemesi ${force ? 'ZORLANIYOR' : 'kontrol ediliyor'}...`);
        let newRawText;
        try {
            newRawText = await fetchList();
        } catch (err) {
            logger.error("Liste ÇEKME hatası:", err.message);
            // Only show alert if forced or if we have no list at all
            if (force || filteredListSize === 0) {
                showFeedback("Güncelleme Başarısız", `Filtre listesi uzak sunucudan alınamadı.\n\nHata: ${err.message}\n\nMevcut liste (varsa) kullanılmaya devam edecek.`, { isError: true });
            }
            return false; // Indicate failure
        }

        // Check if list content actually changed (or forced update)
        if (!force && config.listRaw === newRawText) {
            logger.log("Liste içeriği değişmemiş. Güncelleme atlanıyor.");
            // Still update timestamp if check was successful
            config.lastUpdate = Date.now();
            await GM_setValue(KEY_LAST_UPDATE, config.lastUpdate).catch(e => logger.error("Zaman damgası kaydı (değişiklik yokken) başarısız:", e));
            return false; // Not updated
        }

        logger.log(force ? "Zorunlu güncelleme veya liste içeriği değişmiş, işleniyor." : "Liste değişmiş, güncelleniyor.");
        let newListSet;
        try {
            newListSet = parseAuthorList(newRawText);
        } catch (err) {
            // Error already shown by parseAuthorList
            logger.error("Liste işleme hatası (syncList içinde yakalandı):", err);
            // Do not proceed with saving corrupted data, keep old list
            return false;
        }

        // Sanity check: If we had a list before, and the new list is empty BUT the raw text wasn't, something is wrong.
        if (filteredListSize > 0 && newListSet.size === 0 && newRawText.trim().length > 0) {
            logger.warn("Yeni liste verisi alındı ancak ayrıştırma sonucu BOŞ! Bu beklenmedik bir durum. Güvenlik için eski liste korunuyor. Lütfen listeyi kontrol edin:", AUTHOR_LIST_URL);
            showFeedback("Güncelleme Uyarısı", "Yeni liste indirildi ancak işlenince boş sonuç verdi. Eski liste kullanılıyor.", { isError: true });
            // Update timestamp to prevent constant retries if the remote list is broken
            config.lastUpdate = Date.now();
            await GM_setValue(KEY_LAST_UPDATE, config.lastUpdate).catch(e=>logger.error("Zaman damgası kaydı (ayrıştırma hatası sonrası) başarısız:", e));
            return false; // Not updated
        }

        // Looks good, proceed with update
        const oldSize = filteredListSize;
        filteredAuthorsSet = newListSet;
        filteredListSize = filteredAuthorsSet.size;
        config.listRaw = newRawText;
        config.lastUpdate = Date.now();
        logger.log(`Liste başarıyla güncellendi. Eski boyut: ${oldSize}, Yeni boyut: ${filteredListSize}`);

        try {
            await Promise.all([
                GM_setValue(KEY_LIST_RAW, config.listRaw),
                GM_setValue(KEY_LAST_UPDATE, config.lastUpdate)
            ]);
            logger.debug("Güncel liste ve zaman damgası başarıyla kaydedildi.");
        } catch (err) {
            logger.error("Güncel liste verileri KAYDEDİLEMEDİ:", err);
            showFeedback("Depolama Hatası", "Liste güncellendi ancak yerel olarak kaydedilemedi. Sayfa yenilendiğinde eski liste yüklenebilir.", { isError: true });
            // Data is updated in memory, but storage failed. Return true as it was updated.
        }
        return true; // Updated successfully
    };

    function applyFilterAction(entry, author) {
        const entryId = entry.dataset.id || 'ID Yok'; // Use original author case for display
        const displayAuthor = entry.dataset.author || author; // Fallback just in case

        if (config.filterMode === "hide") {
            entry.classList.add(`${CSS_PREFIX}hidden`);
            logger.debug(`Gizlendi: Entry #${entryId} (Yazar: ${displayAuthor})`);
            return 'hide';
        }

        // --- Collapse Mode ---
        if (entry.classList.contains(`${CSS_PREFIX}collapsed`)) {
             logger.debug(`Zaten daraltılmış: Entry #${entryId}`);
             return 'already_collapsed'; // Already processed and collapsed
        }

        // Check if placeholder already exists (e.g., from a previous run before reload)
        let placeholder = entry.querySelector(`.${CSS_PREFIX}collapse-placeholder`);
        const contentEl = entry.querySelector(".content"); // Check content existence early

        if (!contentEl) {
             logger.warn(`Daraltma başarısız (içerik bulunamadı): Entry #${entryId}`);
             return 'collapse_failed_no_content';
        }

        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = `${CSS_PREFIX}collapse-placeholder`;
            // Use displayAuthor for user-facing text
            placeholder.innerHTML = `<span class="${CSS_PREFIX}collapse-icon" title="Yazar '${displayAuthor}' filtre listesinde.">🚫</span><span class="${CSS_PREFIX}collapse-text">Filtrelenen yazar: <strong>${displayAuthor}</strong>.</span><div class="${CSS_PREFIX}show-link"><a href="#" role="button">Göster</a></div>`;

            const showLink = placeholder.querySelector(`.${CSS_PREFIX}show-link a`);
            if (showLink) {
                showLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Find elements again within the current scope
                    const currentEntry = e.target.closest('li[data-author]');
                    if (!currentEntry) return; // Should not happen
                    const currentContent = currentEntry.querySelector(".content");
                    const currentPlaceholder = currentEntry.querySelector(`.${CSS_PREFIX}collapse-placeholder`);

                    if (currentContent) currentContent.style.display = ''; // Restore display
                    if (currentPlaceholder) currentPlaceholder.style.display = 'none'; // Hide placeholder instead of removing
                    currentEntry.classList.remove(`${CSS_PREFIX}collapsed`);

                    // Add warning to footer
                    const footer = currentEntry.querySelector('footer');
                    if (footer && !footer.querySelector(`.${CSS_PREFIX}opened-warning`)) {
                        const warningSpan = document.createElement('span');
                        warningSpan.className = `${CSS_PREFIX}opened-warning`;
                        warningSpan.textContent = '⚠️ Filtre Açıldı'; // Clarified text
                        warningSpan.title = `'${displayAuthor}' yazarına ait bu içerik filtre nedeniyle daraltılmıştı.`;
                        // Append to a specific container within footer if possible, otherwise just footer
                        const footerInfo = footer.querySelector('.info') || footer;
                        footerInfo.appendChild(warningSpan);
                    }
                     logger.debug(`Genişletildi: Entry #${currentEntry.dataset.id} (Yazar: ${displayAuthor})`);
                }); // Removed { once: true } to allow re-collapsing if needed (though UI doesn't support it now)
            }

            // Insert placeholder before footer or content
            const footerEl = entry.querySelector('footer');
             if (footerEl) {
                entry.insertBefore(placeholder, footerEl);
            } else if (contentEl) {
                 entry.insertBefore(placeholder, contentEl.nextSibling); // Insert after content if no footer
            } else {
                entry.appendChild(placeholder); // Fallback: append
            }

        } else {
            // Placeholder exists, just make sure it's visible
             placeholder.style.display = 'flex';
        }

         // Hide content only if we successfully prepared the placeholder
         if(contentEl) contentEl.style.display = 'none';

        entry.classList.add(`${CSS_PREFIX}collapsed`);
        logger.debug(`Daraltıldı: Entry #${entryId} (Yazar: ${displayAuthor})`);
        return 'collapse';
    }

    function enhanceEntry(entry, isFirstOnPage = false) {
        if (entry.dataset.efhProcessed === 'true') {
            // logger.debug(`Zaten işlenmiş: Entry #${entry.dataset.id}`);
            return; // Already processed
        }
        if (!entry.matches('li[data-author]')) {
             entry.dataset.efhProcessed = 'skipped_no_author_attr'; // Mark as skipped
             return; // Not a valid entry element
        }

        const authorLower = entry.dataset.author?.toLowerCase().trim();
        const entryId = entry.dataset.id || 'ID Yok';

        if (!authorLower) {
            logger.warn(`Entry #${entryId} 'data-author' attribute'üne sahip ancak değeri boş.`);
            entry.dataset.efhProcessed = 'skipped_empty_author'; // Mark as skipped
            return; // Skip if no author identifier
        }

        let action = 'none';
        try {
            if (config.paused) {
                action = 'paused';
            } else if (filteredAuthorsSet.has(authorLower)) {
                if (isFirstOnPage) {
                    firstEntryAuthorFilteredOnPage = true; // Set page flag
                    logger.debug(`Sayfanın ilk entry'si filtrelenecek: #${entryId} (Yazar: ${entry.dataset.author})`);
                 }
                filteredEntryCountOnPage++; // Increment page counter
                action = applyFilterAction(entry, authorLower); // Pass lowercase author

                // Update total count (fire and forget, with check)
                 if (action === 'hide' || action === 'collapse') {
                    config.totalFiltered = (config.totalFiltered || 0) + 1;
                    GM_setValue(KEY_TOTAL_FILTERED, config.totalFiltered)
                        .then(() => logger.debug(`Toplam filtreleme sayısı güncellendi: ${config.totalFiltered}`))
                        .catch(err => logger.warn("Toplam sayaç kaydedilemedi:", err));
                 }

            } else {
                action = 'not_in_list';
            }
        } catch (err) {
            logger.error(`Entry #${entryId} İŞLENEMEDİ (Yazar: ${entry.dataset.author}):`, err);
            action = 'error';
        } finally {
             // Always mark as processed (or skipped) to avoid re-processing in this session
             entry.dataset.efhProcessed = 'true';
             entry.dataset.efhAction = action; // Store action taken for debugging
        }
    }

    const updateTopicWarning = () => {
        try {
            // Remove existing warning first
            topicWarningElement?.remove();
            topicWarningElement = null;

            if (!config.showWarning || config.paused || filteredEntryCountOnPage === 0) {
                 // logger.debug("Konu başlığı uyarısı gösterilmeyecek (Kapalı, Duraklatılmış veya Filtre Yok).");
                 return; // Don't show if disabled, paused, or nothing filtered on page
            }

            const titleH1 = document.getElementById("title");
            if (!titleH1) {
                logger.warn("Konu başlığı elementi (#title) bulunamadı.");
                return; // Cannot add warning if title element is missing
            }
            // Prefer appending to the link inside h1 if it exists
            const targetElement = titleH1.querySelector('a[href^="/entry/"]') || titleH1;

            // Determine if warning should be shown based on count or if first entry hit
            // Show if first entry is filtered OR if the count exceeds the threshold
            const showWarning = firstEntryAuthorFilteredOnPage || filteredEntryCountOnPage > TOPIC_WARNING_THRESHOLD;

            if (showWarning) {
                topicWarningElement = document.createElement("span");
                topicWarningElement.id = `${CSS_PREFIX}title-warning`;
                topicWarningElement.className = `${CSS_PREFIX}topic-warning`;
                topicWarningElement.textContent = "[Yazar Filtresi Aktif]"; // Keep it simple

                // Generate a more informative title attribute (tooltip)
                let titleText = `Bu sayfada ${filteredEntryCountOnPage} entry filtrelendi (${config.filterMode === 'hide' ? 'gizlendi' : 'daraltıldı'}).`;
                if (firstEntryAuthorFilteredOnPage) {
                    titleText += " Sayfanın ilk entry'si de filtrelendi.";
                } else if (filteredEntryCountOnPage <= TOPIC_WARNING_THRESHOLD) {
                     // This case should technically not happen due to showWarning logic, but added for robustness
                     titleText += ` (Uyarı ${TOPIC_WARNING_THRESHOLD} filtreden sonra gösterilir.)`;
                }
                topicWarningElement.title = titleText;

                // Append the warning element
                targetElement.insertAdjacentElement('beforeend', topicWarningElement); // Append after the title text/link
                logger.debug("Konu başlığı uyarısı eklendi.");
            } else {
                 // logger.debug(`Konu başlığı uyarısı gösterilmedi (filtrelenen: ${filteredEntryCountOnPage}, ilk entry: ${firstEntryAuthorFilteredOnPage}, eşik: ${TOPIC_WARNING_THRESHOLD})`);
            }
        } catch (err) {
            logger.error("Konu başlığı uyarısı eklenirken HATA oluştu:", err);
            topicWarningElement?.remove(); // Clean up if error occurred during creation/insertion
            topicWarningElement = null;
        }
    };

    const processVisibleEntries = debounce(() => {
        logger.debug("Görünürdeki entry'ler işleniyor (debounce)...");
        filteredEntryCountOnPage = 0; // Reset page counter for this run
        firstEntryAuthorFilteredOnPage = false; // Reset page flag for this run

        // Select only unprocessed entries with the data-author attribute within the list
        const selector = '#entry-item-list > li[data-author]:not([data-efh-processed]), #entry-item-list > li[data-author][data-efh-processed^="skipped"]';
        const entries = document.querySelectorAll(selector);

        if (entries.length > 0) {
            logger.log(`${entries.length} yeni/işlenmemiş entry bulundu. İşleniyor...`);

            // Check if the very first entry on the page (overall first child) needs processing
            const pageFirstEntryElement = document.querySelector('#entry-item-list > li:first-child');
            const isFirstEntryOnPageOverall = (el) => el === pageFirstEntryElement;

            entries.forEach(entry => {
                // Pass true if this entry is the very first one on the entire page list
                enhanceEntry(entry, isFirstEntryOnPageOverall(entry));
            });

            updateTopicWarning(); // Update warning after processing the batch
            logger.log(`Bu işlem döngüsü tamamlandı. Bu sayfada toplam ${filteredEntryCountOnPage} entry filtrelendi.`);
        } else {
            logger.debug("İşlenecek yeni entry bulunamadı.");
             // Re-run warning update in case some entries were un-hidden manually (though this doesn't reset counts)
             updateTopicWarning();
        }
    }, DEBOUNCE_DELAY_MS);

    // --- Init ---
    async function initialize() {
        logger.log(`Script BAŞLATILIYOR... v${GM_info?.script?.version || '?'}`);
        await loadConfig(); // Load config first

        let listUpdatedInBackground = false;
        if (!config.paused) {
            const now = Date.now();
            const timeSinceUpdate = now - (config.lastUpdate || 0);
            const needsUpdate = filteredListSize === 0 || timeSinceUpdate > UPDATE_INTERVAL_MS;

            if (needsUpdate) {
                logger.log(`Liste ${filteredListSize === 0 ? 'boş' : 'güncel değil'} (${Math.round(timeSinceUpdate / 3600000)} saat önce). Arka planda senkronizasyon deneniyor...`);
                // Start sync but don't wait for it to finish before initial processing
                syncList(filteredListSize === 0).then(updated => {
                    if (updated) {
                        listUpdatedInBackground = true;
                        logger.log("Arka plan liste güncellemesi TAMAMLANDI. Yeni boyut: " + filteredListSize);
                        // Re-process entries as the list has changed
                        processVisibleEntries();
                    } else {
                        logger.log("Arka plan liste güncellemesi sonucu liste değişmedi veya başarısız oldu.");
                    }
                }).catch(err => {
                    // Error is already logged within syncList
                    logger.error("Arka plan senkronizasyonunda yakalanamayan hata:", err);
                });
            } else {
                logger.log(`Liste güncel görünüyor (Son güncelleme ${Math.round(timeSinceUpdate / 3600000)} saat önce).`);
            }
            if (filteredAuthorsSet.size === 0 && !needsUpdate) {
                // Only warn if not attempting an update
                logger.warn("UYARI: Filtre listesi boş veya yüklenemedi!");
            }
        } else {
            logger.log("Filtre başlangıçta DURAKLATILMIŞ.");
        }

        // Initial processing immediately after load (might use old list if sync is pending)
        logger.debug("İlk entry işleme başlatılıyor...");
        processVisibleEntries();

        // Observer Setup
        const entryListContainer = document.querySelector('#entry-item-list');
        if (entryListContainer) {
            try {
                const observer = new MutationObserver(mutations => {
                    // Check if any added nodes are relevant list items
                    const hasRelevantAdditions = mutations.some(m =>
                        m.type === 'childList' && m.addedNodes.length > 0 &&
                        Array.from(m.addedNodes).some(n =>
                            n.nodeType === Node.ELEMENT_NODE &&
                            (n.matches?.('li[data-author]') || n.querySelector?.('li[data-author]')) // Check node itself or children
                        )
                    );

                    if (hasRelevantAdditions) {
                        logger.debug("Observer: Yeni entry(ler) içeren değişiklik tespit edildi.");
                        processVisibleEntries(); // Trigger debounced processing
                    }
                });
                observer.observe(entryListContainer, { childList: true, subtree: true }); // Watch for added nodes anywhere in the list container
                logger.log("#entry-item-list başarıyla İZLENİYOR.");
            } catch (err) {
                logger.error("MutationObserver BAŞLATILAMADI:", err);
                showFeedback("Kritik Hata", "Sayfa değişiklikleri (yeni entry'ler) otomatik olarak İZLENEMİYOR! Sayfayı yenilemeniz gerekebilir.", { isError: true });
            }
        } else {
            logger.warn("#entry-item-list BULUNAMADI! Sayfa yapısı değişmiş olabilir. Dinamik olarak yüklenen entry'ler işlenemeyecek.");
        }

        registerMenuCommands(); // Setup menu commands
        logger.log(`🎉 ${SCRIPT_NAME} başarıyla yüklendi ve aktif.`);
    }

    // --- Menu ---
    function registerMenuCommands() {
        // Helper to set config and reload
        const setConfigAndReload = async (key, value, msg) => {
            try {
                await GM_setValue(key, value);
                config[key] = value; // Update in-memory config as well
                showFeedback("Ayar Değiştirildi", msg, { silent: true }); // Silent alert before reload
                logger.log(`Ayar değiştirildi (${key}=${value}). Sayfa yenileniyor...`);
                location.reload();
            } catch (err) {
                showFeedback("Depolama Hatası", `Ayar (${key}) kaydedilemedi.\n${err.message}`, { isError: true });
                registerMenuCommands(); // Re-register to show the *old* state if save failed
            }
        };

        // Clear existing commands before registering new ones (useful for updates/debugging)
        // Note: Tampermonkey typically handles this, but explicit removal can be safer in some contexts.
        // However, GM_unregisterMenuCommand is not standard/widely supported. We rely on Tampermonkey's overwrite.

        GM_registerMenuCommand(`${config.paused ? "▶️ Filtreyi AKTİF ET" : "⏸️ Filtreyi DURDUR"}`, () => {
            setConfigAndReload(KEY_PAUSED, !config.paused, `Filtre ${!config.paused ? 'AKTİF' : 'DURDU'}. Sayfa yenileniyor...`);
        });

        GM_registerMenuCommand(`Mod: ${config.filterMode === 'hide' ? 'Gizle' : 'Daralt'} (Değiştirmek için tıkla)`, () => {
            const newMode = config.filterMode === 'hide' ? 'collapse' : 'hide';
            setConfigAndReload(KEY_MODE, newMode, `Filtreleme modu "${newMode === 'hide' ? 'Gizle' : 'Daralt'}" olarak ayarlandı. Sayfa yenileniyor...`);
        });

        GM_registerMenuCommand(`Başlık Uyarısını ${config.showWarning ? "🚫 Gizle" : "⚠️ Göster"}`, () => {
            setConfigAndReload(KEY_SHOW_WARNING, !config.showWarning, `Konu başlığı uyarısı ${!config.showWarning ? 'gösterilecek' : 'gizlenecek'}. Sayfa yenileniyor...`);
        });

        GM_registerMenuCommand("🔄 Listeyi ŞİMDİ Güncelle", async () => {
            showFeedback("Güncelleme", "Liste uzak sunucudan alınıyor...", { silent: true }); // Start feedback silently
            const updated = await syncList(true); // Force update
            if (updated) {
                showFeedback("Başarılı", `Liste güncellendi (${filteredListSize} yazar). Değişikliklerin uygulanması için sayfa yenileniyor...`);
                location.reload(); // Reload on successful update
            } else {
                // Provide non-silent feedback if update failed or list was same
                 showFeedback("Güncelleme Sonucu", "Liste güncellenemedi (hata oluştu veya liste zaten günceldi). Daha fazla bilgi için konsolu kontrol edin.", { isError: filteredListSize === 0 }); // Show error if list remains empty
            }
        });

        GM_registerMenuCommand(`📊 Filtre İstatistikleri`, async () => {
            // Re-read total filtered count for accuracy, others are likely up-to-date in memory
            const total = await GM_getValue(KEY_TOTAL_FILTERED, config.totalFiltered);
            const lastUpdateDate = config.lastUpdate ? new Date(config.lastUpdate).toLocaleString("tr-TR") : "Hiç";
            const statsText = `Genel Toplam Filtrelenen: ${total}\n`
                            + `Mevcut Liste Boyutu: ${filteredListSize}\n`
                            + `Son Liste Kontrolü/Güncellemesi: ${lastUpdateDate}\n`
                            + `Filtre Durumu: ${config.paused ? 'DURAKLATILDI' : 'AKTİF'}\n`
                            + `Mod: ${config.filterMode === 'hide' ? 'Gizle' : 'Daralt'}`;
            showFeedback("İstatistikler", statsText);
        });

        GM_registerMenuCommand(`🗑️ Önbelleği ve Ayarları Sıfırla`, async () => {
             if (confirm(`[${SCRIPT_NAME}] Emin misiniz?\n\nBu işlem TÜM AYARLARI (durum, mod, uyarı) ve yerel liste önbelleğini SIFIRLAR. Sayfa yenilendikten sonra liste tekrar indirilecektir.`)) {
                 logger.warn("Kullanıcı önbelleği ve ayarları sıfırlamayı seçti.");
                 try {
                     // List all keys to delete
                     const keysToDelete = [KEY_PAUSED, KEY_MODE, KEY_SHOW_WARNING, KEY_LIST_RAW, KEY_LAST_UPDATE, KEY_TOTAL_FILTERED];
                     await Promise.all(keysToDelete.map(key => GM_deleteValue(key)));

                     // Reset in-memory state immediately
                     filteredAuthorsSet = new Set();
                     filteredListSize = 0;
                     config = { paused: false, filterMode: 'collapse', showWarning: true, listRaw: '', lastUpdate: 0, totalFiltered: 0 }; // Reset to defaults

                     showFeedback("Başarılı", "Tüm ayarlar ve önbellek temizlendi. Varsayılan ayarlara dönüldü. Sayfa yenileniyor...");
                     location.reload();
                 } catch (err) {
                      logger.error("Önbellek/Ayarlar temizlenirken HATA:", err);
                      showFeedback("Hata", `Önbellek ve ayarlar temizlenemedi: ${err.message}`, { isError: true });
                 }
             } else {
                 showFeedback("İptal", "Sıfırlama işlemi iptal edildi.", { silent: true });
             }
        });
    }

    // --- Start ---
    // Wrap initialization in a try-catch for ultimate safety
    try {
         initialize().catch(err => { // Catch potential errors within the async initialize function itself
            logger.error("Başlatma sırasında KRİTİK HATA (initialize içinde yakalandı):", err);
            alert(`[${SCRIPT_NAME}] BAŞLATMA BAŞARISIZ!\n\nHata: ${err.message}\n\nDetaylar için konsolu (F12) kontrol edin.`);
        });
    } catch (err) { // Catch potential errors during the setup before initialize() is even called
        logger.error("Başlatma sırasında KRİTİK HATA (initialize dışında yakalandı):", err);
        alert(`[${SCRIPT_NAME}] KRİTİK BAŞLATMA HATASI!\n\nHata: ${err.message}\n\nScript çalışamayabilir.`);
    }

})();
// --- END ---
