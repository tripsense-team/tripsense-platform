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
}
