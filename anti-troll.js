// ==UserScript==
// @name         Ekşi Author Filter
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Filters entries from specified authors on Ekşi Sözlük, loaded from a remote list.
// @author      
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
// @connect      raw.githubusercontent.com
// @connect      gist.githubusercontent.com
// @connect      *
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
    const SCRIPT_NAME = "Ekşi Author Filter (Mini)";
    const AUTHOR_LIST_URL = "https://raw.githubusercontent.com/unless7146/stardust3903/main/173732994.txt"; // !!! REPLACE !!!
    const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
    const NETWORK_TIMEOUT_MS = 20000; // 20s
    const LOG_PREFIX = `[${SCRIPT_NAME}]`;
    const DEBOUNCE_DELAY_MS = 250;
    const TOPIC_WARNING_THRESHOLD = 3;
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
        .${CSS_PREFIX}topic-warning { background-color:#fff0f0; border:1px solid #d9534f; border-left:3px solid #d9534f; border-radius:3px; padding:2px 6px; margin-left:8px; font-size:0.85em; color:#a94442; display:inline-block; vertical-align:middle; cursor:default; font-weight:bold; }
        .${CSS_PREFIX}collapsed > .content, .${CSS_PREFIX}collapsed > footer > .feedback-container, .${CSS_PREFIX}collapsed > footer .entry-footer-bottom > .footer-info > div:not(#entry-nick-container):not(:has(.entry-date)) { display: none !important; }
        .${CSS_PREFIX}collapsed > footer, .${CSS_PREFIX}collapsed footer > .info, .${CSS_PREFIX}collapsed footer .entry-footer-bottom { min-height: 1px; }
        .${CSS_PREFIX}collapsed #entry-nick-container, .${CSS_PREFIX}collapsed .entry-date { display:inline-block !important; visibility:visible !important; opacity:1 !important; }
        .${CSS_PREFIX}collapsed { min-height:35px !important; padding-bottom:0 !important; margin-bottom:10px !important; border-left:3px solid #ffcccc !important; background-color:rgba(128,128,128,0.03); overflow:hidden; }
        .${CSS_PREFIX}collapse-placeholder { min-height:25px; background-color:transparent; border:none; padding:6px 10px 6px 12px; margin-bottom:0px; font-style:normal; color:#6c757d; position:relative; display:flex; align-items:center; flex-wrap:wrap; box-sizing:border-box; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}collapse-icon { margin-right:6px; opacity:0.9; font-style:normal; display:inline-block; color:#dc3545; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}collapse-text { margin-right:10px; flex-grow:1; display:inline-block; font-size:0.9em; font-weight:500; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}collapse-text strong { color:#dc3545; font-weight:600; }
        .${CSS_PREFIX}show-link { font-style:normal; flex-shrink:0; margin-left:auto; }
        .${CSS_PREFIX}show-link a { cursor:pointer; text-decoration:none; color:#0d6efd; font-size:0.9em; padding:1px 4px; border-radius:3px; font-weight:bold; border:1px solid transparent; transition: color 0.15s ease-in-out; }
        .${CSS_PREFIX}show-link a::before { content:"» "; opacity:0.7; }
        .${CSS_PREFIX}show-link a:hover { color:#0a58ca; text-decoration:underline; background-color:rgba(13,110,253,0.1); border-color:rgba(13,110,253,0.2); }
        .${CSS_PREFIX}hidden { display: none !important; }
        .${CSS_PREFIX}opened-warning { font-size:0.8em; color:#856404; background-color:#fff3cd; border:1px solid #ffeeba; border-radius:3px; padding:1px 4px; margin-left:8px; vertical-align:middle; cursor:default; display:inline-block; font-style:normal; font-weight:bold; }
    `);

    // --- Helpers ---
    const logger = {
        log: (...args) => console.log(LOG_PREFIX, ...args),
        warn: (...args) => console.warn(LOG_PREFIX, ...args),
        error: (...args) => console.error(LOG_PREFIX, ...args),
        debug: (...args) => console.debug(LOG_PREFIX, ...args),
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
        const errorMsg = `KRİTİK HATA: Gerekli Tampermonkey API fonksiyonları eksik: ${missing.join(', ')}! Script ÇALIŞMAYACAK.`;
        logger.error(errorMsg); alert(`${SCRIPT_NAME} - KRİTİK HATA:\n${errorMsg}`); return;
    }

    // --- Feedback ---
    function showFeedback(title, text, options = {}) {
        const { isError = false, silent = false } = options;
        const prefix = isError ? "HATA" : "BİLGİ";
        (isError ? logger.error : logger.log)(title, text);
        if (!silent) alert(`[${SCRIPT_NAME}] ${prefix}: ${title}\n\n${text}`);
    }

    // --- State ---
    let config = {};
    let filteredAuthorsSet = new Set();
    let filteredListSize = 0;
    let filteredEntryCount = 0;
    let firstEntryAuthorFiltered = false;
    let topicWarningElement = null;

    // --- Config Load ---
    async function loadConfig() {
        logger.debug("Yapılandırma yükleniyor...");
        try {
            const [paused, filterMode, showWarning, listRaw, lastUpdate, totalFiltered] = await Promise.all([
                GM_getValue(KEY_PAUSED, false),
                GM_getValue(KEY_MODE, "collapse"),
                GM_getValue(KEY_SHOW_WARNING, true),
                GM_getValue(KEY_LIST_RAW, ""),
                GM_getValue(KEY_LAST_UPDATE, 0),
                GM_getValue(KEY_TOTAL_FILTERED, 0)
            ]);
            config = { paused, filterMode, showWarning, listRaw, lastUpdate, totalFiltered };
            filteredAuthorsSet = parseAuthorList(config.listRaw); // Parse raw list directly
            filteredListSize = filteredAuthorsSet.size;
            logger.log(`Yapılandırma yüklendi. Filtre: ${config.paused ? 'DURDU' : 'AKTİF'}, Mod: ${config.filterMode}, Liste Boyutu: ${filteredListSize}`);
        } catch (err) {
            logger.error("Yapılandırma YÜKLENEMEDİ:", err);
            config = { paused: false, filterMode: 'collapse', showWarning: true, listRaw: '', lastUpdate: 0, totalFiltered: 0 };
            filteredAuthorsSet = new Set();
            filteredListSize = 0;
            showFeedback("Yapılandırma Hatası", "Ayarlar yüklenemedi! Varsayılanlar kullanılıyor.", { isError: true });
        }
    }

    // --- Core Functions ---
    const fetchList = () => new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET", url: AUTHOR_LIST_URL, timeout: NETWORK_TIMEOUT_MS, responseType: 'text',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' },
            onload: r => (r.status >= 200 && r.status < 300) ? resolve(r.responseText) : reject(new Error(`HTTP ${r.status}`)),
            onerror: r => reject(new Error(`Ağ Hatası: ${r.statusText || 'Bilinmeyen'}`)),
            ontimeout: () => reject(new Error(`Zaman Aşımı (${NETWORK_TIMEOUT_MS / 1000}s)`))
        });
    });

    const parseAuthorList = (rawText) => {
        if (!rawText || typeof rawText !== 'string') return new Set();
        try {
            return new Set(rawText.split(/[\r\n]+/)
                .map(line => line.trim().toLowerCase())
                .filter(line => line && !line.startsWith("#")));
        } catch (err) {
            logger.error("Liste AYRIŞTIRILAMADI:", err); return new Set();
        }
    };

    const syncList = async (force = false) => {
        logger.log(`Liste güncellemesi ${force ? 'ZORLANIYOR' : 'kontrol ediliyor'}...`);
        let newRawText;
        try { newRawText = await fetchList(); }
        catch (err) {
            logger.error("Liste ÇEKME hatası:", err.message);
            if (force || filteredListSize === 0) showFeedback("Güncelleme Başarısız", `Liste alınamadı.\n${err.message}`, { isError: true });
            return false;
        }

        try {
            if (force || config.listRaw !== newRawText) {
                logger.log(force ? "Zorunlu güncelleme." : "Liste değişmiş, güncelleniyor.");
                const newListSet = parseAuthorList(newRawText);

                if (filteredListSize > 0 && newListSet.size === 0 && newRawText.length > 0) {
                    logger.warn("Yeni veri var ama ayrıştırma sonucu boş! Eski liste korunuyor.");
                    config.lastUpdate = Date.now();
                    await GM_setValue(KEY_LAST_UPDATE, config.lastUpdate).catch(e=>logger.error("Zaman damgası kaydı (ayrıştırma hatası sonrası) başarısız:", e));
                    return false;
                }

                const oldSize = filteredListSize;
                filteredAuthorsSet = newListSet;
                filteredListSize = filteredAuthorsSet.size;
                config.listRaw = newRawText;
                config.lastUpdate = Date.now();
                logger.log(`Liste güncellendi. Eski: ${oldSize}, Yeni: ${filteredListSize}`);

                await Promise.all([
                    GM_setValue(KEY_LIST_RAW, config.listRaw),
                    GM_setValue(KEY_LAST_UPDATE, config.lastUpdate)
                ]).catch(err => {
                    logger.error("Güncel liste verileri KAYDEDİLEMEDİ:", err);
                    showFeedback("Depolama Hatası", "Liste güncellendi ancak kaydedilemedi.", { isError: true });
                });
                return true; // Updated

            } else {
                logger.log("Liste zaten güncel.");
                config.lastUpdate = Date.now();
                await GM_setValue(KEY_LAST_UPDATE, config.lastUpdate).catch(e=>logger.error("Zaman damgası kaydı başarısız:", e));
                return false; // Not updated
            }
        } catch (err) {
            logger.error("Liste İŞLEME hatası:", err);
            showFeedback("Liste İşleme Hatası", `Liste işlenemedi.\n${err.message}`, { isError: true });
            return false;
        }
    };

    function applyFilterAction(entry, author) {
        const entryId = entry.dataset.id || 'ID Yok';
        if (config.filterMode === "hide") {
            entry.classList.add(`${CSS_PREFIX}hidden`);
            logger.debug(`Gizlendi: ${entryId} (${author})`);
            return 'hide';
        }

        // Collapse Mode
        const contentEl = entry.querySelector(".content");
        if (!contentEl) return 'collapse_failed_no_content';
        if (entry.classList.contains(`${CSS_PREFIX}collapsed`)) return 'already_collapsed';

        const originalDisplay = contentEl.style.display;
        contentEl.style.display = 'none';

        let placeholder = entry.querySelector(`.${CSS_PREFIX}collapse-placeholder`);
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = `${CSS_PREFIX}collapse-placeholder`;
            placeholder.innerHTML = `<span class="${CSS_PREFIX}collapse-icon" title="Yazar '${author}' filtre listesinde.">🚫</span><span class="${CSS_PREFIX}collapse-text">Filtrelenen yazar: <strong>${author}</strong>.</span><div class="${CSS_PREFIX}show-link"><a href="#" role="button">Göster</a></div>`;

            const footerEl = entry.querySelector('footer');
            entry.insertBefore(placeholder, footerEl || entry.lastElementChild); // Insert before footer or as last element

            const showLink = placeholder.querySelector(`.${CSS_PREFIX}show-link a`);
            if (showLink) {
                showLink.addEventListener("click", (e) => {
                    e.preventDefault(); e.stopPropagation();
                    contentEl.style.display = originalDisplay || '';
                    placeholder.remove();
                    entry.classList.remove(`${CSS_PREFIX}collapsed`);
                    const footer = entry.querySelector('footer');
                    if (footer && !footer.querySelector(`.${CSS_PREFIX}opened-warning`)) {
                        const warningSpan = document.createElement('span');
                        warningSpan.className = `${CSS_PREFIX}opened-warning`;
                        warningSpan.textContent = '⚠️ Filtrelendi';
                        warningSpan.title = `'${author}' yazarına ait bu içerik filtre nedeniyle daraltılmıştı.`;
                        footer.appendChild(warningSpan);
                    }
                }, { once: true });
            }
        } else {
             placeholder.style.display = 'flex';
        }

        entry.classList.add(`${CSS_PREFIX}collapsed`);
        logger.debug(`Daraltıldı: ${entryId} (${author})`);
        return 'collapse';
    }

    function enhanceEntry(entry, isFirstOnPage = false) {
        if (entry.dataset.efhProcessed === 'true') return;
        const author = entry.dataset.author?.toLowerCase().trim();
        if (!author) { entry.dataset.efhProcessed = 'true'; return; } // Skip if no author

        const entryId = entry.dataset.id || 'ID Yok';
        let action = 'none';
        try {
            if (!config.paused && filteredAuthorsSet.has(author)) {
                if (isFirstOnPage) firstEntryAuthorFiltered = true;
                filteredEntryCount++;
                action = applyFilterAction(entry, entry.dataset.author); // Use original case for display

                // Update total count (fire and forget)
                config.totalFiltered = (config.totalFiltered || 0) + 1;
                GM_setValue(KEY_TOTAL_FILTERED, config.totalFiltered).catch(err => logger.warn("Toplam sayaç kaydedilemedi:", err));
            } else {
                action = config.paused ? 'paused' : 'not_in_list';
            }
        } catch (err) {
            logger.error(`Entry ${entryId} İŞLENEMEDİ (Yazar: ${author}):`, err);
            action = 'error';
        }
        entry.dataset.efhProcessed = 'true';
        entry.dataset.efhAction = action;
    }

    const updateTopicWarning = () => {
        try {
            topicWarningElement?.remove(); // Remove existing warning if any
            topicWarningElement = null;

            if (!config.showWarning || config.paused) return;

            const titleH1 = document.getElementById("title");
            if (!titleH1) return;
            const targetElement = titleH1.querySelector('a') || titleH1;

            const showWarning = firstEntryAuthorFiltered || filteredEntryCount > TOPIC_WARNING_THRESHOLD;

            if (showWarning) {
                topicWarningElement = document.createElement("span");
                topicWarningElement.id = `${CSS_PREFIX}title-warning`;
                topicWarningElement.className = `${CSS_PREFIX}topic-warning`;
                topicWarningElement.textContent = "[Yazar Filtresi Aktif]";

                let title = "Filtre uygulandı: ";
                title += firstEntryAuthorFiltered ? "İlk entry yazarı" : "";
                title += (firstEntryAuthorFiltered && filteredEntryCount > 1) ? " ve " : "";
                title += (!firstEntryAuthorFiltered && filteredEntryCount > TOPIC_WARNING_THRESHOLD) ? `${filteredEntryCount} yazar` : "";
                title += (firstEntryAuthorFiltered && filteredEntryCount > 1 && filteredEntryCount <= TOPIC_WARNING_THRESHOLD + 1) ? `${filteredEntryCount - 1} diğer yazar` : "";
                 title += " filtrelendi.";
                 topicWarningElement.title = title.replace(" ve  filtrelendi.", " filtrelendi."); // Clean up edge case

                targetElement.appendChild(topicWarningElement);
                logger.debug("Konu başlığı uyarısı eklendi.");
            }
        } catch (err) {
            logger.error("Konu başlığı uyarısı HATA:", err);
            topicWarningElement?.remove(); topicWarningElement = null;
        }
    };

    const processVisibleEntries = debounce(() => {
        logger.debug("Görünürdeki entry'ler işleniyor...");
        filteredEntryCount = 0; // Reset page counter
        firstEntryAuthorFiltered = false; // Reset page flag

        const selector = '#entry-item-list > li[data-author]:not([data-efh-processed="true"])';
        const entries = document.querySelectorAll(selector);

        if (entries.length > 0) {
            logger.log(`${entries.length} yeni entry işlenecek.`);
            const isFirstEntry = (el) => el === entries[0] && el.parentElement?.firstChild === el;
            entries.forEach(entry => enhanceEntry(entry, isFirstEntry(entry)));
            updateTopicWarning(); // Update warning after processing the batch
            logger.log(`Bu parti işlem tamam. Filtrelenen: ${filteredEntryCount}`);
        }
    }, DEBOUNCE_DELAY_MS);

    // --- Init ---
    async function initialize() {
        logger.log("Script BAŞLATILIYOR...");
        await loadConfig();

        if (!config.paused) {
            const now = Date.now();
            const timeSinceUpdate = now - (config.lastUpdate || 0);
            if (filteredListSize === 0 || timeSinceUpdate > UPDATE_INTERVAL_MS) {
                logger.log(`Liste ${filteredListSize === 0 ? 'boş' : 'güncel değil'}. Arka planda senkronizasyon deneniyor...`);
                syncList(filteredListSize === 0).then(updated => {
                    if (updated) {
                        logger.log("Arka plan liste güncellemesi TAMAM. Yeni boyut: " + filteredListSize);
                        processVisibleEntries(); // Re-process if list changed after initial load
                    }
                }).catch(err => logger.error("Arka plan sync hatası:", err));
            } else {
                logger.log("Liste güncel görünüyor.");
            }
            if (filteredAuthorsSet.size === 0) logger.warn("UYARI: Filtre listesi boş!");
        } else {
            logger.log("Filtre DURDURULMUŞ.");
        }

        processVisibleEntries(); // Initial processing

        // Observer Setup
        const entryListContainer = document.querySelector('#entry-item-list');
        if (entryListContainer) {
            try {
                const observer = new MutationObserver(mutations => {
                    let needsProcessing = mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0 &&
                        Array.from(m.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE && (n.matches?.('li[data-author]:not([data-efh-processed="true"])') || n.querySelector?.('li[data-author]:not([data-efh-processed="true"])')))
                    );
                    if (needsProcessing) {
                        logger.debug("Observer: Yeni entry(ler) tespit edildi.");
                        processVisibleEntries();
                    }
                });
                observer.observe(entryListContainer, { childList: true, subtree: true });
                logger.log("#entry-item-list İZLENİYOR.");
            } catch (err) {
                logger.error("MutationObserver BAŞLATILAMADI:", err);
                showFeedback("Kritik Hata", "Sayfa değişiklikleri İZLENEMİYOR!", { isError: true });
            }
        } else {
            logger.warn("#entry-item-list BULUNAMADI! Dinamik entry'ler işlenemeyecek.");
        }

        registerMenuCommands();
        logger.log(`🎉 ${SCRIPT_NAME} yüklendi. v${GM_info?.script?.version || '?'}`);
    }

    // --- Menu ---
    function registerMenuCommands() {
        const setConfigAndReload = async (key, value, msg) => {
            try {
                await GM_setValue(key, value);
                showFeedback("Ayar Değiştirildi", msg, { silent: true });
                location.reload();
            } catch (err) {
                showFeedback("Depolama Hatası", `Ayar (${key}) kaydedilemedi.\n${err.message}`, { isError: true });
                registerMenuCommands(); // Re-register to show old state
            }
        };

        GM_registerMenuCommand(`${config.paused ? "▶️ Filtreyi AKTİF ET" : "⏸️ Filtreyi DURDUR"}`, () => {
            setConfigAndReload(KEY_PAUSED, !config.paused, `Filtre ${!config.paused ? 'AKTİF' : 'DURDU'}. Sayfa yenileniyor...`, true);
        });
        GM_registerMenuCommand(`Mod: ${config.filterMode === 'hide' ? 'Gizle' : 'Daralt'} (Değiştir)`, () => {
            const newMode = config.filterMode === 'hide' ? 'collapse' : 'hide';
            setConfigAndReload(KEY_MODE, newMode, `Mod "${newMode === 'hide' ? 'Gizle' : 'Daralt'}" oldu. Sayfa yenileniyor...`, true);
        });
        GM_registerMenuCommand(`Başlık Uyarısını ${config.showWarning ? "🚫 Gizle" : "⚠️ Göster"}`, () => {
            setConfigAndReload(KEY_SHOW_WARNING, !config.showWarning, `Başlık uyarısı ${!config.showWarning ? 'gösterilecek' : 'gizlenecek'}. Sayfa yenileniyor...`, true);
        });
        GM_registerMenuCommand("🔄 Listeyi ŞİMDİ Güncelle", async () => {
            showFeedback("Güncelleme", "Liste çekiliyor...", { silent: true });
            const updated = await syncList(true);
            if (updated) {
                showFeedback("Başarılı", `Liste güncellendi (${filteredListSize} yazar). Sayfa yenileniyor...`);
                location.reload();
            } else {
                 showFeedback("Güncelleme", "Liste güncellenemedi veya zaten günceldi.", { silent: false });
            }
        });
        GM_registerMenuCommand(`📊 Filtre İstatistikleri`, async () => {
            const total = await GM_getValue(KEY_TOTAL_FILTERED, config.totalFiltered); // Re-read
            const lastUpdate = config.lastUpdate ? new Date(config.lastUpdate).toLocaleString("tr-TR") : "Hiç";
            showFeedback("İstatistik", `Toplam Filtrelenen: ${total}\nMevcut Liste Boyutu: ${filteredListSize}\nSon Güncelleme: ${lastUpdate}`);
        });
        GM_registerMenuCommand(`🗑️ Önbelleği Temizle`, async () => {
            if (confirm(`[${SCRIPT_NAME}] Emin misiniz?\n\nYerel liste önbelleği ve zaman damgası silinecek.`)) {
                 try {
                     await Promise.all([GM_deleteValue(KEY_LIST_RAW), GM_deleteValue(KEY_LAST_UPDATE)]);
                     filteredAuthorsSet = new Set(); filteredListSize = 0; config.listRaw = ""; config.lastUpdate = 0;
                     showFeedback("Başarılı", "Önbellek temizlendi. Sayfa yenilenince liste yeniden yüklenecek.");
                     location.reload();
                 } catch (err) { showFeedback("Hata", `Önbellek temizlenemedi: ${err.message}`, { isError: true }); }
            } else { showFeedback("İptal", "Önbellek silinmedi.", { silent: true }); }
        });
    }

    // --- Start ---
    initialize().catch(err => {
        logger.error("Başlatılırken YAKALANAMAYAN KRİTİK HATA:", err);
        alert(`[${SCRIPT_NAME}] BAŞLATMA BAŞARISIZ!\n\nHata: ${err.message}`);
    });

})();
// --- END ---

