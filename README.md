# Ekşi Sözlük Troll Filtresi UserScript



| Öncesi                                | Sonrası                                  |
| ------------------------------------- | ---------------------------------------- |
| ![](https://i.imgur.com/cbTkjLj.jpeg) | ![](https://files.catbox.moe/0fbkng.png) |


## Ne İşe Yarar?

Bu UserScript, Ekşi Sözlük'teki troll ve kalitesiz içerik kirliliğini temizlemek için tasarlanmıştır. Belirlenmiş troll/istenmeyen yazar listesindeki kişilerin entry'lerini otomatik olarak engeller (gizler veya daraltır)

1.  **Kara Liste:** Script, engellenecek yazarları içeren güncel listeyi `raw.githubusercontent.com` adresindeki merkezi bir dosyadan çeker.
2.  **Engelleme:** Ekşi Sözlük başlıklarında gezerken, script her entry'yi kontrol eder. Yazar kara listedeyse, entry ya tamamen **yok edilir** ya da içeriği gizlenip yerine **"Engellendi - Yine de göster"** uyarısı konulur.

## Kurulum

1.  **UserScript Yöneticisi Şart:** Tarayıcınızda bir UserScript yöneticisi eklentisi (örneğin Tampermonkey, ViolentMonkey) kurulu olmalıdır.
2.  **Script'i Yükle:** Script'i Greasy Fork'tan, GitHub'dan (kaynak url ile), veya manuel olarak kodu kopyalayıp yapıştırarak (otomatik güncelleme olmaz) kullanabilirsiniz.
3. Greasy Fork: https://greasyfork.org/en/scripts/532430-anti-troll
4. GitHub kaynak url: https://raw.githubusercontent.com/bat9254/anti-troll/refs/heads/main/anti-troll.js
5.  **Kullanım:** Kurulum sonrası Ekşi Sözlük'e girdiğinizde script otomatik olarak **devreye girer** ve filtelemeye başlar.
## Gizlilik

*  Script, engelleme listesini `raw.githubusercontent.com` adresindeki bir metin dosyasından alır. **Bu, dışarıyla TEK bağlantısıdır.**
*  **BU SCRİPT KESİNLİKLE HİÇBİR VERİ TOPLAMAZ/TOPLAYAMAZ, GÖNDERMEZ/GÖNDEREMEZ** Tamamen yerel çalışır.
## Katkı


## Uyarı

Yanlış negatifler olabilir listede eksik troller olabilir lütfen bunlar için https://github.com/unless7146/stardust3903/ reposuna katkı yapın. Listeye katkı yapan herkese çok ama çok teşekkür ederim. Ayrıca https://github.com/unless7146 'a katkıları için teşekkürler.
