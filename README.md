# Kur'an Uygulamasi MVP

Flutter ile Android odakli MVP:

- Bugunun ayeti
- Duruma gore ayet onerisi
- Favoriler
- Namaz vakitleri
- Hafif ezber modulu v0
- Ayarlar

## Kurulum

Bu klasorde Flutter SDK bulunmayan ortamlarda kaynak kod hazirdir. Flutter kurulu bir makinede:

```powershell
flutter pub get
flutter create . --platforms android
flutter run
```

`flutter create . --platforms android` yalnizca eksik Android platform dosyalarini uretmek icindir; `lib/`, `assets/` ve `pubspec.yaml` korunur.

Android bildirimleri icin platform dosyalari uretildikten sonra
`android/app/src/main/AndroidManifest.xml` icine su izin eklenmelidir:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

GPS akisi sonraki sprintte acilacaksa ayni dosyaya konum izinleri de eklenir.

## Not

`assets/data/ayahs.json` MVP icin kucuk bir secilmis havuzdur. Canli yayin oncesi meal metinlerinin tercih edilen resmi kaynakla dini/editorial kontrolden gecirilmesi onerilir.
