# Ekşi Sözlük Troll Filtresi UserScript



| Öncesi                                | Sonrası                                  |
| ------------------------------------- | ---------------------------------------- |
| ![](https://i.imgur.com/cbTkjLj.jpeg) | ![](https://i.imgur.com/SOEj3tr.png) |


## Ne İşe Yarar?

Bu UserScript, Ekşi Sözlük'teki troll ve kalitesiz içerik kirliliğini temizlemek için tasarlanmıştır. Belirlenmiş troll/istenmeyen yazar listesindeki kişilerin entry'lerini otomatik olarak engeller (gizler veya küçültür). Ayrıca, kendi tespit ettiğiniz sorunlu yazarları manuel olarak işaretleyip filtrelemenizi sağlar. Okuma deneyiminizi gereksiz gürültüden arındırır.
## Çalışma Mekanizması

1.  **Kara Liste:** Script, engellenecek yazarları içeren güncel listeyi `raw.githubusercontent.com` adresindeki merkezi bir dosyadan çeker.
2.  **Engelleme:** Ekşi Sözlük başlıklarında gezerken, script her entry'yi kontrol eder. Yazar kara listedeyse, entry ya tamamen **yok edilir** ya da içeriği gizlenip yerine **"Engellendi - Yine de göster"** uyarısı konulur. Seçim sizin ayarlarınızdadır.
3.  **Manuel Fişleme:** Her entry altında, yazarı 'Yalama', 'Karalama', 'Kışkırtma' gibi etiketlerle **fişlemeniz** için butonlar bulunur. Bu işaretlemeler *sadece* sizin tarafınızdan görülür ve yerel olarak saklanır. Troll avı size kalmış.
4.  **Kontrol Paneli:** Filtreyi aç/kapa, engelleme modunu seç (gizle/küçült), listeyi zorla güncelle, istatistikleri gör ve kendi fişlemelerini yönetmek için tarayıcınızdaki UserScript yöneticisi (örn. ViolentMonkey) menüsünü kullanın.
## Kurulum

1.  **UserScript Yöneticisi Şart:** Tarayıcınızda bir UserScript yöneticisi eklentisi (Öneri: [Violentmonkey](https://violentmonkey.github.io/)) kurulu olmalıdır. Yoksa bu script çalışmaz.
2.  **Script'i Yükle:** Script'i Greasy Fork'tan, GitHub'dan (kaynak url ile), veya manuel olarak kodu kopyalayıp yapıştırarak (otomatik güncelleme olmaz) kullanabilirsiniz.
3. Greasy Fork: https://greasyfork.org/en/scripts/532430-anti-troll
4. GitHub kaynak url: https://raw.githubusercontent.com/bat9254/anti-troll/refs/heads/main/anti-troll.js
5.  **Kullanım:** Kurulum sonrası Ekşi Sözlük'e girdiğinizde script otomatik olarak **devreye girer** ve temizliğe başlar.
## Gizlilik

*   Script, engelleme listesini `raw.githubusercontent.com` adresindeki bir metin dosyasından alır. **Bu, dışarıyla TEK bağlantısıdır.**
*   **TÜM ayarlarınız ve kendi eklediğiniz engellenen yazarlar, SADECE VE SADECE sizin bilgisayarınızda,** UserScript yöneticisinin deposunda çevrimdışı saklanır.
*   **BU SCRİPT KESİNLİKLE HİÇBİR VERİ TOPLAMAZ/TOPLAYAMAZ, GÖNDERMEZ/GÖNDEREMEZ** Tamamen yerel çalışır.
## Katkı

Bu https://github.com/unless7146/akfiltre/ eklentsinin Firefox için (Diğer tarayıcılarda da çalışabilir test etmek gerek) userscript haline getirilip üzerine yerel ek işaretleme özelliği eklenmiş halidir. Yazılımcı arkadaşların bi el atmasını bekliyorum.
## Uyarı

Yanlış negatifler olabilir listede eksik troller olabilir lütfen bunlar için https://github.com/unless7146/stardust3903/ reposuna katkı yapın. Listeye katkı yapan herkese çok ama çok teşekkür ederim. Ayrıca https://github.com/unless7146 'a katkıları için teşekkürler.

