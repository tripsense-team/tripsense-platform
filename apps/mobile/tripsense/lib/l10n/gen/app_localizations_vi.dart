// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Vietnamese (`vi`).
class AppLocalizationsVi extends AppLocalizations {
  AppLocalizationsVi([String locale = 'vi']) : super(locale);

  @override
  String get appName => 'TripSense';

  @override
  String get commonRetry => 'Thử lại';

  @override
  String get commonCancel => 'Hủy';

  @override
  String get commonContinue => 'Tiếp tục';

  @override
  String get commonBack => 'Quay lại';

  @override
  String get commonLogout => 'Đăng xuất';

  @override
  String get commonLoading => 'Đang tải…';

  @override
  String get commonEmpty => 'Chưa có nội dung';

  @override
  String get navExplore => 'Khám phá';

  @override
  String get navTrips => 'Chuyến đi';

  @override
  String get navAiPlanner => 'Trợ lý AI';

  @override
  String get navCommunity => 'Cộng đồng';

  @override
  String get navProfile => 'Hồ sơ';

  @override
  String get comingSoon => 'Sắp ra mắt';

  @override
  String get errNetwork => 'Không có kết nối mạng. Vui lòng kiểm tra lại.';

  @override
  String get errTimeout => 'Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.';

  @override
  String get errUnauthorized =>
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

  @override
  String get errForbidden =>
      'Tài khoản của bạn chưa được kích hoạt hoặc đã bị tạm khóa.';

  @override
  String get errNotFound => 'Không tìm thấy nội dung bạn cần.';

  @override
  String get errConflict => 'Nội dung này đã tồn tại. Vui lòng kiểm tra lại.';

  @override
  String get errValidation => 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.';

  @override
  String get errRateLimited => 'Bạn thao tác quá nhanh. Vui lòng chờ một lát.';

  @override
  String get errServer => 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';

  @override
  String get errUnknown => 'Đã có lỗi xảy ra. Vui lòng thử lại.';

  @override
  String errIncident(String id) {
    return 'Mã tham chiếu: $id';
  }

  @override
  String get errBadCredentials => 'Email hoặc mật khẩu không chính xác.';

  @override
  String get errWebOnlyRole =>
      'Tài khoản này được quản lý trên website TripSense. Vui lòng đăng nhập tại đó.';

  @override
  String get authWelcomeTitle => 'Chào mừng đến TripSense';

  @override
  String get authWelcomeSubtitle => 'Lên kế hoạch du lịch thông minh cùng AI.';

  @override
  String get authLoginTitle => 'Đăng nhập';

  @override
  String get authEmail => 'Email';

  @override
  String get authPassword => 'Mật khẩu';

  @override
  String get authLoginButton => 'Đăng nhập';

  @override
  String get authNoAccount => 'Chưa có tài khoản?';

  @override
  String get authRegisterTitle => 'Tạo tài khoản';

  @override
  String get authRegisterButton => 'Tạo tài khoản';

  @override
  String get authHaveAccount => 'Đã có tài khoản?';

  @override
  String get authForgotPassword => 'Quên mật khẩu?';

  @override
  String get authForgotSubtitle =>
      'Nhập email, chúng tôi sẽ gửi mã 6 chữ số cho bạn.';

  @override
  String get authSendCode => 'Gửi mã';

  @override
  String get authResetTitle => 'Đặt lại mật khẩu';

  @override
  String get authNewPassword => 'Mật khẩu mới';

  @override
  String get authResetButton => 'Cập nhật mật khẩu';

  @override
  String get authResetDone => 'Đã cập nhật mật khẩu. Vui lòng đăng nhập.';

  @override
  String get authVerifyTitle => 'Xác minh email';

  @override
  String authVerifySubtitle(String email) {
    return 'Nhập mã 6 chữ số đã gửi tới $email.';
  }

  @override
  String get authOtpCode => 'Mã 6 chữ số';

  @override
  String get authVerifyButton => 'Xác minh';

  @override
  String get authResendCode => 'Gửi lại mã';

  @override
  String get authCodeSent => 'Đã gửi mã mới.';

  @override
  String get authVerified => 'Đã xác minh email. Vui lòng đăng nhập.';

  @override
  String get validationRequired => 'Vui lòng nhập thông tin này';

  @override
  String get validationEmail => 'Email không hợp lệ';

  @override
  String validationPasswordMin(int min) {
    return 'Mật khẩu tối thiểu $min ký tự';
  }

  @override
  String get validationOtp => 'Nhập đủ mã 6 chữ số';

  @override
  String get onbEyebrow => 'Cá nhân hóa TripSense';

  @override
  String onbProgress(int current, int total) {
    return 'Bước $current / $total';
  }

  @override
  String get onbSkip => 'Bỏ qua lúc này';

  @override
  String get onbFinish => 'Hoàn tất';

  @override
  String get onbSaving => 'Đang lưu…';

  @override
  String get onbLoadRetry => 'Không tải được thiết lập của bạn. Hãy thử lại.';

  @override
  String get onbNameTitle => 'Chúng tôi nên gọi bạn là gì?';

  @override
  String get onbNameHint => 'Tên hiển thị của bạn';

  @override
  String get onbHomeTitle => 'Bạn hiện đang sinh sống tại đâu?';

  @override
  String get onbHomeSubtitle =>
      'Thông tin này giúp gợi ý các chuyến đi và điểm xuất phát phù hợp.';

  @override
  String get onbHomeHint => 'Tìm hoặc chọn thành phố của bạn…';

