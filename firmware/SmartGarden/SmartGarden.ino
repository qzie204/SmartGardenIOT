#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include "config.h"

// Đây là số GPIO, không phải số D in trên board NodeMCU.
#define DHT_PIN 5
#define DHT_TYPE DHT11
#define LIGHT_DO 13
#define LIGHT_XANH 14
#define AS 4

const char* sensorTopic = "Qzie204/garden/data/sensors";
const char* controlTopic = "Qzie204/garden/device/control";
const char* responseTopic = "Qzie204/garden/device/response";

WiFiClient espClient;
PubSubClient client(espClient);
DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastRead = 0;
unsigned long lastMqttAttempt = 0;

void callback(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, controlTopic) != 0 || length > 32) {
    return;
  }

  String message;
  message.reserve(length);
  for (unsigned int index = 0; index < length; index++) {
    message += (char)payload[index];
  }

  if (message == "led1_on") {
    digitalWrite(LIGHT_DO, HIGH);
    client.publish(responseTopic, "led1_on_ok", false);
  } else if (message == "led1_off") {
    digitalWrite(LIGHT_DO, LOW);
    client.publish(responseTopic, "led1_off_ok", false);
  } else if (message == "led2_on") {
    digitalWrite(LIGHT_XANH, HIGH);
    client.publish(responseTopic, "led2_on_ok", false);
  } else if (message == "led2_off") {
    digitalWrite(LIGHT_XANH, LOW);
    client.publish(responseTopic, "led2_off_ok", false);
  } else if (message == "all_on") {
    digitalWrite(LIGHT_DO, HIGH);
    digitalWrite(LIGHT_XANH, HIGH);
    client.publish(responseTopic, "all_on_ok", false);
  } else if (message == "all_off") {
    digitalWrite(LIGHT_DO, LOW);
    digitalWrite(LIGHT_XANH, LOW);
    client.publish(responseTopic, "all_off_ok", false);
  }
}

void connectMqtt() {
  if (client.connected() || WiFi.status() != WL_CONNECTED) {
    return;
  }
  if (millis() - lastMqttAttempt < 3000) {
    return;
  }
  lastMqttAttempt = millis();
  String clientId = "ESP8266-" + String(ESP.getChipId());
  if (client.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    client.subscribe(controlTopic);
    client.publish(responseTopic, "ESP8266 da ket noi MQTT", false);
    Serial.println("Da ket noi MQTT");
  } else {
    Serial.print("Loi MQTT: ");
    Serial.println(client.state());
  }
}

void publishSensors() {
  if (millis() - lastRead < 2000) {
    return;
  }
  lastRead = millis();
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int light = digitalRead(AS);

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Loi doc DHT");
    return;
  }

  String json = "{";
  json += "\"temperature\":" + String(temperature, 2);
  json += ",\"humidity\":" + String(humidity, 2);
  json += ",\"light\":" + String(light);
  json += "}";

  if (client.publish(sensorTopic, json.c_str(), false)) {
    Serial.println(json);
  } else {
    Serial.println("Khong gui duoc du lieu cam bien");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(AS, INPUT);
  pinMode(LIGHT_DO, OUTPUT);
  pinMode(LIGHT_XANH, OUTPUT);
  digitalWrite(LIGHT_DO, LOW);
  digitalWrite(LIGHT_XANH, LOW);
  dht.begin();

  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setCallback(callback);
  client.setBufferSize(512);
  client.setSocketTimeout(2);
}

void loop() {
  connectMqtt();
  if (client.connected()) {
    client.loop();
    publishSensors();
  }
  delay(1);
}
