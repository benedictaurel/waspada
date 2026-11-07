#include <Arduino.h>
#include <stdint.h>
#include <stdlib.h>

constexpr unsigned long USB_BAUD = 115200;
constexpr unsigned long UART_BAUD = 115200;
constexpr int UART_TX_GPIO = 17;
constexpr bool PLOTTER_MODE = true;
constexpr uint32_t SAMPLE_PERIOD_MS = 100;
constexpr uint32_t PLOT_PERIOD_MS = 20;
constexpr uint32_t START_SAMPLES = 30;
constexpr uint32_t GRIP_RISE_MV = 200;
constexpr uint32_t GRIP_RISE_SAMPLES = 5;
constexpr uint32_t RELEASE_STABLE_SAMPLES = 15;
constexpr uint32_t WEAK_SAMPLES = 30;
constexpr uint32_t ECG_WEAK_PERCENT = 75;

enum class Contact { Released, Held };

struct FsrChannel {
  const char* name;
  int pin;
  Contact contact;
  uint32_t baselineMv;
  uint32_t rawMv;
  uint32_t filteredMv;
  uint32_t peakMv;
  uint32_t riseSamples;
  uint32_t releaseSamples;
  uint32_t weakSamples;
};

FsrChannel left = {"KIRI", 32, Contact::Released, 0, 0, 0, 0, 0, 0, 0};
FsrChannel right = {"KANAN", 33, Contact::Released, 0, 0, 0, 0, 0, 0, 0};
uint32_t startCount = 0;
uint32_t startLeftSumMv = 0;
uint32_t startRightSumMv = 0;
uint32_t nextSampleMs = 0;
uint32_t lastStatusMs = 0;
uint32_t lastPlotMs = 0;
uint32_t fsrSequence = 0;
bool ready = false;

// Demo waveform only. No ECG sensor is read and this is not a pulse measurement.
constexpr int16_t DEMO_ECG_OFFSETS[40] = {
  0, 0, 0, 0, 20, 55, 85, 95, 80, 45,
  10, 0, 0, 0, 0, 0, 0, 0, -30, -90,
  780, -190, -45, 0, 0, 10, 45, 95, 140, 160,
  150, 120, 85, 45, 15, 0, 0, 0, 0, 0,
};

uint32_t channelStrengthPercent(const FsrChannel& channel) {
  if (channel.contact != Contact::Held || channel.peakMv <= channel.baselineMv ||
      channel.rawMv <= channel.baselineMv + GRIP_RISE_MV / 2) return 0;
  const uint32_t spanMv = channel.peakMv - channel.baselineMv;
  const uint32_t pressureMv = channel.rawMv - channel.baselineMv;
  const uint32_t percent = pressureMv * 100 / spanMv;
  return percent > 100 ? 100 : percent;
}

uint32_t ecgStrengthPercent() {
  const uint32_t leftPercent = channelStrengthPercent(left);
  const uint32_t rightPercent = channelStrengthPercent(right);
  return leftPercent > rightPercent ? leftPercent : rightPercent;
}

uint32_t ecgState() {
  const uint32_t strength = ecgStrengthPercent();
  return strength == 0 ? 0 : strength < ECG_WEAK_PERCENT ? 2 : 1;
}

void printPlot(uint32_t nowMs) {
  const uint32_t strength = ecgStrengthPercent();
  const int32_t ecgMv = 1500 +
      DEMO_ECG_OFFSETS[(nowMs / PLOT_PERIOD_MS) % 40] * static_cast<int32_t>(strength) / 100;
  Serial.printf("ecg:%ld FSR_kiri:%lu FSR_kanan:%lu\n",
                static_cast<long>(ecgMv),
                static_cast<unsigned long>(left.filteredMv),
                static_cast<unsigned long>(right.filteredMv));
}

void restartWithoutHands() {
  ready = false;
  startCount = 0;
  startLeftSumMv = 0;
  startRightSumMv = 0;
  left.contact = Contact::Released;
  right.contact = Contact::Released;
  left.riseSamples = left.releaseSamples = left.weakSamples = 0;
  right.riseSamples = right.releaseSamples = right.weakSamples = 0;
  if (!PLOTTER_MODE) Serial.println("Jangan pegang setir selama 3 detik. Saya ukur acuan awal tanpa tangan.");
}

void sampleChannel(FsrChannel& channel) {
  const uint32_t rawMv = analogReadMilliVolts(channel.pin);
  channel.rawMv = rawMv;
  const uint32_t previousMv = channel.filteredMv;
  channel.filteredMv = (3 * channel.filteredMv + rawMv) / 4;

  if (channel.contact == Contact::Released) {
    if (channel.filteredMv > channel.baselineMv + GRIP_RISE_MV) {
      ++channel.riseSamples;
      if (channel.riseSamples >= GRIP_RISE_SAMPLES) {
        channel.contact = Contact::Held;
        channel.peakMv = channel.filteredMv;
        channel.releaseSamples = 0;
        channel.weakSamples = 0;
        if (!PLOTTER_MODE) Serial.printf("%s mulai digenggam. Acuan lepas=%lu mV.\n", channel.name,
                                        static_cast<unsigned long>(channel.baselineMv));
      }
    } else {
      channel.riseSamples = 0;
      channel.baselineMv = (15 * channel.baselineMv + channel.filteredMv) / 16;
    }
    return;
  }

  if (channel.filteredMv > channel.peakMv) channel.peakMv = channel.filteredMv;
  const uint32_t spanMv = channel.peakMv - channel.baselineMv;
  const uint32_t dropMv = channel.peakMv - channel.filteredMv;
  const int32_t changeMv = static_cast<int32_t>(channel.filteredMv) -
                           static_cast<int32_t>(previousMv);
  if (dropMv * 100 >= spanMv * 55 && abs(changeMv) <= 40) {
    ++channel.releaseSamples;
  } else {
    channel.releaseSamples = 0;
  }

  if (channel.releaseSamples >= RELEASE_STABLE_SAMPLES) {
    channel.baselineMv = channel.filteredMv;
    channel.contact = Contact::Released;
    channel.riseSamples = 0;
    channel.releaseSamples = 0;
    channel.weakSamples = 0;
    if (!PLOTTER_MODE) Serial.printf("%s tekanan turun dan stabil. Acuan baru=%lu mV.\n", channel.name,
                                    static_cast<unsigned long>(channel.baselineMv));
    return;
  }

  if (channel.filteredMv < channel.baselineMv + spanMv * 75 / 100) {
    if (channel.weakSamples < WEAK_SAMPLES) ++channel.weakSamples;
  } else {
    channel.weakSamples = 0;
  }
}

