#include "MQ135.h"
#include <SoftwareSerial.h>
#include <LiquidCrystal.h>

#define DEBUG true

SoftwareSerial esp8266(9, 10);

const int sensorPin = A0;
const int buzzerPin = 8;

float air_quality;
int raw_adc;
float sensor_voltage;

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

String sendData(String command, const int timeout, boolean debug);
void updateSensor();
void updateBuzzer();
void displayAirQuality();
void displaySensorParameter();
const char *getAirStatus();

void setup()
{
  pinMode(buzzerPin, OUTPUT);
  pinMode(sensorPin, INPUT);
  digitalWrite(buzzerPin, LOW);

  lcd.begin(16, 2);
  lcd.setCursor(0, 0);
  lcd.print("circuitdigest");
  lcd.setCursor(0, 1);
  lcd.print("Sensor Warming");

  Serial.begin(115200);
  esp8266.begin(115200);

  Serial.println();
  Serial.println("================================");
  Serial.println("IoT Air Pollution Monitor Start");
  Serial.println("Arduino Serial Baud: 115200");
  Serial.println("ESP8266 Baud: 115200");
  Serial.println("SoftwareSerial RX = D9");
  Serial.println("SoftwareSerial TX = D10");
  Serial.println("Buzzer = D8");
  Serial.println("================================");

  delay(1000);

  Serial.println("[INIT] Reset ESP8266");
  sendData("AT+RST\r\n", 4000, DEBUG);

  Serial.println("[INIT] Set ESP8266 to AP mode");
  sendData("AT+CWMODE=2\r\n", 2000, DEBUG);

  Serial.println("[INIT] Get ESP8266 IP address");
  sendData("AT+CIFSR\r\n", 2000, DEBUG);

  Serial.println("[INIT] Enable multiple connections");
  sendData("AT+CIPMUX=1\r\n", 2000, DEBUG);

  Serial.println("[INIT] Start server on port 80");
  sendData("AT+CIPSERVER=1,80\r\n", 2000, DEBUG);

  lcd.clear();

  Serial.println("[INIT] Setup complete");
}

void loop()
{
  updateSensor();
  updateBuzzer();

  displayAirQuality();
  delay(1000);

  displaySensorParameter();
  delay(1000);

  if (esp8266.available())
  {
    Serial.println("[ESP8266] Data available");

    if (esp8266.find("+IPD,"))
    {
      Serial.println("[ESP8266] HTTP request detected");

      delay(1000);

      int connectionId = esp8266.read() - 48;

      Serial.print("[ESP8266] Connection ID: ");
      Serial.println(connectionId);

      String webpage = "<h1>IOT Air Pollution Monitoring System</h1>";
      webpage += "<p><h2>";
      webpage += "Air Quality is ";
      webpage += air_quality;
      webpage += " PPM";
      webpage += "<p>";
      webpage += getAirStatus();
      webpage += "</h2></p></body>";

      Serial.print("[WEB] Webpage length: ");
      Serial.println(webpage.length());

      String cipSend = "AT+CIPSEND=";
      cipSend += connectionId;
      cipSend += ",";
      cipSend += webpage.length();
      cipSend += "\r\n";

      Serial.println("[ESP8266] Sending CIPSEND command");
      sendData(cipSend, 2000, DEBUG);

      Serial.println("[ESP8266] Sending webpage");
      sendData(webpage, 3000, DEBUG);

      String closeCommand = "AT+CIPCLOSE=";
      closeCommand += connectionId;
      closeCommand += "\r\n";

      Serial.println("[ESP8266] Closing connection");
      sendData(closeCommand, 3000, DEBUG);
    }
    else
    {
      Serial.println("[ESP8266] Data received but not HTTP +IPD request");
    }
  }
  else
  {
    Serial.println("[ESP8266] No incoming client request");
  }
}

void updateSensor()
{
  MQ135 gasSensor = MQ135(sensorPin);

  raw_adc = analogRead(sensorPin);
  sensor_voltage = raw_adc * (5.0 / 1023.0);
  air_quality = gasSensor.getPPM();

  Serial.println();
  Serial.println("---------- SENSOR READ ----------");

  Serial.print("[MQ135] Raw ADC: ");
  Serial.println(raw_adc);

  Serial.print("[MQ135] Voltage: ");
  Serial.print(sensor_voltage);
  Serial.println(" V");

  Serial.print("[MQ135] Air Quality: ");
  Serial.print(air_quality);
  Serial.println(" PPM");

  Serial.print("[STATUS] ");
  Serial.println(getAirStatus());
}

void updateBuzzer()
{
  if (air_quality <= 1000)
  {
    digitalWrite(buzzerPin, LOW);
    Serial.println("[BUZZER] OFF");
  }
  else if (air_quality > 1000 && air_quality <= 2000)
  {
    digitalWrite(buzzerPin, HIGH);
    Serial.println("[BUZZER] ON - Poor Air");
  }
  else
  {
    digitalWrite(buzzerPin, HIGH);
    Serial.println("[BUZZER] ON - Danger Air");
  }
}

void displayAirQuality()
{
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Air Quality");

  lcd.setCursor(0, 1);
  lcd.print(getAirStatus());

  Serial.println("[LCD] Screen 1: Air Quality Status");
}

void displaySensorParameter()
{
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("PPM:");
  lcd.print(air_quality, 1);

  lcd.setCursor(0, 1);
  lcd.print("ADC:");
  lcd.print(raw_adc);
  lcd.print(" V:");
  lcd.print(sensor_voltage, 1);

  Serial.println("[LCD] Screen 2: Sensor Parameter");
}

const char *getAirStatus()
{
  if (air_quality <= 1000)
  {
    return "Fresh Air";
  }
  else if (air_quality > 1000 && air_quality <= 2000)
  {
    return "Poor Air";
  }
  else
  {
    return "Danger Air";
  }
}

String sendData(String command, const int timeout, boolean debug)
{
  String response = "";

  Serial.println();
  Serial.println("---------- ESP COMMAND ----------");
  Serial.print("[SEND] ");
  Serial.print(command);

  esp8266.print(command);

  long int time = millis();

  while ((time + timeout) > millis())
  {
    while (esp8266.available())
    {
      char c = esp8266.read();
      response += c;
    }
  }

  if (debug)
  {
    Serial.println("[RESPONSE]");
    if (response.length() > 0)
    {
      Serial.println(response);
    }
    else
    {
      Serial.println("No response from ESP8266");
    }
  }

  Serial.println("---------- END COMMAND ----------");

  return response;
}