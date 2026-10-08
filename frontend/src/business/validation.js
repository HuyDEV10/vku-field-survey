export const categories = {
  HARDWARE: 'Máy tính / Phần cứng',
  PROJECTOR: 'Máy chiếu',
  AC: 'Điều hòa',
  ELECTRICAL: 'Điện',
  FURNITURE: 'Nội thất',
};
export function validate(d, step = 3) {
  if (!d.building?.trim() || d.building.length > 100) return 'Nhập tòa nhà, tối đa 100 ký tự.';
  if (
    !Number.isInteger(Number(d.floor)) ||
    d.floor === '' ||
    Number(d.floor) < -5 ||
    Number(d.floor) > 100
  )
    return 'Nhập tầng từ -5 đến 100.';
  if (!d.room?.trim() || d.room.length > 30) return 'Nhập phòng, tối đa 30 ký tự.';
  if (step === 1) return '';
  if (!categories[d.category]) return 'Chọn loại thiết bị.';
  if (!Number.isInteger(Number(d.rating)) || d.rating < 1 || d.rating > 5)
    return 'Chọn đánh giá từ 1 đến 5 sao.';
  if (d.notes?.length > 2000) return 'Ghi chú tối đa 2.000 ký tự.';
  if (d.rating <= 2 && !d.notes?.trim()) return 'Cần mô tả lỗi khi đánh giá 1–2 sao.';
  return '';
}
