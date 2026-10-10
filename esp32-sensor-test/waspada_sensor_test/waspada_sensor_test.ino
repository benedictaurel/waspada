/*
 * WASPADA: uji lokal sensor FSR dan AD8232, tanpa Wi-Fi/MQTT.
 * Board sasaran: ESP32 klasik / ESP32-WROOM DevKit 30 pin.
 * Konfigurasi pengguna ada di tab config.h. Default: FSR + Serial Monitor.
 * ECG dicetak mentah dalam mV; tidak ada filter ECG, BPM, atau HRV di sini.
 */
#include <Arduino.h>
#include <limits.h>
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "sensor_types.h"

#if !defined(CONFIG_IDF_TARGET_ESP32)
#error "Sketch ini untuk ESP32 klasik, bukan ESP32-S2/S3/C3. Periksa tipe board."
#endif

constexpr bool ECG_ENABLED = TEST_MODE == 2 || TEST_MODE == 3;
constexpr bool FSR_ENABLED = TEST_MODE == 1 || TEST_MODE == 3;
constexpr uint32_t TICK_PERIOD_US = ECG_ENABLED ? ECG_PERIOD_US : FSR_PERIOD_US;

QueueHandle_t sampleQueue = nullptr;
TaskHandle_t samplerHandle = nullptr;
esp_timer_handle_t sampleTimer = nullptr;
int64_t samplingStartUs = 0;

// Prototipe eksplisit agar Arduino preprocessor mengenali tipe SensorFrame.
void fail(const char* message);
void onSampleTimer(void* argument);
void samplingTask(void* argument);
void printMonitor(const SensorFrame& frame);
void printFsrTuning(const SensorFrame& frame);
void printPlotter(const SensorFrame& frame);
void printCsv(const SensorFrame& frame);

void fail(const char* message) {
  Serial.printf("# ERROR: %s\n", message);
  while (true) delay(1000);
}

void onSampleTimer(void* argument) {
  // Callback berjalan di task ESP Timer (ESP_TIMER_TASK), bukan ISR.
  // Hanya bangunkan sampler: tidak ada ADC, Serial.print, atau delay di sini.
  xTaskNotifyGive(samplerHandle);
}

void samplingTask(void* argument) {
  MovingAverage leftFilter;
  MovingAverage rightFilter;
  GripTracker leftGrip;
  GripTracker rightGrip;
  SensorFrame frame;
  uint64_t lastSlot = 0;
  int64_t previousSampleUs = 0;
  int64_t nextFsrUs = 0;

  while (true) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    const int64_t nowUs = esp_timer_get_time();
    // Origin diisi setup sebelum timer dimulai. Baca setelah notifikasi pertama.
    if (nextFsrUs == 0) nextFsrUs = samplingStartUs + FSR_PERIOD_US;
    const uint64_t slot = (nowUs - samplingStartUs) / TICK_PERIOD_US;
    // Jangan membuat sampel palsu dengan mengejar callback yang terlambat.
    // Callback yang menumpuk bisa membangunkan task pada slot waktu yang sama.
    if (slot <= lastSlot) continue;
    frame.missedSlots += static_cast<uint32_t>(slot - lastSlot - 1);
    frame.seq = slot - 1;
    lastSlot = slot;
    frame.tsUs = nowUs;
    frame.dtUs = previousSampleUs == 0 ? 0 :
        static_cast<uint32_t>(nowUs - previousSampleUs);
    previousSampleUs = nowUs;

    if (ECG_ENABLED) {
      const int plusBefore = digitalRead(PIN_LO_PLUS);
      const int minusBefore = digitalRead(PIN_LO_MINUS);
      frame.ecgMv = analogReadMilliVolts(PIN_ECG);
      // Tandai off jika terdeteksi sebelum ATAU setelah pembacaan ADC.
      frame.loPlus = plusBefore || digitalRead(PIN_LO_PLUS);
      frame.loMinus = minusBefore || digitalRead(PIN_LO_MINUS);
      ++frame.ecgSamples;
    }

    if (FSR_ENABLED && nowUs >= nextFsrUs) {
      const int64_t fsrNowUs = esp_timer_get_time();
      // Jeda panjang membatalkan bukti "lepas kontinu" dan history filter.
      if (frame.fsrTsUs != 0 && fsrNowUs - frame.fsrTsUs > 3 * FSR_PERIOD_US) {
        leftFilter.reset();
        rightFilter.reset();
        leftGrip.reset();
        rightGrip.reset();
      }
      frame.fsrTsUs = fsrNowUs;
      frame.fsrLeftRawMv = analogReadMilliVolts(PIN_FSR_LEFT);
      frame.fsrRightRawMv = analogReadMilliVolts(PIN_FSR_RIGHT);
      frame.fsrLeftAvgMv = leftFilter.update(frame.fsrLeftRawMv);
      frame.fsrRightAvgMv = rightFilter.update(frame.fsrRightRawMv);
      leftGrip.update(frame.fsrLeftAvgMv, fsrNowUs, FSR_LEFT_ON_MV, FSR_LEFT_OFF_MV);
      rightGrip.update(frame.fsrRightAvgMv, fsrNowUs, FSR_RIGHT_ON_MV, FSR_RIGHT_OFF_MV);
      frame.gripLeft = leftGrip.gripping;
      frame.gripRight = rightGrip.gripping;
      frame.offLeftLong = leftGrip.releasedLong;
      frame.offRightLong = rightGrip.releasedLong;
      ++frame.fsrSamples;
      nextFsrUs += ((nowUs - nextFsrUs) / FSR_PERIOD_US + 1) * FSR_PERIOD_US;
    }

    // Antrean memisahkan sampling dari USB. Antrean penuh tidak memblok ADC.
    if (xQueueSend(sampleQueue, &frame, 0) != pdTRUE) ++frame.queueDrops;
  }
}

