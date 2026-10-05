package fu.tripsense.userservice.entity;

import fu.tripsense.userservice.enums.UserStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(nullable = false, unique = true)
  private String email;

  @Column(nullable = true)
  private String password;

  @Column(nullable = false, length = 50)
  private String role;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private UserStatus status;

  @Column(
      name = "auth_provider",
      nullable = false,
      length = 50,
      columnDefinition = "VARCHAR(50) DEFAULT 'LOCAL'")
  @Builder.Default
  private String authProvider = "LOCAL";

  @Column(name = "provider_id")
  private String providerId;

  @Column(name = "partner_enrolled", nullable = false)
  @Builder.Default
  private boolean partnerEnrolled = false;

  @Column(name = "partner_enrolled_at")
  private LocalDateTime partnerEnrolledAt;

  @Column(name = "partner_terms_version", length = 50)
  private String partnerTermsVersion;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private LocalDateTime updatedAt;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;

  public java.util.List<String> getRoles() {
    java.util.List<String> roles = new java.util.ArrayList<>();
    if (role != null) {
      String mainRole = role.startsWith("ROLE_") ? role : "ROLE_" + role;
      roles.add(mainRole);
    }
    if (partnerEnrolled && !roles.contains("ROLE_PARTNER")) {
      roles.add("ROLE_PARTNER");
    }
    return roles;
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    java.util.List<GrantedAuthority> authorities = new java.util.ArrayList<>();
    for (String r : getRoles()) {
      authorities.add(new SimpleGrantedAuthority(r));
    }
    return authorities;
  }

  @Override
  public String getUsername() {
    return email;
  }

  @Override
  public boolean isAccountNonExpired() {
    return true;
  }

  @Override
  public boolean isAccountNonLocked() {
    return status != UserStatus.INACTIVE;
  }

  @Override
  public boolean isCredentialsNonExpired() {
    return true;
  }

  @Override
  public boolean isEnabled() {
    return status == UserStatus.ACTIVE;
  }
}
