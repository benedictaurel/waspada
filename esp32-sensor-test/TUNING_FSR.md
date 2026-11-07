# Tuning FSR — pembaruan 10 Oktober 2026

Buka ulang sketch setelah menyimpan perubahan Arduino IDE yang masih terbuka.
Pastikan config.h: TEST_MODE=1, OUTPUT_MODE=1, FSR_TUNING_VIEW=true,
SERIAL_BAUD=115200. Upload ulang; Serial Monitor juga 115200.

Tampilan tidak lagi mengutamakan grip 0/1 pada mode ini:

```text
t=5.0s missed=0 drop=0
L raw=1200 avg=1150 min=142 max=2600 span=2458mV rel=33% [######..............]
R raw=142 avg=142 min=142 max=142 span=0mV rel=0% [....................]
```

Contoh di atas ilustrasi, bukan hasil pengukuran perangkat.
raw: satu pembacaan; avg: rata-rata 5 sampel; min/max: raw minimum/maksimum
dari frame yang diterima sejak reset; span=max-min. rel menggunakan avg:
100*(avg-ZERO)/(FULL-ZERO), dibatasi 0..100. Ini skala relatif tegangan,
bukan persen tekanan/gaya atau Newton. FSR tidak linear terhadap gaya.
Default ZERO=150, FULL=3100 mV hanya titik awal, bukan kalibrasi.
EN/RESET menghapus rentang min/max. Algoritme grip lama tetap tersedia
pada tampilan biasa dengan FSR_TUNING_VIEW=false; sampling tidak diubah.

## Urutan pengujian

1. Tanpa memegang setir, tekan EN. Catat avg L/R selama 5 detik.
2. Tekan kiri ringan 5 detik, lepas 5 detik, kuat wajar 5 detik, lepas.
3. Ulangi kanan. Catat avg setiap kondisi, jangan hanya min/max.
4. Jika tidak berubah: matikan/cabut daya sebelum menyentuh sambungan.
   Periksa node GPIO32/33: terhubung FSR, resistor 10k ke GND dan
   kapasitor 100nF ke GND. Kedua komponen paralel, bukan seri ke GPIO.
   Periksa kedua kaki komponen tidak berada di strip breadboard yang sama.
5. Nilai kiri terus tinggi dapat disebabkan preload lapisan setir,
   node tersambung 3V3, resistor ke GND terputus, atau sensor/sambungan lain.
   Nilai kanan rendah terus dapat disebabkan FSR terbuka, node ke GND,
   salah baris atau tekanan tidak sampai ke sensor. Ini dugaan, bukan diagnosis pasti.
6. Untuk membedakan kanal dan sensor, matikan daya lalu tukar HANYA
   jumper sinyal GPIO32 dan GPIO33. Nyalakan dan uji lagi.
   Bila masalah mengikuti rangkaian FSR, periksa sensor/rangkaian itu.
   Bila tetap pada kanal yang sama, periksa jalur GPIO/board.
   Kembalikan jumper setelah uji.
7. Bila ada multimeter, ukur node terhadap GND saat diberi daya,
   tanpa menyentuhkan probe ke dua titik sekaligus. Bandingkan dengan mV serial.
   Jangan gunakan mode ohm/continuity pada rangkaian yang diberi daya.

Kalibrasi hanya setelah tekan/lepas menghasilkan perubahan berulang:
isi FSR_LEFT_ZERO_MV dengan avg kiri tanpa genggaman dan
FSR_LEFT_FULL_MV dengan avg kiri genggaman kuat yang wajar; ulangi kanan.
FULL harus lebih besar dari ZERO. Upload ulang. Jangan menggunakan rentang
yang sangat sempit hanya untuk memperbesar noise menjadi tampilan 0..100%.
Ambang ON/OFF tidak otomatis berubah; tuning persen terpisah dari ambang grip.

## ECG

TEST_MODE=1 tidak membaca ECG, walaupun AD8232 tetap mendapat daya.
LED modul atau gangguan saat ditekan tidak membuktikan ECG valid.
Gerakan elektroda/kabel, perubahan kontak copper, dan aktivitas otot saat
menggenggam bisa mengganggu sinyal. Sesudah FSR selesai, TEST_MODE=2 dan
OUTPUT_MODE=2 menampilkan ECG mentah serta flag off. Tutup Monitor sebelum
membuka Plotter, samakan baud 115200. Jangan langsung menambahkan filter
untuk menyembunyikan kontak buruk atau sinyal jenuh.

Saat tubuh menyentuh kontak ECG, gunakan sistem bertenaga baterai:
laptop tidak terhubung charger maupun periferal yang tersambung listrik PLN.
Jangan hubungkan osiloskop bertenaga PLN ke rangkaian yang terpasang di tubuh.
Ini bukan perangkat medis bersertifikat.