void printFsrTuning(const SensorFrame& frame) {
  static int64_t lastReportUs = 0;
  static int32_t low[2] = {INT32_MAX, INT32_MAX};
  static int32_t high[2] = {0, 0};
  const int32_t raw[2] = {frame.fsrLeftRawMv, frame.fsrRightRawMv};
  const int32_t avg[2] = {frame.fsrLeftAvgMv, frame.fsrRightAvgMv};
  const int32_t zero[2] = {FSR_LEFT_ZERO_MV, FSR_RIGHT_ZERO_MV};
  const int32_t full[2] = {FSR_LEFT_FULL_MV, FSR_RIGHT_FULL_MV};
  // Rentang dari semua frame yang diterima, bukan hanya baris yang dicetak.
  for (int i = 0; i < 2; ++i) {
    if (raw[i] < low[i]) low[i] = raw[i];
    if (raw[i] > high[i]) high[i] = raw[i];
  }
  if (frame.tsUs - lastReportUs < MONITOR_INTERVAL_US) return;
  lastReportUs = frame.tsUs;
  Serial.printf("t=%.1fs missed=%lu drop=%lu\n", frame.tsUs / 1000000.0,
                static_cast<unsigned long>(frame.missedSlots),
                static_cast<unsigned long>(frame.queueDrops));
  for (int i = 0; i < 2; ++i) {
    int32_t percent = (avg[i] - zero[i]) * 100 / (full[i] - zero[i]);
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    Serial.printf("%c raw=%ld avg=%ld min=%ld max=%ld span=%ldmV rel=%ld%% [",
                  i == 0 ? 'L' : 'R', static_cast<long>(raw[i]),
                  static_cast<long>(avg[i]), static_cast<long>(low[i]),
                  static_cast<long>(high[i]), static_cast<long>(high[i] - low[i]),
                  static_cast<long>(percent));
    for (int j = 0; j < 20; ++j) Serial.print(j < percent / 5 ? '#' : '.');
    Serial.println("]");
  }
}