  @override
  String get onbVisitedTitle => 'Bạn đã từng du lịch ở những đâu?';

  @override
  String get onbVisitedSubtitle =>
      'Chọn những nơi bạn đã từng ghé thăm để AI ưu tiên gợi ý các trải nghiệm mới.';

  @override
  String get onbBucketTitle => 'Điểm đến trong mơ tiếp theo của bạn?';

  @override
  String get onbBucketSubtitle =>
      'Những nơi bạn đang ấp ủ muốn đến. AI sẽ ưu tiên xây dựng lịch trình phù hợp.';

  @override
  String get onbPlacesHint => 'Tìm hoặc gõ địa điểm khác…';

  @override
  String onbPlacesAdd(String name) {
    return 'Thêm \"$name\"';
  }

  @override
  String get onbPlacesMax => 'Tối đa 20 địa điểm cho mỗi nhóm.';

  @override
  String onbPlacesSelected(int count) {
    return 'Đã chọn $count địa điểm';
  }

  @override
  String get onbPartyTitle => 'Bạn thường đi du lịch cùng ai?';

  @override
  String get onbPartySubtitle =>
      'Thông tin này giúp gợi ý phù hợp với nhịp đi của bạn.';

  @override
  String get onbBudgetTitle =>
      'Bạn dự định chi bao nhiêu cho một người mỗi ngày?';

  @override
  String get onbBudgetSubtitle =>
      'Nhập ngân sách cho một người trong một ngày (VNĐ), rồi chọn mức chi tiêu phù hợp.';

  @override
  String get onbBudgetLabel => 'Ngân sách (VNĐ/người/ngày)';

  @override
  String get onbBudgetHint => 'Ví dụ: 700.000';

  @override
  String get onbBudgetInvalid =>
      'Vui lòng nhập số tiền nguyên từ 1 đến 1.000.000.000 VNĐ.';

  @override
  String get onbStayTitle => 'Bạn thích ở đâu khi du lịch?';

  @override
  String get onbStaySubtitle =>
      'Chọn một hoặc nhiều kiểu lưu trú phù hợp với bạn.';

  @override
  String get onbFoodTitle => 'Bạn thích ăn uống thế nào khi du lịch?';

  @override
  String get onbFoodSubtitle =>
      'Chọn những trải nghiệm ẩm thực bạn muốn khám phá.';

  @override
  String get onbActivityTitle => 'Bạn thích làm gì khi du lịch?';

  @override
  String get onbActivitySubtitle =>
      'Chọn những trải nghiệm làm cuối tuần của bạn đáng nhớ.';

  @override
  String get onbCustomAddOther => 'Thêm lựa chọn khác';

  @override
  String get onbCustomHint => 'Nhập lựa chọn của bạn…';

  @override
  String get onbCustomAdd => 'Thêm';

  @override
  String get onbCustomRemove => 'Xóa lựa chọn';

  @override
  String get onbNoteTitle =>
      'Còn điều gì đặc biệt về bạn mà TripSense nên biết?';

  @override
  String get onbNoteSubtitle =>
      'Chia sẻ về phong cách riêng, lưu ý ăn uống hoặc mong muốn để AI cá nhân hóa chuyến đi.';

  @override
  String get onbNoteHint =>
      'Ví dụ: Tôi thích du lịch chậm, chụp ảnh film, tìm quán cafe yên tĩnh…';

  @override
  String onbNoteCount(int current, int max) {
    return '$current / $max ký tự';
  }

  @override
  String get onbTagPhoto => 'Thích chụp ảnh & ngắm cảnh';

  @override
  String get onbTagCafe => 'Mê quán cafe đẹp & yên tĩnh';

  @override
  String get onbTagNature => 'Hòa mình vào thiên nhiên';

  @override
  String get onbTagBeach => 'Đi biển ngắm cảnh';

  @override
  String get onbTagTrek => 'Trekking mạo hiểm';

  @override
  String get onbTagVegetarian => 'Ưa chuộng món ăn chay';

  @override
  String get onbValidationFailed =>
      'Dữ liệu thiết lập chưa đầy đủ hoặc không hợp lệ. Vui lòng kiểm tra lại ngân sách và các bước trước đó.';

  @override
  String get optSolo => 'Đi một mình';

  @override
  String get optCouple => 'Đi đôi';

  @override
  String get optFriends => 'Cùng bạn bè';

  @override
  String get optFamily => 'Cùng gia đình';

  @override
  String get optBudget => 'Tiết kiệm';

  @override
  String get optMidRange => 'Tầm trung';

  @override
  String get optPremium => 'Cao cấp';

  @override
  String get optHotel => 'Khách sạn';

  @override
  String get optHomestay => 'Homestay';

  @override
  String get optResort => 'Resort';

  @override
  String get optHostel => 'Hostel';

  @override
  String get optLocalFood => 'Ẩm thực địa phương';

  @override
  String get optStreetFood => 'Ẩm thực đường phố';

  @override
  String get optFineDining => 'Ẩm thực cao cấp';

  @override
  String get optCafe => 'Quán cà phê chill';

  @override
  String get optNature => 'Thiên nhiên & Sinh thái';

  @override
  String get optHiking => 'Trekking & Leo núi';

  @override
  String get optCulture => 'Văn hóa & Lịch sử';

  @override
  String get optBeach => 'Đi biển ngắm cảnh';

  @override
  String get optNightlife => 'Cuộc sống về đêm';
}
