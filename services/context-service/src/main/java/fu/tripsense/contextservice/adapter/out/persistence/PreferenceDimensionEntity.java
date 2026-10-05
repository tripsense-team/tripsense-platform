package fu.tripsense.contextservice.adapter.out.persistence;

import jakarta.persistence.*;

@Entity
@Table(name = "preference_dimensions")
class PreferenceDimensionEntity {
  @Id String code;

  @Column(nullable = false)
  String cardinality;

  @Column(name = "sensitivity_class", nullable = false)
  String sensitivityClass;

  @Column(nullable = false)
  boolean active;
}