void printMonitor(const SensorFrame& frame) {
  if (TEST_MODE == 1 && FSR_TUNING_VIEW) {
    printFsrTuning(frame);
    return;
  }
  static int64_t lastReportUs = samplingStartUs;
  static uint32_t lastEcgCount = 0;
  static uint32_t lastFsrCount = 0;
  static uint32_t minDt = UINT32_MAX;
  static uint32_t maxDt = 0;
  if (frame.dtUs > 0) {
    if (frame.dtUs < minDt) minDt = frame.dtUs;
    if (frame.dtUs > maxDt) maxDt = frame.dtUs;
  }
  const int64_t elapsedUs = frame.tsUs - lastReportUs;
  if (elapsedUs < MONITOR_INTERVAL_US) return;

  const double ecgHz = (frame.ecgSamples - lastEcgCount) * 1000000.0 / elapsedUs;
  const double fsrHz = (frame.fsrSamples - lastFsrCount) * 1000000.0 / elapsedUs;
  Serial.printf("t=%.2fs seq=%llu ", frame.tsUs / 1000000.0,
                static_cast<unsigned long long>(frame.seq));
  if (FSR_ENABLED) {
    Serial.printf("L(raw/avg)=%ld/%ldmV R(raw/avg)=%ld/%ldmV "
                  "gripL=%d gripR=%d lepasL_long=%d lepasR_long=%d ",
                  static_cast<long>(frame.fsrLeftRawMv),
                  static_cast<long>(frame.fsrLeftAvgMv),
                  static_cast<long>(frame.fsrRightRawMv),
                  static_cast<long>(frame.fsrRightAvgMv),
                  frame.gripLeft, frame.gripRight, frame.offLeftLong, frame.offRightLong);
  }
  if (ECG_ENABLED) {
    const bool leadsOff = frame.loPlus || frame.loMinus;
    const bool nearRail = frame.ecgMv <= 150 || frame.ecgMv >= 3100;
    Serial.printf("ECG=%ldmV LO+=%ld LO-=%ld leads_off=%d near_rail=%d ",
                  static_cast<long>(frame.ecgMv), static_cast<long>(frame.loPlus),
                  static_cast<long>(frame.loMinus), leadsOff, nearRail);
  }
  Serial.printf("ecg_Hz=%.1f fsr_Hz=%.1f dt_min/max=%lu/%luus "
                "missed=%lu drop=%lu\n", ecgHz, fsrHz,
                static_cast<unsigned long>(minDt == UINT32_MAX ? 0 : minDt),
                static_cast<unsigned long>(maxDt),
                static_cast<unsigned long>(frame.missedSlots),
                static_cast<unsigned long>(frame.queueDrops));
  lastReportUs = frame.tsUs;
  lastEcgCount = frame.ecgSamples;
  lastFsrCount = frame.fsrSamples;
  minDt = UINT32_MAX;
  maxDt = 0;
}

void printPlotter(const SensorFrame& frame) {
  static int64_t lastPlotUs = 0;
  if (ECG_ENABLED) {
    if (frame.tsUs - lastPlotUs < ECG_PLOT_INTERVAL_US) return;
    lastPlotUs = frame.tsUs;
  }
  // Baris pendek; interval tampilan ECG terpisah dari sampling sensor.
  // ECG tetap mentah saat lead-off; flag off harus ikut diperhatikan.
  if (TEST_MODE == 1) {
    Serial.printf("L_raw:%ld L_avg:%ld R_raw:%ld R_avg:%ld\n",
                  static_cast<long>(frame.fsrLeftRawMv),
                  static_cast<long>(frame.fsrLeftAvgMv),
                  static_cast<long>(frame.fsrRightRawMv),
                  static_cast<long>(frame.fsrRightAvgMv));
  } else if (TEST_MODE == 2) {
    Serial.printf("ecg:%ld off:%d\n", static_cast<long>(frame.ecgMv),
                  (frame.loPlus || frame.loMinus) ? 3300 : 0);
  } else {
    Serial.printf("ecg:%ld L:%ld R:%ld off:%d\n", static_cast<long>(frame.ecgMv),
                  static_cast<long>(frame.fsrLeftAvgMv),
                  static_cast<long>(frame.fsrRightAvgMv),
                  (frame.loPlus || frame.loMinus) ? 3300 : 0);
  }
}

