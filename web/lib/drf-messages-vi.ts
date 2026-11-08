// Vietnamese for the DRF messages that DRF's own Vietnamese catalog leaves in English. Django answers in the page's
// language (the X-UI-Lang header, else the `lang` cookie; backend/core/middleware.py), so this only runs on
// Vietnamese pages (lib/labels.ts).
// i18n-ignore-file: this file is a translation itself (English -> Vietnamese)

const drfMessages: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^This field is required\.$/, () => 'Trường này là bắt buộc.'],
  [/^This field may not be null\.$/, () => 'Trường này không được để trống.'],
  [/^This field may not be blank\.$/, () => 'Trường này không được bỏ trống.'],
  [/^This list may not be empty\.$/, () => 'Danh sách này không được rỗng.'],
  [/^Ensure this field has no more than (\d+) characters\.$/, (m) => `Tối đa ${m[1]} ký tự.`],
  [/^Ensure this field has at least (\d+) characters\.$/, (m) => `Ít nhất ${m[1]} ký tự.`],
  [/^Ensure this value is less than or equal to (-?[\d.]+)\.$/, (m) => `Giá trị phải nhỏ hơn hoặc bằng ${m[1]}.`],
  [/^Ensure this value is greater than or equal to (-?[\d.]+)\.$/, (m) => `Giá trị phải lớn hơn hoặc bằng ${m[1]}.`],
  [/^Ensure that there are no more than (\d+) digits in total\.$/, (m) => `Tối đa ${m[1]} chữ số.`],
  [/^Ensure that there are no more than (\d+) decimal places\.$/, (m) => `Tối đa ${m[1]} chữ số thập phân.`],
  [/^Ensure that there are no more than (\d+) digits before the decimal point\.$/, (m) => `Tối đa ${m[1]} chữ số phần nguyên.`],
  [/^A valid integer is required\.$/, () => 'Cần một số nguyên.'],
  [/^A valid number is required\.$/, () => 'Cần một số.'],
  [/^Must be a valid boolean\.$/, () => 'Cần giá trị đúng hoặc sai.'],
  [/^Enter a valid URL\.$/, () => 'Nhập một URL hợp lệ.'],
  [/^Enter a valid email address\.$/, () => 'Nhập một địa chỉ email hợp lệ.'],
  [/^"(.*)" is not a valid choice\.$/, (m) => `"${m[1]}" không phải lựa chọn hợp lệ.`],
  [/^Invalid pk "(.*)" - object does not exist\.$/, (m) => `Không tìm thấy mục #${m[1]}.`],
  [/^Expected a list of items but got type "(.*)"\.$/, () => 'Cần một danh sách.'],
  [/^Date has wrong format\..*$/, () => 'Ngày sai định dạng, dùng YYYY-MM-DD.'],
  [/^Datetime has wrong format\..*$/, () => 'Thời điểm sai định dạng.'],
  [/^.* with this .* already exists\.$/, () => 'Đã có một mục như vậy.'],
];

/** The Vietnamese of one DRF message; unknown and already-Vietnamese messages pass through unchanged. */
export function drfMessageVi(text: string): string {
  for (const [re, to] of drfMessages) {
    const m = text.match(re);
    if (m) return to(m);
  }
  return text;
}
