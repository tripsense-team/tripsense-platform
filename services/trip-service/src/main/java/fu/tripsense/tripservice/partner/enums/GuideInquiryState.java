package fu.tripsense.tripservice.partner.enums;

public enum GuideInquiryState {
  SUBMITTED,
  IN_DISCUSSION,
  PROPOSAL_SENT,
  CONTACT_AGREED,
  DECLINED,
  WITHDRAWN,
  EXPIRED,
  CLOSED;

  public boolean isTerminal() {
    return this == CONTACT_AGREED
        || this == DECLINED
        || this == WITHDRAWN
        || this == EXPIRED
        || this == CLOSED;
  }
}