void printCsv(const SensorFrame& frame) {
  const int64_t fsrAgeUs = frame.fsrTsUs == 0 ? -1 : frame.tsUs - frame.fsrTsUs;
  // FSR bisa diambil sedikit setelah timestamp ECG, sehingga age dibatasi nol.
  Serial.printf("%llu,%lld,%ld,%ld,%ld,%ld,%ld,%ld,%ld,%d,%d,%d,%d,%lld,%lu,%lu,%lu\n",
                static_cast<unsigned long long>(frame.seq),
                static_cast<long long>(frame.tsUs),
                static_cast<long>(frame.ecgMv),
                static_cast<long>(frame.loPlus), static_cast<long>(frame.loMinus),
                static_cast<long>(frame.fsrLeftRawMv), static_cast<long>(frame.fsrRightRawMv),
                static_cast<long>(frame.fsrLeftAvgMv), static_cast<long>(frame.fsrRightAvgMv),
                frame.gripLeft, frame.gripRight, frame.offLeftLong, frame.offRightLong,
                static_cast<long long>(fsrAgeUs < 0 && frame.fsrTsUs != 0 ? 0 : fsrAgeUs),
                static_cast<unsigned long>(frame.dtUs),
                static_cast<unsigned long>(frame.missedSlots),
                static_cast<unsigned long>(frame.queueDrops));
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(700); // Hanya saat boot, bukan untuk mengatur sampling.
  analogReadResolution(12);
  if (FSR_ENABLED) {
    pinMode(PIN_FSR_LEFT, INPUT);
    pinMode(PIN_FSR_RIGHT, INPUT);
    analogSetPinAttenuation(PIN_FSR_LEFT, ADC_11db);
    analogSetPinAttenuation(PIN_FSR_RIGHT, ADC_11db);
    // Pemanasan API ADC/kalibrasi sebelum timer mulai.
    analogReadMilliVolts(PIN_FSR_LEFT);
    analogReadMilliVolts(PIN_FSR_RIGHT);
  }
  if (ECG_ENABLED) {
    pinMode(PIN_ECG, INPUT);
    pinMode(PIN_LO_PLUS, INPUT);  // LO di-drive AD8232; tanpa pull-up internal.
    pinMode(PIN_LO_MINUS, INPUT);
    analogSetPinAttenuation(PIN_ECG, ADC_11db);
    analogReadMilliVolts(PIN_ECG);
  }

  if (OUTPUT_MODE == 1) {
    Serial.printf("# WASPADA sensor test | TEST_MODE=%d OUTPUT_MODE=%d baud=%lu\n",
                  TEST_MODE, OUTPUT_MODE, SERIAL_BAUD);
    Serial.println("# Target: FSR 50 Hz; ECG 250 Hz jika diaktifkan. Data ECG mentah, tanpa BPM/HRV.");
    Serial.printf("# grip: 1=genggam; lepas_long: 1=lepas >= %lld ms. Ini bukan alert kantuk.\n",
                  static_cast<long long>(RELEASE_HOLD_US / 1000));
    Serial.println("# missed/drop harus tetap 0 pada uji normal. Timestamp dalam us sejak boot.");
    if (TEST_MODE == 1 && FSR_TUNING_VIEW) {
      Serial.println("# TUNING: raw/avg/min/max/span dalam mV. min/max sejak reset.");
      Serial.println("# rel=skala tegangan terhadap ZERO/FULL config, BUKAN persen gaya.");
      Serial.println("# Tekan EN untuk reset min/max. ECG TIDAK disampling pada TEST_MODE=1.");
    }
  } else if (OUTPUT_MODE == 3) {
    Serial.println("seq,ts_us,ecg_mv,lo_plus,lo_minus,fsrL_raw_mv,fsrR_raw_mv,"
                   "fsrL_avg_mv,fsrR_avg_mv,gripL,gripR,offL_long,offR_long,"
                   "fsr_age_us,dt_us,missed_slots,queue_drops");
  }

  sampleQueue = xQueueCreate(SAMPLE_QUEUE_LENGTH, sizeof(SensorFrame));
  if (sampleQueue == nullptr) fail("Tidak bisa membuat antrean sampel");
  if (xTaskCreatePinnedToCore(samplingTask, "sensor_sampler", 6144, nullptr, 3,
                              &samplerHandle, 1) != pdPASS) {
    fail("Tidak bisa membuat task sampling");
  }
  esp_timer_create_args_t timerArgs{};
  timerArgs.callback = &onSampleTimer;
  timerArgs.dispatch_method = ESP_TIMER_TASK;
  timerArgs.name = "sensor_tick";
  if (esp_timer_create(&timerArgs, &sampleTimer) != ESP_OK) fail("Timer gagal dibuat");
  // Reset origin setelah alokasi task/timer agar setup tidak dihitung sebagai loss.
  samplingStartUs = esp_timer_get_time();
  if (esp_timer_start_periodic(sampleTimer, TICK_PERIOD_US) != ESP_OK) {
    fail("Timer gagal dimulai");
  }
}

void loop() {
  SensorFrame frame;
  if (xQueueReceive(sampleQueue, &frame, pdMS_TO_TICKS(50)) != pdTRUE) return;
  if (OUTPUT_MODE == 1) printMonitor(frame);
  else if (OUTPUT_MODE == 2) printPlotter(frame);
  else printCsv(frame);
}
