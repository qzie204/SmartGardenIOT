# Chạy Smart Garden trên Windows

Mở dự án tại `D:\Code\SmartGarden`. Backend chạy Node.js, lưu MySQL, trao đổi với ESP8266 qua MQTT và phục vụ luôn giao diện ở `http://localhost:8080`. Không dùng Live Server hoặc mở trực tiếp `index.html` khi chạy bản backend.

## Chạy ngay khi chưa cài MySQL

Dùng SQLite, không cần cài thêm database server. Máy hiện tại đã có Node.js 24 hỗ trợ chế độ này. Trong `.env` đặt:

```dotenv
STORAGE_DRIVER=sqlite
SQLITE_FILE=data/smart-garden.sqlite
```

Sau đó chỉ cần:

```powershell
cd D:\Code\SmartGarden
npm start
```

Mở **http://localhost:8080**, đăng ký rồi đăng nhập. Không cần chạy `npm run db:init` ở chế độ SQLite; backend tự tạo bảng. Tài khoản, hồ sơ, dữ liệu cảm biến và lịch sử được lưu bền tại `data/smart-garden.sqlite`. Giữ thư mục `data` để không mất dữ liệu. Muốn sao lưu, dừng backend rồi sao chép cả thư mục `data`.

MQTT vẫn nhận dữ liệu thật từ ESP8266, không sinh số ngẫu nhiên. Nếu broker chưa kết nối thì giao diện vẫn mở được, nhưng công tắc bị khóa và không có phép đo mới. Chỉ chạy một backend cho mỗi file SQLite; backend tự nhả khóa khi dừng hoặc bị tắt đột ngột. Cần Node.js 22.16 trở lên; khuyến nghị dùng bản 24 đang có trên máy. SQLite được cung cấp sẵn qua [node:sqlite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).

Khi cài được MySQL, làm các bước bên dưới, đặt `STORAGE_DRIVER=mysql`, điền DB credentials, chạy `npm run db:init` rồi `npm start`. **Hai chế độ dùng kho dữ liệu riêng; đổi chế độ không tự chuyển tài khoản/lịch sử sang MySQL.** File SQLite cũ vẫn được giữ. Nếu cần chuyển dữ liệu phải có bước nhập/xuất riêng.

## 1. Cài MySQL lần đầu

