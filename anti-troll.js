// ==UserScript==
// @name         Ekşi Author Filter
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Filters entries from a remote list (hide/collapse) and adds profile page warnings for Ekşi Sözlük.
// @author       @protono
// @match        *://eksisozluk.com/*
// @match        *://eksisozluk.com/
// @match        *://eksisozluk.com/*--*
// @match        *://eksisozluk.com/basliklar/gundem*
// @match        *://eksisozluk.com/basliklar/bugun*
// @match        *://eksisozluk.com/basliklar/populer*
// @match        *://eksisozluk.com/basliklar/debe*
// @match        *://eksisozluk.com/basliklar/kanal/*
// @match        *://eksisozluk.com/biri/*
// @exclude      *://eksisozluk.com/mesaj/*
// @exclude      *://eksisozluk.com/ayarlar/*
// @exclude      *://eksisozluk.com/hesap/*
// @exclude      *://eksisozluk.com/tercihler/*
// @icon         https://eksisozluk.com/favicon.ico
// @connect      raw.githubusercontent.com
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

    const SCRIPT_NAME = "Ekşi Sözlük Unified Filter";
    const PRIMARY_LIST_URL = "https://raw.githubusercontent.com/bat9254/troll-list/refs/heads/main/list.txt";
    const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
    const NETWORK_TIMEOUT_MS = 20000;
    const LOG_PREFIX = `[${SCRIPT_NAME}]`;
    const DEBOUNCE_DELAY_MS = 300;
    const SAVE_COUNT_DEBOUNCE_MS = 2500;
    const TOPIC_WARNING_THRESHOLD = 3;
    const CSS_PREFIX = "eusf-";

    const KEY_PAUSED = "eusf_paused_v1";
    const KEY_MODE = "eusf_filterMode_v1";
    const KEY_SHOW_WARNING = "eusf_showTopicWarning_v1";
    const KEY_LIST_RAW = "eusf_authorListRaw_v1";
    const KEY_LAST_UPDATE = "eusf_lastUpdateTime_v1";
    const KEY_TOTAL_FILTERED = "eusf_totalFiltered_v1";

    GM_addStyle(`
        .${CSS_PREFIX}topic-warning { background-color:#fff0f0; border:1px solid #d9534f; border-left:3px solid #d9534f; border-radius:3px; padding:2px 6px; margin-left:8px; font-size:0.85em; color:#a94442; display:inline-block; vertical-align:middle; cursor:help; font-weight:bold; }
        .${CSS_PREFIX}hidden { display: none !important; }
        .${CSS_PREFIX}collapsed > .content,
        .${CSS_PREFIX}collapsed > footer > .feedback-container,
        .${CSS_PREFIX}collapsed > footer .entry-footer-bottom > .footer-info > div:not(#entry-nick-container):not(:has(.entry-date)) { display: none !important; }
        .${CSS_PREFIX}collapsed > footer, .${CSS_PREFIX}collapsed footer > .info, .${CSS_PREFIX}collapsed footer .entry-footer-bottom { min-height: 1px; }
        .${CSS_PREFIX}collapsed #entry-nick-container, .${CSS_PREFIX}collapsed .entry-date { display:inline-block !important; visibility:visible !important; opacity:1 !important; }
        .${CSS_PREFIX}collapsed { min-height:35px !important; padding-bottom:0 !important; margin-bottom:10px !important; border-left:3px solid #ffcccc !important; background-color:rgba(128,128,128,0.03); overflow:hidden; }
        .${CSS_PREFIX}collapse-placeholder { min-height:25px; background-color:transparent; border:none; padding:6px 10px 6px 12px; margin-bottom:0px; font-style:normal; color:#6c757d; position:relative; display:flex; align-items:center; flex-wrap:wrap; box-sizing:border-box; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}collapse-icon { margin-right:6px; opacity:0.9; font-style:normal; display:inline-block; color:#dc3545; cursor:help; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}collapse-text { margin-right:10px; flex-grow:1; display:inline-block; font-size:0.9em; font-weight:500; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}collapse-text strong { color:#dc3545; font-weight:600; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}show-link { font-style:normal; flex-shrink:0; margin-left:auto; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}show-link a { cursor:pointer; text-decoration:none; color:#0d6efd; font-size:0.9em; padding:1px 4px; border-radius:3px; font-weight:bold; border:1px solid transparent; transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}show-link a::before { content:"» "; opacity:0.7; }
        .${CSS_PREFIX}collapse-placeholder .${CSS_PREFIX}show-link a:hover { color:#0a58ca; text-decoration:underline; background-color:rgba(13,110,253,0.1); border-color:rgba(13,110,253,0.2); }
        .${CSS_PREFIX}opened-warning { font-size:0.8em; color:#856404; background-color:#fff3cd; border:1px solid #ffeeba; border-radius:3px; padding:1px 4px; margin-left:8px; vertical-align:middle; cursor:help; display:inline-block; font-style:normal; font-weight:bold; }
        .${CSS_PREFIX}profile-warning { margin-left: 10px; padding: 2px 6px; font-size: 0.85em; font-weight: bold; color: #a94442; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; vertical-align: middle; cursor: help; }
    `);

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

    const requiredGmFunctions = ['GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'GM_registerMenuCommand', 'GM_addStyle', 'GM_deleteValue'];
    if (requiredGmFunctions.some(fn => typeof window[fn] !== 'function')) {
        const missing = requiredGmFunctions.filter(fn => typeof window[fn] !== 'function');
        const errorMsg = `Hata: Gerekli Tampermonkey API fonksiyonları eksik: ${missing.join(', ')}! Script çalışmayacak. Lütfen Tampermonkey'in güncel olduğundan ve script'e @grant yetkilerinin verildiğinden emin olun.`;
        logger.error(errorMsg);
        if (typeof window.alert === 'function') {
            alert(`${SCRIPT_NAME} - Hata:\n${errorMsg}`);
        }
        return;
    }

    function showFeedback(title, text, options = {}) {
        const { isError = false, silent = false } = options;
        const prefix = isError ? "Hata" : "Bilgi";
        (isError ? logger.error : logger.log)(`${prefix}: ${title}`, text);
        if (!silent && typeof window.alert === 'function') {
            alert(`[${SCRIPT_NAME}] ${prefix}: ${title}\n\n${text}`);
        }
    }

    let config = {};
    let filteredAuthorsSet = new Set();
    let filteredListSize = 0;
    let filteredEntryCountOnPage = 0;
    let firstEntryAuthorFilteredOnPage = false;
    let topicWarningElement = null;
    let isFirstEntryOnPageProcessed = false;
    let entryListContainerEl = null;

    async function loadConfig() {
        logger.debug("Yapılandırma yükleniyor...");
        try {
            const results = await Promise.allSettled([
                GM_getValue(KEY_PAUSED, false),
                GM_getValue(KEY_MODE, "collapse"),
                GM_getValue(KEY_SHOW_WARNING, true),
                GM_getValue(KEY_LIST_RAW, ""),
                GM_getValue(KEY_LAST_UPDATE, 0),
                GM_getValue(KEY_TOTAL_FILTERED, 0)
            ]);

            const getValueFromResult = (result, defaultValue, keyName) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    logger.warn(`'${keyName}' yüklenemedi, varsayılan (${defaultValue}) kullanılıyor. Hata:`, result.reason);
                    return defaultValue;
                }
            };

            config = {
                paused: getValueFromResult(results[0], false, KEY_PAUSED),
                filterMode: getValueFromResult(results[1], "collapse", KEY_MODE),
                showWarning: getValueFromResult(results[2], true, KEY_SHOW_WARNING),
                listRaw: getValueFromResult(results[3], "", KEY_LIST_RAW),
                lastUpdate: getValueFromResult(results[4], 0, KEY_LAST_UPDATE),
                totalFiltered: getValueFromResult(results[5], 0, KEY_TOTAL_FILTERED)
            };

            filteredAuthorsSet = parseAuthorList(config.listRaw);
            filteredListSize = filteredAuthorsSet.size;
            logger.log(`Yapılandırma: Durum: ${config.paused ? 'Duraklatıldı' : 'Aktif'}, Mod: ${config.filterMode}, Uyarılar: ${config.showWarning ? 'Açık' : 'Kapalı'}, Liste Boyutu: ${filteredListSize}, Toplam Filtrelenen: ${config.totalFiltered}`);

        } catch (err) {
            logger.error("Yapılandırma yüklenemedi:", err);
            config = { paused: false, filterMode: 'collapse', showWarning: true, listRaw: '', lastUpdate: 0, totalFiltered: 0 };
            filteredAuthorsSet = new Set();
            filteredListSize = 0;
            showFeedback("Yapılandırma Hatası", "Ayarlar yüklenemedi! Varsayılanlar kullanılıyor.", { isError: true });
        }
    }

    const debouncedSaveTotalFiltered = debounce(async (count) => {
        try {
            await GM_setValue(KEY_TOTAL_FILTERED, count);
            logger.debug(`Toplam filtreleme kaydedildi: ${count}`);
        } catch (err) {
            logger.warn("Toplam filtreleme kaydedilemedi:", err);
        }
    }, SAVE_COUNT_DEBOUNCE_MS);


    const fetchList = () => new Promise((resolve, reject) => {
        logger.debug(`Liste isteniyor: ${PRIMARY_LIST_URL}`);
        GM_xmlhttpRequest({
            method: "GET",
            url: PRIMARY_LIST_URL,
            timeout: NETWORK_TIMEOUT_MS,
            responseType: 'text',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' },
            onload: response => {
                if (response.status >= 200 && response.status < 300) {
                    logger.debug(`Liste alındı (HTTP ${response.status}). Boyut: ${response.responseText?.length ?? 0} bytes.`);
                    resolve(response.responseText ?? "");
                } else {
                    const errorMsg = `Liste alınamadı. Yanıt: HTTP ${response.status} ${response.statusText || ''}`;
                    logger.warn(errorMsg);
                    reject(new Error(errorMsg));
                }
            },
            onerror: response => {
                const errorMsg = `Liste çekme hatası: ${response.statusText || 'Ağ hatası'}`;
                logger.error(errorMsg, response);
                reject(new Error(errorMsg));
            },
            ontimeout: () => {
                const errorMsg = `Liste çekme zaman aşımı (${NETWORK_TIMEOUT_MS / 1000}s).`;
                logger.error(errorMsg);
                reject(new Error(errorMsg));
            }
        });
    });

    const parseAuthorList = (rawText) => {
        if (!rawText || typeof rawText !== 'string') {
            if (rawText) logger.warn("Liste metni geçersiz.");
            return new Set();
        }
        try {
            const authors = rawText.split(/\r?\n/)
                .map(line => line.replace(/#.*$/, '').trim().toLowerCase())
                .filter(line => line.length > 0);
            logger.debug(`Liste ayrıştırıldı, ${authors.length} yazar bulundu.`);
            return new Set(authors);
        } catch (err) {
            logger.error("Liste ayrıştırılamadı:", err);
            showFeedback("Liste Hatası", `Liste işlenemedi. Hata: ${err.message}`, { isError: true });
            return new Set();
        }
    };

    const syncList = async (force = false) => {
        logger.log(`Liste güncellemesi ${force ? 'zorlanıyor' : 'kontrol ediliyor'}...`);
        let newRawText;
        try {
            newRawText = await fetchList();
        } catch (err) {
            logger.error("Liste çekme hatası:", err.message);
            if (force || filteredListSize === 0) {
                showFeedback("Güncelleme Başarısız", `Liste alınamadı.\nHata: ${err.message}\nMevcut liste kullanılacak.`, { isError: true });
            }
            return false;
        }

        if (!force && config.listRaw === newRawText) {
            logger.log("Liste değişmemiş.");
            config.lastUpdate = Date.now();
            GM_setValue(KEY_LAST_UPDATE, config.lastUpdate).catch(e => logger.warn("Zaman damgası kaydı başarısız:", e));
            return false;
        }

        logger.log(force ? "Zorunlu güncelleme/liste değişmiş, işleniyor." : "Liste değişmiş, güncelleniyor.");
        let newListSet;
        try {
            newListSet = parseAuthorList(newRawText);
        } catch (err) {
            logger.error("Liste işleme hatası (syncList):", err);
            return false;
        }

        if (filteredListSize > 0 && newListSet.size === 0 && newRawText.trim().length > 0) {
            logger.warn("Yeni liste alındı ancak ayrıştırma boş! Eski liste korunuyor.");
            showFeedback("Güncelleme Uyarısı", "Yeni liste boş sonuç verdi (format hatası?). Eski liste kullanılıyor.", { isError: true });
            config.lastUpdate = Date.now();
            GM_setValue(KEY_LAST_UPDATE, config.lastUpdate).catch(e=>logger.warn("Zaman damgası kaydı (ayrıştırma hatası) başarısız:", e));
            return false;
        }

        const oldSize = filteredListSize;
        filteredAuthorsSet = newListSet;
        filteredListSize = filteredAuthorsSet.size;
        config.listRaw = newRawText;
        config.lastUpdate = Date.now();
        logger.log(`Liste güncellendi. Eski: ${oldSize}, Yeni: ${filteredListSize}`);

        try {
            await Promise.all([
                GM_setValue(KEY_LIST_RAW, config.listRaw),
                GM_setValue(KEY_LAST_UPDATE, config.lastUpdate)
            ]);
            logger.debug("Liste ve zaman damgası kaydedildi.");
        } catch (err) {
            logger.error("Liste verileri kaydedilemedi:", err);
            showFeedback("Depolama Hatası", "Liste güncellendi ancak kaydedilemedi.", { isError: true });
        }
        return true;
    };

    function applyFilterAction(entry, author) {
        const entryId = entry.dataset.id || 'ID Yok';
        const displayAuthor = entry.dataset.author || author;

        if (entry.querySelector(`.${CSS_PREFIX}opened-warning`)) {
            logger.debug(`Entry #${entryId} manuel açılmış, filtre uygulanmıyor.`);
            return false;
        }

        if (config.filterMode === "hide") {
            if (!entry.classList.contains(`${CSS_PREFIX}hidden`)) {
                entry.classList.add(`${CSS_PREFIX}hidden`);
                logger.debug(`Gizlendi: Entry #${entryId} (Yazar: ${displayAuthor})`);
                return true;
            }
            return false;
        }

        if (entry.classList.contains(`${CSS_PREFIX}collapsed`)) {
             logger.debug(`Entry #${entryId} zaten daraltılmış.`);
             return false;
        }

        const contentEl = entry.querySelector(".content");
        if (!contentEl) {
             logger.warn(`Daraltma: .content bulunamadı: Entry #${entryId}`);
             return false;
        }

        let placeholder = entry.querySelector(`.${CSS_PREFIX}collapse-placeholder`);
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = `${CSS_PREFIX}collapse-placeholder`;
            const strongAuthor = document.createElement('strong');
            strongAuthor.textContent = displayAuthor;

            const textSpan = document.createElement('span');
            textSpan.className = `${CSS_PREFIX}collapse-text`;
            textSpan.textContent = 'Listeden: ';
            textSpan.appendChild(strongAuthor);
            textSpan.insertAdjacentText('beforeend', '.');

            placeholder.innerHTML = `<span class="${CSS_PREFIX}collapse-icon" title="Yazar '${displayAuthor}' listede.">🚫</span>`;
            placeholder.appendChild(textSpan);
            placeholder.insertAdjacentHTML('beforeend', `<div class="${CSS_PREFIX}show-link"><a href="#" role="button">Göster</a></div>`);

            const showLink = placeholder.querySelector(`.${CSS_PREFIX}show-link a`);
            showLink?.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentEntry = e.target.closest('li[data-author]');
                if (!currentEntry) {
                    logger.warn("Genişletme: Üst entry bulunamadı.");
                    return;
                }
                const currentContent = currentEntry.querySelector(".content");
                const currentPlaceholder = currentEntry.querySelector(`.${CSS_PREFIX}collapse-placeholder`);
                const currentAuthor = currentEntry.dataset.author || '?';
                const currentId = currentEntry.dataset.id || '?';

                logger.debug(`Genişletiliyor: Entry #${currentId} (Yazar: ${currentAuthor})`);

                if (currentContent) currentContent.style.display = '';
                if (currentPlaceholder) currentPlaceholder.style.display = 'none';
                currentEntry.classList.remove(`${CSS_PREFIX}collapsed`);

                const footer = currentEntry.querySelector('footer');
                if (footer && !footer.querySelector(`.${CSS_PREFIX}opened-warning`)) {
                    const warningSpan = document.createElement('span');
                    warningSpan.className = `${CSS_PREFIX}opened-warning`;
                    warningSpan.textContent = '⚠️ Filtre Açıldı';
                    warningSpan.title = `'${currentAuthor}' içeriği daraltılmıştı.`;
                    const footerInfo = footer.querySelector('.info .footer-info') || footer.querySelector('.entry-footer-bottom .footer-info') || footer.querySelector('.info') || footer;
                    footerInfo.appendChild(warningSpan);
                 } else if (!footer) {
                     logger.warn(`Genişletilen entry #${currentId} footeri bulunamadı.`);
                 }
            });

            const footerEl = entry.querySelector('footer');
            if (footerEl) {
                 entry.insertBefore(placeholder, footerEl);
            } else if (contentEl) {
                 contentEl.parentNode.insertBefore(placeholder, contentEl.nextSibling);
            } else {
                 entry.appendChild(placeholder);
                 logger.warn(`Entry #${entryId} footer/content bulunamadı, placeholder sona eklendi.`);
            }
        } else {
             placeholder.style.display = 'flex';
        }

        if(contentEl) contentEl.style.display = 'none';
        entry.classList.add(`${CSS_PREFIX}collapsed`);
        logger.debug(`Daraltıldı: Entry #${entryId} (Yazar: ${displayAuthor})`);
        return true;
    }


    function enhanceEntry(entry) {
        if (config.paused) return false;
        if (entry.dataset.eusfProcessed === 'true') return false;
        if (!entry || !entry.matches || !entry.matches('li[data-author]')) {
             if (entry && entry.dataset) entry.dataset.eusfProcessed = 'skipped_invalid_element';
             return false;
        }

        const authorOriginal = entry.dataset.author;
        const authorLower = authorOriginal?.toLowerCase().trim();
        const entryId = entry.dataset.id || 'ID Yok';

        if (!authorLower) {
            logger.warn(`Entry #${entryId} için yazar adı ('data-author') bulunamadı/boş.`);
            entry.dataset.eusfProcessed = 'skipped_empty_author';
            return false;
        }

        entry.dataset.eusfProcessed = 'true';
        let filteredByList = false;

        const firstEntryElement = entryListContainerEl?.firstElementChild;

        try {
            if (filteredAuthorsSet.has(authorLower)) {
                if (!isFirstEntryOnPageProcessed && entry === firstEntryElement) {
                    firstEntryAuthorFilteredOnPage = true;
                    logger.debug(`İlk entry listeye göre filtrelenecek: #${entryId} (Yazar: ${authorOriginal})`);
                }

                if (applyFilterAction(entry, authorLower)) {
                    filteredByList = true;
                    filteredEntryCountOnPage++;
                    config.totalFiltered = (config.totalFiltered || 0) + 1;
                    debouncedSaveTotalFiltered(config.totalFiltered);
                    entry.dataset.eusfAction = `filtered_${config.filterMode}`;
                } else {
                    entry.dataset.eusfAction = 'filter_skipped_or_failed';
                }
            } else {
                 entry.dataset.eusfAction = 'not_in_list';
            }

        } catch (err) {
            logger.error(`Entry #${entryId} işlenemedi (Yazar: ${authorOriginal}):`, err);
            entry.dataset.eusfAction = 'processing_error';
        } finally {
             if (!isFirstEntryOnPageProcessed && entry === firstEntryElement) {
                 isFirstEntryOnPageProcessed = true;
             }
        }
        return filteredByList;
    }

    const debouncedUpdateTopicWarning = debounce(() => {
        const currentEntryListContainer = document.getElementById('entry-item-list');
        const currentTitleH1 = document.getElementById("title");

        if (!currentEntryListContainer || !currentTitleH1) {
            logger.debug("Konu uyarısı: DOM elemanları bulunamadı.");
            return;
        }

        try {
            topicWarningElement?.remove();
            topicWarningElement = null;

            if (!config.showWarning || config.paused || filteredEntryCountOnPage === 0) {
                return;
            }

            const shouldShowWarning = firstEntryAuthorFilteredOnPage || filteredEntryCountOnPage >= TOPIC_WARNING_THRESHOLD;

            if (shouldShowWarning) {
                const targetElement = currentTitleH1.querySelector('a[href^="/entry/"]') || currentTitleH1;

                topicWarningElement = document.createElement("span");
                topicWarningElement.id = `${CSS_PREFIX}title-warning`;
                topicWarningElement.className = `${CSS_PREFIX}topic-warning`;
                topicWarningElement.textContent = "[Filtre Aktif]"; // Normalized text

                let titleText = `${filteredEntryCountOnPage} entry ${config.filterMode === 'hide' ? 'gizlendi' : 'daraltıldı'}.`;
                if (firstEntryAuthorFilteredOnPage) {
                    titleText += " İlk entry de filtrelendi.";
                }
                topicWarningElement.title = titleText;

                targetElement.insertAdjacentElement('beforeend', topicWarningElement);
                logger.debug(`Konu başlığı uyarısı eklendi (${filteredEntryCountOnPage} filtrelendi, ilk: ${firstEntryAuthorFilteredOnPage}).`);
            }
        } catch (err) {
            logger.error("Konu başlığı uyarısı hatası:", err);
            topicWarningElement?.remove();
            topicWarningElement = null;
        }
    }, DEBOUNCE_DELAY_MS);

    function addProfileWarning() {
        if (config.paused || !config.showWarning) {
            logger.debug("Profil uyarısı atlandı.");
            return;
        }

        const authorElement = document.querySelector('h1#user-profile-title');
        if (!authorElement) {
            return;
        }
        logger.debug("Profil sayfası uyarısı kontrol ediliyor...");

        const authorName = authorElement.textContent?.trim();
        if (!authorName) {
            logger.warn("Profil: Yazar adı alınamadı.");
            return;
        }

        const authorLower = authorName.toLowerCase();

        if (filteredAuthorsSet.has(authorLower)) {
            logger.log(`Profildeki yazar "${authorName}" listede.`);

            if (authorElement.querySelector(`.${CSS_PREFIX}profile-warning`)) {
                logger.debug("Profil uyarısı zaten mevcut.");
                return;
            }

            try {
                const warningSpan = document.createElement('span');
                warningSpan.className = `${CSS_PREFIX}profile-warning`;
                warningSpan.textContent = "[Filtre Listesinde]"; // Normalized text
                warningSpan.title = `Yazar (${authorName}) listede, içerikleri ${config.filterMode === 'hide' ? 'gizleniyor' : 'daraltılıyor'}.`;
                authorElement.appendChild(warningSpan);
                logger.log(`Profil sayfasına "${authorName}" uyarısı eklendi.`);
            } catch (err) {
                logger.error(`Profil uyarısı eklenirken hata (${authorName}):`, err);
            }
        } else {
            logger.debug(`Profildeki yazar "${authorName}" listede değil.`);
        }
    }

    let intersectionObserver = null;
    function setupIntersectionObserver() {
        if (!entryListContainerEl) {
             logger.warn("IO: #entry-item-list bulunamadı.");
             return false;
        }

        try {
            intersectionObserver = new IntersectionObserver((entries, observer) => {
                let processedCountInBatch = 0;
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.target.nodeType === Node.ELEMENT_NODE) {
                        const targetLi = entry.target;
                        if (targetLi.matches('li[data-author]') && targetLi.dataset.eusfProcessed !== 'true') {
                             if (enhanceEntry(targetLi)) {
                                 processedCountInBatch++;
                             }
                             observer.unobserve(targetLi);
                        } else if (targetLi.dataset.eusfProcessed === 'true') {
                             observer.unobserve(targetLi);
                        }
                        else if (!targetLi.matches('li[data-author]')) {
                            observer.unobserve(targetLi);
                        }
                    }
                });

                if (processedCountInBatch > 0) {
                     debouncedUpdateTopicWarning();
                }
            }, {
                root: null,
                rootMargin: '150px 0px 150px 0px',
                threshold: 0.01
             });

            const initialEntries = entryListContainerEl.querySelectorAll(`li[data-author]:not([data-eusf-processed="true"])`);
            logger.log(`IO: ${initialEntries.length} başlangıç entry'si hedefleniyor.`);
            initialEntries.forEach(entry => {
                entry.dataset.eusfObserved = 'true';
                intersectionObserver.observe(entry)
            });

            debouncedUpdateTopicWarning();
            return true;

        } catch (err) {
            logger.error("IO kurulum hatası:", err);
            intersectionObserver = null;
            return false;
        }
    }

    let mutationObserver = null;
    function setupMutationObserver() {
        if (!entryListContainerEl || !intersectionObserver) {
             logger.warn("MO: #entry-item-list veya IO eksik.");
             return false;
        }

        try {
            mutationObserver = new MutationObserver(mutations => {
                let addedToIoCount = 0;
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                const entriesToAdd = [];
                                if (node.matches('li[data-author]')) {
                                    entriesToAdd.push(node);
                                }
                                else {
                                    entriesToAdd.push(...node.querySelectorAll('li[data-author]'));
                                }

                                entriesToAdd.forEach(entry => {
                                    if (entry.dataset.eusfProcessed !== 'true' && entry.dataset.eusfObserved !== 'true') {
                                        intersectionObserver.observe(entry);
                                        entry.dataset.eusfObserved = 'true';
                                        addedToIoCount++;
                                    }
                                });
                            }
                        });
                    }
                });
                if (addedToIoCount > 0) {
                    logger.debug(`MO: ${addedToIoCount} yeni entry IO'ya eklendi.`);
                }
            });

            mutationObserver.observe(entryListContainerEl, {
                childList: true,
                subtree: true
            });
            logger.log(`#entry-item-list izleniyor (MO aktif).`);
            return true;

        } catch (err) {
            logger.error("MO kurulum hatası:", err);
            mutationObserver = null;
            return false;
        }
    }

    async function initialize() {
        logger.log(`Script başlatılıyor... v${GM_info?.script?.version || '?'}`);
        await loadConfig();

        entryListContainerEl = document.getElementById('entry-item-list');

        const currentPath = window.location.pathname;

        if (currentPath.startsWith('/biri/')) {
            addProfileWarning();
            logger.log("Profil sayfası işlendi.");
        } else if (entryListContainerEl) {
            logger.log("Entry listesi sayfası.");
            if (!config.paused) {
                 if (setupIntersectionObserver()) {
                     setupMutationObserver();
                 }
            } else {
                logger.log("Script duraklatılmış, Observer'lar kurulmadı.");
            }
        } else {
             logger.log("Entry listesi/profil başlığı bulunamadı.");
        }

        if (!config.paused) {
            const now = Date.now();
            const timeSinceUpdate = now - (config.lastUpdate || 0);
            const needsUpdateCheck = filteredListSize === 0 || timeSinceUpdate > UPDATE_INTERVAL_MS;

            if (needsUpdateCheck) {
                logger.log(`Liste ${filteredListSize === 0 ? 'boş/ilk' : 'güncel değil'} (${Math.round(timeSinceUpdate / (60*60*1000))} saat). Senkronizasyon deneniyor...`);
                syncList(filteredListSize === 0).then(updated => {
                    if (updated) {
                        logger.log("Arka plan liste güncellemesi tamamlandı. Yeni boyut: " + filteredListSize);
                        if (currentPath.startsWith('/biri/')) {
                           addProfileWarning();
                        }
                    } else {
                        logger.log("Arka plan güncellemesi listeyi değiştirmedi/başarısız oldu.");
                    }
                }).catch(err => {
                    logger.error("Arka plan senkronizasyonunda hata:", err);
                });
            } else {
                logger.log(`Liste güncel. Son kontrol: ${config.lastUpdate ? new Date(config.lastUpdate).toLocaleString() : 'Hiç'}.`);
            }

            if (filteredAuthorsSet.size === 0 && !needsUpdateCheck && config.listRaw && config.listRaw.trim().length > 0) {
                logger.warn("Uyarı: Yerel liste var ama ayrıştırma boş!");
            } else if (filteredAuthorsSet.size === 0 && !config.listRaw) {
                logger.warn("Uyarı: Filtre listesi boş!");
            }
        } else {
            logger.log("Filtre duraklatılmış, güncelleme atlandı.");
        }

        registerMenuCommands();

        logger.log(`🎉 ${SCRIPT_NAME} ${config.paused ? 'Duraklatıldı' : 'aktif'}. Mod: ${config.filterMode}.`);
    }

    function registerMenuCommands() {
        const commandIds = [];

        const setConfigAndReload = async (key, value, msg) => {
            try {
                await GM_setValue(key, value);
                config[key] = value;
                showFeedback("Ayar Değişti", msg, { silent: true });
                logger.log(`Ayar: ${key}=${value}. Yenileniyor...`);
                location.reload();
            } catch (err) {
                logger.error(`Ayar (${key}) kaydedilemedi:`, err);
                showFeedback("Depolama Hatası", `Ayar (${key}) kaydedilemedi.\n${err.message}`, { isError: true });
            }
        };

        // Menu commands with normalized text
        commandIds.push(GM_registerMenuCommand(`${config.paused ? "▶️ Aktif Et" : "⏸️ Durdur"}`, () => {
            const newState = !config.paused;
            setConfigAndReload(KEY_PAUSED, newState, `Filtre ${newState ? 'durduruldu' : 'aktif edildi'}. Yenileniyor...`);
        }));

        commandIds.push(GM_registerMenuCommand(`Mod: ${config.filterMode === 'hide' ? 'Gizle' : 'Daralt'} (Değiştir)`, () => {
            const newMode = config.filterMode === 'hide' ? 'collapse' : 'hide';
            setConfigAndReload(KEY_MODE, newMode, `Mod "${newMode === 'hide' ? 'Gizle' : 'Daralt'}" yapıldı. Yenileniyor...`);
        }));

        commandIds.push(GM_registerMenuCommand(`Uyarılar: ${config.showWarning ? "🚫 Gizle" : "⚠️ Göster"}`, () => {
            const newState = !config.showWarning;
            setConfigAndReload(KEY_SHOW_WARNING, newState, `Uyarılar ${newState ? 'gösterilecek' : 'gizlenecek'}. Yenileniyor...`);
        }));

        commandIds.push(GM_registerMenuCommand("🔄 Listeyi Şimdi Güncelle", async () => {
            showFeedback("Güncelleme", "Liste alınıyor...", { silent: true });
            logger.log("Manuel güncelleme başlatıldı...");
            try {
                const updated = await syncList(true);
                if (updated) {
                    showFeedback("Güncelleme Başarılı", `Liste güncellendi (${filteredListSize} yazar). Yenileniyor...`);
                    location.reload();
                } else {
                     logger.warn("Manuel güncelleme: Liste değişmedi/hata.");
                     showFeedback("Güncelleme Sonucu", "Liste güncellenemedi/değişmedi. Konsolu kontrol edin.", { isError: (filteredListSize === 0 && !config.listRaw) });
                }
            } catch (err) {
                 logger.error("Manuel güncelleme hatası:", err);
                 showFeedback("Güncelleme Hatası", `Hata: ${err.message}`, { isError: true });
            }
        }));

        commandIds.push(GM_registerMenuCommand(`📊 İstatistikler`, async () => {
            const total = await GM_getValue(KEY_TOTAL_FILTERED, config.totalFiltered);
            const lastUpdateDate = config.lastUpdate ? new Date(config.lastUpdate).toLocaleString("tr-TR") : "Hiç";
            const statsText = `Toplam Filtrelenen: ${total}\n`
                            + `Liste Boyutu: ${filteredListSize}\n`
                            + `Son Güncelleme: ${lastUpdateDate}\n`
                            + `Durum: ${config.paused ? 'Duraklatıldı' : 'Aktif'}\n`
                            + `Mod: ${config.filterMode === 'hide' ? 'Gizle' : 'Daralt'}\n`
                            + `Uyarılar: ${config.showWarning ? 'Açık' : 'Kapalı'}`;
            showFeedback("Filtre İstatistikleri", statsText);
        }));


        commandIds.push(GM_registerMenuCommand(`🗑️ Ayarları ve Önbelleği Sıfırla`, async () => {
             if (confirm(`[${SCRIPT_NAME}] Emin misiniz?\n\nTüm ayarları ve yerel filtre listesi önbelleğini sıfırlayacak.\n\nSayfa yenilendikten sonra liste tekrar indirilecek.`)) {
                 logger.warn("Kullanıcı sıfırlamayı onayladı.");
                 try {
                     const keysToDelete = [
                         KEY_PAUSED, KEY_MODE, KEY_SHOW_WARNING, KEY_LIST_RAW,
                         KEY_LAST_UPDATE, KEY_TOTAL_FILTERED
                     ];
                     const results = await Promise.allSettled(keysToDelete.map(key => GM_deleteValue(key)));

                     results.forEach((result, index) => {
                         if (result.status === 'rejected') {
                             logger.error(`'${keysToDelete[index]}' silinirken hata:`, result.reason);
                         }
                     });

                     filteredAuthorsSet = new Set();
                     filteredListSize = 0;
                     config = { paused: false, filterMode: 'collapse', showWarning: true, listRaw: '', lastUpdate: 0, totalFiltered: 0 };

                     showFeedback("Sıfırlandı", "Ayarlar ve önbellek temizlendi. Yenileniyor...");
                     location.reload();
                 } catch (err) {
                      logger.error("Sıfırlama hatası:", err);
                      showFeedback("Sıfırlama Hatası", `Hata: ${err.message}`, { isError: true });
                 }
             } else {
                 logger.log("Kullanıcı sıfırlamayı iptal etti.");
                 showFeedback("İptal Edildi", "Sıfırlama iptal edildi.", { silent: true });
             }
        }));

        logger.debug(`${commandIds.length} menü komutu kaydedildi.`);
    }

    try {
         initialize().catch(err => {
            logger.error("Başlatma hatası (initialize promise):", err);
            showFeedback("Başlatma Başarısız", `Hata:\n${err.message}\nScript çalışmayabilir.`, { isError: true });
        });
    } catch (err) {
        logger.error("Başlatma senkron hatası:", err);
        showFeedback("Başlatma Hatası", `Senkron hata:\n${err.message}\nScript çalışamayabilir.`, { isError: true });
    }

})();
