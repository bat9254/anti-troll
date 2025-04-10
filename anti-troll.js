// ==UserScript==
// @name         anti-troll
// @version      1.0
// @description  aktroll entry'lerini otomatik olarak gizler/daraltır, yazarları işaretlemenizi sağlar
// @match        *://eksisozluk.com/*
// @exclude      *://eksisozluk.com/biri/*
// @exclude      *://eksisozluk.com/mesaj/*
// @exclude      *://eksisozluk.com/ayarlar/*
// @exclude      *://eksisozluk.com/hesap/*
// @connect      raw.githubusercontent.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @namespace    https://greasyfork.org/
// @license      MIT
// @run-at       document-idle
// ==/UserScript==

(async () => {
    'use strict';

    // --- Sabitler ---
    const SCRIPT_NAME = "Anti-Troll Filtreleyici";
    const TROLL_LIST_URL = "https://raw.githubusercontent.com/unless7146/stardust3903/main/173732994.txt";
    const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 saat
    const NETWORK_TIMEOUT_MS = 20000; // 20 saniye
    const LOG_PREFIX = `[${SCRIPT_NAME}]`;
    const AUTHOR_MARKINGS_KEY = "authorMarkings_v2"; // Anahtar adı versiyonlandı (isteğe bağlı)
    const DEBOUNCE_DELAY_MS = 250; // Gecikme (ms)

    // --- CSS Stilleri (Net ve Sert Dil Teması) ---
    GM_addStyle(`
        /* --- Troll Engelleyici Stilleri --- */
        .anti-troll-topic-warning { background-color: #f8d7da; border: 1px solid #f5c2c7; border-left: 3px solid #dc3545; border-radius: 3px; padding: 5px 10px; margin-top: 5px; margin-left: 5px; font-size: 0.9em; color: #842029; display: inline-block; vertical-align: middle; cursor: default; box-sizing: border-box; font-weight: bold; }
        .anti-troll-collapsed {} /* Daraltılmış entry için ana sınıf (şu an boş, stil gerekirse eklenebilir) */
        .anti-troll-collapse-placeholder { min-height: 25px; background-color: rgba(128, 128, 128, 0.1); border-left: 3px solid #dc3545; padding: 6px 0 6px 12px; margin-top: 5px; border-radius: 0 4px 4px 0; font-style: normal; color: #495057; position: relative; display: flex; align-items: center; flex-wrap: wrap; }
        .anti-troll-collapse-placeholder .anti-troll-collapse-icon { margin-right: 6px; opacity: 0.9; font-style: normal; display: inline-block; }
        .anti-troll-collapse-placeholder .anti-troll-collapse-text { font-style: normal; margin-right: 10px; flex-grow: 1; display: inline-block; font-size: 0.95em; font-weight: 500; }
        .anti-troll-show-link { font-style: normal; flex-shrink: 0; }
        .anti-troll-show-link a {
            cursor: pointer; text-decoration: none; color: #dc3545; opacity: 1.0;
            transition: color 0.15s ease-in-out, text-decoration 0.15s ease-in-out, background-color 0.15s ease-in-out;
            font-size: 0.9em; margin-left: auto; padding: 2px 5px; border-radius: 3px; font-weight: bold;
        }
        .anti-troll-show-link a::before { content: "» "; opacity: 0.7; }
        .anti-troll-show-link a:hover { color: #a71d2a; text-decoration: underline; background-color: rgba(220, 53, 69, 0.1); }
        .anti-troll-hidden { display: none !important; }
        .anti-troll-opened-warning { font-size: 0.8em; color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 3px; padding: 1px 4px; margin-left: 8px; vertical-align: middle; cursor: default; display: inline-block; font-style: normal; font-weight: bold; }

        /* --- Yazar İşaretleme Buton Stilleri --- */
        li[data-author] footer:not(:hover) .author-actions-container { opacity: 0; visibility: hidden; transition: opacity 0.2s ease-in-out, visibility 0s linear 0.2s; }
        li[data-author] footer:hover .author-actions-container { opacity: 1; visibility: visible; transition: opacity 0.2s ease-in-out; }
        .author-actions-container { display: inline-block; margin-left: 8px; vertical-align: middle; font-size: 0.9em; }
        .mark-button { appearance: none; -webkit-appearance: none; background: none; border: none; font-family: inherit; cursor: pointer; background-color: #f8f9fa; border: 1px solid #dee2e6; color: #495057; border-radius: 4px; padding: 2px 7px; margin-left: 5px; font-size: 0.85em; line-height: 1.3; user-select: none; box-sizing: border-box; vertical-align: middle; font-weight: 500; text-align: center; transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, color 0.15s ease-in-out, box-shadow 0.15s ease-in-out; }
        .mark-button:hover { background-color: #e9ecef; border-color: #ced4da; color: #212529; box-shadow: 0 1px 1px rgba(0,0,0,0.05); }
        .mark-button:focus { outline: none; border-color: #86b7fe; box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25); }
        .mark-button:focus:not(:focus-visible) { box-shadow: none; border-color: #ced4da; }
        .mark-button:focus-visible { border-color: #86b7fe; box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25); }
        .mark-button:active { background-color: #dee2e6; border-color: #adb5bd; box-shadow: inset 0 2px 3px rgba(0,0,0,0.1); transform: translateY(1px); }
        .mark-button.marked-success { background-color: #d1e7dd; color: #0f5132; border-color: #badbcc; box-shadow: none; }
        .mark-button.marked-error { background-color: #f8d7da; color: #842029; border-color: #f5c2c7; box-shadow: none; }
        .mark-button:disabled { opacity: 0.65; cursor: not-allowed; box-shadow: none; background-color: #f8f9fa; border-color: #dee2e6; transform: none; }
    `);

    // --- Yardımcı Fonksiyonlar ---
    const logger = {
        log: (...args) => console.log(LOG_PREFIX, ...args),
        warn: (...args) => console.warn(LOG_PREFIX, ...args),
        error: (...args) => console.error(LOG_PREFIX, ...args),
        debug: (...args) => console.debug(LOG_PREFIX, ...args), // Debug logları için
    };

    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // --- GM API Kontrolü ---
    const requiredGmFunctions = ['GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'GM_registerMenuCommand', 'GM_addStyle'];
    const missingGmFunctions = requiredGmFunctions.filter(fn => typeof window[fn] !== 'function');
    if (missingGmFunctions.length > 0) {
        const errorMsg = `KRİTİK HATA: Gerekli Tampermonkey API fonksiyonları eksik: ${missingGmFunctions.join(', ')}! Script ÇALIŞMAYACAK. Eklentiyi (Tampermonkey/Greasemonkey vb.) ve script izinlerini KONTROL EDİN!`;
        logger.error(errorMsg);
        alert(`${SCRIPT_NAME} - KRİTİK HATA:\n${errorMsg}`);
        return; // Scripti durdur
    }

    // --- Geri Bildirim Fonksiyonu (Daha Net Başlıklar) ---
    function showFeedback(title, text, options = {}) {
        const { isError = false, silent = false } = options;
        const prefix = isError ? "HATA" : "BİLGİ";
        const finalTitle = `[${SCRIPT_NAME}] ${prefix}: ${title}`;
        if (isError) {
            logger.error(title, text);
        } else {
            logger.log(title, text);
        }
        if (!silent) {
            // Alert yerine daha modern bir bildirim sistemi düşünülebilir (örn: GM_notification),
            // ancak alert basit ve her yerde çalışır.
            alert(`${finalTitle}\n\n${text}`);
        }
    }

    // --- Yapılandırma ve Durum ---
    let config = {}; // Ayarlar (paused, trollMode, vb.)
    let trollList = []; // Troll kullanıcı adlarının listesi
    let trollSet = new Set(); // Hızlı kontrol için Set versiyonu
    let trollListSize = 0; // Mevcut liste boyutu
    let currentBlockedCount = 0; // Mevcut sayfada işlenen ve engellenen/daraltılan entry sayısı
    let topicWarningElement = null; // Başlık uyarısı DOM elementi
    let authorMarkings = {}; // Yazar işaretleme verileri (bellekte tutulacak)

    // --- Yapılandırmayı Yükle ---
    async function loadConfiguration() {
        logger.debug("Yapılandırma yükleniyor...");
        try {
            // GM_getValue ile tüm ayarları paralel olarak çek
            const [
                paused, trollMode, showTrollTopicWarning, trollListRaw,
                trollListLastUpdate, totalBlocked, loadedMarkings, storedParsedTrollList
            ] = await Promise.all([
                GM_getValue("paused", false), // Filtre duraklatılmış mı?
                GM_getValue("trollMode", "hide"), // 'hide' veya 'collapse'
                GM_getValue("showTrollTopicWarning", true), // Başlık uyarısı gösterilsin mi?
                GM_getValue("trollListRaw", ""), // Ham liste metni
                GM_getValue("trollListLastUpdate", 0), // Listenin son güncellenme zamanı
                GM_getValue("totalBlocked", 0), // Toplam engellenen entry sayısı
                GM_getValue(AUTHOR_MARKINGS_KEY, {}), // Yazar işaretlemeleri
                GM_getValue("trollListParsed", []) // Ayrıştırılmış liste (önbellek)
            ]);

            config = { paused, trollMode, showTrollTopicWarning, trollListRaw, trollListLastUpdate, totalBlocked };
            authorMarkings = loadedMarkings || {}; // Yüklenen işaretlemeleri ata

            // Troll listesini işle
            if (trollListRaw) {
                // Önbellekteki ayrıştırılmış liste, ham veriyle tutarlıysa onu kullan
                const potentialParsedList = parseTrollList(trollListRaw);
                if (storedParsedTrollList && storedParsedTrollList.length === potentialParsedList.length && storedParsedTrollList.join(',') === potentialParsedList.join(',')) {
                    trollList = storedParsedTrollList;
                    logger.debug("Önbellekten ayrıştırılmış troll listesi kullanıldı.");
                } else {
                    // Değilse, ham veriyi tekrar ayrıştır
                    trollList = potentialParsedList;
                    // Yeni ayrıştırılmış listeyi kaydet (hata olursa yakala)
                    GM_setValue("trollListParsed", trollList)
                        .catch(e => logger.error("Ayrıştırılmış troll listesi kaydedilemedi:", e));
                    logger.debug("Ham troll listesi ayrıştırıldı.");
                }
            } else {
                trollList = []; // Ham veri yoksa liste boş
                logger.debug("Kaydedilmiş ham troll listesi bulunamadı.");
            }

            trollSet = new Set(trollList); // Set oluştur
            trollListSize = trollSet.size; // Boyutu kaydet

            logger.log(`Yapılandırma yüklendi. Filtre: ${config.paused ? 'DURDURULDU' : 'AKTİF'}, Mod: ${config.trollMode}, Liste Boyutu (bellek): ${trollListSize}, İşaretleme Anahtarı: ${AUTHOR_MARKINGS_KEY}`);

        } catch (err) {
            logger.error("Yapılandırma YÜKLENEMEDİ:", err);
            // Hata durumunda güvenli varsayılanlara dön
            config = { paused: false, trollMode: 'hide', showTrollTopicWarning: true, trollListRaw: '', trollListLastUpdate: 0, totalBlocked: 0 };
            trollList = [];
            trollSet = new Set();
            trollListSize = 0;
            authorMarkings = {};
            showFeedback(
                "Yapılandırma Başarısız",
                "Ayarlar yüklenemedi! Varsayılanlar kullanılıyor. Script düzgün çalışmayabilir veya bazı veriler sıfırlanmış olabilir.",
                { isError: true }
            );
        }
    }

    // --- Çekirdek Fonksiyonlar ---

    // Troll listesini sunucudan çeker
    const fetchTrollList = () => {
        logger.log("Liste sunucudan çekiliyor...", TROLL_LIST_URL);
        return new Promise((resolve, reject) => {
            try {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: TROLL_LIST_URL,
                    timeout: NETWORK_TIMEOUT_MS,
                    responseType: 'text',
                    headers: { 'Cache-Control': 'no-cache' }, // Her zaman taze veri iste
                    onload: function(response) {
                        if (response.status >= 200 && response.status < 300 && typeof response.responseText === 'string') {
                            logger.log(`Liste başarıyla çekildi (HTTP ${response.status}). Boyut: ${response.responseText.length} bytes.`);
                            resolve(response.responseText);
                        } else {
                            logger.error(`Liste ALINAMADI: Sunucu hatası ${response.status} (${response.statusText})`, response);
                            reject(new Error(`Liste ALINAMADI: Sunucu hatası ${response.status} (${response.statusText})`));
                        }
                    },
                    onerror: function(response) {
                        logger.error(`AĞ HATASI: Liste alınamadı (${response.statusText || 'Bilinmeyen sorun'})`, response);
                        reject(new Error(`AĞ HATASI: Liste alınamadı (${response.statusText || 'Bilinmeyen sorun'})`));
                    },
                    ontimeout: function() {
                        logger.error(`ZAMAN AŞIMI (${NETWORK_TIMEOUT_MS / 1000}s)! Liste alınamadı.`);
                        reject(new Error(`ZAMAN AŞIMI (${NETWORK_TIMEOUT_MS / 1000}s)! Liste alınamadı.`));
                    }
                });
            } catch (err) {
                logger.error("GM_xmlhttpRequest BAŞLATILAMADI:", err);
                reject(new Error("Kritik: GM_xmlhttpRequest başlatılamadı. Tarayıcı eklentisiyle ilgili bir sorun olabilir."));
            }
        });
    };

    // Ham metni troll listesine ayrıştırır
    const parseTrollList = (rawText) => {
        if (!rawText || typeof rawText !== 'string') {
            logger.warn("Ayrıştırılacak troll listesi verisi yok veya geçersiz format.");
            return [];
        }
        try {
            // Satırlara böl, boşlukları temizle, boş satırları ve yorumları (# ile başlayan) filtrele
            const lines = rawText.split(/[\r\n]+/)
                                 .map(line => line.trim())
                                 .filter(line => line && !line.startsWith("#"));
            // Küçük harfe çevirerek tutarlılık sağla (isteğe bağlı ama önerilir)
            // return lines.map(line => line.toLowerCase());
            return lines; // Orijinal haliyle bırakmak istenirse
        } catch (err) {
            logger.error("Troll listesi AYRIŞTIRILAMADI:", err);
            return []; // Hata durumunda boş liste dön
        }
    };

    // Troll listesini sunucuyla senkronize eder
    const syncTrollList = async (forceUpdate = false) => {
        logger.log(`Liste güncellemesi ${forceUpdate ? 'ZORLANIYOR' : 'kontrol ediliyor'}...`);
        let newRawText;
        try {
            newRawText = await fetchTrollList();
        } catch (err) {
            logger.error("Liste ÇEKME hatası:", err.message);
            // Kullanıcıya sadece zorunlu güncelleme veya ilk yüklemede hata göster
            if (forceUpdate || trollListSize === 0) {
                 showFeedback("Liste Güncelleme Başarısız", `Liste sunucudan alınamadı.\n${err.message}\n\nMevcut liste (varsa) kullanılmaya devam edilecek.`, { isError: true });
            }
            return false; // Güncelleme başarısız
        }

        try {
            // Veri değişti mi veya güncelleme zorlandı mı?
            if (forceUpdate || config.trollListRaw !== newRawText) {
                if (!forceUpdate) logger.log("Liste içeriği değişmiş, güncelleme gerekli.");
                else logger.log("Zorunlu güncelleme tetiklendi.");

                const newList = parseTrollList(newRawText);

                // Güvenlik kontrolü: Yeni liste (parse sonrası) boşsa ama çekilen veri boş değilse,
                // parse hatası olabilir, eski listeyi koru.
                if (trollListSize > 0 && newList.length === 0 && newRawText.length > 0) {
                    logger.warn("Yeni çekilen liste verisi var ama ayrıştırma sonucu boş liste döndü! Ayrıştırma hatası olabilir. Eski liste KORUNUYOR.");
                    // Zaman damgasını yine de güncelle (kontrol yapıldığını belirtmek için)
                    config.trollListLastUpdate = Date.now();
                    try { await GM_setValue("trollListLastUpdate", config.trollListLastUpdate); }
                    catch (e) { logger.error("Son kontrol zamanı kaydedilemedi (ayrıştırma hatası sonrası):", e); }
                    return false; // Gerçek bir güncelleme olmadı
                }

                // Yeni listeyi ve state'i güncelle
                const oldSize = trollListSize;
                trollList = newList;
                trollSet = new Set(trollList);
                trollListSize = trollSet.size;
                config.trollListRaw = newRawText; // Ham veriyi de güncelle
                config.trollListLastUpdate = Date.now(); // Zaman damgasını güncelle

                logger.log(`Liste ayrıştırıldı ve güncellendi. Eski boyut: ${oldSize}, Yeni boyut: ${trollListSize}`);

                // Güncellenmiş verileri kaydetmeyi dene
                try {
                    await Promise.all([
                        GM_setValue("trollListParsed", trollList), // Ayrıştırılmış listeyi kaydet
                        GM_setValue("trollListRaw", config.trollListRaw),
                        GM_setValue("trollListLastUpdate", config.trollListLastUpdate)
                    ]);
                    logger.log("Güncellenmiş liste verileri başarıyla kaydedildi.");
                } catch (saveErr) {
                    logger.error("Güncellenmiş liste bilgileri KAYDEDİLEMEDİ:", saveErr);
                    showFeedback("Depolama Hatası", "Liste güncellendi ancak bazı veriler (ham liste, zaman damgası) KAYDEDİLEMEDİ. Script çalışmaya devam edecek ama sonraki açılışta tekrar güncelleme gerekebilir.", { isError: true });
                    // Kaydetme hatası olsa bile state güncel, devam edebiliriz
                }
                return true; // Güncelleme yapıldı

            } else { // İçerik aynı
                logger.log("Liste zaten güncel.");
                config.trollListLastUpdate = Date.now(); // Sadece kontrol zamanını güncelle
                try {
                    await GM_setValue("trollListLastUpdate", config.trollListLastUpdate);
                    logger.debug("Son kontrol zamanı güncellendi ve kaydedildi.");
                } catch (err) {
                    logger.error("Son kontrol zamanı kaydedilemedi:", err);
                }
                return false; // Güncelleme yapılmadı (zaten günceldi)
            }
        } catch (err) {
            logger.error("Liste İŞLEME hatası (Ayrıştırma/Durum Güncelleme):", err);
            showFeedback("Liste İşleme Başarısız", `Liste başarıyla alındı ancak işlenirken KRİTİK bir hata oluştu.\n${err.message}\n\nScript eski listeyle devam etmeye çalışacak (varsa).`, { isError: true });
            return false; // İşleme hatası
        }
    };

    // Entry içeriğini daraltır veya yer tutucu gösterir (Sert Dil Teması)
    function collapseContent(entry) {
        const contentElement = entry.querySelector(".content");
        if (!contentElement) {
            logger.warn("Daraltılacak içerik elementi (.content) bulunamadı, işlem atlanıyor:", entry.dataset.entryId || entry);
            return;
        }
        // Zaten daraltılmışsa tekrar işlem yapma
        if (entry.classList.contains('anti-troll-collapsed')) {
            logger.debug(`Entry ${entry.dataset.entryId || 'ID Yok'} zaten daraltılmış.`);
            return;
        }

        const author = entry.getAttribute("data-author") || "BİLİNMEYEN YAZAR";
        const originalContentDisplay = contentElement.style.display; // Orijinal display değerini sakla
        contentElement.style.display = 'none'; // İçeriği hemen gizle

        // Placeholder'ı bul veya oluştur
        let placeholder = entry.querySelector('.anti-troll-collapse-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'anti-troll-collapse-placeholder';
            placeholder.innerHTML = `
                <span class="anti-troll-collapse-icon" title="Yazar '${author}' Listede.">⛔</span>
                <span class="anti-troll-collapse-text">"${author}" engellendi (Liste). İçerik gizlendi.</span>
                <div class="anti-troll-show-link">
                    <a href="#" role="button">Yine de göster</a>
                </div>
            `;

            // Placeholder'ı içeriğin yerine ekle
            try {
                 // contentElement'in hemen sonrasına ekle
                 contentElement.parentNode.insertBefore(placeholder, contentElement.nextSibling);
            } catch (err) {
                 logger.error(`Placeholder eklenemedi! (Entry ID: ${entry.dataset.entryId || 'yok'}, Yazar: ${author})`, err, entry);
                 contentElement.style.display = originalContentDisplay || ''; // Hata olursa gizlemeyi geri al
                 return; // Placeholder eklenemezse işlemi durdur
            }

            // "Yine de göster" linkine olay dinleyici ekle
            const showLink = placeholder.querySelector('.anti-troll-show-link a');
            if (showLink) {
                showLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Diğer tıklama olaylarını engelle

                    if (contentElement) {
                        contentElement.style.display = originalContentDisplay || ''; // Orijinal durumu geri yükle
                    } else {
                        logger.warn("Geri yüklenecek '.content' elementi bulunamadı!", entry.dataset.entryId);
                    }

                    // Placeholder'ı kaldır
                    placeholder.remove();
                    entry.classList.remove('anti-troll-collapsed'); // Daraltma sınıfını kaldır

                    // Açıldığına dair uyarı ekle
                    const footer = entry.querySelector('footer');
                    if (footer && !footer.querySelector('.anti-troll-opened-warning')) {
                        const warningSpan = document.createElement('span');
                        warningSpan.className = 'anti-troll-opened-warning';
                        warningSpan.textContent = '⚠️ Engellendi';
                        warningSpan.title = `Bu içerik Liste nedeniyle gizlenmişti, tarafınızca ZORLA açıldı.`;
                        footer.appendChild(warningSpan);
                    } else if (!footer) {
                        logger.warn("Footer bulunamadı, 'zorla açıldı' uyarısı eklenemedi:", entry.dataset.entryId);
                    }
                }, { once: true }); // Sadece bir kere çalışsın
            } else {
                 logger.error("Placeholder içindeki 'Yine de göster' linki bulunamadı!", placeholder);
            }
        } else {
            // Mevcut placeholder varsa görünür yap (nadiren gerekli olmalı)
            placeholder.style.display = '';
        }

        entry.classList.add('anti-troll-collapsed'); // Entry'yi daraltılmış olarak işaretle
        logger.debug(`Entry daraltıldı: ${entry.dataset.entryId || 'ID Yok'} (Yazar: ${author})`);
    }

    // Yazar işaretlemesini kaydeder
    const recordMarking = async (author, category, buttonElement) => {
        if (!author || !category) {
            logger.error("İŞARETLEME BAŞARISIZ: Yazar veya kategori bilgisi EKSİK.");
            if (buttonElement) flashButtonState(buttonElement, 'marked-error', "HATA!");
            return;
        }
        logger.log(`Yazar '${author}' Kategori '${category}' olarak işaretleniyor...`);

        // Bellekteki state'i güncelle
        authorMarkings[category] = authorMarkings[category] || {};
        authorMarkings[category][author] = (authorMarkings[category][author] || 0) + 1;

        // Değişikliği GM deposuna kaydetmeyi dene
        try {
            await GM_setValue(AUTHOR_MARKINGS_KEY, authorMarkings);
            logger.log(`Yazar '${author}' Kategori '${category}' olarak İŞARETLENDİ ve kaydedildi.`);
            if (buttonElement) flashButtonState(buttonElement, 'marked-success', "✓"); // Başarı işareti

        } catch (err) {
            logger.error(`İŞARETLEME KAYDI BAŞARISIZ (GM_setValue hatası - Yazar: ${author}, Kategori: ${category}):`, err);
            // Hatayı kullanıcıya bildir
            showFeedback(
                "Depolama Hatası",
                `"${author}" için işaretleme KAYDEDİLEMEDİ.\n${err.message}\n\nİşaretleme bellekte yapıldı ancak kalıcı olarak kaydedilemedi. Sayfa yenilenince kaybolabilir.`,
                { isError: true }
            );
            // Buton durumu hata olarak ayarla
            if (buttonElement) flashButtonState(buttonElement, 'marked-error', "HATA!");

            // Başarısız kaydetme sonrası bellekteki değişikliği geri almak isteyebiliriz,
            // ancak bu kullanıcı için kafa karıştırıcı olabilir. Şimdilik bellekte bırakalım.
            // authorMarkings[category][author] = (authorMarkings[category][author] || 1) - 1; // Geri alma (opsiyonel)
            // if (authorMarkings[category][author] <= 0) delete authorMarkings[category][author];
        }
    };

    // Buton durumunu geçici olarak değiştirir (örn: başarı/hata)
    const flashButtonState = (button, className, tempText = null) => {
        if (!button) return;
        const originalText = button.textContent;
        button.classList.add(className);
        button.disabled = true; // İşlem sırasında tekrar tıklanmasın
        if (tempText) button.textContent = tempText;

        setTimeout(() => {
            button.classList.remove(className);
            button.disabled = false;
            if (tempText) button.textContent = originalText; // Orijinal metni geri yükle
        }, 1200); // 1.2 saniye görünür kalsın
    };

    // Yazar işaretleme butonlarını oluşturur (Sert Dil Teması)
    const createMarkButtons = (author) => {
        const container = document.createElement('span');
        container.className = 'author-actions-container';
        const categories = [
            { id: 'sycophancy',  label: 'Yalama',   title: 'YALAMA olarak damgala' }, // Büyük harf vurgu
            { id: 'slander',     label: 'Karalama', title: 'KARALAMA olarak damgala' },
            { id: 'provocation', label: 'Kışkırtma', title: 'KIŞKIRTMA olarak damgala' }
        ];

        categories.forEach(cat => {
            const button = document.createElement('button');
            button.className = 'mark-button';
            button.textContent = cat.label;
            button.title = `Yazar: ${author} - ${cat.title}`; // Net açıklama
            button.dataset.author = author;
            button.dataset.category = cat.id;
            button.setAttribute('role', 'button');
            button.addEventListener('click', (e) => {
                e.preventDefault(); // Link davranışını engelle (gerekirse)
                e.stopPropagation(); // Footer'daki diğer olayları engelle
                recordMarking(author, cat.id, button);
            });
            container.appendChild(button);
        });
        return container;
    };

    // Tek bir entry'yi işler: işaretleme butonu ekler ve filtre uygular
    function enhanceEntry(entry) {
        // Geçersiz veya zaten işlenmiş entry'leri atla
        if (!entry || entry.nodeType !== Node.ELEMENT_NODE || !entry.matches('li[data-author]')) return;
        if (entry.dataset.antiTrollEnhanced === 'true') return; // Zaten işlenmiş

        const author = entry.getAttribute("data-author");
        const entryId = entry.getAttribute("data-id") || entry.getAttribute("data-entry-id") || 'ID Yok'; // Entry ID'sini al

        // Yazar bilgisi yoksa, işaretle ve çık (hata durumu değil)
        if (!author) {
            logger.warn(`Entry'de (ID: ${entryId}) 'data-author' özniteliği YOK, işlenemiyor.`);
            entry.dataset.antiTrollEnhanced = 'true'; // Yine de işlenmiş say
            return;
        }

        // --- İşaretleme Butonlarını Ekle ---
        const footer = entry.querySelector('footer');
        if (footer) {
            // Eğer butonlar zaten eklenmemişse ekle
            if (!footer.querySelector('.author-actions-container')) {
                try {
                    const buttonsContainer = createMarkButtons(author);
                    footer.appendChild(buttonsContainer);
                } catch (err) {
                    logger.error(`Yazar '${author}' için işaretleme butonları EKLENEMEDİ (Entry ID: ${entryId}):`, err);
                    // Buton eklenemese bile filtrelemeye devam et
                }
            }
        } else {
            logger.debug(`Entry (ID: ${entryId}, Yazar: ${author}) için footer bulunamadı, işaretleme butonları eklenemiyor.`);
        }

        // --- Troll Filtresini Uygula ---
        let actionTaken = 'none'; // Başlangıçta bir işlem yapılmadı
        try {
            // Filtre aktifse ve yazar troll listesindeyse
            if (!config.paused && trollSet.has(author)) {
                currentBlockedCount++; // Bu sayfada engellenen sayısını artır
                if (config.trollMode === "hide") {
                    entry.classList.add('anti-troll-hidden'); // Tamamen gizle
                    actionTaken = 'hide';
                    logger.debug(`Entry gizlendi: ${entryId} (Yazar: ${author})`);
                } else { // 'collapse' modu
                    collapseContent(entry); // Daraltma fonksiyonunu çağır
                    // collapseContent başarılı olursa 'anti-troll-collapsed' sınıfını ekler
                    if (entry.classList.contains('anti-troll-collapsed')) {
                        actionTaken = 'collapse';
                    } else {
                        // collapseContent başarısız olursa (örn. .content yoksa)
                        actionTaken = 'collapse_failed';
                        logger.warn(`Entry ${entryId} (Yazar: ${author}) için daraltma işlemi BAŞARISIZ OLDU (collapseContent iç hatası?).`);
                    }
                }
            } else if (config.paused) {
                 actionTaken = 'paused'; // Filtre duraklatıldığı için işlem yapılmadı
            } else if (!trollSet.has(author)) {
                 actionTaken = 'not_in_list'; // Yazar listede olmadığı için işlem yapılmadı
            }
        } catch (err) {
            logger.error(`Entry ${entryId} İŞLENEMEDİ (Filtreleme/Daraltma Hatası - Yazar: ${author}):`, err);
            actionTaken = 'error'; // İşlem sırasında hata oluştu
        }

        // Entry'nin durumunu ve işlendiğini işaretle
        entry.dataset.antiTrollTrollAction = actionTaken;
        entry.dataset.antiTrollEnhanced = 'true';
    }

    // Konu başlığına troll uyarısı ekler/günceller (Sert Dil Teması)
    const updateTopicWarning = () => {
        try {
            // Mevcut uyarıyı kaldır
            if (topicWarningElement && topicWarningElement.parentNode) {
                topicWarningElement.remove();
                topicWarningElement = null;
            }

            // Uyarıyı gösterme koşulları
            if (!config.showTrollTopicWarning || config.paused) return; // Ayar kapalıysa veya filtre duraklatılmışsa gösterme
            const entryList = document.querySelector("#entry-item-list"); if (!entryList) return; // Entry listesi yoksa çık
            const isFirstPage = !window.location.search.includes('p=') || window.location.search.includes('p=1'); if (!isFirstPage) return; // Sadece ilk sayfada göster

            const firstEntry = entryList.querySelector("li[data-author]"); if (!firstEntry) return; // İlk entry yoksa çık
            const firstAuthor = firstEntry.getAttribute("data-author"); if (!firstAuthor) return; // İlk yazar yoksa çık

            // Bu sayfada işlenmiş ve engellenmiş/daraltılmış trolleri say
            // (enhanceEntry tarafından eklenen öznitelikleri kullan)
            const processedTrollsOnPage = entryList.querySelectorAll("li[data-author][data-anti-troll-troll-action='hide'], li[data-author][data-anti-troll-troll-action='collapse']").length;
            const isFirstAuthorTroll = trollSet.has(firstAuthor);

            // Uyarıyı göster: İlk yazar troll ise VEYA sayfada en az 3 troll engellenmişse
            const showWarning = isFirstAuthorTroll || processedTrollsOnPage >= 3;

            if (showWarning) {
                const subTitleMenu = document.querySelector(".sub-title-menu");
                if (!subTitleMenu) {
                    logger.warn("Başlık menüsü (.sub-title-menu) BULUNAMADI, konu uyarısı EKLENEMİYOR.");
                    return;
                }

                topicWarningElement = document.createElement("div");
                topicWarningElement.className = "anti-troll-topic-warning";
                topicWarningElement.textContent = "⚠️ TROLL BAŞLIK UYARISI"; // Sert uyarı metni

                // Uyarı nedenini (title) oluştur
                let titleText = "NEDEN: ";
                const otherTrollsCount = processedTrollsOnPage - (isFirstAuthorTroll ? 1 : 0); // İlk yazar dışındaki troller

                if (isFirstAuthorTroll && otherTrollsCount <= 0) {
                    titleText += `Başlığı açan "${firstAuthor}" Listede.`;
                } else if (isFirstAuthorTroll && otherTrollsCount > 0) {
                    titleText += `Başlığı açan "${firstAuthor}" VE sayfadaki ${otherTrollsCount} diğer yazar Listede.`;
                } else { // İlk yazar troll değil ama sayfada >= 3 troll var
                    titleText += `Sayfadaki ${processedTrollsOnPage} yazar Listede.`;
                }
                topicWarningElement.title = titleText;

                subTitleMenu.appendChild(topicWarningElement);
                logger.log("Troll başlık uyarısı eklendi.", titleText);
            } else {
                 logger.debug("Troll başlık uyarısı için koşullar sağlanmadı.");
            }
        } catch (err) {
            logger.error("Konu başlığı uyarısı güncellenirken HATA:", err);
            // Hata durumunda kalıntı uyarıyı temizle
            if (topicWarningElement && topicWarningElement.parentNode) {
                topicWarningElement.remove();
                topicWarningElement = null;
            }
        }
    };

    // Görünürdeki (henüz işlenmemiş) entry'leri işler (debounce ile)
    const processVisibleEntries = debounce(() => {
        logger.debug("Görünürdeki entry'ler işleniyor...");
        currentBlockedCount = 0; // Bu parti için engellenen sayısını sıfırla
        const selector = '#entry-item-list > li[data-author]:not([data-anti-troll-enhanced="true"])'; // Henüz işlenmemiş ve yazarı olan entry'ler
        let entriesToProcess;
        try {
            entriesToProcess = document.querySelectorAll(selector);
        } catch (err) {
            logger.error("İşlenecek entry'ler seçilirken DOM hatası:", err);
            return; // Seçim başarısızsa devam etme
        }

        if (entriesToProcess.length > 0) {
            logger.log(`${entriesToProcess.length} yeni entry işlenecek.`);
            entriesToProcess.forEach(entry => {
                try {
                    enhanceEntry(entry); // Her bir entry'yi işle
                } catch (err) {
                    // enhanceEntry içindeki hatalar normalde yakalanır, bu beklenmedik durumlar için
                    const entryId = entry ? (entry.dataset.id || entry.dataset.entryId || 'bilinmeyen') : 'bilinmeyen';
                    const author = entry ? entry.dataset.author : 'bilinmeyen';
                    logger.error(`Entry ${entryId} (Yazar: ${author}) işlenirken BEKLENMEDİK HATA (processVisibleEntries döngüsü):`, err);
                    // Hatalı entry'yi tekrar işlememek için işaretle
                    if (entry && entry.dataset) {
                        entry.dataset.antiTrollEnhanced = 'true'; // İşlenmiş say
                        entry.dataset.antiTrollTrollAction = 'processing_error'; // Hata durumu
                    }
                }
            });

            // Toplu işlem sonrası başlık uyarısını güncelle
            updateTopicWarning();

            // Toplam engellenen sayısını güncelle (eğer bu partide engelleme olduysa)
            if (currentBlockedCount > 0) {
                const previousTotal = config.totalBlocked || 0;
                config.totalBlocked = previousTotal + currentBlockedCount;
                logger.log(`Bu sayfada ${currentBlockedCount} entry engellendi/daraltıldı. Toplam: ${config.totalBlocked}`);
                // Kaydetmeyi dene (arka planda, hatayı yakala)
                GM_setValue("totalBlocked", config.totalBlocked)
                  .catch(err => logger.error("Toplam engellenen sayısı KAYDEDİLEMEDİ:", err));
            }
        } else {
             logger.debug("İşlenecek yeni entry bulunamadı.");
        }
    }, DEBOUNCE_DELAY_MS);

    // --- Başlatma ve Yürütme ---
    async function initialize() {
        logger.log("Script BAŞLATILIYOR...");
        await loadConfiguration(); // Önce ayarları yükle

        // Filtre duraklatılmamışsa ve liste boşsa veya güncelleme zamanı gelmişse, başlangıçta senkronize et
        if (!config.paused) {
            const now = Date.now();
            const timeSinceLastUpdate = now - (config.trollListLastUpdate || 0);
            const needsUpdate = timeSinceLastUpdate > UPDATE_INTERVAL_MS;

            if (trollListSize === 0 || needsUpdate) {
                logger.log(`Başlangıç kontrolü: Liste ${trollListSize === 0 ? 'boş' : 'güncelleme zamanı geldi'}. Senkronizasyon denenecek... (Son güncelleme: ${config.trollListLastUpdate ? new Date(config.trollListLastUpdate).toLocaleString() : 'Hiç'})`);
                // Senkronizasyonu arka planda başlat, UI bloklamasın
                // İlk yükleme sonrası sayfayı yenilemeye gerek yok, processVisibleEntries halleder.
                syncTrollList().then(updated => {
                    if (updated) {
                        logger.log("Başlangıçtaki arka plan liste güncellemesi TAMAMLANDI. Yeni liste boyutu: " + trollListSize);
                        // Liste güncellendiyse, DOM'u tekrar işlemek gerekebilir.
                        // processVisibleEntries zaten MutationObserver tarafından tetiklenecek,
                        // ama garanti olsun diye burada da çağırabiliriz.
                        // Ancak bu, çift işlemeye yol açabilir. Şimdilik observer'a güvenelim.
                        // processVisibleEntries(); // Gerekirse aktif edilebilir
                    } else {
                         logger.log("Başlangıçtaki arka plan liste kontrolü tamamlandı (güncelleme yapılmadı veya hata oluştu).");
                    }
                }).catch(err => {
                    // syncTrollList içindeki hatalar zaten loglanıyor ve bazen alert veriyor.
                    logger.error("Başlangıç senkronizasyonu sırasında beklenmedik hata:", err);
                });
            } else {
                logger.log("Liste güncel görünüyor, başlangıçta senkronizasyon atlanıyor.");
            }

            // Liste boşsa veya yüklenemediyse bir uyarı ver
            if (trollSet.size === 0 && config.trollListRaw) {
                 logger.warn("UYARI: Liste verisi var ama ayrıştırılmış liste boş. Parse hatası olabilir!");
            } else if (trollSet.size === 0) {
                 logger.warn("UYARI: Troll listesi boş veya yüklenemedi. Filtreleme yapılamayacak!");
            }
        } else {
            logger.log("Filtre DURDURULMUŞ olarak başlatıldı. Liste güncellenmeyecek ve filtreleme yapılmayacak.");
        }

        logger.log(`Entry işleme motoru başlatılıyor. Mod: ${config.paused ? 'DURDURULMUŞ' : config.trollMode}.`);

        // Başlangıçta görünür olan entry'leri işle
        try {
            processVisibleEntries();
        } catch (err) {
            logger.error("İlk entry işleme sırasında KRİTİK HATA:", err);
            showFeedback("Başlatma Hatası", "Sayfadaki mevcut entry'ler işlenirken bir hata oluştu. Script düzgün çalışmayabilir.", { isError: true });
        }

        // Dinamik olarak eklenen entry'leri izlemek için MutationObserver ayarla
        const entryListContainer = document.querySelector('#entry-item-list');
        if (entryListContainer) {
            try {
                const observer = new MutationObserver(mutations => {
                    // Sadece eklenen node'ları kontrol et
                    let needsProcessing = false;
                    for (const mutation of mutations) {
                        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                            for (const node of mutation.addedNodes) {
                                // Eklenen node bir element mi?
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    // Eklenen node'un kendisi veya bir alt elemanı işlenmesi gereken bir entry mi?
                                    if ( (node.matches && node.matches('li[data-author]:not([data-anti-troll-enhanced="true"])')) ||
                                         (node.querySelector && node.querySelector('li[data-author]:not([data-anti-troll-enhanced="true"])')) )
                                    {
                                        needsProcessing = true;
                                        break; // İşlenecek bir tane bulundu, bu mutation kaydını daha fazla kontrol etmeye gerek yok
                                    }
                                }
                            }
                        }
                        if (needsProcessing) break; // İşlenecek bulundu, diğer mutation kayıtlarına bakmaya gerek yok
                    }

                    // Eğer işlenmesi gereken node eklendiyse, debounced fonksiyonu tetikle
                    if (needsProcessing) {
                        logger.debug("MutationObserver: İşlenmesi gereken yeni entry(ler) tespit edildi.");
                        processVisibleEntries();
                    }
                });

                observer.observe(entryListContainer, {
                    childList: true, // Doğrudan alt eleman ekleme/çıkarma
                    subtree: true    // Alt ağaçtaki değişiklikler (örn: entry içeriğinin yüklenmesi)
                });
                logger.log("Entry listesi (#entry-item-list) dinamik değişiklikler için İZLENİYOR.");

            } catch (err) {
                logger.error("MutationObserver BAŞLATILAMADI:", err);
                showFeedback("Kritik Hata", "Sayfa değişiklikleri İZLENEMİYOR! Sonsuz kaydırma veya dinamik olarak yüklenen yeni entry'ler otomatik olarak işlenmeyecek.", { isError: true });
            }
        } else {
            logger.warn("Entry listesi konteyneri (#entry-item-list) BULUNAMADI! Dinamik olarak yüklenen entry'ler (örn: sonsuz kaydırma) işlenemeyecek.");
        }

        // Menü komutlarını kaydet
        try {
            registerMenuCommands(); // Menüyü oluştur/güncelle
            logger.log("Menü komutları başarıyla kaydedildi/güncellendi.");
        } catch (err) {
            logger.error("Menü komutları YÜKLENEMEDİ:", err);
            showFeedback("Hata", "Script ayar menüsü OLUŞTURULAMADI.", { isError: true });
        }
    }

    // --- Yapılandırma Menüsü (Sert Dil Teması) ---
    function registerMenuCommands() {
        // Mevcut komutları temizle (eğer varsa, Tampermonkey bunu otomatik yapabilir ama garanti olsun)
        // Not: GM_registerMenuCommand tekrar çağrıldığında üzerine yazar, temizlemeye gerek yok.

        // Ayar değiştirme yardımcısı
        const handleSettingChange = async (key, value, successMsg, reload = false) => {
            try {
                await GM_setValue(key, value);
                logger.log(`Ayar değiştirildi: ${key} = ${value}`);
                showFeedback("Ayar Değiştirildi", successMsg, { silent: reload }); // Yenileme varsa alert gösterme
                if (reload) {
                    logger.log("Sayfa yenileniyor...");
                    // Kısa bir gecikme ekleyerek alert'in (varsa) kapanmasına izin ver
                    setTimeout(() => location.reload(), reload ? 500 : 0);
                } else {
                     // Ayar değiştiğinde menüyü hemen güncelle
                     registerMenuCommands();
                }
            } catch (err) {
                logger.error(`Ayar KAYDEDİLEMEDİ (Anahtar: ${key}):`, err);
                showFeedback("Depolama Hatası", `Ayar (${key}) KAYDEDİLEMEDİ.\n${err.message}`, { isError: true });
                // Başarısız olsa bile menüyü eski haliyle tekrar çizmek için çağırabiliriz
                 registerMenuCommands();
            }
        };

        // --- Filtreleme Komutları ---
        GM_registerMenuCommand(`${config.paused ? "▶️ Filtreyi AKTİF ET" : "⏸️ Filtreyi DURDUR"}`, async () => {
            config.paused = !config.paused; // Durumu tersine çevir
            await handleSettingChange("paused", config.paused, `Troll Filtresi ${config.paused ? 'DURDURULDU' : 'AKTİF EDİLDİ'}. Sayfa YENİLENECEK!`, true);
        });

        GM_registerMenuCommand(`Mod: ${config.trollMode === 'hide' ? 'GİZLE' : 'DARALT'} (Değiştir)`, async () => {
            config.trollMode = config.trollMode === 'hide' ? 'collapse' : 'hide'; // Modu değiştir
            const modeText = config.trollMode === 'hide' ? 'TAMAMEN GİZLE' : 'DARALT';
            await handleSettingChange("trollMode", config.trollMode, `Filtre Modu: "${modeText}" olarak ayarlandı. Sayfa YENİLENECEK!`, true);
        });

        GM_registerMenuCommand(`Başlık Uyarısını ${config.showTrollTopicWarning ? "🚫 GİZLE" : "⚠️ GÖSTER"}`, async () => {
            config.showTrollTopicWarning = !config.showTrollTopicWarning; // Durumu tersine çevir
            await handleSettingChange("showTrollTopicWarning", config.showTrollTopicWarning, `Troll Başlık Uyarısı ${config.showTrollTopicWarning ? 'GÖSTERİLECEK' : 'GİZLENECEK'}. Sayfa YENİLENECEK!`, true);
        });

        GM_registerMenuCommand("🔄 Listeyi ŞİMDİ Güncelle", async () => {
            showFeedback("Liste Güncelleme", "Liste sunucudan çekiliyor ve güncelleniyor...", { silent: true }); // Anında geri bildirim (sessiz)
            logger.log("Manuel liste güncellemesi başlatıldı...");
            const updated = await syncTrollList(true); // Güncellemeyi zorla

            if (updated) {
                // Başarılı güncelleme sonrası yeni boyutu almayı dene
                 try {
                    // Güncellenmiş veriyi direkt GM'den okumak yerine state'i kullanabiliriz
                    // const latestSize = (await GM_getValue("trollListParsed", [])).length;
                    const latestSize = trollListSize; // syncTrollList state'i zaten güncelledi
                    showFeedback("Liste Güncelleme Başarılı", `Liste başarıyla güncellendi. Yeni liste boyutu: ${latestSize}. Değişikliklerin etkili olması için sayfa YENİLENECEK!`);
                    location.reload();
                 } catch (err) {
                     logger.error("Güncelleme sonrası boyut kontrolü hatası:", err);
                     showFeedback("Liste Güncelleme Başarılı", `Liste güncellendi (boyut kontrol edilemedi). Sayfa YENİLENECEK!`);
                     location.reload();
                 }
            } else {
                 // syncTrollList false döndü: ya hata oldu ya da zaten günceldi.
                 // syncTrollList içinde hata mesajları zaten gösterilmiş olmalı.
                 // Zaten güncel olma durumunu kontrol edelim.
                 try {
                     // Son çekilen ham veri ile mevcut ham veriyi karşılaştır (bellekteki)
                     // Alternatif: Tekrar fetch etmek yerine, son güncelleme zamanına bakılabilir.
                     // Eğer son güncelleme çok yeniyse, muhtemelen zaten günceldi.
                     const timeSinceLastUpdate = Date.now() - (config.trollListLastUpdate || 0);
                     if (timeSinceLastUpdate < 60000) { // Son 1 dakika içinde güncellendiyse
                         showFeedback("Liste Güncelleme", "Liste ZATEN GÜNCEL görünüyor (kısa süre önce kontrol edildi/güncellendi).", { silent: false });
                     } else {
                        // Hata mesajı syncTrollList tarafından verildi, burada ek bir şeye gerek yok.
                        // Veya belirsiz bir durum varsa genel bir mesaj verilebilir:
                         showFeedback("Liste Güncelleme", "Liste güncellenemedi veya zaten günceldi. Detaylar için konsolu kontrol edin.", { silent: false });
                     }
                 } catch (err) {
                      logger.error("Güncellik durumu kontrol edilirken hata:", err);
                 }
            }
            // Menüyü yeniden kaydetmeye gerek yok, sayfa yenilenecek veya zaten güncel.
            // registerMenuCommands();
        });

        GM_registerMenuCommand(`📊 Engelleme İstatistikleri`, async () => {
            try {
                // Güncel toplam engellenen sayısını GM'den tekrar oku (başka sekmelerde değişmiş olabilir)
                const latestTotalBlocked = await GM_getValue("totalBlocked", config.totalBlocked); // Bellekteki ile başla
                const lastUpdateTimestamp = config.trollListLastUpdate;
                const formattedDate = lastUpdateTimestamp
                    ? new Date(lastUpdateTimestamp).toLocaleString("tr-TR", { dateStyle: 'short', timeStyle: 'medium' })
                    : "HENÜZ GÜNCELLENMEDİ";
                const currentListSize = trollListSize; // Bellekteki güncel boyut
                const statsText = `Toplam Engellenen/Daraltılan Entry: ${latestTotalBlocked}\nMevcut Liste Boyutu: ${currentListSize}\nListe Son Kontrol/Güncelleme: ${formattedDate}`;
                showFeedback("Troll Filtresi Raporu", statsText);
            } catch (err) {
                logger.error("Engelleme İstatistikleri okunurken HATA:", err);
                showFeedback("Rapor Hatası", "Engelleme İstatistikleri okunurken depolama hatası!", { isError: true });
            }
        });

        // --- İşaretleme Komutları ---
        GM_registerMenuCommand(`📊 Yazar İşaretleme Raporu`, async () => {
            try {
                // Güncel işaretlemeleri GM'den tekrar oku
                const currentMarkings = await GM_getValue(AUTHOR_MARKINGS_KEY, {});
                authorMarkings = currentMarkings; // Bellekteki state'i de güncelle

                let output = `--- Yazar İşaretleme Raporu (${SCRIPT_NAME}) ---\nVeri Anahtarı: ${AUTHOR_MARKINGS_KEY}\n\n`;
                const categoryLabels = { sycophancy: 'YALAMA', slander: 'KARALAMA', provocation: 'KIŞKIRTMA' }; // Büyük harf etiketler
                const knownCategories = Object.keys(categoryLabels);
                let totalMarks = 0;
                let totalMarkedAuthors = new Set();
                let unknownCategoriesFound = [];

                // Bilinen kategorileri işle
                knownCategories.forEach(catId => {
                    const categoryName = categoryLabels[catId];
                    output += `=== KATEGORİ: ${categoryName} ===\n`;
                    const authorsInCategory = authorMarkings[catId];
                    if (authorsInCategory && Object.keys(authorsInCategory).length > 0) {
                        const sortedAuthors = Object.entries(authorsInCategory)
                                                  .sort(([, countA], [, countB]) => countB - countA); // Sayıya göre çoktan aza sırala
                        sortedAuthors.forEach(([author, count]) => {
                            output += `  - ${author}: ${count} kez\n`;
                            totalMarks += count;
                            totalMarkedAuthors.add(author);
                        });
                    } else {
                        output += `  (Bu kategoride işaretlenmiş yazar YOK)\n`;
                    }
                    output += '\n';
                });

                // Bilinmeyen (eski veya hatalı) kategorileri kontrol et
                Object.keys(authorMarkings).forEach(catId => {
                    if (!knownCategories.includes(catId)) {
                        const count = Object.keys(authorMarkings[catId] || {}).length;
                        if (count > 0) {
                             unknownCategoriesFound.push(`'${catId}' (${count} yazar)`);
                        }
                    }
                });

                if (unknownCategoriesFound.length > 0) {
                     output += `UYARI: Raporda gösterilmeyen eski/bilinmeyen kategorilerde veri bulundu: ${unknownCategoriesFound.join(', ')}. Bu veriler aşağıdaki toplamlara dahil DEĞİLDİR. Silmek için 'TÜM Verileri SİL' seçeneğini kullanabilirsiniz.\n\n`;
                }

                 output += `--------------------\n`;
                 output += `Toplam İşaretleme Sayısı (bilinen kategoriler): ${totalMarks}\n`;
                 output += `Toplam İşaretlenen Farklı Yazar Sayısı: ${totalMarkedAuthors.size}\n`;

                if (totalMarks === 0 && totalMarkedAuthors.size === 0 && unknownCategoriesFound.length === 0) {
                    output = `--- Yazar İşaretleme Raporu (${SCRIPT_NAME}) ---\n\n(HENÜZ HİÇBİR YAZAR İŞARETLENMEMİŞ)`;
                }

                showFeedback("Yazar İşaretleme Raporu", output);
            } catch (err) {
                logger.error("İşaretleme raporu okunurken veya oluşturulurken HATA:", err);
                showFeedback("Rapor Hatası", "İşaretleme raporu okunurken/oluşturulurken bir hata oluştu!", { isError: true });
            }
        });

        GM_registerMenuCommand(`🗑️ TÜM İşaretleme Verilerini SİL (DİKKAT!)`, async () => {
            const confirmation = confirm(
                `[${SCRIPT_NAME}] - KESİN EMİN MİSİNİZ?\n\n` +
                `'${AUTHOR_MARKINGS_KEY}' anahtarındaki TÜM yazar işaretleme verileri (Yalama, Karalama, Kışkırtma ve varsa diğer tüm eski/bilinmeyen kategoriler) ` +
                `KALICI OLARAK SİLİNECEKTİR!\n\n` +
                `BU İŞLEM GERİ ALINAMAZ!`
            );

            if (confirmation) {
                logger.warn(`Kullanıcı '${AUTHOR_MARKINGS_KEY}' anahtarındaki TÜM işaretleme verilerini silmeyi onayladı.`);
                try {
                    await GM_setValue(AUTHOR_MARKINGS_KEY, {}); // Veriyi boş bir obje ile değiştir
                    authorMarkings = {}; // Bellekteki state'i de sıfırla
                    logger.log("TÜM yazar işaretleme verileri başarıyla silindi.");
                    showFeedback("İşlem Başarılı", "TÜM yazar işaretleme verileri başarıyla SİLİNDİ.");
                } catch (err) {
                    logger.error("İşaretleme verileri SİLİNİRKEN HATA (GM_setValue):", err);
                    showFeedback("Silme Başarısız", `İşaretlemeler temizlenirken KRİTİK HATA oluştu: ${err.message}`, { isError: true });
                } finally {
                     // Başarılı veya başarısız, menüyü güncelle (örn. rapor artık boş görünecek)
                     registerMenuCommands();
                }
            } else {
                logger.log("Kullanıcı işaretleme verilerini silme işlemini iptal etti.");
                showFeedback("İşlem İptal Edildi", "İşaretleme verileri SİLİNMEDİ.", { silent: true }); // Sessiz geri bildirim
            }
        });
    }

    // --- Scripti Başlat ---
    try {
        await initialize();
        logger.log(`🎉 ${SCRIPT_NAME} başarıyla YÜKLENDİ ve çalışıyor. v${GM_info.script.version}`);
    } catch (err) {
        // Initialize içindeki hatalar zaten loglanıyor ve alert veriyor olabilir.
        // Bu, initialize'ın kendisindeki beklenmedik hatalar için son bir güvenlik ağı.
        logger.error("Userscript başlatılırken YAKALANAMAYAN KRİTİK HATA:", err);
        alert(`[${SCRIPT_NAME}] BAŞLATMA BAŞARISIZ OLDU!\n\nBeklenmedik bir hata oluştu: ${err.message}\n\nScript işlevini yerine getiremeyebilir. Tarayıcı konsolunu (F12) kontrol edin!`);
    }

})();
// --- DOSYA SONU anti-troll.user.js ---