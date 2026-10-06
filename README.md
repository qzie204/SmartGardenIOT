# Smart Garden — giao diện đã chỉnh sửa

## Mở website

1. Giải nén toàn bộ ZIP bằng **Extract All / Giải nén tất cả**.
2. Trong thư mục `smart-garden-web`, nhấp đúp **index.html** để mở bằng Chrome hoặc Edge.
3. Bấm **Đăng ký ngay** để tạo tài khoản, sau đó đăng nhập. Có thể dùng tài khoản có sẵn **demo**, mật khẩu **demo123**.

Không cần cài Node.js, build, máy chủ hay Internet. Giữ nguyên các thư mục `assets`, `css`, `js` cạnh `index.html`.

## Những thay đổi trong bản này

- Đã bỏ nút **Làm mới** ở Nhật ký điều khiển và **Xuất CSV** ở Dữ liệu cảm biến. Nhật ký vẫn tự cập nhật khi có lệnh mới.

- Đã bỏ khối tài khoản demo và chú thích ở trang đăng nhập, hộp demo ở thanh bên, trạng thái demo/thời gian cập nhật ở đầu trang, phần hoạt động gần đây cùng chú thích ở Tổng quan, bốn thẻ thống kê và dòng thời gian làm mới ở Lịch sử.
- Trang đăng nhập có liên kết **Đăng ký ngay**. Biểu mẫu đăng ký gồm họ tên, email, tài khoản, mật khẩu và nhập lại mật khẩu; kiểm tra thông tin còn thiếu, định dạng, độ dài và tài khoản/email trùng.
- Ba thẻ cảm biến trên Tổng quan chỉ còn tên, biểu tượng, giá trị và đơn vị. Đã bỏ biểu đồ nhỏ, thay đổi so với lần trước và tab so sánh. Biểu đồ chính vẫn có ba tab cảm biến riêng.
- Hồ sơ có **Thêm ảnh**, **Đổi ảnh**, **Xóa ảnh**. Nhận JPG, PNG hoặc WebP, tối đa 5 MB; ảnh được cắt vuông ở giữa và thu nhỏ trước khi lưu. Ảnh hiển thị đồng bộ ở hồ sơ, thanh bên và góc trên.
- Thông tin và ảnh hồ sơ được lưu riêng theo tài khoản trên trình duyệt hiện tại. Tài khoản mới lấy họ tên và email từ biểu mẫu đăng ký; hồ sơ demo mặc định để trống.
- Giữ lại sửa hồ sơ, liên kết dự án, bảng dữ liệu, sắp xếp, phân trang, chi tiết lịch sử và trạng thái chờ xác nhận lệnh điều khiển.

## Tìm kiếm dữ liệu cảm biến

Dropdown **Tìm theo** xác định phạm vi của ô **Từ khóa**. Đây không phải bộ chọn từng loại cảm biến.

| Chế độ | Phạm vi tìm kiếm | Ví dụ |
| --- | --- | --- |
| Tất cả | Tên cảm biến hoặc thời gian; có thể kết hợp cả hai | `nhiệt độ`, `06/10/26`, `nhiệt độ 06/10/26` |
| Cảm biến | Chỉ tìm tên cảm biến | `độ ẩm` có thể có kết quả; `06/10/26` không có kết quả |
| Thời gian | Chỉ tìm ngày/giờ ghi nhận | `06/10/2026`, `14:32`; `nhiệt độ` không có kết quả |

Tìm tên hỗ trợ tiếng Việt không dấu. Ngày chấp nhận năm hai hoặc bốn chữ số. Không tìm theo giá trị đo. **Xóa lọc** đưa chế độ về Tất cả và xóa từ khóa. Thời gian hiển thị theo Việt Nam (UTC+7).

## Năm file HTML dành cho Figma

