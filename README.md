# Namaz Vakti Gnome

GNOME Shell için sağ üst panelde sıradaki namaz vaktini ve bu vakte kalan süreyi bir bakışta gösteren sade, hafif ve modern bir eklentidir.

Bu eklenti, GNOME 45+ ES Modules (ESM) ve Libsoup 3.0 teknolojilerini kullanan modern bir mimariye sahiptir.

## Özellikler

*   **Panel Göstergesi:** Panelde `[hilal simgesi] Akşam · 02:43` şeklinde sıradaki vakti ve kalan süreyi (`HH:MM` veya dakika biçiminde) gösterir.
*   **Geniş Tooltip:** Fare ile panelin üzerine gelindiğinde konum, sıradaki vakit saati ve kalan detaylı süreyi gösterir.
*   **Açılır Menü (Dropdown):** Panel simgesine tıklandığında konum bilgisi, günün tüm vakitleri, sıradaki vaktin vurgulanması, manuel güncelleme düğmesi ve ayarlar bağlantısı sunar.
*   **Önbellek (Cache):** AlAdhan API'den aylık takvim indirerek yerel diskte saklar. İnternet kesilse bile önbellek verileriyle kesintisiz çalışmaya devam eder.
*   **Manuel Düzeltmeler:** Seçilen hesap yöntemi ile yerel takvim arasında fark oluşursa, her vakit için `-30` ila `+30` dakika arasında manuel düzeltme imkanı sağlar.
*   **Gelişmiş Ayarlar:** Konum (Şehir/Ülke veya Koordinat), hesaplama yöntemleri, mezhep seçimi, panel görünüm seçenekleri (simge/yazı gizleme) ve bildirimler.

## Gereksinimler

*   GNOME Shell 45, 46, 47, 48, 49 veya 50+
*   `gjs` (Javascript bindings for GNOME)
*   İnternet bağlantısı (ilk kurulumda ve ayarlar değiştiğinde veri çekmek için)

## Yerel Kurulum

Eklenti klasörünü kullanıcının uzantılar dizinine kopyalayın:

1.  Eklenti klasörünü kullanıcının uzantılar dizinine kopyalayın:
    ```bash
    mkdir -p ~/.local/share/gnome-shell/extensions/namaz-vakti-gnome@local
    cp -r extension.js prefs.js metadata.json stylesheet.css schemas icons src ~/.local/share/gnome-shell/extensions/namaz-vakti-gnome@local/
    ```

2.  GSettings şemasını derleyin:
    ```bash
    glib-compile-schemas ~/.local/share/gnome-shell/extensions/namaz-vakti-gnome@local/schemas/
    ```

3.  **Önemli (Wayland):** Eğer Wayland oturumundaysanız, GNOME Shell yeni eklenen eklenti klasörünü otomatik olarak taramaz. Algılaması için **oturumu kapatıp (Log Out) tekrar giriş yapmanız** gerekmektedir. X11 kullanıyorsanız `Alt+F2` tuşlarına basıp `r` yazarak kabuğu yeniden başlatabilirsiniz.

## Etkinleştirme ve Devre Dışı Bırakma

Oturumu yeniden başlattıktan sonra eklentiyi etkinleştirmek için:

```bash
gnome-extensions enable namaz-vakti-gnome@local
```

Devre dışı bırakmak için:

```bash
gnome-extensions disable namaz-vakti-gnome@local
```

Ayrıca GNOME **Extensions (Uzantılar)** uygulamasını veya **Uzantı Yöneticisi (Extension Manager)** aracını kullanarak da görsel olarak açıp kapatabilirsiniz.

## Ayarlar

Eklenti ayarlarına gitmek için terminalden şu komutu çalıştırabilir veya Uzantılar uygulamasından "Ayarlar" butonuna basabilirsiniz:

```bash
gnome-extensions prefs namaz-vakti-gnome@local
```

### Ayar Grupları

1.  **Konum Ayarları:**
    *   *Yöntem:* Şehir + Ülke veya Enlem + Boylam koordinatları.
    *   *Konum Testi:* Ayarların doğruluğunu kontrol etmek için API üzerinden anlık test yapar.
2.  **Hesaplama Ayarları:**
    *   *Hesap Yöntemi:* Diyanet İşleri Başkanlığı (Türkiye), Muslim World League (MWL), ISNA, Umm al-Qura vb.
    *   *İkindi Mezhebi:* Hanefi veya Standart (Şafi/Maliki/Hanbeli).
3.  **Dakika Düzeltmeleri:** Vakitlerin yerel saatlerle birebir uyuşması için her vakte özel dakika düzeltmesi uygulanabilir.
4.  **Görünüm Ayarları:**
    *   Panelde Güneş ve İmsak vakitlerini gösterip gizleme, 24 saat biçimi, kalan sürenin `HH:MM` yerine dakika (`dk`) olarak gösterilmesi ve panel tooltip ayarları.
5.  **Bildirim Ayarları:** Vakit geldiğinde veya vakte belirtilen dakika kala GNOME bildirimi gönderilmesini sağlar.

## Sorun Giderme

Eklentiyle ilgili herhangi bir hata veya sorunla karşılaştığınızda GNOME Shell günlüklerini (günce loglarını) inceleyebilirsiniz:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

Sadece bu eklentiye ait logları filtrelemek için:

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -i vakit
```

## Paketleme

Eklentiyi `.zip` dosyası olarak paketlemek için (örneğin GNOME Extensions web sitesine yüklemek veya dağıtmak için) proje kök dizininde şu python komutunu çalıştırabilirsiniz:

```bash
python3 -c "
import zipfile, os
files = ['extension.js', 'prefs.js', 'metadata.json', 'stylesheet.css', 'schemas/org.gnome.shell.extensions.namaz-vakti-gnome.gschema.xml']
with zipfile.ZipFile('dist/namaz-vakti-gnome.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    for f in files: zipf.write(f)
    for r, d, fs in os.walk('src'):
        for f in fs: zipf.write(os.path.join(r, f))
    for r, d, fs in os.walk('icons'):
        for f in fs: zipf.write(os.path.join(r, f))
"
```
Üretilen paket `dist/namaz-vakti-gnome.zip` yolunda oluşacaktır.
