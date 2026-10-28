# Smart Garden API

Base URL: `http://localhost:8080/api/v1`. JSON thành công: `{ "success": true, "data": ... }`; lỗi: `{ "success": false, "error": "..." }`.

Các route và dữ liệu trả về giống nhau khi dùng `STORAGE_DRIVER=mysql` hoặc `sqlite`. `/health` có thêm `data.storage` để biết chế độ đang chạy. SQLite lưu file cục bộ; không cần cài MySQL hay chạy db:init. Hai chế độ không tự đồng bộ dữ liệu.

Đăng nhập lấy `data.token`. Các API dành cho giao diện cần header `Authorization: Bearer <token>`. JWT hết hạn sau 24 giờ. Đăng xuất hoặc đổi mật khẩu thu hồi tất cả phiên tài khoản. Không có mật khẩu/tài khoản demo mặc định.

| Method | Path | Body/query | Quyền |
| --- | --- | --- | --- |
| GET | `/health` | Kiểm tra DB/MQTT | Công khai |
| POST | `/auth/register` | `{username,password,confirm,name,email}` | Khi ALLOW_REGISTRATION=true |
| POST | `/auth/login` | `{username,password}` | Công khai, giới hạn tần suất |
| POST | `/auth/logout` | Không body | JWT |
| GET | `/users/me` | Trả `{id,username,profile}` | JWT |
| PUT | `/profile` | Các trường hồ sơ cần sửa | JWT |
| PATCH | `/profile/password` | `{old_password,new_password}` | JWT |
| GET | `/sensors/latest?limit=15` | Số mốc đo, mỗi mốc 3 bản ghi | JWT |
| GET | `/sensors` | `type,from,to,page,limit,sort,by,q` | JWT |
| POST | `/sensors` | `{temperature,humidity,light}` hoặc `{temp,humid,light}` | X-Internal-Key |
| GET | `/devices` | `{devices:[...],status:{online,brokerConnected,lastSensorAt,busy,...}}` | JWT |
| POST | `/devices/control` | `{led1:"on"}` / `{led2:"off"}` / cả hai | JWT |
| PATCH | `/devices/status` | `{led1:"on"}`; chỉ nhận nếu đang chờ ACK khớp | X-Internal-Key |
| GET | `/actions` | `device,action,result,from,to,q,page,limit,sort` | JWT |
| POST | `/auth/forgot` | `{account}` | Trả 501 vì chưa cấu hình email |

`X-Internal-Key` lấy từ `.env`, chỉ dành cho bộ nhận dữ liệu nội bộ/Postman kiểm thử. Giao diện không biết khóa này. Luồng MQTT bình thường gọi thẳng service, không cần gọi ngược API nội bộ.

## Cảm biến và lịch sử

`page` bắt đầu từ 1, `limit` tối đa 100, `sort=asc|desc`. Nếu page vượt cuối, trả trang cuối. Khi rỗng, `total_pages=1`, `items=[]`. Thời gian DB lưu UTC; nhận bộ lọc ISO8601 có timezone hoặc `yyyy-MM-dd HH:mm:ss` được hiểu là giờ Việt Nam.

`/sensors`: `type=all|temperature|humidity|light`; `by=time|temperature|humidity|light`; `q` tìm một phần thời gian/giá trị như giao diện cũ. `by` chỉ có tác dụng khi `q` khác rỗng; `type` lọc loại cảm biến độc lập. `latest.limit` là **số mốc**, khác `sensors.limit` là **số hàng**. Mặc định latest=15 mốc để giữ biểu đồ 15 điểm hiện tại; tối đa trả 45 hàng nếu đã đủ dữ liệu.

```json
{
  "success": true,
  "data": {
    "items": [{"id": 1, "type": "temperature", "value": 27.5, "ts": 1793145600000, "measured_at": "2026-10-28T00:00:00.000Z"}],
    "pagination": {"total": 1, "page": 1, "limit": 10, "total_pages": 1}
  }
}
```

`/actions`: `device=all|pump|light|led1|led2`, `action=on|off`, `result=pending|success|failed|timeout`. Một item gồm `{id,device,action,result,user,sentAt,respondedAt,reason}`. Timestamps `ts/sentAt/respondedAt` là milliseconds; `respondedAt=null` nếu chưa nhận phản hồi.

## Thiết bị

`led1` → `pump` → GPIO13; `led2` → `light` → GPIO14. API điều khiển chờ đến khi nhận ACK hoặc timeout, trả mảng kết quả các lệnh đã thực hiện. Hai thiết bị trong một body được chạy lần lượt; nếu lệnh đầu lỗi thì lệnh sau chưa được gửi.

- 200: tất cả lệnh đã gửi thành công và nhận ACK.
- 400: giá trị không phải on/off; 404: thiết bị không tồn tại.
- 409: đang có yêu cầu khác chờ phản hồi.
- 503: mất kết nối, không publish được, hoặc không lưu được kết quả.
- 504: hết thời gian chờ; `data` vẫn chứa lệnh timeout để frontend hiện lịch sử.

`current_status` là on/off/null. Null nghĩa là chưa xác định, không đồng nghĩa đang tắt. Backend không suy ra trạng thái output từ gói cảm biến vì gói đó không chứa trạng thái LED.

## Hồ sơ

`profile` trả các trường giao diện: `name,studentId,className,email,avatar,github,figma,postman,report`. PUT cũng chấp nhận tên trường theo báo cáo: `full_name,student_id,class_name,avatar_url,github_link,figma_link,postman_link,report_link`. Avatar là data URL JPG/PNG/WebP dưới 500.000 ký tự, được frontend thu nhỏ; chưa nhận URL ảnh bên ngoài. Các liên kết chỉ nhận http/https.

## WebSocket

Kết nối `ws://localhost:8080/ws`, gửi trong 5 giây:

```json
{"type":"auth","token":"JWT lấy từ login"}
```

Chỉ sau xác thực mới nhận sự kiện `{type,data}`: `ready`, `sensors`, `command`, `devices`, `status`. `sensors` gồm 3 bản ghi vừa lưu; `command` phát lúc pending và lúc hoàn tất. Client tải lại latest/devices/actions sau khi socket kết nối lại. Token không được truyền trong query URL. Socket đóng mã `4401` khi phiên không hợp lệ.

## Khác biệt có chủ đích so với báo cáo

- Dùng ESP8266 và chuỗi MQTT theo firmware thực tế thay vì mẫu JSON/ESP32 trong báo cáo.
- Ánh sáng DO 0/1 thay lux, không tạo giá trị lux giả.
- `device_log.result` có pending/success/failed/timeout để phân biệt đang chờ, lỗi và mất phản hồi.
- Thiết bị có trạng thái chưa xác định; không báo đang tắt khi chưa biết.
- Đăng ký được thêm để giữ chức năng có sẵn trên giao diện; email khôi phục chưa được tích hợp.
- API profile/device có cấu trúc được mô tả ở trên; dùng bộ Postman đi kèm thay vì chép nguyên response ví dụ trong báo cáo.

Thư viện tham khảo: [Express 5 xử lý lỗi async](https://expressjs.com/en/5x/guide/error-handling/), [MySQL2 prepared statements](https://sidorares.github.io/node-mysql2/docs/documentation/prepared-statements), [MQTT.js](https://github.com/mqttjs/MQTT.js).
