# IMPLEMENTATION_NOTES

Bu belgede **Namaz Vakti Gnome** eklentisinin teknik mimarisi, geliştirme aşamasındaki kararlar ve test detayları özetlenmektedir.

## Tespit Edilen Sistem Detayları
*   **GNOME Shell Sürümü:** 50.3
*   **GJS Sürümü:** 1.88.1
*   **Oturum Tipi:** Wayland

## Kullanılan API ve Mimari Yaklaşım
*   **ES Modules (ESM):** GNOME 45+ ile gelen yeni Javascript ESM mimarisi (`import`/`export`) esas alınmıştır. Eski `imports.*` tarzı API'ler kullanılmamıştır.
*   **Libsoup 3.0:** Ağ isteklerinde GNOME 45+ standardı olan `libsoup3` asenkron çağrıları tercih edilmiştir. GJS üzerinde `Soup.Session` asenkron bir `Promise` yapısı ile sarılarak arayüzün kilitlenmesi engellenmiştir.
*   **AlAdhan API:** Konum bazlı (şehir/ülke veya koordinat) aylık takvim verisi çekilmektedir. Aylık takvim kullanımı ağ trafiğini minimize etmekte ve çevrimdışı kullanımda yüksek güvenilirlik sunmaktadır.
*   **Yerel Önbellek (Cache):** AlAdhan'dan dönen aylık veriler `~/.cache/namazvaktignome` altında JSON dosyası olarak saklanır. Önbellekteki veriler konum, hesaplama yöntemi ve mezhep ayarlarıyla eşleşmiyorsa otomatik olarak geçersiz kılınır ve yeni istek atılır. Ağ hatası oluşması durumunda, ayarlar değişmediği sürece mevcut önbellek korunur.

## Test Edilen Senaryolar
Aşağıdaki senaryolar `tests/schedule.test.js` altında başarıyla test edilmiştir:
1.  **İmsak Öncesi Durum:** Sabah erken saatlerde (örneğin 02:00) bir sonraki vakit olarak bugünün İmsak vakti doğru hesaplanmaktadır.
2.  **Vakitler Arası Geçiş:** Gün içerisindeki iki vakit arasında (örneğin Öğle öncesinde) sıradaki vakit ve kalan süre dakika bazında doğrulanmıştır.
3.  **Yatsı Sonrası Durum (Wrap-around):** Gece Yatsı vakti geçtikten sonra sıradaki vakit olarak ertesi günün İmsak vakti doğru seçilmektedir ve kalan süre ertesi güne taşacak şekilde hesaplanmaktadır.
4.  **Formatlama (HH:MM):** Sürelerin `02:43` veya `00:43` gibi iki haneli saat ve dakika formatına uygun gösterilmesi test edilmiştir.
5.  **Düzeltmeler (Adjustment):** Dakika bazlı manuel kaydırmaların (örneğin İmsak vaktini 5 dakika ileri/geri alma) hesaplamaya yansıması test edilmiştir.
6.  **Güneş/İmsak Gizleme:** Panelde Güneş veya İmsak vakti gizlendiğinde, sonraki vakit adaylarının bu tercih doğrultusunda filtrelenmesi doğrulanmıştır.

## Bilinen Sınırlamalar
*   **Wayland Altında Yenileme:** Wayland oturumlarında güvenlik ve mimari gereği `Alt+F2` -> `r` komutu ile GNOME Shell yenilenemez. Yeni eklenen eklentilerin algılanması için kullanıcının oturumu kapatıp (Log Out) tekrar açması gerekmektedir. Eklenti bir kez algılandıktan sonra Ayarlar/Uzantılar arayüzünden kapatılıp açılarak kolayca güncellenebilir.
*   **Zaman Dilimi:** API isteklerinde ve zaman hesaplamalarında sistemin yerel zaman dilimi (system timezone) esas alınmaktadır.

## İleride Eklenebilecek Özellikler
*   **GeoClue Entegrasyonu:** Kullanıcının konumunu otomatik olarak algılayıp koordinatları güncelleyen opsiyonel bir modül.
*   **Ezan Sesi/Alarm:** Vakit girdiğinde isteğe bağlı kısa bir ses dosyası oynatma veya GNOME bildirim sesi tetikleme.
*   **Hicri Takvim:** Dropdown menüsünde güncel Hicri tarihi de gösterebilme.
