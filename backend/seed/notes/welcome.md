# Ghi chú đi cùng mã nguồn

Thư mục `backend/seed/notes/` chứa những ghi chú đi cùng mã nguồn: mỗi file markdown là một ghi chú của chủ sở hữu. Sau mỗi lần cài hoặc cập nhật, lệnh sau tạo hoặc cập nhật chúng trong cơ sở dữ liệu của máy đó:

```
python manage.py import_notes
```

Ghi chú được nhận ra theo dòng đầu tiên có chữ (tên của nó), nên sửa file rồi chạy lại là ghi chú được cập nhật. Các ghi chú khác không bị động tới. Ghi chú này là một ví dụ: xóa file đi là đủ để nó không được tạo trên máy mới.

Thử liên kết: [[Làm vườn]] mở trang của một Item nếu có Item tên đó.
