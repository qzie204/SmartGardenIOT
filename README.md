# Smart Garden

Giao diện HTML/CSS/JavaScript kết nối backend Node.js/Express, MySQL, MQTT và WebSocket. Backend dùng giao thức của ESP8266 đã cung cấp; không tự sinh phép đo hoặc kết quả điều khiển.

## Cách chạy

**Chưa có MySQL:** đặt `STORAGE_DRIVER=sqlite` trong `.env`, rồi chạy `npm.cmd start`. Backend tự tạo file `data/smart-garden.sqlite`, vẫn nhận cảm biến thật qua MQTT và giữ dữ liệu sau khi tắt. Không cần `db:init`. Chế độ đang dùng được quyết định bởi `STORAGE_DRIVER` trong `.env`. Xem [hướng dẫn SQLite](docs/SETUP.md#chạy-ngay-khi-chưa-cài-mysql).

Đọc [hướng dẫn cài MySQL và MQTT trên Windows](docs/SETUP.md) trước khi chạy lần đầu.

```powershell
cd D:\Code\SmartGarden
npm install
npm run setup
# Điền DB_PASSWORD, MQTT_USERNAME và MQTT_PASSWORD trong .env
npm run db:init
npm start
```

Mở `http://localhost:8080`, đăng ký tài khoản rồi đăng nhập. Những lần sau chỉ cần MySQL/MQTT đang chạy và `npm start`. Không dùng Live Server cho bản backend. Không có tài khoản `demo/demo123` mặc định.

Xem [API](docs/API.md), [bộ Postman](docs/SmartGarden.postman_collection.json), [mẫu firmware](firmware/SmartGarden/SmartGarden.ino). `npm test` chạy kiểm thử qua broker MQTT riêng và repository thử nghiệm, không điều khiển phần cứng thật.

## Cấu trúc mã nguồn

- `css/tokens.css`: màu, font, bo góc, khoảng cách.
- `css/base.css`, `components.css`, `layout.css`, `pages.css`: thành phần, bố cục và từng trang.
- `js/config.js`: cảm biến, thiết bị, hồ sơ mặc định.
- `js/api.js`: gọi REST API, giữ phiên JWT, nhận WebSocket.
- `backend/src/`: route, kiểm tra dữ liệu, xác thực, service điều khiển, SQL và kết nối MQTT; `storage.js` chọn MySQL/SQLite.
- `backend/sql/schema.sql`: bảng MySQL và danh mục cảm biến/thiết bị.
- `backend/sql/schema-sqlite.sql`: bảng SQLite tự khởi tạo khi chưa cài MySQL.
- `backend/test/`: kiểm thử API, MQTT, WebSocket và transaction.
- `js/auth.js`: đăng nhập, đăng ký, khôi phục và phiên đăng nhập.
- `js/home.js`, `data.js`, `history.js`, `profile.js`: logic từng trang.
- `js/chart.js`: biểu đồ cảm biến SVG; gom dữ liệu theo thời gian, tính trục, tooltip và điều hướng bàn phím.
- `js/ui.js`, `app.js`, `util.js`: hộp thoại, điều hướng và tiện ích.
- `assets/`: font, icon và biểu tượng cục bộ.

Home mặc định hiển thị tab **Tất cả** với ba đường nhiệt độ, độ ẩm và ánh sáng. Biểu đồ lấy 15 mốc gần nhất từ MySQL và nhận cập nhật khi ESP8266 gửi dữ liệu (chu kỳ firmware 2 giây). Trục trái dành cho ánh sáng DO 0/1; trục phải dành cho nhiệt độ °C và độ ẩm %. Firmware dùng `digitalRead`, chưa đo lux. Tooltip chỉ hiện đường gần con trỏ; các nét vẽ liền và giao diện hiện tại được giữ nguyên. Thiếu dữ liệu tạo khoảng ngắt, không thay bằng 0. Phím lên/xuống đổi cảm biến; trái/phải và Home/End đổi mốc đo.

## Cách đọc và viết code

- Mỗi câu lệnh nằm trên một dòng; các nhánh `if`, vòng lặp và hàm đều có khối `{ }` rõ ràng.
- Hàm xử lý sự kiện có tên theo thao tác, ví dụ `handleLoginSubmit`, `clearFilters`, `openProfileEditor`.
- Tách việc lọc dữ liệu, dựng từng hàng HTML và cập nhật trang thành các hàm riêng.
- Những đoạn HTML dài được chia thành các phần rồi nối bằng `.join('')` để không thêm khoảng trắng làm đổi giao diện.
- Cấu hình cảm biến dùng `label` (tên), `unit` (đơn vị), `decimals` (số chữ số thập phân), `icon` và `color`.
- Các tiện ích dùng chung có tên rõ nghĩa: `SG.select`, `SG.renderIcon`, `SG.escapeHtml`, `SG.formatReading`, `SG.formatDateTime`, `SG.formatTime`.

Luồng trang dữ liệu: nhập bộ lọc → `applyFilters()` → `renderDataPage()` → `GET /sensors` → SQL lọc/phân trang → `renderTableBody()` → `renderReadingRow()`.

Luồng điều khiển: bấm công tắc → `SG.api.send()` → `POST /devices/control` → `GardenService.control()` → lưu pending → MQTT → ACK từ ESP8266 → lưu kết quả và trạng thái → WebSocket/HTTP cập nhật giao diện. Không nhận ACK sau 10 giây thì timeout. Giao thức chuỗi hiện tại không có mã lệnh nên vẫn có giới hạn phân biệt ACK muộn của hai lệnh giống nhau; xem giải thích trong SETUP.