const char* channelStatus(const FsrChannel& channel) {
  if (channel.contact == Contact::Released) return "TEKANAN RENDAH";
  if (channel.weakSamples >= WEAK_SAMPLES) return "LEMAH";
  return "PEGANG";
}

void printStatus() {
  const char* overall;
  if (left.contact == Contact::Released && right.contact == Contact::Released) {
    overall = "TEKANAN KEDUA SISI TIDAK TERDETEKSI";
  } else if (left.contact == Contact::Released || right.contact == Contact::Released) {
    overall = "TEKANAN SATU SISI TIDAK TERDETEKSI";
  } else if (left.weakSamples >= WEAK_SAMPLES || right.weakSamples >= WEAK_SAMPLES) {
    overall = "GENGGAMAN MELEMAH";
  } else {
    overall = "DUA SISI DIGENGGAM";
  }
  Serial.printf("KIRI=%lu [%s, acuan=%lu] KANAN=%lu [%s, acuan=%lu] | %s\n",
                static_cast<unsigned long>(left.filteredMv), channelStatus(left),
                static_cast<unsigned long>(left.baselineMv),
                static_cast<unsigned long>(right.filteredMv), channelStatus(right),
                static_cast<unsigned long>(right.baselineMv), overall);
}

void setup() {
  Serial.begin(USB_BAUD);
  Serial2.begin(UART_BAUD, SERIAL_8N1, -1, UART_TX_GPIO);
  Serial.setTimeout(50);
  analogReadResolution(12);
  analogSetPinAttenuation(left.pin, ADC_11db);
  analogSetPinAttenuation(right.pin, ADC_11db);
  nextSampleMs = millis();
  lastStatusMs = nextSampleMs;
  if (!PLOTTER_MODE) {
    Serial.println("Uji FSR adaptif. Pastikan kabel elektroda ECG sudah dilepas dari modul.");
    Serial.println("Ketik RESET jika ingin mengambil acuan awal tanpa tangan lagi.");
  }
  restartWithoutHands();
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    if (command.equalsIgnoreCase("RESET")) restartWithoutHands();
  }

  const uint32_t now = millis();
  if (static_cast<int32_t>(now - nextSampleMs) >= 0) {
    nextSampleMs = now + SAMPLE_PERIOD_MS;
    if (!ready) {
      startLeftSumMv += analogReadMilliVolts(left.pin);
      startRightSumMv += analogReadMilliVolts(right.pin);
      ++startCount;
      if (startCount == START_SAMPLES) {
        left.baselineMv = startLeftSumMv / START_SAMPLES;
        right.baselineMv = startRightSumMv / START_SAMPLES;
        left.rawMv = left.baselineMv;
        right.rawMv = right.baselineMv;
        left.filteredMv = left.baselineMv;
        right.filteredMv = right.baselineMv;
        left.peakMv = left.baselineMv;
        right.peakMv = right.baselineMv;
        ready = true;
        if (!PLOTTER_MODE) Serial.printf("Acuan awal siap. Kiri=%lu mV, kanan=%lu mV. Sekarang coba pegang, longgarkan, dan lepas.\n",
                                        static_cast<unsigned long>(left.baselineMv),
                                        static_cast<unsigned long>(right.baselineMv));
      }
    } else {
      sampleChannel(left);
      sampleChannel(right);
      // The ECG field is a demo proxy from FSR contact, not an electrode reading.
      Serial2.printf("F,%lu,%lu,%lu,%u,%u,%u\n",
                     static_cast<unsigned long>(fsrSequence++),
                     static_cast<unsigned long>(left.rawMv),
                     static_cast<unsigned long>(right.rawMv),
                     static_cast<unsigned>(left.contact == Contact::Released ? 0 :
                                           left.weakSamples >= WEAK_SAMPLES ? 2 : 1),
                     static_cast<unsigned>(right.contact == Contact::Released ? 0 :
                                           right.weakSamples >= WEAK_SAMPLES ? 2 : 1),
                     static_cast<unsigned>(ecgState()));
    }
  }

  if (PLOTTER_MODE && ready && now - lastPlotMs >= PLOT_PERIOD_MS) {
    lastPlotMs = now;
    printPlot(now);
  }

  if (!PLOTTER_MODE && now - lastStatusMs >= 1000) {
    lastStatusMs = now;
    if (ready) {
      printStatus();
    } else {
      Serial.printf("Mengukur tanpa tangan: %lu/3 detik.\n",
                    static_cast<unsigned long>(startCount / 10));
    }
  }
}
