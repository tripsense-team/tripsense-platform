import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_vi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('vi'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'TripSense'**
  String get appName;

  /// No description provided for @commonRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get commonRetry;

  /// No description provided for @commonCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get commonCancel;

  /// No description provided for @commonContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get commonContinue;

  /// No description provided for @commonBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get commonBack;

  /// No description provided for @commonLogout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get commonLogout;

  /// No description provided for @commonLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get commonLoading;

  /// No description provided for @commonEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing here yet'**
  String get commonEmpty;

  /// No description provided for @navExplore.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get navExplore;

  /// No description provided for @navTrips.
  ///
  /// In en, this message translates to:
  /// **'Trips'**
  String get navTrips;

  /// No description provided for @navAiPlanner.
  ///
  /// In en, this message translates to:
  /// **'AI Planner'**
  String get navAiPlanner;

  /// No description provided for @navCommunity.
  ///
  /// In en, this message translates to:
  /// **'Community'**
  String get navCommunity;

  /// No description provided for @navProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get navProfile;

  /// No description provided for @comingSoon.
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get comingSoon;

  /// No description provided for @errNetwork.
  ///
  /// In en, this message translates to:
  /// **'No internet connection. Please check your network.'**
  String get errNetwork;

  /// No description provided for @errTimeout.
  ///
  /// In en, this message translates to:
  /// **'The request took too long. Please try again.'**
  String get errTimeout;

  /// No description provided for @errUnauthorized.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired. Please sign in again.'**
  String get errUnauthorized;

  /// No description provided for @errForbidden.
  ///
  /// In en, this message translates to:
  /// **'Your account is not activated or has been suspended.'**
  String get errForbidden;

  /// No description provided for @errNotFound.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t find what you were looking for.'**
  String get errNotFound;

  /// No description provided for @errConflict.
  ///
  /// In en, this message translates to:
  /// **'This already exists. Please check and try again.'**
  String get errConflict;

  /// No description provided for @errValidation.
  ///
  /// In en, this message translates to:
  /// **'Some information is invalid. Please check and try again.'**
  String get errValidation;

  /// No description provided for @errRateLimited.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please wait a moment.'**
  String get errRateLimited;

  /// No description provided for @errServer.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong on our side. Please try again later.'**
  String get errServer;

  /// No description provided for @errUnknown.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errUnknown;

  /// No description provided for @errIncident.
  ///
  /// In en, this message translates to:
  /// **'Reference: {id}'**
  String errIncident(String id);

  /// No description provided for @errBadCredentials.
  ///
  /// In en, this message translates to:
  /// **'Incorrect email or password.'**
  String get errBadCredentials;

  /// No description provided for @errWebOnlyRole.
  ///
  /// In en, this message translates to:
  /// **'This account is managed on the TripSense website. Please sign in there.'**
  String get errWebOnlyRole;

  /// No description provided for @authWelcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome to TripSense'**
  String get authWelcomeTitle;

  /// No description provided for @authWelcomeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Plan smarter trips with AI.'**
  String get authWelcomeSubtitle;

  /// No description provided for @authLoginTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get authLoginTitle;

  /// No description provided for @authEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get authEmail;

  /// No description provided for @authPassword.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get authPassword;

  /// No description provided for @authLoginButton.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get authLoginButton;

  /// No description provided for @authNoAccount.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account?'**
  String get authNoAccount;

  /// No description provided for @authRegisterTitle.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get authRegisterTitle;

  /// No description provided for @authRegisterButton.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get authRegisterButton;

  /// No description provided for @authHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account?'**
  String get authHaveAccount;

  /// No description provided for @authForgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get authForgotPassword;

  /// No description provided for @authForgotSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your email and we\'ll send you a 6-digit code.'**
  String get authForgotSubtitle;

  /// No description provided for @authSendCode.
  ///
  /// In en, this message translates to:
  /// **'Send code'**
  String get authSendCode;

  /// No description provided for @authResetTitle.
  ///
  /// In en, this message translates to:
  /// **'Reset password'**
  String get authResetTitle;

  /// No description provided for @authNewPassword.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get authNewPassword;

  /// No description provided for @authResetButton.
  ///
  /// In en, this message translates to:
  /// **'Update password'**
  String get authResetButton;

  /// No description provided for @authResetDone.
  ///
  /// In en, this message translates to:
  /// **'Password updated. Please sign in.'**
  String get authResetDone;

  /// No description provided for @authVerifyTitle.
  ///
  /// In en, this message translates to:
  /// **'Verify your email'**
  String get authVerifyTitle;

  /// No description provided for @authVerifySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit code sent to {email}.'**
  String authVerifySubtitle(String email);

  /// No description provided for @authOtpCode.
  ///
  /// In en, this message translates to:
  /// **'6-digit code'**
  String get authOtpCode;

  /// No description provided for @authVerifyButton.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get authVerifyButton;

  /// No description provided for @authResendCode.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get authResendCode;

  /// No description provided for @authCodeSent.
  ///
  /// In en, this message translates to:
  /// **'A new code has been sent.'**
  String get authCodeSent;

  /// No description provided for @authVerified.
  ///
  /// In en, this message translates to:
  /// **'Email verified. Please sign in.'**
  String get authVerified;

  /// No description provided for @validationRequired.
  ///
  /// In en, this message translates to:
  /// **'This field is required'**
  String get validationRequired;

  /// No description provided for @validationEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address'**
  String get validationEmail;

  /// No description provided for @validationPasswordMin.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least {min} characters'**
  String validationPasswordMin(int min);

  /// No description provided for @validationOtp.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit code'**
  String get validationOtp;

  /// No description provided for @onbEyebrow.
  ///
  /// In en, this message translates to:
  /// **'Make TripSense yours'**
  String get onbEyebrow;

  /// No description provided for @onbProgress.
  ///
  /// In en, this message translates to:
  /// **'Step {current} of {total}'**
  String onbProgress(int current, int total);

  /// No description provided for @onbSkip.
  ///
  /// In en, this message translates to:
  /// **'Skip for now'**
  String get onbSkip;

  /// No description provided for @onbFinish.
  ///
  /// In en, this message translates to:
  /// **'Finish'**
  String get onbFinish;

  /// No description provided for @onbSaving.
  ///
  /// In en, this message translates to:
  /// **'Saving…'**
  String get onbSaving;

  /// No description provided for @onbLoadRetry.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t load your setup. Try again.'**
  String get onbLoadRetry;

  /// No description provided for @onbNameTitle.
  ///
  /// In en, this message translates to:
  /// **'What should we call you?'**
  String get onbNameTitle;

  /// No description provided for @onbNameHint.
  ///
  /// In en, this message translates to:
  /// **'Your display name'**
  String get onbNameHint;

  /// No description provided for @onbHomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Where are you currently based?'**
  String get onbHomeTitle;

  /// No description provided for @onbHomeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'This helps us tailor itineraries and departure points for you.'**
  String get onbHomeSubtitle;

  /// No description provided for @onbHomeHint.
  ///
  /// In en, this message translates to:
  /// **'Search or pick your home city…'**
  String get onbHomeHint;

  /// No description provided for @onbVisitedTitle.
  ///
  /// In en, this message translates to:
  /// **'Where have you traveled?'**
  String get onbVisitedTitle;

  /// No description provided for @onbVisitedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Select places you have visited so AI can suggest fresh experiences.'**
  String get onbVisitedSubtitle;

  /// No description provided for @onbBucketTitle.
  ///
  /// In en, this message translates to:
  /// **'Where is on your bucket list?'**
  String get onbBucketTitle;

  /// No description provided for @onbBucketSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Destinations you dream of visiting. We will tailor recommendations around them.'**
  String get onbBucketSubtitle;

  /// No description provided for @onbPlacesHint.
  ///
  /// In en, this message translates to:
  /// **'Search or type another destination…'**
  String get onbPlacesHint;

  /// No description provided for @onbPlacesAdd.
  ///
  /// In en, this message translates to:
  /// **'Add \"{name}\"'**
  String onbPlacesAdd(String name);

  /// No description provided for @onbPlacesMax.
  ///
  /// In en, this message translates to:
  /// **'Maximum 20 destinations per list.'**
  String get onbPlacesMax;

  /// No description provided for @onbPlacesSelected.
  ///
  /// In en, this message translates to:
  /// **'{count} selected'**
  String onbPlacesSelected(int count);

  /// No description provided for @onbPartyTitle.
  ///
  /// In en, this message translates to:
  /// **'Who do you usually travel with?'**
  String get onbPartyTitle;

  /// No description provided for @onbPartySubtitle.
  ///
  /// In en, this message translates to:
  /// **'This helps tailor suggestions to your travel rhythm.'**
  String get onbPartySubtitle;

  /// No description provided for @onbBudgetTitle.
  ///
  /// In en, this message translates to:
  /// **'How much do you plan to spend per person each day?'**
  String get onbBudgetTitle;

  /// No description provided for @onbBudgetSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your daily budget per person in VND, then choose a spending level.'**
  String get onbBudgetSubtitle;

  /// No description provided for @onbBudgetLabel.
  ///
  /// In en, this message translates to:
  /// **'Budget (VND/person/day)'**
  String get onbBudgetLabel;

  /// No description provided for @onbBudgetHint.
  ///
  /// In en, this message translates to:
  /// **'E.g. 700.000'**
  String get onbBudgetHint;

  /// No description provided for @onbBudgetInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a whole amount from 1 to 1,000,000,000 VND.'**
  String get onbBudgetInvalid;

  /// No description provided for @onbStayTitle.
  ///
  /// In en, this message translates to:
  /// **'Where do you like to stay?'**
  String get onbStayTitle;

  /// No description provided for @onbStaySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pick one or more stays that feel right for you.'**
  String get onbStaySubtitle;

  /// No description provided for @onbFoodTitle.
  ///
  /// In en, this message translates to:
  /// **'How do you like to eat when travelling?'**
  String get onbFoodTitle;

  /// No description provided for @onbFoodSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pick the food experiences you would like to discover.'**
  String get onbFoodSubtitle;

  /// No description provided for @onbActivityTitle.
  ///
  /// In en, this message translates to:
  /// **'What do you enjoy doing?'**
  String get onbActivityTitle;

  /// No description provided for @onbActivitySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose the experiences that make a weekend memorable.'**
  String get onbActivitySubtitle;

  /// No description provided for @onbCustomAddOther.
  ///
  /// In en, this message translates to:
  /// **'Add other choice'**
  String get onbCustomAddOther;

  /// No description provided for @onbCustomHint.
  ///
  /// In en, this message translates to:
  /// **'Enter your choice…'**
  String get onbCustomHint;

  /// No description provided for @onbCustomAdd.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get onbCustomAdd;

  /// No description provided for @onbCustomRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove choice'**
  String get onbCustomRemove;

  /// No description provided for @onbNoteTitle.
  ///
  /// In en, this message translates to:
  /// **'Anything else TripSense should know about you?'**
  String get onbNoteTitle;

  /// No description provided for @onbNoteSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Share any dietary needs, unique habits or style notes so AI can personalize your trips.'**
  String get onbNoteSubtitle;

  /// No description provided for @onbNoteHint.
  ///
  /// In en, this message translates to:
  /// **'E.g. I prefer slow travel, film photography, quiet cafés…'**
  String get onbNoteHint;

  /// No description provided for @onbNoteCount.
  ///
  /// In en, this message translates to:
  /// **'{current} / {max} characters'**
  String onbNoteCount(int current, int max);

  /// No description provided for @onbTagPhoto.
  ///
  /// In en, this message translates to:
  /// **'Photography & sightseeing'**
  String get onbTagPhoto;

  /// No description provided for @onbTagCafe.
  ///
  /// In en, this message translates to:
  /// **'Aesthetic & cozy cafés'**
  String get onbTagCafe;

  /// No description provided for @onbTagNature.
  ///
  /// In en, this message translates to:
  /// **'Immersed in nature'**
  String get onbTagNature;

  /// No description provided for @onbTagBeach.
  ///
  /// In en, this message translates to:
  /// **'Scenic beach walks'**
  String get onbTagBeach;

  /// No description provided for @onbTagTrek.
  ///
  /// In en, this message translates to:
  /// **'Adventure trekking'**
  String get onbTagTrek;

  /// No description provided for @onbTagVegetarian.
  ///
  /// In en, this message translates to:
  /// **'Vegetarian friendly'**
  String get onbTagVegetarian;

  /// No description provided for @onbValidationFailed.
  ///
  /// In en, this message translates to:
  /// **'The onboarding data is incomplete or invalid. Please check your budget and earlier steps.'**
  String get onbValidationFailed;

  /// No description provided for @optSolo.
  ///
  /// In en, this message translates to:
  /// **'Solo'**
  String get optSolo;

  /// No description provided for @optCouple.
  ///
  /// In en, this message translates to:
  /// **'As a couple'**
  String get optCouple;

  /// No description provided for @optFriends.
  ///
  /// In en, this message translates to:
  /// **'With friends'**
  String get optFriends;

  /// No description provided for @optFamily.
  ///
  /// In en, this message translates to:
  /// **'With family'**
  String get optFamily;

  /// No description provided for @optBudget.
  ///
  /// In en, this message translates to:
  /// **'Budget-friendly'**
  String get optBudget;

  /// No description provided for @optMidRange.
  ///
  /// In en, this message translates to:
  /// **'Mid-range'**
  String get optMidRange;

  /// No description provided for @optPremium.
  ///
  /// In en, this message translates to:
  /// **'Premium'**
  String get optPremium;

  /// No description provided for @optHotel.
  ///
  /// In en, this message translates to:
  /// **'Hotel'**
  String get optHotel;

  /// No description provided for @optHomestay.
  ///
  /// In en, this message translates to:
  /// **'Homestay'**
  String get optHomestay;

  /// No description provided for @optResort.
  ///
  /// In en, this message translates to:
  /// **'Resort'**
  String get optResort;

  /// No description provided for @optHostel.
  ///
  /// In en, this message translates to:
  /// **'Hostel'**
  String get optHostel;

  /// No description provided for @optLocalFood.
  ///
  /// In en, this message translates to:
  /// **'Local food'**
  String get optLocalFood;

  /// No description provided for @optStreetFood.
  ///
  /// In en, this message translates to:
  /// **'Street food'**
  String get optStreetFood;

  /// No description provided for @optFineDining.
  ///
  /// In en, this message translates to:
  /// **'Fine dining'**
  String get optFineDining;

  /// No description provided for @optCafe.
  ///
  /// In en, this message translates to:
  /// **'Aesthetic cafés'**
  String get optCafe;

  /// No description provided for @optNature.
  ///
  /// In en, this message translates to:
  /// **'Nature & Wildlife'**
  String get optNature;

  /// No description provided for @optHiking.
  ///
  /// In en, this message translates to:
  /// **'Hiking & Trekking'**
  String get optHiking;

  /// No description provided for @optCulture.
  ///
  /// In en, this message translates to:
  /// **'Culture & History'**
  String get optCulture;

  /// No description provided for @optBeach.
  ///
  /// In en, this message translates to:
  /// **'Scenic beach walks'**
  String get optBeach;

  /// No description provided for @optNightlife.
  ///
  /// In en, this message translates to:
  /// **'Nightlife'**
  String get optNightlife;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'vi'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'vi':
      return AppLocalizationsVi();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
