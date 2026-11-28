// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'TripSense';

  @override
  String get commonRetry => 'Try again';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonContinue => 'Continue';

  @override
  String get commonBack => 'Back';

  @override
  String get commonLogout => 'Log out';

  @override
  String get commonLoading => 'Loading…';

  @override
  String get commonEmpty => 'Nothing here yet';

  @override
  String get navExplore => 'Explore';

  @override
  String get navTrips => 'Trips';

  @override
  String get navAiPlanner => 'Planner';

  @override
  String get navCommunity => 'Community';

  @override
  String get navProfile => 'Profile';

  @override
  String get comingSoon => 'Coming soon';

  @override
  String get errNetwork => 'No internet connection. Please check your network.';

  @override
  String get errTimeout => 'The request took too long. Please try again.';

  @override
  String get errUnauthorized =>
      'Your session has expired. Please sign in again.';

  @override
  String get errForbidden =>
      'Your account is not activated or has been suspended.';

  @override
  String get errNotFound => 'We couldn\'t find what you were looking for.';

  @override
  String get errConflict => 'This already exists. Please check and try again.';

  @override
  String get errValidation =>
      'Some information is invalid. Please check and try again.';

  @override
  String get errRateLimited => 'Too many attempts. Please wait a moment.';

  @override
  String get errServer =>
      'Something went wrong on our side. Please try again later.';

  @override
  String get errUnknown => 'Something went wrong. Please try again.';

  @override
  String errIncident(String id) {
    return 'Reference: $id';
  }

  @override
  String get errBadCredentials => 'Incorrect email or password.';

  @override
  String get errWebOnlyRole =>
      'This account is managed on the TripSense website. Please sign in there.';

  @override
  String get authWelcomeTitle => 'Welcome to TripSense';

  @override
  String get authWelcomeSubtitle => 'Plan smarter trips with AI.';

  @override
  String get authLoginTitle => 'Sign in';

  @override
  String get authEmail => 'Email';

  @override
  String get authPassword => 'Password';

  @override
  String get authLoginButton => 'Sign in';

  @override
  String get authNoAccount => 'Don\'t have an account?';

  @override
  String get authRegisterTitle => 'Create account';

  @override
  String get authRegisterButton => 'Create account';

  @override
  String get authHaveAccount => 'Already have an account?';

  @override
  String get authForgotPassword => 'Forgot password?';

  @override
  String get authForgotSubtitle =>
      'Enter your email and we\'ll send you a 6-digit code.';

  @override
  String get authSendCode => 'Send code';

  @override
  String get authResetTitle => 'Reset password';

  @override
  String get authNewPassword => 'New password';

  @override
  String get authResetButton => 'Update password';

  @override
  String get authResetDone => 'Password updated. Please sign in.';

  @override
  String get authVerifyTitle => 'Verify your email';

  @override
  String authVerifySubtitle(String email) {
    return 'Enter the 6-digit code sent to $email.';
  }

  @override
  String get authOtpCode => '6-digit code';

  @override
  String get authVerifyButton => 'Verify';

  @override
  String get authResendCode => 'Resend code';

  @override
  String get authCodeSent => 'A new code has been sent.';

  @override
  String get authVerified => 'Email verified. Please sign in.';

  @override
  String get validationRequired => 'This field is required';

  @override
  String get validationEmail => 'Enter a valid email address';

  @override
  String validationPasswordMin(int min) {
    return 'Password must be at least $min characters';
  }

  @override
  String get validationOtp => 'Enter the 6-digit code';

  @override
  String get onbEyebrow => 'Make TripSense yours';

  @override
  String onbProgress(int current, int total) {
    return 'Step $current of $total';
  }

  @override
  String get onbSkip => 'Skip for now';

  @override
  String get onbFinish => 'Finish';

  @override
  String get onbSaving => 'Saving…';

  @override
  String get onbLoadRetry => 'We couldn\'t load your setup. Try again.';

  @override
  String get onbNameTitle => 'What should we call you?';

  @override
  String get onbNameHint => 'Your display name';

  @override
  String get onbHomeTitle => 'Where are you currently based?';

  @override
  String get onbHomeSubtitle =>
      'This helps us tailor itineraries and departure points for you.';

  @override
  String get onbHomeHint => 'Search or pick your home city…';

  @override
  String get onbVisitedTitle => 'Where have you traveled?';

  @override
  String get onbVisitedSubtitle =>
      'Select places you have visited so AI can suggest fresh experiences.';

  @override
  String get onbBucketTitle => 'Where is on your bucket list?';

  @override
  String get onbBucketSubtitle =>
      'Destinations you dream of visiting. We will tailor recommendations around them.';

  @override
  String get onbPlacesHint => 'Search or type another destination…';

  @override
  String onbPlacesAdd(String name) {
    return 'Add \"$name\"';
  }

  @override
  String get onbPlacesMax => 'Maximum 20 destinations per list.';

  @override
  String onbPlacesSelected(int count) {
    return '$count selected';
  }

  @override
  String get onbPartyTitle => 'Who do you usually travel with?';

  @override
  String get onbPartySubtitle =>
      'This helps tailor suggestions to your travel rhythm.';

  @override
  String get onbBudgetTitle =>
      'How much do you plan to spend per person each day?';

  @override
  String get onbBudgetSubtitle =>
      'Enter your daily budget per person in VND, then choose a spending level.';

  @override
  String get onbBudgetLabel => 'Budget (VND/person/day)';

  @override
  String get onbBudgetHint => 'E.g. 700.000';

  @override
  String get onbBudgetInvalid =>
      'Enter a whole amount from 1 to 1,000,000,000 VND.';

  @override
  String get onbStayTitle => 'Where do you like to stay?';

  @override
  String get onbStaySubtitle =>
      'Pick one or more stays that feel right for you.';

  @override
  String get onbFoodTitle => 'How do you like to eat when travelling?';

  @override
  String get onbFoodSubtitle =>
      'Pick the food experiences you would like to discover.';

  @override
  String get onbActivityTitle => 'What do you enjoy doing?';

  @override
  String get onbActivitySubtitle =>
      'Choose the experiences that make a weekend memorable.';

  @override
  String get onbCustomAddOther => 'Add other choice';

  @override
  String get onbCustomHint => 'Enter your choice…';

  @override
  String get onbCustomAdd => 'Add';

  @override
  String get onbCustomRemove => 'Remove choice';

  @override
  String get onbNoteTitle => 'Anything else TripSense should know about you?';

  @override
  String get onbNoteSubtitle =>
      'Share any dietary needs, unique habits or style notes so AI can personalize your trips.';

  @override
  String get onbNoteHint =>
      'E.g. I prefer slow travel, film photography, quiet cafés…';

  @override
  String onbNoteCount(int current, int max) {
    return '$current / $max characters';
  }

  @override
  String get onbTagPhoto => 'Photography & sightseeing';

  @override
  String get onbTagCafe => 'Aesthetic & cozy cafés';

  @override
  String get onbTagNature => 'Immersed in nature';

  @override
  String get onbTagBeach => 'Scenic beach walks';

  @override
  String get onbTagTrek => 'Adventure trekking';

  @override
  String get onbTagVegetarian => 'Vegetarian friendly';

  @override
  String get onbValidationFailed =>
      'The onboarding data is incomplete or invalid. Please check your budget and earlier steps.';

  @override
  String get optSolo => 'Solo';

  @override
  String get optCouple => 'As a couple';

  @override
  String get optFriends => 'With friends';

  @override
  String get optFamily => 'With family';

  @override
  String get optBudget => 'Budget-friendly';

  @override
  String get optMidRange => 'Mid-range';

  @override
  String get optPremium => 'Premium';

  @override
  String get optHotel => 'Hotel';

  @override
  String get optHomestay => 'Homestay';

  @override
  String get optResort => 'Resort';

  @override
  String get optHostel => 'Hostel';

  @override
  String get optLocalFood => 'Local food';

  @override
  String get optStreetFood => 'Street food';

  @override
  String get optFineDining => 'Fine dining';

  @override
  String get optCafe => 'Aesthetic cafés';

  @override
  String get optNature => 'Nature & Wildlife';

  @override
  String get optHiking => 'Hiking & Trekking';

  @override
  String get optCulture => 'Culture & History';

  @override
  String get optBeach => 'Scenic beach walks';

  @override
  String get optNightlife => 'Nightlife';

  @override
  String get authHeroBadge => 'Next-Gen AI Travel Companion';

  @override
  String get authHeroTitle => 'Travel differently.';

  @override
  String get authHeroSubtitle =>
      'Plan trips, get personalized recommendations, and book all in one place with intelligent AI assistance.';

  @override
  String get navChat => 'Chat';

  @override
  String get navSaved => 'Saved';

  @override
  String onbProgressPercent(int percent) {
    return '$percent%';
  }

  @override
  String get exploreSearchHint => 'Search places, food, cafés…';

  @override
  String get exploreClearSearch => 'Clear search';

  @override
  String get exploreTabForYou => 'For you';

  @override
  String get exploreTabFood => 'Food';

  @override
  String get exploreTabCafes => 'Cafés';

  @override
  String get exploreTabStays => 'Stays';

  @override
  String get exploreTabAttractions => 'Attractions';

  @override
  String get exploreEmptyTitle => 'No places found';

  @override
  String get exploreEmptyHint => 'Try another keyword or destination.';

  @override
  String exploreSearchResults(String query) {
    return 'Results for \"$query\"';
  }

  @override
  String get exploreFallbackNote =>
      'Showing popular places while we personalize your feed.';

  @override
  String get exploreChooseDestination => 'Choose destination';

  @override
  String placeReviewsCount(int count) {
    return '($count)';
  }

  @override
  String placeOpenToday(String hours) {
    return 'Today: $hours';
  }

  @override
  String get placeAbout => 'About';

  @override
  String get placeHours => 'Opening hours';

  @override
  String get placeContact => 'Contact';

  @override
  String get placeReviews => 'Reviews';

  @override
  String get placeAddress => 'Address';

  @override
  String get placeNoPhoto => 'No photo yet';

  @override
  String get placeBack => 'Back';

  @override
  String get commonSave => 'Save';

  @override
  String get commonCreate => 'Create';

  @override
  String get commonDelete => 'Delete';

  @override
  String get commonEdit => 'Edit';

  @override
  String get savedTitle => 'Saved places';

  @override
  String get savedDescription => 'All the places you saved for later.';

  @override
  String get savedEmptyTitle => 'No saved places yet';

  @override
  String get savedEmptyHint => 'Save places from Explore to find them here.';

  @override
  String get savedAll => 'All';

  @override
  String get savedManageCollections => 'Manage collections';

  @override
  String get savedLoadMoreFailed => 'Could not load more places.';

  @override
  String get saveButtonSave => 'Save place';

  @override
  String get saveButtonSaved => 'Saved. Edit collections';

  @override
  String get saveToCollection => 'Save to collection';

  @override
  String get collectionsTitle => 'Collections';

  @override
  String get collectionsDescription =>
      'Organize saved places into collections.';

  @override
  String get collectionCreate => 'Create collection';

  @override
  String get collectionRename => 'Rename collection';

  @override
  String get collectionDelete => 'Delete collection';

  @override
  String get collectionDeleteHint =>
      'The collection will be deleted. Saved places remain available in other collections.';

  @override
  String get collectionNameHint => 'New collection name';

  @override
  String get collectionsEmptyTitle => 'No collections yet';

  @override
  String get collectionsEmptyHint =>
      'Create a collection to organize places you want to remember.';

  @override
  String collectionPlacesCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count places',
      one: '1 place',
    );
    return '$_temp0';
  }
}