1. Tải **MySQL Community Server 8.4 LTS**, chọn Windows và bộ cài MSI tại [trang MySQL](https://dev.mysql.com/downloads/mysql/). Cài thêm [MySQL Workbench](https://dev.mysql.com/downloads/workbench/) nếu muốn thao tác bằng giao diện.
2. Chạy MSI, sau đó dùng MySQL Configurator: chọn Development Computer, TCP/IP cổng `3306`, đặt mật khẩu tài khoản `root` và ghi nhớ mật khẩu đó.
3. Cho MySQL chạy dưới dạng Windows Service và tự khởi động cùng Windows. Máy chỉ chạy ứng dụng cục bộ thì không cần mở cổng MySQL ra mạng LAN.
4. Mở Workbench, tạo kết nối `127.0.0.1`, port `3306`, user `root`. Mở một SQL tab rồi chạy đoạn dưới. **Thay `TU_DAT_MAT_KHAU_DB` bằng mật khẩu riêng của bạn**, giữ lại để điền `.env`.

```sql
CREATE DATABASE smart_garden CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'smartgarden'@'localhost' IDENTIFIED BY 'TU_DAT_MAT_KHAU_DB';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES
ON smart_garden.* TO 'smartgarden'@'localhost';
```

Nếu không dùng Workbench, mở PowerShell và chạy MySQL client (sửa đường dẫn nếu cài ở chỗ khác):

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -p
```

Nhập mật khẩu root rồi dán ba câu SQL trên. User `smartgarden` chỉ dùng cho ứng dụng; không cần dùng tài khoản root trong backend. Nếu database/user đã tồn tại thì kiểm tra và dùng lại, không xóa database để cài lại.

Tham khảo quy trình MSI và Configurator trong [tài liệu cài MySQL cho Windows](https://dev.mysql.com/doc/refman/8.4/en/windows-installation.html).

## 2. Cấu hình dự án

Cần Node.js 22 trở lên. Trong terminal của VS Code/PowerShell:

```powershell
cd D:\Code\SmartGarden
node --version
npm install
npm run setup
notepad .env
```

`npm run setup` tạo `.env`, tự sinh `JWT_SECRET` và `INTERNAL_API_KEY`. Nếu file đã tồn tại, lệnh giữ nguyên file. Hai khóa này không được đưa vào frontend hoặc commit lên Git.

Điền các giá trị sau trong `.env`:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=smart_garden
DB_USER=smartgarden
DB_PASSWORD="mật khẩu smartgarden đã tạo ở bước 1"
MQTT_URL=mqtt://172.20.10.2:1884
MQTT_USERNAME="tài khoản broker bạn đã cấu hình"
MQTT_PASSWORD="mật khẩu broker bạn đã cấu hình"
ALLOW_REGISTRATION=true
```

Giữ nguyên các topic `Qzie204/garden/...` để khớp firmware. Nếu máy chạy broker có IP khác thì sửa `MQTT_URL` và `MQTT_HOST` trong firmware. Địa chỉ `172.20.10.2` chỉ đúng khi đó là IP máy chạy broker trên mạng hiện tại; kiểm tra bằng `ipconfig`.

Sau khi lưu `.env`:

```powershell
npm run db:init
npm start
```

`db:init` tạo bảng và danh mục hai thiết bị, ba loại cảm biến. Lệnh không tạo tài khoản mặc định hoặc phép đo giả. Với database do phiên bản này tạo, chạy lại không xóa dữ liệu. Đây chưa phải công cụ nâng cấp schema cho database từ dự án khác.

Mở **http://localhost:8080**, bấm **Đăng ký** để tạo tài khoản, sau đó đăng nhập. Mật khẩu ít nhất 8 ký tự, tối đa 72 byte UTF-8. Tài khoản demo cũ lưu trong trình duyệt không phải tài khoản MySQL; hãy đăng ký lại. Sau khi đã có đủ tài khoản có thể đặt `ALLOW_REGISTRATION=false` và khởi động lại backend.

Khi chưa bật ESP8266/MQTT, bạn vẫn đăng nhập và xem lịch sử đã lưu được. Cảm biến mới chưa có dữ liệu, công tắc hiện mất kết nối. Đây là trạng thái bình thường.

## 3. MQTT broker

Nếu broker ở `172.20.10.2:1884` đã hoạt động, dùng lại broker đó và bỏ qua phần cài mới. Backend là **MQTT client**, không tự tạo broker khi chạy `npm start`.

Nếu chưa có broker, cài [Eclipse Mosquitto cho Windows](https://mosquitto.org/download/). Hướng dẫn dưới dùng cấu hình password file được mô tả trong [tài liệu Mosquitto](https://mosquitto.org/documentation/authentication-methods/) và [mosquitto.conf](https://mosquitto.org/man/mosquitto-conf-5.html).

Tạo thư mục cấu hình riêng ngoài source, ví dụ `D:\SmartGardenMqtt`. Mở PowerShell:

```powershell
New-Item -ItemType Directory -Force D:\SmartGardenMqtt
& "C:\Program Files\mosquitto\mosquitto_passwd.exe" -c "D:\SmartGardenMqtt\passwords" TEN_TAI_KHOAN_MQTT
```

Thay `TEN_TAI_KHOAN_MQTT` bằng tài khoản bạn muốn dùng. Lệnh hỏi mật khẩu, không cần gõ mật khẩu vào câu lệnh. Tài khoản/mật khẩu phải giống `.env` và `firmware/SmartGarden/config.h`. Chỉ dùng `-c` khi tạo file mới; dùng lại `-c` sẽ ghi đè danh sách tài khoản cũ.

Tạo `D:\SmartGardenMqtt\mosquitto.conf`:

```conf
listener 1884 0.0.0.0
allow_anonymous false
password_file D:/SmartGardenMqtt/passwords
persistence false
log_dest stdout
```

Chạy broker ở một terminal riêng và giữ terminal đó mở:

```powershell
& "C:\Program Files\mosquitto\mosquitto.exe" -c "D:\SmartGardenMqtt\mosquitto.conf" -v
```

Nếu Windows hỏi quyền mạng, chỉ cho phép mạng riêng mà máy và ESP8266 đang sử dụng. Nếu thiết bị chưa kết nối được, kiểm tra firewall TCP `1884` và cả hai cùng WiFi/hotspot. Cấu hình này dành cho phòng lab trên mạng tin cậy; khi đưa ra Internet cần TLS và phân quyền topic. Nếu Mosquitto đã chạy dưới dạng service, kiểm tra cổng/cấu hình hiện tại để tránh chạy hai broker trùng cổng.

## 4. Nạp firmware ESP8266

1. Dùng Arduino IDE với board package ESP8266; cài thư viện PubSubClient, DHT sensor library và Adafruit Unified Sensor.
2. Mở `firmware/SmartGarden/SmartGarden.ino`.
3. Sao chép `config.example.h` thành `config.h` cùng thư mục; điền WiFi và MQTT.
4. Giữ chân theo mã đã gửi: DHT GPIO5, LED1 GPIO13, LED2 GPIO14, ánh sáng DO GPIO4. Đây là số GPIO; tên `D1`, `D2`... trên board có thể khác số này.
5. Chọn board/cổng COM phù hợp, biên dịch và nạp. Mở Serial Monitor `115200`.

Mẫu đã sửa lỗi `#define DHT_TYPE DHT11 =` thành `#define DHT_TYPE DHT11`, giữ nguyên chuỗi lệnh và topic của bạn. LED1 ánh xạ máy bơm, LED2 ánh xạ đèn theo báo cáo; hiện phần cứng là LED mô phỏng thiết bị.

Firmware gửi mỗi 2 giây:

```json
{"temperature":27.5,"humidity":65,"light":1}
```

`light` lấy từ `digitalRead`, nên chỉ có `0/1`, đơn vị **DO**, chưa phải lux. Chưa suy diễn `0` là sáng hay tối vì phụ thuộc module và ngưỡng chỉnh trên cảm biến.

## 5. Mỗi lần chạy sau

1. Đảm bảo dịch vụ MySQL đang chạy.
2. Bật MQTT broker nếu chưa chạy như một service.
3. Bật ESP8266, kiểm tra Serial Monitor nhận WiFi/MQTT và gửi cảm biến.
4. Trong thư mục dự án chạy `npm start`.
5. Mở `http://localhost:8080`, đăng nhập. Bấm công tắc, chờ ESP8266 phản hồi.

Nhấn `Ctrl+C` ở terminal backend để dừng. Khi sửa backend có thể dùng `npm run dev` để Node tự khởi động lại. Không chạy `start` và `dev` cùng lúc. Không cần chạy lại `db:init` sau mỗi lần mở máy.

## 6. Luồng chạy và vị trí code

```text
ESP8266 → MQTT sensors → mqtt-bridge.js → garden-service.js
        → repository.js → MySQL → WebSocket → js/api.js → chart.js/home.js

Công tắc → js/api.js → POST /devices/control → ghi pending vào MySQL
        → MQTT led1_on/led2_on → ESP8266 → *_ok
        → ghi success + trạng thái thiết bị → WebSocket → toast/giao diện
```

| File | Chức năng |
| --- | --- |
| `backend/src/server.js` | Khởi động HTTP, MySQL, MQTT, WebSocket |
| `backend/src/app.js` | Các route REST, kiểm tra đăng nhập và lỗi |
| `backend/src/auth-service.js` | JWT, bcrypt, tài khoản và hồ sơ |
| `backend/src/validation.js` | Kiểm tra JSON, cảm biến, bộ lọc |
| `backend/src/repository.js` | SQL có tham số, transaction, phân trang |
| `backend/src/garden-service.js` | Ánh xạ LED, chờ ACK, timeout, trạng thái thiết bị |
| `backend/src/mqtt-bridge.js` | Đăng ký topic, xử lý gói MQTT |
| `backend/src/websocket.js` | Xác thực socket và đẩy cập nhật |
| `backend/sql/schema.sql` | Cấu trúc bảng và danh mục ban đầu |
| `js/api.js` | Kết nối giao diện với backend |

Mỗi lần nhận một gói cảm biến, cả ba bản ghi được lưu trong cùng transaction và có cùng thời điểm. Ghi DB lỗi thì rollback, không phát dữ liệu mới lên WebSocket.

Lệnh điều khiển chỉ báo thành công khi nhận đúng chuỗi phản hồi. Sau 10 giây chưa nhận được thì ghi `timeout`; trạng thái thiết bị chuyển thành chưa xác định vì có thể lệnh đã chạy nhưng ACK thất lạc. Không tự gửi lại lệnh khi kết nối lại. Backend chỉ nhận một yêu cầu điều khiển tại một thời điểm; nếu gửi cả `led1` và `led2`, thực hiện lần lượt và dừng nếu một lệnh lỗi, không có rollback vật lý.

**Giới hạn giao thức hiện tại:** chuỗi `led1_on_ok` không có `command_id`. Backend bỏ ACK không khớp hoặc ACK khi không có lệnh chờ, nhưng không phân biệt được ACK cũ và mới nếu cùng một lệnh được gửi lại. Muốn xác nhận tuyệt đối từng lần gửi cần sửa cả firmware và backend sang JSON có `command_id`. Không có đồng bộ trạng thái đầu ra chủ động trong firmware hiện tại; lúc backend/ESP kết nối lại trạng thái hiển thị là chưa xác định cho đến khi có ACK mới. Chỉ chạy một backend và không dùng ứng dụng khác gửi lệnh vào cùng topic.

## 7. Kiểm thử và xử lý lỗi

```powershell
npm test
```

Test dùng broker MQTT riêng ở cổng ngẫu nhiên trên `127.0.0.1`, repository trong bộ nhớ và HTTP/WebSocket thật. Không dùng `.env` để điều khiển thiết bị thật. Bộ test này không thay thế kiểm thử SQL trên MySQL và nạp thử board.

| Hiện tượng | Kiểm tra |
| --- | --- |
| `ECONNREFUSED` khi khởi động | MySQL đã chạy chưa, đúng host/3306 chưa |
| `ER_ACCESS_DENIED_ERROR` | `DB_USER`, `DB_PASSWORD` và quyền user |
| `ER_BAD_DB_ERROR` | Đã tạo database `smart_garden` chưa |
| `ER_NO_SUCH_TABLE` | Chạy `npm run db:init` |
| Báo cấu hình `JWT_SECRET` | Chạy `npm run setup`, không dùng khóa placeholder |
| `EADDRINUSE` | Có chương trình khác chiếm cổng 8080; dừng tiến trình đó hoặc đổi PORT |
| MQTT liên tục lỗi | Broker, IP, 1884, user/password, firewall và topic |
| Cảm biến có số nhưng công tắc mất kết nối | Kiểm tra MQTT còn hoạt động; backend đánh offline sau 15 giây không có gói hợp lệ |
| Timeout | ESP đã subscribe đúng controlTopic chưa; kiểm tra responseTopic và chuỗi `*_ok` |
| Trang báo phản hồi không phải JSON | Đang mở nhầm Live Server; chuyển sang localhost:8080 |

Để kiểm tra SQL sau khi có phần cứng:

```sql
SELECT COUNT(*) FROM sensor_reading;
SELECT * FROM sensor_reading ORDER BY id DESC LIMIT 9;
SELECT * FROM device_log ORDER BY id DESC LIMIT 10;
SELECT id, name, current_status, confirmed_at FROM device;
```

Mỗi gói cảm biến thêm 3 hàng. Thử bật/tắt một thiết bị và đối chiếu trạng thái thật, ACK trên Serial Monitor, `device_log` và toast. Tắt ESP rồi chờ trên 15 giây để kiểm tra trạng thái offline.