Trong thư mục **figma/**:

| File | Nội dung |
| --- | --- |
| `01-dang-nhap.html` | Hai màn hình đặt dọc: Đăng nhập, sau đó Đăng ký |
| `02-tong-quan.html` | Tổng quan, giá trị cảm biến, biểu đồ và thiết bị |
| `03-du-lieu-cam-bien.html` | Dữ liệu cảm biến với bộ lọc mới |
| `04-lich-su-dieu-khien.html` | Nhật ký điều khiển |
| `05-ho-so.html` | Hồ sơ với khu vực thêm ảnh |

Mỗi file là một bản thiết kế tĩnh độc lập, rộng **1440 px**, đã nhúng CSS, font Be Vietnam Pro và icon SVG. Nội dung bảng và biểu đồ đã có sẵn trong HTML; không cần JavaScript hay tài nguyên bên ngoài để hiển thị. Có thể dùng các file này với công cụ nhập HTML của bạn trong Figma. Font có trong `assets/fonts/` nếu công cụ nhập cần nhận diện font riêng.

Các nút trong bản xuất tĩnh chỉ thể hiện giao diện. Để thử đăng ký, tải ảnh, tìm kiếm hoặc điều khiển, mở **index.html** ở thư mục gốc. Đã kiểm tra các HTML hiển thị khi tắt JavaScript; chưa kiểm tra thao tác nhập trực tiếp trong Figma.

## Dữ liệu và tài khoản

Đây là prototype giao diện chạy cục bộ, chưa nối backend, cơ sở dữ liệu hoặc thiết bị thật. Dữ liệu cảm biến giả lập cập nhật mỗi 5 giây, tối đa 600 bản ghi trong bộ nhớ phiên. Tải lại trang tạo lại dữ liệu cảm biến và nhật ký mẫu.

Tài khoản mới, ảnh và hồ sơ lưu trong trình duyệt trên máy đang dùng; chưa đồng bộ sang trình duyệt hoặc máy khác. Mật khẩu đăng ký được băm PBKDF2 cùng salt riêng, không lưu mật khẩu dạng văn bản. Tuy vậy, xác thực và phiên đăng nhập vẫn chạy phía trình duyệt; cần backend để bảo vệ hệ thống thật. Xóa dữ liệu trình duyệt có thể xóa tài khoản và hồ sơ đã lưu. Luồng quên mật khẩu chỉ mô phỏng, không gửi email hoặc đặt lại mật khẩu.

Điều khiển chỉ đổi trạng thái sau khi nhận phản hồi thành công từ lớp mô phỏng. Các trạng thái từ chối, hết thời gian chờ và mất kết nối vẫn được xử lý. Khi tích hợp phần cứng, thay `js/api.js` bằng lớp gọi backend và cấu hình đúng đơn vị cảm biến trong `js/config.js`.

## Cấu trúc mã nguồn

- `css/tokens.css`: màu, font, bo góc, khoảng cách.
- `css/base.css`, `components.css`, `layout.css`, `pages.css`: thành phần, bố cục và từng trang.
- `js/config.js`: cảm biến, thiết bị, hồ sơ mặc định.
- `js/api.js`: tài khoản cục bộ, dữ liệu và thiết bị mô phỏng.
- `js/auth.js`: đăng nhập, đăng ký, khôi phục và phiên đăng nhập.
- `js/home.js`, `data.js`, `history.js`, `profile.js`: logic từng trang.
- `js/ui.js`, `app.js`, `util.js`: biểu đồ, hộp thoại, điều hướng và tiện ích.
- `assets/`: font, icon và biểu tượng cục bộ.
- `figma/`: năm HTML độc lập dành cho bản thiết kế.

## Đã kiểm tra

Đã thử trên Chromium khi mở trực tiếp `index.html`: đăng ký hợp lệ/không hợp lệ, tài khoản trùng, đăng nhập lại, lưu phiên, ảnh không hợp lệ/quá dung lượng, lưu và xóa ảnh, hồ sơ riêng theo tài khoản, phạm vi tìm kiếm, điều khiển chờ phản hồi và các phần cần loại bỏ. Đã kiểm tra bố cục ở 1440, 1024, 390 và 320 px; không có lỗi JavaScript hoặc yêu cầu tài nguyên Internet trong phiên kiểm tra.

`XEM-TRUOC.png` là ảnh Tổng quan của bản này. Chưa kiểm tra trên phần cứng thật, Safari hoặc Firefox.
